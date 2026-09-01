# Vistaire Admin vNext Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le dashboard restaurant Vistaire Admin vNext, premium, bilingue, mobile-first, sûr et exploitable, par vagues indépendantes intégrées uniquement après revue P0/P1 et validations vertes.

**Architecture:** Huit worktrees de réalisation ont un ownership de fichiers exclusif et avancent sur quatre vagues; un neuvième worktree d’intégration, hors décompte, ne produit aucun code et assemble seulement des branches revues. Les fondations visuelle et data précèdent quatre pages métier, puis More/Quality et enfin Final-QA; la parité de l’aperçu public reste un chantier séparé basé sur le dashboard entièrement validé.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS Modules/Tailwind existant, Supabase Postgres et `supabase-js`, Node test runner, Playwright Chromium/WebKit, npm, PowerShell et Git worktrees.

## Global Constraints

- Le milestone initial `M0` est exactement `origin/main@a8f321fdb33cbb12dda6249e37a60a679183d4ea`.
- Le checkout original sale sur `ci/production-grade-pipeline` est lecture seule pour ce chantier: aucun checkout, reset, stash, clean, commit, merge, rebase ou fichier généré n’y est autorisé.
- Ne jamais travailler directement sur `main`, `master` ou `ci/production-grade-pipeline`.
- Les huit worktrees principaux sont exactement: Foundation, Data Foundation, Today, Availability, Intelligence-AI, Reports, More-Quality et Final-QA. Le worktree Integration est hors décompte et ne consomme aucun ownership produit.
- Le worktree `feat/admin-vnext-integration` ne développe rien, ne crée ni ne modifie manuellement aucun fichier et ne résout jamais un conflit. Il fait uniquement des merges revus avec `--no-ff --no-commit`, valide l’index résultant, abandonne au premier conflit ou contrôle rouge, puis crée un commit de merge si tout est vert.
- Aucun agent n’effectue automatiquement de push, de création de PR, de passage Ready, de merge vers `main` ou de déploiement. Ces actions requièrent une instruction utilisateur distincte.
- Limite réelle de concurrence: quatre slots incluant l’orchestrateur racine; trois workers au maximum travaillent en parallèle. La Wave 2 s’exécute donc en `3 + 1`, jamais avec quatre workers simultanés.
- Aucun worktree Wave 2 n’est créé avant la matérialisation de `B1`; More-Quality n’est créé qu’après `B2`; Final-QA qu’après `B3`; Preview Parity qu’après `B4`.
- L’interface reste mobile-first et restaurant-first: valider 390 px puis 430 px avant tablette et desktop; conserver surfaces chaudes sombres, accents crème/champagne, visuels culinaires, mouvement retenu et copie française claire.
- Les routes, le menu, les pages plat et la proposition de valeur restaurant restent centrales. Aucun écran ne devient un POS, un outil de réservation ou un dashboard SaaS générique.
- Le dashboard privé accepte exclusivement un scope serveur `{ restaurantId, menuId, source: 'production', timezone }`; aucun identifiant ou dataset ne vient de l’URL, du body ou du client.
- Une valeur absente ne devient jamais `0`, estimation ou succès. Employer « observé », « événement » et « interaction »; CA, ventes, commandes, conversion commerciale et client unique non prouvé sont hors contrat.
- L’UI, les exports et l’assistant consomment un même registre de preuves; aucune raw row, aucun `session_id` et aucune erreur Supabase détaillée ne sont envoyés au client.
- Aucun changement large d’auth, analytics, SEO, AR, asset, owner ou menu public; aucun ajout de dépendance ou média lourd sans preuve, revue et accord de scope.
- Les fichiers `public/`, les sources 3D, les sorties vidéo, les dossiers ignorés d’assets et les règles Git LFS sont hors scope. `docs/repo-asset-policy.md` reste l’autorité.
- Tout comportement nouveau suit RED → GREEN → régression ciblée → commit; chaque branche finit propre avec tous ses changements commités.
- Toute migration est non-production: application uniquement sur une base Supabase locale réinitialisable ou un projet éphémère dédié. Aucune commande de liaison ou migration vers la production n’est autorisée.
- Toute capacité de retour planifié Availability expose une version de schéma, une version de RPC, un feature flag et un heartbeat worker. Une absence, une incompatibilité, un flag désactivé, un heartbeat périmé ou une erreur RPC laisse le toggle immédiat opérationnel et rend seulement la planification indisponible.
- Les tests Postgres couvrent RLS, permissions, idempotence, frontières DST, concurrence, advisory lock et résultats des advisors/lint. Aucun accès direct plus permissif n’est accepté comme fallback.
- Final-QA ne corrige aucun fichier de production. Un défaut fonctionnel ou visuel est rendu au workstream propriétaire avec preuve, sévérité, route, viewport et reproduction; l’intégration attend son correctif revu.
- Après chaque merge, exécuter les tests ciblés de la branche puis `assets:check`, `lfs:check`, `lint`, `typecheck` et `build`. Un seul échec impose `git merge --abort`.
- Avant tout rapport final, supprimer uniquement les artefacts produits par ce chantier (`.next`, `test-results`, `playwright-report`, captures, vidéos, traces et logs temporaires), vérifier l’absence de secret ou `.env`, puis exiger `git status --short` vide dans chaque worktree.
- Dans l'environnement sandbox qui signale `dubious ownership`, exécuter au début de chaque session PowerShell le bootstrap process-local défini dans le protocole ci-dessous. Il enregistre uniquement les chemins absolus exacts du dépôt et des worktrees planifiés via `GIT_CONFIG_COUNT`; aucun `safe.directory` global, persistant ou large n'est autorisé. Toutes les commandes `git -C` de ce plan supposent ce bootstrap actif dans la même session.

---

## Milestones et graphe de branches

```text
M0 = a8f321fdb33cbb12dda6249e37a60a679183d4ea
├─ feat/admin-vnext-foundation ───────────┐
└─ feat/admin-vnext-data-foundation ─────┴─ revues P0/P1 + merges séquentiels → B1
   B1 ├─ feat/admin-vnext-today ───────────────┐
      ├─ feat/admin-vnext-availability ────────┤
      ├─ feat/admin-vnext-intelligence-ai ─────┤ exécution 3 + 1
      └─ feat/admin-vnext-reports ─────────────┴─ merges séquentiels ciblés → B2
   B2 ─ feat/admin-vnext-more-quality ─────────── revue + merge → B3
   B3 ─ feat/admin-vnext-final-qa ─────────────── revue + merge → B4
   B4 ─ feat/admin-vnext-public-preview-parity ── chantier séparé, post-dashboard
```

- `B1`, `B2`, `B3` et `B4` sont des SHA immuables relevés par `git rev-parse HEAD` dans Integration après la vague correspondante. Après un correctif propriétaire découvert par Final-QA, chaque nouveau HEAD d'intégration est capturé comme un SHA immuable `B3.rN`; le SHA exact le plus récent devient `$ExpectedBase` de Final-QA sans réécrire ni réutiliser le nom d'un ancien milestone.
- L’ordre de merge est fixe: Foundation, Data Foundation, Today, Availability, Intelligence-AI, Reports, More-Quality, Final-QA.
- L’ordre des branches n’autorise pas une branche tardive à incorporer elle-même une branche sœur. Seul Integration assemble les branches.
- Preview Parity ne fait partie ni des huit worktrees principaux ni de la PR dashboard; il reçoit sa propre branche, ses propres revues et ses propres validations à partir de `B4`.

## Worktrees, branches et ownership exclusif

| Workstream | Worktree | Branche | Base | Fichiers possédés | Tests nommés | Zones interdites |
|---|---|---|---|---|---|---|
| Foundation | `.worktrees/admin-vnext-foundation` | `feat/admin-vnext-foundation` | `M0` | `proxy.ts`, `app/admin/layout.tsx`, `app/admin/loading.tsx`, `app/admin/preferences/route.ts`, `components/admin/system/AdminIcons.tsx`, `AdminNav.tsx`, `AdminShell.tsx`, `AdminPreferencesControls.tsx`, `AdminShellState.tsx`, `AdminSystem.module.css`, `lib/admin/foundationRoutes.ts`, `lib/admin/preferences.ts` | `tests/admin-foundation-routes.test.mjs`, `tests/admin-foundation-navigation.test.mjs`, `tests/admin-foundation-preferences.test.mjs`, `tests/admin-foundation-security.test.mjs`, `tests/admin-foundation-shell.test.mjs`, `e2e/admin-foundation.spec.ts` | Toutes les pages feuille, data/API métier, charts, migrations, preview public; `AdminPresentationPrimitives.tsx` est lecture seule; `e2e/admin-visual.spec.ts` ne change que pour le passage de trois à cinq liens |
| Data Foundation | `.worktrees/admin-vnext-data-foundation` | `feat/admin-vnext-data-foundation` | `M0` | `lib/admin/data/**`, `lib/analytics/client.ts`, `context.ts`, `validationCore.mjs`, `validationCore.d.mts`, `searchPrivacyCore.mjs`, `searchPrivacyCore.d.mts`, `app/api/analytics/events/route.ts` | `tests/admin-data-*.test.mjs`, `tests/types/admin-data-contracts.typecheck.ts`, `tests/public-menu-analytics-source.test.mjs` | Pages/components/styles, auth/QR, preview public, migrations, autres routes/mutations, données de production |
| Today | `.worktrees/admin-vnext-today` | `feat/admin-vnext-today` | `B1` | `app/admin/page.tsx`, `components/admin/today/**` | `tests/admin-vnext-today.test.mjs`, `e2e/admin-vnext-today.spec.ts` | Layout/shell, autres pages feuille, API, `lib/admin/data/**`, migrations, preview public |
| Availability | `.worktrees/admin-vnext-availability` | `feat/admin-vnext-availability` | `B1` | `app/admin/availability/page.tsx`, `app/admin/api/dishes/[dishId]/availability/**`, `app/api/internal/admin-availability-worker/route.ts`, `components/admin/availability/**`, `components/admin/AdminDishAvailabilityControl.tsx`, `components/admin/AdminDishWorklist.tsx`, `lib/admin/availability.ts`, `lib/admin/availability/**`, migration `20260811190000_admin_availability_schedule.sql` et tests Availability | `tests/admin-vnext-availability.test.mjs`, `tests/admin-vnext-availability-worker.test.mjs`, `tests/admin-availability.test.mjs`, `tests/admin-availability-rpc.test.mjs`, `tests/postgres/admin-availability-scheduling/**`, `e2e/admin-availability.spec.ts`, `e2e/admin-vnext-availability.spec.ts` | Système/charts, Today, Insights/AI, Reports, More, Data Foundation, `package*.json`, preview public, migration production |
| Intelligence-AI | `.worktrees/admin-vnext-intelligence-ai` | `feat/admin-vnext-intelligence-ai` | `B1` | `app/admin/insights/page.tsx`, `app/admin/api/assistant/route.ts`, `components/admin/insights/**`, `components/admin/AdminAssistant.tsx`, `lib/admin/assistant.ts`, `lib/admin/assistant/**`, `lib/admin/recommendations.ts`, ajouts admin `lib/ai/mistral.ts`, corpus/tests IA, migration `20260811200000_admin_assistant_rate_limit.sql` | `tests/admin-vnext-assistant-*.test.mjs`, `tests/admin-vnext-mistral-contract.test.mjs`, `tests/admin-assistant-isolation.test.mjs`, `tests/postgres/admin-assistant-rate-limit/**`, `e2e/admin-insights.spec.ts`, `e2e/admin-insights-fidelity.spec.ts`, `e2e/admin-vnext-assistant.spec.ts` | Système/charts, Today, Availability, Reports, More, Data Foundation, `package*.json`, preview public, migration production |
| Reports | `.worktrees/admin-vnext-reports` | `feat/admin-vnext-reports` | `B1` | `app/admin/reports/**`, `app/admin/api/reports/**`, `components/admin/reports/**`, `lib/admin/reports/**` | `tests/admin-vnext-reports*.test.mjs`, `e2e/admin-vnext-reports.spec.ts` | Système/charts, Today, Availability, Insights/AI, More, Data Foundation, migrations, `package*.json`, preview public |
| More-Quality | `.worktrees/admin-vnext-more-quality` | `feat/admin-vnext-more-quality` | `B2` | `app/admin/more/**`, `components/admin/more/**`, `lib/admin/more/**` | `tests/admin-vnext-more-quality.test.mjs`, `e2e/admin-vnext-more-quality.spec.ts` | Migrations et événements analytics bruts, autres pages, système/charts, auth/QR mutations, public, assets/3D, `package*.json`; tout défaut externe revient au propriétaire |
| Final-QA | `.worktrees/admin-vnext-final-qa` | `feat/admin-vnext-final-qa` | `B3` | `tests/admin-vnext-acceptance-matrix.test.mjs`, `tests/admin-vnext-data-honesty.test.mjs`, `tests/admin-vnext-runtime-security.test.mjs`, `e2e/admin-vnext-matrix.spec.ts`, `e2e/support/adminVisualFixtureData.ts`, `e2e/support/admin-visual-fixture-server.mjs`, `docs/validation/admin-vnext-final-qa-2026-08-11.md` | Ces tests nommés, les deux fichiers fixture test-only et toute la matrice existante | Tous les fichiers de production, `package*.json`, snapshots de référence et corrections directes |
| Integration, hors décompte | `.worktrees/admin-vnext-integration` | `feat/admin-vnext-integration` | `M0`, puis `B1…B4` | Aucun fichier possédé; uniquement index temporaire d’un merge revu | Tous les contrôles d’intégration | Création/édition manuelle, résolution de conflit, développement, push, PR, main, production |

Règles de collision:

- Foundation et Data Foundation ne se partagent aucun fichier.
- Reports consomme les projections exportées par `lib/admin/data/**`, notamment `lib/admin/data/evidenceRegistry.ts`, sans les modifier; toute évolution d’interface data revient à Data Foundation avant le merge Reports.
- Chaque workstream page possède son fichier Playwright distinct; aucune branche Wave 2 ne crée ou modifie le fichier E2E d’une sœur. More-Quality verrouille leur exécution commune par contrat sans déplacer ni réécrire leurs assertions métier.
- Un besoin hors ownership est envoyé au propriétaire avec un test rouge reproductible. Aucun worker n’élargit son diff de sa propre initiative.

## Protocole de revue et de merge obligatoire

Au début de chaque session PowerShell d'orchestration, enregistrer uniquement les chemins exacts ci-dessous dans la configuration Git du processus. Cette configuration disparaît avec la session et ne modifie aucun fichier Git global ou local:

