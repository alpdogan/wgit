import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fetchRepos, switchRepos } from '../src/batch';
import { planSwitch } from '../src/planner';
import { loadRepoStatus } from '../src/repoDetector';
import { mergeFetchErrors } from '../src/report';
import { switchOne } from '../src/switchRepo';
import type { NamedRepo, ReportRow, WgitConfig } from '../src/types';
import { cloneFrom, commitFile, currentBranch, ensureIdentity, git, initBare, porcelain, removeRoot, tempRoot, upstream } from './fixture';

const config: WgitConfig = {
  maxParallel: 2,
  fetchBeforeSwitch: true,
  pullAfterSwitch: true,
  dirtyPolicy: 'skip',
  scanNestedRepos: true,
  defaultRemote: 'origin',
};

describe('acceptance: switch a multi-root workspace to dev', () => {
  it('creates a missing local branch, skips dirty and missing repos, and is safe to repeat', async () => {
    const root = tempRoot();
    try {
      const alreadyOn = seedAlreadyOn(root);
      const authService = seedRemoteOnlyDev(root);
      const missing = seedMasterOnly(root);
      const dirty = seedDirty(root);
      const repos: NamedRepo[] = [
        { path: alreadyOn, name: 'already-on' },
        { path: authService, name: 'admin-panel-auth-service' },
        { path: missing, name: 'no-dev' },
        { path: dirty, name: 'dirty-repo' },
      ];

      const beforeFetch = await loadRepoStatus(authService, 'admin-panel-auth-service', 'origin');
      assert.equal(beforeFetch?.remoteBranches.includes('dev'), false);
      assert.equal(beforeFetch?.branch, 'master');

      const fetched = await fetchRepos(repos, 'origin', config.maxParallel);
      assert.equal(fetched.every((row) => row.result === 'ok'), true);
      const afterFetch = await loadRepoStatus(authService, 'admin-panel-auth-service', 'origin');
      assert.equal(afterFetch?.remoteBranches.includes('dev'), true);
      assert.equal(afterFetch?.localBranches.includes('dev'), false);

      const preview = await Promise.all(repos.map(async (repo) => loadRepoStatus(repo.path, repo.name, 'origin')));
      const plans = preview.map((status) => {
        assert.ok(status);
        return planSwitch({
          currentBranch: status.branch,
          dirty: status.dirty,
          localBranches: status.localBranches,
          remoteBranches: status.remoteBranches,
          targetBranch: 'dev',
          remote: 'origin',
          dirtyPolicy: 'skip',
        });
      });
      assert.deepEqual(
        plans.map((plan) => plan.type),
        ['already-on', 'create-track', 'skip', 'skip'],
      );

      const first = mergeFetchErrors(
        fetched,
        await switchRepos(repos, 'dev', config),
      );
      assertRow(first, 'already-on', { action: 'already-on', result: 'ok', after: 'dev' });
      assertRow(first, 'admin-panel-auth-service', { action: 'create-track', result: 'ok', after: 'dev' });
      assertRow(first, 'no-dev', { action: 'skip: missing-remote-branch', result: 'skipped', after: 'master' });
      assertRow(first, 'dirty-repo', { action: 'skip: dirty', result: 'skipped', after: 'master' });

      assert.equal(fs.readFileSync(path.join(alreadyOn, 'a.txt'), 'utf8'), 'two\n');
      assert.equal(currentBranch(authService), 'dev');
      assert.equal(upstream(authService), 'origin/dev');
      assert.equal(fs.readFileSync(path.join(authService, 'b.txt'), 'utf8'), 'dev\n');
      assert.equal(currentBranch(missing), 'master');
      assert.equal(currentBranch(dirty), 'master');
      assert.match(porcelain(dirty), /M readme\.txt/);
      assert.equal(fs.readFileSync(path.join(dirty, 'readme.txt'), 'utf8'), 'local edit\n');

      const second = await switchRepos(repos, 'dev', config);
      assertRow(second, 'already-on', { action: 'already-on', result: 'ok', after: 'dev' });
      assertRow(second, 'admin-panel-auth-service', { action: 'already-on', result: 'ok', after: 'dev' });
      assertRow(second, 'no-dev', { action: 'skip: missing-remote-branch', result: 'skipped', after: 'master' });
      assertRow(second, 'dirty-repo', { action: 'skip: dirty', result: 'skipped', after: 'master' });
      assert.equal(fs.readFileSync(path.join(dirty, 'readme.txt'), 'utf8'), 'local edit\n');
    } finally {
      removeRoot(root);
    }
  });
});

