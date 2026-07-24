-- Schema catch-up for unique-menu-design Postgres harness.
-- Production create RPCs expect city + Google review columns that are not
-- present in the minimal 0007 restaurants bootstrap used by CI suites.

alter table public.restaurants
  add column if not exists city text;

\ir ../../../supabase/migrations/0009_restaurant_google_reviews.sql
