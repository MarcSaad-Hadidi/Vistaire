# Vistaire SEO Route Inventory

Last updated: 2026-06-22
Follow-up branch: `codex/pr102-seo-hardening-followup`
Base checked: `origin/main` at `45237aa577a7cf7283c0777b3f8d14e3ce348d77`

## Summary

This inventory describes the intended post-#102 public route state. PR #102 merged the bilingual SEO/GEO foundation: 12 French SEO/GEO pages and 12 English SEO/GEO pages, complete `fr-CA` / `en-CA` / `x-default` alternates through `buildPageAlternates()`, and sitemap entries for both locale paths.

The old `/carte-vistaire` page is no longer an indexable page. It is handled by a permanent Next.js redirect from `/carte-vistaire` to `/demo`, and `/carte-vistaire` must stay out of the sitemap and public internal links.

No new SEO wave is being published in this follow-up. This work only hardens documentation around the already-merged bilingual foundation.

## Public Indexable Product Routes

These routes are indexable, canonicalized to themselves, paired through `BILINGUAL_ROUTE_PAIRS`, and included in the sitemap with absolute language alternates.

| FR route | EN route | File / source | Role | Sitemap | Risk | Recommendation |
|---|---|---|---|---|---|---|
| `/` | `/en` | `app/page.tsx`, `app/en/page.tsx` | Homepage | yes | low | Keep as the main product entry pair. |
| `/demo` | `/en/vistaire-menu` | `app/demo/page.tsx`, `app/en/vistaire-menu/page.tsx` | Public sample card/menu experience | yes | medium naming | Keep for route stability; visible copy should continue to favor card/sample wording. |
| `/tarifs-menu-digital-restaurant` | `/en/pricing-digital-restaurant-menu` | SEO/product pages | Pricing | yes | low | Keep as the commercial pricing pair. |
| `/menu-digital-restaurant` | `/en/digital-restaurant-menu` | SEO pillar pages | Digital menu pillar | yes | low | Keep as the core category pair. |
| `/menu-qr-code-restaurant` | `/en/qr-code-restaurant-menu` | SEO pillar pages | QR menu pillar | yes | low | Keep as the general QR pair. |
| `/menu-3d-ar-restaurant` | `/en/3d-ar-restaurant-menu` | SEO pillar pages | 3D/AR pillar | yes | medium claims | Keep selective 3D/AR and fallback language. |
| `/menu-pdf-vs-menu-digital` | `/en/pdf-vs-digital-menu` | SEO pillar pages | PDF comparison | yes | low | Keep as the comparison pair. |
| `/a-propos` | `/en/about` | product pages | About | yes | low | Keep as a trust/support pair. |
| `/contact` | `/en/contact` | product pages | Contact | yes | low | Keep as a conversion/support pair. |
| `/prendre-rendez-vous` | `/en/book-a-call` | product pages | Appointment CTA | yes | low | Keep as the primary booking pair. |
| `/apercu-restaurateur` | `/en/restaurant-preview` | product pages | Restaurateur preview | yes | low | Keep indexable unless product strategy changes. |

## Public Indexable SEO/GEO Routes

PR #102 publishes the SEO/GEO batch in both languages. French pages are served by `app/(geo)/[slug]/page.tsx`; English pages are served by `app/en/(geo)/[slug]/page.tsx`. Both use `lib/seoGeoPages.ts`, share JSON-LD generation through `lib/seoGeoJsonLd.ts`, and are paired through `SEO_GEO_ROUTE_PAIRS`.

