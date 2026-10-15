import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual Edge Function with a deterministic in-memory ledger and
// provider. No secrets, live accounts, network calls, or credits are used.
const source = await readFile(new URL('../supabase/functions/bookez-ai-writing/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace(/^import .*?;\n/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const context = { contextMode: 'book-aware', projectTitle: 'Test book', projectType: 'Fiction', chapterTitle: 'Opening' };
const writing = { options: ['A complete page of writing.'], ideas: [], feedback: '' };
const createHarness = ({ used = 0, monthly = 120, status = 'completed', output = writing, authenticated = true, providerStatus = 200, usageFailureAfterFinish = false } = {}) => {
  const reservations = new Map();
  const providerCalls = [];
  const rpcCalls = [];
  let finished = false;
  let handler;
  const usage = () => ({ month: '2026-10', usedCredits: used + [...reservations.values()].filter((entry) => entry.status !== 'failed').reduce((sum, entry) => sum + entry.credits, 0), monthlyCredits: monthly });
  const admin = { rpc: async (name, args) => {
    rpcCalls.push({ name, args });
    if (name === 'get_ai_usage') return finished && usageFailureAfterFinish ? { error: new Error('Temporary read failure') } : { data: usage() };
    if (name === 'reserve_ai_credits') {
      const ceiling = args.p_protect_reserve ? Math.floor(monthly * 0.7) : monthly;
      if (usage().usedCredits + args.p_credits > ceiling) return { data: { allowed: false, remainingCredits: Math.max(0, ceiling - usage().usedCredits) } };
      reservations.set(args.p_request_id, { credits: args.p_credits, status: 'pending' });
      return { data: { allowed: true } };
    }
    if (name === 'finish_ai_credits') {
      reservations.get(args.p_request_id).status = args.p_success ? 'completed' : 'failed';
      finished = true;
      return {};
    }
    assert.fail(`Unexpected RPC ${name}`);
  } };
  vm.runInNewContext(code, {
    Deno: { env: { get: (name) => ({ SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'test-public', SUPABASE_SERVICE_ROLE_KEY: 'test-service', OPENAI_API_KEY: 'test-provider' })[name] }, serve: (value) => { handler = value; } },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'test-user' } : null } }) }, schema: () => admin }),
    fetch: async (_url, init) => { providerCalls.push(JSON.parse(init.body)); return new Response(JSON.stringify({ status, output_text: typeof output === 'string' ? output : JSON.stringify(output) }), { status: providerStatus }); },
    Response, Request, TextEncoder, AbortSignal, crypto: globalThis.crypto,
  });
  const request = (body, headers = { Authorization: 'Bearer test-session' }) => handler(new Request('https://example.invalid/functions/v1/bookez-ai-writing', { method: 'POST', headers, body: JSON.stringify(body) }));
  return { request, handler, reservations, providerCalls, rpcCalls, usage };
};
const draft = { operation: 'draft-page', text: '', instruction: 'Two sisters return home.', context, protectReserve: false };

const success = createHarness();
const response = await success.request(draft);
assert.equal(response.status, 200);
const result = await response.json();
assert.equal(result.usage.usedCredits, 8);
assert.deepEqual(result.options, writing.options);
assert.equal(success.providerCalls.length, 1);
assert.equal([...success.reservations.values()][0].status, 'completed');
assert.equal(success.rpcCalls[0].args.p_credits, 8, 'The server computes costs, not the client.');

for (const [mode, cost] of [['page', 5], ['nearby', 6], ['book-aware', 8]]) {
  const harness = createHarness();
  assert.equal((await harness.request({ ...draft, credits: 0, context: { ...context, contextMode: mode } })).status, 200);
  assert.equal(harness.usage().usedCredits, cost);
}
const insufficient = createHarness({ used: 119 });
assert.equal((await insufficient.request(draft)).status, 429);
assert.equal(insufficient.providerCalls.length, 0, 'Out-of-credit requests must never reach the provider.');
const protectedReserve = createHarness({ used: 80 });
assert.equal((await protectedReserve.request({ ...draft, protectReserve: true })).status, 429);
assert.equal(protectedReserve.providerCalls.length, 0);

const parallel = createHarness({ used: 112 });
const parallelResponses = await Promise.all([parallel.request(draft), parallel.request(draft)]);
assert.deepEqual(parallelResponses.map((item) => item.status).sort(), [200, 429]);
assert.equal(parallel.providerCalls.length, 1, 'An existing reservation counts against another simultaneous request.');

for (const options of [{ status: 'incomplete' }, { output: 'broken JSON' }, { output: { ...writing, options: [] } }, { output: { ...writing, options: ['x'.repeat(12_001)] } }, { providerStatus: 500 }]) {
  const harness = createHarness(options);
  assert.equal((await harness.request(draft)).status, 502);
  assert.equal(harness.usage().usedCredits, 0, 'Failed/incomplete/oversized results release the reservation.');
  assert.equal([...harness.reservations.values()][0].status, 'failed');
}
const revision = createHarness();
assert.equal((await revision.request({ operation: 'grammar', text: 'Complete passage. '.repeat(160), context: { ...context, contextMode: 'page' } })).status, 200);
assert.equal(revision.providerCalls[0].max_output_tokens, 4000, 'Long revisions receive room for complete output.');
assert.equal(revision.usage().usedCredits, 1);

const usageReadFailure = createHarness({ usageFailureAfterFinish: true });
const delivered = await usageReadFailure.request(draft);
assert.equal(delivered.status, 200, 'A usage-read outage must not hide an already-paid preview.');
assert.deepEqual((await delivered.json()).options, writing.options);

const anonymous = createHarness({ authenticated: false });
assert.equal((await anonymous.request(draft)).status, 401);
assert.equal(anonymous.providerCalls.length, 0);
assert.equal(anonymous.rpcCalls.length, 0);
assert.equal((await createHarness().request(draft, {})).status, 401);
const invalid = createHarness();
assert.equal((await invalid.request({ ...draft, instruction: 'x'.repeat(1001) })).status, 413);
assert.equal(invalid.rpcCalls.length, 0, 'Invalid requests cannot reserve credits.');

const migration = await readFile(new URL('../supabase/migrations/20261011150000_bookez_ai_credits.sql', import.meta.url), 'utf8');
assert.match(migration, /pg_advisory_xact_lock/, 'The real database serializes per-user monthly reservations.');
assert.match(migration, /revoke all on function bookez\.reserve_ai_credits\(uuid, uuid, integer, boolean\) from public, anon, authenticated/);
assert.match(migration, /date_trunc\('month', now\(\) at time zone 'utc'\)/, 'Refills use the same UTC month as the client.');
console.log('AI credit Edge Function: auth, costs, budget/reserve limits, concurrent reservations, failed-call release, complete output, and delivery verified with mocked services.');
