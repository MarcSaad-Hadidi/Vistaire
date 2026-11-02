# Vistaire — audit SEO, GEO et AEO du 2 novembre 2026

## Livraison et périmètre

- Site canonique : <https://www.vistaire.ca/>, marché Québec/Canada, français et anglais canadien.
- PR unique : <https://github.com/MarcSaad-Hadidi/Vistaire/pull/335>, laissée ouverte et non fusionnée.
- Preview du code final `a6359ce` : <https://vistaire-ky95xanl5-capoships-projects.vercel.app/> (Vercel `READY`, environnement Preview, projet `vistaire`, équipe `capoships-projects`).
- Référence initiale : `4d2d7505988fd3d2f09937ea8961f9c05b2e86ad`. Les mises à jour concurrentes de `main`, `c44e993` (stockage) puis `6af659b` (versions des actions de sécurité et contrats associés), ont été intégrées par fusions normales. Leur politique de stockage et leur interdiction de créer des Vercel Sandboxes sont conservées. Aucune autre modification applicative après `a6359ce`.
- Architecture inspectée : Next.js App Router, React, TypeScript, contenu bilingue et métadonnées centralisés, sérialisation Markdown côté serveur, routes privées et menus séparés du marketing public. Aucun ajout de dépendance applicative, CMS, service payant, compte externe ou nouvelle famille de pages.

Le crawl initial borné observe 54 URL du sitemap, toutes en HTTP 200 : titres uniques, un H1 par page, contenu principal présent dans le HTML initial, canonical propre et alternates FR/EN réciproques. Les 42 pages prises en charge par le modèle de contenu ne représentent pas les 54 pages publiques : ce détail explique une correction de la description de `llms-full.txt`.

Les constats sont distingués des préférences de scanners. Les scores ci-dessous sont des barèmes différents, pas des positions Google, des probabilités de citation ou des preuves de revenus. Aucun classement ni taux de citation avant/après n'a été mesuré.

## Corrections réalisées

| Problème observé | Correction et résultat attendu | Fichiers nécessaires |
|---|---|---|
| Le seul H1 de l'accueil était « VISTAIRE », sans décrire le produit. | Le texte d'introduction existant devient le H1 descriptif FR/EN. Le grand mot-symbole conserve ses classes, sa typographie et ses animations et devient décoratif. | `components/immersive/App.jsx`, `locale.jsx`, `styles.css` ; attentes existantes `e2e/landing-redesign.spec.ts`, `seo-smoke.spec.ts`, `mvp-smoke.spec.ts`. |
| La version Markdown des tarifs omettait des conditions présentes à l'écran. | Même source de données pour la facturation des remplacements et son exception, le détail Pilotage/total, les extras et les variables expliquant « à partir de ». Aucun nouveau prix. | `lib/agent-discovery/pageMarkdown.ts`, régression FR/EN dans `tests/agent-discovery.test.mjs`. |
| Certaines pages locales contenaient des instructions de stratégie éditoriale destinées à l'équipe. | Remplacement par des réponses utiles au restaurateur, sans bureaux, clients ni résultats inventés : Montréal FR/EN, Laval EN, gastronomique FR. | `lib/seoGeoPages.fr.ts`, `.en.ts`, `tests/seo-public-content.test.mjs`. |
| Le texte de la galerie pouvait faire passer trois expériences pour trois références clientes vérifiées. | Libellé neutre : trois expériences et leurs menus interactifs. Aucune affirmation que tous les restaurants seraient fictifs. | `components/vistaire-preview/RestaurantExperiences.tsx`, attentes FR/EN existantes dans `e2e/demo-restaurant-experiences.spec.ts`. |
| `llms.txt` utilisait des liens peu exploitables, une promesse de mises à jour non étayée et une couverture ambiguë. | Liens Markdown nommés, langues explicites, suppression de la promesse et description exacte des 42 pages structurées. L'agrégat reste public, avec `X-Robots-Tag: noindex` pour éviter une seconde page d'atterrissage indexable. | `public/llms.txt`, `app/llms-full.txt/route.ts`, sérialiseur existant ; tests publics/discovery et extraction d'URL dans `tests/prompt5-editorial-guides.test.mjs`. |
| Dates communes aux deux langues alors que seule une version peut avoir été modifiée. | Date du 2 novembre uniquement pour les pages réellement révisées ; prise en charge d'une date EN distincte et cohérence sitemap/JSON-LD. Les anciennes dates des autres pages sont conservées. | `lib/i18n.ts`, `seo.ts`, `seoGeoRoutes.ts`, `seoGeoTypes.ts`, données locales et `tests/bilingual-seo.test.mjs`. |
| Contraste de 4,12:1 dans les descriptions des étapes des tarifs pendant l'état d'attente de l'animation. | Le texte reste opaque ; l'atténuation anime seulement les numéros décoratifs. Translation, progression, décalages et préférence de mouvement réduit sont conservés. Les palettes ne changent pas. | `components/vistaire-preview/PricingPageExtensions.module.css`. |
| Les liens visibles « FR » et « EN » n'incluaient pas ces mots dans leur nom accessible. | Ajout du préfixe FR/EN aux descriptions existantes, pour la commande vocale et la cohérence du nom accessible. | `components/vistaire-preview/PublicControls.tsx`, `VistairePreviewChrome.tsx`, sélecteurs stricts conservés dans `e2e/public-navigation.spec.ts`. |

