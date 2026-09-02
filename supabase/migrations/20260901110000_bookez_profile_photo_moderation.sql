-- Profile photos are moderated server-side before they are stored or exposed
-- through the Community avatar policies.

alter table bookez.community_profiles
  add column if not exists avatar_updated_at timestamptz,
  add column if not exists avatar_moderation_notice_at timestamptz;

grant select, update on bookez.community_profiles to service_role;

create table if not exists bookez.profile_photo_moderation_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists profile_photo_moderation_attempts_user_created_idx
  on bookez.profile_photo_moderation_attempts(user_id, created_at desc);

alter table bookez.profile_photo_moderation_attempts enable row level security;

-- This table is intentionally service-role-only. The Edge Function reserves a
-- small number of attempts before calling OpenAI to prevent abuse and cost
-- spikes without exposing a client-controlled counter.
revoke all on table bookez.profile_photo_moderation_attempts from public, anon, authenticated;
grant all privileges on table bookez.profile_photo_moderation_attempts to service_role;

create or replace function bookez.reserve_profile_photo_moderation(p_user_id uuid)
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

  delete from bookez.profile_photo_moderation_attempts
  where created_at < now() - interval '1 day';

  select count(*)::integer
  into recent_attempts
  from bookez.profile_photo_moderation_attempts
  where user_id = p_user_id
    and created_at >= now() - interval '15 minutes';

  if recent_attempts >= 5 then
    return false;
  end if;

  insert into bookez.profile_photo_moderation_attempts(user_id)
  values (p_user_id);
  return true;
end;
$$;

revoke all on function bookez.reserve_profile_photo_moderation(uuid) from public, anon, authenticated;
grant execute on function bookez.reserve_profile_photo_moderation(uuid) to service_role;

-- The client must not be able to write a profile avatar directly. The
-- moderate-image function uses the service role only after OpenAI
-- approves the normalized JPEG bytes.
drop policy if exists bookez_files_insert_own_profile_avatar on storage.objects;
drop policy if exists bookez_files_update_own_profile_avatar on storage.objects;
drop policy if exists bookez_files_delete_own_profile_avatar on storage.objects;

-- Keep legacy avatars readable to their owner while allowing the function's
-- immutable, cache-friendly avatar-${uuid}.jpg paths.
drop policy if exists bookez_files_select_own_profile_avatar on storage.objects;
create policy bookez_files_select_own_profile_avatar on storage.objects for select to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'profile'
  and (
    storage.filename(name) = 'community-avatar'
    or storage.filename(name) ~ '^avatar-[0-9a-f-]+[.]jpg$'
  )
);

drop policy if exists bookez_files_select_community_avatar on storage.objects;
create policy bookez_files_select_community_avatar on storage.objects
for select to authenticated
using (
  bucket_id = 'bookez-files'
  and (storage.foldername(name))[2] = 'profile'
  and storage.filename(name) ~ '^avatar-[0-9a-f-]+[.]jpg$'
  and bookez.can_view_community_avatar(name)
);
