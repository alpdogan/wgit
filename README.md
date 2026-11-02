# WGit

Fast multi-root Git sync. Switch, fetch, and pull across every repository in the workspace.

WGit is a VS Code and Cursor extension. You type `wg sb` and every repo moves to the branch you picked. A repo that only has `origin/dev` gets a local `dev` that tracks it. A repo that cannot move is skipped, with a reason, and the rest of the batch still runs.

```
repo                     | before | after  | action                       | result  | error
already-on               | dev    | dev    | already-on                   | ok      |
admin-panel-auth-service | master | dev    | create-track                 | ok      |
no-dev                   | master | master | skip: missing-remote-branch | skipped |
dirty-repo               | master | master | skip: dirty                  | skipped |
```

## Why

Multi-root workspaces drift. Most repos sit on `dev`. One of them, `admin-panel-auth-service`, is still on `master`. `origin/dev` exists. There is no local `dev`. “Switch all to dev” should create that tracking branch. It should not leave the repo on `master` and hide the reason in a toast.

WGit plans the operation before it changes any branch, then prints one row per repository.

## Commands

Command Palette titles are exact, so fuzzy search can use the short code.

| Command id | Title | Type to run |
| --- | --- | --- |
| `wgit.switchBranch` | `WG: Switch Branch (sb)` | `wg sb` |
| `wgit.pullAll` | `WG: Pull All (pa)` | `wg pa` |
| `wgit.fetchAll` | `WG: Fetch All (fa)` | `wg fa` |
| `wgit.showStatus` | `WG: Status (st)` | `wg st` |
| `wgit.refresh` | `WG: Refresh (rf)` | `wg rf` |

The status bar shows `WGit: N`, where `N` is the number of repositories WGit can see. Click it to run Status. Logs and report tables go to the **WGit** output channel. Choose **Show Details** on the summary notification to open that channel.

Push-all is not in this version.

## How switch works

For a target branch `X` and the default remote (`origin` unless you change it):

1. Fetch that remote when `wgit.fetchBeforeSwitch` is on.
2. Show a confirmation with the counts: already on `X`, switch to a local branch, create a tracking branch, skip dirty, skip missing.
3. For each repository, independently:
   - Already on `X`: leave the branch as it is (`already-on`).
   - Local `X` exists: `git switch X`.
   - `origin/X` exists: `git switch -c X --track origin/X`.
   - Neither exists: skip with `missing-remote-branch`.
   - The tree is dirty and the checkout would move: `skip` (default), `stash`, or `fail`, according to `wgit.dirtyPolicy`.
4. When the repository is on `X` and `wgit.pullAfterSwitch` is on, run `git pull --ff-only`.
5. Print the report. A pull or stash-pop failure is that repository’s failure. Other repositories are unchanged by it.

Running the switch again is safe. Repositories that landed on `X` report `already-on`.

Dirty means `git status --porcelain` is not empty, including untracked files. A dirty tree does not block a repository that is already on the target. If the target branch does not exist at all, the reason is `missing-remote-branch` even when the tree is also dirty.

`git switch` is preferred. On a Git that has no `switch` command, WGit falls back to `git checkout`. It does not use `checkout -B` when `switch` exists, because `-B` can move a branch that is already there.

## Settings

```jsonc
{
  "wgit.maxParallel": 5,
  "wgit.fetchBeforeSwitch": true,
  "wgit.pullAfterSwitch": true,
  "wgit.dirtyPolicy": "skip",
  "wgit.scanNestedRepos": true,
  "wgit.defaultRemote": "origin"
}
```

`wgit.dirtyPolicy` is `skip`, `stash`, or `fail`.

`wgit.scanNestedRepos` looks through a workspace folder that is not itself a repository (up to five levels, skipping `node_modules` and other heavy directories). A workspace folder that is a repository is always included. Nested scan then checks only that folder’s immediate children, so a monorepo is not walked file by file.

WGit does not activate in an untrusted workspace, and it does not run in virtual workspaces. Git has to be on `PATH`. Fetch and pull use `GIT_TERMINAL_PROMPT=0`, so a missing credential fails that repository instead of hanging the batch on a prompt.

## Install from GitHub

Download [`wgit-0.1.0.vsix`](https://github.com/alpdogan/wgit/releases/download/v0.1.0/wgit-0.1.0.vsix) from the [v0.1.0 release](https://github.com/alpdogan/wgit/releases/tag/v0.1.0). That file is attached when the `v0.1.0` tag is pushed. GitHub Actions runs the tests, builds the VSIX, and publishes the release.

In Cursor or VS Code:

1. Open the Command Palette.
2. Run **Extensions: Install from VSIX...**.
3. Choose the downloaded `wgit-0.1.0.vsix`.
4. Reload the window when the editor asks.
5. Open a multi-root workspace, then run **WG: Status (st)** or type `wg st`.

Trust the workspace when asked. The status bar should show `WGit: N` for the repositories it found.

To build the same file yourself:

```bash
git clone https://github.com/alpdogan/wgit.git
cd wgit
npm install
npm run package
```

`npm run package` writes `wgit-0.1.0.vsix` in this directory. WGit targets VS Code and Cursor (`engines.vscode` `^1.85.0`).

### Open VSX, then Marketplace

Publishing is manual. Create an [Open VSX](https://open-vsx.org/) access token and, only when you intend to publish:

```bash
npx @vscode/vsce package
npx ovsx publish wgit-0.1.0.vsix
```

Visual Studio Marketplace is optional after Open VSX. Use a Marketplace personal access token with `vsce publish`. Do not commit tokens. The publisher id in `package.json` is `alpdogan`, so the extension id is `alpdogan.wgit`.

## Acceptance checklist

`npm test` builds a temporary multi-root fixture and checks the Git outcomes below. The VSIX step is the editor check.

In a multi-root workspace:

1. Most repositories are already on `dev`. They stay on `dev` and the report says `already-on`. If they are behind the remote and pull-after-switch is on, `git pull --ff-only` updates them.
2. One repository is on `master`, has `origin/dev`, and has no local `dev`. It ends on `dev` tracking `origin/dev` (`create-track`).
3. One repository has no `dev` locally or on the remote. It is skipped with `missing-remote-branch` and stays on its current branch.
4. One dirty repository that would have to move is skipped with `dirty` under the default policy. Its uncommitted changes stay in the working tree.
5. The final report lists every repository, with a reason on each row.
6. In Cursor, **Extensions: Install from VSIX** installs the package, and the commands appear as `WG: …`.

## This is not the wgit CLI

[ericsonj/wgit](https://github.com/ericsonj/wgit) is a separate command-line tool for using several Git accounts. This repository is an editor extension for syncing the repositories open in one workspace. The names collide. The projects do not.

## Inspiration

Workspace-wide Git commands are the idea behind [Multi-Repo Manager](https://github.com/aiyogg/multi-repo-manager) (MIT, published as Chuck-Studio.multi-repo-manager). WGit does not reuse that extension id, publisher, or branding. The switch path here is written for the remote-only branch case: create the local tracking branch, keep going when one repo fails, and show the plan and the report.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
npm install
npm test
npm run typecheck
npm run compile
```

Launch **Run WGit** from the editor to try the extension host.

## License

[MIT](LICENSE) © 2026 alpdogan

[Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)
