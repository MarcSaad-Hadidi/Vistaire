# Vistaire Digital — cadrage d’intégration

Statut : audit et proposition avant implémentation, 27 octobre 2026. Aucun changement produit, upload ou PR réalisé.

## Résultat demandé

Livrer une seule PR brouillon ajoutant Vistaire Digital comme première de cinq offres commerciales sur le landing et les tarifs FR/EN. Digital coûte 1 500 CAD de mise en place + 200 CAD/mois, engagement initial de 12 mois, taxes en sus. Les frais de mise en place sont payables avant le projet ; l’abonnement commence à la mise en ligne.

Le livre Sauge Noire ouvert est un véritable objet 3D illustratif dans le showroom et un premier chapitre cinématique dédié sur les tarifs. Une photographie légère sert aux cartes, au téléphone HTML et au repli 2D. Aucun support, livre, impression, fabrication, livraison ni installation physique n’est inclus dans Digital. Le QR est livré numériquement pour un menu papier ou un support existant. Son fonctionnement visible dans le modèle n’est pas promis sans vérification.

Les quatre offres physiques conservent leurs montants 2 000/2 050/2 100/2 200 CAD, leur mensuel de 200 CAD, jusqu’à vingt supports et leurs suppléments 40/45/55/55 CAD. Pilotage +100 CAD/mois et les packs 3D restent inchangés.

## État constaté

- Checkout : `C:/Users/hadid/Vistaire`, branche `feat/privacy-consent-legal-compliance`, HEAD `104eb1c45b6ba966cb4a0e3f8a86c304db92a072`.
- Après `git fetch origin`, `origin/main` = `9e5cae0270af704931cb15c2ebc2c23cab2c624c` ; le checkout contient 31 commits supplémentaires étrangers à Digital.
- Travaux utilisateur présents : `AGENTS.md` modifié et `.claude/` non suivi. Ils doivent rester intacts. Ne pas travailler sur cette branche ni reprendre ses versions des fichiers de découverte/contact.
- Aucun artefact de worktree attaché à ce chat. Aucune branche distante contenant « digital » trouvée ; la recherche des titres de PR Digital ne révèle pas cette intégration.
- `package-lock.json` et les scripts de `package.json` confirment npm. Les dépendances Three, glTF-Transform, Draco, Sharp et Playwright existent déjà.
- Les fichiers pricing, scène et catalogue visés sont identiques à `origin/main`. Les modules de découverte, du chrome public et certaines dépendances diffèrent sur la branche courante : utiliser la base propre.

## Fichiers fournis retrouvés

Tous sont dans `D:/Perso/SupportQrCode/`. Les deux chemins d’image initiaux omettaient ce sous-dossier.

| Source | Octets | Dimensions / identité |
| --- | ---: | --- |
| `Sauge_Noire_Menu_corrige (1).glb` | 451 824 | SHA-256 `fe0d2f932d2efafe3b2d305dbd66539839cac35ea19591f81098478217daac59` |
| `sauge_noire_menu_complet_final.png` | 2 181 968 | 1536 × 1024 ; source conservée hors Git |
| `vistaire-digital-sauge-noire.webp` | 158 002 | 1536 × 1024 ; SHA-256 `6a21dc7b4be8af2e0e76eb064660581ae215b1c1ea649b4672d2dd09e5535fa0` |

Les deux images ont été ouvertes et inspectées : livre ouvert, pages crème, texte sombre, identité Sauge Noire et QR en bas à droite. Un seul WebP runtime sera réutilisé ; pas de duplication artificielle pour satisfaire un test d’unicité.

## Audit réel du GLB

