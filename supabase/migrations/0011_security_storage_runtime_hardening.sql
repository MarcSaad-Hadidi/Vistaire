-- Vistaire runtime DB and Storage hardening
-- Mirrors production fixes that make owner APIs service-role-only, lock direct
-- Data API access, add FK indexes, and create private Storage buckets.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'analytics_events',
    'menu_categories',
    'menu_dishes',
    'menu_ui_configs',
    'menus',
    'owner_ai_recommendations',
    'qr_codes',
    'restaurants',
    'owner_3d_ar_source_uploads',
    'owner_3d_asset_sources',
    'owner_3d_asset_versions',
    'owner_3d_pipeline_jobs',
    'owner_3d_pipeline_artifacts',
    'owner_3d_visual_reviews',
    'owner_3d_device_qa',
    'owner_3d_publish_events',
    'owner_3d_source_download_events',
    'owner_3d_optimizeglb_candidates',
    'owner_3d_optimizeglb_candidate_sets'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('alter table public.%I enable row level security', v_table);
      execute format('revoke all on table public.%I from anon, authenticated', v_table);
      execute format(
        'grant select, insert, update, delete on table public.%I to service_role',
        v_table
      );
      execute format(
        'drop policy if exists vistaire_no_direct_public_access on public.%I',
        v_table
      );
      execute format(
        'create policy vistaire_no_direct_public_access on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
        v_table
      );
    end if;
  end loop;
end $$;

do $$
declare
  v_view text;
begin
  foreach v_view in array array[
    'restaurant_daily_analytics',
    'restaurant_dish_analytics',
    'restaurant_search_analytics',
    'restaurant_category_analytics'
  ]
  loop
    if to_regclass(format('public.%I', v_view)) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v_view);
      execute format('revoke all on table public.%I from anon, authenticated', v_view);
      execute format('grant select on table public.%I to service_role', v_view);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.resolve_qr_code_scan(text)') is not null then
    revoke execute on function public.resolve_qr_code_scan(text)
      from public, anon, authenticated;
    grant execute on function public.resolve_qr_code_scan(text) to service_role;
  end if;

  if to_regprocedure('public.delete_owner_restaurant_cascade(uuid,text)') is not null then
    revoke execute on function public.delete_owner_restaurant_cascade(uuid, text)
      from public, anon, authenticated;
    grant execute on function public.delete_owner_restaurant_cascade(uuid, text)
      to service_role;
  end if;

  if to_regprocedure('public.owner_3d_claim_pipeline_job(text,integer,text,text)') is not null then
    revoke all on function public.owner_3d_claim_pipeline_job(text, integer, text, text)
      from public, anon, authenticated;
    grant execute on function public.owner_3d_claim_pipeline_job(text, integer, text, text)
      to service_role;
  end if;

  if to_regprocedure('public.owner_3d_heartbeat_pipeline_job(text,text,uuid,integer,text)') is not null then
    revoke all on function public.owner_3d_heartbeat_pipeline_job(text, text, uuid, integer, text)
      from public, anon, authenticated;
    grant execute on function public.owner_3d_heartbeat_pipeline_job(text, text, uuid, integer, text)
      to service_role;
  end if;

  if to_regprocedure('public.owner_3d_update_pipeline_job_progress(text,text,uuid,text,text,jsonb,jsonb,text)') is not null then
    revoke all on function public.owner_3d_update_pipeline_job_progress(text, text, uuid, text, text, jsonb, jsonb, text)
      from public, anon, authenticated;
    grant execute on function public.owner_3d_update_pipeline_job_progress(text, text, uuid, text, text, jsonb, jsonb, text)
      to service_role;
  end if;

  if to_regprocedure('public.owner_3d_complete_pipeline_job(text,text,uuid,text,text,jsonb,jsonb,jsonb,jsonb,text,text)') is not null then
    revoke all on function public.owner_3d_complete_pipeline_job(text, text, uuid, text, text, jsonb, jsonb, jsonb, jsonb, text, text)
      from public, anon, authenticated;
    grant execute on function public.owner_3d_complete_pipeline_job(text, text, uuid, text, text, jsonb, jsonb, jsonb, jsonb, text, text)
      to service_role;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    alter function public.set_updated_at() set search_path = public;
    revoke execute on function public.set_updated_at() from public, anon, authenticated;
    grant execute on function public.set_updated_at() to service_role;
  end if;

  if to_regprocedure('public.set_restaurants_updated_at()') is not null then
    alter function public.set_restaurants_updated_at() set search_path = public;
    revoke execute on function public.set_restaurants_updated_at()
      from public, anon, authenticated;
    grant execute on function public.set_restaurants_updated_at() to service_role;
  end if;

  if to_regprocedure('public.set_qr_codes_updated_at()') is not null then
    alter function public.set_qr_codes_updated_at() set search_path = public;
    revoke execute on function public.set_qr_codes_updated_at()
      from public, anon, authenticated;
    grant execute on function public.set_qr_codes_updated_at() to service_role;
  end if;

  if to_regprocedure('public.set_menu_ui_configs_updated_at()') is not null then
    alter function public.set_menu_ui_configs_updated_at() set search_path = public;
    revoke execute on function public.set_menu_ui_configs_updated_at()
      from public, anon, authenticated;
    grant execute on function public.set_menu_ui_configs_updated_at() to service_role;
  end if;

  if to_regprocedure('public.set_owner_3d_ar_source_uploads_updated_at()') is not null then
    alter function public.set_owner_3d_ar_source_uploads_updated_at() set search_path = public;
    revoke execute on function public.set_owner_3d_ar_source_uploads_updated_at()
      from public, anon, authenticated;
    grant execute on function public.set_owner_3d_ar_source_uploads_updated_at()
      to service_role;
  end if;

  if to_regprocedure('public.set_owner_3d_pipeline_updated_at()') is not null then
    alter function public.set_owner_3d_pipeline_updated_at() set search_path = public;
    revoke execute on function public.set_owner_3d_pipeline_updated_at()
      from public, anon, authenticated;
    grant execute on function public.set_owner_3d_pipeline_updated_at() to service_role;
  end if;

  if to_regprocedure('public.set_owner_3d_optimizeglb_updated_at()') is not null then
    alter function public.set_owner_3d_optimizeglb_updated_at() set search_path = public;
    revoke execute on function public.set_owner_3d_optimizeglb_updated_at()
      from public, anon, authenticated;
    grant execute on function public.set_owner_3d_optimizeglb_updated_at()
      to service_role;
  end if;
