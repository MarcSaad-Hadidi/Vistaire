# Validation E2E du dashboard restaurateur

Les scénarios critiques de `e2e/admin-restaurant-dashboard.spec.ts` se lancent en lecture locale sans fixture QR, mais les scénarios réels sont alors explicitement signalés comme ignorés. Ils ne sont jamais une preuve de déploiement.

Pour la validation contrôlée du PR, activer l’environnement GitHub `admin-e2e` avec la variable `VISTAIRE_ADMIN_E2E_ENABLED=true`. Le job **Admin restaurant E2E (controlled preview)** devient alors obligatoire et fixe `VISTAIRE_REQUIRE_ADMIN_E2E=1`. Toute fixture manquante fait échouer le job avant que les scénarios QR ne puissent être ignorés.

Utiliser uniquement une preview Vistaire contrôlée, jamais la production, dans `VISTAIRE_ADMIN_E2E_BASE_URL`. Cette preview doit déjà contenir la migration QR et les secrets de session correspondant au projet Vistaire.

Variables GitHub non secrètes :

- `VISTAIRE_ADMIN_E2E_BASE_URL` : URL HTTPS de la preview contrôlée.
- `VISTAIRE_ADMIN_E2E_RESTAURANT_NAME` : nom exact du restaurant A dédié au test.
- `VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME` : nom exact du restaurant B dédié au test.

Secrets GitHub :

- `VISTAIRE_ADMIN_E2E_QR_TOKEN` : QR admin actif du restaurant A.
- `VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN` : QR admin actif du restaurant B.
- `VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN` : QR admin suspendu.
- `VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN` : QR d’un restaurant dont les analytics sont insuffisantes.

Les restaurants A/B et leurs QR sont des fixtures dédiées. Le test bascule un plat du restaurant A puis le restaure dans le même scénario. Il ne doit jamais utiliser le QR principal Trouvable ni modifier un restaurant client.

Le job vérifie : verrouillage de `/admin`, cookie QR, séparation A/B, rejet d’un QR suspendu, logout, absence de GLB/USDZ sans intention, erreurs console/réseau et mobile 390/430 px. Les résultats doivent être inspectés avant promotion de la preview ; ce workflow ne déploie et ne merge rien.
