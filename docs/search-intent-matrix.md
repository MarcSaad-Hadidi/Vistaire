# Vistaire Search Intent Matrix

Last updated: 2026-06-22
Source of truth for published routes: `lib/seoGeoPages.ts`
Status: editorial hypothesis until validated by Search Console, Keyword Planner, Google Ads Search Terms/conversions, or qualified customer interviews/leads.

## Measurement Caveat

No monthly search volume, conversion rate, or query-level demand is known from this repository alone. The natural queries below are editorial hypotheses written from product positioning and likely restaurant buyer language. They must not be presented as validated volume or proven demand until an external validation source is attached with a validation date.

Use these fields consistently:

| Field | Meaning |
|---|---|
| Editorial hypothesis | A plausible query family or buyer problem inferred from Vistaire positioning and page copy. |
| Estimated commercial intent | A qualitative estimate only: very high, high, medium, or low. This is not measured conversion data. |
| Validated data | Search Console, Keyword Planner, Ads Search Terms/conversions, interviews, or lead-source evidence. |
| Validation source | The export, report, interview note, CRM/lead field, or ad account source used to validate the hypothesis. |
| Status | `unverified`, `partially validated`, or `validated`. Default is `unverified`. |

## Published Bilingual Foundation

PR #102 leaves the SEO/GEO foundation published in both languages: 12 FR routes and 12 EN routes. The English pages are live counterparts, not a later expansion plan. This follow-up publishes no additional wave.

| Cluster | Natural queries | Estimated commercial intent | FR target | EN target | Type | Editorial hypothesis / angle | Duplication risk | Priority | Validated data | Validation source | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| QR code | menu avec QR code; menu QR code restaurant; creer un menu QR code restaurant | very high | `/menu-qr-code-restaurant` | `/en/qr-code-restaurant-menu` | existing pillar | General QR intent and value after scan. | low | P0 | none known | not yet exported | unverified |
| QR code without PDF | menu QR code sans PDF; QR code menu digital restaurant; QR menu without PDF | very high | `/menu-qr-sans-pdf` | `/en/qr-menu-without-pdf` | published SEO/GEO | Problem page for QR codes that open static PDFs. | low | P0 | none known | not yet exported | unverified |
| Digital menu | menu digital restaurant; menu numerique restaurant; carte digitale restaurant; digital restaurant menu | high | `/menu-digital-restaurant` | `/en/digital-restaurant-menu` | existing pillar | Definition and premium product value. | low | P0 | none known | not yet exported | unverified |
| Without app | menu digital sans application; menu mobile restaurant; restaurant menu without app | high | `/menu-digital-sans-application` | `/en/digital-menu-without-app` | published SEO/GEO | No app install, browser-based table reading. | low | P0 | none known | not yet exported | unverified |
| PDF replacement | remplacer menu PDF restaurant; transformer menu PDF en menu digital; replace restaurant PDF menu | very high | `/remplacer-menu-pdf-restaurant` | `/en/replace-restaurant-pdf-menu` | published SEO/GEO | Migration from static PDF to structured mobile card. | medium | P0 | none known | not yet exported | unverified |
| PDF alternative | alternative menu PDF restaurant; menu PDF pas pratique restaurant; restaurant PDF menu alternative | high | `/alternative-menu-pdf-restaurant` | `/en/restaurant-pdf-menu-alternative` | published SEO/GEO | Honest comparison of alternatives without unsupported "best" claims. | medium | P0 | none known | not yet exported | unverified |
| Dish pages | fiche plat digitale restaurant; menu restaurant avec fiches plats; digital dish page restaurant | high | `/fiche-plat-digitale-restaurant` | `/en/digital-dish-page-restaurant` | published SEO/GEO | Feature page for dish-level storytelling and details. | low | P0 | none known | not yet exported | unverified |
| Photos | menu restaurant avec photos; menu restaurant avec photos et prix; restaurant menu photos | high | `/menu-restaurant-photos` | `/en/restaurant-menu-photos` | published SEO/GEO | Selective food-first photography and fallback handling. | low | P1 | none known | not yet exported | unverified |
| Allergens | menu restaurant avec allergenes; allergenes menu QR code; restaurant menu allergens | high | `/menu-restaurant-allergenes` | `/en/restaurant-menu-allergens` | published SEO/GEO | Clear allergen display with safety caveat. | low | P1 | none known | not yet exported | unverified |
| 3D / AR | menu 3D restaurant; plat 3D restaurant; menu AR restaurant; 3D restaurant menu | high | `/menu-3d-ar-restaurant` | `/en/3d-ar-restaurant-menu` | existing pillar | Selective 3D/AR with no universal support promise. | low | P0 | none known | not yet exported | unverified |
| Local Montreal | menu digital restaurant Montreal; menu QR code restaurant Montreal; digital restaurant menu Montreal | very high | `/menu-digital-restaurant-montreal` | `/en/digital-restaurant-menu-montreal` | published SEO/GEO | Broad Montreal page covers neighborhoods until unique pages are justified. | low | P0 | none known | not yet exported | unverified |
| Local Laval | menu digital restaurant Laval; menu QR code restaurant Laval; digital restaurant menu Laval | high | `/menu-digital-restaurant-laval` | `/en/digital-restaurant-menu-laval` | published SEO/GEO | Rive-Nord/group dining context without false office claims. | medium | P1 | none known | not yet exported | unverified |
| Local Brossard | menu digital restaurant Brossard; carte digitale restaurant Brossard; digital restaurant menu Brossard | high | `/menu-digital-restaurant-brossard` | `/en/digital-restaurant-menu-brossard` | published SEO/GEO | Rive-Sud/destination restaurant context without false office claims. | medium | P1 | none known | not yet exported | unverified |
| Premium | menu digital restaurant haut de gamme; menu interactif restaurant premium; high-end restaurant digital menu | very high | `/menu-digital-restaurant-haut-de-gamme` | `/en/high-end-restaurant-digital-menu` | published SEO/GEO | Premium restaurant experience, not generic SaaS. | low | P0 | none known | not yet exported | unverified |
| Fine dining | menu digital restaurant gastronomique; carte digitale restaurant gastronomique; fine dining restaurant digital menu | high | `/menu-digital-restaurant-gastronomique` | `/en/fine-dining-restaurant-digital-menu` | published SEO/GEO | Precision, restraint, and signature dish context. | medium | P1 | none known | not yet exported | unverified |

