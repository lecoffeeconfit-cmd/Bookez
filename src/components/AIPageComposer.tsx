import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AIWritingService, prepareAIWritingContext, type AIWritingContext, type AIWritingContextMode, type AIWritingOperation } from '../lib/ai-writing';
import { aiUsageRefillLabel, aiWritingCredits, saveCloudAIUsage } from '../lib/ai-usage';
import { AI_MAX_DRAFT_PAGES, AI_REVISION_CHUNK_CHARS, joinAIRevisions, runAIPageBatch, type AIInsertPlacement, type AIPreviewTarget } from '../lib/ai-drafting';
import { chunkWriting } from '../lib/ai-project';
import { bookezColors as c, bookezFonts } from '../theme/bookez';
import DictationInput, { nativeDictationAvailable } from './DictationInput';

type Props = {
  operation: AIWritingOperation;
  partKey: string;
  manuscript: string;
  source: string;
  sourceStart: number;
  cursor: number;
  context: AIWritingContext;
  contextMode: Exclude<AIWritingContextMode, 'auto'>;
  initialInstruction?: string;
  onReplace: (original: string, replacement: string, targetText?: string, target?: AIPreviewTarget) => boolean;
  onInsert: (text: string, placement: AIInsertPlacement, target: { partKey: string; sourceText: string; cursor: number }) => boolean;
  onApplied: () => void;
  onBusyChange: (busy: boolean) => void;
  onUsageChange: (used: number, monthly: number) => void;
  onPreviewChange: (hasPreview: boolean) => void;
};

