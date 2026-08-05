-- Public menu QR codes are permanent inventory. Keep the historical
-- implementations as private helpers and put the invariant at the RPC
-- boundary so service_role calls cannot bypass the TypeScript guard.

do $$
begin
  if pg_catalog.to_regprocedure(
       'public.owner_rotate_canonical_qr(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,uuid,integer)'
     ) is not null
     and pg_catalog.to_regprocedure(
       'public._owner_rotate_canonical_qr_unchecked(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,uuid,integer)'
     ) is null
  then
    execute 'alter function public.owner_rotate_canonical_qr(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,uuid,integer) rename to _owner_rotate_canonical_qr_unchecked';
  end if;

  if pg_catalog.to_regprocedure(
       'public.owner_set_canonical_qr_lifecycle(uuid,uuid,text,integer,uuid)'
     ) is not null
     and pg_catalog.to_regprocedure(
       'public._owner_set_canonical_qr_lifecycle_unchecked(uuid,uuid,text,integer,uuid)'
     ) is null
  then
    execute 'alter function public.owner_set_canonical_qr_lifecycle(uuid,uuid,text,integer,uuid) rename to _owner_set_canonical_qr_lifecycle_unchecked';
  end if;

  if pg_catalog.to_regprocedure(
       'public.owner_clear_canonical_qr(uuid,uuid,text,integer,uuid)'
     ) is not null
     and pg_catalog.to_regprocedure(
       'public._owner_clear_canonical_qr_unchecked(uuid,uuid,text,integer,uuid)'
     ) is null
  then
    execute 'alter function public.owner_clear_canonical_qr(uuid,uuid,text,integer,uuid) rename to _owner_clear_canonical_qr_unchecked';
  end if;
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
  v_previous public.qr_codes%rowtype;
  v_disposition text := pg_catalog.lower(pg_catalog.btrim(p_disposition));
begin
  if p_previous_id is null
    or p_new_id is null
    or p_restaurant_id is null
    or p_rotation_request_id is null
    or p_expected_config_version is null
    or p_expected_config_version < 1
  then
    raise exception using
      errcode = '22023',
      message = 'explicit QR rotation identity, confirmation and version are required';
  end if;
  if p_confirm is distinct from true then
    raise exception using
      errcode = '22023',
      message = 'explicit QR rotation identity, confirmation and version are required';
  end if;
  if v_disposition is null
    or v_disposition not in ('keep-active', 'pause', 'revoke')
  then
    raise exception using
      errcode = '22023',
      message = 'QR rotation slot or disposition is invalid';
  end if;

  -- The row is locked before the policy decision. p_target_kind is only a
  -- lookup hint; the stored target_kind is authoritative.
  select qr.*
  into v_previous
  from public.qr_codes as qr
  where qr.id = p_previous_id
    and qr.restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'canonical QR to rotate was not found';
  end if;
  if v_previous.target_kind = 'menu'
    and v_disposition <> 'keep-active'
  then
    raise exception using
      errcode = 'P0001',
      message = 'public_qr_permanent';
  end if;

  return query
  select *
  from public._owner_rotate_canonical_qr_unchecked(
    p_previous_id,
    p_new_id,
    p_restaurant_id,
    p_target_kind,
    p_purpose_key,
    p_label,
    p_target_path,
    p_token_hash,
    p_token_preview,
    p_token_ciphertext,
    p_token_nonce,
    p_token_key_version,
    p_style_json,
    p_confirm,
    p_disposition,
    p_rotation_request_id,
    p_expected_config_version
  );
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
  v_current public.qr_codes%rowtype;
  v_action text := pg_catalog.lower(pg_catalog.btrim(p_action));
begin
  if p_qr_code_id is null
    or p_restaurant_id is null
    or p_operation_id is null
    or p_expected_config_version is null
    or p_expected_config_version < 1
  then
    raise exception using
      errcode = '22023',
      message = 'QR lifecycle identity and version are required';
  end if;
  if v_action is null
    or v_action not in ('pause', 'resume', 'revoke')
  then
    raise exception using
      errcode = '22023',
      message = 'QR lifecycle action is invalid';
  end if;

  select qr.*
  into v_current
  from public.qr_codes as qr
  where qr.id = p_qr_code_id
    and qr.restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'canonical QR was not found';
  end if;
  if v_current.target_kind = 'menu'
    and v_action in ('pause', 'revoke')
  then
    raise exception using
      errcode = 'P0001',
      message = 'public_qr_permanent';
  end if;

  return query
  select *
  from public._owner_set_canonical_qr_lifecycle_unchecked(
    p_qr_code_id,
    p_restaurant_id,
    p_action,
    p_expected_config_version,
    p_operation_id
  );
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
  v_current public.qr_codes%rowtype;
  v_disposition text := pg_catalog.lower(pg_catalog.btrim(p_disposition));
begin
  if p_qr_code_id is null
    or p_restaurant_id is null
    or p_operation_id is null
    or p_expected_config_version is null
    or p_expected_config_version < 1
  then
    raise exception using
      errcode = '22023',
      message = 'QR clear identity and version are required';
  end if;
  if v_disposition is null
    or v_disposition not in ('archive', 'revoke')
  then
    raise exception using
      errcode = '22023',
      message = 'QR clear disposition is invalid';
  end if;

  select qr.*
  into v_current
  from public.qr_codes as qr
  where qr.id = p_qr_code_id
    and qr.restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'canonical QR was not found';
  end if;
  if v_current.target_kind = 'menu' then
    raise exception using
      errcode = 'P0001',
      message = 'public_qr_permanent';
  end if;

  return query
  select *
  from public._owner_clear_canonical_qr_unchecked(
    p_qr_code_id,
    p_restaurant_id,
    p_disposition,
    p_expected_config_version,
    p_operation_id
  );
end;
$$;

revoke execute on function public._owner_rotate_canonical_qr_unchecked(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text,
  jsonb, boolean, text, uuid, integer
) from public, anon, authenticated, service_role;
revoke execute on function public._owner_set_canonical_qr_lifecycle_unchecked(
  uuid, uuid, text, integer, uuid
) from public, anon, authenticated, service_role;
revoke execute on function public._owner_clear_canonical_qr_unchecked(
  uuid, uuid, text, integer, uuid
) from public, anon, authenticated, service_role;

revoke execute on function public.owner_rotate_canonical_qr(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text,
  jsonb, boolean, text, uuid, integer
) from public, anon, authenticated;
grant execute on function public.owner_rotate_canonical_qr(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text,
  jsonb, boolean, text, uuid, integer
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
