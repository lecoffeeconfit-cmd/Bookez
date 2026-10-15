-- Bookez-only operations. No public/WordWiz/CityPeak roles or data are changed.
-- Apply after the AI-credit migration. Membership is never client writable.
create table bookez.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table bookez.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_id uuid not null,
  action text not null check (action in ('refill_ai','hide_sharing','restore_sharing','remove_avatar','resolve_report','update_feedback')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table bookez.ai_credit_refills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  credits integer not null check (credits > 0),
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
create index ai_credit_refills_user_month on bookez.ai_credit_refills(user_id, month_start);
create table bookez.community_sharing_holds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
create table bookez.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug','feature_request','account','general','other')),
  subject text not null check (char_length(btrim(subject)) between 1 and 160),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  status text not null default 'new' check (status in ('new','reviewing','in_progress','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_inbox on bookez.support_tickets(status, created_at desc);
create index support_tickets_owner on bookez.support_tickets(user_id, created_at desc);
create table bookez.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references bookez.support_tickets(id) on delete cascade,
  actor_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket on bookez.support_messages(ticket_id, created_at);

alter table bookez.app_admins enable row level security;
alter table bookez.admin_audit_log enable row level security;
alter table bookez.ai_credit_refills enable row level security;
alter table bookez.community_sharing_holds enable row level security;
alter table bookez.support_tickets enable row level security;
alter table bookez.support_messages enable row level security;
revoke all on bookez.app_admins, bookez.admin_audit_log, bookez.ai_credit_refills,
  bookez.community_sharing_holds, bookez.support_tickets, bookez.support_messages from public, anon, authenticated;
grant all on bookez.app_admins, bookez.admin_audit_log, bookez.ai_credit_refills,
  bookez.community_sharing_holds, bookez.support_tickets, bookez.support_messages to service_role;
grant select, insert on bookez.support_tickets to authenticated;
grant select on bookez.support_messages to authenticated;
create policy support_tickets_read_own on bookez.support_tickets for select to authenticated using (user_id = (select auth.uid()));
create policy support_tickets_insert_own on bookez.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new' and priority = 'normal');
create policy support_messages_read_own on bookez.support_messages for select to authenticated
  using (exists (select 1 from bookez.support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid())));
create trigger support_tickets_updated before update on bookez.support_tickets for each row execute function bookez.set_updated_at();

create function bookez.is_my_admin() returns boolean language sql stable security definer
set search_path = bookez, public, pg_temp as $$
  select exists (select 1 from bookez.app_admins where user_id = auth.uid());
$$;
revoke all on function bookez.is_my_admin() from public, anon;
grant execute on function bookez.is_my_admin() to authenticated;

create function bookez.limit_support_submissions() returns trigger language plpgsql security definer
set search_path = bookez, public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':support', 0));
  if (select count(*) from bookez.support_tickets where user_id = new.user_id and created_at >= now() - interval '1 hour') >= 10 then
    raise exception 'Please wait before sending more feedback.' using errcode = '22023';
  end if;
  -- Submission timestamps are server-owned, not a client-controlled rate limit.
  new.created_at := now(); new.updated_at := now();
  return new;
end;
$$;
revoke all on function bookez.limit_support_submissions() from public, anon, authenticated;
create trigger support_submission_limit before insert on bookez.support_tickets for each row execute function bookez.limit_support_submissions();

alter table bookez.community_reports add column status text not null default 'open' check (status in ('open','resolved'));
alter table bookez.community_reports add column resolved_at timestamptz;
-- Existing reporters may create reports, but cannot pre-resolve them.
drop policy community_reports_own on bookez.community_reports;
create policy community_reports_own on bookez.community_reports for insert to authenticated
with check ((select auth.uid()) = reporter_id and status = 'open' and resolved_at is null);

