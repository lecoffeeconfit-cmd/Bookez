import assert from 'node:assert/strict';
import {
  COCKPIT_HISTORY_CHARS,
  COCKPIT_HISTORY_LIMIT,
  COCKPIT_MESSAGE_CHARS,
  COCKPIT_OUTPUT_CHARS,
  COCKPIT_RECEIPT_LIMIT,
  acceptCockpitUtterance,
  appendCockpitHistory,
  applyCockpitPreview,
  createCockpitCharacterPreview,
  createCockpitDraftPreview,
  createCockpitOutlinePreview,
  formatCockpitCharacter,
  parseCockpitCharacter,
  routeCockpitSpeech,
  undoCockpitPreview,
} from '../src/lib/ai-cockpit-model.ts';

let cases = 0;
const test = (name, action) => {
  try { action(); cases += 1; }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
};
const plan = {
  drafts: { 'unit:0': 'The first chapter.', 'unit:1': 'A distant chapter.' },
  people: 'An existing protagonist.',
  unitIdeas: ['First outline', 'Second outline'],
  partNotes: { 'unit:0': 'A private planning note.' },
  writeIndex: 0,
  chapterRevisions: { 'unit:0': 2 },
  draftVersions: [{ text: 'An earlier checkpoint' }],
  customUnrelatedSetting: true,
};
const target = { projectId: 'book-a', partKey: 'unit:0', partTitle: 'Chapter 1', baseText: plan.drafts['unit:0'], baseRevision: 2 };

