import assert from 'node:assert/strict';
import { parseCockpitRecovery } from '../src/lib/ai-cockpit-recovery.ts';
import { createCockpitCharacterPreview, createCockpitDraftPreview, createCockpitOutlinePreview, formatCockpitCharacter } from '../src/lib/ai-cockpit-model.ts';

const projectId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const scope = { projectId, ownerId };
const clone = (value) => JSON.parse(JSON.stringify(value));
const snapshot = {
  ownerId, projectId, projectTitle: 'The Lost Atlas', partKey: 'unit:0', partTitle: 'Chapter 1', text: 'A winding path. '.repeat(200), revision: 4,
  people: 'Mina — a navigator.', unitIdeas: ['Opening', 'A difficult arrival'],
  nextUnit: { key: 'unit:1', title: 'Chapter 2', index: 1 },
  parts: [{ key: 'structure:title-page', title: 'Title page' }, { key: 'unit:0', title: 'Chapter 1' }, { key: 'unit:1', title: 'Chapter 2' }],
  context: { projectTitle: 'The Lost Atlas', projectType: 'Fiction Book', chapterTitle: 'Chapter 1', chapterPlan: 'Draft a beginning.',
    nearbyText: '', toneSample: '', characters: 'Mina — a navigator.', notes: 'Point of view: First person\nWatch the tide.', currentSectionSummary: 'Watch the tide.',
    bookIdea: 'An impossible island.', pointOfView: 'First person', plotThread: 'Discover the truth.' },
};
snapshot.context.nearbyText = snapshot.text.slice(-1800);
snapshot.context.toneSample = snapshot.text.slice(-900);
function contextFor(source, planning) {
  const value = source.context;
  const labels = planning ? ['Core concept', 'Point of view', 'Outline · throughline', 'Characters', 'Character goals & motivations'] : ['Point of view'];
  const notes = value.notes?.split('\n').filter((line) => !labels.some((label) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))).join('\n');
  if (planning) return { ...value, contextMode: 'book-aware', notes };
  return { contextMode: 'nearby', chapterTitle: value.chapterTitle, chapterPlan: value.chapterPlan, nearbyText: value.nearbyText, notes, compass: value.compass,
    projectTitle: value.projectTitle, projectType: value.projectType, pointOfView: value.pointOfView, toneSample: value.toneSample, currentSectionSummary: value.currentSectionSummary };
}
function pendingFixture(action = 'continue', provider = 'cloud') {
  const source = clone(snapshot);
  const planning = action === 'character' || action === 'outline';
  return { ownerId, projectId, input: 'Keep the tone hopeful.', action, preview: null, undo: null,
    pending: { action, provider, snapshot: source, request: { requestId, ...(planning ? { cockpitAction: action } : {}), operation: planning ? 'ask' : action,
      text: action === 'rewrite' ? source.text : source.text.slice(-2400), instruction: 'A deliberate authorized instruction.', protectReserve: true, context: contextFor(source, planning) } } };
}
function previewFixture(kind = 'append') {
  const preview = createCockpitDraftPreview({ projectId, partKey: snapshot.partKey, partTitle: snapshot.partTitle, baseText: snapshot.text, baseRevision: 4 }, 'A fresh paragraph.', kind, requestId, 100);
  return { ownerId, projectId, input: '', action: 'continue', preview, pending: null, undo: null };
}

let count = 0;
const test = (name, action) => { try { action(); count += 1; } catch (error) { console.error(`FAIL ${name}`); throw error; } };
const rejected = (name, mutate, fixture = pendingFixture()) => test(name, () => { const value = clone(fixture); mutate(value); assert.equal(parseCockpitRecovery(value, scope), null); });

