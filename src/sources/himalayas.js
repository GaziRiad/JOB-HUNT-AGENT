// Himalayas public API: https://himalayas.app/jobs/api (keyless). Has location and
// timezone restrictions, which are directly relevant for a UTC+1 candidate.
// Field names vary; this maps defensively. Confirm shape on first live run.
import { normalizeJob, RemoteType } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import { normalizeEmployment } from '../lib/heuristics.js';
import { fetchJson } from '../lib/fetchJson.js';

function join(v) {
  if (Array.isArray(v)) return v.join(', ');
  return v || '';
}

export function parseHimalayas(data) {
  const jobs = Array.isArray(data?.jobs) ? data.jobs
    : Array.isArray(data?.data) ? data.data
    : [];
  return jobs.map((j) => {
    const loc = join(j.locationRestrictions) || j.location || '';
    const tz = join(j.timezoneRestrictions) || j.timezone || '';
    return normalizeJob({
      source: 'himalayas',
      company: j.companyName || j.company || '',
      title: j.title,
      url: j.applicationLink || j.url || j.guid || '',
      location: loc || 'Remote',
      region: loc,
      timezoneReq: tz,
      remoteType: RemoteType.REMOTE,
      employmentType: normalizeEmployment(join(j.employmentType)),
      description: htmlToText(j.description || j.excerpt || ''),
      postedAt: j.pubDate || j.publishedDate || (j.pubDateTimestamp ? new Date(j.pubDateTimestamp * 1000).toISOString() : ''),
    });
  });
}

export async function fetchHimalayas({ limit = 100 } = {}) {
  return parseHimalayas(await fetchJson(`https://himalayas.app/jobs/api?limit=${limit}`));
}
