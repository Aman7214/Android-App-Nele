import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';

import { createIdentityVerifier } from '../functions/api/auth.ts';
import { createApiHandler } from '../functions/api/handler.ts';
import { setSavedFlag } from '../src/utils/property-cache.ts';

const owner = '00000000-0000-4000-8000-000000000001';
const input = {
  requestId: 'request-123456', title: 'Family house near college', kind: 'House',
  locality: 'Bank Colony', town: 'raichur', price: 25000, mode: 'rent', audience: 'family',
  beds: 2, baths: 1, areaSqft: 1200, imageAsset: 'house',
};
const record = { ...input, id: 'property-1', rating: 0, reviews: 0, createdAt: '2026-11-17T10:00:00.123456Z', saved: false, isSample: false };

function fixture(userId = null) {
  const calls = [];
  const repository = {
    list: async (...args) => { calls.push(['list', ...args]); return { listings: [record], nextCursor: null }; },
    create: async (...args) => { calls.push(['create', ...args]); return record; },
    setSaved: async (...args) => { calls.push(['setSaved', ...args]); },
    counts: async (...args) => { calls.push(['counts', ...args]); return { listed: 1, saved: 0 }; },
    admitWrite: async (...args) => { calls.push(['admitWrite', ...args]); return true; },
  };
  const handler = createApiHandler({ repository, identify: async () => userId, allowedOrigins: ['http://localhost:8081'] });
  return { handler, calls, repository };
}

const request = (path, method = 'GET', body, headers = {}) => new Request(`https://api.example.test${path}`, {
  method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('public browsing works without an account and applies validated server filters', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('/listings?town=raichur&kind=House&limit=10&q=family'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).listings.length, 1);
  assert.equal(calls[0][1].town, 'raichur');
  assert.equal(calls[0][1].limit, 10);
  assert.equal(calls[0][3], null);
});

test('personal reads and writes reject anonymous callers before using the database', async () => {
  for (const [path, method, body] of [
    ['/mine', 'GET'], ['/saved', 'GET'], ['/me', 'GET'],
    ['/listings', 'POST', input], ['/saved/property-1', 'PUT'], ['/saved/property-1', 'DELETE'],
  ]) {
    const { handler, calls } = fixture();
    const response = await handler(request(path, method, body));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.equal(calls.length, 0);
  }
});

test('creation and saved mutations take ownership from the verified caller', async () => {
  const { handler, calls } = fixture(owner);
  assert.equal((await handler(request('/listings', 'POST', input))).status, 201);
  assert.equal(calls.find((call) => call[0] === 'create')[2], owner);
  assert.equal((await handler(request('/saved/property-1', 'PUT'))).status, 200);
  assert.deepEqual(calls.find((call) => call[0] === 'setSaved'), ['setSaved', 'property-1', owner, true]);
});

test('a client cannot inject an owner, rating or database ID when posting', async () => {
  for (const extra of [{ ownerId: 'another-user' }, { rating: 5 }, { id: 'somebody-elses-property' }]) {
    const { handler, calls } = fixture(owner);
    const response = await handler(request('/listings', 'POST', { ...input, ...extra }));
    assert.equal(response.status, 400);
    assert.equal(calls.some((call) => call[0] === 'create'), false);
  }
});

test('invalid prices, areas and incompatible rental audiences cannot be posted', async () => {
  for (const extra of [{ price: -1 }, { areaSqft: 0 }, { audience: undefined }, { mode: 'sale', audience: 'family' }]) {
    const { handler, calls } = fixture(owner);
    assert.equal((await handler(request('/listings', 'POST', { ...input, ...extra }))).status, 400);
    assert.equal(calls.some((call) => call[0] === 'create'), false);
  }
});

test('oversized and non-JSON bodies are rejected without creating a property', async () => {
  const { handler, calls } = fixture(owner);
  assert.equal((await handler(request('/listings', 'POST', { ...input, title: 'x'.repeat(9000) }))).status, 413);
  assert.equal((await handler(request('/listings', 'POST', input, { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal(calls.some((call) => call[0] === 'create'), false);
});

test('invalid filters are rejected before a query runs', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request('/listings?town=bengaluru&limit=51'))).status, 400);
  assert.equal(calls.length, 0);
});

test('write quotas return a retry time and leave the property unchanged', async () => {
  const { handler, calls, repository } = fixture(owner);
  repository.admitWrite = async () => false;
  const response = await handler(request('/listings', 'POST', input));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(calls.length, 0);
});

test('browser preflights accept the app origin and reject unrelated origins', async () => {
  const { handler, calls } = fixture();
  const allowed = await handler(request('/saved/property-1', 'OPTIONS', undefined, { Origin: 'http://localhost:8081' }));
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  assert.equal((await handler(request('/listings', 'GET', undefined, { Origin: 'https://other.example.test' }))).status, 403);
  assert.equal(calls.length, 0);
});

const { publicKey, privateKey } = await generateKeyPair('EdDSA');
const keySet = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test-key', alg: 'EdDSA' }] });
const verify = createIdentityVerifier('https://auth.example.test/neondb/auth', 'https://auth.example.test/jwks', keySet);
const token = (extra = {}, issuer = 'https://auth.example.test', expires = '15m', audience = 'https://auth.example.test') => new SignJWT({ role: 'authenticated', ...extra })
  .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).setSubject(owner).setIssuer(issuer)
  .setAudience(audience).setIssuedAt().setExpirationTime(expires).sign(privateKey);

test('a signed Neon-style JWT resolves to its subject', async () => {
  assert.equal(await verify(request('/me', 'GET', undefined, { Authorization: `Bearer ${await token()}` })), owner);
});

test('wrong issuers or audiences, expired tokens and anonymous JWTs cannot authorize private data', async () => {
  for (const value of [await token({}, 'https://another-issuer.example.test'), await token({}, undefined, '15m', 'https://another-app.example.test'), await token({}, undefined, 1), await token({ role: 'anonymous' }), 'not-a-jwt']) {
    await assert.rejects(() => verify(request('/me', 'GET', undefined, { Authorization: `Bearer ${value}` })), { status: 401 });
  }
});

test('rolling back one failed save preserves another property changed in parallel', () => {
  const cached = { pageParams: [null], pages: [{ listings: [{ ...record, id: 'first' }, { ...record, id: 'second' }], nextCursor: 'next-page' }] };
  const firstSaved = setSavedFlag(cached, 'first', true);
  const bothSaved = setSavedFlag(firstSaved, 'second', true);
  const rolledBack = setSavedFlag(bothSaved, 'first', false);
  assert.equal(rolledBack.pages[0].listings[0].saved, false);
  assert.equal(rolledBack.pages[0].listings[1].saved, true);
  assert.equal(rolledBack.pages[0].nextCursor, 'next-page');
  assert.deepEqual(rolledBack.pageParams, [null]);
  assert.equal(cached.pages[0].listings[1].saved, false);
});
