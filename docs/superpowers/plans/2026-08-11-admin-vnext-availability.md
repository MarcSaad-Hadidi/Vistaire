# Vistaire Admin vNext Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer `/admin/availability` fidèle à `2.png`, avec disponibilité immédiate sûre, historique auditable et retours planifiés uniquement lorsqu'un schéma et un worker réellement opérationnels sont prouvés.

**Architecture:** La mutation immédiate conserve le RPC atomique service-role. Un schéma séparé ajoute audit et scheduling idempotent; un worker serveur exécute les échéances avec verrouillage concurrent. L'UI reçoit un contrat de capability combinant version de schéma/RPC, feature flag serveur et heartbeat récent, et se dégrade honnêtement vers le toggle immédiat.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase/Postgres PL/pgSQL, CSS modules/primitives Foundation, Node test runner, tests SQL, Playwright.

## Global Constraints

- Au handoff d'intégration des fondations, l'intégrateur transmet le SHA complet attendu dans `ADMIN_VNEXT_EXPECTED_BASE_SHA`. Affecter cette valeur à `$ExpectedBase`, exiger exactement 40 caractères hexadécimaux et créer `feat/admin-vnext-availability` depuis ce commit immuable; ne jamais résoudre la base depuis un label de jalon mouvant.
- Ownership exclusif : `app/admin/availability/page.tsx`, `app/admin/api/dishes/[dishId]/availability/**`, `app/api/internal/admin-availability-worker/route.ts`, `components/admin/availability/**`, `components/admin/AdminDishAvailabilityControl.tsx`, `components/admin/AdminDishWorklist.tsx`, `lib/admin/availability.ts`, `lib/admin/availability/**`, la migration et les tests Availability.
- Ne modifier ni primitives système/charts, ni Data Foundation, ni autres pages, ni `package.json`, ni `package-lock.json`.
- Ne jamais appliquer la migration en production. Le gate SQL exige Postgres local isolé ou branche Supabase éphémère.
- Une erreur d'autorisation ou réseau n'est jamais traduite en « schéma absent ».
- Sans version de schéma attendue, flag actif et `last_success_at` worker récent, le scheduling reste `unavailable`; aucune commande n'est simulée. Un attempt ou heartbeat reçu avant un échec RPC ne prouve pas l'exécution.
- Le toggle immédiat reste indépendant et ne dépend pas du worker.
- Toutes les dates sont affichées dans le fuseau validé du scope et stockées en `timestamptz`.
- Vérifier concurrence, idempotence, RLS/ACL, DST Toronto et révocation QR avant approbation.
- Les specs E2E Availability possédées s'exécutent avec `VISTAIRE_ADMIN_VISUAL_FIXTURE=1`, `VISTAIRE_REQUIRE_ADMIN_E2E=1` et `--reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts`; elles utilisent une entrée admin locale déterministe sans QR token, n'appellent jamais `test.skip`/`test.fixme` et refusent toute requête réseau hors loopback.

