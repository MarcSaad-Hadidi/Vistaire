begin;

alter table public.qr_codes
  add column if not exists purpose_key text not null default 'default';

alter table public.qr_codes
  add column if not exists is_canonical boolean not null default false;

alter table public.qr_codes
  add column if not exists token_ciphertext text;

alter table public.qr_codes
  add column if not exists token_nonce text;

alter table public.qr_codes
  add column if not exists token_key_version text;

alter table public.qr_codes
  add column if not exists supersedes_qr_code_id uuid;

alter table public.qr_codes
  add column if not exists rotated_at timestamptz;

alter table public.qr_codes
  add column if not exists revoked_at timestamptz;

alter table public.qr_codes
  add column if not exists config_version integer not null default 1;

-- The legacy constraint was created implicitly by 0001_qr_codes.sql. Replace it
-- without rewriting any row so revoked becomes a first-class terminal state.
alter table public.qr_codes
  drop constraint if exists qr_codes_status_check;

alter table public.qr_codes
  add constraint qr_codes_status_check
  check (status in ('active', 'paused', 'archived', 'revoked'));

alter table public.qr_codes
  validate constraint qr_codes_status_check;

do $$
begin
  if exists (
    select 1
    from public.qr_codes
    where status = 'revoked'
      and is_canonical = true
  ) then
    raise exception
      'Cannot install canonical QR lifecycle: a revoked QR is marked canonical';
  end if;
end;
$$;

alter table public.qr_codes
  drop constraint if exists qr_codes_purpose_key_normalized_check;
alter table public.qr_codes
  add constraint qr_codes_purpose_key_normalized_check
  check (
    purpose_key is null
    or (
      purpose_key = pg_catalog.lower(pg_catalog.btrim(purpose_key))
      and purpose_key <> ''
    )
  );

alter table public.qr_codes
  drop constraint if exists qr_codes_token_envelope_all_or_none_check;
alter table public.qr_codes
  add constraint qr_codes_token_envelope_all_or_none_check
  check (
    (
      token_ciphertext is null
      and token_nonce is null
      and token_key_version is null
    )
    or (
      token_ciphertext is not null
      and pg_catalog.btrim(token_ciphertext) <> ''
      and token_nonce is not null
      and pg_catalog.btrim(token_nonce) <> ''
      and token_key_version is not null
      and pg_catalog.btrim(token_key_version) <> ''
    )
  );

alter table public.qr_codes
  drop constraint if exists qr_codes_canonical_slot_complete_check;
alter table public.qr_codes
  add constraint qr_codes_canonical_slot_complete_check
  check (
    not is_canonical
    or (
      restaurant_id is not null
      and purpose_key is not null
      and status not in ('archived', 'revoked')
    )
  );

alter table public.qr_codes
  drop constraint if exists qr_codes_supersedes_qr_code_id_fkey;
alter table public.qr_codes
  add constraint qr_codes_supersedes_qr_code_id_fkey
  foreign key (supersedes_qr_code_id)
  references public.qr_codes (id);

alter table public.qr_codes
  drop constraint if exists qr_codes_supersedes_qr_code_id_not_self_check;
alter table public.qr_codes
  add constraint qr_codes_supersedes_qr_code_id_not_self_check
  check (
    supersedes_qr_code_id is null
    or supersedes_qr_code_id <> id
  );

alter table public.qr_codes
  validate constraint qr_codes_purpose_key_normalized_check;

alter table public.qr_codes
  validate constraint qr_codes_token_envelope_all_or_none_check;

alter table public.qr_codes
  validate constraint qr_codes_canonical_slot_complete_check;

alter table public.qr_codes
  validate constraint qr_codes_supersedes_qr_code_id_fkey;

alter table public.qr_codes
  validate constraint qr_codes_supersedes_qr_code_id_not_self_check;

alter table public.qr_codes
  add constraint qr_codes_purpose_key_format_check
  check (purpose_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

alter table public.qr_codes
  add constraint qr_codes_config_version_check
  check (config_version > 0);

alter table public.qr_codes
  add constraint qr_codes_revoked_at_check
  check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  );

alter table public.qr_codes
  validate constraint qr_codes_purpose_key_format_check;

alter table public.qr_codes
  validate constraint qr_codes_config_version_check;

alter table public.qr_codes
  validate constraint qr_codes_revoked_at_check;

