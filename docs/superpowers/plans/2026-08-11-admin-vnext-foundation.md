# Vistaire Admin vNext Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la fondation additive de l’Admin vNext Vistaire : contrats de navigation à cinq destinations, shell premium responsive, préférences FR/EN et thème rendues côté serveur, sécurité anti-usurpation des en-têtes, états génériques et couverture TDD sans modifier les données ni les pages métier.

**Architecture:** Un module pur définit les routes et les préférences, puis le proxy transforme exclusivement les cookies admin validés en en-têtes internes nettoyés avant que le layout et le shell serveur ne rendent l’interface. La navigation desktop et la barre mobile partagent le même contrat ; les composants métier existants gardent leur API historique grâce à un adaptateur local dans `AdminShell`, et les primitives utilisées par la prévisualisation publique restent inchangées.

**Tech Stack:** Next.js 16 App Router et Proxy, React 19 Server Components, TypeScript 5.9 strict, CSS Modules, tests `node:test`, Playwright Chromium, npm.

## Global Constraints

- Base immuable de départ : `origin/main@a8f321fdb33cbb12dda6249e37a60a679183d4ea`.
- À l'ouverture du workstream, fixer `$ExpectedBase = 'a8f321fdb33cbb12dda6249e37a60a679183d4ea'`; toutes les vérifications de diff utilisent ce SHA, jamais une ref distante mouvante.
- Branche de travail unique : `feat/admin-vnext-foundation`; confirmer avant édition la branche, le HEAD et le merge-base au moyen des appels `Invoke-FoundationNative` du bootstrap ci-dessous.
- Installer exactement le lockfile au moyen du wrapper du bootstrap; n’ajouter aucune dépendance et ne modifier ni `package.json` ni `package-lock.json`.
- Travailler mobile-first et valider obligatoirement les largeurs 390 px et 430 px, puis la référence native à 1448 × 1086 px.
- Conserver l’esthétique Vistaire : surfaces chaudes sombres ou crème, accents champagne, typographies existantes, visuels food-first et mouvement retenu.
- Ne modifier aucune donnée, aucun loader, aucune mutation, aucune API métier, aucune page métier et aucun contenu restaurant.
- Ne pas créer `app/admin/reports/page.tsx`, `app/admin/more/page.tsx`, ni aucun fichier sous `app/admin/reports/**` ou `app/admin/more/**`. Les liens peuvent être rendus avec `prefetch={false}`; leurs pages arrivent uniquement après intégration des branches dédiées.
- Ne modifier aucun fichier sous `components/admin/overview/**`, `components/admin/availability/**`, `components/admin/insights/**`, `lib/admin/dashboard*.ts`, `lib/admin/availability.ts`, `lib/admin/analytics*.ts`, `app/admin/page.tsx`, `app/admin/availability/page.tsx` ou `app/admin/insights/page.tsx`.
- Les préférences utilisent uniquement `vistaire-admin-locale` et `vistaire-admin-theme`, toutes deux `HttpOnly`, `SameSite=Lax`, `Path=/admin`, `Secure` en production et `Max-Age=31536000`.
- Le proxy supprime toujours tout en-tête client `x-vistaire-admin-locale` et `x-vistaire-admin-theme`; il ne les recrée que pour `/admin` et `/admin/**` à partir des cookies admin validés.
- Valeurs autorisées : locale `fr | en`; thème `light | dark`; valeurs de repli : `fr` et `light`.
- Le rendu initial doit porter `lang`, `data-admin-locale` et `data-admin-theme` dès le SSR, sans dépendre de `localStorage` ni d’un effet React.
- Les cinq contrats sont exacts : `today=/admin`, `availability=/admin/availability`, `intelligence=/admin/insights`, `reports=/admin/reports`, `more=/admin/more`.
- La navigation mobile comporte cinq cibles visibles, sans défilement horizontal, avec zones tactiles d’au moins 44 × 44 px à 390 px et 430 px.
- Le focus clavier reste visible avec un contour d’au moins 2 px; le contraste est d’au moins 4,5:1 pour le texte courant et 3:1 pour les composants; `prefers-reduced-motion: reduce` ramène animations et transitions à `0.01ms` au maximum.
- Les états génériques du shell sont exactement `loading | empty | error | forbidden`, avec sémantique `status` pour `loading` et `empty`, `alert` pour `error` et `forbidden`.
- `components/admin/system/AdminPresentationPrimitives.tsx` est une frontière de compatibilité en lecture seule : la prévisualisation publique continue à importer directement ses primitives depuis ce chemin. Aucun renommage, déplacement, retrait d’export ou ajout de dépendance serveur n’est permis.
- Les nouveaux tests Node portent tous le préfixe `tests/admin-foundation-` et le test navigateur est `e2e/admin-foundation.spec.ts`.
- `e2e/admin-foundation.spec.ts` et le legacy possédé `e2e/admin-visual.spec.ts` sont contractuellement sans `test.skip`, `test.fixme`, QR token ou navigation absolue non-loopback. La spec Foundation installe avant navigation une garde réseau qui rejette toute requête HTTP(S), WebSocket ou EventSource dont le host n'est pas `localhost`, `127.0.0.1` ou `::1`; le contrat source confirme que le legacy ne navigue que par chemins relatifs sous le runner loopback.
- Toute invocation Playwright passe par `Invoke-FoundationPlaywright`, force une fixture synthétique locale avec scénario `available`, interdit les skips via `e2e/support/forbid-skipped-tests-reporter.ts`, force le serveur local et restaure exactement l'environnement du processus dans un `finally`.
- Chaque cycle suit RED → vérification de l’échec attendu → GREEN minimal → validation ciblée → commit ciblé.

Au début de chaque session PowerShell Foundation, définir le worktree absolu et ce wrapper. Toute commande native de test, installation, gate, staging ou commit passe par lui. Un RED utilise `-ExpectFailure` : un code zéro devient alors bloquant et aucun échec attendu n'est masqué.

