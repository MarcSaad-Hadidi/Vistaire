# Vistaire Admin vNext Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la frontière de données serveur d'Admin vNext : scope production obligatoire, fuseau réellement lu sur le menu, fenêtres calendaires locales, états honnêtes et registre de preuves unique pour UI, export et Mistral.

**Architecture:** `loadAdminDataBundle` part d'un accès admin déjà validé, sélectionne le menu de façon déterministe, résout `settings_json.timezone`, fige une horloge, puis lit catalogue et événements via un repository service-role étroit. Les agrégateurs purs produisent des états discriminés et un registre projeté par audience; aucune page ne reçoit de ligne brute.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9 strict, Supabase `supabase-js` server-only, `Intl.DateTimeFormat`, modules ESM existants, Node test runner, npm.

## Global Constraints

- Au handoff, l'intégrateur transmet le SHA complet attendu dans `ADMIN_VNEXT_EXPECTED_BASE_SHA`. Affecter cette valeur à `$ExpectedBase`, exiger exactement 40 caractères hexadécimaux et créer `feat/admin-vnext-data-foundation` depuis ce commit immuable; ne pas résoudre la base via une branche distante mouvante et ne pas empiler cette branche sur Foundation.
- Ownership exclusif : `lib/admin/data/**`, les cinq frontières analytics explicitement listées dans la Task 3, `lib/analytics/searchPrivacyCore.mjs`, `lib/analytics/searchPrivacyCore.d.mts`, `app/api/analytics/events/route.ts` et leurs tests.
- Ne modifier aucune page, aucun composant, aucun style, aucune migration, aucun média, `package.json` ou `package-lock.json`.
- Les façades historiques `lib/admin/dashboardData.ts`, `dashboardRange.ts`, `analyticsState.ts` et `analyticsPresentation.ts` restent intactes pendant la vague 1. Les pages vNext consommeront le nouveau loader seulement après review P0/P1.
- Le loader public reçoit un accès validé et une plage allowlistée. Il ne reçoit jamais restaurant, menu, source ou timezone depuis URL/body/client.
- Le scope final exige `{ restaurantId, menuId, source: "production", timezone }`; aucun champ n'est optionnel.
- Seul l'état `available` possède `value`. Aucun `?? 0`, fallback de démo ou valeur synthétique.
- Un fallback timezone UTC est explicite. Les métriques dépendant du calendrier local deviennent `unavailable/timezone-unconfigured`; UTC ne se fait pas passer pour Toronto.
- Une panne ou troncature analytics n'empêche pas les snapshots catalogue. Chaque métrique propage seulement les limites de ses propres sources.
- Le registre ne contient ni raw rows, ni `session_id`, ni identifiant de scope dans un `evidenceId`. La projection Mistral retire aussi le scope privé et le contenu de recherche hostile.
- Les valeurs d'une preuve autorisée restent identiques entre UI, export et Mistral; les enveloppes peuvent différer pour respecter la confidentialité de l'audience.
- Recherches : NFKC, contrôles/bidi retirés, espaces normalisés, 80 caractères, PII rejetée, k=3 sessions distinctes et seuil courant/précédent indépendant.
- Les signaux publics restent forgeables. Ils sont nommés « observés »; l'absence de rate limit distribué, idempotence durable et attestation client reste dans la provenance.
- Sont `unmeasured` jusqu'à couverture prouvée : recherches en hausse, recherches sans résultat, sessions actives, durée moyenne, filtre utilisé, funnel, succès 3D/AR, performance mobile et erreurs d'assets.
- CA, chiffre d'affaires, commandes, ventes et conversion commerciale ne figurent jamais dans `AdminMetricId`, le registre, l'UI, les exports ou Mistral.
- Chaque tâche suit RED → GREEN → régressions → commit ciblé. Aucun commit n'est créé avec un test ciblé rouge ou `git diff --check` rouge.

