// Cheap, deterministic hard gates that run BEFORE any LLM spend.
// Deliberately conservative: only drop the obvious no's. Nuanced eligibility
// (US-remote hidden in the body, EOR language, timezone fit) is the LLM's job.
import { RemoteType, EmploymentType } from './lib/job.js';

const WORLDWIDE = /\b(worldwide|work from anywhere|anywhere in the world|fully global|global remote)\b/i;

// Blatant work-authorization / location locks that exclude an Algeria resident.
const REGION_LOCK = [
  /\bu\.?s\.?[ -]?(only|based only|residents only)\b/i,
  /\b(united states|usa) only\b/i,
  /\b(uk|eu|canada|australia|emea) only\b/i,
  /\bmust (be )?(based|located|reside)[^.]{0,40}\b(united states|u\.?s\.?a?|uk|united kingdom|canada|australia|europe|eu)\b/i,
  /\bauthoriz(ed|ation) to work in (the )?(united states|u\.?s\.?a?|uk|canada|eu|europe)\b/i,
  /\b(us|uk|eu|canadian) work authoriz/i,
  /\bwork(ing)? (rights?|permit) (in|for) (the )?(us|uk|eu|canada|australia|united states|united kingdom)\b/i,
];

const _stackRe = new WeakMap();
function stackRegex(profile) {
  if (_stackRe.has(profile)) return _stackRe.get(profile);
  const escaped = profile.stackKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
  _stackRe.set(profile, re);
  return re;
}

function matchesStack(text, profile) {
  return stackRegex(profile).test(text);
}

function hasExcludedRegionLock(text) {
  if (WORLDWIDE.test(text)) return false;
  return REGION_LOCK.some((re) => re.test(text));
}

export function prefilter(job, profile) {
  const reasons = [];
  const text = `${job.title} ${job.location} ${job.region} ${job.description}`.toLowerCase();
  const looksRemote = /\b(remote|anywhere|worldwide|distributed)\b/.test(text);

  // 1. Must be remote, or a contract (contract is location-flexible by default).
  if (job.remoteType === RemoteType.ONSITE && !looksRemote) {
    reasons.push('onsite');
  } else if (
    job.remoteType !== RemoteType.REMOTE &&
    job.employmentType !== EmploymentType.CONTRACT &&
    !looksRemote
  ) {
    reasons.push('not-remote');
  }

  // 2. Explicit region/work-authorization lock we can't satisfy.
  if (hasExcludedRegionLock(text)) reasons.push('region-locked');

  // 3. At least one stack keyword.
  if (!matchesStack(text, profile)) reasons.push('no-stack-match');

  return { pass: reasons.length === 0, reasons };
}
