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
