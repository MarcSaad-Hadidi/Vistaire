# Vistaire Admin vNext Final QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire une preuve finale reproductible que les cinq routes Admin vNext respectent leurs contrats de données, sécurité, fidélité, accessibilité, responsive et dégradation sans corriger directement le runtime.

**Architecture:** Le worktree QA naît du SHA `$ExpectedBase` exact après toutes les intégrations fonctionnelles. Il ajoute uniquement des tests transversaux et un rapport de validation. Tout défaut runtime est renvoyé au propriétaire et intégré par Integration; le nouveau HEAD devient un milestone de réparation immuable. Final-QA ne merge jamais le runtime: ses seuls commits tests/docs sont rebasés sur ce nouveau SHA, qui remplace `$ExpectedBase`, avant reprise complète de la matrice.

**Tech Stack:** Node test runner, Playwright Chromium/WebKit, scripts npm existants, Chrome DevTools ou équivalent, Git, documentation Markdown.

## Global Constraints

- Créer `feat/admin-vnext-final-qa` depuis `$ExpectedBase`, le SHA complet exact transmis dans le handoff et contenant Foundation, Data Foundation, les quatre pages de vague 2 et More/Quality. Aucun nom symbolique de milestone n'est utilisé comme ref Git.
- Ownership exclusif : `tests/admin-vnext-acceptance-matrix.test.mjs`, `tests/admin-vnext-data-honesty.test.mjs`, `tests/admin-vnext-runtime-security.test.mjs`, `e2e/admin-vnext-matrix.spec.ts`, `e2e/support/adminVisualFixtureData.ts`, `e2e/support/admin-visual-fixture-server.mjs`, `docs/validation/admin-vnext-final-qa-2026-08-11.md`. Les deux fichiers `e2e/support/**` sont test-only et ne doivent jamais être importés par `app/**`, `components/**`, `lib/**`, `supabase/**` ou `public/**`.
- Ne modifier aucun fichier dans `app/**`, `components/**`, `lib/**`, `supabase/**`, `public/**`, `package.json` ou `package-lock.json`.
- Aucun skip, `test.only`, retry masquant un défaut, mise à jour automatique de snapshot ou assouplissement d'assertion.
- La fixture admin reste synthétique, loopback et sans secret. Ses scénarios fermés sont exactement `available | insufficient | unmeasured | unavailable | error | truncated | cross-scope`, sélectionnés uniquement par `VISTAIRE_ADMIN_FIXTURE_SCENARIO`; aucune URL, requête ou donnée client ne choisit le scénario.
- Toute exécution navigateur admin active `VISTAIRE_ADMIN_VISUAL_FIXTURE=1`, `VISTAIRE_REQUIRE_ADMIN_E2E=1`, un QR fictif déterministe et le reporter `e2e/support/forbid-skipped-tests-reporter.ts`. Les requêtes HTTP(S) sortant de l'origine locale de l'application ou du serveur fixture loopback sont bloquantes.
- Sur défaut runtime, arrêter la matrice, consigner route/état/preuve/propriétaire, envoyer le correctif au worktree propriétaire, attendre son intégration revue, capturer le nouveau SHA immuable, puis rebaser uniquement les commits QA sur ce nouveau `$ExpectedBase` avant de tout réexécuter.
- Les cinq PNG de référence restent hors Git; ne pas copier les fichiers ni les screenshots générés dans le dépôt.
- Ne pas déclarer les migrations validées sans URL non vide, project ref et host éphémères attendus, project ref production distinct explicitement rejeté, identité DB sans secret, logs Postgres isolés et receipts Security/Performance Advisors du même project ref.
- Ne pas déclarer Quick Look iPhone ou Scene Viewer Android validés sans appareils réels; vérifier seulement l'absence de préchargement injustifié et les fallbacks web.
- Le checkout sale historique reste intact.

Au début de chaque session PowerShell Final-QA, exécuter ce bootstrap. Il configure `safe.directory` uniquement pour les trois chemins absolus exacts dans le processus courant, fixe le SHA de base fourni par le handoff et rend chaque commande native fail-fast:

