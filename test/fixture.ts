import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const env: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'WGit Test',
  GIT_AUTHOR_EMAIL: 'wgit-test@example.com',
  GIT_COMMITTER_NAME: 'WGit Test',
  GIT_COMMITTER_EMAIL: 'wgit-test@example.com',
  GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_NOSYSTEM: '1',
};

export function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wgit-'));
}

export function removeRoot(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

export function ensureIdentity(cwd: string): void {
  git(cwd, ['config', 'user.name', 'WGit Test']);
  git(cwd, ['config', 'user.email', 'wgit-test@example.com']);
}

export function commitFile(cwd: string, name: string, contents: string, message: string): void {
  fs.writeFileSync(path.join(cwd, name), contents);
  git(cwd, ['add', name]);
  git(cwd, ['commit', '-m', message]);
}

export function initBare(parent: string, name: string, branch: string): string {
  const dir = path.join(parent, name);
  git(parent, ['init', '--bare', '-b', branch, dir]);
  return dir;
}

export function cloneFrom(parent: string, origin: string, name: string): string {
  const dir = path.join(parent, name);
  git(parent, ['clone', origin, dir]);
  ensureIdentity(dir);
  return dir;
}

export function currentBranch(cwd: string): string {
  return git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
}

export function upstream(cwd: string): string {
  return git(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']).trim();
}

export function porcelain(cwd: string): string {
  return git(cwd, ['status', '--porcelain']);
}
