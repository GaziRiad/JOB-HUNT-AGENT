// Stage 2: draft outreach for a job that cleared the score threshold.
import { z } from 'zod';

export const DRAFT_TOOL = {
  name: 'record_outreach',
  description: 'Record a short outreach DM and a tailored cover letter or proposal.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      dm: { type: 'string', description: 'A short first-contact message (<= 70 words).' },
      letter: { type: 'string', description: 'A tailored cover letter (jobs) or short proposal (contract), ~120-160 words.' },
    },
    required: ['dm', 'letter'],
  },
};

const Schema = z.object({
  dm: z.string().catch(''),
  letter: z.string().catch(''),
});

export function buildDraftSystem(profile) {
  return [
    `You write outreach for ${profile.name}, a ${profile.seniority.join('/')} software engineer (${profile.yearsExperience}y) in ${profile.basedIn} (${profile.timezone}).`,
    'Stack: JavaScript, TypeScript, React, Next.js, Node, plus AI integration / LLM / automation.',
    '',
    'Write in first person, plain and specific. Reference the actual role and company and one concrete reason of fit.',
    'Mention remote / EU-timezone overlap naturally when relevant. Keep it human.',
    'Do NOT use cliches or filler ("passionate", "fast-paced", "I am excited to", "game-changer", "leverage", "seamless"). No em dashes.',
    'The DM is a short first-contact note. The letter is a tailored cover letter, or a short proposal for a contract role.',
  ].join('\n');
}

export function buildDraftUser(job, scoring) {
  const isContract = job.employmentType === 'contract';
  return [
    `ROLE: ${job.title} at ${job.company} (${job.remoteType}, ${job.location || 'location n/a'})`,
    `TYPE: ${isContract ? 'contract / project (write the letter as a short proposal)' : 'full-time (write the letter as a cover letter)'}`,
    `WHY IT FITS: ${scoring.rationale || 'strong stack overlap'}`,
    '',
    'DESCRIPTION (excerpt):',
    String(job.description || '').slice(0, 1200) || '(none)',
  ].join('\n');
}

export function parseDraft(raw) {
  return Schema.parse(raw ?? {});
}
