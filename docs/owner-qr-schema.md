# Owner QR codes - schema & apply guide

The Vistaire owner QR system uses a dedicated `qr_codes` table so that every QR
points at a secure, stable, non-guessable Vistaire URL:
`https://vistaire.ca/q/<token>`.

The `/q/<token>` route resolves the token server-side, then redirects to one of
two internal target kinds:

- Menu QR: `/menu/<restaurant-slug>` for guests.
- Restaurant dashboard QR: `/admin` for internal restaurant use.

Admin QR codes exchange the opaque persistent QR token for an eight-hour,
HTTP-only session scoped to the QR row's restaurant. The session is signed with
the dedicated `VISTAIRE_ADMIN_SESSION_SECRET`, and every protected request
revalidates the active admin QR row. They never contain credentials or service
role keys.

## Why a table (and not the slug in the QR)

- The QR must not expose Supabase ids or the raw slug as a security boundary.
- Tokens are generated server-side with `crypto.randomBytes` (never `Math.random`).
- Only the hash of the token is stored (`token_hash`); the raw token is returned
  to the owner once, at creation, to render/download the QR.
- The public `/q/[token]` route hashes the incoming token, matches `token_hash`,
  checks `status = 'active'`, atomically increments `scan_count` via the
  `resolve_qr_code_scan` RPC, and redirects only to a sanitized internal
  `target_path`.
- External destinations such as `https://...`, `http://...`, `//...`, and paths
  containing backslashes are rejected before persistence and again on resolve.

## Table

See [`supabase/migrations/0001_qr_codes.sql`](../supabase/migrations/0001_qr_codes.sql).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `restaurant_id` | uuid | owning restaurant; FK to `restaurants(id)` with `ON DELETE CASCADE`, required for `admin` |
| `label` | text | owner-facing label, for example `QR menu - Maison` or `QR admin - Maison` |
| `token_hash` | text | unique; SHA-256 / HMAC-SHA256 of the token |
| `token_preview` | text | first chars only, for the UI |
| `target_path` | text | internal redirect target |
| `target_kind` | text | `menu` \| `admin`; `NOT NULL` after the schema hardening migration |
| `style_json` | jsonb | `OwnerQrStyle` snapshot |
| `status` | text | `active` \| `paused` \| `archived` |
| `scan_count` | integer | incremented on resolve |
| `last_scanned_at` | timestamptz | last resolve time |
| `created_at` / `updated_at` | timestamptz | timestamps (trigger keeps `updated_at`) |

## How to apply

This repo has no Supabase CLI wired in, so apply the migration manually:

**Option A - Supabase SQL editor (recommended)**
1. Open your Supabase project, then SQL Editor.
2. Paste the contents of `supabase/migrations/0001_qr_codes.sql`, then run.
3. Paste the contents of `supabase/migrations/0002_qr_resolve_scan_rpc.sql`, then run.
4. Paste `supabase/migrations/20260709180000_admin_qr_access.sql`, then run.
5. Re-running the admin QR migration is safe when stored rows satisfy its
   invariants (`if not exists`, catalog guards, and `create or replace` are used
   where needed). Invalid legacy rows raise an exception before data changes.

