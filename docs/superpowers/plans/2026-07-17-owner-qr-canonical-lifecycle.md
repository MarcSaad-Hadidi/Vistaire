# Owner QR Canonical Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one stable recoverable owner QR per restaurant/type/purpose slot while preserving every historical printed QR.

**Architecture:** A server-only AES-256-GCM vault recovers new QR tokens. PostgreSQL RPCs and a partial unique index own canonical-slot concurrency. Owner API routes expose read, get-or-create, stable update, and explicit rotation without serializing raw vault material.

**Tech Stack:** Next.js App Router, TypeScript, Node `node:crypto`, Supabase/PostgreSQL PL/pgSQL, Node test runner, Playwright.

## Global Constraints

- Historical rows without `token_ciphertext` remain active, hash-resolvable, unchanged, and `is_canonical = false`.
- Reads never generate a token or write to Supabase.
- The slot is `restaurantId + targetKind + purposeKey`; `purposeKey` is `default`.
- The database is the uniqueness authority; never use an upsert that updates token or vault columns.
- AES-256-GCM uses an exact 32-byte decoded key, a random 12-byte nonce, verified tag, and explicit key version.
- `PATCH` accepts only non-empty `label` and/or `style`.
- Rotation is explicit; the old QR remains active and resolvable by default.
- Do not change scan-count behavior except for the isolated, already-approved old-schema projection fallback.
- Do not add dependencies, large assets, secrets, logs, automatic migration application, deployment, or merge.
- npm is the package manager.

---

## Worktree ownership map

| Worktree | Owns | Must not edit |
| --- | --- | --- |
| `qr-token-vault` | `lib/owner/qrTokenVault.ts`, `tests/owner-qr-token-vault.test.mjs`, `.env.example`, vault section of `docs/owner-qr-schema.md` | store, types, routes, SQL, UI |
| `qr-canonical-concurrency` | one new migration, `tests/owner-qr-canonical-migration.test.mjs`, SQL/runtime fixture additions, deterministic concurrency tests | runtime store/routes/types, UI |
| `qr-canonical-domain-api` | `qrStore.ts`, `qrCreationCore.ts`, `types.ts`, owner QR routes, route/store contract tests, isolated legacy fallback | SQL, vault implementation, UI |
| orchestrator | test integration and any minimal `OwnerQrCustomizer`/`MenuUiBuilder` adaptation justified by failing integration tests | unrelated product areas |

The migration owner defines the RPC names and row shapes first. The vault owner
defines the TypeScript helper signatures first. The domain owner consumes both
interfaces without changing their owned files.

### Task 1: Preserve and normalize the approved RED contracts

**Files:**
- Modify: `tests/owner-qr-canonical-contracts.test.mjs`
- Modify: `tests/helpers/owner-qr-test-runtime.mjs`
- Preserve: `tests/admin-qr-legacy-schema-contracts.test.mjs`

**Interfaces:**
- Consumes: current `createOwnerQrCode`, route handlers, and fixture.
- Produces: executable tests for the nine approved acceptance criteria.

- [ ] **Step 1: Separate factual pre-fix reproductions from post-fix invariants**

Move contradictory controls that require duplicate rows into a clearly named
pre-fix reproduction group/file. Keep the approved post-fix assertions active.
Change the superseded second-call assertion from an empty URL to:

```js
assert.equal(second.record.id, first.record.id);
assert.equal(second.record.redirectUrl, first.record.redirectUrl);
assert.equal("token" in second, false);
```

- [ ] **Step 2: Add the mandatory acceptance cases**

Add tests for zero-row migration behavior, immutable historical rows, read-only
GET, first and second POST, 20-way concurrency, unrecoverable canonical, stable
style update, and confirmed rotation. Snapshot historical fields before each
mutation and compare them afterward.

- [ ] **Step 3: Run RED**

Run:

```powershell
node --test tests/owner-qr-canonical-contracts.test.mjs tests/admin-qr-legacy-schema-contracts.test.mjs
```

Expected: the canonical lifecycle cases fail for missing schema/store/routes;
existing unrelated controls pass.

- [ ] **Step 4: Commit the test contract**

