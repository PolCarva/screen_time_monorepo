-- The AdMob Reporting refresh token lives in Supabase Vault instead of a
-- Vercel variable. The operator renews it with `pnpm --filter web
-- admob:connect` (Google consent in the browser, stored straight from the
-- script) and the next daily import uses it without a redeploy. The token
-- never passes through a form or a chat.

create extension if not exists supabase_vault with schema vault;

create or replace function public.set_admob_refresh_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
begin
  if p_token is null or length(p_token) not between 20 and 2048 or p_token ~ '\s' then
    raise exception 'invalid_admob_refresh_token';
  end if;

  select id into existing_id
  from vault.secrets
  where name = 'admob_refresh_token';

  if existing_id is null then
    perform vault.create_secret(
      p_token,
      'admob_refresh_token',
      'AdMob Reporting API refresh token (pnpm --filter web admob:connect)'
    );
  else
    perform vault.update_secret(existing_id, p_token);
  end if;
end;
$$;

create or replace function public.admob_refresh_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select secret.decrypted_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'admob_refresh_token'
  limit 1;
$$;

revoke all on function public.set_admob_refresh_token(text)
  from public, anon, authenticated;
revoke all on function public.admob_refresh_token()
  from public, anon, authenticated;
grant execute on function public.set_admob_refresh_token(text) to service_role;
grant execute on function public.admob_refresh_token() to service_role;
