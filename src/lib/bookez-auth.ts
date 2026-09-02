import * as Linking from 'expo-linking';
import { supabase, bookezEmailConfirmationRedirectUrl, bookezRedirectUrl } from './supabase';

export const getBookezAuthRedirect = () => bookezRedirectUrl;

const minimumPasswordLength = 10;

export function isBookezPasswordValid(password: string) {
  return password.length >= minimumPasswordLength
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

export function isTrustedBookezAuthCallback(url: string) {
  try {
    const expected = new URL(bookezRedirectUrl);
    const received = new URL(url);
    return received.protocol === expected.protocol
      && received.hostname === expected.hostname
      && received.pathname === expected.pathname;
  } catch {
    return false;
  }
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  if (!isBookezPasswordValid(password)) {
    throw new Error('Use at least 10 characters with uppercase, lowercase, and a number.');
  }
  const result = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { source_app: 'bookez', display_name: displayName?.trim() || undefined }, emailRedirectTo: bookezEmailConfirmationRedirectUrl },
  });
  if (result.error) throw result.error;
  // With confirmations enabled Supabase returns a user without a session.
  // Wait to create the Bookez profile until the user confirms and signs in.
  if (result.data.user && result.data.session) await ensureBookezProfile(result.data.user.id, displayName);
  return { ...result.data, needsEmailConfirmation: Boolean(result.data.user && !result.data.session) };
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: bookezEmailConfirmationRedirectUrl },
  });
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (result.error) {
    const message = result.error.message.toLowerCase();
    if (result.error.code === 'email_not_confirmed' || message.includes('email not confirmed') || message.includes('confirm your email')) {
      throw new Error('Please confirm your email before signing in. Check your inbox or resend the verification email.');
    }
    throw result.error;
  }
  if (result.data.user) await ensureBookezProfile(result.data.user.id, result.data.user.user_metadata?.display_name);
  return result.data;
}

export async function signOutBookez() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Permanently removes Bookez data owned by the currently signed-in user.
 * This intentionally does not delete the shared CityPeak/Supabase Auth
 * account; it deletes the Bookez profile, projects, and private files only.
 * RLS still enforces that every operation can affect only the current user.
 */
export async function deleteBookezData() {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userResult.user;
  if (!user) throw new Error('Sign in before deleting Bookez data.');

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', user.id);
  if (projectsError) throw projectsError;

  // Files must be removed before projects because the storage policy checks
  // that the referenced project still belongs to the current user.
  for (const project of projects ?? []) {
    const folder = `${user.id}/${project.id}`;
    const paths: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: filesError } = await supabase.storage.from('bookez-files').list(folder, { limit: 1000, offset });
      if (filesError) throw filesError;
      paths.push(...(files ?? []).filter((file) => Boolean(file.id)).map((file) => `${folder}/${file.name}`));
      if (!files || files.length < 1000) break;
    }
    if (paths.length) {
      const { error: removeError } = await supabase.storage.from('bookez-files').remove(paths);
      if (removeError) throw removeError;
    }
  }

  const { error: projectsDeleteError } = await supabase.from('projects').delete().eq('user_id', user.id);
  if (projectsDeleteError) throw projectsDeleteError;
  const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('user_id', user.id);
  if (profileDeleteError) throw profileDeleteError;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: bookezRedirectUrl });
  if (error) throw error;
}

export async function updateBookezPassword(password: string) {
  if (!isBookezPasswordValid(password)) {
    throw new Error('Use at least 10 characters with uppercase, lowercase, and a number.');
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function handleBookezAuthUrl(url: string): Promise<{ type?: 'recovery' } | undefined> {
  if (!isTrustedBookezAuthCallback(url)) return;
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const code = typeof query.code === 'string' ? query.code : undefined;
  const hash = new URL(url).hash.replace(/^#/, '');
  const hashParams = hash ? new URLSearchParams(hash) : null;
  const hashType = hashParams?.get('type') ?? null;
  const callbackType = typeof query.type === 'string' ? query.type : hashType;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (hashParams) {
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    }
  }
  return callbackType === 'recovery' ? { type: 'recovery' } : {};
}

export async function ensureBookezProfile(userId: string, displayName?: string) {
  const existing = await supabase.from('profiles').select('user_id').eq('user_id', userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const inserted = await supabase.from('profiles').insert({ user_id: userId, display_name: displayName?.trim() || null }).select('user_id,display_name,onboarding_completed,current_project_id,created_at,updated_at').single();
  if (inserted.error) {
    const raced = await supabase.from('profiles').select('user_id,display_name,onboarding_completed,current_project_id,created_at,updated_at').eq('user_id', userId).maybeSingle();
    if (raced.error || !raced.data) throw inserted.error;
    return raced.data;
  }
  return inserted.data;
}

export async function markBookezOnboardingCompleted(userId: string) {
  const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('user_id', userId);
  if (error) throw error;
}
