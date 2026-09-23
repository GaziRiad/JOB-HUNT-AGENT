// Unified job schema and helpers shared across every source adapter.
// Keep this dependency-free so Phase 0 runs with plain `node`.
import crypto from 'node:crypto';

export const RemoteType = {
  REMOTE: 'remote',
  HYBRID: 'hybrid',
  ONSITE: 'onsite',
  UNKNOWN: 'unknown',
};

export const EmploymentType = {
  FULLTIME: 'full_time',
  CONTRACT: 'contract',
  UNKNOWN: 'unknown',
};

export function clean(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

// Stable per-posting id. Prefer the URL (unique per posting); fall back to
// company+title so a posting without a URL still dedupes across runs.
export function makeJobId({ source, company, title, url }) {
  const basis = url
    ? `${source}|${url}`
    : `${source}|${clean(company).toLowerCase()}|${clean(title).toLowerCase()}`;
  return crypto.createHash('sha1').update(basis).digest('hex').slice(0, 16);
}

// Cross-source key: same role posted on two boards collapses to one row.
export function dedupeKey({ company, title }) {
  return `${clean(company).toLowerCase()}::${clean(title).toLowerCase()}`;
}

export function normalizeJob(partial) {
  const base = {
    title: clean(partial.title),
    company: clean(partial.company),
    source: partial.source || 'unknown',
    url: clean(partial.url),
    location: clean(partial.location),
    remoteType: partial.remoteType || RemoteType.UNKNOWN,
    region: clean(partial.region),
    timezoneReq: clean(partial.timezoneReq),
    employmentType: partial.employmentType || EmploymentType.UNKNOWN,
    salary: clean(partial.salary),
    description: partial.description || '', // full text kept for the LLM stage
    postedAt: partial.postedAt || '',
  };
  return { id: partial.id || makeJobId(base), ...base };
}
