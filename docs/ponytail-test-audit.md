# Ponytail test audit

Base: `2220762673087226f7ed914d8aca97f13d3baa78`. Decisions recorded before deletion.

## Baseline and scope

The orchestrator reported npm ci, assets, LFS, lint, typecheck, build and static checks passing. The baseline Node run reported 1,894 tests: 1,876 passed, 14 failed, four skipped, 472.676 seconds. The core browser group passed 43 scenarios, including public navigation, demo experiences and the public restaurateur preview at 390/430px. These are orchestrator results, not executions in this worktree.

Read-only inventory here: 219 Node test files, 61,637 lines, 1,873 static declarations; 56 E2E spec files, 19,133 lines. Static declarations do not expand scenario loops or side-effect imports. Review prioritized deletion candidates; this is not a claim of exhaustive line-by-line review of every test.

Only tests, test helpers and this report may change. Production modules, package scripts, CI, media, secrets and migrations belong to other owners. Dead-code test removals must be integrated with the corresponding production removal. Existing failures do not justify deletion by themselves.

## Decisions before deletion

| Test/file or group | Protected behavior | Actual replacement / E2E | Risk | Decision and reason |
| --- | --- | --- | --- | --- |
| `seo-pillar-animations.test.mjs` | Historical SEO component wiring | Current routes use Preview/SeoInteractiveComparison; current SEO E2E are separate | Remove only with confirmed dead graph | DELETE historical-only suite; package `test:seo` owner must remove its entry |
| `seo-foundation.test.mjs`, public dashboard metadata test | Metadata and old header/footer links | Active metadata assertions stay; public-navigation core passed | Preserve indexability/JSON-LD | DELETE only dead Header/SeoFooter reads and assertions |
| `admin-dashboard-ui.test.mjs`, old dashboard/panel/view-model blocks | Historical UI presentation | Active overview/analytics-state tests remain | Do not transfer obsolete UI expectations | DELETE dead-only tests/import harness; retain live shell, auth and evidence assertions |
| `admin-dashboard-readiness.test.mjs` | Authorized restaurant, read-only dashboard | Read active AdminOverview/AdminAvailabilityList; existing state tests remain | Security boundary | REPLACE dead component reads only; KEEP active page/scoping assertions |
| `admin-assistant-isolation.test.mjs` | Client payload and endpoint scope | API remains live | Authentication/isolation | DELETE dead client test; KEEP authenticated API and legacy-410 tests |
| `owner-restaurant-qr-target.test.mjs` | Old target switcher and canonical QR page | Canonical page remains live | Fail-closed QR creation and token handling | DELETE switcher-only read/test; KEEP canonical page test |
| `admin-interactive-charts.test.mjs` | Charts interaction, normalization, geometry | Active chart tests remain | Accessibility and calculations | Remove dead InteractiveBars entry only; geometry test removal requires matching helper deletion |
| `restaurateur-preview-security.test.mjs` | Import boundary scanner | Scanner and synthetic malicious inputs remain | Security | Remove dead InteractiveBars allowlist entry only; KEEP synthetic historical names |
| PublicMenuExperience references in `public-menu-card-renderer`, `public-menu-category-identifiers`, `public-menu-renderer-source` | Image variants and category IDs | Active renderers/detail remain exercised | Preserve rendering/data coverage | Remove only dead component import/render/source list entries and assertions |
| `public-menu-experience-source.test.mjs` | PublicMenuRenderer | Component is live despite similar name | Wrong-target deletion | KEEP |
| `helpers/public-dish-asset-route-runtime.mjs::loadPublicMenuCache` | Uncalled loader for dead durable cache | No caller; active cache suites remain | Cache safety | DELETE loader only with cache module removal |
| `dish-asset-warmup.test.mjs` | Legacy warmup/Quick Look helpers | Architecture and 3D owners confirmed entire module dead after DishDetail and DemoMenuClient removal | Atomic integration required | DELETE all nine legacy-only tests with module removal; active AR suites remain |
| `dish-detail-intent.test.mjs`, first two tests | Legacy DishDetail intent wiring | DishDetail is removed; DishModelViewer remains active | Preserve active fallback and loading checks | DELETE only the two legacy tests and their source read; KEEP three viewer tests |
| `menu-experience-blueprints.test.mjs`, first inventory test | Required blueprint IDs | `menu-design-studio.test.mjs` checks same IDs more strictly | None unique | DELETE duplicated test and unused imports; KEEP structure/fallback tests |
| `menu-schema-projection-contract.test.mjs`, pseudo-PostgREST fixture | Projection names and locally invented order constants | First test already checks real exported projections | Historical schema regression | DELETE duplicate block and dedicated helper; KEEP remaining projection contracts |
| `restaurant-experiences-foundation-contract.test.mjs`, tab keyboard source test | Keyboard interaction, ARIA relationships, roving focus | `demo-restaurant-experiences.spec.ts` covers only part of the contract | Independent review found missing ArrowLeft/ARIA/tabIndex browser coverage | KEEP complete existing test; deletion withdrawn after review |
| Footer/FAQ/showcase/Sauge reset source mirrors | UI/JSON-LD and historical 3D reset | Orchestrator confirmed 135 extended E2E passing in 3.8 minutes, including these scenarios | Preserve unique accessibility/history checks | DELETE 5 footer, 1 FAQ, 3 showcase and 1 reset source mirrors; KEEP guide order, inert/reduced-motion and content guards |
| `preview-workflow-contract.test.mjs`, heavy tracing test | Function packaging boundaries | Model Lab optimize now has its own trace group, separate from Meshy GLB/publish | Bundle isolation | REPLACE only obsolete shared-group expectation; assert dedicated optimize entry and exclusion from Meshy |
| `owner-gltf-runtime-toolchain.test.mjs`, closure test | Runtime dependency completeness | Inspect actual imported Next config for each route; distinct Meshy and Model Lab dependency roots | Missing runtime modules | KEEP closure check per route; exclude only declaration-only `@types/*`, explicitly excluded from runtime config already; keep all runtime dependencies/optional/peers |
| Admin fidelity/charts and owner builder source mirrors | Tooltips, layout, interactions and intent | Orchestrator reported baseline admin visual/mobile failures | Replacement not proven green | KEEP source mirrors; no production changes to mask baseline failures |
| Security, parsing, calculations, cache, translation, data integrity, migrations and production guards | Unique lower-level behavior | No equivalent exhaustive browser coverage | High | KEEP |

