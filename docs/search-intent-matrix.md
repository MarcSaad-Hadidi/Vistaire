# Vistaire Search Intent Matrix

Last updated: 2026-06-21  
Source of truth: `lib/seoGeoPages.ts`

## Published First Wave

| Cluster | Natural queries | Intent | Target | Type | Angle | Duplication risk | Priority |
|---|---|---|---|---|---|---|---|
| QR code | menu avec QR code; menu QR code restaurant; créer un menu QR code restaurant | Very high | `/menu-qr-code-restaurant` | existing pillar | General QR intent and value after scan. | Low | P0 |
| QR code sans PDF | menu QR code sans PDF; QR code menu digital restaurant | Very high | `/menu-qr-sans-pdf` | published | Problem page for QR codes that open PDFs. | Low | P0 |
| Menu digital | menu digital restaurant; menu numérique restaurant; carte digitale restaurant | High | `/menu-digital-restaurant` | existing pillar | Definition and premium product value. | Low | P0 |
| Sans application | menu digital sans application; menu mobile restaurant | High | `/menu-digital-sans-application` | published | No app install, browser-based table reading. | Low | P0 |
| PDF replacement | remplacer menu PDF restaurant; transformer menu PDF en menu digital | Very high | `/remplacer-menu-pdf-restaurant` | published | Migration from static PDF to structured mobile card. | Medium | P0 |
| Alternative PDF | alternative menu PDF restaurant; menu PDF pas pratique restaurant | High | `/alternative-menu-pdf-restaurant` | published | Honest comparison of alternatives without unsupported "best" claims. | Medium | P0 |
| Fiches plats | fiche plat digitale restaurant; menu restaurant avec fiches plats | High | `/fiche-plat-digitale-restaurant` | published | Feature page for dish-level storytelling and details. | Low | P0 |
| Photos | menu restaurant avec photos; menu restaurant avec photos et prix | High | `/menu-restaurant-photos` | published | Selective food-first photography and fallback handling. | Low | P1 |
| Allergènes | menu restaurant avec allergènes; allergènes menu QR code | High | `/menu-restaurant-allergenes` | published | Clear allergen display with safety caveat. | Low | P1 |
| 3D / AR | menu 3D restaurant; plat 3D restaurant; menu AR restaurant | High | `/menu-3d-ar-restaurant` | existing pillar | Selective 3D/AR with no universal support promise. | Low | P0 |
| Local Montréal | menu digital restaurant Montréal; menu QR code restaurant Montréal | Very high | `/menu-digital-restaurant-montreal` | published | Broad Montréal page covers neighborhoods until unique pages are justified. | Low | P0 |
| Local Laval | menu digital restaurant Laval; menu QR code restaurant Laval | High | `/menu-digital-restaurant-laval` | published | Rive-Nord/group dining context without false office claims. | Medium | P1 |
| Local Brossard | menu digital restaurant Brossard; carte digitale restaurant Brossard | High | `/menu-digital-restaurant-brossard` | published | Rive-Sud/destination restaurant context. | Medium | P1 |
| Premium | menu digital restaurant haut de gamme; menu interactif restaurant premium | Very high | `/menu-digital-restaurant-haut-de-gamme` | published | Premium restaurant experience, not generic SaaS. | Low | P0 |
| Gastronomique | menu digital restaurant gastronomique; carte digitale restaurant gastronomique | High | `/menu-digital-restaurant-gastronomique` | published | Precision, restraint and signature dish context. | Medium | P1 |

## Planned But Not Published

These pages remain intentionally unpublished in the first batch because they need stronger unique content to avoid doorway or thin vertical pages.

| Planned route | Why it is held back |
|---|---|
| `/menu-digital-restaurant-vieux-montreal` | Covered by Montréal until Vieux-Montréal has unique restaurant context and proof. |
| `/menu-digital-restaurant-griffintown` | Risk of swapping only neighborhood name; needs distinct destination dining angle. |
| `/menu-digital-restaurant-plateau` | Needs real Plateau-specific bistro/café premium content. |
| `/menu-digital-restaurant-westmount` | Needs distinct Westmount premium restaurant angle. |
| `/menu-digital-restaurant-outremont` | Needs unique local culinary context. |
| `/menu-digital-restaurant-saint-laurent` | Needs unique content beyond service area. |
| `/menu-digital-restaurant-italien` | Needs pasta/pizza/wine/allergen-specific content. |
| `/menu-digital-restaurant-japonais` | Needs omakase/sushi distinction and unique visual logic. |
| `/menu-digital-restaurant-sushi` | Must be differentiated from Japanese page before publishing. |
| `/menu-digital-restaurant-libanais` | Needs mezze/share/allergen/menu group specificity. |
| `/menu-digital-restaurant-mediterraneen` | Must avoid overlap with Italian and Lebanese. |
| `/menu-digital-steakhouse` | Strong candidate, but needs cuisson, cuts, pairings and photo strategy. |

## Internal Linking Rules

- Every new page links back to `/menu-digital-restaurant`, `/menu-qr-code-restaurant`, `/menu-pdf-vs-menu-digital`, `/tarifs-menu-digital-restaurant`, `/demo` or `/prendre-rendez-vous` when relevant.
- The SEO footer links to P0 new pages to avoid orphaning the first wave.
- New FR-only pages do not emit English alternates. English expansion should start with 3 to 5 manually written pages only.

## Next Wave Recommendation

Prioritize `/menu-digital-steakhouse`, `/menu-digital-restaurant-italien`, `/menu-digital-restaurant-japonais`, and one Montréal neighborhood only after collecting enough unique examples, FAQ angles, and internal links. Do not publish the full local list at once.
