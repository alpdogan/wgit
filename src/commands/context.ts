import type { Log } from '../logger';
import type { RepoStatus, WgitConfig } from '../types';

export interface CommandContext {
  log: Log;
  getConfig: () => WgitConfig;
  scan: () => Promise<RepoStatus[]>;
  setRepos: (repos: RepoStatus[]) => void;
}
