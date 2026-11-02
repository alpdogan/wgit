# Changelog

All notable changes to WGit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-02

### Added

- Switch, fetch, and pull across every Git repository in a multi-root workspace.
- Switch planner that creates a local branch tracking the default remote when that branch exists only on the remote.
- Confirmation prompt with counts for already-on, switch, create-track, skip, and fail.
- Final report table: `repo | before | after | action | result | error`.
- Dirty working tree policy: `skip` (default), `stash`, or `fail`. One repository never aborts the batch.
- Status bar item `WGit: N` and an output channel named `WGit`.
- Commands `WG: Switch Branch (sb)`, `WG: Pull All (pa)`, `WG: Fetch All (fa)`, `WG: Status (st)`, and `WG: Refresh (rf)`.

[0.1.0]: https://github.com/alpdogan/wgit/releases/tag/v0.1.0
