-- An optional profile photo for writers who choose to appear in Community.
-- The original full-size photo stays in the private Bookez bucket and is
-- exposed only through a short-lived signed URL after Community opt-in.

alter table bookez.community_profiles
  add column if not exists avatar_path text;

-- Existing project-file policies assumed that every second path segment was a
-- project UUID. Make that conversion safe now that profile avatars live in a
-- `profile` folder beneath the same bucket.
drop policy if exists bookez_files_select_own on storage.objects;
create policy bookez_files_select_own on storage.objects for select to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from bookez.projects p
    where p.id = case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[2]::uuid
      else null
    end
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists bookez_files_insert_own on storage.objects;
create policy bookez_files_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from bookez.projects p
    where p.id = case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[2]::uuid
      else null
    end
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists bookez_files_update_own on storage.objects;
create policy bookez_files_update_own on storage.objects for update to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from bookez.projects p
    where p.id = case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[2]::uuid
      else null
    end
      and p.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from bookez.projects p
    where p.id = case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[2]::uuid
      else null
    end
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists bookez_files_delete_own on storage.objects;
create policy bookez_files_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from bookez.projects p
    where p.id = case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (storage.foldername(name))[2]::uuid
      else null
    end
      and p.user_id = (select auth.uid())
  )
);

-- Profile avatars use a non-project folder, so let a writer manage only their
-- own `${user_id}/profile/community-avatar` object. The existing project-file
-- policies remain in place for every other file.
create policy bookez_files_select_own_profile_avatar on storage.objects for select to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'profile'
  and storage.filename(name) = 'community-avatar'
);

create policy bookez_files_insert_own_profile_avatar on storage.objects for insert to authenticated
with check (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'profile'
  and storage.filename(name) = 'community-avatar'
);

create policy bookez_files_update_own_profile_avatar on storage.objects for update to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'profile'
  and storage.filename(name) = 'community-avatar'
)
with check (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'profile'
  and storage.filename(name) = 'community-avatar'
);

create policy bookez_files_delete_own_profile_avatar on storage.objects for delete to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'profile'
  and storage.filename(name) = 'community-avatar'
);

create or replace function bookez.can_view_community_avatar(p_path text)
returns boolean
language sql
security definer
set search_path = bookez, public, pg_temp
as $$
  select exists (
    select 1
    from bookez.community_profiles profile
    join bookez.community_preferences pref on pref.user_id = profile.user_id
    where profile.user_id::text = split_part(p_path, '/', 1)
      and profile.avatar_path = p_path
      and pref.show_profile
      and pref.show_current_project
  )
  and not exists (
    select 1
    from bookez.community_blocks block
    where (block.blocker_id = auth.uid() and block.blocked_id::text = split_part(p_path, '/', 1))
       or (block.blocker_id::text = split_part(p_path, '/', 1) and block.blocked_id = auth.uid())
  );
$$;

create policy bookez_files_select_community_avatar on storage.objects
for select to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[2] = 'profile'
  and storage.filename(name) = 'community-avatar'
  and bookez.can_view_community_avatar(name)
);

create or replace function bookez.get_community_feed(p_limit integer default 60, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = bookez, public, pg_temp
as $$
declare
  viewer uuid := auth.uid();
  result jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(feed_row) order by feed_row.updated_at desc), '[]'::jsonb)
  into result
  from (
    select
      cp.project_id,
      cp.user_id,
      case when pref.show_profile then coalesce(profile.display_name, 'Bookez writer') else 'Bookez writer' end as display_name,
      case when pref.show_profile then profile.bio else null end as bio,
      case when pref.show_profile then profile.avatar_path else null end as avatar_path,
      case when pref.show_project_title then cp.project_title else null end as project_title,
      case when pref.show_genre then cp.genre else null end as genre,
      case when pref.show_genre then cp.project_type else null end as project_type,
      case when pref.show_completion_percent then cp.completion_percent else null end as completion_percent,
      case when pref.show_current_stage then cp.stage else null end as stage,
      case when pref.show_current_stage then cp.public_status else null end as public_status,
      case when pref.show_writing_now and presence.active_until > now() then true else false end as writing_now,
      case when pref.show_completed_projects and project.status = 'completed' then true else false end as completed,
      case when pref.show_completed_projects and project.status = 'completed' then 'Finished recently' else null end as finished_label,
      cp.cover_color,
      case when pref.show_current_project and pref.show_project_title then cp.cover_image_path else null end as cover_image_path,
      profile.avatar_initials,
      cp.updated_at
    from community_projects cp
    join community_preferences pref on pref.user_id = cp.user_id and pref.show_profile and pref.show_current_project
    left join community_profiles profile on profile.user_id = cp.user_id
    join projects project on project.id = cp.project_id and project.user_id = cp.user_id and project.deleted_at is null and project.status <> 'archived'
    left join community_presence presence on presence.user_id = cp.user_id
    where (viewer is null or not exists (select 1 from community_blocks block where (block.blocker_id = viewer and block.blocked_id = cp.user_id) or (block.blocker_id = cp.user_id and block.blocked_id = viewer)))
    order by cp.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 60), 100)) offset greatest(0, coalesce(p_offset, 0))
  ) feed_row;
  return result;
end;
$$;

revoke all on function bookez.can_view_community_avatar(text) from public;
grant execute on function bookez.can_view_community_avatar(text) to authenticated;