## Planned But Not Published

These pages remain intentionally unpublished because they need stronger unique content and validation to avoid doorway or thin vertical pages.

| Planned route | Why it is held back | Validation needed before publishing |
|---|---|---|
| `/menu-digital-restaurant-vieux-montreal` | Covered by Montreal until Vieux-Montreal has unique restaurant context and proof. | Search Console/Keyword Planner query split, qualified local leads, or customer interviews. |
| `/menu-digital-restaurant-griffintown` | Risk of swapping only neighborhood name; needs distinct destination dining angle. | Same as above, plus unique examples. |
| `/menu-digital-restaurant-plateau` | Needs real Plateau-specific bistro/cafe premium content. | Local query evidence and distinct page outline. |
| `/menu-digital-restaurant-westmount` | Needs distinct Westmount premium restaurant angle. | Local query evidence and distinct page outline. |
| `/menu-digital-restaurant-outremont` | Needs unique local culinary context. | Local query evidence and distinct page outline. |
| `/menu-digital-restaurant-saint-laurent` | Needs unique content beyond service area. | Local query evidence and distinct page outline. |
| `/menu-digital-restaurant-italien` | Needs pasta/pizza/wine/allergen-specific content. | Cuisine query evidence and examples from product discovery. |
| `/menu-digital-restaurant-japonais` | Needs omakase/sushi distinction and unique visual logic. | Cuisine query evidence and separation from sushi intent. |
| `/menu-digital-restaurant-sushi` | Must be differentiated from Japanese page before publishing. | Specific sushi/rolls/omakase query evidence and content plan. |
| `/menu-digital-restaurant-libanais` | Needs mezze, sharing, allergen, and group menu specificity. | Cuisine query evidence and examples from leads/interviews. |
| `/menu-digital-restaurant-mediterraneen` | Must avoid overlap with Italian and Lebanese. | Cuisine query evidence and distinct Mediterranean positioning. |
| `/menu-digital-steakhouse` | Strong candidate, but needs cuisson/cuts/pairings/photo strategy. | Steakhouse query evidence, buyer examples, and distinct page outline. |

## Internal Linking Rules

- Every published SEO/GEO page should link back to relevant core pages: `/menu-digital-restaurant`, `/menu-qr-code-restaurant`, `/menu-pdf-vs-menu-digital`, `/tarifs-menu-digital-restaurant`, `/demo`, or `/prendre-rendez-vous`.
- EN pages should link to EN equivalents where available.
- The SEO footer may link to priority pages to avoid orphaning, but should not link to planned unpublished routes.
- No new wave is being published from this matrix without validation and a separate implementation scope.

## Future Query Validation Plan

Create one row per query, locale, country/region filter, and landing page. Keep FR and EN grouped separately before comparing blended demand.

Expected exports and columns:

| Source | Required columns | Filters / notes |
|---|---|---|
| Google Search Console performance export | query, page, country, device, search type, date range, impressions, clicks, CTR, average position | Filter country to Canada first; segment Quebec when available through page/query patterns or reporting layer. Group FR and EN queries separately. |
| Google Keyword Planner | keyword, language, location, avg monthly searches, competition, top of page bid low, top of page bid high, three-month change, year-over-year change | Use French Canada and English Canada language/location groupings. Keep exact export date. |
| Google Ads Search Terms | search term, campaign, ad group, keyword, match type, clicks, impressions, CTR, cost, conversions, conversion value, landing page, date range | Use Canada/Quebec campaign filters where configured. Separate converted from non-converted terms. |
| CRM / lead intake | lead date, source, landing page, language, restaurant city, restaurant type, stated problem, deal stage, revenue or plan if known | Do not overfit a page from one anecdote; use to validate language and commercial pain. |
| Customer interviews | interview date, participant role, restaurant type, city, language, menu format today, phrases used, buying trigger, objections | Store anonymized notes; map phrases to query clusters after the interview. |

Minimum validation fields to add back to this matrix:

| Field | Requirement |
|---|---|
| Validation date | Date the export/interview evidence was reviewed. |
| Locale group | FR or EN. |
| Geography | Canada, Quebec, Montreal area, Laval, Brossard, or other explicit filter. |
| Impressions | Search Console impressions for the query/page pair. |
| Clicks | Search Console clicks for the query/page pair. |
| CTR | Search Console CTR for the query/page pair. |
| Position | Search Console average position for the query/page pair. |
| Keyword Planner volume | Avg monthly searches when available; leave blank if not exported. |
| Ads conversion signal | Conversions/search terms when available; leave blank if no Ads data exists. |
| Lead/interview signal | Short reference to a lead source or interview note, not invented demand. |

Decision rule:

- Keep a published page when it has distinct intent, acceptable cannibalization risk, and either early performance data or strong product-strategy value.
- Rewrite or consolidate when Search Console shows overlapping query/page pairs with no distinct clicks, CTR, or position pattern.
- Publish a planned page only after a separate PR defines unique content, route pairing, internal links, and validation evidence.