Pages améliorées : accueil FR/EN, galerie FR/EN, tarifs et représentation Markdown FR/EN, quatre variantes locales citées, ressources de découverte. Les noms accessibles des contrôles partagés profitent aux pages existantes. **Aucune page supplémentaire créée.** Les versions privées, previews intentionnellement non indexables, politiques des robots d'entraînement, actifs 3D/AR, prix et fonctions produit restent dans leur périmètre existant.

## Mesures externes réellement exécutées — avant/après

Toutes les observations de ce tableau datent du **2 novembre 2026** et ciblent la **production publique observée avant les corrections**. La version interne des services SaaS n'est pas publiée. Leurs quotas et caches ne permettent pas de comparer la branche non déployée avec la production : **après = non remesuré sur la version corrigée** pour chaque ligne. Aucun score avant n'est présenté comme un gain après.

| Outil | URL / portée réellement auditée | Avant : résultat reçu et sens | Après | Limite à conserver |
|---|---|---|---|---|
| Grow My Website | `/` | 100/100, 12/12 bases on-page | Non remesuré | Détails complets non renvoyés. |
| Grow My Website | `/menu-qr-code-restaurant` | 96/100, 11/12 | Non remesuré | « No images detected » n'est pas une preuve d'alt manquant. |
| AIOScan | `/` | 90/100, B, 20/21 vérifications | Non remesuré | Seul échec : titres non interrogatifs, préférence du barème. |
| Pishe | `/`, robots/sitemap/llms et quatre agents | SEO 100, AI 84, global 92 | Non remesuré | Faux négatifs FAQ et téléphone corroborés par le HTML et ses propres résultats. |
| Website Analyzer | 7 pages ; liste non renvoyée | D 66 ; Search 43, Speed 87, AI 61, conversion 57, sécurité 94, accessibilité 100 | Non remesuré | 22 alertes, seulement 3 détails accessibles ; `mobile_speed=null`, aucun CWV démontré. |
| Site SEO / AI Crawler Audit | Accueil : tags, accès robots, disponibilité et échantillon de liens | Tags essentiels présents ; 14 agents autorisés ; 40 liens échantillonnés répondent 200 ; AI readiness 2 contrôles passés/1 échec de clarté | Non remesuré | User-agent simulé : pas une requête depuis l'IP d'un véritable robot. Aucun classement. |
| Magnet AEO/GEO | `/` | 50/100, 12 contrôles sur 20 non applicables | Non remesuré | Rapport heuristique et cache 24 h. Son interrogation « best design tool solutions » ne représente pas le marché de Vistaire ; exclue des preuves de visibilité. |
| GeoDaddy | `/` | Global 74 ; GEO 72, technique 95, contenu 32, agent 71, performance 100 | Non remesuré | Parsing `@graph` incomplet ; critères A2A/OIDC/WebMCP inadaptés au besoin de lecture d'un menu. |
| ToolMint | `/`, performance optionnelle tentée | SEO 97, AI Readiness 100 ; 82 contrôles : 62 réussis, 6 avertissements, 0 échec, 13 informations, 1 indisponible | Non remesuré | PageSpeed en dépassement de délai ; CrUX insuffisant. Les en-têtes de sécurité ne sont pas des exigences de classement. |
| SEOFetcher | `/` | 64, audit technique/éditorial | Non remesuré | Recommandations automatiques « article-like », FAQ/auteur universels non suivis sans justification. Modules payants inutilisés. |
| AEOCheck | `/` | Aperçu 86 | Non remesuré | Trois problèmes sur six visibles ; rapport PDF payant non acheté. |
| Juma | `/` | Aperçu global 33 ; crawler 100, structure 85, extractabilité 4, schema 13, autorité 23, confiance 0, technique 100, marque SERP 23, fraîcheur 0, cohérence 47 | Non remesuré | Détail de la plupart des dimensions bloqué par un formulaire courriel ; aucun courriel fourni. |
| HubSpot AI Search Grader | Marque Vistaire, Montréal/Québec/Canada, menus QR premium pour restaurants | OpenAI 32, Perplexity 41, Gemini 39 ; reconnaissance 2/20 sur chaque moteur | Non remesuré | Échantillon du fournisseur à partir des descripteurs/données de modèles. Ni recherche publique reproductible, ni rang, ni taux de citation. Interprétation derrière formulaire non soumise. |

