# Baseline et plan de mesure CI/CD

Cette baseline a été établie avant la refonte à partir de 18 runs GitHub Actions
réels sur `origin/main` et des PR récentes (runs `30768650167`, `30774597469`,
`30772744206` et `30771282845` inclus). Les horodatages GitHub sont arrondis à
la seconde et ne constituent pas un benchmark local.

| Mesure | Observé |
| --- | ---: |
| Job App checks (médiane) | 15 min 08 s |
| Job App checks (min–max) | 10 min 50 s–15 min 51 s |
| Provisioning | 22–31 s |
| Checkout | 11–13 s |
| `npm ci` | 12–16 s |
| Installation WebKit | 30–51 s, même sans impact navigateur |
| Lint / typecheck | 22–29 s / 11–14 s |
| Build Next.js | 28–35 s |
| Sauge Noire séquentiel | 6 min 45 s–8 min 17 s (52–55 %) |
| Builds Next.js | 2 (le runner reconstruisait la landing photo) |
| Serveurs Next.js | 11 cycles par run complet |
| Fixtures Sauge | 9 cycles; fixture QR fonctionnelle supplémentaire |
| Premier échec utile | environ 6 min 03 s dans l’exemple analysé |
| Travail après le premier échec | environ 9 min 15 s dans ce run |

La nouvelle architecture vise un build uploadé une fois, un processus public
Chromium regroupant core/landing/menu/SEO, un job Sauge Chromium, un job QR
Chromium et une installation WebKit uniquement dans `webkit-critical`. Le run
de référence `30779748386` est vert
(environ 5 min 33 s annoncées, contre une médiane historique de 15 min 08 s),
mais les scénarios ciblés de cette nouvelle politique restent à exécuter sur
GitHub avant de conclure sur le coût total.

## Matrice événement → validation

| Événement | Classification | Validation attendue |
| --- | --- | --- |
| `pull_request` | fichiers impactés, fail-closed | statique, build, DB et familles ciblées; `CI Gate` |
| `push` sur `main` | exhaustive | toutes les familles, Chromium et WebKit |
| `merge_group` | exhaustive | toutes les familles sur le commit synthétique |
| nightly | `workflow_call` avec `full` | toutes les familles + rapport nocturne bloquant |
| dispatch `targeted` | diff disponible ou full si incertain | cible calculée, sans affaiblir une PR |
| dispatch `full`/famille | cible explicite validée | famille demandée; cible invalide = full CI |

## Groupes Playwright et preuves conservées

Les scripts locaux historiques restent disponibles. Les scripts `test:ci:e2e:*`
regroupent les specs partageant le même serveur et la même fixture :

- `core` : landing, démo hermétique, admin protégé, robots/sitemap et responsive 390/430 px;
- `landing` : production photo et redesign;
- `e2e-public-chromium` : core, landing, menu et SEO selon les sorties `run_*`,
  avec une installation Chromium et des rapports par famille;
- `e2e-sauge-chromium` : smoke + scroll, swipe, contents-single-flip et static
  parity;
- `webkit` : contents-single-flip et static parity sous WebKit;
- `e2e-admin-qr-chromium` et SEO : scripts/fixtures existants sans Sauge
  profond; SEO est exécuté dans le groupe public.

Aucun fichier `e2e/` n’a été supprimé. Les suites Sauge profondes sont déplacées
du job séquentiel historique vers `e2e-sauge-chromium` et `webkit-critical`; les
contrats Node restent dans `static-quality` ou `database-contracts`.

## Rollout, diagnostic et limites

Le changement est prêt pour un rollout shadow : conserver temporairement
l’ancien check dans la protection de branche, comparer plusieurs runs verts,
puis rendre `CI Gate` obligatoire. La modification automatique de la protection
de branche et le merge de la PR restent volontairement hors du workflow.

Les résumés indiquent l’événement, les catégories, les fichiers modifiés et le
résultat de chaque famille. En cas d’échec, commencer par `classify-changes`,
vérifier la décision du gate, puis télécharger l’artefact de la famille fautive.

Non vérifiés dans cet environnement : activation réelle de la merge queue,
protection de branche GitHub, service PostgreSQL 17, taille/temps d'upload de
l'artefact `.next` sur un run propre et validation réelle Safari/iPhone.

## Run distant de la continuation

Le head `56b9b73269eda4285648bdb0f1345a32c7406e26` a été validé par App CI
`30853839277`, Workflow Security `30853839402`, CodeQL `30853839482` et Asset
Policy `30853839425`, tous en succès. App CI a exécuté la topologie attendue:
`e2e-public-chromium`, `e2e-sauge-chromium`, `e2e-admin-qr-chromium` et
`webkit-critical`, puis `CI Gate` et `CI metrics`.

Les rapports structurés publiés par les jobs navigateur sont:

| Groupe | Total | Passés | Échecs | Skips/flaky/interrompus |
| --- | ---: | ---: | ---: | ---: |
| Public Chromium (core/landing/menu/SEO) | 28 | 28 | 0 | 0/0/0 |
| Sauge Chromium | 66 | 66 | 0 | 0/0/0 |
| Admin QR Chromium | 7 | 7 | 0 | 0/0/0 |
| WebKit critique | 10 | 10 | 0 | 0/0/0 |
| Total | 111 | 111 | 0 | 0/0/0 |

L’artefact `ci-metrics-30853839277` (ID `8871794612`, digest
`f0b4f3a0bd0a5e1850d9f274d6f86fa0dd9b04ec3f4de96ee48c6c966d8a3acb`) est
présent et contient les mesures machine-readable. Cette preuve confirme la
topologie et les résultats; elle ne constitue pas une activation de la merge
queue ni une preuve de Preview Gate protégé, qui restent des validations
administratives séparées.
