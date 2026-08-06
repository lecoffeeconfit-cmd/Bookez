-- Conversation and lightweight public signals for Community feedback requests.

alter table bookez.community_feedback_responses
  add column if not exists quick_reactions jsonb not null default '[]'::jsonb;

create table bookez.community_feedback_replies (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references bookez.community_feedback_requests(id) on delete cascade,
  response_id uuid not null unique references bookez.community_feedback_responses(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bookez.community_feedback_reader_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references bookez.community_feedback_requests(id) on delete cascade,
  response_id uuid not null unique references bookez.community_feedback_responses(id) on delete cascade,
  responder_id uuid not null references auth.users(id) on delete cascade,
  anonymous boolean not null default false,
  body text not null check (char_length(body) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, responder_id)
);

create index community_feedback_replies_request_idx on bookez.community_feedback_replies(request_id, created_at desc);
create index community_feedback_reader_responses_request_idx on bookez.community_feedback_reader_responses(request_id, created_at desc);

create trigger community_feedback_replies_set_updated_at
before update on bookez.community_feedback_replies
for each row execute function bookez.set_updated_at();

create trigger community_feedback_reader_responses_set_updated_at
before update on bookez.community_feedback_reader_responses
for each row execute function bookez.set_updated_at();

alter table bookez.community_feedback_replies enable row level security;
alter table bookez.community_feedback_reader_responses enable row level security;

create policy community_feedback_replies_select on bookez.community_feedback_replies
for select to authenticated using (
  exists (
    select 1 from bookez.community_feedback_responses response
    join bookez.community_feedback_requests request on request.id = response.request_id
    where response.id = response_id
      and (response.responder_id = (select auth.uid()) or request.user_id = (select auth.uid()))
  )
);
create policy community_feedback_replies_insert on bookez.community_feedback_replies
for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from bookez.community_feedback_requests request
    where request.id = request_id and request.user_id = (select auth.uid())
  )
);
create policy community_feedback_replies_update on bookez.community_feedback_replies
for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy community_feedback_replies_delete on bookez.community_feedback_replies
for delete to authenticated using (author_id = (select auth.uid()));

create policy community_feedback_reader_responses_select on bookez.community_feedback_reader_responses
for select to authenticated using (
  exists (
    select 1 from bookez.community_feedback_requests request
    where request.id = request_id
      and (
        request.user_id = (select auth.uid())
        or (
          request.status in ('open', 'closed')
          and not exists (
            select 1 from bookez.community_blocks block
            where (block.blocker_id = (select auth.uid()) and block.blocked_id = request.user_id)
               or (block.blocker_id = request.user_id and block.blocked_id = (select auth.uid()))
          )
        )
      )
  )
);
create policy community_feedback_reader_responses_insert on bookez.community_feedback_reader_responses
for insert to authenticated with check (
  responder_id = (select auth.uid())
  and exists (
    select 1
    from bookez.community_feedback_responses response
    join bookez.community_feedback_requests request on request.id = response.request_id
    where response.id = response_id
      and response.request_id = bookez.community_feedback_reader_responses.request_id
      and response.responder_id = (select auth.uid())
      and response.status = 'submitted'
      and request.status = 'open'
      and request.user_id <> (select auth.uid())
  )
);
create policy community_feedback_reader_responses_update on bookez.community_feedback_reader_responses
for update to authenticated using (responder_id = (select auth.uid())) with check (responder_id = (select auth.uid()));
create policy community_feedback_reader_responses_delete on bookez.community_feedback_reader_responses
for delete to authenticated using (responder_id = (select auth.uid()));

grant select, insert, update, delete on bookez.community_feedback_replies to authenticated;
grant select, insert, update, delete on bookez.community_feedback_reader_responses to authenticated;
