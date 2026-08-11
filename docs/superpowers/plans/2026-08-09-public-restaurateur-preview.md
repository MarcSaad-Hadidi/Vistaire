# Public Restaurateur Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two existing public restaurateur-preview routes with a faithful, interactive, bilingual, deterministic, public-safe demonstration of the current Vistaire admin product.

**Architecture:** Keep metadata/chrome/QR/footer server-rendered and isolate interactive demo state in one client controller. Reuse only audited prop-driven admin primitives and charts; use preview-owned types, fixture, shell, images, lists, and controls so the public import graph cannot reach admin auth, data, routes, or mutations.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS Modules, existing Vistaire admin primitives/charts, Node test runner, Playwright Chromium/WebKit, npm.

## Global Constraints

- Base every worktree on `origin/main` at `2043d4f949956174287003fa3dd72e7763a80e0c`; never edit main or the dirty original checkout.
- Preserve `/apercu-restaurateur` and `/en/restaurant-preview`; create no competing route.
- Public preview requires zero admin auth/cookies, zero Supabase reads/writes, zero private endpoint requests, zero product mutations, zero admin/owner links/forms, and zero 3D model/runtime requests.
- All visible data comes from one deterministic synthetic fixture; no `Math.random()`, current-time data generation, localStorage, or sessionStorage.
- Exactly three accessible product tabs with ArrowLeft/ArrowRight/Home/End and one active tabpanel.
- Availability changes are React-local, cross-tab coherent, announced as unsaved, and reset on reload.
- Complete FR/EN copy includes hidden chart/accessibility text; optional shared copy props retain identical French defaults for `/admin`.
- No new dependency, chart system, heavy asset, public media, LFS rule, auth/data/owner/3D change, or Production Smoke change.
- Test first: each production behavior must be preceded by a focused failing Node or Playwright contract and an observed expected failure.
- Prompt 7 Node, Chromium, and WebKit suites must be referenced by existing CI families and locked by a dependency-free execution contract.

---

### Task 1: Make audited admin chart primitives bilingually reusable

**Files:**
- Modify: `components/admin/system/AdminPrimitives.tsx`
- Modify: `components/admin/charts/ChartFrame.tsx`
- Modify: `components/admin/charts/InteractiveLineChart.tsx`
- Modify: `components/admin/charts/InteractiveDonut.tsx`
- Modify: `components/admin/charts/InteractiveHeatmap.tsx`
- Modify: `components/admin/charts/ComparisonLineChart.tsx`
- Modify: `components/admin/charts/Sparkline.tsx`
- Test: `tests/admin-interactive-charts.test.mjs`

**Interfaces:**
- Consumes: current French admin props and output.
- Produces: optional `locale?: "fr" | "en"` and narrowly scoped `copy` props; omitted props retain current French labels and formatting.

- [ ] **Step 1: Add failing contracts for defaults and English overrides**

  Assert that every component retains its current French strings when props are omitted, while source exposes typed English overrides for definition labels, exact-value table labels, stable-activity copy, donut descriptions, heatmap scale, comparison delta/unavailable copy, number locale, and Sparkline fallback.

- [ ] **Step 2: Verify RED**

  Run `node --test tests/admin-interactive-charts.test.mjs` and require failure because English copy/locale props do not exist.

- [ ] **Step 3: Implement the minimal optional copy surface**

  Add optional typed props at each component boundary. Use constants whose French values equal the current strings. Thread overrides only through affected aria labels, captions, tooltips, number formatters, and visible scale labels. Do not touch chart geometry, interaction state, admin routes, data calculations, or CSS.

- [ ] **Step 4: Verify GREEN and admin stability**

  Run `node --test tests/admin-interactive-charts.test.mjs tests/admin-dashboard-ui.test.mjs` and `npm run typecheck`.

- [ ] **Step 5: Commit**

  Commit only the files above as `refactor(admin): allow localized presentation copy`.

### Task 2: Add CI and security contracts before product code

**Files:**
- Create: `tests/restaurateur-preview-fixture.test.mjs`
- Create: `tests/restaurateur-preview-security.test.mjs`
- Create: `tests/restaurateur-preview-ci-contract.test.mjs`
- Create: `e2e/support/restaurateur-preview-request-policy.mjs`
- Create: `e2e/restaurateur-preview.spec.ts`
- Modify: `tests/ci-change-detection.test.mjs`
- Modify: `scripts/ci/detect-changes.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/app-ci.yml`

**Interfaces:**
- Consumes: future preview exports `restaurateurPreviewFixture`, `getPreviewPeriod`, and derived insight helpers, plus stable `data-demo-*` selectors.
- Produces: `npm run test:restaurateur-preview:node`, `npm run test:restaurateur-preview:e2e`, public Chromium/WebKit inclusion, and a static import graph denylist.