```powershell
git add tests/owner-qr-canonical-contracts.test.mjs tests/admin-qr-legacy-schema-contracts.test.mjs tests/helpers/owner-qr-test-runtime.mjs
git commit -m "test: define canonical owner QR lifecycle"
```

### Task 2: Implement the server-only token vault

**Files:**
- Create: `lib/owner/qrTokenVault.ts`
- Create: `tests/owner-qr-token-vault.test.mjs`
- Modify: `.env.example`
- Modify: `docs/owner-qr-schema.md`

**Interfaces:**
- Produces:

```ts
export type QrTokenVaultBinding = {
  qrId: string;
  restaurantId: string;
  targetKind: "menu" | "admin";
  purposeKey: string;
};

export type QrTokenEnvelope = {
  ciphertext: string;
  nonce: string;
  keyVersion: string;
};

export function encryptQrToken(
  token: string,
  binding: QrTokenVaultBinding
): QrTokenEnvelope;

export function decryptQrToken(
  envelope: QrTokenEnvelope,
  binding: QrTokenVaultBinding
): string;
```

- [ ] **Step 1: Write vault RED tests**

Cover round trip, nonce uniqueness, bad tag/ciphertext, wrong key, wrong
binding, 11/13-byte nonce, unknown version, 31/33-byte keys, historical key
decrypt after active-key rotation, and redacted thrown/logged text.

- [ ] **Step 2: Run vault RED**

```powershell
node --test tests/owner-qr-token-vault.test.mjs
```

Expected: FAIL because `qrTokenVault.ts` is absent.

- [ ] **Step 3: Implement the minimal strict vault**

Use `createCipheriv("aes-256-gcm", key, nonce)`, include the stable serialized
binding as AAD, append the 16-byte tag to the ciphertext encoding, and verify it
with `setAuthTag` during decrypt. Parse a versioned server-only key ring and
reject every malformed configuration without fallback.

- [ ] **Step 4: Document variable names only**

Add empty entries for the active version and key ring to `.env.example`, and
document exact generation/rotation formats without committing a value.

- [ ] **Step 5: Run vault GREEN and review**

```powershell
node --test tests/owner-qr-token-vault.test.mjs
npm run lint
npm run typecheck
```

Expected: all vault tests pass; lint and typecheck exit 0.

- [ ] **Step 6: Commit**

```powershell
git add lib/owner/qrTokenVault.ts tests/owner-qr-token-vault.test.mjs .env.example docs/owner-qr-schema.md
git commit -m "feat: add owner QR token vault"
```

### Task 3: Add canonical schema and atomic RPCs

**Files:**
- Create: `supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql`
- Create: `tests/owner-qr-canonical-migration.test.mjs`
- Modify: `tests/helpers/owner-qr-test-runtime.mjs`
- Modify: `tests/owner-qr-canonical-contracts.test.mjs`

**Interfaces:**
- Produces RPCs:

```sql
owner_get_or_create_canonical_qr(
  p_id uuid, p_restaurant_id uuid, p_label text,
  p_target_kind text, p_purpose_key text, p_target_path text,
  p_token_hash text, p_token_preview text, p_token_ciphertext text,
  p_token_nonce text, p_token_key_version text, p_style_json jsonb
)

owner_rotate_canonical_qr(
  p_previous_id uuid, p_new_id uuid, p_restaurant_id uuid,
  p_target_kind text, p_purpose_key text, p_label text,
  p_target_path text, p_token_hash text, p_token_preview text,
  p_token_ciphertext text, p_token_nonce text,
  p_token_key_version text, p_style_json jsonb,
  p_confirm boolean
)
```

Both return enough columns to distinguish `created`, current id, and current
vault envelope. Execution is revoked from public/anon/authenticated and granted
only to `service_role`.

- [ ] **Step 1: Write migration RED tests**

Assert additive nullable columns, `is_canonical default false`, no historical
UPDATE/backfill, the status-independent unique partial index, vault all-or-none
constraint, locked `search_path`, grants, shared advisory lock expression, no
`DO UPDATE`, and confirmed rotation that changes only old `is_canonical`.

