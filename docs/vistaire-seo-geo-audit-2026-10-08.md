# Vistaire — audit SEO, GEO et découvrabilité commerciale

Audit et validations effectués le 8 octobre 2026. Les corrections sont destinées à une PR brouillon, sans merge ni mise en production par ce chantier.

## Baseline et méthode

- Dépôt réel : `MarcSaad-Hadidi/Vistaire`, npm confirmé par `package-lock.json` et `package.json`. Instructions `AGENTS.md` et `CLAUDE.md` lues avant modification ; aucune instruction plus spécifique applicable trouvée.
- `git fetch origin` exécuté avant création de branche, puis revérifié après intégration. Base et merge-base : `cd91ec7556c9d6dcafe6d2d44b27f571abd1e0be`, dernier `origin/main` observé. Aucun travail sur `main` ou `master`.
- Branche : `feat/vistaire-seo-geo-discoverability`. Trois lots spécialisés sur worktrees propres, intégrés par cherry-pick, puis revue indépendante et validation de l'ensemble.
- Production réellement inspectée : `https://www.vistaire.ca`, déploiement Vercel `dpl_55QYvcJdmNfPBgxAwD6Yxv3Kmriy`, `vistaire-jclt50lob-capoships-projects.vercel.app`, état READY, SHA identique à la base.
- Production : requêtes GET/HEAD et inspection navigateur seulement. Les autres méthodes étaient bloquées dans le navigateur public. Aucun formulaire, endpoint métier ou base de production n'a été modifié pour tester.
- `CONFIRMED` désigne une preuve directe dans le code ou un test ; `PRODUCTION VERIFIED`, une observation du déploiement public ; `LIKELY`, une hypothèse étayée ; `UNVERIFIED`, un fait que les accès disponibles ne permettent pas d'établir. Une correction locale n'est pas décrite comme déjà publiée.

La stratégie repose sur des informations vérifiables et une meilleure compréhension du service. Elle ne garantit ni indexation, ni position, ni citation par un assistant. Une certitude universelle de « 100 % » serait trompeuse : les limites ci-dessous restent explicites, même lorsque tous les tests disponibles passent.

## Constats et priorités

