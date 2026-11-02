import * as vscode from 'vscode';
import { fetchRepos } from '../batch';
import type { CommandContext } from './context';
import { showReport, withGitProgress } from './ui';

export function registerFetchAll(context: CommandContext): vscode.Disposable {
  return vscode.commands.registerCommand('wgit.fetchAll', () => fetchAllCommand(context));
}

export async function fetchAllCommand(context: CommandContext): Promise<void> {
  const config = context.getConfig();
  const repos = await context.scan();
  context.setRepos(repos);
  if (repos.length === 0) {
    vscode.window.showWarningMessage('WGit found no Git repositories in this workspace.');
    return;
  }
  const rows = await withGitProgress('WG: Fetch All', async (report, signal) =>
    fetchRepos(repos, config.defaultRemote, config.maxParallel, {
      signal,
      onProgress: report,
      log: (line) => context.log.info(line),
    }),
  );
  await showReport(context.log, 'Fetch', rows);
}
