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

La nouvelle architecture vise un build uploadé une fois, un processus par groupe
Playwright, une installation WebKit uniquement dans `webkit-critical` et des
familles Sauge conditionnelles. Le run de référence `30779748386` est vert
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
- `menu` : smoke générique + preuve Sauge critique courte pour les composants
  réellement partagés; la suite profonde appartient à `e2e-sauge-deep` quand
  `run_sauge=true`;
- `sauge` : smoke + scroll, swipe, contents-single-flip et static parity;
- `webkit` : contents-single-flip et static parity sous WebKit;
- `admin-qr` et `seo` : scripts Node/fixtures existants sans Sauge profond.

Aucun fichier `e2e/` n’a été supprimé. Les suites Sauge profondes sont déplacées
du job séquentiel historique vers `e2e-sauge-deep` et `webkit-critical`; les
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
protection de branche GitHub, service PostgreSQL 17, taille/temps d’upload de
l’artefact `.next` sur un run propre et validation réelle Safari/iPhone.
