# Job Hunt Agent

An automated daily job hunt that runs on GitHub Actions (no machine of yours needs to be on), pulls remote and freelance/contract developer roles, filters and scores them for fit from Algeria (UTC+1, JS/TS/React/Next/Node + AI-integration), and writes ranked results with drafted outreach into a Google Sheet. A button in the Sheet re-runs it on demand.

## Honest expectations first

The hard constraint is not fetching jobs, it is that most "remote" roles will not hire someone based in Algeria. Expect a handful of credibly-eligible roles per day, not 50. The Sheet reflects that with two tiers:

- **Remote - Tier 1**: credibly eligible (worldwide / global / EOR / contractor-anywhere).
- **Remote - Tier 2**: worldwide-remote but speculative (no explicit exclusion, no positive eligibility signal).
- **Freelance / Contract**: contract/project roles classified out of the same feeds (not an Upwork/Fiverr scraper, which is closed and hostile to automation in 2026).

The curated company list and the eligibility judgment are where the value is. The tool surfaces demand; it does not create it.

## How it works

```
GitHub Actions (daily cron OR the Sheet button)
  -> fetch sources (ATS boards now; aggregator feeds + HN in Phase 4), each isolated
  -> normalize to one schema -> dedupe -> drop already-seen (Seen tab)
  -> code prefilter (remote/contract? region not locked? stack match?)  [free]
  -> cheap code rank + hard cap (default top 15)                         [free guardrail]
  -> LLM stage 1 (Claude Haiku): eligibility + fit score + rationale     [capped set only]
  -> LLM stage 2 (Claude Haiku): DM + cover letter / proposal           [top 5 only]
  -> write Google Sheet tabs + Seen + Runs
```

Code does the cheap deterministic work; a free ranker then caps how many jobs reach the paid stage (default 15 scored, 5 drafted), so a run is bounded at roughly $0.03 to $0.05 and cannot blow past the cap. See "Cost and safety".

## Commands

```bash
npm install
npm test                                      # offline logic tests (no network/keys/spend)
npm run demo                                  # full offline end-to-end (fixtures + fake LLM), $0
node scripts/phase0.js                        # fetch curated ATS boards, print results (free)
node daily.js --dry-run --limit 5 --no-draft  # cheapest real test (~$0.01) -> out/preview.json
node daily.js --dry-run --yes                 # real fetch + scoring -> out/preview.json (spends)
node daily.js --yes                           # real run -> Google Sheet (needs all env below)
```

Flags: `--limit N` caps scored jobs, `--no-draft` skips drafts, `--yes` allows spend (an interactive run refuses to spend without it), `--dry-run` writes a file instead of the Sheet, `--demo` runs fully offline.

## Cost and safety

Guardrails so a run can never surprise you:

- **Hard cap:** at most `maxScored` jobs (default 15) reach the paid stage per run, picked by a free code ranker; the rest are skipped.
- **Draft cap:** at most `draftTopN` jobs (default 5) get a drafted DM + letter (the pricier half); `--no-draft` skips drafting.
- **Spend gate:** an interactive local run prints its estimated cost and stops unless you pass `--yes`. `npm run demo` never spends.
- **Auto-run off:** the daily GitHub Actions schedule is disabled by default, so it only runs when you click the Sheet button or trigger it manually. $0/day until you turn the schedule on.
- **Model:** both stages use Claude Haiku (cheapest capable model). Set `JHA_DRAFT_MODEL=claude-sonnet-5` if you later want nicer drafts.

Rough cost with defaults: a normal run is ~$0.03 to $0.05, bounded by the caps; `--limit 5 --no-draft` is ~$0.01. Also set a monthly spend limit in the Anthropic console as a backstop. The `Runs` tab logs the real cost of every run.

## Setup

### 1. Google Sheet + service account (free)

1. Create a Google Cloud project and enable the **Google Sheets API**.
2. Create a **service account**, then create a **JSON key** for it and download it.
3. Create a Google Sheet. Copy its ID (the string in the URL between `/d/` and `/edit`).
4. Share the Sheet with the service account's `client_email` as **Editor**.

