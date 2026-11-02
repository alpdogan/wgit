import * as vscode from 'vscode';
import { formatStatus } from '../report';
import type { CommandContext } from './context';

export function registerShowStatus(context: CommandContext): vscode.Disposable {
  return vscode.commands.registerCommand('wgit.showStatus', () => showStatusCommand(context));
}

export async function showStatusCommand(context: CommandContext): Promise<void> {
  const repos = await context.scan();
  context.setRepos(repos);
  context.log.info('Status');
  context.log.info(repos.length === 0 ? 'No Git repositories detected.' : formatStatus(repos));
  const message =
    repos.length === 0 ? 'WGit: no repositories in this workspace.' : `WGit: ${repos.length} repositories`;
  const choice = await vscode.window.showInformationMessage(message, 'Show Details');
  if (choice === 'Show Details') {
    context.log.show();
  }
}
