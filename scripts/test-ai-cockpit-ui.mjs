import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual launcher/panel and their callbacks with a small deterministic
// hook host. This is a behavioral boundary test, not a native/device FPS test.
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
let host;
const react = {
  memo: (component) => component,
  useState(initial) {
    const owner = host;
    const instance = host.current; const index = instance.cursor++;
    if (!instance.hooks[index]) instance.hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
    const item = instance.hooks[index];
    return [item.value, (value) => { item.value = typeof value === 'function' ? value(item.value) : value; owner.dirty = true; }];
  },
  useRef(initial) { const instance = host.current; const index = instance.cursor++; return (instance.hooks[index] ??= { current: initial }); },
  useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
  useMemo(factory, dependencies) {
    const instance = host.current; const index = instance.cursor++; let item = instance.hooks[index];
    if (!item || !same(item.dependencies, dependencies)) { item = { value: factory(), dependencies }; instance.hooks[index] = item; }
    return item.value;
  },
  useEffect(effect, dependencies) {
    const instance = host.current; const index = instance.cursor++; let item = instance.hooks[index];
    if (!item || !same(item.dependencies, dependencies)) {
      item?.cleanup?.(); item = { dependencies, cleanup: undefined }; instance.hooks[index] = item;
      host.effects.push(() => { item.cleanup = effect(); });
    }
  },
};
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
const jsx = (type, props) => ({ type, props: props ?? {} });
class HookHost {
  instances = new Map(); effects = []; dirty = true; tree; current;
  constructor(component, props) { this.component = component; this.props = props; }
  render() {
    host = this; this.dirty = false; this.effects = []; const seen = new Set();
    const visit = (node, path) => {
      if (node === null || node === undefined || typeof node === 'boolean') return null;
      if (Array.isArray(node)) return node.map((child, index) => visit(child, `${path}.${index}`));
      if (typeof node !== 'object') return node;
      if (typeof node.type === 'function') {
        seen.add(path);
        let instance = this.instances.get(path);
        if (!instance || instance.type !== node.type) { instance = { type: node.type, hooks: [], cursor: 0 }; this.instances.set(path, instance); }
        instance.cursor = 0; this.current = instance;
        return visit(node.type(node.props), `${path}.c`);
      }
      return { ...node, children: visit(node.props.children, `${path}.n`) };
    };
    this.tree = visit(jsx(this.component, this.props), 'root');
    for (const [path, instance] of this.instances) if (!seen.has(path)) { for (const item of instance.hooks) item?.cleanup?.(); this.instances.delete(path); }
    for (const effect of this.effects) effect();
  }
  async flush() { for (let pass = 0; pass < 12; pass++) { if (this.dirty) this.render(); await tick(); if (!this.dirty) { await tick(); if (!this.dirty) break; } } }
  nodes() { const found = []; const walk = (node) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(walk); return; } found.push(node); walk(node.children); }; walk(this.tree); return found; }
  button(label) { const item = this.nodes().find((node) => node.type === 'Pressable' && (node.props.accessibilityLabel === label || text(node.children).includes(label))); assert.ok(item, `Button not found: ${label}`); return item; }
  input(label) { const item = this.nodes().find((node) => node.type === 'TextInput' && node.props.accessibilityLabel === label); assert.ok(item, `Input not found: ${label}`); return item; }
  async press(label) { const node = this.button(label); assert.ok(!node.props.disabled, `Button disabled: ${label}`); node.props.onPress(); await this.flush(); }
  async type(label, value) { this.input(label).props.onChangeText(value); await this.flush(); }
  dispose() { for (const instance of this.instances.values()) for (const item of instance.hooks) item?.cleanup?.(); this.instances.clear(); }
}
function text(node) { if (node === null || node === undefined || typeof node === 'boolean') return ''; if (Array.isArray(node)) return node.map(text).join(''); if (typeof node === 'object') return text(node.children ?? node.props?.children); return String(node); }

