# Vistaire Vercel Fluid CPU P0-B Cache Design

## Decision and authority

Continue on `perf/vercel-fluid-cpu-static-public` after the reviewed P0-A checkpoint `ac2bb758db9298bf96d5f40b25f4fa480933fb2a`. The user explicitly authorized completion of P0-B and every later phase before the final pull request.

The B0 read-only preflight was rerun at that exact SHA. It reconfirmed exactly four existing `revalidate: 60` landing declarations, the installed Next 16.2.11 stale-on-error implementation, and that arbitrary Route Handler throws bypass `resolvePendingRevalidations()` while normal/redirect responses reach it. Changes since the earlier pinned audit include the exact `publicLandingMenuData.ts` facade and stricter static import/route scanners already owned by B2; no migration, revision primitive, transaction-wide public-menu snapshot, or newly safe durable menu-cache boundary appeared.

P0-B reduces repeated public-data work without adding a paid service, migrating platform, changing a remote setting, applying a database migration, or weakening tenant isolation and freshness. It deliberately keeps the existing Next.js caching model and `unstable_cache`; Cache Components are not enabled as part of this work.

The binding implementation decision is:

1. raise only the validated, live landing-data cache to 900 seconds;
2. keep editorial/transient fallbacks outside the durable cache;
3. preserve a 60-second Full Route Cache revalidation interval for the six static consumers;
4. schedule landing tag/path revalidation only after confirmed public commits and preserve Next’s response flush path;
5. keep the public-menu cross-request durable cache disabled because the repository has no authoritative transaction-scoped public revision shared by every writer;
6. still implement safe menu request deduplication, typed outcomes, future key/tag policy, private-capability rejection, and complete mutation hooks.

Each landing cache address includes an externally computed 900-second epoch. This is required because Next 16.2.11 normally returns stale `unstable_cache` data while refreshing and swallows a refresh error by returning that stale value. A new epoch addresses a new entry, so a failed first fill reaches the uncached fallback instead of silently reusing the prior epoch.

The disabled menu cache is an evidence-backed completed safety outcome, not an unfinished shortcut. Enabling it without a database revision would permit a cross-instance stale fill to be written after an invalidation and served for the remainder of the TTL.

## Certified facts

- Next.js is `16.2.11`; the repository does not enable Cache Components.
- `unstable_cache` is currently used only by the four landing entries in `lib/landing/menuExperiences.ts`, all at 60 seconds and without tags.
- The public menu has React request memoization but no production cross-request durable cache.
- Public-menu assembly spans multiple independent Supabase REST calls and therefore is not one transaction or consistent snapshot.
- No repository migration, RPC, trigger, or row supplies one revision incremented atomically by every public category, dish, translation, settings, UI, media, model, restaurant, and script mutation.
- Supabase Data REST resolves one request to one SQL statement. Database functions can provide a transaction, but no suitable function exists in the repository.
- Private Supabase Storage assets require authentication or time-limited signed URLs; signed URLs remain valid until expiry. Such URLs must never cross a 900-second cache boundary.
- `revalidateTag(tag, { expire: 0 })` is available from Route Handlers in the installed/current API. `updateTag` is Server-Action-only and is not the primitive for the repository’s Route Handler mutation surface.
- P0-A produces six static consumers of landing data: `/`, `/en`, two French comparison pages, and their two English equivalents.

## Freshness contract

### Landing

The landing is an editorial teaser, not the authoritative restaurant menu. A successfully validated live projection may be reused for up to 900 seconds.

In-app public mutations schedule immediate tag expiry and path revalidation after the database commit. This is best-effort invalidation, not linearizable distributed consistency. Repository maintenance scripts and unknown external writers do not participate in that scheduling.

The 900-second value is the live Data Cache address epoch/revalidation interval, not a universal maximum-age promise. A caller that reaches the landing Data Cache after the epoch changes cannot receive the previous epoch’s entry; if the new live fill fails, it receives the uncached editorial fallback. However, Next’s outer Full Route Cache/ISR can continue serving prior successful HTML while a regeneration fails. Observable route freshness therefore depends on a successful subsequent regeneration and has no hard wall-clock bound during a source outage. This stale-on-error behavior is accepted and tested explicitly rather than misreported as a 900-second guarantee.

A transient read failure, missing featured dish, wrong locale/identity, unsafe payload, incomplete translation, or editorial fallback must not be stored for 900 seconds. The request may use the existing deterministic fallback outside the cached scope, while the six static routes retain a 60-second regeneration retry.

### Public menu

Public menu and dish routes remain dynamic and authoritative. No completed menu value, `null`, demo fallback, partial translation/UI fallback, or signed capability may be stored across requests.

