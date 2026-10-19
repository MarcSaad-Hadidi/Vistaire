# Dashboard migration reconciliation

The retention policy preserves all existing and future analytics history. No
automatic expiry or purge is installed. Keep event identity, environment,
sequence, privacy stripping and session rate limits.

## Recorded migration identities

Repository filenames match the migration API recorded versions:

| SQL file | SHA-256 |
| --- | --- |
| `20261019050749_admin_dish_scheduling.sql` | `5840827bc9f322d092103c3d74f711816f87bb4dd4e61f048f881dc8fd6ac50b` |
| `20261019050917_menu_telemetry_v2_preserve_history.sql` | `9a3198c569e6fbd8e9001fa40898c1cf72fb61a52bba2c000619f57e24a8bfd0` |

The scheduling SQL is unchanged. Telemetry omits the unexecuted expiry,
backfill, purge function and cron registration. The deletion-enabled version
was never applied. No migration history was manually marked or fabricated.

Merge this reconciliation before a future database push. Do not execute the
obsolete `20261018212202` or `20261018213000` files from an older checkout.
Review any older repository/live migration naming differences separately;
never reconcile them through an unreviewed blanket database push.

## Verification and recovery

Compare row identities, timestamps and historical counts before and after
application. Verify new schema constraints and guards, and the absence of an
expiry column, purge function or deletion job. Do not insert synthetic analytics
into production to test collection.

Scheduling evaluates each public menu request without an administrator visit
or background cron. Already-open pages need refresh at a new time interval.
Keep additive tables and history during application rollback; do not assume
backup or PITR availability without verifying it separately.

The rollback-only PostgreSQL fixture executes the complete migration body and
asserts that old and new events survive. Local source tests cover the same
preservation contract; the PostgreSQL fixture is required in CI.
