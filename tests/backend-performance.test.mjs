import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

import { jsonResponse } from '../functions/api/compression.ts';
import { ApiError } from '../functions/api/errors.ts';
import { createApiHandler } from '../functions/api/handler.ts';
import { createPublicListingCache } from '../functions/api/public-cache.ts';
import { createListingRepository } from '../functions/api/repository.ts';

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

const page = (id) => ({ listings: [{ id, saved: false }], nextCursor: null });
const request = (path = '/listings', headers = {}, method = 'GET') => new Request('https://api.example.invalid' + path, {
  method, headers,
  ...(method === 'POST' ? { body: JSON.stringify({
    requestId: 'performance-property', title: 'House near college', kind: 'House', locality: 'Bank Colony',
    town: 'raichur', price: 25000, mode: 'rent', audience: 'family', areaSqft: 1200, imageAsset: 'house',
  }) } : {}),
});
const largeBody = { listings: Array.from({ length: 20 }, (_, id) => ({ id, title: 'Family house near the college', locality: 'Bank Colony' })) };

test('JSON compression negotiates quality weights and round-trips the response', async () => {
  for (const [accept, selected] of [
    ['br, gzip', 'br'], ['br;q=0.2, gzip;q=0.8', 'gzip'], ['br;q=0, gzip', 'gzip'],
    ['br;q=0, *;q=0.5', 'gzip'], ['br;q=0, gzip;q=0, *;q=1', null],
    ['br;q=2, gzip;q=invalid', null], ['', null],
  ]) {
    const response = await jsonResponse(request('/listings', { 'Accept-Encoding': accept }), largeBody, 200, new Headers());
    assert.equal(response.headers.get('Content-Encoding'), selected, accept);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(Number(response.headers.get('Content-Length')), bytes.length);
    const decoded = selected === 'br' ? brotliDecompressSync(bytes) : selected === 'gzip' ? gunzipSync(bytes) : bytes;
    assert.deepEqual(JSON.parse(decoded.toString()), largeBody);
    assert.equal(response.headers.get('Vary'), 'Origin, Authorization, Accept-Encoding');
    if (selected) assert.ok(bytes.length < decoded.length);
  }
});

test('small JSON responses skip compression', async () => {
  const response = await jsonResponse(request('/me', { 'Accept-Encoding': 'br, gzip' }), { listed: 1, saved: 2 }, 200, new Headers());
  assert.equal(response.headers.get('Content-Encoding'), null);
  assert.deepEqual(await response.json(), { listed: 1, saved: 2 });
});

test('public ETags return empty 304 responses and vary by encoding', async () => {
  const headers = new Headers({ 'Cache-Control': 'public, max-age=0, s-maxage=30' });
  const gzip = await jsonResponse(request('/listings', { 'Accept-Encoding': 'gzip' }), largeBody, 200, headers);
  const tag = gzip.headers.get('ETag');
  assert.ok(tag);
  const br = await jsonResponse(request('/listings', { 'Accept-Encoding': 'br' }), largeBody, 200, headers);
  assert.notEqual(br.headers.get('ETag'), tag);
  for (const match of [tag, 'W/' + tag, '"other", ' + tag, '*']) {
    const response = await jsonResponse(request('/listings', { 'Accept-Encoding': 'gzip', 'If-None-Match': match }), largeBody, 200, headers);
    assert.equal(response.status, 304, match);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('Content-Length'), null);
  }
});

test('personal data and errors never receive public ETags', async () => {
  for (const status of [200, 401, 503]) {
    const response = await jsonResponse(request('/me'), largeBody, status, new Headers({ 'Cache-Control': 'no-store' }));
    assert.equal(response.headers.get('ETag'), null);
  }
});

test('anonymous listing cache shares concurrent reads and expires entries', async () => {
  let clock = 0, loads = 0;
  const cache = createPublicListingCache({ ttlMs: 30, now: () => clock });
  const response = deferred();
  const load = () => { loads += 1; return response.promise; };
  const reads = [cache.read('home', load), cache.read('home', load)];
  await Promise.resolve();
  assert.equal(loads, 1);
  response.resolve(page('first'));
  await Promise.all(reads);
  clock = 29;
  assert.deepEqual(await cache.read('home', load), page('first'));
  assert.equal(loads, 1);
  clock = 30;
  assert.deepEqual(await cache.read('home', async () => { loads += 1; return page('fresh'); }), page('fresh'));
  assert.equal(loads, 2);
});

test('cache bounds evict the least recently used entry', async () => {
  const cache = createPublicListingCache({ maxEntries: 2 });
  const counts = new Map();
  const read = (key) => cache.read(key, async () => { counts.set(key, (counts.get(key) ?? 0) + 1); return page(key); });
  await read('a');
  await read('b');
  await read('a');
  await read('c');
  await read('a');
  await read('b');
  assert.equal(counts.get('a'), 1);
  assert.equal(counts.get('b'), 2);
});

