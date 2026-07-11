# Vistaire Restaurant Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, honest, premium mobile-first `/admin` dashboard whose only mutation is atomic dish availability for the QR-authorized restaurant.

**Architecture:** Preserve the existing QR exchange and public-menu architecture while replacing the admin access grant, dashboard data/analytics boundary, direct availability update, and marketing-derived UI. Three isolated worktrees implement security, data, and UI against explicit interfaces; a fourth QA worktree starts after integration.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind/CSS modules, Supabase Postgres 17 and `supabase-js`, Node test runner, Playwright.

## Global Constraints

- Integration base is `1d084957bb4a019422b678bbf9cb2bd9d6eb88a3` on `codex/admin-restaurant-dashboard-world-class`.
- Never edit the dirty checkout at `E:\Projet perso\MenuAlive`.
- Never merge, deploy, apply a production migration, or create a PR without explicit approval.
- `/admin` exposes no owner tools, AI assistant, chat, creation, deletion, full dish editing, 3D/AR management, or multi-restaurant operations.
- No demo analytics payload may enter the admin data contract.
- No GLB, USDZ, video, heavy background image, or charting dependency may load on `/admin`.
- All restaurant identity comes from `requireAdminRestaurantAccess`; only an allowlisted range may come from the URL.
- Database reads select explicit columns and filter restaurant, menu, source, and time in Postgres.
- Availability uses a service-role-only atomic RPC with no direct-update fallback.
- Timezone remains `null`; calendar-today is labelled `Aujourd’hui — UTC`.
- Fixtures are deterministic, test-only, explicitly named, and never persisted to production.
- Validate 390px and 430px before desktop.

---

## File Ownership Map

### Security worktree

- `lib/admin/access.ts`, `lib/admin/accessCore.ts`, optionally `lib/admin/accessSessionCore.ts`
- `lib/admin/availability.ts`
- `app/admin/api/dishes/[dishId]/availability/route.ts`
- `components/admin/AdminDishAvailabilityControl.tsx`
- `lib/owner/menuMutationRevalidation.ts` only if required
- `supabase/migrations/*admin_dish_availability*.sql`
- security/availability tests

### Data worktree

- `lib/admin/dashboardData.ts`, `analyticsState.ts`, `menuReadiness.ts`
- new range/query/evidence helpers under `lib/admin/`
- strictly required `lib/analytics/*` and public-menu analytics instrumentation
- analytics reconciliation migration
- data/analytics tests and fixtures

### UI worktree

- `app/admin/page.tsx`, `layout.tsx`, `loading.tsx`
- runtime components under `components/admin/`, excluding the security-owned availability control
- dedicated admin CSS module
- UI source-contract and component tests

### QA worktree

- admin/owner QR Node tests, admin E2E, validation documentation
- P0/P1 corrections only after integration

---

### Task 1: Repair and Record the Green Baseline

**Owner:** integration branch before parallel work

**Files:**
- Modify: `tests/admin-analytics-isolation.test.mjs`
- Create: `docs/validation/admin-dashboard-baseline-2026-07-10.md`

**Interfaces:**
- Consumes: current `loadAdminDashboardData(restaurantId)` behavior.
- Produces: a behavioral test proving failed scoped menu lookup returns `menu-lookup-failed` before category/dish/analytics reads.

- [ ] **Step 1: Replace the brittle source-offset assertion with injected read dependencies or an exported pure orchestration helper**

The test must arrange a successful restaurant read, a failed menu read, and spies for all downstream reads. Assert the exact result and zero downstream calls. Do not search for a source substring position.

- [ ] **Step 2: Run the formerly failing test**

Run:

```powershell
node --test tests/admin-analytics-isolation.test.mjs
```

Expected: all tests pass and the fail-closed behavior remains protected.

- [ ] **Step 3: Run the full targeted baseline**

```powershell
node --test tests/admin-access-session.test.mjs tests/admin-access-security.test.mjs tests/admin-availability.test.mjs tests/admin-dashboard-readiness.test.mjs tests/admin-analytics-isolation.test.mjs tests/admin-analytics-correctness.test.mjs tests/admin-analytics-menu-identity.test.mjs tests/admin-local-preview.test.mjs tests/admin-qr-access-input.test.mjs tests/owner-qr-contract.test.mjs tests/owner-qr-resolution.test.mjs tests/owner-qr-targets.test.mjs
```

Expected: 90/90 or higher, zero failures.

- [ ] **Step 4: Record exact commands, counts, SHA, and the repaired assertion in the baseline document**

