// Arbeitnow public API: https://www.arbeitnow.com/api/job-board-api (keyless; EU-heavy).
// Shape: { data: [ { title, company_name, description, remote, url, tags, job_types,
// location, created_at } ], links, meta }.
import { normalizeJob, RemoteType, EmploymentType } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import { normalizeEmployment, guessEmploymentType, guessRemoteType } from '../lib/heuristics.js';
import { fetchJson } from '../lib/fetchJson.js';

export function parseArbeitnow(data) {
  const list = Array.isArray(data?.data) ? data.data : [];
  return list.map((j) => {
    const jobTypes = Array.isArray(j.job_types) ? j.job_types.join(' ') : '';
    const tags = Array.isArray(j.tags) ? j.tags.join(' ') : '';
    const empFromTypes = normalizeEmployment(jobTypes);
    return normalizeJob({
      source: 'arbeitnow',
      company: j.company_name,
      title: j.title,
      url: j.url,
      location: j.location || (j.remote ? 'Remote' : ''),
      remoteType: j.remote ? RemoteType.REMOTE : guessRemoteType(j.location, j.title),
      employmentType: empFromTypes !== EmploymentType.UNKNOWN ? empFromTypes : guessEmploymentType(j.title, tags),
      description: htmlToText(j.description || ''),
      postedAt: j.created_at ? new Date(typeof j.created_at === 'number' ? j.created_at * 1000 : j.created_at).toISOString() : '',
    });
  });
}

export async function fetchArbeitnow() {
  return parseArbeitnow(await fetchJson('https://www.arbeitnow.com/api/job-board-api'));
}
