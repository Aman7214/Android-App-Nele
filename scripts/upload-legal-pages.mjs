#!/usr/bin/env node
/**
 * Publishes the Play-Console-facing legal pages to the public `legal` bucket.
 *
 * Google Play requires a privacy-policy URL and an account-deletion URL that
 * work in a browser without the app installed, so these pages live on the
 * branch's object storage rather than only inside the app.
 *
 *   node --env-file=.env.local scripts/upload-legal-pages.mjs
 */
import { readdir, readFile } from 'node:fs/promises';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const BUCKET = 'legal';
const directory = new URL('../public/legal/', import.meta.url);

const endpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/+$/, '');
if (!endpoint) {
  console.error('AWS_ENDPOINT_URL_S3 is missing. Run `neon env pull` first.');
  process.exit(1);
}

const types = new Map([
  ['html', 'text/html; charset=utf-8'],
  ['css', 'text/css; charset=utf-8'],
]);

const client = new S3Client({ forcePathStyle: true });
const files = (await readdir(directory)).filter((file) => /\.(html|css)$/.test(file)).sort();

const urls = [];
for (const file of files) {
  const body = await readFile(new URL(file, directory));
  const extension = file.split('.').pop();
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: file,
    Body: body,
    ContentType: types.get(extension) ?? 'application/octet-stream',
    // Short cache so an edit to the terms shows up without a redeploy.
    CacheControl: 'public, max-age=3600',
  }));
  if (extension === 'html') urls.push(`${endpoint}/${BUCKET}/${file}`);
  console.log(`uploaded ${file} (${body.byteLength} bytes)`);
}

console.log('\nPublic URLs:');
for (const url of urls) console.log(`  ${url}`);
