import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOB_HEADERS, TAB, jobToRow, tabForJob } from '../src/rows.js';
import { normalizeJob, EmploymentType, RemoteType } from '../src/lib/job.js';

test('jobToRow length matches header count and column order', () => {
  const job = normalizeJob({
    source: 'greenhouse:gitlab', company: 'GitLab', title: 'Senior Backend Engineer',
    url: 'https://x/1', location: 'Remote, EMEA', remoteType: RemoteType.REMOTE,
    employmentType: EmploymentType.FULLTIME, postedAt: '2026-09-20',
  });
  const row = jobToRow(job, null, '2026-09-23T00:00:00.000Z');
  assert.equal(row.length, JOB_HEADERS.length);
  assert.equal(row[JOB_HEADERS.indexOf('Title')], 'Senior Backend Engineer');
  assert.equal(row[JOB_HEADERS.indexOf('Company')], 'GitLab');
  assert.equal(row[JOB_HEADERS.indexOf('Link')], 'https://x/1');
  assert.equal(row[JOB_HEADERS.indexOf('First seen (UTC)')], '2026-09-23T00:00:00.000Z');
});

test('tabForJob routes contract to Freelance', () => {
  const job = normalizeJob({ source: 'x', company: 'A', title: 'Contract Dev', url: 'https://x/2', employmentType: EmploymentType.CONTRACT });
  assert.equal(tabForJob(job, null), TAB.FREELANCE);
});

test('tabForJob routes unscored full-time to Tier 2, high-eligibility to Tier 1', () => {
  const job = normalizeJob({ source: 'x', company: 'A', title: 'Engineer', url: 'https://x/3', employmentType: EmploymentType.FULLTIME });
  assert.equal(tabForJob(job, null), TAB.TIER2);
  assert.equal(tabForJob(job, { eligibilityConfidence: 0.8 }), TAB.TIER1);
  assert.equal(tabForJob(job, { eligibilityConfidence: 0.3 }), TAB.TIER2);
});
