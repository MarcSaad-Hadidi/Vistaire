# Vistaire Admin vNext Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recomposer `/admin` comme centre du service fidèle à `1.png`, mobile-first et entièrement alimenté par les preuves honnêtes de Data Foundation.

**Architecture:** La page serveur charge le bundle v2 depuis l'accès validé, le projette vers un view model pur puis compose exclusivement les primitives Foundation. Aucun événement brut, calcul de métrique, accès Supabase ou mutation n'entre dans ce workstream; les quick actions sont des navigations uniquement.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS modules/primitives Foundation, Node test runner, Playwright.

## Global Constraints

- Définir `$ExpectedBase` au SHA Git complet exact transmis par l'intégrateur, vérifier `git rev-parse --verify "$ExpectedBase^{commit}"`, puis créer `feat/admin-vnext-today` depuis ce commit contenant Foundation et Data Foundation revues sans P0/P1. Refuser tout alias symbolique ou SHA déduit localement.
- Ownership exclusif : `app/admin/page.tsx`, `components/admin/today/**`, `tests/admin-vnext-today.test.mjs`, `e2e/admin-vnext-today.spec.ts`.
- Ne modifier ni `components/admin/system/**`, ni `components/admin/charts/**`, ni `lib/admin/data/**`, ni `lib/admin/analytics*`, ni `lib/analytics/**`, ni `package.json`, ni `package-lock.json`.
- Les états `unmeasured`, `insufficient`, `unavailable`, `error` et `truncated` restent visibles et localisés; aucun `?? 0` ni fixture dans le runtime.
- Employer « observé », « interaction » ou « session observée » selon le contrat de preuve; ne jamais écrire clients uniques, ventes, CA ou conversion commerciale.
- Vérifier d'abord `390 px` et `430 px`, puis tablette et `1448 × 1086`.
- Une action rapide est exclusivement un lien de navigation vers une route autorisée. Today ne déclenche aucune mutation, ne rend aucun formulaire d'action et ne présente aucun succès opérationnel.
- La spec Playwright Today est locale et déterministe : elle ne lit jamais `VISTAIRE_ADMIN_E2E_QR_TOKEN`, ne contient aucun `test.skip`, `test.fixme` ou branche conditionnelle vide, et installe avant navigation un garde qui autorise uniquement l'origine locale exacte de l'application et l'origine loopback exacte de la fixture. Le runner peut fixer un QR fictif pour le harness partagé, mais toute autre requête HTTP(S), tout skip ou tout test sans assertions bloque la preuve.

La session PowerShell d'exécution définit d'abord ce helper local. Toute commande native GREEN, gate, staging ou commit passe par lui depuis le worktree absolu Today. Un RED utilise `-ExpectFailure -ExpectedExitCode 1`: seul le code `1` attendu est accepté; un succès ou tout autre code est bloquant.

```powershell
$PlanWorktree = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-today'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ADMIN_VNEXT_EXPECTED_BASE_SHA doit être un SHA complet' }

function Invoke-PlanNative {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command,
    [switch]$ExpectFailure,
    [int]$ExpectedExitCode = 1
  )

  $Pushed = $false
  $PreviousErrorActionPreference = $ErrorActionPreference
  try {
    Push-Location -LiteralPath $PlanWorktree -ErrorAction Stop
    $Pushed = $true

    $ErrorActionPreference = "Stop"
    & $Command
    $ExitCode = $LASTEXITCODE

    if ($ExpectFailure) {
      if ($ExitCode -ne $ExpectedExitCode) {
        throw "$Label devait échouer en RED avec exit=$ExpectedExitCode, exit observé=$ExitCode."
      }
      Write-Output "$Label : échec RED attendu observé (exit=$ExitCode)."
      return
    }

    if ($ExitCode -ne 0) {
      throw "$Label a échoué (exit=$ExitCode)."
    }
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
    if ($Pushed) {
      Pop-Location
    }
  }
}

$VerifiedBase = (Invoke-PlanNative 'vérifier ExpectedBase Today' { git rev-parse --verify "$ExpectedBase^{commit}" } | Out-String).Trim()
$ActualHead = (Invoke-PlanNative 'HEAD initial Today' { git rev-parse HEAD } | Out-String).Trim()
$ActualBase = (Invoke-PlanNative 'merge-base initial Today' { git merge-base HEAD $ExpectedBase } | Out-String).Trim()
if ($VerifiedBase -ne $ExpectedBase -or $ActualHead -ne $ExpectedBase -or $ActualBase -ne $ExpectedBase) { throw 'Today doit démarrer exactement depuis ExpectedBase avant toute édition' }
```

