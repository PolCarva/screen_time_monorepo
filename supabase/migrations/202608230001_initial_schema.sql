create extension if not exists pgcrypto with schema extensions;

create type public.device_platform as enum ('ios', 'android');
create type public.reward_provider as enum ('admob', 'house');
create type public.reward_state as enum (
  'intent', 'ready', 'showing', 'provisional', 'verified', 'failed', 'rejected'
);
create type public.ledger_entry_type as enum (
  'reward_grant', 'reward_reversal', 'unlock_spend', 'emergency_spend', 'admin_adjustment'
);
create type public.impact_week_status as enum (
  'draft', 'open', 'voting_closed', 'donation_pending', 'donated'
);
create type public.charity_category as enum (
  'children', 'poverty', 'environment', 'health', 'animals', 'emergencies', 'other'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age_confirmed_at timestamptz,
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'es')),
  country_code text check (country_code is null or length(country_code) = 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id_hash text not null,
  platform public.device_platform not null,
  app_version text not null,
  os_version text not null,
  locale text not null,
  timezone text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, installation_id_hash)
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  push_token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reward_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  provider public.reward_provider not null,
  state public.reward_state not null default 'intent',
  custom_data text not null unique,
  client_event_id uuid unique,
  provider_transaction_id text unique,
  earned_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  entry_type public.ledger_entry_type not null,
  amount integer not null check (amount <> 0),
  reference_id uuid,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index token_ledger_user_created_idx
  on public.token_ledger (user_id, created_at desc);

create table public.unlock_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id uuid not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  source text not null check (source in ('rewarded', 'emergency')),
  app_category text not null default 'other' check (
    app_category in ('social', 'video', 'news', 'games', 'communication', 'other')
  ),
  duration_seconds integer not null check (duration_seconds between 60 and 3600),
  started_at timestamptz not null,
  ends_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.wellbeing_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  date date not null,
  platform public.device_platform not null,
  controlled_screen_time_seconds integer not null default 0 check (controlled_screen_time_seconds >= 0),
  open_attempts integer not null default 0 check (open_attempts >= 0),
  unlocks integer not null default 0 check (unlocks >= 0),
  avoided_opens integer not null default 0 check (avoided_opens >= 0),
  estimated_minutes_avoided numeric(10, 1) not null default 0 check (estimated_minutes_avoided >= 0),
  rewarded_ads_completed integer not null default 0 check (rewarded_ads_completed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device_id, date)
);

create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  short_description text not null,
  website text not null,
  country text not null,
  category public.charity_category not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.impact_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  status public.impact_week_status not null default 'draft',
  currency text not null default 'USD' check (currency = 'USD'),
  gross_revenue_minor bigint not null default 0 check (gross_revenue_minor >= 0),
  impact_percentage numeric(5, 2) not null check (impact_percentage between 0 and 100),
  platform_percentage numeric(5, 2) not null check (platform_percentage between 0 and 100),
  impact_fund_minor bigint generated always as (
    floor(gross_revenue_minor * impact_percentage / 100)
  ) stored,
  revenue_is_estimated boolean not null default true,
  opened_at timestamptz,
  voting_closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end = week_start + 6),
  check (impact_percentage + platform_percentage = 100)
);

create table public.impact_week_candidates (
  impact_week_id uuid not null references public.impact_weeks(id) on delete cascade,
  charity_id uuid not null references public.charities(id) on delete restrict,
  display_order smallint not null check (display_order between 1 and 10),
  primary key (impact_week_id, charity_id),
  unique (impact_week_id, display_order)
);

