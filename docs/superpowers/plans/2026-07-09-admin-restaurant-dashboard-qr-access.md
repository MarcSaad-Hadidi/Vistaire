# Vistaire Admin Restaurant Dashboard and QR Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public demo `/admin` with a restaurant-scoped premium cockpit entered through an opaque admin QR, backed by an eight-hour signed session with live revocation and a single narrow availability mutation.

**Architecture:** `/q/[token]` becomes a Route Handler that either preserves the public menu redirect or exchanges an active persistent admin QR for a path-scoped signed cookie. A central server authorization helper verifies the cookie and live QR row for every read; availability writes additionally use an atomic service-role RPC. `/admin` derives all restaurant data from that authorization result and suppresses presentation analytics whenever real evidence is insufficient.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind/CSS Modules, Supabase service-role server client, Node `crypto`, Node test runner, Playwright.

## Global Constraints

- `/owner` remains the Clerk-protected Vistaire internal tool.
- The V1 access proof is the admin QR only; there is no PIN.
- Admin sessions last exactly 28,800 seconds and are live-revoked by QR status.
- The cookie is HttpOnly, Secure in production, SameSite=Lax, Path=/admin, and contains only version, QR id, restaurant id, and expiry.
- `/admin` never trusts a restaurant query parameter or request-body restaurant id.
- Signed fallback QR tokens remain menu-only; persistent storage is mandatory for admin QR.
- `/admin` can read dashboard data and set dish availability only.
- No destructive actions, uploads, settings mutation, owner API access, chart dependency, public heavy asset, GLB/USDZ preload, or wildcard LFS rule.
- Presentation analytics are never shown as restaurant analytics.
- Mobile QA must cover 390 px and 430 px without horizontal overflow.

---

### Task 1: Lock the RED Contracts and Repair the Stale Baseline Assertion

**Files:**
- Modify: `tests/owner-qr-contract.test.mjs`
- Modify: `tests/owner-qr-targets.test.mjs`
- Create: `tests/admin-access-session.test.mjs`
- Create: `tests/admin-dashboard-readiness.test.mjs`
- Create: `tests/admin-availability.test.mjs`
- Create: `e2e/admin-restaurant-dashboard.spec.ts`

**Interfaces:**
- Consumes: the approved design specification.
- Produces: executable behavior contracts for all three implementation worktrees.

- [ ] **Step 1: Correct the unrelated stale baseline assertion**

Replace the obsolete `RestaurantCreateForm` source assertion for `target=menu` with the current persisted QR route contract:

```js
assert.match(createForm, /qrCodesHref/);
assert.match(createForm, /Generer le QR menu/);
assert.match(createForm, /state\.qrCodesHref/);
```

- [ ] **Step 2: Run the existing targeted suite and establish a clean baseline**

Run:

```powershell
node --test tests/owner-qr-targets.test.mjs tests/owner-qr-contract.test.mjs tests/menu-qr-code.test.mjs tests/admin-recommendations.test.mjs tests/owner-menu-builder.test.mjs tests/owner-auth-policy.test.mjs tests/public-menu-core.test.mjs
```

Expected: 52 tests pass, 0 fail. Module-type warnings may remain but no assertion may fail.

- [ ] **Step 3: Add QR/session RED tests**

The tests import pure helpers using the wished-for interfaces:

```js
import {
  ADMIN_ACCESS_TTL_SECONDS,
  createAdminAccessToken,
  verifyAdminAccessToken
} from "../lib/admin/accessSessionCore.ts";

const now = 1_783_631_200;
const secret = "test-secret-with-at-least-thirty-two-bytes";
const token = createAdminAccessToken({ qrId: "qr-1", restaurantId: "rest-1", now }, secret);
assert.equal(ADMIN_ACCESS_TTL_SECONDS, 28_800);
assert.deepEqual(verifyAdminAccessToken(token, secret, now + 60), {
  v: 1,
  qrId: "qr-1",
  restaurantId: "rest-1",
  exp: now + 28_800
});
assert.equal(verifyAdminAccessToken(`${token}x`, secret, now + 60), null);
assert.equal(verifyAdminAccessToken(token, secret, now + 28_801), null);
```

Add source/behavior assertions proving `/admin` is the only new admin target, menu fallback remains valid, admin fallback is refused, the cookie has the required attributes, and query-only access is absent.

- [ ] **Step 4: Add readiness RED tests**

Use representative `PublicMenuDish` fixtures and assert the wished-for API:

