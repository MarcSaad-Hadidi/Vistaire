# Vistaire Digital — rapport de vérification

Le suivi « Descriptions et CI » en fin de document complète ce bilan initial et remplace ses constats sur les dépendances et les origines CORS. Le bilan initial porte sur `2d9a5b66` ; le suivi porte sur `6b54e6c2` et `c2834d9c`.

Rapport de livraison et de limites observées. Une assertion ou une commande en échec est signalée comme telle ; aucun essai logiciel ne vaut validation sur appareil physique.

## 1. Branche, base et livraison

- Branche de travail et d’intégration : `codex/vistaire-digital-glb-experience`.
- Base approuvée : `origin/main`, SHA `9e5cae0270af704931cb15c2ebc2c23cab2c624c`.
- Worktree : `C:/Users/hadid/.codex/worktrees/vistaire-digital-glb/Vistaire`.
- Dernier commit inclus dans le paquet de revue initial : `f30b03fa`. Des corrections de QA ont ensuite été inspectées dans les fichiers courants ; ce SHA n’est pas présenté comme le HEAD final.
- **HEAD de l’implémentation : `719cbb9725d1613137191c93ee06349624cfe391`.** Le HEAD final, qui comprend ensuite ce rapport et les dernières assertions, est celui de la PR et figure dans le message de livraison.
- **PR brouillon unique : [#321](https://github.com/MarcSaad-Hadidi/Vistaire/pull/321)**, ouverte avec `draft: true`, `merged: false`, base `main` ; aucune demande de merge.
- **Preview READY :** [vistaire-byda3wsah](https://vistaire-byda3wsah-capoships-projects.vercel.app), déploiement `dpl_1pEX4pv63eQR6XUummXzWTEeSSnK`, code `719cbb9725d1613137191c93ee06349624cfe391`.
- Aucun merge vers `main` n’est effectué dans le périmètre de cette revue. Confirmation du principal : aucun merge, force push, migration ou opération de suppression de production. Le checkout utilisateur initial et ses changements étrangers à Digital ne doivent pas être modifiés.

Références : [cadrage approuvé](../specs/2026-10-27-vistaire-digital-design.md), [plan et ownership](../plans/2026-10-27-vistaire-digital.md), [preuves de distribution](../../public-model-assets.md). Le cadrage conserve son état historique avant implémentation ; ce rapport porte sur l’intégration.

## 2. Résultat commercial et périmètre

Digital devient la première de cinq offres FR/EN : 1 500 CAD de mise en place, 200 CAD/mois et engagement initial de 12 mois, taxes en sus. Le calcul retourne le même prix pour 1, 10, 20, 21, 37 et 100 tables. Aucun support physique, livre, impression, fabrication, livraison ou installation physique n’est inclus ; le QR est fourni numériquement. Le livre Sauge Noire est illustratif.

Les quatre collections physiques restent à 2 000 / 2 050 / 2 100 / 2 200 CAD, avec jusqu’à vingt supports et les suppléments 40 / 45 / 55 / 55 CAD. Le mensuel, Pilotage +100 CAD/mois, les packs 3D et les routes de rendez-vous FR/EN restent conservés. Les coûts initiaux sur douze mois, hors taxes/options et dans la quantité physique incluse, sont 3 900 / 4 400 / 4 450 / 4 500 / 4 600 CAD.

Le diff inspecté ajoute l’offre, sa présentation et ses preuves ; il ne modifie pas l’admin, l’authentification, les contrats de contact, Supabase ou l’AR des plats. Aucun nouveau moteur, dépendance, framework de test, pipeline USDZ ou mécanisme LFS n’est ajouté. Aucun chemin sous `public/models`, `public/videos`, `public/frames`, `3D Plat` ou `3D photo` ne figure dans le paquet de diff. Contrôle du diff : aucune modification de ces chemins protégés, de `package.json`, du lockfile, de `.gitattributes` ou de `.gitignore`.

## 3. Audit du vrai GLB et photographie

Audit consigné dans le cadrage, sans réécriture du modèle source :

| Propriété | Observation |
| --- | --- |
| Source | `D:/Perso/SupportQrCode/Sauge_Noire_Menu_corrige (1).glb`, conservée hors Git |
| Conteneur / taille | glTF 2.0, 451 824 octets, taille déclarée conforme |
| SHA-256 | `fe0d2f932d2efafe3b2d305dbd66539839cac35ea19591f81098478217daac59` |
| Géométrie | 27 meshes, 27 nœuds, 27 primitives, 67 920 triangles, 42 878 sommets, 9 matériaux |
| Décodage | Draco réussi ; coordonnées/normales finies, normales unitaires, pas de face dégénérée au seuil audité |
| Extensions | `KHR_draco_mesh_compression`, `EXT_texture_webp` ; aucune ressource externe, animation ou skin |
| Dimensions | 1,892012 × 1,214 × 0,131096 unités glTF ; pages dans XY, face vers +Z |
| Textures | Cinq WebP embarqués : quatre 1024² et une normale papier 512² ; estimation RGBA8 + mipmaps 22,67 Mio, hors autres ressources |
| Papier | Métal 0, rugosité 0,94–0,96 ; matériaux conservés |
| Validation | glTF-Validator 2.0.0-dev.3.10 : zéro erreur, cinq avertissements `IMAGE_FEATURES_UNSUPPORTED`, 28 informations ; Draco vérifié séparément |

Quatre minuscules incohérences winding/normale sur les tranchefiles ont été documentées, aucune sur les pages imprimées ; pas de réparation sans défaut visible démontré. L’échelle réelle en mètres n’est pas attestée par le fichier. Aucune promesse de QR scannable ou de performance matérielle ne découle de cet audit.

Une seule photographie fournie est ajoutée à Git : WebP 1536 × 1024, 158 002 octets, SHA-256 `6a21dc7b4be8af2e0e76eb064660581ae215b1c1ea649b4672d2dd09e5535fa0`. Elle sert aux cartes, au téléphone HTML et au repli 2D. Les sources PNG/GLB restent hors Git ; aucune optimisation supplémentaire du GLB n’a été nécessaire à cette étape.

## 4. Hébergement et contrôles HTTP/CORS

Objet R2 public dans le bucket existant `vistaire-3d`, enregistré sous `immersive.presentation.digital` :

[GLB Sauge Noire publié](https://3d.vistaire.ca/marketing/immersive/20261027-digital/sauge-noire-menu-fe0d2f932d2efafe3b2d305dbd66539839cac35ea19591f81098478217daac59.glb)

Les contrôles du responsable de publication, documentés dans `docs/public-model-assets.md`, rapportent : lecture GET complète avec taille et SHA identiques ; GET/HEAD 200 ; MIME `model/gltf-binary` ; longueur exacte ; Range 206 ; objet manquant 404. ETag et Last-Modified sont présents. **Aucun en-tête Cache-Control observé** : la clé contient le hash mais le rapport ne revendique pas un cache HTTP immutable.

Les fetchs Chromium depuis les origines de production www/apex, `http://localhost:3000` et une origine suivant le motif de branche Vercel ont retourné 200 et le même hash/taille. La politique CORS globale n’a pas été modifiée. `http://127.0.0.1:3000` n’est pas autorisé par cette politique ; la QA 3D utilise `localhost`.

Fetch Chromium sur l’origine exacte `https://vistaire-3g8aifjyp-capoships-projects.vercel.app` : 200, 451 824 octets et SHA complet identique. Le contrôle de l’application réelle sur `https://vistaire-byda3wsah-capoships-projects.vercel.app` au code `719cbb97` charge aussi le GLB avec succès, sans interception de document ni réécriture des requêtes. Un premier probe qui interrompait les scripts avait échoué ; la vérification isolée et l’application réelle ont levé ce doute. Aucun réglage CORS modifié. Les 72 entrées historiques du manifeste gardent leurs identités et chemins locaux ; Digital n’invente ni fichier local de secours ni redirect historique.

## 5. Comportement de la scène inspecté

Le loader existant tourne le livre de −π/2 sur X, normalise sa largeur uniformément, puis le pose sur la table. Le shot `pricing-digital` donne une vue oblique haute ; le showroom permet sa rotation autour de Y. Les autres scènes du landing conservent une présentation physique lorsque Digital est sélectionné.

Les cinq choix commerciaux sont distincts des quatre supports physiques. Les requêtes sont dédupliquées, les modèles chargés réutilisés, et l’objet précédent reste disponible jusqu’à l’arrivée du suivant. Le pricing charge l’ouverture puis le prochain support après 45 % du chapitre ; il ne précharge plus toute la collection au reveal. Un échec retire la promesse du cache et permet une nouvelle tentative après changement/re-sélection. Les requêtes sont annulées à la destruction, les décodages tardifs libérés et le décodeur Draco partagé conservé.

Un échec de modèle reste local, affiche une photo et libère l’écran d’attente ; il ne démonte pas toute la scène. L’indisponibilité WebGL du landing utilise un avis non modal. Le téléphone tarifaire reste en HTML, avec mesure existante de la hauteur de lecture ; aucune miniature GLB n’y est ajoutée. Les propriétés reduced-motion et les gestes existants sont conservés. **La preuve comportementale finale et le rendu réel relèvent de la QA ci-dessous.**

## 6. Provenance, revues et corrections

| Rôle / étape | Commit présent dans le paquet d’intégration | Responsabilité |
| --- | --- | --- |
| D — contrats de test | `2608c2f1` | Tests prix, présentation et invariants physiques |
| C — interface commerciale | `207d5eb3` | Digital premier dans les cartes/téléphone, photo et présentation tarifaire |
| A — contrat et connaissances | `4c072412` | Prix FR/EN, calculateur, FAQ et découverte |
| B — scène et manifeste | `f30b03fa` | Vrai livre, chargement, transitions, repli et CDN |
| Principal / D — intégration et QA | `37d439d7`, `719cbb97` | Publication, validations, corrections constatées en navigateur et PR |

Revue indépendante de la branche intégrée : aucun défaut P0/P1/P2 démontré par inspection statique. Contrat commercial, cycle de vie des modèles, préchargement, distinction des présentations, repli, SEO et tests ont été lus directement. La revue ne certifie pas les comportements matériels ou visuels non exécutés.

Corrections ensuite vérifiées en revue ciblée :

1. Le navigateur du principal a montré un livre d’environ 89 × 64 px à 390 px : le texte du premier chapitre réduisait le cadre 3D à environ 72 px de haut. Une assertion renforcée a échoué avant correction. Le texte de scène a été raccourci, en conservant prix, identité et mention illustrative/sans support ; la description complète reste dans les cartes. L’assertion exige désormais au moins 180 px de largeur (ou la moitié du viewport si moindre) et 100 px de hauteur, sans sortie du viewport.
2. La simulation HTTP 503 affichait la photo mais pouvait maintenir le verrou de chargement en attendant la salle. `onSupportError` libère maintenant `held` dès l’erreur, sans interrompre la scène.
3. Le filtre de requêtes E2E omettait le nom du fichier Acrylique. Il utilise maintenant les entrées physiques du manifeste public, y compris Acrylique et les variantes de scène.
4. Les sélecteurs de typographie et du dashboard ont été alignés sur les composants existants ; aucune modification produit de police/dashboard n’a été faite pour satisfaire ces tests.

Verdict de la revue ciblée : aucun nouveau P0/P1/P2 identifié ; modifications proportionnées aux défauts observés. Les résultats et leurs relances figurent ci-dessous. Une dernière revue ciblée a confirmé zéro P0/P1/P2 sur le filtrage des deux textures imprimées et les corrections des assertions mobiles.

## 7. Justification fichier par fichier

Inventaire final : 43 chemins d’implémentation et ce rapport, soit 44 fichiers. Les dernières modifications après la version d’aperçu concernent les assertions E2E et la documentation.

| Chemin | Nécessité |
| --- | --- |
| `AGENTS.md` | Bloc de dix lignes généré par Next, conservé conformément aux instructions du dépôt |
| `components/immersive/App.jsx` | Cinquième sélection, clavier, libellés et repli non bloquant du showroom |
| `components/immersive/CinematicPage.d.ts` | Typage du chapitre Digital et de la locale |
| `components/immersive/CinematicPage.jsx` | Ouverture/prochain modèle utile, repli local et libération de l’attente sur erreur |
| `components/immersive/LandingFaq.jsx` | Explication FR/EN de Digital sans support et délai conditionnel |
| `components/immersive/PageShots.js` | Vue du livre horizontal et entrée/sortie d’Acrylique devenu deuxième chapitre |
| `components/immersive/Pricing.jsx` | Première carte HTML Digital, prix partagés, photo et exclusions |
| `components/immersive/Scene.jsx` | Composition du livre, propriété physique hors showroom, erreurs locales et préchargement ciblé |
| `components/immersive/SupportModels.js` | Rotation, mise à l’échelle, ancrage et filtrage des deux textures imprimées du livre, dans le loader existant |
| `components/immersive/content.js` | Séparation quatre supports/cinq présentations, prix dérivés du contrat partagé |
| `components/immersive/locale.jsx` | Traduction des nouveaux libellés et exclusions |
| `components/immersive/pricing.css` | Photo Digital entière et mention lisible dans le téléphone |
| `components/immersive/styles.css` | Avis non modal et photographie de repli |
| `components/vistaire-preview/PricingTableEstimator.tsx` | Digital fixe sans quantité de supports, exclusions et CTA |
| `components/vistaire-preview/VistairePricingPreview.module.css` | Grille cinq offres lisibles et photo Digital en contain |
| `components/vistaire-preview/VistairePricingPreview.tsx` | Premier chapitre Digital et texte réduit pour le cadrage mobile |
| `docs/faq-knowledge/05-tarifs.md` | Cinq offres, prix Digital et exclusions dans les réponses commerciales |
| `docs/faq-knowledge/06-restaurateurs.md` | Étapes et délais sans fabrication systématique pour Digital |
| `docs/faq-knowledge/manifest.json` | Métadonnées du corpus modifié |
| `docs/marketing-photography.json` | Provenance/identité de la photo partagée |
| `docs/marketing-photography.md` | Documentation du partage intentionnel de la photo Digital |
| `docs/public-model-assets.md` | Publication réelle, HTTP/CORS, limites du cache et manifeste CDN-only |
| `docs/superpowers/plans/2026-10-27-vistaire-digital.md` | Plan approuvé, ownership, contrats et critères de validation |
| `docs/superpowers/specs/2026-10-27-vistaire-digital-design.md` | Cadrage, audit source et acceptation approuvés |
| `e2e/ci-smoke.spec.ts` | Contrats smoke alignés sur cinq offres |
| `e2e/landing-offers.spec.ts` | Cinq offres et liens du parcours landing |
| `e2e/landing-redesign.spec.ts` | Régression landing actualisée pour Digital |
| `e2e/mvp-smoke.spec.ts` | Smoke MVP aligné sur les cinq offres, CTA réel et modèles de scène autorisés |
| `e2e/pricing-page.spec.ts` | Vrai GLB, dimensions, cache, panne, FR/EN, six viewports et contrats UI actuels |
| `lib/agent-discovery/pageMarkdown.ts` | Catalogue textuel et totaux annuels dérivés des données partagées |
| `lib/pricingCalculator.ts` | Court-circuit Digital fixe et calcul annuel partagé |
| `lib/pricingPage.ts` | Source de vérité cinq offres FR/EN, inclusions, workflow et JSON-LD |
| `lib/publicModelAssets.json` | Identité SHA/taille et URL réelle du seul nouveau modèle CDN |
| `lib/publicModelAssets.ts` | Entrée sans legacy fictif, sans affaiblir la résolution historique |
| `lib/seoMarketingImages.ts` | Enregistrement de la photo Digital et alt FR/EN |
| `public/images/marketing/vistaire-digital-sauge-noire.webp` | Unique image légère fournie, cartes/téléphone/repli |
| `tests/immersive-loading-locale.test.mjs` | Orientation, proportions, ancrage et distinction des quatre supports |
| `tests/landing-collection-copy.test.mjs` | Lecture du vrai catalogue physique au lieu de son ancienne forme littérale ; variable inutilisée retirée |
| `tests/landing-pricing-phone.test.mjs` | Première carte Digital HTML et prix cohérents |
| `tests/marketing-photography-unique.test.mjs` | Réemploi intentionnel de Digital, unicité physique conservée |
| `tests/pricing-table-estimator.test.mjs` | Prix Digital invariant, totaux annuels et barèmes physiques |
| `tests/public-model-assets.test.mjs` | Contrat CDN-only et identités des assets historiques |
| `tests/tarifs-carte-vistaire-public.test.mjs` | Cinq offres publiques FR/EN, prix et données structurées |
| `docs/superpowers/reports/2026-10-27-vistaire-digital-verification.md` | Rapport unique des preuves, limites et justification du diff |

## 8. Commandes et résultats

Environnement : Windows, Node 24.11.0, npm du lockfile. Les tests locaux utilisent le serveur Next de production sur `http://localhost:3000` et les fixtures Supabase `http://127.0.0.1:55434`. Aucun opt-in Supabase de production n’a été activé ; aucune clé réelle ou fichier `.env` n’a été ajouté.

| Contrôle | Commande réellement exécutée | Résultat |
| --- | --- | --- |
| Assets | `npm.cmd run assets:check` | PASS, 2 174 fichiers, 97 exceptions historiques |
| LFS | `npm.cmd run lfs:check` | PASS, zéro règle et zéro pointeur actif |
| Lint global | `npm.cmd run lint` | PASS, zéro avertissement |
| Lint après dernières modifications | `node node_modules/eslint/bin/eslint.js components/immersive/SupportModels.js tests/immersive-loading-locale.test.mjs e2e/pricing-page.spec.ts --max-warnings=0`, puis même commande pour `e2e/landing-offers.spec.ts` | PASS |
| Types | `npm.cmd run typecheck` | PASS |
| Build final | `npm.cmd run build` | PASS, compilation 29,7 s et vérification TypeScript 41 s ; fixtures locales et clés Clerk fictives |
| Node complet | `node --test --test-concurrency=2 --test-reporter=tap 'tests/*.test.mjs'` | 2 253 tests : 2 240 pass, 7 fail, 1 cancelled, 5 skipped ; 31 min 28 s |
| Node ciblé après correctif final | Commande ci-dessous | 79/79 PASS |

```powershell
node --test --test-reporter=dot tests/pricing-table-estimator.test.mjs tests/tarifs-carte-vistaire-public.test.mjs tests/immersive-loading-locale.test.mjs tests/public-model-assets.test.mjs tests/landing-pricing-phone.test.mjs tests/landing-pricing-runtime.test.mjs tests/landing-collection-copy.test.mjs tests/marketing-photography-unique.test.mjs tests/faq-rag.test.mjs tests/agent-discovery.test.mjs tests/landing-camera-fit.test.mjs
```

La suite complète ne constitue pas une validation entièrement verte :

- Quatre échecs `admin-studio-heatmap.test.mjs` / `admin-studio-metric-explorer.test.mjs` : liaison de module Recharts/Redux avec les hooks VM Node 24.
- `ci-workflow-contract.test.mjs` : l’environnement transmis est perdu par le Bash WSL de cette machine.
- `maison-elyse-ci-contract.test.mjs` : expression LF contre un fichier CRLF.
- Ces six échecs ont été reproduits sur le worktree A sans les changements de scène/UI et leurs fichiers sont inchangés depuis `origin/main`.
- `owner-pipeline-console.test.mjs:88` : démarrage hors délai pendant la suite ; relance isolée PASS 1/1 en 1,78 s avec `node --test --test-name-pattern='console: authenticated generation, downloads, choices and restart preserve results' tests/owner-pipeline-console.test.mjs`.
- `production-3d-final-pipeline.test.mjs:1433` : comparaison visuelle de neuf variantes dépassant le délai existant de 600 000 ms, comptée cancelled. Seul son sous-processus de fixture identifié a été arrêté après expiration. Le pipeline n’est pas modifié ; la matrice lourde restante n’est pas validée et n’a pas été relancée.
- Cinq skips existants : extraction PDF faute de Poppler et quatre tests USDZ faute d’OpenUSD/Pillow/Blender. Ils ne concernent pas le livre WebGL.

## 9. Playwright, navigateur et appareils

Pour les commandes suivantes, le serveur de production et les fixtures locales sont déjà lancés :

```powershell
$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
```

| Commande / scénario exécuté | Résultat observé |
| --- | --- |
| `npm.cmd run test:e2e -- e2e/pricing-page.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only` | 4 pass, 2 fail initialement ; les deux échecs ont été diagnostiqués puis relancés ci-dessous |
| Livre réel, six cadrages, quatre modèles physiques et retour Digital | PASS : 360/390/430/768/1280/1440 px, livre entier de taille utile, une requête du livre dans cette scène, pas d’USDZ |
| Tarifs FR/EN, métadonnées, OfferCatalog, verre et aperçu Pilotage | PASS ; cinq offres, prix, CTA et typographie existante |
| `npm.cmd run test:e2e -- e2e/pricing-page.spec.ts --grep 'failed book|six required responsive' --project=chromium --workers=1 --retries=0 --forbid-only` | Repli 503 PASS ; contrôle responsive d’abord arrêté par une image lazy après fermeture du menu, corrigé puis PASS dans le groupe suivant |
| `npm.cmd run test:e2e -- e2e/pricing-page.spec.ts e2e/landing-redesign.spec.ts e2e/landing-offers.spec.ts --grep 'six required responsive|collections support keyboard|failed full scene|projected offers|keyboard reads every offer|unavailable hand' --project=chromium --workers=1 --retries=0 --forbid-only` | 6 pass, 2 assertions anciennes échouées : noms FR sur `/en`, quatre cartes dans le repli ; corrigées et relancées ci-dessous |
| Responsive final | PASS six largeurs, grilles 1/2/3 colonnes, images décodées, navigation repliée accessible, aucune sortie horizontale |
| Téléphone FR 390 px / desktop 1440 px et thèmes | PASS : cinq cartes, prix, photos, Pilotage, FAQ et footer ; projection et cache conservés |
| Clavier et absence WebGL | PASS : cinq choix, rotation accessible, photo sans blocage, relance de la scène ; lecture de toutes les offres, FAQ puis retour |
| `npm.cmd run test:e2e -- e2e/landing-offers.spec.ts --grep '430-en: projected|unavailable hand|portrait to landscape|normal-motion pricing links' --project=chromium --workers=1 --retries=0 --forbid-only` | 5/5 PASS : anglais 430 px, orientation, main indisponible, ancres/history et animations normales 390/1440 px |
| Groupe incluant `e2e/ci-smoke.spec.ts`, filtre `CI smoke` | Les cinq cas CI ont PASS : landing, découverte sans AR anticipée, admin fermé/métadonnées, estimateurs FR/EN. Groupe interrompu volontairement après ces cinq cas pour séquencer les rendus lourds ; les autres cas ont été exécutés séparément ci-dessus |
| `npm.cmd run test:e2e -- e2e/pricing-page.spec.ts --grep 'publishes the same|failed book' --project=webkit --workers=1 --retries=0 --forbid-only` | 1 pass, 1 fail : repli 503 et récupération physique PASS ; assertions commerciales FR/EN atteintes, contrôle final de console en échec sur une erreur de contrôle d’accès signalée sur le préchargement RSC de `/localhost:3000/?_rsc=…` pendant la navigation. Ce test n’est pas déclaré vert |
| `npm.cmd run test:e2e -- e2e/landing-scroll.spec.ts --grep 'Chromium trusted touch: pricing edges' --project=chromium --workers=1 --retries=0 --forbid-only` | Échec reproduit deux fois à l’interruption/reprise d’un trajet ; le test ne termine pas sa section de lecture tactile. La trace montre un touchstart horodaté 52 546 ms traité à 54 490 ms, après achèvement du trajet à 54 479 ms. Ce retard de traitement observé dans le rendu logiciel est documenté, sans correction du moteur de scroll hors périmètre ni revendication de validation tactile complète |

Les assertions anciennes ont été alignées sur le comportement produit autorisé ; aucune police, dashboard, navigation ou logique de scroll n’a été modifiée pour les rendre vertes. Le test d’erreur attend explicitement le chargement du support physique récupéré, jusqu’au budget réseau existant de 120 s.

Contrôles HTTP manuels : `/`, `/en`, tarifs FR/EN, rendez-vous FR/EN et contact FR/EN retournent 200 ; canoniques corrects, cinq cartes dans les tarifs. Aucun formulaire soumis. Les vérifications Chromium pertinentes contrôlent les erreurs runtime/hydratation, les réponses 404/500 et les modèles téléchargés ; une capture seule n’a pas servi de preuve réseau.

### Contraste du papier et contrôle de preview

Les captures ont révélé une impression trop pâle. Analyse complémentaire : 330/330 rayons de la géométrie décodée atteignent les pages imprimées en premier ; normales et UV sont corrects. Le décodage 2D Chromium des WebP embarqués reproduit exactement les quantiles Sharp ; pas de défaut ICC ni de feuille opaque par-dessus. Une comparaison à caméra identique a confirmé que les niveaux mip réduits effaçaient les traits fins. Le réglage conservé est uniquement `LinearFilter` sur les deux maps d’impression Digital. Couverture, matériaux PBR, rugosité, éclairage, géométrie et supports physiques restent inchangés. Le test de portée a échoué avant correction, puis passe.

Contrôle Chromium réel sur `https://vistaire-byda3wsah-capoships-projects.vercel.app`, révision `719cbb9725d1613137191c93ee06349624cfe391` :

- Page tarifs aux largeurs 390 et 430 px : vrai canvas prêt, livre prêt, déplacement dans le chapitre, captures examinées et aucune sortie horizontale.
- Landing à `/#product` : cinq onglets ; chargement effectif Digital/Acrylique/Sculpté/Carré/Signature puis retour Digital ; aucune nouvelle requête du livre lors des changements après son premier chargement dans cette scène. Rotation clavier +15° puis retour 0°.
- Lecture à `/#open-weight` : cinq cartes et main prêtes ; geste tactile Chromium CDP sur le téléphone, déplacement de la lecture de `scrollY=60346` à `60612`, soit 266 px. Ceci prouve le geste de lecture courant, pas le scénario d’interruption qui reste en échec plus haut.
- Collecte de l’ensemble du parcours : zéro `pageerror`, zéro erreur console et zéro réponse 4xx/5xx de la preview ou du CDN. Les ressources AR ne sont pas demandées. La liste des téléchargements confirme le chargement au besoin des supports visités.
- Captures utiles et preuve JSON conservées hors Git dans le dossier de visualisations de la tâche : `digital-preview-390.png`, `digital-preview-430.png`, `digital-preview-showroom-390.png`, `digital-preview-evidence.json` et `digital-touch-interruption-evidence.json`. Aucun screenshot de debug dans la PR.

### Limites de preuve

Le rendu software et les captures ne prouvent pas 60 FPS, consommation thermique, mémoire matérielle, inertie iPhone ou qualité sur tous les GPU. Les textures imprimées sont en 1024² : les très petits caractères restent sous-échantillonnés ; le filtre retenu peut produire du scintillement sur traits fins. Aucun scan QR réussi, Quick Look iPhone ou Scene Viewer Android sur appareil réel n’est revendiqué. La matrice publique/SEO/AR complète, les tests admin fonctionnels et les migrations n’ont pas été exécutés : hors changement et sans besoin de mutation de production.

## 10. Nettoyage et clôture

- Serveurs Next et fixture locaux arrêtés ; les navigateurs de QA ont été fermés. Le sous-processus de comparaison expiré a été arrêté après vérification de son ascendance, sans toucher aux processus partagés.
- `.next`, `test-results` et `asset-review/digital-qa` supprimés après vérification des chemins absolus dans le seul worktree d’intégration ; aucun `playwright-report` présent. Captures de debug, textures extraites et essais d’éclairage retirés du dossier de visualisations. Seules les captures/preuves finales utiles et le cadrage approuvé restent hors Git.
- Trois worktrees A/B/C archivés via l’application avec snapshot récupérable ; worktree d’intégration conservé pour revue. Le checkout utilisateur initial reste au SHA `104eb1c45b6ba966cb4a0e3f8a86c304db92a072`, avec ses seuls changements préexistants `AGENTS.md` et `.claude/`.
- `git diff --check` sans erreur ; absence de nouveau log de debug, `debugger`, secret, `.env`, GLB lourd, dépendance ou règle LFS dans le diff. Le seul nouveau binaire est le WebP de 158 002 octets.
- Base d’ascendance confirmée par `git merge-base HEAD origin/main` : `9e5cae0270af704931cb15c2ebc2c23cab2c624c`. État final de la PR : brouillon #321, non mergée. Le commit de ce rapport est poussé normalement sur la même branche ; aucun deuxième PR.
- Les échecs Node/WebKit/tactile et la comparaison expirée restent des limites explicites de validation, pas des résultats verts. La revue sur appareils physiques avant merge reste nécessaire pour le ressenti tactile et les traits fins en mouvement.

Le diff reste celui de l’offre Digital, du livre, de sa photographie et de leurs contrats/tests/documentation. Aucun merge vers `main`, aucune réécriture d’historique et aucune suppression de production.


## 11. Suivi — descriptions et CI

Demande : chaque carte décrit sa propre différence, avec des descriptions FR/EN comparables ; les services digitaux communs sont explicités avant les cartes. Les prix, options, modèles, routes et contrats restent identiques. La même PR #321 reste brouillon, sans merge.

- `lib/pricingPage.ts` : Digital décrit la réutilisation des menus/supports existants et le QR livré numériquement ; Acrylique le panneau transparent et sa base bois ; Sculpté l’angle arrondi sculpté ; Carré le format compact et les finitions ; Signature la silhouette horizontale et l’insert amovible. Menu, QR personnalisé, photos sur place et jusqu’à cinq plats en 3D sont communs aux cinq offres.
- `components/vistaire-preview/VistairePricingPreview.tsx` : ce rappel commun est déplacé avant les cartes, avec les styles existants. Aucun allongement artificiel ni refonte de grille.
- `e2e/pricing-page.spec.ts` : le parcours FR/EN vérifie le rappel des cinq offres et de la 3D.
- `e2e/restaurateur-preview.spec.ts` : le helper attend la disparition du préchargement avant de faire défiler la vidéo dans le viewport ; attente fixe retirée, assertions autoplay/lecture/isolement conservées.
- `package.json`, `package-lock.json` : Next.js et eslint-config-next 16.4.3, DOMPurify 3.4.17, Zod 4.6.7 ferment les avis détectés par l’audit. Pas de nouvelle dépendance ni de changement majeur.
- `ci/npm-audit-baseline.json` : nouvelle empreinte du lock et aucune exception ; audit neuf à zéro vulnérabilité. `docs/ci-supply-chain.md` décrit ce nouvel état.
- `tests/menu-mutation-cache-invalidation.test.mjs` : le fixture utilise `executeRequest` et la factory userland de Next 16.4.3, remplaçant l'ancienne méthode interne `do` supprimée. Les assertions de réponse et de revalidation restent identiques ; aucun code de mutation applicatif n'est changé.
- `docs/public-model-assets.md` : le CORS R2 accepte désormais aussi l’origine exacte `http://127.0.0.1:3000`, utilisée par la CI. Méthodes GET/HEAD et autres origines conservées ; aucune permission d’écriture ou wildcard supplémentaire.

Les journaux GitHub du head `2d9a5b66` identifient les causes : les shards Chromium 1/6 et 2/6 échouaient sur le preload GLB refusé par CORS depuis 127.0.0.1 ; WebKit 2/2 attendait autoplay alors que le scroll pouvait encore être retenu par le chargement initial ; l’audit bloquait six avis nouveaux. Les autres jobs étaient verts. Les assertions et gardes de CI n’ont pas été désactivées.

Preuves déjà observées :

- Audit frais : `npm audit --package-lock-only --json`, zéro vulnérabilité ; `node scripts/ci/check-npm-audit-baseline.mjs … ci/npm-audit-baseline.json` passe ; `node --test tests/dependency-security-contract.test.mjs` passe 3/3.
- HTTP CDN : GET 200 et empreinte exacte du GLB pour 127.0.0.1, localhost et www ; pas de CORS accordé à `https://not-allowed.example`.
- Le nouveau job GitHub « npm audit baseline » passe sur `6b54e6c25ea66628ac4b8a2b2c5fcfe5957174a9`.

Sources des correctifs de sécurité : [Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [DOMPurify](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Les plages et versions résolues ont également été contrôlées par le registre npm et l’audit neuf.

Validation locale du suivi :

- `npm ci --no-audit --no-fund` : installation propre réussie, préparation du runtime USDZ existant vérifiée.
- `npm run assets:check` : passe, 2 174 fichiers et 97 exceptions historiques ; `npm run lfs:check` : passe, aucune règle ou pointeur LFS actif.
- `npm run lint`, `npm run typecheck`, `npm run build` : passent. Build Next 16.4.3 avec les seules données et clés factices des fixtures locales, aucune configuration Supabase externe.
- `node --test --test-reporter=tap tests/menu-mutation-cache-invalidation.test.mjs tests/tarifs-carte-vistaire-public.test.mjs tests/pricing-table-estimator.test.mjs tests/landing-collection-copy.test.mjs tests/dependency-security-contract.test.mjs tests/dashboard-walkthrough-media.test.mjs` : 29/29 passent, aucun skip.
- QA Chromium de la [nouvelle preview](https://vistaire-4c1impm9b-capoships-projects.vercel.app/tarifs-menu-digital-restaurant) : FR/EN à 390, 430 et 1280 px ; cinq descriptions distinctes, inclusions communes présentes, zéro débordement, erreur console/page ou réponse HTTP 4xx/5xx pertinente. Captures examinées ; preuves hors Git `digital-offer-copy-390.png`, `digital-offer-copy-430.png`, `digital-offer-copy-1280.png`, `digital-offer-copy-evidence.json` dans le dossier de visualisations de la tâche.

Les commandes E2E suivantes utilisent `CI=true` et `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000`, les fixtures Supabase locales et le build de production ; aucun opt-in de production :

- `npm.cmd run test:e2e -- e2e/ci-smoke.spec.ts e2e/pricing-page.spec.ts --grep 'Pricing table estimator|publishes the same five offers|six required responsive' --project=chromium --workers=1 --retries=0 --forbid-only` : 4/4 passent, aucun retry ; estimateur FR/EN, inclusions et cinq cartes FR/EN, six viewports 360/390/430/768/1280/1440.
- `npm.cmd run test:e2e -- e2e/restaurateur-preview.spec.ts --grep 'non-interactive looping video' --project=chromium --workers=1 --retries=0 --forbid-only` : 2/2 passent, incluant autoplay, boucle, visibilité et absence d'accès aux données privées.
- Même commande vidéo avec `--project=webkit` : 0/2 en local Windows. Les attributs et l'arrivée autoplay passent, puis `videoWidth/videoHeight` vaut 703 × 456 au lieu de 1166 × 756 ; le reste du scénario n'est donc pas vérifié par cet essai. Ce résultat n'est pas présenté comme vert et l'assertion n'a pas été assouplie. Les deux shards WebKit Linux de la CI passent sur le même code.

Sur `c2834d9c7bba295fbd65f7948196023d47170c0e`, les 24 check runs GitHub passent : [App CI et son CI Gate](https://github.com/MarcSaad-Hadidi/Vistaire/actions/runs/40555350306), [audit et sécurité des workflows](https://github.com/MarcSaad-Hadidi/Vistaire/actions/runs/40555350449), [politique des assets](https://github.com/MarcSaad-Hadidi/Vistaire/actions/runs/40555350405), [CodeQL](https://github.com/MarcSaad-Hadidi/Vistaire/actions/runs/40555350222). Ceci inclut les six shards publics Chromium, Sauge Noire, les deux shards admin, les deux shards WebKit, les contrats DB, le build et les contrôles statiques. Vercel signale success pour le commit de tests ignoré par sa règle de build ; la preview réellement construite et examinée reste celle de `6b54e6c2` liée ci-dessus. Les exécutions distantes vérifient la sélection critique définie par la CI, sans revendiquer la suite exhaustive hors sélection.

Nettoyage du suivi : serveurs de tests et fixtures arrêtés par le runner, sorties `.next` et `test-results` retirées après vérification des chemins absolus ; aucun `playwright-report` présent. Captures et JSON utiles restent hors Git. `git diff --check` passe ; aucun secret, `.env`, log de debug, nouvelle dépendance ou nouvel asset n'est ajouté par ce suivi. Le checkout utilisateur reste au SHA `104eb1c4` avec ses seuls changements préexistants. Le diff reste limité aux descriptions, à leurs vérifications et aux causes réelles des checks rouges ; même PR brouillon #321, aucun merge.

Limites restantes : la suite Node exhaustive du bilan initial n'a pas été relancée ; aucune validation Quick Look, Scene Viewer, ressenti tactile ou performance sur appareil réel. L'écart de dimensions WebKit Windows ci-dessus reste explicite.
