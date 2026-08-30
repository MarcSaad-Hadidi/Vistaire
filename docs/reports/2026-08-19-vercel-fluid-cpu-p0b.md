# Vistaire — rapport final Vercel Fluid CPU P0-B

## Décision et périmètre

La branche `perf/vercel-fluid-cpu-static-public` implémente le plan CPU complet approuvé, depuis `origin/main` `fddf75c41ebc96c0f71295d5cc074277c0c2fba2`. P0-A est détaillé dans `docs/reports/2026-08-19-vercel-fluid-cpu-p0a.md`; P0-B part de son checkpoint revu `ac2bb758db9298bf96d5f40b25f4fa480933fb2a`, atteint le checkpoint runtime/cache `b93c03517982b1ed47578cfbd364db41839374b4` et se termine au checkpoint Preview `8b0a085905243f2a946c7137a37f593c10ab2c99`.

Le changement reste centré sur un seul objectif : réduire le calcul Vercel répétitif des routes publiques tout en conservant l’identité restaurant, la fraîcheur éditoriale, les langues, les aperçus, les médias et les mutations owner. Aucune migration, nouvelle dépendance, modification de plan ou réglage distant, règle Cloudflare appliquée, ressource payante, fusion ou mise en production n’a été effectuée.

## Résultat d’architecture

### P0-A

- Les 26 routes marketing nommées restent statiques; les racines FR/EN sont séparées et ne dépendent plus de la négociation dynamique.
- Le Proxy est limité aux routes réellement négociées ou protégées.
- Les contrats canonical/hreflang/JSON-LD, Markdown, Link et `Vary: Accept` sont testés localement et prouvés sur le Preview final.
- La procédure Cloudflare d’urgence reste documentée mais non appliquée; « Only build production » reste non activé.

### Cache landing P0-B

- `LANDING_DATA_CACHE_SECONDS = 900` pour une projection live validée uniquement.
- Chaque adresse inclut un epoch externe de 900 000 ms; une nouvelle fenêtre ne peut pas réutiliser silencieusement l’entrée de l’epoch précédent.
- Les clés séparent kind, expérience, restaurant, locale, version et epoch. Les tags restent indépendants de l’epoch afin de permettre l’expiration ciblée.
- Les fallbacks éditoriaux, résultats `null`, erreurs transitoires, identités/langues incorrectes, traductions incomplètes et payloads contenant une capacité privée restent hors cache durable.
- Les taux de change sont calculés hors du snapshot stable de 900 secondes.
- Les six consommateurs landing conservent `revalidate = 60`. C’est l’intervalle ISR de tentative, pas une borne dure de fraîcheur.
- L’API `/api/public/landing-menu-preview/[experienceId]` reste dynamique et renvoie `private, no-store` sur succès et erreurs.

Next peut conserver un ancien HTML ISR quand une régénération échoue. La combinaison 900 s / 60 s n’est donc pas présentée comme une garantie wall-clock pendant une panne de source.

### Menu public

Le cache durable multi-requêtes du menu reste volontairement désactivé. Le repo ne possède pas une révision publique transactionnelle incrémentée atomiquement par chaque writer; une invalidation par tag seule permettrait à un fill lent d’une autre instance de ressusciter une valeur périmée.

Le chemin autorisé implémente seulement :

- `React.cache` limité à la requête;
- un single-flight same-process indexé par slug et locale canoniques;
- les outcomes internes typés `live`, `not_found` et `temporarily_unavailable`;
- suppression de l’entrée en `finally`, après traduction, sur résolution comme rejet;
- aucune rétention cross-request de menu, `null`, démo, traduction partielle ou URL signée.

Les helpers de clé/tag future exigent déjà une révision, sans activer de consumer durable.

## Invalidation post-commit

