import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';

import { createListingRepository } from '../functions/api/repository.ts';
import { databaseClient } from '../scripts/db-client.mjs';

test('Neon database integration', { skip: process.env.NELE_INTEGRATION_TEST !== '1' }, async (suite) => {
  assert.ok(process.env.NEON_BRANCH?.startsWith('codex/nele-database-'), 'Integration tests require the temporary child branch.');
  const client = databaseClient();
  const firstUser = randomUUID();
  const secondUser = randomUUID();
  let transaction = false;
  await client.connect();
  try {
    await client.query('BEGIN');
    transaction = true;
    for (const id of [firstUser, secondUser]) {
      await client.query(`INSERT INTO neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        VALUES ($1, 'Database test', $2, true, now(), now())`, [id, `nele-${id}@example.invalid`]);
    }
    const repository = createListingRepository({ query: client.query.bind(client) }, {
      // Publication uses a savepoint inside this suite's rollback-only transaction.
      transaction: async (work) => {
        await client.query('SAVEPOINT publication');
        try {
          const result = await work(client);
          await client.query('RELEASE SAVEPOINT publication');
          return result;
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT publication');
          await client.query('RELEASE SAVEPOINT publication');
          throw error;
        }
      },
    });
    const input = {
      requestId: 'integration-property-request', title: 'Integration test family house', kind: 'House',
      locality: 'Bank Colony', town: 'raichur', price: 20000, mode: 'rent', audience: 'family',
      beds: 2, baths: 1, areaSqft: 1200, imageAsset: 'house',
    };
    let firstProperty;
    let secondProperty;

    await suite.test('pagination includes every seed row even when timestamps are identical', async () => {
      const { rows } = await client.query('SELECT id FROM nele.listings ORDER BY created_at DESC, id DESC');
      const ids = [];
      let cursor;
      do {
        const page = await repository.list({ limit: 3, cursor }, 'listings', null);
        ids.push(...page.listings.map((listing) => listing.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      assert.deepEqual(ids, rows.map((row) => row.id));
      assert.equal(new Set(ids).size, ids.length);
    });

    await suite.test('server filtering preserves property, town, deal and bedroom searches', async () => {
      const students = await repository.list({ limit: 50, mode: 'rent', audience: 'students' }, 'listings', null);
      assert.ok(students.listings.length > 0);
      assert.ok(students.listings.every((listing) => listing.mode === 'rent' && listing.audience === 'students'));
      assert.deepEqual((await repository.list({ limit: 20, q: 'shops manvi' }, 'listings', null)).listings.map((listing) => listing.id), ['l3']);
      assert.deepEqual((await repository.list({ limit: 20, q: '4bhk buy' }, 'listings', null)).listings.map((listing) => listing.id), ['l2']);
      assert.equal((await repository.list({ limit: 20, q: "%' OR 1=1" }, 'listings', null)).listings.length, 0);
    });

    await suite.test('retrying a publish creates one row, while request IDs are separate per owner', async () => {
      firstProperty = await repository.create(input, firstUser);
      const retry = await repository.create(input, firstUser);
      secondProperty = await repository.create(input, secondUser);
      assert.equal(firstProperty.id, retry.id);
      assert.notEqual(firstProperty.id, secondProperty.id);
      assert.equal((await repository.list({ limit: 20 }, 'mine', firstUser)).listings.length, 1);
      assert.equal(firstProperty.rating, 0);
      assert.equal(firstProperty.reviews, 0);
      assert.equal(firstProperty.isSample, false);
    });

    await suite.test('saves persist per account and another account cannot remove them', async () => {
      await repository.setSaved('l1', firstUser, true);
      await repository.setSaved('l1', firstUser, true);
      assert.deepEqual((await repository.counts(firstUser)), { listed: 1, saved: 1 });
      assert.equal((await repository.list({ limit: 20 }, 'saved', secondUser)).listings.length, 0);
      await repository.setSaved('l1', secondUser, false);
      assert.equal((await repository.list({ limit: 20 }, 'saved', firstUser)).listings[0].id, 'l1');
      const browsed = await repository.list({ limit: 50 }, 'listings', firstUser);
      assert.equal(browsed.listings.find((listing) => listing.id === 'l1').saved, true);
      assert.equal((await repository.list({ limit: 20 }, 'mine', secondUser)).listings[0].id, secondProperty.id);
      await repository.setSaved('l1', firstUser, false);
      assert.equal((await repository.counts(firstUser)).saved, 0);
    });

    await suite.test('failed attachments roll back a publish and preserve a committed retry', async () => {
      const photo = { key: `listings/${firstUser}/test-photo.jpg`, width: 100, height: 100 };
      const published = await repository.create({ ...input, requestId: 'atomic-publish-test', photos: [photo] }, firstUser);
      await assert.rejects(repository.create({
        ...input, requestId: 'atomic-publish-test', photos: [photo, photo],
      }, firstUser));
      assert.deepEqual((await repository.get(published.id, firstUser)).listing.photos.map((item) => item.key), [photo.key]);
      await assert.rejects(repository.create({
        ...input, requestId: 'atomic-new-test', photos: [photo, photo],
      }, firstUser));
      const result = await client.query('SELECT id FROM nele.listings WHERE owner_id = $1 AND client_request_id = $2',
        [firstUser, 'atomic-new-test']);
      assert.equal(result.rowCount, 0);
    });

    await suite.test('chat starts with recent messages and paginates the full history without gaps', async () => {
      const conversationId = await repository.startConversation(firstProperty.id, secondUser);
      await client.query(`INSERT INTO nele.messages (id, conversation_id, sender_id, body, created_at)
        SELECT 'pagination-message-' || lpad(n::text, 3, '0'), $1, $2, 'Message ' || n,
          '2026-11-01T00:00:00Z'::timestamptz + interval '1 microsecond' * (n / 2)
        FROM generate_series(1, 251) AS n`, [conversationId, secondUser]);
      const thread = await repository.getConversation(conversationId, secondUser);
      assert.equal(thread.messages.at(-1).body, 'Message 251');
      const ids = thread.messages.map((message) => message.id);
      let before = thread.nextCursor;
      while (before) {
        const page = await repository.listMessages(conversationId, secondUser, before);
        ids.unshift(...page.messages.map((message) => message.id));
        before = page.nextCursor;
      }
      assert.deepEqual(ids, Array.from({ length: 251 }, (_, index) => `pagination-message-${String(index + 1).padStart(3, '0')}`));
      await assert.rejects(repository.listMessages(conversationId, firstUser, 'invalid'), { status: 400 });
      await assert.rejects(repository.listMessages(conversationId, '00000000-0000-4000-8000-000000000099'), { status: 404 });
    });

    await suite.test('invalid cursors are rejected and missing properties cannot be saved', async () => {
      await assert.rejects(() => repository.list({ limit: 20, cursor: 'invalid' }, 'listings', null), { status: 400 });
      await assert.rejects(() => repository.setSaved('missing-property', firstUser, true), { status: 404 });
    });

    await suite.test('write quotas are stored separately for each verified account', async () => {
      for (let index = 0; index < 60; index += 1) assert.equal(await repository.admitWrite(firstUser), true);
      assert.equal(await repository.admitWrite(firstUser), false);
      assert.equal(await repository.admitWrite(secondUser), true);
    });
  } finally {
    if (transaction) await client.query('ROLLBACK');
    await client.end();
  }
});

test('pooled publication transactions roll back failures and serialize concurrent retries', {
  skip: process.env.NELE_INTEGRATION_TEST !== '1',
}, async () => {
  assert.ok(process.env.NEON_BRANCH?.startsWith('codex/nele-database-'), 'Pool tests require the temporary child branch.');
  const url = new URL(process.env.DATABASE_URL_UNPOOLED);
  url.searchParams.set('sslmode', 'verify-full');
  const pool = new pg.Pool({ connectionString: url.href, max: 3, connectionTimeoutMillis: 15_000 });
  const userId = randomUUID();
  try {
    await pool.query(`INSERT INTO neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      VALUES ($1, 'Transaction test', $2, true, now(), now())`, [userId, `nele-${userId}@example.invalid`]);
    const repository = createListingRepository(pool);
    const photo = { key: `listings/${userId}/transaction-photo.jpg`, width: 100, height: 100 };
    const input = {
      requestId: 'pooled-transaction-test', title: 'Transaction test house', kind: 'House', locality: 'Bank Colony',
      town: 'raichur', price: 21000, mode: 'sale', areaSqft: 1200, imageAsset: 'house', photos: [photo],
    };
    await assert.rejects(repository.create({ ...input, photos: [photo, photo] }, userId));
    assert.equal((await repository.counts(userId)).listed, 0);
    const [first, retry] = await Promise.all([repository.create(input, userId), repository.create(input, userId)]);
    assert.equal(first.id, retry.id);
    assert.equal((await repository.counts(userId)).listed, 1);
    assert.deepEqual(first.photos.map((item) => item.key), [photo.key]);
    assert.deepEqual(retry.photos.map((item) => item.key), [photo.key]);
  } finally {
    await pool.query('DELETE FROM neon_auth."user" WHERE id = $1', [userId]);
    await pool.end();
  }
});
