# Application pruning audit

Base: `2220762673087226f7ed914d8aca97f13d3baa78` (`origin/main`).
Scope: remove application modules unreachable from every current App Router entrypoint, without changing routes, live renderers, auth, queries, cache semantics or media.

## Evidence

- Inspected all candidate implementations and searched static imports, dynamic imports, require calls, exports, filesystem loaders, scripts, tests and configuration. Searches used `rg --no-ignore` because default ignore rules hid source matches in this worktree.
- Home FR/EN renders VistairePreviewLanding -> VistaireLanding -> LandingHero. Current navigation/footer are PreviewNav/PreviewFooter.
- Four SEO pillar routes render Vistaire*Preview and VistaireSeoProductionSections; their metadata, JSON-LD and data remain unchanged. The archive route is a generic noindex page, not a dynamic loader of old components.
- /admin renders AdminOverview; insights and availability have their own current components. Assistant API endpoints remain intact even though the old UI is unreachable.
- /demo and /en/vistaire-menu render DemoPhoneShowcase. Public menus dispatch MaisonElyseQrMenu, TrouvablePremiumMenuExperience, registered unique renderers or PublicMenuRenderer. PublicMenuExperience is explicitly excluded by the current renderer contract.
- OwnerAiPanel and OwnerRestaurantQrTargetSwitcher have no production consumers. The owner AI API uses data/rules directly; its unused context mapper is not involved.
- publicMenuCache.ts has no production caller. Its only remaining import is an unused test loader, coordinated with the test owner. Current publicMenu.ts uses request cache and in-flight coalescence; tests/public-menu-cache-contract.test.mjs explicitly prohibits a durable completed-value cache.
- The browser Supabase client and demo analytics generator have no callers. Server/session/admin clients, project validation and analytics readers remain unchanged.
- Available Git history records the old admin implementation at 038f42f0, QR switcher at 78bcc33a and cache/menu changes at e97713dd. History is shallow; the exact original replacement commit is not claimed. The available 9767a40b boundary already uses the new home/SEO renderers.

## Removed files

Each file below belongs solely to one of the unreachable subgraphs described above. Private CSS is removed only with its sole consumer.

- `components/ScrollVideoHero.tsx`
- `components/DynamicVideoText.tsx`
- `components/Header.tsx`
- `components/DemoRequestSection.tsx`
- `components/PrimaryButton.tsx`
- `components/landing/DesktopLandingHero.tsx`
- `components/landing/MobileLandingHero.tsx`
- `components/landing/ResponsiveLandingHero.tsx`
- `components/landing/ScrollScrubVideoHero.tsx`
- `components/landing/useHeroVideoMode.ts`
- `components/landing/useIsDesktopHero.ts`
- `components/landing/PdfVsVistaireTeaser.tsx`
- `components/landing/ProductJourneySection.tsx`
- `lib/videoChapters.ts`
- `lib/vistaireGlass.ts`
- `components/seo/pages/MenuDigitalRestaurantPage.tsx`
- `components/seo/pages/MenuQrCodeRestaurantPage.tsx`
- `components/seo/pages/MenuPdfVsDigitalPage.tsx`
- `components/seo/pages/Menu3dArRestaurantPage.tsx`
- `components/seo/animations/CinematicMenuBloom.tsx`
- `components/seo/PdfVistaireCompareSlider.tsx`
- `components/seo/VistaireDigitalMenuScene.tsx`
- `components/seo/SeoComparisonTable.tsx`
- `components/seo/SeoTakeaway.tsx`
- `components/seo/SeoFooter.tsx`
- `lib/cinematicMenuBloomData.ts`
- `components/admin/AdminRestaurantDashboard.tsx`
- `components/admin/AdminAnalyticsPanel.tsx`
- `components/admin/adminDashboardViewModel.ts`
- `components/admin/AdminDishWorklist.tsx`
- `components/admin/AdminAssistant.tsx`
- `components/admin/AdminEngagementFunnel.tsx`
- `components/admin/AdminInsightCard.tsx`
- `components/admin/AdminRecommendations.tsx`
- `components/admin/AdminSearchInsights.tsx`
- `components/admin/AdminServiceActivity.tsx`
- `components/admin/AdminTopDishes.tsx`
- `components/admin/AdminAnalytics.module.css`
- `components/admin/charts/InteractiveBars.tsx`
- `components/admin/overview/AdminActivityChart.tsx`
- `components/owner/OwnerAiPanel.tsx`
- `components/owner/OwnerRestaurantQrTargetSwitcher.tsx`
- `components/owner/OwnerRestaurantQrTargetSwitcher.module.css`
- `lib/owner/ai/context.ts`
- `lib/admin/demoAnalyticsEvents.ts`
- `components/menu/PublicMenuExperience.tsx`
- `components/menu/PublicMenuExperience.module.css`
- `lib/menu/publicMenuCache.ts`
- `utils/supabase/client.ts`
- `components/menu/CategoryTabs.tsx`
- `components/menu/DemoExperienceShell.tsx`
- `components/menu/DemoMenuClient.tsx`
- `components/menu/DishCard.tsx`
- `components/menu/DishGrid.tsx`
- `components/menu/MenuFilterBar.tsx`
- `components/menu/MenuHero.tsx`
- `components/menu/MenuSearchBar.tsx`