`lib/owner/menuMutationRevalidation.ts` est la frontière centrale. L’identité publique est retenue avant les commits destructifs; après un commit confirmé, le code tente tous les tags et paths, avec `revalidateTag(tag, { expire: 0 })`. Le rapport structuré signifie uniquement que les appels de programmation sont revenus; il ne prétend pas prouver l’expiration distribuée effective.

Couverture intégrée :

| Domaine | Frontières couvertes |
| --- | --- |
| Menu | menu primaire partiel, catégories, plats, disponibilité admin |
| Photos | upload, remplacement, suppression et cleanup après commit |
| Réglages | settings natifs/legacy/atomiques, UI publique, design unique publié |
| Traductions | upsert, réparation, génération UI, publish et rollback |
| Restaurant | création RPC/fallback, status, archive, restore et suppression transactionnelle |
| 3D/AR | GLB Meshy, publish, viewer GLB, USDZ complete et suppression modèle |

Les invariants appliqués sont :

1. commit de métadonnées publiques;
2. programmation B3 tags + paths;
3. cleanup Storage/AI/job fallible;
4. si le cleanup échoue après commit, nouvelle programmation idempotente et `Response` contrôlée/redacted afin que Next atteigne le flush de ses pending revalidations;
5. aucune invalidation pour échec pré-commit, draft, dry-run ou vrai no-op.

Les revues ont notamment fermé les cas partiels catégorie/plat, les erreurs de job/relecture traduction, les rejets Storage après suppression restaurant, l’ordre de suppression modèle et les DELETE modèle idempotents.

## Validation locale

### Contrats et gates

- Matrice P0-B finale ciblée : PASS sur toutes les suites nouvelles et les mutation owners concernés.
- Deux assertions historiques de `tests/owner-restaurant-creation.test.mjs` étaient déjà rouges au checkpoint P0-A et sont hors du diff runtime : attente `sort_order` contre le fallback existant `display_order`, et attente d’un CTA media absent du composant existant. Les trois tests P0-B ajoutés dans ce fichier passent isolément; aucune réécriture produit sans rapport avec le CPU n’a été faite pour masquer ces dettes.
- `npm run typecheck` : PASS.
- `npm run lint` : PASS, zéro warning.
- `npm ls --depth=0` : PASS.
- `npm run assets:check` : PASS, 1 670 fichiers scannés, 57 exceptions existantes autorisées.
- `npm run lfs:check` : PASS, zéro règle/pointeur LFS actif.
- `git diff --check` : PASS.
- Revue indépendante finale `ac2bb75..b93c035` : READY, zéro P0/P1 et aucun secret ajouté.
- Revue indépendante ciblée du correctif Preview `8b0a085` : READY, zéro P0/P1; les transforms sont conformes au schéma Vercel et préservent les autres tokens `Vary`.

### Build final

- Build froid déterministe au runtime checkpoint : PASS.
- Next.js `16.2.11`, 41/41 pages générées.
- `check-static-public-import-boundary.mjs` : PASS, 29 entrées.
- `check-static-public-routes.mjs` : PASS, 26 routes nommées et zéro template dynamique.
- `check-public-prerender-artifacts.mjs` : PASS.
- Les six routes landing sont présentes avec `initialRevalidateSeconds = 60`.
- Scan des HTML/RSC/TXT pré-rendus pour Storage signé et query credentials : PASS, zéro match.

Archive externe de preuve : `C:\Users\hadid\.codex\visualizations\2026\08\19\01a018be-b483-7c23-b152-d033fe53f3b8\p0b-final-b93c035`.

### Navigateurs

- Matrice combinée ciblée landing/comparaisons/démo : 35/38 verts sur Chromium et WebKit.
- Les trois signaux du vieux harness `landing-final-live-qa` ne sont pas des 404/500 produit : il exige le chargement de trois images `loading=lazy` hors viewport en cinq secondes et traite comme erreurs des chunks annulés par sa navigation immédiate.
- Le contrat navigateur stable des racines FR/EN a ensuite passé 8/8 sur Chromium/WebKit à 390 et 430 px : langue brute, SEO, JSON-LD, console/réseau, absence d’overflow et rendu.
- Les quatre comparaisons, `/demo`, `/en/vistaire-menu`, trois aperçus privés, trois fiches plat et la politique 3D après intention ont été couverts dans la matrice combinée.
- Aucun GLB/USDZ n’est demandé avant l’intention utilisateur dans les contrôles applicables.