```powershell
$Repo = 'E:\Projet perso\MenuAlive'
$Integration = "$Repo\.worktrees\admin-vnext-integration"
$FinalQa = "$Repo\.worktrees\admin-vnext-final-qa"
$ExpectedBase = '<SHA exact du handoff>'
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ExpectedBase Final-QA doit être un SHA complet' }
$AllowedQaPaths = @(
  'docs/validation/admin-vnext-final-qa-2026-08-11.md'
  'e2e/admin-vnext-matrix.spec.ts'
  'e2e/support/admin-visual-fixture-server.mjs'
  'e2e/support/adminVisualFixtureData.ts'
  'tests/admin-vnext-acceptance-matrix.test.mjs'
  'tests/admin-vnext-data-honesty.test.mjs'
  'tests/admin-vnext-runtime-security.test.mjs'
)

$SafeDirectories = @($Repo, $Integration, $FinalQa)
[Environment]::SetEnvironmentVariable('GIT_CONFIG_COUNT', [string]$SafeDirectories.Count, 'Process')
for ($Index = 0; $Index -lt $SafeDirectories.Count; $Index++) {
  [Environment]::SetEnvironmentVariable("GIT_CONFIG_KEY_$Index", 'safe.directory', 'Process')
  [Environment]::SetEnvironmentVariable("GIT_CONFIG_VALUE_$Index", $SafeDirectories[$Index], 'Process')
}

function Invoke-FinalQaNative {
  param(
    [Parameter(Mandatory)] [string] $Label,
    [Parameter(Mandatory)] [scriptblock] $Command,
    [string] $WorkingDirectory
  )
  if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory -ErrorAction Stop }
  try {
    & $Command
    $ExitCode = $LASTEXITCODE
  } finally {
    if ($WorkingDirectory) { Pop-Location }
  }
  if ($ExitCode -ne 0) { throw "$Label a échoué avec le code $ExitCode" }
}

function Get-FinalQaDatabaseTarget {
  param(
    [Parameter(Mandatory)] [string] $DatabaseUrl,
    [Parameter(Mandatory)] [string] $ExpectedProjectRef,
    [Parameter(Mandatory)] [string] $ExpectedHost,
    [Parameter(Mandatory)] [string] $ProductionProjectRef,
    [Parameter(Mandatory)] [string] $ExpectedDatabaseUsername
  )

  $DatabaseUrl = $DatabaseUrl.Trim()
  $ExpectedProjectRef = $ExpectedProjectRef.Trim()
  $ExpectedHost = $ExpectedHost.Trim()
  $ProductionProjectRef = $ProductionProjectRef.Trim()
  $ExpectedDatabaseUsername = $ExpectedDatabaseUsername.Trim()
  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'URL Postgres éphémère vide' }
  if ([string]::IsNullOrWhiteSpace($ExpectedProjectRef) -or [string]::IsNullOrWhiteSpace($ExpectedHost) -or [string]::IsNullOrWhiteSpace($ExpectedDatabaseUsername)) { throw 'ref/host/username éphémères attendus manquants' }
  if ([string]::IsNullOrWhiteSpace($ProductionProjectRef) -or $ExpectedProjectRef -eq $ProductionProjectRef) { throw 'ref production absente ou identique à la cible' }
  $DatabaseUri = [Uri]$DatabaseUrl
  if ($DatabaseUri.Host -ne $ExpectedHost) { throw "host DB inattendu: $($DatabaseUri.Host)" }
  if ($DatabaseUri.Scheme -notin @('postgres', 'postgresql')) { throw 'URL Postgres éphémère invalide' }
  $UrlUsername = [Uri]::UnescapeDataString(($DatabaseUri.UserInfo -split ':', 2)[0]).Trim()
  if ($DatabaseUri.Host -match [regex]::Escape($ProductionProjectRef) -or $UrlUsername -match [regex]::Escape($ProductionProjectRef)) { throw 'host ou username DB de production rejeté' }
  $IsLocal = $DatabaseUri.Host -in @('localhost', '127.0.0.1', '::1')
  if (-not $IsLocal -and $DatabaseUri.Host -notmatch [regex]::Escape($ExpectedProjectRef) -and $UrlUsername -notmatch [regex]::Escape($ExpectedProjectRef)) { throw 'project ref éphémère non prouvé par host ou username' }
  if ($UrlUsername -ne $ExpectedDatabaseUsername) { throw 'username URL Postgres inattendu' }

  $IdentityRaw = (Invoke-FinalQaNative 'identité DB Final-QA' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -Atc "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text" } | Out-String).Trim()
  $IdentityFields = @($IdentityRaw.Split('|') | ForEach-Object { $_.Trim() })
  if ($IdentityFields.Count -ne 4 -or @($IdentityFields | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -ne 0) { throw 'identité DB invalide: quatre champs non vides attendus' }
  $DatabaseName, $DatabaseUsername, $DatabaseAddress, $DatabasePort = $IdentityFields
  if ($DatabaseUsername -ne $ExpectedDatabaseUsername) { throw 'username DB connecté inattendu' }
  $CanonicalIdentity = $IdentityFields -join '|'

  [pscustomobject]@{
    ProjectRef = $ExpectedProjectRef
    Host = $ExpectedHost
    Username = $DatabaseUsername
    Identity = $CanonicalIdentity
    DatabaseName = $DatabaseName
    Address = $DatabaseAddress
    Port = $DatabasePort
  }
}

function Assert-FinalQaAdvisorReceipt {
  param(
    [Parameter(Mandatory)] [object] $AdvisorReceipt,
    [Parameter(Mandatory)] [string] $ExpectedProjectRef,
    [Parameter(Mandatory)] [string] $ExpectedHead,
    [Parameter(Mandatory)] [string] $ExpectedRuntimeTree,
    [Parameter(Mandatory)] [string] $ExpectedDatabaseIdentity,
    [Parameter(Mandatory)] [string] $ExpectedDatabaseUsername,
    [Parameter(Mandatory)] [string] $AvailabilityMigrationSha256,
    [Parameter(Mandatory)] [string] $AssistantMigrationSha256,
    [Parameter(Mandatory)] [datetimeoffset] $QaStartedAtUtc,
    [Parameter(Mandatory)] [string] $FinalQaRoot
  )

  $ReceiptProjectRef = ([string]$AdvisorReceipt.ProjectRef).Trim()
  $ReceiptEnvironment = ([string]$AdvisorReceipt.Environment).Trim()
  $ReceiptHead = ([string]$AdvisorReceipt.ReviewedHead).Trim()
  $ReceiptRuntimeTree = ([string]$AdvisorReceipt.RuntimeTree).Trim()
  $ReceiptIdentity = ([string]$AdvisorReceipt.DatabaseIdentity).Trim()
  $ReceiptUsername = ([string]$AdvisorReceipt.DatabaseUsername).Trim()
  $ReceiptAvailabilityHash = ([string]$AdvisorReceipt.AvailabilityMigrationSha256).Trim()
  $ReceiptAssistantHash = ([string]$AdvisorReceipt.AssistantMigrationSha256).Trim()
  $ReceiptLogUri = ([string]$AdvisorReceipt.LogUri).Trim()
  if ($ReceiptProjectRef -ne $ExpectedProjectRef.Trim() -or $ReceiptEnvironment -notin @('local', 'ephemeral')) { throw 'receipt advisors sur une autre cible' }
  if ($ReceiptHead -ne $ExpectedHead.Trim() -or $ReceiptRuntimeTree -ne $ExpectedRuntimeTree.Trim()) { throw 'receipt advisors pour un autre HEAD ou runtime tree' }
  if ($ReceiptIdentity -ne $ExpectedDatabaseIdentity.Trim() -or $ReceiptUsername -ne $ExpectedDatabaseUsername.Trim()) { throw 'receipt advisors pour une autre identité DB' }
  if ($ReceiptAvailabilityHash -ne $AvailabilityMigrationSha256.Trim() -or $ReceiptAssistantHash -ne $AssistantMigrationSha256.Trim()) { throw 'receipt advisors pour un autre contenu de migration' }
  if ([string]::IsNullOrWhiteSpace($ReceiptLogUri)) { throw 'LogUri advisors absent' }
  $ParsedLogUri = $null
  if (-not [Uri]::TryCreate($ReceiptLogUri, [UriKind]::Absolute, [ref]$ParsedLogUri)) { throw 'LogUri advisors non absolu' }
  if (-not [string]::IsNullOrEmpty($ParsedLogUri.UserInfo)) { throw 'credentials interdits dans LogUri' }
  if ($ParsedLogUri.IsFile) {
    $RepositoryPrefix = [IO.Path]::GetFullPath($FinalQaRoot).TrimEnd('\') + '\'
    $ResolvedLogPath = [IO.Path]::GetFullPath($ParsedLogUri.LocalPath)
    if ($ResolvedLogPath.StartsWith($RepositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'logs advisors interdits dans le dépôt' }
  }
  $SecurityCompletedAtUtc = [datetimeoffset]::Parse(([string]$AdvisorReceipt.SecurityCompletedAtUtc).Trim())
  $PerformanceCompletedAtUtc = [datetimeoffset]::Parse(([string]$AdvisorReceipt.PerformanceCompletedAtUtc).Trim())
  $NowUtc = [datetimeoffset]::UtcNow
  if ($SecurityCompletedAtUtc -lt $QaStartedAtUtc -or $PerformanceCompletedAtUtc -lt $QaStartedAtUtc -or $SecurityCompletedAtUtc -gt $NowUtc.AddMinutes(5) -or $PerformanceCompletedAtUtc -gt $NowUtc.AddMinutes(5)) { throw 'receipts advisors non frais pour cette séquence QA' }
  if ([int]$AdvisorReceipt.OpenP0 -ne 0 -or [int]$AdvisorReceipt.OpenP1 -ne 0) { throw 'advisors avec P0/P1 ouverts' }
  Write-Host "DB et advisors vérifiés: ref=$ReceiptProjectRef identity=$ReceiptIdentity"
}
```