```powershell
$FoundationWorktree = (Resolve-Path -LiteralPath 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-foundation' -ErrorAction Stop).Path
if (-not [System.IO.Path]::IsPathFullyQualified($FoundationWorktree)) {
  throw 'Le worktree Foundation doit être un chemin absolu.'
}
$ExpectedBase = 'a8f321fdb33cbb12dda6249e37a60a679183d4ea'

function Invoke-FoundationNative {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command,
    [switch]$ExpectFailure,
    [int[]]$ExpectedFailureExitCodes = @(1)
  )

  $Pushed = $false
  $PreviousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Stop'
    Push-Location -LiteralPath $FoundationWorktree -ErrorAction Stop
    $Pushed = $true
    if ($ExpectFailure -and $ExpectedFailureExitCodes.Count -eq 0) {
      throw "$Label requiert au moins un code d'échec attendu."
    }
    & $Command
    $ExitCode = $LASTEXITCODE

    if ($ExpectFailure) {
      if ($ExitCode -eq 0) {
        throw "$Label devait échouer en RED mais a réussi."
      }
      if ($ExitCode -notin $ExpectedFailureExitCodes) {
        throw "$Label a échoué avec le code inattendu $ExitCode; attendus: $($ExpectedFailureExitCodes -join ', ')."
      }
      Write-Output "$Label : échec RED observé (exit=$ExitCode)."
      return
    }

    if ($ExitCode -ne 0) {
      throw "$Label a échoué (exit=$ExitCode)."
    }
  } finally {
    try {
      if ($Pushed) {
        Pop-Location
      }
    } finally {
      $ErrorActionPreference = $PreviousErrorActionPreference
    }
  }
}

function Invoke-FoundationPlaywright {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$Specs,
    [string[]]$AdditionalArguments = @(),
    [switch]$ExpectFailure
  )

  if ($Specs.Count -eq 0) { throw "$Label exige au moins une spec Playwright explicite." }
  $EnvironmentNames = @(
    'VISTAIRE_ADMIN_VISUAL_FIXTURE',
    'VISTAIRE_REQUIRE_ADMIN_E2E',
    'VISTAIRE_ADMIN_FIXTURE_SCENARIO',
    'VISTAIRE_ADMIN_E2E_QR_TOKEN',
    'VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT',
    'PLAYWRIGHT_BASE_URL',
    'PLAYWRIGHT_SKIP_WEB_SERVER'
  )
  $PreviousEnvironment = @{}
  foreach ($Name in $EnvironmentNames) {
    $PreviousEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
  }

  try {
    [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_VISUAL_FIXTURE', '1', 'Process')
    [Environment]::SetEnvironmentVariable('VISTAIRE_REQUIRE_ADMIN_E2E', '1', 'Process')
    [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_FIXTURE_SCENARIO', 'available', 'Process')
    [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_E2E_QR_TOKEN', '15000000-0000-0000-0000-000000000150', 'Process')
    [Environment]::SetEnvironmentVariable('VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT', '3110', 'Process')
    [Environment]::SetEnvironmentVariable('PLAYWRIGHT_BASE_URL', 'http://127.0.0.1:3000', 'Process')
    [Environment]::SetEnvironmentVariable('PLAYWRIGHT_SKIP_WEB_SERVER', '0', 'Process')
    $Arguments = @('scripts/run-playwright-e2e.mjs') + $Specs + @(
      '--build',
      '--project=chromium',
      '--workers=1',
      '--retries=0',
      '--forbid-only',
      '--reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts'
    ) + $AdditionalArguments
    Invoke-FoundationNative $Label { & node @Arguments } -ExpectFailure:$ExpectFailure
  } finally {
    foreach ($Name in $EnvironmentNames) {
      [Environment]::SetEnvironmentVariable($Name, $PreviousEnvironment[$Name], 'Process')
    }
  }
}

function Invoke-FoundationNpmCi {
  param([Parameter(Mandatory = $true)][string]$Label)

  $Lockfile = Join-Path $FoundationWorktree 'package-lock.json'
  $BeforeHash = (Get-FileHash -LiteralPath $Lockfile -Algorithm SHA256 -ErrorAction Stop).Hash
  $BeforePorcelain = Invoke-FoundationNative "$Label : état lockfile avant" { git status --porcelain -- package-lock.json }
  if ($BeforePorcelain) { throw "$Label refusé: package-lock.json est déjà modifié avant npm ci." }
  $InstallFailure = $null
  try {
    Invoke-FoundationNative $Label { npm ci }
  } catch {
    $InstallFailure = $_
  }
  $AfterHash = (Get-FileHash -LiteralPath $Lockfile -Algorithm SHA256 -ErrorAction Stop).Hash
  $AfterPorcelain = Invoke-FoundationNative "$Label : état lockfile après" { git status --porcelain -- package-lock.json }
  if ($AfterHash -ne $BeforeHash -or $AfterPorcelain) {
    throw "$Label a modifié package-lock.json; arrêter sans restauration destructive."
  }
  if ($InstallFailure) { throw $InstallFailure }
}

Invoke-FoundationNative 'status initial Foundation' { git status --short --branch }
$ActualHead = Invoke-FoundationNative 'HEAD initial Foundation' { git rev-parse HEAD }
$ActualBase = Invoke-FoundationNative 'merge-base initial Foundation' { git merge-base HEAD $ExpectedBase }
if ($ActualHead -ne $ExpectedBase -or $ActualBase -ne $ExpectedBase) {
  throw "Foundation doit démarrer exactement depuis $ExpectedBase."
}
Invoke-FoundationNpmCi 'installation lockfile Foundation'
```

### Ownership exclusif de la branche

Les seuls fichiers de production autorisés en écriture sont :

- `proxy.ts`
- `app/admin/layout.tsx`
- `app/admin/loading.tsx`
- `app/admin/preferences/route.ts` (création)
- `components/admin/system/AdminIcons.tsx`
- `components/admin/system/AdminNav.tsx`
- `components/admin/system/AdminShell.tsx`
- `components/admin/system/AdminPreferencesControls.tsx` (création)
- `components/admin/system/AdminShellState.tsx` (création)
- `components/admin/system/AdminSystem.module.css`
- `lib/admin/foundationRoutes.ts` (création)
- `lib/admin/preferences.ts` (création)

Les seuls fichiers de test autorisés en écriture sont :

- `tests/admin-foundation-routes.test.mjs` (création)
- `tests/admin-foundation-navigation.test.mjs` (création)
- `tests/admin-foundation-preferences.test.mjs` (création)
- `tests/admin-foundation-security.test.mjs` (création)
- `tests/admin-foundation-shell.test.mjs` (création)
- `e2e/admin-foundation.spec.ts` (création)
- `e2e/admin-visual.spec.ts` (mise à jour limitée aux attentes de navigation passant de trois à cinq liens)

Tout chemin absent de ces deux listes est hors ownership. Si une exigence semble demander un autre fichier, arrêter l’exécution et faire arbitrer le périmètre avant toute édition.

---

### Task 1: Figer les contrats TypeScript des cinq destinations

**Files:**

- Create: `lib/admin/foundationRoutes.ts`
- Create: `tests/admin-foundation-routes.test.mjs`

**Interfaces:**