## Validation and coordination

Do not run concurrent servers: the orchestrator owns the Sauge fixture at port 55434. Other fixed fixtures use 55432 (QR), 3110 (admin), or 3191/3192 (admin full-menu runner). External Supabase refusal stays enabled.

`npm run test:e2e` without file selection also loads protected-preview and final-live-QA specs with required environment. Use explicit hermetic groups; do not introduce production credentials to make discovery pass. Admin fidelity suites require their fixture flag. Browser UA simulation is not physical Quick Look/Scene Viewer validation.

`seo-public-content.test.mjs` imports two other test suites, duplicating execution under a Node glob. The orchestrator authorized removing those imports and coordinates listing `pricing-table-estimator.test.mjs` and `tarifs-carte-vistaire-public.test.mjs` explicitly in `test:seo`. Both suites remain intact; only duplicate registration is removed.

After changes: execute targeted retained tests, inspect the final diff and status, perform correctness and Ponytail reviews, and let the orchestrator run the complete checks on the consolidated production/test revision. Record actual results and residual baseline failures; never count removed tests as fixed product bugs.


## Complete baseline inventory (219 Node files)

Every baseline file appears exactly once below. REPLACE includes partial deletion or retargeting; the detailed decisions above specify the boundary. KEEP in the grouped inventory is conservative: it does **not** assert full individual line review or prove every assertion valuable. It records why deletion was not justified during this pass. Existing failures remain baseline failures unless separately documented.