| Priorité | Problème ou contrôle | Preuve | Impact commercial / valeur SEO-GEO | Coût / risque | Résultat |
| --- | --- | --- | --- | --- | --- |
| P0 | Textes de stratégie éditoriale, questions sur les pages SEO, jargon technique dans la homepage et les pages locales FR/EN | CONFIRMED + PRODUCTION VERIFIED | Forte perte de crédibilité ; réponses peu utiles au restaurateur | Moyen éditorial / faible runtime | Correction à la source des pages et des blocs partagés |
| P0 | Tarifs annonce un « vrai dashboard » alors que ses chiffres viennent de `RESTAURATEUR_PREVIEW_FIXTURE` | CONFIRMED + PRODUCTION VERIFIED | Risque de confondre simulation et résultat client | Faible / faible | Mention visible des données de démonstration ; chiffres et interactions conservés |
| P0 | Galerie présente des « vrais menus / real restaurant menus », dont Maison Élyse, fictif | CONFIRMED + PRODUCTION VERIFIED | Preuve commerciale ambiguë | Faible / faible | Trois expériences de démonstration, statut fictif de Maison Élyse explicite |
| P0 | Note 4,8 et 128 avis synthétiques dans les données de démonstration, labels génériques « Aperçu Google » | CONFIRMED source ; rendu public de ce détail non vérifié | Risque de prendre une simulation pour des avis réels | Faible / faible | Labels « Note simulée / Avis fictifs » dans les sept langues existantes ; aucun chiffre modifié |
| P0 contrôle | Blocage d'indexation ou canonical bloquant sur les routes prioritaires | Aucun défaut bloquant démontré ; contrôles PRODUCTION VERIFIED | Forte valeur si un défaut existait | Aucune correction sans preuve | Canonical, redirects, robots et politique d'entraînement IA préservés |
| P1 | Pages Montréal, Laval, Brossard insuffisamment utiles/distinctes ; alts anglais en français ou suggérant une photographie locale non établie | CONFIRMED + PRODUCTION VERIFIED pour les trois paires locales | Clarté, accessibilité et pertinence commerciale locale | Moyen / faible | Six pages réécrites avec angles distincts et descriptions d'images exactes |
| P1 | Certains piliers et textes donnent une impression de logiciel en libre-service ; CTA source vers `/admin` | CONFIRMED ; utilisation active du CTA par chaque renderer non affirmée | Mauvaise compréhension du service et du parcours | Faible / faible | Création accompagnée, mises à jour convenues avec Vistaire, option Pilotage ; CTA vers l'aperçu public existant |
| P1 | Formulaire utilisable avant hydratation : soumission native GET et perte possible des valeurs contrôlées | CONFIRMED par reproduction sur la base propre | Fiabilité et confidentialité du parcours | Faible / faible | Champs/bouton disponibles après hydratation, méthode POST ; traitement API inchangé |
| P1 | « Prendre rendez-vous » est une demande, sans choix instantané de créneau | CONFIRMED + PRODUCTION VERIFIED | Attentes de conversion ambiguës | Faible / faible | Demande → reprise de contact → moment convenu ; aucun calendrier ajouté |
| P1 | Images Contact/demande PNG non optimisées, poids mobile important | CONFIRMED + PRODUCTION VERIFIED pour le coût initial | Chargement mobile et conversion | Faible / faible | Optimisation Next existante à qualité 90, mêmes sources/dimensions/mise en page |
| P1 | Image sociale par défaut absente du HTML racine et de plusieurs overrides | CONFIRMED + PRODUCTION VERIFIED | Qualité du partage et identité de marque | Faible / faible | Deux images PNG FR/EN, metadata explicites sur les pages concernées |
| P1 | Logo non explicite dans les entités ; dates sitemap juin 2026 périmées après modifications significatives | CONFIRMED + PRODUCTION VERIFIED | Cohérence de l'entité et dates de révision fiables | Faible / faible | Logo existant crawlable, date éditoriale fixe du 8 octobre pour 46 URLs |
| P1 | `/auth.md` annonce `/admin` public et une inscription manuelle d'agents non établie | CONFIRMED par contradiction avec l'autorisation Admin | Documentation de découverte inexacte | Faible / faible | Accès privés distingués des aperçus publics ; aucune capacité agent fictive |
| P1 bloqué | Aucune politique dédiée ; informations juridiques/conservation/consentement non établies | CONFIRMED dépôt ; chargement Clarity PRODUCTION VERIFIED ; paramètres UNVERIFIED | Confiance et information sur les traitements | Validation propriétaire nécessaire | Document de travail privé, pas de publication juridiquement engageante |
| P2 | `llms.txt` manque de contexte commercial, de limites et de liens bilingues | CONFIRMED | Meilleure compréhension des cas où le service convient | Faible / faible | Enrichissement factuel modéré, sans préférence artificielle demandée aux agents |
| P2 | Transformations `seoGeoPublicText` masquent les problèmes de source et peuvent changer le sens | CONFIRMED code ; activation de chaque ancienne règle non affirmée | Fiabilité éditoriale | Faible / faible après correction | Module supprimé après audit de tous les appels ; FAQ visible et JSON-LD partagent la même source |

L'impact sur le classement, les citations IA et les demandes qualifiées est **LIKELY comme objectif**, mais **UNVERIFIED comme résultat**. Aucun score d'audit externe n'a été utilisé pour inventer un problème.

## Changements et fichiers

### Contenus commerciaux et locaux

`lib/seoGeoPages.fr.ts`, `lib/seoGeoPages.en.ts`, `lib/seoPages.ts`, `components/seo/SeoGeoAeoPage.tsx`, les renderers commerciaux de `components/vistaire-preview/`, `lib/landing/landingCopy.ts`, `lib/editorialGuides.ts` et `lib/restaurateurPreview/copy.ts` corrigent le langage public à sa source. Les 12 paires GEO et quatre paires piliers ont été revues ; aucune nouvelle page par quartier ni nouvelle URL commerciale.

