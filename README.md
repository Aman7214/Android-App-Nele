# Nele

An Expo SDK 58 app for buying, renting and listing properties in Raichur district.
Expo Router screens live in `src/app/`. Neon Functions run the API, and Neon Auth
manages accounts. The app never connects directly to Postgres.

Use Node.js 24 or later and npm. Neon is already linked through `.neon`; keep the
existing project and credentials.

## Run the app

```sh
npm install
npm start
```

The app reads `EXPO_PUBLIC_NEON_API_URL` and `EXPO_PUBLIC_NEON_AUTH_URL` from
`.env.local`. These are public HTTPS service URLs. `EXPO_PUBLIC_IMAGE_CDN_URL` is
optional; images are bundled when it is unset. Database passwords, storage keys
and realtime secrets remain server-side. `.env.example` documents the keys
without values. After editing public environment variables, restart Expo and
reload the app.

## Database and API

Migrations live in `db/migrations/` and are applied transactionally over
`DATABASE_URL_UNPOOLED`. The migration runner records checksums and serializes
concurrent runs. Add a new numbered migration when changing the schema; do not
edit an applied migration.

Apply `002_listing_performance.sql` before deploying the current API: its search
queries require the generated `search_text` column. The migration adds a trigram
search index and indexes for town, property type, rental audience and pagination.
Validate it on an expiring test branch first.

```sh
npm run db:migrate
npm run db:seed
npm run backend:deploy
npm run backend:env
npm run neon:env
```

`db:seed` adds the original 14 example properties with a **Sample** badge. It is
optional and preserves existing rows. User properties have a verified account
owner and start with zero reviews. Posting reuses a request ID when retried, so a
lost response does not create a second property.

`backend:deploy` applies the existing `neon.ts` services and the `api` function.
`backend:env` pulls only function URLs, preserving database and storage credentials.
`neon:env` derives the two public Expo URL
aliases without printing any values. Run it after switching Neon branches or
pulling new service URLs, then reload the app.

For local API development, use `npm run backend:dev`. Point the public API URL at
the API function URL printed by `neon dev`; on a physical phone, use a reachable
LAN address instead of localhost. Keep the Auth URL pointed at the selected Neon
branch. New packages added for query caching are JavaScript-only.

The API has paginated `GET /listings`, `GET /saved`, and `GET /mine` routes,
`GET /me` counts, `POST /listings`, and idempotent `PUT`/`DELETE /saved/:id` routes.
Personal routes verify Neon Auth's short-lived JWT and scope every query to its
subject. Posting and saving require sign-in. Only anonymous public queries are
persisted in the offline cache; native session credentials use SecureStore.
The browser uses session cookies with a per-tab session-credential fallback.
Native authentication uses Expo's built-in UUID generator and a JSON response
helper to support the managed client.

Previously posted on-device properties remain in **Profile → My properties**.
Review and publish each one to move it to the account's database listings. It is
removed from device storage only after the server confirms success.

For a deployed web frontend, add its origin to Neon Auth's trusted domains and
to `APP_ALLOWED_ORIGINS` in `.env.local`, then redeploy the API. Native requests
do not send an Origin header. Set the two public URL variables in the relevant
EAS environment when making a mobile build or update.

## Verification

```sh
npm run lint
npm run typecheck
npm test
```

Database integration tests require an expiring child branch named
`codex/nele-database-*`. They refuse to run against production, use a transaction,
and roll back fixtures:

```sh
NELE_INTEGRATION_TEST=1 node --env-file=/path/to/test-branch.env --test tests/database.integration.test.mjs
```

The app-client suite uses the deployed API and managed Auth endpoints. It creates
disposable `.invalid` accounts, reads verification codes only on that test branch,
checks posting, saving, session restoration and account isolation, and removes
its own fixtures. It does not use a real mailbox:

```sh
NELE_APP_INTEGRATION_TEST=1 node --env-file=/path/to/test-branch.env --test tests/app.integration.test.mjs
```

Test migrations on a child of the linked branch before applying them to
production. Use `--no-env-pull` when creating or deploying a test branch and pull
its variables to a separate file to preserve `.env.local`.

## Performance and web hosting

The app uses WebP images, skeleton loading states, debounced searches, paginated
virtualized feeds, shared requests, optimistic saves and a persisted public
React Query cache. A separate CDN or Redis service is optional for this app.
See [PERFORMANCE.md](PERFORMANCE.md) for measurements, the checklist and pending
deployment checks.

```sh
npm run build:web
npm run measure:web
```

The export contains static HTML for each route and separate JavaScript chunks.
Deploy the entire `dist/` directory to a static host with clean-URL support. Keep
`public/_headers` rules on hosts that support that format; on other hosts, set
equivalent immutable caching for hashed assets and revalidation for HTML.
Enable Brotli/Gzip on the static host. API JSON compression is implemented in
the function itself.

Regenerate WebP assets with `npm run images:optimize` using Python 3 and Pillow
with WebP support. Originals remain available for future conversion. If a CDN
is added later, publish `public/images/nele/` at its HTTPS base URL and configure
`EXPO_PUBLIC_IMAGE_CDN_URL`; no provider-specific SDK is required.

API timings appear as `nele.api …` entries in browser Performance recordings.
The most recent 200 timing samples are available through
`getRecentRequestTimings()` in `src/services/performance.ts`, and
`setPerformanceReporter()` accepts an optional monitoring SDK callback.
Server responses expose `Server-Timing`; slow requests and database queries are
logged without account details or search text. OpenTelemetry spans are ready
for a registered tracer provider, but this repository does not yet configure
an exporter or hosted monitoring service.
