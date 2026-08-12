\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$ begin if not coalesce(value,false) then raise exception 'assertion failed: %',message; end if; end $$;
