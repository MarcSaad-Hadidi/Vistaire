# Vistaire Admin Restaurant Dashboard and QR Access Design

## Status and decision

This specification defines the V1 restaurateur dashboard at `/admin`.

The restaurant admin QR is the sole access proof for V1. There is no PIN and no
Clerk requirement. A successful scan creates an eight-hour restaurant-scoped
session. The session is useful only while its originating QR row remains active.
Pausing or archiving that QR revokes existing sessions on their next read or
mutation.

`/owner` remains the Clerk-protected internal Vistaire workspace. `/admin` must
not inherit owner privileges or owner APIs.

## Confirmed current-state problems

- `/admin` forces every request to the demo restaurant identifier.
- `/admin?restaurantId=...` is public and currently acts as a demo selector,
  although the requested identifier is discarded.
- Admin QR targets are built as `/owner/restaurants/<restaurantId>` shortcuts.
- Persistent QR tokens are opaque and stored hashed, but the resolver returns
  only a target path and does not reapply the menu/admin target policy.
- Signed fallback QR creation accepts admin targets while signed resolution
  accepts only menu targets, producing an unusable QR advertised as successful.
- Existing token hashes change between SHA-256 and HMAC-SHA256 depending on
  whether `VISTAIRE_QR_TOKEN_SECRET` exists. Unplanned secret changes can break
  already printed QR codes.
- The owner dish PATCH requires and rewrites a complete dish. It cannot safely
  serve as a minimal availability toggle.
- Analytics fall back all-at-once to Maison Elyse presentation numbers when
  real datasets are incomplete. Those values must never be shown as the scanned
  restaurant's activity.
- The baseline targeted suite has one pre-existing failure in
  `tests/owner-qr-contract.test.mjs` concerning the removed `target=menu` link
  after restaurant creation. New RED tests must be distinguishable from it.

## Alternatives considered

### 1. Put the raw QR token in the admin URL or cookie

Rejected. It would propagate the long-lived bearer token through browser
history, referrers, logs, screenshots, and client code. Revoking a browser
session separately from the printed QR would also be impossible.

### 2. Store an opaque admin session row in a new database table

Secure and flexible, but unnecessary for the V1 capability set. It adds a new
session lifecycle, cleanup process, and database write for every scan.

### 3. Signed short-lived cookie plus live QR validation

Selected. The cookie contains only the QR id, restaurant id, expiry, and payload
version. Its integrity is protected by a dedicated server secret. Every request
also checks the QR row in Supabase, making pause/archive an immediate revocation
boundary without storing another bearer token.

The versioned authorization boundary is designed so a later PIN step can issue
a new payload version or server-side assurance record without changing the
dashboard, loader, or mutation call sites.

## Security model

### Threat boundary

Possession of an active admin QR is possession of a V1 access credential. The QR
must therefore be labelled `Interne restaurant` and must never be printed on
tables or distributed to guests.

The QR grants only these capabilities:

- read the restaurant dashboard;
- read restaurant menu readiness and available analytics;
- set one dish's `available` state to `true` or `false`.

It does not grant owner navigation, restaurant deletion, dish deletion, media
upload, menu structure editing, settings editing, secrets, AI owner tools, or
any `/api/owner` capability.

### Session cookie

Production cookie attributes:

- name: `vistaire_admin_access`;
- `HttpOnly`;
- `Secure`;
- `SameSite=Lax`;
- `Path=/admin`;
- `Max-Age=28800` seconds;
- no `Domain` attribute.

The signed payload is exactly:

```ts
type AdminAccessPayloadV1 = {
  v: 1;
  qrId: string;
  restaurantId: string;
  exp: number;
};
```

The signature is a separate HMAC-SHA256 segment. The cookie never contains the
raw QR token, a Clerk token, Supabase credentials, or a service-role key.

`VISTAIRE_ADMIN_SESSION_SECRET` is a dedicated server-only secret of at least
32 bytes. Production issuance fails closed when it is absent. It must not fall
back to the Clerk secret or Supabase service-role key. Tests inject an explicit
secret. Cookie security is enabled in production and may be disabled only for
localhost HTTP tests.

The eight-hour expiration applies to the browser session. The physical QR can
create a new session while its database row remains active. Pausing or archiving
the QR disables both new scans and existing cookies.

### Live authorization

All `/admin` reads and mutations use one central authorization service:

```ts
type AdminCapability = "dashboard:read" | "dish:availability:write";

requireAdminRestaurantAccess(
  capability: AdminCapability
): Promise<
  | { ok: true; qrId: string; restaurantId: string; expiresAt: Date }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "revoked" | "unavailable" }
>;
```

It verifies the HMAC and expiry, then reads `qr_codes` by `qrId`. Access is valid
only when the row is `active`, its `restaurant_id` equals the cookie value, and
its target kind is admin. Database errors fail closed. Callers never accept a
restaurant identifier from query parameters, form bodies, or client state.

Future PIN support extends this service with a stronger assurance requirement;
dashboard and API call sites continue to request named capabilities.

