# Repository audit — 2026-11-10

Base: `origin/main` at `6af659bf`. Method: lint, typecheck, node tests, an
import-graph reachability scan from the Next.js entry points, an identifier scan
for unused exports, reference scans for scripts and assets, and GitHub Actions
run history. Nothing in the "Needs review" section was changed.

## Fixed in this branch

| Item | Evidence |
| --- | --- |
| Nightly CI never started | `Nightly exhaustive CI` ended in `startup_failure` on all 97 most recent runs (2026-08 onward). `app-ci.yml` requests `actions: read`; `nightly.yml` granted only `contents: read`, and a called workflow cannot exceed its caller's token. The `exhaustive` job now grants both. A contract test pins it. |
| CI metrics summary printed on one line | `app-ci.yml` joined lines with `'\\n'` inside a quoted heredoc, which is a literal backslash-n. Reproduced locally: output had zero newlines. |
| 18 dead files (about 3,500 lines) | No importer in `app/`, `components/`, `lib/`, scripts, tests, or the two open feature branches. See list below. |
| `gsap` and `lenis` dependencies | Only importer was the dead `components/SmoothScrollProvider.tsx`. Removed with the `.lenis` rules in `app/globals.css`; lockfile hash refreshed per `docs/ci-supply-chain.md`. |

Deleted files: `app/(fr)/menu/[slug]/menu.module.css`,
`components/SmoothScrollProvider.tsx`, `components/admin/AdminDashboard.module.css`,
`lib/deviceCapabilities.ts`, `lib/openSystemBrowser.ts`, and in
`components/vistaire-preview/`: `PublicPreviewDishImage.tsx`,
`RestaurateurPreviewAvailability.tsx`, `RestaurateurPreviewInsights.tsx`,
`RestaurateurPreviewOverview.tsx`, `VistaireMenu3dArRestaurantPreview.tsx`,
`VistaireMenuDigitalRestaurantPreview.tsx` and `.module.css`,
`VistaireMenuQrCodeRestaurantPreview.tsx`, `VistairePdfVsMenuDigitalPreview.tsx`
and `.module.css`, `VistairePillarExperiences.module.css`,
`VistaireSeoProductionSections.tsx` and `.module.css`.

## Needs review

### Broken or unstable

1. **`main` is red.** The last push run of App CI on `6af659bf` failed in
   `webkit-critical (3/3)`: `e2e/restaurateur-preview.spec.ts:248` (video
   `currentTime` assertion, WebKit). Every other job passed. Looks flaky, not
   verified.
2. **17 Playwright specs run in no CI family and no named script**, so nothing
   proves they still pass: `admin-availability`, `admin-dashboard`,
   `admin-insights`, `contact-form`, `owner-3d-ar-pipeline`,
   `owner-menu-builder-preview`, `owner-qr-codes`,
   `owner-restaurant-command-center`, `pricing-page`, `public-premium-auth`,
   `restaurant-geometry-ab`, `static-public-rendering`,
   `trouvable-menu-language-category-regression`, `trouvable-menu-section-swipe`,
   `trouvable-public-saved-settings`, `trouvable-theme-settings`,
   `unique-menu-design`. Decide per spec: wire into a family, or delete.
3. **Node tests fail on a Windows checkout** (they pass on Linux CI):
   - `tests/maison-elyse-ci-contract.test.mjs` matches `\n` against a CRLF
     working copy (`core.autocrlf=true`, no `eol` rule in `.gitattributes`).
   - `tests/admin-studio-heatmap.test.mjs` and
     `tests/admin-studio-metric-explorer.test.mjs` fail with
     `ERR_VM_MODULE_LINK_FAILURE` loading `recharts` under Node 24.11.0.
   - `tests/production-3d-final-pipeline.test.mjs:1433` hit its 600 s timeout in
     one of two full runs and passed in the other.
4. **`SECURITY.md` is the untouched GitHub template** (fake version table,
   "Tell them where to go"). Needs a real contact and policy.
