-- All balance and business-rule functions are reached through the Next.js API.
-- Supabase's default function EXECUTE grant is intentionally removed so a client
-- cannot choose another user id when calling PostgREST directly.
revoke all on function public.register_device(uuid, uuid, public.device_platform, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.rewarded_balance(uuid) from public, anon, authenticated;
revoke all on function public.claim_reward_intent(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.cast_impact_vote(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.register_device(uuid, uuid, public.device_platform, text, text, text, text)
  to service_role;
grant execute on function public.rewarded_balance(uuid) to service_role;
grant execute on function public.claim_reward_intent(uuid, uuid, uuid, timestamptz) to service_role;
grant execute on function public.cast_impact_vote(uuid, uuid, uuid) to service_role;
grant execute on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz)
  to service_role;
grant execute on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)
  to service_role;

-- Reward timing and daily limits use server-owned timestamps. p_earned_at remains
-- in the signature for API compatibility and audit input, but cannot backdate a
-- reward into another UTC day.
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
  max_balance integer;
  max_daily integer;
  daily_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select * into intent
  from public.reward_intents
  where id = p_intent_id and user_id = p_user_id
  for update;

  if intent.id is null then raise exception 'reward_intent_not_found'; end if;
  if intent.expires_at <= now() then raise exception 'reward_intent_expired'; end if;
  if intent.state in ('provisional', 'verified') then return intent; end if;

  select
    (payload->>'maxRewardTokenBalance')::integer,
    (payload->>'maxRewardedAdsPerUtcDay')::integer
  into max_balance, max_daily
  from public.remote_config_versions where is_active limit 1;

  if public.rewarded_balance(p_user_id) >= coalesce(max_balance, 3) then
    raise exception 'wallet_balance_cap_reached';
  end if;

  select count(*) into daily_count
  from public.reward_intents
  where user_id = p_user_id
    and state in ('provisional', 'verified')
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  if daily_count >= coalesce(max_daily, 10) then
    raise exception 'daily_reward_limit_reached';
  end if;

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

revoke all on function public.claim_reward_intent(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_reward_intent(uuid, uuid, uuid, timestamptz) to service_role;

-- Unlock duration and timestamps are server-owned. The client supplies its
-- observed start only for wire compatibility; the ledger and session snapshot
-- always use the active validated configuration and the database clock.
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
  emergencies_allowed integer;
  emergencies_used integer;
  server_started_at timestamptz := now();
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

  select
    (payload->>'unlockDurationSeconds')::integer,
    (payload->>'dailyEmergencyUnlocks')::integer
  into configured_duration, emergencies_allowed
  from public.remote_config_versions where is_active limit 1;
  configured_duration := greatest(60, least(coalesce(configured_duration, 600), 3600));

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
    select count(*) into emergencies_used
    from public.token_ledger
    where user_id = p_user_id
      and entry_type = 'emergency_spend'
      and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
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

create or replace function public.require_impact_operator(p_admin_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = p_admin_user_id and role in ('admin', 'operator')
  ) then
    raise exception 'impact_operator_required';
  end if;
end;
$$;

create or replace function public.admin_open_impact_week(
  p_admin_user_id uuid,
  p_week_start date,
  p_week_end date,
  p_impact_percentage numeric,
  p_platform_percentage numeric,
  p_charity_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  week_id uuid;
  inserted_candidates integer;
begin
  perform public.require_impact_operator(p_admin_user_id);
  if cardinality(p_charity_ids) < 1 or cardinality(p_charity_ids) > 10 then
    raise exception 'invalid_candidate_count';
  end if;
  if exists (
    select 1 from public.impact_weeks
    where status in ('open', 'voting_closed', 'donation_pending')
  ) then
    raise exception 'active_impact_week_exists';
  end if;

  insert into public.impact_weeks (
    week_start, week_end, status, impact_percentage, platform_percentage,
    revenue_is_estimated, opened_at
  ) values (
    p_week_start, p_week_end, 'open', p_impact_percentage,
    p_platform_percentage, true, now()
  ) returning id into week_id;

  insert into public.impact_week_candidates (impact_week_id, charity_id, display_order)
  select week_id, requested.charity_id, requested.ordinality::smallint
  from unnest(p_charity_ids) with ordinality as requested(charity_id, ordinality)
  join public.charities on charities.id = requested.charity_id and charities.is_active;
  get diagnostics inserted_candidates = row_count;
  if inserted_candidates <> cardinality(p_charity_ids) then
    raise exception 'candidate_not_active';
  end if;

  insert into public.admin_audit_log (
    admin_user_id, action, entity_type, entity_id, payload
  ) values (
    p_admin_user_id, 'impact.week_opened', 'impact_week', week_id::text,
    jsonb_build_object(
      'impactPercentage', p_impact_percentage,
      'platformPercentage', p_platform_percentage
    )
  );
  return week_id;
end;
$$;

create or replace function public.admin_close_impact_voting(
  p_admin_user_id uuid,
  p_week_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_impact_operator(p_admin_user_id);
  update public.impact_weeks
  set status = 'voting_closed', voting_closed_at = now(), updated_at = now()
  where id = p_week_id and status = 'open';
  if not found then raise exception 'impact_week_not_open'; end if;
  insert into public.admin_audit_log (admin_user_id, action, entity_type, entity_id)
  values (p_admin_user_id, 'impact.voting_closed', 'impact_week', p_week_id::text);
end;
$$;

create or replace function public.admin_confirm_impact_revenue(
  p_admin_user_id uuid,
  p_week_id uuid,
  p_gross_revenue_minor bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_impact_operator(p_admin_user_id);
  if p_gross_revenue_minor < 0 then raise exception 'invalid_revenue'; end if;
  update public.impact_weeks
  set gross_revenue_minor = p_gross_revenue_minor,
      revenue_is_estimated = false,
      status = 'donation_pending',
      updated_at = now()
  where id = p_week_id and status = 'voting_closed';
  if not found then raise exception 'impact_week_not_voting_closed'; end if;
  insert into public.admin_audit_log (
    admin_user_id, action, entity_type, entity_id, payload
  ) values (
    p_admin_user_id, 'impact.revenue_confirmed', 'impact_week', p_week_id::text,
    jsonb_build_object('grossRevenueMinor', p_gross_revenue_minor)
  );
end;
$$;

create or replace function public.admin_record_impact_donation(
  p_admin_user_id uuid,
  p_week_id uuid,
  p_charity_id uuid,
  p_amount_minor bigint,
  p_proof_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  winner_id uuid;
begin
  perform public.require_impact_operator(p_admin_user_id);
  if p_amount_minor <= 0 or length(trim(p_proof_url)) = 0 then
    raise exception 'invalid_donation';
  end if;

  select candidate.charity_id into winner_id
  from public.impact_week_candidates candidate
  left join public.votes vote
    on vote.impact_week_id = candidate.impact_week_id
    and vote.charity_id = candidate.charity_id
  where candidate.impact_week_id = p_week_id
  group by candidate.charity_id, candidate.display_order
  order by count(vote.user_id) desc, candidate.display_order asc
  limit 1;
  if winner_id is null or winner_id <> p_charity_id then
    raise exception 'charity_is_not_week_winner';
  end if;
  if not exists (
    select 1 from public.impact_weeks
    where id = p_week_id and status = 'donation_pending'
  ) then
    raise exception 'impact_week_not_pending_donation';
  end if;

  insert into public.donations (
    impact_week_id, charity_id, amount_minor, donated_at, proof_url
  ) values (
    p_week_id, p_charity_id, p_amount_minor, now(), p_proof_url
  );
  update public.impact_weeks
  set status = 'donated', updated_at = now()
  where id = p_week_id;
  insert into public.admin_audit_log (
    admin_user_id, action, entity_type, entity_id, payload
  ) values (
    p_admin_user_id, 'impact.donation_recorded', 'impact_week', p_week_id::text,
    jsonb_build_object('charityId', p_charity_id, 'amountMinor', p_amount_minor)
  );
end;
$$;

revoke all on function public.require_impact_operator(uuid) from public, anon, authenticated;
revoke all on function public.admin_open_impact_week(uuid, date, date, numeric, numeric, uuid[])
  from public, anon, authenticated;
revoke all on function public.admin_close_impact_voting(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_confirm_impact_revenue(uuid, uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.admin_record_impact_donation(uuid, uuid, uuid, bigint, text)
  from public, anon, authenticated;

grant execute on function public.require_impact_operator(uuid) to service_role;
grant execute on function public.admin_open_impact_week(uuid, date, date, numeric, numeric, uuid[])
  to service_role;
grant execute on function public.admin_close_impact_voting(uuid, uuid) to service_role;
grant execute on function public.admin_confirm_impact_revenue(uuid, uuid, bigint) to service_role;
grant execute on function public.admin_record_impact_donation(uuid, uuid, uuid, bigint, text)
  to service_role;