create table public.qr_code_lifecycle_events (
  operation_id uuid primary key,
  restaurant_id uuid not null,
  qr_code_id uuid not null,
  successor_qr_code_id uuid,
  action text not null
    check (action in ('pause', 'resume', 'archive', 'revoke', 'rotate')),
  disposition text
    check (disposition is null or disposition in ('keep-active', 'pause', 'revoke')),
  previous_status text not null
    check (previous_status in ('active', 'paused', 'archived', 'revoked')),
  new_status text not null
    check (new_status in ('active', 'paused', 'archived', 'revoked')),
  request_fingerprint text,
  previous_config_version integer not null check (previous_config_version > 0),
  new_config_version integer not null check (new_config_version > 0),
  occurred_at timestamptz not null default pg_catalog.now(),
  constraint qr_code_lifecycle_events_rotation_shape_check
    check (
      (action = 'rotate' and disposition is not null
        and successor_qr_code_id is not null and request_fingerprint is not null)
      or (action <> 'rotate' and disposition is null
        and successor_qr_code_id is null and request_fingerprint is null)
    )
);

create index qr_code_lifecycle_events_qr_code_id_idx
  on public.qr_code_lifecycle_events (qr_code_id, occurred_at desc);

create index qr_code_lifecycle_events_restaurant_id_idx
  on public.qr_code_lifecycle_events (restaurant_id, occurred_at desc);

create index qr_code_lifecycle_events_successor_qr_code_id_idx
  on public.qr_code_lifecycle_events (successor_qr_code_id)
  where successor_qr_code_id is not null;

alter table public.qr_code_lifecycle_events enable row level security;

revoke all on table public.qr_code_lifecycle_events
  from public, anon, authenticated;

grant select on table public.qr_code_lifecycle_events to service_role;

create unique index if not exists qr_codes_canonical_slot_key
  on public.qr_codes (restaurant_id, target_kind, purpose_key)
  where is_canonical = true;

do $$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_indexdef(index_row.indexrelid)
  into v_definition
  from pg_catalog.pg_index as index_row
  where index_row.indexrelid = 'public.qr_codes_canonical_slot_key'::pg_catalog.regclass;

  if v_definition is null
    or v_definition !~ '^CREATE UNIQUE INDEX qr_codes_canonical_slot_key ON public[.]qr_codes USING btree [(]restaurant_id, target_kind, purpose_key[)] WHERE [(]is_canonical = true[)]$'
  then
    raise exception 'qr_codes_canonical_slot_key has an incompatible definition';
  end if;
end;
$$;

-- Rotation is a lifecycle event, not an edit to the historical QR. Preserve
-- updated_at when is_canonical is the only changed field.
create or replace function public.set_qr_codes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    pg_catalog.to_jsonb(new) - array['is_canonical', 'rotated_at', 'updated_at']
  ) is not distinct from (
    pg_catalog.to_jsonb(old) - array['is_canonical', 'rotated_at', 'updated_at']
  ) then
    new.updated_at = old.updated_at;
  else
    new.updated_at = pg_catalog.now();
  end if;
  return new;
end;
$$;

create or replace function public.enforce_qr_code_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_predecessor public.qr_codes%rowtype;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'revoked'
      and (
        new.status <> 'revoked'
        or new.revoked_at is distinct from old.revoked_at
      )
    then
      raise exception using
        errcode = '55000',
        message = 'revoked QR lifecycle is irreversible';
    end if;

    if new.supersedes_qr_code_id is distinct from old.supersedes_qr_code_id then
      raise exception using
        errcode = '55000',
        message = 'QR lineage is immutable';
    end if;
  end if;

  if new.supersedes_qr_code_id is not null then
    select qr.*
    into v_predecessor
    from public.qr_codes as qr
    where qr.id = new.supersedes_qr_code_id;

    if not found
      or v_predecessor.restaurant_id is distinct from new.restaurant_id
      or v_predecessor.target_kind is distinct from new.target_kind
      or v_predecessor.purpose_key is distinct from new.purpose_key
    then
      raise exception using
        errcode = '23514',
        message = 'QR lineage predecessor must belong to the same canonical slot';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists qr_codes_enforce_lifecycle on public.qr_codes;
create trigger qr_codes_enforce_lifecycle
  before insert or update on public.qr_codes
  for each row
  execute function public.enforce_qr_code_lifecycle();

create or replace function public.qr_sha256(p_value text)
returns text
language plpgsql
stable
strict
set search_path = ''
as $$
declare
  v_extension_schema text;
  v_result text;
