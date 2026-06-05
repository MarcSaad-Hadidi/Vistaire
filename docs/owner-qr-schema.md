# Owner QR codes - schema & apply guide

The Vistaire owner QR system uses a dedicated `qr_codes` table so that every QR
points at a secure, stable, non-guessable Vistaire URL:
`https://vistaire.ca/q/<token>`.

The `/q/<token>` route resolves the token server-side, then redirects to one of
two internal target kinds:

- Menu QR: `/menu/<restaurant-slug>` for guests.
- Admin owner QR: `/owner/restaurants?restaurantId=<id>` for internal owner use.

Admin QR codes are only a shortcut to a protected owner route. They never contain
credentials, service-role keys, session tokens, magic links, or any auth bypass.
Unauthenticated or unauthorized scanners are still blocked by Clerk and the
Vistaire owner allowlist.

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
| `restaurant_id` | uuid | owning restaurant (nullable) |
| `label` | text | owner-facing label, for example `QR menu - Maison` or `QR admin - Maison` |
| `token_hash` | text | unique; SHA-256 / HMAC-SHA256 of the token |
| `token_preview` | text | first chars only, for the UI |
| `target_path` | text | internal redirect target |
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
4. Re-running is safe (`if not exists` / `create or replace` guards).

**Option B - psql**
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_qr_codes.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_qr_resolve_scan_rpc.sql
```

## Atomic scan counts

Concurrent scans of the same QR must not lose events. Apply
`0002_qr_resolve_scan_rpc.sql`, which defines `resolve_qr_code_scan(token_hash)`:
a single `UPDATE ... SET scan_count = scan_count + 1 ... RETURNING target_path`.
Without this RPC, redirects still work but scan counts are not incremented.

The RPC is `security definer` for atomic server-side updates, so the migration
explicitly revokes execution from `public`, `anon`, and `authenticated`, then
grants execution only to `service_role`.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (already used) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only access to `qr_codes` (already used) |
| `VISTAIRE_QR_TOKEN_SECRET` | Optional. Peppers the token hash and signs the dev fallback token. Set this in production. |

## Fallback behaviour (no DB yet)

If Supabase is not configured, QR creation degrades gracefully to a stateless
signed token (HMAC-signed, dev/build only):

- The QR still works: `/q/<signed-token>` verifies the signature and redirects.
- Nothing is persisted, so `scan_count`, `status`, and saved styles are not
  available.
- The owner UI clearly labels these QR codes as non persisted.

If Supabase is configured but the `qr_codes` insert fails, the API returns an
error instead of claiming production persistence.
