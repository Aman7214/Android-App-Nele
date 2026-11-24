import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

import { accountCountsSchema } from '../shared/listings.ts';

test('app client session recovery', async (suite) => {
  const authBase = 'https://auth.example.invalid/neondb/auth';
  const apiBase = 'https://properties.example.invalid/';
  process.env.EXPO_PUBLIC_NEON_AUTH_URL = authBase;
  process.env.EXPO_PUBLIC_NEON_API_URL = apiBase;
  const authUrl = new URL('../src/services/auth.ts', import.meta.url).href;
  const apiUrl = new URL('../src/services/api.ts', import.meta.url).href;
  const storageUrl = 'data:text/javascript,' + encodeURIComponent(`
    let value = null;
    export const sessionStorage = {
      cookieSessionFallback: true,
      read: async () => value,
      write: async (next) => { value = next; },
      remove: async () => { value = null; },
    };
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL?.startsWith(authUrl) && specifier === './session-storage') return { url: storageUrl, shortCircuit: true };
      if (context.parentURL?.startsWith(authUrl) && specifier === './auth-runtime') return { url: new URL('../src/services/auth-runtime.ts', import.meta.url).href, shortCircuit: true };
      if (context.parentURL === apiUrl && specifier === './auth') return { url: authUrl, shortCircuit: true };
      return next(specifier, context);
    },
  });
  const users = [1, 2].map((index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    name: 'Client test', email: `client-${index}@example.invalid`, emailVerified: true,
  }));
  const sessions = new Map();
  let cookieUser;
  let tokenUnavailable = false;
  let signOutUnavailable = false;
  let sessionRequests = 0;
  let resolveOldResponse;
  let notifyOldRequest;
  const tokenFor = (user) => [
    Buffer.from(JSON.stringify({ alg: 'EdDSA' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url'),
    'mock-signature',
  ].join('.');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const credential = new Headers(init.headers).get('authorization')?.replace(/^Bearer /, '');
    if (url.origin === new URL(apiBase).origin) {
      notifyOldRequest();
      return new Promise((resolve) => { resolveOldResponse = resolve; });
    }
    assert.equal(url.origin, new URL(authBase).origin, 'Unit checks must not perform network requests.');
    const path = url.pathname.replace('/neondb/auth', '');
    if (path === '/sign-in/email') {
      const body = JSON.parse(init.body);
      const user = users.find((candidate) => candidate.email === body.email);
      assert.ok(user);
      const token = `session-${user.id}`;
      sessions.set(token, user);
      cookieUser = user;
      return Response.json({ user, token }, { headers: { 'set-auth-token': token } });
    }
    if (path === '/sign-out') {
      if (signOutUnavailable) return Response.json({ message: 'Temporary Auth outage' }, { status: 503 });
      sessions.delete(credential);
      cookieUser = undefined;
      return Response.json({ success: true });
    }
    const user = sessions.get(credential) ?? cookieUser;
    if (path === '/get-session') {
      sessionRequests += 1;
      if (tokenUnavailable) return Response.json({ message: 'Temporary Auth outage' }, { status: 503 });
      return Response.json(user ? {
        user, session: { id: 'session', userId: user.id, token: tokenFor(user), expiresAt: new Date(Date.now() + 900_000).toISOString() },
      } : null);
    }
    if (path === '/token') {
      if (tokenUnavailable) return Response.json({ message: 'Temporary Auth outage' }, { status: 503 });
      return user ? Response.json({ token: tokenFor(user) }) : Response.json({ message: 'Unauthorized' }, { status: 401 });
    }
    throw new Error('Unexpected mocked auth endpoint.');
  };
  const auth = await import(authUrl);
  const { requestApi } = await import(apiUrl);
  let expired = 0;
  auth.onSessionExpired(() => { expired += 1; });
  try {
    const first = await auth.authenticate({ email: users[0].email, password: 'Test-password-123!' }, false);
    await suite.test('concurrent session restores share one managed Auth request', async () => {
      const before = sessionRequests;
      const restored = await Promise.all([auth.restoreSession(), auth.restoreSession(), auth.restoreSession()]);
      assert.deepEqual(restored.map((user) => user?.id), [first.id, first.id, first.id]);
      assert.equal(sessionRequests - before, 1);
    });
    await suite.test('a temporary Auth outage preserves the account for a successful retry', async () => {
      suite.mock.timers.enable({ apis: ['Date'], now: Date.now() });
      suite.mock.timers.tick(16 * 60 * 1000);
      tokenUnavailable = true;
      await assert.rejects(() => auth.accessToken(first.id));
      tokenUnavailable = false;
      assert.equal((await auth.restoreSession())?.id, first.id);
      assert.ok(await auth.accessToken(first.id));
      assert.equal(expired, 0);
    });
    await suite.test('a late unauthorized response preserves a new sign-in to the same or another account', async () => {
      let current = first;
      for (const nextUser of users) {
        const oldRequestStarted = new Promise((resolve) => { notifyOldRequest = resolve; });
        const oldRequest = requestApi('me', accountCountsSchema, { userId: current.id });
        await oldRequestStarted;
        await auth.signOut();
        current = await auth.authenticate({ email: nextUser.email, password: 'Test-password-123!' }, false);
        resolveOldResponse(Response.json({ error: 'Please sign in again.' }, { status: 401 }));
        await assert.rejects(() => oldRequest, { status: 401 });
        assert.equal((await auth.restoreSession())?.id, current.id);
        assert.equal(expired, 0);
      }
    });
    await suite.test('signing out while offline prevents a cookie from restoring the account after reload', async () => {
      signOutUnavailable = true;
      await assert.rejects(() => auth.signOut());
      assert.ok(cookieUser, 'The fake server must still hold the cookie session.');
      const restarted = await import(authUrl + '?after-offline-sign-out');
      assert.equal(await restarted.restoreSession(), null);
    });
  } finally {
    globalThis.fetch = originalFetch;
    suite.mock.timers.reset();
    hooks.deregister();
  }
});
