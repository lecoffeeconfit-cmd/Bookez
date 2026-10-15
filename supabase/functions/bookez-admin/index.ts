import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const actions = ['refill_ai','hide_sharing','restore_sharing','remove_avatar','resolve_report','update_feedback'];
const statuses = ['all','new','reviewing','in_progress','resolved','closed'];
const priorities = ['all','low','normal','high','critical'];
const categories = ['all','bug','feature_request','account','general','other'];
const serviceKey = () => {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (legacy) return legacy;
  try { const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'); return Object.values(keys).find((key): key is string => typeof key === 'string' && Boolean(key)); }
  catch { return undefined; }
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (!['GET','POST'].includes(request.method)) return reply({ error: 'Method not allowed.' }, 405);
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return reply({ error: 'Sign in with your Bookez admin account.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = serviceKey();
  if (!url || !key) return reply({ error: 'Bookez admin service is not configured.' }, 503);
  const admin = createClient(url, key, { db: { schema: 'bookez' }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user?.id) return reply({ error: 'Your admin session has expired. Sign in again.' }, 401);
    // Fresh database membership on EVERY read/write. Never trust user_metadata,
    // an email allowlist, a hidden tap, or the mobile client's cached role.
    const { data: membership, error: roleError } = await admin.from('app_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (roleError) return reply({ error: 'Admin access could not be verified. Check the Bookez admin migration.' }, 503);
    if (!membership) return reply({ error: 'This account does not have Bookez admin access.' }, 403);

    let rpcName: string;
    let args: Record<string, unknown>;
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      const page = Number(params.get('page') ?? '1');
      if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) return reply({ error: 'Invalid page.' }, 400);
      const section = params.get('section') ?? 'overview';
      if (section === 'feedback') {
        const status = params.get('status') ?? 'all'; const priority = params.get('priority') ?? 'all';
        const category = params.get('category') ?? 'all'; const order = params.get('order') ?? 'newest';
        if (!statuses.includes(status) || !priorities.includes(priority) || !categories.includes(category) || !['newest','oldest'].includes(order)) return reply({ error: 'Invalid inbox filters.' }, 400);
        rpcName = 'admin_support_inbox'; args = { p_status: status, p_priority: priority, p_category: category, p_order: order, p_page: page };
      } else if (section === 'overview') {
        const range = params.get('range') ?? '30d'; const query = params.get('query') ?? '';
        if (!['today','7d','30d','all'].includes(range) || query.length > 120) return reply({ error: 'Invalid reporting range or search.' }, 400);
        rpcName = 'admin_dashboard_data'; args = { p_range: range, p_page: page, p_query: query.trim() };
      } else return reply({ error: 'Unknown admin section.' }, 400);
    } else {
      if (Number(request.headers.get('content-length')) > 16_384) return reply({ error: 'Request is too large.' }, 413);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 16_384) return reply({ error: 'Request is too large.' }, 413);
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid request.' }, 400); }
      if (!record(body) || typeof body.action !== 'string' || !actions.includes(body.action) || typeof body.targetId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.targetId)) return reply({ error: 'Invalid admin action or target.' }, 400);
      const payload = body.payload ?? {};
      if (!record(payload)) return reply({ error: 'Invalid action details.' }, 400);
      if (body.action === 'update_feedback') {
        if (payload.status !== undefined && (typeof payload.status !== 'string' || !statuses.slice(1).includes(payload.status))) return reply({ error: 'Invalid feedback status.' }, 400);
        if (payload.priority !== undefined && (typeof payload.priority !== 'string' || !priorities.slice(1).includes(payload.priority))) return reply({ error: 'Invalid feedback priority.' }, 400);
        if (payload.reply !== undefined && (typeof payload.reply !== 'string' || payload.reply.length > 4000)) return reply({ error: 'Replies must be at most 4,000 characters.' }, 400);
        if (!['status','priority','reply'].some((field) => payload[field] !== undefined)) return reply({ error: 'Choose a feedback update first.' }, 400);
      }
      rpcName = 'admin_apply_action'; args = { p_actor: user.id, p_action: body.action, p_target: body.targetId, p_payload: payload };
    }
    // Every action and its audit entry commit in the SAME database transaction.
    const { data, error } = await admin.rpc(rpcName, args);
    if (error) return reply({ error: error.code === '22023' || error.code === '42501' ? error.message : 'Admin data is unavailable. Check your connection and the Bookez admin migration.' }, error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503);
    if (!record(data)) return reply({ error: 'Admin service returned no data.' }, 503);
    return reply(data);
  } catch { return reply({ error: 'Bookez admin service is temporarily unavailable.' }, 503); }
});
