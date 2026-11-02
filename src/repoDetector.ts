import fs from 'node:fs/promises';
import path from 'node:path';
import { runGit } from './git';
import type { GitRunner, GitRunOptions, NamedRepo, RepoStatus } from './types';

const SKIP_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'vendor',
  'coverage',
  '.next',
  'target',
  '.venv',
  'venv',
  'bower_components',
]);

const DEFAULT_MAX_DEPTH = 5;

export async function discoverRepoPaths(
  roots: readonly string[],
  scanNested: boolean,
  maxDepth = DEFAULT_MAX_DEPTH,
): Promise<string[]> {
  const found = new Set<string>();
  for (const root of roots) {
    await walk(root, 0, scanNested, maxDepth, found);
  }
  return [...found].sort((left, right) => left.localeCompare(right));
}

export function assignRepoNames(repoPaths: readonly string[]): NamedRepo[] {
  const counts = new Map<string, number>();
  const bases = repoPaths.map((repoPath) => path.basename(repoPath));
  for (const base of bases) {
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  return repoPaths.map((repoPath, index) => {
    const base = bases[index] ?? path.basename(repoPath);
    if ((counts.get(base) ?? 0) < 2) {
      return { path: repoPath, name: base };
    }
    return { path: repoPath, name: `${base} (${path.basename(path.dirname(repoPath))})` };
  });
}

export async function loadRepoStatus(
  repoPath: string,
  name: string,
  remote: string,
  options: GitRunOptions = {},
  git: GitRunner = runGit,
): Promise<RepoStatus | undefined> {
  const branchResult = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'], options);
  if (!branchResult.ok) {
    return undefined;
  }
  const status = await git(repoPath, ['status', '--porcelain'], options);
  if (!status.ok) {
    return undefined;
  }
  const locals = await git(repoPath, ['for-each-ref', '--format=%(refname)', 'refs/heads'], options);
  const remotes = await git(repoPath, ['for-each-ref', '--format=%(refname)', `refs/remotes/${remote}`], options);
  const tracking = await git(repoPath, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], options);

  let ahead: number | null = null;
  let behind: number | null = null;
  if (tracking.ok) {
    const [behindText, aheadText] = tracking.stdout.trim().split(/\s+/);
    const behindCount = Number.parseInt(behindText ?? '', 10);
    const aheadCount = Number.parseInt(aheadText ?? '', 10);
    if (Number.isFinite(behindCount) && Number.isFinite(aheadCount)) {
      behind = behindCount;
      ahead = aheadCount;
    }
  }

  return {
    path: repoPath,
    name,
    branch: branchResult.stdout.trim() || 'HEAD',
    dirty: status.stdout.trim().length > 0,
    ahead,
    behind,
    localBranches: parseRefNames(locals.ok ? locals.stdout : '', 'refs/heads/'),
    remoteBranches: parseRefNames(remotes.ok ? remotes.stdout : '', `refs/remotes/${remote}/`).filter(
      (refName) => refName !== 'HEAD',
    ),
  };
}

export async function readCurrentBranch(
  repoPath: string,
  options: GitRunOptions = {},
  git: GitRunner = runGit,
): Promise<string | undefined> {
  const result = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'], options);
  if (!result.ok) {
    return undefined;
  }
  const branch = result.stdout.trim();
  return branch.length > 0 ? branch : undefined;
}

function parseRefNames(stdout: string, prefix: string): string[] {
  const names: string[] = [];
  for (const line of stdout.split('\n')) {
    const ref = line.trim();
    if (!ref.startsWith(prefix)) {
      continue;
    }
    const name = ref.slice(prefix.length);
    if (name.length > 0) {
      names.push(name);
    }
  }
  return names;
}

async function walk(
  dir: string,
  depth: number,
  scanNested: boolean,
  maxDepth: number,
  found: Set<string>,
): Promise<void> {
  let canonical: string;
  try {
    canonical = await fs.realpath(dir);
  } catch {
    return;
  }
  const stat = await fs.stat(canonical).catch(() => undefined);
  if (!stat?.isDirectory()) {
    return;
  }

  const repo = await isGitRepo(canonical);
  if (repo) {
    found.add(canonical);
  }
  if (!scanNested || depth >= maxDepth || (repo && depth > 0)) {
    return;
  }

  let entries: string[];
  try {
    entries = await fs.readdir(canonical);
  } catch {
    return;
  }
  const childMaxDepth = repo ? depth + 1 : maxDepth;
  for (const name of entries) {
    if (name.startsWith('.') || SKIP_DIRECTORIES.has(name)) {
      continue;
    }
    const child = path.join(canonical, name);
    const childStat = await fs.lstat(child).catch(() => undefined);
    if (!childStat?.isDirectory()) {
      continue;
    }
    await walk(child, depth + 1, scanNested, childMaxDepth, found);
  }
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.lstat(path.join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}
