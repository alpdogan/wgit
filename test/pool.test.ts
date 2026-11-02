import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapPool } from '../src/pool';

describe('mapPool', () => {
  it('caps how many workers run at once', async () => {
    let current = 0;
    let peak = 0;
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (item) => {
      current += 1;
      peak = Math.max(peak, current);
      await new Promise((resolve) => setTimeout(resolve, 20));
      current -= 1;
      return item * 10;
    });
    assert.equal(peak, 2);
    assert.deepEqual(results, [10, 20, 30, 40, 50]);
  });

  it('returns an empty list for no work', async () => {
    assert.deepEqual(await mapPool([], 4, async (item: number) => item), []);
  });
});
