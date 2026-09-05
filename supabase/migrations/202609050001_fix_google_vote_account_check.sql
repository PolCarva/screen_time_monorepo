-- Supabase stores anonymous status in auth.users.is_anonymous. OAuth users do
-- not necessarily carry an is_anonymous key in raw_app_meta_data, so treating
-- a missing metadata key as anonymous rejects valid Google-linked accounts.
create or replace function public.cast_impact_vote(
  p_user_id uuid,
  p_impact_week_id uuid,
  p_charity_id uuid
)
returns public.votes
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.votes;
  week_status public.impact_week_status;
  voting_enabled boolean;
begin
  if not exists (
    select 1
    from auth.users
    where id = p_user_id
      and is_anonymous is false
  ) then
    raise exception 'account_required';
  end if;

  select (payload ->> 'votingEnabled')::boolean into voting_enabled
  from public.remote_config_versions
  where is_active
  order by version desc
  limit 1;
  if voting_enabled is distinct from true then raise exception 'voting_disabled'; end if;

  select status into week_status from public.impact_weeks where id = p_impact_week_id;
  if week_status is distinct from 'open' then raise exception 'impact_week_not_open'; end if;
  if not exists (
    select 1 from public.impact_week_candidates
    where impact_week_id = p_impact_week_id and charity_id = p_charity_id
  ) then
    raise exception 'charity_not_in_impact_week';
  end if;

  insert into public.votes (impact_week_id, user_id, charity_id)
  values (p_impact_week_id, p_user_id, p_charity_id)
  on conflict (impact_week_id, user_id) do update set
    charity_id = excluded.charity_id,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;

revoke all on function public.cast_impact_vote(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cast_impact_vote(uuid, uuid, uuid)
  to service_role;
