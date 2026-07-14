# PR 150 - Matrice d'exhaustivite Insights

Date: 2026-07-13
Route: `/admin/insights`
Reference: `04-insights-desktop.png`, 1672 x 941, DPR 1

## Legende

- `R/I/U`: etats reel, insuffisant et indisponible.
- `H/F/T`: souris, focus clavier et tactile.
- Les dimensions sont celles de la fixture `pixel-reference` a 1672 x 941.
- Les captures et diffs sont regeneres dans `%TEMP%\vistaire-pr150-current-visual` et `%TEMP%\vistaire-pr150-current-compare`; ils ne sont pas suivis par Git.

## Matrice des 20 elements

| # | Element | Composant et source | R / I / U | Desktop et responsive | H / F / T, tooltip | Animation et reduced motion | Overflow, overlap et preuve visuelle |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | KPI Ouvertures | `AdminInsightsPage`; `metrics.menu-opens`, somme exacte `menu_opened` | Valeur et variation / tiret et explication / etat centralise | Carte 120 px; grille 5, puis 3, puis 1 colonne | Definition et sparkline interactive avec valeur exacte | Entree 280 ms; sparkline sans boucle; instantane en reduced motion | Contenu borne; capture desktop complete |
| 2 | KPI Consultations | `AdminInsightsPage`; `metrics.dish-opens`, somme exacte `dish_opened` | Valeur et variation / tiret et explication / etat centralise | Carte 120 px; grille 5, puis 3, puis 1 colonne | Definition et sparkline H/F/T avec valeur exacte | Entree 280 ms; focus conserve; instantane en reduced motion | Contenu borne; crop KPI et matrice responsive |
| 3 | KPI Recherches | `AdminInsightsPage`; total brut `search_used`, independant du seuil de publication | Valeur et variation / preuve insuffisante / etat centralise | Carte 120 px; grille 5, puis 3, puis 1 colonne | Definition et sparkline H/F/T; Enter, Espace et Escape | Entree 280 ms; aucune boucle; instantane en reduced motion | Valeur et tendance visibles a 390/430 px |
| 4 | KPI 3D/AR | `AdminInsightsPage`; `dish_3d_clicked + dish_ar_clicked` | Valeur et variation / preuve insuffisante / etat centralise | Carte 120 px; grille 5, puis 3, puis 1 colonne | Definition et sparkline H/F/T avec dismissal externe | Entree 280 ms; aucune animation permanente | Aucune confusion avec le nombre de plats equipes |
| 5 | KPI Plats disponibles | `AdminInsightsPage`; `menu.readiness.counts` | Exact disponible / total; pas de comparaison inventee | Carte 120 px; grille 5, puis 3, puis 1 colonne | Definition accessible; valeur toujours visible sans hover | Entree du panneau seulement; instantanee en reduced motion | Aucun depassement; crop KPI et matrice responsive |
| 6 | Activite sur la periode | `InsightsActivityChart`; `metricSeries` courant | Serie dense / etat de preuve / message centralise | 722 x 260; une colonne mobile | H/F/T, crosshair, tooltip exact, tableau SR | Trace, zone et points 180-320 ms; rejoues au changement de metrique | Plot borne; crop `insights-panel-1-activity.png` |
| 7 | Selecteur Ouvertures / Consultations / Recherches | `InsightsActivityChart`; trois series exactes | Selection disponible si etat reel | 3 segments; pleine largeur mobile | Clic et clavier natifs; `aria-pressed` | Transition de geometrie; aucune boucle | 44 px mobile; inclus dans crop activite |
| 8 | Comparaison actuelle / precedente | `AdminComparisonChart`; `dailyComparison` avec deux dates par point | Deux series / phrase premium si periode insuffisante / indisponible | 416 x 260; une colonne mobile | H/F/T, deux valeurs et delta, roving tabindex | Deux traces et points; reduced motion conserve la geometrie | Tooltip ancre dans le plot; crop `insights-panel-2-comparison.png` |
| 9 | Heatmap Moments d'activite | `AdminHeatmap`; matrice lundi-premier 7 x 24 UTC | 168 cellules / etat de preuve / indisponible | 402 x 260; une colonne mobile | Grille semantique, fleches 2D, H/F/T, tooltip exact | Fade cellule 220 ms; instantane en reduced motion | Axes et legende bornes; crop `insights-panel-3-heatmap.png` |
| 10 | Top plats | `InsightsDishRows`; ranking exact joint au menu | Top 5 visible, suite dans tableau/action / preuve / indisponible | 392 x 215; une colonne mobile | H/F, tooltip nom/valeur; photos avec fallback | Barres et apparition sobres | Cinq lignes, aucune scrollbar; crop `insights-panel-4-top-dishes.png` |
| 11 | Top recherches | `InsightsSearchRows`; recherches publiables et series quotidiennes | Top 5, surplus explicite / preuve / indisponible | 319 x 215; une colonne mobile | H/F/T sur la sparkline, variation visible, tooltip et disclosure | Trace courte et transition | Aucune ligne partielle; crop `insights-panel-5-top-searches.png` |
| 12 | Repartition categorie | `AdminCategoryBreakdown`; labels joints au menu, `Autres` si necessaire | Donut exact / preuve / indisponible | 369 x 215; legende sous le donut mobile | H/F/T, valeur, unite et pourcentage, tableau exact | Segments 280 ms; accent actif | Donut adaptatif a 1280 px; crop `insights-panel-6-categories.png` |
| 13 | Repartition service | `AdminServiceBreakdown`; cinq fenetres UTC | Nuit, Matin, Midi, Apres-midi, Soiree / preuve / indisponible | 450 x 215; legende sous le donut mobile | H/F/T, valeur, unite et pourcentage, liste exacte | Segments 280 ms; focus et selection conserves; instantane en reduced motion | Mention UTC unique; crop `insights-panel-7-service.png` |
| 14 | Resume de la periode | `AdminInsightsPage`; metriques, fraicheur, couverture, comparaison | Valeurs tracables / libelles neutres / indisponible | 911 x 151; une colonne mobile | Lecture et tableau de donnees visible | Entree de panneau; reduced motion instantane | Grille interne sans scroll; crop `insights-panel-8-summary.png` |
| 15 | Insights cles | `AdminInsightsPage`; regles deterministes sur metriques visibles | 2 a 4 conclusions / etat de preuve / indisponible | 639 x 151; une colonne mobile | Lecture clavier standard | Entree de panneau uniquement | Aucune interpretation IA; crop `insights-panel-9-key-insights.png` |
| 16 | Selecteurs de route et de periode | `AdminTabs`, `AdminNav`, `AdminInsightsPage`; routes admin et `AdminDashboardRange` allowlistees | Route et periode actives / meme etat de page / meme erreur centralisee | Trois onglets desktop; barre du bas mobile; periode dans le header | Liens clavier, `aria-current`; aucun doublon mobile | Navigation/recalcul reel; 7 j vers 30 j rejoue une animation bornee | Insights n'est jamais une impasse; aucun chevauchement header/KPI |
| 17 | Fraicheur | `adminFreshnessCopy`; `analytics.freshness` | A jour / Mise a jour retardee / Donnees a actualiser | Header et resume | Lecture accessible | Aucun compteur anime | Aucun token `fresh/delayed/stale` visible |
| 18 | Etats insuffisants | `AdminEvidenceState`; `adminEvidenceReasonCopy` | N/A / phrases francaises par raison / N/A | Remplace le contenu sans changer la cellule | `role=status` et texte lisible | Pas d'animation trompeuse | Contrats Node et rendu statique verifies |
| 19 | Etats indisponibles | `AdminEvidenceState`; mapping centralise | N/A / N/A / explication et retry selon contrat | Remplace le contenu sans debordement | `role=alert` quand necessaire | Pas d'animation trompeuse | Aucun code interne ou slug visible |
| 20 | Tooltips, legendes et tableaux exacts | `ChartFrame`, `MetricTooltip`, tableaux SR | Valeurs exactes / alternatives textuelles / alternatives textuelles | Tooltips max 210 px, alignement bord 34/66 | H/F/T, Enter/Espace, Escape, Home/End, fleches | Transitions 180 ms; desactivees en reduced motion | Tests de bounding box, viewport et 9 crops Insights |

