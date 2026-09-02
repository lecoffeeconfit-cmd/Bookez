import { createClient } from 'npm:@supabase/supabase-js@2';

const AVATAR_BUCKET = 'bookez-files';
const MAX_IMAGE_BYTES = 2_000_000;
const MAX_BASE64_LENGTH = 2_800_000;
const MAX_MODERATION_ATTEMPTS = 2;
const MODERATION_TIMEOUT_MS = 12_000;

export type ImagePurpose = 'profile-photo' | 'book-cover' | 'book-image' | 'community-image';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: corsHeaders,
});

class ImageRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'ImageRequestError';
  }
}

class ModerationProviderError extends Error {
  constructor(public readonly transient: boolean) {
    super('Image moderation provider unavailable.');
    this.name = 'ModerationProviderError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isImagePurpose = (value: unknown): value is ImagePurpose => value === 'profile-photo'
  || value === 'book-cover'
  || value === 'book-image'
  || value === 'community-image';

const normalizeBase64Image = (value: string) => {
  const comma = value.indexOf(',');
  const payload = value.startsWith('data:') && comma >= 0 ? value.slice(comma + 1) : value;
  return payload.replace(/\s/g, '');
};

const decodeJpeg = (value: string) => {
  const base64 = normalizeBase64Image(value);
  if (!base64 || base64.length > MAX_BASE64_LENGTH) {
    throw new ImageRequestError('avatar_image_too_large', 413);
  }

  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new ImageRequestError('avatar_image_invalid', 400);
  }

  if (binary.length === 0 || binary.length > MAX_IMAGE_BYTES || binary.length < 3) {
    throw new ImageRequestError('avatar_image_too_large', 413);
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new ImageRequestError('avatar_image_invalid', 400);
  }
  return { base64, bytes };
};

const getFirstJsonString = (value: string | undefined) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return null;
    return Object.values(parsed).find((item): item is string => typeof item === 'string' && item.length > 0) ?? null;
  } catch {
    return null;
  }
};

