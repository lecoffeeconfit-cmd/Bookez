import { useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export type WriteToolBeltId = 'top' | 'bottom';

export type WriteToolDefinition = {
  id: string;
  name: string;
  shortName: string;
  belt: WriteToolBeltId;
  availableIn: WriteToolBeltId[];
  icon: string;
  color: string;
  description: string;
  howToUse: string;
  example?: string;
};

export type WriteToolBeltConfig = {
  top: string[];
  bottom: string[];
};

export const WRITE_TOOL_DEFAULTS: WriteToolBeltConfig = {
  top: ['continue', 'make-clearer', 'rewrite'],
  bottom: ['writing-stats', 'writing-rhythm', 'context'],
};

export const WRITE_TOOL_BELT_STORAGE_KEY = 'bookez.write.tool-belts.v1';
const maxPinnedTools = 6;

const topTools: WriteToolDefinition[] = [
  { id: 'ai-writing', name: 'AI Writing', shortName: 'AI', belt: 'top', availableIn: ['top'], icon: '✦', color: '#817BDE', description: 'Explore ideas, drafts, and helpful writing options with AI.', howToUse: 'Tap AI Writing when you want a preview, a new direction, or feedback before changing your manuscript.', example: 'Ask for three possible ways to continue a scene.' },
  { id: 'polish', name: 'Polish', shortName: 'Polish', belt: 'top', availableIn: ['top'], icon: '✧', color: '#D4A63A', description: 'Smooth rough sentences while keeping your meaning and voice.', howToUse: 'Tap Polish after a rough drafting pass for a quick local cleanup.', example: 'Use Polish after dictating a page of ideas.' },
  { id: 'grammar', name: 'Grammar', shortName: 'Grammar', belt: 'top', availableIn: ['top'], icon: 'Aa', color: '#716CC4', description: 'Check this part for grammar, punctuation, and sentence issues.', howToUse: 'Tap Grammar after drafting to clean up obvious errors without rewriting your ideas.', example: 'Use Grammar after dictating a rough section.' },
  { id: 'dictation', name: 'Dictation', shortName: 'Dictate', belt: 'top', availableIn: ['top'], icon: '◉', color: '#5C9DD7', description: 'Speak your draft when your ideas are moving faster than your fingers.', howToUse: 'Tap the microphone in the manuscript field, then speak naturally and edit the text afterward.', example: 'Dictate the first pass of a scene while walking.' },
  { id: 'help-me-write', name: 'Help Me Write', shortName: 'Help', belt: 'top', availableIn: ['top'], icon: '✦', color: '#827BE0', description: 'Keep a useful question beside the part you are drafting.', howToUse: 'Choose a prompt when you feel stuck; Bookez helps you find the next step without writing the part for you.', example: 'Ask what changes by the end of this section.' },
  { id: 'writing-compass', name: 'Writing Compass', shortName: 'Compass', belt: 'top', availableIn: ['top'], icon: '⌁', color: '#6FAED2', description: 'Get guidance based on your plan, notes, and current draft.', howToUse: 'Use Compass when you need to know what belongs here, what to do next, and what to keep in mind.', example: 'Refresh Compass when the draft has moved into a new direction.' },
  { id: 'private-notes', name: 'Private Notes', shortName: 'Notes', belt: 'top', availableIn: ['top', 'bottom'], icon: '✎', color: '#B29BCB', description: 'Keep your own thoughts and reminders beside this part.', howToUse: 'Capture ideas, questions, or details you want to remember without putting them in the manuscript yet.', example: 'Note a detail you want to weave into the next scene.' },
  { id: 'context', name: 'Context', shortName: 'Context', belt: 'bottom', availableIn: ['top', 'bottom'], icon: '◈', color: '#8C9FC1', description: 'Review the plan, earlier notes, and nearby writing for this part.', howToUse: 'Open Context when you need the surrounding material without leaving the editor.', example: 'Check the throughline before drafting the next section.' },
  { id: 'outline-peek', name: 'Outline Peek', shortName: 'Outline', belt: 'top', availableIn: ['top'], icon: '☷', color: '#6FAF9E', description: 'Take a quick look at the structure that supports this part.', howToUse: 'Use Outline Peek before drafting to remember the role this part plays in the whole work.', example: 'Review the next two parts before writing a transition.' },
  { id: 'storyboard', name: 'Storyboard', shortName: 'Board', belt: 'top', availableIn: ['top'], icon: '▦', color: '#D8879A', description: 'See the order of ideas, scenes, or beats at a glance.', howToUse: 'Use Storyboard when you want to think about sequence before polishing sentences.', example: 'Move the turning point earlier in the chapter plan.' },
  { id: 'brainstorm', name: 'Brainstorm', shortName: 'Ideas', belt: 'top', availableIn: ['top'], icon: '◌', color: '#A489D6', description: 'Open a small space for possible directions and angles.', howToUse: 'Use Brainstorm when you know the topic but not the next angle.', example: 'List three ways a character could respond to the news.' },
  { id: 'character-notes', name: 'Character Notes', shortName: 'Characters', belt: 'top', availableIn: ['top'], icon: '♧', color: '#D58A9A', description: 'Keep motivations, details, and voice cues close while you write.', howToUse: 'Use Character Notes to remember what a person wants and what they would notice here.', example: 'Record the secret a character is trying not to reveal.' },
  { id: 'timeline', name: 'Timeline', shortName: 'Timeline', belt: 'top', availableIn: ['top'], icon: '↝', color: '#70AFA0', description: 'Keep events, dates, or stages in the right order.', howToUse: 'Use Timeline when the sequence matters more than the sentence you are on.', example: 'Check whether the flashback happens before the move.' },
  { id: 'plot-threads', name: 'Plot Threads', shortName: 'Threads', belt: 'top', availableIn: ['top'], icon: '∞', color: '#718BB7', description: 'Remember which questions and promises are still in motion.', howToUse: 'Use Plot Threads to keep a scene connected to the larger throughline.', example: 'Note which unanswered question this part advances.' },
  { id: 'scene-beats', name: 'Scene Beats', shortName: 'Beats', belt: 'top', availableIn: ['top'], icon: '◒', color: '#C58D73', description: 'Break a scene into a few clear movements.', howToUse: 'Use Scene Beats when a section feels too large to enter.', example: 'Set up the want, interruption, choice, and consequence.' },
  { id: 'research', name: 'Research', shortName: 'Research', belt: 'top', availableIn: ['top'], icon: '⌕', color: '#6E9F9B', description: 'Keep a question or source need visible while drafting.', howToUse: 'Use Research to mark what needs checking instead of stopping the writing flow.', example: 'Leave a note to verify the year before the final pass.' },
  { id: 'sources', name: 'Sources', shortName: 'Sources', belt: 'top', availableIn: ['top'], icon: '↗', color: '#688FA5', description: 'Review the references connected to this project.', howToUse: 'Use Sources when you need to check a citation or return to a saved reference.', example: 'Confirm the source details before writing a claim.' },
  { id: 'continuity-check', name: 'Continuity Check', shortName: 'Continuity', belt: 'top', availableIn: ['top'], icon: '✓', color: '#6A9D83', description: 'Keep an eye on details that need to remain consistent.', howToUse: 'Use Continuity Check before moving on from a section with many linked details.', example: 'Verify a character’s name, age, or location.' },
  { id: 'rewrite', name: 'Rewrite', shortName: 'Rewrite', belt: 'top', availableIn: ['top'], icon: '↻', color: '#8E80CC', description: 'Try a different version of a passage without losing the original.', howToUse: 'Use Rewrite when the idea is right but the current wording is not landing.', example: 'Try a more direct or more emotional version.' },
  { id: 'expand', name: 'Expand', shortName: 'Expand', belt: 'top', availableIn: ['top'], icon: '＋', color: '#9A86C9', description: 'Develop a promising idea into a fuller passage.', howToUse: 'Use Expand when a thought needs more context, detail, or room to breathe.', example: 'Add sensory detail to a short scene opening.' },
  { id: 'continue', name: 'Continue', shortName: 'Continue', belt: 'top', availableIn: ['top'], icon: '→', color: '#7A9CD0', description: 'Generate a few possible next steps from the end of your draft.', howToUse: 'Use Continue when you want options, then choose what belongs in your own voice.', example: 'Ask for three possible next moments after a discovery.' },
  { id: 'simplify', name: 'Simplify', shortName: 'Simplify', belt: 'top', availableIn: ['top'], icon: '−', color: '#7BA7BC', description: 'Make a passage easier to follow while keeping its point.', howToUse: 'Use Simplify when a sentence or paragraph feels heavier than it needs to be.', example: 'Untangle a long explanation before the reader loses the thread.' },
  { id: 'make-clearer', name: 'Improve', shortName: 'Improve', belt: 'top', availableIn: ['top'], icon: '◇', color: '#729BB7', description: 'Improve clarity without flattening your voice.', howToUse: 'Use Improve when you understand the idea but worry a reader may not.', example: 'Clarify what “it” refers to in a dense paragraph.' },
  { id: 'dialogue-help', name: 'Dialogue Help', shortName: 'Dialogue', belt: 'top', availableIn: ['top'], icon: '“', color: '#C9859B', description: 'Think through what a speaker wants, avoids, or says next.', howToUse: 'Use Dialogue Help when a conversation feels stiff or too direct.', example: 'Find a line that lets a character dodge the real question.' },
  { id: 'description-help', name: 'Description Help', shortName: 'Description', belt: 'top', availableIn: ['top'], icon: '☼', color: '#B58E6A', description: 'Find specific, grounded details that make a moment visible.', howToUse: 'Use Description Help when a place or feeling needs sharper detail.', example: 'Choose two sensory details for a quiet kitchen at night.' },
];

const bottomTools: WriteToolDefinition[] = [
  { id: 'writing-stats', name: 'Writing Stats', shortName: 'Stats', belt: 'bottom', availableIn: ['bottom'], icon: '◷', color: '#827BE0', description: 'Keep words, sentences, paragraphs, letters, and writing time together.', howToUse: 'Open Writing Stats for one compact view of the current section and session.', example: 'Check your words and active time after a drafting block.' },
  { id: 'writing-rhythm', name: 'Writing Rhythm', shortName: 'Rhythm', belt: 'bottom', availableIn: ['bottom'], icon: '◌', color: '#A69DCA', description: 'Shape a focused block with sprint, Pomodoro, custom, or flow sessions.', howToUse: 'Open Writing Rhythm to choose a session style and start, pause, or finish the timer.', example: 'Choose Pomodoro when a clear 25-minute container will help.' },
  { id: 'focus-mode', name: 'Focus Mode', shortName: 'Focus mode', belt: 'bottom', availableIn: ['bottom'], icon: '☾', color: '#626EAE', description: 'Hide writing distractions and let the manuscript take the lead.', howToUse: 'Turn Focus Mode on for a quieter writing surface, then turn it off when you need the full cockpit again.', example: 'Use it during a first-draft sprint.' },
  { id: 'goal-meter', name: 'Goal Meter', shortName: 'Goal', belt: 'bottom', availableIn: ['bottom'], icon: '▰', color: '#599BC3', description: 'Keep session, day, section, and manuscript progress in view.', howToUse: 'Open Goal Meter to choose a useful target and see your progress toward it.', example: 'Set a 300-word session goal before drafting.' },
  { id: 'version-history', name: 'Version History', shortName: 'Versions', belt: 'bottom', availableIn: ['bottom'], icon: '◇', color: '#6D9AAB', description: 'Save checkpoints and compare earlier drafts before a major change.', howToUse: 'Save a version before rewriting, then open Version History to review or compare checkpoints.', example: 'Capture the original ending before trying a new one.' },
  { id: 'session-log', name: 'Session Log', shortName: 'Log', belt: 'bottom', availableIn: ['bottom'], icon: '▤', color: '#7DAA9D', description: 'Record what you finished, what you learned, and where to resume.', howToUse: 'Finish a session with one next step so returning to the manuscript feels easy.', example: 'Next: “Have Maya open the envelope.”' },
  { id: 'add-visual', name: 'Add Visual', shortName: 'Visual', belt: 'bottom', availableIn: ['bottom'], icon: '＋', color: '#8B9CBF', description: 'Keep a photo or visual reference beside this part.', howToUse: 'Use Add Visual when an image will help you remember, plan, or shape the section.', example: 'Add a reference image for a setting you are describing.' },
  { id: 'read-aloud', name: 'Read Aloud', shortName: 'Read aloud', belt: 'bottom', availableIn: ['bottom'], icon: '♫', color: '#8A82D6', description: 'Hear the current section back to catch rhythm, missing words, and awkward dialogue.', howToUse: 'Tap Read Aloud to listen to the current section with the device voice.', example: 'Listen once after a dialogue pass.' },
  { id: 'repetition-scan', name: 'Repetition Scan', shortName: 'Repetition', belt: 'bottom', availableIn: ['bottom'], icon: '↻', color: '#C8878B', description: 'Spot repeated words, phrases, sentence starts, filler words, and long sentences.', howToUse: 'Run Repetition Scan after drafting to decide what deserves a closer look.', example: 'Notice “actually” appearing eleven times before revising.' },
  { id: 'reference-shelf', name: 'Reference Shelf', shortName: 'References', belt: 'bottom', availableIn: ['bottom'], icon: '⌕', color: '#6E9F9B', description: 'Pin research, characters, places, links, images, quotes, and earlier sections nearby.', howToUse: 'Add small reference cards to keep useful material beside the current part.', example: 'Pin a character detail and a source link before drafting.' },
  { id: 'find-across-book', name: 'Find Across Book', shortName: 'Find', belt: 'bottom', availableIn: ['bottom'], icon: '🔎', color: '#688FA5', description: 'Find a word or phrase across every drafted part and optionally replace it after confirmation.', howToUse: 'Search the whole book, review the part counts, then use Replace only after checking the results.', example: 'Find every mention of “blue sedan” before changing a detail.' },
  { id: 'section-brief', name: 'Section / Scene Brief', shortName: 'Brief', belt: 'bottom', availableIn: ['bottom'], icon: '📌', color: '#D09B48', description: 'Keep the purpose, context, conflict, and must-happen beats visible.', howToUse: 'Fill in the brief before or during a section so the draft has a clear job.', example: 'Set the scene purpose and three beats before writing.' },
  { id: 'outline-navigator', name: 'Outline Navigator', shortName: 'Outline', belt: 'bottom', availableIn: ['bottom'], icon: '☷', color: '#6FAF9E', description: 'Jump instantly between the parts, chapters, scenes, and sections of the book.', howToUse: 'Open Outline Navigator and tap any part to move there without leaving Write.', example: 'Jump from the opening to Chapter 8 to check a detail.' },
  { id: 'continuity-tracker', name: 'Continuity Tracker', shortName: 'Continuity', belt: 'bottom', availableIn: ['bottom'], icon: '✓', color: '#6A9D83', description: 'Keep a living list of details, promises, and unresolved threads to verify.', howToUse: 'Add a continuity item when the manuscript introduces a fact or leaves a promise to resolve.', example: 'Track a character detail or an unanswered voicemail.' },
  { id: 'writing-flags', name: 'Writing Flags', shortName: 'Flags', belt: 'bottom', availableIn: ['bottom'], icon: '⚑', color: '#D09B48', description: 'Mark a passage to revisit without interrupting your drafting flow.', howToUse: 'Select text in your manuscript, tap the small flag, then use this panel to review, resolve, or reopen your reminders.', example: 'Flag a sentence to fact-check during your next revision.' },
];

export const WRITE_TOOL_LIBRARY = [...topTools, ...bottomTools];

function findTool(id: string) {
  return WRITE_TOOL_LIBRARY.find((tool) => tool.id === id);
}

const toolAliases: Record<string, string> = {
  'sprint-timer': 'writing-rhythm', 'focus-session': 'writing-rhythm', pomodoro: 'writing-rhythm', 'custom-timer': 'writing-rhythm',
  'word-count': 'writing-stats', 'letter-count': 'writing-stats', 'sentence-count': 'writing-stats', 'paragraph-count': 'writing-stats', 'writing-time': 'writing-stats', 'reading-time': 'writing-stats',
  'session-pace': 'goal-meter', streak: 'goal-meter', progress: 'goal-meter', 'daily-target': 'goal-meter',
  snapshot: 'version-history', 'compare-draft': 'version-history', 'session-notes': 'session-log', 'resume-point': 'session-log',
  'outline-peek': 'outline-navigator', 'continuity-check': 'continuity-tracker', sources: 'reference-shelf',
};

export function sanitizeWriteToolBeltConfig(value: unknown): WriteToolBeltConfig {
  const candidate = value && typeof value === 'object' ? value as Partial<WriteToolBeltConfig> : {};
  const sanitize = (ids: unknown, belt: WriteToolBeltId) => {
    const source: string[] = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string').map((id) => {
      const alias = toolAliases[id];
      return alias && findTool(alias)?.availableIn.includes(belt) ? alias : id;
    }) : [...WRITE_TOOL_DEFAULTS[belt]];
    return Array.from(new Set(source.filter((id) => Boolean(findTool(id)) && Boolean(findTool(id)?.availableIn.includes(belt))))).slice(0, maxPinnedTools);
  };
  const top = sanitize(candidate.top, 'top');
  const bottom = sanitize(candidate.bottom, 'bottom');
  return { top, bottom };
}

