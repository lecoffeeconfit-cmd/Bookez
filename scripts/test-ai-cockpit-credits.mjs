import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// The real Edge handler, with no live account, provider calls, or user credits.
const source = await readFile(new URL('../supabase/functions/bookez-ai-writing/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace(/^import .*?;\n/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const requestId = 'c683db64-f0d4-4a21-9c8a-c0b12966fd29';
const body = { requestId, operation: 'continue', text: 'The door opened.', protectReserve: true, context: { contextMode: 'nearby', chapterTitle: 'Arrival' } };
const output = { options: ['An old friend stood outside.'], ideas: [], feedback: '' };
const makeHarness = ({ providerFails = false, missingMigration = false, used = 0, resultOutput = output } = {}) => {
  const entries = new Map();
  let providerCalls = 0;
  let handler;
  const usage = () => ({ month: '2026-10', monthlyCredits: 120, usedCredits: used + [...entries.values()].filter((entry) => entry.state !== 'failed').reduce((sum, entry) => sum + entry.credits, 0) });
  const rpc = async (name, args) => {
    if (name === 'get_ai_usage') return { data: usage() };
    if (missingMigration) return { error: new Error('RPC not installed') };
    if (name === 'get_ai_cockpit_capabilities') return { data: { idempotency: true } };
    if (name === 'claim_ai_cockpit_request') {
      const existing = entries.get(args.p_request_id);
      if (existing) return { data: { allowed: false, state: existing.owner === args.p_user_id && existing.fingerprint === args.p_fingerprint && existing.credits === args.p_credits ? existing.state : 'conflict', result: existing.result } };
      if (usage().usedCredits + args.p_credits > (args.p_protect_reserve ? 84 : 120)) return { data: { allowed: false, state: 'budget', remainingCredits: 0 } };
      entries.set(args.p_request_id, { state: 'pending', fingerprint: args.p_fingerprint, owner: args.p_user_id, credits: args.p_credits });
      return { data: { allowed: true, state: 'claimed' } };
    }
    if (name === 'finish_ai_cockpit_request') {
      const entry = entries.get(args.p_request_id);
      entry.state = args.p_success ? 'completed' : 'failed';
      entry.result = args.p_result;
      return { data: { state: entry.state } };
    }
    assert.fail(`Unexpected RPC ${name}`);
  };
  vm.runInNewContext(code, {
    Deno: { env: { get: (name) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'service', OPENAI_API_KEY: 'provider' })[name] }, serve: (value) => { handler = value; } },
    createClient: (_url, _key, options) => ({ auth: { getUser: async () => ({ data: { user: { id: options?.global?.headers?.Authorization === 'Bearer other' ? 'other-user' : 'owner' } } }) }, schema: () => ({ rpc }) }),
    fetch: async () => { providerCalls += 1; await new Promise((resolve) => setTimeout(resolve, 4)); return new Response(JSON.stringify({ status: 'completed', output_text: JSON.stringify(resultOutput) }), { status: providerFails ? 500 : 200 }); },
    Response, Request, TextEncoder, AbortSignal, crypto: globalThis.crypto,
  });
  const request = (value = body, token = 'owner') => handler(new Request('https://example.invalid/ai', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(value) }));
  const status = () => handler(new Request('https://example.invalid/ai', { headers: { Authorization: 'Bearer owner', 'x-bookez-cockpit': '1' } }));
  return { request, status, entries, usage, calls: () => providerCalls };
};

const success = makeHarness();
assert.equal((await success.status()).status, 200);
assert.equal((await (await success.status()).json()).capabilities.idempotency, true);
const parallel = await Promise.all([success.request(), success.request()]);
assert.deepEqual(parallel.map((response) => response.status).sort(), [200, 409]);
assert.equal(success.calls(), 1, 'Concurrent duplicate requests make exactly one provider call.');
assert.equal(success.usage().usedCredits, 2);
const replay = await success.request({ ...body, context: { chapterTitle: 'Arrival', contextMode: 'nearby' } });
assert.equal(replay.status, 200, 'Canonical parsed input tolerates different JSON key order.');
assert.deepEqual((await replay.json()).options, output.options);
assert.equal(success.calls(), 1, 'Recovering an already-paid preview does not call the provider.');
assert.equal(success.usage().usedCredits, 2);
assert.equal((await success.request({ ...body, text: 'Different work' })).status, 409);
assert.equal((await success.request(body, 'other')).status, 409, 'Another account cannot replay a result.');
assert.equal((await success.request({ ...body, requestId: 'not-a-uuid' })).status, 400);
assert.equal(success.calls(), 1);