begin
  select namespace.nspname into v_extension_schema
  from pg_catalog.pg_extension as extension
  join pg_catalog.pg_namespace as namespace on namespace.oid = extension.extnamespace
  where extension.extname = 'pgcrypto';

  if v_extension_schema is null then
    raise exception using errcode = '55000', message = 'pgcrypto extension is required';
  end if;

  execute pg_catalog.format(
    'select pg_catalog.encode(%I.digest(pg_catalog.convert_to($1, ''UTF8''), ''sha256''), ''hex'')',
    v_extension_schema
  ) into v_result using p_value;
  return v_result;
end;
$$;

create or replace function public.owner_get_or_create_canonical_qr(
  p_id uuid,
  p_restaurant_id uuid,
  p_label text,
  p_target_kind text,
  p_purpose_key text,
  p_target_path text,
  p_token_hash text,
  p_token_preview text,
  p_token_ciphertext text,
  p_token_nonce text,
  p_token_key_version text,
  p_style_json jsonb
)
returns table (
  result_status text,
  created boolean,
  id uuid,
  restaurant_id uuid,
  label text,
  target_kind text,
  purpose_key text,
  target_path text,
  token_hash text,
  token_preview text,
  token_ciphertext text,
  token_nonce text,
  token_key_version text,
  style_json jsonb,
  status text,
  scan_count integer,
  last_scanned_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_target_kind text := pg_catalog.lower(pg_catalog.btrim(p_target_kind));
  v_purpose_key text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_purpose_key, 'default'))
  );
  v_current public.qr_codes%rowtype;
  v_inserted_count integer := 0;
begin
  if p_id is null or p_restaurant_id is null then
    raise exception using
      errcode = '22023',
      message = 'canonical QR id and restaurant_id are required';
  end if;
  if v_target_kind is null or v_target_kind not in ('menu', 'admin') then
    raise exception using
      errcode = '22023',
      message = 'canonical QR target_kind must be menu or admin';
  end if;
  if v_purpose_key = '' then
    raise exception using
      errcode = '22023',
      message = 'canonical QR purpose_key must not be empty';
  end if;
  if p_label is null or pg_catalog.btrim(p_label) = ''
    or p_target_path is null or pg_catalog.btrim(p_target_path) = ''
    or p_token_hash is null or pg_catalog.btrim(p_token_hash) = ''
    or p_token_preview is null
    or p_style_json is null
  then
    raise exception using
      errcode = '22023',
      message = 'canonical QR candidate is incomplete';
  end if;
  if p_token_ciphertext is null
    or p_token_nonce is null
    or p_token_key_version is null
    or pg_catalog.btrim(p_token_ciphertext) = ''
    or pg_catalog.btrim(p_token_nonce) = ''
    or pg_catalog.btrim(p_token_key_version) = ''
  then
    raise exception using
      errcode = '22023',
      message = 'canonical QR vault envelope must be complete';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || ':' || v_target_kind || ':' || v_purpose_key,
      0
    )
  );

  select qr.*
  into v_current
  from public.qr_codes as qr
  where qr.restaurant_id = p_restaurant_id
    and qr.target_kind = v_target_kind
    and qr.purpose_key = v_purpose_key
    and qr.is_canonical = true;

  if found then
    return query
    select
      case
        when v_current.token_ciphertext is null
          or v_current.token_nonce is null
          or v_current.token_key_version is null
          or pg_catalog.btrim(v_current.token_ciphertext) = ''
          or pg_catalog.btrim(v_current.token_nonce) = ''
          or pg_catalog.btrim(v_current.token_key_version) = ''
        then 'canonical-unrecoverable'
        else 'canonical'
      end,
      false,
      v_current.id,
      v_current.restaurant_id,
      v_current.label,
      v_current.target_kind,
      v_current.purpose_key,
      v_current.target_path,
      v_current.token_hash,
      v_current.token_preview,
      v_current.token_ciphertext,
      v_current.token_nonce,
      v_current.token_key_version,
      v_current.style_json,
      v_current.status,
      v_current.scan_count,
      v_current.last_scanned_at,
      v_current.created_at,
      v_current.updated_at;
    return;
  end if;

  insert into public.qr_codes (
    id,
    restaurant_id,
    label,
    target_kind,
    purpose_key,
    target_path,
    token_hash,
    token_preview,
    token_ciphertext,
    token_nonce,
    token_key_version,
    style_json,
    status,
    is_canonical
  )
  values (
    p_id,
    p_restaurant_id,
    pg_catalog.btrim(p_label),
    v_target_kind,
    v_purpose_key,
    p_target_path,
    p_token_hash,
    p_token_preview,
    p_token_ciphertext,
    p_token_nonce,
    p_token_key_version,
    p_style_json,
    'active',
    true
  )
  on conflict (restaurant_id, target_kind, purpose_key)
    where is_canonical = true
    do nothing
  returning * into v_current;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    select qr.*
    into v_current
    from public.qr_codes as qr
    where qr.restaurant_id = p_restaurant_id
      and qr.target_kind = v_target_kind
      and qr.purpose_key = v_purpose_key
      and qr.is_canonical = true;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'canonical QR slot conflict has no readable winner';
    end if;
  end if;

  return query
  select
    case
      when v_current.token_ciphertext is null
        or v_current.token_nonce is null
        or v_current.token_key_version is null
        or pg_catalog.btrim(v_current.token_ciphertext) = ''
        or pg_catalog.btrim(v_current.token_nonce) = ''
        or pg_catalog.btrim(v_current.token_key_version) = ''
      then 'canonical-unrecoverable'
      else 'canonical'
    end,
    v_inserted_count = 1,
    v_current.id,
    v_current.restaurant_id,
    v_current.label,
    v_current.target_kind,
    v_current.purpose_key,
    v_current.target_path,
    v_current.token_hash,
    v_current.token_preview,
    v_current.token_ciphertext,
    v_current.token_nonce,
    v_current.token_key_version,
    v_current.style_json,
    v_current.status,
    v_current.scan_count,
    v_current.last_scanned_at,
    v_current.created_at,
    v_current.updated_at;
