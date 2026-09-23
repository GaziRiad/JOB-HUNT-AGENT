// We Work Remotely RSS. The programming feed is the default; the "100% worldwide
// remote" section is the most Algeria-relevant. Titles are "Company: Position".
import Parser from 'rss-parser';
import { normalizeJob, RemoteType } from '../lib/job.js';
import { htmlToText } from '../lib/html.js';
import { guessEmploymentType } from '../lib/heuristics.js';
import { fetchText } from '../lib/fetchJson.js';

const parser = new Parser();

export function parseWWR(feed) {
  const items = feed?.items || [];
  return items.map((it) => {
    let company = '';
    let title = it.title || '';
    const idx = title.indexOf(':');
    if (idx > 0) {
      company = title.slice(0, idx).trim();
      title = title.slice(idx + 1).trim();
    }
    const description = htmlToText(it['content:encoded'] || it.content || it.contentSnippet || '');
    return normalizeJob({
      source: 'wwr',
      company,
      title,
      url: it.link || '',
      location: it.region || 'Remote',
      region: it.region || '',
      remoteType: RemoteType.REMOTE,
      employmentType: guessEmploymentType(title, description),
      description,
      postedAt: it.isoDate || it.pubDate || '',
    });
  });
}

export async function fetchWWR({ feedUrl = 'https://weworkremotely.com/categories/remote-programming-jobs.rss' } = {}) {
  const xml = await fetchText(feedUrl);
  return parseWWR(await parser.parseString(xml));
}