---

### Task 1: Figer le view model Today

**Files:**
- Create: `components/admin/today/todayViewModel.ts`
- Create: `components/admin/today/todayCopy.ts`
- Test: `tests/admin-vnext-today.test.mjs`

**Interfaces:**

```ts
export type TodayViewModel = Readonly<{
  locale: "fr" | "en";
  generatedAt: string;
  briefing: readonly TodayBriefingItem[];
  pulse: readonly TodayMetricCard[];
  activity: TodayPanelState<TodayActivityModel>;
  alerts: TodayPanelState<readonly TodayAlertItem[]>;
  topDishes: TodayPanelState<readonly TodayDishRank[]>;
  timeline: TodayPanelState<readonly TodayTimelineItem[]>;
  searches: TodayPanelState<readonly TodaySearchItem[]>;
  menuHealth: TodayMenuHealthModel;
}>;

export function buildTodayViewModel(input: {
  locale: "fr" | "en";
  bundle: AdminEvidenceBundle;
}): TodayViewModel;
```

- [ ] **Step 1: Écrire les tests RED du mapping des états**

Tester un bundle `available`, chaque état non disponible, une série tronquée, un baseline nul avec `changeRate: null`, l'absence de métrique commerciale et l'identité des valeurs issues du registre.

Run:

```powershell
Invoke-PlanNative 'RED view model Today' { node --test tests/admin-vnext-today.test.mjs } -ExpectFailure
```

Expected: échec parce que `todayViewModel.ts` n'existe pas.

- [ ] **Step 2: Implémenter le view model pur et les copies FR/EN**

Chaque carte conserve `evidenceId`, état, label localisé, valeur déjà formatable et provenance résumée. Le mapper n'agrège rien et ne transforme aucun état en zéro.

- [ ] **Step 3: Relancer le test ciblé**

Expected: tous les cas du view model passent.

- [ ] **Step 4: Commit**

```powershell
Invoke-PlanNative 'stage view model Today' { git add components/admin/today/todayViewModel.ts components/admin/today/todayCopy.ts tests/admin-vnext-today.test.mjs }
Invoke-PlanNative 'commit view model Today' { git commit -m "test(admin): define honest today view model" }
```

### Task 2: Construire les sections Today accessibles

**Files:**
- Create: `components/admin/today/AdminTodayPage.tsx`
- Create: `components/admin/today/AdminToday.module.css`
- Create: `components/admin/today/TodayBriefing.tsx`
- Create: `components/admin/today/TodayPulse.tsx`
- Create: `components/admin/today/TodayActivity.tsx`
- Create: `components/admin/today/TodayAlerts.tsx`
- Create: `components/admin/today/TodayTopDishes.tsx`
- Create: `components/admin/today/TodayTimeline.tsx`
- Create: `components/admin/today/TodaySearches.tsx`
- Create: `components/admin/today/TodayMenuHealth.tsx`
- Create: `components/admin/today/TodayQuickActions.tsx`
- Test: `tests/admin-vnext-today.test.mjs`

- [ ] **Step 1: Ajouter des assertions RED de structure source**

Prouver la présence d'un `h1` unique, de régions nommées, de valeurs textuelles accompagnant les graphiques, de liens réels pour les actions, de `aria-live` pour les erreurs et l'absence d'import Supabase, raw events, données démo ou styles système modifiés. Exiger que `TodayQuickActions` ne contienne ni `form`, ni bouton de mutation, ni appel `fetch`, Server Action ou import de route/mutateur.

