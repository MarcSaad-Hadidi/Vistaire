# Vistaire — rapport de refactor Ponytail

## Baseline

- Base vérifiée et fetchée : `origin/main` à `2220762673087226f7ed914d8aca97f13d3baa78`. Branche : `codex/ponytail-deep-simplification`.
- Le checkout initial `E:/Projet perso/MenuAlive`, sa branche `ci/production-grade-pipeline` et ses changements utilisateur ont été préservés. Travail réalisé dans un worktree propre puis intégré par commits thématiques depuis trois worktrees distincts.
- npm identifié par `package-lock.json`. Environnement local : Windows, Node 25.2.1, npm 11.16.0 ; CI : Node 24.
- Installation, assets, LFS, lint, types, build et trois contrôles statiques réussis avant modification.
- Suite Node initiale : 1 894 exécutions, 1 876 PASS, 14 FAIL, 4 SKIP, 472,676 s.
- Navigateur initial : Chromium public 43 + 135 PASS ; Maison/AR 36 PASS ; QR 7 PASS ; WebKit 32 PASS / 2 FAIL ; admin 14 PASS / 9 FAIL / 2 SKIP.
- La baseline Maison/AR utilisait le build de référence. Le premier QR local et une partie du dev admin ont été exécutés après intégration de suppressions sans consommateurs ; leurs composants actifs étaient inchangés. Ces mesures ne sont pas présentées comme des captures binaires avant/après parfaites.

## Audit Ponytail

Le problème principal était la coexistence de générations de composants qui n'étaient plus appelées : anciens heroes, pages SEO, dashboard admin, menu/détail démo et anciennes aides AR. Un cache durable et un client Supabase navigateur n'avaient plus de consommateurs. Model Lab utilisait les inclusions serveur très larges du pipeline Meshy alors que son worker nécessite une fermeture runtime plus petite.

Les remplacements actifs ont été lus directement avant suppression. Imports statiques/dynamiques, réexports, scripts, contrats, routes et chargeurs ont été examinés. Les noms lourds ne suffisent pas à justifier la suppression d'une dépendance. Les fallbacks de schéma, l'isolation restaurant, la validation, les caches actifs et l'authentification ont été conservés.

Rapports détaillés, avec raisons et fichiers :

- [Application](ponytail-application-audit.md).
- [Tests et inventaire des 219 suites initiales](ponytail-test-audit.md). L'inventaire est exhaustif ; il ne prétend pas être une revue ligne par ligne de tous les tests. Les candidats à suppression ont fait l'objet d'une analyse ciblée.
- [Model Lab, dépendances et 3D](ponytail-model-lab-audit.md).

Une revue indépendante finale a examiné 983 fichiers et 3 990 imports/réexports/appels require : aucune référence résiduelle aux modules supprimés. La fermeture de dépendances Model Lab couvre les 46 paquets runtime calculés, sans paquet manquant. Aucun P0/P1/P2 actionable confirmé.

## Refactors appliqués