-- A server-side hold survives old clients trying to re-publish. Restoring a
-- hold never re-enables a writer's privacy choices automatically.
create function bookez.enforce_sharing_hold() returns trigger language plpgsql security definer
set search_path = bookez, public, pg_temp as $$
begin
  if exists (select 1 from bookez.community_sharing_holds where user_id = new.user_id) then
    if tg_table_name = 'community_projects' then
      new.show_in_community := false; new.show_preview := false; new.feedback_enabled := false;
    elsif new.status = 'open' then
      raise exception 'Community sharing is currently paused. Contact Bookez support.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function bookez.enforce_sharing_hold() from public, anon, authenticated;
create trigger community_project_sharing_hold before insert or update on bookez.community_projects for each row execute function bookez.enforce_sharing_hold();
create trigger community_feedback_sharing_hold before insert or update on bookez.community_feedback_requests for each row execute function bookez.enforce_sharing_hold();

-- Retain the immutable request ledger when an admin restores completed usage.
-- Pending work still counts, and the monthly clock/reserve policy is unchanged.
create or replace function bookez.get_ai_usage(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = bookez, public, pg_temp as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_monthly integer; v_used integer; v_refilled integer;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  select monthly_credits into v_monthly from bookez.ai_credit_policy where id = true;
  select coalesce(sum(credits), 0)::integer into v_used from bookez.ai_credit_requests
    where user_id = p_user_id and month_start = v_month
    and (status = 'completed' or (status = 'pending' and created_at >= now() - interval '10 minutes'));
  select coalesce(sum(credits), 0)::integer into v_refilled from bookez.ai_credit_refills where user_id = p_user_id and month_start = v_month;
  v_used := greatest(0, v_used - v_refilled);
  return jsonb_build_object('month', to_char(v_month, 'YYYY-MM'), 'usedCredits', v_used,
    'monthlyCredits', v_monthly, 'remainingCredits', greatest(0, v_monthly - v_used));
end;
$$;
create or replace function bookez.reserve_ai_credits(p_user_id uuid, p_request_id uuid, p_credits integer, p_protect_reserve boolean default false)
returns jsonb language plpgsql security definer set search_path = bookez, public, pg_temp as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_monthly integer; v_reserve integer; v_used integer; v_refilled integer; v_ceiling integer;
begin
  if p_user_id is null or p_request_id is null or p_credits is null or p_credits < 1 or p_credits > 100 then raise exception 'Invalid credit reservation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_month::text, 0));
  select monthly_credits, reserve_percent into v_monthly, v_reserve from bookez.ai_credit_policy where id = true;
  select coalesce(sum(credits), 0)::integer into v_used from bookez.ai_credit_requests
    where user_id = p_user_id and month_start = v_month
    and (status = 'completed' or (status = 'pending' and created_at >= now() - interval '10 minutes'));
  select coalesce(sum(credits), 0)::integer into v_refilled from bookez.ai_credit_refills where user_id = p_user_id and month_start = v_month;
  v_used := greatest(0, v_used - v_refilled);
  v_ceiling := case when p_protect_reserve then floor(v_monthly * (100 - v_reserve) / 100.0)::integer else v_monthly end;
  if v_used + p_credits > v_ceiling then
    return jsonb_build_object('allowed', false, 'remainingCredits', greatest(0, v_ceiling - v_used));
  end if;
  insert into bookez.ai_credit_requests(id,user_id,month_start,credits,status) values (p_request_id,p_user_id,v_month,p_credits,'pending');
  return jsonb_build_object('allowed', true, 'remainingCredits', greatest(0, v_ceiling - v_used - p_credits));
end;
$$;
revoke all on function bookez.get_ai_usage(uuid), bookez.reserve_ai_credits(uuid,uuid,integer,boolean) from public, anon, authenticated;
grant execute on function bookez.get_ai_usage(uuid), bookez.reserve_ai_credits(uuid,uuid,integer,boolean) to service_role;

create function bookez.admin_apply_action(p_actor uuid, p_action text, p_target uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = bookez, public, pg_temp as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_credits integer; v_refilled integer; v_rows integer; v_owner uuid;
  v_reply text := btrim(coalesce(p_payload->>'reply',''));
begin
  if not exists (select 1 from bookez.app_admins where user_id = p_actor) then raise exception 'Admin access is required.' using errcode = '42501'; end if;
  if p_target is null then raise exception 'A target is required.' using errcode = '22023'; end if;
  if p_action in ('refill_ai','hide_sharing','restore_sharing','remove_avatar') then
    if not exists (select 1 from bookez.profiles where user_id = p_target) then raise exception 'Bookez writer not found.' using errcode = '22023'; end if;
    if p_action = 'refill_ai' then
      perform pg_advisory_xact_lock(hashtextextended(p_target::text || v_month::text, 0));
      select coalesce(sum(credits),0)::integer into v_credits from bookez.ai_credit_requests where user_id = p_target and month_start = v_month and status = 'completed';
      select coalesce(sum(credits),0)::integer into v_refilled from bookez.ai_credit_refills where user_id = p_target and month_start = v_month;
      v_credits := greatest(0, v_credits - v_refilled);
      if v_credits > 0 then insert into bookez.ai_credit_refills(user_id,month_start,credits,actor_id) values (p_target,v_month,v_credits,p_actor); end if;
    elsif p_action = 'hide_sharing' then
      insert into bookez.community_sharing_holds(user_id,actor_id) values (p_target,p_actor) on conflict(user_id) do update set actor_id = excluded.actor_id, created_at = now();
      update bookez.community_projects set show_in_community = false, show_preview = false, feedback_enabled = false where user_id = p_target;
      update bookez.community_feedback_requests set status = 'closed' where user_id = p_target and status = 'open';
    elsif p_action = 'restore_sharing' then delete from bookez.community_sharing_holds where user_id = p_target;
    else update bookez.community_profiles set avatar_path = null, avatar_moderation_notice_at = now() where user_id = p_target;
    end if;
  elsif p_action = 'resolve_report' then
    update bookez.community_reports set status = 'resolved', resolved_at = now() where id = p_target and status = 'open';
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'Open report not found.' using errcode = '22023'; end if;
  elsif p_action = 'update_feedback' then
    select user_id into v_owner from bookez.support_tickets where id = p_target for update;
    if v_owner is null then raise exception 'Feedback not found.' using errcode = '22023'; end if;
    if p_payload ? 'status' and p_payload->>'status' not in ('new','reviewing','in_progress','resolved','closed') then raise exception 'Invalid feedback status.' using errcode = '22023'; end if;
    if p_payload ? 'priority' and p_payload->>'priority' not in ('low','normal','high','critical') then raise exception 'Invalid feedback priority.' using errcode = '22023'; end if;
    if char_length(v_reply) > 4000 then raise exception 'Reply is too long.' using errcode = '22023'; end if;
    update bookez.support_tickets set status = coalesce(p_payload->>'status',status), priority = coalesce(p_payload->>'priority',priority), updated_at = now() where id = p_target;
    if v_reply <> '' then insert into bookez.support_messages(ticket_id,actor_id,body) values (p_target,p_actor,v_reply); end if;
  else raise exception 'Unsupported admin action.' using errcode = '22023';
  end if;
  insert into bookez.admin_audit_log(actor_id,target_id,action,metadata) values (p_actor,p_target,p_action,
    jsonb_strip_nulls(jsonb_build_object('credits',v_credits,'status',p_payload->>'status','priority',p_payload->>'priority','replyLength',case when v_reply <> '' then char_length(v_reply) else null end)));
  return jsonb_build_object('updated',true);
end;
$$;
revoke all on function bookez.admin_apply_action(uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function bookez.admin_apply_action(uuid,text,uuid,jsonb) to service_role;

create function bookez.admin_support_inbox(p_status text default 'all', p_priority text default 'all', p_category text default 'all', p_order text default 'newest', p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = bookez, public, pg_temp as $$
declare v_total integer; v_pages integer; v_page integer; v_tickets jsonb;
begin
  select count(*) into v_total from bookez.support_tickets t where (p_status = 'all' or t.status = p_status) and (p_priority = 'all' or t.priority = p_priority) and (p_category = 'all' or t.category = p_category);
  v_pages := greatest(1,ceil(v_total / 20.0)::integer); v_page := greatest(1,least(coalesce(p_page,1),v_pages));
  select coalesce(jsonb_agg(to_jsonb(ticket_row)), '[]'::jsonb) into v_tickets from (
    select t.*, p.display_name as name, u.email,
      coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'created_at',m.created_at) order by m.created_at) from bookez.support_messages m where m.ticket_id = t.id),'[]'::jsonb) as messages
    from bookez.support_tickets t left join bookez.profiles p on p.user_id = t.user_id left join auth.users u on u.id = t.user_id
    where (p_status = 'all' or t.status = p_status) and (p_priority = 'all' or t.priority = p_priority) and (p_category = 'all' or t.category = p_category)
    order by case when p_order = 'oldest' then t.created_at end asc, case when p_order <> 'oldest' then t.created_at end desc, t.id
    limit 20 offset (v_page - 1) * 20
  ) ticket_row;
  return jsonb_build_object('tickets',v_tickets,'total',v_total,'page',v_page,'totalPages',v_pages,
    'unresolved',(select count(*) from bookez.support_tickets where status not in ('resolved','closed')));
