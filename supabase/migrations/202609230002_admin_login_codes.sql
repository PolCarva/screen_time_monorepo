-- Operators sign in with a code sent by email. The login form only asks
-- Supabase Auth to send it to an address that belongs to an operator, so the
-- form cannot be used to mail anyone else, and every attempt is rate limited.

create table public.rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);

create index rate_limits_expiry_idx on public.rate_limits (expires_at);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- A fixed window per key. Keys are HMACs computed by the server, so the table
-- never holds an address, an email or who is asking.
create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 100 or
     p_window_seconds not between 1 and 86400 then
    raise exception 'invalid_rate_limit_parameters';
  end if;

  delete from public.rate_limits where expires_at < now() - interval '1 day';

  insert into public.rate_limits (key_hash, request_count, window_started_at, expires_at)
  values (p_key_hash, 1, now(), now() + make_interval(secs => p_window_seconds))
  on conflict (key_hash) do update
  set
    request_count = case
      when rate_limits.expires_at <= now() then 1
      else rate_limits.request_count + 1
    end,
    window_started_at = case
      when rate_limits.expires_at <= now() then now()
      else rate_limits.window_started_at
    end,
    expires_at = case
      when rate_limits.expires_at <= now()
        then now() + make_interval(secs => p_window_seconds)
      else rate_limits.expires_at
    end
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

-- Whether a sign-in code may be sent to this address: only operators get one.
create or replace function public.admin_login_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users as operator
    join auth.users as account on account.id = operator.user_id
    where lower(account.email) = lower(trim(p_email))
      and account.deleted_at is null
  );
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.admin_login_allowed(text)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
grant execute on function public.admin_login_allowed(text)
  to service_role;
