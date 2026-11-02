import * as vscode from 'vscode';
import { pullRepos } from '../batch';
import type { CommandContext } from './context';
import { showReport, withGitProgress } from './ui';

export function registerPullAll(context: CommandContext): vscode.Disposable {
  return vscode.commands.registerCommand('wgit.pullAll', () => pullAllCommand(context));
}

export async function pullAllCommand(context: CommandContext): Promise<void> {
  const config = context.getConfig();
  const repos = await context.scan();
  context.setRepos(repos);
  if (repos.length === 0) {
    vscode.window.showWarningMessage('WGit found no Git repositories in this workspace.');
    return;
  }
  const rows = await withGitProgress('WG: Pull All', async (report, signal) =>
    pullRepos(repos, config.maxParallel, {
      signal,
      onProgress: report,
      log: (line) => context.log.info(line),
    }),
  );
  await showReport(context.log, 'Pull', rows);
  context.setRepos(await context.scan());
}
