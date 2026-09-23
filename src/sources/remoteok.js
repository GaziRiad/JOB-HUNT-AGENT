// RemoteOK public API: https://remoteok.com/api  (keyless; attribution required).
// The first array element is a legal/notice object, not a job.
import { normalizeJob, RemoteType, EmploymentType } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import { normalizeEmployment, guessEmploymentType } from '../lib/heuristics.js';
import { fetchJson } from '../lib/fetchJson.js';

export function parseRemoteOK(data) {
  const arr = Array.isArray(data) ? data : [];
  return arr
    .filter((j) => j && j.position && j.id)
    .map((j) => {
      const tags = Array.isArray(j.tags) ? j.tags.join(' ') : '';
      const description = htmlToText(j.description || '');
      const empFromTags = normalizeEmployment(tags);
      return normalizeJob({
        source: 'remoteok',
        company: j.company,
        title: j.position,
        url: j.url || (j.slug ? `https://remoteok.com/remote-jobs/${j.slug}` : ''),
        location: j.location || 'Remote',
        remoteType: RemoteType.REMOTE,
        employmentType: empFromTags !== EmploymentType.UNKNOWN ? empFromTags : guessEmploymentType(j.position, tags, description),
        salary: j.salary_min && j.salary_max ? `${j.salary_min}-${j.salary_max}` : '',
        description,
        postedAt: j.date || '',
      });
    });
}

export async function fetchRemoteOK() {
  return parseRemoteOK(await fetchJson('https://remoteok.com/api'));
}
