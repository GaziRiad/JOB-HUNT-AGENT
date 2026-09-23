// Stage 1: classify + score one job. Pure prompt/schema/parse here; the API
// call lives in enrich.js so this stays unit-testable without a client.
import { z } from 'zod';

export const SCORE_TOOL = {
  name: 'record_assessment',
  description: 'Record the structured fit assessment for one job.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      employmentType: { type: 'string', enum: ['full_time', 'contract', 'unknown'] },
      eligibilityConfidence: {
        type: 'number',
        description: '0..1 confidence this employer would actually hire someone based in Algeria (UTC+1).',
      },
      stackFit: { type: 'number', description: '0..100 match to JS/TS/React/Next/Node.' },
      seniorityFit: { type: 'number', description: '0..100 match to a mid/senior engineer with ~4y experience.' },
      aiRelevance: { type: 'number', description: '0..100 how much this is AI-integration / LLM / automation work.' },
      timezoneOverlap: { type: 'string', description: 'Short note on overlap with UTC+1 / EU hours.' },
      score: { type: 'number', description: '0..100 overall fit BEFORE eligibility weighting.' },
      rationale: { type: 'string', description: '2-3 sentences: fit, risks, and the eligibility read.' },
    },
    required: ['employmentType', 'eligibilityConfidence', 'stackFit', 'seniorityFit', 'aiRelevance', 'score', 'rationale'],
  },
};

const Schema = z.object({
  employmentType: z.enum(['full_time', 'contract', 'unknown']).catch('unknown'),
  eligibilityConfidence: z.coerce.number().catch(0),
  stackFit: z.coerce.number().catch(0),
  seniorityFit: z.coerce.number().catch(0),
  aiRelevance: z.coerce.number().catch(0),
  timezoneOverlap: z.string().catch(''),
  score: z.coerce.number().catch(0),
  rationale: z.string().catch(''),
});

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

export function buildSystem(profile) {
  return [
    'You assess remote software jobs for one specific candidate and return a structured fit assessment.',
    '',
    `CANDIDATE: ${profile.name}, based in ${profile.basedIn} (${profile.timezone}), ~${profile.yearsExperience}y experience, ${profile.seniority.join('/')} level.`,
    'Core stack: JavaScript, TypeScript, React, Next.js, Node. Wedge: AI integration / LLM / automation (highest value in 2026).',
    '',
    'ELIGIBILITY IS THE MOST IMPORTANT FACTOR. The candidate lives in Algeria (Africa, UTC+1):',
    '- HIGH (>=0.6): "worldwide" / "work from anywhere" / "global", hires via EOR or as a contractor/B2B, or EMEA/Europe-friendly with no work-authorization requirement.',
    '- LOW (<0.4): requires US/UK/EU/Canada work authorization or physical presence, "US only", "must be based in ...", or a country allowlist that excludes Algeria/Africa.',
    '- If genuinely unclear, use ~0.4-0.5 and explain the uncertainty in the rationale.',
    '',
    'Be calibrated and honest; most jobs are mediocre fits. Do not inflate scores.',
  ].join('\n');
}

export function buildUser(job) {
  const desc = String(job.description || '').slice(0, 1800);
  return [
    `TITLE: ${job.title}`,
    `COMPANY: ${job.company}`,
    `LOCATION: ${job.location || 'n/a'}   REMOTE: ${job.remoteType}   EMPLOYMENT(guess): ${job.employmentType}`,
    `SOURCE: ${job.source}`,
    '',
    'DESCRIPTION:',
    desc || '(no description provided)',
  ].join('\n');
}

// Convert the raw tool input into a normalized scoring object with a final,
// eligibility-weighted rank score.
export function parseAssessment(raw, weights) {
  const a = Schema.parse(raw ?? {});
  const eligibilityConfidence = clamp(a.eligibilityConfidence, 0, 1);
  const baseScore = clamp(a.score, 0, 100);
  const score = Math.round(baseScore * (weights.eligibilityFloor + (1 - weights.eligibilityFloor) * eligibilityConfidence));
  return {
    employmentType: a.employmentType,
    eligibilityConfidence,
    stackFit: clamp(a.stackFit, 0, 100),
    seniorityFit: clamp(a.seniorityFit, 0, 100),
    aiRelevance: clamp(a.aiRelevance, 0, 100),
    timezoneOverlap: a.timezoneOverlap,
    baseScore,
    score,
    rationale: a.rationale,
  };
}