Same-request memoization and same-process in-flight coalescing are allowed. The in-flight entry must be keyed by canonical slug and locale and removed in `finally` immediately when the promise settles. It is not a cache of completed values and provides no cross-instance correctness claim.

The production menu 900-second switch remains absent/disabled until a later authorized database design provides:

- one authoritative tenant/menu public revision;
- an atomic revision increment in every in-app and out-of-band public mutation;
- a consistent payload/revision read or before/after revision check;
- cross-instance stale-resurrection proof;
- complete publisher participation and invalidation recovery.

## Cache architecture

### Pure policy

`lib/cache/publicCachePolicy.ts` owns:

- `LANDING_DATA_CACHE_SECONDS = 900`;
- `STATIC_LANDING_FALLBACK_RETRY_SECONDS = 60`;
- canonical `fr`/`en`, experience, slug, restaurant, menu, and version normalization;
- versioned landing experience/payload key parts;
- a deterministic `landingCacheEpoch(nowMs)` 900-second bucket included in every addressed landing entry;
- tenant/experience/locale-scoped tags;
- future revision-bearing menu key/tag helpers, without a production durable wrapper;
- length and invalid-input guards.

Landing entries are split by `(payload kind, experienceId, locale, epoch)`. One featured restaurant failure cannot cool the other experiences, FR/EN entries cannot collide, and Next cannot serve the previous epoch after a refresh failure at the Data Cache layer.

### Private-capability boundary

`lib/cache/publicCacheSafety.ts` owns a cycle-safe, bounded recursive assertion over the complete candidate immediately before it returns from a cached live builder.

It rejects, case-insensitively:

- credential query names including `token`, `signature`, `expires`, and AWS signing keys;
- URL username/password;
- Supabase `/storage/v1/object/sign/` paths;
- nested capability material in arrays, objects, UI config, redirects, and future fields.

Errors disclose only a structural path and reason, never the credential value or full sensitive URL. Stable internal public redirect paths and immutable public/static assets remain allowed. `landingDishIdentity.ts` reuses this classifier; dynamic signing stays in `lib/publicDishAssetRedirect.ts`.

### Live-only landing builders

The cached function resolves exactly one live experience/payload and throws a typed unavailable/readiness error for every non-live result. Only a projected, identity-checked, locale-correct, recursively safe live value may resolve.

The public getter catches only those typed operational/readiness errors and applies the existing editorial fallback outside `unstable_cache`. Unexpected programmer errors remain visible.

Exchange-rate provider/fallback state stays outside the 900-second stable presentation snapshot. Existing dynamic public-menu behavior remains unchanged.

### Preview API

`/api/public/landing-menu-preview/[experienceId]` remains dynamic. Success and every validation/readiness/not-found/error response use all of:

```text
Cache-Control: private, no-store, max-age=0
CDN-Cache-Control: private, no-store
Vercel-CDN-Cache-Control: private, no-store
```

The internal Data Cache protects Supabase; the HTTP response must not add a separately uninvalidatable CDN cache.

### Static-route retry

The six landing consumers explicitly export `revalidate = 60`. This is a Full Route Cache revalidation interval, not the live-data TTL or a hard freshness bound. Regeneration is visit-driven and normally consumes the warm current-epoch landing Data Cache. If regeneration fails, Next may continue serving the prior successful route output; the report and tests must disclose this stale-on-error behavior.

## Invalidation architecture

`lib/owner/menuMutationRevalidation.ts` becomes the single policy boundary.

- Resolve and retain public identity before destructive commits.
- Compute every tag/path before invalidation begins.
- Call `revalidateTag(tag, { expire: 0 })` for the relevant restaurant/experience/locale entries. This queues pending revalidation work; it does not prove that the platform has executed expiry at the call site.
- Preserve existing precise menu/dish `revalidatePath` behavior.
- Revalidate the six static landing paths only for a featured landing restaurant.
- Attempt every required tag/path even if one call throws; return a structured non-secret scheduling-attempt report (`attempted`, `queuedCallReturned`, `enqueueErrors`) for logging/tests. Never label it actual platform expiry success.
- Never query a deleted restaurant after commit.

Invalidation is scheduled only after a confirmed public commit and before unrelated fallible storage, AI, job, or cleanup work. Next flushes pending revalidations only when a Route Handler returns a normal or redirect `Response`; an arbitrary thrown post-commit error can bypass that flush. Therefore every reachable handler with fallible post-commit work must catch that failure, idempotently schedule the mutation identity again if needed, and return a controlled non-secret `Response` instead of rethrowing. A library may return a structured committed-with-cleanup-error outcome to let the handler do this. Multi-step non-transactional operations schedule after every visible committed portion or on a controlled partial-commit response path. Failed/no-op/dry-run/draft-only writes do not schedule invalidation.

The mutation inventory covers:

