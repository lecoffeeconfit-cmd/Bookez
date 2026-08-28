import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AIWritingCanceledError, AIWritingService, type AIWritingContext, type AIWritingOperation, type AIWritingResponse } from '../lib/ai-writing';

type Props = {
  text: string;
  selectedText: string;
  hasSelection: boolean;
  cursorPosition: number;
  requestedTool?: { operation: AIWritingOperation; token: number };
  context: AIWritingContext;
  onReplace: (original: string, replacement: string) => void;
  onInsert: (text: string) => void;
  onUseAsNote: (text: string) => void;
};

type Tool = { key: AIWritingOperation; label: string; icon: string; requiresText?: boolean };

const primaryTools: Tool[] = [
  { key: 'continue', label: 'Continue', icon: '→' },
  { key: 'improve', label: 'Improve', icon: '✦', requiresText: true },
  { key: 'rewrite', label: 'Rewrite', icon: '↻', requiresText: true },
  { key: 'expand', label: 'Expand', icon: '＋', requiresText: true },
  { key: 'brainstorm', label: 'Brainstorm', icon: '◌' },
];

const moreTools: Tool[] = [
  { key: 'shorten', label: 'Shorten', icon: '−', requiresText: true },
  { key: 'grammar', label: 'Fix Grammar', icon: 'Aa', requiresText: true },
  { key: 'match-style', label: 'Match My Style', icon: '≈', requiresText: true },
  { key: 'notes-to-prose', label: 'Notes → Prose', icon: '✎', requiresText: true },
  { key: 'ask', label: 'Ask About This Section', icon: '?', requiresText: true },
];

const rewriteStyles = ['Clearer', 'More Descriptive', 'More Concise', 'More Emotional', 'More Professional', 'More Natural', 'More Engaging'];
const askPrompts = ['Does this section make sense?', 'What feels unclear?', 'What is missing?', 'Where is the pacing weak?', 'Is anything repetitive?', 'Does the dialogue feel natural?', 'How could this section be stronger?'];

const summaryFor = (operation: AIWritingOperation) => ({
  continue: 'Offers three natural ways to keep your draft moving forward.',
  improve: 'Polishes clarity and flow while keeping your meaning and voice.',
  rewrite: 'Reworks the passage in a direction you choose.',
  expand: 'Develops an idea into a fuller passage without changing what happens.',
  brainstorm: 'Suggests possible next directions without touching your manuscript.',
  shorten: 'Tightens the passage while retaining its important details.',
  grammar: 'Corrects spelling, punctuation, and obvious grammar errors only.',
  'match-style': 'Brings the passage closer to the rhythm of your nearby writing.',
  'notes-to-prose': 'Turns rough notes into a clean, manuscript-ready passage.',
  ask: 'Gives concise feedback to help you strengthen the section yourself.',
}[operation]);

const titleFor = (operation: AIWritingOperation) => ({
  continue: 'Continue writing', improve: 'Improve writing', rewrite: 'Rewrite', expand: 'Expand', shorten: 'Shorten', grammar: 'Fix grammar', 'match-style': 'Match my style', 'notes-to-prose': 'Notes → prose', brainstorm: 'Brainstorm next', ask: 'Ask about this section',
}[operation]);

const helpFor = (operation: AIWritingOperation) => ({
  continue: 'Three possible next lines, in your existing voice. Nothing is added until you choose one.',
  improve: 'Polish clarity and flow while preserving meaning, facts, and your voice.',
  rewrite: 'Choose a direction, or describe exactly how you want this passage to change.',
  expand: 'Develop this thought without inventing major events or facts.',
  shorten: 'Tighten the passage without losing its important details.',
  grammar: 'Correct grammar, punctuation, spelling, and clear sentence errors only.',
  'match-style': 'Use nearby writing as a small style sample—never the whole manuscript.',
  'notes-to-prose': 'Turn rough notes into a manuscript-ready passage while preserving what happens.',
  brainstorm: 'Explore possible next directions. These are ideas, not changes to your draft.',
  ask: 'Get focused feedback that helps you strengthen the writing yourself.',
}[operation]);

