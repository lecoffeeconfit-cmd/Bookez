-- Public, lightweight Community metadata for Bookez.
-- Manuscripts, chapters, notes, and writing sessions never enter these tables.

create table bookez.community_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_profile boolean not null default false,
  show_current_project boolean not null default false,
  show_project_title boolean not null default false,
  show_genre boolean not null default false,
  show_completion_percent boolean not null default false,
  show_current_stage boolean not null default false,
  show_current_section boolean not null default false,
  show_writing_now boolean not null default false,
  show_streak boolean not null default false,
  show_completed_projects boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bookez.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Bookez writer',
  bio text,
  avatar_initials text,
  updated_at timestamptz not null default now()
);

create table bookez.community_projects (
  project_id uuid primary key references bookez.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_title text,
  genre text,
  project_type text,
  description text,
  completion_percent integer,
  stage text,
  public_status text,
  cover_color text,
  updated_at timestamptz not null default now(),
  constraint community_projects_completion_range check (completion_percent is null or completion_percent between 0 and 100)
);

create table bookez.community_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  project_id uuid references bookez.projects(id) on delete cascade,
  active_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create table bookez.community_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references bookez.projects(id) on delete cascade,
  title text not null,
  kind text not null default 'progress',
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table bookez.community_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  item_type text not null default 'project',
  reaction_type text not null,
  created_at timestamptz not null default now(),
  constraint community_reactions_type check (reaction_type in ('keep_going', 'great_progress', 'congrats')),
  constraint community_reactions_item_type check (item_type in ('project', 'milestone')),
  constraint community_reactions_one_per_item unique (user_id, item_id, item_type)
);

create table bookez.community_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint community_blocks_not_self check (blocker_id <> blocked_id)
);

create table bookez.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references bookez.projects(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index community_projects_user_idx on bookez.community_projects(user_id, updated_at desc);
create index community_presence_expiry_idx on bookez.community_presence(active_until);
create index community_milestones_user_idx on bookez.community_milestones(user_id, completed_at desc);
create index community_reactions_item_idx on bookez.community_reactions(item_id, item_type);

create trigger community_preferences_set_updated_at before update on bookez.community_preferences for each row execute function bookez.set_updated_at();
create trigger community_profiles_set_updated_at before update on bookez.community_profiles for each row execute function bookez.set_updated_at();
create trigger community_projects_set_updated_at before update on bookez.community_projects for each row execute function bookez.set_updated_at();
create trigger community_presence_set_updated_at before update on bookez.community_presence for each row execute function bookez.set_updated_at();

alter table bookez.community_preferences enable row level security;
alter table bookez.community_profiles enable row level security;
alter table bookez.community_projects enable row level security;
alter table bookez.community_presence enable row level security;
alter table bookez.community_milestones enable row level security;
alter table bookez.community_reactions enable row level security;
alter table bookez.community_blocks enable row level security;
alter table bookez.community_reports enable row level security;

create policy community_preferences_own on bookez.community_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy community_profiles_own on bookez.community_profiles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy community_projects_own on bookez.community_projects for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy community_presence_own on bookez.community_presence for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy community_milestones_own on bookez.community_milestones for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy community_reactions_own on bookez.community_reactions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy community_blocks_own on bookez.community_blocks for all to authenticated using ((select auth.uid()) = blocker_id) with check ((select auth.uid()) = blocker_id);
create policy community_reports_own on bookez.community_reports for insert to authenticated with check ((select auth.uid()) = reporter_id);

grant select, insert, update, delete on all tables in schema bookez to authenticated;

-- The feed is security-definer and returns only explicitly shared fields. It
-- also removes blocked writers and expires presence in the database query.
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

create or replace function bookez.get_community_reaction_summary(p_item_ids uuid[])
returns jsonb
language sql
security definer
set search_path = bookez, public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('item_id', item_id, 'reaction_type', reaction_type, 'total', total)), '[]'::jsonb)
  from (select item_id, reaction_type, count(*)::integer as total from community_reactions where item_id = any(coalesce(p_item_ids, '{}'::uuid[])) group by item_id, reaction_type) summary;
$$;

revoke all on function bookez.get_community_feed(integer, integer) from public;
revoke all on function bookez.get_community_reaction_summary(uuid[]) from public;
grant execute on function bookez.get_community_feed(integer, integer) to authenticated;
grant execute on function bookez.get_community_reaction_summary(uuid[]) to authenticated;

grant all privileges on all tables in schema bookez to service_role;
