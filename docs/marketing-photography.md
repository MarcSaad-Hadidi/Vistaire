# Vistaire public marketing photography

Integrated on 2026-10-10 as a continuation of PR #296 on `feat/immersive-public-vistaire`, from `29ab245b`.

## Result

- 29 active legacy image paths replaced across 48 French/English public route instances
- 14 photographic masters plus 4 useful derivatives: 3 small restaurant thumbnails and 1 portrait crop
- 18 genuine WebP runtime files, 2,988,638 bytes in total; no raw generation output is shipped
- Two phone-led scenes per restaurant, one room per restaurant, a Trouvable drink and four Sauge Noire-branded product scenes
- No real menu data, genuine dish media, videos, frames, 3D/AR pipelines, models, owner/admin or authentication changes

The complete route, slot, old/new path, source screenshot/model hash, compositing transform and output checksum inventory is [`marketing-photography.json`](marketing-photography.json).

## Fidelity method

Room and lifestyle settings are generated art-directed scenes, not documentary photographs of real premises. The final phone display pixels come from fresh live captures at `https://www.vistaire.ca` on 2026-10-10, after the corresponding real menu routes were inspected. The workflow generates a blank-screen photographic scene, then perspective-composites an aspect-preserved crop of the actual captured UI into the phone. It never asks the image generator to recreate menu text.

Maison Élyse uses the real soufflé and lobster detail pages; Trouvable uses its live list and PDF-style comparison panel; Sauge Noire uses its real botanical cover and Chocolat fumé detail page. The PDF side is the live site’s representation of real Trouvable data, not a claim that a restaurant uploaded that PDF. Sauge Noire’s fixed-height captured book is fitted intact with black screen margins rather than stretched.

Physical displays use transparent-background Blender renders of the four GLBs referenced by `components/immersive/SupportModels.js`. Disposable decompressed references were compared with the originals for geometry arrays, texture bytes, material bindings/factors and node transforms. Original GLBs remain unchanged. Final compositing uses uniform scaling/translation and separate contact shadows; only the small nighttime room/QR inserts receive a light RGB grade. Shape, proportions, base, artwork and silhouette remain source-faithful.

All current source fronts carry Sauge Noire artwork, intentionally retained for these photographs. The user permits restaurant-matched text/logo changes in photos when the same physical geometry is retained; retaining this source branding is a production choice. The Acrylique GLB material is `OPAQUE`, so touched alt text and pricing copy no longer claim a transparent face. Its product name is retained. Embedded QR artwork is preserved, but scanning a QR from the marketing photograph has not been verified.

## Runtime assets

| Master | Restaurant | Runtime file | Dimensions | Bytes |
| --- | --- | --- | --- | ---: |
| A-M | maison-elyse | `/images/marketing/maison-elyse-dining-room.webp` | 1672 × 941 | 214,494 |
| A-T | trouvable | `/images/marketing/trouvable-dining-room.webp` | 1672 × 941 | 197,432 |
| A-S | sauge-noire | `/images/marketing/sauge-noire-dining-room.webp` | 1672 × 941 | 218,478 |
| M1 | maison-elyse | `/images/marketing/maison-elyse-souffle-phone.webp` | 1448 × 1086 | 261,516 |
| M2 | maison-elyse | `/images/marketing/maison-elyse-homard-phone.webp` | 1364 × 1023 | 224,286 |
| T1 | trouvable | `/images/marketing/trouvable-guest-menu.webp` | 1448 × 1086 | 187,374 |
| T2 | trouvable | `/images/marketing/trouvable-pdf-digital.webp` | 1448 × 1086 | 318,852 |
| S1 | sauge-noire | `/images/marketing/sauge-noire-qr-menu.webp` | 1448 × 1086 | 161,334 |
| S2 | sauge-noire | `/images/marketing/sauge-noire-dessert-phone.webp` | 1448 × 1086 | 212,788 |
| B1 | trouvable | `/images/marketing/restaurant-signature-drink.webp` | 1448 × 1086 | 174,532 |
| P-A | sauge-noire | `/images/marketing/sauge-noire-acrylique.webp` | 1254 × 1254 | 149,930 |
| P-S | sauge-noire | `/images/marketing/sauge-noire-sculpte.webp` | 1254 × 1254 | 180,756 |
| P-C | sauge-noire | `/images/marketing/sauge-noire-carre.webp` | 1254 × 1254 | 172,766 |
| P-G | sauge-noire | `/images/marketing/sauge-noire-signature.webp` | 1254 × 1254 | 141,860 |

