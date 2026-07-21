# Owner QR codes — schema, secrets and lifecycle

Vistaire stores persistent menu and restaurant-admin QR codes in
`public.qr_codes`. A printed QR contains only an opaque URL of the form
`https://<public-origin>/q/<token>`. The route resolves the token server-side
and redirects only to an allowed internal target:

- `menu`: `/demo` or `/menu/<restaurant-slug>`;
- `admin`: exactly `/admin`, after exchange for an eight-hour HTTP-only session
  scoped to the row's restaurant.

No QR contains a Supabase id, service-role key, admin-session secret or vault
key. Secrets and recoverable tokens must not be logged.

## Storage model

The migrations must be considered in this order:

1. `0001_qr_codes.sql`: base table and statuses;
2. `0002_qr_resolve_scan_rpc.sql`: atomic menu scan resolver;
3. `0007_restaurants.sql`: `restaurants` table required by the QR foreign key;
4. `20260709180000_admin_qr_access.sql`: required `target_kind`, canonical
   admin/menu paths, restaurant FK and metadata resolver;
5. the integrated candidate revision of the canonical lifecycle migration:
   additive canonical slot, recoverable token envelope, persistent lifecycle,
   operation-id idempotency and owner-only inventory support.

The numeric migration name alone is not evidence of this candidate revision.
On the audited `8c6672d…` head, `20260717120000_owner_qr_canonical_lifecycle.sql`
contains only the earlier canonical get-or-create/rotation contract; it does not
contain persistent `revoked`, lifecycle timestamps, `config_version`, lifecycle
RPCs or inventory. This docs/preflight branch is therefore **BLOCKED** for
rollout until the separately reviewed DB and runtime candidate commits are
integrated. Do not apply the older file expecting the contract below.

The last migration never promotes or rewrites a historical row. Existing rows
remain noncanonical because `is_canonical` defaults to `false`; their hashes,
targets, styles, statuses, counters and timestamps are preserved.

| Column | Meaning |
| --- | --- |
| `id`, `restaurant_id` | QR identity and owning restaurant |
| `label`, `style_json` | owner-facing metadata |
| `target_kind`, `target_path` | `menu`/allowed menu path or `admin`/`/admin` |
| `token_hash`, `token_preview` | lookup hash and non-secret short preview |
| `status` | candidate contract: `active`, `paused`, `archived` or `revoked` |
| `scan_count`, `last_scanned_at` | atomic resolution counters |
| `purpose_key`, `is_canonical` | canonical slot identity and current member |
| `token_ciphertext`, `token_nonce`, `token_key_version` | complete AES-256-GCM recovery envelope, or all null for historical rows |
| `supersedes_qr_code_id`, `rotated_at` | immutable rotation chain metadata |
| `revoked_at`, `status_changed_at` | irreversible revocation time and latest lifecycle transition time |
| `config_version` | positive owner-only optimistic-concurrency version; never public QR data |
| `created_at`, `updated_at` | lifecycle timestamps |

The candidate lifecycle persists all four statuses. Resolvers accept only
`active`, so paused, archived and revoked rows are refused without physical
deletion. `revoked` requires `revoked_at` and is irreversible. Every historical
row remains evidence to preserve.

## Hashes and recoverable canonical tokens

Resolution remains hash-based. New storage hashes use the versioned
`sha256:<hex>` form. Legacy SHA-256 and up to four configured legacy HMAC
peppers remain lookup candidates so historical printed QRs keep working during
hash-secret rotation.

The raw token of a new canonical QR is also encrypted server-side with
AES-256-GCM. The authenticated binding is the QR id, restaurant id, target kind
and purpose key. The database stores ciphertext plus authentication tag, a
12-byte random nonce, and the explicit key version. This is encrypted,
recoverable material—not a one-way hash—and it is returned only as an owner QR
URL after successful authenticated decryption. A missing key version or an
invalid/incomplete envelope fails closed as `canonical-unrecoverable`; the
application must not silently create a replacement.

Historical rows without envelopes remain resolvable by hash but cannot be
recovered for owner re-download. They must not be backfilled with invented
tokens or deleted.

## Canonical slot and dispositions

One canonical QR may exist for each normalized
`restaurant_id + target_kind + purpose_key` slot. Reads never generate or
persist a token. Get-or-create is concurrency-safe and returns the existing
winner without overwriting secret columns.

Rotation requires explicit confirmation and is atomic:

1. the previous row becomes `is_canonical = false` and receives `rotated_at`;
2. a new active, recoverable canonical row is inserted with
   `supersedes_qr_code_id` pointing to the previous row;
3. the previous row keeps its status, hash, encrypted envelope, URL, style and
   scan history, and therefore remains active/resolvable by default.

Rotation is explicit, idempotent through an operation id, guarded by the
expected `config_version`, and requires a disposition for the previous row:

- `keep-active`: previous QR stays active/resolvable but noncanonical;
- `pause`: previous QR stays physically preserved and paused;
- `revoke`: previous QR is irreversibly revoked with `revoked_at`.

The successor is active and canonical, inherits the next configuration version
and points to the previous row. Reusing an operation id with different inputs
fails closed. Archive is not a rotation disposition.

