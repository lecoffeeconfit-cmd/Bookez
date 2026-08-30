-- Let each writing project opt into the public Community progress feed.
-- This feed contains only project metadata; manuscript text, notes, and
-- research remain private and are never selected here.

alter table bookez.community_projects
  add column if not exists show_in_community boolean not null default false;

alter table bookez.community_projects
  add column if not exists show_preview boolean not null default false;

-- Preserve the previous Community behavior for rows that were already shared
-- through the original current-project preference.
update bookez.community_projects project
set show_in_community = true
where project.show_in_community = false
  and exists (
    select 1
    from bookez.community_preferences preference
    where preference.user_id = project.user_id
      and preference.show_current_project
  );

create index if not exists community_projects_public_idx
  on bookez.community_projects (updated_at desc)
  where show_in_community;

-- Reading previews are explicit, capped snapshots. They are kept separate from
-- the lightweight project metadata and are never exposed through table reads.
create table if not exists bookez.community_project_previews (
  project_id uuid primary key references bookez.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null default '[]'::jsonb,
  word_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint community_project_previews_content_array check (jsonb_typeof(content) = 'array'),
  constraint community_project_previews_word_count_range check (word_count between 0 and 20000)
);

create index if not exists community_project_previews_user_idx
  on bookez.community_project_previews(user_id, updated_at desc);

create trigger community_project_previews_set_updated_at
before update on bookez.community_project_previews
for each row execute function bookez.set_updated_at();

alter table bookez.community_project_previews enable row level security;

drop policy if exists community_project_previews_own on bookez.community_project_previews;
create policy community_project_previews_own
on bookez.community_project_previews for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on bookez.community_project_previews to authenticated;
grant all privileges on bookez.community_project_previews to service_role;

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
      and exists (
        select 1
        from bookez.community_projects project
        where project.user_id = profile.user_id
          and project.show_in_community
      )
  )
  and not exists (
    select 1
    from bookez.community_blocks block
    where (block.blocker_id = auth.uid() and block.blocked_id::text = split_part(p_path, '/', 1))
       or (block.blocker_id::text = split_part(p_path, '/', 1) and block.blocked_id = auth.uid())
  );
$$;

create or replace function bookez.can_view_community_cover(p_path text)
returns boolean
language sql
security definer
set search_path = bookez, public, pg_temp
as $$
  select exists (
    select 1
    from bookez.community_projects project
    where project.user_id::text = split_part(p_path, '/', 1)
      and project.project_id::text = split_part(p_path, '/', 2)
      and project.show_in_community
      and project.cover_image_path = p_path
  )
  and not exists (
    select 1
    from bookez.community_blocks block
    where (block.blocker_id = auth.uid() and block.blocked_id::text = split_part(p_path, '/', 1))
       or (block.blocker_id::text = split_part(p_path, '/', 1) and block.blocked_id = auth.uid())
  );
$$;

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
      case when coalesce(pref.show_profile, false) then coalesce(profile.display_name, 'Bookez writer') else 'Bookez writer' end as display_name,
      case when coalesce(pref.show_profile, false) then profile.bio else null end as bio,
      case when coalesce(pref.show_profile, false) then profile.avatar_path else null end as avatar_path,
      cp.project_title,
      cp.genre,
      cp.project_type,
      cp.completion_percent,
      cp.stage,
      cp.public_status,
      case when coalesce(pref.show_writing_now, false) and presence.active_until > now() then true else false end as writing_now,
      case when coalesce(pref.show_completed_projects, false) and project.status = 'completed' then true else false end as completed,
      case when coalesce(pref.show_completed_projects, false) and project.status = 'completed' then 'Finished recently' else null end as finished_label,
      cp.cover_color,
      cp.cover_image_path,
      case when cp.show_preview and exists (
        select 1
        from bookez.community_project_previews preview
        where preview.project_id = cp.project_id
          and preview.word_count > 0
      ) then true else false end as preview_available,
      profile.avatar_initials,
      cp.updated_at
    from bookez.community_projects cp
    left join bookez.community_preferences pref on pref.user_id = cp.user_id
    left join bookez.community_profiles profile on profile.user_id = cp.user_id
    join bookez.projects project on project.id = cp.project_id
      and project.user_id = cp.user_id
      and project.deleted_at is null
      and project.status <> 'archived'
    left join bookez.community_presence presence on presence.user_id = cp.user_id
    where cp.show_in_community
      and not exists (
        select 1
        from bookez.community_blocks block
        where (block.blocker_id = viewer and block.blocked_id = cp.user_id)
           or (block.blocker_id = cp.user_id and block.blocked_id = viewer)
      )
    order by cp.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 60), 100)) offset greatest(0, coalesce(p_offset, 0))
  ) feed_row;
  return result;
end;
$$;

revoke all on function bookez.can_view_community_avatar(text) from public;
revoke all on function bookez.can_view_community_cover(text) from public;
revoke all on function bookez.get_community_feed(integer, integer) from public;
grant execute on function bookez.can_view_community_avatar(text) to authenticated;
grant execute on function bookez.can_view_community_cover(text) to authenticated;
grant execute on function bookez.get_community_feed(integer, integer) to authenticated;

create or replace function bookez.get_community_project_preview(p_project_id uuid)
returns jsonb
language sql
security definer
set search_path = bookez, public, pg_temp
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'project_id', preview.project_id,
        'project_title', project.project_title,
        'content', preview.content,
        'word_count', preview.word_count,
        'updated_at', preview.updated_at
      )
      from bookez.community_project_previews preview
      join bookez.community_projects project on project.project_id = preview.project_id
      join bookez.projects source_project on source_project.id = project.project_id
        and source_project.user_id = project.user_id
        and source_project.deleted_at is null
        and source_project.status <> 'archived'
      where preview.project_id = p_project_id
        and project.show_in_community
        and project.show_preview
        and not exists (
          select 1
          from bookez.community_blocks block
          where (block.blocker_id = auth.uid() and block.blocked_id = project.user_id)
             or (block.blocker_id = project.user_id and block.blocked_id = auth.uid())
        )
      limit 1
    ),
    jsonb_build_object('project_id', p_project_id, 'content', '[]'::jsonb, 'word_count', 0)
  );
$$;

revoke all on function bookez.get_community_project_preview(uuid) from public;
grant execute on function bookez.get_community_project_preview(uuid) to authenticated;