test('an invalidation during a read cannot repopulate the cache with an old page', async () => {
  const cache = createPublicListingCache();
  const old = deferred(), fresh = deferred();
  const oldRead = cache.read('home', () => old.promise);
  cache.invalidate();
  const freshRead = cache.read('home', () => fresh.promise);
  old.resolve(page('old'));
  assert.deepEqual(await oldRead, page('old'));
  fresh.resolve(page('fresh'));
  assert.deepEqual(await freshRead, page('fresh'));
  assert.deepEqual(await cache.read('home', () => { throw new Error('Fresh entry was lost.'); }), page('fresh'));
});

test('cache load failures can be retried', async () => {
  const cache = createPublicListingCache();
  await assert.rejects(cache.read('home', async () => { throw new Error('Database unavailable'); }), /Database unavailable/);
  assert.deepEqual(await cache.read('home', async () => page('recovered')), page('recovered'));
});

function handlerFixture() {
  const reads = [];
  const repository = {
    list: async (query, scope, userId) => { reads.push({ query, scope, userId }); return page(userId ?? 'anonymous'); },
    create: async () => ({ id: 'created' }),
    setSaved: async () => {}, counts: async () => ({ listed: 0, saved: 0 }), admitWrite: async () => true,
  };
  const handler = createApiHandler({ repository, identify: async (request) => request.headers.get('Authorization'), allowedOrigins: [] });
  return { handler, repository, reads };
}

test('only anonymous reads are cached; accounts and filters stay isolated', async () => {
  const { handler, reads } = handlerFixture();
  const first = await handler(request('/listings?q=House%20%20Raichur'));
  const duplicate = await handler(request('/listings?q=house%20raichur'));
  assert.deepEqual(await first.json(), await duplicate.json());
  assert.equal(reads.length, 1);
  assert.ok(first.headers.get('Cache-Control').startsWith('public'));
  await handler(request('/listings?town=manvi'));
  assert.equal(reads.length, 2);
  for (const userId of ['first-account', 'second-account', 'first-account']) {
    const response = await handler(request('/listings', { Authorization: userId }));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('ETag'), null);
    assert.equal((await response.json()).listings[0].id, userId);
  }
  assert.deepEqual(reads.slice(2).map((read) => read.userId), ['first-account', 'second-account', 'first-account']);
});

test('publishing invalidates anonymous cached reads and errors remain uncached', async () => {
  const { handler, repository, reads } = handlerFixture();
  await handler(request());
  assert.equal((await handler(request('/listings', { Authorization: 'owner', 'Content-Type': 'application/json' }, 'POST'))).status, 201);
  await handler(request());
  assert.equal(reads.length, 2);
  repository.list = async () => { throw new ApiError(503, 'Try again'); };
  const failed = await handler(request('/listings?town=manvi'));
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('Cache-Control'), 'no-store');
  repository.list = async () => page('retry');
  assert.equal((await (await handler(request('/listings?town=manvi'))).json()).listings[0].id, 'retry');
});

test('saving performs one atomic query and reports missing properties', async () => {
  const calls = [];
  let exists = true;
  const repository = createListingRepository({ query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: exists ? [{ id: 'property' }] : [], rowCount: exists ? 1 : 0 };
  } });
  await repository.setSaved('property', 'owner', true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, ['owner', 'property']);
  exists = false;
  await assert.rejects(repository.setSaved('missing', 'owner', true), { status: 404 });
  assert.equal(calls.length, 2);
  await repository.setSaved('property', 'owner', false);
  assert.equal(calls.length, 3);
});

test('search treats wildcard characters literally and never puts input into SQL', async () => {
  let query;
  const repository = createListingRepository({ query: async (sql, values) => { query = { sql, values }; return { rows: [] }; } });
  await repository.list({ q: 'H_%' + String.fromCharCode(92), limit: 20 }, 'listings', null);
  assert.equal(query.values[1], '%h' + '\\_' + '\\%' + '\\\\' + '%');
  assert.equal(query.values.at(-1), 21);
  assert.ok(query.sql.includes('l.search_text LIKE $2'));
  assert.equal(query.sql.includes('H_%'), false);
});

test('pagination fetches one extra row and retains microseconds in its cursor', async () => {
  const timestamp = '2026-11-17T10:00:00.123456Z';
  const base = {
    title: 'House near college', kind: 'House', locality: 'Bank Colony', town: 'raichur', price: 25000,
    mode: 'rent', audience: 'family', areaSqft: 1200, imageAsset: 'house', rating: 0, reviews: 0,
    saved: false, isSample: false, createdAt: new Date(timestamp), sortAt: timestamp,
  };
  const calls = [];
  const repository = createListingRepository({ query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: ['third', 'second', 'first'].map((id) => ({ ...base, id })) };
  } });
  const first = await repository.list({ limit: 2 }, 'listings', null);
  assert.deepEqual(first.listings.map((listing) => listing.id), ['third', 'second']);
  assert.deepEqual(JSON.parse(Buffer.from(first.nextCursor, 'base64url')), [timestamp, 'second']);
  await repository.list({ limit: 2, cursor: first.nextCursor }, 'listings', null);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].values, [null, timestamp, 'second', 3]);
});