```powershell
$DataWorktree = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-data-foundation'
$ExpectedBase = $env:ADMIN_VNEXT_EXPECTED_BASE_SHA
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ADMIN_VNEXT_EXPECTED_BASE_SHA doit être le SHA Git complet transmis au handoff' }

function Invoke-DataNative {
  param(
    [Parameter(Mandatory)] [string] $Label,
    [Parameter(Mandatory)] [scriptblock] $Command,
    [switch] $ExpectFailure,
    [int[]] $ExpectedFailureExitCodes = @(1)
  )

  $LocationPushed = $false
  try {
    Push-Location -LiteralPath $DataWorktree -ErrorAction Stop
    $LocationPushed = $true
    & $Command
    $ExitCode = $LASTEXITCODE
  } finally {
    if ($LocationPushed) { Pop-Location }
  }

  if ($ExpectFailure) {
    if ($ExitCode -eq 0) { throw "$Label devait échouer en RED mais a réussi" }
    if ($ExpectedFailureExitCodes -notcontains $ExitCode) { throw "$Label a échoué avec un code inattendu: $ExitCode" }
    Write-Output "$Label : échec RED observé (exit=$ExitCode)"
    return
  }
  if ($ExitCode -ne 0) { throw "$Label a échoué avec le code $ExitCode" }
}

$ActualBase = Invoke-DataNative 'merge-base Data Foundation' { git merge-base HEAD $ExpectedBase }
if ($ActualBase -ne $ExpectedBase) { throw "La branche ne descend pas du handoff attendu: $ExpectedBase" }
```

---

### Task 1: Figer scope, états et identifiants de métrique

**Files:**
- Create: `lib/admin/data/contracts.ts`
- Create: `tests/admin-data-contracts.test.mjs`
- Create: `tests/types/admin-data-contracts.typecheck.ts`

**Interfaces:**

```ts
export type AdminDatasetSource = "production" | "demo" | "internal" | "test";
export type IanaTimeZone = string & { readonly __brand: "IanaTimeZone" };

export type AdminMetricScope<S extends AdminDatasetSource = AdminDatasetSource> =
  Readonly<{
    restaurantId: string;
    menuId: string;
    source: S;
    timezone: IanaTimeZone;
  }>;

export type ProductionAdminMetricScope = AdminMetricScope<"production">;

export type AdminMetricState<T> =
  | { kind: "available"; value: T }
  | { kind: "insufficient"; reason: "no-events" | "sample-too-small" | "privacy-threshold" | "comparison-unavailable" }
  | { kind: "unmeasured"; reason: "not-instrumented" | "instrumentation-unverified" | "unsupported-signal" }
  | { kind: "unavailable"; reason: "not-applicable" | "timezone-unconfigured" | "schema-not-deployed" | "worker-not-active" }
  | { kind: "error"; code: "configuration" | "database" | "query" | "scope-integrity"; retryable: boolean }
  | { kind: "truncated"; observedRows: number; rowLimit: number };
```

`AdminMetricId` contient uniquement les snapshots catalogue, interactions observées, rankings/séries supportables et les états non mesurés listés dans les contraintes. Il ne contient aucun identifiant commercial.

- [ ] **Step 1: Écrire les tests RED runtime et compile-time**

Tester scope complet, rejet d'un scope demo/test/internal par le repository production, timezone IANA invalide, chaque variante d'état, `value` accessible seulement sur `available` et `@ts-expect-error` sur `state.value` après narrowing négatif.

```powershell
Invoke-DataNative 'RED runtime contrats Data' { node --test tests/admin-data-contracts.test.mjs } -ExpectFailure
Invoke-DataNative 'RED typecheck contrats Data' { npm run typecheck } -ExpectFailure -ExpectedFailureExitCodes 1,2
```

Expected: échec car `contracts.ts` n'existe pas.

- [ ] **Step 2: Implémenter les unions fermées et assertions**