const cache = new Map();
const load = (path, mocks = {}) => {
  const key = `${path}:${Object.keys(mocks).join(',')}`;
  if (Object.keys(mocks).length === 0 && cache.has(key)) return cache.get(key);
  const output = {};
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: output, require: (name) => { assert.ok(name in mocks, `Missing mock: ${path} imports ${name}`); return mocks[name]; }, process, console, setTimeout, clearTimeout, AbortController, Promise, Date, Math, Object, JSON });
  if (Object.keys(mocks).length === 0) cache.set(key, output);
  return output;
};
const model = load('src/lib/ai-cockpit-model.ts');
const recovery = load('src/lib/ai-cockpit-recovery.ts');
const { prepareAIWritingContext } = load('src/lib/ai-writing.ts', { expo: { requireOptionalNativeModule: () => null }, './supabase': { supabase: {} }, './ai-provider': {} });
const noteModel = load('src/lib/book-notes-model.ts');
const { BookNotesStore } = load('src/lib/book-notes-store.ts', { './book-notes-model': noteModel });
const colors = new Proxy({}, { get: () => '#78634f' });

function fixture() {
  let uuid = 0; let aiCalls = 0; let voiceOptions; let aiGate; let noteGate;
  const projectId = crypto.randomUUID(); const ownerId = crypto.randomUUID();
  const storage = new Map();
  const location = { partKey: 'unit:0', cursor: 7, scroll: 314 };
  let plan = { drafts: { 'unit:0': 'The original manuscript.', 'unit:1': 'A different chapter.' }, people: '', unitIdeas: ['', ''], partNotes: {}, writeIndex: 0, chapterRevisions: { 'unit:0': 0, 'unit:1': 0 } };
  const parts = [{ key: 'unit:0', title: 'Chapter 1' }, { key: 'unit:1', title: 'Chapter 2' }];
  const snapshot = (key = 'unit:0') => ({ ownerId, projectId, projectTitle: 'Fixture book', partKey: key, partTitle: parts.find((part) => part.key === key).title, text: plan.drafts[key], revision: plan.chapterRevisions[key], people: plan.people, unitIdeas: plan.unitIdeas, nextUnit: key === 'unit:0' ? { key: 'unit:1', title: 'Chapter 2', index: 1 } : undefined, parts, context: { projectTitle: 'Fixture book', chapterTitle: parts.find((part) => part.key === key).title, nearbyText: plan.drafts[key].slice(-1800), toneSample: plan.drafts[key].slice(-900), characters: plan.people.slice(0, 2000), bookIdea: 'A quiet mystery.' } });
  const bridge = { getSnapshot: snapshot, apply: (preview, undo) => { const applied = undo ? model.undoCockpitPreview(plan, projectId, preview) : model.applyCockpitPreview(plan, projectId, preview); if (applied.ok) plan = applied.plan; return applied; } };
  const store = new BookNotesStore(projectId, { id: () => crypto.randomUUID(), read: async () => { if (noteGate) await noteGate.promise; return storage.get('notes') ?? null; }, write: async (value) => { storage.set('notes', value); } });
  const loops = new Set();
  const native = {
    ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Switch: 'Switch', Text: 'Text', TextInput: 'TextInput', View: 'View',
    Platform: { OS: 'ios' }, StyleSheet: { create: (value) => value, absoluteFill: {} }, Easing: { inOut: (value) => value, sin: () => {} },
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    Animated: { View: 'AnimatedView', Value: class { setValue() {} stopAnimation() {} interpolate() { return 1; } }, timing: () => ({}), sequence: () => ({}), loop: () => { const loop = { start: () => loops.add(loop), stop: () => loops.delete(loop) }; return loop; } },
  };
  const voice = { status: 'idle', interim: '', available: true, unavailableReason: '', onDevice: true, error: '', stop() {}, start: async () => {}, speak: async () => {} };
  const service = { isAvailable: async () => false, readCloudStatus: async () => ({ idempotency: true, usage: { month: '2026-10', usedCredits: 0, monthlyCredits: 120 } }), generate: async (request, provider, options) => { aiCalls++; if (aiGate) await aiGate.promise; if (options?.signal.aborted) throw new Error('Aborted'); return { options: ['A new paragraph.'], feedback: 'A chapter outline.', usage: { month: '2026-10', usedCredits: 2, monthlyCredits: 120 } }; } };
  const common = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'react-native': native, '../theme/bookez': { bookezColors: colors } };
  const cockpit = load('src/components/AIWriteCockpit.tsx', {
    ...common, 'expo-crypto': { randomUUID: () => crypto.randomUUID() }, 'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '../lib/ai-writing': { AIWritingService: service, prepareAIWritingContext, deviceSourceLimit: () => 2500 },
    '../lib/ai-usage': { aiUsageRefillLabel: () => 'Refills Nov 1', aiWritingCredits: (_action, mode) => mode === 'book-aware' ? 4 : 2, saveCloudAIUsage: async () => {} },
    '../lib/ai-cockpit-model': model,
    // Modules run in separate vm realms in this test only. Normalize records to
    // the host realm so the real plain-object validator sees app-equivalent data.
    '../lib/ai-cockpit-recovery': { ...recovery, parseCockpitRecovery: (value, scope) => recovery.parseCockpitRecovery(JSON.parse(JSON.stringify(value)), scope) },
    '../lib/cockpit-voice': { useCockpitVoice: (options) => { voiceOptions = options; return voice; } },
    '../lib/book-notes': { getBookNotesStore: () => store }, '../lib/secure-storage': { bookezSecureStorage: { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => { storage.set(key, value); } } }, './BookezUI': { useBookezReduceMotion: () => false },
  });
  const entry = load('src/components/AIWriteCockpitEntry.tsx', { ...common, './AIWriteCockpit': cockpit });
  const renderer = new HookHost(entry.default, { bridge });
  renderer.render();
  return { renderer, location, loops, store, getPlan: () => plan, changeDraft: (key, value) => { plan = { ...plan, drafts: { ...plan.drafts, [key]: value } }; }, setAI: (value) => { aiGate = value; }, aiCalls: () => aiCalls, holdNotes: () => { noteGate = deferred(); return noteGate; }, voiceFinal: (value, id) => voiceOptions.onFinal(value, { id }), storage, projectId };
}

