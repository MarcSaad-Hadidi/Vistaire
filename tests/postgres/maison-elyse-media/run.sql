\set ON_ERROR_STOP on
\ir ../../../supabase/migrations/0013_create_owner_restaurant_with_menu.sql
\ir ../../../supabase/migrations/20260721150000_maison_elyse_media_backfill_rpc.sql
grant usage on schema qr_test to service_role;
grant execute on all functions in schema qr_test to service_role;
\ir fixture.sql
\ir security.test.sql
\ir behavior.test.sql
\ir concurrency.test.sql

select 'Maison Elyse media PostgreSQL 17 suite passed' as result;
