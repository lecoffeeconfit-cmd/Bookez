import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { AIWritingService, deviceSourceLimit, prepareAIWritingContext, type AICloudUsage } from '../lib/ai-writing';
import { aiUsageRefillLabel, aiWritingCredits, saveCloudAIUsage } from '../lib/ai-usage';
import { acceptCockpitUtterance, appendCockpitHistory, createCockpitCharacterPreview, createCockpitDraftPreview, createCockpitOutlinePreview, formatCockpitCharacter, parseCockpitCharacter, routeCockpitSpeech, type CockpitMessage, type CockpitPreview, type CockpitSpeechMode, type CockpitSpeechReceipt } from '../lib/ai-cockpit-model';
import { useCockpitVoice } from '../lib/cockpit-voice';
import { parseCockpitRecovery, type CockpitRecovery as Recovery, type CockpitRecoveryPending as Pending } from '../lib/ai-cockpit-recovery';
import { getBookNotesStore } from '../lib/book-notes';
import { bookezSecureStorage } from '../lib/secure-storage';
import { useBookezReduceMotion } from './BookezUI';
import type { CockpitBridge, CockpitSnapshot } from './AIWriteCockpitEntry';
import { bookezColors as c } from '../theme/bookez';

type Action = 'note' | 'continue' | 'rewrite' | 'character' | 'outline';
const actions: Array<{ id: Action; label: string }> = [
  { id: 'note', label: 'Add note' }, { id: 'continue', label: 'Continue' },
  { id: 'rewrite', label: 'Rewrite' }, { id: 'character', label: 'Character' }, { id: 'outline', label: 'Next outline' },
];
// Serialize recovery writes across close/reopen; one encrypted record per account/book.
const recoveryQueues = new Map<string, Promise<unknown>>();
function writeRecovery(key: string, value: Recovery) {
  const write = (recoveryQueues.get(key) ?? Promise.resolve()).catch(() => undefined)
    .then(() => bookezSecureStorage.setItem(key, JSON.stringify(value)));
  recoveryQueues.set(key, write);
  void write.finally(() => { if (recoveryQueues.get(key) === write) recoveryQueues.delete(key); }).catch(() => undefined);
  return write;
}

/** Two native-driver transforms only; never ticks React or the manuscript. */
const LunaLight = memo(function LunaLight({ active, expanded }: { active: boolean; expanded: boolean }) {
  const reduceMotion = useBookezReduceMotion();
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    phase.setValue(0);
    if (!active || !expanded || reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(phase, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(phase, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => { loop.stop(); phase.stopAnimation(); };
  }, [active, expanded, phase, reduceMotion]);
  return <View style={[s.orbit, !expanded && s.orbitSmall]} accessible={false}>
    <Animated.View style={[s.orbitRing, { opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }), transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] }) }] }]} />
    <LinearGradient colors={[c.secondaryAccent, c.accentStrong]} style={s.orbitCore}><Text style={s.orbitStar}>✦</Text></LinearGradient>
    {expanded && <><View style={[s.node, { top: 5, left: 24 }]} /><View style={[s.node, { right: 8, bottom: 24 }]} /><View style={[s.node, { left: 5, bottom: 24 }]} /></>}
  </View>;
});

