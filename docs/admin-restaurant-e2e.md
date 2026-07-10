# Validation E2E du dashboard restaurateur

Le job **Admin restaurant E2E (manual controlled preview)** est une preuve live manuelle et fail-closed. Il est déclenché uniquement avec `workflow_dispatch` depuis le workflow `Admin restaurant E2E`, dans l’environnement GitHub `admin-e2e`. Il ne s’exécute pas automatiquement sur les pull requests et ne bloque donc pas le CI normal.

Le job doit utiliser une preview HTTPS contrôlée de Vistaire reliée à un projet Supabase/Vercel non client. Il ne doit jamais utiliser Trouvable, `www.vistaire.ca`, `vistaire.ca` ou des données de production. Le script `node scripts/admin-e2e-fixture-contract.mjs` valide ce contrat sans afficher les tokens et peut être relancé sans effet de bord.

## Fixtures obligatoires

Les fixtures doivent être créées dans une base de test/preview dédiée, avec le vrai flux métier de création de QR :

- Restaurant A : `Vistaire E2E Restaurant A`, menu principal publié, catégorie et au moins deux plats.
- Restaurant B : `Vistaire E2E Restaurant B`, menu principal publié, catégorie et au moins un plat.
- QR admin actif A et QR admin actif B : `target_kind=admin`, `target_path=/admin`.
- QR admin suspendu : rattaché à une fixture dédiée, avec le statut suspendu réel (`paused` ou équivalent).

La préparation doit être idempotente côté environnement de test : réutiliser ou mettre à jour ces fixtures contrôlées, sans créer de doublons à chaque run. Les QR doivent être générés par l’endpoint/service owner réel ; aucun hash manuel ne doit contourner ce flux. Le token brut est retourné une seule fois, placé uniquement dans le secret GitHub correspondant et jamais stocké en clair dans Supabase.

Le dépôt ne provisionne pas les restaurants, les menus, les QR, les secrets ou Supabase. Cette séparation est volontaire : la configuration externe n’était pas disponible lors de cette mise à jour et aucune donnée client n’a été modifiée.

## Environnement GitHub `admin-e2e`

Variable obligatoire :

- `VISTAIRE_ADMIN_E2E_ENABLED=true`

Variables non secrètes obligatoires :

- `VISTAIRE_ADMIN_E2E_BASE_URL` : URL HTTPS de la preview contrôlée, jamais l’origine de production.
- `VISTAIRE_ADMIN_E2E_RESTAURANT_NAME` : `Vistaire E2E Restaurant A`.
- `VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME` : `Vistaire E2E Restaurant B`.

Secrets obligatoires :

- `VISTAIRE_ADMIN_E2E_QR_TOKEN` : QR admin actif A.
- `VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN` : QR admin actif B.
- `VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN` : QR admin suspendu.
- `VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN` : QR de fixture dédiée de repli/diagnostic, jamais Trouvable.

Le preflight exige quatre tokens non vides, distincts et opaques ; il rejette les marqueurs `trouvable`, `demo` et `production`. Il vérifie aussi que les noms A/B sont exactement ceux des fixtures non clientes et que l’URL ne cible pas un domaine Vistaire de production.

## Lancer la preuve contrôlée

Dans GitHub, ouvrir **Actions → Admin restaurant E2E → Run workflow**, sélectionner `main`, puis lancer le workflow. Le workflow refuse toute autre référence avant le checkout et vérifie toujours `main` au checkout. Ce garde-fou réduit le risque d’exécuter du code de pull request avec les secrets QR, mais la protection complète dépend aussi de la configuration GitHub de l’environnement : `admin-e2e` doit restreindre les branches/tags de déploiement à `main` et exiger l’approbation d’un mainteneur. Ces règles sont externes au dépôt et ne sont pas modifiées par ce PR.

La vérification effectuée pour ce PR montre actuellement `protection_rules: []` et aucune `deployment_branch_policy` sur `admin-e2e`. Tant que l’administrateur du dépôt n’a pas ajouté ces protections, il ne faut pas provisionner ni utiliser de secrets QR réels. Le preflight valide ensuite l’environnement avant d’installer Chromium ou d’exécuter Playwright ; une variable ou un secret manquant, vide ou incohérent fait échouer le job explicitement. Il n’existe donc pas de réussite artificielle lorsque l’infrastructure externe n’est pas configurée.

Le workflow manuel peut aussi être lancé avec GitHub CLI :

`gh workflow run admin-restaurant-e2e.yml --ref main`

Le résultat `success` du workflow manuel est une preuve séparée de la CI automatique. La CI App conserve `npm ci`, lint, typecheck, tests SEO, `npm run test:admin`, build et smoke SEO ; ces contrôles restent les checks bloquants des pull requests. Le workflow live manuel est donc explicitement non bloquant pour les pull requests normales. Le bouton GitHub n’est disponible que lorsque ce workflow est présent sur la branche par défaut ; sa présence dans ce PR ne crée aucun check automatique.

## Preuve fournie par le spec

En mode local sans fixtures, les scénarios live sont explicitement ignorés pour permettre les tests de structure. En CI, `VISTAIRE_REQUIRE_ADMIN_E2E=1` est fixé avant Playwright : une fixture manquante provoque un échec, jamais un skip silencieux.

Le spec vérifie :

- accès direct `/admin` verrouillé à 390 et 430 px ;
- échange QR A/B, cookie de session et noms exacts des deux fixtures ;
- isolation : B ne peut pas modifier un plat de A ;
- QR suspendu refusé sans cookie admin ;
- logout et suppression de session ;
- toggle réel de disponibilité sur A, reflet dans le menu public, puis restauration idempotente dans un `finally` ;
- relecture après restauration côté dashboard et menu public ;
- absence d’erreurs console, de réponses 404/500 et de requêtes réseau échouées ;
- absence de requêtes `.glb` et `.usdz` pendant ces parcours ;
- absence de débordement horizontal sur les largeurs mobiles 390 et 430 px.

Une exécution live n’est une preuve que si le job est `success`, sans test critique ignoré, et que la preview, les fixtures A/B, le QR suspendu, le toggle/restauration et le réseau sont visibles dans les logs/artifacts du run. Sans ces preuves, ce job ne constitue pas une preuve de validation live. Tant que l’environnement `admin-e2e`, la preview contrôlée et les fixtures dédiées ne sont pas configurés, le workflow manuel échoue au preflight ; cette absence ne bloque pas les pull requests normales, mais elle interdit de déclarer la validation live réussie.
