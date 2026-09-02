-- Lightweight writer-to-writer follows for the public Community layer.
-- Follow rows never expose manuscript content or private account details.

create table if not exists bookez.community_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint community_follows_not_self check (follower_id <> following_id)
);

create index if not exists community_follows_following_idx
  on bookez.community_follows (following_id, created_at desc);

create index if not exists community_follows_follower_idx
  on bookez.community_follows (follower_id, created_at desc);

alter table bookez.community_follows enable row level security;

drop policy if exists community_follows_select on bookez.community_follows;
create policy community_follows_select on bookez.community_follows
for select to authenticated
using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);

drop policy if exists community_follows_insert on bookez.community_follows;
create policy community_follows_insert on bookez.community_follows
for insert to authenticated
with check ((select auth.uid()) = follower_id and follower_id <> following_id);

drop policy if exists community_follows_delete on bookez.community_follows;
create policy community_follows_delete on bookez.community_follows
for delete to authenticated
using ((select auth.uid()) = follower_id);

grant select, insert, delete on bookez.community_follows to authenticated;
grant all privileges on bookez.community_follows to service_role;

create or replace function bookez.get_community_writer_profile(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = bookez, public, pg_temp
as $$
with writer as (
  select
    profile.user_id,
    coalesce(community_profile.display_name, profile.display_name, 'Bookez writer') as display_name,
    community_profile.bio,
    community_profile.avatar_initials,
    community_profile.avatar_path,
    profile.created_at as joined_at,
    coalesce(preference.show_profile, false) as show_profile,
    coalesce(preference.show_current_project, false) as show_current_project,
    coalesce(preference.show_project_title, false) as show_project_title,
    coalesce(preference.show_genre, false) as show_genre,
    coalesce(preference.show_completion_percent, false) as show_completion_percent,
    coalesce(preference.show_current_stage, false) as show_current_stage,
    coalesce(preference.show_completed_projects, false) as show_completed_projects,
    profile.user_id = auth.uid() as is_self
  from bookez.profiles profile
  left join bookez.community_profiles community_profile on community_profile.user_id = profile.user_id
  left join bookez.community_preferences preference on preference.user_id = profile.user_id
  where profile.user_id = p_user_id
    and (
      profile.user_id = auth.uid()
      or (
        coalesce(preference.show_profile, false)
        and coalesce(preference.show_current_project, false)
        and exists (
          select 1
          from bookez.community_projects public_project
          join bookez.projects source_project on source_project.id = public_project.project_id
            and source_project.user_id = public_project.user_id
            and source_project.deleted_at is null
            and source_project.status <> 'archived'
          where public_project.user_id = profile.user_id
            and public_project.show_in_community
        )
        and not exists (
          select 1
          from bookez.community_blocks blocked
          where (blocked.blocker_id = auth.uid() and blocked.blocked_id = profile.user_id)
             or (blocked.blocker_id = profile.user_id and blocked.blocked_id = auth.uid())
        )
      )
    )
), public_books as (
  select
    project.project_id,
    case when writer.is_self or writer.show_project_title then project.project_title else null end as project_title,
    case when writer.is_self or writer.show_genre then coalesce(project.genre, project.project_type) else null end as genre,
    case when writer.is_self or writer.show_genre then project.project_type else null end as project_type,
    case when writer.is_self or writer.show_completion_percent then project.completion_percent else null end as completion_percent,
    case when writer.is_self or writer.show_current_stage then project.stage else null end as stage,
    case when writer.is_self or writer.show_current_stage then project.public_status else null end as public_status,
    case when writer.is_self or writer.show_completed_projects then source_project.status = 'completed' else false end as completed,
    case when writer.is_self or writer.show_completed_projects then case when source_project.status = 'completed' then 'Finished recently' else null end else null end as finished_label,
    project.cover_color,
    case when writer.is_self or writer.show_project_title then project.cover_image_path else null end as cover_image_path,
    project.updated_at,
    source_project.current_word_count
  from writer
  join bookez.community_projects project on project.user_id = writer.user_id
    and project.show_in_community
  join bookez.projects source_project on source_project.id = project.project_id
    and source_project.user_id = project.user_id
    and source_project.deleted_at is null
    and source_project.status <> 'archived'
), summary as (
  select
    count(*)::integer as books_written,
    coalesce(sum(public_books.current_word_count), 0)::integer as words_written,
    count(*) filter (where public_books.completed)::integer as books_completed
  from public_books
)
select jsonb_build_object(
  'user_id', writer.user_id,
  'display_name', writer.display_name,
  'bio', case when writer.is_self or writer.show_profile then writer.bio else null end,
  'avatar_initials', case when writer.is_self or writer.show_profile then writer.avatar_initials else null end,
  'avatar_path', case when writer.is_self or writer.show_profile then writer.avatar_path else null end,
  'joined_at', writer.joined_at,
  'is_self', writer.is_self,
  'is_public', writer.is_self or (writer.show_profile and writer.show_current_project),
  'is_following', exists (
    select 1
    from bookez.community_follows follow
    where follow.follower_id = auth.uid()
      and follow.following_id = writer.user_id
  ),
  'books', coalesce((select jsonb_agg(to_jsonb(public_books) order by public_books.updated_at desc) from public_books), '[]'::jsonb),
  'stats', jsonb_build_object(
    'books_written', summary.books_written,
    'words_written', summary.words_written,
    'books_completed', summary.books_completed,
    'followers', (select count(*)::integer from bookez.community_follows follow where follow.following_id = writer.user_id),
    'following', (select count(*)::integer from bookez.community_follows follow where follow.follower_id = writer.user_id)
  )
)
from writer
cross join summary;
$$;

create or replace function bookez.set_community_follow(p_following_id uuid, p_follow boolean)
returns boolean
language plpgsql
security definer
set search_path = bookez, public, pg_temp
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null or p_following_id is null or viewer = p_following_id then
    return false;
  end if;

  if p_follow and not exists (
    select 1
    from bookez.community_preferences preference
    where preference.user_id = p_following_id
      and preference.show_profile
      and preference.show_current_project
      and exists (
        select 1
        from bookez.community_projects public_project
        join bookez.projects source_project on source_project.id = public_project.project_id
          and source_project.user_id = public_project.user_id
          and source_project.deleted_at is null
          and source_project.status <> 'archived'
        where public_project.user_id = p_following_id
          and public_project.show_in_community
      )
  ) then
    return false;
  end if;

  if exists (
    select 1
    from bookez.community_blocks blocked
    where (blocked.blocker_id = viewer and blocked.blocked_id = p_following_id)
       or (blocked.blocker_id = p_following_id and blocked.blocked_id = viewer)
  ) then
    return false;
  end if;

  if p_follow then
    insert into bookez.community_follows (follower_id, following_id)
    values (viewer, p_following_id)
    on conflict (follower_id, following_id) do nothing;
  else
    delete from bookez.community_follows
    where follower_id = viewer
      and following_id = p_following_id;
  end if;

  return p_follow;
end;
$$;

revoke all on function bookez.get_community_writer_profile(uuid) from public;
revoke all on function bookez.set_community_follow(uuid, boolean) from public;
grant execute on function bookez.get_community_writer_profile(uuid) to authenticated;
grant execute on function bookez.set_community_follow(uuid, boolean) to authenticated;
