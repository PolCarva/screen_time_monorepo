-- Real impact numbers and a single kind of pass (docs/real-impact-stats-plan.md).
--
-- 1. Emergency access is gone. A pass is earned with an ad and is the only way
--    in without watching one (D1, D2). The server records the window the user
--    chose on the slider (D12).
-- 2. Every rewarded ad AdMob confirms (SSV) becomes an ad_views row with what
--    it is estimated to have earned (D4, D5).
-- 3. The weekly fund, ads, people and time returned are computed from those
--    rows, the AdMob reports and the uploaded days (D6-D8).
-- 4. The current week opens by itself (D9).
-- 5. Reward intents live 24 hours and up to five can wait, so the Android
--    shield almost always has one to attach (D10).

-- AdMob's reporting API only accepts America/Los_Angeles, so every revenue day
-- in Still uses that calendar: the report days, the ads and the weeks.
create or replace function public.admob_report_date(p_at timestamptz)
returns date
language sql
stable
as $$
  select (p_at at time zone 'America/Los_Angeles')::date;
$$;

-- Revenue in micros: a beta day earns fractions of a cent, and rounding each
-- day to cents would erase it.
alter table public.revenue_daily
  add column if not exists gross_revenue_micros bigint
  check (gross_revenue_micros is null or gross_revenue_micros >= 0);
update public.revenue_daily
set gross_revenue_micros = gross_revenue_minor * 10000
where gross_revenue_micros is null;

create index if not exists wellbeing_daily_date_idx
  on public.wellbeing_daily (date);