```powershell
$Repo = 'E:\Projet perso\MenuAlive'
$SafeDirectories = @(
  $Repo,
  "$Repo\.worktrees\admin-vnext-foundation",
  "$Repo\.worktrees\admin-vnext-data-foundation",
  "$Repo\.worktrees\admin-vnext-today",
  "$Repo\.worktrees\admin-vnext-availability",
  "$Repo\.worktrees\admin-vnext-intelligence-ai",
  "$Repo\.worktrees\admin-vnext-reports",
  "$Repo\.worktrees\admin-vnext-more-quality",
  "$Repo\.worktrees\admin-vnext-final-qa",
  "$Repo\.worktrees\admin-vnext-integration",
  "$Repo\.worktrees\admin-vnext-public-preview-parity"
)
[Environment]::SetEnvironmentVariable('GIT_CONFIG_COUNT', [string]$SafeDirectories.Count, 'Process')
for ($Index = 0; $Index -lt $SafeDirectories.Count; $Index++) {
  [Environment]::SetEnvironmentVariable("GIT_CONFIG_KEY_$Index", 'safe.directory', 'Process')
  [Environment]::SetEnvironmentVariable("GIT_CONFIG_VALUE_$Index", $SafeDirectories[$Index], 'Process')
}

function Invoke-NativeGate {
  param(
    [Parameter(Mandatory)] [string] $Label,
    [Parameter(Mandatory)] [scriptblock] $Command,
    [string] $WorkingDirectory,
    [string] $Integration,
    [switch] $AbortMerge,
    [switch] $ExpectFailure,
    [int[]] $ExpectedFailureExitCodes = @(1)
  )

  $Pushed = $false
  $Failure = $null
  $ExitCode = $null
  try {
    if ($WorkingDirectory) {
      Push-Location -LiteralPath $WorkingDirectory -ErrorAction Stop
      $Pushed = $true
    }
    & $Command
    $ExitCode = $LASTEXITCODE
    if ($ExpectFailure) {
      if ($ExitCode -notin $ExpectedFailureExitCodes) {
        $Failure = if ($ExitCode -eq 0) {
          [System.InvalidOperationException]::new("$Label devait échouer en RED mais a réussi")
        } else {
          [System.InvalidOperationException]::new("$Label a retourné un code RED inattendu: $ExitCode")
        }
      }
    } elseif ($ExitCode -ne 0) {
      $Failure = [System.InvalidOperationException]::new("$Label a échoué avec le code $ExitCode")
    }
  } catch {
    $Failure = $_
  } finally {
    if ($Pushed) {
      try {
        Pop-Location -ErrorAction Stop
      } catch {
        if (-not $Failure) { $Failure = $_ }
      }
    }
  }

  if (-not $Failure) { return }

  if ($AbortMerge) {
    if (-not $Integration) {
      throw [System.InvalidOperationException]::new("Integration manquante pour abort après: $Label; cause initiale: $Failure")
    }
    & git -C $Integration merge --abort
    $AbortExitCode = $LASTEXITCODE
    if ($AbortExitCode -ne 0) {
      throw [System.InvalidOperationException]::new("$Label a échoué et merge --abort a aussi échoué ($AbortExitCode); cause initiale: $Failure")
    }
  }
  throw $Failure
}

$AdminVnextCanonicalSpecs = @(
  'e2e/admin-vnext-today.spec.ts',
  'e2e/admin-vnext-availability.spec.ts',
  'e2e/admin-insights.spec.ts',
  'e2e/admin-insights-fidelity.spec.ts',
  'e2e/admin-vnext-assistant.spec.ts',
  'e2e/admin-vnext-reports.spec.ts',
  'e2e/admin-vnext-more-quality.spec.ts'
)

$AdminVnextMatrixScenarios = @(
  'available',
  'insufficient',
  'unmeasured',
  'unavailable',
  'error',
  'truncated',
  'cross-scope'
)

function Invoke-AdminPlaywrightGate {
  param(
    [Parameter(Mandatory)] [string] $Label,
    [Parameter(Mandatory)] [string] $WorkingDirectory,
    [Parameter(Mandatory)] [string[]] $Specs,
    [Parameter(Mandatory)] [ValidateSet('pixel-reference', 'full-menu', 'available', 'insufficient', 'unmeasured', 'unavailable', 'error', 'truncated', 'cross-scope')] [string] $Scenario,
    [Parameter(Mandatory)] [ValidateSet('chromium', 'webkit')] [string[]] $Projects,
    [string] $Integration,
    [switch] $AbortMerge,
    [switch] $Build
  )

  if ($Specs.Count -eq 0) { throw "$Label exige au moins un scénario Playwright explicite" }
  $EnvironmentNames = @('VISTAIRE_ADMIN_VISUAL_FIXTURE', 'VISTAIRE_REQUIRE_ADMIN_E2E', 'VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'VISTAIRE_ADMIN_E2E_QR_TOKEN')
  $PreviousEnvironment = @{}
  foreach ($Name in $EnvironmentNames) {
    $PreviousEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
  }

  try {
    [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_VISUAL_FIXTURE', '1', 'Process')
    [Environment]::SetEnvironmentVariable('VISTAIRE_REQUIRE_ADMIN_E2E', '1', 'Process')
    [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_FIXTURE_SCENARIO', $Scenario, 'Process')
    [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_E2E_QR_TOKEN', '15000000-0000-0000-0000-000000000150', 'Process')
    $Arguments = @('scripts/run-playwright-e2e.mjs') + $Specs
    if ($Build) { $Arguments += '--build' }
    $Arguments += @($Projects | ForEach-Object { "--project=$_" })
    $Arguments += @('--workers=1', '--retries=0', '--forbid-only', '--reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts')
    Invoke-NativeGate $Label { & node @Arguments } -WorkingDirectory $WorkingDirectory -Integration $Integration -AbortMerge:$AbortMerge
  } finally {
    foreach ($Name in $EnvironmentNames) {
      [Environment]::SetEnvironmentVariable($Name, $PreviousEnvironment[$Name], 'Process')
    }
  }
}

function Invoke-AdminVnextFinalMatrixGate {
  param(
    [Parameter(Mandatory)] [string] $LabelPrefix,
    [Parameter(Mandatory)] [string] $WorkingDirectory,
    [string] $Integration,
    [switch] $AbortMerge,
    [switch] $Build
  )

  $FirstInvocation = $true
  foreach ($Scenario in $AdminVnextMatrixScenarios) {
    Invoke-AdminPlaywrightGate -Label "$LabelPrefix matrice $Scenario" -WorkingDirectory $WorkingDirectory -Specs @('e2e/admin-vnext-matrix.spec.ts') -Scenario $Scenario -Projects @('chromium', 'webkit') -Integration $Integration -AbortMerge:$AbortMerge -Build:($Build -and $FirstInvocation)
    $FirstInvocation = $false
  }
  Invoke-AdminPlaywrightGate -Label "$LabelPrefix sept specs canoniques" -WorkingDirectory $WorkingDirectory -Specs $AdminVnextCanonicalSpecs -Scenario 'available' -Projects @('chromium', 'webkit') -Integration $Integration -AbortMerge:$AbortMerge
}

function Assert-ExactWorkerBase {
  param(
    [Parameter(Mandatory)] [string] $WorkingDirectory,
    [Parameter(Mandatory)] [string] $ExpectedBase
  )

  if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ExpectedBase worker doit être un SHA complet exact' }
  $VerifiedBase = Invoke-NativeGate 'vérifier ExpectedBase worker' { git -C $WorkingDirectory rev-parse --verify "$ExpectedBase^{commit}" }
  if ($VerifiedBase -ne $ExpectedBase) { throw "ExpectedBase worker non résolu exactement: $VerifiedBase" }
  $ActualBase = Invoke-NativeGate 'merge-base worker exact' { git -C $WorkingDirectory merge-base HEAD $ExpectedBase }
  if ($ActualBase -ne $ExpectedBase) { throw "base worker inattendue: $ActualBase" }
}

function Assert-EphemeralDatabaseTarget {
  param(
    [Parameter(Mandatory)] [string] $DatabaseUrl,
    [Parameter(Mandatory)] [string] $ExpectedProjectRef,
    [Parameter(Mandatory)] [string] $ExpectedHost,
    [Parameter(Mandatory)] [string] $ProductionProjectRef
  )

  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'URL Postgres éphémère vide' }
  if ([string]::IsNullOrWhiteSpace($ExpectedProjectRef)) { throw 'project ref éphémère attendu manquant' }
  if ([string]::IsNullOrWhiteSpace($ExpectedHost)) { throw 'host Postgres éphémère attendu manquant' }
  if ([string]::IsNullOrWhiteSpace($ProductionProjectRef)) { throw 'project ref production requis pour le rejet explicite' }
  if ($ExpectedProjectRef -eq $ProductionProjectRef) { throw 'la cible éphémère est la production' }

  $DatabaseUri = [Uri]$DatabaseUrl
  if ($DatabaseUri.Scheme -notin @('postgres', 'postgresql')) { throw 'URL Postgres éphémère invalide' }
  $DatabaseUser = ($DatabaseUri.UserInfo -split ':', 2)[0]
  if ($DatabaseUri.Host -ne $ExpectedHost) { throw "host DB inattendu: $($DatabaseUri.Host)" }
  if ($DatabaseUri.Host -match [regex]::Escape($ProductionProjectRef) -or $DatabaseUser -match [regex]::Escape($ProductionProjectRef)) { throw 'host ou user DB correspond à la production' }
  $IsLocal = $DatabaseUri.Host -in @('localhost', '127.0.0.1', '::1')
  if (-not $IsLocal -and $DatabaseUri.Host -notmatch [regex]::Escape($ExpectedProjectRef) -and $DatabaseUser -notmatch [regex]::Escape($ExpectedProjectRef)) {
    throw 'le host ou user DB ne prouve pas le project ref éphémère attendu'
  }

  $Identity = Invoke-NativeGate 'identité DB éphémère' {
    psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -Atc "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text"
  }
  $Identity = ([string]$Identity).Trim()
  if (-not $Identity) { throw 'identité DB vide' }
  Write-Host "DB cible vérifiée: ref=$ExpectedProjectRef host=$ExpectedHost identity=$Identity"
  return $Identity
}

function Assert-EphemeralAdvisorReceipt {
  param(
    [Parameter(Mandatory)] [hashtable] $Receipt,
    [Parameter(Mandatory)] [string] $ExpectedProjectRef,
    [Parameter(Mandatory)] [string] $ExpectedReviewedHead,
    [Parameter(Mandatory)] [string] $ExpectedMigrationSha256,
    [Parameter(Mandatory)] [string] $ExpectedDatabaseIdentity
  )

  if ($Receipt.ProjectRef -ne $ExpectedProjectRef) { throw 'receipt advisors sur un autre projet' }
  if ($Receipt.Environment -notin @('local', 'ephemeral')) { throw 'receipt advisors ni local ni éphémère' }
  if ($Receipt.ReviewedHead -ne $ExpectedReviewedHead) { throw 'receipt advisors pour un autre HEAD' }
  if ($Receipt.MigrationSha256 -ne $ExpectedMigrationSha256) { throw 'receipt advisors pour une autre migration' }
  if (([string]$Receipt.DatabaseIdentity).Trim() -ne ([string]$ExpectedDatabaseIdentity).Trim()) { throw 'receipt advisors pour une autre identité DB' }
  if (-not $Receipt.LogUri -or -not $Receipt.SecurityCompletedAtUtc -or -not $Receipt.PerformanceCompletedAtUtc) {
    throw 'logs/advisors incomplets'
  }
  if ([int]$Receipt.OpenP0 -ne 0 -or [int]$Receipt.OpenP1 -ne 0) { throw 'advisors avec P0/P1 ouverts' }
}

function Assert-B4AdvisorReceipt {
  param(
    [Parameter(Mandatory)] [hashtable] $Receipt,
    [Parameter(Mandatory)] [string] $ExpectedProjectRef,
    [Parameter(Mandatory)] [string] $ExpectedReviewedHead,
    [Parameter(Mandatory)] [string] $ExpectedAvailabilityMigrationSha256,
    [Parameter(Mandatory)] [string] $ExpectedAssistantMigrationSha256,
    [Parameter(Mandatory)] [string] $ExpectedDatabaseIdentity,
    [Parameter(Mandatory)] [DateTimeOffset] $NotBeforeUtc
  )

  $ExpectedKeys = @('ProjectRef', 'Environment', 'ReviewedHead', 'AvailabilityMigrationSha256', 'AssistantMigrationSha256', 'DatabaseIdentity', 'SecurityCompletedAtUtc', 'PerformanceCompletedAtUtc', 'OpenP0', 'OpenP1', 'LogUri')
  $MissingKeys = @($ExpectedKeys | Where-Object { -not $Receipt.ContainsKey($_) })
  $UnexpectedKeys = @($Receipt.Keys | Where-Object { $_ -notin $ExpectedKeys })
  if ($MissingKeys.Count -ne 0 -or $UnexpectedKeys.Count -ne 0) {
    throw "schéma receipt B4 invalide; manquants=$($MissingKeys -join ','); inattendus=$($UnexpectedKeys -join ',')"
  }
  if ($Receipt.ProjectRef -ne $ExpectedProjectRef -or $Receipt.Environment -notin @('local', 'ephemeral')) { throw 'receipt B4 advisors sur une autre cible' }
  if ($Receipt.ReviewedHead -ne $ExpectedReviewedHead) { throw 'receipt B4 advisors pour un autre HEAD' }
  if ($Receipt.AvailabilityMigrationSha256 -ne $ExpectedAvailabilityMigrationSha256) { throw 'receipt B4 advisors pour une autre migration Availability' }
  if ($Receipt.AssistantMigrationSha256 -ne $ExpectedAssistantMigrationSha256) { throw 'receipt B4 advisors pour une autre migration Assistant' }
  if (([string]$Receipt.DatabaseIdentity).Trim() -ne ([string]$ExpectedDatabaseIdentity).Trim()) { throw 'receipt B4 advisors pour une autre identité DB' }
  if ([string]::IsNullOrWhiteSpace([string]$Receipt.LogUri)) { throw 'logs B4 advisors manquants' }
  [DateTimeOffset]$SecurityAt = [DateTimeOffset]::MinValue
  [DateTimeOffset]$PerformanceAt = [DateTimeOffset]::MinValue
  if (-not [DateTimeOffset]::TryParse([string]$Receipt.SecurityCompletedAtUtc, [ref]$SecurityAt)) { throw 'horodatage Security Advisors B4 invalide' }
  if (-not [DateTimeOffset]::TryParse([string]$Receipt.PerformanceCompletedAtUtc, [ref]$PerformanceAt)) { throw 'horodatage Performance Advisors B4 invalide' }
  if ($SecurityAt -lt $NotBeforeUtc -or $PerformanceAt -lt $NotBeforeUtc) { throw 'receipt advisors antérieur à la relance B4' }
  if ([int]$Receipt.OpenP0 -ne 0 -or [int]$Receipt.OpenP1 -ne 0) { throw 'advisors B4 avec P0/P1 ouverts' }
}

function Assert-Wave1ReviewReceipts {
  param(
    [Parameter(Mandatory)] [object[]] $Receipts,
    [Parameter(Mandatory)] [string] $Integration,
    [Parameter(Mandatory)] [string] $M0
  )

  $ExpectedBranches = @('feat/admin-vnext-foundation', 'feat/admin-vnext-data-foundation')
  if ($Receipts.Count -ne 2) { throw 'deux receipts Wave 1 exactement sont requis' }
  if (@($Receipts | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.ReviewerTaskId) }).Count -ne 0) { throw 'ReviewerTaskId vide ou blanc interdit' }
  if (@($Receipts.ReviewerTaskId | Sort-Object -Unique).Count -ne 2) { throw 'les deux reviews doivent être indépendantes' }
  foreach ($Branch in $ExpectedBranches) {
    $Receipt = @($Receipts | Where-Object Branch -eq $Branch)
    if ($Receipt.Count -ne 1) { throw "receipt unique manquant pour $Branch" }
    $Receipt = $Receipt[0]
    if ($Receipt.ExpectedBase -ne $M0 -or $Receipt.Decision -ne 'approved') { throw "receipt invalide pour $Branch" }
    if ([int]$Receipt.OpenP0 -ne 0 -or [int]$Receipt.OpenP1 -ne 0) { throw "P0/P1 ouverts pour $Branch" }
    if (-not $Receipt.CompletedAtUtc -or -not $Receipt.ReviewLogUri) { throw "receipt non auditable pour $Branch" }
    $CurrentHead = Invoke-NativeGate "head revu $Branch" { git -C $Integration rev-parse $Branch }
    if ($CurrentHead -ne $Receipt.ReviewedHead) { throw "la branche $Branch a changé après review" }
  }
}
```

Le protocole suivant est défini une fois dans la session Integration. `$ExpectedBase` est toujours le SHA complet transmis dans le handoff, jamais le texte `M0`, `B1`, `B2`, `B3` ou `B4`. Les maps sont normatives : elles couvrent toutes les branches sœurs créées depuis la même base et les seuls chemins possédés. Le reviewer retourne un receipt auditable; Integration appelle `Assert-ReviewedBranchReady` immédiatement avant chaque merge concret:

