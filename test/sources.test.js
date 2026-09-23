import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Parser from 'rss-parser';

import { parseRemoteOK } from '../src/sources/remoteok.js';
import { parseRemotive } from '../src/sources/remotive.js';
import { parseArbeitnow } from '../src/sources/arbeitnow.js';
import { parseHimalayas } from '../src/sources/himalayas.js';
import { parseWWR } from '../src/sources/wwr.js';
import { parseHNComment } from '../src/sources/hn.js';
import { RemoteType, EmploymentType } from '../src/lib/job.js';

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (n) => JSON.parse(readFileSync(join(here, 'fixtures', n), 'utf8'));
const readText = (n) => readFileSync(join(here, 'fixtures', n), 'utf8');

test('remoteok: skips legal element, maps job, detects contract tag', () => {
  const jobs = parseRemoteOK(readJson('remoteok.json'));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Senior React Engineer');
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].remoteType, RemoteType.REMOTE);
  assert.equal(jobs[0].employmentType, EmploymentType.CONTRACT);
  assert.equal(jobs[0].salary, '80000-120000');
  assert.ok(!jobs[0].description.includes('<'));
});

test('remotive: maps job_type and required location', () => {
  const jobs = parseRemotive(readJson('remotive.json'));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Globex');
  assert.equal(jobs[0].employmentType, EmploymentType.FULLTIME);
  assert.equal(jobs[0].region, 'Worldwide');
});

test('arbeitnow: remote flag and job_types', () => {
  const jobs = parseArbeitnow(readJson('arbeitnow.json'));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].remoteType, RemoteType.REMOTE);
  assert.equal(jobs[0].employmentType, EmploymentType.FULLTIME);
  assert.match(jobs[0].postedAt, /T/);
});

test('himalayas: joins restrictions, maps timezone + employment', () => {
  const jobs = parseHimalayas(readJson('himalayas.json'));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Umbrella');
  assert.equal(jobs[0].timezoneReq, 'UTC-2 to UTC+3');
  assert.equal(jobs[0].employmentType, EmploymentType.FULLTIME);
  assert.equal(jobs[0].region, 'Worldwide');
});

test('wwr: splits "Company: Title", strips html, detects contract', async () => {
  const parser = new Parser();
  const feed = await parser.parseString(readText('wwr.xml'));
  const jobs = parseWWR(feed);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Hooli');
  assert.equal(jobs[0].title, 'Senior Node Engineer');
  assert.equal(jobs[0].remoteType, RemoteType.REMOTE);
  assert.equal(jobs[0].employmentType, EmploymentType.CONTRACT);
  assert.ok(!jobs[0].description.includes('<'));
});

test('hn: parses "Company | Role | REMOTE" comment, skips empty', () => {
  const child = {
    id: 999,
    created_at: '2026-09-01T00:00:00Z',
    text: 'Acme Corp | Senior Frontend Engineer | REMOTE (Worldwide)<p>We use React, Next.js and Node. Contract or full-time.</p>',
  };
  const job = parseHNComment(child);
  assert.equal(job.company, 'Acme Corp');
  assert.match(job.title, /Senior Frontend Engineer/);
  assert.equal(job.remoteType, RemoteType.REMOTE);
  assert.match(job.url, /item\?id=999/);
  assert.equal(parseHNComment({ id: 1, text: '' }), null);
});
