# Vistaire SEO Route Inventory

Last updated: 2026-06-21  
Branch: `codex/seo-geo-aeo-search-intent-engine`  
Base checked: `origin/main` at `43a23816be2cfbdf11da420aad2ff662c118a1b3`

## Summary

Vistaire has three public route families:

- Bilingual public marketing and SEO routes driven by `lib/i18n.ts`.
- FR-only SEO/GEO/AEO routes driven by `lib/seoGeoPages.ts`.
- Noindex/internal operational routes for owner, admin, QR token, dynamic menu, preview, dev, API, legacy, sign-in and todos surfaces.

No routes were deleted in this pass. `/todos` remains the strongest obsolete candidate, but it is already noindex and robots-disallowed. Removing it should be a separate cleanup after confirming whether any Supabase starter smoke checks still reference it.

## Public Indexable Routes

| Route | File / source | Role | Canonical | Hreflang | Sitemap | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `/` | `app/page.tsx` | Homepage | self | FR/EN | yes | low | Keep as main product entry. |
| `/en` | `app/en/page.tsx` | English homepage | self | FR/EN | yes | low | Keep bilingual pair. |
| `/demo` | `app/demo/page.tsx` | Public card experience | self | FR/EN with `/en/vistaire-menu` | yes | medium naming | Public copy should prefer card/sample wording; route kept for stability. |
| `/en/vistaire-menu` | `app/en/vistaire-menu/page.tsx` | English card experience | self | FR/EN | yes | low | Keep as EN equivalent. |
| `/tarifs-menu-digital-restaurant` | `app/(seo)/tarifs-menu-digital-restaurant/page.tsx` | Pricing | self | FR/EN | yes | low | Keep as commercial page. |
| `/en/pricing-digital-restaurant-menu` | `app/en/pricing-digital-restaurant-menu/page.tsx` | English pricing | self | FR/EN | yes | low | Keep. |
| `/menu-digital-restaurant` | `app/(seo)/menu-digital-restaurant/page.tsx` | SEO pillar | self | FR/EN | yes | low | Keep as pillar. |
| `/en/digital-restaurant-menu` | `app/en/digital-restaurant-menu/page.tsx` | EN SEO pillar | self | FR/EN | yes | low | Keep. |
| `/menu-qr-code-restaurant` | `app/(seo)/menu-qr-code-restaurant/page.tsx` | SEO pillar | self | FR/EN | yes | low | Keep as QR pillar. |
| `/en/qr-code-restaurant-menu` | `app/en/qr-code-restaurant-menu/page.tsx` | EN QR pillar | self | FR/EN | yes | low | Keep. |
| `/menu-3d-ar-restaurant` | `app/(seo)/menu-3d-ar-restaurant/page.tsx` | SEO pillar | self | FR/EN | yes | medium claims | Keep 3D/AR selective language. |
| `/en/3d-ar-restaurant-menu` | `app/en/3d-ar-restaurant-menu/page.tsx` | EN 3D/AR pillar | self | FR/EN | yes | medium claims | Keep fallback language. |
| `/menu-pdf-vs-menu-digital` | `app/(seo)/menu-pdf-vs-menu-digital/page.tsx` | SEO pillar | self | FR/EN | yes | low | Keep as comparison pillar. |
| `/en/pdf-vs-digital-menu` | `app/en/pdf-vs-digital-menu/page.tsx` | EN PDF pillar | self | FR/EN | yes | low | Keep. |
| `/a-propos` | `app/a-propos/page.tsx` | About | self | FR/EN | yes | low | Keep. |
| `/en/about` | `app/en/about/page.tsx` | EN about | self | FR/EN | yes | low | Keep. |
| `/contact` | `app/contact/page.tsx` | Contact | self | FR/EN | yes | low | Keep. |
| `/en/contact` | `app/en/contact/page.tsx` | EN contact | self | FR/EN | yes | low | Keep. |
| `/prendre-rendez-vous` | `app/prendre-rendez-vous/page.tsx` | Appointment CTA | self | FR/EN | yes | low | Keep. |
| `/en/book-a-call` | `app/en/book-a-call/page.tsx` | EN appointment | self | FR/EN | yes | low | Keep. |
| `/apercu-restaurateur` | `app/apercu-restaurateur/page.tsx` | Public restaurateur preview | self | FR/EN | yes | low | Keep indexable. |
| `/en/restaurant-preview` | `app/en/restaurant-preview/page.tsx` | EN restaurateur preview | self | FR/EN | yes | low | Keep. |

## New FR-Only SEO/GEO/AEO Routes

All new routes are served by `app/(geo)/[slug]/page.tsx`, use data from `lib/seoGeoPages.ts`, generate self-canonical metadata, omit hreflang until real EN content exists, emit WebPage/BreadcrumbList/Service/FAQPage JSON-LD, and are added to the sitemap.

