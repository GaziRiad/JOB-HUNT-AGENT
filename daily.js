#!/usr/bin/env node
// Orchestrator: fetch -> dedupe -> drop already-seen -> prefilter -> (Phase 3:
// score + draft) -> write to Google Sheet tabs + Seen + Runs.
//
//   node daily.js                 # real run (needs SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON)
//   node daily.js --dry-run       # write out/preview.json instead of the Sheet
//   JHA_FIXTURES=1 node daily.js --dry-run   # offline end-to-end using test fixtures
import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { profile } from './config/profile.js';
import { weights } from './config/weights.js';
import { collectJobs } from './src/sources/index.js';
import { dedupeJobs } from './src/dedupe.js';
import { prefilter } from './src/prefilter.js';
import { TAB, TAB_SPECS, jobToRow, seenRow, runRow, tabForJob, sumFetched } from './src/rows.js';
import { createClient } from './src/anthropic.js';
import { scoreAndDraft } from './src/enrich.js';
import { makeFakeClient } from './src/fakeClient.js';

function requireEnv(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing required env ${key}. See README "Setup".`);
    process.exit(1);
  }
  return v;
}

async function collectFromFixtures() {
  const { parseGreenhouse } = await import('./src/sources/ats-greenhouse.js');
  const { parseLever } = await import('./src/sources/ats-lever.js');
  const { parseAshby } = await import('./src/sources/ats-ashby.js');
  const read = (n) => JSON.parse(readFileSync(new URL(`./test/fixtures/${n}`, import.meta.url)));
  const jobs = [
    ...parseGreenhouse(read('greenhouse.json'), { name: 'GitLab', token: 'gitlab' }),
    ...parseLever(read('lever.json'), { name: 'Netlify', slug: 'netlify' }),
    ...parseAshby(read('ashby.json'), { name: 'Ramp', slug: 'ramp' }),
  ];
  return { jobs, stats: { ok: 3, failed: 0, perSource: { 'greenhouse:gitlab': 2, 'lever:netlify': 2, 'ashby:ramp': 2 } } };
}

async function collectForRun() {
  if (process.env.JHA_FIXTURES === '1') return collectFromFixtures();
  return collectJobs();
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  const trigger = process.env.JHA_TRIGGER || (process.argv.includes('--manual') ? 'manual' : 'scheduled');
  console.log(`daily run: trigger=${trigger} dry=${dry} fixtures=${process.env.JHA_FIXTURES === '1'}`);

  const { jobs, stats } = await collectForRun();
  const deduped = dedupeJobs(jobs);

  let seenIds = new Set();
  let ctx = null;
  if (!dry) {
    const spreadsheetId = requireEnv('SHEET_ID');
    const s = await import('./src/sheets.js');
    const sheets = await s.getSheets();
    await s.ensureTabs(sheets, spreadsheetId, TAB_SPECS);
    seenIds = new Set(await s.readColumn(sheets, spreadsheetId, TAB.SEEN, 'A'));
    ctx = { s, sheets, spreadsheetId };
  }

  const fresh = deduped.filter((j) => !seenIds.has(j.id));
  const passed = fresh.filter((j) => prefilter(j, profile).pass);

  // LLM stage: score + tier + draft on survivors. Falls back to unscored rows
  // when there is no client (no ANTHROPIC_API_KEY), so the pipeline still runs.
  const client = process.env.JHA_FAKE_LLM === '1' ? makeFakeClient() : createClient();
  let enriched;
  let llmCost = null;
  if (client) {
    const r = await scoreAndDraft(client, passed, { profile, weights });
    enriched = r.enriched;
    llmCost = r.cost;
    enriched.sort((a, b) => (b.scoring?.score || 0) - (a.scoring?.score || 0));
  } else {
    enriched = passed.map((job) => ({ job, scoring: null }));
  }

  const now = new Date().toISOString();
  const byTab = {};
  for (const { job, scoring } of enriched) {
    const tab = tabForJob(job, scoring);
    if (scoring) scoring.tier = tab === TAB.TIER1 ? 'Tier 1' : tab === TAB.FREELANCE ? 'Freelance' : 'Tier 2';
    (byTab[tab] ||= []).push(jobToRow(job, scoring, now));
  }
  const tierCounts = Object.fromEntries(Object.entries(byTab).map(([k, v]) => [k, v.length]));
  const written = passed.length;

  if (dry) {
    mkdirSync('out', { recursive: true });
    writeFileSync('out/preview.json', JSON.stringify({ stats, deduped: deduped.length, fresh: fresh.length, written, tierCounts, tabs: byTab }, null, 2));
  } else {
    const { s, sheets, spreadsheetId } = ctx;
    for (const [tab, rows] of Object.entries(byTab)) await s.appendRows(sheets, spreadsheetId, tab, rows);
    await s.appendRows(sheets, spreadsheetId, TAB.SEEN, passed.map((j) => seenRow(j, now)));
    await s.appendRows(sheets, spreadsheetId, TAB.RUNS, [
      runRow({ now, trigger, stats, freshCount: fresh.length, writtenCount: written, tierCounts, cost: llmCost, notes: client ? '' : 'no LLM key: rows unscored' }),
    ]);
  }

  console.log(`sources ok=${stats.ok} failed=${stats.failed} | fetched=${sumFetched(stats)} deduped=${deduped.length} fresh=${fresh.length} written=${written}`);
  console.log(`  Tier1=${tierCounts[TAB.TIER1] || 0} Tier2=${tierCounts[TAB.TIER2] || 0} Freelance=${tierCounts[TAB.FREELANCE] || 0}`);
  console.log(`  scored=${client ? 'yes' : 'no (no ANTHROPIC_API_KEY)'}${llmCost != null ? ` llmCost=$${llmCost.toFixed(4)}` : ''}`);
  if (dry) console.log('  (dry-run) wrote out/preview.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