end;
$$;

create or replace function public.owner_rotate_canonical_qr(
  p_previous_id uuid,
  p_new_id uuid,
  p_restaurant_id uuid,
  p_target_kind text,
  p_purpose_key text,
  p_label text,
  p_target_path text,
  p_token_hash text,
  p_token_preview text,
  p_token_ciphertext text,
  p_token_nonce text,
  p_token_key_version text,
  p_style_json jsonb,
  p_confirm boolean
)
returns table (
  result_status text,
  created boolean,
  id uuid,
  restaurant_id uuid,
  label text,
  target_kind text,
  purpose_key text,
  target_path text,
  token_hash text,
  token_preview text,
  token_ciphertext text,
  token_nonce text,
  token_key_version text,
  style_json jsonb,
  status text,
  scan_count integer,
  last_scanned_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_kind text := pg_catalog.lower(pg_catalog.btrim(p_target_kind));
  v_purpose_key text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_purpose_key, 'default'))
  );
  v_previous public.qr_codes%rowtype;
  v_current public.qr_codes%rowtype;
begin
  if p_confirm is distinct from true then
    raise exception using
      errcode = '22023',
      message = 'canonical QR rotation requires explicit confirmation';
  end if;
  if p_previous_id is null or p_new_id is null or p_restaurant_id is null then
    raise exception using
      errcode = '22023',
      message = 'canonical QR rotation ids and restaurant_id are required';
  end if;
  if p_previous_id = p_new_id then
    raise exception using
      errcode = '22023',
      message = 'canonical QR rotation requires a new id';
  end if;
  if v_target_kind is null
    or v_target_kind not in ('menu', 'admin')
    or v_purpose_key = ''
  then
    raise exception using
      errcode = '22023',
      message = 'canonical QR rotation slot is invalid';
  end if;
  if p_label is null or pg_catalog.btrim(p_label) = ''
    or p_target_path is null or pg_catalog.btrim(p_target_path) = ''
    or p_token_hash is null or pg_catalog.btrim(p_token_hash) = ''
    or p_token_preview is null
    or p_style_json is null
    or p_token_ciphertext is null
    or p_token_nonce is null
    or p_token_key_version is null
    or pg_catalog.btrim(p_token_ciphertext) = ''
    or pg_catalog.btrim(p_token_nonce) = ''
    or pg_catalog.btrim(p_token_key_version) = ''
  then
    raise exception using
      errcode = '22023',
      message = 'canonical QR rotation candidate and vault envelope must be complete';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || ':' || v_target_kind || ':' || v_purpose_key,
      0
    )
  );

  select qr.*
  into v_previous
  from public.qr_codes as qr
  where qr.id = p_previous_id
    and qr.restaurant_id = p_restaurant_id
    and qr.target_kind = v_target_kind
    and qr.purpose_key = v_purpose_key
    and qr.is_canonical = true
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'canonical QR to rotate was not found';
  end if;

  update public.qr_codes as qr
  set
    is_canonical = false,
    rotated_at = pg_catalog.now()
  where qr.id = p_previous_id
    and qr.restaurant_id = p_restaurant_id
    and qr.target_kind = v_target_kind
    and qr.purpose_key = v_purpose_key
    and qr.is_canonical = true;

  insert into public.qr_codes (
    id,
    restaurant_id,
    label,
    target_kind,
    purpose_key,
    target_path,
    token_hash,
    token_preview,
    token_ciphertext,
    token_nonce,
    token_key_version,
    style_json,
    status,
    is_canonical,
    supersedes_qr_code_id
  )
  values (
    p_new_id,
    p_restaurant_id,
    v_previous.label,
    v_target_kind,
    v_purpose_key,
    v_previous.target_path,
    p_token_hash,
    p_token_preview,
    p_token_ciphertext,
    p_token_nonce,
    p_token_key_version,
    v_previous.style_json,
    'active',
    true,
    p_previous_id
  )
  returning * into v_current;

  return query
  select
    'previous',
    false,
    v_previous.id,
    v_previous.restaurant_id,
    v_previous.label,
    v_previous.target_kind,
    v_previous.purpose_key,
    v_previous.target_path,
    v_previous.token_hash,
    v_previous.token_preview,
    v_previous.token_ciphertext,
    v_previous.token_nonce,
    v_previous.token_key_version,
    v_previous.style_json,
    v_previous.status,
    v_previous.scan_count,
    v_previous.last_scanned_at,
    v_previous.created_at,
    v_previous.updated_at;

  return query
  select
    'canonical',
    true,
    v_current.id,
    v_current.restaurant_id,
    v_current.label,
    v_current.target_kind,
    v_current.purpose_key,
    v_current.target_path,
    v_current.token_hash,
    v_current.token_preview,
    v_current.token_ciphertext,
    v_current.token_nonce,
    v_current.token_key_version,
    v_current.style_json,
    v_current.status,
    v_current.scan_count,
    v_current.last_scanned_at,
    v_current.created_at,
    v_current.updated_at;