Rapports consultables : [AIOScan](https://aioscan.com/scan/www.vistaire.ca?utm_source=chatgpt_app&utm_medium=app&utm_campaign=aioscan_app), [Website Analyzer](https://mcurtismccoy.com/website-analyzer/?wa=R1TAp1SCues6EqS0Eu07Rqx3BHQAlth2&utm_source=chatgpt&utm_medium=plugin&utm_campaign=website-analyzer), [Magnet](https://aeo.projecta.ai/static/slides/vistaire-ca-c3aa1add.html), [GeoDaddy](https://geodaddy.dev/playground?url=https%3A%2F%2Fwww.vistaire.ca%2F), [AEOCheck](https://www.aeocheck.co/report?id=ab2cf457-f221-46a0-a5bb-690ce6e84f27), [Juma](https://geo.juma.ai/report/cmvznhc7o000004jv1k1l1i2f). Le rapport Website Analyzer n'a pas pu être ouvert par le lecteur web ; ses scores viennent de la réponse structurée terminée, suivie avec trois appels de statut. Aucun lien de résultat stable ToolMint/SEOFetcher n'a été vérifié.

### Contrôles locaux comparables

Date : 2 novembre 2026. Avant : build de production local du code de référence ; après : build de la branche corrigée. Lighthouse **13.6.0**, Chromium **153.0.8010.0**, émulation mobile Moto G Power et paramètres par défaut identiques pour les deux collectes. Une exécution par page : pas une médiane stable. Captures pleine page désactivées après un dépassement de délai sur les très longues pages immersives ; les catégories SEO/accessibilité restent exécutées.

| Contrôle / chemin | Avant | Après | Interprétation |
|---|---|---|---|
| Crawl HTTP, 54 URL du sitemap | 54/54 en 200 | 54/54 en 200 | Aucun nouveau statut incorrect, titre dupliqué, canonical manquant ou `noindex` dans ce périmètre public. |
| H1 accueil `/`, `/en` | Marque seule | Produit, restaurant et usage explicites | Un seul H1 localisé, servi sans JavaScript ; grand mot-symbole préservé. |
| Conditions commerciales Markdown, tarifs FR/EN | Six groupes de champs manquants | Six groupes présents dans les deux langues | Assertions sur les valeurs réelles de la source ; pas de promesse ou prix inventé. |
| Agrégat `/llms-full.txt` | Couverture ambiguë, pas de noindex | 42 pages structurées explicitement annoncées ; HTTP 200 + `X-Robots-Tag: noindex` | L'accès reste public ; le sitemap HTML reste la liste complète de référence. |
| Lighthouse `/menu-qr-code-restaurant` | SEO 100, accessibilité 100, bonnes pratiques 100 | 100 / 100 / 100 | Contrôles automatiques, pas une certification globale. |
| Lighthouse `/guides/menu-qr-mobile-sans-application` | 100 / 100 / 100 | 100 / 100 / 100 | Même limite. |
| Lighthouse `/` | 100 / 100 / 100 | 100 / 100 / 100 | Le score SEO était déjà maximal malgré le H1 peu descriptif. |
| Lighthouse `/en` | 100 / 100 / 100 | 100 / 100 / 100 | Idem. |
| Lighthouse `/tarifs-menu-digital-restaurant` | SEO 100, accessibilité **96**, bonnes pratiques 96 | SEO 100, accessibilité **100**, bonnes pratiques 96 | Contraste et texte visible/nom accessible corrigés ; l'erreur réseau de modèle externe reste déclarée. |
| Axe 4.14.0, étapes des tarifs et navigation | Contraste 4,12:1 et deux liens de langue en échec | Aucun échec confirmé des deux règles dans les états contrôlés clair/sombre | Les états `ready`/`visible` ont été forcés pour isoler le CSS ; ce test ne certifie pas l'IntersectionObserver. En thème sombre, 36 nœuds de la portée étapes/navigation restent « à examiner » à cause de la superposition immersive ; pas de déclaration de conformité complète. Le défilement réel a été inspecté séparément. |

**Performance : comparaison quantitative non concluante.** Speed Index/captures de trace retournent `NO_SCREENSHOTS` sur plusieurs pages, donc score de performance `null` : QR, guide et accueil FR des deux côtés ; accueil EN avant ; tarifs après. Les scores isolés 98 aux tarifs avant et 100 à l'accueil EN après n'ont pas de paire valide et ne démontrent aucun gain.

Valeurs de laboratoire enregistrées, en millisecondes pour LCP/TBT :

| Chemin | LCP avant → après | CLS avant → après | TBT avant → après |
|---|---|---|---|
| Service QR | 1 400 → 1 379 | 0 → 0 | 0 → 0 |
| Guide QR mobile | 1 621 → 1 520 | 0 → 0 | 122 → 0 |
| Accueil FR | 1 390 → 1 223 | 0 → 0 | 0 → 0 |
| Accueil EN | 1 223 → 1 214 | 0 → 0 | 0 → 0 |
| Tarifs | 1 522 → 1 518 | 0 → 0 | 0 → 0 |

Ces nombres proviennent du rendu logiciel local, avec ressources 3D externes parfois en échec et sans répétitions statistiques. Ils ne doivent pas être interprétés comme les CWV réels, une amélioration établie ou une validation de l'expérience 3D. **INP et CrUX terrain indisponibles** ; TBT ne remplace pas INP.

### Disponibilité et coût des autres outils examinés

| Outil | Licence / accès vérifié | Décision réelle et raison |
|---|---|---|
| AEO Armory | Offre gratuite annoncée : 3 rapports/jour, compte courriel + OTP requis | Non exécuté : aucune création de compte autorisée par le brief. |
| AEOTester | Aucune fonction correspondante exposée dans les outils connectés | Non exécuté : intégration indisponible. |
| open-seo (`alexsilver8/open-seo`) | MIT, licence et manifestes lus ; Node/Docker et stockage | Non installé : infrastructure disproportionnée pour les contrôles déjà couverts. |
| `Advance-Labs/aeo-toolkit` | Apache-2.0 vérifiée ; bibliothèques Node/pnpm | Non exécuté : intégration nécessaire, pas un SaaS complet prêt à lancer. La plateforme hébergée est privée depuis le 20 octobre 2026. |
| `ravigupta0210/seo-auditor` | MIT annoncée dans README, fichier LICENSE racine non trouvé ; Node >=20 <21 | Non installé : licence formelle et compatibilité à clarifier, trois applications à installer. |
| SiteOne (`janreges/siteone-crawler`) | MIT vérifiée ; binaire natif, IA facultative | Non exécuté : le crawl HTML borné des 54 pages couvre déjà l'objectif ; aucune fonction IA payante activée. |
| Unlighthouse | MIT vérifiée ; Node >=22.18, Chrome | Non exécuté : doublonne la collecte Lighthouse représentative, sans améliorer la mesure réelle indisponible. |
| Lighthouse CI 0.15.1 | Apache-2.0 ; CLI gratuite, Chrome requis | Installé hors application, collecte tentée ; première capture pleine page bloquée. Repli vers Lighthouse 13.6.0 direct, résultats et limites ci-dessus. Aucun upload ou serveur CI ajouté. |
| Playwright 1.64.1 / Chromium | Dépendance existante ; téléchargement Chromium 156 retournait une page HTML « Site unavailable » au lieu de l'archive | Utilisation d'un Chromium 153.0.8010.0 distribué par `@sparticuz/chromium` 153.0.0 (MIT) pour les contrôles locaux. Ce n'est pas un appareil physique. |
| axe-core Playwright 4.14.0 | MPL-2.0 ; installé seulement dans les outils d'audit | Contraste et correspondance texte/nom accessible vérifiés, avec les limites de rendu déclarées. |
| PageSpeed / CrUX | Tentative publique via ToolMint | Pas de données exploitables : délai dépassé pour PSI et population insuffisante pour CrUX. Aucun INP terrain disponible. |
| Search Console / Bing Webmaster Tools / journaux de robots / Clarity | Aucun rapport de ces comptes consultable avec les capacités disponibles | Non exécuté : accès aux données absent. La présence de code Clarity n'est pas une mesure de trafic. |
| Tests natifs AR sur iOS/Android | Appareils physiques indisponibles | Non exécutés ; ne pas assimiler le rendu logiciel à un test AR réel. |

Les outils gratuits sans compte ont été utilisés sans achat, crédits payants, courriel d'agence, fichier privé ni modification de la configuration de production. Les installations temporaires sont hors du projet ; aucun lockfile applicatif modifié.

## Analyse et choix éditoriaux

- Métadonnées, canonicals, langues et maillage : 54 titres distincts et aucune page du sitemap orpheline dans les liens observés. L'absence facultative de `x-default` sur les pages développeur n'a pas été traitée comme un blocage. Pas d'ajout automatique de pages géographiques ou de variantes de mots-clés.
- JSON-LD existant : `Organization`/`ProfessionalService`, `WebSite`, `WebPage`, `Service`, `BreadcrumbList` et FAQ quand le texte visible le justifie. Validation syntaxique et cohérence avec le contenu ; pas de faux avis, notes, auteur, résultat client ou établissement local ajouté. Un schéma Schema.org valide n'implique pas une fonctionnalité de recherche Google prise en charge.
- FAQ : les réponses utiles existaient déjà et correspondent au balisage observé. Le faux négatif d'un scanner ne justifie pas de les dupliquer. Google indique que les résultats enrichis FAQ ont cessé d'apparaître à compter du 7 mai 2026 ; aucun bénéfice de ce type n'est promis.
- `llms.txt` et Markdown : formats complémentaires déjà présents, utiles pour une lecture explicite des pages publiques. Ils ne sont ni requis pour les fonctions IA de Google, ni une garantie d'indexation ou de citation. Les restrictions des surfaces privées et les politiques d'entraînement n'ont pas été élargies.
- Accès IA : distinguer recherche (`OAI-SearchBot`, par exemple), navigation demandée (`ChatGPT-User`) et entraînement (`GPTBot`). Une réponse 200 avec cet en-tête ne prouve pas le passage du robot authentique ou l'utilisation dans une réponse publique.
- Aucune affirmation E-E-A-T ajoutée à partir de la seule existence du dépôt. Les trois expériences sont des démonstrations à essayer, pas des témoignages clients déduits. Pas de Person/Article de convenance pour une page commerciale, pas de renouvellement artificiel des dates historiques.
- Les opportunités JS/CSS et de rendu signalées par Lighthouse sont des diagnostics de laboratoire, pas des corrections automatiquement sûres. Aucun retrait d'animation, chargement dynamique global, CSP improvisée ou modification des modèles externes sans cause produit démontrée.

## Sources officielles consultées

Consultées le 2 novembre 2026, paraphrases appliquées aux décisions ci-dessus :

1. [Google — AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) : mêmes fondamentaux SEO, pas de fichier ou schéma IA obligatoire ; indexation et affichage non garantis.
2. [Google — mises à jour de la documentation](https://developers.google.com/search/updates), entrée du 8 mai 2026 : retrait des résultats enrichis FAQ dès le 7 mai.
3. [Google — sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) : `lastmod` exact et significatif ; `priority`/`changefreq` ignorés pour Google.
4. [Google — règles des données structurées](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) : représentation fidèle du contenu visible ; conformité sans garantie de résultat enrichi.
5. [Google — canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) : cohérence des URL préférées et des représentations.
6. [OpenAI — robots](https://developers.openai.com/api/docs/bots) : rôles distincts de recherche, navigation demandée et entraînement.
7. [Lighthouse CI — configuration](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md), [Lighthouse](https://github.com/GoogleChrome/lighthouse), [axe Playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) : outils locaux, résultats de laboratoire et limites des captures/règles.
8. Licences inspectées : [open-seo](https://github.com/alexsilver8/open-seo/blob/main/LICENSE), [aeo-toolkit](https://github.com/Advance-Labs/aeo-toolkit/blob/main/LICENSE), [SiteOne](https://github.com/janreges/siteone-crawler/blob/main/LICENSE), [Unlighthouse](https://github.com/harlan-zw/unlighthouse/blob/main/LICENSE.md), [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci/blob/main/LICENSE). Pour seo-auditor, le README seul ne résout pas l'absence de licence racine.

## Vérifications et revue

| Vérification réellement exécutée | Résultat observé |
|---|---|
| `npm ci` | Installation du lockfile existant réussie ; aucun changement de dépendance applicative. |
| `npm run assets:check`, `npm run lfs:check` | Réussite ; aucun actif lourd ajouté, aucune règle LFS. |
| `npm run lint`, `npm run typecheck` | Réussite après les dernières corrections produit/tests. |
| `npm run build` | Réussite avant et après. Un rebuild ultérieur a rencontré un cache Turbopack local invalide ; cache déplacé hors du dépôt, rebuild propre réussi. Aucune modification de configuration requise. |
| `npm run test:node -- --test-concurrency=4` | 2 340 tests : **2 333 réussis, 1 échec, 6 ignorés**. Quatre tests ignorés nécessitent OpenUSD/Pillow/Blender absents et deux exigent le Chromium Playwright standard non installé. L'échec IPv6 du pipeline owner (`UND_ERR_SOCKET`) se reproduit aussi avec les trois fichiers d'origine `4d2d750` dans un répertoire isolé. Il n'a pas été masqué ni corrigé dans cette PR. |
| Sept fichiers Node SEO/discovery/politique Vercel ciblés | **57/57 réussis** ; régressions de contenu, prix et dates observées en échec avant implémentation puis corrigées. |
| Playwright local : SEO, HTML initial et changements de langue | **15/15 réussis**, aucune relance automatique ; vues 390, 430 et 1366, FR/EN, navigation au clavier, alternates, FAQ, sitemap/robots/Markdown, récupération après WebGL indisponible et CTA de repli. |
| Crawl du build corrigé | 54/54 en 200, un H1 par page, JSON-LD parseable, titres uniques et canonicals présents. Ressources discovery et négociation Markdown vérifiées via HTTP réel. |
| Contrôles visuels complémentaires | Accueils FR 390/430/1366, EN 430 ; tarifs FR 390/430 et étapes après défilement. Pas de débordement horizontal ni erreur JavaScript observée dans cet échantillon. Captures mobiles inspectées. |
| Preview Vercel | Code `a6359ce`, `READY`, cible Preview. Accueil ouvert réellement, changement de langue FR → EN effectué ; H1 et noms FR/EN corrigés observés dans les deux langues. |
| Suite Node sur GitHub CI, code final `a6359ce` | **2 341 tests : 2 334 réussis, 0 échec, 7 ignorés** ; job `static-quality` réussi, environnement CI distinct du local. Contrats PostgreSQL isolés et build CI également réussis. |
| Revue indépendante | Diff relu avant livraison ; deux attentes E2E obsolètes signalées puis corrigées en conservant `exact: true`. Aucun défaut produit supplémentaire confirmé. |
| Codex Review GitHub et CI finale | Codex Review terminé sur `a6359ce`, aucun problème majeur signalé et aucune remarque non résolue. [CI Gate réussi](https://github.com/MarcSaad-Hadidi/Vistaire/actions/runs/41517210338) : qualité statique, suite Node, contrats PostgreSQL isolés, build, six shards Chromium publics et trois shards WebKit critiques réussis. Admin/Sauge spécialisés non déclenchés par le classificateur de portée. Après cette validation : rapport/plan et intégration de `6af659b`, qui met seulement à jour les actions CI et leurs contrats. Le code applicatif testé reste identique. |

Commande Node ciblée :

```sh
node --test tests/seo-foundation.test.mjs tests/bilingual-seo.test.mjs tests/seo-public-content.test.mjs tests/seo-geo-pages.test.mjs tests/agent-discovery.test.mjs tests/prompt5-editorial-guides.test.mjs tests/vercel-git-policy.test.mjs
```

Commande Playwright exécutée (configuration temporaire hors application pour le binaire Chromium disponible, chemins adaptés à cette session) :

```sh
CI=true PLAYWRIGHT_BASE_URL=http://127.0.0.1:3064 node scripts/run-playwright-e2e.mjs e2e/seo-smoke.spec.ts e2e/landing-redesign.spec.ts e2e/public-navigation.spec.ts --config=../audit-evidence/playwright.audit.config.ts --project=chromium --workers=1 --retries=0 --grep='robots, llms|initial headings|homepage retains|montreal|migration preparation|full document navigation'
```

La configuration temporaire reprend `playwright.config.ts`, change seulement le chemin du navigateur, la sortie et ses options de lancement. Dans un environnement où le Chromium Playwright standard est installé, omettre `--config`. Les essais préliminaires ont exposé un sélecteur `alertdialog` déjà obsolète (le composant original utilise un `status` nommé) : l'attente a été corrigée sans modifier le produit. Des plantages du Chromium de secours ont été résolus en configurant ses polices locales ; aucun changement applicatif pour les contourner.

Limites navigateur : une requête vers le GLB `3d.vistaire.ca/marketing/immersive/20261027-digital/sauge-noire-menu-…glb` retourne `ERR_EMPTY_RESPONSE` dans cet environnement, avant et après. Cela explique aussi le 96 « bonnes pratiques » des tarifs ; sa cause en production n'est pas démontrée. Pas de suppression du modèle ni de modification de réseau/permissions. Les formulaires n'ont pas envoyé de message réel. Les interactions AR et la suite exhaustive WebKit ne sont pas déclarées testées localement. Les trois shards WebKit critiques sont en revanche réussis sur GitHub CI ; cela ne prouve pas un test iOS physique.

Les scripts d'audit, captures et installations restent hors des fichiers applicatifs. Nettoyage limité à trois fichiers partiels non suivis, créés par ce clonage ; aucun actif de production supprimé. Aucun secret, `.env`, journal de diagnostic, capture lourde ou dépendance d'audit ajouté à la PR. Les deux anomalies d'autorisation/publication signalées lors de l'analyse générale précédente restent une tâche de sécurité séparée, hors de cette PR SEO.

## Informations officielles encore nécessaires

Ces informations n'ont pas été inventées et ne bloquent pas les corrections indépendantes livrées :

1. Nom légal exact de l'entité éditrice et relation officielle avec la marque Vistaire, si différente.
2. Noms des vrais auteurs/experts, fonctions, expériences vérifiables et profils publics autorisés pour attribuer les guides.
3. Références clients publiables, autorisation d'usage des noms/logos/avis et méthode/période de tout résultat chiffré ; statut exact des trois expériences si une mention client est souhaitée.
4. URL officielles des profils sociaux et éventuel Google Business Profile ; adresse d'accueil publique et horaires seulement si un établissement réel doit être présenté.
5. Définition commerciale approuvée de la responsabilité et des limites des mises à jour de menus pendant l'abonnement, avant toute nouvelle promesse éditoriale.
6. Exports ou accès de lecture aux propriétés Search Console et Bing, journaux de crawl authentifiés et mesures d'audience/conversion si une analyse de visibilité réelle est demandée.

## Actions externes restantes

- Examiner la PR et ses limites de validation ; la fusion et le passage en production restent une décision du propriétaire. Aucune fusion ni publication de production effectuée.
- Après un déploiement approuvé, contrôler les URL en production et demander une nouvelle exploration via les comptes Search Console/Bing existants si nécessaire. Relancer alors les scanners sur cette version, après expiration des caches/quota ; ne pas comparer le score de l'ancienne production à celui d'une preview protégée.
- Fournir les preuves officielles ci-dessus pour renforcer les attributions et références sans fabriquer de signaux de confiance.
- Vérifier les parcours 3D/AR avec les appareils et réseaux réels avant d'en déduire des performances terrain. Pour suivre les citations, garder un protocole stable : question, langue, marché, date, moteur grand public, mode avec recherche et sources effectivement observées.

## Annexe — 30 intentions FR/EN

Carte éditoriale, non issue de volumes, de positions ou de conversions mesurés. Chaque ligne regroupe une intention et ses formulations FR/EN. Les cibles existent déjà ; une ligne ne constitue pas une demande de créer une nouvelle page ou une nouvelle FAQ. Prioriser la correction de l’existant, les liens utiles et quelques réponses exactes. Les slugs FR/EN sont les chemins canoniques du registre.

## Comprendre et choisir

| # | Question FR | Question EN | Cible FR ↔ EN | Couverture / action minimale |
| --- | --- | --- | --- | --- |
| 1 | Qu’est-ce qu’un menu digital premium pour restaurant ? | What is a premium digital restaurant menu? | `/menu-digital-restaurant` ↔ `/en/digital-restaurant-menu` | Définition et réponse directe déjà présentes. Préserver. |
| 2 | Un PDF suffit-il ou faut-il une carte mobile dédiée ? | Is a PDF enough, or should the restaurant use a dedicated mobile menu? | `/menu-pdf-vs-menu-digital` ↔ `/en/pdf-vs-digital-menu` | Comparatif et cas où le PDF suffit déjà présents ; pas de promesse universelle. |
| 3 | Pourquoi un QR code seul ne rend-il pas le menu plus lisible ? | Why does a QR code alone not make a menu easier to read? | `/menu-qr-sans-pdf` ↔ `/en/qr-menu-without-pdf` | Intention explicite, réponse et comparaison disponibles. |
| 4 | Vistaire permet-il de commander, réserver ou payer ? | Can guests order, reserve or pay through Vistaire? | `/menu-digital-restaurant` ↔ `/en/digital-restaurant-menu` ; `/developers` ↔ `/en/developers` | Limites explicites dans `llms.txt` et ressources agents. Garder une formulation exacte du service de lecture ; ne pas inventer ces fonctions. |
| 5 | Où puis-je essayer un menu Vistaire fonctionnel ? | Where can I try a working Vistaire menu? | `/demo` ↔ `/en/vistaire-menu` | Démonstrations et liens publics présents. Libellé neutre pour éviter de faire passer ces univers pour des références clientes non vérifiées. |

## Accéder au menu pendant le service

| # | Question FR | Question EN | Cible FR ↔ EN | Couverture / action minimale |
| --- | --- | --- | --- | --- |
| 6 | Que voit le client après avoir scanné le QR ? | What does the guest see after scanning the QR code? | `/menu-qr-code-restaurant` ↔ `/en/qr-code-restaurant-menu` | Parcours catégories → fiche plat expliqué et démontrable. |
| 7 | Faut-il télécharger une application ou créer un compte ? | Do guests need an app or an account? | `/menu-digital-sans-application` ↔ `/en/digital-menu-without-app` | Réponse explicite déjà présente. |
| 8 | Le Wi-Fi du restaurant est-il obligatoire ? | Is restaurant Wi-Fi required? | `/menu-qr-code-restaurant` ↔ `/en/qr-code-restaurant-menu` | La connexion mobile est citée ; le guide opérationnel explique les contraintes réseau. Ne pas promettre un mode hors ligne. |
| 9 | Quel repli proposer sans téléphone ou sans réseau ? | What fallback can the restaurant offer without a phone or connection? | `/guides/menu-qr-mobile-sans-application` ↔ `/en/guides/mobile-qr-menu-without-app` | Papier, tablette ou aide de l’équipe traités. Aucun besoin de page satellite. |
| 10 | Peut-on changer la carte sans réimprimer tous les QR ? | Can the menu change without reprinting every QR code? | `/guides/menu-qr-mobile-sans-application` ↔ `/en/guides/mobile-qr-menu-without-app` | Le principe d’adresse durable est traité. Vérifier le lien public après modification ; ne pas garantir la pérennité d’un ancien QR tiers. |

## Maintenir les informations utiles

| # | Question FR | Question EN | Cible FR ↔ EN | Couverture / action minimale |
| --- | --- | --- | --- | --- |
| 11 | Qui met à jour les prix, catégories et descriptions ? | Who updates prices, categories and descriptions? | `/menu-digital-restaurant` ↔ `/en/digital-restaurant-menu` | Les outils sont cités, mais le rôle de Vistaire/du restaurant mérite une phrase précise après vérification du fonctionnement commercial. Aucun self-service client à inventer. |
| 12 | Comment indiquer qu’un plat est indisponible ? | How can the restaurant mark a dish unavailable? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` ; `/apercu-restaurateur` ↔ `/en/restaurant-preview` | Fonction Pilotage et démonstration présentes. Préserver l’option et la validation, sans la présenter comme incluse dans toutes les offres. |
| 13 | Qui valide les allergènes et les besoins alimentaires sensibles ? | Who validates allergens and sensitive dietary information? | `/menu-restaurant-allergenes` ↔ `/en/restaurant-menu-allergens` | Responsabilité du restaurant et confirmation avec l’équipe déjà présentes. Ne pas ajouter de garantie médicale ou de contamination croisée. |
| 14 | Le menu peut-il être français et anglais sans divergence ? | Can the menu be French and English without the versions drifting? | `/guides/anatomie-menu-digital-premium` ↔ `/en/guides/premium-digital-menu-anatomy` ; page Montréal | Version bilingue conditionnée à des contenus réellement disponibles et maintenus. Garder les rôles de validation vérifiés. |
| 15 | Que mesure Pilotage et quelles sont ses limites ? | What does Pilotage measure, and what are its limits? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` | Liste précise et seuils présents en HTML. Rétablir la disclosure existante dans le Markdown ; ne pas transformer consultations en ventes ou conversions attribuées. |

## Choisir photos, 3D et AR

| # | Question FR | Question EN | Cible FR ↔ EN | Couverture / action minimale |
| --- | --- | --- | --- | --- |
| 16 | Pour quel plat une photo suffit-elle et quand la 3D est-elle utile ? | When is a photo enough, and when does 3D help a dish? | `/guides/3d-restaurant-utile-vs-gadget` ↔ `/en/guides/restaurant-3d-useful-vs-gimmick` | Cadre de décision déjà substantiel et comparatif sémantique. |
| 17 | La réalité augmentée fonctionne-t-elle sur tous les téléphones ? | Does augmented reality work on every phone? | `/menu-3d-ar-restaurant` ↔ `/en/3d-ar-restaurant-menu` | Compatibilité conditionnelle et repli photo déjà indiqués. Ne pas promettre de prise en charge universelle. |
| 18 | La 3D ralentit-elle l’ouverture de la carte ? | Does 3D slow down opening the menu? | `/menu-3d-ar-restaurant` ↔ `/en/3d-ar-restaurant-menu` | Chargement sélectif après action décrit ; toute nouvelle affirmation chiffrée exige une mesure réelle. |
| 19 | Combien de plats 3D et quelles photos sont inclus dans l’offre ? | How many 3D dishes and which photos are included? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` | Offre vérifiée dans le module : photos sur place, jusqu’à cinq plats 3D. Conserver « jusqu’à » et la disponibilité conditionnelle AR. |
| 20 | Un nouveau plat ou un remplacement 3D est-il facturé ? | Is a new or replacement 3D dish billed separately? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` | Note de remplacement/correction existante en HTML mais absente du Markdown : correction P1, sans nouvelle page. |

## Comprendre le budget et la publication

| # | Question FR | Question EN | Cible FR ↔ EN | Couverture / action minimale |
| --- | --- | --- | --- | --- |
| 21 | Quel est le coût total de la première année, hors taxes et options ? | What is the first-year cost before taxes and options? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` | Estimateur et calcul Markdown existants. Utiliser les mêmes montants et hypothèses, sans mélanger frais uniques et mensuels. |
| 22 | Quelle différence entre Digital et les collections de supports QR ? | How does Digital differ from the physical QR display collections? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` | Digital sans support physique et jusqu’à vingt supports pour collections physiques déjà distingués. Rendre le motif du « à partir de » accessible en Markdown. |
| 23 | Quelle devise, quelles taxes et quel engagement s’appliquent ? | What currency, taxes and initial commitment apply? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` | CAD, taxes en sus, engagement initial de douze mois et activation du service explicités dans les deux formats. |
| 24 | Quel est le supplément Pilotage et le total par mois ? | What does Pilotage add, and what is the total monthly price? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` | HTML : base 200 + option 100 = total 300 CAD/mois. Markdown : supplément présent, total absent ; sérialiser `totalLabel`. |
| 25 | Que faut-il fournir, valider et attendre avant la mise en ligne ? | What must be supplied and approved before launch, and how long does it take? | `/tarifs-menu-digital-restaurant` ↔ `/en/pricing-digital-restaurant-menu` | Étapes, validation préalable et délai généralement d’environ deux semaines après conditions décrits. Conserver ces conditions ; ne pas transformer en délai garanti. |

## Vérifier l’adéquation et la confiance

| # | Question FR | Question EN | Cible FR ↔ EN | Couverture / action minimale |
| --- | --- | --- | --- | --- |
| 26 | Vistaire accompagne-t-il les restaurants à Montréal, Laval ou Brossard ? | Does Vistaire serve restaurants in Montreal, Laval or Brossard? | Pages locales FR ↔ EN existantes | Zones déjà publiées ; supprimer les consignes de stratégie SEO visibles. Ne pas ajouter de bureau, présence physique ou référence locale non vérifiés. |
| 27 | Une carte digitale peut-elle rester fidèle à un restaurant haut de gamme ou gastronomique ? | Can a digital menu remain true to a high-end or fine dining restaurant? | `/menu-digital-restaurant-haut-de-gamme` ↔ `/en/high-end-restaurant-digital-menu` ; gastronomie ↔ fine-dining | Positionnement, papier complémentaire et sélection des plats déjà traités. Pas de nouvelles déclinaisons de cuisines sans contenu distinct. |
| 28 | Qui rédige ou relit les guides, et quand ont-ils été mis à jour ? | Who writes or reviews the guides, and when were they updated? | Six guides existants ; `/a-propos` ↔ `/en/about` | Manque de preuve publique : aucun auteur/date enregistré. Renseigner seulement des responsables et dates réels, alignés HTML/Article/sitemap ; ne pas fabriquer des experts. |
| 29 | Les démonstrations sont-elles des exemples ou des résultats clients vérifiés ? | Are the demonstrations examples or verified customer results? | `/demo` ↔ `/en/vistaire-menu` ; `/a-propos` ↔ `/en/about` | Démonstrations visibles ; statut commercial non établi par cet audit. Éviter l’ambiguïté de référence et n’ajouter étude de cas/résultat chiffré qu’avec preuve et autorisation réelles. |
| 30 | Comment parler de mon restaurant avant de démarrer ? | How can I discuss my restaurant before starting? | `/prendre-rendez-vous` ↔ `/en/book-a-call` ; `/contact` ↔ `/en/contact` | CTA, courriel et téléphone présents. Parcours accompagné, sans inventer d’inscription autonome ni d’API d’onboarding. |

## Usage conseillé

Les intentions 15, 20, 22 et 24 justifient une correction immédiate du Markdown des tarifs à partir des champs déjà approuvés. Les intentions 26 et 29 justifient de nettoyer quelques libellés, sans nouveaux contenus factuels. L’intention 28 dépend d’informations éditoriales réelles que le code ne contient pas. Toutes les autres sont largement couvertes ; conserver l’architecture et observer les requêtes réellement reçues avant de créer des pages supplémentaires.

