# Vistaire Vercel Fluid CPU P0-B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans`; use TDD and independent review for each checkpoint.

**Goal:** Cache only safe live landing projections for 900 seconds, invalidate them after every reachable public commit, reduce duplicate menu reads safely, and leave the unprovable public-menu durable cache disabled.

**Architecture:** Versioned tenant/experience/locale/900-second-epoch policy and a recursive capability boundary feed per-experience live-only `unstable_cache` entries. Fallbacks and volatile exchange data stay outside. A central post-commit API schedules immediate tag/path revalidation, with handlers returning controlled responses so Next can flush pending work. Public menus gain request/in-flight deduplication and typed outcomes, not a cross-request completed-value cache.

**Spec:** `docs/superpowers/specs/2026-08-19-vercel-fluid-cpu-cache-p0b-design.md`

## Global constraints

- Start only from the reviewed integrated P0-A checkpoint `ac2bb758db9298bf96d5f40b25f4fa480933fb2a` on `perf/vercel-fluid-cpu-static-public`; B0 reran its read-only cache/mutation preflight at this exact SHA.
- No migration, schema/RPC/trigger change, remote Supabase/Vercel/Cloudflare **setting** mutation, production deployment, paid service, platform migration, load test, or merge to `main`. The user has separately authorized at most two bounded branch pushes (the reviewed runtime checkpoint and the final report-only commit), non-production Preview verification, and final PR creation after all gates.
- Use the current Next caching model and `unstable_cache`; do not enable Cache Components.
- Landing live-data addresses use a 900-second epoch. Static routes retain a 60-second ISR interval. Neither is described as a hard freshness bound during refresh/regeneration failure. Public-menu durable cache stays disabled.
- Cache only live, projected, recursively safe values. Never cache fallback, null, private capability, signed URL, Owner/Admin/session data, or volatile provider fallback.
- Schedule invalidation only after a confirmed public commit and before unrelated cleanup. Any later failure must be caught and converted to a controlled `Response`; a thrown post-commit error can bypass Next’s pending-revalidation flush.
- Use npm; add no dependency or heavy asset.
- Run tests RED before implementation and record exact evidence in ignored task reports.
- Each task ends in a focused commit and independent review; fix every Critical/Important or P0/P1 finding with a reproducing test.

## Checkpoint order and ownership

| Task | Owner files | Depends on |
| --- | --- | --- |
| B0 design checkpoint | P0-B spec and plan only | reviewed final P0-A SHA |
| B1 policy/safety | `lib/cache/publicCachePolicy.ts`, `lib/cache/publicCacheSafety.ts`, `lib/landing/landingDishIdentity.ts`, focused tests | B0 |
| B2 landing cache/API | landing loader/facade, narrow render-context split, preview handler, six page configs, landing tests | B1 |
| B3 invalidation API | `lib/owner/menuMutationRevalidation.ts`, invalidation harness | B1 |
| B4a content/media | menu mutations, category/dish handlers, photo, admin availability | B3 |
| B4b settings/translations/UI | settings, translations, fallback, UI config, unique design and handlers | B3 |
| B4c restaurant lifecycle | creation/status/delete libraries and handlers | B3 |
| B4d 3D metadata | Meshy/viewer/USDZ libraries and reachable model handlers | B3 |
| B5 menu preparation | `lib/menu/publicMenu.ts`, narrow translation provenance if needed, menu cache contract | B1; B3 API stable |
| B6 integration/report | only proven fixes, E2E, P0-B report | B2–B5 reviewed |

Do not edit another active owner’s files. Stage explicit files only. Preserve user/concurrent changes.

---

### Task B0: Pin, review, and commit the P0-B design

**Files**

- `docs/superpowers/specs/2026-08-19-vercel-fluid-cpu-cache-p0b-design.md`
- `docs/superpowers/plans/2026-08-19-vercel-fluid-cpu-cache-p0b.md`

- [ ] After P0-A is fully reviewed, record its exact final SHA and rerun the read-only cache/mutation preflight against that SHA.
- [ ] Verify installed Next stale-on-error and pending-revalidation flush semantics against source and current official docs.
- [ ] Independently review the design/plan; correct every Critical/Important finding before runtime work.
- [ ] Stage only these two documents and commit: `docs: design safe Vercel CPU P0-B caching`.

No B1 runtime edit begins before this checkpoint.

---

### Task B1: Cache policy and recursive private-capability safety

**Files**

