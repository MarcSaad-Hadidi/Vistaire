# Restaurant Studio integration in PR #296

## Implemented checkpoint

The protected restaurant admin uses the approved dashboard direction with four direct destinations: Vue d’ensemble, Analyses, Les plats and Planning. The public landing redesign is unchanged. There is no Bilan route or second active legacy dashboard.

- Light/dark themes, direct mobile navigation, accessible dialogs and an export action on every page.
- Four overview KPIs: menu opens, dish views, 3D clicks and AR clicks. They count events, not guests, sales or conversions.
- KindUI line, bar, heatmap, pie, scatter, Sankey and radar views. Each aggregate remains tied to available server evidence; accessible tables accompany charts.
- Dish statistics and real availability controls share one page. Selection actions sit beside select-all. Available is green and unavailable is red in both themes. Read-only preview sessions cannot mutate dishes.
- PDF, Excel, CSV and JSON exports run locally, with all authorized menu rows and supported aggregates for the actual observation window. Comparison suppression, missing values and freshness metadata survive export. Formula-like text is neutralized in spreadsheet formats. No raw sessions, private search payloads, or synthetic demo data are exported.
- Recoverable old source is stored outside served directories in [the archive](archives/admin-before-studio-2026-10-11/README.md).

## Data and security boundaries

All four routes retain server-side `requireAdminRestaurantAccess("dashboard:read")`. The session selects the restaurant; the server selects its menu. No restaurant or menu identifiers supplied by the browser select an analytics scope.

Availability still uses the existing same-origin PATCH API and QR-locking, tenant-scoped RPC. Its authorization, revalidation and cache invalidation are unchanged. Batch updates report partial failures; they do not pretend to be atomic. There is no unsafe client-only undo.

The source remains production event reads, bounded to 12,000 events per window. A truncated, incomplete or failed read is unavailable, never a plausible-looking partial total. Existing privacy thresholds for rankings, search terms, comparison and funnel evidence remain in force. Last event time is identified as observation freshness, not synchronization time.

Added ranges include 90 days, 365 days, current month/year and inclusive UTC custom dates up to 730 days. Comparisons cover the immediately preceding equal duration, only where evidence supports them. Charts use 24-hour buckets and a clipped last bucket for partial periods. The UI states UTC because the existing admin contract does not yet carry a verified restaurant timezone.

## Remaining feature gate

Planning is visible but scheduling creation/editing, automatic availability, manual override reset and transactional schedule-aware undo are not activated. The current backend has no corresponding persisted contract. These require separately approved backend/RPC migration files and review. No production migration, cron job or infrastructure action has been taken.

The synthetic public demo's per-dish historical trend, device/language/table attribution and unrestricted all-history export are not represented as real telemetry. The current contract provides aggregate per-dish views/3D/AR clicks and previous views, not those richer datasets. Exports truthfully cover the selected loaded window rather than silently claiming all history.

## Verification

The existing full-menu fixture runner also runs `e2e/admin-studio.spec.ts` in Chromium and WebKit. It preserves the original public/admin menu parity and thumbnail assertions and adds four direct destinations, 390/430/1440 widths, theme/dialog behavior, read-only controls, all four download formats, runtime error checks and screenshots. The existing CI jobs retain Studio screenshots for seven days.

Local browser launches were blocked before application execution by this environment's Unix-socket permission error. The separate cloud browser could not reach the local fixture server. No browser validation is claimed from those attempts. Hosted CI/preview results for the published commit must be checked before considering the frontend fully validated.

Local checkpoint results (2026-10-11):

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run assets:check`, `npm run lfs:check` and `git diff --check`: passed.
- `npm run test:node`: 2,000 tests, 1,993 passed, one failed, six skipped. The failing IPv6 owner-console startup test also fails when run from its exact base `ecaf036` contents in the same environment (`UND_ERR_SOCKET`). It is not claimed as passing.
- Focused Studio, export, metrics and CI contracts: 47/47 passed. The seven export cases include real XLSX round-trip, formula neutralization, Unicode PDF embedding and local PDF text extraction.
- Dependency audit: no new high/critical advisories; the existing six high findings remain under the repository's exact advisory baseline. The new export dependency's moderate UUID advisory was removed with a scoped override and its XLSX round-trip was rerun successfully.

This is an integration checkpoint, not a claim of completed persistent scheduling or completed hosted browser verification.

## Related-surface follow-up

The private access/refusal/failure views, route loading, error boundary and wrapper now use Studio. The shared invalid-QR page retains a public homepage action, without sending menu visitors to private administration.

The FR/EN restaurateur preview and pricing Pilotage embed now reuse the same Studio presentation with a server-free, explicitly synthetic adapter. Private links, logout and mutations are absent in demo mode. Public theme preferences remain separate from private preferences. Demo exports carry `synthetic: true`, explicit sample-data notes and sample PDF metadata.

The landing laptop illustration at `public/immersive-assets/dashboard/dashboard-black-gold.webp` is a real capture of approved public v28, captured 2026-10-11, 1160×725 WebP, 47,690 bytes. Its path and scene loading logic are unchanged; no landing animation, model or scheduler was modified.

[The test migration map](admin-studio-test-mapping.md) distinguishes retained behavior from archived old-layout contracts. The current checkpoint's Chromium QR test had a stale heading assertion; the follow-up ports it. Its WebKit public video test and landing composition diagnostic also failed before Studio could run. They are not classified as identical inherited failures. Studio fixture steps now execute independently after earlier suite failures, without softening the overall job/gate result.

Follow-up local verification: full Node now contains 2,004 tests, 1,997 passed, the same reproduced base IPv6 failure, and six skips. Build, lint, typecheck, asset/LFS checks and audit baseline pass. The exact public import graph remains restricted; six named browser-safe projection/serialization helpers are allowed but still recursively checked, with a negative regression blocking private auth, environment and signing capabilities. Browser discovery lists nine current Studio/full-menu scenarios per browser; their hosted execution remains pending publication of this follow-up.