const getPublishableKey = () => Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  ?? Deno.env.get('SUPABASE_ANON_KEY')
  ?? getFirstJsonString(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'));

const getServiceRoleKey = () => Deno.env.get('SUPABASE_SECRET_KEY')
  ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  ?? getFirstJsonString(Deno.env.get('SUPABASE_SECRET_KEYS'));

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function moderateWithOpenAi(base64: string, openAiKey: string) {
  let lastError: ModerationProviderError | null = null;

  for (let attempt = 0; attempt < MAX_MODERATION_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'omni-moderation-latest',
          input: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const transient = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
        throw new ModerationProviderError(transient);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ModerationProviderError(true);
      }

      const firstResult = isRecord(payload) && Array.isArray(payload.results) ? payload.results[0] : null;
      if (!isRecord(firstResult) || typeof firstResult.flagged !== 'boolean') throw new ModerationProviderError(true);
      return firstResult.flagged;
    } catch (error) {
      const providerError = error instanceof ModerationProviderError ? error : new ModerationProviderError(true);
      lastError = providerError;
      if (!providerError.transient || attempt === MAX_MODERATION_ATTEMPTS - 1) break;
      await sleep(250 * (attempt + 1));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new ModerationProviderError(true);
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isUsersAvatarPath = (path: string, userId: string) => {
  const prefix = `${userId}/profile/`;
  if (!path.startsWith(prefix)) return false;
  const filename = path.slice(prefix.length);
  return filename === 'community-avatar' || /^avatar-[0-9a-f-]+[.]jpg$/.test(filename);
};

const projectImagePath = (purpose: ImagePurpose, userId: string, projectId: string) => {
  const prefix = purpose === 'book-cover' ? 'community-cover' : purpose === 'community-image' ? 'community-image' : 'book-image';
  return `${userId}/${projectId}/${prefix}-${crypto.randomUUID()}.jpg`;
};

const isUsersProjectImagePath = (path: string, userId: string, projectId: string) => {
  const prefix = `${userId}/${projectId}/`;
  if (!path.startsWith(prefix)) return false;
  const filename = path.slice(prefix.length);
  return /^(community-cover|community-image|book-image)-[A-Za-z0-9._-]+$/.test(filename);
};

export async function handleModerateImage(req: Request, legacyPurpose?: ImagePurpose) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'avatar_method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return jsonResponse({ error: 'avatar_authentication_required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = getPublishableKey();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !Deno.env.get('OPENAI_MODERATION_API_KEY')) {
    return jsonResponse({ error: 'avatar_moderation_configuration' }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    db: { schema: 'bookez' },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user?.id) return jsonResponse({ error: 'avatar_authentication_required' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'avatar_request_invalid' }, 400);
  }
  if (!isRecord(body) || typeof body.imageBase64 !== 'string' || body.moderationNoticeAccepted !== true) {
    return jsonResponse({ error: 'avatar_request_invalid' }, 400);
  }

  const purpose = isImagePurpose(body.purpose) ? body.purpose : legacyPurpose;
  if (!purpose) return jsonResponse({ error: 'avatar_request_invalid' }, 400);
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : 'image/jpeg';
  if (!mimeType.startsWith('image/')) return jsonResponse({ error: 'avatar_image_invalid' }, 400);

  let image: { base64: string; bytes: Uint8Array };
  try {
    image = decodeJpeg(body.imageBase64);
  } catch (error) {
    if (error instanceof ImageRequestError) return jsonResponse({ error: error.code }, error.status);
    return jsonResponse({ error: 'avatar_image_invalid' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: 'bookez' },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  let projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : null;
  if (projectId && !isUuid(projectId)) return jsonResponse({ error: 'avatar_project_unavailable' }, 400);

  if (projectId && purpose !== 'profile-photo') {
    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (projectError) {
      console.error('Image moderation project lookup failed.', projectError.message);
      return jsonResponse({ error: 'avatar_project_unavailable' }, 500);
    }
    // Starter and offline projects have a local UUID before their first cloud
    // sync. Moderate the image anyway and let the client keep its local copy;
    // only a confirmed Bookez project gets a server-side storage path.
    if (!project) projectId = null;
  }

  const { data: allowed, error: reserveError } = await admin.rpc('reserve_image_moderation', { p_user_id: user.id });
  if (reserveError) {
    console.error('Image moderation rate-limit reservation failed.', reserveError.message);
    return jsonResponse({ error: 'avatar_moderation_configuration' }, 500);
  }
  if (allowed !== true) return jsonResponse({ error: 'avatar_rate_limited' }, 429);

  let flagged: boolean;
  try {
    flagged = await moderateWithOpenAi(image.base64, Deno.env.get('OPENAI_MODERATION_API_KEY')!);
  } catch (error) {
    console.error('Image moderation failed.', error instanceof Error ? error.message : 'unknown provider error');
    return jsonResponse({ error: 'avatar_moderation_unavailable' }, 503);
  }
  if (flagged) return jsonResponse({ error: 'avatar_rejected' }, 422);

  if (purpose === 'profile-photo') {
    const { data: profile, error: profileError } = await admin
      .from('community_profiles')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' })
      .select('avatar_path')
      .single();
    if (profileError) {
      console.error('Profile photo profile lookup failed.', profileError.message);
      return jsonResponse({ error: 'avatar_profile_unavailable' }, 500);
    }

    const avatarPath = `${user.id}/profile/avatar-${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(avatarPath, image.bytes, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) {
      console.error('Profile photo storage upload failed.', uploadError.message);
      return jsonResponse({ error: 'avatar_storage_unavailable' }, 503);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('community_profiles')
      .update({ avatar_path: avatarPath, avatar_updated_at: now, avatar_moderation_notice_at: now })
      .eq('user_id', user.id);
    if (updateError) {
      await admin.storage.from(AVATAR_BUCKET).remove([avatarPath]);
      console.error('Profile photo profile update failed.', updateError.message);
      return jsonResponse({ error: 'avatar_profile_unavailable' }, 500);
    }

    const oldAvatarPath = isRecord(profile) && typeof profile.avatar_path === 'string' ? profile.avatar_path : null;
    if (oldAvatarPath && oldAvatarPath !== avatarPath && isUsersAvatarPath(oldAvatarPath, user.id)) {
      const { error: cleanupError } = await admin.storage.from(AVATAR_BUCKET).remove([oldAvatarPath]);
      if (cleanupError) console.warn('Previous profile photo cleanup failed.', cleanupError.message);
    }
    return jsonResponse({ allowed: true, storagePath: avatarPath, purpose });
  }

  if (!projectId) return jsonResponse({ allowed: true, purpose });

  const storagePath = projectImagePath(purpose, user.id, projectId);
  const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(storagePath, image.bytes, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (uploadError) {
    console.error('Book image storage upload failed.', uploadError.message);
    return jsonResponse({ error: 'avatar_storage_unavailable' }, 503);
  }

  // Keep the Community cover row in sync when it already exists. Local project
  // state still updates through the normal Bookez sync path, so offline books
  // and projects that are not shared continue to behave exactly as before.
  if (purpose === 'book-cover') {
    const { error: communityUpdateError } = await admin
      .from('community_projects')
      .update({ cover_image_path: storagePath })
      .eq('project_id', projectId)
      .eq('user_id', user.id);
    if (communityUpdateError) {
      await admin.storage.from(AVATAR_BUCKET).remove([storagePath]);
      console.error('Book cover Community update failed.', communityUpdateError.message);
      return jsonResponse({ error: 'avatar_project_unavailable' }, 503);
    }
  }

  // A previous project image is intentionally not deleted here. The client
  // may still be syncing the new path; leaving the old object avoids turning a
  // successful replacement into a broken Community reference during a retry.
  return jsonResponse({ allowed: true, storagePath, purpose });
}