```powershell
$AvailabilityWorktree = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-availability'
$ExpectedBase = $env:ADMIN_VNEXT_EXPECTED_BASE_SHA
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ADMIN_VNEXT_EXPECTED_BASE_SHA doit être le SHA Git complet transmis au handoff' }

function Invoke-AvailabilityNative {
  param(
    [Parameter(Mandatory)][string]$Label,
    [Parameter(Mandatory)][scriptblock]$Command,
    [string]$WorkingDirectory = $AvailabilityWorktree,
    [switch]$ExpectFailure,
    [int[]]$ExpectedFailureExitCodes = @(1)
  )

  $Pushed = $false
  $PreviousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Stop'
    Push-Location -LiteralPath $WorkingDirectory -ErrorAction Stop
    $Pushed = $true
    if ($ExpectFailure -and $ExpectedFailureExitCodes.Count -eq 0) { throw "$Label requiert au moins un code d'échec attendu" }
    & $Command
    $ExitCode = $LASTEXITCODE
    if ($ExpectFailure) {
      if ($ExitCode -eq 0) { throw "$Label devait échouer en RED mais a réussi" }
      if ($ExitCode -notin $ExpectedFailureExitCodes) { throw "$Label a échoué avec le code inattendu $ExitCode; attendus: $($ExpectedFailureExitCodes -join ', ')" }
      Write-Output "$Label : échec RED observé (exit=$ExitCode)"
      return
    }
    if ($ExitCode -ne 0) { throw "$Label a échoué avec le code $ExitCode" }
  } finally {
    try {
      if ($Pushed) { Pop-Location }
    } finally {
      $ErrorActionPreference = $PreviousErrorActionPreference
    }
  }
}

function Assert-AvailabilityAdvisorReceipt {
  param(
    [Parameter(Mandatory)][hashtable]$Receipt,
    [Parameter(Mandatory)][string]$ExpectedProjectRef,
    [Parameter(Mandatory)][string]$ExpectedHead,
    [Parameter(Mandatory)][string]$ExpectedMigrationSha256,
    [Parameter(Mandatory)][string]$ExpectedDatabaseIdentity
  )

  if ($Receipt.ProjectRef -ne $ExpectedProjectRef -or $Receipt.Environment -notin @('local', 'ephemeral')) { throw 'Receipt advisors lié à une autre cible' }
  if ($Receipt.ReviewedHead -ne $ExpectedHead) { throw 'Receipt advisors lié à un autre HEAD' }
  if ($Receipt.MigrationSha256 -ne $ExpectedMigrationSha256) { throw 'Receipt advisors lié à une autre migration' }
  if ($Receipt.DatabaseIdentity.Trim() -ne $ExpectedDatabaseIdentity.Trim()) { throw 'Receipt advisors lié à une autre identité DB' }
  if ([string]::IsNullOrWhiteSpace($Receipt.SecurityCompletedAtUtc) -or [string]::IsNullOrWhiteSpace($Receipt.PerformanceCompletedAtUtc) -or [string]::IsNullOrWhiteSpace($Receipt.LogUri)) { throw 'Receipt advisors incomplet ou non auditable' }
  if ([int]$Receipt.OpenP0 -ne 0 -or [int]$Receipt.OpenP1 -ne 0) { throw 'Receipt advisors avec P0/P1 ouverts' }
}

$ActualBase = Invoke-AvailabilityNative 'merge-base Availability' { git merge-base HEAD $ExpectedBase }
if ($ActualBase -ne $ExpectedBase) { throw "La branche ne descend pas du handoff attendu: $ExpectedBase" }
```

---

### Task 1: Figer les contrats de capability et de vue

**Files:**
- Create: `lib/admin/availability/contracts.ts`
- Create: `lib/admin/availability/capability.ts`
- Create: `components/admin/availability/availabilityViewModel.ts`
- Create: `components/admin/availability/availabilityCopy.ts`
- Create: `tests/admin-vnext-availability.test.mjs`

**Interfaces:**

```ts
export type AvailabilitySchedulingCapability =
  | {
      kind: "available";
      schemaVersion: 1;
      workerLastSuccessAt: string;
    }
  | {
      kind: "unavailable";
      reason:
        | "feature-disabled"
        | "schema-not-deployed"
        | "rpc-version-mismatch"
        | "worker-not-active";
    }
  | { kind: "error"; retryable: boolean };

export type AvailabilityScheduleRequest = Readonly<{
  dishId: string;
  available: boolean;
  scheduledLocalDate: string;
  scheduledLocalTime: string;
  dstDisambiguation?: "earlier" | "later";
  idempotencyKey: string;
}>;
```

- [ ] **Step 1: Écrire les tests RED de détection et de projection**

