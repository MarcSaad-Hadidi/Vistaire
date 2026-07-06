# Rebuild old PR stack plan

## 1. Resume executif

Les PR #24 a #31 ne doivent pas etre mergees telles quelles. Elles sont ouvertes en draft, basees sur un ancien `main` (`73f24b8`) et elles entrent en conflit avec la base saine actuelle (`31c5477`, apres #32, #34 et #35). Le travail utile doit etre reconstruit depuis le dernier `origin/main`, en petites PR atomiques, sans reprendre les branches empilees ni leurs commits complets.

Le constat principal est triple:

- #24 introduit le gros risque 3D/assets: fichiers bruts sous `3D Plat/` et `3D photo/`, binaires GLB/USDZ sous `public/models/restaurants/**`, et suppression de deux USDZ demo encore references.
- #26 a #31 forment une pile lineaire sur #24; chaque PR transporte donc le meme risque asset plus des changements runtime de plus en plus larges.
- Plusieurs PR touchent le hero landing et contredisent le contrat restaure par #35: le scrub video doit rester actif, meme en reduced motion, Save-Data ou low-end, avec comportement conservateur plutot que desactivation.

Cette branche doit rester docs/plan only. Elle ne doit pas modifier les routes runtime, le hero, les donnees demo, les medias publics ou les assets 3D.

## 2. Pourquoi #24-#31 ne doivent pas etre mergees telles quelles

- Elles sont basees avant les guards asset/LFS de #32, la foundation setup de #34 et le hero always-video de #35.
- Elles peuvent supprimer ou ecraser des protections recentes, notamment les scripts `assets:check` et `lfs:check`, les docs de workflow, et les regles `.gitignore` actuelles.
- Elles ajoutent environ 58 a 91 MiB de medias selon la PR, dont des fichiers explicitement interdits par `docs/repo-asset-policy.md`.
- Elles melangent domaines: landing, SEO, 3D, analytics, admin/owner, tests, setup docs et assets.
- Elles contiennent des attentes de tests stale qui acceptent que le hero video soit differe ou vide sur low-end, ce qui regresse #35.
- Elles suppriment deux USDZ demo existants encore references, avec risque de 404 Quick Look.
- Elles ne sont pas mergeables selon GitHub et sont techniquement des drafts larges, pas des PR de production reviewables.

## 3. Audit PR par PR

