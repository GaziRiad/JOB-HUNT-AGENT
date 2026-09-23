// Cheap, deterministic guesses used by adapters and the pre-filter.
// These are best-effort only; the LLM stage makes the real eligibility call.
import { RemoteType, EmploymentType } from './job.js';

const HYBRID_RE = /\bhybrid\b/i;
const REMOTE_RE = /\b(remote|work from home|wfh|distributed|work from anywhere|anywhere)\b/i;
const ONSITE_RE = /\b(on-?site|in-office|in[- ]person)\b/i;

export function guessRemoteType(...texts) {
  const t = texts.filter(Boolean).join(' ');
  if (HYBRID_RE.test(t)) return RemoteType.HYBRID;
  if (REMOTE_RE.test(t)) return RemoteType.REMOTE;
  if (ONSITE_RE.test(t)) return RemoteType.ONSITE;
  return RemoteType.UNKNOWN;
}

const CONTRACT_RE = /\b(contract|contractor|freelance|freelancer|temporary|consult(?:ing|ant)|project[- ]based|b2b|part[- ]?time)\b/i;
const FULLTIME_RE = /\b(full[- ]?time|permanent|\bfte\b)\b/i;

export function guessEmploymentType(...texts) {
  const t = texts.filter(Boolean).join(' ');
  if (CONTRACT_RE.test(t)) return EmploymentType.CONTRACT;
  if (FULLTIME_RE.test(t)) return EmploymentType.FULLTIME;
  return EmploymentType.UNKNOWN;
}

// Normalize the varied employment strings ATS platforms return.
export function normalizeEmployment(raw = '') {
  const t = String(raw).toLowerCase();
  if (/contract|freelance|temporary|intern|part/.test(t)) return EmploymentType.CONTRACT;
  if (/full/.test(t)) return EmploymentType.FULLTIME;
  return EmploymentType.UNKNOWN;
}

export function normalizeWorkplace(raw = '') {
  const t = String(raw).toLowerCase();
  if (/hybrid/.test(t)) return RemoteType.HYBRID;
  if (/remote|anywhere/.test(t)) return RemoteType.REMOTE;
  if (/on.?site|office/.test(t)) return RemoteType.ONSITE;
  return RemoteType.UNKNOWN;
}