| FR route | EN route | Role | Hreflang | Sitemap | Risk | Recommendation |
|---|---|---|---|---|---|---|
| `/menu-qr-sans-pdf` | `/en/qr-menu-without-pdf` | QR/PDF problem page | complete pair | yes | low | Keep distinct from the general QR pillar by focusing on PDF replacement pain. |
| `/menu-digital-sans-application` | `/en/digital-menu-without-app` | No-app mobile menu page | complete pair | yes | low | Keep focused on browser-based table reading without app install. |
| `/remplacer-menu-pdf-restaurant` | `/en/replace-restaurant-pdf-menu` | PDF replacement page | complete pair | yes | medium | Monitor overlap with the PDF alternative and PDF comparison pages. |
| `/alternative-menu-pdf-restaurant` | `/en/restaurant-pdf-menu-alternative` | PDF alternative page | complete pair | yes | medium | Keep comparison language honest; avoid unsupported "best" claims. |
| `/fiche-plat-digitale-restaurant` | `/en/digital-dish-page-restaurant` | Dish detail feature page | complete pair | yes | low | Keep high product relevance around dish storytelling. |
| `/menu-restaurant-photos` | `/en/restaurant-menu-photos` | Photos feature page | complete pair | yes | low | Keep selective, food-first photo language without adding media. |
| `/menu-restaurant-allergenes` | `/en/restaurant-menu-allergens` | Allergen feature page | complete pair | yes | low | Keep the safety caveat and restaurant validation framing. |
| `/menu-digital-restaurant-montreal` | `/en/digital-restaurant-menu-montreal` | Montreal local page | complete pair | yes | medium | Keep as the broad local page; do not split neighborhoods yet. |
| `/menu-digital-restaurant-laval` | `/en/digital-restaurant-menu-laval` | Laval local page | complete pair | yes | medium | Keep area-served language; do not imply a local office. |
| `/menu-digital-restaurant-brossard` | `/en/digital-restaurant-menu-brossard` | Brossard local page | complete pair | yes | medium | Keep area-served language; monitor similarity with Laval. |
| `/menu-digital-restaurant-haut-de-gamme` | `/en/high-end-restaurant-digital-menu` | Premium restaurant vertical | complete pair | yes | low | Keep aligned with Vistaire's premium restaurant positioning. |
| `/menu-digital-restaurant-gastronomique` | `/en/fine-dining-restaurant-digital-menu` | Fine dining vertical | complete pair | yes | medium | Monitor overlap with the high-end page. |

## Hreflang And Sitemap Notes

- `BILINGUAL_ROUTE_PAIRS` includes the base product pairs and spreads `SEO_GEO_ROUTE_PAIRS`.
- `buildPageAlternates()` emits a self canonical plus `fr-CA`, `en-CA`, and `x-default` language alternates for every paired route.
- `buildSitemapEntries()` adds both FR and EN paths for every bilingual pair with absolute alternates.
- SEO/GEO routes enter the sitemap through `BILINGUAL_ROUTE_PAIRS`, which already spreads `SEO_GEO_ROUTE_PAIRS`; there is no separate FR-only sitemap pass in this follow-up.
- `/carte-vistaire` is intentionally absent from the sitemap and redirects permanently to `/demo`.

## Noindex / Internal Routes

These routes should stay out of the sitemap and public SEO linking. Several are useful product surfaces, but they are not part of the indexable SEO/GEO footprint.

| Route | File / source | Role | Indexable | Sitemap | Risk | Recommendation |
|---|---|---|---|---|---|---|
| `/admin` and `/admin/**` | `app/admin/layout.tsx` | legacy restaurateur preview/admin | noindex | no | medium overlap | Keep noindex; clarify against `/apercu-restaurateur` in a focused cleanup if needed. |
| `/owner/**` | `app/owner/layout.tsx` | owner cockpit | noindex | no | low | Keep protected/noindex. |
| `/sign-in/**` | `app/sign-in/[[...sign-in]]/page.tsx` | auth | noindex | no | low | Keep disallowed. |
| `/todos` | `app/todos/page.tsx` | Supabase starter todos | noindex | no | obsolete | Candidate for separate deletion only after confirming no smoke checks still reference it. |
| `/q/[token]` | `app/q/[token]/page.tsx` | QR token redirect/landing | noindex | no | low | Keep noindex. |
| `/legacy/[...slug]` | `app/legacy/[...slug]/page.tsx` | archived legacy surfaces | noindex | no | low | Keep noindex and unlinked. |
| `/menu/[slug]` | `app/menu/[slug]/page.tsx` | dynamic restaurant menu | noindex | no | strategic | Keep noindex until public menu SEO is explicitly scoped. |
| `/menu/[slug]/dishes/[dishSlug]` | `app/menu/[slug]/dishes/[dishSlug]/page.tsx` | dynamic dish detail | noindex | no | strategic | Keep noindex until dish SEO has a separate strategy. |
| `/api/**` | `app/api/**/route.ts` | API routes | not pages | no | low | Keep robots-disallowed. |

