# CI/CD de Vistaire

Le workflow requis pour les pull requests est **CI Gate**
(`.github/workflows/app-ci.yml`). Il démarre toujours et refuse une
classification invalide, un job attendu en échec, annulé, absent ou sauté.

## Fast gate and dependency barrier

`fast-gate` validates the classifier, workflow contracts, and CI scripts without
running `npm ci` or installing a browser. Browser jobs explicitly require
successful `classify-changes`, `fast-gate`, `static-quality`, and `build-app`
results; a failed root job therefore produces downstream skips instead of
secondary browser failures. `Asset Policy` remains independent and owns the
only `assets:check` and `lfs:check` invocations. The Preview workflow contract
is owned by `fast-gate` through `test:preview-workflow-contract`; the landing
contract remains landing-only so the Preview contract is not executed twice.

The separate `CI metrics` job publishes a machine-readable `ci-metrics.json`
artifact and a human-readable summary from that same file. It records the
wall-clock window, raw runner-seconds, billed-minute estimate,
npm/browser/artifact timings, skipped jobs, first failure, root failure, and
merge-base depth. Browser jobs publish structured Playwright JSON reports;
`failed_tests` and the passed/failed/skipped/flaky/interrupted totals are only
reported when those reports are available. Missing API fields are listed in
`data_quality.fields_unavailable`; they are never represented by ambiguous
`null` values. A temporary GitHub API failure leaves the job non-blocking but
sets `collection_complete` to `false` and records a warning.

`Preview Gate` and `Production Smoke` listen to `deployment_status`, verify the
environment and exact deployment SHA, and run a smoke harness checked out from
trusted `main`. Preview validation uses the official Vercel bypass secret when
it is configured in the protected `preview-gate` environment. If that secret is
not configured, Preview Gate fails closed with an explicit error and does not
execute the remote smoke; it never reports a green gate without a test. No
protected secret is passed to PR code. The exact administrator setup is
documented in [`docs/qa/preview-gate-runbook.md`](qa/preview-gate-runbook.md).

## Source de vérité du ciblage

`classify-changes` exécute `scripts/ci/detect-changes.mjs` et publie les
catégories ainsi que les sorties stables `run_static`, `run_database`,
`run_build`, `run_core`, `run_landing`, `run_menu`, `run_sauge`,
`run_admin_qr`, `run_seo` et `run_webkit`. Les conditions des jobs et CI Gate
consomment uniquement ces sorties ; aucune matrice de catégories n'est
réimplémentée dans le gate.

Pour une pull request, le diff est calculé entre le merge-base réel de la base
et de la tête et la tête. Le checkout est borné et
`scripts/ci/fetch-pr-graph.mjs` récupère seulement le graphe nécessaire. Si le
merge-base ne peut pas être obtenu, le classificateur passe en `full_ci=true`.
Les chemins inconnus, l'infrastructure CI, les dépendances, `main`,
`merge_group` et le nightly sont exhaustifs.

`docs_only` est une allowlist explicite : `README.md`, `CONTRIBUTING.md`,
`SECURITY.md`, `docs/**` et `documentation/**`. Une extension Markdown/TXT dans
`app/`, `content/` ou `fixtures/` reste du runtime.

## Familles et navigateurs

Les jobs applicatifs sont indépendants et s'exécutent en parallèle. `build-app`
compile une fois avec la fixture Supabase hermétique puis publie `.next`.
Static et PostgreSQL n'installent aucun navigateur. Chromium est installé
uniquement par les familles Chromium ; WebKit uniquement par `webkit-critical`.

Le groupe `e2e-public-chromium` regroupe conditionnellement core, landing, SEO
et `e2e/sauge-noire-menu-shared-smoke.spec.ts` avec une seule installation
Chromium, une seule fixture Supabase et un seul download `.next`. Le smoke menu
couvre le parcours menu → plat → retour de la démo générique, le menu Trouvable
(catégories, changement de langue, photo/fallback, ouverture et retour) et un
parcours Sauge Noire critique court; les rapports restent distincts par famille
avant agrégation. `e2e-sauge-chromium` conserve les suites Sauge profondes,
`e2e-admin-qr-chromium` garde les contrats QR sensibles et `webkit-critical`
reste isolé. Le full CI cible ainsi sept `npm ci`, trois installations
Chromium, une installation WebKit et quatre downloads `.next`; cette topologie
a été confirmée par le run GitHub `30853839277`.

Sur ce run réel, les rapports structurés ont compté 28 tests public Chromium,
66 tests Sauge Chromium, 7 tests QR et 10 tests WebKit: 111 passés, 0 échoué,
0 ignoré, 0 flaky et 0 interrompu. L’artefact `ci-metrics-30853839277`
(`8871794612`) contient le JSON machine-readable et le résumé humain provient
du même fichier. Les runner-minutes et la fenêtre murale doivent être lus dans
cet artefact pour chaque run; ils ne sont jamais déduits du seul nombre de
jobs.

## Événements et dispatch manuel

Les PR utilisent le mode `targeted`. `push` sur `main`, `merge_group` et le
workflow [Nightly exhaustive CI](../.github/workflows/nightly.yml) valident
toutes les familles. Le dispatch propose `targeted`, `full`, `sauge`,
`database`, `admin_qr`, `landing` et `seo` ; une cible invalide est fail-closed.

## Diagnostic

Le résumé de chaque run contient l'événement, les catégories, le diff, les
sorties `run_*` et le résultat de chaque job. Les artefacts Playwright en échec
sont conservés sept jours. Les temps muraux, runner-minutes, `npm ci`,
navigateurs et artefacts `.next` doivent être mesurés séparément ; une
réduction du temps mural ne justifie pas à elle seule un regroupement de jobs.

La protection de branche, la merge queue, le merge de #177 et le déploiement
Vercel restent des opérations distinctes du workflow de validation.