P0-A avait déjà certifié la matrice complète de 26 routes : Chromium 85/85 et WebKit 66/66, zéro skip/retry.

## Preview Vercel contrôlée

Le premier push runtime `b93c03517982b1ed47578cfbd364db41839374b4` a produit le Preview READY `dpl_AkDVNumGdp8UgjJ8B6B2u9juMvCJ`. Les smokes applicatifs authentifiés ont confirmé `/`, `/en`, `/owner`, l’API preview, une fiche plat et `/demo`. Ils ont aussi révélé un défaut uniquement visible après composition des headers Vercel : le Markdown final avait deux `Link` et perdait son unique `Vary: Accept`.

Le correctif ciblé `8b0a085905243f2a946c7137a37f593c10ab2c99` normalise le `Link` par `set` et garde un token d’ancrage avant de remplacer `Accept`. Le test rouge/vert associé passe avec les contrats Proxy/agent discovery : 20/20.

- Déploiement final non-production : `dpl_7HpT5Tr5tUatFFgJvK5UZcKKeSk7`.
- URL : `https://vistaire-ecpd021r8-capoships-projects.vercel.app`.
- État Vercel : READY; statut GitHub Vercel : success.
- Build Vercel : `Build Completed in /vercel/output [55s]`, puis déploiement réussi.
- `GET`/`HEAD /` avec HTML et Markdown : 4/4 en 200, bon `Content-Type`, exactement un `Link`, un token `Accept` et un token `rsc` par réponse.
- Le GET HTML contient `lang="fr-CA"` et un document HTML; le GET Markdown contient `# Vistaire` et aucun tag `<html>`.
- `/en` : 200 avec `lang="en-CA"`; `/owner` : 307 Clerk et `no-store`; API preview : 200 avec `Cache-Control: private, no-store, max-age=0` et `CDN-Cache-Control: private, no-store`; fiche plat et `/demo` : 200.
- La protection SSO du Preview intercepte correctement les requêtes anonymes; les smokes ont utilisé un accès Vercel temporaire authentifié, sans modifier le réglage du projet.
- Aucun polling de charge, load test ou trafic production.

Archive externe des smokes racine finaux : `C:\Users\hadid\.codex\visualizations\2026\08\19\01a018be-b483-7c23-b152-d033fe53f3b8\p0b-preview-root-8b0a085`.

## Nettoyage et risques résiduels

Les `.next`, `test-results`, screenshots, traces et rapports Playwright générés localement sont supprimés après extraction des preuves. Aucun `.env`, secret, log debug, migration, asset public lourd ou média source n’est ajouté.

Restent explicitement non vérifiables dans ce PR :

- la pente Fluid Active CPU réelle à 24 h et 72 h, qui demande un déploiement production ultérieur explicitement autorisé;
- l’exécution distribuée exacte des invalidations après le retour des appels de programmation;
- une borne dure de fraîcheur pendant une panne ISR/source;
- les writers externes inconnus qui ne passent pas par les hooks du repo;
- Quick Look iPhone et Scene Viewer Android sur appareils physiques;
- un deny réseau sortant total du build local; les dépendances connues sont déterministes, sans pare-feu de preuve.

Le rollback reste commit-scoped : B5 peut être retiré sans affecter B2/B3; les hooks B4 peuvent être retirés par domaine; B2 peut être retiré en conservant les politiques B1 inertes. Le cache durable du menu ne doit pas être activé sans la révision transactionnelle séparément conçue et autorisée.
