# Vistaire Admin Dashboard Pixel-Perfect V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver faithful, secure, responsive `/admin`, `/admin/availability`, and `/admin/insights` views from the four verified references without synthetic production analytics.

**Architecture:** Preserve the PR 149 access, loader, availability API/RPC, and evidence union. Extend only truthful server aggregations, then render them through a scoped admin design system and small client interaction islands.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS Modules, server components, React SVG, Node test runner, Playwright.

## Global Constraints

- Base all work on `d2b113666e481fb08dfc873cebf82d2c4dcd9231`.
- Never touch the user's dirty checkout.
- Do not add dependencies, public media, GLB, USDZ, video, or wildcard LFS rules.
- Do not call `/api/owner` from `/admin`.
- Production renders only real, insufficient, or unavailable evidence.
- Preserve QR targets, signed sessions, capabilities, restaurant isolation, RPC atomicity, and public-menu revalidation.
- Validate mobile at 390px and 430px before desktop completion claims.

---

### Task 1: Lock baseline and repair the three PR 149 correctness defects

**Files:**
- Modify: `lib/admin/analyticsState.ts`
- Modify: `components/menu/MaisonElyseDishDetail.tsx`
- Test: `tests/admin-analytics-correctness.test.mjs`
- Test: `tests/public-menu-analytics-source.test.mjs`

**Interfaces:**
- Consumes: existing `buildAdminAnalyticsState` event rows and dish analytics context.
- Produces: one-bucket series preservation, finite funnel ordering, and valid category slug instrumentation.

- [ ] Add failing tests asserting a one-bucket real series is retained, `Infinity` cannot count as a dish conversion, and category analytics receives the relational slug.
- [ ] Run `node --test tests/admin-analytics-correctness.test.mjs tests/public-menu-analytics-source.test.mjs`; expect the three new assertions to fail on `d2b1136`.
- [ ] Apply the smallest production changes: retain non-empty buckets, guard funnel timestamps with `Number.isFinite`, and pass `dish.categorySlug ?? slugify(dish.category)` through the existing context.
- [ ] Re-run the two test files and expect all tests to pass.
- [ ] Commit only these files with `fix(admin): repair analytics correctness regressions`.

### Task 2: Extend the honest analytics presentation contract

**Files:**
- Modify: `lib/admin/analyticsState.ts`
- Modify: `lib/admin/dashboardData.ts`
- Modify: `components/admin/adminDashboardViewModel.ts`
- Create: `lib/admin/analyticsPresentation.ts`
- Test: `tests/admin-analytics-evidence.test.mjs`
- Test: `tests/admin-dashboard-contract.test.mjs`
- Test: `tests/admin-dashboard-range.test.mjs`

**Interfaces:**
- Produces: `AdminPanelEvidence<T> = {kind:"supported";data:T} | {kind:"insufficient";reason:string} | {kind:"unavailable";reason:string}` and typed current/previous daily, hour-weekday, category, service-window, ranking, and search panels.

- [ ] Add tests for compatible-period comparison, UTC-labelled service windows, hour-weekday aggregation, single-bucket evidence, incomplete-source rejection, and no synthetic fallback.
- [ ] Run the three targeted test files and confirm the new contract tests fail.
- [ ] Implement pure aggregation helpers over already scoped production rows; do not add database writes or infer timezone.
- [ ] Map every optional visualization to `supported`, `insufficient`, or `unavailable`; remove all numeric demo fallback from production paths.
- [ ] Run the targeted tests and `npm run typecheck`; expect success.
- [ ] Commit with `feat(admin): add truthful dashboard panel evidence`.

### Task 3: Build the scoped admin visual system and shell

**Files:**
- Create: `components/admin/system/AdminShell.tsx`
- Create: `components/admin/system/AdminNav.tsx`
- Create: `components/admin/system/AdminPrimitives.tsx`
- Create: `components/admin/system/AdminIcons.tsx`
- Create: `components/admin/system/AdminSystem.module.css`
- Modify: `app/admin/layout.tsx`
- Modify: `app/admin/loading.tsx`
- Test: `tests/admin-dashboard-ui.test.mjs`