function AIWriteCockpit({ bridge, visible, onMinimize, onExit }: { bridge: CockpitBridge; visible: boolean; onMinimize: () => void; onExit: () => void }) {
  const initialRef = useRef<CockpitSnapshot | null>(null);
  if (!initialRef.current) initialRef.current = bridge.getSnapshot();
  const initial = initialRef.current;
  const rememberedTarget = useRef(initial);
  const [mode, setMode] = useState<CockpitSpeechMode>('capture');
  const [action, setAction] = useState<Action>('note');
  const [input, setInput] = useState('');
  const [partKey, setPartKey] = useState(initial?.partKey ?? '');
  const [preview, setPreview] = useState<CockpitPreview | null>(null);
  const [undo, setUndo] = useState<CockpitPreview | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [message, setMessage] = useState('Capture an idea. Keep the writing flow.');
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<AICloudUsage>();
  const [cloudReady, setCloudReady] = useState(false);
  const [phoneReady, setPhoneReady] = useState(false);
  const [provider, setProvider] = useState<'device' | 'cloud'>('cloud');
  const [statusChecked, setStatusChecked] = useState(false);
  const [restored, setRestored] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [spoken, setSpoken] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [history, setHistory] = useState<CockpitMessage[]>([]);
  const live = useRef(true);
  const recoveryLoaded = useRef(false);
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const receipt = useRef<CockpitSpeechReceipt[]>([]);
  const sessionId = useRef(Crypto.randomUUID()).current;
  const captureId = useRef<{ id: string; partKey: string; epoch: number } | null>(null);
  const captureEpoch = useRef(0);
  const manualSaveLock = useRef(false);
  const noteQueue = useRef<Promise<unknown>>(Promise.resolve());
  const voiceFinal = useRef<(text: string, meta: { id: string; recoveredPartial?: boolean }) => Promise<void>>(async () => undefined);
  const latest = useRef({ input, action, preview, pending, mode, partKey, spoken, undo });
  latest.current = { input, action, preview, pending, mode, partKey, spoken, undo };
  const recoveryKey = `bookez.cockpit.v1.${initial?.ownerId ?? 'local'}.${initial?.projectId ?? 'none'}`;
  const persist = useCallback(() => recoveryLoaded.current ? writeRecovery(recoveryKey, {
    ownerId: initial?.ownerId ?? null, projectId: initial?.projectId ?? '',
    input: latest.current.input, action: latest.current.action, preview: latest.current.preview, pending: latest.current.pending, undo: latest.current.undo,
  }) : Promise.resolve(), [recoveryKey]);
  const voice = useCockpitVoice({ enabled: visible && foreground && restored, mode: mode === 'commands' ? 'command' : 'dictation', handsFree,
    onFinal: (text, meta) => voiceFinal.current(text, meta), preferOnDevice: true });
  const say = (text: string) => {
    if (latest.current.spoken && visible && foreground) void voice.speak(text);
  };
  const addHistory = (role: CockpitMessage['role'], text: string) => {
    if (live.current) setHistory((items) => appendCockpitHistory(items, { id: Crypto.randomUUID(), role, text, createdAt: Date.now() }));
  };
  const notify = (text: string) => { if (live.current) { setMessage(text); addHistory('status', text); } };

  useEffect(() => {
    let active = true;
    const statusAbort = new AbortController();
    void Promise.allSettled([AIWritingService.isAvailable(), AIWritingService.readCloudStatus(statusAbort.signal)]).then((results) => {
      if (!active) return;
      const device = results[0].status === 'fulfilled' && results[0].value;
      const cloud = results[1].status === 'fulfilled' ? results[1].value : undefined;
      setPhoneReady(device); setProvider(device ? 'device' : 'cloud');
      setCloudReady(cloud?.idempotency === true); setUsage(cloud?.usage); setStatusChecked(true);
    });
    void (recoveryQueues.get(recoveryKey) ?? Promise.resolve()).catch(() => undefined).then(() => bookezSecureStorage.getItem(recoveryKey)).then((raw) => {
      if (!active || !raw) return;
      try {
        if (raw.length > 2_000_000) throw new Error('Oversized recovery');
        const value = parseCockpitRecovery(JSON.parse(raw), { ownerId: initial?.ownerId ?? null, projectId: initial?.projectId ?? '' });
        if (!value) throw new Error('Invalid recovery');
        setInput(value.input); setAction(value.action);
        if (value.preview) { setPreview(value.preview); setMessage('Your unapplied preview was recovered. Your manuscript is unchanged.'); }
        if (value.pending) { setPending(value.pending); setMessage('An interrupted request was recovered. Retry uses its original request ID. Nothing is applied automatically.'); }
        if (value.undo) {
          const saved = value.undo;
          const current = bridge.getSnapshot(saved.kind === 'character' ? undefined : saved.partKey);
          const currentText = saved.kind === 'character' ? current?.people : saved.kind === 'outline' ? current?.unitIdeas[saved.unitIndex!] ?? '' : current?.text;
          if (currentText === saved.before) { setPreview(saved); setMessage('Recovered a change that had not finished autosaving. Review it before applying.'); }
          else { setUndo(saved); setMessage('Your last cockpit change was recovered. Undo is guarded against newer writing.'); }
        }
      } catch { setError('The previous cockpit session could not be read. Your manuscript is unaffected.'); }
    }).catch(() => { if (active) setError('Could not read cockpit recovery. Your manuscript is unaffected.'); }).finally(() => { if (active) { recoveryLoaded.current = true; setRestored(true); } });
    return () => { active = false; statusAbort.abort(); };
  }, [recoveryKey]);
  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => { void persist().catch(() => { if (live.current) setError('Could not save cockpit recovery on this device. Keep this session open and retry.'); }); }, 350);
    return () => clearTimeout(timer);
  }, [input, action, preview, pending, restored, persist]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active') { voice.stop(); void persist().catch(() => undefined); }
    });
    return () => subscription.remove();
  }, [persist, voice.stop]);
  useEffect(() => { live.current = true; return () => { live.current = false; abort.current?.abort(); if (restored) void persist().catch(() => undefined); }; }, [persist, restored]);

  const snapshot = () => {
    const current = bridge.getSnapshot(latest.current.partKey);
    if (!current || current.projectId !== initial?.projectId) throw new Error('This book is no longer open. Close Luna and reopen it in the correct book.');
    rememberedTarget.current = current;
    return current;
  };
  const saveNote = (text: string, continuous = false, title?: string) => {
    let target: CockpitSnapshot;
    try { target = snapshot(); }
    catch {
      // A route/account change can unmount a recognizer with a final partial.
      // Recover only to the original private notebook, never the newly open book.
      if (!rememberedTarget.current) throw new Error('The original notebook is unavailable.');
      target = rememberedTarget.current;
    }
    const writing = text.trim();
    if (!writing) return Promise.resolve();
    const epoch = captureEpoch.current;
    // Capture work is serial, so simultaneous final/stop callbacks cannot lose words.
    const task = noteQueue.current.catch(() => undefined).then(async () => {
      const store = getBookNotesStore(target.ownerId, target.projectId);
      await store.load();
      const capture = captureId.current;
      let note = continuous && capture?.partKey === target.partKey && capture.epoch === epoch ? store.getSnapshot().entries.find((entry) => entry.note.id === capture.id)?.note : undefined;
      if (!note || note.content.length + writing.length > 20_000) {
        note = store.create('Ideas');
        if (continuous && epoch === captureEpoch.current) captureId.current = { id: note.id, partKey: target.partKey, epoch };
        store.update(note.id, { title: title ?? `Voice capture · ${target.partTitle}`, tags: ['luna-cockpit'], links: [{ id: Crypto.randomUUID(), kind: 'chapter', targetId: target.partKey, label: target.partTitle }] });
      }
      store.update(note.id, { content: [note.content, writing].filter(Boolean).join('\n\n') });
      await store.flush();
      if (live.current) { setMessage(`Saved on this device in ${target.projectTitle} → Notes. Cloud backup follows your settings.`); setError(''); }
    });
    noteQueue.current = task;
    return task;
  };

  const apply = (proposal: CockpitPreview, reversing = false) => {
    voice.stop();
    const result = bridge.apply(proposal, reversing);
    if (!result.ok) { setError(result.reason ?? 'This content changed. Nothing was overwritten.'); return; }
    if (reversing) { setUndo(null); latest.current.undo = null; }
    else { setUndo(proposal); latest.current.undo = proposal; setPreview(null); latest.current.preview = null; }
    notify(reversing ? 'Restored the previous version. Your writing position is unchanged.' : `Applied to ${proposal.partTitle}. Your writing position is unchanged.`);
    void persist().catch(() => setError('The edit was applied, but cockpit recovery could not be updated.'));
  };

  const generate = async (retry?: Pending) => {
    if (lock.current || !restored) return;
    if (!retry && preview) { setError('Apply or discard your current preview before starting another.'); return; }
    lock.current = true; setBusy(true); setError(''); voice.stop();
    const controller = new AbortController(); abort.current = controller;
    let work = retry;
    try {
      if (!work) {
        const target = snapshot();
        if (target.text.length > 200_000 || target.people.length > 40_000) throw new Error('This section is too large for a safe cockpit preview. Use the existing passage tools or capture a note instead.');
        const selected = latest.current.action;
        if (selected === 'note') return;
        if (selected === 'outline' && !target.nextUnit) throw new Error('There is no next planned chapter. Add one in Plan first.');
        if (selected === 'rewrite' && (!target.text.trim() || target.text.length > 12_000)) throw new Error('Cockpit rewrite supports complete sections up to 12,000 characters. Use the existing passage tools for larger chapters.');
        if (selected === 'rewrite' && provider === 'device' && target.text.length > deviceSourceLimit('rewrite')) throw new Error('This complete section is too long for phone AI. Use the existing passage tools, or choose Bookez credits when cloud previews are available. No AI request was started.');
        const contextMode = selected === 'character' || selected === 'outline' ? 'book-aware' : 'nearby';
        const direction = latest.current.input.trim();
        const instruction = selected === 'character'
          ? `Create one character matching this book. Put ONLY a JSON object in feedback with string fields name, role, goal, motivation, conflict, voice, arc. All fields required. Keep each under 300 characters. ${direction}`
          : selected === 'outline' ? `Outline ${target.nextUnit!.title}. Put a concise outline in feedback: goal, conflict, 4-6 beats, and ending turn. Do not write prose. ${direction}`
          : selected === 'rewrite' ? `Revise the complete supplied passage faithfully, preserving meaning and paragraphs. ${direction}`
          : `Continue directly after this passage with 150-250 words. No repetition, commentary, or chapter heading. ${direction}`;
        work = { action: selected, snapshot: target, provider, request: { requestId: Crypto.randomUUID(), cockpitAction: selected === 'character' || selected === 'outline' ? selected : undefined, operation: selected === 'character' || selected === 'outline' ? 'ask' : selected, text: selected === 'rewrite' ? target.text : target.text.slice(-2400), instruction: instruction.slice(0, 1000), protectReserve: true,
          context: prepareAIWritingContext(target.context, contextMode) } };
        if (!parseCockpitRecovery({ ownerId: initial?.ownerId ?? null, projectId: target.projectId, input: direction, action: selected, preview: null, pending: work, undo: null }, { ownerId: initial?.ownerId ?? null, projectId: target.projectId })) throw new Error('This book’s context is too large or has changed. Capture a note or use the existing writing tools instead. No AI request was started.');
        // Durable intent is written before any charge or provider request begins.
        latest.current.pending = work; setPending(work); await persist();
      }
      if (controller.signal.aborted) return;
      if (work.provider === 'cloud') {
        const status = await AIWritingService.readCloudStatus(controller.signal);
        if (!status.idempotency || !status.usage) throw new Error('Cockpit cloud generation needs the approved retry-safe server update and a connection. Capture and supported phone AI remain available.');
        if (live.current) { setUsage(status.usage); setCloudReady(true); }
        const cost = aiWritingCredits(work.request.operation, work.request.context.contextMode === 'book-aware' ? 'book-aware' : 'nearby');
        const ceiling = Math.floor(status.usage.monthlyCredits * 0.7);
        // A retry may replay an already-paid result, so only the server decides retry affordability.
        if (!retry && status.usage.usedCredits + cost > ceiling) throw new Error(`This preview needs ${cost} credits. Luna is preserving the final 30% for project tools. Capture a note or use available phone AI.`);
      }
      if (controller.signal.aborted) return;
      notify('Luna is preparing a preview. Minimize to keep writing.');
      const result = await AIWritingService.generate(work.request, work.provider === 'device' ? 'device' : 'cloud', { signal: controller.signal });
      if (!live.current || controller.signal.aborted) return;
      if (result.usage) { setUsage(result.usage); await saveCloudAIUsage(result.usage.month, result.usage.usedCredits); }
      const target = work.snapshot;
      const text = (work.action === 'character' || work.action === 'outline' ? result.feedback : result.options?.[0])?.trim();
      if (!text) throw new Error('Luna returned no usable preview. Your original writing is unchanged.');
      const proposal = work.action === 'character' ? createCockpitCharacterPreview(target.projectId, target.people, formatCockpitCharacter(parseCockpitCharacter(text)), work.request.requestId)
        : work.action === 'outline' ? createCockpitOutlinePreview(target.projectId, { partKey: target.nextUnit!.key, partTitle: target.nextUnit!.title, unitIndex: target.nextUnit!.index }, target.unitIdeas[target.nextUnit!.index] ?? '', text, work.request.requestId)
        : createCockpitDraftPreview({ projectId: target.projectId, partKey: target.partKey, partTitle: target.partTitle, baseText: target.text, baseRevision: target.revision }, text, work.action === 'rewrite' ? 'rewrite' : 'append', work.request.requestId);
      setPreview(proposal); setPending(null); latest.current.preview = proposal; latest.current.pending = null;
      await persist();
      notify('Preview ready. Nothing has changed in your book. Review when parked.');
      addHistory('luna', text); say('Your preview is ready. Nothing has been changed in your book.');
    } catch (caught) {
      if (live.current) setError(controller.signal.aborted ? 'Stopped waiting. A cloud request may still finish and use credits. Retry the recovered request to retrieve its result without a second charge.' : caught instanceof Error ? caught.message : 'Luna could not finish. Your original writing is unchanged.');
    } finally {
      lock.current = false;
      if (abort.current === controller) abort.current = null;
      if (live.current) setBusy(false);
    }
  };

  voiceFinal.current = async (text, meta) => {
    const accepted = acceptCockpitUtterance(receipt.current, sessionId, meta.id);
    receipt.current = accepted.receipts;
    if (!accepted.accepted || !text.trim()) return;
    const intent = routeCockpitSpeech(text, latest.current.mode);
    addHistory('user', text);
    if (intent.kind === 'capture') { await saveNote(intent.text, true); return; }
    if (intent.kind === 'dictation') {
      let target: CockpitSnapshot;
      try { target = snapshot(); }
      catch { await saveNote(intent.text, true); return; }
      if (target.text.length > 200_000) { await saveNote(intent.text, true); throw new Error('This long chapter is better edited in Write. Your spoken words were kept in this book’s Notes.'); }
      const proposal = createCockpitDraftPreview({ projectId: target.projectId, partKey: target.partKey, partTitle: target.partTitle, baseText: target.text, baseRevision: target.revision }, intent.text, 'dictation');
      const result = bridge.apply(proposal);
      if (!result.ok) { await saveNote(intent.text, true); throw new Error('This chapter changed. Your spoken words were kept in Notes instead.'); }
      if (live.current) { setUndo(proposal); latest.current.undo = proposal; void persist().catch(() => setError('Dictation was applied, but its recovery copy could not be saved.')); setMessage(`Dictated into ${target.partTitle} · saved through normal manuscript autosave.`); }
      return;
    }
    if (intent.kind === 'deferred') { await saveNote(`For later — ${intent.action}: ${intent.text || 'Review this chapter.'}`, true); say('Saved for later. Review edits when parked.'); return; }
    if (intent.kind === 'unrecognized') { await saveNote(intent.text, true); notify('Unrecognized speech was kept in Notes, not your manuscript. Say “Luna, add a note …” or use Capture for free-form ideas.'); return; }
    if (intent.kind !== 'command') return;
    if (intent.action === 'stop') { voice.stop(); notify('Listening stopped.'); return; }
    if (intent.action === 'close') { voice.stop(); void persist().catch(() => undefined); onMinimize(); return; }
    if (intent.action === 'note') { await saveNote(intent.text || latest.current.input, false, 'Luna note'); say('Your note is saved on this device.'); return; }
    if (intent.action === 'undo') { if (latest.current.undo) apply(latest.current.undo, true); else notify('No cockpit edit is available to undo.'); return; }
    if (intent.action === 'read') {
      const current = snapshot();
      const value = latest.current.preview ? previewText(latest.current.preview) : current.text;
      notify('Reading a short excerpt. The microphone pauses during playback.');
      await voice.speak(value ? `Here is an excerpt from ${current.partTitle}. ${latest.current.preview ? value.slice(0, 1500) : value.slice(-1500)}` : 'This chapter is blank.'); return;
    }
    // Voice can prepare a paid action, but cannot silently authorize spending or apply edits.
    setAction(intent.action); setInput(intent.text.slice(0, 1000));
    notify(`${actions.find((item) => item.id === intent.action)?.label} is ready to preview. Review the displayed cost and tap Preview when parked.`);
    say('Your request is ready. Review the cost and preview when parked.');
  };

  const minimize = () => { voice.stop(); void persist().catch(() => undefined); onMinimize(); };
  const exit = () => {
    voice.stop(); abort.current?.abort(); onMinimize();
    void noteQueue.current.then(persist).then(onExit).catch(() => { if (live.current) setError('Could not save recovery. Resume Luna and retry before exiting.'); });
  };
  const changeMode = (next: CockpitSpeechMode) => { voice.stop(); captureEpoch.current += 1; captureId.current = null; setMode(next); if (next === 'capture') setAction('note'); };
  const saveTypedNote = () => {
    if (manualSaveLock.current || !latest.current.input.trim()) return;
    voice.stop(); manualSaveLock.current = true; setSavingNote(true);
    const text = latest.current.input;
    void Promise.resolve().then(() => saveNote(text, false, 'Luna capture')).then(() => {
      if (live.current && latest.current.input === text) { latest.current.input = ''; setInput(''); }
    }).catch((caught) => { if (live.current) setError(caught instanceof Error ? caught.message : 'Could not save this note.'); }).finally(() => { manualSaveLock.current = false; if (live.current) setSavingNote(false); });
  };
  const selectedSnapshot = bridge.getSnapshot(partKey);
  if (selectedSnapshot?.projectId === initial?.projectId) rememberedTarget.current = selectedSnapshot;
  const costMode = action === 'character' || action === 'outline' ? 'book-aware' : 'nearby';
  const cost = aiWritingCredits(action, costMode);
  const canGenerate = provider === 'device' ? phoneReady : cloudReady && Boolean(usage);
  const listening = voice.status === 'listening' || voice.status === 'starting';
  const selectedParts = selectedSnapshot?.parts ?? initial?.parts ?? [];
  const usablePreview = preview ? previewText(preview).trim().length > 0 && preview.after !== preview.before : false;
  const inputLabel = mode === 'capture' ? 'An idea worth keeping' : action === 'note' ? 'A note for this book' : 'A little direction for Luna';

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={minimize} statusBarTranslucent>
    <View style={s.shade}>
      <Pressable style={StyleSheet.absoluteFill} onPress={minimize} accessibilityLabel="Minimize Luna cockpit" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheet} accessibilityViewIsModal>
        <View style={s.handle} />
        <View style={s.header}><LunaLight active={visible && foreground && (busy || listening)} expanded={false} /><View style={s.headerCopy}><Text style={s.eyebrow}>BOOKEZ · LUNA</Text><Text style={s.title}>A little room for ideas.</Text></View><Pressable onPress={minimize} style={s.iconButton} accessibilityRole="button" accessibilityLabel="Minimize cockpit and return to writing"><Text style={s.close}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.book} numberOfLines={1}>{initial?.projectTitle} <Text style={s.muted}>/ {selectedSnapshot?.partTitle ?? initial?.partTitle}</Text></Text>
          <View style={s.modes}>{([['capture', 'Capture'], ['commands', 'Commands'], ['dictation', 'Dictate']] as const).map(([key, label]) => <Pressable key={key} onPress={() => changeMode(key)} style={[s.mode, mode === key && s.modeActive]} accessibilityRole="button" accessibilityState={{ selected: mode === key }}><Text style={[s.modeText, mode === key && s.modeTextActive]}>{label}</Text></Pressable>)}</View>
          <Text style={s.hint}>{mode === 'capture' ? 'Voice ideas go straight to this book’s Notes. No AI credits. Set up while parked; keep your attention on the road. Edits wait until later.' : mode === 'dictation' ? 'Spoken prose is appended to the selected chapter through normal autosave. Commands must begin with “Luna”.' : 'Try “Luna, add a note …”, “Luna, read aloud”, or “Luna, stop”. AI changes are always previewed and reviewed.'}</Text>
          {mode !== 'capture' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionRow}>{actions.map((item) => <Pressable key={item.id} onPress={() => { voice.stop(); setAction(item.id); }} style={[s.chip, action === item.id && s.chipActive]} accessibilityRole="button" accessibilityState={{ selected: action === item.id }}><Text style={s.chipText}>{item.label}</Text></Pressable>)}</ScrollView>}
          <View style={s.captureCard}>
            <Text style={s.label}>{inputLabel.toUpperCase()}</Text>
            <TextInput value={input} onChangeText={setInput} editable={!busy && restored} maxLength={1000} multiline placeholder={mode === 'capture' ? 'A scene, a thought, a detail…' : 'What would you like to explore?'} placeholderTextColor={c.textSecondary} style={s.input} accessibilityLabel={inputLabel} />
            {!!voice.interim && <Text style={s.interim} accessibilityLiveRegion="polite">{voice.interim}</Text>}
            <View style={s.captureActions}><Pressable onPress={() => { if (listening) voice.stop(); else { captureEpoch.current += 1; captureId.current = null; void voice.start(); } }} disabled={!voice.available || busy || !restored} style={[s.mic, listening && s.micActive, (!voice.available || busy) && s.disabled]} accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Start voice capture'} accessibilityState={{ disabled: !voice.available || busy, selected: listening }}><Text style={s.micText}>{voice.status === 'speaking' ? 'Speaking…' : listening ? '■  Stop listening' : '◉  Start listening'}</Text></Pressable>
              {(action === 'note' || mode === 'capture') && <Pressable disabled={!input.trim() || !restored || savingNote} onPress={saveTypedNote} style={s.saveButton} accessibilityRole="button"><Text style={s.link}>{savingNote ? 'Saving…' : 'Save note ↗'}</Text></Pressable>}</View>
            <Text style={s.small}>{!voice.available ? voice.unavailableReason : voice.status === 'starting' ? 'Starting voice… checking permission and microphone availability.' : listening ? `Listening · ${voice.onDevice ? 'on-device recognition' : 'system recognition; may use your platform’s speech service'}` : voice.status === 'speaking' ? 'Microphone paused during spoken response.' : 'Microphone off. Nothing starts until you tap Listen.'}</Text>
          </View>
          {mode !== 'capture' && action !== 'note' && <View style={s.allowance}>
            <Text style={s.label}>{provider === 'device' ? 'PHONE AI · NO BOOKEZ CREDITS' : `${cost} CREDITS PER PREVIEW · APPLYING IS FREE`}</Text>
            <Text style={s.small}>{usage ? `${Math.max(0, usage.monthlyCredits - usage.usedCredits)} / ${usage.monthlyCredits} credits remain · ${aiUsageRefillLabel()}. Final 30% protected for project tools.` : 'Actual cloud allowance is checked before generation. Opening Luna and capturing notes are free.'}</Text>
            {!canGenerate && <Text style={s.hint}>{!statusChecked ? 'Checking available AI…' : provider === 'device' ? 'Phone AI requires a supported device and current Bookez native build.' : 'Cloud previews are locked until the retry-safe server update is approved and deployed. Capture and Notes still work.'}</Text>}
            {canGenerate && !pending && <Pressable disabled={busy || Boolean(preview) || !restored} onPress={() => void generate()} style={[s.primary, (busy || preview) && s.disabled]} accessibilityRole="button"><Text style={s.primaryText}>{busy ? 'Preparing preview…' : `Preview ${actions.find((item) => item.id === action)?.label.toLowerCase()} · ${provider === 'device' ? 'free' : `${cost} credits`}`}</Text><Text style={s.primaryText}>→</Text></Pressable>}
          </View>}
          {busy && <View style={s.processing}><ActivityIndicator color={c.accent} /><Text style={[s.hint, s.flex]}>Luna is working. Minimize to keep writing.</Text><Pressable onPress={() => abort.current?.abort()} style={s.saveButton} accessibilityRole="button"><Text style={s.link}>Stop</Text></Pressable></View>}
          {!busy && pending && <View style={s.allowance}><Text style={s.hint}>This request is kept for recovery. Retry retrieves the same paid result where available; it does not authorize a second request.</Text><Pressable onPress={() => void generate(pending)} style={s.primary} accessibilityRole="button"><Text style={s.primaryText}>Recover / retry original request</Text></Pressable><Pressable onPress={() => { setPending(null); latest.current.pending = null; void persist().catch(() => undefined); }} style={s.saveButton} accessibilityRole="button"><Text style={s.link}>Dismiss request (no refund implied)</Text></Pressable></View>}
          {preview && <View style={s.preview}><Text style={s.label}>UNAPPLIED PREVIEW · {preview.partTitle.toUpperCase()}</Text><TextInput multiline value={previewText(preview)} onChangeText={(value) => {
            const after = preview.kind === 'append' || preview.kind === 'dictation' || preview.kind === 'character' ? `${preview.before}${preview.before ? preview.before.endsWith('\n\n') ? '' : preview.before.endsWith('\n') ? '\n' : '\n\n' : ''}${value}` : value;
            setPreview({ ...preview, after });
          }} maxLength={24_000} style={s.previewInput} accessibilityLabel="Review and edit Luna preview" />
            <Text style={s.small}>Your manuscript is untouched. Newer writing is never overwritten. Check this while parked.</Text>
            <Pressable disabled={!usablePreview} onPress={() => apply(preview)} style={[s.primary, !usablePreview && s.disabled]} accessibilityRole="button"><Text style={s.primaryText}>{preview.kind === 'character' ? 'Add to character plan' : preview.kind === 'outline' ? 'Save chapter outline' : preview.kind === 'rewrite' ? 'Apply reviewed rewrite' : 'Add reviewed writing'}</Text><Text style={s.primaryText}>→</Text></Pressable>
            <Pressable onPress={() => { setPreview(null); latest.current.preview = null; void persist().catch(() => undefined); notify('Preview discarded. Your book is unchanged.'); }} style={s.saveButton} accessibilityRole="button"><Text style={s.link}>Discard preview</Text></Pressable>
          </View>}
          {!!undo && <Pressable onPress={() => apply(undo, true)} style={s.saveButton} accessibilityRole="button"><Text style={s.link}>↶ Undo last cockpit change</Text></Pressable>}
          <Text style={s.status} accessibilityLiveRegion="polite">{message}</Text>
          {!!(error || voice.error) && <Text style={s.error} accessibilityRole="alert">{error || voice.error}</Text>}
          <Pressable onPress={() => setAdvanced((value) => !value)} style={s.disclosure} accessibilityRole="button" accessibilityState={{ expanded: advanced }}><Text style={s.link}>Session settings</Text><Text style={s.link}>{advanced ? '−' : '+'}</Text></Pressable>
          {advanced && <View style={s.settings}>
            <View style={s.setting}><View style={s.flex}><Text style={s.settingTitle}>Keep listening</Text><Text style={s.small}>Opt-in, foreground only. Closing or backgrounding stops it.</Text></View><Switch disabled={!voice.available} value={handsFree} onValueChange={(value) => { voice.stop(); setHandsFree(value); }} accessibilityLabel="Keep listening hands-free" trackColor={{ true: c.accent }} /></View>
            <View style={s.setting}><Text style={[s.settingTitle, s.flex]}>Spoken confirmations</Text><Switch value={spoken} onValueChange={setSpoken} accessibilityLabel="Spoken confirmations" trackColor={{ true: c.accent }} /></View>
            <Text style={s.label}>AI PROVIDER</Text><View style={s.actionRow}>{(['device', 'cloud'] as const).map((item) => <Pressable key={item} disabled={busy || Boolean(pending)} onPress={() => setProvider(item)} style={[s.chip, provider === item && s.chipActive]} accessibilityRole="button" accessibilityState={{ selected: provider === item }}><Text style={s.chipText}>{item === 'device' ? 'Phone AI · free' : 'Bookez credits'}</Text></Pressable>)}</View>
            <Text style={s.label}>TARGET CHAPTER · DOES NOT MOVE YOUR EDITOR</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionRow}>{selectedParts.map((part) => <Pressable key={part.key} disabled={busy} onPress={() => { voice.stop(); captureEpoch.current += 1; captureId.current = null; setPartKey(part.key); }} style={[s.chip, partKey === part.key && s.chipActive]} accessibilityRole="button"><Text style={s.chipText}>{part.title}</Text></Pressable>)}</ScrollView>
          </View>}
          <Pressable onPress={() => setHistoryOpen((value) => !value)} style={s.disclosure} accessibilityRole="button" accessibilityState={{ expanded: historyOpen }}><Text style={s.link}>Conversation · {history.length}</Text><Text style={s.link}>{historyOpen ? '−' : '+'}</Text></Pressable>
          {historyOpen && <View style={s.history}>{history.map((item) => <View key={item.id} style={s.historyItem}><Text style={s.label}>{item.role === 'user' ? 'YOU' : 'LUNA'}</Text><Text style={s.hint}>{item.text}</Text></View>)}</View>}
          <Pressable onPress={() => setExpanded((value) => !value)} style={s.disclosure} accessibilityRole="button" accessibilityState={{ expanded }}><Text style={s.link}>A little Luna light</Text><Text style={s.link}>{expanded ? '−' : '+'}</Text></Pressable>
          {expanded && <LunaLight active={visible && foreground && (busy || listening)} expanded />}
          <View style={s.footer}><Pressable onPress={minimize} style={s.saveButton} accessibilityRole="button"><Text style={s.link}>Minimize</Text></Pressable><Pressable onPress={exit} style={s.saveButton} accessibilityRole="button"><Text style={s.link}>Exit mode</Text></Pressable></View>
          <Text style={s.small}>No background recording. Voice needs a Bookez native build and microphone permission; offline recognition depends on your device and language. This is not a substitute for safe driving.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}
