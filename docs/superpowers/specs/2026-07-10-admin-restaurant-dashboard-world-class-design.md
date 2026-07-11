# Vistaire Restaurant Admin Dashboard — Secure Incremental Redesign

**Date:** 2026-07-10  
**Status:** Approved for implementation  
**Base:** `origin/main` at `1d084957bb4a019422b678bbf9cb2bd9d6eb88a3`  
**Integration branch:** `codex/admin-restaurant-dashboard-world-class`

## 1. Objective

Rebuild `/admin` as a private, production-quality restaurant dashboard. It must let the restaurant authorized by its live admin QR session:

1. read honest, anonymous menu activity evidence;
2. understand menu readiness and dish availability;
3. open or copy its public menu URL; and
4. set the final available/unavailable state of one of its own dishes.

The dashboard is not a marketing page, owner console, POS, reservation product, AI assistant, or generic SaaS template.

## 2. Product Boundary

`/owner` remains Vistaire's internal operational product. `/admin` must not expose or navigate to owner creation, deletion, editing, media, 3D/AR management, QR management, publishing, settings, secrets, technical analytics, AI, or multi-restaurant operations.

The authenticated `/admin` runtime may render only:

- overview and evidence states;
- public-menu open/copy actions;
- menu readiness;
- dish availability filters and local name/category search;
- the availability final-state mutation; and
- logout.

`AdminAssistant` and `/admin/api/assistant` may continue to exist for other proven consumers, but `/admin` must not import, render, or call them.

## 3. Evidence from the Current System

### 3.1 Git and existing work

- PR 145 introduced QR-scoped restaurant access.
- PR 146 introduced the production QR exchange and signed loopback-only preview.
- PR 148 added a first isolated dashboard, scoped reads, availability UI, and controlled E2E coverage.
- The current dashboard still reuses the marketing preview CSS and eagerly loads a 2,281,014-byte PNG background.
- The current availability route performs a direct, multi-step `menu_dishes` update.
- The current test explicitly forbids the RPC required by this design; that assertion must be replaced by a stronger atomicity contract.

### 3.2 Connected Vistaire Supabase project

Read-only inspection of project `Vistaire` established:

- Postgres 17, database timezone UTC;
- 2 restaurants, 2 menus, 13 categories, 48 dishes;
- 1,977 analytics events;
- `analytics_events` has `id`, `restaurant_id`, nullable `menu_id`, nullable `dish_id`, non-null `session_id`, `event_name`, `source`, dimensions, metadata, and `created_at`;
- `source` is constrained to `demo | production` and defaults to `demo`;
- only two observed production events exist, both `cta_clicked`;
- no trustworthy restaurant or menu timezone is currently persisted;
- the production database has analytics schema objects that cannot be reproduced from the repository migration history;
- `set_admin_dish_availability` does not exist;
- `resolve_qr_code_scan` is security-definer, service-role-only, and currently uses `search_path=public`.

No historical event may be reclassified without independent evidence.

## 4. Root Causes

1. The dashboard data contract inherits presentation-oriented `DemoAdminInsights`, formatted strings, and ambiguous source states.
2. Analytics reads do not prove instrumentation coverage and do not consistently require `source=production`.
3. Time windows are presented using a hard-coded Toronto assumption despite no persisted restaurant timezone.
4. Read failure, truncation, zero activity, and small samples are conflated.
5. Menu/category/dish reads still use wildcard selection and may filter a selected menu after bounded restaurant-wide reads.
6. Capability validation proves only that a requested capability name is in an enum; it does not expose the assurance and granted capabilities of the session.
7. Availability authorization and mutation occur in separate operations, leaving a QR-revocation TOCTOU window.
8. The repository cannot recreate the production analytics schema.
9. The authenticated UI retains a marketing shell, heavyweight background, insufficient focus/status behavior, and incomplete analytics states.

## 5. Selected Architecture

Use an incremental secure redesign. Preserve the proven QR exchange, signed session, public menu loaders, and owner product. Replace only the `/admin` data boundary, analytics state model, availability mutation path, and authenticated presentation.

### 5.1 Request flow

```text
QR exchange -> signed admin cookie -> live QR revalidation
            -> AdminAccessGrant
            -> loadAdminDashboardData(grant.restaurantId, validatedRange)
            -> server-rendered dashboard

availability click -> strict same-origin PATCH
                   -> requireAdminRestaurantAccess("dish:availability:write")
                   -> service-role-only atomic RPC(qrId, restaurantId, dishId, final state)
                   -> revalidate /admin and public menu paths
                   -> refresh from server truth
```

