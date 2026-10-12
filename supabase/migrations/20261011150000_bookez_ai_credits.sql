-- Cloud AI credits are reserved atomically before a provider call. Only the
-- authenticated Edge Function's service role can reserve or settle requests.
create table if not exists bookez.ai_credit_policy (
  id boolean primary key default true check (id),
  monthly_credits integer not null default 120 check (monthly_credits > 0),
  reserve_percent integer not null default 30 check (reserve_percent between 0 and 90)
);
insert into bookez.ai_credit_policy (id) values (true) on conflict (id) do nothing;

create table if not exists bookez.ai_credit_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  credits integer not null check (credits > 0),
  status text not null check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists ai_credit_requests_month_idx
  on bookez.ai_credit_requests (user_id, month_start, status, created_at);

alter table bookez.ai_credit_policy enable row level security;
alter table bookez.ai_credit_requests enable row level security;
revoke all on bookez.ai_credit_policy, bookez.ai_credit_requests from public, anon, authenticated;
grant select on bookez.ai_credit_policy, bookez.ai_credit_requests to service_role;
grant insert, update on bookez.ai_credit_requests to service_role;

create or replace function bookez.get_ai_usage(p_user_id uuid)
returns jsonb language plpgsql security definer
set search_path = bookez, public, pg_temp as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_monthly integer;
  v_used integer;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  select monthly_credits into v_monthly from bookez.ai_credit_policy where id = true;
  select coalesce(sum(credits), 0)::integer into v_used
  from bookez.ai_credit_requests
  where user_id = p_user_id and month_start = v_month
    and (status = 'completed' or (status = 'pending' and created_at >= now() - interval '10 minutes'));
  return jsonb_build_object('month', to_char(v_month, 'YYYY-MM'), 'usedCredits', v_used,
    'monthlyCredits', v_monthly, 'remainingCredits', greatest(0, v_monthly - v_used));
end;
$$;

create or replace function bookez.reserve_ai_credits(
  p_user_id uuid, p_request_id uuid, p_credits integer, p_protect_reserve boolean default false
)
returns jsonb language plpgsql security definer
set search_path = bookez, public, pg_temp as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_monthly integer;
  v_reserve_percent integer;
  v_used integer;
  v_ceiling integer;
begin
  if p_user_id is null or p_request_id is null or p_credits is null or p_credits < 1 or p_credits > 100 then
    raise exception 'Invalid credit reservation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_month::text, 0));
  select monthly_credits, reserve_percent into v_monthly, v_reserve_percent
  from bookez.ai_credit_policy where id = true;
  select coalesce(sum(credits), 0)::integer into v_used
  from bookez.ai_credit_requests
  where user_id = p_user_id and month_start = v_month
    and (status = 'completed' or (status = 'pending' and created_at >= now() - interval '10 minutes'));
  v_ceiling := case when p_protect_reserve then floor(v_monthly * (100 - v_reserve_percent) / 100.0)::integer else v_monthly end;
  if v_used + p_credits > v_ceiling then
    return jsonb_build_object('allowed', false, 'month', to_char(v_month, 'YYYY-MM'),
      'usedCredits', v_used, 'monthlyCredits', v_monthly, 'remainingCredits', greatest(0, v_ceiling - v_used));
  end if;
  insert into bookez.ai_credit_requests (id, user_id, month_start, credits, status)
  values (p_request_id, p_user_id, v_month, p_credits, 'pending');
  return jsonb_build_object('allowed', true, 'month', to_char(v_month, 'YYYY-MM'),
    'usedCredits', v_used + p_credits, 'monthlyCredits', v_monthly,
    'remainingCredits', greatest(0, v_ceiling - v_used - p_credits));
end;
$$;

create or replace function bookez.finish_ai_credits(p_request_id uuid, p_success boolean)
returns void language plpgsql security definer
set search_path = bookez, public, pg_temp as $$
begin
  update bookez.ai_credit_requests
  set status = case when p_success then 'completed' else 'failed' end, settled_at = now()
  where id = p_request_id and status = 'pending';
end;
$$;

revoke all on function bookez.get_ai_usage(uuid) from public, anon, authenticated;
revoke all on function bookez.reserve_ai_credits(uuid, uuid, integer, boolean) from public, anon, authenticated;
revoke all on function bookez.finish_ai_credits(uuid, boolean) from public, anon, authenticated;
grant execute on function bookez.get_ai_usage(uuid) to service_role;
grant execute on function bookez.reserve_ai_credits(uuid, uuid, integer, boolean) to service_role;
grant execute on function bookez.finish_ai_credits(uuid, boolean) to service_role;
