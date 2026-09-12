import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { EmailOtpType, Provider } from '@supabase/supabase-js';
import { supabase, bookezEmailConfirmationRedirectUrl, bookezRedirectUrl } from './supabase';

export const getBookezAuthRedirect = () => bookezRedirectUrl;

export const normalizeBookezEmail = (email: string) => email.trim().toLowerCase();

export function bookezAuthCallbackErrorMessage(caught: unknown) {
  const message = caught instanceof Error ? caught.message.toLowerCase() : '';
  if (message.includes('expired') || message.includes('invalid') || message.includes('used')) {
    return 'This confirmation link may have expired or already been used. Request a new link and try again.';
  }
  return 'This confirmation link could not be completed. Request a new link and try again.';
}

export function isBookezEmailValid(email: string) {
  const normalized = normalizeBookezEmail(email);
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

export async function requestBookezEmailChange(email: string) {
  const normalizedEmail = normalizeBookezEmail(email);
  const result = await supabase.auth.updateUser(
    { email: normalizedEmail },
    { emailRedirectTo: bookezRedirectUrl },
  );
  if (result.error) throw result.error;
  return result.data.user;
}

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

/**
 * Starts a Supabase OAuth flow and completes the PKCE callback inside the
 * native auth browser. The app's existing auth-state listener then hydrates
 * the Bookez profile and cloud sync state.
 */
export async function signInWithOAuthProvider(provider: Provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: bookezRedirectUrl,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });
  if (error) throw error;

  if (Platform.OS === 'web') return true;
  if (!data.url) throw new Error(`${provider} sign-in did not return an authorization URL.`);

  const result = await WebBrowser.openAuthSessionAsync(data.url, bookezRedirectUrl);
  if (result.type !== 'success' || !result.url) return false;

  await handleBookezAuthUrl(result.url);
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  if (sessionResult.data.session?.user) {
    await ensureBookezProfile(sessionResult.data.session.user.id, sessionResult.data.session.user.user_metadata?.display_name);
  }
  return Boolean(sessionResult.data.session?.user);
}

/**
 * Uses Apple's native iOS sheet and exchanges its identity token for a
 * Supabase session. The hashed nonce is sent to Apple while Supabase receives
 * the original nonce, matching the OIDC replay-protection flow.
 */
export async function signInWithApple() {
  if (Platform.OS !== 'ios') throw new Error('Native Apple sign-in is only available on iOS.');
  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  const rawNonceBytes = await Crypto.getRandomBytesAsync(32);
  const rawNonce = Array.from(rawNonceBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (caught) {
    if (caught && typeof caught === 'object' && 'code' in caught && caught.code === 'ERR_REQUEST_CANCELED') return false;
    throw caught;
  }

  if (!credential.identityToken) throw new Error('Apple sign-in did not return an identity token.');
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  if (!data.session?.user) throw new Error('Apple sign-in did not return a Bookez session.');

  const displayName = credential.fullName ? AppleAuthentication.formatFullName(credential.fullName).trim() : undefined;
  await ensureBookezProfile(data.session.user.id, displayName);
  return true;
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

/**
 * Permanently deletes the signed-in Supabase Auth user and every Bookez file
 * owned by that user. The service-role operation stays inside the protected
 * Edge Function; the app sends only the current user's access token.
 */
export async function deleteBookezAccount() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('Sign in before deleting your Bookez account.');

  const { data, error } = await supabase.functions.invoke<{ deleted?: boolean }>('delete-bookez-account', {
    body: { confirmation: 'DELETE' },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error || data?.deleted !== true) {
    throw new Error('Bookez could not delete your account. Your account is still active; please try again.');
  }

  // The server has invalidated the user. Clear the persisted device session
  // locally as well without depending on another authenticated request.
  await supabase.auth.signOut({ scope: 'local' });
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

export async function handleBookezAuthUrl(url: string): Promise<{ type?: 'recovery' | 'email_change' } | undefined> {
  if (!isTrustedBookezAuthCallback(url)) return;
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const hash = new URL(url).hash.replace(/^#/, '');
  const hashParams = hash ? new URLSearchParams(hash) : null;
  const getParam = (name: string) => {
    const queryValue = query[name];
    if (typeof queryValue === 'string') return queryValue;
    return hashParams?.get(name) ?? null;
  };
  const code = getParam('code');
  const tokenHash = getParam('token_hash');
  const callbackType = getParam('type');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (tokenHash && callbackType) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: callbackType as EmailOtpType });
    if (error) throw error;
  }
  return callbackType === 'recovery' || callbackType === 'email_change' ? { type: callbackType } : {};
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
