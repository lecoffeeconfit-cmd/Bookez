-- Manuscript feedback requests store only intentionally selected snapshots.
-- Private notes, alternate drafts, and unselected manuscript content remain out.

alter table bookez.community_feedback_requests
  add column if not exists content_scope text not null default 'selected_parts',
  add column if not exists author_display_name text not null default 'Bookez writer',
  add column if not exists content_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists selected_word_count integer not null default 0,
  add column if not exists reading_minutes integer not null default 1,
  add column if not exists listening_minutes integer not null default 1,
  add column if not exists selected_item_count integer not null default 0,
  add column if not exists focuses jsonb not null default '[]'::jsonb,
  add column if not exists custom_question text,
  add column if not exists author_visibility text not null default 'display_name',
  add column if not exists reading_enabled boolean not null default true,
  add column if not exists listening_enabled boolean not null default true,
  add column if not exists passage_comments_enabled boolean not null default true,
  add column if not exists general_feedback_enabled boolean not null default true,
  add column if not exists response_visibility text not null default 'private',
  add column if not exists response_limit integer,
  add column if not exists closes_at timestamptz;

-- The first lightweight migration allowed only open/closed requests. Drafts
-- are author-only and are intentionally excluded from the public RLS branch.
alter table bookez.community_feedback_requests
  drop constraint if exists community_feedback_requests_status_check;
alter table bookez.community_feedback_requests
  add constraint community_feedback_requests_status_check
  check (status in ('draft', 'open', 'closed'));
alter table bookez.community_feedback_requests
  drop constraint if exists community_feedback_requests_focus_check;
alter table bookez.community_feedback_requests
  add constraint community_feedback_requests_focus_check
  check (focus in ('General impressions', 'Opening strength', 'Story pacing', 'Characters', 'Dialogue', 'Clarity', 'Structure', 'Grammar and readability', 'Emotional impact', 'Plot consistency', 'Tone and voice', 'Ending', 'Title or cover', 'Opening', 'Pacing', 'Overall direction'));

create table bookez.community_feedback_request_content (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references bookez.community_feedback_requests(id) on delete cascade,
  item_id text not null,
  item_title text not null,
  item_text text not null,
  position integer not null default 0,
  source_type text not null default 'section',
  created_at timestamptz not null default now()
);

create table bookez.community_feedback_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references bookez.community_feedback_requests(id) on delete cascade,
  responder_id uuid not null references auth.users(id) on delete cascade,
  anonymous boolean not null default false,
  overall_impression text,
  strengths text,
  unclear_sections text,
  suggestions text,
  question_answers jsonb not null default '{}'::jsonb,
  additional_comments text,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  is_helpful boolean not null default false,
  thanked_at timestamptz,
  archived boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, responder_id)
);

create table bookez.community_feedback_annotations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references bookez.community_feedback_requests(id) on delete cascade,
  response_id uuid references bookez.community_feedback_responses(id) on delete cascade,
  responder_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  text_start integer not null default 0,
  text_end integer not null default 0,
  quoted_excerpt text not null,
  comment_text text not null,
  created_at timestamptz not null default now()
);

create table bookez.community_feedback_reader_progress (
  request_id uuid not null references bookez.community_feedback_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_index integer not null default 0,
  word_offset integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create index community_feedback_content_request_idx on bookez.community_feedback_request_content(request_id, position);
create index community_feedback_responses_request_idx on bookez.community_feedback_responses(request_id, created_at desc);
create index community_feedback_annotations_request_idx on bookez.community_feedback_annotations(request_id, created_at desc);

create trigger community_feedback_responses_set_updated_at
before update on bookez.community_feedback_responses
for each row execute function bookez.set_updated_at();

alter table bookez.community_feedback_request_content enable row level security;
alter table bookez.community_feedback_responses enable row level security;
alter table bookez.community_feedback_annotations enable row level security;
alter table bookez.community_feedback_reader_progress enable row level security;

create policy community_feedback_content_select on bookez.community_feedback_request_content
for select to authenticated using (
  exists (select 1 from bookez.community_feedback_requests request
    where request.id = request_id and (request.user_id = (select auth.uid()) or request.status = 'open'))
);
create policy community_feedback_content_insert on bookez.community_feedback_request_content
for insert to authenticated with check (
  exists (select 1 from bookez.community_feedback_requests request where request.id = request_id and request.user_id = (select auth.uid()))
);

create policy community_feedback_responses_select on bookez.community_feedback_responses
for select to authenticated using (
  responder_id = (select auth.uid())
  or exists (select 1 from bookez.community_feedback_requests request where request.id = request_id and request.user_id = (select auth.uid()))
);
create policy community_feedback_responses_insert on bookez.community_feedback_responses
for insert to authenticated with check (
  responder_id = (select auth.uid())
  and exists (select 1 from bookez.community_feedback_requests request where request.id = request_id and request.status = 'open' and request.user_id <> (select auth.uid()))
);
create policy community_feedback_responses_update on bookez.community_feedback_responses
for update to authenticated using (responder_id = (select auth.uid())) with check (responder_id = (select auth.uid()));
create policy community_feedback_responses_delete on bookez.community_feedback_responses
for delete to authenticated using (responder_id = (select auth.uid()));

create policy community_feedback_annotations_select on bookez.community_feedback_annotations
for select to authenticated using (
  responder_id = (select auth.uid())
  or exists (select 1 from bookez.community_feedback_requests request where request.id = request_id and request.user_id = (select auth.uid()))
);
create policy community_feedback_annotations_insert on bookez.community_feedback_annotations
for insert to authenticated with check (
  responder_id = (select auth.uid())
  and exists (select 1 from bookez.community_feedback_requests request where request.id = request_id and request.status = 'open' and request.user_id <> (select auth.uid()))
  and exists (select 1 from bookez.community_feedback_request_content content where content.request_id = request_id and content.item_id = item_id)
);
create policy community_feedback_annotations_delete on bookez.community_feedback_annotations
for delete to authenticated using (responder_id = (select auth.uid()));

create policy community_feedback_reader_progress_own on bookez.community_feedback_reader_progress
for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert on bookez.community_feedback_request_content to authenticated;
grant select, insert, update, delete on bookez.community_feedback_responses to authenticated;
grant select, insert, delete on bookez.community_feedback_annotations to authenticated;
grant select, insert, update, delete on bookez.community_feedback_reader_progress to authenticated;
grant all privileges on all tables in schema bookez to service_role;