- Montréal : lecture française/anglaise, restaurants indépendants et gastronomiques, plats signatures, expérience mobile et déroulement accompagné.
- Laval : départ depuis la carte/PDF existant, catégories lisibles, consultation individuelle lors de repas de groupe, photos et validation avec l'équipe.
- Brossard : présentation des plats signatures, choix des supports physiques, langues et limites concrètes de la 3D/AR.

Les photos partagées restent des illustrations : aucune origine locale ou réalisation client n'est inventée. Les 36 descriptions anglaises du renderer GEO sont réellement en anglais. Les FAQ traitent du projet, du budget et du service ; leurs réponses structurées proviennent désormais directement des réponses affichées (`lib/seoGeoJsonLd.ts`). `lib/seoGeoPublicText.ts` est supprimé, sans couche de remplacement.

### Démonstrations, contact et conversion

`RestaurantExperiences.tsx`, `VistairePricingPreview.tsx` et les textes de l'aperçu restaurateur identifient les démonstrations et les chiffres simulés. La miniature Tarifs reste inert ; elle n'est pas décrite comme interactive. L'aperçu public complet reste interactif. Maison Élyse est explicitement fictif ; Trouvable et Sauge Noire sont présentés comme démonstrations, sans affirmation sur leur statut client non établi.

`components/menu/trouvableMenuControls.ts` change seulement les labels des notes/avis de démonstration dans les sept langues. Les labels des avis réels, leurs destinations, les chiffres, données et interactions restent intacts.

`VistaireRendezVousPreview.tsx`, `VistaireContactForm.tsx` et les metadata FR/EN décrivent une demande d'échange. La garde d'hydratation réutilise le pattern `useSyncExternalStore` déjà présent dans le projet. Les cinq champs et le bouton sont désactivés tant que les handlers ne sont pas prêts ; le courriel direct reste accessible sans JavaScript. Validation, payload, identifiant de tentative, retry, honeypot, quota, vérification d'origine et envoi Resend sont conservés.

Seuls `VistaireContactPreview.tsx` et `VistaireRendezVousPreview.tsx` retirent `unoptimized` et passent les images concernées de qualité 100 à 90. Sources, `sizes`, dimensions, priorité, disposition et médias stockés restent identiques. Les alts/aria des pages anglaises About/Contact/demande sont localisés.

### Fondations SEO et découverte

`lib/seo.ts`, `lib/rootDocument.ts` et les metadata des douze pages principales FR/EN ainsi que le helper des guides ajoutent les images sociales. `lib/seoSocialImage.tsx` et `app/social-image/{fr,en}/route.ts` utilisent `ImageResponse` de Next et les assets existants `app/icon.svg` et `public/images/pricing/vistaire-acrylique.jpg`. Aucun binaire ou package ajouté. PNG 1200 × 630, réponses réellement vérifiées et images visuellement inspectées.

Les images thématiques déjà explicites des pages SEO/GEO/piliers/Tarifs sont conservées. Certaines sont portrait ou 4:3 : leur redesign reste une opportunité secondaire, pas une régression créée par ce changement ni une généralisation de la nouvelle image paysage.

Organization et ProfessionalService réutilisent le logo public `/icon.svg`. Identifiants `@id`, URL `https://www.vistaire.ca`, `contact@vistaire.ca`, téléphone `+15147152421`, contactPoint et rattachement des Service/WebSite/WebPage sont cohérents. La localisation existante Montréal/Québec/Canada ne devient pas une adresse de rue ou un bureau revendiqué à Laval/Brossard. Aucun Restaurant pour l'entité Vistaire, AggregateRating, avis, certification, identifiant d'entreprise, nouveau profil officiel ou Google Business Profile fabriqué.

`lib/i18n.ts` et `lib/seoGeoEvidence.ts` datent les révisions significatives de ce chantier au **2026-10-08**, sans `new Date()` de build. Les 46 URLs concernées ont cette date ; les six guides restent sans date inventée. Le sitemap conserve ses 52 pages publiées et la réciprocité FR/EN. La constante inutilisée `PUBLIC_SITEMAP_UPDATED_AT` est retirée.

