-- SSV verification is asynchronous. Provisional grants that never receive a
-- valid callback must be reversed so a forged client completion cannot become
-- a permanent pass.
create or replace function public.reconcile_stale_reward_intents(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_id uuid;
  candidate_user_id uuid;
  intent public.reward_intents;
  reconciled integer := 0;
  raw_balance integer;
begin
  if p_limit < 1 or p_limit > 5000 then
    raise exception 'invalid_reconciliation_limit';
  end if;

  for candidate_id in
    select id
    from public.reward_intents
    where state = 'provisional'
      and verified_at is null
      and updated_at < now() - interval '26 hours'
    order by updated_at
    limit p_limit
  loop
    -- Keep the same lock order as reward claims and unlock spending. Locking
    -- the intent row before the per-user advisory lock can deadlock with those
    -- functions under load.
    select user_id into candidate_user_id
    from public.reward_intents
    where id = candidate_id;
    if candidate_user_id is null then continue; end if;
    perform pg_advisory_xact_lock(hashtext(candidate_user_id::text));

    select * into intent
    from public.reward_intents
    where id = candidate_id
      and state = 'provisional'
      and verified_at is null
      and updated_at < now() - interval '26 hours'
    for update;
    if intent.id is null then continue; end if;

    update public.reward_intents
    set state = 'rejected', updated_at = now()
    where id = intent.id and state = 'provisional' and verified_at is null;

    if found then
      -- Do not create hidden negative debt. If the provisional pass was
      -- already consumed, its spend brought the raw ledger balance to zero;
      -- a further -1 would silently cancel a future legitimate reward because
      -- rewarded_balance() clamps negative totals to zero.
      select coalesce(sum(amount), 0)::integer into raw_balance
      from public.token_ledger
      where user_id = intent.user_id
        and entry_type in ('reward_grant', 'reward_reversal', 'unlock_spend', 'admin_adjustment');

      if raw_balance > 0 then
        insert into public.token_ledger (
          user_id, device_id, entry_type, amount, reference_id, idempotency_key,
          metadata
        ) values (
          intent.user_id, intent.device_id, 'reward_reversal', -1, intent.id,
          'reward-reversal:' || intent.id::text,
          jsonb_build_object('reason', 'ssv_timeout')
        ) on conflict (idempotency_key) do nothing;
      end if;
      reconciled := reconciled + 1;
    end if;
  end loop;

  return reconciled;
end;
$$;

revoke all on function public.reconcile_stale_reward_intents(integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_stale_reward_intents(integer)
  to service_role;
