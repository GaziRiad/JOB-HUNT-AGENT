// Ashby public job-board API (no auth).
// GET https://api.ashbyhq.com/posting-api/job-board/{slug}
import { normalizeJob, RemoteType } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import { guessRemoteType, normalizeEmployment } from '../lib/heuristics.js';
import { fetchJson } from '../lib/fetchJson.js';

export function parseAshby(data, { name, slug }) {
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  const org = data?.organizationName || name || slug;
  return jobs.map((j) => {
    let remoteType;
    if (j?.isRemote === true) {
      remoteType = RemoteType.REMOTE;
    } else {
      remoteType = guessRemoteType(j?.location, j?.title);
      if (remoteType === RemoteType.UNKNOWN && j?.isRemote === false) remoteType = RemoteType.ONSITE;
    }
    return normalizeJob({
      source: `ashby:${slug}`,
      company: org,
      title: j?.title,
      url: j?.jobUrl || j?.applyUrl,
      location: j?.location || '',
      remoteType,
      employmentType: normalizeEmployment(j?.employmentType),
      description: j?.descriptionPlain || htmlToText(j?.descriptionHtml || ''),
      postedAt: j?.publishedAt || '',
    });
  });
}

export async function fetchAshby({ slug, name }) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
  return parseAshby(await fetchJson(url), { name, slug });
}
