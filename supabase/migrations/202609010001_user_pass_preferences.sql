-- User-owned guardrails for rewarded passes. Operational remote config remains
-- the upper bound for ads and the kill switch for rewards/restrictions.
create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_pass_limit smallint not null check (daily_pass_limit between 1 and 20),
  unlock_duration_seconds integer not null check (
    unlock_duration_seconds in (600, 1200, 1800, 3600, 86400)
  ),
  max_rewarded_ads_per_utc_day smallint not null check (
    max_rewarded_ads_per_utc_day between 0 and 30
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

alter table public.unlock_sessions
  drop constraint if exists unlock_sessions_duration_seconds_check;
alter table public.unlock_sessions
  add constraint unlock_sessions_duration_seconds_check
  check (duration_seconds between 60 and 86400);

create or replace function public.create_reward_intent(
  p_id uuid,
  p_user_id uuid,
  p_device_id uuid,
  p_provider text,
  p_custom_data text,
  p_expires_at timestamptz,
  p_idempotency_key text
)
returns public.reward_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.reward_intents;
  max_balance integer;
  operational_max_daily integer;
  preferred_max_daily integer;
  max_daily integer;
  configured_provider text;
  daily_count integer;
  active_intent_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into result
  from public.reward_intents
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if result.id is not null then return result; end if;

  if not exists (
    select 1 from public.devices where id = p_device_id and user_id = p_user_id
  ) then
    raise exception 'device_not_found';
  end if;

  select
    (payload ->> 'maxRewardTokenBalance')::integer,
    (payload ->> 'maxRewardedAdsPerUtcDay')::integer,
    payload ->> 'rewardProvider'
  into max_balance, operational_max_daily, configured_provider
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;

  select max_rewarded_ads_per_utc_day into preferred_max_daily
  from public.user_preferences
  where user_id = p_user_id;

  max_daily := least(
    coalesce(operational_max_daily, 0),
    coalesce(preferred_max_daily, operational_max_daily, 0)
  );

  if configured_provider is null or configured_provider = 'disabled' then
    raise exception 'rewards_disabled';
  end if;
  if p_provider <> 'admob' or configured_provider <> 'admob' then
    raise exception 'unsupported_reward_provider';
  end if;
  if public.rewarded_balance(p_user_id) >= coalesce(max_balance, 0) then
    raise exception 'wallet_balance_cap_reached';
  end if;

  delete from public.reward_intents
  where user_id = p_user_id and state = 'intent' and expires_at <= now();

  select count(*) into active_intent_count
  from public.reward_intents
  where user_id = p_user_id and state = 'intent' and expires_at > now();
  if active_intent_count >= 3 then
    raise exception 'pending_reward_intent_limit_reached';
  end if;

  select count(*) into daily_count
  from public.reward_intents
  where user_id = p_user_id
    and state in ('provisional', 'verified')
    and earned_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if daily_count >= max_daily then
    raise exception 'daily_reward_limit_reached';
  end if;

  insert into public.reward_intents (
    id, user_id, device_id, provider, custom_data, expires_at, idempotency_key
  ) values (
    p_id, p_user_id, p_device_id, 'admob', p_custom_data, p_expires_at,
    p_idempotency_key
  )
  returning * into result;

  return result;
end;
$$;

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

revoke all on table public.user_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.user_preferences to service_role;

revoke all on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)
  to service_role;

revoke all on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz)
  to service_role;
