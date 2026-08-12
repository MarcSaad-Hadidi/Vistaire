# Vistaire Admin vNext Public Preview Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre `/apercu-restaurateur` et `/en/restaurant-preview` en parité visuelle avec le dashboard stabilisé, au moyen d'une fixture synthétique clairement déclarée et sans aucune donnée ou frontière privée admin.

**Architecture:** Une mini-application de démonstration autonome adapte `lib/restaurateurPreview/fixture.ts` vers cinq vues purement présentatives. Elle peut importer les primitives visuelles additives de Foundation, mais jamais le shell privé, les loaders, repositories, cookies, accès, API ou types de scope admin.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, composants preview existants, primitives de présentation Foundation, Node test runner, Playwright.

## Global Constraints

- Ne créer aucun agent, worktree ou branche de preview et ne commencer aucun travail sans une instruction utilisateur explicite donnée après stabilisation du dashboard et clôture de la Final QA sans P0/P1. L'existence de ce plan ou du commit stabilisé ne vaut pas autorisation.
- Après cette instruction, lire `$ExpectedBase` exclusivement depuis `ADMIN_VNEXT_EXPECTED_BASE_SHA`, puis créer la branche séparée `feat/admin-vnext-public-preview-parity` depuis ce commit. Refuser tout alias symbolique ou SHA déduit localement; ce chantier n'appartient pas aux huit worktrees du dashboard.
- Ownership exclusif : `app/apercu-restaurateur/page.tsx`, `app/en/restaurant-preview/page.tsx`, `components/vistaire-preview/**` strictement nécessaires, `lib/restaurateurPreview/**`, tests/Playwright `restaurateur-preview*`.
- Aucun import de `lib/admin/**`, `lib/analytics/**`, `utils/supabase/**`, `app/admin/**`, `AdminShell`, préférences/cookies admin ou route API admin.
- Seuls `components/admin/system/AdminPresentationPrimitives.tsx` et les styles/tokens explicitement documentés comme présentation publique sont importables depuis `components/admin/**`.
- La fixture est déterministe, synthétique, localisée et identifiée « Démonstration — données fictives » / « Demo — fictional data » dans chaque vue.
- Aucune requête runtime à Supabase, `/admin`, `/admin/api`, Mistral, analytics privés ou service-role.
- Les toggles et actions sont des simulations locales annoncées comme telles et réinitialisées au reload.
- Ne pas ajouter les cinq PNG de référence, screenshot, vidéo ou asset lourd au dépôt.
- Préserver metadata, canonical, hreflang, sitemap et no-private-data contracts existants.

Avant toute création de branche/worktree ou toute commande native Preview, exécuter ce préflight depuis le checkout d'intégration. `ADMIN_VNEXT_PREVIEW_AUTHORIZATION_JSON` désigne un JSON hors dépôt contenant `approved: true`, un `InstructionId` non vide, `ExpectedBase` égal au SHA B4 transmis et un `ApprovedAtUtc` parseable. Le reçu ne contient aucun secret :

```powershell
$RepoRoot = 'E:\Projet perso\MenuAlive'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
$AuthorizationReceiptPath = ([string]$env:ADMIN_VNEXT_PREVIEW_AUTHORIZATION_JSON).Trim()
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ADMIN_VNEXT_EXPECTED_BASE_SHA doit être le SHA B4 complet' }
if ([string]::IsNullOrWhiteSpace($AuthorizationReceiptPath)) { throw 'receipt explicite Preview absent' }
$ResolvedAuthorizationReceipt = (Resolve-Path -LiteralPath $AuthorizationReceiptPath -ErrorAction Stop).Path
$RepositoryPrefix = [IO.Path]::GetFullPath($RepoRoot).TrimEnd('\') + '\'
if ($ResolvedAuthorizationReceipt.StartsWith($RepositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'receipt Preview interdit dans le dépôt' }
$PreviewAuthorization = Get-Content -LiteralPath $ResolvedAuthorizationReceipt -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
$InstructionId = ([string]$PreviewAuthorization.InstructionId).Trim()
$ReceiptExpectedBase = ([string]$PreviewAuthorization.ExpectedBase).Trim()
$ApprovedAtUtc = [datetimeoffset]::MinValue
if ($PreviewAuthorization.approved -isnot [bool] -or -not $PreviewAuthorization.approved) { throw 'Preview non approuvée explicitement' }
if ([string]::IsNullOrWhiteSpace($InstructionId)) { throw 'InstructionId Preview absent' }
if ($ReceiptExpectedBase -ne $ExpectedBase) { throw 'receipt Preview lié à un autre B4' }
if (-not [datetimeoffset]::TryParse(([string]$PreviewAuthorization.ApprovedAtUtc).Trim(), [ref]$ApprovedAtUtc)) { throw 'ApprovedAtUtc Preview invalide' }
```

