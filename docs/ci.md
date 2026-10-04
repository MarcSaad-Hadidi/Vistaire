# CI de Vistaire

Le check requis **CI Gate** appartient à [App CI](../.github/workflows/app-ci.yml).
Il refuse une classification invalide ou un job attendu en échec, absent,
annulé ou sauté. [Asset Policy](../.github/workflows/asset-policy.yml), Security
et CodeQL restent des workflows indépendants.

## Ciblage

`scripts/ci/detect-changes.mjs` est la source de vérité des familles. Les jobs
et le gate consomment ses sorties `run_*`, sans recopier la classification.
Pour une PR, le diff va du merge-base réel à la tête ; le graphe est récupéré
par `scripts/ci/fetch-pr-graph.mjs`. Un merge-base indisponible, un chemin
inconnu ou un changement de CI/dépendances déclenche la validation complète.

Les PR utilisent `targeted`. Les événements `push` sur `main`, `merge_group`
et [Nightly](../.github/workflows/nightly.yml) exécutent toutes les familles.
Le dispatch manuel propose `targeted`, `full`, `sauge`, `database`, `admin_qr`,
`landing` et `seo`. Une cible inconnue est refusée.

Le mode documentation seule accepte uniquement les chemins explicitement
listés par le classificateur. Un Markdown sous `app/`, `content/` ou
`fixtures/` reste du runtime.

## Validation

La CI utilise Node 24 et `npm ci` avec `package-lock.json`.

| Job | Responsabilité |
| --- | --- |
| `fast-gate` | Contrats CI/classification/scripts sans installation npm ni navigateur. |
| `static-quality` | ESLint, TypeScript, frontières publiques et suite `npm run test:node`. |
| `database-contracts` | Cinq suites sur PostgreSQL 17.10 éphémère : QR, Maison, design unique, traduction et capacité média. |
| `build-app` | Un build Next.js contre la fixture Supabase hermétique, contrôles de prerender et artefact `.next`. |
| `e2e-public-chromium` | Core, landing, menus Maison/Trouvable/Sauge/générique et SEO selon le ciblage. |
| `e2e-sauge-chromium` | Gestes, scroll, pages, viewport, géométrie, médias et handoffs Sauge. |
| `e2e-admin-qr-chromium` | QR fonctionnel et édition du menu admin. |
| `webkit-critical` | Parcours publics critiques et édition du menu admin sous WebKit. |

Les jobs navigateur attendent `classify-changes`, `fast-gate`,
`static-quality` et `build-app`. Ils téléchargent le build vérifié et
installent uniquement le navigateur nécessaire. Asset Policy possède les
commandes `npm run assets:check` et `npm run lfs:check`.

Les commandes locales correspondantes sont dans `package.json` :
`test:ci:e2e:core`, `test:ci:e2e:landing`, `test:ci:e2e:menu`,
`test:ci:e2e:sauge`, `test:seo:e2e`, `test:qr:functional`,
`test:admin:full-menu` et `test:ci:e2e:webkit`. Les runners fournissent leurs
fixtures locales ; les suites PostgreSQL exigent une base éphémère et leurs
opt-ins explicites. Les procédures admin sont dans
[admin-restaurant-e2e.md](admin-restaurant-e2e.md).

## Déploiements et sécurité

Preview Gate et Production Smoke écoutent `deployment_status`, vérifient
l'environnement et le SHA exact, puis exécutent le harness de `main` fiable.
Les secrets protégés ne sont pas transmis au code de PR. Preview Gate refuse
le smoke distant si le secret officiel de bypass Vercel manque ; le
[runbook Preview Gate](qa/preview-gate-runbook.md) décrit la configuration.

L'audit npm et les protections de supply chain suivent
[ci-supply-chain.md](ci-supply-chain.md). Les exceptions de vulnérabilité sont
temporaires, documentées et contrôlées contre le checksum du lockfile.

## Diagnostic

Le résumé de chaque run donne le SHA, l'événement, le diff, les catégories,
les sorties `run_*` et les résultats. Les rapports Playwright structurés
consignent les tests réussis, échoués, ignorés, instables et interrompus ;
les diagnostics d'échec sont conservés sept jours.

`CI metrics` publie `ci-metrics.json` et un résumé issu du même fichier :
fenêtre murale, temps runner, installations, artefacts, premiers échecs et
profondeur du merge-base. Une donnée indisponible est explicitement signalée.
Une erreur de collecte laisse `collection_complete=false` avec son diagnostic.
Les résultats et durées se lisent sur le run concerné, sans reprendre les
anciens comptages comme preuve du head actuel.

La validation CI, les protections de branche, le merge et le déploiement
restent des opérations distinctes.
