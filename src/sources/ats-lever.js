// Lever public postings API (no auth).
// GET https://api.lever.co/v0/postings/{slug}?mode=json
import { normalizeJob, RemoteType } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import {
  guessRemoteType,
  normalizeWorkplace,
  normalizeEmployment,
} from '../lib/heuristics.js';
import { fetchJson } from '../lib/fetchJson.js';

export function parseLever(data, { name, slug }) {
  const list = Array.isArray(data) ? data : [];
  return list.map((p) => {
    const cat = p?.categories || {};
    let remoteType = normalizeWorkplace(p?.workplaceType);
    if (remoteType === RemoteType.UNKNOWN) remoteType = guessRemoteType(cat.location, p?.text);
    return normalizeJob({
      source: `lever:${slug}`,
      company: name || slug,
      title: p?.text,
      url: p?.hostedUrl || p?.applyUrl,
      location: cat.location || '',
      remoteType,
      employmentType: normalizeEmployment(cat.commitment),
      description: p?.descriptionPlain || htmlToText(p?.description || ''),
      postedAt: p?.createdAt ? new Date(p.createdAt).toISOString() : '',
    });
  });
}

export async function fetchLever({ slug, name }) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  return parseLever(await fetchJson(url), { name, slug });
}