const open = async (test) => test.renderer.press('Open Luna cockpit');
const close = async (test) => { test.renderer.dispose(); await tick(); };

// Twenty panel cycles leave the real bridge source and its simulated editor
// location untouched, and preserve cockpit text while minimized.
const cycles = fixture();
await open(cycles);
await cycles.renderer.type('An idea worth keeping', 'Keep this idea.');
for (let cycle = 0; cycle < 20; cycle++) {
  await cycles.renderer.press('Minimize cockpit and return to writing');
  assert.deepEqual(cycles.location, { partKey: 'unit:0', cursor: 7, scroll: 314 });
  assert.equal(cycles.getPlan().drafts['unit:0'], 'The original manuscript.');
  await cycles.renderer.press('Resume Luna cockpit');
  assert.equal(cycles.renderer.input('An idea worth keeping').props.value, 'Keep this idea.');
}
await close(cycles);

// Rapid taps must share one save, and later typing may not be erased when an
// earlier asynchronous write finishes.
const rapid = fixture(); const held = rapid.holdNotes();
await open(rapid); await rapid.renderer.type('An idea worth keeping', 'First idea.');
const save = rapid.renderer.button('Save note ↗').props.onPress;
save(); save(); await rapid.renderer.flush();
const typedWhileSaving = rapid.renderer.input('An idea worth keeping').props.editable !== false;
if (typedWhileSaving) await rapid.renderer.type('An idea worth keeping', 'Second idea still being typed.');
held.resolve(); await rapid.renderer.flush();
assert.equal(rapid.store.getSnapshot().entries.length, 1, 'Rapid Save taps must not create duplicate notes.');
assert.equal(rapid.renderer.input('An idea worth keeping').props.value, typedWhileSaving ? 'Second idea still being typed.' : '', 'Finishing an earlier save must not erase later input.');
await close(rapid);

// Delayed capture for chapter 1 cannot hijack the next capture for chapter 2.
const target = fixture(); const wait = target.holdNotes();
await open(target);
const firstCapture = target.voiceFinal('First chapter idea.', 'one');
await target.renderer.press('Session settings');
await target.renderer.press('Chapter 2');
const nextCapture = target.voiceFinal('Second chapter idea.', 'two');
wait.resolve(); await Promise.all([firstCapture, nextCapture]); await target.renderer.flush();
const saved = target.store.getSnapshot().entries.map((entry) => entry.note);
assert.equal(saved.length, 2, 'Queued captures with different chapter targets remain separate.');
assert.equal(saved.find((note) => note.links.some((link) => link.targetId === 'unit:0')).content, 'First chapter idea.');
assert.equal(saved.find((note) => note.links.some((link) => link.targetId === 'unit:1')).content, 'Second chapter idea.');
await close(target);

