-- Vistaire owner restaurant hard delete
-- Transactional DB cleanup for owner-only destructive restaurant deletion.
--
-- Storage objects are not deleted here; the Next.js owner API handles optional
-- Storage cleanup after the DB deletion has been confirmed.

create or replace function public.delete_owner_restaurant_cascade(
  p_restaurant_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_specs jsonb := '[
    {"table":"qr_codes","column":"restaurant_id","kind":"id"},
    {"table":"menu_dishes","column":"restaurant_id","kind":"id"},
    {"table":"menu_dishes","column":"restaurant_slug","kind":"slug"},
    {"table":"menu_ui_configs","column":"restaurant_id","kind":"id"},
    {"table":"owner_3d_source_download_events","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_optimizeglb_candidate_sets","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_optimizeglb_candidates","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_visual_reviews","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_device_qa","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_publish_events","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_pipeline_artifacts","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_pipeline_jobs","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_asset_versions","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_asset_sources","column":"restaurant_slug","kind":"slug"},
    {"table":"owner_3d_ar_source_uploads","column":"restaurant_slug","kind":"slug"},
    {"table":"analytics_events","column":"restaurant_id","kind":"id"},
    {"table":"restaurant_daily_analytics","column":"restaurant_id","kind":"id"},
    {"table":"restaurant_dish_analytics","column":"restaurant_id","kind":"id"},
    {"table":"restaurant_search_analytics","column":"restaurant_id","kind":"id"},
    {"table":"restaurant_category_analytics","column":"restaurant_id","kind":"id"},
    {"table":"owner_ai_recommendations","column":"restaurant_id","kind":"id"},
    {"table":"owner_ai_recommendations","column":"restaurant_name","kind":"name"},
    {"table":"owner_actions","column":"restaurant_id","kind":"id"},
    {"table":"owner_actions","column":"restaurant_slug","kind":"slug"},
    {"table":"restaurant_menu_sections","column":"restaurant_id","kind":"id"},
    {"table":"menu_sections","column":"restaurant_id","kind":"id"},
    {"table":"menu_categories","column":"restaurant_id","kind":"id"},
    {"table":"restaurant_assets","column":"restaurant_id","kind":"id"},
    {"table":"media_assets","column":"restaurant_id","kind":"id"},
    {"table":"dish_assets","column":"restaurant_id","kind":"id"}
  ]'::jsonb;
  v_spec jsonb;
  v_table text;
  v_column text;
  v_kind text;
  v_value text;
  v_count integer;
  v_deleted jsonb := '{}'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
begin
  select id, name, slug, status
    into v_restaurant
  from public.restaurants
  where id = p_restaurant_id
  for update;

  if not found then
    raise exception 'Restaurant introuvable.' using errcode = 'P0002';
  end if;

  if v_restaurant.status = 'demo' or v_restaurant.slug = 'maison-elyse' then
    raise exception 'Restaurant de demonstration protege contre la suppression.' using errcode = 'P0001';
  end if;

  if nullif(trim(p_confirmation), '') is null then
    raise exception 'Confirmation de suppression requise.' using errcode = '22023';
  end if;

  if trim(p_confirmation) <> v_restaurant.name and trim(p_confirmation) <> v_restaurant.slug then
    raise exception 'La confirmation ne correspond pas au restaurant.' using errcode = '22023';
  end if;

  for v_spec in select value from jsonb_array_elements(v_specs)
  loop
    v_table := v_spec ->> 'table';
    v_column := v_spec ->> 'column';
    v_kind := v_spec ->> 'kind';
    v_value := case v_kind
      when 'id' then p_restaurant_id::text
      when 'slug' then v_restaurant.slug
      when 'name' then v_restaurant.name
      else null
    end;

    if nullif(v_value, '') is null then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'table', v_table,
        'column', v_column,
        'reason', 'empty_value',
        'message', 'Aucune valeur restaurant disponible.'
      ));
      continue;
    end if;

    if to_regclass(format('public.%I', v_table)) is null then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'table', v_table,
        'column', v_column,
        'reason', 'missing_table',
        'message', v_table || ' absent dans Supabase.'
      ));
      v_warnings := v_warnings || jsonb_build_array(v_table || ' absent: nettoyage ignore.');
      continue;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = v_column
    ) then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'table', v_table,
        'column', v_column,
        'reason', 'missing_column',
        'message', v_table || '.' || v_column || ' absent dans Supabase.'
      ));
      v_warnings := v_warnings || jsonb_build_array(
        v_table || '.' || v_column || ' absent: nettoyage ignore pour cette colonne.'
      );
      continue;
    end if;

    begin
      execute format('delete from public.%I where %I::text = $1', v_table, v_column)
        using v_value;
      get diagnostics v_count = row_count;
    exception
      when others then
        raise exception 'Impossible de supprimer les donnees liees dans %. %', v_table, sqlerrm
          using errcode = 'P0001';
    end;

    v_deleted := jsonb_set(
      v_deleted,
      array[v_table],
      to_jsonb(coalesce((v_deleted ->> v_table)::integer, 0) + v_count),
      true
    );
  end loop;

  delete from public.restaurants where id = p_restaurant_id;
  get diagnostics v_count = row_count;

  if v_count <> 1 then
    raise exception 'Supabase n''a pas confirme la suppression du restaurant.' using errcode = 'P0001';
  end if;

  v_deleted := jsonb_set(
    v_deleted,
    '{restaurants}',
    to_jsonb(coalesce((v_deleted ->> 'restaurants')::integer, 0) + v_count),
    true
  );

  return jsonb_build_object(
    'ok', true,
    'restaurantId', p_restaurant_id::text,
    'restaurantDeleted', true,
    'deleted', v_deleted,
    'skipped', v_skipped,
    'warnings', v_warnings
  );
end;
$$;

comment on function public.delete_owner_restaurant_cascade(uuid, text) is
  'Atomically deletes an owner restaurant and known linked DB rows, skipping absent optional tables/columns.';

revoke execute on function public.delete_owner_restaurant_cascade(uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_owner_restaurant_cascade(uuid, text)
  to service_role;