Expected: le reçu valide l'instruction explicite et le B4 exact avant que l'orchestrateur ne crée le worktree. Toute valeur absente, fausse, invalide ou stockée dans le dépôt arrête le chantier.

La session PowerShell d'exécution définit d'abord ce helper local. Toute commande native GREEN, gate, staging ou commit passe par lui depuis le worktree absolu Preview, créé uniquement après l'autorisation explicite requise ci-dessus. Un RED utilise `-ExpectFailure`: seul un code explicitement attendu prouve le RED; un code zéro ou un code d'infrastructure inattendu est bloquant.

```powershell
$PlanWorktree = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-public-preview-parity'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ADMIN_VNEXT_EXPECTED_BASE_SHA doit être le SHA B4 complet' }

function Invoke-PlanNative {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command,
    [switch]$ExpectFailure,
    [int[]]$ExpectedFailureExitCodes = @(1)
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
      if ($ExitCode -eq 0) {
        throw "$Label devait échouer en RED mais a réussi."
      }
      if ($ExpectedFailureExitCodes.Count -eq 0 -or $ExitCode -notin $ExpectedFailureExitCodes) {
        throw "$Label a échoué avec le code inattendu $ExitCode; attendus: $($ExpectedFailureExitCodes -join ', ')."
      }
      Write-Output "$Label : échec RED observé (exit=$ExitCode)."
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

$VerifiedBase = (Invoke-PlanNative 'vérifier ExpectedBase Preview' { git rev-parse --verify "$ExpectedBase^{commit}" } | Out-String).Trim()
$ActualHead = (Invoke-PlanNative 'HEAD initial Preview' { git rev-parse HEAD } | Out-String).Trim()
$ActualBase = (Invoke-PlanNative 'merge-base initial Preview' { git merge-base HEAD $ExpectedBase } | Out-String).Trim()
if ($VerifiedBase -ne $ExpectedBase -or $ActualHead -ne $ExpectedBase -or $ActualBase -ne $ExpectedBase) { throw 'Preview doit démarrer exactement depuis B4 avant toute édition' }
```

---

### Task 1: Figer la fixture cinq vues et son adaptateur

**Files:**
- Modify: `lib/restaurateurPreview/types.ts`
- Modify: `lib/restaurateurPreview/fixture.ts`
- Modify: `lib/restaurateurPreview/copy.ts`
- Create: `lib/restaurateurPreview/buildPreviewViews.ts`
- Modify: `tests/restaurateur-preview-fixture.test.mjs`

**Interfaces:**

```ts
export type RestaurateurPreviewViewId =
  | "today"
  | "availability"
  | "intelligence"
  | "reports"
  | "more";

export type RestaurateurPreviewModel = Readonly<{
  disclosure: string;
  restaurant: RestaurateurPreviewRestaurant;
  views: Readonly<Record<RestaurateurPreviewViewId, PreviewViewModel>>;
}>;
```

- [ ] **Step 1: Écrire les tests RED de fixture**

Exiger cinq vues FR/EN, IDs synthétiques non UUID production, périodes fixes, disclosure dans chaque vue, aucune clé restaurant/menu/session réelle, aucune URL admin/Supabase/Mistral et aucune métrique commerciale présentée comme production.

```powershell
Invoke-PlanNative 'RED fixture preview publique' { node --test tests/restaurateur-preview-fixture.test.mjs } -ExpectFailure
```

- [ ] **Step 2: Étendre la fixture déterministe**

Ajouter les seules données nécessaires aux cinq vues, avec noms explicitement fictifs et dates fixes. Les états de qualité/performance non démontrables sont étiquetés comme simulation de présentation, pas comme capacité Vistaire mesurée.

- [ ] **Step 3: Implémenter l'adaptateur pur**

L'adaptateur produit les cinq view models sans importer Data Foundation. Il ne lit ni clock réelle, ni storage, ni réseau. Les copies FR/EN conservent la disclosure à proximité des valeurs.

- [ ] **Step 4: Relancer et commit**

```powershell
Invoke-PlanNative 'tests fixture preview publique' { node --test tests/restaurateur-preview-fixture.test.mjs }
Invoke-PlanNative 'stage fixture preview publique' { git add lib/restaurateurPreview tests/restaurateur-preview-fixture.test.mjs }
Invoke-PlanNative 'commit fixture preview publique' { git commit -m "test(preview): define five synthetic dashboard views" }
```