```js
const summary = buildAdminMenuReadiness(categories, dishes);
assert.deepEqual(summary.counts, {
  categories: 2,
  dishes: 4,
  available: 3,
  unavailable: 1,
  missingPrice: 1,
  missingDescription: 1,
  missingPhoto: 2,
  withPhoto: 2,
  withImmersive: 1
});
assert.equal(summary.actions[0].kind, "missing-price");
assert.ok(summary.score >= 0 && summary.score <= 100);
```

- [ ] **Step 5: Add availability RED tests**

Test strict payload parsing and source contracts for the route/RPC:

```js
assert.deepEqual(parseAvailabilityInput({ available: false }), {
  ok: true,
  available: false
});
assert.equal(parseAvailabilityInput({ available: "false" }).ok, false);
assert.equal(parseAvailabilityInput({ available: true, restaurantId: "rest-2" }).ok, false);
```

Assert that `supabase/migrations/20260709181000_admin_dish_availability.sql`
checks `qr_codes.id`, `restaurant_id`, `status = 'active'`, and
`target_kind = 'admin'` in the same SQL statement that updates only
`menu_dishes.is_available`.

- [ ] **Step 6: Add the browser RED scenario**

Create Playwright coverage for locked `/admin`, QR wording, 390/430 widths, dish filters, toggle UI, no unexpected 404/500, and no `.glb`/`.usdz` request. Use route stubs for deterministic UI behavior; reserve a separate request-level test for the real Route Handler where environment credentials exist.

- [ ] **Step 7: Run the new tests and verify RED for missing behavior**

Run:

```powershell
node --test tests/admin-access-session.test.mjs tests/admin-dashboard-readiness.test.mjs tests/admin-availability.test.mjs tests/owner-qr-targets.test.mjs tests/owner-qr-contract.test.mjs
```

Expected: failures identify missing `accessSessionCore`, readiness, admin target, and availability implementation—not syntax or fixture errors.

- [ ] **Step 8: Commit the locked contracts**

```powershell
git add tests/owner-qr-contract.test.mjs tests/owner-qr-targets.test.mjs tests/admin-access-session.test.mjs tests/admin-dashboard-readiness.test.mjs tests/admin-availability.test.mjs e2e/admin-restaurant-dashboard.spec.ts
git commit -m "test: lock restaurant admin dashboard contracts"
```

### Task 2: Worktree 1 — Persistent Admin QR Exchange and Live Session Authorization

**Files:**
- Delete: `app/q/[token]/page.tsx`
- Create: `app/q/[token]/route.ts`
- Create: `app/q/invalid/page.tsx`
- Create: `lib/admin/accessSessionCore.ts`
- Create: `lib/admin/access.ts`
- Modify: `lib/owner/qrStore.ts`
- Modify: `lib/owner/qrTokens.ts`
- Modify: `lib/owner/menuUrlCore.ts`
- Modify: `lib/owner/types.ts`
- Modify: `app/api/owner/qr-codes/route.ts`
- Modify: `app/owner/qr-codes/page.tsx`
- Modify: `components/owner/OwnerQrManager.tsx`
- Modify: `components/owner/OwnerQrCustomizer.tsx`
- Modify: `docs/owner-qr-schema.md`
- Create: `supabase/migrations/20260709180000_admin_qr_access.sql`
- Test: `tests/admin-access-session.test.mjs`
- Test: `tests/owner-qr-targets.test.mjs`
- Test: `tests/owner-qr-contract.test.mjs`

**Interfaces:**
- Consumes: RED session and QR tests from Task 1.
- Produces: `createAdminAccessToken`, `verifyAdminAccessToken`, `requireAdminRestaurantAccess`, `resolveQrToken` metadata, and the admin cookie contract used by Tasks 3 and 4.

- [ ] **Step 1: Implement the minimal pure session token core**

Implement a base64url payload plus HMAC signature with constant-time comparison:

```ts
export const ADMIN_ACCESS_TTL_SECONDS = 8 * 60 * 60;

export type AdminAccessPayloadV1 = {
  v: 1;
  qrId: string;
  restaurantId: string;
  exp: number;
};

export function createAdminAccessToken(
  input: { qrId: string; restaurantId: string; now?: number },
  secret: string
): string;

export function verifyAdminAccessToken(
  token: string,
  secret: string,
  now?: number
): AdminAccessPayloadV1 | null;
```

Reject short secrets, malformed payloads, extra payload keys, unsupported versions, empty ids, expired values, and invalid signatures.

- [ ] **Step 2: Run the session test GREEN**

Run: `node --test tests/admin-access-session.test.mjs`

Expected: token-core assertions pass; route/source assertions may remain RED.