| File (under `tests/`) | Decision | Scope |
| --- | --- | --- |
| `admin-assistant-isolation.test.mjs` | REPLACE | Remove dead client; preserve API scope/410. |
| `admin-dashboard-readiness.test.mjs` | REPLACE | Retarget live UI; preserve authorization/data. |
| `admin-dashboard-ui.test.mjs` | REPLACE | Remove dead presentation; keep live semantics. |
| `admin-interactive-charts.test.mjs` | REPLACE | Remove dead source read; retain calculations/a11y. |
| `dish-asset-warmup.test.mjs` | DELETE | Confirmed dead production graph; integrate atomically. |
| `dish-detail-intent.test.mjs` | REPLACE | Remove legacy DishDetail checks; retain viewer guards. |
| `menu-experience-blueprints.test.mjs` | REPLACE | Remove duplicate inventory; retain defaults/fallback. |
| `menu-schema-projection-contract.test.mjs` | REPLACE | Remove self-testing pseudo-fixture; retain real projections. |
| `owner-gltf-runtime-toolchain.test.mjs` | REPLACE | Validate per-route runtime dependency closures. |
| `owner-restaurant-qr-target.test.mjs` | REPLACE | Remove dead switcher; preserve canonical fail-closed page. |
| `preview-workflow-contract.test.mjs` | REPLACE | Assert isolated Model Lab trace. |
| `prompt5-faq-parity.test.mjs` | REPLACE | Remove proven E2E mirror; preserve content safeguards. |
| `prompt5-footer-contract.test.mjs` | REPLACE | Remove proven E2E mirrors; preserve historic guide order. |
| `public-menu-card-renderer.test.mjs` | REPLACE | Remove dead renderer only; preserve image variants. |
| `public-menu-category-identifiers.test.mjs` | REPLACE | Remove dead renderer only; preserve stable IDs. |
| `public-menu-renderer-source.test.mjs` | REPLACE | Remove dead renderer reads only. |
| `restaurant-experiences-foundation-contract.test.mjs` | KEEP | Preserve identity and accessibility coverage not fully replaced by E2E. |
| `restaurateur-preview-security.test.mjs` | REPLACE | Remove dead allowlist member; preserve boundary scanner. |
| `sauge-noire-renderer-contract.test.mjs` | REPLACE | Remove proven lifecycle E2E mirror; preserve other guards. |
| `seo-foundation.test.mjs` | REPLACE | Remove dead Header/Footer references; preserve metadata. |
| `seo-interactive-showcases.test.mjs` | REPLACE | Remove proven E2E mirrors; preserve inert/reduced motion. |
| `seo-pillar-animations.test.mjs` | DELETE | Confirmed dead production graph; integrate atomically. |
| `seo-public-content.test.mjs` | REPLACE | Remove duplicate suite registration; both imported suites survive. |

### KEEP: Security, CI and preview boundaries (22)

Browser happy paths do not establish secret handling, boundary rejection, workflow permissions or preflight policy. No equivalent complete E2E replacement was demonstrated for these retained files.

- `admin-access-security.test.mjs`
- `admin-access-session.test.mjs`
- `admin-e2e-ci-contract.test.mjs`
- `admin-qr-access-input.test.mjs`
- `admin-qr-trusted-preflight.test.mjs`
- `ci-change-detection.test.mjs`
- `ci-collect-metrics.test.mjs`
- `ci-workflow-contract.test.mjs`
- `dependency-security-contract.test.mjs`
- `maison-elyse-ci-contract.test.mjs`
- `owner-3d-cdn-workflow.test.mjs`
- `owner-auth-policy.test.mjs`
- `owner-prepared-glb-workflow.test.mjs`
- `preview-request-policy.test.mjs`
- `proxy-matcher.test.mjs`
- `qr-environment-security.test.mjs`
- `qr-postgres-ci-contract.test.mjs`
- `restaurateur-preview-ci-contract.test.mjs`
- `runtime-asset-preview-e2e-preflight.test.mjs`
- `runtime-asset-preview-validator.test.mjs`
- `vercel-git-policy.test.mjs`
- `workflow-security-contract.test.mjs`

### KEEP: Cache and post-commit invalidation (18)

Staleness, signed material, error-after-commit and import/build boundaries need lower-level evidence. No equivalent complete E2E replacement was demonstrated for these retained files.

- `landing-menu-cache-contract.test.mjs`
- `menu-content-commit-invalidation.test.mjs`
- `menu-content-route-invalidation.test.mjs`
- `menu-mutation-cache-invalidation.test.mjs`
- `public-cache-policy.test.mjs`
- `public-cache-signed-material.test.mjs`
- `public-menu-cache-contract.test.mjs`
- `public-model-library-commit-invalidation.test.mjs`
- `public-model-route-invalidation.test.mjs`
- `public-prerender-artifact-safety.test.mjs`
- `published-menu-settings-invalidation.test.mjs`
- `published-menu-settings-route-invalidation.test.mjs`
- `restaurant-lifecycle-route-invalidation.test.mjs`
- `static-public-import-boundary.test.mjs`
- `static-public-rendering-contract.test.mjs`
- `static-public-root-layout.test.mjs`
- `static-public-route-manifest.test.mjs`
- `translation-post-commit-invalidation.test.mjs`

