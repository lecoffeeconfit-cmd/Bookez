import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'bookez-files';
const DELETE_CONFIRMATION = 'DELETE';
const MAX_FOLDER_DEPTH = 8;

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

const getFirstJsonString = (value: string | undefined) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
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

async function listOwnedFiles(admin: ReturnType<typeof createClient>, folder: string, depth = 0): Promise<string[]> {
  if (depth > MAX_FOLDER_DEPTH) throw new Error('account_storage_depth_exceeded');
  const paths: string[] = [];

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(folder, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;

    for (const entry of data ?? []) {
      const path = `${folder}/${entry.name}`;
      if (entry.id) paths.push(path);
      else paths.push(...await listOwnedFiles(admin, path, depth + 1));
    }
    if (!data || data.length < 1000) break;
  }

  return paths;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return jsonResponse({ error: 'authentication_required' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('confirmation' in body) || body.confirmation !== DELETE_CONFIRMATION) {
    return jsonResponse({ error: 'confirmation_required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = getPublishableKey();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) return jsonResponse({ error: 'configuration_error' }, 500);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user?.id) return jsonResponse({ error: 'authentication_required' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: 'bookez' },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  try {
    const files = await listOwnedFiles(admin, user.id);
    for (let index = 0; index < files.length; index += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(files.slice(index, index + 100));
      if (error) throw error;
    }

    // Auth deletion cascades through every Bookez table that references the
    // user, including projects, chapters, Community data, and moderation rows.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw deleteError;
    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('Bookez account deletion failed.', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'account_deletion_failed' }, 500);
  }
});