| Groupe | Changement et nécessité | Comportement préservé | Preuve |
| --- | --- | --- | --- |
| Anciennes landing/SEO | Suppression de 26 fichiers remplacés par les composants Vistaire actuels. | Home FR/EN, quatre piliers, métadonnées, JSON-LD, animations actives. | Build, contrats SEO, scénarios landing/SEO, revue CSS. |
| Admin/owner/menu historiques | Suppression de 29 modules inaccessibles et de leur CSS privé. | AdminOverview, menus Maison/Trouvable/Sauge, QR canonique, APIs owner/AI. | Graphe d'imports, tests auth/QR/cache, E2E publics/admin/QR. |
| Cache/client inutilisés | Suppression de `lib/menu/publicMenuCache.ts` et `utils/supabase/client.ts`. | Cache de requête/coalescence actifs, clients serveur/session/admin. | Contrats de cache et d'isolation conservés. |
| Ancien détail 3D | Suppression de six fichiers détail/warmup/détection sans appelant. | `DishModelViewer`, `lib/ar/arExperience.ts`, Quick Look/Scene Viewer actifs. | Contrats AR et parcours d'intention/handoff. |
| Orphelins finaux | Suppression de DemoSimulationContext, useIsRealMobile, frameConfig ; retrait du seul wrapper inutilisé du layout démo et de deux exports inutilisés de demoMenuData. | SmoothScrollProvider, données de plats, formats, routes et métadonnées inchangés. | Recherche de tous les appelants, types/build, parcours démo FR/EN. |
| Packaging Model Lab | `next.config.ts` sépare la fermeture runtime du worker de celle du pipeline Meshy. | Même worker, presets, limites, timeouts et options de fallback. | Tests de fermeture runtime, worker isolé sur six presets, build local et Vercel. |
| Dépendances/scripts | `package.json`/lock retirent deux déclarations inutilisées et le générateur d'anciens frames ; `test:seo` nomme directement les suites pricing conservées. | Versions de tous les paquets restants et couverture pricing conservées. | Installation propre, audit, lint/build, suite Node complète. |
| Baseline sécurité | `ci/npm-audit-baseline.json` met à jour seulement le checksum du lockfile. | Aucune exception de vulnérabilité ajoutée. | Audit zéro vulnérabilité et garde-fou réussis. |
| Documentation | Trois audits et ce rapport donnent les preuves de suppression, limites et mesures. | Aucun effet runtime. | Diff final relu. |

Aucun asset public, schéma SQL, route page/API, scénario E2E, flux d'authentification ou contrat de données n'a été supprimé ou réécrit. Le seul layout modifié retire un provider sans lecteur. Aucune dépendance, infrastructure de tests ou abstraction de production ajoutée.

## Tests supprimés

- 42 déclarations retirées ; deux fichiers entièrement supprimés : `seo-pillar-animations.test.mjs` et `dish-asset-warmup.test.mjs`, dédiés aux implémentations mortes.
- Les contrats mixtes ne perdent que les assertions concernant les modules supprimés. Les protections auth, QR, analytics, cache et viewer actif restent présentes.
- Doublons ciblés footer, FAQ, showcases SEO et reset Sauge couverts par les parcours Playwright existants correspondants. Deux vérifications ne testaient que des constantes de fixtures ou répétaient un inventaire déjà contrôlé.
- Les imports à effet de bord qui exécutaient les suites pricing deux fois sont supprimés : 14 exécutions doublonnées évitées, toutes leurs assertions conservées. `test:seo` inclut explicitement ces deux fichiers.
- Un retrait envisagé du contrat clavier des onglets a été annulé après revue : l'E2E ne remplaçait pas toute sa protection d'accessibilité.
- Détail de chaque retrait et couverture remplaçante : [audit des tests](ponytail-test-audit.md).

## Tests conservés

Les calculs, projections réelles, mutations, validations de frontières, isolation multi-restaurant, caches, idempotence QR, permissions, migrations, préparation GLB/USDZ, accessibilité et contrats de média apportent un signal distinct. Les 56 specs E2E restent inchangées. Les assertions admin encore utiles ne sont pas retirées sur la base de scénarios navigateur instables.

Quatre erreurs de chemins `app/owner` ont été corrigées en `app/(fr)/owner` sans modifier les assertions. Le contrat de tracing lit la configuration réelle et distingue les deux pipelines ; les paquets de types déjà exclus du runtime ne sont plus traités comme dépendances exécutables.

## Dependencies

