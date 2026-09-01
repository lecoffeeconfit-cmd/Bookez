-- Separate public encouragement from permission to receive feedback.
-- Public comments are opt-in per feedback request; detailed feedback remains private.

alter table bookez.community_projects
  add column if not exists feedback_enabled boolean not null default false;

alter table bookez.community_feedback_requests
  add column if not exists public_comments_enabled boolean not null default false;

-- A request that was already intentionally opened remains available. New
-- requests must use the Library control below before they can be published.
update bookez.community_projects project
set feedback_enabled = true
where exists (
  select 1
  from bookez.community_feedback_requests request
  where request.project_id = project.project_id
    and request.status = 'open'
);

create index if not exists community_projects_feedback_idx
  on bookez.community_projects (feedback_enabled, updated_at desc)
  where show_in_community and feedback_enabled;

drop policy if exists community_feedback_requests_select on bookez.community_feedback_requests;
create policy community_feedback_requests_select on bookez.community_feedback_requests
for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    status = 'open'
    and (
      exists (
        select 1
        from bookez.community_projects project
        where project.project_id = community_feedback_requests.project_id
          and project.show_in_community
          and project.feedback_enabled
      )
      -- Preserve requests created before the Library eligibility control.
      or not exists (
        select 1
        from bookez.community_projects project
        where project.project_id = community_feedback_requests.project_id
      )
    )
    and not bookez.is_community_blocked(user_id)
  )
);

drop policy if exists community_feedback_requests_insert on bookez.community_feedback_requests;
create policy community_feedback_requests_insert on bookez.community_feedback_requests
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from bookez.community_projects project
    where project.project_id = community_feedback_requests.project_id
      and project.user_id = (select auth.uid())
      and project.show_in_community
      and project.feedback_enabled
  )
);

drop policy if exists community_feedback_request_content_select on bookez.community_feedback_request_content;
create policy community_feedback_request_content_select on bookez.community_feedback_request_content
for select to authenticated using (
  exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id
      and (
        request.user_id = (select auth.uid())
        or (
          request.status = 'open'
          and (
            exists (
              select 1
              from bookez.community_projects project
              where project.project_id = request.project_id
                and project.show_in_community
                and project.feedback_enabled
            )
            or not exists (
              select 1
              from bookez.community_projects project
              where project.project_id = request.project_id
            )
          )
          and not bookez.is_community_blocked(request.user_id)
        )
      )
  )
);

drop policy if exists community_feedback_responses_insert on bookez.community_feedback_responses;
create policy community_feedback_responses_insert on bookez.community_feedback_responses
for insert to authenticated with check (
  responder_id = (select auth.uid())
  and exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id
      and request.status = 'open'
      and request.user_id <> (select auth.uid())
      and (
        exists (
          select 1
          from bookez.community_projects project
          where project.project_id = request.project_id
            and project.show_in_community
            and project.feedback_enabled
        )
        or not exists (
          select 1
          from bookez.community_projects project
          where project.project_id = request.project_id
        )
      )
      and not bookez.is_community_blocked(request.user_id)
  )
);

drop policy if exists community_feedback_reader_responses_select on bookez.community_feedback_reader_responses;
create policy community_feedback_reader_responses_select on bookez.community_feedback_reader_responses
for select to authenticated using (
  exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id
      and (
        request.user_id = (select auth.uid())
        or (
          request.public_comments_enabled
          and request.status in ('open', 'closed')
          and not bookez.is_community_blocked(request.user_id)
        )
      )
  )
);

drop policy if exists community_feedback_reader_responses_insert on bookez.community_feedback_reader_responses;
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
      and request.public_comments_enabled
      and request.user_id <> (select auth.uid())
      and not bookez.is_community_blocked(request.user_id)
  )
);

drop policy if exists community_feedback_reader_responses_update on bookez.community_feedback_reader_responses;
create policy community_feedback_reader_responses_update on bookez.community_feedback_reader_responses
for update to authenticated using (
  responder_id = (select auth.uid())
  and exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id and request.public_comments_enabled and request.status = 'open'
  )
) with check (
  responder_id = (select auth.uid())
  and exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id and request.public_comments_enabled and request.status = 'open'
  )
);

drop policy if exists community_feedback_reader_responses_delete on bookez.community_feedback_reader_responses;
create policy community_feedback_reader_responses_delete on bookez.community_feedback_reader_responses
for delete to authenticated using (
  responder_id = (select auth.uid())
  and exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id and request.status = 'open'
  )
);

grant select, insert, update on bookez.community_projects to authenticated;
grant select, insert, update on bookez.community_feedback_requests to authenticated;
grant select, insert, update, delete on bookez.community_feedback_reader_responses to authenticated;
