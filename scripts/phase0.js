#!/usr/bin/env node
// Phase 0: prove the pipe. Fetch curated ATS boards, normalize, dedupe,
// run the code pre-filter, and print a summary. No Sheets, no LLM.
//   node scripts/phase0.js
import { companies } from '../config/companies.js';
import { profile } from '../config/profile.js';
import { fetchGreenhouse } from '../src/sources/ats-greenhouse.js';
import { fetchLever } from '../src/sources/ats-lever.js';
import { fetchAshby } from '../src/sources/ats-ashby.js';
import { dedupeJobs } from '../src/dedupe.js';
import { prefilter } from '../src/prefilter.js';
import { mapLimit } from '../src/lib/async.js';

function buildTasks() {
  const tasks = [];
  for (const c of companies.greenhouse || []) tasks.push({ label: `greenhouse:${c.token}`, run: () => fetchGreenhouse(c) });
  for (const c of companies.lever || []) tasks.push({ label: `lever:${c.slug}`, run: () => fetchLever(c) });
  for (const c of companies.ashby || []) tasks.push({ label: `ashby:${c.slug}`, run: () => fetchAshby(c) });
  return tasks;
}

async function main() {
  const tasks = buildTasks();
  console.log(`Phase 0: fetching ${tasks.length} ATS boards (concurrency 6)...\n`);

  const results = await mapLimit(tasks, 6, async (task) => {
    try {
      return { label: task.label, jobs: await task.run() };
    } catch (err) {
      return { label: task.label, error: err.status ? `HTTP ${err.status}` : err.message };
    }
  });

  let all = [];
  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.error) {
      failed += 1;
      console.log(`  x ${r.label.padEnd(26)} ${r.error}`);
    } else {
      ok += 1;
      all = all.concat(r.jobs);
      console.log(`  ✓ ${r.label.padEnd(26)} ${r.jobs.length} jobs`);
    }
  }

  const deduped = dedupeJobs(all);
  const passed = deduped.filter((j) => prefilter(j, profile).pass);

  console.log(`\nBoards reachable : ${ok}/${tasks.length}  (failed: ${failed})`);
  console.log(`Jobs fetched     : ${all.length}`);
  console.log(`After dedupe     : ${deduped.length}`);
  console.log(`Passed prefilter : ${passed.length}`);

  if (ok === 0) {
    console.log(
      '\nNo boards reachable. If you are running inside a restricted network ' +
      '(e.g. a Claude cloud session), outbound egress is blocked — run this on ' +
      'your own machine, where it will work.',
    );
    return;
  }

  console.log('\nSample passing rows (up to 12):');
  for (const j of passed.slice(0, 12)) {
    console.log(`  [${j.remoteType}/${j.employmentType}] ${j.company} — ${j.title}`);
    console.log(`      ${j.url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