- [ ] **Step 3: Make QR target policy explicit and compatible**

Change new admin targets to `/admin`, allow only exact `/admin` for new admin persistence, and retain a separate legacy inference path for existing `/owner...` rows. New menu target behavior remains unchanged.

Implement versioned hash candidates:

```ts
export function hashQrTokenForStorage(token: string): string;
export function qrTokenHashCandidates(
  token: string,
  env?: NodeJS.ProcessEnv
): string[];
```

The candidate list is bounded and deduplicated: new versioned SHA-256, legacy SHA-256, current legacy HMAC, then configured previous legacy HMAC secrets.

- [ ] **Step 4: Return persistent QR metadata and reapply policy**

Evolve resolution to:

```ts
type QrResolution =
  | { ok: true; qrId: string; restaurantId: string; targetKind: "menu" | "admin"; targetPath: string }
  | { ok: false };
```

Use the new metadata RPC when available, fall back to the legacy scan RPC plus a live row read, and fail closed on path/kind mismatch. Unknown statuses normalize to inactive, not active.

- [ ] **Step 5: Add QR schema compatibility and metadata resolution**

The migration adds and backfills `qr_codes.target_kind`, defines a
metadata-returning scan RPC, and preserves the legacy RPC. Revoke the new
function from `public`, `anon`, and `authenticated`; grant only to
`service_role`.

- [ ] **Step 6: Implement the Route Handler exchange**

For menu resolution, return `NextResponse.redirect(menuTarget)`. For admin resolution, sign the minimal payload, set:

```ts
response.cookies.set("vistaire_admin_access", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/admin",
  maxAge: ADMIN_ACCESS_TTL_SECONDS
});
```

Set `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Invalid resolution redirects to `/q/invalid`. The error page retains the existing warm Vistaire presentation without including the token.

- [ ] **Step 7: Implement live authorization**

`requireAdminRestaurantAccess` reads the cookie, verifies it with `VISTAIRE_ADMIN_SESSION_SECRET`, and queries the QR row. It returns success only for the matching active admin QR. It accepts a dependency-injected QR reader in pure tests and fails closed on database/configuration errors.

- [ ] **Step 8: Refuse signed admin fallback and update owner wording**

Admin creation without persistent Supabase returns an error. Update labels to `QR dashboard restaurant`, `Interne restaurant`, and `Ne pas imprimer pour les clients`. The encoded URL remains `/q/<token>`.

- [ ] **Step 9: Run focused GREEN tests and commit**

Run:

```powershell
node --test tests/admin-access-session.test.mjs tests/owner-qr-targets.test.mjs tests/owner-qr-contract.test.mjs tests/menu-qr-code.test.mjs
npm run typecheck
```

Expected: all focused tests and typecheck pass.

Commit:

```powershell
git add app/q lib/admin/accessSessionCore.ts lib/admin/access.ts lib/owner/qrStore.ts lib/owner/qrTokens.ts lib/owner/menuUrlCore.ts lib/owner/types.ts app/api/owner/qr-codes app/owner/qr-codes components/owner/OwnerQrManager.tsx components/owner/OwnerQrCustomizer.tsx docs/owner-qr-schema.md supabase/migrations/20260709180000_admin_qr_access.sql tests
git commit -m "feat: add restaurant admin QR access"
```

### Task 3: Worktree 2 — Safe Restaurant Data and Premium Admin Cockpit

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/layout.tsx`
- Create: `lib/admin/dashboardData.ts`
- Create: `lib/admin/menuReadiness.ts`
- Create: `lib/admin/analyticsState.ts`
- Create: `components/admin/AdminRestaurantDashboard.tsx`
- Create: `components/admin/AdminDishWorklist.tsx`
- Create: `components/admin/AdminDashboard.module.css`
- Modify: `components/admin/AdminServiceActivity.tsx`
- Modify: `components/admin/AdminTopDishes.tsx`
- Modify: `components/admin/AdminSearchInsights.tsx`
- Modify: `components/admin/AdminEngagementFunnel.tsx`
- Test: `tests/admin-dashboard-readiness.test.mjs`
- Test: `e2e/admin-restaurant-dashboard.spec.ts`

**Interfaces:**
- Consumes: `requireAdminRestaurantAccess` and the approved `PublicMenuDish` shape.
- Produces: `buildAdminMenuReadiness`, `loadAdminDashboardData`, premium dashboard components, and a static dish worklist seam for Task 4.

- [ ] **Step 1: Implement and test deterministic readiness**

Implement:

