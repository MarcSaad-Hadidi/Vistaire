# Vistaire public marketing photography

Updated on 2026-10-10 during PR #296, after the user required a unique photograph per placement and section-specific visual meaning.

## Result

- **67 logical in-page placements, 67 unique photos and 67 unique file hashes** across 24 FR/EN route pairs
- **50 new optimized WebP scenes**, 9,664,862 bytes total; 16 existing distinct photos retained and one duplicated dish placement switched to an unused genuine dish photo
- FR/EN versions of the same placement share a photograph, as requested
- Four removed home collection-modal placements stay removed. The new front-left product views now illustrate the four dedicated pricing-page cards
- No raw image generations, screenshot sources, Blender renders, review sheets or processing scripts are shipped

The complete slot → route → image mapping, source hashes, screenshot crops/quads, exact-model references, prompts, localized descriptions and semantic rationale are in [marketing-photography.json](marketing-photography.json). Runtime consumers use `lib/seoMarketingImages.ts`.

## Semantic audit

All 67 remaining placements were matched to their real section heading and claim. Nine assignments were strengthened before integration:

- Allergen hero and proof: matching physical dish beside its real scrolled allergen declarations, with the restaurant caution retained
- Photo-in-menu proof: actual menu image cards, rather than an isolated plate photograph
- 3D hero and decision guide: actual dish-page controls exposing the optional 3D entry point
- AR proof: an actual dish detail page instead of a general menu list
- PDF alternative proof: the food-first dish page rather than a generic comparison
- Brossard proof: visible real menu categories alongside the exact Signature stand
- Gastronomy included-features image: real menu phone in the room, rather than an empty room

Room-only scenes remain where restaurant atmosphere or brand identity is the subject. They are illustrative settings and make no documentary venue/city claim. The same-page social-metadata image is allowed to match its page; metadata is not another in-page placement.

## Fidelity and uniqueness

Each new photo has its own generated setting/composition. Different crops, encodings, filenames or localized routes never count as new photographs. Home identity thumbnails are three distinct new scenes, not derivatives of the home room backdrops. Pricing uses eight distinct scenes; four front-left views were freshly rendered from the exact original product models.

Phone displays use the original pixels of authentic Vistaire menu captures. Contiguous viewport crops preserve actual menu structure and wording; perspective/contain fitting adapts them to physical phone glass without stretching layouts or inventing content. Sauge Noire book pages retain their aspect ratio with natural black screen margins. The PDF comparison is the live site’s PDF-style representation of real Trouvable data, not an assertion that the restaurant supplied a PDF.

The allergen pair shows real declarations for Soufflé and Homard. At narrow rendered sizes the heading and panel remain visible, but the photograph is not an accessible or current allergen reference. Keep the section’s text-based explanation and link to the live menu; never infer dietary safety from the image.

Product photos and QR/menu scenes composite exact source GLB render layers. Geometry, proportions, bases, finishes and printed artwork are preserved. Source model hashes, render hashes and transforms are recorded. Original models and their embedded Sauge Noire artwork remain unchanged. Unverified background food was removed from scenes where it had no authentic source.

## Distribution

All placements: Maison Élyse 26, Trouvable 15, Sauge Noire 26.
New scenes: Maison Élyse 16, Trouvable 11, Sauge Noire 23. Sauge Noire includes the eight exact-product scenes because that is the source model artwork.

## Complete placement map

