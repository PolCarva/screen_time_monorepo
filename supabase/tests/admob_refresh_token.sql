begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select is(
  public.admob_refresh_token(),
  null,
  'without a stored token the import falls back to the environment'
);

select lives_ok(
  $$select public.set_admob_refresh_token('1//first-refresh-token-value')$$,
  'the connect script can store a token'
);
select is(
  public.admob_refresh_token(),
  '1//first-refresh-token-value',
  'the import reads the stored token'
);

select lives_ok(
  $$select public.set_admob_refresh_token('1//second-refresh-token-value')$$,
  'a renewed token can be stored over the old one'
);
select is(
  (
    select array[count(*)::text, max(secret.decrypted_secret)]
    from vault.decrypted_secrets as secret
    where secret.name = 'admob_refresh_token'
  ),
  array['1', '1//second-refresh-token-value'],
  'renewing replaces the token instead of adding another'
);

select throws_ok(
  $$select public.set_admob_refresh_token('short')$$,
  'P0001', 'invalid_admob_refresh_token',
  'a value that cannot be a refresh token is refused'
);

select ok(
  not has_function_privilege('anon', 'public.admob_refresh_token()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.admob_refresh_token()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.set_admob_refresh_token(text)', 'EXECUTE'),
  'only the server can read or replace the token'
);

select * from finish();
rollback;