`public/llms.txt` et `lib/agent-discovery/index.ts` décrivent le service accompagné, les liens publics FR/EN, les tarifs et limites actuels, les démonstrations et des cas d'usage raisonnables. Le Markdown de la homepage et `/auth.md` sont alignés sur l'offre et les accès réels. OpenAPI reste descriptif et en lecture seule ; les trois Agent Skills existants gardent des digests valides. Le Server Card déclare toujours l'absence de serveur MCP distant, et aucun serveur OAuth agents n'est annoncé. WebMCP, robots et politique d'entraînement IA ne changent pas.

### Confidentialité

[`vistaire-privacy-working-draft.md`](vistaire-privacy-working-draft.md) documente Contact/Resend, transfert entrant Cloudflare, Microsoft Clarity, Vercel Analytics, événements de menus/Supabase, stockage de session et accès Clerk. C'est un document interne, sans route publique, placeholder, lien footer ou garantie juridique.

Avant publication : identité légale et responsable désigné ; durées/procédures de conservation ; destination des courriels et régions effectives ; paramètres des outils et consentement/retrait ; procédure d'exercice des droits ; périmètre et approbation juridique FR/EN. Le code n'établit pas un mécanisme de consentement Clarity : publier seulement un texte ne résoudrait pas cette question. Aucun tracker ni changement de traitement de données n'est ajouté.

## Avant / après représentatifs

| Avant | Après |
| --- | --- |
| Montréal : « Faut-il une page différente par quartier de Montréal ? » | Questions sur la création accompagnée, les langues, la compatibilité 3D et le budget |
| Laval : « La page Laval reste distincte de Montréal … sans inventer une présence locale non prouvée » | Départ depuis la carte existante, catégories, photos sur place et validation de l'équipe |
| EN Brossard : « Does the page claim a Brossard office? » | Questions utiles sur langues, plats signatures, supports, AR, prix et lancement |
| Homepage : « sans inventer de tableau de bord ni de métrique » | « Vistaire vous accompagne dans la gestion de votre carte. L'option Pilotage vous permet de suivre les consultations et d'ajuster la disponibilité des plats. » |
| « Aperçu du vrai dashboard Vistaire » | « Aperçu du dashboard Vistaire · données de démonstration » |
| « Trois restaurants / real restaurant menus » | Trois expériences de démonstration, Maison Élyse fictif explicite |
| Note/avis de fixture sous un label générique Google | « Note simulée / Avis fictifs », « Demo rating / Fictional reviews » et cinq autres langues |
| Demande pouvant suggérer un créneau immédiatement réservé | Envoi de la demande, reprise de contact et choix d'un moment avec l'équipe |
| Racine sans image OG et overrides incomplets | Image FR/EN dans le HTML final, card Twitter large, URL absolue vérifiée |

## Contrats préservés

L'identité premium, styles, landing, animations, mobile, trois démonstrations, cartes publiques, fiches plats et interactions restent en place. Aucun endpoint Owner/Admin/contact, autorisation, configuration Clerk/Supabase/R2/Vercel, pipeline 3D/AR, dépendance, lockfile ou média de production modifié. Les seuls changements d'un module de menu sont les labels de simulation cités ci-dessus.

`lib/pricingPage.ts` reste intact : mise en place Acrylique/Sculpté/Carré/Signature à **2000 / 2050 / 2100 / 2200 CAD**, abonnement **200 CAD/mois**, Pilotage **+100 CAD/mois** (total 300 avec cette option), jusqu'à **20 supports QR** et **5 plats 3D** inclus, photos sur place, taxes en sus, engagement initial de 12 mois, mise en place payable avant démarrage. Aucun paiement automatisé, marketplace, SaaS libre-service, portail développeur, MCP/OAuth/SDK ou capacité d'achat par agent créé.

## Vérifications réelles

### HTTP et production