type ToolIconProps = { tool: WriteToolDefinition; size?: 'small' | 'large'; style?: StyleProp<ViewStyle> };

function ToolIcon({ tool, size = 'large', style }: ToolIconProps) {
  return <View style={[size === 'large' ? styles.toolIconLarge : styles.toolIconSmall, { backgroundColor: tool.color }, style]}><Text style={[size === 'large' ? styles.toolIconTextLarge : styles.toolIconTextSmall, tool.icon.length > 1 && styles.toolIconTextCompact]}>{tool.icon}</Text></View>;
}

function ToolTile({ tool, active, onPress, onLongPress }: { tool: WriteToolDefinition; active: boolean; onPress: () => void; onLongPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: true, speed: 22, bounciness: 3 }).start();
  return <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={480} onPressIn={() => animate(0.95)} onPressOut={() => animate(1)} style={[styles.toolTile, active && styles.toolTileActive]} accessibilityRole="button" accessibilityLabel={tool.name} accessibilityHint={`${tool.description} Long press to customize tool order.`}>
    <Animated.View style={{ transform: [{ scale }] }}><ToolIcon tool={tool} /></Animated.View>
    <Text numberOfLines={2} style={[styles.toolTileText, active && styles.toolTileTextActive]}>{tool.shortName}</Text>
  </Pressable>;
}

