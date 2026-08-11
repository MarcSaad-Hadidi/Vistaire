# Public Restaurateur Preview Design

## Decision

Rebuild the existing `/apercu-restaurateur` and `/en/restaurant-preview` routes as one bilingual, deterministic product demo that mirrors the current Vistaire admin Overview, Availability, and Insights surfaces without importing, invoking, or weakening any private capability.

The reference design is the current post-#200 `/admin` implementation. No ImageGen concept is needed because this is a bounded reconstruction inside an established design system, and `AGENTS.md` requires evidence before broad visual change.

## Certified base

- Base: `origin/main` at `2043d4f949956174287003fa3dd72e7763a80e0c`.
- PR #200: merged at that exact commit.
- Main check-runs: 16/16 completed successfully, including CI Gate, fast-gate, static-quality, build-app, database-contracts, public/admin/Sauge Chromium, WebKit, Asset policy, npm audit, actionlint, zizmor, and CodeQL analysis.
- Vercel commit status: success.
- Production Smoke remains disabled and is not changed.

## Public/private boundary

The public import graph must never reach `server-only`, admin auth, cookies/headers, Supabase/Clerk, admin or owner routes, private loaders, protected thumbnails, private mutations, router refresh, or 3D runtimes.

Allowed shared code is limited to presentation primitives and charts that consume props only: `AdminPanel`, `AdminKpiCard`, `AdminStatusBadge`, `AdminTooltip`, `AdminToggle`, `AdminToast`, `AdminIcons`, `InteractiveLineChart`, `InteractiveDonut`, `InteractiveHeatmap`, `ComparisonLineChart`, and `Sparkline`.

Rejected public reuse includes `AdminShell`, `AdminTabs`, `AdminNav`, `AdminMenuActions`, `AdminOverview`, `AdminAvailabilityPage`, `AdminAvailabilityList`, `AdminDishAvailabilityControl`, `AdminDishThumbnail`, `AdminAvailabilityStrip`, `AdminInsightsPage`, and breakdowns that embed protected thumbnails or private links.

The preview uses approach A: a dedicated `RestaurateurPreviewShell`. Extracting a shared frame from `AdminShell` would touch private navigation, logout, mobile behavior, and the admin H1 for insufficient benefit.

## Rendering architecture

- The route pages remain Server Components and own metadata, canonical/hreflang, JSON-LD, and server-generated QR SVGs that target only `/demo` or `/en/vistaire-menu`.
- `VistaireRestaurateurDashboardPreview` remains the server page shell and renders PreviewNav, one H1, a visible demo-data disclosure, short conversion copy, the interactive dashboard, a secondary QR, final CTA, and PreviewFooter.
- `RestaurateurDashboardDemo` is the only stateful controller. It owns active tab, analytics period, and per-dish local availability overrides.
- Only the active panel mounts. Overview is initial; Availability and Insights are split components, with Insights dynamically loaded when selected.
- Availability state resets on reload because it is held in React state only. No localStorage, sessionStorage, fetch, mutation, or router refresh is allowed.

## Data model

`lib/restaurateurPreview/types.ts` defines preview-only contracts. `fixture.ts` exports one immutable synthetic fixture for `Maison Élyse — Démo`: 4 categories, 12 dishes, 10 initially available, public image paths, and deterministic `24h`, `7d`, and `30d` analytics.

For every period, metric totals equal metric-series sums; top-dish/category totals equal dish opens; search totals equal searches; service-window and heatmap totals equal total tracked activity; comparison values are fixed; textual summaries and insights are derived from those values rather than duplicated strings.

## Product behavior

The demo has exactly three accessible tabs: Overview, Availability, and Insights, localized fully in French and English. ArrowLeft, ArrowRight, Home, and End move focus and selection. One tab and one tabpanel are active.

Overview shows the five real KPIs and representative current-admin panels. Period changes update KPI values, trends, charts, and summaries. Availability exposes summary counts, search, three pressed-state filters, public dish images, status badges, and local switches. Switching a dish announces that the simulation is not saved and updates the Overview available count. Insights shows current-product activity, comparison, heatmap, top dishes, searches, categories, service windows, summary, and derived key insights.

## i18n adaptation

Shared chart primitives may receive optional locale/copy props only where required by the English preview. Defaults preserve the current French admin output byte-for-byte in meaning. No global admin translation refactor is included.

## Security and CI

A dependency-free Node suite validates fixture invariants, a transitive static import graph, prohibited symbols/routes, public links/forms, and CI wiring. Playwright runs the anonymous bilingual interaction matrix in Chromium and WebKit while classifying framework-internal requests separately from product mutations. The hard result remains zero private requests, zero unexpected writes, zero admin/owner links, and zero GLB/USDZ/model-viewer traffic.

`public_navigation` change detection must cover both routes, preview library/components, and the Prompt 7 spec, and it must trigger both public Chromium and WebKit. Existing workflows are extended; no new workflow is created.

## Performance and visual fidelity

The current page baseline on webpack dev measured 15 requests, 4 scripts, no errors, no private/model requests, and no overflow at 390×844 and 1280×800. Its four unoptimized marketing images and dashboard-light composition are removed. Final performance is measured on the production build; no chart, 3D, video, Supabase, or analytics dependency is added.

Chrome DevTools is unavailable in this environment, so the final report must say so explicitly. Browser proof comes from repository Playwright suites, screenshots, DOM/network assertions, and side-by-side comparison with the existing admin visual fixtures.

## Out of scope

No menu editing, uploads, dish creation/deletion, drag/drop, owner features, billing, team/settings, AI claims, private analytics, auth changes, Supabase changes, 3D changes, public asset additions, LFS rules, Pricing, Sauge, Trouvable, or footer architecture rewrite.

## Self-review

The design contains no placeholder, keeps a single public fixture source, preserves the two existing routes, selects the low-risk shell approach, closes hidden i18n and conditional-link loopholes, makes the browser anonymous, and makes CI execution itself testable.
