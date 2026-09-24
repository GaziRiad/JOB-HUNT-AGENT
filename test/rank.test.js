import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheapScore, rankAndCap } from '../src/rank.js';
import { profile } from '../config/profile.js';
import { normalizeJob, RemoteType } from '../src/lib/job.js';

test('cheapScore rewards stack + AI + worldwide signals', () => {
  const strong = normalizeJob({
    source: 'x', company: 'A', title: 'Senior React Engineer', url: 'https://x/1',
    location: 'Remote - Worldwide', remoteType: RemoteType.REMOTE,
    description: 'React, Node, TypeScript, LLM automation. Worldwide.',
  });
  const weak = normalizeJob({
    source: 'x', company: 'B', title: 'Office Manager', url: 'https://x/2',
    location: 'New York', remoteType: RemoteType.ONSITE, description: 'Manage the office.',
  });
  assert.ok(cheapScore(strong, profile) > cheapScore(weak, profile));
});

test('rankAndCap keeps the top N by cheap score', () => {
  const mk = (i, desc) => normalizeJob({
    source: 'x', company: `C${i}`, title: `Engineer ${i}`, url: `https://x/${i}`,
    location: 'Remote', remoteType: RemoteType.REMOTE, description: desc,
  });
  const jobs = [
    mk(1, 'plain role, nothing here'),
    mk(2, 'React Node TypeScript LLM worldwide'),
    mk(3, 'React Node'),
  ];
  const capped = rankAndCap(jobs, profile, 2);
  assert.equal(capped.length, 2);
  assert.equal(capped[0].title, 'Engineer 2');
});
