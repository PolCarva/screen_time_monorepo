create or replace function public.create_unlock_session(
  p_user_id uuid,
  p_client_session_id uuid,
  p_device_id uuid,
  p_source text,
  p_duration_seconds integer,
  p_app_category text,
  p_started_at timestamptz
)
returns public.unlock_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.unlock_sessions;
  emergencies_allowed integer;
  emergencies_used integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into result from public.unlock_sessions
  where client_session_id = p_client_session_id;
  if result.id is not null then return result; end if;

  if not exists (
    select 1 from public.devices where id = p_device_id and user_id = p_user_id
  ) then
    raise exception 'device_not_found';
  end if;

  if p_source = 'rewarded' then
    if public.rewarded_balance(p_user_id) < 1 then
      raise exception 'insufficient_rewarded_balance';
    end if;
    insert into public.token_ledger (
      user_id, device_id, entry_type, amount, reference_id, idempotency_key
    ) values (
      p_user_id, p_device_id, 'unlock_spend', -1, p_client_session_id,
      'unlock:' || p_client_session_id::text
    );
  elsif p_source = 'emergency' then
    select (payload->>'dailyEmergencyUnlocks')::integer
      into emergencies_allowed
      from public.remote_config_versions where is_active limit 1;
    select count(*) into emergencies_used
      from public.token_ledger
      where user_id = p_user_id
        and entry_type = 'emergency_spend'
        and created_at >= date_trunc('day', now());
    if emergencies_used >= coalesce(emergencies_allowed, 3) then
      raise exception 'daily_emergency_limit_reached';
    end if;
    insert into public.token_ledger (
      user_id, device_id, entry_type, amount, reference_id, idempotency_key
    ) values (
      p_user_id, p_device_id, 'emergency_spend', -1, p_client_session_id,
      'emergency:' || p_client_session_id::text
    );
  else
    raise exception 'invalid_unlock_source';
  end if;

  insert into public.unlock_sessions (
    client_session_id, user_id, device_id, source, app_category,
    duration_seconds, started_at, ends_at
  ) values (
    p_client_session_id, p_user_id, p_device_id, p_source, p_app_category,
    p_duration_seconds, p_started_at, p_started_at + make_interval(secs => p_duration_seconds)
  ) returning * into result;

  return result;
end;
$$;
