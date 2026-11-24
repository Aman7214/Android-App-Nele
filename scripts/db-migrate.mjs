import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

import { databaseClient, reportDatabaseError } from './db-client.mjs';

const directory = new URL('../db/migrations/', import.meta.url);
let client;
let locked = false;

try {
  client = databaseClient();
  await client.connect();
  await client.query('SELECT pg_advisory_lock(1730149210)');
  locked = true;
  await client.query(`CREATE TABLE IF NOT EXISTS public.nele_schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const files = (await readdir(directory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows } = await client.query('SELECT checksum FROM public.nele_schema_migrations WHERE name = $1', [file]);
    if (rows.length) {
      if (rows[0].checksum !== checksum) throw new Error(`Applied migration ${file} has changed.`);
      console.log(`Already applied: ${file}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO public.nele_schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
      await client.query('COMMIT');
      console.log(`Applied: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} catch (error) {
  reportDatabaseError(error);
} finally {
  if (locked) await client.query('SELECT pg_advisory_unlock(1730149210)');
  await client?.end();
}