- [ ] **Step 1: Write the CI execution contract and change-classification tests**

  Require both preview routes, `components/vistaire-preview`, `lib/restaurateurPreview`, and the Prompt 7 spec to set `public_navigation`; require `run_webkit` for that flag; require the Node suite in `static-quality`, the dependency-free CI contract in `fast-gate`, and the E2E spec in both `test:ci:e2e:core` and `test:ci:e2e:webkit`.

- [ ] **Step 2: Verify RED for CI**

  Run `node --test tests/restaurateur-preview-ci-contract.test.mjs tests/ci-change-detection.test.mjs`; require failures for missing Prompt 7 scripts and missing WebKit classification.

- [ ] **Step 3: Wire the existing CI families**

  Add scripts without adding dependencies or workflows. Extend `detect-changes.mjs` with the exact route/library/spec patterns and include `flags.public_navigation` in `run_webkit`. Keep retries zero and the existing anti-skip reporter.

- [ ] **Step 4: Write fixture and transitive static-boundary tests**

  Require 4 categories, 12 unique dishes, 10 initially available, public images, exact periods `24h|7d|30d`, coherent series/top/category/search/service/heatmap totals, derived comparisons/insights, and no random/current-time generation. Walk literal TS imports transitively from both pages and reject `server-only`, auth/cookies/headers, Supabase/Clerk, admin/owner modules and routes, private loaders/components, fetch/router refresh, persistence, nonliteral dynamic imports, and 3D runtimes.

- [ ] **Step 5: Verify RED for product contracts**

  Run `npm run test:restaurateur-preview:node`; require failure because preview fixture, demo UI, and safe graph do not yet exist.

- [ ] **Step 6: Write the Playwright behavior and request policy**

  For FR and EN, assert anonymous 200, one H1, explicit demo disclosure, three keyboard tabs, five Overview KPIs, deterministic period changes, Availability search/filters/local toggle/live feedback/cross-tab/reload reset, complete Insights panels and chart alternatives, exact public CTA, no private links/forms/requests/writes/cookies, no model/video traffic, clean console/network/hydration, no overflow and 44px targets at 390/430/768/1280/1440, canonical/hreflang/x-default, safe JSON-LD, and reduced motion. Separate framework-internal POST classification from product mutation classification.

- [ ] **Step 7: Commit**

  Commit the intentionally RED product contracts plus GREEN CI wiring as `test(preview): lock public dashboard safety and CI` and record the expected product-test failures in the report.

### Task 3: Build the deterministic bilingual public demo

**Files:**
- Create: `lib/restaurateurPreview/types.ts`
- Create: `lib/restaurateurPreview/fixture.ts`
- Create: `lib/restaurateurPreview/copy.ts`
- Create: `lib/restaurateurPreview/insights.ts`
- Create: `components/vistaire-preview/RestaurateurDashboardDemo.tsx`
- Create: `components/vistaire-preview/RestaurateurPreviewShell.tsx`
- Create: `components/vistaire-preview/RestaurateurDemoOverview.tsx`
- Create: `components/vistaire-preview/RestaurateurDemoAvailability.tsx`
- Create: `components/vistaire-preview/RestaurateurDemoInsights.tsx`
- Create: `components/vistaire-preview/PreviewDishImage.tsx`
- Create: `components/vistaire-preview/RestaurateurDashboardDemo.module.css`
- Modify: `components/vistaire-preview/VistaireRestaurateurDashboardPreview.tsx`
- Modify: `components/vistaire-preview/VistaireRestaurateurDashboardPreview.module.css`
- Modify: `app/apercu-restaurateur/page.tsx`
- Modify: `app/en/restaurant-preview/page.tsx`

**Interfaces:**
- Consumes: localized chart props from Task 1 and stable selectors/contracts from Task 2.
- Produces: server page shell plus `RestaurateurDashboardDemo({ locale, fixture })`; preview-only `PreviewFixture`, `PreviewPeriodId`, and derived insight functions.

- [ ] **Step 1: Implement the fixture only until invariant tests pass**

  Define `Maison Élyse — Démo`, four categories with dish counts `2+5+2+3`, twelve public-image dishes, ten initial availabilities, and fixed period payloads. Freeze exported data. Implement pure sums, comparisons, summaries, and FR/EN insight generation. Do not import any `lib/admin/dashboardData` type.

- [ ] **Step 2: Verify fixture GREEN**

  Run `node --test tests/restaurateur-preview-fixture.test.mjs`; require all arithmetic, determinism, identity, image, and derived-copy assertions to pass.

