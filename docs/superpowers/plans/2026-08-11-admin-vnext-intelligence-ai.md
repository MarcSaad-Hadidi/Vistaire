# Vistaire Admin vNext Intelligence and AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer `/admin/insights` fidèle à `3.png` et un assistant utile dont chaque assertion quantitative est rendue côté serveur depuis le registre de preuves.

**Architecture:** La page projette `AdminEvidenceBundle` en graphiques et classements honnêtes. L'assistant reçoit une projection Mistral anonymisée, demande des claims structurés `claimType + evidenceIds`, valide les références puis rend les textes FR/EN par templates. Un limiteur distribué est obligatoire pour appeler Mistral; le fallback par règles fonctionne sans modèle.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Mistral Chat Completions via `fetch`, Supabase/Postgres pour le quota distribué, CSS modules/primitives Foundation, Node test runner, tests SQL, Playwright.

## Global Constraints

- Au handoff d'intégration des fondations, l'intégrateur transmet le SHA complet attendu dans `ADMIN_VNEXT_EXPECTED_BASE_SHA`. Affecter cette valeur à `$ExpectedBase`, exiger exactement 40 caractères hexadécimaux et créer `feat/admin-vnext-intelligence-ai` depuis ce commit immuable; ne jamais résoudre la base depuis un label de jalon mouvant.
- Ownership exclusif : `app/admin/insights/page.tsx`, `app/admin/api/assistant/route.ts`, `components/admin/insights/**`, `components/admin/AdminAssistant.tsx`, `lib/admin/assistant.ts`, `lib/admin/assistant/**`, `lib/admin/recommendations.ts`, ajouts admin dans `lib/ai/mistral.ts`, corpus/tests IA et migration de quota.
- Ne modifier ni primitives système/charts, ni Data Foundation, ni autres pages, ni `package.json`, ni `package-lock.json`.
- Le registre de preuves et le corpus d'évaluation sont verts avant d'afficher le drawer.
- Mistral n'écrit aucune phrase quantitative libre et ne choisit aucune valeur. Le serveur injecte toute valeur, rang, ratio et comparaison depuis un `evidenceId` valide.
- Aucun raw event, `session_id`, identifiant restaurant/menu, terme PII ou terme classé prompt injection n'entre dans la projection Mistral.
- Conserver le `fetch` serveur vers Chat Completions `POST /v1/chat/completions` et le modèle `MISTRAL_MODEL`; ne pas introduire Responses API, SDK ou dépendance. Références officielles : [Chat Completions](https://docs.mistral.ai/api/endpoint/chat) et [Custom Structured Outputs](https://docs.mistral.ai/studio/conversations/structured-output/custom).
- Chaque appel modèle exige `response_format.type="json_schema"`, `strict: true`, `additionalProperties: false` à la racine et sur chaque claim, puis une validation locale du contenu complet et des allowlists `ApprovedClaimType`/`evidenceId`. Aucun fallback `json_object`, JSON libre, fence Markdown, réparation ou extraction première `{`/dernière `}` n'est autorisé.
- Timeout maximum `4_500 ms`, rate limit distribué, taille de body bornée, aucune mutation et fallback règles déterministe.
- Seule la présence booléenne de `MISTRAL_API_KEY` et `MISTRAL_MODEL` et des codes d'erreur neutres peut être diagnostiquée; leurs valeurs, le prompt, la question, les preuves et les données brutes ne sont jamais logués, sérialisés ou rendus.
- Sans limiteur distribué opérationnel, ne pas appeler Mistral.
- Les specs E2E Intelligence/Assistant possédées s'exécutent avec `VISTAIRE_ADMIN_VISUAL_FIXTURE=1`, `VISTAIRE_REQUIRE_ADMIN_E2E=1` et `--reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts`; elles utilisent une entrée admin locale déterministe sans QR token, n'appellent jamais `test.skip`/`test.fixme` et refusent toute requête réseau hors loopback.

```powershell
$IntelligenceWorktree = 'E:\Projet perso\MenuAlive\.worktrees\admin-vnext-intelligence-ai'
$ExpectedBase = $env:ADMIN_VNEXT_EXPECTED_BASE_SHA
if ($ExpectedBase -notmatch '^[0-9a-f]{40}$') { throw 'ADMIN_VNEXT_EXPECTED_BASE_SHA doit être le SHA Git complet transmis au handoff' }

function Invoke-IntelligenceNative {
  param(
    [Parameter(Mandatory)][string]$Label,
    [Parameter(Mandatory)][scriptblock]$Command,
    [string]$WorkingDirectory = $IntelligenceWorktree,
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

function Assert-IntelligenceAdvisorReceipt {
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

$ActualBase = Invoke-IntelligenceNative 'merge-base Intelligence-AI' { git merge-base HEAD $ExpectedBase }
if ($ActualBase -ne $ExpectedBase) { throw "La branche ne descend pas du handoff attendu: $ExpectedBase" }
```

---

### Task 1: Figer claims, templates et corpus d'évaluation

**Files:**
- Create: `lib/admin/assistant/contracts.ts`
- Create: `lib/admin/assistant/claimCatalog.ts`
- Create: `lib/admin/assistant/renderClaims.ts`
- Create: `lib/admin/assistant/rulesFallback.ts`
- Create: `tests/fixtures/admin-assistant-evals.json`
- Create: `tests/admin-vnext-assistant-evaluation.test.mjs`
- Create: `tests/admin-vnext-assistant-security.test.mjs`

**Interfaces:**

```ts
export const APPROVED_CLAIM_TYPES = [
  "metric-observation",
  "period-comparison",
  "rank-observation",
  "attention-observation",
] as const;

export type ApprovedClaimType = (typeof APPROVED_CLAIM_TYPES)[number];

export type AssistantClaim = Readonly<{
  claimType: ApprovedClaimType;
  evidenceIds: readonly EvidenceId[];
}>;

export type AssistantAnswer = Readonly<{
  source: "mistral" | "rules";
  blocks: readonly AssistantRenderedBlock[];
  evidenceIds: readonly EvidenceId[];
}>;

export function renderAssistantClaims(input: {
  locale: "fr" | "en";
  bundle: AdminEvidenceBundle;
  claims: readonly AssistantClaim[];
}): AssistantAnswer;
```

- [ ] **Step 1: Écrire le corpus avant le renderer**

Inclure au minimum : question normale FR/EN; preuve disponible; preuve insuffisante; demande CA/ventes; prompt injection; evidence inconnue; evidence cross-bundle; audience non Mistral; nombres libres; nombres en lettres; « double », « moitié », rang; terme de recherche hostile; bundle vide.

- [ ] **Step 2: Écrire les tests RED**

Les tests exigent un schéma strict sans champ prose, un catalogue fermé de claims, une valeur identique UI/assistant, des références rejetées en échec fermé et un fallback qui n'ajoute aucun fait.

```powershell
Invoke-IntelligenceNative 'RED contrats Assistant' { node --test tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs } -ExpectFailure
```

Expected: échec car les modules n'existent pas.

- [ ] **Step 3: Implémenter claims et templates FR/EN**

Chaque template déclare le nombre et le type de preuves requis. Le renderer appelle `requireEvidenceReferences(..., "mistral", ids)` et formate les valeurs canonisées. Les états non disponibles produisent une explication sans valeur.

- [ ] **Step 4: Implémenter le fallback règles**

Le fallback sélectionne seulement des claims dont les préconditions sont satisfaites et utilise le même renderer. Il ne génère ni texte libre ni valeur.

- [ ] **Step 5: Relancer et commit**

```powershell
Invoke-IntelligenceNative 'GREEN contrats Assistant' { node --test tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs }
Invoke-IntelligenceNative 'stage contrats Assistant' { git add lib/admin/assistant tests/fixtures/admin-assistant-evals.json tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs }
Invoke-IntelligenceNative 'commit contrats Assistant' { git commit -m "test(admin): lock assistant claims to evidence" }
```

### Task 2: Ajouter le quota distribué fail-closed

**Files:**
- Create: `supabase/migrations/20260811200000_admin_assistant_rate_limit.sql`
- Create: `tests/postgres/admin-assistant-rate-limit/bootstrap.sql`
- Create: `tests/postgres/admin-assistant-rate-limit/security.test.sql`
- Create: `tests/postgres/admin-assistant-rate-limit/concurrency.test.sql`
- Create: `tests/postgres/admin-assistant-rate-limit/run.sql`
- Create: `lib/admin/assistant/rateLimit.ts`
- Modify: `tests/admin-vnext-assistant-security.test.mjs`

- [ ] **Step 1: Écrire les tests RED de contrat SQL et runtime**

Exiger table/bucket scoped restaurant, fenêtre serveur, limite atomique, `security definer`, `search_path=''`, noms d'objets qualifiés, service-role-only, refus public/anon/authenticated, appels concurrents sans dépassement et résultat `unavailable` distinct de `denied`. La migration révoque explicitement tout droit table/séquence et tout `EXECUTE` à `PUBLIC`, `anon` et `authenticated`, accorde seulement les privilèges minimaux à `service_role`, et les tests vérifient `has_table_privilege`, `has_sequence_privilege` et `has_function_privilege`; aucun default grant Supabase implicite n'est supposé.

- [ ] **Step 2: Écrire la migration additive**

Créer l'état minimal du quota et l'RPC `consume_admin_assistant_quota`. Aucun log de prompt/réponse, aucun identifiant de session public, aucun seed et aucune mutation de données existantes.

- [ ] **Step 3: Implémenter l'adaptateur runtime**

L'adaptateur reçoit le restaurant depuis l'accès validé, appelle uniquement l'RPC allowlisté et renvoie `allowed|denied|unavailable|error`. Seul `allowed` autorise Mistral; `denied|unavailable|error` interdisent tout appel modèle mais n'interdisent pas le fallback règles. Les tests injectent un compteur de transport et exigent zéro appel Mistral dans chacun de ces trois cas.

- [ ] **Step 4: Exécuter les gates**

```powershell
Invoke-IntelligenceNative 'RED quota Assistant' { node --test tests/admin-vnext-assistant-security.test.mjs } -ExpectFailure
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
$DatabaseIdentity = (Invoke-IntelligenceNative 'identité DB Intelligence-AI' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -At -v ON_ERROR_STOP=1 -c "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text" }).Trim()
if (-not $DatabaseIdentity) { throw "Impossible de vérifier l’identité de la base éphémère" }
Write-Output "Gate DB éphémère: project=$EphemeralProjectRef identity=$DatabaseIdentity"
Invoke-IntelligenceNative 'SQL quota Assistant initial' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -v ON_ERROR_STOP=1 -f tests/postgres/admin-assistant-rate-limit/run.sql }
if ($LASTEXITCODE -ne 0) { throw 'Gate SQL quota Assistant en échec' }
```

Expected: succès, avec uniquement le project ref et l'identité normalisée `database|user|server_addr|port`; ne jamais afficher l'URL, le mot de passe ou un secret. Sans `psql`, URL, project refs distincts ou identité DB vérifiable, marquer le gate bloqué, interdire le commit de migration et conserver Mistral désactivé.

- [ ] **Step 5: Lancer les advisors Supabase et commit isolé, seulement après gates Node + Postgres + advisors verts**

Après advisors sécurité/performance sans P0/P1 :

```powershell
Invoke-IntelligenceNative 'stage quota Assistant' { git add supabase/migrations/20260811200000_admin_assistant_rate_limit.sql tests/postgres/admin-assistant-rate-limit lib/admin/assistant/rateLimit.ts tests/admin-vnext-assistant-security.test.mjs }
Invoke-IntelligenceNative 'commit quota Assistant' { git commit -m "feat(db): add admin assistant quota" }
```

### Task 3: Adapter Mistral aux claims structurés

**Files:**
- Modify: `lib/ai/mistral.ts`
- Create: `lib/admin/assistant/mistralClaims.ts`
- Create: `tests/admin-vnext-mistral-contract.test.mjs`

**Interfaces:**

```ts
export async function generateMistralAdminClaims(input: {
  locale: "fr" | "en";
  question: string;
  evidence: AdminEvidenceProjection;
  signal?: AbortSignal;
}): Promise<readonly AssistantClaim[] | null>;
```

**Structured Output contract:**

```ts
const adminAssistantClaimsResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "admin_assistant_claims",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["claims"],
      properties: {
        claims: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["claimType", "evidenceIds"],
            properties: {
              claimType: { type: "string", enum: APPROVED_CLAIM_TYPES },
              evidenceIds: {
                type: "array",
                items: { type: "string" },
                uniqueItems: true,
              },
            },
          },
        },
      },
    },
  },
} as const;
```

- [ ] **Step 1: Écrire les tests RED du transport**

Prouver endpoint `/v1/chat/completions`, `model === MISTRAL_MODEL`, `response_format.type === "json_schema"`, nom et mode stricts, racine `claims` fermée, items limités exactement à `claimType + evidenceIds`, enums/required/`additionalProperties: false`, température déterministe, timeout `4_500`, body borné et aucun nouveau nombre dans le prompt système. Le validateur local rejette propriété racine ou claim surnuméraire, champ manquant, claim type hors allowlist, evidence ID inconnu/non-Mistral/cross-bundle, doublon, prose, fence Markdown, JSON préfixé/suffixé, première `{`/dernière `}` récupérable mais contenu complet invalide et réponse non JSON. Simuler modèle/config sans support JSON Schema, HTTP non-2xx, timeout et schéma invalide : chaque cas retourne `null` vers le fallback déterministe, sans second appel `json_object`/JSON libre. Espionner les logs et exiger l'absence de clé, valeur `MISTRAL_MODEL`, prompt, question, preuves et données brutes.

```powershell
Invoke-IntelligenceNative 'RED contrat Mistral' { node --test tests/admin-vnext-mistral-contract.test.mjs } -ExpectFailure
```

- [ ] **Step 2: Ajouter une fonction additive dans `lib/ai/mistral.ts`**

Préserver tous les exports owner/menu existants. La fonction admin accepte des dépendances `fetch`/clock injectables pour les tests, lit uniquement `MISTRAL_API_KEY` et `MISTRAL_MODEL` côté serveur, envoie `response_format: adminAssistantClaimsResponseFormat`, n'exporte pas la clé et ne logue ni prompt ni données. Elle parse exactement le contenu complet avec `JSON.parse`, valide localement le schéma fermé puis les allowlists du bundle et retourne uniquement le tableau validé `payload.claims`. Elle retourne `null` au modèle/config incompatible, timeout, erreur réseau, status non-2xx, JSON invalide ou référence interdite. Elle ne cherche jamais des accolades, ne retire pas de fences, ne répare rien et ne dégrade jamais la requête en JSON libre.

- [ ] **Step 3: Construire le prompt minimal**

Inclure la question normalisée et les seules preuves projetées. Demander des `claimType` et `evidenceIds` allowlistés sans recopier le schéma comme substitut à `response_format`; aucune ligne brute, aucun scope privé et aucun terme de recherche non fiable. Le prompt et sa projection ne sont jamais journalisés.

- [ ] **Step 4: Relancer les tests existants Mistral et commit**

```powershell
Invoke-IntelligenceNative 'GREEN contrat Mistral' { node --test tests/admin-vnext-mistral-contract.test.mjs tests/menu-style-advisor.test.mjs }
Invoke-IntelligenceNative 'stage contrat Mistral' { git add lib/ai/mistral.ts lib/admin/assistant/mistralClaims.ts tests/admin-vnext-mistral-contract.test.mjs }
Invoke-IntelligenceNative 'commit contrat Mistral' { git commit -m "feat(ai): return evidence-bound admin claims" }
```

### Task 4: Refaire la route assistant

**Files:**
- Modify: `lib/admin/assistant.ts`
- Modify: `app/admin/api/assistant/route.ts`
- Modify: `lib/admin/recommendations.ts`
- Modify: `tests/admin-assistant-isolation.test.mjs`
- Modify: `tests/admin-vnext-assistant-security.test.mjs`

- [ ] **Step 1: Écrire les tests RED de pipeline**

Tester same-origin, JSON exact, question bornée, locale allowlistée, accès live, bundle du restaurant de l'accès, projection Mistral, quota `allowed|denied|unavailable|error`, timeout, mock CI, règles, cross-restaurant, prompt injection, aucune méthode de mutation et réponse structurée. Pour les trois états autres que `allowed`, le compteur de transport Mistral reste strictement à zéro.

- [ ] **Step 2: Implémenter l'orchestrateur injecté**

Ordre obligatoire : accès → validation → bundle → projection → quota → Mistral uniquement si `allowed` et JSON Schema supporté → `JSON.parse` du contenu complet → validation locale schéma + allowlists → rendu. En CI/test, injecter le mock déterministe. En `denied`, quota absent, modèle/config incompatible, timeout, erreur transport, réponse invalide ou schéma refusé, rendre le fallback règles avec status sûr, sans extraction heuristique, sans nouvelle tentative JSON libre et sans fuite dans les logs.

- [ ] **Step 3: Réutiliser le registre pour les recommandations**

Les recommandations de page deviennent des claims/règles avec preuves, sans second calcul analytics ni copy quantitative autonome.

- [ ] **Step 4: Exécuter les tests et commit**

```powershell
Invoke-IntelligenceNative 'GREEN route Assistant' { node --test tests/admin-assistant-isolation.test.mjs tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs tests/admin-vnext-mistral-contract.test.mjs }
Invoke-IntelligenceNative 'typecheck route Assistant' { npm run typecheck }
Invoke-IntelligenceNative 'stage route Assistant' { git add lib/admin/assistant.ts lib/admin/recommendations.ts app/admin/api/assistant/route.ts tests/admin-assistant-isolation.test.mjs tests/admin-vnext-assistant-security.test.mjs }
Invoke-IntelligenceNative 'commit route Assistant' { git commit -m "feat(admin): secure evidence-bound assistant" }
```

### Task 5: Recomposer Intelligence avant d'activer le drawer

**Files:**
- Modify: `app/admin/insights/page.tsx`
- Modify: `components/admin/insights/AdminInsightsPage.tsx`
- Modify: `components/admin/insights/AdminInsights.module.css`
- Modify: `components/admin/insights/AdminBreakdowns.tsx`
- Modify: `components/admin/insights/AdminComparisonChart.tsx`
- Modify: `components/admin/insights/AdminHeatmap.tsx`
- Modify: `components/admin/insights/InsightsActivityChart.tsx`
- Modify: `components/admin/insights/InsightsRows.tsx`
- Modify: `components/admin/AdminAssistant.tsx`
- Create: `components/admin/insights/InsightsAttentionMap.tsx`
- Create: `components/admin/insights/InsightsConversionState.tsx`
- Create: `components/admin/insights/InsightsRecommendations.tsx`
- Create: `components/admin/insights/AdminAssistantDrawer.tsx`
- Create: `tests/admin-vnext-intelligence.test.mjs`

- [ ] **Step 1: Écrire les tests RED de projection et d'accessibilité**

Exiger le bundle v2, labels observed, états non mesurés, aucune valeur de funnel sans preuve, descriptions textuelles de charts, focus trap/restore du drawer, Escape, FR/EN et absence de montage assistant tant que les feature gates ne sont pas verts.

- [ ] **Step 2: Implémenter la page fidèle à `3.png`**

Assembler essentiels, recherches, carte d'attention, contexte, funnel-state, scorecards, catégories et recommandations. Les bulles et tailles dérivent de valeurs disponibles; aucune valeur visuelle n'existe sans équivalent textuel.

- [ ] **Step 3: Implémenter le drawer mobile/desktop**

Le drawer se charge après intention, affiche source `mistral|rules`, preuves utilisées et états d'erreur récupérables. Il ne conserve pas de transcript sensible dans le stockage navigateur.

- [ ] **Step 4: Brancher la route serveur**

`app/admin/insights/page.tsx` obtient l'accès, charge le bundle et rend `activeRoute="intelligence"`; aucun paramètre URL ne fournit restaurant/menu/source.

- [ ] **Step 5: Exécuter et commit**

```powershell
Invoke-IntelligenceNative 'GREEN UI Intelligence' { node --test tests/admin-vnext-intelligence.test.mjs tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs }
Invoke-IntelligenceNative 'lint UI Intelligence' { npm run lint }
Invoke-IntelligenceNative 'typecheck UI Intelligence' { npm run typecheck }
Invoke-IntelligenceNative 'stage UI Intelligence' { git add app/admin/insights/page.tsx components/admin/insights components/admin/AdminAssistant.tsx tests/admin-vnext-intelligence.test.mjs }
Invoke-IntelligenceNative 'commit UI Intelligence' { git commit -m "feat(admin): rebuild evidence-led intelligence" }
```

### Task 6: QA E2E et gates finales de branche

**Files:**
- Modify: `e2e/admin-insights.spec.ts`
- Modify: `e2e/admin-insights-fidelity.spec.ts`
- Create: `e2e/admin-vnext-assistant.spec.ts`
- Modify: `tests/admin-vnext-intelligence.test.mjs`

- [ ] **Step 1: Écrire les scénarios E2E**

Couvrir page sans métrique, charts avec preuves, recherche k-anonyme, funnel unmeasured, drawer clavier, prompt injection, quota `denied|unavailable|error` sans requête Mistral, timeout, fallback règles, FR/EN, thèmes, `390`, `430`, tablette et `1448 × 1086`. Modifier `e2e/admin-insights.spec.ts` et `e2e/admin-insights-fidelity.spec.ts` pour entrer par la fixture admin locale déterministe lorsque `VISTAIRE_ADMIN_VISUAL_FIXTURE=1`, sans lire de QR token et sans aucun `test.skip`, `test.fixme` ou branche de succès vide. Installer dans les trois specs une garde réseau qui échoue dès qu'une requête HTTP(S), WebSocket ou EventSource vise un host autre que `localhost`, `127.0.0.1` ou `::1`. Étendre `tests/admin-vnext-intelligence.test.mjs` avec un contrat source qui interdit tokens QR/skips, exige les deux variables hermétiques et la garde loopback. Vérifier qu'aucune clé, raw event ou requête cross-scope n'est visible dans réseau/DOM/console.

- [ ] **Step 2: Exécuter Playwright et le corpus**

```powershell
Invoke-IntelligenceNative 'tests Intelligence/Assistant' { node --test tests/admin-assistant-isolation.test.mjs tests/admin-vnext-assistant-evaluation.test.mjs tests/admin-vnext-assistant-security.test.mjs tests/admin-vnext-mistral-contract.test.mjs tests/admin-vnext-intelligence.test.mjs }
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
  Invoke-IntelligenceNative 'E2E Intelligence/Assistant hermétique sans skip' { node scripts/run-playwright-e2e.mjs e2e/admin-insights.spec.ts e2e/admin-insights-fidelity.spec.ts e2e/admin-vnext-assistant.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only --build --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts }
} finally {
  foreach ($AdminEnvName in $AdminEnvNames) {
    [Environment]::SetEnvironmentVariable($AdminEnvName, $PreviousAdminEnv[$AdminEnvName], 'Process')
  }
}
```

- [ ] **Step 3: Exécuter les gates complets**

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
$DatabaseIdentity = (Invoke-IntelligenceNative 'identité DB Intelligence-AI finale' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -At -v ON_ERROR_STOP=1 -c "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text" }).Trim()
if (-not $DatabaseIdentity) { throw "Impossible de vérifier l’identité de la base éphémère" }
Write-Output "Gate DB éphémère: project=$EphemeralProjectRef identity=$DatabaseIdentity"
Invoke-IntelligenceNative 'SQL quota Assistant final' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -v ON_ERROR_STOP=1 -f tests/postgres/admin-assistant-rate-limit/run.sql }
Invoke-IntelligenceNative 'assets Intelligence' { npm run assets:check }
Invoke-IntelligenceNative 'lfs Intelligence' { npm run lfs:check }
Invoke-IntelligenceNative 'lint Intelligence' { npm run lint }
Invoke-IntelligenceNative 'typecheck Intelligence' { npm run typecheck }
Invoke-IntelligenceNative 'build Intelligence' { npm run build }
Invoke-IntelligenceNative 'test:admin Intelligence' { npm run test:admin }
```

- [ ] **Step 4: Nettoyer, vérifier le scope et commit**

```powershell
Invoke-IntelligenceNative 'diff-check Intelligence' { git diff --check "$ExpectedBase...HEAD" }
Invoke-IntelligenceNative 'diff paths Intelligence' { git diff --name-only "$ExpectedBase...HEAD" }
Invoke-IntelligenceNative 'status Intelligence' { git status --short }
Invoke-IntelligenceNative 'stage E2E Intelligence' { git add e2e/admin-insights.spec.ts e2e/admin-insights-fidelity.spec.ts e2e/admin-vnext-assistant.spec.ts tests/admin-vnext-intelligence.test.mjs }
Invoke-IntelligenceNative 'commit E2E Intelligence' { git commit -m "test(admin): verify intelligence and assistant" }
```

- [ ] **Step 5: Relancer les advisors et émettre le receipt final obligatoire**

Après le commit final, relancer Security Advisors et Performance Advisors sur `$EphemeralProjectRef`. Le runner d’advisors retourne `$AssistantAdvisorReceipt` sous forme de hashtable avec exactement `ProjectRef`, `Environment`, `ReviewedHead`, `MigrationSha256`, `DatabaseIdentity`, `SecurityCompletedAtUtc`, `PerformanceCompletedAtUtc`, `OpenP0`, `OpenP1` et `LogUri`. `LogUri` pointe vers les logs immuables hors dépôt de cette relance; aucun ancien résultat n’est réutilisé.

```powershell
$FinalHead = Invoke-IntelligenceNative 'HEAD final Intelligence-AI' { git rev-parse HEAD }
$MigrationSha256 = (Get-FileHash -LiteralPath "$IntelligenceWorktree\supabase\migrations\20260811200000_admin_assistant_rate_limit.sql" -Algorithm SHA256 -ErrorAction Stop).Hash
$DatabaseIdentity = (Invoke-IntelligenceNative 'identité DB receipt Intelligence-AI' { psql -X --no-psqlrc "$EphemeralDatabaseUrl" -At -v ON_ERROR_STOP=1 -c "select current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text" }).Trim()
Assert-IntelligenceAdvisorReceipt -Receipt $AssistantAdvisorReceipt -ExpectedProjectRef $EphemeralProjectRef -ExpectedHead $FinalHead -ExpectedMigrationSha256 $MigrationSha256 -ExpectedDatabaseIdentity $DatabaseIdentity
Invoke-IntelligenceNative 'status final Intelligence-AI' { git status --short --branch }
```

Expected: les deux advisors viennent d’être relancés sur la cible éphémère exacte; le receipt correspond au HEAD final, au SHA-256 de la migration et à l’identité DB relue, contient les deux horodatages et les logs, et déclare `OpenP0=0`, `OpenP1=0`. Sinon le handoff est bloqué.
