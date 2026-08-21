# Vistaire — rapport de preuve Vercel Fluid CPU P0-A

Date : 2026-08-19 (America/Toronto)

## Résultat

P0-A remplace le document racine dépendant de la requête par deux racines FR/EN statiques, limite le Proxy aux surfaces qui en ont réellement besoin, et ajoute des barrières de build/artefact. Le build hermétique certifié classe les 26 routes marketing nommées comme 20 routes statiques et 6 routes ISR à 60 secondes, sans exception dynamique. Ce résultat est une preuve préproduction de réduction du travail runtime; il ne constitue pas une mesure de la pente Fluid Active CPU en production.

Base : `fddf75c41ebc96c0f71295d5cc074277c0c2fba2` (`origin/main`).

Checkpoint d’implémentation P0-A : `1507ade0732e7b5b287098ba363a55d63501dc27`.

## Architecture avant/après

Avant :

- `app/layout.tsx` appelait `headers()` et rendait l’arbre de pages dépendant de la requête;
- `proxy.ts` utilisait un large matcher négatif couvrant presque toutes les requêtes hors assets;
- le build de référence classait les pages marketing, les menus, l’Admin, l’Owner et les API en `ƒ`; seuls les handlers de découverte/métadonnées étaient prérendus;
- les requêtes live `/` et `/en` étaient `private/no-store`, Cloudflare `DYNAMIC` et Vercel `MISS`; le HTML final perdait `Accept` dans `Vary` et dupliquait `Link`;
- les logs Vercel en lecture seule sur sept jours contenaient 147 événements Proxy/middleware et 133 événements Function dans le regroupement observé, routes marketing incluses.

Après :

- `app/(fr)/layout.tsx` émet littéralement `lang="fr-CA"` et `app/(en)/layout.tsx` émet `lang="en-CA"`, sans API request-scoped;
- `components/layout/VistaireDocumentShell.tsx` et `lib/rootDocument.ts` centralisent le shell, les métadonnées, le viewport, le skip-link, les trois JSON-LD, WebMCP et Clarity;
- l’ancien `app/layout.tsx` est supprimé; les routes FR sont regroupées sous `app/(fr)` et les routes EN sous `app/(en)/en`, sans changer les URL;
- le Proxy ne couvre plus le marketing HTML : il ne conserve que la négociation Markdown exacte de `/`, Owner, Todos, `/api/restaurants/:path*`, `/api/owner/:path*` et `/api/analytics/summary`;
- les headers client de confiance sont supprimés avant les surfaces protégées et le rafraîchissement Supabase conserve les cookies ainsi que les headers assainis;
- `vercel.json` applique sur `/` GET/HEAD un transform post-réponse qui retire puis ajoute un seul token `Accept` sans figer ni perdre les autres tokens `Vary`; sa composition finale reste un gate Preview;
- `next.config.ts` possède l’unique valeur `Link` partagée pour la découverte, et Markdown GET/HEAD conserve `Vary: Accept`; POST ne synthétise pas Markdown.

La baseline archivée ne contient pas un décompte numérique exploitable de toutes les lignes `ƒ`; elle prouve toutefois que toutes les pages applicatives/marketing étaient dynamiques et que seuls les handlers de découverte/métadonnées étaient prérendus. Rebuilder l’ancien commit uniquement pour fabriquer ce nombre aurait répété un build réseau ancien sans changer la décision; le nombre exact avant reste donc `NON-VÉRIFIABLE` depuis l’archive, tandis que le décompte après est certifié ci-dessous.

## Classification du build P0-A

Le build froid et unique de Task 4 a été exécuté avec Next 16.2.11 dans le sandbox par défaut, avec les chemins externes connus rendus déterministes par une fixture Supabase locale possédée, des taux de change fixes et des sentinelles synthétiques. Il a compilé 41/41 pages. L’archive ne contient toutefois pas de preuve d’un blocage réseau sortant total au niveau système.

| Classe | Nombre | Routes |
| --- | ---: | --- |
| ISR 60 s | 6 | `/`, `/en`, `/menu-digital-restaurant`, `/menu-pdf-vs-menu-digital`, `/en/digital-restaurant-menu`, `/en/pdf-vs-digital-menu` |
| Statique | 20 | les autres routes marketing FR/EN de la spécification, dont les guides et les deux aperçus restaurateur |
| Exception dynamique parmi les 26 | 0 | aucune dans `routes`; `dynamicRoutes` vide |

Les familles qui restent intentionnellement dynamiques sont `/demo`, `/en/vistaire-menu`, les GEO catch-all, `/menu/[slug]`, les plats, `/admin/**`, `/owner/**`, `/api/**`, `/q/**`, `/sign-in/**`, `/todos/**` et `/legacy/**`. Elles utilisent respectivement des données live, paramètres dynamiques, sessions/authentification ou mutations; aucune n’a été forcée statique.

## Lectures externes, fallback et artefacts

- Les 26 routes partagent uniquement des lectures déterministes de configuration de site/métadonnées.
- Les 6 routes ISR lisent la fixture Supabase locale et les taux CAD/USD/EUR fixes. Le marqueur live canonique `44444444-4444-4444-8444-999999999999` est présent dans les artefacts HTML/RSC/segments des six routes; le marqueur de fallback éditorial `fd64dc12-8bd2-4669-be63-51cf0d50b839` est absent.
- `/apercu-restaurateur` et `/en/restaurant-preview` utilisent uniquement la fixture fictive suivie et la génération QR locale.
- Les 18 autres routes statiques utilisent la copy, les registres et les assets suivis.
- Le scanner d’artefacts ne trouve aucune sentinelle service-role/Owner/Admin synthétique ni capacité Storage signée dans les sorties publiques.
- Le graphe public est contrôlé par un scanner fail-closed de 29 entrées; les exceptions exactes continuent d’être parcourues, sauf la façade explicitement bornée `publicLandingMenuData.ts` vers `publicMenuRenderContext.ts`, elle-même protégée par projections, fixture hermétique et scan d’artefacts.

