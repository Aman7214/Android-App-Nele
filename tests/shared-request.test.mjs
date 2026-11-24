import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRequestCoordinator, singleFlight, waitForSignal } from '../src/utils/shared-request.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('identical reads share work and a completed read can be refreshed', async () => {
  const read = createRequestCoordinator();
  const response = deferred();
  let calls = 0;
  const load = () => { calls += 1; return response.promise; };
  const first = read('properties', load);
  const second = read('properties', load);
  await Promise.resolve();
  assert.equal(calls, 1);
  response.resolve('page');
  assert.deepEqual(await Promise.all([first, second]), ['page', 'page']);
  assert.equal(await read('properties', async () => { calls += 1; return 'fresh'; }), 'fresh');
  assert.equal(calls, 2);
});

test('different request keys start independently before either finishes', async () => {
  const read = createRequestCoordinator();
  const response = deferred();
  const started = [];
  const first = read('home', () => { started.push('home'); return response.promise; });
  const second = read('account', () => { started.push('account'); return response.promise; });
  await Promise.resolve();
  assert.deepEqual(started, ['home', 'account']);
  response.resolve('result');
  await Promise.all([first, second]);
});

test('leaving one screen cancels its subscriber while another screen receives the response', async () => {
  const read = createRequestCoordinator();
  const response = deferred();
  const screen = new AbortController();
  let sourceSignal;
  const load = (signal) => { sourceSignal = signal; return response.promise; };
  const first = read('home', load, screen.signal);
  const second = read('home', load);
  const cancelled = assert.rejects(first, { name: 'AbortError' });
  await Promise.resolve();
  screen.abort();
  await cancelled;
  assert.equal(sourceSignal.aborted, false);
  response.resolve('still visible');
  assert.equal(await second, 'still visible');
});

test('leaving every screen aborts the source and a new screen starts fresh work', async () => {
  const read = createRequestCoordinator();
  const oldResponse = deferred();
  const freshResponse = deferred();
  const screens = [new AbortController(), new AbortController()];
  let sourceSignal;
  const load = (signal) => { sourceSignal = signal; return oldResponse.promise; };
  const requests = screens.map((screen) => read('home', load, screen.signal));
  const cancelled = requests.map((request) => assert.rejects(request, { name: 'AbortError' }));
  await Promise.resolve();
  screens.forEach((screen) => screen.abort());
  await Promise.all(cancelled);
  assert.equal(sourceSignal.aborted, true);
  const fresh = read('home', () => freshResponse.promise);
  oldResponse.resolve('outdated');
  await Promise.resolve();
  const joined = read('home', () => { throw new Error('Old cleanup removed the fresh request.'); });
  freshResponse.resolve('fresh');
  assert.deepEqual(await Promise.all([fresh, joined]), ['fresh', 'fresh']);
});

test('an already cancelled caller never starts work', async () => {
  const controller = new AbortController();
  controller.abort();
  const read = createRequestCoordinator();
  await assert.rejects(read('home', () => { throw new Error('Cancelled work started.'); }, controller.signal), { name: 'AbortError' });
});

test('a screen leaving before queued work starts prevents the request', async () => {
  const read = createRequestCoordinator();
  const controller = new AbortController();
  let calls = 0;
  const pending = read('home', async () => { calls += 1; return 'unused'; }, controller.signal);
  const cancelled = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  await cancelled;
  assert.equal(calls, 0);
});

test('failed shared work is removed so the next request can retry', async () => {
  const read = createRequestCoordinator();
  const error = new Error('Offline');
  const load = async () => { throw error; };
  const requests = [read('home', load), read('home', load)];
  await Promise.all(requests.map((request) => assert.rejects(request, error)));
  assert.equal(await read('home', async () => 'reconnected'), 'reconnected');
});

test('session single-flight coalesces concurrent reads without retaining failures', async () => {
  const response = deferred();
  const calls = [];
  const run = singleFlight((value) => { calls.push(value); return response.promise; });
  const first = run('session:1', 'first');
  const second = run('session:1', 'duplicate');
  const nextSession = run('session:2', 'next session');
  await Promise.resolve();
  assert.deepEqual(calls, ['first', 'next session']);
  const failed = [first, second, nextSession].map((request) => assert.rejects(request, /Unavailable/));
  response.reject(new Error('Unavailable'));
  await Promise.all(failed);
  await assert.rejects(run('session:1', 'retry'), /Unavailable/);
  assert.deepEqual(calls, ['first', 'next session', 'retry']);
});

test('cancellation while waiting does not change the underlying promise', async () => {
  const response = deferred();
  const controller = new AbortController();
  const waiting = waitForSignal(response.promise, controller.signal);
  const cancelled = assert.rejects(waiting, { name: 'AbortError' });
  controller.abort();
  await cancelled;
  response.resolve('background result');
  assert.equal(await response.promise, 'background result');
});

test('an already cancelled wait still handles a late source failure', async () => {
  const response = deferred();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(waitForSignal(response.promise, controller.signal), { name: 'AbortError' });
  response.reject(new Error('Late source failure'));
  await new Promise((resolve) => setImmediate(resolve));
});