## 6. Authorization Contract

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

Rules:

- a live, active, restaurant-bound admin QR grants `dashboard:read` and `dish:availability:write` in V1;
- local preview grants only `dashboard:read`;
- write authorization is checked on the server and never inferred from a hidden button;
- QR status, target kind, target path, restaurant identity, and session identity remain live-validated;
- no capability field is added to the signed QR token unless future product requirements require per-session capability persistence;
- no restaurant identifier is accepted from query, form, body, local storage, or client state.

## 7. Dashboard Data Contract

```ts
type AdminDashboardRange = "today-utc" | "7d" | "30d";

type AdminDashboardData = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    location: string | null;
    cuisineType: string | null;
    timezone: null;
    publicMenuPath: string;
  };
  menu: {
    id: string;
    status: "published" | "draft";
    categories: AdminMenuCategory[];
    dishes: AdminMenuDish[];
    readiness: AdminMenuReadiness;
  };
  analytics: AdminAnalyticsState;
};
```

The page must call:

```ts
const access = await requireAdminRestaurantAccess("dashboard:read");
const range = parseAdminDashboardRange(searchParams.range);
const result = await loadAdminDashboardData(access.restaurantId, range);
```

Only `range` may be read from `searchParams`; it is strictly allowlisted. Invalid values fall back to `7d`. `restaurantId` always comes from the access grant.

All database reads must:

- select explicit columns;
- filter `restaurant_id` at the database;
- filter `menu_id` at the database after the deterministic menu selection;
- filter time bounds and `source=production` at the database for analytics;
- order deterministically;
- expose truncation rather than silently treating a limit as completeness; and
- remain server-only.

## 8. Time Strategy

`timezone` is `null` until a trustworthy IANA timezone is persisted. The dashboard must say that the restaurant timezone is not configured.

- `today-utc` means the current UTC calendar day and is labelled `Aujourd’hui — UTC`.
- `7d` and `30d` are rolling UTC windows ending at the request observation boundary.
- no UTC day is described as the restaurant's local day;
- no timezone is inferred from city;
- comparisons use the same duration, source, menu, definitions, and UTC basis;
- a separate future `/owner` proposal may add validated IANA timezone persistence, but no owner UI is included here.

## 9. Analytics Contract

```ts
type AnalyticsCompleteness =
  | "complete"
  | "limited-sample"
  | "truncated"
  | "partial-source";

type AdminAnalyticsState =
  | {
      kind: "real";
      completeness: "complete" | "limited-sample";
      observationWindow: AdminObservationWindow;
      lastUpdatedAt: string | null;
      freshness: "fresh" | "delayed" | "stale";
      coverage: AdminAnalyticsCoverage;
      metrics: AdminMetric[];
      activitySeries: AdminActivityPoint[];
      categoryBreakdown: AdminCategoryMetric[];
      topDishes: AdminDishMetric[];
      searches: AdminSearchMetric[];
      immersive: AdminImmersiveMetric[];
      funnel: AdminFunnelState;
      comparison: AdminPeriodComparison | null;
    }
  | {
      kind: "insufficient";
      reason:
        | "no-relevant-events"
        | "sample-too-small"
        | "instrumentation-unproven";
      completeness: "complete" | "limited-sample";
      observationWindow: AdminObservationWindow;
      availableEvidence: AdminEvidence[];
      missingEvidence: string[];
    }
  | {
      kind: "unavailable";
      reason: "configuration" | "database" | "query";
      completeness: "truncated" | "partial-source";
      title: string;
      explanation: string;
      retryable: boolean;
    };
```

Rules:

- truncation and partial-source failure never become a small-sample message;
- zero is real only after a complete read, proven instrumentation, and a valid window;
- otherwise display `Non mesuré` or `Donnée insuffisante`;
- sessions are anonymous browser-tab sessions because `session_id` is session-storage scoped; they are not visitors;
- no revenue, sales, orders, purchase conversion, satisfaction, intent, or best-seller language;
- no LLM-generated interpretation;
- no demo payload enters the admin contract;
- all formatted values are derived in the presentation from raw numeric values.

### 9.1 Instrumentation proof

Every analytics writer must use the same convention:

