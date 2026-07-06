# Vistaire Architecture

Vistaire is a Next.js App Router application for a premium restaurant menu experience. The core product is the public landing page, the demo menu, and dish detail pages with optional 3D/AR.

## Stack
- Next.js App Router, React, TypeScript, and Tailwind CSS.
- Clerk protects owner/internal routes.
- Supabase supports owner data and analytics storage.
- `@google/model-viewer` powers optional dish 3D/AR views.
- GSAP and local video/frame helpers power the landing hero.
- npm is the package manager, backed by `package-lock.json`.

## Route Map
- `/`: public Vistaire landing page.
- `/demo`: public demo restaurant menu.
- `/demo`: public dish detail page.
- `/admin`: public restaurant preview/admin demo surface.
- `/apercu-restaurateur`: public marketing page that presents the restaurateur dashboard value proposition.
- `/owner`: protected internal Vistaire owner cockpit.
- `/sign-in`: Clerk sign-in.
- `/todos`: protected starter route, outside the Vistaire product surface.
- `/api/analytics/events`: public event ingestion with validation.
- `/api/analytics/summary`, `/api/restaurants`, `/api/owner/*`: protected APIs.
- `/api/admin/assistant`: same-origin admin preview assistant endpoint.

## Auth Boundary
`proxy.ts` protects page routes such as `/owner` and `/todos` with Clerk. Owner API routes call `requireVistaireOwnerApi()` and owner pages call `getVistaireOwnerAuthorization()` after Clerk sign-in, then check `VISTAIRE_OWNER_EMAILS`, `VISTAIRE_OWNER_USER_IDS`, and `VISTAIRE_OWNER_CLERK_USER_IDS` server-side. Do not treat `/admin` as authenticated owner tooling; it remains a public noindex preview surface, but robots now disallows `/admin` so crawlers do not treat it as a public marketing page.

## Product Boundaries
- Landing: `app/page.tsx`, `components/landing/*`, `components/Header.tsx`, `components/DemoRequestSection.tsx`.
- Demo menu: `app/demo/*`, `components/menu/*`, `lib/demoMenuData.ts`, `lib/menuQuery.ts`.
- Dish detail and 3D/AR: `app/demo/page.tsx`, `components/dish/*`, `lib/dishAssetWarmup.ts`, `lib/quickLookAssets.ts`, `lib/arEnvironment.ts`.
- Public restaurateur dashboard marketing: `app/apercu-restaurateur/page.tsx`.
- Admin preview: `app/admin/*`, `components/admin/*`, `lib/admin/*`, `lib/demoAdminInsights.ts`.
- Owner/internal: `app/owner/*`, `components/owner/*`, `lib/owner/*`.
- Analytics: `lib/analytics/*`, `app/api/analytics/*`.
- SEO metadata: `lib/seo.ts`, `app/robots.txt/route.ts`, `app/sitemap.ts`, page metadata exports.

## 3D/AR Flow
Dish detail pages render food content first. The 3D viewer is lazy-loaded after user intent, then `model-viewer` chooses the appropriate GLB/USDZ path for the environment. iOS Quick Look must use approved production USDZ URLs, and unsupported devices need clear fallback UI.

Detailed asset rules live in `docs/repo-asset-policy.md`, `docs/ar-asset-optimization-pipeline.md`, and `docs/usdz-optimization.md`.

## Setup-Only Boundary
Setup-only PRs may update repo instructions, docs, PR templates, CI, and package scripts. They must not change runtime pages, product copy, hero behavior, demo data, 3D assets, SEO runtime, or public media unless the user explicitly expands the scope.
