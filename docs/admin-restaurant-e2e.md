# Validation E2E du dashboard restaurateur

Le job **Admin restaurant E2E (controlled preview)** est un contrôle fail-closed. Il est toujours matérialisé dans App CI : une configuration absente ou invalide fait échouer le job avec une erreur explicite ; elle ne peut plus transformer la preuve critique en `skipped`.

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

Le preflight exige trois tokens non vides, distincts et opaques ; il rejette les marqueurs `trouvable`, `demo` et `production`. Il vérifie aussi que les noms A/B sont exactement ceux des fixtures non clientes et que l’URL ne cible pas un domaine Vistaire de production.

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

Une exécution live n’est une preuve que si le job est `success`, sans test critique ignoré, et que la preview, les fixtures A/B, le QR suspendu, le toggle/restauration et le réseau sont visibles dans les logs/artifacts du run. Sans ces preuves, ce job ne constitue pas une preuve de validation live. Tant que l’environnement `admin-e2e`, la preview Vercel et les fixtures Supabase dédiées ne sont pas configurés, la validation live reste un prérequis externe bloquant et le PR doit rester en brouillon.
