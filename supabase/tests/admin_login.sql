begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_anonymous
) values
  (
    '93000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'operator@example.test', '{"provider":"email","providers":["email"]}',
    '{}', now(), now(), false
  ),
  (
    '93000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'someone@example.test', '{"provider":"email","providers":["email"]}',
    '{}', now(), now(), false
  );
insert into public.admin_users (user_id, role)
values ('93000000-0000-4000-8000-000000000001', 'admin');

select ok(
  public.admin_login_allowed('operator@example.test'),
  'an operator can be sent a sign-in code'
);
select ok(
  public.admin_login_allowed('  Operator@Example.TEST '),
  'the address is matched without case or surrounding spaces'
);
select ok(
  not public.admin_login_allowed('someone@example.test'),
  'a user who is not an operator gets nothing'
);
select ok(
  not public.admin_login_allowed('nobody@example.test'),
  'an unknown address gets nothing'
);

select is(
  (
    select array_agg(public.consume_rate_limit(repeat('b', 64), 2, 600))
    from generate_series(1, 3)
  ),
  array[true, true, false],
  'a key is allowed up to its limit inside the window'
);
select ok(
  public.consume_rate_limit(repeat('c', 64), 2, 600),
  'each key has its own window'
);
select throws_ok(
  $$select public.consume_rate_limit('not-a-hash', 2, 600)$$,
  'P0001', 'invalid_rate_limit_parameters',
  'keys must be hashes'
);

select ok(
  not has_function_privilege('anon', 'public.admin_login_allowed(text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.consume_rate_limit(text, integer, integer)', 'EXECUTE')
  and not has_table_privilege('anon', 'public.rate_limits', 'SELECT'),
  'clients cannot ask who is an operator or touch the rate limits'
);

select * from finish();
rollback;