Ajouter `assertProductionAdminMetricScope`, `parseAdminRange("today"|"7d"|"30d")`, les types payload count/ratio/series/ranking et une assertion testée que les clés `revenue|orders|sales|commercial-conversion` sont absentes.

- [ ] **Step 3: Relancer et commit**

```powershell
Invoke-DataNative 'tests contrats Data' { node --test tests/admin-data-contracts.test.mjs }
Invoke-DataNative 'typecheck contrats Data' { npm run typecheck }
Invoke-DataNative 'diff-check contrats Data' { git diff --check }
Invoke-DataNative 'stage contrats Data' { git add lib/admin/data/contracts.ts tests/admin-data-contracts.test.mjs tests/types/admin-data-contracts.typecheck.ts }
Invoke-DataNative 'commit contrats Data' { git commit -m "feat(admin-data): define honest scoped contracts" }
```

### Task 2: Résoudre le menu, le fuseau et les fenêtres locales

**Files:**
- Create: `lib/admin/data/time.ts`
- Create: `tests/admin-data-time.test.mjs`

**Interfaces:**

```ts
export type AdminTimeZoneResolution =
  | { kind: "configured"; timezone: IanaTimeZone; source: "menus.settings_json" }
  | { kind: "fallback"; timezone: IanaTimeZone; source: "utc-fallback"; reason: "missing" | "invalid" };

export type AdminObservationWindow = Readonly<{
  range: "today" | "7d" | "30d";
  timezone: IanaTimeZone;
  calendarDayCount: 1 | 7 | 30;
  observedAt: string;
  current: AdminPeriodBounds;
  previous: AdminPeriodBounds;
  alignment: "local-calendar-v1";
}>;

export function resolveAdminTimeZone(settingsJson: unknown): AdminTimeZoneResolution;
export function resolveAdminObservationWindow(input: {
  range: AdminRange;
  observedAt: Date;
  timezone: IanaTimeZone;
}): AdminObservationWindow;
export function buildAdminTimeBuckets(window: AdminObservationWindow): readonly AdminTimeBucket[];
```

- [ ] **Step 1: Écrire les tests RED timezone et DST**

Prouver : timezone valide lue directement de `settings_json`; missing/invalid → UTC avec raison; 8 mars 2026 Toronto = journée 23 h et minuit `2026-03-08T05:00:00Z`; 1er novembre = journée 25 h et minuit `2026-11-01T04:00:00Z`; deux buckets `01 h` avec offsets différents; comparaisons alignées au même cutoff local pour today/7d/30d.

```powershell
Invoke-DataNative 'RED timezone et DST Data' { node --test tests/admin-data-time.test.mjs } -ExpectFailure
```

- [ ] **Step 2: Implémenter avec `Intl.DateTimeFormat().formatToParts()`**

Effectuer un round-trip parts locales → instant UTC, sans ajouter `days * 86_400_000`. Ne pas importer `normalizePublicMenuSettings`, car son default silencieux masquerait la provenance du fallback.

- [ ] **Step 3: Relancer et commit**

```powershell
Invoke-DataNative 'tests timezone et DST Data' { node --test tests/admin-data-time.test.mjs }
Invoke-DataNative 'typecheck timezone et DST Data' { npm run typecheck }
Invoke-DataNative 'diff-check timezone et DST Data' { git diff --check }
Invoke-DataNative 'stage timezone et DST Data' { git add lib/admin/data/time.ts tests/admin-data-time.test.mjs }
Invoke-DataNative 'commit timezone et DST Data' { git commit -m "feat(admin-data): resolve local calendar windows" }
```

### Task 3: Versionner et scoper l'instrumentation future

**Files:**
- Create: `lib/admin/data/instrumentation.ts`
- Modify: `lib/analytics/client.ts`
- Modify: `lib/analytics/context.ts`
- Modify: `lib/analytics/validationCore.mjs`
- Modify: `lib/analytics/validationCore.d.mts`
- Modify: `app/api/analytics/events/route.ts`
- Create: `tests/admin-data-instrumentation.test.mjs`
- Create: `tests/admin-data-ingestion-validation.test.mjs`
- Modify: `tests/public-menu-analytics-source.test.mjs`