Tester séparément flag coupé, fonction absente, permission refusée, version différente, `last_success_at` absent/périmé/invalide/futur, attempt récent suivi d'un échec RPC, capacité complète et fuseau fallback. Prouver que seul le cas complet rend les contrôles de planification actifs.

```powershell
Invoke-AvailabilityNative 'RED contrats Availability' { node --test tests/admin-vnext-availability.test.mjs } -ExpectFailure
```

Expected: échec car les contrats n'existent pas.

- [ ] **Step 2: Implémenter les unions fermées et la détection injectée**

La détection lit `ADMIN_AVAILABILITY_SCHEDULING_ENABLED === "1"`, interroge l'RPC de version puis `last_success_at` avec une horloge injectée et un TTL constant. Elle refuse les timestamps invalides ou futurs, classe explicitement les erreurs de permission et ne logue côté client qu'un code neutre.

- [ ] **Step 3: Implémenter le view model FR/EN**

Le modèle expose totaux catalogue, lignes, historique, retours et capability sans recomposer les métriques. Les échéances utilisent le timezone du scope.

- [ ] **Step 4: Relancer les tests et commit**

```powershell
Invoke-AvailabilityNative 'GREEN contrats Availability' { node --test tests/admin-vnext-availability.test.mjs }
Invoke-AvailabilityNative 'stage contrats Availability' { git add lib/admin/availability components/admin/availability/availabilityViewModel.ts components/admin/availability/availabilityCopy.ts tests/admin-vnext-availability.test.mjs }
Invoke-AvailabilityNative 'commit contrats Availability' { git commit -m "test(admin): define availability capabilities" }
```

### Task 2: Écrire la migration audit et scheduling

**Files:**
- Create: `supabase/migrations/20260811190000_admin_availability_schedule.sql`
- Create: `tests/postgres/admin-availability-scheduling/bootstrap.sql`
- Create: `tests/postgres/admin-availability-scheduling/security.test.sql`
- Create: `tests/postgres/admin-availability-scheduling/lifecycle.test.sql`
- Create: `tests/postgres/admin-availability-scheduling/concurrency.test.sql`
- Create: `tests/postgres/admin-availability-scheduling/dst.test.sql`
- Create: `tests/postgres/admin-availability-scheduling/run.sql`
- Modify: `tests/admin-availability-rpc.test.mjs`

**Database contract:**

- `admin_dish_availability_events`: append-only restaurant/menu/dish, previous/final state, actor kind, QR id nullable, schedule id nullable, timestamp.
- `admin_dish_availability_schedules`: restaurant/menu/dish, final state, `scheduled_for timestamptz`, timezone, status, idempotency key, requester QR, attempts, applied/error timestamps.
- `admin_availability_workers`: worker id, schema version, `last_attempt_at`, `last_success_at`; seul un succès transactionnel de `run_due_admin_dish_availability` avance `last_success_at`.
- service-role-only RPCs `get_admin_availability_capability`, `schedule_admin_dish_availability`, `cancel_admin_dish_availability`, `run_due_admin_dish_availability`.
- Le RPC immédiat `set_admin_dish_availability` écrit l'audit dans la même transaction.

- [ ] **Step 1: Étendre le test source RED**

Exiger `security definer`, `search_path=''`, ACL révoquées à public/anon/authenticated, checks scope, idempotency unique, audit append-only, `FOR UPDATE SKIP LOCKED` et advisory lock de worker.

```powershell
Invoke-AvailabilityNative 'RED RPC Availability' { node --test tests/admin-availability-rpc.test.mjs } -ExpectFailure
```

Expected: échec sur la migration absente.

- [ ] **Step 2: Écrire la migration additive**