test('valid paid retry retains the exact request identity and text', () => {
  const original = pendingFixture();
  const before = JSON.stringify(original);
  const parsed = parseCockpitRecovery(original, scope);
  assert.strictEqual(parsed, original);
  assert.strictEqual(parsed.pending.request, original.pending.request);
  assert.equal(parsed.pending.request.requestId, requestId);
  assert.equal(JSON.stringify(original), before);
});
test('all supported actions and both providers validate', () => {
  for (const action of ['continue', 'rewrite', 'character', 'outline']) {
    for (const provider of ['device', 'cloud']) assert.ok(parseCockpitRecovery(pendingFixture(action, provider), scope));
  }
});
test('local account capture record validates without paid work', () => {
  const value = { ownerId: null, projectId, input: 'An offline idea.', action: 'note', preview: null, pending: null };
  assert.strictEqual(parseCockpitRecovery(value, { projectId, ownerId: null }), value);
});
test('selected action can change while the original paid request is pending', () => {
  const value = pendingFixture('continue'); value.action = 'note';
  assert.ok(parseCockpitRecovery(value, scope));
});
test('scoped undo stays recoverable after apply until normal autosave catches up', () => {
  const value = previewFixture(); value.undo = value.preview; value.preview = null;
  const parsed = parseCockpitRecovery(value, scope);
  assert.strictEqual(parsed.undo, value.undo);
  assert.equal(parsed.undo.before, snapshot.text);
  assert.equal(parsed.undo.after, `${snapshot.text}\n\nA fresh paragraph.`);
});
test('pending request can coexist with previous scoped undo', () => {
  const value = pendingFixture(); value.undo = previewFixture().preview;
  assert.ok(parseCockpitRecovery(value, scope));
});
test('preview-only records validate for all real destinations', () => {
  assert.ok(parseCockpitRecovery(previewFixture('append'), scope));
  assert.ok(parseCockpitRecovery(previewFixture('dictation'), scope));
  assert.ok(parseCockpitRecovery(previewFixture('rewrite'), scope));
  const character = formatCockpitCharacter({ name: 'Mina', role: 'Navigator', goal: 'Find home', motivation: 'Family', conflict: 'Fear of water', voice: 'Lyrical', arc: 'Accepts uncertainty' });
  const characterValue = { ownerId, projectId, input: '', action: 'character', pending: null, preview: createCockpitCharacterPreview(projectId, '', character, requestId, 100) };
  assert.ok(parseCockpitRecovery(characterValue, scope));
  const outlineValue = { ownerId, projectId, input: '', action: 'outline', pending: null, preview: createCockpitOutlinePreview(projectId, { partKey: 'unit:1', partTitle: 'Chapter 2', unitIndex: 1 }, '', 'Goal → conflict → ending turn', requestId, 100) };
  assert.ok(parseCockpitRecovery(outlineValue, scope));
});
test('empty next chapter outline remains valid with sparse unitIdeas', () => {
  const value = pendingFixture('outline'); value.pending.snapshot.unitIdeas = [];
  assert.ok(parseCockpitRecovery(value, scope));
});
test('in-progress editable previews preserve blanks and trailing whitespace', () => {
  for (const kind of ['rewrite', 'outline']) {
    const value = kind === 'rewrite' ? previewFixture('rewrite') : { ownerId, projectId, input: '', action: 'outline', pending: null,
      preview: createCockpitOutlinePreview(projectId, { partKey: 'unit:1', partTitle: 'Chapter 2', unitIndex: 1 }, '', 'An outline', requestId, 100) };
    for (const after of ['', '  ', 'An unfinished sentence.  \n']) {
      value.preview.after = after;
      assert.ok(parseCockpitRecovery(value, scope));
      assert.equal(parseCockpitRecovery(value, scope).preview.after, after);
    }
  }
});
test('append preview permits editing the new passage without erasing source', () => {
  const value = previewFixture();
  for (const after of [value.preview.before, `${value.preview.before}\n\n`, `${value.preview.before}\n\n  A partial idea  `]) {
    value.preview.after = after;
    assert.ok(parseCockpitRecovery(value, scope));
  }
});
test('editable character profile need not remain complete during typing', () => {
  const before = 'Existing character.\n\n';
  const value = { ownerId, projectId, input: '', action: 'character', pending: null,
    preview: createCockpitCharacterPreview(projectId, before, '## Mina\nRole: Navigator', requestId, 100) };
  for (const after of [before, `${before}\n\n`, `${before}\n\n## A new unfinished name  `]) {
    value.preview.after = after;
    assert.ok(parseCockpitRecovery(value, scope));
  }
  value.preview.after = 'Deleted existing character';
  assert.equal(parseCockpitRecovery(value, scope), null);
});
test('unknown or old unscoped session data is rejected safely', () => {
  for (const item of [null, [], 'text', {}, { input: '', action: 'note', preview: null, pending: null }]) assert.equal(parseCockpitRecovery(item, scope), null);
});
rejected('malformed selected action is rejected', (value) => { value.action = 'project-add'; });
rejected('wrong top-level owner is rejected', (value) => { value.ownerId = '44444444-4444-4444-8444-444444444444'; });
rejected('wrong top-level book is rejected', (value) => { value.projectId = '44444444-4444-4444-8444-444444444444'; });
rejected('snapshot cannot cross account boundaries', (value) => { value.pending.snapshot.ownerId = null; });
rejected('snapshot cannot cross book boundaries', (value) => { value.pending.snapshot.projectId = '44444444-4444-4444-8444-444444444444'; });
rejected('malformed provider cannot reroute a paid call', (value) => { value.pending.provider = 'auto'; });
rejected('invalid UUID cannot change retry semantics', (value) => { value.pending.request.requestId = 'new-request'; });
rejected('a missing UUID cannot create a fresh retry charge', (value) => { delete value.pending.request.requestId; });
rejected('request operation must match authorized action', (value) => { value.pending.request.operation = 'draft-page'; });
rejected('request cannot disable protected project credits', (value) => { value.pending.request.protectReserve = false; });
rejected('request cannot omit protected project credits', (value) => { delete value.pending.request.protectReserve; });
rejected('request cannot inject a client cost', (value) => { value.pending.request.weightedCredits = 0; });
rejected('request context cannot alter cost by changing mode', (value) => { value.pending.request.context.contextMode = 'page'; });
rejected('request context cannot switch book identity', (value) => { value.pending.request.context.projectTitle = 'Another book'; });
rejected('request context cannot switch chapter identity', (value) => { value.pending.request.context.chapterTitle = 'Another chapter'; });
rejected('request context must match preserved snapshot context exactly', (value) => { value.pending.request.context.nearbyText = 'Unrelated source'; });
rejected('request source text must match original source tail', (value) => { value.pending.request.text = 'Newly substituted source'; });
rejected('continue request cannot masquerade as planning', (value) => { value.pending.request.cockpitAction = 'outline'; });
rejected('character request requires matching planning hint', (value) => { value.pending.request.cockpitAction = 'outline'; }, pendingFixture('character'));
rejected('planning hint cannot be omitted', (value) => { delete value.pending.request.cockpitAction; }, pendingFixture('outline'));
rejected('missing target chapter is rejected', (value) => { value.pending.snapshot.parts = value.pending.snapshot.parts.filter((part) => part.key !== 'unit:0'); });
rejected('duplicate chapter keys are rejected', (value) => { value.pending.snapshot.parts.push(value.pending.snapshot.parts[0]); });
rejected('unsafe chapter key is rejected', (value) => { value.pending.snapshot.partKey = '__proto__'; });
rejected('next chapter key must match its index', (value) => { value.pending.snapshot.nextUnit.index = 2; });
rejected('missing next chapter metadata is rejected', (value) => { delete value.pending.snapshot.nextUnit; });
rejected('negative chapter revision is rejected', (value) => { value.pending.snapshot.revision = -1; });
rejected('oversized cached input is rejected without truncation', (value) => { value.input = 'x'.repeat(1001); });
rejected('oversized manuscript snapshot is rejected', (value) => { value.pending.snapshot.text = 'x'.repeat(200001); });
rejected('oversized character snapshot is rejected', (value) => { value.pending.snapshot.people = 'x'.repeat(40001); });
rejected('unbounded unit idea list is rejected', (value) => { value.pending.snapshot.unitIdeas = Array(1025).fill(''); });
rejected('unbounded unit idea content is rejected', (value) => { value.pending.snapshot.unitIdeas = Array(20).fill('x'.repeat(40000)); });
rejected('request instruction cannot exceed backend limits', (value) => { value.pending.request.instruction = 'x'.repeat(1001); });
rejected('unknown context fields are rejected', (value) => { value.pending.request.context.creditCost = '0'; });
rejected('malformed preview kind is rejected', (value) => { value.preview.kind = 'scene-move'; }, previewFixture());
rejected('preview cannot switch books', (value) => { value.preview.projectId = '44444444-4444-4444-8444-444444444444'; }, previewFixture());
rejected('preview cannot hide a different edit behind append', (value) => { value.preview.after = 'Replacement, not continuation.'; }, previewFixture());
rejected('preview cannot include unbounded output', (value) => { value.preview.after = 'x'.repeat(224001); }, previewFixture());
rejected('preview cannot change destination through unit index', (value) => { value.preview.unitIndex = 8; }, previewFixture());
rejected('malformed undo must not survive parsing', (value) => { value.undo = { ...value.preview, kind: 'erase-book' }; value.preview = null; }, previewFixture());
rejected('simultaneous preview and pending work is rejected', (value) => { value.preview = previewFixture().preview; });
test('invalid parsed cache is never mutated during validation', () => {
  const value = pendingFixture(); value.pending.request.protectReserve = false;
  const before = JSON.stringify(value);
  assert.equal(parseCockpitRecovery(value, scope), null);
  assert.equal(JSON.stringify(value), before);
});
test('invalid external account or book scope is rejected', () => {
  assert.equal(parseCockpitRecovery(pendingFixture(), { projectId: 'not-a-book-id', ownerId }), null);
  assert.equal(parseCockpitRecovery(pendingFixture(), { projectId, ownerId: 'not-an-account-id' }), null);
});
test('JSON round-trip preserves valid request verbatim without generating an ID', () => {
  const value = clone(pendingFixture('character'));
  const before = JSON.stringify(value.pending.request);
  const restored = parseCockpitRecovery(value, scope);
  assert.ok(restored);
  assert.equal(JSON.stringify(restored.pending.request), before);
});

console.log(`AI cockpit recovery: ${count} validation suites passed (account/book scope, exact retry identity, paid action/cost guards, bounded cache, preview and undo integrity).`);
