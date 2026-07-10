# Admin dashboard baseline — 2026-07-10

## Scope and revision

- Integration branch: `codex/admin-restaurant-dashboard-world-class`
- Baseline parent SHA before this repair: `5055448`
- Baseline base (`origin/main`): `1d084957bb4a019422b678bbf9cb2bd9d6eb88a3`
- Runtime behavior remains fail closed when the scoped menu lookup fails.

## Repaired assertion

The former source-offset assertion in `tests/admin-analytics-isolation.test.mjs` was replaced by a behavioral test of the real dashboard orchestration. The test injects a successful restaurant read, a failed menu read, and downstream spies. It asserts the exact result `{ ok: false, reason: "menu-lookup-failed" }` and the exact call sequence `["restaurants", "menus"]`, proving that category, dish, and analytics reads remain untouched.

`loadAdminDashboardData(restaurantId)` retains its production signature and delegates to the exported dependency-injected orchestration helper.

## TDD evidence

RED command:

```powershell
node --test tests/admin-analytics-isolation.test.mjs
```

Expected observed failure: 5 passed, 1 failed with `TypeError: loadAdminDashboardDataWithDependencies is not a function`.

GREEN command:

```powershell
node --test tests/admin-analytics-isolation.test.mjs
```

Observed result: 6 passed, 0 failed.

## Targeted baseline

```powershell
node --test tests/admin-access-session.test.mjs tests/admin-access-security.test.mjs tests/admin-availability.test.mjs tests/admin-dashboard-readiness.test.mjs tests/admin-analytics-isolation.test.mjs tests/admin-analytics-correctness.test.mjs tests/admin-analytics-menu-identity.test.mjs tests/admin-local-preview.test.mjs tests/admin-qr-access-input.test.mjs tests/owner-qr-contract.test.mjs tests/owner-qr-resolution.test.mjs tests/owner-qr-targets.test.mjs
```

Observed result: 90 passed, 0 failed, 0 skipped. Node emitted existing `MODULE_TYPELESS_PACKAGE_JSON` performance warnings for directly imported TypeScript modules; no test failed because of them.