const exampleFor = (operation: AIWritingOperation) => ({
  continue: { input: 'The porch light flickered once.', output: 'Then a second shadow crossed the curtains.' },
  improve: { input: 'She was very tired and walked slowly.', output: 'Exhausted, she moved at a crawl.' },
  rewrite: { input: 'The room felt strange.', output: 'Suspenseful → The room held its breath around her.' },
  expand: { input: 'He opened the old letter.', output: 'Adds sensory detail and meaning without changing what happens.' },
  shorten: { input: 'A long passage with repeated ideas…', output: 'A tighter version that keeps the essential details.' },
  grammar: { input: 'Their was no time to loose.', output: 'There was no time to lose.' },
  'match-style': { input: 'Nearby writing uses short, quiet sentences.', output: 'Reworks the selection with that same rhythm and tone.' },
  'notes-to-prose': { input: 'rain / missed train / calls sister', output: 'Rain blurred the platform as she watched the train leave, then called her sister.' },
  brainstorm: { input: 'A character finds a locked suitcase.', output: 'What if it belongs to someone who has been following them?' },
  ask: { input: 'Does this section make sense?', output: 'Points out what reads clearly and where a reader may lose the thread.' },
}[operation]);

export default function AIWritingTools({ text, selectedText, hasSelection, cursorPosition, requestedTool, context, onReplace, onInsert, onUseAsNote }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [instruction, setInstruction] = useState('');
  const [response, setResponse] = useState<AIWritingResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  // Keep the exact editor range for replacement. Trimming here could make a
  // repeated sentence replace the wrong occurrence instead of the selection.
  const sourceText = selectedText;
  const promptText = sourceText.trim();
  const canUseTextTool = promptText.length > 0;
  const displayOptions = useMemo(() => response?.options ?? [], [response]);
  const deviceDoesNotSupportOnDeviceAI = !error && availabilityReason.includes('can’t run Apple Intelligence');

  useEffect(() => {
    let live = true;
    void (async () => {
      const isAvailable = await AIWritingService.isAvailable();
      const reason = isAvailable ? '' : await AIWritingService.getAvailabilityReason();
      if (live) { setAvailable(isAvailable); setAvailabilityReason(reason); }
    })();
    return () => { live = false; };
  }, []);

  const openTool = (nextTool: Tool) => {
    void Haptics.selectionAsync();
    const startingInstruction = nextTool.key === 'rewrite' ? rewriteStyles[0] : nextTool.key === 'ask' ? askPrompts[0] : '';
    setMoreOpen(false); setSelectedTool(null); setTool(nextTool); setInstruction(startingInstruction); setResponse(null); setError('');
  };
  useEffect(() => {
    if (!requestedTool) return;
    const nextTool = [...primaryTools, ...moreTools].find((item) => item.key === requestedTool.operation);
    if (nextTool && (!nextTool.requiresText || canUseTextTool)) openTool(nextTool);
  }, [canUseTextTool, requestedTool?.token]);
  const selectTool = (nextTool: Tool) => {
    void Haptics.selectionAsync();
    if (selectedTool?.key === nextTool.key) { openTool(nextTool); return; }
    setSelectedTool(nextTool);
  };
  const cancelGeneration = () => {
    requestId.current += 1;
    void AIWritingService.cancel();
    setGenerating(false);
  };
  const closeTool = () => { if (generating) cancelGeneration(); setTool(null); setResponse(null); setGenerating(false); };
  const generate = async (customInstruction?: string) => {
    if (!tool || generating) return;
    const activeRequest = requestId.current + 1;
    requestId.current = activeRequest;
    setGenerating(true); setError(''); setResponse(null);
    try {
      const continueContext = text.slice(0, Math.max(0, Math.min(cursorPosition, text.length))).slice(-2500);
      const result = await AIWritingService.generate({ operation: tool.key, text: tool.key === 'continue' ? continueContext : promptText, instruction: customInstruction ?? instruction.trim(), context });
      if (requestId.current !== activeRequest) return;
      setAvailable(true); setAvailabilityReason('');
      setResponse(result);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      if (requestId.current !== activeRequest || caught instanceof AIWritingCanceledError) return;
      const message = caught instanceof Error ? caught.message : 'Bookez could not generate that right now.';
      const isStillAvailable = await AIWritingService.isAvailable();
      const unavailableReason = isStillAvailable ? '' : await AIWritingService.getAvailabilityReason();
      if (requestId.current !== activeRequest) return;
      setAvailable(isStillAvailable);
      setAvailabilityReason(unavailableReason);
      setError(message);
    }
    finally { if (requestId.current === activeRequest) setGenerating(false); }
  };
  const useReplacement = (replacement: string) => { onReplace(sourceText, replacement); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); closeTool(); };
  const useInsert = (value: string) => { onInsert(value); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); closeTool(); };

  return <>
    <View style={s.bar}>
      <View style={s.header}><View style={s.headerIcon}><Text style={s.headerIconText}>✦</Text></View><View style={s.headerCopy}><Text style={s.kicker}>AI WRITING TOOLS</Text><Text style={s.subtle}>{hasSelection ? 'Using your selection · tap for a preview' : 'Tap a tool for a preview and example'}</Text></View><Text style={s.swipeHint}>SWIPE →</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {primaryTools.map((item) => <Pressable key={item.key} onPress={() => selectTool(item)} disabled={item.requiresText && !canUseTextTool} style={[s.chip, selectedTool?.key === item.key && s.chipSelected, item.requiresText && !canUseTextTool && s.chipDisabled]} accessibilityRole="button" accessibilityState={{ selected: selectedTool?.key === item.key }} accessibilityLabel={item.label} accessibilityHint={`${summaryFor(item.key)} Tap again to open.`}><Text style={[s.chipIcon, selectedTool?.key === item.key && s.chipIconSelected]}>{item.icon}</Text><Text style={[s.chipText, selectedTool?.key === item.key && s.chipTextSelected]}>{item.label}</Text></Pressable>)}
        <Pressable onPress={() => { void Haptics.selectionAsync(); setMoreOpen(true); }} style={s.moreChip} accessibilityRole="button" accessibilityLabel="More AI writing tools"><Text style={s.moreChipText}>More</Text><Text style={s.moreChevron}>⌄</Text></Pressable>
      </ScrollView>
      {selectedTool && <View style={s.toolExplainer}><View style={s.toolExplainerIcon}><Text style={s.toolExplainerIconText}>{selectedTool.icon}</Text></View><View style={s.toolExplainerCopy}><Text style={s.toolExplainerTitle}>{selectedTool.label}</Text><Text style={s.toolExplainerText}>{summaryFor(selectedTool.key)}</Text></View><Pressable onPress={() => openTool(selectedTool)} style={s.toolExplainerOpen} accessibilityRole="button" accessibilityLabel={`Open ${selectedTool.label}`}><Text style={s.toolExplainerOpenText}>Open</Text><Text style={s.toolExplainerArrow}>→</Text></Pressable></View>}
      {available === false && <Text style={s.availability}>{availabilityReason}</Text>}
    </View>

    <Modal transparent animationType="fade" visible={moreOpen} onRequestClose={() => setMoreOpen(false)}><View style={s.menuShade}><Pressable style={s.dismiss} onPress={() => setMoreOpen(false)} /><View style={s.menu}><View style={s.handle} /><Text style={s.menuKicker}>MORE WRITING TOOLS</Text><Text style={s.menuHint}>Choose a tool to see what it does before AI changes anything.</Text>{moreTools.map((item) => <Pressable key={item.key} onPress={() => openTool(item)} disabled={item.requiresText && !canUseTextTool} style={[s.menuRow, item.requiresText && !canUseTextTool && s.chipDisabled]} accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={summaryFor(item.key)}><View style={s.menuIcon}><Text style={s.menuIconText}>{item.icon}</Text></View><View style={s.menuCopy}><Text style={s.menuText}>{item.label}</Text><Text numberOfLines={2} style={s.menuDescription}>{summaryFor(item.key)}</Text></View><Text style={s.menuArrow}>›</Text></Pressable>)}</View></View></Modal>

    <Modal transparent animationType="slide" visible={Boolean(tool)} onRequestClose={closeTool}>
      <KeyboardAvoidingView style={s.sheetShade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.dismiss} onPress={closeTool} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.sheetHeader}><View style={s.sheetHeaderCopy}><Text style={s.sheetKicker}>AI WRITING TOOLS</Text><Text style={s.sheetTitle}>{tool ? titleFor(tool.key) : ''}</Text></View><Pressable onPress={closeTool} style={s.close} accessibilityRole="button" accessibilityLabel="Close writing tool"><Text style={s.closeText}>×</Text></Pressable></View>
          {tool && <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheetContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.sheetHelp}>{helpFor(tool.key)}</Text>
            <View style={s.exampleCard}>
              <Text style={s.exampleLabel}>QUICK EXAMPLE</Text>
              <Text style={s.exampleInput}>{exampleFor(tool.key).input}</Text>
              <Text style={s.exampleArrow}>↓</Text>
              <Text style={s.exampleOutput}>{exampleFor(tool.key).output}</Text>
            </View>
            <View style={s.previewNote}><Text style={s.previewNoteIcon}>◇</Text><Text style={s.previewNoteText}>{hasSelection ? 'This tool will use only your selected passage.' : tool.key === 'continue' || tool.key === 'brainstorm' ? 'This tool will use the end of this section for context.' : 'This tool will use the current paragraph or section.'} Nothing changes until you choose an action.</Text></View>
            {tool.key === 'rewrite' && <><Text style={s.fieldLabel}>CHOOSE A DIRECTION</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.styleChips}>{rewriteStyles.map((style) => <Pressable key={style} onPress={() => setInstruction(style)} style={[s.styleChip, instruction === style && s.styleChipActive]} accessibilityRole="button"><Text style={[s.styleChipText, instruction === style && s.styleChipTextActive]}>{style}</Text></Pressable>)}</ScrollView></>}
            {tool.key === 'ask' && <><Text style={s.fieldLabel}>START WITH A QUESTION</Text><View style={s.questionGrid}>{askPrompts.map((prompt) => <Pressable key={prompt} onPress={() => setInstruction(prompt)} style={[s.question, instruction === prompt && s.questionActive]} accessibilityRole="button"><Text style={[s.questionText, instruction === prompt && s.questionTextActive]}>{prompt}</Text></Pressable>)}</View></>}
            {(tool.key === 'rewrite' || tool.key === 'ask') && <TextInput value={instruction} onChangeText={setInstruction} multiline placeholder={tool.key === 'ask' ? 'Ask your own question…' : 'e.g. Make this sound more suspenseful.'} placeholderTextColor="#999DB5" style={s.instruction} accessibilityLabel="Custom AI writing instruction" />}
            {!response && !generating && !error && <Pressable onPress={() => void generate()} style={s.generate} accessibilityRole="button"><Text style={s.generateText}>{tool.key === 'ask' ? 'Get feedback' : tool.key === 'brainstorm' ? 'Generate ideas' : 'Create preview'}</Text><Text style={s.generateArrow}>→</Text></Pressable>}
            {generating && <View style={s.loading}><ActivityIndicator color="#8B8AE8" /><Text style={s.loadingText}>Creating your preview…</Text><Pressable onPress={cancelGeneration} accessibilityRole="button"><Text style={s.cancelText}>Cancel</Text></Pressable></View>}
            {error ? <View style={s.error}><Text style={s.errorTitle}>{deviceDoesNotSupportOnDeviceAI ? 'On-device AI isn’t available on this iPhone' : 'That preview didn’t work'}</Text><Text style={s.errorText}>{error}</Text><View style={s.errorActions}>{!deviceDoesNotSupportOnDeviceAI && <Pressable onPress={() => void generate()} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable>}<Pressable onPress={closeTool} style={s.secondary}><Text style={s.secondaryText}>Close</Text></Pressable></View></View> : null}
            {response?.ideas?.length ? <View style={s.results}>{response.ideas.map((idea, index) => <View key={`${idea.title}-${index}`} style={s.idea}><Text style={s.ideaNumber}>{String(index + 1).padStart(2, '0')}</Text><View style={s.ideaCopy}><Text style={s.ideaTitle}>{idea.title}</Text><Text style={s.ideaText}>{idea.detail}</Text><View style={s.inlineActions}><Pressable onPress={() => onUseAsNote(`${idea.title}: ${idea.detail}`)} accessibilityRole="button"><Text style={s.link}>Use as note</Text></Pressable><Pressable onPress={() => { setInstruction(`Explore: ${idea.title}`); void generate(`Explore this idea further: ${idea.title}`); }} accessibilityRole="button"><Text style={s.link}>Explore</Text></Pressable></View></View></View>)}</View> : null}
            {response?.feedback ? <View style={s.feedback}><Text style={s.feedbackLabel}>SECTION FEEDBACK</Text><Text style={s.feedbackText}>{response.feedback}</Text><Pressable onPress={() => void generate()} style={s.feedbackAgain} accessibilityRole="button"><Text style={s.plainActionText}>Ask again</Text></Pressable></View> : null}
            {displayOptions.length ? <View style={s.results}>{displayOptions.map((option, index) => <View key={`${index}-${option.slice(0, 16)}`} style={s.option}><Text style={s.optionLabel}>{tool.key === 'continue' ? `OPTION ${index + 1}` : 'PREVIEW'}</Text><Text style={s.optionText}>{option}</Text><View style={s.optionActions}>{tool.key === 'continue' ? <Pressable onPress={() => useInsert(option)} style={s.actionPrimary} accessibilityRole="button"><Text style={s.actionPrimaryText}>Insert</Text></Pressable> : <><Pressable onPress={() => useReplacement(option)} style={s.actionPrimary} accessibilityRole="button"><Text style={s.actionPrimaryText}>Replace</Text></Pressable><Pressable onPress={() => useInsert(option)} style={s.actionSecondary} accessibilityRole="button"><Text style={s.actionSecondaryText}>Insert below</Text></Pressable></>}<Pressable onPress={() => void generate()} style={s.plainAction} accessibilityRole="button"><Text style={s.plainActionText}>Try again</Text></Pressable></View></View>)}</View> : null}
          </ScrollView>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  bar: { marginTop: 10, padding: 11, borderRadius: 16, backgroundColor: 'rgba(246,245,252,0.86)', borderWidth: 1, borderColor: '#E5E2EE' },
  header: { flexDirection: 'row', alignItems: 'center' }, headerIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#817BDE', alignItems: 'center', justifyContent: 'center' }, headerIconText: { color: '#FFF', fontSize: 13, fontWeight: '800' }, headerCopy: { flex: 1 }, kicker: { marginLeft: 8, color: '#5F5AA0', fontSize: 8, letterSpacing: 0.9, fontWeight: '800' }, subtle: { marginLeft: 8, color: '#8385A3', fontSize: 8, marginTop: 2 }, swipeHint: { color: '#7772C8', fontSize: 7, letterSpacing: .55, fontWeight: '800' },
  chips: { gap: 7, paddingTop: 9, paddingRight: 8 }, chip: { minHeight: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E3E0EA' }, chipDisabled: { opacity: 0.42 }, chipSelected: { backgroundColor: '#7776DE', borderColor: '#7776DE' }, chipIcon: { color: '#7B78CF', fontSize: 12, fontWeight: '800', marginRight: 5 }, chipIconSelected: { color: '#FFF' }, chipText: { color: '#30385D', fontSize: 9, fontWeight: '700' }, chipTextSelected: { color: '#FFF' }, moreChip: { minHeight: 34, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#EAE7F7', flexDirection: 'row', alignItems: 'center' }, moreChipText: { color: '#615EA8', fontSize: 9, fontWeight: '800' }, moreChevron: { color: '#615EA8', marginLeft: 5, fontSize: 12 }, availability: { color: '#81839B', fontSize: 8, lineHeight: 12, marginTop: 8 }, 
  toolExplainer: { minHeight: 55, marginTop: 9, padding: 9, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E4E0F8' }, toolExplainerIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAE6FF' }, toolExplainerIconText: { color: '#6F6BC4', fontSize: 12, fontWeight: '800' }, toolExplainerCopy: { flex: 1, minWidth: 0, marginLeft: 8, marginRight: 8 }, toolExplainerTitle: { color: '#3B4267', fontSize: 9, fontWeight: '800' }, toolExplainerText: { color: '#7E829B', fontSize: 8, lineHeight: 11, marginTop: 2 }, toolExplainerOpen: { minHeight: 29, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#EAE6FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, toolExplainerOpenText: { color: '#6661AD', fontSize: 8, fontWeight: '800' }, toolExplainerArrow: { color: '#6661AD', fontSize: 12, marginLeft: 4 },
  menuShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,37,76,0.24)' }, sheetShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,37,76,0.28)' }, dismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, menu: { padding: 18, paddingBottom: 28, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#FBFAFF' }, handle: { width: 34, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: '#D4D2E1', marginBottom: 14 }, menuKicker: { color: '#8B8AE8', fontSize: 8, letterSpacing: 1, fontWeight: '800' }, menuHint: { color: '#8589A3', fontSize: 9, lineHeight: 13, marginTop: 5, marginBottom: 8 }, menuRow: { minHeight: 65, borderTopWidth: 1, borderTopColor: '#ECEAF3', flexDirection: 'row', alignItems: 'center' }, menuIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EEFF' }, menuIconText: { color: '#7772CA', fontSize: 13, fontWeight: '800' }, menuCopy: { flex: 1, marginLeft: 10, marginRight: 6 }, menuText: { color: '#30385D', fontSize: 11, fontWeight: '700' }, menuDescription: { color: '#8589A3', fontSize: 8, lineHeight: 12, marginTop: 2 }, menuArrow: { color: '#8B8AE8', fontSize: 20 },
  sheet: { maxHeight: '89%', paddingTop: 20, paddingHorizontal: 20, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF', overflow: 'hidden' }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, sheetHeaderCopy: { flex: 1, paddingRight: 14 }, sheetScroll: { flexGrow: 0 }, sheetContent: { paddingBottom: 32 }, sheetKicker: { color: '#8B8AE8', fontSize: 8, letterSpacing: 1, fontWeight: '800' }, sheetTitle: { color: '#202954', fontSize: 23, fontWeight: '800', marginTop: 4 }, close: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F0EFF6', alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#62657D', fontSize: 21, lineHeight: 24 }, sheetHelp: { color: '#6E7699', fontSize: 11, lineHeight: 17, marginTop: 10 },
  exampleCard: { marginTop: 14, padding: 13, borderRadius: 15, backgroundColor: '#F0EEFF', borderWidth: 1, borderColor: '#E1DDF9' }, exampleLabel: { color: '#7772CA', fontSize: 7, letterSpacing: .9, fontWeight: '800' }, exampleInput: { color: '#606681', fontSize: 9, lineHeight: 14, marginTop: 7 }, exampleArrow: { color: '#8B8AE8', fontSize: 12, marginVertical: 3 }, exampleOutput: { color: '#30385D', fontSize: 10, lineHeight: 15, fontWeight: '700' }, previewNote: { flexDirection: 'row', marginTop: 10, paddingHorizontal: 3, alignItems: 'flex-start' }, previewNoteIcon: { color: '#8B8AE8', fontSize: 11, marginRight: 6 }, previewNoteText: { flex: 1, color: '#8589A3', fontSize: 8, lineHeight: 12 },
  fieldLabel: { color: '#6E6BA8', fontSize: 7, letterSpacing: .85, fontWeight: '800', marginTop: 16, marginBottom: 7 }, styleChips: { gap: 7, paddingRight: 10 }, styleChip: { paddingHorizontal: 10, minHeight: 32, borderRadius: 10, justifyContent: 'center', backgroundColor: '#F1F0F7' }, styleChipActive: { backgroundColor: '#8B8AE8' }, styleChipText: { color: '#62657E', fontSize: 9, fontWeight: '700' }, styleChipTextActive: { color: '#FFF' }, questionGrid: { gap: 6 }, question: { padding: 10, borderRadius: 11, backgroundColor: '#F4F3FA' }, questionActive: { backgroundColor: '#E9E6FC', borderWidth: 1, borderColor: '#CAC3F6' }, questionText: { color: '#555B77', fontSize: 9, fontWeight: '600' }, questionTextActive: { color: '#625EAB' }, instruction: { minHeight: 70, maxHeight: 112, marginTop: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E3E0EC', backgroundColor: '#FFF', color: '#30385D', fontSize: 10, lineHeight: 15, textAlignVertical: 'top' },
  generate: { minHeight: 49, marginTop: 15, paddingHorizontal: 15, borderRadius: 14, backgroundColor: '#7776DE', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, generateText: { color: '#FFF', fontSize: 11, fontWeight: '800' }, generateArrow: { color: '#FFF', fontSize: 18 }, loading: { minHeight: 66, marginTop: 15, borderRadius: 14, backgroundColor: '#F0EEFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, loadingText: { color: '#5A5A91', fontSize: 10, fontWeight: '700' }, cancelText: { color: '#6A65B4', fontSize: 10, fontWeight: '800' }, error: { marginTop: 14, padding: 14, borderRadius: 15, backgroundColor: '#F4F2FA' }, errorTitle: { color: '#30385D', fontSize: 11, fontWeight: '800' }, errorText: { color: '#74778F', fontSize: 9, lineHeight: 14, marginTop: 4 }, errorActions: { flexDirection: 'row', gap: 7, marginTop: 10 }, retry: { paddingHorizontal: 11, minHeight: 32, borderRadius: 10, backgroundColor: '#7776DE', alignItems: 'center', justifyContent: 'center' }, retryText: { color: '#FFF', fontSize: 9, fontWeight: '800' }, secondary: { paddingHorizontal: 11, minHeight: 32, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#6964AD', fontSize: 9, fontWeight: '800' },
  results: { marginTop: 14, gap: 9 }, option: { padding: 13, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E4EF' }, optionLabel: { color: '#8B8AE8', fontSize: 7, letterSpacing: .85, fontWeight: '800' }, optionText: { color: '#424961', fontSize: 11, lineHeight: 17, marginTop: 6 }, optionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11, alignItems: 'center' }, actionPrimary: { minHeight: 33, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#7776DE', alignItems: 'center', justifyContent: 'center' }, actionPrimaryText: { color: '#FFF', fontSize: 9, fontWeight: '800' }, actionSecondary: { minHeight: 33, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center' }, actionSecondaryText: { color: '#6863AD', fontSize: 9, fontWeight: '800' }, plainAction: { paddingHorizontal: 4, minHeight: 31, justifyContent: 'center' }, plainActionText: { color: '#6F70A0', fontSize: 9, fontWeight: '700' },
  idea: { padding: 12, borderRadius: 14, backgroundColor: '#FFF', flexDirection: 'row', borderWidth: 1, borderColor: '#E7E4EF' }, ideaNumber: { color: '#8B8AE8', fontSize: 9, fontWeight: '800' }, ideaCopy: { flex: 1, marginLeft: 10 }, ideaTitle: { color: '#30385D', fontSize: 11, fontWeight: '800' }, ideaText: { color: '#6E7699', fontSize: 10, lineHeight: 15, marginTop: 3 }, inlineActions: { flexDirection: 'row', gap: 14, marginTop: 8 }, link: { color: '#6A65B4', fontSize: 9, fontWeight: '800' }, feedback: { padding: 13, marginTop: 14, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E4EF' }, feedbackLabel: { color: '#8B8AE8', fontSize: 7, letterSpacing: .8, fontWeight: '800' }, feedbackText: { color: '#4E556E', fontSize: 10, lineHeight: 16, marginTop: 6 }, feedbackAgain: { alignSelf: 'flex-start', minHeight: 30, justifyContent: 'center', marginTop: 7 },
});