```powershell
$ForbiddenSiblingsByBranch = @{
  'feat/admin-vnext-foundation' = @('feat/admin-vnext-data-foundation')
  'feat/admin-vnext-data-foundation' = @('feat/admin-vnext-foundation')
  'feat/admin-vnext-today' = @('feat/admin-vnext-availability', 'feat/admin-vnext-intelligence-ai', 'feat/admin-vnext-reports')
  'feat/admin-vnext-availability' = @('feat/admin-vnext-today', 'feat/admin-vnext-intelligence-ai', 'feat/admin-vnext-reports')
  'feat/admin-vnext-intelligence-ai' = @('feat/admin-vnext-today', 'feat/admin-vnext-availability', 'feat/admin-vnext-reports')
  'feat/admin-vnext-reports' = @('feat/admin-vnext-today', 'feat/admin-vnext-availability', 'feat/admin-vnext-intelligence-ai')
  'feat/admin-vnext-more-quality' = @()
  'feat/admin-vnext-final-qa' = @()
}

$AllowedPathPatternsByBranch = @{
  'feat/admin-vnext-foundation' = @(
    '^proxy\.ts$',
    '^app/admin/(layout\.tsx|loading\.tsx|preferences/route\.ts)$',
    '^components/admin/system/(AdminIcons|AdminNav|AdminShell|AdminPreferencesControls|AdminShellState)\.tsx$',
    '^components/admin/system/AdminSystem\.module\.css$',
    '^lib/admin/(foundationRoutes|preferences)\.ts$',
    '^tests/admin-foundation-[^/]+\.test\.mjs$',
    '^e2e/admin-foundation\.spec\.ts$',
    '^e2e/admin-visual\.spec\.ts$'
  )
  'feat/admin-vnext-data-foundation' = @(
    '^lib/admin/data/',
    '^lib/analytics/(client\.ts|context\.ts|validationCore\.mjs|validationCore\.d\.mts|searchPrivacyCore\.mjs|searchPrivacyCore\.d\.mts)$',
    '^app/api/analytics/events/route\.ts$',
    '^tests/admin-data-[^/]+\.test\.mjs$',
    '^tests/types/admin-data-contracts\.typecheck\.ts$',
    '^tests/public-menu-analytics-source\.test\.mjs$'
  )
  'feat/admin-vnext-today' = @(
    '^app/admin/page\.tsx$',
    '^components/admin/today/',
    '^tests/admin-vnext-today\.test\.mjs$',
    '^e2e/admin-vnext-today\.spec\.ts$'
  )
  'feat/admin-vnext-availability' = @(
    '^app/admin/availability/page\.tsx$',
    '^app/admin/api/dishes/\[dishId\]/availability/',
    '^app/api/internal/admin-availability-worker/route\.ts$',
    '^components/admin/availability/',
    '^components/admin/AdminDish(AvailabilityControl|Worklist)\.tsx$',
    '^lib/admin/availability(\.ts|/)',
    '^supabase/migrations/20260811190000_admin_availability_schedule\.sql$',
    '^tests/admin-vnext-availability(-worker)?\.test\.mjs$',
    '^tests/admin-availability(-rpc)?\.test\.mjs$',
    '^tests/postgres/admin-availability-scheduling/',
    '^e2e/admin(-vnext)?-availability\.spec\.ts$'
  )
  'feat/admin-vnext-intelligence-ai' = @(
    '^app/admin/insights/page\.tsx$',
    '^app/admin/api/assistant/route\.ts$',
    '^components/admin/insights/',
    '^components/admin/AdminAssistant\.tsx$',
    '^lib/admin/assistant(\.ts|/)',
    '^lib/admin/recommendations\.ts$',
    '^lib/ai/mistral\.ts$',
    '^supabase/migrations/20260811200000_admin_assistant_rate_limit\.sql$',
    '^tests/fixtures/admin-assistant-evals\.json$',
    '^tests/admin-vnext-(intelligence|assistant-[^/]+|mistral-contract)\.test\.mjs$',
    '^tests/admin-assistant-isolation\.test\.mjs$',
    '^tests/postgres/admin-assistant-rate-limit/',
    '^e2e/admin-(insights|insights-fidelity|vnext-assistant)\.spec\.ts$'
  )
  'feat/admin-vnext-reports' = @(
    '^app/admin/reports/',
    '^app/admin/api/reports/',
    '^components/admin/reports/',
    '^lib/admin/reports/',
    '^tests/admin-vnext-reports(-csv)?\.test\.mjs$',
    '^e2e/admin-vnext-reports\.spec\.ts$'
  )
  'feat/admin-vnext-more-quality' = @(
    '^app/admin/more/',
    '^components/admin/more/',
    '^lib/admin/more/',
    '^tests/admin-vnext-more-quality\.test\.mjs$',
    '^e2e/admin-vnext-more-quality\.spec\.ts$'
  )
  'feat/admin-vnext-final-qa' = @(
    '^tests/admin-vnext-acceptance-matrix\.test\.mjs$',
    '^tests/admin-vnext-data-honesty\.test\.mjs$',
    '^tests/admin-vnext-runtime-security\.test\.mjs$',
    '^e2e/admin-vnext-matrix\.spec\.ts$',
    '^e2e/support/adminVisualFixtureData\.ts$',
    '^e2e/support/admin-visual-fixture-server\.mjs$',
    '^docs/validation/admin-vnext-final-qa-2026-08-11\.md$'
  )
}

function Assert-ReviewedBranchReady {
  param(
    [Parameter(Mandatory)] [string] $Integration,
    [Parameter(Mandatory)] [string] $Worker,
    [Parameter(Mandatory)] [string] $Branch,
    [Parameter(Mandatory)] [string] $ExpectedBase,
    [Parameter(Mandatory)] [string[]] $AllowedPathPatterns,
    [Parameter(Mandatory)] [AllowEmptyCollection()] [string[]] $ForbiddenSiblingBranches,
    [Parameter(Mandatory)] [object] $ReviewReceipt
  )

  if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ExpectedBase doit être un SHA complet' }
  $VerifiedBase = Invoke-NativeGate "vérifier base $Branch" { git -C $Integration rev-parse --verify "$ExpectedBase^{commit}" }
  if ($VerifiedBase -ne $ExpectedBase) { throw "ExpectedBase non résolu exactement pour $Branch" }
  $WorkerBranch = Invoke-NativeGate "branche worker $Branch" { git -C $Worker branch --show-current }
  if ($WorkerBranch -ne $Branch) { throw "worktree $Worker sur $WorkerBranch au lieu de $Branch" }
  $Dirty = Invoke-NativeGate "status porcelain $Branch" { git -C $Worker status --porcelain }
  if ($Dirty) { throw "worktree worker sale pour ${Branch}:`n$Dirty" }
  $ActualBase = Invoke-NativeGate "merge-base $Branch" { git -C $Integration merge-base $ExpectedBase $Branch }
  if ($ActualBase -ne $ExpectedBase) { throw "merge-base inattendue pour ${Branch}: $ActualBase" }
  $MergeCommits = @(Invoke-NativeGate "recherche de merges étrangers $Branch" { git -C $Integration rev-list --merges "$ExpectedBase..$Branch" })
  if ($MergeCommits.Count -ne 0) { throw "merge commit incorporé dans ${Branch}: $($MergeCommits -join ', ')" }
  $BranchCommits = @(Invoke-NativeGate "commits candidat $Branch" { git -C $Integration rev-list "$ExpectedBase..$Branch" })
  if ($BranchCommits.Count -eq 0) { throw "aucun commit candidat dans $Branch" }
  foreach ($Sibling in $ForbiddenSiblingBranches) {
    $SiblingCommits = @(Invoke-NativeGate "commits sœur interdite $Sibling" { git -C $Integration rev-list "$ExpectedBase..$Sibling" })
    $SharedForeignCommits = @($BranchCommits | Where-Object { $_ -in $SiblingCommits })
    if ($SharedForeignCommits.Count -ne 0) { throw "commits de la branche sœur $Sibling incorporés dans ${Branch}: $($SharedForeignCommits -join ', ')" }
  }
  $ChangedPaths = @(Invoke-NativeGate "liste des fichiers changés $Branch" { git -C $Integration diff --name-only "$ExpectedBase...$Branch" })
  $UnexpectedPaths = @($ChangedPaths | Where-Object {
    $Path = $_
    -not ($AllowedPathPatterns | Where-Object { $Path -match $_ })
  })
  if ($UnexpectedPaths.Count -ne 0) { throw "fichiers hors ownership dans ${Branch}: $($UnexpectedPaths -join ', ')" }
  Invoke-NativeGate "diff name-status $Branch" { git -C $Integration diff --name-status "$ExpectedBase...$Branch" }
  Invoke-NativeGate "diff stat $Branch" { git -C $Integration diff --stat "$ExpectedBase...$Branch" }
  Invoke-NativeGate "diff check $Branch" { git -C $Integration diff --check "$ExpectedBase...$Branch" }

  if ($ReviewReceipt.Branch -ne $Branch -or $ReviewReceipt.ExpectedBase -ne $ExpectedBase -or $ReviewReceipt.Decision -ne 'approved') { throw "receipt de review invalide pour $Branch" }
  if ([string]::IsNullOrWhiteSpace([string]$ReviewReceipt.ReviewerTaskId) -or [string]::IsNullOrWhiteSpace([string]$ReviewReceipt.CompletedAtUtc) -or [string]::IsNullOrWhiteSpace([string]$ReviewReceipt.ReviewLogUri)) { throw "receipt non auditable pour $Branch" }
  if ([int]$ReviewReceipt.OpenP0 -ne 0 -or [int]$ReviewReceipt.OpenP1 -ne 0) { throw "P0/P1 ouverts pour $Branch" }
  $CurrentHead = Invoke-NativeGate "HEAD revu $Branch" { git -C $Integration rev-parse $Branch }
  if ($ReviewReceipt.ReviewedHead -ne $CurrentHead) { throw "$Branch a changé après review" }
}
```

La revue humaine inspecte ensuite le diff complet et produit une liste classée:

- `P0`: sécurité, perte/corruption de données, fuite inter-restaurant, migration destructive, route cassée ou build impossible;
- `P1`: fonctionnalité requise absente, fallback mensonger, accessibilité bloquante, overflow mobile, mauvaise identité menu/restaurant, test critique manquant ou régression visible;
- `P2/P3`: non bloquant, documenté séparément et jamais corrigé opportunément dans Integration.

Le merge est interdit tant qu’un P0/P1 reste ouvert. Après approbation:

```powershell
Invoke-NativeGate 'status Integration avant merge' { git -C $Integration status --short --branch }
Invoke-NativeGate "merge $Branch" { git -C $Integration merge --no-ff --no-commit $Branch } -Integration $Integration -AbortMerge
```

Lancer ensuite les tests ciblés du workstream et le socle commun avant le commit de merge:

```powershell
Invoke-NativeGate 'assets:check' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs:check' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
```

Ces commandes s’exécutent avec `workdir` égal à `$Integration`; `git merge --abort` s’exécute dans le même worktree. Si tout est vert, instancier le libellé et le message du workstream courant. Ce bloc est un gabarit, jamais une commande supplémentaire à rejouer après une séquence concrète:

```powershell
$MergeLabel = '<workstream revu>'
$MergeCommitMessage = '<message de merge du workstream revu>'
Invoke-NativeGate "commit merge $MergeLabel" { git -C $Integration commit -m $MergeCommitMessage } -Integration $Integration -AbortMerge
$IntegratedHead = Invoke-NativeGate 'capture IntegratedHead' { git -C $Integration rev-parse HEAD }
Invoke-NativeGate 'status Integration après merge' { git -C $Integration status --short --branch }
```

Un merge rouge ou conflictuel est abandonné, jamais réparé dans Integration. Le worker concerné repart de sa branche, ajoute un test de régression, corrige, commit, repasse la revue merge-base/diff/diff-check/clean/P0-P1, puis seulement est reproposé.

## Task 1: Verrouiller M0 et créer uniquement la Wave 1

**Owner:** orchestrateur racine.

**Produces:** Foundation et Integration déjà présents et vérifiés; Data Foundation créé depuis `M0`; aucun worktree ultérieur.

- [ ] **Step 1: Vérifier les deux worktrees déjà provisionnés**

```powershell
$Repo = 'E:\Projet perso\MenuAlive'
$M0 = 'a8f321fdb33cbb12dda6249e37a60a679183d4ea'
$Foundation = "$Repo\.worktrees\admin-vnext-foundation"
$Integration = "$Repo\.worktrees\admin-vnext-integration"
Invoke-NativeGate 'status Foundation initial' { git -C $Foundation status --short --branch }
Invoke-NativeGate 'status Integration initial' { git -C $Integration status --short --branch }
$FoundationHead = Invoke-NativeGate 'HEAD Foundation initial' { git -C $Foundation rev-parse HEAD }
$IntegrationHead = Invoke-NativeGate 'HEAD Integration initial' { git -C $Integration rev-parse HEAD }
if ($FoundationHead -ne $M0) { throw 'Foundation ne pointe pas sur M0' }
if ($IntegrationHead -ne $M0) { throw 'Integration ne pointe pas sur M0' }
```

- [ ] **Step 2: Créer Data Foundation, et seulement Data Foundation**

```powershell
$Repo = 'E:\Projet perso\MenuAlive'
$M0 = 'a8f321fdb33cbb12dda6249e37a60a679183d4ea'
$DataFoundation = "$Repo\.worktrees\admin-vnext-data-foundation"
$ExistingBranch = Invoke-NativeGate 'chercher branche Data Foundation' { git -C $Repo branch --list feat/admin-vnext-data-foundation }
if ($ExistingBranch) { throw 'branche Data Foundation déjà présente; arrêter et auditer avant création' }
Invoke-NativeGate 'créer worktree Data Foundation' { git -C $Repo worktree add -b feat/admin-vnext-data-foundation $DataFoundation $M0 }
$DataBase = Invoke-NativeGate 'merge-base Data Foundation' { git -C $DataFoundation merge-base HEAD $M0 }
if ($DataBase -ne $M0) { throw 'Data Foundation ne pointe pas exactement sur M0' }
Invoke-NativeGate 'status Data Foundation initial' { git -C $DataFoundation status --short --branch }
```

Expected: le merge-base affiché est `a8f321fdb33cbb12dda6249e37a60a679183d4ea`; aucun dossier Today, Availability, Intelligence-AI, Reports, More-Quality ou Final-QA n’existe.

- [ ] **Step 3: Établir le baseline commun dans chaque worker sans modifier de fichier**

```powershell
$Workers = @(
  'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-foundation',
  'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-data-foundation'
)
foreach ($Worker in $Workers) {
  Invoke-NativeGate "npm ci $Worker" { npm ci } -WorkingDirectory $Worker
  Invoke-NativeGate "assets:check $Worker" { npm run assets:check } -WorkingDirectory $Worker
  Invoke-NativeGate "lfs:check $Worker" { npm run lfs:check } -WorkingDirectory $Worker
  Invoke-NativeGate "lint $Worker" { npm run lint } -WorkingDirectory $Worker
  Invoke-NativeGate "typecheck $Worker" { npm run typecheck } -WorkingDirectory $Worker
  Invoke-NativeGate "build $Worker" { npm run build } -WorkingDirectory $Worker
  Invoke-NativeGate "test:admin $Worker" { npm run test:admin } -WorkingDirectory $Worker
}
```

Run dans Foundation puis Data Foundation. Enregistrer SHA, versions et résultats dans le rapport de handoff de l’agent, pas dans Integration.

- [ ] **Step 4: Préparer le worktree Integration pour les gates, sans source edit**

Dans `.worktrees/admin-vnext-integration`, exécuter chaque commande avec un workdir explicite et un contrôle natif immédiat:

```powershell
Invoke-NativeGate 'npm ci Integration' { npm ci } -WorkingDirectory $Integration
Invoke-NativeGate 'assets Integration baseline' { npm run assets:check } -WorkingDirectory $Integration
Invoke-NativeGate 'lfs Integration baseline' { npm run lfs:check } -WorkingDirectory $Integration
Invoke-NativeGate 'lint Integration baseline' { npm run lint } -WorkingDirectory $Integration
Invoke-NativeGate 'typecheck Integration baseline' { npm run typecheck } -WorkingDirectory $Integration
Invoke-NativeGate 'build Integration baseline' { npm run build } -WorkingDirectory $Integration
Invoke-NativeGate 'test:admin Integration baseline' { npm run test:admin } -WorkingDirectory $Integration
$IntegrationDirty = Invoke-NativeGate 'status Integration baseline' { git -C $Integration status --porcelain }
if ($IntegrationDirty) { throw "Integration sale après baseline:`n$IntegrationDirty" }
```

`node_modules` et `.next` restent ignorés. Cette installation est requise avant le premier merge revu afin que les commandes d'intégration ne dépendent pas du `node_modules` d'un autre worktree.

## Task 2: Réaliser Foundation

**Owner:** Foundation.

**Consumes:** routes admin et contrats existants à `M0`.

**Produces:** shell vNext partagé, navigation responsive, tokens, état de focus et préférences serveur light/dark et FR/EN, sans contenu de page métier.

- [ ] **Step 1: Écrire les cinq contrats `tests/admin-foundation-*.test.mjs` en RED**

Les assertions exigent: `ADMIN_ROUTES` avec les IDs stables `today|availability|intelligence|reports|more`; état actif déterministe; libellés FR/EN; thème light/dark sans flash; skip link; landmark principal; cibles de 44 px; bottom nav avec safe area; absence d’overflow structurel à 390/430; aucune importation data/API. `tests/admin-foundation-preferences.test.mjs` exige les cookies `vistaire-admin-locale=fr|en` et `vistaire-admin-theme=light|dark`, `Path=/admin`, `SameSite=Lax` et validation serveur. `tests/admin-foundation-security.test.mjs` exige suppression des headers clients forgés et isolation des routes publiques.

Run:

```powershell
$Foundation = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-foundation'
Invoke-NativeGate 'RED Foundation' { node --test tests/admin-foundation-routes.test.mjs tests/admin-foundation-navigation.test.mjs tests/admin-foundation-preferences.test.mjs tests/admin-foundation-security.test.mjs tests/admin-foundation-shell.test.mjs } -WorkingDirectory $Foundation -ExpectFailure
```

Expected: échec car les primitives vNext n’existent pas encore.

- [ ] **Step 2: Implémenter uniquement les fichiers Foundation possédés**

Préserver l’auth existante, les métadonnées `noindex`, les styles premium restaurant et les enfants Server Components. `proxy.ts`, `app/admin/layout.tsx` et `app/admin/preferences/route.ts` valident les deux cookies et isolent les préférences à `/admin`; elles n’altèrent jamais `/en` ni le menu public. `AdminPresentationPrimitives.tsx`, déjà partagé avec la preview publique, reste strictement en lecture seule.

- [ ] **Step 3: Passer les contrôles ciblés**

```powershell
$Foundation = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-foundation'
Invoke-NativeGate 'tests Foundation' { node --test tests/admin-foundation-routes.test.mjs tests/admin-foundation-navigation.test.mjs tests/admin-foundation-preferences.test.mjs tests/admin-foundation-security.test.mjs tests/admin-foundation-shell.test.mjs tests/admin-dashboard-ui.test.mjs tests/admin-dashboard-readiness.test.mjs tests/restaurateur-preview-security.test.mjs } -WorkingDirectory $Foundation
Invoke-NativeGate 'lint Foundation' { npm run lint } -WorkingDirectory $Foundation
Invoke-NativeGate 'typecheck Foundation' { npm run typecheck } -WorkingDirectory $Foundation
Invoke-NativeGate 'build Foundation' { npm run build } -WorkingDirectory $Foundation
```

- [ ] **Step 4: Commit Foundation**

```powershell
$Foundation = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-foundation'
Invoke-NativeGate 'stage Foundation' { git add proxy.ts app/admin/layout.tsx app/admin/loading.tsx app/admin/preferences/route.ts components/admin/system/AdminIcons.tsx components/admin/system/AdminNav.tsx components/admin/system/AdminShell.tsx components/admin/system/AdminPreferencesControls.tsx components/admin/system/AdminShellState.tsx components/admin/system/AdminSystem.module.css lib/admin/foundationRoutes.ts lib/admin/preferences.ts tests/admin-foundation-routes.test.mjs tests/admin-foundation-navigation.test.mjs tests/admin-foundation-preferences.test.mjs tests/admin-foundation-security.test.mjs tests/admin-foundation-shell.test.mjs e2e/admin-foundation.spec.ts e2e/admin-visual.spec.ts } -WorkingDirectory $Foundation
Invoke-NativeGate 'commit Foundation' { git commit -m "feat(admin): establish vnext presentation foundation" } -WorkingDirectory $Foundation
Invoke-NativeGate 'status Foundation' { git status --short --branch } -WorkingDirectory $Foundation
```

## Task 3: Réaliser Data Foundation

**Owner:** Data Foundation.

**Consumes:** modèle restaurant/menu/analytics existant à `M0`.

**Produces:** un scope production obligatoire, des fenêtres locales correctes, un repository borné, un registre de preuves unique et des projections identiques pour UI/export/Mistral, sans migration ni donnée brute côté client.

- [ ] **Step 1: Écrire les contrats Node en RED**

Créer exactement:

- `tests/admin-data-contracts.test.mjs` et `tests/types/admin-data-contracts.typecheck.ts` pour `ProductionAdminMetricScope` et états `available|insufficient|unmeasured|unavailable|error|truncated`;
- `tests/admin-data-time.test.mjs` pour horloge figée, plages `today|7d|30d` et Toronto aux transitions 2026-03-08/2026-11-01;
- `tests/admin-data-instrumentation.test.mjs`, `tests/admin-data-ingestion-validation.test.mjs`, `tests/admin-data-metric-definitions.test.mjs` et `tests/admin-data-aggregate.test.mjs` pour couverture prouvée, version non surchargeable, dish/category scoped, métriques autorisées et troncature;
- `tests/admin-data-repository.test.mjs` et `tests/admin-data-loader.test.mjs` pour scope obligatoire, borne `observedAt`, postconditions cross-scope, échecs indépendants et absence de raw rows/`session_id` côté client;
- `tests/admin-data-evidence-registry.test.mjs` pour IDs déterministes, valeur identique entre projections `ui|export|mistral`, audience allowlistée et rejet cross-bundle;
- `tests/admin-data-search-privacy.test.mjs` pour NFKC, contrôles/bidi, limite 80 caractères, rejet PII et k-anonymat séparé courant/précédent.

```powershell
$DataFoundation = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-data-foundation'
Invoke-NativeGate 'RED Data Foundation' { node --test tests/admin-data-contracts.test.mjs tests/admin-data-time.test.mjs tests/admin-data-instrumentation.test.mjs tests/admin-data-ingestion-validation.test.mjs tests/admin-data-search-privacy.test.mjs tests/admin-data-metric-definitions.test.mjs tests/admin-data-aggregate.test.mjs tests/admin-data-evidence-registry.test.mjs tests/admin-data-repository.test.mjs tests/admin-data-loader.test.mjs } -WorkingDirectory $DataFoundation -ExpectFailure
```

Expected: échec car les modules data/evidence/privacy vNext n’existent pas.

- [ ] **Step 2: Implémenter les seams purs et le repository borné**

Définir `resolveAdminObservationWindow({ range, observedAt, timezone })` et `loadAdminDataBundleWithDependencies({ access, range }, dependencies)`. Le loader lit lui-même `menus.settings_json` depuis l'accès accordé avant de construire le `ProductionAdminMetricScope`; aucune timezone caller n'est acceptée. Le repository utilise une allowlist de tables/colonnes, lit `maxRows + 1`, vérifie chaque ligne et réduit les métadonnées avant agrégation. UTC est une provenance fallback visible et rend les métriques de calendrier local `unavailable/timezone-unconfigured`.

- [ ] **Step 3: Construire le registre de preuves et les projections**

Chaque métrique non mesurée reste `unmeasured`; aucune valeur absente ne devient zéro. Le même `AdminEvidenceRecord` alimente UI, export et assistant selon son audience. Les métriques de CA, ventes, commandes et conversion commerciale sont absentes du type. Le registre d’instrumentation prouve la couverture avant tout zéro; sinon le signal reste non mesuré.

- [ ] **Step 4: Passer les contrôles ciblés et commit**

```powershell
$DataFoundation = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-data-foundation'
Invoke-NativeGate 'tests Data Foundation worker' { node --test tests/admin-data-contracts.test.mjs tests/admin-data-time.test.mjs tests/admin-data-instrumentation.test.mjs tests/admin-data-ingestion-validation.test.mjs tests/admin-data-search-privacy.test.mjs tests/admin-data-metric-definitions.test.mjs tests/admin-data-aggregate.test.mjs tests/admin-data-evidence-registry.test.mjs tests/admin-data-repository.test.mjs tests/admin-data-loader.test.mjs tests/public-menu-analytics-source.test.mjs tests/admin-analytics-menu-identity.test.mjs tests/admin-analytics-isolation.test.mjs tests/admin-analytics-correctness.test.mjs } -WorkingDirectory $DataFoundation
Invoke-NativeGate 'lint Data Foundation worker' { npm run lint } -WorkingDirectory $DataFoundation
Invoke-NativeGate 'typecheck Data Foundation worker' { npm run typecheck } -WorkingDirectory $DataFoundation
Invoke-NativeGate 'stage Data Foundation' { git add lib/admin/data lib/analytics/client.ts lib/analytics/context.ts lib/analytics/validationCore.mjs lib/analytics/validationCore.d.mts lib/analytics/searchPrivacyCore.mjs lib/analytics/searchPrivacyCore.d.mts app/api/analytics/events/route.ts tests/admin-data-contracts.test.mjs tests/admin-data-time.test.mjs tests/admin-data-instrumentation.test.mjs tests/admin-data-ingestion-validation.test.mjs tests/admin-data-search-privacy.test.mjs tests/admin-data-metric-definitions.test.mjs tests/admin-data-aggregate.test.mjs tests/admin-data-evidence-registry.test.mjs tests/admin-data-repository.test.mjs tests/admin-data-loader.test.mjs tests/public-menu-analytics-source.test.mjs tests/types/admin-data-contracts.typecheck.ts } -WorkingDirectory $DataFoundation
Invoke-NativeGate 'commit Data Foundation' { git commit -m "feat(admin): establish scoped vnext evidence foundation" } -WorkingDirectory $DataFoundation
Invoke-NativeGate 'status Data Foundation' { git status --short --branch } -WorkingDirectory $DataFoundation
```

## Task 4: Revoir et intégrer Wave 1 vers B1

**Owner:** Integration, après deux revues indépendantes.

La revue Wave 1 bloque `B1` si elle trouve: scope optionnel; plage UTC présentée comme locale; valeur absente transformée en zéro; recherche courante ou précédente sous k=3; métrique commerciale interdite; raw row/`session_id` côté client; projection Mistral hors preuve; modification non additive de `AdminPresentationPrimitives.tsx`; cookie admin débordant sur le public; ou fichier transversal possédé par les deux fondations.

- [ ] **Step 1: Valider les deux receipts avant tout merge, puis intégrer Foundation**

Les reviewers ont d'abord exécuté le protocole mécanique complet avec `ExpectedBase=M0` et la table normative des branches sœurs. Ils retournent `$FoundationReviewReceipt` et `$DataFoundationReviewReceipt`, chacun avec `ReviewerTaskId`, `Branch`, `ReviewedHead`, `ExpectedBase`, `Decision`, `OpenP0`, `OpenP1`, `CompletedAtUtc` et `ReviewLogUri`. Les deux receipts sont contrôlés ensemble avant le premier merge. Puis seulement exécuter cette séquence concrète:

```powershell
$Wave1ReviewReceipts = @($FoundationReviewReceipt, $DataFoundationReviewReceipt)
$M0 = 'a8f321fdb33cbb12dda6249e37a60a679183d4ea'
Assert-Wave1ReviewReceipts -Receipts $Wave1ReviewReceipts -Integration $Integration -M0 $M0
$IntegrationDirty = Invoke-NativeGate 'status Integration avant Foundation' { git -C $Integration status --porcelain }
if ($IntegrationDirty) { throw "Integration sale avant Foundation:`n$IntegrationDirty" }
Invoke-NativeGate 'merge Foundation' { git -C $Integration merge --no-ff --no-commit feat/admin-vnext-foundation } -Integration $Integration -AbortMerge
Invoke-NativeGate 'tests Foundation intégrée' { node --test tests/admin-foundation-routes.test.mjs tests/admin-foundation-navigation.test.mjs tests/admin-foundation-preferences.test.mjs tests/admin-foundation-security.test.mjs tests/admin-foundation-shell.test.mjs tests/admin-dashboard-ui.test.mjs tests/admin-dashboard-readiness.test.mjs tests/restaurateur-preview-security.test.mjs } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'assets Foundation intégrée' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs Foundation intégrée' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint Foundation intégrée' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck Foundation intégrée' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build Foundation intégrée' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-AdminPlaywrightGate -Label 'E2E Foundation intégrée' -WorkingDirectory $Integration -Specs @('e2e/admin-foundation.spec.ts', 'e2e/admin-visual.spec.ts') -Scenario 'pixel-reference' -Projects @('chromium') -Build -Integration $Integration -AbortMerge
Invoke-NativeGate 'commit merge Foundation' { git -C $Integration commit -m "merge: integrate admin vnext foundation" } -Integration $Integration -AbortMerge
Invoke-NativeGate 'status Integration après Foundation' { git -C $Integration status --short --branch }
```

- [ ] **Step 2: Appliquer le protocole complet à Data Foundation**

Revérifier les receipts et l'état propre, puis exécuter la seconde séquence concrète. Aucun bloc générique n'est rejoué en plus:

```powershell
Assert-Wave1ReviewReceipts -Receipts $Wave1ReviewReceipts -Integration $Integration -M0 $M0
$IntegrationDirty = Invoke-NativeGate 'status Integration avant Data Foundation' { git -C $Integration status --porcelain }
if ($IntegrationDirty) { throw "Integration sale avant Data Foundation:`n$IntegrationDirty" }
Invoke-NativeGate 'merge Data Foundation' { git -C $Integration merge --no-ff --no-commit feat/admin-vnext-data-foundation } -Integration $Integration -AbortMerge
Invoke-NativeGate 'tests Data Foundation' { node --test tests/admin-data-contracts.test.mjs tests/admin-data-time.test.mjs tests/admin-data-instrumentation.test.mjs tests/admin-data-ingestion-validation.test.mjs tests/admin-data-search-privacy.test.mjs tests/admin-data-metric-definitions.test.mjs tests/admin-data-aggregate.test.mjs tests/admin-data-evidence-registry.test.mjs tests/admin-data-repository.test.mjs tests/admin-data-loader.test.mjs tests/public-menu-analytics-source.test.mjs tests/admin-analytics-menu-identity.test.mjs tests/admin-analytics-isolation.test.mjs tests/admin-analytics-correctness.test.mjs } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'assets:check Data Foundation' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs:check Data Foundation' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint Data Foundation' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck Data Foundation' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build Data Foundation' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'commit merge Data Foundation' { git -C $Integration commit -m "merge: integrate admin vnext data foundation" } -Integration $Integration -AbortMerge
Invoke-NativeGate 'status Integration après Data Foundation' { git -C $Integration status --short --branch }
```

Chaque commande native passe par `Invoke-NativeGate`; au moindre rouge, le merge est aborté avant toute autre action.

- [ ] **Step 3: Revérifier les deux receipts après les merges et avant B1**

Les deux receipts restent dans les handoffs immuables des tâches de review, hors du dépôt. Leurs `ReviewerTaskId` sont distincts, leurs SHA correspondent encore aux tips des branches et aucun P0/P1 n'est ouvert:

```powershell
$Wave1ReviewReceipts = @($FoundationReviewReceipt, $DataFoundationReviewReceipt)
Assert-Wave1ReviewReceipts -Receipts $Wave1ReviewReceipts -Integration $Integration -M0 'a8f321fdb33cbb12dda6249e37a60a679183d4ea'
```

- [ ] **Step 4: Capturer B1**

```powershell
$B1 = Invoke-NativeGate 'capture B1' { git -C $Integration rev-parse HEAD }
Invoke-NativeGate 'status B1' { git -C $Integration status --short --branch }
Invoke-NativeGate 'log B1' { git -C $Integration log --oneline --decorate -4 }
```

Expected: status propre, deux commits de merge, `B1` transmis textuellement aux quatre workers Wave 2.

## Task 5: Créer Wave 2 à partir de B1 et l’exécuter en 3 + 1

**Owner:** orchestrateur racine.

- [ ] **Step 1: Créer les quatre worktrees seulement après B1**

```powershell
$Repo = 'E:\Projet perso\MenuAlive'
$Integration = "$Repo\.worktrees\admin-vnext-integration"
Assert-Wave1ReviewReceipts -Receipts $Wave1ReviewReceipts -Integration $Integration -M0 'a8f321fdb33cbb12dda6249e37a60a679183d4ea'
$B1 = Invoke-NativeGate 'relire B1 avant Wave 2' { git -C $Integration rev-parse HEAD }
Invoke-NativeGate 'create Today worktree' { git -C $Repo worktree add -b feat/admin-vnext-today "$Repo\.worktrees\admin-vnext-today" $B1 }
Invoke-NativeGate 'create Availability worktree' { git -C $Repo worktree add -b feat/admin-vnext-availability "$Repo\.worktrees\admin-vnext-availability" $B1 }
Invoke-NativeGate 'create Intelligence worktree' { git -C $Repo worktree add -b feat/admin-vnext-intelligence-ai "$Repo\.worktrees\admin-vnext-intelligence-ai" $B1 }
Invoke-NativeGate 'create Reports worktree' { git -C $Repo worktree add -b feat/admin-vnext-reports "$Repo\.worktrees\admin-vnext-reports" $B1 }
```

- [ ] **Step 2: Vérifier la base exacte de chaque branche**

```powershell
$Names = @('today','availability','intelligence-ai','reports')
foreach ($Name in $Names) {
  $Path = "E:\Projet perso\MenuAlive\.worktrees\admin-vnext-$Name"
  $Base = Invoke-NativeGate "merge-base $Name" { git -C $Path merge-base HEAD $B1 }
  if ($Base -ne $B1) { throw "$Name n'est pas basé sur B1" }
  Invoke-NativeGate "status $Name" { git -C $Path status --short --branch }
}
```

- [ ] **Step 3: Respecter les quatre slots**

L’orchestrateur racine conserve un slot. Démarrer trois workers: Today, Availability, Intelligence-AI. Dès qu’un worker est terminé, revu et libère son slot, démarrer Reports. Ne jamais lancer un quatrième worker enfant simultanément.

## Task 6: Réaliser Today

**Owner:** Today.

- [ ] **Step 1: Écrire RED dans `tests/admin-vnext-today.test.mjs` et le scénario Playwright `today`**

Exiger identité restaurant, service du jour selon timezone/fallback explicite, KPIs sourcés, tendances non trompeuses, disponibilité visible, plats vedettes, états loading/empty/error, FR/EN, light/dark, clavier et absence d’overflow à 390/430.

```powershell
$Today = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-today'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
Assert-ExactWorkerBase -WorkingDirectory $Today -ExpectedBase $ExpectedBase
Invoke-NativeGate 'RED Today' { node --test tests/admin-vnext-today.test.mjs } -WorkingDirectory $Today -ExpectFailure
```

- [ ] **Step 2: Implémenter `app/admin/page.tsx` et `components/admin/today/**` uniquement**

Consommer le read model vNext sans le modifier. La page conserve `requireAdminRestaurantAccess`, le fallback data et une erreur fail-closed; aucune donnée de démonstration n’entre dans le runtime privé.

- [ ] **Step 3: Valider et commit**

```powershell
$Today = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-today'
Invoke-NativeGate 'tests Today worker' { node --test tests/admin-vnext-today.test.mjs tests/admin-dashboard-contract.test.mjs tests/admin-dashboard-range.test.mjs tests/admin-dashboard-readiness.test.mjs } -WorkingDirectory $Today
Invoke-AdminPlaywrightGate -Label 'e2e Today worker' -WorkingDirectory $Today -Specs @('e2e/admin-vnext-today.spec.ts') -Scenario 'full-menu' -Projects @('chromium') -Build
Invoke-NativeGate 'lint Today worker' { npm run lint } -WorkingDirectory $Today
Invoke-NativeGate 'typecheck Today worker' { npm run typecheck } -WorkingDirectory $Today
Invoke-NativeGate 'build Today worker' { npm run build } -WorkingDirectory $Today
Invoke-NativeGate 'stage Today' { git add app/admin/page.tsx components/admin/today tests/admin-vnext-today.test.mjs e2e/admin-vnext-today.spec.ts } -WorkingDirectory $Today
Invoke-NativeGate 'commit Today' { git commit -m "feat(admin): build the vnext today experience" } -WorkingDirectory $Today
Invoke-NativeGate 'status Today' { git status --short --branch } -WorkingDirectory $Today
```

## Task 7: Réaliser Availability

**Owner:** Availability.

- [ ] **Step 1: Écrire RED dans `tests/admin-vnext-availability.test.mjs` et le scénario `availability`**

Exiger recherche, filtres, états, image fiable, nom accessible, cible 44 px, mutation atomique restaurant-scoped, état pending sans annoncer le succès avant la réponse serveur, rollback visuel sur erreur, garde de réponse obsolète, focus préservé, annonce live et cohérence après refresh. Tester double clic, requêtes inversées, révocation QR concurrente et refus cross-restaurant. `tests/admin-vnext-availability.test.mjs` distingue schéma absent, RPC incompatible, permission refusée, flag coupé, `last_success_at` absent/périmé/invalide/futur et worker réellement actif; `tests/admin-vnext-availability-worker.test.mjs` prouve claim/exécution idempotents et qu'un attempt suivi d'un échec n'avance pas `last_success_at`.

- [ ] **Step 2: Implémenter dans l’ownership Availability**

Conserver l’unique mutation existante de disponibilité et son RPC atomique; aucun fallback direct-update. Le composant ne modifie que le plat autorisé et réconcilie la réponse serveur avant refresh. Le retour planifié est une capacité séparée: `schema_version = 1`, `rpc_version = 'admin_vnext_availability_schedule_v1'`, `feature_enabled boolean` et `last_success_at timestamptz` récent, valide et non futur. Seul un succès transactionnel du RPC avance ce dernier champ. Sans ces quatre preuves, le toggle immédiat reste actif et la planification affiche un état indisponible; aucun timer client ni enregistrement local ne simule l’exécution.

- [ ] **Step 3: Tester la migration Availability sur Postgres isolé**

La migration `20260811190000_admin_availability_schedule.sql` est additive, sans seed ni mutation de données existantes. Le SQL applique RLS, retire l’exécution à `public`, `anon` et `authenticated`, accorde seulement `service_role`, fixe `search_path=''`, utilise `FOR UPDATE SKIP LOCKED` et un advisory lock worker et garantit l’idempotence du claim/exécution.

```powershell
$Availability = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-availability'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
Assert-ExactWorkerBase -WorkingDirectory $Availability -ExpectedBase $ExpectedBase
$DatabaseUrl = $env:ADMIN_VNEXT_EPHEMERAL_DATABASE_URL
$ExpectedProjectRef = $env:ADMIN_VNEXT_EPHEMERAL_PROJECT_REF
$ExpectedHost = $env:ADMIN_VNEXT_EXPECTED_DB_HOST
$ProductionProjectRef = $env:ADMIN_VNEXT_PRODUCTION_PROJECT_REF
$DatabaseIdentity = Assert-EphemeralDatabaseTarget -DatabaseUrl $DatabaseUrl -ExpectedProjectRef $ExpectedProjectRef -ExpectedHost $ExpectedHost -ProductionProjectRef $ProductionProjectRef
Invoke-NativeGate 'SQL Availability isolé' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f tests/postgres/admin-availability-scheduling/run.sql } -WorkingDirectory $Availability
$ReviewedHead = Invoke-NativeGate 'HEAD candidat Availability' { git -C $Availability rev-parse HEAD }
$MigrationSha256 = (Get-FileHash -LiteralPath "$Availability\supabase\migrations\20260811190000_admin_availability_schedule.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
Assert-EphemeralAdvisorReceipt -Receipt $AvailabilityAdvisorReceipt -ExpectedProjectRef $ExpectedProjectRef -ExpectedReviewedHead $ReviewedHead -ExpectedMigrationSha256 $MigrationSha256 -ExpectedDatabaseIdentity $DatabaseIdentity
```

`$AvailabilityAdvisorReceipt` contient aussi `ReviewedHead`, `MigrationSha256` et `DatabaseIdentity`; un receipt d'un autre commit, contenu SQL ou serveur est rejeté. Après le commit final du worker, relancer SQL + advisors et remplacer le receipt candidat par un receipt lié au nouveau HEAD avant le handoff d'intégration. Expected: RLS, permissions, deux applications de migration, refus cross-restaurant, transitions `America/Toronto` des 2026-03-08/2026-11-01, concurrence même plat/plats distincts, `last_success_at` périmé et advisory lock passent. Security Advisors et Performance Advisors n’affichent aucune erreur nouvelle. Aucun environnement production n’est lié ni migré.

- [ ] **Step 4: Valider et commit**

```powershell
$Availability = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-availability'
Invoke-NativeGate 'tests Availability worker' { node --test tests/admin-vnext-availability.test.mjs tests/admin-vnext-availability-worker.test.mjs tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs tests/admin-dish-photo-route.test.mjs } -WorkingDirectory $Availability
Invoke-AdminPlaywrightGate -Label 'e2e Availability worker' -WorkingDirectory $Availability -Specs @('e2e/admin-availability.spec.ts', 'e2e/admin-vnext-availability.spec.ts') -Scenario 'full-menu' -Projects @('chromium') -Build
Invoke-NativeGate 'full-menu Availability worker' { npm run test:admin:full-menu } -WorkingDirectory $Availability
Invoke-NativeGate 'lint Availability worker' { npm run lint } -WorkingDirectory $Availability
Invoke-NativeGate 'typecheck Availability worker' { npm run typecheck } -WorkingDirectory $Availability
Invoke-NativeGate 'build Availability worker' { npm run build } -WorkingDirectory $Availability
Invoke-NativeGate 'stage Availability' { git add app/admin/availability app/admin/api/dishes app/api/internal/admin-availability-worker components/admin/availability components/admin/AdminDishAvailabilityControl.tsx components/admin/AdminDishWorklist.tsx lib/admin/availability.ts lib/admin/availability supabase/migrations/20260811190000_admin_availability_schedule.sql tests/admin-vnext-availability.test.mjs tests/admin-vnext-availability-worker.test.mjs tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs tests/postgres/admin-availability-scheduling e2e/admin-availability.spec.ts e2e/admin-vnext-availability.spec.ts } -WorkingDirectory $Availability
Invoke-NativeGate 'commit Availability' { git commit -m "feat(admin): rebuild vnext availability controls" } -WorkingDirectory $Availability
Invoke-NativeGate 'status Availability' { git status --short --branch } -WorkingDirectory $Availability
```

## Task 8: Réaliser Intelligence-AI

**Owner:** Intelligence-AI.

- [ ] **Step 1: Écrire les contrats Intelligence/AI et `e2e/admin-vnext-assistant.spec.ts` en RED**

`tests/admin-vnext-intelligence.test.mjs` exige preuves chiffrées, comparaisons cohérentes, alternatives tabulaires et états insuffisants. `tests/admin-vnext-assistant-evaluation.test.mjs`, `tests/admin-vnext-assistant-security.test.mjs` et `tests/admin-vnext-mistral-contract.test.mjs` exigent isolation restaurant/menu, validation stricte, body borné, timeout 4 500 ms, rate/error states et corpus prompt-injection FR/EN. Le mock CI couvre claim valide, preuve inconnue, preuve cross-bundle, audience interdite, prose libre et nombre écrit en lettres.

- [ ] **Step 2: Implémenter uniquement Insights/Assistant possédés**

L’IA ne reçoit qu’une projection agrégée/anonymisée `mistral` du registre autorisé. Mistral retourne uniquement `{ claimType, evidenceIds }`; le serveur choisit un template FR/EN et injecte toute valeur/rang/comparaison depuis les preuves. Toute indisponibilité fournisseur, limiteur distribué absent, référence invalide ou donnée insuffisante active le fallback déterministe ou un état gracieux, sans réponse quantitative fabriquée et sans mutation.

La migration additive `20260811200000_admin_assistant_rate_limit.sql` crée seulement le quota distribué et `consume_admin_assistant_quota`, scoped restaurant, atomique, `security definer`, `search_path=''` et service-role-only. Elle ne stocke ni prompt, réponse ou session et n’est appliquée que sur Postgres local isolé ou branche Supabase éphémère.

Le gate SQL prouve application répétée, RLS/ACL, refus public/anon/authenticated, concurrence sans dépassement et états `allowed|denied|unavailable|error`; les Security/Performance Advisors du projet éphémère ne doivent introduire aucun P0/P1. Sans preuve Postgres, Mistral reste désactivé et la branche ne passe pas la revue.

- [ ] **Step 3: Valider et commit**

```powershell
$Intelligence = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-intelligence-ai'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
Assert-ExactWorkerBase -WorkingDirectory $Intelligence -ExpectedBase $ExpectedBase
Invoke-NativeGate 'tests Intelligence-AI worker' { node --test tests/admin-vnext-intelligence.test.mjs tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs tests/admin-vnext-mistral-contract.test.mjs tests/admin-assistant-isolation.test.mjs tests/admin-analytics-evidence.test.mjs tests/admin-analytics-correctness.test.mjs tests/admin-interactive-charts.test.mjs tests/admin-recommendations.test.mjs } -WorkingDirectory $Intelligence
$DatabaseUrl = $env:ADMIN_VNEXT_EPHEMERAL_DATABASE_URL
$ExpectedProjectRef = $env:ADMIN_VNEXT_EPHEMERAL_PROJECT_REF
$ExpectedHost = $env:ADMIN_VNEXT_EXPECTED_DB_HOST
$ProductionProjectRef = $env:ADMIN_VNEXT_PRODUCTION_PROJECT_REF
$DatabaseIdentity = Assert-EphemeralDatabaseTarget -DatabaseUrl $DatabaseUrl -ExpectedProjectRef $ExpectedProjectRef -ExpectedHost $ExpectedHost -ProductionProjectRef $ProductionProjectRef
Invoke-NativeGate 'SQL quota IA isolé' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f tests/postgres/admin-assistant-rate-limit/run.sql } -WorkingDirectory $Intelligence
$ReviewedHead = Invoke-NativeGate 'HEAD candidat Intelligence-AI' { git -C $Intelligence rev-parse HEAD }
$MigrationSha256 = (Get-FileHash -LiteralPath "$Intelligence\supabase\migrations\20260811200000_admin_assistant_rate_limit.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
Assert-EphemeralAdvisorReceipt -Receipt $AssistantAdvisorReceipt -ExpectedProjectRef $ExpectedProjectRef -ExpectedReviewedHead $ReviewedHead -ExpectedMigrationSha256 $MigrationSha256 -ExpectedDatabaseIdentity $DatabaseIdentity
Invoke-AdminPlaywrightGate -Label 'e2e Intelligence-AI worker' -WorkingDirectory $Intelligence -Specs @('e2e/admin-insights.spec.ts', 'e2e/admin-insights-fidelity.spec.ts', 'e2e/admin-vnext-assistant.spec.ts') -Scenario 'full-menu' -Projects @('chromium') -Build
Invoke-NativeGate 'lint Intelligence-AI worker' { npm run lint } -WorkingDirectory $Intelligence
Invoke-NativeGate 'typecheck Intelligence-AI worker' { npm run typecheck } -WorkingDirectory $Intelligence
Invoke-NativeGate 'build Intelligence-AI worker' { npm run build } -WorkingDirectory $Intelligence
Invoke-NativeGate 'stage Intelligence-AI' { git add app/admin/insights app/admin/api/assistant components/admin/insights components/admin/AdminAssistant.tsx lib/admin/assistant.ts lib/admin/assistant lib/admin/recommendations.ts lib/ai/mistral.ts supabase/migrations/20260811200000_admin_assistant_rate_limit.sql tests/fixtures/admin-assistant-evals.json tests/admin-vnext-intelligence.test.mjs tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs tests/admin-vnext-mistral-contract.test.mjs tests/admin-assistant-isolation.test.mjs tests/postgres/admin-assistant-rate-limit e2e/admin-insights.spec.ts e2e/admin-insights-fidelity.spec.ts e2e/admin-vnext-assistant.spec.ts } -WorkingDirectory $Intelligence
Invoke-NativeGate 'commit Intelligence-AI' { git commit -m "feat(admin): deliver vnext intelligence and assistant" } -WorkingDirectory $Intelligence
Invoke-NativeGate 'status Intelligence-AI' { git status --short --branch } -WorkingDirectory $Intelligence
```

Après le commit final du worker, relancer SQL + advisors et émettre le handoff `$AssistantAdvisorReceipt` avec `ReviewedHead`, `MigrationSha256` et `DatabaseIdentity` correspondant exactement au HEAD remis à Integration.

## Task 9: Réaliser Reports après libération d’un slot

**Owner:** Reports.

- [ ] **Step 1: Écrire RED dans `tests/admin-vnext-reports.test.mjs` et le scénario `reports`**

Exiger plages stables, définitions/scope/timezone/alignement identiques, titre/période/unité, résumé et table exacte pour chaque visualisation, états données insuffisantes, taux `null` si baseline zéro, export uniquement depuis la projection `export` du registre, nom de fichier déterministe, UTF-8 explicite, FR/EN, impression lisible et aucun PII/secret. `tests/admin-vnext-reports-csv.test.mjs` couvre neutralisation en début de cellule de `=`, `+`, `-`, `@`, tabulation et retour chariot, Unicode et retours ligne.

- [ ] **Step 2: Implémenter la page Reports**

Créer `app/admin/reports/page.tsx`, `app/admin/api/reports/export/route.ts`, `components/admin/reports/**` et `lib/admin/reports/**`. L’export est généré côté serveur après nouvelle autorisation et depuis la projection canonique, jamais depuis des cellules envoyées par le client. Ne créer aucune requête Supabase brute et ne modifier aucun contrat de Data Foundation.

- [ ] **Step 3: Valider et commit**

```powershell
$Reports = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-reports'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
Assert-ExactWorkerBase -WorkingDirectory $Reports -ExpectedBase $ExpectedBase
Invoke-NativeGate 'tests Reports worker' { node --test tests/admin-vnext-reports.test.mjs tests/admin-vnext-reports-csv.test.mjs tests/admin-analytics-evidence.test.mjs tests/admin-interactive-charts.test.mjs } -WorkingDirectory $Reports
Invoke-AdminPlaywrightGate -Label 'e2e Reports worker' -WorkingDirectory $Reports -Specs @('e2e/admin-vnext-reports.spec.ts') -Scenario 'full-menu' -Projects @('chromium') -Build
Invoke-NativeGate 'lint Reports worker' { npm run lint } -WorkingDirectory $Reports
Invoke-NativeGate 'typecheck Reports worker' { npm run typecheck } -WorkingDirectory $Reports
Invoke-NativeGate 'build Reports worker' { npm run build } -WorkingDirectory $Reports
Invoke-NativeGate 'stage Reports' { git add app/admin/reports app/admin/api/reports components/admin/reports lib/admin/reports tests/admin-vnext-reports.test.mjs tests/admin-vnext-reports-csv.test.mjs e2e/admin-vnext-reports.spec.ts } -WorkingDirectory $Reports
Invoke-NativeGate 'commit Reports' { git commit -m "feat(admin): add evidence-backed vnext reports" } -WorkingDirectory $Reports
Invoke-NativeGate 'status Reports' { git status --short --branch } -WorkingDirectory $Reports
```

## Task 10: Intégrer Wave 2 séquentiellement vers B2

**Owner:** Integration.

Chaque branche utilise `$ExpectedBase`, initialisé au SHA complet exact de B1 transmis dans le handoff; jamais le texte `B1`. Les reviewers retournent respectivement `$TodayReviewReceipt`, `$AvailabilityReviewReceipt`, `$IntelligenceReviewReceipt` et `$ReportsReviewReceipt`, chacun avec `ReviewerTaskId`, `Branch`, `ReviewedHead`, `ExpectedBase`, `Decision`, `OpenP0`, `OpenP1`, `CompletedAtUtc` et `ReviewLogUri`. Chaque merge appelle le protocole merge-base/absence de merge sœur/allowlist/diff/diff-check/clean/P0-P1 immédiatement avant `git merge`. Les blocs s'exécutent avec `$Integration` pointant sur le worktree Integration.

- [ ] **Step 1: Merge Today**

```powershell
$ExpectedBase = $B1
Assert-ReviewedBranchReady -Integration $Integration -Worker "$Repo\.worktrees\admin-vnext-today" -Branch 'feat/admin-vnext-today' -ExpectedBase $ExpectedBase -AllowedPathPatterns $AllowedPathPatternsByBranch['feat/admin-vnext-today'] -ForbiddenSiblingBranches $ForbiddenSiblingsByBranch['feat/admin-vnext-today'] -ReviewReceipt $TodayReviewReceipt
Invoke-NativeGate 'merge Today' { git -C $Integration merge --no-ff --no-commit feat/admin-vnext-today } -Integration $Integration -AbortMerge
Invoke-NativeGate 'tests Today' { node --test tests/admin-vnext-today.test.mjs tests/admin-dashboard-contract.test.mjs tests/admin-dashboard-range.test.mjs tests/admin-dashboard-readiness.test.mjs } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-AdminPlaywrightGate -Label 'e2e Today' -WorkingDirectory $Integration -Specs @('e2e/admin-vnext-today.spec.ts') -Scenario 'full-menu' -Projects @('chromium') -Build -Integration $Integration -AbortMerge
Invoke-NativeGate 'assets Today' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs Today' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint Today' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck Today' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build Today' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'commit merge Today' { git -C $Integration commit -m "merge: integrate admin vnext today" } -Integration $Integration -AbortMerge
```

- [ ] **Step 2: Merge Availability**

```powershell
Assert-ReviewedBranchReady -Integration $Integration -Worker "$Repo\.worktrees\admin-vnext-availability" -Branch 'feat/admin-vnext-availability' -ExpectedBase $ExpectedBase -AllowedPathPatterns $AllowedPathPatternsByBranch['feat/admin-vnext-availability'] -ForbiddenSiblingBranches $ForbiddenSiblingsByBranch['feat/admin-vnext-availability'] -ReviewReceipt $AvailabilityReviewReceipt
Invoke-NativeGate 'merge Availability' { git -C $Integration merge --no-ff --no-commit feat/admin-vnext-availability } -Integration $Integration -AbortMerge
Invoke-NativeGate 'tests Availability' { node --test tests/admin-vnext-availability.test.mjs tests/admin-vnext-availability-worker.test.mjs tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs tests/admin-dish-photo-route.test.mjs } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-AdminPlaywrightGate -Label 'e2e Availability legacy et vNext' -WorkingDirectory $Integration -Specs @('e2e/admin-availability.spec.ts', 'e2e/admin-vnext-availability.spec.ts') -Scenario 'full-menu' -Projects @('chromium') -Build -Integration $Integration -AbortMerge
$DatabaseUrl = $env:ADMIN_VNEXT_EPHEMERAL_DATABASE_URL
$ExpectedProjectRef = $env:ADMIN_VNEXT_EPHEMERAL_PROJECT_REF
$ExpectedHost = $env:ADMIN_VNEXT_EXPECTED_DB_HOST
$ProductionProjectRef = $env:ADMIN_VNEXT_PRODUCTION_PROJECT_REF
try {
  $DatabaseIdentity = Assert-EphemeralDatabaseTarget -DatabaseUrl $DatabaseUrl -ExpectedProjectRef $ExpectedProjectRef -ExpectedHost $ExpectedHost -ProductionProjectRef $ProductionProjectRef
  $ReviewedHead = Invoke-NativeGate 'HEAD revu Availability' { git -C $Integration rev-parse feat/admin-vnext-availability }
  $MigrationSha256 = (Get-FileHash -LiteralPath "$Integration\supabase\migrations\20260811190000_admin_availability_schedule.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
  Assert-EphemeralAdvisorReceipt -Receipt $AvailabilityAdvisorReceipt -ExpectedProjectRef $ExpectedProjectRef -ExpectedReviewedHead $ReviewedHead -ExpectedMigrationSha256 $MigrationSha256 -ExpectedDatabaseIdentity $DatabaseIdentity
} catch {
  Invoke-NativeGate 'abort merge Availability après gate DB' { git -C $Integration merge --abort }
  throw
}
Invoke-NativeGate 'SQL Availability intégré' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f tests/postgres/admin-availability-scheduling/run.sql } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'full-menu Availability' { npm run test:admin:full-menu } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'assets Availability' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs Availability' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint Availability' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck Availability' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build Availability' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'commit merge Availability' { git -C $Integration commit -m "merge: integrate admin vnext availability" } -Integration $Integration -AbortMerge
```

- [ ] **Step 3: Merge Intelligence-AI**

```powershell
Assert-ReviewedBranchReady -Integration $Integration -Worker "$Repo\.worktrees\admin-vnext-intelligence-ai" -Branch 'feat/admin-vnext-intelligence-ai' -ExpectedBase $ExpectedBase -AllowedPathPatterns $AllowedPathPatternsByBranch['feat/admin-vnext-intelligence-ai'] -ForbiddenSiblingBranches $ForbiddenSiblingsByBranch['feat/admin-vnext-intelligence-ai'] -ReviewReceipt $IntelligenceReviewReceipt
Invoke-NativeGate 'merge Intelligence-AI' { git -C $Integration merge --no-ff --no-commit feat/admin-vnext-intelligence-ai } -Integration $Integration -AbortMerge
Invoke-NativeGate 'tests Intelligence-AI' { node --test tests/admin-vnext-intelligence.test.mjs tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs tests/admin-vnext-mistral-contract.test.mjs tests/admin-assistant-isolation.test.mjs tests/admin-analytics-evidence.test.mjs tests/admin-analytics-correctness.test.mjs tests/admin-interactive-charts.test.mjs tests/admin-recommendations.test.mjs } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
$DatabaseUrl = $env:ADMIN_VNEXT_EPHEMERAL_DATABASE_URL
$ExpectedProjectRef = $env:ADMIN_VNEXT_EPHEMERAL_PROJECT_REF
$ExpectedHost = $env:ADMIN_VNEXT_EXPECTED_DB_HOST
$ProductionProjectRef = $env:ADMIN_VNEXT_PRODUCTION_PROJECT_REF
try {
  $DatabaseIdentity = Assert-EphemeralDatabaseTarget -DatabaseUrl $DatabaseUrl -ExpectedProjectRef $ExpectedProjectRef -ExpectedHost $ExpectedHost -ProductionProjectRef $ProductionProjectRef
  $ReviewedHead = Invoke-NativeGate 'HEAD revu Intelligence-AI' { git -C $Integration rev-parse feat/admin-vnext-intelligence-ai }
  $MigrationSha256 = (Get-FileHash -LiteralPath "$Integration\supabase\migrations\20260811200000_admin_assistant_rate_limit.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
  Assert-EphemeralAdvisorReceipt -Receipt $AssistantAdvisorReceipt -ExpectedProjectRef $ExpectedProjectRef -ExpectedReviewedHead $ReviewedHead -ExpectedMigrationSha256 $MigrationSha256 -ExpectedDatabaseIdentity $DatabaseIdentity
} catch {
  Invoke-NativeGate 'abort merge Intelligence-AI après gate DB' { git -C $Integration merge --abort }
  throw
}
Invoke-NativeGate 'SQL quota IA intégré' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f tests/postgres/admin-assistant-rate-limit/run.sql } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-AdminPlaywrightGate -Label 'e2e Intelligence-AI legacy et vNext' -WorkingDirectory $Integration -Specs @('e2e/admin-insights.spec.ts', 'e2e/admin-insights-fidelity.spec.ts', 'e2e/admin-vnext-assistant.spec.ts') -Scenario 'full-menu' -Projects @('chromium') -Build -Integration $Integration -AbortMerge
Invoke-NativeGate 'assets Intelligence-AI' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs Intelligence-AI' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint Intelligence-AI' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck Intelligence-AI' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build Intelligence-AI' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'commit merge Intelligence-AI' { git -C $Integration commit -m "merge: integrate admin vnext intelligence ai" } -Integration $Integration -AbortMerge
```

- [ ] **Step 4: Merge Reports**

```powershell
Assert-ReviewedBranchReady -Integration $Integration -Worker "$Repo\.worktrees\admin-vnext-reports" -Branch 'feat/admin-vnext-reports' -ExpectedBase $ExpectedBase -AllowedPathPatterns $AllowedPathPatternsByBranch['feat/admin-vnext-reports'] -ForbiddenSiblingBranches $ForbiddenSiblingsByBranch['feat/admin-vnext-reports'] -ReviewReceipt $ReportsReviewReceipt
Invoke-NativeGate 'merge Reports' { git -C $Integration merge --no-ff --no-commit feat/admin-vnext-reports } -Integration $Integration -AbortMerge
Invoke-NativeGate 'tests Reports' { node --test tests/admin-vnext-reports.test.mjs tests/admin-vnext-reports-csv.test.mjs tests/admin-analytics-evidence.test.mjs tests/admin-interactive-charts.test.mjs } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-AdminPlaywrightGate -Label 'e2e Reports' -WorkingDirectory $Integration -Specs @('e2e/admin-vnext-reports.spec.ts') -Scenario 'full-menu' -Projects @('chromium') -Build -Integration $Integration -AbortMerge
Invoke-NativeGate 'assets Reports' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs Reports' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint Reports' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck Reports' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build Reports' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'commit merge Reports' { git -C $Integration commit -m "merge: integrate admin vnext reports" } -Integration $Integration -AbortMerge
```

À chacune de ces étapes, toute commande rouge ou conflit est immédiatement suivie de `git merge --abort`; le commit indiqué n’est alors pas exécuté.

- [ ] **Step 5: Exécuter la régression Wave 2 et capturer B2**

```powershell
Invoke-NativeGate 'test:admin B2' { npm run test:admin } -WorkingDirectory $Integration
Invoke-NativeGate 'test:admin:qr B2' { npm run test:admin:qr } -WorkingDirectory $Integration
Invoke-NativeGate 'test:admin:full-menu B2' { npm run test:admin:full-menu } -WorkingDirectory $Integration
Invoke-NativeGate 'assets B2' { npm run assets:check } -WorkingDirectory $Integration
Invoke-NativeGate 'lfs B2' { npm run lfs:check } -WorkingDirectory $Integration
Invoke-NativeGate 'lint B2' { npm run lint } -WorkingDirectory $Integration
Invoke-NativeGate 'typecheck B2' { npm run typecheck } -WorkingDirectory $Integration
Invoke-NativeGate 'build B2' { npm run build } -WorkingDirectory $Integration
$B2 = Invoke-NativeGate 'capture B2' { git -C $Integration rev-parse HEAD }
Invoke-NativeGate 'status B2' { git -C $Integration status --short --branch }
```

## Task 11: Créer et réaliser More-Quality depuis B2

**Owner:** More-Quality.

- [ ] **Step 1: Créer le worktree seulement après B2**

```powershell
$Repo = 'E:\Projet perso\MenuAlive'
$Integration = "$Repo\.worktrees\admin-vnext-integration"
$MoreQuality = "$Repo\.worktrees\admin-vnext-more-quality"
$B2 = Invoke-NativeGate 'relire B2' { git -C $Integration rev-parse HEAD }
Invoke-NativeGate 'create More-Quality worktree' { git -C $Repo worktree add -b feat/admin-vnext-more-quality $MoreQuality $B2 }
$MoreBase = Invoke-NativeGate 'merge-base More-Quality' { git -C $MoreQuality merge-base HEAD $B2 }
if ($MoreBase -ne $B2) { throw "More-Quality n’est pas basé sur B2" }
```

- [ ] **Step 2: Écrire `tests/admin-vnext-more-quality.test.mjs` et `e2e/admin-vnext-more-quality.spec.ts` en RED**

Exiger une page More utile et bornée: état réel du QR, menu publié, photos, traductions, descriptions, allergènes et assets lorsqu’ils sont mesurables, profil restaurant en lecture seule, préférences locale/thème, canaux d’aide existants et logout sûr. Performance mobile, succès 3D/AR, erreurs d’assets, tickets et SLA restent absents ou `unmeasured` sans source fiable; aucune fonction POS/réservation. Le gate canonique exécute ensemble sept specs: Today, Availability, `admin-insights`, `admin-insights-fidelity`, `admin-vnext-assistant`, Reports et More-Quality, sur Chromium/WebKit avec `--forbid-only`, zéro skip silencieux et nettoyage des artefacts, sans modifier `package.json`.

- [ ] **Step 3: Implémenter More et consolider la qualité**

More-Quality peut corriger ses propres fichiers. Pour un défaut P0/P1 dans Today, Availability, Intelligence-AI, Reports, Foundation ou Data Foundation, il crée une fiche de reproduction et la retourne au propriétaire; il n’édite pas la page fautive.

- [ ] **Step 4: Valider et commit**

```powershell
$MoreQuality = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-more-quality'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
Assert-ExactWorkerBase -WorkingDirectory $MoreQuality -ExpectedBase $ExpectedBase
Invoke-NativeGate 'tests More-Quality worker' { node --test tests/admin-vnext-more-quality.test.mjs } -WorkingDirectory $MoreQuality
Invoke-AdminPlaywrightGate -Label 'e2e sept specs More-Quality worker' -WorkingDirectory $MoreQuality -Specs $AdminVnextCanonicalSpecs -Scenario 'full-menu' -Projects @('chromium', 'webkit') -Build
Invoke-NativeGate 'test:admin More-Quality worker' { npm run test:admin } -WorkingDirectory $MoreQuality
Invoke-NativeGate 'test:admin:qr More-Quality worker' { npm run test:admin:qr } -WorkingDirectory $MoreQuality
Invoke-NativeGate 'test:admin:full-menu More-Quality worker' { npm run test:admin:full-menu } -WorkingDirectory $MoreQuality
Invoke-NativeGate 'lint More-Quality worker' { npm run lint } -WorkingDirectory $MoreQuality
Invoke-NativeGate 'typecheck More-Quality worker' { npm run typecheck } -WorkingDirectory $MoreQuality
Invoke-NativeGate 'build More-Quality worker' { npm run build } -WorkingDirectory $MoreQuality
Invoke-NativeGate 'stage More-Quality' { git add app/admin/more components/admin/more lib/admin/more tests/admin-vnext-more-quality.test.mjs e2e/admin-vnext-more-quality.spec.ts } -WorkingDirectory $MoreQuality
Invoke-NativeGate 'commit More-Quality' { git commit -m "feat(admin): complete vnext more and quality gates" } -WorkingDirectory $MoreQuality
Invoke-NativeGate 'status More-Quality' { git status --short --branch } -WorkingDirectory $MoreQuality
```

`package.json`, `package-lock.json` et `scripts/**` restent hors ownership; aucune dépendance ni runner global n’est ajouté.

- [ ] **Step 5: Revoir, merger et capturer B3**

Le reviewer retourne `$MoreQualityReviewReceipt` avec le même schéma auditable. Le bloc initialise `$ExpectedBase` au SHA B2 exact puis exécute le protocole complet immédiatement avant le merge:

```powershell
$ExpectedBase = $B2
Assert-ReviewedBranchReady -Integration $Integration -Worker "$Repo\.worktrees\admin-vnext-more-quality" -Branch 'feat/admin-vnext-more-quality' -ExpectedBase $ExpectedBase -AllowedPathPatterns $AllowedPathPatternsByBranch['feat/admin-vnext-more-quality'] -ForbiddenSiblingBranches $ForbiddenSiblingsByBranch['feat/admin-vnext-more-quality'] -ReviewReceipt $MoreQualityReviewReceipt
Invoke-NativeGate 'merge More-Quality' { git -C $Integration merge --no-ff --no-commit feat/admin-vnext-more-quality } -Integration $Integration -AbortMerge
Invoke-NativeGate 'tests More-Quality' { node --test tests/admin-vnext-more-quality.test.mjs } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-AdminPlaywrightGate -Label 'e2e sept specs Chromium/WebKit' -WorkingDirectory $Integration -Specs $AdminVnextCanonicalSpecs -Scenario 'full-menu' -Projects @('chromium', 'webkit') -Build -Integration $Integration -AbortMerge
Invoke-NativeGate 'test:admin More-Quality' { npm run test:admin } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'test:admin:qr More-Quality' { npm run test:admin:qr } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'test:admin:full-menu More-Quality' { npm run test:admin:full-menu } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'assets More-Quality' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs More-Quality' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint More-Quality' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck More-Quality' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build More-Quality' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'commit merge More-Quality' { git -C $Integration commit -m "merge: integrate admin vnext more quality" } -Integration $Integration -AbortMerge
$B3 = Invoke-NativeGate 'capture B3' { git -C $Integration rev-parse HEAD }
Invoke-NativeGate 'status B3' { git -C $Integration status --short --branch }
```

## Task 12: Créer Final-QA depuis B3 et retourner les défauts aux propriétaires

**Owner:** Final-QA.

- [ ] **Step 1: Créer le worktree seulement après B3**

```powershell
$Repo = 'E:\Projet perso\MenuAlive'
$Integration = "$Repo\.worktrees\admin-vnext-integration"
$FinalQa = "$Repo\.worktrees\admin-vnext-final-qa"
$ExpectedBase = Invoke-NativeGate 'capture SHA B3 exact' { git -C $Integration rev-parse HEAD }
Invoke-NativeGate 'create Final-QA worktree' { git -C $Repo worktree add -b feat/admin-vnext-final-qa $FinalQa $ExpectedBase }
$ActualBase = Invoke-NativeGate 'merge-base Final-QA' { git -C $FinalQa merge-base HEAD $ExpectedBase }
if ($ActualBase -ne $ExpectedBase) { throw "Final-QA n’est pas basé sur le SHA B3 exact" }
```

- [ ] **Step 2: Écrire le contrat Final-QA sans toucher la production**

`tests/admin-vnext-acceptance-matrix.test.mjs` vérifie chaque route, viewport, thème, locale, état et commande obligatoire. `tests/admin-vnext-data-honesty.test.mjs` interdit zéros inventés, métriques commerciales et divergence UI/export/assistant. `tests/admin-vnext-runtime-security.test.mjs` verrouille scope, cookies, endpoints et migrations. `e2e/admin-vnext-matrix.spec.ts` porte la matrice navigateur. Final-QA peut modifier exactement les deux fixtures test-only `e2e/support/adminVisualFixtureData.ts` et `e2e/support/admin-visual-fixture-server.mjs` afin de servir cette matrice hermétique; aucun autre fichier sous `e2e/support/**` n'est autorisé. `docs/validation/admin-vnext-final-qa-2026-08-11.md` enregistre SHA, environnement, résultats, console, réseau, overflow, accessibilité et défauts.

- [ ] **Step 3: Exécuter Browser QA**

Sur `/admin`, `/admin/availability`, `/admin/insights`, `/admin/reports` et `/admin/more`, tester 1448×1086, un viewport tablette représentatif 768×1024, 430×932 et 390×844, à chaque fois light/dark et FR/EN. Vérifier route 200, aucune erreur console inattendue, aucun 404/500 réseau, aucun overflow horizontal, focus visible, tab order, cibles 44 px, reduced motion et requêtes média/3D raisonnables.

Final-QA ne prétend pas valider Quick Look iPhone ni Scene Viewer Android. Aucun GLB/USDZ ne doit être récupéré avant intention utilisateur.

- [ ] **Step 4: Retourner tout défaut au propriétaire**

Chaque P0/P1 contient: `$ExpectedBase`, propriétaire, route, locale, thème, viewport, préconditions, étapes exactes, attendu, observé, console/réseau et preuve. Le propriétaire crée une branche de correction depuis le HEAD Integration courant, ajoute un test de régression et passe le protocole complet avec ce SHA exact comme base. Integration merge la correction sans éditer de feature, exécute tous les gates puis capture le nouveau HEAD immuable comme `B3.rN`.

Avant de reprendre la matrice, Final-QA commit uniquement ses éventuels changements QA autorisés et doit être propre. Il ne merge jamais Integration dans sa branche. Il rejoue ses seuls commits tests/docs sur `B3.rN`, puis remplace `$ExpectedBase` par ce nouveau SHA:

```powershell
$PreviousExpectedBase = $ExpectedBase
$B3rN = Invoke-NativeGate 'capture B3.rN exact' { git -C $Integration rev-parse HEAD }
if ($B3rN -eq $PreviousExpectedBase) { throw 'aucun correctif intégré à revalider' }
$RepairMergeBase = Invoke-NativeGate 'ascendance B3.rN' { git -C $Integration merge-base $PreviousExpectedBase $B3rN }
if ($RepairMergeBase -ne $PreviousExpectedBase) { throw 'B3.rN diverge de la base QA précédente; rebase interdit' }
try {
  Invoke-NativeGate 'rebase QA-only sur B3.rN' { git -C $FinalQa rebase --onto $B3rN $PreviousExpectedBase feat/admin-vnext-final-qa }
} catch {
  Invoke-NativeGate 'abort rebase QA en conflit' { git -C $FinalQa rebase --abort }
  throw
}
$ExpectedBase = $B3rN
$RuntimeDiff = @(Invoke-NativeGate 'diff Final-QA après B3.rN' { git -C $FinalQa diff --name-only "$ExpectedBase...HEAD" } | Where-Object { $_ -match '^(app|components|lib|supabase|public)/|^package(-lock)?\.json$' })
if ($RuntimeDiff.Count -ne 0) { throw "runtime présent dans Final-QA: $($RuntimeDiff -join ', ')" }
Invoke-AdminVnextFinalMatrixGate -LabelPrefix 'après B3.rN' -WorkingDirectory $FinalQa -Build
```

Au moindre conflit de rebase, exécuter immédiatement `git -C $FinalQa rebase --abort`, vérifier son code de sortie et retourner la divergence aux propriétaires; Final-QA ne résout jamais un conflit runtime. Final-QA réexécute ensuite toute la preuve depuis le nouveau `$ExpectedBase`.

- [ ] **Step 5: Commit QA documentaire seulement si tout est vert**

```powershell
Invoke-NativeGate 'tests Final-QA worker' { node --test tests/admin-vnext-acceptance-matrix.test.mjs tests/admin-vnext-data-honesty.test.mjs tests/admin-vnext-runtime-security.test.mjs } -WorkingDirectory $FinalQa
Invoke-AdminVnextFinalMatrixGate -LabelPrefix 'Final-QA worker' -WorkingDirectory $FinalQa -Build
Invoke-NativeGate 'stage Final-QA' { git add tests/admin-vnext-acceptance-matrix.test.mjs tests/admin-vnext-data-honesty.test.mjs tests/admin-vnext-runtime-security.test.mjs e2e/admin-vnext-matrix.spec.ts e2e/support/adminVisualFixtureData.ts e2e/support/admin-visual-fixture-server.mjs docs/validation/admin-vnext-final-qa-2026-08-11.md } -WorkingDirectory $FinalQa
Invoke-NativeGate 'commit Final-QA worker' { git commit -m "test(admin): record vnext final qa evidence" } -WorkingDirectory $FinalQa
Invoke-NativeGate 'status Final-QA worker' { git status --short --branch } -WorkingDirectory $FinalQa
```

- [ ] **Step 6: Revoir, merger et capturer B4**

Le reviewer retourne `$FinalQaReviewReceipt` avec le même schéma auditable. `$ExpectedBase` reste le SHA complet exact de B3 ou du dernier B3.rN; le helper confirme notamment que le diff respecte l'allowlist QA exacte et ne contient aucun fichier de production:

```powershell
Assert-ReviewedBranchReady -Integration $Integration -Worker "$Repo\.worktrees\admin-vnext-final-qa" -Branch 'feat/admin-vnext-final-qa' -ExpectedBase $ExpectedBase -AllowedPathPatterns $AllowedPathPatternsByBranch['feat/admin-vnext-final-qa'] -ForbiddenSiblingBranches $ForbiddenSiblingsByBranch['feat/admin-vnext-final-qa'] -ReviewReceipt $FinalQaReviewReceipt
Invoke-NativeGate 'merge Final-QA' { git -C $Integration merge --no-ff --no-commit feat/admin-vnext-final-qa } -Integration $Integration -AbortMerge
Invoke-NativeGate 'tests Final-QA' { node --test tests/admin-vnext-acceptance-matrix.test.mjs tests/admin-vnext-data-honesty.test.mjs tests/admin-vnext-runtime-security.test.mjs } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-AdminVnextFinalMatrixGate -LabelPrefix 'Final-QA Integration' -WorkingDirectory $Integration -Build -Integration $Integration -AbortMerge
Invoke-NativeGate 'assets Final-QA' { npm run assets:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lfs Final-QA' { npm run lfs:check } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'lint Final-QA' { npm run lint } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'typecheck Final-QA' { npm run typecheck } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'build Final-QA' { npm run build } -WorkingDirectory $Integration -Integration $Integration -AbortMerge
Invoke-NativeGate 'commit merge Final-QA' { git -C $Integration commit -m "merge: integrate admin vnext final qa" } -Integration $Integration -AbortMerge
$B4 = Invoke-NativeGate 'capture B4' { git -C $Integration rev-parse HEAD }
Invoke-NativeGate 'status B4' { git -C $Integration status --short --branch }
```

## Task 13: Exécuter la matrice finale à B4

**Owner:** Integration en lecture/exécution; aucune édition.

- [ ] **Step 1: Exécuter tous les contrôles repository et admin**

```powershell
Invoke-NativeGate 'assets B4' { npm run assets:check } -WorkingDirectory $Integration
Invoke-NativeGate 'lfs B4' { npm run lfs:check } -WorkingDirectory $Integration
Invoke-NativeGate 'lint B4' { npm run lint } -WorkingDirectory $Integration
Invoke-NativeGate 'typecheck B4' { npm run typecheck } -WorkingDirectory $Integration
Invoke-NativeGate 'build B4' { npm run build } -WorkingDirectory $Integration
Invoke-AdminVnextFinalMatrixGate -LabelPrefix 'B4' -WorkingDirectory $Integration -Build
Invoke-NativeGate 'test:admin B4' { npm run test:admin } -WorkingDirectory $Integration
Invoke-NativeGate 'test:admin:qr B4' { npm run test:admin:qr } -WorkingDirectory $Integration
Invoke-NativeGate 'test:admin:full-menu B4' { npm run test:admin:full-menu } -WorkingDirectory $Integration
Invoke-NativeGate 'preview node B4' { npm run test:restaurateur-preview:node } -WorkingDirectory $Integration
Invoke-NativeGate 'e2e B4' { npm run test:e2e } -WorkingDirectory $Integration
```

Expected: toutes les commandes retournent 0. Une instabilité environnementale est rapportée avec commande, sortie, tentative ciblée et risque résiduel; elle n’est pas rebaptisée succès.

- [ ] **Step 2: Matérialiser et tester les deux migrations sur une cible non production**

Exécuter ce gate dans la même session sur une base strictement locale ou une branche éphémère. L'URL, le host et le project ref attendus sont obligatoires; le project ref production distinct est explicitement rejeté par `Assert-EphemeralDatabaseTarget`. Availability est appliquée et testée avant le quota Assistant. Aucune commande de migration production n'est autorisée.

```powershell
$B4 = Invoke-NativeGate 'HEAD B4 pour gates DB' { git -C $Integration rev-parse HEAD }
if ($B4 -notmatch '^[0-9a-f]{40}$') { throw 'SHA B4 exact requis pour les gates DB' }
$DatabaseUrl = $env:ADMIN_VNEXT_EPHEMERAL_DATABASE_URL
$ExpectedProjectRef = $env:ADMIN_VNEXT_EPHEMERAL_PROJECT_REF
$ExpectedHost = $env:ADMIN_VNEXT_EXPECTED_DB_HOST
$ProductionProjectRef = $env:ADMIN_VNEXT_PRODUCTION_PROJECT_REF
$DatabaseIdentity = Assert-EphemeralDatabaseTarget -DatabaseUrl $DatabaseUrl -ExpectedProjectRef $ExpectedProjectRef -ExpectedHost $ExpectedHost -ProductionProjectRef $ProductionProjectRef
$AvailabilityMigrationSha256 = (Get-FileHash -LiteralPath "$Integration\supabase\migrations\20260811190000_admin_availability_schedule.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
$AssistantMigrationSha256 = (Get-FileHash -LiteralPath "$Integration\supabase\migrations\20260811200000_admin_assistant_rate_limit.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
Invoke-NativeGate 'B4 appliquer migration Availability' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f supabase/migrations/20260811190000_admin_availability_schedule.sql } -WorkingDirectory $Integration
Invoke-NativeGate 'B4 tests Availability' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f tests/postgres/admin-availability-scheduling/run.sql } -WorkingDirectory $Integration
Invoke-NativeGate 'B4 appliquer migration quota Assistant' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f supabase/migrations/20260811200000_admin_assistant_rate_limit.sql } -WorkingDirectory $Integration
Invoke-NativeGate 'B4 tests quota Assistant' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f tests/postgres/admin-assistant-rate-limit/run.sql } -WorkingDirectory $Integration
$B4AdvisorNotBeforeUtc = [DateTimeOffset]::FromUnixTimeSeconds([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
```

- [ ] **Step 3: Relancer les advisors et valider un receipt frais lié à B4**

Après `$B4AdvisorNotBeforeUtc`, relancer Security Advisors et Performance Advisors sur le même `$ExpectedProjectRef`, puis exporter leur résultat frais dans le JSON absolu hors dépôt fourni par `ADMIN_VNEXT_B4_ADVISOR_EVIDENCE_JSON`. Le fichier contient exactement les onze champs construits ci-dessous, sans URL Postgres, mot de passe ni token. Les deux horodatages et `LogUri` proviennent de cette relance; aucun receipt de branche propriétaire, de Final-QA antérieure ou d'un autre serveur n'est accepté.

```powershell
$B4AdvisorEvidencePath = ([string]$env:ADMIN_VNEXT_B4_ADVISOR_EVIDENCE_JSON).Trim()
if ([string]::IsNullOrWhiteSpace($B4AdvisorEvidencePath) -or -not [IO.Path]::IsPathRooted($B4AdvisorEvidencePath)) { throw 'chemin JSON B4 advisors absolu requis' }
$ResolvedB4AdvisorEvidencePath = (Resolve-Path -LiteralPath $B4AdvisorEvidencePath -ErrorAction Stop).Path
$RepoPrefix = [IO.Path]::GetFullPath($Repo).TrimEnd('\') + '\'
if ($ResolvedB4AdvisorEvidencePath.StartsWith($RepoPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'evidence B4 advisors interdite dans le dépôt' }
$B4AdvisorEvidenceFile = Get-Item -LiteralPath $ResolvedB4AdvisorEvidencePath -ErrorAction Stop
if ($B4AdvisorEvidenceFile.LastWriteTimeUtc -lt $B4AdvisorNotBeforeUtc.UtcDateTime) { throw 'evidence B4 advisors antérieure à cette relance' }
$B4AdvisorEvidence = Get-Content -LiteralPath $ResolvedB4AdvisorEvidencePath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
$B4AdvisorEvidenceKeys = @($B4AdvisorEvidence.PSObject.Properties.Name)
$ExpectedB4AdvisorKeys = @('ProjectRef', 'Environment', 'ReviewedHead', 'AvailabilityMigrationSha256', 'AssistantMigrationSha256', 'DatabaseIdentity', 'SecurityCompletedAtUtc', 'PerformanceCompletedAtUtc', 'OpenP0', 'OpenP1', 'LogUri')
$MissingB4AdvisorKeys = @($ExpectedB4AdvisorKeys | Where-Object { $_ -notin $B4AdvisorEvidenceKeys })
$UnexpectedB4AdvisorKeys = @($B4AdvisorEvidenceKeys | Where-Object { $_ -notin $ExpectedB4AdvisorKeys })
if ($MissingB4AdvisorKeys.Count -ne 0 -or $UnexpectedB4AdvisorKeys.Count -ne 0) { throw "schéma JSON B4 advisors invalide; manquants=$($MissingB4AdvisorKeys -join ','); inattendus=$($UnexpectedB4AdvisorKeys -join ',')" }
$B4AdvisorReceipt = @{
  ProjectRef = ([string]$B4AdvisorEvidence.ProjectRef).Trim()
  Environment = ([string]$B4AdvisorEvidence.Environment).Trim()
  ReviewedHead = ([string]$B4AdvisorEvidence.ReviewedHead).Trim()
  AvailabilityMigrationSha256 = ([string]$B4AdvisorEvidence.AvailabilityMigrationSha256).Trim()
  AssistantMigrationSha256 = ([string]$B4AdvisorEvidence.AssistantMigrationSha256).Trim()
  DatabaseIdentity = ([string]$B4AdvisorEvidence.DatabaseIdentity).Trim()
  SecurityCompletedAtUtc = ([string]$B4AdvisorEvidence.SecurityCompletedAtUtc).Trim()
  PerformanceCompletedAtUtc = ([string]$B4AdvisorEvidence.PerformanceCompletedAtUtc).Trim()
  OpenP0 = [int]$B4AdvisorEvidence.OpenP0
  OpenP1 = [int]$B4AdvisorEvidence.OpenP1
  LogUri = ([string]$B4AdvisorEvidence.LogUri).Trim()
}
Assert-B4AdvisorReceipt -Receipt $B4AdvisorReceipt -ExpectedProjectRef $ExpectedProjectRef -ExpectedReviewedHead $B4 -ExpectedAvailabilityMigrationSha256 $AvailabilityMigrationSha256 -ExpectedAssistantMigrationSha256 $AssistantMigrationSha256 -ExpectedDatabaseIdentity $DatabaseIdentity -NotBeforeUtc $B4AdvisorNotBeforeUtc
```

Expected: migrations et tests verts dans l'ordre Availability puis quota Assistant, advisors Security/Performance frais sans P0/P1, receipt lié au HEAD B4, aux deux SHA-256 et à l'identité DB exacte. Toute cible production, variable manquante, preuve ancienne ou divergence bloque la clôture.

- [ ] **Step 4: Confirmer la matrice navigateur finale**

| Surface | 1448×1086 | Tablette 768×1024 | 430×932 | 390×844 | Light/Dark | FR/EN |
|---|---:|---:|---:|---:|---:|---:|
| Today | requis | requis | requis | requis | les deux | les deux |
| Availability | requis | requis | requis | requis | les deux | les deux |
| Intelligence-AI | requis | requis | requis | requis | les deux | les deux |
| Reports | requis | requis | requis | requis | les deux | les deux |
| More | requis | requis | requis | requis | les deux | les deux |

À chaque cellule: route chargée, console propre, réseau sans 404/500, aucun overflow horizontal, contenu non tronqué, focus visible, navigation clavier, contrôles ≥44 px, contraste lisible et fallback data observable sans mensonge.

- [ ] **Step 5: Nettoyer les artefacts générés et prouver le worktree propre**

Résoudre d’abord les chemins absolus et confirmer qu’ils restent sous Integration, puis supprimer seulement les sorties de validation:

```powershell
$Integration = (Resolve-Path 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-integration').Path
$Generated = @('.next','test-results','playwright-report')
foreach ($Name in $Generated) {
  $Target = Join-Path $Integration $Name
  if (([System.IO.Path]::GetFullPath($Target)).StartsWith($Integration, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $Target)) {
    Remove-Item -LiteralPath $Target -Recurse -Force
  }
}
Invoke-NativeGate 'status Integration final' { git -C $Integration status --short --branch }
Invoke-NativeGate 'diff-check Integration final' { git -C $Integration diff --check }
Invoke-NativeGate 'log Integration final' { git -C $Integration log --oneline --decorate -12 }
```

Expected: aucun `.env`, secret, log debug, capture, vidéo, trace ou asset lourd ajouté; status propre; historique composé des commits de merge prévus.

## Task 14: Garder Preview Parity séparé après B4

**Owner:** chantier distinct, démarré uniquement sur instruction explicite après acceptation du dashboard B4.

- [ ] **Step 1: Créer le worktree séparé depuis B4 au moment autorisé**

```powershell
$Repo = 'E:\Projet perso\MenuAlive'
$Integration = "$Repo\.worktrees\admin-vnext-integration"
$Preview = "$Repo\.worktrees\admin-vnext-public-preview-parity"
$B4 = Invoke-NativeGate 'capture B4 pour Preview' { git -C $Integration rev-parse HEAD }
$ExpectedBase = $B4
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'SHA B4 exact requis pour Preview' }
$PreviewAuthorizationPath = ([string]$env:ADMIN_VNEXT_PREVIEW_AUTHORIZATION_JSON).Trim()
if ([string]::IsNullOrWhiteSpace($PreviewAuthorizationPath) -or -not [IO.Path]::IsPathRooted($PreviewAuthorizationPath)) { throw "receipt JSON absolu d’autorisation Preview requis" }
$ResolvedPreviewAuthorizationPath = (Resolve-Path -LiteralPath $PreviewAuthorizationPath -ErrorAction Stop).Path
$RepoPrefix = [IO.Path]::GetFullPath($Repo).TrimEnd('\') + '\'
if ($ResolvedPreviewAuthorizationPath.StartsWith($RepoPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'receipt Preview interdit dans le dépôt' }
$PreviewAuthorizationFile = Get-Item -LiteralPath $ResolvedPreviewAuthorizationPath -ErrorAction Stop
$PreviewAuthorization = Get-Content -LiteralPath $ResolvedPreviewAuthorizationPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
$ExpectedPreviewAuthorizationKeys = @('Decision', 'InstructionId', 'ExpectedBase', 'B4AcceptedAtUtc', 'AuthorizedAtUtc')
$PreviewAuthorizationKeys = @($PreviewAuthorization.PSObject.Properties.Name)
$MissingPreviewAuthorizationKeys = @($ExpectedPreviewAuthorizationKeys | Where-Object { $_ -notin $PreviewAuthorizationKeys })
$UnexpectedPreviewAuthorizationKeys = @($PreviewAuthorizationKeys | Where-Object { $_ -notin $ExpectedPreviewAuthorizationKeys })
if ($MissingPreviewAuthorizationKeys.Count -ne 0 -or $UnexpectedPreviewAuthorizationKeys.Count -ne 0) { throw "schéma receipt Preview invalide; manquants=$($MissingPreviewAuthorizationKeys -join ','); inattendus=$($UnexpectedPreviewAuthorizationKeys -join ',')" }
if ([string]$PreviewAuthorization.Decision -ne 'approved') { throw 'Preview non approuvée explicitement' }
if ([string]::IsNullOrWhiteSpace([string]$PreviewAuthorization.InstructionId)) { throw 'InstructionId Preview vide' }
if ([string]$PreviewAuthorization.ExpectedBase -ne $ExpectedBase) { throw 'receipt Preview lié à un autre B4' }
[DateTimeOffset]$B4AcceptedAtUtc = [DateTimeOffset]::MinValue
[DateTimeOffset]$PreviewAuthorizedAtUtc = [DateTimeOffset]::MinValue
if (-not [DateTimeOffset]::TryParse([string]$PreviewAuthorization.B4AcceptedAtUtc, [ref]$B4AcceptedAtUtc)) { throw 'horodatage acceptation B4 invalide' }
if (-not [DateTimeOffset]::TryParse([string]$PreviewAuthorization.AuthorizedAtUtc, [ref]$PreviewAuthorizedAtUtc)) { throw 'horodatage autorisation Preview invalide' }
if ($PreviewAuthorizedAtUtc -le $B4AcceptedAtUtc) { throw "autorisation Preview non postérieure à l’acceptation B4" }
if ($PreviewAuthorizationFile.LastWriteTimeUtc -lt $PreviewAuthorizedAtUtc.UtcDateTime) { throw "fichier d’autorisation Preview antérieur à son horodatage déclaré" }
Invoke-NativeGate 'create Preview Parity worktree' { git -C $Repo worktree add -b feat/admin-vnext-public-preview-parity $Preview $B4 }
$PreviewBase = Invoke-NativeGate 'merge-base Preview Parity' { git -C $Preview merge-base HEAD $B4 }
if ($PreviewBase -ne $B4) { throw "Preview Parity n’est pas basé sur B4" }
Assert-ExactWorkerBase -WorkingDirectory $Preview -ExpectedBase $ExpectedBase
```

- [ ] **Step 2: Préserver l’isolation publique**

La parité porte sur présentation, copie et interactions déterministes seulement. `/apercu-restaurateur` et `/en/restaurant-preview` restent anonymes, sans cookies admin, sans Supabase, sans endpoint privé, sans mutation produit, sans liens owner/admin et sans requête 3D. Le preview réutilise uniquement des primitives prop-driven déjà auditées; il n’importe jamais shell privé, auth, loader, route ou contrôle de mutation admin.

- [ ] **Step 3: Valider le chantier séparément**

```powershell
Invoke-NativeGate 'preview node' { npm run test:restaurateur-preview:node } -WorkingDirectory $Preview
Invoke-NativeGate 'preview assets' { npm run assets:check } -WorkingDirectory $Preview
Invoke-NativeGate 'preview lfs' { npm run lfs:check } -WorkingDirectory $Preview
Invoke-NativeGate 'preview lint' { npm run lint } -WorkingDirectory $Preview
Invoke-NativeGate 'preview typecheck' { npm run typecheck } -WorkingDirectory $Preview
Invoke-NativeGate 'preview build' { npm run build } -WorkingDirectory $Preview
Invoke-NativeGate 'preview Chromium/WebKit' { node scripts/run-playwright-e2e.mjs e2e/restaurateur-preview.spec.ts --project=chromium --project=webkit --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts } -WorkingDirectory $Preview
Invoke-NativeGate 'preview performance Chromium' { node scripts/run-playwright-e2e.mjs e2e/restaurateur-preview-performance.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts } -WorkingDirectory $Preview
```

Preview Parity possède sa revue, son diff, ses tests Chromium/WebKit et sa PR distincte. Aucun commit Preview Parity n’est fusionné dans la branche dashboard `feat/admin-vnext-integration` sans instruction utilisateur explicite.

## Handoff obligatoire

- [ ] **Step 1: Rapporter l’état sans action externe**

Le handoff final fournit: `M0`, `B1`, `B2`, `B3`, `B4`; branches et worktrees; fichiers changés par workstream; commits de merge; revues P0/P1; commandes et résultats; Browser QA; migrations locales/éphémères; cleanup; risques résiduels. Il indique explicitement qu’aucun push, PR, merge `main`, déploiement ou migration production n’a été effectué.

- [ ] **Step 2: Attendre l’autorisation suivante**

La branche Integration reste locale et propre à `B4`. Toute publication, PR dashboard, Preview Parity ou opération de production est une décision séparée de l’utilisateur.