La migration ne contient aucun `UPDATE`, `DELETE`, `TRUNCATE` ni seed de production. Les tables ont RLS activé sans policy client. La migration révoque explicitement tout droit table/séquence et tout `EXECUTE` de fonction à `PUBLIC`, `anon` et `authenticated`, puis accorde seulement les privilèges minimaux requis à `service_role`; elle ne dépend pas des anciens default grants Supabase. Chaque RPC `security definer` fixe `search_path=''`, qualifie chaque objet et revalide restaurant, menu publié, dish et QR actif au moment de l'opération. Les tests prouvent aussi les ACL via `has_table_privilege`, `has_sequence_privilege` et `has_function_privilege`.

- [ ] **Step 3: Écrire les tests SQL de sécurité et lifecycle**

Prouver : refus anon/authenticated; révocation QR; dish cross-menu; répétition du même idempotency key; annulation; transition pending→applied; audit atomique; deux workers concurrents n'appliquent qu'une fois; retry contrôlé; échec RPC qui avance `last_attempt_at` sans avancer `last_success_at`; échéances autour de `2026-03-08` et `2026-11-01` Toronto.

- [ ] **Step 4: Exécuter le gate Node puis le gate Postgres isolé**

```powershell
Invoke-AvailabilityNative 'GREEN RPC Availability' { node --test tests/admin-availability-rpc.test.mjs }
$EphemeralDatabaseUrl = $env:ADMIN_VNEXT_EPHEMERAL_DATABASE_URL
$EphemeralProjectRef = $env:ADMIN_VNEXT_EPHEMERAL_PROJECT_REF
$ExpectedHost = $env:ADMIN_VNEXT_EXPECTED_DB_HOST
$ProductionProjectRef = $env:ADMIN_VNEXT_PRODUCTION_PROJECT_REF
if (-not $EphemeralDatabaseUrl) { throw 'ADMIN_VNEXT_EPHEMERAL_DATABASE_URL requise' }
if (-not $EphemeralProjectRef -or -not $ExpectedHost -or -not $ProductionProjectRef) { throw 'Project ref éphémère, host attendu et project ref production sont requis' }
if ($EphemeralProjectRef -eq $ProductionProjectRef) { throw 'Le project ref éphémère doit être distinct de la production' }
$EphemeralUri = [Uri]$EphemeralDatabaseUrl
$EphemeralUrlUser = ($EphemeralUri.UserInfo -split ':', 2)[0]
if ($EphemeralUri.Scheme -notin @('postgres', 'postgresql')) { throw 'URL Postgres éphémère invalide' }
if ($EphemeralUri.Host -ne $ExpectedHost) { throw 'Host DB différent du host éphémère attendu' }
if ($EphemeralUri.Host -match [regex]::Escape($ProductionProjectRef) -or $EphemeralUrlUser -match [regex]::Escape($ProductionProjectRef)) { throw 'Cible DB production explicitement rejetée' }
$IsLocalDatabase = $EphemeralUri.Host -in @('localhost', '127.0.0.1', '::1')
if (-not $IsLocalDatabase -and $EphemeralUri.Host -notlike "*$EphemeralProjectRef*" -and $EphemeralUrlUser -notlike "*$EphemeralProjectRef*") { throw "L’URL DB ne correspond pas au project ref éphémère" }
$DatabaseIdentity = (Invoke-AvailabilityNative 'identité DB Availability' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -At -v ON_ERROR_STOP=1 -c "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text" }).Trim()
if (-not $DatabaseIdentity) { throw "Impossible de vérifier l’identité de la base éphémère" }
Write-Output "Gate DB éphémère: project=$EphemeralProjectRef identity=$DatabaseIdentity"
Invoke-AvailabilityNative 'SQL Availability initial' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -v ON_ERROR_STOP=1 -f tests/postgres/admin-availability-scheduling/run.sql }
if ($LASTEXITCODE -ne 0) { throw 'Gate SQL Availability en échec' }
```

Expected: succès, avec uniquement le project ref et l'identité normalisée `database|user|server_addr|port`; ne jamais afficher l'URL, le mot de passe ou un secret. Si `psql`, l'URL, un project ref ou la base éphémère manque, si les refs sont identiques ou si l'identité DB échoue, arrêter la review avec le gate SQL bloqué; ne pas déclarer la migration validée.

