import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Switch, Text, TextInput, TextInputProps, View, useWindowDimensions } from 'react-native';
import * as Sentry from '@sentry/react-native';

const sentryEnvironment = __DEV__ ? 'development' : 'production';
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? 'https://497d40f44bc1b5561701ddc89e23fa99@o4511657628008448.ingest.us.sentry.io/4511850507075584';

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: sentryEnvironment,
  sendDefaultPii: false,
  debug: __DEV__,
  initialScope: {
    tags: {
      app_version: '1.0.0',
      build_number: '1',
      environment: sentryEnvironment,
    },
    contexts: {
      bookez: {
        appVersion: '1.0.0',
        buildNumber: '1',
        environment: sentryEnvironment,
      },
    },
  },
  beforeSend: (event) => {
    // Bookez never sends manuscript content or application state to Sentry.
    delete event.user;
    delete event.request;
    delete event.extra;
    delete event.breadcrumbs;
    event.contexts = event.contexts?.bookez ? { bookez: event.contexts.bookez } : undefined;
    return event;
  },
});

type StudioSection = 'assemble' | 'read' | 'listen' | 'export';
type Page = 'Library' | 'Plan' | 'Write' | 'Journey' | 'Profile' | 'Stats' | 'BookStudio';

const C = {
  ink: '#202954', muted: '#6E7699', periwinkle: '#8B8AE8', sky: '#A5DCF7', lavender: '#C9BCF5',
  sage: '#A7D4AD', peach: '#FFC09D', coral: '#F78385', gold: '#F5C75C', paper: '#F8F8FF', white: '#FFFFFF',
};

const projectStorageKey = 'bookez.projects.v1';

type InputMode = 'dictation' | 'writing';
type DictationInputProps = TextInputProps & { grow?: boolean; onInputMode?: (mode: InputMode) => void };

function DictationInput({ style, accessibilityLabel, grow = false, onInputMode, onKeyPress, ...props }: DictationInputProps) {
  const inputRef = useRef<TextInput>(null);
  return <View style={[s.dictationField, grow && s.dictationFieldGrow]}>
    <TextInput ref={inputRef} {...props} onKeyPress={(event) => { onKeyPress?.(event); onInputMode?.('writing'); }} accessibilityLabel={accessibilityLabel} style={[style, s.dictationTextInput]} />
    <Pressable onPress={() => { onInputMode?.('dictation'); inputRef.current?.focus(); }} style={s.dictationButton} accessibilityRole="button" accessibilityLabel={`Open phone dictation${accessibilityLabel ? ` for ${accessibilityLabel}` : ''}`}>
      <Text style={s.dictationIcon}>🎙</Text>
    </Pressable>
  </View>;
}

const pageMeta: Record<Page, { icon: string; short: string }> = {
  Library: { icon: '▦', short: 'Library' }, Plan: { icon: '⌘', short: 'Plan' }, Write: { icon: '✎', short: 'Write' },
  Journey: { icon: '✦', short: 'Journey' }, Stats: { icon: '▥', short: 'Stats' }, Profile: { icon: '◉', short: 'Profile' },
  BookStudio: { icon: '▣', short: 'Studio' },
};

const bottomNavPages: Page[] = ['Library', 'Plan', 'Write', 'Journey', 'Stats', 'Profile'];

type CitationStyle = 'APA' | 'MLA' | 'Chicago';
type CitationSourceType = 'book' | 'article' | 'website';
type ReferenceEntry = { id: string; citation: string; style: CitationStyle; sourceType: CitationSourceType; createdAt: number };

type ProjectPlan = {
  structure: Record<string, boolean>;
  idea: string;
  plotThread: string;
  people: string;
  plotNotes: Record<string, string>;
  unitIdeas: string[];
  conclusion?: string;
  referenceNotes?: string;
  referenceEntries?: ReferenceEntry[];
  referenceStyle?: CitationStyle;
  partNotes: Record<string, string>;
  chapterEnds?: Record<string, boolean>;
  drafts: Record<string, string>;
  writeIndex: number;
  targetWords?: string;
  plannedCompletionDate?: string;
  writingFrequency?: WritingFrequency;
  customWritingDays?: number[];
  reminderEnabled?: boolean;
  writingReminderTime?: WritingReminderTime;
  writingReminderTimes?: string[];
  paceFlexibility?: PaceFlexibility;
  customPaceWords?: string;
  planningMethod?: PlanningMethod;
  writingSessionMode?: WritingSessionMode;
  customWritingMinutes?: string;
  customBreakMinutes?: string;
  writingSessionHistory?: WritingSessionRecord[];
  writingPlanCreated?: boolean;
  writingPlanCreatedAt?: number;
  writingPlanPaused?: boolean;
  activity?: Record<string, DailyWritingActivity>;
};

type ImageMode = 'NONE' | 'OPTIONAL' | 'FREQUENT' | 'IMAGE_LED';
type ImagePlacement = 'inline' | 'fullWidth' | 'fullPage' | 'facingPage' | 'spread' | 'chapterOpener' | 'background' | 'divider' | 'cover' | 'backCover';
type ImageTextPlacement = 'top' | 'bottom' | 'left' | 'right' | 'over' | 'separate';
type ImageStatus = 'notStarted' | 'idea' | 'briefReady' | 'sketch' | 'revision' | 'final';
type ImageRole = 'instructional' | 'example' | 'worksheet' | 'chart' | 'decorative' | 'activity';
type PermissionStatus = 'unknown' | 'owned' | 'licensed' | 'permissionNeeded' | 'publicDomain';
type BookezImage = {
  id: string;
  uri: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  title: string;
  caption: string;
  captionRequested: boolean;
  altText: string;
  credit: string;
  source: string;
  date: string;
  location: string;
  people: string;
  permissionStatus: PermissionStatus;
  archiveName: string;
  sourceCitation: string;
  notes: string;
  connectedPartKey?: string;
  placement: ImagePlacement;
  textPlacement: ImageTextPlacement;
  fullBleed: boolean;
  includeInExport: boolean;
  referenceOnly: boolean;
  status: ImageStatus;
  role?: ImageRole;
  order: number;
  createdAt: number;
  updatedAt: number;
};

type ImageSystemConfig = {
  mode: ImageMode;
  label: string;
  itemLabel: string;
  defaultEnabled: boolean;
  captionsRecommended: boolean;
  creditsRecommended: boolean;
  dateLocationRelevant: boolean;
  includeInExportByDefault: boolean;
  placeholders: boolean;
  supportsFacingPages: boolean;
  supportsSpreads: boolean;
  placements: ImagePlacement[];
  roles: ImageRole[];
};

const commonImagePlacements: ImagePlacement[] = ['inline', 'fullWidth', 'fullPage', 'chapterOpener', 'divider', 'cover', 'backCover'];
const imageLedPlacements: ImagePlacement[] = ['fullPage', 'facingPage', 'spread', 'inline', 'background', 'cover', 'backCover'];
const imageSystemByType: Record<string, ImageSystemConfig> = {
  'Fiction Book': { mode: 'OPTIONAL', label: 'Visuals & Maps', itemLabel: 'Visual', defaultEnabled: false, captionsRecommended: false, creditsRecommended: false, dateLocationRelevant: false, includeInExportByDefault: false, placeholders: false, supportsFacingPages: false, supportsSpreads: false, placements: commonImagePlacements, roles: ['decorative'] },
  'Nonfiction Book': { mode: 'FREQUENT', label: 'Figures & Media', itemLabel: 'Figure', defaultEnabled: true, captionsRecommended: true, creditsRecommended: true, dateLocationRelevant: false, includeInExportByDefault: true, placeholders: true, supportsFacingPages: false, supportsSpreads: false, placements: commonImagePlacements, roles: ['instructional', 'example', 'chart', 'decorative'] },
  'Memoir & Biography': { mode: 'FREQUENT', label: 'Photos & Documents', itemLabel: 'Photo', defaultEnabled: true, captionsRecommended: true, creditsRecommended: true, dateLocationRelevant: true, includeInExportByDefault: true, placeholders: true, supportsFacingPages: true, supportsSpreads: false, placements: ['inline', 'fullWidth', 'fullPage', 'facingPage', 'chapterOpener', 'cover', 'backCover'], roles: ['decorative', 'example'] },
  'Children’s Book': { mode: 'IMAGE_LED', label: 'Illustrations', itemLabel: 'Illustration', defaultEnabled: true, captionsRecommended: false, creditsRecommended: false, dateLocationRelevant: false, includeInExportByDefault: true, placeholders: true, supportsFacingPages: true, supportsSpreads: true, placements: imageLedPlacements, roles: ['decorative'] },
  'Poetry Collection': { mode: 'OPTIONAL', label: 'Artwork', itemLabel: 'Artwork', defaultEnabled: false, captionsRecommended: false, creditsRecommended: true, dateLocationRelevant: false, includeInExportByDefault: true, placeholders: false, supportsFacingPages: true, supportsSpreads: false, placements: ['inline', 'fullPage', 'facingPage', 'divider', 'cover', 'backCover'], roles: ['decorative'] },
  'Journal or Diary': { mode: 'OPTIONAL', label: 'Photos & Memories', itemLabel: 'Photo', defaultEnabled: false, captionsRecommended: false, creditsRecommended: false, dateLocationRelevant: true, includeInExportByDefault: true, placeholders: false, supportsFacingPages: false, supportsSpreads: false, placements: ['inline', 'fullWidth', 'fullPage', 'divider', 'cover', 'backCover'], roles: ['decorative'] },
  'Workbook': { mode: 'FREQUENT', label: 'Learning Visuals', itemLabel: 'Visual', defaultEnabled: true, captionsRecommended: true, creditsRecommended: false, dateLocationRelevant: false, includeInExportByDefault: true, placeholders: true, supportsFacingPages: false, supportsSpreads: false, placements: commonImagePlacements, roles: ['instructional', 'example', 'worksheet', 'chart', 'activity', 'decorative'] },
  'Guide or Manual': { mode: 'FREQUENT', label: 'Screenshots & Diagrams', itemLabel: 'Screenshot / diagram', defaultEnabled: true, captionsRecommended: true, creditsRecommended: true, dateLocationRelevant: false, includeInExportByDefault: true, placeholders: true, supportsFacingPages: false, supportsSpreads: false, placements: commonImagePlacements, roles: ['instructional', 'example', 'chart', 'decorative'] },
  'Essay Collection': { mode: 'OPTIONAL', label: 'Visuals', itemLabel: 'Visual', defaultEnabled: false, captionsRecommended: false, creditsRecommended: false, dateLocationRelevant: false, includeInExportByDefault: true, placeholders: false, supportsFacingPages: false, supportsSpreads: false, placements: commonImagePlacements, roles: ['decorative'] },
  'Script': { mode: 'NONE', label: 'Visuals', itemLabel: 'Visual', defaultEnabled: false, captionsRecommended: false, creditsRecommended: false, dateLocationRelevant: false, includeInExportByDefault: false, placeholders: false, supportsFacingPages: false, supportsSpreads: false, placements: ['inline', 'fullPage', 'cover'], roles: ['decorative'] },
  'Speech or Presentation': { mode: 'NONE', label: 'Visuals', itemLabel: 'Visual', defaultEnabled: false, captionsRecommended: false, creditsRecommended: false, dateLocationRelevant: false, includeInExportByDefault: false, placeholders: false, supportsFacingPages: false, supportsSpreads: false, placements: ['inline', 'fullWidth', 'cover'], roles: ['decorative'] },
  'Custom Project': { mode: 'NONE', label: 'Visuals', itemLabel: 'Image', defaultEnabled: false, captionsRecommended: false, creditsRecommended: false, dateLocationRelevant: false, includeInExportByDefault: false, placeholders: false, supportsFacingPages: false, supportsSpreads: false, placements: ['inline', 'fullWidth', 'fullPage', 'cover'], roles: ['decorative'] },
};

const getImageSystemConfig = (type: string): ImageSystemConfig => imageSystemByType[type] ?? imageSystemByType['Custom Project'];
const imageModeLabel = (mode: ImageMode) => mode === 'IMAGE_LED' ? 'Image-led' : mode === 'FREQUENT' ? 'Images encouraged' : mode === 'OPTIONAL' ? 'Images optional' : 'Images off';
const imagePlacementLabel = (placement: ImagePlacement) => ({ inline: 'Inline', fullWidth: 'Full width', fullPage: 'Full page', facingPage: 'Facing page', spread: 'Two-page spread', chapterOpener: 'Chapter opener', background: 'Page background', divider: 'Decorative divider', cover: 'Front cover', backCover: 'Back cover' }[placement]);
const imageStatusLabel = (status: ImageStatus) => ({ notStarted: 'Not started', idea: 'Idea', briefReady: 'Brief ready', sketch: 'Sketch', revision: 'Revision', final: 'Final' }[status]);
const imagePermissionLabel = (status: PermissionStatus) => ({ unknown: 'Permission not checked', owned: 'I own this', licensed: 'Licensed', permissionNeeded: 'Permission needed', publicDomain: 'Public domain' }[status]);
const imageToolsVisible = (project: Project) => getImageSystemConfig(project.type).mode !== 'NONE' || Boolean(project.imageEnabled);
const publicationImages = (project: Project) => (project.images ?? []).filter((image) => image.includeInExport && !image.referenceOnly).sort((a, b) => a.order - b.order);

type WritingFrequency = 'everyday' | 'weekdays' | 'weekends' | 'custom';
type WritingReminderTime = 'morning' | 'afternoon' | 'evening';
type PaceFlexibility = 'gentle' | 'steady' | 'ambitious' | 'custom';
type PlanningMethod = 'plotter' | 'discovery' | 'plantser' | 'threeAct' | 'snowflake' | 'saveTheCat' | 'sceneCards' | 'reverseOutline' | 'questionLed' | 'chapterPurpose';
type PlanningDifficulty = 'easy' | 'medium' | 'hard';
type WritingSessionMode = 'quick' | 'gentle' | 'pomodoro' | 'deep' | 'flow' | 'custom';
type SessionPhase = 'writing' | 'rest';
type SessionChoice = 'continue' | 'rest' | 'finish';
type WritingSessionRecord = { timestamp: number; mode: WritingSessionMode; writingMinutes: number; feeling: string; completed: string; next: string; choice: SessionChoice };

const planningDifficultyMeta: Record<PlanningDifficulty, { label: string; color: string; backgroundColor: string; borderColor: string }> = {
  easy: { label: 'EASY', color: '#4E8B67', backgroundColor: '#E8F6EA', borderColor: '#CDEBD2' },
  medium: { label: 'MEDIUM', color: '#A97819', backgroundColor: '#FFF3CB', borderColor: '#F3E1A3' },
  hard: { label: 'HARD', color: '#A45467', backgroundColor: '#FFE7E6', borderColor: '#F5C8C8' },
};

const planningDifficultyStyle = (difficulty: PlanningDifficulty) => {
  const meta = planningDifficultyMeta[difficulty];
  return { color: meta.color, backgroundColor: meta.backgroundColor, borderColor: meta.borderColor };
};

const planningMethods: { method: PlanningMethod; label: string; description: string; bestFor: string; difficulty: PlanningDifficulty; recommended?: boolean }[] = [
  { method: 'plotter', label: 'Plotter', description: 'Creates a detailed outline before drafting.', bestFor: 'Complex plots, mysteries, and structured nonfiction.', difficulty: 'hard' },
  { method: 'discovery', label: 'Discovery writer / Pantser', description: 'Discovers the story while writing.', bestFor: 'Character-driven or highly intuitive writers.', difficulty: 'easy' },
  { method: 'plantser', label: 'Plantser', description: 'Creates major milestones but discovers details during drafting.', bestFor: 'Most writers; flexible but still organized.', difficulty: 'easy', recommended: true },
  { method: 'threeAct', label: 'Three-act structure', description: 'Organizes a beginning/setup, middle/confrontation, and ending/resolution.', bestFor: 'Novels, screenplays, and accessible storytelling.', difficulty: 'medium' },
  { method: 'snowflake', label: 'Snowflake method', description: 'Expands a one-sentence idea into characters, scenes, and a complete outline.', bestFor: 'Writers who want gradual planning.', difficulty: 'hard' },
  { method: 'saveTheCat', label: 'Save the Cat-style beats', description: 'Organizes the story around predetermined narrative moments.', bestFor: 'Commercial and genre fiction.', difficulty: 'hard' },
  { method: 'sceneCards', label: 'Scene cards', description: 'Creates movable cards for individual scenes.', bestFor: 'Visual writers and stories requiring reordering.', difficulty: 'medium' },
  { method: 'reverseOutline', label: 'Reverse outline', description: 'Outlines material after drafting it.', bestFor: 'Revising discovery-written work and nonfiction.', difficulty: 'medium' },
  { method: 'questionLed', label: 'Question-led planning', description: 'Develops the work by answering guided questions.', bestFor: 'Memoir, nonfiction, and beginning writers.', difficulty: 'easy' },
  { method: 'chapterPurpose', label: 'Chapter-purpose planning', description: 'Defines what every chapter must accomplish.', bestFor: 'Nonfiction, workbooks, and manuals.', difficulty: 'medium' },
];

const getReminderTimes = (plan: ProjectPlan): string[] => {
  if (plan.writingReminderTimes?.length) return plan.writingReminderTimes;
  const legacyTime = plan.writingReminderTime === 'morning' ? '8:00 AM' : plan.writingReminderTime === 'afternoon' ? '1:00 PM' : '7:00 PM';
  return [legacyTime];
};

const normalizeReminderTime = (value: string): string | null => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, ' ');
  const twelveHour = /^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/.exec(normalized);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    if (hour < 1 || hour > 12) return null;
    return `${hour}:${twelveHour[2] ?? '00'} ${twelveHour[3]}`;
  }
  const twentyFourHour = /^(\d{1,2}):([0-5]\d)$/.exec(normalized);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    if (hour > 23) return null;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${twentyFourHour[2]} ${suffix}`;
  }
  return null;
};

type DailyWritingActivity = { words: number; pages: number; completion: number; minutes: number; dictationUses: number; writingUses: number };

type BookStudioAppearance = { fontSize: number; paragraphSpacing: number; lineSpacing: number; headingStyle: 'classic' | 'modern'; alignment: 'left' | 'center' };
type BookStudioState = {
  lastSection: StudioSection;
  frontMatterIncluded: Record<string, boolean>;
  frontMatterText: Record<string, string>;
  backMatterIncluded: Record<string, boolean>;
  backMatterText: Record<string, string>;
  chapterOrder: string[];
  appearance: BookStudioAppearance;
  exportedAt?: number;
};
type Project = { title: string; color: string; mark: string; type: string; pageGoal: string; unitGoal: string; plan: ProjectPlan; updatedAt?: number; archived?: boolean; studio?: BookStudioState; images?: BookezImage[]; imageEnabled?: boolean };

const projectTypes = [
  { name: 'Fiction Book', example: 'Novel, novella, short stories', icon: '✦', color: C.periwinkle },
  { name: 'Nonfiction Book', example: 'Self-help, business, how-to', icon: '▤', color: C.sky },
  { name: 'Memoir & Biography', example: 'Life story, family history', icon: '◌', color: C.coral },
  { name: 'Children’s Book', example: 'Picture book, early reader', icon: '☼', color: C.gold },
  { name: 'Poetry Collection', example: 'Poems in thoughtful sections', icon: '❋', color: C.lavender },
  { name: 'Journal or Diary', example: 'Daily or guided entries', icon: '✎', color: C.sage },
  { name: 'Workbook', example: 'Lessons, prompts, exercises', icon: '☑', color: C.peach },
  { name: 'Guide or Manual', example: 'Course, field, or instruction guide', icon: '⌘', color: C.sky },
  { name: 'Essay Collection', example: 'Essays, articles, reflections', icon: '≋', color: C.lavender },
  { name: 'Script', example: 'Screenplay, play, podcast script', icon: '▹', color: C.coral },
  { name: 'Speech or Presentation', example: 'Keynote, lecture, toast', icon: '◈', color: C.gold },
  { name: 'Custom Project', example: 'Make a structure of your own', icon: '＋', color: C.periwinkle },
];

type Recommendation = 'essential' | 'stronglyRecommended' | 'recommended' | 'common' | 'optional' | 'whenRelevant';
type StructureCategory = 'front' | 'body' | 'back';
type StructureFilter = StructureCategory | 'all';
type StructureItem = { label: string; helper: string; recommended: boolean; recommendation?: Recommendation; category?: StructureCategory; key?: string };

type PlanBlueprint = {
  defaultPages: string;
  defaultUnits: string;
  unitLabel: string;
  unitLabelPlural: string;
  scopeHelper: string;
  structureIntro: string;
  ideaPlaceholder: string;
  peopleLabel: string;
  peoplePlaceholder: string;
  peopleHelper: string;
  plotLabel: string;
  plotNote: string;
  plotPrompts: { label: string; helper: string }[];
  structureItems: StructureItem[];
};

const planBlueprints: Record<string, PlanBlueprint> = {
  'Fiction Book': {
    defaultPages: '240', defaultUnits: '24', unitLabel: 'chapter', unitLabelPlural: 'chapters',
    scopeHelper: 'A typical novel often lands around 20–30 chapters. Let the story set the pace.',
    structureIntro: 'Build a story spine that gives you room to wander, turn, and land.',
    ideaPlaceholder: 'A one-sentence promise: who is this about, and what impossible thing must change?',
    peopleLabel: 'Characters', peoplePlaceholder: 'List the people who want something, get in the way, or help the story change.', peopleHelper: 'Give each key character a want, a fear, and a pressure point.',
    plotLabel: 'Plot arc', plotNote: 'A familiar book arc opens with a promise, raises pressure through complications, pivots at the midpoint, reaches a crisis and climax, then shows what changed in the resolution. Use this as a compass—not a cage.',
    plotPrompts: [
      { label: 'Opening promise', helper: 'What world, voice, question, or tension pulls us in?' },
      { label: 'Rising action', helper: 'What keeps getting harder as the protagonist tries to move forward?' },
      { label: 'Midpoint turn', helper: 'What new truth or reversal changes the direction of the story?' },
      { label: 'Crisis and climax', helper: 'What choice or confrontation makes the central question unavoidable?' },
      { label: 'Resolution / epilogue', helper: 'How does the ending show the cost, change, or new beginning?' },
    ],
    structureItems: [
      { label: 'Title page + dedication', helper: 'Name the story and set its first emotional note.', recommended: true },
      { label: 'Opening / setup', helper: 'Introduce the world, voice, protagonist, and story promise.', recommended: true },
      { label: 'Rising action', helper: 'Layer obstacles, discoveries, and meaningful choices.', recommended: true },
      { label: 'Midpoint reversal', helper: 'Let a revelation or turn change what the reader expects.', recommended: true },
      { label: 'Low point before the climax', helper: 'Give the story a moment where the old way cannot continue.', recommended: true },
      { label: 'Climax + resolution', helper: 'Answer the central question and show what changes.', recommended: true },
      { label: 'Epilogue', helper: 'Offer a final glimpse after the main arc has settled.', recommended: false },
      { label: 'Back-cover summary', helper: 'Capture the hook, stakes, and reading promise.', recommended: true },
    ],
  },
  'Nonfiction Book': {
    defaultPages: '220', defaultUnits: '12', unitLabel: 'chapter', unitLabelPlural: 'chapters',
    scopeHelper: 'A practical nonfiction book often uses 8–14 chapters, with one clear reader outcome per chapter.',
    structureIntro: 'Turn your expertise into a clear path from reader problem to reader progress.',
    ideaPlaceholder: 'What will the reader understand, believe, or be able to do by the end?',
    peopleLabel: 'Readers and examples', peoplePlaceholder: 'Name the reader you are serving, plus people, cases, or voices you may feature.', peopleHelper: 'Keep the reader’s starting point and desired transformation visible.',
    plotLabel: 'Idea arc', plotNote: 'Nonfiction usually moves from a promise and problem to a sequence of ideas, proof, practice, and a confident next step. Each chapter should earn its place by moving the reader closer to the outcome.',
    plotPrompts: [
      { label: 'Reader promise', helper: 'What specific change will this book make possible?' },
      { label: 'Problem and stakes', helper: 'Why does the reader need this now, and what gets in the way?' },
      { label: 'Big ideas in order', helper: 'What must the reader learn first, next, and last?' },
      { label: 'Proof and application', helper: 'Where will stories, research, examples, or exercises make the ideas believable?' },
      { label: 'Synthesis / next step', helper: 'How will readers use what they learned after the final chapter?' },
    ],
    structureItems: [
      { label: 'Introduction + reader promise', helper: 'Name the problem and the transformation ahead.', recommended: true },
      { label: 'Table of contents', helper: 'Make the learning path easy to scan.', recommended: true },
      { label: 'Core chapters', helper: 'Give each chapter one memorable idea and outcome.', recommended: true },
      { label: 'Case studies or examples', helper: 'Show the ideas working in a real situation.', recommended: true },
      { label: 'Exercises or reflection prompts', helper: 'Help the reader turn insight into action.', recommended: false },
      { label: 'Conclusion + action plan', helper: 'Gather the ideas and point to the next move.', recommended: true },
      { label: 'Resources / bibliography', helper: 'Give curious readers a trustworthy path deeper.', recommended: false },
      { label: 'Back-cover summary', helper: 'Make the book’s promise easy to understand at a glance.', recommended: true },
    ],
  },
  'Memoir & Biography': {
    defaultPages: '260', defaultUnits: '18', unitLabel: 'chapter', unitLabelPlural: 'chapters',
    scopeHelper: 'Life stories often work well in 12–24 chapters organized around eras, relationships, or turning points.',
    structureIntro: 'Shape a life story around meaning and change—not just a list of dates.',
    ideaPlaceholder: 'What part of this life, and what transformation, does the reader most need to feel?',
    peopleLabel: 'People and relationships', peoplePlaceholder: 'List the people who shaped the life, the conflict, and the way the story is remembered.', peopleHelper: 'Capture each person’s role, relationship, and emotional significance.',
    plotLabel: 'Life-story arc', plotNote: 'A memoir or biography can be chronological, braided, or thematic. Whichever shape you choose, guide us from a meaningful beginning through pressure and turning points toward the insight or changed perspective you want to leave us with.',
    plotPrompts: [
      { label: 'Before / opening image', helper: 'What image, place, or question introduces the life as it was?' },
      { label: 'Catalyst and early pressure', helper: 'What event begins the movement or reveals the central tension?' },
      { label: 'Turning points', helper: 'Which choices, losses, or discoveries change the direction?' },
      { label: 'Crisis and reckoning', helper: 'What can no longer be avoided or misunderstood?' },
      { label: 'Reflection / epilogue', helper: 'What does the narrator or subject understand now?' },
    ],
    structureItems: [
      { label: 'Author’s note / context', helper: 'Explain the lens, purpose, or boundaries of the story.', recommended: false },
      { label: 'Opening scene or prologue', helper: 'Begin with an image that carries emotional charge.', recommended: true },
      { label: 'Life chapters by era or theme', helper: 'Group memories around meaningful movement.', recommended: true },
      { label: 'Turning-point chapters', helper: 'Give major choices and losses enough space to land.', recommended: true },
      { label: 'Photos, documents, or timeline', helper: 'Add context when artifacts help the reader see the life.', recommended: false },
      { label: 'Reflection / epilogue', helper: 'Let the present-day meaning come into focus.', recommended: true },
      { label: 'Notes and acknowledgments', helper: 'Credit research, collaborators, and remembered voices.', recommended: false },
      { label: 'Back-cover summary', helper: 'Name the life, tension, and emotional journey.', recommended: true },
    ],
  },
  'Children’s Book': {
    defaultPages: '32', defaultUnits: '14', unitLabel: 'spread or beat', unitLabelPlural: 'spreads / beats',
    scopeHelper: 'Picture books often use 12–16 story spreads. Early readers may use short chapters instead.',
    structureIntro: 'Plan what a young reader sees, feels, and wonders on every page turn.',
    ideaPlaceholder: 'What delightful problem or feeling will a child recognize, and what will they carry away?',
    peopleLabel: 'Characters and voices', peoplePlaceholder: 'Name the child, creature, or grown-up at the heart of the story and what each one wants.', peopleHelper: 'Keep the cast small, distinct, and easy to follow aloud.',
    plotLabel: 'Page-turn arc', plotNote: 'A children’s story often opens with a clear want, builds through a few playful complications, turns at the biggest surprise, and lands in a satisfying emotional image. Let each spread earn the next page turn.',
    plotPrompts: [
      { label: 'Opening image + want', helper: 'What does the child see, need, or wish for immediately?' },
      { label: 'Playful complications', helper: 'What gets bigger, sillier, stranger, or harder?' },
      { label: 'Big turn', helper: 'What surprise changes the problem or the way it is seen?' },
      { label: 'Try again / solve', helper: 'What choice lets the main character act with new understanding?' },
      { label: 'Final image', helper: 'What warm, funny, or resonant moment closes the read-aloud?' },
    ],
    structureItems: [
      { label: 'Title page', helper: 'Give the story a memorable first invitation.', recommended: true },
      { label: 'Opening spread', helper: 'Introduce the character, world, and emotional hook.', recommended: true },
      { label: 'Page-turn beats', helper: 'Plan the reveal, rhythm, and visual surprise of each spread.', recommended: true },
      { label: 'Big turn', helper: 'Place the moment that changes what the character will do.', recommended: true },
      { label: 'Satisfying ending', helper: 'Close on an image a child can feel and repeat.', recommended: true },
      { label: 'Art direction notes', helper: 'Capture visual details the words do not need to carry.', recommended: true },
      { label: 'Back-cover summary', helper: 'Write a short, parent-friendly promise of the story.', recommended: true },
    ],
  },
  'Poetry Collection': {
    defaultPages: '96', defaultUnits: '40', unitLabel: 'poem', unitLabelPlural: 'poems',
    scopeHelper: 'Collections often gather 30–60 poems, arranged in sections that create a second poem together.',
    structureIntro: 'Arrange individual poems into an emotional weather system with its own rhythm.',
    ideaPlaceholder: 'What question, image, season, or pressure keeps returning across the collection?',
    peopleLabel: 'Voices and presences', peoplePlaceholder: 'Name the speakers, addressees, remembered people, or recurring presences in the poems.', peopleHelper: 'Notice whose voice is centered and how the voice changes across sections.',
    plotLabel: 'Emotional arc', plotNote: 'A poetry collection does not need a conventional plot. It can still open a door, deepen a question, shift the reader’s weather, and close with an image that echoes rather than explains.',
    plotPrompts: [
      { label: 'Opening poem / invitation', helper: 'What mood or question welcomes the reader in?' },
      { label: 'Sections and motifs', helper: 'Which images, tensions, or seasons create the collection’s movement?' },
      { label: 'Deepening / turn', helper: 'Where does the voice complicate or contradict itself?' },
      { label: 'Breath and pacing', helper: 'Where do short poems, long poems, or white space change the rhythm?' },
      { label: 'Closing poem / echo', helper: 'What final image can remain alive after the last page?' },
    ],
    structureItems: [
      { label: 'Title page + contents', helper: 'Orient the reader without explaining everything.', recommended: true },
      { label: 'Sections or movements', helper: 'Create a larger emotional or thematic rhythm.', recommended: true },
      { label: 'Opening poem', helper: 'Set the collection’s voice and invitation.', recommended: true },
      { label: 'Interludes or visual pauses', helper: 'Use space, fragments, or brief prose to let the book breathe.', recommended: false },
      { label: 'Closing poem', helper: 'Leave an image, question, or resonance rather than a hard stop.', recommended: true },
      { label: 'Notes / acknowledgments', helper: 'Add context or thanks when the work calls for it.', recommended: false },
      { label: 'Back-cover summary', helper: 'Describe the collection’s atmosphere and central question.', recommended: true },
    ],
  },
  'Journal or Diary': {
    defaultPages: '120', defaultUnits: '30', unitLabel: 'entry', unitLabelPlural: 'entries',
    scopeHelper: 'Choose a rhythm that feels kind: 30 daily entries, 12 monthly sections, or another cadence you can keep.',
    structureIntro: 'Make a container that welcomes honest, repeatable reflection.',
    ideaPlaceholder: 'What kind of attention, record, or ritual should this journal make possible?',
    peopleLabel: 'People and life areas', peoplePlaceholder: 'List relationships, roles, or parts of life you want to notice over time.', peopleHelper: 'These can become recurring lenses, not characters to perform.',
    plotLabel: 'Reflection rhythm', plotNote: 'A journal usually moves by cadence rather than plot: arrive, notice, reflect, and return. Give the reader enough structure to begin, then enough room to make the entries their own.',
    plotPrompts: [
      { label: 'Opening invitation', helper: 'What makes someone want to begin writing today?' },
      { label: 'Entry rhythm', helper: 'What repeatable question, ritual, or check-in anchors each entry?' },
      { label: 'Deepening prompts', helper: 'How do the prompts move from noticing to meaning or action?' },
      { label: 'Pause and review', helper: 'Where can the writer look back and see a pattern or shift?' },
      { label: 'Closing ritual', helper: 'How does the journal help the writer continue beyond the last page?' },
    ],
    structureItems: [
      { label: 'Welcome + how to use', helper: 'Lower the pressure and show the reader how to begin.', recommended: true },
      { label: 'Daily or weekly entry pages', helper: 'Build a rhythm that is easy to return to.', recommended: true },
      { label: 'Themed sections', helper: 'Gather entries around seasons, questions, or life areas.', recommended: false },
      { label: 'Progress check-ins', helper: 'Invite the writer to notice patterns and small changes.', recommended: true },
      { label: 'Free-write pages', helper: 'Leave space for what does not fit the prompt.', recommended: true },
      { label: 'Closing reflection', helper: 'Help the writer name what they are taking with them.', recommended: true },
    ],
  },
  Workbook: {
    defaultPages: '160', defaultUnits: '8', unitLabel: 'lesson or module', unitLabelPlural: 'lessons / modules',
    scopeHelper: 'A focused workbook often uses 6–10 modules, each with a teach, practice, and reflect rhythm.',
    structureIntro: 'Design a clear learning path that turns every idea into something the reader can try.',
    ideaPlaceholder: 'What skill or transformation will someone practice from the first page to the last?',
    peopleLabel: 'Learners and examples', peoplePlaceholder: 'Describe the learner and the people or scenarios they will recognize in the exercises.', peopleHelper: 'Design activities for the learner’s real starting point—not an imaginary expert.',
    plotLabel: 'Learning arc', plotNote: 'A workbook often progresses from orientation to instruction, guided practice, independent practice, reflection, and a next-step plan. The reader should do something on most pages.',
    plotPrompts: [
      { label: 'Starting point and outcome', helper: 'What can the learner do now, and what should they do next?' },
      { label: 'Skill sequence', helper: 'Which small skill must be learned before the next one?' },
      { label: 'Practice moments', helper: 'Where does the learner try the idea with support?' },
      { label: 'Review and feedback', helper: 'How will they know what is working or needs another pass?' },
      { label: 'Capstone / next step', helper: 'What finished activity proves they are ready to continue?' },
    ],
    structureItems: [
      { label: 'Welcome + learning outcomes', helper: 'Tell the learner what they will be able to do.', recommended: true },
      { label: 'Lessons or modules', helper: 'Give each module one clear skill or decision.', recommended: true },
      { label: 'Exercises and worksheets', helper: 'Make the reader apply the idea immediately.', recommended: true },
      { label: 'Reflection check-ins', helper: 'Help the learner notice what changed.', recommended: true },
      { label: 'Answer key or examples', helper: 'Offer reassurance without taking away the work.', recommended: false },
      { label: 'Capstone / action plan', helper: 'Turn practice into a next step outside the workbook.', recommended: true },
      { label: 'Resources', helper: 'Point to tools, references, or further practice.', recommended: false },
    ],
  },
  'Guide or Manual': {
    defaultPages: '120', defaultUnits: '10', unitLabel: 'section', unitLabelPlural: 'sections',
    scopeHelper: 'A useful manual often has 8–12 sections, plus quick-reference pages readers can return to.',
    structureIntro: 'Help someone move from “Where do I start?” to confident, repeatable action.',
    ideaPlaceholder: 'What task, process, or decision should become easier after someone uses this guide?',
    peopleLabel: 'Users and scenarios', peoplePlaceholder: 'Describe who will use the guide and the real situations they will bring to it.', peopleHelper: 'Write for the moment the reader is stuck, rushed, or trying this for the first time.',
    plotLabel: 'Instructional flow', plotNote: 'A clear manual usually starts with orientation and requirements, walks through the core sequence, anticipates decisions and errors, then ends with troubleshooting and a quick reference.',
    plotPrompts: [
      { label: 'Quick-start promise', helper: 'What can the reader accomplish in their first ten minutes?' },
      { label: 'Setup and prerequisites', helper: 'What do they need to know, gather, or decide first?' },
      { label: 'Core sequence', helper: 'What steps must happen in what order?' },
      { label: 'Decisions and troubleshooting', helper: 'Where might the reader branch, get stuck, or need a fix?' },
      { label: 'Reference / next level', helper: 'What checklist, glossary, or advanced path helps them continue?' },
    ],
    structureItems: [
      { label: 'Quick start', helper: 'Give the reader a small, immediate win.', recommended: true },
      { label: 'Requirements and safety notes', helper: 'Name tools, assumptions, and important boundaries.', recommended: true },
      { label: 'Step-by-step procedures', helper: 'Break the main task into scannable actions.', recommended: true },
      { label: 'Decision points', helper: 'Explain what to do when the path branches.', recommended: true },
      { label: 'Troubleshooting', helper: 'Answer the questions that appear when things go wrong.', recommended: true },
      { label: 'Checklists and templates', helper: 'Make the guide useful in the middle of doing.', recommended: false },
      { label: 'Glossary / references', helper: 'Define terms and offer a trustworthy deeper path.', recommended: false },
    ],
  },
  'Essay Collection': {
    defaultPages: '180', defaultUnits: '10', unitLabel: 'essay', unitLabelPlural: 'essays',
    scopeHelper: 'A collection often holds 8–14 essays, arranged so each one changes how the next one is read.',
    structureIntro: 'Let separate essays speak to one another until the collection becomes a larger conversation.',
    ideaPlaceholder: 'What question, tension, or lens is strong enough to hold multiple essays together?',
    peopleLabel: 'Voices and subjects', peoplePlaceholder: 'List the people, communities, or subjects whose voices and experiences shape the collection.', peopleHelper: 'Track whose perspective opens, complicates, or closes the conversation.',
    plotLabel: 'Conversation arc', plotNote: 'An essay collection can move from personal to public, simple to complex, or question to question. It should still create momentum: introduce the conversation, complicate it, and leave the reader with a changed lens.',
    plotPrompts: [
      { label: 'Opening question', helper: 'What essay or idea invites the reader into the conversation?' },
      { label: 'Themes and sequence', helper: 'What order creates discovery rather than repetition?' },
      { label: 'Complication', helper: 'Where does a later essay challenge an earlier assumption?' },
      { label: 'Synthesis', helper: 'What becomes visible only when the essays sit together?' },
      { label: 'Closing resonance', helper: 'What final question or image should stay with the reader?' },
    ],
    structureItems: [
      { label: 'Introduction', helper: 'Name the collection’s question and invitation.', recommended: true },
      { label: 'Themed essay sections', helper: 'Give the essays a deliberate order and breathing room.', recommended: true },
      { label: 'Opening and closing essays', helper: 'Let the first and last pieces frame the larger conversation.', recommended: true },
      { label: 'Interludes', helper: 'Use short bridges when the collection needs a pause or pivot.', recommended: false },
      { label: 'Notes / sources', helper: 'Add context or citations where the essays need it.', recommended: false },
      { label: 'Contributor notes', helper: 'Offer a little context for the voices in the room.', recommended: false },
      { label: 'Back-cover summary', helper: 'Describe the collection’s question and range.', recommended: true },
    ],
  },
  Script: {
    defaultPages: '110', defaultUnits: '45', unitLabel: 'scene', unitLabelPlural: 'scenes',
    scopeHelper: 'A feature screenplay often uses 40–60 scenes; a play or podcast script may use acts, beats, or segments instead.',
    structureIntro: 'Give the audience a clean sequence of moments they can see, hear, and feel.',
    ideaPlaceholder: 'What is the logline: who wants what, what stands in the way, and why now?',
    peopleLabel: 'Cast and voices', peoplePlaceholder: 'List the characters, speakers, or performers and the tension each brings into the room.', peopleHelper: 'Give every important voice a distinct want, rhythm, and relationship to the central conflict.',
    plotLabel: 'Scene arc', plotNote: 'A script often moves through a clear setup, escalating complications, a midpoint shift, crisis, climax, and final beat. Each scene should change the information, emotion, or power in the room.',
    plotPrompts: [
      { label: 'Logline and opening image', helper: 'What does the audience understand or wonder in the first moments?' },
      { label: 'Act / sequence one', helper: 'What sets the goal and forces the story into motion?' },
      { label: 'Escalation and midpoint', helper: 'What raises the cost and changes the plan?' },
      { label: 'Crisis and climax', helper: 'What final choice or confrontation cannot be avoided?' },
      { label: 'Final beat', helper: 'What image, line, or silence tells us what remains?' },
    ],
    structureItems: [
      { label: 'Title page', helper: 'Give the script a clear first impression.', recommended: true },
      { label: 'Logline + cast list', helper: 'Keep the premise and voices easy to reference.', recommended: true },
      { label: 'Act or sequence breaks', helper: 'Create visible movement through the larger arc.', recommended: true },
      { label: 'Scene list', helper: 'Track location, time, purpose, and change.', recommended: true },
      { label: 'Climax + final beat', helper: 'Make the ending playable and emotionally legible.', recommended: true },
      { label: 'Production notes', helper: 'Capture sound, visual, staging, or performance needs.', recommended: false },
    ],
  },
  'Speech or Presentation': {
    defaultPages: '12', defaultUnits: '7', unitLabel: 'segment', unitLabelPlural: 'segments',
    scopeHelper: 'A short talk often has 5–8 segments: opening, three main ideas, and a close with room for questions.',
    structureIntro: 'Lead an audience somewhere memorable with a clear promise and a human rhythm.',
    ideaPlaceholder: 'What should the audience feel, understand, or do differently when you finish?',
    peopleLabel: 'Audience and voices', peoplePlaceholder: 'Describe the audience, plus any story, quote, or co-presenter voice you will bring in.', peopleHelper: 'Write toward one real room and one real moment of attention.',
    plotLabel: 'Audience journey', plotNote: 'A strong talk hooks attention, makes a promise, develops a few memorable points, turns insight into meaning or action, and closes with a line the audience can carry out of the room.',
    plotPrompts: [
      { label: 'Hook and promise', helper: 'What makes people look up, and what are you promising them?' },
      { label: 'Key point one', helper: 'What is the first idea the audience needs to trust?' },
      { label: 'Story / example', helper: 'What human moment makes the idea memorable?' },
      { label: 'Pivot and call to action', helper: 'What do you want the audience to do, question, or carry forward?' },
      { label: 'Close / Q&A', helper: 'What final words or question leave the room with energy?' },
    ],
    structureItems: [
      { label: 'Opening hook', helper: 'Earn attention with a question, image, story, or surprise.', recommended: true },
      { label: 'Audience promise', helper: 'Tell people why the next few minutes matter to them.', recommended: true },
      { label: 'Main points', helper: 'Keep the core ideas few, clear, and repeatable.', recommended: true },
      { label: 'Stories or examples', helper: 'Give the ideas a human shape.', recommended: true },
      { label: 'Slides / speaker notes', helper: 'Separate what people see from what you say.', recommended: false },
      { label: 'Q&A or interaction', helper: 'Make space for the audience to enter the conversation.', recommended: false },
      { label: 'Closing call to action', helper: 'End with a clear next step or resonant line.', recommended: true },
    ],
  },
  'Custom Project': {
    defaultPages: '100', defaultUnits: '8', unitLabel: 'section', unitLabelPlural: 'sections',
    scopeHelper: 'Start with a small number of sections, then add only what your project truly needs.',
    structureIntro: 'Make a structure that fits your idea instead of forcing your idea into a format.',
    ideaPlaceholder: 'What are you making, who is it for, and what should it do when it is finished?',
    peopleLabel: 'People and voices', peoplePlaceholder: 'List anyone whose perspective, presence, or needs belong in the project.', peopleHelper: 'Use this space for characters, readers, learners, collaborators, or subjects.',
    plotLabel: 'Project flow', plotNote: 'A custom project can still benefit from a beginning, a middle that develops or complicates the idea, and an ending that gives the work a clear sense of arrival.',
    plotPrompts: [
      { label: 'Opening / invitation', helper: 'How will someone understand what this project is asking them to enter?' },
      { label: 'Core sections', helper: 'What are the essential pieces, and how do they build on one another?' },
      { label: 'Turning point', helper: 'Where does the project change direction or deepen its promise?' },
      { label: 'Resolution', helper: 'What does a finished version make clear, possible, or felt?' },
      { label: 'Supporting materials', helper: 'What notes, references, or extras will help the work stand up?' },
    ],
    structureItems: [
      { label: 'Opening / context', helper: 'Give the reader a way into the work.', recommended: true },
      { label: 'Core sections', helper: 'Choose the essential building blocks of your format.', recommended: true },
      { label: 'Exercises, examples, or scenes', helper: 'Add the pieces that make the idea tangible.', recommended: false },
      { label: 'Turning point', helper: 'Give the work a moment of shift or discovery.', recommended: false },
      { label: 'Conclusion / final piece', helper: 'Let the project feel intentionally complete.', recommended: true },
      { label: 'Notes / resources', helper: 'Keep supporting material available without crowding the main flow.', recommended: false },
    ],
  },
};

const component = (label: string, helper: string, recommendation: Recommendation, category: StructureCategory): StructureItem => ({
 label, helper, recommendation, category, recommended: recommendation === 'essential' || recommendation === 'stronglyRecommended' || recommendation === 'recommended',
});

const guidedComponents: Record<string, StructureItem[]> = {
  'Fiction Book': [
    component('Cover', 'Title, author, and the first visual promise.', 'recommended', 'front'), component('Half-title page', 'A quiet title-only page before the full title page.', 'optional', 'front'), component('Title page', 'Give the work its formal title and author credit.', 'stronglyRecommended', 'front'), component('Copyright page', 'Add publication and rights information when publishing.', 'whenRelevant', 'front'), component('Dedication', 'A brief personal dedication for someone who belongs near the beginning.', 'common', 'front'), component('Epigraph', 'Use a quotation to establish theme or mood.', 'optional', 'front'), component('Table of contents', 'Helpful for collections and longer or multi-part works.', 'whenRelevant', 'front'), component('Prologue', 'Open with an event that happens before the main story.', 'optional', 'body'), component('Scene', 'The essential internal event, place, and change inside a chapter.', 'essential', 'body'), component('Scene break', 'Separate shifts in time, place, or viewpoint inside a chapter.', 'common', 'body'), component('Interlude', 'Make room for a side story, document, or alternate perspective.', 'optional', 'body'), component('Character viewpoint label', 'Orient readers when the story moves between narrators.', 'optional', 'body'), component('Illustration or map', 'Use visual reference when the world benefits from it.', 'whenRelevant', 'body'), component('Epilogue', 'Show the aftermath once the central story has ended.', 'optional', 'back'), component('Acknowledgments', 'Credit the people who helped the work come into being.', 'common', 'back'), component('About the author', 'Offer a short creator biography.', 'common', 'back'),
  ],
  'Nonfiction Book': [
    component('Cover', 'State the title, promise, and author clearly.', 'recommended', 'front'), component('Title page', 'Give the book its formal title and author credit.', 'stronglyRecommended', 'front'), component('Copyright page', 'Add publication and rights information when publishing.', 'whenRelevant', 'front'), component('Table of contents', 'Let readers see the argument and find their way through it.', 'recommended', 'front'), component('Introduction', 'Establish the problem, promise, and scope of the book.', 'stronglyRecommended', 'front'), component('Preface', 'Explain why and how the book came to be.', 'common', 'front'), component('Part', 'Group chapters when the book has a long or layered arc.', 'common', 'body'), component('Chapter', 'Carry one primary argument, topic, or reader outcome.', 'essential', 'body'), component('Section and subsection', 'Organize information into readable, meaningful layers.', 'stronglyRecommended', 'body'), component('Definition', 'Explain terminology before readers need to infer it.', 'common', 'body'), component('Example', 'Make an idea concrete and easier to understand.', 'stronglyRecommended', 'body'), component('Case study', 'Show an idea working in a detailed real or hypothetical situation.', 'common', 'body'), component('Data, chart, or table', 'Support factual claims when visual evidence helps.', 'optional', 'body'), component('Key takeaways', 'Give readers a quick recap of the most important points.', 'recommended', 'body'), component('Chapter summary', 'Reinforce the learning or argument before the next chapter.', 'recommended', 'body'), component('Conclusion', 'Resolve the central argument and point toward what follows.', 'recommended', 'back'), component('Notes or references', 'Document sources when the work is researched.', 'whenRelevant', 'back'), component('Index', 'Help readers locate topics in reference-heavy books.', 'whenRelevant', 'back'), component('About the author', 'Offer a short creator biography.', 'common', 'back'),
  ],
  'Memoir & Biography': [
    component('Cover', 'Introduce the life and the emotional promise of the story.', 'recommended', 'front'), component('Title page', 'Give the work its formal title and author credit.', 'stronglyRecommended', 'front'), component('Copyright page', 'Add publication and rights information when publishing.', 'whenRelevant', 'front'), component('Dedication', 'Honor someone who belongs near the beginning of the story.', 'common', 'front'), component('Author’s note', 'Explain memory, changed names, accuracy, or the chosen lens.', 'recommended', 'front'), component('Prologue or opening scene', 'Begin with a defining event or charged image.', 'common', 'body'), component('Part by life stage or theme', 'Group chapters around childhood, recovery, work, or turning points.', 'recommended', 'body'), component('Chapter', 'Give one period, relationship, or theme enough room to land.', 'essential', 'body'), component('Dated entry', 'Add documentary detail when dates carry meaning.', 'optional', 'body'), component('Photograph', 'Use images to support the remembered or researched life.', 'common', 'body'), component('Photo caption', 'Identify people, date, place, and context for every photograph.', 'whenRelevant', 'body'), component('Reflection passage', 'Connect past events to present meaning.', 'recommended', 'body'), component('Epilogue', 'Explain what happened afterward or what the story means now.', 'recommended', 'back'), component('Sources or endnotes', 'Document factual claims, especially in biography.', 'whenRelevant', 'back'), component('Permissions and credits', 'Credit photographs, quoted material, and other contributed work.', 'whenRelevant', 'back'), component('About the author', 'Offer a short creator biography.', 'common', 'back'),
  ],
  'Children’s Book': [
    component('Cover', 'Make the story’s first visual invitation clear and memorable.', 'recommended', 'front'), component('Endpapers', 'Use opening and closing paper as a visual transition when useful.', 'optional', 'front'), component('Title page', 'Give the story its formal title and creator credit.', 'stronglyRecommended', 'front'), component('Copyright page', 'Add publication and rights information when publishing.', 'whenRelevant', 'front'), component('Dedication', 'Offer a small personal note before the story begins.', 'optional', 'front'), component('Story spread', 'Treat each left-and-right page turn as one storytelling unit.', 'essential', 'body'), component('Story text', 'Place the words where they work with the visual rhythm.', 'essential', 'body'), component('Illustration', 'Carry visual storytelling that the words do not need to explain.', 'essential', 'body'), component('Illustration direction', 'Capture what should appear visually while drafting.', 'recommended', 'body'), component('Page-turn marker', 'Plan where suspense, surprise, or warmth lands on the next spread.', 'recommended', 'body'), component('Repeated phrase', 'Build rhythm and participation through intentional repetition.', 'optional', 'body'), component('Educational fact box', 'Add factual context when the book teaches as well as tells.', 'whenRelevant', 'body'), component('Parent or teacher questions', 'Invite a useful conversation after reading.', 'optional', 'back'), component('About the author', 'Offer a short creator biography.', 'common', 'back'), component('About the illustrator', 'Credit the illustrator with a short biography.', 'common', 'back'),
  ],
  'Poetry Collection': [
    component('Cover', 'Set the collection’s first visual and tonal note.', 'recommended', 'front'), component('Title page', 'Give the collection its formal title and author credit.', 'stronglyRecommended', 'front'), component('Copyright page', 'Add publication and rights information when publishing.', 'whenRelevant', 'front'), component('Dedication or epigraph', 'Open with a personal dedication or resonant quotation.', 'optional', 'front'), component('Table of contents', 'Help readers move through poems and sections.', 'recommended', 'front'), component('Themed section', 'Group poems by theme, period, style, or emotional weather.', 'recommended', 'body'), component('Section-opening page', 'Create a visual pause before a new movement.', 'optional', 'body'), component('Poem', 'Keep the poem as the primary writing object.', 'essential', 'body'), component('Poem subtitle', 'Add context when a subtitle serves the poem.', 'optional', 'body'), component('Date or place note', 'Record when or where a poem was written when that matters.', 'optional', 'body'), component('Stanza', 'Preserve the poem’s internal grouping of lines.', 'essential', 'body'), component('Refrain', 'Use repeated lines as a deliberate structural choice.', 'optional', 'body'), component('Shape and layout controls', 'Preserve line breaks, indentation, spacing, and concrete form.', 'recommended', 'body'), component('Poem notes', 'Explain references, translations, or context only when necessary.', 'optional', 'back'), component('Acknowledgment credits', 'Identify prior publications or permissions when applicable.', 'whenRelevant', 'back'), component('Index of titles or first lines', 'Offer a traditional poetry reference tool when useful.', 'optional', 'back'),
  ],
  'Journal or Diary': [
    component('Cover', 'Name the journal and establish its invitation.', 'recommended', 'front'), component('Ownership page', 'Give the journal a place to say who it belongs to.', 'common', 'front'), component('Introduction', 'Explain the journal’s purpose without over-directing it.', 'optional', 'front'), component('How to use this journal', 'Explain the process when the journal is guided or interactive.', 'recommended', 'front'), component('Intention-setting page', 'Define what the writer hopes to notice or practice.', 'recommended', 'front'), component('Entry', 'Keep the repeated entry as the main unit.', 'essential', 'body'), component('Date and time', 'Record when an entry was made.', 'recommended', 'body'), component('Entry title', 'Label an entry when a title helps the writer return to it.', 'optional', 'body'), component('Daily prompt', 'Offer a question when a little guidance would help.', 'optional', 'body'), component('Free-writing area', 'Leave room for what does not fit a prompt.', 'recommended', 'body'), component('Mood check-in', 'Track emotional state only when it serves the journal’s purpose.', 'optional', 'body'), component('Goal field', 'Keep a small intention visible when useful.', 'optional', 'body'), component('Weekly review', 'Summarize progress for a structured journal.', 'recommended', 'back'), component('Monthly review', 'Notice larger patterns across a month.', 'optional', 'back'), component('Closing reflection', 'Review the full journal period and what changed.', 'recommended', 'back'), component('Index', 'Help locate important entries in a long journal.', 'optional', 'back'),
  ],
  Workbook: [
    component('Cover', 'State the learning promise clearly.', 'recommended', 'front'), component('Title and copyright pages', 'Give the workbook its formal identity and rights information.', 'recommended', 'front'), component('Table of contents', 'Show the learning path at a glance.', 'recommended', 'front'), component('Introduction', 'Orient the learner to the problem and outcome.', 'recommended', 'front'), component('How to use the workbook', 'Explain how teaching, practice, and reflection fit together.', 'recommended', 'front'), component('Learning objective', 'Explain what the learner will accomplish.', 'stronglyRecommended', 'front'), component('Module', 'Group related lessons and activities.', 'recommended', 'body'), component('Lesson', 'Make each instructional unit clear and bounded.', 'essential', 'body'), component('Explanation', 'Teach the concept before asking the learner to use it.', 'essential', 'body'), component('Worked example', 'Show the process before independent practice.', 'recommended', 'body'), component('Exercise', 'Give the learner a way to practice.', 'essential', 'body'), component('Prompt', 'Request a written response or reflection.', 'common', 'body'), component('Response area', 'Provide space for the learner’s answer.', 'essential', 'body'), component('Worksheet', 'Give a structured activity a reusable shape.', 'essential', 'body'), component('Checklist', 'Track tasks or requirements.', 'common', 'body'), component('Reflection', 'Help the learner apply the idea personally.', 'recommended', 'body'), component('Progress tracker', 'Make completion visible across the workbook.', 'recommended', 'back'), component('Module summary', 'Recap the learning before the next module.', 'recommended', 'back'), component('Answer key', 'Allow self-correction when exercises have definite answers.', 'whenRelevant', 'back'), component('Certificate page', 'Mark completion when the workbook benefits from a finish line.', 'optional', 'back'),
  ],
  'Guide or Manual': [
    component('Cover', 'Make the guide’s purpose clear at a glance.', 'recommended', 'front'), component('Title and copyright pages', 'Give the guide its formal identity and rights information.', 'recommended', 'front'), component('Version and publication date', 'Tell readers which release they are using.', 'recommended', 'front'), component('Table of contents', 'Help readers jump to a procedure or reference section.', 'recommended', 'front'), component('Introduction', 'Explain what the guide covers and what it does not.', 'recommended', 'front'), component('Intended audience', 'Identify who should use the guide.', 'recommended', 'front'), component('Prerequisites', 'List the knowledge, tools, or access needed first.', 'recommended', 'front'), component('Scope', 'Set the guide’s boundaries and promise.', 'recommended', 'front'), component('Safety warning', 'Warn about risk whenever the task requires it.', 'whenRelevant', 'body'), component('Procedure', 'Describe a complete task from start to finish.', 'essential', 'body'), component('Step', 'Make each instruction independently actionable.', 'essential', 'body'), component('Substep', 'Break down a complex instruction only when needed.', 'optional', 'body'), component('Expected result', 'Show what should happen after a step.', 'recommended', 'body'), component('Screenshot or image', 'Visually demonstrate software or physical steps.', 'whenRelevant', 'body'), component('Tip or note', 'Offer a shortcut or supporting clarification.', 'common', 'body'), component('Troubleshooting item', 'Name the problem, cause, and solution.', 'stronglyRecommended', 'back'), component('FAQ', 'Answer common questions in a scannable way.', 'recommended', 'back'), component('Glossary', 'Define terminology for technical material.', 'whenRelevant', 'back'), component('Contact and support information', 'Show where readers can get help.', 'recommended', 'back'),
  ],
  'Essay Collection': [component('Cover', 'Name the collection and its larger question.', 'recommended', 'front'), component('Title page', 'Give the collection its formal title and author credit.', 'recommended', 'front'), component('Table of contents', 'Let readers see the conversation between essays.', 'recommended', 'front'), component('Introduction', 'Frame the collection’s question and invitation.', 'recommended', 'front'), component('Themed section', 'Give essays a deliberate order and breathing room.', 'recommended', 'body'), component('Interlude', 'Create a pause or pivot when the collection needs one.', 'optional', 'body'), component('Example or case study', 'Make an argument tangible when useful.', 'common', 'body'), component('Reflection', 'Invite the reader to sit with an implication.', 'common', 'body'), component('Notes or sources', 'Add context or citations where needed.', 'whenRelevant', 'back'), component('Contributor notes', 'Offer context for other voices in the room.', 'optional', 'back')],
  Script: [component('Title page', 'Give the script a clear first impression.', 'recommended', 'front'), component('Logline and cast list', 'Keep the premise and voices easy to reference.', 'recommended', 'front'), component('Act or sequence break', 'Create visible movement through the larger arc.', 'recommended', 'body'), component('Scene', 'Track location, time, purpose, and change.', 'essential', 'body'), component('Dialogue', 'Give every voice a playable, distinct rhythm.', 'essential', 'body'), component('Scene transition', 'Mark meaningful changes in place, time, or energy.', 'common', 'body'), component('Production note', 'Capture sound, visual, staging, or performance needs.', 'optional', 'back'), component('Character list', 'Keep the cast easy to reference.', 'common', 'front'), component('Final beat', 'Make the ending playable and emotionally legible.', 'recommended', 'back')],
  'Speech or Presentation': [component('Opening hook', 'Earn attention with a question, image, story, or surprise.', 'recommended', 'front'), component('Audience promise', 'Tell people why the next few minutes matter.', 'stronglyRecommended', 'front'), component('Main point', 'Keep the core ideas few, clear, and repeatable.', 'essential', 'body'), component('Story or example', 'Give the ideas a human shape.', 'recommended', 'body'), component('Slide or speaker note', 'Separate what people see from what you say.', 'optional', 'body'), component('Audience interaction', 'Make room for people to enter the conversation.', 'optional', 'body'), component('Call to action', 'End with a clear next step or resonant line.', 'recommended', 'back'), component('Q&A', 'Leave space for questions when the room calls for it.', 'optional', 'back')],
  'Custom Project': [component('Cover', 'Give the project a first invitation.', 'recommended', 'front'), component('Title page', 'Name the work and its creator.', 'recommended', 'front'), component('Introduction', 'Help someone understand how to enter the work.', 'common', 'front'), component('Part', 'Group sections when the project needs a larger shape.', 'optional', 'body'), component('Section', 'Give the work a repeatable building block.', 'recommended', 'body'), component('Example', 'Make the idea tangible.', 'common', 'body'), component('Reflection', 'Invite the reader to apply or respond.', 'optional', 'body'), component('Conclusion', 'Let the work feel intentionally complete.', 'recommended', 'back'), component('Resource list', 'Keep supporting materials available.', 'optional', 'back'), component('About the author', 'Offer a short creator biography.', 'common', 'back')],
};

// The reference catalog is intentionally broad. These are mostly optional or
// context-dependent so writers can discover useful possibilities without
// being told that every book needs every piece.
const universalComponents: StructureItem[] = [
  component('Half-title page', 'A quiet title-only page before the full title page.', 'optional', 'front'),
  component('Title page', 'Give the work its formal title and creator credit.', 'recommended', 'front'),
  component('Copyright page', 'Add publication, edition, ISBN, and rights information when publishing.', 'whenRelevant', 'front'),
  component('Dedication', 'Offer a brief personal dedication before the work begins.', 'optional', 'front'),
  component('Epigraph', 'Use a quotation to establish theme or mood.', 'optional', 'front'),
  component('Table of contents', 'Help readers navigate longer or multi-part works.', 'whenRelevant', 'front'),
  component('Foreword', 'Invite another person to introduce or endorse the work.', 'optional', 'front'),
  component('Preface', 'Explain why and how the work came to be.', 'optional', 'front'),
  component('Author’s note', 'Add context, accuracy notes, or a personal explanation.', 'optional', 'front'),
  component('Introduction', 'Prepare the reader for the subject, promise, or approach.', 'common', 'front'),
  component('How to use this book', 'Explain the process when the work is interactive or guided.', 'whenRelevant', 'front'),
  component('List of figures', 'Give readers a quick index of illustrations and diagrams.', 'optional', 'front'),
  component('List of tables', 'Give readers a quick index of tables and reference charts.', 'optional', 'front'),
  component('Part', 'Group chapters or sections into a larger movement.', 'optional', 'body'),
  component('Chapter', 'Use a primary unit for a longer or informational work.', 'whenRelevant', 'body'),
  component('Section', 'Create a repeatable subdivision inside a chapter or part.', 'common', 'body'),
  component('Subsection', 'Break down dense informational material when needed.', 'common', 'body'),
  component('Scene', 'Track a story event at a particular time and place.', 'whenRelevant', 'body'),
  component('Entry', 'Use a dated or individual unit in a journal-like work.', 'whenRelevant', 'body'),
  component('Lesson', 'Create a bounded educational unit.', 'whenRelevant', 'body'),
  component('Module', 'Group related lessons, activities, or decisions.', 'whenRelevant', 'body'),
  component('Interlude', 'Create a short break, alternate perspective, or change of pace.', 'optional', 'body'),
  component('Sidebar', 'Place supporting information beside the main flow.', 'optional', 'body'),
  component('Callout', 'Highlight an important quote, definition, tip, or warning.', 'optional', 'body'),
  component('Image or illustration', 'Add visual content when it serves the work.', 'whenRelevant', 'body'),
  component('Caption', 'Explain or identify an image, figure, or photograph.', 'whenRelevant', 'body'),
  component('Table or chart', 'Present structured information or data visually.', 'whenRelevant', 'body'),
  component('Quote block', 'Give an important quotation visual emphasis.', 'optional', 'body'),
  component('Checklist', 'Track tasks, requirements, or completion.', 'whenRelevant', 'body'),
  component('Exercise', 'Give the reader a way to practice or apply an idea.', 'whenRelevant', 'body'),
  component('Prompt', 'Invite the reader to write, answer, or reflect.', 'whenRelevant', 'body'),
  component('Response area', 'Leave space for the reader’s answer or notes.', 'whenRelevant', 'body'),
  component('Example', 'Make an idea or technique concrete.', 'common', 'body'),
  component('Case study', 'Show a detailed real or hypothetical application.', 'optional', 'body'),
  component('Summary', 'Recap a chapter, lesson, or section before moving on.', 'common', 'body'),
  component('Key takeaways', 'Make the most important points easy to remember.', 'whenRelevant', 'body'),
  component('Quiz', 'Check understanding when the work has teachable answers.', 'optional', 'body'),
  component('Reflection', 'Invite personal thought, meaning-making, or application.', 'common', 'body'),
  component('Conclusion', 'Resolve the central argument or gather the work’s movement.', 'common', 'back'),
  component('Epilogue', 'Show what happens after the main story or argument.', 'optional', 'back'),
  component('Afterword', 'Add a reflection written after the main work is complete.', 'optional', 'back'),
  component('Acknowledgments', 'Credit the people who helped the work come into being.', 'common', 'back'),
  component('Appendix', 'Keep supplementary information available without interrupting the main flow.', 'optional', 'back'),
  component('Glossary', 'Define important terms for readers who need a reference.', 'whenRelevant', 'back'),
  component('Endnotes', 'Collect citations and extra explanations at the end.', 'whenRelevant', 'back'),
  component('Footnotes', 'Keep notes attached to the page where they are needed.', 'whenRelevant', 'back'),
  component('Bibliography', 'List sources used or recommended for further study.', 'whenRelevant', 'back'),
  component('References', 'Provide a formal citation list for researched work.', 'whenRelevant', 'back'),
  component('Further reading', 'Point curious readers toward useful next resources.', 'optional', 'back'),
  component('Resource list', 'Gather websites, tools, contacts, or templates.', 'whenRelevant', 'back'),
  component('Answer key', 'Allow self-correction when exercises or quizzes have definite answers.', 'whenRelevant', 'back'),
  component('Index', 'Help readers locate topics in a reference-heavy work.', 'whenRelevant', 'back'),
  component('Discussion questions', 'Extend the work into a classroom, group, or book-club conversation.', 'optional', 'back'),
  component('About the author', 'Offer a short creator biography.', 'common', 'back'),
  component('About the illustrator', 'Credit an illustrator with a short biography.', 'whenRelevant', 'back'),
  component('Also by the author', 'Point readers toward other work.', 'optional', 'back'),
  component('Preview or teaser', 'Offer a sample of another project.', 'optional', 'back'),
  component('Contact or community', 'Share a website, newsletter, or reader community.', 'optional', 'back'),
  component('Back-cover summary', 'Give a short, clear reading promise for the finished work.', 'whenRelevant', 'back'),
];

const typeComponentAdditions: Record<string, StructureItem[]> = {
  'Fiction Book': [
    component('Flashback marker', 'Make shifts into the past easy to follow.', 'optional', 'body'),
    component('Letter, message, or document', 'Use in-world communication as part of the story.', 'optional', 'body'),
    component('Collection, section, or story', 'Use this shape for a short-story collection instead of a single novel arc.', 'whenRelevant', 'body'),
    component('Discussion questions', 'Give readers a way to keep talking after the final page.', 'optional', 'back'),
    component('Author’s note', 'Explain research, historical context, or creative choices.', 'optional', 'back'),
  ],
  'Nonfiction Book': [
    component('Key idea', 'Name the principle a reader should carry forward.', 'common', 'body'),
    component('Quote or citation', 'Support an argument with another voice or source.', 'common', 'body'),
    component('Myth versus fact', 'Correct a misconception with a clear contrast.', 'optional', 'body'),
    component('Action step', 'Turn understanding into a practical next move.', 'common', 'body'),
    component('Reflection questions', 'Help readers apply the argument to their own situation.', 'optional', 'body'),
    component('Acknowledgments', 'Credit contributors and research support.', 'common', 'back'),
  ],
  'Memoir & Biography': [
    component('Family tree', 'Clarify relationships when the story spans generations.', 'optional', 'front'),
    component('Timeline', 'Make major events easy to place in time.', 'optional', 'back'),
    component('Cast of people', 'Identify important people and their relationship to the subject.', 'optional', 'front'),
    component('Photo section', 'Gather photographs and documents into a dedicated visual section.', 'whenRelevant', 'back'),
    component('Letter or document', 'Include primary material that gives the life a direct voice.', 'optional', 'body'),
    component('Permissions and credits', 'Credit photographs, quoted material, and contributed work.', 'whenRelevant', 'back'),
  ],
  'Children’s Book': [
    component('Chapter', 'Support early readers and chapter books with a longer arc.', 'whenRelevant', 'body'),
    component('Reading level', 'Record the intended reading range for early readers.', 'whenRelevant', 'front'),
    component('Vocabulary word', 'Introduce a new word in a useful context.', 'optional', 'body'),
    component('Vocabulary list', 'Gather words that may need extra explanation.', 'whenRelevant', 'back'),
    component('Comprehension questions', 'Check understanding after an educational story.', 'optional', 'back'),
    component('Activity page', 'Add coloring, matching, or reflection after the story.', 'optional', 'back'),
    component('Glossary', 'Explain terms when the book teaches a topic.', 'whenRelevant', 'back'),
    component('Character speech', 'Let a character’s voice carry the story aloud.', 'optional', 'body'),
    component('Closing page', 'Give the final page turn a quiet, satisfying landing.', 'recommended', 'back'),
  ],
  'Poetry Collection': [
    component('Collection introduction', 'Establish context without closing down interpretation.', 'optional', 'front'),
    component('Epigraph', 'Introduce a poem or section with a resonant quotation.', 'optional', 'front'),
    component('Illustration or photograph', 'Accompany selected poems with visual work.', 'optional', 'body'),
    component('About the poet', 'Offer a short introduction to the poet.', 'common', 'back'),
    component('Index of titles', 'List poems alphabetically for reference.', 'optional', 'back'),
    component('Index of first lines', 'Offer the traditional poetry finding aid.', 'optional', 'back'),
  ],
  'Journal or Diary': [
    component('Instructions', 'Explain the process for a guided journal.', 'whenRelevant', 'front'),
    component('Gratitude list', 'Record positive moments when that serves the journal’s purpose.', 'optional', 'body'),
    component('Habit tracker', 'Track a repeated behavior across entries.', 'optional', 'body'),
    component('Rating scale', 'Score energy, mood, or progress when useful.', 'optional', 'body'),
    component('Morning entry', 'Set an intention or plan for the day.', 'optional', 'body'),
    component('Evening reflection', 'Review what the day revealed.', 'optional', 'body'),
    component('Milestone page', 'Pause to celebrate a meaningful achievement.', 'optional', 'back'),
    component('Quote or affirmation', 'Add inspiration without making it mandatory.', 'optional', 'body'),
  ],
  Workbook: [
    component('Fill-in table', 'Organize repeated learner responses in a structured grid.', 'common', 'body'),
    component('Rating scale', 'Support self-assessment or confidence tracking.', 'optional', 'body'),
    component('Quiz', 'Test understanding when the material has definite answers.', 'optional', 'body'),
    component('Challenge', 'Offer an advanced application for learners who want more.', 'optional', 'body'),
    component('Final assessment', 'Give the learner a clear way to review the full path.', 'whenRelevant', 'back'),
    component('Downloadable resource', 'Provide a template or tool to use outside the workbook.', 'optional', 'back'),
  ],
  'Guide or Manual': [
    component('Important notice', 'Bring a critical boundary or requirement into view.', 'common', 'body'),
    component('Warning', 'Prevent mistakes or harm with a clear caution.', 'whenRelevant', 'body'),
    component('Note', 'Add supporting clarification without interrupting the main step.', 'common', 'body'),
    component('Tip', 'Offer a useful shortcut or practical insight.', 'common', 'body'),
    component('Example', 'Demonstrate what correct usage looks like.', 'recommended', 'body'),
    component('Diagram', 'Explain a system, relationship, or process visually.', 'optional', 'body'),
    component('Reference table', 'Give readers quick-lookup information.', 'optional', 'back'),
    component('Version history', 'Record meaningful changes across manual releases.', 'recommended', 'back'),
  ],
};

const structureKeyAliases: Record<string, string> = {
  'title page + dedication': 'title-page', 'title and copyright pages': 'title-page', 'title page + contents': 'title-page',
  'dedication or epigraph': 'dedication', 'introduction + reader promise': 'introduction', 'core chapters': 'chapter',
  'chapters': 'chapter', 'sections and subsections': 'section', 'section and subsection': 'section', 'prologue or opening scene': 'prologue',
  'part by life stage or theme': 'part', 'life chapters by era or theme': 'chapter', 'turning-point chapters': 'chapter',
  'photos, documents, or timeline': 'photograph', 'reflection / epilogue': 'reflection', 'notes and acknowledgments': 'acknowledgments',
  'exercises or reflection prompts': 'exercise', 'exercises and worksheets': 'exercise', 'case studies or examples': 'case-study',
  'conclusion + action plan': 'conclusion', 'conclusion / final piece': 'conclusion', 'resources / bibliography': 'bibliography',
  'notes / resources': 'resource-list', 'notes / sources': 'references', 'sections or movements': 'section',
  'themed sections': 'section', 'daily or weekly entry pages': 'entry', 'progress check-ins': 'progress-tracker',
  'free-write pages': 'free-writing-area', 'lessons or modules': 'lesson', 'answer key or examples': 'answer-key',
  'capstone / action plan': 'action-step', 'interludes': 'interlude', 'production notes': 'production-note',
  'act or sequence breaks': 'act-or-sequence-break', 'logline + cast list': 'logline-and-cast-list', 'logline and cast list': 'logline-and-cast-list',
  'stories or examples': 'example', 'story or example': 'example', 'slides / speaker notes': 'slide-or-speaker-note',
  'q&a or interaction': 'q-a', 'closing call to action': 'call-to-action', 'how to use this journal': 'how-to-use-this-book',
  'how to use the workbook': 'how-to-use-this-book', 'welcome + how to use': 'how-to-use-this-book', 'welcome + learning outcomes': 'learning-objective', 'art direction notes': 'illustration-direction',
  'illustration or map': 'image-or-illustration', 'illustration': 'image-or-illustration', 'image or illustration': 'image-or-illustration',
  'screenshot or image': 'image-or-illustration', 'photo caption': 'caption', 'summary': 'summary', 'chapter summary': 'summary',
  'module summary': 'summary', 'key takeaways': 'key-takeaways', 'data, chart, or table': 'table-or-chart', 'table or chart': 'table-or-chart',
  'tip or note': 'tip', 'index of titles or first lines': 'index', 'index of titles': 'index', 'index of first lines': 'index',
  'sources or endnotes': 'endnotes', 'glossary / references': 'references', 'resources': 'resource-list',
};

const structureKeyFor = (label: string) => {
  const normalized = label.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
  return structureKeyAliases[normalized] ?? normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

const legacyStructureAliases: Record<string, string[]> = {
  'title-page': ['Title page + dedication', 'Title and copyright pages', 'Title page + contents'],
  dedication: ['Title page + dedication', 'Dedication or epigraph'],
  'copyright-page': ['Title and copyright pages'],
  'table-of-contents': ['Title page + contents'],
  epigraph: ['Dedication or epigraph'],
  exercise: ['Exercises or reflection prompts', 'Exercises and worksheets'],
  worksheet: ['Exercises and worksheets'],
  reflection: ['Exercises or reflection prompts', 'Reflection / epilogue'],
  'case-study': ['Case studies or examples'],
  example: ['Case studies or examples', 'Answer key or examples'],
  conclusion: ['Conclusion + action plan', 'Conclusion / final piece'],
  'action-step': ['Conclusion + action plan', 'Capstone / action plan'],
  bibliography: ['Resources / bibliography'],
  'resource-list': ['Notes / resources', 'Resources'],
  references: ['Notes / sources', 'Glossary / references'],
  section: ['Section and subsection', 'Sections or movements', 'Themed sections'],
  subsection: ['Section and subsection'],
  chapter: ['Life chapters by era or theme', 'Turning-point chapters', 'Core chapters'],
  part: ['Life chapters by era or theme'],
  entry: ['Daily or weekly entry pages'],
  'progress-tracker': ['Progress check-ins'],
  'free-writing-area': ['Free-write pages'],
  lesson: ['Lessons or modules'],
  module: ['Lessons or modules'],
  'answer-key': ['Answer key or examples'],
  'how-to-use-this-book': ['Welcome + how to use', 'How to use this journal', 'How to use the workbook'],
  'learning-objective': ['Welcome + learning outcomes'],
  acknowledgments: ['Notes and acknowledgments'],
  photograph: ['Photos, documents, or timeline'],
  document: ['Photos, documents, or timeline'],
  timeline: ['Photos, documents, or timeline'],
  prologue: ['Opening scene or prologue'],
  'illustration-direction': ['Art direction notes'],
  interlude: ['Interludes'],
  'production-note': ['Production notes'],
  'act-or-sequence-break': ['Act or sequence breaks'],
  'logline-and-cast-list': ['Logline + cast list'],
  'slide-or-speaker-note': ['Slides / speaker notes'],
  'q-a': ['Q&A or interaction'],
  'audience-interaction': ['Q&A or interaction'],
  'call-to-action': ['Closing call to action'],
  index: ['Index of titles or first lines', 'Index of titles', 'Index of first lines'],
  endnotes: ['Sources or endnotes'],
  'page-turn-marker': ['Page-turn beats'],
  summary: ['Chapter summary', 'Module summary'],
  'key-takeaways': ['Key takeaways'],
  'table-or-chart': ['Data, chart, or table'],
  tip: ['Tip or note'],
};

const structureCategoryFor = (label: string): StructureCategory => /cover|title|copyright|dedication|epigraph|foreword|preface|author.?s note|introduction|table|how to use|ownership|intention|audience promise|logline|cast list|reading level/i.test(label) ? 'front' : /back-cover|conclusion|epilogue|afterword|acknowledg|about the|bibliograph|reference|resource|glossary|index|answer key|contact|support|final beat|call to action|q&a|closing/i.test(label) ? 'back' : 'body';

function getStructureItems(type: string, blueprint: PlanBlueprint): StructureItem[] {
  const baseItems = blueprint.structureItems.map((item) => ({ ...item, key: structureKeyFor(item.label), recommendation: item.recommendation ?? (item.recommended ? 'recommended' : 'optional'), category: item.category ?? structureCategoryFor(item.label) }));
  const merged = new Map<string, StructureItem>(baseItems.map((item) => [item.key!, item]));
  const applyCatalog = (items: StructureItem[]) => items.forEach((item) => {
    const normalized = { ...item, key: structureKeyFor(item.label), recommendation: item.recommendation ?? (item.recommended ? 'recommended' : 'optional'), category: item.category ?? structureCategoryFor(item.label) };
    merged.set(normalized.key!, normalized);
  });
  applyCatalog(universalComponents);
  applyCatalog(guidedComponents[type] ?? guidedComponents['Custom Project']);
  applyCatalog(typeComponentAdditions[type] ?? []);
  return Array.from(merged.values());
}

const recommendationLabel = (recommendation: Recommendation) => ({ essential: 'ESSENTIAL', stronglyRecommended: 'STRONGLY REC.', recommended: 'RECOMMENDED', common: 'COMMON', optional: 'OPTIONAL', whenRelevant: 'WHEN RELEVANT' }[recommendation]);
const structureCategoryLabel = (category: StructureCategory) => ({ front: 'FRONT MATTER', body: 'BODY', back: 'BACK MATTER' }[category]);
const recommendationTagStyle = (recommendation: Recommendation) => {
  if (recommendation === 'essential') return s.essentialTag;
  if (recommendation === 'stronglyRecommended') return s.stronglyRecommendedTag;
  if (recommendation === 'recommended') return s.recommendedTag;
  if (recommendation === 'common') return s.commonTag;
  if (recommendation === 'whenRelevant') return s.whenRelevantTag;
  return s.optionalTag;
};

const defaultStructureFor = (items: StructureItem[]) => items.reduce<Record<string, boolean>>((result, item) => {
  result[item.key ?? structureKeyFor(item.label)] = item.recommended;
  return result;
}, {});

function structureSelectionKeys(item: StructureItem, blueprint: PlanBlueprint): string[] {
  const key = item.key ?? structureKeyFor(item.label);
  return Array.from(new Set([
    key,
    item.label,
    ...blueprint.structureItems.filter((candidate) => structureKeyFor(candidate.label) === key).map((candidate) => candidate.label),
    ...(legacyStructureAliases[key] ?? []),
  ]));
}

function isStructureEnabled(structure: Record<string, boolean>, item: StructureItem, blueprint: PlanBlueprint): boolean {
  const savedValue = structureSelectionKeys(item, blueprint).map((key) => structure[key]).find((value) => typeof value === 'boolean');
  return savedValue ?? item.recommended;
}

const defaultPlanFor = (type: string): ProjectPlan => ({
  structure: defaultStructureFor(getStructureItems(type, planBlueprints[type] ?? planBlueprints['Custom Project'])),
  idea: '', plotThread: '', people: '', plotNotes: {}, unitIdeas: [], conclusion: '', partNotes: {}, chapterEnds: {}, drafts: {}, writeIndex: 0, activity: {}, planningMethod: 'plantser',
  targetWords: String((Number.parseInt((planBlueprints[type] ?? planBlueprints['Custom Project']).defaultPages, 10) || 0) * 250),
});

const makeBookezImage = (project: Project, asset: ImagePicker.ImagePickerAsset, connectedPartKey?: string): BookezImage => {
  const config = getImageSystemConfig(project.type);
  const timestamp = Date.now();
  const title = asset.fileName?.replace(/\.[^.]+$/, '') || config.itemLabel;
  const includeInExport = config.includeInExportByDefault;
  return {
    id: `image-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    uri: asset.uri,
    fileName: asset.fileName ?? undefined,
    mimeType: asset.mimeType ?? undefined,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize ?? undefined,
    title,
    caption: '',
    captionRequested: false,
    altText: '',
    credit: '',
    source: '',
    date: '',
    location: '',
    people: '',
    permissionStatus: 'unknown',
    archiveName: '',
    sourceCitation: '',
    notes: '',
    connectedPartKey,
    placement: config.placements[0] ?? 'inline',
    textPlacement: 'bottom',
    fullBleed: config.mode === 'IMAGE_LED',
    includeInExport,
    referenceOnly: !includeInExport,
    status: config.mode === 'IMAGE_LED' ? 'idea' : 'final',
    role: config.roles[0],
    order: (project.images ?? []).length,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const requestImage = async (project: Project, onPicked: (asset: ImagePicker.ImagePickerAsset) => void) => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photo access needed', 'Allow Bookez to access your photos so you can add visuals to this project.');
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
  if (!result.canceled && result.assets[0]) onPicked(result.assets[0]);
};

type ImageSystemCardProps = {
  project: Project;
  images: BookezImage[];
  connectedPartKey?: string;
  onAddImage: () => void;
  onReplaceImage: (image: BookezImage) => void;
  onUpdateImage: (id: string, changes: Partial<BookezImage>) => void;
  onRemoveImage: (id: string) => void;
  onEnableImages?: () => void;
  compact?: boolean;
  emptyLabel?: string;
  initialExpandedId?: string | null;
};

function ImageSystemCard({ project, images, connectedPartKey, onAddImage, onReplaceImage, onUpdateImage, onRemoveImage, onEnableImages, compact = false, emptyLabel, initialExpandedId }: ImageSystemCardProps) {
  const config = getImageSystemConfig(project.type);
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);
  const [captionOpenIds, setCaptionOpenIds] = useState<string[]>([]);
  const scopedImages = connectedPartKey ? images.filter((image) => image.connectedPartKey === connectedPartKey) : images;
  const label = connectedPartKey ? `${config.itemLabel} for this part` : config.label;
  const visible = imageToolsVisible(project);
  if (!visible) return <View style={imageS.hiddenCard}><View style={imageS.hiddenIcon}><Text style={imageS.hiddenIconText}>＋</Text></View><View style={imageS.cardCopy}><Text style={imageS.cardTitle}>Add {config.label.toLowerCase()} when you need them</Text><Text style={imageS.cardHint}>Visual tools are off for this project type until you enable them.</Text></View><Pressable onPress={onEnableImages} style={imageS.enableButton} accessibilityLabel="Enable image tools"><Text style={imageS.enableButtonText}>Enable</Text></Pressable></View>;

  return <View style={[imageS.card, compact && imageS.cardCompact]}>
    <View style={imageS.cardHeader}><View style={imageS.cardIcon}><Text style={imageS.cardIconText}>▧</Text></View><View style={imageS.cardCopy}><Text style={imageS.cardKicker}>{config.mode === 'IMAGE_LED' ? 'VISUAL PLAN' : 'OPTIONAL VISUALS'}</Text><Text style={imageS.cardTitle}>{label}</Text><Text style={imageS.cardHint}>{scopedImages.length ? `${scopedImages.length} added · ${imageModeLabel(config.mode)}` : config.mode === 'IMAGE_LED' ? 'Every page can carry an illustration slot.' : 'Keep image tools close without making them take over.'}</Text></View><Pressable onPress={onAddImage} style={imageS.addButton} accessibilityRole="button" accessibilityLabel={`Add ${config.itemLabel}`}><Text style={imageS.addButtonText}>＋</Text></Pressable></View>
    {!scopedImages.length && <Pressable onPress={onAddImage} style={imageS.emptyButton} accessibilityRole="button"><Text style={imageS.emptyIcon}>▧</Text><View style={imageS.emptyCopy}><Text style={imageS.emptyTitle}>{emptyLabel ?? `Add ${config.itemLabel}`}</Text><Text style={imageS.emptyHint}>{config.mode === 'IMAGE_LED' ? 'Start with an idea, sketch, or finished image.' : 'Choose a photo or visual from your device.'}</Text></View><Text style={imageS.emptyArrow}>›</Text></Pressable>}
    {scopedImages.map((image) => <View key={image.id} style={imageS.imageRow}>
      <Image source={{ uri: image.uri }} style={imageS.thumbnail} resizeMode="cover" />
      <View style={imageS.imageCopy}><Text numberOfLines={1} style={imageS.imageTitle}>{image.title || config.itemLabel}</Text><Text numberOfLines={1} style={imageS.imageMeta}>{image.referenceOnly ? 'Private reference' : imagePlacementLabel(image.placement)}{image.status ? ` · ${imageStatusLabel(image.status)}` : ''}</Text><View style={imageS.imageActions}><Pressable onPress={() => setExpandedId(expandedId === image.id ? null : image.id)} style={imageS.detailButton}><Text style={imageS.detailButtonText}>{expandedId === image.id ? 'Hide details' : 'Image details'}</Text></Pressable><Pressable onPress={() => { setCaptionOpenIds((current) => current.includes(image.id) ? current.filter((id) => id !== image.id) : [...current, image.id]); setExpandedId(image.id); }} style={imageS.captionButton} accessibilityLabel={image.captionRequested ? 'Hide caption options' : 'Add image caption'}><Text style={imageS.captionButtonText}>{image.captionRequested ? (captionOpenIds.includes(image.id) ? 'Hide caption' : 'Caption') : '＋ Caption'}</Text></Pressable><Pressable onPress={() => onReplaceImage(image)} style={imageS.replaceButton}><Text style={imageS.replaceButtonText}>Replace</Text></Pressable></View></View>
      <Pressable onPress={() => onRemoveImage(image.id)} style={imageS.removeButton} accessibilityLabel={`Remove ${image.title || config.itemLabel}`}><Text style={imageS.removeButtonText}>×</Text></Pressable>
      {expandedId === image.id && <View style={imageS.details}><TextInput value={image.title} onChangeText={(value) => onUpdateImage(image.id, { title: value })} placeholder="Image title" placeholderTextColor="#A0A3BB" style={imageS.detailInput} accessibilityLabel="Image title" />{(Boolean(image.caption?.trim()) || captionOpenIds.includes(image.id)) && <View style={imageS.captionEditor}><TextInput value={image.caption} onChangeText={(value) => onUpdateImage(image.id, { caption: value, captionRequested: true })} placeholder="Example: Figure 1. A quiet morning in the garden." placeholderTextColor="#A0A3BB" style={imageS.detailInput} accessibilityLabel="Image caption" /><Pressable onPress={() => { onUpdateImage(image.id, { caption: '', captionRequested: false }); setCaptionOpenIds((current) => current.filter((id) => id !== image.id)); }} style={imageS.removeCaptionButton}><Text style={imageS.removeCaptionText}>Remove caption requirement</Text></Pressable></View>}<TextInput value={image.altText} onChangeText={(value) => onUpdateImage(image.id, { altText: value })} placeholder="Alt text for accessibility" placeholderTextColor="#A0A3BB" style={imageS.detailInput} accessibilityLabel="Image alt text" /><View style={imageS.detailFieldRow}><Text style={imageS.detailLabel}>PLACEMENT</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={imageS.detailPills}>{config.placements.map((placement) => <Pressable key={placement} onPress={() => onUpdateImage(image.id, { placement })} style={[imageS.detailPill, image.placement === placement && imageS.detailPillSelected]}><Text style={[imageS.detailPillText, image.placement === placement && imageS.detailPillTextSelected]}>{imagePlacementLabel(placement)}</Text></Pressable>)}</ScrollView></View>{config.mode === 'IMAGE_LED' && <View style={imageS.detailFieldRow}><Text style={imageS.detailLabel}>ILLUSTRATION STATUS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={imageS.detailPills}>{(['notStarted', 'idea', 'briefReady', 'sketch', 'revision', 'final'] as ImageStatus[]).map((status) => <Pressable key={status} onPress={() => onUpdateImage(image.id, { status })} style={[imageS.detailPill, image.status === status && imageS.detailPillSelected]}><Text style={[imageS.detailPillText, image.status === status && imageS.detailPillTextSelected]}>{imageStatusLabel(status)}</Text></Pressable>)}</ScrollView></View>}{config.dateLocationRelevant && <View style={imageS.detailTwoColumn}><TextInput value={image.date} onChangeText={(value) => onUpdateImage(image.id, { date: value })} placeholder="Date" placeholderTextColor="#A0A3BB" style={[imageS.detailInput, imageS.detailHalf]} accessibilityLabel="Image date" /><TextInput value={image.location} onChangeText={(value) => onUpdateImage(image.id, { location: value })} placeholder="Location" placeholderTextColor="#A0A3BB" style={[imageS.detailInput, imageS.detailHalf]} accessibilityLabel="Image location" /></View>}<TextInput value={image.credit} onChangeText={(value) => onUpdateImage(image.id, { credit: value })} placeholder={config.creditsRecommended ? 'Credit / source (recommended)' : 'Credit / source (optional)'} placeholderTextColor="#A0A3BB" style={imageS.detailInput} accessibilityLabel="Image credit" /><View style={imageS.detailSwitchRow}><View style={imageS.detailSwitchCopy}><Text style={imageS.detailSwitchTitle}>Include in Book Studio</Text><Text style={imageS.detailSwitchHint}>{image.referenceOnly ? 'Private reference images stay out of publication preview.' : 'This image can appear in the publication preview.'}</Text></View><Switch value={image.includeInExport && !image.referenceOnly} onValueChange={(value) => onUpdateImage(image.id, { includeInExport: value, referenceOnly: !value })} trackColor={{ false: '#D7D9E6', true: '#BAB6F1' }} thumbColor={image.includeInExport && !image.referenceOnly ? C.periwinkle : '#FFF'} /></View><View style={imageS.detailSwitchRow}><View style={imageS.detailSwitchCopy}><Text style={imageS.detailSwitchTitle}>Full bleed</Text><Text style={imageS.detailSwitchHint}>Let the visual run to the page edge when the format supports it.</Text></View><Switch value={image.fullBleed} onValueChange={(value) => onUpdateImage(image.id, { fullBleed: value })} trackColor={{ false: '#D7D9E6', true: '#BAB6F1' }} thumbColor={image.fullBleed ? C.periwinkle : '#FFF'} /></View><Text style={imageS.detailResolution}>{image.width && image.height ? `${image.width} × ${image.height}px` : 'Resolution not available'} · {imagePermissionLabel(image.permissionStatus)}</Text></View>}
    </View>)}
  </View>;
}

function ImagePreview({ image, config, placeholderLabel, onPress }: { image?: BookezImage; config: ImageSystemConfig; placeholderLabel?: string; onPress?: () => void }) {
  const content = image ? <><Image source={{ uri: image.uri }} style={imageS.previewImage} resizeMode={image.fullBleed ? 'cover' : 'contain'} /><View style={imageS.previewOverlay}><Text style={imageS.previewPlacement}>{imagePlacementLabel(image.placement)}</Text></View>{image.caption && <Text style={imageS.previewCaption}>{image.caption}</Text>}{image.credit && !image.referenceOnly && <Text style={imageS.previewCredit}>{image.credit}</Text>}</> : <><Text style={imageS.placeholderIcon}>▧</Text><Text style={imageS.placeholderTitle}>{placeholderLabel ?? `${config.itemLabel} needed`}</Text><Text style={imageS.placeholderHint}>Tap to add a publication image.</Text></>;
  return <Pressable onPress={onPress} style={[imageS.preview, !image && imageS.previewPlaceholder]} accessibilityRole="button">{content}</Pressable>;
}

function Ambient({ children }: { children: React.ReactNode }) {
  return <View style={s.page}>
    <LinearGradient colors={['#EAF0FF', '#FAF7FF', '#FFF9F1']} style={StyleSheet.absoluteFill} />
    <View style={[s.orb, s.orbOne]} /><View style={[s.orb, s.orbTwo]} /><View style={[s.orb, s.orbThree]} />
    {children}
  </View>;
}

function PageHeader({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  return <View style={s.header}>
    <View><Text style={s.overline}>BOOKEZ STUDIO</Text><Text style={s.pageTitle}>{page}</Text></View>
    <View style={s.headerActions}>
      <Pressable onPress={() => onPage('Stats')} style={s.tinyButton}><Text style={s.tinyButtonText}>▥</Text></Pressable>
      <Pressable onPress={() => onPage('Profile')} style={s.avatar}><Text style={s.avatarText}>L</Text><View style={s.avatarDot} /></Pressable>
    </View>
  </View>;
}

function Pill({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable onPress={onPress} style={[s.pill, selected && s.pillSelected]}><Text style={[s.pillText, selected && s.pillTextSelected]}>{label}</Text></Pressable>;
}

function Library({ projects, activeProject, onPage, onSelectProject, onProjectsChange, onOpenBookStudio }: { projects: Project[]; activeProject: string; onPage: (page: Page) => void; onSelectProject: (title: string) => void; onProjectsChange: (projects: Project[]) => void; onOpenBookStudio: (title: string, section: StudioSection) => void }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(projectTypes[0]);
  const [projectName, setProjectName] = useState('');
  const [menuProject, setMenuProject] = useState<Project | null>(null);
  const [renameProject, setRenameProject] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [focusProjectTitle, setFocusProjectTitle] = useState<string | null>(null);
  const [focusPickerOpen, setFocusPickerOpen] = useState(false);

  const activeBooks = projects.filter((project) => !project.archived);
  const closestProject = [...activeBooks].sort((a, b) => {
    const progressDifference = getJourneySnapshot(b).progressPercent - getJourneySnapshot(a).progressPercent;
    return progressDifference || (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  })[0] ?? projects[0];
  const focusProject = projects.find((project) => project.title === focusProjectTitle && !project.archived) ?? closestProject;
  const focusSnapshot = focusProject ? getJourneySnapshot(focusProject) : null;
  const focusIsManual = Boolean(focusProjectTitle && focusProject?.title === focusProjectTitle);

  const openFocusBook = (nextPage: Page) => {
    if (!focusProject) return;
    onSelectProject(focusProject.title);
    onPage(nextPage);
  };

  const createProject = () => {
    const name = projectName.trim() || `Untitled ${selectedType.name}`;
    onProjectsChange([{ title: name, color: selectedType.color, mark: selectedType.icon, type: selectedType.name, pageGoal: planBlueprints[selectedType.name].defaultPages, unitGoal: planBlueprints[selectedType.name].defaultUnits, plan: defaultPlanFor(selectedType.name), updatedAt: Date.now() }, ...projects]);
    onSelectProject(name);
    setProjectName('');
    setComposerOpen(false);
  };

  const selectAndOpen = (project: Project, nextPage: Page) => { onSelectProject(project.title); setMenuProject(null); onPage(nextPage); };
  const duplicateProject = (project: Project) => {
    const title = `${project.title} Copy`;
    const copy: Project = { ...project, title, updatedAt: Date.now(), archived: false, plan: { ...project.plan, structure: { ...project.plan.structure }, plotNotes: { ...project.plan.plotNotes }, unitIdeas: [...project.plan.unitIdeas], partNotes: { ...project.plan.partNotes }, chapterEnds: project.plan.chapterEnds ? { ...project.plan.chapterEnds } : {}, referenceEntries: project.plan.referenceEntries ? project.plan.referenceEntries.map((entry) => ({ ...entry })) : [], drafts: { ...project.plan.drafts }, activity: project.plan.activity ? { ...project.plan.activity } : {} }, studio: project.studio ? { ...project.studio, frontMatterIncluded: { ...project.studio.frontMatterIncluded }, frontMatterText: { ...project.studio.frontMatterText }, backMatterIncluded: { ...project.studio.backMatterIncluded }, backMatterText: { ...project.studio.backMatterText }, chapterOrder: [...project.studio.chapterOrder], appearance: { ...project.studio.appearance } } : undefined };
    onProjectsChange([copy, ...projects]); onSelectProject(title); setMenuProject(null);
  };
  const saveRename = () => { if (!renameProject) return; const nextTitle = renameValue.trim(); if (!nextTitle || nextTitle === renameProject.title || projects.some((project) => project.title === nextTitle)) return; onProjectsChange(projects.map((project) => project.title === renameProject.title ? { ...project, title: nextTitle, updatedAt: Date.now() } : project)); if (activeProject === renameProject.title) onSelectProject(nextTitle); setRenameProject(null); setRenameValue(''); };
  const confirmDelete = (project: Project) => Alert.alert(`Delete “${project.title}”?`, 'This permanently removes this book from the current Bookez session.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { onProjectsChange(projects.filter((item) => item.title !== project.title)); if (activeProject === project.title && projects.some((item) => item.title !== project.title)) onSelectProject(projects.find((item) => item.title !== project.title)!.title); } }]);
  const renderProjectCard = (project: Project) => {
    const projectSnapshot = getJourneySnapshot(project);
    const currentPart = projectSnapshot.nextPart?.title ?? (projectSnapshot.parts[projectSnapshot.parts.length - 1]?.title ?? 'No section selected');
    return <View key={project.title} style={[s.libraryProjectCard, project.archived && s.libraryProjectCardArchived]}>
      <Pressable onPress={() => onSelectProject(project.title)} style={s.libraryProjectTop} accessibilityLabel={`Select ${project.title}`}>
        <View style={[s.projectMark, { backgroundColor: project.color }]}><Text style={s.projectMarkText}>{project.mark}</Text></View>
        <View style={s.projectCopy}><Text numberOfLines={1} style={s.projectTitle}>{project.title}</Text><Text numberOfLines={1} style={s.projectType}>{project.type}{project.archived ? ' · Archived' : ''}</Text><Text numberOfLines={1} style={s.projectDetail}>{projectSnapshot.stage} · {projectSnapshot.progressPercent}% complete</Text></View>
        <Pressable onPress={() => setMenuProject(project)} style={s.projectOverflowButton} accessibilityLabel={`More actions for ${project.title}`}><Text style={s.projectOverflowText}>•••</Text></Pressable>
      </Pressable>
      <View style={s.projectStats}><Text style={s.projectStatText}>{formatCount(projectSnapshot.wordCount)} words</Text><Text style={s.projectStatDot}>·</Text><Text numberOfLines={1} style={s.projectStatText}>{currentPart}</Text><Text style={s.projectStatDot}>·</Text><Text style={s.projectStatText}>{project.images?.length ? `${project.images.length} visual${project.images.length === 1 ? '' : 's'}` : getImageSystemConfig(project.type).mode === 'IMAGE_LED' ? 'Illustrations planned' : 'Visuals optional'}</Text><Text style={s.projectStatDot}>·</Text><Text style={s.projectStatText}>{formatLastEdited(project.updatedAt)}</Text></View>
      {!project.archived && <View style={s.projectCardActions}><Pressable onPress={() => selectAndOpen(project, 'Write')} style={s.projectContinueButton}><Text style={s.projectContinueText}>Continue writing</Text><Text style={s.projectContinueArrow}>→</Text></Pressable><Pressable onPress={() => { onSelectProject(project.title); onOpenBookStudio(project.title, 'read'); }} style={s.projectPreviewButton}><Text style={s.projectPreviewText}>Preview book</Text></Pressable></View>}
    </View>;
  };

  return <><PageHeader page="Library" onPage={onPage} /><Text style={s.intro}>Pick up a thread, or begin a brand new little world.</Text>
    <View style={s.focusCard}><LinearGradient colors={['#A6DDF7', '#8B8AE8']} style={StyleSheet.absoluteFill} />
      <View style={s.focusHeader}><Text style={s.focusEyebrow}>{focusIsManual ? 'YOUR FOCUS BOOK' : 'CLOSEST TO COMPLETION'}</Text><Pressable onPress={() => setFocusPickerOpen(true)} hitSlop={8} style={s.focusPickerButton} accessibilityRole="button" accessibilityLabel="Choose the book shown in the focus card"><Text style={s.focusPickerButtonText}>Switch</Text><Text style={s.focusPickerButtonArrow}>⌄</Text></Pressable></View>
      <Text style={s.focusTitle}>{focusProject?.title ?? activeProject}</Text><Text style={s.focusCopy}>Follow the thread from first idea to finished manuscript.</Text>{focusSnapshot && <Text style={s.focusProgress}>{focusSnapshot.progressPercent}% complete · {focusSnapshot.stage}</Text>}
      <View style={s.focusActions}><Pressable onPress={() => openFocusBook('Write')} style={s.lightAction}><Text style={s.lightActionText}>Open manuscript</Text><Text style={s.lightArrow}>→</Text></Pressable><Pressable onPress={() => openFocusBook('Journey')} style={s.focusJourneyAction}><Text style={s.focusJourneyActionText}>View journey</Text></Pressable></View>
      <Text style={s.focusShape}>◢</Text>
    </View>
    <View style={s.sectionBar}><Text style={s.sectionTitle}>Your projects</Text><Pressable onPress={() => setComposerOpen(true)} style={s.newProjectButton}><Text style={s.newProjectText}>+ NEW</Text></Pressable></View>
    <Text style={s.librarySectionEyebrow}>YOUR BOOKS</Text>
    {projects.filter((project) => !project.archived).map(renderProjectCard)}
    {projects.some((project) => project.archived) && <><Text style={s.librarySectionEyebrow}>ARCHIVED</Text>{projects.filter((project) => project.archived).map(renderProjectCard)}</>}
    <Pressable onPress={() => setComposerOpen(true)} style={s.addProjectRow}><View style={s.addProjectPlus}><Text style={s.addProjectPlusText}>+</Text></View><View><Text style={s.addProjectTitle}>Start another project</Text><Text style={s.addProjectSub}>Choose a format and make it yours</Text></View></Pressable>

    <Modal animationType="fade" visible={focusPickerOpen} transparent onRequestClose={() => setFocusPickerOpen(false)}>
      <View style={s.focusPickerDropdownShade}><Pressable style={s.focusPickerDismiss} onPress={() => setFocusPickerOpen(false)} /><View style={s.focusPickerDropdownSheet}><Text style={s.focusPickerOverline}>LIBRARY FOCUS</Text><Text style={s.focusPickerTitle}>Choose a book</Text><Text style={s.focusPickerHint}>Pick the project you want to keep in view.</Text><ScrollView style={s.focusPickerList} showsVerticalScrollIndicator={false}>{activeBooks.map((project) => { const snapshot = getJourneySnapshot(project); const selected = project.title === focusProject?.title; return <Pressable key={project.title} onPress={() => { setFocusProjectTitle(project.title); setFocusPickerOpen(false); }} style={[s.focusPickerRow, selected && s.focusPickerRowSelected]} accessibilityRole="button"><View style={[s.focusPickerMark, { backgroundColor: project.color }]}><Text style={s.focusPickerMarkText}>{project.mark}</Text></View><View style={s.focusPickerCopy}><Text numberOfLines={1} style={s.focusPickerBookTitle}>{project.title}</Text><Text style={s.focusPickerBookMeta}>{snapshot.progressPercent}% complete · {snapshot.stage}</Text></View>{selected && <Text style={s.focusPickerCheck}>✓</Text>}</Pressable>; })}</ScrollView></View></View>
    </Modal>

    <Modal animationType="slide" visible={composerOpen} transparent onRequestClose={() => setComposerOpen(false)}>
      <View style={s.modalShade}><View style={s.composerSheet}>
        <View style={s.sheetHandle} />
        <View style={s.composerHeader}><View><Text style={s.composerOverline}>A FRESH BEGINNING</Text><Text style={s.composerTitle}>What are you making?</Text></View><Pressable onPress={() => setComposerOpen(false)} style={s.closeButton}><Text style={s.closeButtonText}>×</Text></Pressable></View>
        <DictationInput value={projectName} onChangeText={setProjectName} placeholder="Give your project a name" placeholderTextColor="#9298B3" style={s.projectInput} returnKeyType="done" onSubmitEditing={createProject} accessibilityLabel="Project name" />
        <Text style={s.typePrompt}>CHOOSE A PROJECT TYPE</Text>
        <ScrollView style={s.typeScroller} showsVerticalScrollIndicator={false} contentContainerStyle={s.typeGrid}>
          {projectTypes.map((type) => <Pressable key={type.name} onPress={() => setSelectedType(type)} style={[s.typeCard, selectedType.name === type.name && s.typeCardSelected]}>
            <View style={[s.typeIcon, { backgroundColor: type.color }]}><Text style={s.typeIconText}>{type.icon}</Text></View>
            <View style={s.typeCopy}><Text style={s.typeName}>{type.name}</Text><Text style={s.typeExample}>{type.example}</Text></View>
            <View style={[s.typeCheck, selectedType.name === type.name && s.typeCheckSelected]}><Text style={s.typeCheckText}>{selectedType.name === type.name ? '✓' : ''}</Text></View>
          </Pressable>)}
        </ScrollView>
        <Pressable onPress={createProject} style={s.createProjectButton}><Text style={s.createProjectButtonText}>Create {selectedType.name}</Text><Text style={s.createProjectArrow}>→</Text></Pressable>
      </View></View>
    </Modal>

    <Modal animationType="fade" visible={menuProject !== null} transparent onRequestClose={() => setMenuProject(null)}>
      <Pressable style={s.libraryMenuShade} onPress={() => setMenuProject(null)}><View style={s.libraryMenu}><Text style={s.libraryMenuOverline}>BOOK ACTIONS</Text><Text numberOfLines={1} style={s.libraryMenuTitle}>{menuProject?.title}</Text>
        <Pressable onPress={() => menuProject && onOpenBookStudio(menuProject.title, getBookStudioState(menuProject).lastSection)} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>▣</Text><Text style={s.libraryMenuLabel}>Open Book Studio</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable>
        <Pressable onPress={() => menuProject && onOpenBookStudio(menuProject.title, 'listen')} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>◷</Text><Text style={s.libraryMenuLabel}>Listen to book</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable>
        <Pressable onPress={() => menuProject && onOpenBookStudio(menuProject.title, 'export')} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>↗</Text><Text style={s.libraryMenuLabel}>Export</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable>
        <Pressable onPress={() => menuProject && selectAndOpen(menuProject, 'Journey')} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>✦</Text><Text style={s.libraryMenuLabel}>View journey</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable>
        <Pressable onPress={() => { if (!menuProject) return; setRenameProject(menuProject); setRenameValue(menuProject.title); setMenuProject(null); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>✎</Text><Text style={s.libraryMenuLabel}>Rename</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable>
        <Pressable onPress={() => menuProject && duplicateProject(menuProject)} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>＋</Text><Text style={s.libraryMenuLabel}>Duplicate</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable>
        <Pressable onPress={() => { if (!menuProject) return; onProjectsChange(projects.map((project) => project.title === menuProject.title ? { ...project, archived: !project.archived, updatedAt: Date.now() } : project)); setMenuProject(null); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>⌁</Text><Text style={s.libraryMenuLabel}>{menuProject?.archived ? 'Unarchive' : 'Archive'}</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable>
        <Pressable onPress={() => { if (menuProject) confirmDelete(menuProject); setMenuProject(null); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIconDelete}>×</Text><Text style={s.libraryMenuDeleteLabel}>Delete</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable>
      </View></Pressable>
    </Modal>
    <Modal animationType="fade" visible={renameProject !== null} transparent onRequestClose={() => setRenameProject(null)}>
      <View style={s.renameModalShade}><View style={s.renameSheet}><Text style={s.libraryMenuOverline}>BOOK DETAILS</Text><Text style={s.renameTitle}>Rename this book</Text><TextInput autoFocus value={renameValue} onChangeText={setRenameValue} style={s.renameInput} placeholder="Book title" placeholderTextColor="#9A9DB7" returnKeyType="done" onSubmitEditing={saveRename} /><View style={s.renameActions}><Pressable onPress={() => setRenameProject(null)} style={s.renameCancel}><Text style={s.renameCancelText}>Cancel</Text></Pressable><Pressable onPress={saveRename} style={s.renameSave}><Text style={s.renameSaveText}>Save name</Text></Pressable></View></View></View>
    </Modal>
  </>;
}

function Plan({ projects, activeProject, onSelectProject, onUpdateProject, onPage }: { projects: Project[]; activeProject: string; onSelectProject: (title: string) => void; onUpdateProject: (title: string, changes: Partial<Project>) => void; onPage: (page: Page) => void }) {
  const currentProject = projects.find((project) => project.title === activeProject) ?? projects[0];
  const currentPlan = currentProject?.plan ?? defaultPlanFor(currentProject?.type ?? 'Custom Project');
  const selectedType = projectTypes.find((type) => type.name === currentProject?.type) ?? projectTypes[projectTypes.length - 1];
  const blueprint = planBlueprints[selectedType.name];
  const pageGoal = currentProject?.pageGoal ?? blueprint.defaultPages;
  const unitGoal = currentProject?.unitGoal ?? blueprint.defaultUnits;
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState(currentPlan.idea);
  const [plotThread, setPlotThread] = useState(currentPlan.plotThread);
  const [people, setPeople] = useState(currentPlan.people);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [structure, setStructure] = useState(currentPlan.structure);
  const [structurePage, setStructurePage] = useState(0);
  const [structureFilter, setStructureFilter] = useState<StructureFilter>('all');
  const [plotNotes, setPlotNotes] = useState<Record<string, string>>(currentPlan.plotNotes);
  const [unitIdeas, setUnitIdeas] = useState<string[]>(currentPlan.unitIdeas);
  const [conclusion, setConclusion] = useState(currentPlan.conclusion || '');
  const [referenceNotes, setReferenceNotes] = useState(currentPlan.referenceNotes || '');
  const [storyMapPage, setStoryMapPage] = useState(0);
  const [planningMethodOpen, setPlanningMethodOpen] = useState(false);
  const [planningMethod, setPlanningMethod] = useState<PlanningMethod>(currentPlan.planningMethod ?? 'plantser');
  const [targetWords, setTargetWords] = useState(currentPlan.targetWords ?? String((Number.parseInt(pageGoal, 10) || 0) * 250));
  const [plannedCompletionDate, setPlannedCompletionDate] = useState(currentPlan.plannedCompletionDate ?? '');
  const [writingFrequency, setWritingFrequency] = useState<WritingFrequency>(currentPlan.writingFrequency ?? 'everyday');
  const [customWritingDays, setCustomWritingDays] = useState<number[]>(currentPlan.customWritingDays ?? []);
  const [reminderEnabled, setReminderEnabled] = useState(currentPlan.reminderEnabled ?? false);
  const [writingReminderTimes, setWritingReminderTimes] = useState<string[]>(getReminderTimes(currentPlan));
  const [newReminderTime, setNewReminderTime] = useState('');
  const [paceFlexibility, setPaceFlexibility] = useState<PaceFlexibility>(currentPlan.paceFlexibility ?? 'steady');
  const [customPaceWords, setCustomPaceWords] = useState(currentPlan.customPaceWords ?? '');
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState(currentPlan.plannedCompletionDate ?? '');

  const structureItems = getStructureItems(selectedType.name, blueprint);
  const referencesItem = structureItems.find((item) => item.key === 'references' || item.label.toLowerCase() === 'references');
  const referencesRelevant = !['Fiction Book', 'Children’s Book', 'Poetry Collection', 'Journal or Diary', 'Script'].includes(selectedType.name);
  const referencesEnabled = Boolean(referencesItem && isStructureEnabled(structure, referencesItem, blueprint));
  const visibleStructurePool = structureFilter === 'all' ? structureItems : structureItems.filter((item) => item.category === structureFilter);
  const unitCount = Math.max(Number.parseInt(unitGoal, 10) || 0, 0);
  const targetWordCount = Number.parseInt(targetWords.replace(/,/g, ''), 10) || 0;
  const estimatedTargetPages = targetWordCount ? Math.max(1, Math.round(targetWordCount / 250)) : 0;
  const exampleWords = selectedType.name === 'Children’s Book' ? 1000 : selectedType.name === 'Poetry Collection' ? 10000 : selectedType.name === 'Journal or Diary' ? 20000 : 50000;
  const examplePages = Math.round(exampleWords / 250);
  const exampleUnits = selectedType.name === 'Children’s Book' ? 14 : blueprint.defaultUnits;
  const exampleUnitLabel = selectedType.name === 'Children’s Book' ? 'spreads' : blueprint.unitLabelPlural;
  const frequencyOptions: [WritingFrequency, string][] = [['everyday', 'Every day'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['custom', 'Custom days']];
  const reminderTimeOptions: [WritingReminderTime, string][] = [['morning', '8:00 AM'], ['afternoon', '1:00 PM'], ['evening', '7:00 PM']];
  const paceOptions: [PaceFlexibility, string][] = [['gentle', 'Gentle'], ['steady', 'Steady'], ['ambitious', 'Ambitious'], ['custom', 'Custom']];
  const weekdayOptions = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const paceHelper = paceFlexibility === 'gentle' ? 'A softer target with room for life to happen.' : paceFlexibility === 'ambitious' ? 'A stretch target for a focused season.' : paceFlexibility === 'custom' ? 'Set the number of words you want to aim for on a writing day.' : 'A dependable middle pace you can return to.';
  const deadlineLabel = plannedCompletionDate ? new Date(`${plannedCompletionDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline';
  const structurePageSize = 4;
  const structurePageCount = Math.max(1, Math.ceil(visibleStructurePool.length / structurePageSize));
  const visibleStructureItems = visibleStructurePool.slice(structurePage * structurePageSize, (structurePage + 1) * structurePageSize);
  const structurePageStart = structurePage * structurePageSize + 1;
  const structurePageEnd = Math.min((structurePage + 1) * structurePageSize, visibleStructurePool.length);
  const storyMapPromptPageSize = 3;
  const storyMapPromptPageCount = Math.max(1, Math.ceil(blueprint.plotPrompts.length / storyMapPromptPageSize));
  const storyMapUnitPageSize = 4;
  const storyMapUnitPageCount = Math.max(1, Math.ceil(unitCount / storyMapUnitPageSize));
  const peoplePageIndex = 2 + storyMapPromptPageCount;
  const unitPagesStartIndex = peoplePageIndex + 1;
  const conclusionPageIndex = unitPagesStartIndex + storyMapUnitPageCount;
  const storyMapPageCount = conclusionPageIndex + 1;
  const activeStoryMapPage = Math.min(storyMapPage, storyMapPageCount - 1);
  const activePromptPage = activeStoryMapPage - 2;
  const activeUnitPage = activeStoryMapPage - unitPagesStartIndex;
  const visiblePlotPrompts = blueprint.plotPrompts.slice(activePromptPage * storyMapPromptPageSize, (activePromptPage + 1) * storyMapPromptPageSize);
  const visibleUnitStart = activeUnitPage * storyMapUnitPageSize;
  const visibleUnitIndexes = Array.from({ length: Math.min(storyMapUnitPageSize, Math.max(0, unitCount - visibleUnitStart)) }, (_, index) => visibleUnitStart + index);
  const storyMapPageLabel = activeStoryMapPage === 0 ? 'Big idea' : activeStoryMapPage === 1 ? 'Arc overview' : activeStoryMapPage < peoplePageIndex ? `${blueprint.plotLabel} · ${activePromptPage + 1} / ${storyMapPromptPageCount}` : activeStoryMapPage === peoplePageIndex ? blueprint.peopleLabel : activeStoryMapPage === conclusionPageIndex ? 'Conclusion' : `${blueprint.unitLabelPlural[0].toUpperCase() + blueprint.unitLabelPlural.slice(1)} · ${activeUnitPage + 1} / ${storyMapUnitPageCount}`;
  const selectedPlanningMethod = planningMethods.find((item) => item.method === planningMethod) ?? planningMethods[2];
  const imageConfig = getImageSystemConfig(currentProject?.type ?? 'Custom Project');
  const projectImages = currentProject?.images ?? [];

  const persistPlan = (changes: Partial<ProjectPlan>) => onUpdateProject(activeProject, { plan: { ...currentPlan, ...changes, writingPlanCreated: true, writingPlanCreatedAt: currentPlan.writingPlanCreatedAt ?? Date.now() } });

  const saveDeadline = () => {
    const value = deadlineDraft.trim();
    if (!value) {
      setPlannedCompletionDate('');
      persistPlan({ plannedCompletionDate: '' });
      setDeadlineOpen(false);
      return;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const parsed = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(match?.[1]) || parsed.getMonth() !== Number(match?.[2]) - 1 || parsed.getDate() !== Number(match?.[3])) {
      Alert.alert('Check the date', 'Use the format YYYY-MM-DD, for example 2026-12-15.');
      return;
    }
    setPlannedCompletionDate(value);
    persistPlan({ plannedCompletionDate: value });
    setDeadlineOpen(false);
  };

  const chooseFrequency = (value: WritingFrequency) => {
    setWritingFrequency(value);
    persistPlan({ writingFrequency: value });
  };

  const toggleWritingDay = (day: number) => {
    const next = customWritingDays.includes(day) ? customWritingDays.filter((item) => item !== day) : [...customWritingDays, day].sort((a, b) => a - b);
    setCustomWritingDays(next);
    persistPlan({ customWritingDays: next });
  };

  const persistReminderTimes = (next: string[]) => {
    setWritingReminderTimes(next);
    persistPlan({ writingReminderTimes: next });
  };

  const addReminderTime = (value = newReminderTime) => {
    const normalized = normalizeReminderTime(value);
    if (!normalized) {
      Alert.alert('Check the time', 'Enter a time like 8:30 AM or 20:00.');
      return;
    }
    if (writingReminderTimes.some((time) => time.toLowerCase() === normalized.toLowerCase())) {
      setNewReminderTime('');
      return;
    }
    persistReminderTimes([...writingReminderTimes, normalized]);
    setNewReminderTime('');
  };

  const removeReminderTime = (time: string) => {
    const next = writingReminderTimes.filter((item) => item !== time);
    setWritingReminderTimes(next);
    persistPlan({ writingReminderTimes: next, ...(next.length ? {} : { reminderEnabled: false }) });
    if (!next.length) setReminderEnabled(false);
  };

  const choosePace = (value: PaceFlexibility) => {
    setPaceFlexibility(value);
    persistPlan({ paceFlexibility: value });
  };

  const chooseProject = (project: Project) => {
    if (project.title === activeProject) return;
    const nextPlan = project.plan ?? defaultPlanFor(project.type);
    onSelectProject(project.title);
    setIdea(nextPlan.idea);
    setPlotThread(nextPlan.plotThread);
    setPeople(nextPlan.people);
    setStructure(nextPlan.structure);
    setStructurePage(0);
    setStructureFilter('all');
    setPlotNotes(nextPlan.plotNotes);
    setUnitIdeas(nextPlan.unitIdeas);
    setConclusion(nextPlan.conclusion || '');
    setReferenceNotes(nextPlan.referenceNotes || '');
    setStoryMapPage(0);
    setPlanningMethod(nextPlan.planningMethod ?? 'plantser');
    setPlanningMethodOpen(false);
    setTargetWords(nextPlan.targetWords ?? String((Number.parseInt(project.pageGoal, 10) || 0) * 250));
    setPlannedCompletionDate(nextPlan.plannedCompletionDate ?? '');
    setDeadlineDraft(nextPlan.plannedCompletionDate ?? '');
    setWritingFrequency(nextPlan.writingFrequency ?? 'everyday');
    setCustomWritingDays(nextPlan.customWritingDays ?? []);
    setReminderEnabled(nextPlan.reminderEnabled ?? false);
    setWritingReminderTimes(getReminderTimes(nextPlan));
    setNewReminderTime('');
    setPaceFlexibility(nextPlan.paceFlexibility ?? 'steady');
    setCustomPaceWords(nextPlan.customPaceWords ?? '');
  };

  const updatePlotNote = (label: string, value: string) => {
    const next = { ...plotNotes, [label]: value };
    setPlotNotes(next);
    persistPlan({ plotNotes: next });
  };
  const updateUnitIdea = (index: number, value: string) => {
    const next = [...unitIdeas];
    next[index] = value;
    setUnitIdeas(next);
    persistPlan({ unitIdeas: next });
  };
  const toggleStructure = (label: string) => {
    const item = structureItems.find((candidate) => candidate.label === label);
    if (!item) return;
    const currentValue = isStructureEnabled(structure, item, blueprint);
    const next = { ...structure, [item.key ?? structureKeyFor(item.label)]: !currentValue };
    setStructure(next);
    persistPlan({ structure: next });
  };
  const addProjectImage = () => {
    if (!currentProject) return;
    requestImage(currentProject, (asset) => onUpdateProject(activeProject, { images: [...(currentProject.images ?? []), makeBookezImage(currentProject, asset)] }));
  };
  const replaceProjectImage = (image: BookezImage) => {
    if (!currentProject) return;
    requestImage(currentProject, (asset) => onUpdateProject(activeProject, { images: projectImages.map((item) => item.id === image.id ? { ...item, ...makeBookezImage(currentProject, asset), id: item.id, title: item.title, caption: item.caption, altText: item.altText, credit: item.credit, placement: item.placement, includeInExport: item.includeInExport, referenceOnly: item.referenceOnly, connectedPartKey: item.connectedPartKey, updatedAt: Date.now() } : item) }));
  };
  const updateProjectImage = (id: string, changes: Partial<BookezImage>) => onUpdateProject(activeProject, { images: projectImages.map((image) => image.id === id ? { ...image, ...changes, updatedAt: Date.now() } : image) });
  const removeProjectImage = (id: string) => onUpdateProject(activeProject, { images: projectImages.filter((image) => image.id !== id) });
  const choosePlanningMethod = (method: PlanningMethod) => {
    setPlanningMethod(method);
    persistPlan({ planningMethod: method });
    setPlanningMethodOpen(false);
  };

  const stepMeta = [
    { label: 'Scope', short: 'Size + pace' },
    { label: 'Structure', short: 'What belongs' },
    { label: 'Story map', short: 'Idea + arc' },
  ];

  return <>
    <View style={s.planHero}>
      <Pressable onPress={() => setProjectMenuOpen(true)} style={s.planHeroSwitcher}>
        <View style={[s.planTopIcon, { backgroundColor: selectedType.color }]}><Text style={s.planTopIconText}>{selectedType.icon}</Text></View>
        <View style={s.planTopSwitcherCopy}><Text style={s.planTopOverline}>WORKING ON</Text><Text numberOfLines={1} style={s.planTopTitle}>{currentProject?.title ?? 'Choose a project'}</Text></View>
        <Text style={s.planTopChevron}>⌄</Text>
      </Pressable>
      <Text style={s.planHeroOverline}>A KINDER WAY TO BEGIN</Text>
      <Text style={s.planHeroTitle}>Plan the shape{`\n`}of your work.</Text>
      <Text style={s.planHeroCopy}>Choose a format, add only what helps, and start writing whenever you’re ready.</Text>
      <Text style={s.planHeroOrb}>◒</Text>
    </View>

    <View style={s.planSelectedCard}>
      <View style={[s.planSelectedIcon, { backgroundColor: selectedType.color }]}><Text style={s.planSelectedIconText}>{selectedType.icon}</Text></View>
      <View style={{ flex: 1 }}><Text style={s.planSelectedOverline}>PLANNING</Text><Text style={s.planSelectedTitle}>{selectedType.name}</Text><Text style={s.planSelectedSub}>{blueprint.unitLabelPlural} · {pageGoal || '—'} pages</Text></View>
      <Pressable onPress={() => onPage('Journey')} style={s.planJourneyLink}><Text style={s.planJourneyLinkText}>Journey</Text><Text style={s.planSelectedArrow}>✦</Text></Pressable>
    </View>
    <ImageSystemCard project={currentProject} images={projectImages} onAddImage={addProjectImage} onReplaceImage={replaceProjectImage} onUpdateImage={updateProjectImage} onRemoveImage={removeProjectImage} onEnableImages={() => onUpdateProject(activeProject, { imageEnabled: true })} compact emptyLabel={`Add ${imageConfig.itemLabel} to this project`} />

    <View style={s.planSteps}>
      {stepMeta.map((item, index) => <Pressable key={item.label} onPress={() => setStep(index)} style={[s.planStep, step === index && s.planStepActive]}>
        <View style={[s.planStepNumber, step === index && s.planStepNumberActive]}><Text style={[s.planStepNumberText, step === index && s.planStepNumberTextActive]}>{index + 1}</Text></View>
        <View><Text style={[s.planStepLabel, step === index && s.planStepLabelActive]}>{item.label}</Text><Text style={s.planStepShort}>{item.short}</Text></View>
      </Pressable>)}
    </View>

    {step === 0 && <View style={s.planStepCardAesthetic}>
      <Text style={s.planSectionKickerAesthetic}>SECTION 1 · SET THE SCOPE</Text>
      <Text style={s.planSectionTitleAesthetic}>How big should this be?</Text>
      <Text style={s.planSectionCopyAesthetic}>Give the work a clear finish line, then choose a rhythm that still leaves room for the life around it.</Text>
      <LinearGradient colors={['#F6F3FF', '#ECE8FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.primaryMetricCardAesthetic}>
        <View pointerEvents="none" style={s.primaryMetricAccent} />
        <View style={s.primaryMetricHeaderAesthetic}><View><Text style={s.metricLabelAesthetic}>PRIMARY SIZE MEASUREMENT</Text><Text style={s.primaryMetricTitleAesthetic}>TARGET WORDS</Text></View><View style={s.primaryMetricUnitPill}><Text style={s.primaryMetricUnitAesthetic}>WORDS</Text></View></View>
        <TextInput value={targetWords} onChangeText={(value) => { setTargetWords(value); persistPlan({ targetWords: value }); }} keyboardType="number-pad" selectTextOnFocus style={s.primaryMetricInputAesthetic} accessibilityLabel="Target words" />
        <Text style={s.primaryMetricHintAesthetic}>{estimatedTargetPages ? `About ${formatCount(estimatedTargetPages)} pages at roughly 250 words per page.` : 'Use words as your main measure; pages will vary with layout and format.'}</Text>
        <Text style={s.scopeExampleAesthetic}>Example: {formatCount(exampleWords)} words ≈ {formatCount(examplePages)} pages · {exampleUnits} {exampleUnitLabel}.</Text>
      </LinearGradient>
      <View style={s.metricRowAesthetic}>
        <View style={s.metricCardAesthetic}><Text style={s.metricLabelAesthetic}>REFERENCE PAGES</Text><TextInput value={pageGoal} onChangeText={(value) => onUpdateProject(activeProject, { pageGoal: value })} keyboardType="number-pad" selectTextOnFocus style={s.metricInputAesthetic} /><Text style={s.metricHintAesthetic}>A layout estimate</Text></View>
        <View style={s.metricCardAesthetic}><Text style={s.metricLabelAesthetic}>TARGET {blueprint.unitLabelPlural.toUpperCase()}</Text><TextInput value={unitGoal} onChangeText={(value) => onUpdateProject(activeProject, { unitGoal: value })} keyboardType="number-pad" selectTextOnFocus style={s.metricInputAesthetic} /><Text style={s.metricHintAesthetic}>Your main building blocks</Text></View>
      </View>
      <View style={s.planTipAesthetic}><Text style={s.planTipIconAesthetic}>✦</Text><Text style={s.planTipTextAesthetic}>{blueprint.scopeHelper}</Text></View>

      <View style={s.scopeControlCardAesthetic}>
        <Text style={s.scopeControlKicker}>WORK RHYTHM</Text>
        <Text style={s.scopeControlTitle}>How often will you write?</Text>
        <Text style={s.scopeControlCopy}>Writing research suggests that regular, scheduled sessions are easier to sustain than waiting for inspiration or catching up in long bursts. Choose a rhythm you can return to.</Text>
        <View style={rhythmS.planResearchNote}><Text style={rhythmS.planResearchNoteIcon}>✦</Text><Text style={rhythmS.planResearchNoteText}>Evidence note · Brief, repeatable sessions tend to outperform deadline-driven writing in productivity studies.</Text></View>
        <Text style={s.scopeFieldLabel}>WRITING FREQUENCY</Text>
        <View style={s.scopeChoiceGrid}>{frequencyOptions.map(([value, label]) => <Pressable key={value} onPress={() => chooseFrequency(value)} style={[s.scopeChoice, writingFrequency === value && s.scopeChoiceActive]}><Text style={[s.scopeChoiceText, writingFrequency === value && s.scopeChoiceTextActive]}>{label}</Text></Pressable>)}</View>
        {writingFrequency === 'custom' && <View style={s.customDaysBlock}><Text style={s.customDaysHint}>Choose the days you want to write.</Text><View style={s.dayChoiceRow}>{weekdayOptions.map((label, day) => <Pressable key={`${label}-${day}`} onPress={() => toggleWritingDay(day)} style={[s.dayChoice, customWritingDays.includes(day) && s.dayChoiceActive]} accessibilityLabel={`Toggle ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]}`}><Text style={[s.dayChoiceText, customWritingDays.includes(day) && s.dayChoiceTextActive]}>{label}</Text></Pressable>)}</View></View>}
        <View style={s.scopeDivider} />
        <View style={s.scopeSwitchRow}><View style={s.scopeSwitchCopy}><Text style={s.scopeSwitchTitle}>Writing reminder</Text><Text style={s.scopeSwitchHint}>Keep a gentle reminder preference for this project.</Text></View><Switch value={reminderEnabled} onValueChange={(value) => { setReminderEnabled(value); persistPlan({ reminderEnabled: value }); }} trackColor={{ false: '#D7D9E6', true: '#BAB6F1' }} thumbColor={reminderEnabled ? C.periwinkle : '#FFF'} /></View>
        {reminderEnabled && <><Text style={s.scopeFieldLabel}>REMINDER TIMES</Text>{writingReminderTimes.length ? writingReminderTimes.map((time) => <View key={time} style={s.reminderTimeRow}><Text style={s.reminderTimeValue}>{time}</Text><Pressable onPress={() => removeReminderTime(time)} style={s.reminderTimeRemove} accessibilityLabel={`Remove reminder at ${time}`}><Text style={s.reminderTimeRemoveText}>×</Text></Pressable></View>) : <Text style={s.reminderTimeEmpty}>Add at least one time for this reminder.</Text>}<View style={s.reminderTimeInputRow}><TextInput value={newReminderTime} onChangeText={setNewReminderTime} onSubmitEditing={() => addReminderTime()} returnKeyType="done" placeholder="e.g. 8:30 AM" placeholderTextColor="#A0A3BB" style={s.reminderTimeInput} accessibilityLabel="New reminder time" /><Pressable onPress={() => addReminderTime()} style={s.reminderTimeAdd} accessibilityLabel="Add reminder time"><Text style={s.reminderTimeAddText}>Add</Text></Pressable></View><Text style={s.reminderTimeHint}>Add more than one if you like. 24-hour times are supported too.</Text><View style={s.reminderQuickRow}>{reminderTimeOptions.map(([value, label]) => <Pressable key={value} onPress={() => addReminderTime(label)} style={s.reminderQuickButton} accessibilityLabel={`Add reminder at ${label}`}><Text style={s.reminderQuickText}>+ {label}</Text></Pressable>)}</View></>}
      </View>

      <View style={s.scopeControlCardAesthetic}>
        <Text style={s.scopeControlKicker}>FINISH LINE</Text>
        <Text style={s.scopeControlTitle}>How much flexibility feels right?</Text>
        <Text style={s.scopeControlCopy}>Your pace can change with the season. Pick a starting point, not a rule.</Text>
        <Text style={s.scopeFieldLabel}>PACE FLEXIBILITY</Text>
        <View style={s.scopeChoiceGrid}>{paceOptions.map(([value, label]) => <Pressable key={value} onPress={() => choosePace(value)} style={[s.scopeChoice, paceFlexibility === value && s.scopeChoiceActive]}><Text style={[s.scopeChoiceText, paceFlexibility === value && s.scopeChoiceTextActive]}>{label}</Text></Pressable>)}</View>
        <Text style={s.scopeChoiceHint}>{paceHelper}</Text>
        {paceFlexibility === 'custom' && <View style={s.customPaceRow}><TextInput value={customPaceWords} onChangeText={(value) => { setCustomPaceWords(value); persistPlan({ customPaceWords: value }); }} keyboardType="number-pad" placeholder="Words per writing day" placeholderTextColor="#A1A4BB" style={s.customPaceInput} /><Text style={s.customPaceUnit}>WORDS / DAY</Text></View>}
        <Text style={[s.scopeFieldLabel, s.scopeDeadlineLabel]}>PLANNED COMPLETION DATE</Text>
        <Pressable onPress={() => { setDeadlineDraft(plannedCompletionDate); setDeadlineOpen(true); }} style={s.deadlineButton}><View><Text style={s.deadlineButtonLabel}>{deadlineLabel}</Text><Text style={s.deadlineButtonHint}>{plannedCompletionDate ? 'Tap to change the date' : 'Choose a date or keep this open-ended'}</Text></View><Text style={s.deadlineButtonArrow}>›</Text></Pressable>
      </View>
    </View>}

    {step === 1 && <View style={s.planStepCardAesthetic}>
      <Text style={s.planSectionKickerAesthetic}>SECTION 2 · BUILD THE CONTAINER</Text>
      <Text style={s.planSectionTitleAesthetic}>What belongs in it?</Text>
      <Text style={s.planSectionCopyAesthetic}>{blueprint.structureIntro} Bookez marks what is essential, strongly recommended, common, or optional for this kind of work. Start with the guidance, then make the structure yours.</Text>
      <View style={s.recommendationLegend}><Text style={s.recommendationLegendTitle}>GUIDANCE</Text><View style={s.recommendationLegendItems}>{(['essential', 'stronglyRecommended', 'recommended', 'common', 'whenRelevant', 'optional'] as Recommendation[]).map((recommendation) => <View key={recommendation} style={[s.recommendationLegendChip, recommendationTagStyle(recommendation)]}><Text style={s.recommendationLegendText}>{recommendationLabel(recommendation)}</Text></View>)}</View></View>
      <View style={s.structureFilterRow}>{([['all', 'All'], ['front', 'Front'], ['body', 'Body'], ['back', 'Back']] as [StructureFilter, string][]).map(([filter, label]) => <Pressable key={filter} onPress={() => { setStructureFilter(filter); setStructurePage(0); }} style={[s.structureFilterButton, structureFilter === filter && s.structureFilterButtonActive]}><Text style={[s.structureFilterText, structureFilter === filter && s.structureFilterTextActive]}>{label}</Text></Pressable>)}</View>
      <View style={s.structureChecklistHeader}><View style={s.structureChecklistCopy}><Text style={s.structureChecklistTitle}>{structureFilter === 'all' ? 'PARTS TO INCLUDE' : `${structureCategoryLabel(structureFilter).replace(' MATTER', '')} COMPONENTS`}</Text><Text style={s.structureChecklistHint}>Showing {visibleStructurePool.length ? structurePageStart : 0}–{structurePageEnd} of {visibleStructurePool.length} parts</Text></View>{structurePageCount > 1 && <View style={s.structurePager}><Pressable onPress={() => setStructurePage(Math.max(0, structurePage - 1))} disabled={structurePage === 0} style={[s.structurePagerButton, structurePage === 0 && s.structurePagerButtonDisabled]} accessibilityLabel="Previous checklist page"><Text style={s.structurePagerButtonText}>‹</Text></Pressable><Text style={s.structurePagerCount}>{structurePage + 1} / {structurePageCount}</Text><Pressable onPress={() => setStructurePage(Math.min(structurePageCount - 1, structurePage + 1))} disabled={structurePage === structurePageCount - 1} style={[s.structurePagerButton, structurePage === structurePageCount - 1 && s.structurePagerButtonDisabled]} accessibilityLabel="Next checklist page"><Text style={s.structurePagerButtonText}>›</Text></Pressable></View>}</View>
      <View style={s.structureList}>
        {visibleStructureItems.map((item) => { const enabled = isStructureEnabled(structure, item, blueprint); return <Pressable key={item.key ?? item.label} onPress={() => toggleStructure(item.label)} style={[s.structureRow, enabled && s.structureRowActive]}>
          <View style={[s.structureCheck, enabled && s.structureCheckOn]}><Text style={s.structureCheckText}>{enabled ? '✓' : ''}</Text></View>
          <View style={s.structureCopy}><Text style={s.structureCategory}>{structureCategoryLabel(item.category ?? 'body')}</Text><Text style={s.structureLabel}>{item.label}</Text><Text style={s.structureHelper}>{item.helper}</Text></View>
          <Text style={[s.partTag, recommendationTagStyle(item.recommendation ?? (item.recommended ? 'recommended' : 'optional'))]}>{recommendationLabel(item.recommendation ?? (item.recommended ? 'recommended' : 'optional'))}</Text>
        </Pressable>; })}
      </View>
      <View style={s.structureFooterRow}>
        <Text style={[s.structureFooter, s.structureFooterCompact]}>{structureItems.filter((item) => isStructureEnabled(structure, item, blueprint)).length} pieces in your current plan</Text>
      </View>
      {referencesRelevant && referencesItem && <View style={s.referencePlanCard}><View style={s.referencePlanHeader}><View style={s.referencePlanIcon}><Text style={s.referencePlanIconText}>◌</Text></View><View style={s.referencePlanCopy}><Text style={s.referencePlanEyebrow}>OPTIONAL BACK MATTER</Text><Text style={s.referencePlanTitle}>References</Text><Text style={s.referencePlanHint}>Include a source list when this work uses research, quotations, or borrowed ideas.</Text></View><Pressable onPress={() => toggleStructure(referencesItem.label)} style={[s.referencePlanToggle, referencesEnabled && s.referencePlanToggleOn]} accessibilityRole="switch" accessibilityState={{ checked: referencesEnabled }} accessibilityLabel="Include references"><Text style={[s.referencePlanToggleText, referencesEnabled && s.referencePlanToggleTextOn]}>{referencesEnabled ? 'ON' : 'OFF'}</Text></Pressable></View>{referencesEnabled && <View style={s.referencePlanBody}><Text style={s.referencePlanFieldLabel}>REFERENCE NOTES</Text><TextInput value={referenceNotes} onChangeText={(value) => { setReferenceNotes(value); persistPlan({ referenceNotes: value }); }} multiline placeholder="Example: cite the books, articles, interviews, or websites that shaped this work…" placeholderTextColor="#B4B5C2" style={s.referencePlanInput} accessibilityLabel="Reference notes" /><Text style={s.referencePlanExample}>Example: Author, A. A. (2024). Title of the source. Publisher. Add the details you know; Bookez can format the final citation in Stats.</Text></View>}</View>}
    </View>}

    {step === 2 && <View style={s.planStepCardAesthetic}>
      <Text style={s.planSectionKickerAesthetic}>SECTION 3 · MAKE THE STORY MAP</Text>
      <Text style={s.planSectionTitleAesthetic}>Put the heart on the page.</Text>
      <Text style={s.planSectionCopyAesthetic}>Start loose. These notes are here to give you somewhere to return when the draft gets foggy. Tap 🎙 on any writing field to use your phone’s dictation.</Text>

      <View style={s.planningMethodCard}><Pressable onPress={() => setPlanningMethodOpen(true)} style={s.planningMethodButton} accessibilityRole="button" accessibilityLabel="Choose planning method"><View style={s.planningMethodIcon}><Text style={s.planningMethodIconText}>⌁</Text></View><View style={s.planningMethodCopy}><Text style={s.planningMethodKicker}>PLANNING STYLE</Text><View style={s.planningMethodTitleRow}><Text style={s.planningMethodTitle}>{selectedPlanningMethod.label}</Text><Text style={[s.planningMethodDifficultyTag, planningDifficultyStyle(selectedPlanningMethod.difficulty)]}>{planningDifficultyMeta[selectedPlanningMethod.difficulty].label}</Text></View><Text style={s.planningMethodHint}>{selectedPlanningMethod.bestFor}</Text></View><Text style={s.planningMethodChevron}>›</Text></Pressable></View>

      <View style={s.storyMapPager}>
        <Pressable onPress={() => setStoryMapPage(Math.max(0, activeStoryMapPage - 1))} disabled={activeStoryMapPage === 0} style={[s.storyMapPagerButton, activeStoryMapPage === 0 && s.storyMapPagerButtonDisabled]}><Text style={s.storyMapPagerButtonText}>‹</Text></Pressable>
        <View style={s.storyMapPagerCopy}><Text style={s.storyMapPagerLabel}>{storyMapPageLabel}</Text><Text style={s.storyMapPagerCount}>PAGE {activeStoryMapPage + 1} OF {storyMapPageCount}</Text></View>
        <Pressable onPress={() => setStoryMapPage(Math.min(storyMapPageCount - 1, activeStoryMapPage + 1))} disabled={activeStoryMapPage === storyMapPageCount - 1} style={[s.storyMapPagerButton, activeStoryMapPage === storyMapPageCount - 1 && s.storyMapPagerButtonDisabled]}><Text style={s.storyMapPagerButtonText}>›</Text></Pressable>
      </View>

      {activeStoryMapPage === 0 && <View style={s.planInputCard}><Text style={s.planInputLabel}>THE BIG IDEA</Text><Text style={s.planInputHint}>One clear sentence is enough for now.</Text><DictationInput value={idea} onChangeText={(value) => { setIdea(value); persistPlan({ idea: value }); }} placeholder={blueprint.ideaPlaceholder} placeholderTextColor="#9A9DB7" multiline style={s.planTextArea} accessibilityLabel="Big idea" /></View>}

      {activeStoryMapPage === 1 && <>
        <View style={s.plotGuide}><Text style={s.plotGuideTitle}>{blueprint.plotLabel}</Text><Text style={s.plotGuideText}>{blueprint.plotNote}</Text></View>
        <View style={s.planInputCard}><Text style={s.planInputLabel}>ONE-LINE THROUGHLINE</Text><Text style={s.planInputHint}>If you had to explain the movement in one breath.</Text><DictationInput value={plotThread} onChangeText={(value) => { setPlotThread(value); persistPlan({ plotThread: value }); }} placeholder="It starts with… and ends with…" placeholderTextColor="#9A9DB7" multiline style={s.planTextAreaSmall} accessibilityLabel="One-line throughline" /></View>
      </>}

      {activeStoryMapPage >= 2 && activeStoryMapPage < peoplePageIndex && <>
        <Text style={s.planSubheading}>{blueprint.plotLabel}</Text>
        <Text style={s.storyMapPageHint}>A few focused prompts at a time. Move forward when this page feels clear enough.</Text>
        {visiblePlotPrompts.map((prompt) => <View key={prompt.label} style={s.plotPrompt}><Text style={s.plotPromptTitle}>{prompt.label}</Text><Text style={s.plotPromptHelper}>{prompt.helper}</Text><DictationInput value={plotNotes[prompt.label] || ''} onChangeText={(value) => updatePlotNote(prompt.label, value)} placeholder="A few calm notes…" placeholderTextColor="#A0A3BB" multiline style={s.planTextAreaSmall} accessibilityLabel={prompt.label} /></View>)}
      </>}

      {activeStoryMapPage === peoplePageIndex && <View style={s.planInputCard}><Text style={s.planInputLabel}>{blueprint.peopleLabel.toUpperCase()}</Text><Text style={s.planInputHint}>{blueprint.peopleHelper}</Text><DictationInput value={people} onChangeText={(value) => { setPeople(value); persistPlan({ people: value }); }} placeholder={blueprint.peoplePlaceholder} placeholderTextColor="#9A9DB7" multiline style={s.planTextArea} accessibilityLabel={blueprint.peopleLabel} /></View>}

      {activeStoryMapPage >= unitPagesStartIndex && activeStoryMapPage < conclusionPageIndex && <>
        <View style={s.chapterHeader}><View><Text style={s.planSubheading}>{blueprint.unitLabelPlural[0].toUpperCase() + blueprint.unitLabelPlural.slice(1)} map</Text><Text style={s.chapterHeaderHint}>One note for each {blueprint.unitLabel} keeps the draft moving.</Text></View><View style={s.chapterCountBadge}><Text style={s.chapterCountText}>{unitCount || '—'}</Text></View></View>
        {unitCount > 0 ? visibleUnitIndexes.map((index) => <View key={index} style={s.chapterRow}><View style={s.chapterIndex}><Text style={s.chapterIndexText}>{String(index + 1).padStart(2, '0')}</Text></View><DictationInput grow value={unitIdeas[index] || ''} onChangeText={(value) => updateUnitIdea(index, value)} placeholder={`${blueprint.unitLabel[0].toUpperCase() + blueprint.unitLabel.slice(1)} ${index + 1}: what happens, is taught, or is felt?`} placeholderTextColor="#A0A3BB" multiline style={s.chapterTextInput} accessibilityLabel={`${blueprint.unitLabel} ${index + 1}`} /></View>) : <View style={s.emptyChapter}><Text style={s.emptyChapterIcon}>⌁</Text><Text style={s.emptyChapterText}>Set a target number in Section 1 and your {blueprint.unitLabelPlural} map will appear here.</Text></View>}
      </>}

      {activeStoryMapPage === conclusionPageIndex && <>
        <View style={s.plotGuide}><Text style={s.plotGuideTitle}>A gentle landing</Text><Text style={s.plotGuideText}>Give the work somewhere to arrive. This can be a final change, a clear takeaway, a question left open, or simply the feeling you want to leave behind.</Text></View>
        <View style={s.planInputCard}><Text style={s.planInputLabel}>THE CONCLUSION</Text><Text style={s.planInputHint}>What is resolved, understood, changed, or carried forward?</Text><DictationInput value={conclusion} onChangeText={(value) => { setConclusion(value); persistPlan({ conclusion: value }); }} placeholder="When this work ends, I want the reader to…" placeholderTextColor="#9A9DB7" multiline style={s.planTextArea} accessibilityLabel="Conclusion" /></View>
      </>}
    </View>}

    <View style={s.planFooter}>
      <Pressable onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={[s.planNavButton, step === 0 && s.planNavButtonDisabled]}><Text style={s.planNavButtonText}>← Back</Text></Pressable>
      <Text style={s.planFooterText}>STEP {step + 1} OF 3</Text>
      <Pressable onPress={() => step === 2 ? onPage('Write') : setStep(step + 1)} style={[s.planNavButton, s.planNavButtonPrimary]}><Text style={[s.planNavButtonText, s.planNavButtonTextPrimary]}>{step === 2 ? 'Start writing' : 'Next →'}</Text></Pressable>
    </View>

    <Modal animationType="slide" transparent visible={planningMethodOpen} onRequestClose={() => setPlanningMethodOpen(false)}>
      <View style={s.planningMethodShade}><Pressable style={s.planningMethodDismiss} onPress={() => setPlanningMethodOpen(false)} /><View style={s.planningMethodSheet}><View style={s.sheetHandle} /><Text style={s.planningMethodKicker}>STORYMAP APPROACH</Text><Text style={s.planningMethodSheetTitle}>How do you like to plan?</Text><Text style={s.planningMethodSheetCopy}>There is no correct method. Choose the amount of structure that helps you keep moving.</Text><Text style={s.planningMethodDifficultyNote}>Difficulty reflects planning overhead, not writing ability.</Text><ScrollView style={s.planningMethodList} showsVerticalScrollIndicator={false}>{planningMethods.map((item) => <Pressable key={item.method} onPress={() => choosePlanningMethod(item.method)} style={[s.planningMethodRow, planningMethod === item.method && s.planningMethodRowSelected]}><View style={[s.planningMethodCheck, planningMethod === item.method && s.planningMethodCheckSelected]}><Text style={s.planningMethodCheckText}>{planningMethod === item.method ? '✓' : ''}</Text></View><View style={s.planningMethodRowCopy}><View style={s.planningMethodRowTitle}><Text style={s.planningMethodRowLabel}>{item.label}</Text><View style={s.planningMethodRowTitleMeta}><Text style={[s.planningMethodDifficultyTag, planningDifficultyStyle(item.difficulty)]}>{planningDifficultyMeta[item.difficulty].label}</Text>{item.recommended && <Text style={s.planningMethodRecommended}>GOOD START</Text>}</View></View><Text style={s.planningMethodRowDescription}>{item.description}</Text><Text style={s.planningMethodRowBestFor}>Best for: {item.bestFor}</Text></View></Pressable>)}</ScrollView></View></View>
    </Modal>
    <Modal animationType="slide" transparent visible={deadlineOpen} onRequestClose={() => setDeadlineOpen(false)}>
      <View style={s.scopeModalShade}><Pressable style={s.scopeModalDismiss} onPress={() => setDeadlineOpen(false)} /><View style={s.scopeDateSheet}><View style={s.sheetHandle} /><Text style={s.scopeControlKicker}>FINISH LINE</Text><Text style={s.scopeDateTitle}>Choose a completion date</Text><Text style={s.scopeDateCopy}>Leave it open-ended if a deadline would make the work feel heavier.</Text><TextInput value={deadlineDraft} onChangeText={setDeadlineDraft} placeholder="YYYY-MM-DD" placeholderTextColor="#9A9DB7" keyboardType="numbers-and-punctuation" style={s.scopeDateInput} accessibilityLabel="Planned completion date" /><Text style={s.scopeDateHint}>For example: 2026-12-15</Text><View style={s.scopeDateActions}><Pressable onPress={() => { setDeadlineDraft(''); setPlannedCompletionDate(''); persistPlan({ plannedCompletionDate: '' }); setDeadlineOpen(false); }} style={s.scopeDateSecondary}><Text style={s.scopeDateSecondaryText}>No deadline</Text></Pressable><Pressable onPress={saveDeadline} style={s.scopeDatePrimary}><Text style={s.scopeDatePrimaryText}>Save date</Text></Pressable></View></View></View>
    </Modal>
    <Modal animationType="fade" transparent visible={projectMenuOpen} onRequestClose={() => setProjectMenuOpen(false)}>
      <Pressable style={s.projectMenuShade} onPress={() => setProjectMenuOpen(false)}>
        <View style={s.projectMenu}>
          <Text style={s.projectMenuHeader}>SWITCH PROJECT</Text>
          <Text style={s.projectMenuHint}>Choose a project to keep planning.</Text>
          {projects.map((project) => {
            const projectType = projectTypes.find((type) => type.name === project.type) ?? projectTypes[projectTypes.length - 1];
            const isCurrent = activeProject === project.title;
            return <Pressable key={project.title} onPress={() => { chooseProject(project); setProjectMenuOpen(false); }} style={[s.projectMenuRow, isCurrent && s.projectMenuRowActive]}>
              <View style={[s.projectMenuIcon, { backgroundColor: projectType.color }]}><Text style={s.projectMenuIconText}>{projectType.icon}</Text></View>
              <View style={s.projectMenuCopy}><Text numberOfLines={1} style={s.projectMenuProject}>{project.title}</Text><Text numberOfLines={1} style={s.projectMenuType}>{project.type}</Text></View>
              <View style={[s.projectMenuCheck, isCurrent && s.projectMenuCheckActive]}><Text style={s.projectMenuCheckText}>{isCurrent ? '✓' : ''}</Text></View>
            </Pressable>;
          })}
        </View>
      </Pressable>
    </Modal>
  </>;
}

type WritePart = { key: string; title: string; helper: string; kind: 'structure' | 'unit'; category: StructureCategory; unitIndex?: number };

const compactNote = (value: string) => value.trim().replace(/\s+/g, ' ').length > 150 ? `${value.trim().replace(/\s+/g, ' ').slice(0, 147)}…` : value.trim().replace(/\s+/g, ' ');

function getWriteParts(project: Project, blueprint: PlanBlueprint): WritePart[] {
  const structureParts = getStructureItems(project.type, blueprint).filter((item) => isStructureEnabled(project.plan.structure, item, blueprint)).map((item) => ({ key: `structure:${item.key ?? structureKeyFor(item.label)}`, title: item.label, helper: item.helper, kind: 'structure' as const, category: item.category ?? 'body' as const }));
  const unitCount = Math.max(Number.parseInt(project.unitGoal, 10) || 0, 0);
  const unitParts = Array.from({ length: unitCount }, (_, index) => ({ key: `unit:${index}`, title: `${blueprint.unitLabel[0].toUpperCase() + blueprint.unitLabel.slice(1)} ${index + 1}`, helper: `Draft the part that belongs in this ${blueprint.unitLabel}.`, kind: 'unit' as const, category: 'body' as const, unitIndex: index }));
  const plannedParts = [...structureParts, ...unitParts];
  return plannedParts.length ? plannedParts : [{ key: 'freewrite:0', title: 'Free writing', helper: 'Begin anywhere. You can shape this into parts later.', kind: 'structure' as const, category: 'body' as const }];
}

type AssembledSection = { id: string; label: string; content: string; included: boolean; complete: boolean; kind: 'front' | 'back' };
type AssembledChapter = { key: string; title: string; content: string; words: number; complete: boolean; kind: WritePart['kind']; images: BookezImage[] };
type AssembledBook = { bookId: string; title: string; status: 'draft' | 'review' | 'finished'; frontMatter: AssembledSection[]; chapters: AssembledChapter[]; backMatter: AssembledSection[]; images: BookezImage[]; totalWords: number; generatedAt: string; sourceRevision: string };

const studioFrontMatter = [
  { id: 'titlePage', label: 'Title page', automatic: true }, { id: 'copyrightPage', label: 'Copyright page' }, { id: 'dedication', label: 'Dedication' },
  { id: 'epigraph', label: 'Epigraph' }, { id: 'tableOfContents', label: 'Table of contents', automatic: true }, { id: 'preface', label: 'Preface' }, { id: 'introduction', label: 'Introduction' },
];
const studioBackMatter = [
  { id: 'acknowledgments', label: 'Acknowledgments' }, { id: 'aboutAuthor', label: 'About the author' }, { id: 'appendix', label: 'Appendix' },
  { id: 'references', label: 'References' }, { id: 'resources', label: 'Resources' }, { id: 'endnotes', label: 'Endnotes' },
];

const defaultBookStudioState = (project: Project): BookStudioState => ({
  lastSection: 'assemble',
  frontMatterIncluded: { titlePage: true, copyrightPage: false, dedication: false, epigraph: false, tableOfContents: true, preface: false, introduction: false },
  frontMatterText: { titlePage: project.title, copyrightPage: '', dedication: '', epigraph: '', preface: '', introduction: '' },
  backMatterIncluded: { acknowledgments: false, aboutAuthor: false, appendix: false, references: false, resources: false, endnotes: false },
  backMatterText: { acknowledgments: '', aboutAuthor: '', appendix: '', references: '', resources: '', endnotes: '' },
  chapterOrder: [],
  appearance: { fontSize: 16, paragraphSpacing: 10, lineSpacing: 1.55, headingStyle: 'classic', alignment: 'left' },
});

function getBookStudioState(project: Project): BookStudioState {
  const defaults = defaultBookStudioState(project);
  const saved = project.studio;
  return {
    ...defaults,
    ...saved,
    frontMatterIncluded: { ...defaults.frontMatterIncluded, ...saved?.frontMatterIncluded },
    frontMatterText: { ...defaults.frontMatterText, ...saved?.frontMatterText, titlePage: project.title },
    backMatterIncluded: { ...defaults.backMatterIncluded, ...saved?.backMatterIncluded },
    backMatterText: { ...defaults.backMatterText, ...saved?.backMatterText },
    appearance: { ...defaults.appearance, ...saved?.appearance },
    chapterOrder: saved?.chapterOrder ?? [],
  };
}

function assembleBook(project: Project, studio: BookStudioState): AssembledBook {
  const blueprint = planBlueprints[project.type] ?? planBlueprints['Custom Project'];
  const images = publicationImages(project);
  const parts = getWriteParts(project, blueprint);
  const partMap = new Map(parts.map((part) => [part.key, part]));
  const orderedKeys = [...studio.chapterOrder.filter((key) => partMap.has(key)), ...parts.map((part) => part.key).filter((key) => !studio.chapterOrder.includes(key))];
  const chapters = orderedKeys.map((key) => {
    const part = partMap.get(key)!;
    const content = project.plan.drafts[key]?.trim() ?? '';
    return { key, title: part.title, content, words: countWords(content), complete: Boolean(content), kind: part.kind, images: images.filter((image) => image.connectedPartKey === key) };
  });
  const tableOfContents = chapters.map((chapter, index) => `${index + 1}. ${chapter.title}`).join('\n');
  const frontMatter = studioFrontMatter.map((item) => ({
    id: item.id, label: item.label, kind: 'front' as const, included: Boolean(studio.frontMatterIncluded[item.id]), complete: item.automatic ? true : Boolean(studio.frontMatterText[item.id]?.trim()),
    content: item.id === 'titlePage' ? project.title : item.id === 'tableOfContents' ? tableOfContents : studio.frontMatterText[item.id]?.trim() ?? '',
  }));
  const referenceCitations = (project.plan.referenceEntries ?? []).map((entry) => entry.citation).join('\n\n');
  const backMatter = studioBackMatter.map((item) => {
    const manualText = studio.backMatterText[item.id]?.trim() ?? '';
    const content = item.id === 'references' ? [manualText, referenceCitations].filter(Boolean).join('\n\n') : manualText;
    return { id: item.id, label: item.label, kind: 'back' as const, included: Boolean(studio.backMatterIncluded[item.id]), complete: Boolean(content), content };
  });
  const totalWords = chapters.reduce((total, chapter) => total + chapter.words, 0);
  const status = totalWords === 0 ? 'draft' : project.plan.writeIndex >= parts.length && parts.length > 0 ? 'finished' : 'review';
  return { bookId: project.title, title: project.title, status, frontMatter, chapters, backMatter, images, totalWords, generatedAt: new Date().toISOString(), sourceRevision: String(project.updatedAt ?? totalWords) };
}

const buildBookText = (book: AssembledBook) => [...book.images.filter((image) => image.placement === 'cover').map((image) => ({ content: `[Front cover: ${image.caption || image.title}]` })), ...book.frontMatter.filter((section) => section.included && section.content), ...book.chapters.map((chapter) => ({ content: `${chapter.title}\n\n${chapter.images.map((image) => `[${imagePlacementLabel(image.placement)}: ${image.caption || image.title}]`).join('\n')}\n${chapter.content}` })), ...book.backMatter.filter((section) => section.included && section.content), ...book.images.filter((image) => image.placement === 'backCover').map((image) => ({ content: `[Back cover: ${image.caption || image.title}]` }))].map((section) => section.content).join('\n\n\n').trim();
const splitSpeechText = (value: string) => {
  const maxLength = Math.max(500, Math.min(3500, Speech.maxSpeechInputLength || 3500));
  if (value.length <= maxLength) return [value];
  const sentences = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [value];
  const chunks: string[] = [];
  let current = '';
  sentences.forEach((sentence) => { if ((current + sentence).length > maxLength && current) { chunks.push(current.trim()); current = ''; } current += sentence; });
  if (current.trim()) chunks.push(current.trim());
  return chunks;
};

type JourneyStatus = 'complete' | 'current' | 'future';
type JourneyMiniCheckpoint = { id: string; title: string; completed: boolean };
type JourneyMilestone = { id: string; title: string; detail: string; icon: string; status: JourneyStatus; kind: 'area' | 'step'; miniCheckpoints: JourneyMiniCheckpoint[] };

type JourneySnapshot = {
  blueprint: PlanBlueprint;
  parts: WritePart[];
  draftedParts: number;
  draftedPartKeys: string[];
  writeIndex: number;
  completedUnits: number;
  unitCount: number;
  selectedStructureCount: number;
  wordCount: number;
  targetWords: number;
  ideaReady: boolean;
  foundationReady: boolean;
  outlineReady: boolean;
  firstDraftStarted: boolean;
  halfwayReady: boolean;
  draftComplete: boolean;
  manuscriptComplete: boolean;
  exported: boolean;
  currentMilestoneIndex: number;
  progressPercent: number;
  stage: string;
  estimateLabel: string;
  estimateDetail: string;
  nextPart?: WritePart;
};

const countWords = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;
const countLetters = (value: string) => Array.from(value).filter((character) => character.toUpperCase() !== character.toLowerCase()).length;
const countSentences = (value: string) => value.trim() ? value.trim().split(/[.!?]+(?=\s|$)/).filter((sentence) => sentence.trim()).length : 0;
const countParagraphs = (value: string) => value.trim() ? value.trim().split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length : 0;
const formatCount = (value: number) => value.toLocaleString('en-US');
const activityDateKey = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyDailyActivity = (): DailyWritingActivity => ({ words: 0, pages: 0, completion: 0, minutes: 0, dictationUses: 0, writingUses: 0 });

function addActivity(plan: ProjectPlan, changes: Partial<DailyWritingActivity>, timestamp = Date.now()): Record<string, DailyWritingActivity> {
  const key = activityDateKey(timestamp);
  const current = plan.activity?.[key] ?? emptyDailyActivity();
  return {
    ...(plan.activity ?? {}),
    [key]: {
      words: Math.max(0, current.words + (changes.words ?? 0)),
      pages: Math.max(0, current.pages + (changes.pages ?? 0)),
      completion: Math.max(current.completion, changes.completion ?? current.completion),
      minutes: Math.max(0, current.minutes + (changes.minutes ?? 0)),
      dictationUses: Math.max(0, current.dictationUses + (changes.dictationUses ?? 0)),
      writingUses: Math.max(0, current.writingUses + (changes.writingUses ?? 0)),
    },
  };
}

const activityDate = (key: string) => new Date(`${key}T12:00:00`);
const formatActivityDay = (key: string, includeDate = false) => activityDate(key).toLocaleDateString('en-US', includeDate ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'short' });
const formatDuration = (minutes: number) => minutes < 1 ? '<1 min' : `${Math.round(minutes)} min`;

const writingDaysPerWeek = (frequency?: WritingFrequency, customDays?: number[]) => {
  if (frequency === 'weekdays') return 5;
  if (frequency === 'weekends') return 2;
  if (frequency === 'custom') return customDays?.length ?? 0;
  return 7;
};

const getJourneyCompletionEstimate = (plan: ProjectPlan, wordCount: number, targetWords: number) => {
  const remainingWords = Math.max(0, targetWords - wordCount);
  if (remainingWords === 0) return { label: 'Ready for review', detail: 'Your target words are drafted.' };
  if (plan.plannedCompletionDate) {
    const plannedDate = new Date(`${plan.plannedCompletionDate}T12:00:00`);
    if (!Number.isNaN(plannedDate.getTime())) return { label: plannedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), detail: 'Your planned finish date.' };
  }

  const recentWritingDays = Object.values(plan.activity ?? {}).filter((entry) => entry.words > 0);
  const recentWords = recentWritingDays.reduce((total, entry) => total + entry.words, 0);
  const customWords = Number.parseInt((plan.customPaceWords ?? '').replace(/,/g, ''), 10) || 0;
  const wordsPerWritingDay = customWords || (recentWritingDays.length ? recentWords / recentWritingDays.length : plan.paceFlexibility === 'gentle' ? 300 : plan.paceFlexibility === 'ambitious' ? 800 : 500);
  const daysPerWeek = writingDaysPerWeek(plan.writingFrequency, plan.customWritingDays);
  if (!daysPerWeek || !wordsPerWritingDay) return { label: 'Set a writing pace', detail: 'Choose writing days in Plan for an estimate.' };
  const weeks = remainingWords / (wordsPerWritingDay * daysPerWeek);
  const roundedWeeks = Math.max(1, Math.ceil(weeks));
  const basis = customWords ? `${formatCount(customWords)} words per writing day` : recentWritingDays.length ? 'your recent writing pace' : `${formatCount(Math.round(wordsPerWritingDay))} words per writing day to start`;
  return { label: `About ${roundedWeeks} ${roundedWeeks === 1 ? 'week' : 'weeks'}`, detail: `Based on ${basis} · ${writingFrequencyLabel(plan.writingFrequency, plan.customWritingDays)}.` };
};

function getJourneySnapshot(project: Project): JourneySnapshot {
  const blueprint = planBlueprints[project.type] ?? planBlueprints['Custom Project'];
  const plan = project.plan ?? defaultPlanFor(project.type);
  const parts = getWriteParts({ ...project, plan }, blueprint);
  const unitCount = Math.max(Number.parseInt(project.unitGoal, 10) || 0, 0);
  const draftedParts = parts.filter((part) => Boolean(plan.drafts[part.key]?.trim())).length;
  const draftedPartKeys = parts.filter((part) => Boolean(plan.drafts[part.key]?.trim())).map((part) => part.key);
  const structureParts = parts.filter((part) => part.kind === 'structure');
  const unitParts = parts.filter((part) => part.kind === 'unit');
  const completedUnits = parts.filter((part) => part.kind === 'unit' && Boolean(plan.drafts[part.key]?.trim())).length;
  const structureItems = getStructureItems(project.type, blueprint);
  const selectedStructureCount = structureItems.filter((item) => isStructureEnabled(plan.structure, item, blueprint)).length;
  const wordCount = Object.values(plan.drafts).reduce((total, draft) => total + countWords(draft), 0);
  const targetPages = Math.max(Number.parseInt(project.pageGoal, 10) || 0, 0);
  const targetWords = Math.max(Number.parseInt((plan.targetWords ?? '').replace(/,/g, ''), 10) || targetPages * 250, 0);
  const ideaReady = Boolean(plan.idea.trim());
  const foundationReady = targetPages > 0 && unitCount > 0 && selectedStructureCount > 0;
  const outlineReady = foundationReady && Boolean(
    plan.plotThread.trim() || plan.people.trim() || Object.values(plan.plotNotes).some((note) => note.trim()) || plan.unitIdeas.some((idea) => idea.trim()),
  );
  const firstDraftStarted = draftedParts > 0;
  const halfwayReady = parts.length > 0 && draftedParts >= Math.ceil(parts.length / 2);
  const draftComplete = parts.length > 0 && draftedParts === parts.length;
  const manuscriptComplete = draftComplete && plan.writeIndex >= parts.length;
  const progressItems = [ideaReady, foundationReady, outlineReady, firstDraftStarted, halfwayReady, draftComplete, manuscriptComplete, Boolean(project.studio?.exportedAt)];
  const currentMilestoneIndex = Boolean(project.studio?.exportedAt) ? 7 : manuscriptComplete ? 6 : draftComplete ? 5 : halfwayReady ? 4 : firstDraftStarted ? 3 : outlineReady ? 2 : foundationReady ? 1 : 0;
  const progressPercent = Math.round((progressItems.filter(Boolean).length / progressItems.length) * 100);
  const stage = manuscriptComplete ? 'Finished manuscript' : draftComplete ? 'Review & polish' : firstDraftStarted ? 'First draft' : outlineReady ? 'Ready to write' : foundationReady ? 'Book foundation' : ideaReady ? 'Book foundation' : 'Book idea';
  const completionEstimate = getJourneyCompletionEstimate(plan, wordCount, targetWords);

  return {
    blueprint, parts, draftedParts, draftedPartKeys, writeIndex: plan.writeIndex, completedUnits, unitCount, selectedStructureCount, wordCount, targetWords,
    ideaReady, foundationReady, outlineReady, firstDraftStarted, halfwayReady, draftComplete, manuscriptComplete,
    currentMilestoneIndex, progressPercent, stage, estimateLabel: completionEstimate.label, estimateDetail: completionEstimate.detail, exported: Boolean(project.studio?.exportedAt), nextPart: parts.find((part) => !plan.drafts[part.key]?.trim()) ?? parts[0],
  };
}

function getJourneyMilestones(snapshot: JourneySnapshot): JourneyMilestone[] {
  type JourneyDraft = Omit<JourneyMilestone, 'status'> & { completed: boolean };
  const drafts: JourneyDraft[] = [];
  const addCheckpoint = (id: string, title: string, detail: string, icon: string, completed: boolean, miniCheckpoints: JourneyMiniCheckpoint[]) => drafts.push({ id, title, detail, icon, kind: 'area', completed, miniCheckpoints });
  const draftedPercent = snapshot.parts.length ? Math.round((snapshot.draftedParts / snapshot.parts.length) * 100) : 0;
  const firstQuarter = snapshot.parts.length > 0 && snapshot.draftedParts >= Math.max(1, Math.ceil(snapshot.parts.length / 4));
  const hasOutlineNotes = Boolean(snapshot.outlineReady);

  addCheckpoint('book-started', 'Book started', snapshot.ideaReady ? 'The promise of this book is written down.' : 'Give the work a clear promise to follow.', '✦', snapshot.ideaReady, [
    { id: 'idea', title: 'Book idea captured', completed: snapshot.ideaReady },
    { id: 'project-shape', title: 'A direction is taking shape', completed: hasOutlineNotes },
  ]);
  addCheckpoint('book-foundation', 'Book foundation set', snapshot.foundationReady ? `${snapshot.selectedStructureCount} planned pieces are ready to carry the work.` : 'Set the shape, scale, and pieces of the book.', '◈', snapshot.foundationReady, [
    { id: 'scope', title: 'Book scope chosen', completed: snapshot.targetWords > 0 },
    { id: 'parts', title: 'Writing parts selected', completed: snapshot.selectedStructureCount > 0 && snapshot.unitCount > 0 },
  ]);
  addCheckpoint('outline', 'Outline ready', snapshot.outlineReady ? 'Your notes are giving the book a direction.' : 'Add a throughline, notes, or part ideas.', '⌁', snapshot.outlineReady, [
    { id: 'throughline', title: 'A central thread is visible', completed: hasOutlineNotes },
    { id: 'part-ideas', title: 'At least one part has a note', completed: snapshot.outlineReady },
  ]);
  addCheckpoint('first-draft', 'First draft underway', snapshot.firstDraftStarted ? `${snapshot.draftedParts} of ${snapshot.parts.length} parts have words in them.` : 'Open the manuscript and make the first part real.', '✎', snapshot.firstDraftStarted, [
    { id: 'opening', title: 'The opening part has words', completed: snapshot.firstDraftStarted },
    { id: 'quarter', title: 'A quarter of the parts are drafted', completed: firstQuarter },
  ]);
  addCheckpoint('halfway-point', 'Halfway drafted', snapshot.halfwayReady ? 'The middle of the route is behind you.' : `Keep going until ${Math.ceil(snapshot.parts.length / 2) || 'the first'} parts have a draft.`, '◌', snapshot.halfwayReady, [
    { id: 'middle', title: 'Half of the planned parts are drafted', completed: snapshot.halfwayReady },
    { id: 'momentum', title: 'The manuscript has momentum', completed: draftedPercent >= 60 },
  ]);
  addCheckpoint('draft-complete', 'First draft complete', snapshot.draftComplete ? 'Every selected part has a draft.' : `${snapshot.draftedParts} of ${snapshot.parts.length} parts are drafted.`, '✓', snapshot.draftComplete, [
    { id: 'all-parts', title: 'Every selected part has words', completed: snapshot.draftComplete },
    { id: 'last-page', title: 'The final planned part is drafted', completed: snapshot.draftComplete },
  ]);
  addCheckpoint('manuscript-complete', 'Manuscript complete', snapshot.manuscriptComplete ? 'You reached the end of the writing path.' : 'Move through the completed draft and make the last pass.', '✧', snapshot.manuscriptComplete, [
    { id: 'full-draft', title: 'The full draft is assembled', completed: snapshot.draftComplete },
    { id: 'review', title: 'The manuscript is ready to share', completed: snapshot.manuscriptComplete },
  ]);
  addCheckpoint('book-exported', 'Book shared', snapshot.exported ? 'The assembled book has been shared from Book Studio.' : 'Share the assembled manuscript when it feels ready.', '↗', snapshot.exported, [
    { id: 'studio', title: 'Book Studio is ready', completed: snapshot.manuscriptComplete },
    { id: 'export', title: 'A finished book is exported', completed: snapshot.exported },
  ]);

  const currentIndex = drafts.findIndex((milestone) => !milestone.completed);
  return drafts.map(({ completed, ...milestone }, index) => ({ ...milestone, status: completed ? 'complete' : index === currentIndex ? 'current' : 'future' }));
}

type JourneyNextStep = { title: string; time: string };

function getJourneyNextStep(snapshot: JourneySnapshot, milestone: JourneyMilestone): JourneyNextStep {
  if (milestone.id === 'book-started') return { title: 'Write a one-sentence promise for your book', time: 'About 5 minutes' };
  if (milestone.id === 'book-foundation') return { title: 'Choose the pieces your book needs', time: 'About 10 minutes' };
  if (milestone.id === 'outline') return { title: 'Create your story’s central conflict', time: 'About 5 minutes' };
  if (milestone.id === 'first-draft') return { title: 'Write the opening section', time: 'About 15 minutes' };
  if (milestone.id === 'halfway-point') return { title: snapshot.nextPart ? `Write ${snapshot.nextPart.title}` : 'Write the next section', time: 'About 20 minutes' };
  if (milestone.id === 'draft-complete') return { title: 'Read through the full draft once', time: 'About 20 minutes' };
  if (milestone.id === 'manuscript-complete') return { title: 'Choose one polish pass to make', time: 'About 10 minutes' };
  if (milestone.id === 'book-exported') return { title: 'Open Book Studio to export', time: 'About 5 minutes' };
  return { title: milestone.title, time: 'About 5 minutes' };
}

function getJourneyCheckpointProgress(snapshot: JourneySnapshot, milestone: JourneyMilestone, plan: ProjectPlan) {
  const finishEstimate = getJourneyCompletionEstimate(plan, snapshot.wordCount, snapshot.targetWords);
  if (milestone.status === 'complete') return { progress: 100, estimateLabel: 'Complete', estimateDetail: 'This checkpoint is part of your finished path.' };
  if (milestone.id === 'book-started') return { progress: 0, estimateLabel: 'About 5 minutes', estimateDetail: 'Capture the book’s promise to begin this path.' };
  if (milestone.id === 'book-foundation') return { progress: 0, estimateLabel: 'About 10 minutes', estimateDetail: 'Choose the scope and writing pieces that will carry the book.' };
  if (milestone.id === 'outline') return { progress: snapshot.foundationReady ? 50 : 0, estimateLabel: 'About 10 minutes', estimateDetail: 'A throughline, note, or part idea will make the outline ready.' };
  if (milestone.id === 'first-draft') return { progress: snapshot.parts.length ? Math.min(99, Math.round((snapshot.draftedParts / snapshot.parts.length) * 100)) : 0, estimateLabel: finishEstimate.label, estimateDetail: finishEstimate.detail };
  if (milestone.id === 'halfway-point') return { progress: snapshot.parts.length ? Math.min(99, Math.round((snapshot.draftedParts / Math.max(1, Math.ceil(snapshot.parts.length / 2))) * 100)) : 0, estimateLabel: finishEstimate.label, estimateDetail: finishEstimate.detail };
  if (milestone.id === 'draft-complete') return { progress: snapshot.parts.length ? Math.min(99, Math.round((snapshot.draftedParts / snapshot.parts.length) * 100)) : 0, estimateLabel: finishEstimate.label, estimateDetail: finishEstimate.detail };
  if (milestone.id === 'manuscript-complete') return { progress: snapshot.parts.length ? Math.min(99, Math.round((snapshot.writeIndex / snapshot.parts.length) * 100)) : 0, estimateLabel: snapshot.draftComplete ? 'About 10 minutes' : finishEstimate.label, estimateDetail: snapshot.draftComplete ? 'Read through the assembled draft and make the final pass.' : finishEstimate.detail };
  return { progress: snapshot.manuscriptComplete ? 50 : 0, estimateLabel: snapshot.manuscriptComplete ? 'About 5 minutes' : 'After manuscript completion', estimateDetail: snapshot.manuscriptComplete ? 'Open Book Studio and share the finished book.' : 'This checkpoint unlocks when the manuscript is complete.' };
}

function getJourneyMiniCheckpointProgress(snapshot: JourneySnapshot, milestone: JourneyMilestone, checkpoint: JourneyMiniCheckpoint, plan: ProjectPlan) {
  if (checkpoint.completed) return { progress: 100, estimateLabel: 'Complete', estimateDetail: `This step is complete within “${milestone.title}”.` };
  const finishEstimate = getJourneyCompletionEstimate(plan, snapshot.wordCount, snapshot.targetWords);
  const draftedPercent = snapshot.parts.length ? Math.round((snapshot.draftedParts / snapshot.parts.length) * 100) : 0;
  const progressForDraft = (threshold = 100) => Math.min(99, Math.round((draftedPercent / threshold) * 100));
  if (checkpoint.id === 'idea') return { progress: 0, estimateLabel: 'About 5 minutes', estimateDetail: 'Write one sentence that names the promise, problem, or feeling this project will carry.' };
  if (checkpoint.id === 'project-shape') return { progress: snapshot.foundationReady ? 100 : snapshot.ideaReady ? 50 : 0, estimateLabel: 'About 10 minutes', estimateDetail: 'Choose the project’s scale and the pieces that will give it a clear shape.' };
  if (checkpoint.id === 'scope') return { progress: snapshot.targetWords > 0 ? 100 : 0, estimateLabel: 'About 5 minutes', estimateDetail: 'Set a target size in Plan so the journey can estimate what remains.' };
  if (checkpoint.id === 'parts') return { progress: snapshot.selectedStructureCount > 0 && snapshot.unitCount > 0 ? 100 : 0, estimateLabel: 'About 10 minutes', estimateDetail: 'Choose the structure pieces and writing units you want to carry this project.' };
  if (checkpoint.id === 'throughline') return { progress: snapshot.outlineReady ? 100 : snapshot.foundationReady ? 50 : 0, estimateLabel: 'About 5 minutes', estimateDetail: 'Add a throughline, central question, or guiding idea in Plan.' };
  if (checkpoint.id === 'part-ideas') return { progress: snapshot.outlineReady ? 100 : snapshot.firstDraftStarted ? 50 : 0, estimateLabel: 'About 5 minutes', estimateDetail: 'Give at least one writing unit a note about what it needs to do.' };
  if (checkpoint.id === 'opening') return { progress: snapshot.firstDraftStarted ? 100 : 0, estimateLabel: 'About 15 minutes', estimateDetail: snapshot.nextPart ? `Open ${snapshot.nextPart.title} and give the project its first real words.` : 'Open the manuscript and write the opening section.' };
  if (checkpoint.id === 'quarter') return { progress: progressForDraft(25), estimateLabel: finishEstimate.label, estimateDetail: `Draft about a quarter of the planned writing units. ${finishEstimate.detail}` };
  if (checkpoint.id === 'middle') return { progress: progressForDraft(50), estimateLabel: finishEstimate.label, estimateDetail: `Keep drafting until about half of the planned writing units have words. ${finishEstimate.detail}` };
  if (checkpoint.id === 'momentum') return { progress: progressForDraft(60), estimateLabel: finishEstimate.label, estimateDetail: 'Build a little more momentum by reaching roughly 60% drafted.' };
  if (checkpoint.id === 'all-parts' || checkpoint.id === 'last-page') return { progress: progressForDraft(), estimateLabel: finishEstimate.label, estimateDetail: `${snapshot.draftedParts} of ${snapshot.parts.length} planned parts have words.` };
  if (checkpoint.id === 'full-draft') return { progress: snapshot.draftComplete ? 100 : progressForDraft(), estimateLabel: finishEstimate.label, estimateDetail: 'Complete every selected part so the full draft is assembled.' };
  if (checkpoint.id === 'review') return { progress: snapshot.manuscriptComplete ? 100 : snapshot.draftComplete ? 50 : 0, estimateLabel: snapshot.draftComplete ? 'About 10 minutes' : finishEstimate.label, estimateDetail: snapshot.draftComplete ? 'Read through the assembled draft and make one final pass.' : 'This step opens when every selected part has a draft.' };
  if (checkpoint.id === 'studio') return { progress: snapshot.manuscriptComplete ? 100 : 0, estimateLabel: snapshot.manuscriptComplete ? 'About 5 minutes' : 'After manuscript completion', estimateDetail: 'Open Book Studio once the manuscript is complete.' };
  if (checkpoint.id === 'export') return { progress: snapshot.exported ? 100 : snapshot.manuscriptComplete ? 50 : 0, estimateLabel: snapshot.manuscriptComplete ? 'About 5 minutes' : 'After manuscript completion', estimateDetail: snapshot.manuscriptComplete ? 'Choose a format and share the assembled book from Book Studio.' : 'Finish and review the manuscript before exporting.' };
  return { progress: 0, estimateLabel: 'About 5 minutes', estimateDetail: `Continue the steps inside “${milestone.title}”.` };
}

type JourneyTodayPlan = {
  title: string;
  detail: string;
  goal: string;
  actionLabel: string;
  actionPage: Page;
  tone: 'scheduled' | 'open' | 'ahead' | 'adjusted' | 'foundation' | 'paused';
};

function getJourneyTodayPlan(project: Project, snapshot: JourneySnapshot): JourneyTodayPlan | null {
  const plan = project.plan ?? defaultPlanFor(project.type);
  if (!hasWritingPlan(project, plan)) return null;

  const nextPartLabel = snapshot.nextPart ? `Draft ${snapshot.nextPart.title}` : 'Continue your manuscript';
  const sessionConfig = getWritingSessionConfig(plan.writingSessionMode ?? 'gentle', plan.customWritingMinutes ?? '20', plan.customBreakMinutes ?? '5');
  const sessionMinutes = sessionConfig.countsUp ? suggestedSessionMinutes(plan.writingFrequency, plan.paceFlexibility) : sessionConfig.writingMinutes;
  const customWords = Number.parseInt((plan.customPaceWords ?? '').replace(/,/g, ''), 10) || 0;
  const recentWritingDays = Object.values(plan.activity ?? {}).filter((entry) => entry.words > 0);
  const recentWords = recentWritingDays.reduce((total, entry) => total + entry.words, 0);
  const wordGoal = customWords || (recentWritingDays.length ? Math.round(recentWords / recentWritingDays.length) : plan.paceFlexibility === 'gentle' ? 300 : plan.paceFlexibility === 'ambitious' ? 800 : 500);
  const formattedGoal = `Goal: approximately ${formatCount(Math.max(100, Math.round(wordGoal / 50) * 50))} words`;
  const schedule = plan.writingFrequency;
  const formalSchedule = Boolean(schedule && (schedule !== 'custom' || plan.customWritingDays?.length));
  const today = new Date();
  const planStart = plan.writingPlanCreatedAt ? new Date(plan.writingPlanCreatedAt) : new Date(today.getTime() - 14 * 86_400_000);
  const lookbackStart = new Date(Math.max(planStart.getTime(), today.getTime() - 14 * 86_400_000));
  const scheduledPastDays: string[] = [];
  for (let cursor = new Date(lookbackStart); cursor < today; cursor.setDate(cursor.getDate() + 1)) {
    if (isScheduledWritingDay(schedule, plan.customWritingDays, cursor)) scheduledPastDays.push(activityDateKey(cursor.getTime()));
  }
  const completedScheduledDays = scheduledPastDays.filter((key) => {
    const activity = plan.activity?.[key];
    return Boolean(activity && (activity.words > 0 || activity.minutes >= 5 || activity.writingUses > 0));
  }).length;
  const completedWritingDays = Object.entries(plan.activity ?? {}).filter(([key, activity]) => {
    const date = activityDate(key);
    return date >= lookbackStart && date < today && (activity.words > 0 || activity.minutes >= 5 || activity.writingUses > 0);
  }).length;
  const missedSessions = Math.max(0, scheduledPastDays.length - completedScheduledDays);
  const sessionsAhead = Math.max(0, completedWritingDays - scheduledPastDays.length);
  const scheduledToday = formalSchedule && isScheduledWritingDay(schedule, plan.customWritingDays, today);
  const foundationPhase = !snapshot.firstDraftStarted && !snapshot.outlineReady;
  const currentFoundationMilestone = getJourneyMilestones(snapshot).find((milestone) => milestone.status === 'current') ?? getJourneyMilestones(snapshot)[0];
  const foundationNext = getJourneyNextStep(snapshot, currentFoundationMilestone);

  if (plan.writingPlanPaused) {
    return { title: 'Resume your journey whenever you’re ready', detail: 'Your writing plan is paused. Nothing is waiting for you today.', goal: 'Your pace is yours to choose.', actionLabel: 'Resume plan', actionPage: 'Journey', tone: 'paused' };
  }
  if (foundationPhase) {
    return { title: 'Complete one planning step', detail: `${foundationNext.title} · ${foundationNext.time}`, goal: 'A small step is enough to move the book forward.', actionLabel: 'Open planning', actionPage: 'Plan', tone: 'foundation' };
  }
  if (formalSchedule && missedSessions >= 3) {
    return { title: 'Your plan has been gently adjusted', detail: `${nextPartLabel} · ${Math.max(15, Math.round(sessionMinutes * 0.75))} minutes`, goal: 'A lighter return session is waiting for you.', actionLabel: 'Start gently', actionPage: 'Write', tone: 'adjusted' };
  }
  if (formalSchedule && sessionsAhead >= 2) {
    return { title: `You’re ${sessionsAhead} sessions ahead`, detail: 'Today can be a lighter or optional writing day.', goal: formattedGoal, actionLabel: 'Continue writing', actionPage: 'Write', tone: 'ahead' };
  }
  if (scheduledToday) {
    return { title: `${nextPartLabel} for ${sessionMinutes} minutes`, detail: writingFrequencyLabel(schedule, plan.customWritingDays), goal: formattedGoal, actionLabel: 'Start today’s session', actionPage: 'Write', tone: 'scheduled' };
  }
  return { title: 'Continue wherever you left off', detail: `${nextPartLabel} · ${sessionMinutes} minutes when it suits you`, goal: formattedGoal, actionLabel: 'Open manuscript', actionPage: 'Write', tone: 'open' };
}

const formatLastEdited = (updatedAt?: number) => {
  if (!updatedAt) return 'Not recorded';
  const elapsed = Date.now() - updatedAt;
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.max(1, Math.round(elapsed / 60_000))}m ago`;
  if (elapsed < 86_400_000) return `${Math.max(1, Math.round(elapsed / 3_600_000))}h ago`;
  return new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type StatsRange = 'Week' | 'Month' | 'All time';
type StatsScope = 'overall' | 'project';
type ActivityEntry = DailyWritingActivity & { key: string };

function getStatsSnapshot(project: Project, range: StatsRange) {
  const plan = project.plan ?? defaultPlanFor(project.type);
  const journey = getJourneySnapshot(project);
  const allEntries: ActivityEntry[] = Object.entries(plan.activity ?? {}).map(([key, value]) => ({ key, ...value })).sort((a, b) => a.key.localeCompare(b.key));
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (range === 'Week') cutoff.setDate(cutoff.getDate() - 6);
  if (range === 'Month') cutoff.setDate(cutoff.getDate() - 29);
  const entries = range === 'All time' ? allEntries : allEntries.filter((entry) => activityDate(entry.key) >= cutoff);
  const writingDays = entries.filter((entry) => entry.words > 0);
  const lifetimeWritingDays = allEntries.filter((entry) => entry.words > 0);
  const totalLoggedWords = writingDays.reduce((total, entry) => total + entry.words, 0);
  const totalLoggedPages = writingDays.reduce((total, entry) => total + entry.pages, 0);
  const totalMinutes = entries.reduce((total, entry) => total + entry.minutes, 0);
  const dictationUses = entries.reduce((total, entry) => total + entry.dictationUses, 0);
  const writingUses = entries.reduce((total, entry) => total + entry.writingUses, 0);
  const completionEntries = writingDays.filter((entry) => entry.completion > 0);
  const sortedWritingDays = lifetimeWritingDays.map((entry) => entry.key).sort();
  const activeKeySet = new Set(sortedWritingDays);
  const todayKey = activityDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let streakCursor = activeKeySet.has(todayKey) ? new Date() : yesterday;
  let currentStreak = 0;
  while (activeKeySet.has(activityDateKey(streakCursor.getTime()))) {
    currentStreak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }
  let longestStreak = 0;
  let runningStreak = 0;
  let previousKey = '';
  sortedWritingDays.forEach((key) => {
    const previousDate = previousKey ? activityDate(previousKey) : undefined;
    const day = activityDate(key);
    const consecutive = previousDate ? Math.round((day.getTime() - previousDate.getTime()) / 86_400_000) === 1 : false;
    runningStreak = consecutive ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousKey = key;
  });
  const strongestDay = writingDays.reduce<ActivityEntry | undefined>((best, entry) => !best || entry.words > best.words ? entry : best, undefined);
  const inputTotal = dictationUses + writingUses;
  const dailyRows = [...entries].sort((a, b) => b.key.localeCompare(a.key));
  return {
    journey, entries, writingDays, lifetimeWritingDays, totalLoggedWords, totalLoggedPages, totalMinutes, dictationUses, writingUses,
    completionAverage: completionEntries.length ? completionEntries.reduce((total, entry) => total + entry.completion, 0) / completionEntries.length : 0,
    averageWords: writingDays.length ? totalLoggedWords / writingDays.length : 0,
    averagePages: writingDays.length ? totalLoggedPages / writingDays.length : 0,
    averageMinutes: writingDays.length ? totalMinutes / writingDays.length : 0,
    averageMinutesPerPage: totalLoggedPages ? totalMinutes / totalLoggedPages : 0,
    currentStreak, longestStreak, activeDays: writingDays.length, lifetimeActiveDays: lifetimeWritingDays.length,
    dictationPercent: inputTotal ? Math.round((dictationUses / inputTotal) * 100) : 0,
    writingPercent: inputTotal ? Math.round((writingUses / inputTotal) * 100) : 0,
    strongestDay, dailyRows, chartRows: Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); const key = activityDateKey(date.getTime()); return { key, ...(plan.activity?.[key] ?? emptyDailyActivity()) }; }),
  };
}

function getOverallStatsSnapshot(projects: Project[], range: StatsRange) {
  const snapshots = projects.map((project) => getJourneySnapshot(project));
  const plans = projects.map((project) => project.plan ?? defaultPlanFor(project.type));
  const allEntriesMap = new Map<string, DailyWritingActivity>();
  plans.forEach((plan) => Object.entries(plan.activity ?? {}).forEach(([key, value]) => {
    const current = allEntriesMap.get(key) ?? emptyDailyActivity();
    allEntriesMap.set(key, { words: current.words + value.words, pages: current.pages + value.pages, completion: Math.max(current.completion, value.completion), minutes: current.minutes + value.minutes, dictationUses: current.dictationUses + value.dictationUses, writingUses: current.writingUses + value.writingUses });
  }));
  const allEntries: ActivityEntry[] = Array.from(allEntriesMap, ([key, value]) => ({ key, ...value })).sort((a, b) => a.key.localeCompare(b.key));
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (range === 'Week') cutoff.setDate(cutoff.getDate() - 6);
  if (range === 'Month') cutoff.setDate(cutoff.getDate() - 29);
  const entries = range === 'All time' ? allEntries : allEntries.filter((entry) => activityDate(entry.key) >= cutoff);
  const writingDays = entries.filter((entry) => entry.words > 0);
  const lifetimeWritingDays = allEntries.filter((entry) => entry.words > 0);
  const totalLoggedWords = writingDays.reduce((total, entry) => total + entry.words, 0);
  const totalLoggedPages = writingDays.reduce((total, entry) => total + entry.pages, 0);
  const totalMinutes = entries.reduce((total, entry) => total + entry.minutes, 0);
  const dictationUses = entries.reduce((total, entry) => total + entry.dictationUses, 0);
  const writingUses = entries.reduce((total, entry) => total + entry.writingUses, 0);
  const completionEntries = writingDays.filter((entry) => entry.completion > 0);
  const sortedWritingDays = lifetimeWritingDays.map((entry) => entry.key).sort();
  const activeKeySet = new Set(sortedWritingDays);
  const todayKey = activityDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let streakCursor = activeKeySet.has(todayKey) ? new Date() : yesterday;
  let currentStreak = 0;
  while (activeKeySet.has(activityDateKey(streakCursor.getTime()))) {
    currentStreak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }
  let longestStreak = 0;
  let runningStreak = 0;
  let previousKey = '';
  sortedWritingDays.forEach((key) => {
    const previousDate = previousKey ? activityDate(previousKey) : undefined;
    const day = activityDate(key);
    const consecutive = previousDate ? Math.round((day.getTime() - previousDate.getTime()) / 86_400_000) === 1 : false;
    runningStreak = consecutive ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousKey = key;
  });
  const strongestDay = writingDays.reduce<ActivityEntry | undefined>((best, entry) => !best || entry.words > best.words ? entry : best, undefined);
  const inputTotal = dictationUses + writingUses;
  const dailyRows = [...entries].sort((a, b) => b.key.localeCompare(a.key));
  const totalWords = snapshots.reduce((total, snapshot) => total + snapshot.wordCount, 0);
  const totalTargetWords = snapshots.reduce((total, snapshot) => total + snapshot.targetWords, 0);
  const totalUnits = snapshots.reduce((total, snapshot) => total + snapshot.unitCount, 0);
  const totalCompletedUnits = snapshots.reduce((total, snapshot) => total + snapshot.completedUnits, 0);
  const firstJourney = snapshots[0] ?? getJourneySnapshot(projects[0]);
  const journey = { ...firstJourney, wordCount: totalWords, targetWords: totalTargetWords, unitCount: totalUnits, completedUnits: totalCompletedUnits, progressPercent: totalTargetWords ? Math.min(100, Math.round((totalWords / totalTargetWords) * 100)) : 0, stage: 'All projects' };
  return {
    journey, entries, writingDays, lifetimeWritingDays, totalLoggedWords, totalLoggedPages, totalMinutes, dictationUses, writingUses,
    completionAverage: completionEntries.length ? completionEntries.reduce((total, entry) => total + entry.completion, 0) / completionEntries.length : 0,
    averageWords: writingDays.length ? totalLoggedWords / writingDays.length : 0,
    averagePages: writingDays.length ? totalLoggedPages / writingDays.length : 0,
    averageMinutes: writingDays.length ? totalMinutes / writingDays.length : 0,
    averageMinutesPerPage: totalLoggedPages ? totalMinutes / totalLoggedPages : 0,
    currentStreak, longestStreak, activeDays: writingDays.length, lifetimeActiveDays: lifetimeWritingDays.length,
    dictationPercent: inputTotal ? Math.round((dictationUses / inputTotal) * 100) : 0,
    writingPercent: inputTotal ? Math.round((writingUses / inputTotal) * 100) : 0,
    strongestDay, dailyRows, chartRows: Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); const key = activityDateKey(date.getTime()); return { key, ...(allEntriesMap.get(key) ?? emptyDailyActivity()) }; }),
  };
}

type Achievement = { id: string; title: string; detail: string; icon: string; completed: boolean };

function getProjectMilestones(project: Project): Achievement[] {
  const snapshot = getJourneySnapshot(project);
  const firstWritingPart = snapshot.parts.find((part) => part.kind === 'unit') ?? snapshot.parts.find((part) => part.kind !== 'structure');
  const firstChapterDrafted = firstWritingPart ? snapshot.draftedPartKeys.includes(firstWritingPart.key) : snapshot.firstDraftStarted;
  const wordCompletion = snapshot.targetWords ? Math.min(100, Math.round((snapshot.wordCount / snapshot.targetWords) * 100)) : 0;
  const completionDetail = (threshold: number) => snapshot.targetWords ? `${wordCompletion}% of target · need ${formatCount(Math.max(0, Math.ceil(snapshot.targetWords * (threshold / 100)) - snapshot.wordCount))} more words` : 'Set a target in Plan to track this marker';
  return [
    { id: 'foundation', title: 'Project foundation completed', detail: snapshot.foundationReady ? 'The shape and scale of this book are in place.' : 'Complete the book’s basic shape and scope.', icon: '◈', completed: snapshot.foundationReady },
    { id: 'outline', title: 'Outline completed', detail: snapshot.outlineReady ? 'Your notes are giving the work a direction.' : 'Add a throughline, notes, or part ideas.', icon: '⌁', completed: snapshot.outlineReady },
    { id: 'first-chapter', title: 'First chapter drafted', detail: firstChapterDrafted ? 'The manuscript has its first real section.' : 'Draft the first writing unit.', icon: '✎', completed: firstChapterDrafted },
    { id: 'ten-percent', title: '10% of manuscript completed', detail: completionDetail(10), icon: '10', completed: wordCompletion >= 10 },
    { id: 'twenty-five-percent', title: '25% of manuscript completed', detail: completionDetail(25), icon: '25', completed: wordCompletion >= 25 },
    { id: 'halfway', title: '50% of manuscript completed', detail: completionDetail(50), icon: '½', completed: wordCompletion >= 50 },
    { id: 'seventy-five-percent', title: '75% of manuscript completed', detail: completionDetail(75), icon: '75', completed: wordCompletion >= 75 },
    { id: 'one-thousand', title: 'First 1,000 words', detail: snapshot.wordCount >= 1000 ? 'The project has its first substantial foothold.' : `${formatCount(Math.max(0, 1000 - snapshot.wordCount))} words until this marker.`, icon: '1K', completed: snapshot.wordCount >= 1000 },
    { id: 'ten-thousand', title: '10,000 words in this project', detail: snapshot.wordCount >= 10000 ? 'A meaningful body of work is taking shape.' : `${formatCount(Math.max(0, 10000 - snapshot.wordCount))} words until this marker.`, icon: '✧', completed: snapshot.wordCount >= 10000 },
    { id: 'first-draft', title: 'First draft completed', detail: snapshot.draftComplete ? 'Every selected part has a draft.' : `${snapshot.draftedParts} of ${snapshot.parts.length} parts are drafted.`, icon: '✓', completed: snapshot.draftComplete },
    { id: 'revision', title: 'Revision completed', detail: snapshot.manuscriptComplete ? 'You reached the end of the writing path.' : 'Read through the full draft and make the last pass.', icon: '✦', completed: snapshot.manuscriptComplete },
    { id: 'exported', title: 'Book exported', detail: snapshot.exported ? 'The assembled book has been shared from Book Studio.' : 'Share the assembled manuscript when it feels ready.', icon: '↗', completed: snapshot.exported },
  ];
}

function getWriterAchievements(projects: Project[]): Achievement[] {
  const snapshots = projects.map((project) => ({ project, snapshot: getJourneySnapshot(project) }));
  const totalWords = snapshots.reduce((total, item) => total + item.snapshot.wordCount, 0);
  const activeDays = new Set<string>();
  const dailyWords = new Map<string, number>();
  let sessions = 0;
  snapshots.forEach(({ project }) => {
    const plan = project.plan ?? defaultPlanFor(project.type);
    Object.entries(plan.activity ?? {}).forEach(([key, activity]) => {
      if (activity.words > 0) {
        activeDays.add(key);
        dailyWords.set(key, (dailyWords.get(key) ?? 0) + activity.words);
      }
    });
    sessions += plan.writingSessionHistory?.length ?? 0;
  });
  const completedProjects = snapshots.filter(({ snapshot }) => snapshot.manuscriptComplete).length;
  const projectTypesWithWords = new Set(snapshots.filter(({ snapshot }) => snapshot.wordCount > 0).map(({ project }) => project.type)).size;
  const recordWords = Math.max(0, ...dailyWords.values());
  return [
    { id: 'total-1k', title: '1,000 total words written', detail: `${formatCount(totalWords)} words across your books.`, icon: '1K', completed: totalWords >= 1000 },
    { id: 'total-10k', title: '10,000 total words written', detail: `${formatCount(totalWords)} words across your books.`, icon: '10K', completed: totalWords >= 10000 },
    { id: 'total-50k', title: '50,000 total words written', detail: `${formatCount(totalWords)} words across your books.`, icon: '50K', completed: totalWords >= 50000 },
    { id: 'total-100k', title: '100,000 total words written', detail: `${formatCount(totalWords)} words across your books.`, icon: '100K', completed: totalWords >= 100000 },
    { id: 'seven-days', title: 'Wrote on seven different days', detail: `${activeDays.size} different writing days recorded.`, icon: '7×', completed: activeDays.size >= 7 },
    { id: 'twenty-five-sessions', title: 'Completed 25 writing sessions', detail: `${sessions} completed focus sessions recorded.`, icon: '25', completed: sessions >= 25 },
    { id: 'first-draft', title: 'Finished a first draft', detail: completedProjects ? `${completedProjects} finished project${completedProjects === 1 ? '' : 's'}.` : 'Complete every planned part of one project.', icon: '✓', completed: completedProjects >= 1 },
    { id: 'three-projects', title: 'Completed three projects', detail: `${completedProjects} completed project${completedProjects === 1 ? '' : 's'}.`, icon: '3', completed: completedProjects >= 3 },
    { id: 'three-types', title: 'Wrote in three different project types', detail: `${projectTypesWithWords} project type${projectTypesWithWords === 1 ? '' : 's'} with words.`, icon: '◇', completed: projectTypesWithWords >= 3 },
    { id: 'daily-record', title: 'Reached a personal daily word record', detail: recordWords ? `Your best recorded day is ${formatCount(recordWords)} words.` : 'Your first writing day will set a personal record.', icon: '↗', completed: recordWords > 0 },
  ];
}

function getWriterOverviewStats(projects: Project[]): SpecializedStat[] {
  const snapshots = projects.map((project) => getJourneySnapshot(project));
  const totalWords = snapshots.reduce((total, snapshot) => total + snapshot.wordCount, 0);
  const completedProjects = snapshots.filter((snapshot) => snapshot.manuscriptComplete).length;
  const totalSessions = projects.reduce((total, project) => total + (project.plan?.writingSessionHistory?.length ?? 0), 0);
  const totalMinutes = projects.reduce((total, project) => total + Object.values(project.plan?.activity ?? {}).reduce((minutes, entry) => minutes + entry.minutes, 0), 0);
  const projectTypes = new Set(projects.filter((project) => getJourneySnapshot(project).wordCount > 0).map((project) => project.type)).size;
  return [
    { label: 'Total words', value: formatCount(totalWords), detail: 'across all Bookez projects' },
    { label: 'Projects created', value: formatCount(projects.length), detail: 'writing objects started' },
    { label: 'Projects completed', value: formatCount(completedProjects), detail: 'finished writing paths' },
    { label: 'Total sessions', value: formatCount(totalSessions), detail: 'completed focus sessions' },
    { label: 'Total writing time', value: formatDuration(totalMinutes), detail: 'focused time across Bookez' },
    { label: 'Project types explored', value: formatCount(projectTypes), detail: 'formats with words written' },
  ];
}

function getPersonalRecordStats(projects: Project[]): SpecializedStat[] {
  const dailyWords = new Map<string, number>();
  const weeklyWords = new Map<string, number>();
  let longestSession = 0;
  let fastestPace = 0;
  projects.forEach((project) => {
    const plan = project.plan ?? defaultPlanFor(project.type);
    Object.entries(plan.activity ?? {}).forEach(([key, entry]) => {
      dailyWords.set(key, (dailyWords.get(key) ?? 0) + entry.words);
      const date = activityDate(key);
      const firstDay = new Date(date.getFullYear(), 0, 1);
      const weekKey = `${date.getFullYear()}-${Math.ceil((((date.getTime() - firstDay.getTime()) / 86_400_000) + firstDay.getDay() + 1) / 7)}`;
      weeklyWords.set(weekKey, (weeklyWords.get(weekKey) ?? 0) + entry.words);
      if (entry.minutes > 0) fastestPace = Math.max(fastestPace, Math.round((entry.words / entry.minutes) * 60));
    });
    (plan.writingSessionHistory ?? []).forEach((session) => { longestSession = Math.max(longestSession, session.writingMinutes); });
  });
  const highestDay = Math.max(0, ...dailyWords.values());
  const highestWeek = Math.max(0, ...weeklyWords.values());
  const allWritingDays = new Set<string>(dailyWords.keys());
  let longestStreak = 0;
  let currentStreak = 0;
  let previousDate: Date | undefined;
  Array.from(allWritingDays).sort().forEach((key) => {
    const date = activityDate(key);
    const consecutive = previousDate ? Math.round((date.getTime() - previousDate.getTime()) / 86_400_000) === 1 : false;
    currentStreak = consecutive ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    previousDate = date;
  });
  return [
    { label: 'Highest daily word count', value: highestDay ? formatCount(highestDay) : '—', detail: 'best single writing day' },
    { label: 'Highest weekly word count', value: highestWeek ? formatCount(highestWeek) : '—', detail: 'best writing week' },
    { label: 'Longest writing session', value: longestSession ? formatDuration(longestSession) : '—', detail: 'longest focused session' },
    { label: 'Fastest writing pace', value: fastestPace ? `${formatCount(fastestPace)} / hr` : '—', detail: 'highest logged pace' },
    { label: 'Longest streak', value: longestStreak ? `${longestStreak} days` : '—', detail: 'best consistency streak' },
  ];
}

function getLatestCompletedMilestone(project: Project): Achievement | undefined {
  return [...getProjectMilestones(project)].reverse().find((achievement) => achievement.completed);
}

type SpecializedStat = { label: string; value: string; detail: string };

function getProjectSpecializedStats(project: Project): { title: string; subtitle: string; stats: SpecializedStat[] } {
  const plan = project.plan ?? defaultPlanFor(project.type);
  const snapshot = getJourneySnapshot(project);
  const parts = snapshot.parts;
  const unitParts = parts.filter((part) => part.kind === 'unit');
  const draftedUnits = unitParts.filter((part) => Boolean(plan.drafts[part.key]?.trim()));
  const allText = Object.values(plan.drafts).join('\n\n');
  const sentenceCount = countSentences(allText);
  const lineCount = allText.split(/\r?\n/).filter((line) => line.trim()).length;
  const stanzaCount = allText.split(/\n\s*\n/).filter((stanza) => stanza.trim()).length;
  const dialogueText = (allText.match(/“[^”]+”|"[^"]+"/g) ?? []).join(' ');
  const dialogueWords = countWords(dialogueText);
  const structureItems = getStructureItems(project.type, snapshot.blueprint);
  const selectedStructureItems = structureItems.filter((item) => isStructureEnabled(plan.structure, item, snapshot.blueprint));
  const plannedCount = (terms: string[]) => selectedStructureItems.filter((item) => terms.some((term) => item.label.toLowerCase().includes(term))).length;
  const draftedCount = (terms: string[]) => parts.filter((part) => terms.some((term) => part.title.toLowerCase().includes(term)) && Boolean(plan.drafts[part.key]?.trim())).length;
  const peopleCount = plan.people.split(/[,;\n]/).map((name) => name.trim()).filter(Boolean).length;
  const wordsPerUnit = draftedUnits.length ? Math.round(snapshot.wordCount / draftedUnits.length) : 0;
  const completion = snapshot.targetWords ? Math.min(100, Math.round((snapshot.wordCount / snapshot.targetWords) * 100)) : 0;
  const tracked = (label: string, value: string, detail: string): SpecializedStat => ({ label, value, detail });
  const countStat = (label: string, count: number, detail: string): SpecializedStat => tracked(label, count ? formatCount(count) : '—', detail);
  const unitProgress = (label: string) => tracked(label, `${draftedUnits.length} / ${unitParts.length}`, 'drafted / planned');

  if (project.type === 'Fiction Book') return { title: 'Fiction lens', subtitle: 'Story, scene, character, and revision signals', stats: [
    unitProgress('Chapters'), countStat('Scenes', Math.max(0, draftedUnits.reduce((total, part) => total + countParagraphs(plan.drafts[part.key] ?? ''), 0)), 'paragraphs in drafted chapters'), tracked('Words', formatCount(snapshot.wordCount), 'across this project'), tracked('Dialogue', snapshot.wordCount ? `${Math.round((dialogueWords / snapshot.wordCount) * 100)}%` : '—', 'quoted dialogue share'), countStat('Character appearances', peopleCount, 'names in your character notes'), tracked('Outline coverage', snapshot.outlineReady ? 'Ready' : 'In progress', 'based on story map notes'), tracked('Draft progress', `${completion}%`, 'of the word target'), tracked('Revision', snapshot.manuscriptComplete ? 'Complete' : 'Upcoming', 'whole-manuscript pass'),
  ] };
  if (project.type === 'Nonfiction Book') return { title: 'Nonfiction lens', subtitle: 'Argument, examples, and readability', stats: [
    unitProgress('Chapters'), countStat('Sections', plannedCount(['section', 'subsection']), 'planned structure components'), countStat('Examples', plannedCount(['example']), 'planned examples'), countStat('Case studies', plannedCount(['case study']), 'planned case studies'), countStat('Key takeaways', plannedCount(['takeaway', 'summary']), 'planned recap components'), tracked('Readability', sentenceCount ? `${(snapshot.wordCount / sentenceCount).toFixed(1)} words/sentence` : '—', 'simple draft estimate'),
  ] };
  if (project.type === 'Memoir & Biography') return { title: 'Memoir lens', subtitle: 'Memory, people, timeline, and draft signals', stats: [
    unitProgress('Chapters'), countStat('Memories captured', draftedUnits.length, 'drafted story units'), countStat('Timeline events', Object.values(plan.plotNotes).filter((note) => note.trim()).length, 'filled story-map notes'), countStat('Names to review', peopleCount, 'names in people notes'), tracked('Draft progress', `${completion}%`, 'of the word target'),
  ] };
  if (project.type === 'Children’s Book') return { title: 'Children’s book lens', subtitle: 'Page turns, spreads, words, and reading flow', stats: [
    countStat('Pages / spreads', unitParts.length, 'planned story units'), tracked('Words per spread', wordsPerUnit ? formatCount(wordsPerUnit) : '—', 'average across drafted spreads'), tracked('Reading level', 'Not tracked', 'add a reading-level note in Plan'), tracked('Text completion', `${completion}%`, 'of the word target'), tracked('Drafted spreads', `${draftedUnits.length} / ${unitParts.length}`, 'drafted / planned'),
  ] };
  if (project.type === 'Poetry Collection') return { title: 'Poetry lens', subtitle: 'Poems, lines, stanzas, sections, and layout', stats: [
    unitProgress('Poems completed'), countStat('Poems remaining', Math.max(0, unitParts.length - draftedUnits.length), 'planned poems without drafts'), countStat('Total lines', lineCount, 'non-empty draft lines'), countStat('Stanzas', stanzaCount, 'separated draft blocks'), countStat('Sections', plannedCount(['section']), 'planned sections'), tracked('Average poem length', draftedUnits.length ? `${Math.round(lineCount / draftedUnits.length)} lines` : '—', 'across drafted poems'), tracked('Layout-ready poems', unitParts.length ? `${Object.keys(plan.chapterEnds ?? {}).filter((key) => plan.chapterEnds?.[key]).length} / ${draftedUnits.length}` : '—', 'marked chapter ends / drafted poems'),
  ] };
  if (project.type === 'Journal or Diary') {
    const writingDays = Object.values(plan.activity ?? {}).filter((entry) => entry.words > 0).length;
    const weeksCovered = new Set(Object.keys(plan.activity ?? {}).map((key) => { const date = activityDate(key); const firstDay = new Date(date.getFullYear(), 0, 1); return `${date.getFullYear()}-${Math.ceil((((date.getTime() - firstDay.getTime()) / 86_400_000) + firstDay.getDay() + 1) / 7)}`; })).size;
    return { title: 'Journal lens', subtitle: 'Entries, consistency, prompts, and gaps', stats: [
      unitProgress('Entries completed'), countStat('Writing days', writingDays, 'days with words logged'), countStat('Weeks covered', weeksCovered, 'calendar weeks with activity'), countStat('Prompts completed', plan.unitIdeas.filter((idea) => idea.trim()).length, 'filled entry prompts'), tracked('Average entry length', draftedUnits.length ? `${formatCount(Math.round(snapshot.wordCount / draftedUnits.length))} words` : '—', 'across drafted entries'), countStat('Missing entries', Math.max(0, unitParts.length - draftedUnits.length), 'planned entries without drafts'), tracked('Current completion', `${completion}%`, 'of the word target'),
    ] };
  }
  if (project.type === 'Workbook') return { title: 'Workbook lens', subtitle: 'Learning units, practice, and response components', stats: [
    countStat('Modules', plannedCount(['module']), 'planned modules'), countStat('Lessons', plannedCount(['lesson']), 'planned lessons'), countStat('Exercises', plannedCount(['exercise']), 'planned exercises'), countStat('Response areas', plannedCount(['response']), 'planned response areas'), countStat('Quizzes', plannedCount(['quiz']), 'planned quizzes'), countStat('Answer keys', plannedCount(['answer key']), 'planned answer keys'), countStat('Learning objectives', plannedCount(['objective']), 'planned objectives'), tracked('Objectives completed', snapshot.outlineReady ? 'In progress' : '—', 'track completion in your notes'),
  ] };
  if (project.type === 'Guide or Manual') return { title: 'Guide lens', subtitle: 'Procedures, support, and tested clarity', stats: [
    countStat('Procedures', plannedCount(['procedure']), 'planned procedures'), countStat('Steps', plannedCount(['step', 'substep']), 'planned instruction steps'), countStat('Warnings', plannedCount(['warning', 'safety']), 'planned warnings'), countStat('Troubleshooting items', plannedCount(['troubleshooting']), 'planned support items'), tracked('Version status', 'Draft', 'update in your version notes'), tracked('Tested instructions', 'Not tracked', 'mark tested steps in your notes'), tracked('Guide completion', `${completion}%`, 'of the word target'),
  ] };
  if (project.type === 'Essay Collection') return { title: 'Essay collection lens', subtitle: 'Essays, sequence, voice, and reflection', stats: [
    unitProgress('Essays'), countStat('Sections', plannedCount(['section', 'movement', 'theme']), 'planned collection sections'), countStat('Examples', plannedCount(['example', 'case study']), 'planned examples or cases'), countStat('Reflections', plannedCount(['reflection']), 'planned reflection pieces'), countStat('Voices and subjects', peopleCount, 'people or subjects in your notes'), tracked('Average essay length', draftedUnits.length ? `${formatCount(Math.round(snapshot.wordCount / draftedUnits.length))} words` : '—', 'across drafted essays'), tracked('Collection progress', `${completion}%`, 'of the word target'), tracked('Revision', snapshot.manuscriptComplete ? 'Complete' : 'Upcoming', 'whole-collection pass'),
  ] };
  if (project.type === 'Script') return { title: 'Script lens', subtitle: 'Scenes, voices, beats, and playable movement', stats: [
    unitProgress('Scenes'), countStat('Acts / sequences', plannedCount(['act', 'sequence']), 'planned story movements'), countStat('Characters', peopleCount, 'cast and voices in your notes'), countStat('Dialogue lines', dialogueText ? dialogueText.split(/\r?\n/).filter((line) => line.trim()).length : 0, 'quoted or drafted dialogue lines'), tracked('Dialogue share', snapshot.wordCount ? `${Math.round((dialogueWords / snapshot.wordCount) * 100)}%` : '—', 'quoted dialogue share'), tracked('Draft progress', `${completion}%`, 'of the word target'), tracked('Revision', snapshot.manuscriptComplete ? 'Complete' : 'Upcoming', 'whole-script pass'),
  ] };
  if (project.type === 'Speech or Presentation') return { title: 'Speech lens', subtitle: 'Segments, ideas, examples, and delivery', stats: [
    unitProgress('Segments'), countStat('Main points', plannedCount(['point', 'idea', 'argument']), 'planned ideas or sections'), countStat('Stories / examples', plannedCount(['story', 'example']), 'planned audience anchors'), countStat('Audience interactions', plannedCount(['interaction', 'q&a', 'question']), 'planned participation moments'), tracked('Speaking time', snapshot.wordCount ? `${Math.max(1, Math.round(snapshot.wordCount / 130))} min` : '—', 'estimated at 130 words/minute'), tracked('Draft progress', `${completion}%`, 'of the word target'), tracked('Revision', snapshot.manuscriptComplete ? 'Complete' : 'Upcoming', 'delivery pass still ahead'),
  ] };
  if (project.type === 'Custom Project') return { title: 'Custom project lens', subtitle: 'Your chosen sections, pieces, and finish line', stats: [
    unitProgress('Writing units'), countStat('Sections', plannedCount(['section', 'part']), 'planned project sections'), countStat('Examples', plannedCount(['example', 'case study']), 'planned examples or cases'), countStat('Exercises / prompts', plannedCount(['exercise', 'prompt']), 'planned interactive pieces'), countStat('Reflections', plannedCount(['reflection']), 'planned reflection pieces'), tracked('Draft progress', `${completion}%`, 'of the word target'), tracked('First draft', snapshot.draftComplete ? 'Complete' : 'In progress', 'all planned parts'), tracked('Revision', snapshot.manuscriptComplete ? 'Complete' : 'Upcoming', 'whole-project pass'),
  ] };
  return { title: 'Project lens', subtitle: 'Progress signals for this writing object', stats: [unitProgress('Writing units'), tracked('Words', formatCount(snapshot.wordCount), 'across this project'), tracked('Draft progress', `${completion}%`, 'of the word target'), tracked('Outline', snapshot.outlineReady ? 'Ready' : 'In progress', 'based on planning notes'), tracked('First draft', snapshot.draftComplete ? 'Complete' : 'In progress', 'all planned parts'), tracked('Revision', snapshot.manuscriptComplete ? 'Complete' : 'Upcoming', 'whole-manuscript pass') ] };
}

function getProjectProgressStats(project: Project): SpecializedStat[] {
  const plan = project.plan ?? defaultPlanFor(project.type);
  const snapshot = getJourneySnapshot(project);
  const milestones = getJourneyMilestones(snapshot);
  const completedMilestones = milestones.filter((milestone) => milestone.status === 'complete').length;
  const wordCompletion = snapshot.targetWords ? Math.min(100, Math.round((snapshot.wordCount / snapshot.targetWords) * 100)) : 0;
  const targetPages = snapshot.targetWords ? Math.max(1, Math.round(snapshot.targetWords / 250)) : 0;
  const currentPages = Math.round(snapshot.wordCount / 250);
  const remainingWords = Math.max(0, snapshot.targetWords - snapshot.wordCount);
  const plannedFinish = plan.plannedCompletionDate ? new Date(`${plan.plannedCompletionDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Open-ended';
  return [
    { label: 'Overall completion', value: `${snapshot.progressPercent}%`, detail: 'across the full Journey' },
    { label: 'Current stage', value: snapshot.stage, detail: 'where this book is now' },
    { label: 'Stage checkpoints', value: `${completedMilestones} / ${milestones.length}`, detail: 'completed / total' },
    { label: 'Target word progress', value: `${wordCompletion}%`, detail: `${formatCount(snapshot.wordCount)} / ${formatCount(snapshot.targetWords)} words` },
    { label: 'Estimated page progress', value: `${currentPages} / ${targetPages || '—'}`, detail: 'estimated pages at 250 words' },
    { label: 'Components', value: `${snapshot.draftedParts} / ${snapshot.parts.length}`, detail: 'drafted / planned' },
    { label: 'First draft', value: snapshot.parts.length ? `${Math.round((snapshot.draftedParts / snapshot.parts.length) * 100)}%` : '—', detail: 'draft completion' },
    { label: 'Revision', value: snapshot.manuscriptComplete ? '100%' : 'Not tracked', detail: snapshot.manuscriptComplete ? 'revision path complete' : 'revision tasks are not logged yet' },
    { label: 'Remaining work', value: formatCount(remainingWords), detail: 'estimated words remaining' },
    { label: 'Estimated finish', value: snapshot.estimateLabel, detail: snapshot.estimateDetail },
    { label: 'Planned finish', value: plannedFinish, detail: plan.plannedCompletionDate ? 'your selected date' : 'no deadline selected' },
    { label: 'Schedule status', value: plan.writingFrequency ? writingScheduleStatus(plan.writingFrequency, plan.customWritingDays) : 'No schedule', detail: plan.writingPlanPaused ? 'plan paused' : 'based on your writing plan' },
  ];
}

function getProjectWritingStats(project: Project): SpecializedStat[] {
  const plan = project.plan ?? defaultPlanFor(project.type);
  const all = getStatsSnapshot(project, 'All time');
  const week = getStatsSnapshot(project, 'Week');
  const month = getStatsSnapshot(project, 'Month');
  const today = plan.activity?.[activityDateKey()] ?? emptyDailyActivity();
  const sessions = plan.writingSessionHistory ?? [];
  const totalSessionMinutes = sessions.reduce((total, session) => total + session.writingMinutes, 0);
  const averageSession = sessions.length ? Math.round(totalSessionMinutes / sessions.length) : 0;
  const wordsPerHour = all.totalMinutes ? Math.round((all.journey.wordCount / all.totalMinutes) * 60) : 0;
  return [
    { label: 'Total words', value: formatCount(all.journey.wordCount), detail: 'in this project' },
    { label: 'Words today', value: formatCount(today.words), detail: 'added today' },
    { label: 'Words this week', value: formatCount(week.totalLoggedWords), detail: 'last seven days' },
    { label: 'Words this month', value: formatCount(month.totalLoggedWords), detail: 'last thirty days' },
    { label: 'Total writing time', value: formatDuration(all.totalMinutes), detail: 'focused time logged' },
    { label: 'Time today', value: formatDuration(today.minutes), detail: 'focused time today' },
    { label: 'Time this week', value: formatDuration(week.totalMinutes), detail: 'focused time this week' },
    { label: 'Average session', value: averageSession ? formatDuration(averageSession) : '—', detail: sessions.length ? 'from completed sessions' : 'complete a focus session to track' },
    { label: 'Writing sessions', value: formatCount(sessions.length), detail: 'completed focus sessions' },
    { label: 'Writing days', value: formatCount(all.lifetimeActiveDays), detail: 'distinct days with words' },
    { label: 'Words per hour', value: wordsPerHour ? formatCount(wordsPerHour) : '—', detail: 'average focused pace' },
    { label: 'Current streak', value: all.currentStreak ? `${all.currentStreak} days` : '—', detail: `${all.longestStreak} day longest streak` },
  ];
}

function AchievementList({ achievements }: { achievements: Achievement[] }) {
  return <View style={s.achievementList}>{achievements.map((achievement) => <View key={achievement.id} style={[s.achievementRow, !achievement.completed && s.achievementRowLocked]}><View style={[s.achievementIcon, achievement.completed && s.achievementIconEarned]}><Text style={[s.achievementIconText, !achievement.completed && s.achievementIconTextLocked]}>{achievement.icon}</Text></View><View style={s.achievementCopy}><Text style={[s.achievementTitle, !achievement.completed && s.achievementTitleLocked]}>{achievement.title}</Text><Text style={s.achievementDetail}>{achievement.detail}</Text></View><Text style={[s.achievementState, achievement.completed ? s.achievementStateEarned : s.achievementStateLocked]}>{achievement.completed ? '✓' : '○'}</Text></View>)}</View>;
}

type CitationFields = { author: string; title: string; year: string; container: string; volume: string; issue: string; pages: string; url: string };

const emptyCitationFields: CitationFields = { author: '', title: '', year: '', container: '', volume: '', issue: '', pages: '', url: '' };
const citationSourceLabels: Record<CitationSourceType, string> = { book: 'Book', article: 'Article', website: 'Website' };

const citationPart = (value: string) => value.trim().replace(/[.。]+$/, '');
const citationYear = (value: string) => value.trim() || 'n.d.';

function formatCitation(fields: CitationFields, style: CitationStyle, sourceType: CitationSourceType) {
  const author = citationPart(fields.author) || 'Author';
  const title = citationPart(fields.title) || 'Untitled source';
  const year = citationYear(fields.year);
  const container = citationPart(fields.container);
  const volume = citationPart(fields.volume);
  const issue = citationPart(fields.issue);
  const pages = citationPart(fields.pages);
  const url = fields.url.trim();
  if (style === 'APA') {
    if (sourceType === 'book') return `${author}. (${year}). ${title}.${container ? ` ${container}.` : ''}${url ? ` ${url}` : ''}`;
    if (sourceType === 'article') return `${author}. (${year}). ${title}.${container ? ` ${container}` : ''}${volume ? `, ${volume}` : ''}${issue ? `(${issue})` : ''}${pages ? `, ${pages}` : ''}.${url ? ` ${url}` : ''}`;
    return `${author}. (${year}). ${title}.${container ? ` ${container}.` : ''}${url ? ` ${url}` : ''}`;
  }
  if (style === 'MLA') {
    if (sourceType === 'book') return `${author}. ${title}.${container ? ` ${container},` : ''} ${year}.${url ? ` ${url}.` : ''}`;
    if (sourceType === 'article') return `${author}. “${title}.”${container ? ` ${container},` : ''}${volume ? ` vol. ${volume},` : ''}${issue ? ` no. ${issue},` : ''} ${year}${pages ? `, pp. ${pages}` : ''}.${url ? ` ${url}.` : ''}`;
    return `${author}. “${title}.”${container ? ` ${container},` : ''} ${year}.${url ? ` ${url}.` : ''}`;
  }
  if (sourceType === 'book') return `${author}. ${title}.${container ? ` ${container},` : ''} ${year}.${url ? ` ${url}.` : ''}`;
  if (sourceType === 'article') return `${author}. “${title}.”${container ? ` ${container}` : ''}${volume ? ` ${volume}` : ''}${issue ? `, no. ${issue}` : ''} (${year})${pages ? `: ${pages}` : ''}.${url ? ` ${url}.` : ''}`;
  return `${author}. “${title}.”${container ? ` ${container}.` : ''} ${year}.${url ? ` ${url}.` : ''}`;
}

function CitationGenerator({ project, onUpdateProject }: { project: Project; onUpdateProject: (title: string, changes: Partial<Project>) => void }) {
  const plan = project.plan ?? defaultPlanFor(project.type);
  const [style, setStyle] = useState<CitationStyle>(plan.referenceStyle ?? 'APA');
  const [sourceType, setSourceType] = useState<CitationSourceType>('book');
  const [fields, setFields] = useState<CitationFields>(emptyCitationFields);
  const [generated, setGenerated] = useState('');
  const [added, setAdded] = useState(false);
  const references = plan.referenceEntries ?? [];
  const updateField = (key: keyof CitationFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const generate = () => {
    if (!fields.title.trim()) {
      Alert.alert('Add a source title', 'Give Bookez the title so it can create a citation.');
      return;
    }
    setGenerated(formatCitation(fields, style, sourceType));
    setAdded(false);
  };
  const addToReferences = () => {
    if (!generated) return;
    const referencesKey = getStructureItems(project.type, planBlueprints[project.type] ?? planBlueprints['Custom Project']).find((item) => item.key === 'references');
    const nextStructure = referencesKey ? { ...plan.structure, [referencesKey.key ?? 'references']: true } : plan.structure;
    const nextEntry: ReferenceEntry = { id: `reference-${Date.now()}`, citation: generated, style, sourceType, createdAt: Date.now() };
    const referenceDraftKey = referencesKey ? `structure:${referencesKey.key ?? 'references'}` : '';
    const nextDrafts = referenceDraftKey ? { ...plan.drafts, [referenceDraftKey]: [plan.drafts[referenceDraftKey]?.trim(), generated].filter(Boolean).join('\n\n') } : plan.drafts;
    const studio = getBookStudioState(project);
    onUpdateProject(project.title, { plan: { ...plan, structure: nextStructure, drafts: nextDrafts, referenceStyle: style, referenceEntries: [...references, nextEntry] }, studio: { ...studio, backMatterIncluded: { ...studio.backMatterIncluded, references: true } } });
    setAdded(true);
  };
  return <View style={s.citationGeneratorCard}><View style={s.citationHeader}><View style={s.citationIcon}><Text style={s.citationIconText}>↗</Text></View><View style={s.citationHeaderCopy}><Text style={s.citationEyebrow}>REFERENCE TOOL</Text><Text style={s.citationTitle}>Citation generator</Text><Text style={s.citationHint}>Build a clean starting citation, then review it against your source.</Text></View></View><Text style={s.citationProjectLabel}>ADDING TO · {project.title.toUpperCase()}</Text><Text style={s.citationFieldLabel}>STYLE</Text><View style={s.citationChoiceRow}>{(['APA', 'MLA', 'Chicago'] as CitationStyle[]).map((item) => <Pressable key={item} onPress={() => { setStyle(item); setGenerated(''); setAdded(false); }} style={[s.citationChoice, style === item && s.citationChoiceActive]}><Text style={[s.citationChoiceText, style === item && s.citationChoiceTextActive]}>{item}</Text></Pressable>)}</View><Text style={s.citationFieldLabel}>SOURCE TYPE</Text><View style={s.citationChoiceRow}>{(['book', 'article', 'website'] as CitationSourceType[]).map((item) => <Pressable key={item} onPress={() => { setSourceType(item); setGenerated(''); setAdded(false); }} style={[s.citationChoice, sourceType === item && s.citationChoiceActive]}><Text style={[s.citationChoiceText, sourceType === item && s.citationChoiceTextActive]}>{citationSourceLabels[item]}</Text></Pressable>)}</View><View style={s.citationFieldGrid}><TextInput value={fields.author} onChangeText={(value) => updateField('author', value)} placeholder="Author or organization" placeholderTextColor="#B2B3C0" style={s.citationInput} accessibilityLabel="Citation author" /><TextInput value={fields.title} onChangeText={(value) => updateField('title', value)} placeholder="Title *" placeholderTextColor="#B2B3C0" style={s.citationInput} accessibilityLabel="Citation title" /><TextInput value={fields.year} onChangeText={(value) => updateField('year', value)} placeholder="Year" placeholderTextColor="#B2B3C0" keyboardType="number-pad" style={s.citationInputHalf} accessibilityLabel="Citation year" /><TextInput value={fields.container} onChangeText={(value) => updateField('container', value)} placeholder={sourceType === 'book' ? 'Publisher' : sourceType === 'article' ? 'Journal' : 'Site name'} placeholderTextColor="#B2B3C0" style={s.citationInputHalf} accessibilityLabel="Publisher, journal, or site" /><TextInput value={fields.volume} onChangeText={(value) => updateField('volume', value)} placeholder="Volume" placeholderTextColor="#B2B3C0" style={s.citationInputHalf} accessibilityLabel="Citation volume" /><TextInput value={fields.issue} onChangeText={(value) => updateField('issue', value)} placeholder="Issue" placeholderTextColor="#B2B3C0" style={s.citationInputHalf} accessibilityLabel="Citation issue" /><TextInput value={fields.pages} onChangeText={(value) => updateField('pages', value)} placeholder="Pages" placeholderTextColor="#B2B3C0" style={s.citationInputHalf} accessibilityLabel="Citation pages" /><TextInput value={fields.url} onChangeText={(value) => updateField('url', value)} placeholder="URL (optional)" placeholderTextColor="#B2B3C0" autoCapitalize="none" style={s.citationInput} accessibilityLabel="Citation URL" /></View><Text style={s.citationExample}>Example fields: “Octavia Butler” · “Parable of the Sower” · “1993” · “Seven Stories Press”</Text><Pressable onPress={generate} style={s.citationGenerateButton}><Text style={s.citationGenerateText}>Generate citation</Text><Text style={s.citationGenerateArrow}>→</Text></Pressable>{generated && <View style={s.citationResult}><Text style={s.citationResultLabel}>{style.toUpperCase()} · REVIEW BEFORE USING</Text><Text style={s.citationResultText}>{generated}</Text><Pressable onPress={addToReferences} style={[s.citationAddButton, added && s.citationAddButtonAdded]}><Text style={s.citationAddText}>{added ? 'Added to References ✓' : 'Add to References page'}</Text></Pressable></View>}{references.length > 0 && <Text style={s.citationExisting}>{references.length} citation{references.length === 1 ? '' : 's'} already saved to this book.</Text>}</View>;
}

function getMediaStats(projects: Project[]) {
  const images = projects.flatMap((project) => project.images ?? []);
  if (!images.length) return null;
  const publication = images.filter((image) => image.includeInExport && !image.referenceOnly);
  const completed = images.filter((image) => image.status === 'final');
  const captionRequested = images.filter((image) => image.captionRequested || Boolean(image.caption?.trim()));
  const captionsCompleted = captionRequested.filter((image) => Boolean(image.caption?.trim())).length;
  const creditsCompleted = publication.filter((image) => Boolean(image.credit?.trim())).length;
  const permissionReviewed = publication.filter((image) => image.permissionStatus !== 'unknown').length;
  const placed = images.filter((image) => Boolean(image.connectedPartKey)).length;
  const draftImages = images.filter((image) => ['idea', 'briefReady', 'sketch', 'revision'].includes(image.status)).length;
  const referenceOnly = images.filter((image) => image.referenceOnly).length;
  return { planned: images.length, placed, publication: publication.length, completed: completed.length, remaining: Math.max(0, images.length - completed.length), visualCompletion: Math.round((completed.length / images.length) * 100), draftImages, finalImages: completed.length, captionRequested: captionRequested.length, captionsCompleted, missingCaptions: Math.max(0, captionRequested.length - captionsCompleted), creditsCompleted, missingCredits: Math.max(0, publication.length - creditsCompleted), permissionReviewed, unknownPermissions: Math.max(0, publication.length - permissionReviewed), referenceOnly };
}

function projectUsesReferences(project: Project) {
  const plan = project.plan ?? defaultPlanFor(project.type);
  const entries = plan.referenceEntries ?? [];
  const referencesItem = getStructureItems(project.type, planBlueprints[project.type] ?? planBlueprints['Custom Project']).find((item) => item.key === 'references');
  return Boolean(entries.length || plan.drafts['structure:references']?.trim() || (referencesItem && isStructureEnabled(plan.structure, referencesItem, planBlueprints[project.type] ?? planBlueprints['Custom Project'])));
}

function getCitationStats(projects: Project[]) {
  const usedProjects = projects.filter(projectUsesReferences);
  if (!usedProjects.length) return null;
  const entries = usedProjects.flatMap((project) => (project.plan?.referenceEntries ?? []).map((entry) => ({ ...entry, project: project.title })));
  const styles = Array.from(new Set(entries.map((entry) => entry.style)));
  const sourceTypes = Array.from(new Set(entries.map((entry) => entry.sourceType)));
  return { projectCount: usedProjects.length, citationCount: entries.length, styles, sourceTypes, lastCitation: entries[entries.length - 1]?.citation ?? '' };
}

function ConditionalMediaStats({ projects, overall }: { projects: Project[]; overall: boolean }) {
  const stats = getMediaStats(projects);
  if (!stats) return null;
  return <View style={s.conditionalStatsCard}><View style={s.conditionalStatsHeader}><View><Text style={s.conditionalStatsEyebrow}>MEDIA PROGRESS</Text><Text style={s.conditionalStatsTitle}>{overall ? 'Visuals across your projects' : 'Visual progress'}</Text><Text style={s.conditionalStatsHint}>{overall ? 'Only projects with added images are included.' : 'Tracked from images added to this project.'}</Text></View><Text style={s.conditionalStatsIcon}>▧</Text></View><View style={s.conditionalStatsGrid}><View style={s.conditionalStat}><Text style={s.conditionalStatValue}>{formatCount(stats.placed)}</Text><Text style={s.conditionalStatLabel}>IMAGES PLACED</Text><Text style={s.conditionalStatDetail}>{stats.planned} planned</Text></View><View style={s.conditionalStat}><Text style={s.conditionalStatValue}>{stats.visualCompletion}%</Text><Text style={s.conditionalStatLabel}>VISUAL COMPLETION</Text><Text style={s.conditionalStatDetail}>{stats.remaining} remaining</Text></View><View style={s.conditionalStat}><Text style={s.conditionalStatValue}>{formatCount(stats.publication)}</Text><Text style={s.conditionalStatLabel}>IN BOOK STUDIO</Text><Text style={s.conditionalStatDetail}>{stats.referenceOnly} reference-only</Text></View><View style={s.conditionalStat}><Text style={s.conditionalStatValue}>{formatCount(stats.finalImages)}</Text><Text style={s.conditionalStatLabel}>FINAL IMAGES</Text><Text style={s.conditionalStatDetail}>{stats.draftImages} in progress</Text></View></View>{stats.captionRequested > 0 && <View style={s.conditionalStatsNote}><Text style={s.conditionalStatsNoteIcon}>＋</Text><Text style={s.conditionalStatsNoteText}>{stats.captionsCompleted} of {stats.captionRequested} requested captions completed · {stats.missingCaptions} still to write.</Text></View>}{(stats.missingCredits > 0 || stats.unknownPermissions > 0) && <Text style={s.conditionalStatsFootnote}>{stats.missingCredits ? `${stats.missingCredits} publication image${stats.missingCredits === 1 ? '' : 's'} need credit` : ''}{stats.missingCredits && stats.unknownPermissions ? ' · ' : ''}{stats.unknownPermissions ? `${stats.unknownPermissions} need permission review` : ''}</Text>}</View>;
}

function ConditionalCitationStats({ projects, overall }: { projects: Project[]; overall: boolean }) {
  const stats = getCitationStats(projects);
  if (!stats) return null;
  return <View style={s.conditionalStatsCardCitation}><View style={s.conditionalStatsHeader}><View><Text style={s.conditionalStatsEyebrowCitation}>REFERENCE PROGRESS</Text><Text style={s.conditionalStatsTitle}>Citations in use</Text><Text style={s.conditionalStatsHint}>{overall ? 'Across projects with References enabled.' : 'Tracked from this project’s References page.'}</Text></View><Text style={s.conditionalStatsIconCitation}>↗</Text></View><View style={s.conditionalStatsGrid}><View style={s.conditionalStat}><Text style={s.conditionalStatValue}>{formatCount(stats.citationCount)}</Text><Text style={s.conditionalStatLabel}>CITATIONS SAVED</Text><Text style={s.conditionalStatDetail}>{stats.projectCount} project{stats.projectCount === 1 ? '' : 's'}</Text></View><View style={s.conditionalStat}><Text style={s.conditionalStatValue}>{stats.styles.length || '—'}</Text><Text style={s.conditionalStatLabel}>STYLES USED</Text><Text style={s.conditionalStatDetail}>{stats.styles.join(' · ') || 'Not generated yet'}</Text></View><View style={s.conditionalStat}><Text style={s.conditionalStatValue}>{stats.sourceTypes.length || '—'}</Text><Text style={s.conditionalStatLabel}>SOURCE TYPES</Text><Text style={s.conditionalStatDetail}>{stats.sourceTypes.map((type) => citationSourceLabels[type]).join(' · ') || 'Not added yet'}</Text></View></View>{stats.lastCitation && <View style={s.conditionalStatsCitation}><Text style={s.conditionalStatsCitationLabel}>MOST RECENT</Text><Text numberOfLines={3} style={s.conditionalStatsCitationText}>{stats.lastCitation}</Text></View>}</View>;
}

function getWriteContext(part: WritePart, plan: ProjectPlan, blueprint: PlanBlueprint): { label: string; value: string }[] {
  const notes: { label: string; value: string }[] = [];
  if (plan.idea.trim()) notes.push({ label: 'Big idea', value: plan.idea });
  if (part.kind === 'unit' && part.unitIndex !== undefined && plan.unitIdeas[part.unitIndex]?.trim()) notes.push({ label: `${blueprint.unitLabel[0].toUpperCase() + blueprint.unitLabel.slice(1)} note`, value: plan.unitIdeas[part.unitIndex] });
  if (plan.plotThread.trim()) notes.push({ label: 'Throughline', value: plan.plotThread });
  const lowerTitle = part.title.toLowerCase();
  const relevantPrompts = blueprint.plotPrompts.filter((prompt) => {
    const promptText = `${prompt.label} ${prompt.helper}`.toLowerCase();
    return lowerTitle.split(/\W+/).some((word) => word.length > 3 && promptText.includes(word));
  });
  relevantPrompts.forEach((prompt) => {
    if (plan.plotNotes[prompt.label]?.trim()) notes.push({ label: prompt.label, value: plan.plotNotes[prompt.label] });
  });
  if (plan.people.trim()) notes.push({ label: blueprint.peopleLabel, value: plan.people });
  if (part.title.toLowerCase().includes('reference') && plan.referenceEntries?.length) notes.push({ label: 'Generated citations', value: plan.referenceEntries.map((entry) => entry.citation).join('\n\n') });
  return notes.slice(0, 4).map((note) => ({ ...note, value: compactNote(note.value) }));
}

function getWritingHelpPrompts(part: WritePart, blueprint: PlanBlueprint): string[] {
  const title = part.title.toLowerCase();
  if (title.includes('title page') || title.includes('dedication')) return ['Who inspired this book?', 'Should this feel heartfelt, humorous, or formal?', 'Would a subtitle help the promise feel clearer?', 'Show me three ways to begin without writing it for me'];
  if (part.kind === 'unit') return ['What must happen in this part?', 'Who is present, and what does each person want?', 'What changes by the end?', 'What tension or question carries the reader forward?'];
  return [`What does this ${blueprint.unitLabel} need to make clear?`, 'Which idea, image, or question deserves more room?', 'What would make this section feel finished?', 'Help me find a small next step without writing it for me'];
}

function getWritingCompass(project: Project, part: WritePart, plan: ProjectPlan, blueprint: PlanBlueprint) {
  const draft = plan.drafts[part.key]?.trim() ?? '';
  const words = countWords(draft);
  const context = getWriteContext(part, plan, blueprint);
  const partNote = plan.partNotes[part.key]?.trim();
  const idea = plan.idea.trim();
  const throughline = plan.plotThread.trim();
  return {
    doing: draft ? `You are shaping ${part.title} with ${formatCount(words)} words in place.` : `You are opening ${part.title} and finding its first clear movement.`,
    next: part.kind === 'unit' ? (throughline ? `Let the next beat move toward ${compactNote(throughline)}.` : `Give this ${blueprint.unitLabel} one concrete turn, choice, or discovery.`) : `Make the purpose of “${part.title}” visible in its first few lines.`,
    keep: partNote ? compactNote(partNote) : context[0]?.value ?? (idea ? `Keep the book’s promise close: ${compactNote(idea)}` : activeCompassFallback(project, part)),
  };
}

function activeCompassFallback(project: Project, part: WritePart) {
  return `${project.type} works best when this part keeps one clear promise in view: ${part.helper}`;
}

const cleanDictationText = (value: string) => value
  .replace(/\b(new line|newline)\b/gi, '\n')
  .replace(/\b(question mark)\b/gi, '?')
  .replace(/\b(exclamation point|exclamation mark)\b/gi, '!')
  .replace(/\b(full stop|period)\b/gi, '.')
  .replace(/\b(comma)\b/gi, ',')
  .replace(/\b(colon)\b/gi, ':')
  .replace(/\b(semicolon)\b/gi, ';')
  .replace(/[ \t]+/g, ' ')
  .replace(/[ \t]*\n[ \t]*/g, '\n')
  .replace(/\s+([,.;!?])/g, '$1')
  .replace(/([,.;!?])(?=\S)/g, '$1 ')
  .trim();

const polishWriting = (value: string) => cleanDictationText(value)
  .replace(/\b(\w+)(\s+\1\b)+/gi, '$1')
  .replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);

const grammarWriting = (value: string) => polishWriting(value)
  .replace(/\bi\b/g, 'I')
  .replace(/\b(im|i'm)\b/gi, "I'm")
  .replace(/\b(dont|don't)\b/gi, "don't")
  .replace(/\b(cant|can't)\b/gi, "can't")
  .replace(/\b(wont|won't)\b/gi, "won't")
  .replace(/\b(doesnt|doesn't)\b/gi, "doesn't")
  .replace(/\b(isnt|isn't)\b/gi, "isn't")
  .replace(/\b(shouldnt|shouldn't)\b/gi, "shouldn't")
  .replace(/\s{2,}/g, ' ')
  .replace(/([^.!?\n])$/gm, '$1.');

const writingFrequencyLabel = (frequency?: WritingFrequency, customDays?: number[]) => {
  if (frequency === 'weekdays') return 'Weekdays';
  if (frequency === 'weekends') return 'Weekends';
  if (frequency === 'custom') return customDays?.length ? `${customDays.length} custom days` : 'Custom days';
  return 'Every day';
};

const writingScheduleStatus = (frequency: WritingFrequency, customDays?: number[]) => {
  const today = new Date().getDay();
  const scheduledToday = frequency === 'everyday' || (frequency === 'weekdays' && today >= 1 && today <= 5) || (frequency === 'weekends' && (today === 0 || today === 6)) || (frequency === 'custom' && Boolean(customDays?.includes(today)));
  if (frequency === 'custom' && !customDays?.length) return 'Choose your writing days in Plan';
  return scheduledToday ? 'Scheduled writing day' : 'Optional writing day';
};

const isScheduledWritingDay = (frequency?: WritingFrequency, customDays?: number[], date = new Date()) => {
  if (!frequency) return false;
  const day = date.getDay();
  return frequency === 'everyday' || (frequency === 'weekdays' && day >= 1 && day <= 5) || (frequency === 'weekends' && (day === 0 || day === 6)) || (frequency === 'custom' && Boolean(customDays?.includes(day)));
};

const hasWritingPlan = (project: Project, plan: ProjectPlan) => Boolean(
  plan.writingPlanCreated || plan.plannedCompletionDate || plan.writingFrequency || plan.customWritingDays?.length || plan.reminderEnabled || plan.writingReminderTimes?.length || plan.paceFlexibility || plan.customPaceWords || plan.writingSessionMode || plan.writingSessionHistory?.length || plan.idea.trim() || plan.plotThread.trim() || plan.people.trim() || plan.conclusion?.trim() || Object.values(plan.plotNotes).some((note) => note.trim()) || plan.unitIdeas.some((idea) => idea.trim()) || project.pageGoal !== (planBlueprints[project.type] ?? planBlueprints['Custom Project']).defaultPages || project.unitGoal !== (planBlueprints[project.type] ?? planBlueprints['Custom Project']).defaultUnits,
);

const paceFlexibilityLabel = (pace?: PaceFlexibility) => pace === 'gentle' ? 'Gentle' : pace === 'ambitious' ? 'Ambitious' : pace === 'custom' ? 'Custom' : 'Steady';

// These are modest starting suggestions, not productivity rules. Writing-habit
// research generally supports repeatable sessions, while the right duration
// still depends on the writer and the kind of work.
const suggestedSessionMinutes = (frequency?: WritingFrequency, pace?: PaceFlexibility) => {
  const paceMinutes = pace === 'gentle' ? 15 : pace === 'ambitious' ? 45 : pace === 'custom' ? 30 : 25;
  if (frequency === 'weekends') return Math.max(paceMinutes, 45);
  if (frequency === 'weekdays') return Math.max(paceMinutes, 20);
  return paceMinutes;
};

const writingSessionOptions: { mode: WritingSessionMode; label: string; helper: string; writingMinutes: number; breakMinutes: number; recommended?: boolean; countsUp?: boolean }[] = [
  { mode: 'quick', label: 'Quick Start', helper: 'Write for 10 minutes.', writingMinutes: 10, breakMinutes: 0 },
  { mode: 'gentle', label: 'Gentle Focus', helper: 'Write for at least 20 minutes, then decide whether to continue.', writingMinutes: 20, breakMinutes: 0, recommended: true },
  { mode: 'pomodoro', label: 'Pomodoro', helper: '25 minutes writing, 5 minutes resting.', writingMinutes: 25, breakMinutes: 5 },
  { mode: 'deep', label: 'Deep Focus', helper: '45 minutes writing, 10 minutes resting.', writingMinutes: 45, breakMinutes: 10 },
  { mode: 'flow', label: 'Flow Session', helper: 'The timer counts upward; stop or rest naturally.', writingMinutes: 0, breakMinutes: 0, countsUp: true },
  { mode: 'custom', label: 'Custom', helper: 'Choose your writing and break durations.', writingMinutes: 20, breakMinutes: 5 },
];

const getWritingSessionConfig = (mode: WritingSessionMode, customWritingMinutes = '20', customBreakMinutes = '5') => {
  const option = writingSessionOptions.find((item) => item.mode === mode) ?? writingSessionOptions[1];
  if (mode !== 'custom') return option;
  return { ...option, writingMinutes: Math.max(1, Number.parseInt(customWritingMinutes, 10) || 20), breakMinutes: Math.max(0, Number.parseInt(customBreakMinutes, 10) || 5) };
};

const formatFocusTimer = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

const getWritingStrategy = (frequency: WritingFrequency, pace: PaceFlexibility, customWords?: string, sessionMinutes = 25, customDays?: number[]) => {
  const schedule = `${writingScheduleStatus(frequency, customDays)} · ${writingFrequencyLabel(frequency, customDays)}`;
  if (pace === 'gentle') return {
    title: 'Minimum viable session',
    body: `${schedule} · show up for ${sessionMinutes} minutes, then stop without guilt if that is all you have.`,
    steps: 'Draft forward · Skip editing · Leave one next-line cue',
  };
  if (pace === 'ambitious') return {
    title: 'Stretch block',
    body: `${schedule} · aim for ${sessionMinutes} focused minutes, with a short break if your attention drops.`,
    steps: 'Set one scene goal · Draft first · Take a real break afterward',
  };
  if (pace === 'custom') return {
    title: 'Self-chosen target',
    body: `${schedule} · use your ${customWords || 'custom'}-word daily target as the finish line, not a test of quality.`,
    steps: 'Choose one small outcome · Write before revising · Adjust next session from your real pace',
  };
  return {
    title: 'Timed focus block',
    body: `${schedule} · work in a repeatable ${sessionMinutes}-minute block, then step away for a few minutes.`,
    steps: 'Pick one outcome · Draft without polishing · Note where to resume',
  };
};

function Write({ projects, activeProject, onSelectProject, onUpdateProject, onPage }: { projects: Project[]; activeProject: string; onSelectProject: (title: string) => void; onUpdateProject: (title: string, changes: Partial<Project>) => void; onPage: (page: Page) => void }) {
  const currentProject = projects.find((project) => project.title === activeProject) ?? projects[0];
  const blueprint = planBlueprints[currentProject.type] ?? planBlueprints['Custom Project'];
  const plan = currentProject.plan ?? defaultPlanFor(currentProject.type);
  const parts = getWriteParts(currentProject, blueprint);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  const [selectedHelpPrompt, setSelectedHelpPrompt] = useState('');
  const [sessionNow, setSessionNow] = useState(Date.now());
  const [focusTimerSeconds, setFocusTimerSeconds] = useState(0);
  const [focusTimerRunning, setFocusTimerRunning] = useState(false);
  const [focusTimerPhase, setFocusTimerPhase] = useState<SessionPhase>('writing');
  const lastRhythmTapAt = useRef(0);
  const [sessionPromptOpen, setSessionPromptOpen] = useState(false);
  const [sessionFeeling, setSessionFeeling] = useState('');
  const [sessionCompleted, setSessionCompleted] = useState('');
  const [sessionNext, setSessionNext] = useState('');
  const [customWritingMinutes, setCustomWritingMinutes] = useState(plan.customWritingMinutes ?? '20');
  const [customBreakMinutes, setCustomBreakMinutes] = useState(plan.customBreakMinutes ?? '5');
  const activeIndex = parts.length ? Math.min(plan.writeIndex, parts.length - 1) : 0;
  const activePart = parts[activeIndex];
  const activeArea = activePart?.kind === 'unit' ? { label: blueprint.unitLabel.toUpperCase(), color: C.coral } : activePart?.category === 'front' ? { label: 'FRONT MATTER', color: '#4B7B9D' } : activePart?.category === 'back' ? { label: 'BACK MATTER', color: C.sage } : { label: 'BODY AREA', color: C.periwinkle };
  const unitCount = Math.max(Number.parseInt(currentProject.unitGoal, 10) || 0, 0);
  const activeProgressLabel = activePart?.kind === 'unit' ? `${blueprint.unitLabel.toUpperCase()} ${(activePart.unitIndex ?? 0) + 1} OF ${unitCount || '—'}` : `${activeArea.label} · ${activeIndex + 1} OF ${parts.length}`;
  const chapterEndMarked = Boolean(activePart && plan.chapterEnds?.[activePart.key]);
  const completed = parts.length > 0 && plan.writeIndex >= parts.length;
  const completedPartCount = parts.filter((part) => plan.drafts[part.key]?.trim()).length;
  const completionPercent = parts.length ? Math.round((completedPartCount / parts.length) * 100) : 0;
  const contextNotes = activePart ? getWriteContext(activePart, plan, blueprint) : [];
  const sessionStartedAt = useRef(Date.now());
  const compassWordCount = useRef(activePart ? countWords(plan.drafts[activePart.key] || '') : 0);
  const [compass, setCompass] = useState(() => activePart ? getWritingCompass(currentProject, activePart, plan, blueprint) : { doing: 'Your next writing moment will appear here.', next: 'Choose a part to begin.', keep: 'Your plan will stay close.' });
  const sessionMinutes = Math.max(0, Math.round((sessionNow - sessionStartedAt.current) / 60_000));
  const writingFrequency = plan.writingFrequency ?? 'everyday';
  const paceFlexibility = plan.paceFlexibility ?? 'steady';
  const writingSessionMode = plan.writingSessionMode ?? 'gentle';
  const sessionConfig = getWritingSessionConfig(writingSessionMode, customWritingMinutes, customBreakMinutes);
  const focusTargetMinutes = sessionConfig.writingMinutes;
  const focusTimerLimitSeconds = (focusTimerPhase === 'rest' ? sessionConfig.breakMinutes : sessionConfig.writingMinutes) * 60;
  const focusTimerProgress = sessionConfig.countsUp || !focusTimerLimitSeconds ? 0 : Math.min(1, focusTimerSeconds / focusTimerLimitSeconds);
  const writingStrategy = getWritingStrategy(writingFrequency, paceFlexibility, plan.customPaceWords, focusTargetMinutes, plan.customWritingDays);
  const sessionHistory = plan.writingSessionHistory ?? [];
  const recentSessionDurations = sessionHistory.filter((session) => session.writingMinutes > 0).slice(-5).map((session) => session.writingMinutes);
  const sessionRecommendation = recentSessionDurations.length >= 3 ? { minimum: Math.min(...recentSessionDurations), maximum: Math.max(...recentSessionDurations), suggested: Math.max(10, Math.round((recentSessionDurations.reduce((total, minutes) => total + minutes, 0) / recentSessionDurations.length) / 5) * 5) } : null;
  const draftText = activePart ? plan.drafts[activePart.key] || '' : '';
  const pageStats = { words: countWords(draftText), letters: countLetters(draftText), sentences: countSentences(draftText), paragraphs: countParagraphs(draftText) };
  const helpPrompts = activePart ? getWritingHelpPrompts(activePart, blueprint) : [];
  const contextItems = activePart ? [
    { label: 'Chapter plan', value: activePart.helper },
    { label: blueprint.peopleLabel, value: plan.people.trim() || 'No people or characters added yet.' },
    { label: 'Locations & timeline', value: 'No location or timeline notes added yet.' },
    { label: 'Earlier notes', value: contextNotes.length ? contextNotes.map((note) => `${note.label}: ${note.value}`).join('\n') : 'No earlier notes are attached to this part.' },
    { label: 'Preceding section', value: activeIndex > 0 && plan.drafts[parts[activeIndex - 1].key]?.trim() ? compactNote(plan.drafts[parts[activeIndex - 1].key]) : 'No preceding section summary yet.' },
  ] : [];
  const pageReferenceItems = activePart ? [
    { label: 'Purpose', value: activePart.helper },
    { label: 'Next step', value: compass.next },
    ...(activePart.title.toLowerCase().includes('reference') && plan.referenceEntries?.length ? [{ label: 'Saved citations', value: plan.referenceEntries.map((entry) => entry.citation).join('\n\n') }] : []),
    ...(plan.partNotes[activePart.key]?.trim() ? [{ label: 'Your note', value: compactNote(plan.partNotes[activePart.key]) }] : contextNotes.slice(0, 1)),
  ] : [];
  const projectImages = currentProject.images ?? [];
  const updateImage = (id: string, changes: Partial<BookezImage>) => onUpdateProject(activeProject, { images: projectImages.map((image) => image.id === id ? { ...image, ...changes, updatedAt: Date.now() } : image) });
  const addImage = () => { if (!activePart) return; requestImage(currentProject, (asset) => { const image = makeBookezImage(currentProject, asset, activePart.key); onUpdateProject(activeProject, { imageEnabled: true, images: [...projectImages, image] }); }); };
  const replaceImage = (image: BookezImage) => requestImage(currentProject, (asset) => { onUpdateProject(activeProject, { images: projectImages.map((current) => current.id === image.id ? { ...current, uri: asset.uri, fileName: asset.fileName ?? current.fileName, mimeType: asset.mimeType ?? current.mimeType, width: asset.width, height: asset.height, fileSize: asset.fileSize ?? current.fileSize, updatedAt: Date.now() } : current) }); });
  const removeImage = (id: string) => onUpdateProject(activeProject, { images: projectImages.filter((image) => image.id !== id) });
  const enableImages = () => onUpdateProject(activeProject, { imageEnabled: true });
  const lastActivityAt = useRef(Date.now());
  const pendingWritingUses = useRef(0);
  const latestPlans = useRef<Record<string, ProjectPlan>>({});
  projects.forEach((project) => { latestPlans.current[project.title] = project.plan ?? defaultPlanFor(project.type); });

  useEffect(() => {
    const timer = setInterval(() => setSessionNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!focusTimerRunning) return;
    const timer = setInterval(() => setFocusTimerSeconds((seconds) => seconds + 1), 1_000);
    return () => clearInterval(timer);
  }, [focusTimerRunning]);
  useEffect(() => {
    if (!focusTimerRunning || sessionConfig.countsUp || !focusTimerLimitSeconds || focusTimerSeconds < focusTimerLimitSeconds) return;
    setFocusTimerRunning(false);
    setSessionPromptOpen(true);
  }, [focusTimerRunning, focusTimerSeconds, focusTimerLimitSeconds, sessionConfig.countsUp]);
  useEffect(() => {
    if (!activePart) return;
    sessionStartedAt.current = Date.now();
    compassWordCount.current = countWords(plan.drafts[activePart.key] || '');
    setCompass(getWritingCompass(currentProject, activePart, plan, blueprint));
    setSelectedHelpPrompt('');
    setHelpOpen(false);
    setContextOpen(false);
    setReferenceOpen(false);
    setSessionDetailsOpen(false);
    setCompassOpen(false);
    setRhythmOpen(false);
    setFocusTimerSeconds(0);
    setFocusTimerRunning(false);
    setFocusTimerPhase('writing');
    setSessionPromptOpen(false);
    setSessionFeeling('');
    setSessionCompleted('');
    setSessionNext('');
    setCustomWritingMinutes(plan.customWritingMinutes ?? '20');
    setCustomBreakMinutes(plan.customBreakMinutes ?? '5');
  }, [activeProject, activePart?.key]);

  useEffect(() => {
    const sessionProject = activeProject;
    const sessionStartedAt = Date.now();
    return () => {
      const minutes = Math.min(60, Math.max(0, (Date.now() - sessionStartedAt) / 60_000));
      if (minutes < 0.1) return;
      const currentPlan = latestPlans.current[sessionProject] ?? defaultPlanFor('Custom Project');
      onUpdateProject(sessionProject, { plan: { ...currentPlan, activity: addActivity(currentPlan, { minutes }) } });
    };
  }, [activeProject]);

  const consumeActiveMinutes = () => {
    const now = Date.now();
    const minutes = Math.min(5, Math.max(0, (now - lastActivityAt.current) / 60_000));
    lastActivityAt.current = now;
    return minutes;
  };
  const recordInputMode = (mode: InputMode) => {
    if (mode === 'writing') {
      pendingWritingUses.current += 1;
      return;
    }
    const currentPlan = currentProject.plan ?? defaultPlanFor(currentProject.type);
    const nextPlan = { ...currentPlan, activity: addActivity(currentPlan, { dictationUses: 1, minutes: consumeActiveMinutes() }) };
    onUpdateProject(activeProject, { plan: nextPlan });
  };

  const refreshCompass = () => { if (!activePart) return; compassWordCount.current = countWords(plan.drafts[activePart.key] || ''); setCompass(getWritingCompass(currentProject, activePart, plan, blueprint)); };

  const chooseProject = (project: Project) => {
    onSelectProject(project.title);
    setNotesOpen(false);
    setReferenceOpen(false);
    setHelpOpen(false);
    setContextOpen(false);
    setCompassOpen(false);
    setRhythmOpen(false);
    setProjectMenuOpen(false);
    setCustomWritingMinutes(project.plan?.customWritingMinutes ?? '20');
    setCustomBreakMinutes(project.plan?.customBreakMinutes ?? '5');
  };
  const updateDraft = (value: string) => {
    if (!activePart) return;
    const currentPlan = currentProject.plan ?? defaultPlanFor(currentProject.type);
    const previousValue = currentPlan.drafts[activePart.key] || '';
    const wordDelta = Math.max(0, countWords(value) - countWords(previousValue));
    const nextDrafts = { ...currentPlan.drafts, [activePart.key]: value };
    const nextCompletedPartCount = parts.filter((part) => Boolean((part.key === activePart.key ? value : currentPlan.drafts[part.key])?.trim())).length;
    const nextCompletionPercent = parts.length ? Math.round((nextCompletedPartCount / parts.length) * 100) : 0;
    const nextActivity = addActivity(currentPlan, { words: wordDelta, pages: wordDelta / 250, completion: nextCompletionPercent, minutes: consumeActiveMinutes(), writingUses: pendingWritingUses.current });
    pendingWritingUses.current = 0;
    onUpdateProject(activeProject, { plan: { ...currentPlan, drafts: nextDrafts, activity: nextActivity } });
    if (Math.abs(countWords(value) - compassWordCount.current) >= 350) { compassWordCount.current = countWords(value); setCompass(getWritingCompass(currentProject, activePart, { ...currentPlan, drafts: nextDrafts }, blueprint)); }
  };
  const toggleChapterEnd = () => {
    if (!activePart || activePart.kind !== 'unit') return;
    const currentPlan = currentProject.plan ?? defaultPlanFor(currentProject.type);
    const nextChapterEnds = { ...(currentPlan.chapterEnds ?? {}), [activePart.key]: !currentPlan.chapterEnds?.[activePart.key] };
    onUpdateProject(activeProject, { plan: { ...currentPlan, chapterEnds: nextChapterEnds } });
  };
  const goNext = () => {
    if (!parts.length) return;
    setNotesOpen(false);
    setReferenceOpen(false);
    const currentPlan = currentProject.plan ?? defaultPlanFor(currentProject.type);
    onUpdateProject(activeProject, { plan: { ...currentPlan, writeIndex: Math.min(parts.length, activeIndex + 1), activity: addActivity(currentPlan, { completion: completionPercent, minutes: consumeActiveMinutes() }) } });
  };
  const goBack = () => {
    if (!parts.length) return;
    setNotesOpen(false);
    setReferenceOpen(false);
    const currentPlan = currentProject.plan ?? defaultPlanFor(currentProject.type);
    onUpdateProject(activeProject, { plan: { ...currentPlan, writeIndex: Math.max(0, activeIndex - 1), activity: addActivity(currentPlan, { completion: completionPercent, minutes: consumeActiveMinutes() }) } });
  };
  const updateDraftWithTool = (transform: (value: string) => string) => {
    if (!activePart) return;
    updateDraft(transform(plan.drafts[activePart.key] || ''));
  };
  const updatePartNote = (value: string) => {
    if (!activePart) return;
    onUpdateProject(activeProject, { plan: { ...plan, partNotes: { ...plan.partNotes, [activePart.key]: value } } });
  };
  const updateSessionPlan = (changes: Partial<ProjectPlan>) => onUpdateProject(activeProject, { plan: { ...plan, ...changes, writingPlanCreated: true, writingPlanCreatedAt: plan.writingPlanCreatedAt ?? Date.now() } });
  const selectWritingSessionMode = (mode: WritingSessionMode) => {
    setFocusTimerRunning(false);
    setFocusTimerSeconds(0);
    setFocusTimerPhase('writing');
    setSessionPromptOpen(false);
    updateSessionPlan({ writingSessionMode: mode });
  };
  const applySessionRecommendation = () => {
    if (!sessionRecommendation) return;
    setCustomWritingMinutes(String(sessionRecommendation.suggested));
    selectWritingSessionMode('custom');
    updateSessionPlan({ writingSessionMode: 'custom', customWritingMinutes: String(sessionRecommendation.suggested), customBreakMinutes });
  };
  const recordSession = (choice: SessionChoice) => {
    const writingMinutes = focusTimerPhase === 'writing' ? Math.max(1, Math.round(focusTimerSeconds / 60)) : sessionConfig.writingMinutes;
    const record: WritingSessionRecord = { timestamp: Date.now(), mode: writingSessionMode, writingMinutes, feeling: sessionFeeling.trim(), completed: sessionCompleted.trim(), next: sessionNext.trim(), choice };
    updateSessionPlan({ writingSessionHistory: [...sessionHistory, record] });
  };
  const handleSessionChoice = (choice: SessionChoice) => {
    recordSession(choice);
    setSessionFeeling('');
    setSessionCompleted('');
    setSessionNext('');
    if (choice === 'finish') {
      setFocusTimerRunning(false);
      setFocusTimerSeconds(0);
      setFocusTimerPhase('writing');
      setSessionPromptOpen(false);
      return;
    }
    if (choice === 'rest') {
      setFocusTimerPhase('rest');
      setFocusTimerSeconds(0);
      setSessionPromptOpen(false);
      setFocusTimerRunning(sessionConfig.breakMinutes > 0);
      return;
    }
    setFocusTimerPhase('writing');
    setFocusTimerSeconds(0);
    setSessionPromptOpen(false);
    setFocusTimerRunning(true);
  };
  const toggleFocusTimer = () => {
    if (focusTimerRunning && sessionConfig.countsUp) {
      setFocusTimerRunning(false);
      setSessionPromptOpen(true);
      return;
    }
    setFocusTimerRunning((running) => !running);
  };
  const resetFocusTimer = () => { setFocusTimerRunning(false); setFocusTimerSeconds(0); setFocusTimerPhase('writing'); setSessionPromptOpen(false); };
  const handleRhythmSectionPress = () => {
    const now = Date.now();
    const isDoubleTap = now - lastRhythmTapAt.current < 360;
    lastRhythmTapAt.current = isDoubleTap ? 0 : now;
    if (isDoubleTap || rhythmOpen) setRhythmOpen(false);
    else setRhythmOpen(true);
  };

  return <>
    <View style={[s.writeProjectBar, s.writeProjectBarRight]}>
      <Pressable onPress={() => onPage('Journey')} style={s.writeJourneyLink}><Text style={s.writeJourneyLinkText}>Journey</Text><Text style={s.writeJourneyLinkArrow}>↗</Text></Pressable>
      <Pressable onPress={() => setProjectMenuOpen(true)} style={s.writeProjectSwitcher} accessibilityLabel="Switch writing project">
        <View style={[s.writeProjectIcon, { backgroundColor: currentProject.color }]}><Text style={s.writeProjectIconText}>{currentProject.mark}</Text></View>
        <View style={s.writeProjectCopy}><Text style={s.writeProjectOverline}>WRITING</Text><Text numberOfLines={1} style={s.writeProjectTitle}>{currentProject.title}</Text></View>
        <Text style={s.writeProjectChevron}>⌄</Text>
      </Pressable>
    </View>

    <View style={s.writeTop}><View style={s.writeTopCopy}><Text style={s.overline}>{currentProject.title.toUpperCase()}</Text><Text style={s.writeTitle}>{completed ? 'The manuscript is complete.' : 'Keep the draft moving.'}</Text>{!completed && <Text style={s.writeTitleHint}>Carry the idea forward, one part at a time.</Text>}</View>{parts.length > 0 && <View style={[s.writeProgress, s.writeTopProgress]}><View style={s.writeProgressTop}><Text style={s.writeProgressValue}>{completionPercent}%</Text><Text style={s.writeProgressLabel}>COMPLETE</Text></View><View style={s.writeProgressTrack}><View style={[s.writeProgressFill, { width: `${completionPercent}%`, backgroundColor: activeArea.color }]} /></View><Text style={s.writeProgressText}>{completed ? 'MANUSCRIPT READY' : activeProgressLabel}</Text></View>}</View>

    {!parts.length && <View style={s.writeEmpty}><Text style={s.writeEmptyIcon}>✦</Text><Text style={s.writeEmptyTitle}>Your writing path is waiting.</Text><Text style={s.writeEmptyCopy}>Go to Plan → Structure and check the parts you want to write. Then they will appear here in order.</Text></View>}

    {completed && <View style={s.writeComplete}><Text style={s.writeCompleteIcon}>✦</Text><Text style={s.writeCompleteTitle}>You made it all the way through.</Text><Text style={s.writeCompleteCopy}>Your checked structure and {blueprint.unitLabelPlural} are complete. You can revisit any part with the back button or switch projects above.</Text><Pressable onPress={goBack} style={s.writeSecondaryButton}><Text style={s.writeSecondaryButtonText}>Review last part</Text></Pressable></View>}

    {activePart && !completed && <>
      <View style={s.writePartHeader}><View style={[s.writePartNumber, { backgroundColor: activeArea.color }]}><Text style={s.writePartNumberText}>{String(activeIndex + 1).padStart(2, '0')}</Text></View><View style={s.writePartCopy}><Text style={[s.writePartKicker, { color: activeArea.color }]}>{activePart.title === 'Free writing' ? 'OPEN DRAFT' : activeArea.label}</Text><Text style={s.writePartTitle}>{activePart.title}</Text><Text style={s.writePartHelper}>{activePart.helper}</Text></View></View>
      <View style={s.writeAssistArea}>
        <View style={s.writeAssistTiles}>
          <Pressable onPress={() => setHelpOpen(!helpOpen)} style={[s.writeAssistTile, helpOpen && s.writeAssistTileHelpActive]} accessibilityLabel={helpOpen ? 'Close help me write' : 'Open help me write'} accessibilityRole="button"><View style={[s.writeAssistIcon, s.writeAssistIconHelp]}><Text style={s.writeAssistIconText}>✦</Text></View></Pressable>
          <Pressable onPress={() => setNotesOpen(!notesOpen)} style={[s.writeAssistTile, notesOpen && s.writeAssistTileNotesActive]} accessibilityLabel={notesOpen ? 'Close plan notes' : 'Open plan notes'} accessibilityRole="button"><View style={[s.writeAssistIcon, s.writeAssistIconNotes]}><Text style={s.writeAssistIconText}>✎</Text></View></Pressable>
          <Pressable onPress={() => setCompassOpen(!compassOpen)} style={[s.writeAssistTile, compassOpen && s.writeAssistTileCompassActive]} accessibilityLabel={compassOpen ? 'Close writing compass' : 'Open writing compass'} accessibilityRole="button"><View style={[s.writeAssistIcon, s.writeAssistIconCompass]}><Text style={s.writeAssistIconText}>⌁</Text></View></Pressable>
        </View>
        {helpOpen && <View style={[s.writeAssistPanel, s.writeAssistPanelHelp]}><Text style={s.writeAssistPanelTitle}>HELP ME WRITE</Text><Text style={s.writeHelpIntro}>Choose a question to keep beside you. Bookez won’t write the part for you.</Text>{helpPrompts.map((prompt) => <Pressable key={prompt} onPress={() => setSelectedHelpPrompt(prompt)} style={[s.writeHelpPrompt, selectedHelpPrompt === prompt && s.writeHelpPromptSelected]}><Text style={[s.writeHelpPromptText, selectedHelpPrompt === prompt && s.writeHelpPromptTextSelected]}>{prompt}</Text><Text style={s.writeHelpPromptArrow}>→</Text></Pressable>)}{selectedHelpPrompt && <Text style={s.writeHelpSelected}>Keep asking: “{selectedHelpPrompt}”</Text>}</View>}
        {notesOpen && <View style={[s.writeAssistPanel, s.writeAssistPanelNotes]}><View style={s.writeAssistPanelHeader}><Text style={s.writeAssistPanelTitle}>PLAN NOTES TO KEEP CLOSE</Text><Text style={s.writeAssistPanelHint}>{contextNotes.length ? `${contextNotes.length} pieces of context available` : 'A private space for thoughts and reminders'}</Text></View>{contextNotes.length ? contextNotes.map((note) => <View key={note.label} style={s.writeNoteRow}><Text style={s.writeNoteLabel}>{note.label}</Text><Text style={s.writeNoteText}>{note.value}</Text></View>) : <Text style={s.writeNotesEmpty}>No notes yet. Add a thought to keep beside this part.</Text>}{plan.partNotes[activePart.key]?.trim() && <View style={[s.writeSavedNote, s.writeAssistNoteInset]}><Text style={s.writeSavedNoteLabel}>YOUR NOTE</Text><Text style={s.writeSavedNoteText}>{compactNote(plan.partNotes[activePart.key])}</Text></View>}<View style={[s.writeQuickNote, s.writeAssistNoteInset]}><Text style={s.writeQuickNoteLabel}>A NOTE FOR THIS PART</Text><DictationInput value={plan.partNotes[activePart.key] || ''} onChangeText={updatePartNote} placeholder="Capture a thought to keep beside the draft…" placeholderTextColor="#A0A3BB" multiline style={s.writeQuickNoteInput} accessibilityLabel="Note for this part" /></View></View>}
        {compassOpen && <View style={[s.writeAssistPanel, s.writeAssistPanelCompass]}><View style={s.writeCompassHeader}><View style={s.writeCompassTitleRow}><View style={[s.writeCompassIcon, s.writeAssistIconCompass]}><Text style={s.writeCompassIconText}>⌁</Text></View><View><Text style={s.writeCompassKicker}>WRITING COMPASS</Text><Text style={s.writeCompassSub}>From your plan, notes, and current draft</Text></View></View><Pressable onPress={refreshCompass} style={s.writeCompassRefresh} accessibilityLabel="Refresh writing compass"><Text style={s.writeCompassRefreshText}>Refresh</Text></Pressable></View><View style={s.writeCompassRow}><Text style={s.writeCompassLabel}>WHAT YOU’RE DOING NOW</Text><Text style={s.writeCompassText}>{compass.doing}</Text></View><View style={s.writeCompassRow}><Text style={s.writeCompassLabel}>A NATURAL NEXT STEP</Text><Text style={s.writeCompassText}>{compass.next}</Text></View><View style={s.writeCompassRow}><Text style={s.writeCompassLabel}>KEEP IN MIND</Text><Text style={s.writeCompassText}>{compass.keep}</Text></View></View>}
      </View>
      <View style={s.writeEditorCard}><View style={s.writeEditorTop}><View style={s.writeEditorLabelGroup}><Text style={s.writeEditorLabel}>WRITE THIS PART</Text><Pressable onPress={() => setContextOpen(true)} style={s.writeContextButton} accessibilityLabel="Open writing context"><Text style={s.writeContextIcon}>◈</Text><Text style={s.writeContextText}>Context</Text></Pressable></View><Text style={s.writeEditorHint}>🎙 Dictate with your phone</Text></View><DictationInput value={plan.drafts[activePart.key] || ''} onChangeText={updateDraft} onInputMode={recordInputMode} placeholder={`Begin your ${activePart.title.toLowerCase()}…`} placeholderTextColor="#9A9DB7" multiline autoCorrect spellCheck style={s.writeEditorInput} accessibilityLabel={activePart.title} /><View style={s.writeTools}><Pressable onPress={() => updateDraftWithTool(polishWriting)} disabled={!plan.drafts[activePart.key]?.trim()} style={[s.writeToolButton, !plan.drafts[activePart.key]?.trim() && s.writeToolDisabled]} accessibilityLabel="Polish writing"><Text style={s.writeToolIcon}>✦</Text><Text style={s.writeToolText}>Polish</Text></Pressable><Pressable onPress={() => updateDraftWithTool(grammarWriting)} disabled={!plan.drafts[activePart.key]?.trim()} style={[s.writeToolButton, !plan.drafts[activePart.key]?.trim() && s.writeToolDisabled]} accessibilityLabel="Fix grammar"><Text style={s.writeToolIcon}>Aa</Text><Text style={s.writeToolText}>Grammar</Text></Pressable><Text style={s.writeToolHint}>Quick local cleanup</Text></View></View>
      <ImageSystemCard project={currentProject} images={projectImages} connectedPartKey={activePart.key} onAddImage={addImage} onReplaceImage={replaceImage} onUpdateImage={updateImage} onRemoveImage={removeImage} onEnableImages={enableImages} compact emptyLabel={`Add ${getImageSystemConfig(currentProject.type).itemLabel.toLowerCase()} to this part`} />
      <View style={s.writeReferenceBlock}><Pressable onPress={() => setReferenceOpen(!referenceOpen)} style={s.writeReferenceButton} accessibilityLabel={referenceOpen ? 'Close writing reference' : 'Open writing reference'} accessibilityRole="button"><Text style={s.writeReferenceIcon}>◌</Text><Text style={s.writeReferenceButtonText}>{referenceOpen ? 'Hide reference' : 'Show reference'}</Text><Text style={s.writeReferenceChevron}>{referenceOpen ? '⌃' : '⌄'}</Text></Pressable>{referenceOpen && <View style={s.writeReferencePanel}><Text style={s.writeReferenceKicker}>A QUIET REFERENCE</Text>{pageReferenceItems.map((item) => <View key={item.label} style={s.writeReferenceRow}><Text style={s.writeReferenceLabel}>{item.label}</Text><Text style={s.writeReferenceText}>{item.value}</Text></View>)}</View>}</View>
      {activePart.kind === 'unit' && <View style={s.chapterEndCompactRow}><Pressable onPress={toggleChapterEnd} style={[s.chapterEndIconButton, chapterEndMarked && s.chapterEndIconButtonMarked]} accessibilityRole="button" accessibilityLabel={chapterEndMarked ? 'Unmark chapter end' : 'Mark chapter end'}><Text style={[s.chapterEndIconText, chapterEndMarked && s.chapterEndIconTextMarked]}>{chapterEndMarked ? '✓' : '·'}</Text></Pressable><Text style={s.chapterEndCompactLabel}>CHAPTER END</Text></View>}
      <View style={s.writeNavigation}><Pressable onPress={goBack} disabled={activeIndex === 0} style={[s.writeSecondaryButton, activeIndex === 0 && s.writeButtonDisabled]}><Text style={s.writeSecondaryButtonText}>← Previous</Text></Pressable><Pressable onPress={goNext} style={s.writeNextButton}><Text style={s.writeNextButtonText}>{activeIndex === parts.length - 1 ? 'Finish manuscript' : 'Next part →'}</Text></Pressable></View>
      <View style={s.writeUtilityDock}>
        <Pressable onPress={() => setSessionDetailsOpen(!sessionDetailsOpen)} style={[s.writeUtilityTile, sessionDetailsOpen && s.writeUtilityTileStatsActive]} accessibilityLabel={sessionDetailsOpen ? 'Close page statistics' : 'Open page statistics'} accessibilityRole="button">
          <View style={[s.writeUtilityIcon, s.writeUtilityIconStats]}><Text style={s.writeUtilityIconText}>◷</Text></View>
        </Pressable>
        <Pressable onPress={handleRhythmSectionPress} style={[s.writeUtilityTile, rhythmOpen && s.writeUtilityTileRhythmActive]} accessibilityLabel={rhythmOpen ? 'Close writing rhythm' : 'Open writing rhythm'} accessibilityHint="Open the writing session timer" accessibilityRole="button">
          <View style={[s.writeUtilityIcon, s.writeUtilityIconRhythm]}><Text style={s.writeUtilityIconText}>{focusTimerRunning ? '◷' : '⌛'}</Text></View>
        </Pressable>
      </View>
      {sessionDetailsOpen && <View style={[s.writeSessionDetailsUtility, s.writeSessionStatsUtility]}><View style={s.writeSessionDetailBlockUtility}><Text style={s.writeSessionDetailValue}>{formatCount(pageStats.words)}</Text><Text style={s.writeSessionDetailLabel}>WORDS</Text></View><View style={s.writeSessionDetailBlockUtility}><Text style={s.writeSessionDetailValue}>{formatCount(pageStats.letters)}</Text><Text style={s.writeSessionDetailLabel}>LETTERS</Text></View><View style={s.writeSessionDetailBlockUtility}><Text style={s.writeSessionDetailValue}>{formatCount(pageStats.sentences)}</Text><Text style={s.writeSessionDetailLabel}>SENTENCES</Text></View><View style={s.writeSessionDetailBlockUtility}><Text style={s.writeSessionDetailValue}>{formatCount(pageStats.paragraphs)}</Text><Text style={s.writeSessionDetailLabel}>PARAGRAPHS</Text></View><View style={s.writeSessionDetailBlockUtility}><Text style={s.writeSessionDetailValue}>{sessionMinutes}m</Text><Text style={s.writeSessionDetailLabel}>TIME WRITING</Text></View></View>}
      {rhythmOpen && <View style={rhythmS.writeRhythmCardOrganized}><View style={rhythmS.writeRhythmHeader}><View style={rhythmS.writeRhythmCopy}><Text style={rhythmS.writeRhythmKicker}>WRITING SESSION</Text><Text style={rhythmS.writeRhythmTitle}>{writingSessionOptions.find((option) => option.mode === writingSessionMode)?.label ?? 'Gentle Focus'}</Text></View><Text style={rhythmS.writeRhythmTarget}>{sessionConfig.countsUp ? 'COUNT UP' : 'TRY ' + focusTargetMinutes + ' MIN'}</Text></View><Text style={rhythmS.writeRhythmHint}>{sessionConfig.helper}</Text><Text style={rhythmS.modeLabel}>CHOOSE A MODE</Text><View style={rhythmS.modeGrid}>{writingSessionOptions.map((option) => <Pressable key={option.mode} onPress={() => selectWritingSessionMode(option.mode)} style={[rhythmS.modeChoice, writingSessionMode === option.mode && rhythmS.modeChoiceSelected]}><Text style={[rhythmS.modeChoiceText, writingSessionMode === option.mode && rhythmS.modeChoiceTextSelected]}>{option.label}</Text>{option.recommended && <Text style={rhythmS.modeRecommended}>RECOMMENDED</Text>}</Pressable>)}</View>{writingSessionMode === 'custom' && <View style={rhythmS.customSessionRow}><View style={rhythmS.customSessionField}><Text style={rhythmS.customSessionLabel}>WRITING</Text><TextInput value={customWritingMinutes} onChangeText={(value) => { setCustomWritingMinutes(value); updateSessionPlan({ customWritingMinutes: value }); }} keyboardType="number-pad" style={rhythmS.customSessionInput} accessibilityLabel="Custom writing minutes" /><Text style={rhythmS.customSessionUnit}>MIN</Text></View><View style={rhythmS.customSessionField}><Text style={rhythmS.customSessionLabel}>BREAK</Text><TextInput value={customBreakMinutes} onChangeText={(value) => { setCustomBreakMinutes(value); updateSessionPlan({ customBreakMinutes: value }); }} keyboardType="number-pad" style={rhythmS.customSessionInput} accessibilityLabel="Custom break minutes" /><Text style={rhythmS.customSessionUnit}>MIN</Text></View></View>}{sessionRecommendation && <View style={rhythmS.recommendationCard}><Text style={rhythmS.recommendationKicker}>BOOKEZ NOTICED</Text><Text style={rhythmS.recommendationText}>Your recent sessions cluster around {sessionRecommendation.minimum}–{sessionRecommendation.maximum} minutes. Would you like to make {sessionRecommendation.suggested}-minute sessions your default?</Text><Pressable onPress={applySessionRecommendation} style={rhythmS.recommendationButton}><Text style={rhythmS.recommendationButtonText}>Use {sessionRecommendation.suggested} minutes</Text></Pressable></View>}{sessionPromptOpen && <View style={rhythmS.sessionPrompt}><Text style={rhythmS.sessionPromptKicker}>{focusTimerPhase === 'rest' ? 'BREAK COMPLETE' : 'SESSION COMPLETE'}</Text><Text style={rhythmS.sessionPromptTitle}>{focusTimerPhase === 'rest' ? 'Ready for another writing block?' : 'How did this session feel?'}</Text><TextInput value={sessionFeeling} onChangeText={setSessionFeeling} placeholder="A word or two is enough…" placeholderTextColor="#A0A3BB" style={rhythmS.sessionPromptInput} accessibilityLabel="How the writing session felt" /><TextInput value={sessionCompleted} onChangeText={setSessionCompleted} placeholder="What did you complete?" placeholderTextColor="#A0A3BB" style={rhythmS.sessionPromptInput} accessibilityLabel="What you completed" /><TextInput value={sessionNext} onChangeText={setSessionNext} placeholder="What should happen next?" placeholderTextColor="#A0A3BB" style={rhythmS.sessionPromptInput} accessibilityLabel="What should happen next" /><View style={rhythmS.sessionPromptActions}><Pressable onPress={() => handleSessionChoice('continue')} style={rhythmS.sessionPromptPrimary}><Text style={rhythmS.sessionPromptPrimaryText}>Continue</Text></Pressable><Pressable onPress={() => handleSessionChoice('rest')} style={rhythmS.sessionPromptSecondary}><Text style={rhythmS.sessionPromptSecondaryText}>{focusTimerPhase === 'rest' ? 'Rest again' : 'Rest'}</Text></Pressable><Pressable onPress={() => handleSessionChoice('finish')} style={rhythmS.sessionPromptSecondary}><Text style={rhythmS.sessionPromptSecondaryText}>Finish</Text></Pressable></View></View>}<View style={rhythmS.focusTimerRow}><View><Text style={rhythmS.focusTimerValue}>{formatFocusTimer(focusTimerSeconds)}</Text><Text style={rhythmS.focusTimerLabel}>{sessionConfig.countsUp ? 'FLOW SESSION' : focusTimerPhase === 'rest' ? 'REST' : focusTimerSeconds >= focusTargetMinutes * 60 ? 'SESSION COMPLETE' : 'FOCUS TIMER'}</Text></View><View style={rhythmS.focusTimerActions}><Pressable onPress={toggleFocusTimer} style={rhythmS.focusTimerPrimary}><Text style={rhythmS.focusTimerPrimaryText}>{focusTimerRunning ? sessionConfig.countsUp ? 'Finish' : 'Pause' : focusTimerSeconds ? 'Resume' : 'Start'}</Text></Pressable>{focusTimerSeconds > 0 && <Pressable onPress={resetFocusTimer} style={rhythmS.focusTimerReset}><Text style={rhythmS.focusTimerResetText}>Reset</Text></Pressable>}</View></View>{!sessionConfig.countsUp && <View style={rhythmS.focusTimerTrack}><View style={[rhythmS.focusTimerFill, { width: `${focusTimerProgress * 100}%` }]} /></View>}<View style={rhythmS.strategyPanel}><Text style={rhythmS.strategyKicker}>TODAY’S METHOD</Text><Text style={rhythmS.strategyTitle}>{writingStrategy.title}</Text><Text style={rhythmS.strategyBody}>{writingStrategy.body}</Text><Text style={rhythmS.strategySteps}>{writingStrategy.steps}</Text></View><Text style={rhythmS.writeRhythmResearch}>Research-informed: scheduled, repeatable sessions tend to support more sustainable progress than rare binge sessions. This is a suggestion, not a rule.</Text></View>}
    </>}

    <Modal animationType="slide" transparent visible={contextOpen} onRequestClose={() => setContextOpen(false)}><View style={s.writeContextShade}><Pressable style={s.writeContextDismiss} onPress={() => setContextOpen(false)} /><View style={s.writeContextSheet}><View style={s.sheetHandle} /><View style={s.writeContextHeader}><View><Text style={s.writeContextKicker}>BOOK CONTEXT</Text><Text style={s.writeContextTitle}>{activePart?.title ?? 'This part'}</Text></View><Pressable onPress={() => setContextOpen(false)} style={s.closeButton}><Text style={s.closeButtonText}>×</Text></Pressable></View>{contextItems.map((item) => <View key={item.label} style={s.writeContextRow}><View style={s.writeContextRowIcon}><Text style={s.writeContextRowIconText}>{item.label === 'Chapter plan' ? '⌁' : item.label === 'Earlier notes' ? '✦' : item.label === 'Preceding section' ? '‹' : '◌'}</Text></View><View style={s.writeContextRowCopy}><Text style={s.writeContextRowLabel}>{item.label}</Text><Text style={s.writeContextRowValue}>{item.value}</Text></View></View>)}</View></View></Modal>
    <Modal animationType="fade" transparent visible={projectMenuOpen} onRequestClose={() => setProjectMenuOpen(false)}>
      <Pressable style={s.writeMenuShade} onPress={() => setProjectMenuOpen(false)}>
        <View style={s.writeMenu}><Text style={s.writeMenuHeader}>SWITCH PROJECT</Text><Text style={s.writeMenuHint}>Choose a manuscript to write.</Text>{projects.map((project) => <Pressable key={project.title} onPress={() => chooseProject(project)} style={[s.writeMenuRow, project.title === activeProject && s.writeMenuRowActive]}><View style={[s.writeMenuIcon, { backgroundColor: project.color }]}><Text style={s.writeMenuIconText}>{project.mark}</Text></View><View style={s.writeMenuCopy}><Text numberOfLines={1} style={s.writeMenuProject}>{project.title}</Text><Text numberOfLines={1} style={s.writeMenuType}>{project.type}</Text></View><Text style={s.writeMenuCheck}>{project.title === activeProject ? '✓' : ''}</Text></Pressable>)}</View>
      </Pressable>
    </Modal>
  </>;
}

function Journey({ projects, activeProject, onSelectProject, onUpdateProject, onPage, onBack, onOpenBookStudio }: { projects: Project[]; activeProject: string; onSelectProject: (title: string) => void; onUpdateProject: (title: string, changes: Partial<Project>) => void; onPage: (page: Page) => void; onBack: () => void; onOpenBookStudio: (title: string, section: StudioSection) => void }) {
  const currentProject = projects.find((project) => project.title === activeProject) ?? projects[0];
  const snapshot = getJourneySnapshot(currentProject);
  const currentPlan = currentProject.plan ?? defaultPlanFor(currentProject.type);
  const todayPlan = getJourneyTodayPlan(currentProject, snapshot);
  const latestMilestone = hasWritingPlan(currentProject, currentPlan) ? getLatestCompletedMilestone(currentProject) : undefined;
  const milestones = getJourneyMilestones(snapshot);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const mapWidth = Math.max(280, width - 40);
  const rowHeight = 176;
  const nodeWidth = 144;
  const positions = [0.24, 0.76, 0.49, 0.23, 0.76, 0.49, 0.23, 0.76];
  const points = milestones.map((_, index) => ({ x: mapWidth * positions[index % positions.length], y: 58 + index * rowHeight }));
  const mapHeight = milestones.length * rowHeight + 35;
  const currentMilestoneIndex = milestones.findIndex((milestone) => milestone.status === 'current');
  const routeCompletionIndex = currentMilestoneIndex === -1 ? milestones.length : currentMilestoneIndex;
  const currentMilestone = milestones[currentMilestoneIndex >= 0 ? currentMilestoneIndex : milestones.length - 1];
  const selectedMilestone = milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? currentMilestone;
  const selectedCheckpoint = selectedMilestone && selectedCheckpointId ? selectedMilestone.miniCheckpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) : undefined;
  const selectedCheckpointProgress = selectedMilestone ? selectedCheckpoint ? getJourneyMiniCheckpointProgress(snapshot, selectedMilestone, selectedCheckpoint, currentPlan) : getJourneyCheckpointProgress(snapshot, selectedMilestone, currentPlan) : undefined;
  const nextStep = getJourneyNextStep(snapshot, currentMilestone);
  const nextPage: Page = 'Write';
  const nextAction = snapshot.manuscriptComplete ? 'Review the manuscript' : !snapshot.firstDraftStarted ? 'Start writing whenever you’re ready' : snapshot.nextPart ? `Write ${snapshot.nextPart.title}` : 'Continue manuscript';

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  useEffect(() => {
    setSelectedMilestoneId(null);
    setSelectedCheckpointId(null);
  }, [activeProject]);

  const chooseProject = (project: Project) => {
    onSelectProject(project.title);
    setSelectorOpen(false);
  };

  return <>
    <View style={s.journeyHeader}>
      <Pressable onPress={onBack} style={s.journeyBackButton} accessibilityLabel="Back to book library"><Text style={s.journeyBackIcon}>‹</Text></Pressable>
      <View style={s.journeyHeaderCopy}><Text style={s.journeyOverline}>BOOKEZ / PROGRESS</Text><Text style={s.journeyHeaderTitle}>Your Book Journey</Text></View>
      <Pressable onPress={() => setMenuOpen(true)} style={s.journeyOverflowButton} accessibilityLabel="Open book journey menu"><Text style={s.journeyOverflowText}>•••</Text></Pressable>
    </View>

    <Pressable onPress={() => setSelectorOpen(true)} style={s.journeyBookPicker} accessibilityLabel={`Switch selected book, ${currentProject.title}`}>
      <View style={[s.journeyBookMark, { backgroundColor: currentProject.color }]}><Text style={s.journeyBookMarkText}>{currentProject.mark}</Text></View>
      <View style={s.journeyBookPickerCopy}><Text style={s.journeyBookPickerLabel}>SELECTED BOOK</Text><Text numberOfLines={1} style={s.journeyBookPickerTitle}>{currentProject.title}</Text><Text style={s.journeyBookPickerMeta}>{snapshot.stage} · {snapshot.progressPercent}% complete</Text></View>
      <Text style={s.journeyPickerChevron}>⌄</Text>
    </Pressable>

    <View style={s.journeySummaryCard}>
      <View style={s.journeySummaryTop}><View><Text style={s.journeySummaryEyebrow}>YOUR JOURNEY</Text><Text style={s.journeySummaryStage}>{snapshot.stage}</Text></View><Text style={s.journeySummaryPercent}>{snapshot.progressPercent}%</Text></View>
      <View style={s.journeyProgressTrack}><View style={[s.journeyProgressFill, { width: `${snapshot.progressPercent}%` }]} /></View>
      <View style={s.journeyStatsRow}><View style={s.journeyStat}><Text style={s.journeyStatValue}>{formatCount(snapshot.wordCount)}</Text><Text style={s.journeyStatLabel}>WORDS WRITTEN</Text><Text style={s.journeyStatSub}>{snapshot.targetWords ? `of ${formatCount(snapshot.targetWords)} est. target` : 'Target not set'}</Text></View><View style={s.journeyStatDivider} /><View style={s.journeyStat}><Text style={s.journeyStatValue}>{snapshot.completedUnits} of {snapshot.unitCount}</Text><Text style={s.journeyStatLabel}>{snapshot.blueprint.unitLabelPlural.toUpperCase()}</Text><Text style={s.journeyStatSub}>with a draft</Text></View></View>
      <View style={s.journeyEstimateCard}><View style={s.journeyEstimateIcon}><Text style={s.journeyEstimateIconText}>◷</Text></View><View style={s.journeyEstimateCopy}><Text style={s.journeyEstimateLabel}>ESTIMATED FINISH</Text><Text style={s.journeyEstimateValue}>{snapshot.estimateLabel}</Text><Text style={s.journeyEstimateDetail}>{snapshot.estimateDetail}</Text></View></View>
      <View style={s.journeyNextRow}><View style={s.journeyNextDot}><Text style={s.journeyNextDotText}>{currentMilestone.icon}</Text></View><View style={s.journeyNextCopy}><Text style={s.journeyNextEyebrow}>NEXT STEP</Text><Text style={s.journeyNextTitle}>{nextStep.title}</Text><Text style={s.journeyNextMeta}>{nextStep.time}</Text></View><Text style={s.journeyNextArrow}>→</Text></View>
      <Pressable onPress={() => snapshot.manuscriptComplete ? onOpenBookStudio(currentProject.title, 'read') : onPage(nextPage)} style={s.journeyContinueButton}><Text style={s.journeyContinueText}>{snapshot.manuscriptComplete ? 'Open Book Studio' : 'Continue Journey'}</Text><Text style={s.journeyContinueAction}>{nextAction}</Text><Text style={s.journeyContinueArrow}>→</Text></Pressable>
    </View>

    {todayPlan && <View style={[s.journeyTodayCard, todayPlan.tone === 'paused' && s.journeyTodayCardPaused, todayPlan.tone === 'foundation' && s.journeyTodayCardFoundation]}>
      <View style={s.journeyTodayHeader}><View style={[s.journeyTodayIcon, todayPlan.tone === 'paused' && s.journeyTodayIconPaused, todayPlan.tone === 'foundation' && s.journeyTodayIconFoundation]}><Text style={s.journeyTodayIconText}>{todayPlan.tone === 'paused' ? 'Ⅱ' : todayPlan.tone === 'foundation' ? '⌁' : '◷'}</Text></View><View style={s.journeyTodayCopy}><Text style={s.journeyTodayEyebrow}>TODAY’S WRITING PLAN</Text><Text style={s.journeyTodayTitle}>{todayPlan.title}</Text></View><Text style={s.journeyTodayStatus}>{todayPlan.tone === 'scheduled' ? 'TODAY' : todayPlan.tone === 'paused' ? 'PAUSED' : 'GENTLE'}</Text></View>
      <Text style={s.journeyTodayDetail}>{todayPlan.detail}</Text>
      <View style={s.journeyTodayGoalRow}><Text style={s.journeyTodayGoal}>{todayPlan.goal}</Text><Text style={s.journeyTodayHint}>A suggestion, not a deadline.</Text></View>
      <View style={s.journeyTodayActions}><Pressable onPress={() => todayPlan.tone === 'paused' ? onUpdateProject(currentProject.title, { plan: { ...currentPlan, writingPlanPaused: false } }) : onPage(todayPlan.actionPage)} style={s.journeyTodayPrimary}><Text style={s.journeyTodayPrimaryText}>{todayPlan.actionLabel}</Text><Text style={s.journeyTodayPrimaryArrow}>→</Text></Pressable>{todayPlan.tone !== 'paused' && <Pressable onPress={() => onUpdateProject(currentProject.title, { plan: { ...currentPlan, writingPlanPaused: true } })} style={s.journeyTodayPause}><Text style={s.journeyTodayPauseText}>Pause plan</Text></Pressable>}</View>
    </View>}
    {latestMilestone && <View style={s.journeyMilestoneReached}><View style={s.journeyMilestoneReachedIcon}><Text style={s.journeyMilestoneReachedIconText}>{latestMilestone.icon}</Text></View><View style={s.journeyMilestoneReachedCopy}><Text style={s.journeyMilestoneReachedEyebrow}>MILESTONE REACHED</Text><Text style={s.journeyMilestoneReachedTitle}>{latestMilestone.title} <Text style={s.journeyMilestoneReachedCheck}>✓</Text></Text></View></View>}

    <View style={s.journeyMapHeading}><View><Text style={s.journeyMapEyebrow}>YOUR PATH</Text><Text style={s.journeyMapTitle}>Small steps lead to big moments.</Text></View><Text style={s.journeyMapHint}>Tap any dot</Text></View>
    <View style={[s.journeyMap, { height: mapHeight }]}>
      {points.slice(0, -1).map((point, index) => {
        const nextPoint = points[index + 1];
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return <View key={`route-${index}`} style={[s.journeyRoute, index < routeCompletionIndex && s.journeyRouteComplete, { left: (point.x + nextPoint.x - length) / 2, top: (point.y + nextPoint.y) / 2, width: length, transform: [{ rotate: `${angle}deg` }] }]} />;
      })}
      {milestones.map((milestone, index) => {
        const selected = selectedMilestone?.id === milestone.id;
        const bigSelected = selected && !selectedCheckpoint;
        const node = <View style={s.journeyNodeStack}><View style={s.journeyMiniDotRow}>{milestone.miniCheckpoints.map((checkpoint, checkpointIndex) => { const checkpointSelected = selected && selectedCheckpoint?.id === checkpoint.id; return <Fragment key={checkpoint.id}><Pressable onPress={() => { setSelectedMilestoneId(milestone.id); setSelectedCheckpointId(checkpoint.id); }} accessibilityRole="button" accessibilityLabel={`Show progress for ${checkpoint.title}`}><View style={[s.journeyMiniDot, checkpoint.completed && s.journeyMiniDotComplete, milestone.status === 'current' && !checkpoint.completed && s.journeyMiniDotCurrent, checkpointSelected && s.journeyMiniDotSelected]}><Text style={[s.journeyMiniDotText, checkpoint.completed && s.journeyMiniDotTextComplete]}>{checkpoint.completed ? '✓' : `${checkpointIndex + 1}`}</Text></View></Pressable>{checkpointIndex < milestone.miniCheckpoints.length - 1 && <View style={[s.journeyMiniDotLine, milestone.miniCheckpoints[checkpointIndex + 1].completed && s.journeyMiniDotLineComplete]} />}</Fragment>; })}<View style={s.journeyMiniToBigLine} /></View><Pressable onPress={() => { setSelectedMilestoneId(milestone.id); setSelectedCheckpointId(null); }} accessibilityRole="button" accessibilityLabel={`Show progress for ${milestone.title}`}><Animated.View style={[s.journeyNode, milestone.kind === 'step' && s.journeyNodeStep, milestone.status === 'complete' ? s.journeyNodeComplete : milestone.status === 'current' ? s.journeyNodeCurrent : s.journeyNodeFuture, bigSelected && s.journeyNodeSelected, milestone.status === 'current' && { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }]}><Text style={[s.journeyNodeIcon, milestone.kind === 'step' && s.journeyNodeIconStep]}>{milestone.icon}</Text></Animated.View></Pressable></View>;
        return <View key={milestone.id} style={[s.journeyMilestone, { left: points[index].x - nodeWidth / 2, top: index * rowHeight, width: nodeWidth }]}>
          {node}
          <Pressable onPress={() => { setSelectedMilestoneId(milestone.id); setSelectedCheckpointId(null); }} style={[s.journeyMilestoneCard, milestone.kind === 'step' && s.journeyMilestoneCardStep, milestone.status === 'current' && s.journeyMilestoneCardCurrent, milestone.status === 'complete' && s.journeyMilestoneCardComplete, bigSelected && s.journeyMilestoneCardSelected]} accessibilityRole="button"><View style={s.journeyMilestoneTitleRow}><Text style={s.journeyMilestoneTitle}>{milestone.title}</Text><Text style={[s.journeyMilestoneState, milestone.status === 'complete' ? s.journeyStateComplete : milestone.status === 'current' ? s.journeyStateCurrent : s.journeyStateFuture]}>{milestone.status === 'complete' ? 'DONE' : milestone.status === 'current' ? 'NOW' : 'UP NEXT'}</Text></View><Text style={s.journeyMilestoneDetail}>{milestone.detail}</Text><View style={s.journeyMiniList}>{milestone.miniCheckpoints.map((checkpoint) => <Pressable key={checkpoint.id} onPress={() => { setSelectedMilestoneId(milestone.id); setSelectedCheckpointId(checkpoint.id); }} style={s.journeyMiniRow} accessibilityRole="button" accessibilityLabel={`Show progress for ${checkpoint.title}`}><Text style={[s.journeyMiniCheck, checkpoint.completed && s.journeyMiniCheckComplete]}>{checkpoint.completed ? '✓' : '○'}</Text><Text numberOfLines={1} style={[s.journeyMiniText, checkpoint.completed && s.journeyMiniTextComplete]}>{checkpoint.title}</Text></Pressable>)}</View></Pressable>
        </View>;
      })}
    </View>

    {selectedMilestone && selectedCheckpointProgress && <View style={s.journeyCheckpointDetail}><View style={s.journeyCheckpointDetailTop}><View style={s.journeyCheckpointDetailCopy}><Text style={s.journeyCheckpointEyebrow}>{selectedCheckpoint ? 'STEP DETAIL' : 'MILESTONE DETAIL'}</Text><Text style={s.journeyCheckpointTitle}>{selectedCheckpoint?.title ?? selectedMilestone.title}</Text>{selectedCheckpoint && <Text style={s.journeyCheckpointParent}>Part of {selectedMilestone.title}</Text>}</View><Text style={s.journeyCheckpointPercent}>{selectedCheckpointProgress.progress}%</Text></View><View style={s.journeyCheckpointTrack}><View style={[s.journeyCheckpointFill, { width: `${selectedCheckpointProgress.progress}%` }]} /></View><View style={s.journeyCheckpointMeta}><View><Text style={s.journeyCheckpointMetaLabel}>PROGRESS</Text><Text style={s.journeyCheckpointMetaValue}>{selectedCheckpointProgress.progress === 100 ? 'Reached' : `${selectedCheckpointProgress.progress}% toward this checkpoint`}</Text></View><View style={s.journeyCheckpointMetaRight}><Text style={s.journeyCheckpointMetaLabel}>TIME LEFT</Text><Text style={s.journeyCheckpointMetaValue}>{selectedCheckpointProgress.estimateLabel}</Text></View></View><Text style={s.journeyCheckpointDetailText}>{selectedCheckpointProgress.estimateDetail}</Text></View>}

    <Modal animationType="slide" visible={selectorOpen} transparent onRequestClose={() => setSelectorOpen(false)}>
      <View style={s.journeyModalShade}><Pressable style={s.journeyModalDismiss} onPress={() => setSelectorOpen(false)} /><View style={s.journeySelectorSheet}><View style={s.sheetHandle} /><Text style={s.journeySheetEyebrow}>YOUR BOOKS</Text><Text style={s.journeySheetTitle}>Choose a journey</Text><Text style={s.journeySheetHint}>Each book keeps its own path and progress.</Text>{projects.map((project) => { const projectSnapshot = getJourneySnapshot(project); return <Pressable key={project.title} onPress={() => chooseProject(project)} style={[s.journeyBookRow, project.title === activeProject && s.journeyBookRowActive]}><View style={[s.journeyBookMark, { backgroundColor: project.color }]}><Text style={s.journeyBookMarkText}>{project.mark}</Text></View><View style={s.journeyBookRowCopy}><Text numberOfLines={1} style={s.journeyBookRowTitle}>{project.title}</Text><Text style={s.journeyBookRowMeta}>{projectSnapshot.stage} · {projectSnapshot.progressPercent}% complete</Text><Text style={s.journeyBookRowEdited}>Last edited · {formatLastEdited(project.updatedAt)}</Text></View>{project.title === activeProject && <Text style={s.journeyBookRowCheck}>✓</Text>}</Pressable>; })}</View></View>
    </Modal>

    <Modal animationType="fade" visible={menuOpen} transparent onRequestClose={() => setMenuOpen(false)}>
      <Pressable style={s.journeyMenuShade} onPress={() => setMenuOpen(false)}><View style={s.journeyMenu}><Text style={s.journeySheetEyebrow}>THIS BOOK</Text><Text style={s.journeyMenuTitle}>{currentProject.title}</Text><Pressable onPress={() => { setMenuOpen(false); onOpenBookStudio(currentProject.title, getBookStudioState(currentProject).lastSection); }} style={s.journeyMenuRow}><Text style={s.journeyMenuIcon}>▣</Text><Text style={s.journeyMenuLabel}>Open Book Studio</Text><Text style={s.journeyMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); onPage('Plan'); }} style={s.journeyMenuRow}><Text style={s.journeyMenuIcon}>⌁</Text><Text style={s.journeyMenuLabel}>Open planning</Text><Text style={s.journeyMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); onPage('Write'); }} style={s.journeyMenuRow}><Text style={s.journeyMenuIcon}>✎</Text><Text style={s.journeyMenuLabel}>Open manuscript</Text><Text style={s.journeyMenuArrow}>›</Text></Pressable></View></Pressable>
    </Modal>
  </>;
}

function BookStudio({ projects, project, initialSection, onBack, onPage, onSelectProject, onUpdateProject, onOpenBookStudio }: { projects: Project[]; project?: Project; initialSection: StudioSection; onBack: () => void; onPage: (page: Page) => void; onSelectProject: (title: string) => void; onUpdateProject: (title: string, changes: Partial<Project>) => void; onOpenBookStudio: (title: string, section: StudioSection) => void }) {
  const [section, setSection] = useState<StudioSection>(initialSection);
  const [studio, setStudio] = useState<BookStudioState>(() => project ? getBookStudioState(project) : defaultBookStudioState({ title: 'Book', type: 'Custom Project', color: C.periwinkle, mark: '✦', pageGoal: '0', unitGoal: '0', plan: defaultPlanFor('Custom Project') }));
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [readerIndex, setReaderIndex] = useState(0);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingLabel, setSpeakingLabel] = useState('');
  const speechRun = useRef(0);

  useEffect(() => {
    if (!project) return;
    setStudio(getBookStudioState(project));
    setSection(initialSection || getBookStudioState(project).lastSection);
    setReaderIndex(0);
  }, [project?.title, initialSection]);
  useEffect(() => () => { speechRun.current += 1; Speech.stop(); }, []);

  if (!project) return <View style={s.studioError}><Text style={s.studioErrorIcon}>⌁</Text><Text style={s.studioErrorTitle}>Book not found</Text><Text style={s.studioErrorCopy}>This book is no longer available in your library.</Text><Pressable onPress={onBack} style={s.studioPrimaryButton}><Text style={s.studioPrimaryButtonText}>Back to Library</Text></Pressable></View>;

  const book = assembleBook(project, studio);
  const snapshot = getJourneySnapshot(project);
  const imageConfig = getImageSystemConfig(project.type);
  const projectImages = project.images ?? [];
  const updateStudio = (changes: Partial<BookStudioState>) => { const next = { ...studio, ...changes }; setStudio(next); onUpdateProject(project.title, { studio: next }); };
  const changeSection = (nextSection: StudioSection) => { setSection(nextSection); updateStudio({ lastSection: nextSection }); };
  const openWritingPart = (key: string) => { const originalIndex = getWriteParts(project, snapshot.blueprint).findIndex((part) => part.key === key); onUpdateProject(project.title, { plan: { ...project.plan, writeIndex: Math.max(0, originalIndex) } }); onPage('Write'); };
  const refreshPreview = () => updateStudio({ lastSection: section });
  const toggleIncluded = (group: 'frontMatterIncluded' | 'backMatterIncluded', id: string) => updateStudio({ [group]: { ...studio[group], [id]: !studio[group][id] } } as Partial<BookStudioState>);
  const updateText = (group: 'frontMatterText' | 'backMatterText', id: string, value: string) => updateStudio({ [group]: { ...studio[group], [id]: value } } as Partial<BookStudioState>);
  const addStudioImage = () => requestImage(project, (asset) => onUpdateProject(project.title, { images: [...projectImages, makeBookezImage(project, asset)] }));
  const replaceStudioImage = (image: BookezImage) => requestImage(project, (asset) => onUpdateProject(project.title, { images: projectImages.map((item) => item.id === image.id ? { ...item, ...makeBookezImage(project, asset, item.connectedPartKey), id: item.id, title: item.title, caption: item.caption, altText: item.altText, credit: item.credit, placement: item.placement, includeInExport: item.includeInExport, referenceOnly: item.referenceOnly, connectedPartKey: item.connectedPartKey, updatedAt: Date.now() } : item) }));
  const updateStudioImage = (id: string, changes: Partial<BookezImage>) => onUpdateProject(project.title, { images: projectImages.map((image) => image.id === id ? { ...image, ...changes, updatedAt: Date.now() } : image) });
  const removeStudioImage = (id: string) => { onUpdateProject(project.title, { images: projectImages.filter((image) => image.id !== id) }); setPreviewImageId(null); };
  const renderChapterVisuals = (chapter: AssembledChapter) => {
    const visuals = chapter.images.length ? chapter.images : imageConfig.mode === 'IMAGE_LED' && imageConfig.placeholders ? [undefined] : [];
    const hasBackCover = chapter.key === book.chapters[book.chapters.length - 1]?.key && book.images.some((image) => image.placement === 'backCover');
    if (!visuals.length && !hasBackCover) return null;
    return <View style={imagePreviewS.chapterVisuals}>{visuals.map((image, index) => <ImagePreview key={image?.id ?? `placeholder-${chapter.key}-${index}`} image={image} config={imageConfig} placeholderLabel={image ? undefined : 'Illustration needed'} onPress={() => image ? (setPreviewImageId(image.id), setSection('assemble')) : addStudioImage()} />)}{chapter.key === book.chapters[book.chapters.length - 1]?.key && renderBackCoverVisual()}</View>;
  };
  const renderBackCoverVisual = () => {
    const image = book.images.find((item) => item.placement === 'backCover');
    return image ? <View style={imagePreviewS.backCover}><Text style={imagePreviewS.backCoverLabel}>BACK COVER</Text><ImagePreview image={image} config={imageConfig} onPress={() => { setPreviewImageId(image.id); setSection('assemble'); }} /></View> : null;
  };
  const moveChapter = (index: number, direction: -1 | 1) => { const keys = book.chapters.map((chapter) => chapter.key); const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= keys.length) return; [keys[index], keys[nextIndex]] = [keys[nextIndex], keys[index]]; updateStudio({ chapterOrder: keys }); };
  const shareBook = async () => { const text = buildBookText(book); if (!text) { Alert.alert('Nothing to export yet', 'Write at least one part before sharing this book.'); return; } try { await Share.share({ title: project.title, message: text }); updateStudio({ exportedAt: Date.now() }); } catch { Alert.alert('Export unavailable', 'Your device could not open the share sheet.'); } };
  const speechSegments = book.chapters.filter((chapter) => chapter.content).map((chapter) => ({ label: chapter.title, text: chapter.content }));
  const speakSegments = (segments: { label: string; text: string }[], startIndex = 0) => {
    const run = speechRun.current + 1; speechRun.current = run; Speech.stop();
    const speakAt = (segmentIndex: number, chunkIndex = 0) => {
      if (speechRun.current !== run || segmentIndex >= segments.length) { if (speechRun.current === run) { setIsSpeaking(false); setSpeakingLabel(''); } return; }
      const chunks = splitSpeechText(segments[segmentIndex].text);
      if (chunkIndex === 0) setSpeakingLabel(segments[segmentIndex].label);
      Speech.speak(chunks[chunkIndex], { rate: 0.95, onStart: () => setIsSpeaking(true), onDone: () => chunkIndex + 1 < chunks.length ? speakAt(segmentIndex, chunkIndex + 1) : speakAt(segmentIndex + 1), onError: () => { setIsSpeaking(false); setSpeakingLabel(''); } });
    };
    if (!segments.length) { Alert.alert('Nothing to listen to yet', 'Write at least one part before starting read-aloud.'); return; }
    speakAt(Math.min(startIndex, segments.length - 1));
  };
  const stopSpeaking = () => { speechRun.current += 1; Speech.stop(); setIsSpeaking(false); setSpeakingLabel(''); };
  const accordion = (id: string, title: string, hint: string, content: React.ReactNode) => <View style={s.studioAccordion}><Pressable onPress={() => setOpenAccordion(openAccordion === id ? null : id)} style={s.studioAccordionHeader}><View style={s.studioAccordionIcon}><Text style={s.studioAccordionIconText}>{openAccordion === id ? '−' : '+'}</Text></View><View style={s.studioAccordionCopy}><Text style={s.studioAccordionTitle}>{title}</Text><Text style={s.studioAccordionHint}>{hint}</Text></View><Text style={s.studioAccordionChevron}>{openAccordion === id ? '⌃' : '⌄'}</Text></Pressable>{openAccordion === id && <View style={s.studioAccordionBody}>{content}</View>}</View>;
  const renderAssemble = () => <><ImageSystemCard project={project} images={projectImages} onAddImage={addStudioImage} onReplaceImage={replaceStudioImage} onUpdateImage={updateStudioImage} onRemoveImage={removeStudioImage} onEnableImages={() => onUpdateProject(project.title, { imageEnabled: true })} initialExpandedId={previewImageId} emptyLabel={`Add ${imageConfig.itemLabel} to Book Studio`} /><View style={s.studioSummaryCard}><View><Text style={s.studioKicker}>ASSEMBLED BOOK</Text><Text style={s.studioSummaryTitle}>{book.totalWords ? `${formatCount(book.totalWords)} words ready to read` : 'Your book is waiting for words'}</Text><Text style={s.studioSummaryCopy}>{book.chapters.length} planned parts · {book.chapters.filter((chapter) => chapter.complete).length} drafted · {book.status === 'finished' ? 'Finished manuscript' : 'Draft in progress'}</Text></View><View style={[s.studioStatusDot, book.status === 'finished' && s.studioStatusDotFinished]}><Text style={s.studioStatusDotText}>{book.status === 'finished' ? '✓' : '•'}</Text></View></View>
    {accordion('order', 'Book order', 'Arrange the manuscript without changing its content.', <>{book.chapters.map((chapter, index) => <View key={chapter.key} style={s.studioOrderRow}><View style={s.studioOrderNumber}><Text style={s.studioOrderNumberText}>{String(index + 1).padStart(2, '0')}</Text></View><View style={s.studioOrderCopy}><Text style={s.studioOrderTitle}>{chapter.title}</Text><Text style={s.studioOrderMeta}>{chapter.complete ? `${formatCount(chapter.words)} words` : 'Missing content'}</Text></View><Pressable onPress={() => moveChapter(index, -1)} disabled={index === 0} style={[s.studioMoveButton, index === 0 && s.studioMoveDisabled]}><Text style={s.studioMoveText}>↑</Text></Pressable><Pressable onPress={() => moveChapter(index, 1)} disabled={index === book.chapters.length - 1} style={[s.studioMoveButton, index === book.chapters.length - 1 && s.studioMoveDisabled]}><Text style={s.studioMoveText}>↓</Text></Pressable><Pressable onPress={() => openWritingPart(chapter.key)} style={s.studioOpenWrite}><Text style={s.studioOpenWriteText}>Write</Text></Pressable></View>)}</>)}
    {accordion('front', 'Front matter', 'Optional pages before the manuscript.', <>{studioFrontMatter.map((item) => <View key={item.id} style={s.studioMatterRow}><Pressable onPress={() => toggleIncluded('frontMatterIncluded', item.id)} style={[s.studioCheck, studio.frontMatterIncluded[item.id] && s.studioCheckOn]}><Text style={s.studioCheckText}>{studio.frontMatterIncluded[item.id] ? '✓' : ''}</Text></Pressable><View style={s.studioMatterCopy}><Text style={s.studioMatterTitle}>{item.label}</Text><Text style={s.studioMatterMeta}>{item.automatic ? 'Generated from this book' : studio.frontMatterIncluded[item.id] ? (studio.frontMatterText[item.id] ? 'Ready' : 'Needs text') : 'Not included'}</Text>{studio.frontMatterIncluded[item.id] && !item.automatic && <TextInput value={studio.frontMatterText[item.id]} onChangeText={(value) => updateText('frontMatterText', item.id, value)} multiline placeholder={`Add ${item.label.toLowerCase()}…`} placeholderTextColor="#9A9DB7" style={s.studioMatterInput} />}</View></View>)}</>)}
    {accordion('manuscript', 'Manuscript', 'Only planned parts and their real drafts appear here.', <>{book.chapters.map((chapter) => <View key={chapter.key} style={s.studioManuscriptRow}><View style={[s.studioManuscriptDot, chapter.complete && s.studioManuscriptDotComplete]}><Text style={s.studioManuscriptDotText}>{chapter.complete ? '✓' : '·'}</Text></View><View style={s.studioOrderCopy}><Text style={s.studioOrderTitle}>{chapter.title}</Text><Text style={s.studioOrderMeta}>{chapter.complete ? `${formatCount(chapter.words)} words in the assembled manuscript` : 'No draft yet — this part stays out of the preview'}</Text></View><Pressable onPress={() => openWritingPart(chapter.key)} style={s.studioOpenWrite}><Text style={s.studioOpenWriteText}>{chapter.complete ? 'Edit' : 'Write'}</Text></Pressable></View>)}</>)}
    {accordion('back', 'Back matter', 'Optional pages after the manuscript.', <>{studioBackMatter.map((item) => <View key={item.id} style={s.studioMatterRow}><Pressable onPress={() => toggleIncluded('backMatterIncluded', item.id)} style={[s.studioCheck, studio.backMatterIncluded[item.id] && s.studioCheckOn]}><Text style={s.studioCheckText}>{studio.backMatterIncluded[item.id] ? '✓' : ''}</Text></Pressable><View style={s.studioMatterCopy}><Text style={s.studioMatterTitle}>{item.label}</Text><Text style={s.studioMatterMeta}>{studio.backMatterIncluded[item.id] ? (studio.backMatterText[item.id] ? 'Ready' : 'Needs text') : 'Not included'}</Text>{studio.backMatterIncluded[item.id] && <TextInput value={studio.backMatterText[item.id]} onChangeText={(value) => updateText('backMatterText', item.id, value)} multiline placeholder={`Add ${item.label.toLowerCase()}…`} placeholderTextColor="#9A9DB7" style={s.studioMatterInput} />}</View></View>)}</>)}
    {accordion('appearance', 'Appearance', 'Formatting used by the read preview.', <><View style={s.studioControlRow}><Text style={s.studioControlLabel}>Font size</Text><View style={s.studioControlOptions}><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, fontSize: 15 } })} style={[s.studioOption, studio.appearance.fontSize === 15 && s.studioOptionSelected]}><Text style={s.studioOptionText}>Small</Text></Pressable><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, fontSize: 18 } })} style={[s.studioOption, studio.appearance.fontSize === 18 && s.studioOptionSelected]}><Text style={s.studioOptionText}>Large</Text></Pressable></View></View><View style={s.studioControlRow}><Text style={s.studioControlLabel}>Heading style</Text><View style={s.studioControlOptions}><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, headingStyle: 'classic' } })} style={[s.studioOption, studio.appearance.headingStyle === 'classic' && s.studioOptionSelected]}><Text style={s.studioOptionText}>Classic</Text></Pressable><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, headingStyle: 'modern' } })} style={[s.studioOption, studio.appearance.headingStyle === 'modern' && s.studioOptionSelected]}><Text style={s.studioOptionText}>Modern</Text></Pressable></View></View><View style={s.studioControlRow}><Text style={s.studioControlLabel}>Alignment</Text><View style={s.studioControlOptions}><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, alignment: 'left' } })} style={[s.studioOption, studio.appearance.alignment === 'left' && s.studioOptionSelected]}><Text style={s.studioOptionText}>Left</Text></Pressable><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, alignment: 'center' } })} style={[s.studioOption, studio.appearance.alignment === 'center' && s.studioOptionSelected]}><Text style={s.studioOptionText}>Center</Text></Pressable></View></View></>)}
    <Pressable onPress={refreshPreview} style={s.studioPrimaryButton}><Text style={s.studioPrimaryButtonText}>Refresh book preview</Text><Text style={s.studioPrimaryButtonArrow}>↗</Text></Pressable></>;
  const renderRead = () => <><View style={s.readerToolbar}><View><Text style={s.studioKicker}>READ PREVIEW</Text><Text style={s.readerToolbarTitle}>{book.totalWords ? `${formatCount(book.totalWords)} words` : 'No drafted content yet'}</Text></View><Pressable onPress={() => changeSection('listen')} style={s.readerListenButton}><Text style={s.readerListenText}>◷ Listen</Text></Pressable></View><View style={s.readerToc}><Text style={s.readerTocTitle}>In this book</Text>{book.chapters.map((chapter, index) => <Pressable key={chapter.key} onPress={() => setReaderIndex(index)} style={[s.readerTocRow, readerIndex === index && s.readerTocRowSelected]}><Text style={s.readerTocNumber}>{String(index + 1).padStart(2, '0')}</Text><Text numberOfLines={1} style={s.readerTocLabel}>{chapter.title}</Text><Text style={s.readerTocState}>{chapter.complete ? '✓' : '—'}</Text></Pressable>)}</View><View style={s.readerBook}><View style={s.readerTitlePage}><Text style={s.readerTitleKicker}>BOOKEZ STUDIO</Text>{book.images.find((image) => image.placement === 'cover') && <ImagePreview image={book.images.find((image) => image.placement === 'cover')} config={imageConfig} onPress={() => { setPreviewImageId(book.images.find((image) => image.placement === 'cover')?.id ?? null); setSection('assemble'); }} />}<Text style={[s.readerBookTitle, studio.appearance.headingStyle === 'modern' && s.readerBookTitleModern]}>{book.title}</Text><Text style={s.readerBookStatus}>{book.status === 'finished' ? 'Finished manuscript' : 'Work in progress'}</Text></View>{book.frontMatter.filter((item) => item.included && item.id !== 'titlePage' && item.id !== 'tableOfContents').map((item) => <View key={item.id} style={s.readerMatter}><Text style={s.readerMatterTitle}>{item.label}</Text><Text style={[s.readerBody, { textAlign: studio.appearance.alignment }]}>{item.content}</Text></View>)}{book.chapters.map((chapter, index) => <View key={chapter.key} style={s.readerChapter}><Text style={[s.readerChapterTitle, studio.appearance.headingStyle === 'modern' && s.readerChapterTitleModern]}>{chapter.title}</Text>{renderChapterVisuals(chapter)}{chapter.content ? chapter.content.split(/\n\s*\n/).map((paragraph, paragraphIndex) => <Text key={`${chapter.key}-${paragraphIndex}`} style={[s.readerBody, { fontSize: studio.appearance.fontSize, lineHeight: studio.appearance.fontSize * studio.appearance.lineSpacing, marginBottom: studio.appearance.paragraphSpacing, textAlign: studio.appearance.alignment }]}>{paragraph}</Text>) : <View style={s.readerMissing}><Text style={s.readerMissingIcon}>⌁</Text><Text style={s.readerMissingTitle}>This part is not drafted yet.</Text><Text style={s.readerMissingCopy}>It is intentionally left out of the reading flow until you write it.</Text><Pressable onPress={() => openWritingPart(chapter.key)} style={s.readerWriteButton}><Text style={s.readerWriteButtonText}>Open in Write</Text></Pressable></View>}</View>)}{book.backMatter.filter((item) => item.included).map((item) => <View key={item.id} style={s.readerMatter}><Text style={s.readerMatterTitle}>{item.label}</Text><Text style={[s.readerBody, { textAlign: studio.appearance.alignment }]}>{item.content}</Text></View>)}</View></>;
  const renderListen = () => <><View style={s.listenHero}><View style={s.listenOrb}><Text style={s.listenOrbText}>{isSpeaking ? '◷' : '♫'}</Text></View><View style={s.listenHeroCopy}><Text style={s.studioKicker}>READ ALOUD</Text><Text style={s.listenTitle}>{isSpeaking ? `Listening to ${speakingLabel}` : 'Hear the book take shape.'}</Text><Text style={s.listenCopy}>Uses your device’s built-in voice and the same drafted manuscript shown in Read.</Text></View></View><View style={s.listenControls}><Pressable onPress={isSpeaking ? stopSpeaking : () => speakSegments(speechSegments)} style={[s.studioPrimaryButton, isSpeaking && s.studioStopButton]}><Text style={s.studioPrimaryButtonText}>{isSpeaking ? 'Stop listening' : 'Listen to book'}</Text><Text style={s.studioPrimaryButtonArrow}>{isSpeaking ? '×' : '▶'}</Text></Pressable><Text style={s.listenNote}>On iPhone, turn off silent mode to hear speech.</Text></View><Text style={s.studioSectionTitle}>Drafted parts</Text>{book.chapters.map((chapter) => <View key={chapter.key} style={s.listenRow}><View style={s.listenRowIcon}><Text style={s.listenRowIconText}>{chapter.complete ? '♫' : '—'}</Text></View><View style={s.studioOrderCopy}><Text style={s.studioOrderTitle}>{chapter.title}</Text><Text style={s.studioOrderMeta}>{chapter.complete ? `${formatCount(chapter.words)} words` : 'Not available until drafted'}</Text></View>{chapter.complete && <Pressable onPress={() => speakSegments([{ label: chapter.title, text: chapter.content }])} style={s.listenRowButton}><Text style={s.listenRowButtonText}>Listen</Text></Pressable>}</View>)}</>;
  const renderExport = () => <><View style={s.exportHero}><Text style={s.studioKicker}>EXPORT</Text><Text style={s.exportTitle}>Take the book with you.</Text><Text style={s.exportCopy}>Bookez can share the assembled manuscript as plain text using your device’s share sheet. PDF, EPUB, and DOCX are not available in this build.</Text></View><View style={s.exportStats}><View><Text style={s.exportStatValue}>{formatCount(book.totalWords)}</Text><Text style={s.exportStatLabel}>WORDS</Text></View><View style={s.exportStatDivider} /><View><Text style={s.exportStatValue}>{book.chapters.filter((chapter) => chapter.complete).length}/{book.chapters.length}</Text><Text style={s.exportStatLabel}>PARTS DRAFTED</Text></View></View><Pressable onPress={shareBook} style={s.studioPrimaryButton}><Text style={s.studioPrimaryButtonText}>Share plain-text book</Text><Text style={s.studioPrimaryButtonArrow}>↗</Text></Pressable><Text style={s.exportFootnote}>The share sheet lets you send the current assembled text to another app or save it where your device supports it.</Text></>;

  return <View style={s.studioPage}><View style={s.studioHeader}><Pressable onPress={onBack} style={s.studioBackButton} accessibilityLabel="Back to Library"><Text style={s.studioBackIcon}>‹</Text></Pressable><Pressable onPress={() => setPickerOpen(true)} style={s.studioHeaderCopy}><Text style={s.studioOverline}>BOOKEZ / BOOK STUDIO</Text><Text numberOfLines={1} style={s.studioHeaderTitle}>{project.title}</Text><Text style={s.studioHeaderMeta}>{snapshot.stage} · {snapshot.progressPercent}% · {project.updatedAt ? `Saved ${formatLastEdited(project.updatedAt)}` : 'Local draft'}</Text></Pressable><Pressable onPress={() => setMenuOpen(true)} style={s.studioOverflowButton} accessibilityLabel="Open Book Studio menu"><Text style={s.studioOverflowText}>•••</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.studioTabs}>{(['assemble', 'read', 'listen', 'export'] as StudioSection[]).map((item) => <Pressable key={item} onPress={() => changeSection(item)} style={[s.studioTab, section === item && s.studioTabSelected]}><Text style={[s.studioTabText, section === item && s.studioTabTextSelected]}>{item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</ScrollView>{section === 'assemble' ? renderAssemble() : section === 'read' ? renderRead() : section === 'listen' ? renderListen() : renderExport()}
    <Modal animationType="fade" visible={menuOpen} transparent onRequestClose={() => setMenuOpen(false)}><Pressable style={s.studioMenuShade} onPress={() => setMenuOpen(false)}><View style={s.studioMenu}><Text style={s.libraryMenuOverline}>THIS BOOK</Text><Text numberOfLines={1} style={s.libraryMenuTitle}>{project.title}</Text><Pressable onPress={() => { setMenuOpen(false); openWritingPart(book.chapters[readerIndex]?.key ?? book.chapters[0]?.key ?? ''); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>✎</Text><Text style={s.libraryMenuLabel}>Continue writing</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); onPage('Journey'); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>✦</Text><Text style={s.libraryMenuLabel}>View journey</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); changeSection('read'); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>◌</Text><Text style={s.libraryMenuLabel}>Review book</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); changeSection('export'); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>↗</Text><Text style={s.libraryMenuLabel}>Export</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); refreshPreview(); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>⟳</Text><Text style={s.libraryMenuLabel}>Refresh preview</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable></View></Pressable></Modal>
    <Modal animationType="slide" visible={pickerOpen} transparent onRequestClose={() => setPickerOpen(false)}><View style={s.studioPickerShade}><Pressable style={s.studioPickerDismiss} onPress={() => setPickerOpen(false)} /><View style={s.studioPickerSheet}><View style={s.sheetHandle} /><Text style={s.studioPickerOverline}>YOUR BOOKS</Text><Text style={s.studioPickerTitle}>Switch book</Text>{projects.map((item) => <Pressable key={item.title} onPress={() => { setPickerOpen(false); onSelectProject(item.title); onOpenBookStudio(item.title, section); }} style={[s.studioPickerRow, item.title === project.title && s.studioPickerRowSelected]}><View style={[s.studioPickerMark, { backgroundColor: item.color }]}><Text style={s.studioPickerMarkText}>{item.mark}</Text></View><View style={s.studioPickerCopy}><Text numberOfLines={1} style={s.studioPickerBookTitle}>{item.title}</Text><Text style={s.studioPickerBookMeta}>{item.type}</Text></View>{item.title === project.title && <Text style={s.studioPickerCheck}>✓</Text>}</Pressable>)}</View></View></Modal>
  </View>;
}

type LegalDocument = 'privacy' | 'terms';
type AccountAction = 'logout' | 'delete';
type ProfileReminder = { id: string; label: string; time: string; days: number[]; enabled: boolean };

function Profile({ projects, onLogout, onDeleteAccount }: { projects: Project[]; onLogout: () => void; onDeleteAccount: () => void }) {
  const [reminders, setReminders] = useState(true); const [cloud, setCloud] = useState(true);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [expandedReminderId, setExpandedReminderId] = useState('weekday-writing');
  const [profileReminders, setProfileReminders] = useState<ProfileReminder[]>([{ id: 'weekday-writing', label: 'Writing session', time: '7:00 PM', days: [1, 2, 3, 4, 5], enabled: true }]);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);
  const isPrivacy = legalDocument === 'privacy';
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const selectedBadges = getWriterAchievements(projects).filter((achievement) => achievement.completed).slice(-3).reverse();

  const updateProfileReminder = (id: string, changes: Partial<ProfileReminder>) => setProfileReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, ...changes } : reminder));
  const toggleProfileReminderDay = (id: string, day: number) => setProfileReminders((current) => current.map((reminder) => {
    if (reminder.id !== id) return reminder;
    if (reminder.days.includes(day) && reminder.days.length === 1) return reminder;
    const days = reminder.days.includes(day) ? reminder.days.filter((item) => item !== day) : [...reminder.days, day].sort((a, b) => a - b);
    return { ...reminder, days };
  }));
  const addProfileReminder = () => {
    const id = `reminder-${Date.now()}`;
    setProfileReminders((current) => [...current, { id, label: 'Writing session', time: '8:00 AM', days: [1, 2, 3, 4, 5], enabled: true }]);
    setExpandedReminderId(id);
    setReminders(true);
    setNotificationPanelOpen(true);
  };
  const removeProfileReminder = (id: string) => {
    setProfileReminders((current) => current.filter((reminder) => reminder.id !== id));
    if (expandedReminderId === id) setExpandedReminderId('');
  };

  const confirmAccountAction = () => {
    const action = accountAction;
    setAccountAction(null);
    if (action === 'logout') onLogout();
    if (action === 'delete') onDeleteAccount();
  };

  return <><View style={s.profileTop}><View style={s.profileAvatar}><Text style={s.profileAvatarText}>L</Text><View style={s.profileHalo} /></View><Text style={s.profileName}>Lena Morris</Text><Text style={s.profileEmail}>lena@bookez.studio</Text><View style={s.pathfinder}><Text style={s.pathfinderText}>✦ PATHFINDER</Text></View></View>
    <View style={s.profileBadgesCard}><View style={s.profileBadgesHeader}><View><Text style={s.profileBadgesEyebrow}>SELECTED BADGES</Text><Text style={s.profileBadgesTitle}>Your writing wins</Text></View><Text style={s.profileBadgesCount}>{selectedBadges.length ? `${selectedBadges.length} earned` : 'Keep writing'}</Text></View>{selectedBadges.length ? <View style={s.profileBadgesRow}>{selectedBadges.map((achievement) => <View key={achievement.id} style={s.profileBadge}><View style={s.profileBadgeIcon}><Text style={s.profileBadgeIconText}>{achievement.icon}</Text></View><Text numberOfLines={2} style={s.profileBadgeTitle}>{achievement.title}</Text></View>)}</View> : <Text style={s.profileBadgesEmpty}>Your first milestone will become a badge here.</Text>}</View>
    <Text style={s.preferenceTitle}>Your space</Text>
    <View style={s.preferences}><View style={s.prefRow}><View><Text style={s.prefTitle}>Writing reminders</Text><Text style={s.prefSub}>A gentle nudge each evening</Text></View><Switch value={reminders} onValueChange={setReminders} trackColor={{ false: '#D7D9E6', true: '#BAB6F1' }} thumbColor={reminders ? C.periwinkle : '#FFF'} /></View><View style={s.prefLine} /><View style={s.prefRow}><View><Text style={s.prefTitle}>Cloud backup</Text><Text style={s.prefSub}>Keep every chapter safe</Text></View><Switch value={cloud} onValueChange={setCloud} trackColor={{ false: '#D7D9E6', true: '#B7DAB9' }} thumbColor={cloud ? '#75AF80' : '#FFF'} /></View></View>
    <Text style={s.preferenceTitle}>Notifications</Text>
    <View style={s.notificationPanel}>
      <Pressable onPress={() => setNotificationPanelOpen(!notificationPanelOpen)} style={s.notificationPanelHeader} accessibilityRole="button" accessibilityLabel={notificationPanelOpen ? 'Close notification controls' : 'Open notification controls'}><View style={s.notificationBell}><Text style={s.notificationBellText}>◷</Text></View><View style={s.notificationHeaderCopy}><Text style={s.notificationTitle}>Writing reminders</Text><Text style={s.notificationSub}>{profileReminders.length} reminder{profileReminders.length === 1 ? '' : 's'} · choose your days and times</Text></View><Switch value={reminders} onValueChange={(value) => { setReminders(value); if (value) setNotificationPanelOpen(true); }} trackColor={{ false: '#D7D9E6', true: '#BAB6F1' }} thumbColor={reminders ? C.periwinkle : '#FFF'} /></Pressable>
      {notificationPanelOpen && <View style={s.notificationPanelBody}><Text style={s.notificationPanelHint}>Make the rhythm fit your week. Add as many reminders as you need.</Text>{reminders ? profileReminders.map((reminder) => { const expanded = expandedReminderId === reminder.id; return <View key={reminder.id} style={[s.notificationReminder, expanded && s.notificationReminderExpanded]}><Pressable onPress={() => setExpandedReminderId(expanded ? '' : reminder.id)} style={s.notificationReminderSummary} accessibilityRole="button" accessibilityLabel={`${reminder.label}, ${reminder.time}`}><View style={[s.notificationReminderIcon, reminder.enabled && s.notificationReminderIconActive]}><Text style={s.notificationReminderIconText}>◷</Text></View><View style={s.notificationReminderCopy}><Text numberOfLines={1} style={s.notificationReminderLabel}>{reminder.label || 'Untitled reminder'}</Text><Text style={s.notificationReminderMeta}>{reminder.time} · {reminder.days.length === 7 ? 'Every day' : reminder.days.map((day) => dayLabels[day]).join('')}</Text></View><Switch value={reminder.enabled} onValueChange={(value) => updateProfileReminder(reminder.id, { enabled: value })} trackColor={{ false: '#D7D9E6', true: '#BAB6F1' }} thumbColor={reminder.enabled ? C.periwinkle : '#FFF'} /><Text style={s.notificationReminderChevron}>{expanded ? '⌃' : '⌄'}</Text></Pressable>{expanded && <View style={s.notificationReminderEditor}><Text style={s.notificationFieldLabel}>REMINDER NAME</Text><TextInput value={reminder.label} onChangeText={(value) => updateProfileReminder(reminder.id, { label: value })} placeholder="Writing session" placeholderTextColor="#A0A3BB" style={s.notificationInput} accessibilityLabel="Reminder name" /><Text style={s.notificationFieldLabel}>TIME</Text><TextInput value={reminder.time} onChangeText={(value) => updateProfileReminder(reminder.id, { time: value })} placeholder="e.g. 7:00 PM" placeholderTextColor="#A0A3BB" style={s.notificationInput} accessibilityLabel="Reminder time" /><Text style={s.notificationFieldLabel}>DAYS OF THE WEEK</Text><View style={s.notificationDaysRow}>{dayLabels.map((label, day) => <Pressable key={`${reminder.id}-${day}`} onPress={() => toggleProfileReminderDay(reminder.id, day)} style={[s.notificationDay, reminder.days.includes(day) && s.notificationDayActive]} accessibilityLabel={`${reminder.days.includes(day) ? 'Remove' : 'Add'} ${dayNames[day]}`}><Text style={[s.notificationDayText, reminder.days.includes(day) && s.notificationDayTextActive]}>{label}</Text></Pressable>)}</View><View style={s.notificationReminderActions}><Text style={s.notificationReminderDaysHint}>{reminder.days.length ? reminder.days.length === 7 ? 'Every day' : `${reminder.days.length} days selected` : 'Choose at least one day'}</Text><Pressable onPress={() => removeProfileReminder(reminder.id)} style={s.notificationRemoveButton}><Text style={s.notificationRemoveText}>Remove</Text></Pressable></View></View>}</View>; }) : <Text style={s.notificationDisabledCopy}>Reminders are paused. Turn them on whenever you want a gentle nudge.</Text>}<Pressable onPress={addProfileReminder} style={s.notificationAddButton} accessibilityRole="button"><Text style={s.notificationAddIcon}>＋</Text><Text style={s.notificationAddText}>Add another reminder</Text></Pressable></View>}
    </View>
    <Text style={s.preferenceTitle}>Privacy & terms</Text>
    <View style={s.settingsCard}>
      <Pressable onPress={() => setLegalDocument('privacy')} style={s.settingsRow}><View style={s.settingsRowCopy}><View style={[s.settingsIcon, s.settingsIconBlue]}><Text style={s.settingsIconText}>⌁</Text></View><View><Text style={s.settingsText}>Privacy policy</Text><Text style={s.settingsSub}>How Bookez handles your writing</Text></View></View><Text style={s.chevron}>›</Text></Pressable>
      <View style={s.prefLine} />
      <Pressable onPress={() => setLegalDocument('terms')} style={s.settingsRow}><View style={s.settingsRowCopy}><View style={[s.settingsIcon, s.settingsIconGold]}><Text style={s.settingsIconText}>§</Text></View><View><Text style={s.settingsText}>Terms of service</Text><Text style={s.settingsSub}>The simple rules for using Bookez</Text></View></View><Text style={s.chevron}>›</Text></Pressable>
    </View>

    {__DEV__ && <><Text style={s.preferenceTitle}>Developer</Text><View style={s.settingsCard}><Pressable onPress={() => Sentry.captureException(new Error("Bookez Sentry test"))} style={s.settingsRow} accessibilityRole="button"><View style={s.settingsRowCopy}><View style={[s.settingsIcon, s.settingsIconBlue]}><Text style={s.settingsIconText}>⌁</Text></View><View><Text style={s.settingsText}>Send Sentry test</Text><Text style={s.settingsSub}>Development-only error event</Text></View></View><Text style={s.chevron}>›</Text></Pressable></View></>}

    <Text style={s.preferenceTitle}>Account</Text>
    <View style={s.accountCard}>
      <Pressable onPress={() => setAccountAction('delete')} style={s.accountActionRow}><View style={[s.settingsIcon, s.settingsIconCoral]}><Text style={s.settingsIconText}>×</Text></View><View style={s.settingsRowCopy}><Text style={s.deleteText}>Delete account</Text><Text style={s.settingsSub}>Permanently remove your account and drafts</Text></View><Text style={s.chevron}>›</Text></Pressable>
      <View style={s.prefLine} />
      <Pressable onPress={() => setAccountAction('logout')} style={s.accountActionRow}><View style={[s.settingsIcon, s.settingsIconSage]}><Text style={s.settingsIconText}>↗</Text></View><View style={s.settingsRowCopy}><Text style={s.settingsText}>Log out</Text><Text style={s.settingsSub}>Pause here and come back anytime</Text></View><Text style={s.chevron}>›</Text></Pressable>
    </View>
    <Text style={s.profileFootnote}>You stay in control of your words, always.</Text>

    <Modal animationType="slide" visible={legalDocument !== null} transparent onRequestClose={() => setLegalDocument(null)}>
      <View style={s.profileModalShade}><Pressable style={s.profileModalDismiss} onPress={() => setLegalDocument(null)} /><View style={s.legalSheet}><View style={s.sheetHandle} /><View style={s.legalHeader}><View><Text style={s.legalOverline}>BOOKEZ / {isPrivacy ? 'PRIVACY' : 'TERMS'}</Text><Text style={s.legalTitle}>{isPrivacy ? 'Privacy policy' : 'Terms of service'}</Text></View><Pressable onPress={() => setLegalDocument(null)} style={s.closeButton}><Text style={s.closeButtonText}>×</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.legalContent}>
        <Text style={s.legalUpdated}>Effective August 1, 2026</Text>
        {isPrivacy ? <><Text style={s.legalIntro}>Bookez is a quiet place to make things. This policy explains what we collect, why we use it, and the choices you have.</Text><Text style={s.legalSectionTitle}>What we collect</Text><Text style={s.legalBody}>We collect the account details you provide, like your name and email, plus the projects, plans, and drafts you save in Bookez.</Text><Text style={s.legalSectionTitle}>How we use it</Text><Text style={s.legalBody}>We use this information to provide the writing workspace, keep your projects in sync when cloud backup is on, and send reminders only when you choose them.</Text><Text style={s.legalSectionTitle}>Your choices</Text><Text style={s.legalBody}>You can turn reminders and cloud backup off in your profile. You can also request a copy of your data or delete your account at any time.</Text><Text style={s.legalSectionTitle}>Questions</Text><Text style={s.legalBody}>For privacy questions, contact hello@bookez.studio.</Text></> : <><Text style={s.legalIntro}>Bookez gives you a focused space for planning and writing. By using it, you agree to use the service thoughtfully and keep your account details secure.</Text><Text style={s.legalSectionTitle}>Your work is yours</Text><Text style={s.legalBody}>You keep ownership of the stories, notes, and other content you create in Bookez. Please only upload material you have the right to use.</Text><Text style={s.legalSectionTitle}>Using Bookez</Text><Text style={s.legalBody}>Please do not misuse the service, interfere with other writers, or use Bookez for unlawful activity. We may update features as the studio grows.</Text><Text style={s.legalSectionTitle}>Your account</Text><Text style={s.legalBody}>Keep your login details private. You can log out whenever you like or permanently delete your account from this page.</Text><Text style={s.legalSectionTitle}>Questions</Text><Text style={s.legalBody}>For questions about these terms, contact hello@bookez.studio.</Text></>}
      </ScrollView></View></View>
    </Modal>

    <Modal animationType="fade" visible={accountAction !== null} transparent onRequestClose={() => setAccountAction(null)}>
      <View style={s.profileModalShade}><Pressable style={s.profileModalDismiss} onPress={() => setAccountAction(null)} /><View style={s.confirmSheet}><View style={[s.confirmIcon, accountAction === 'delete' ? s.confirmIconDelete : s.confirmIconLogout]}><Text style={s.confirmIconText}>{accountAction === 'delete' ? '×' : '↗'}</Text></View><Text style={s.confirmTitle}>{accountAction === 'delete' ? 'Delete your account?' : 'Log out of Bookez?'}</Text><Text style={s.confirmCopy}>{accountAction === 'delete' ? 'This removes your account and all saved drafts. This action cannot be undone.' : 'Your projects will stay safe. You can sign back in whenever you are ready to write.'}</Text><Pressable onPress={confirmAccountAction} style={[s.confirmButton, accountAction === 'delete' && s.confirmButtonDelete]}><Text style={s.confirmButtonText}>{accountAction === 'delete' ? 'Delete account' : 'Log out'}</Text></Pressable><Pressable onPress={() => setAccountAction(null)} style={s.cancelButton}><Text style={s.cancelButtonText}>Keep my account</Text></Pressable></View></View>
    </Modal>
  </>;
}

function AccountExit({ deleted, onReturn }: { deleted: boolean; onReturn: () => void }) {
  return <View style={s.accountExit}><View style={[s.accountExitIcon, deleted ? s.confirmIconDelete : s.confirmIconLogout]}><Text style={s.confirmIconText}>{deleted ? '×' : '↗'}</Text></View><Text style={s.accountExitTitle}>{deleted ? 'Your account is gone.' : 'You’re all signed out.'}</Text><Text style={s.accountExitCopy}>{deleted ? 'This Bookez preview has no live account connection yet, so you can keep exploring the interface as a new visitor.' : 'Your writing space is paused until you sign back in.'}</Text><Pressable onPress={onReturn} style={s.accountExitButton}><Text style={s.accountExitButtonText}>Return to Bookez</Text><Text style={s.accountExitButtonArrow}>→</Text></Pressable></View>;
}

function Stats({ projects, activeProject, onSelectProject, onUpdateProject, onPage }: { projects: Project[]; activeProject: string; onSelectProject: (title: string) => void; onUpdateProject: (title: string, changes: Partial<Project>) => void; onPage: (page: Page) => void }) {
  const [range, setRange] = useState<StatsRange>('Week');
  const [scope, setScope] = useState<StatsScope>('overall');
  const currentProject = projects.find((project) => project.title === activeProject) ?? projects[0];
  const stats = scope === 'overall' ? getOverallStatsSnapshot(projects, range) : getStatsSnapshot(currentProject, range);
  const specializedStats = getProjectSpecializedStats(currentProject);
  const projectProgressStats = getProjectProgressStats(currentProject);
  const projectWritingStats = getProjectWritingStats(currentProject);
  const writerOverviewStats = getWriterOverviewStats(projects);
  const personalRecordStats = getPersonalRecordStats(projects);
  const projectMilestones = getProjectMilestones(currentProject);
  const writerAchievements = getWriterAchievements(projects);
  const nextWriterAchievement = writerAchievements.find((achievement) => !achievement.completed);
  const earnedProjectMilestones = projectMilestones.filter((achievement) => achievement.completed).length;
  const earnedWriterAchievements = writerAchievements.filter((achievement) => achievement.completed).length;
  const maxChartWords = Math.max(1, ...stats.chartRows.map((row) => row.words));
  const inputTotal = stats.dictationUses + stats.writingUses;
  const hasActivity = stats.entries.length > 0;
  const average = (value: number, suffix = '') => value ? `${value >= 10 ? Math.round(value) : value.toFixed(1)}${suffix}` : '—';

  return <>
    <View style={s.statsHero}><View style={s.statsHeroTop}><View style={{ flex: 1 }}><Text style={s.planHeroOverline}>YOUR WRITING RHYTHM</Text><Text style={s.statsTitle}>Small steps{`\n`}add up.</Text></View><Pressable onPress={() => onPage('Journey')} style={s.statsJourneyButton}><Text style={s.statsJourneyButtonText}>View Journey</Text><Text style={s.statsJourneyButtonArrow}>↗</Text></Pressable></View><Text numberOfLines={1} style={s.statsBookName}>{scope === 'overall' ? 'All your projects' : currentProject.title}</Text><View style={s.statsScopeToggle}><Pressable onPress={() => setScope('overall')} style={[s.statsScopeOption, scope === 'overall' && s.statsScopeOptionActive]}><Text style={[s.statsScopeOptionText, scope === 'overall' && s.statsScopeOptionTextActive]}>Overall</Text></Pressable><Pressable onPress={() => setScope('project')} style={[s.statsScopeOption, scope === 'project' && s.statsScopeOptionActive]}><Text style={[s.statsScopeOptionText, scope === 'project' && s.statsScopeOptionTextActive]}>Project-specific</Text></Pressable></View>{scope === 'project' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsProjectPicker}>{projects.map((project) => <Pressable key={project.title} onPress={() => onSelectProject(project.title)} style={[s.statsProjectOption, project.title === activeProject && s.statsProjectOptionActive]}><View style={[s.statsProjectOptionMark, { backgroundColor: project.color }]}><Text style={s.statsProjectOptionMarkText}>{project.mark}</Text></View><Text numberOfLines={1} style={[s.statsProjectOptionText, project.title === activeProject && s.statsProjectOptionTextActive]}>{project.title}</Text></Pressable>)}</ScrollView>}<View style={s.rangeRow}>{(['Week', 'Month', 'All time'] as StatsRange[]).map((item) => <Pill key={item} label={item} selected={range === item} onPress={() => setRange(item)} />)}</View></View>

    <View style={s.statsNumbers}><View style={s.statsHeadlineMetric}><Text style={s.bigNumber}>{stats.currentStreak || '—'}</Text><Text style={s.bigNumberLabel}>DAY STREAK</Text><Text style={s.statsMetricHint}>{stats.activeDays ? `${stats.activeDays} days here · ${stats.lifetimeActiveDays} lifetime` : 'Write to start a streak'}</Text></View><View style={s.statsHeadlineDivider} /><View style={s.statsHeadlineMetric}><Text style={s.bigNumber}>{formatCount(stats.journey.wordCount)}</Text><Text style={s.bigNumberLabel}>{scope === 'overall' ? 'TOTAL WORDS' : 'CURRENT WORDS'}</Text><Text style={s.statsMetricHint}>{scope === 'overall' ? 'across all projects' : `${stats.journey.progressPercent}% journey complete`}</Text></View></View>

    <View style={s.statsMetricGrid}><View style={[s.statsMetricCard, { backgroundColor: '#F3F0FF' }]}><Text style={s.statsMetricIcon}>✎</Text><Text style={s.statsMetricCardValue}>{average(stats.averageWords)}</Text><Text style={s.statsMetricCardLabel}>AVG WORDS / DAY</Text></View><View style={[s.statsMetricCard, { backgroundColor: '#FFF3E9' }]}><Text style={s.statsMetricIcon}>▤</Text><Text style={s.statsMetricCardValue}>{average(stats.averagePages)}</Text><Text style={s.statsMetricCardLabel}>AVG EST. PAGES / DAY</Text></View><View style={[s.statsMetricCard, { backgroundColor: '#EEF9EF' }]}><Text style={s.statsMetricIcon}>◷</Text><Text style={s.statsMetricCardValue}>{stats.averageMinutes ? formatDuration(stats.averageMinutes) : '—'}</Text><Text style={s.statsMetricCardLabel}>AVG ACTIVE / DAY</Text></View><View style={[s.statsMetricCard, { backgroundColor: '#EEF4FF' }]}><Text style={s.statsMetricIcon}>◌</Text><Text style={s.statsMetricCardValue}>{stats.completionAverage ? `${Math.round(stats.completionAverage)}%` : '—'}</Text><Text style={s.statsMetricCardLabel}>AVG % COMPLETED / DAY</Text></View></View>

    <View style={s.achievementSection}><View style={s.statsSectionHeader}><View><Text style={s.statsSectionTitle}>Achievements</Text><Text style={s.statsCardHint}>Completion wins for {currentProject.title}</Text></View><Text style={s.statsSectionCount}>{getProjectMilestones(currentProject).filter((achievement) => achievement.completed).length} earned</Text></View><View style={s.achievementCard}><AchievementList achievements={getProjectMilestones(currentProject)} /></View></View>

    <View style={s.chartCard}><View style={s.chartHeader}><View><Text style={s.chartTitle}>Words by day</Text><Text style={s.statsCardHint}>{range === 'Week' ? 'Last seven days' : range === 'Month' ? 'Last thirty days' : 'Logged writing days'}</Text></View><Text style={s.chartTotal}>{stats.totalLoggedWords ? formatCount(stats.totalLoggedWords) : '—'}</Text></View><View style={s.chart}>{stats.chartRows.map((row, index) => <View key={row.key} style={s.barCol}><View style={[s.bar, { height: row.words ? Math.max(7, Math.round((row.words / maxChartWords) * 95)) : 3 }, row.words > 0 && index === stats.chartRows.length - 1 && s.barActive]} /><Text style={s.barLabel}>{formatActivityDay(row.key)}</Text></View>)}</View>{!hasActivity && <Text style={s.statsEmptyHint}>No writing days logged yet. Your next manuscript session will start the rhythm here.</Text>}</View>

    <View style={s.statsSectionHeader}><View><Text style={s.statsSectionTitle}>Daily ledger</Text><Text style={s.statsCardHint}>Words, estimated pages, time, and completion</Text></View><Text style={s.statsSectionCount}>{stats.activeDays ? `${stats.activeDays} days` : 'No days yet'}</Text></View>
    {stats.dailyRows.length ? stats.dailyRows.map((entry) => <View key={entry.key} style={s.statsDayRow}><View style={s.statsDayCopy}><Text style={s.statsDayTitle}>{formatActivityDay(entry.key, true)}</Text><Text style={s.statsDaySub}>{formatDuration(entry.minutes)} active</Text></View><View style={s.statsDayMetric}><Text style={s.statsDayValue}>{formatCount(entry.words)}</Text><Text style={s.statsDayLabel}>WORDS</Text></View><View style={s.statsDayMetric}><Text style={s.statsDayValue}>{entry.pages ? entry.pages.toFixed(1) : '—'}</Text><Text style={s.statsDayLabel}>EST. PAGES</Text></View><View style={s.statsDayMetric}><Text style={s.statsDayValue}>{entry.completion ? `${Math.round(entry.completion)}%` : '—'}</Text><Text style={s.statsDayLabel}>DONE</Text></View></View>) : <View style={s.statsEmptyCard}><Text style={s.statsEmptyIcon}>⌁</Text><Text style={s.statsEmptyTitle}>Your daily record is waiting.</Text><Text style={s.statsEmptyCopy}>Start writing in the manuscript and Bookez will track your words, pace, pages, and progress by day.</Text></View>}

    <View style={s.statsBreakdownCard}><View style={s.statsSectionHeader}><View><Text style={s.statsSectionTitle}>How you write</Text><Text style={s.statsCardHint}>Input events in the selected range</Text></View><Text style={s.statsSectionCount}>{inputTotal ? `${inputTotal} events` : 'No events yet'}</Text></View>{inputTotal ? <><View style={s.inputMixTrack}><View style={[s.inputMixDictation, { width: `${stats.dictationPercent}%` }]} /><View style={[s.inputMixWriting, { width: `${stats.writingPercent}%` }]} /></View><View style={s.inputMixLegend}><View style={s.inputMixLegendItem}><View style={[s.inputMixDot, { backgroundColor: C.coral }]} /><Text style={s.inputMixLabel}>Dictation</Text><Text style={s.inputMixValue}>{stats.dictationPercent}%</Text></View><View style={s.inputMixLegendItem}><View style={[s.inputMixDot, { backgroundColor: C.periwinkle }]} /><Text style={s.inputMixLabel}>Keyboard / writing</Text><Text style={s.inputMixValue}>{stats.writingPercent}%</Text></View></View></> : <Text style={s.statsEmptyHint}>Tap the microphone or type in the manuscript to build this breakdown.</Text>}</View>

    {scope === 'project' && <><View style={s.specializedStatsCard}><Text style={s.specializedStatsEyebrow}>PROJECT PROGRESS</Text><Text style={s.specializedStatsTitle}>Where this book stands</Text><Text style={s.specializedStatsSubtitle}>Progress, planning, and the next finish line.</Text><View style={s.specializedStatsGrid}>{projectProgressStats.map((item) => <View key={item.label} style={s.specializedStat}><Text style={s.specializedStatLabel}>{item.label.toUpperCase()}</Text><Text style={s.specializedStatValue}>{item.value}</Text><Text style={s.specializedStatDetail}>{item.detail}</Text></View>)}</View></View><View style={[s.specializedStatsCard, s.specializedStatsCardWarm]}><Text style={s.specializedStatsEyebrow}>WRITING VOLUME & TIME</Text><Text style={s.specializedStatsTitle}>The work behind the progress</Text><Text style={s.specializedStatsSubtitle}>Words, focused time, pace, and consistency for this project.</Text><View style={s.specializedStatsGrid}>{projectWritingStats.map((item) => <View key={item.label} style={s.specializedStat}><Text style={s.specializedStatLabel}>{item.label.toUpperCase()}</Text><Text style={s.specializedStatValue}>{item.value}</Text><Text style={s.specializedStatDetail}>{item.detail}</Text></View>)}</View></View><View style={s.specializedStatsCard}><Text style={s.specializedStatsEyebrow}>PROJECT-SPECIFIC VIEW</Text><Text style={s.specializedStatsTitle}>{specializedStats.title}</Text><Text style={s.specializedStatsSubtitle}>{specializedStats.subtitle}</Text><View style={s.specializedStatsGrid}>{specializedStats.stats.map((item) => <View key={item.label} style={s.specializedStat}><Text style={s.specializedStatLabel}>{item.label.toUpperCase()}</Text><Text style={s.specializedStatValue}>{item.value}</Text><Text style={s.specializedStatDetail}>{item.detail}</Text></View>)}</View></View><View style={s.achievementSection}><View style={s.statsSectionHeader}><View><Text style={s.statsSectionTitle}>Milestones</Text><Text style={s.statsCardHint}>{currentProject.title} · progress markers for this book</Text></View><Text style={s.statsSectionCount}>{earnedProjectMilestones}/{projectMilestones.length}</Text></View><View style={s.achievementCard}><AchievementList achievements={projectMilestones} /></View></View></>}

    {scope === 'overall' && <View style={s.achievementSection}><View style={s.statsSectionHeader}><View><Text style={s.statsSectionTitle}>All-Time Achievements</Text><Text style={s.statsCardHint}>Progress across every Bookez project</Text></View><Text style={s.statsSectionCount}>{earnedWriterAchievements}/{writerAchievements.length}</Text></View><View style={s.achievementCardAllTime}><Text style={s.achievementSubsectionLabel}>YOUR WRITING TOTALS</Text><View style={s.achievementSummaryGrid}>{writerOverviewStats.map((item) => <View key={item.label} style={s.achievementSummaryItem}><Text style={s.achievementSummaryValue}>{item.value}</Text><Text style={s.achievementSummaryLabel}>{item.label}</Text><Text style={s.achievementSummaryDetail}>{item.detail}</Text></View>)}</View><Text style={s.achievementSubsectionLabel}>BADGES & MILESTONES</Text><AchievementList achievements={writerAchievements} />{nextWriterAchievement && <View style={s.nextAchievement}><Text style={s.nextAchievementIcon}>✦</Text><View style={s.nextAchievementCopy}><Text style={s.nextAchievementLabel}>NEXT UP</Text><Text style={s.nextAchievementTitle}>{nextWriterAchievement.title}</Text><Text style={s.nextAchievementDetail}>{nextWriterAchievement.detail}</Text></View></View>}<Text style={s.achievementSubsectionLabel}>PERSONAL RECORDS</Text><View style={s.personalRecordsGrid}>{personalRecordStats.map((item) => <View key={item.label} style={s.personalRecordItem}><Text style={s.personalRecordLabel}>{item.label.toUpperCase()}</Text><Text style={s.personalRecordValue}>{item.value}</Text><Text style={s.personalRecordDetail}>{item.detail}</Text></View>)}</View></View></View>}

    <ConditionalMediaStats projects={scope === 'overall' ? projects : [currentProject]} overall={scope === 'overall'} />
    <ConditionalCitationStats projects={scope === 'overall' ? projects : [currentProject]} overall={scope === 'overall'} />

    <CitationGenerator project={currentProject} onUpdateProject={onUpdateProject} />

    <View style={s.statsInsightCard}><Text style={s.statsInsightEyebrow}>A LITTLE SOMETHING TO NOTICE</Text>{stats.strongestDay ? <><Text style={s.statsInsightTitle}>Your strongest day was {formatActivityDay(stats.strongestDay.key, true)}.</Text><Text style={s.statsInsightCopy}>{formatCount(stats.strongestDay.words)} words, about {stats.strongestDay.pages.toFixed(1)} pages, with {Math.round(stats.strongestDay.completion)}% of the writing path complete.</Text></> : <><Text style={s.statsInsightTitle}>Your rhythm will reveal itself here.</Text><Text style={s.statsInsightCopy}>Once you have a writing day logged, you’ll see your strongest day and average active time per page.</Text></>}<View style={s.statsInsightMetric}><Text style={s.statsInsightMetricLabel}>AVG ACTIVE TIME / EST. PAGE</Text><Text style={s.statsInsightMetricValue}>{stats.averageMinutesPerPage ? formatDuration(stats.averageMinutesPerPage) : '—'}</Text></View></View>

    <Text style={s.preferenceTitle}>{scope === 'overall' ? 'All projects at a glance' : 'Book at a glance'}</Text><View style={s.statsBookCard}><View><Text style={s.statsBookCardLabel}>ESTIMATED MANUSCRIPT PAGES</Text><Text style={s.statsBookCardValue}>{stats.journey.wordCount ? `${(stats.journey.wordCount / 250).toFixed(1)}` : '—'}</Text></View><View style={s.statsBookCardDivider} /><View><Text style={s.statsBookCardLabel}>{scope === 'overall' ? 'WRITING UNITS WITH DRAFTS' : `${stats.journey.blueprint.unitLabelPlural.toUpperCase()} WITH DRAFTS`}</Text><Text style={s.statsBookCardValue}>{stats.journey.completedUnits} / {stats.journey.unitCount}</Text></View></View>
  </>;
}

function Navigation({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  return <View style={s.navShell}>{bottomNavPages.map((item) => <Pressable key={item} onPress={() => onPage(item)} style={s.navItem}><Text style={[s.navIcon, page === item && s.navIconActive]}>{pageMeta[item].icon}</Text><Text style={[s.navLabel, page === item && s.navLabelActive]}>{pageMeta[item].short}</Text></Pressable>)}</View>;
}

export default Sentry.wrap(function App() {
  const [page, setPage] = useState<Page>('Library');
  const [accountState, setAccountState] = useState<'active' | 'signedOut' | 'deleted'>('active');
  const [studioRoute, setStudioRoute] = useState<{ title: string; section: StudioSection }>({ title: 'The Midnight Atlas', section: 'assemble' });
  const [projects, setProjects] = useState<Project[]>([
    { title: 'The Midnight Atlas', color: C.periwinkle, mark: '✦', type: 'Fiction Book', pageGoal: '240', unitGoal: '24', plan: defaultPlanFor('Fiction Book') },
    { title: 'Letters to June', color: C.coral, mark: '✉', type: 'Memoir & Biography', pageGoal: '260', unitGoal: '18', plan: defaultPlanFor('Memoir & Biography') },
    { title: 'Wildflower Notes', color: C.sage, mark: '✳', type: 'Journal or Diary', pageGoal: '120', unitGoal: '30', plan: defaultPlanFor('Journal or Diary') },
  ]);
  const [storageReady, setStorageReady] = useState(false);
  const [activeProject, setActiveProject] = useState('The Midnight Atlas');
  useEffect(() => {
    Sentry.setTag('screen', page);
  }, [page]);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(projectStorageKey).then((saved) => {
      if (!mounted) return;
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { projects?: Project[]; activeProject?: string };
          if (Array.isArray(parsed.projects) && parsed.projects.length) setProjects(parsed.projects);
          if (parsed.activeProject) setActiveProject(parsed.activeProject);
        } catch {
          // Keep the in-memory starter projects when saved data is not readable.
        }
      }
      setStorageReady(true);
    }).catch(() => { if (mounted) setStorageReady(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    AsyncStorage.setItem(projectStorageKey, JSON.stringify({ projects, activeProject })).catch(() => undefined);
  }, [projects, activeProject, storageReady]);
  const updateProject = (title: string, changes: Partial<Project>) => setProjects((current) => current.map((project) => project.title === title ? { ...project, ...changes, updatedAt: Date.now() } : project));
  const openBookStudio = (title: string, section: StudioSection) => { setActiveProject(title); setStudioRoute({ title, section }); setPage('BookStudio'); };
  const returnFromAccount = () => {
    if (accountState === 'deleted') {
      setProjects([{ title: 'The Midnight Atlas', color: C.periwinkle, mark: '✦', type: 'Fiction Book', pageGoal: '240', unitGoal: '24', plan: defaultPlanFor('Fiction Book') }]);
      setActiveProject('The Midnight Atlas');
    }
    setAccountState('active');
  };
  const renderPage = () => {
    if (page === 'Library') return <Library projects={projects} activeProject={activeProject} onPage={setPage} onSelectProject={setActiveProject} onProjectsChange={setProjects} onOpenBookStudio={openBookStudio} />;
    if (page === 'Plan') return <Plan projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onUpdateProject={updateProject} onPage={setPage} />;
    if (page === 'Write') return <Write projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onUpdateProject={updateProject} onPage={setPage} />;
    if (page === 'Journey') return <Journey projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onUpdateProject={updateProject} onPage={setPage} onBack={() => setPage('Library')} onOpenBookStudio={openBookStudio} />;
    if (page === 'BookStudio') return <BookStudio projects={projects} project={projects.find((project) => project.title === studioRoute.title) ?? projects.find((project) => project.title === activeProject)} initialSection={studioRoute.section} onBack={() => setPage('Library')} onPage={setPage} onSelectProject={setActiveProject} onUpdateProject={updateProject} onOpenBookStudio={openBookStudio} />;
    if (page === 'Profile') return <Profile projects={projects} onLogout={() => { setAccountState('signedOut'); setPage('Library'); }} onDeleteAccount={() => { setProjects([]); setAccountState('deleted'); setPage('Library'); }} />;
    return <Stats projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onUpdateProject={updateProject} onPage={setPage} />;
  };
  return <><StatusBar style="dark" /><Ambient><SafeAreaView style={s.safe}>{accountState === 'active' ? <><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>{renderPage()}</ScrollView><Navigation page={page} onPage={setPage} /></> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}><AccountExit deleted={accountState === 'deleted'} onReturn={returnFromAccount} /></ScrollView>}</SafeAreaView></Ambient></>;
});

const rhythmS = StyleSheet.create({
  writeRhythmCardOrganized: { marginTop: 12, padding: 17, borderRadius: 24, backgroundColor: '#FFFEFC', borderWidth: 1, borderColor: '#E8E2D8', shadowColor: '#81798C', shadowOpacity: 0.09, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  writeRhythmMiniIconOnly: { marginTop: 11, width: 37, height: 37, borderRadius: 14, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EEFF', borderWidth: 1, borderColor: '#E4E0FC' }, modeLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.75, fontWeight: '700', marginTop: 15 }, modeGrid: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, modeChoice: { minHeight: 39, minWidth: '31%', flexGrow: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 11, backgroundColor: '#F6F4FA', borderWidth: 1, borderColor: '#E8E6F0', justifyContent: 'center' }, modeChoiceSelected: { backgroundColor: '#F0EDFF', borderColor: C.periwinkle }, modeChoiceText: { color: C.muted, fontSize: 9, fontWeight: '700' }, modeChoiceTextSelected: { color: C.periwinkle }, modeRecommended: { color: '#A97819', fontSize: 6, letterSpacing: 0.4, fontWeight: '700', marginTop: 3 }, customSessionRow: { marginTop: 9, flexDirection: 'row', gap: 7 }, customSessionField: { flex: 1, minHeight: 44, paddingHorizontal: 9, borderRadius: 11, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#E7E4F6', flexDirection: 'row', alignItems: 'center' }, customSessionLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.5, fontWeight: '700', marginRight: 5 }, customSessionInput: { flex: 1, color: C.ink, fontSize: 13, fontWeight: '700', paddingVertical: 5 }, customSessionUnit: { color: C.muted, fontSize: 7, fontWeight: '700' }, recommendationCard: { marginTop: 11, padding: 11, borderRadius: 14, backgroundColor: '#FFF6DB', borderWidth: 1, borderColor: '#F2E2B4' }, recommendationKicker: { color: '#A97819', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, recommendationText: { color: '#7E682F', fontSize: 9, lineHeight: 14, marginTop: 4 }, recommendationButton: { alignSelf: 'flex-start', marginTop: 8, minHeight: 29, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#FFF' }, recommendationButtonText: { color: '#A97819', fontSize: 8, fontWeight: '700' }, sessionPrompt: { marginTop: 11, padding: 11, borderRadius: 14, backgroundColor: '#EEF8FF', borderWidth: 1, borderColor: '#D8EDF8' }, sessionPromptKicker: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, sessionPromptTitle: { color: '#365D78', fontSize: 12, fontWeight: '700', marginTop: 4 }, sessionPromptInput: { minHeight: 35, marginTop: 7, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#FFF', color: C.ink, fontSize: 10, borderWidth: 1, borderColor: '#DDEBF3' }, sessionPromptActions: { marginTop: 9, flexDirection: 'row', gap: 6 }, sessionPromptPrimary: { minHeight: 32, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#4B7B9D', alignItems: 'center', justifyContent: 'center' }, sessionPromptPrimaryText: { color: '#FFF', fontSize: 8, fontWeight: '700' }, sessionPromptSecondary: { minHeight: 32, paddingHorizontal: 9, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, sessionPromptSecondaryText: { color: '#4B7B9D', fontSize: 8, fontWeight: '700' },
  writeRhythmMini: { marginTop: 12, minHeight: 49, paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E4F0', flexDirection: 'row', alignItems: 'center' }, writeRhythmMiniIcon: { width: 29, height: 29, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EEFF' }, writeRhythmMiniIconText: { color: C.periwinkle, fontSize: 16 }, writeRhythmMiniCopy: { flex: 1, marginLeft: 9 }, writeRhythmMiniTitle: { color: C.ink, fontSize: 10, fontWeight: '700', marginTop: 3 }, writeRhythmMiniChevron: { color: C.periwinkle, fontSize: 17, marginLeft: 7 },
  writeRhythmCard: { marginTop: 0, padding: 14, borderRadius: 19, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E4F0' }, writeRhythmClose: { alignSelf: 'flex-end', width: 30, height: 20, marginTop: 2, marginBottom: -1, alignItems: 'center', justifyContent: 'center' }, writeRhythmCloseText: { color: C.periwinkle, fontSize: 16, fontWeight: '700' },
  writeRhythmHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  writeRhythmCopy: { flex: 1, paddingRight: 8 },
  writeRhythmKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.8, fontWeight: '700' },
  writeRhythmTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 4 },
  writeRhythmSchedule: { color: C.sage, fontSize: 8, fontWeight: '700', marginTop: 4 },
  writeRhythmTarget: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.5, fontWeight: '700', marginTop: 2 },
  writeRhythmHint: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 7 },
  focusTimerRow: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#EEEAF4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  focusTimerValue: { color: C.ink, fontSize: 26, fontWeight: '700', letterSpacing: 1 },
  focusTimerLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.65, fontWeight: '700', marginTop: 2 },
  focusTimerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  focusTimerPrimary: { minHeight: 34, paddingHorizontal: 13, borderRadius: 11, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' },
  focusTimerPrimaryText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  focusTimerReset: { minHeight: 34, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#F1F0F7', alignItems: 'center', justifyContent: 'center' },
  focusTimerResetText: { color: C.muted, fontSize: 9, fontWeight: '700' },
  focusTimerTrack: { height: 5, marginTop: 10, borderRadius: 3, backgroundColor: '#E7E5F2', overflow: 'hidden' },
  focusTimerFill: { height: 5, borderRadius: 3, backgroundColor: C.periwinkle },
  strategyPanel: { marginTop: 12, padding: 11, borderRadius: 14, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#E9E6F7' },
  strategyKicker: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.75, fontWeight: '700' },
  strategyTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 4 },
  strategyBody: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  strategySteps: { color: '#747791', fontSize: 8, lineHeight: 13, marginTop: 6 },
  planResearchNote: { marginTop: 10, padding: 9, borderRadius: 12, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#E9E6F7', flexDirection: 'row', alignItems: 'flex-start' },
  planResearchNoteIcon: { color: C.periwinkle, fontSize: 11, marginRight: 7, marginTop: 1 },
  planResearchNoteText: { flex: 1, color: '#747791', fontSize: 8, lineHeight: 12 },
  writeRhythmResearch: { color: '#989BAF', fontSize: 8, lineHeight: 12, marginTop: 7 },
});

const imagePreviewS = StyleSheet.create({ chapterVisuals: { gap: 9 }, backCover: { marginTop: 20, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#EEE7DD' }, backCoverLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' } });

const imageS = StyleSheet.create({
  card: { marginTop: 12, padding: 12, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E4F0', shadowColor: '#706C98', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, cardCompact: { marginTop: 8, padding: 9 }, cardHeader: { flexDirection: 'row', alignItems: 'center' }, cardIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF4FF' }, cardIconText: { color: '#4B7B9D', fontSize: 16 }, cardCopy: { flex: 1, minWidth: 0, marginLeft: 9 }, cardKicker: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.75, fontWeight: '700' }, cardTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 3 }, cardHint: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 3 }, addButton: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF4FF' }, addButtonText: { color: '#4B7B9D', fontSize: 19 }, hiddenCard: { marginTop: 12, padding: 12, borderRadius: 18, backgroundColor: '#F7F7FA', borderWidth: 1, borderColor: '#E6E5ED', flexDirection: 'row', alignItems: 'center' }, hiddenIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E8EE' }, hiddenIconText: { color: '#8F91A3', fontSize: 17 }, enableButton: { minHeight: 31, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center' }, enableButtonText: { color: '#4B7B9D', fontSize: 8, fontWeight: '700' }, emptyButton: { marginTop: 10, minHeight: 56, paddingHorizontal: 9, borderRadius: 14, backgroundColor: '#F8FAFD', flexDirection: 'row', alignItems: 'center' }, emptyIcon: { color: '#76B8DC', fontSize: 20, width: 29, textAlign: 'center' }, emptyCopy: { flex: 1, marginLeft: 7 }, emptyTitle: { color: C.ink, fontSize: 10, fontWeight: '700' }, emptyHint: { color: C.muted, fontSize: 8, marginTop: 3 }, emptyArrow: { color: '#76B8DC', fontSize: 20 }, imageRow: { marginTop: 9, padding: 8, borderRadius: 15, backgroundColor: '#F8FAFD', flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' }, thumbnail: { width: 51, height: 51, borderRadius: 12, backgroundColor: '#E8EFF5' }, imageCopy: { flex: 1, minWidth: 0, marginLeft: 8, marginRight: 4 }, imageTitle: { color: C.ink, fontSize: 10, fontWeight: '700', marginTop: 2 }, imageMeta: { color: C.muted, fontSize: 8, marginTop: 4 }, imageActions: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }, detailButton: { minHeight: 25, paddingHorizontal: 7, borderRadius: 8, backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center' }, detailButtonText: { color: '#4B7B9D', fontSize: 7, fontWeight: '700' }, captionButton: { minHeight: 25, paddingHorizontal: 7, borderRadius: 8, backgroundColor: '#F0EEFF', alignItems: 'center', justifyContent: 'center' }, captionButtonText: { color: C.periwinkle, fontSize: 7, fontWeight: '700' }, replaceButton: { minHeight: 25, paddingHorizontal: 7, borderRadius: 8, backgroundColor: '#FFF3E9', alignItems: 'center', justifyContent: 'center' }, replaceButtonText: { color: '#A97819', fontSize: 7, fontWeight: '700' }, removeButton: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0EC' }, removeButtonText: { color: '#C96567', fontSize: 16, lineHeight: 18 }, details: { width: '100%', marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#E3EAF0' }, detailInput: { minHeight: 37, marginTop: 6, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDE8EF', color: C.ink, fontSize: 9 }, captionEditor: { marginTop: 2 }, removeCaptionButton: { alignSelf: 'flex-start', marginTop: 5, paddingVertical: 3 }, removeCaptionText: { color: '#9A9CB1', fontSize: 7, fontWeight: '700' }, detailFieldRow: { marginTop: 9 }, detailLabel: { color: '#7D8F9C', fontSize: 7, letterSpacing: 0.6, fontWeight: '700' }, detailPills: { gap: 5, paddingTop: 6, paddingRight: 8 }, detailPill: { minHeight: 27, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDE8EF', alignItems: 'center', justifyContent: 'center' }, detailPillSelected: { backgroundColor: '#EAF4FF', borderColor: '#76B8DC' }, detailPillText: { color: C.muted, fontSize: 7, fontWeight: '700' }, detailPillTextSelected: { color: '#4B7B9D' }, detailTwoColumn: { flexDirection: 'row', gap: 6 }, detailHalf: { flex: 1 }, detailSwitchRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' }, detailSwitchCopy: { flex: 1, marginRight: 8 }, detailSwitchTitle: { color: C.ink, fontSize: 9, fontWeight: '700' }, detailSwitchHint: { color: C.muted, fontSize: 7, lineHeight: 11, marginTop: 2 }, detailResolution: { color: '#9A9CB1', fontSize: 7, marginTop: 10 }, preview: { marginTop: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFF' }, previewPlaceholder: { minHeight: 125, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#C7DCE8' }, previewImage: { width: '100%', height: 170, backgroundColor: '#EEF5F9' }, previewOverlay: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(42,72,93,0.72)' }, previewPlacement: { color: '#FFF', fontSize: 7, fontWeight: '700' }, previewCaption: { color: C.muted, fontSize: 9, lineHeight: 13, padding: 9, paddingBottom: 2 }, previewCredit: { color: '#9A9CB1', fontSize: 7, paddingHorizontal: 9, paddingBottom: 8 }, placeholderIcon: { color: '#76B8DC', fontSize: 24 }, placeholderTitle: { color: C.ink, fontSize: 11, fontWeight: '700', marginTop: 6 }, placeholderHint: { color: C.muted, fontSize: 8, marginTop: 4 },
});

const mediaStyles = StyleSheet.create({
  conditionalStatsCard: { marginTop: 17, padding: 15, borderRadius: 21, backgroundColor: '#EAF4FF', borderWidth: 1, borderColor: '#D6EAF5' },
  conditionalStatsCardCitation: { marginTop: 12, padding: 15, borderRadius: 21, backgroundColor: '#F1F0FF', borderWidth: 1, borderColor: '#E3DFFA' },
  conditionalStatsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  conditionalStatsEyebrow: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.8, fontWeight: '700' },
  conditionalStatsEyebrowCitation: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' },
  conditionalStatsTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 5 },
  conditionalStatsHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  conditionalStatsIcon: { color: '#4B7B9D', fontSize: 21 },
  conditionalStatsIconCitation: { color: C.periwinkle, fontSize: 21 },
  conditionalStatsGrid: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conditionalStat: { width: '48%', minHeight: 67, padding: 9, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.78)' },
  conditionalStatValue: { color: C.ink, fontSize: 16, fontWeight: '700' },
  conditionalStatLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.55, fontWeight: '700', marginTop: 5 },
  conditionalStatDetail: { color: '#9A9CB1', fontSize: 7, marginTop: 3 },
  conditionalStatsNote: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#D6EAF5', flexDirection: 'row', alignItems: 'center' },
  conditionalStatsNoteIcon: { color: '#4B7B9D', fontSize: 15, marginRight: 6 },
  conditionalStatsNoteText: { flex: 1, color: '#5C7891', fontSize: 8, lineHeight: 12 },
  conditionalStatsFootnote: { color: '#A97819', fontSize: 8, lineHeight: 12, marginTop: 9 },
  conditionalStatsCitation: { marginTop: 10, padding: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.78)' },
  conditionalStatsCitationLabel: { color: C.periwinkle, fontSize: 6, letterSpacing: 0.7, fontWeight: '700' },
  conditionalStatsCitationText: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 4 },
});

const s: any = Object.assign(StyleSheet.create({
  journeyNodeStack: { alignItems: 'center' }, journeyMiniDotRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, journeyMiniDot: { width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F0F7', borderWidth: 2, borderColor: '#D8D7E5' }, journeyMiniDotComplete: { backgroundColor: '#E8F5E9', borderColor: '#B9DDBE' }, journeyMiniDotCurrent: { backgroundColor: '#FFF1E5', borderColor: '#F2CBB7' }, journeyMiniDotSelected: { borderColor: C.periwinkle, shadowColor: C.periwinkle, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, journeyMiniDotText: { color: '#9899AD', fontSize: 7, fontWeight: '700' }, journeyMiniDotTextComplete: { color: '#4D8B59' }, journeyMiniDotLine: { width: 15, height: 2, backgroundColor: '#D8D7E5' }, journeyMiniDotLineComplete: { backgroundColor: '#C6C1F4' }, journeyMiniToBigLine: { width: 15, height: 2, backgroundColor: '#D8D7E5' }, journeyCheckpointParent: { color: '#9A9CB1', fontSize: 8, marginTop: 3 },
  statsScopeToggle: { marginTop: 14, padding: 3, borderRadius: 13, backgroundColor: '#ECEAF5', flexDirection: 'row' }, statsScopeOption: { flex: 1, minHeight: 34, paddingHorizontal: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, statsScopeOptionActive: { backgroundColor: '#FFF', shadowColor: '#6F6A96', shadowOpacity: 0.09, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, statsScopeOptionText: { color: C.muted, fontSize: 9, fontWeight: '700' }, statsScopeOptionTextActive: { color: C.ink }, statsProjectPicker: { gap: 7, paddingTop: 10, paddingBottom: 2 }, statsProjectOption: { minWidth: 116, maxWidth: 152, minHeight: 39, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)' }, statsProjectOptionActive: { backgroundColor: '#EEEDFF', borderColor: '#D6D0FA' }, statsProjectOptionMark: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, statsProjectOptionMarkText: { color: '#FFF', fontSize: 11 }, statsProjectOptionText: { flex: 1, color: C.muted, fontSize: 8, fontWeight: '700', marginLeft: 6 }, statsProjectOptionTextActive: { color: C.ink },
  specializedStatsCard: { marginTop: 22, padding: 15, borderRadius: 22, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#DCE9FA', shadowColor: '#7181A1', shadowOpacity: 0.07, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, specializedStatsCardWarm: { backgroundColor: '#FFF8EC', borderColor: '#F2E3BE' }, specializedStatsEyebrow: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, specializedStatsTitle: { color: C.ink, fontSize: 18, fontWeight: '700', marginTop: 5 }, specializedStatsSubtitle: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, specializedStatsGrid: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, specializedStat: { width: '48%', minHeight: 71, padding: 9, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.78)' }, specializedStatLabel: { color: '#6B7894', fontSize: 6, letterSpacing: 0.55, fontWeight: '700' }, specializedStatValue: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 7 }, specializedStatDetail: { color: C.muted, fontSize: 7, lineHeight: 10, marginTop: 3 }, achievementSubsectionLabel: { color: '#777291', fontSize: 7, letterSpacing: 0.85, fontWeight: '700', marginTop: 13, marginBottom: 8 }, achievementSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, achievementSummaryItem: { width: '31%', minHeight: 67, padding: 8, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.72)' }, achievementSummaryValue: { color: C.ink, fontSize: 14, fontWeight: '700' }, achievementSummaryLabel: { color: '#6E6C85', fontSize: 7, lineHeight: 9, fontWeight: '700', marginTop: 5 }, achievementSummaryDetail: { color: '#9693A8', fontSize: 6, lineHeight: 9, marginTop: 2 }, nextAchievement: { marginTop: 11, padding: 10, borderRadius: 14, backgroundColor: '#FFFDF3', borderWidth: 1, borderColor: '#F0E1AD', flexDirection: 'row', alignItems: 'center' }, nextAchievementIcon: { color: '#B58420', fontSize: 17, width: 27, textAlign: 'center' }, nextAchievementCopy: { flex: 1, marginLeft: 5 }, nextAchievementLabel: { color: '#AA7A18', fontSize: 6, letterSpacing: 0.8, fontWeight: '700' }, nextAchievementTitle: { color: C.ink, fontSize: 10, fontWeight: '700', marginTop: 3 }, nextAchievementDetail: { color: C.muted, fontSize: 7, lineHeight: 10, marginTop: 2 }, personalRecordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, personalRecordItem: { width: '48%', minHeight: 64, padding: 9, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.72)' }, personalRecordLabel: { color: '#777291', fontSize: 6, letterSpacing: 0.55, fontWeight: '700' }, personalRecordValue: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 6 }, personalRecordDetail: { color: C.muted, fontSize: 7, lineHeight: 10, marginTop: 2 },
  notificationPanel: { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: '#E9E7F1', overflow: 'hidden' }, notificationPanelHeader: { minHeight: 76, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' }, notificationBell: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EEFF' }, notificationBellText: { color: C.periwinkle, fontSize: 17 }, notificationHeaderCopy: { flex: 1, marginLeft: 10, marginRight: 7 }, notificationTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, notificationSub: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, notificationPanelBody: { paddingHorizontal: 13, paddingBottom: 13, borderTopWidth: 1, borderTopColor: '#EEEAF4' }, notificationPanelHint: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 11 }, notificationReminder: { marginTop: 9, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9E7F1', overflow: 'hidden' }, notificationReminderExpanded: { borderColor: '#DCD5FA' }, notificationReminderSummary: { minHeight: 58, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center' }, notificationReminderIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F2F7' }, notificationReminderIconActive: { backgroundColor: '#EEECFF' }, notificationReminderIconText: { color: C.periwinkle, fontSize: 14 }, notificationReminderCopy: { flex: 1, minWidth: 0, marginLeft: 8, marginRight: 5 }, notificationReminderLabel: { color: C.ink, fontSize: 10, fontWeight: '700' }, notificationReminderMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, notificationReminderChevron: { color: C.muted, fontSize: 16, marginLeft: 4 }, notificationReminderEditor: { paddingHorizontal: 10, paddingBottom: 11, borderTopWidth: 1, borderTopColor: '#F0EEF5' }, notificationFieldLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.7, fontWeight: '700', marginTop: 10 }, notificationInput: { minHeight: 38, marginTop: 5, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#FAF9FF', borderWidth: 1, borderColor: '#E5E2F1', color: C.ink, fontSize: 10 }, notificationDaysRow: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' }, notificationDay: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F0F6' }, notificationDayActive: { backgroundColor: C.periwinkle }, notificationDayText: { color: C.muted, fontSize: 9, fontWeight: '700' }, notificationDayTextActive: { color: '#FFF' }, notificationReminderActions: { marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, notificationReminderDaysHint: { color: C.muted, fontSize: 8 }, notificationRemoveButton: { minHeight: 28, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#FFF0EC', alignItems: 'center', justifyContent: 'center' }, notificationRemoveText: { color: '#C96567', fontSize: 8, fontWeight: '700' }, notificationAddButton: { minHeight: 40, marginTop: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CFC9F2', backgroundColor: '#F8F7FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, notificationAddIcon: { color: C.periwinkle, fontSize: 16, marginRight: 5 }, notificationAddText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, notificationDisabledCopy: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 10 },
  journeyEstimateCard: { marginTop: 13, padding: 11, borderRadius: 17, backgroundColor: '#F7F5FF', borderWidth: 1, borderColor: '#E7E2FA', flexDirection: 'row', alignItems: 'center' }, journeyEstimateIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFF' }, journeyEstimateIconText: { color: C.periwinkle, fontSize: 17 }, journeyEstimateCopy: { flex: 1, marginLeft: 9 }, journeyEstimateLabel: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, journeyEstimateValue: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 3 }, journeyEstimateDetail: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 3 },
  journeyTodayCard: { marginTop: 13, padding: 15, borderRadius: 21, backgroundColor: '#FFFDF9', borderWidth: 1, borderColor: '#F0E7D2', shadowColor: '#8A7A62', shadowOpacity: 0.09, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, journeyTodayCardPaused: { backgroundColor: '#F7F6FA', borderColor: '#E2E1EA' }, journeyTodayCardFoundation: { backgroundColor: '#F5F4FF', borderColor: '#E3DFFA' }, journeyTodayHeader: { flexDirection: 'row', alignItems: 'center' }, journeyTodayIcon: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0CA' }, journeyTodayIconPaused: { backgroundColor: '#E6E5EC' }, journeyTodayIconFoundation: { backgroundColor: '#E8E5FF' }, journeyTodayIconText: { color: '#A97819', fontSize: 17, fontWeight: '700' }, journeyTodayCopy: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: 6 }, journeyTodayEyebrow: { color: '#A97819', fontSize: 7, letterSpacing: 0.85, fontWeight: '700' }, journeyTodayTitle: { color: C.ink, fontSize: 14, lineHeight: 18, fontWeight: '700', marginTop: 4 }, journeyTodayStatus: { color: '#A97819', fontSize: 7, letterSpacing: 0.65, fontWeight: '700' }, journeyTodayDetail: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 12 }, journeyTodayGoalRow: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0E8D9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, journeyTodayGoal: { flex: 1, color: C.ink, fontSize: 10, fontWeight: '700' }, journeyTodayHint: { color: '#9A9CB1', fontSize: 7, textAlign: 'right' }, journeyTodayActions: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, journeyTodayPrimary: { minHeight: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, journeyTodayPrimaryText: { color: '#FFF', fontSize: 9, fontWeight: '700' }, journeyTodayPrimaryArrow: { color: '#FFF', fontSize: 16, marginLeft: 7 }, journeyTodayPause: { minHeight: 38, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#F4F1E9', alignItems: 'center', justifyContent: 'center' }, journeyTodayPauseText: { color: '#8F805C', fontSize: 8, fontWeight: '700' },
  journeyMilestoneReached: { marginTop: 11, padding: 11, borderRadius: 16, backgroundColor: '#F1F8F1', borderWidth: 1, borderColor: '#D8EBD9', flexDirection: 'row', alignItems: 'center' }, journeyMilestoneReachedIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDF0DF' }, journeyMilestoneReachedIconText: { color: '#4D8B59', fontSize: 14, fontWeight: '700' }, journeyMilestoneReachedCopy: { flex: 1, marginLeft: 9 }, journeyMilestoneReachedEyebrow: { color: '#4D8B59', fontSize: 7, letterSpacing: 0.75, fontWeight: '700' }, journeyMilestoneReachedTitle: { color: C.ink, fontSize: 11, fontWeight: '700', marginTop: 3 }, journeyMilestoneReachedCheck: { color: '#4D8B59' },
  journeyNodeSelected: { borderColor: '#FFF', shadowColor: C.periwinkle, shadowOpacity: 0.35, shadowRadius: 15 }, journeyMilestoneCardSelected: { borderColor: C.periwinkle, shadowOpacity: 0.16 }, journeyMiniList: { marginTop: 7, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(231,230,242,0.75)', gap: 3 }, journeyMiniRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 }, journeyMiniCheck: { width: 13, color: '#B0B1C2', fontSize: 9, fontWeight: '700' }, journeyMiniCheckComplete: { color: '#4D8B59' }, journeyMiniText: { flex: 1, color: '#8B8DA3', fontSize: 7, lineHeight: 10 }, journeyMiniTextComplete: { color: '#68708C' }, journeyCheckpointDetail: { marginTop: 13, padding: 15, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E3E0F3', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, journeyCheckpointDetailTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, journeyCheckpointDetailCopy: { flex: 1, paddingRight: 10 }, journeyCheckpointEyebrow: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, journeyCheckpointTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 5 }, journeyCheckpointPercent: { color: C.periwinkle, fontSize: 21, fontWeight: '700' }, journeyCheckpointTrack: { height: 7, marginTop: 12, borderRadius: 4, backgroundColor: '#E9E7F3', overflow: 'hidden' }, journeyCheckpointFill: { height: 7, borderRadius: 4, backgroundColor: C.periwinkle }, journeyCheckpointMeta: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, journeyCheckpointMetaRight: { alignItems: 'flex-end' }, journeyCheckpointMetaLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.55, fontWeight: '700' }, journeyCheckpointMetaValue: { color: C.ink, fontSize: 9, fontWeight: '700', marginTop: 4 }, journeyCheckpointDetailText: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 10 },
  achievementSection: { marginTop: 23 }, achievementCard: { marginTop: 9, padding: 9, borderRadius: 21, backgroundColor: '#FFF', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, achievementCardAllTime: { marginTop: 9, padding: 9, borderRadius: 21, backgroundColor: '#F4F2FF', borderWidth: 1, borderColor: '#E5E1FA' }, achievementList: { gap: 3 }, achievementRow: { minHeight: 56, paddingHorizontal: 6, paddingVertical: 7, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF9FF' }, achievementRowLocked: { backgroundColor: '#FCFCFE', opacity: 0.7 }, achievementIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDEBF9' }, achievementIconEarned: { backgroundColor: '#E8F5E9' }, achievementIconText: { color: '#4D8B59', fontSize: 10, fontWeight: '700', textAlign: 'center' }, achievementIconTextLocked: { color: '#A4A5B7' }, achievementCopy: { flex: 1, minWidth: 0, marginLeft: 9, marginRight: 7 }, achievementTitle: { color: C.ink, fontSize: 10, lineHeight: 13, fontWeight: '700' }, achievementTitleLocked: { color: '#8589A4' }, achievementDetail: { color: '#9A9CB1', fontSize: 8, lineHeight: 12, marginTop: 3 }, achievementState: { width: 22, textAlign: 'center', fontSize: 16, fontWeight: '700' }, achievementStateEarned: { color: '#4D8B59' }, achievementStateLocked: { color: '#C5C5D1' }, citationGeneratorCard: { marginTop: 23, padding: 15, borderRadius: 22, backgroundColor: '#F3FAFF', borderWidth: 1, borderColor: '#DDEFF8' }, citationHeader: { flexDirection: 'row', alignItems: 'center' }, citationIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#76B8DC' }, citationIconText: { color: '#FFF', fontSize: 18, fontWeight: '700' }, citationHeaderCopy: { flex: 1, marginLeft: 10 }, citationEyebrow: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, citationTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 4 }, citationHint: { color: '#6D8FA5', fontSize: 9, lineHeight: 13, marginTop: 4 }, citationProjectLabel: { color: '#6D8FA5', fontSize: 7, letterSpacing: 0.55, fontWeight: '700', marginTop: 13 }, citationFieldLabel: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.7, fontWeight: '700', marginTop: 12 }, citationChoiceRow: { marginTop: 6, flexDirection: 'row', gap: 6 }, citationChoice: { minHeight: 31, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDEAF2', alignItems: 'center', justifyContent: 'center' }, citationChoiceActive: { backgroundColor: '#4B7B9D', borderColor: '#4B7B9D' }, citationChoiceText: { color: '#6D8FA5', fontSize: 8, fontWeight: '700' }, citationChoiceTextActive: { color: '#FFF' }, citationFieldGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, citationInput: { width: '100%', minHeight: 39, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDEAF2', color: C.ink, fontSize: 10 }, citationInputHalf: { width: '48%', minHeight: 39, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDEAF2', color: C.ink, fontSize: 10 }, citationExample: { color: '#9BAEBA', fontSize: 8, lineHeight: 12, marginTop: 8 }, citationGenerateButton: { minHeight: 40, marginTop: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#4B7B9D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, citationGenerateText: { color: '#FFF', fontSize: 10, fontWeight: '700' }, citationGenerateArrow: { color: '#FFF', fontSize: 16 }, citationResult: { marginTop: 10, padding: 11, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDEAF2' }, citationResultLabel: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.6, fontWeight: '700' }, citationResultText: { color: C.ink, fontSize: 10, lineHeight: 15, marginTop: 6 }, citationAddButton: { minHeight: 34, marginTop: 9, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#EEF8FF', alignItems: 'center', justifyContent: 'center' }, citationAddButtonAdded: { backgroundColor: '#E8F5E9' }, citationAddText: { color: '#4B7B9D', fontSize: 9, fontWeight: '700' }, citationExisting: { color: '#6D8FA5', fontSize: 8, marginTop: 10 }, conditionalStatsCard: { marginTop: 18, padding: 15, borderRadius: 21, backgroundColor: '#F0F8FF', borderWidth: 1, borderColor: '#D9EDF8' }, conditionalStatsCardCitation: { marginTop: 11, padding: 15, borderRadius: 21, backgroundColor: '#F7F5FF', borderWidth: 1, borderColor: '#E6E1FA' }, conditionalStatsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, conditionalStatsEyebrow: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, conditionalStatsEyebrowCitation: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, conditionalStatsTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 4 }, conditionalStatsHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, conditionalStatsIcon: { color: '#4B7B9D', fontSize: 22 }, conditionalStatsIconCitation: { color: C.periwinkle, fontSize: 22 }, conditionalStatsGrid: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, conditionalStat: { width: '48%', minHeight: 74, padding: 9, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.72)' }, conditionalStatValue: { color: C.ink, fontSize: 17, fontWeight: '700' }, conditionalStatLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.5, fontWeight: '700', marginTop: 5 }, conditionalStatDetail: { color: '#9A9CB1', fontSize: 8, lineHeight: 11, marginTop: 3 }, conditionalStatsNote: { marginTop: 10, padding: 9, borderRadius: 11, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, conditionalStatsNoteIcon: { color: '#4B7B9D', fontSize: 16, marginRight: 6 }, conditionalStatsNoteText: { flex: 1, color: '#6D8FA5', fontSize: 8, lineHeight: 12 }, conditionalStatsFootnote: { color: '#7D8F9C', fontSize: 8, lineHeight: 12, marginTop: 9 }, conditionalStatsCitation: { marginTop: 11, padding: 10, borderRadius: 12, backgroundColor: '#FFF' }, conditionalStatsCitationLabel: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.65, fontWeight: '700' }, conditionalStatsCitationText: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  journeyNodeStep: { width: 45, height: 45, borderRadius: 23, borderWidth: 3 },
  journeyNodeIconStep: { fontSize: 16 },
  journeyMilestoneCardStep: { padding: 9, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.78)' },
  writeProjectBarRight: { justifyContent: 'flex-end' }, writeTopCopy: { flex: 1, minWidth: 0, paddingRight: 10 }, writeTopProgress: { marginTop: 5 }, writeTitleHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 6, maxWidth: 260 },
  writeUtilityDock: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  writeUtilityTile: { width: 52, height: 52, padding: 9, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E5F0', shadowColor: '#716C91', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  writeUtilityTileStatsActive: { backgroundColor: '#F5F3FF', borderColor: '#CFC8F6' },
  writeUtilityTileRhythmActive: { backgroundColor: '#FFF9E9', borderColor: '#F1D68D' },
  writeUtilityIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  writeUtilityIconStats: { backgroundColor: C.periwinkle },
  writeUtilityIconRhythm: { backgroundColor: C.gold },
  writeUtilityIconText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  writeSessionDetailsUtility: { marginTop: 12, padding: 10, borderRadius: 20, backgroundColor: '#F6F4FF', borderWidth: 1, borderColor: '#E6E1FA' },
  writeSessionStatsUtility: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  writeSessionDetailBlockUtility: { width: '30%', minHeight: 56, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  chapterEndCompactRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 7 }, chapterEndIconButton: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F0FA', borderWidth: 1, borderColor: '#E5E1F0' }, chapterEndIconButtonMarked: { backgroundColor: '#EAF7EC', borderColor: '#CDE7D1' }, chapterEndIconText: { color: '#9B98AD', fontSize: 16, fontWeight: '700' }, chapterEndIconTextMarked: { color: '#4D8B59' }, chapterEndCompactLabel: { color: '#A1A0B0', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' },
  writeAssistNoteInset: { marginLeft: 0 },
  writeReferenceBlock: { marginTop: 8, alignItems: 'flex-start' }, writeReferenceButton: { minHeight: 30, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F3F7' }, writeReferenceIcon: { color: '#A1A3B3', fontSize: 13, marginRight: 5 }, writeReferenceButtonText: { color: '#8F91A3', fontSize: 8, fontWeight: '700' }, writeReferenceChevron: { color: '#A3A5B7', fontSize: 14, marginLeft: 5 }, writeReferencePanel: { width: '100%', marginTop: 6, padding: 11, borderRadius: 13, backgroundColor: '#F7F7FA', borderWidth: 1, borderColor: '#E9E8F1' }, writeReferenceKicker: { color: '#A2A4B2', fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, writeReferenceRow: { marginTop: 7 }, writeReferenceLabel: { color: '#A2A4B2', fontSize: 7, letterSpacing: 0.55, fontWeight: '700' }, writeReferenceText: { color: '#9B9DAD', fontSize: 9, lineHeight: 14, marginTop: 2 },
  planStepCardAesthetic: { marginTop: 18, padding: 20, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(226,224,242,0.9)', shadowColor: '#6E6A91', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 }, planSectionKickerAesthetic: { color: C.periwinkle, fontSize: 8, letterSpacing: 1.15, fontWeight: '700' }, planSectionTitleAesthetic: { color: C.ink, fontSize: 25, lineHeight: 30, letterSpacing: -0.7, fontWeight: '700', marginTop: 7 }, planSectionCopyAesthetic: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 8 }, metricRowAesthetic: { flexDirection: 'row', gap: 12, marginTop: 18 }, metricCardAesthetic: { flex: 1, padding: 16, borderRadius: 21, backgroundColor: '#F8F5FF', borderWidth: 1, borderColor: '#E9E4FA', shadowColor: '#837CB0', shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, metricLabelAesthetic: { color: '#767CA2', fontSize: 8, letterSpacing: 1, fontWeight: '700' }, metricInputAesthetic: { color: C.ink, fontSize: 32, lineHeight: 38, fontWeight: '700', paddingVertical: 5, paddingHorizontal: 0 }, metricHintAesthetic: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 1 }, planTipAesthetic: { marginTop: 17, paddingVertical: 15, paddingHorizontal: 16, borderRadius: 19, backgroundColor: '#FFF7DE', borderWidth: 1, borderColor: '#F2E2B7', flexDirection: 'row', alignItems: 'flex-start', shadowColor: '#B48A38', shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, planTipIconAesthetic: { color: '#C9901B', fontSize: 16, marginRight: 10, marginTop: 1 }, planTipTextAesthetic: { flex: 1, color: '#8C6B29', fontSize: 11, lineHeight: 17 }, primaryMetricCardAesthetic: { position: 'relative', overflow: 'hidden', marginTop: 19, padding: 18, borderRadius: 25, borderWidth: 1.5, borderColor: '#DFD8FF', shadowColor: '#766DB4', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, primaryMetricAccent: { position: 'absolute', width: 128, height: 128, borderRadius: 64, right: -52, top: -58, backgroundColor: 'rgba(255,255,255,0.42)' }, primaryMetricHeaderAesthetic: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, primaryMetricTitleAesthetic: { color: C.ink, fontSize: 18, letterSpacing: -0.2, fontWeight: '700', marginTop: 5 }, primaryMetricUnitPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.58)', borderWidth: 1, borderColor: 'rgba(139,138,232,0.16)' }, primaryMetricUnitAesthetic: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, primaryMetricInputAesthetic: { color: C.ink, fontSize: 46, lineHeight: 53, letterSpacing: -1.5, fontWeight: '700', paddingVertical: 6, paddingHorizontal: 0 }, primaryMetricHintAesthetic: { color: '#73789D', fontSize: 10, lineHeight: 15 }, scopeExampleAesthetic: { color: '#9699AF', fontSize: 9, lineHeight: 14, marginTop: 8 }, scopeControlCardAesthetic: { marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E7F1', shadowColor: '#777292', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  planningMethodCard: { marginTop: 14, borderRadius: 18, backgroundColor: '#F2F0FF', borderWidth: 1, borderColor: '#E4E0FC' }, planningMethodButton: { minHeight: 69, padding: 10, flexDirection: 'row', alignItems: 'center' }, planningMethodIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.periwinkle }, planningMethodIconText: { color: '#FFF', fontSize: 17 }, planningMethodCopy: { flex: 1, marginLeft: 10 }, planningMethodKicker: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, planningMethodTitleRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, planningMethodTitle: { flex: 1, color: C.ink, fontSize: 12, fontWeight: '700' }, planningMethodDifficultyTag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, fontSize: 6, letterSpacing: 0.5, fontWeight: '700' }, planningMethodHint: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 3 }, planningMethodChevron: { color: C.periwinkle, fontSize: 25, marginLeft: 7 }, planningMethodShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.24)' }, planningMethodDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, planningMethodSheet: { maxHeight: '86%', padding: 20, paddingBottom: 26, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF' }, planningMethodSheetTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 6 }, planningMethodSheetCopy: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 6 }, planningMethodDifficultyNote: { color: '#9A9CB1', fontSize: 8, lineHeight: 12, marginTop: 5 }, planningMethodList: { marginTop: 12 }, planningMethodRow: { marginTop: 8, padding: 10, borderRadius: 15, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E7F1' }, planningMethodRowSelected: { backgroundColor: '#F3F1FF', borderColor: '#D9D2FA' }, planningMethodCheck: { width: 22, height: 22, borderRadius: 8, marginTop: 1, borderWidth: 1.5, borderColor: '#D4D5E3', alignItems: 'center', justifyContent: 'center' }, planningMethodCheckSelected: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, planningMethodCheckText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, planningMethodRowCopy: { flex: 1, marginLeft: 9 }, planningMethodRowTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, planningMethodRowLabel: { flex: 1, color: C.ink, fontSize: 11, fontWeight: '700' }, planningMethodRowTitleMeta: { flexDirection: 'row', alignItems: 'center', marginLeft: 6, gap: 6 }, planningMethodRecommended: { color: '#A97819', fontSize: 6, letterSpacing: 0.55, fontWeight: '700' }, planningMethodRowDescription: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, planningMethodRowBestFor: { color: '#8C6B29', fontSize: 8, lineHeight: 12, marginTop: 5 },
  writeSessionStats: { paddingVertical: 11, paddingHorizontal: 8, gap: 3 }, writeSessionDetailBlock: { flex: 1, minWidth: 0, alignItems: 'center' },
  writeNotesSummary: { color: '#A97819', fontSize: 9, lineHeight: 13, marginTop: 4 }, writeNotesExpanded: { marginTop: 10, marginLeft: 40, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1DEAA' }, writeNotesChevron: { color: '#A97819', fontSize: 17, marginLeft: 8, marginTop: 1 }, writeSessionClockRow: { marginTop: 9, minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }, writeSessionClockHint: { color: '#9B9EB4', fontSize: 8, marginRight: 7 }, writeSessionClock: { minWidth: 43, height: 30, paddingHorizontal: 8, borderRadius: 15, backgroundColor: '#F1EEFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, writeSessionClockIcon: { color: C.periwinkle, fontSize: 15 }, writeSessionClockText: { color: C.periwinkle, fontSize: 8, fontWeight: '700' }, writeCompassActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 7 }, writeCompassChevron: { width: 25, height: 28, marginLeft: 2, alignItems: 'center', justifyContent: 'center' }, writeCompassChevronText: { color: '#4B7B9D', fontSize: 16 },
  focusPickerDropdownShade: { flex: 1, paddingTop: 103, paddingHorizontal: 20, backgroundColor: 'rgba(32,41,84,0.2)' }, focusPickerDropdownSheet: { maxHeight: '62%', padding: 17, borderRadius: 23, backgroundColor: '#FBFAFF', shadowColor: '#4E4A7F', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }, focusPickerList: { maxHeight: 245 },
  reminderTimeRow: { marginTop: 7, minHeight: 38, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#E7E4F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reminderTimeValue: { color: C.ink, fontSize: 11, fontWeight: '700' }, reminderTimeRemove: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }, reminderTimeRemoveText: { color: C.muted, fontSize: 18, lineHeight: 20 }, reminderTimeEmpty: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 7 }, reminderTimeInputRow: { marginTop: 8, minHeight: 40, flexDirection: 'row', gap: 7 }, reminderTimeInput: { flex: 1, minHeight: 40, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E4F6', color: C.ink, fontSize: 11 }, reminderTimeAdd: { minWidth: 55, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, reminderTimeAddText: { color: '#FFF', fontSize: 10, fontWeight: '700' }, reminderTimeHint: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 5 }, reminderQuickRow: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, reminderQuickButton: { minHeight: 28, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#F0EDFF', justifyContent: 'center' }, reminderQuickText: { color: C.periwinkle, fontSize: 8, fontWeight: '700' },
  planHero: { marginHorizontal: -20, marginTop: -18, padding: 31, paddingTop: 51, paddingBottom: 29, overflow: 'hidden', backgroundColor: '#EDE8FF', borderBottomLeftRadius: 37, borderBottomRightRadius: 37 },
  planHeroOverline: { color: C.muted, fontSize: 9, letterSpacing: 1.05, fontWeight: '700' }, planHeroTitle: { color: C.ink, fontWeight: '700', fontSize: 29, lineHeight: 33, letterSpacing: -0.7, marginTop: 8 }, planHeroCopy: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 10, maxWidth: 260 }, planHeroOrb: { position: 'absolute', right: 18, bottom: -57, color: C.periwinkle, opacity: 0.34, fontSize: 204 },
  planTypeRow: { gap: 8, paddingTop: 18, paddingBottom: 3, paddingRight: 20 }, planTypePill: { height: 44, paddingHorizontal: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' }, planTypePillActive: { backgroundColor: '#FFF', borderColor: C.periwinkle }, planTypeDot: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, planTypeDotText: { color: '#FFF', fontSize: 12 }, planTypeText: { color: C.muted, fontSize: 10, fontWeight: '700', marginLeft: 7 }, planTypeTextActive: { color: C.ink },
  planSelectedCard: { marginTop: 15, padding: 14, borderRadius: 20, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, planSelectedIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, planSelectedIconText: { color: '#FFF', fontSize: 18 }, planSelectedOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, planSelectedTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 3 }, planSelectedSub: { color: C.muted, fontSize: 10, marginTop: 3 }, planJourneyLink: { minHeight: 35, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#F4F2FF', flexDirection: 'row', alignItems: 'center', gap: 5 }, planJourneyLinkText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, planSelectedArrow: { color: C.gold, fontSize: 15 },
  planSteps: { marginTop: 20, padding: 5, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.7)', flexDirection: 'row', gap: 4 }, planStep: { flex: 1, minHeight: 54, paddingHorizontal: 5, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, planStepActive: { backgroundColor: '#FFF' }, planStepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E7E7F2', alignItems: 'center', justifyContent: 'center', marginRight: 6 }, planStepNumberActive: { backgroundColor: C.periwinkle }, planStepNumberText: { color: C.muted, fontSize: 10, fontWeight: '700' }, planStepNumberTextActive: { color: '#FFF' }, planStepLabel: { color: C.muted, fontSize: 10, fontWeight: '700' }, planStepLabelActive: { color: C.ink }, planStepShort: { color: '#9B9FB8', fontSize: 8, marginTop: 2 },
  planStepCard: { marginTop: 16, padding: 17, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.82)' }, planSectionKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, planSectionTitle: { color: C.ink, fontSize: 23, lineHeight: 28, letterSpacing: -0.5, fontWeight: '700', marginTop: 6 }, planSectionCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 7 }, metricRow: { flexDirection: 'row', gap: 10, marginTop: 17 }, metricCard: { flex: 1, padding: 13, borderRadius: 17, backgroundColor: '#F5F2FF', borderWidth: 1, borderColor: '#ECE9FF' }, metricLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700' }, metricInput: { color: C.ink, fontSize: 26, fontWeight: '700', paddingVertical: 5, paddingHorizontal: 0 }, metricHint: { color: C.muted, fontSize: 9, lineHeight: 13 }, planTip: { marginTop: 14, padding: 12, borderRadius: 15, backgroundColor: '#FFF6DB', flexDirection: 'row', alignItems: 'flex-start' }, planTipIcon: { color: '#C9901B', fontSize: 14, marginRight: 8 }, planTipText: { flex: 1, color: '#8C6B29', fontSize: 10, lineHeight: 15 }, primaryMetricCard: { marginTop: 17, padding: 15, borderRadius: 19, backgroundColor: '#F0EEFF', borderWidth: 1, borderColor: '#E2DDFB' }, primaryMetricHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, primaryMetricTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 4 }, primaryMetricUnit: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.8, fontWeight: '700', marginTop: 2 }, primaryMetricInput: { color: C.ink, fontSize: 34, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 0 }, primaryMetricHint: { color: C.muted, fontSize: 9, lineHeight: 14 }, scopeExample: { color: '#9699AF', fontSize: 9, lineHeight: 14, marginTop: 7 }, scopeControlCard: { marginTop: 14, padding: 14, borderRadius: 19, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E7F1' }, scopeControlKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, scopeControlTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 4 }, scopeControlCopy: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, scopeFieldLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.75, fontWeight: '700', marginTop: 15 }, scopeChoiceGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, scopeChoice: { minHeight: 34, paddingHorizontal: 10, borderRadius: 11, justifyContent: 'center', backgroundColor: '#F4F3F8', borderWidth: 1, borderColor: '#E9E8F0' }, scopeChoiceActive: { backgroundColor: '#F0EDFF', borderColor: '#C9C1F6' }, scopeChoiceText: { color: C.muted, fontSize: 9, fontWeight: '700' }, scopeChoiceTextActive: { color: C.periwinkle }, customDaysBlock: { marginTop: 10, padding: 10, borderRadius: 13, backgroundColor: '#FAF9FF' }, customDaysHint: { color: C.muted, fontSize: 9 }, dayChoiceRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }, dayChoice: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EFF5' }, dayChoiceActive: { backgroundColor: C.periwinkle }, dayChoiceText: { color: C.muted, fontSize: 9, fontWeight: '700' }, dayChoiceTextActive: { color: '#FFF' }, scopeDivider: { height: 1, backgroundColor: '#EEE DF3'.replace(' ', ''), marginVertical: 14 }, scopeSwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, scopeSwitchCopy: { flex: 1, paddingRight: 10 }, scopeSwitchTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, scopeSwitchHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, scopeChoiceHint: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 8 }, customPaceRow: { marginTop: 9, minHeight: 42, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#F8F7FF', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E7E4F6' }, customPaceInput: { flex: 1, color: C.ink, fontSize: 12, paddingVertical: 8 }, customPaceUnit: { color: C.muted, fontSize: 7, letterSpacing: 0.5, fontWeight: '700' }, scopeDeadlineLabel: { marginTop: 17 }, deadlineButton: { marginTop: 8, minHeight: 51, paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#E7E4F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, deadlineButtonLabel: { color: C.ink, fontSize: 11, fontWeight: '700' }, deadlineButtonHint: { color: C.muted, fontSize: 8, marginTop: 3 }, deadlineButtonArrow: { color: C.periwinkle, fontSize: 22 }, scopeModalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.24)' }, scopeModalDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, scopeDateSheet: { padding: 20, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FBFAFF' }, scopeDateTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 7 }, scopeDateCopy: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 6 }, scopeDateInput: { marginTop: 17, minHeight: 49, paddingHorizontal: 13, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E0EF', color: C.ink, fontSize: 14 }, scopeDateHint: { color: '#9B9EB4', fontSize: 9, marginTop: 5 }, scopeDateActions: { marginTop: 18, flexDirection: 'row', gap: 9 }, scopeDateSecondary: { flex: 1, minHeight: 45, borderRadius: 14, backgroundColor: '#F0EFF7', alignItems: 'center', justifyContent: 'center' }, scopeDateSecondaryText: { color: C.muted, fontSize: 10, fontWeight: '700' }, scopeDatePrimary: { flex: 1, minHeight: 45, borderRadius: 14, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, scopeDatePrimaryText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  structureList: { marginTop: 16, gap: 8 }, structureRow: { padding: 11, borderRadius: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E7E7F0', backgroundColor: '#FFF' }, structureRowActive: { borderColor: '#D8D1FA', backgroundColor: '#F7F5FF' }, structureCheck: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: '#CBCDDD', alignItems: 'center', justifyContent: 'center' }, structureCheckOn: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, structureCheckText: { color: '#FFF', fontSize: 13, fontWeight: '700' }, structureCopy: { flex: 1, marginLeft: 10, marginRight: 5 }, structureLabel: { color: C.ink, fontSize: 12, fontWeight: '700' }, structureHelper: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, structureFooter: { color: C.muted, fontSize: 10, marginTop: 13, textAlign: 'right' },
  planInputCard: { marginTop: 16, padding: 13, borderRadius: 17, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#ECE9FF' }, planInputLabel: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, planInputHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, planTextArea: { minHeight: 79, padding: 0, paddingTop: 10, color: C.ink, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' }, planTextAreaSmall: { minHeight: 62, padding: 0, paddingTop: 9, color: C.ink, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' }, plotGuide: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: '#EEF8FF', borderWidth: 1, borderColor: '#DFF1FB' }, plotGuideTitle: { color: '#4B7B9D', fontSize: 11, fontWeight: '700' }, plotGuideText: { color: '#5D7890', fontSize: 10, lineHeight: 15, marginTop: 5 }, plotPrompt: { marginTop: 12, padding: 13, borderRadius: 17, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E7F0' }, plotPromptTitle: { color: C.ink, fontSize: 12, fontWeight: '700' }, plotPromptHelper: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, planSubheading: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 21 },
  chapterHeader: { marginTop: 21, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, chapterHeaderHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, chapterCountBadge: { minWidth: 35, height: 30, borderRadius: 11, backgroundColor: '#FFF2C7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, chapterCountText: { color: '#A97819', fontSize: 12, fontWeight: '700' }, chapterRow: { marginTop: 9, padding: 9, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E7F0', flexDirection: 'row', alignItems: 'flex-start' }, chapterIndex: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center', marginRight: 9, marginTop: 2 }, chapterIndexText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, chapterTextInput: { flex: 1, minHeight: 47, padding: 0, color: C.ink, fontSize: 11, lineHeight: 16, textAlignVertical: 'top' }, emptyChapter: { marginTop: 12, padding: 15, borderRadius: 17, backgroundColor: '#F5F2FF', flexDirection: 'row', alignItems: 'center' }, emptyChapterIcon: { color: C.periwinkle, fontSize: 20, marginRight: 9 }, emptyChapterText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 15 },
  planFooter: { marginTop: 16, marginBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, planFooterText: { color: C.muted, fontSize: 8, letterSpacing: 0.8, fontWeight: '700' }, planNavButton: { minWidth: 79, height: 39, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#D9DAE8', backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' }, planNavButtonPrimary: { borderColor: C.periwinkle, backgroundColor: C.periwinkle }, planNavButtonDisabled: { opacity: 0.4 }, planNavButtonText: { color: C.muted, fontSize: 10, fontWeight: '700' }, planNavButtonTextPrimary: { color: '#FFF' },
  dictationField: { position: 'relative' }, dictationFieldGrow: { flex: 1, minWidth: 0 }, dictationTextInput: { paddingRight: 36 }, dictationButton: { position: 'absolute', right: 4, bottom: 7, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFF', borderWidth: 1, borderColor: '#DDD8FA' }, dictationIcon: { fontSize: 14, lineHeight: 16 },
  planHeroSwitcher: { position: 'absolute', top: 15, right: 20, width: 214, minHeight: 40, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.44)', borderWidth: 1, borderColor: 'rgba(139,138,232,0.2)' }, planTopBar: { marginTop: -6, marginBottom: 10, alignItems: 'flex-end' }, planTopSwitcher: { minWidth: 220, maxWidth: 292, minHeight: 48, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: '#E0DDF8', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, planTopIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, planTopIconText: { color: '#FFF', fontSize: 14 }, planTopSwitcherCopy: { flex: 1, marginLeft: 9 }, planTopOverline: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.85, fontWeight: '700' }, planTopTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 2 }, planTopChevron: { color: C.periwinkle, fontSize: 20, lineHeight: 20, marginLeft: 8 }, projectMenuShade: { flex: 1, backgroundColor: 'rgba(29,33,69,0.22)', paddingTop: 63, paddingHorizontal: 20, alignItems: 'flex-end' }, projectMenu: { width: 292, padding: 12, borderRadius: 22, backgroundColor: '#FBFAFF', shadowColor: '#4E4A7F', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 }, projectMenuHeader: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginHorizontal: 5, marginTop: 2 }, projectMenuHint: { color: C.muted, fontSize: 10, marginHorizontal: 5, marginTop: 4, marginBottom: 9 }, projectMenuRow: { minHeight: 56, paddingHorizontal: 9, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECEBF4', marginTop: 7 }, projectMenuRowActive: { backgroundColor: '#F3F1FF', borderColor: '#D9D2FA' }, projectMenuIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, projectMenuIconText: { color: '#FFF', fontSize: 14 }, projectMenuCopy: { flex: 1, marginLeft: 9 }, projectMenuProject: { color: C.ink, fontSize: 12, fontWeight: '700' }, projectMenuType: { color: C.muted, fontSize: 9, marginTop: 3 }, projectMenuCheck: { width: 21, height: 21, borderRadius: 10, borderWidth: 1.5, borderColor: '#D4D5E3', alignItems: 'center', justifyContent: 'center', marginLeft: 7 }, projectMenuCheckActive: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, projectMenuCheckText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  page: { flex: 1, backgroundColor: C.paper, overflow: 'hidden' }, safe: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 112 },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.46 }, orbOne: { width: 270, height: 270, backgroundColor: C.lavender, top: -110, right: -100 }, orbTwo: { width: 230, height: 230, backgroundColor: C.sky, top: 310, left: -155 }, orbThree: { width: 190, height: 190, backgroundColor: C.peach, bottom: 20, right: -110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }, overline: { color: C.muted, fontSize: 9, letterSpacing: 1.15, fontWeight: '700' }, pageTitle: { color: C.ink, fontSize: 31, letterSpacing: -0.8, fontWeight: '700', marginTop: 4 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 }, tinyButton: { width: 39, height: 39, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, tinyButtonText: { color: C.periwinkle, fontSize: 18 }, avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F3', shadowColor: '#666187', shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, avatarText: { color: C.coral, fontWeight: '700', fontSize: 16 }, avatarDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', right: 0, bottom: 2, borderWidth: 2, borderColor: '#FFF8F3', backgroundColor: C.sage },
  intro: { fontSize: 15, lineHeight: 21, color: C.muted, marginBottom: 21, maxWidth: 310 }, focusCard: { height: 206, borderRadius: 28, padding: 21, overflow: 'hidden', shadowColor: '#5D598A', shadowOpacity: 0.21, shadowRadius: 19, shadowOffset: { width: 0, height: 10 }, elevation: 7 }, focusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, focusEyebrow: { color: '#F7F9FF', fontSize: 9, letterSpacing: 1.05, fontWeight: '700' }, focusPickerButton: { minHeight: 27, paddingHorizontal: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' }, focusPickerButtonText: { color: '#FFF', fontSize: 8, fontWeight: '700' }, focusPickerButtonArrow: { color: '#FFF', fontSize: 13, marginLeft: 4, marginTop: -3 }, focusTitle: { color: '#FFF', fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: 10 }, focusCopy: { color: '#F5F4FF', fontSize: 12, marginTop: 5, maxWidth: 245 }, focusProgress: { color: '#ECEBFF', fontSize: 9, fontWeight: '700', marginTop: 7 }, focusActions: { position: 'absolute', left: 21, right: 21, bottom: 17, flexDirection: 'row', alignItems: 'center', gap: 8 }, lightAction: { flex: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.22)' }, lightActionText: { fontSize: 11, color: '#FFF', fontWeight: '700' }, lightArrow: { color: '#FFF', fontSize: 16 }, focusJourneyAction: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }, focusJourneyActionText: { color: '#FFF', fontSize: 10, fontWeight: '700' }, focusShape: { position: 'absolute', right: -15, bottom: -58, fontSize: 195, color: '#FFF1DF', opacity: 0.55, transform: [{ rotate: '-12deg' }] }, focusPickerShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.24)' }, focusPickerDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, focusPickerSheet: { maxHeight: '72%', padding: 20, paddingBottom: 28, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF' }, focusPickerOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginTop: 17 }, focusPickerTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 5 }, focusPickerHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 5, marginBottom: 7 }, focusPickerRow: { minHeight: 59, marginTop: 7, paddingHorizontal: 10, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E7F1' }, focusPickerRowSelected: { backgroundColor: '#F3F1FF', borderColor: '#D9D2FA' }, focusPickerMark: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, focusPickerMarkText: { color: '#FFF', fontSize: 15 }, focusPickerCopy: { flex: 1, marginLeft: 9 }, focusPickerBookTitle: { color: C.ink, fontSize: 12, fontWeight: '700' }, focusPickerBookMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, focusPickerCheck: { color: C.periwinkle, fontSize: 17, fontWeight: '700', marginLeft: 8 },
  sectionBar: { marginTop: 28, marginBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: C.ink }, link: { color: C.periwinkle, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }, newProjectButton: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#EEEDFF' }, newProjectText: { color: C.periwinkle, fontSize: 9, fontWeight: '700', letterSpacing: 0.65 }, projectRow: { minHeight: 74, marginBottom: 9, padding: 12, borderRadius: 19, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.68)' }, projectRowActive: { backgroundColor: '#FFF', shadowColor: '#68638D', shadowOpacity: 0.11, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, projectMark: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, projectMarkText: { color: '#FFF', fontSize: 18 }, projectCopy: { flex: 1, marginLeft: 12 }, projectTitle: { color: C.ink, fontWeight: '700', fontSize: 14 }, projectDetail: { color: C.muted, marginTop: 4, fontSize: 10, letterSpacing: 0.25 }, continueTag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: '#EEEDFF' }, continueTagText: { fontSize: 8, letterSpacing: 0.6, color: C.periwinkle, fontWeight: '700' }, chevron: { color: C.periwinkle, fontSize: 25 }, addProjectRow: { marginTop: 4, borderRadius: 19, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C8C8E8', minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.32)' }, addProjectPlus: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center' }, addProjectPlusText: { color: C.periwinkle, fontSize: 24, fontWeight: '400' }, addProjectTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginLeft: 12 }, addProjectSub: { color: C.muted, fontSize: 10, marginLeft: 12, marginTop: 4 },
  modalShade: { flex: 1, backgroundColor: 'rgba(29, 33, 69, 0.35)', justifyContent: 'flex-end' }, composerSheet: { height: '88%', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, backgroundColor: '#FAFAFF', borderTopLeftRadius: 32, borderTopRightRadius: 32 }, sheetHandle: { width: 38, height: 4, borderRadius: 4, backgroundColor: '#D9D9E7', alignSelf: 'center' }, composerHeader: { marginTop: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, composerOverline: { color: C.periwinkle, letterSpacing: 1, fontSize: 9, fontWeight: '700' }, composerTitle: { color: C.ink, fontSize: 23, letterSpacing: -0.5, fontWeight: '700', marginTop: 5 }, closeButton: { height: 34, width: 34, borderRadius: 17, backgroundColor: '#F0F0F9', alignItems: 'center', justifyContent: 'center' }, closeButtonText: { color: C.muted, fontSize: 23, lineHeight: 24 }, projectInput: { marginTop: 17, minHeight: 50, paddingHorizontal: 15, backgroundColor: '#FFF', borderRadius: 15, color: C.ink, fontSize: 14, borderWidth: 1, borderColor: '#E5E5F0' }, typePrompt: { color: C.muted, fontSize: 9, letterSpacing: 0.9, fontWeight: '700', marginTop: 20, marginBottom: 10 }, typeScroller: { flex: 1 }, typeGrid: { paddingBottom: 14, gap: 8 }, typeCard: { padding: 10, minHeight: 63, borderRadius: 17, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EBEBF2', backgroundColor: '#FFF' }, typeCardSelected: { borderColor: C.periwinkle, backgroundColor: '#F4F2FF' }, typeIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, typeIconText: { color: '#FFF', fontSize: 16 }, typeCopy: { flex: 1, marginLeft: 10 }, typeName: { color: C.ink, fontSize: 12, fontWeight: '700' }, typeExample: { color: C.muted, fontSize: 9, marginTop: 3 }, typeCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#D2D4E2', alignItems: 'center', justifyContent: 'center' }, typeCheckSelected: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, typeCheckText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, createProjectButton: { marginTop: 11, backgroundColor: C.periwinkle, height: 53, borderRadius: 17, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#7470C9', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }, createProjectButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' }, createProjectArrow: { color: '#FFF', fontSize: 21 },
  structureLegend: { marginTop: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }, structureLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, structureLegendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D9DAE8' }, structureLegendDotRecommended: { backgroundColor: C.periwinkle }, structureLegendText: { color: C.muted, fontSize: 8, fontWeight: '700' }, structureLegendHint: { color: '#A4A7BE', fontSize: 8, marginLeft: 3 }, recommendationLegend: { marginTop: 13, padding: 10, borderRadius: 15, backgroundColor: '#FAF9FF', borderWidth: 1, borderColor: '#E8E5F7' }, recommendationLegendTitle: { color: C.muted, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, recommendationLegendItems: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, recommendationLegendChip: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 }, recommendationLegendText: { fontSize: 6, letterSpacing: 0.35, fontWeight: '700' }, structureFilterRow: { marginTop: 13, padding: 4, borderRadius: 14, backgroundColor: '#F1F0F8', flexDirection: 'row', gap: 4 }, structureFilterButton: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' }, structureFilterButtonActive: { backgroundColor: '#FFF', shadowColor: '#6E6A91', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, structureFilterText: { color: C.muted, fontSize: 8, fontWeight: '700' }, structureFilterTextActive: { color: C.ink }, structureChecklistHeader: { marginTop: 13, padding: 11, borderRadius: 15, backgroundColor: '#F4F2FF', borderWidth: 1, borderColor: '#E4E1F4', flexDirection: 'row', alignItems: 'center' }, structureChecklistCopy: { flex: 1 }, structureChecklistTitle: { color: C.ink, fontSize: 9, letterSpacing: 0.8, fontWeight: '700' }, structureChecklistHint: { color: C.muted, fontSize: 9, marginTop: 4 }, structureCategory: { color: '#9A9CB1', fontSize: 6, letterSpacing: 0.7, fontWeight: '700', marginBottom: 3 }, partTag: { paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, fontSize: 6, letterSpacing: 0.35, fontWeight: '700' }, essentialTag: { color: '#A45467', backgroundColor: '#FFE7E6' }, stronglyRecommendedTag: { color: '#715BC3', backgroundColor: '#E9E1FF' }, recommendedTag: { color: C.periwinkle, backgroundColor: '#EEEDFF' }, commonTag: { color: '#4E8B67', backgroundColor: '#E8F6EA' }, whenRelevantTag: { color: '#A97819', backgroundColor: '#FFF3CB' }, optionalTag: { color: C.muted, backgroundColor: '#F1F1F6' },
  structureFooterRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, structureFooterCompact: { color: C.muted, fontSize: 10 }, structurePager: { flexDirection: 'row', alignItems: 'center', gap: 7 }, structurePagerButton: { width: 27, height: 27, borderRadius: 10, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center' }, structurePagerButtonDisabled: { opacity: 0.35 }, structurePagerButtonText: { color: C.periwinkle, fontSize: 19, lineHeight: 21 }, structurePagerCount: { color: C.muted, fontSize: 9, fontWeight: '700', minWidth: 27, textAlign: 'center' }, referencePlanCard: { marginTop: 16, padding: 13, borderRadius: 18, backgroundColor: '#F7F7FA', borderWidth: 1, borderColor: '#E6E5ED' }, referencePlanHeader: { flexDirection: 'row', alignItems: 'flex-start' }, referencePlanIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E8EE' }, referencePlanIconText: { color: '#8F91A3', fontSize: 16 }, referencePlanCopy: { flex: 1, minWidth: 0, marginLeft: 9, marginRight: 7 }, referencePlanEyebrow: { color: '#9A9CAA', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, referencePlanTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 3 }, referencePlanHint: { color: '#9294A4', fontSize: 9, lineHeight: 13, marginTop: 4 }, referencePlanToggle: { minWidth: 43, minHeight: 27, paddingHorizontal: 7, borderRadius: 9, backgroundColor: '#E8E8EE', alignItems: 'center', justifyContent: 'center' }, referencePlanToggleOn: { backgroundColor: '#DCD7FB' }, referencePlanToggleText: { color: '#999BAA', fontSize: 7, letterSpacing: 0.5, fontWeight: '700' }, referencePlanToggleTextOn: { color: C.periwinkle }, referencePlanBody: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E4E3EA' }, referencePlanFieldLabel: { color: '#999BAA', fontSize: 7, letterSpacing: 0.65, fontWeight: '700' }, referencePlanInput: { minHeight: 70, marginTop: 6, padding: 9, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E3E2EA', color: C.ink, fontSize: 10, lineHeight: 15, textAlignVertical: 'top' }, referencePlanExample: { color: '#A4A5B1', fontSize: 8, lineHeight: 12, marginTop: 7 },
  storyMapPager: { marginTop: 16, padding: 9, borderRadius: 16, backgroundColor: '#F4F2FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, storyMapPagerButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E4E1F4' }, storyMapPagerButtonDisabled: { opacity: 0.35 }, storyMapPagerButtonText: { color: C.periwinkle, fontSize: 20, lineHeight: 22 }, storyMapPagerCopy: { flex: 1, alignItems: 'center' }, storyMapPagerLabel: { color: C.ink, fontSize: 11, fontWeight: '700' }, storyMapPagerCount: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', marginTop: 3 }, storyMapPageHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 6, marginBottom: 2 },
  writeProjectBar: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 7 }, writeProjectSwitcher: { maxWidth: 235, minHeight: 50, flexShrink: 1, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: '#E0DDF8', flexDirection: 'row', alignItems: 'center' }, writeProjectIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, writeProjectIconText: { color: '#FFF', fontSize: 15 }, writeProjectCopy: { flex: 1, marginLeft: 9 }, writeProjectOverline: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, writeProjectTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 2 }, writeProjectChevron: { color: C.periwinkle, fontSize: 19, lineHeight: 20, marginLeft: 8 }, writeJourneyLink: { minHeight: 37, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#F4F2FF', flexDirection: 'row', alignItems: 'center', gap: 4 }, writeJourneyLinkText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, writeJourneyLinkArrow: { color: C.periwinkle, fontSize: 13 }, writeProgress: { width: 95, flexShrink: 0, marginLeft: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 13, backgroundColor: '#EEEDFF', borderWidth: 1, borderColor: '#E1DDFB' }, writeProgressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, writeProgressValue: { color: C.ink, fontSize: 14, fontWeight: '700' }, writeProgressLabel: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.5, fontWeight: '700' }, writeProgressTrack: { height: 4, marginTop: 5, borderRadius: 3, backgroundColor: '#DCD8F4', overflow: 'hidden' }, writeProgressFill: { height: 4, borderRadius: 3, backgroundColor: C.periwinkle }, writeProgressText: { color: C.muted, fontSize: 7, letterSpacing: 0.35, fontWeight: '700', marginTop: 5 }, writeFormat: { color: C.muted, fontSize: 9, marginTop: 10 },
  writeAssistArea: { marginTop: 11 }, writeAssistTiles: { flexDirection: 'row', alignItems: 'center', gap: 10 }, writeAssistTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E7F1', shadowColor: '#777292', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, writeAssistTileHelpActive: { backgroundColor: '#F2F0FF', borderColor: '#C8C1F7' }, writeAssistTileNotesActive: { backgroundColor: '#FFF9E9', borderColor: '#F2D994' }, writeAssistTileCompassActive: { backgroundColor: '#EEF8FF', borderColor: '#BFE1F1' }, writeAssistIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.periwinkle }, writeAssistIconHelp: { backgroundColor: C.periwinkle }, writeAssistIconNotes: { backgroundColor: '#F5C75C' }, writeAssistIconCompass: { backgroundColor: '#76B8DC' }, writeAssistIconText: { color: '#FFF', fontSize: 14 }, writeAssistPanel: { marginTop: 10, padding: 13, borderRadius: 18, borderWidth: 1 }, writeAssistPanelHelp: { backgroundColor: '#F7F5FF', borderColor: '#E4E0FC' }, writeAssistPanelNotes: { backgroundColor: '#FFFDF4', borderColor: '#F5E5B7' }, writeAssistPanelCompass: { backgroundColor: '#F3FAFF', borderColor: '#DFF1FB' }, writeAssistPanelHeader: { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1DEAA' }, writeAssistPanelTitle: { color: C.ink, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, writeAssistPanelHint: { color: '#A97819', fontSize: 9, lineHeight: 13, marginTop: 4 }, writeAssistBar: { marginTop: 11, borderRadius: 17, backgroundColor: '#F2F0FF', borderWidth: 1, borderColor: '#E4E0FC' }, writeAssistButton: { minHeight: 55, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' }, writeAssistCopy: { flex: 1, marginLeft: 9 }, writeAssistTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, writeAssistSub: { color: C.muted, fontSize: 8, marginTop: 3 }, writeAssistChevron: { color: C.periwinkle, fontSize: 18 }, writeHelpDrawer: { padding: 11, paddingTop: 0 }, writeHelpIntro: { color: C.muted, fontSize: 9, lineHeight: 14, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#E2DFF5' }, writeHelpPrompt: { minHeight: 37, paddingHorizontal: 10, marginTop: 6, borderRadius: 11, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF' }, writeHelpPromptSelected: { backgroundColor: '#FFF6DB' }, writeHelpPromptText: { flex: 1, color: C.ink, fontSize: 10 }, writeHelpPromptTextSelected: { color: '#8C6B29', fontWeight: '700' }, writeHelpPromptArrow: { color: C.periwinkle, fontSize: 15 }, writeHelpSelected: { color: '#A97819', fontSize: 9, lineHeight: 14, marginTop: 9 },
  writeSessionBar: { marginTop: 13, minHeight: 42, paddingHorizontal: 13, borderRadius: 14, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', shadowColor: '#777391', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, writeSessionMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 4 }, writeSessionValue: { color: C.ink, fontSize: 12, fontWeight: '700' }, writeSessionLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.55, fontWeight: '700' }, writeSessionDot: { color: '#B1B2C4', marginHorizontal: 8, fontSize: 12 }, writeSessionGoal: { flex: 1 }, writeSessionGoalText: { color: C.periwinkle, fontSize: 10, fontWeight: '700' }, writeSessionChevron: { color: C.muted, fontSize: 16 }, writeSessionDetails: { marginTop: 1, padding: 12, borderRadius: 14, backgroundColor: '#F8F7FF', flexDirection: 'row', justifyContent: 'space-between' }, writeSessionDetailValue: { color: C.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' }, writeSessionDetailLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.45, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  writeCompass: { marginTop: 11, padding: 13, borderRadius: 19, backgroundColor: '#EEF8FF', borderWidth: 1, borderColor: '#DFF1FB' }, writeCompassHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, writeCompassTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 }, writeCompassIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#76B8DC' }, writeCompassIconText: { color: '#FFF', fontSize: 16 }, writeCompassKicker: { color: '#4B7B9D', fontSize: 8, letterSpacing: 0.85, fontWeight: '700', marginLeft: 9 }, writeCompassSub: { color: '#6D8FA5', fontSize: 8, marginTop: 3, marginLeft: 9 }, writeCompassRefresh: { minHeight: 28, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#FFF' }, writeCompassRefreshText: { color: '#4B7B9D', fontSize: 8, fontWeight: '700' }, writeCompassRow: { marginTop: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#D9EDF6' }, writeCompassLabel: { color: '#4B7B9D', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, writeCompassText: { color: '#5D7890', fontSize: 10, lineHeight: 15, marginTop: 3 }, writeEditorLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 }, writeContextButton: { minHeight: 25, paddingHorizontal: 7, borderRadius: 9, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1EEFF' }, writeContextIcon: { color: C.periwinkle, fontSize: 11 }, writeContextText: { color: C.periwinkle, fontSize: 8, fontWeight: '700', marginLeft: 4 }, writeContextShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.23)' }, writeContextDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, writeContextSheet: { maxHeight: '82%', padding: 20, paddingBottom: 27, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF' }, writeContextHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 11 }, writeContextKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, writeContextTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 5 }, writeContextRow: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#ECEBF3', flexDirection: 'row', alignItems: 'flex-start' }, writeContextRowIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F0FF' }, writeContextRowIconText: { color: C.periwinkle, fontSize: 14 }, writeContextRowCopy: { flex: 1, marginLeft: 10 }, writeContextRowLabel: { color: C.ink, fontSize: 11, fontWeight: '700' }, writeContextRowValue: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  writePartHeader: { marginTop: 18, padding: 14, borderRadius: 21, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, writePartNumber: { width: 44, height: 44, borderRadius: 15, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, writePartNumberText: { color: '#FFF', fontSize: 13, fontWeight: '700' }, writePartCopy: { flex: 1 }, writePartKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, writePartTitle: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 4 }, writePartHelper: { color: C.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  writeNotesBanner: { marginTop: 13, padding: 13, borderRadius: 19, backgroundColor: '#FFF9E9', borderWidth: 1, borderColor: '#F5E5B7', shadowColor: '#B4914D', shadowOpacity: 0.08, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, writeNotesTapArea: { flexDirection: 'row', alignItems: 'flex-start' }, writeNotesIcon: { width: 30, height: 30, borderRadius: 11, backgroundColor: '#F5C75C', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, writeNotesIconText: { color: '#FFF', fontSize: 13 }, writeNotesCopy: { flex: 1 }, writeNotesTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, writeNotesLabel: { color: '#A97819', fontSize: 8, letterSpacing: 0.75, fontWeight: '700' }, writeNotesAction: { color: '#A97819', fontSize: 7, letterSpacing: 0.65, fontWeight: '700' }, writeNoteRow: { marginTop: 6 }, writeNoteLabel: { color: '#9A7628', fontSize: 8, fontWeight: '700' }, writeNoteText: { color: '#7E682F', fontSize: 10, lineHeight: 14, marginTop: 2 }, writeNotesEmpty: { color: '#8C6B29', fontSize: 10, lineHeight: 15, marginTop: 5 }, writeSavedNote: { marginTop: 10, marginLeft: 40, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F1DEAA' }, writeSavedNoteLabel: { color: '#A97819', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, writeSavedNoteText: { color: '#7E682F', fontSize: 10, lineHeight: 14, marginTop: 3 }, writeQuickNote: { marginTop: 11, marginLeft: 40, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1DEAA' }, writeQuickNoteLabel: { color: '#A97819', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, writeQuickNoteInput: { minHeight: 65, padding: 0, paddingTop: 8, color: '#6D5D34', fontSize: 11, lineHeight: 16, textAlignVertical: 'top' },
  writeEditorCard: { marginTop: 15, padding: 15, borderRadius: 21, backgroundColor: '#FFFDF9', shadowColor: '#807A96', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, writeEditorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, writeEditorLabel: { color: C.coral, fontSize: 8, letterSpacing: 1.1, fontWeight: '700' }, writeEditorHint: { color: C.muted, fontSize: 8 }, writeEditorInput: { minHeight: 270, padding: 0, paddingTop: 14, color: '#353B5B', fontSize: 16, lineHeight: 25, textAlignVertical: 'top' }, writeTools: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEEAF2', flexDirection: 'row', alignItems: 'center', gap: 7 }, writeToolButton: { minHeight: 32, paddingHorizontal: 9, borderRadius: 10, backgroundColor: '#F1EEFF', flexDirection: 'row', alignItems: 'center', gap: 5 }, writeToolDisabled: { opacity: 0.4 }, writeToolIcon: { color: C.periwinkle, fontSize: 11, fontWeight: '700' }, writeToolText: { color: C.ink, fontSize: 9, fontWeight: '700' }, writeToolHint: { color: '#A1A4BB', fontSize: 8, marginLeft: 'auto' }, writeNavigation: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, writeNextButton: { flex: 1, minHeight: 47, paddingHorizontal: 15, borderRadius: 15, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, writeNextButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, writeSecondaryButton: { minHeight: 43, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#D9DAE8', backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' }, writeSecondaryButtonText: { color: C.muted, fontSize: 10, fontWeight: '700' }, writeButtonDisabled: { opacity: 0.35 },
  writeEmpty: { marginTop: 20, padding: 24, borderRadius: 23, backgroundColor: '#FFF', alignItems: 'center' }, writeEmptyIcon: { color: C.periwinkle, fontSize: 25 }, writeEmptyTitle: { color: C.ink, fontSize: 18, fontWeight: '700', marginTop: 10 }, writeEmptyCopy: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 }, writeComplete: { marginTop: 20, padding: 25, borderRadius: 23, backgroundColor: '#EEF9EF', alignItems: 'center', borderWidth: 1, borderColor: '#D7EED9' }, writeCompleteIcon: { color: '#69A772', fontSize: 28 }, writeCompleteTitle: { color: C.ink, fontSize: 19, fontWeight: '700', textAlign: 'center', marginTop: 9 }, writeCompleteCopy: { color: '#66836B', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  writeMenuShade: { flex: 1, backgroundColor: 'rgba(29,33,69,0.22)', paddingTop: 57, paddingHorizontal: 20, alignItems: 'flex-start' }, writeMenu: { width: 292, padding: 12, borderRadius: 22, backgroundColor: '#FBFAFF', shadowColor: '#4E4A7F', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 }, writeMenuHeader: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginHorizontal: 5, marginTop: 2 }, writeMenuHint: { color: C.muted, fontSize: 10, marginHorizontal: 5, marginTop: 4, marginBottom: 9 }, writeMenuRow: { minHeight: 56, paddingHorizontal: 9, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECEBF4', marginTop: 7 }, writeMenuRowActive: { backgroundColor: '#F3F1FF', borderColor: '#D9D2FA' }, writeMenuIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, writeMenuIconText: { color: '#FFF', fontSize: 14 }, writeMenuCopy: { flex: 1, marginLeft: 9 }, writeMenuProject: { color: C.ink, fontSize: 12, fontWeight: '700' }, writeMenuType: { color: C.muted, fontSize: 9, marginTop: 3 }, writeMenuCheck: { color: C.periwinkle, fontSize: 16, fontWeight: '700', marginLeft: 7 },
  writeTop: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, writeTitle: { color: C.ink, fontSize: 29, lineHeight: 34, letterSpacing: -0.7, fontWeight: '700', marginTop: 6 }, saveChip: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#D5D7E5', borderRadius: 12 }, saveChipDone: { backgroundColor: '#EFFAEF', borderColor: '#D5EFD7' }, saveChipText: { color: C.muted, fontSize: 9, letterSpacing: 0.5, fontWeight: '700' }, saveChipTextDone: { color: '#5B9C67' },
  journeyHeader: { marginTop: -4, flexDirection: 'row', alignItems: 'center', minHeight: 54 }, journeyBackButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }, journeyBackIcon: { color: C.ink, fontSize: 28, lineHeight: 29, marginTop: -2 }, journeyHeaderCopy: { flex: 1, marginLeft: 12 }, journeyOverline: { color: C.muted, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, journeyHeaderTitle: { color: C.ink, fontSize: 23, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 }, journeyOverflowButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }, journeyOverflowText: { color: C.muted, fontSize: 15, letterSpacing: 1, marginTop: -7 }, journeyBookPicker: { marginTop: 13, padding: 10, borderRadius: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.86)' }, journeyBookMark: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, journeyBookMarkText: { color: '#FFF', fontSize: 17 }, journeyBookPickerCopy: { flex: 1, marginLeft: 10 }, journeyBookPickerLabel: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.9, fontWeight: '700' }, journeyBookPickerTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 3 }, journeyBookPickerMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, journeyPickerChevron: { color: C.periwinkle, fontSize: 20, lineHeight: 21, marginHorizontal: 6 },
  journeySummaryCard: { marginTop: 14, padding: 16, borderRadius: 23, backgroundColor: '#FFF', shadowColor: '#66638D', shadowOpacity: 0.13, shadowRadius: 17, shadowOffset: { width: 0, height: 8 }, elevation: 4 }, journeySummaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, journeySummaryEyebrow: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, journeySummaryStage: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 5 }, journeySummaryPercent: { color: C.periwinkle, fontSize: 25, fontWeight: '700', letterSpacing: -0.5 }, journeyProgressTrack: { height: 8, marginTop: 13, borderRadius: 4, backgroundColor: '#E8E6F4', overflow: 'hidden' }, journeyProgressFill: { height: 8, borderRadius: 4, backgroundColor: C.periwinkle }, journeyStatsRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center' }, journeyStat: { flex: 1 }, journeyStatDivider: { width: 1, height: 37, backgroundColor: '#E7E6EF', marginHorizontal: 14 }, journeyStatValue: { color: C.ink, fontSize: 15, fontWeight: '700' }, journeyStatLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.65, fontWeight: '700', marginTop: 5 }, journeyStatSub: { color: '#9A9CB1', fontSize: 8, marginTop: 3 }, journeyNextRow: { marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#EFEFF4', flexDirection: 'row', alignItems: 'center' }, journeyNextDot: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1C9' }, journeyNextDotText: { color: '#B4871A', fontSize: 14 }, journeyNextCopy: { flex: 1, marginLeft: 9 }, journeyNextEyebrow: { color: '#A97819', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, journeyNextTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 3 }, journeyNextMeta: { color: '#9A9CB1', fontSize: 8, marginTop: 4 }, journeyNextArrow: { color: C.periwinkle, fontSize: 19 }, journeyContinueButton: { marginTop: 14, minHeight: 50, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center', shadowColor: '#7772CF', shadowOpacity: 0.25, shadowRadius: 11, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, journeyContinueText: { color: '#FFF', fontSize: 12, fontWeight: '700' }, journeyContinueAction: { flex: 1, color: '#EDEBFF', fontSize: 9, textAlign: 'right', marginRight: 9 }, journeyContinueArrow: { color: '#FFF', fontSize: 18 },
  journeyMapHeading: { marginTop: 27, marginBottom: 4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, journeyMapEyebrow: { color: C.muted, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, journeyMapTitle: { color: C.ink, fontSize: 17, fontWeight: '700', marginTop: 5 }, journeyMapHint: { color: '#9A9CB1', fontSize: 8, marginBottom: 2 }, journeyMap: { position: 'relative', marginTop: 9 }, journeyRoute: { position: 'absolute', height: 3, borderRadius: 3, backgroundColor: '#D7D4EA', shadowColor: '#FFF', shadowOpacity: 0.8, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }, journeyRouteComplete: { backgroundColor: C.periwinkle }, journeyMilestone: { position: 'absolute', alignItems: 'center' }, journeyNode: { width: 55, height: 55, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 4, shadowColor: '#68638D', shadowOpacity: 0.18, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 4 }, journeyNodeComplete: { backgroundColor: C.periwinkle, borderColor: '#DDD9FF' }, journeyNodeCurrent: { backgroundColor: C.coral, borderColor: '#FFE0D4' }, journeyNodeFuture: { backgroundColor: '#F5F4FA', borderColor: '#D9D8E6', shadowOpacity: 0.06 }, journeyNodeIcon: { color: '#FFF', fontSize: 21, fontWeight: '700' }, journeyMilestoneCard: { width: 142, marginTop: 8, padding: 10, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: 'rgba(231,230,242,0.95)', shadowColor: '#777391', shadowOpacity: 0.08, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, journeyMilestoneCardCurrent: { backgroundColor: '#FFF7F0', borderColor: '#F4D5C7' }, journeyMilestoneCardComplete: { borderColor: '#DDD9FA' }, journeyMilestoneTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 5 }, journeyMilestoneTitle: { flex: 1, color: C.ink, fontSize: 11, fontWeight: '700', lineHeight: 14 }, journeyMilestoneState: { fontSize: 6, letterSpacing: 0.45, fontWeight: '700', marginTop: 1 }, journeyStateComplete: { color: '#6A71B5' }, journeyStateCurrent: { color: C.coral }, journeyStateFuture: { color: '#A7A8BB' }, journeyMilestoneDetail: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 5 },
  journeyModalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.22)' }, journeyModalDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, journeySelectorSheet: { padding: 20, paddingBottom: 26, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF', shadowColor: '#39365B', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 10 }, journeySheetEyebrow: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, journeySheetTitle: { color: C.ink, fontSize: 23, fontWeight: '700', letterSpacing: -0.4, marginTop: 5 }, journeySheetHint: { color: C.muted, fontSize: 10, marginTop: 5, marginBottom: 9 }, journeyBookRow: { minHeight: 67, marginTop: 8, padding: 9, borderRadius: 17, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EBEAF2' }, journeyBookRowActive: { backgroundColor: '#F3F1FF', borderColor: '#D8D1FA' }, journeyBookRowCopy: { flex: 1, marginLeft: 10 }, journeyBookRowTitle: { color: C.ink, fontSize: 12, fontWeight: '700' }, journeyBookRowMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, journeyBookRowEdited: { color: '#9A9CB1', fontSize: 8, marginTop: 4 }, journeyBookRowCheck: { color: C.periwinkle, fontSize: 17, fontWeight: '700', marginLeft: 7 }, journeyMenuShade: { flex: 1, alignItems: 'flex-end', backgroundColor: 'rgba(32,41,84,0.18)', paddingTop: 58, paddingHorizontal: 20 }, journeyMenu: { width: 218, padding: 13, borderRadius: 20, backgroundColor: '#FBFAFF', shadowColor: '#39365B', shadowOpacity: 0.2, shadowRadius: 17, shadowOffset: { width: 0, height: 7 }, elevation: 8 }, journeyMenuTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: 7 }, journeyMenuRow: { minHeight: 38, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#ECEBF3' }, journeyMenuIcon: { color: C.periwinkle, fontSize: 14, width: 22 }, journeyMenuLabel: { flex: 1, color: C.ink, fontSize: 10, fontWeight: '600' }, journeyMenuArrow: { color: C.muted, fontSize: 18 },
  journeyHero: { paddingTop: 13, alignItems: 'center' }, journeyTitle: { color: C.ink, textAlign: 'center', fontSize: 27, fontWeight: '700', lineHeight: 32, letterSpacing: -0.7, marginTop: 8 }, journeyRing: { height: 153, width: 153, borderRadius: 77, marginTop: 23, borderWidth: 15, borderColor: C.periwinkle, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.65)', shadowColor: '#7772AF', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, journeyRingValue: { color: C.ink, fontSize: 32, fontWeight: '700' }, journeyRingLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.8, marginTop: 2, fontWeight: '700' }, nextCard: { marginTop: 25, borderRadius: 21, backgroundColor: '#FFF4E9', padding: 15, flexDirection: 'row', alignItems: 'center' }, nextIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' }, nextIconText: { color: '#A35B4D', fontSize: 19 }, nextOverline: { color: '#B36B61', fontSize: 8, letterSpacing: 0.75, fontWeight: '700', marginLeft: 11 }, nextTitle: { color: C.ink, fontSize: 12, lineHeight: 17, fontWeight: '700', marginLeft: 11, marginTop: 4 }, journeyRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(111,111,153,0.1)' }, journeyIcon: { width: 38, height: 38, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, journeyIconText: { color: '#FFF', fontSize: 16 }, journeyRowTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginLeft: 11 }, journeyRowDate: { color: C.muted, fontSize: 9, letterSpacing: 0.5, marginTop: 4, marginLeft: 11 }, journeyArrow: { color: C.periwinkle, fontSize: 21 },
  profileTop: { alignItems: 'center', paddingTop: 17 }, profileAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFF7F1', alignItems: 'center', justifyContent: 'center', shadowColor: '#65608A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, profileAvatarText: { fontSize: 33, color: C.coral, fontWeight: '700' }, profileHalo: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#FFF', opacity: 0.8 }, profileName: { color: C.ink, fontSize: 23, fontWeight: '700', marginTop: 16 }, profileEmail: { color: C.muted, fontSize: 12, marginTop: 5 }, pathfinder: { paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFF3CB', borderRadius: 13, marginTop: 13 }, pathfinderText: { color: '#A97819', fontSize: 9, letterSpacing: 0.7, fontWeight: '700' }, profileBadgesCard: { marginTop: 20, padding: 14, borderRadius: 21, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAE8F1', shadowColor: '#706C98', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, profileBadgesHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, profileBadgesEyebrow: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, profileBadgesTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 4 }, profileBadgesCount: { color: C.muted, fontSize: 8, fontWeight: '700' }, profileBadgesRow: { marginTop: 13, flexDirection: 'row', gap: 8 }, profileBadge: { flex: 1, minWidth: 0, alignItems: 'center' }, profileBadgeIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9' }, profileBadgeIconText: { color: '#4D8B59', fontSize: 10, fontWeight: '700', textAlign: 'center' }, profileBadgeTitle: { color: C.muted, fontSize: 7, lineHeight: 10, textAlign: 'center', marginTop: 6 }, profileBadgesEmpty: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 12 }, preferenceTitle: { marginTop: 28, marginBottom: 10, color: C.ink, fontSize: 17, fontWeight: '700' }, preferences: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 20, paddingHorizontal: 15 }, prefRow: { minHeight: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, prefTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, prefSub: { color: C.muted, fontSize: 10, marginTop: 4 }, prefLine: { height: 1, backgroundColor: '#EBEBF1' }, settingsRow: { paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(111,111,153,0.1)' }, settingsText: { color: C.ink, fontSize: 13, fontWeight: '600' },
  settingsCard: { paddingHorizontal: 15, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.75)' }, settingsRowCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }, settingsIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, settingsIconBlue: { backgroundColor: '#EAF4FF' }, settingsIconGold: { backgroundColor: '#FFF4D7' }, settingsIconSage: { backgroundColor: '#ECF8EE' }, settingsIconCoral: { backgroundColor: '#FFF0EC' }, settingsIconText: { color: C.ink, fontSize: 17, fontWeight: '700' }, settingsSub: { color: C.muted, fontSize: 9, marginTop: 3 }, accountCard: { paddingHorizontal: 15, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.75)' }, accountActionRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center' }, deleteText: { color: '#C96567', fontSize: 13, fontWeight: '600' }, profileFootnote: { color: '#9A9CB1', fontSize: 9, textAlign: 'center', marginTop: 20, marginBottom: 4 }, profileModalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.25)' }, profileModalDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, legalSheet: { maxHeight: '88%', padding: 20, paddingBottom: 25, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF', shadowColor: '#39365B', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 10 }, legalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, legalOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, legalTitle: { color: C.ink, fontSize: 24, letterSpacing: -0.4, fontWeight: '700', marginTop: 5 }, legalContent: { paddingTop: 18, paddingBottom: 10 }, legalUpdated: { color: '#9A9CB1', fontSize: 9, letterSpacing: 0.3 }, legalIntro: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 13 }, legalSectionTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 21, marginBottom: 5 }, legalBody: { color: C.muted, fontSize: 11, lineHeight: 17 }, confirmSheet: { padding: 22, paddingBottom: 25, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF', alignItems: 'center', shadowColor: '#39365B', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 10 }, confirmIcon: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, confirmIconDelete: { backgroundColor: '#FFF0EC' }, confirmIconLogout: { backgroundColor: '#ECF8EE' }, confirmIconText: { color: C.ink, fontSize: 25, fontWeight: '700' }, confirmTitle: { color: C.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' }, confirmCopy: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8, maxWidth: 305 }, confirmButton: { alignSelf: 'stretch', minHeight: 48, marginTop: 20, borderRadius: 15, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, confirmButtonDelete: { backgroundColor: C.coral }, confirmButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, cancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, cancelButtonText: { color: C.muted, fontSize: 10, fontWeight: '700' }, accountExit: { flex: 1, minHeight: 620, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }, accountExitIcon: { width: 72, height: 72, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, accountExitTitle: { color: C.ink, fontSize: 27, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center' }, accountExitCopy: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 290, marginTop: 10 }, accountExitButton: { minHeight: 49, marginTop: 25, paddingHorizontal: 18, borderRadius: 15, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center' }, accountExitButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, accountExitButtonArrow: { color: '#FFF', fontSize: 18, marginLeft: 12 },
  statsHero: { paddingTop: 13 }, statsHeroTop: { flexDirection: 'row', alignItems: 'flex-start' }, statsJourneyButton: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F4F2FF', flexDirection: 'row', alignItems: 'center', gap: 5 }, statsJourneyButtonText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, statsJourneyButtonArrow: { color: C.periwinkle, fontSize: 13 }, statsTitle: { fontSize: 29, lineHeight: 33, letterSpacing: -0.7, color: C.ink, fontWeight: '700', marginTop: 8 }, statsBookName: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 10 }, rangeRow: { flexDirection: 'row', gap: 8, marginTop: 17 }, pill: { paddingVertical: 8, paddingHorizontal: 13, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 13 }, pillSelected: { backgroundColor: C.periwinkle }, pillText: { color: C.muted, fontSize: 10, fontWeight: '700' }, pillTextSelected: { color: '#FFF' }, statsNumbers: { marginTop: 20, padding: 18, backgroundColor: '#FFF', borderRadius: 23, flexDirection: 'row', alignItems: 'center', shadowColor: '#706C98', shadowOpacity: 0.1, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, statsHeadlineMetric: { flex: 1 }, statsHeadlineDivider: { width: 1, height: 47, backgroundColor: '#E8E7F0', marginHorizontal: 15 }, bigNumber: { color: C.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.6 }, bigNumberLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', marginTop: 5 }, statsMetricHint: { color: '#9A9CB1', fontSize: 8, marginTop: 5 }, statsMetricGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, statsMetricCard: { width: '48%', minHeight: 104, padding: 13, borderRadius: 18 }, statsMetricIcon: { color: C.periwinkle, fontSize: 17 }, statsMetricCardValue: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 13 }, statsMetricCardLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.5, fontWeight: '700', marginTop: 5 }, chartCard: { marginTop: 17, backgroundColor: '#F4F2FF', borderRadius: 22, padding: 17 }, chartHeader: { flexDirection: 'row', justifyContent: 'space-between' }, chartTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, chartTotal: { color: C.periwinkle, fontWeight: '700', fontSize: 13 }, statsCardHint: { color: '#9A9CB1', fontSize: 8, marginTop: 3 }, chart: { height: 125, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }, barCol: { alignItems: 'center', justifyContent: 'flex-end', width: 25, height: '100%' }, bar: { width: 15, borderRadius: 8, backgroundColor: '#CFC8F6' }, barActive: { backgroundColor: C.coral }, barLabel: { color: C.muted, fontSize: 9, marginTop: 8 }, statsEmptyHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 11 }, statsSectionHeader: { marginTop: 24, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, statsSectionTitle: { color: C.ink, fontSize: 17, fontWeight: '700' }, statsSectionCount: { color: C.periwinkle, fontSize: 9, fontWeight: '700', marginBottom: 2 }, statsDayRow: { marginTop: 9, padding: 11, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ECEBF3' }, statsDayCopy: { flex: 1 }, statsDayTitle: { color: C.ink, fontSize: 10, fontWeight: '700' }, statsDaySub: { color: '#9A9CB1', fontSize: 8, marginTop: 4 }, statsDayMetric: { width: 43, alignItems: 'flex-end', marginLeft: 4 }, statsDayValue: { color: C.ink, fontSize: 10, fontWeight: '700' }, statsDayLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.35, fontWeight: '700', marginTop: 3 }, statsEmptyCard: { marginTop: 10, padding: 18, borderRadius: 18, backgroundColor: '#F4F2FF', alignItems: 'center' }, statsEmptyIcon: { color: C.periwinkle, fontSize: 24 }, statsEmptyTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 8 }, statsEmptyCopy: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5 }, statsBreakdownCard: { marginTop: 22, padding: 16, borderRadius: 21, backgroundColor: '#FFF', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, inputMixTrack: { height: 12, marginTop: 16, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#E8E7F3' }, inputMixDictation: { height: 12, backgroundColor: C.coral }, inputMixWriting: { height: 12, backgroundColor: C.periwinkle }, inputMixLegend: { marginTop: 13, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, inputMixLegendItem: { flex: 1, flexDirection: 'row', alignItems: 'center' }, inputMixDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 }, inputMixLabel: { color: C.muted, fontSize: 8, flex: 1 }, inputMixValue: { color: C.ink, fontSize: 9, fontWeight: '700' }, statsInsightCard: { marginTop: 17, padding: 17, borderRadius: 21, backgroundColor: '#FFF4E8' }, statsInsightEyebrow: { color: '#A97819', fontSize: 8, letterSpacing: 0.8, fontWeight: '700' }, statsInsightTitle: { color: C.ink, fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 8 }, statsInsightCopy: { color: '#866F50', fontSize: 10, lineHeight: 15, marginTop: 5 }, statsInsightMetric: { marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F0DDB8', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, statsInsightMetricLabel: { color: '#A97819', fontSize: 7, letterSpacing: 0.55, fontWeight: '700' }, statsInsightMetricValue: { color: C.ink, fontSize: 12, fontWeight: '700' }, statsBookCard: { marginTop: 10, padding: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center' }, statsBookCardDivider: { width: 1, height: 40, backgroundColor: '#E8E7EF', marginHorizontal: 15 }, statsBookCardLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.5, fontWeight: '700' }, statsBookCardValue: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 6 }, winGrid: { flexDirection: 'row', gap: 10 }, winCard: { flex: 1, padding: 15, borderRadius: 20, minHeight: 123 }, winIcon: { fontSize: 19, color: C.periwinkle }, winValue: { color: C.ink, fontWeight: '700', fontSize: 21, marginTop: 15 }, winLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.55, fontWeight: '700', marginTop: 5 },
  librarySectionEyebrow: { color: C.muted, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginTop: 22, marginBottom: 9 }, libraryProjectCard: { marginBottom: 11, padding: 12, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#68638D', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, libraryProjectCardArchived: { opacity: 0.66 }, libraryProjectTop: { flexDirection: 'row', alignItems: 'center' }, projectType: { color: C.muted, fontSize: 9, marginTop: 3 }, projectOverflowButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F2FF' }, projectOverflowText: { color: C.muted, fontSize: 13, letterSpacing: 1, marginTop: -6 }, projectStats: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EBEBF2', flexDirection: 'row', alignItems: 'center', gap: 6 }, projectStatText: { color: C.muted, fontSize: 9, flexShrink: 1 }, projectStatDot: { color: '#B4B5C8', fontSize: 9 }, projectCardActions: { marginTop: 11, flexDirection: 'row', gap: 8 }, projectContinueButton: { flex: 1, minHeight: 39, paddingHorizontal: 12, borderRadius: 13, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, projectContinueText: { color: '#FFF', fontSize: 10, fontWeight: '700' }, projectContinueArrow: { color: '#FFF', fontSize: 16 }, projectPreviewButton: { minHeight: 39, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#D8D5F5', backgroundColor: '#F7F5FF', alignItems: 'center', justifyContent: 'center' }, projectPreviewText: { color: C.periwinkle, fontSize: 10, fontWeight: '700' }, libraryMenuShade: { flex: 1, backgroundColor: 'rgba(29,33,69,0.22)', paddingTop: 80, paddingHorizontal: 20, alignItems: 'flex-end' }, libraryMenu: { width: 270, padding: 13, borderRadius: 22, backgroundColor: '#FBFAFF', shadowColor: '#4E4A7F', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 }, libraryMenuOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginBottom: 4 }, libraryMenuTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginBottom: 5 }, libraryMenuRow: { minHeight: 40, paddingHorizontal: 5, borderTopWidth: 1, borderTopColor: '#ECEBF3', flexDirection: 'row', alignItems: 'center' }, libraryMenuIcon: { color: C.periwinkle, width: 26, fontSize: 15 }, libraryMenuIconDelete: { color: C.coral, width: 26, fontSize: 18 }, libraryMenuLabel: { flex: 1, color: C.ink, fontSize: 10, fontWeight: '600' }, libraryMenuDeleteLabel: { flex: 1, color: C.coral, fontSize: 10, fontWeight: '600' }, libraryMenuArrow: { color: C.muted, fontSize: 18 }, renameModalShade: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(32,41,84,0.25)' }, renameSheet: { padding: 20, borderRadius: 24, backgroundColor: '#FBFAFF' }, renameTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 4 }, renameInput: { minHeight: 46, marginTop: 16, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: '#DCDCEA', color: C.ink, fontSize: 13, backgroundColor: '#FFF' }, renameActions: { marginTop: 15, flexDirection: 'row', justifyContent: 'flex-end', gap: 9 }, renameCancel: { minHeight: 40, paddingHorizontal: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, renameCancelText: { color: C.muted, fontSize: 10, fontWeight: '700' }, renameSave: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, renameSaveText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  studioPage: { paddingBottom: 7 }, studioHeader: { minHeight: 57, flexDirection: 'row', alignItems: 'center' }, studioBackButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)' }, studioBackIcon: { color: C.ink, fontSize: 28, lineHeight: 29, marginTop: -2 }, studioHeaderCopy: { flex: 1, marginLeft: 11, marginRight: 8 }, studioOverline: { color: C.muted, fontSize: 7, letterSpacing: 1, fontWeight: '700' }, studioHeaderTitle: { color: C.ink, fontSize: 20, fontWeight: '700', marginTop: 3 }, studioHeaderMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, studioOverflowButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)' }, studioOverflowText: { color: C.muted, fontSize: 14, letterSpacing: 1, marginTop: -7 }, studioTabs: { gap: 7, paddingTop: 10, paddingBottom: 4, paddingRight: 20 }, studioTab: { minWidth: 80, minHeight: 35, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.65)' }, studioTabSelected: { backgroundColor: C.periwinkle }, studioTabText: { color: C.muted, fontSize: 10, fontWeight: '700' }, studioTabTextSelected: { color: '#FFF' }, studioKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, studioSummaryCard: { marginTop: 15, padding: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', shadowColor: '#6B6794', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, studioSummaryTitle: { color: C.ink, fontSize: 17, fontWeight: '700', marginTop: 5 }, studioSummaryCopy: { color: C.muted, fontSize: 9, marginTop: 5 }, studioStatusDot: { width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1D0' }, studioStatusDotFinished: { backgroundColor: '#E9F7EB' }, studioStatusDotText: { color: '#A97819', fontSize: 20, fontWeight: '700' }, studioAccordion: { marginTop: 10, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: '#ECEBF3' }, studioAccordionHeader: { minHeight: 66, padding: 12, flexDirection: 'row', alignItems: 'center' }, studioAccordionIcon: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EEFF' }, studioAccordionIconText: { color: C.periwinkle, fontSize: 17, fontWeight: '700' }, studioAccordionCopy: { flex: 1, marginLeft: 10 }, studioAccordionTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, studioAccordionHint: { color: C.muted, fontSize: 9, marginTop: 3 }, studioAccordionChevron: { color: C.periwinkle, fontSize: 18, marginLeft: 8 }, studioAccordionBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#EEEEF4' }, studioOrderRow: { minHeight: 53, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EFF5', flexDirection: 'row', alignItems: 'center', gap: 5 }, studioOrderNumber: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EEFF' }, studioOrderNumberText: { color: C.periwinkle, fontSize: 8, fontWeight: '700' }, studioOrderCopy: { flex: 1, minWidth: 0 }, studioOrderTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, studioOrderMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, studioMoveButton: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F2FF' }, studioMoveDisabled: { opacity: 0.3 }, studioMoveText: { color: C.periwinkle, fontSize: 14, fontWeight: '700' }, studioOpenWrite: { minHeight: 27, paddingHorizontal: 7, borderRadius: 9, backgroundColor: '#FFF3E9', alignItems: 'center', justifyContent: 'center' }, studioOpenWriteText: { color: '#A97819', fontSize: 8, fontWeight: '700' }, studioMatterRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EFF5', flexDirection: 'row', alignItems: 'flex-start' }, studioCheck: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: '#D2D2DF', alignItems: 'center', justifyContent: 'center' }, studioCheckOn: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, studioCheckText: { color: '#FFF', fontSize: 12, fontWeight: '700' }, studioMatterCopy: { flex: 1, marginLeft: 10 }, studioMatterTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, studioMatterMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, studioMatterInput: { minHeight: 51, marginTop: 7, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E1EC', color: C.ink, fontSize: 10, lineHeight: 15, textAlignVertical: 'top', backgroundColor: '#FFF' }, studioManuscriptRow: { minHeight: 53, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EFF5', flexDirection: 'row', alignItems: 'center' }, studioManuscriptDot: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F1F7' }, studioManuscriptDotComplete: { backgroundColor: '#E9F7EB' }, studioManuscriptDotText: { color: C.muted, fontSize: 15, fontWeight: '700' }, studioControlRow: { minHeight: 51, borderBottomWidth: 1, borderBottomColor: '#F0EFF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, studioControlLabel: { color: C.ink, fontSize: 10, fontWeight: '700' }, studioControlOptions: { flexDirection: 'row', gap: 6 }, studioOption: { minHeight: 30, paddingHorizontal: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F1F7' }, studioOptionSelected: { backgroundColor: '#EEEDFF', borderWidth: 1, borderColor: C.periwinkle }, studioOptionText: { color: C.muted, fontSize: 9, fontWeight: '700' }, studioPrimaryButton: { minHeight: 49, marginTop: 16, paddingHorizontal: 15, borderRadius: 15, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, studioPrimaryButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, studioPrimaryButtonArrow: { color: '#FFF', fontSize: 19 }, studioStopButton: { backgroundColor: C.coral }, studioMenuShade: { flex: 1, backgroundColor: 'rgba(29,33,69,0.22)', paddingTop: 75, paddingHorizontal: 20, alignItems: 'flex-end' }, studioMenu: { width: 260, padding: 13, borderRadius: 21, backgroundColor: '#FBFAFF' }, studioPickerShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.22)' }, studioPickerDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, studioPickerSheet: { padding: 20, paddingBottom: 25, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF' }, studioPickerOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, studioPickerTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 5, marginBottom: 8 }, studioPickerRow: { minHeight: 57, marginTop: 8, padding: 9, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECEBF3' }, studioPickerRowSelected: { backgroundColor: '#F3F1FF', borderColor: '#D9D2FA' }, studioPickerMark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, studioPickerMarkText: { color: '#FFF', fontSize: 16 }, studioPickerCopy: { flex: 1, marginLeft: 9 }, studioPickerBookTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, studioPickerBookMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, studioPickerCheck: { color: C.periwinkle, fontSize: 17, fontWeight: '700' }, studioError: { minHeight: 500, alignItems: 'center', justifyContent: 'center', padding: 24 }, studioErrorIcon: { color: C.periwinkle, fontSize: 29 }, studioErrorTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 10 }, studioErrorCopy: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 7, lineHeight: 17 },
  readerToolbar: { marginTop: 15, padding: 15, borderRadius: 20, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, readerToolbarTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 5 }, readerListenButton: { minHeight: 35, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#FFF3E9', alignItems: 'center', justifyContent: 'center' }, readerListenText: { color: '#A97819', fontSize: 9, fontWeight: '700' }, readerToc: { marginTop: 11, padding: 13, borderRadius: 20, backgroundColor: '#F2F0FF' }, readerTocTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginBottom: 5 }, readerTocRow: { minHeight: 32, paddingHorizontal: 7, borderRadius: 9, flexDirection: 'row', alignItems: 'center' }, readerTocRowSelected: { backgroundColor: '#FFF' }, readerTocNumber: { color: C.periwinkle, width: 23, fontSize: 8, fontWeight: '700' }, readerTocLabel: { flex: 1, color: C.ink, fontSize: 9 }, readerTocState: { color: C.muted, fontSize: 10 }, readerBook: { marginTop: 14, padding: 18, borderRadius: 23, backgroundColor: '#FFFDF9', shadowColor: '#81798C', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, readerTitlePage: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#EEE7DD' }, readerTitleKicker: { color: C.coral, fontSize: 8, letterSpacing: 1.2, fontWeight: '700' }, readerBookTitle: { maxWidth: 275, color: C.ink, fontSize: 31, lineHeight: 36, fontWeight: '700', textAlign: 'center', marginTop: 13 }, readerBookTitleModern: { letterSpacing: 1, textTransform: 'uppercase' }, readerBookStatus: { color: C.muted, fontSize: 9, marginTop: 9 }, readerMatter: { paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#EEE7DD' }, readerMatterTitle: { color: C.ink, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 10 }, readerChapter: { paddingTop: 29, paddingBottom: 8 }, readerChapterTitle: { color: C.ink, fontSize: 21, lineHeight: 27, fontWeight: '700', marginBottom: 14 }, readerChapterTitleModern: { color: C.periwinkle, letterSpacing: 0.7, textTransform: 'uppercase', fontSize: 17 }, readerBody: { color: '#46465C', fontSize: 16, lineHeight: 25 }, readerMissing: { padding: 15, borderRadius: 15, backgroundColor: '#F5F2FF', alignItems: 'center' }, readerMissingIcon: { color: C.periwinkle, fontSize: 22 }, readerMissingTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 7 }, readerMissingCopy: { color: C.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 4 }, readerWriteButton: { minHeight: 33, marginTop: 11, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, readerWriteButtonText: { color: '#FFF', fontSize: 9, fontWeight: '700' }, listenHero: { marginTop: 15, padding: 17, borderRadius: 22, backgroundColor: '#F1F0FF', flexDirection: 'row', alignItems: 'center' }, listenOrb: { width: 55, height: 55, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.periwinkle }, listenOrbText: { color: '#FFF', fontSize: 25 }, listenHeroCopy: { flex: 1, marginLeft: 13 }, listenTitle: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 5 }, listenCopy: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 5 }, listenControls: { marginTop: 2 }, listenNote: { color: '#9A9CB1', fontSize: 8, textAlign: 'center', marginTop: 7 }, studioSectionTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 23, marginBottom: 9 }, listenRow: { minHeight: 61, padding: 10, marginBottom: 7, borderRadius: 16, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, listenRowIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF3E9' }, listenRowIconText: { color: '#A97819', fontSize: 15 }, listenRowButton: { minHeight: 30, paddingHorizontal: 9, borderRadius: 10, backgroundColor: '#EEEDFF', justifyContent: 'center' }, listenRowButtonText: { color: C.periwinkle, fontSize: 8, fontWeight: '700' }, exportHero: { marginTop: 15, padding: 18, borderRadius: 22, backgroundColor: '#EAF4FF' }, exportTitle: { color: C.ink, fontSize: 24, lineHeight: 29, fontWeight: '700', marginTop: 6 }, exportCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 8 }, exportStats: { marginTop: 11, padding: 17, borderRadius: 19, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, exportStatValue: { color: C.ink, fontSize: 22, fontWeight: '700', textAlign: 'center' }, exportStatLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', marginTop: 4, textAlign: 'center' }, exportStatDivider: { width: 1, height: 34, backgroundColor: '#E9E8F0' }, exportFootnote: { color: '#9A9CB1', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 14, paddingHorizontal: 12 },
  navShell: { position: 'absolute', left: 13, right: 13, bottom: 12, height: 67, paddingHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 24, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#5F5C8B', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 }, navItem: { width: 45, alignItems: 'center' }, navIcon: { height: 26, color: '#A3A6C1', fontSize: 18 }, navIconActive: { color: C.periwinkle }, navLabel: { color: '#A3A6C1', fontSize: 8 }, navLabelActive: { color: C.ink, fontWeight: '700' },
}), mediaStyles);
