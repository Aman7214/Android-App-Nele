# Performance work

Separate CDN and Redis services are optional at this stage. Native images are
bundled and cached, React Query caches API data, and the API keeps a small,
short-lived anonymous listing cache. A static web host can provide edge delivery
and compression without adding another service.

## Measured results

Measured on 17 November 2026 using production Expo SDK 58 exports. Gzip values
use Node's default compression level, counting each JavaScript file separately.
These are asset-size measurements, not measured improvements in user latency.

| Measurement | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| 12 listing/onboarding photos | 2,484,768 B JPEG | 1,089,408 B WebP | 56.2% |
| Exported icon fonts | 4,076,840 B / 19 fonts | 389,724 B / 1 font | 90.4% |
| All web JavaScript | 4,079,268 B | 3,681,452 B | 9.8% |
| All web JavaScript, gzip | 933,572 B | 818,293 B | 12.3% |
| Initial `/` JavaScript references | 3,436,476 B | 2,714,883 B | 21.0% |
| Initial `/` JavaScript references, gzip | 831,209 B | 587,195 B | 29.4% |

The web export has 34 chunks and 17 static HTML routes. Granular splitting loads
the chunks required by each route; native exports remain a single Hermes bundle
per platform. `experiments.chunking.mode` is experimental and can be removed to
return to Expo's default splitting strategy.

The current Home page references 722,715 B of gzipped JavaScript, Explore
716,335 B, and Profile 701,481 B. HTML references include preload resources;
the actual transfer depends on browser caching and navigation history.

Reproduce the measurements with:

```sh
npx expo export --platform web --output-dir /private/tmp/nele-measured-web --clear
node scripts/measure-web-export.mjs /private/tmp/nele-measured-web
```

Original JPEGs remain available. `npm run images:optimize` regenerates the WebP
files, hashed public copies and image manifest with Python/Pillow.

## Checklist

“Implemented” describes the workspace source. Backend changes still require
migration validation and deployment before they affect live requests.

| # | Request | Result |
| --- | --- | --- |
| 1 | Skeleton loading screens | Implemented for Home, Explore, Saved, My properties and Profile counts. Placeholders preserve layout and announce loading without adding continuous animation. |
| 2 | WebP or AVIF | Implemented with WebP for all 12 property/onboarding photos. |
| 3 | Prevent duplicate API calls | Identical GETs share a request across screens. Session reads use single-flight. Save, publish and verification actions guard rapid repeated taps. |
| 4 | Debounce search/autocomplete | Home and Explore search use 300 ms debounce and normalized query keys. No remote autocomplete feature exists. |
| 5 | Paginate API results | Cursor pagination fetches 20 records by default, up to 50. Timestamp plus ID ordering preserves ties and microseconds. |
| 6 | CDN static delivery | Optional HTTPS image base URL, hashed public assets and cache headers are prepared. No separate provider is required or configured. |
| 7 | Background jobs | No current AI, upload processing, email worker or other slow application task needs a queue. Image conversion runs at build time; compression uses asynchronous Node APIs. |
| 8 | N+1 queries | Feeds fetch listings and saved flags in one SQL request. Saving uses one atomic query after the write-quota check. |
| 9 | Brotli/Gzip | Implemented for API JSON above 1 KiB when compression saves bytes, including quality negotiation. Static hosting compression is a host setting. |
| 10 | Redis cache | Deferred. React Query and the bounded 30-second anonymous API cache cover current needs. Redis would become useful for cache sharing across busy instances or distributed jobs. |
| 11 | Remove unused dependencies | Removed 13 unused direct dependencies; the offline install pruned 113 packages. Direct Ionicons imports exclude unused icon families from exports. |
| 12 | External request timeouts | App API deadline is 20 seconds including token refresh and body reading; Auth is 15 seconds, JWKS 5 seconds, database connection/query limits 10 seconds. |
| 13 | Stream AI responses | No AI response feature exists. |
| 14 | Optimistic UI / lazy images | Saves update the query cache before the response, with isolated rollback. Below-screen web images use lazy loading; initial photos have higher priority. |
| 15 | Parallel independent requests | Different routes/accounts run independently. Sharing applies only to matching reads. |
| 16 | Database indexes | Migration 002 adds stored searchable text, a trigram GIN index and common filter/pagination indexes. It has not been applied to the live database. |
| 17 | OpenTelemetry tracing | Request/database spans, sanitized slow logs and Server-Timing are implemented. An SDK tracer provider and exporter are still required for exported traces. |
| 18 | Servers near database | The API uses existing Neon Functions alongside the selected Neon database branch. No unrelated server region was introduced. |
| 19 | Server/build rendering | Web output now generates static HTML for each route. Account data and property results still load on the client. |
| 20 | Defer third-party scripts | No analytics/ad script tags are installed. The existing animation runtime is part of the splash route. |
| 21 | Split JavaScript by page | Expo SDK 58 web route splitting is enabled; granular splitting further separates shared chunks. |
| 22 | Virtualize long lists | All property feeds, including legacy on-device properties, use FlatList. Batches and windows are bounded. Onboarding initially renders one slide. |
| 23 | Select required columns | SQL projects only listing fields used by the app, plus cursor/saved metadata; counts use one aggregate query. |
| 24 | Database pooling | The API uses a reusable pool capped at five connections per instance and Neon's pool lifecycle hook. |
| 25 | Avoid unnecessary renders | Narrow Zustand selectors, memoized feed transformations, stable pagination callbacks and React Compiler reduce repeated work. |
| 26 | Browser cache / load balancing | Hashed static assets have one-year immutable cache headers, HTML revalidates, and personal API data is no-store. Multi-instance load balancing is an infrastructure decision; current Neon hosting manages the function runtime. |
| 27 | Fonts / font weights | Text uses system fonts; only the required bundled Ionicons font is exported. No remote font service or added font weights. |
| 28 | Real-user performance | Bounded request timing samples and browser Performance measures are implemented. `setPerformanceReporter` can forward samples to a chosen tool. No hosted RUM tool or Expo Observe project is configured. |
| 29 | Test slow conditions | Automated tests cover stalled fetches/token refresh/body reads, cancellation, failures and retries. Physical-device and throttled-browser testing remain to be performed. |

