# CI/CD de Vistaire

Le workflow requis pour les pull requests est **CI Gate**
(`.github/workflows/app-ci.yml`). Il démarre toujours et refuse une
classification invalide, un job attendu en échec, annulé, absent ou sauté.

## Contrôles indépendants

`fast-gate` validates the classifier, workflow contracts, and CI scripts without
running `npm ci` or installing a browser. Browser jobs require only successful
`classify-changes` and `build-app` results. Static checks remain blocking in
`CI Gate` and run independently. `Asset Policy` remains independent and owns the
only `assets:check` and `lfs:check` invocations. `fast-gate` runs the CI and
Preview workflow contracts without `npm ci`; `static-quality` then runs every
`tests/*.test.mjs` file once through `npm run test:node`.

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
Les chemins inconnus, l'infrastructure CI, les dépendances, `main` et
`merge_group` sélectionnent toutes les familles critiques. Le nightly et le
dispatch `full` exécutent tous leurs scénarios.

`docs_only` est une allowlist explicite : `README.md`, `CONTRIBUTING.md`,
`SECURITY.md`, `docs/**` et `documentation/**`. Une extension Markdown/TXT dans
`app/`, `content/` ou `fixtures/` reste du runtime.

## Familles et navigateurs

Après classification, les contrôles statiques, PostgreSQL et le build démarrent
indépendamment. `build-app` compile une fois avec la fixture Supabase hermétique
puis publie `.next` sans son cache de compilation. Les navigateurs attendent
uniquement ce build ; les contrôles statiques restent obligatoires dans `CI Gate`.

Les PR sélectionnent uniquement les scénarios existants marqués `@critical`,
parmi les familles concernées par le diff. Une modification SEO ne sélectionne
pas les menus, Sauge Noire ou les QR privés, même si son chemin contient « QR ».
Les changements de navigation partagée gardent leurs contrôles communs.

Le smoke des tarifs contrôle le calculateur et le clavier à 390 px, puis
l'absence de débordement et les cibles tactiles à 390/430 px. Les autres
redimensionnements du décor 3D restent réservés aux lancements exhaustifs.

Le pool Chromium public utilise 6 shards, WebKit 2, Sauge un job et Studio un
job par navigateur. Chaque test sélectionné est exécuté une seule fois par
navigateur. Les contrôles QR sensibles restent complets dans le job Studio
Chromium. Au maximum 11 jobs navigateur tournent en parallèle. Le cache de
compilation Next.js est réutilisé entre builds et reste exclu de l'artefact
transféré aux navigateurs.

Le nightly et le dispatch `target: full` exécutent les suites exhaustives,
y compris les variantes de thèmes, formats et chorégraphies 3D. Les PR et les
autres lancements conservent les contrôles statiques, sécurité et contrats SQL
applicables, avec les parcours navigateur critiques uniquement.

Chaque shard publie son rapport structuré et ses éléments de diagnostic. Les
rapports sont agrégés sans masquer les échecs, interruptions ou tests ignorés.
`CI Gate` attend tous les contrôles applicables. Le temps mural et les
runner-minutes proviennent des métriques du run GitHub ; la parallélisation ne
garantit pas à elle seule la cible de cinq minutes, notamment en cas de file
d'attente des runners.

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
