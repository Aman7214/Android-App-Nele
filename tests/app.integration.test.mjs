import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

import { databaseClient } from '../scripts/db-client.mjs';
import { accountCountsSchema, listingPageSchema, listingRecordSchema } from '../shared/listings.ts';

test('deployed API and app account integration', { skip: process.env.NELE_APP_INTEGRATION_TEST !== '1' }, async (suite) => {
  assert.ok(process.env.NEON_BRANCH?.startsWith('codex/nele-database-'), 'Live app tests require the disposable child branch.');
  assert.ok(process.env.NEON_FUNCTION_API_BASE_URL, 'Deploy the API on the test branch before running this suite.');
  process.env.EXPO_PUBLIC_NEON_API_URL = process.env.NEON_FUNCTION_API_BASE_URL;
  process.env.EXPO_PUBLIC_NEON_AUTH_URL = process.env.NEON_AUTH_BASE_URL;

  const authUrl = new URL('../src/services/auth.ts', import.meta.url).href;
  const apiUrl = new URL('../src/services/api.ts', import.meta.url).href;
  const storageUrl = 'data:text/javascript,' + encodeURIComponent(`
    let value = null;
    export const sessionStorage = {
      cookieSessionFallback: false,
      read: async () => value,
      write: async (next) => { value = next; },
      remove: async () => { value = null; },
    };
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL?.startsWith(authUrl) && specifier === './session-storage') {
        return { url: storageUrl, shortCircuit: true };
      }
      if (context.parentURL?.startsWith(authUrl) && specifier === './auth-runtime') {
        return { url: new URL('../src/services/auth-runtime.ts', import.meta.url).href, shortCircuit: true };
      }
      if (context.parentURL?.startsWith(apiUrl) && specifier === './auth') {
        return { url: authUrl, shortCircuit: true };
      }
      return next(specifier, context);
    },
  });
  const auth = await import(authUrl);
  const { requestApi } = await import(apiUrl);
  const database = databaseClient();
  const fixtureId = randomUUID();
  // Reserved .invalid addresses never contact a real person's mailbox.
  const accounts = [0, 1].map((index) => ({
    email: `nele-app-${fixtureId}-${index}@example.invalid`,
    password: `Nele-${randomUUID()}!`, name: 'Nele integration test',
  }));
  let first;
  let second;
  let property;
  let connected = false;
  try {
    await database.connect();
    connected = true;
    await suite.test('the deployed API browses real rows and protects private routes', async () => {
      const page = await requestApi('listings', listingPageSchema);
      assert.ok(page.listings.length >= 14);
      assert.ok(page.listings.every((listing) => !listing.saved));
      for (const path of ['me', 'mine', 'saved']) {
        const response = await fetch(new URL(path, process.env.NEON_FUNCTION_API_BASE_URL));
        assert.equal(response.status, 401);
      }
      const allowed = await fetch(new URL('listings', process.env.NEON_FUNCTION_API_BASE_URL), {
        method: 'OPTIONS', headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'GET' },
      });
      assert.equal(allowed.status, 204);
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    });

    async function createAccount(input) {
      try { return await auth.authenticate(input, true); }
      catch (error) {
        if (!(error instanceof auth.VerificationRequiredError)) throw error;
        await auth.sendVerificationCode(input.email);
        const { rows } = await database.query(`SELECT value FROM neon_auth.verification
          WHERE identifier LIKE $1 AND "expiresAt" > now() ORDER BY "createdAt" DESC LIMIT 1`, [`%${input.email}%`]);
        const code = rows[0]?.value.match(/^(\d{6})(?::\d+)?$/)?.[1];
        assert.ok(code, 'A verification code must be recoverable on this disposable test branch; no mailbox is used.');
        await auth.verifyEmail(input.email, code);
        return auth.authenticate(input, false);
      }
    }

    await suite.test('account creation, email verification, and signed API access work through the app client', async () => {
      first = await createAccount(accounts[0]);
      assert.ok(first.emailVerified);
      assert.deepEqual(await requestApi('me', accountCountsSchema, { userId: first.id }), { listed: 0, saved: 0 });
    });
    if (!first) throw new Error('The account fixture was not created.');

    await suite.test('posting retries reuse one database property and it is publicly visible', async () => {
      const input = {
        requestId: `live-${fixtureId}`, title: 'Nele test family house', kind: 'House',
        locality: 'Bank Colony', town: 'raichur', price: 21000, mode: 'rent', audience: 'family',
        beds: 2, baths: 1, areaSqft: 1200, imageAsset: 'house',
      };
      const options = { method: 'POST', body: input, userId: first.id };
      property = await requestApi('listings', listingRecordSchema, options);
      const retry = await requestApi('listings', listingRecordSchema, options);
      assert.equal(property.id, retry.id);
      const mine = await requestApi('mine', listingPageSchema, { userId: first.id });
      assert.equal(mine.listings.length, 1);
      assert.equal(mine.listings[0].id, property.id);
      const browse = await requestApi('listings', listingPageSchema, { query: { q: 'Nele test family house' } });
      assert.ok(browse.listings.some((listing) => listing.id === property.id));
    });

    await suite.test('saved properties survive a new client session and disappear after unsaving', async () => {
      const save = await fetch(new URL('saved/l1', process.env.NEON_FUNCTION_API_BASE_URL), {
        method: 'PUT', headers: { Authorization: `Bearer ${await auth.accessToken(first.id)}` },
      });
      assert.equal(save.status, 200);
      const restoredAuth = await import(authUrl + `?restart=${fixtureId}`);
      assert.equal((await restoredAuth.restoreSession())?.id, first.id);
      const saved = await requestApi('saved', listingPageSchema, { userId: first.id });
      assert.deepEqual(saved.listings.map((listing) => listing.id), ['l1']);
      const unsave = await fetch(new URL('saved/l1', process.env.NEON_FUNCTION_API_BASE_URL), {
        method: 'DELETE', headers: { Authorization: `Bearer ${await restoredAuth.accessToken(first.id)}` },
      });
      assert.equal(unsave.status, 200);
      assert.equal((await requestApi('saved', listingPageSchema, { userId: first.id })).listings.length, 0);
    });

    await suite.test('sign out clears the session and another account cannot read the first account properties', async () => {
      await auth.signOut();
      assert.equal(await auth.restoreSession(), null);
      await assert.rejects(() => auth.authenticate({ ...accounts[0], password: 'Wrong-password-123!' }, false));
      second = await createAccount(accounts[1]);
      assert.notEqual(second.id, first.id);
      assert.equal((await requestApi('mine', listingPageSchema, { userId: second.id })).listings.length, 0);
      assert.equal((await requestApi('saved', listingPageSchema, { userId: second.id })).listings.length, 0);
      await auth.signOut();
      assert.equal(await auth.restoreSession(), null);
    });
  } finally {
    await auth.signOut().catch(() => {});
    if (connected) {
      const emails = accounts.map((account) => account.email);
      // The HTTP backend commits its writes; remove only this suite's disposable fixtures.
      await database.query(`DELETE FROM neon_auth."session" WHERE "userId" IN
        (SELECT id FROM neon_auth."user" WHERE email = ANY($1::text[]))`, [emails]);
      await database.query(`DELETE FROM neon_auth.account WHERE "userId" IN
        (SELECT id FROM neon_auth."user" WHERE email = ANY($1::text[]))`, [emails]);
      await database.query('DELETE FROM neon_auth."user" WHERE email = ANY($1::text[])', [emails]);
      for (const email of emails) await database.query('DELETE FROM neon_auth.verification WHERE identifier LIKE $1', [`%${email}%`]);
    }
    await database.end();
    hooks.deregister();
  }
});
