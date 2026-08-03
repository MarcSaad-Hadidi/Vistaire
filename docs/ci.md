# CI/CD de Vistaire

Le workflow requis pour les pull requests est **CI Gate**
(`.github/workflows/app-ci.yml`). Il démarre toujours et refuse une
classification invalide, un job attendu en échec, annulé, absent ou sauté.

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

`e2e-menu-shared` exécute le smoke menu générique et une preuve Sauge critique
courte pour les composants réellement partagés. La suite Sauge profonde et
les specs PageFlip WebKit ne tournent que pour `full_ci`, Sauge/PageFlip,
l'infrastructure Playwright pertinente, un dispatch Sauge, `main`, la merge
queue ou le nightly. Une modification landing, SEO, QR, SQL, admin ou menu
partagé ne lance pas WebKit Sauge comme proxy.

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