```ts
export type AdminMenuReadiness = {
  score: number;
  counts: {
    categories: number;
    dishes: number;
    available: number;
    unavailable: number;
    missingPrice: number;
    missingDescription: number;
    missingPhoto: number;
    withPhoto: number;
    withImmersive: number;
  };
  actions: Array<{
    kind: "missing-price" | "missing-description" | "missing-photo" | "unavailable" | "preview";
    count: number;
    label: string;
    filter: string;
  }>;
};
```

Use a documented weighted completeness score based only on dish fields. Empty menus score 0 and receive an explicit add/configure action, not a divide-by-zero result.

Run: `node --test tests/admin-dashboard-readiness.test.mjs`

Expected: all readiness assertions pass.

- [ ] **Step 2: Build a fail-closed dashboard loader**

The loader receives only the authorized restaurant id. Reuse existing menu parsing, but return an unavailable state if the result is fallback, mismatched, or failed. It obtains insights for the same id and maps fallback numeric payloads to `insufficient` or `unavailable` without exposing them.

- [ ] **Step 3: Replace the demo page with locked and authorized branches**

`app/admin/page.tsx` calls `requireAdminRestaurantAccess("dashboard:read")`. Failure renders the exact locked copy. Success loads only `access.restaurantId`. Remove `searchParams`, demo-id imports, preview navigation, demo background and lobster assets.

- [ ] **Step 4: Implement the premium cockpit and charts**

Use semantic sections, CSS/SVG only, text summaries, and no chart dependency. Render real analytics only when `analytics.kind === "real"`; otherwise render a labelled evidence state. Never render the numeric fallback object.

- [ ] **Step 5: Implement the filterable static dish worklist**

The client worklist supports these filter ids:

```ts
type AdminDishFilter =
  | "all"
  | "available"
  | "unavailable"
  | "missing-price"
  | "missing-description"
  | "missing-photo"
  | "immersive";
```

It displays the final-state badge and a stable action container with
`data-admin-availability-slot={dish.id}`. Task 4 replaces the slot content with
the interactive control without changing row layout.

- [ ] **Step 6: Keep noindex metadata and accessible responsive behavior**

Update title/description from demo language to restaurant dashboard language,
retain `index:false` and `noarchive:true`, add focus-visible styles,
`aria-live` status regions, accessible chart labels, reduced-motion handling,
and one-column mobile layouts.

- [ ] **Step 7: Run focused tests, lint/typecheck, and commit**

Run:

```powershell
node --test tests/admin-dashboard-readiness.test.mjs tests/admin-recommendations.test.mjs
npm run lint
npm run typecheck
```

Expected: all commands exit 0.

Commit:

```powershell
git add app/admin components/admin lib/admin tests/admin-dashboard-readiness.test.mjs e2e/admin-restaurant-dashboard.spec.ts
git commit -m "feat: build restaurant admin cockpit"
```

### Task 4: Worktree 3 — Narrow Availability API and Resilient UI Control

**Files:**
- Create: `lib/admin/availability.ts`
- Create: `app/admin/api/dishes/[dishId]/availability/route.ts`
- Create: `components/admin/AdminDishAvailabilityControl.tsx`
- Create: `supabase/migrations/20260709181000_admin_dish_availability.sql`
- Modify: `components/admin/AdminDishWorklist.tsx`
- Modify: `lib/owner/menuMutationRevalidation.ts`
- Test: `tests/admin-availability.test.mjs`
- Test: `e2e/admin-restaurant-dashboard.spec.ts`

**Interfaces:**
- Consumes: `requireAdminRestaurantAccess("dish:availability:write")`, `set_admin_dish_availability`, and the worklist slot from Task 3.
- Produces: strict parser, availability endpoint, optimistic control, and public-menu revalidation.

- [ ] **Step 1: Implement the strict pure parser**

```ts
export function parseAvailabilityInput(input: unknown):
  | { ok: true; available: boolean }
  | { ok: false; error: string };
```

Require a plain object with exactly one own key named `available` and a boolean value.

- [ ] **Step 2: Run parser tests GREEN**

Run: `node --test tests/admin-availability.test.mjs`

Expected: parser assertions pass while route/source assertions may remain RED.

- [ ] **Step 3: Implement the same-origin, path-scoped endpoint**

The route rejects missing/wrong JSON content type, bodies over 1 KiB,
cross-site fetch metadata, and an absent or non-matching Origin. It validates
the admin session, ignores all client restaurant identifiers, calls the atomic
RPC with the session QR/restaurant ids and path dish id, and maps no returned row
to 404/403 without revealing another restaurant's data.

Create `supabase/migrations/20260709181000_admin_dish_availability.sql` with:

