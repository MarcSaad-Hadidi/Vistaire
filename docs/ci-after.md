# Rapport CI après la PR #177

## Baseline réellement vérifiée

Les références ont été contrôlées sur la branche existante
`ci/production-grade-pipeline` :

- head : `e7a0466755a46b03826c7fca0f8a5ed3a42df080` ;
- App CI run : `30779748386` ;
- Full CI : `success` ;
- CI Gate : `success` ;
- PostgreSQL 17 : `success` ;
- Chromium : `success` ;
- WebKit : `success` ;
- Vercel Preview : `READY` (statut fourni par le run de référence) ;
- ancienne médiane : 15 min 08 s ;
- nouveau full CI annoncé : environ 5 min 33 s ;
- gain mural annoncé : environ 63 %.

L'API GitHub donne 339 s entre le premier et le dernier job de ce run
(environ 5 min 39 s, les horodatages sont arrondis). La différence avec 5 min
33 s vient de la mesure murale retenue dans le rapport de déploiement.

Mesures cumulées observées sur les jobs du run 30779748386 :

| Mesure | Valeur | Méthode |
| --- | ---: | --- |
| Temps mural | 339 s | premier `started_at` → dernier `completed_at` |
| Temps runner brut | 1 042 s (17,37 min) | somme des durées de jobs |
| Estimation de facturation | ~24 runner-min | arrondi par job, hors règles de quota |
| `npm ci` cumulé | 167 s | étapes `Install dependencies` |
| Installations navigateurs cumulées | 170 s | Chromium + WebKit |
| Upload `.next` | 6 s | `Upload verified Next.js build` |
| Downloads `.next` | 22 s | étapes `download-artifact` |

Le checkout du classificateur de cette baseline a consommé environ 28 s avec
`fetch-depth: 0`.

## Nouveau full CI publié et vérifié

Après correction de l'authentification du fetch borné, le head de code mesuré
est :

- head : `d26c6390c6455607ca18c93d67439731939ca93e` ;
- App CI run : `30788750665` ;
- Full CI : `success` ;
- CI Gate : `success` ;
- PostgreSQL 17 : `success` ;
- Chromium : `success` ;
- WebKit : `success` ;
- Asset Policy : `30788750675`, `success` ;
- CodeQL : `30788750672`, `success` ;
- Vercel Preview : `success`, `https://vistaire-kakblh48y-capoships-projects.vercel.app`.

Mesures réelles du run `30788750665` :

| Mesure | Valeur | Méthode |
| --- | ---: | --- |
| Temps mural run | 343 s (5 min 43 s) | création du run → fin du Gate |
| Fenêtre jobs | 343 s | premier job → dernier job terminé |
| Temps runner brut | 1 073 s (17,88 min) | somme des durées de jobs |
| Estimation de facturation | ~25 runner-min | arrondi par job |
| `npm ci` cumulé | 159 s | étapes d'installation |
| Installations navigateurs | 239 s | six Chromium + un WebKit |
| Upload `.next` | 6 s | `Upload verified Next.js build` |
| Downloads `.next` | 22 s | `download-artifact` |
| Checkout classifier | 11 s | étape `Checkout` |
| Fetch PR graph | 4 s | `Fetch minimal PR graph for merge-base` |

Le log GitHub confirme `PR graph ready: merge-base found after additional depth
32`. Le fetch borné a donc été exécuté avec succès sur une vraie PR et n'a pas
déclenché le fallback d'absence de graphe. Ce run reste exhaustif parce que
cette PR modifie l'infrastructure CI et le graphe de dépendances ; il ne prouve
pas encore les branches ciblées minimales.

Le commit documentaire `19347ad3df9b6d5a5cb922545b90ddec93b6608c` qui porte ce
rapport a ensuite été validé par l'App CI `30789181292`, l'Asset Policy
`30789181259`, CodeQL `30789181264` et le Preview Vercel
`https://vistaire-50ofo0i9c-capoships-projects.vercel.app`, tous en succès. Le
fetch merge-base y est également `PR graph ready`; la matrice reste exhaustive
pour la même raison d'infrastructure.

## Preuves de ciblage disponibles

Les tests locaux couvrent maintenant le merge-base (main avancé, branche SEO,
fichier main-only exclu, rename et suppression), l'allowlist `docs_only` et la
liste exacte des sorties `run_*`. La matrice déterministe est :

| Scénario | Sorties `run_*` vraies |
| --- | --- |
| Documentation | aucune |
| SQL | `run_static`, `run_database` |
| Traduction | `run_static`, `run_database`, `run_build`, `run_menu` |
| QR | `run_static`, `run_database`, `run_build`, `run_admin_qr` |
| SEO | `run_static`, `run_build`, `run_seo` |
| Landing | `run_static`, `run_build`, `run_core`, `run_landing` |
| Menu partagé | `run_static`, `run_build`, `run_menu` |
| Sauge/PageFlip | `run_static`, `run_build`, `run_menu`, `run_sauge`, `run_webkit` |
| push `main`, merge queue, nightly, infrastructure | toutes |

