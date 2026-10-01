# Supabase egress runtime correction — 2026-09-13

Runtime changes are implemented and measured locally. They have **not been deployed to production**. No production mutation, photo processing, or provider-period improvement is claimed. PR checks and the immutable delivery SHA are recorded in the pull request, separately from this measurement report.

## Scope and evidence

Base: `2220762673087226f7ed914d8aca97f13d3baa78` (`origin/main`, merged #236). Branch: `perf/supabase-egress-runtime`. The original dirty checkout was preserved in full; implementation used a clean isolated worktree. #248 was rechecked: open, head `c4afca096af3d9da93c645092fc15437b542db9a`, read-only workflow/preflight scope. Runtime work is a separate PR.

Verified target: Vistaire, `bkpewsjvxswqruwqljcy`, active healthy, us-west-2; organization CapoShip, Free plan. Historical 3.965/5 GB and 1.336/5 GB screenshots are not current metrics. Current billing period, uncached/cached egress totals, service breakdown, endpoint frequencies, robot/CI/Preview attribution and partial-response volumes: **NOT_MEASURED**. The exposed Supabase tools did not provide usage/log queries. Vercel deployment access returned 403 for the Vistaire team; its build/runtime logs were not accessible.

Storage occupancy is not egress. Browser response bytes are not automatically Supabase-to-Next bytes. Cached traffic is still traffic; do not add cached egress to a chart that already includes it. Supabase documents the separate quotas and inclusive Total Egress chart in [egress usage](https://supabase.com/docs/guides/platform/manage-your-usage/egress). Smart CDN is a paid-plan capability, not assumed on this Free project: [official CDN documentation](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

| Candidate | Evidence and frequency | Confidence | Action |
| --- | --- | --- | --- |
| Duplicate published UI configuration reads | Two different PostgREST queries on every measured menu/detail server render; 9 real HTTP reads before, 8 after | High for the measured requests; monthly share unknown | Use the same scoped, projected published query in both loaders |
| Draft configuration overfetch | Public loader fetched all statuses; renderer fetched published separately; synthetic 8 KiB draft regression reproduces the discarded payload | High for code/fixture; production draft volume not estimated | Read published first; preserve legacy language fallback only when no published row exists |
| Unused Admin analytics | Availability invoked dashboard loader and discarded both current/previous event periods, including on refresh | High; 2 removed reads per measured render, volume depends on actual events | Extract the existing menu-only loader; retain dashboard analytics |
| Original photos served for all variants | 84 sources, no derivatives; bounded HEAD sample resolves thumbnail and display to the same 2,018,000-byte PNG original | High for inventory and sample; monthly share unknown | Keep valid fallback; backfill blocked by capacity |
| Speculative 3D downloads | Consumer inspection and browser checks show intent gating already present | No demonstrated new defect | No viewer or model change |
| Per-locale repeated SDK calls | Real Next transport already deduplicates identical GETs | Not an extra wire-traffic cause in the measured render | No additional React cache or persistent menu cache |

## Minimal implementation and regression protection

| File | Why it changed |
| --- | --- |
| `lib/menu/publicMenu.ts` | Filter UI configuration by restaurant and published status, limit 1; retain legacy draft-language fallback only when absent |
| `lib/menu/publicMenuRenderContext.ts` | Use identical projection/filter/order/limit through the existing rows helper, enabling existing Next request deduplication |
| `lib/admin/dashboardData.ts` | Extract menu-only reads, then compose unchanged current/previous analytics in the dashboard loader |
| `app/(fr)/admin/availability/page.tsx` | Invoke menu-only loader after the same access check |
| `components/admin/availability/AdminAvailabilityPage.tsx` | Narrow its input type to the fields actually consumed; rendered markup unchanged |
| `tests/public-menu-request-reads.test.mjs` | Exercise real Supabase SDK plus Next dedupe fetch under React server rendering; assert count, projection, locales, tenant isolation, fresh requests, legacy fallback and failure behavior |
| `tests/admin-analytics-isolation.test.mjs` | Assert identical menu data with no analytics reads; retain scoped public-query assertions |
| `tests/admin-availability.test.mjs` | Update the loader-name contract while preserving access and mutation assertions |
| `tests/demo-restaurant-experiences-contract.test.mjs` | Adapt the existing source assertion to the rows-helper syntax; continue requiring the restaurant-scoped published filter |
| `package.json` | Run the new regression test in the existing Supabase suite already used by CI; no dependency or lockfile change |
| This report | Publish sanitized measurements, limitations, backfill gate and rollout instructions |

The live partial unique index `menu_ui_configs_restaurant_published_key` and migration 0008 both guarantee one published row per restaurant. Consequently `orderBy: id` is equivalent to the prior updated-at ordering for the published query. No SQL, migration, permissions, analytics definition, public route, 3D file, image, workflow, or dependency changed.

## Before/after measurements

Both sides use optimized `next build` + `next start`, the same existing `e2e/support/sauge-noire-fixture-server.mjs`, Node 25.2.1, npm 11.6.2, Next 16.3.4, React 19.2.8, Supabase JS 2.112.4 and Playwright 1.62.1. Baseline build was completed before runtime edits and retained until measurements finished. After build used the corrected sources. Supabase points exclusively to loopback; credentials are synthetic. A temporary HTTP wrapper counted actual response bodies at the fixture server, not SDK method invocations. Counters reset between observations. Admin uses a signed synthetic session and fixture QR record; authorization remains active.

These are exact local JSON response-body bytes, excluding headers and compression, **not production billing bytes**. The existing fixture does not fully emulate PostgREST projections; the separate SDK regression fixture does. Photo fixtures are small SVGs and cannot establish production photo savings. The Admin HTTP fixture has no analytics events, so the two removed empty arrays total only four bytes; no event-volume estimate is substituted.

| Server route, first and repeat opens | REST calls before → after | JSON bytes before → after | HTML body bytes before = after |
| --- | ---: | ---: | ---: |
| `/menu/maison-elyse` | 9 → 8 | 4,505 → 4,248 | 36,177 |
| `/menu/sauge-noire` | 9 → 8 | 74,700 → 74,203 | 114,155 |
| `/menu/trouvable` | 9 → 8 | 4,466 → 4,219 | 37,710 |
| Maison fixture dish: `/menu/maison-elyse/dishes/ravioles-de-chevre-frais-miel-de-monteregie` | 9 → 8 | 4,505 → 4,248 | 30,963 |
| Authenticated `/admin/availability` | 7 → 5 | 2,223 → 2,219 | 33,538 |

All responses above were 200. No signature was generated by these HTML-only requests. The unit-level projected fixture containing an 8 KiB unpublished draft measured 9 → 8 requests and 15,650 → 6,831 bytes. That larger difference is synthetic and must not be advertised as a production percentage.

Browser measurements include follow-on image authorization/metadata reads, so their DB totals exceed the HTML-only totals. Cold means the first image request in a newly started server process. A repeat navigation uses the same browser and process. Request interception disables browser HTTP caching; these repeats primarily demonstrate application-process reuse, not a CDN or browser cache HIT. Widths 430 and 1280 occur after the 390 run and already have warm process asset caches.

| Browser opening | REST calls before → after | JSON bytes before → after | Photo response-body bytes before = after | Signatures before = after |
| --- | ---: | ---: | ---: | ---: |
| Maison 390, first | 13 → 12 | 6,130 → 5,873 | 1,852 | 1 |
| Maison 390, repeat | 12 → 11 | 4,981 → 4,724 | 1,852 | 0 |
| Maison 430/1280, first and repeat | 12 → 11 | 4,981 → 4,724 | 1,852 | 0 |
| Sauge 390/430/1280, closed cover, first and repeat | 9 → 8 | 74,700 → 74,203 | 0 | 0 |
| Trouvable 390, first | 13 → 12 | 6,047 → 5,800 | 896 | 1 |
| Trouvable 390, repeat | 12 → 11 | 4,971 → 4,724 | 896 | 0 |
| Trouvable 430/1280, first and repeat | 12 → 11 | 4,971 → 4,724 | 896 | 0 |
| Admin 390/430/1280, first and repeat | 9 → 7 | 3,537 → 3,533 | Not separately measured | Not separately measured |

Photo counts include both the application redirect endpoint and final Storage response: Maison 4, Trouvable 2 per navigation, unchanged. Zero photos on Sauge's closed cover does not mean missing photos on its visible dish pages. Those pages were separately verified in existing media-policy tests.

18 menu observations and 6 authenticated Admin observations were collected on each side. All had no horizontal overflow or observed console/runtime errors. The menu runs had no unexplained failed responses and no GLB/USDZ requests before intent. Admin search and availability filters remained functional.

The existing Sauge 3D state-reset tests additionally exercised explicit viewer opening, A→B→C navigation while a GLB remained pending, history and previous navigation at 390/430 in Chromium and WebKit. These are regression checks on the corrected build, **not before/after byte measurements of the entire 3D journey**. Native Quick Look and Scene Viewer on physical devices were not tested. Detailed initiator stacks, Range/cancellation wire bytes, LCP and provider CDN savings are NOT_MEASURED. No new Vercel image optimizer or additional service was introduced; billed Vercel cost is NOT_MEASURED.

## Production read budget and delivery observations

Production operations were bounded read-only SQL, three menu HTML reads and a single-photo HEAD comparison. HTML response bodies totaled 668,143 bytes (decoded application output, not Supabase egress). Photo/model binary bytes downloaded: **0**. No refresh loop or exhaustive media fetch was performed; the 25 MiB diagnostic download budget was not approached. Production logs and SQL transport bytes were not independently metered.

The three canonical menu responses were 200, dynamic `private, no-cache, no-store, max-age=0, must-revalidate`, with Vercel MISS. Their HTML sizes were 231,471 / 183,428 / 253,244 bytes. One real Maison dish route resolved from HTML was `/menu/maison-elyse/dishes/tartare-de-saumon-label-rouge`; the controlled fixture uses the different valid dish above.

The sampled `thumbnail` and `display` photo requests returned 307; redirect `Cache-Control: no-store`, CDN `public, s-maxage=120, must-revalidate`, Vercel MISS. Both resolved to the same signed original; no URL or token is published here. Final Storage HEAD: 200, image/png, Content-Length 2,018,000, `Cache-Control: no-cache`, Cloudflare MISS then REVALIDATED. A HEAD Content-Length is object metadata, **not a downloaded body**. It does not prove that all production photos have the same cache behavior.

Cache contracts remain unchanged: per-render Next request deduplication; no completed cross-request public menu cache; existing bounded process caches for asset metadata/signatures and in-flight deduplication; version/variant-scoped redirect paths; real JWT deadline checks; composed public revocation ceiling 300 seconds; Admin media `private, no-store`. Mutation invalidation, stale in-flight results, denied access and missing media remain covered by the existing Supabase/Admin suites. A CDN HIT would not mean zero billed cached egress.

## Existing photo processing: blocked, zero writes

Production inventory was revalidated: 12 Maison, 36 Sauge, 36 Trouvable sources; 84 source paths match Storage metadata; zero derivatives. All buckets remain private. Object checksums were not downloaded. Source bytes by restaurant are 25,057,749 / 19,184,932 / 10,576,897 (total 54,819,578). Three-dimensional assets occupy 944,391,517 bytes but occupancy does not establish their request frequency or egress share.

Read-only gate executed against the confirmed project, last checked at 2026-09-13 04:30:08 UTC:

```sql
select now() as observed_at,
       public.get_media_capacity_state('bkpewsjvxswqruwqljcy') as ledger,
       (select coalesce(sum((metadata->>'size')::bigint),0)
          from storage.objects) as storage_metadata_bytes,
       (select count(*) from storage.buckets where public) as public_buckets;
```

Observed quota ledger: 1,000,000,000 bytes; used: 999,211,095; active reserved: 0; independent Storage metadata sum: 999,211,095; measurement timestamp still 2026-08-22 18:45:58 UTC. The RPC's `available` status means the state is readable, not that capacity authorization passed. Its 15-minute freshness gate fails. Current metadata independently confirms just 788,905 bytes headroom (0.0788905%), before derivatives. Vistaire requires 20% after writes: `used + reserved + newBytes <= 0.8 * quota`. The deficit is already **199,211,095 bytes plus the actual derivative bytes**. Freshness alone cannot fix the capacity gate. No ledger timestamp, quota, reservation or safety threshold was modified.

The workflow's RFC-version/variant regex also rejects Maison's real legacy UUID `11111111-1111-1111-1111-111111111111`; the CLI accepts its safe UUID syntax. The restaurant was not renamed and the workflow was not expanded in this runtime PR. #248 alone cannot resolve capacity or this canary mismatch.

No `--measure-only` run was started: code inspection confirms it downloads originals before its capacity check. Downloading all sources with a proven failed gate would consume quota without permitting apply. An eventual measured canary must use the existing `dish-photo-v2` WebP recipe (320/768/1440 widths), the exact code SHA, immutable objects, atomic reservations, checkpoint/idempotency and hash verification. Concurrency remains 2 by default, maximum 4.

Separate future budget: a measure plus apply pass reads sources twice, or 50,115,498 bytes for Maison and 109,639,156 bytes for all 84, plus derivative verification downloads. Actual derivative writes `D` and verification bytes are NOT_MEASURED, so an executable total budget cannot yet be approved. Shared immutable targets must be deduplicated in that accounting. No former derivative-size estimate is substituted.

Photos processed: 0; derivatives produced: 0; uploaded bytes: 0; deleted/overwritten originals: 0; production mutations: 0; processing errors: 0 because apply was not attempted. All 84 remain pending, not falsely reported as successful or skipped by an executed pipeline.

## Validation and remaining release steps

Installation: `npm ci --no-audit --no-fund`, 591 packages, lockfile unchanged. Commands were executed via `node E:/Stocks/Node/node_modules/npm/bin/npm-cli.js` because the bare npm/npx launcher points to a missing roaming installation.

- `npm run assets:check`: passed.
- `npm run lfs:check`: passed, zero pointer blobs or LFS rules.
- `npm run lint`: passed after removing an unused variable in a temporary proof script; no product lint waiver.
- `npm run typecheck`: passed.
- `npm run build`: baseline and corrected optimized builds passed; 42 static pages generated.
- `npm run test:admin`: 427 passed, zero skipped.
- `npm run test:supabase-efficiency-v2`: 185 passed, zero skipped, including the added transport regression.
- Targeted additional public/Admin Node contracts: 38 passed; independent implementation agents also ran their scoped contracts and lint.
- Temporary Playwright network probe: 12 passed after correction; corresponding 9 menu + 3 Admin baseline cases passed, 24 observations per side.
- Existing Sauge media-policy menu/detail tests: 4/4 passed after correction, Chromium and WebKit. The baseline four-test run had 3 passes and one WebKit current-sheet `src` assertion failure; an earlier baseline run of the menu test passed in both engines. This pre-existing intermittent activation timing is not claimed fixed, and no test assertion was removed.
- Existing Sauge 3D state-reset suite: 4/4 passed after correction, at 390/430 in Chromium/WebKit.
- Existing `ar-renderer-handoff.spec.ts`: 1/1 passed in Chromium with Android user-agent simulation; copy-only fallback after explicit 3D opening remained functional. This is not physical-device AR validation.
- Independent final code review: no P0/P1/P2 findings. The orchestrator also read the integrated diff directly.

The first remote CI run passed build, database contracts, security, and the Supabase/Admin suites, then caught a landing source-contract assertion still expecting the former `.eq("status", "published")` syntax. It was updated to require the equivalent helper filter **including restaurant scope**; the assertion was preserved, not deleted. The final PR records the replacement head and check results.

The bare `npm run test:e2e` was not run as an exhaustive suite. Existing targeted specs were run directly through the installed Playwright CLI to reuse the already-running production fixture server: the normal wrapper tried to bind that same fixture port and failed EADDRINUSE. Initial sandbox browser launch failed EPERM; the authorized execution with cache access succeeded. The temporary Admin probe's first run used an incorrect accessible-name selector for a status message; verifying its actual text fixed only the private probe. No production or existing E2E assertion was changed.

Interactive Chrome connection was attempted and returned `Browser is not available: chrome`; only the in-app browser was listed. Chromium/WebKit automation supplied the network and runtime checks, but interactive Chrome DevTools and real-device AR remain unverified. PostgreSQL migration suites were not run locally because no SQL, RLS, capacity logic or mutation implementation changed; CI selects its applicable database contracts. No production backfill workflow was dispatched.

Release remains a human-authorized merge and production promotion of the reviewed PR, followed by a small same-route production measurement and an actual provider observation period. The existing deployed SHA observed through GitHub deployment status was `3d12b700a282cfd2a6802c5c01bbda4a975072d0`; this is not the corrected code. Rollback is a normal revert of the runtime commit and a separately authorized redeploy; no data rollback is required.

Backfill needs an approved real capacity remedy, a truthful fresh capacity reconciliation, a canary invocation accepting the actual restaurant ID, and then a freshly measured bounded report before additive apply. No paid-plan change, deletion or threshold reduction is authorized by this report. Until then, originals remain valid fallbacks and production photo egress improvement is unverified.

Temporary instrumentation, build output, Playwright reports and debug files are excluded from the PR and removed from the task worktree after verification; necessary sanitized proof is kept outside served files. No secrets, cookies, signed URLs, raw HAR, private per-object inventories or media assets are committed. The original user's files remain untouched.
