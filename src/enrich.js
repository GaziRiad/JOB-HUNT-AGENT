// Orchestrates the LLM stages over the surviving jobs with limited concurrency.
// Stage 1 (score) runs on every survivor; stage 2 (draft) only when warranted.
import pLimit from 'p-limit';
import { MODELS, callStructured, estimateCost } from './anthropic.js';
import { SCORE_TOOL, buildSystem, buildUser, parseAssessment } from './score.js';
import { DRAFT_TOOL, buildDraftSystem, buildDraftUser, parseDraft } from './draft.js';
import { EmploymentType } from './lib/job.js';
import { TAB, tabForJob } from './rows.js';

export async function scoreAndDraft(client, jobs, { profile, weights, concurrency = 4 } = {}) {
  const limit = pLimit(concurrency);
  let cost = 0;

  const enriched = await Promise.all(
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

      // Trust the LLM's employment classification for routing when it's sure.
      if (scoring.employmentType && scoring.employmentType !== EmploymentType.UNKNOWN) {
        job.employmentType = scoring.employmentType;
      }

      const tab = tabForJob(job, scoring);
      const wantDraft = tab === TAB.TIER1 || scoring.score >= weights.draftScoreThreshold;
      if (wantDraft) {
        const s2 = await callStructured(client, {
          model: MODELS.draft,
          system: buildDraftSystem(profile),
          user: buildDraftUser(job, scoring),
          tool: DRAFT_TOOL,
          maxTokens: 900,
        });
        cost += estimateCost(MODELS.draft, s2.usage);
        const draft = parseDraft(s2.input);
        scoring.dm = draft.dm;
        if (job.employmentType === EmploymentType.CONTRACT) scoring.proposal = draft.letter;
        else scoring.coverLetter = draft.letter;
      }

      return { job, scoring };
    })),
  );

  return { enriched, cost };
}
