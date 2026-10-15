import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the real hook and lease implementation without pretending simulated
// audio proves physical-device recognition, latency, or battery performance.
const sources = Object.fromEntries(await Promise.all(['cockpit-voice', 'speech-session'].map(async (name) => [name, ts.transpileModule(
  await readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText])));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createHarness(initialOptions = {}, nativeAvailable = true) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  const same = (a, b) => a?.length === b?.length && a.every((item, index) => Object.is(item, b[index]));
  const react = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useState(value) {
      const index = cursor++;
      slots[index] ??= { value };
      return [slots[index].value, (next) => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) slots[index] = { callback, dependencies };
      return slots[index].callback;
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) {
        const previous = slots[index];
        effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: callback() }; });
      }
    },
  };
  const events = new Map();
  const emit = (name, event = null) => { for (const listener of events.get(name) ?? []) listener(event); };
  let recognitionState = 'inactive';
  let speakingOptions;
  const appStateListeners = new Set();
  const calls = { starts: [], aborts: 0, speechStops: 0, spoken: [], finals: [] };
  const speech = {
    maxSpeechInputLength: 4_000,
    async stop() {
      calls.speechStops += 1;
      const previous = speakingOptions;
      speakingOptions = undefined;
      previous?.onStopped?.();
    },
    speak(text, options) {
      assert.equal(recognitionState, 'inactive', 'TTS must not speak over an active microphone.');
      calls.spoken.push(text);
      speakingOptions = options;
      options.onStart?.();
    },
  };
  const native = {
    isRecognitionAvailable: () => true,
    supportsOnDeviceRecognition: () => true,
    getSupportedLocales: async () => ({ locales: ['en-US'], installedLocales: ['en-US'] }),
    getStateAsync: async () => recognitionState,
    requestPermissionsAsync: async () => ({ granted: true }),
    start(options) {
      assert.equal(speakingOptions, undefined, 'Recording must wait for TTS to stop.');
      calls.starts.push(options);
      recognitionState = 'recognizing';
      emit('start');
    },
    abort() { calls.aborts += 1; recognitionState = 'inactive'; emit('end'); },
    addListener(name, listener) {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name).add(listener);
      return { remove: () => events.get(name).delete(listener) };
    },
  };
  const appState = {
    currentState: 'active',
    addEventListener(_name, listener) { appStateListeners.add(listener); return { remove: () => appStateListeners.delete(listener) }; },
  };
  const loaded = new Map();
  const modules = {
    react,
    expo: { requireOptionalNativeModule: () => nativeAvailable ? {} : null },
    'expo-speech': speech,
    'expo-speech-recognition': { ExpoSpeechRecognitionModule: native },
    'react-native': { AppState: appState, Platform: { OS: 'ios' } },
    './speech-preferences': { loadBookezSpeechVoice: async () => null },
  };
  const load = (name) => {
    if (modules[name]) return modules[name];
    const sourceName = name.replace('./', '');
    if (loaded.has(sourceName)) return loaded.get(sourceName).exports;
    assert.ok(sources[sourceName], `Unexpected dependency: ${name}`);
    const module = { exports: {} };
    loaded.set(sourceName, module);
    new Function('require', 'module', 'exports', sources[sourceName])(load, module, module.exports);
    return module.exports;
  };
  const { useCockpitVoice } = load('cockpit-voice');
  let options = { enabled: true, mode: 'dictation', onFinal: (text, metadata) => { calls.finals.push({ text, metadata }); }, ...initialOptions };
  const render = (changes = {}) => {
    options = { ...options, ...changes };
    cursor = 0;
    const result = useCockpitVoice(options);
    effects.splice(0).forEach((effect) => effect());
    return result;
  };
  return {
    calls, native, speech, render, leases: load('./speech-session'),
    emit,
    result(text, isFinal = false) { emit('result', { isFinal, results: [{ transcript: text, confidence: 1, segments: [] }] }); },
    end() { recognitionState = 'inactive'; emit('end'); },
    background() { appState.currentState = 'background'; appStateListeners.forEach((listener) => listener('background')); },
    completeSpeech() { const previous = speakingOptions; speakingOptions = undefined; previous?.onDone?.(); },
    unmount() { slots.forEach((slot) => slot.cleanup?.()); },
    listenerCount() { return [...events.values()].reduce((count, listeners) => count + listeners.size, appStateListeners.size); },
  };
}

{
  const harness = createHarness();
  let voice = harness.render();
  assert.equal(harness.calls.starts.length, 0, 'Opening must never start the microphone.');
  const stableStart = voice.start;
  const stableStop = voice.stop;
  await voice.start();
  voice = harness.render();
  assert.equal(voice.status, 'listening');
  assert.equal(voice.onDevice, true);
  assert.equal(voice.start, stableStart);
  assert.equal(voice.stop, stableStop);
  harness.result('A captured idea');
  voice.stop();
  voice.stop();
  assert.equal(harness.calls.finals.length, 1, 'Stopping twice must not duplicate a recovered partial.');
  assert.equal(harness.calls.finals[0].text, 'A captured idea');
  assert.equal(harness.calls.finals[0].metadata.recoveredPartial, true);
  assert.equal(harness.calls.finals[0].metadata.mode, 'dictation');
  harness.unmount();
  assert.equal(harness.listenerCount(), 0, 'Unmount must remove every native and AppState listener.');
}