| Slot | Image | Role |
| --- | --- | --- |
| `G10:hero` | `/images/marketing/geo-brossard-room.webp` | Menu digital premium pour restaurants à Brossard. |
| `G12:premium` | `/images/marketing/geo-gastronomy-room.webp` | Ce que le menu Vistaire inclut |
| `G8:hero` | `/images/marketing/geo-montreal-room.webp` | Menu digital premium pour restaurants à Montréal. |
| `HOME:social-content:maison-elyse` | `/images/marketing/maison-elyse-dining-room.webp` | L’envie. |
| `HOME:testimonies:maison-elyse` | `/images/marketing/home-identity-maison-elyse.webp` | Trois expériences. Trois identités. |
| `CONTACT:hero` | `/images/marketing/contact-trouvable-room.webp` | Parlons de votre restaurant. |
| `HOME:social-content:trouvable` | `/images/marketing/trouvable-dining-room.webp` | Le choix. |
| `HOME:testimonies:trouvable` | `/images/marketing/home-identity-trouvable.webp` | Trois expériences. Trois identités. |
| `ABOUT:closing` | `/images/marketing/about-sauge-noire-room.webp` | Votre cuisine. Votre univers. Une autre dimension. |
| `BOOK:panel` | `/images/marketing/book-sauge-noire-table.webp` | Parlons de votre restaurant. |
| `G11:hero` | `/images/marketing/geo-premium-room.webp` | Un menu digital pour restaurant haut de gamme. |
| `G9:hero` | `/images/marketing/geo-laval-room.webp` | Menu digital QR pour restaurants à Laval. |
| `HOME:social-content:sauge-noire` | `/images/marketing/sauge-noire-dining-room.webp` | L’expérience. |
| `HOME:testimonies:sauge-noire` | `/images/marketing/home-identity-sauge-noire.webp` | Trois expériences. Trois identités. |
| `AR:premium` | `/images/marketing/ar-premium-dessert.webp` | Une carte immersive qui respecte le service |
| `DIGITAL:hero` | `/images/marketing/maison-elyse-souffle-phone.webp` | Menu digital restaurant |
| `G1:premium` | `/images/marketing/geo-qr-premium.webp` | Ce que le menu Vistaire inclut |
| `G2:hero` | `/images/marketing/geo-app-free-hero.webp` | Un menu digital sans application à installer. |
| `G3:premium` | `/images/marketing/geo-replace-pdf-dessert.webp` | Ce que le menu Vistaire inclut |
| `G5:proof` | `/images/marketing/geo-dish-page-dessert.webp` | Une page courte, mais complète |
| `G6:premium` | `/images/marketing/geo-food-photography-souffle.webp` | Ce que le menu Vistaire inclut |
| `G7:hero` | `/images/marketing/geo-allergens-menu.webp` | Un menu restaurant avec allergènes lisibles. |
| `G9:proof` | `/images/marketing/geo-laval-menu.webp` | Une carte claire pour le service |
| `GUIDE-A:hero` | `/images/marketing/guide-anatomy-menu.webp` | L’anatomie d’un menu digital premium |
| `G11:proof` | `/images/marketing/geo-premium-dish.webp` | Une carte premium, pas un tableau de bord |
| `G12:hero` | `/images/marketing/geo-gastronomy-souffle.webp` | Une carte digitale pour restaurant gastronomique. |
| `G3:proof` | `/images/marketing/geo-replace-pdf-detail.webp` | Une migration progressive |
| `G4:hero` | `/images/marketing/geo-pdf-alternative-hero.webp` | L'alternative premium au menu PDF restaurant. |
| `G5:hero` | `/images/marketing/geo-dish-page-hero.webp` | Des fiches plats digitales qui donnent envie de choisir. |
| `PDF:detail` | `/images/marketing/maison-elyse-homard-phone.webp` | Un menu digital ne doit pas transformer le restaurant en application froide |
| `AR:proof` | `/images/marketing/ar-proof-browse.webp` | La fiche plat reste le point d’entrée |
| `DIGITAL:proof` | `/images/marketing/trouvable-guest-menu.webp` | Une carte pensée pour la table |
| `G2:proof` | `/images/marketing/geo-app-free-dish.webp` | Une expérience web qui reste premium |
| `G4:premium` | `/images/marketing/geo-pdf-alternative-menu.webp` | Ce que le menu Vistaire inclut |
| `G8:proof` | `/images/marketing/geo-montreal-menu.webp` | Ce que Vistaire peut apporter à Montréal |
| `G3:hero` | `/images/marketing/geo-replace-pdf-hero.webp` | Remplacer un menu PDF par une vraie carte digitale. |
| `G4:proof` | `/images/marketing/geo-pdf-alternative-compare.webp` | Une alternative centrée sur le plat |
| `PDF:hero` | `/images/marketing/trouvable-pdf-digital.webp` | Menu PDF vs menu digital |
| `ABOUT:hero` | `/images/marketing/about-menu-portrait.webp` | Le digital doit prolonger l’expérience du restaurant |
| `G10:proof` | `/images/marketing/geo-brossard-qr.webp` | Un menu mobile qui reste désirable |
| `G1:hero` | `/images/marketing/geo-qr-hero.webp` | Un menu QR sans PDF, pensé pour la table. |
| `GUIDE-Q:hero` | `/images/marketing/guide-qr-menu.webp` | Un menu QR mobile sans application |
| `QR:hero` | `/images/marketing/sauge-noire-qr-menu.webp` | Menu QR code restaurant |
| `AR:hero` | `/images/marketing/ar-hero-lobster.webp` | Menu 3D / AR restaurant |
| `DIGITAL:premium` | `/images/marketing/digital-premium-burger.webp` | Pensé pour les restaurants haut de gamme |
| `G1:proof` | `/images/marketing/geo-qr-breakfast.webp` | Ce que le client voit après le scan |
| `G2:premium` | `/images/marketing/geo-app-free-contents.webp` | Ce que le menu Vistaire inclut |
| `GUIDE-3:hero` | `/images/marketing/guide-3d-burger.webp` | La 3D au restaurant : utile ou gadget ? |
| `QR:proof` | `/images/marketing/sauge-noire-dessert-phone.webp` | Le scan doit mener à quelque chose de désirable |
| `G11:premium` | `/images/marketing/restaurant-signature-drink.webp` | Ce que le menu Vistaire inclut |
| `HOME:pricing:acrylique` | `/images/marketing/home-pricing-acrylique.webp` | Votre collection. L’essentiel compris. acrylique |
| `PRICING:collection:acrylique` | `/images/marketing/pricing-acrylique-setting.webp` | Choisissez l’expérience qui prendra place sur vos tables. acrylique |
| `HOME:pricing:sculpte` | `/images/marketing/home-pricing-sculpte.webp` | Votre collection. L’essentiel compris. sculpte |
| `PRICING:collection:sculpte` | `/images/marketing/pricing-sculpte-setting.webp` | Choisissez l’expérience qui prendra place sur vos tables. sculpte |
| `HOME:pricing:carre` | `/images/marketing/home-pricing-carre.webp` | Votre collection. L’essentiel compris. carre |
| `PRICING:collection:carre` | `/images/marketing/pricing-carre-setting.webp` | Choisissez l’expérience qui prendra place sur vos tables. carre |
| `HOME:pricing:signature` | `/images/marketing/home-pricing-signature.webp` | Votre collection. L’essentiel compris. signature |
| `PRICING:collection:signature` | `/images/marketing/pricing-signature-setting.webp` | Choisissez l’expérience qui prendra place sur vos tables. signature |
| `G5:premium` | `/images/demo/dishes/homard-bleu-bisque-fenouil.png` | Ce que le menu Vistaire inclut |
| `G6:hero` | `/images/demo/dishes/tartare-saumon-label-rouge.png` | Un menu restaurant avec photos, sans perdre l'élégance. |
| `G6:proof` | `/images/marketing/geo-photos-in-menu.webp` | Des visuels intégrés à la carte |
| `G7:proof` | `/images/marketing/geo-allergens-detail.webp` | Des fiches plats plus informatives |
| `G7:premium` | `/images/demo/dishes/tarte-citron-basilic-pourpre.png` | Ce que le menu Vistaire inclut |
| `G8:premium` | `/images/demo/dishes/pave-boeuf-mature-bordelaise.png` | Ce que le menu Vistaire inclut |
| `G9:premium` | `/images/demo/dishes/canette-rotie-figues-epices.png` | Ce que le menu Vistaire inclut |
| `G10:premium` | `/images/demo/dishes/bar-de-ligne-artichaut-citron.png` | Ce que le menu Vistaire inclut |
| `G12:proof` | `/images/demo/dishes/souffle-chocolat-grand-cru.png` | Une expérience qui reste culinaire |

## Code and checks

- `lib/seoMarketingImages.ts`: one audited photo and FR/EN description per placement
- Home room/identity URLs, home pricing photos, About/Contact/Booking photos and dedicated pricing data/social metadata use the registry
- Parallel SEO/layout work consumes the same stable slot IDs for product pages, GEO/AEO pages and guides
- Existing pricing path expectations were updated; one focused contract rejects duplicate photo paths, missing runtime files, missing descriptions and unknown slot IDs
- Observed passing: targeted ESLint, `npm run typecheck`, `npm run assets:check`, `npm run lfs:check`, 27 focused tests, 67 unique SHA-256 hashes and `git diff --check`

Page-level responsive crop, console/network and runtime interaction QA belongs to the coordinating frontend validation and is not asserted here. Actual native AR, physical QR scanning, manufactured dimensions and resemblance to real venues are not verified by these photographs. Source restaurant data, genuine dish media contracts, models, video/frame pipelines, owner/admin and authentication remain unchanged.