- [ ] **Step 3: Implement the controller and accessible shell**

  Keep `activeTab`, `period`, and `Record<dishId, boolean>` in `RestaurateurDashboardDemo`. Implement roving tab focus and automatic activation for ArrowLeft/ArrowRight/Home/End. Render only the selected panel. Announce local toggle feedback through `AdminToast`. Do not persist state.

- [ ] **Step 4: Implement Overview and Availability using safe primitives**

  Render five localized KPI cards and the real panel families with current period data. Build preview-owned public dish images and local `AdminToggle` controls. Search uses localized case folding; filters expose `aria-pressed`; summary and Overview available KPI derive from controller state.

- [ ] **Step 5: Implement Insights and lazy selection**

  Dynamically load the Insights panel only after selection. Render activity, equal-duration comparison, heatmap, top dishes, searches, category donut, service donut, period summary, and derived key insights with English chart copy supplied explicitly.

- [ ] **Step 6: Rebuild the server page composition**

  Make the dashboard the dominant surface. Keep one H1, visible demo badge and privacy explanation near the dashboard, one primary appointment CTA, one sample-menu CTA, secondary QR, and PreviewFooter. Remove `/admin` CTA and the four unoptimized marketing-image imports. Update metadata/Service/WebPage/Breadcrumb descriptions without fixture numbers or synthetic claims.

- [ ] **Step 7: Verify static security and Node GREEN**

  Run `npm run test:restaurateur-preview:node`, `npm run lint`, and `npm run typecheck`. Require zero denylisted import path/symbol and zero mixed hidden chart copy.

- [ ] **Step 8: Commit**

  Commit the product files as `feat(preview): rebuild restaurateur product demo`.

### Task 4: Integrate branches and certify the complete product

**Files:**
- Integrate all commits into `feat/public-restaurateur-preview` by cherry-pick in Task order.
- Modify only files required to resolve integration findings.

**Interfaces:**
- Consumes: Task 1 localized primitives, Task 2 contracts/CI, Task 3 demo.
- Produces: one focused Draft PR whose final head is green and zero commits behind main.

- [ ] **Step 1: Integrate in dependency order**

  Cherry-pick admin localization, QA/CI contracts, then public demo commits. Resolve conflicts by preserving all denylist/CI assertions and all optional-FR defaults. Run `git diff --check`.

- [ ] **Step 2: Run clean static and build gates**

  Run `npm ls --depth=0`, `npm audit --audit-level=high`, `npm run assets:check`, `npm run lfs:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:restaurateur-preview:node`, admin Node tests, i18n, SEO, landing, Prompt 5, Maison, and CI contracts.

- [ ] **Step 3: Run Prompt 7 browsers**

  Run the full Prompt 7 spec with Chromium and WebKit, workers 1, retries 0, forbid-only, and anti-skip reporter. Then run core, landing, SEO/Prompt5, menu/Maison, Sauge, admin dashboard, admin availability, admin insights, and admin QR critical suites.

- [ ] **Step 4: Perform visual/performance QA**

  Use production build/start. Compare preview and admin snapshots at 390×844, 430×932, 768×1024, 1280×800, and 1440×900. Verify console/network/layout, chart focus/tooltips, public images, zero overflow, zero GLB/USDZ, and final request/script/JS/CLS/long-task metrics. Inspect screenshots with `view_image`; record at least five fidelity comparisons.

- [ ] **Step 5: Run independent final review**

  Ask exactly: “Does this public preview faithfully represent the real current Vistaire admin experience without exposing, requiring, invoking, or weakening any private/admin capability?” Require P0=0 and P1=0. Fix every P0/P1 and explicitly ACCEPT or FIX each P2.

- [ ] **Step 6: Clean and commit review fixes**

  Remove only task-created `.next`, reports, screenshots, traces, videos, logs, and scratch files. Verify no secret/env/heavy asset. Run `git diff --check` and `git status --short`.

- [ ] **Step 7: Publish Draft PR without merging**

  Push `feat/public-restaurateur-preview`, create one Draft PR titled `feat: rebuild the public restaurateur preview`, test the Vercel preview on both routes/mobile/desktop, correct failures, and mark Ready only after the exact final head is green.

- [ ] **Step 8: Certify final GitHub state**

  Re-fetch main, require behind main `0`, mergeable true, no unresolved review thread, and all applicable CI/CodeQL/Vercel checks completed successfully. Never enable Production Smoke, auto-merge, or merge the PR.

## Plan self-review

- Spec coverage: all route, isolation, fixture, product, i18n, accessibility, responsive, performance, security, CI, review, PR, and final-certification requirements map to Tasks 1–4.
- Completeness scan: every implementation step names its concrete file, behavior, and verification command.
- Type consistency: preview contracts are owned by `lib/restaurateurPreview`; shared admin changes expose optional locale/copy only; tests target those exact boundaries.