- [ ] **Step 5: Exécuter les advisors Supabase sur la branche éphémère**

Lancer les advisors sécurité et performance via le projet éphémère, joindre les findings à la review et corriger tout P0/P1 dans cette migration.

- [ ] **Step 6: Commit isolé de migration, seulement après gates Node + Postgres + advisors verts**

```powershell
Invoke-AvailabilityNative 'stage migration Availability' { git add supabase/migrations/20260811190000_admin_availability_schedule.sql tests/postgres/admin-availability-scheduling tests/admin-availability-rpc.test.mjs }
Invoke-AvailabilityNative 'commit migration Availability' { git commit -m "feat(db): add scoped availability scheduling" }
```

### Task 3: Implémenter repositories et routes serveur

**Files:**
- Create: `lib/admin/availability/repository.ts`
- Create: `lib/admin/availability/scheduling.ts`
- Create: `lib/admin/availability/worker.ts`
- Modify: `lib/admin/availability.ts`
- Modify: `app/admin/api/dishes/[dishId]/availability/route.ts`
- Create: `app/admin/api/dishes/[dishId]/availability/schedule/route.ts`
- Create: `app/admin/api/dishes/[dishId]/availability/schedule/[scheduleId]/route.ts`
- Create: `app/api/internal/admin-availability-worker/route.ts`
- Modify: `tests/admin-availability.test.mjs`
- Create: `tests/admin-vnext-availability-worker.test.mjs`

- [ ] **Step 1: Écrire les tests RED des frontières HTTP**

Tester méthode/content-type/body exacts, same-origin, accès `dish:availability:write`, dish/menu scoped, UUID, date/heure locale, cutoff futur, idempotency key, feature disabled, capability absente, worker secret invalide, réponse neutre et revalidation après vérité serveur. Ajouter un navigateur dans un fuseau différent du restaurant, l'heure inexistante du printemps Toronto et les deux folds de `01:30` à l'automne; rejeter le gap et toute heure répétée sans `dstDisambiguation`.

```powershell
Invoke-AvailabilityNative 'RED worker Availability' { node --test tests/admin-availability.test.mjs tests/admin-vnext-availability-worker.test.mjs } -ExpectFailure
```

Expected: les nouveaux cas échouent.

- [ ] **Step 2: Implémenter le repository service-role étroit**

Coder en dur les RPCs et paramètres allowlistés. Le scheduling ne possède aucun fallback d'écriture directe. Les retours discriminent `not-found`, `forbidden`, `capability-unavailable`, `conflict` et `service-unavailable` sans texte Supabase côté client.

- [ ] **Step 3: Implémenter les routes schedule/cancel**

Chaque route revalide l'accès live, utilise le restaurant de l'accès, exige le même `dishId` que le path et revalide `/admin`, `/admin/availability` et les chemins publics après succès applicable. Le serveur prend le timezone uniquement depuis le scope validé et convertit `scheduledLocalDate + scheduledLocalTime + dstDisambiguation` en instant; il rejette les heures inexistantes et exige `earlier|later` pour une heure répétée. Aucun timezone caller ou timezone navigateur n'entre dans le scope.

- [ ] **Step 4: Implémenter le worker**

La route interne exige `Authorization: Bearer ${ADMIN_AVAILABILITY_WORKER_SECRET}`, limite le batch, écrit `last_attempt_at`, puis appelle l'RPC concurrent. Elle n'avance `last_success_at` qu'après succès transactionnel de l'RPC; timeout et erreurs conservent le dernier succès antérieur et laissent les jobs retryables. Elle n'accepte ni restaurant ni dish depuis la requête.

- [ ] **Step 5: Exécuter les tests et commit**

