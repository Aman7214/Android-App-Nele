import { readFile } from 'node:fs/promises';

import { databaseClient, reportDatabaseError } from './db-client.mjs';

let client;
try {
  const listings = JSON.parse(await readFile(new URL('../db/sample-listings.json', import.meta.url), 'utf8'));
  client = databaseClient();
  await client.connect();
  await client.query('BEGIN');
  let added = 0;
  for (const listing of listings) {
    const result = await client.query(`INSERT INTO nele.listings (
      id, title, kind, locality, town, price, mode, audience, beds, baths,
      area_sqft, image_asset, rating, reviews, badge, is_sample
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Sample',true)
    ON CONFLICT (id) DO NOTHING`, [
      listing.id, listing.title, listing.kind, listing.locality, listing.town,
      listing.price, listing.mode, listing.audience ?? null, listing.beds ?? null,
      listing.baths ?? null, listing.areaSqft, listing.imageAsset, listing.rating, listing.reviews,
    ]);
    added += result.rowCount ?? 0;
  }
  await client.query('COMMIT');
  console.log(`Added ${added} sample properties; existing rows preserved.`);
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  reportDatabaseError(error);
} finally {
  await client?.end();
}
