# Task 9 Integration Report

## Outcome

- Wired `/admin` to the exported `parseAdminDashboardRange` allowlist and the typed two-argument dashboard loader.
- Preserved restaurant isolation: URL state contributes only `range`; `restaurantId` comes only from the authorized access grant.
- Removed the temporary legacy dashboard adapter. The UI now consumes `restaurant.publicMenuPath`, `menu.categories`, `menu.dishes`, `menu.readiness`, and the `real | insufficient | unavailable` analytics union directly.
- Kept the dedicated private admin shell and restored the non-production-only local read-only preview form.
- Replaced stale source assertions with narrower guards for the allowed query field, forbidden restaurant URL scope, direct nested contract use, and absence of loader casts/legacy analytics cases.

## Validation

- `node --test tests/admin-*.test.mjs tests/owner-qr-contract.test.mjs tests/owner-qr-resolution.test.mjs tests/owner-qr-targets.test.mjs` — 131/131 passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed with zero warnings.

## Notes and residual proof limits

- Node emits the repository's existing `MODULE_TYPELESS_PACKAGE_JSON` warnings for directly imported TypeScript test modules; tests still pass.
- Browser QA and isolated Supabase migration execution remain separate integration/QA proofs.

## Review follow-up

- Removed the parallel `TargetAnalyticsState` contract and all optional-field adapters. `adminDashboardViewModel` and `AdminAnalyticsPanel` now consume `AdminAnalyticsState` directly and export strict `Extract` aliases for its three variants.
- Real analytics presentation reads canonical metric values and activity `bucket`/`count` fields directly. It no longer converts absent values to zero or invents provenance from optional UI fields.
- Typed insufficient evidence as `{ label, value }`, removing the UI runtime cast and generic evidence fallback.
- Added `parseAdminPageSearchParams`, whose input type is structurally restricted to `Pick<..., "range">`; the page hands it the awaited Next.js search params and still loads only `access.restaurantId`.
- TDD evidence: the focused tests first failed for the missing structural parser, the parallel analytics union, and non-canonical date rendering; after implementation they passed 11/11.

### Full Task 9 gates after review

- Admin and owner QR Node suite: 133/133 passed.
- `npm run assets:check`: passed; 1,231 files scanned, 57 grandfathered risky assets.
- `npm run lfs:check`: passed; zero active LFS pointers and zero LFS rules.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run build`: passed; Next.js production build compiled, typechecked, and generated 62 static pages.
- Browser/DevTools QA and isolated Supabase migration execution remain separate QA/environment proofs.