### Mutation atomicity

A read-then-update sequence would leave a pause/update race. Availability writes
therefore use a narrow security-definer RPC that, in one database statement,
verifies the active admin QR and updates only `menu_dishes.is_available` for the
same restaurant.

The RPC is executable only by `service_role`, uses a fixed `search_path`, and
returns only dish id, final availability, and update timestamp. If the migration
is absent, the API returns `503`; it never falls back to a non-atomic privileged
update.

The HTTP endpoint also requires exact same-origin requests, rejects
`Sec-Fetch-Site: cross-site`, enforces JSON with a small body limit, accepts only
`{ available: boolean }`, and derives both QR and restaurant scope from the
validated cookie. Setting the intended final state makes retries idempotent.

## QR resolution and compatibility

### New target semantics

- Menu QR target: `/menu/<restaurant-slug>`.
- Restaurant admin QR target: `/admin`.
- Public encoded URL for both: `/q/<opaque-token>`.

`buildOwnerQrTarget({ targetKind: "admin" })` returns `/admin` and uses the copy
`QR dashboard restaurant`, `Interne restaurant`, and `Ne pas imprimer pour les
clients`.

### Route Handler exchange

Next.js cannot set cookies during Server Component rendering. The token exchange
must therefore be a Route Handler at `/q/[token]` rather than the current page.

Flow:

1. Hash the presented token and resolve an active QR record.
2. Reapply the allowed target policy on resolution.
3. For a menu QR, redirect to its sanitized `/menu/...` target unchanged.
4. For an admin QR, require a non-empty restaurant id, issue the eight-hour
   cookie, and redirect to `/admin`.
5. For invalid, paused, archived, malformed, or unavailable records, return or
   redirect to one generic Vistaire QR error state without revealing whether a
   token exists.

The response uses `Cache-Control: no-store` and a no-referrer policy. The raw QR
token is never copied into another query string.

The existing React error presentation moves to a non-tokenized error route so
the `/q/[token]` segment can be owned by the Route Handler.

### Persistent record metadata

A forward migration adds `target_kind` (`menu | admin`) and backfills it from
existing target paths. New writes persist it. Resolution still infers the kind
from the path when the column or new RPC is unavailable, so staged deployment
and legacy rows remain readable.

Legacy `/owner`, `/owner/...`, and `/owner?...` QR targets infer as admin, create
an `/admin` session for their stored restaurant, and no longer redirect into the
Clerk owner application. Existing menu QR behavior remains unchanged.

### Signed fallback

Signed fallback remains a development/build convenience for menu QR only. Admin
QR creation fails with an explicit persistence-required error when Supabase is
unavailable. Signed admin tokens are rejected on resolution.

### Hash compatibility

New hashes use a versioned, rotation-stable SHA-256 representation. Opaque
tokens already have 192 bits of entropy, so a database hash does not need a
rotating pepper to resist practical guessing.

Resolution tries a bounded set of candidates:

1. the new versioned SHA-256 hash;
2. the legacy plain SHA-256 hash;
3. the legacy HMAC hash using the current QR secret;
4. legacy HMAC hashes using explicitly configured previous QR secrets.

This preserves QR codes created before a secret was added and permits planned
rotation. A historical HMAC QR cannot be recovered if its old secret has already
been lost; documentation must state this operational limitation.

## Dashboard data contract

The dashboard restaurant id comes only from `requireAdminRestaurantAccess`.

A server-only loader returns:

```ts
type AdminDashboardData = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    location: string;
    cuisineType: string;
    publicMenuPath: string;
  };
  categories: PublicMenuCategory[];
  dishes: PublicMenuDish[];
  readiness: AdminMenuReadiness;
  analytics: AdminAnalyticsState;
};
```

The menu loader may reuse existing owner parsing, but it must reject demo
fallbacks, restaurant-id mismatches, and Supabase failures. It must never display
Maison Elyse menu content for another restaurant.

`AdminMenuReadiness` is a pure derived model containing total categories and
dishes, available/unavailable counts, missing prices, descriptions and photos,
photo count, 3D/AR count, readiness score, availability distribution, and
prioritized actions. Its score formula and issue priority are deterministic and
unit-tested.

## Analytics honesty

Presentation analytics are never rendered as the scanned restaurant's data.

The UI distinguishes:

- `real`: server-backed metrics with their observation window;
- `insufficient`: a real restaurant exists but the minimum evidence for the
  requested chart is absent;
- `unavailable`: the analytics source could not be read.

If the current `getRestaurantInsights` result is `fallback`, the dashboard
ignores its numeric payload. It shows `Pas encore assez d'activité réelle` or
`Données indisponibles`, not zeros and not demo values.

Only the following claims are allowed:

- menu-open events;
- distinct anonymous sessions when a session id exists;
- category-view events;
- dish-open events and top dishes by those events;
- normalized search events;
- explicit 3D and AR launch events;
- time-bucketed event activity in the restaurant timezone when available.

