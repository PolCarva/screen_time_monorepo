-- Qualify preference columns so PL/pgSQL does not confuse them with local
-- variables in create_unlock_session. This follows the initial migration so
-- already-migrated development databases receive the corrected function too.
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
  configured_duration integer;
  preferred_duration integer;
  emergencies_allowed integer;
  emergencies_used integer;
  default_daily_pass_limit integer;
  preferred_daily_pass_limit integer;
  daily_pass_limit integer;
  rewarded_used integer;
  device_platform public.device_platform;
  restrictions_enabled boolean;
  server_started_at timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into result from public.unlock_sessions
  where client_session_id = p_client_session_id and user_id = p_user_id;
  if result.id is not null then return result; end if;

  select platform into device_platform
  from public.devices
  where id = p_device_id and user_id = p_user_id;
  if device_platform is null then raise exception 'device_not_found'; end if;

  select
    (payload->>'unlockDurationSeconds')::integer,
    (payload->>'dailyEmergencyUnlocks')::integer,
    greatest(1, least((payload->>'maxRewardTokenBalance')::integer, 20)),
    case device_platform
      when 'ios' then (payload->>'iosRestrictionEnabled')::boolean
      when 'android' then (payload->>'androidRestrictionEnabled')::boolean
    end
  into configured_duration, emergencies_allowed, default_daily_pass_limit,
    restrictions_enabled
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;

  select preferences.daily_pass_limit, preferences.unlock_duration_seconds
  into preferred_daily_pass_limit, preferred_duration
  from public.user_preferences as preferences
  where preferences.user_id = p_user_id;

  if restrictions_enabled is distinct from true then
    raise exception 'restrictions_disabled';
  end if;
  configured_duration := greatest(
    60,
    least(coalesce(preferred_duration, configured_duration, 600), 86400)
  );
  daily_pass_limit := coalesce(
    preferred_daily_pass_limit,
    default_daily_pass_limit,
    1
  );

  if p_source = 'rewarded' then
    select count(*) into rewarded_used
    from public.unlock_sessions
    where user_id = p_user_id
      and source = 'rewarded'
      and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
    if rewarded_used >= daily_pass_limit then
      raise exception 'daily_pass_limit_reached';
    end if;
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
    select count(*) into emergencies_used
    from public.token_ledger
    where user_id = p_user_id
      and entry_type = 'emergency_spend'
      and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
    if emergencies_used >= coalesce(emergencies_allowed, 0) then
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
    configured_duration, server_started_at,
    server_started_at + make_interval(secs => configured_duration)
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz)
  to service_role;
