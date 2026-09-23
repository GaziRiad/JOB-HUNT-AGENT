// Greenhouse public job-board API (no auth).
// GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
import { normalizeJob } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import { guessRemoteType, guessEmploymentType } from '../lib/heuristics.js';
import { fetchJson } from '../lib/fetchJson.js';

export function parseGreenhouse(data, { name, token }) {
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.map((j) => {
    const location = j?.location?.name || '';
    const description = htmlToText(j?.content || '');
    return normalizeJob({
      source: `greenhouse:${token}`,
      company: name || token,
      title: j?.title,
      url: j?.absolute_url,
      location,
      remoteType: guessRemoteType(location, j?.title, description),
      employmentType: guessEmploymentType(location, j?.title, description),
      description,
      postedAt: j?.updated_at || '',
    });
  });
}

export async function fetchGreenhouse({ token, name }) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
  return parseGreenhouse(await fetchJson(url), { name, token });
}
