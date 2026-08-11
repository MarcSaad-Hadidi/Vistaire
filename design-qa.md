# Design QA — Sauge Noire unique book renderer

- Source visual truth: `E:\Projet perso\NouveauMenu\SaugeNoir\Maquette\ChatGPT Image Jul 23, 2026, 04_09_20 PM (1).png` (cover) and `E:\Projet perso\NouveauMenu\SaugeNoir\Maquette\ChatGPT Image Jul 23, 2026, 04_09_20 PM (2).png` (contents), with the supplied section and dish-detail references.
- Implementation screenshots: `E:\Projet perso\MenuAlive\output\playwright\sauge-noire-mobile-430-fixed.png` and `E:\Projet perso\MenuAlive\output\playwright\sauge-noire-mobile-430-contents.png` (temporary QA artifacts).
- Viewports: 430×932 and 390×844 CSS px, touch/mobile emulation, device scale factor 1.
- Route: `http://localhost:3200/menu/sauge-noire` backed by the real Sauge Noire menu data.

## Findings

- The cover and contents remain within the viewport: `scrollWidth === clientWidth` at both 430px and 390px.
- Tapping `Tapotez pour ouvrir` changes `view=sauge-0` to `view=sauge-1`, renders the contents page, and resets scroll to `0`.
- Tapping `Premiers gestes` changes to `view=sauge-2` and renders the first real menu section.
- Botanical motifs are static from first paint. Computed animation name is `none`; the previous stem/leaf growth keyframes were removed.
- The live Sauge Noire settings expose all configured locales (`fr-CA`, `en-CA`, `es-ES`, `it-IT`, `ar`) and currencies (`CAD`, `USD`, `EUR`, `GBP`) through compact popovers.
- Section pages return to `view=sauge-1` through the top-left table-of-contents control. Dish details preserve the full locale in back, next-dish, and menu links.
- The back-to-top control appears below the footer arrow, centered on the paper area, and returns the scroll position to `0` without covering the footer.
- Dish-detail allergen warnings use the selected locale, including the requested-modifications disclaimer for Italian, Spanish, and Arabic.
- Fresh mobile session completed with `readyState=complete`, HTTP 200, and no browser console/page errors.

## Comparison history

- Initial book navigation could appear frozen on mobile because URL synchronization rewrote the same query repeatedly after a tap. The sync now guards against redundant `replaceState` calls and scrolls to the new page top.
- Botanical assets were rechecked against all 11 supplied references and replaced with eight transparent PNGs: central sage, horizontal sprig, mirrored side sprig, Sans alcool branch, cocktail asset, and the three dish-detail row drawings. Each asset is cropped to its visible drawing bounds so CSS sizing matches the reference placement.
- Botanical placement now follows the plates: central sage on cover/contents/ending, horizontal sprig under Premiers gestes, side sprigs around Cru & frais, no standalone botanical on pages 3–5 or page 6 (Cocktails), Sans alcool branch under page 7, and distinct ingredients/allergens/accord drawings on dish details.
- Mobile spacing and the book rail were checked at both required widths; no horizontal overflow remains.

final result: passed

# Design QA — Landing Vistaire showcase

- Source visuelle principale : `9-Photo-9.jpg`, complétée par les neuf sections jointes et la dernière ambiance Trouvable.
- Preuves d’implémentation : `vistaire-landing-1440-full.png`, `vistaire-landing-390-full.png`, `vistaire-landing-430-hero.png` et `vistaire-reference-vs-implementation.jpg`, conservées hors du dépôt dans le dossier de visualisations Codex.
- Viewports comparés : 390×844, 430×932 et 1440×900 CSS px.
- Routes : `/` et `/en`, sur le build production local et sur la preview Vercel du PR.

## Fidélité et écarts intentionnels

- La hiérarchie de la référence est conservée : mosaïque vidéo/culinaire, valeur, trois expériences, comparaison, plats, outils restaurateur, CTA et footer.
- Le langage Vistaire existant reste prioritaire : BT Suave, Neue Montreal, surfaces espresso translucides, accents champagne, bordures fines et lumière ambre.
- Le hero emploie la vidéo Vistaire réelle plutôt que le mockup de téléphone statique de la référence.
- Les trois expériences utilisent des photos d’ambiance approuvées, sans les présenter comme des établissements clients vérifiés.
- La comparaison conserve le téléphone et la révélation circulaire existants; le tableau marketing statique de la référence n’a pas été reproduit.
- Les sections sont volontairement plus hautes que la maquette compacte afin de garder une typographie lisible et des cibles tactiles adaptées à 390 px.
- Les claims non prouvés, statistiques, faux clients, permissions/collaborateurs et promesses de vente ont été retirés.

## Vérifications visuelles

- Aucun débordement horizontal à 390, 430, 768, 1280 ou 1440 px.
- Le hero, les images des trois expériences, le téléphone de comparaison, le CTA final et le footer sont entièrement visibles.
- Le crop Trouvable conserve le bar, la lumière ambre, la végétation et les matières de la dernière photo fournie.
- Le top bar est le composant existant, sans reconstruction de son DOM ni de ses styles internes.
- Les états focus, le tablist et la comparaison restent lisibles sur les surfaces photographiques.
- La comparaison côte à côte finale confirme la filiation de composition sans copier les faux contenus de la maquette.

final result: passed

# Design QA — Pricing navigation, typography and brightness

Date: 2026-08-11

## Scope