- Conteneur et glTF 2.0, taille déclarée conforme ; générateur glTF-Transform 4.4.2.
- 27 meshes, 27 nœuds sans transformation, 27 primitives triangulaires, 67 920 triangles, 42 878 sommets, 9 matériaux ; environ 27 draw calls par passe avant ombres.
- Aucune animation, skin ou ressource externe. Extensions requises : `KHR_draco_mesh_compression` et `EXT_texture_webp`, prises en charge par le loader existant.
- Décodage Draco réussi avec glTF-Transform installé. Coordonnées et normales finies ; normales unitaires ; aucune face dégénérée au seuil de l’audit.
- Quatre minuscules incohérences entre winding et normale sur les deux tranchefiles, surface par triangle d’environ 0,0000001 unité² ; aucune sur les pages imprimées. Pas de réparation sans défaut visible démontré.
- Bounding box décodée : minimum (-0,946 ; -0,607 ; -0,0694202), maximum (0,946012 ; 0,607 ; 0,0616756), dimensions (1,892012 ; 1,214 ; 0,131096) unités glTF. Le pivot est près de la charnière, les pages sont dans XY, leur face avant vers +Z. Les dimensions physiques voulues ne sont pas attestées par le fichier : calibrage visuel uniforme dans la scène existante, sans déformation.
- Cinq WebP embarqués : pages gauche/droite, cuir et normale cuir en 1024² ; normale papier en 512². Mémoire texture estimée RGBA8 avec mipmaps : 22,67 Mio, hors géométrie, ombres, scène et render targets. Les noms de matériaux mentionnent 4096 alors que les textures réelles sont en 1024.
- Papier : métal 0, rugosité 0,94–0,96. Garder les matériaux et la résolution actuels ; aucune optimisation supplémentaire justifiée avant mesure.
- glTF-Validator installé 2.0.0-dev.3.10 : zéro erreur, cinq avertissements `IMAGE_FEATURES_UNSUPPORTED` sur les profils des WebP, 28 informations dont absence de validation interne du Draco. Le décodage séparé réussit ; le navigateur doit encore prouver la couleur, la typographie et le QR.

## Approche et limites

Une extension locale du moteur existant est la seule approche retenue pour le plan : elle répond au brief sans moteur ni bibliothèque de scroll supplémentaire. Un remplacement par une image 2D dans la scène manquerait le critère principal ; une refonte du moteur n’est pas justifiée.

Séparer explicitement les cinq offres commerciales, les quatre supports physiques et les objets 3D de présentation. Garder les interfaces et patterns existants lorsque leur sens reste correct. Ajouter seulement le discriminant commercial et l’identité Digital nécessaires ; pas de système générique de catalogue ou de migration.

Hors périmètre : admin, auth, analytics, base de données, paiement, AR du livre, USDZ, refonte générale, modifications de `public/models`, `public/videos`, `public/frames`, `3D Plat` et `3D photo`. Aucun fichier GLB dans Git, aucune nouvelle dépendance ou règle LFS. Pas de merge vers main.

## Contrats d’interface

1. Commercial : ID Digital distinct, `kind: digital | physical`, ordre Digital/Acrylique/Sculpté/Carré/Signature ; prix et mensuel partagés par les consommateurs. Conserver le type et le barème des quatre supports physiques. Le calculateur retourne le prix Digital fixe avant toute logique de supports. Le total annuel se dérive au même endroit : mise en place + 12 × mensuel.
2. Scène : identité de présentation Digital et shot `pricing-digital`, indépendants de la promesse d’un support livré. Garder le support Acrylique prévu dans les autres scènes du landing ; sélectionner le livre uniquement dans la découverte Digital et ses chapitres.
3. UI : conserver les ancres et CTA existants, ajouter `#collection-digital`. CTA FR `/prendre-rendez-vous`, EN `/en/book-a-call`. Afficher « Aucun support physique inclus » / « No physical display included », et préciser le caractère illustratif du livre.
4. Asset : nouvelle entrée de manifeste uniquement après disponibilité CDN et contrôles complets. Pour cette entrée CDN-only, permettre l’absence d’un ancien chemin local ; ne pas inventer une URL locale ni un fichier de secours absent. Les 72 entrées existantes restent identiques, leurs vérifications locales et redirects restent applicables.

## Changements prévus et justification

