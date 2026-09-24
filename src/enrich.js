// Orchestrates the LLM stages over the (already ranked + capped) jobs.
// Stage 1 (score) runs on every job passed in; stage 2 (draft) runs only on the
// top `draftLimit` by score that clear the threshold, to bound cost.
import pLimit from 'p-limit';
import { MODELS, callStructured, estimateCost } from './anthropic.js';
import { SCORE_TOOL, buildSystem, buildUser, parseAssessment } from './score.js';
import { DRAFT_TOOL, buildDraftSystem, buildDraftUser, parseDraft } from './draft.js';
import { EmploymentType } from './lib/job.js';

export async function scoreAndDraft(client, jobs, { profile, weights, concurrency = 4, draftLimit } = {}) {
  const limit = pLimit(concurrency);
  const cap = draftLimit == null ? weights.draftTopN : draftLimit;
  let cost = 0;

  // Stage 1: score everything passed in.
  const scored = await Promise.all(
    jobs.map((job) => limit(async () => {
      const s1 = await callStructured(client, {
        model: MODELS.score,
        system: buildSystem(profile),
        user: buildUser(job),
        tool: SCORE_TOOL,
        maxTokens: 700,
      });
      cost += estimateCost(MODELS.score, s1.usage);
      const scoring = parseAssessment(s1.input, weights);
      if (scoring.employmentType && scoring.employmentType !== EmploymentType.UNKNOWN) {
        job.employmentType = scoring.employmentType;
      }
      return { job, scoring };
    })),
  );

  // Stage 2: draft only the top `cap` by score that clear the threshold.
  const draftSet = scored
    .filter((e) => e.scoring.score >= weights.draftScoreThreshold)
    .sort((a, b) => b.scoring.score - a.scoring.score)
    .slice(0, Math.max(0, cap));

  await Promise.all(
    draftSet.map((e) => limit(async () => {
      const s2 = await callStructured(client, {
        model: MODELS.draft,
        system: buildDraftSystem(profile),
        user: buildDraftUser(e.job, e.scoring),
        tool: DRAFT_TOOL,
        maxTokens: 900,
      });
      cost += estimateCost(MODELS.draft, s2.usage);
      const draft = parseDraft(s2.input);
      e.scoring.dm = draft.dm;
      if (e.job.employmentType === EmploymentType.CONTRACT) e.scoring.proposal = draft.letter;
      else e.scoring.coverLetter = draft.letter;
    })),
  );

  return { enriched: scored, cost };
}
