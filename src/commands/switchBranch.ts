import * as vscode from 'vscode';
import { fetchRepos, switchRepos } from '../batch';
import { isValidBranchName } from '../git';
import { countPlans, formatSwitchPrompt, planSwitch } from '../planner';
import { mergeFetchErrors } from '../report';
import type { DirtyPolicy, ReportRow, RepoStatus } from '../types';
import type { CommandContext } from './context';
import { pickBranch, showReport, withGitProgress } from './ui';

export function registerSwitchBranch(context: CommandContext): vscode.Disposable {
  return vscode.commands.registerCommand('wgit.switchBranch', () => switchBranchCommand(context));
}

export async function switchBranchCommand(context: CommandContext): Promise<void> {
  const config = context.getConfig();
  let repos = await context.scan();
  context.setRepos(repos);
  if (repos.length === 0) {
    vscode.window.showWarningMessage('WGit found no Git repositories in this workspace.');
    return;
  }

  const branch = await pickBranch(repos);
  if (!branch) {
    return;
  }
  const sample = repos[0];
  if (!sample || !(await isValidBranchName(sample.path, branch))) {
    vscode.window.showErrorMessage(`WGit: "${branch}" is not a valid branch name.`);
    return;
  }

  const prepared = await withGitProgress(`WG: Prepare ${branch}`, async (report, signal) => {
    let fetchRows: ReportRow[] = [];
    if (config.fetchBeforeSwitch) {
      report('fetching');
      fetchRows = await fetchRepos(repos, config.defaultRemote, config.maxParallel, {
        signal,
        onProgress: report,
        log: (line) => context.log.info(line),
      });
      if (signal.aborted) {
        return undefined;
      }
      repos = await context.scan();
      context.setRepos(repos);
    }
    const plans = repos.map((repo) => planFor(repo, branch, config.defaultRemote, config.dirtyPolicy));
    return { fetchRows, plans, repos };
  });

  if (!prepared) {
    context.log.info('Switch cancelled.');
    return;
  }

  const counts = countPlans(prepared.plans);
  const prompt = formatSwitchPrompt(branch, config.defaultRemote, counts, config.pullAfterSwitch);
  context.log.info(prompt);
  const choice = await vscode.window.showInformationMessage(prompt, { modal: true }, 'Continue');
  if (choice !== 'Continue') {
    context.log.info('Switch cancelled before any branch change.');
    return;
  }

  const rows = await withGitProgress(`WG: Switch to ${branch}`, async (report, signal) => {
    const switched = await switchRepos(prepared.repos, branch, config, {
      signal,
      onProgress: report,
      log: (line) => context.log.info(line),
    });
    return mergeFetchErrors(prepared.fetchRows, switched);
  });
  await showReport(context.log, `Switch to ${branch}`, rows);
  context.setRepos(await context.scan());
}

function planFor(repo: RepoStatus, targetBranch: string, remote: string, dirtyPolicy: DirtyPolicy) {
  return planSwitch({
    currentBranch: repo.branch,
    dirty: repo.dirty,
    localBranches: repo.localBranches,
    remoteBranches: repo.remoteBranches,
    targetBranch,
    remote,
    dirtyPolicy,
  });
}
