import type { RepoStatus } from './types';

export interface BranchChoice {
  name: string;
  repos: number;
  kind: 'local' | 'remote';
}

export function collectBranchChoices(repos: readonly RepoStatus[]): {
  local: BranchChoice[];
  remoteOnly: BranchChoice[];
} {
  const localCounts = new Map<string, number>();
  const remoteCounts = new Map<string, number>();
  for (const repo of repos) {
    for (const name of new Set(repo.localBranches)) {
      localCounts.set(name, (localCounts.get(name) ?? 0) + 1);
    }
    for (const name of new Set(repo.remoteBranches)) {
      remoteCounts.set(name, (remoteCounts.get(name) ?? 0) + 1);
    }
  }

  const byPopularity = (left: BranchChoice, right: BranchChoice): number =>
    right.repos - left.repos || left.name.localeCompare(right.name);

  const local = [...localCounts.entries()]
    .map(([name, count]) => ({ name, repos: count, kind: 'local' as const }))
    .sort(byPopularity);
  const remoteOnly = [...remoteCounts.entries()]
    .filter(([name]) => !localCounts.has(name))
    .map(([name, count]) => ({ name, repos: count, kind: 'remote' as const }))
    .sort(byPopularity);
  return { local, remoteOnly };
}
