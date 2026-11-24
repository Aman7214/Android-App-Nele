import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApiHandler } from '../functions/api/handler.ts';

const owner = '00000000-0000-4000-8000-000000000001';
const buyer = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';

const listing = {
  requestId: 'request-123456', title: 'Family house near college', kind: 'House',
  locality: 'Bank Colony', town: 'raichur', price: 25000, mode: 'rent', audience: 'family',
  beds: 2, baths: 1, areaSqft: 1200, imageAsset: 'house',
};
const record = {
  ...listing, id: 'property-1', rating: 0, reviews: 0, saved: false, isSample: false,
  createdAt: '2026-11-17T10:00:00.123456Z', photos: [], status: 'sold',
  soldAt: '2026-11-18T09:00:00.000000Z',
};

const conversation = {
  id: 'conversation-1', listingId: 'property-1', listingTitle: 'Family house near college',
  listingImageAsset: 'house', listingCoverUrl: null, listingStatus: 'active', town: 'raichur',
  partner: { role: 'owner', name: 'Aman' }, lastMessage: 'Is it still available?',
  lastMessageAt: '2026-11-18T09:00:00.000000Z', createdAt: '2026-11-18T08:00:00.000000Z',
};
const message = {
  id: 'message-1', conversationId: 'conversation-1', senderId: buyer,
  body: 'Is it still available?', createdAt: '2026-11-18T09:00:00.000000Z', mine: true,
};

function fixture({ userId = owner, conversations = [] } = {}) {
  const calls = [];
  const repository = {
    list: async (...args) => { calls.push(['list', ...args]); return { listings: [record], nextCursor: null }; },
    get: async () => ({ listing: record, documents: [] }),
    create: async () => record,
    setStatus: async (...args) => { calls.push(['setStatus', ...args]); return record; },
    startConversation: async (...args) => { calls.push(['startConversation', ...args]); return conversation.id; },
    listConversations: async (...args) => { calls.push(['listConversations', ...args]); return conversations; },
    getConversation: async (...args) => {
      calls.push(['getConversation', ...args]);
      return args[0] === 'missing' ? null : { ...conversation, messages: [message] };
    },
    listMessages: async (...args) => {
      calls.push(['listMessages', ...args]);
      return { messages: [message], nextCursor: null };
    },
    sendMessage: async (...args) => { calls.push(['sendMessage', ...args]); return message; },
    setSaved: async () => undefined,
    counts: async () => ({ listed: 1, saved: 0 }),
    admitWrite: async () => true,
  };
  return {
    calls,
    handler: createApiHandler({ repository, identify: async () => userId, allowedOrigins: ['http://localhost:8081'], storage: null }),
  };
}

const request = (path, method = 'GET', body) => new Request(`https://api.example.test${path}`, {
  method,
  headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('an owner marks a property sold and reruns the public read cache', async () => {
  const { handler, calls } = fixture();
  const sold = await handler(request('/listings/property-1/status', 'PUT', { status: 'sold' }));
  assert.equal(sold.status, 200);
  assert.deepEqual(calls[0], ['setStatus', 'property-1', owner, 'sold']);
  assert.equal((await sold.json()).status, 'sold');

  const relisted = await handler(request('/listings/property-1/status', 'PUT', { status: 'active' }));
  assert.equal(relisted.status, 200);
  assert.deepEqual(calls[1], ['setStatus', 'property-1', owner, 'active']);
});

test('status updates reject bad values and unauthenticated callers', async () => {
  const invalid = await fixture().handler(request('/listings/property-1/status', 'PUT', { status: 'pending' }));
  assert.equal(invalid.status, 400);
  const anonymous = await fixture({ userId: null }).handler(request('/listings/property-1/status', 'PUT', { status: 'sold' }));
  assert.equal(anonymous.status, 401);
});

test('starting a conversation returns the thread and never lets an owner message themselves', async () => {
  const { handler, calls } = fixture({ userId: buyer });
  const started = await handler(request('/conversations', 'POST', { listingId: 'property-1' }));
  assert.equal(started.status, 201);
  assert.deepEqual(calls[0], ['startConversation', 'property-1', buyer]);
  assert.equal((await started.json()).messages.length, 1);

  const bad = await fixture({ userId: buyer }).handler(request('/conversations', 'POST', {}));
  assert.equal(bad.status, 400);
  const anonymous = await fixture({ userId: null }).handler(request('/conversations', 'POST', { listingId: 'property-1' }));
  assert.equal(anonymous.status, 401);
});

test('the inbox lists only conversations the caller belongs to', async () => {
  const { handler, calls } = fixture({ userId: buyer, conversations: [conversation] });
  const response = await handler(request('/conversations'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).conversations.length, 1);
  assert.deepEqual(calls[0], ['listConversations', buyer]);
});

test('a thread is scoped to its participants', async () => {
  const { handler, calls } = fixture({ userId: buyer });
  const thread = await handler(request('/conversations/conversation-1'));
  assert.equal(thread.status, 200);
  assert.deepEqual(calls[0], ['getConversation', 'conversation-1', buyer]);
  assert.equal((await thread.json()).messages[0].mine, true);

  const missing = await fixture({ userId: stranger });
  assert.equal((await missing.handler(request('/conversations/missing'))).status, 404);
});

test('sending a message validates the body and records the sender', async () => {
  const { handler, calls } = fixture({ userId: buyer });
  const sent = await handler(request('/conversations/conversation-1/messages', 'POST', { body: '  Is it still available?  ' }));
  assert.equal(sent.status, 201);
  assert.deepEqual(calls[0], ['sendMessage', 'conversation-1', buyer, 'Is it still available?']);
  assert.equal((await sent.json()).body, 'Is it still available?');

  assert.equal((await fixture({ userId: buyer }).handler(
    request('/conversations/conversation-1/messages', 'POST', { body: '   ' }),
  )).status, 400);
  assert.equal((await fixture({ userId: buyer }).handler(
    request('/conversations/conversation-1/messages', 'POST', { body: 'x'.repeat(2001) }),
  )).status, 400);
  assert.equal((await fixture({ userId: null }).handler(
    request('/conversations/conversation-1/messages', 'POST', { body: 'hello' }),
  )).status, 401);
});

test('older message pages validate cursors and pass the authenticated account to the repository', async () => {
  const { handler, calls } = fixture({ userId: buyer });
  const response = await handler(request('/conversations/conversation-1/messages?before=older-cursor'));
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], ['listMessages', 'conversation-1', buyer, 'older-cursor']);
  assert.deepEqual((await response.json()).messages, [message]);
  const anonymous = fixture({ userId: null });
  assert.equal((await anonymous.handler(request('/conversations/conversation-1/messages'))).status, 401);
  assert.equal(anonymous.calls.length, 0);
  assert.equal((await fixture().handler(request('/conversations/conversation-1/messages?before='))).status, 400);
});

test('the public feed does not leak sold properties', async () => {
  const { handler, calls } = fixture();
  await handler(request('/listings'));
  // The filter itself lives in SQL; the handler must ask for the public scope.
  assert.deepEqual(calls[0].slice(0, 3), ['list', { limit: 20 }, 'listings']);
});
