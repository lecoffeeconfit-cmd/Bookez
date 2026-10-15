import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Optional isolated PostgreSQL/WASM harness; no live project or user data.
// Set BOOKEZ_TEST_PGLITE_MODULE to an installed @electric-sql/pglite entrypoint,
// or install that package in a local test environment. It is not an app dependency.
const { PGlite } = await import(process.env.BOOKEZ_TEST_PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
const admin = '10000000-0000-4000-8000-000000000001';
const writer = '10000000-0000-4000-8000-000000000002';
const other = '10000000-0000-4000-8000-000000000003';
const sharedOnly = '10000000-0000-4000-8000-000000000004';
const project = '20000000-0000-4000-8000-000000000001';
const request = '30000000-0000-4000-8000-000000000001';
const pending = '30000000-0000-4000-8000-000000000002';
const ticket = '40000000-0000-4000-8000-000000000001';
const report = '50000000-0000-4000-8000-000000000001';
const scalar = async (sql, params = []) => Object.values((await db.query(sql,params)).rows[0])[0];
const action = (type, target, payload = {}, actor = admin) => scalar('select bookez.admin_apply_action($1,$2,$3,$4)',[actor,type,target,JSON.stringify(payload)]);
const role = async (user) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec('set role authenticated');
};
try {
  // Minimal equivalents of existing Bookez tables, including a shared Auth
  // project. Deliberately no manuscript-content tables or access to other apps.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema bookez;
    grant usage on schema auth,bookez to authenticated,service_role;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant execute on function auth.uid() to authenticated,service_role;
    create function bookez.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
    create table bookez.profiles(user_id uuid primary key references auth.users(id),display_name text,created_at timestamptz default now(),updated_at timestamptz default now());
    create table bookez.projects(id uuid primary key,user_id uuid references auth.users(id),writing_type text,current_word_count integer default 0,deleted_at timestamptz);
    create table bookez.writing_sessions(id uuid default gen_random_uuid(),user_id uuid,words_written integer,duration_seconds integer,started_at timestamptz,ended_at timestamptz);
    create table bookez.plan_settings(user_id uuid,reminder_enabled boolean,deleted_at timestamptz);
    create table bookez.community_profiles(user_id uuid primary key,avatar_path text,avatar_moderation_notice_at timestamptz);
    create table bookez.community_projects(project_id uuid primary key,user_id uuid,show_in_community boolean,show_preview boolean,feedback_enabled boolean);
    alter table bookez.community_projects enable row level security;
    grant select,insert,update on bookez.community_projects to authenticated;
    create policy own_projects on bookez.community_projects for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
    create table bookez.community_feedback_requests(id uuid primary key,user_id uuid,project_id uuid,status text,updated_at timestamptz default now());
    grant select,update on bookez.community_feedback_requests to authenticated;
    create table bookez.community_feedback_responses(id uuid,status text,created_at timestamptz default now());
    create table bookez.community_reports(id uuid primary key,reporter_id uuid,reported_user_id uuid,reason text,created_at timestamptz default now());
    alter table bookez.community_reports enable row level security;
    grant insert on bookez.community_reports to authenticated;
    create policy community_reports_own on bookez.community_reports for insert to authenticated with check(reporter_id = auth.uid());
    create table bookez.community_reactions(created_at timestamptz default now());
    create table bookez.community_follows(created_at timestamptz default now());
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261011150000_bookez_ai_credits.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261012160000_bookez_admin_center.sql',import.meta.url),'utf8'));
  for (const [id,email] of [[admin,'admin@example.test'],[writer,'writer@example.test'],[other,'other@example.test'],[sharedOnly,'citypeak-only@example.test']]) await db.query('insert into auth.users values($1,$2)',[id,email]);
  for (const [id,name] of [[admin,'Admin'],[writer,'Writer'],[other,'Other']]) await db.query('insert into bookez.profiles(user_id,display_name) values($1,$2)',[id,name]);
  await db.query('insert into bookez.app_admins(user_id) values($1)',[admin]);
  await db.query("insert into bookez.projects values($1,$2,'Fiction Book',1000,null)",[project,writer]);
  await db.query("insert into bookez.writing_sessions(user_id,words_written,duration_seconds,started_at,ended_at) values($1,400,1200,now(),now()),($1,600,1800,now()-interval '60 days',now()-interval '60 days')",[writer]);
  await db.query('insert into bookez.community_projects values($1,$2,true,true,true)',[project,writer]);
  await db.query("insert into bookez.community_feedback_requests values($1,$2,$3,'open',now())",[request,writer,project]);
  await db.query("insert into bookez.community_reports(id,reporter_id,reported_user_id,reason) values($1,$2,$3,'Please review this shared project.')",[report,other,writer]);
  await db.query("insert into bookez.community_profiles values($1,'old-avatar.jpg',null)",[writer]);
  await db.query("insert into bookez.ai_credit_requests(id,user_id,month_start,credits,status) values($1,$3,date_trunc('month',now() at time zone 'utc')::date,8,'completed'),($2,$3,date_trunc('month',now() at time zone 'utc')::date,5,'pending')",[request,pending,writer]);

  const dashboard = await scalar("select bookez.admin_dashboard_data('30d',1,'')");
  assert.equal(dashboard.metrics.totalUsers,3,'Exclude accounts that only belong to another shared-auth app.');
  assert.equal(dashboard.metrics.words,1000);
  assert.equal(dashboard.metrics.wordsWritten,400);
  assert.equal(dashboard.metrics.sessions,1);
  assert.equal(dashboard.metrics.writingSeconds,1200);
  assert.equal(dashboard.metrics.aiCredits,8);
  assert.equal(dashboard.metrics.openReports,1);
  assert.equal(dashboard.users.find((user) => user.id === writer).aiUsed,13);
  assert.equal((await scalar("select bookez.admin_dashboard_data('all',1,'')")).metrics.sessions,2);
  assert.equal((await scalar("select bookez.admin_dashboard_data('7d',1,'writer@')")).directory.totalUsers,1);
  assert.equal((await scalar("select bookez.admin_dashboard_data('today',1,$1)",[writer])).users[0].id,writer);
  await assert.rejects(action('refill_ai',writer,{},other),/Admin access/);
  await assert.rejects(action('refill_ai',sharedOnly),/Bookez writer not found/);

  await action('refill_ai',writer);
  assert.equal((await scalar('select bookez.get_ai_usage($1)',[writer])).usedCredits,5,'A refill never refunds in-flight work.');
  await action('refill_ai',writer);
  assert.equal(await scalar('select count(*) from bookez.ai_credit_refills'),1,'Repeating a refill cannot grant duplicate credits.');
  assert.equal(await scalar('select count(*) from bookez.ai_credit_requests'),2,'Paid request history is retained.');
  await db.query('select bookez.finish_ai_credits($1,false)',[pending]);
  assert.equal((await scalar('select bookez.get_ai_usage($1)',[writer])).usedCredits,0);
  const newRequest = '30000000-0000-4000-8000-000000000003';
  assert.equal((await scalar('select bookez.reserve_ai_credits($1,$2,8,false)',[writer,newRequest])).allowed,true);
  assert.equal((await scalar('select bookez.get_ai_usage($1)',[writer])).usedCredits,8);

  await action('hide_sharing',writer);
  assert.equal(await scalar('select show_in_community from bookez.community_projects where user_id = $1',[writer]),false);
  assert.equal(await scalar('select status from bookez.community_feedback_requests where user_id = $1',[writer]),'closed');
  await role(writer);
  await db.query('update bookez.community_projects set show_in_community = true,show_preview = true,feedback_enabled = true where user_id = $1',[writer]);
  assert.equal(await scalar('select show_in_community from bookez.community_projects where user_id = $1',[writer]),false,'An older client cannot bypass a sharing hold.');
  await assert.rejects(db.query("update bookez.community_feedback_requests set status = 'open' where user_id = $1",[writer]),/currently paused/);
  await db.exec('reset role');
  await db.exec("alter table bookez.admin_audit_log add constraint simulate_audit_failure check(action <> 'restore_sharing') not valid");
  await assert.rejects(action('restore_sharing',writer),/simulate_audit_failure/);
  assert.equal(await scalar('select count(*) from bookez.community_sharing_holds'),1,'An audit failure rolls back its administrative mutation.');
  await db.exec('alter table bookez.admin_audit_log drop constraint simulate_audit_failure');
  await action('restore_sharing',writer);
  assert.equal(await scalar('select show_in_community from bookez.community_projects where user_id = $1',[writer]),false,'Restore never re-shares private work automatically.');
  await action('remove_avatar',writer);
  assert.equal(await scalar('select avatar_path from bookez.community_profiles where user_id = $1',[writer]),null);
  await action('resolve_report',report);
  assert.equal(await scalar('select status from bookez.community_reports where id = $1',[report]),'resolved');

  await role(writer);
  assert.equal(await scalar('select bookez.is_my_admin()'),false);
  await assert.rejects(db.query('insert into bookez.app_admins(user_id) values($1)',[writer]),/permission denied/);
  await assert.rejects(db.query('select * from bookez.app_admins'),/permission denied/);
  await assert.rejects(db.query("select bookez.admin_dashboard_data('all',1,'')"),/permission denied/);
  await assert.rejects(db.query('select bookez.get_ai_usage($1)',[writer]),/permission denied/);
  await db.query("insert into bookez.support_tickets(id,user_id,category,subject,message) values($1,$2,'bug','Writing problem','The save button is not responding.')",[ticket,writer]);
  await assert.rejects(db.query("insert into bookez.support_tickets(user_id,category,subject,message) values($1,'bug','Forged','Not mine')",[other]),/row-level security/);
  await assert.rejects(db.query("insert into bookez.support_tickets(user_id,category,subject,message,priority) values($1,'bug','Urgent','Please help','critical')",[writer]),/row-level security/);
  await db.exec('reset role');
  await action('update_feedback',ticket,{ status: 'reviewing',priority: 'high',reply: 'Thanks—we are investigating this.' });
  const inbox = await scalar("select bookez.admin_support_inbox('reviewing','high','bug','newest',1)");
  assert.equal(inbox.unresolved,1);
  assert.equal(inbox.tickets[0].messages[0].body,'Thanks—we are investigating this.');
  await role(writer);
  assert.equal(await scalar('select count(*) from bookez.support_messages'),1);
  await assert.rejects(db.query("update bookez.support_tickets set status = 'closed' where id = $1",[ticket]),/permission denied/);
  await role(other);
  assert.equal(await scalar('select count(*) from bookez.support_tickets'),0,'A writer cannot read another writer’s support messages.');
  assert.equal(await scalar('select count(*) from bookez.support_messages'),0);
  for (let index = 0; index < 10; index++) await db.query("insert into bookez.support_tickets(user_id,category,subject,message,created_at) values($1,'general','Feedback','A note',now()-interval '2 hours')",[other]);
  await assert.rejects(db.query("insert into bookez.support_tickets(user_id,category,subject,message) values($1,'general','Feedback','A note')",[other]),/Please wait/);
  await role(admin);
  assert.equal(await scalar('select bookez.is_my_admin()'),true);
  await db.exec('reset role');
  assert.equal(await scalar('select count(*) from auth.users'),4,'No shared sign-in accounts are deleted.');
  assert.ok(await scalar('select count(*) from bookez.admin_audit_log') >= 7);
  console.log('Admin SQL: migration execution, aggregate metrics, ranges/search, Bookez-only scope, RLS/role isolation, refill accounting, sharing holds, support replies, rate limits, and atomic auditing passed in isolated PostgreSQL.');
} catch (error) {
  console.error('Admin SQL check failed:',error.message, error.detail ?? '', error.where ?? '');
  process.exitCode = 1;
} finally { await db.close(); }
