import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeConversation, mergeMessagePage, mergeMessages, restoreFailedDraft } from '../src/utils/chat-state.ts';

const message = (id, createdAt, body = id) => ({
  id, conversationId: 'conversation-1', senderId: 'test-user', body, createdAt, mine: true,
});

test('a recent-message poll preserves loaded history and its oldest-page cursor', () => {
  const old = message('old', '2026-11-01T00:00:00.000001Z');
  const recent = message('recent', '2026-11-01T00:00:01.000001Z');
  const newest = message('newest', '2026-11-01T00:00:02.000001Z');
  const previous = { id: 'conversation-1', messages: [old, recent], nextCursor: 'history-boundary' };
  const result = mergeConversation(previous, { ...previous, messages: [recent, newest], nextCursor: 'recent-boundary', lastMessage: newest.body });
  assert.deepEqual(result.messages.map((item) => item.id), ['old', 'recent', 'newest']);
  assert.equal(result.nextCursor, 'history-boundary');
  assert.equal(result.lastMessage, newest.body);
  assert.equal(mergeConversation({ ...previous, nextCursor: null }, result).nextCursor, null);
});

test('overlapping history pages do not duplicate messages and server updates replace old copies', () => {
  const one = message('one', '2026-11-01T00:00:00.000001Z');
  const two = message('two', '2026-11-01T00:00:00.000002Z');
  const three = message('three', '2026-11-01T00:00:00.000003Z');
  const result = mergeMessages([one, two], [{ ...two, body: 'confirmed' }, three]);
  assert.deepEqual(result.map((item) => item.id), ['one', 'two', 'three']);
  assert.equal(result[1].body, 'confirmed');
});

test('message ordering retains microseconds and handles optimistic millisecond timestamps', () => {
  const result = mergeMessages([
    message('a', '2026-11-01T00:00:00.123001Z'),
    message('b', '2026-11-01T00:00:00.123Z'),
    message('c', '2026-11-01T00:00:00.123002Z'),
  ]);
  assert.deepEqual(result.map((item) => item.id), ['b', 'a', 'c']);
});

test('polling does not drop a message while it is still being sent', () => {
  const pending = message('pending-test', '2026-11-01T00:00:01.123Z');
  const confirmed = message('confirmed', '2026-11-01T00:00:00.123001Z');
  const result = mergeConversation({ messages: [pending], nextCursor: null }, { messages: [confirmed], nextCursor: 'older' });
  assert.deepEqual(result.messages.map((item) => item.id), ['confirmed', 'pending-test']);
  assert.equal(result.nextCursor, 'older');
});

test('a failed send restores an empty composer and preserves a newer draft', () => {
  assert.equal(restoreFailedDraft('', 'First message'), 'First message');
  assert.equal(restoreFailedDraft('A newer message being written', 'First message'), 'A newer message being written');
});

test('a connection gap resumes pagination from the recent window even after old history was exhausted', () => {
  const previous = { messages: [message('old', '2026-11-01T00:00:00.000001Z')], nextCursor: null };
  const next = { messages: [message('new', '2026-11-02T00:00:00.000001Z')], nextCursor: 'missing-middle' };
  const result = mergeConversation(previous, next);
  assert.equal(result.nextCursor, 'missing-middle');
  assert.deepEqual(result.messages.map((item) => item.id), ['old', 'new']);
});

test('a late older-page response preserves the newer gap discovered by polling', () => {
  const thread = { messages: [message('new', '2026-11-02T00:00:00.000001Z')], nextCursor: 'new-gap' };
  const page = { messages: [message('old', '2026-11-01T00:00:00.000001Z')], nextCursor: null };
  const result = mergeMessagePage(thread, page, 'old-boundary');
  assert.equal(result.nextCursor, 'new-gap');
  assert.deepEqual(result.messages.map((item) => item.id), ['old', 'new']);
});
