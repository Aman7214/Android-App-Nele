import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApiHandler } from '../functions/api/handler.ts';

process.env.AWS_ENDPOINT_URL_S3 = 'https://s3.example.test';

const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';

const input = {
  requestId: 'request-123456', title: 'Family house near college', kind: 'House',
  locality: 'Bank Colony', town: 'raichur', price: 25000, mode: 'rent', audience: 'family',
  beds: 2, baths: 1, areaSqft: 1200, imageAsset: 'house',
};
const record = {
  ...input, id: 'property-1', rating: 0, reviews: 0,
  createdAt: '2026-11-17T10:00:00.123456Z', saved: false, isSample: false,
  photos: [
    { key: `listings/${owner}/one.jpg`, url: `https://s3.example.test/listing-photos/listings/${owner}/one.jpg` },
    { key: `listings/${owner}/two.jpg`, url: `https://s3.example.test/listing-photos/listings/${owner}/two.jpg` },
  ],
};

const stored = [
  { key: `listings/${owner}/one.jpg`, name: 'one.jpg', mimeType: 'image/jpeg', size: 1024 },
  { key: `listings/${owner}/two.jpg`, name: 'two.jpg', mimeType: 'image/jpeg', size: 2048 },
];

function fixture({ userId = owner, storage = null, documents = [] } = {}) {
  const calls = [];
  const repository = {
    list: async (...args) => { calls.push(['list', ...args]); return { listings: [], nextCursor: null }; },
    get: async (...args) => { calls.push(['get', ...args]); return documents.length === 0 && args[0] === 'missing' ? null : { listing: record, documents }; },
    create: async (...args) => { calls.push(['create', ...args]); return record; },
    setSaved: async () => undefined,
    counts: async () => ({ listed: 1, saved: 0 }),
    admitWrite: async () => true,
  };
  return {
    calls,
    handler: createApiHandler({
      repository,
      identify: async () => userId,
      allowedOrigins: ['http://localhost:8081'],
      storage,
    }),
  };
}

