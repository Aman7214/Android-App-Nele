import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { z } from 'zod';

import { setPerformanceReporter } from '../src/services/performance.ts';

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

test('app API request performance', async (suite) => {
  const oldUrl = process.env.EXPO_PUBLIC_NEON_API_URL;
  process.env.EXPO_PUBLIC_NEON_API_URL = 'https://properties.example.invalid/';
  const apiUrl = new URL('../src/services/api.ts', import.meta.url).href;
  const mockAuthUrl = 'data:text/javascript,' + encodeURIComponent(`
    let generation = 0;
    let reads = 0;
    let expired = [];
    let lookup = async (id) => 'jwt-' + id;
    export const sessionGeneration = () => generation;
    export async function accessToken(id) { reads += 1; return lookup(id); }
    export async function expireSession(id, expected) { if (expected === generation) expired.push(id); }
    export function reset() { generation = 0; reads = 0; expired = []; lookup = async (id) => 'jwt-' + id; }
    export function setGeneration(value) { generation = value; }
    export function setLookup(value) { lookup = value; }
    export const snapshot = () => ({ reads, expired });
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL?.startsWith(apiUrl) && specifier === './auth') return { url: mockAuthUrl, shortCircuit: true };
      return next(specifier, context);
    },
  });
  const auth = await import(mockAuthUrl);
  const { requestApi } = await import(apiUrl);
  const schema = z.object({ value: z.string() });
  const calls = [];
  const timings = [];
  let reply;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).hostname, 'properties.example.invalid');
    calls.push({ url: String(input), init });
    return reply(input, init);
  };
  suite.beforeEach(() => {
    calls.length = 0;
    timings.length = 0;
    auth.reset();
    reply = async () => Response.json({ value: 'ok' });
    setPerformanceReporter((timing) => timings.push(timing));
  });

  try {
    await suite.test('identical GETs with different query ordering share one fetch and token lookup', async () => {
      const started = deferred(), response = deferred();
      reply = () => { started.resolve(); return response.promise; };
      const first = requestApi('listings', schema, { userId: 'first', query: { town: 'manvi', q: 'house' } });
      const second = requestApi('listings', schema, { userId: 'first', query: { q: 'house', town: 'manvi' } });
      await started.promise;
      assert.equal(calls.length, 1);
      assert.equal(auth.snapshot().reads, 1);
      response.resolve(Response.json({ value: 'shared' }));
      assert.deepEqual(await Promise.all([first, second]), [{ value: 'shared' }, { value: 'shared' }]);
      assert.equal(timings.length, 1);
      assert.equal(timings[0].route, 'GET listings');
    });

    await suite.test('different paths and accounts run in parallel with their own credentials', async () => {
      const started = deferred(), response = deferred();
      reply = () => { if (calls.length === 3) started.resolve(); return response.promise.then(() => Response.json({ value: 'ok' })); };
      const requests = [
        requestApi('me', schema, { userId: 'first' }),
        requestApi('me', schema, { userId: 'second' }),
        requestApi('mine', schema, { userId: 'first' }),
      ];
      await started.promise;
      assert.equal(calls.length, 3);
      assert.deepEqual(calls.map((call) => call.init.headers.get('Authorization')), ['Bearer jwt-first', 'Bearer jwt-second', 'Bearer jwt-first']);
      response.resolve();
      await Promise.all(requests);
    });

    await suite.test('cancelling one shared read leaves the other read active', async () => {
      const started = deferred(), response = deferred();
      reply = () => { started.resolve(); return response.promise; };
      const controller = new AbortController();
      const first = requestApi('listings', schema, { signal: controller.signal });
      const second = requestApi('listings', schema);
      const cancelled = assert.rejects(first, { name: 'AbortError' });
      await started.promise;
      controller.abort();
      await cancelled;
      assert.equal(calls[0].init.signal.aborted, false);
      response.resolve(Response.json({ value: 'visible' }));
      assert.deepEqual(await second, { value: 'visible' });
    });

    await suite.test('a new session starts a new read and an old 401 cannot expire it', async () => {
      const started = deferred(), responses = [deferred(), deferred()];
      reply = () => { if (calls.length === 2) started.resolve(); return responses[calls.length - 1].promise; };
      const old = requestApi('me', schema, { userId: 'same-account' });
      const rejected = assert.rejects(old, { status: 401 });
      await Promise.resolve();
      auth.setGeneration(1);
      const fresh = requestApi('me', schema, { userId: 'same-account' });
      await started.promise;
      responses[0].resolve(Response.json({ error: 'Expired' }, { status: 401 }));
      responses[1].resolve(Response.json({ value: 'new session' }));
      await rejected;
      assert.deepEqual(await fresh, { value: 'new session' });
      assert.deepEqual(auth.snapshot().expired, []);
    });

    await suite.test('a failed shared read can be retried', async () => {
      reply = async () => Response.json({ error: 'Try again' }, { status: 503 });
      await assert.rejects(requestApi('listings', schema), { status: 503 });
      reply = async () => Response.json({ value: 'recovered' });
      assert.deepEqual(await requestApi('listings', schema), { value: 'recovered' });
      assert.equal(calls.length, 2);
    });

    await suite.test('each subscriber validates the shared JSON against its own schema', async () => {
      const started = deferred(), response = deferred();
      reply = () => { started.resolve(); return response.promise; };
      const valid = requestApi('listings', schema);
      const invalid = assert.rejects(requestApi('listings', z.object({ value: z.number() })), /unexpected response/);
      await started.promise;
      response.resolve(Response.json({ value: 'string' }));
      assert.deepEqual(await valid, { value: 'string' });
      await invalid;
      assert.equal(calls.length, 1);
    });

    await suite.test('the deadline includes a stalled token refresh', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const started = deferred(), token = deferred();
      auth.setLookup(() => { started.resolve(); return token.promise; });
      const failed = assert.rejects(requestApi('me', schema, { userId: 'first', timeoutMs: 20 }), { status: 408 });
      await started.promise;
      t.mock.timers.tick(20);
      await failed;
      assert.equal(calls.length, 0);
      token.resolve('late-token');
      await Promise.resolve();
      assert.equal(calls.length, 0);
    });

    await suite.test('the deadline aborts a stalled fetch', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const started = deferred(), response = deferred();
      reply = () => { started.resolve(); return response.promise; };
      const failed = assert.rejects(requestApi('listings', schema, { timeoutMs: 20 }), { status: 408 });
      await started.promise;
      t.mock.timers.tick(20);
      await failed;
      assert.equal(calls[0].init.signal.aborted, true);
      response.resolve(Response.json({ value: 'late' }));
    });

    await suite.test('the deadline also includes reading the response body', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const started = deferred(), body = deferred();
      reply = async () => ({ status: 200, ok: true, json: () => { started.resolve(); return body.promise; } });
      const failed = assert.rejects(requestApi('listings', schema, { timeoutMs: 20 }), { status: 408 });
      await started.promise;
      t.mock.timers.tick(20);
      await failed;
      assert.equal(calls[0].init.signal.aborted, true);
      assert.equal(timings[0].status, 408);
      body.resolve({ value: 'late' });
    });

    await suite.test('cancelled callers and failed monitoring do not start or fail requests', async () => {
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(requestApi('listings', schema, { signal: controller.signal }), { name: 'AbortError' });
      assert.equal(calls.length, 0);
      setPerformanceReporter(() => { throw new Error('Monitoring unavailable'); });
      assert.deepEqual(await requestApi('listings', schema), { value: 'ok' });
    });
  } finally {
    globalThis.fetch = originalFetch;
    setPerformanceReporter();
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_NEON_API_URL;
    else process.env.EXPO_PUBLIC_NEON_API_URL = oldUrl;
    hooks.deregister();
  }
});
