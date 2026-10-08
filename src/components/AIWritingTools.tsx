import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AI_PROVIDER_STORAGE_KEY, AIWritingCanceledError, AIWritingService, deviceSourceLimit, prepareAIWritingContext, type AIProviderPreference, type AIResolvedProvider, type AIWritingContext, type AIWritingContextMode, type AIWritingOperation, type AIWritingResponse } from '../lib/ai-writing';
import { AI_CONTEXT_MODE_STORAGE_KEY, AI_USAGE_POLICY, AI_USAGE_STORAGE_KEY, aiProjectCreditCeiling, aiUsageMonthKey, aiUsageRefillLabel, aiUsageWeight, readAIUsage, recordAIUsage, type AIUsageLedger } from '../lib/ai-usage';
import { bookezSecureStorage } from '../lib/secure-storage';
import { bookezColors, bookezRadii, bookezShadows, bookezType } from '../theme/bookez';
import { BookezMysticIcon } from './bookez-art';

const AI_WRITING_INTRO_SEEN_STORAGE_KEY = 'bookez.ai-writing-intro-seen.v1';

type Props = {
  text: string;
  selectedText: string;
  hasSelection: boolean;
  cursorPosition: number;
  compact?: boolean;
  editorial?: boolean;
  requestedTool?: { operation: AIWritingOperation; token: number };
  context: AIWritingContext;
  onReplace: (original: string, replacement: string, targetText?: string) => void;
  onInsert: (text: string) => void;
  onUseAsNote: (text: string) => void;
};

type Tool = { key: AIWritingOperation; label: string; icon: string; requiresText?: boolean };
type Scope = 'paragraph' | 'page';

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
  { key: 'ask', label: 'Ask About This Section', icon: '?' },
];

const rewriteStyles = ['Clearer', 'More Descriptive', 'More Concise', 'More Emotional', 'More Professional', 'More Natural', 'More Engaging'];
const assistantPrompts = ['Check continuity', 'What happens next?', 'Character question', 'Improve this scene'];

const operationSummaries: Record<AIWritingOperation, string> = {
  continue: 'Offers three natural ways to keep your draft moving forward.',
  improve: 'Polishes clarity and flow while keeping your meaning and voice.',
  rewrite: 'Reworks the passage in a direction you choose.',
  expand: 'Develops an idea into a fuller passage without changing what happens.',
  brainstorm: 'Suggests possible next directions without touching your manuscript.',
  shorten: 'Tightens the passage while retaining its important details.',
  grammar: 'Corrects spelling, punctuation, and obvious grammar errors only.',
  'match-style': 'Brings the passage closer to the rhythm of your nearby writing.',
  'notes-to-prose': 'Turns rough notes into a clean, manuscript-ready passage.',
  ask: 'Gives concise, book-aware guidance without rewriting your manuscript.',
};

const operationTitles: Record<AIWritingOperation, string> = {
  continue: 'Continue writing', improve: 'Improve writing', rewrite: 'Rewrite', expand: 'Expand', shorten: 'Shorten', grammar: 'Fix grammar', 'match-style': 'Match my style', 'notes-to-prose': 'Notes → prose', brainstorm: 'Brainstorm next', ask: 'Ask about your book',
};

const operationHelp: Record<AIWritingOperation, string> = {
  continue: 'Three possible next lines, in your existing voice. Nothing is added until you choose one.',
  improve: 'Polish clarity and flow while preserving meaning, facts, and your voice.',
  rewrite: 'Choose a direction, or describe exactly how you want this passage to change.',
  expand: 'Develop this thought without inventing major events or facts.',
  shorten: 'Tighten the passage without losing its important details.',
  grammar: 'Correct grammar, punctuation, spelling, and clear sentence errors only.',
  'match-style': 'Use nearby writing as a small style sample—never the whole manuscript.',
  'notes-to-prose': 'Turn rough notes into a manuscript-ready passage while preserving what happens.',
  brainstorm: 'Explore possible next directions. These are ideas, not changes to your draft.',
  ask: 'Ask about characters, events, continuity, tone, or the section in front of you.',
};

const operationExamples: Record<AIWritingOperation, { input: string; output: string }> = {
  continue: { input: 'The porch light flickered once.', output: 'Then a second shadow crossed the curtains.' },
  improve: { input: 'She was very tired and walked slowly.', output: 'Exhausted, she moved at a crawl.' },
  rewrite: { input: 'The room felt strange.', output: 'Suspenseful → The room held its breath around her.' },
  expand: { input: 'He opened the old letter.', output: 'Adds sensory detail and meaning without changing what happens.' },
  shorten: { input: 'A long passage with repeated ideas…', output: 'A tighter version that keeps the essential details.' },
  grammar: { input: 'Their was no time to loose.', output: 'There was no time to lose.' },
  'match-style': { input: 'Nearby writing uses short, quiet sentences.', output: 'Reworks the selection with that same rhythm and tone.' },
  'notes-to-prose': { input: 'rain / missed train / calls sister', output: 'Rain blurred the platform as she watched the train leave, then called her sister.' },
  brainstorm: { input: 'A character finds a locked suitcase.', output: 'What if it belongs to someone who has been following them?' },
  ask: { input: 'Has Elena already met Marcus?', output: 'Checks the book context and explains what the available writing supports.' },
};

const contextModes: Array<{ value: AIWritingContextMode; label: string; description: string }> = [
  { value: 'auto', label: 'Auto', description: 'Uses only as much of your book as needed.' },
  { value: 'page', label: 'Page', description: 'Current page or selection.' },
  { value: 'nearby', label: 'Nearby', description: 'Current page, nearby writing, and local chapter context.' },
  { value: 'book-aware', label: 'Book-aware', description: 'Relevant characters, events, summaries, and earlier writing.' },
];

const continuityQuestion = /\b(already|previously|earlier|before|contradict|contradiction|continuity|first mention|has .{0,50} met|what happened|where did i|character|timeline|remember|what happens next|plot)\b/i;

const resolveAutoContextMode = (operation: AIWritingOperation, instruction: string): Exclude<AIWritingContextMode, 'auto'> => {
  if (operation === 'ask' && continuityQuestion.test(instruction)) return 'book-aware';
  if (operation === 'continue' || operation === 'match-style' || operation === 'expand') return 'nearby';
  return operation === 'ask' ? 'nearby' : 'page';
};

const contextModeLabel = (mode: AIWritingContextMode) => contextModes.find((item) => item.value === mode)?.label ?? 'Auto';
const contextModeDescription = (mode: AIWritingContextMode) => contextModes.find((item) => item.value === mode)?.description ?? contextModes[0].description;
const wordsIn = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;

const currentParagraph = (value: string, cursorPosition: number) => {
  if (!value.trim()) return '';
  const cursor = Math.max(0, Math.min(cursorPosition, value.length));
  const before = value.lastIndexOf('\n\n', Math.max(0, cursor - 1));
  const after = value.indexOf('\n\n', cursor);
  const raw = value.slice(before < 0 ? 0 : before + 2, after < 0 ? value.length : after);
  return raw.trim();
};

