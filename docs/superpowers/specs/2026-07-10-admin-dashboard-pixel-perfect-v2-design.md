# Vistaire Admin Dashboard Pixel-Perfect V2 — Design Specification

**Date:** 2026-07-10  
**Status:** Approved by the user request for implementation  
**Base:** `origin/main` at `d2b113666e481fb08dfc873cebf82d2c4dcd9231`  
**Branch:** `codex/admin-dashboard-pixel-perfect-v2`

## 1. Objective and product boundary

Rebuild the restaurant-facing `/admin` experience from four verified visual references while preserving the PR 149 security and data boundaries. The restaurant may read anonymized insights, open or copy its public menu, change only dish availability, and sign out. `/owner`, QR management, content editing, media, 3D/AR administration, AI, chat, settings, and multi-restaurant operations remain out of scope.

The source images are external review inputs and are not committed:

| Reference | Native size | SHA-256 |
| --- | ---: | --- |
| `01-overview-desktop.png` | 1672×941 | `28cd726eed39b96aa97b953151cce69bcb0af9c48d3c38120de3dabe4e40a045` |
| `02-availability-desktop.png` | 1672×941 | `8c04dbfe0d75598b674f8be795ffdb4728d8f929c67f3c8071bea990bf719263` |
| `03-overview-mobile.png` | 941×1672 | `98d09b0a08208ca7faf13d740d4c93e5f68eca6cdc029e9494ca93db8ff269e8` |
| `04-insights-desktop.png` | 1672×941 | `62b58b0f6b4bc18025c1038dbc3d3b8e6a1c51ce12da4f8d1292be04f14e06a6` |

The mobile reference includes an iPhone frame. Pixel tests target the useful screen rectangle after a documented crop; the full framed image is used only for composite review.

## 2. Integration approaches considered

### A. Monolithic route-specific CSS

Fast initial visual matching, but duplicates tokens, accessibility behavior, loading/error states, and responsive rules. It creates three drifting implementations and is rejected.

### B. General dashboard/chart library

Provides widgets quickly, but adds bundle weight, generic SaaS styling, hydration cost, and reduced control over the reference geometry. It is rejected unless native SVG/CSS proves insufficient with measured evidence.

### C. Selected: local admin primitives plus server-derived view models

Create a small `/admin`-only token layer and shared shell/primitives, keep routes server-rendered, and use narrowly scoped client islands for search, filters, copy, toggles, and tooltips. Charts use semantic HTML, CSS, and React SVG. This maximizes fidelity while retaining the PR 149 security/data contracts and a small bundle.

## 3. Routes and navigation contract

- `/admin`: overview.
- `/admin/availability`: availability management.
- `/admin/insights`: detailed analytics.
- Existing QR targets remain `/admin`; no QR migration or redirect is needed.
- Overview and availability remain the two primary desktop tabs.
- Insights is reached through a clear secondary action from analytics panels and the mobile navigation.
- The mobile mock's unsupported `Paramètres` item is replaced by a real `Déconnexion` action. No settings page is created.
- Back navigation uses normal links and browser history; no custom history stack.
- All three pages call `requireAdminRestaurantAccess("dashboard:read")`. Only the existing availability API requires `dish:availability:write`.

## 4. Security and mutation contracts preserved

The following PR 149 mechanisms are invariants and are not rewritten for presentation convenience:

- signed, scoped admin session and live QR revalidation;
- restaurant isolation derived only from the server access grant;
- explicit capabilities;
- same-origin, strict JSON availability request;
- no client-supplied `restaurantId`;
- service-role-only atomic availability RPC;
- optimistic update, pending lock, stale-response guard, rollback, `aria-live`, toast, and `router.refresh()`;
- revalidation of `/admin` and public menu paths.

The admin UI must never call `/api/owner`, import owner components, or fetch GLB/USDZ/video assets.

## 5. Data contract

`loadAdminDashboardData(restaurantId, range)` remains the single server boundary. Presentation receives raw, typed values and formats them locally. Production never receives reference-image numbers or synthetic series.

The analytics union remains fail-closed:

- `real`: complete or explicitly limited evidence;
- `insufficient`: trustworthy read but insufficient evidence;
- `unavailable`: query/configuration/partial/truncated source cannot support a claim.

The V2 extension may add only aggregations derivable from stored production events:

- current-period daily buckets;
- compatible previous-period daily buckets;
- hour-by-weekday matrix;
- category counts joined to the selected menu;
- service-window counts derived from UTC timestamps and explicitly labelled UTC until a restaurant timezone exists;
- normalized search terms already accepted by the analytics contract.