function DraggableToolRow({ tool, index, active, onPress, onRemove, onReplace, onMove, onReorder }: { tool: WriteToolDefinition; index: number; active: boolean; onPress: () => void; onRemove: () => void; onReplace: () => void; onMove?: () => void; onReorder: (from: number, to: number) => void }) {
  const dragY = useRef(new Animated.Value(0)).current;
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 7,
    onPanResponderMove: (_, gesture) => dragY.setValue(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      const distance = Math.round(gesture.dy / 56);
      if (distance) onReorder(index, Math.max(0, Math.min(5, index + distance)));
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 2 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start(),
  }), [dragY, index, onReorder]);
  return <Animated.View style={[styles.pinnedRow, active && styles.pinnedRowActive, { transform: [{ translateY: dragY }] }]}>
    <View {...responder.panHandlers} style={styles.dragHandle} accessible accessibilityLabel={`Drag ${tool.name} to reorder`}><Text style={styles.dragHandleText}>⋮⋮</Text></View>
    <Pressable onPress={onPress} style={styles.pinnedRowMain} accessibilityRole="button" accessibilityLabel={`Preview ${tool.name}`}><ToolIcon tool={tool} size="small" /><View style={styles.pinnedRowCopy}><Text style={styles.pinnedRowTitle}>{tool.name}</Text><Text numberOfLines={1} style={styles.pinnedRowDescription}>{tool.description}</Text></View></Pressable>
    {onMove && <Pressable onPress={onMove} style={styles.rowAction} accessibilityRole="button" accessibilityLabel={`Move ${tool.name} to the other tool belt`}><Text style={styles.rowActionText}>⇄</Text></Pressable>}
    <Pressable onPress={onReplace} style={styles.rowAction} accessibilityRole="button" accessibilityLabel={`Replace ${tool.name}`}><Text style={styles.rowActionText}>↻</Text></Pressable>
    <Pressable onPress={onRemove} style={[styles.rowAction, styles.rowActionRemove]} accessibilityRole="button" accessibilityLabel={`Remove ${tool.name}`}><Text style={[styles.rowActionText, styles.rowActionRemoveText]}>×</Text></Pressable>
  </Animated.View>;
}