## Redirected Old Routes

| Old route | Current behavior | Destination | Sitemap | Recommendation |
|---|---|---|---|---|
| `/carte-vistaire` | permanent redirect in `next.config.ts` | `/demo` | no | Keep the redirect for backwards compatibility; do not recreate the old page. |

## Cannibalization Risks To Monitor

| Cluster | Routes | Risk | Monitoring note |
|---|---|---|---|
| PDF migration | `/menu-pdf-vs-menu-digital`, `/remplacer-menu-pdf-restaurant`, `/alternative-menu-pdf-restaurant`, and EN equivalents | medium | Keep the comparison pillar broad, the replacement page migration-focused, and the alternative page decision-focused. |
| Local service pages | Montreal, Laval, Brossard pairs | medium | Watch queries that collapse to a single local modifier; avoid publishing neighborhood pages until unique demand/content exists. |
| Premium positioning | high-end and fine-dining pairs | medium | Keep high-end about brand/experience quality and fine dining about precision/signature dish context. |
| QR menu pages | general QR pillar plus QR-without-PDF pair | low | Keep the problem page centered on QR codes that open PDFs. |

## Planned But Unpublished Pages

These routes remain planned only. They are not being published in this follow-up, are not linked as live pages, and should not appear in the sitemap until unique content and validation justify them.

| Planned route | Why it is held back |
|---|---|
| `/menu-digital-restaurant-vieux-montreal` | Covered by the Montreal page until there is distinct local context and proof. |
| `/menu-digital-restaurant-griffintown` | Doorway risk if only the neighborhood name changes. |
| `/menu-digital-restaurant-plateau` | Needs real Plateau-specific bistro/cafe premium content. |
| `/menu-digital-restaurant-westmount` | Needs a distinct Westmount premium restaurant angle. |
| `/menu-digital-restaurant-outremont` | Needs unique local culinary context. |
| `/menu-digital-restaurant-saint-laurent` | Needs specific content beyond service-area wording. |
| `/menu-digital-restaurant-italien` | Needs pasta, pizza, wine, and allergen-specific content. |
| `/menu-digital-restaurant-japonais` | Needs omakase/sushi distinction and unique visual logic. |
| `/menu-digital-restaurant-sushi` | Must be differentiated from the Japanese page before publishing. |
| `/menu-digital-restaurant-libanais` | Needs mezze, sharing, allergen, and group menu specificity. |
| `/menu-digital-restaurant-mediterraneen` | Must avoid overlap with Italian and Lebanese pages. |
| `/menu-digital-steakhouse` | Strong candidate, but needs cooking temperature, cuts, pairings, and photo strategy. |

## Strategy Loopholes Checked

| Loophole | Current guardrail |
|---|---|
| Doorway pages by city/neighborhood | Only Montreal, Laval, and Brossard are live; neighborhoods remain planned. |
| Broken alternates | Live SEO/GEO pages have FR/EN route pairs through `SEO_GEO_ROUTE_PAIRS`. |
| Unsupported local presence | Local pages use area-served language and do not claim offices, reviews, or clients. |
| Universal 3D/AR claim | Copy should keep selective 3D/AR and fallback language. |
| Heavy asset creep | No new media is part of this follow-up; docs only. |
| Noindex in sitemap | Internal/noindex routes stay out of sitemap. |
| Thin duplication | Distinct page angles are documented above; future pages remain held back. |
| Commercial FAQ schema risk | FAQPage should mirror visible FAQ and avoid invented ratings, reviews, or awards. |
