-- Optional cockpit retry protection. Requires 20261011150000_bookez_ai_credits.sql.
-- Local only: apply with the matching Edge Function only after explicit release approval.
alter table bookez.ai_credit_requests
  add column if not exists request_fingerprint text,
  add column if not exists response_json jsonb;

create or replace function bookez.get_ai_cockpit_capabilities()
returns jsonb language sql security definer
set search_path = bookez, public, pg_temp as $$
  select jsonb_build_object('idempotency', true);
$$;

create or replace function bookez.claim_ai_cockpit_request(
  p_user_id uuid, p_request_id uuid, p_credits integer,
  p_protect_reserve boolean, p_fingerprint text
)
returns jsonb language plpgsql security definer
set search_path = bookez, public, pg_temp as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_request bookez.ai_credit_requests%rowtype;
  v_monthly integer;
  v_reserve_percent integer;
  v_used integer;
  v_ceiling integer;
begin
  if p_user_id is null or p_request_id is null or p_credits is null or p_credits < 1 or p_credits > 100
    or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid cockpit request';
  end if;
  -- Same lock namespace as existing tools: cockpit and ordinary tools cannot
  -- spend the same monthly balance concurrently.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_month::text, 0));
  select * into v_request from bookez.ai_credit_requests where id = p_request_id for update;
  if found then
    if v_request.user_id <> p_user_id or v_request.request_fingerprint is distinct from p_fingerprint
      or v_request.credits <> p_credits then
      return jsonb_build_object('allowed', false, 'state', 'conflict');
    end if;
    if v_request.status = 'pending' and v_request.created_at < now() - interval '10 minutes' then
      update bookez.ai_credit_requests set status = 'failed', settled_at = now() where id = p_request_id;
      return jsonb_build_object('allowed', false, 'state', 'failed');
    end if;
    return jsonb_build_object('allowed', false, 'state', v_request.status,
      'result', case when v_request.status = 'completed' and v_request.settled_at >= now() - interval '7 days'
        then v_request.response_json else null end);
  end if;

  select monthly_credits, reserve_percent into v_monthly, v_reserve_percent
  from bookez.ai_credit_policy where id = true;
  if v_monthly is null then raise exception 'AI credit policy is unavailable'; end if;
  select coalesce(sum(credits), 0)::integer into v_used
  from bookez.ai_credit_requests
  where user_id = p_user_id and month_start = v_month
    and (status = 'completed' or (status = 'pending' and created_at >= now() - interval '10 minutes'));
  v_ceiling := case when p_protect_reserve then floor(v_monthly * (100 - v_reserve_percent) / 100.0)::integer else v_monthly end;
  if v_used + p_credits > v_ceiling then
    return jsonb_build_object('allowed', false, 'state', 'budget', 'month', to_char(v_month, 'YYYY-MM'),
      'usedCredits', v_used, 'monthlyCredits', v_monthly, 'remainingCredits', greatest(0, v_ceiling - v_used));
  end if;
  -- Expire cached prose, never the credit or deduplication records.
  update bookez.ai_credit_requests set response_json = null
  where user_id = p_user_id and response_json is not null and settled_at < now() - interval '7 days';
  insert into bookez.ai_credit_requests (id, user_id, month_start, credits, status, request_fingerprint)
  values (p_request_id, p_user_id, v_month, p_credits, 'pending', p_fingerprint);
  return jsonb_build_object('allowed', true, 'state', 'claimed', 'month', to_char(v_month, 'YYYY-MM'),
    'usedCredits', v_used + p_credits, 'monthlyCredits', v_monthly);
end;
$$;

create or replace function bookez.finish_ai_cockpit_request(
  p_user_id uuid, p_request_id uuid, p_fingerprint text, p_success boolean, p_result jsonb
)
returns jsonb language plpgsql security definer
set search_path = bookez, public, pg_temp as $$
declare
  v_request bookez.ai_credit_requests%rowtype;
begin
  select * into v_request from bookez.ai_credit_requests where id = p_request_id for update;
  if not found or v_request.user_id <> p_user_id or v_request.request_fingerprint is distinct from p_fingerprint then
    return jsonb_build_object('state', 'conflict');
  end if;
  if v_request.status <> 'pending' then return jsonb_build_object('state', v_request.status); end if;
  -- Late work may not settle after the reservation has left the usage window.
  if v_request.created_at < now() - interval '10 minutes' then
    update bookez.ai_credit_requests set status = 'failed', settled_at = now(), response_json = null where id = p_request_id;
    return jsonb_build_object('state', 'failed');
  end if;
  if p_success and (p_result is null or jsonb_typeof(p_result) <> 'object' or octet_length(p_result::text) > 262144) then
    raise exception 'Invalid cockpit response';
  end if;
  update bookez.ai_credit_requests
  set status = case when p_success then 'completed' else 'failed' end,
    settled_at = now(), response_json = case when p_success then p_result else null end
  where id = p_request_id;
  return jsonb_build_object('state', case when p_success then 'completed' else 'failed' end);
end;
$$;

revoke all on function bookez.get_ai_cockpit_capabilities() from public, anon, authenticated;
revoke all on function bookez.claim_ai_cockpit_request(uuid, uuid, integer, boolean, text) from public, anon, authenticated;
revoke all on function bookez.finish_ai_cockpit_request(uuid, uuid, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function bookez.get_ai_cockpit_capabilities() to service_role;
grant execute on function bookez.claim_ai_cockpit_request(uuid, uuid, integer, boolean, text) to service_role;
grant execute on function bookez.finish_ai_cockpit_request(uuid, uuid, text, boolean, jsonb) to service_role;