Derivatives:

- `/images/marketing/maison-elyse-dining-room-thumb.webp`: 480 × 270, 29,628 bytes, HOME:testimonies
- `/images/marketing/trouvable-dining-room-thumb.webp`: 480 × 270, 28,824 bytes, HOME:testimonies
- `/images/marketing/sauge-noire-dining-room-thumb.webp`: 480 × 270, 30,696 bytes, HOME:testimonies
- `/images/marketing/sauge-noire-qr-menu-portrait.webp`: 800 × 960, 83,092 bytes, ABOUT:hero

Master distribution: Maison Élyse 3, Trouvable 4, Sauge Noire 7. The Sauge total includes all four physical collection photos; the six phone scenes are evenly split 2/2/2.

## Actual replacement mapping

| Previous active image | New runtime image | Public slots |
| --- | --- | --- |
| `Framer/PageDigital.png` | `/images/marketing/maison-elyse-souffle-phone.webp` | DIGITAL:hero, AR:premium, GUIDE-A:hero, G1:premium, G2:hero, G3:premium, G5:proof, G7:hero, G9:proof |
| `Framer/PhotoDigital2.png` | `/images/marketing/sauge-noire-dessert-phone.webp` | DIGITAL:premium, AR:hero, GUIDE-3:hero, G2:premium |
| `Framer/PhotoDigital3.png` | `/images/marketing/trouvable-guest-menu.webp` | DIGITAL:proof, AR:proof, G2:proof, G4:premium, G8:proof |
| `Framer/PhotoQRcode1.png` | `/images/marketing/sauge-noire-qr-menu.webp` | QR:hero, GUIDE-Q:hero, G1:hero, G10:proof |
| `Framer/PhotoQRcode2.png` | `/images/marketing/sauge-noire-dessert-phone.webp` | QR:proof, G1:proof |
| `Framer/PhotoComparaisonPDF.png` | `/images/marketing/trouvable-pdf-digital.webp` | PDF:hero, G3:hero, G4:proof |
| `Framer/PhotoPDFvsDigitalDetail.png` | `/images/marketing/maison-elyse-homard-phone.webp` | PDF:detail, G3:proof, G4:hero |
| `Framer/PageApropos2.png` | `/images/marketing/sauge-noire-qr-menu-portrait.webp` | ABOUT:hero |
| `Framer/Photo table.png` | `/images/marketing/sauge-noire-dining-room.webp` | ABOUT:closing, BOOK:panel |
| `Framer/PageContact.png` | `/images/marketing/trouvable-dining-room.webp` | CONTACT:hero |
| `Framer/PhotoRestoComplet4.png` | `/images/marketing/sauge-noire-dining-room.webp` | G9:hero, G11:hero |
| `Framer/PhotoRestoComplet6.png` | `/images/marketing/maison-elyse-dining-room.webp` | G8:hero, G10:hero, G12:premium |
| `Framer/PlatHomard.png` | `/images/marketing/maison-elyse-homard-phone.webp` | G5:hero, G11:proof, G12:hero |
| `Framer/Desert.png` | `/images/marketing/maison-elyse-souffle-phone.webp` | G6:premium |
| `Framer/Boisson.png` | `/images/marketing/restaurant-signature-drink.webp` | G11:premium |
| `public/immersive-assets/experience-maison-elyse.webp` | `/images/marketing/maison-elyse-dining-room-thumb.webp` | HOME:testimonies |
| `public/immersive-assets/ambience-maison-elyse.webp` | `/images/marketing/maison-elyse-dining-room.webp` | HOME:social-content |
| `public/immersive-assets/experience-trouvable.webp` | `/images/marketing/trouvable-dining-room-thumb.webp` | HOME:testimonies |
| `public/immersive-assets/ambience-trouvable.webp` | `/images/marketing/trouvable-dining-room.webp` | HOME:social-content |
| `public/immersive-assets/experience-sauge-noire.webp` | `/images/marketing/sauge-noire-dining-room-thumb.webp` | HOME:testimonies |
| `public/immersive-assets/ambience-sauge-noire.webp` | `/images/marketing/sauge-noire-dining-room.webp` | HOME:social-content |
| `public/immersive-assets/support-acrylique.webp` | `/images/marketing/sauge-noire-acrylique.webp` | HOME:pricing, HOME:collection-modal |
| `public/images/pricing/vistaire-acrylique.jpg` | `/images/marketing/sauge-noire-acrylique.webp` | PRICING:collection, PRICING:social-metadata |
| `public/immersive-assets/support-sculpte.webp` | `/images/marketing/sauge-noire-sculpte.webp` | HOME:pricing, HOME:collection-modal |
| `public/images/pricing/vistaire-sculpte.jpg` | `/images/marketing/sauge-noire-sculpte.webp` | PRICING:collection |
| `public/immersive-assets/support-carre.webp` | `/images/marketing/sauge-noire-carre.webp` | HOME:pricing, HOME:collection-modal |
| `public/images/pricing/vistaire-carre.png` | `/images/marketing/sauge-noire-carre.webp` | PRICING:collection |
| `public/immersive-assets/support-signature.webp` | `/images/marketing/sauge-noire-signature.webp` | HOME:pricing, HOME:collection-modal |
| `public/images/pricing/vistaire-signature.jpg` | `/images/marketing/sauge-noire-signature.webp` | PRICING:collection |