Ces résultats sont des preuves de classification et de contrats locaux, pas
des runs GitHub Actions ciblés. Aucun PR ou branche synthétique distante n'a
été créé depuis cet environnement : les temps muraux et runner-minutes de ces
scénarios restent donc **non vérifiés**. Il ne faut pas présenter le ciblage
comme optimal avant ces runs réels.

## Benchmarks ciblés locaux

Les groupes ci-dessous ont été exécutés avec la fixture hermétique. Ils mesurent
la commande locale (pas des runner-minutes GitHub) et ne remplacent pas les PR
synthétiques demandées :

| Scénario | Fichiers représentatifs | Sorties | Jobs attendus / ignorés | Preuve locale |
| --- | --- | --- | --- | --- |
| Documentation | `README.md` | aucune | `classify-changes`, `CI Gate` / tous les jobs applicatifs | contrat 43/43; aucun navigateur ou `npm ci` |
| SQL | `supabase/migrations/20260101_menu.sql` | `run_static`, `run_database` | static, PostgreSQL / build et tous les navigateurs | matrice 43/43; PostgreSQL distant non disponible |
| Traduction | `content/translations/en.json` | static, database, build, menu | static, PostgreSQL, build, menu / Sauge profond, WebKit, landing, SEO, QR | contrats de traduction et de politique locaux |
| QR | `app/api/owner/qr-codes/route.ts` | static, database, build, admin_qr | static, PostgreSQL, build, admin/QR / Sauge, WebKit | contrats Node QR 196/196; E2E distant non lancé |
| SEO | `app/seo/page.tsx` | static, build, SEO | static, build, SEO / Sauge, WebKit, landing | SEO Node 40/40; E2E distant non lancé |
| Landing | `app/(landing)/page.tsx` | static, build, core, landing | static, build, core, landing / Sauge profond, WebKit | Chromium landing 19/19 en 31 s |
| Menu partagé | `components/menu/MenuCard.tsx` | static, build, menu | static, build, menu + smoke Sauge critique court / Sauge profond, WebKit | Chromium 7/7 en 87 s avec build hermétique |
| Sauge/PageFlip | `components/menu/unique/sauge-noire/Renderer.tsx` | static, build, menu, Sauge, WebKit | static, build, menu, Sauge profond, WebKit / landing, SEO, QR | Sauge Chromium 70/70 en 134 s; WebKit 10/10 en 80 s |

Pour ces validations locales, `CI Gate` est vérifié par la matrice de politique
et les contrats fail-closed; aucun résultat GitHub `CI Gate` ciblé ne peut être
affirmé tant qu'un run distant n'a pas été créé.

## Contrats E2E et fixtures

Le bypass `VISTAIRE_E2E_LANDING_CANONICAL` a été supprimé du code produit et du
runner. La fixture Maison Élyse fournit désormais le chemin normal : locale,
statuts `source`/`up_to_date`, traductions anglaises, hashes de contenu et de
photos, renderer Maison Élyse et payload attendu. Les contrats fixture,
landing/i18n et les suites Node correspondantes passent localement.

`e2e-public-chromium` conserve le smoke commun `sauge-noire-menu-shared-smoke`:
démo générique (menu/plat/retour), Trouvable (catégories, langue, photo ou
fallback, plat/retour) et une navigation Sauge Noire critique courte. Le groupe
réutilise une seule installation Chromium, la fixture Supabase et le serveur;
il ne lance pas la suite Sauge profonde. `e2e-sauge-chromium` et
`e2e-admin-qr-chromium` restent spécialisés, tandis que `webkit-critical`
conserve WebKit isolé.
Le WebKit Sauge est conditionné par `run_webkit` et ne peut donc plus être
déclenché par une simple modification landing, SEO, QR, SQL, admin ou menu
partagé.

## Vérifications restantes

- des branches/PR synthétiques minimales pour chaque scénario ciblé ;
- validation réelle d'un appareil Safari/iPhone et de la merge queue.

Les checks locaux complets et le nettoyage final doivent être relancés avant
de déclarer la PR prête. Le merge de #177 reste volontairement hors périmètre.

## Continuation sur le head synchronisé

La branche a ensuite intégré `origin/main` par le merge non destructif
`292202b01ceee24b7e39ac38b4a760b63ddffcc6`. La baseline distante la plus
récente avant cette continuation reste App CI `30789584185` sur `1c6382e` :

