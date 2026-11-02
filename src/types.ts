export type DirtyPolicy = 'skip' | 'stash' | 'fail';

export type ActionName =
  | 'already-on'
  | 'switch'
  | 'create-track'
  | 'skip: dirty'
  | 'skip: missing-remote-branch'
  | 'fail: dirty'
  | 'fetch'
  | 'pull'
  | 'error';

export type RowResult = 'ok' | 'skipped' | 'failed';

export interface ReportRow {
  repo: string;
  before: string;
  after: string;
  action: ActionName;
  result: RowResult;
  error: string;
}

export interface RepoStatus {
  path: string;
  name: string;
  branch: string;
  dirty: boolean;
  ahead: number | null;
  behind: number | null;
  localBranches: string[];
  remoteBranches: string[];
}

export interface NamedRepo {
  path: string;
  name: string;
}

export interface WgitConfig {
  maxParallel: number;
  fetchBeforeSwitch: boolean;
  pullAfterSwitch: boolean;
  dirtyPolicy: DirtyPolicy;
  scanNestedRepos: boolean;
  defaultRemote: string;
}

export type PlannedAction =
  | { type: 'already-on' }
  | { type: 'switch'; stash: boolean }
  | { type: 'create-track'; remoteRef: string; stash: boolean }
  | { type: 'skip'; reason: 'dirty' | 'missing-remote-branch' }
  | { type: 'fail'; reason: 'dirty' };

export interface GitRunOptions {
  signal?: AbortSignal;
}

export interface GitResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

export type GitRunner = (cwd: string, args: readonly string[], options?: GitRunOptions) => Promise<GitResult>;