const json = (path, method, body, headers = {}) => new Request(`https://api.example.test${path}`, {
  method, headers: { 'Content-Type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const form = (fields, file) => {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  body.append('file', file);
  return new Request('https://api.example.test/uploads', { method: 'POST', body });
};

test('a listing can only attach uploads under the caller own prefix', async () => {
  const { handler, calls } = fixture();
  const stolen = await handler(json('/listings', 'POST', {
    ...input, photos: [{ key: `listings/${other}/secret.jpg` }],
  }));
  assert.equal(stolen.status, 403);
  assert.equal(calls.some(([name]) => name === 'create'), false);

  const mixed = await handler(json('/listings', 'POST', {
    ...input, documents: [{ key: `documents/${other}/deed.pdf`, kind: 'ownership', name: 'deed.pdf', mimeType: 'application/pdf', size: 10 }],
  }));
  assert.equal(mixed.status, 403);
});

test('photos and optional documents travel with the create payload', async () => {
  const { handler, calls } = fixture();
  const response = await handler(json('/listings', 'POST', {
    ...input,
    photos: [
      { key: `listings/${owner}/one.jpg`, width: 1200, height: 900 },
      { key: `listings/${owner}/two.jpg` },
    ],
    documents: [{ key: `documents/${owner}/deed.pdf`, kind: 'ownership', name: 'deed.pdf', mimeType: 'application/pdf', size: 40 }],
  }));
  assert.equal(response.status, 201);
  const created = calls.find(([name]) => name === 'create');
  assert.equal(created[1].photos.length, 2);
  assert.equal(created[1].photos[0].width, 1200);
  assert.equal(created[1].documents[0].kind, 'ownership');
  assert.equal((await response.json()).photos.length, 2);
});

test('a listing without photos or documents still publishes', async () => {
  const { handler, calls } = fixture();
  const response = await handler(json('/listings', 'POST', input));
  assert.equal(response.status, 201);
  const created = calls.find(([name]) => name === 'create');
  assert.equal(created[1].photos, undefined);
  assert.equal(created[1].documents, undefined);
});

test('photo uploads are stored publicly and documents privately', async () => {
  const uploads = [];
  const storage = {
    putPhoto: async (userId, media) => {
      uploads.push(['photo', userId, media]);
      return stored[0];
    },
    putDocument: async (userId, media, kind) => {
      uploads.push(['document', userId, media, kind]);
      return { key: `documents/${owner}/deed.pdf`, name: 'deed.pdf', mimeType: 'application/pdf', size: media.size };
    },
    signDocument: async (key) => `https://signed.example.test/${key}`,
  };
  const { handler } = fixture({ storage });

  const photo = await handler(form({ purpose: 'photo' }, new File([new Uint8Array(1024)], 'one.jpg', { type: 'image/jpeg' })));
  assert.equal(photo.status, 201);
  const photoBody = await photo.json();
  assert.equal(photoBody.url, `https://s3.example.test/listing-photos/${stored[0].key}`);
  assert.equal(photoBody.purpose, 'photo');

  const document = await handler(form(
    { purpose: 'document', kind: 'ownership' },
    new File([new Uint8Array(64)], 'deed.pdf', { type: 'application/pdf' }),
  ));
  assert.equal(document.status, 201);
  assert.equal((await document.json()).url, null);
  assert.equal(uploads[1][3], 'ownership');
});

test('uploads reject unsupported types, missing purpose and unconfigured storage', async () => {
  const storage = {
    putPhoto: async () => stored[0],
    putDocument: async () => stored[1],
    signDocument: async (key) => key,
  };
  const gif = await fixture({ storage }).handler(form(
    { purpose: 'photo' }, new File([new Uint8Array(10)], 'anim.gif', { type: 'image/gif' }),
  ));
  assert.equal(gif.status, 415);

  const noPurpose = await fixture({ storage }).handler(form(
    { purpose: 'video' }, new File([new Uint8Array(10)], 'one.jpg', { type: 'image/jpeg' }),
  ));
  assert.equal(noPurpose.status, 400);

  const noKind = await fixture({ storage }).handler(form(
    { purpose: 'document' }, new File([new Uint8Array(10)], 'deed.pdf', { type: 'application/pdf' }),
  ));
  assert.equal(noKind.status, 400);

  const unconfigured = await fixture().handler(form(
    { purpose: 'photo' }, new File([new Uint8Array(10)], 'one.jpg', { type: 'image/jpeg' }),
  ));
  assert.equal(unconfigured.status, 503);
});

test('the detail route is public for photos and owner-only for documents', async () => {
  const documents = [{
    id: 'doc-1', kind: 'ownership', fileName: 'deed.pdf', mimeType: 'application/pdf',
    size: 4096, objectKey: `documents/${owner}/deed.pdf`, createdAt: '2026-11-17T10:00:00.000000Z',
  }];
  const storage = { putPhoto: async () => stored[0], putDocument: async () => stored[1], signDocument: async (key) => `https://signed.example.test/${key}` };

  const anonymous = await fixture({ storage, documents: [] }).handler(json('/listings/property-1', 'GET'));
  assert.equal(anonymous.status, 200);
  const anonymousBody = await anonymous.json();
  assert.equal(anonymousBody.photos.length, 2);
  assert.deepEqual(anonymousBody.documents, []);

  const signed = await fixture({ storage, documents }).handler(json('/listings/property-1', 'GET'));
  const signedBody = await signed.json();
  assert.equal(signedBody.documents.length, 1);
  assert.equal(signedBody.documents[0].url, `https://signed.example.test/documents/${owner}/deed.pdf`);

  const missing = await fixture({ storage }).handler(json('/listings/missing', 'GET'));
  assert.equal(missing.status, 404);
});

test('signed document links are absent when storage is unconfigured', async () => {
  const documents = [{
    id: 'doc-1', kind: 'tax', fileName: 'receipt.pdf', mimeType: 'application/pdf',
    size: 100, objectKey: `documents/${owner}/receipt.pdf`, createdAt: '2026-11-17T10:00:00.000000Z',
  }];
  const response = await fixture({ documents }).handler(json('/listings/property-1', 'GET'));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).documents, []);
});