- [ ] **Step 2: Implémenter les composants avec les primitives Foundation**

Reproduire la hiérarchie de `1.png`: briefing, pulse, six cartes, activité/alertes/top plats, chronologie/recherches/santé/actions. Une section sans preuve rend `AdminMetricStatePanel` avec explication localisée. Les listes longues sont bornées par le view model et reliées à leur destination détaillée. Chaque quick action est un `<Link>` vers une route canonique Foundation; aucune action n'écrit de donnée depuis Today.

- [ ] **Step 3: Implémenter le layout mobile-first**

À `390/430`, toutes les sections suivent le flux document, les listes restent lisibles, aucune largeur fixe desktop ne subsiste et la bottom nav Foundation conserve son espace sûr. À desktop, utiliser la grille et le rythme de la référence sans dupliquer les tokens.

- [ ] **Step 4: Exécuter les tests ciblés et le typecheck**

```powershell
Invoke-PlanNative 'tests composants Today' { node --test tests/admin-vnext-today.test.mjs }
Invoke-PlanNative 'typecheck composants Today' { npm run typecheck }
```

Expected: succès sans type assertion contournant le registre.

- [ ] **Step 5: Commit**

```powershell
Invoke-PlanNative 'stage composants Today' { git add components/admin/today tests/admin-vnext-today.test.mjs }
Invoke-PlanNative 'commit composants Today' { git commit -m "feat(admin): build today service center" }
```

### Task 3: Brancher la route serveur

**Files:**
- Modify: `app/admin/page.tsx`
- Test: `tests/admin-vnext-today.test.mjs`

- [ ] **Step 1: Écrire le test RED du flux serveur**

Le test source exige `requireAdminRestaurantAccess`, le parsing allowlisté de `AdminRange`, `loadAdminDataBundle`, `buildTodayViewModel` et `activeRoute="today"`. Il interdit restaurant/menu/source depuis les search params et toute importation de fixture.

- [ ] **Step 2: Remplacer l'assemblage historique par le bundle v2**

La page reçoit l'accès validé, charge une seule fois le bundle, construit le view model et rend `AdminTodayPage`. Les erreurs du loader passent au composant d'état prévu; aucune exception détaillée n'est exposée.

- [ ] **Step 3: Exécuter les contrats Today et admin**

```powershell
Invoke-PlanNative 'tests route Today' { node --test tests/admin-vnext-today.test.mjs }
Invoke-PlanNative 'suite admin route Today' { npm run test:admin }
Invoke-PlanNative 'lint route Today' { npm run lint }
Invoke-PlanNative 'typecheck route Today' { npm run typecheck }
```

Expected: tous les contrats passent et les pages historiques Availability/Insights compilent encore.

- [ ] **Step 4: Commit**

```powershell
Invoke-PlanNative 'stage route Today' { git add app/admin/page.tsx tests/admin-vnext-today.test.mjs }
Invoke-PlanNative 'commit route Today' { git commit -m "feat(admin): connect today to evidence registry" }
```

### Task 4: Valider le comportement et la fidélité

**Files:**
- Create: `e2e/admin-vnext-today.spec.ts`

- [ ] **Step 1: Écrire les scénarios Playwright RED**

Couvrir FR/EN, clair/sombre, états available/unmeasured/error, navigation clavier, actions rapides, `390`, `430`, tablette et `1448 × 1086`. La spec construit ses données depuis la fixture locale `available`, sans lire le QR token, sans `skip`, `fixme`, branche vide ou fallback vers un backend. Vérifier que chaque quick action effectue seulement une navigation GET vers une route allowlistée et qu'aucune requête POST/PATCH/PUT/DELETE n'est émise. Installer le garde réseau loopback-only avant la première navigation; intercepter la console, les réponses 404/500 et toute requête GLB/USDZ ou endpoint assistant inattendu.

- [ ] **Step 2: Exécuter le scénario contre la fixture admin déterministe**