---

### Task 1: Capturer le manifeste d'intégration

**Files:**
- Create: `docs/validation/admin-vnext-final-qa-2026-08-11.md`

- [ ] **Step 1: Enregistrer la base et les branches intégrées**

Consigner `$ExpectedBase`, les merge commits Foundation/Data/Today/Availability/Intelligence/Reports/More, les SHA propriétaires et l'heure UTC. Vérifier :

```powershell
Invoke-FinalQaNative 'status manifeste QA' { git -C $FinalQa status --short --branch }
$ActualBase = Invoke-FinalQaNative 'merge-base manifeste QA' { git -C $FinalQa merge-base HEAD $ExpectedBase }
if (($ActualBase | Out-String).Trim() -ne $ExpectedBase) { throw 'Final-QA ne descend pas de ExpectedBase' }
Invoke-FinalQaNative 'log manifeste QA' { git -C $FinalQa log --first-parent --oneline "$ExpectedBase..HEAD" }
Invoke-FinalQaNative 'diff-check manifeste QA' { git -C $FinalQa diff --check "$ExpectedBase...HEAD" }
```

Expected: worktree propre avant le rapport et ancestry explicite.

- [ ] **Step 2: Enregistrer les capacités conditionnelles**

Pour availability scheduling et assistant Mistral, noter séparément version schéma/RPC, feature flag booléen, heartbeat/limiteur, gate Postgres et advisor. Ne jamais enregistrer la valeur d'un secret.

