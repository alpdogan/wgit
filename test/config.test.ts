import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readConfig } from '../src/config';

describe('readConfig', () => {
  it('uses the documented defaults', () => {
    assert.deepEqual(readConfig({}), {
      maxParallel: 5,
      fetchBeforeSwitch: true,
      pullAfterSwitch: true,
      dirtyPolicy: 'skip',
      scanNestedRepos: true,
      defaultRemote: 'origin',
    });
  });

  it('rejects parallel values that are missing, tiny, or huge', () => {
    assert.equal(readConfig({ maxParallel: 0 }).maxParallel, 5);
    assert.equal(readConfig({ maxParallel: 2.8 }).maxParallel, 2);
    assert.equal(readConfig({ maxParallel: 100 }).maxParallel, 32);
  });

  it('falls back when policy or remote is not usable', () => {
    assert.equal(readConfig({ dirtyPolicy: 'reset' }).dirtyPolicy, 'skip');
    assert.equal(readConfig({ dirtyPolicy: 'stash' }).dirtyPolicy, 'stash');
    assert.equal(readConfig({ defaultRemote: '  ' }).defaultRemote, 'origin');
    assert.equal(readConfig({ defaultRemote: 'up stream' }).defaultRemote, 'origin');
    assert.equal(readConfig({ defaultRemote: '--upload-pack=evil' }).defaultRemote, 'origin');
    assert.equal(readConfig({ defaultRemote: 'origin/../other' }).defaultRemote, 'origin');
    assert.equal(readConfig({ defaultRemote: 'upstream' }).defaultRemote, 'upstream');
    assert.equal(readConfig({ fetchBeforeSwitch: 'yes' }).fetchBeforeSwitch, true);
    assert.equal(readConfig({ scanNestedRepos: false }).scanNestedRepos, false);
  });
});
