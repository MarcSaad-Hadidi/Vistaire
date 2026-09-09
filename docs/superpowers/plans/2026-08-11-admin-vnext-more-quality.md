# Vistaire Admin vNext More and Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer `/admin/more` comme centre de qualité fidèle à `5.png`, fondé sur l'état réel du restaurant, du QR, du menu et de ses contenus, sans inventer incidents, SLA ou performance technique.

**Architecture:** Un repository page-specific lit un profil allowlisté et les projections catalogue/traduction du menu scoped. Un builder pur produit des états de complétude et des points à compléter. La page consomme Foundation et le bundle Data Foundation; elle n'ajoute aucune définition analytics partagée.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase server-only pour les lectures scoped, CSS modules/primitives Foundation, Node test runner, Playwright.

## Global Constraints

- Définir `$ExpectedBase` au SHA Git complet exact transmis par l'intégrateur, vérifier `git rev-parse --verify "$ExpectedBase^{commit}"`, puis créer `feat/admin-vnext-more-quality` depuis ce commit après intégration séquentielle des quatre branches de vague 2. Refuser tout alias symbolique ou SHA déduit localement.
- Ownership exclusif : `app/admin/more/**`, `components/admin/more/**`, `lib/admin/more/**`, `tests/admin-vnext-more-quality.test.mjs`, `e2e/admin-vnext-more-quality.spec.ts`.
- Ne modifier ni primitives système/charts, ni Data Foundation, ni pages de vague 2, ni `package.json`, ni `package-lock.json`.
- L'accès validé fournit restaurant/menu; aucun paramètre URL ne choisit le scope.
- Afficher uniquement les champs restaurant réellement persistés et nécessaires : nom, location, type de cuisine, téléphone, email de contact et URL publique lorsque présents.
- Ne pas afficher d'adresse structurée, site web, horaires, langues, SLA ou disponibilité de support si la source n'existe pas.
- QR actif, menu publié, photos, descriptions, allergènes, traductions et présence d'asset 3D sont des états de catalogue; ils ne prouvent ni scans en temps réel, ni succès 3D/AR, ni performance mobile.
- Performance mobile, taux de succès 3D/AR, erreurs d'assets, incidents et demandes Vistaire restent `unmeasured` ou sont omis sans source.
- Le CTA support utilise `mailto:contact@vistaire.ca` déjà publié; il ne crée aucun faux ticket.
- Vérifier `390`, `430`, tablette puis `1448 × 1086`, FR/EN et thèmes.
- Toute invocation Playwright Admin est hermétique : elle sauvegarde puis restaure les variables d'environnement du processus, force `VISTAIRE_ADMIN_VISUAL_FIXTURE=1`, `VISTAIRE_REQUIRE_ADMIN_E2E=1`, `VISTAIRE_ADMIN_FIXTURE_SCENARIO=available` et le QR fictif déterministe `15000000-0000-0000-0000-000000000150` pour le harness partagé, puis active littéralement `e2e/support/forbid-skipped-tests-reporter.ts`. Aucune des sept specs consommées ne lit `VISTAIRE_ADMIN_E2E_QR_TOKEN`. Le test installe avant navigation une politique réseau qui autorise uniquement l'origine locale exacte de l'application et l'origine loopback exacte de la fixture; toute autre requête HTTP(S), tout skip ou tout test sans assertions bloque le gate.

La session PowerShell d'exécution définit d'abord ce helper local. Toute commande native GREEN, gate, staging ou commit passe par lui depuis le worktree absolu More-Quality. Un RED utilise `-ExpectFailure`: seul un code explicitement attendu prouve le RED; un code zéro ou un code d'infrastructure inattendu est bloquant.