- Shared Vistaire public navigation with the new `Tarifs` / `Pricing` destination.
- Correct BT Suave / Neue Montreal typography in the Pricing header and footer.
- Brighter Pricing photography and surfaces while preserving text contrast.

## Source references

- `C:\Users\hadid\.codex\codex-remote-attachments\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\416E86A2-129D-4A0B-BBC1-0C0A535D04C5\1-Photo-1.jpg` — reported Pricing header and dark hero.
- `C:\Users\hadid\.codex\codex-remote-attachments\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\416E86A2-129D-4A0B-BBC1-0C0A535D04C5\2-Photo-2.jpg` — correct Vistaire public-header typography reference.
- `C:\Users\hadid\.codex\codex-remote-attachments\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\416E86A2-129D-4A0B-BBC1-0C0A535D04C5\3-Photo-3.jpg` — reported Pricing footer typography.

## Implementation evidence

Codex in-app browser, `430 × 932`, device pixel ratio `1`, route `/tarifs-menu-digital-restaurant`:

- Full mobile hero: `C:\Users\hadid\.codex\visualizations\2026\08\11\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\pricing-mobile-430-hero.png`
- Focused sticky-header / Pilotage state: `C:\Users\hadid\.codex\visualizations\2026\08\11\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\pricing-mobile-430-pilotage.png`
- Focused footer state: `C:\Users\hadid\.codex\visualizations\2026\08\11\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\pricing-mobile-430-footer.png`

The source and implementation images were inspected together in two comparison inputs: header/hero/footer, then the correct shared-header reference beside the final hero and Pilotage states.

## Findings and correction history

1. The Pricing root did not expose the shared `--vistaire-font-display` and `--vistaire-font-body` variables. The header and footer brand therefore fell back to sans-serif. The variables now resolve to BT Suave and Neue Montreal, and the real Medium font file is loaded for weight 500.
2. The Pricing background combined `brightness(.84)` with a dark wash reaching `.84`. The image now renders at `brightness(1.02)` with a lighter warm wash, lighter collection glass, and lighter lower-page surfaces. The restaurant scene is visible without weakening primary text hierarchy.
3. The Pricing-only dark header override made this page differ from the rest of the public site. It was removed. A single warm translucent treatment now belongs to the shared header and remains readable over both restaurant imagery and the ivory Pilotage section.
4. Five navigation links fit at 390 and 430 px with no overlap or horizontal overflow. `Tarifs` / `Pricing` is active on Pricing and routes correctly from other public pages.
5. No visible regression was found in border radii, spacing, image crop, sticky positioning, or footer layout during the paired comparison.

## Functional and technical checks

- FR public page → `Tarifs` → French Pricing route: passed.
- FR Pricing → `EN` → English Pricing route with active `Pricing`: passed.
- Header and footer computed font family contains `BT Suave`; navigation text contains `Neue Montreal`: passed.
- Sticky header over the ivory Pilotage section: passed visually.
- Targeted Playwright suite: 40 tests passed, including 390, 430, 768, 1280 and 1440 px; no unexpected Pricing console errors, 404/500 responses, hydration errors, or horizontal overflow.

final result: passed

# Design QA — Pricing collection photography

Date: 2026-08-11

## Scope and source references

- Acrylique: `C:\Users\hadid\.codex\codex-remote-attachments\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\89DDB8FB-940F-4D72-BB29-E092A4527024\3-Photo-3.jpg`.
- Sculpté: `C:\Users\hadid\.codex\codex-remote-attachments\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\89DDB8FB-940F-4D72-BB29-E092A4527024\2-Photo-2.jpg`.
- Carré, shown from the front and back: `C:\Users\hadid\.codex\codex-remote-attachments\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\89DDB8FB-940F-4D72-BB29-E092A4527024\4-sauge_noire_qr_fonctionnel.png`.
- Signature: `C:\Users\hadid\.codex\codex-remote-attachments\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\89DDB8FB-940F-4D72-BB29-E092A4527024\1-Photo-1.jpg`.

## Implementation evidence

Codex in-app browser, device pixel ratio `1`, route `/tarifs-menu-digital-restaurant`:

- Four-card desktop composition, `1440 × 900`: `C:\Users\hadid\.codex\visualizations\2026\08\11\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\pricing-collections-1440x900.png`.
- Focused Carré crop, `390 × 844`: `C:\Users\hadid\.codex\visualizations\2026\08\11\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\pricing-carre-390x844.png`.
- Focused Carré crop, `430 × 932`: `C:\Users\hadid\.codex\visualizations\2026\08\11\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\pricing-carre-430x932.png`.

The four source images and the desktop/mobile implementation screenshots were inspected together in one comparison input.

## Findings and correction history

1. Each source is mapped to the matching physical collection and retains its real restaurant setting, material, QR treatment and Sauge Noire identity.
2. Carré remains one collection. Its alt text identifies the two visible pieces as the front and back, and the crop is biased right so both faces remain legible without presenting them as two offers.
3. The lossless PNG is retained for Carré to avoid adding compression around the supplied functional QR artwork. The other three photographs remain JPEG.
4. All four cards load the expected localized asset path in FR and EN. Natural image dimensions are non-zero and no 404/500 asset response or browser error was observed.
5. At 390, 430 and 1440 px, the support remains visible, the images keep `object-fit: cover`, and the document has no horizontal overflow.
6. The browser environment does not expose `BarcodeDetector`; QR scannability was therefore not claimed from automated browser QA. Visual integrity and successful rendering were verified.

final result: passed
