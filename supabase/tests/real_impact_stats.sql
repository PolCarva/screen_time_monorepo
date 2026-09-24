begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(48);

-- Fixtures -----------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_anonymous
) values
  (
    '92000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'impact-a@example.test', '{"provider":"email","providers":["email"]}',
    '{}', now(), now(), false
  ),
  (
    '92000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated',
    'impact-b@example.test', '{"provider":"email","providers":["email"]}',
    '{}', now(), now(), false
  );

insert into public.devices (
  id, user_id, installation_id_hash, platform, app_version, os_version, locale, timezone
) values
  (
    '92000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000001',
    'impact-installation-a', 'android', '1.0.0', '16', 'es', 'America/Montevideo'
  ),
  (
    '92000000-0000-4000-8000-000000000012',
    '92000000-0000-4000-8000-000000000011',
    'impact-installation-b', 'ios', '1.0.0', '27.0', 'es', 'America/Montevideo'
  );

update public.remote_config_versions set is_active = false where is_active;
insert into public.remote_config_versions (version, payload, is_active, published_at)
values (
  920000001,
  jsonb_build_object(
    'version', 920000001,
    'unlockDurationSeconds', 600,
    'maxRewardedAdsPerUtcDay', 10,
    'maxRewardTokenBalance', 3,
    'impactPercentage', 80,
    'platformPercentage', 20,
    'estimatedMinutesPerAvoidedOpen', 2,
    'estimatedRewardedEcpmUsd', 4,
    'rewardProvider', 'admob',
    'votingEnabled', true,
    'iosRestrictionEnabled', true,
    'androidRestrictionEnabled', true,
    'iosHomeOnCancelEnabled', false,
    'publishedAt', now()
  ),
  true,
  now()
);

-- The strictest old preferences: they no longer limit visits or ads.
insert into public.user_preferences (
  user_id, daily_pass_limit, unlock_duration_seconds, max_rewarded_ads_per_utc_day
) values ('92000000-0000-4000-8000-000000000001', 1, 600, 0);

-- The fallback eCPM must come from the configuration, not from whatever this
-- database already imported.
delete from public.revenue_daily
where date >= public.admob_report_date(now()) - 30;

