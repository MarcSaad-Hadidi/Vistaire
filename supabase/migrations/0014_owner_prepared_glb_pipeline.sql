-- Vistaire prepared GLB -> USDZ owner workflow
--
-- This migration lets Vistaire store a ready GLB in Supabase Storage and create
-- a manual/external USDZ job without running a compression pipeline in Next.js.

alter table public.owner_3d_pipeline_jobs
  drop constraint if exists owner_3d_pipeline_jobs_step_check,
  drop constraint if exists owner_3d_pipeline_jobs_status_check,
  drop constraint if exists owner_3d_pipeline_jobs_quality_status_check;

alter table public.owner_3d_pipeline_jobs
  add constraint owner_3d_pipeline_jobs_step_check
    check (
      step in (
        'analyze',
        'optimize',
        'visual_compare',
        'visual_review',
        'device_qa',
        'cdn',
        'finalize',
        'publish',
        'rollback',
        'prepared_usdz'
      )
    ),
  add constraint owner_3d_pipeline_jobs_status_check
    check (
      status in (
        'queued',
        'running',
        'analyzing',
        'optimizing',
        'visual_comparing',
        'pending_manual_usdz',
        'web_ready_usdz_pending',
        'needs_visual_review',
        'needs_device_qa',
        'needs_cdn_upload',
        'needs_finalize',
        'ready_to_publish',
        'published',
        'rejected',
        'failed',
        'rolled_back',
        'cancelled'
      )
    ),
  add constraint owner_3d_pipeline_jobs_quality_status_check
    check (
      quality_status in (
        'queued',
        'running',
        'passed',
        'warning',
        'failed',
        'unvalidated',
        'needs_visual_review',
        'needs_device_qa',
        'needs_cdn_upload',
        'needs_finalize',
        'ready_to_publish',
        'published',
        'rejected',
        'rolled_back',
        'cancelled'
      )
    );

drop index if exists public.owner_3d_pipeline_jobs_active_dedupe_key;

create unique index if not exists owner_3d_pipeline_jobs_active_dedupe_key
  on public.owner_3d_pipeline_jobs (dedupe_key)
  where dedupe_key is not null
    and status in (
      'queued',
      'running',
      'analyzing',
      'optimizing',
      'visual_comparing',
      'pending_manual_usdz',
      'web_ready_usdz_pending'
    );

create index if not exists owner_3d_pipeline_jobs_prepared_usdz_idx
  on public.owner_3d_pipeline_jobs (created_at desc)
  where step = 'prepared_usdz'
    and status in ('pending_manual_usdz', 'web_ready_usdz_pending');