**Contract:**

```ts
export const ADMIN_INSTRUMENTATION_VERSION = "admin-vnext-observed-v1";

export type AdminInstrumentationCoverage = Readonly<{
  version: string;
  renderer: AdminRendererId;
  source: "production";
  coverageStartAt: string | null;
  coverageEndAt: string | null;
  proof:
    | { kind: "verified-deployment"; deploymentId: string }
    | { kind: "unverified" };
  signals: Readonly<Record<AdminSignalId, "covered" | "partial" | "absent">>;
}>;

export function coversEntirePeriod(
  coverage: AdminInstrumentationCoverage,
  bounds: AdminPeriodBounds
): boolean;
```

- [ ] **Step 1: Écrire les tests RED du registre et de l'ingestion**

Exiger couverture distincte par renderer/source, preuve `verified-deployment` issue du registre de déploiement production, production sans version refusée, version caller écrasée par la version canonique, dish/category obligatoire selon événement, slug appartenant au même restaurant/menu, cross-site refusé avant lookup et payload demo isolé. Tester `coversEntirePeriod` avec preuve absente/non vérifiée, signal `partial`, début absent ou après la fenêtre, fin avant la fenêtre, intervalle complet et current/previous évalués séparément.

- [ ] **Step 2: Stamp la version sans surcharge possible**

Dans `client.ts`, assainir `input.metadata` puis écrire `instrumentationVersion` en dernier. Dans `validationCore.mjs`, exiger la version exacte sur les nouveaux payloads production et les champs d'identité liés au signal.

- [ ] **Step 3: Valider dish/category contre le menu**

Étendre `validateAnalyticsContext` avec `dishBelongsToMenu` et `categoryBelongsToMenu`. `context.ts` sélectionne seulement `id` et filtre simultanément slug, `restaurant_id` et `menu_id`. Une incohérence retourne 400; une erreur de lookup retourne 503.

- [ ] **Step 4: Ajouter la garde same-origin**

La route refuse `Sec-Fetch-Site: cross-site` et tout `Origin` présent différent de `request.nextUrl.origin`, avant lecture du body/lookup. Une requête sans ces headers reste admissible et cette limite reste déclarée `public-client-not-attested`.

- [ ] **Step 5: Tester les limites résiduelles**

Le registre doit déclarer `sameOrigin/entityMembership/instrumentationVersion=enforced-v1`, `rateLimit=not-enforced-distributed`, `idempotence=client-dedupe-only-not-durable`, `clientAuthenticity=public-client-not-attested`. Une métrique ne peut prouver zéro que si `coversEntirePeriod` est vrai pour une preuve `verified-deployment`, son signal `covered`, son renderer, sa source et toute sa fenêtre; toute preuve absente/non vérifiée ou couverture nulle, partielle ou interrompue rend `unmeasured/instrumentation-unverified`.

- [ ] **Step 6: Exécuter et commit**

```powershell
Invoke-DataNative 'tests instrumentation Data' { node --test tests/admin-data-instrumentation.test.mjs tests/admin-data-ingestion-validation.test.mjs tests/public-menu-analytics-source.test.mjs tests/admin-analytics-menu-identity.test.mjs }
Invoke-DataNative 'typecheck instrumentation Data' { npm run typecheck }
Invoke-DataNative 'diff-check instrumentation Data' { git diff --check }
Invoke-DataNative 'stage instrumentation Data' { git add lib/admin/data/instrumentation.ts lib/analytics/client.ts lib/analytics/context.ts lib/analytics/validationCore.mjs lib/analytics/validationCore.d.mts app/api/analytics/events/route.ts tests/admin-data-instrumentation.test.mjs tests/admin-data-ingestion-validation.test.mjs tests/public-menu-analytics-source.test.mjs }
Invoke-DataNative 'commit instrumentation Data' { git commit -m "feat(analytics): version and scope observed signals" }
```

