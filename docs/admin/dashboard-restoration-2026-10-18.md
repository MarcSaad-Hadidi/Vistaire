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

## Screenshot-driven corrections

The first PR preview exposed gaps that source checks had missed: gray pie sectors, a light-only heatmap in dark mode, cramped radar ticks, changed chart composition and dialogs opening at the top-left. The follow-up uses the recovered deployed reference directly for chart proportions, fonts, legend chips, categorical colors, hourly orientation, numbered scatter markers, heatmap cells and shell spacing.

- Pie records carry their actual category fill into the rendered sectors; browser tests inspect computed SVG fills against the six theme tokens.
- Heatmaps now show weekday columns and two-hour UTC rows with the exact six-stop light/dark palettes. Twelve rows retain overnight evidence that the six-row synthetic restaurant demo does not contain. Tests verify count preservation and actual Studio-root theme observation.
- Native dialogs explicitly restore fixed positioning and auto margins after Tailwind Preflight's margin reset. Critical browser tests inspect viewport centering after scrolling at390px and1440px and capture each open modal.
- The semantic availability assertion waits for the existing150ms switch background transition while retaining strict token equality and explicit light-theme state.
- Runtime browser inspection verified dark→light→dark heatmap zero and maximum colors,84 grid cells, arrow-key navigation, restored pie colors and desktop modal centering. Further responsive comparison and hosted checks remain required before the draft can be considered ready.

The complete reference pass also restores the overview's menu-opens default and four-column ranking, the dishes availability-summary/metric hierarchy, and the actual mounted five-dataset data workspace (not its older HTML fallback). The latter uses the original pinned TanStack Table9.2.8 with search, sort,15-row pagination and mobile expandable rows. Overview and analysis KPI islands use the original NumberFlow0.6.2 with reduced-motion and accessible text. The fresh audit after adding these packages still reports only the existing accepted braces advisory; no new advisory was added to the baseline.

Table datasets distinguish the real adapter's capabilities: daily values describe the entire menu, hourly rows contain only recorded all-event totals in UTC, and unsupported previous category3D/AR counts remain N/A. The download action explicitly exports the whole selected period through the existing export dialog rather than claiming a category-filtered export.

The final modal pass ports the deployed `Nee` / `mx-*` metric explorer: five metric tabs, actual UTC period comparison, daily inspection, sortable dish contributions and method disclosures. Dish detail restores the reference hero, real photo/category/status, three actual metric cards and management link. Unsupported synthetic per-dish histories are not copied. Independent review of this final increment found no verified P0/P1/P2 issue; nested chart dialog focus is separately covered by a critical browser test.

### Follow-up validation checkpoint

- Studio, availability, public import/privacy boundaries and dependency contracts: 94 tests passed
- Fresh TypeScript and full ESLint passed; the final nested-dialog cancellation guard and browser-test additions also passed targeted ESLint
- Independent expanded source review: no open P0/P1/P2 finding, including table-library usage, real-data scope, metric explorer and dish navigation
- Critical hosted browser coverage now includes computed SVG/theme colors, all five table datasets, pagination/search, nested metric-explorer focus, and viewport centering after scrolling
- Local cloud-browser inspection and hosted CI results remain separate: the new Playwright coverage must execute in CI before readiness is established
- Final controlled-fixture browser pass verified all five datasets, search and sort, hourly pagination, actual export dialog, availability summary/filter, five dish metrics, restored detail hero, management navigation to the matching dish hash, and nested chart Escape/focus restoration. At 430 CSS pixels in dark mode, document scroll width equaled client width; this is desktop responsive testing, not touch-device emulation.
- The last browser pass also verified 390px light, 430px dark and 1176px desktop layouts. It identified two small copy omissions, subsequently corrected in source: the table-mode “Explorateur de données” heading and actual period/comparison caption above the dishes summary. These final text/context changes have dedicated regression coverage.

- Final production build passed after the complete source restoration and last heading/context corrections; final fresh TypeScript and targeted ESLint also passed. Hosted browser/CI checks remain pending for the corrective commit.