```powershell
Invoke-AvailabilityNative 'GREEN worker Availability' { node --test tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs tests/admin-vnext-availability-worker.test.mjs }
Invoke-AvailabilityNative 'typecheck worker Availability' { npm run typecheck }
Invoke-AvailabilityNative 'stage worker Availability' { git add lib/admin/availability.ts lib/admin/availability app/admin/api/dishes app/api/internal/admin-availability-worker tests/admin-availability.test.mjs tests/admin-vnext-availability-worker.test.mjs }
Invoke-AvailabilityNative 'commit worker Availability' { git commit -m "feat(admin): execute availability schedules safely" }
```

### Task 4: Recomposer la page Availability

**Files:**
- Modify: `app/admin/availability/page.tsx`
- Modify: `components/admin/availability/AdminAvailabilityPage.tsx`
- Modify: `components/admin/availability/AdminAvailabilityList.tsx`
- Modify: `components/admin/availability/AdminAvailability.module.css`
- Modify: `components/admin/AdminDishAvailabilityControl.tsx`
- Modify: `components/admin/AdminDishWorklist.tsx`
- Create: `components/admin/availability/AvailabilityScheduleForm.tsx`
- Create: `components/admin/availability/AvailabilityHistory.tsx`
- Create: `components/admin/availability/AvailabilityCapabilityNotice.tsx`
- Modify: `tests/admin-vnext-availability.test.mjs`

- [ ] **Step 1: Écrire les assertions RED de comportement UI**

Prouver filtres/search locaux, toggle immédiat, formulaire accessible, confirmation, compteur de note, historique, capability disabled, état pending et rafraîchissement depuis le serveur. Interdire toute sauvegarde locale considérée comme succès.

- [ ] **Step 2: Implémenter la hiérarchie fidèle à `2.png`**

Assembler KPI catalogue, toolbar, liste responsive, panneau de retour, actions groupées limitées aux opérations supportées et rails historique/alertes. Les actions groupées ne sont activées que si une API atomique correspondante existe; sinon elles deviennent navigation/aide et ne simulent aucune mutation de masse.

- [ ] **Step 3: Implémenter le fallback premium**

Quand le scheduling est indisponible, masquer les contrôles exécutables, afficher la raison localisée et conserver le toggle immédiat. Quand le loader échoue, conserver l'état serveur précédent uniquement comme visuel non interactif avec bouton de recharge.

- [ ] **Step 4: Exécuter tests, lint et typecheck**

```powershell
Invoke-AvailabilityNative 'GREEN UI Availability' { node --test tests/admin-vnext-availability.test.mjs tests/admin-availability.test.mjs }
Invoke-AvailabilityNative 'lint UI Availability' { npm run lint }
Invoke-AvailabilityNative 'typecheck UI Availability' { npm run typecheck }
```

- [ ] **Step 5: Commit**

```powershell
Invoke-AvailabilityNative 'stage UI Availability' { git add app/admin/availability/page.tsx components/admin/availability components/admin/AdminDishAvailabilityControl.tsx components/admin/AdminDishWorklist.tsx tests/admin-vnext-availability.test.mjs }
Invoke-AvailabilityNative 'commit UI Availability' { git commit -m "feat(admin): rebuild availability operations" }
```

### Task 5: QA navigateur et gates de branche

**Files:**
- Modify: `e2e/admin-availability.spec.ts`
- Create: `e2e/admin-vnext-availability.spec.ts`
- Modify: `tests/admin-vnext-availability.test.mjs`

- [ ] **Step 1: Écrire les scénarios E2E RED**