- Produces: `AdminRouteId`, `AdminRoutePath`, `AdminLocale`, `AdminRouteAvailability`, `AdminRouteDefinition`, `ADMIN_ROUTE_PATHS`, `ADMIN_ROUTES`, `normalizeLegacyAdminRoute`.
- Consumes: aucune donnée métier; ce module doit rester pur, sans import React, Next.js, serveur ou navigateur.

- [ ] **Step 1: Écrire le test RED du contrat exact**

Créer `tests/admin-foundation-routes.test.mjs` avec des assertions de valeur et d’immuabilité :

```js
import test from "node:test";
import assert from "node:assert/strict";

const routes = await import("../lib/admin/foundationRoutes.ts");

test("admin vNext exposes the exact five-route contract", () => {
  assert.deepEqual(routes.ADMIN_ROUTE_PATHS, {
    today: "/admin",
    availability: "/admin/availability",
    intelligence: "/admin/insights",
    reports: "/admin/reports",
    more: "/admin/more"
  });
  assert.deepEqual(routes.ADMIN_ROUTES.map(({ id, href, availability }) => ({ id, href, availability })), [
    { id: "today", href: "/admin", availability: "integrated" },
    { id: "availability", href: "/admin/availability", availability: "integrated" },
    { id: "intelligence", href: "/admin/insights", availability: "integrated" },
    { id: "reports", href: "/admin/reports", availability: "deferred" },
    { id: "more", href: "/admin/more", availability: "deferred" }
  ]);
});

test("legacy page identifiers map additively to vNext identifiers", () => {
  assert.equal(routes.normalizeLegacyAdminRoute("overview"), "today");
  assert.equal(routes.normalizeLegacyAdminRoute("availability"), "availability");
  assert.equal(routes.normalizeLegacyAdminRoute("insights"), "intelligence");
});
```

- [ ] **Step 2: Exécuter le test et confirmer l’échec utile**

```powershell
Invoke-FoundationNative 'RED contrats routes Foundation' { node --test tests/admin-foundation-routes.test.mjs } -ExpectFailure
```

Expected: FAIL parce que `lib/admin/foundationRoutes.ts` n’existe pas; toute erreur de syntaxe du test doit être corrigée avant GREEN.

- [ ] **Step 3: Implémenter le contrat GREEN minimal**

Créer `lib/admin/foundationRoutes.ts` avec ces signatures et ces valeurs exactes :

```ts
export type AdminLocale = "fr" | "en";
export type AdminRouteId = "today" | "availability" | "intelligence" | "reports" | "more";
export type AdminRoutePath =
  | "/admin"
  | "/admin/availability"
  | "/admin/insights"
  | "/admin/reports"
  | "/admin/more";
export type AdminRouteAvailability = "integrated" | "deferred";
export type LegacyAdminRoute = "overview" | "availability" | "insights";

export type AdminRouteDefinition = Readonly<{
  id: AdminRouteId;
  href: AdminRoutePath;
  label: Readonly<Record<AdminLocale, string>>;
  availability: AdminRouteAvailability;
}>;

export const ADMIN_ROUTE_PATHS = Object.freeze({
  today: "/admin",
  availability: "/admin/availability",
  intelligence: "/admin/insights",
  reports: "/admin/reports",
  more: "/admin/more"
} as const satisfies Record<AdminRouteId, AdminRoutePath>);

export const ADMIN_ROUTES = Object.freeze([
  { id: "today", href: ADMIN_ROUTE_PATHS.today, label: { fr: "Aujourd’hui", en: "Today" }, availability: "integrated" },
  { id: "availability", href: ADMIN_ROUTE_PATHS.availability, label: { fr: "Disponibilités", en: "Availability" }, availability: "integrated" },
  { id: "intelligence", href: ADMIN_ROUTE_PATHS.intelligence, label: { fr: "Intelligence", en: "Intelligence" }, availability: "integrated" },
  { id: "reports", href: ADMIN_ROUTE_PATHS.reports, label: { fr: "Rapports", en: "Reports" }, availability: "deferred" },
  { id: "more", href: ADMIN_ROUTE_PATHS.more, label: { fr: "Plus", en: "More" }, availability: "deferred" }
] as const satisfies readonly AdminRouteDefinition[]);

export function normalizeLegacyAdminRoute(route: LegacyAdminRoute): AdminRouteId {
  if (route === "overview") return "today";
  if (route === "insights") return "intelligence";
  return "availability";
}
```

- [ ] **Step 4: Valider GREEN et les types**

```powershell
Invoke-FoundationNative 'GREEN contrats routes Foundation' { node --test tests/admin-foundation-routes.test.mjs }
```

Expected: PASS, cinq routes dans l’ordre exact et adaptateur historique stable.

```powershell
Invoke-FoundationNative 'typecheck contrats routes Foundation' { npm run typecheck }
```

Expected: PASS sans émission.

- [ ] **Step 5: Commit ciblé**

```powershell
Invoke-FoundationNative 'stage contrats routes Foundation' { git add lib/admin/foundationRoutes.ts tests/admin-foundation-routes.test.mjs }
Invoke-FoundationNative 'commit contrats routes Foundation' { git commit -m "feat(admin): define vnext foundation routes" }
```

### Task 2: Construire la navigation desktop et la bottom nav mobile

**Files:**

- Create: `tests/admin-foundation-navigation.test.mjs`
- Create: `e2e/admin-foundation.spec.ts`
- Modify: `components/admin/system/AdminIcons.tsx`
- Modify: `components/admin/system/AdminNav.tsx`
- Modify: `components/admin/system/AdminShell.tsx`
- Modify: `components/admin/system/AdminSystem.module.css`
- Modify: `e2e/admin-visual.spec.ts` uniquement aux assertions `toHaveCount(3)` et snapshot de labels de la navigation admin

**Interfaces:**

- Consumes: `ADMIN_ROUTES`, `AdminLocale`, `AdminRouteId`, `LegacyAdminRoute`, `normalizeLegacyAdminRoute` depuis `lib/admin/foundationRoutes.ts`.
- Produces: `AdminNavProps = { active: AdminRouteId; locale: AdminLocale; variant: "desktop" | "mobile" }`, une API `AdminShell` additive acceptant soit `activeRoute`, soit l'ancien `active`, et deux icônes additives `ReportsIcon`, `MoreIcon`.
- Compatibility: `AdminShell` accepte `{ activeRoute: AdminRouteId; active?: never } | { active: LegacyAdminRoute; activeRoute?: never }`. Les trois pages existantes continuent d'utiliser `active`; les pages vNext utilisent `activeRoute`. Le shell normalise une seule route canonique avant `AdminNav` et ne rend `AdminTabs` caché que pour le chemin legacy.

