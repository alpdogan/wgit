import { execFile } from 'node:child_process';
import type { GitResult, GitRunOptions, GitRunner } from './types';

const gitEnvironment: NodeJS.ProcessEnv = {
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'Never',
  LC_ALL: 'C',
};

export function runGit(cwd: string, args: readonly string[], options: GitRunOptions = {}): Promise<GitResult> {
  return new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve({ ok: false, code: 130, stdout: '', stderr: 'cancelled' });
      return;
    }

    const child = execFile(
      'git',
      [...args],
      {
        cwd,
        encoding: 'utf8',
        timeout: 180_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, ...gitEnvironment },
      },
      (error, stdout, stderr) => {
        resolve({
          ok: error == null,
          code: exitCode(error),
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
      },
    );

    const onAbort = (): void => {
      child.kill('SIGTERM');
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    child.on('close', () => {
      options.signal?.removeEventListener('abort', onAbort);
    });
  });
}

export const defaultGit: GitRunner = runGit;

function exitCode(error: { code?: string | number | null } | null): number {
  if (!error || typeof error.code !== 'number') {
    return error ? 1 : 0;
  }
  return error.code;
}

export function gitErrorText(result: GitResult): string {
  const text = [result.stderr, result.stdout]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed || `git exited with code ${result.code}`;
}

export function switchCommandMissing(result: GitResult): boolean {
  const text = `${result.stderr}\n${result.stdout}`;
  return text.includes('is not a git command');
}

export async function isValidBranchName(cwd: string, name: string, git: GitRunner = runGit): Promise<boolean> {
  if (name.length === 0 || name !== name.trim() || name.startsWith('-')) {
    return false;
  }
  const result = await git(cwd, ['check-ref-format', '--branch', name]);
  return result.ok;
}
