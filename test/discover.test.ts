import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { assignRepoNames, discoverRepoPaths } from '../src/repoDetector';
import { git, removeRoot, tempRoot } from './fixture';

describe('discoverRepoPaths', () => {
  it('finds nested repositories and skips dependency directories', async () => {
    const root = tempRoot();
    try {
      const repoA = path.join(root, 'repo-a');
      const repoB = path.join(root, 'group', 'repo-b');
      const ignored = path.join(root, 'node_modules', 'pkg');
      const inside = path.join(repoA, 'nested');
      for (const dir of [repoA, repoB, ignored, inside]) {
        fs.mkdirSync(dir, { recursive: true });
        git(root, ['init', '-b', 'master', dir]);
      }

      const nested = await discoverRepoPaths([root], true);
      assert.deepEqual(nested.map((repo) => path.relative(root, repo)).sort(), ['group/repo-b', 'repo-a'].sort());

      const shallow = await discoverRepoPaths([root], false);
      assert.deepEqual(shallow, []);

      const onlyRoot = await discoverRepoPaths([repoA], false);
      assert.deepEqual(onlyRoot, [fs.realpathSync(repoA)]);

      const rootPlusChild = await discoverRepoPaths([repoA], true);
      assert.deepEqual(rootPlusChild.map((repo) => path.relative(root, repo)).sort(), ['repo-a', 'repo-a/nested'].sort());
    } finally {
      removeRoot(root);
    }
  });

  it('disambiguates repositories that share a folder name', () => {
    const named = assignRepoNames(['/work/left/api', '/work/right/api', '/work/web']);
    assert.deepEqual(
      named.map((repo) => repo.name),
      ['api (left)', 'api (right)', 'web'],
    );
  });
});
