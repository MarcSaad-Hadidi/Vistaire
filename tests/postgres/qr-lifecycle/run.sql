\set ON_ERROR_STOP on
-- Reproducible runner from the repository root (official PostgreSQL 17 image):
--   docker run --rm --name vistaire-qr-pg17 -e POSTGRES_PASSWORD=postgres \
--     -v "${PWD}:/work" -w /work -d postgres:17
--   docker exec vistaire-qr-pg17 pg_isready -U postgres
--   docker exec vistaire-qr-pg17 psql -X -v ON_ERROR_STOP=1 -U postgres \
--     -d postgres -f tests/postgres/qr-lifecycle/run.sql
--   docker stop vistaire-qr-pg17
\ir bootstrap.sql

\ir ../../../supabase/migrations/0001_qr_codes.sql
\ir ../../../supabase/migrations/0002_qr_resolve_scan_rpc.sql
\ir ../../../supabase/migrations/0007_restaurants.sql
\ir ../../../supabase/migrations/0011_security_storage_runtime_hardening.sql
\ir legacy-fixture.sql
\ir ../../../supabase/migrations/20260709180000_admin_qr_access.sql
\ir snapshot-fixture.sql
\ir ../../../supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql

\ir migration-security.test.sql
\ir lifecycle.test.sql
\ir concurrency.test.sql

select 'qr lifecycle PostgreSQL 17 suite passed' as result;
