-- Additive, private notebooks. No existing page, manuscript or Community policy changes.
create table bookez.book_notes (
  id uuid primary key,
  project_id uuid not null references bookez.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint book_note_document_object check (jsonb_typeof(document) = 'object'),
  constraint book_note_document_size check (octet_length(document::text) <= 524288)
);
create index book_notes_owner_book_idx on bookez.book_notes(user_id, project_id);
alter table bookez.book_notes enable row level security;
revoke all on bookez.book_notes from public, anon, authenticated;
grant select on bookez.book_notes to authenticated;
grant all on bookez.book_notes to service_role;
create policy book_notes_read_own on bookez.book_notes for select to authenticated using (
  user_id = (select auth.uid()) and exists (
    select 1 from bookez.projects p where p.id = project_id and p.user_id = (select auth.uid()) and p.deleted_at is null
  )
);

create function bookez.save_book_note(p_id uuid, p_project_id uuid, p_document jsonb, p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path = bookez, public, pg_temp as $$
declare v_user uuid := auth.uid(); v_row bookez.book_notes; v_attachment jsonb;
begin
  if v_user is null then raise exception 'Sign in to sync notes.' using errcode = '42501'; end if;
  if not exists(select 1 from bookez.projects where id = p_project_id and user_id = v_user and deleted_at is null) then
    raise exception 'This book is not available to your account.' using errcode = '42501';
  end if;
  if p_id is null or p_expected_revision is null or p_expected_revision < 0 or p_document is null
    or jsonb_typeof(p_document) is distinct from 'object' or octet_length(p_document::text) > 524288
    or p_document->>'id' is distinct from p_id::text or p_document->>'bookId' is distinct from p_project_id::text
    or jsonb_typeof(p_document->'title') is distinct from 'string' or char_length(p_document->>'title') > 200
    or jsonb_typeof(p_document->'content') is distinct from 'string' or char_length(p_document->>'content') > 100000
    or coalesce(p_document->>'status','') not in ('active','archived','trash')
    or jsonb_typeof(p_document->'links') is distinct from 'array' or jsonb_array_length(p_document->'links') > 100
    or jsonb_typeof(p_document->'attachments') is distinct from 'array' or jsonb_array_length(p_document->'attachments') > 30 then
    raise exception 'Invalid note.' using errcode = '22023';
  end if;
  for v_attachment in select value from jsonb_array_elements(p_document->'attachments') loop
    if v_attachment ? 'storagePath' and v_attachment->>'storagePath' not like v_user::text || '/' || p_project_id::text || '/%' then
      raise exception 'Attachment belongs to another book.' using errcode = '42501';
    end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into v_row from bookez.book_notes where id = p_id for update;
  if found then
    if v_row.user_id <> v_user or v_row.project_id <> p_project_id then raise exception 'Note access denied.' using errcode = '42501'; end if;
    -- A lost HTTP response can safely retry the same saved document.
    if v_row.document = p_document then return jsonb_build_object('saved',true,'entry',to_jsonb(v_row)); end if;
    if v_row.revision <> p_expected_revision then return jsonb_build_object('saved',false,'entry',to_jsonb(v_row)); end if;
    update bookez.book_notes set document = p_document, revision = revision + 1, updated_at = now() where id = p_id returning * into v_row;
  else
    if p_expected_revision <> 0 then raise exception 'Note revision is unavailable.' using errcode = '40001'; end if;
    insert into bookez.book_notes(id,project_id,user_id,document) values(p_id,p_project_id,v_user,p_document) returning * into v_row;
  end if;
  return jsonb_build_object('saved',true,'entry',to_jsonb(v_row));
end;
$$;
revoke all on function bookez.save_book_note(uuid,uuid,jsonb,integer) from public, anon;
grant execute on function bookez.save_book_note(uuid,uuid,jsonb,integer) to authenticated;
