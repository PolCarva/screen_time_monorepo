alter table public.token_ledger
  drop constraint token_ledger_user_id_fkey,
  alter column user_id drop not null,
  add column former_user_hash text;

alter table public.token_ledger
  add constraint token_ledger_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

create index token_ledger_former_user_hash_idx
  on public.token_ledger (former_user_hash)
  where former_user_hash is not null;

create or replace function public.prevent_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.allow_ledger_pseudonymization', true) = 'on' then
    return new;
  end if;
  raise exception 'token_ledger is append-only';
end;
$$;

create or replace function public.pseudonymize_financial_ledger(
  p_user_id uuid,
  p_former_user_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_former_user_hash) <> 64 then
    raise exception 'invalid pseudonym hash';
  end if;

  perform set_config('app.allow_ledger_pseudonymization', 'on', true);

  update public.token_ledger
  set user_id = null,
      device_id = null,
      former_user_hash = p_former_user_hash,
      metadata = jsonb_build_object('retainedForFinancialAudit', true)
  where user_id = p_user_id;
end;
$$;

revoke all on function public.pseudonymize_financial_ledger(uuid, text) from public, anon, authenticated;
grant execute on function public.pseudonymize_financial_ledger(uuid, text) to service_role;
