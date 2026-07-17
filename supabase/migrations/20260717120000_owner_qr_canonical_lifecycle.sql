begin;

alter table public.qr_codes
  add column if not exists purpose_key text;

alter table public.qr_codes
  add column if not exists is_canonical boolean not null default false;

alter table public.qr_codes
  add column if not exists token_ciphertext text;

alter table public.qr_codes
  add column if not exists token_nonce text;

alter table public.qr_codes
  add column if not exists token_key_version text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.qr_codes'::pg_catalog.regclass
      and conname = 'qr_codes_purpose_key_normalized_check'
  ) then
    alter table public.qr_codes
      add constraint qr_codes_purpose_key_normalized_check
      check (
        purpose_key is null
        or (
          purpose_key = pg_catalog.lower(pg_catalog.btrim(purpose_key))
          and purpose_key <> ''
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.qr_codes'::pg_catalog.regclass
      and conname = 'qr_codes_token_envelope_all_or_none_check'
  ) then
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
          and token_nonce is not null
          and token_key_version is not null
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.qr_codes'::pg_catalog.regclass
      and conname = 'qr_codes_canonical_slot_complete_check'
  ) then
    alter table public.qr_codes
      add constraint qr_codes_canonical_slot_complete_check
      check (
        not is_canonical
        or (restaurant_id is not null and purpose_key is not null)
      );
  end if;
end;
$$;

alter table public.qr_codes
  validate constraint qr_codes_purpose_key_normalized_check;

alter table public.qr_codes
  validate constraint qr_codes_token_envelope_all_or_none_check;

alter table public.qr_codes
  validate constraint qr_codes_canonical_slot_complete_check;

create unique index if not exists qr_codes_canonical_slot_key
  on public.qr_codes (restaurant_id, target_kind, purpose_key)
  where is_canonical = true;

-- Rotation is a lifecycle event, not an edit to the historical QR. Preserve
-- updated_at when is_canonical is the only changed field.
create or replace function public.set_qr_codes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    pg_catalog.to_jsonb(new) - array['is_canonical', 'updated_at']
  ) is not distinct from (
    pg_catalog.to_jsonb(old) - array['is_canonical', 'updated_at']
  ) then
    new.updated_at = old.updated_at;
  else
    new.updated_at = pg_catalog.now();
  end if;
  return new;
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
  set is_canonical = false
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
    is_canonical
  )
  values (
    p_new_id,
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
  returning * into v_current;

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

revoke execute on function public.owner_get_or_create_canonical_qr(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.owner_get_or_create_canonical_qr(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

revoke execute on function public.owner_rotate_canonical_qr(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean
) from public, anon, authenticated;

grant execute on function public.owner_rotate_canonical_qr(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean
) to service_role;

commit;