- Supprimées comme dépendances directes de développement : `autoprefixer` (PostCSS utilise `@tailwindcss/postcss`) et `@eslint/eslintrc` (configuration ESLint plate native).
- Le lockfile retire uniquement `autoprefixer`, `fraction.js`, `postcss-value-parser` et les deux déclarations racine. Aucune version restante ne change. ESLint garde sa propre dépendance transitive eslintrc.
- 22 dépendances production conservées ; devDependencies : 14 → 12 ; entrées non racine du lockfile : 662 → 659.
- GSAP/Lenis restent montés ; glTF/Babylon/Sharp/fflate sont nécessaires aux viewers, workers ou conversions ; Supabase, Brevo, QR et page-flip restent utilisés.

## 3D/AR / Model Lab

Model Lab est accessible depuis la navigation owner et le dashboard. Ses routes config/inspect/optimize restent actives et protégées. Son worker utilise glTF-Transform core/extensions/functions, meshoptimizer et Sharp. Les routes GLB/publish Meshy gardent leur CLI/Babylon et scripts de conversion.

Le worker réel a été exécuté dans un dossier isolé contenant seulement sa fermeture runtime : les six presets source-clean, safe, balanced, target-5mb, ultra et ar-bridge ont produit un GLB relisible avec mesh et texture ; ar-bridge ne requiert aucune extension. Le dossier ne contenait ni Babylon ni la CLI glTF et a été supprimé après vérification.

Le build intégré passe de 15 133 entrées / 133 901 764 octets à 612 / 26 991 979 pour la trace Model Lab (-79,84 % en octets). Les routes Meshy ne perdent que le worker Model Lab inutile : 15 229 → 15 228 entrées et -2 885 octets chacune. Les mesures sont des sommes NFT locales, pas des tailles compressées de fonctions déployées.

Aucun GLB/USDZ n'est demandé avant intention sur les pages publiques inspectées. Les handoffs AR sont testés par Playwright et user agents simulés ; aucun iPhone/Android physique n'a été utilisé. Quatre tests USDZ restent ignorés faute d'OpenUSD/Pillow/Blender.

## Mesures avant / après

Comptage identique des fichiers versionnés et lignes séparées par newline, y compris fin de fichier. Les rapports ajoutés ne sont pas comptés comme code de production. Le nombre d'exécutions Node comprend les sous-tests et les imports doublonnés initiaux.

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Fichiers versionnés au total (rapports inclus) | 1 721 | 1 656 |
| Fichiers production TS/JS/CSS dans app/components/lib/hooks/utils/types | 638 | 572 |
| Lignes production | 165 010 | 156 179 |
| Fichiers tests/helpers | 241 | 239 |
| Lignes tests/helpers | 66 350 | 65 228 |
| Fichiers E2E/support | 69 | 69 |
| Lignes E2E/support | 21 985 | 21 985 |
| Suites Node `.test.mjs` | 219 | 217 |
| Exécutions Node | 1 894 | 1 838 |
| Node PASS / FAIL / SKIP | 1 876 / 14 / 4 | 1 825 / 9 / 4 |
| Durée brute suite Node | 472,676 s | 342,403 s |
| Dépendances / devDependencies | 22 / 14 | 22 / 12 |
| Pages / handlers | 64 / 74 | 64 / 74 |
| `.next/static` en octets | 50 051 884 | 49 988 375 |
| Trace Model Lab en octets | 133 901 764 | 26 991 979 |
| Warning build TypeScript/module | 1 | 1 |
| Warnings lint | 0 | 0 |

66 fichiers de production et un script devenu inutile sont supprimés. Le diff des tests retire 1 120 lignes nettes ; le comptage textuel ci-dessus baisse de 1 122 car deux fins de fichiers disparaissent aussi. Les durées brutes ne sont pas un benchmark contrôlé : caches et charge concurrente diffèrent. La taille totale brute de `.next` (376 627 355 → 828 923 044 octets avant nettoyage) inclut caches et sorties dev accumulées ; elle n'est pas comparable comme bundle de déploiement. Les tailles statiques et NFT sont les mesures pertinentes ci-dessus.

