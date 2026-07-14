# PR 150 - Ledger de fidelite visuelle admin

Derniere mise a jour: 2026-07-13

## Protocole deterministe

- References officielles externes: `E:\Projet perso\vistaire-admin-references`.
- Desktop: 1672 x 941, DPR 1, `fr-CA`, `America/Toronto`, polices attendues avant capture.
- Mobile produit: 390 x 844 et 430 x 932; le composite officiel est recadre en `x=139,y=69,w=663,h=1535`, puis redimensionne en 390 x 903 avec un masque de coins de 24 px.
- Fixture: serveur PostgREST local versionne, scenario `pixel-reference`; aucune ecriture Supabase de production.
- Diff brut: fraction de pixels dont le delta RGB maximal depasse 20/255. Ce diagnostic inclut les photos, glyphes, donnees exactes et antialiasing; il ne remplace pas les tests de geometrie.
- Captures finales regenerables: `%TEMP%\vistaire-pr150-current-visual`.
- Overlays et diffs regenerables: `%TEMP%\vistaire-pr150-current-compare`.

## Resultats avant / apres

| Ecran | Diagnostic historique | Diagnostic final | Evolution | Geometrie finale | Statut |
| --- | ---: | ---: | ---: | --- | --- |
| Overview desktop | 19.05 % | 15.35 % | -3.70 pts | KPI, activite, classements et disponibilite tiennent dans 1672 x 941 | Structure conforme; diff brut > 1 % |
| Availability desktop | 10.88 % | 12.30 % | +1.42 pts | panneau, controles et lignes restent bornes dans le viewport | Structure conforme; ecart lie aux icones, badges, densite et donnees exactes |
| Insights desktop | 18.97 % | 17.45 % | -1.52 pts | cinq KPI et neuf panneaux sans intersection ni scroller interne | Structure et contenu conformes; diff brut > 1 % |
| Overview mobile masque | 28.75 % | 27.15 % | -1.60 pts | cinq KPI et tous les panneaux restent accessibles au-dessus de la navigation fixe | Reference non equivalente au contrat produit; diff > 1 % |

## Corrections de cause racine

- Header Insights remis dans le flux normal; suppression des hauteurs nulles, marges negatives et translations de compensation.
- Grilles Insights calculees par contenu avec neuf panneaux, top 5 controles et aucun scroller analytics interne.
- `ChartFrame` separe axes, plot, tooltip, legende, resume et tableau exact; variantes compactes et detaillees.
- Courbes avec axes, grille, zone finale visible meme sans animation, points, crosshair et domaine stable.
- Donuts detailles bornes a leur cellule; donut Overview compact borne a 82 px avec legende courte; aucune legende technique visible.
- Tooltips ancres a 8 px des bords et testes dans les plots aux largeurs 390 et 430.
- Heatmap semantique 7 x 24 avec axes, legende, clavier 2D et cellules exactes.
- Overview: cinq KPI, cinq plats et cinq cartes disponibilite restent lisibles a 390/430 px, avec prix et aucun debordement.
- Navigation: trois onglets visibles sur desktop, dont Analyses; sur mobile ces onglets sont masques et les trois routes restent accessibles uniquement par la barre fixe du bas.
- Availability: lignes de 80 px, miniatures 160 x 72, compteurs, recherche et trois filtres uniquement; mutation securisee inchangee.
- Fixture pixel-reference ponderee, non aleatoire, avec 34 plats, 26 disponibles, totaux exacts 1286 / 3742 / 562 / 412 et comparaison precedente compatible.
- Les lectures dashboard restent bornees a 12 000 evenements par fenetre afin que la fixture exacte couvre aussi le passage 7 j vers 30 j sans source tronquee.

## Preuves de layout et interaction

- Header: bounding boxes sans intersection entre identite, actions, statut, periode et KPI.
- Parite mobile: sous-titre, ouverture du menu, copie du lien, deconnexion, icones Availability et tendances Insights visibles a 390 et 430 px.
- Insights: `scrollHeight <= clientHeight + tolerance` et `scrollWidth <= clientWidth + tolerance` pour les panneaux principaux.
- Tooltips: bornes du plot et du viewport controlees.
- Viewports sans overflow document: 320 x 700, 360 x 780, 375 x 812, 390 x 844, 430 x 932, 1280 x 720, 1440 x 900, 1672 x 941 et 1920 x 1080.
- Interactions: hover/pointer, focus, fleches, Home/End, Enter/Espace, Escape, tap reel sur les cinq familles Insights, second tap, clic externe et reduced motion.
- Changement de periode: 7 j vers 30 j remplace les cles de preuve, rejoue une animation unique de 180 a 420 ms, puis se stabilise.
- Parite full-menu: 12 identifiants, categories et statuts admin/public identiques, y compris les plats indisponibles.
- Crops Insights: KPI, activite, comparaison, heatmap, top plats, recherches, categories, service et resume/insights.

## Artefacts regenerables

- `overview-desktop-overlay.png` / `overview-desktop-diff.png`
- `availability-desktop-overlay.png` / `availability-desktop-diff.png`
- `insights-desktop-overlay.png` / `insights-desktop-diff.png`
- `overview-mobile-overlay.png` / `overview-mobile-diff.png`
- `insights-kpis.png`, `insights-activity.png`, `insights-comparison.png`, `insights-heatmap.png`, `insights-topDishes.png`, `insights-searches.png`, `insights-categories.png`, `insights-service.png`, `insights-summaryInsights.png`

## Performance observee

Mesure Chromium locale sur `/admin/insights` depuis un vrai build de production, avec session admin signee et QR actif de la fixture `pixel-reference`:

- CLS: `0.0544`.
- Taches longues superieures ou egales a 50 ms: `0`.
- Frames apres interactions: p95 `16.8 ms`, soit un rythme proche de 60 FPS.
- Delta de layouts: `64`; delta de recalculs de style: `85` apres douze interactions de graphiques et quatre sparklines.
- Heap JS: `8.84 MB`.
- Scripts: `11` requetes, `586 582` octets decodes.
- Aucun chargement GLB, USDZ, MP4 ou video sur la route admin.

Le test `e2e/admin-performance.spec.ts` echoue volontairement sur la limite JS lorsqu'il est dirige vers le serveur Webpack de developpement (environ 13 MB avec HMR), mais passe sur le build de production. La session de mesure est produite avec le meme secret de test que le serveur et un QR actif scope a la fixture; aucun garde de securite de production n'est contourne.

## Ecart restant et decision PR

Le seuil indicatif de 1 % contre les pixels officiels n'est pas atteint. Les principaux ecarts restants sont les photos de plats, les 34 plats necessaires a la densite Availability, les comptes exacts de la fixture, la typographie rasterisee et le protocole mobile officiel. Cette reference mobile montre des onglets superieurs et quatre destinations basses, tandis que le contrat produit valide demande de masquer ces onglets et de conserver les trois routes dans la barre basse. Les references desktop montrent aussi deux onglets ou aucun onglet Insights, alors que le produit en demande trois. Les tests fonctionnels, de geometrie et de non-overflow sont verts, mais aucune affirmation "pixel-perfect a 1 %" n'est faite. Le PR reste en brouillon; il n'est ni merge, ni deploye, ni marque ready.
