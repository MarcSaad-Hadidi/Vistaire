# Owner QR Canonical Lifecycle Design

Date: 2026-07-17

## Objective

Introduce one stable, recoverable owner QR per logical slot
`restaurantId + targetKind + purposeKey`, while preserving every historical
printed QR and its hash-based resolution.

## Approved migration policy

- Historical rows without `token_ciphertext` remain active and resolvable by
  their existing `token_hash`.
- Historical rows remain `is_canonical = false`.
- The migration does not change their `status`, `token_hash`, `token_preview`,
  `scan_count`, `last_scanned_at`, `style_json`, `target_kind`, `target_path`,
  `created_at`, or `updated_at`.
- No historical row is elected canonical.
- `token_preview` is display-only and is never used to reconstruct a token,
  URL, or QR asset.
- Reads never create or update rows.
- Only an explicit owner get-or-create mutation may create the first canonical
  row.
- A canonical row whose vault envelope is missing or invalid fails closed as
  `canonical-unrecoverable`; replacement requires explicit rotation.
- No historical cleanup, pause, archive, or revocation is in scope.

## Data model

Add nullable `purpose_key`, non-null `is_canonical` defaulting to `false`, and
nullable `token_ciphertext`, `token_nonce`, and `token_key_version`.

The canonical-slot authority is a partial unique index:

```sql
create unique index qr_codes_canonical_slot_key
  on public.qr_codes (restaurant_id, target_kind, purpose_key)
  where is_canonical = true;
```

The index must not depend on `status`. The database accepts an all-null vault
envelope so a partially deployed or legacy canonical can be represented and
reported as unrecoverable. If any vault field is present, all vault fields must
be present. The creation and rotation RPCs additionally require a complete
envelope for every new canonical row.

`purpose_key` is normalized to lowercase and is `default` for the menu and
admin owner QR slots in this change.

## Vault

The server-only vault uses `node:crypto` AES-256-GCM:

- decoded key length: exactly 32 bytes;
- random nonce length: exactly 12 bytes;
- authentication tag verified during decrypt;
- explicit key version;
- additional authenticated data binds QR id, restaurant id, target kind, and
  purpose key;
- strict base64url parsing;
- unknown version, invalid key, bad tag, invalid nonce, and altered binding all
  fail closed;
- no fallback key and no token, URL, key, nonce, or ciphertext logging.

The environment provides a server-only active key version and a versioned key
ring. Documentation contains names only, never values.

## Owner API

### Read

`GET /api/owner/qr-codes?restaurantId=...&targetKind=menu|admin&purposeKey=default`
is authenticated, read-only, and uses `Cache-Control: private, no-store,
max-age=0`.

It returns canonical metadata and `recoverable`. `redirectUrl` is present only
when the token decrypts. It never returns a raw `token` field or vault fields.
No row is created when the canonical slot is empty.

### Get or create

`POST /api/owner/qr-codes` is an authenticated, same-origin mutation.

- Existing recoverable canonical: HTTP 200, `created: false`, same id and URL,
  no token generation and no update.
- Empty canonical slot: HTTP 201, `created: true`, one new recoverable
  canonical row.
- Existing unrecoverable canonical: safe `canonical-unrecoverable` response,
  no insert or update.
- A uniqueness loser rereads the winner and never overwrites secret columns.
- A raw token is not serialized separately from the owner-only URL.

The signed non-persistent fallback is not used for this canonical flow because
it cannot satisfy database authority or stable recovery.

### Stable update

`PATCH /api/owner/qr-codes/[id]` accepts only non-empty `label` and/or `style`.
Unknown, structural, secret, status, target, counter, or vault fields are
rejected. It preserves the row id, target, hash, ciphertext, nonce, key version,
status, counters, and recovered URL.

### Rotation

`POST /api/owner/qr-codes/[id]/rotate` requires an explicit confirmation. It
atomically changes only the old row's `is_canonical` flag to `false` and inserts
a new `active`, recoverable canonical row with a new id, token, hash, nonce, and
ciphertext. The old row's status, hash, ciphertext, URL, and counters remain
unchanged, so the printed QR remains active and resolvable.

## Concurrency

The get-or-create and rotation RPCs use the same deterministic transaction-level
advisory lock for the normalized slot. The unique partial index remains the
ultimate authority.

Get-or-create performs a fresh read after lock acquisition, inserts with
`ON CONFLICT ... DO NOTHING`, and rereads the winner when the insert returns no
row. It never uses `DO UPDATE`. A token-hash collision is distinguished from a
canonical-slot conflict and never overwrites an existing token.

## Legacy resolver

Hash-based resolution and scan-count semantics remain unchanged. The isolated
PR 151 compatibility correction retries the projection without `target_kind`
only for a precise missing-column `42703`, treats that old-schema path as menu,
validates `/demo` or `/menu/*`, and calls the old scan RPC once. Admin-like
paths remain rejected.

## Required acceptance tests

1. An empty migration creates no canonical; explicit mutation creates one.
2. Multiple active historical rows remain byte-for-byte unchanged and
   noncanonical.
3. GET/reload performs no generation, insert, update, or Supabase mutation.
4. First POST creates one recoverable canonical and leaves history unchanged.
5. Second POST returns the same id, fingerprint, and URL without insert.
6. Twenty concurrent POSTs converge on one id; losing candidates are neither
   persisted nor logged.
7. An existing canonical without a valid envelope returns
   `canonical-unrecoverable` without mutation.
8. Style Save preserves id, hash, ciphertext, URL, and all historical rows.
9. Explicit rotation creates a new canonical only after confirmation and keeps
   the old QR active and resolvable.

## Ownership

- `qr-canonical-domain-api`: store, core types, owner API routes, and isolated
  legacy projection fallback. It consumes the vault and RPC interfaces and does
  not edit SQL or UI.
- `qr-token-vault`: the server-only AES helper, focused crypto tests, and
  environment documentation. It does not edit store, types, routes, or SQL.
- `qr-canonical-concurrency`: the single production migration owner plus SQL,
  fixture, migration, and deterministic concurrency tests. It does not edit
  runtime API/store or UI.
- Orchestrator: integrates the three commits, resolves the superseded RED
  controls without weakening the approved invariants, owns any minimal UI
  integration separately, performs reviews and full validation, and does not
  merge, deploy, or apply migrations.