Route key and full bilingual route URLs are in the JSON inventory. Every legacy file is retained; only the active consumers moved. Unused guide background fields and inactive `DemoPhoneShowcase` imports are intentionally unchanged.

## Frontend changes

- `components/immersive/App.jsx`, `content.js`: canonical room/product URLs; small thumbnails for the 70–160 px identity slots; truthful room descriptions
- `components/immersive/Pricing.jsx`, `locale.jsx`: canonical product URLs and matching French/English Acrylique copy
- `lib/pricingPage.ts`: shared canonical products, centered crops, accurate image descriptions in both languages
- Both pricing route pages: OpenGraph/Twitter image uses the new genuine WebP path
- `components/vistaire-preview/Vistaire{MenuDigitalRestaurant,Menu3dArRestaurant,MenuQrCodeRestaurant,PdfVsMenuDigital,About,Contact,RendezVous}Preview.tsx`: verified master imports and factual localized alt text; About uses the safe portrait derivative
- `components/seo/SeoGeoAeoPage.tsx`: all twelve GEO/AEO visual sets use the new masters; changed marketing photos have explicit English alt text and no fabricated city/AR state claims
- `components/guides/editorialGuidePresentation.ts`: three guide hero images and localized descriptions
- `tests/tarifs-carte-vistaire-public.test.mjs`, `e2e/pricing-page.spec.ts`: existing image-path expectations follow the new format/path

## Crop and loading choices

Existing layout ratios, Next Image sizing/quality and eager/lazy intent are preserved. Product silhouettes fit within the central 16:9 band of their 1254 × 1254 masters with at least 27 px vertical margin. Legacy off-center pricing crops are reset to 50% 50%. The About portrait preserves both the phone and stand; the other phone slots retain their 4:3 master. Home identity thumbnails are 480 px wide WebPs (about 29–31 KB each) instead of full room downloads. No dependency or custom runtime image pipeline was added.

## Verification and remaining limits

- All 18 output files decode as WebP; dimensions and checksums are in the manifest
- Visual inspection covered the final phone/room photographs, product contact sheet and complete product crop bounds
- Integration checks observed passing after all final files were copied: `npm run assets:check`, `npm run lfs:check`, `npm run lint`, `npm run typecheck` and 43 existing focused node tests (0 failures, 0 skips)
- Exact focused test command: `node --test tests/tarifs-carte-vistaire-public.test.mjs tests/seo-public-content.test.mjs tests/seo-interactive-showcases.test.mjs tests/prompt5-editorial-guides.test.mjs tests/seo-geo-pages.test.mjs tests/landing-i18n.test.mjs tests/immersive-loading-locale.test.mjs tests/pricing-table-estimator.test.mjs`
- Additional static verification passed: all 18 output hashes match, all 29 replacement mapping targets and every static marketing import exist; `git diff --check` is clean
- Build and runtime/browser verification belong to the coordinating task and are not asserted as passed by this document
- Source UI capture used real narrow responsive layouts, with a native 500 × 828 browser viewport; it is not proof of exact 390/430 px frontend QA
- Native iPhone/Android AR, physical QR scanning, actual venue resemblance and manufactured product dimensions are not verified by these photographs

Raw scenes, source renders/screenshots, prompts, compositing scripts and review contact sheets stay outside Git. Only useful optimized runtime outputs and this provenance/mapping are added. No merge is performed.
