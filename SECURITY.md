# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

Please report vulnerabilities privately. Do not open a public issue for a security problem.

Use a GitHub private vulnerability report:

https://github.com/alpdogan/wgit/security/advisories/new

Include what you were doing, the extension version, the VS Code or Cursor version, and a repository layout that reproduces the issue if you can share one without secrets.

WGit runs `git` with an argument list in your workspace. It does not send repository contents to a WGit server. A report is still sensitive when it includes paths, remote URLs, or command output. Redact tokens, passwords, and private remotes before you attach logs.

## What to expect

The maintainer will acknowledge a report and follow up on the same advisory. Fixes for supported versions are released as a new version and mentioned in `CHANGELOG.md`.
