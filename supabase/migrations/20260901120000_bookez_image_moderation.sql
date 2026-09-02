-- All authenticated Bookez image moderation uses the same Edge Function and
-- the same OPENAI_MODERATION_API_KEY, regardless of image purpose.

create table if not exists bookez.image_moderation_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists image_moderation_attempts_user_created_idx
  on bookez.image_moderation_attempts(user_id, created_at desc);

alter table bookez.image_moderation_attempts enable row level security;

revoke all on table bookez.image_moderation_attempts from public, anon, authenticated;
grant all privileges on table bookez.image_moderation_attempts to service_role;

create or replace function bookez.reserve_image_moderation(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = bookez, public, pg_temp
as $$
declare
  recent_attempts integer;
begin
  if p_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  delete from bookez.image_moderation_attempts
  where created_at < now() - interval '1 day';

  select count(*)::integer
  into recent_attempts
  from bookez.image_moderation_attempts
  where user_id = p_user_id
    and created_at >= now() - interval '15 minutes';

  if recent_attempts >= 5 then
    return false;
  end if;

  insert into bookez.image_moderation_attempts(user_id)
  values (p_user_id);
  return true;
end;
$$;

revoke all on function bookez.reserve_image_moderation(uuid) from public, anon, authenticated;
grant execute on function bookez.reserve_image_moderation(uuid) to service_role;

-- Generic project-file uploads remain available for non-image attachments.
-- Image-looking files and image MIME types must go through moderate-image.
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
  and lower(coalesce(metadata->>'mimetype', '')) not like 'image/%'
  and storage.filename(name) !~* '[.](avif|bmp|gif|heic|heif|jpeg|jpg|png|webp)$'
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
  and lower(coalesce(metadata->>'mimetype', '')) not like 'image/%'
  and storage.filename(name) !~* '[.](avif|bmp|gif|heic|heif|jpeg|jpg|png|webp)$'
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
  and lower(coalesce(metadata->>'mimetype', '')) not like 'image/%'
  and storage.filename(name) !~* '[.](avif|bmp|gif|heic|heif|jpeg|jpg|png|webp)$'
);
