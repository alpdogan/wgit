import { gitErrorText, runGit } from './git';
import { mapPool } from './pool';
import { readCurrentBranch } from './repoDetector';
import { switchOne } from './switchRepo';
import type { NamedRepo, ReportRow, WgitConfig } from './types';

export interface BatchHooks {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  log?: (message: string) => void;
}

export async function fetchRepos(
  repos: readonly NamedRepo[],
  remote: string,
  maxParallel: number,
  hooks: BatchHooks = {},
): Promise<ReportRow[]> {
  return runRows(repos, maxParallel, hooks, async (repo) => {
    const before = (await readCurrentBranch(repo.path, { signal: hooks.signal })) ?? 'unknown';
    const result = await runGit(repo.path, ['fetch', remote], { signal: hooks.signal });
    hooks.log?.(result.ok ? `fetch ${repo.name} ok` : `fetch ${repo.name} failed: ${gitErrorText(result)}`);
    return {
      repo: repo.name,
      before,
      after: before,
      action: 'fetch',
      result: result.ok ? 'ok' : 'failed',
      error: result.ok ? '' : gitErrorText(result),
    };
  });
}

export async function pullRepos(
  repos: readonly NamedRepo[],
  maxParallel: number,
  hooks: BatchHooks = {},
): Promise<ReportRow[]> {
  return runRows(repos, maxParallel, hooks, async (repo) => {
    const before = (await readCurrentBranch(repo.path, { signal: hooks.signal })) ?? 'unknown';
    const result = await runGit(repo.path, ['pull', '--ff-only'], { signal: hooks.signal });
    const after = (await readCurrentBranch(repo.path, { signal: hooks.signal })) ?? before;
    hooks.log?.(result.ok ? `pull ${repo.name} ok` : `pull ${repo.name} failed: ${gitErrorText(result)}`);
    return {
      repo: repo.name,
      before,
      after,
      action: 'pull',
      result: result.ok ? 'ok' : 'failed',
      error: result.ok ? '' : gitErrorText(result),
    };
  });
}

export async function switchRepos(
  repos: readonly NamedRepo[],
  targetBranch: string,
  config: Pick<WgitConfig, 'maxParallel' | 'dirtyPolicy' | 'defaultRemote' | 'pullAfterSwitch'>,
  hooks: BatchHooks = {},
): Promise<ReportRow[]> {
  return runRows(repos, config.maxParallel, hooks, async (repo) => {
    const row = await switchOne({
      path: repo.path,
      name: repo.name,
      targetBranch,
      remote: config.defaultRemote,
      dirtyPolicy: config.dirtyPolicy,
      pullAfterSwitch: config.pullAfterSwitch,
      signal: hooks.signal,
    });
    const detail = row.error ? ` (${row.error})` : '';
    hooks.log?.(`${repo.name}: ${row.action} ${row.result}${detail}`);
    return row;
  });
}

async function runRows(
  repos: readonly NamedRepo[],
  maxParallel: number,
  hooks: BatchHooks,
  worker: (repo: NamedRepo) => Promise<ReportRow>,
): Promise<ReportRow[]> {
  let completed = 0;
  const rows = await mapPool(repos, maxParallel, async (repo) => {
    try {
      if (hooks.signal?.aborted) {
        return {
          repo: repo.name,
          before: 'unknown',
          after: 'unknown',
          action: 'error' as const,
          result: 'skipped' as const,
          error: 'cancelled',
        };
      }
      return await worker(repo);
    } catch (error) {
      return {
        repo: repo.name,
        before: 'unknown',
        after: 'unknown',
        action: 'error' as const,
        result: 'failed' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      completed += 1;
      hooks.onProgress?.(`${completed}/${repos.length}`);
    }
  });
  return [...rows].sort((left, right) => left.repo.localeCompare(right.repo));
}