export default function AIWritingTools({ text, selectedText, hasSelection, cursorPosition, compact = false, editorial = false, requestedTool, context, onReplace, onInsert, onUseAsNote }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [showFirstUseIntro, setShowFirstUseIntro] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [instruction, setInstruction] = useState('');
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [contextMode, setContextMode] = useState<AIWritingContextMode>('auto');
  const [providerPreference, setProviderPreference] = useState<AIProviderPreference>('auto');
  const [lastProvider, setLastProvider] = useState<AIResolvedProvider | null>(null);
  const [scope, setScope] = useState<Scope>('paragraph');
  const [response, setResponse] = useState<AIWritingResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [usageUsedCredits, setUsageUsedCredits] = useState(0);
  const usageUsedRef = useRef(0);
  const usageLoaded = useRef(false);
  const requestId = useRef(0);
  const inFlightSignature = useRef('');
  const generatedTargetRef = useRef('');

  const selectedPassage = hasSelection ? selectedText : '';
  const paragraphPassage = currentParagraph(text, cursorPosition);
  const targetText = hasSelection ? selectedText : scope === 'page' ? text : paragraphPassage;
  const canUseTextTool = Boolean(targetText.trim());
  const activeOperation = selectedTool?.key ?? 'ask';
  const activeInstruction = selectedTool?.key === 'ask' ? assistantPrompt || instruction : instruction;
  const resolvedContextMode = contextMode === 'auto' ? resolveAutoContextMode(activeOperation, activeInstruction) : contextMode;
  const usageRemaining = Math.max(0, AI_USAGE_POLICY.monthlyCredits - usageUsedCredits);
  const usageProgress = Math.min(1, usageUsedCredits / AI_USAGE_POLICY.monthlyCredits);
  const selectedToolExample = selectedTool ? operationExamples[selectedTool.key] : null;
  const phoneReadyForScope = available === true && (!selectedTool || targetText.length <= deviceSourceLimit(selectedTool.key));
  const displayedProvider: AIResolvedProvider = providerPreference === 'cloud' ? 'cloud' : providerPreference === 'device' ? 'device' : phoneReadyForScope ? 'device' : 'cloud';
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

  useEffect(() => {
    let live = true;
    void Promise.all([bookezSecureStorage.getItem(AI_CONTEXT_MODE_STORAGE_KEY), bookezSecureStorage.getItem(AI_USAGE_STORAGE_KEY), bookezSecureStorage.getItem(AI_WRITING_INTRO_SEEN_STORAGE_KEY), bookezSecureStorage.getItem(AI_PROVIDER_STORAGE_KEY)]).then(([savedMode, savedUsage, savedIntro, savedProvider]) => {
      if (!live) return;
      if (savedMode === 'auto' || savedMode === 'page' || savedMode === 'nearby' || savedMode === 'book-aware') setContextMode(savedMode);
      setIntroSeen(savedIntro === 'true');
      if (savedProvider === 'auto' || savedProvider === 'device' || savedProvider === 'cloud') setProviderPreference(savedProvider);
      try {
        const ledger = savedUsage ? JSON.parse(savedUsage) as Partial<AIUsageLedger> : null;
        const used = ledger?.month === aiUsageMonthKey() && typeof ledger.usedCredits === 'number' ? Math.max(0, ledger.usedCredits) : 0;
        usageUsedRef.current = used;
        setUsageUsedCredits(used);
      } catch {
        usageUsedRef.current = 0;
        setUsageUsedCredits(0);
      }
      usageLoaded.current = true;
    }).catch(() => { if (live) usageLoaded.current = true; });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (usageLoaded.current) void bookezSecureStorage.setItem(AI_CONTEXT_MODE_STORAGE_KEY, contextMode);
  }, [contextMode]);

  const recordUsage = async (mode: Exclude<AIWritingContextMode, 'auto'>, protectReserve: boolean) => {
    const nextUsed = await recordAIUsage(aiUsageWeight(mode), protectReserve);
    usageUsedRef.current = nextUsed;
    setUsageUsedCredits(nextUsed);
  };

  const openAssistant = () => {
    void readAIUsage().then((used) => { usageUsedRef.current = used; setUsageUsedCredits(used); });
    void AIWritingService.isAvailable().then(async (isAvailable) => {
      setAvailable(isAvailable);
      setAvailabilityReason(isAvailable ? '' : await AIWritingService.getAvailabilityReason());
    });
    void bookezSecureStorage.getItem(AI_PROVIDER_STORAGE_KEY).then((saved) => {
      if (saved === 'auto' || saved === 'device' || saved === 'cloud') setProviderPreference(saved);
    });
    void Haptics.selectionAsync();
    if (!introSeen) {
      setIntroSeen(true);
      setShowFirstUseIntro(true);
      void bookezSecureStorage.setItem(AI_WRITING_INTRO_SEEN_STORAGE_KEY, 'true');
    }
    setAssistantOpen(true);
  };

  const chooseProvider = (next: AIProviderPreference) => {
    setProviderPreference(next);
    setError('');
    void bookezSecureStorage.setItem(AI_PROVIDER_STORAGE_KEY, next);
  };

  const openTool = (nextTool: Tool) => {
    void Haptics.selectionAsync();
    const startingInstruction = nextTool.key === 'rewrite' ? rewriteStyles[0] : '';
    setMoreOpen(false);
    setShowFirstUseIntro(false);
    setAssistantOpen(true);
    setSelectedTool(nextTool);
    setInstruction(startingInstruction);
    if (nextTool.key !== 'ask') setAssistantPrompt('');
    setResponse(null);
    setError('');
  };

  useEffect(() => {
    if (!requestedTool) return;
    const nextTool = [...primaryTools, ...moreTools].find((item) => item.key === requestedTool.operation);
    if (nextTool) openTool(nextTool);
  }, [requestedTool?.token]);

  const cancelGeneration = () => {
    requestId.current += 1;
    inFlightSignature.current = '';
    void AIWritingService.cancel();
    setGenerating(false);
  };

  const closeAssistant = () => {
    if (generating) cancelGeneration();
    setAssistantOpen(false);
    setMoreOpen(false);
    setSelectedTool(null);
    setResponse(null);
    setError('');
    setAssistantPrompt('');
    setShowFirstUseIntro(false);
    generatedTargetRef.current = '';
  };

  const generate = async (nextTool?: Tool, customInstruction?: string) => {
    const activeTool = nextTool ?? selectedTool;
    if (!activeTool || generating) return;
    const nextInstruction = (customInstruction ?? (activeTool.key === 'ask' ? assistantPrompt || instruction : instruction)).trim();
    const sourceForAsk = selectedPassage || context.nearbyText || text.slice(Math.max(0, cursorPosition - 2600), cursorPosition);
    const sourceText = activeTool.key === 'continue' ? text.slice(0, Math.max(0, Math.min(cursorPosition, text.length))).slice(-2500) : activeTool.key === 'ask' ? sourceForAsk : targetText;
    if (activeTool.requiresText && !sourceText.trim()) {
      setError('Select a passage or choose Current paragraph / Current page before using this tool.');
      return;
    }
    if (activeTool.key === 'ask' && !nextInstruction) {
      setError('Ask Bookez a question about your writing first.');
      return;
    }
    const mode = contextMode === 'auto' ? resolveAutoContextMode(activeTool.key, nextInstruction) : contextMode;
    const writingRequest = { operation: activeTool.key, text: sourceText, instruction: nextInstruction, context: prepareAIWritingContext(context, mode) };
    let provider: AIResolvedProvider;
    try { provider = await AIWritingService.resolveProvider(providerPreference, writingRequest); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Phone AI is not available.'); return; }
    if (provider === 'cloud') {
      const used = await readAIUsage();
      usageUsedRef.current = used;
      setUsageUsedCredits(used);
      const ceiling = providerPreference === 'auto' ? aiProjectCreditCeiling() : AI_USAGE_POLICY.monthlyCredits;
      if (used + aiUsageWeight(mode) > ceiling) {
        setError(providerPreference === 'auto'
          ? 'Phone first is protecting the final 30% of your monthly credits. Choose Bookez credits to spend from that reserve, or Phone only for 0-credit requests on a supported device.'
          : `This cloud request needs ${aiUsageWeight(mode)} AI credits, but only ${Math.max(0, ceiling - used)} remain this month.`);
        return;
      }
    }
    const signature = `${activeTool.key}:${mode}:${nextInstruction}:${sourceText}`;
    if (inFlightSignature.current === signature) return;
    inFlightSignature.current = signature;
    const activeRequest = requestId.current + 1;
    requestId.current = activeRequest;
    generatedTargetRef.current = activeTool.requiresText ? sourceText : '';
    setGenerating(true);
    setError('');
    setResponse(null);
    try {
      const result = await AIWritingService.generate(writingRequest, provider);
      if (provider === 'cloud') await recordUsage(mode, providerPreference === 'auto');
      if (requestId.current !== activeRequest) return;
      if (provider === 'device') { setAvailable(true); setAvailabilityReason(''); }
      setLastProvider(provider);
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
    } finally {
      if (requestId.current === activeRequest) {
        inFlightSignature.current = '';
        setGenerating(false);
      }
    }
  };

  const askBookez = () => {
    const question = assistantPrompt.trim();
    const askTool = moreTools.find((item) => item.key === 'ask');
    if (!askTool || !question) { setError('Ask Bookez a question about your writing first.'); return; }
    setSelectedTool(askTool);
    setInstruction(question);
    void generate(askTool, question);
  };

  const useReplacement = (replacement: string) => { const replacementTarget = generatedTargetRef.current || targetText; onReplace(replacementTarget, replacement, replacementTarget); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); closeAssistant(); };
  const useInsert = (value: string) => { onInsert(value); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); closeAssistant(); };

  return <>
    <View style={compact ? s.compactLauncherRow : s.launcherRow}>
      <Pressable onPress={openAssistant} style={[compact ? s.compactLauncher : s.launcher, editorial && (compact ? editorialStyles.compactLauncher : editorialStyles.launcher)]} accessibilityRole="button" accessibilityLabel="Open AI Writing Assistant" accessibilityHint="Ask Bookez a question or choose a writing tool.">
        {compact ? <BookezMysticIcon name="ai-writing" size={29} surface="jewel" animated /> : <><BookezMysticIcon name="ai-writing" size={31} surface="jewel" animated /><View style={s.launcherCopy}><Text style={s.launcherLabel}>AI</Text><Text style={s.launcherHint}>{hasSelection ? `Selected text · ${wordsIn(selectedText)} words` : 'Ask, revise, or explore'}</Text></View><Text style={s.launcherArrow}>→</Text></>}
      </Pressable>
    </View>

    <Modal transparent animationType="slide" visible={assistantOpen} onRequestClose={closeAssistant}>
      <KeyboardAvoidingView style={[s.sheetShade, editorial && editorialStyles.sheetShade]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.dismiss} onPress={closeAssistant} />
        <View style={[s.sheet, editorial && editorialStyles.sheet]}>
          <View style={s.handle} />
          <View style={s.sheetHeader}><View style={s.sheetHeaderCopy}><Text style={[s.sheetKicker, editorial && editorialStyles.sheetKicker]}>BOOKEZ</Text><Text style={[s.sheetTitle, editorial && editorialStyles.sheetTitle]}>AI Writing Assistant</Text><Text style={[s.sheetSubtitle, editorial && editorialStyles.sheetSubtitle]}>Write, revise, or ask about your book.</Text></View><Pressable onPress={closeAssistant} style={[s.close, editorial && editorialStyles.close]} accessibilityRole="button" accessibilityLabel="Close AI Writing Assistant"><Text style={s.closeText}>×</Text></Pressable></View>
          <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheetContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {showFirstUseIntro && <View style={s.introCard}><BookezMysticIcon name="ai-writing" size={33} surface="jewel" animated /><View style={s.introCopy}><Text style={s.introKicker}>YOUR CREATIVE SIDEKICK</Text><Text style={s.introTitle}>AI, when you need it</Text><Text style={s.introText}>Ask a book question, explore an idea, or preview a revision. Your manuscript only changes when you choose Insert or Replace.</Text></View><Pressable onPress={() => setShowFirstUseIntro(false)} style={s.introDismiss} accessibilityRole="button" accessibilityLabel="Dismiss AI introduction"><Text style={s.introDismissText}>Got it</Text></Pressable></View>}
            <View style={s.askCard}>
              <Text style={s.fieldLabel}>ASK BOOKEZ</Text>
              <TextInput value={assistantPrompt} onChangeText={(value) => { setAssistantPrompt(value); setError(''); }} multiline placeholder="Ask anything about your writing…" placeholderTextColor="#667A60" style={s.askInput} accessibilityLabel="Ask Bookez about your writing" />
              <View style={s.askFooter}><Text style={s.askHint}>{resolvedContextMode === 'book-aware' ? 'Book-aware answers use relevant story memory.' : 'Nothing changes in your manuscript.'}</Text><Pressable onPress={askBookez} disabled={generating || !assistantPrompt.trim()} style={[s.askButton, (generating || !assistantPrompt.trim()) && s.disabled]} accessibilityRole="button" accessibilityLabel="Ask Bookez"><Text style={s.askButtonText}>Ask</Text><Text style={s.askButtonArrow}>→</Text></Pressable></View>
            </View>

            {!selectedTool && <View style={s.promptChips}>{assistantPrompts.map((prompt) => <Pressable key={prompt} onPress={() => { setAssistantPrompt(prompt === 'Check continuity' ? 'Has anything in this section already happened earlier in the book?' : prompt === 'Character question' ? 'What should I keep consistent about the characters in this scene?' : prompt); setError(''); }} style={s.promptChip} accessibilityRole="button"><Text style={s.promptChipText}>{prompt}</Text></Pressable>)}</View>}

            <View style={s.providerCard}><Text style={s.fieldLabel}>AI PROVIDER</Text><View style={s.providerChoices}>{([['auto', 'Phone first'], ['device', 'Phone only'], ['cloud', 'Bookez credits']] as const).map(([value, label]) => <Pressable key={value} onPress={() => chooseProvider(value)} disabled={generating} style={[s.providerChoice, providerPreference === value && s.providerChoiceActive]} accessibilityRole="button" accessibilityState={{ selected: providerPreference === value }}><Text style={[s.providerChoiceText, providerPreference === value && s.providerChoiceTextActive]}>{label}</Text></Pressable>)}</View><Text style={s.providerHint}>{providerPreference === 'auto' ? available === null ? 'Checking phone AI. Cloud fallback protects the final 30% of credits.' : available ? 'Phone AI runs first for supported passages. Cloud fallback protects the final 30% of credits.' : 'Phone AI is unavailable here; cloud fallback protects the final 30% of credits.' : providerPreference === 'device' ? available ? 'On-device AI uses 0 Bookez credits. Phone model limits may still apply.' : availabilityReason || 'Phone AI is unavailable on this device.' : 'Bookez cloud uses the credits shown below, even if phone AI is available.'}</Text></View>
            <View style={s.contextCard}><View style={s.contextHeader}><View style={s.contextCopy}><Text style={s.fieldLabel}>CONTEXT</Text><Text style={s.contextDescription}>{contextModeDescription(resolvedContextMode)}</Text></View><Text style={s.contextCost}>{displayedProvider === 'device' ? '0 credits · phone' : `${aiUsageWeight(resolvedContextMode)} cloud credit${aiUsageWeight(resolvedContextMode) === 1 ? '' : 's'}`}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.contextPills}>{contextModes.map((mode) => <Pressable key={mode.value} onPress={() => { setContextMode(mode.value); setError(''); }} style={[s.contextPill, contextMode === mode.value && s.contextPillActive]} accessibilityRole="button" accessibilityState={{ selected: contextMode === mode.value }} accessibilityLabel={`${mode.label} context`}><Text style={[s.contextPillText, contextMode === mode.value && s.contextPillTextActive]}>{mode.label}</Text></Pressable>)}</ScrollView></View>

            {!selectedTool && <><Text style={s.sectionLabel}>COMMON TOOLS</Text><View style={s.toolGrid}>{primaryTools.map((item) => <Pressable key={item.key} onPress={() => openTool(item)} disabled={generating} style={[s.commonTool, generating && s.disabled]} accessibilityRole="button" accessibilityLabel={item.label}><BookezMysticIcon name={item.key} size={27} surface="parchment" /><Text style={s.commonToolText}>{item.label}</Text></Pressable>)}</View></>}

            {selectedTool && <View style={s.toolWorkspace}><View style={s.toolBackRow}><Pressable onPress={() => { setSelectedTool(null); setResponse(null); setError(''); }} accessibilityRole="button" accessibilityLabel="Back to AI assistant tools"><Text style={s.toolBack}>← All assistant tools</Text></Pressable></View><Text style={s.toolTitle}>{operationTitles[selectedTool.key]}</Text><Text style={s.toolHelp}>{operationHelp[selectedTool.key]}</Text>{selectedToolExample && <View style={s.exampleCard}><Text style={s.exampleLabel}>QUICK EXAMPLE</Text><Text style={s.exampleInput}>{selectedToolExample.input}</Text><Text style={s.exampleArrow}>↓</Text><Text style={s.exampleOutput}>{selectedToolExample.output}</Text></View>}{selectedTool.requiresText && <View style={s.scopeCard}><Text style={s.fieldLabel}>APPLY TO</Text>{hasSelection ? <View style={s.selectionSummary}><Text style={s.selectionDot}>●</Text><Text style={s.selectionText}>Selected text · {wordsIn(selectedPassage)} words</Text></View> : <View style={s.scopeChoices}><Pressable onPress={() => setScope('paragraph')} style={[s.scopeChoice, scope === 'paragraph' && s.scopeChoiceActive]} accessibilityRole="button" accessibilityState={{ selected: scope === 'paragraph' }}><Text style={[s.scopeChoiceText, scope === 'paragraph' && s.scopeChoiceTextActive]}>Current paragraph</Text></Pressable><Pressable onPress={() => setScope('page')} style={[s.scopeChoice, scope === 'page' && s.scopeChoiceActive]} accessibilityRole="button" accessibilityState={{ selected: scope === 'page' }}><Text style={[s.scopeChoiceText, scope === 'page' && s.scopeChoiceTextActive]}>Current page</Text></Pressable></View>}{!hasSelection && <Text style={s.scopeHint}>Choose a scope before Bookez changes a passage.</Text>}</View>}{selectedTool.key === 'rewrite' && <><Text style={s.fieldLabel}>CHOOSE A DIRECTION</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.styleChips}>{rewriteStyles.map((style) => <Pressable key={style} onPress={() => setInstruction(style)} style={[s.styleChip, instruction === style && s.styleChipActive]} accessibilityRole="button"><Text style={[s.styleChipText, instruction === style && s.styleChipTextActive]}>{style}</Text></Pressable>)}</ScrollView></>}{selectedTool.key === 'ask' && <><Text style={s.fieldLabel}>BOOK QUESTION</Text><TextInput value={assistantPrompt} onChangeText={(value) => { setAssistantPrompt(value); setInstruction(value); setError(''); }} multiline placeholder="Ask about characters, events, or continuity…" placeholderTextColor="#667A60" style={s.instruction} accessibilityLabel="Book-aware question" /></>}{selectedTool.key !== 'ask' && selectedTool.key !== 'rewrite' && selectedTool.key !== 'continue' && selectedTool.key !== 'brainstorm' && <Text style={s.toolTargetNote}>{canUseTextTool ? `${contextModeLabel(resolvedContextMode)} will use the selected scope. Nothing changes until you choose an action.` : 'Draft a little first, then choose a passage to work on.'}</Text>}{selectedTool.key !== 'ask' && <Pressable onPress={() => void generate()} disabled={generating || (selectedTool.requiresText && !canUseTextTool)} style={[s.generate, (generating || (selectedTool.requiresText && !canUseTextTool)) && s.disabled]} accessibilityRole="button"><Text style={s.generateText}>{selectedTool.key === 'brainstorm' ? 'Generate ideas' : 'Create preview'}</Text><Text style={s.generateArrow}>→</Text></Pressable>}{selectedTool.key === 'ask' && <Text style={s.bookAwareHint}>Ask Bookez above to get a grounded answer. It will say when the available book context is not enough to know.</Text>}</View>}

            {generating && <View style={s.loading}><ActivityIndicator color="#667A60" /><Text style={s.loadingText}>Reading the right context…</Text><Pressable onPress={cancelGeneration} accessibilityRole="button"><Text style={s.cancelText}>Cancel</Text></Pressable></View>}
            {error ? <View style={s.error}><Text style={s.errorTitle}>{deviceDoesNotSupportOnDeviceAI ? 'On-device AI isn’t available on this iPhone' : 'That request didn’t work'}</Text><Text style={s.errorText}>{error}</Text><View style={s.errorActions}>{!deviceDoesNotSupportOnDeviceAI && <Pressable onPress={() => void generate()} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable>}<Pressable onPress={() => setError('')} style={s.secondary}><Text style={s.secondaryText}>Dismiss</Text></Pressable></View></View> : null}
            {response?.ideas?.length ? <View style={s.results}>{response.ideas.map((idea, index) => <View key={`${idea.title}-${index}`} style={s.idea}><Text style={s.ideaNumber}>{String(index + 1).padStart(2, '0')}</Text><View style={s.ideaCopy}><Text style={s.ideaTitle}>{idea.title}</Text><Text style={s.ideaText}>{idea.detail}</Text><View style={s.inlineActions}><Pressable onPress={() => onUseAsNote(`${idea.title}: ${idea.detail}`)} accessibilityRole="button"><Text style={s.link}>Use as note</Text></Pressable><Pressable onPress={() => { setInstruction(`Explore: ${idea.title}`); void generate(undefined, `Explore this idea further: ${idea.title}`); }} accessibilityRole="button"><Text style={s.link}>Explore</Text></Pressable></View></View></View>)}</View> : null}
            {response?.feedback ? <View style={s.feedback}><Text style={s.feedbackLabel}>{resolvedContextMode === 'book-aware' ? 'BOOK-AWARE RESPONSE' : 'WRITING FEEDBACK'}</Text><Text style={s.feedbackText}>{response.feedback}</Text><Pressable onPress={() => void generate()} style={s.feedbackAgain} accessibilityRole="button"><Text style={s.plainActionText}>Ask again</Text></Pressable></View> : null}
            {response?.options?.length ? <View style={s.results}>{response.options.map((option, index) => <View key={`${index}-${option.slice(0, 16)}`} style={s.option}><Text style={s.optionLabel}>{selectedTool?.key === 'continue' ? `OPTION ${index + 1}` : 'PREVIEW'}</Text><Text style={s.optionText}>{option}</Text><View style={s.optionActions}>{selectedTool?.key === 'continue' ? <Pressable onPress={() => useInsert(option)} style={s.actionPrimary} accessibilityRole="button"><Text style={s.actionPrimaryText}>Insert</Text></Pressable> : <><Pressable onPress={() => useReplacement(option)} style={s.actionPrimary} accessibilityRole="button"><Text style={s.actionPrimaryText}>Replace</Text></Pressable><Pressable onPress={() => useInsert(option)} style={s.actionSecondary} accessibilityRole="button"><Text style={s.actionSecondaryText}>Insert below</Text></Pressable></>}<Pressable onPress={() => void generate()} style={s.plainAction} accessibilityRole="button"><Text style={s.plainActionText}>Try again</Text></Pressable></View></View>)}</View> : null}

            <View style={s.usageCard}><View style={s.usageHeader}><Text style={s.sectionLabel}>AI USAGE</Text><Text style={s.usageValue}>{usageRemaining} / {AI_USAGE_POLICY.monthlyCredits} credits left</Text></View><View style={s.usageTrack}><View style={[s.usageFill, { width: `${Math.round(usageProgress * 100)}%` }]} /></View><View style={s.usageMeta}><Text style={s.usageRefill}>{lastProvider === 'device' ? 'Last request: phone AI · 0 credits' : aiUsageRefillLabel()}</Text><Text style={s.usageWeights}>Page · {AI_USAGE_POLICY.weights.page}  Nearby · {AI_USAGE_POLICY.weights.nearby}  Book-aware · {AI_USAGE_POLICY.weights['book-aware']}</Text></View>{usageRemaining <= 8 && <Text style={s.usageWarning}>Only {usageRemaining} AI credit{usageRemaining === 1 ? '' : 's'} remain in this local estimate. Phone AI uses no Bookez credits.</Text>}</View>
            {available === false && <Text style={s.availability}>{availabilityReason.includes('requires a current Bookez app build') ? 'On-device AI is not available in this build. Bookez will use its authenticated cloud AI when needed.' : availabilityReason}</Text>}
            <Pressable onPress={() => setMoreOpen(true)} style={s.moreButton} accessibilityRole="button" accessibilityLabel="Open more writing tools"><Text style={s.moreButtonText}>More Writing Tools</Text><Text style={s.moreButtonArrow}>→</Text></Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal transparent animationType="fade" visible={moreOpen} onRequestClose={() => setMoreOpen(false)}>
      <View style={s.menuShade}><Pressable style={s.dismiss} onPress={() => setMoreOpen(false)} /><View style={[s.menu, editorial && editorialStyles.menu]}><View style={s.handle} /><Text style={[s.menuKicker, editorial && editorialStyles.menuKicker]}>MORE WRITING TOOLS</Text><Text style={[s.menuHint, editorial && editorialStyles.menuHint]}>Every existing writing tool is still here. Choose one to open it in the assistant.</Text>{moreTools.map((item) => <Pressable key={item.key} onPress={() => openTool(item)} style={[s.menuRow, editorial && editorialStyles.menuRow]} accessibilityRole="button" accessibilityLabel={item.label} accessibilityHint={operationSummaries[item.key]}><BookezMysticIcon name={item.key} size={32} surface="parchment" /><View style={s.menuCopy}><Text style={[s.menuText, editorial && editorialStyles.menuText]}>{item.label}</Text><Text numberOfLines={2} style={[s.menuDescription, editorial && editorialStyles.menuDescription]}>{operationSummaries[item.key]}</Text></View><Text style={[s.menuArrow, editorial && editorialStyles.menuArrow]}>›</Text></Pressable>)}</View></View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  launcherRow: { marginTop: 10 }, launcher: { minHeight: 52, paddingHorizontal: 11, borderRadius: 15, backgroundColor: 'rgba(255,248,238,0.82)', borderWidth: 1, borderColor: '#DDCDB5', flexDirection: 'row', alignItems: 'center' }, launcherIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, launcherIconText: { color: '#FFF8EE', fontSize: 14, fontWeight: '800' }, launcherCopy: { flex: 1, marginLeft: 9 }, launcherLabel: { color: '#667A60', fontSize: 11, fontWeight: '800' }, launcherHint: { color: '#667A60', fontSize: 8, marginTop: 2 }, launcherArrow: { color: '#667A60', fontSize: 17, paddingHorizontal: 5 }, compactLauncherRow: { width: 31, height: 31 }, compactLauncher: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#667A60', shadowColor: '#493F35', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, compactLauncherIcon: { color: '#FFF8EE', fontSize: 14, lineHeight: 17, fontWeight: '800' },
  introCard: { marginTop: 15, padding: 13, borderRadius: 16, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#667A60', flexDirection: 'row', alignItems: 'flex-start' }, introIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, introIconText: { color: '#FFF8EE', fontSize: 15, fontWeight: '800' }, introCopy: { flex: 1, minWidth: 0, marginLeft: 9, paddingRight: 6 }, introKicker: { color: '#667A60', fontSize: 7, letterSpacing: .8, fontWeight: '800' }, introTitle: { color: '#667A60', fontSize: 13, fontWeight: '800', marginTop: 3 }, introText: { color: '#667A60', fontSize: 9, lineHeight: 13, marginTop: 4 }, introDismiss: { minHeight: 28, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, introDismissText: { color: '#667A60', fontSize: 8, fontWeight: '800' },
  menuShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(19,36,61,0.24)' }, sheetShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(19,36,61,0.28)' }, dismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, handle: { width: 34, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: '#F9F4EA', marginBottom: 14 },
  sheet: { maxHeight: '92%', paddingTop: 20, paddingHorizontal: 20, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#F9F4EA', overflow: 'hidden' }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, sheetHeaderCopy: { flex: 1, paddingRight: 14 }, sheetKicker: { color: '#667A60', fontSize: 8, letterSpacing: 1, fontWeight: '800' }, sheetTitle: { color: '#667A60', fontSize: 23, fontWeight: '800', marginTop: 4 }, sheetSubtitle: { color: '#667A60', fontSize: 10, marginTop: 4 }, close: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#667A60', fontSize: 21, lineHeight: 24 }, sheetScroll: { flexGrow: 0 }, sheetContent: { paddingBottom: 34 },
  askCard: { marginTop: 15, padding: 13, borderRadius: 16, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#667A60' }, fieldLabel: { color: '#667A60', fontSize: 7, letterSpacing: .85, fontWeight: '800' }, askInput: { minHeight: 56, maxHeight: 106, marginTop: 8, padding: 0, color: '#667A60', fontSize: 13, lineHeight: 19, textAlignVertical: 'top' }, askFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, askHint: { flex: 1, color: '#667A60', fontSize: 8, lineHeight: 12, paddingRight: 8 }, askButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#F9F4EA', flexDirection: 'row', alignItems: 'center' }, askButtonText: { color: '#FFF8EE', fontSize: 9, fontWeight: '800' }, askButtonArrow: { color: '#FFF8EE', fontSize: 13, marginLeft: 5 }, disabled: { opacity: .42 }, promptChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }, promptChip: { minHeight: 28, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#DDCDB5', justifyContent: 'center' }, promptChipText: { color: '#667A60', fontSize: 8, fontWeight: '700' },
  providerCard: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: bookezColors.surfaceRaised, borderWidth: 1, borderColor: bookezColors.border },
  providerChoices: { flexDirection: 'row', gap: 5, marginTop: 9 },
  providerChoice: { flex: 1, minHeight: 34, paddingHorizontal: 3, borderRadius: 9, backgroundColor: bookezColors.surface, alignItems: 'center', justifyContent: 'center' },
  providerChoiceActive: { backgroundColor: bookezColors.accentStrong },
  providerChoiceText: { color: bookezColors.textPrimary, fontSize: 8, fontWeight: '800', textAlign: 'center' },
  providerChoiceTextActive: { color: bookezColors.textOnAccent },
  providerHint: { color: bookezColors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 8 },
  contextCard: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#DDCDB5' }, contextHeader: { flexDirection: 'row', alignItems: 'flex-start' }, contextCopy: { flex: 1, paddingRight: 8 }, contextDescription: { color: '#667A60', fontSize: 8, lineHeight: 12, marginTop: 4 }, contextCost: { color: '#667A60', fontSize: 8, fontWeight: '800' }, contextPills: { gap: 6, paddingTop: 10, paddingRight: 6 }, contextPill: { minHeight: 29, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#F9F4EA', justifyContent: 'center' }, contextPillActive: { backgroundColor: '#F9F4EA' }, contextPillText: { color: '#667A60', fontSize: 8, fontWeight: '800' }, contextPillTextActive: { color: '#FFF8EE' }, sectionLabel: { color: '#667A60', fontSize: 7, letterSpacing: .85, fontWeight: '800' }, toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }, commonTool: { width: '31.7%', minHeight: 61, paddingHorizontal: 6, borderRadius: 12, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#DDCDB5', alignItems: 'center', justifyContent: 'center' }, commonToolIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, commonToolIconText: { color: '#667A60', fontSize: 12, fontWeight: '800' }, commonToolText: { color: '#667A60', fontSize: 8, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  toolWorkspace: { marginTop: 14, padding: 13, borderRadius: 16, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#DDCDB5' }, toolBackRow: { minHeight: 25 }, toolBack: { color: '#667A60', fontSize: 9, fontWeight: '800' }, toolTitle: { color: '#667A60', fontSize: 18, fontWeight: '800', marginTop: 4 }, toolHelp: { color: '#667A60', fontSize: 10, lineHeight: 15, marginTop: 5 }, exampleCard: { marginTop: 12, padding: 11, borderRadius: 13, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#667A60' }, exampleLabel: { color: '#667A60', fontSize: 7, letterSpacing: .9, fontWeight: '800' }, exampleInput: { color: '#667A60', fontSize: 9, lineHeight: 14, marginTop: 6 }, exampleArrow: { color: '#667A60', fontSize: 12, marginVertical: 2 }, exampleOutput: { color: '#667A60', fontSize: 10, lineHeight: 15, fontWeight: '700' }, scopeCard: { marginTop: 13, paddingTop: 2 }, selectionSummary: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, selectionDot: { color: '#667A60', fontSize: 9, marginRight: 7 }, selectionText: { color: '#667A60', fontSize: 9, fontWeight: '700' }, scopeChoices: { flexDirection: 'row', gap: 7, marginTop: 8 }, scopeChoice: { minHeight: 34, flex: 1, paddingHorizontal: 8, borderRadius: 10, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, scopeChoiceActive: { backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#667A60' }, scopeChoiceText: { color: '#667A60', fontSize: 8, fontWeight: '700' }, scopeChoiceTextActive: { color: '#667A60' }, scopeHint: { color: '#667A60', fontSize: 8, marginTop: 6 }, styleChips: { gap: 7, paddingTop: 8, paddingRight: 8 }, styleChip: { paddingHorizontal: 10, minHeight: 31, borderRadius: 10, justifyContent: 'center', backgroundColor: '#F9F4EA' }, styleChipActive: { backgroundColor: '#F9F4EA' }, styleChipText: { color: '#667A60', fontSize: 9, fontWeight: '700' }, styleChipTextActive: { color: '#FFF8EE' }, instruction: { minHeight: 64, maxHeight: 106, marginTop: 8, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: '#DDCDB5', backgroundColor: '#F9F4EA', color: '#667A60', fontSize: 10, lineHeight: 15, textAlignVertical: 'top' }, toolTargetNote: { color: '#667A60', fontSize: 8, lineHeight: 12, marginTop: 12 }, bookAwareHint: { color: '#667A60', fontSize: 8, lineHeight: 12, marginTop: 12 },
  generate: { minHeight: 45, marginTop: 13, paddingHorizontal: 13, borderRadius: 13, backgroundColor: '#F9F4EA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, generateText: { color: '#FFF8EE', fontSize: 10, fontWeight: '800' }, generateArrow: { color: '#FFF8EE', fontSize: 17 }, loading: { minHeight: 58, marginTop: 13, borderRadius: 13, backgroundColor: '#F9F4EA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, loadingText: { color: '#667A60', fontSize: 9, fontWeight: '700' }, cancelText: { color: '#667A60', fontSize: 9, fontWeight: '800' }, error: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: '#F9F4EA' }, errorTitle: { color: '#667A60', fontSize: 10, fontWeight: '800' }, errorText: { color: '#667A60', fontSize: 9, lineHeight: 14, marginTop: 4 }, errorActions: { flexDirection: 'row', gap: 7, marginTop: 9 }, retry: { paddingHorizontal: 11, minHeight: 31, borderRadius: 10, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, retryText: { color: '#FFF8EE', fontSize: 9, fontWeight: '800' }, secondary: { paddingHorizontal: 11, minHeight: 31, borderRadius: 10, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#667A60', fontSize: 9, fontWeight: '800' },
  results: { marginTop: 13, gap: 8 }, option: { padding: 12, borderRadius: 14, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#DDCDB5' }, optionLabel: { color: '#667A60', fontSize: 7, letterSpacing: .85, fontWeight: '800' }, optionText: { color: '#667A60', fontSize: 10, lineHeight: 16, marginTop: 6 }, optionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10, alignItems: 'center' }, actionPrimary: { minHeight: 32, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, actionPrimaryText: { color: '#FFF8EE', fontSize: 9, fontWeight: '800' }, actionSecondary: { minHeight: 32, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#F9F4EA', alignItems: 'center', justifyContent: 'center' }, actionSecondaryText: { color: '#667A60', fontSize: 9, fontWeight: '800' }, plainAction: { paddingHorizontal: 4, minHeight: 30, justifyContent: 'center' }, plainActionText: { color: '#667A60', fontSize: 9, fontWeight: '700' }, idea: { padding: 11, borderRadius: 13, backgroundColor: '#F9F4EA', flexDirection: 'row', borderWidth: 1, borderColor: '#DDCDB5' }, ideaNumber: { color: '#667A60', fontSize: 9, fontWeight: '800' }, ideaCopy: { flex: 1, marginLeft: 9 }, ideaTitle: { color: '#667A60', fontSize: 10, fontWeight: '800' }, ideaText: { color: '#667A60', fontSize: 9, lineHeight: 14, marginTop: 3 }, inlineActions: { flexDirection: 'row', gap: 14, marginTop: 8 }, link: { color: '#667A60', fontSize: 9, fontWeight: '800' }, feedback: { padding: 12, marginTop: 13, borderRadius: 14, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#DDCDB5' }, feedbackLabel: { color: '#667A60', fontSize: 7, letterSpacing: .8, fontWeight: '800' }, feedbackText: { color: '#667A60', fontSize: 10, lineHeight: 16, marginTop: 6 }, feedbackAgain: { alignSelf: 'flex-start', minHeight: 29, justifyContent: 'center', marginTop: 6 },
  usageCard: { marginTop: 17, padding: 12, borderRadius: 14, backgroundColor: '#F9F4EA', borderWidth: 1, borderColor: '#DDCDB5' }, usageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, usageValue: { color: '#667A60', fontSize: 8, fontWeight: '800' }, usageTrack: { height: 6, marginTop: 9, borderRadius: 3, backgroundColor: '#F9F4EA', overflow: 'hidden' }, usageFill: { height: 6, borderRadius: 3, backgroundColor: '#F9F4EA' }, usageMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }, usageRefill: { color: '#667A60', fontSize: 8 }, usageWeights: { color: '#667A60', fontSize: 7, textAlign: 'right' }, usageWarning: { color: '#5B1830', fontSize: 8, lineHeight: 12, marginTop: 8 }, availability: { color: '#667A60', fontSize: 8, lineHeight: 12, marginTop: 10 }, moreButton: { minHeight: 42, marginTop: 10, borderRadius: 12, backgroundColor: '#F9F4EA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 }, moreButtonText: { color: '#667A60', fontSize: 10, fontWeight: '800' }, moreButtonArrow: { color: '#667A60', fontSize: 16 },
  menu: { padding: 18, paddingBottom: 28, borderTopLeftRadius: 27, borderTopRightRadius: 27, backgroundColor: '#F9F4EA' }, menuKicker: { color: '#667A60', fontSize: 8, letterSpacing: 1, fontWeight: '800' }, menuHint: { color: '#667A60', fontSize: 9, lineHeight: 13, marginTop: 5, marginBottom: 8 }, menuRow: { minHeight: 65, borderTopWidth: 1, borderTopColor: '#DDCDB5', flexDirection: 'row', alignItems: 'center' }, menuIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F4EA' }, menuIconText: { color: '#667A60', fontSize: 13, fontWeight: '800' }, menuCopy: { flex: 1, marginLeft: 10, marginRight: 6 }, menuText: { color: '#667A60', fontSize: 11, fontWeight: '700' }, menuDescription: { color: '#667A60', fontSize: 8, lineHeight: 12, marginTop: 2 }, menuArrow: { color: '#667A60', fontSize: 20 },
});

const aiStyleMap = s as unknown as Record<string, unknown>;
Object.entries({
  launcher: { backgroundColor: bookezColors.accentSoft, borderColor: bookezColors.border },
  launcherIcon: { backgroundColor: bookezColors.accent },
  launcherIconText: { color: bookezColors.textOnAccent },
  launcherLabel: { color: bookezColors.textPrimary },
  launcherHint: { color: bookezColors.textSecondary },
  launcherArrow: { color: bookezColors.secondaryAccent },
  compactLauncher: { backgroundColor: bookezColors.accentStrong, borderColor: bookezColors.border, shadowColor: '#493F35' },
  compactLauncherIcon: { color: bookezColors.textOnAccent },
  introCard: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  introIcon: { backgroundColor: bookezColors.accent },
  introIconText: { color: bookezColors.textOnAccent },
  introKicker: { color: bookezColors.secondaryAccent },
  introTitle: { color: bookezColors.textPrimary },
  introText: { color: bookezColors.textSecondary },
  introDismiss: { backgroundColor: bookezColors.surfaceMuted, borderWidth: 1, borderColor: bookezColors.border },
  introDismissText: { color: bookezColors.textPrimary },
  menuShade: { backgroundColor: 'rgba(19,36,61,0.24)' },
  sheetShade: { backgroundColor: 'rgba(19,36,61,0.24)' },
  handle: { backgroundColor: bookezColors.manuscriptEdge },
  sheet: { backgroundColor: bookezColors.surface },
  sheetKicker: { color: bookezColors.secondaryAccent },
  sheetTitle: { color: bookezColors.textPrimary },
  sheetSubtitle: { color: bookezColors.textSecondary },
  close: { backgroundColor: bookezColors.surfaceMuted, borderWidth: 1, borderColor: bookezColors.border },
  closeText: { color: bookezColors.textPrimary },
  askCard: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  fieldLabel: { color: bookezColors.secondaryAccent },
  askInput: { color: bookezColors.textPrimary },
  askHint: { color: bookezColors.textSecondary },
  askButton: { backgroundColor: bookezColors.accentStrong },
  askButtonText: { color: bookezColors.textOnAccent },
  askButtonArrow: { color: bookezColors.textOnAccent },
  promptChip: { backgroundColor: bookezColors.surfaceMuted, borderColor: bookezColors.border },
  promptChipText: { color: bookezColors.textSecondary },
  contextCard: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  contextDescription: { color: bookezColors.textSecondary },
  contextCost: { color: bookezColors.secondaryAccent },
  contextPill: { backgroundColor: bookezColors.surfaceMuted },
  contextPillActive: { backgroundColor: bookezColors.accent },
  contextPillText: { color: bookezColors.textSecondary },
  contextPillTextActive: { color: bookezColors.textOnAccent },
  commonTool: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  commonToolIcon: { backgroundColor: bookezColors.accentSoft },
  commonToolIconText: { color: bookezColors.secondaryAccent },
  commonToolText: { color: bookezColors.textPrimary },
  toolWorkspace: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  toolBack: { color: bookezColors.secondaryAccent },
  toolTitle: { color: bookezColors.textPrimary },
  toolHelp: { color: bookezColors.textSecondary },
  exampleCard: { backgroundColor: bookezColors.surfaceAccent, borderColor: bookezColors.border },
  exampleLabel: { color: bookezColors.secondaryAccent },
  exampleInput: { color: bookezColors.textSecondary },
  exampleArrow: { color: bookezColors.secondaryAccent },
  exampleOutput: { color: bookezColors.textPrimary },
  selectionDot: { color: bookezColors.secondaryAccent },
  selectionText: { color: bookezColors.textPrimary },
  scopeChoice: { backgroundColor: bookezColors.surfaceMuted },
  scopeChoiceActive: { backgroundColor: bookezColors.accentSoft, borderColor: bookezColors.secondaryAccent },
  scopeChoiceText: { color: bookezColors.textSecondary },
  scopeChoiceTextActive: { color: bookezColors.textPrimary },
  scopeHint: { color: bookezColors.textMuted },
  styleChip: { backgroundColor: bookezColors.surfaceMuted },
  styleChipActive: { backgroundColor: bookezColors.accent },
  styleChipText: { color: bookezColors.textSecondary },
  styleChipTextActive: { color: bookezColors.textOnAccent },
  instruction: { backgroundColor: bookezColors.surfaceMuted, borderColor: bookezColors.border, color: bookezColors.textPrimary },
  toolTargetNote: { color: bookezColors.textSecondary },
  bookAwareHint: { color: bookezColors.textSecondary },
  generate: { backgroundColor: bookezColors.accentStrong },
  generateText: { color: bookezColors.textOnAccent },
  generateArrow: { color: bookezColors.textOnAccent },
  loading: { backgroundColor: bookezColors.surfaceAccent },
  loadingText: { color: bookezColors.textSecondary },
  cancelText: { color: bookezColors.secondaryAccent },
  error: { backgroundColor: bookezColors.destructiveSoft },
  errorTitle: { color: bookezColors.textPrimary },
  errorText: { color: bookezColors.textSecondary },
  retry: { backgroundColor: bookezColors.accentStrong },
  secondary: { backgroundColor: bookezColors.surfaceMuted, borderWidth: 1, borderColor: bookezColors.border },
  secondaryText: { color: bookezColors.textPrimary },
  option: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  optionLabel: { color: bookezColors.secondaryAccent },
  optionText: { color: bookezColors.textPrimary },
  actionPrimary: { backgroundColor: bookezColors.accentStrong },
  actionPrimaryText: { color: bookezColors.textOnAccent },
  actionSecondary: { backgroundColor: bookezColors.accentSoft },
  actionSecondaryText: { color: bookezColors.textPrimary },
  plainActionText: { color: bookezColors.secondaryAccent },
  idea: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  ideaNumber: { color: bookezColors.secondaryAccent },
  ideaTitle: { color: bookezColors.textPrimary },
  ideaText: { color: bookezColors.textSecondary },
  link: { color: bookezColors.secondaryAccent },
  feedback: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  feedbackLabel: { color: bookezColors.secondaryAccent },
  feedbackText: { color: bookezColors.textPrimary },
  usageCard: { backgroundColor: bookezColors.surfaceMuted, borderColor: bookezColors.border },
  usageValue: { color: bookezColors.textPrimary },
  usageTrack: { backgroundColor: bookezColors.surfaceAccent },
  usageFill: { backgroundColor: bookezColors.secondaryAccent },
  usageRefill: { color: bookezColors.textSecondary },
  usageWeights: { color: bookezColors.secondaryAccent },
  usageWarning: { color: bookezColors.warning },
  availability: { color: bookezColors.textSecondary },
  moreButton: { backgroundColor: bookezColors.accentSoft },
  moreButtonText: { color: bookezColors.textPrimary },
  moreButtonArrow: { color: bookezColors.secondaryAccent },
  menu: { backgroundColor: bookezColors.surface },
  menuKicker: { color: bookezColors.secondaryAccent },
  menuHint: { color: bookezColors.textSecondary },
  menuRow: { borderTopColor: bookezColors.divider },
  menuIcon: { backgroundColor: bookezColors.accentSoft },
  menuIconText: { color: bookezColors.secondaryAccent },
  menuText: { color: bookezColors.textPrimary },
  menuDescription: { color: bookezColors.textSecondary },
  menuArrow: { color: bookezColors.secondaryAccent },
}).forEach(([key, override]) => {
  aiStyleMap[key] = [aiStyleMap[key], override];
});

const editorialStyles = StyleSheet.create({
  launcher: { backgroundColor: bookezColors.accentSoft, borderColor: bookezColors.burgundySoft },
  launcherIcon: { backgroundColor: bookezColors.accent },
  compactLauncher: { backgroundColor: bookezColors.accentStrong, borderColor: bookezColors.accent },
  compactLauncherIcon: { color: bookezColors.textOnAccent },
  sheetShade: { backgroundColor: 'rgba(19,36,61,0.28)' },
  sheet: { backgroundColor: bookezColors.surface, borderTopLeftRadius: bookezRadii.sheet, borderTopRightRadius: bookezRadii.sheet, ...bookezShadows.lifted },
  sheetKicker: { color: bookezColors.secondaryAccent },
  sheetTitle: { color: bookezColors.textPrimary, fontFamily: bookezType.pageTitle.fontFamily, fontWeight: '600' },
  sheetSubtitle: { color: bookezColors.textSecondary, fontFamily: bookezType.bodySecondary.fontFamily },
  close: { backgroundColor: bookezColors.surfaceMuted, borderWidth: 1, borderColor: bookezColors.border },
  menu: { backgroundColor: bookezColors.surface, borderTopLeftRadius: bookezRadii.sheet, borderTopRightRadius: bookezRadii.sheet, ...bookezShadows.lifted },
  menuKicker: { color: bookezColors.secondaryAccent },
  menuHint: { color: bookezColors.textSecondary },
  menuRow: { borderTopColor: bookezColors.divider },
  menuIcon: { backgroundColor: bookezColors.accentSoft },
  menuIconText: { color: bookezColors.accent },
  menuText: { color: bookezColors.textPrimary, fontFamily: bookezType.cardTitle.fontFamily },
  menuDescription: { color: bookezColors.textSecondary },
  menuArrow: { color: bookezColors.accent },
});
