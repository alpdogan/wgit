import type { ActionName, DirtyPolicy, PlannedAction } from './types';

export interface PlanInput {
  currentBranch: string;
  dirty: boolean;
  localBranches: readonly string[];
  remoteBranches: readonly string[];
  targetBranch: string;
  remote: string;
  dirtyPolicy: DirtyPolicy;
}

/**
 * Decide what one repository needs in order to end on `targetBranch`.
 * A dirty tree only matters when the checkout would move. A missing branch
 * is reported as missing even when the tree is also dirty.
 */
export function planSwitch(input: PlanInput): PlannedAction {
  if (input.currentBranch === input.targetBranch) {
    return { type: 'already-on' };
  }

  const hasLocal = input.localBranches.includes(input.targetBranch);
  const hasRemote = input.remoteBranches.includes(input.targetBranch);
  if (!hasLocal && !hasRemote) {
    return { type: 'skip', reason: 'missing-remote-branch' };
  }

  if (input.dirty && input.dirtyPolicy === 'skip') {
    return { type: 'skip', reason: 'dirty' };
  }
  if (input.dirty && input.dirtyPolicy === 'fail') {
    return { type: 'fail', reason: 'dirty' };
  }

  const stash = input.dirty && input.dirtyPolicy === 'stash';
  if (hasLocal) {
    return { type: 'switch', stash };
  }
  return {
    type: 'create-track',
    remoteRef: `${input.remote}/${input.targetBranch}`,
    stash,
  };
}

export function actionName(plan: PlannedAction): ActionName {
  switch (plan.type) {
    case 'already-on':
      return 'already-on';
    case 'switch':
      return 'switch';
    case 'create-track':
      return 'create-track';
    case 'skip':
      return plan.reason === 'dirty' ? 'skip: dirty' : 'skip: missing-remote-branch';
    case 'fail':
      return 'fail: dirty';
    default: {
      const neverPlan: never = plan;
      return neverPlan;
    }
  }
}

export interface PlanCounts {
  alreadyOn: number;
  switchLocal: number;
  createTrack: number;
  skipDirty: number;
  skipMissing: number;
  failDirty: number;
}

export function countPlans(plans: readonly PlannedAction[]): PlanCounts {
  const counts: PlanCounts = {
    alreadyOn: 0,
    switchLocal: 0,
    createTrack: 0,
    skipDirty: 0,
    skipMissing: 0,
    failDirty: 0,
  };
  for (const plan of plans) {
    switch (plan.type) {
      case 'already-on':
        counts.alreadyOn += 1;
        break;
      case 'switch':
        counts.switchLocal += 1;
        break;
      case 'create-track':
        counts.createTrack += 1;
        break;
      case 'skip':
        if (plan.reason === 'dirty') {
          counts.skipDirty += 1;
        } else {
          counts.skipMissing += 1;
        }
        break;
      case 'fail':
        counts.failDirty += 1;
        break;
      default: {
        const neverPlan: never = plan;
        return neverPlan;
      }
    }
  }
  return counts;
}

export function formatSwitchPrompt(
  branch: string,
  remote: string,
  counts: PlanCounts,
  pullAfterSwitch: boolean,
): string {
  const lines = [
    `Switch every repository to "${branch}"?`,
    '',
    `${counts.alreadyOn} already on ${branch}`,
    `${counts.switchLocal} switch to an existing local branch`,
    `${counts.createTrack} create a local branch tracking ${remote}/${branch}`,
    `${counts.skipDirty} skip (dirty working tree)`,
    `${counts.skipMissing} skip (no ${remote}/${branch})`,
  ];
  if (counts.failDirty > 0) {
    lines.push(`${counts.failDirty} fail (dirty working tree)`);
  }
  lines.push('');
  if (pullAfterSwitch) {
    lines.push('After a repository is on this branch, WGit runs git pull --ff-only.');
  }
  lines.push('No branch changes until you continue.');
  return lines.join('\n');
}