- [ ] **Step 5: Commit**

```powershell
git add tests/admin-analytics-isolation.test.mjs docs/validation/admin-dashboard-baseline-2026-07-10.md
git commit -m "test: establish admin dashboard baseline"
```

### Task 2: Create Testable Access Grants

**Owner:** security worktree

**Files:**
- Modify: `lib/admin/accessCore.ts`
- Modify: `lib/admin/access.ts`
- Test: `tests/admin-access-session.test.mjs`
- Test: `tests/admin-local-preview.test.mjs`

**Interfaces:**
- Produces:

```ts
type AdminAccessGrant = {
  ok: true;
  sessionKind: "qr" | "local-preview";
  assurance: "live-admin-qr" | "signed-loopback-preview";
  qrId: string | null;
  restaurantId: string;
  expiresAt: number;
  capabilities: readonly AdminCapability[];
};
```

- [ ] **Step 1: Add failing tests for explicit QR capabilities and preview read-only behavior**

Assert that `dashboard:read` succeeds for both live QR and preview, `dish:availability:write` succeeds only for the live admin QR, and the successful result exposes the granted capabilities and assurance.

- [ ] **Step 2: Run tests RED**

```powershell
node --test tests/admin-access-session.test.mjs tests/admin-local-preview.test.mjs
```

Expected: fail because the current success shape has no assurance/capabilities.

- [ ] **Step 3: Implement the minimal grant model**

Keep the signed session payload unchanged. Build the granted capability list from the validated session kind and live QR target. Reject requested capabilities not present in the grant.

- [ ] **Step 4: Run tests GREEN and security regression**

```powershell
node --test tests/admin-access-session.test.mjs tests/admin-access-security.test.mjs tests/admin-local-preview.test.mjs
```

- [ ] **Step 5: Review for P0/P1 and commit**

```powershell
git add lib/admin/access.ts lib/admin/accessCore.ts tests/admin-access-session.test.mjs tests/admin-local-preview.test.mjs
git commit -m "fix: enforce admin session capabilities"
```

### Task 3: Capture the Real Analytics Schema and Create Reconciliation Migration

**Owner:** data worktree

**Files:**
- Create: `docs/validation/admin-analytics-schema-contract-2026-07-10.md`
- Create through `supabase migration new`: the returned
  `supabase/migrations/*_analytics_events_schema_reconciliation.sql` path; record
  the exact generated path in the task validation log before editing it.
- Create: `tests/admin-analytics-schema-reconciliation.test.mjs`

**Interfaces:**
- Produces the exact `analytics_events` DDL contract used by the server queries.

- [ ] **Step 1: On an isolated Supabase clone, capture catalog evidence**

Read `pg_attribute`, `pg_attrdef`, `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_class` RLS/owner flags, table grants, default privileges, and row counts/min/max timestamps. Do not query raw search terms or metadata content.

- [ ] **Step 2: Add RED source-contract tests**

Assert that the migration contains explicit compatible-schema assertions, creates the table on absence, rejects incompatible existing columns/constraints/indexes, enables RLS, revokes browser roles, grants minimum service-role access, and contains no historical `UPDATE`, `DELETE`, `TRUNCATE`, or seed insert.

- [ ] **Step 3: Generate the migration filename through the Supabase CLI**

Run `npx supabase --help`, then `npx supabase migration new analytics_events_schema_reconciliation` in an isolated database worktree. Do not invent the timestamp.

- [ ] **Step 4: Implement transaction-safe reconciliation**

Create the exact table when absent. When present, compare normalized catalog definitions and raise an exception on incompatible drift. Create only missing compatible indexes/constraints/grants. Never mutate event rows.

- [ ] **Step 5: Test on a fresh local database**

Initialize/start Supabase only in the isolated worktree, reset from repository migrations, verify schema, rerun migration, and compare catalog snapshots.

- [ ] **Step 6: Test on a cloned Supabase branch**

Record event count and min/max timestamps before/after, apply migration only to the branch, rerun it, run advisors, and prove zero historical-row changes.

- [ ] **Step 7: Commit**

```powershell
git add docs/validation/admin-analytics-schema-contract-2026-07-10.md supabase/migrations tests/admin-analytics-schema-reconciliation.test.mjs
git commit -m "db: reconcile analytics events schema"
```

### Task 4: Lock Analytics Source Semantics and Future Instrumentation

**Owner:** data worktree