- [ ] **Step 2: Run migration RED**

```powershell
node --test tests/owner-qr-canonical-migration.test.mjs
```

Expected: FAIL because the migration is absent.

- [ ] **Step 3: Write the additive migration**

Use catalog-guarded `ADD COLUMN`, validation checks, the partial unique index,
and `SECURITY DEFINER SET search_path = ''` functions. Do not update any
existing row.

- [ ] **Step 4: Model deterministic 20-way concurrency**

Extend the fixture so all callers offer distinct candidates, one winner is
stored, losers reread that row, and no losing candidate appears in persisted
rows or captured logs.

- [ ] **Step 5: Run concurrency GREEN and review**

```powershell
node --test tests/owner-qr-canonical-migration.test.mjs tests/owner-qr-canonical-contracts.test.mjs
```

Expected: migration and fixture-level concurrency cases pass once consumers are
integrated; report consumer-dependent failures explicitly.

- [ ] **Step 6: Commit**

```powershell
git add supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql tests/owner-qr-canonical-migration.test.mjs tests/helpers/owner-qr-test-runtime.mjs tests/owner-qr-canonical-contracts.test.mjs
git commit -m "feat: add canonical owner QR database authority"
```

### Task 4: Implement canonical store and owner API

**Files:**
- Modify: `lib/owner/types.ts`
- Modify: `lib/owner/qrCreationCore.ts`
- Modify: `lib/owner/qrStore.ts`
- Modify: `app/api/owner/qr-codes/route.ts`
- Modify: `app/api/owner/qr-codes/[id]/route.ts`
- Create: `app/api/owner/qr-codes/[id]/rotate/route.ts`
- Modify: `tests/owner-qr-canonical-contracts.test.mjs`
- Modify: `tests/admin-qr-legacy-schema-contracts.test.mjs`

**Interfaces:**
- Consumes: Task 2 vault signatures and Task 3 RPC signatures.
- Produces:

```ts
export type OwnerQrCanonicalRead = {
  found: boolean;
  recoverable: boolean;
  record: OwnerQrCodeRecord | null;
};

export async function getOwnerCanonicalQrCode(args: {
  restaurantId: string;
  targetKind: OwnerQrTargetKind;
  purposeKey: string;
}): Promise<OwnerQrCanonicalRead | QrSupabaseFailure>;

export async function getOrCreateOwnerQrCode(
  args: CreateOwnerQrCodeArgs & { purposeKey: string }
): Promise<CanonicalQrMutationResult>;

export async function rotateOwnerQrCode(
  id: string,
  args: { confirmed: true }
): Promise<CanonicalQrRotationResult>;
```

- [ ] **Step 1: Run the focused RED suite**

```powershell
node --test tests/owner-qr-canonical-contracts.test.mjs tests/admin-qr-legacy-schema-contracts.test.mjs tests/owner-qr-contract.test.mjs tests/owner-qr-runtime.test.mjs
```

Expected: approved lifecycle and legacy 42703 tests fail.

- [ ] **Step 2: Add canonical record/result types**

Make `purposeKey`, `isCanonical`, and `recoverable` explicit. Make
`redirectUrl` optional/conditional and remove the raw token from route response
types.

- [ ] **Step 3: Implement read and get-or-create**

Read canonical metadata without mutation. Decrypt only a complete envelope.
Before creating, generate one candidate token/hash/envelope and send it to the
RPC. If the RPC returns an existing row, discard the local candidate and
decrypt the returned winner. If the winner is unrecoverable, return
`canonical-unrecoverable` without retrying or inserting.

- [ ] **Step 4: Restrict PATCH**

Reject empty bodies and unknown keys. Build an update containing only
`style_json` and/or `label`; never call token generation, hashing, or vault
encryption.

- [ ] **Step 5: Implement confirmed rotation**

Reject absent/false confirmation. Generate the new id/token/hash/envelope, call
the rotation RPC, and return previous/current metadata plus only the recovered
current URL.

- [ ] **Step 6: Repair the isolated old-schema projection**

On a precise `42703` for `target_kind`, retry the select without that column,
treat the result as menu, validate the menu path, and increment exactly once.
Do not alter the metadata RPC path or scan-count order.