- Avant modification : 26 routes prioritaires FR/EN interrogées avec user agents normal, Googlebot et OAI-SearchBot, HTTP 200, canonical www et hreflang réciproques. Une simulation de user agent ne prouve pas l'accès depuis les IP de vrais robots.
- Les 52 URLs du sitemap public répondent 200 et sont indexables selon leurs directives publiées ; aucune orpheline parmi ces URLs dans le graphe des liens HTML collectés. URL inexistante : vraie 404, pas soft-404.
- Apex `vistaire.ca` → www en 307 ; domaine historique `vistaire.vercel.app` → www en 308. Aucun redirect supplémentaire ajouté.
- Preview Vercel existante inspectée : protection SSO, réponse anonyme 302 avec `X-Robots-Tag: noindex`. Fetch autorisé : 200, noindex et canonical www/hreflang. Comportement actuel suffisant ; résolution `getSiteUrl()` préservée.
- Les huit ressources publiques de découverte, robots, sitemap, Markdown, OpenAPI et Skill index sont accessibles. Les pages privées gardent leurs protections.
- Après intégration, HTTP réel sur le build de production **local** : 52/52 routes 200, un H1, canonical www, hreflang réciproques, JSON-LD parsable et cohérent avec les FAQ visibles, pas d'AggregateRating ajouté, liens internes cohérents, 46 dates fixes et six guides sans date, vraie 404. Les deux formulaires de demande ont la garde SSR attendue.
- Images nouvelles **locales** : `/social-image/fr` et `/social-image/en`, 200 `image/png`, 1200 × 630, 663041 / 660944 octets. `/icon.svg` : 200. Les huit ressources de découverte et digests des trois Skills ont été revérifiés localement.

Ces vérifications ne sont pas une validation externe Google Rich Results, une preuve d'indexation réelle, ni la publication des corrections sur le domaine public.

### Navigateur et performance

Chromium/Playwright existant utilisé, sans connecteur Chrome DevTools disponible. Baseline publique : six parcours × 390/430/1440 px, 18 visites. Build intégré : **52 routes × 390/430/1440 px, 156 visites**. Aucun débordement horizontal, erreur console/page/hydratation ni réponse réseau HTTP ≥400 observé dans ces visites. Titres, H1, images, liens, textes et responsive contrôlés ; screenshots représentatifs et images sociales inspectés visuellement. Les suites existantes vérifient aussi formulaires, interactions, focus clavier, cibles tactiles, réductions de mouvement, galerie et Pilotage.

Mesures de laboratoire sans throttling, caches/hôtes différents : LCP maximal observé local 1272 ms, CLS maximal 0,0672. **Pas de conclusion de gain de CWV**, ni INP terrain disponible. La baseline publique Contact à 390 px chargeait environ 8020 KiB d'images dans le relevé réseau, hors préchargements. Comparaison directe locale des mêmes sources/URLs sélectionnées, préchargements inclus : Contact, sept images **278 KiB** contre **13 917 KiB** de PNG sources ; demande, deux images **112 KiB** contre **3941 KiB** de sources. Réponses WebP 200 réellement obtenues. Cela prouve une baisse du payload concerné, pas un gain commercial déployé.

### Commandes et résultats

Environnement Node 24.19 / npm 11.9, Chromium installé dans `/tmp/vistaire-playwright`. Les commandes de build/tests nécessitent l'autorisation réseau locale du sandbox, également pour lancer les sous-processus Node. Les premières erreurs EPERM sans cette autorisation étaient des limites d'exécution, pas des défauts du produit.

