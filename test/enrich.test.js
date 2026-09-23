import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAssessment } from '../src/score.js';
import { scoreAndDraft } from '../src/enrich.js';
import { makeFakeClient } from '../src/fakeClient.js';
import { weights } from '../config/weights.js';
import { profile } from '../config/profile.js';
import { normalizeJob, EmploymentType } from '../src/lib/job.js';

test('parseAssessment weights final score by eligibility and clamps', () => {
  const hi = parseAssessment({ score: 100, eligibilityConfidence: 1, stackFit: 100, seniorityFit: 100, aiRelevance: 100, rationale: 'x', employmentType: 'full_time' }, weights);
  assert.equal(hi.score, 100);
  const lo = parseAssessment({ score: 100, eligibilityConfidence: 0, stackFit: 100, seniorityFit: 100, aiRelevance: 100, rationale: 'x', employmentType: 'full_time' }, weights);
  assert.equal(lo.score, 40);
  const clamped = parseAssessment({ score: 150, eligibilityConfidence: 5, stackFit: -3, aiRelevance: 0, seniorityFit: 0, rationale: '', employmentType: 'weird' }, weights);
  assert.equal(clamped.eligibilityConfidence, 1);
  assert.equal(clamped.baseScore, 100);
  assert.equal(clamped.employmentType, 'unknown');
});

test('scoreAndDraft scores all, drafts Tier 1, routes contract, accrues cost', async () => {
  const client = makeFakeClient();
  const jobs = [
    normalizeJob({ source: 'x', company: 'A', title: 'Senior React Engineer', url: 'https://x/1', location: 'Remote - Worldwide', remoteType: 'remote', employmentType: 'full_time', description: 'React, Node, worldwide. Build AI/LLM features.' }),
    normalizeJob({ source: 'x', company: 'B', title: 'Contract Developer', url: 'https://x/2', location: 'Remote', remoteType: 'remote', employmentType: 'unknown', description: 'Contract role building a dashboard in React.' }),
  ];
  const { enriched, cost } = await scoreAndDraft(client, jobs, { profile, weights, concurrency: 2 });

  assert.equal(enriched.length, 2);
  assert.ok(cost > 0, 'cost should accrue');

  const byTitle = Object.fromEntries(enriched.map((e) => [e.job.title, e]));

  const a = byTitle['Senior React Engineer'];
  assert.equal(a.job.employmentType, EmploymentType.FULLTIME);
  assert.equal(a.scoring.score, 63); // 72 * (0.4 + 0.6*0.8) = 63.36 -> 63
  assert.ok(a.scoring.dm, 'Tier 1 job should be drafted');
  assert.ok(a.scoring.coverLetter, 'full-time job gets a cover letter');
  assert.ok(!a.scoring.proposal);

  const b = byTitle['Contract Developer'];
  assert.equal(b.job.employmentType, EmploymentType.CONTRACT);
  assert.equal(b.scoring.score, 48); // 72 * (0.4 + 0.6*0.45) = 48.24 -> 48, below draft threshold
  assert.ok(!b.scoring.dm, 'below-threshold contract row is not drafted');
});