| Zone / fichiers | Nécessité |
| --- | --- |
| `lib/pricingPage.ts`, `lib/pricingCalculator.ts` | Contrat cinq offres FR/EN, Digital fixe, totaux annuels, inclusions/exclusions, workflow conditionnel et OfferCatalog exact |
| `docs/faq-knowledge/05-tarifs.md`, `06-restaurateurs.md`, métadonnées documentaires applicables | Réponses commerciales et étapes sans promesse automatique de fabrication physique |
| `lib/agent-discovery/pageMarkdown.ts`, `components/immersive/LandingFaq.jsx` | Découverte et FAQ alignées avec les cinq offres et les limites réelles |
| `components/immersive/content.js`, `App.jsx`, `locale.jsx` | Présentation Digital et cinq choix de découverte ; conserver le catalogue physique et supprimer la duplication des montants consommés |
| `components/immersive/SupportModels.js`, `Scene.jsx` | Orientation/échelle du livre, sélection, erreurs locales, réutilisation et cycle GPU |
| `components/immersive/PageShots.js`, `CinematicPage.jsx`, `CinematicPage.d.ts` | Shot Digital, transitions réversibles, typage et chargement utile au lieu de tous les modèles dès le reveal |
| `lib/publicModelAssets.json`, `lib/publicModelAssets.ts`, `docs/public-model-assets.md` | Nouvel objet public vérifié, entrée sans faux legacy, documentation de publication exacte |
| `components/immersive/Pricing.jsx` | Première carte Digital dans le téléphone HTML, photographie, tarif et ancre partagés |
| `components/vistaire-preview/VistairePricingPreview.tsx`, `PricingTableEstimator.tsx` | Chapitre et carte Digital ; aucune quantité ou majoration de supports pour Digital |
| `VistairePricingPreview.module.css`, styles immersive/pricing si démontré nécessaire | Grille cinq cartes lisibles, image complète du livre, cinq onglets mobiles et repli 2D |
| `lib/seoMarketingImages.ts`, photo WebP runtime et documentation existante | Un seul asset léger avec alt FR/EN et provenance |
| Tests existants ciblés Node/Playwright | Nouveau contrat, invariance du prix, scènes, chargement, photographie, cinq offres et quatre supports conservés |

Les listes de modifications restent conditionnelles à l’inspection dans le checkout propre ; aucun fichier voisin ne sera modifié par confort. Les routes pricing importent déjà leurs métadonnées : ne pas les modifier sans nécessité. Le formulaire de contact n’a pas de contrat d’offre/prix : aucun changement API requis.

## Présentation et chargement

Le loader tourne le livre de -π/2 autour de X avant de calculer sa bounding box, applique une échelle uniforme selon sa largeur puis replace le minimum Y sur la table. Le showroom fait tourner le livre autour de Y. Le shot Digital utilise une vue oblique haute ; ne pas appliquer une seconde rotation « support à plat ». Acrylique reçoit une présence d’entrée maintenant qu’il devient le deuxième chapitre.

Conserver l’ancien objet jusqu’à ce que le suivant soit utilisable. Précharger seulement l’objet utile à l’ouverture puis le voisin à l’approche ; le landing n’ajoute aucun téléchargement global des cinq modèles. Les erreurs du livre produisent un état local avec photographie et texte accessibles, sans supprimer toute la scène ni bloquer le scroll. Le repli sans WebGL doit aussi rester utilisable.

Conserver le cache, la déduplication, les aborts et le dispose tardif existants ; libérer les ressources à la destruction de la scène, jamais le décodeur Draco partagé. Respecter reduced motion. Le thread principal et le GPU doivent être observés en navigateur avant toute promesse de performance.

La grille proposée par l’audit UI reste mobile-first : 1 colonne mobile, 2 tablette, 3 desktop, cinq cartes sur deux rangées. C’est une décision d’implémentation proposée, à ajuster seulement si la QA révèle un meilleur résultat. `contain` uniquement pour la photo Digital évite de couper le livre dans le cadre existant.

Le téléphone conserve son contenu HTML et ses portails. Son budget de lecture est déjà calculé par `scrollHeight`, `ResizeObserver` et `pricingScrollLayout` ; aucun nouveau chiffre fixe ni changement de `PricingPhoneLayout.js` n’est prévu sans échec mesuré.

## Publication de l’asset

Utiliser le bucket R2 existant `vistaire-3d` et un nouvel objet immuable sous le préfixe approuvé `marketing/immersive/`, servi par `https://3d.vistaire.ca`. Le nom final ne sera publié dans le manifeste qu’après upload et readback réels. Aucun objet existant n’est écrasé ou supprimé. Le script `3d:prepare-cdn-upload` actuel est prévu pour les plats et n’effectue pas cet upload ; ne pas créer de pipeline AR pour le contourner.

Contrôles obligatoires : lecture complète et SHA-256 identique, GET/HEAD 200, MIME, Content-Length, cache, Range 206 et CORS pour production, localhost et preview exacte, puis fetch réel dans le navigateur après toute configuration. Si ces accès manquent, poursuivre les travaux indépendants et indiquer le blocage ; ne jamais activer une URL supposée. Aucun changement CORS global sans analyse de son impact et autorisation applicable.

## Organisation après validation du cadrage

