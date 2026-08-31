create table public.beta_waitlist_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);

create index beta_waitlist_rate_limits_expiry_idx
  on public.beta_waitlist_rate_limits (expires_at);

alter table public.beta_waitlist_rate_limits enable row level security;
revoke all on public.beta_waitlist_rate_limits from anon, authenticated;

create or replace function public.consume_beta_waitlist_rate_limit(
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

  delete from public.beta_waitlist_rate_limits
  where expires_at < now() - interval '1 day';

  insert into public.beta_waitlist_rate_limits (
    key_hash,
    request_count,
    window_started_at,
    expires_at
  ) values (
    p_key_hash,
    1,
    now(),
    now() + make_interval(secs => p_window_seconds)
  )
  on conflict (key_hash) do update
  set
    request_count = case
      when beta_waitlist_rate_limits.expires_at <= now() then 1
      else beta_waitlist_rate_limits.request_count + 1
    end,
    window_started_at = case
      when beta_waitlist_rate_limits.expires_at <= now() then now()
      else beta_waitlist_rate_limits.window_started_at
    end,
    expires_at = case
      when beta_waitlist_rate_limits.expires_at <= now()
        then now() + make_interval(secs => p_window_seconds)
      else beta_waitlist_rate_limits.expires_at
    end
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_beta_waitlist_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_beta_waitlist_rate_limit(text, integer, integer)
  to service_role;
