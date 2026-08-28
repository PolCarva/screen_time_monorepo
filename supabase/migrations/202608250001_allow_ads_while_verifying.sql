-- Verification is asynchronous and must not make rewarded ads unavailable.
-- Keep the wallet and daily limits, which ensure each shown ad can still earn
-- a token, but do not gate a new intent on earlier SSV callbacks.
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
  max_daily integer;
  configured_provider text;
  daily_count integer;
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
  into max_balance, max_daily, configured_provider
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;

  if coalesce(configured_provider, 'admob') = 'disabled' then
    raise exception 'rewards_disabled';
  end if;
  if p_provider not in ('admob', 'house') then
    raise exception 'unsupported_reward_provider';
  end if;
  if public.rewarded_balance(p_user_id) >= coalesce(max_balance, 3) then
    raise exception 'wallet_balance_cap_reached';
  end if;

  select count(*) into daily_count
  from public.reward_intents
  where user_id = p_user_id
    and state in ('provisional', 'verified')
    and earned_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if daily_count >= coalesce(max_daily, 10) then
    raise exception 'daily_reward_limit_reached';
  end if;

  insert into public.reward_intents (
    id, user_id, device_id, provider, custom_data, expires_at, idempotency_key
  ) values (
    p_id, p_user_id, p_device_id, p_provider::public.reward_provider, p_custom_data, p_expires_at,
    p_idempotency_key
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text) from public;
grant execute on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text) to service_role;
