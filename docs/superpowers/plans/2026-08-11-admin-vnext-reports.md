# Vistaire Admin vNext Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer `/admin/reports` fidèle à `4.png`, avec comparaisons honnêtes, résumé imprimable et CSV sécurisé dérivés du même registre de preuves que l'interface.

**Architecture:** La page serveur sélectionne une plage et un service allowlistés, charge le bundle v2 puis produit un `AdminReportModel` pur. L'endpoint d'export reconstruit le même bundle depuis l'accès serveur et projette l'audience `export`; il n'accepte aucune valeur calculée par le client.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS modules/primitives Foundation, Node test runner, Playwright, CSV UTF-8 côté serveur.

## Global Constraints

- Définir `$ExpectedBase` au SHA Git complet exact transmis par l'intégrateur, vérifier `git rev-parse --verify "$ExpectedBase^{commit}"`, puis créer `feat/admin-vnext-reports` depuis ce commit après revue P0/P1 des deux fondations. Refuser tout alias symbolique ou SHA déduit localement.
- Ownership exclusif : `app/admin/reports/**`, `app/admin/api/reports/**`, `components/admin/reports/**`, `lib/admin/reports/**`, `tests/admin-vnext-reports*.test.mjs`, `e2e/admin-vnext-reports.spec.ts`.
- Ne modifier ni primitives système/charts, ni Data Foundation, ni autres pages, ni `package.json`, ni `package-lock.json`.
- Toutes les valeurs et comparaisons portent un `evidenceId`; aucune recomposition côté client ou export.
- Une comparaison exige scope, timezone, définition et alignement identiques. Baseline zéro : écart absolu possible, taux `null`.
- Aucune métrique CA, vente, commande ou conversion commerciale.
- Les cellules CSV commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot sont neutralisées avant sérialisation.
- Le print stylesheet masque navigation/actions mais n'ajoute ni ne remplace aucune donnée.
- Les plages URL sont allowlistées; restaurant, menu, source et timezone ne viennent jamais de la requête.
- La spec Playwright Reports est locale et déterministe : elle ne lit jamais `VISTAIRE_ADMIN_E2E_QR_TOKEN`, ne contient aucun `test.skip`, `test.fixme` ou branche conditionnelle vide, et installe avant navigation un garde qui autorise uniquement l'origine locale exacte de l'application et l'origine loopback exacte de la fixture. Le runner peut fixer un QR fictif pour le harness partagé, mais toute autre requête HTTP(S), tout skip ou tout test sans assertions bloque la preuve.

La session PowerShell d'exécution définit d'abord ce helper local. Toute commande native GREEN, gate, staging ou commit passe par lui depuis le worktree absolu Reports. Un RED utilise `-ExpectFailure -ExpectedExitCode 1`: seul le code `1` attendu est accepté; un succès ou tout autre code est bloquant.

```powershell
$PlanWorktree = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-reports'
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

$VerifiedBase = (Invoke-PlanNative 'vérifier ExpectedBase Reports' { git rev-parse --verify "$ExpectedBase^{commit}" } | Out-String).Trim()
$ActualHead = (Invoke-PlanNative 'HEAD initial Reports' { git rev-parse HEAD } | Out-String).Trim()
$ActualBase = (Invoke-PlanNative 'merge-base initial Reports' { git merge-base HEAD $ExpectedBase } | Out-String).Trim()
if ($VerifiedBase -ne $ExpectedBase -or $ActualHead -ne $ExpectedBase -or $ActualBase -ne $ExpectedBase) { throw 'Reports doit démarrer exactement depuis ExpectedBase avant toute édition' }
```

---

### Task 1: Définir le modèle de rapport et ses comparaisons

**Files:**
- Create: `lib/admin/reports/contracts.ts`
- Create: `lib/admin/reports/buildReport.ts`
- Create: `lib/admin/reports/reportCopy.ts`
- Create: `tests/admin-vnext-reports.test.mjs`

**Interfaces:**

```ts
export type AdminReportService = "all" | "lunch" | "dinner";

export type AdminReportModel = Readonly<{
  locale: "fr" | "en";
  range: AdminRange;
  service: AdminReportService;
  window: AdminObservationWindow;
  highlights: readonly AdminReportHighlight[];
  metrics: readonly AdminReportMetric[];
  timeline: AdminReportPanel<AdminSeriesEvidence>;
  topDishes: AdminReportPanel<readonly AdminRankedItem[]>;
  searches: AdminReportPanel<readonly SearchTermEvidence[]>;
  availabilityChanges: AdminReportPanel<readonly AvailabilityEvidence[]>;
  reliability: AdminReportReliability;
  recommendations: readonly AdminReportRecommendation[];
}>;
```

- [ ] **Step 1: Écrire les tests RED**

Tester available, insufficient, unmeasured, truncated, définitions incompatibles, timezone différente, baseline zéro, services lunch/dinner et absence des métriques interdites. Chaque valeur affichable doit conserver son evidence ID.

```powershell
Invoke-PlanNative 'RED modèle Reports' { node --test tests/admin-vnext-reports.test.mjs } -ExpectFailure
```