- [ ] **Step 1: Écrire les tests RED Node et Playwright avant le JSX**

Créer `tests/admin-foundation-navigation.test.mjs` pour lire les sources et exiger : import unique du contrat, deux variantes de navigation, cinq liens issus de `ADMIN_ROUTES`, `prefetch={false}` pour les routes différées, adaptateur historique dans le shell, et maintien d’un `AdminTabs` masqué pour la compatibilité des tests existants. Le même test lit `e2e/admin-foundation.spec.ts` et `e2e/admin-visual.spec.ts`, interdit littéralement `test.skip`, `test.fixme`, `describe.skip`, `VISTAIRE_ADMIN_E2E_QR_TOKEN` et toute URL HTTP(S)/WebSocket non-loopback, exige la garde réseau loopback dans la nouvelle spec et confirme que chaque `page.goto` legacy reste relatif.

Créer le premier test de `e2e/admin-foundation.spec.ts` avec l’aide locale `enterLocalPreview(page)` reprise de `e2e/admin-visual.spec.ts`. Installer dans `test.beforeEach` une route qui laisse continuer uniquement les requêtes dont `new URL(request.url()).hostname` vaut `localhost`, `127.0.0.1` ou `[::1]`, et throw avec une URL neutralisée pour toute destination HTTP(S), WebSocket ou EventSource différente. Ajouter ensuite cette matrice :

```ts
const expected = [
  ["/admin", "Aujourd’hui"],
  ["/admin/availability", "Disponibilités"],
  ["/admin/insights", "Intelligence"],
  ["/admin/reports", "Rapports"],
  ["/admin/more", "Plus"]
] as const;

for (const viewport of [
  { width: 1448, height: 1086, visible: "desktop" },
  { width: 390, height: 844, visible: "mobile" },
  { width: 430, height: 932, visible: "mobile" }
] as const) {
  await page.setViewportSize(viewport);
  await page.goto("/admin", { waitUntil: "networkidle" });
  const visibleNav = page.locator(`[data-admin-nav="${viewport.visible}"]`);
  await expect(visibleNav).toBeVisible();
  await expect(visibleNav.locator("a")).toHaveCount(5);
  for (const [href, label] of expected) {
    await expect(visibleNav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
```

Dans `e2e/admin-visual.spec.ts`, remplacer uniquement les deux comptes de navigation `3` par `5`, puis mettre le snapshot textuel en cohérence avec `Aujourd’hui`, `Disponibilités`, `Intelligence`, `Rapports` et `Plus`. Ne pas ouvrir `/admin/reports` ni `/admin/more`.

- [ ] **Step 2: Vérifier les échecs RED**

```powershell
Invoke-FoundationNative 'RED navigation Foundation' { node --test tests/admin-foundation-navigation.test.mjs } -ExpectFailure
```

Expected: FAIL parce que les variantes, les deux icônes et les cinq liens ne sont pas encore présents.

```powershell
Invoke-FoundationPlaywright -Label 'RED E2E navigation Foundation' -Specs @('e2e/admin-foundation.spec.ts') -ExpectFailure
```

Expected: FAIL avec trois liens au lieu de cinq; la prévisualisation locale doit néanmoins se charger avant l’assertion.

- [ ] **Step 3: Implémenter les deux navigations GREEN**

Ajouter dans `AdminIcons.tsx` deux SVG `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `aria-hidden="true"` : `ReportsIcon` dessine une feuille avec trois lignes; `MoreIcon` dessine trois cercles de rayon 1,5.

Refondre `AdminNav.tsx` autour de cette API exacte :

```ts
export type AdminNavProps = {
  active: AdminRouteId;
  locale: AdminLocale;
  variant: "desktop" | "mobile";
};

export function AdminNav({ active, locale, variant }: AdminNavProps) {
  const navigationLabels = {
    fr: { desktop: "Navigation principale du restaurant", mobile: "Navigation du restaurant" },
    en: { desktop: "Primary restaurant navigation", mobile: "Restaurant navigation" }
  } as const;
  return (
    <nav
      aria-label={navigationLabels[locale][variant]}
      className={variant === "desktop" ? styles.desktopNav : styles.mobileNav}
      data-admin-nav={variant}
    >
      {ADMIN_ROUTES.map((route) => (
        <Link
          aria-current={active === route.id ? "page" : undefined}
          data-route-availability={route.availability}
          href={route.href}
          key={route.id}
          prefetch={route.availability === "integrated" ? undefined : false}
        >
          {iconForAdminRoute(route.id)}
          <span>{route.label[locale]}</span>
        </Link>
      ))}
    </nav>
  );
}
```

Dans `AdminShell.tsx`, définir les props de route discriminées ci-dessus, calculer `canonicalActive = activeRoute ?? normalizeLegacyAdminRoute(active)`, conserver la chaîne littérale `<AdminTabs active={active}` uniquement dans la branche où `active` existe et dans un conteneur `hidden`, puis rendre les deux `AdminNav` avec `active={canonicalActive}`. Pour ce commit, passer `locale="fr"`; la locale SSR sera branchée dans la Task 4. Les tests compilent les cinq valeurs de `AdminRouteId` et les trois valeurs legacy.

Dans `AdminSystem.module.css` :

- `.desktopNav` est une grille de cinq colonnes au-dessus du contenu à partir de 701 px;
- `.mobileNav` devient une grille de cinq colonnes fixe au bas de l’écran jusqu’à 700 px;
- chaque lien mesure au moins 44 × 44 px;
- les labels mobiles utilisent au minimum 10 px et peuvent aller sur deux lignes sans dépasser leur cellule;
- `.dashboard` conserve un padding inférieur incluant `env(safe-area-inset-bottom)`;
- les liens différés restent visuellement lisibles, sans opacité inférieure à 0,72;
- aucun `overflow-x: auto` n’est introduit.

- [ ] **Step 4: Valider la navigation GREEN**

```powershell
Invoke-FoundationNative 'GREEN navigation Foundation' { node --test tests/admin-foundation-routes.test.mjs tests/admin-foundation-navigation.test.mjs tests/admin-dashboard-ui.test.mjs }
```

Expected: PASS, y compris l’entrée historique `AdminTabs` et les tests visuels source existants.

```powershell
Invoke-FoundationPlaywright -Label 'GREEN E2E navigation Foundation' -Specs @('e2e/admin-foundation.spec.ts')
```

Expected: PASS à 1448 × 1086, 390 et 430; cinq liens, aucune barre horizontale, aucune requête de préchargement vers Rapports ou Plus.

- [ ] **Step 5: Commit ciblé**

```powershell
Invoke-FoundationNative 'stage navigation Foundation' { git add components/admin/system/AdminIcons.tsx components/admin/system/AdminNav.tsx components/admin/system/AdminShell.tsx components/admin/system/AdminSystem.module.css tests/admin-foundation-navigation.test.mjs e2e/admin-foundation.spec.ts e2e/admin-visual.spec.ts }
Invoke-FoundationNative 'commit navigation Foundation' { git commit -m "feat(admin): add responsive vnext navigation" }
```

### Task 3: Définir les préférences validées et leur endpoint admin-only

**Files:**

- Create: `lib/admin/preferences.ts`
- Create: `app/admin/preferences/route.ts`
- Create: `tests/admin-foundation-preferences.test.mjs`

**Interfaces:**

- Consumes: `AdminLocale` depuis `lib/admin/foundationRoutes.ts`.
- Produces: `AdminTheme`, `AdminPreferences`, `AdminPreferenceMutation`, constantes cookies/en-têtes, parseurs fermés, options cookies et normalisation du retour admin.

Les signatures publiques sont exactes :

```ts
export type AdminTheme = "light" | "dark";
export type AdminPreferences = Readonly<{ locale: AdminLocale; theme: AdminTheme }>;
export type AdminPreferenceMutation =
  | Readonly<{ kind: "locale"; value: AdminLocale }>
  | Readonly<{ kind: "theme"; value: AdminTheme }>;

