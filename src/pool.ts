export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results = new Array<R>(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: width }, () => run()));
  return results;
}
