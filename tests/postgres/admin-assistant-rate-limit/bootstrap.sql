begin;

create extension if not exists dblink;

create temporary table assistant_quota_fixture (
  restaurant_id uuid primary key
);

insert into public.restaurants (id, name, slug)
values ('20000000-0000-0000-0000-000000000201', 'Quota fixture', 'quota-fixture')
on conflict (id) do nothing;

insert into assistant_quota_fixture values ('20000000-0000-0000-0000-000000000201');

commit;
