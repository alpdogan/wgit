import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

interface PackageJson {
  name: string;
  displayName: string;
  publisher: string;
  license: string;
  version: string;
  icon: string;
  main: string;
  engines: { vscode: string };
  contributes: {
    commands: Array<{ command: string; title: string }>;
  };
}

const EXPECTED_COMMANDS: ReadonlyArray<readonly [string, string]> = [
  ['wgit.switchBranch', 'WG: Switch Branch (sb)'],
  ['wgit.pullAll', 'WG: Pull All (pa)'],
  ['wgit.fetchAll', 'WG: Fetch All (fa)'],
  ['wgit.showStatus', 'WG: Status (st)'],
  ['wgit.refresh', 'WG: Refresh (rf)'],
];

describe('extension manifest', () => {
  it('exposes the command titles used by the command palette', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as PackageJson;
    assert.equal(manifest.name, 'wgit');
    assert.equal(manifest.displayName, 'WGit');
    assert.equal(manifest.publisher, 'alpdogan');
    assert.equal(manifest.license, 'MIT');
    assert.equal(manifest.version, '0.1.1');
    assert.equal(manifest.icon, 'images/icon.png');
    assert.equal(fs.existsSync(path.join(process.cwd(), manifest.icon)), true);
    assert.equal(manifest.main, './out/extension.js');
    assert.equal(manifest.engines.vscode, '^1.85.0');
    assert.deepEqual(
      manifest.contributes.commands.map((command) => [command.command, command.title]),
      EXPECTED_COMMANDS,
    );
  });
});