end;
$$;
revoke all on function bookez.admin_support_inbox(text,text,text,text,integer) from public, anon, authenticated;
grant execute on function bookez.admin_support_inbox(text,text,text,text,integer) to service_role;

create function bookez.admin_dashboard_data(p_range text default '30d', p_page integer default 1, p_query text default '')
returns jsonb language plpgsql stable security definer set search_path = bookez, public, pg_temp as $$
declare v_since timestamptz; v_result jsonb; v_month date := date_trunc('month',now() at time zone 'utc')::date;
begin
  if p_range not in ('today','7d','30d','all') then raise exception 'Invalid reporting range.' using errcode = '22023'; end if;
  v_since := case p_range when 'today' then date_trunc('day',now() at time zone 'utc') at time zone 'utc' when '7d' then now() - interval '7 days' when '30d' then now() - interval '30 days' else '-infinity'::timestamptz end;
  with project_totals as (
    select user_id, count(*) as projects, coalesce(sum(current_word_count),0) as words from bookez.projects where deleted_at is null group by user_id
  ), session_totals as (
    select user_id,count(*) as sessions,max(started_at) as last_active from bookez.writing_sessions where ended_at is not null group by user_id
  ), usage_totals as (
    select user_id,sum(credits) as credits from bookez.ai_credit_requests where month_start = v_month and (status = 'completed' or (status = 'pending' and created_at >= now() - interval '10 minutes')) group by user_id
  ), refills as (
    select user_id,sum(credits) as credits from bookez.ai_credit_refills where month_start = v_month group by user_id
  ), writers as materialized (
    -- Only Bookez members, never every account in the shared Auth project.
    select p.user_id as id,p.display_name as name,u.email,p.created_at as "createdAt",greatest(p.updated_at,s.last_active) as "lastActiveAt",
      coalesce(t.projects,0) as projects,coalesce(t.words,0) as words,coalesce(s.sessions,0) as sessions,
      greatest(0,coalesce(a.credits,0)-coalesce(r.credits,0)) as "aiUsed",
      (select monthly_credits from bookez.ai_credit_policy where id = true) as "aiMonthly",
      exists(select 1 from bookez.community_sharing_holds h where h.user_id = p.user_id) as "sharingHeld"
    from bookez.profiles p join auth.users u on u.id = p.user_id left join project_totals t on t.user_id = p.user_id
      left join session_totals s on s.user_id = p.user_id left join usage_totals a on a.user_id = p.user_id left join refills r on r.user_id = p.user_id
  ), matches as materialized (
    select * from writers where p_query = '' or id::text = p_query or strpos(lower(coalesce(name,'') || ' ' || coalesce(email,'')),lower(left(p_query,120))) > 0
  ), paging as (
    select count(*) as total, greatest(1,ceil(count(*) / 20.0)::integer) as pages from matches
  ), page as (
    select greatest(1,least(coalesce(p_page,1),pages)) as current from paging
  ), recent_sessions as materialized (
    select s.* from bookez.writing_sessions s join bookez.profiles p on p.user_id = s.user_id where s.ended_at is not null and s.started_at >= v_since
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'metrics',jsonb_build_object(
      'totalUsers',(select count(*) from writers),'newUsers',(select count(*) from writers where "createdAt" >= v_since),
      'activeWriters',(select count(distinct user_id) from recent_sessions),'projects',(select coalesce(sum(projects),0) from writers),
      'words',(select coalesce(sum(words),0) from writers),'sessions',(select count(*) from recent_sessions),
      'writingSeconds',(select coalesce(sum(duration_seconds),0) from recent_sessions),'wordsWritten',(select coalesce(sum(words_written),0) from recent_sessions),
      'aiCredits',(select coalesce(sum(a.credits),0) from bookez.ai_credit_requests a join bookez.profiles p on p.user_id = a.user_id where a.status = 'completed' and a.created_at >= v_since),
      'aiRequests',(select count(*) from bookez.ai_credit_requests a join bookez.profiles p on p.user_id = a.user_id where a.status = 'completed' and a.created_at >= v_since),
      'sharedBooks',(select count(*) from bookez.community_projects where show_in_community),
      'openReports',(select count(*) from bookez.community_reports where status = 'open'),
      'openFeedback',(select count(*) from bookez.support_tickets where status not in ('resolved','closed')),
      'reminders',(select count(distinct user_id) from bookez.plan_settings where reminder_enabled and deleted_at is null),
      'reactions',(select count(*) from bookez.community_reactions where created_at >= v_since),
      'follows',(select count(*) from bookez.community_follows where created_at >= v_since),
      'feedbackResponses',(select count(*) from bookez.community_feedback_responses where status = 'submitted' and created_at >= v_since)
    ),
    'signals',jsonb_build_object('noProject',(select count(*) from writers where projects = 0),'noDraft',(select count(*) from writers where projects > 0 and words = 0),'lowAI',(select count(*) from writers where "aiUsed" >= "aiMonthly" * 0.8)),
    'projectTypes',coalesce((select jsonb_agg(to_jsonb(types)) from (select writing_type as label,count(*) as count from bookez.projects where deleted_at is null group by writing_type order by count(*) desc,writing_type) types),'[]'::jsonb),
    'topWriters',coalesce((select jsonb_agg(to_jsonb(leaders)) from (select s.user_id as id,p.display_name as name,sum(s.words_written) as words,count(*) as sessions,sum(s.duration_seconds) as seconds from recent_sessions s join bookez.profiles p on p.user_id = s.user_id group by s.user_id,p.display_name order by sum(s.words_written) desc,count(*) desc,s.user_id limit 20) leaders),'[]'::jsonb),
    'users',coalesce((select jsonb_agg(to_jsonb(directory)) from (select * from matches order by "createdAt" desc,id limit 20 offset ((select current from page)-1)*20) directory),'[]'::jsonb),
    'directory',jsonb_build_object('page',(select current from page),'totalPages',(select pages from paging),'totalUsers',(select total from paging),'pageSize',20),
    'reports',coalesce((select jsonb_agg(to_jsonb(reports)) from (select r.id,'community' as kind,r.reported_user_id as "userId",p.display_name as name,r.reason,r.created_at as "createdAt" from bookez.community_reports r left join bookez.profiles p on p.user_id = r.reported_user_id where r.status = 'open' order by r.created_at asc limit 30) reports),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(events)) from (select id,action,created_at as "createdAt" from bookez.admin_audit_log order by created_at desc limit 20) events),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function bookez.admin_dashboard_data(text,integer,text) from public, anon, authenticated;
grant execute on function bookez.admin_dashboard_data(text,integer,text) to service_role;
