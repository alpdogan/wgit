import { gitErrorText, runGit, switchCommandMissing } from './git';
import { actionName, planSwitch } from './planner';
import { loadRepoStatus, readCurrentBranch } from './repoDetector';
import type { DirtyPolicy, GitResult, GitRunner, GitRunOptions, PlannedAction, ReportRow } from './types';

export interface SwitchOneInput {
  path: string;
  name: string;
  targetBranch: string;
  remote: string;
  dirtyPolicy: DirtyPolicy;
  pullAfterSwitch: boolean;
  signal?: AbortSignal;
  git?: GitRunner;
}

export async function switchOne(input: SwitchOneInput): Promise<ReportRow> {
  const git = input.git ?? runGit;
  const options: GitRunOptions = { signal: input.signal };
  try {
    if (input.signal?.aborted) {
      return cancelledRow(input.name);
    }
    const status = await loadRepoStatus(input.path, input.name, input.remote, options, git);
    if (!status) {
      return {
        repo: input.name,
        before: 'unknown',
        after: 'unknown',
        action: 'error',
        result: 'failed',
        error: 'unable to read repository',
      };
    }
    const plan = planSwitch({
      currentBranch: status.branch,
      dirty: status.dirty,
      localBranches: status.localBranches,
      remoteBranches: status.remoteBranches,
      targetBranch: input.targetBranch,
      remote: input.remote,
      dirtyPolicy: input.dirtyPolicy,
    });
    return await applyPlan(status.path, status.name, status.branch, plan, input.targetBranch, input.pullAfterSwitch, git, options);
  } catch (error) {
    return {
      repo: input.name,
      before: 'unknown',
      after: 'unknown',
      action: 'error',
      result: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkoutBranch(
  cwd: string,
  plan: PlannedAction,
  targetBranch: string,
  git: GitRunner,
  options: GitRunOptions = {},
): Promise<GitResult> {
  if (plan.type === 'switch') {
    const switched = await git(cwd, ['switch', targetBranch], options);
    if (switched.ok || !switchCommandMissing(switched)) {
      return switched;
    }
    return git(cwd, ['checkout', targetBranch], options);
  }
  if (plan.type !== 'create-track') {
    return { ok: true, code: 0, stdout: '', stderr: '' };
  }

  const created = await git(cwd, ['switch', '-c', targetBranch, '--track', plan.remoteRef], options);
  if (created.ok) {
    return created;
  }
  if (switchCommandMissing(created)) {
    return git(cwd, ['checkout', '--track', '-B', targetBranch, plan.remoteRef], options);
  }
  const existing = await git(cwd, ['switch', targetBranch], options);
  if (existing.ok) {
    return existing;
  }
  return created;
}

async function applyPlan(
  cwd: string,
  name: string,
  before: string,
  plan: PlannedAction,
  targetBranch: string,
  pullAfterSwitch: boolean,
  git: GitRunner,
  options: GitRunOptions,
): Promise<ReportRow> {
  const action = actionName(plan);
  if (plan.type === 'skip') {
    return { repo: name, before, after: before, action, result: 'skipped', error: '' };
  }
  if (plan.type === 'fail') {
    return {
      repo: name,
      before,
      after: before,
      action,
      result: 'failed',
      error: 'dirty working tree blocks checkout',
    };
  }

  let stashed = false;
  if (plan.type !== 'already-on' && plan.stash) {
    const stash = await git(cwd, ['stash', 'push', '-u', '-m', `wgit: switch to ${targetBranch}`], options);
    if (!stash.ok) {
      return { repo: name, before, after: before, action, result: 'failed', error: `stash failed: ${gitErrorText(stash)}` };
    }
    stashed = true;
  }

  if (plan.type !== 'already-on') {
    const switched = await checkoutBranch(cwd, plan, targetBranch, git, options);
    if (!switched.ok) {
      const restoreError = stashed ? await restoreStash(cwd, git, options) : '';
      const error = [gitErrorText(switched), restoreError].filter((part) => part.length > 0).join('; ');
      return { repo: name, before, after: before, action, result: 'failed', error };
    }
  }

  return finishOnBranch(cwd, name, before, action, pullAfterSwitch, stashed, git, options);
}

async function finishOnBranch(
  cwd: string,
  name: string,
  before: string,
  action: ReportRow['action'],
  pullAfterSwitch: boolean,
  stashed: boolean,
  git: GitRunner,
  options: GitRunOptions,
): Promise<ReportRow> {
  const errors: string[] = [];
  if (pullAfterSwitch) {
    const pull = await git(cwd, ['pull', '--ff-only'], options);
    if (!pull.ok) {
      errors.push(`pull --ff-only failed: ${gitErrorText(pull)}`);
    }
  }
  if (stashed) {
    const pop = await git(cwd, ['stash', 'pop'], options);
    if (!pop.ok) {
      errors.push(`stash pop failed (changes kept in the stash): ${gitErrorText(pop)}`);
    }
  }
  const after = (await readCurrentBranch(cwd, options, git)) ?? before;
  return {
    repo: name,
    before,
    after,
    action,
    result: errors.length === 0 ? 'ok' : 'failed',
    error: errors.join('; '),
  };
}

async function restoreStash(cwd: string, git: GitRunner, options: GitRunOptions): Promise<string> {
  const pop = await git(cwd, ['stash', 'pop'], options);
  if (pop.ok) {
    return '';
  }
  return `stash pop failed (changes kept in the stash): ${gitErrorText(pop)}`;
}

function cancelledRow(name: string): ReportRow {
  return {
    repo: name,
    before: 'unknown',
    after: 'unknown',
    action: 'error',
    result: 'skipped',
    error: 'cancelled',
  };
}