```powershell
$PlanWorktree = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-more-quality'
$ExpectedBase = ([string]$env:ADMIN_VNEXT_EXPECTED_BASE_SHA).Trim()
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ADMIN_VNEXT_EXPECTED_BASE_SHA doit être un SHA complet' }

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

$VerifiedBase = (Invoke-PlanNative 'vérifier ExpectedBase More-Quality' { git rev-parse --verify "$ExpectedBase^{commit}" } | Out-String).Trim()
$ActualHead = (Invoke-PlanNative 'HEAD initial More-Quality' { git rev-parse HEAD } | Out-String).Trim()
$ActualBase = (Invoke-PlanNative 'merge-base initial More-Quality' { git merge-base HEAD $ExpectedBase } | Out-String).Trim()
if ($VerifiedBase -ne $ExpectedBase -or $ActualHead -ne $ExpectedBase -or $ActualBase -ne $ExpectedBase) { throw 'More-Quality doit démarrer exactement depuis ExpectedBase avant toute édition' }
```

---

### Task 1: Figer le contrat Quality

**Files:**
- Create: `lib/admin/more/contracts.ts`
- Create: `lib/admin/more/buildMoreQuality.ts`
- Create: `lib/admin/more/moreQualityCopy.ts`
- Create: `tests/admin-vnext-more-quality.test.mjs`

**Interfaces:**

```ts
export type MoreQualityState =
  | { kind: "ready"; completed: number; total: number }
  | { kind: "partial"; completed: number; total: number }
  | { kind: "unmeasured"; reason: "source-not-connected" }
  | { kind: "unavailable"; reason: "read-failed" | "not-applicable" };

export type AdminMoreQualityModel = Readonly<{
  locale: "fr" | "en";
  qr: MoreQualityState;
  publication: MoreQualityState;
  photos: MoreQualityState;
  descriptions: MoreQualityState;
  allergens: MoreQualityState;
  translations: MoreQualityState;
  immersiveAssets: MoreQualityState;
  mobilePerformance: MoreQualityState;
  immersiveSuccess: MoreQualityState;
  assetErrors: MoreQualityState;
  profile: AdminMoreRestaurantProfile;
  completionIssues: readonly AdminMenuCompletionIssue[];
}>;
```

- [ ] **Step 1: Écrire les tests RED de vérité sémantique**

Tester menu vide, champs absents, partiel, lecture échouée, 3D présente sans succès mesuré, traduction par locale, allergène inconnu, et interdiction d'assimiler absence d'incident à zéro incident.

```powershell
Invoke-PlanNative 'RED contrat More-Quality' { node --test tests/admin-vnext-more-quality.test.mjs } -ExpectFailure
```

Expected: échec car le builder n'existe pas.

- [ ] **Step 2: Implémenter le builder pur**

Les ratios utilisent des dénominateurs explicites. Un menu vide retourne `not-applicable`, pas 100 %. Les listes de problèmes sont des lacunes catalogue observées et non des « incidents ».

- [ ] **Step 3: Implémenter les copies FR/EN**

Employer « prêt », « à compléter », « non mesuré » et « source non connectée ». Ne jamais écrire « excellent », « temps réel » ou un SLA sans preuve.

- [ ] **Step 4: Relancer et commit**

```powershell
Invoke-PlanNative 'tests contrat More-Quality' { node --test tests/admin-vnext-more-quality.test.mjs }
Invoke-PlanNative 'stage contrat More-Quality' { git add lib/admin/more/contracts.ts lib/admin/more/buildMoreQuality.ts lib/admin/more/moreQualityCopy.ts tests/admin-vnext-more-quality.test.mjs }
Invoke-PlanNative 'commit contrat More-Quality' { git commit -m "test(admin): define honest quality states" }
```

### Task 2: Lire le profil et les contenus avec un scope strict

**Files:**
- Create: `lib/admin/more/repository.ts`
- Create: `lib/admin/more/loadMoreQuality.ts`
- Modify: `tests/admin-vnext-more-quality.test.mjs`

**Repository contract:**

```ts
export async function loadMoreQualityData(input: {
  access: GrantedAdminAccess;
  bundle: AdminEvidenceBundle;
}): Promise<AdminMoreQualityLoadResult>;
```

- [ ] **Step 1: Ajouter les tests RED de scope**