**Files:**
- Modify: `lib/analytics/client.ts`
- Modify only as needed: `components/menu/MaisonElyseDishDetail.tsx`
- Modify only as needed: relevant Maison/public dish analytics component
- Test: `tests/admin-analytics-menu-identity.test.mjs`
- Create: `tests/public-menu-analytics-source.test.mjs`

**Interfaces:**
- `getPublicMenuAnalyticsContext(menu)` returns production context only for a relational Supabase menu with valid restaurant/menu UUIDs.
- Demo fixtures never become production.

- [ ] **Step 1: Write table-driven RED tests for demo, Supabase, missing identity, and invalid identity**

- [ ] **Step 2: Add renderer-level RED assertions for generic, Trouvable, and Maison Élyse menu/detail instrumentation**

Verify future `menu_opened`, `dish_opened`, `dish_3d_clicked`, and `dish_ar_clicked` events carry the relational context where supported.

- [ ] **Step 3: Run tests RED**

```powershell
node --test tests/admin-analytics-menu-identity.test.mjs tests/public-menu-analytics-source.test.mjs
```

- [ ] **Step 4: Pass the existing relational analytics context through the Maison dish detail/viewer path**

Do not change visual behavior, menu data, media loading, or historical rows.

- [ ] **Step 5: Run public menu regressions**

```powershell
node --test tests/admin-analytics-menu-identity.test.mjs tests/public-menu-analytics-source.test.mjs tests/public-menu-detail-source.test.mjs tests/public-menu-renderer-source.test.mjs
```

- [ ] **Step 6: Review scope and commit**

```powershell
git add lib/analytics/client.ts components/menu tests/admin-analytics-menu-identity.test.mjs tests/public-menu-analytics-source.test.mjs
git commit -m "fix: preserve production menu analytics identity"
```

### Task 5: Implement Range and Evidence Types

**Owner:** data worktree

**Files:**
- Create: `lib/admin/dashboardRange.ts`
- Replace: `lib/admin/analyticsState.ts`
- Create: `lib/admin/analyticsEvidence.ts`
- Create: `tests/admin-dashboard-range.test.mjs`
- Create: `tests/admin-analytics-evidence.test.mjs`

**Interfaces:**
- `parseAdminDashboardRange(value: unknown): AdminDashboardRange`
- `resolveAdminObservationWindow(range, now): AdminObservationWindow`
- `buildAdminAnalyticsState(input): AdminAnalyticsState`

- [ ] **Step 1: Write RED tests for allowlist and UTC boundaries**

Cover `today-utc`, rolling 7d/30d, invalid fallback, comparison windows, and exact inclusive/exclusive ISO bounds.

- [ ] **Step 2: Write RED tests for completeness states**

Cover complete zero, limited sample, truncated, partial-source, database failure, instrumentation unproven, null baseline, and no division by zero.

- [ ] **Step 3: Implement pure range/evidence helpers**

No `America/Toronto`, city inference, formatted-number parsing, or demo type imports.

- [ ] **Step 4: Run tests GREEN**

```powershell
node --test tests/admin-dashboard-range.test.mjs tests/admin-analytics-evidence.test.mjs
```

- [ ] **Step 5: Commit**

```powershell
git add lib/admin/dashboardRange.ts lib/admin/analyticsState.ts lib/admin/analyticsEvidence.ts tests/admin-dashboard-range.test.mjs tests/admin-analytics-evidence.test.mjs
git commit -m "feat: model honest admin analytics evidence"
```

### Task 6: Build the Scoped Dashboard Loader

**Owner:** data worktree

**Files:**
- Replace: `lib/admin/dashboardData.ts`
- Modify: `lib/analytics/serverRows.ts`
- Modify: `lib/admin/menuReadiness.ts`
- Test: `tests/admin-analytics-isolation.test.mjs`
- Test: `tests/admin-analytics-correctness.test.mjs`
- Test: `tests/admin-dashboard-readiness.test.mjs`

**Interfaces:**
- `loadAdminDashboardData(restaurantId: string, range: AdminDashboardRange): Promise<AdminDashboardLoadResult>`
- Returns the nested contract in the approved spec.

- [ ] **Step 1: Add RED query-contract tests**

Assert explicit selects; restaurant+menu filtering before limits; production+time filtering; deterministic order; no Node post-filter for selected menu; and explicit truncation.

- [ ] **Step 2: Add deterministic fixture tests**

Cover menu empty, reads unavailable, production/demo collision, real zero, insufficient sample, searches normalization, unsupported funnel, readiness, and null timezone.