Le CSS compilé passe de 5 081 à 4 372 sélecteurs distincts. Sur 710 sélecteurs retirés, aucun token réellement supprimé n'est trouvé dans les sources vivantes. Le seul hit, `leading-[1]`, existe encore dans le CSS final sous un regroupement différent. Les interpolations/concaténations de classes ont aussi été examinées.

## Commandes et résultats locaux

Exécutés dans le worktree d'intégration :

- `npm ci --no-audit --no-fund` : PASS, 585 → 582 paquets installés. Trois avertissements de dépréciation et l'avertissement allow-scripts/unrs-resolver sont préexistants.
- `npm run assets:check` : PASS, 57 exceptions historiques inchangées.
- `npm run lfs:check` : PASS, zéro règle LFS / pointeur actif.
- `npm run lint` : PASS, zéro warning.
- `npm run typecheck` : PASS.
- `npm run build` : PASS, compilation 37,8 s, TypeScript 20,9 s, 42 pages statiques générées. Un warning préexistant MODULE_TYPELESS_PACKAGE_JSON sur tailwind.config.ts.
- `node scripts/ci/check-static-public-import-boundary.mjs` : PASS, 29 entrées.
- `node scripts/ci/check-static-public-routes.mjs` : PASS, 26 routes nommées.
- `node scripts/ci/check-public-prerender-artifacts.mjs` : PASS.
- `npm audit --json` puis `node scripts/ci/check-npm-audit-baseline.mjs <rapport>` : PASS, zéro vulnérabilité, aucune exception ajoutée.
- `node --test --test-reporter=spec tests/*.test.mjs` : terminé, 9 FAIL préexistants, aucun nouvel échec.
- `git diff --check` : PASS.

Échecs Node restants, identiques à la baseline : landing-menu-cache-contract:624 ; maison-elyse-qr-menu-source:92 et :332 ; owner-menu-and-3d-source:73 ; owner-restaurant-creation:603 et :960 ; public-menu-analytics-source:34 ; public-menu-detail-source:15 ; trouvable-category-state:80. Ils portent sur des assertions de source/contrats déjà rouges. Ce refactor ne modifie pas le code vivant pour les faire artificiellement passer.

Les quatre SKIP concernent la conversion USDZ, la couche USD racine et les deux tests d'échelle physique : OpenUSD/Pillow/Blender indisponibles, comme avant.

## QA navigateur finale

Fixtures locales uniquement, avec le build de production sur `127.0.0.1:3137` et le serveur Supabase synthétique sur `127.0.0.1:55434`. Les runners admin/QR utilisent leurs bases locales séparées. Les clés Clerk et jetons owner sont fictifs ; aucune clé de production copiée.

| Campagne | Résultat final | Comparaison initiale |
| --- | --- | --- |
| Chromium public / landing / SEO / Sauge | 178 PASS, 4,5 min | 43 + 135 PASS |
| Maison / Google Review / handoffs AR | 36 PASS, 59,6 s | 36 PASS |
| WebKit démo / preview / Sauge / SEO | 34 PASS, 3,2 min | 32 PASS / 2 timeouts |
| Admin général | 19 PASS / 4 FAIL / 2 SKIP, 7,2 min | 14 PASS / 9 FAIL / 2 SKIP |
| QR fonctionnel | 7 PASS, 28,1 s | 7 PASS |
| Admin full-menu, Chromium + WebKit | 4 PASS, 23,1 s | Campagne complémentaire résolvant les deux SKIP |

Total final : 278 exécutions E2E réussies. Les quatre échecs admin restants sont tous préexistants : `admin-visual.spec.ts` lignes 192, 227, 242 et 296. Ils expirent dans `page.goto(..., waitUntil: "networkidle")` (30 s ou 180 s). Aucun nouveau scénario en échec. Les différences entre exécutions ne sont pas présentées comme des corrections de bugs admin/WebKit : aucun de leurs composants actifs ni de leurs specs n'a changé.