| PR | Titre | Branche | Objectif apparent | Fichiers critiques | Gros fichiers/assets | Risque LFS/repo | Risque hero | Risque produit | Contenu utile a garder | Contenu a jeter | Contenu a refaire plus tard | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #24 | Ajouter un pipeline 3D/AR de production pour Vistaire | `codex/production-3d-ar-pipeline` | Pipeline production 3D/AR, manifests, validators, headers, exemple Maison Elyse | `scripts/3d/**`, `lib/dishModelAssets.ts`, `lib/quickLookAssets.ts`, `lib/dishAssetWarmup.ts`, `next.config.ts`, `app/page.tsx`, `app/demo/**`, `public/models/**`, tests | `3D Plat/*.glb` ~50 MiB, `3D photo/*.png` ~9 MiB, `public/models/restaurants/**` GLB/USDZ dont 17.7 MiB, 12.0 MiB, 5.2 MiB | Tres eleve: raw binaries, public model binaries, deleted demo USDZ; no new wildcard LFS but repo bloat | Eleve: touches landing and gates video under reduced/Save-Data | Eleve: demo/runtime/3D/admin/SEO melanges | Architecture manifests, validators, budgets, SHA checks, tests 3D, idee de gating Quick Look | Tous binaires, source drops, deletes des USDZ demo, changes runtime non necessaires | Pipeline 3D en deux PR: validators metadata puis runtime pilot CDN/storage | Ne pas merger; reconstruire en PR F/G |
| #25 | Establish a best-in-class Codex setup for Vistaire | `codex/best-in-class-codex-setup-vistaire` | Setup Codex, docs, CI, PR template, scripts | `AGENTS.md`, `.github/**`, `docs/**`, `.env.example`, `package.json`, mais aussi runtime et 3D herites | Meme base 3D partielle: `3D Plat`, `3D photo`, petits `public/models/restaurants/**`; suppression USDZ demo | Tres eleve pour une PR "setup": transporte assets/runtime | Moyen: contient composants landing herites | Eleve: setup-only qui touche runtime et medias | Idees docs/setup deja largement remplacees par #34; peut-etre variables SEO `.env.example` | Tout runtime, assets, 3D, suppressions guards/docs recentes | Audit setup delta separe si un manque de #34 est prouve | Supersedee; ne pas merger |
| #26 | Ship premium 3D landing and restaurant AR asset pipeline | `feature/landing-conversion-premium` | Landing premium + pipeline AR | `app/page.tsx`, `components/landing/**`, `components/dish/**`, `app/demo/**`, `app/api/analytics/**`, `public/models/restaurants/**`, `e2e/**` | Herite #24: ~91 MiB medias et deletions USDZ | Tres eleve | Tres eleve: modifie hero, copy, scroll tests | Tres eleve: landing + AR + analytics + SEO en une PR | Quelques idees de copy/positionnement seulement | Cherry-pick landing, assets, app/page tree, tests stale | Landing/product copy seulement sur demande design explicite, apres #35 QA | Ne pas merger; extraire idees seulement |
| #27 | Renforcer les performances mobiles de Vistaire sans sacrifier la 3D | `feature/mobile-performance-hardening` | Perf mobile, Save-Data, low-end, model-viewer lazy loading | `components/landing/useHeroVideoMode.ts`, `ScrollScrubVideoHero.tsx`, `components/dish/**`, `components/menu/**`, `lib/dishAssetWarmup.ts`, `next.config.ts`, tests | Herite #24, pas de nouveau gros media majeur | Tres eleve par heritage | Tres eleve: desactive/differe video sur low-end, Save-Data ou reduced | Eleve: perf, menu, dish, landing, 3D ensemble | Guards reseau hors hero, lazy 3D apres intention, variant selection | Toute logique qui bloque le hero video; asset baggage | PR D performance mobile hors hero, puis PR G pour 3D gating | Ne pas merger; refaire hors hero |
| #28 | Clean legacy branding and stabilize public asset paths for Vistaire | `feature/cleanup-legacy-branding` | Nettoyage branding, alias frame, tests regression | `.gitignore`, `next.config.ts`, `components/Header.tsx`, `components/SiteFooter.tsx`, `components/landing/heroVideoSources.ts`, `tests/branding-legacy.test.mjs` | Herite #24; pas de nouveau gros media majeur | Eleve par heritage; `.gitignore` affaiblit des protections actuelles | Moyen: poster `/frames/vistaire` peut 404 si alias incomplet | Moyen: risque copy publique et chemins assets | Tests de branding, idee d'alias compatible si prouvee | Affaiblissement `.gitignore`, frame rename partiel, asset baggage | PR B branding minimal; alias frames seulement si Network prouve besoin | Ne pas merger; refaire petit |
| #29 | [codex] Harden Vistaire SEO/GEO positioning | `codex/seo-geo-foundation-vistaire` | SEO/GEO, schema, sitemap, robots, pages SEO | `lib/seo.ts`, `lib/seoPages.ts`, `app/(seo)/**`, `components/seo/**`, `tests/seo-foundation.test.mjs`, metadata routes | Herite #24 | Eleve par heritage | Moyen: touche `app/page.tsx` metadata/copy dans la pile | Moyen/eleve: SEO + product copy + runtime melanges | Helpers schema, sitemap public, noindex admin/dish, pages SEO, copy "demo fictive" | Assets, homepage visual rewrite, crawler list non verifiee, runtime 3D deps | PR C SEO/GEO minimal avec tests; verifier crawlers docs officielles | Ne pas merger; extraire manuellement |
| #30 | Ajouter des smoke tests Playwright et durcir la stabilite QA | `feature/qa-smoke-tests` | Smoke Playwright MVP/SEO, config Playwright | `e2e/mvp-smoke.spec.ts`, `e2e/seo-smoke.spec.ts`, `playwright.config.ts`, `package.json`, `e2e/landing-scroll.spec.ts` | Herite #24 | Eleve par heritage, faible incremental | Moyen: certains tests attendent le hero differe dans la pile | Moyen: tests lies a routes SEO/3D non reconstruites | `test:smoke`, Playwright stability knobs, smoke MVP adapte | SEO smoke avant PR C, attentes hero stale, package scripts 3D | PR A smoke minimal sur main actuel, puis SEO smoke apres PR C | Ne pas merger; reconstruire PR A |
| #31 | Prepare Vistaire for first client launch with readiness boundaries and minimal protections | `feature/client-readiness-v1` | Readiness client, frontieres demo/owner/admin, docs, protections | `docs/client-readiness.md`, `app/admin/**`, `app/owner/**`, `app/api/admin/**`, `lib/admin/**`, `lib/owner/**`, `lib/analytics/insights.ts`, tests | Herite #24 | Eleve par heritage | Moyen: conserve baggage landing de la pile | Eleve: docs readiness + runtime admin/owner/API + 3D gating | `docs/client-readiness.md`, frontieres produit, checklist pilote | Runtime admin/owner/API dans une docs PR, assets, baggage | PR H docs-only; runtime boundary copy separe apres QA | Ne pas merger; extraire docs |