```sql
public.set_admin_dish_availability(
  p_qr_id uuid,
  p_restaurant_id uuid,
  p_dish_id uuid,
  p_available boolean
)
```

The security-definer function uses a fixed `search_path`, verifies the active
admin QR and scoped dish in the same statement, is revoked from `public`,
`anon`, and `authenticated`, and is granted only to `service_role`.

- [ ] **Step 4: Revalidate the dashboard and public menu**

Extend the existing revalidation helper to revalidate `/admin` plus the scoped
public menu and dish routes after a successful update. No owner destructive or
media route is called.

- [ ] **Step 5: Add the resilient availability control**

The control sends the intended final boolean, disables itself while pending,
announces success/failure, rolls back optimistic state on error, and calls
`router.refresh()` after success. Button labels are explicit:

```tsx
aria-label={available
  ? `Rendre ${dishName} indisponible`
  : `Rendre ${dishName} disponible`}
```

- [ ] **Step 6: Run availability and public-menu regression tests GREEN**

Run:

```powershell
node --test tests/admin-availability.test.mjs tests/public-menu-core.test.mjs tests/owner-menu-builder.test.mjs
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```powershell
git add lib/admin/availability.ts app/admin/api components/admin/AdminDishAvailabilityControl.tsx components/admin/AdminDishWorklist.tsx lib/owner/menuMutationRevalidation.ts supabase/migrations/20260709181000_admin_dish_availability.sql tests/admin-availability.test.mjs e2e/admin-restaurant-dashboard.spec.ts
git commit -m "feat: add scoped dish availability control"
```

### Task 5: Main Integration, Review Gates, and Full Verification

**Files:**
- Modify only conflict-resolution or test files required to integrate Tasks 2–4.
- Review: all files changed from `origin/main`.

**Interfaces:**
- Consumes: focused commits from all three worktrees.
- Produces: one integrated branch ready for user review, not merged or pushed.

- [ ] **Step 1: Integrate worktree commits in dependency order**

Cherry-pick or merge QR access first, dashboard UI/data second, and availability third. Resolve overlaps narrowly in `components/admin/AdminDishWorklist.tsx` and the E2E spec. Do not copy worktree directories or generated artifacts.

- [ ] **Step 2: Run focused test suites**

```powershell
node --test tests/admin-access-session.test.mjs tests/admin-dashboard-readiness.test.mjs tests/admin-availability.test.mjs tests/owner-qr-targets.test.mjs tests/owner-qr-contract.test.mjs tests/menu-qr-code.test.mjs tests/admin-recommendations.test.mjs tests/public-menu-core.test.mjs tests/owner-menu-builder.test.mjs tests/owner-auth-policy.test.mjs
```

Expected: 0 failures.

- [ ] **Step 3: Run repository quality gates**

```powershell
npm run assets:check
npm run lfs:check
npm run lint
npm run typecheck
npm run build
```

Expected: every command exits 0. If a command is blocked by environment or missing production credentials, record the exact blocker and do not claim it passed.

- [ ] **Step 4: Run Playwright and browser QA**

Run the new admin spec and the existing owner QR/public menu scenarios. Inspect 390 and 430 px, console, responses, hydration, horizontal overflow, and asset requests. Confirm no GLB/USDZ is fetched before user intent.

- [ ] **Step 5: Run security and scope review**

Verify:

- no query/body restaurant selection;
- cookie fields and flags are exact;
- every read validates current QR status;
- availability status check and update are atomic;
- no owner/destructive/upload endpoint is reachable from `/admin`;
- fallback analytics values cannot render;
- legacy menu QR still resolves;
- no secret, `.env`, heavy asset, wildcard LFS rule, debug log, or `debugger` was added.

Correct every P0/P1 finding before continuing.

- [ ] **Step 6: Clean generated artifacts**

Remove task-generated `.next`, `test-results`, `playwright-report`, screenshots,
videos, traces, and temporary debug files that are not intentional tracked
evidence. Use native PowerShell paths within the integration worktree only.

- [ ] **Step 7: Fresh final verification and status**

Rerun the complete focused suite and any command affected by review fixes, then:

```powershell
git diff --check
git status --short --branch
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors, no unintended artifacts, and only in-scope files.

- [ ] **Step 8: Report without merging**

Report branch, root causes, final access flow, file rationale, validation output,
browser QA, skipped checks, residual risk, asset/LFS confirmation, and preservation
of `/owner`, `/menu`, `/q` menu behavior. Do not merge, push, deploy, apply the
database migration, or create a PR without explicit user authorization.
