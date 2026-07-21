# Validation E2E du dashboard restaurateur

Le job **Admin restaurant E2E (manual controlled preview)** est une preuve live manuelle et fail-closed. Il est déclenché uniquement avec `workflow_dispatch` depuis le workflow `Admin restaurant E2E`, dans l’environnement GitHub `admin-e2e`. Il ne s’exécute pas automatiquement sur les pull requests et ne bloque donc pas le CI normal.

Le job doit utiliser une preview HTTPS contrôlée de Vistaire reliée à un projet Supabase/Vercel non client. Il ne doit jamais utiliser Trouvable, `www.vistaire.ca`, `vistaire.ca` ou des données de production. Le script `node scripts/admin-e2e-trusted-preflight.mjs` vérifie les identités authentifiées Vercel sans afficher les tokens et peut être relancé sans effet de bord.

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

Variables non secrètes obligatoires dans l’environnement :

- `VISTAIRE_ADMIN_E2E_RESTAURANT_NAME` : `Vistaire E2E Restaurant A`.
- `VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME` : `Vistaire E2E Restaurant B`.

Secrets obligatoires :

- `VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN` : jeton de lecture limité aux métadonnées du projet et des déploiements attendus.
- `VISTAIRE_ADMIN_E2E_QR_TOKEN` : QR admin actif A.
- `VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN` : QR admin actif B.
- `VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN` : QR admin suspendu.
- `VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN` : QR de fixture dédiée de repli/diagnostic, jamais Trouvable.

Le preflight exige quatre tokens non vides, distincts et opaques ; il rejette les marqueurs `trouvable`, `demo` et `production`. Il vérifie aussi que les noms A/B sont exactement ceux des fixtures non clientes et que l’URL ne cible pas un domaine Vistaire de production.

Le déclenchement demande huit inputs non secrets : `expected_preview_host`, `expected_vercel_project_id`, `expected_team_id`, `expected_repository`, `expected_branch`, `expected_commit_sha`, `expected_supabase_project_ref` et `base_url`. Les secrets ne doivent jamais être copiés dans ces inputs. Le token API Vercel reste limité au preflight trusted. Les trois QR live sont contrôlés par le preflight puis transmis uniquement à Playwright ; le QR fallback est contrôlé par le preflight mais n’est jamais transmis au navigateur.

L’API Vercel peut représenter un déploiement de branche non-Production par `target: "preview"` ou par `target: null`. Le preflight accepte uniquement ces deux formes comme Preview et refuse toute cible `production` ou tout alias Production.

Avant toute première exécution, l’environnement `admin-e2e` doit satisfaire toutes les conditions suivantes :

- au moins un **required reviewer** mainteneur ;
- uniquement des branches autorisées explicitement, limitées à `main`, sans wildcard ;
- politique de bypass administrateur documentée et, de préférence, désactivée ;
- secrets exclusivement issus des fixtures isolées, jamais de token client ou Production ;
- variables et inputs exacts relus par l’approbateur ;
- rotation puis suppression des fixtures et secrets après la campagne.

Ne pas lancer le workflow et ne pas provisionner ses secrets tant que ces protections ne sont pas en place.

## Lancer la preuve contrôlée

Dans GitHub, ouvrir **Actions → Admin restaurant E2E → Run workflow**, sélectionner `main`, puis lancer le workflow. Le workflow refuse toute autre référence avant le checkout et vérifie toujours `main` au checkout. Ce garde-fou réduit le risque d’exécuter du code de pull request avec les secrets QR, mais la protection complète dépend aussi de la configuration GitHub de l’environnement : `admin-e2e` doit restreindre les branches/tags de déploiement à `main` et exiger l’approbation d’un mainteneur. Ces règles sont externes au dépôt et ne sont pas modifiées par ce PR.

La vérification read-only effectuée le 21 juillet 2026 montre actuellement `protection_rules: []`, aucune `deployment_branch_policy`, `can_admins_bypass=true`, zéro secret et zéro variable sur `admin-e2e`. Tant que l’administrateur du dépôt n’a pas ajouté ces protections, il ne faut pas provisionner ni utiliser de secrets QR réels. Le preflight valide ensuite l’environnement avant d’installer Chromium ou d’exécuter Playwright ; une variable ou un secret manquant, vide ou incohérent fait échouer le job explicitement. Il n’existe donc pas de réussite artificielle lorsque l’infrastructure externe n’est pas configurée.

Après merge sur `main` et configuration humaine des protections, le workflow manuel peut aussi être préparé avec GitHub CLI en fournissant tous les inputs :

`gh workflow run admin-restaurant-e2e.yml --ref main -f expected_preview_host=<preview>.vercel.app -f expected_vercel_project_id=prj_... -f expected_team_id=team_... -f expected_repository=MarcSaad-Hadidi/Vistaire -f expected_branch=<branche> -f expected_commit_sha=<sha-40> -f expected_supabase_project_ref=<ref-preview> -f base_url=https://<preview>.vercel.app`

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

Une exécution live n’est une preuve que si le job est `success`, sans test critique ignoré, et que le résumé sûr confirme READY, Preview et les correspondances projet/repository/branche/SHA/Supabase. Aucun artefact contenant une URL QR n’est conservé. Sans ces conditions, le run ne constitue pas une preuve de validation live. Tant que l’environnement `admin-e2e`, la preview contrôlée et les fixtures dédiées ne sont pas configurés, le workflow manuel échoue au preflight ; cette absence ne bloque pas les pull requests normales, mais elle interdit de déclarer la validation live réussie.