Le build n’utilise plus `next/font/google`. Trouvable conserve ses piles CSS `Inter, sans-serif` et `"Noto Serif Display", Georgia, serif`; aucune police, dépendance ou ressource publique n’a été ajoutée. La parité typographique pixel parfaite n’est pas revendiquée : la QA 390/430/desktop vérifie la géométrie et l’absence de clipping/overflow.

Archive de preuve immuable : `C:\Users\hadid\.codex\visualizations\2026\08\19\01a018be-b483-7c23-b152-d033fe53f3b8\p0a-task4-build-0cf0aa59b11b`.

## Produit, SEO et navigateur

- FR/EN : racines initiales `fr-CA`/`en-CA`, canonical, hreflang et x-default vérifiés sur les 26 routes.
- JSON-LD : présence et cohérence contrôlées par les contrats SEO et la matrice navigateur.
- Hero : sources préservées — desktop `/videos/Vistaire2.mp4`, mobile `/videos/optimized/upscaled-video-mobile-scrub.mp4`, poster `/frames/menualive/frame_0200.webp`; aucune requête GLB/USDZ initiale.
- Sauge Noire : navigation directe, reload, JavaScript désactivé et transitions client testés à 390/430 sans flash de thème ni état résiduel.
- Trouvable : piles de fallback calculées, marque/texte lisibles et géométrie sans clipping/overflow à 390 px.

Task 5 est verte sur les deux moteurs avec un worker, zéro retry et interdiction des skips : Chromium 85/85 et WebKit 66/66, soit 151/151. Les 26 routes nommées gardent leur langue brute, canonical/hreflang absolus exacts, JSON-LD et santé navigateur; les contrôles représentatifs 390/430 n’ont ni overflow, ni overlay, ni 404/500 inattendu. Les transitions racine remplacent réellement le document, les indicateurs de focus sont visibles et activables au clavier, et les signaux réseau/console sont collectés jusqu’à l’état `load`.

## Contrôles et résultats

| Contrôle | Résultat |
| --- | --- |
| Build hermétique Task 4, une tentative | PASS — 41/41 pages |
| `check-static-public-import-boundary.mjs` | PASS — 29 entrées |
| `check-static-public-routes.mjs` | PASS — 26 nommées, 0 template dynamique |
| `check-public-prerender-artifacts.mjs` | PASS |
| SEO | PASS — 40/40 |
| Landing contract | PASS — 28/28 |
| Landing i18n | PASS — 21/21 |
| Aperçu restaurateur | PASS — 10/10 |
| Menu/Auth exact inventaire | PASS — 371/371 |
| Tests Proxy/header | PASS — 26/26 |
| TypeScript Task 5 | PASS |
| Lint, assets, LFS | PASS aux checkpoints propriétaires; gate intégré final après P0-B |
| Diff-check Task 5 | PASS |
| Chromium Task 5 | PASS — 85/85, 0 skip/retry |
| WebKit Task 5 | PASS — 66/66, 0 skip/retry |

Les quatre déclarations `revalidate: 60` historiques de `lib/landing/menuExperiences.ts` sont inchangées dans P0-A. Aucun cache, tag, invalidation ou TTL P0-B n’a été introduit dans cette phase.

## Politique Preview et Cloudflare

- Le fichier CI exclut des previews automatiques les branches de bots autorisées tout en conservant les validations source.
- L’option Vercel « Only build production » est documentée comme procédure manuelle d’urgence et n’a pas été activée.
- `docs/operations/cloudflare-marketing-cache-rule.md` documente une règle non appliquée, fail-closed, limitée à 23 routes statiques prouvées. `/`, les deux aperçus, les requêtes avec query/cookie/authorization/Range/Markdown/RSC/prefetch et les hosts non production sont exclus. Aucun réglage Cloudflare n’a été modifié.

## Revue, nettoyage et limites

Les Tasks 1 à 6 ont été relues indépendamment; tous les P0/P1 trouvés ont été corrigés et les relectures finales ne signalent aucun Critical/Important. La revue intégrée P0-A au checkpoint Task 5 a retracé auth/Proxy, manifests, artefacts privés, SEO FR/EN, Sauge, hero, canonical absolus et santé navigateur; son verdict final est consigné avant le commit de ce rapport.

Aucune migration, dépendance, modification de plan/setting distant, ressource lourde, asset public, déploiement production ou merge n’a été effectué. Les sorties navigateur temporaires sont nettoyées après la QA; `.next` Task 4 est conservé uniquement jusqu’à la fin de Task 5, puis le build intégré P0-B devient l’autorité finale.

`NON-VÉRIFIABLE` à ce checkpoint intermédiaire :

- le transform Vercel post-réponse et l’unicité finale de `Accept`/`Link`, qui exigent le Preview contrôlé du checkpoint complet;
- l’absence d’invocation Function/Proxy marketing dans les logs de ce Preview;
- la pente Fluid Active CPU à 24 h et 72 h, qui exige un déploiement production séparément autorisé et une observation réelle;
- un deny réseau sortant total pendant le build Task 4; les dépendances externes connues étaient détournées vers des fixtures déterministes, mais le script archivé ne configure pas de pare-feu;
- le décompte numérique exact des lignes dynamiques du build baseline, non conservé dans l’archive initiale.

P0-B démarre depuis ce checkpoint revu et ajoute uniquement le cache landing sûr, l’invalidation post-commit et la déduplication menu autorisés. Le build, la QA et le Preview finaux couvrent ensuite l’ensemble de la branche avant création de la PR.