- [ ] **Step 3: Enregistrer les références visuelles**

Consigner dimensions `1448 × 1086`, taille et SHA-256 des cinq fichiers externes sans les ajouter au dépôt.

- [ ] **Step 4: Commit du squelette factuel**

```powershell
Invoke-FinalQaNative 'stage squelette QA' { git -C $FinalQa add docs/validation/admin-vnext-final-qa-2026-08-11.md }
Invoke-FinalQaNative 'commit squelette QA' { git -C $FinalQa commit -m "docs(admin): start vnext final validation" }
```

### Task 2: Écrire la matrice de contrat source

**Files:**
- Create: `tests/admin-vnext-acceptance-matrix.test.mjs`
- Create: `tests/admin-vnext-data-honesty.test.mjs`
- Create: `tests/admin-vnext-runtime-security.test.mjs`

- [ ] **Step 1: Écrire les tests d'acceptation structurelle**

Vérifier cinq routes/IDs, locale et thème SSR, navigation desktop/mobile, liens publics, absence de 404 statique, ownership des imports, aucun accès Supabase direct depuis les pages et aucune fixture/donnée démo dans le runtime admin.

- [ ] **Step 2: Écrire les tests de vérité des données**

Vérifier scope obligatoire, timezone avec provenance, union d'états, valeur uniquement dans `available`, registre partagé UI/export/Mistral, k=3 courant/précédent, absence de raw/session IDs, métriques non instrumentées `unmeasured`, interdiction CA/ventes/commandes/conversion et wording observé.

- [ ] **Step 3: Écrire les tests de sécurité runtime**

Vérifier service-role server-only, anti-spoofing headers, same-origin mutations, accès live, dish/category scoped, CSV formula injection, Mistral claims-only, quota fail-closed, aucun secret dans réponse/log source, scheduling capability complète et preview publique sans import admin privé.

- [ ] **Step 4: Exécuter RED puis classifier les échecs**

```powershell
Invoke-FinalQaNative 'RED contrats QA' { node --test tests/admin-vnext-acceptance-matrix.test.mjs tests/admin-vnext-data-honesty.test.mjs tests/admin-vnext-runtime-security.test.mjs } -WorkingDirectory $FinalQa
```

Expected: les tests peuvent révéler des défauts. Pour chaque défaut de production, ne pas éditer le runtime; assigner Foundation, Data Foundation, Today, Availability, Intelligence, Reports ou More/Quality.

- [ ] **Step 5: Après réintégration des corrections propriétaires, exiger GREEN et commit**