type WriteToolBeltProps = {
  belt: WriteToolBeltId;
  config: WriteToolBeltConfig;
  onConfigChange: (config: WriteToolBeltConfig) => void;
  activeToolIds?: string[];
  onToolPress: (tool: WriteToolDefinition) => void;
};

export default function WriteToolBelt({ belt, config, onConfigChange, activeToolIds = [], onToolPress }: WriteToolBeltProps) {
  const [manageBelt, setManageBelt] = useState<WriteToolBeltId | null>(null);
  const [editing, setEditing] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const openManager = (nextBelt: WriteToolBeltId, edit = false) => {
    setManageBelt(nextBelt); setEditing(edit); setReplaceIndex(null); setDetailId(null);
  };
  const closeManager = () => { setManageBelt(null); setEditing(false); setReplaceIndex(null); setDetailId(null); };
  const currentIds = manageBelt ? config[manageBelt] : [];
  const currentTools = currentIds.map(findTool).filter((tool): tool is WriteToolDefinition => Boolean(tool));
  const availableTools = manageBelt ? WRITE_TOOL_LIBRARY.filter((tool) => tool.availableIn.includes(manageBelt)) : [];
  const updateBelt = (nextBelt: WriteToolBeltId, ids: string[]) => onConfigChange({ ...config, [nextBelt]: Array.from(new Set(ids)).slice(0, maxPinnedTools) });
  const toggleTool = (tool: WriteToolDefinition) => {
    if (!manageBelt) return;
    const ids = config[manageBelt];
    if (replaceIndex !== null) {
      const next = ids.filter((id, index) => index !== replaceIndex && id !== tool.id);
      next.splice(Math.min(replaceIndex, next.length), 0, tool.id);
      updateBelt(manageBelt, next);
      setReplaceIndex(null);
      setEditing(false);
      setDetailId(tool.id);
      return;
    }
    if (ids.includes(tool.id)) {
      updateBelt(manageBelt, ids.filter((id) => id !== tool.id));
      return;
    }
    if (ids.length >= maxPinnedTools) {
      Alert.alert(`${manageBelt === 'top' ? 'Writing' : 'Session'} belt is full`, 'Remove a pinned tool or choose Replace before adding another.');
      return;
    }
    updateBelt(manageBelt, [...ids, tool.id]);
    setDetailId(tool.id);
  };
  const reorder = (from: number, to: number) => {
    if (!manageBelt || from === to) return;
    const next = [...config[manageBelt]];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateBelt(manageBelt, next);
  };
  const moveTool = (tool: WriteToolDefinition) => {
    if (!manageBelt) return;
    const targetBelt: WriteToolBeltId = manageBelt === 'top' ? 'bottom' : 'top';
    if (!tool.availableIn.includes(targetBelt)) return;
    if (config[targetBelt].length >= maxPinnedTools) {
      Alert.alert(`${targetBelt === 'top' ? 'Writing' : 'Session'} belt is full`, 'Remove a pinned tool there before moving this one.');
      return;
    }
    onConfigChange({ ...config, [manageBelt]: config[manageBelt].filter((id) => id !== tool.id), [targetBelt]: [...config[targetBelt], tool.id] });
  };
  const restoreDefaults = () => { onConfigChange({ top: [...WRITE_TOOL_DEFAULTS.top], bottom: [...WRITE_TOOL_DEFAULTS.bottom] }); setEditing(false); setReplaceIndex(null); };
  const renderBelt = (nextBelt: WriteToolBeltId, title: string, subtitle: string) => {
    const tools = config[nextBelt].map(findTool).filter((tool): tool is WriteToolDefinition => Boolean(tool));
    return <View style={styles.beltSection}>
      <View style={styles.beltHeader}><View style={styles.beltHeaderCopy}><Text style={styles.beltKicker}>{title}</Text><Text style={styles.beltSubtitle}>{subtitle}</Text></View><Pressable onPress={() => openManager(nextBelt)} style={styles.beltManageLink} accessibilityRole="button" accessibilityLabel={`Customize ${title}`}><Text style={styles.beltManageLinkText}>Customize</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.beltRail}>
        {tools.map((tool) => <ToolTile key={tool.id} tool={tool} active={activeToolIds.includes(tool.id)} onPress={() => onToolPress(tool)} onLongPress={() => openManager(nextBelt, true)} />)}
        <Pressable onPress={() => openManager(nextBelt)} style={styles.addToolTile} accessibilityRole="button" accessibilityLabel={`Add or manage ${title}`} accessibilityHint="Open the Customize Tool Belt library"><View style={styles.addToolIcon}><Text style={styles.addToolPlus}>＋</Text></View><Text style={styles.addToolText}>Add</Text></Pressable>
      </ScrollView>
    </View>;
  };

  return <View style={styles.container}>
    {renderBelt(belt, belt === 'top' ? 'WRITING TOOLS' : 'SESSION TOOLS', belt === 'top' ? 'Pin your favorite writing helpers' : 'Pin your focus and progress tools')}
    <Modal animationType="slide" transparent visible={Boolean(manageBelt)} onRequestClose={closeManager}>
      <View style={styles.modalShade}><Pressable onPress={closeManager} style={styles.modalDismiss} /><View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}><View style={styles.sheetHeaderCopy}><Text style={styles.sheetKicker}>PERSONALIZE YOUR WRITING COCKPIT</Text><Text style={styles.sheetTitle}>Customize Tool Belt</Text><Text style={styles.sheetHint}>Only pinned tools appear on the Write page. You can keep up to six in each belt.</Text></View><Pressable onPress={closeManager} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close tool belt customization"><Text style={styles.closeButtonText}>×</Text></Pressable></View>
        <View style={styles.beltTabs}><Pressable onPress={() => { setManageBelt('top'); setReplaceIndex(null); setDetailId(null); }} style={[styles.beltTab, manageBelt === 'top' && styles.beltTabActive]} accessibilityRole="tab" accessibilityState={{ selected: manageBelt === 'top' }}><Text style={[styles.beltTabText, manageBelt === 'top' && styles.beltTabTextActive]}>Writing Tools</Text><Text style={styles.beltTabCount}>{config.top.length}/6</Text></Pressable><Pressable onPress={() => { setManageBelt('bottom'); setReplaceIndex(null); setDetailId(null); }} style={[styles.beltTab, manageBelt === 'bottom' && styles.beltTabActive]} accessibilityRole="tab" accessibilityState={{ selected: manageBelt === 'bottom' }}><Text style={[styles.beltTabText, manageBelt === 'bottom' && styles.beltTabTextActive]}>Session Tools</Text><Text style={styles.beltTabCount}>{config.bottom.length}/6</Text></Pressable></View>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>{editing ? 'REARRANGE MODE' : 'PINNED TOOLS'}</Text><Text style={styles.sectionTitle}>{editing ? 'Drag to reorder your belt' : 'Your current favorites'}</Text></View>{editing && <Pressable onPress={() => { setEditing(false); setReplaceIndex(null); }} style={styles.doneButton} accessibilityRole="button"><Text style={styles.doneButtonText}>Done</Text></Pressable>}</View>
          {editing && <Text style={styles.editHint}>Long press any tool on the page to return here. Use the handle to drag, ⇄ to move, ↻ to replace, or × to remove.</Text>}
          {currentTools.length ? currentTools.map((tool, index) => <DraggableToolRow key={tool.id} tool={tool} index={index} active={activeToolIds.includes(tool.id)} onPress={() => { setDetailId(tool.id); onToolPress(tool); }} onRemove={() => manageBelt && updateBelt(manageBelt, config[manageBelt].filter((id) => id !== tool.id))} onReplace={() => { setEditing(true); setReplaceIndex(index); setDetailId(null); }} onMove={tool.availableIn.length > 1 ? () => moveTool(tool) : undefined} onReorder={reorder} />) : <View style={styles.emptyPinned}><Text style={styles.emptyPinnedIcon}>＋</Text><Text style={styles.emptyPinnedTitle}>Nothing pinned yet</Text><Text style={styles.emptyPinnedText}>Choose a tool below to make this belt your own.</Text></View>}
          <View style={styles.libraryHeader}><View><Text style={styles.sectionKicker}>TOOL LIBRARY</Text><Text style={styles.sectionTitle}>{replaceIndex === null ? 'Add a writing helper' : 'Choose a replacement'}</Text></View><Text style={styles.libraryCount}>{availableTools.length} tools</Text></View>
          {replaceIndex !== null && <View style={styles.replaceNotice}><Text style={styles.replaceNoticeIcon}>↻</Text><Text style={styles.replaceNoticeText}>Choose a tool to replace {currentTools[replaceIndex]?.name ?? 'this favorite'} in the same position.</Text><Pressable onPress={() => setReplaceIndex(null)}><Text style={styles.replaceCancel}>Cancel</Text></Pressable></View>}
          {availableTools.map((tool) => {
            const pinned = currentIds.includes(tool.id);
            const detailOpen = detailId === tool.id;
            return <View key={tool.id} style={[styles.libraryRow, pinned && styles.libraryRowPinned]}>
              <ToolIcon tool={tool} size="small" />
              <View style={styles.libraryCopy}><Text style={styles.libraryName}>{tool.name}</Text><Text style={styles.libraryDescription}>{tool.description}</Text>{detailOpen && <View style={styles.libraryDetail}><Text style={styles.libraryHow}><Text style={styles.libraryLabel}>How to use: </Text>{tool.howToUse}</Text>{tool.example && <Text style={styles.libraryExample}><Text style={styles.libraryLabel}>Example: </Text>{tool.example}</Text>}</View>}</View>
              <View style={styles.libraryActions}><Pressable onPress={() => setDetailId(detailOpen ? null : tool.id)} style={styles.learnButton} accessibilityRole="button" accessibilityLabel={`${detailOpen ? 'Hide' : 'Show'} details for ${tool.name}`}><Text style={styles.learnButtonText}>{detailOpen ? 'Less' : 'Learn'}</Text></Pressable><Pressable onPress={() => toggleTool(tool)} style={[styles.pinButton, pinned && replaceIndex === null && styles.pinButtonPinned]} accessibilityRole="button" accessibilityLabel={`${replaceIndex !== null ? 'Replace with' : pinned ? 'Remove' : 'Add'} ${tool.name}`}><Text style={[styles.pinButtonText, pinned && replaceIndex === null && styles.pinButtonTextPinned]}>{replaceIndex !== null ? 'Choose' : pinned ? 'Pinned' : 'Add'}</Text></Pressable></View>
            </View>;
          })}
          <View style={styles.footerActions}><Pressable onPress={restoreDefaults} style={styles.resetButton} accessibilityRole="button" accessibilityLabel="Restore default writing tools"><Text style={styles.resetButtonText}>Restore Default Tools</Text></Pressable><Pressable onPress={() => { setEditing(true); setReplaceIndex(null); }} style={styles.editButton} accessibilityRole="button"><Text style={styles.editButtonText}>Reorder Pinned Tools</Text></Pressable></View>
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { marginTop: 13, gap: 11 },
  beltSection: { padding: 11, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: '#E6E2EF' },
  beltHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  beltHeaderCopy: { flex: 1 },
  beltKicker: { color: '#6864B2', fontSize: 8, letterSpacing: 0.9, fontWeight: '800' },
  beltSubtitle: { color: '#8589A3', fontSize: 8, lineHeight: 12, marginTop: 3 },
  beltManageLink: { minHeight: 26, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center' },
  beltManageLinkText: { color: '#6D68B8', fontSize: 8, fontWeight: '800' },
  beltRail: { gap: 8, paddingTop: 9, paddingRight: 4 },
  toolTile: { width: 78, minHeight: 68, paddingVertical: 7, borderRadius: 13, borderWidth: 1, borderColor: '#E8E4F0', backgroundColor: '#FCFBFE', alignItems: 'center', justifyContent: 'center' },
  toolTileActive: { backgroundColor: '#F1EEFF', borderColor: '#C9C2F4' },
  toolTileText: { width: 68, color: '#555B77', fontSize: 8, lineHeight: 10, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  toolTileTextActive: { color: '#625EAB' },
  toolIconLarge: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toolIconSmall: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toolIconTextLarge: { color: '#FFF', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  toolIconTextSmall: { color: '#FFF', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  toolIconTextCompact: { fontSize: 9 },
  addToolTile: { width: 62, minHeight: 63, paddingVertical: 7, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8C3E6', backgroundColor: '#F8F6FF', alignItems: 'center', justifyContent: 'center' },
  addToolIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#E9E5FF', alignItems: 'center', justifyContent: 'center' },
  addToolPlus: { color: '#6D68B8', fontSize: 18, lineHeight: 20 },
  addToolText: { color: '#6D68B8', fontSize: 8, fontWeight: '800', marginTop: 5 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,37,76,0.28)' },
  modalDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { maxHeight: '91%', paddingTop: 18, paddingHorizontal: 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FBFAFF', overflow: 'hidden' },
  handle: { width: 34, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: '#D4D2E1', marginBottom: 13 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  sheetHeaderCopy: { flex: 1, paddingRight: 12 },
  sheetKicker: { color: '#7B76C9', fontSize: 7, letterSpacing: 0.9, fontWeight: '800' },
  sheetTitle: { color: '#202954', fontSize: 22, fontWeight: '800', marginTop: 4 },
  sheetHint: { color: '#747994', fontSize: 9, lineHeight: 13, marginTop: 5 },
  closeButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F0EFF6', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: '#62657D', fontSize: 21, lineHeight: 23 },
  beltTabs: { flexDirection: 'row', gap: 7, marginTop: 15 },
  beltTab: { minHeight: 42, flex: 1, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#F2F1F7', alignItems: 'center', justifyContent: 'center' },
  beltTabActive: { backgroundColor: '#E9E5FF', borderWidth: 1, borderColor: '#CFC8F6' },
  beltTabText: { color: '#757990', fontSize: 9, fontWeight: '800' },
  beltTabTextActive: { color: '#625EAB' },
  beltTabCount: { color: '#A0A3B7', fontSize: 7, marginTop: 3 },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingBottom: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 17, marginBottom: 7 },
  sectionKicker: { color: '#878AA2', fontSize: 7, letterSpacing: 0.8, fontWeight: '800' },
  sectionTitle: { color: '#30385D', fontSize: 13, fontWeight: '800', marginTop: 3 },
  doneButton: { minHeight: 30, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#EAE7FA', justifyContent: 'center' },
  doneButtonText: { color: '#625EAB', fontSize: 9, fontWeight: '800' },
  editHint: { color: '#8589A3', fontSize: 8, lineHeight: 12, marginBottom: 8 },
  pinnedRow: { minHeight: 58, marginTop: 7, paddingHorizontal: 7, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E5F0', flexDirection: 'row', alignItems: 'center' },
  pinnedRowActive: { borderColor: '#CCC5F2', backgroundColor: '#FBFAFF' },
  dragHandle: { width: 26, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dragHandleText: { color: '#A7A8BB', fontSize: 16, letterSpacing: -3 },
  pinnedRowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  pinnedRowCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  pinnedRowTitle: { color: '#30385D', fontSize: 10, fontWeight: '800' },
  pinnedRowDescription: { color: '#8589A3', fontSize: 8, lineHeight: 12, marginTop: 3 },
  rowAction: { width: 29, height: 29, marginLeft: 5, borderRadius: 9, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center' },
  rowActionRemove: { backgroundColor: '#FFF0F0' },
  rowActionText: { color: '#6A65B4', fontSize: 15, fontWeight: '800' },
  rowActionRemoveText: { color: '#B5545F', fontSize: 18, lineHeight: 20 },
  emptyPinned: { padding: 17, borderRadius: 14, backgroundColor: '#F6F4FC', alignItems: 'center' },
  emptyPinnedIcon: { color: '#A19CDD', fontSize: 24 },
  emptyPinnedTitle: { color: '#4E5474', fontSize: 11, fontWeight: '800', marginTop: 4 },
  emptyPinnedText: { color: '#8589A3', fontSize: 8, marginTop: 3 },
  libraryHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 19, marginBottom: 7 },
  libraryCount: { color: '#A0A3B7', fontSize: 8 },
  replaceNotice: { padding: 9, borderRadius: 12, backgroundColor: '#FFF6DB', borderWidth: 1, borderColor: '#F2E2B4', flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  replaceNoticeIcon: { color: '#A97819', fontSize: 14, marginRight: 7 },
  replaceNoticeText: { flex: 1, color: '#806A35', fontSize: 8, lineHeight: 12 },
  replaceCancel: { color: '#9A7424', fontSize: 8, fontWeight: '800', marginLeft: 7 },
  libraryRow: { padding: 9, marginTop: 7, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E5F0', flexDirection: 'row', alignItems: 'flex-start' },
  libraryRowPinned: { borderColor: '#D5D0F3', backgroundColor: '#FCFBFF' },
  libraryCopy: { flex: 1, minWidth: 0, marginLeft: 9, paddingRight: 5 },
  libraryName: { color: '#30385D', fontSize: 10, fontWeight: '800' },
  libraryDescription: { color: '#747994', fontSize: 8, lineHeight: 12, marginTop: 2 },
  libraryDetail: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#EEEAF7' },
  libraryHow: { color: '#5E6480', fontSize: 8, lineHeight: 12 },
  libraryExample: { color: '#8589A3', fontSize: 8, lineHeight: 12, marginTop: 3 },
  libraryLabel: { color: '#6A65B4', fontWeight: '800' },
  libraryActions: { alignItems: 'flex-end', gap: 5 },
  learnButton: { minHeight: 24, paddingHorizontal: 7, borderRadius: 8, justifyContent: 'center' },
  learnButtonText: { color: '#7E82A0', fontSize: 8, fontWeight: '700' },
  pinButton: { minHeight: 27, minWidth: 43, paddingHorizontal: 7, borderRadius: 8, backgroundColor: '#EAE7F7', alignItems: 'center', justifyContent: 'center' },
  pinButtonPinned: { backgroundColor: '#F1F0F7' },
  pinButtonText: { color: '#625EAB', fontSize: 8, fontWeight: '800' },
  pinButtonTextPinned: { color: '#86899E' },
  footerActions: { flexDirection: 'row', gap: 8, marginTop: 17 },
  resetButton: { flex: 1, minHeight: 38, paddingHorizontal: 9, borderRadius: 11, backgroundColor: '#FFF6DB', alignItems: 'center', justifyContent: 'center' },
  resetButtonText: { color: '#987326', fontSize: 8, fontWeight: '800', textAlign: 'center' },
  editButton: { flex: 1, minHeight: 38, paddingHorizontal: 9, borderRadius: 11, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center' },
  editButtonText: { color: '#625EAB', fontSize: 8, fontWeight: '800', textAlign: 'center' },
});