- demo-only experiences send `source=demo`;
- relational public restaurant menus send `source=production` with restaurant and menu identity;
- the server validates the restaurant/menu relationship before persistence;
- existing history is never reclassified;
- if a public renderer currently sends demo, fix only future instrumentation and document the historical limitation.

The audited convention is `PublicMenu.source="supabase"` → analytics
`source="production"` only when relational restaurant and menu UUIDs are
present. Test/demo fixtures remain `source="demo"` or are not persisted. The
generic and Trouvable renderers already follow this rule. The Maison Élyse dish
detail currently omits the analytics context when it instantiates its immersive
viewer; the narrowly authorized correction is to pass the existing relational
context and instrument future dish/3D/AR events. No visual, menu-data, or owner
behavior may change, and historical rows remain untouched.

### 9.2 Display thresholds

Thresholds are deterministic and test fixtures prove both sides:

- complete raw counts may display at zero only when instrumentation is proven;
- time series require at least two observed buckets;
- shares and rates require a complete denominator of at least 20;
- ranked dish/category views require at least 20 relevant events and at least 5 for a displayed item;
- normalized searches require at least 3 occurrences per displayed term and must reject empty or sensitive-looking terms;
- funnel requires ordered, correlatable events and at least 20 qualifying sessions;
- otherwise the widget renders its precise evidence state.

## 10. Analytics Schema Reconciliation

Add a non-destructive migration that can run against both a fresh migrated database and a clone of the current Vistaire project.

Before writing the final DDL contract, capture from an isolated clone the full
`pg_catalog` definitions for columns/defaults, constraints, indexes, RLS flags,
policies, owner, table grants, and function grants. The migration must be
generated from that committed evidence. A partial column listing is not enough
to claim schema equivalence.

The migration must:

1. create `analytics_events` only when absent, with the inspected production schema;
2. when present, assert expected column names, types, nullability, defaults, checks, foreign keys, RLS state, indexes, and grants;
3. add only missing compatible constraints/indexes/grants;
4. raise an explicit exception on incompatible existing objects;
5. never drop, rewrite, truncate, update, or reclassify historical rows;
6. revoke browser-role table access and grant only the minimum service-role access required by the server writer;
7. create the composite index required by dashboard reads only after query-shape verification;
8. avoid manual edits to migration history.

The migration is committed but not applied to production.

Validation targets:

- fresh database built from repository migrations;
- isolated Supabase branch cloned from the current project;
- schema assertions and security advisors;
- repository migration list remains coherent.

## 11. Atomic Availability Mutation

Create `public.set_admin_dish_availability` with typed inputs:

```sql
(p_qr_id uuid, p_restaurant_id uuid, p_dish_id uuid, p_available boolean)
```

One database statement/transaction must verify:

- QR exists and is active;
- `target_kind='admin'` and approved admin target path;
- QR restaurant matches `p_restaurant_id`;
- selected published-primary/published/draft-primary menu belongs to that restaurant;
- dish belongs to both the restaurant and selected menu;
- only `is_available` and the existing `updated_at` mechanism change.

Security:

- `security definer` only because the server invokes through service role and the function must perform the narrow privileged update;
- `set search_path=''` and schema-qualified relations;
- revoke execute from `PUBLIC`, `anon`, and `authenticated`;
- grant execute only to `service_role`;
- return only dish id, slug, final availability, and updated timestamp;
- same final state is idempotent;
- missing RPC or schema returns a controlled 503; there is no direct-update fallback.

The route preserves strict JSON, 1,024-byte body limit, same-origin and `Sec-Fetch-Site` enforcement, validated dish id, no-store responses, optimistic UI rollback, out-of-order response protection, and public/admin path revalidation.

## 12. Menu Readiness

Readiness remains deterministic, documented, and independent of analytics:

- categories;
- dishes;
- available/unavailable;
- missing price/description/photo;
- with photo;
- with immersive experience.

The score uses four equally weighted per-dish signals: valid price, non-empty description, photo, and availability. Empty menus score 0. Missing owner-managed content is reported but never editable from `/admin`. Readiness action chips only filter the local worklist.

## 13. UI Architecture

### 13.1 Shell

Create a dedicated matte warm-dark admin shell with cream/champagne typography and restrained status colors. Remove the marketing background, public preview nav/footer, promotional hero, decorative food image, glass-heavy effects, and demo copy.

Header:

- restaurant name and `Dashboard restaurant` badge;
- location/cuisine when present;
- period, UTC/timezone disclosure, freshness, last update, and evidence provenance;
- `Ouvrir menu client`, `Copier le lien du menu`, and logout;
- compact `Vue d’ensemble` / `Disponibilité des plats` navigation.