// Capture begun before a mode change stays a note; subsequent dictation and
// wake-word commands remain separate, and duplicate final IDs cannot append.
const boundary = fixture(); const boundaryGate = boundary.holdNotes();
await open(boundary);
const captureBeforeSwitch = boundary.voiceFinal('An idea from capture mode.', 'capture-before');
await boundary.renderer.press('Dictate');
await boundary.voiceFinal('A dictated manuscript sentence.', 'dictation-after');
await boundary.voiceFinal('A dictated manuscript sentence.', 'dictation-after');
const separateCommand = boundary.voiceFinal('Luna, add a note A command note.', 'command-note');
const unknownCommand = boundary.voiceFinal('Luna, unsupported navigation command', 'unknown-command');
boundaryGate.resolve(); await Promise.all([captureBeforeSwitch, separateCommand, unknownCommand]); await boundary.renderer.flush();
assert.equal(boundary.getPlan().drafts['unit:0'], 'The original manuscript.\n\nA dictated manuscript sentence.');
assert.deepEqual(Array.from(boundary.store.getSnapshot().entries, (entry) => entry.note.content).sort(), ['A command note.', 'An idea from capture mode.', 'Luna, unsupported navigation command']);
assert.equal(boundary.aiCalls(), 0, 'Capture, dictation, unknown commands and notes cannot silently spend AI credits.');
await close(boundary);

// Actual generation/preview/apply callbacks protect newer text. Background
// generation can be minimized, and hidden neural animation stops immediately.
const writing = fixture(); const response = deferred(); writing.setAI(response);
await open(writing); await writing.renderer.press('Commands'); await writing.renderer.press('Continue');
await writing.renderer.press('A little Luna light');
await writing.renderer.press('Preview continue');
assert.equal(writing.aiCalls(), 1);
assert.equal(writing.loops.size, 1, 'Only expanded active processing animates.');
await writing.renderer.press('Minimize cockpit and return to writing');
assert.equal(writing.loops.size, 0, 'Hidden neural animation must stop.');
writing.changeDraft('unit:0', 'The original manuscript. Newer typed text.');
response.resolve(); await writing.renderer.flush();
await writing.renderer.press('Resume Luna cockpit');
await writing.renderer.press('Add reviewed writing');
assert.equal(writing.getPlan().drafts['unit:0'], 'The original manuscript. Newer typed text.', 'A stale preview cannot overwrite typing performed during generation.');
await writing.renderer.press('Discard preview');
assert.equal(writing.getPlan().drafts['unit:0'], 'The original manuscript. Newer typed text.');
writing.setAI(null); await writing.renderer.press('Preview continue'); await writing.renderer.press('Add reviewed writing');
assert.match(writing.getPlan().drafts['unit:0'], /A new paragraph\.$/);
await writing.renderer.press('Exit mode');
await writing.renderer.press('Open Luna cockpit');
await writing.renderer.press('Undo last cockpit change');
assert.equal(writing.getPlan().drafts['unit:0'], 'The original manuscript. Newer typed text.');
assert.deepEqual(writing.location, { partKey: 'unit:0', cursor: 7, scroll: 314 });
await close(writing);

const emptyRewrite = fixture();
await open(emptyRewrite); await emptyRewrite.renderer.press('Commands'); await emptyRewrite.renderer.press('Rewrite');
await emptyRewrite.renderer.press('Preview rewrite');
await emptyRewrite.renderer.type('Review and edit Luna preview', '');
assert.equal(emptyRewrite.renderer.button('Apply reviewed rewrite').props.disabled, true, 'Blank rewrite cannot be applied through the UI.');
assert.equal(emptyRewrite.getPlan().drafts['unit:0'], 'The original manuscript.');
await emptyRewrite.renderer.press('Discard preview');
assert.equal(emptyRewrite.getPlan().drafts['unit:0'], 'The original manuscript.');
await close(emptyRewrite);

const previousFlag = process.env.EXPO_PUBLIC_AI_COCKPIT_ENABLED;
try { process.env.EXPO_PUBLIC_AI_COCKPIT_ENABLED = 'false'; const disabled = fixture(); assert.equal(disabled.renderer.tree, null); assert.equal(disabled.aiCalls(), 0); await close(disabled); }
finally { if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_AI_COCKPIT_ENABLED; else process.env.EXPO_PUBLIC_AI_COCKPIT_ENABLED = previousFlag; }
console.log('Cockpit UI callbacks: 20 reopen cycles, input preservation, save deduplication, target isolation, stale generation, reject/apply/undo, hidden animation cleanup and feature flag passed. Native performance and real microphone still require device validation.');
