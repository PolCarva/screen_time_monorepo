insert into public.remote_config_versions (version, payload, is_active, published_at)
values (
  1,
  '{
    "version": 1,
    "unlockDurationSeconds": 600,
    "dailyEmergencyUnlocks": 3,
    "maxRewardedAdsPerUtcDay": 10,
    "maxRewardTokenBalance": 3,
    "impactPercentage": 80,
    "platformPercentage": 20,
    "estimatedMinutesPerAvoidedOpen": 2,
    "rewardProvider": "admob",
    "votingEnabled": true,
    "iosRestrictionEnabled": true,
    "androidRestrictionEnabled": true,
    "publishedAt": "2026-08-23T00:00:00.000Z"
  }'::jsonb,
  true,
  '2026-08-23T00:00:00.000Z'
) on conflict (version) do nothing;

insert into public.charities (
  id, name, slug, short_description, website, country, category
) values
  (
    '11111111-1111-4111-8111-111111111111',
    'Ocean Conservancy',
    'ocean-conservancy',
    'Protects the ocean from today’s greatest global challenges.',
    'https://oceanconservancy.org',
    'United States',
    'environment'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Doctors Without Borders',
    'doctors-without-borders',
    'Provides independent medical humanitarian assistance worldwide.',
    'https://www.doctorswithoutborders.org',
    'International',
    'health'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Rainforest Trust',
    'rainforest-trust',
    'Safeguards threatened rainforests and endangered wildlife.',
    'https://www.rainforesttrust.org',
    'International',
    'environment'
  )
on conflict (id) do nothing;

insert into public.impact_weeks (
  id, week_start, week_end, status, impact_percentage, platform_percentage,
  gross_revenue_minor, revenue_is_estimated, opened_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '2026-08-17',
  '2026-08-23',
  'open',
  80,
  20,
  2302600,
  true,
  '2026-08-17T00:00:00.000Z'
) on conflict (id) do nothing;

insert into public.impact_week_candidates (impact_week_id, charity_id, display_order)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 2),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 3)
on conflict do nothing;