## Preuves automatisees

- `node --test tests/admin-interactive-charts.test.mjs tests/admin-dashboard-ui.test.mjs`
- `npx playwright test e2e/admin-chart-interactions.spec.ts --workers=1`
- `npx playwright test e2e/admin-insights-fidelity.spec.ts --workers=1`
- `npx playwright test e2e/admin-visual.spec.ts --workers=1`
- `npx playwright test e2e/admin-performance.spec.ts --workers=1` sur build production authentifie
- `npm run test:admin:full-menu` ou le scenario cible `full-menu admin parity` avec la fixture dediee.
- Viewports: 320 x 700, 360 x 780, 375 x 812, 390 x 844, 430 x 932, 768 x 1024, 1280 x 720, 1440 x 900, 1672 x 941 et 1920 x 1080.

Derniers resultats locaux: contrats admin `253 passed`; interactions `9 passed, 1 skipped`; fidelity Insights `7 passed`; visual/layout `7 passed` apres reprise ciblee du cas 1280 px; parite full-menu `1 passed`; lint, typecheck, politique assets et politique LFS passes. La QA navigateur controle les trois routes a 390, 430 et 1280 px: aucun overflow, trois liens uniquement dans la barre basse mobile et trois onglets uniquement sur desktop. Le build de production, le smoke menu public et la mesure performance restent les preuves du dernier cycle propre documente ci-dessous; ils ne sont pas presentes comme ayant ete rejoues pendant la session dev active.

## Conclusion

Les 20 elements sont implementes et couverts fonctionnellement. Le PR doit rester en brouillon tant que le diagnostic pixel brut contre les images officielles reste superieur au seuil indicatif de 1 %, principalement a cause des photos, des donnees exactes de la fixture et des differences typographiques documentees dans le ledger de fidelite.