const failure = makeHarness({ providerFails: true });
assert.equal((await failure.request()).status, 502);
assert.equal(failure.usage().usedCredits, 0);
assert.equal((await failure.request()).status, 409, 'A failed ID is not silently charged or regenerated.');
assert.equal(failure.calls(), 1);
const unavailable = makeHarness({ missingMigration: true });
assert.equal((await (await unavailable.status()).json()).capabilities.idempotency, false);
assert.equal((await unavailable.request()).status, 503);
assert.equal(unavailable.calls(), 0, 'A missing migration fails closed before spending credits.');
const reserve = makeHarness({ used: 83 });
assert.equal((await reserve.request()).status, 429);
assert.equal(reserve.calls(), 0);
const characterBody = { ...body, operation: 'ask', cockpitAction: 'character' };
const character = { name: 'Iris', role: 'Archivist', goal: 'Find the lost book', motivation: 'Protect her sister', conflict: 'The library is closing', voice: 'Measured and precise', arc: 'Learns to trust' };
const validCharacter = makeHarness({ resultOutput: { options: [], ideas: [], feedback: JSON.stringify(character) } });
assert.equal((await validCharacter.request(characterBody)).status, 200);
assert.equal(validCharacter.usage().usedCredits, 2);
const invalidCharacter = makeHarness({ resultOutput: { options: [], ideas: [], feedback: 'An archivist with a mysterious past.' } });
assert.equal((await invalidCharacter.request(characterBody)).status, 502);
assert.equal(invalidCharacter.usage().usedCredits, 0, 'Malformed character output releases its reservation.');
assert.equal((await invalidCharacter.request(characterBody)).status, 409, 'A failed profile cannot silently regenerate on a retry.');
assert.equal((await validCharacter.request({ ...characterBody, cockpitAction: 'outline' })).status, 409, 'Planning subtype is part of the immutable request fingerprint.');
assert.equal((await makeHarness().request({ ...characterBody, requestId: undefined })).status, 400);
assert.equal((await makeHarness().request({ ...body, cockpitAction: 'character' })).status, 400);
const oversizedOutline = makeHarness({ resultOutput: { options: [], ideas: [], feedback: 'x'.repeat(4001) } });
assert.equal((await oversizedOutline.request({ ...characterBody, cockpitAction: 'outline' })).status, 502);
assert.equal(oversizedOutline.usage().usedCredits, 0, 'Planning output must not be charged and silently clipped.');

