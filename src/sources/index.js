// Source registry. Phase 0/1: ATS boards only. Phase 4 adds the aggregator
// feeds (RemoteOK, WWR, Himalayas, Arbeitnow, Remotive) and HN here, each as
// another isolated task so one failing source never fails the run.
import { companies } from '../../config/companies.js';
import { fetchGreenhouse } from './ats-greenhouse.js';
import { fetchLever } from './ats-lever.js';
import { fetchAshby } from './ats-ashby.js';
import { mapLimit } from '../lib/async.js';

export function atsTasks() {
  const tasks = [];
  for (const c of companies.greenhouse || []) tasks.push({ label: `greenhouse:${c.token}`, run: () => fetchGreenhouse(c) });
  for (const c of companies.lever || []) tasks.push({ label: `lever:${c.slug}`, run: () => fetchLever(c) });
  for (const c of companies.ashby || []) tasks.push({ label: `ashby:${c.slug}`, run: () => fetchAshby(c) });
  return tasks;
}

// Runs every source with limited concurrency and isolates failures.
export async function collectJobs({ concurrency = 6, tasks = atsTasks() } = {}) {
  const results = await mapLimit(tasks, concurrency, async (task) => {
    try {
      return { label: task.label, jobs: await task.run() };
    } catch (err) {
      return { label: task.label, error: err.status ? `HTTP ${err.status}` : err.message };
    }
  });

  const jobs = [];
  const stats = { ok: 0, failed: 0, perSource: {} };
  for (const r of results) {
    if (r.error) {
      stats.failed += 1;
      stats.perSource[r.label] = r.error;
    } else {
      stats.ok += 1;
      stats.perSource[r.label] = r.jobs.length;
      jobs.push(...r.jobs);
    }
  }
  return { jobs, stats };
}