- [ ] **Step 3: Implement scoped reads and aggregation**

Use independent server reads where safe. Keep per-dataset failure evidence. Never serialize raw event rows to the client.

- [ ] **Step 4: Run data suite GREEN**

```powershell
node --test tests/admin-analytics-isolation.test.mjs tests/admin-analytics-correctness.test.mjs tests/admin-dashboard-readiness.test.mjs tests/admin-dashboard-range.test.mjs tests/admin-analytics-evidence.test.mjs
```

- [ ] **Step 5: Review P0/P1 and commit**

```powershell
git add lib/admin lib/analytics/serverRows.ts tests/admin-analytics-isolation.test.mjs tests/admin-analytics-correctness.test.mjs tests/admin-dashboard-readiness.test.mjs
git commit -m "feat: load scoped restaurant dashboard data"
```

### Task 7: Implement the Atomic Availability RPC and Route

**Owner:** security worktree

**Files:**
- Create through `supabase migration new`: the returned
  `supabase/migrations/*_admin_dish_availability_rpc.sql` path; record the exact
  generated path in the task validation log before editing it.
- Modify: `lib/admin/availability.ts`
- Replace: `app/admin/api/dishes/[dishId]/availability/route.ts`
- Modify: `components/admin/AdminDishAvailabilityControl.tsx`
- Test: `tests/admin-availability.test.mjs`
- Create: `tests/admin-availability-rpc.test.mjs`

**Interfaces:**
- RPC parameters: `p_qr_id`, `p_restaurant_id`, `p_dish_id`, `p_available`.
- RPC result: `dish_id`, `dish_slug`, `is_available`, `updated_at`.

- [ ] **Step 1: Replace the old anti-RPC assertion with RED atomicity tests**

Assert `.rpc("set_admin_dish_availability", ...)`, absence of `.from("menu_dishes").update`, inclusion of QR and restaurant IDs from access, controlled missing-RPC error, and no privileged fallback.

- [ ] **Step 2: Add SQL source-contract tests**

Assert typed UUID/boolean inputs, active admin QR, restaurant/menu/dish checks, schema-qualified tables, empty search path, service-role-only grants, minimal return, and no mutation beyond availability/update timestamp semantics.

- [ ] **Step 3: Generate and implement the migration**

Derive the selected menu inside the RPC using the same deterministic published-primary/published/draft-primary rule. Lock the QR before update. Same-state calls return current server truth without unnecessary mutation.

- [ ] **Step 4: Implement route RPC call and controlled mapping**

Keep strict JSON, byte limit, same-origin, `Sec-Fetch-Site`, no-store, and path revalidation.

- [ ] **Step 5: Run Node tests GREEN**

```powershell
node --test tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs tests/admin-access-session.test.mjs
```

- [ ] **Step 6: Run isolated Supabase branch RPC matrix**

Test active/inactive/archived QR, menu QR, cross-restaurant, wrong dish, same state twice, browser roles, service role, and concurrent QR revocation. Never run against production.

- [ ] **Step 7: Review P0/P1 and commit**

```powershell
git add supabase/migrations lib/admin/availability.ts app/admin/api/dishes components/admin/AdminDishAvailabilityControl.tsx tests/admin-availability*.test.mjs
git commit -m "fix: make admin availability atomic"
```

### Task 8: Build the Dedicated Premium Admin UI

**Owner:** UI worktree after importing the approved data interfaces

**Files:**
- Replace: `app/admin/page.tsx`
- Replace: `app/admin/layout.tsx`
- Create: `app/admin/loading.tsx`
- Replace: `components/admin/AdminRestaurantDashboard.tsx`
- Replace or create focused runtime components under `components/admin/`
- Create: `components/admin/AdminDashboard.module.css`
- Test: `tests/admin-dashboard-ui.test.mjs`

**Interfaces:**
- Consumes only `AdminDashboardData` and `AdminAnalyticsState`.
- Does not aggregate analytics or access Supabase in React components.

- [ ] **Step 1: Add RED UI source/semantics tests**

Assert private metadata, no marketing preview CSS/background image, no assistant/owner API/media, range allowlist, evidence-state copy, accessible chart titles/descriptions/values, required filters, and focus/live-status hooks.

- [ ] **Step 2: Implement page/layout/loading shell**

Use dedicated warm matte surfaces, compact anchors/tabs, server range selection, timezone disclosure, menu actions, and stable loading geometry.

- [ ] **Step 3: Implement overview/evidence components**

