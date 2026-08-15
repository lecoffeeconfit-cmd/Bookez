import { supabase } from './supabase';

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 160) || 'attachment';

export async function uploadBookezFile(userId: string, projectId: string, uri: string, fileName: string, contentType = 'application/octet-stream') {
  const path = `${userId}/${projectId}/${safeFileName(fileName)}`;
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not read the file for upload (${response.status}).`);
  const blob = await response.blob();
  const { data, error } = await supabase.storage.from('bookez-files').upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
  return { path: data.path, bucket: 'bookez-files' };
}

/** Uploads the one image used for a writer's public-facing Community avatar. */
export async function uploadBookezProfileAvatar(userId: string, uri: string, contentType = 'image/jpeg') {
  const path = `${userId}/profile/community-avatar`;
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not read the photo for upload (${response.status}).`);
  const blob = await response.blob();
  const { data, error } = await supabase.storage.from('bookez-files').upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
  return { path: data.path, bucket: 'bookez-files' };
}

export async function removeBookezFile(path: string) {
  const { error } = await supabase.storage.from('bookez-files').remove([path]);
  if (error) throw error;
}