- Create `lib/cache/publicCachePolicy.ts`
- Create `lib/cache/publicCacheSafety.ts`
- Modify `lib/landing/landingDishIdentity.ts`
- Modify `lib/landing/landingMenuUiPreview.ts` only if a failing projection contract requires it
- Create `tests/public-cache-policy.test.mjs`
- Create `tests/public-cache-signed-material.test.mjs`
- Extend `tests/landing-public-payload-safety.test.mjs`

- [ ] Write RED key/tag tests for deterministic versioning, canonical `fr`/`en`, invalid inputs, maximum lengths, restaurant/experience/locale non-collision, and a deterministic 900-second `landingCacheEpoch(nowMs)` boundary.
- [ ] Write RED recursive-safety tests for mixed-case credential keys, URL userinfo, Supabase sign paths, nested configs/arrays, cycles, depth/node limits, safe internal redirects, and redacted errors.
- [ ] Implement the smallest dependency-free policy module with `LANDING_DATA_CACHE_SECONDS=900`, `STATIC_LANDING_FALLBACK_RETRY_SECONDS=60`, versioned epoch-bearing landing key parts, epoch-independent scoped tags, and future revision-bearing menu helpers. Do not implement a menu cache.
- [ ] Implement the bounded cycle-safe classifier/assertion. Reuse it from landing dish identity without changing redirect behavior.
- [ ] Run focused tests, landing safety/identity suites, typecheck, lint, static import CLI, and diff check.
- [ ] Self-review and independent review.
- [ ] Commit: `feat: define safe public cache boundaries`.

Rollback: revert this commit; no cached runtime consumer exists until B2.

---

### Task B2: Live-only landing cache, private preview API, and 60-second route retry

**Files**

- Modify `lib/landing/menuExperiences.ts`
- Modify `lib/landing/publicLandingMenuData.ts` while preserving its exact reviewed delegate/facade boundary
- Modify `lib/menu/publicMenuRenderContext.ts` only for a stable presentation/exchange split
- Modify `app/api/public/landing-menu-preview/[experienceId]/route.ts`
- Modify the six consumers:
  - `app/(fr)/page.tsx`
  - `app/(en)/en/page.tsx`
  - `app/(fr)/(seo)/menu-digital-restaurant/page.tsx`
  - `app/(fr)/(seo)/menu-pdf-vs-menu-digital/page.tsx`
  - `app/(en)/en/digital-restaurant-menu/page.tsx`
  - `app/(en)/en/pdf-vs-digital-menu/page.tsx`
- Create `tests/landing-menu-cache-contract.test.mjs`
- Update only directly coupled landing/import/artifact contracts
- Update `scripts/ci/check-static-public-import-boundary.mjs` and its tests only if the exact facade delegate contract must change

- [ ] Build a deterministic fake cache clock/backend and write RED tests for cold/warm reuse inside one epoch, a new addressed entry exactly at the 900,000 ms epoch boundary, per-experience/per-locale isolation, and exact tags.
- [ ] Write RED tests proving transient first-fill failure, null, not-ready, wrong identity, unsafe payload, and editorial fallback are never stored; immediate recovery must return live data. Prove a previous-epoch entry is unreachable when the new-epoch fill fails.
- [ ] Write RED tests proving exchange-rate fallback is outside the 900-second candidate.
- [ ] Write RED handler tests for private/no-store headers on success and every error.
- [ ] Write RED source/behavior tests for exactly six `revalidate=60` consumers.
- [ ] Refactor to one live-only cached builder per kind/experience/locale/epoch. Throw typed unavailable/readiness errors inside the cached scope; apply fallback outside. Run recursive safety as the last candidate check.
- [ ] Split stable presentation data from exchange-rate state without changing public menu route output.
- [ ] Make the preview handler dynamic and private/no-store at every response boundary.
- [ ] Add the six route revalidation exports; describe 60 seconds as an ISR interval, not a hard freshness bound. Remove/replace obsolete composite 60-second cache assertions without weakening the four-to-900 intended proof.
- [ ] Add an explicit regression/source contract for Next stale-on-error semantics: the epoch prevents prior Data Cache reuse, while an outer failed ISR regeneration may still serve old HTML until a later successful regeneration.
- [ ] Run focused cache/API tests, landing i18n/showcase/fixture tests, static import CLI, typecheck, lint, and diff check.
- [ ] Independently review live-only/fallback behavior and cache serialization.
- [ ] Commit: `perf: cache validated landing data for fifteen minutes`.

Rollback: revert B2; B1 remains inert policy/safety code.

---

### Task B3: Central post-commit invalidation API

**Files**

- Modify `lib/owner/menuMutationRevalidation.ts`
- Create `tests/menu-mutation-cache-invalidation.test.mjs`

