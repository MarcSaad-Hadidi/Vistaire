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

Le commit de cette révision a été publié sur la branche de la PR :

- head : `8eee0c93aa2f82759d18729beacd9561a2b269e6` ;
- App CI run : `30787239845` ;
- Full CI : `success` ;
- CI Gate : `success` ;
- PostgreSQL 17 : `success` ;
- Chromium : `success` ;
- WebKit : `success` ;
- Asset Policy : `30787239761`, `success` ;
- CodeQL : `30787239782`, `success` ;
- Vercel Preview : `success`, `https://vistaire-qpndg2myq-capoships-projects.vercel.app`.

Mesures réelles du run `30787239845` :

| Mesure | Valeur | Méthode |
| --- | ---: | --- |
| Temps mural run | 302 s (5 min 02 s) | création du run → fin du Gate |
| Fenêtre jobs | 298 s | premier job → dernier job terminé |
| Temps runner brut | 998 s (16,63 min) | somme des durées de jobs |
| Estimation de facturation | ~24 runner-min | arrondi par job |
| `npm ci` cumulé | 159 s | étapes d'installation |
| Installations navigateurs | 156 s | six Chromium + un WebKit |
| Upload `.next` | 6 s | `Upload verified Next.js build` |
| Downloads `.next` | 19 s | `download-artifact` |
| Checkout classifier | 10 s | étape `Checkout` |
| Fetch PR graph | 1 s | `Fetch minimal PR graph for merge-base` |

Le fetch borné a donc été exécuté avec succès sur une vraie PR et n'a pas
déclenché le fallback full CI. Ce run est exhaustif parce que cette PR modifie
l'infrastructure CI; il ne prouve pas encore les branches ciblées minimales.

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

`e2e-menu-shared` conserve uniquement le smoke commun et la preuve Sauge
critique courte d'un composant partagé; il ne lance pas la suite Sauge profonde.
Le WebKit Sauge est conditionné par `run_webkit` et ne peut donc plus être
déclenché par une simple modification landing, SEO, QR, SQL, admin ou menu
partagé.

## Vérifications restantes

- des branches/PR synthétiques minimales pour chaque scénario ciblé ;
- validation réelle d'un appareil Safari/iPhone et de la merge queue.

Les checks locaux complets et le nettoyage final doivent être relancés avant
de déclarer la PR prête. Le merge de #177 reste volontairement hors périmètre.
