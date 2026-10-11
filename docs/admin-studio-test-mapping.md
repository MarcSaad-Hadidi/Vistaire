# Studio test migration

The approved redesign replaces the old three-tab, five-KPI dashboard. Its retired pixel composition and custom SVG/animation internals are preserved in the inert archive, not left as failing active Playwright scenarios.

## Retained production and security contracts

- `admin-chart-interactions.spec.ts`: the original full-menu parity and thumbnail scenarios remain active. They still assert 12 distinct dishes, at least four categories, exclusion of foreign restaurant/menu IDs, exact public-versus-available parity, failed-photo fallback, private 307 to signed PNG 200, and unavailable public photo 404.
- Its existing nine-width document overflow scenario remains active, now also covering Planning and running in the Studio CI selection.
- `qr-functional.spec.ts`: the restaurant-heading selector changes to exact Studio identity plus the overview heading. QR creation, signed HttpOnly session and tenant-scoped read assertions are unchanged.
- `admin-restaurant-dashboard.spec.ts`: current worklist route and controls, exact fixture filter IDs, persistence after reload, public-menu visibility, restoration in `finally`, exactly two PATCH calls, and restaurant B's rejection when targeting restaurant A remain asserted.
- `admin-dashboard`, `admin-availability`, `admin-insights`: current navigation, 44px targets, keyboard routing, filters, expected evidence and request-health contracts replace obsolete selectors.
- `admin-performance.spec.ts`: current chart interactions retain the existing CLS, long-task, layout, style, heap, frame-time and JavaScript-byte budgets. No limit is raised and no skip is added.

## Consolidated Studio browser scenarios

`admin-studio.spec.ts` tests the replacement presentation rather than old SVG markers:

- Four direct destinations, active navigation, keyboard Enter, target sizes, light/dark themes, all-page export dialogs, Escape and focus restoration, mobile logout and no heavy 3D/video requests at 390/430/1440.
- Exact filtered full-menu counts: 12 total, two unavailable, ten available; exact-name search produces one row and missing search can be reset.
- Current and previous exact fixture totals for all six series, including separate 3D and AR; keyboard datum inspection agrees with the accessible table; legend visibility responds to Enter/Space; 7d to 30d changes URL, selected range and actual daily evidence.
- The real ninth search term remains visible with its exact count rather than being hidden behind the retired five-row disclosure.
- Reduced motion preserves chart geometry and settles without running animations. Touch displays bounded values; Escape dismisses them. This uses KindUI's interaction model, not the removed custom second-tap/pinning SVG implementation.
- PDF/Excel/CSV/JSON all produce a download without leaving the private page.

## Archived presentation-only contracts

Exact base copies of `admin-chart-interactions`, `admin-insights-fidelity`, and `admin-visual` live under the non-served archive as `.spec.ts.txt`. The latter two files are removed from active discovery. Retired assertions include five overview/insight KPIs, three navigation tabs, nine-panel one-screen composition, old wide-thumbnail ratios, KPI sparklines, obsolete CTA/disclosure controls, old animation keys and mandatory 180–420ms entry motion, and comparisons to old PNG baselines.

Shared chart primitives still used elsewhere retain their existing unit tests. Historical static source assertions that inspect old visual references now point explicitly to the archived test source. They are not used as evidence that the current Studio passed browser validation.

## Execution status

Local browser launch remains blocked by the environment's socket permission. Active tests are discoverable and typechecked; successful browser execution is only claimed when the exact follow-up commit's hosted Chromium/WebKit jobs complete. The Studio step now runs independently of an earlier suite failure, while the overall job and CI gate still fail on that earlier error.