## Cache and request behavior

Public React Query data is fresh for 60 seconds and may be persisted for 24 hours
for offline browsing. Personal query data is not persisted and is removed when
the account changes. Filter changes retain previous pages only within the same
feed/account while new results load.

The API cache stores at most 100 anonymous pages for 30 seconds, coalesces reads,
and invalidates after publishing. Public responses allow edge caching for 30
seconds plus 60 seconds of stale-while-revalidate; that can delay newly posted
properties for anonymous viewers. Errors and authenticated responses are
`no-store`. ETags apply only to public responses and vary by encoding.

Cancelling one screen releases only its subscriber. The source aborts when the
last subscriber leaves, including before queued work starts. Failed requests
are removed so a retry creates fresh work. Session-generation checks prevent a
late unauthorized response from signing out a newer session.

## Verification and pending deployment

Completed:

- `npx expo lint` and `npx tsc --noEmit` passed.
- `npm test`: 62 passed; the two live integration suites were skipped.
- Production web, Android and iOS exports passed.
- Offline SDK dependency checking reported compatible installed versions; a
  full network-backed `expo-doctor` check has not been run.

Live verification has not completed. Automatic approval review failed with an
Azure resource mismatch during earlier network requests; the latest read-only
connection retry timed out during automatic review. The production
environment has an Auth URL but no `EXPO_PUBLIC_NEON_API_URL`; the last remote
inspection found only the hello function deployed. Local Auth URL configuration
was repaired, but a full live sign-up/post/save flow has not been verified.

Before deployment:

1. Use an expiring `codex/nele-database-*` child branch with a separate env file.
2. Apply migration 002 on that branch and run the database integration suite.
3. Deploy the API on the test branch and run the app-account integration suite.
4. Apply the validated migration and deploy the API on the linked app branch.
5. Pull function URLs, run `npm run neon:env`, restart Expo and reload the app.

Do not deploy the new search query before migration 002; `search_text` is
required. Keep `.env.local` and the linked project configuration intact during
test-branch validation. Never place database credentials in public Expo variables.

## Monitoring and slow-device follow-up

Record a browser Performance trace to inspect `nele.api …` measures. The
`getRecentRequestTimings()` helper returns a copy of the most recent 200 samples,
and `setPerformanceReporter()` accepts a synchronous or async callback for a
chosen monitoring SDK. Samples contain route templates, duration and status;
they omit account IDs, search text, tokens and response bodies. Reporter failures
never interrupt app requests.

Backend spans require a registered OpenTelemetry SDK provider and exporter.
No exporter endpoint or credentials have been invented. Expo Observe is an
optional native alternative, but requires linking an EAS project and making a
development/production build; it does not run in Expo Go.

For the next device check, use an Android phone with limited RAM and a production
build. On web, throttle network and CPU, then test cold start, fast search typing,
filter changes, long scrolling, repeated saves, offline reopening and account
switching. Inspect layout stability, visible image loading and whether failed
saves restore the correct property. Browser UI and real-device checks have not
been claimed by this local test run.

References: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/),
[images](https://docs.expo.dev/versions/v58.0.0/sdk/image/),
[static rendering](https://docs.expo.dev/router/web/static-rendering/),
[route splitting](https://docs.expo.dev/router/reference/async-routes/),
[Expo Observe](https://docs.expo.dev/eas/observe/get-started/).
