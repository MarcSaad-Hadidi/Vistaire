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
- Browser QA, build, assets/LFS checks, and isolated Supabase migration execution were not part of this focused integration-fix assignment and remain for the integration/QA gates.