export default function AIPageComposer({ operation, partKey, manuscript, source, sourceStart, cursor, context, contextMode, initialInstruction = '', onReplace, onInsert, onApplied, onBusyChange, onUsageChange, onPreviewChange }: Props) {
  const drafting = operation === 'draft-page';
  const [pageCount, setPageCount] = useState(1);
  const [placement, setPlacement] = useState<AIInsertPlacement>('cursor');
  const [direction, setDirection] = useState(initialInstruction);
  const [pages, setPages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [revision, setRevision] = useState('');
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [listening, setListening] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const run = useRef({ signature: '', pages: [] as string[] });
  const running = useRef(false);
  const stop = useRef(false);
  const live = useRef(true);
  const insertion = useRef({ partKey, sourceText: manuscript, cursor });
  const replacement = useRef<AIPreviewTarget>({ partKey, sourceText: manuscript, start: sourceStart });
  const sources = drafting ? [] : chunkWriting(source, AI_REVISION_CHUNK_CHARS);
  const total = drafting ? pageCount : sources.length;
  const unitCredits = aiWritingCredits(operation, contextMode);
  const remaining = Math.max(0, total - pages.length);
  const remainingCredits = remaining * unitCredits;
  const hasPreview = pages.length > 0;
  const locked = busy || hasPreview;
  const words = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; stop.current = true; };
  }, []);
  useEffect(() => { onPreviewChange(hasPreview); }, [hasPreview, onPreviewChange]);

  const syncUsage = async (usage: { month: string; usedCredits: number; monthlyCredits: number }) => {
    await saveCloudAIUsage(usage.month, usage.usedCredits).catch(() => usage.usedCredits);
    if (live.current) onUsageChange(usage.usedCredits, usage.monthlyCredits);
  };

  const generate = async () => {
    if (running.current) return;
    if (!drafting && !source.trim()) { setError('Write a little in this part first, then preview a whole-page revision.'); return; }
    if (!total || total > 100) { setError('Choose a shorter manuscript section for this revision.'); return; }
    const signature = JSON.stringify({ operation, partKey, manuscript, source, sourceStart, cursor, placement, pageCount, direction, contextMode, context });
    if (hasPreview && run.current.signature !== signature) {
      setError('Your manuscript or context changed. Your paid preview is still here; start a new preview to work with the updated draft.');
      return;
    }
    running.current = true; // Lock before checking credits, including rapid double taps.
    stop.current = false;
    setBusy(true); onBusyChange(true); setStopping(false); setError('');
    if (run.current.signature !== signature) {
      run.current = { signature, pages: [] };
      setPages([]); setRevision(''); setPreviewIndex(0);
      insertion.current = { partKey, sourceText: manuscript, cursor };
      replacement.current = { partKey, sourceText: manuscript, start: sourceStart };
    }
    try {
      setProgress('Checking your refillable allowance…');
      const usage = await AIWritingService.readCloudUsage();
      if (!live.current || stop.current) return;
      if (!usage) throw new Error('Bookez could not check your shared AI allowance. Check your connection and sign-in, then try again. No writing request was started.');
      await syncUsage(usage);
      if (!live.current || stop.current) return;
      const needed = (total - run.current.pages.length) * unitCredits;
      if (needed > Math.max(0, usage.monthlyCredits - usage.usedCredits)) {
        throw new Error(`This request needs ${needed} credits; ${Math.max(0, usage.monthlyCredits - usage.usedCredits)} remain. ${drafting ? 'Choose fewer pages' : 'Try Current paragraph'} or wait for your refill. Completed previews are kept.`);
      }
      const initialSource = placement === 'start' ? manuscript.slice(0, 1_200)
        : placement === 'end' ? manuscript.slice(-1_200) : manuscript.slice(0, Math.max(0, cursor)).slice(-1_200);
      const resultPages = await runAIPageBatch({
        count: total,
        completed: run.current.pages,
        shouldStop: () => stop.current || !live.current,
        generate: async (index, previous) => {
          if (live.current) setProgress(`${drafting ? 'Drafting page' : 'Revising segment'} ${index + 1} of ${total}…`);
          const placeHint = index > 0 ? 'Continue directly after the previous page, without repeating it or restarting the scene.'
            : placement === 'start' ? 'Write before the supplied source passage.' : 'Continue after the supplied source passage.';
          const instruction = [direction.slice(0, 700), drafting
            ? `Page ${index + 1} of ${total}. Write 250–350 words of continuous prose in this same manuscript part. ${placeHint} No page headings or hard page breaks.`
            : `Revise segment ${index + 1} of ${total} faithfully. Return the complete revised passage, not a summary. Preserve paragraph breaks and the section structure.`].filter(Boolean).join('\n').slice(0, 1_000);
          const response = await AIWritingService.generate({ operation,
            text: drafting ? index === 0 ? initialSource : previous.join('\n\n').slice(-1_200) : sources[index],
            instruction, protectReserve: false,
            context: prepareAIWritingContext(context, contextMode),
          }, 'cloud');
          // The server reserves credits atomically for EACH call, even across devices.
          if (response.usage) await syncUsage(response.usage);
          const prose = response.options?.[0]?.trim();
          if (!prose) throw new Error('No complete writing preview was returned. Retry the unfinished pages.');
          return prose;
        },
        onComplete: (completed) => {
          run.current.pages = completed;
          if (!live.current) return;
          setPages(completed);
          if (!drafting && completed.length === total) setRevision(joinAIRevisions(sources, completed));
        },
      });
      if (live.current) setProgress(resultPages.length === total ? 'Your preview is ready. Nothing has been added or replaced.' : `Stopped with ${resultPages.length} of ${total} ready. Continue here without redoing completed work.`);
    } catch (caught) {
      if (live.current) {
        setError(caught instanceof Error ? caught.message : 'Bookez could not finish this request.');
        setProgress(run.current.pages.length ? `${run.current.pages.length} of ${total} kept. Only completed cloud requests use credits; retry starts at the unfinished segment.` : 'Your manuscript is unchanged.');
        const usage = await AIWritingService.readCloudUsage();
        if (usage) await syncUsage(usage);
      }
    } finally {
      running.current = false;
      if (live.current) { setBusy(false); onBusyChange(false); setStopping(false); }
    }
  };

  const newRequest = () => {
    const clear = () => { run.current = { signature: '', pages: [] }; setPages([]); setRevision(''); setError(''); setProgress(''); };
    if (!hasPreview) { clear(); return; }
    Alert.alert('Start a new preview?', 'These pages have not been applied. Starting over discards this preview; a new generation uses credits again.', [
      { text: 'Keep preview', style: 'cancel' }, { text: 'Start new', onPress: clear },
    ]);
  };

  const apply = () => {
    const applied = drafting
      ? onInsert(pages.join('\n\n'), placement, insertion.current)
      : onReplace(source, revision, source, replacement.current);
    if (applied) onApplied();
    else setError('Your manuscript changed since this preview. Nothing was overwritten. Start a fresh preview for the current draft.');
  };

  return <View style={s.card}>
    {drafting && <><Text style={s.label}>HOW MUCH WOULD YOU LIKE TO WRITE?</Text><View style={s.pageChoices}>{Array.from({ length: AI_MAX_DRAFT_PAGES }, (_, index) => index + 1).map((count) => <Pressable key={count} disabled={locked} onPress={() => setPageCount(count)} style={[s.pageChoice, pageCount === count && s.pageChoiceActive, busy && s.disabled]} accessibilityRole="button" accessibilityLabel={`Draft ${count} page${count === 1 ? '' : 's'}`} accessibilityState={{ selected: pageCount === count, disabled: locked }}><Text style={[s.pageNumber, pageCount === count && s.pageTextActive]}>{count}</Text><Text style={[s.pageLabel, pageCount === count && s.pageTextActive]}>{count === 1 ? 'page' : 'pages'}</Text></Pressable>)}</View><Text style={s.hint}>About {pageCount * 250}–{pageCount * 350} words · continuous prose in this part, not new chapters or page breaks.</Text></>}
    <Text style={[s.label, s.directionLabel]}>{drafting ? 'WHAT SHOULD HAPPEN?' : 'HOW SHOULD THIS PAGE CHANGE?'}</Text>
    <DictationInput key={operation} editorial value={direction} onChangeText={setDirection} multiline maxLength={700} editable={!locked} dictationEnabled={!locked} onDictationState={setListening} placeholder={drafting ? 'Describe a scene or idea, or use the microphone. Leave blank to follow your plan.' : 'Describe the changes, or leave blank to use the selected tool.'} placeholderTextColor={c.textMuted} style={s.input} accessibilityLabel={drafting ? 'AI page draft instructions' : 'AI whole-page revision instructions'} />
    <Text style={[s.hint, listening && s.listening]} accessibilityLiveRegion="polite">{nativeDictationAvailable ? listening ? 'Listening… Tap stop when finished, then review your instructions.' : 'Tap the mic to speak. Review your instructions before generating.' : 'Tap the mic to open the keyboard, then use its dictation microphone.'}</Text>
    {drafting && <><Text style={[s.label, s.directionLabel]}>PLACE IN {context.chapterTitle.toUpperCase()}</Text><View style={s.placements}>{([['cursor', 'At cursor'], ['start', 'Beginning'], ['end', 'End']] as const).map(([value, label]) => <Pressable key={value} disabled={locked} onPress={() => setPlacement(value)} style={[s.placement, placement === value && s.placementActive]} accessibilityRole="button" accessibilityState={{ selected: placement === value, disabled: locked }}><Text style={s.placementText}>{label}</Text></Pressable>)}</View></>}
    <View style={s.allowance}><View style={s.allowanceTop}><Text style={s.label}>REFILLABLE AI CREDITS</Text><Text style={s.cost}>{remainingCredits} credit{remainingCredits === 1 ? '' : 's'}{hasPreview ? ' to finish' : ' total'}</Text></View><Text style={s.hint}>Full-page tools use Bookez cloud credits. {drafting ? `${unitCredits} per page` : `${unitCredits} per segment · ${total} segment${total === 1 ? '' : 's'}`} · {aiUsageRefillLabel()}. Completed previews are not charged again when resuming.</Text></View>
    {!hasPreview || remaining > 0 ? <Pressable onPress={() => void generate()} disabled={busy} style={[s.primary, busy && s.disabled]} accessibilityRole="button" accessibilityLabel={hasPreview ? 'Continue unfinished AI pages' : drafting ? `Preview ${pageCount} AI drafted pages` : 'Preview whole-page revision'}><Text style={s.primaryText}>{busy ? 'Working…' : hasPreview ? 'Continue unfinished work' : drafting ? `Preview ${pageCount === 1 ? 'a full page' : `${pageCount} pages`}` : 'Preview whole-page revision'}</Text><Text style={s.primaryText}>→</Text></Pressable> : null}
    {busy && <View style={s.progressRow}><ActivityIndicator color={c.accent} /><Pressable onPress={() => { stop.current = true; setStopping(true); }} disabled={stopping} accessibilityRole="button"><Text style={s.link}>{stopping ? 'Stopping after this request…' : 'Stop after this request'}</Text></Pressable></View>}
    {progress ? <Text style={s.hint} accessibilityLiveRegion="polite">{progress}{busy && stopping ? ' The current request finishes and may use credits; no later requests will start.' : ''}</Text> : null}
    {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
    {hasPreview && <View style={s.preview}>
      <Text style={s.label}>{drafting ? `${pages.length} OF ${pageCount} PAGES READY` : pages.length === total ? 'WHOLE-PAGE PREVIEW' : `${pages.length} OF ${total} SEGMENTS READY`}</Text>
      {drafting ? <><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.previewTabs}>{pages.map((_, index) => <Pressable key={index} onPress={() => setPreviewIndex(index)} style={[s.previewTab, previewIndex === index && s.placementActive]} accessibilityRole="button" accessibilityState={{ selected: previewIndex === index }}><Text style={s.placementText}>Page {index + 1}</Text></Pressable>)}</ScrollView><TextInput multiline editable={!busy} value={pages[previewIndex] ?? ''} onChangeText={(value) => { const next = pages.map((page, index) => index === previewIndex ? value : page); setPages(next); run.current.pages = next; }} style={s.previewInput} accessibilityLabel={`Edit AI draft preview page ${previewIndex + 1}`} /><Text style={s.hint}>{words(pages.join(' '))} words total · You can edit each page before adding it.</Text></> : pages.length === total ? <TextInput multiline editable={!busy} value={revision} onChangeText={setRevision} style={s.previewInput} accessibilityLabel="Edit whole-page AI revision preview" /> : <Text style={s.hint}>Finish the remaining segments before replacing anything. Your original page is untouched.</Text>}
      {!busy && (drafting || pages.length === total) && <Pressable onPress={apply} disabled={drafting ? !pages.some((page) => page.trim()) : !revision.trim()} style={s.primary} accessibilityRole="button"><Text style={s.primaryText}>{drafting ? `Add ${pages.length === 1 ? 'page' : `${pages.length} pages`} to manuscript` : 'Replace with reviewed revision'}</Text><Text style={s.primaryText}>→</Text></Pressable>}
      {!busy && <Pressable onPress={newRequest} style={s.newRequest} accessibilityRole="button"><Text style={s.link}>Start a new preview</Text></Pressable>}
      <Text style={s.hint}>Your current part, chapter order, and page layout stay the same. Applied changes can be undone in Write.</Text>
    </View>}
  </View>;
}