The tabs (`Remote - Tier 1`, `Remote - Tier 2`, `Freelance / Contract`, `Runs`, hidden `Seen`) are created automatically on first run.

### 2. Anthropic key (paid, small)

Get an API key from the Anthropic Console. Both stages use Claude Haiku by default (cheapest); override with `JHA_SCORE_MODEL` / `JHA_DRAFT_MODEL`. Set a monthly spend limit in the console for safety.

### 3. Local run

Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY`, `SHEET_ID`, and `GOOGLE_SERVICE_ACCOUNT_JSON` (the key JSON on one line, or base64-encoded). Then `node daily.js --yes` (a local run needs `--yes` to spend).

### 4. Automate on GitHub Actions (no machine needed)

1. Push this repo to GitHub and make it **public** (unlimited free Actions minutes and more reliable cron; secrets stay protected).
2. Settings -> Secrets and variables -> Actions -> add `ANTHROPIC_API_KEY`, `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Ensure `.github/workflows/daily.yml` is on the **default branch** (scheduled workflows only fire from there).
4. Trigger a manual run from the Actions tab to verify. The daily cron is **disabled by default** (so nothing spends while you validate); uncomment the `schedule:` lines in `daily.yml` when you want it to run on its own. Cron time is UTC.

### 5. Refresh button in the Sheet (optional)

1. In the Sheet: Extensions -> Apps Script. Paste `apps-script/Code.gs`, save.
2. Script Properties: set `GH_OWNER`, `GH_REPO`, `GH_REF` (default branch), and `GH_TOKEN` (a fine-grained PAT with **Actions: Read and write** on this repo only).
3. Reload the Sheet -> **Job Agent -> Refresh now** dispatches the workflow; new rows appear in ~1-2 minutes.

## Configure

- `config/companies.js` - the curated ATS boards (Greenhouse/Lever/Ashby tokens). **These seeds are unverified guesses; run `node scripts/phase0.js` and keep the ones that resolve.** This list is the main lever: add genuinely global-hiring / worldwide-remote companies.
- `config/profile.js` - your stack keywords, seniority, timezone, eligibility signals.
- `config/weights.js` - scoring and **cost knobs**: `maxScored` (jobs sent to the paid stage per run, default 15), `draftTopN` (max drafts per run, default 5), eligibility weighting, thresholds.

## Caveats

- GitHub free-tier scheduled cron can be delayed or skipped and auto-disables after 60 days of repo inactivity. A public repo helps; the refresh button always works; a free external cron (cron-job.org) hitting the `workflow_dispatch` API is a fallback if drift bothers you.
- Feeds change and break. Every source is isolated, so one failing just means fewer rows that day, never a crashed run.
- Do not run the live fetch inside a restricted network (e.g. a Claude cloud session with egress blocked); GitHub Actions and your own machine have open egress.

## Sources

- **ATS boards** (`config/companies.js`): Greenhouse, Lever, Ashby. The reliable, curated backbone.
- **Aggregator feeds** (`config/sources.js`, toggle each): RemoteOK, Remotive, Arbeitnow, Himalayas (location + timezone), We Work Remotely (RSS). Keyless, best-effort, isolated.
- **Hacker News "Who is Hiring"**: the latest monthly thread via the free Algolia API; each top comment becomes a pseudo-job the LLM structures.

Contract/freelance roles from any source route to the Freelance / Contract tab automatically (via employment-type classification), so that tab needs no separate scraper.

The fixture tests verify the parsing logic given each API's documented shape. The live shapes should be confirmed on the first real run (`node scripts/phase0.js` for ATS; a full `node daily.js --dry-run` for feeds) since these APIs can change; adjust the adapter if a field moved.

## Status

All planned phases built and tested (21 offline tests): Phase 0 (ATS fetchers + schema), Phase 1 (Google Sheets + dedupe + prefilter), Phase 3 (LLM scoring + tiers + drafts), Phase 2 (Actions), Phase 5 (refresh button), Phase 4 (aggregator feeds + HN + contract routing), plus cost guardrails (rank + cap, draft cap, spend gate, auto-run off by default).
