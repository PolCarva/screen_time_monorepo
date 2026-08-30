begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

select ok(
  not has_function_privilege('authenticated', 'public.reconcile_stale_reward_intents(integer)', 'EXECUTE'),
  'authenticated clients cannot run reward reconciliation'
);
select ok(
  has_function_privilege('service_role', 'public.reconcile_stale_reward_intents(integer)', 'EXECUTE'),
  'service role can run reward reconciliation'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_anonymous
) values (
  '90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'invariants@example.test', '{"is_anonymous": false}', '{}', now(), now(), false
);

insert into public.devices (
  id, user_id, installation_id_hash, platform, app_version, os_version, locale, timezone
) values (
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000001',
  'test-installation-hash', 'ios', '1.0.0', '26.0', 'en', 'UTC'
);

insert into public.impact_weeks (
  id, week_start, week_end, status, impact_percentage, platform_percentage, opened_at
) values (
  '90000000-0000-4000-8000-000000000003',
  '2036-01-07', '2036-01-13', 'open', 80, 20, now()
);
insert into public.impact_week_candidates (impact_week_id, charity_id, display_order)
select '90000000-0000-4000-8000-000000000003', id, 1
from public.charities order by created_at limit 1;

update public.remote_config_versions
set payload = jsonb_set(payload, '{votingEnabled}', 'false'::jsonb)
where is_active;
select throws_ok(
  $$select public.cast_impact_vote(
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000003',
    (select charity_id from public.impact_week_candidates where impact_week_id = '90000000-0000-4000-8000-000000000003')
  )$$,
  'P0001', 'voting_disabled',
  'database voting switch blocks stale clients'
);
update public.remote_config_versions
set payload = jsonb_set(payload, '{votingEnabled}', 'true'::jsonb)
where is_active;

update public.remote_config_versions
set payload = jsonb_set(payload, '{iosRestrictionEnabled}', 'false'::jsonb)
where is_active;
select throws_ok(
  $$select public.create_unlock_session(
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000004',
    '90000000-0000-4000-8000-000000000002',
    'emergency', 600, 'other', now()
  )$$,
  'P0001', 'restrictions_disabled',
  'database platform switch blocks stale clients'
);
update public.remote_config_versions
set payload = jsonb_set(payload, '{iosRestrictionEnabled}', 'true'::jsonb)
where is_active;

select throws_ok(
  $$select public.create_reward_intent(
    '90000000-0000-4000-8000-000000000005',
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000002',
    'house', 'unsupported-provider-test', now() + interval '15 minutes',
    'unsupported-provider-test'
  )$$,
  'P0001', 'unsupported_reward_provider',
  'unimplemented reward providers fail closed'
);

insert into public.reward_intents (
  id, user_id, device_id, provider, state, custom_data, expires_at, updated_at
) values (
  '90000000-0000-4000-8000-000000000006',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002',
  'admob', 'provisional', 'stale-unspent', now() - interval '1 day', now() - interval '27 hours'
);
insert into public.token_ledger (
  user_id, device_id, entry_type, amount, reference_id, idempotency_key
) values (
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002',
  'reward_grant', 1, '90000000-0000-4000-8000-000000000006', 'test-reward-unspent'
);

select is(public.reconcile_stale_reward_intents(500), 1, 'one stale intent is reconciled');
select is(
  (select state::text from public.reward_intents where id = '90000000-0000-4000-8000-000000000006'),
  'rejected', 'stale intent becomes rejected'
);
select is(
  (select coalesce(sum(amount), 0) from public.token_ledger where user_id = '90000000-0000-4000-8000-000000000001'),
  0::bigint, 'an available stale pass is reversed'
);

insert into public.reward_intents (
  id, user_id, device_id, provider, state, custom_data, expires_at, updated_at
) values (
  '90000000-0000-4000-8000-000000000007',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002',
  'admob', 'provisional', 'stale-spent', now() - interval '1 day', now() - interval '27 hours'
);
insert into public.token_ledger (
  user_id, device_id, entry_type, amount, reference_id, idempotency_key
) values
  (
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000002',
    'reward_grant', 1, '90000000-0000-4000-8000-000000000007', 'test-reward-spent'
  ),
  (
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000002',
    'unlock_spend', -1, '90000000-0000-4000-8000-000000000008', 'test-unlock-spend'
  );

select is(public.reconcile_stale_reward_intents(500), 1, 'a spent stale intent is reconciled');
select is(
  (select coalesce(sum(amount), 0) from public.token_ledger where user_id = '90000000-0000-4000-8000-000000000001'),
  0::bigint, 'reconciliation does not create hidden negative debt'
);
select is(
  (select count(*) from public.token_ledger where reference_id = '90000000-0000-4000-8000-000000000007' and entry_type = 'reward_reversal'),
  0::bigint, 'a consumed provisional pass is not reversed twice'
);

select lives_ok(
  $$select public.pseudonymize_financial_ledger(
    '90000000-0000-4000-8000-000000000001', repeat('a', 64)
  )$$,
  'financial rows can be pseudonymized'
);
select ok(
  not exists (select 1 from public.token_ledger where user_id = '90000000-0000-4000-8000-000000000001'),
  'pseudonymization detaches the live identity'
);
select lives_ok(
  $$select public.restore_financial_ledger_identity(
    '90000000-0000-4000-8000-000000000001', repeat('a', 64)
  )$$,
  'failed Auth deletion can restore financial identity'
);
select ok(
  not exists (
    select 1 from public.token_ledger
    where user_id = '90000000-0000-4000-8000-000000000001'
      and device_id is distinct from '90000000-0000-4000-8000-000000000002'
  ),
  'deletion rollback restores the original device reference'
);

select * from finish();
rollback;