end;
$$;

drop function if exists public.owner_rotate_canonical_qr(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean
);

create or replace function public.owner_rotate_canonical_qr(
  p_previous_id uuid,
  p_new_id uuid,
  p_restaurant_id uuid,
  p_target_kind text,
  p_purpose_key text,
  p_label text,
  p_target_path text,
  p_token_hash text,
  p_token_preview text,
  p_token_ciphertext text,
  p_token_nonce text,
  p_token_key_version text,
  p_style_json jsonb,
  p_confirm boolean,
  p_disposition text,
  p_rotation_request_id uuid,
  p_expected_config_version integer
)
returns table (
  result_status text,
  created boolean,
  id uuid,
  status text,
  is_canonical boolean,
  revoked_at timestamptz,
  config_version integer,
  supersedes_qr_code_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_target_kind text := pg_catalog.lower(pg_catalog.btrim(p_target_kind));
  v_purpose_key text := pg_catalog.lower(pg_catalog.btrim(p_purpose_key));
  v_disposition text := pg_catalog.lower(pg_catalog.btrim(p_disposition));
  v_previous public.qr_codes%rowtype;
  v_current public.qr_codes%rowtype;
  v_event public.qr_code_lifecycle_events%rowtype;
  v_previous_status text;
  v_request_fingerprint text;
begin
  if p_confirm is distinct from true
    or p_previous_id is null or p_new_id is null or p_previous_id = p_new_id
    or p_restaurant_id is null or p_rotation_request_id is null
    or p_expected_config_version is null or p_expected_config_version < 1
  then
    raise exception using errcode = '22023', message = 'explicit QR rotation identity, confirmation and version are required';
  end if;
  if v_target_kind not in ('menu', 'admin')
    or v_purpose_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
    or v_disposition not in ('keep-active', 'pause', 'revoke')
  then
    raise exception using errcode = '22023', message = 'QR rotation slot or disposition is invalid';
  end if;
  if p_label is null or pg_catalog.btrim(p_label) = ''
    or p_target_path is null or pg_catalog.btrim(p_target_path) = ''
    or p_token_hash is null or pg_catalog.btrim(p_token_hash) = ''
    or p_token_preview is null or p_style_json is null
    or p_token_ciphertext is null or pg_catalog.btrim(p_token_ciphertext) = ''
    or p_token_nonce is null or pg_catalog.btrim(p_token_nonce) = ''
    or p_token_key_version is null or pg_catalog.btrim(p_token_key_version) = ''
  then
    raise exception using errcode = '22023', message = 'QR rotation payload is incomplete';
  end if;

  v_request_fingerprint := public.qr_sha256(
    pg_catalog.jsonb_build_array(
      p_previous_id, p_new_id, p_restaurant_id, v_target_kind, v_purpose_key,
      pg_catalog.btrim(p_label), p_target_path, p_token_hash, p_token_preview,
      p_token_ciphertext, p_token_nonce, p_token_key_version, p_style_json,
      p_confirm, v_disposition, p_expected_config_version
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || ':' || v_target_kind || ':' || v_purpose_key,
      0
    )
  );

  select event.* into v_event
  from public.qr_code_lifecycle_events as event
  where event.operation_id = p_rotation_request_id;
  if found then
    if v_event.action <> 'rotate'
      or v_event.request_fingerprint is distinct from v_request_fingerprint
    then
      raise exception using errcode = '22023', message = 'QR rotation request id was reused with a different payload';
    end if;
    return query select 'previous', false, v_event.qr_code_id, v_event.new_status,
      false, case when v_event.new_status = 'revoked' then v_event.occurred_at else null end,
      v_event.new_config_version, null::uuid;
    return query select 'canonical', false, v_event.successor_qr_code_id, 'active',
      true, null::timestamptz, v_event.new_config_version, v_event.qr_code_id;
    return;
  end if;

  select qr.* into v_previous
  from public.qr_codes as qr
  where qr.id = p_previous_id
    and qr.restaurant_id = p_restaurant_id
    and qr.target_kind = v_target_kind
    and qr.purpose_key = v_purpose_key
    and qr.is_canonical = true
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'canonical QR to rotate was not found';
  end if;
  if v_previous.status not in ('active', 'paused') then
    raise exception using errcode = '55000', message = 'canonical QR state cannot be rotated';
  end if;
  if v_previous.config_version <> p_expected_config_version then
    raise exception using errcode = '40001', message = 'stale QR config_version';
  end if;

  v_previous_status := v_previous.status;

  update public.qr_codes as qr
  set
    is_canonical = false,
    rotated_at = pg_catalog.now(),
    status = case v_disposition
      when 'keep-active' then 'active'
      when 'pause' then 'paused'
      when 'revoke' then 'revoked'
    end,
    revoked_at = case when v_disposition = 'revoke' then pg_catalog.now() else null end,
    config_version = qr.config_version + 1
  where qr.id = p_previous_id
  returning qr.* into v_previous;

  insert into public.qr_codes (
    id, restaurant_id, label, target_kind, purpose_key, target_path,
    token_hash, token_preview, token_ciphertext, token_nonce,
    token_key_version, style_json, status, is_canonical,
    supersedes_qr_code_id, config_version
  ) values (
    p_new_id, p_restaurant_id, pg_catalog.btrim(p_label), v_target_kind,
    v_purpose_key, p_target_path, p_token_hash, p_token_preview,
    p_token_ciphertext, p_token_nonce, p_token_key_version, p_style_json,
    'active', true, p_previous_id, p_expected_config_version + 1
  ) returning * into v_current;

  insert into public.qr_code_lifecycle_events (
    operation_id, restaurant_id, qr_code_id, successor_qr_code_id,
    action, disposition, previous_status, new_status, request_fingerprint,
    previous_config_version, new_config_version
  ) values (
    p_rotation_request_id, p_restaurant_id, p_previous_id, p_new_id,
    'rotate', v_disposition, v_previous_status, v_previous.status, v_request_fingerprint,
    p_expected_config_version, v_previous.config_version
  );

  return query select 'previous', false, v_previous.id, v_previous.status,
    v_previous.is_canonical, v_previous.revoked_at, v_previous.config_version,
    v_previous.supersedes_qr_code_id;
  return query select 'canonical', true, v_current.id, v_current.status,
    v_current.is_canonical, v_current.revoked_at, v_current.config_version,
    v_current.supersedes_qr_code_id;
end;
$$;

create or replace function public.owner_set_canonical_qr_lifecycle(
  p_qr_code_id uuid,
  p_restaurant_id uuid,
  p_action text,
  p_expected_config_version integer,
  p_operation_id uuid
)
returns table (
  result_status text,
  id uuid,
  status text,
  is_canonical boolean,
  revoked_at timestamptz,
  config_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(p_action));
  v_slot public.qr_codes%rowtype;
  v_current public.qr_codes%rowtype;
  v_event public.qr_code_lifecycle_events%rowtype;
begin
  if p_qr_code_id is null or p_restaurant_id is null
    or p_operation_id is null or p_expected_config_version is null
    or p_expected_config_version < 1
  then
    raise exception using errcode = '22023', message = 'QR lifecycle identity and version are required';
  end if;
  if v_action not in ('pause', 'resume', 'revoke') then
    raise exception using errcode = '22023', message = 'QR lifecycle action is invalid';
  end if;

  select qr.* into v_slot
  from public.qr_codes as qr
  where qr.id = p_qr_code_id and qr.restaurant_id = p_restaurant_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'canonical QR was not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || ':' || v_slot.target_kind || ':' || v_slot.purpose_key,
      0
    )
  );

  select event.* into v_event
  from public.qr_code_lifecycle_events as event
  where event.operation_id = p_operation_id;
  if found then
    if v_event.qr_code_id <> p_qr_code_id
      or v_event.restaurant_id <> p_restaurant_id
      or v_event.action <> v_action
      or v_event.previous_config_version <> p_expected_config_version
    then
      raise exception using errcode = '22023', message = 'QR lifecycle idempotency key was reused';
    end if;
    select qr.* into v_current from public.qr_codes as qr where qr.id = p_qr_code_id;
    return query select 'idempotent', v_current.id, v_current.status,
      v_current.is_canonical, v_current.revoked_at, v_current.config_version;
    return;
  end if;

  select qr.* into v_current
  from public.qr_codes as qr
  where qr.id = p_qr_code_id
    and qr.restaurant_id = p_restaurant_id
    and qr.is_canonical = true
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'canonical QR was not found';
  end if;
  if v_current.config_version <> p_expected_config_version then
    raise exception using errcode = '40001', message = 'stale QR config_version';
  end if;
  if (v_action = 'pause' and v_current.status <> 'active')
    or (v_action = 'resume' and v_current.status <> 'paused')
    or (v_action = 'revoke' and v_current.status not in ('active', 'paused'))
  then
    raise exception using errcode = '55000', message = 'invalid QR lifecycle transition';
  end if;

  update public.qr_codes as qr
  set
    status = case v_action
      when 'pause' then 'paused'
      when 'resume' then 'active'
      else 'revoked'
    end,
    is_canonical = case when v_action = 'revoke' then false else true end,
    revoked_at = case when v_action = 'revoke' then pg_catalog.now() else null end,
    config_version = qr.config_version + 1
  where qr.id = p_qr_code_id
  returning qr.* into v_current;

  insert into public.qr_code_lifecycle_events (
    operation_id, restaurant_id, qr_code_id, action,
    previous_status, new_status, previous_config_version, new_config_version
  ) values (
    p_operation_id, p_restaurant_id, p_qr_code_id, v_action,
    v_slot.status, v_current.status, p_expected_config_version, v_current.config_version
  );

  return query select 'applied', v_current.id, v_current.status,
    v_current.is_canonical, v_current.revoked_at, v_current.config_version;