- [ ] Write RED tests for pre-commit identity, exact tags, featured-only six paths, non-featured isolation, `revalidateTag(tag,{expire:0})`, all-attempted behavior after one failure, and structured redacted scheduling reports that never claim actual platform expiry.
- [ ] Write ordering harness primitives for `commit < tag/path scheduling < cleanup`, partial commit, failed/no-op/draft/dry-run, and delete identity.
- [ ] Write a Route Handler response/error harness proving post-commit cleanup failures are caught, invalidation is scheduled idempotently, and a controlled `Response` is returned so Next reaches its pending-revalidation flush path. A spy-only helper test is insufficient.
- [ ] Implement `resolvePublicMutationIdentity` and `invalidateCommittedPublicMutation` while preserving existing precise menu/dish paths.
- [ ] Freeze the exported callback/options/report interface for B4 owners.
- [ ] Run focused tests plus existing revalidation tests, typecheck, lint, and diff check.
- [ ] Independent API/security review.
- [ ] Commit: `feat: expire public cache after committed mutations`.

Rollback: revert B3 before any B4 commit; B2 then relies on TTL only.

---

### Task B4a: Category, dish, photo, and admin-availability commit hooks

**Files**

- `lib/owner/menuMutations.ts`
- category/dish Route Handlers under `app/api/owner/restaurants/[restaurantId]/menu/**`
- owner dish photo Route Handler
- `app/(fr)/admin/api/dishes/[dishId]/availability/route.ts`
- directly corresponding tests

- [ ] RED: primary-menu partial commit invalidates even if later category/dish creation fails.
- [ ] RED: category/dish update/delete invalidate only after success.
- [ ] RED: dish delete/photo upload/photo delete schedule before fallible asset cleanup; a cleanup failure becomes a controlled handler response and cannot escape as an arbitrary throw after commit.
- [ ] RED: admin availability expires after successful RPC callback only.
- [ ] Wire B3 callbacks at exact commit boundaries; no product/data-shape change.
- [ ] Run focused and existing owner/admin/photo tests, typecheck, lint, diff check.
- [ ] Independent review and commit: `feat: invalidate cache for menu content commits`.

---

### Task B4b: Settings, translations, published UI, and unique-design hooks

**Files**

- `lib/owner/menuSettingsMutation.ts`
- `lib/owner/menuTranslations.ts`
- `lib/owner/publicMenuSettingsFallback.ts`
- `lib/owner/menuUiConfigStore.ts`
- `lib/owner/uniqueMenuDesignStore.ts`
- their directly coupled Route Handlers and tests

- [ ] RED: normal/legacy/unique-style public settings schedule immediately after their confirmed write/RPC, before draft UI sync; post-commit sync failures return controlled responses.
- [ ] RED: translation upsert/repair expires the affected locale; generated UI copy expires only after the public menu write; dry-runs/job rows alone do not.
- [ ] RED: draft save/revert-to-draft does not expire; publish/rollback expires after final published update.
- [ ] RED: every successful unique-design action affecting published identity expires.
- [ ] Wire B3 API without changing copy, generation, status, or publication behavior.
- [ ] Run focused settings/translation/UI/unique tests, typecheck, lint, diff check.
- [ ] Independent review and commit: `feat: invalidate cache for published menu settings`.

---

### Task B4c: Restaurant lifecycle commit hooks

**Files**

- `lib/owner/restaurantCreation.ts`
- `lib/owner/restaurantStatus.ts`
- `lib/owner/data.ts` only if narrow callback plumbing is required
- restaurant create/status/archive/delete Route Handlers and direct tests

- [ ] RED: normal creation schedules after successful RPC even if response-shape validation later fails; the committed-error path returns a controlled response.
- [ ] RED: fallback creation invalidates every confirmed public partial commit on success/failure paths; draft UI insertion alone does not.
- [ ] RED: status/archive/restore uses pre-commit identity and invalidates after success without changing visibility semantics.
- [ ] RED: delete captures slug before the RPC and expires after `deleted`, before storage cleanup; both handlers share the library hook.
- [ ] Wire B3 callbacks; do not add migrations or new archive behavior.
- [ ] Run creation/status/delete tests, typecheck, lint, diff check.
- [ ] Independent review and commit: `feat: invalidate cache for restaurant lifecycle commits`.

---

### Task B4d: Reachable 3D public-metadata commit hooks

**Files**

- `lib/owner/restaurantMeshyPipeline.ts`
- `lib/owner/viewerGlbUpload.ts`
- `lib/owner/usdzRuntimeJsonFlow.ts`
- reachable GLB/publish/viewer/USDZ-complete/model-delete handlers
- directly corresponding model/3D tests

