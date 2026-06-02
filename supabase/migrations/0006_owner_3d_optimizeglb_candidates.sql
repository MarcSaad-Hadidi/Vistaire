-- Vistaire owner 3D/AR OptimizeGLB browser-local candidates
--
-- Supports the OptimizeGLB browser-local handoff workflow:
--   * The operator downloads the private source, optimizes it manually in the
--     OptimizeGLB browser-local tool, and re-uploads optimized candidate GLBs.
--   * Vistaire validates every candidate with its own production gates.
--   * Approval applies to a complete candidate set, not an isolated file.
--
-- Security model:
--   * Candidate GLBs live in a private storage bucket, never in Git or public/.
--   * These tables store metadata/hash/state only.
--   * All access uses the Supabase service role from server-only owner APIs.
--   * RLS is enabled with no anon/authenticated policies.
--   * No OptimizeGLB API key, cloud upload, or external request is involved.

create extension if not exists "pgcrypto";

-- Audit trail for protected source downloads (operator pulls source before the
-- manual OptimizeGLB browser-local step).
create table if not exists public.owner_3d_source_download_events (
  id uuid primary key default gen_random_uuid(),
  source_upload_id uuid references public.owner_3d_ar_source_uploads(id) on delete set null,
  restaurant_slug text not null
    check (restaurant_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and restaurant_slug not like '%..%'),
  menu_slug text not null
    check (menu_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and menu_slug not like '%..%'),
  dish_slug text not null
    check (dish_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and dish_slug not like '%..%'),
  version text not null
    check (version ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and version not like '%..%'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  downloaded_by_clerk_user_id text not null,
  downloaded_by_email text,
  request_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_metadata) = 'object'),
  downloaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists owner_3d_source_download_events_identity_idx
  on public.owner_3d_source_download_events (
    restaurant_slug,
    menu_slug,
    dish_slug,
    version,
    downloaded_at desc
  );

create index if not exists owner_3d_source_download_events_source_idx
  on public.owner_3d_source_download_events (source_upload_id, downloaded_at desc);

create table if not exists public.owner_3d_optimizeglb_candidates (
  id uuid primary key default gen_random_uuid(),
  source_upload_id uuid not null references public.owner_3d_ar_source_uploads(id) on delete restrict,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  restaurant_slug text not null
    check (restaurant_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and restaurant_slug not like '%..%'),
  menu_slug text not null
    check (menu_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and menu_slug not like '%..%'),
  dish_slug text not null
    check (dish_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and dish_slug not like '%..%'),
  version text not null
    check (version ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and version not like '%..%'),
  variant_role text not null
    check (variant_role in ('web', 'mobile', 'arLite', 'iosSource', 'posterSource')),
  preset_label text not null
    check (
      preset_label in (
        'optimizeglb-web-quality',
        'optimizeglb-mobile-balanced',
        'optimizeglb-ar-lite-aggressive',
        'optimizeglb-ar-lite-emergency',
        'optimizeglb-ios-source',
        'custom'
      )
    ),
  original_name text not null,
  bytes bigint not null check (bytes > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  triangle_count integer check (triangle_count is null or triangle_count >= 0),
  vertex_count integer check (vertex_count is null or vertex_count >= 0),
  material_count integer check (material_count is null or material_count >= 0),
  texture_count integer check (texture_count is null or texture_count >= 0),
  max_texture_size integer check (max_texture_size is null or max_texture_size >= 0),
  status text not null default 'candidate_uploaded'
    check (
      status in (
        'candidate_uploaded',
        'candidate_invalid',
        'candidate_analyzed',
        'candidate_visual_failed',
        'candidate_visual_passed',
        'candidate_selected',
        'candidate_rejected',
        'no_op_rejected'
      )
    ),
  validation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation) = 'object'),
  notes text,
  storage_provider text not null default 'supabase-storage'
    check (storage_provider = 'supabase-storage'),
  storage_bucket text not null check (storage_bucket ~ '^[a-z0-9][a-z0-9._-]{1,126}$'),
  storage_path text not null,
  uploaded_by_clerk_user_id text not null,
  uploaded_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.owner_3d_optimizeglb_candidates
  drop constraint if exists owner_3d_optimizeglb_candidates_storage_path_matches_metadata;

alter table public.owner_3d_optimizeglb_candidates
  add constraint owner_3d_optimizeglb_candidates_storage_path_matches_metadata
  check (
    storage_path =
      'candidates/' ||
      restaurant_slug || '/' ||
      menu_slug || '/' ||
      dish_slug || '/' ||
      version || '/' ||
      variant_role || '/' ||
      sha256 || '.glb'
  );