```powershell
$PreviousExpectedBase = $ExpectedBase
$RepairedBase = (Invoke-FinalQaNative 'capture base réparée' { git -C $Integration rev-parse HEAD } | Out-String).Trim()
if ($RepairedBase -notmatch '^[0-9a-f]{40}$') { throw 'base réparée invalide' }
if ($RepairedBase -eq $PreviousExpectedBase) { throw 'aucune nouvelle base réparée à revalider' }
Invoke-FinalQaNative 'ascendance Integration réparée' { git -C $Integration merge-base --is-ancestor $PreviousExpectedBase $RepairedBase }
Invoke-FinalQaNative 'ascendance branche QA avant rebase' { git -C $FinalQa merge-base --is-ancestor $PreviousExpectedBase HEAD }
$CurrentQaBranch = (Invoke-FinalQaNative 'branche QA avant rebase' { git -C $FinalQa rev-parse --abbrev-ref HEAD } | Out-String).Trim()
if ($CurrentQaBranch -ne 'feat/admin-vnext-final-qa') { throw "branche Final-QA inattendue: $CurrentQaBranch" }
try {
  Invoke-FinalQaNative 'rebase commits QA-only' { git -C $FinalQa rebase --onto $RepairedBase $PreviousExpectedBase feat/admin-vnext-final-qa }
} catch {
  Invoke-FinalQaNative 'abort rebase QA' { git -C $FinalQa rebase --abort }
  throw
}
$ExpectedBase = $RepairedBase
$QaPathsAfterRebase = @(Invoke-FinalQaNative 'vérifier diff QA-only' { git -C $FinalQa diff --name-only "$ExpectedBase...HEAD" } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$UnexpectedQaPaths = @($QaPathsAfterRebase | Where-Object { $_ -notin $AllowedQaPaths })
if ($UnexpectedQaPaths.Count -ne 0) { throw "fichier hors ownership Final-QA: $($UnexpectedQaPaths -join ', ')" }
Invoke-FinalQaNative 'GREEN contrats QA' { node --test tests/admin-vnext-acceptance-matrix.test.mjs tests/admin-vnext-data-honesty.test.mjs tests/admin-vnext-runtime-security.test.mjs } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'stage contrats QA' { git -C $FinalQa add tests/admin-vnext-acceptance-matrix.test.mjs tests/admin-vnext-data-honesty.test.mjs tests/admin-vnext-runtime-security.test.mjs }
Invoke-FinalQaNative 'commit contrats QA' { git -C $FinalQa commit -m "test(admin): enforce vnext acceptance contracts" }
```

### Task 3: Écrire la matrice navigateur

**Files:**
- Create: `e2e/admin-vnext-matrix.spec.ts`
- Modify: `e2e/support/adminVisualFixtureData.ts`
- Modify: `e2e/support/admin-visual-fixture-server.mjs`

- [ ] **Step 1: Étendre la fixture test-only avec sept scénarios synthétiques**

Définir exactement `available | insufficient | unmeasured | unavailable | error | truncated | cross-scope` dans `adminVisualFixtureData.ts`. Chaque scénario utilise des UUID, domaines, noms de restaurants, plats, timestamps et métriques fictifs distincts et déterministes; aucune valeur ne provient d'une base, d'un export, d'un log ou d'un compte réel. `available` fournit le bundle autorisé complet, `insufficient` reste sous les seuils publiables, `unmeasured` omet explicitement l'instrumentation, `unavailable` retire la capacité/source, `error` produit uniquement les erreurs backend déterministes attendues, `truncated` fournit une ligne synthétique au-delà de la limite annoncée et `cross-scope` mêle un second restaurant fictif afin de prouver son exclusion de l'UI, des exports et de Mistral.

Le serveur fixture écoute exclusivement sur `127.0.0.1`, rejette un `Host` non loopback et choisit le scénario exclusivement depuis `VISTAIRE_ADMIN_FIXTURE_SCENARIO`. Aucun paramètre URL, header, cookie, body ou identifiant fourni par le navigateur ne peut sélectionner ou enrichir un scénario. Les fichiers restent importables uniquement par Playwright/configuration test, jamais par le runtime.

- [ ] **Step 2: Couvrir les cinq routes et états**

Pour chaque route, tester les sept scénarios lorsque le panneau y est sensible. Vérifier les transitions de navigation, refresh, back/forward, URL canonique, la distinction visible entre absence, non-mesure et erreur, ainsi que l'absence de données cross-restaurant dans la fixture adversariale.

- [ ] **Step 3: Couvrir responsive, thème et langue**

Exécuter `390 × 844`, `430 × 932`, tablette `768 × 1024` et desktop `1448 × 1086`; FR/EN; clair/sombre; préférence persistée; aucun flash incohérent, débordement horizontal ou contenu masqué par la bottom nav.

- [ ] **Step 4: Couvrir accessibilité**

Tester skip link, ordre de focus, focus visible, Escape/drawer, restauration du focus, noms accessibles, live regions, contraste des tokens, zoom 200 %, reduced motion et équivalent textuel des graphiques.

- [ ] **Step 5: Couvrir réseau et performance**

Installer avant navigation un garde réseau qui autorise seulement l'origine locale exacte de l'application et l'origine exacte du serveur fixture `127.0.0.1`; toute autre requête HTTP(S), notamment Supabase, analytics ou API externe, fait échouer le test. Échouer aussi sur console error inattendue, 404, 500 hors réponse déterministe explicitement attendue par le scénario `error`, asset manquant, GLB/USDZ avant intention ou bundle manifestement régressif. Utiliser les budgets du test `e2e/admin-performance.spec.ts` comme seuils existants, sans les relâcher.

- [ ] **Step 6: Exécuter la matrice et les sept specs canoniques sans skip**

