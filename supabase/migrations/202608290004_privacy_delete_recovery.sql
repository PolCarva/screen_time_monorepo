-- Supabase Auth deletion happens through the Auth Admin API and therefore
-- cannot share the PostgreSQL transaction used to pseudonymize retained
-- financial rows. Preserve enough data for a compensating rollback if Auth
-- rejects the deletion, so a failed request does not silently detach a live
-- user's wallet.
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
    raise exception 'invalid_pseudonym_hash';
  end if;

  perform set_config('app.allow_ledger_pseudonymization', 'on', true);

  update public.token_ledger
  set user_id = null,
      device_id = null,
      former_user_hash = p_former_user_hash,
      metadata = metadata || jsonb_build_object(
        'retainedForFinancialAudit', true,
        '_restorableDeviceId', device_id
      )
  where user_id = p_user_id;
end;
$$;

create or replace function public.restore_financial_ledger_identity(
  p_user_id uuid,
  p_former_user_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_former_user_hash) <> 64
    or not exists (select 1 from public.profiles where id = p_user_id)
  then
    raise exception 'invalid_ledger_restore';
  end if;

  perform set_config('app.allow_ledger_pseudonymization', 'on', true);

  update public.token_ledger ledger
  set user_id = p_user_id,
      device_id = case
        when exists (
          select 1 from public.devices
          where id = nullif(ledger.metadata->>'_restorableDeviceId', '')::uuid
            and user_id = p_user_id
        ) then nullif(ledger.metadata->>'_restorableDeviceId', '')::uuid
        else null
      end,
      former_user_hash = null,
      metadata = ledger.metadata - 'retainedForFinancialAudit' - '_restorableDeviceId'
  where ledger.user_id is null
    and ledger.former_user_hash = p_former_user_hash;
end;
$$;

revoke all on function public.pseudonymize_financial_ledger(uuid, text)
  from public, anon, authenticated;
revoke all on function public.restore_financial_ledger_identity(uuid, text)
  from public, anon, authenticated;
grant execute on function public.pseudonymize_financial_ledger(uuid, text)
  to service_role;
grant execute on function public.restore_financial_ledger_identity(uuid, text)
  to service_role;
