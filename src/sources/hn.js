// Hacker News "Who is Hiring" via the free Algolia API. Each top-level comment is
// a posting in free text; we turn it into a pseudo-job and let the LLM stage do
// the real structuring/eligibility read. Common format: "Company | Role | REMOTE | ...".
import { normalizeJob } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import { guessRemoteType, guessEmploymentType } from '../lib/heuristics.js';
import { fetchJson } from '../lib/fetchJson.js';

export function parseHNComment(child) {
  if (!child || !child.text) return null;
  const text = htmlToText(child.text);
  if (text.length < 20) return null; // skip empty/meta
  const firstLine = (text.split('\n')[0] || '').trim();
  const parts = firstLine.split('|').map((s) => s.trim()).filter(Boolean);
  const company = parts[0] || 'HN post';
  const title = parts[1] || firstLine.slice(0, 80);
  return normalizeJob({
    source: 'hn-whoishiring',
    company,
    title,
    url: `https://news.ycombinator.com/item?id=${child.id}`,
    location: /remote/i.test(text) ? 'Remote' : '',
    remoteType: guessRemoteType(text),
    employmentType: guessEmploymentType(text),
    description: text.slice(0, 4000),
    postedAt: child.created_at || '',
  });
}

export async function fetchHN() {
  const q = encodeURIComponent('Ask HN: Who is hiring?');
  const search = await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=5&query=${q}`);
  const story = (search.hits || []).find((h) => /who is hiring/i.test(h.title || ''));
  if (!story) return [];
  const item = await fetchJson(`https://hn.algolia.com/api/v1/items/${story.objectID}`);
  return (item.children || []).map(parseHNComment).filter(Boolean);
}