5. `.github/workflows/codeql.yml` and `tests/admin-e2e-ci-contract.test.mjs` are
   committed with mixed line endings.

### No longer used in production, still pinned by tests

Each group is unreachable from every route, layout, proxy, and worker entry
point. Removing one means deleting or rewriting the source-reading tests listed.

6. **Old admin dashboard, about 40 files / 2,700 lines.** `/admin` renders
   `components/admin/studio/*` only. Unused: `components/admin/{availability
   (except availabilityMutation.ts),charts,insights,overview}`,
   `components/admin/system/{AdminNav,AdminShell,AdminPrimitives,AdminPresentationPrimitives}.tsx`,
   `AdminSystem.module.css`, `AdminDishAvailabilityControl.tsx`,
   `AdminMenuActions.tsx`, `lib/adminPresentationCopy.ts`,
   `lib/admin/analyticsPresentationCopy.ts`. Pinned by
   `tests/admin-dashboard-ui`, `admin-availability`, `admin-interactive-charts`,
   `admin-dashboard-readiness`, `restaurateur-preview-security`.
7. **Old landing, about 31 files / 5,300 lines.** `/` renders
   `components/immersive/*`. Unused: `components/landing/*` (except
   `LandingPublicMenuLink.tsx` and `VistaireLanding.module.css`),
   `components/restaurant-experiences/*`, and in `components/vistaire-preview/`:
   `VistairePreviewLanding`, `DemoPhoneShowcase`, `VistairePdfToDigitalHoverReveal`,
   `VistairePreviewPdfCompareSlider`. Pinned by `tests/landing-showcase-contract`,
   `demo-restaurant-experiences-contract`, `restaurant-experiences-foundation-contract`,
   `static-public-import-boundary`, and others.
8. `lib/owner/usdzRuntimePipeline.ts` and `usdzRuntimePipelineCore.ts`:
   `runUsdzRuntimePipeline` has no caller outside
   `tests/owner-usdz-source-not-stored.test.mjs`.
9. `components/seo/InternalSeoLinks.tsx`: its only importer was deleted above;
   `tests/seo-foundation.test.mjs` still reads the file.
10. **`/todos`** (`app/(fr)/todos/page.tsx`) is the Supabase starter page. It
    queries a `todos` table that no migration creates. Removing it touches
    `proxy.ts`, `lib/seo.ts`, `utils/supabase/{server,middleware}.ts`, and about
    ten tests.
11. **62 exports with no reader anywhere, 52 read only by tests.** A further 515
    are exported but used only inside their own file. Lists at the end.

### Scripts with no entry point

Not referenced by `package.json`, CI, `next.config.ts`, or other code:

12. No reference at all: `scripts/admin-visual-compare.mjs`,
    `build-homard-ar-usdz.mjs`, `convert-homard-ar-lite-to-usdz.mjs`,
    `create-demo-3d-models.py`, `fix-plated-demo-models.mjs`,
    `fix-ravioles-model-layout.mjs`, `inspect-demo-models.mjs`,
    `normalize-homard-model.mjs`, `owner/fix-sauge-noire-menu-anomalies.mjs`,
    `compare-usdz-scenes.py` (one doc mention).
13. Referenced by tests or runbooks only (manual operations, probably
    intentional): `3d/heavy-asset-pilot-report.mjs`,
    `3d/prune-restaurant-offscreen-experiment.mjs`, `admin-visual-audit.mjs`,
    `backfill-menu-translations.mjs`, `diagnose-landing-composition.mjs`,
    `owner/backfill-maison-elyse-media.mjs`, `qr-environment-preflight.mjs`.

### Assets

14. **Tracked source drops outside `public/`, about 150 MB.** `Homar/` (10 PNG,
    20.7 MB, no reference), `LogoVistaire.png` (0.9 MB, provenance doc only),
    `3D Plat/` (75.6 MB) and `3D photo/` (8.2 MB), both listed in `.gitignore`
    yet tracked and allowlisted in `scripts/check-large-files.mjs`. `Framer/`
    (22 PNG, 45 MB): 3 are imported by live code, 2 only by the dead
    `DemoPhoneShowcase`, 17 by nothing.
