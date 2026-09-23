// Within-run dedupe: the same role posted on several boards collapses to one.
// Cross-run dedupe (against jobs seen on previous days) is handled in Phase 1
// by the "Seen" tab in the Google Sheet.
import { dedupeKey } from './lib/job.js';

export function dedupeJobs(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    const key = dedupeKey(job);
    if (!seen.has(key)) seen.set(key, job);
  }
  return [...seen.values()];
}
