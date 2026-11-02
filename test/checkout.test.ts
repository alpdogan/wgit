import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkoutBranch } from '../src/switchRepo';
import type { GitResult, GitRunner } from '../src/types';

function result(ok: boolean, stderr = ''): GitResult {
  return { ok, code: ok ? 0 : 1, stdout: '', stderr };
}

describe('checkoutBranch', () => {
  it('creates the tracking branch with git switch', async () => {
    const calls: string[][] = [];
    const git: GitRunner = async (_cwd, args) => {
      calls.push([...args]);
      return result(true);
    };
    const checkout = await checkoutBranch(
      '/repo',
      { type: 'create-track', remoteRef: 'origin/dev', stash: false },
      'dev',
      git,
    );
    assert.equal(checkout.ok, true);
    assert.deepEqual(calls, [['switch', '-c', 'dev', '--track', 'origin/dev']]);
  });

  it('falls back to checkout -B only when git switch is unavailable', async () => {
    const calls: string[][] = [];
    const git: GitRunner = async (_cwd, args) => {
      calls.push([...args]);
      if (args[0] === 'switch') {
        return result(false, "git: 'switch' is not a git command. See 'git --help'.");
      }
      return result(true);
    };
    await checkoutBranch('/repo', { type: 'create-track', remoteRef: 'origin/dev', stash: false }, 'dev', git);
    assert.deepEqual(calls[1], ['checkout', '--track', '-B', 'dev', 'origin/dev']);
  });

  it('does not reset an existing branch when switch exists but creation fails', async () => {
    const calls: string[][] = [];
    const git: GitRunner = async (_cwd, args) => {
      calls.push([...args]);
      return result(false, "fatal: a branch named 'dev' already exists");
    };
    await checkoutBranch('/repo', { type: 'create-track', remoteRef: 'origin/dev', stash: false }, 'dev', git);
    assert.deepEqual(
      calls.map((args) => args.join(' ')),
      ["switch -c dev --track origin/dev", 'switch dev'],
    );
  });

  it('uses git checkout for a local branch only when switch is unavailable', async () => {
    const calls: string[][] = [];
    const git: GitRunner = async (_cwd, args) => {
      calls.push([...args]);
      if (args[0] === 'switch') {
        return result(false, "git: 'switch' is not a git command. See 'git --help'.");
      }
      return result(true);
    };
    await checkoutBranch('/repo', { type: 'switch', stash: false }, 'dev', git);
    assert.deepEqual(calls[1], ['checkout', 'dev']);
  });
});
