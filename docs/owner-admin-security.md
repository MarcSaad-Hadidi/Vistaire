# Vistaire Owner Admin Security

Vistaire has three separate surfaces:

- `/apercu-restaurateur`: public, indexable marketing page that explains the restaurateur dashboard.
- `/admin`: public, noindex restaurateur preview kept for compatibility and demos; robots disallows it so it is not treated as public SEO/marketing content.
- `/owner`: internal Vistaire cockpit for owner operations across restaurants.

## Owner allowlist

Configure at least one server-only allowlist variable in production:

```env
VISTAIRE_OWNER_EMAILS=owner@example.com,ops@example.com
VISTAIRE_OWNER_USER_IDS=user_123,user_456
VISTAIRE_OWNER_CLERK_USER_IDS=user_123,user_456
```

Do not use `NEXT_PUBLIC_*` for owner authorization. These values must stay server-side.

## Protected routes and APIs

Owner-only pages:

- `/owner`

Owner-only APIs:

- `/api/restaurants`
- `/api/owner/insights`
- `/api/analytics/summary`

Signed-out users are handled by Clerk on `/owner` and receive JSON `401` on owner APIs. Signed-in non-owners receive a safe blocked response: `/owner` returns not found, and owner APIs return JSON `403`.

## Restaurant creation persistence

`POST /api/restaurants` is an owner-only, same-origin mutation. It only returns a
creation success when Supabase persists the row and returns a real UUID `id`.
Missing Supabase configuration, duplicate slugs, failed inserts, or inserts that
do not return a UUID are returned as errors. The production schema is defined in
`supabase/migrations/0007_restaurants.sql` with `id uuid primary key default
gen_random_uuid()`, a unique `slug` index, timestamps, setup/contact fields, and
RLS enabled.

## Implementation files

- `lib/auth/ownerPolicy.ts`: parses server-only owner allowlists.
- `lib/auth/owner.ts`: checks the current Clerk user against the allowlist.
- `lib/auth/ownerApi.ts`: returns API-safe owner authorization responses.
- `app/owner/layout.tsx`: applies owner-only page protection.
