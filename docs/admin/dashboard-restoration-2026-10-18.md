# Approved Studio restoration

## Reference and scope

The presentation reference is the deployed [Sauge Noire Studio](https://sauge-noire-dashboard-demo.plumtuna4.chatgpt.site), v29 (`bed25095883e956eed771f8675657e2c5bdc0a98`). The explicitly approved integration basis was v28 (`c9063216ab7a868524319ec7e0115cbdadaba068`); v29 removes the duplicate period selector. The deployed HTML, readable application bundle, and rendered screenshots were inspected. Original authoring TSX was not recovered; these are scoped adaptations, not a claim of byte-for-byte source restoration.

Base: Vistaire main `f9cc822543913a6d6bd9edbd40987341a39df132`.

## Restored components

- BeUI circular center theme transition and animated icon, reduced-motion/unsupported-browser fallback, duplicate-activation protection, and unmount cleanup
- BeUI date-range popover with draft/apply/cancel, presets, calendar/month/year navigation, keyboard controls, UTC validation, and the existing backend range tokens
- BeUI search, searchable keyboard combobox, semantic animated availability switch and checkbox, and dismissible feedback
- Coss/cmdk command search over the supplied navigation and tenant dishes, with keyboard navigation and focus return
- SmoothUI-style animated metric selection, preserving accessible toggle-button semantics for a shared chart workspace
- KindUI 0.4.0 chart tokens and actual data selectors; old shell button styles no longer override KindUI or date-picker controls
- Ten-panel analysis hierarchy, category and metric controls, data table, chart expansion, legends, exact-value inspection, and category/dish drilldowns

Existing server tenant access, analytics completeness rules, availability endpoint, and PDF/XLSX/CSV/JSON exports remain the data/action contracts. No SQL or backend schema changes.

## Truthful differences from the synthetic reference

The demo's Montreal time, simulated histories and synthetic per-dish time series cannot become production facts. Temporal charts use the existing entire-menu UTC series. Category filters affect only data that is actually attributable to categories; the interface explains this scope. Hour/day charts aggregate the existing all-event heatmap. Missing previous evidence remains N/A. Persistent scheduling remains unsupported by the existing backend and is not simulated or saved locally.

Shaders, RewampUI and CodedVisuals were researched historically but deliberately excluded from the approved reference; no decorative additions are introduced here.

## Dependency and privacy checks

Motion 13.5.1 was already installed as a chart peer and is now an explicit dependency for the restored controls. cmdk 1.1.1 supplies the approved command palette keyboard primitive. Fresh npm audit reported the same accepted braces advisory GHSA-vfj7-8cjw-p6xm, six affected dependency nodes, zero critical findings; only the audit baseline lock hash changes.

The public preview import allowlist adds only the exact reviewed presentation files. All those files remain traversed by capability checks. No private loader, private runtime range helper, storage capability, or authentication exception is added to the public preview.

## Validation

- Production build: passed after materializing three unchanged baseline Framer images omitted by the sparse checkout
- Full ESLint and TypeScript: passed
- Studio + public boundary + dependency tests: 54 passed, including date/cascade/command lifecycle regression cases
- Dependency security contract: 3 passed; fresh audit baseline checker passed
- Asset and LFS policy checks: passed
- Independent source reviews: chart interactions and control/theme lifecycle; findings corrected before publication
- Full repository node suite: 2,137 passed, 10 failed, 6 skipped. Remaining failures: five Maison Elyse media-backfill cases require sparse-excluded models; public-model-assets requires chocolat-fume.usdz; restaurant-geometry-pruning requires restaurant-evening.glb; restaurant-index-crop and restaurant-offscreen-experiment require restaurant-visible-59412334.glb; owner-pipeline-console IPv6 fetch fails through the local proxy. None of those source files are changed. The IPv6 case also fails when run alone. Hosted CI remains required
- Browser interaction and visual comparison status is recorded in the PR; source/unit checks alone do not establish exact visual parity