export function parseAdminLocale(value: unknown): AdminLocale | null;
export function parseAdminTheme(value: unknown): AdminTheme | null;
export function resolveAdminPreferences(localeCookie: unknown, themeCookie: unknown): AdminPreferences;
export function parseAdminPreferenceMutation(input: FormData): AdminPreferenceMutation | null;
export function sanitizeAdminReturnTo(value: string | null, requestOrigin: string): string;
```

- [ ] **Step 1: Écrire les tests RED de validation et de cookie**

Dans `tests/admin-foundation-preferences.test.mjs`, couvrir les tables exactes :

```js
test("admin preferences accept only closed locale and theme unions", () => {
  assert.equal(parseAdminLocale("fr"), "fr");
  assert.equal(parseAdminLocale("en"), "en");
  assert.equal(parseAdminLocale("EN"), null);
  assert.equal(parseAdminTheme("dark"), "dark");
  assert.equal(parseAdminTheme("light"), "light");
  assert.equal(parseAdminTheme("sepia"), null);
  assert.equal(parseAdminTheme("system"), null);
  assert.deepEqual(resolveAdminPreferences("attacker", "attacker"), { locale: "fr", theme: "light" });
});

test("return targets stay on the same admin origin", () => {
  assert.equal(sanitizeAdminReturnTo("https://www.vistaire.ca/admin/insights?range=30d", "https://www.vistaire.ca"), "/admin/insights?range=30d");
  assert.equal(sanitizeAdminReturnTo("https://evil.example/admin", "https://www.vistaire.ca"), "/admin");
  assert.equal(sanitizeAdminReturnTo("//evil.example/admin", "https://www.vistaire.ca"), "/admin");
  assert.equal(sanitizeAdminReturnTo("/owner", "https://www.vistaire.ca"), "/admin");
});
```

Importer ensuite `POST` de `app/admin/preferences/route.ts` avec le même hook d’alias que `tests/proxy-matcher.test.mjs`. Envoyer un formulaire valide puis invalide et vérifier : status 303 contre 400, un seul `Set-Cookie`, `Path=/admin`, `HttpOnly`, `SameSite=Lax`, `Max-Age=31536000`, et absence de cookie pour l’entrée invalide. Ajouter des cas origine absente, origine externe, `Sec-Fetch-Site: cross-site`, content type non `application/x-www-form-urlencoded` et body déclaré supérieur à 1 024 octets; tous sont refusés avant `request.formData()` et sans cookie.

- [ ] **Step 2: Vérifier l’échec RED**

```powershell
Invoke-FoundationNative 'RED préférences Foundation' { node --test tests/admin-foundation-preferences.test.mjs } -ExpectFailure
```

Expected: FAIL parce que le module et le route handler n’existent pas.

- [ ] **Step 3: Implémenter le domaine et le POST GREEN**

Dans `lib/admin/preferences.ts`, définir exactement :

```ts
export const ADMIN_LOCALE_COOKIE = "vistaire-admin-locale";
export const ADMIN_THEME_COOKIE = "vistaire-admin-theme";
export const ADMIN_LOCALE_HEADER = "x-vistaire-admin-locale";
export const ADMIN_THEME_HEADER = "x-vistaire-admin-theme";
export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = Object.freeze({ locale: "fr", theme: "light" });
export const ADMIN_PREFERENCE_COOKIE_MAX_AGE = 31_536_000;
```

Les parseurs utilisent des comparaisons strictes, sans normalisation permissive. `parseAdminPreferenceMutation` accepte seulement `kind=locale` avec `fr|en`, ou `kind=theme` avec `light|dark`. `sanitizeAdminReturnTo` construit une URL avec `requestOrigin`, exige l’origine identique, exige `pathname === "/admin" || pathname.startsWith("/admin/")`, puis retourne `pathname + search`; sinon il retourne `/admin`.

Dans `app/admin/preferences/route.ts`, exporter `runtime = "nodejs"`, `dynamic = "force-dynamic"` et `POST(request: NextRequest)`. Le handler :

1. appelle `isSameOriginAdminMutation` de `lib/admin/qrAccessInputCore.ts` avec `Origin`, `Sec-Fetch-Site` et `request.nextUrl.origin`; toute absence/incohérence retourne 403;
2. exige exactement `application/x-www-form-urlencoded` et une longueur déclarée entière inférieure ou égale à 1 024 octets, sinon 415/413;
3. lit `request.formData()`;
4. renvoie JSON 400 avec `Cache-Control: no-store` si la mutation est invalide;
5. calcule le retour depuis `Referer` avec `sanitizeAdminReturnTo`;
6. crée une redirection 303;
7. écrit uniquement le cookie correspondant avec `{ httpOnly: true, sameSite: "lax", path: "/admin", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000 }`;
8. ajoute `Cache-Control: no-store` et `Referrer-Policy: no-referrer` sur succès comme sur erreur.

- [ ] **Step 4: Valider GREEN et l’isolation**

```powershell
Invoke-FoundationNative 'GREEN préférences Foundation' { node --test tests/admin-foundation-preferences.test.mjs }
```

Expected: PASS pour toutes les valeurs valides, toutes les valeurs rejetées, les retours externes et les attributs cookies.

```powershell
Invoke-FoundationNative 'typecheck préférences Foundation' { npm run typecheck }
```

Expected: PASS; aucun import vers les loaders ou mutations métier.

- [ ] **Step 5: Commit ciblé**

```powershell
Invoke-FoundationNative 'stage préférences Foundation' { git add lib/admin/preferences.ts app/admin/preferences/route.ts tests/admin-foundation-preferences.test.mjs }
Invoke-FoundationNative 'commit préférences Foundation' { git commit -m "feat(admin): add scoped preference contract" }
```

### Task 4: Rendre locale et thème en SSR avec proxy anti-spoofing

**Files:**

- Create: `components/admin/system/AdminPreferencesControls.tsx`
- Create: `tests/admin-foundation-security.test.mjs`
- Modify: `proxy.ts`
- Modify: `app/admin/layout.tsx`
- Modify: `components/admin/system/AdminShell.tsx`
- Modify: `components/admin/system/AdminSystem.module.css`
- Modify: `e2e/admin-foundation.spec.ts`

**Interfaces:**

- Consumes: toutes les constantes et fonctions de `lib/admin/preferences.ts` et `AdminLocale` dans le shell.
- Produces: `readAdminPreferencesFromHeaders(headers: Pick<Headers, "get">): AdminPreferences` et `AdminPreferencesControls({ preferences }: { preferences: AdminPreferences })`.
- Security boundary: seuls les en-têtes réécrits par `proxy.ts` sont lus par le layout et le shell; ils ne lisent jamais directement une valeur fournie dans l’URL ou dans un en-tête client.

- [ ] **Step 1: Écrire les tests RED anti-spoofing et SSR**

Dans `tests/admin-foundation-security.test.mjs`, reprendre l’initialisation `AsyncLocalStorage`, `registerHooks`, `NextRequest` et l’import du proxy de `tests/proxy-matcher.test.mjs`, puis tester :

```js
test("spoofed admin preference headers are deleted before SSR", async () => {
  const response = await proxy(new NextRequest("https://www.vistaire.ca/admin", {
    headers: {
      "x-vistaire-admin-locale": "en",
      "x-vistaire-admin-theme": "light"
    }
  }), undefined);
  assert.equal(response.headers.get("x-middleware-request-x-vistaire-admin-locale"), "fr");
  assert.equal(response.headers.get("x-middleware-request-x-vistaire-admin-theme"), "light");
});

