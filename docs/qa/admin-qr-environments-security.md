# Audit sécurité des environnements QR admin

Date de l’audit : 18 juillet 2026

Branche source : `codex/qr-schema-migration` au commit `24e60dd1d57cfc10db60570f17e3b609ece7d092`

Branche de travail : `codex/qr-e2e-environments-security`

## Portée et règles d’intervention

L’audit couvre les identités d’environnement Vercel et Supabase, les hôtes,
les cookies, les journaux expurgés, l’isolation restaurant A/B, les tokens
invalides et la révocation des accès QR admin.

Toutes les inspections Vercel et Supabase ont été effectuées en lecture seule.
Aucune variable, donnée, fixture distante, migration, branche Supabase,
configuration, Preview ou Production n’a été créée ou modifiée. Aucun token QR
client ou secret n’a été utilisé ni affiché.

## État observé par environnement

| Environnement | Preuve disponible | Limite ou risque |
| --- | --- | --- |
| Développement | Les tests Node prouvent que le preview admin local exige un hôte loopback, un cookie signé et `NODE_ENV` différent de `production`. Le cookie local ne donne que `dashboard:read`. | Aucun serveur local n’a été démarré pour cet audit read-only. |
| Preview Vercel | Une Preview existante d’une autre branche est `READY`, protégée par Vercel SSO et `noindex`. Son cookie SSO est `Secure`, `HttpOnly` et `SameSite=Lax`. Les logs agrégés n’exposent aucun secret. | Aucune Preview du commit `24e60dd…` ou de cette branche n’existe. Les cookies QR applicatifs et les scénarios A/B ne peuvent donc pas être validés en live. |
| Production Vercel | Le dernier déploiement observé est `READY` sur `main`, au commit `6236c42d7d5b0b17c42d2eda9857ff0964090187`. Les builds Production et Preview inspectés n’ont aucune ligne d’erreur. | Le correctif de ce rapport n’est pas en Production. |
| Supabase Vistaire | RLS est active sur `qr_codes`; aucun droit n’est accordé à `PUBLIC`, `anon` ou `authenticated`; les résolveurs QR ne sont exécutables que par `service_role`. Les logs 24 h agrégés ne montrent aucun 4xx/5xx QR/Auth ni erreur Postgres. | Aucun projet ou branche Vistaire Preview isolé n’a pu être prouvé. Le projet connecté ne contient pas encore la migration canonique QR du commit source. |

## P1 corrigés dans ce lot

### Preflight Preview fail-closed

Le preflight refusait auparavant seulement les domaines Vistaire de Production
connus. Une autre alias Vercel, y compris une alias Production, pouvait être
acceptée avant l’exécution des specs contenant les tokens QR.

Le contrat exige désormais :

- une origine HTTPS sans identifiants, chemin, query ou fragment ;
- un hostname Vercel Preview exact fourni par
  `VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST` ;
- une alias de branche Vercel contenant `-git-` et terminant par
  `.vercel.app`, hors branches `main`, `master` et `production`, ce qui exclut
  les alias Production standard observées ;
- l’équipe, le projet, la branche et le commit exacts fournis par
  `VISTAIRE_ADMIN_E2E_VERCEL_TEAM_ID`,
  `VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID`,
  `VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH` et
  `VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA` ;
- une URL Supabase dédiée fournie par `VISTAIRE_ADMIN_E2E_SUPABASE_URL` ;
- une ref attendue non vide fournie par
  `VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF` ;
- une correspondance exacte entre l’URL Supabase et cette ref ;
- une lecture authentifiée du déploiement exact via l’API Vercel : le
  déploiement doit être `READY`, avoir un target Preview, correspondre au
  projet, à la branche et au commit attendus, et exposer les deux valeurs
  Supabase effectives attendues.

Le workflow manuel transmet ces identités non secrètes au preflight avec les
secrets déjà contrôlés localement. Le token API Vercel est utilisé uniquement
pour un `GET` de métadonnées ; le script ne modifie rien, ne journalise ni la
réponse complète ni une valeur d’environnement, et n’affiche aucun secret. Si
une identité manque ou diverge, le job échoue avant de lancer le navigateur.
La protection reste dépendante de la configuration de l’environnement GitHub
`admin-e2e` : les variables attendues doivent être administrées et protégées.

### Artefacts Playwright sensibles désactivés

Les scénarios live placent temporairement un token QR dans `/q/<token>`.
Avec retry, trace ou capture sur échec, cette URL pouvait être persistée dans un
artefact de test.