end;
$$;

create or replace function public.owner_clear_canonical_qr(
  p_qr_code_id uuid,
  p_restaurant_id uuid,
  p_disposition text,
  p_expected_config_version integer,
  p_operation_id uuid
)
returns table (
  result_status text,
  id uuid,
  status text,
  is_canonical boolean,
  revoked_at timestamptz,
  config_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_disposition text := pg_catalog.lower(pg_catalog.btrim(p_disposition));
  v_slot public.qr_codes%rowtype;
  v_current public.qr_codes%rowtype;
  v_event public.qr_code_lifecycle_events%rowtype;
begin
  if p_qr_code_id is null or p_restaurant_id is null
    or p_operation_id is null or p_expected_config_version is null
    or p_expected_config_version < 1
  then
    raise exception using errcode = '22023', message = 'QR clear identity and version are required';
  end if;
  if v_disposition not in ('archive', 'revoke') then
    raise exception using errcode = '22023', message = 'QR clear disposition is invalid';
  end if;

  select qr.* into v_slot from public.qr_codes as qr
  where qr.id = p_qr_code_id and qr.restaurant_id = p_restaurant_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'canonical QR was not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || ':' || v_slot.target_kind || ':' || v_slot.purpose_key,
      0
    )
  );

  select event.* into v_event from public.qr_code_lifecycle_events as event
  where event.operation_id = p_operation_id;
  if found then
    if v_event.qr_code_id <> p_qr_code_id
      or v_event.restaurant_id <> p_restaurant_id
      or v_event.action <> v_disposition
      or v_event.previous_config_version <> p_expected_config_version
    then
      raise exception using errcode = '22023', message = 'QR clear idempotency key was reused';
    end if;
    select qr.* into v_current from public.qr_codes as qr where qr.id = p_qr_code_id;
    return query select 'idempotent', v_current.id, v_current.status,
      v_current.is_canonical, v_current.revoked_at, v_current.config_version;
    return;
  end if;

  select qr.* into v_current from public.qr_codes as qr
  where qr.id = p_qr_code_id and qr.restaurant_id = p_restaurant_id
    and qr.is_canonical = true
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'canonical QR was not found';
  end if;
  if v_current.config_version <> p_expected_config_version then
    raise exception using errcode = '40001', message = 'stale QR config_version';
  end if;
  if v_current.status not in ('active', 'paused') then
    raise exception using errcode = '55000', message = 'invalid QR clear transition';
  end if;

  update public.qr_codes as qr
  set status = v_disposition,
      is_canonical = false,
      revoked_at = case when v_disposition = 'revoke' then pg_catalog.now() else null end,
      config_version = qr.config_version + 1
  where qr.id = p_qr_code_id
  returning qr.* into v_current;

  insert into public.qr_code_lifecycle_events (
    operation_id, restaurant_id, qr_code_id, action,
    previous_status, new_status, previous_config_version, new_config_version
  ) values (
    p_operation_id, p_restaurant_id, p_qr_code_id, v_disposition,
    v_slot.status, v_current.status, p_expected_config_version, v_current.config_version
  );

  return query select 'applied', v_current.id, v_current.status,
    v_current.is_canonical, v_current.revoked_at, v_current.config_version;
