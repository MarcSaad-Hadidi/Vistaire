# Vistaire

Vistaire est une expérience de menu pour restaurants : carte mobile par QR,
fiches plats, langues, devises, allergènes et visualisation 3D/AR à la demande.
Maison Élyse, Trouvable, Sauge Noire et le rendu générique gardent leurs
identités. Le propriétaire prépare le menu et ses QR ; l'admin restaurant
accède à un cockpit limité par sa session QR.

## Parcours du code

```text
app/                    Routes Next.js App Router, pages et API
  (fr)/menu/[slug]/     Carte publique et dishes/[dishSlug]
  (fr)/owner/           Espace propriétaire
  (fr)/admin/           Cockpit restaurant
  (fr)/(seo|geo)/       Pages éditoriales françaises
  (en)/en/             Présentation et SEO anglais
components/
  menu/                 Renderers, fiches et contrôles du menu
    unique/sauge-noire/  Expérience Sauge Noire
  owner/ · admin/       Formulaires, builder et cockpit
  dish/                 Viewer 3D chargé après intention
  landing/ · vistaire-preview/ · seo/  Présentation publique
lib/
  menu/                 Résolution, configuration et contrats publics
  auth/ · admin/        Politiques owner, sessions/capabilities admin
  owner/                Mutations, QR et pipelines médias propriétaire
  storage/ · ar/        Backend objet, identifiants et décisions AR
  dish3dManifest.ts     Validation et sélection des assets publics
utils/supabase/         Clients serveur et vérification du projet
scripts/                Validations CI et outils opérateur
tests/ · e2e/          Contrats Node/PostgreSQL et parcours Playwright
```

Une requête `/menu/[slug]` commence dans sa page serveur et
`lib/menu/publicMenuRenderContext.ts`, puis choisit le renderer approprié.
Les fiches partagent les contrats de navigation et de données sans fusionner
les identités visuelles. Les fichiers de route, frontières serveur/client et
imports différés restent séparés lorsqu'ils portent cette responsabilité.

Clerk et `lib/auth/` protègent l'owner ; `lib/admin/` vérifie la session QR et
l'accès au restaurant. Les mutations restent contrôlées côté serveur et le
service-role Supabase n'entre pas dans les composants publics. Les objets
médias gardent leurs chemins, versions, signatures et règles de publication.

Les pages marketing utilisent un document public statique/ISR. Les menus,
fiches et espaces authentifiés conservent leurs frontières dynamiques. Les
contrôles de graphe d'import et de prerender vérifient cette séparation.

## Démarrage

Node 24 et npm ; `package-lock.json` fixe l'installation.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Renseigner les intégrations utilisées dans `.env.local`, notamment Clerk,
Supabase et les secrets QR décrits dans [owner-admin-security](docs/owner-admin-security.md)
et [owner-qr-schema](docs/owner-qr-schema.md). Les clés privées restent côté
serveur et ne sont jamais commitées. `.env.example` décrit les options.

## Vérification

| Commande | Périmètre |
| --- | --- |
| `npm run assets:check` · `npm run lfs:check` | Politique de fichiers et absence de dépendance runtime LFS. |
| `npm run lint` · `npm run typecheck` | ESLint et TypeScript. |
| `npm run test:node` | Contrats, règles métier, sécurité et runners. |
| `npm run build` | Build de production Next.js. |
| `npm run test:ci:e2e:core` · `test:ci:e2e:menu` | Navigation et menus sur fixtures locales. |
| `npm run test:ci:e2e:sauge` · `test:ci:e2e:webkit` | Gestes Sauge et parcours WebKit critiques. |
| `npm run test:qr:functional` · `test:admin:full-menu` | QR et édition admin sur fixtures dédiées. |

Les cinq suites PostgreSQL passent par `scripts/run-postgres-tests.mjs` et
leurs commandes npm nommées. Elles exigent une base éphémère et les opt-ins
correspondants. Le [guide CI](docs/ci.md) relie les commandes, familles et
checks ; le [runbook admin E2E](docs/admin-restaurant-e2e.md) détaille les fixtures.

Le [builder](docs/menu-ui-builder.md), la [politique assets](docs/repo-asset-policy.md)
et le [pipeline 3D/AR](docs/owner-3d-ar-persistent-pipeline.md) décrivent les
opérations qui demandent leur propre procédure. Les médias sources et les
sorties de QA ne servent pas à documenter le code dans Git.
