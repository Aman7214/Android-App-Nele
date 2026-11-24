import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApiHandler } from '../functions/api/handler.ts';

const buyer = '00000000-0000-4000-8000-000000000002';

const request = (path, method = 'GET', body) => new Request(`https://api.example.test${path}`, {
  method,
  headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function fixture({ userId = buyer, storage = null, accountDeleted = true, storageFails = false } = {}) {
  const calls = [];
  const repository = {
    list: async () => { calls.push(['list']); return { listings: [], nextCursor: null }; },
    get: async () => null,
    create: async () => { throw new Error('unused'); },
    setStatus: async () => { throw new Error('unused'); },
    startConversation: async () => 'conversation-1',
    listConversations: async () => [],
    getConversation: async () => null,
    sendMessage: async () => { throw new Error('unused'); },
    createAgentRequest: async (...args) => {
      calls.push(['createAgentRequest', ...args]);
      return { id: 'request-1', createdAt: '2026-11-18T10:00:00.000000Z' };
    },
    deleteAccount: async (...args) => {
      calls.push(['deleteAccount', ...args]);
      return accountDeleted;
    },
    setSaved: async () => undefined,
    counts: async () => ({ listed: 0, saved: 0 }),
    admitWrite: async () => true,
  };
  const media = storage ?? (storageFails ? {
    putPhoto: async () => { throw new Error('unused'); },
    putDocument: async () => { throw new Error('unused'); },
    signDocument: async () => '',
    deleteOwned: async () => { calls.push(['deleteOwned']); throw new Error('storage down'); },
  } : {
    putPhoto: async () => { throw new Error('unused'); },
    putDocument: async () => { throw new Error('unused'); },
    signDocument: async () => '',
    deleteOwned: async (...args) => { calls.push(['deleteOwned', ...args]); return 3; },
  });
  return {
    calls,
    handler: createApiHandler({ repository, identify: async () => userId, allowedOrigins: ['http://localhost:8081'], storage: media }),
  };
}

const lead = {
  name: 'Ravi Kumar', phone: '98765 43210', town: 'raichur', intent: 'buy',
  budget: '15-25 lakh', contactTime: 'evening', notes: '2BHK near bus stand',
};

test('a booking agent request stores the lead against the signed-in account', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('/agent-requests', 'POST', lead));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: 'request-1', createdAt: '2026-11-18T10:00:00.000000Z' });
  assert.equal(calls[0][0], 'createAgentRequest');
  assert.equal(calls[0][2], buyer, 'lead is tied to the caller');
  assert.equal(calls[0][1].phone, '98765 43210');
  assert.equal(calls[0][1].contactTime, 'evening');
});

test('agent requests need an account and a usable phone number', async () => {
  const anonymous = await fixture({ userId: null }).handler(request('/agent-requests', 'POST', lead));
  assert.equal(anonymous.status, 401);

  const noPhone = await fixture().handler(request('/agent-requests', 'POST', { ...lead, phone: 'call-me' }));
  assert.equal(noPhone.status, 400);

  const unknownTown = await fixture().handler(request('/agent-requests', 'POST', { ...lead, town: 'bengaluru' }));
  assert.equal(unknownTown.status, 400);

  const badTime = await fixture().handler(request('/agent-requests', 'POST', { ...lead, contactTime: 'midnight' }));
  assert.equal(badTime.status, 400);

  const extraField = await fixture().handler(request('/agent-requests', 'POST', { ...lead, admin: true }));
  assert.equal(extraField.status, 400, 'unknown fields are rejected');
});

test('account deletion removes files before rows', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('/account', 'DELETE'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(calls.map(([name]) => name), ['deleteOwned', 'deleteAccount']);
  assert.deepEqual(calls[0], ['deleteOwned', buyer]);
  assert.deepEqual(calls[1], ['deleteAccount', buyer]);
});

test('account deletion stops before the rows when storage fails', async () => {
  const { handler, calls } = fixture({ storageFails: true });
  const response = await handler(request('/account', 'DELETE'));
  assert.equal(response.status, 503);
  assert.deepEqual(calls.map(([name]) => name), ['deleteOwned'], 'nothing deleted after a storage failure');
});

test('account deletion needs a session and reports an already-gone account', async () => {
  assert.equal((await fixture({ userId: null }).handler(request('/account', 'DELETE'))).status, 401);
  assert.equal((await fixture({ accountDeleted: false }).handler(request('/account', 'DELETE'))).status, 404);
});