15. **39 files under `public/` (11.3 MB) whose name appears in no source file.**
    Names may be built at runtime, so confirm in the browser before removing.
    Largest: `public/immersive-media/cinematic-{landscape,portrait}.mp4` (5.1 MB),
    `public/images/pricing/vistaire-carre.png` (1.6 MB),
    `public/immersive-assets/ambience-*.webp` (1.4 MB),
    `restaurant-courtyard.webp`, `walnut-texture.webp`, `support-*.webp`,
    `experience-*.webp`, `phone-poster-{sauge-noire,trouvable}.webp`,
    `public/fonts/vistaire-preview/{NeueMontreal-Light,NeueMontreal-Medium,btsuave-bold}.otf`,
    four `public/images/marketing/*-thumb.webp` / `sauge-noire-qr-menu-portrait.webp`.
16. `.vercelignore` lists `PhotoPlatDemo/` and `video/`, which do not exist, and
    does not exclude `LogoVistaire.png` or the unused `Framer/*.png`.

### Configuration and documentation drift

17. **`.env.example` omits about 20 variables the runtime reads**, including the
    owner allowlist (`VISTAIRE_OWNER_EMAILS`, `VISTAIRE_OWNER_USER_IDS`,
    `VISTAIRE_OWNER_CLERK_USER_IDS`), `VISTAIRE_LOCAL_PREVIEW_SECRET`,
    `ANALYTICS_DISABLED`, and the `VISTAIRE_3D_*` set. The site origin is read
    from four different names: `NEXT_PUBLIC_SITE_URL`, `SITE_URL`,
    `NEXT_PUBLIC_APP_URL`, `VISTAIRE_APP_ORIGIN`.
18. `three` is in `devDependencies` but imported by 16 files in
    `components/immersive/`. Works on Vercel (dev dependencies are installed for
    the build); breaks any install that omits them.
19. Four `shellcheck disable` exemptions carry `Review: 2026-09-30`, now past
    (`app-ci.yml`, `preview-smoke.yml` twice, `production-smoke.yml`).
20. `docs/` holds 84 files in `archives/`, 24 in `superpowers/`, and four
    `ponytail-*` audits. `docs/seo-route-inventory.md` points at
    `app/todos/page.tsx`, which moved to `app/(fr)/todos/page.tsx`.
21. `.caveman/config.json` is a personal tool setting tracked in the repo.
22. `tests/ci-change-detection.test.mjs:109` uses the path of the deleted
    `VistaireMenuQrCodeRestaurantPreview.tsx` as classifier input. Still valid as
    a path string; rename if it reads as confusing.

### Local checkout (not in Git)

23. The main checkout sits on `feat/privacy-consent-legal-compliance`, whose PR
    #228 is closed and which is 31 commits behind `main`.
24. 25 worktrees exist. Three belong to merged PRs (`cdn-assets`, `deps-rollup`,
    `security-braces`) and eleven to closed PRs. Remove with care: a forced
    `git worktree remove` follows `node_modules` junctions.
25. Untracked leftovers in the main checkout: `.codex-dev-server.log`,
    `debug.log`, `tsconfig.tsbuildinfo`, `test-results/`.

## Lists

### Exports with no reader (62)