### KEEP: Money, allergens and localization (16)

Parsing, numeric precision, fail-closed allergens, locale completeness and edge cases exceed the browser fixtures. No equivalent complete E2E replacement was demonstrated for these retained files.

- `allergen-contract.test.mjs`
- `allergen-safety-regression.test.mjs`
- `backfill-menu-translations.test.mjs`
- `landing-i18n.test.mjs`
- `list-text.test.mjs`
- `maison-elyse-i18n-currency-rtl.test.mjs`
- `maison-elyse-locales.test.mjs`
- `menu-translations.test.mjs`
- `owner-price.test.mjs`
- `pricing-table-estimator.test.mjs`
- `public-menu-translation-readiness-normalization.test.mjs`
- `public-menu-translation-readiness.test.mjs`
- `qr-maison-elyse-currency-availability.test.mjs`
- `qr-postgres-concurrency-contract.test.mjs`
- `sauge-noire-fixture-i18n-integration.test.mjs`
- `tarifs-carte-vistaire-public.test.mjs`

### KEEP: QR lifecycle and integrity (21)

Canonical targets, token custody, schemas, permanent URLs and concurrency are not exhausted by UI tests. No equivalent complete E2E replacement was demonstrated for these retained files.

- `admin-qr-legacy-schema-contracts.test.mjs`
- `admin-qr-resolution-regression.test.mjs`
- `maison-elyse-qr-menu-source.test.mjs`
- `menu-qr-code.test.mjs`
- `owner-qr-canonical-contracts.test.mjs`
- `owner-qr-canonical-domain-api.test.mjs`
- `owner-qr-canonical-migration.test.mjs`
- `owner-qr-contract.test.mjs`
- `owner-qr-customizer-lifecycle.test.mjs`
- `owner-qr-domain-api-integrity.test.mjs`
- `owner-qr-public-permanence.test.mjs`
- `owner-qr-publication-page.test.mjs`
- `owner-qr-renderer.test.mjs`
- `owner-qr-resolution.test.mjs`
- `owner-qr-runtime-api-integration.test.mjs`
- `owner-qr-runtime.test.mjs`
- `owner-qr-schema-hardening.test.mjs`
- `owner-qr-targets.test.mjs`
- `owner-qr-test-runtime.test.mjs`
- `owner-qr-token-vault.test.mjs`
- `qr-contact-marc-vcard.test.mjs`

### KEEP: 3D, AR, media and production tooling (46)

Asset integrity, filesystem/process boundaries, platform decisions, rollback and release gates need direct checks. No equivalent complete E2E replacement was demonstrated for these retained files.

- `ar-browser-handoff.test.mjs`
- `ar-experience-state.test.mjs`
- `check-asset-policy.test.mjs`
- `dish-asset-replacement-cleanup.test.mjs`
- `dish-model-viewer-backdrop.test.mjs`
- `dish-review-swipe.test.mjs`
- `has-public-menu-3d.test.mjs`
- `heavy-asset-commands.test.mjs`
- `heavy-asset-pilot-report.test.mjs`
- `immersive-variant-selection.test.mjs`
- `ios-quicklook-promotion.test.mjs`
- `media-audit-safety.test.mjs`
- `media-backfill-core.test.mjs`
- `media-backfill-safety.test.mjs`
- `media-capacity-migration-contract.test.mjs`
- `media-capacity.test.mjs`
- `media-cli-behavior.test.mjs`
- `media-integrity.test.mjs`
- `media-rollback.test.mjs`
- `model-lab-before-after-sync.test.mjs`
- `owner-3d-ar-pipeline.test.mjs`
- `owner-3d-device-qa.test.mjs`
- `owner-3d-jobs.test.mjs`
- `owner-3d-lifecycle.test.mjs`
- `owner-3d-observability.test.mjs`
- `owner-3d-runner.test.mjs`
- `owner-3d-source-upload.test.mjs`
- `owner-3d-visual-review.test.mjs`
- `owner-dish-model-assets.test.mjs`
- `owner-dish-model-upload-queue.test.mjs`
- `owner-dish-photo-upload.test.mjs`
- `owner-dish-photo-uploader.test.mjs`
- `owner-maison-elyse-media-backfill.test.mjs`
- `owner-medias.test.mjs`
- `owner-menu-and-3d-source.test.mjs`
- `owner-meshy-runtime-workspace.test.mjs`
- `owner-public-media-contract.test.mjs`
- `owner-usdz-runtime-optimizer.test.mjs`
- `owner-usdz-source-not-stored.test.mjs`
- `production-3d-cli.test.mjs`
- `production-3d-final-pipeline.test.mjs`
- `production-3d-geometry.test.mjs`
- `production-3d-manifest.test.mjs`
- `production-3d-validators.test.mjs`
- `public-dish-asset-redirect.test.mjs`
- `source-upload-resolver.test.mjs`