test('ordinary dictation never invokes an AI operation', () => {
  assert.deepEqual(routeCockpitSpeech('Continue writing until the sunrise.', 'dictation'), { kind: 'dictation', text: 'Continue writing until the sunrise.' });
  assert.deepEqual(routeCockpitSpeech('Create a character with a secret.', 'capture'), { kind: 'capture', text: 'Create a character with a secret.' });
  assert.equal(routeCockpitSpeech('Continue writing', 'commands').kind, 'unrecognized');
});
test('explicit voice commands cannot become manuscript prose', () => {
  for (const [speech, action] of [
    ['Luna, continue writing', 'continue'], ['Hey Luna, rewrite the passage: more hopeful', 'rewrite'],
    ['Bookez, create a character named Mina', 'character'], ['Luna, outline the next chapter', 'outline'],
    ['Luna, undo the last change', 'undo'], ['Luna, read the preview aloud', 'read'],
    ['Luna, stop listening', 'stop'], ['Luna, close the cockpit', 'close'],
  ]) {
    const result = routeCockpitSpeech(speech, 'dictation');
    assert.equal(result.kind, 'command');
    assert.equal(result.action, action);
  }
  assert.deepEqual(routeCockpitSpeech('Luna, add a note: a secret staircase', 'dictation'), { kind: 'command', action: 'note', text: 'a secret staircase' });
  assert.equal(routeCockpitSpeech('Luna, move a scene into chapter six', 'dictation').kind, 'unrecognized');
});
test('capture mode defers review and manuscript changes', () => {
  for (const speech of ['Luna continue writing', 'Luna rewrite', 'Luna create a character', 'Luna outline next chapter', 'Luna undo', 'Luna read aloud']) {
    assert.equal(routeCockpitSpeech(speech, 'capture').kind, 'deferred');
  }
  assert.equal(routeCockpitSpeech('Luna stop listening', 'capture').kind, 'command');
  assert.equal(routeCockpitSpeech('Luna add a note final twist', 'capture').action, 'note');
});
test('duplicate utterance result cannot repeat a command', () => {
  let receipt = acceptCockpitUtterance([], 'session-1', 'final-1');
  assert.equal(receipt.accepted, true);
  receipt = acceptCockpitUtterance(receipt.receipts, 'session-1', 'final-1');
  assert.equal(receipt.accepted, false);
  assert.equal(acceptCockpitUtterance(receipt.receipts, 'session-2', 'final-1').accepted, true);
  assert.equal(acceptCockpitUtterance(receipt.receipts, '', 'final-2').accepted, false);
  for (let index = 2; index < 1_000; index += 1) receipt = acceptCockpitUtterance(receipt.receipts, 'session-1', `final-${index}`);
  assert.equal(receipt.receipts.length, COCKPIT_RECEIPT_LIMIT);
});
test('conversation memory remains bounded throughout long sessions', () => {
  let history = [];
  for (let index = 0; index < 2_000; index += 1) history = appendCockpitHistory(history, { id: String(index), role: 'user', text: 'x'.repeat(5_000), createdAt: index });
  assert.ok(history.length <= COCKPIT_HISTORY_LIMIT);
  assert.ok(history.reduce((total, item) => total + item.text.length, 0) <= COCKPIT_HISTORY_CHARS);
  assert.ok(history.every((item) => item.text.length <= COCKPIT_MESSAGE_CHARS));
  history = appendCockpitHistory(history, { id: '1999', role: 'luna', text: 'Updated status', createdAt: 2001 });
  assert.equal(history.filter((item) => item.id === '1999').length, 1);
});
test('preview creation and rejection leave the original untouched', () => {
  const baseline = JSON.stringify(plan);
  const preview = createCockpitDraftPreview(target, 'A replacement.', 'rewrite', 'preview-1', 100);
  assert.equal(preview.before, plan.drafts['unit:0']);
  assert.equal(preview.after, 'A replacement.');
  assert.equal(JSON.stringify(plan), baseline);
});
test('twenty pure preview reopen cycles preserve writing state', () => {
  // This is a model invariant, not a claim of measured native modal performance.
  const baseline = JSON.stringify(plan);
  for (let index = 0; index < 20; index += 1) {
    const ephemeralPreview = createCockpitDraftPreview(target, 'A possible continuation.');
    assert.equal(ephemeralPreview.before, plan.drafts['unit:0']);
    assert.equal(JSON.stringify(plan), baseline);
  }
});
test('approved append preserves original whitespace and unrelated state', () => {
  const preview = createCockpitDraftPreview(target, 'The next paragraph.');
  const applied = applyCockpitPreview(plan, 'book-a', preview);
  assert.equal(applied.ok, true);
  assert.equal(applied.plan.drafts['unit:0'], 'The first chapter.\n\nThe next paragraph.');
  assert.equal(applied.plan.drafts['unit:1'], plan.drafts['unit:1']);
  assert.equal(applied.plan.writeIndex, plan.writeIndex);
  assert.equal(applied.plan.people, plan.people);
  assert.equal(applied.plan.partNotes, plan.partNotes);
  assert.equal(applied.plan.draftVersions, plan.draftVersions);
  assert.equal(applied.plan.customUnrelatedSetting, true);
  assert.equal(plan.drafts['unit:0'], target.baseText);
});
test('stale text, project, and chapter revision all block application', () => {
  const preview = createCockpitDraftPreview(target, 'New result.');
  assert.equal(applyCockpitPreview({ ...plan, drafts: { ...plan.drafts, 'unit:0': 'Newer writing.' } }, 'book-a', preview).ok, false);
  assert.equal(applyCockpitPreview(plan, 'book-b', preview).ok, false);
  assert.equal(applyCockpitPreview({ ...plan, chapterRevisions: { 'unit:0': 3 } }, 'book-a', preview).ok, false);
  const applied = applyCockpitPreview(plan, 'book-a', preview);
  assert.equal(applyCockpitPreview(applied.plan, 'book-a', preview).ok, false, 'A second apply cannot repeat an insertion.');
});
test('undo restores the exact original and refuses to erase later writing', () => {
  const preview = createCockpitDraftPreview(target, 'The next paragraph.');
  const applied = applyCockpitPreview(plan, 'book-a', preview);
  const undone = undoCockpitPreview(applied.plan, 'book-a', preview);
  assert.equal(undone.ok, true);
  assert.deepEqual(undone.plan, plan);
  assert.equal(undoCockpitPreview({ ...applied.plan, drafts: { ...applied.plan.drafts, 'unit:0': `${preview.after} My new sentence.` } }, 'book-a', preview).ok, false);
  assert.equal(undoCockpitPreview(applied.plan, 'book-b', preview).ok, false);
});
test('remote chapter apply never moves the active writing location', () => {
  const preview = createCockpitDraftPreview({ projectId: 'book-a', partKey: 'unit:1', partTitle: 'Chapter 2', baseText: plan.drafts['unit:1'] }, 'A future chapter paragraph.');
  const applied = applyCockpitPreview(plan, 'book-a', preview);
  assert.equal(applied.ok, true);
  assert.equal(applied.plan.writeIndex, 0);
  assert.equal(applied.plan.drafts['unit:0'], plan.drafts['unit:0']);
  assert.equal(undoCockpitPreview(applied.plan, 'book-a', preview).plan.writeIndex, 0);
});
test('large chapter is preserved exactly, never truncated for recovery', () => {
  const large = 'An important manuscript sentence. '.repeat(40_000);
  const largePlan = { ...plan, drafts: { ...plan.drafts, 'unit:0': large } };
  const preview = createCockpitDraftPreview({ ...target, baseText: large }, 'One more sentence.', 'dictation');
  const applied = applyCockpitPreview(largePlan, 'book-a', preview);
  assert.equal(applied.ok, true);
  assert.equal(applied.plan.drafts['unit:0'], `${large}\n\nOne more sentence.`);
  assert.equal(undoCockpitPreview(applied.plan, 'book-a', preview).plan.drafts['unit:0'], large);
});
test('character profile has real structured fields in existing planning', () => {
  const profile = { name: 'Mina', role: 'Navigator', goal: 'Find a lost island', motivation: 'Bring her brother home', conflict: 'She distrusts the sea', voice: 'Precise, then lyrical', arc: 'Learns to accept uncertainty' };
  const parsed = parseCockpitCharacter(`\`\`\`json\n${JSON.stringify(profile)}\n\`\`\``);
  const formatted = formatCockpitCharacter(parsed);
  assert.match(formatted, /## Mina/);
  assert.match(formatted, /Goal: Find a lost island/);
  const preview = createCockpitCharacterPreview('book-a', plan.people, formatted);
  const applied = applyCockpitPreview(plan, 'book-a', preview);
  assert.equal(applied.ok, true);
  assert.equal(applied.plan.people, `${plan.people}\n\n${formatted}`);
  assert.equal(applied.plan.drafts, plan.drafts);
  assert.equal(undoCockpitPreview(applied.plan, 'book-a', preview).plan.people, plan.people);
  assert.equal(applyCockpitPreview({ ...plan, people: 'A newer character.' }, 'book-a', preview).ok, false);
  assert.throws(() => parseCockpitCharacter('{"name":"Only a name"}'));
  assert.throws(() => parseCockpitCharacter('Not structured JSON'));
  assert.throws(() => parseCockpitCharacter('[]'));
});
test('next chapter outline saves to unitIdeas without changing manuscript or navigation', () => {
  const preview = createCockpitOutlinePreview('book-a', { partKey: 'unit:1', partTitle: 'Chapter 2', unitIndex: 1 }, plan.unitIdeas[1], 'Arrival → suspicion → revelation');
  const applied = applyCockpitPreview(plan, 'book-a', preview);
  assert.equal(applied.ok, true);
  assert.deepEqual(applied.plan.unitIdeas, ['First outline', 'Arrival → suspicion → revelation']);
  assert.equal(applied.plan.writeIndex, 0);
  assert.equal(applied.plan.drafts, plan.drafts);
  assert.equal(applied.plan.partNotes, plan.partNotes);
  assert.equal(undoCockpitPreview(applied.plan, 'book-a', preview).plan.unitIdeas[1], plan.unitIdeas[1]);
  assert.equal(applyCockpitPreview({ ...plan, unitIdeas: ['First outline', 'Newer outline'] }, 'book-a', preview).ok, false);
  assert.throws(() => createCockpitOutlinePreview('book-a', { partKey: 'unit:2', partTitle: 'Mismatch', unitIndex: 1 }, '', 'Outline'));
  assert.throws(() => createCockpitOutlinePreview('book-a', { partKey: 'unit:1000000000', partTitle: 'Huge', unitIndex: 1_000_000_000 }, '', 'Outline'));
});
test('empty and excessive output fail without silently losing generated text', () => {
  assert.throws(() => createCockpitDraftPreview(target, '   '));
  assert.throws(() => createCockpitDraftPreview(target, 'x'.repeat(COCKPIT_OUTPUT_CHARS + 1)));
  assert.throws(() => createCockpitDraftPreview({ ...target, projectId: '' }, 'Text'));
});

console.log(`AI cockpit model: ${cases} safety suites passed (routing, bounds, duplicate suppression, conflict guards, preview rejection, undo, planning, large chapters). Native voice, modal performance, and server credits require separate end-to-end validation.`);