Lifecycle actions follow these invariants: pause preserves the canonical slot;
resume returns a paused canonical to active; archive and revoke clear
`is_canonical`; revoke cannot be resumed or reversed. Each accepted mutation
increments `config_version` once and records a metadata-only lifecycle event.
Owner inventory includes historical identity, lineage, status, timestamps and
configuration version, but excludes raw tokens, hashes, previews, ciphertext,
nonces and public redirect URLs.

There is no automatic revocation, archival, deletion, promotion or historical
cleanup. A rollback normally restores the previous application/environment
configuration; it does not delete new or old QR rows. With `keep-active`, the
old admin QR and its unexpired sessions remain valid. Rotation must not be
described as revocation unless the explicit `revoke` disposition succeeded.

## Server-only environment contract

| Variable | Requirement |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | non-secret Supabase project origin; must match the expected ref |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only database access |
| `VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF` | exact environment project ref checked by runtime/preflight |
| `VISTAIRE_QR_TOKEN_SECRET` | server-only legacy hash pepper and signed dev fallback secret |
| `VISTAIRE_QR_TOKEN_PREVIOUS_SECRETS` | optional bounded legacy peppers retained during hash rotation |
| `VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION` | version used to encrypt new canonical envelopes |
| `VISTAIRE_QR_TOKEN_KEY_RING` | canonical JSON mapping retained versions to independent 32-byte AES keys |
| `VISTAIRE_ADMIN_SESSION_SECRET` | dedicated server-only secret of at least 32 UTF-8 bytes |

Only the Supabase project URL is intentionally public. Never define a
`NEXT_PUBLIC_` variant of the service role, QR token secret, active key version,
key ring or admin-session secret. The publishable Supabase key is unrelated to
the QR vault and does not replace the service role.

The active version matches `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`. The key ring is a
single-line canonical JSON object with no whitespace or duplicate keys:

```text
{"<version>":"<base64url 32-byte key without padding>"}
```

Generate each key independently in an approved secret-handling terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Never paste generated output into Git, tickets, chat, build logs or screenshots.

## Key creation, escrow and rotation

For each environment, two authorized operators should record the version,
creation date, owner and change reference in the secret inventory. Store the
key-ring value and admin-session secret in the environment's managed secret
store. Maintain an independently access-controlled, encrypted escrow copy with
a tested recovery owner. Preview and Production must use different Supabase
projects, public origins, peppers, key rings and admin-session secrets.

To rotate the vault key:

1. inventory distinct non-null `token_key_version` values using an aggregate,
   read-only query; never select ciphertext, nonce, hash or token;
2. generate a new independent 32-byte key under a new version;
3. add it to the existing ring without removing any referenced version;
4. deploy the expanded ring first, then make the new version active in the same
   controlled environment rollout;
5. create and recover a non-client validation QR, then verify historical QR
   recovery and resolution;
6. retain every old key until a reviewed retention decision proves no stored
   envelope references it and all required backups/rollback windows have ended.

Rotating `VISTAIRE_QR_TOKEN_SECRET` is separate. Move the old pepper to
`VISTAIRE_QR_TOKEN_PREVIOUS_SECRETS` before activating the new one. Keep no more
than the four supported previous peppers and never remove one until every
printed QR depending on it has an approved disposition. The runtime silently
limits lookup to four previous peppers; a fifth retained value does not protect
older QR hashes. This is a current code limitation to track, not permission to
discard historical QRs.

Loss of a referenced vault key makes those canonical tokens unrecoverable but
does not stop hash-based scans. Freeze QR rotations, preserve all rows and
restore the exact key version from escrow. If restoration is impossible, open
an incident, inventory affected versions via aggregates, communicate the
re-download limitation, and rotate only with explicit owner approval; do not
delete or silently replace history.

If a service role, pepper, vault key or admin-session secret may be exposed,
contain it in that environment only, preserve evidence without secret values,
rotate the affected credential, expire sessions where applicable, validate
historical resolution, and follow the rollback/runbook gates. Never copy a
Production secret into Preview to accelerate recovery.

## Fallback and resolver compatibility

Without Supabase, local/dev menu QR creation may use a signed non-persistent
fallback. It has no saved style, status or scan count. Production requires
`VISTAIRE_QR_TOKEN_SECRET`; admin QR creation always fails closed without
persistent storage.

The metadata RPC is the canonical resolver and is executable only by
`service_role`. The old resolver is a menu-only compatibility path for precise
missing-function/old-schema cases. It must never resolve an admin-like target.
Resolution and scan increment remain atomic for active rows.

## Application and rollback boundary

No repository command automatically applies migrations. Operators must follow
[`docs/qa/qr-environment-rollout-runbook.md`](qa/qr-environment-rollout-runbook.md)
and apply changes Preview-first through an approved database change mechanism.
The preflight is read-only and cannot prove a migration was safely applied; it
only verifies the resulting schema contract.

Rollback is configuration/application-first. Do not down-migrate by dropping
canonical columns, RPCs, indexes or rows while either deployed code or stored
history may depend on them. If rolling the active vault version back, restore
the former active version but keep the newer key in the ring for envelopes
created during the rollout. Never run automatic cleanup against historical QR
rows.