// Exercise the optional client API with a fake transport, including real
// AbortSignal propagation. Existing two-argument callers remain unchanged.
const clientSource = await readFile(new URL('../src/lib/ai-writing.ts', import.meta.url), 'utf8');
const clientCode = ts.transpileModule(clientSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const clientExports = {};
const transportCalls = [];
vm.runInNewContext(clientCode, {
  exports: clientExports,
  require: (name) => {
    if (name === 'expo') return { requireOptionalNativeModule: () => null };
    if (name === './ai-provider') return { deviceSourceLimit: () => 2000, providerRoute: () => 'cloud' };
    if (name === './supabase') return { supabase: { functions: { invoke: async (_name, options) => {
      transportCalls.push(options);
      if (options.signal?.aborted) return { error: new Error('Aborted') };
      return { data: options.method === 'GET' ? { month: '2026-10', usedCredits: 2, monthlyCredits: 120, capabilities: { idempotency: true } } : output };
    } } } };
    assert.fail(`Unexpected client import ${name}`);
  },
  Response,
});
const client = clientExports.AIWritingService;
const controller = new AbortController();
await client.generate(body, 'cloud', { signal: controller.signal });
assert.equal(transportCalls[0].signal, controller.signal);
assert.equal(transportCalls[0].body.requestId, requestId);
assert.equal((await client.readCloudStatus()).idempotency, true);
assert.equal(transportCalls[1].headers['x-bookez-cockpit'], '1');
controller.abort();
await assert.rejects(client.generate(body, 'cloud', { signal: controller.signal }), { name: 'AIWritingCanceledError' });
assert.equal(transportCalls.length, 2, 'Canceled work does not start another provider request.');

const nativeJobs = [];
let nativeCancels = 0;
const nativeExports = {};
const nativeModule = { isAvailable: async () => true, generate: () => new Promise((resolve) => nativeJobs.push(resolve)), cancel: async () => { nativeCancels++; nativeJobs.at(-1)?.(output); } };
vm.runInNewContext(clientCode, {
  exports: nativeExports,
  require: (name) => name === 'expo' ? { requireOptionalNativeModule: () => nativeModule }
    : name === './ai-provider' ? { deviceSourceLimit: () => 2500, providerRoute: (_preference, available) => available ? 'device' : 'cloud' }
    : name === './supabase' ? { supabase: {} } : assert.fail(`Unexpected import ${name}`),
  Response,
});
const nativeService = nativeExports.AIWritingService;
const nativeAbort = new AbortController();
const firstNative = nativeService.generate(body, 'device', { signal: nativeAbort.signal });
await new Promise((resolve) => setTimeout(resolve, 0));
await assert.rejects(nativeService.generate(body, 'device'), /Phone AI is finishing another request/);
assert.equal(nativeJobs.length, 1, 'A second caller cannot overlap the process-wide native provider.');
await nativeService.cancel();
assert.equal(nativeCancels, 0, 'An unrelated legacy cloud Cancel button cannot stop a signal-scoped cockpit job.');
nativeAbort.abort();
await assert.rejects(firstNative, { name: 'AIWritingCanceledError' });
assert.equal(nativeCancels, 1);
const nextNative = nativeService.generate(body, 'device');
await new Promise((resolve) => setTimeout(resolve, 0));
nativeAbort.abort();
assert.equal(nativeCancels, 1, 'An old caller cannot cancel the next native request.');
nativeJobs[1](output);
assert.deepEqual((await nextNative).options, output.options);

// Optional real PostgreSQL-compatible execution, used in local verification.
if (process.env.BOOKEZ_TEST_PGLITE_MODULE) {
  const { PGlite } = await import(process.env.BOOKEZ_TEST_PGLITE_MODULE);
  const db = new PGlite();
  await db.exec('create schema auth; create schema bookez; create role anon; create role authenticated; create role service_role; create table auth.users (id uuid primary key);');
  await db.exec(await readFile(new URL('../supabase/migrations/20261011150000_bookez_ai_credits.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261014120000_bookez_ai_cockpit_idempotency.sql', import.meta.url), 'utf8'));
  // Applying twice must be safe.
  await db.exec(await readFile(new URL('../supabase/migrations/20261014120000_bookez_ai_cockpit_idempotency.sql', import.meta.url), 'utf8'));
  const owner = '8f56de18-c647-440d-8f1c-213d90e39e15';
  const other = 'f0379810-e68e-44f6-8e7b-0080839e94db';
  await db.query('insert into auth.users(id) values ($1),($2)', [owner, other]);
  const fingerprint = 'a'.repeat(64);
  const claim = async (id = requestId, account = owner, hash = fingerprint, credits = 2) => (await db.query('select bookez.claim_ai_cockpit_request($1,$2,$3,true,$4) as result', [account, id, credits, hash])).rows[0].result;
  const settle = async (id = requestId, result = output, succeeded = true) => (await db.query('select bookez.finish_ai_cockpit_request($1,$2,$3,$4,$5::jsonb) as result', [owner, id, fingerprint, succeeded, result ? JSON.stringify(result) : null])).rows[0].result;
  assert.equal((await claim()).state, 'claimed');
  assert.equal((await claim()).state, 'pending');
  assert.equal((await claim(requestId, other)).state, 'conflict');
  assert.equal((await claim(requestId, owner, 'b'.repeat(64))).state, 'conflict');
  assert.equal((await settle()).state, 'completed');
  assert.deepEqual((await claim()).result, output);
  assert.equal((await settle(requestId, null, false)).state, 'completed', 'A settled charge cannot later be refunded by a duplicate callback.');
  assert.equal((await db.query('select bookez.get_ai_usage($1) as result', [owner])).rows[0].result.usedCredits, 2);
  const expired = 'f150e7db-ec06-4fb6-af45-564e8a8bab5a';
  await claim(expired);
  await db.query("update bookez.ai_credit_requests set created_at = now() - interval '11 minutes' where id=$1", [expired]);
  assert.equal((await settle(expired)).state, 'failed', 'Expired work cannot spend a balance whose hold has already expired.');
  assert.equal((await claim(expired)).state, 'failed');
  const failed = '11504a63-3c72-449d-b8f3-76c6960f2178';
  await claim(failed);
  assert.equal((await settle(failed, null, false)).state, 'failed');
  assert.equal((await claim(failed)).state, 'failed');
  const denied = 'd7b05a58-4341-4efe-b3a8-644af8f948d7';
  assert.equal((await claim(denied, owner, fingerprint, 83)).state, 'budget');
  const privileges = await db.query("select has_function_privilege('authenticated', 'bookez.claim_ai_cockpit_request(uuid,uuid,integer,boolean,text)', 'execute') as allowed");
  assert.equal(privileges.rows[0].allowed, false);
  await db.close();
  console.log('Cockpit credit SQL: real migrations, replay, ownership, stale reservations, settlement, protected reserve and permissions passed.');
}
console.log('Cockpit credits: capability gate, exact-once generation/replay, duplicates, changed input, account isolation, failed-call release and reserve passed.');