-- Multiple candidates per role are allowed; only the (role, sha256) pair is unique.
create unique index if not exists owner_3d_optimizeglb_candidates_identity_role_sha_key
  on public.owner_3d_optimizeglb_candidates (
    restaurant_slug,
    menu_slug,
    dish_slug,
    version,
    variant_role,
    sha256
  );

create index if not exists owner_3d_optimizeglb_candidates_identity_idx
  on public.owner_3d_optimizeglb_candidates (
    restaurant_slug,
    menu_slug,
    dish_slug,
    version,
    created_at desc
  );

create index if not exists owner_3d_optimizeglb_candidates_source_idx
  on public.owner_3d_optimizeglb_candidates (source_upload_id, variant_role);

create table if not exists public.owner_3d_optimizeglb_candidate_sets (
  id uuid primary key default gen_random_uuid(),
  source_upload_id uuid not null references public.owner_3d_ar_source_uploads(id) on delete restrict,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  restaurant_slug text not null
    check (restaurant_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and restaurant_slug not like '%..%'),
  menu_slug text not null
    check (menu_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and menu_slug not like '%..%'),
  dish_slug text not null
    check (dish_slug ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and dish_slug not like '%..%'),
  version text not null
    check (version ~ '^[a-z0-9][a-z0-9._-]{0,79}$' and version not like '%..%'),
  web_candidate_id uuid references public.owner_3d_optimizeglb_candidates(id) on delete set null,
  mobile_candidate_id uuid references public.owner_3d_optimizeglb_candidates(id) on delete set null,
  ar_lite_candidate_id uuid references public.owner_3d_optimizeglb_candidates(id) on delete set null,
  ios_source_candidate_id uuid references public.owner_3d_optimizeglb_candidates(id) on delete set null,
  poster_source_candidate_id uuid references public.owner_3d_optimizeglb_candidates(id) on delete set null,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'incomplete',
        'needs_visual_compare',
        'visual_failed',
        'recommended',
        'approved_by_human',
        'rejected',
        'ready_for_device_qa',
        'ready_for_cdn',
        'ready_for_finalize'
      )
    ),
  total_bytes bigint check (total_bytes is null or total_bytes >= 0),
  validation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation) = 'object'),
  visual_quality jsonb not null default '{}'::jsonb
    check (jsonb_typeof(visual_quality) = 'object'),
  selected_by_clerk_user_id text,
  selected_by_email text,
  selected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'approved_by_human'
    or (
      selected_at is not null
      and selected_by_clerk_user_id is not null
      and web_candidate_id is not null
      and mobile_candidate_id is not null
      and ar_lite_candidate_id is not null
    )
  )
);

create index if not exists owner_3d_optimizeglb_candidate_sets_identity_idx
  on public.owner_3d_optimizeglb_candidate_sets (
    restaurant_slug,
    menu_slug,
    dish_slug,
    version,
    updated_at desc
  );

create index if not exists owner_3d_optimizeglb_candidate_sets_source_idx
  on public.owner_3d_optimizeglb_candidate_sets (source_upload_id, status);

create or replace function public.set_owner_3d_optimizeglb_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists owner_3d_optimizeglb_candidates_set_updated_at
  on public.owner_3d_optimizeglb_candidates;
create trigger owner_3d_optimizeglb_candidates_set_updated_at
  before update on public.owner_3d_optimizeglb_candidates
  for each row
  execute function public.set_owner_3d_optimizeglb_updated_at();

drop trigger if exists owner_3d_optimizeglb_candidate_sets_set_updated_at
  on public.owner_3d_optimizeglb_candidate_sets;
create trigger owner_3d_optimizeglb_candidate_sets_set_updated_at
  before update on public.owner_3d_optimizeglb_candidate_sets
  for each row
  execute function public.set_owner_3d_optimizeglb_updated_at();

alter table public.owner_3d_source_download_events enable row level security;
alter table public.owner_3d_optimizeglb_candidates enable row level security;
alter table public.owner_3d_optimizeglb_candidate_sets enable row level security;

revoke all on public.owner_3d_source_download_events from anon, authenticated;
revoke all on public.owner_3d_optimizeglb_candidates from anon, authenticated;
revoke all on public.owner_3d_optimizeglb_candidate_sets from anon, authenticated;

grant all on public.owner_3d_source_download_events to service_role;
grant all on public.owner_3d_optimizeglb_candidates to service_role;
grant all on public.owner_3d_optimizeglb_candidate_sets to service_role;