end;
$$;

create or replace function public.resolve_qr_code_scan_metadata(p_token_hash text)
returns table (
  qr_id uuid,
  restaurant_id uuid,
  target_kind text,
  target_path text,
  status text
)
language sql
security definer
set search_path = ''
as $$
  update public.qr_codes as qr
  set
    scan_count = qr.scan_count + 1,
    last_scanned_at = pg_catalog.now()
  where qr.token_hash = p_token_hash
    and qr.status = 'active'
    and (
      (
        qr.target_kind = 'menu'
        and (
          qr.target_path = '/demo'
          or qr.target_path like '/menu/%'
        )
      )
      or (
        qr.target_kind = 'admin'
        and qr.restaurant_id is not null
        and qr.target_path = '/admin'
      )
    )
  returning
    qr.id as qr_id,
    qr.restaurant_id,
    qr.target_kind,
    qr.target_path,
    qr.status;
$$;

create or replace function public.resolve_qr_code_scan(p_token_hash text)
returns text
language sql
security definer
set search_path = ''
as $$
  update public.qr_codes as qr
  set
    scan_count = qr.scan_count + 1,
    last_scanned_at = pg_catalog.now()
  where qr.token_hash = p_token_hash
    and qr.status = 'active'
    and (
      (qr.target_kind = 'menu' and (qr.target_path = '/demo' or qr.target_path like '/menu/%'))
      or (qr.target_kind = 'admin' and qr.restaurant_id is not null and qr.target_path = '/admin')
    )
  returning qr.target_path;
