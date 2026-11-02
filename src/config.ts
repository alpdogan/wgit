import type { DirtyPolicy, WgitConfig } from './types';

export const DEFAULT_CONFIG: WgitConfig = {
  maxParallel: 5,
  fetchBeforeSwitch: true,
  pullAfterSwitch: true,
  dirtyPolicy: 'skip',
  scanNestedRepos: true,
  defaultRemote: 'origin',
};

const MAX_PARALLEL_CAP = 32;
const POLICIES: readonly DirtyPolicy[] = ['skip', 'stash', 'fail'];

export interface ConfigInput {
  maxParallel?: unknown;
  fetchBeforeSwitch?: unknown;
  pullAfterSwitch?: unknown;
  dirtyPolicy?: unknown;
  scanNestedRepos?: unknown;
  defaultRemote?: unknown;
}

export function readConfig(input: ConfigInput): WgitConfig {
  return {
    maxParallel: readParallel(input.maxParallel),
    fetchBeforeSwitch: readBoolean(input.fetchBeforeSwitch, DEFAULT_CONFIG.fetchBeforeSwitch),
    pullAfterSwitch: readBoolean(input.pullAfterSwitch, DEFAULT_CONFIG.pullAfterSwitch),
    dirtyPolicy: readPolicy(input.dirtyPolicy),
    scanNestedRepos: readBoolean(input.scanNestedRepos, DEFAULT_CONFIG.scanNestedRepos),
    defaultRemote: readRemote(input.defaultRemote),
  };
}

function readParallel(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_CONFIG.maxParallel;
  }
  return Math.min(Math.floor(parsed), MAX_PARALLEL_CAP);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readPolicy(value: unknown): DirtyPolicy {
  return typeof value === 'string' && POLICIES.includes(value as DirtyPolicy)
    ? (value as DirtyPolicy)
    : DEFAULT_CONFIG.dirtyPolicy;
}

function readRemote(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_CONFIG.defaultRemote;
  }
  const remote = value.trim();
  // Remote names are passed as a single git argument. Reject option-like
  // values and traversal so a setting cannot change the git command shape.
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(remote) || remote.includes('..')) {
    return DEFAULT_CONFIG.defaultRemote;
  }
  return remote;
}