### Task 2: Recomposer la démo avec les primitives stabilisées

**Files:**
- Modify: `components/vistaire-preview/RestaurateurDashboardDemo.tsx`
- Modify: `components/vistaire-preview/RestaurateurPreviewOverview.tsx`
- Modify: `components/vistaire-preview/RestaurateurPreviewAvailability.tsx`
- Modify: `components/vistaire-preview/RestaurateurPreviewInsights.tsx`
- Create: `components/vistaire-preview/RestaurateurPreviewReports.tsx`
- Create: `components/vistaire-preview/RestaurateurPreviewMore.tsx`
- Modify: `components/vistaire-preview/VistaireRestaurateurDashboardPreview.module.css`
- Modify: `tests/restaurateur-preview-ci-contract.test.mjs`

- [ ] **Step 1: Écrire les contrats RED d'import et navigation**

Exiger cinq tabs avec roving tabindex, Home/End/flèches, régions nommées, disclosure persistante et allowlist d'import présentation. Interdire shell, loader, access, cookies, API, Supabase et analytics.

- [ ] **Step 2: Implémenter la navigation cinq vues**

Réutiliser les primitives stabilisées pour cartes, badges, états et toast. La preview garde son chrome marketing public; elle ne reproduit pas l'authentification ou les actions serveur.

- [ ] **Step 3: Implémenter Today, Availability, Intelligence, Reports et More**

Chaque vue reprend la hiérarchie visuelle de la route réelle à échelle preview. Availability modifie seulement un state local et annonce « simulation »; l'assistant montre des exemples pré-rédigés de fixture sans appel modèle; l'export Reports produit au plus un fichier synthétique local explicitement nommé démo; More n'affiche aucun vrai contact restaurant.

- [ ] **Step 4: Implémenter responsive et reduced motion**

À `390/430`, les tabs deviennent rail horizontal accessible ou sélecteur compact sans overflow de page. Les composants restent utilisables au clavier et le mouvement respecte `prefers-reduced-motion`.

- [ ] **Step 5: Exécuter et commit**

```powershell
Invoke-PlanNative 'tests composition preview publique' { node --test tests/restaurateur-preview-fixture.test.mjs tests/restaurateur-preview-ci-contract.test.mjs tests/restaurateur-preview-security.test.mjs }
Invoke-PlanNative 'typecheck composition preview publique' { npm run typecheck }
Invoke-PlanNative 'stage composition preview publique' { git add components/vistaire-preview tests/restaurateur-preview-ci-contract.test.mjs }
Invoke-PlanNative 'commit composition preview publique' { git commit -m "feat(preview): mirror stabilized admin presentation" }
```

### Task 3: Préserver routes publiques et SEO bilingue

**Files:**
- Modify: `app/apercu-restaurateur/page.tsx`
- Modify: `app/en/restaurant-preview/page.tsx`
- Modify: `tests/restaurateur-preview-ci-contract.test.mjs`
- Modify: `tests/bilingual-seo.test.mjs`
- Modify: `tests/seo-foundation.test.mjs`

- [ ] **Step 1: Ajouter les assertions RED**

Vérifier canonical réciproque, hreflang, locale OG, un H1, metadata parlant de démonstration, JSON-LD sans client/avis/chiffre inventé et absence de noindex involontaire.

- [ ] **Step 2: Mettre à jour les pages sans loader privé**

Les pages génèrent seulement le QR de `/demo`, metadata/JSON-LD publics et le composant preview. Aucune fonction admin n'est appelée au build ou au runtime.

- [ ] **Step 3: Exécuter et commit**

```powershell
Invoke-PlanNative 'tests routes et SEO preview publique' { node --test tests/restaurateur-preview-ci-contract.test.mjs tests/bilingual-seo.test.mjs tests/seo-foundation.test.mjs }
Invoke-PlanNative 'stage routes et SEO preview publique' { git add app/apercu-restaurateur/page.tsx app/en/restaurant-preview/page.tsx tests/restaurateur-preview-ci-contract.test.mjs tests/bilingual-seo.test.mjs tests/seo-foundation.test.mjs }
Invoke-PlanNative 'commit routes et SEO preview publique' { git commit -m "feat(preview): preserve bilingual dashboard preview" }
```

### Task 4: Renforcer l'isolation réseau

**Files:**
- Modify: `e2e/support/restaurateur-preview-request-policy.mjs`
- Modify: `tests/restaurateur-preview-security.test.mjs`
- Modify: `e2e/restaurateur-preview.spec.ts`

- [ ] **Step 1: Écrire les tests RED de denylist**