### Task 4: Centraliser la confidentialité des recherches

**Files:**
- Create: `lib/analytics/searchPrivacyCore.mjs`
- Create: `lib/analytics/searchPrivacyCore.d.mts`
- Create: `lib/admin/data/searchPrivacy.ts`
- Create: `tests/admin-data-search-privacy.test.mjs`

**Interfaces:**

```ts
export function classifyAnalyticsSearchTerm(input: unknown): SearchTermClassification;
export function aggregatePrivateSearchPeriod(input: {
  events: readonly AdminAnalyticsEvent[];
  bounds: AdminPeriodBounds;
  minimumDistinctSessions: 3;
  audience: "ui" | "export" | "mistral";
}): AdminMetricState<readonly SearchTermEvidence[]>;

export function comparePrivateSearchPeriods(input: {
  current: AdminMetricState<readonly SearchTermEvidence[]>;
  previous: AdminMetricState<readonly SearchTermEvidence[]>;
}): AdminMetricState<readonly SearchTermComparisonEvidence[]>;
```

- [ ] **Step 1: Écrire les tests RED de confidentialité**

Couvrir Unicode NFKC, espaces, contrôles/bidi, 80 caractères, email, téléphone, URL, IP, code postal, adresse, marqueurs factices de PII, trois occurrences dans une session, trois sessions distinctes, seuil courant/précédent indépendant et prompt injection retirée seulement de l'audience Mistral. Ajouter les cas bloquants `2 sessions current + 1 session previous != k=3` et `current>=3, previous<3 => previousCount/changeRate absents`.

- [ ] **Step 2: Implémenter le noyau partagé pur**

Agréger current et previous avec deux appels séparés à `aggregatePrivateSearchPeriod`, chacun borné à sa propre fenêtre, puis comparer leurs résultats. Ne jamais sérialiser les IDs de session; ils servent seulement au Set interne pendant l'agrégation d'une période. Si previous est sous k, rendre `previousCount` et `changeRate` absents/null.

- [ ] **Step 3: Exécuter et commit**

```powershell
Invoke-DataNative 'tests confidentialité recherches Data' { node --test tests/admin-data-search-privacy.test.mjs }
Invoke-DataNative 'typecheck confidentialité recherches Data' { npm run typecheck }
Invoke-DataNative 'diff-check confidentialité recherches Data' { git diff --check }
Invoke-DataNative 'stage confidentialité recherches Data' { git add lib/analytics/searchPrivacyCore.mjs lib/analytics/searchPrivacyCore.d.mts lib/admin/data/searchPrivacy.ts tests/admin-data-search-privacy.test.mjs }
Invoke-DataNative 'commit confidentialité recherches Data' { git commit -m "feat(admin-data): protect observed searches" }
```

### Task 5: Créer le repository production borné

**Files:**
- Create: `lib/admin/data/repository.ts`
- Create: `tests/admin-data-repository.test.mjs`

**Interfaces:**

```ts
export async function readProductionAdminMenu(input: {
  restaurantId: string;
}): Promise<ScopedMenuRead>;

export async function readProductionAdminCatalog(
  scope: ProductionAdminMetricScope
): Promise<ScopedCatalogRead>;

export async function readProductionAdminEvents(input: {
  scope: ProductionAdminMetricScope;
  window: AdminPeriodBounds;
  maxRows: number;
}): Promise<ScopedAnalyticsRead>;
```

- [ ] **Step 1: Écrire les tests RED des requêtes**

Prouver colonnes explicites; menu `id,restaurant_id,slug,status,is_primary,settings_json,updated_at`; sélection published/primary déterministe; restaurant/menu/source/bornes obligatoires; borne haute `observedAt`; pagination stable `created_at,id`; `maxRows` non tronqué et `maxRows+1` tronqué; postcondition cross-scope; metadata allowlist; aucune méthode générique exposée.