test("validated admin cookies become trusted internal headers only on admin paths", async () => {
  const cookie = "vistaire-admin-locale=en; vistaire-admin-theme=dark";
  const admin = await proxy(new NextRequest("https://www.vistaire.ca/admin/insights", { headers: { cookie } }), undefined);
  assert.equal(admin.headers.get("x-middleware-request-x-vistaire-admin-locale"), "en");
  assert.equal(admin.headers.get("x-middleware-request-x-vistaire-admin-theme"), "dark");
  const publicPage = await proxy(new NextRequest("https://www.vistaire.ca/en", { headers: { cookie } }), undefined);
  assert.equal(publicPage.headers.get("x-middleware-request-x-vistaire-admin-locale"), null);
  assert.equal(publicPage.headers.get("x-middleware-request-x-vistaire-admin-theme"), null);
});
```

Ajouter des lectures source qui exigent `await headers()` dans `app/admin/layout.tsx`, les attributs SSR, et interdisent `localStorage`, `useEffect`, `cookies()` et la lecture d’un en-tête non nettoyé. Exiger aussi que le proxy remplace `VISTAIRE_LOCALE_HEADER` par la locale admin validée sur `/admin/**`, afin que `app/layout.tsx` rende le vrai `<html lang="fr-CA|en-CA">` et le skip-link dans la bonne langue sans modifier le comportement des routes publiques.

Ajouter dans `e2e/admin-foundation.spec.ts` un test qui change FR→EN et light→dark via les formulaires, attend la redirection, recharge la page, puis vérifie `data-admin-locale="en"`, `data-admin-theme="dark"`, les labels anglais et les deux cookies avec `path === "/admin"`. Enregistrer les en-têtes de requête pour confirmer que ces cookies ne sont pas envoyés sur `/`.

- [ ] **Step 2: Vérifier les échecs RED**

```powershell
Invoke-FoundationNative 'RED sécurité SSR Foundation' { node --test tests/admin-foundation-security.test.mjs } -ExpectFailure
```

Expected: FAIL : les en-têtes admin ne sont pas reconstruits, le layout n’expose pas les attributs et les contrôles n’existent pas.

```powershell
Invoke-FoundationPlaywright -Label 'RED E2E préférences Foundation' -Specs @('e2e/admin-foundation.spec.ts') -AdditionalArguments @('--grep', 'preferences') -ExpectFailure
```

Expected: FAIL parce que les formulaires et les cookies admin n’existent pas.

- [ ] **Step 3: Implémenter le proxy de confiance GREEN**

Ajouter dans `lib/admin/preferences.ts` :

```ts
export function readAdminPreferencesFromHeaders(headers: Pick<Headers, "get">): AdminPreferences {
  return resolveAdminPreferences(
    headers.get(ADMIN_LOCALE_HEADER),
    headers.get(ADMIN_THEME_HEADER)
  );
}
```

Dans `proxy.ts`, étendre `requestHeadersWithLocale` sans changer le matcher ni les chemins Clerk/Supabase :

```ts
const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

requestHeaders.delete(ADMIN_LOCALE_HEADER);
requestHeaders.delete(ADMIN_THEME_HEADER);
if (isAdminPath(request.nextUrl.pathname)) {
  const preferences = resolveAdminPreferences(
    request.cookies.get(ADMIN_LOCALE_COOKIE)?.value,
    request.cookies.get(ADMIN_THEME_COOKIE)?.value
  );
  requestHeaders.set(ADMIN_LOCALE_HEADER, preferences.locale);
  requestHeaders.set(ADMIN_THEME_HEADER, preferences.theme);
  requestHeaders.set(VISTAIRE_LOCALE_HEADER, preferences.locale);
}
```

Ces suppressions doivent se produire avant toute sortie `NextResponse.next`, y compris le chemin ordinaire et les réponses passant par Clerk. Ne jamais faire confiance à la valeur initiale de `request.headers` pour ces deux noms.

- [ ] **Step 4: Implémenter le SSR, les contrôles et les thèmes GREEN**

Rendre `AdminLayout` asynchrone, lire `await headers()`, résoudre les préférences, puis rendre :

```tsx
<div
  className={styles.adminRoot}
  data-admin-locale={preferences.locale}
  data-admin-theme={preferences.theme}
  lang={preferences.locale === "fr" ? "fr-CA" : "en-CA"}
>
  <AdminPreferencesControls preferences={preferences} />
  {children}
</div>
```

`AdminPreferencesControls.tsx` reste un Server Component sans directive client. Il contient deux formulaires POST vers `/admin/preferences` : un groupe `Langue/Language` avec boutons `fr` et `en`, puis un groupe `Thème/Theme` avec boutons `light` et `dark`. Chaque formulaire inclut `kind` en champ caché; chaque bouton porte `name="value"`, sa valeur fermée, `aria-pressed`, un libellé visible localisé et une zone de 44 × 44 px.

Rendre `AdminShell` asynchrone, lire les mêmes en-têtes de confiance et remplacer les deux `locale="fr"` par `locale={preferences.locale}`. Ne changer ni ses props métier ni `AdminMenuActions`.

Dans `AdminSystem.module.css`, conserver les variables dark existantes comme repli, puis ajouter :

```css
.adminRoot[data-admin-theme="light"] {
  color-scheme: light;
  --admin-bg: #f7f0e4;
  --admin-surface: #fffaf1;
  --admin-surface-raised: #f1e6d6;
  --admin-border: #b8a990;
  --admin-border-soft: #d7c9b5;
  --admin-accent: #77501f;
  --admin-accent-soft: #ead9bd;
  --admin-text: #211c16;
  --admin-muted: #5f574e;
}
```

Styliser `.adminPreferences` et ses boutons dans le scope `.adminRoot`, sans surface froide, avec focus visible et repli mobile ne recouvrant ni le header ni la bottom nav.

- [ ] **Step 5: Valider sécurité et persistance GREEN**

```powershell
Invoke-FoundationNative 'GREEN sécurité SSR Foundation' { node --test tests/admin-foundation-preferences.test.mjs tests/admin-foundation-security.test.mjs tests/proxy-matcher.test.mjs }
```

Expected: PASS; spoofing neutralisé, cookies validés, proxy historique intact.

```powershell
Invoke-FoundationPlaywright -Label 'GREEN E2E préférences Foundation' -Specs @('e2e/admin-foundation.spec.ts')
```

Expected: PASS; le premier HTML et chaque rechargement reflètent la préférence sans flash de thème, `document.documentElement.lang` suit la locale admin, les cookies restent sous `/admin`, et les labels EN sont visibles après mutation.

- [ ] **Step 6: Commit ciblé**

```powershell
Invoke-FoundationNative 'stage SSR préférences Foundation' { git add lib/admin/preferences.ts proxy.ts app/admin/layout.tsx components/admin/system/AdminPreferencesControls.tsx components/admin/system/AdminShell.tsx components/admin/system/AdminSystem.module.css tests/admin-foundation-security.test.mjs e2e/admin-foundation.spec.ts }
Invoke-FoundationNative 'commit SSR préférences Foundation' { git commit -m "feat(admin): render scoped preferences on the server" }
```

### Task 5: Ajouter les états génériques et verrouiller accessibilité et compatibilité publique

**Files:**

- Create: `components/admin/system/AdminShellState.tsx`
- Create: `tests/admin-foundation-shell.test.mjs`
- Modify: `app/admin/loading.tsx`
- Modify: `components/admin/system/AdminSystem.module.css`
- Modify: `e2e/admin-foundation.spec.ts`
- Read only: `components/admin/system/AdminPresentationPrimitives.tsx`
- Read only: `components/vistaire-preview/RestaurateurDashboardDemo.tsx`
- Read only: `components/vistaire-preview/RestaurateurPreviewOverview.tsx`
- Read only: `components/vistaire-preview/RestaurateurPreviewAvailability.tsx`
- Read only: `components/vistaire-preview/RestaurateurPreviewInsights.tsx`

**Interfaces:**

- Consumes: `AdminLocale` et uniquement les primitives de présentation prop-driven déjà exportées.
- Produces: `AdminShellStateKind` et `AdminShellStateProps` ci-dessous.

```ts
export type AdminShellStateKind = "loading" | "empty" | "error" | "forbidden";
export type AdminShellStateProps = Readonly<{
  kind: AdminShellStateKind;
  locale: AdminLocale;
  title?: string;
  description?: string;
  action?: ReactNode;
}>;
```

- [ ] **Step 1: Écrire le test RED des quatre états et de la frontière publique**

Créer `tests/admin-foundation-shell.test.mjs` avec lectures source. Exiger :

- union exacte des quatre états;
- copies FR et EN concrètes pour chaque état;
- `role="status"` et `aria-busy="true"` pour loading;
- `role="status"` pour empty;
- `role="alert"` pour error et forbidden;
- action facultative rendue une seule fois;
- `app/admin/loading.tsx` utilise `AdminShellState kind="loading"` et la locale SSR;
- `AdminPresentationPrimitives.tsx` conserve les huit exports `AdminPanel`, `AdminKpiCard`, `AdminEvidenceState`, `AdminStatusBadge`, `AdminTooltip`, `AdminToggle`, `AdminToast`, `AdminSkeleton` et n’importe ni `next/headers`, ni `server-only`, ni `lib/admin/preferences`;
- les quatre fichiers `components/vistaire-preview/RestaurateurPreview*.tsx` continuent d’importer depuis `@/components/admin/system/AdminPresentationPrimitives`.

Étendre le test Playwright avec :

1. Tab sur chaque lien visible et vérifier `outline-style !== "none"`, `outline-width >= 2px`;
2. mesurer les cinq liens à 390 et 430, chacun ≥ 44 × 44 px;
3. calculer le contraste RGB des couples texte/fond de `.adminRoot`, du lien courant et des contrôles de préférence; seuils 4,5:1 texte et 3:1 contrôle;
4. émuler `reducedMotion: "reduce"` et vérifier sur liens, boutons, skeletons que toute durée calculée est ≤ 0,01 ms;
5. surveiller console, `pageerror`, requêtes échouées, réponses 404/500 et requêtes `.glb|.usdz|.mp4` pendant les visites de `/admin`, `/admin/availability`, `/admin/insights` seulement.

- [ ] **Step 2: Vérifier les échecs RED**

```powershell
Invoke-FoundationNative 'RED états shell Foundation' { node --test tests/admin-foundation-shell.test.mjs } -ExpectFailure
```

Expected: FAIL parce que `AdminShellState` n’existe pas et que loading utilise encore directement les skeletons.

```powershell
Invoke-FoundationPlaywright -Label 'RED E2E accessibilité shell Foundation' -Specs @('e2e/admin-foundation.spec.ts') -AdditionalArguments @('--grep', 'accessibility|health') -ExpectFailure
```

Expected: FAIL sur au moins une nouvelle assertion de contraste, de focus, d’état ou de sélecteur avant l’implémentation finale.

- [ ] **Step 3: Implémenter les états GREEN**

Créer un dictionnaire exhaustif `Record<AdminLocale, Record<AdminShellStateKind, { title: string; description: string }>>` avec ces copies :

| État | FR titre / description | EN title / description |
|---|---|---|
| loading | `Chargement en cours` / `Votre espace restaurant se prépare.` | `Loading` / `Your restaurant workspace is getting ready.` |
| empty | `Aucun élément` / `Aucun contenu n’est disponible pour le moment.` | `Nothing here yet` / `No content is available right now.` |
| error | `Impossible de charger` / `Réessayez dans quelques instants.` | `Unable to load` / `Try again in a moment.` |
| forbidden | `Accès requis` / `Utilisez votre accès restaurant pour continuer.` | `Access required` / `Use your restaurant access to continue.` |

`AdminShellState` choisit les valeurs de props quand elles sont présentes, sinon le dictionnaire. Loading rend les `AdminSkeleton` existants dans la géométrie actuelle; les trois autres rendent un panneau neutre, une icône décorative existante, titre, description et action. Aucun état ne lit de données restaurant.

Rendre `app/admin/loading.tsx` asynchrone : lire `await headers()`, appeler `readAdminPreferencesFromHeaders`, puis retourner `<AdminShellState kind="loading" locale={preferences.locale} />`.

Compléter le CSS pour que :

- les états restent centrés sans masquer la bottom nav;
- le skeleton respecte reduced motion;
- le focus soit `2px solid` au minimum avec `outline-offset: 3px`;
- les couleurs testées dépassent les seuils dans dark et light;
- aucune animation décorative ne subsiste sous reduced motion.

Ne modifier en aucune manière `AdminPresentationPrimitives.tsx` ni les fichiers de prévisualisation publique. Cette absence de diff est la garantie additive : la fondation consomme le contrat partagé sans le déplacer vers le serveur ni le spécialiser pour l’admin privé.

- [ ] **Step 4: Valider GREEN, accessibilité et compatibilité**

```powershell
Invoke-FoundationNative 'GREEN états et compatibilité Foundation' { node --test tests/admin-foundation-*.test.mjs tests/admin-dashboard-ui.test.mjs tests/restaurateur-preview-security.test.mjs tests/restaurateur-preview-ci-contract.test.mjs }
```

Expected: PASS; quatre états exacts et aucun changement de frontière pour la preview publique.

```powershell
Invoke-FoundationPlaywright -Label 'GREEN E2E shell Foundation' -Specs @('e2e/admin-foundation.spec.ts', 'e2e/admin-visual.spec.ts')
```

Expected: PASS à 1448 × 1086, 390 et 430; cinq liens sans overflow, focus visible, contrastes conformes, mouvement réduit, console propre, aucun 404/500 sur les trois pages intégrées et aucun média lourd chargé.

- [ ] **Step 5: Commit ciblé**

```powershell
Invoke-FoundationNative 'stage états shell Foundation' { git add components/admin/system/AdminShellState.tsx app/admin/loading.tsx components/admin/system/AdminSystem.module.css tests/admin-foundation-shell.test.mjs e2e/admin-foundation.spec.ts }
Invoke-FoundationNative 'commit états shell Foundation' { git commit -m "feat(admin): add accessible foundation states" }
```

## Final Integration Gate

- [ ] Exécuter la gate native finale depuis le worktree Foundation absolu :

```powershell
Invoke-FoundationNative 'status final Foundation' { git status --short --branch }
Invoke-FoundationNative 'diff-check final Foundation' { git diff --check "$ExpectedBase...HEAD" }
Invoke-FoundationNative 'scope final Foundation' { git diff --name-only "$ExpectedBase...HEAD" }
Invoke-FoundationNpmCi 'réinstallation lockfile finale Foundation'
Invoke-FoundationNative 'contrats ciblés finaux Foundation' { node --test tests/admin-foundation-*.test.mjs }
Invoke-FoundationNative 'régressions proches finales Foundation' { node --test tests/admin-dashboard-ui.test.mjs tests/proxy-matcher.test.mjs tests/restaurateur-preview-security.test.mjs tests/restaurateur-preview-ci-contract.test.mjs }
Invoke-FoundationNative 'suite admin finale Foundation' { npm run test:admin }
Invoke-FoundationNative 'assets finaux Foundation' { npm run assets:check }
Invoke-FoundationNative 'LFS final Foundation' { npm run lfs:check }
Invoke-FoundationNative 'lint final Foundation' { npm run lint }
Invoke-FoundationNative 'typecheck final Foundation' { npm run typecheck }
Invoke-FoundationNative 'build final Foundation' { npm run build }
Invoke-FoundationPlaywright -Label 'E2E final Foundation' -Specs @('e2e/admin-foundation.spec.ts', 'e2e/admin-visual.spec.ts')
```

- [ ] Confirmer que chaque chemin modifié appartient à l’ownership exact ci-dessus et qu’aucun fichier `package*`, page métier, loader, donnée, média ou asset public n’apparaît.
- [ ] Inspecter avec Chrome DevTools ou équivalent `/admin`, `/admin/availability`, `/admin/insights` à 1448 × 1086, 390 × 844 et 430 × 932 : rendu, navigation, focus, changement FR/EN, thèmes light/dark, absence d’overflow, console sans erreur, réseau sans 404/500 et aucune requête GLB/USDZ/MP4.
- [ ] Ne pas ouvrir Rapports ou Plus dans ce gate avant intégration de leurs branches; vérifier seulement leurs `href`, leur présence dans les deux navigations et l’absence de préchargement.
- [ ] Supprimer uniquement les sorties générées par cette exécution (`.next`, `test-results`, `playwright-report`, captures, vidéos, traces, logs temporaires) si elles ne sont pas suivies, sans toucher aux fichiers de l’utilisateur, puis vérifier :

```powershell
Invoke-FoundationNative 'status après nettoyage Foundation' { git status --short }
```

- [ ] Produire le compte rendu final avec fichiers changés, commandes exécutées, checks réussis ou bloqués avec message exact, QA navigateur, nettoyage, risques résiduels et confirmation que Rapports/Plus restent hors runtime de cette branche.