Bloquer toute requête vers `/admin`, `/admin/api`, Supabase REST/auth/storage non public, Mistral, endpoints analytics privés et origins non allowlistées. Autoriser seulement document/assets publics, QR local, liens marketing et menu `/demo` après intention.

- [ ] **Step 2: Appliquer la policy aux deux locales**

Le test capture toutes les requêtes et échoue sur une destination interdite, même si la réponse est mise en cache ou échoue. Vérifier également DOM, RSC payload et bundles pour identifiants/secret patterns.

- [ ] **Step 3: Exécuter les contrats sécurité**

```powershell
Invoke-PlanNative 'tests isolation preview publique' { node --test tests/restaurateur-preview-security.test.mjs tests/restaurateur-preview-ci-contract.test.mjs }
```

- [ ] **Step 4: Commit**

```powershell
Invoke-PlanNative 'stage isolation preview publique' { git add e2e/support/restaurateur-preview-request-policy.mjs tests/restaurateur-preview-security.test.mjs e2e/restaurateur-preview.spec.ts }
Invoke-PlanNative 'commit isolation preview publique' { git commit -m "test(preview): enforce public dashboard isolation" }
```

### Task 5: QA finale de la preview

**Files:**
- Modify: `e2e/restaurateur-preview.spec.ts`
- Create: `e2e/restaurateur-preview-performance.spec.ts`

- [ ] **Step 1: Couvrir cinq vues et deux langues**

Tester navigation, simulation Availability, états, disclosure, clavier, reduced motion, `390`, `430`, tablette et `1448 × 1086` sur les deux routes. Vérifier console, 404/500, overflow et absence de préchargement GLB/USDZ.

Dans `e2e/restaurateur-preview-performance.spec.ts`, appliquer à chacune des routes `/apercu-restaurateur` et `/en/restaurant-preview`, aux viewports `390 × 844` et `1448 × 1086`, exactement les budgets et l'instrumentation de `e2e/admin-performance.spec.ts` : CLS `<= 0.1`; aucune long task `>= 50 ms`; delta layout `<= 80`; delta recalcul de style `<= 180`; heap `< 160 MB`; frame p95 `<= 35 ms`; nombre de scripts `<= 45`; JS décodé `<= 8 MiB`; aucune requête `.glb`, `.usdz` ou `.mp4`. Chaque combinaison route/viewport est un cas bloquant distinct et inscrit ses mesures dans les annotations Playwright.

- [ ] **Step 2: Construire une fois le SHA exact et exécuter les gates statiques**

```powershell
Invoke-PlanNative 'suite Node preview publique' { npm run test:restaurateur-preview:node }
Invoke-PlanNative 'assets preview publique' { npm run assets:check }
Invoke-PlanNative 'LFS preview publique' { npm run lfs:check }
Invoke-PlanNative 'lint preview publique' { npm run lint }
Invoke-PlanNative 'typecheck preview publique' { npm run typecheck }
Invoke-PlanNative 'build preview publique' { npm run build }
```

- [ ] **Step 3: Exécuter Playwright sur le build frais en Chromium et WebKit, puis les budgets Chromium**

```powershell
foreach ($Project in @("chromium", "webkit")) {
  Invoke-PlanNative "preview fonctionnelle sur $Project" { node scripts/run-playwright-e2e.mjs e2e/restaurateur-preview.spec.ts --project=$Project --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts }
}
Invoke-PlanNative 'budgets performance preview Chromium' { node scripts/run-playwright-e2e.mjs e2e/restaurateur-preview-performance.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts }
```

Les métriques layout/style/heap réutilisent la session CDP du test de référence et sont donc mesurées sur Chromium; WebKit reste obligatoire pour toute la matrice fonctionnelle, responsive, accessibilité et réseau. Le build précède toujours ces commandes dans la même session et pour le même HEAD; aucune sortie `.next` héritée n'est acceptée.

- [ ] **Step 4: Nettoyer, vérifier l'ownership et commit**

```powershell
Invoke-PlanNative 'diff-check preview publique' { git diff --check }
Invoke-PlanNative 'scope diff preview publique' { git diff --name-only "$ExpectedBase...HEAD" }
Invoke-PlanNative 'status preview publique' { git status --short }
Invoke-PlanNative 'stage QA preview publique' { git add e2e/restaurateur-preview.spec.ts e2e/restaurateur-preview-performance.spec.ts }
Invoke-PlanNative 'commit QA preview publique' { git commit -m "test(preview): verify five-view public parity" }
```

- [ ] **Step 5: Arrêter avant publication**

Ne pas push, créer de PR, merger vers `main` ou déployer sans autorisation explicite.
