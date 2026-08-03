# CI/CD de Vistaire

Le workflow requis pour les pull requests est **CI Gate**
(`.github/workflows/app-ci.yml`). Il démarre toujours, y compris pour une
modification documentaire, et refuse une classification invalide, un job
pertinent en échec, annulé ou absent.

## Sélection des jobs

`classify-changes` exécute `scripts/ci/detect-changes.mjs` et publie une sortie
booléenne stable pour chaque famille (`database`, `landing`, `menu_shared`,
`sauge_renderer`, `pageflip_gestures`, `admin`, `qr`, `seo`, etc.). Un fichier
inconnu force `full_ci=true`. Les changements sur `main`, `merge_group`, le
lockfile, l’infrastructure CI et un dispatch `full` sont exhaustifs.

Les jobs applicatifs sont indépendants et s’exécutent en parallèle :
`static-quality`, `database-contracts`, `build-app`, puis les groupes `e2e-*`
et `webkit-critical`. `build-app` compile une seule fois avec la fixture
Supabase hermétique, puis publie l’artefact `.next` pour les groupes navigateur.
Cette fixture est nécessaire car Next incorpore les variables `NEXT_PUBLIC_*`
dans le bundle serveur au build. Les rapports Playwright en échec sont conservés
sept jours.

## Événements et dispatch manuel

Les PR utilisent le mode `targeted`. `push` sur `main`, `merge_group` et le
workflow [Nightly exhaustive CI](../.github/workflows/nightly.yml) valident
toutes les familles. Le bouton manuel propose exactement : `targeted`, `full`,
`sauge`, `database`, `admin_qr`, `landing`, `seo`. Un choix manuel ne réduit
jamais les contrôles obligatoires d’une PR.

## Protection de branche et merge queue

Après observation de plusieurs runs verts, rendre **CI Gate** obligatoire dans
la règle de branche `main` et activer la merge queue avec la même règle.
Conserver `contents: read`; ne pas ajouter de permission d’écriture au workflow
de validation. La mise à jour des règles GitHub reste une opération manuelle.

## Diagnostic

Le résumé de chaque run contient l’événement, les catégories, les fichiers
modifiés, les jobs attendus et leur résultat. En cas d’échec, commencer par le
job de famille signalé, télécharger son artefact `*-failure-*`, puis vérifier la
classification. Pour reproduire une branche entière, lancer `full`; pour une
suite spécialisée, sélectionner sa cible dédiée. Les budgets de durée sont des
indicateurs et ne transforment pas un run lent en succès silencieux.