### KEEP: Admin evidence and state (15)

Analytics calculations, isolation, evidence states and mutation consistency; admin browser baseline also has failures. No equivalent complete E2E replacement was demonstrated for these retained files.

- `admin-analytics-correctness.test.mjs`
- `admin-analytics-evidence.test.mjs`
- `admin-analytics-isolation.test.mjs`
- `admin-analytics-menu-identity.test.mjs`
- `admin-analytics-pr150-contract.test.mjs`
- `admin-analytics-schema-reconciliation.test.mjs`
- `admin-availability-rpc.test.mjs`
- `admin-availability.test.mjs`
- `admin-dashboard-contract.test.mjs`
- `admin-dashboard-range.test.mjs`
- `admin-dish-photo-route.test.mjs`
- `admin-dish-thumbnail.test.mjs`
- `admin-local-preview.test.mjs`
- `admin-menu-mutation-retry-identity.test.mjs`
- `admin-recommendations.test.mjs`

### KEEP: Owner data and editing (11)

Persistence, data contracts, creation failures and UI state lack proven equivalent E2E for every assertion. No equivalent complete E2E replacement was demonstrated for these retained files.

- `owner-cockpit-style.test.mjs`
- `owner-creation-normalized.test.mjs`
- `owner-demo-capabilities.test.mjs`
- `owner-menu-builder.test.mjs`
- `owner-menu-dish-fields-source.test.mjs`
- `owner-menu-settings-mutation.test.mjs`
- `owner-menu-settings-reload.test.mjs`
- `owner-photo-route-behavior.test.mjs`
- `owner-preparation-summary.test.mjs`
- `owner-restaurant-creation.test.mjs`
- `owner-restaurant-status.test.mjs`

### KEEP: Menu normalization and design (12)

Schema validation, transformations, design isolation and fallback paths have distinct lower-level cases. No equivalent complete E2E replacement was demonstrated for these retained files.

- `menu-appearance.test.mjs`
- `menu-config-transfer.test.mjs`
- `menu-design-quality.test.mjs`
- `menu-design-studio.test.mjs`
- `menu-settings-backfill-migration.test.mjs`
- `menu-style-advisor.test.mjs`
- `menu-ui-config-api-source.test.mjs`
- `menu-ui-config-schema.test.mjs`
- `menu-ui-config.test.mjs`
- `menu-url.test.mjs`
- `unique-menu-design-contract.test.mjs`
- `unique-menu-design-isolation.test.mjs`

### KEEP: Public restaurant renderers (21)

Identity, data mapping, locale context, rendering and regression guards; no wholesale E2E equivalence established. No equivalent complete E2E replacement was demonstrated for these retained files.

- `google-review-card-source.test.mjs`
- `google-review-direct-cta.test.mjs`
- `premium-dish-details-sheet.test.mjs`
- `premium-tag-colors.test.mjs`
- `public-menu-analytics-source.test.mjs`
- `public-menu-card-contract.test.mjs`
- `public-menu-core.test.mjs`
- `public-menu-detail-source.test.mjs`
- `public-menu-experience-source.test.mjs`
- `public-menu-relational.test.mjs`
- `public-menu-settings.test.mjs`
- `resto-marc-seed-source.test.mjs`
- `sauge-noire-image-url.test.mjs`
- `sauge-noire-menu-data.test.mjs`
- `sauge-noire-pageflip-contract.test.mjs`
- `sauge-noire-viewport-contract.test.mjs`
- `trouvable-category-icons.test.mjs`
- `trouvable-category-state.test.mjs`
- `trouvable-context-api.test.mjs`
- `trouvable-menu-controls.test.mjs`
- `trouvable-premium-menu-source.test.mjs`

### KEEP: Landing, SEO and public discovery (14)

Retain content/schema/identity and harness safeguards unless a specific duplicate was proven above. No equivalent complete E2E replacement was demonstrated for these retained files.