```powershell
$AdminEnvNames = @('VISTAIRE_ADMIN_VISUAL_FIXTURE', 'VISTAIRE_REQUIRE_ADMIN_E2E', 'VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'VISTAIRE_ADMIN_E2E_QR_TOKEN')
$PreviousAdminEnv = @{}
foreach ($AdminEnvName in $AdminEnvNames) {
  $PreviousAdminEnv[$AdminEnvName] = [Environment]::GetEnvironmentVariable($AdminEnvName, 'Process')
}
try {
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_VISUAL_FIXTURE', '1', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_REQUIRE_ADMIN_E2E', '1', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_E2E_QR_TOKEN', '15000000-0000-0000-0000-000000000150', 'Process')
  $FixtureScenarios = @('available', 'insufficient', 'unmeasured', 'unavailable', 'error', 'truncated', 'cross-scope')
  foreach ($FixtureScenario in $FixtureScenarios) {
    [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_FIXTURE_SCENARIO', $FixtureScenario, 'Process')
    Invoke-FinalQaNative "matrice navigateur QA scénario $FixtureScenario" { node scripts/run-playwright-e2e.mjs e2e/admin-vnext-matrix.spec.ts --build --project=chromium --project=webkit --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts } -WorkingDirectory $FinalQa
  }
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'available', 'Process')
  Invoke-FinalQaNative 'sept specs Chromium/WebKit QA' { node scripts/run-playwright-e2e.mjs e2e/admin-vnext-today.spec.ts e2e/admin-vnext-availability.spec.ts e2e/admin-insights.spec.ts e2e/admin-insights-fidelity.spec.ts e2e/admin-vnext-assistant.spec.ts e2e/admin-vnext-reports.spec.ts e2e/admin-vnext-more-quality.spec.ts --build --project=chromium --project=webkit --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts } -WorkingDirectory $FinalQa
} finally {
  foreach ($AdminEnvName in $AdminEnvNames) {
    [Environment]::SetEnvironmentVariable($AdminEnvName, $PreviousAdminEnv[$AdminEnvName], 'Process')
  }
}
```

Expected: succès sans skip. Toute panne fonctionnelle repart au propriétaire.

- [ ] **Step 7: Commit**

```powershell
Invoke-FinalQaNative 'stage matrice navigateur QA' { git -C $FinalQa add e2e/admin-vnext-matrix.spec.ts e2e/support/adminVisualFixtureData.ts e2e/support/admin-visual-fixture-server.mjs }
Invoke-FinalQaNative 'commit matrice navigateur QA' { git -C $FinalQa commit -m "test(admin): cover vnext browser matrix" }
```

### Task 4: Réaliser la revue visuelle contre les références

**Files:**
- Modify: `docs/validation/admin-vnext-final-qa-2026-08-11.md`

- [ ] **Step 1: Capturer localement les cinq routes à taille native**

Utiliser `1448 × 1086`, thème clair, FR et fixture déterministe correspondant uniquement aux métriques supportées. Conserver les captures dans `test-results/admin-vnext-visual-review/`, jamais dans Git.

- [ ] **Step 2: Comparer chaque référence par zones**

Évaluer sidebar/en-tête, rythme vertical, grille, typographie, surfaces, états, charts, densité et alignement. Les différences causées par une donnée absente sont acceptables si l'état d'absence conserve la hiérarchie; aucun faux chiffre ne doit être ajouté pour obtenir la ressemblance.

- [ ] **Step 3: Répéter le contrôle en sombre et mobile**

Le sombre est une extension cohérente sans référence fournie; vérifier chaleur, contraste et photos. À `390/430`, vérifier ordre de lecture, bottom nav, tables transformées et drawer.

- [ ] **Step 4: Enregistrer constats et décisions**

Dans le rapport, noter par route `pass|blocked|fail`, écart, preuve et propriétaire. Ne pas incorporer les images de référence ou captures.

- [ ] **Step 5: Supprimer les captures temporaires après revue**

Valider le chemin résolu sous le worktree QA, puis supprimer `test-results/admin-vnext-visual-review/` et confirmer qu'aucune image/vidéo/trace n'est suivie.

### Task 5: Exécuter les gates complets

**Files:**
- Modify: `docs/validation/admin-vnext-final-qa-2026-08-11.md`

- [ ] **Step 1: Exécuter les contrôles repository et compilation**

```powershell
Invoke-FinalQaNative 'assets Final-QA' { npm run assets:check } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'lfs Final-QA' { npm run lfs:check } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'lint Final-QA' { npm run lint } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'typecheck Final-QA' { npm run typecheck } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'build Final-QA' { npm run build } -WorkingDirectory $FinalQa
```

- [ ] **Step 2: Exécuter les suites métier**

```powershell
Invoke-FinalQaNative 'test:admin Final-QA' { npm run test:admin } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'test:admin:qr Final-QA' { npm run test:admin:qr } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'test:admin:full-menu Final-QA' { npm run test:admin:full-menu } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'preview node Final-QA' { npm run test:restaurateur-preview:node } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'e2e Final-QA' { npm run test:e2e } -WorkingDirectory $FinalQa
```

