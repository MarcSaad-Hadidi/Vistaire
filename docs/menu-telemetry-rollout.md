# Menu telemetry v2 rollout

## Deployment order

1. Review and approve the database migration separately. The authorized 2026-10-19 production application is recorded in [the deployment ledger](dashboard-migration-deployment-2026-10-19.md).
2. Apply `20261019050917_menu_telemetry_v2_preserve_history.sql` before deploying the v2 client/API. It adds event identity, sequence, schema version, environment, expanded event names and rate limiting. No `pg_cron` extension is required.
3. Preserve all history: this migration adds no expiry column, backfill, purge function or scheduled deletion. Existing timestamps and event rows remain intact, including records older than 90 days. Existing events are labelled `environment=legacy`, not retroactively claimed as verified production observations. Any future retention/deletion policy requires separate explicit approval.
4. Verify PostgREST's schema cache exposes the new columns and compare existing row counts and timestamps before/after application. Verify no telemetry purge function or retention job exists; if a previous expiry-enabled version was already applied, stop and review that deployed state separately rather than treating this pending migration as a corrective migration.
5. Deploy the client/API together. Vercel deployment environment is server-assigned; self-hosted production must set `ANALYTICS_ENVIRONMENT=production`. Unknown environments are classified as development. Preview observations never become production observations.
6. Verify a controlled event returns `persisted:true`, retrying its event ID does not add a row, and preview/demo observations are excluded from production reporting. Do not infer successful collection from an HTTP202 response: it explicitly means `persisted:false`.

## Rolling compatibility

Legacy schema-v1 baseline requests have a narrow one-time old-schema retry only after an explicit PostgreSQL42703/PostgRESTPGRST204 missing-new-column error. Production-source events also require a server-verified production environment; demo-source data remains demo. Unknown errors, permissions failures, missing unrelated columns, rate failures and duplicates do not enable this retry.

The retry omits only unavailable v2 columns. It still excludes raw search text, user agents, precise viewport measurements and arbitrary metadata. Legacy elapsed session durations retain their original interpretation.

No v2 request is downgraded, including baseline count events. Before the migration and schema cache are ready, the new client receives `persisted:false`; measurements are not buffered/replayed. This avoids silently losing deduplication, environment separation, sequence or active-duration semantics. Deploy the schema first to avoid a collection gap.

For a rollback, an older application can continue writing its original columns against the expanded database schema. Do not drop new columns or delete telemetry merely to roll back application code. Coordinate any database rollback separately.

## Repeatable database contracts

In a dedicated empty, local PostgreSQL17 database named for tests:

    CI=true PGHOST=localhost PGDATABASE=vistaire_telemetry_test node scripts/run-menu-telemetry-postgres-tests.mjs

Outside CI, replace `CI=true` with `VISTAIRE_MENU_TELEMETRY_POSTGRES_TEST=1`. The runner rejects remote hosts, connection-string database names, service overrides, existing public tables and other PostgreSQL versions.

The runner executes the complete exact migration body inside the rollback-only fixture `supabase/tests/menu_telemetry_v2.sql`, removing only the migration's outer `BEGIN`/`COMMIT` wrappers. It verifies identity/sequence constraints, deduplication, privacy stripping, environment and rate bounds. Pre-migration 100-day-old and 10-day-old rows must survive with unchanged timestamps and legacy environment; new events must also remain. It asserts that no expiry column or purge function exists. The test requires no cron extension and makes no scheduling calls.

## Public QR attribution limits

For an active persisted public-menu QR, `/q/[token]` appends only the public QR row UUID (`qrId`) and `source=qr` to the canonical menu redirect. Existing canonical query parameters are preserved. The credential/token itself is never copied into analytics. The admin QR branch and its access cookie are unchanged; admin QR IDs are never emitted by this path. Signed fallback/demo QR links without a persisted UUID receive no invented QR identity.

Ingestion accepts a QR UUID only after checking an active `target_kind=menu` row under the same restaurant, its canonical `/menu/{restaurantSlug}` target, and the event's existing restaurant/menu relationship. Invalid, cross-restaurant or admin references fail with the same generic context error. Demo events cannot retain a claimed QR UUID.

This identifies a public link association, not proof that a physical QR was scanned: copying the resulting public URL retains its attribution. The UUID is an opaque public row identifier, not an authentication credential.

No trusted physical-placement/campaign fields exist in the current resolver. Existing QR navigation uses `lang`, `currency`, `table`, `zone`, and `view`; arbitrary table/zone values and free-text labels are not collected. `placement`, `campaign`, and non-QR source enums remain optional allowlisted, self-reported tags, not verified QR inventory metadata. Do not claim full verified placement/campaign reporting from this change. QR identity is attached to landing-page events while its query parameter is present; anonymous session identity can associate later observations, without retaining the original URL.

## Reporting coverage and bounds

The current dashboard reader remains capped at 12,000 raw events per current or previous window. Reaching the cap, an incomplete page, a missing migration or a read failure makes derived analytics unavailable; it never presents truncated totals as complete. Busy/long date ranges can therefore require a shorter selected period. This release does not introduce a database aggregation RPC or claim complete all-time reporting.

Observation-window boundaries remain UTC. Configured restaurant timezones change daily/weekday/hour grouping only; a partial boundary or DST transition can produce different numbers of local calendar-date buckets between windows. Missing historical evidence remains unavailable, rather than fabricated zero history. Deleted v2 dish IDs remain unattributed; legacy slug fallback requires evidence that the current dish existed at the event time.

New visible-active durations and model/AR outcomes are schema-v2 evidence only. Legacy elapsed session durations are not relabelled as active time. AR intent, observed lifecycle stages and unknown external outcomes remain distinct. No POS, orders, revenue, Web Vitals or general performance collection is added.