- `agent-discovery.test.mjs`
- `bilingual-seo.test.mjs`
- `demo-restaurant-experiences-contract.test.mjs`
- `landing-compare-slider-keyboard-contract.test.mjs`
- `landing-dish-identity.test.mjs`
- `landing-public-payload-safety.test.mjs`
- `landing-showcase-contract.test.mjs`
- `microsoft-clarity-contract.test.mjs`
- `optimizeglb-candidates.test.mjs`
- `prompt5-editorial-guides.test.mjs`
- `prompt5-playwright-harness.test.mjs`
- `restaurateur-preview-fixture.test.mjs`
- `seo-geo-pages.test.mjs`
- `supabase-usage-audit-safety.test.mjs`

PostgreSQL fixtures/tests, test-runtime helpers (except the explicitly removed unused loader), all 56 E2E specs, and E2E support files are preserved. They exercise database concurrency/security or provide the real browser replacement evidence.

## Implementation results

Node inventory after both lots: 217 files, 60,519 lines, 1,831 static declarations. Change: two dead-suite files removed, 42 declarations removed, 1,118 fewer Node-suite lines plus four helper lines removed. No E2E files or production files changed. Removal of two side-effect imports also avoids duplicate registration of the 14 pricing tests under the full Node glob; both pricing suites remain intact and must be listed explicitly by the package owner.

Actual local checks:

- Installation: the PATH npm wrapper failed with missing `npm-cli.js`; direct `node E:/Stocks/Node/node_modules/npm/bin/npm-cli.js ci --ignore-scripts --no-audit --no-fund` installed 591 packages after cache permissions were granted. No dependency manifest changed.
- Targeted modified suites excluding the separate tracing lot: 116 passed, zero failed/skipped (15,308 ms).
- Footer, FAQ, showcase, Sauge and image-renderer follow-up: 24 passed, zero failed/skipped (6,795 ms).
- Explicit SEO-content and two pricing suites: 16 passed, zero failed/skipped (201 ms).
- Blueprint/projection comparison: 19 passed before, 17 passed after; retained stronger inventory coverage included.
- `npm run assets:check`, `npm run lfs:check`, `npm run lint`, and `npm run typecheck`: passed via the direct npm CLI. `git diff --check`: passed.
- Tracing lot: 15 tests preserved. Against the old config here, two expected failures remain until the production tracing change is integrated. The implementation agent ran the same tests with imports/source paths relocated in memory to the actual 3D-owner checkout: 15 passed. This is not a claim of a standard consolidated run.

Independent review found no P0/P1 and one P2: E2E keyboard coverage did not replace the complete tab accessibility contract. The original test was restored in full; no coverage expansion was needed. Correctness and Ponytail reviews otherwise accepted the deletions.

No local server, browser, build, PostgreSQL suite or full Node rerun was started here: the orchestrator owns the live fixtures and complete validation of the consolidated revision. The 14 original Node failures remain explicitly recorded; no production changes were made to hide them. The orchestrator's additional baseline reports include WebKit 32 pass/two preview timeouts and admin 14 pass/nine failures/two skipped (old selectors/timeouts and absent full-menu scenarios); all corresponding live admin source mirrors were retained.

No `.next`, `test-results`, `playwright-report`, screenshots, traces or debug files were generated. No secret, media asset, migration, runtime code, package file or CI file was added or modified. Validation logs live outside the repository in the system temporary directory.

## Separately authorized baseline path repair

After the two audit lots, the orchestrator authorized correcting stale filesystem paths in `owner-3d-ar-pipeline.test.mjs`, `owner-3d-visual-review.test.mjs` and `owner-cockpit-style.test.mjs`. Their existing route checks still addressed `app/owner`, although the inspected pages live under the `(fr)` route group. Only those path segments changed; all assertions remain intact and public URLs remain unchanged. These three suites remain KEEP in the baseline inventory because no coverage was removed.

`node --test tests/owner-3d-ar-pipeline.test.mjs tests/owner-3d-visual-review.test.mjs tests/owner-cockpit-style.test.mjs`: before, 10 passed/four failed (207.729 ms); after, 14 passed/zero failed (201.536 ms). This repairs four pre-existing test failures, not product behavior. Two additional path-array lines make the final test/helper reduction 1,120 lines. No additional browser run or build is needed for path literals; consolidated validation remains with the orchestrator.