- [ ] **Step 3: Exécuter les gates Postgres**

```powershell
$QaDatabaseStartedAtUtc = [datetimeoffset]::UtcNow
$DatabaseUrl = ([string]$env:ADMIN_VNEXT_EPHEMERAL_DATABASE_URL).Trim()
$ExpectedProjectRef = ([string]$env:ADMIN_VNEXT_EPHEMERAL_PROJECT_REF).Trim()
$ExpectedHost = ([string]$env:ADMIN_VNEXT_EXPECTED_DB_HOST).Trim()
$ExpectedDatabaseUsername = ([string]$env:ADMIN_VNEXT_EXPECTED_DB_USERNAME).Trim()
$ProductionProjectRef = ([string]$env:ADMIN_VNEXT_PRODUCTION_PROJECT_REF).Trim()
$AdvisorEvidencePath = ([string]$env:ADMIN_VNEXT_ADVISOR_EVIDENCE_JSON).Trim()
$ExpectedRuntimeTree = (Invoke-FinalQaNative 'runtime tree exact Final-QA' { git -C $FinalQa rev-parse "$ExpectedBase^{tree}" } | Out-String).Trim()
if ($ExpectedRuntimeTree -notmatch '^[0-9a-f]{40}$') { throw 'runtime tree Final-QA invalide' }
$AvailabilityMigrationSha256 = (Get-FileHash -LiteralPath "$FinalQa\supabase\migrations\20260811190000_admin_availability_schedule.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
$AssistantMigrationSha256 = (Get-FileHash -LiteralPath "$FinalQa\supabase\migrations\20260811200000_admin_assistant_rate_limit.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
$DatabaseTarget = Get-FinalQaDatabaseTarget -DatabaseUrl $DatabaseUrl -ExpectedProjectRef $ExpectedProjectRef -ExpectedHost $ExpectedHost -ProductionProjectRef $ProductionProjectRef -ExpectedDatabaseUsername $ExpectedDatabaseUsername
Invoke-FinalQaNative 'migration Availability Final-QA' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f supabase/migrations/20260811190000_admin_availability_schedule.sql } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'SQL Availability Final-QA' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f tests/postgres/admin-availability-scheduling/run.sql } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'migration quota IA Final-QA' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f supabase/migrations/20260811200000_admin_assistant_rate_limit.sql } -WorkingDirectory $FinalQa
Invoke-FinalQaNative 'SQL quota IA Final-QA' { psql -X --no-psqlrc $DatabaseUrl -v ON_ERROR_STOP=1 -f tests/postgres/admin-assistant-rate-limit/run.sql } -WorkingDirectory $FinalQa
```

Après les deux migrations et leurs tests, et jamais avant, exécuter les Security Advisors puis les Performance Advisors sur `$ExpectedProjectRef`. Exporter leur résultat frais dans le chemin absolu hors dépôt fourni par `ADMIN_VNEXT_ADVISOR_EVIDENCE_JSON`. Le JSON contient exactement le project ref, `Environment`, `ReviewedHead`, `RuntimeTree`, les deux SHA-256 de migration, `DatabaseIdentity`, `DatabaseUsername`, les deux horodatages UTC, `OpenP0`, `OpenP1` et un `LogUri` isolé; il ne contient ni URL Postgres, ni mot de passe, ni token. Construire et valider le receipt seulement après cet export :

