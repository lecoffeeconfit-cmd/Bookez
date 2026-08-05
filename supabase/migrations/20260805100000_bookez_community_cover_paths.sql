-- Cover art remains in the private Bookez storage bucket. Community receives
-- a signed URL only after the writer opts into a public project feed.

alter table bookez.community_projects
  add column if not exists cover_image_path text;

create or replace function bookez.can_view_community_cover(p_path text)
returns boolean
language sql
security definer
set search_path = bookez, public, pg_temp
as $$
  select exists (
    select 1
    from bookez.community_projects cp
    join bookez.community_preferences pref on pref.user_id = cp.user_id
      where cp.user_id::text = split_part(p_path, '/', 1)
      and cp.project_id::text = split_part(p_path, '/', 2)
      and cp.cover_image_path = p_path
      and pref.show_profile
      and pref.show_current_project
      and pref.show_project_title
  )
  and not exists (
    select 1
    from bookez.community_blocks block
    where (block.blocker_id = auth.uid() and block.blocked_id::text = split_part(p_path, '/', 1))
       or (block.blocker_id::text = split_part(p_path, '/', 1) and block.blocked_id = auth.uid())
  );
$$;

create policy bookez_files_select_community_cover on storage.objects
for select to authenticated
using (
  bucket_id = 'bookez-files'
  and storage.filename(name) like 'community-cover-%'
  and bookez.can_view_community_cover(name)
);

revoke all on function bookez.can_view_community_cover(text) from public;
grant execute on function bookez.can_view_community_cover(text) to authenticated;