- `components/admin/studio/StudioCharts.tsx`: `StudioBars`
- `components/admin/system/AdminIcons.tsx`: `OverviewIcon`, `AvailabilityIcon`, `InsightsIcon`, `ExternalIcon`, `LogoutIcon`, `InfoIcon`, `AlertIcon`, `TrendIcon`
- `components/immersive/ARActions.jsx`: `isIOSDevice`
- `components/immersive/useModelGesture.js`: `createSupportGestureController`
- `components/menu/premiumTagColors.ts`: `minHueSeparation`
- `components/menu/trouvableMenuControls.ts`: `normalizeTrouvableLocale`, `normalizeTrouvableLocaleForSettings`, `getTrouvableLocalePublicTag`
- `components/menu/unique/sauge-noire/SaugeNoireFlipPage.tsx`: `listSaugeNoireOriginalPages`
- `lib/admin/recommendations.ts`: `formatAssistantMetricPercent`
- `lib/analytics/serverRows.ts`: `hasUsableRows`
- `lib/i18n.ts`: `localeFromHeaderValue`
- `lib/landing/landingMenuUiPreview.ts`: `inflateLandingLocalizedMenus`
- `lib/landing/publicMenuPreview.ts`: `photoForDish`
- `lib/menu/allergens.ts`: `allergenIdForFilter`
- `lib/menu/maisonElyseLocalization.ts`: `MaisonElyseLocale`, `MaisonElyseCopy`
- `lib/menu/menuExperienceBlueprints.ts`: `isMenuExperienceBlueprintId`
- `lib/menu/menuUiConfig.ts`: `isMenuUiThemeId`
- `lib/menu/publicMenuEnglishFallback.ts`: `applyCanonicalEnglishPresentation`
- `lib/menu/trouvableMenuExperience.ts`: `isUniquePublicMenu`
- `lib/menu/uniqueMenuDesign.ts`: `cloneUniqueMenuDesign`
- `lib/menu/uniqueMenuRendererRegistry.ts`: `REGISTERED_UNIQUE_MENU_RENDERER_KEYS`
- `lib/menuQuery.ts`: `MENU_ALL_CATEGORY_SLUG`, `dishMatchesSearch`, `defaultMenuFilterState`, `applyMenuFilters`, `hasActiveFilters`
- `lib/owner/dishPhotoUpload.ts`: `buildDishPhotoDerivativeStoragePath`
- `lib/owner/mediaCapacity.ts`: `MEDIA_CAPACITY_MIN_HEADROOM_PERCENT`
- `lib/owner/menuUrls.ts`: `buildRestaurantMenuUrl`
- `lib/owner/modelLab/modelLabPresets.ts`: `ModelLabGeometryCompression`, `ModelLabTextureFormat`
- `lib/owner/owner3dPathSegments.ts`: `cleanOwner3dDashId`, `cleanOwner3dAuditId`
- `lib/owner/preparedModelWorkflow.ts`: `PREPARED_GLB_PENDING_STATUS`, `PREPARED_GLB_PUBLISHED_JOB_STATUS`, `PREPARED_GLB_FAILED_JOB_STATUS`, `mergePreparedModelMetadata`
- `lib/owner/qrTokens.ts`: `hashQrToken`, `createSignedQrToken`
- `lib/owner/threeDArPipeline.ts`: `versionBasename`
- `lib/owner/threeDJobsModel.ts`: `isTerminalJobStatus`
- `lib/owner/threeDOptimizeGlbModel.ts`: `REQUIRED_CANDIDATE_SET_ROLES`, `OPTIMIZEGLB_PRESET_GUIDANCE`
- `lib/owner/threeDSourceDownloadAudit.ts`: `listSourceDownloadEvents`
- `lib/owner/threeDSourceUploadModel.ts`: `SOURCE_UPLOAD_SIZE_WARNING_BYTES`
- `lib/owner/usdzRuntimeModel.ts`: `validateUsdzFile`
- `lib/pricingPage.ts`: `SAMPLE_MENU_PATH_EN`
- `lib/restaurant-experiences/contracts.ts`: `RestaurantExperienceTab`
- `lib/restaurateurPreview/copy.ts`: `RestaurateurPreviewCopy`, `metricCopyKey`
- `lib/seo.ts`: `CONTACT_REGION_LABEL`, `PUBLIC_SITEMAP_UPDATED_AT`
- `lib/vistaireRouteTheme.ts`: `isSaugeNoirePath`

### Exports read only by tests (52)