| Route | Role | Canonical | Hreflang | Sitemap | Risk | Recommendation |
|---|---|---|---|---|---|---|
| `/menu-qr-sans-pdf` | AEO problem page | self | none | yes | low | Keep; distinct from QR pillar by PDF-specific problem. |
| `/menu-digital-sans-application` | AEO no-app page | self | none | yes | low | Keep; captures no-download intent. |
| `/remplacer-menu-pdf-restaurant` | PDF replacement page | self | none | yes | medium | Keep separate from PDF comparison; monitor overlap. |
| `/alternative-menu-pdf-restaurant` | PDF alternative page | self | none | yes | medium | Keep; language avoids unsupported "best" claims. |
| `/fiche-plat-digitale-restaurant` | Dish page feature intent | self | none | yes | low | Keep; high product relevance. |
| `/menu-restaurant-photos` | Photos feature intent | self | none | yes | low | Keep; no new assets added. |
| `/menu-restaurant-allergenes` | Allergens feature intent | self | none | yes | low | Keep; includes safety caveat. |
| `/menu-digital-restaurant-montreal` | Local Montréal page | self | none | yes | medium | Keep as broad local page; do not split neighborhoods yet. |
| `/menu-digital-restaurant-laval` | Local Laval page | self | none | yes | medium | Keep; no false local office claim. |
| `/menu-digital-restaurant-brossard` | Local Brossard page | self | none | yes | medium | Keep; no false local office claim. |
| `/menu-digital-restaurant-haut-de-gamme` | Premium vertical | self | none | yes | low | Keep; strongly aligned with product. |
| `/menu-digital-restaurant-gastronomique` | Gastronomic vertical | self | none | yes | medium | Keep; monitor overlap with high-end page. |

## Noindex / Internal Routes

| Route | File / source | Role | Indexable | Canonical | Sitemap | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `/admin` and `/admin/**` | `app/admin/layout.tsx` | legacy restaurateur preview/admin | noindex | self on page | no | medium overlap | Keep noindex; clarify against `/apercu-restaurateur` in future cleanup. |
| `/owner/**` | `app/owner/layout.tsx` | owner cockpit | noindex | none/self by route | no | low | Keep protected/noindex. |
| `/sign-in/**` | `app/sign-in/[[...sign-in]]/page.tsx` | auth | noindex | none | no | low | Keep disallowed. |
| `/todos` | `app/todos/page.tsx` | Supabase starter todos | noindex | self | no | obsolete | Candidate for separate deletion after confirming no runtime dependency. |
| `/q/[token]` | `app/q/[token]/page.tsx` | QR token redirect/landing | noindex | none | no | low | Keep noindex. |
| `/legacy/[...slug]` | `app/legacy/[...slug]/page.tsx` | old archived surfaces | noindex | legacy path | no | low | Keep noindex and unlinked. |
| `/menu/[slug]` | `app/menu/[slug]/page.tsx` | dynamic restaurant menu | noindex | none | no | strategic | Keep noindex for now until public menu SEO is explicitly scoped. |
| `/menu/[slug]/dishes/[dishSlug]` | `app/menu/[slug]/dishes/[dishSlug]/page.tsx` | dynamic dish detail | noindex | none | no | strategic | Keep noindex for now. |
| `/demo/dishes/[slug]` | `app/demo/dishes/[slug]/page.tsx` | sample dish detail | noindex | self | no | low | Keep noindex; avoid sitemap dish detail bloat. |
| `/en/vistaire-menu/dishes/[slug]` | `app/en/vistaire-menu/dishes/[slug]/page.tsx` | EN sample dish detail | noindex | self | no | low | Keep noindex. |
| `/vistaire-preview/**` | `app/vistaire-preview/**` | internal preview surfaces | noindex | preview path | no | low | Keep disallowed and out of sitemap. |
| `/dev/**` | `app/dev/**` | review/dev pages | robots disallow | none | no | medium | Consider adding route-level noindex in future if pages remain public. |
| `/api/**` | `app/api/**/route.ts` | API routes | not pages | none | no | low | Keep robots-disallowed. |

## Obsolete / Cleanup Candidates

- `/todos`: likely Supabase starter code. Evidence: only route page queries `supabase.from("todos")`; robots disallow already covers it. Not deleted in this PR to avoid mixing cleanup behavior with SEO page publication.
- `PUBLIC_SEO_SITEMAP_ENTRIES` and `PUBLIC_PRODUCT_SITEMAP_ENTRIES` in `lib/seo.ts`: stale constants not used by `buildSitemapEntries()`. Leave for a focused cleanup to avoid incidental API churn.
- Public "demo" wording: route names remain for stability. Visible copy should continue moving toward "carte", "exemple", "aperçu", and "expérience client" when touched.
- Neighborhood local pages: Vieux-Montréal, Griffintown, Plateau, Westmount, Outremont and Saint-Laurent remain planned, not published, to avoid doorway risk.

## Strategy Loopholes Checked

| Loophole | Fix in this branch |
|---|---|
| Doorway pages by city/neighborhood | Published only Montréal, Laval and Brossard with distinct context; kept neighborhoods planned. |
| Broken hreflang for FR-only pages | New batch uses self-canonical only; no EN alternates emitted. |
| Unsupported local presence | Local pages use area-served language and do not claim offices, reviews or clients. |
| Universal 3D/AR claim | Copy repeats selective 3D/AR and fallback language. |
| Heavy asset creep | New pages reuse existing optimized demo images only; no new media files. |
| Noindex in sitemap | New pages are indexable; internal/noindex routes stay out of sitemap. |
| Thin AI-generated duplication | Each published page has distinct direct answer, context, comparison, FAQ and internal links. |
| Commercial FAQ schema risk | FAQPage mirrors visible FAQ; no ratings/reviews/awards invented. |