describe('dirty policies', () => {
  it('stashes, switches, and restores a local edit', async () => {
    const root = tempRoot();
    try {
      const repo = seedStashRepo(root);
      const row = await switchOne({
        path: repo,
        name: 'stash-repo',
        targetBranch: 'dev',
        remote: 'origin',
        dirtyPolicy: 'stash',
        pullAfterSwitch: false,
      });
      assert.equal(row.result, 'ok');
      assert.equal(row.action, 'switch');
      assert.equal(currentBranch(repo), 'dev');
      assert.equal(fs.readFileSync(path.join(repo, 'file.txt'), 'utf8'), 'local change\n');
      assert.match(porcelain(repo), /M file\.txt/);
    } finally {
      removeRoot(root);
    }
  });

  it('fails the repository and leaves the branch unchanged', async () => {
    const root = tempRoot();
    try {
      const repo = seedStashRepo(root);
      const row = await switchOne({
        path: repo,
        name: 'fail-repo',
        targetBranch: 'dev',
        remote: 'origin',
        dirtyPolicy: 'fail',
        pullAfterSwitch: false,
      });
      assert.equal(row.action, 'fail: dirty');
      assert.equal(row.result, 'failed');
      assert.equal(currentBranch(repo), 'master');
      assert.equal(fs.readFileSync(path.join(repo, 'file.txt'), 'utf8'), 'local change\n');
    } finally {
      removeRoot(root);
    }
  });

  it('prefers missing-remote-branch when a dirty repository has no such branch', async () => {
    const root = tempRoot();
    try {
      const repo = seedMasterOnly(root);
      fs.writeFileSync(path.join(repo, 'readme.txt'), 'dirty\n');
      const row = await switchOne({
        path: repo,
        name: 'no-dev',
        targetBranch: 'dev',
        remote: 'origin',
        dirtyPolicy: 'skip',
        pullAfterSwitch: false,
      });
      assert.equal(row.action, 'skip: missing-remote-branch');
      assert.equal(row.result, 'skipped');
      assert.equal(currentBranch(repo), 'master');
    } finally {
      removeRoot(root);
    }
  });
});

describe('batch isolation', () => {
  it('continues after a repository that cannot be fetched or read', async () => {
    const root = tempRoot();
    try {
      const good = seedMasterOnly(root);
      const solo = path.join(root, 'solo');
      fs.mkdirSync(solo);
      git(root, ['init', '-b', 'master', solo]);
      git(solo, ['config', 'user.name', 'WGit Test']);
      git(solo, ['config', 'user.email', 'wgit-test@example.com']);
      commitFile(solo, 'solo.txt', 'one\n', 'solo');
      const nowhere = path.join(root, 'not-a-repo');
      fs.writeFileSync(nowhere, 'file');

      const repos: NamedRepo[] = [
        { path: good, name: 'no-dev' },
        { path: solo, name: 'solo' },
        { path: nowhere, name: 'not-a-repo' },
      ];
      const fetched = await fetchRepos(repos, 'origin', 2);
      const switched = await switchRepos(repos, 'dev', { ...config, pullAfterSwitch: false });
      const rows = mergeFetchErrors(fetched, switched);
      const soloRow = rows.find((row) => row.repo === 'solo');
      const missingRow = rows.find((row) => row.repo === 'not-a-repo');
      assert.equal(soloRow?.result, 'skipped');
      assert.match(soloRow?.error ?? '', /fetch failed/);
      assert.equal(missingRow?.result, 'failed');
      assert.equal(currentBranch(good), 'master');
    } finally {
      removeRoot(root);
    }
  });
});

function assertRow(
  rows: readonly ReportRow[],
  repo: string,
  expected: { action: ReportRow['action']; result: ReportRow['result']; after: string },
): void {
  const row = rows.find((candidate) => candidate.repo === repo);
  assert.ok(row, `missing report row for ${repo}`);
  assert.equal(row.action, expected.action, `${repo} action`);
  assert.equal(row.result, expected.result, `${repo} result ${row.error}`);
  assert.equal(row.after, expected.after, `${repo} after`);
}