- `components/admin/availability/availabilityMutation.ts`: `createAvailabilityMutation`
- `components/admin/system/AdminIcons.tsx`: `MenuOpenIcon`, `DishViewsIcon`, `SearchIcon`, `ImmersiveIcon`, `EventIcon`, `PeriodIcon`
- `components/immersive/content.js`: `money`
- `components/menu/premiumTagColors.ts`: `assignPremiumTagAccentsGlobally`, `getPremiumTagAccent`, `countUniqueAccents`
- `components/menu/trouvableMenuControls.ts`: `isTrouvableLocaleSupported`, `formatTrouvablePriceLabel`, `getTrouvableGreetingPeriod`, `getTrouvableGreeting`, `translateTrouvableCategoryLabel`
- `components/vistaire-preview/VistairePreviewChrome.tsx`: `PreviewFooter`
- `lib/admin/analyticsPresentation.ts`: `partitionAdminAnalyticsEvents`
- `lib/analytics/client.ts`: `trackPublicMenuSessionStarted`
- `lib/cache/publicCachePolicy.ts`: `STATIC_LANDING_FALLBACK_RETRY_SECONDS`, `futurePublicMenuCacheKeyParts`, `futurePublicMenuCacheTag`
- `lib/editorialGuides.ts`: `getEditorialGuides`
- `lib/i18n.ts`: `VISTAIRE_LOCALE_HEADER`
- `lib/landing/landingDishIdentity.ts`: `resolveLandingDishPhoto`
- `lib/menu/publicMenuCore.ts`: `isFreshHomemadeMenu`
- `lib/menu/publicMenuEnglishFallback.ts`: `buildMaisonEnglishPublicMenu`
- `lib/menu/publicMenuTranslationReadiness.ts`: `storedTranslationRowMatchesFields`
- `lib/menu/trouvableCategoryIcons.ts`: `getTrouvableCategorySortPriority`
- `lib/menu/uniqueMenuDesign.ts`: `FORBIDDEN_PUBLIC_UNIQUE_TERMS`
- `lib/menu/uniqueMenuRendererRegistry.ts`: `isRegisteredUniqueMenuRendererKey`, `assertNoDynamicUniqueRendererImport`
- `lib/owner/mediaRollback.ts`: `rollbackCreatedMediaObjects`
- `lib/owner/menuMutationRevalidation.ts`: `revalidateOwnerMenuMutationPaths`
- `lib/owner/preparedModelWorkflow.ts`: `isPreparedGlbPipelineStep`, `buildPreparedModelStoragePath`, `buildPreparedModelMetadata`
- `lib/owner/publicMenuSettingsFallback.ts`: `publicMenuSettingsFromUiConfigRows`, `readUiConfigPublicMenuSettings`
- `lib/owner/qrCreationCore.ts`: `createOwnerQrCodeWithDependencies`
- `lib/owner/qrResolutionCore.ts`: `isQrMetadataRpcUnavailable`, `resolveLegacyMenuQrScan`
- `lib/owner/qrStore.ts`: `createOwnerQrCode`
- `lib/owner/threeDJobsModel.ts`: `PIPELINE_JOB_STATUSES`, `findPipelineJob`
- `lib/owner/usdzRuntimeModel.ts`: `createUsdzRuntimeAssetVersion`
- `lib/pdfComparePreviewData.ts`: `buildPdfComparePreviewData`
- `lib/pricingPage.ts`: `SAMPLE_MENU_PATH`
- `lib/publicDishAssetRedirect.ts`: `resetPublicDishAssetCachesForTests`
- `lib/restaurant-experiences/contracts.ts`: `payloadMatchesExperience`
- `lib/seoGeoPages.ts`: `getPublishedSeoGeoPaths`
- `lib/vistaireRouteTheme.ts`: `VISTAIRE_ROUTE_THEME_HEADER`

## Limits of this audit

- The export scan matches identifiers by name. A name that is absent everywhere
  is unused; a common name used elsewhere for a different symbol hides a dead
  export, so the lists are a lower bound.
- The asset scan matches file names in source text; runtime-built names look
  unreferenced.
- No Playwright suite was run. No security review was repeated. Supabase and
  Vercel production state were not inspected.
