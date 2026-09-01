-- Track unique signed-in Community viewers for public project cards.
-- The table is intentionally private; owners receive counts through the
-- security-definer summary function below rather than raw viewer identities.

create table if not exists bookez.community_project_views (
  project_id uuid not null references bookez.projects(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  primary key (project_id, viewer_id)
);

create index if not exists community_project_views_project_idx
  on bookez.community_project_views(project_id, last_viewed_at desc);

alter table bookez.community_project_views enable row level security;

revoke all on bookez.community_project_views from authenticated;
grant all privileges on bookez.community_project_views to service_role;

create or replace function bookez.record_community_project_view(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = bookez, public, pg_temp
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null then
    return false;
  end if;

  insert into bookez.community_project_views (project_id, viewer_id)
  select project.project_id, viewer
  from bookez.community_projects project
  where project.project_id = p_project_id
    and project.show_in_community
    and project.user_id <> viewer
    and not exists (
      select 1
      from bookez.community_blocks block
      where (block.blocker_id = viewer and block.blocked_id = project.user_id)
         or (block.blocker_id = project.user_id and block.blocked_id = viewer)
    )
  on conflict (project_id, viewer_id) do update
    set last_viewed_at = now();

  return true;
end;
$$;

create or replace function bookez.get_community_project_engagement(p_project_ids uuid[])
returns jsonb
language sql
security definer
set search_path = bookez, public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'project_id', summary.project_id,
        'view_count', summary.view_count,
        'reaction_count', summary.reaction_count
      )
      order by summary.project_id
    ),
    '[]'::jsonb
  )
  from (
    select
      project.project_id,
      count(distinct view.viewer_id)::integer as view_count,
      count(distinct reaction.user_id)::integer as reaction_count
    from bookez.community_projects project
    left join bookez.community_project_views view
      on view.project_id = project.project_id
    left join bookez.community_reactions reaction
      on reaction.item_id = project.project_id
     and reaction.item_type = 'project'
    where project.user_id = auth.uid()
      and project.project_id = any(coalesce(p_project_ids, '{}'::uuid[]))
    group by project.project_id
  ) summary;
$$;

revoke all on function bookez.record_community_project_view(uuid) from public;
revoke all on function bookez.get_community_project_engagement(uuid[]) from public;
grant execute on function bookez.record_community_project_view(uuid) to authenticated;
grant execute on function bookez.get_community_project_engagement(uuid[]) to authenticated;
