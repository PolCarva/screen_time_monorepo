-- Remove only the exact public demo fixtures shipped by the prototype.
delete from public.impact_weeks
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and week_start = '2026-08-17'
  and week_end = '2026-08-23'
  and gross_revenue_minor = 2302600;

delete from public.charities
where (id, slug) in (
  ('11111111-1111-4111-8111-111111111111'::uuid, 'ocean-conservancy'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'doctors-without-borders'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'rainforest-trust')
)
and not exists (
  select 1 from public.impact_week_candidates candidate
  where candidate.charity_id = charities.id
);

delete from public.remote_config_versions
where version = 1
  and published_at = '2026-08-23T00:00:00.000Z'
  and payload->>'publishedAt' = '2026-08-23T00:00:00.000Z'
  and payload->>'impactPercentage' = '80'
  and payload->>'maxRewardedAdsPerUtcDay' = '10';

-- A real, deliberately disabled configuration is safer than operational
-- defaults. Admins can publish the intended production policy from /admin.
insert into public.remote_config_versions (version, payload, is_active, published_at)
select
  coalesce((select max(version) + 1 from public.remote_config_versions), 1),
  jsonb_build_object(
    'version', coalesce((select max(version) + 1 from public.remote_config_versions), 1),
    'unlockDurationSeconds', 600,
    'dailyEmergencyUnlocks', 0,
    'maxRewardedAdsPerUtcDay', 0,
    'maxRewardTokenBalance', 0,
    'impactPercentage', 0,
    'platformPercentage', 100,
    'estimatedMinutesPerAvoidedOpen', 0,
    'rewardProvider', 'disabled',
    'votingEnabled', false,
    'iosRestrictionEnabled', false,
    'androidRestrictionEnabled', false,
    'publishedAt', now()
  ),
  true,
  now()
where not exists (
  select 1 from public.remote_config_versions where is_active
);

create table public.beta_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  platform text not null check (platform in ('ios', 'android', 'both')),
  locale text,
  source text not null default 'website',
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (email)
);

create index beta_waitlist_created_idx on public.beta_waitlist (created_at desc);
alter table public.beta_waitlist enable row level security;
revoke all on public.beta_waitlist from anon, authenticated;

create or replace function public.admin_publish_remote_config(
  p_admin_user_id uuid,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
  published_at timestamptz := now();
  complete_payload jsonb;
begin
  perform public.require_impact_operator(p_admin_user_id);
  if (p_payload->>'impactPercentage')::numeric +
       (p_payload->>'platformPercentage')::numeric <> 100 then
    raise exception 'invalid_impact_split';
  end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.remote_config_versions;
  complete_payload := p_payload || jsonb_build_object(
    'version', next_version,
    'publishedAt', published_at
  );
  update public.remote_config_versions set is_active = false where is_active;
  insert into public.remote_config_versions (
    version, payload, is_active, published_at
  ) values (
    next_version, complete_payload, true, published_at
  );
  insert into public.admin_audit_log (
    admin_user_id, action, entity_type, entity_id, payload
  ) values (
    p_admin_user_id,
    'config.published',
    'remote_config',
    next_version::text,
    complete_payload
  );
  return next_version;
end;
$$;

create or replace function public.admin_create_charity(
  p_admin_user_id uuid,
  p_name text,
  p_slug text,
  p_short_description text,
  p_website text,
  p_country text,
  p_category public.charity_category,
  p_logo_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  charity_id uuid;
begin
  perform public.require_impact_operator(p_admin_user_id);
  if length(trim(p_name)) = 0 or length(trim(p_short_description)) = 0 or
     length(trim(p_country)) = 0 or p_website !~ '^https://' then
    raise exception 'invalid_charity';
  end if;
  insert into public.charities (
    name, slug, short_description, website, country, category, logo_url
  ) values (
    trim(p_name), lower(trim(p_slug)), trim(p_short_description),
    trim(p_website), trim(p_country), p_category, nullif(trim(p_logo_url), '')
  ) returning id into charity_id;
  insert into public.admin_audit_log (
    admin_user_id, action, entity_type, entity_id
  ) values (
    p_admin_user_id, 'charity.created', 'charity', charity_id::text
  );
  return charity_id;
end;
$$;

revoke all on function public.admin_publish_remote_config(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_create_charity(
  uuid, text, text, text, text, text, public.charity_category, text
) from public, anon, authenticated;
grant execute on function public.admin_publish_remote_config(uuid, jsonb)
  to service_role;
grant execute on function public.admin_create_charity(
  uuid, text, text, text, text, text, public.charity_category, text
) to service_role;
