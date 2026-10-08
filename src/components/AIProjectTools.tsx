import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AI_PROVIDER_STORAGE_KEY, AIWritingService, type AIProviderPreference, type AIResolvedProvider, type AIWritingContext } from '../lib/ai-writing';
import { AI_USAGE_POLICY, aiProjectCreditCeiling, readAIUsage, recordAIUsage } from '../lib/ai-usage';
import { AI_PROJECT_DEVICE_EDIT_CHARS, AI_PROJECT_DEVICE_SCAN_CHARS, AI_PROJECT_EDIT_CHARS, AI_PROJECT_SCAN_CHARS, chunkWriting, projectAddCredits, projectAIContext, projectFingerprint, type AIProjectChange, type AIProjectMemory, type AIProjectPart } from '../lib/ai-project';
import { bookezSecureStorage } from '../lib/secure-storage';
import { bookezColors } from '../theme/bookez';

type Mode = 'scan' | 'edit' | 'add';
type Unit = { part: AIProjectPart; text: string; index: number };
type PartialRun = { signature: string; results: string[] };

type Props = {
  projectKey: string;
  parts: AIProjectPart[];
  context: AIWritingContext;
  activePartKey: string;
  memory?: AIProjectMemory;
  canUndo: boolean;
  onSaveMemory: (memory: AIProjectMemory) => void;
  onApplyChanges: (changes: AIProjectChange[], fingerprint: string) => boolean;
  onUndo: () => void;
};

const addSeparator = (before: string, addition: string) => before.trim() ? `${before.trimEnd()}\n\n${addition.trim()}` : addition.trim();

