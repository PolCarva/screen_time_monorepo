-- The pause offers only the ad (docs/ads-only-pause-plan.md).
--
-- 1. No limit on ads: an intent and its claim no longer look at a daily ad
--    count or at a wallet cap (D3, D5). The five waiting intents stay (D5).
-- 2. No saved passes and no daily pass limit: a visit is paid by the ad it
--    names, and a visit that names none is refused whatever the ledger holds
--    (D2, D4, D6). The ledger keeps the grant and spend of each ad as audit.
--
-- Signatures, grants and error codes are the ones published builds already
-- know, so they keep working against this database (plan §4).

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
  configured_provider text;
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

  select payload ->> 'rewardProvider' into configured_provider
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;

  if configured_provider is null or configured_provider = 'disabled' then
    raise exception 'rewards_disabled';
  end if;
  if p_provider <> 'admob' or configured_provider <> 'admob' then
    raise exception 'unsupported_reward_provider';
  end if;

  delete from public.reward_intents
  where user_id = p_user_id and state = 'intent' and expires_at <= now();

  -- Bounds intents that were signed and never watched, not ads watched.
  select count(*) into active_intent_count
  from public.reward_intents
  where user_id = p_user_id and state = 'intent' and expires_at > now();
  if active_intent_count >= 5 then
    raise exception 'pending_reward_intent_limit_reached';
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

-- Reward timing uses server-owned timestamps. p_earned_at remains in the
-- signature for API compatibility and audit input.
create or replace function public.claim_reward_intent(
  p_user_id uuid,
  p_intent_id uuid,
  p_client_event_id uuid,
  p_earned_at timestamptz
)
returns public.reward_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.reward_intents;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into intent
  from public.reward_intents
  where id = p_intent_id and user_id = p_user_id
  for update;

  if intent.id is null then raise exception 'reward_intent_not_found'; end if;
  if intent.expires_at <= now() then raise exception 'reward_intent_expired'; end if;
  if intent.state in ('provisional', 'verified') then return intent; end if;

  update public.reward_intents set
    state = 'provisional',
    client_event_id = p_client_event_id,
    earned_at = now(),
    updated_at = now()
  where id = p_intent_id
  returning * into intent;

  insert into public.token_ledger (
    user_id, device_id, entry_type, amount, reference_id, idempotency_key
  ) values (
    p_user_id, intent.device_id, 'reward_grant', 1, intent.id,
    'reward:' || p_client_event_id::text
  ) on conflict (idempotency_key) do nothing;

  return intent;
end;
$$;

-- The window is the one the user chose on the slider. A visit is paid by the
-- ad the pause just showed: it spends what that ad earned, and nothing when
-- the reward never became one. Without an ad there is nothing to pay with, so
-- no balance is ever spent.
create or replace function public.create_unlock_session(
  p_user_id uuid,
  p_client_session_id uuid,
  p_device_id uuid,
  p_source text,
  p_duration_seconds integer,
  p_app_category text,
  p_started_at timestamptz,
  p_reward_intent_id uuid default null
)
returns public.unlock_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.unlock_sessions;
  granted_duration integer;
  device_platform public.device_platform;
  restrictions_enabled boolean;
  reward_state public.reward_state;
  server_started_at timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into result from public.unlock_sessions
  where client_session_id = p_client_session_id and user_id = p_user_id;
  if result.id is not null then return result; end if;

  if p_source is distinct from 'rewarded' then
    raise exception 'invalid_unlock_source';
  end if;

  select platform into device_platform
  from public.devices
  where id = p_device_id and user_id = p_user_id;
  if device_platform is null then raise exception 'device_not_found'; end if;

  select
    case device_platform
      when 'ios' then (payload->>'iosRestrictionEnabled')::boolean
      when 'android' then (payload->>'androidRestrictionEnabled')::boolean
    end
  into restrictions_enabled
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;

  if restrictions_enabled is distinct from true then
    raise exception 'restrictions_disabled';
  end if;
  -- Saved passes are gone: a visit that names no ad has nothing to pay with.
  if p_reward_intent_id is null then
    raise exception 'insufficient_rewarded_balance';
  end if;
  granted_duration := greatest(60, least(coalesce(p_duration_seconds, 600), 86400));

  select state into reward_state
  from public.reward_intents
  where id = p_reward_intent_id and user_id = p_user_id;
  if reward_state in ('provisional', 'verified') then
    insert into public.token_ledger (
      user_id, device_id, entry_type, amount, reference_id, idempotency_key,
      metadata
    ) values (
      p_user_id, p_device_id, 'unlock_spend', -1, p_client_session_id,
      'unlock-reward:' || p_reward_intent_id::text,
      jsonb_build_object('rewardIntentId', p_reward_intent_id)
    ) on conflict (idempotency_key) do nothing;
  end if;

  insert into public.unlock_sessions (
    client_session_id, user_id, device_id, source, app_category,
    duration_seconds, started_at, ends_at
  ) values (
    p_client_session_id, p_user_id, p_device_id, 'rewarded', p_app_category,
    granted_duration, server_started_at,
    server_started_at + make_interval(secs => granted_duration)
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.claim_reward_intent(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz, uuid)
  from public, anon, authenticated;

grant execute on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)
  to service_role;
grant execute on function public.claim_reward_intent(uuid, uuid, uuid, timestamptz)
  to service_role;
grant execute on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz, uuid)
  to service_role;