Couvrir immediate success/failure, scheduling disponible/indisponible, deux clics idempotents, annulation, refresh serveur, navigateur hors timezone restaurant, gap/folds DST Toronto, worker appelé mais RPC en échec, clavier, FR/EN, thèmes et viewports `390`, `430`, tablette, `1448 × 1086`. Modifier aussi `e2e/admin-availability.spec.ts` pour entrer par la fixture admin locale déterministe lorsque `VISTAIRE_ADMIN_VISUAL_FIXTURE=1`, sans lire `VISTAIRE_ADMIN_E2E_QR_TOKEN` et sans aucun `test.skip`, `test.fixme` ou branche de succès vide. Installer une garde réseau qui échoue dès qu'une requête HTTP(S), WebSocket ou EventSource vise un host autre que `localhost`, `127.0.0.1` ou `::1`; vérifier console, réseau et absence de 404/500 inattendus. Étendre `tests/admin-vnext-availability.test.mjs` avec un contrat source qui interdit le token QR/les skips dans les deux specs et exige la garde loopback.

- [ ] **Step 2: Exécuter Playwright**

```powershell
$AdminEnvNames = @('VISTAIRE_ADMIN_VISUAL_FIXTURE', 'VISTAIRE_REQUIRE_ADMIN_E2E', 'VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'VISTAIRE_ADMIN_E2E_QR_TOKEN')
$PreviousAdminEnv = @{}
foreach ($AdminEnvName in $AdminEnvNames) {
  $PreviousAdminEnv[$AdminEnvName] = [Environment]::GetEnvironmentVariable($AdminEnvName, 'Process')
}
try {
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_VISUAL_FIXTURE', '1', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_REQUIRE_ADMIN_E2E', '1', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'full-menu', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_E2E_QR_TOKEN', '15000000-0000-0000-0000-000000000150', 'Process')
  Invoke-AvailabilityNative 'Playwright Availability hermétique sans skip' { node scripts/run-playwright-e2e.mjs e2e/admin-availability.spec.ts e2e/admin-vnext-availability.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only --build --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts }
} finally {
  foreach ($AdminEnvName in $AdminEnvNames) {
    [Environment]::SetEnvironmentVariable($AdminEnvName, $PreviousAdminEnv[$AdminEnvName], 'Process')
  }
}
```

- [ ] **Step 3: Rejouer le gate Postgres et les checks complets**

```powershell
$EphemeralDatabaseUrl = $env:ADMIN_VNEXT_EPHEMERAL_DATABASE_URL
$EphemeralProjectRef = $env:ADMIN_VNEXT_EPHEMERAL_PROJECT_REF
$ExpectedHost = $env:ADMIN_VNEXT_EXPECTED_DB_HOST
$ProductionProjectRef = $env:ADMIN_VNEXT_PRODUCTION_PROJECT_REF
if (-not $EphemeralDatabaseUrl) { throw 'ADMIN_VNEXT_EPHEMERAL_DATABASE_URL requise' }
if (-not $EphemeralProjectRef -or -not $ExpectedHost -or -not $ProductionProjectRef) { throw 'Project ref éphémère, host attendu et project ref production sont requis' }
if ($EphemeralProjectRef -eq $ProductionProjectRef) { throw 'Le project ref éphémère doit être distinct de la production' }
$EphemeralUri = [Uri]$EphemeralDatabaseUrl
$EphemeralUrlUser = ($EphemeralUri.UserInfo -split ':', 2)[0]
if ($EphemeralUri.Scheme -notin @('postgres', 'postgresql')) { throw 'URL Postgres éphémère invalide' }
if ($EphemeralUri.Host -ne $ExpectedHost) { throw 'Host DB différent du host éphémère attendu' }
if ($EphemeralUri.Host -match [regex]::Escape($ProductionProjectRef) -or $EphemeralUrlUser -match [regex]::Escape($ProductionProjectRef)) { throw 'Cible DB production explicitement rejetée' }
$IsLocalDatabase = $EphemeralUri.Host -in @('localhost', '127.0.0.1', '::1')
if (-not $IsLocalDatabase -and $EphemeralUri.Host -notlike "*$EphemeralProjectRef*" -and $EphemeralUrlUser -notlike "*$EphemeralProjectRef*") { throw "L’URL DB ne correspond pas au project ref éphémère" }
$DatabaseIdentity = (Invoke-AvailabilityNative 'identité DB Availability finale' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -At -v ON_ERROR_STOP=1 -c "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text" }).Trim()
if (-not $DatabaseIdentity) { throw "Impossible de vérifier l’identité de la base éphémère" }
Write-Output "Gate DB éphémère: project=$EphemeralProjectRef identity=$DatabaseIdentity"
Invoke-AvailabilityNative 'SQL Availability final' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -v ON_ERROR_STOP=1 -f tests/postgres/admin-availability-scheduling/run.sql }
Invoke-AvailabilityNative 'assets Availability' { npm run assets:check }
Invoke-AvailabilityNative 'lfs Availability' { npm run lfs:check }
Invoke-AvailabilityNative 'lint Availability' { npm run lint }
Invoke-AvailabilityNative 'typecheck Availability' { npm run typecheck }
Invoke-AvailabilityNative 'build Availability' { npm run build }
Invoke-AvailabilityNative 'test:admin Availability' { npm run test:admin }
```

