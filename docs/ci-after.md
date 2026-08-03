# Rapport après modification

## État de cette révision

La refonte est vérifiée localement par les contrats CI, les contrôles npm et
des smoke tests Chromium/WebKit. Aucun run GitHub Actions du nouveau workflow
n’a encore été exécuté depuis cette branche : les temps avant/après et le gain
de l’artefact `.next` restent donc à mesurer dans le rollout shadow.

## Preuves locales

- `npm run assets:check`, `npm run lfs:check`, `npm run lint`, `npm run typecheck`
  et `npm run build` réussissent;
- les contrats CI/classifieur et les contrats ciblés passent : 60 tests Node;
- les contrôles ciblés menu, traductions, médias Maison Élyse, SEO, QR et admin
  passent (les tests locaux externes sont non bloquants lorsqu’un outil manque);
- `test:ci:e2e:core` passe sur le build production partagé avec la fixture
  hermétique;
- un smoke Sauge Chromium et un smoke WebKit (390/430 px) passent;
- le runner ne reconstruit plus implicitement Next.js et démarre la fixture pour
  tous les groupes CI production, car Next incorpore les variables `NEXT_PUBLIC_*`
  au build.

## Comparaison attendue sur les prochains runs

Comparer un PR Sauge, un PR SQL, un PR SEO, un PR documentation et un push
`main` avec la baseline [ci-baseline.md](ci-baseline.md), en capturant : durée
totale, provisioning, installation WebKit, build, nombre de processus/fixtures,
durée Sauge, premier échec et queue après échec. Les budgets sont des alertes
observables et ne sont pas encore bloquants.

## Limites restantes

PostgreSQL 17 n’est pas installé dans cet environnement local (`psql` et Docker
absents); le service PostgreSQL 17 est défini dans `database-contracts` et doit
être vérifié par GitHub Actions. La merge queue, la protection de branche, la
taille d’upload de l’artefact et un vrai appareil Safari/iPhone restent aussi
à vérifier sur le draft PR.