- category and dish create/update/delete, including implicit primary-menu creation;
- admin availability;
- dish photo upload/delete;
- normal, legacy, and unique-style public menu settings;
- translation upsert/metadata repair and generated localized UI copy;
- published UI config publish/rollback, excluding draft-only operations;
- unique-design actions that affect published identity;
- Meshy, viewer GLB, USDZ completion, and model-delete public metadata commits;
- restaurant create, archive/restore/status, and cascade delete.

The currently unreachable 410 USDZ pipeline is not wired. If re-enabled, its public commit must adopt the same hook first.

## Security and isolation invariants

- No cache key based only on locale or raw user input.
- Restaurant A, restaurant B, FR, and EN cannot collide.
- No Owner/Admin object, auth/session state, cookie, secret, service key, signed URL, raw storage path, capability token, preview-only value, or transient provider fallback in a 900-second entry.
- No fallback or nullable failure is durably cached.
- No cross-request menu cache is enabled.
- Preview responses are private/no-store.
- Invalidation runs after commit and does not falsely report database rollback if cache expiry fails.
- Logs and test errors never print secret values.

## Tests and acceptance

### Core policy/safety

- deterministic versioned keys/tags;
- tenant/locale/experience isolation and length guards;
- all credential forms, nested values, cycles, depth/node bounds, safe internal redirects;
- error redaction.

### Landing cache

- cold/warm behavior within one epoch and a new addressed entry at the 900,000 ms epoch boundary;
- split experience and locale behavior;
- immediate recovery after a transient first-fill failure proves fallback was not stored;
- a prior-epoch live value is unreachable when the next epoch fill fails, while outer ISR stale-on-error remains an explicit residual;
- null/readiness/identity/unsafe results are not stored;
- volatile exchange fallback remains outside the snapshot;
- preview success and every error are no-store;
- featured invalidation evicts exact entries and paths while unrelated tenants stay warm;
- six static consumers retain a 60-second revalidation interval without a hard freshness claim.

### Mutation ordering

- `DB commit < tag/path scheduling call < cleanup`;
- no invalidation on failed/no-op/draft-only/dry-run writes;
- partial committed writes still invalidate;
- all tags/paths attempted after an individual scheduling-call failure;
- delete uses pre-commit identity;
- every reachable commit boundary in the inventory has a source/behavior contract.
- post-commit cleanup/error paths return a `Response` and do not bypass Next’s pending-revalidation flush; tests distinguish scheduling from actual platform execution.

### Menu safety

- durable production gate remains disabled;
- canonical request memoization and settle-and-delete in-flight coalescing;
- typed `live`, `not_found`, and `temporarily_unavailable` outcomes are not persisted;
- tenant/locale isolation;
- a two-instance tag-only harness reproduces stale resurrection;
- a revision-key model demonstrates the future safe design without adding a migration.

### Integrated gates

- focused Node suites plus existing landing/menu/mutation/model tests;
- typecheck, lint, assets, LFS, build, static import/route/artifact scanners;
- Chromium and WebKit on landing/static/public menu surfaces at 390 and 430 px;
- preview API headers and no eager GLB/USDZ;
- one controlled non-production Vercel Preview after the whole branch is reviewed.

## Out of scope

- database schema, trigger, RPC, migration, or remote Supabase change;
- production durable public-menu cache;
- Cache Components/`use cache` migration;
- product copy, CSS, restaurant visuals, auth, analytics, QR, AR/3D assets, or route redesign;
- Cloudflare/Vercel dashboard mutation, production deploy, paid service, load test, or merge to `main`.

## Residual risks and explicit completion boundary

- Landing invalidation has no durable outbox. A post-commit scheduling or platform-expiry failure cannot roll back the database. The next Data Cache epoch prevents reuse of the prior entry once a live builder is reached, but outer ISR can serve stale-on-error until regeneration succeeds.
- Out-of-band scripts do not call Next invalidation. Their change becomes visible only after a new epoch is addressed and route regeneration succeeds; there is no hard wall-clock promise during an outage.
- Multi-query reads may observe different statement times; only validated public projections are cached.
- Local tests cannot prove Vercel’s distributed implementation or production Active CPU slope. The controlled Preview proves behavior; 24/72-hour production slope monitoring requires a separately authorized production rollout.
- The future menu 900-second cache remains explicitly blocked. P0-B is complete when the safe landing cache, invalidation coverage, menu preparation, tests, reports, and Preview gate are green—not when an unsafe menu cache is forced on.

## Official semantics checked on 2026-08-19

- Next.js `unstable_cache`, previous caching model, `revalidateTag`, `updateTag`, `revalidatePath`, and multi-instance cache-handler documentation.
- Supabase Data REST API, database functions, Storage private/signed asset documentation, and current breaking-change changelog.
