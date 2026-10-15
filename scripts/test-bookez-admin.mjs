import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { adminCreditPercent, adminDuration, writerActionCopy } from '../src/lib/admin-model.ts';

assert.equal(adminCreditPercent(80,120),67);
assert.equal(adminCreditPercent(200,120),100);
assert.equal(adminCreditPercent(-1,120),0);
assert.equal(adminCreditPercent(1,0),0);
assert.equal(adminDuration(1200),'20 min');
assert.equal(adminDuration(5400),'1.5 hr');
assert.match(writerActionCopy({ name: 'Writer' },'restore_sharing').detail,/Nothing is automatically republished/);
assert.throws(() => writerActionCopy({ name: 'Writer' },'delete_user'),/Unsupported/);

const edge = await readFile(new URL('../supabase/functions/bookez-admin/index.ts',import.meta.url),'utf8');
const code = ts.transpileModule(edge.replace(/^import .*?;\n/,''), { compilerOptions: { target: ts.ScriptTarget.ES2022,module: ts.ModuleKind.CommonJS } }).outputText;
const adminId = '10000000-0000-4000-8000-000000000001';
const targetId = '10000000-0000-4000-8000-000000000002';
function harness({ member = true, authenticated = true, roleError = false, rpcError = null, configured = true } = {}) {
  let handler;
  const calls = [];
  const memberships = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: adminId, user_metadata: { admin: true } } : null },error: null }) },
    from: (table) => ({ select: () => ({ eq: (_column,id) => ({ maybeSingle: async () => { memberships.push({ table,id }); return { data: member ? { user_id: id } : null,error: roleError ? new Error('Not deployed') : null }; } }) }) }),
    rpc: async (name,args) => { calls.push({ name,args }); return { data: { updated: true,metrics: {},tickets: [] },error: rpcError }; },
  };
  vm.runInNewContext(code, {
    Deno: { env: { get: (name) => configured ? ({ SUPABASE_URL: 'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY: 'test-only-service' })[name] : undefined },serve: (fn) => { handler = fn; } },
    createClient: (_url,_key,options) => { assert.equal(options.db.schema,'bookez'); return client; },Response,Request,URL,TextEncoder,
  });
  return { calls,memberships,request: (method = 'GET',query = '',body,authorization = 'Bearer test-session') => handler(new Request(`https://example.invalid/functions/v1/bookez-admin${query}`, { method,headers: { Authorization: authorization },...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) })) };
}
const normal = harness();
assert.equal((await normal.request('GET','?range=7d&page=2&query=Writer')).status,200);
assert.deepEqual(JSON.parse(JSON.stringify(normal.calls[0].args)),{ p_range: '7d',p_page: 2,p_query: 'Writer' });
assert.equal(normal.memberships[0].table,'app_admins');
assert.equal(normal.calls[0].name,'admin_dashboard_data');
assert.equal((await normal.request('GET','?section=feedback&status=reviewing&priority=high&category=bug&order=oldest&page=3')).status,200);
assert.equal(normal.calls[1].name,'admin_support_inbox');
assert.equal(normal.calls[1].args.p_priority,'high');
assert.equal((await normal.request('POST','',{ action: 'refill_ai',targetId,payload: {},p_actor: targetId })).status,200);
assert.equal(normal.calls[2].args.p_actor,adminId,'The verified user, never a body field, is the audit actor.');
assert.equal(normal.memberships.length,3,'Each request checks fresh database membership.');

const ordinary = harness({ member: false });
assert.equal((await ordinary.request()).status,403,'Forged admin user_metadata does not grant a role.');
assert.equal((await ordinary.request('POST','',{ action: 'refill_ai',targetId })).status,403);
assert.equal(ordinary.calls.length,0);
const anonymous = harness({ authenticated: false });
assert.equal((await anonymous.request()).status,401);
assert.equal(anonymous.memberships.length,0);
assert.equal((await harness().request('GET','',undefined,'')).status,401);
assert.equal((await harness({ configured: false }).request()).status,503);
assert.equal((await harness({ roleError: true }).request()).status,503);

for (const query of ['?page=0','?page=1.5','?page=NaN','?range=year','?section=unknown','?section=feedback&priority=urgent','?section=feedback&status=anything','?section=feedback&category=private_manuscripts']) {
  const test = harness(); assert.equal((await test.request('GET',query)).status,400); assert.equal(test.calls.length,0);
}
for (const body of [{ action: 'grant_admin',targetId },{ action: 'delete_user',targetId },{ action: 'refill_ai',targetId: 'wrong-id' },{ action: 'update_feedback',targetId,payload: { status: 'admin' } },{ action: 'update_feedback',targetId,payload: { priority: 'urgent' } },{ action: 'update_feedback',targetId,payload: { reply: 'x'.repeat(4001) } },{ action: 'update_feedback',targetId,payload: {} },'bad JSON']) {
  const test = harness(); assert.equal((await test.request('POST','',body)).status,400); assert.equal(test.calls.length,0);
}
const large = harness(); assert.equal((await large.request('POST','','x'.repeat(16_385))).status,413); assert.equal(large.calls.length,0);
assert.equal((await harness({ rpcError: { code: '42501',message: 'Admin access was revoked.' } }).request('POST','',{ action: 'hide_sharing',targetId })).status,403);

const entry = await readFile(new URL('../src/components/BookezAdminEntry.tsx',import.meta.url),'utf8');
assert.match(entry,/if \(!userId \|\| approvedUserId !== userId\) return null/,'Profile stays unchanged for ordinary accounts.');
assert.match(entry,/setApprovedUserId\(null\); setOpen\(false\)/,'Switching account removes cached admin access.');
assert.ok(!entry.includes('__DEV__'),'No development-build admin bypass.');
const app = await readFile(new URL('../App.tsx',import.meta.url),'utf8');
assert.match(app,/<BookezAdminEntry \/>/);
assert.match(app,/await submitBookezSupport\([\s\S]*?setSubmitted\(true\)/,'Success must follow a real support submission.');
assert.ok(!app.includes('Your note has been saved for this session.'),'Do not claim unsent feedback was saved.');
const migration = await readFile(new URL('../supabase/migrations/20261012160000_bookez_admin_center.sql',import.meta.url),'utf8');
assert.match(migration,/grant execute on function bookez\.admin_apply_action\(uuid,text,uuid,jsonb\) to service_role/);
assert.match(migration,/insert into bookez\.admin_audit_log/);
assert.ok(!/delete\s+from\s+auth\.users/i.test(migration));
assert.ok(!/chapter[s]?\.content|plan_json|\.user_metadata/.test(migration),'Admin aggregates must not read private writing or client role metadata.');
console.log('Admin contracts and Edge Function: hidden role gate, verified actor, auth/role denial, filters, action validation, audit routing, support submission, and Bookez-only scope passed.');
