# PR 150 - Ledger de fidelite visuelle admin

Derniere mise a jour: 2026-07-12

## Protocole deterministe

- References officielles externes: `E:\Projet perso\vistaire-admin-references`.
- Desktop: 1672 x 941, DPR 1, `fr-CA`, `America/Toronto`, polices attendues avant capture.
- Mobile produit: 390 x 844 et 430 x 932; le composite officiel est recadre en `x=139,y=69,w=663,h=1535`, puis redimensionne en 390 x 903 avec un masque de coins de 24 px.
- Fixture: serveur PostgREST local versionne, scenario `pixel-reference`; aucune ecriture Supabase de production.
- Diff brut: fraction de pixels dont le delta RGB maximal depasse 20/255. Ce diagnostic inclut les photos, glyphes, donnees exactes et antialiasing; il ne remplace pas les tests de geometrie.
- Captures finales: `%TEMP%\vistaire-pr150-final-visual`.
- Overlays, diffs et crops: `%TEMP%\vistaire-pr150-final-compare`.

## Resultats avant / apres

| Ecran | Diagnostic historique | Diagnostic final | Evolution | Geometrie finale | Statut |
| --- | ---: | ---: | ---: | --- | --- |
| Overview desktop | 19.05 % | 16.08 % | -2.97 pts | KPI `y=221,h=132`; rangee principale `y=365,h=359`; disponibilite `y=734,h=199` | Structure conforme; diff brut > 1 % |
| Availability desktop | 10.88 % | 12.45 % | +1.57 pts | panneau `y=215`; controles `y=357`; lignes 80 px, six visibles dans le viewport | Structure conforme; hausse due aux icones, badges et donnees exactes |
| Insights desktop | 18.97 % | 15.41 % | -3.56 pts | KPI `y=142,h=120`; rangees `y=272/541/780`; proportions 722/416/402, 392/319/369/450 | Structure et neuf panneaux conformes; diff brut > 1 % |
| Overview mobile masque | 28.75 % | 25.85 % | -2.90 pts | quatre KPI, trois apercus et premiere carte au-dessus de la navigation fixe | Regression interne approuvee; diff officiel > 1 % |

## Corrections de cause racine

- Header Insights remis dans le flux normal; suppression des hauteurs nulles, marges negatives et translations de compensation.
- Grilles Insights calculees par contenu avec neuf panneaux, top 5 controles et aucun scroller analytics interne.
- `ChartFrame` separe axes, plot, tooltip, legende, resume et tableau exact; variantes compactes et detaillees.
- Courbes avec axes, grille, zone finale visible meme sans animation, points, crosshair et domaine stable.
- Donuts detailles bornes a leur cellule; legende courte pour le donut Overview; aucune legende technique visible.
- Tooltips ancres a 8 px des bords et testes dans les plots aux largeurs 390 et 430.
- Heatmap semantique 7 x 24 avec axes, legende, clavier 2D et cellules exactes.
- Overview: cinq plats, cinq cartes disponibilite, categorie en deux lignes explicites et aucun debordement.
- Availability: lignes de 80 px, miniatures 160 x 72, compteurs, recherche et trois filtres uniquement; mutation securisee inchangee.
- Fixture pixel-reference ponderee, non aleatoire, avec totaux exacts 1286 / 3742 / 562 / 412 et comparaison precedente compatible.

## Preuves de layout et interaction

- Header: bounding boxes sans intersection entre identite, actions, statut, periode et KPI.
- Insights: `scrollHeight <= clientHeight + tolerance` et `scrollWidth <= clientWidth + tolerance` pour les panneaux principaux.
- Tooltips: bornes du plot et du viewport controlees.
- Viewports sans overflow document: 320 x 700, 360 x 780, 375 x 812, 390 x 844, 430 x 932, 1280 x 720, 1440 x 900, 1672 x 941 et 1920 x 1080.
- Interactions: hover/pointer, focus, fleches, Home/End, Enter/Espace, Escape, tap, second tap, clic externe et reduced motion.
- Crops Insights: KPI, activite, comparaison, heatmap, top plats, recherches, categories, service et resume/insights.

## Artefacts regenerables

- `overview-desktop-overlay.png` / `overview-desktop-diff.png`
- `availability-desktop-overlay.png` / `availability-desktop-diff.png`
- `insights-desktop-overlay.png` / `insights-desktop-diff.png`
- `mobile/overview-mobile-masked-overlay.png` / `mobile/overview-mobile-masked-diff.png`
- `insights-kpis.png`, `insights-activity.png`, `insights-comparison.png`, `insights-heatmap.png`, `insights-topDishes.png`, `insights-searches.png`, `insights-categories.png`, `insights-service.png`, `insights-summaryInsights.png`

## Performance observee

Mesure Chromium locale sur `/admin/insights` en mode developpement Webpack, avec la fixture pixel-reference:

- CLS: `0.000291`.
- Navigation: `1106 ms`; DOMContentLoaded: `492 ms`; load: `1106 ms`.
- Rafraichissement visuel: `60.7 FPS`; changement de metrique sur deux frames: `358 ms`.
- Interaction clic de type INP: `176 ms` (indicatif, penalise par le runtime de developpement).
- Taches longues observees: `59 ms`, `325 ms`, `151 ms`.
- Heap JS: `91.7 MB`; scripts decodes: `12.9 MB`; CSS decode: `177 KB`.
- Aucun chargement GLB, USDZ ou MP4 sur la route admin.

Ces volumes de scripts et les taches longues ne representent pas un bundle de production: ils incluent le client HMR et l'instrumentation de developpement. Une mesure production locale authentifiee n'a pas ete possible sans contourner le garde de securite QR; ce garde a ete conserve. Le build de production reste la preuve de compilation, mais aucun score Lighthouse production n'est revendique.

## Ecart restant et decision PR

Le seuil indicatif de 1 % contre les pixels officiels n'est pas atteint. Les principaux ecarts restants sont les photos de plats reelles, le menu de 12 plats impose par la parite, les comptes exacts de la fixture, la typographie rasterisee et certaines compositions internes plus denses. Les tests fonctionnels, de geometrie et de non-overflow sont verts, mais aucune affirmation "pixel-perfect a 1 %" n'est faite. Le PR reste en brouillon; il n'est ni merge, ni deploye, ni marque ready.