create table public.votes (
  impact_week_id uuid not null references public.impact_weeks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  charity_id uuid not null references public.charities(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (impact_week_id, user_id),
  foreign key (impact_week_id, charity_id)
    references public.impact_week_candidates(impact_week_id, charity_id)
);

create table public.revenue_daily (
  date date primary key,
  currency text not null default 'USD' check (currency = 'USD'),
  gross_revenue_minor bigint not null check (gross_revenue_minor >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  source text not null default 'admob_api',
  precision text not null default 'estimated',
  imported_at timestamptz not null default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  impact_week_id uuid not null unique references public.impact_weeks(id) on delete restrict,
  charity_id uuid not null references public.charities(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  donated_at timestamptz not null,
  proof_url text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.remote_config_versions (
  id bigint generated always as identity primary key,
  version integer not null unique,
  payload jsonb not null,
  is_active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check ((payload->>'impactPercentage')::numeric + (payload->>'platformPercentage')::numeric = 100)
);

create unique index one_active_remote_config_idx
  on public.remote_config_versions (is_active)
  where is_active;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'operator', 'viewer')),
  created_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid references public.admin_users(user_id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.prevent_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'token_ledger is append-only';
end;
$$;

create trigger token_ledger_no_update
before update or delete on public.token_ledger
for each row execute function public.prevent_ledger_mutation();

create or replace function public.rewarded_balance(p_user_id uuid)
returns integer
language sql
stable
as $$
  select greatest(coalesce(sum(amount), 0), 0)::integer
  from public.token_ledger
  where user_id = p_user_id
    and entry_type in ('reward_grant', 'reward_reversal', 'unlock_spend', 'admin_adjustment');
$$;

create or replace function public.register_device(
  p_user_id uuid,
  p_installation_id uuid,
  p_platform public.device_platform,
  p_app_version text,
  p_os_version text,
  p_locale text,
  p_timezone text
)
returns public.devices
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result public.devices;
  installation_hash text := encode(digest(p_installation_id::text, 'sha256'), 'hex');
begin
  insert into public.devices (
    user_id, installation_id_hash, platform, app_version, os_version, locale, timezone
  ) values (
    p_user_id, installation_hash, p_platform, p_app_version, p_os_version, p_locale, p_timezone
  )
  on conflict (user_id, installation_id_hash) do update set
    app_version = excluded.app_version,
    os_version = excluded.os_version,
    locale = excluded.locale,
    timezone = excluded.timezone,
    last_seen_at = now()
  returning * into result;
  return result;
end;
$$;

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
    and earned_at >= date_trunc('day', now());

  if daily_count >= coalesce(max_daily, 10) then
    raise exception 'daily_reward_limit_reached';
  end if;

  update public.reward_intents set
    state = 'provisional',
    client_event_id = p_client_event_id,
    earned_at = p_earned_at,
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

create or replace function public.cast_impact_vote(
  p_user_id uuid,
  p_impact_week_id uuid,
  p_charity_id uuid
)
returns public.votes
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.votes;
  week_status public.impact_week_status;
begin
  if coalesce((select (raw_app_meta_data->>'is_anonymous')::boolean from auth.users where id = p_user_id), true) then
    raise exception 'account_required';
  end if;

  select status into week_status from public.impact_weeks where id = p_impact_week_id;
  if week_status <> 'open' then raise exception 'voting_closed'; end if;

  insert into public.votes (impact_week_id, user_id, charity_id)
  values (p_impact_week_id, p_user_id, p_charity_id)
  on conflict (impact_week_id, user_id) do update set
    charity_id = excluded.charity_id,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.push_devices enable row level security;
alter table public.reward_intents enable row level security;
alter table public.token_ledger enable row level security;
alter table public.unlock_sessions enable row level security;
alter table public.wellbeing_daily enable row level security;
alter table public.charities enable row level security;
alter table public.impact_weeks enable row level security;
alter table public.impact_week_candidates enable row level security;
alter table public.votes enable row level security;
alter table public.revenue_daily enable row level security;
alter table public.donations enable row level security;
alter table public.remote_config_versions enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_audit_log enable row level security;

create policy profiles_read_own on public.profiles
for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
create policy devices_read_own on public.devices
for select to authenticated using ((select auth.uid()) = user_id);
create policy charities_public_read on public.charities
for select to anon, authenticated using (is_active);
create policy impact_weeks_public_read on public.impact_weeks
for select to anon, authenticated using (status <> 'draft');
create policy impact_candidates_public_read on public.impact_week_candidates
for select to anon, authenticated using (true);
create policy donations_public_read on public.donations
for select to anon, authenticated using (true);
create policy votes_read_own on public.votes
for select to authenticated using ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.devices, public.charities, public.impact_weeks,
  public.impact_week_candidates, public.donations, public.votes to authenticated;
grant select on public.charities, public.impact_weeks, public.impact_week_candidates,
  public.donations to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'donation-proofs', 'donation-proofs', true, 26214400,
  array['image/jpeg', 'image/png', 'application/pdf']
) on conflict (id) do nothing;

create policy donation_proofs_public_read on storage.objects
for select to anon, authenticated using (bucket_id = 'donation-proofs');

create policy donation_proofs_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'donation-proofs'
  and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
);