### 13.2 Evidence-first overview

- at most five supported KPIs;
- no KPI card for an unmeasured metric;
- elegant insufficient/unavailable states with useful next evidence;
- deterministic `À retenir` only for real, supported metrics;
- CSS/SVG activity, horizontal ranking, category, service-window, search, and optional funnel views;
- every visualization has title, business question, unit, period, description, textual summary, exact values, and no color-only meaning.

### 13.3 Operational worklist

Filters: all, available, unavailable, missing price, missing description, missing photo, 3D/AR. Optional local search by dish/category. Mobile uses compact cards without horizontal table scrolling. Desktop may use a semantic table or structured list.

Availability controls have at least a 44px target, explicit dish-name label, pending state, optimistic final state, success status, error alert, rollback, stale-response guard, focus preservation, and server refresh.

### 13.4 Accessibility

- visible `:focus-visible` treatment on every action;
- logical headings and landmarks;
- live success/error/filter-empty announcements;
- keyboard operation without hover dependency;
- reduced-motion support;
- contrast measured on final surfaces;
- zoom and 390/430px validation;
- list/table equivalents for graphical information.

## 14. Performance

- no GLB, USDZ, video, model viewer, canvas, or raw analytics dataset;
- no eager heavy background image;
- no new chart library unless evidence proves native primitives insufficient;
- server aggregation before serialization;
- limited client components: menu copy, range navigation, filters/search, availability controls;
- no N+1 reads;
- stable loading state;
- route initial-transfer and chunk weights measured before and after;
- Network inspection proves absence of immersive/heavy decorative assets.

## 15. Testing Strategy

### 15.1 Baseline repair

Replace the fragile source-string failure in `admin-analytics-isolation` with a behavioral dependency-injection or query-contract test. Do not disable or weaken the restaurant-scoping guarantee. Establish a green baseline before principal implementation.

### 15.2 TDD layers

1. pure parsing, range, completeness, normalization, thresholds, readiness;
2. access grants and preview read-only capability;
3. database query construction and source/menu/restaurant/time filtering;
4. migration schema assertions and grants;
5. RPC route contract and idempotency;
6. optimistic UI success, rollback, double-click, and stale responses;
7. accessible visualization semantics and evidence states;
8. E2E QR access, isolation, periods, filters, mutation, public reflection, mobile, and no immersive assets.

Fixtures remain deterministic, explicitly marked, test-only, and never persisted to production.

## 16. Worktree Ownership

1. `admin-security-availability`: access grants, RPC migration, route/control, security tests.
2. `admin-data-integrity`: schema reconciliation, data contract, analytics states/ranges, readiness, source convention, data tests.
3. `admin-premium-dashboard-ui`: page/layout/loading, admin components/styles, UI tests using the approved contract.
4. `admin-qa-regression`: starts only after integration; reviews combined diff, strengthens tests, runs browser/DevTools QA, fixes P0/P1 only.

No two implementation worktrees own the same file without explicit integration coordination. The integration branch remains the source of truth. No automatic merge, production migration, deployment, or PR creation is authorized.

## 17. Validation Gates

- clean `npm ci`;
- assets and LFS policy;
- lint, typecheck, build;
- targeted admin and owner QR Node tests;
- migration validation on fresh and cloned isolated databases;
- Supabase advisors;
- Playwright `/admin`, `/q`, `/owner/qr-codes`, and affected public menu;
- 390×844, 430×932, tablet, 1280×720, 1440×900;
- Console, Network, hydration, 404/500, accessibility tree, keyboard, focus, overflow, resource sizes;
- availability success/failure/double click/refresh/public reflection;
- no demo numbers, owner API, assistant, GLB, USDZ, video, or heavy background;
- cleanup and final Git diff audit.

## 18. Explicit Non-goals and Residual Proof Limits

- no `/owner` timezone UI;
- no historical analytics reclassification;
- no production migration application;
- no deployment or merge;
- no claim of real iPhone Quick Look or Android Scene Viewer testing;
- no claim that production RPC works until tested on an isolated Supabase branch;
- no claim of complete real analytics until production instrumentation generates enough relevant events.

This strategy is considered implementation-ready because every discovered loophole has a fail-closed behavior and a verification gate. Completion confidence remains evidence-based: any unexecuted external validation is reported as a residual limit rather than represented as certainty.
