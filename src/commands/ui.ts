import * as vscode from 'vscode';
import { collectBranchChoices } from '../branches';
import type { Log } from '../logger';
import { formatReport, summarizeResults } from '../report';
import type { ReportRow, RepoStatus } from '../types';

interface BranchItem extends vscode.QuickPickItem {
  branch?: string;
}

export async function pickBranch(repos: readonly RepoStatus[]): Promise<string | undefined> {
  const choices = collectBranchChoices(repos);
  const baseItems = toBranchItems(choices);
  const quickPick = vscode.window.createQuickPick<BranchItem>();
  quickPick.title = 'WG: Switch Branch';
  quickPick.placeholder = 'Select a branch, or type one (dev)';
  quickPick.matchOnDescription = true;
  quickPick.ignoreFocusOut = true;
  (quickPick as vscode.QuickPick<BranchItem> & { sortByLabel?: boolean }).sortByLabel = false;
  quickPick.items = baseItems;

  quickPick.onDidChangeValue((value) => {
    const typed = value.trim();
    const known = [...choices.local, ...choices.remoteOnly].some((choice) => choice.name === typed);
    if (typed.length === 0 || known) {
      quickPick.items = baseItems;
      return;
    }
    const custom: BranchItem = {
      label: typed,
      description: 'Switch to this branch name',
      branch: typed,
      alwaysShow: true,
    };
    quickPick.items = [custom, ...baseItems];
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (branch: string | undefined): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(branch);
    };
    quickPick.onDidAccept(() => {
      finish(quickPick.selectedItems[0]?.branch);
      quickPick.hide();
    });
    quickPick.onDidHide(() => {
      finish(undefined);
      quickPick.dispose();
    });
    quickPick.show();
  });
}

export async function withGitProgress<T>(
  title: string,
  body: (report: (message: string) => void, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: true,
    },
    async (progress, token) => {
      const controller = new AbortController();
      const subscription = token.onCancellationRequested(() => controller.abort());
      try {
        return await body((message) => progress.report({ message }), controller.signal);
      } finally {
        subscription.dispose();
      }
    },
  );
}

export async function showReport(log: Log, title: string, rows: readonly ReportRow[]): Promise<void> {
  log.info(title);
  log.info(formatReport(rows));
  const summary = summarizeResults(rows);
  const message = `WGit ${title}: ${summary.ok} ok, ${summary.skipped} skipped, ${summary.failed} failed`;
  const showDetails = 'Show Details';
  const choice =
    summary.failed > 0
      ? await vscode.window.showWarningMessage(message, showDetails)
      : await vscode.window.showInformationMessage(message, showDetails);
  if (choice === showDetails) {
    log.show();
  }
}

function toBranchItems(choices: ReturnType<typeof collectBranchChoices>): BranchItem[] {
  const items: BranchItem[] = [];
  if (choices.local.length > 0) {
    items.push({ label: 'Local branches', kind: vscode.QuickPickItemKind.Separator });
    for (const choice of choices.local) {
      items.push({
        label: `$(git-branch) ${choice.name}`,
        description: `${choice.repos} ${choice.repos === 1 ? 'repo' : 'repos'}`,
        branch: choice.name,
      });
    }
  }
  if (choices.remoteOnly.length > 0) {
    items.push({ label: 'Remote branches', kind: vscode.QuickPickItemKind.Separator });
    for (const choice of choices.remoteOnly) {
      items.push({
        label: `$(cloud) ${choice.name}`,
        description: `${choice.repos} ${choice.repos === 1 ? 'repo' : 'repos'}`,
        branch: choice.name,
      });
    }
  }
  return items;
}
