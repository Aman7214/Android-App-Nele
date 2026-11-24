import type { ListingPage } from '../../shared/listings.ts';

export function createPublicListingCache({ ttlMs = 30_000, maxEntries = 100, now = Date.now } = {}) {
  const cached = new Map<string, { expires: number; page: ListingPage }>();
  const pending = new Map<string, Promise<ListingPage>>();
  let generation = 0;
  return {
    async read(key: string, load: () => Promise<ListingPage>): Promise<ListingPage> {
      const hit = cached.get(key);
      if (hit && hit.expires > now()) {
        cached.delete(key);
        cached.set(key, hit);
        return hit.page;
      }
      if (hit) cached.delete(key);
      const started = generation;
      const sharedKey = `${generation}:${key}`;
      const existing = pending.get(sharedKey);
      if (existing) return existing;
      const promise = Promise.resolve().then(load).then((page) => {
        if (started === generation) {
          cached.set(key, { page, expires: now() + ttlMs });
          while (cached.size > maxEntries) cached.delete(cached.keys().next().value!);
        }
        return page;
      });
      pending.set(sharedKey, promise);
      const cleanup = () => { pending.delete(sharedKey); };
      void promise.then(cleanup, cleanup);
      return promise;
    },
    invalidate() { generation += 1; cached.clear(); },
  };
}