- [ ] RED: Meshy GLB/publish, viewer GLB, and USDZ completion call `onPublicCommit` immediately after `menu_dishes.update` and before cleanup; reachable handlers convert later cleanup failure to a controlled response.
- [ ] RED: start/prepare/fail paths and unreachable 410 pipeline do not claim public invalidation.
- [ ] RED: model delete adds tags after public metadata commit while preserving existing path invalidation.
- [ ] Wire B3 callbacks only; do not touch assets, Storage policy, model format, 3D UI, or retired code.
- [ ] Run focused model/3D/source tests, assets, LFS, typecheck, lint, diff check.
- [ ] Independent review and commit: `feat: invalidate cache for public model commits`.

---

### Task B5: Safe public-menu request deduplication; durable gate remains disabled

**Files**

- Modify `lib/menu/publicMenu.ts`
- Modify `lib/menu/publicMenuTranslations.ts` only if typed provenance needs a narrow boundary
- Create `tests/public-menu-cache-contract.test.mjs`

- [ ] RED: canonical slug/locale request memoization and same-process concurrent calls share one in-flight promise.
- [ ] RED: the in-flight map is empty immediately after resolve or reject; later calls execute again.
- [ ] RED: typed `live`, `not_found`, and `temporarily_unavailable` outcomes preserve current public behavior without persisting null/demo/translation/UI fallback.
- [ ] RED: restaurant/locale keys cannot collide.
- [ ] RED: production durable cache gate is absent/false and no `unstable_cache` wraps the public menu.
- [ ] RED harness: two independent instances reproduce tag-only stale resurrection; revision-bearing keys prevent it in the future model.
- [ ] Implement only settle-and-delete single-flight and typed internal outcomes, preserving React request memoization and all renderer behavior.
- [ ] Run focused cache contract plus public-menu/translation/render/asset redirect tests, typecheck, lint, diff check.
- [ ] Independent concurrency/security review.
- [ ] Commit: `perf: deduplicate concurrent public menu reads`.

Rollback: revert B5; landing cache and invalidation remain correct.

---

### Task B6: Integrated build, browser QA, review, Preview, and report

**Files**

- Create `docs/reports/2026-08-19-vercel-fluid-cpu-p0b.md`
- Modify only files required by a proven final-gate or review failure

- [ ] Run one final focused Node command covering all new P0-B suites and all mutation owners.
- [ ] Run `npm ls --depth=0`, assets, LFS, typecheck, lint, build, static import/route/artifact scanners, and `git diff --check` once at integrated HEAD.
- [ ] Inspect build artifacts for signed/private capability patterns and confirm the six landing consumers remain static/ISR with a 60-second ISR interval and epoch-addressed live Data Cache policy at 900. Do not claim either is a hard stale-on-error bound.
- [ ] Run Chromium and WebKit against `/`, `/en`, four comparison pages, `/demo`, `/en/vistaire-menu`, one featured menu and dish at 390/430. Verify preview API private/no-store, no console/network 404/500, no overflow, and no eager GLB/USDZ.
- [ ] Dispatch whole-P0-B independent review. Fix every Critical/Important or P0/P1 finding with RED→GREEN and scoped re-review.
- [ ] Under the user’s explicit publication authorization, push the reviewed runtime checkpoint, wait for its non-production Vercel Preview to become READY, then run the bounded P0-A header checks plus P0-B landing/API/menu smokes. Do not modify a remote setting or deploy production.
- [ ] Report base/head, files, keys/tags, TTL layers, invalidation matrix, commit ordering, menu no-go proof, signed-material proof, commands/results, browser/Preview evidence, no migration, remote-setting mutation, production deployment, or paid change, the authorized branch push/Preview/PR activity, residual risks, and post-rollout 24/72-hour NON-VERIFIABLE CPU slope.
- [ ] Clean generated browser/build output not intentionally retained; verify no secret/env/heavy asset/migration/debug file.
- [ ] Commit: `docs: report Vercel CPU P0-B evidence`.
- [ ] Push that report-only commit as the second and final bounded branch push. If it creates another non-production Preview, wait for required status checks; do not repeat request-level testing unless runtime code changed.
- [ ] Use the finishing/verification/GitHub publishing workflows to create the final PR only after all branch gates and Preview checks pass.

## Completion definition

P0-B is complete when landing live-data caching, safety, post-commit invalidation coverage, menu request deduplication, integrated tests/build/browsers, independent review, controlled Preview, and evidence report are green. It does not require—and explicitly forbids—enabling an unsafe public-menu durable cache without the separately authorized database revision primitive.