Expected: échec parce que le builder n'existe pas.

- [ ] **Step 2: Implémenter le builder pur**

Le builder ne reçoit qu'un bundle et les filtres allowlistés. Il ne calcule pas de nouveau KPI; il sélectionne, ordonne et localise les preuves. Un service sans découpage fiable devient `unmeasured/unsupported-signal` au lieu d'estimer.

- [ ] **Step 3: Implémenter les copies FR/EN**

Employer « comparé à la période alignée », « interactions observées » et des raisons d'absence explicites. Aucune recommandation ne contient une valeur autonome.

- [ ] **Step 4: Relancer et commit**

```powershell
Invoke-PlanNative 'tests modèle Reports' { node --test tests/admin-vnext-reports.test.mjs }
Invoke-PlanNative 'stage modèle Reports' { git add lib/admin/reports tests/admin-vnext-reports.test.mjs }
Invoke-PlanNative 'commit modèle Reports' { git commit -m "test(admin): define evidence-backed reports" }
```

### Task 2: Construire la page Reports

**Files:**
- Create: `app/admin/reports/page.tsx`
- Create: `components/admin/reports/AdminReportsPage.tsx`
- Create: `components/admin/reports/AdminReports.module.css`
- Create: `components/admin/reports/ReportFilters.tsx`
- Create: `components/admin/reports/ReportHighlights.tsx`
- Create: `components/admin/reports/ReportMetricGrid.tsx`
- Create: `components/admin/reports/ReportTimeline.tsx`
- Create: `components/admin/reports/ReportTopDishes.tsx`
- Create: `components/admin/reports/ReportSearches.tsx`
- Create: `components/admin/reports/ReportAvailabilityChanges.tsx`
- Create: `components/admin/reports/ReportReliability.tsx`
- Create: `components/admin/reports/ReportRecommendations.tsx`
- Modify: `tests/admin-vnext-reports.test.mjs`

- [ ] **Step 1: Ajouter les assertions RED de route et structure**

Exiger accès serveur validé, parsing `range=today|7d|30d` et `service=all|lunch|dinner`, loader v2, `activeRoute="reports"`, `h1`, régions nommées, descriptions textuelles des charts et états absents. Interdire Supabase direct, fixtures et calcul client.

- [ ] **Step 2: Implémenter la route serveur**

Construire le modèle à partir du bundle. Un paramètre inconnu retombe sur la valeur canonique sans être propagé au repository. La date et le fuseau affichés viennent de la fenêtre du bundle.

- [ ] **Step 3: Implémenter la composition fidèle à `4.png`**

Assembler points clés, cartes comparatives, chronologie, top plats, recherches, évolution de disponibilité, résumé, fiabilité et actions recommandées. Une section sans preuve rend un état premium de même hauteur minimale sans faux contenu.

- [ ] **Step 4: Implémenter le responsive et print**

Les cartes et listes passent en flux à `390/430`. Le CSS `@media print` conserve titre, période, preuves et fiabilité, masque navigation, filtres et boutons, et évite les coupures au milieu d'une carte.

- [ ] **Step 5: Exécuter et commit**

```powershell
Invoke-PlanNative 'tests page Reports' { node --test tests/admin-vnext-reports.test.mjs }
Invoke-PlanNative 'lint page Reports' { npm run lint }
Invoke-PlanNative 'typecheck page Reports' { npm run typecheck }
Invoke-PlanNative 'stage page Reports' { git add app/admin/reports components/admin/reports tests/admin-vnext-reports.test.mjs }
Invoke-PlanNative 'commit page Reports' { git commit -m "feat(admin): build service reports" }
```

### Task 3: Sécuriser le CSV côté serveur

**Files:**
- Create: `lib/admin/reports/csv.ts`
- Create: `lib/admin/reports/exportReport.ts`
- Create: `app/admin/api/reports/export/route.ts`
- Create: `tests/admin-vnext-reports-csv.test.mjs`

**Interfaces:**

```ts
export function sanitizeCsvCell(value: string): string;

export function serializeAdminReportCsv(input: {
  locale: "fr" | "en";
  report: AdminReportModel;
  evidence: AdminEvidenceProjection;
}): Uint8Array;
```

- [ ] **Step 1: Écrire les tests RED de sécurité CSV et de cache privé**

Couvrir virgule, point-virgule, guillemet, CR/LF, Unicode, BOM UTF-8, `=SUM(...)`, `+cmd`, `-1+2`, `@import`, tabulation, retour chariot, terme k-anonyme et preuve non autorisée. Exiger `Content-Disposition` sûr, `nosniff`, `Cache-Control: private, no-store` et `Vary: Cookie` sur la réponse de succès ainsi que sur chaque réponse d'erreur.

```powershell
Invoke-PlanNative 'RED sécurité CSV Reports' { node --test tests/admin-vnext-reports-csv.test.mjs } -ExpectFailure
```

- [ ] **Step 2: Implémenter le sanitizer et sérialiseur**