- [ ] **Step 2: Implémenter le repository server-only**

Utiliser `getSupabaseAdminClient` uniquement ici. `source` est codé serveur à `production`. Les messages Supabase complets restent dans les logs serveur; le résultat expose seulement un code neutre et retryable.

- [ ] **Step 3: Préserver l'indépendance des sources**

Menu/settings, catalogue, current events et previous events retournent chacun leur résultat. Aucun `Promise.all` ne transforme une seule erreur en panne globale.

- [ ] **Step 4: Exécuter et commit**

```powershell
Invoke-DataNative 'tests repository Data' { node --test tests/admin-data-repository.test.mjs tests/admin-analytics-isolation.test.mjs }
Invoke-DataNative 'typecheck repository Data' { npm run typecheck }
Invoke-DataNative 'diff-check repository Data' { git diff --check }
Invoke-DataNative 'stage repository Data' { git add lib/admin/data/repository.ts tests/admin-data-repository.test.mjs }
Invoke-DataNative 'commit repository Data' { git commit -m "feat(admin-data): add bounded production repository" }
```

### Task 6: Définir et agréger uniquement les métriques honnêtes

**Files:**
- Create: `lib/admin/data/metricDefinitions.ts`
- Create: `lib/admin/data/aggregateAnalytics.ts`
- Create: `tests/admin-data-metric-definitions.test.mjs`
- Create: `tests/admin-data-aggregate.test.mjs`

- [ ] **Step 1: Écrire les tests RED des définitions**

Tester source, définition versionnée, unité, seuil, dépendances, couverture et audiences. Assert que les chaînes/keys `revenue|orders|sales|commercial-conversion|chiffre-affaires` n'existent pas dans les définitions.

- [ ] **Step 2: Écrire les tests RED d'agrégation**

Prouver zéro mesuré seulement si `coversEntirePeriod` est vrai pour chaque renderer requis; preuve absente/non vérifiée, signal `partial`, début absent ou après `from`, ou fin avant `to` → `unmeasured`; échantillon → `insufficient`; source tronquée → `truncated` seulement pour ses métriques; baseline zéro → `changeRate:null`; scope/definition/timezone incompatibles → comparaison indisponible; clic 3D/AR = intention, jamais succès. Tester ces cas séparément pour current et previous.

- [ ] **Step 3: Implémenter les définitions et agrégateurs purs**

Inclure snapshots plats/photos/immersive, interactions observées, rankings, série et recherches k-anonymisées. Les métriques listées comme absentes restent dans un état `unmeasured` sans valeur. La fraîcheur utilise `generatedAt`, `sourceUpdatedAt` et couverture, pas l'âge du dernier événement.

- [ ] **Step 4: Exécuter et commit**

```powershell
Invoke-DataNative 'tests agrégation Data' { node --test tests/admin-data-metric-definitions.test.mjs tests/admin-data-aggregate.test.mjs tests/admin-data-instrumentation.test.mjs tests/admin-data-search-privacy.test.mjs }
Invoke-DataNative 'typecheck agrégation Data' { npm run typecheck }
Invoke-DataNative 'diff-check agrégation Data' { git diff --check }
Invoke-DataNative 'stage agrégation Data' { git add lib/admin/data/metricDefinitions.ts lib/admin/data/aggregateAnalytics.ts tests/admin-data-metric-definitions.test.mjs tests/admin-data-aggregate.test.mjs }
Invoke-DataNative 'commit agrégation Data' { git commit -m "feat(admin-data): aggregate measured evidence only" }
```

### Task 7: Construire le registre de preuves par audience

**Files:**
- Create: `lib/admin/data/evidenceRegistry.ts`
- Create: `tests/admin-data-evidence-registry.test.mjs`