function previewText(preview: CockpitPreview) {
  return preview.kind === 'append' || preview.kind === 'dictation' || preview.kind === 'character' ? preview.after.slice(preview.before.length).replace(/^\n\n?/, '') : preview.after;
}
export default memo(AIWriteCockpit);

const s = StyleSheet.create({
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(19,36,61,0.48)' },
  sheet: { maxHeight: '94%', minHeight: '60%', backgroundColor: c.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: c.cardBorder, paddingBottom: 20 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 4, backgroundColor: c.cardBorder, marginTop: 10 },
  header: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: c.border },
  headerCopy: { flex: 1 }, eyebrow: { color: c.secondaryAccent, fontWeight: '800', letterSpacing: 1.8, fontSize: 9 },
  title: { color: c.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 20, marginTop: 4 },
  iconButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.manuscript }, close: { color: c.accent, fontSize: 28 },
  content: { padding: 20, gap: 14, paddingBottom: 30 }, book: { color: c.accent, fontSize: 12, fontWeight: '700' }, muted: { color: c.textSecondary, fontWeight: '400' },
  modes: { flexDirection: 'row', padding: 4, borderRadius: 24, backgroundColor: c.manuscript, borderWidth: 1, borderColor: c.border },
  mode: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 }, modeActive: { backgroundColor: c.accent }, modeText: { fontSize: 12, fontWeight: '700', color: c.accent }, modeTextActive: { color: c.textOnAccent },
  hint: { color: c.textSecondary, fontSize: 12, lineHeight: 19 }, small: { color: c.textSecondary, fontSize: 10, lineHeight: 16 },
  actionRow: { flexDirection: 'row', gap: 7, paddingVertical: 4 }, chip: { minHeight: 44, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }, chipActive: { borderColor: c.cardBorder, backgroundColor: c.card }, chipText: { fontSize: 11, color: c.accent, fontWeight: '700' },
  captureCard: { borderRadius: 20, padding: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, gap: 10 },
  label: { fontSize: 9, letterSpacing: 0.9, fontWeight: '800', color: c.accent }, input: { minHeight: 85, maxHeight: 180, color: c.textPrimary, fontSize: 16, lineHeight: 24, textAlignVertical: 'top', paddingVertical: 8 }, interim: { color: c.accent, fontSize: 14, fontStyle: 'italic' },
  captureActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, mic: { minHeight: 48, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 24, backgroundColor: c.accent }, micActive: { backgroundColor: c.accentStrong }, micText: { color: c.textOnAccent, fontSize: 12, fontWeight: '700' }, saveButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }, link: { color: c.accent, fontWeight: '700', fontSize: 12 }, disabled: { opacity: 0.45 },
  allowance: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.manuscript, gap: 9 }, primary: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 16, paddingHorizontal: 14, backgroundColor: c.accent }, primaryText: { fontSize: 12, fontWeight: '700', color: c.textOnAccent },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 10 }, flex: { flex: 1 }, preview: { padding: 16, gap: 10, backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 20 }, previewInput: { minHeight: 150, maxHeight: 300, color: c.textPrimary, lineHeight: 24, fontSize: 15, textAlignVertical: 'top' }, status: { color: c.success, fontSize: 12, lineHeight: 18 }, error: { color: c.destructive, fontSize: 12, lineHeight: 19 },
  disclosure: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: c.border }, settings: { padding: 12, gap: 12, borderRadius: 16, backgroundColor: c.manuscript }, setting: { flexDirection: 'row', alignItems: 'center', gap: 12 }, settingTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '700' }, history: { gap: 10 }, historyItem: { backgroundColor: c.manuscript, padding: 12, borderRadius: 14, gap: 5 }, footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.border },
  orbit: { width: 112, height: 112, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' }, orbitSmall: { width: 42, height: 42 }, orbitRing: { position: 'absolute', width: '92%', height: '92%', borderRadius: 80, borderWidth: 1, borderColor: c.secondaryAccent }, orbitCore: { width: '64%', height: '64%', borderRadius: 80, justifyContent: 'center', alignItems: 'center' }, orbitStar: { color: c.textOnAccent, fontSize: 22 }, node: { position: 'absolute', width: 5, height: 5, borderRadius: 5, backgroundColor: c.secondaryAccent },
});
