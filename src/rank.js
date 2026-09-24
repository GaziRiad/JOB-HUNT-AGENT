// Free, code-only pre-ranking so the paid LLM stage only ever sees the most
// promising candidates (and never the hundreds of low-signal rows a broad fetch
// can produce). This is the main cost guardrail alongside the maxScored cap.
import { RemoteType } from './lib/job.js';

const AI_RE = /\b(ai|llm|rag|automation|openai|anthropic|agent|genai|ml)\b/i;
const WORLDWIDE_RE = /\b(worldwide|work from anywhere|anywhere in the world|global|emea|europe)\b/i;
const EOR_RE = /\beor\b|employer of record|contractor|b2b/i;
const SENIORITY_RE = /\b(senior|lead|staff|mid|engineer|developer)\b/i;

// Higher = more worth paying to score. Cheap heuristic, not a real assessment.
export function cheapScore(job, profile) {
  const text = `${job.title} ${job.location} ${job.region} ${job.description}`.toLowerCase();
  let s = 0;
  for (const k of profile.stackKeywords) if (text.includes(k)) s += 1;
  if (AI_RE.test(text)) s += 3; // the AI-integration wedge
  if (WORLDWIDE_RE.test(text)) s += 4; // eligibility signal matters most
  if (EOR_RE.test(text)) s += 2;
  if (SENIORITY_RE.test(job.title || '')) s += 1;
  if (job.remoteType === RemoteType.REMOTE) s += 1;
  return s;
}

// Sort by cheap score, keep the top `cap`.
export function rankAndCap(jobs, profile, cap) {
  return [...jobs]
    .map((job) => ({ job, s: cheapScore(job, profile) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(0, cap))
    .map((x) => x.job);
}
