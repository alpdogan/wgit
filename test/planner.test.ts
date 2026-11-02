import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { actionName, countPlans, formatSwitchPrompt, planSwitch, type PlanInput } from '../src/planner';

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    currentBranch: 'master',
    dirty: false,
    localBranches: ['master'],
    remoteBranches: [],
    targetBranch: 'dev',
    remote: 'origin',
    dirtyPolicy: 'skip',
    ...overrides,
  };
}

describe('planSwitch', () => {
  it('keeps a repository that is already on the target', () => {
    const plan = planSwitch(input({ currentBranch: 'dev', localBranches: ['dev', 'master'], dirty: true }));
    assert.deepEqual(plan, { type: 'already-on' });
    assert.equal(actionName(plan), 'already-on');
  });

  it('switches when the local branch exists', () => {
    const plan = planSwitch(input({ localBranches: ['master', 'dev'] }));
    assert.deepEqual(plan, { type: 'switch', stash: false });
  });

  it('creates a tracking branch when only the remote has it', () => {
    const plan = planSwitch(input({ remoteBranches: ['dev'] }));
    assert.deepEqual(plan, { type: 'create-track', remoteRef: 'origin/dev', stash: false });
    assert.equal(actionName(plan), 'create-track');
  });

  it('uses the configured remote in the tracking ref', () => {
    const plan = planSwitch(input({ remote: 'upstream', remoteBranches: ['feature/login'], targetBranch: 'feature/login' }));
    assert.deepEqual(plan, { type: 'create-track', remoteRef: 'upstream/feature/login', stash: false });
  });

  it('skips when the branch is missing locally and on the remote', () => {
    const plan = planSwitch(input());
    assert.deepEqual(plan, { type: 'skip', reason: 'missing-remote-branch' });
  });

  it('reports missing before dirty when the branch does not exist', () => {
    const plan = planSwitch(input({ dirty: true }));
    assert.deepEqual(plan, { type: 'skip', reason: 'missing-remote-branch' });
  });

  it('skips a dirty tree that would move under the skip policy', () => {
    const plan = planSwitch(input({ dirty: true, localBranches: ['master', 'dev'] }));
    assert.deepEqual(plan, { type: 'skip', reason: 'dirty' });
    assert.equal(actionName(plan), 'skip: dirty');
  });

  it('fails a dirty tree that would move under the fail policy', () => {
    const plan = planSwitch(input({ dirty: true, remoteBranches: ['dev'], dirtyPolicy: 'fail' }));
    assert.deepEqual(plan, { type: 'fail', reason: 'dirty' });
  });

  it('stashes a dirty tree when that policy is selected', () => {
    const plan = planSwitch(input({ dirty: true, remoteBranches: ['dev'], dirtyPolicy: 'stash' }));
    assert.deepEqual(plan, { type: 'create-track', remoteRef: 'origin/dev', stash: true });
  });

  it('switches from a detached HEAD when the local branch exists', () => {
    const plan = planSwitch(input({ currentBranch: 'HEAD', localBranches: ['dev'] }));
    assert.deepEqual(plan, { type: 'switch', stash: false });
  });
});

describe('plan summary', () => {
  it('counts each outcome for the confirmation prompt', () => {
    const counts = countPlans([
      { type: 'already-on' },
      { type: 'already-on' },
      { type: 'switch', stash: false },
      { type: 'create-track', remoteRef: 'origin/dev', stash: false },
      { type: 'skip', reason: 'dirty' },
      { type: 'skip', reason: 'missing-remote-branch' },
      { type: 'fail', reason: 'dirty' },
    ]);
    assert.deepEqual(counts, {
      alreadyOn: 2,
      switchLocal: 1,
      createTrack: 1,
      skipDirty: 1,
      skipMissing: 1,
      failDirty: 1,
    });
    const prompt = formatSwitchPrompt('dev', 'origin', counts, true);
    assert.match(prompt, /Switch every repository to "dev"/);
    assert.match(prompt, /1 create a local branch tracking origin\/dev/);
    assert.match(prompt, /git pull --ff-only/);
    assert.match(prompt, /No branch changes until you continue/);
  });
});