insert into public.reward_intents (
  id, user_id, device_id, provider, state, custom_data, expires_at, idempotency_key
)
select
  ('92000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002',
  'admob', 'provisional', 'impact-intent-' || n, now() + interval '1 day',
  'impact-intent-' || n
from generate_series(1, 6) as n;

-- Emergency access and saved passes are gone ------------------------------

select throws_ok(
  $$select public.create_unlock_session(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000003',
    '92000000-0000-4000-8000-000000000002',
    'emergency', 600, 'other', now()
  )$$,
  'P0001', 'invalid_unlock_source',
  'emergency access is no longer a way in'
);

insert into public.token_ledger (
  user_id, device_id, entry_type, amount, idempotency_key
) values (
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002',
  'admin_adjustment', 1, 'impact-test-balance'
);
select throws_ok(
  $$select public.create_unlock_session(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000004',
    '92000000-0000-4000-8000-000000000002',
    'rewarded', 180, 'other', now()
  )$$,
  'P0001', 'insufficient_rewarded_balance',
  'a saved pass no longer opens an app'
);
select is(
  public.rewarded_balance('92000000-0000-4000-8000-000000000001'),
  1,
  'and the saved balance is left as it was'
);

-- A visit paid by a fresh ad spends what that ad earned, nothing else -------

insert into public.token_ledger (
  user_id, device_id, entry_type, amount, reference_id, idempotency_key
) values (
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002',
  'reward_grant', 1, '92000000-0000-4000-8000-000000000101', 'impact-fresh-grant'
);
select lives_ok(
  $$select public.create_unlock_session(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000005',
    '92000000-0000-4000-8000-000000000002',
    'rewarded', 180, 'other', now(),
    '92000000-0000-4000-8000-000000000101'
  )$$,
  'a visit paid by a claimed fresh ad is recorded'
);
select is(
  (select duration_seconds from public.unlock_sessions
   where client_session_id = '92000000-0000-4000-8000-000000000005'),
  180,
  'the server records the window the user chose on the slider'
);
insert into public.token_ledger (
  user_id, device_id, entry_type, amount, idempotency_key
) values (
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002',
  'admin_adjustment', 1, 'impact-saved-pass'
);
update public.reward_intents set state = 'intent'
where id = '92000000-0000-4000-8000-000000000106';
select lives_ok(
  $$select public.create_unlock_session(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000006',
    '92000000-0000-4000-8000-000000000002',
    'rewarded', 600, 'other', now(),
    '92000000-0000-4000-8000-000000000106'
  )$$,
  'a visit whose ad never became a pass is still recorded'
);
select is(
  public.rewarded_balance('92000000-0000-4000-8000-000000000001'),
  2,
  'and it spends nothing it did not earn'
);
select lives_ok(
  $$select public.create_unlock_session(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000007',
    '92000000-0000-4000-8000-000000000002',
    'rewarded', 600, 'other', now(),
    '92000000-0000-4000-8000-000000000101'
  )$$,
  'a second visit naming the same ad is recorded'
);
select is(
  public.rewarded_balance('92000000-0000-4000-8000-000000000001'),
  2,
  'but one ad pays for one visit only'
);
delete from public.unlock_sessions
where client_session_id in (
  '92000000-0000-4000-8000-000000000005',
  '92000000-0000-4000-8000-000000000006',
  '92000000-0000-4000-8000-000000000007'
);

-- Reward intents wait up to five -------------------------------------------

insert into public.reward_intents (
  id, user_id, device_id, provider, state, custom_data, expires_at, idempotency_key
)
select
  ('92000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid,
  '92000000-0000-4000-8000-000000000011',
  '92000000-0000-4000-8000-000000000012',
  'admob', 'intent', 'waiting-intent-' || n, now() + interval '1 day',
  'waiting-intent-' || n
from generate_series(1, 4) as n;
select lives_ok(
  $$select public.create_reward_intent(
    '92000000-0000-4000-8000-000000000205',
    '92000000-0000-4000-8000-000000000011',
    '92000000-0000-4000-8000-000000000012',
    'admob', 'waiting-intent-5', now() + interval '1 day', 'waiting-intent-5'
  )$$,
  'a fifth waiting intent is accepted'
);
select throws_ok(
  $$select public.create_reward_intent(
    '92000000-0000-4000-8000-000000000206',
    '92000000-0000-4000-8000-000000000011',
    '92000000-0000-4000-8000-000000000012',
    'admob', 'waiting-intent-6', now() + interval '1 day', 'waiting-intent-6'
  )$$,
  'P0001', 'pending_reward_intent_limit_reached',
  'a sixth waiting intent is refused'
);

-- What each confirmed ad is worth -------------------------------------------

select lives_ok(
  $$select public.record_ad_paid_value(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000101',
    7000, 'USD', 'precise', now()
  )$$,
  'the claim records what the SDK said the impression paid'
);
select is(
  (select verified_at is null from public.ad_views
   where reward_intent_id = '92000000-0000-4000-8000-000000000101'),
  true,
  'a claimed view does not count until AdMob confirms it'
);
select lives_ok(
  $$select public.record_verified_ad_view(
    'tx-impact-1', '1234567890', now(),
    '92000000-0000-4000-8000-000000000101',
    '92000000-0000-4000-8000-000000000001'
  )$$,
  'AdMob confirms the claimed view'
);
select results_eq(
  $$select estimated_value_micros, estimate_source, verified_at is not null, ad_unit
    from public.ad_views where reward_intent_id = '92000000-0000-4000-8000-000000000101'$$,
  $$values (7000::bigint, 'paid_event'::text, true, '1234567890'::text)$$,
  'the confirmed view keeps the value the SDK reported'
);
select is(
  (public.record_verified_ad_view(
    'tx-impact-1', '1234567890', now(),
    '92000000-0000-4000-8000-000000000101',
    '92000000-0000-4000-8000-000000000001'
  )).reward_intent_id,
  '92000000-0000-4000-8000-000000000101'::uuid,
  'a repeated callback returns the same view'
);
select is(
  (select count(*) from public.ad_views where ssv_transaction_id = 'tx-impact-1'),
  1::bigint,
  'a repeated callback does not count twice'
);

select lives_ok(
  $$select public.record_verified_ad_view(
    'tx-impact-2', '1234567890', now(),
    '92000000-0000-4000-8000-000000000102',
    '92000000-0000-4000-8000-000000000001'
  )$$,
  'AdMob can confirm a view before the app claims it'
);
select results_eq(
  $$select estimated_value_micros, estimate_source
    from public.ad_views where ssv_transaction_id = 'tx-impact-2'$$,
  $$values (4000::bigint, 'default_ecpm'::text)$$,
  'without the SDK value, a view is worth the configured eCPM'
);
select lives_ok(
  $$select public.record_ad_paid_value(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000102',
    2500, 'USD', 'estimated', now()
  )$$,
  'the SDK value can arrive after AdMob confirmed the view'
);
select results_eq(
  $$select estimated_value_micros, estimate_source
    from public.ad_views where ssv_transaction_id = 'tx-impact-2'$$,
  $$values (2500::bigint, 'paid_event'::text)$$,
  'a late SDK value replaces the eCPM estimate'
);
select lives_ok(
  $$select public.record_ad_paid_value(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000102',
    9000, 'USD', 'precise', now()
  )$$,
  'a second SDK value for the same view is accepted without error'
);
select is(
  (select estimated_value_micros from public.ad_views where ssv_transaction_id = 'tx-impact-2'),
  2500::bigint,
  'the first SDK value wins'
);

select lives_ok(
  $$select public.record_verified_ad_view('tx-impact-3', '1234567890', now(), null, null)$$,
  'a confirmed view without an intent is recorded'
);
select results_eq(
  $$select user_id is null, reward_intent_id is null, estimate_source
    from public.ad_views where ssv_transaction_id = 'tx-impact-3'$$,
  $$values (true, true, 'default_ecpm'::text)$$,
  'a view without an intent counts, unattributed'
);
select lives_ok(
  $$select public.record_verified_ad_view(
    'tx-impact-4', '1234567890', now(),
    '92000000-0000-4000-8000-000000000101',
    '92000000-0000-4000-8000-000000000001'
  )$$,
  'another real ad that reused an intent is recorded'
);
select results_eq(
  $$select user_id, reward_intent_id is null
    from public.ad_views where ssv_transaction_id = 'tx-impact-4'$$,
  $$values ('92000000-0000-4000-8000-000000000001'::uuid, true)$$,
  'a reused intent counts for its person without stealing the link'
);

select lives_ok(
  $$select public.record_ad_paid_value(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000103',
    0, 'USD', 'unknown', now()
  )$$,
  'a test impression reports no value'
);
select lives_ok(
  $$select public.record_verified_ad_view(
    'tx-impact-5', '1234567890', now(),
    '92000000-0000-4000-8000-000000000103',
    '92000000-0000-4000-8000-000000000001'
  )$$,
  'a test impression can still be confirmed'
);
select results_eq(
  $$select estimated_value_micros, estimate_source
    from public.ad_views where ssv_transaction_id = 'tx-impact-5'$$,
  $$values (0::bigint, 'test_ad'::text)$$,
  'a test impression is worth nothing'
);

select lives_ok(
  $$select public.record_ad_paid_value(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000104',
    999999, 'USD', 'precise', now()
  )$$,
  'an implausible SDK value is accepted'
);
select is(
  (select estimated_value_micros from public.ad_views
   where reward_intent_id = '92000000-0000-4000-8000-000000000104'),
  100000::bigint,
  'but it is capped at 10 cents a view'
);
select lives_ok(
  $$select public.record_ad_paid_value(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000105',
    5000, 'EUR', 'precise', now()
  )$$,
  'a value in another currency is accepted'
);
select is(
  (select estimate_source from public.ad_views
   where reward_intent_id = '92000000-0000-4000-8000-000000000105'),
  'default_ecpm',
  'but it falls back to the eCPM instead of mixing currencies'
);
select throws_ok(
  $$select public.record_ad_paid_value(
    '92000000-0000-4000-8000-000000000011',
    '92000000-0000-4000-8000-000000000106',
    5000, 'USD', 'precise', now()
  )$$,
  'P0001', 'reward_intent_not_found',
  'nobody can price another person''s ad'
);

insert into public.revenue_daily (
  date, gross_revenue_minor, gross_revenue_micros, impressions, source, precision, imported_at
) values (
  public.admob_report_date(now()) - 5, 50, 500000, 100, 'admob_api', 'estimated', now()
);
select is(
  (select value_micros from public.fallback_rewarded_view_value()),
  5000::bigint,
  'with enough reported impressions the observed eCPM replaces the default'
);

-- Weekly totals -------------------------------------------------------------

insert into public.charities (
  id, name, slug, short_description, website, country, category
) values (
  '92000000-0000-4000-8000-000000000009',
  'Impact Test Charity', 'impact-test-charity',
  'A transaction-scoped charity used only by impact tests.',
  'https://example.test/impact', 'Test', 'other'
);
insert into public.impact_weeks (
  id, week_start, week_end, status, impact_percentage, platform_percentage, opened_at
) values (
  '92000000-0000-4000-8000-000000000020',
  '2036-01-07', '2036-01-13', 'open', 80, 20, now()
);
insert into public.impact_week_candidates (impact_week_id, charity_id, display_order)
values ('92000000-0000-4000-8000-000000000020', '92000000-0000-4000-8000-000000000009', 1);
insert into public.votes (impact_week_id, user_id, charity_id)
values (
  '92000000-0000-4000-8000-000000000020',
  '92000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000009'
);

insert into public.ad_views (
  user_id, platform, ssv_transaction_id, viewed_at, verified_at,
  paid_value_micros, paid_currency, paid_precision
) values
  ('92000000-0000-4000-8000-000000000001', 'android', 'tx-week-1',
   '2036-01-08 12:00:00-08', now(), 5000, 'USD', 'precise'),
  ('92000000-0000-4000-8000-000000000011', 'ios', 'tx-week-2',
   '2036-01-08 13:00:00-08', now(), 3000, 'USD', 'estimated'),
  ('92000000-0000-4000-8000-000000000001', 'android', 'tx-week-3',
   '2036-01-08 14:00:00-08', now(), 0, 'USD', 'unknown'),
  ('92000000-0000-4000-8000-000000000001', 'android', null,
   '2036-01-08 15:00:00-08', null, 8000, 'USD', 'precise'),
  ('92000000-0000-4000-8000-000000000001', 'android', 'tx-week-4',
   '2036-01-09 12:00:00-08', now(), 4000, 'USD', 'precise');

insert into public.revenue_daily (
  date, gross_revenue_minor, gross_revenue_micros, impressions, source, precision, imported_at
) values
  ('2036-01-08', 2, 20000, 3, 'admob_api', 'estimated', '2036-01-10 12:00:00+00'),
  ('2036-01-09', 0, 1000, 1, 'admob_api', 'estimated', now());

insert into public.wellbeing_daily (
  user_id, device_id, date, platform, open_attempts, unlocks, avoided_opens,
  estimated_minutes_avoided
) values
  ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002',
   '2036-01-08', 'android', 5, 2, 3, 6),
  ('92000000-0000-4000-8000-000000000011', '92000000-0000-4000-8000-000000000012',
   '2036-01-09', 'ios', 0, 0, 0, 0);

select results_eq(
  $$select gross_revenue_micros, estimated_revenue_micros, reported_revenue_micros
    from public.impact_week_totals(array['92000000-0000-4000-8000-000000000020'::uuid])$$,
  $$values (24000::bigint, 4000::bigint, 20000::bigint)$$,
  'a settled day uses AdMob and an open day uses the larger of AdMob and the ads'
);
select results_eq(
  $$select ads_watched, contributors, people, minutes_returned, voters
    from public.impact_week_totals(array['92000000-0000-4000-8000-000000000020'::uuid])$$,
  $$values (3, 2, 1, 6::numeric, 1)$$,
  'confirmed real ads, the people behind them, people paused, minutes and votes'
);

update public.impact_weeks
set revenue_is_estimated = false, gross_revenue_minor = 123, status = 'donation_pending'
where id = '92000000-0000-4000-8000-000000000020';
select is(
  (select gross_revenue_micros from public.impact_week_totals(
    array['92000000-0000-4000-8000-000000000020'::uuid])),
  1230000::bigint,
  'a confirmed week keeps the amount the operator froze'
);

-- Uploaded days -------------------------------------------------------------

select is(
  public.record_wellbeing_days(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000002',
    'android',
    jsonb_build_array(
      jsonb_build_object('local_date', current_date - 1, 'open_attempts', 7,
        'unlocks', 3, 'avoided_opens', 4),
      jsonb_build_object('local_date', current_date, 'open_attempts', 2,
        'unlocks', 2, 'avoided_opens', 0),
      jsonb_build_object('local_date', current_date - 40, 'open_attempts', 9,
        'unlocks', 0, 'avoided_opens', 9)
    )
  ),
  2,
  'recent days are recorded and days too old are ignored'
);
select is(
  (select estimated_minutes_avoided from public.wellbeing_daily
   where device_id = '92000000-0000-4000-8000-000000000002' and date = current_date - 1),
  8.0,
  'minutes are pauses not entered times the configured minutes'
);
select lives_ok(
  $$select public.record_wellbeing_days(
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000002',
    'android',
    jsonb_build_array(jsonb_build_object('local_date', current_date - 1,
      'open_attempts', 1, 'unlocks', 1, 'avoided_opens', 0))
  )$$,
  'a later report with lower counts is accepted'
);
select results_eq(
  $$select open_attempts, unlocks, estimated_minutes_avoided from public.wellbeing_daily
    where device_id = '92000000-0000-4000-8000-000000000002' and date = current_date - 1$$,
  $$values (7, 3, 8.0)$$,
  'but it never lowers what the day already recorded'
);
select throws_ok(
  $$select public.record_wellbeing_days(
    '92000000-0000-4000-8000-000000000011',
    '92000000-0000-4000-8000-000000000002',
    'android',
    jsonb_build_array(jsonb_build_object('local_date', current_date,
      'open_attempts', 1, 'unlocks', 0, 'avoided_opens', 1))
  )$$,
  'P0001', 'device_not_found',
  'nobody can report days for another person''s device'
);

-- The current week opens by itself -------------------------------------------

insert into public.impact_weeks (
  id, week_start, week_end, status, impact_percentage, platform_percentage, opened_at
) values (
  '92000000-0000-4000-8000-000000000021',
  '2020-01-06', '2020-01-12', 'open', 80, 20, now()
);
select isnt(public.ensure_current_impact_week(), null, 'the current week exists');
select results_eq(
  $$select week_start, status::text,
      (select count(*) from public.impact_week_candidates where impact_week_id = weeks.id) > 0
    from public.impact_weeks as weeks
    where id = public.ensure_current_impact_week()$$,
  $$select public.admob_report_date(now())
      - (extract(isodow from public.admob_report_date(now()))::integer - 1),
    'open'::text, true$$,
  'it starts on this Monday, is open and has projects to vote for'
);
select is(
  (select status::text from public.impact_weeks
   where id = '92000000-0000-4000-8000-000000000021'),
  'voting_closed',
  'a week that already ended stops taking votes'
);

-- Only the server reaches these functions -------------------------------------

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_verified_ad_view(text, text, timestamptz, uuid, uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.impact_week_totals(uuid[])', 'EXECUTE'
  )
  and not has_table_privilege('anon', 'public.ad_views', 'SELECT'),
  'clients cannot read ad views or record them'
);

select * from finish();
rollback;