| Commande réellement exécutée | Résultat |
| --- | --- |
| `npm run assets:check` | PASS, 1670 fichiers au contrôle initial, 55 exceptions historiques autorisées |
| `npm run lfs:check` | PASS, zéro règle LFS et zéro pointer actif |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` avec fixture Supabase locale/variables synthétiques de CI | PASS ; import boundary, manifest et contrôle de secrets des artefacts publics passent aussi |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/vistaire-playwright npm run test:node` | 1865 tests : **1861 passent, zéro échec, quatre skips** faute d'OpenUSD/Pillow/Blender |
| `CI=true PLAYWRIGHT_BROWSERS_PATH=/tmp/vistaire-playwright PLAYWRIGHT_BASE_URL=http://127.0.0.1:3141 npm run test:seo:e2e` | **44/44 PASS**, retries 0 |
| `CI=true PLAYWRIGHT_BROWSERS_PATH=/tmp/vistaire-playwright PLAYWRIGHT_BASE_URL=http://127.0.0.1:3141 npm run test:ci:e2e:landing` | **20/20 PASS**, retries 0 |
| Suite commerciale ciblée ci-dessous | **69/69 PASS**, retries 0, aucun test ignoré |
| `node --test tests/google-review-card-source.test.mjs tests/public-menu-core.test.mjs` après les labels de démonstration | **19/19 PASS** |
| `node --test tests/prompt5-editorial-guides.test.mjs tests/prompt5-faq-parity.test.mjs` après la copy des guides | **9/9 PASS** |
| `git diff --check origin/main...HEAD` | PASS |

Commande commerciale complète :

```sh
CI=true PLAYWRIGHT_BROWSERS_PATH=/tmp/vistaire-playwright \
PLAYWRIGHT_BASE_URL=http://localhost:3141 \
node scripts/run-playwright-e2e.mjs \
  e2e/contact-form.spec.ts e2e/pricing-page.spec.ts \
  e2e/public-navigation.spec.ts e2e/demo-restaurant-experiences.spec.ts \
  e2e/restaurateur-preview.spec.ts e2e/google-review-direct-cta.spec.ts \
  --project=chromium --workers=1 --retries=0 --forbid-only \
  --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts
```

Le même lancement avec `127.0.0.1` échouait sur un test API Contact (403 au lieu de 400) parce que l'origine reçue par Next en mode production est `localhost`. Le lancement ci-dessus passe avec l'origine réelle du serveur. Aucun assouplissement des protections ni modification d'API pour faire passer le test.

Build hermétique : serveur existant `e2e/support/sauge-noire-fixture-server.mjs` sur `http://127.0.0.1:55434`, ID de restaurant fixture `11111111-1111-4111-8111-111111111112`, clé de fixture et sentinelles synthétiques de CI, taux de change fixture CAD 1 / USD 0,72 / EUR 0,6225. `node scripts/ci/check-static-public-import-boundary.mjs`, `npm run build`, `node scripts/ci/check-static-public-routes.mjs` et `node scripts/ci/check-public-prerender-artifacts.mjs` exécutés. Aucun projet Supabase externe ou opt-in production utilisé.

Les lots spécialisés ont aussi exécuté leurs tests ciblés bilingues, SEO/JSON-LD, contact et pricing. Les assertions existantes ont été adaptées aux nouveaux textes ; seuls les contrôles de contenu éditorial et d'image sociale apportent une protection nouvelle justifiée. Pas de nouvelle infrastructure de tests. Une revue indépendante finale n'a relevé aucun P0/P1 introduit.

## Limites et suivi

- **UNVERIFIED** : Google Search Console, Bing Webmaster/AI Performance, impressions, requêtes, clics, indexation réelle, citations, referrals IA, métriques privées Vercel et conversion. Aucun export ou accès de mesure fourni ; aucune métrique inventée.
- **Bloqué par validation propriétaire** : politique de confidentialité et choix/paramètres de consentement, avec six catégories d'informations précises dans le document de travail. Pas de déclaration de conformité juridique.
- Statut client effectif de Trouvable/Sauge Noire, profils sociaux officiels non configurés, adresse de rue et bureau local : pas d'affirmation ajoutée.
- Les quatre tests de chaîne 3D dépendant d'OpenUSD/Pillow/Blender ne peuvent s'exécuter ici. Le code et les assets concernés ne changent pas.
- Avertissements préexistants de qualité image 72/80/84 sur des renderers non modifiés : aucun échec réseau observé, aucune réécriture d'assets 3D/animations pour un score.
- Certaines courses d'hydratation de tests de l'aperçu en serveur **dev** sont reproduites sur la base propre. La suite existante complète de cet aperçu passe sur le build de production local intégré. Le défaut de formulaire reproduit sur la base a, lui, une correction ciblée dans cette PR.
- Les aperçus sociaux thématiques existants ne sont pas tous paysage. Ils restent conservés ; la nouvelle image par défaut est vérifiée, sans prétendre avoir redessiné toutes les images de partage.
- Après un futur déploiement autorisé, revérifier sur www les nouveaux textes, images sociales et dates sitemap. Suivre ensuite les pages d'entrée, requêtes et demandes qualifiées avec les outils existants lorsqu'un accès sera fourni.