## 4. Graphe de dependance

Base ancienne observee:

- GitHub expose `73f24b8` comme ancien base SHA de ces PR.
- Le merge-base local entre les refs PR recuperees et `origin/main` est `3bb8beb`, c'est-a-dire avant le merge #23 visible dans l'historique actuel.
- Dans les deux lectures, la conclusion est la meme: ces branches precedent #32, #34 et #35, donc elles sont stale par rapport aux guards asset/LFS, a la foundation setup et au hero always-video.

Graphe observe:

```text
3bb8beb old #23-era base
  c2138ed Add production 3D/AR asset pipeline
    4abd3e8 Add 3D/AR quality gates and validator scripts
      cfed443 #24 Harden Vistaire P0 demo routes and asset delivery
        b272b67 #26 Refine commit message generation
          14858e8 #27 Harden mobile performance for Vistaire
            6a7fccf #28 Clean legacy Vistaire branding
              758a810 #29 Harden Vistaire SEO GEO positioning
                a0730bb #30 Add Playwright smoke tests for MVP and SEO
                  67bcb1e #31 Clarify client readiness boundaries and onboarding docs

      6160766 #25 Add Codex setup docs and CI for Vistaire
```

Relations:

- #26 est #24 + 1 commit.
- #27 est #26 + 1 commit.
- #28 est #27 + 1 commit.
- #29 est #28 + 1 commit.
- #30 est #29 + 1 commit.
- #31 est #30 + 1 commit.
- #25 est une branche soeur: elle partage les deux premiers commits 3D avec #24, puis diverge avec un commit setup.

Refaire independamment:

- QA smoke minimal (#30) peut etre refait en premier depuis `origin/main`, sans SEO ni 3D.
- Analytics guards peuvent etre refaits depuis `origin/main`, sans admin/owner.
- Branding cleanup (#28) peut etre refait sans asset path runtime sauf preuve.
- SEO/GEO (#29) peut etre refait apres branding minimal.
- 3D pipeline (#24) doit etre refait sans assets lourds.
- Client readiness (#31) peut etre docs-only.

Anciennes PR:

- #25 peut etre fermee comme supersedee par #34 et ce plan, apres ajout d'un lien de remplacement si l'equipe veut garder une trace.
- #24 et #26-#31 doivent rester non mergees. Recommendation: les fermer comme superseded apres merge du plan et creation des premieres branches de remplacement, ou les laisser ouvertes temporairement comme reference, mais jamais les merger.

## 5. Plan de reconstruction en petites PR

Chaque nouvelle PR part de `origin/main` a jour. Ne jamais partir de #24-#31. Ne pas cherry-pick un commit complet; reimplementer manuellement les hunks utiles.

### PR A - Smoke tests minimal

- Titre recommande: `Add minimal Vistaire MVP smoke tests`
- Branche recommandee: `feature/rebuild-pr30-smoke-tests`
- Objectif: ajouter un filet QA minimal pour `/`, `/demo`, `/demo`, `/admin` et protection `/owner`.
- Fichiers autorises: `e2e/mvp-smoke.spec.ts`, `playwright.config.ts`, `package.json`, eventuellement `.github/workflows/app-ci.yml` pour `test:unit` seulement.
- Fichiers interdits: `app/**`, `components/**`, `lib/**`, `public/**`, `scripts/3d/**`, `3D Plat/**`, `3D photo/**`.
- Anciens elements a reprendre: structure de #30 `mvp-smoke`, config Playwright `screenshot: only-on-failure`, `video: off`, retries CI a 1.
- Anciens elements a exclure: `seo-smoke.spec.ts` avant PR C, attentes hero stale, scripts `3d:*`, changements runtime.
- Validations obligatoires: `npm run assets:check`, `npm run lfs:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:smoke`.
- Chrome DevTools obligatoire: verifier `/`, `/demo`, `/demo`, `/admin`, `/owner` en 390px et 430px; console propre; Network sans 404/500; aucun GLB/USDZ avant clic 3D.
- Risques: flakiness Playwright, assertions trop liees a copy exacte, auth locale Clerk.
- Criteres de merge: tests stables localement, pas de changement runtime, aucune sortie Playwright commitee.

### PR B - Cleanup branding

- Titre recommande: `Clean public Vistaire branding without runtime asset churn`
- Branche recommandee: `feature/rebuild-pr28-branding-cleanup`
- Objectif: retirer le branding legacy visible et ajouter des tests de regression copy.
- Fichiers autorises: tests branding, docs/README si necessaire, composants non-hero avec copy strictement ciblee.
- Fichiers interdits: `app/page.tsx`, `components/landing/**`, `public/frames/**`, `public/videos/**`, `public/models/**`, `.gitignore` sauf si cela renforce les guards.
- Anciens elements a reprendre: `tests/branding-legacy.test.mjs`, petites corrections de copy visibles.
- Anciens elements a exclure: rename poster `/frames/vistaire` tant que l'alias n'est pas prouve, affaiblissement `.gitignore`, liens SEO/footer si PR C n'a pas cree les pages.
- Pre-check obligatoire: lancer `rg -n "MenuAlive|menualive|Menu Vivant|menu vivant"` sur main. Si aucun branding visible n'est trouve, convertir PR B en test/docs-only ou l'abandonner.
- Validations obligatoires: checks baseline + test branding cible.
- Chrome DevTools obligatoire: `/`, `/demo`, `/admin`; Network sans 404 frames/videos; hero toujours video actif.
- Risques: casser les chemins frames existants ou confondre copy demo/client.
- Criteres de merge: diff narrow, aucun asset path runtime modifie sans preuve Network, aucun asset ajoute.

### PR C - SEO/GEO minimal

- Titre recommande: `Add conservative Vistaire SEO/GEO foundation`
- Branche recommandee: `feature/rebuild-pr29-seo-geo-minimal`
- Objectif: ajouter pages SEO, schema, sitemap/robots conservateurs et noindex des surfaces non publiques.
- Fichiers autorises: `app/(seo)/**`, `components/seo/**`, `lib/seo.ts`, `lib/seoPages.ts`, `tests/seo-foundation.test.mjs`, eventuellement `e2e/seo-smoke.spec.ts`, `components/SiteFooter.tsx`.
- Fichiers autorises avec limite stricte: `app/page.tsx` metadata-only si necessaire; aucune modification JSX/hero/sections.
- Fichiers interdits: `components/landing/**`, `lib/demoMenuData.ts` sauf libelle demo fictive minimal, `public/**`, `scripts/3d/**`, admin/owner runtime.
- Anciens elements a reprendre: helpers JSON-LD, pages SEO, sitemap sans `/admin`, noindex admin/dish, `llms.txt` explicitement non ajoute.
- Anciens elements a exclure: crawler user-agents non verifies, BOM/copy mal encodee, CSS globale non liee aux pages SEO, homepage visual rewrite.
- Validations obligatoires: baseline + tests SEO + smoke routes SEO si ajoutees.
- Chrome DevTools obligatoire: `/`, pages SEO, `/robots.txt`, `/sitemap.xml`, `/admin`, `/demo`; verifier head/canonical/noindex.
- Risques: copy trop longue, pages SEO trop marketing, crawler rules incorrectes.
- Criteres de merge: schema valide, sitemap attendu, pas de regression hero, pas d'asset.

### PR D - Performance mobile hors hero

- Titre recommande: `Harden non-hero mobile performance`
- Branche recommandee: `feature/rebuild-pr27-mobile-performance-nonhero`
- Objectif: ameliorer menu/dish/3D lazy loading sans toucher au hero always-video.
- Fichiers autorises: `components/dish/**`, `components/menu/**`, `lib/dishAssetWarmup.ts`, `lib/quickLookAssets.ts`, tests cibles.
- Fichiers interdits: `app/page.tsx`, `components/landing/**`, `public/**`, `next.config.ts` sauf preuve header non-hero, assets 3D.
- Anciens elements a reprendre: no GLB/USDZ avant intention, low-end warmup guards, touch target fixes menu/dish.
- Anciens elements a exclure: `canUseScrubVideo` bloque par reduced/Save-Data/low-end, e2e qui accepte `currentSrc === ""` sur hero.
- Validations obligatoires: baseline + tests warmup/quicklook + e2e dish/menu si change.
- Chrome DevTools obligatoire: 390px et 430px sur `/demo` et `/demo`; aucun GLB/USDZ avant clic; pas d'overflow.
- Risques: empecher un fallback AR existant ou rendre la 3D inaccessible.
- Criteres de merge: behavior mesure, hero intact, 3D lazy load prouve.

### PR E - Analytics guards minimal

- Titre recommande: `Add minimal analytics request guards`
- Branche recommandee: `feature/rebuild-analytics-request-guards`
- Objectif: isoler validation origin/referer/rate-limit de l'endpoint analytics.
- Fichiers autorises: `app/api/analytics/events/route.ts`, `lib/analytics/requestGuards.ts`, `tests/analytics-request-guards.test.mjs`.
- Fichiers interdits: admin/owner pages, `lib/analytics/insights.ts`, landing, demo data, assets.
- Anciens elements a reprendre: same-origin guard, localhost loopback support, soft missing-origin handling, rate-limit key tests.
- Anciens elements a exclure: changements admin/owner, product copy, 3D pipeline.
- Validations obligatoires: baseline + `node --test tests/analytics-request-guards.test.mjs`.
- Chrome DevTools obligatoire: `/demo` posts analytics sans erreur console; Network pas de spam 4xx.
- Risques: bloquer analytics legitimes selon proxy/deploy.
- Criteres de merge: tests unitaires couvrent localhost/prod/cross-origin; fallback clair.

### PR F - 3D manifest pipeline sans assets lourds

- Titre recommande: `Add 3D manifest validation pipeline without binaries`
- Branche recommandee: `feature/rebuild-pr24-3d-manifest-pipeline`
- Objectif: ajouter scripts/validators/manifests de validation 3D avec fixtures legeres seulement.
- Fichiers autorises: `scripts/3d/**`, `tests/production-3d-*.test.mjs`, `assets/3d/fixtures/**` JSON leger, `package.json` scripts `3d:*`, docs qui referencent `docs/repo-asset-policy.md`.
- Fichiers interdits: `public/models/**` binaires, `3D Plat/**`, `3D photo/**`, `assets/3d/source/**`, `assets/3d/work/**`, `.gitattributes` LFS, app runtime.
- Anciens elements a reprendre: schemas, budgets, validators GLB/USDZ basics, SHA256, network header validator, reports.
- Anciens elements a exclure: tous GLB/USDZ/PNG, deletes des USDZ demo, duplication des seuils asset policy.
- Validations obligatoires: baseline + tests production 3D + `npm run 3d:validate` sur fixture.
- Chrome DevTools obligatoire: pas necessaire pour scripts-only, mais route smoke baseline si package scripts changent.
- Risques: scripts trop couples aux assets absents, thresholds dupliques.
- Criteres de merge: aucun fichier dangereux ajoute, `git diff --name-only` sans public media, docs pointent vers asset policy.

### PR G - 1 plat 3D manifest pilot sans gros assets Git

- Titre recommande: `Pilot one approved 3D dish manifest without Git binaries`
- Branche recommandee: `feature/rebuild-3d-manifest-pilot`
- Objectif: activer un manifest pilote pour un plat, avec URLs storage/CDN ou metadata disabled, sans binaires Git.
- Fichiers autorises: manifest JSON leger, `lib/dishModelAssets.ts`, `lib/dishModelVariantSelection.ts`, `lib/quickLookAssets.ts`, `lib/dishAssetWarmup.ts`, tests cibles.
- Fichiers interdits: `public/models/restaurants/**/*.glb`, `public/models/restaurants/**/*.usdz`, `3D Plat/**`, `3D photo/**`, `public/videos/**`, broad LFS.
- Anciens elements a reprendre: `approvedAt` gate, `arVisualStatus === "approved"` gate, known failed USDZ denylist, Android/mobile variant preference.
- Anciens elements a exclure: resolver qui suppose uniquement `/models/restaurants/`, manifests qui pointent vers fichiers exclus, claims real-device sans test.
- Validations obligatoires: baseline + tests 3D/warmup/quicklook + e2e AR handoff si runtime touche.
- Chrome DevTools obligatoire: `/demo`; aucun GLB/USDZ avant clic; GLB/CDN uniquement apres intention; Network sans 404.
- Risques: CDN non disponible, CORS/Content-Type incorrect, Quick Look iPhone non prouve.
- Criteres de merge: manifest approuve, checksum/bytes documentes, no asset Git, pas de claim device sans preuve.

### PR H - Client readiness docs

- Titre recommande: `Document first-client readiness boundaries`
- Branche recommandee: `feature/rebuild-pr31-client-readiness-docs`
- Objectif: documenter ce qui est demo, interne owner, futur dashboard client, MVP pilote et checklist go/no-go.
- Fichiers autorises: `docs/client-readiness.md`, eventuellement liens depuis docs existantes.
- Fichiers interdits: `app/**`, `components/**`, `lib/**`, `public/**`, package scripts.
- Anciens elements a reprendre: frontieres produit, onboarding, metrics utiles/dangereux, QA mobile reelle, red team client.
- Anciens elements a exclure: runtime admin/owner/API, analytics fallback changes, copy publique.
- Validations obligatoires: baseline; no runtime tests necessaires sauf liens docs.
- Chrome DevTools obligatoire: non requis pour docs-only; si lance, route smoke baseline suffit.
- Risques: doc promet trop vite un SaaS ou un pipeline automatique.
- Criteres de merge: docs explicitent "pilote encadre, pas SaaS self-serve", aucun runtime change.

### Autres PR possibles

- PR I: `landing-positioning-refresh` seulement si demande design explicite; doit proteger #35 et passer QA mobile 390/430.
- PR J: `frame-public-alias` seulement si on decide de masquer `/frames/menualive`; doit inclure rewrite, tests et Network verification, sans modifier les fichiers frames.
- PR K: `setup-delta-after-pr34` seulement si un manque concret de #25 n'est pas deja couvert par #34.

## 6. Ordre exact recommande

1. Merge de ce plan docs-only.
2. PR A - smoke tests minimal.
3. PR E - analytics guards minimal.
4. PR B - cleanup branding.
5. PR C - SEO/GEO minimal.
6. PR D - performance mobile hors hero.
7. PR F - 3D manifest pipeline sans assets lourds.
8. PR G - 1 plat 3D manifest pilot sans gros assets Git.
9. PR H - client readiness docs.
10. Eventuels PR I/J/K uniquement avec besoin prouve.

Raison: A donne le filet de regression, E isole une surface API, B stabilise la nomenclature publique, C depend d'une copy stable, D evite de toucher au hero, F cree l'infrastructure 3D sans risque asset, G active un pilote seulement apres F, H documente le passage client sans melanger runtime.

## 7. Ce qu'il faut absolument eviter

- Merger #24-#31.
- Cherry-pick un commit complet de #24-#31.
- Partir d'une branche de #24-#31.
- Ajouter des GLB, USDZ, MP4, PNG lourds, ZIP, source drops ou review renders.
- Modifier `app/page.tsx` ou `components/landing/**` dans une PR non dediee au hero.
- Reintroduire `!isReducedMotion`, `!isSaveData` ou `!isLowEndDevice` comme blockers du hero video.
- Supprimer les USDZ demo existants sans PR asset cleanup explicite.
- Affaiblir `.gitignore`, `.gitattributes`, `assets:check` ou `lfs:check`.
- Ajouter des wildcard LFS rules.
- Mettre des instructions internes sous `public/`.
- Dire que Quick Look iPhone ou Scene Viewer Android est valide sans device reel.
- Fermer les anciennes PR sans lien clair vers ce plan ou les PR de remplacement.

## 8. Red team du plan

Question: est-ce que le plan pousse encore a faire une grosse PR ?

Correction: non, chaque PR a un objectif et une write surface limitee. Les PR F/G separent pipeline et runtime pilot; SEO, tests, analytics, docs et branding sont separes.

Question: est-ce qu'il melange runtime, SEO, 3D, tests, docs ?

Correction: non dans les PR proposees. La seule exception controlee est PR C, ou `app/page.tsx` est metadata-only si necessaire. Toute modification JSX/hero est interdite.

Question: est-ce qu'il risque de reintroduire des assets lourds ?

Correction: les PR F/G interdisent explicitement `public/models/**/*.glb`, `*.usdz`, `3D Plat/**`, `3D photo/**`, `assets/3d/source/**`, `assets/3d/work/**` et broad LFS. `assets:check` et `lfs:check` restent obligatoires.

Question: est-ce qu'il risque de casser le hero video toujours actif ?

Correction: PR D est "hors hero", PR B/C interdisent `components/landing/**`, et tout futur hero work doit garder le contrat #35: video active, `data-video-deferred="false"`, source non vide, reduced/Save-Data/low-end conservateurs seulement.

Question: permet-il de reprendre les idees utiles sans cherry-pick aveugle ?

Correction: oui, chaque PR liste les anciens elements a reprendre et a exclure. La regle est reimplementation manuelle depuis `origin/main`.

Question: est-il assez clair pour guider Codex dans les prochaines PR ?

Correction: oui, chaque PR a titre, branche, objectif, fichiers autorises/interdits, validations, DevTools, risques et criteres de merge.

Confidence status: 100% sur la strategie de decomposition et les garde-fous de cette PR docs-only. Les futures PR runtime devront chacune regagner leur propre confiance avec tests, DevTools et preuves d'assets.

## 9. Checklist avant de fermer les anciennes PR

- Ce plan est merge sur `main`.
- Chaque ancienne PR a ete referencee dans une issue/PR de remplacement ou dans un commentaire de fermeture.
- #25 est comparee avec #34 pour verifier qu'aucun setup-only utile ne manque.
- #24 est remplacee par PR F/G sans binaires.
- #26 est soit abandonnee, soit convertie en demande design separee pour landing.
- #27 est remplacee par PR D sans toucher au hero.
- #28 est remplacee par PR B, sans affaiblir asset policy.
- #29 est remplacee par PR C, avec crawler rules verifies.
- #30 est remplacee par PR A puis smoke SEO apres PR C.
- #31 est remplacee par PR H docs-only, puis runtime boundaries si besoin.
- Aucune ancienne PR n'est mergee ou rebased comme solution rapide.
- Les nouvelles PR de remplacement sont toutes basees sur le dernier `origin/main`.

## 10. Validation et QA obligatoires pour cette PR de plan

Checks:

```bash
npm run assets:check
npm run lfs:check
npm run typecheck
npm run lint
npm run build
```

Browser QA pour cette PR docs-only:

- Lancer l'app localement si possible.
- Verifier `/`, `/demo`, `/demo`.
- Console sans erreur inattendue.
- Network sans 404/500 evident.
- Aucun GLB/USDZ avant user intent.
- Si Chrome DevTools direct est indisponible, utiliser Playwright/CDP et le dire explicitement.

Asset/LFS safety:

- `git diff --name-only` doit montrer seulement `docs/rebuild-old-pr-stack-plan.md`.
- Aucun fichier public media modifie.
- Aucun gros fichier ajoute.
- `git lfs ls-files -l` ne doit montrer aucune nouvelle dependance.