Les suites sur serveur existant ont été lancées via `node node_modules/@playwright/test/cli.js test <fichiers> --project=<chromium|webkit> --workers=1 --retries=0 --forbid-only`, avec `PLAYWRIGHT_SKIP_WEB_SERVER=1` et le jeton synthétique owner déjà configuré sur le serveur.

Fichiers du groupe Chromium public :

```text
e2e/ci-smoke.spec.ts
e2e/public-navigation.spec.ts
e2e/demo-restaurant-experiences.spec.ts
e2e/restaurateur-preview.spec.ts
e2e/landing-production-photo.spec.ts
e2e/landing-redesign.spec.ts
e2e/sauge-noire-menu-shared-smoke.spec.ts
e2e/sauge-noire-3d-state-reset.spec.ts
e2e/sauge-noire-first-gesture-scroll.spec.ts
e2e/sauge-noire-swipe-intent.spec.ts
e2e/sauge-noire-contents-single-flip.spec.ts
e2e/sauge-noire-static-page-handoff.spec.ts
e2e/ar-renderer-handoff.spec.ts
e2e/seo-smoke.spec.ts
e2e/seo-interactive-showcases.spec.ts
e2e/prompt5-pdf-comparison.spec.ts
e2e/prompt5-faq.spec.ts
e2e/prompt5-footer.spec.ts
e2e/prompt5-guides.spec.ts
```

Maison : `google-review-direct-cta.spec.ts`, `maison-elyse-public-menu.spec.ts`, `ar-handoff.spec.ts`, avec `VISTAIRE_E2E_MAISON_PUBLIC_MENU=1` et `VISTAIRE_E2E_TROUVABLE_3D=1` sur le serveur.

WebKit : `sauge-noire-3d-state-reset.spec.ts`, `sauge-noire-contents-single-flip.spec.ts`, `sauge-noire-static-page-handoff.spec.ts`, `demo-restaurant-experiences.spec.ts`, `seo-interactive-showcases.spec.ts`, `restaurateur-preview.spec.ts`.

Admin : `node scripts/run-playwright-e2e.mjs e2e/admin-chart-interactions.spec.ts e2e/admin-insights-fidelity.spec.ts e2e/admin-visual.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only`, avec `VISTAIRE_ADMIN_VISUAL_FIXTURE=1`, fixture port 3191 et application port 3192. Les diagnostics de cette campagne ont été redirigés vers un dossier temporaire dédié.

Les commandes `npm run test:qr:functional` et `npm run test:admin:full-menu` ont été exécutées telles quelles avec les clés Clerk fictives locales.

En complément, instrumentation Playwright de neuf routes à 390, 430 et 1440 px : `/`, `/en`, `/demo`, `/menu/maison-elyse`, `/menu/sauge-noire`, `/menu-digital-restaurant`, `/admin`, `/owner/model-lab`, `/sign-in`. Toutes les pages publiques inspectées répondent 200, sans overflow, erreur console/runtime, 404/500 pertinent ni modèle lourd avant intention. `/admin` désigne ici la surface anonyme ; les interactions authentifiées sont couvertes par les fixtures dédiées. Les deux home desktop annulent une requête `/videos/Vistaire2.mp4` (`ERR_ABORTED`), comme dans la référence. Les parcours Maison détaillés sont couverts par leur fixture explicite, pas par la seule page vide éventuelle du fixture général.

Les routes d'authentification réelle n'ont pas été validées : la clé fictive pointe vers `clerk.example.com`, qui ne se résout pas. Les erreurs réseau sur sign-in et la redirection Model Lab correspondent à cette configuration, pas à une preuve de fonctionnement du service externe. Aucune prétention de QA sur appareil physique.

## CI, PostgreSQL et Vercel

