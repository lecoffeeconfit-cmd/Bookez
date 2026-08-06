-- Lightweight, opt-in requests for focused Community perspective.
-- No manuscript text, notes, or chapter content is stored here.

create table bookez.community_feedback_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references bookez.projects(id) on delete cascade,
  project_title text not null check (char_length(project_title) between 1 and 160),
  genre text,
  completion_percent integer check (completion_percent is null or completion_percent between 0 and 100),
  stage text,
  cover_image_path text,
  focus text not null check (focus in ('Title or cover', 'Opening', 'Pacing', 'Characters', 'Overall direction')),
  question text check (question is null or char_length(question) <= 1000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_feedback_requests_feed_idx on bookez.community_feedback_requests (status, created_at desc);
create index community_feedback_requests_user_idx on bookez.community_feedback_requests (user_id, updated_at desc);

create trigger community_feedback_requests_set_updated_at
before update on bookez.community_feedback_requests
for each row execute function bookez.set_updated_at();

alter table bookez.community_feedback_requests enable row level security;

create policy community_feedback_requests_select on bookez.community_feedback_requests
for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    status = 'open'
    and not exists (
      select 1 from bookez.community_blocks block
      where (block.blocker_id = (select auth.uid()) and block.blocked_id = user_id)
         or (block.blocker_id = user_id and block.blocked_id = (select auth.uid()))
    )
  )
);

create policy community_feedback_requests_insert on bookez.community_feedback_requests
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy community_feedback_requests_update on bookez.community_feedback_requests
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy community_feedback_requests_delete on bookez.community_feedback_requests
for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on bookez.community_feedback_requests to authenticated;
grant all privileges on bookez.community_feedback_requests to service_role;