Prouver colonnes explicites, restaurant/menu obligatoires, aucune wildcard, source production, row cross-scope rejetée, profil et traductions indépendants, aucune note interne/contact personnel non nécessaire, aucune lecture tickets/incidents inexistants.

- [ ] **Step 2: Implémenter le repository dédié**

Lire le profil depuis `restaurants` avec `id` issu de l'accès et les traductions/états catalogue avec `menu_id` et `restaurant_id`. Réduire toutes les lignes côté serveur aux compteurs et champs allowlistés; ne pas envoyer de raw row au client.

- [ ] **Step 3: Composer le loader**

Réutiliser le bundle Data Foundation pour les snapshots déjà disponibles, compléter seulement les projections propres à Quality et maintenir des erreurs indépendantes. L'URL publique est normalisée vers un chemin/URL Vistaire attendu avant rendu.

- [ ] **Step 4: Exécuter et commit**

```powershell
Invoke-PlanNative 'tests repository More-Quality' { node --test tests/admin-vnext-more-quality.test.mjs }
Invoke-PlanNative 'typecheck repository More-Quality' { npm run typecheck }
Invoke-PlanNative 'stage repository More-Quality' { git add lib/admin/more/repository.ts lib/admin/more/loadMoreQuality.ts tests/admin-vnext-more-quality.test.mjs }
Invoke-PlanNative 'commit repository More-Quality' { git commit -m "feat(admin): load scoped quality data" }
```

### Task 3: Construire la page More / Quality

**Files:**
- Create: `app/admin/more/page.tsx`
- Create: `components/admin/more/AdminMoreQualityPage.tsx`
- Create: `components/admin/more/AdminMoreQuality.module.css`
- Create: `components/admin/more/QualityStatusGrid.tsx`
- Create: `components/admin/more/QrHealthPanel.tsx`
- Create: `components/admin/more/ContentReadinessPanel.tsx`
- Create: `components/admin/more/ExperienceEvidencePanel.tsx`
- Create: `components/admin/more/RestaurantProfileCard.tsx`
- Create: `components/admin/more/CompletionIssuesPanel.tsx`
- Create: `components/admin/more/SupportPanel.tsx`
- Modify: `tests/admin-vnext-more-quality.test.mjs`

- [ ] **Step 1: Ajouter les tests RED de route et de structure**

Exiger accès validé, bundle v2, loader Quality, `activeRoute="more"`, régions nommées, liens `mailto:` sûrs, profils conditionnels et états unmeasured. Interdire chiffres codés en dur, « scans en temps réel », « taux de succès », SLA, ticket ou demande synthétique.

- [ ] **Step 2: Implémenter la route serveur**

Charger accès, bundle et projection Quality côté serveur. La page ne lit aucun identifiant de scope dans les search params et ne sérialise aucune erreur Supabase.

- [ ] **Step 3: Implémenter la composition fidèle à `5.png`**

Assembler grille d'état, profil restaurant, santé QR, assets/contenus, expérience et points à compléter. Remplacer les blocs maquette sans source par des cartes `Non mesuré` explicites ou les omettre lorsque leur présence n'aide pas l'action.

- [ ] **Step 4: Implémenter le CTA support honnête**

Le lien ouvre `mailto:contact@vistaire.ca` avec sujet localisé contenant seulement le nom public du restaurant. Ne pas annoncer 7j/7, heures, réponse garantie ou création de ticket.

- [ ] **Step 5: Exécuter et commit**

```powershell
Invoke-PlanNative 'tests page More-Quality' { node --test tests/admin-vnext-more-quality.test.mjs }
Invoke-PlanNative 'lint page More-Quality' { npm run lint }
Invoke-PlanNative 'typecheck page More-Quality' { npm run typecheck }
Invoke-PlanNative 'stage page More-Quality' { git add app/admin/more components/admin/more tests/admin-vnext-more-quality.test.mjs }
Invoke-PlanNative 'commit page More-Quality' { git commit -m "feat(admin): build quality center" }
```