```powershell
if ([string]::IsNullOrWhiteSpace($AdvisorEvidencePath)) { throw 'chemin evidence advisors absent' }
$ResolvedAdvisorEvidencePath = (Resolve-Path -LiteralPath $AdvisorEvidencePath -ErrorAction Stop).Path
$FinalQaPrefix = [IO.Path]::GetFullPath($FinalQa).TrimEnd('\') + '\'
if ($ResolvedAdvisorEvidencePath.StartsWith($FinalQaPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'evidence advisors interdite dans le dépôt' }
$AdvisorEvidenceFile = Get-Item -LiteralPath $ResolvedAdvisorEvidencePath -ErrorAction Stop
if ($AdvisorEvidenceFile.LastWriteTimeUtc -lt $QaDatabaseStartedAtUtc.UtcDateTime) { throw 'evidence advisors antérieure à cette séquence QA' }
$AdvisorEvidence = Get-Content -LiteralPath $ResolvedAdvisorEvidencePath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
$FinalQaAdvisorReceipt = [pscustomobject]@{
  ProjectRef = ([string]$AdvisorEvidence.ProjectRef).Trim()
  Environment = ([string]$AdvisorEvidence.Environment).Trim()
  ReviewedHead = ([string]$AdvisorEvidence.ReviewedHead).Trim()
  RuntimeTree = ([string]$AdvisorEvidence.RuntimeTree).Trim()
  AvailabilityMigrationSha256 = ([string]$AdvisorEvidence.AvailabilityMigrationSha256).Trim()
  AssistantMigrationSha256 = ([string]$AdvisorEvidence.AssistantMigrationSha256).Trim()
  DatabaseIdentity = ([string]$AdvisorEvidence.DatabaseIdentity).Trim()
  DatabaseUsername = ([string]$AdvisorEvidence.DatabaseUsername).Trim()
  SecurityCompletedAtUtc = ([string]$AdvisorEvidence.SecurityCompletedAtUtc).Trim()
  PerformanceCompletedAtUtc = ([string]$AdvisorEvidence.PerformanceCompletedAtUtc).Trim()
  OpenP0 = [int]$AdvisorEvidence.OpenP0
  OpenP1 = [int]$AdvisorEvidence.OpenP1
  LogUri = ([string]$AdvisorEvidence.LogUri).Trim()
}
Assert-FinalQaAdvisorReceipt -AdvisorReceipt $FinalQaAdvisorReceipt -ExpectedProjectRef $ExpectedProjectRef -ExpectedHead $ExpectedBase -ExpectedRuntimeTree $ExpectedRuntimeTree -ExpectedDatabaseIdentity $DatabaseTarget.Identity -ExpectedDatabaseUsername $ExpectedDatabaseUsername -AvailabilityMigrationSha256 $AvailabilityMigrationSha256 -AssistantMigrationSha256 $AssistantMigrationSha256 -QaStartedAtUtc $QaDatabaseStartedAtUtc -FinalQaRoot $FinalQa
```

Expected: identité à quatre champs `database|username|address|port`, chacun normalisé par `Trim()`, migrations et tests exécutés dans cet ordre sur la cible isolée, puis advisors frais sans P0/P1. Un receipt ancien ou lié à un autre project ref, username, identité, HEAD, runtime tree ou contenu de migration est rejeté. Si l'environnement ou le receipt manque, le rapport reste `blocked` pour les capacités concernées et aucune activation production n'est recommandée.

- [ ] **Step 4: Enregistrer chaque commande**

Consigner date, SHA, commande exacte, durée, compte de tests et résultat. Un résultat ancien d'une branche propriétaire ne remplace pas le résultat sur le HEAD QA final.

### Task 6: Clore ou bloquer honnêtement la QA

**Files:**
- Modify: `docs/validation/admin-vnext-final-qa-2026-08-11.md`

- [ ] **Step 1: Vérifier le worktree et les artefacts**

Supprimer `.next`, `test-results`, `playwright-report`, screenshots, vidéos, traces et logs générés non destinés au dépôt, après validation de leurs chemins. Puis :

```powershell
Invoke-FinalQaNative 'status cleanup QA' { git -C $FinalQa status --short }
Invoke-FinalQaNative 'diff-check cleanup QA' { git -C $FinalQa diff --check "$ExpectedBase...HEAD" }
$QaPaths = @(Invoke-FinalQaNative 'diff paths cleanup QA' { git -C $FinalQa diff --name-only "$ExpectedBase...HEAD" } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$UnexpectedQaPaths = @($QaPaths | Where-Object { $_ -notin $AllowedQaPaths })
$MissingQaPaths = @($AllowedQaPaths | Where-Object { $_ -notin $QaPaths })
if ($UnexpectedQaPaths.Count -ne 0 -or $MissingQaPaths.Count -ne 0) { throw "diff QA non conforme; hors ownership=$($UnexpectedQaPaths -join ', '); manquants=$($MissingQaPaths -join ', ')" }
```

Expected: `$QaPaths` contient exactement les sept fichiers QA autorisés, y compris les deux supports fixture test-only, sans fichier manquant ni chemin supplémentaire.

- [ ] **Step 2: Vérifier secrets et assets**

Confirmer qu'aucun `.env`, secret, log debug, PNG de référence, capture, vidéo ou asset lourd n'est ajouté.

- [ ] **Step 3: Émettre un verdict conditionnel**

`PASS` exige tous les gates applicables verts et aucun P0/P1. `BLOCKED` nomme exactement l'environnement ou capacité manquante. `FAIL` nomme le contrat violé et son propriétaire. Ne jamais convertir un blocked en pass.

- [ ] **Step 4: Commit final documentaire**

```powershell
Invoke-FinalQaNative 'stage verdict QA' { git -C $FinalQa add docs/validation/admin-vnext-final-qa-2026-08-11.md }
Invoke-FinalQaNative 'commit verdict QA' { git -C $FinalQa commit -m "docs(admin): record vnext final validation" }
```

- [ ] **Step 5: Arrêter avant toute publication**

Ne pas push, créer de PR, merger vers `main`, appliquer de migration ou déployer. Remettre le rapport et les SHA au décideur pour autorisation explicite.
