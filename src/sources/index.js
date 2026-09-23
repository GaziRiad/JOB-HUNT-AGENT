// Source registry. ATS boards + aggregator feeds + HN, each an isolated task so
// one failing source never fails the run.
import { companies } from '../../config/companies.js';
import { sources } from '../../config/sources.js';
import { fetchGreenhouse } from './ats-greenhouse.js';
import { fetchLever } from './ats-lever.js';
import { fetchAshby } from './ats-ashby.js';
import { fetchRemoteOK } from './remoteok.js';
import { fetchRemotive } from './remotive.js';
import { fetchArbeitnow } from './arbeitnow.js';
import { fetchHimalayas } from './himalayas.js';
import { fetchWWR } from './wwr.js';
import { fetchHN } from './hn.js';
import { mapLimit } from '../lib/async.js';

export function atsTasks() {
  const tasks = [];
  for (const c of companies.greenhouse || []) tasks.push({ label: `greenhouse:${c.token}`, run: () => fetchGreenhouse(c) });
  for (const c of companies.lever || []) tasks.push({ label: `lever:${c.slug}`, run: () => fetchLever(c) });
  for (const c of companies.ashby || []) tasks.push({ label: `ashby:${c.slug}`, run: () => fetchAshby(c) });
  return tasks;
}

export function feedTasks() {
  const tasks = [];
  if (sources.remoteok) tasks.push({ label: 'remoteok', run: () => fetchRemoteOK() });
  if (sources.remotive) tasks.push({ label: 'remotive', run: () => fetchRemotive() });
  if (sources.arbeitnow) tasks.push({ label: 'arbeitnow', run: () => fetchArbeitnow() });
  if (sources.himalayas) tasks.push({ label: 'himalayas', run: () => fetchHimalayas() });
  if (sources.wwr) tasks.push({ label: 'wwr', run: () => fetchWWR() });
  if (sources.hn) tasks.push({ label: 'hn', run: () => fetchHN() });
  return tasks;
}

export function allTasks() {
  return atsTasks().concat(feedTasks());
}

// Runs every source with limited concurrency and isolates failures.
export async function collectJobs({ concurrency = 6, tasks = allTasks() } = {}) {
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
