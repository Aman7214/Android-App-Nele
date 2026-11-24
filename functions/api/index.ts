import { attachDatabasePool } from '@neon/functions';
import { Pool } from 'pg';

import { createIdentityVerifier } from './auth.ts';
import { createApiHandler } from './handler.ts';
import { createListingRepository } from './repository.ts';
import { createMediaStorage, photoUrl } from './storage.ts';
import { withRequestTelemetry } from './telemetry.ts';

const { DATABASE_URL, NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL } = process.env;
if (!DATABASE_URL || !NEON_AUTH_BASE_URL || !NEON_AUTH_JWKS_URL) {
  throw new Error('The Neon database and authentication environment must be configured.');
}

const connection = new URL(DATABASE_URL);
connection.searchParams.set('sslmode', 'verify-full');
const pool = new Pool({
  connectionString: connection.toString(),
  max: 5,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
});
attachDatabasePool(pool);

export default {
  fetch: withRequestTelemetry(createApiHandler({
    repository: createListingRepository(pool, { photoUrl }),
    storage: createMediaStorage(),
    identify: createIdentityVerifier(NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL),
    allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? 'http://localhost:8081,http://127.0.0.1:8081')
      .split(',').map((origin) => origin.trim()).filter(Boolean),
  })),
};