Expected: succès complet. L'absence de l'environnement Postgres bloque l'intégration de la capacité scheduling, même si le fallback UI passe.

- [ ] **Step 4: Nettoyer et vérifier l'ownership**

Supprimer les artefacts générés, puis :

```powershell
Invoke-AvailabilityNative 'diff-check Availability' { git diff --check "$ExpectedBase...HEAD" }
Invoke-AvailabilityNative 'diff paths Availability' { git diff --name-only "$ExpectedBase...HEAD" }
Invoke-AvailabilityNative 'status Availability' { git status --short }
```

- [ ] **Step 5: Commit**

```powershell
Invoke-AvailabilityNative 'stage E2E Availability' { git add e2e/admin-availability.spec.ts e2e/admin-vnext-availability.spec.ts tests/admin-vnext-availability.test.mjs }
Invoke-AvailabilityNative 'commit E2E Availability' { git commit -m "test(admin): verify availability lifecycle" }
```

- [ ] **Step 6: Relancer les advisors et émettre le receipt final obligatoire**

Après le commit final, relancer Security Advisors et Performance Advisors sur `$EphemeralProjectRef`. Le runner d’advisors retourne `$AvailabilityAdvisorReceipt` sous forme de hashtable avec exactement `ProjectRef`, `Environment`, `ReviewedHead`, `MigrationSha256`, `DatabaseIdentity`, `SecurityCompletedAtUtc`, `PerformanceCompletedAtUtc`, `OpenP0`, `OpenP1` et `LogUri`. `LogUri` pointe vers les logs immuables hors dépôt de cette relance; aucun ancien résultat n’est réutilisé.

```powershell
$FinalHead = Invoke-AvailabilityNative 'HEAD final Availability' { git rev-parse HEAD }
$MigrationSha256 = (Get-FileHash -LiteralPath "$AvailabilityWorktree\supabase\migrations\20260811190000_admin_availability_schedule.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
$DatabaseIdentity = (Invoke-AvailabilityNative 'identité DB receipt Availability' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -At -v ON_ERROR_STOP=1 -c "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text" }).Trim()
Assert-AvailabilityAdvisorReceipt -Receipt $AvailabilityAdvisorReceipt -ExpectedProjectRef $EphemeralProjectRef -ExpectedHead $FinalHead -ExpectedMigrationSha256 $MigrationSha256 -ExpectedDatabaseIdentity $DatabaseIdentity
Invoke-AvailabilityNative 'status final Availability' { git status --short --branch }
```

Expected: les deux advisors viennent d’être relancés sur la cible éphémère exacte; le receipt correspond au HEAD final, au SHA-256 de la migration et à l’identité DB relue, contient les deux horodatages et les logs, et déclare `OpenP0=0`, `OpenP1=0`. Sinon le handoff est bloqué.