**Interfaces:**

```ts
export type EvidenceId = string & { readonly __brand: "EvidenceId" };

export type AdminEvidenceRecord = Readonly<{
  evidenceId: EvidenceId;
  metricId: AdminMetricId;
  definitionVersion: string;
  labelKey: string;
  state: AdminMetricState<AdminEvidencePayload>;
  period: "current" | "previous" | "snapshot";
  provenance: AdminEvidenceProvenance;
  freshness: AdminEvidenceFreshness;
  sample: AdminEvidenceSample;
  privacy: AdminEvidencePrivacy;
  audiences: readonly ("ui" | "export" | "mistral")[];
}>;

export type AdminEvidenceBundle = Readonly<{
  bundleId: string;
  scope: ProductionAdminMetricScope;
  window: AdminObservationWindow;
  generatedAt: string;
  records: Readonly<Record<EvidenceId, AdminEvidenceRecord>>;
}>;
```

- [ ] **Step 1: Écrire les tests RED identité/confidentialité**

Exiger IDs déterministes sans restaurant/menu, bundle mono-scope, evidence inconnue/cross-bundle rejetée, audience allowlistée, aucun raw/session, même state/value pour une preuve autorisée UI/export/Mistral, et projection Mistral sans scope privé ni recherche classée hostile.

- [ ] **Step 2: Implémenter build/projection/références**

Créer `buildAdminEvidenceBundle`, `projectEvidenceForAudience` et `requireEvidenceReferences`. La projection export conserve les métadonnées nécessaires à l'audit; Mistral reçoit seulement labels sûrs, états, payloads agrégés et IDs.

- [ ] **Step 3: Exécuter et commit**

```powershell
Invoke-DataNative 'tests registre de preuves Data' { node --test tests/admin-data-evidence-registry.test.mjs }
Invoke-DataNative 'typecheck registre de preuves Data' { npm run typecheck }
Invoke-DataNative 'diff-check registre de preuves Data' { git diff --check }
Invoke-DataNative 'stage registre de preuves Data' { git add lib/admin/data/evidenceRegistry.ts tests/admin-data-evidence-registry.test.mjs }
Invoke-DataNative 'commit registre de preuves Data' { git commit -m "feat(admin-data): centralize scoped evidence" }
```

### Task 8: Composer le loader canonique depuis l'accès validé

**Files:**
- Create: `lib/admin/data/loadAdminData.ts`
- Create: `tests/admin-data-loader.test.mjs`

**Interfaces:**

```ts
type GrantedAdminAccess = Extract<AdminRestaurantAccessResult, { ok: true }>;

export async function loadAdminDataBundle(
  access: GrantedAdminAccess,
  range: AdminRange
): Promise<AdminDataLoadResult>;

export async function loadAdminDataBundleWithDependencies(
  input: { access: GrantedAdminAccess; range: AdminRange },
  dependencies: AdminDataDependencies
): Promise<AdminDataLoadResult>;
```

- [ ] **Step 1: Écrire les tests RED d'orchestration**

Tester : restaurant depuis access; menu/settings lus avant scope; menu déterministe; `observedAt` appelé une fois; timezone configurée/fallback; catalogue/current/previous indépendants; aucune lecture si accès non accordé au type boundary; résultat sans rows/events/session; aucune fixture; aucune identité URL/body.

- [ ] **Step 2: Implémenter l'ordre fail-closed**

Accès accordé → menu/settings → timezone → scope production → fenêtre → lectures indépendantes → agrégats → registre. Si menu absent, retourner une erreur de configuration sans requête analytics. Si timezone fallback, conserver les totaux non temporels et marquer les métriques locales indisponibles.

- [ ] **Step 3: Prouver la compatibilité legacy**

Le test lit les quatre façades historiques et exige un diff nul sur elles. Aucune réexportation ne redirige les pages actuelles avant le jalon d'intégration des deux fondations.

