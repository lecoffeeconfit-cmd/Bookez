-- Local-first sync foundation for Bookez.
-- Revisions are server-owned and are used to reject stale writes instead of
-- silently overwriting a newer copy from another device.

alter table bookez.projects
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table bookez.chapters
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table bookez.plan_settings
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz,
  add column if not exists plan_json jsonb not null default '{}'::jsonb;

create index if not exists projects_user_updated_id_idx
  on bookez.projects (user_id, updated_at, id);
create index if not exists chapters_user_updated_id_idx
  on bookez.chapters (user_id, updated_at, id);
create index if not exists chapters_project_updated_id_idx
  on bookez.chapters (project_id, updated_at, id);
create index if not exists plan_settings_user_updated_id_idx
  on bookez.plan_settings (user_id, updated_at, id);

create or replace function bookez.update_project_if_revision(
  p_id uuid,
  p_user_id uuid,
  p_expected_revision bigint,
  p_title text,
  p_writing_type text,
  p_target_words integer,
  p_target_chapters integer,
  p_status text,
  p_current_word_count integer,
  p_deleted_at timestamptz default null
)
returns bookez.projects
language plpgsql
security invoker
set search_path = bookez, public, pg_temp
as $$
declare
  current_row bookez.projects;
  saved_row bookez.projects;
begin
  select * into current_row
  from bookez.projects
  where id = p_id and user_id = p_user_id
  for update;

  if current_row is null then
    if coalesce(p_expected_revision, 0) <> 0 then
      raise exception 'BOOKEZ_CONFLICT:missing';
    end if;

    insert into bookez.projects (
      id, user_id, title, writing_type, target_words, target_chapters,
      status, current_word_count, revision, deleted_at
    ) values (
      p_id, p_user_id, p_title, p_writing_type, p_target_words, p_target_chapters,
      p_status, coalesce(p_current_word_count, 0), 1, p_deleted_at
    ) returning * into saved_row;
    return saved_row;
  end if;

  if current_row.revision <> coalesce(p_expected_revision, 0) then
    raise exception 'BOOKEZ_CONFLICT:%', current_row.revision;
  end if;

  update bookez.projects
  set title = p_title,
      writing_type = p_writing_type,
      target_words = p_target_words,
      target_chapters = p_target_chapters,
      status = p_status,
      current_word_count = coalesce(p_current_word_count, 0),
      deleted_at = p_deleted_at,
      revision = current_row.revision + 1,
      updated_at = now()
  where id = p_id and user_id = p_user_id
  returning * into saved_row;

  return saved_row;
end;
$$;

create or replace function bookez.update_chapter_if_revision(
  p_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_expected_revision bigint,
  p_title text,
  p_position integer,
  p_content text,
  p_notes text,
  p_word_count integer,
  p_target_words integer,
  p_status text,
  p_deleted_at timestamptz default null
)
returns bookez.chapters
language plpgsql
security invoker
set search_path = bookez, public, pg_temp
as $$
declare
  current_row bookez.chapters;
  saved_row bookez.chapters;
begin
  select * into current_row
  from bookez.chapters
  where id = p_id and project_id = p_project_id and user_id = p_user_id
  for update;

  if current_row is null then
    if coalesce(p_expected_revision, 0) <> 0 then
      raise exception 'BOOKEZ_CONFLICT:missing';
    end if;

    insert into bookez.chapters (
      id, project_id, user_id, title, position, content, notes, word_count,
      target_words, status, revision, deleted_at
    ) values (
      p_id, p_project_id, p_user_id, p_title, p_position, coalesce(p_content, ''),
      coalesce(p_notes, ''), coalesce(p_word_count, 0), p_target_words, p_status, 1, p_deleted_at
    ) returning * into saved_row;
    return saved_row;
  end if;

  if current_row.revision <> coalesce(p_expected_revision, 0) then
    raise exception 'BOOKEZ_CONFLICT:%', current_row.revision;
  end if;

  update bookez.chapters
  set title = p_title,
      position = p_position,
      content = coalesce(p_content, ''),
      notes = coalesce(p_notes, ''),
      word_count = coalesce(p_word_count, 0),
      target_words = p_target_words,
      status = p_status,
      deleted_at = p_deleted_at,
      revision = current_row.revision + 1,
      updated_at = now()
  where id = p_id and project_id = p_project_id and user_id = p_user_id
  returning * into saved_row;

  return saved_row;
end;
$$;

revoke all on function bookez.update_project_if_revision(uuid, uuid, bigint, text, text, integer, integer, text, integer, timestamptz) from public;
revoke all on function bookez.update_chapter_if_revision(uuid, uuid, uuid, bigint, text, integer, text, text, integer, integer, text, timestamptz) from public;
grant execute on function bookez.update_project_if_revision(uuid, uuid, bigint, text, text, integer, integer, text, integer, timestamptz) to authenticated;
grant execute on function bookez.update_chapter_if_revision(uuid, uuid, uuid, bigint, text, integer, text, text, integer, integer, text, timestamptz) to authenticated;