- [ ] **Step 7: Run focused GREEN and review**

```powershell
node --test tests/owner-qr-canonical-contracts.test.mjs tests/admin-qr-legacy-schema-contracts.test.mjs tests/owner-qr-contract.test.mjs tests/owner-qr-runtime.test.mjs tests/owner-qr-resolution.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit**

```powershell
git add lib/owner/types.ts lib/owner/qrCreationCore.ts lib/owner/qrStore.ts app/api/owner/qr-codes tests/owner-qr-canonical-contracts.test.mjs tests/admin-qr-legacy-schema-contracts.test.mjs
git commit -m "feat: implement canonical owner QR lifecycle"
```

### Task 5: Integrate the owner client only where the backend contract requires it

**Files:**
- Modify if required by failing tests: `components/owner/OwnerQrCustomizer.tsx`
- Modify if required by failing tests: the existing `MenuUiBuilder` QR caller
- Modify: focused UI contract tests

**Interfaces:**
- Consumes: GET canonical response, POST get-or-create response, and PATCH
  metadata response from Task 4.
- Produces: no mutation on reload or unchanged Save; PATCH `{style}` for a
  style-only Save.

- [ ] **Step 1: Run UI contract RED**

```powershell
node --test tests/owner-qr-canonical-contracts.test.mjs tests/owner-qr-runtime.test.mjs
```

- [ ] **Step 2: Hydrate without mutation**

GET on slot change with `cache: "no-store"`. Preserve the recovered URL in
client state and establish a normalized baseline.

- [ ] **Step 3: Route mutations**

No-op unchanged Save; POST only when no canonical exists; PATCH exactly
`{style}` or `{label}` for existing canonical. Never place the secret URL in a
query string, analytics event, or server-shared cache.

- [ ] **Step 4: Run UI contract GREEN**

Run the Task 5 RED command again and expect all tests to pass.

- [ ] **Step 5: Commit**

```powershell
git add components tests
git commit -m "fix: keep owner QR saves stable"
```

### Task 6: Integration, review, browser QA, and full validation

**Files:**
- Modify only files required to resolve reviewed defects.

**Interfaces:**
- Consumes: reviewed commits from all three worktrees.
- Produces: one integrated, unmerged, undeployed implementation branch.

- [ ] **Step 1: Integrate commits serially**

Cherry-pick vault, then migration/concurrency, then domain/API. Resolve
test-helper overlap in the orchestrator. Do not merge worktree branches and do
not apply the migration.

- [ ] **Step 2: Run focused tests**

```powershell
node --test tests/owner-qr-token-vault.test.mjs tests/owner-qr-canonical-migration.test.mjs tests/owner-qr-canonical-contracts.test.mjs tests/admin-qr-legacy-schema-contracts.test.mjs tests/owner-qr-contract.test.mjs tests/owner-qr-runtime.test.mjs tests/owner-qr-resolution.test.mjs
```

- [ ] **Step 3: Run repository gates**

```powershell
npm run assets:check
npm run lfs:check
npm run lint
npm run typecheck
npm run build
npm run test:admin
```

All commands must exit 0, or the exact blocker and residual risk must be
reported.

- [ ] **Step 4: Run relevant Playwright and browser QA**

Start the local server, exercise owner QR GET/POST/PATCH/rotate in Chrome
DevTools or equivalent, and verify status codes, `Cache-Control`, no unexpected
console error, no 404/500, no horizontal overflow at 390px and 430px, and no
token/vault leakage in unrelated payloads or logs.

- [ ] **Step 5: Review every worktree and the integrated diff**

Run task-scoped review in each worktree, fix every P0/P1, then review the full
merge-base diff. Re-run the tests covering every fix.

- [ ] **Step 6: Clean and inspect**

Remove task-generated `.next`, `test-results`, `playwright-report`, screenshots,
videos, traces, debug scripts, `console.log`, and `debugger`. Run:

```powershell
git status --short
git diff --check
```

Verify no secret, `.env`, heavy asset, production data change, merge, deploy, or
migration application occurred.