-- One row per rewarded ad AdMob confirmed. It keeps counting after an account
-- is deleted (user_id becomes null), like the pseudonymized ledger: the ad was
-- watched and paid for either way.
create table public.ad_views (
  id uuid primary key default gen_random_uuid(),
  reward_intent_id uuid unique references public.reward_intents(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  platform public.device_platform,
  ssv_transaction_id text unique,
  ad_unit text,
  viewed_at timestamptz not null,
  report_date date not null,
  verified_at timestamptz,
  paid_value_micros bigint
    check (paid_value_micros is null or paid_value_micros >= 0),
  paid_currency text
    check (paid_currency is null or paid_currency ~ '^[A-Z]{3}$'),
  paid_precision text check (
    paid_precision is null
    or paid_precision in ('unknown', 'estimated', 'publisher_provided', 'precise')
  ),
  estimated_value_micros bigint not null default 0
    check (estimated_value_micros >= 0),
  estimate_source text not null default 'default_ecpm' check (
    estimate_source in ('paid_event', 'observed_ecpm', 'default_ecpm', 'test_ad')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ad_views_verified_report_date_idx
  on public.ad_views (report_date)
  where verified_at is not null;
create index ad_views_user_idx on public.ad_views (user_id);

alter table public.ad_views enable row level security;
revoke all on public.ad_views from anon, authenticated;

-- What one rewarded view earns when the SDK did not say: the eCPM AdMob
-- reported over the last four weeks of settled days, or the configured
-- default until there are enough impressions to trust (D5).
create or replace function public.fallback_rewarded_view_value()
returns table (value_micros bigint, source text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := public.admob_report_date(now());
  v_micros numeric;
  v_impressions numeric;
  v_default_ecpm numeric;
begin
  select
    sum(coalesce(daily.gross_revenue_micros, daily.gross_revenue_minor * 10000)),
    sum(daily.impressions)
  into v_micros, v_impressions
  from public.revenue_daily as daily
  where daily.date >= v_today - 30 and daily.date < v_today - 1;

  if coalesce(v_impressions, 0) >= 50 then
    return query select round(v_micros / v_impressions)::bigint, 'observed_ecpm'::text;
    return;
  end if;

  select (payload->>'estimatedRewardedEcpmUsd')::numeric into v_default_ecpm
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;
  -- eCPM is dollars per thousand views: $3 eCPM is $0.003 = 3000 micros a view.
  return query select
    round(greatest(coalesce(v_default_ecpm, 3), 0) * 1000)::bigint,
    'default_ecpm'::text;
end;
$$;

create or replace function public.ad_views_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_fallback record;
begin
  new.report_date := public.admob_report_date(new.viewed_at);
  new.updated_at := now();

  if new.paid_precision in ('estimated', 'publisher_provided', 'precise')
    and new.paid_currency = 'USD'
    and coalesce(new.paid_value_micros, 0) > 0 then
    -- What the SDK says this impression paid, capped so a tampered client
    -- cannot inflate the live fund (a $100 eCPM is far above rewarded rates).
    new.estimated_value_micros := least(new.paid_value_micros, 100000);
    new.estimate_source := 'paid_event';
  elsif new.paid_precision = 'unknown' and coalesce(new.paid_value_micros, 0) = 0 then
    -- Google's test impressions report an unknown precision and no value.
    new.estimated_value_micros := 0;
    new.estimate_source := 'test_ad';
  elsif tg_op = 'INSERT' then
    select * into v_fallback from public.fallback_rewarded_view_value();
    new.estimated_value_micros := v_fallback.value_micros;
    new.estimate_source := v_fallback.source;
  elsif old.estimate_source not in ('observed_ecpm', 'default_ecpm') then
    -- A fallback estimate is taken once and kept: verifying the view later
    -- must not move its value.
    select * into v_fallback from public.fallback_rewarded_view_value();
    new.estimated_value_micros := v_fallback.value_micros;
    new.estimate_source := v_fallback.source;
  end if;
  return new;
end;
$$;

create trigger ad_views_estimate
before insert or update on public.ad_views
for each row execute function public.ad_views_before_write();

-- Called by the SSV webhook for every callback Google signs. An intent is
-- optional: an Android shield without a pre-signed intent still shows a real
-- ad, and it still counts (D4). Idempotent by AdMob's transaction id.
create or replace function public.record_verified_ad_view(
  p_transaction_id text,
  p_ad_unit text,
  p_rewarded_at timestamptz,
  p_intent_id uuid default null,
  p_user_id uuid default null
)
returns public.ad_views
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.reward_intents;
  result public.ad_views;
  v_platform public.device_platform;
  v_rewarded_at timestamptz := least(coalesce(p_rewarded_at, now()), now());
begin
  if p_transaction_id is null or length(trim(p_transaction_id)) = 0 then
    raise exception 'invalid_transaction_id';
  end if;

  if p_intent_id is not null and p_user_id is not null then
    select * into intent
    from public.reward_intents
    where id = p_intent_id and user_id = p_user_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('ad_view:' || coalesce(intent.id::text, p_transaction_id))
  );

  select * into result
  from public.ad_views
  where ssv_transaction_id = p_transaction_id;
  if result.id is not null then return result; end if;

  if intent.id is not null then
    select platform into v_platform
    from public.devices
    where id = intent.device_id;

    -- The claim may have recorded the view first, with the SDK's value.
    update public.ad_views set
      ssv_transaction_id = p_transaction_id,
      ad_unit = p_ad_unit,
      viewed_at = v_rewarded_at,
      verified_at = now(),
      user_id = coalesce(user_id, intent.user_id),
      platform = coalesce(platform, v_platform)
    where reward_intent_id = intent.id and ssv_transaction_id is null
    returning * into result;
    if result.id is not null then return result; end if;

    -- The intent already has its own confirmed view: this is another real ad
    -- that reused the custom data. It counts, without the link.
    if exists (
      select 1 from public.ad_views where reward_intent_id = intent.id
    ) then
      insert into public.ad_views (
        user_id, platform, ssv_transaction_id, ad_unit, viewed_at, verified_at
      ) values (
        intent.user_id, v_platform, p_transaction_id, p_ad_unit, v_rewarded_at, now()
      ) returning * into result;
      return result;
    end if;
  end if;

  insert into public.ad_views (
    reward_intent_id, user_id, platform, ssv_transaction_id, ad_unit,
    viewed_at, verified_at
  ) values (
    intent.id, intent.user_id, v_platform, p_transaction_id, p_ad_unit,
    v_rewarded_at, now()
  ) returning * into result;
  return result;
end;
$$;

-- The value the SDK reported for the impression behind an intent (ILRD). The
-- first value wins; the view only counts once AdMob confirms it (D5).
create or replace function public.record_ad_paid_value(
  p_user_id uuid,
  p_intent_id uuid,
  p_value_micros bigint,
  p_currency text,
  p_precision text,
  p_viewed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.reward_intents;
  v_platform public.device_platform;
  v_viewed_at timestamptz;
begin
  if p_value_micros is null or p_value_micros < 0 or p_value_micros > 10000000
    or p_currency is null or p_currency !~ '^[A-Z]{3}$'
    or p_precision is null
    or p_precision not in ('unknown', 'estimated', 'publisher_provided', 'precise') then
    raise exception 'invalid_ad_value';
  end if;

  select * into intent
  from public.reward_intents
  where id = p_intent_id and user_id = p_user_id;
  if intent.id is null then raise exception 'reward_intent_not_found'; end if;

  perform pg_advisory_xact_lock(hashtext('ad_view:' || intent.id::text));

  update public.ad_views set
    paid_value_micros = p_value_micros,
    paid_currency = p_currency,
    paid_precision = p_precision
  where reward_intent_id = intent.id and paid_precision is null;
  if found then return; end if;
  if exists (select 1 from public.ad_views where reward_intent_id = intent.id) then
    return;
  end if;

  select platform into v_platform from public.devices where id = intent.device_id;
  -- The ad ran between the intent and now, whatever the phone's clock says.
  v_viewed_at := greatest(intent.created_at, least(coalesce(p_viewed_at, now()), now()));
  insert into public.ad_views (
    reward_intent_id, user_id, platform, viewed_at,
    paid_value_micros, paid_currency, paid_precision
  ) values (
    intent.id, intent.user_id, v_platform, v_viewed_at,
    p_value_micros, p_currency, p_precision
  );
end;
$$;

-- The days a device reports, with the minutes returned computed here from the
-- active configuration rather than trusted from the phone (D8). Counts only
-- grow within a day, so a report never lowers what was already recorded.
create or replace function public.record_wellbeing_days(
  p_user_id uuid,
  p_device_id uuid,
  p_platform public.device_platform,
  p_days jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes_per_open numeric;
  v_count integer;
begin
  if not exists (
    select 1 from public.devices where id = p_device_id and user_id = p_user_id
  ) then
    raise exception 'device_not_found';
  end if;
  if jsonb_typeof(p_days) is distinct from 'array'
    or jsonb_array_length(p_days) = 0 or jsonb_array_length(p_days) > 14 then
    raise exception 'invalid_wellbeing_days';
  end if;

  select greatest(coalesce((payload->>'estimatedMinutesPerAvoidedOpen')::numeric, 0), 0)
  into v_minutes_per_open
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;
  v_minutes_per_open := coalesce(v_minutes_per_open, 0);

  insert into public.wellbeing_daily as existing (
    user_id, device_id, date, platform, open_attempts, unlocks, avoided_opens,
    estimated_minutes_avoided, updated_at
  )
  select
    p_user_id, p_device_id, reported.local_date, p_platform,
    greatest(reported.open_attempts, 0), greatest(reported.unlocks, 0),
    greatest(reported.avoided_opens, 0),
    round(greatest(reported.open_attempts - reported.unlocks, 0) * v_minutes_per_open, 1),
    now()
  from jsonb_to_recordset(p_days) as reported(
    local_date date, open_attempts integer, unlocks integer, avoided_opens integer
  )
  where reported.local_date between current_date - 15 and current_date + 1
    and reported.open_attempts is not null
    and reported.unlocks is not null
    and reported.avoided_opens is not null
  on conflict (device_id, date) do update set
    platform = excluded.platform,
    open_attempts = greatest(existing.open_attempts, excluded.open_attempts),
    unlocks = greatest(existing.unlocks, excluded.unlocks),
    avoided_opens = greatest(existing.avoided_opens, excluded.avoided_opens),
    estimated_minutes_avoided = round(
      greatest(
        greatest(existing.open_attempts, excluded.open_attempts)
          - greatest(existing.unlocks, excluded.unlocks),
        0
      ) * v_minutes_per_open,
      1
    ),
    updated_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Everything the Impact screens show for a set of weeks (D6-D8). An open or
-- unconfirmed week is computed live; a confirmed week keeps the amount the
-- operator froze.
create or replace function public.impact_week_totals(p_week_ids uuid[])
returns table (
  week_id uuid,
  gross_revenue_micros bigint,
  estimated_revenue_micros bigint,
  reported_revenue_micros bigint,
  ads_watched integer,
  contributors integer,
  people integer,
  minutes_returned numeric,
  voters integer
)
language sql
stable
security definer
set search_path = public
as $$
  with weeks as (
    select * from public.impact_weeks where id = any(p_week_ids)
  ),
  bounds as (
    select min(week_start) as first_day, max(week_end) as last_day from weeks
  ),
  days as (
    select weeks.id as week_id, weeks.week_start + offsets.n as calendar_day
    from weeks, generate_series(0, 6) as offsets(n)
  ),
  view_days as (
    select views.report_date as calendar_day, sum(views.estimated_value_micros) as micros
    from public.ad_views as views, bounds
    where views.verified_at is not null
      and views.estimate_source <> 'test_ad'
      and views.report_date between bounds.first_day and bounds.last_day
    group by views.report_date
  ),
  report_days as (
    select
      daily.date as calendar_day,
      coalesce(daily.gross_revenue_micros, daily.gross_revenue_minor * 10000) as micros,
      -- A day is settled once AdMob was read a full day after it closed, or
      -- when an operator entered the publisher's own figure.
      (
        daily.source = 'publisher_provided'
        or daily.imported_at >= ((daily.date + 1)::timestamp at time zone 'America/Los_Angeles')
          + interval '24 hours'
      ) as settled
    from public.revenue_daily as daily, bounds
    where daily.date between bounds.first_day and bounds.last_day
  ),
  revenue as (
    select
      days.week_id,
      sum(
        case when report.settled then report.micros
        else greatest(coalesce(report.micros, 0), coalesce(views.micros, 0)) end
      )::bigint as gross,
      sum(
        case when report.settled then 0
        when coalesce(views.micros, 0) > coalesce(report.micros, 0) then views.micros
        else 0 end
      )::bigint as from_ads,
      sum(
        case when report.settled then report.micros
        when coalesce(report.micros, 0) >= coalesce(views.micros, 0) then coalesce(report.micros, 0)
        else 0 end
      )::bigint as from_reports
    from days
    left join view_days as views on views.calendar_day = days.calendar_day
    left join report_days as report on report.calendar_day = days.calendar_day
    group by days.week_id
  ),
  ads as (
    select
      weeks.id as week_id,
      count(views.id)::integer as ads,
      count(distinct views.user_id)::integer as contributors
    from weeks
    left join public.ad_views as views
      on views.verified_at is not null
      and views.estimate_source <> 'test_ad'
      and views.report_date between weeks.week_start and weeks.week_end
    group by weeks.id
  ),
  wellbeing as (
    select
      weeks.id as week_id,
      (count(distinct uploaded.user_id) filter (where uploaded.open_attempts > 0))::integer
        as people,
      coalesce(sum(uploaded.estimated_minutes_avoided), 0) as minutes
    from weeks
    left join public.wellbeing_daily as uploaded
      on uploaded.date between weeks.week_start and weeks.week_end
    group by weeks.id
  ),
  vote_counts as (
    select weeks.id as week_id, count(votes.user_id)::integer as voters
    from weeks
    left join public.votes as votes on votes.impact_week_id = weeks.id
    group by weeks.id
  )
  select
    weeks.id,
    case when weeks.revenue_is_estimated then coalesce(revenue.gross, 0)
      else weeks.gross_revenue_minor * 10000 end,
    case when weeks.revenue_is_estimated then coalesce(revenue.from_ads, 0)
      else 0 end,
    case when weeks.revenue_is_estimated then coalesce(revenue.from_reports, 0)
      else weeks.gross_revenue_minor * 10000 end,
    coalesce(ads.ads, 0),
    coalesce(ads.contributors, 0),
    coalesce(wellbeing.people, 0),
    coalesce(wellbeing.minutes, 0),
    coalesce(vote_counts.voters, 0)
  from weeks
  left join revenue on revenue.week_id = weeks.id
  left join ads on ads.week_id = weeks.id
  left join wellbeing on wellbeing.week_id = weeks.id
  left join vote_counts on vote_counts.week_id = weeks.id;
$$;

create or replace function public.impact_all_time_totals()
returns table (
  people integer,
  minutes_returned numeric,
  ads_watched integer,
  donated_minor bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(distinct user_id)::integer
      from public.wellbeing_daily where open_attempts > 0),
    (select coalesce(sum(estimated_minutes_avoided), 0) from public.wellbeing_daily),
    (select count(*)::integer from public.ad_views
      where verified_at is not null and estimate_source <> 'test_ad'),
    (select coalesce(sum(amount_minor), 0)::bigint from public.donations);
$$;

-- Keeps "this week" true without an operator (D9): closes the voting of weeks
-- that already ended and opens the current Monday-to-Sunday week with the
-- previous week's projects (or the three oldest active ones). Returns the
-- current week, or null when there is no configuration or project yet.
create or replace function public.ensure_current_impact_week()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.admob_report_date(now());
  v_monday date;
  v_week_id uuid;
  v_previous_id uuid;
  v_impact numeric;
  v_platform numeric;
  v_charity_ids uuid[];
begin
  v_monday := v_today - (extract(isodow from v_today)::integer - 1);
  perform pg_advisory_xact_lock(hashtext('impact_week_rollover'));

  update public.impact_weeks
  set status = 'voting_closed', voting_closed_at = now(), updated_at = now()
  where status = 'open' and week_end < v_monday;

  select id into v_week_id from public.impact_weeks where week_start = v_monday;
  if v_week_id is not null then return v_week_id; end if;

  select
    (payload->>'impactPercentage')::numeric,
    (payload->>'platformPercentage')::numeric
  into v_impact, v_platform
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;
  if v_impact is null or v_platform is null then return null; end if;

  select id into v_previous_id
  from public.impact_weeks
  where week_start < v_monday
  order by week_start desc
  limit 1;

  select array_agg(candidate.charity_id order by candidate.display_order)
  into v_charity_ids
  from public.impact_week_candidates as candidate
  join public.charities as charity
    on charity.id = candidate.charity_id and charity.is_active
  where candidate.impact_week_id = v_previous_id;

  if coalesce(cardinality(v_charity_ids), 0) = 0 then
    select array_agg(oldest.id order by oldest.created_at)
    into v_charity_ids
    from (
      select id, created_at from public.charities
      where is_active
      order by created_at
      limit 3
    ) as oldest;
  end if;
  if coalesce(cardinality(v_charity_ids), 0) = 0 then return null; end if;

  insert into public.impact_weeks (
    week_start, week_end, status, impact_percentage, platform_percentage,
    revenue_is_estimated, opened_at
  ) values (
    v_monday, v_monday + 6, 'open', v_impact, v_platform, true, now()
  ) returning id into v_week_id;

  insert into public.impact_week_candidates (impact_week_id, charity_id, display_order)
  select v_week_id, chosen.charity_id, chosen.ordinal
  from unnest(v_charity_ids[1:10]) with ordinality as chosen(charity_id, ordinal);

  insert into public.admin_audit_log (
    admin_user_id, action, entity_type, entity_id, payload
  ) values (
    null, 'impact.week_opened_automatically', 'impact_week', v_week_id::text,
    jsonb_build_object(
      'weekStart', v_monday,
      'impactPercentage', v_impact,
      'charityIds', to_jsonb(v_charity_ids[1:10])
    )
  );
  return v_week_id;
end;
$$;

-- Emergency access is removed (D1): 'rewarded' is the only source, and the
-- window is the one the user chose on the slider (D12). A visit paid by an ad
-- the shield just showed names that ad's intent: it spends the pass that ad
-- earned, and nothing when the reward never became a pass, so it can never
-- take a pass the user saved earlier. The old seven-argument function is
-- replaced so clients that do not send the intent still resolve to this one.
drop function if exists public.create_unlock_session(
  uuid, uuid, uuid, text, integer, text, timestamptz
);

create function public.create_unlock_session(
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
  default_daily_pass_limit integer;
  preferred_daily_pass_limit integer;
  daily_pass_limit integer;
  rewarded_used integer;
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
    greatest(1, least((payload->>'maxRewardTokenBalance')::integer, 20)),
    case device_platform
      when 'ios' then (payload->>'iosRestrictionEnabled')::boolean
      when 'android' then (payload->>'androidRestrictionEnabled')::boolean
    end
  into default_daily_pass_limit, restrictions_enabled
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;

  select preferences.daily_pass_limit
  into preferred_daily_pass_limit
  from public.user_preferences as preferences
  where preferences.user_id = p_user_id;

  if restrictions_enabled is distinct from true then
    raise exception 'restrictions_disabled';
  end if;
  granted_duration := greatest(60, least(coalesce(p_duration_seconds, 600), 86400));
  daily_pass_limit := coalesce(preferred_daily_pass_limit, default_daily_pass_limit, 1);

  select count(*) into rewarded_used
  from public.unlock_sessions
  where user_id = p_user_id
    and source = 'rewarded'
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if rewarded_used >= daily_pass_limit then
    raise exception 'daily_pass_limit_reached';
  end if;

  if p_reward_intent_id is not null then
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
  else
    if public.rewarded_balance(p_user_id) < 1 then
      raise exception 'insufficient_rewarded_balance';
    end if;
    insert into public.token_ledger (
      user_id, device_id, entry_type, amount, reference_id, idempotency_key
    ) values (
      p_user_id, p_device_id, 'unlock_spend', -1, p_client_session_id,
      'unlock:' || p_client_session_id::text
    );
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

-- Same checks as before; up to five intents may wait (Android keeps three for
-- the shield, plus the one the app prepares) (D10).
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
  if active_intent_count >= 5 then
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

revoke all on function public.admob_report_date(timestamptz) from public, anon, authenticated;
revoke all on function public.fallback_rewarded_view_value() from public, anon, authenticated;
revoke all on function public.ad_views_before_write() from public, anon, authenticated;
revoke all on function public.record_verified_ad_view(text, text, timestamptz, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.record_ad_paid_value(uuid, uuid, bigint, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_wellbeing_days(uuid, uuid, public.device_platform, jsonb)
  from public, anon, authenticated;
revoke all on function public.impact_week_totals(uuid[]) from public, anon, authenticated;
revoke all on function public.impact_all_time_totals() from public, anon, authenticated;
revoke all on function public.ensure_current_impact_week() from public, anon, authenticated;
revoke all on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.admob_report_date(timestamptz) to service_role;
grant execute on function public.fallback_rewarded_view_value() to service_role;
grant execute on function public.record_verified_ad_view(text, text, timestamptz, uuid, uuid)
  to service_role;
grant execute on function public.record_ad_paid_value(uuid, uuid, bigint, text, text, timestamptz)
  to service_role;
grant execute on function public.record_wellbeing_days(uuid, uuid, public.device_platform, jsonb)
  to service_role;
grant execute on function public.impact_week_totals(uuid[]) to service_role;
grant execute on function public.impact_all_time_totals() to service_role;
grant execute on function public.ensure_current_impact_week() to service_role;
grant execute on function public.create_unlock_session(uuid, uuid, uuid, text, integer, text, timestamptz, uuid)
  to service_role;
grant execute on function public.create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)
  to service_role;
grant select, insert, update on public.ad_views to service_role;
