// Single source of truth for Google Sheet tabs, headers, and row mapping.
import { EmploymentType } from './lib/job.js';

export const TAB = {
  TIER1: 'Remote - Tier 1',
  TIER2: 'Remote - Tier 2',
  FREELANCE: 'Freelance / Contract',
  RUNS: 'Runs',
  SEEN: 'Seen',
};

export const JOB_HEADERS = [
  'First seen (UTC)', 'Score', 'Tier', 'Eligibility', 'Title', 'Company',
  'Employment', 'Remote', 'Location', 'Timezone fit', 'AI relevance',
  'Why it scored', 'Outreach DM', 'Cover letter / proposal', 'Source', 'Link', 'Posted',
];

export const RUNS_HEADERS = [
  'Timestamp (UTC)', 'Trigger', 'Boards OK', 'Boards failed', 'Fetched',
  'New (unseen)', 'Written', 'Tier 1', 'Tier 2', 'Freelance', 'LLM cost $', 'Notes',
];

export const SEEN_HEADERS = ['Job ID', 'First seen (UTC)', 'Title', 'Company', 'Source'];

export const TAB_SPECS = [
  { title: TAB.TIER1, header: JOB_HEADERS },
  { title: TAB.TIER2, header: JOB_HEADERS },
  { title: TAB.FREELANCE, header: JOB_HEADERS },
  { title: TAB.RUNS, header: RUNS_HEADERS },
  { title: TAB.SEEN, header: SEEN_HEADERS, hidden: true },
];

// Route a job to a tab. Contract -> Freelance. Otherwise split by eligibility
// once the LLM has scored it; unscored jobs (Phase 1) default to Tier 2.
export function tabForJob(job, scoring) {
  if (job.employmentType === EmploymentType.CONTRACT) return TAB.FREELANCE;
  if (scoring && typeof scoring.eligibilityConfidence === 'number') {
    return scoring.eligibilityConfidence >= 0.6 ? TAB.TIER1 : TAB.TIER2;
  }
  return TAB.TIER2;
}

function fmtNum(v, digits) {
  return typeof v === 'number' ? v.toFixed(digits) : '';
}

export function jobToRow(job, scoring, firstSeen) {
  const s = scoring || {};
  return [
    firstSeen || '',
    s.score ?? '',
    s.tier ?? '',
    fmtNum(s.eligibilityConfidence, 2),
    job.title,
    job.company,
    job.employmentType,
    job.remoteType,
    job.location,
    s.timezoneOverlap ?? '',
    fmtNum(s.aiRelevance, 0),
    s.rationale ?? '',
    s.dm ?? '',
    s.coverLetter ?? s.proposal ?? '',
    job.source,
    job.url,
    job.postedAt || '',
  ];
}

export function seenRow(job, firstSeen) {
  return [job.id, firstSeen || '', job.title, job.company, job.source];
}

export function runRow({ now, trigger, stats, freshCount, writtenCount, tierCounts, cost, notes }) {
  return [
    now,
    trigger,
    stats.ok,
    stats.failed,
    sumFetched(stats),
    freshCount,
    writtenCount,
    tierCounts[TAB.TIER1] || 0,
    tierCounts[TAB.TIER2] || 0,
    tierCounts[TAB.FREELANCE] || 0,
    cost != null ? cost.toFixed(4) : '',
    notes || '',
  ];
}

export function sumFetched(stats) {
  return Object.values(stats.perSource).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}