Use CSS/SVG primitives only. Render insufficient production evidence elegantly while keeping readiness/worklist useful. Add deterministic fixture-only component tests for full charts.

- [ ] **Step 4: Implement responsive worklist presentation**

No horizontal data table at 390/430. Add local search, discoverable filter overflow, semantic statuses, and empty result state.

- [ ] **Step 5: Run UI tests and static gates**

```powershell
node --test tests/admin-dashboard-ui.test.mjs tests/admin-dashboard-readiness.test.mjs
npm run lint
npm run typecheck
```

- [ ] **Step 6: Browser-check the UI worktree with deterministic fixtures**

Inspect 390×844, 430×932, tablet, 1280×720, and 1440×900; keyboard focus, zoom, reduced motion, overflow, console/network, and no immersive assets.

- [ ] **Step 7: Review P0/P1 and commit**

```powershell
git add app/admin components/admin tests/admin-dashboard-ui.test.mjs
git commit -m "feat: rebuild restaurant admin dashboard"
```

### Task 9: Integrate Security, Data, and UI

**Owner:** integration branch

**Files:** merged owned files only; conflict resolution documented.

- [ ] **Step 1: Compare branch bases, commits, changed files, and validation reports**

- [ ] **Step 2: Integrate data interfaces first, security second, UI third**

Do not merge automatically. Cherry-pick focused commits only after review. Resolve the shared availability-control contract explicitly.

- [ ] **Step 3: Run targeted integrated tests**

```powershell
node --test tests/admin-*.test.mjs tests/owner-qr-contract.test.mjs tests/owner-qr-resolution.test.mjs tests/owner-qr-targets.test.mjs
```

- [ ] **Step 4: Run static/build gates**

```powershell
npm run assets:check
npm run lfs:check
npm run lint
npm run typecheck
npm run build
```

- [ ] **Step 5: Inspect diff scope and commit integration fixes only**

### Task 10: QA and Regression Worktree

**Owner:** QA worktree created from integrated HEAD

**Files:**
- Modify: `e2e/admin-restaurant-dashboard.spec.ts`
- Modify targeted tests and runtime files only for proven P0/P1 fixes
- Create: `docs/validation/admin-dashboard-final-2026-07-10.md`

- [ ] **Step 1: Review the complete diff for scope, security, analytics honesty, assets, and regressions**

- [ ] **Step 2: Strengthen E2E scenarios**

Cover locked access, valid/expired/revoked/archived QR, ranges, insufficient/unavailable/real fixture states, filters/search, availability success/error/double-click/out-of-order, refresh, cross-restaurant isolation, public-menu reflection, and no forbidden actions/assets.

- [ ] **Step 3: Run controlled Playwright**

Use the repository's safe preview fixtures. Never target the production client. Record skipped scenarios and exact missing configuration.

- [ ] **Step 4: Run DevTools-equivalent QA**

Check Console, Network 404/500, hydration, requests, GLB/USDZ/video/background absence, overflow, focus, accessibility tree, resource sizes, and refresh behavior at all required viewports.

- [ ] **Step 5: Measure route weight before and after**

Use build route output and browser transferred-resource totals under identical conditions. Record methodology and values; do not compare unlike caches/environments.

- [ ] **Step 6: Fix every P0/P1 and rerun affected tests**

- [ ] **Step 7: Run final fresh validation**

```powershell
npm ci
npm run assets:check
npm run lfs:check
npm run lint
npm run typecheck
node --test tests/admin-*.test.mjs tests/owner-qr-contract.test.mjs tests/owner-qr-resolution.test.mjs tests/owner-qr-targets.test.mjs
npm run build
```

Run controlled Playwright separately with its explicit fixture environment.

- [ ] **Step 8: Cleanup and final audit**

Remove task-generated `.next`, test results, Playwright reports, screenshots, traces, and temporary files that are not intentional deliverables. Verify no secret, `.env`, debug log, heavy asset, or forbidden media path is present.

- [ ] **Step 9: Commit QA corrections and report**

```powershell
git add e2e tests docs/validation
git commit -m "test: validate restaurant admin dashboard"
```

## Final Handoff

Report branch/base/SHA, worktrees, commits, architecture, every changed file, migrations and non-application status, exact validation counts, Supabase branch tests, browser routes/viewports/interactions, Console/Network/accessibility/performance evidence, route weight before/after, cleanup, residual risks, and unverified external conditions. Prepare PR title/body but do not create, merge, or deploy it.
