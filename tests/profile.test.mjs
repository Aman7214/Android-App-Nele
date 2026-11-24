import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApiHandler } from '../functions/api/handler.ts';

const userId = '00000000-0000-4000-8000-000000000002';

const request = (path, method = 'GET', body) => new Request(`https://api.example.test${path}`, {
  method,
  headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function fixture({ signedIn = true, profile = { displayName: 'Ravi Kumar', avatarId: 'a3' } } = {}) {
  const calls = [];
  const repository = {
    list: async () => ({ listings: [], nextCursor: null }),
    get: async () => null,
    create: async () => { throw new Error('unused'); },
    setStatus: async () => { throw new Error('unused'); },
    startConversation: async () => 'conversation-1',
    listConversations: async () => [],
    getConversation: async () => null,
    sendMessage: async () => { throw new Error('unused'); },
    getProfile: async (...args) => { calls.push(['getProfile', ...args]); return profile; },
    updateProfile: async (...args) => {
      calls.push(['updateProfile', ...args]);
      return { displayName: args[0].displayName, avatarId: args[0].avatarId };
    },
    createAgentRequest: async () => ({ id: 'request-1', createdAt: '2026-11-18T10:00:00.000Z' }),
    deleteAccount: async () => true,
    setSaved: async () => undefined,
    counts: async () => ({ listed: 0, saved: 0 }),
    admitWrite: async () => true,
  };
  return {
    calls,
    handler: createApiHandler({
      repository,
      identify: async () => (signedIn ? userId : null),
      allowedOrigins: ['http://localhost:8081'],
      storage: null,
    }),
  };
}

test('the profile carries a display name and an illustrated avatar', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('/profile'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { displayName: 'Ravi Kumar', avatarId: 'a3' });
  assert.deepEqual(calls[0], ['getProfile', userId]);
});

test('a profile with no avatar chosen comes back as null, not missing', async () => {
  const { handler } = fixture({ profile: { displayName: 'Ravi Kumar', avatarId: null } });
  assert.deepEqual(await (await handler(request('/profile'))).json(), { displayName: 'Ravi Kumar', avatarId: null });
});

test('profiles need a session', async () => {
  assert.equal((await fixture({ signedIn: false }).handler(request('/profile'))).status, 401);
  assert.equal((await fixture({ signedIn: false }).handler(
    request('/profile', 'PUT', { displayName: 'Ravi', avatarId: null }),
  )).status, 401);
});

test('updating saves the trimmed name and the chosen avatar', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('/profile', 'PUT', { displayName: '  Ravi Kumar  ', avatarId: 'a5' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { displayName: 'Ravi Kumar', avatarId: 'a5' });
  assert.deepEqual(calls[0][1], { displayName: 'Ravi Kumar', avatarId: 'a5' });
});

test('an avatar can be removed by choosing null', async () => {
  const { handler } = fixture();
  const response = await handler(request('/profile', 'PUT', { displayName: 'Ravi Kumar', avatarId: null }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { displayName: 'Ravi Kumar', avatarId: null });
});

test('invalid names, unknown avatars and stray fields are rejected', async () => {
  const cases = [
    { displayName: 'R', avatarId: null },          // too short
    { displayName: 'x'.repeat(41), avatarId: null }, // too long
    { displayName: 'Ravi', avatarId: 'a99' },        // not in the bundled set
    { displayName: 'Ravi', avatarId: 'a3', admin: true },
    { avatarId: 'a3' },                              // missing name
  ];
  for (const body of cases) {
    const response = await fixture().handler(request('/profile', 'PUT', body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});
