import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createListingRepository } from '../functions/api/repository.ts';

const input = {
  requestId: 'atomic-publish-test', title: 'Test family house', kind: 'House', locality: 'Bank Colony',
  town: 'raichur', price: 21000, mode: 'rent', audience: 'family', areaSqft: 1200, imageAsset: 'house',
};
const photo = { key: 'listings/test-user/photo.jpg', width: 100, height: 100 };
const document = { key: 'documents/test-user/deed.pdf', kind: 'ownership', name: 'deed.pdf', mimeType: 'application/pdf', size: 64 };

function fixture({ failDocuments = false, failRollback = false } = {}) {
  let committed = { listing: null, photos: [], documents: [] };
  const releases = [];
  const pool = {
    query: async () => { throw new Error('Publication escaped its checked-out connection.'); },
    connect: async () => {
      let working;
      return {
        query: async (sql, values) => {
          if (sql === 'BEGIN') { working = structuredClone(committed); return { rows: [] }; }
          if (sql === 'COMMIT') { committed = working; return { rows: [] }; }
          if (sql === 'ROLLBACK') {
            if (failRollback) throw new Error('Rollback connection failed');
            working = undefined;
            return { rows: [] };
          }
          assert.ok(working, 'Writes must run inside the transaction.');
          if (sql.startsWith('INSERT INTO nele.listings')) {
            working.listing ??= {
              ...input, id: 'property-1', rating: 0, reviews: 0, saved: false, isSample: false,
              status: 'active', createdAt: new Date('2026-11-01'), soldAt: null,
            };
          } else if (sql.startsWith('DELETE FROM nele.listing_photos')) working.photos = [];
          else if (sql.startsWith('INSERT INTO nele.listing_photos')) {
            if (new Set(values[1]).size !== values[1].length) throw new Error('Duplicate photo');
            working.photos = values[1].map((objectKey, index) => ({ objectKey, width: values[3][index], height: values[4][index] }));
          } else if (sql.startsWith('DELETE FROM nele.listing_documents')) working.documents = [];
          else if (sql.startsWith('INSERT INTO nele.listing_documents')) {
            if (failDocuments) throw new Error('Document insert failed');
            working.documents = values[3];
          } else assert.ok(sql.startsWith('SELECT '), 'Unexpected publication query.');
          return { rows: [{ ...working.listing, photos: working.photos }] };
        },
        release: (error) => { releases.push(error); },
      };
    },
  };
  return { repository: createListingRepository(pool), read: () => committed, releases };
}

test('publication commits one listing together with its ordered photos and documents', async () => {
  const { repository, read, releases } = fixture();
  const result = await repository.create({ ...input, photos: [photo], documents: [document] }, 'test-user');
  assert.equal(read().listing.id, result.id);
  assert.deepEqual(result.photos.map((item) => item.key), [photo.key]);
  assert.deepEqual(read().documents, [document.key]);
  assert.deepEqual(releases, [undefined]);
});

test('an attachment failure leaves no partially published listing or photos', async () => {
  const { repository, read, releases } = fixture({ failDocuments: true });
  await assert.rejects(repository.create({ ...input, photos: [photo], documents: [document] }, 'test-user'), /Document insert failed/);
  assert.deepEqual(read(), { listing: null, photos: [], documents: [] });
  assert.deepEqual(releases, [undefined]);
});

test('a failed retry preserves the photos attached by the successful publish', async () => {
  const { repository, read, releases } = fixture();
  await repository.create({ ...input, photos: [photo] }, 'test-user');
  await assert.rejects(repository.create({ ...input, photos: [photo, photo] }, 'test-user'), /Duplicate photo/);
  assert.deepEqual(read().photos.map((item) => item.objectKey), [photo.key]);
  assert.equal(releases.length, 2);
});

test('rollback connection failures discard the connection and preserve the original error', async () => {
  const { repository, read, releases } = fixture({ failDocuments: true, failRollback: true });
  await assert.rejects(repository.create({ ...input, documents: [document] }, 'test-user'), /Document insert failed/);
  assert.equal(read().listing, null);
  assert.equal(releases[0].message, 'Rollback connection failed');
});