end $$;

create index if not exists analytics_events_dish_id_idx
  on public.analytics_events (dish_id);

create index if not exists owner_3d_asset_sources_source_upload_id_idx
  on public.owner_3d_asset_sources (source_upload_id)
  where source_upload_id is not null;

create index if not exists owner_3d_asset_versions_source_id_idx
  on public.owner_3d_asset_versions (source_id)
  where source_id is not null;

create index if not exists owner_3d_asset_versions_previous_version_id_idx
  on public.owner_3d_asset_versions (previous_version_id)
  where previous_version_id is not null;

create index if not exists owner_3d_device_qa_evidence_artifact_id_idx
  on public.owner_3d_device_qa (evidence_artifact_id)
  where evidence_artifact_id is not null;

create index if not exists owner_3d_candidate_sets_web_candidate_id_idx
  on public.owner_3d_optimizeglb_candidate_sets (web_candidate_id)
  where web_candidate_id is not null;

create index if not exists owner_3d_candidate_sets_mobile_candidate_id_idx
  on public.owner_3d_optimizeglb_candidate_sets (mobile_candidate_id)
  where mobile_candidate_id is not null;

create index if not exists owner_3d_candidate_sets_ar_lite_candidate_id_idx
  on public.owner_3d_optimizeglb_candidate_sets (ar_lite_candidate_id)
  where ar_lite_candidate_id is not null;

create index if not exists owner_3d_candidate_sets_ios_source_candidate_id_idx
  on public.owner_3d_optimizeglb_candidate_sets (ios_source_candidate_id)
  where ios_source_candidate_id is not null;

create index if not exists owner_3d_candidate_sets_poster_source_candidate_id_idx
  on public.owner_3d_optimizeglb_candidate_sets (poster_source_candidate_id)
  where poster_source_candidate_id is not null;

create index if not exists owner_3d_pipeline_jobs_source_id_idx
  on public.owner_3d_pipeline_jobs (source_id)
  where source_id is not null;

create index if not exists owner_3d_pipeline_jobs_asset_version_id_idx
  on public.owner_3d_pipeline_jobs (asset_version_id)
  where asset_version_id is not null;

create index if not exists owner_3d_pipeline_jobs_retry_of_job_id_idx
  on public.owner_3d_pipeline_jobs (retry_of_job_id)
  where retry_of_job_id is not null;

create index if not exists owner_3d_publish_events_job_id_idx
  on public.owner_3d_publish_events (job_id)
  where job_id is not null;

create index if not exists owner_3d_publish_events_previous_version_id_idx
  on public.owner_3d_publish_events (previous_version_id)
  where previous_version_id is not null;

create index if not exists owner_3d_visual_reviews_visual_report_artifact_id_idx
  on public.owner_3d_visual_reviews (visual_report_artifact_id)
  where visual_report_artifact_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vistaire-3d-sources',
    'vistaire-3d-sources',
    false,
    262144000,
    array['model/gltf-binary']::text[]
  ),
  (
    'vistaire-3d-qa',
    'vistaire-3d-qa',
    false,
    5242880,
    array[
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/markdown'
    ]::text[]
  ),
  (
    'vistaire-media',
    'vistaire-media',
    false,
    26214400,
    array['image/png', 'image/jpeg', 'image/webp', 'image/avif']::text[]
  ),
  (
    'vistaire-3d',
    'vistaire-3d',
    false,
    262144000,
    array[
      'model/gltf-binary',
      'model/vnd.usdz+zip',
      'application/octet-stream',
      'application/json',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
      'text/markdown',
      'application/pdf'
    ]::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

notify pgrst, 'reload schema';