$$;

alter table public.qr_codes enable row level security;

revoke all on table public.qr_codes
  from public, anon, authenticated;

grant select, insert, update, delete on table public.qr_codes
  to service_role;

revoke all on function public.enforce_qr_code_lifecycle()
  from public, anon, authenticated;

revoke all on function public.qr_sha256(text)
  from public, anon, authenticated, service_role;

revoke execute on function public.owner_get_or_create_canonical_qr(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.owner_get_or_create_canonical_qr(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

revoke execute on function public.owner_rotate_canonical_qr(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, uuid, integer
) from public, anon, authenticated;

grant execute on function public.owner_rotate_canonical_qr(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, uuid, integer
) to service_role;

revoke execute on function public.owner_set_canonical_qr_lifecycle(
  uuid, uuid, text, integer, uuid
) from public, anon, authenticated;

grant execute on function public.owner_set_canonical_qr_lifecycle(
  uuid, uuid, text, integer, uuid
) to service_role;

revoke execute on function public.owner_clear_canonical_qr(
  uuid, uuid, text, integer, uuid
) from public, anon, authenticated;

grant execute on function public.owner_clear_canonical_qr(
  uuid, uuid, text, integer, uuid
) to service_role;

revoke execute on function public.resolve_qr_code_scan_metadata(text)
  from public, anon, authenticated;

grant execute on function public.resolve_qr_code_scan_metadata(text)
  to service_role;

revoke execute on function public.resolve_qr_code_scan(text)
  from public, anon, authenticated;

grant execute on function public.resolve_qr_code_scan(text)
  to service_role;

commit;
