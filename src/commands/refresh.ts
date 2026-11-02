import * as vscode from 'vscode';
import type { CommandContext } from './context';

export function registerRefresh(context: CommandContext): vscode.Disposable {
  return vscode.commands.registerCommand('wgit.refresh', () => refreshCommand(context));
}

export async function refreshCommand(context: CommandContext): Promise<void> {
  const repos = await context.scan();
  context.setRepos(repos);
  const message = `Refreshed. ${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'}.`;
  context.log.info(message);
  vscode.window.setStatusBarMessage(`WGit: ${message}`, 4000);
}
