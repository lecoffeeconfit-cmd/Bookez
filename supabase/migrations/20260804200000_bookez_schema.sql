-- Bookez integration for the shared CityPeak Supabase project.
-- This migration is additive and isolated to the bookez schema plus the new
-- bookez-files storage bucket. It must be reviewed before any remote push.

create schema if not exists bookez;

grant usage on schema bookez to authenticated, service_role;

create table bookez.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  onboarding_completed boolean not null default false,
  current_project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bookez.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Project',
  writing_type text not null,
  target_words integer,
  target_chapters integer,
  status text not null default 'active',
  current_word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_not_blank check (char_length(btrim(title)) > 0),
  constraint projects_writing_type_not_blank check (char_length(btrim(writing_type)) > 0),
  constraint projects_target_words_nonnegative check (target_words is null or target_words >= 0),
  constraint projects_target_chapters_nonnegative check (target_chapters is null or target_chapters >= 0),
  constraint projects_current_word_count_nonnegative check (current_word_count >= 0),
  constraint projects_status_valid check (status in ('active', 'paused', 'completed', 'archived'))
);

alter table bookez.profiles
  add constraint profiles_current_project_id_fkey
  foreign key (current_project_id) references bookez.projects(id) on delete set null;

create table bookez.chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bookez.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  position integer not null,
  content text not null default '',
  notes text not null default '',
  word_count integer not null default 0,
  target_words integer,
  status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapters_title_not_blank check (char_length(btrim(title)) > 0),
  constraint chapters_position_nonnegative check (position >= 0),
  constraint chapters_word_count_nonnegative check (word_count >= 0),
  constraint chapters_target_words_nonnegative check (target_words is null or target_words >= 0),
  constraint chapters_status_valid check (status in ('not_started', 'in_progress', 'drafted', 'complete')),
  constraint chapters_project_position_unique unique (project_id, position)
);

create table bookez.plan_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references bookez.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  writing_frequency text,
  reminder_enabled boolean not null default false,
  reminder_time time,
  pace text,
  planned_completion_date date,
  words_per_session integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_settings_words_per_session_nonnegative check (words_per_session is null or words_per_session >= 0)
);

create table bookez.writing_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bookez.projects(id) on delete cascade,
  chapter_id uuid references bookez.chapters(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  words_written integer not null default 0,
  duration_seconds integer not null default 0,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint writing_sessions_words_nonnegative check (words_written >= 0),
  constraint writing_sessions_duration_nonnegative check (duration_seconds >= 0),
  constraint writing_sessions_ended_after_started check (ended_at is null or ended_at >= started_at)
);

create index profiles_current_project_id_idx on bookez.profiles(current_project_id);
create index projects_user_id_idx on bookez.projects(user_id);
create index projects_updated_at_idx on bookez.projects(updated_at desc);
create index chapters_user_id_idx on bookez.chapters(user_id);
create index chapters_project_id_idx on bookez.chapters(project_id);
create index chapters_project_position_idx on bookez.chapters(project_id, position);
create index plan_settings_user_id_idx on bookez.plan_settings(user_id);
create index writing_sessions_user_id_idx on bookez.writing_sessions(user_id);
create index writing_sessions_project_id_idx on bookez.writing_sessions(project_id);
create index writing_sessions_chapter_id_idx on bookez.writing_sessions(chapter_id);
create index writing_sessions_started_at_idx on bookez.writing_sessions(project_id, started_at desc);

create or replace function bookez.set_updated_at()
returns trigger
language plpgsql
set search_path = bookez, public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on bookez.profiles
for each row execute function bookez.set_updated_at();

create trigger projects_set_updated_at
before update on bookez.projects
for each row execute function bookez.set_updated_at();

create trigger chapters_set_updated_at
before update on bookez.chapters
for each row execute function bookez.set_updated_at();

create trigger plan_settings_set_updated_at
before update on bookez.plan_settings
for each row execute function bookez.set_updated_at();

create trigger writing_sessions_set_updated_at
before update on bookez.writing_sessions
for each row execute function bookez.set_updated_at();

create or replace function bookez.enforce_project_owner()
returns trigger
language plpgsql
security invoker
set search_path = bookez, public, pg_temp
as $$
declare
  project_owner uuid;
  chapter_project uuid;
  chapter_owner uuid;
