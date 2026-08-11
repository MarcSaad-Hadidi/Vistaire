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

# Design QA — Pricing included-offer glass panel

Date: 2026-08-11

## Comparison target and evidence

- Source visual truth: `C:\Users\hadid\.codex\codex-remote-attachments\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\497153AF-0D68-40E3-B6BD-5209A4606DF5\1-Photo-1.jpg` (825 × 1280 px). It shows the reported state: the complete “Inclus dans chaque offre” copy sits directly over the restaurant photograph.
- Final mobile implementation: `C:\Users\hadid\.codex\visualizations\2026\08\11\019fefb0-08e7-7733-abaa-1ccb7c1e0c69\pricing-included-glass-390x844.jpg` (375 × 812 output raster from a 390 × 844 CSS viewport override, device pixel ratio 1).
- Additional responsive evidence: `pricing-included-glass-430x932.jpg`, `pricing-included-glass-en-430x932.jpg`, and `pricing-included-glass-1440x900.jpg` in the same external visualization directory.
- Routes and states: the included-offer section on `/tarifs-menu-digital-restaurant` and `/en/pricing-digital-restaurant-menu`, scrolled beneath the shared sticky navigation.
- Density normalization: no resampling was used. The source is a higher-density user capture; comparison focused on the same content region and glass treatment rather than pixel-for-pixel browser chrome. The final mobile and desktop implementation captures use device pixel ratio 1.
- Full-view and focused evidence: the source, 390 px implementation, and 1440 px implementation were opened together in one comparison input. A separate focused mobile check confirmed the panel boundary, text rhythm, list separators, and photograph visibility.

## Findings

- No remaining P0, P1, or P2 mismatch. One continuous glass panel now contains the section label, title, introduction, all three feature groups, and the pricing-difference note.
- Fonts and typography: BT Suave and Neue Montreal remain unchanged; heading hierarchy, line height, wrapping, and list weights remain consistent with the existing Vistaire page.
- Spacing and layout rhythm: the panel uses a 22 px desktop radius and 19 px mobile radius, generous responsive padding, three columns on desktop, and the existing single-column groups on mobile. No content crosses the panel edge and no horizontal overflow occurs at 390, 430, or 1440 px.
- Colors and visual tokens: the border uses the existing champagne treatment. A warm `rgba(8, 5, 3, 0.14)` surface and 9 px backdrop blur separate the copy from the photograph while preserving the lighter restaurant ambience requested previously.
- Image quality and asset fidelity: the real restaurant background remains visible through the panel; no crop, replacement, generated asset, or image distortion was introduced.
- Copy and content: all French and English pricing copy remains unchanged and fully contained in the same panel.

## Comparison history

1. Initial state: the content had only top and bottom rules, with no radius, translucent surface, or backdrop blur. The text read as if it were placed directly on the photograph.
2. First correction: a single bordered glass surface was added. Its initial 0.26 dark alpha improved separation but was classified P2 because it re-darkened a page that had just been intentionally brightened.
3. Final correction: the surface alpha was reduced to 0.14 while keeping the champagne border, inset highlight, shadow, and blur. Post-fix captures show a clear container with the restaurant still visible and no responsive regression.

## Functional checks

- One panel is rendered and contains one level-two heading plus all three level-three groups.
- Computed style confirms a solid border, non-zero radius, translucent background, and active backdrop blur.
- FR and EN render the same treatment.
- Browser console has no errors. The only warning is the existing Next.js development-only LCP suggestion for the first collection image.
- All four collection images remain loaded with non-zero natural dimensions.

## Follow-up polish

- None required for this scoped correction.

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
