import * as vscode from 'vscode';
import { readConfig } from './config';
import { registerFetchAll } from './commands/fetchAll';
import { registerPullAll } from './commands/pullAll';
import { registerRefresh } from './commands/refresh';
import { registerShowStatus } from './commands/showStatus';
import { registerSwitchBranch } from './commands/switchBranch';
import type { CommandContext } from './commands/context';
import { createOutputLogger } from './logger';
import { mapPool } from './pool';
import { assignRepoNames, discoverRepoPaths, loadRepoStatus } from './repoDetector';
import type { RepoStatus, WgitConfig } from './types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const log = createOutputLogger();
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'wgit.showStatus';
  statusBar.text = 'WGit: 0';
  statusBar.tooltip = 'Show WGit status';
  statusBar.show();

  let repos: RepoStatus[] = [];

  const getConfig = (): WgitConfig => {
    const configuration = vscode.workspace.getConfiguration('wgit');
    return readConfig({
      maxParallel: configuration.get('maxParallel'),
      fetchBeforeSwitch: configuration.get('fetchBeforeSwitch'),
      pullAfterSwitch: configuration.get('pullAfterSwitch'),
      dirtyPolicy: configuration.get('dirtyPolicy'),
      scanNestedRepos: configuration.get('scanNestedRepos'),
      defaultRemote: configuration.get('defaultRemote'),
    });
  };

  const setRepos = (next: RepoStatus[]): void => {
    repos = [...next].sort((left, right) => left.name.localeCompare(right.name));
    statusBar.text = `WGit: ${repos.length}`;
    statusBar.tooltip =
      repos.length === 0
        ? 'WGit: no repositories'
        : repos.map((repo) => `${repo.name} (${repo.branch}${repo.dirty ? ', dirty' : ''})`).join('\n');
  };

  const scan = async (): Promise<RepoStatus[]> => {
    const config = getConfig();
    const folders = vscode.workspace.workspaceFolders ?? [];
    const paths = await discoverRepoPaths(
      folders.map((folder) => folder.uri.fsPath),
      config.scanNestedRepos,
    );
    const named = assignRepoNames(paths);
    const loaded = await mapPool(named, config.maxParallel, async (repo) => {
      const status = await loadRepoStatus(repo.path, repo.name, config.defaultRemote);
      if (!status) {
        log.warn(`Unreadable repository: ${repo.path}`);
      }
      return status;
    });
    return loaded.filter((status): status is RepoStatus => status != null);
  };

  const commandContext: CommandContext = { log, getConfig, scan, setRepos };

  context.subscriptions.push(
    log,
    statusBar,
    registerSwitchBranch(commandContext),
    registerPullAll(commandContext),
    registerFetchAll(commandContext),
    registerShowStatus(commandContext),
    registerRefresh(commandContext),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void scan()
        .then(setRepos)
        .catch((error: unknown) => {
          statusBar.text = 'WGit: !';
          log.error(error instanceof Error ? error.message : String(error));
        });
    }),
  );

  try {
    setRepos(await scan());
    log.info(`Detected ${repos.length} ${repos.length === 1 ? 'repository' : 'repositories'}.`);
  } catch (error) {
    statusBar.text = 'WGit: !';
    log.error(error instanceof Error ? error.message : String(error));
  }
}

export function deactivate(): void {
  // Command and UI subscriptions are disposed by the extension context.
}