begin
  select p.user_id into project_owner from bookez.projects p where p.id = new.project_id;
  if project_owner is null or project_owner <> new.user_id then
    raise exception 'Bookez project ownership mismatch';
  end if;

  if tg_table_name = 'writing_sessions' and new.chapter_id is not null then
    select c.project_id, c.user_id into chapter_project, chapter_owner
    from bookez.chapters c where c.id = new.chapter_id;
    if chapter_project is null or chapter_project <> new.project_id or chapter_owner <> new.user_id then
      raise exception 'Bookez chapter ownership mismatch';
    end if;
  end if;
  return new;
end;
$$;

create trigger chapters_enforce_project_owner
before insert or update on bookez.chapters
for each row execute function bookez.enforce_project_owner();

create trigger plan_settings_enforce_project_owner
before insert or update on bookez.plan_settings
for each row execute function bookez.enforce_project_owner();

create trigger writing_sessions_enforce_project_owner
before insert or update on bookez.writing_sessions
for each row execute function bookez.enforce_project_owner();

create or replace function bookez.enforce_profile_project_owner()
returns trigger
language plpgsql
security invoker
set search_path = bookez, public, pg_temp
as $$
begin
  if new.current_project_id is not null and not exists (
    select 1 from bookez.projects p
    where p.id = new.current_project_id and p.user_id = new.user_id
  ) then
    raise exception 'Bookez profile project ownership mismatch';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_project_owner
before insert or update on bookez.profiles
for each row execute function bookez.enforce_profile_project_owner();

alter table bookez.profiles enable row level security;
alter table bookez.projects enable row level security;
alter table bookez.chapters enable row level security;
alter table bookez.plan_settings enable row level security;
alter table bookez.writing_sessions enable row level security;

create policy profiles_select_own on bookez.profiles for select to authenticated
using ((select auth.uid()) = user_id);
create policy profiles_insert_own on bookez.profiles for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy profiles_update_own on bookez.profiles for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on bookez.profiles for delete to authenticated
using ((select auth.uid()) = user_id);

create policy projects_select_own on bookez.projects for select to authenticated
using ((select auth.uid()) = user_id);
create policy projects_insert_own on bookez.projects for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy projects_update_own on bookez.projects for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy projects_delete_own on bookez.projects for delete to authenticated
using ((select auth.uid()) = user_id);

create policy chapters_select_own on bookez.chapters for select to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy chapters_insert_own on bookez.chapters for insert to authenticated
with check ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy chapters_update_own on bookez.chapters for update to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy chapters_delete_own on bookez.chapters for delete to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));

create policy plan_settings_select_own on bookez.plan_settings for select to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy plan_settings_insert_own on bookez.plan_settings for insert to authenticated
with check ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy plan_settings_update_own on bookez.plan_settings for update to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy plan_settings_delete_own on bookez.plan_settings for delete to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));

create policy writing_sessions_select_own on bookez.writing_sessions for select to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy writing_sessions_insert_own on bookez.writing_sessions for insert to authenticated
with check ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy writing_sessions_update_own on bookez.writing_sessions for update to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy writing_sessions_delete_own on bookez.writing_sessions for delete to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid())));

grant select, insert, update, delete on all tables in schema bookez to authenticated;
grant all privileges on all tables in schema bookez to service_role;
grant all privileges on all sequences in schema bookez to service_role;
alter default privileges in schema bookez grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema bookez grant all on tables to service_role;
alter default privileges in schema bookez grant all on sequences to service_role;

insert into storage.buckets (id, name, public)
values ('bookez-files', 'bookez-files', false)
on conflict (id) do nothing;

create policy bookez_files_select_own on storage.objects for select to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (select 1 from bookez.projects p where p.id = ((storage.foldername(name))[2])::uuid and p.user_id = (select auth.uid()))
);

create policy bookez_files_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (select 1 from bookez.projects p where p.id = ((storage.foldername(name))[2])::uuid and p.user_id = (select auth.uid()))
);

create policy bookez_files_update_own on storage.objects for update to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (select 1 from bookez.projects p where p.id = ((storage.foldername(name))[2])::uuid and p.user_id = (select auth.uid()))
)
with check (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (select 1 from bookez.projects p where p.id = ((storage.foldername(name))[2])::uuid and p.user_id = (select auth.uid()))
);

create policy bookez_files_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (select 1 from bookez.projects p where p.id = ((storage.foldername(name))[2])::uuid and p.user_id = (select auth.uid()))
);