Every optional panel exposes `supported | insufficient | unavailable`. Unsupported data renders a premium evidence state, never a fabricated zero or curve. A comparison appears only when period duration, source, metric definition, restaurant, and menu match.

## 6. Required correctness repairs

Before visual integration is considered stable, tests must prove these post-merge PR 149 repairs:

1. A real one-bucket activity series remains visible and is labelled as a single observation, rather than replaced by zero activity.
2. Funnel conversion requires a finite dish timestamp before ordering is evaluated.
3. Maison Élysée analytics sends `dish.categorySlug` when available and a deterministic slug-safe fallback otherwise.

These repairs stay narrow and do not alter public menu visuals or owner behavior.

## 7. UI architecture

### Shared shell and primitives

`components/admin/system/` owns tokens, icons, buttons, tabs, panels, status badges, toggles, tooltips, skeletons, evidence states, and toast presentation. Tokens are scoped beneath `.adminRoot` and do not modify global Vistaire styling.

Primary measured targets: warm near-black `#0d0c0b`, card surfaces near `#151412`, 1px warm borders near `#332d26`, champagne accent near `#d2aa67`, cream text near `#e7e4de`, 14–17px panel radii, 46–50px pills, and an 8px spacing base. Existing Vistaire fonts are used after computed-metric comparison; no external font is added.

The audited local font pair is mandatory for the first fidelity pass: `BT Suave` regular/medium from `/fonts/vistaire-preview/` for display text and `Neue Montreal` regular/bold for UI text. A fallback may render only while those local files fail to load; font substitution is not an aesthetic option.

### Measured visual sheets

All coordinates below are source-image pixels in `x,y,w,h`, with ±1–3px tolerance for anti-aliased edges and ±3–8px for rasterized glyph bounds. They are starting constraints for the first implementation, then overlays determine the final values.

**01 overview desktop — 1672×941**

- content: `68,0,1530,941`; header identity at x68, H1 y52 with 55–58px display type; actions `936,39,227,52` and `1176,39,238,52`; tabs `68,152,419,46`;
- KPI row y219–351: `68,219,302,132`, `381,219,292,132`, `683,219,292,132`, `985,219,289,132`, `1285,219,311,132`; 10–12px gaps and 58px icon circles;
- analytics: activity `68,363,668,359`, top dishes `746,363,430,359`, moment `1185,363,413,174`, category `1185,547,413,175`;
- activity plot x116–703/y484–687, seven points, 2px champagne line and subtle area fill; donut approximately 100px outer/64px inner; category bars up to 215×9px;
- availability strip `68,735,1530,199`, five cards with 8px gaps and approximately 91×112px images.

**02 availability desktop — 1672×941**

- shared content/header/tabs geometry; main panel `68,215,1525,649` with 15px radius;
- summary header y215–343; KPI cards `695,235,269,89`, `978,235,269,89`, `1261,235,288,89`;
- search `94,357,546,46`; segmented control `928,361,637,40`;
- rows x94–1565 at y415, 501, 587, 674 and 760 with 81–82px heights; image x105, 160×72; name x292; price x905; status x1162; toggle center x1478;
- toast `610,864,429,59`; dish names and prices use 18–22px display type.

**03 overview mobile composite — 941×1672**

- application screen crop: `139,69,663,1535`; for a 390px implementation the scale is 1.700 and the comparison target is approximately 390×903 CSS px;
- the curved corners/reflections are excluded with a documented alpha mask because the phone composite is not a rectangular browser screenshot;
- crop-relative application blocks: tabs source `155,302,606,56`; KPI cards `155,379,297,134`, `463,379,297,134`, `155,526,297,134`, `463,526,297,134`; activity `155,673,605,310`; top dishes `155,998,605,272`; availability `155,1285,605,189`; bottom navigation source `138,1487,665,119`;
- only four KPI cards appear; 3D/AR is not added on mobile;
- the unsupported settings item is the one required visible deviation and becomes a three-destination navigation for overview, availability and insights. Logout remains the circular header action;
- 44px accessibility is achieved with invisible hit-area expansion where the visible reference control is smaller, not by visibly enlarging or moving the control.

**04 insights desktop — 1672×941**

