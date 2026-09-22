-- iOS offers no public API to send the user to the Home Screen. Still does it
-- with an undocumented call, so the behaviour ships disabled and must stay
-- switchable without an app release.

-- Every stored configuration states the flag explicitly. Existing ones read
-- as off, which is also how clients treat a missing key.
update public.remote_config_versions
set payload = payload || jsonb_build_object('iosHomeOnCancelEnabled', false)
where not (payload ? 'iosHomeOnCancelEnabled');

create or replace function public.admin_publish_remote_config(
  p_admin_user_id uuid,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
  published_at timestamptz := now();
  complete_payload jsonb;
begin
  perform public.require_impact_operator(p_admin_user_id);
  if (p_payload->>'impactPercentage')::numeric +
       (p_payload->>'platformPercentage')::numeric <> 100 then
    raise exception 'invalid_impact_split';
  end if;
  -- A publish that forgets the flag must fail loudly instead of silently
  -- turning the behaviour on or off for every iOS user.
  if jsonb_typeof(p_payload->'iosHomeOnCancelEnabled') is distinct from 'boolean' then
    raise exception 'invalid_ios_home_on_cancel_flag';
  end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.remote_config_versions;
  complete_payload := p_payload || jsonb_build_object(
    'version', next_version,
    'publishedAt', published_at
  );
  update public.remote_config_versions set is_active = false where is_active;
  insert into public.remote_config_versions (
    version, payload, is_active, published_at
  ) values (
    next_version, complete_payload, true, published_at
  );
  insert into public.admin_audit_log (
    admin_user_id, action, entity_type, entity_id, payload
  ) values (
    p_admin_user_id,
    'config.published',
    'remote_config',
    next_version::text,
    complete_payload
  );
  return next_version;
end;
$$;

revoke all on function public.admin_publish_remote_config(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_publish_remote_config(uuid, jsonb)
  to service_role;
