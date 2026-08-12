\set ON_ERROR_STOP on
\ir ../../../supabase/migrations/20260811200000_admin_assistant_rate_limit.sql
\ir bootstrap.sql
\ir security.test.sql
\ir concurrency.test.sql