const s = StyleSheet.create({
  card: { marginTop: 12, padding: 14, backgroundColor: c.surfaceRaised, borderColor: c.border, borderWidth: 1, borderRadius: 16 },
  label: { color: c.secondaryAccent, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  pageChoices: { flexDirection: 'row', gap: 7, marginTop: 11 }, pageChoice: { flex: 1, minHeight: 61, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }, pageChoiceActive: { backgroundColor: c.accentStrong, borderColor: c.accentStrong }, pageNumber: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 23 }, pageLabel: { color: c.textSecondary, fontSize: 9 }, pageTextActive: { color: c.textOnAccent },
  hint: { color: c.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 8 }, directionLabel: { marginTop: 20 }, input: { minHeight: 94, maxHeight: 155, marginTop: 10, padding: 12, paddingBottom: 42, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.textPrimary, fontSize: 13, lineHeight: 19, textAlignVertical: 'top' }, listening: { color: c.accent, fontWeight: '700' },
  placements: { flexDirection: 'row', gap: 6, marginTop: 10 }, placement: { flex: 1, minHeight: 42, paddingHorizontal: 7, borderRadius: 11, backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' }, placementActive: { backgroundColor: c.accentSoft, borderColor: c.secondaryAccent }, placementText: { color: c.textPrimary, fontSize: 11, fontWeight: '700' },
  allowance: { paddingTop: 15, marginTop: 17, borderTopWidth: 1, borderTopColor: c.divider }, allowanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, cost: { color: c.accent, fontSize: 12, fontWeight: '800' }, primary: { marginTop: 15, paddingHorizontal: 14, minHeight: 48, borderRadius: 13, backgroundColor: c.accentStrong, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, primaryText: { color: c.textOnAccent, fontSize: 12, fontWeight: '800' }, disabled: { opacity: 0.5 }, progressRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, link: { color: c.accent, fontSize: 11, fontWeight: '700' }, error: { color: c.destructive, backgroundColor: c.destructiveSoft, padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18, marginTop: 12 },
  preview: { marginTop: 18, paddingTop: 17, borderTopWidth: 1, borderTopColor: c.divider }, previewTabs: { gap: 6, paddingTop: 12, paddingBottom: 8 }, previewTab: { minHeight: 38, paddingHorizontal: 13, borderRadius: 11, backgroundColor: c.surfaceMuted, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' }, previewInput: { minHeight: 200, maxHeight: 360, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, color: c.textPrimary, padding: 13, fontFamily: bookezFonts.serif, fontSize: 16, lineHeight: 25, textAlignVertical: 'top' }, newRequest: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
});