[PR brouillon #257](https://github.com/MarcSaad-Hadidi/Vistaire/pull/257), sans fusion automatique.

Le [workflow CI 36208844602](https://github.com/MarcSaad-Hadidi/Vistaire/actions/runs/36208844602) est entièrement SUCCESS sur le commit de code `45af82210f285fdf0befbfed70f76c01c8b9ee3c` : fast-gate, static-quality, build-app, database-contracts, e2e-public-chromium, e2e-sauge-chromium, e2e-admin-qr-chromium, webkit-critical, CI Gate et métriques. Les workflows séparés assets, CodeQL et sécurité des workflows/audit passent aussi. Cette CI sélectionnée ne signifie pas que les neuf tests locaux historiques rouges ont été réparés.

Les cinq commandes PostgreSQL ont été tentées localement, puis refusées par leurs garde-fous hors CI sans base éphémère et opt-ins dédiés ; aucun psql/Docker local disponible. Elles ont ensuite toutes réellement réussi dans le job CI PostgreSQL 17, logs consultés :

- `npm run test:unique-menu-design:postgres` : création, isolation, lifecycle, rollback PASS.
- `npm run test:translation:backfill:postgres` : PASS.
- `npm run test:maison-elyse-postgres` : migration, sécurité, atomicité, CAS, concurrence PASS.
- `npm run test:qr:postgres` : historique, sécurité, RPC, rotation, concurrence PASS.
- `npm run test:media-capacity:postgres` : PASS.

La [preview Vercel](https://vistaire-nvuzggztw-capoships-projects.vercel.app) du même commit est READY (`dpl_GqFSn4LKGeXpPvKKx2efysyytC2o`, région iad1). Le connecteur de build logs répond `Tool get_deployment_build_logs not found`. La récupération HTTP protégée renvoie une redirection SSO pour `/`, puis « Vercel could not provide access » pour `/demo` et la config Model Lab. Le statut de build est vérifié, mais aucun smoke fonctionnel distant authentifié ni taille compressée de fonction déployée n'est revendiqué. Les erreurs runtime agrégées du projet consultées à la baseline étaient vides ; ce n'est pas une preuve propre à cette preview.

Le commit final ajoute seulement la documentation de ces résultats ; le SHA ci-dessus identifie exactement le code exécuté dans les campagnes locales et distantes.

## Limites, nettoyage et périmètre

- `npm run test:e2e -- --list` n'a pas permis de collecter toute la suite en bloc : `VISTAIRE_FINAL_QA_BASE_URL` manquante, preview gate exigeant une origine sans port explicite. Une tentative initiale avait aussi rencontré le port local 3137 déjà occupé ; les campagnes suivantes utilisent explicitement le serveur existant. Les groupes hermétiques pertinents ont été exécutés séparément. Les tests live nécessitant une vraie preview accessible ne sont pas déclarés réussis.
- Neuf échecs Node et quatre timeouts admin locaux préexistants restent visibles. Quatre tests natifs USDZ sont ignorés faute de toolchain. Auth Clerk réelle et AR physique non validés.
- Pas de mesure synthétique de performance : aucune régression évidente observée sur les parcours testés, mais pas de benchmark RUM/Lighthouse contrôlé.
- Serveurs/fixtures lancés par cette tâche arrêtés. `.next`, `test-results`, captures/diagnostics temporaires et logs de travail supprimés après transcription des preuves. Aucun fichier temporaire de QA ajouté à Git.
- L'ajout automatique de dix lignes dans AGENTS.md par Next dev a été retiré après vérification qu'il était le seul changement de ce fichier. Le fichier utilisateur dans le checkout initial n'a pas été touché.
- Diff et `git status --short` revus ; aucun `.env`, secret, asset généré, média lourd, console/debugger de diagnostic ou modification E2E n'a été ajouté. Les worktrees sont conservés pour inspection, sans nettoyage destructif du travail utilisateur.
- Diff limité au retrait de code prouvé inactif, aux tests associés, à deux dépendances inutilisées, au packaging Model Lab et aux rapports demandés. Aucun merge effectué.
