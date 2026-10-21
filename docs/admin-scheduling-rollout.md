# Admin scheduling deployment and rollback

## Scope and prerequisites

The private planning page reads `/admin/api/scheduling`. Writes require the existing signed admin session and a currently active admin QR for the same restaurant. Read-only local preview cannot write. Scheduling and audit tables are service-role only; never expose service credentials to browsers.

Restaurant time is configured explicitly in the selected menu's `settings_json.timezone` using an IANA name. Do not infer it from a browser or deployment region. Date exceptions override recurring rules; within one layer, unavailable wins. Overnight rules continue into the next local day. A manual availability choice overrides scheduling until an administrator saves a return to automatic planning.

## Normal rollout

1. Run the repository checks and `node scripts/run-admin-scheduling-postgres-tests.mjs` against its disposable local PostgreSQL fixture. Obtain the normal production deployment authorization before applying any production schema change.
2. Apply `supabase/migrations/20261019050749_admin_dish_scheduling.sql` before activating the scheduling application release. It creates scheduling/history storage, transactional RPCs, audit triggers, permissions and revision/request-id protection. It also upgrades the legacy `set_admin_dish_availability` RPC so older application instances and stale PostgREST schema caches preserve manual overrides correctly.
3. Verify migration completion and PostgREST schema visibility, then deploy the application release. The application calls `set_admin_dish_manual_availability` first; a specifically missing function may fall back to the upgraded legacy RPC. Authentication, conflict and database failures are not fallback signals.
4. Saving the first schedule atomically persists `settings_json.availabilityScheduleVersion = 1`. Public loaders use this capability marker to fail closed if scheduling storage subsequently becomes unreadable, including stale schema-cache reads. Keep the marker with the schedules; do not remove it to bypass an availability failure.
5. Use an authorized admin session to confirm GET, save, reload, manual override and return-to-planning behavior on an approved test restaurant. Confirm the selected restaurant timezone and check that anonymous/read-only requests are rejected. Confirm persisted history and public-menu availability, including an overnight interval.
6. Monitor API failures, revision/timezone conflicts and public revalidation retry signals. A committed save remains committed if cache revalidation is pending; do not blindly replay the mutation. Refresh the planner before resolving a conflict.

Before the migration, the planner returns explicit HTTP 503 and shows an unavailable state. It must not invent schedules or history. Legacy availability remains compatible during a rolling deployment; schedules are not activated until their storage and application resolver are both deployed.

## Rollback

An older application release does not evaluate scheduling rules. Rolling back the application while schedules are active can expose stale static availability. Prefer rolling forward with a fix.

If rollback is essential, first use the supported scheduling controls while the current application is still running to remove active rules and deliberately set each affected dish's required static availability using the normal availability controls. Verify the public menu and audit records. Only then roll back the application. Coordinate this operation with restaurant owners; do not silently reinterpret or discard their schedules.

Do not drop scheduling tables, audit history, triggers or the upgraded legacy RPC as rollback cleanup. Keep the additive migration in place. Destructive database rollback requires separate explicit authorization, a tested recovery plan and backups. Preserve audit history even when scheduling is temporarily disabled.

## Hermetic browser verification

Run only against loopback fixture services:

```
VISTAIRE_ADMIN_VISUAL_FIXTURE=1 VISTAIRE_ADMIN_FIXTURE_SCENARIO=full-menu \
  node scripts/run-playwright-e2e.mjs e2e/admin-scheduling.spec.ts \
  --project=chromium --workers=1 --retries=0 --forbid-only
```

The runner configures a deliberately public fixture-only session secret. The tests use the real session signing helper and live fixture QR lookup, not a production auth bypass. The normal local fixture QR `/q/admin-visual-fixture-qr-token-001` is also available for manual browser QA. Never configure the fixture secret or token in production. The fixture binds `127.0.0.1` and stores changes only in memory; restarting it clears scheduling/history test state. The existing `/admin/preview` flow remains read-only.

The shared visual fixture also serves the existing Sauge Noire renderer at `/menu/sauge-noire` using separate restaurant/menu identities. Fixture food images are labeled test artwork, not proof of production photo correctness.
