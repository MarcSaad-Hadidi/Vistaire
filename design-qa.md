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