Préserver le checkout courant ; créer une branche `codex/vistaire-digital-glb-experience` dans un worktree propre à partir du dernier `origin/main`, après nouvelle vérification du SHA. Comme demandé, quatre rôles avec ownership distinct : A contrat/contenu, B scène/asset, C UI/photo, D tests/review. Utiliser les worktrees disponibles, au maximum les slots réellement disponibles en parallèle ; sinon exécuter les phases restantes séquentiellement. Le thread principal intègre et vérifie les conclusions.

Tests nécessaires définis et exécutés en rouge avant toute nouvelle logique isolée, puis code minimal, intégration et validation complète. Pas de suite ni de framework nouveau.

## Preuves et acceptation

- Exactement cinq offres commerciales dans l’ordre demandé et quatre supports physiques existants ; JSON-LD, FAQ et FR/EN cohérents.
- Digital = 1 500 pour 1/10/20/21/37/100 tables ; matrices physiques conservées. Année 1 hors taxes/options : 3 900/4 400/4 450/4 500/4 600 CAD, dans la quantité physique incluse.
- Livre GLB réel observé, horizontal, sans clipping, typographie/QR visibles selon le cadrage ; transitions Digital→Acrylique et Signature→Digital dans les deux sens.
- Parcours `/`, `/en`, tarifs FR/EN et réservation/contact réels ; ancres directes, clavier, tactile simulé, reduced motion, panne GLB et absence WebGL.
- Viewports 360/390/430/768/1280/1440 px ; pas d’overflow. Téléphone lu jusqu’à la dernière offre et Pilotage, FAQ atteignable, retour sans désynchronisation.
- Console, erreurs page/hydratation, HTTP/CORS et requêtes CDN inclus dans la collecte ; pas de modèles tous téléchargés à l’ouverture ni de téléchargements répétés. Comparaison mobile à une baseline propre si l’environnement le permet. Pas de revendication 60 FPS ou hardware natif sans mesure.
- Commandes repository : `npm run assets:check`, `npm run lfs:check`, `npm run lint`, `npm run typecheck`, `npm run build`, tests Node pertinents puis suite Node complète si stable.
- Playwright : `npm run test:e2e -- e2e/pricing-page.spec.ts e2e/landing-offers.spec.ts e2e/landing-scroll.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only`, puis suites publiques/SEO et WebKit applicables. Conserver les fixtures Supabase locales et les garde-fous production.
- Adapter les tests qui imposent quatre offres, un ancien prix d’entrée ou l’unicité de slots ; garder les invariants physiques et ne pas affaiblir globalement les assertions. Les 72 assets historiques gardent leur contrôle intégral ; Digital CDN-only reçoit son contrôle HTTP/hash propre.
- Review finale indépendante, correction P0/P1, diff et status vérifiés, aucun secret/binaire lourd/temporaire, une seule PR brouillon, aucun merge.

## Vérifications déjà exécutées et limites

- `git status --short --branch`, historique, remotes/worktrees et `git fetch origin` : effectués. Le fetch a réussi après élévation autorisée ; aucun fichier utilisateur changé.
- `node --test tests/pricing-table-estimator.test.mjs tests/landing-pricing-phone.test.mjs tests/landing-pricing-runtime.test.mjs` : 20/20 passent sur le checkout courant, pas une preuve du futur checkout Digital.
- `npm.cmd run assets:check` : passe, 2 193 fichiers examinés, 97 assets historiques autorisés.
- `npm.cmd run lfs:check` : passe ; zéro règle LFS et zéro pointeur LFS actif dans l’index.
- Audit GLB, décodage, dimensions et images : exécutés avec les dépendances locales, sans sauvegarde ou réécriture de l’original.
- Trois audits indépendants A/B/C : terminés, constats recoupés avec les sources par le principal. Aucune implémentation déléguée.
- Revue indépendante du cadrage par un quatrième agent : « nothing important left » ; accès CDN et rendu navigateur restent des risques d’exécution explicitement couverts.
- Non effectués à ce stade : branche/worktree Digital, upload/CDN/CORS, rendu réel GLB navigateur, lint/typecheck/build du futur changement, Playwright, test de QR, appareils physiques et PR. Ce document ne prétend pas livrer l’intégration.

Les risques résiduels sont concrets : CORS et accès de publication inconnus, qualité réelle du rendu des WebP, cadrage, préchargement historique et isolement des erreurs de modèle. La confiance ne peut pas être factuellement de 100 % avant les validations ; les contrôles ci-dessus servent de critères de sortie observables.
