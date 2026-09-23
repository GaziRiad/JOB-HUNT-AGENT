// Remotive public API: https://remotive.com/api/remote-jobs (keyless; 24h delayed;
// attribution required). Shape: { jobs: [ { title, company_name, job_type,
// candidate_required_location, url, description, publication_date, salary } ] }.
import { normalizeJob, RemoteType } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import { normalizeEmployment } from '../lib/heuristics.js';
import { fetchJson } from '../lib/fetchJson.js';

export function parseRemotive(data) {
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.map((j) => normalizeJob({
    source: 'remotive',
    company: j.company_name,
    title: j.title,
    url: j.url,
    location: j.candidate_required_location || 'Remote',
    region: j.candidate_required_location || '',
    remoteType: RemoteType.REMOTE,
    employmentType: normalizeEmployment(j.job_type),
    salary: j.salary || '',
    description: htmlToText(j.description || ''),
    postedAt: j.publication_date || '',
  }));
}

export async function fetchRemotive({ limit = 100 } = {}) {
  return parseRemotive(await fetchJson(`https://remotive.com/api/remote-jobs?limit=${limit}`));
}
