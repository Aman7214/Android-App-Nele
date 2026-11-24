import pg from 'pg';

export function databaseClient() {
  const value = process.env.DATABASE_URL_UNPOOLED;
  if (!value) throw new Error('DATABASE_URL_UNPOOLED is required for database setup.');
  const url = new URL(value);
  if (url.hostname.includes('-pooler')) {
    throw new Error('Database setup requires the direct, unpooled connection.');
  }
  url.searchParams.set('sslmode', 'verify-full');
  return new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15_000 });
}

export function reportDatabaseError(error) {
  console.error(`Database operation failed (${error.code || error.name || 'unknown'}). Credentials were not logged.`);
  process.exitCode = 1;
}