**Interfaces:**
- Produces shared `AdminShell`, `AdminPanel`, `AdminKpiCard`, `AdminEvidenceState`, `AdminStatusBadge`, `AdminTabs`, `AdminTooltip`, and icon components.

- [ ] Add structural tests for scoped tokens, semantic landmarks, two desktop tabs, real mobile destinations, focus styles, evidence states, reduced motion, and no owner/settings/assistant links.
- [ ] Run `node --test tests/admin-dashboard-ui.test.mjs`; expect failure because the new primitives do not exist.
- [ ] Implement the shell and primitives using scoped CSS variables measured from the references and existing Vistaire fonts.
- [ ] Keep the shell server-renderable; split copy/logout interactions only where client APIs require them.
- [ ] Run UI tests, lint, and typecheck; expect success.
- [ ] Commit with `feat(admin): add premium dashboard visual system`.

### Task 4: Implement the overview route

**Files:**
- Modify: `app/admin/page.tsx`
- Replace: `components/admin/AdminRestaurantDashboard.tsx`
- Create: `components/admin/overview/AdminOverview.tsx`
- Create: `components/admin/overview/AdminActivityChart.tsx`
- Create: `components/admin/overview/AdminTopDishes.tsx`
- Create: `components/admin/overview/AdminAvailabilityStrip.tsx`
- Create: `components/admin/overview/AdminOverview.module.css`
- Test: `tests/admin-dashboard-ui.test.mjs`
- Create: `e2e/admin-dashboard.spec.ts`

**Interfaces:**
- Consumes: shared system and typed panel evidence.
- Produces: reference-01 desktop and reference-03 mobile overview.

- [ ] Add tests for KPI evidence, insights/availability navigation, accessible chart values, no fake numbers, and mobile destination labels.
- [ ] Implement the desktop grid and deliberate mobile sequence; omit the decorative phone frame.
- [ ] Add restrained entry/chart transitions and complete reduced-motion overrides.
- [ ] Add Playwright assertions for 390/430 overflow, 44px controls, route navigation, console/network errors, and absence of GLB/USDZ/video.
- [ ] Run targeted Node tests and the overview Playwright spec against a built app.
- [ ] Commit with `feat(admin): rebuild overview from approved references`.

### Task 5: Implement the availability route

**Files:**
- Create: `app/admin/availability/page.tsx`
- Create: `components/admin/availability/AdminAvailabilityPage.tsx`
- Create: `components/admin/availability/AdminAvailabilityList.tsx`
- Create: `components/admin/availability/AdminAvailability.module.css`
- Modify: `components/admin/AdminDishAvailabilityControl.tsx`
- Test: `tests/admin-availability.test.mjs`
- Create: `e2e/admin-availability.spec.ts`

**Interfaces:**
- Consumes: existing availability endpoint and RPC; shared shell/primitives.
- Produces: name search, three filters, rows/cards, optimistic final-state mutation, toast and live result.

- [ ] Add failing tests proving only the allowed filters appear and success, rollback, double-click suppression, stale response, refresh, and no client restaurant id remain correct.
- [ ] Implement the route and list without readiness/edit/export controls.
- [ ] Preserve the existing request contract; change visual control code only where needed for the reference.
- [ ] Add Playwright desktop/mobile search, filter, mutation, focus, toast, overflow, and public reflection coverage.
- [ ] Run targeted availability tests and Playwright; expect success.
- [ ] Commit with `feat(admin): add focused dish availability view`.

### Task 6: Implement detailed insights

**Files:**
- Create: `app/admin/insights/page.tsx`
- Create: `components/admin/insights/AdminInsightsPage.tsx`
- Create: `components/admin/insights/AdminHeatmap.tsx`
- Create: `components/admin/insights/AdminComparisonChart.tsx`
- Create: `components/admin/insights/AdminBreakdowns.tsx`
- Create: `components/admin/insights/AdminInsights.module.css`
- Test: `tests/admin-dashboard-ui.test.mjs`
- Create: `e2e/admin-insights.spec.ts`