{
  const harness = createHarness({ mode: 'command' });
  const voice = harness.render();
  await voice.start();
  harness.result('Add note: the door is locked', true);
  harness.result('Add note: the door is locked', true);
  harness.result('Add note: the door is locked');
  voice.stop();
  assert.equal(harness.calls.finals.length, 1, 'A repeated final/interim event must not execute the command twice.');
  await voice.start();
  harness.result('Delete this');
  voice.stop();
  assert.equal(harness.calls.finals.length, 1, 'A partial command must never execute on close.');
  harness.unmount();
}

{
  const harness = createHarness();
  const voice = harness.render();
  await voice.start();
  const longCapture = 'a'.repeat(8_200);
  harness.result(longCapture, true);
  assert.equal(harness.calls.finals.map((entry) => entry.text).join(''), longCapture, 'A long final capture is preserved in bounded segments, never clipped.');
  assert.ok(harness.calls.finals.every((entry) => entry.text.length <= 8_000));
  harness.unmount();
}

{
  const harness = createHarness({ mode: 'command' });
  const voice = harness.render();
  await voice.start();
  harness.result('Luna add a note '.repeat(800), true);
  assert.equal(harness.calls.finals.length, 0, 'An overlong command must not execute a clipped instruction.');
  assert.equal(harness.render().status, 'error');
  harness.unmount();
}

{
  const harness = createHarness();
  let grantPermission;
  harness.native.requestPermissionsAsync = () => new Promise((resolve) => { grantPermission = resolve; });
  const voice = harness.render();
  const starting = voice.start();
  await delay(0);
  harness.render({ enabled: false });
  grantPermission({ granted: true });
  await starting;
  assert.equal(harness.calls.starts.length, 0, 'Granting permission after close must not start recording.');
  harness.unmount();
}

{
  const harness = createHarness({ handsFree: true });
  const voice = harness.render();
  await voice.start();
  harness.result('Keep this before a phone call');
  harness.background();
  await delay(350);
  assert.equal(harness.calls.finals[0].text, 'Keep this before a phone call');
  assert.equal(harness.calls.starts.length, 1, 'Background must stop a hands-free loop.');
  assert.equal(harness.calls.aborts, 1);
  harness.unmount();
}

{
  let finishAction;
  const harness = createHarness({ mode: 'command', handsFree: true, onFinal: () => new Promise((resolve) => { finishAction = resolve; }) });
  const voice = harness.render();
  await voice.start();
  harness.result('Add note: a lighthouse', true);
  harness.end();
  await delay(350);
  assert.equal(harness.calls.starts.length, 1, 'Hands-free must await the validated action before listening again.');
  finishAction();
  await delay(400);
  assert.equal(harness.calls.starts.length, 2);
  const playback = voice.speak('Your note was saved.');
  await delay(100);
  assert.equal(harness.calls.spoken.length, 1);
  assert.equal(harness.render().status, 'speaking');
  harness.completeSpeech();
  await playback;
  await delay(400);
  assert.equal(harness.calls.starts.length, 3, 'Opted-in hands-free may restart only after spoken playback completes.');
  voice.stop();
  harness.unmount();
}

{
  const harness = createHarness({ handsFree: true });
  const voice = harness.render();
  await voice.start();
  harness.result('Offline recovery');
  harness.emit('error', { error: 'network', message: 'Network lost.' });
  await delay(350);
  assert.equal(harness.calls.finals[0].text, 'Offline recovery');
  assert.equal(harness.calls.starts.length, 1, 'Recognition errors must not spin in an automatic retry loop.');
  assert.equal(harness.render().status, 'error');
  harness.unmount();
}

{
  const harness = createHarness({}, false);
  const voice = harness.render();
  assert.equal(voice.available, false);
  await voice.start();
  assert.match(harness.render().error, /installed build/);
  assert.equal(harness.calls.starts.length, 0);
  harness.unmount();
}

{
  const harness = createHarness();
  const { requestSpeechSession, releaseSpeechSession, ownsSpeechSession, waitForSpeechRecognitionIdle } = harness.leases;
  let interrupted = 0;
  assert.equal(await requestSpeechSession('editor', () => { interrupted += 1; releaseSpeechSession('editor'); }, async () => {}), true);
  assert.equal(await requestSpeechSession('cockpit', () => releaseSpeechSession('cockpit'), async () => {}), true);
  assert.equal(interrupted, 1);
  assert.equal(ownsSpeechSession('cockpit'), true);
  let finishOld;
  const old = requestSpeechSession('old', () => {}, () => new Promise((resolve) => { finishOld = resolve; }));
  await delay(0);
  assert.equal(await requestSpeechSession('new', () => {}, async () => {}), true);
  finishOld();
  assert.equal(await old, false);
  assert.equal(ownsSpeechSession('new'), true, 'A stale acquisition must not release the new microphone owner.');
  releaseSpeechSession('new');
  await assert.rejects(waitForSpeechRecognitionIdle({ getStateAsync: () => new Promise(() => {}), abort() {} }), /microphone is still finishing/);
}

console.log('Cockpit voice: explicit start, stable callbacks, partial recovery, duplicate suppression, permissions, cleanup, hands-free sequencing, TTS isolation, native fallback and microphone races passed.');