Préfixer d'une apostrophe les cellules dangereuses avant escaping CSV. Choisir le séparateur explicitement, produire un BOM UTF-8 et des lignes CRLF déterministes. Ne sérialiser que la projection `export`.

- [ ] **Step 3: Implémenter l'endpoint**

La route GET revalide l'accès, parse les filtres allowlistés, recharge le bundle côté serveur, construit le rapport et renvoie le binaire. Elle ignore toute valeur/evidence fournie par le client et utilise un nom de fichier localisé sans entrée utilisateur. Une helper de réponse commune applique `Cache-Control: private, no-store` et `Vary: Cookie` au succès comme aux erreurs d'authentification, validation, chargement ou sérialisation, sans exposer de détail serveur.

- [ ] **Step 4: Relancer les tests et commit**

```powershell
Invoke-PlanNative 'tests export Reports' { node --test tests/admin-vnext-reports.test.mjs tests/admin-vnext-reports-csv.test.mjs }
Invoke-PlanNative 'stage export Reports' { git add lib/admin/reports/csv.ts lib/admin/reports/exportReport.ts app/admin/api/reports/export/route.ts tests/admin-vnext-reports-csv.test.mjs }
Invoke-PlanNative 'commit export Reports' { git commit -m "feat(admin): export safe evidence reports" }
```

### Task 4: Brancher partage local et impression

**Files:**
- Create: `components/admin/reports/ReportActions.tsx`
- Modify: `components/admin/reports/AdminReportsPage.tsx`
- Modify: `components/admin/reports/AdminReports.module.css`
- Modify: `tests/admin-vnext-reports.test.mjs`

- [ ] **Step 1: Écrire les assertions RED**

Exiger un lien GET vers l'export, un bouton impression avec label accessible, fallback quand `window.print` ou Web Share n'est pas disponible, et aucune transmission de rapport à un tiers.

- [ ] **Step 2: Implémenter les actions**

« Exporter » télécharge depuis l'endpoint; « Imprimer » appelle `window.print()` après intention. Le partage natif, lorsqu'il existe, partage uniquement l'URL privée courante et un titre sans données; sinon copier l'URL avec message accessible.

- [ ] **Step 3: Exécuter et commit**

```powershell
Invoke-PlanNative 'tests actions Reports' { node --test tests/admin-vnext-reports.test.mjs tests/admin-vnext-reports-csv.test.mjs }
Invoke-PlanNative 'typecheck actions Reports' { npm run typecheck }
Invoke-PlanNative 'stage actions Reports' { git add components/admin/reports tests/admin-vnext-reports.test.mjs }
Invoke-PlanNative 'commit actions Reports' { git commit -m "feat(admin): add report actions" }
```

### Task 5: QA navigateur et gates de branche

**Files:**
- Create: `e2e/admin-vnext-reports.spec.ts`

- [ ] **Step 1: Écrire les scénarios E2E**

Couvrir filtres, comparaisons, baseline zéro, états non mesurés, export CSV hostile, print preview CSS, clavier, FR/EN, clair/sombre, `390`, `430`, tablette et `1448 × 1086`. La spec construit ses données depuis la fixture locale `available`, sans lire le QR token, sans `skip`, `fixme`, branche vide ou fallback vers un backend. Installer le garde réseau loopback-only avant la première navigation; vérifier console, 404/500, overflow et absence de requête assistant/GLB/USDZ.

- [ ] **Step 2: Exécuter les tests ciblés et Playwright**

```powershell
Invoke-PlanNative 'tests finaux Reports' { node --test tests/admin-vnext-reports.test.mjs tests/admin-vnext-reports-csv.test.mjs }
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
  Invoke-PlanNative 'E2E Reports Chromium' { node scripts/run-playwright-e2e.mjs e2e/admin-vnext-reports.spec.ts --build --project=chromium --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts }
} finally {
  foreach ($AdminEnvName in $AdminEnvNames) {
    [Environment]::SetEnvironmentVariable($AdminEnvName, $PreviousAdminEnv[$AdminEnvName], 'Process')
  }
}
```

- [ ] **Step 3: Exécuter les gates complets**

```powershell
Invoke-PlanNative 'assets Reports' { npm run assets:check }
Invoke-PlanNative 'LFS Reports' { npm run lfs:check }
Invoke-PlanNative 'lint final Reports' { npm run lint }
Invoke-PlanNative 'typecheck final Reports' { npm run typecheck }
Invoke-PlanNative 'build Reports' { npm run build }
Invoke-PlanNative 'suite admin Reports' { npm run test:admin }
```

- [ ] **Step 4: Nettoyer, vérifier le scope et commit**

```powershell
Invoke-PlanNative 'diff-check Reports' { git diff --check }
Invoke-PlanNative 'scope diff Reports' { git diff --name-only "$ExpectedBase...HEAD" }
Invoke-PlanNative 'status Reports' { git status --short }
Invoke-PlanNative 'stage E2E Reports' { git add e2e/admin-vnext-reports.spec.ts }
Invoke-PlanNative 'commit E2E Reports' { git commit -m "test(admin): verify reports and exports" }
```
