# Contributing to WGit

Thanks for helping WGit get branch switches right. This document is the contributor guide. Product behavior lives in `README.md`.

## Ground rules

- Be kind. The [Code of Conduct](CODE_OF_CONDUCT.md) applies to issues, pull requests, and discussions.
- Report security problems privately. See [SECURITY.md](SECURITY.md).
- Keep pull requests focused. A switch-planner fix and a documentation rewrite should be two changes.
- Write in English in the repository: code, comments, docs, and issues.

## Setup

Requirements: Node.js 20 or newer, npm, and Git 2.23 or newer (`git switch`).

```bash
git clone https://github.com/alpdogan/wgit.git
cd wgit
npm install
npm test
npm run typecheck
npm run compile
```

`npm test` runs the planner unit tests and a real Git fixture for the acceptance cases. `npm run compile` writes the extension to `out/`.

In VS Code or Cursor, open this folder and start the **Run WGit** launch configuration. That compiles the extension and opens an Extension Development Host.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Add or update tests for behavior changes. Planner changes belong in `test/planner.test.ts`. Git outcomes belong in `test/acceptance.test.ts`.
3. Run `npm test` and `npm run typecheck`.
4. Update `CHANGELOG.md` under the next version when the change is user-visible.
5. Open a pull request that explains the behavior, not only the diff.

## Design constraints

- Spawn Git with `execFile` and an argument array. Do not build shell strings.
- A failure in one repository must not cancel the others.
- Prefer `git switch`. Fall back to `git checkout` only when `git switch` is not a command. Do not use `checkout -B` when `git switch` exists and the failure is something else: `-B` can move an existing branch.
- The switch decision is `planSwitch` in `src/planner.ts`. Keep that function free of VS Code and of process execution so it can be tested on its own.

## Publishing

Publishing is manual. Do not add tokens to the repository.

```bash
npm run package
```

That produces `wgit-<version>.vsix`. Open VSX is the first registry we care about; Visual Studio Marketplace is optional after that. See the install section in `README.md`.