### Task 4: QA navigateur et gates de branche

**Files:**
- Create: `e2e/admin-vnext-more-quality.spec.ts`

- [ ] **Step 1: Écrire les scénarios E2E**

Couvrir menu complet/partiel/vide, profil incomplet, traduction absente, source en erreur, 3D présente mais succès non mesuré, CTA support, clavier, FR/EN, thèmes, `390`, `430`, tablette et `1448 × 1086`. Avant toute navigation, intercepter le réseau et n'autoriser que l'origine locale exacte de l'application et l'origine exacte `http://127.0.0.1:<port fixture>`; toute autre requête HTTP(S), notamment Supabase, analytics ou API externe, échoue. Vérifier aussi console, 404/500, overflow, absence de requête 3D/AR avant intention et zéro test skipped via le reporter anti-skip. Étendre `tests/admin-vnext-more-quality.test.mjs` avec un contrat source qui lit exactement les sept specs canoniques et interdit dans chacune `VISTAIRE_ADMIN_E2E_QR_TOKEN`, `test.skip`, `test.fixme` et toute branche conditionnelle vide; le token synthétique fixé par le runner reste réservé au harness partagé.

- [ ] **Step 2: Exécuter les tests ciblés et Playwright**

```powershell
Invoke-PlanNative 'tests finaux More-Quality' { node --test tests/admin-vnext-more-quality.test.mjs }
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
  Invoke-PlanNative 'E2E More-Quality Chromium' { node scripts/run-playwright-e2e.mjs e2e/admin-vnext-more-quality.spec.ts --build --project=chromium --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts }
} finally {
  foreach ($AdminEnvName in $AdminEnvNames) {
    [Environment]::SetEnvironmentVariable($AdminEnvName, $PreviousAdminEnv[$AdminEnvName], 'Process')
  }
}
```

- [ ] **Step 3: Exécuter les gates complets**

```powershell
Invoke-PlanNative 'assets More-Quality' { npm run assets:check }
Invoke-PlanNative 'LFS More-Quality' { npm run lfs:check }
Invoke-PlanNative 'lint final More-Quality' { npm run lint }
Invoke-PlanNative 'typecheck final More-Quality' { npm run typecheck }
Invoke-PlanNative 'build More-Quality' { npm run build }
Invoke-PlanNative 'suite admin More-Quality' { npm run test:admin }
```

Exécuter ensuite le gate navigateur final des cinq destinations avec les sept specs canoniques sur Chromium et WebKit, sans retry ni skip :

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
  Invoke-PlanNative 'sept specs Admin vNext Chromium/WebKit' { node scripts/run-playwright-e2e.mjs e2e/admin-vnext-today.spec.ts e2e/admin-vnext-availability.spec.ts e2e/admin-insights.spec.ts e2e/admin-insights-fidelity.spec.ts e2e/admin-vnext-assistant.spec.ts e2e/admin-vnext-reports.spec.ts e2e/admin-vnext-more-quality.spec.ts --build --project=chromium --project=webkit --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts }
} finally {
  foreach ($AdminEnvName in $AdminEnvNames) {
    [Environment]::SetEnvironmentVariable($AdminEnvName, $PreviousAdminEnv[$AdminEnvName], 'Process')
  }
}
```

Expected: les sept specs couvrant les cinq destinations passent dans les deux moteurs; un échec bloque B3 et repart au workstream propriétaire.

- [ ] **Step 4: Nettoyer, vérifier le scope et commit**

```powershell
Invoke-PlanNative 'diff-check More-Quality' { git diff --check }
Invoke-PlanNative 'scope diff More-Quality' { git diff --name-only "$ExpectedBase...HEAD" }
Invoke-PlanNative 'status More-Quality' { git status --short }
Invoke-PlanNative 'stage E2E More-Quality' { git add e2e/admin-vnext-more-quality.spec.ts }
Invoke-PlanNative 'commit E2E More-Quality' { git commit -m "test(admin): verify quality center" }
```