**Option B - psql**
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_qr_codes.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_qr_resolve_scan_rpc.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260709180000_admin_qr_access.sql
```

No Supabase or production migration was applied as part of this repository
change. The commands above remain manual operator steps.

## Target hardening and legacy rows

`20260709180000_admin_qr_access.sql` makes `target_kind` required and
limits it to `menu` or `admin`. Rows already classified as `admin`, plus rows
with no kind whose destination is `/admin`, `/admin/*`, `/admin?*`, `/owner`,
`/owner/*`, or `/owner?*`, are canonicalized to `target_path = '/admin'`. A
missing kind is backfilled as `menu` only for known menu paths: exactly `/demo`
or `/menu/*`.

Before the first update, the migration rejects non-null kinds outside
`menu`/`admin`, explicit menu rows with non-menu paths, explicit admin rows with
paths outside the historical admin family, and kind-less rows with unknown
paths (including `/demo?...`). It never promotes an explicitly `menu` or unknown
row to `admin`.

Every admin QR must include `restaurant_id`. Before any backfill, the migration
checks both stored `target_kind = 'admin'` values and every legacy admin path.
It also rejects every non-null `restaurant_id` that has no matching
`restaurants` row. Either problem raises a clear exception before any data
update. An operator must identify the correct restaurant and remediate the row
before re-running the migration; the migration deletes no row and invents no
restaurant.

On a remediated database, the kind, admin restaurant, admin path, menu path, and
restaurant foreign-key constraints are replaced with their canonical
definitions and fully validated. Admin paths must be exactly `/admin`; menu
paths must be exactly `/demo` or `/menu/*`. The FK uses `ON DELETE CASCADE`,
matching the restaurant hard-delete workflow and also protecting direct
database deletes. The obsolete nullable `qr_codes_target_kind_check`
constraint is removed before the canonical required-kind constraint is added.

The backfill preserves every existing row along with `token_hash`,
`token_preview`, `style_json`, `status`, scan counters, scan timestamps, and
creation/update dates. The migration temporarily disables only the
`qr_codes_set_updated_at` trigger around the two metadata backfills and restores
it before commit so historical `updated_at` values remain unchanged.

## Atomic scan counts

Concurrent scans of the same QR must not lose events. Apply
`0002_qr_resolve_scan_rpc.sql`, which defines `resolve_qr_code_scan(token_hash)`:
a single `UPDATE ... SET scan_count = scan_count + 1 ... RETURNING target_path`.
Without this RPC, redirects still work but scan counts are not incremented.

The admin QR migration also defines
`resolve_qr_code_scan_metadata(token_hash)`: one atomic `UPDATE` increments the
counter, records `last_scanned_at`, and returns the QR id, restaurant, target
kind, canonical path, and status. Both RPCs are `security definer` server-side
operations. The metadata RPC uses an empty `search_path`, schema-qualifies the
table and `pg_catalog.now()`, revokes execution from `public`, `anon`, and
`authenticated`, and grants it only to `service_role`. The older menu-only RPC
retains its original `search_path = public` declaration.

The application fallback to the older `resolve_qr_code_scan` RPC remains
menu-only. It is attempted only when the metadata RPC is unavailable (Postgres
`42883` or PostgREST `PGRST202`). When Supabase provides a different non-empty
error code, resolution fails closed regardless of the message. Without an error
code, the message must explicitly identify `resolve_qr_code_scan_metadata` as
the missing function (including the standard schema-cache not-found message);
a generic schema-cache message is not enough. The legacy result must match an
active row id and its stored path, and that path must be exactly `/demo` or
start with `/menu/`. Legacy `/admin`, `/admin/*`, `/owner`, and `/owner/*`
paths never resolve through this compatibility branch. The fallback select
intentionally does not request `target_kind`, so it remains compatible with the
older schema.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (already used) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only access to `qr_codes` (already used) |
| `VISTAIRE_QR_TOKEN_SECRET` | Optional. Peppers the token hash and signs the dev fallback token. Set this in production. |
| `VISTAIRE_QR_TOKEN_PREVIOUS_SECRETS` | Optional comma-separated legacy QR hash secrets retained during rotation. |
| `VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION` | Server-only version used to encrypt new recoverable canonical QR tokens. |
| `VISTAIRE_QR_TOKEN_KEY_RING` | Server-only JSON object mapping every retained version to one base64url-encoded 32-byte AES key. |
| `VISTAIRE_ADMIN_SESSION_SECRET` | Dedicated secret (at least 32 bytes) for eight-hour restaurant admin sessions. |

### Canonical token vault

Both vault variables are required for canonical QR encryption and decryption.
They must never use a `NEXT_PUBLIC_` prefix or be exposed to client code.

`VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION` is one identifier matching
`[A-Za-z0-9][A-Za-z0-9._-]{0,63}`. `VISTAIRE_QR_TOKEN_KEY_RING` is a
canonical single-line JSON object with no whitespace or duplicate versions:

```text
{"<version-1>":"<base64url key without padding>","<version-2>":"<base64url key without padding>"}
```

Every decoded key must be exactly 32 bytes. Generate each key independently
with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

To rotate, generate a new 32-byte key, add it under a new version while
retaining every version still referenced by a stored QR envelope, then set
`VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION` to the new version in the same
deployment configuration. New envelopes use the active version; old envelopes
continue to decrypt through their explicit version. Never remove an old entry
until no stored envelope references it. Missing versions, malformed JSON,
non-canonical base64url, and keys of any other decoded length fail closed; the
vault has no fallback key.

## Fallback behaviour (no DB yet)

If Supabase is not configured, QR creation degrades gracefully to a stateless
signed token (HMAC-signed, dev/build only):

- A menu QR still works: `/q/<signed-token>` verifies the signature and redirects.
- Nothing is persisted, so `scan_count`, `status`, and saved styles are not
  available.
- The owner UI clearly labels these menu QR codes as non persisted.
- Admin/dashboard QR creation fails closed without persistent Supabase storage.

If Supabase is configured but the `qr_codes` insert fails, the API returns an
error instead of claiming production persistence.

## Supabase incident references

QR create and update failures caused by Supabase return a stable error code and
a non-predictable incident reference in the user-facing message. Configuration
absence can enable the signed fallback only for a valid menu QR; admin QR
creation always requires a non-empty restaurant id and persistent storage.

Server logs record the same incident id with a stable QR operation/code and
either the Supabase `code`, `message`, `details`, and `hint` fields or a
configuration reason. Raw QR tokens and `token_hash` values are never included
in these incident objects; token-shaped values in Supabase text are redacted.
This includes opaque base64url values as short as 32 characters. Normal lookup
misses are not logged as incidents.