```powershell
$AdminEnvNames = @('VISTAIRE_ADMIN_VISUAL_FIXTURE', 'VISTAIRE_REQUIRE_ADMIN_E2E', 'VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'VISTAIRE_ADMIN_E2E_QR_TOKEN')
$PreviousAdminEnv = @{}
foreach ($AdminEnvName in $AdminEnvNames) {
  $PreviousAdminEnv[$AdminEnvName] = [Environment]::GetEnvironmentVariable($AdminEnvName, 'Process')
}
try {
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_VISUAL_FIXTURE', '1', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_REQUIRE_ADMIN_E2E', '1', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'available', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_E2E_QR_TOKEN', '15000000-0000-0000-0000-000000000150', 'Process')
  Invoke-PlanNative 'RED E2E Today Chromium' { node scripts/run-playwright-e2e.mjs e2e/admin-vnext-today.spec.ts --build --project=chromium --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts } -ExpectFailure -ExpectedExitCode 1
} finally {
  foreach ($AdminEnvName in $AdminEnvNames) {
    [Environment]::SetEnvironmentVariable($AdminEnvName, $PreviousAdminEnv[$AdminEnvName], 'Process')
  }
}
```

Expected: échec initial non masqué sur les assertions non satisfaites. Corriger ensuite les seuls fichiers Today, puis exécuter la preuve GREEN :

```powershell
$AdminEnvNames = @('VISTAIRE_ADMIN_VISUAL_FIXTURE', 'VISTAIRE_REQUIRE_ADMIN_E2E', 'VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'VISTAIRE_ADMIN_E2E_QR_TOKEN')
$PreviousAdminEnv = @{}
foreach ($AdminEnvName in $AdminEnvNames) {
  $PreviousAdminEnv[$AdminEnvName] = [Environment]::GetEnvironmentVariable($AdminEnvName, 'Process')
}
try {
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_VISUAL_FIXTURE', '1', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_REQUIRE_ADMIN_E2E', '1', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'available', 'Process')
  [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_E2E_QR_TOKEN', '15000000-0000-0000-0000-000000000150', 'Process')
  Invoke-PlanNative 'GREEN E2E Today Chromium' { node scripts/run-playwright-e2e.mjs e2e/admin-vnext-today.spec.ts --build --project=chromium --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts }
} finally {
  foreach ($AdminEnvName in $AdminEnvNames) {
    [Environment]::SetEnvironmentVariable($AdminEnvName, $PreviousAdminEnv[$AdminEnvName], 'Process')
  }
}
```

Expected: succès avant de poursuivre vers les gates de branche.

- [ ] **Step 3: Exécuter les gates de branche**

```powershell
Invoke-PlanNative 'tests finaux Today' { node --test tests/admin-vnext-today.test.mjs }
Invoke-PlanNative 'assets Today' { npm run assets:check }
Invoke-PlanNative 'LFS Today' { npm run lfs:check }
Invoke-PlanNative 'lint final Today' { npm run lint }
Invoke-PlanNative 'typecheck final Today' { npm run typecheck }
Invoke-PlanNative 'build Today' { npm run build }
```

Expected: succès complet, aucune nouvelle dépendance ni asset lourd.

- [ ] **Step 4: Nettoyer les artefacts et vérifier le scope**

Supprimer `.next`, `test-results`, `playwright-report`, screenshots, vidéos et traces non destinés au dépôt. Vérifier :

```powershell
Invoke-PlanNative 'diff-check Today' { git diff --check }
Invoke-PlanNative 'scope diff Today' { git diff --name-only "$ExpectedBase...HEAD" }
Invoke-PlanNative 'status Today' { git status --short }
```

Expected: seulement les fichiers Today autorisés.

- [ ] **Step 5: Commit**

```powershell
Invoke-PlanNative 'stage E2E Today' { git add e2e/admin-vnext-today.spec.ts }
Invoke-PlanNative 'commit E2E Today' { git commit -m "test(admin): verify today across viewports" }
```
