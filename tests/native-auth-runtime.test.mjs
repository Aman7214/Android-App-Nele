import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { installNativeAuthRuntime } from '../src/utils/native-auth-runtime.ts';

test('the managed auth client loads and reuses sessions without native browser-only APIs', async () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const jsonDescriptor = Object.getOwnPropertyDescriptor(Response, 'json');
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  Object.defineProperty(Response, 'json', { value: undefined, configurable: true, writable: true });
  try {
    installNativeAuthRuntime(randomUUID);
    const uuid = crypto.randomUUID();
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const token = [
      Buffer.from(JSON.stringify({ alg: 'EdDSA' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'native-test', exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url'),
      'mock-signature',
    ].join('.');
    let requests = 0;
    globalThis.fetch = async () => {
      requests += 1;
      return new Response(JSON.stringify({
        user: { id: 'native-test', name: 'Native test', email: 'native@example.invalid', emailVerified: true },
        session: { token, expiresAt: new Date(Date.now() + 900_000).toISOString() },
      }), { headers: { 'Content-Type': 'application/json', 'set-auth-jwt': token } });
    };
    const { createAuthClient } = await import('@neon/auth');
    const client = createAuthClient('https://auth.example.invalid/neondb/auth');
    assert.equal((await client.getSession()).data?.user.id, 'native-test');
    assert.equal((await client.getSession()).data?.user.id, 'native-test');
    assert.equal(requests, 1, 'The second request must use the native-compatible cached JSON response.');
  } finally {
    globalThis.fetch = originalFetch;
    if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    else delete globalThis.crypto;
    if (jsonDescriptor) Object.defineProperty(Response, 'json', jsonDescriptor);
    else delete Response.json;
  }
});