- [ ] **Step 4: Exécuter et commit**

```powershell
Invoke-DataNative 'tests loader Data' { node --test tests/admin-data-loader.test.mjs tests/admin-data-repository.test.mjs tests/admin-data-evidence-registry.test.mjs }
Invoke-DataNative 'typecheck loader Data' { npm run typecheck }
Invoke-DataNative 'diff-check loader Data' { git diff --check }
Invoke-DataNative 'stage loader Data' { git add lib/admin/data/loadAdminData.ts tests/admin-data-loader.test.mjs }
Invoke-DataNative 'commit loader Data' { git commit -m "feat(admin-data): load evidence from granted access" }
```

### Task 9: Passer la revue P0/P1 Data Foundation

**Files:**
- Verify: tous les fichiers autorisés ci-dessus

- [ ] **Step 1: Exécuter les tests ciblés ensemble**

```powershell
Invoke-DataNative 'contrats Data Foundation' { node --test tests/admin-data-contracts.test.mjs tests/admin-data-time.test.mjs tests/admin-data-instrumentation.test.mjs tests/admin-data-ingestion-validation.test.mjs tests/admin-data-search-privacy.test.mjs tests/admin-data-metric-definitions.test.mjs tests/admin-data-aggregate.test.mjs tests/admin-data-evidence-registry.test.mjs tests/admin-data-repository.test.mjs tests/admin-data-loader.test.mjs tests/public-menu-analytics-source.test.mjs tests/admin-analytics-menu-identity.test.mjs tests/admin-analytics-isolation.test.mjs tests/admin-analytics-correctness.test.mjs }
Invoke-DataNative 'test:admin Data Foundation' { npm run test:admin }
Invoke-DataNative 'typecheck Data Foundation' { npm run typecheck }
Invoke-DataNative 'lint Data Foundation' { npm run lint }
Invoke-DataNative 'build Data Foundation' { npm run build }
Invoke-DataNative 'assets Data Foundation' { npm run assets:check }
Invoke-DataNative 'lfs Data Foundation' { npm run lfs:check }
```

- [ ] **Step 2: Exécuter les scans de loopholes**

```powershell
Invoke-DataNative 'scan métriques commerciales Data' { rg -n "revenue|orders|sales|commercial.?conversion|chiffre.?affaires" lib/admin/data } -ExpectFailure
Invoke-DataNative 'scan fallbacks et wildcard Data' { rg -n '\?\?\s*0|source:\s*["'']demo|select\(["'']\*' lib/admin/data } -ExpectFailure
Invoke-DataNative 'diff-check final Data' { git diff --check "$ExpectedBase...HEAD" }
Invoke-DataNative 'liste finale des chemins Data' { git diff --name-only "$ExpectedBase...HEAD" }
Invoke-DataNative 'status final Data' { git status --short }
```

Expected: les deux scans échouent avec le code `1` parce qu'ils ne trouvent aucun résultat interdit; tout autre code non nul est investigué avant handoff. Les mentions de session éventuelles restent internes aux agrégateurs/tests et leur absence des projections sérialisées est prouvée par les tests du registre.

- [ ] **Step 3: Revue P0/P1 bloquante**

Bloquer le jalon d'intégration des deux fondations si un scope est optionnel, si le loader accepte une timezone caller, si UTC est présenté comme local configuré, si un état négatif contient une valeur, si current/previous partagent le seuil k, si Mistral reçoit le scope privé, si la troncature masque le catalogue, si une métrique commerciale existe ou si l'ingestion accepte dish/category cross-menu.

- [ ] **Step 4: Nettoyer et remettre la branche**

Supprimer `.next`, `test-results`, `playwright-report`, logs et captures générés après validation de leurs chemins. Vérifier qu'aucun `.env`, secret, média ou lockfile n'a changé. Remettre les commits, commandes, résultats et limites résiduelles à l'intégrateur; ne pas push, créer de PR ou merger automatiquement.