## Git et nettoyage

Commits d'implémentation intégrés : `1fbd75e` (contenu SEO/GEO), `6245b2d` (marketing/confiance/contact), `62f047f` (fondations SEO), `0943329` (propagation des metadata sociales), `12630f0` (guides et avis simulés, document confidentialité). Le rapport est versionné séparément.

Le diff de livraison constitue un seul chantier de découvrabilité commerciale. La PR doit rester brouillon et ne pas être mergée automatiquement. Aucun secret, nouveau gros asset, Git LFS, dépendance, fichier d'instructions modifié, script de debug, trace ou vidéo de test n'entre dans Git. Les résultats/captures utiles de QA sont conservés hors du dépôt ; les dossiers et scripts temporaires propres à la tâche sont retirés après les validations.

### Inventaire des fichiers modifiés

```text
app/(en)/en/about/page.tsx
app/(en)/en/book-a-call/page.tsx
app/(en)/en/contact/page.tsx
app/(en)/en/page.tsx
app/(en)/en/restaurant-preview/page.tsx
app/(en)/en/vistaire-menu/page.tsx
app/(fr)/a-propos/page.tsx
app/(fr)/apercu-restaurateur/page.tsx
app/(fr)/contact/page.tsx
app/(fr)/demo/page.tsx
app/(fr)/page.tsx
app/(fr)/prendre-rendez-vous/page.tsx
app/social-image/en/route.ts
app/social-image/fr/route.ts
components/guides/VistaireEditorialGuide.tsx
components/menu/trouvableMenuControls.ts
components/seo/SeoGeoAeoPage.tsx
components/vistaire-preview/RestaurantExperiences.tsx
components/vistaire-preview/VistaireAboutPreview.tsx
components/vistaire-preview/VistaireContactForm.tsx
components/vistaire-preview/VistaireContactPreview.tsx
components/vistaire-preview/VistaireMenu3dArRestaurantPreview.tsx
components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.tsx
components/vistaire-preview/VistaireMenuQrCodeRestaurantPreview.tsx
components/vistaire-preview/VistairePdfVsMenuDigitalPreview.tsx
components/vistaire-preview/VistairePricingPreview.tsx
components/vistaire-preview/VistaireRendezVousPreview.tsx
components/vistaire-preview/VistaireSeoProductionSections.tsx
docs/vistaire-privacy-working-draft.md
docs/vistaire-seo-geo-audit-2026-10-08.md
e2e/contact-form.spec.ts
e2e/demo-restaurant-experiences.spec.ts
e2e/pricing-page.spec.ts
e2e/seo-smoke.spec.ts
lib/agent-discovery/index.ts
lib/editorialGuides.ts
lib/i18n.ts
lib/landing/landingCopy.ts
lib/restaurateurPreview/copy.ts
lib/rootDocument.ts
lib/seo.ts
lib/seoGeoEvidence.ts
lib/seoGeoJsonLd.ts
lib/seoGeoPages.en.ts
lib/seoGeoPages.fr.ts
lib/seoGeoPublicText.ts (supprimé)
lib/seoPages.ts
lib/seoSocialImage.tsx
public/llms.txt
tests/agent-discovery.test.mjs
tests/seo-foundation.test.mjs
tests/seo-geo-pages.test.mjs
tests/seo-public-content.test.mjs
```
