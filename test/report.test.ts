import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectBranchChoices } from '../src/branches';
import { formatReport, formatStatus, mergeFetchErrors, summarizeResults } from '../src/report';
import type { RepoStatus } from '../src/types';

describe('reports', () => {
  it('renders the switch table and keeps a failed fetch on a non-ok row', () => {
    const table = formatReport([
      {
        repo: 'example-service',
        before: 'master',
        after: 'dev',
        action: 'create-track',
        result: 'ok',
        error: '',
      },
    ]);
    assert.match(table, /repo\s+\|\s+before\s+\|\s+after\s+\|\s+action\s+\|\s+result\s+\|\s+error/);
    assert.match(table, /example-service\s+\|\s+master\s+\|\s+dev\s+\|\s+create-track\s+\|\s+ok/);

    const merged = mergeFetchErrors(
      [
        { repo: 'no-dev', before: 'master', after: 'master', action: 'fetch', result: 'failed', error: 'no remote' },
        { repo: 'ok-repo', before: 'dev', after: 'dev', action: 'fetch', result: 'failed', error: 'timeout' },
      ],
      [
        {
          repo: 'no-dev',
          before: 'master',
          after: 'master',
          action: 'skip: missing-remote-branch',
          result: 'skipped',
          error: '',
        },
        { repo: 'ok-repo', before: 'dev', after: 'dev', action: 'already-on', result: 'ok', error: '' },
      ],
    );
    assert.match(merged[0]?.error ?? '', /fetch failed: no remote/);
    assert.equal(merged[1]?.error, '');
    assert.deepEqual(summarizeResults(merged), { ok: 1, skipped: 1, failed: 0 });
  });

  it('renders status with a dash when there is no upstream', () => {
    const repos: RepoStatus[] = [
      {
        path: '/work/web',
        name: 'web',
        branch: 'dev',
        dirty: false,
        ahead: null,
        behind: null,
        localBranches: ['dev'],
        remoteBranches: [],
      },
    ];
    assert.match(formatStatus(repos), /web\s+\|\s+dev\s+\|\s+no\s+\|\s+-\s+\|\s+-/);
  });

  it('lists a remote-only branch separately from local branches', () => {
    const choices = collectBranchChoices([
      {
        path: '/a',
        name: 'a',
        branch: 'master',
        dirty: false,
        ahead: 0,
        behind: 0,
        localBranches: ['master', 'dev'],
        remoteBranches: ['master', 'dev'],
      },
      {
        path: '/b',
        name: 'b',
        branch: 'master',
        dirty: false,
        ahead: 0,
        behind: 0,
        localBranches: ['master'],
        remoteBranches: ['master', 'dev', 'release'],
      },
    ]);
    assert.deepEqual(choices.local.map((choice) => choice.name), ['master', 'dev']);
    assert.equal(choices.local.find((choice) => choice.name === 'master')?.repos, 2);
    assert.deepEqual(choices.remoteOnly.map((choice) => choice.name), ['release']);
  });
});