| Mesure | Valeur vérifiée |
| --- | ---: |
| Fenêtre murale | 369 s |
| Temps runner brut | 1 285 s |
| Estimation minimale facturable | 22 runner-min (environ 25 min avec l'arrondi par job) |
| Installations de dépendances | 10 occurrences (7 étapes nommées `Run npm ci`), 108 s cumulées mesurées pour ces 7 étapes |
| Navigateurs | 6 Chromium + 1 WebKit, 164 s cumulées |
| Artefact `.next` | 65 349 631 octets |
| Upload `.next` | 6 s |
| Downloads `.next` | 7 occurrences, 35 s cumulées |
| Fetch du graphe PR | 4 s |
| Profondeur merge-base | 33 objets (fetch initial 1 + deepen 32) |

Cette continuation ajoute un `fast-gate` sans npm, rend les dépendances E2E
explicites, centralise les diagnostics de cause racine et publie un artefact
`ci-metrics.json`. Elle supprime les répétitions Asset Policy/QR/admin/SEO et
le smoke Sauge partagé en double. Les gains de runner-minutes et les scénarios
targeted distants doivent encore être mesurés sur de vrais runs après push ; ils
ne sont pas déduits de la baseline full CI.

Le Preview existant associé à `1c6382e` était `READY`, mais ses routes étaient
protégées par le SSO Vercel dans cet environnement. Le `Preview Gate` vérifie
donc le secret de bypass officiel avant d'exécuter une page distante. S'il est
absent de l'environnement protégé, le gate échoue explicitement et aucune
requête protégée n'est exécutée : un contrôle nommé Gate ne peut pas être vert
sans smoke réel. Le runbook d'administration est
[`docs/qa/preview-gate-runbook.md`](qa/preview-gate-runbook.md).

## Validation locale de cette continuation

Les contrôles exécutés après les derniers ajustements sont :

| Contrôle | Résultat |
| --- | --- |
| `assets:check` | passé, 1 528 fichiers inspectés |
| `lfs:check` | passé, aucun pointeur actif |
| `lint` | passé |
| `typecheck` | passé |
| `build` hermétique avec fixture Supabase | passé |
| contrats CI/Preview/QR/config | 72/72 |
| QR Node | 196/196 |
| admin Node | 388/388 |
| SEO Node | 40/40 |
| Chromium CI smoke | 3/3 |
| Chromium landing ciblé | 19/19 |
| Chromium Sauge critique | 4/4 |
| Chromium SEO simulé localement | 3/3 |
| Preview smoke local hermétique | 10/10 |
| QR fonctionnel sensible | premier passage 6/7 (timeout PATCH), puis rerun frais 7/7 |

La suite brute `node --test tests/*.test.mjs` a été tentée mais a dépassé la
limite de 300 secondes; elle n'est donc pas déclarée comme passée. Le test de
transfert de configuration qui échouait après la synchronisation `origin/main`
a été corrigé pour accepter `uniqueDesign: null` dans un export design-only,
puis validé en 5/5.

`npm ci` a rencontré un verrouillage `EPERM` du cache npm utilisateur puis un
`ENOTEMPTY` sur un dossier `node_modules` tenu par des processus existants. Une
restauration de validation isolée avec `npm install --legacy-peer-deps
--ignore-scripts --package-lock=false` a réussi; `package-lock.json` n'a pas
changé. Le cache temporaire a été supprimé.

Chromium a été installé dans le cache Playwright local pour les smoke tests.
Les exécutions Vercel, les probes GitHub distantes, actionlint/zizmor et la
merge queue restent non vérifiés ici; aucun run ou artefact distant n'est
inventé dans ce rapport.

## Vérification distante de la continuation #177

Après les corrections d’encodage et de sécurité, le head distant est
`56b9b73269eda4285648bdb0f1345a32c7406e26` (commit sans force-push). Les runs
réels suivants sont verts:

- App CI `30853839277` (classification, fast-gate, static, PostgreSQL, build,
  quatre familles navigateur, CI Gate et CI metrics);
- Workflow Security `30853839402` (actionlint, zizmor, npm audit baseline);
- CodeQL Advanced `30853839482`;
- Asset Policy `30853839425`.

Les rapports E2E du run App CI totalisent 111 tests: 28 public Chromium,
66 Sauge Chromium, 7 Admin QR Chromium et 10 WebKit, tous passés, sans skip,
flaky ni interruption. L’artefact `ci-metrics-30853839277` (ID `8871794612`,
digest `f0b4f3a0bd0a5e1850d9f274d6f86fa0dd9b04ec3f4de96ee48c6c966d8a3acb`)
est archivé par GitHub.

Ces preuves valident la topologie à 7 `npm ci`, 3 installations Chromium,
1 WebKit et 4 downloads `.next` sur un run complet. Elles ne prouvent pas
encore les huit PR probes synthétiques, un Preview Gate protégé avec le secret
Vercel, la merge queue, une validation iPhone/Safari réelle ou une review
humaine. La PR reste donc draft et aucun merge automatique n’a été effectué.