**Interfaces:**
- Consumes: `AdminPanelEvidence` and shared primitives.
- Produces: nine reference-04 panels with exact-value alternatives and honest evidence states.

- [ ] Add tests for all nine panels, exact-value alternatives, keyboard/focus tooltip behavior, insufficient/unavailable states, and back navigation.
- [ ] Implement SVG/CSS panels with no chart dependency and no hover-only information.
- [ ] Keep required panel geometry when evidence is absent and render a precise evidence explanation.
- [ ] Add Playwright desktop, keyboard, reduced-motion, console/network, and no-heavy-assets coverage.
- [ ] Run targeted tests and Playwright; expect success.
- [ ] Commit with `feat(admin): add truthful detailed insights view`.

### Task 7: Integrate mobile, visual regression, and accessibility

**Files:**
- Modify: admin CSS/modules from Tasks 3–6 only for verified QA defects.
- Modify: `playwright.config.ts`
- Create: `e2e/admin-visual.spec.ts`
- Create: intentional snapshot files under the existing Playwright snapshot convention.
- Create: `docs/validation/admin-dashboard-pixel-fidelity-2026-07-10.md`

**Interfaces:**
- Consumes: integrated three-route UI.
- Produces: deterministic screenshots, overlay/diff ledger, viewport/accessibility evidence.

- [ ] Configure deterministic locale, timezone, clock, data fixture, font wait, DPR, and animation disablement for screenshots.
- [ ] Document the useful-screen crop of `03-overview-mobile.png`; never compare application pixels to iPhone hardware pixels.
- [ ] Capture 1672×941 overview, availability and insights plus 390×844 and 430×932 overview.
- [ ] Generate 50% overlays and pixel diffs outside tracked source, record material mismatches, fix P0/P1 geometry/copy/type/color/icon issues, and repeat.
- [ ] Verify keyboard, focus order, live regions, accessibility tree, reduced motion, touch targets, and `scrollWidth === clientWidth`.
- [ ] Approve only intentional baselines; remove temporary screenshots, overlays, reports, traces, and video.
- [ ] Commit with `test(admin): add visual and mobile regression coverage`.

### Task 8: Final integrated quality gates and handoff

**Files:**
- Modify only files required by demonstrated in-scope failures.
- Update: `docs/validation/admin-dashboard-pixel-fidelity-2026-07-10.md`

**Interfaces:**
- Produces: clean, reviewable branch and evidence-backed PR description; no deployment or merge.

- [ ] Run `npm run assets:check` and `npm run lfs:check`; expect zero policy violations.
- [ ] Run `npm run lint`, `npm run typecheck`, and all targeted admin/QR/public-menu Node tests; expect zero failures.
- [ ] Run `npm run build`; expect successful Next.js production build.
- [ ] Run admin Playwright plus affected public-menu and QR smoke specs at required desktop/mobile viewports.
- [ ] Inspect browser console, network, hydration, 404/500, fonts, images, bundle requests, and absence of owner/heavy assets.
- [ ] Run `git status --short`, inspect the complete diff, verify no secret, `.env`, debug log, generated report, or heavy file is present.
- [ ] Prepare a focused PR summary with commands, test counts, screenshots/diffs, residual limitations, and no merge/deploy action.

## Self-review result

- Spec coverage: routes, security, data honesty, P2 fixes, design system, responsive, motion, accessibility, performance, visual diff, tests, cleanup, and PR handoff all map to tasks.
- Placeholder scan: no `TBD`, deferred implementation, or weakened test instruction remains.
- Type consistency: the shared evidence union is introduced in Task 2 and consumed unchanged by Tasks 4 and 6; shared UI primitives are introduced in Task 3 and consumed by all routes.
- Scope check: work is divided into independently reviewable contract, system, overview, availability, insights, QA, and final-gate tasks with explicit ownership.