function seedAlreadyOn(root: string): string {
  const origin = initBare(root, 'origin-already.git', 'dev');
  const seed = path.join(root, '.seed-already');
  git(root, ['init', '-b', 'dev', seed]);
  ensureIdentity(seed);
  commitFile(seed, 'a.txt', 'one\n', 'c1');
  git(seed, ['remote', 'add', 'origin', origin]);
  git(seed, ['push', '-u', 'origin', 'dev']);
  const repo = cloneFrom(root, origin, 'already-on');
  commitFile(seed, 'a.txt', 'two\n', 'c2');
  git(seed, ['push']);
  return repo;
}

function seedRemoteOnlyDev(root: string): string {
  const origin = initBare(root, 'origin-auth.git', 'master');
  const seed = path.join(root, '.seed-auth');
  git(root, ['init', '-b', 'master', seed]);
  ensureIdentity(seed);
  commitFile(seed, 'b.txt', 'master\n', 'master');
  git(seed, ['remote', 'add', 'origin', origin]);
  git(seed, ['push', '-u', 'origin', 'master']);
  git(seed, ['checkout', '-b', 'dev']);
  commitFile(seed, 'b.txt', 'dev\n', 'dev');
  git(seed, ['push', '-u', 'origin', 'dev']);
  const repo = cloneFrom(root, origin, 'admin-panel-auth-service');
  if (currentBranch(repo) !== 'master') {
    git(repo, ['checkout', 'master']);
  }
  git(repo, ['update-ref', '-d', 'refs/remotes/origin/dev']);
  return repo;
}

function seedMasterOnly(root: string): string {
  const origin = initBare(root, 'origin-master.git', 'master');
  const seed = path.join(root, '.seed-master');
  git(root, ['init', '-b', 'master', seed]);
  ensureIdentity(seed);
  commitFile(seed, 'readme.txt', 'master\n', 'master');
  git(seed, ['remote', 'add', 'origin', origin]);
  git(seed, ['push', '-u', 'origin', 'master']);
  return cloneFrom(root, origin, 'no-dev');
}

function seedDirty(root: string): string {
  const origin = initBare(root, 'origin-dirty.git', 'master');
  const seed = path.join(root, '.seed-dirty');
  git(root, ['init', '-b', 'master', seed]);
  ensureIdentity(seed);
  commitFile(seed, 'readme.txt', 'master\n', 'master');
  git(seed, ['remote', 'add', 'origin', origin]);
  git(seed, ['push', '-u', 'origin', 'master']);
  git(seed, ['checkout', '-b', 'dev']);
  commitFile(seed, 'readme.txt', 'dev\n', 'dev');
  git(seed, ['push', '-u', 'origin', 'dev']);
  const repo = cloneFrom(root, origin, 'dirty-repo');
  git(repo, ['checkout', '-b', 'dev', '--track', 'origin/dev']);
  git(repo, ['checkout', 'master']);
  fs.writeFileSync(path.join(repo, 'readme.txt'), 'local edit\n');
  return repo;
}

function seedStashRepo(root: string): string {
  const origin = initBare(root, 'origin-stash.git', 'master');
  const seed = path.join(root, '.seed-stash');
  git(root, ['init', '-b', 'master', seed]);
  ensureIdentity(seed);
  commitFile(seed, 'file.txt', 'base\n', 'base');
  git(seed, ['remote', 'add', 'origin', origin]);
  git(seed, ['push', '-u', 'origin', 'master']);
  git(seed, ['checkout', '-b', 'dev']);
  commitFile(seed, 'other.txt', 'dev only\n', 'dev only');
  git(seed, ['push', '-u', 'origin', 'dev']);
  const repo = cloneFrom(root, origin, 'stash-repo');
  git(repo, ['checkout', '-b', 'dev', '--track', 'origin/dev']);
  git(repo, ['checkout', 'master']);
  fs.writeFileSync(path.join(repo, 'file.txt'), 'local change\n');
  return repo;
}