Le workflow active maintenant `VISTAIRE_ADMIN_E2E_SENSITIVE=1`. Dans ce mode,
Playwright force :

- `retries: 0` ;
- `trace: "off"` ;
- `screenshot: "off"` ;
- `video: "off"` ;
- `preserveOutput: "never"`.

Avant le preflight et Playwright, le workflow enregistre aussi le token API
Vercel et les quatre tokens QR avec la commande GitHub `add-mask`. Un message
d’erreur Playwright contenant `/q/<token>` est donc expurgé dans les logs
Actions, même si le reporter `list` affiche le call log.

Les autres suites Playwright gardent leur comportement précédent.

## Contrôles Node dédiés

`tests/qr-environment-security.test.mjs` couvre :

- le rejet des hôtes locaux, Production, avec credentials ou différents de
  l’hôte Vercel Preview attendu ;
- la vérification distante du target Preview, de l’état `READY`, du projet, de
  la branche et du commit Vercel exacts ;
- le rejet de métadonnées Vercel Production ou d’un binding Supabase déviant ;
- le rejet d’une URL/ref Supabase absente ou incohérente ;
- la non-divulgation des valeurs des quatre tokens par le preflight ;
- la séparation dev/Preview/Production du preview local ;
- les attributs des cookies admin et leur expiration ;
- l’isolation restaurant A/B ;
- les sessions invalides ou expirées ;
- l’invalidation immédiate d’un cookie quand le QR live passe à `paused` ;
- la désactivation des artefacts pour le workflow secret-bearing ;
- le masquage explicite des tokens avant tout call log Playwright.

Les fixtures du test sont entièrement synthétiques et locales. Au moment de cet
audit, le schéma distant legacy accepte `active`, `paused` et `archived` ; le
contrat candidat ultérieur ajoute `revoked` comme statut persistant irréversible.
Cette distinction ne doit pas être projetée rétroactivement sur le schéma live.

## Risques résiduels et interdictions

- Le correctif n’est déployé dans aucun environnement au moment de ce rapport.
- La migration `20260717120000_owner_qr_canonical_lifecycle.sql` est absente du
  projet Supabase Vistaire inspecté. Un déploiement du commit cible contre ce
  schéma échouerait sur les RPC/colonnes canoniques.
- L’isolation Supabase dev/Preview/Production n’est pas démontrée : un seul
  projet Vistaire actif est identifiable et la lecture des branches a échoué
  côté connecteur.
- Aucun scénario live A/B, token invalide, pause ou logout n’est déclaré validé
  tant qu’une Preview de ce commit et des fixtures non clientes dédiées
  n’existent pas.
- Il reste interdit de provisionner des secrets QR réels tant que
  l’environnement GitHub `admin-e2e` n’a pas de règles de protection et de
  branche vérifiées.

Ce lot ne déploie rien, n’applique aucune migration et ne configure aucun
environnement distant.

## Coordination live post-audit — 20 juillet 2026

Les lectures distantes ultérieures ont confirmé, sans exposer d’identifiant
complet ni de secret :

- Supabase Vistaire utilise PostgreSQL 17.6 et reste au schéma QR legacy ; la
  migration canonique `20260717120000_owner_qr_canonical_lifecycle.sql` est
  absente ;
- les agrégats sûrs Vistaire comptent 7 QR admin actifs et 1 QR menu actif ;
- le projet Supabase nommé Trouvable est sans lien avec Vistaire et ne contient
  pas `qr_codes` ;
- la Preview PR 153 est `READY` pour la branche, le commit audité et le projet
  attendus ; la Production est `READY` sur `main` au SHA audité antérieur ;
- l’environnement GitHub `admin-e2e` n’a ni protection, reviewer, politique de
  branche, secrets ni variables configurés ;
- les protections/rulesets sont indisponibles (HTTP 403) sur le plan privé
  actuel ; les required reviewers exigent une mise à niveau/configuration
  externe.

Conclusion : les docs et le preflight peuvent être prêts à revoir, mais le
contrat DB/runtime lifecycle candidat n’est pas intégré sur le head audité. Le
contrôle externe est **BLOCKED** et la QA live reste **NOT VERIFIED**. Le preflight doit échouer
avant le navigateur tant que le provisioning explicite et les protections ne
sont pas en place. Voir
[`qr-environment-rollout-runbook.md`](qr-environment-rollout-runbook.md) ; aucune
promotion ni aucun nettoyage historique ne doivent être automatiques.