A funnel is displayed only when events can be grouped by session and ordered in
time. Otherwise the same area becomes an explicit insufficient-data state.
Sales, conversion, revenue, orders, desirability, satisfaction, and purchase
intent are never inferred.

## Premium mobile-first UI

`/admin` retains deep black and espresso surfaces, cream text, restrained
champagne accents, food imagery only where it belongs, and subdued motion. It
must not reuse the heavy two-megabyte demo background or eager-load GLB/USDZ.

The page order is:

1. Restaurant header with name, location/cuisine when present, `Dashboard
   restaurant` badge, analytics provenance, `Ouvrir menu client`, and copy-link.
2. Menu health with a CSS/SVG readiness ring and four actionable KPIs.
3. Honest activity charts: service moments, session funnel when supportable, top
   five dishes, and availability/completeness distribution.
4. Three to five prioritized next actions with anchors into the dish worklist or
   public preview.
5. Premium dish worklist with filters for all, available, unavailable, missing
   price, description, photo, and 3D/AR-ready dishes.
6. Customer preview card linking to the public menu without embedding a model
   viewer or preloading immersive assets.

The dish worklist shows name, section, price, availability, photo/media status,
primary issue, and a labelled availability control. It uses optimistic feedback
with a disabled loading state and restores the previous state on failure before
refreshing server data.

Direct `/admin` access without a valid session renders:

- title: `Accès dashboard restaurant requis`;
- text: `Scannez le QR admin interne de votre restaurant.`;
- no restaurant data and no mutation controls.

The layout keeps `robots: noindex, noarchive`. Controls have visible focus,
44-pixel targets where practical, live status/error announcements, textual chart
summaries, reduced-motion support, and no horizontal overflow at 390 or 430 px.

## Test-first implementation gates

No production implementation starts until the following contracts exist as
failing tests for the missing behavior:

### QR and session

- public menu target remains allowed and redirects unchanged;
- admin target is exactly `/admin` and cannot include a restaurant query;
- external and cross-kind targets are rejected;
- persistent admin resolution returns QR id and restaurant id;
- invalid, paused, and archived QR records cannot issue sessions;
- signed menu fallback remains valid while signed admin fallback is rejected;
- cookie payload signature, exact fields, eight-hour expiry, tamper rejection,
  and expired rejection;
- missing session secret fails closed;
- legacy owner target and legacy hash candidates remain resolvable;
- direct `?restaurantId=` access never grants access;
- an existing cookie is rejected after its QR becomes paused or archived.

### Dashboard

- no session renders the locked state;
- valid session renders only its restaurant;
- a menu fallback or id mismatch never renders demo restaurant data;
- analytics fallback values are not rendered;
- real/insufficient/unavailable provenance is explicit;
- readiness counts and prioritized issues are deterministic;
- noindex metadata remains present.

### Availability

- `true -> false` and `false -> true` succeed;
- no cookie, invalid signature, expired cookie, paused QR, archived QR, wrong
  restaurant, and wrong dish all fail;
- non-boolean or extra input fields fail;
- cross-origin requests fail;
- the database RPC checks QR status and dish scope atomically;
- public menu revalidation reflects the final state;
- retrying the same final state is idempotent.

### Browser QA

- menu QR, admin QR, locked `/admin`, authorized `/admin`, availability filters,
  and toggle are exercised;
- `/owner/qr-codes` clearly separates menu and internal restaurant QR;
- widths 390 and 430 have no horizontal overflow;
- console and network contain no unexpected errors, 404, or 500 responses;
- no GLB/USDZ request occurs on dashboard load;
- no hydration error occurs.

## Worktree decomposition and integration

After the test contracts and implementation plan are approved, three isolated
worktrees branch from the same clean integration branch:

1. `admin-qr-access`: QR policy, token compatibility, resolver metadata, Route
   Handler, session helper, schema/RPC migration, owner QR wording and docs.
2. `admin-dashboard-ui-data`: locked state, safe data loader, readiness model,
   honest analytics presentation, premium responsive dashboard.
3. `admin-dish-availability`: narrow endpoint, atomic RPC integration, worklist
   control and availability tests.

Shared interfaces are defined in the implementation plan before dispatch. The
main integration worktree cherry-picks or merges each focused commit, resolves
overlaps in `components/admin`, and independently reruns all checks. Subagent
reports are evidence inputs, not completion proof.

## Validation and completion boundary

Required fresh validation on the integrated branch:

- targeted Node tests for QR, session, dashboard readiness, analytics state and
  availability;
- `npm run assets:check`;
- `npm run lfs:check`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- relevant Playwright scenarios for `/q`, `/admin`, `/owner/qr-codes`, and the
  public menu;
- browser inspection at 390 and 430 px;
- final Git status and artifact/secret/heavy-file cleanup.

No merge, push, deployment, database migration application, or PR creation is
performed without explicit user authorization. No public media, 3D source,
video, frame, LFS rule, or heavy dependency belongs in this change.
