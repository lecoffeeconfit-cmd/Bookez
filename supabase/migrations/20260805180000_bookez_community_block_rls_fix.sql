-- RLS policies run their subqueries under the caller's permissions. A reader
-- cannot normally see a block created by the writer, so block checks need this
-- narrowly scoped SECURITY DEFINER helper to remain effective in either
-- direction.

create or replace function bookez.is_community_blocked(p_other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = bookez, public, pg_temp
as $$
  select exists (
    select 1
    from bookez.community_blocks block
    where (block.blocker_id = auth.uid() and block.blocked_id = p_other_user)
       or (block.blocker_id = p_other_user and block.blocked_id = auth.uid())
  );
$$;

revoke all on function bookez.is_community_blocked(uuid) from public;
grant execute on function bookez.is_community_blocked(uuid) to authenticated;

drop policy if exists community_feedback_requests_select on bookez.community_feedback_requests;
create policy community_feedback_requests_select on bookez.community_feedback_requests
for select to authenticated
using (
  user_id = (select auth.uid())
  or (status = 'open' and not bookez.is_community_blocked(user_id))
);

drop policy if exists community_feedback_content_select on bookez.community_feedback_request_content;
create policy community_feedback_content_select on bookez.community_feedback_request_content
for select to authenticated using (
  exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id
      and (request.user_id = (select auth.uid()) or (request.status = 'open' and not bookez.is_community_blocked(request.user_id)))
  )
);

drop policy if exists community_feedback_reader_responses_select on bookez.community_feedback_reader_responses;
create policy community_feedback_reader_responses_select on bookez.community_feedback_reader_responses
for select to authenticated using (
  exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id
      and (request.user_id = (select auth.uid()) or (request.status in ('open', 'closed') and not bookez.is_community_blocked(request.user_id)))
  )
);