export default function AIProjectTools({ projectKey, parts, context, activePartKey, memory, canUndo, onSaveMemory, onApplyChanges, onUndo }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('scan');
  const [direction, setDirection] = useState('');
  const [addScope, setAddScope] = useState<'current' | 'drafted'>('current');
  const [usedCredits, setUsedCredits] = useState(0);
  const [providerPreference, setProviderPreference] = useState<AIProviderPreference>('auto');
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);
  const [phoneReason, setPhoneReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ fingerprint: string; changes: AIProjectChange[] } | null>(null);
  const [expandedPreviewKey, setExpandedPreviewKey] = useState<string | null>(null);
  const partial = useRef<PartialRun>({ signature: '', results: [] });
  const fingerprint = projectFingerprint(parts);
  const scanCurrent = memory?.fingerprint === fingerprint;
  const drafted = parts.filter((part) => part.text.trim());
  const addTargets = addScope === 'current' ? parts.filter((part) => part.key === activePartKey) : drafted;
  const displayedProvider: AIResolvedProvider = providerPreference === 'cloud' ? 'cloud' : providerPreference === 'device' ? 'device' : phoneAvailable ? 'device' : 'cloud';
  const unitsFor = (provider: AIResolvedProvider): Unit[] => mode === 'scan'
    ? parts.flatMap((part) => chunkWriting(part.text, provider === 'device' ? AI_PROJECT_DEVICE_SCAN_CHARS : AI_PROJECT_SCAN_CHARS).map((text, index) => ({ part, text, index })))
    : mode === 'edit'
      ? drafted.flatMap((part) => chunkWriting(part.text, provider === 'device' ? AI_PROJECT_DEVICE_EDIT_CHARS : AI_PROJECT_EDIT_CHARS).map((text, index) => ({ part, text, index })))
      : addTargets.map((part) => ({ part, text: part.text.slice(provider === 'device' ? -650 : -1_000), index: 0 }));
  const units = useMemo(() => unitsFor(displayedProvider), [fingerprint, mode, addScope, activePartKey, displayedProvider]);
  const unitCredits = (unit: Unit, provider: AIResolvedProvider) => provider === 'device' ? 0 : mode === 'scan'
    ? AI_USAGE_POLICY.projectWeights.scanChunk
    : mode === 'edit'
      ? AI_USAGE_POLICY.projectWeights.editChunk
      : projectAddCredits(unit.part.text, AI_USAGE_POLICY.projectWeights.addPart, AI_USAGE_POLICY.projectWeights.editChunk);
  const estimate = units.reduce((total, unit) => total + unitCredits(unit, displayedProvider), 0);
  const projectCreditsLeft = Math.max(0, aiProjectCreditCeiling() - usedCredits);

  useEffect(() => {
    setOpen(false);
    setPreview(null);
    setError('');
    partial.current = { signature: '', results: [] };
  }, [projectKey]);

  const show = () => {
    void readAIUsage().then(setUsedCredits);
    void bookezSecureStorage.getItem(AI_PROVIDER_STORAGE_KEY).then((saved) => {
      if (saved === 'auto' || saved === 'device' || saved === 'cloud') setProviderPreference(saved);
    });
    void AIWritingService.isAvailable().then(async (available) => {
      setPhoneAvailable(available);
      setPhoneReason(available ? '' : await AIWritingService.getAvailabilityReason());
    });
    setOpen(true);
  };
  const chooseProvider = (next: AIProviderPreference) => {
    setProviderPreference(next);
    setError('');
    setPreview(null);
    void bookezSecureStorage.setItem(AI_PROVIDER_STORAGE_KEY, next);
  };
  const selectMode = (next: Mode) => { setMode(next); setPreview(null); setError(''); setProgress(''); };
  const run = async () => {
    if (busy) return;
    if (!units.length) { setError(mode === 'add' ? 'Choose a part to add to, or draft a part first.' : 'There is no manuscript text to process yet.'); return; }
    if (mode !== 'scan' && !direction.trim()) { setError('Describe what you want Bookez to change or write.'); return; }
    if (mode !== 'scan' && !scanCurrent && !(mode === 'add' && drafted.length === 0)) { setError('Scan this project first so Bookez has current book context.'); return; }
    if (mode === 'scan' && scanCurrent) { setError('The saved scan already matches this manuscript.'); return; }
    let provider: AIResolvedProvider;
    try { provider = await AIWritingService.resolveProvider(providerPreference); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Phone AI is unavailable.'); return; }
    const runUnits = unitsFor(provider);
    const signature = `${projectKey}:${fingerprint}:${mode}:${addScope}:${direction.trim()}:${provider}`;
    if (partial.current.signature !== signature) partial.current = { signature, results: [] };
    const pendingCredits = runUnits.reduce((total, unit, index) => total + (partial.current.results[index] ? 0 : unitCredits(unit, provider)), 0);
    const used = await readAIUsage();
    setUsedCredits(used);
    if (provider === 'cloud' && used + pendingCredits > aiProjectCreditCeiling()) {
      setError(`This ${mode} needs ${pendingCredits} credits; only ${Math.max(0, aiProjectCreditCeiling() - used)} project credits remain. Bookez keeps 30% of monthly credits available for normal writing tools.`);
      return;
    }
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      for (let index = 0; index < runUnits.length; index += 1) {
        if (partial.current.results[index]) continue;
        const unit = runUnits[index];
        setProgress(`${mode === 'scan' ? 'Scanning' : mode === 'edit' ? 'Editing' : 'Drafting'} ${index + 1} of ${runUnits.length} · ${unit.part.title} · ${provider === 'device' ? 'phone AI' : 'cloud AI'}`);
        const result = await AIWritingService.generate({
          operation: mode === 'scan' ? 'project-scan' : mode === 'edit' ? 'project-edit' : 'project-add',
          text: unit.text,
          instruction: mode === 'scan' ? 'Summarize this part faithfully for reuse as compact project memory.' : direction.trim(),
          context: projectAIContext(context, unit.part, mode === 'scan' ? undefined : memory, provider === 'device'),
        }, provider);
        const output = mode === 'scan' ? result.feedback?.trim() : result.options?.[0]?.trim();
        if (!output) throw new Error('Bookez returned an empty result. You can retry the unfinished parts.');
        if (provider === 'cloud') setUsedCredits(await recordAIUsage(unitCredits(unit, provider), true));
        partial.current.results[index] = output;
      }
      if (mode === 'scan') {
        const summaries = parts.flatMap((part) => {
          const itemSummaries = runUnits.flatMap((unit, index) => unit.part.key === part.key ? [partial.current.results[index]] : []);
          return itemSummaries.length ? [{ key: part.key, title: part.title, summary: itemSummaries.map((item, index) => `${index + 1}. ${item.slice(0, 500)}`).join('\n').slice(0, 40_000) }] : [];
        });
        onSaveMemory({ fingerprint, summaries, createdAt: Date.now() });
        setProgress(`Scanned ${summaries.length} written part${summaries.length === 1 ? '' : 's'}. This memory is reused until the manuscript changes.`);
      } else {
        const changes = (mode === 'edit' ? drafted : addTargets).flatMap((part) => {
          const generated = runUnits.flatMap((unit, index) => unit.part.key === part.key ? [partial.current.results[index]] : []);
          if (!generated.length) return [];
          const after = mode === 'edit' ? generated.reduce((full, output, chunkIndex) => {
            if (chunkIndex === 0) return output;
            const previousSource = runUnits.filter((unit) => unit.part.key === part.key)[chunkIndex - 1]?.text ?? '';
            const separator = previousSource.endsWith('\n\n') ? '\n\n' : /\s$/.test(previousSource) ? ' ' : '';
            return `${full}${separator}${output}`;
          }, '') : addSeparator(part.text, generated[0]);
          return after !== part.text ? [{ key: part.key, title: part.title, before: part.text, after }] : [];
        });
        if (!changes.length) throw new Error('The AI returned no changes to preview. Try a more specific direction.');
        setPreview({ fingerprint, changes });
        setProgress(`Preview ready for ${changes.length} part${changes.length === 1 ? '' : 's'}. Nothing has been applied yet.`);
      }
      partial.current = { signature: '', results: [] };
    } catch (caught) {
      setError(`${caught instanceof Error ? caught.message : 'Bookez could not finish this request.'} ${provider === 'cloud' ? 'Completed cloud calls were counted; ' : 'Phone AI used no Bookez credits; '}retry continues from the unfinished part.`);
    } finally { setBusy(false); }
  };

  const apply = () => {
    if (!preview || busy) return;
    Alert.alert(`Apply AI ${mode === 'edit' ? 'edits' : 'additions'}?`, `This will change ${preview.changes.length} manuscript part${preview.changes.length === 1 ? '' : 's'}. You can undo the whole batch afterward.`, [
      { text: 'Keep preview', style: 'cancel' },
      { text: 'Apply', onPress: () => {
        if (onApplyChanges(preview.changes, preview.fingerprint)) {
          setPreview(null);
          setProgress('Applied to your manuscript. Use Undo project AI change if needed.');
        } else setError('The manuscript changed since this preview. Generate a fresh preview.');
      } },
    ]);
  };

  return <>
    <Pressable onPress={show} style={s.launcher} accessibilityRole="button" accessibilityLabel="Open whole-project AI tools"><Text style={s.launcherTitle}>✦ Project AI</Text><Text style={s.launcherHint}>Scan · Edit whole book · AI Add</Text><Text style={s.arrow}>›</Text></Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={s.sheet}>
        <View style={s.header}><View style={s.headerCopy}><Text style={s.kicker}>BOOKEZ WRITING ASSISTANT</Text><Text style={s.title}>Project AI</Text><Text style={s.subtitle}>Work across the manuscript, one manageable part at a time.</Text></View><Pressable onPress={() => { if (!busy) setOpen(false); }} disabled={busy} accessibilityLabel="Close project AI"><Text style={s.close}>✕</Text></Pressable></View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.providerCard}><Text style={s.costTitle}>AI PROVIDER · SAVED FOR ALL WRITING TOOLS</Text><View style={s.providerChoices}>{([['auto', 'Phone first'], ['device', 'Phone only'], ['cloud', 'Bookez credits']] as const).map(([value, label]) => <Pressable key={value} onPress={() => chooseProvider(value)} disabled={busy} style={[s.providerChoice, providerPreference === value && s.providerChoiceActive]} accessibilityRole="button" accessibilityState={{ selected: providerPreference === value }}><Text style={[s.providerChoiceText, providerPreference === value && s.providerChoiceTextActive]}>{label}</Text></Pressable>)}</View><Text style={s.providerHint}>{providerPreference === 'auto' ? phoneAvailable === null ? 'Checking phone AI. If unavailable, Bookez cloud uses credits.' : phoneAvailable ? 'Phone AI runs first and uses no Bookez credits.' : 'Phone AI is unavailable here, so this uses Bookez cloud credits.' : providerPreference === 'device' ? phoneAvailable ? 'Phone AI uses 0 Bookez credits. Device model limits and quotas still apply.' : phoneReason || 'Phone AI is not available on this device.' : 'Bookez cloud uses credits, even if this phone has on-device AI.'}</Text></View>
          <View style={s.tabs}>{(['scan', 'edit', 'add'] as Mode[]).map((item) => <Pressable key={item} onPress={() => selectMode(item)} disabled={busy} style={[s.tab, mode === item && s.tabActive]}><Text style={[s.tabText, mode === item && s.tabTextActive]}>{item === 'scan' ? 'Scan project' : item === 'edit' ? 'Edit whole book' : 'AI Add'}</Text></Pressable>)}</View>
          <Text style={s.body}>{mode === 'scan' ? 'Read every written part and save a compact, reusable book memory. Scan again after the manuscript changes.' : mode === 'edit' ? 'Describe a change in natural language. Bookez will revise every written part, then show a preview before replacing anything.' : 'Describe new prose to write. Add it to the current part or to every drafted part, after reviewing the preview.'}</Text>
          {mode === 'scan' ? <Text style={s.memory}>{scanCurrent ? `✓ Current scan · ${memory?.summaries.length ?? 0} written parts` : 'No current scan. Project edits and additions need a scan first.'}</Text> : <>
            {!scanCurrent && drafted.length > 0 && <Text style={s.warning}>Scan this project first. Its saved memory is missing or out of date.</Text>}
            <Text style={s.label}>YOUR DIRECTION</Text>
            <TextInput value={direction} onChangeText={(value) => { setDirection(value); setPreview(null); }} editable={!busy} multiline maxLength={1_000} placeholder={mode === 'edit' ? 'Example: Make the dialogue more natural throughout, without changing events.' : 'Example: Add a short transition that leads into the next scene.'} placeholderTextColor={bookezColors.textSecondary} style={s.input} accessibilityLabel="Project AI direction" />
            {mode === 'add' && <View style={s.scopeRow}><Pressable onPress={() => setAddScope('current')} disabled={busy} style={[s.scope, addScope === 'current' && s.scopeActive]}><Text style={s.scopeText}>Current part</Text></Pressable><Pressable onPress={() => setAddScope('drafted')} disabled={busy} style={[s.scope, addScope === 'drafted' && s.scopeActive]}><Text style={s.scopeText}>All drafted parts</Text></Pressable></View>}
          </>}
          <View style={s.costCard}><Text style={s.costTitle}>{displayedProvider === 'device' ? 'ON-DEVICE USAGE' : 'ESTIMATED CLOUD USAGE'}</Text><Text style={s.costValue}>{displayedProvider === 'device' ? '0 Bookez credits' : `${estimate} credits`} · {units.length} {mode === 'add' ? 'part' : 'chunk'}{units.length === 1 ? '' : 's'}</Text><Text style={s.costNote}>{displayedProvider === 'device' ? 'Your phone processes these requests locally. Bookez does not deduct AI credits. The phone model has context and system quota limits, so very long books may take more chunks or pause until the device is ready.' : `Scan ${AI_USAGE_POLICY.projectWeights.scanChunk}/chunk · Edit ${AI_USAGE_POLICY.projectWeights.editChunk}/chunk · Add at least ${AI_USAGE_POLICY.projectWeights.addPart}/part, never less than editing that part. ${projectCreditsLeft} project credits remain; 30% of the monthly pool is reserved for other writing tools. Completed cloud calls count toward this local estimate, which is not provider billing or a server-enforced limit. Project writing is sent to Bookez’s authenticated cloud AI.`}</Text></View>
          <Pressable onPress={() => void run()} disabled={busy || (mode === 'scan' && scanCurrent)} style={[s.run, (busy || (mode === 'scan' && scanCurrent)) && s.disabled]}><Text style={s.runText}>{busy ? 'Working…' : mode === 'scan' ? scanCurrent ? 'Scan is current' : 'Scan project' : mode === 'edit' ? 'Preview whole-book edits' : 'Preview AI additions'}</Text></Pressable>
          {busy && <ActivityIndicator style={s.spinner} color={bookezColors.accentStrong} />}
          {!!progress && <Text style={s.progress}>{progress}</Text>}
          {!!error && <Text style={s.error}>{error}</Text>}
          {preview && <View style={s.preview}><Text style={s.previewTitle}>REVIEW BEFORE APPLYING</Text>{preview.changes.map((change) => <View key={change.key} style={s.previewPart}><Pressable onPress={() => setExpandedPreviewKey(expandedPreviewKey === change.key ? null : change.key)} accessibilityRole="button" accessibilityLabel={`Review ${change.title} AI changes`}><Text style={s.partTitle}>{change.title} {expandedPreviewKey === change.key ? '⌃' : '⌄'}</Text><Text style={s.partMeta}>{change.before.trim() ? change.before.trim().split(/\s+/).length : 0} → {change.after.trim().split(/\s+/).length} words · Tap to {expandedPreviewKey === change.key ? 'collapse' : 'review full text'}</Text><Text style={s.previewText} numberOfLines={expandedPreviewKey === change.key ? undefined : 6}>{change.after}</Text></Pressable>{expandedPreviewKey === change.key && <View style={s.original}><Text style={s.originalLabel}>ORIGINAL</Text><Text style={s.previewText}>{change.before || '(empty part)'}</Text></View>}</View>)}<Pressable onPress={apply} style={s.run}><Text style={s.runText}>Apply to {preview.changes.length} part{preview.changes.length === 1 ? '' : 's'}</Text></Pressable></View>}
          {canUndo && <Pressable onPress={onUndo} disabled={busy} style={s.undo}><Text style={s.undoText}>↶ Undo last project AI change</Text></Pressable>}
        </ScrollView>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  launcher: { marginTop: 8, minHeight: 48, paddingHorizontal: 13, borderRadius: 13, backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  launcherTitle: { color: bookezColors.textPrimary, fontSize: 12, fontWeight: '800' }, launcherHint: { color: bookezColors.textSecondary, fontSize: 9, marginLeft: 10, flex: 1 }, arrow: { color: bookezColors.accentStrong, fontSize: 20 },
  sheet: { flex: 1, backgroundColor: bookezColors.surface, paddingTop: 44 }, header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', borderBottomColor: bookezColors.border, borderBottomWidth: 1 }, headerCopy: { flex: 1 }, kicker: { color: bookezColors.secondaryAccent, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, title: { color: bookezColors.textPrimary, fontSize: 25, fontWeight: '800', marginTop: 3 }, subtitle: { color: bookezColors.textSecondary, fontSize: 11, marginTop: 4 }, close: { color: bookezColors.textPrimary, fontSize: 20, padding: 8 },
  providerCard: { padding: 12, borderRadius: 12, marginBottom: 15, backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border, borderWidth: 1 },
  providerChoices: { flexDirection: 'row', gap: 6, marginTop: 9 },
  providerChoice: { flex: 1, minHeight: 35, paddingHorizontal: 4, borderRadius: 9, backgroundColor: bookezColors.surface, justifyContent: 'center', alignItems: 'center' },
  providerChoiceActive: { backgroundColor: bookezColors.accentStrong },
  providerChoiceText: { color: bookezColors.textPrimary, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  providerChoiceTextActive: { color: bookezColors.textOnAccent },
  providerHint: { color: bookezColors.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 8 },
  content: { padding: 20, paddingBottom: 50 }, tabs: { flexDirection: 'row', gap: 6 }, tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 5, borderRadius: 10, borderColor: bookezColors.border, borderWidth: 1, alignItems: 'center' }, tabActive: { backgroundColor: bookezColors.accentStrong }, tabText: { color: bookezColors.textPrimary, fontSize: 10, fontWeight: '700' }, tabTextActive: { color: bookezColors.textOnAccent }, body: { color: bookezColors.textPrimary, lineHeight: 18, fontSize: 12, marginTop: 16 }, memory: { color: bookezColors.accentStrong, fontSize: 11, marginTop: 12 }, warning: { color: '#8A3B31', fontSize: 11, marginTop: 12 }, label: { color: bookezColors.textPrimary, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 18 }, input: { minHeight: 105, borderColor: bookezColors.border, borderWidth: 1, borderRadius: 11, color: bookezColors.textPrimary, backgroundColor: bookezColors.surfaceRaised, fontSize: 13, lineHeight: 19, padding: 12, marginTop: 7, textAlignVertical: 'top' }, scopeRow: { flexDirection: 'row', gap: 8, marginTop: 10 }, scope: { borderColor: bookezColors.border, borderWidth: 1, borderRadius: 10, padding: 10 }, scopeActive: { backgroundColor: bookezColors.accentSoft }, scopeText: { color: bookezColors.textPrimary, fontSize: 10, fontWeight: '700' }, costCard: { marginTop: 18, borderRadius: 12, padding: 13, backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border, borderWidth: 1 }, costTitle: { color: bookezColors.secondaryAccent, fontSize: 9, fontWeight: '800' }, costValue: { color: bookezColors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 4 }, costNote: { color: bookezColors.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 5 }, run: { backgroundColor: bookezColors.accentStrong, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 15 }, runText: { color: bookezColors.textOnAccent, fontSize: 12, fontWeight: '800' }, disabled: { opacity: .5 }, spinner: { marginTop: 14 }, progress: { color: bookezColors.textPrimary, fontSize: 11, marginTop: 12 }, error: { color: '#8A3B31', fontSize: 11, lineHeight: 16, marginTop: 12 }, preview: { marginTop: 20 }, previewTitle: { color: bookezColors.textPrimary, fontSize: 11, fontWeight: '800' }, previewPart: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 9 }, partTitle: { color: bookezColors.textPrimary, fontWeight: '800', fontSize: 12 }, partMeta: { color: bookezColors.textSecondary, fontSize: 10, marginTop: 2 }, previewText: { color: bookezColors.textPrimary, fontSize: 11, lineHeight: 16, marginTop: 8 }, original: { borderTopColor: bookezColors.border, borderTopWidth: 1, marginTop: 12, paddingTop: 10 }, originalLabel: { color: bookezColors.textSecondary, fontSize: 9, fontWeight: '800' }, undo: { padding: 12, marginTop: 18, alignItems: 'center' }, undoText: { color: bookezColors.accentStrong, fontSize: 11, fontWeight: '700' },
});