## Deliberately retained

- Final integration removes lib/frameConfig.ts after the obsolete frames:update-config command and script are removed.
- components/admin/charts/index.ts: used by behavioural chart tests; its helpers remain live.
- SmoothScrollProvider and its Lenis/GSAP effects: still mounted on /demo.
- Final integration removes DemoSimulationContext and useIsRealMobile after the obsolete DishDetail consumers are removed; the demo layout retains SmoothScrollProvider and all metadata. getDishDetailImageObjectPosition and getSignatureDishes are also removed after confirming no remaining callers.
- All route entrypoints, active UI/CSS, shared types, media, schema fallbacks, auth and Supabase queries. Package, script, test and obsolete 3D changes are documented in the other audit reports.
- lib/owner/menuMutations.ts: optional simplifications deferred; this batch contains deletions only.

## Test coordination

The test owner adapts mixed contracts referencing the removed files: admin-dashboard-ui, admin-dashboard-readiness, admin-assistant-isolation, admin-interactive-charts, owner-restaurant-qr-target, public-menu-card-renderer, public-menu-category-identifiers, public-menu-renderer-source and seo-foundation. Legacy-only seo-pillar-animations is evaluated separately. The unused loadPublicMenuCache test helper must be removed. Behavioural assertions on active routes, renderers, authorization, data and charts must remain.

## Measurements and validation

- Application removal: 57 files, 7,606 lines (including 572 lines of private CSS).
- Route inventory stays 64 pages, 74 route handlers and 7 layouts; only the unused demo provider wrapper is removed from a layout during integration.
- No dependencies added or removed by this batch. No asset changes.
- Baseline supplied by integration: npm ci, assets, LFS, lint, typecheck, build, import boundary, static routes and prerender passed; 43 core Chromium E2E passed. Full Node baseline: 1,894 tests, 1,876 passed, 14 failed, 4 skipped.
- Local checks: TypeScript CLI passed after both batches. bilingual-seo, landing-i18n and seo-public-content passed, 29/29; public-menu-cache-contract, public-menu-core and admin-analytics-isolation passed, 33/33. Asset policy passed. git diff --check passed.
- The normal npm launcher is broken in this environment (missing npm-cli.js); direct installed tool CLIs are used where necessary.
- Independent review: no P0/P1 findings. A TypeScript AST pass over 940 remaining files and 4,033 imports/reexports/require calls found no production reference to deleted modules. Deleted blobs and current route implementations were inspected directly; removed CSS has no global selectors or composition dependencies. Known references are confined to the coordinated tests. Ponytail review found no added complexity.
- Final lint/LFS outcomes are recorded in the handoff. Full consolidated build/E2E and 390/430px browser parity remain integration gates, especially for Tailwind output after removing scanned sources. These are centralized by the orchestrator rather than duplicated in this worktree.

No production requests, migrations, secrets, media writes or merge operations were performed. The shared node_modules junction is local validation tooling, not a repository change.
