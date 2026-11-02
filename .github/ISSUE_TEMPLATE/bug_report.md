---
name: Bug report
about: A repository was left on the wrong branch, or a command did not match its report
title: ''
labels: bug
---

## What happened

## What you expected

## Workspace layout

- How many repositories, and which command (`wg sb`, `wg pa`, `wg fa`, `wg st`, `wg rf`)
- Target branch
- `wgit.dirtyPolicy`, `wgit.defaultRemote`, `wgit.fetchBeforeSwitch`, `wgit.pullAfterSwitch`
- For the repository that misbehaved: branch before, whether `origin/<branch>` existed, and whether the tree was dirty

## Report table

Paste the WGit output channel table (`repo | before | after | action | result | error`). Remove remote URLs and secrets.

## Environment

- WGit version
- VS Code or Cursor version
- Operating system
- `git --version`
