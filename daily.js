#!/usr/bin/env node
// Orchestrator: fetch -> dedupe -> drop already-seen -> prefilter -> cheap rank
// + cap -> LLM score + draft -> write to Google Sheet tabs + Seen + Runs.
//
//   node daily.js --demo                          # offline: fixtures + fake LLM, no keys/network/spend
//   node daily.js --dry-run --yes                 # real fetch + scoring to out/preview.json (spends)
//   node daily.js --dry-run --limit 5 --no-draft  # cheapest real test (~$0.01)
//   node daily.js                                 # real run -> Google Sheet (needs env; --yes if interactive)
//   node daily.js --check                         # free: verify .env + Google Sheet (no fetch, no LLM)
// Flags: --limit N (cap scored jobs), --no-draft (skip drafts), --yes (allow spend), --dry-run, --demo, --check
import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { profile } from './config/profile.js';
import { weights } from './config/weights.js';
import { collectJobs } from './src/sources/index.js';
import { dedupeJobs } from './src/dedupe.js';
import { prefilter } from './src/prefilter.js';
import { TAB, TAB_SPECS, jobToRow, seenRow, runRow, tabForJob, sumFetched } from './src/rows.js';
import { createClient, MODELS, estimateRunCost } from './src/anthropic.js';
import { scoreAndDraft } from './src/enrich.js';
import { rankAndCap } from './src/rank.js';
import { makeFakeClient } from './src/fakeClient.js';

function requireEnv(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing required env ${key}. See README "Setup".`);
    process.exit(1);
  }
  return v;
}

function parseLimit(argv) {
  const i = argv.findIndex((a) => a === '--limit' || a.startsWith('--limit='));
  if (i === -1) return null;
  const raw = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
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

async function collectForRun(useFixtures) {
  if (useFixtures) return collectFromFixtures();
  return collectJobs();
}

async function main() {
  const argv = process.argv.slice(2);
  const demo = argv.includes('--demo'); // fixtures + fake LLM, no keys/network/spend
  const dry = demo || argv.includes('--dry-run');
  const useFixtures = demo || process.env.JHA_FIXTURES === '1';
  const useFakeLlm = demo || process.env.JHA_FAKE_LLM === '1';
  const noDraft = argv.includes('--no-draft');
  const yes = argv.includes('--yes');
  const check = argv.includes('--check');
  const limit = parseLimit(argv);
  const trigger = process.env.JHA_TRIGGER || (argv.includes('--manual') ? 'manual' : 'scheduled');
  console.log(`daily run: trigger=${trigger} dry=${dry} fixtures=${useFixtures}`);

  if (check) {
    // Free connection check: verify env + Google Sheet only. No fetch, no LLM, $0.
    const spreadsheetId = requireEnv('SHEET_ID');
    const s = await import('./src/sheets.js');
    const sheets = await s.getSheets();
    await s.ensureTabs(sheets, spreadsheetId, TAB_SPECS);
    await s.appendRows(sheets, spreadsheetId, TAB.RUNS, [
      runRow({ now: new Date().toISOString(), trigger: 'check', stats: { ok: 0, failed: 0, perSource: {} }, freshCount: 0, writtenCount: 0, tierCounts: {}, cost: 0, notes: 'connection check OK' }),
    ]);
    console.log('check OK: .env loaded, Google Sheet reachable, tabs ensured, test row written to Runs. No LLM used, $0 spent.');
    return;
  }

  console.log('fetching sources...');
  const { jobs, stats } = await collectForRun(useFixtures);
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

  // Cost guardrail: rank cheaply (free) and keep only the top N for the paid stage.
  const cap = limit != null ? limit : weights.maxScored;
  const ranked = rankAndCap(passed, profile, cap);
  const draftLimit = noDraft ? 0 : weights.draftTopN;

  // Per-source counts so the fetch phase is never a silent black box.
  for (const [label, v] of Object.entries(stats.perSource)) {
    console.log(`  ${typeof v === 'number' ? 'ok  ' : 'fail'} ${label}: ${v}`);
  }
  console.log(`candidates: ${passed.length} passed filter -> will score top ${ranked.length} (cap ${cap})`);

  // LLM stage: score + draft. Falls back to unscored rows when there is no client.
  const client = useFakeLlm ? makeFakeClient() : createClient();

  // Spend gate: never charge on an interactive run without an explicit --yes.
  const willSpend = !!client && !useFakeLlm && ranked.length > 0;
  if (willSpend) {
    const estDrafts = Math.min(draftLimit, ranked.length);
    const est = estimateRunCost(ranked.length, estDrafts);
    console.log(`about to score ${ranked.length} + draft up to ${estDrafts} (${MODELS.score}/${MODELS.draft}): estimated ~$${est.toFixed(2)}`);
    if (process.stdout.isTTY && !yes) {
      console.log('this spends real credits. re-run with --yes to proceed, or `npm run demo` for a free test.');
      return;
    }
  }

  let enriched;
  let llmCost = null;
  if (client) {
    const r = await scoreAndDraft(client, ranked, { profile, weights, draftLimit });
    enriched = r.enriched;
    llmCost = r.cost;
    enriched.sort((a, b) => (b.scoring?.score || 0) - (a.scoring?.score || 0));
  } else {
    enriched = ranked.map((job) => ({ job, scoring: null }));
  }

  const now = new Date().toISOString();
  const byTab = {};
  for (const { job, scoring } of enriched) {
    const tab = tabForJob(job, scoring);
    if (scoring) scoring.tier = tab === TAB.TIER1 ? 'Tier 1' : tab === TAB.FREELANCE ? 'Freelance' : 'Tier 2';
    (byTab[tab] ||= []).push(jobToRow(job, scoring, now));
  }
  const tierCounts = Object.fromEntries(Object.entries(byTab).map(([k, v]) => [k, v.length]));
  const written = enriched.length;

  if (dry) {
    mkdirSync('out', { recursive: true });
    writeFileSync('out/preview.json', JSON.stringify({ stats, deduped: deduped.length, fresh: fresh.length, written, tierCounts, tabs: byTab }, null, 2));
  } else {
    const { s, sheets, spreadsheetId } = ctx;
    for (const [tab, rows] of Object.entries(byTab)) await s.appendRows(sheets, spreadsheetId, tab, rows);
    await s.appendRows(sheets, spreadsheetId, TAB.SEEN, enriched.map(({ job }) => seenRow(job, now)));
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
