import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseGreenhouse } from '../src/sources/ats-greenhouse.js';
import { parseLever } from '../src/sources/ats-lever.js';
import { parseAshby } from '../src/sources/ats-ashby.js';
import { htmlToText } from '../src/lib/html.js';
import { guessEmploymentType } from '../src/lib/heuristics.js';
import { prefilter } from '../src/prefilter.js';
import { profile } from '../config/profile.js';
import { normalizeJob, RemoteType, EmploymentType } from '../src/lib/job.js';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name) => JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));

test('greenhouse: maps fields and cleans HTML content', () => {
  const jobs = parseGreenhouse(fx('greenhouse.json'), { name: 'GitLab', token: 'gitlab' });
  assert.equal(jobs.length, 2);
  const [first] = jobs;
  assert.equal(first.title, 'Senior Backend Engineer');
  assert.equal(first.company, 'GitLab');
  assert.match(first.url, /^https:\/\/boards\.greenhouse\.io/);
  assert.equal(first.remoteType, RemoteType.REMOTE);
  assert.ok(!first.description.includes('<'), 'HTML tags should be stripped');
  assert.ok(first.description.includes('Node.js'), 'text should survive');
  assert.ok(first.description.includes('scalable systems'));
});

test('lever: maps text/hostedUrl/commitment/workplaceType', () => {
  const jobs = parseLever(fx('lever.json'), { name: 'Netlify', slug: 'netlify' });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Senior Frontend Engineer');
  assert.match(jobs[0].url, /jobs\.lever\.co\/netlify\/l1$/);
  assert.equal(jobs[0].employmentType, EmploymentType.FULLTIME);
  assert.equal(jobs[0].remoteType, RemoteType.REMOTE);
  assert.equal(jobs[1].employmentType, EmploymentType.CONTRACT);
});

test('ashby: honors isRemote and employmentType, uses organizationName', () => {
  const jobs = parseAshby(fx('ashby.json'), { name: 'Ramp', slug: 'ramp' });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].company, 'Ramp');
  assert.equal(jobs[0].remoteType, RemoteType.REMOTE);
  assert.equal(jobs[0].employmentType, EmploymentType.FULLTIME);
  assert.equal(jobs[1].remoteType, RemoteType.ONSITE);
  assert.equal(jobs[1].employmentType, EmploymentType.CONTRACT);
});

test('htmlToText strips tags and decodes entities', () => {
  assert.equal(htmlToText('&lt;p&gt;Hello world&lt;/p&gt;'), 'Hello world');
  assert.equal(htmlToText('a &amp; b'), 'a & b');
  assert.ok(!htmlToText('<div>x</div>').includes('<'));
});

test('guessEmploymentType detects contract', () => {
  assert.equal(guessEmploymentType('Contract React Developer'), EmploymentType.CONTRACT);
  assert.equal(guessEmploymentType('Full-time Backend Engineer'), EmploymentType.FULLTIME);
});

test('prefilter passes a worldwide remote React role', () => {
  const job = normalizeJob({
    source: 'x', company: 'A', title: 'Senior React Engineer', url: 'https://x/y',
    location: 'Remote - Worldwide', remoteType: RemoteType.REMOTE,
    description: 'React, Node, TypeScript. Work from anywhere in the world.',
  });
  const r = prefilter(job, profile);
  assert.equal(r.pass, true, `unexpected reasons: ${r.reasons.join(',')}`);
});

test('prefilter drops an onsite non-stack role', () => {
  const job = normalizeJob({
    source: 'x', company: 'A', title: 'Office Manager', url: 'https://x/z',
    location: 'San Francisco', remoteType: RemoteType.ONSITE, description: 'Manage the office.',
  });
  const r = prefilter(job, profile);
  assert.equal(r.pass, false);
  assert.ok(r.reasons.includes('no-stack-match'));
});

test('prefilter drops a US-work-authorization remote role', () => {
  const job = normalizeJob({
    source: 'x', company: 'A', title: 'React Engineer', url: 'https://x/u',
    location: 'Remote (US)', remoteType: RemoteType.REMOTE,
    description: 'Must be authorized to work in the United States. React, Node.',
  });
  const r = prefilter(job, profile);
  assert.equal(r.pass, false);
  assert.ok(r.reasons.includes('region-locked'), `reasons: ${r.reasons.join(',')}`);
});
