begin;

create table if not exists public.analytics_events (
 id uuid default gen_random_uuid() not null, restaurant_id uuid not null, menu_id uuid, dish_id uuid,
 session_id text not null, event_name text not null, source text default 'demo'::text not null,
 dish_slug text, category_slug text, search_query text, filter_name text, cta_name text,
 viewport jsonb, user_agent text, metadata jsonb default '{}'::jsonb not null,
 created_at timestamptz default now() not null
);

do $reconcile$
declare r record; actual text; table_owner text; rls boolean; force_rls boolean;
begin
  for r in select * from (values
    ('id','uuid',true,'gen_random_uuid()'),('restaurant_id','uuid',true,null),('menu_id','uuid',false,null),('dish_id','uuid',false,null),
    ('session_id','text',true,null),('event_name','text',true,null),('source','text',true,'''demo''::text'),
    ('dish_slug','text',false,null),('category_slug','text',false,null),('search_query','text',false,null),('filter_name','text',false,null),('cta_name','text',false,null),
    ('viewport','jsonb',false,null),('user_agent','text',false,null),('metadata','jsonb',true,'''{}''::jsonb'),('created_at','timestamp with time zone',true,'now()')
  ) e(name,typ,required,def) loop
    select format('%s|%s|%s',format_type(a.atttypid,a.atttypmod),a.attnotnull,coalesce(pg_get_expr(d.adbin,d.adrelid),'')) into actual
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.analytics_events'::regclass and a.attname=r.name and not a.attisdropped;
    if actual is null or actual <> format('%s|%s|%s',r.typ,r.required,coalesce(r.def,'')) then raise exception 'incompatible column %: %',r.name,actual; end if;
  end loop;
  if exists(select 1 from pg_constraint where conrelid='public.analytics_events'::regclass and conname not in ('analytics_events_pkey','analytics_events_restaurant_id_fkey','analytics_events_menu_id_fkey','analytics_events_dish_id_fkey','analytics_events_event_name_check','analytics_events_source_check')) then raise exception 'unexpected constraint on analytics_events'; end if;
  if (select count(*) from pg_attribute where attrelid='public.analytics_events'::regclass and attnum>0 and not attisdropped) <> 16 then raise exception 'incompatible column count'; end if;

  for r in select * from (values
    ('analytics_events_pkey','PRIMARY KEY (id)','alter table public.analytics_events add constraint analytics_events_pkey primary key (id)'),
    ('analytics_events_restaurant_id_fkey','FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE','alter table public.analytics_events add constraint analytics_events_restaurant_id_fkey foreign key (restaurant_id) references public.restaurants(id) on delete cascade'),
    ('analytics_events_menu_id_fkey','FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE SET NULL','alter table public.analytics_events add constraint analytics_events_menu_id_fkey foreign key (menu_id) references public.menus(id) on delete set null'),
    ('analytics_events_dish_id_fkey','FOREIGN KEY (dish_id) REFERENCES menu_dishes(id) ON DELETE SET NULL','alter table public.analytics_events add constraint analytics_events_dish_id_fkey foreign key (dish_id) references public.menu_dishes(id) on delete set null'),
    ('analytics_events_event_name_check','CHECK ((event_name = ANY (ARRAY[''session_started''::text, ''session_duration''::text, ''menu_opened''::text, ''category_viewed''::text, ''dish_opened''::text, ''dish_3d_clicked''::text, ''dish_ar_clicked''::text, ''search_used''::text, ''filter_used''::text, ''cta_clicked''::text, ''dashboard_demo_opened''::text])))','alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name = any (array[''session_started'',''session_duration'',''menu_opened'',''category_viewed'',''dish_opened'',''dish_3d_clicked'',''dish_ar_clicked'',''search_used'',''filter_used'',''cta_clicked'',''dashboard_demo_opened'']::text[]))'),
    ('analytics_events_source_check','CHECK ((source = ANY (ARRAY[''demo''::text, ''production''::text])))','alter table public.analytics_events add constraint analytics_events_source_check check (source = any (array[''demo'',''production'']::text[]))')
  ) e(name,definition,ddl) loop
    select pg_get_constraintdef(oid) into actual from pg_constraint where conrelid='public.analytics_events'::regclass and conname=r.name;
    if actual is null then execute r.ddl; elsif actual <> r.definition then raise exception 'incompatible constraint %: %',r.name,actual; end if;
  end loop;
  -- The primary-key backing index is an explicitly allowed system-owned index.
  if exists(select 1 from pg_index i join pg_class x on x.oid=i.indexrelid where i.indrelid='public.analytics_events'::regclass and not exists(select 1 from pg_constraint c where c.conindid=i.indexrelid) and x.relname not in ('analytics_events_category_slug_idx','analytics_events_dish_id_idx','analytics_events_dish_slug_idx','analytics_events_menu_created_idx','analytics_events_name_idx','analytics_events_restaurant_created_idx','analytics_events_search_query_idx','analytics_events_session_idx','analytics_events_dashboard_scope_idx')) then raise exception 'unexpected index on analytics_events'; end if;

  for r in select * from (values
    ('analytics_events_category_slug_idx','CREATE INDEX analytics_events_category_slug_idx ON public.analytics_events USING btree (category_slug)','create index analytics_events_category_slug_idx on public.analytics_events (category_slug)'),
    ('analytics_events_dish_id_idx','CREATE INDEX analytics_events_dish_id_idx ON public.analytics_events USING btree (dish_id)','create index analytics_events_dish_id_idx on public.analytics_events (dish_id)'),
    ('analytics_events_dish_slug_idx','CREATE INDEX analytics_events_dish_slug_idx ON public.analytics_events USING btree (dish_slug)','create index analytics_events_dish_slug_idx on public.analytics_events (dish_slug)'),
    ('analytics_events_menu_created_idx','CREATE INDEX analytics_events_menu_created_idx ON public.analytics_events USING btree (menu_id, created_at DESC)','create index analytics_events_menu_created_idx on public.analytics_events (menu_id, created_at desc)'),
    ('analytics_events_name_idx','CREATE INDEX analytics_events_name_idx ON public.analytics_events USING btree (event_name)','create index analytics_events_name_idx on public.analytics_events (event_name)'),
    ('analytics_events_restaurant_created_idx','CREATE INDEX analytics_events_restaurant_created_idx ON public.analytics_events USING btree (restaurant_id, created_at DESC)','create index analytics_events_restaurant_created_idx on public.analytics_events (restaurant_id, created_at desc)'),
    ('analytics_events_search_query_idx','CREATE INDEX analytics_events_search_query_idx ON public.analytics_events USING btree (search_query)','create index analytics_events_search_query_idx on public.analytics_events (search_query)'),
    ('analytics_events_session_idx','CREATE INDEX analytics_events_session_idx ON public.analytics_events USING btree (session_id)','create index analytics_events_session_idx on public.analytics_events (session_id)'),
    ('analytics_events_dashboard_scope_idx','CREATE INDEX analytics_events_dashboard_scope_idx ON public.analytics_events USING btree (restaurant_id, menu_id, source, created_at DESC)','create index analytics_events_dashboard_scope_idx on public.analytics_events (restaurant_id, menu_id, source, created_at desc)')
  ) e(name,definition,ddl) loop
    select pg_get_indexdef(indexrelid) into actual from pg_index join pg_class on pg_class.oid=indexrelid where indrelid='public.analytics_events'::regclass and relname=r.name;
    if actual is null then execute r.ddl; elsif actual <> r.definition then raise exception 'incompatible index %: %',r.name,actual; end if;
  end loop;

  select owner.rolname,c.relrowsecurity,c.relforcerowsecurity into table_owner,rls,force_rls from pg_class c join pg_roles owner on owner.oid=c.relowner where c.oid='public.analytics_events'::regclass;
  if table_owner <> 'postgres' then raise exception 'incompatible owner %',table_owner; end if;
  if not rls then alter table public.analytics_events enable row level security; end if;
  if force_rls then raise exception 'incompatible rls force flag'; end if;
end $reconcile$;

-- pg_indexes is also captured in the committed evidence; pg_get_indexdef is authoritative here.
revoke all on table public.analytics_events from public;
revoke all on table public.analytics_events from anon, authenticated;
grant delete, insert, references, select, trigger, truncate, update on table public.analytics_events to service_role;
do $security$ declare actual text; begin
 select cmd||'|'||permissive||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'') into actual from pg_policies where schemaname='public' and tablename='analytics_events' and policyname='vistaire_no_direct_public_access';
 if actual is null then create policy vistaire_no_direct_public_access on public.analytics_events as restrictive for all to anon, authenticated using (false) with check (false);
 elsif actual <> 'ALL|RESTRICTIVE|{anon,authenticated}|false|false' then raise exception 'incompatible policy vistaire_no_direct_public_access: %',actual; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='analytics_events' and policyname<>'vistaire_no_direct_public_access') then raise exception 'unexpected policy on analytics_events'; end if;
 if exists(select 1 from information_schema.table_privileges where table_schema='public' and table_name='analytics_events' and grantee in ('anon','authenticated')) then raise exception 'incompatible grant browser role'; end if;
 -- pg_class.relacl/aclexplode is the authoritative catalog representation of grants.
 if exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a join pg_roles grantee on grantee.oid=a.grantee where c.oid='public.analytics_events'::regclass and grantee.rolname in ('anon','authenticated')) then raise exception 'incompatible grant browser role catalog'; end if;
 if (select array_agg(privilege_type order by privilege_type)::text from information_schema.table_privileges where table_schema='public' and table_name='analytics_events' and grantee='service_role') <> '{DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE}' then raise exception 'incompatible grant service_role'; end if;
 if exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a join pg_roles grantee on grantee.oid=a.grantee where c.oid='public.analytics_events'::regclass and grantee.rolname not in ('postgres','service_role')) then raise exception 'unexpected grant on analytics_events'; end if;
 if exists(select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a join pg_roles grantee on grantee.oid=a.grantee where d.defaclnamespace='public'::regnamespace and d.defaclobjtype='r' and grantee.rolname in ('anon','authenticated','service_role')) then raise exception 'unexpected default privilege for analytics_events roles'; end if;
end $security$;
commit;
