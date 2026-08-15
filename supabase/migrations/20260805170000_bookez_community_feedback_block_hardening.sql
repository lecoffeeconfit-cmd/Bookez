-- A writer's block preference must apply to every Community feedback query,
-- including direct reads against intentionally shared passage snapshots.

drop policy if exists community_feedback_content_select on bookez.community_feedback_request_content;

create policy community_feedback_content_select on bookez.community_feedback_request_content
for select to authenticated using (
  exists (
    select 1
    from bookez.community_feedback_requests request
    where request.id = request_id
      and (
        request.user_id = (select auth.uid())
        or (
          request.status = 'open'
          and not exists (
            select 1
            from bookez.community_blocks block
            where (block.blocker_id = (select auth.uid()) and block.blocked_id = request.user_id)
               or (block.blocker_id = request.user_id and block.blocked_id = (select auth.uid()))
          )
        )
      )
  )
);