- content x56–1616; compact H1 46–49px; date control `483,91,190,37`; actions `1022,36,199,43` and `1234,36,205,43`;
- KPI row y140–260: x56/w319, x386/w298, x695/w291, x998/w296, x1305/w311;
- first row: activity `56,270,722,260`, comparison `788,270,416,260`, heatmap `1214,270,402,260`; heatmap grid approximately x1267–1595/y334–499, 16×7 cells;
- second row: top dishes `56,539,392,215`, searches `459,539,319,215`, category `788,539,369,215`, service `1166,539,450,215`;
- bottom: summary `56,763,911,151`, insights `977,763,639,151`; chart lines 1.5–2px and points 6–7px.

Texture is reproduced with lightweight CSS gradients/noise calibrated by diff; the reference PNG is never used as an application background. Long real values use measured wrapping/truncation rules that preserve card geometry. Visual fixtures are isolated to deterministic test/preview execution and cannot enter a production build.

### Overview

Desktop follows reference 01: header/actions, two-tab navigation, five supported KPI positions, activity panel, top dishes, service/category panels, and an availability strip. Mobile follows reference 03's reading order, but omits the decorative phone hardware and replaces the fake settings destination. At 390/430px the critical order is restaurant identity, tabs, four priority KPIs, activity, top dishes, and availability.

### Availability

Reference 02 controls are limited to name search and `Tous`, `Disponibles`, `Indisponibles`. Rows expose image, name, category, price, status, final-state toggle, and visible/hidden copy. Mobile rows become cards; the page itself never horizontally scrolls.

### Insights

Reference 04 supplies the density and hierarchy. Each panel has a text summary and exact-value alternative. Missing heatmap, comparison, ranking, search, or service evidence renders within the same panel geometry using the typed evidence state.

## 8. Responsive and motion contracts

- Validate 320, 360, 375, 390, and 430px; 390 and 430 are release gates.
- Touch targets are at least 44×44px; visible copy is at least 12px.
- No page-level horizontal overflow.
- Dense desktop grids become a deliberate mobile sequence, not a compressed grid.
- Entry motion uses opacity/transform for 220–360ms with limited staggering.
- Charts may reveal once; no loop or permanent animation.
- `prefers-reduced-motion: reduce` disables counters, drawing, staggering, and spring effects.

## 9. Accessibility and performance

All controls have names, visible focus, keyboard operation, and logical tab order. Charts expose title, period, unit, summary, exact-value table/list, and non-color status. Availability results and failures are announced through the existing live region.

No new chart dependency, background PNG, GLB, USDZ, video, canvas, or continuous animation is permitted. Dish thumbnails use explicit dimensions and optimized delivery. Client components are limited to interactions that require browser state.

## 10. Visual verification contract

- Reference desktop viewport: 1672×941 at DPR 1.
- Mobile reference: document and crop the useful screen rectangle from 941×1672, then validate production viewports separately at 390×844 and 430×932.
- Freeze dates, timezone, fixture data, fonts, and animations for screenshots.
- Compare reference, implementation, 50% overlay, and pixel diff.
- Geometry target: material edges within 2px at native desktop size.
- Initial convergence ceiling: 2% differing pixels; release target 1% with per-pixel threshold 0.08, excluding documented photo/font-antialias masks only.
- Keep only approved Playwright baselines; remove debug captures, overlays, traces, and reports.
- Each screen receives at least two compare/correct iterations; a single approximate comparison cannot pass the gate.
- The final evidence ledger includes source, render, overlay, diff, viewport, mismatch category, repair, and the exact reason for every intentional remainder.

## 11. Worktree ownership

1. `admin-visual-system-shell`: `components/admin/system/**`, shared shell/styles, primitive tests.
2. `admin-overview-insights`: overview/insights routes and page-specific analytics components/tests; consumes the shared system.
3. `admin-availability`: availability route, worklist UI/tests; preserves the existing API/RPC contract.
4. `admin-mobile-animation-qa`: starts after integration; responsive, motion, browser, accessibility, visual and regression corrections only.

The integration branch owns contract changes and the three P2 fixes before UI worktrees branch. No automatic merge, deployment, production migration, or production data write is authorized.

## 12. Completion gates and residual limits

Required: assets check, LFS check, lint, typecheck, targeted Node tests, build, Playwright routes, deterministic visual regression, DevTools-equivalent console/network inspection, keyboard/accessibility checks, reduced motion, and cleanup.

Real iPhone Quick Look, Android Scene Viewer, production migrations, deployment, and production analytics sufficiency are not claimed. “100% confidence” means all locally controllable contracts and checks pass and every external limitation is explicitly reported; it never means pretending unexecuted production/device validation occurred.
