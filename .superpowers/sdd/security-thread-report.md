# Security thread report — Tasks 2 and 7

Status: `DONE_WITH_CONCERNS`

## Scope

- Task 2: explicit admin access grants and read-only local preview.
- Task 7: atomic service-role availability RPC, route integration, validated mutation core, and optimistic availability control.
- No general dashboard data or dashboard UI files were modified.

## TDD evidence

### Task 2

- RED command: `node --test tests/admin-access-session.test.mjs tests/admin-local-preview.test.mjs`
- RED result: 19 tests, 16 passed, 3 failed for the expected missing `sessionKind`, `assurance`, `capabilities`, and preview `qrId: null` grant shape.
- GREEN command: `node --test tests/admin-access-session.test.mjs tests/admin-access-security.test.mjs tests/admin-local-preview.test.mjs`
- GREEN result: 25/25 passed.
- Commit: `34aa286 fix: enforce admin session capabilities`

### Task 7

- RED command: `node --test tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs`
- RED result: 8 tests, 5 passed, 3 failed for the expected absent generated migration, absent QR id in the mutation input, and absent RPC call.
- Additional control RED command: `node --test tests/admin-availability.test.mjs`
- Additional control RED result: 7 tests, 6 passed, 1 failed for the expected absent optimistic/stale-response/rollback contract.
- Migration generated before editing with: `npx supabase migration new admin_dish_availability_rpc`
- Exact generated path: `supabase/migrations/20260710194202_admin_dish_availability_rpc.sql`
- GREEN command: `node --test tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs tests/admin-access-session.test.mjs`
- GREEN result: 22/22 passed.

## Files

- `lib/admin/accessCore.ts`
- `lib/admin/localPreviewCore.ts`
- `tests/admin-access-session.test.mjs`
- `tests/admin-local-preview.test.mjs`
- `lib/admin/availability.ts`
- `app/admin/api/dishes/[dishId]/availability/route.ts`
- `components/admin/AdminDishAvailabilityControl.tsx`
- `supabase/migrations/20260710194202_admin_dish_availability_rpc.sql`
- `tests/admin-availability.test.mjs`
- `tests/admin-availability-rpc.test.mjs`
- `.superpowers/sdd/security-thread-report.md`

## Validation

- `npm ci`: passed; 608 packages installed, 0 audit vulnerabilities. npm reported three unapproved dependency install scripts and two upstream deprecation warnings.
- Targeted Node tests: passed, 22/22. Node emitted the repository's existing typeless-package reparsing warning.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run assets:check`: passed.
- `npm run lfs:check`: passed.
- `npm run build`: passed after the worktree-local `npm ci` made Next resolvable from the worktree.
- `git diff --check`: passed.

## Security/self-review

- Signed QR session payload remains unchanged.
- Preview grants only `dashboard:read`, identify as signed loopback preview, and expose no QR id.
- Live QR grants expose both V1 capabilities only after live QR validation.
- Mutation accepts a strict single-field JSON body capped at 1,024 bytes, requires same-origin/Sec-Fetch-Site validation, validates a UUID dish id, derives QR and restaurant identity only from access, and always returns `no-store` JSON.
- Route calls only `set_admin_dish_availability`; there is no direct privileged update fallback. RPC errors, including a missing function/schema, map to controlled 503.
- RPC has four typed parameters, locks and revalidates the active `/admin` QR, derives the deterministic published-primary/published/draft-primary menu, scopes the dish to restaurant and menu, changes only `is_available` and `updated_at`, preserves `updated_at` on idempotent same-state calls, uses `security definer` with empty search path, and grants execute only to `service_role`.
- Client control optimistically updates, disables duplicate clicks, rolls back failures, ignores stale responses, announces success/error, preserves focus, refreshes server truth, and retains a 44px target.

## Concerns and unverified items

- The isolated Supabase RPC matrix was not run. `npx supabase status` failed because the local Docker engine pipe was unavailable. Therefore active/inactive/archived/menu/cross-restaurant/wrong-dish/idempotent/browser-role/service-role/concurrent-revocation behavior is source-contract tested but not executed against Postgres.
- The migration was not applied anywhere, especially not production, as required.
- Supabase documentation URLs could not be fetched by the available web tool (internal 400/safe-open errors); implementation was checked against the installed Supabase skill security guidance and repository schema/migrations.
- Browser/DevTools QA was not run because this task owns security/availability logic and no stable test database was available for a real mutation. UI behavior is source-contract tested, typechecked, linted, and built, but not interactively verified.

## Review corrections — legacy capability, post-commit revalidation, media type

- Review status addressed: three Important findings corrected in strict TDD.
- RED command: `node --test tests/admin-access-session.test.mjs tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs`
- RED result: 24 tests, 20 passed, 4 failed for the expected legacy write over-grant, JSON lookalike acceptance, missing post-commit isolation helper, and missing route integration.
- Strengthened post-commit RED command: `node --test tests/admin-availability.test.mjs`; 9 tests, 7 passed, 2 failed because the result-preserving helper and route integration were absent. The final test asserts reference-equal committed success is returned after a thrown revalidation.
- GREEN command: `node --test tests/admin-access-session.test.mjs tests/admin-access-security.test.mjs tests/admin-local-preview.test.mjs tests/admin-availability.test.mjs tests/admin-availability-rpc.test.mjs`
- GREEN result: 35/35 passed.
- `npm run typecheck --if-present`: passed.
- Targeted ESLint on the six changed implementation/test files: passed with zero warnings.
- Legacy active admin QR targets under `/owner` keep `dashboard:read` compatibility but receive only that capability; `dish:availability:write` now requires canonical `/admin`. The RPC source-contract test proves the same canonical path requirement and rejects an `/owner` pattern.
- Post-RPC revalidation now runs through a fail-contained helper. A cache/path revalidation exception logs only `Admin availability revalidation failed after commit.` server-side and preserves the successful RPC result, so the client receives success/no-store and refreshes from server truth.
- Content type parsing now compares the normalized media type before the first `;`: `application/json` with parameters is accepted, while `application/jsonp`, `application/json-evil`, and `text/application/json` are rejected with 415.
- Residual limits remain unchanged: no migration application and no isolated Postgres matrix because Docker is unavailable.
