import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Switch, Text, TextInput, TextInputProps, View, useWindowDimensions } from 'react-native';

type StudioSection = 'assemble' | 'read' | 'listen' | 'export';
type Page = 'Library' | 'Plan' | 'Write' | 'Journey' | 'Profile' | 'Stats' | 'BookStudio';

const C = {
  ink: '#202954', muted: '#6E7699', periwinkle: '#8B8AE8', sky: '#A5DCF7', lavender: '#C9BCF5',
  sage: '#A7D4AD', peach: '#FFC09D', coral: '#F78385', gold: '#F5C75C', paper: '#F8F8FF', white: '#FFFFFF',
};

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

type ProjectPlan = {
  structure: Record<string, boolean>;
  idea: string;
  plotThread: string;
  people: string;
  plotNotes: Record<string, string>;
  unitIdeas: string[];
  partNotes: Record<string, string>;
  drafts: Record<string, string>;
  writeIndex: number;
  activity?: Record<string, DailyWritingActivity>;
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
};
type Project = { title: string; color: string; mark: string; type: string; pageGoal: string; unitGoal: string; plan: ProjectPlan; updatedAt?: number; archived?: boolean; studio?: BookStudioState };

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
  structureItems: { label: string; helper: string; recommended: boolean }[];
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

const defaultStructureFor = (blueprint: PlanBlueprint) => blueprint.structureItems.reduce<Record<string, boolean>>((result, item) => {
  result[item.label] = item.recommended;
  return result;
}, {});

const defaultPlanFor = (type: string): ProjectPlan => ({
  structure: defaultStructureFor(planBlueprints[type] ?? planBlueprints['Custom Project']),
  idea: '', plotThread: '', people: '', plotNotes: {}, unitIdeas: [], partNotes: {}, drafts: {}, writeIndex: 0, activity: {},
});

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
    const copy: Project = { ...project, title, updatedAt: Date.now(), archived: false, plan: { ...project.plan, structure: { ...project.plan.structure }, plotNotes: { ...project.plan.plotNotes }, unitIdeas: [...project.plan.unitIdeas], partNotes: { ...project.plan.partNotes }, drafts: { ...project.plan.drafts }, activity: project.plan.activity ? { ...project.plan.activity } : {} }, studio: project.studio ? { ...project.studio, frontMatterIncluded: { ...project.studio.frontMatterIncluded }, frontMatterText: { ...project.studio.frontMatterText }, backMatterIncluded: { ...project.studio.backMatterIncluded }, backMatterText: { ...project.studio.backMatterText }, chapterOrder: [...project.studio.chapterOrder], appearance: { ...project.studio.appearance } } : undefined };
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
      <View style={s.projectStats}><Text style={s.projectStatText}>{formatCount(projectSnapshot.wordCount)} words</Text><Text style={s.projectStatDot}>·</Text><Text numberOfLines={1} style={s.projectStatText}>{currentPart}</Text><Text style={s.projectStatDot}>·</Text><Text style={s.projectStatText}>{formatLastEdited(project.updatedAt)}</Text></View>
      {!project.archived && <View style={s.projectCardActions}><Pressable onPress={() => selectAndOpen(project, 'Write')} style={s.projectContinueButton}><Text style={s.projectContinueText}>Continue writing</Text><Text style={s.projectContinueArrow}>→</Text></Pressable><Pressable onPress={() => { onSelectProject(project.title); onOpenBookStudio(project.title, 'read'); }} style={s.projectPreviewButton}><Text style={s.projectPreviewText}>Preview book</Text></Pressable></View>}
    </View>;
  };

  return <><PageHeader page="Library" onPage={onPage} /><Text style={s.intro}>Pick up a thread, or begin a brand new little world.</Text>
    <View style={s.focusCard}><LinearGradient colors={['#A6DDF7', '#8B8AE8']} style={StyleSheet.absoluteFill} />
      <Text style={s.focusEyebrow}>YOUR SELECTED BOOK</Text><Text style={s.focusTitle}>{activeProject}</Text><Text style={s.focusCopy}>Follow the thread from first idea to finished manuscript.</Text>
      <View style={s.focusActions}><Pressable onPress={() => onPage('Write')} style={s.lightAction}><Text style={s.lightActionText}>Open manuscript</Text><Text style={s.lightArrow}>→</Text></Pressable><Pressable onPress={() => onPage('Journey')} style={s.focusJourneyAction}><Text style={s.focusJourneyActionText}>View journey</Text></Pressable></View>
      <Text style={s.focusShape}>◢</Text>
    </View>
    <View style={s.sectionBar}><Text style={s.sectionTitle}>Your projects</Text><Pressable onPress={() => setComposerOpen(true)} style={s.newProjectButton}><Text style={s.newProjectText}>+ NEW</Text></Pressable></View>
    <Text style={s.librarySectionEyebrow}>YOUR BOOKS</Text>
    {projects.filter((project) => !project.archived).map(renderProjectCard)}
    {projects.some((project) => project.archived) && <><Text style={s.librarySectionEyebrow}>ARCHIVED</Text>{projects.filter((project) => project.archived).map(renderProjectCard)}</>}
    <Pressable onPress={() => setComposerOpen(true)} style={s.addProjectRow}><View style={s.addProjectPlus}><Text style={s.addProjectPlusText}>+</Text></View><View><Text style={s.addProjectTitle}>Start another project</Text><Text style={s.addProjectSub}>Choose a format and make it yours</Text></View></Pressable>

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
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState(currentPlan.idea);
  const [plotThread, setPlotThread] = useState(currentPlan.plotThread);
  const [people, setPeople] = useState(currentPlan.people);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [structure, setStructure] = useState(currentPlan.structure);
  const [structurePage, setStructurePage] = useState(0);
  const [plotNotes, setPlotNotes] = useState<Record<string, string>>(currentPlan.plotNotes);
  const [unitIdeas, setUnitIdeas] = useState<string[]>(currentPlan.unitIdeas);
  const [storyMapPage, setStoryMapPage] = useState(0);

  const selectedType = projectTypes.find((type) => type.name === currentProject?.type) ?? projectTypes[projectTypes.length - 1];
  const blueprint = planBlueprints[selectedType.name];
  const pageGoal = currentProject?.pageGoal ?? blueprint.defaultPages;
  const unitGoal = currentProject?.unitGoal ?? blueprint.defaultUnits;
  const unitCount = Math.max(Number.parseInt(unitGoal, 10) || 0, 0);
  const structurePageSize = 4;
  const structurePageCount = Math.max(1, Math.ceil(blueprint.structureItems.length / structurePageSize));
  const visibleStructureItems = blueprint.structureItems.slice(structurePage * structurePageSize, (structurePage + 1) * structurePageSize);
  const structurePageStart = structurePage * structurePageSize + 1;
  const structurePageEnd = Math.min((structurePage + 1) * structurePageSize, blueprint.structureItems.length);
  const storyMapPromptPageSize = 3;
  const storyMapPromptPageCount = Math.max(1, Math.ceil(blueprint.plotPrompts.length / storyMapPromptPageSize));
  const storyMapUnitPageSize = 4;
  const storyMapUnitPageCount = Math.max(1, Math.ceil(unitCount / storyMapUnitPageSize));
  const peoplePageIndex = 2 + storyMapPromptPageCount;
  const unitPagesStartIndex = peoplePageIndex + 1;
  const storyMapPageCount = unitPagesStartIndex + storyMapUnitPageCount;
  const activeStoryMapPage = Math.min(storyMapPage, storyMapPageCount - 1);
  const activePromptPage = activeStoryMapPage - 2;
  const activeUnitPage = activeStoryMapPage - unitPagesStartIndex;
  const visiblePlotPrompts = blueprint.plotPrompts.slice(activePromptPage * storyMapPromptPageSize, (activePromptPage + 1) * storyMapPromptPageSize);
  const visibleUnitStart = activeUnitPage * storyMapUnitPageSize;
  const visibleUnitIndexes = Array.from({ length: Math.min(storyMapUnitPageSize, Math.max(0, unitCount - visibleUnitStart)) }, (_, index) => visibleUnitStart + index);
  const storyMapPageLabel = activeStoryMapPage === 0 ? 'Big idea' : activeStoryMapPage === 1 ? 'Arc overview' : activeStoryMapPage < peoplePageIndex ? `${blueprint.plotLabel} · ${activePromptPage + 1} / ${storyMapPromptPageCount}` : activeStoryMapPage === peoplePageIndex ? blueprint.peopleLabel : `${blueprint.unitLabelPlural[0].toUpperCase() + blueprint.unitLabelPlural.slice(1)} · ${activeUnitPage + 1} / ${storyMapUnitPageCount}`;

  const persistPlan = (changes: Partial<ProjectPlan>) => onUpdateProject(activeProject, { plan: { ...currentPlan, ...changes } });

  const chooseProject = (project: Project) => {
    if (project.title === activeProject) return;
    const nextPlan = project.plan ?? defaultPlanFor(project.type);
    onSelectProject(project.title);
    setIdea(nextPlan.idea);
    setPlotThread(nextPlan.plotThread);
    setPeople(nextPlan.people);
    setStructure(nextPlan.structure);
    setStructurePage(0);
    setPlotNotes(nextPlan.plotNotes);
    setUnitIdeas(nextPlan.unitIdeas);
    setStoryMapPage(0);
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
    const next = { ...structure, [label]: !structure[label] };
    setStructure(next);
    persistPlan({ structure: next });
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
      <Text style={s.planHeroCopy}>Choose a format, then make the plan feel like yours.</Text>
      <Text style={s.planHeroOrb}>◒</Text>
    </View>

    <View style={s.planSelectedCard}>
      <View style={[s.planSelectedIcon, { backgroundColor: selectedType.color }]}><Text style={s.planSelectedIconText}>{selectedType.icon}</Text></View>
      <View style={{ flex: 1 }}><Text style={s.planSelectedOverline}>PLANNING</Text><Text style={s.planSelectedTitle}>{selectedType.name}</Text><Text style={s.planSelectedSub}>{blueprint.unitLabelPlural} · {pageGoal || '—'} pages</Text></View>
      <Pressable onPress={() => onPage('Journey')} style={s.planJourneyLink}><Text style={s.planJourneyLinkText}>Journey</Text><Text style={s.planSelectedArrow}>✦</Text></Pressable>
    </View>

    <View style={s.planSteps}>
      {stepMeta.map((item, index) => <Pressable key={item.label} onPress={() => setStep(index)} style={[s.planStep, step === index && s.planStepActive]}>
        <View style={[s.planStepNumber, step === index && s.planStepNumberActive]}><Text style={[s.planStepNumberText, step === index && s.planStepNumberTextActive]}>{index + 1}</Text></View>
        <View><Text style={[s.planStepLabel, step === index && s.planStepLabelActive]}>{item.label}</Text><Text style={s.planStepShort}>{item.short}</Text></View>
      </Pressable>)}
    </View>

    {step === 0 && <View style={s.planStepCard}>
      <Text style={s.planSectionKicker}>SECTION 1 · SET THE SCOPE</Text>
      <Text style={s.planSectionTitle}>How big should this be?</Text>
      <Text style={s.planSectionCopy}>Give the project a gentle container. You can change these numbers whenever the work asks for more room.</Text>
      <View style={s.metricRow}>
        <View style={s.metricCard}><Text style={s.metricLabel}>TARGET PAGES</Text><TextInput value={pageGoal} onChangeText={(value) => onUpdateProject(activeProject, { pageGoal: value })} keyboardType="number-pad" selectTextOnFocus style={s.metricInput} /><Text style={s.metricHint}>Always editable</Text></View>
        <View style={s.metricCard}><Text style={s.metricLabel}>TARGET {blueprint.unitLabelPlural.toUpperCase()}</Text><TextInput value={unitGoal} onChangeText={(value) => onUpdateProject(activeProject, { unitGoal: value })} keyboardType="number-pad" selectTextOnFocus style={s.metricInput} /><Text style={s.metricHint}>Always editable</Text></View>
      </View>
      <View style={s.planTip}><Text style={s.planTipIcon}>✦</Text><Text style={s.planTipText}>{blueprint.scopeHelper}</Text></View>
    </View>}

    {step === 1 && <View style={s.planStepCard}>
      <Text style={s.planSectionKicker}>SECTION 2 · BUILD THE CONTAINER</Text>
      <Text style={s.planSectionTitle}>What belongs in it?</Text>
      <Text style={s.planSectionCopy}>{blueprint.structureIntro} Every part is optional. Recommended pieces start selected, and you can tap any row to add or take away whatever does not fit.</Text>
      <View style={s.structureLegend}><View style={s.structureLegendItem}><View style={[s.structureLegendDot, s.structureLegendDotRecommended]} /><Text style={s.structureLegendText}>Recommended</Text></View><View style={s.structureLegendItem}><View style={s.structureLegendDot} /><Text style={s.structureLegendText}>Optional</Text></View><Text style={s.structureLegendHint}>Tap to toggle</Text></View>
      <View style={s.structureChecklistHeader}><View style={s.structureChecklistCopy}><Text style={s.structureChecklistTitle}>PARTS TO INCLUDE</Text><Text style={s.structureChecklistHint}>Showing {structurePageStart}–{structurePageEnd} of {blueprint.structureItems.length} parts</Text></View>{structurePageCount > 1 && <View style={s.structurePager}><Pressable onPress={() => setStructurePage(Math.max(0, structurePage - 1))} disabled={structurePage === 0} style={[s.structurePagerButton, structurePage === 0 && s.structurePagerButtonDisabled]} accessibilityLabel="Previous checklist page"><Text style={s.structurePagerButtonText}>‹</Text></Pressable><Text style={s.structurePagerCount}>{structurePage + 1} / {structurePageCount}</Text><Pressable onPress={() => setStructurePage(Math.min(structurePageCount - 1, structurePage + 1))} disabled={structurePage === structurePageCount - 1} style={[s.structurePagerButton, structurePage === structurePageCount - 1 && s.structurePagerButtonDisabled]} accessibilityLabel="Next checklist page"><Text style={s.structurePagerButtonText}>›</Text></Pressable></View>}</View>
      <View style={s.structureList}>
        {visibleStructureItems.map((item) => <Pressable key={item.label} onPress={() => toggleStructure(item.label)} style={[s.structureRow, structure[item.label] && s.structureRowActive]}>
          <View style={[s.structureCheck, structure[item.label] && s.structureCheckOn]}><Text style={s.structureCheckText}>{structure[item.label] ? '✓' : ''}</Text></View>
          <View style={s.structureCopy}><Text style={s.structureLabel}>{item.label}</Text><Text style={s.structureHelper}>{item.helper}</Text></View>
          <Text style={[s.partTag, item.recommended ? s.recommendedTag : s.optionalTag]}>{item.recommended ? 'RECOMMENDED' : 'OPTIONAL'}</Text>
        </Pressable>)}
      </View>
      <View style={s.structureFooterRow}>
        <Text style={[s.structureFooter, s.structureFooterCompact]}>{Object.values(structure).filter(Boolean).length} pieces in your current plan</Text>
      </View>
    </View>}

    {step === 2 && <View style={s.planStepCard}>
      <Text style={s.planSectionKicker}>SECTION 3 · MAKE THE STORY MAP</Text>
      <Text style={s.planSectionTitle}>Put the heart on the page.</Text>
      <Text style={s.planSectionCopy}>Start loose. These notes are here to give you somewhere to return when the draft gets foggy. Tap 🎙 on any writing field to use your phone’s dictation.</Text>

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

      {activeStoryMapPage >= unitPagesStartIndex && <>
        <View style={s.chapterHeader}><View><Text style={s.planSubheading}>{blueprint.unitLabelPlural[0].toUpperCase() + blueprint.unitLabelPlural.slice(1)} map</Text><Text style={s.chapterHeaderHint}>One note for each {blueprint.unitLabel} keeps the draft moving.</Text></View><View style={s.chapterCountBadge}><Text style={s.chapterCountText}>{unitCount || '—'}</Text></View></View>
        {unitCount > 0 ? visibleUnitIndexes.map((index) => <View key={index} style={s.chapterRow}><View style={s.chapterIndex}><Text style={s.chapterIndexText}>{String(index + 1).padStart(2, '0')}</Text></View><DictationInput grow value={unitIdeas[index] || ''} onChangeText={(value) => updateUnitIdea(index, value)} placeholder={`${blueprint.unitLabel[0].toUpperCase() + blueprint.unitLabel.slice(1)} ${index + 1}: what happens, is taught, or is felt?`} placeholderTextColor="#A0A3BB" multiline style={s.chapterTextInput} accessibilityLabel={`${blueprint.unitLabel} ${index + 1}`} /></View>) : <View style={s.emptyChapter}><Text style={s.emptyChapterIcon}>⌁</Text><Text style={s.emptyChapterText}>Set a target number in Section 1 and your {blueprint.unitLabelPlural} map will appear here.</Text></View>}
      </>}
    </View>}

    <View style={s.planFooter}>
      <Pressable onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={[s.planNavButton, step === 0 && s.planNavButtonDisabled]}><Text style={s.planNavButtonText}>← Back</Text></Pressable>
      <Text style={s.planFooterText}>STEP {step + 1} OF 3</Text>
      <Pressable onPress={() => setStep(Math.min(2, step + 1))} disabled={step === 2} style={[s.planNavButton, s.planNavButtonPrimary, step === 2 && s.planNavButtonDisabled]}><Text style={[s.planNavButtonText, s.planNavButtonTextPrimary]}>{step === 2 ? 'Plan ready' : 'Next →'}</Text></Pressable>
    </View>

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

type WritePart = { key: string; title: string; helper: string; kind: 'structure' | 'unit'; unitIndex?: number };

const compactNote = (value: string) => value.trim().replace(/\s+/g, ' ').length > 150 ? `${value.trim().replace(/\s+/g, ' ').slice(0, 147)}…` : value.trim().replace(/\s+/g, ' ');

function getWriteParts(project: Project, blueprint: PlanBlueprint): WritePart[] {
  const structureParts = blueprint.structureItems.filter((item) => project.plan.structure[item.label]).map((item) => ({ key: `structure:${item.label}`, title: item.label, helper: item.helper, kind: 'structure' as const }));
  const unitCount = Math.max(Number.parseInt(project.unitGoal, 10) || 0, 0);
  const unitParts = Array.from({ length: unitCount }, (_, index) => ({ key: `unit:${index}`, title: `${blueprint.unitLabel[0].toUpperCase() + blueprint.unitLabel.slice(1)} ${index + 1}`, helper: `Draft the part that belongs in this ${blueprint.unitLabel}.`, kind: 'unit' as const, unitIndex: index }));
  return [...structureParts, ...unitParts];
}

type AssembledSection = { id: string; label: string; content: string; included: boolean; complete: boolean; kind: 'front' | 'back' };
type AssembledChapter = { key: string; title: string; content: string; words: number; complete: boolean; kind: WritePart['kind'] };
type AssembledBook = { bookId: string; title: string; status: 'draft' | 'review' | 'finished'; frontMatter: AssembledSection[]; chapters: AssembledChapter[]; backMatter: AssembledSection[]; totalWords: number; generatedAt: string; sourceRevision: string };

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
  const parts = getWriteParts(project, blueprint);
  const partMap = new Map(parts.map((part) => [part.key, part]));
  const orderedKeys = [...studio.chapterOrder.filter((key) => partMap.has(key)), ...parts.map((part) => part.key).filter((key) => !studio.chapterOrder.includes(key))];
  const chapters = orderedKeys.map((key) => {
    const part = partMap.get(key)!;
    const content = project.plan.drafts[key]?.trim() ?? '';
    return { key, title: part.title, content, words: countWords(content), complete: Boolean(content), kind: part.kind };
  });
  const tableOfContents = chapters.map((chapter, index) => `${index + 1}. ${chapter.title}`).join('\n');
  const frontMatter = studioFrontMatter.map((item) => ({
    id: item.id, label: item.label, kind: 'front' as const, included: Boolean(studio.frontMatterIncluded[item.id]), complete: item.automatic ? true : Boolean(studio.frontMatterText[item.id]?.trim()),
    content: item.id === 'titlePage' ? project.title : item.id === 'tableOfContents' ? tableOfContents : studio.frontMatterText[item.id]?.trim() ?? '',
  }));
  const backMatter = studioBackMatter.map((item) => ({ id: item.id, label: item.label, kind: 'back' as const, included: Boolean(studio.backMatterIncluded[item.id]), complete: Boolean(studio.backMatterText[item.id]?.trim()), content: studio.backMatterText[item.id]?.trim() ?? '' }));
  const totalWords = chapters.reduce((total, chapter) => total + chapter.words, 0);
  const status = totalWords === 0 ? 'draft' : project.plan.writeIndex >= parts.length && parts.length > 0 ? 'finished' : 'review';
  return { bookId: project.title, title: project.title, status, frontMatter, chapters, backMatter, totalWords, generatedAt: new Date().toISOString(), sourceRevision: String(project.updatedAt ?? totalWords) };
}

const buildBookText = (book: AssembledBook) => [...book.frontMatter.filter((section) => section.included && section.content), ...book.chapters.map((chapter) => ({ content: `${chapter.title}\n\n${chapter.content}` })), ...book.backMatter.filter((section) => section.included && section.content)].map((section) => section.content).join('\n\n\n').trim();
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
type JourneyMilestone = { id: string; title: string; detail: string; icon: string; status: JourneyStatus };

type JourneySnapshot = {
  blueprint: PlanBlueprint;
  parts: WritePart[];
  draftedParts: number;
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
  currentMilestoneIndex: number;
  progressPercent: number;
  stage: string;
  nextPart?: WritePart;
};

const countWords = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;
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

function getJourneySnapshot(project: Project): JourneySnapshot {
  const blueprint = planBlueprints[project.type] ?? planBlueprints['Custom Project'];
  const plan = project.plan ?? defaultPlanFor(project.type);
  const parts = getWriteParts({ ...project, plan }, blueprint);
  const unitCount = Math.max(Number.parseInt(project.unitGoal, 10) || 0, 0);
  const draftedParts = parts.filter((part) => Boolean(plan.drafts[part.key]?.trim())).length;
  const completedUnits = parts.filter((part) => part.kind === 'unit' && Boolean(plan.drafts[part.key]?.trim())).length;
  const selectedStructureCount = blueprint.structureItems.filter((item) => plan.structure[item.label]).length;
  const wordCount = Object.values(plan.drafts).reduce((total, draft) => total + countWords(draft), 0);
  const targetPages = Math.max(Number.parseInt(project.pageGoal, 10) || 0, 0);
  const targetWords = targetPages * 250;
  const ideaReady = Boolean(plan.idea.trim());
  const foundationReady = targetPages > 0 && unitCount > 0 && selectedStructureCount > 0;
  const outlineReady = foundationReady && Boolean(
    plan.plotThread.trim() || plan.people.trim() || Object.values(plan.plotNotes).some((note) => note.trim()) || plan.unitIdeas.some((idea) => idea.trim()),
  );
  const firstDraftStarted = draftedParts > 0;
  const halfwayReady = parts.length > 0 && draftedParts >= Math.ceil(parts.length / 2);
  const draftComplete = parts.length > 0 && draftedParts === parts.length;
  const manuscriptComplete = draftComplete && plan.writeIndex >= parts.length;
  const completedStates = [ideaReady, foundationReady, outlineReady, firstDraftStarted, halfwayReady, draftComplete, manuscriptComplete, manuscriptComplete];
  const currentMilestoneIndex = manuscriptComplete ? 7 : draftComplete ? 6 : halfwayReady ? 5 : firstDraftStarted ? 4 : outlineReady ? 3 : foundationReady ? 2 : ideaReady ? 1 : 0;
  const progressPercent = Math.round((completedStates.filter(Boolean).length / completedStates.length) * 100);
  const stage = manuscriptComplete ? 'Finished manuscript' : draftComplete ? 'Review & polish' : firstDraftStarted ? 'First draft' : outlineReady ? 'Ready to write' : foundationReady ? 'Book foundation' : ideaReady ? 'Book foundation' : 'Book idea';

  return {
    blueprint, parts, draftedParts, completedUnits, unitCount, selectedStructureCount, wordCount, targetWords,
    ideaReady, foundationReady, outlineReady, firstDraftStarted, halfwayReady, draftComplete, manuscriptComplete,
    currentMilestoneIndex, progressPercent, stage, nextPart: parts.find((part) => !plan.drafts[part.key]?.trim()) ?? parts[0],
  };
}

function getJourneyMilestones(snapshot: JourneySnapshot): JourneyMilestone[] {
  const completed = [
    snapshot.ideaReady,
    snapshot.foundationReady,
    snapshot.outlineReady,
    snapshot.firstDraftStarted,
    snapshot.halfwayReady,
    snapshot.draftComplete,
    snapshot.manuscriptComplete,
    snapshot.manuscriptComplete,
  ];
  const details = [
    snapshot.ideaReady ? 'The promise of this book is written down.' : 'Give the work a clear promise to follow.',
    snapshot.foundationReady ? `${snapshot.selectedStructureCount} planned pieces are ready to carry the work.` : 'Set the shape, scale, and pieces of the book.',
    snapshot.outlineReady ? 'Your notes are giving the book a direction.' : 'Add a throughline, notes, or part ideas.',
    snapshot.firstDraftStarted ? `${snapshot.draftedParts} ${snapshot.blueprint.unitLabelPlural} or parts have words in them.` : 'Open the manuscript and make the first part real.',
    snapshot.halfwayReady ? 'The middle of the route is behind you.' : `Keep going until ${Math.ceil(snapshot.parts.length / 2) || 'the first'} parts have a draft.`,
    snapshot.draftComplete ? 'Every selected part has a draft.' : `${snapshot.draftedParts} of ${snapshot.parts.length} parts are drafted.`,
    snapshot.manuscriptComplete ? 'You reached the end of the writing path.' : 'Read through the whole draft and make the last pass.',
    snapshot.manuscriptComplete ? 'All planned parts are written. The book is ready to carry forward.' : 'A finished book is waiting at the end of this path.',
  ];
  const icons = ['✦', '◈', '⌁', '✎', '◌', '✓', '✧', '★'];
  const titles = ['Book idea', 'Book foundation', 'Outline', 'First chapter', 'Halfway point', 'Draft complete', 'Review & polish', 'Finished book'];
  return titles.map((title, index) => ({
    id: title.toLowerCase().replace(/[^a-z]+/g, '-'), title, detail: details[index], icon: icons[index],
    status: completed[index] ? 'complete' : index === snapshot.currentMilestoneIndex ? 'current' : 'future',
  }));
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
  return notes.slice(0, 4).map((note) => ({ ...note, value: compactNote(note.value) }));
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

function Write({ projects, activeProject, onSelectProject, onUpdateProject, onPage }: { projects: Project[]; activeProject: string; onSelectProject: (title: string) => void; onUpdateProject: (title: string, changes: Partial<Project>) => void; onPage: (page: Page) => void }) {
  const currentProject = projects.find((project) => project.title === activeProject) ?? projects[0];
  const blueprint = planBlueprints[currentProject.type] ?? planBlueprints['Custom Project'];
  const plan = currentProject.plan ?? defaultPlanFor(currentProject.type);
  const parts = getWriteParts(currentProject, blueprint);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const activeIndex = parts.length ? Math.min(plan.writeIndex, parts.length - 1) : 0;
  const activePart = parts[activeIndex];
  const completed = parts.length > 0 && plan.writeIndex >= parts.length;
  const completedPartCount = parts.filter((part) => plan.drafts[part.key]?.trim()).length;
  const completionPercent = parts.length ? Math.round((completedPartCount / parts.length) * 100) : 0;
  const contextNotes = activePart ? getWriteContext(activePart, plan, blueprint) : [];
  const lastActivityAt = useRef(Date.now());
  const pendingWritingUses = useRef(0);
  const latestPlans = useRef<Record<string, ProjectPlan>>({});
  projects.forEach((project) => { latestPlans.current[project.title] = project.plan ?? defaultPlanFor(project.type); });

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

  const chooseProject = (project: Project) => {
    onSelectProject(project.title);
    setNotesOpen(false);
    setProjectMenuOpen(false);
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
  };
  const goNext = () => {
    if (!parts.length) return;
    setNotesOpen(false);
    const currentPlan = currentProject.plan ?? defaultPlanFor(currentProject.type);
    onUpdateProject(activeProject, { plan: { ...currentPlan, writeIndex: Math.min(parts.length, activeIndex + 1), activity: addActivity(currentPlan, { completion: completionPercent, minutes: consumeActiveMinutes() }) } });
  };
  const goBack = () => {
    if (!parts.length) return;
    setNotesOpen(false);
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

  return <>
    <View style={s.writeProjectBar}>
      <Pressable onPress={() => setProjectMenuOpen(true)} style={s.writeProjectSwitcher} accessibilityLabel="Switch writing project">
        <View style={[s.writeProjectIcon, { backgroundColor: currentProject.color }]}><Text style={s.writeProjectIconText}>{currentProject.mark}</Text></View>
        <View style={s.writeProjectCopy}><Text style={s.writeProjectOverline}>WRITING</Text><Text numberOfLines={1} style={s.writeProjectTitle}>{currentProject.title}</Text></View>
        <Text style={s.writeProjectChevron}>⌄</Text>
      </Pressable><Pressable onPress={() => onPage('Journey')} style={s.writeJourneyLink}><Text style={s.writeJourneyLinkText}>Journey</Text><Text style={s.writeJourneyLinkArrow}>↗</Text></Pressable>
    </View>

    <View style={s.writeTop}><View><Text style={s.overline}>{currentProject.title.toUpperCase()}</Text><Text style={s.writeTitle}>{completed ? 'The manuscript is complete.' : 'Keep the thread.'}</Text></View><Text style={s.writeFormat}>{blueprint.unitLabelPlural}</Text></View>

    {!parts.length && <View style={s.writeEmpty}><Text style={s.writeEmptyIcon}>✦</Text><Text style={s.writeEmptyTitle}>Your writing path is waiting.</Text><Text style={s.writeEmptyCopy}>Go to Plan → Structure and check the parts you want to write. Then they will appear here in order.</Text></View>}

    {completed && <View style={s.writeComplete}><Text style={s.writeCompleteIcon}>✦</Text><Text style={s.writeCompleteTitle}>You made it all the way through.</Text><Text style={s.writeCompleteCopy}>Your checked structure and {blueprint.unitLabelPlural} are complete. You can revisit any part with the back button or switch projects above.</Text><Pressable onPress={goBack} style={s.writeSecondaryButton}><Text style={s.writeSecondaryButtonText}>Review last part</Text></Pressable></View>}

    {activePart && !completed && <>
      <View style={s.writePartHeader}><View style={s.writePartNumber}><Text style={s.writePartNumberText}>{String(activeIndex + 1).padStart(2, '0')}</Text></View><View style={s.writePartCopy}><Text style={s.writePartKicker}>{activePart.kind === 'unit' ? blueprint.unitLabel.toUpperCase() : 'STRUCTURE PART'}</Text><Text style={s.writePartTitle}>{activePart.title}</Text><Text style={s.writePartHelper}>{activePart.helper}</Text></View><View style={s.writeProgress}><View style={s.writeProgressTop}><Text style={s.writeProgressValue}>{completionPercent}%</Text><Text style={s.writeProgressLabel}>COMPLETE</Text></View><View style={s.writeProgressTrack}><View style={[s.writeProgressFill, { width: `${completionPercent}%` }]} /></View><Text style={s.writeProgressText}>{completed ? 'MANUSCRIPT READY' : `PART ${parts.length ? activeIndex + 1 : 0} / ${parts.length}`}</Text></View></View>
      <View style={s.writeNotesBanner}><Pressable onPress={() => setNotesOpen(!notesOpen)} style={s.writeNotesTapArea} accessibilityLabel="Open notes for this part"><View style={s.writeNotesIcon}><Text style={s.writeNotesIconText}>✦</Text></View><View style={s.writeNotesCopy}><View style={s.writeNotesTitleRow}><Text style={s.writeNotesLabel}>PLAN NOTES TO KEEP CLOSE</Text><Text style={s.writeNotesAction}>{notesOpen ? 'CLOSE' : 'ADD NOTE'}</Text></View>{contextNotes.length ? contextNotes.map((note) => <View key={note.label} style={s.writeNoteRow}><Text style={s.writeNoteLabel}>{note.label}</Text><Text style={s.writeNoteText}>{note.value}</Text></View>) : <Text style={s.writeNotesEmpty}>No notes yet. Tap here to add a thought for this part.</Text>}</View></Pressable>{plan.partNotes[activePart.key]?.trim() && !notesOpen && <View style={s.writeSavedNote}><Text style={s.writeSavedNoteLabel}>YOUR NOTE</Text><Text style={s.writeSavedNoteText}>{compactNote(plan.partNotes[activePart.key])}</Text></View>}{notesOpen && <View style={s.writeQuickNote}><Text style={s.writeQuickNoteLabel}>A NOTE FOR THIS PART</Text><DictationInput value={plan.partNotes[activePart.key] || ''} onChangeText={updatePartNote} placeholder="Capture a thought to keep beside the draft…" placeholderTextColor="#A0A3BB" multiline style={s.writeQuickNoteInput} accessibilityLabel="Note for this part" /></View>}</View>
      <View style={s.writeEditorCard}><View style={s.writeEditorTop}><Text style={s.writeEditorLabel}>WRITE THIS PART</Text><Text style={s.writeEditorHint}>🎙 Dictate with your phone</Text></View><DictationInput value={plan.drafts[activePart.key] || ''} onChangeText={updateDraft} onInputMode={recordInputMode} placeholder={`Begin your ${activePart.title.toLowerCase()}…`} placeholderTextColor="#9A9DB7" multiline autoCorrect spellCheck style={s.writeEditorInput} accessibilityLabel={activePart.title} /><View style={s.writeTools}><Pressable onPress={() => updateDraftWithTool(polishWriting)} disabled={!plan.drafts[activePart.key]?.trim()} style={[s.writeToolButton, !plan.drafts[activePart.key]?.trim() && s.writeToolDisabled]} accessibilityLabel="Polish writing"><Text style={s.writeToolIcon}>✦</Text><Text style={s.writeToolText}>Polish</Text></Pressable><Pressable onPress={() => updateDraftWithTool(grammarWriting)} disabled={!plan.drafts[activePart.key]?.trim()} style={[s.writeToolButton, !plan.drafts[activePart.key]?.trim() && s.writeToolDisabled]} accessibilityLabel="Fix grammar"><Text style={s.writeToolIcon}>Aa</Text><Text style={s.writeToolText}>Grammar</Text></Pressable><Text style={s.writeToolHint}>Quick local cleanup</Text></View></View>
      <View style={s.writeNavigation}><Pressable onPress={goBack} disabled={activeIndex === 0} style={[s.writeSecondaryButton, activeIndex === 0 && s.writeButtonDisabled]}><Text style={s.writeSecondaryButtonText}>← Previous</Text></Pressable><Pressable onPress={goNext} style={s.writeNextButton}><Text style={s.writeNextButtonText}>{activeIndex === parts.length - 1 ? 'Finish manuscript' : 'Next part →'}</Text></Pressable></View>
    </>}

    <Modal animationType="fade" transparent visible={projectMenuOpen} onRequestClose={() => setProjectMenuOpen(false)}>
      <Pressable style={s.writeMenuShade} onPress={() => setProjectMenuOpen(false)}>
        <View style={s.writeMenu}><Text style={s.writeMenuHeader}>SWITCH PROJECT</Text><Text style={s.writeMenuHint}>Choose a manuscript to write.</Text>{projects.map((project) => <Pressable key={project.title} onPress={() => chooseProject(project)} style={[s.writeMenuRow, project.title === activeProject && s.writeMenuRowActive]}><View style={[s.writeMenuIcon, { backgroundColor: project.color }]}><Text style={s.writeMenuIconText}>{project.mark}</Text></View><View style={s.writeMenuCopy}><Text numberOfLines={1} style={s.writeMenuProject}>{project.title}</Text><Text numberOfLines={1} style={s.writeMenuType}>{project.type}</Text></View><Text style={s.writeMenuCheck}>{project.title === activeProject ? '✓' : ''}</Text></Pressable>)}</View>
      </Pressable>
    </Modal>
  </>;
}

function Journey({ projects, activeProject, onSelectProject, onPage, onBack, onOpenBookStudio }: { projects: Project[]; activeProject: string; onSelectProject: (title: string) => void; onPage: (page: Page) => void; onBack: () => void; onOpenBookStudio: (title: string, section: StudioSection) => void }) {
  const currentProject = projects.find((project) => project.title === activeProject) ?? projects[0];
  const snapshot = getJourneySnapshot(currentProject);
  const milestones = getJourneyMilestones(snapshot);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const mapWidth = Math.max(280, width - 40);
  const rowHeight = 126;
  const nodeWidth = 144;
  const positions = [0.24, 0.76, 0.49, 0.23, 0.76, 0.49, 0.23, 0.76];
  const points = milestones.map((_, index) => ({ x: mapWidth * positions[index], y: 28 + index * rowHeight }));
  const mapHeight = milestones.length * rowHeight + 35;
  const currentMilestone = milestones[snapshot.currentMilestoneIndex] ?? milestones[milestones.length - 1];
  const nextPage: Page = snapshot.manuscriptComplete ? 'Write' : snapshot.ideaReady && snapshot.foundationReady && snapshot.outlineReady ? 'Write' : 'Plan';
  const nextAction = snapshot.manuscriptComplete ? 'Review the manuscript' : !snapshot.ideaReady ? 'Start with your book idea' : !snapshot.foundationReady ? 'Complete Book Foundation' : !snapshot.outlineReady ? 'Continue Outline' : !snapshot.firstDraftStarted ? 'Write your first part' : snapshot.nextPart ? `Write ${snapshot.nextPart.title}` : 'Continue manuscript';

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

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
      <View style={s.journeyNextRow}><View style={s.journeyNextDot}><Text style={s.journeyNextDotText}>{currentMilestone.icon}</Text></View><View style={s.journeyNextCopy}><Text style={s.journeyNextEyebrow}>NEXT MILESTONE</Text><Text style={s.journeyNextTitle}>{currentMilestone.title}</Text></View><Text style={s.journeyNextArrow}>→</Text></View>
      <Pressable onPress={() => snapshot.manuscriptComplete ? onOpenBookStudio(currentProject.title, 'read') : onPage(nextPage)} style={s.journeyContinueButton}><Text style={s.journeyContinueText}>{snapshot.manuscriptComplete ? 'Open Book Studio' : 'Continue Journey'}</Text><Text style={s.journeyContinueAction}>{nextAction}</Text><Text style={s.journeyContinueArrow}>→</Text></Pressable>
    </View>

    <View style={s.journeyMapHeading}><View><Text style={s.journeyMapEyebrow}>THE LONG WAY AROUND</Text><Text style={s.journeyMapTitle}>One book, one steady path.</Text></View><Text style={s.journeyMapHint}>Scroll to travel</Text></View>
    <View style={[s.journeyMap, { height: mapHeight }]}>
      {points.slice(0, -1).map((point, index) => {
        const nextPoint = points[index + 1];
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return <View key={`route-${index}`} style={[s.journeyRoute, index < snapshot.currentMilestoneIndex && s.journeyRouteComplete, { left: (point.x + nextPoint.x - length) / 2, top: (point.y + nextPoint.y) / 2, width: length, transform: [{ rotate: `${angle}deg` }] }]} />;
      })}
      {milestones.map((milestone, index) => {
        const node = <Animated.View style={[s.journeyNode, milestone.status === 'complete' ? s.journeyNodeComplete : milestone.status === 'current' ? s.journeyNodeCurrent : s.journeyNodeFuture, milestone.status === 'current' && { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }]}><Text style={s.journeyNodeIcon}>{milestone.icon}</Text></Animated.View>;
        return <View key={milestone.id} style={[s.journeyMilestone, { left: points[index].x - nodeWidth / 2, top: index * rowHeight, width: nodeWidth }]}>
          {node}
          <View style={[s.journeyMilestoneCard, milestone.status === 'current' && s.journeyMilestoneCardCurrent, milestone.status === 'complete' && s.journeyMilestoneCardComplete]}><View style={s.journeyMilestoneTitleRow}><Text style={s.journeyMilestoneTitle}>{milestone.title}</Text><Text style={[s.journeyMilestoneState, milestone.status === 'complete' ? s.journeyStateComplete : milestone.status === 'current' ? s.journeyStateCurrent : s.journeyStateFuture]}>{milestone.status === 'complete' ? 'DONE' : milestone.status === 'current' ? 'NOW' : 'UP NEXT'}</Text></View><Text style={s.journeyMilestoneDetail}>{milestone.detail}</Text></View>
        </View>;
      })}
    </View>

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
  const updateStudio = (changes: Partial<BookStudioState>) => { const next = { ...studio, ...changes }; setStudio(next); onUpdateProject(project.title, { studio: next }); };
  const changeSection = (nextSection: StudioSection) => { setSection(nextSection); updateStudio({ lastSection: nextSection }); };
  const openWritingPart = (key: string) => { const originalIndex = getWriteParts(project, snapshot.blueprint).findIndex((part) => part.key === key); onUpdateProject(project.title, { plan: { ...project.plan, writeIndex: Math.max(0, originalIndex) } }); onPage('Write'); };
  const refreshPreview = () => updateStudio({ lastSection: section });
  const toggleIncluded = (group: 'frontMatterIncluded' | 'backMatterIncluded', id: string) => updateStudio({ [group]: { ...studio[group], [id]: !studio[group][id] } } as Partial<BookStudioState>);
  const updateText = (group: 'frontMatterText' | 'backMatterText', id: string, value: string) => updateStudio({ [group]: { ...studio[group], [id]: value } } as Partial<BookStudioState>);
  const moveChapter = (index: number, direction: -1 | 1) => { const keys = book.chapters.map((chapter) => chapter.key); const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= keys.length) return; [keys[index], keys[nextIndex]] = [keys[nextIndex], keys[index]]; updateStudio({ chapterOrder: keys }); };
  const shareBook = async () => { const text = buildBookText(book); if (!text) { Alert.alert('Nothing to export yet', 'Write at least one part before sharing this book.'); return; } try { await Share.share({ title: project.title, message: text }); } catch { Alert.alert('Export unavailable', 'Your device could not open the share sheet.'); } };
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
  const renderAssemble = () => <><View style={s.studioSummaryCard}><View><Text style={s.studioKicker}>ASSEMBLED BOOK</Text><Text style={s.studioSummaryTitle}>{book.totalWords ? `${formatCount(book.totalWords)} words ready to read` : 'Your book is waiting for words'}</Text><Text style={s.studioSummaryCopy}>{book.chapters.length} planned parts · {book.chapters.filter((chapter) => chapter.complete).length} drafted · {book.status === 'finished' ? 'Finished manuscript' : 'Draft in progress'}</Text></View><View style={[s.studioStatusDot, book.status === 'finished' && s.studioStatusDotFinished]}><Text style={s.studioStatusDotText}>{book.status === 'finished' ? '✓' : '•'}</Text></View></View>
    {accordion('order', 'Book order', 'Arrange the manuscript without changing its content.', <>{book.chapters.map((chapter, index) => <View key={chapter.key} style={s.studioOrderRow}><View style={s.studioOrderNumber}><Text style={s.studioOrderNumberText}>{String(index + 1).padStart(2, '0')}</Text></View><View style={s.studioOrderCopy}><Text style={s.studioOrderTitle}>{chapter.title}</Text><Text style={s.studioOrderMeta}>{chapter.complete ? `${formatCount(chapter.words)} words` : 'Missing content'}</Text></View><Pressable onPress={() => moveChapter(index, -1)} disabled={index === 0} style={[s.studioMoveButton, index === 0 && s.studioMoveDisabled]}><Text style={s.studioMoveText}>↑</Text></Pressable><Pressable onPress={() => moveChapter(index, 1)} disabled={index === book.chapters.length - 1} style={[s.studioMoveButton, index === book.chapters.length - 1 && s.studioMoveDisabled]}><Text style={s.studioMoveText}>↓</Text></Pressable><Pressable onPress={() => openWritingPart(chapter.key)} style={s.studioOpenWrite}><Text style={s.studioOpenWriteText}>Write</Text></Pressable></View>)}</>)}
    {accordion('front', 'Front matter', 'Optional pages before the manuscript.', <>{studioFrontMatter.map((item) => <View key={item.id} style={s.studioMatterRow}><Pressable onPress={() => toggleIncluded('frontMatterIncluded', item.id)} style={[s.studioCheck, studio.frontMatterIncluded[item.id] && s.studioCheckOn]}><Text style={s.studioCheckText}>{studio.frontMatterIncluded[item.id] ? '✓' : ''}</Text></Pressable><View style={s.studioMatterCopy}><Text style={s.studioMatterTitle}>{item.label}</Text><Text style={s.studioMatterMeta}>{item.automatic ? 'Generated from this book' : studio.frontMatterIncluded[item.id] ? (studio.frontMatterText[item.id] ? 'Ready' : 'Needs text') : 'Not included'}</Text>{studio.frontMatterIncluded[item.id] && !item.automatic && <TextInput value={studio.frontMatterText[item.id]} onChangeText={(value) => updateText('frontMatterText', item.id, value)} multiline placeholder={`Add ${item.label.toLowerCase()}…`} placeholderTextColor="#9A9DB7" style={s.studioMatterInput} />}</View></View>)}</>)}
    {accordion('manuscript', 'Manuscript', 'Only planned parts and their real drafts appear here.', <>{book.chapters.map((chapter) => <View key={chapter.key} style={s.studioManuscriptRow}><View style={[s.studioManuscriptDot, chapter.complete && s.studioManuscriptDotComplete]}><Text style={s.studioManuscriptDotText}>{chapter.complete ? '✓' : '·'}</Text></View><View style={s.studioOrderCopy}><Text style={s.studioOrderTitle}>{chapter.title}</Text><Text style={s.studioOrderMeta}>{chapter.complete ? `${formatCount(chapter.words)} words in the assembled manuscript` : 'No draft yet — this part stays out of the preview'}</Text></View><Pressable onPress={() => openWritingPart(chapter.key)} style={s.studioOpenWrite}><Text style={s.studioOpenWriteText}>{chapter.complete ? 'Edit' : 'Write'}</Text></Pressable></View>)}</>)}
    {accordion('back', 'Back matter', 'Optional pages after the manuscript.', <>{studioBackMatter.map((item) => <View key={item.id} style={s.studioMatterRow}><Pressable onPress={() => toggleIncluded('backMatterIncluded', item.id)} style={[s.studioCheck, studio.backMatterIncluded[item.id] && s.studioCheckOn]}><Text style={s.studioCheckText}>{studio.backMatterIncluded[item.id] ? '✓' : ''}</Text></Pressable><View style={s.studioMatterCopy}><Text style={s.studioMatterTitle}>{item.label}</Text><Text style={s.studioMatterMeta}>{studio.backMatterIncluded[item.id] ? (studio.backMatterText[item.id] ? 'Ready' : 'Needs text') : 'Not included'}</Text>{studio.backMatterIncluded[item.id] && <TextInput value={studio.backMatterText[item.id]} onChangeText={(value) => updateText('backMatterText', item.id, value)} multiline placeholder={`Add ${item.label.toLowerCase()}…`} placeholderTextColor="#9A9DB7" style={s.studioMatterInput} />}</View></View>)}</>)}
    {accordion('appearance', 'Appearance', 'Formatting used by the read preview.', <><View style={s.studioControlRow}><Text style={s.studioControlLabel}>Font size</Text><View style={s.studioControlOptions}><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, fontSize: 15 } })} style={[s.studioOption, studio.appearance.fontSize === 15 && s.studioOptionSelected]}><Text style={s.studioOptionText}>Small</Text></Pressable><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, fontSize: 18 } })} style={[s.studioOption, studio.appearance.fontSize === 18 && s.studioOptionSelected]}><Text style={s.studioOptionText}>Large</Text></Pressable></View></View><View style={s.studioControlRow}><Text style={s.studioControlLabel}>Heading style</Text><View style={s.studioControlOptions}><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, headingStyle: 'classic' } })} style={[s.studioOption, studio.appearance.headingStyle === 'classic' && s.studioOptionSelected]}><Text style={s.studioOptionText}>Classic</Text></Pressable><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, headingStyle: 'modern' } })} style={[s.studioOption, studio.appearance.headingStyle === 'modern' && s.studioOptionSelected]}><Text style={s.studioOptionText}>Modern</Text></Pressable></View></View><View style={s.studioControlRow}><Text style={s.studioControlLabel}>Alignment</Text><View style={s.studioControlOptions}><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, alignment: 'left' } })} style={[s.studioOption, studio.appearance.alignment === 'left' && s.studioOptionSelected]}><Text style={s.studioOptionText}>Left</Text></Pressable><Pressable onPress={() => updateStudio({ appearance: { ...studio.appearance, alignment: 'center' } })} style={[s.studioOption, studio.appearance.alignment === 'center' && s.studioOptionSelected]}><Text style={s.studioOptionText}>Center</Text></Pressable></View></View></>)}
    <Pressable onPress={refreshPreview} style={s.studioPrimaryButton}><Text style={s.studioPrimaryButtonText}>Refresh book preview</Text><Text style={s.studioPrimaryButtonArrow}>↗</Text></Pressable></>;
  const renderRead = () => <><View style={s.readerToolbar}><View><Text style={s.studioKicker}>READ PREVIEW</Text><Text style={s.readerToolbarTitle}>{book.totalWords ? `${formatCount(book.totalWords)} words` : 'No drafted content yet'}</Text></View><Pressable onPress={() => changeSection('listen')} style={s.readerListenButton}><Text style={s.readerListenText}>◷ Listen</Text></Pressable></View><View style={s.readerToc}><Text style={s.readerTocTitle}>In this book</Text>{book.chapters.map((chapter, index) => <Pressable key={chapter.key} onPress={() => setReaderIndex(index)} style={[s.readerTocRow, readerIndex === index && s.readerTocRowSelected]}><Text style={s.readerTocNumber}>{String(index + 1).padStart(2, '0')}</Text><Text numberOfLines={1} style={s.readerTocLabel}>{chapter.title}</Text><Text style={s.readerTocState}>{chapter.complete ? '✓' : '—'}</Text></Pressable>)}</View><View style={s.readerBook}><View style={s.readerTitlePage}><Text style={s.readerTitleKicker}>BOOKEZ STUDIO</Text><Text style={[s.readerBookTitle, studio.appearance.headingStyle === 'modern' && s.readerBookTitleModern]}>{book.title}</Text><Text style={s.readerBookStatus}>{book.status === 'finished' ? 'Finished manuscript' : 'Work in progress'}</Text></View>{book.frontMatter.filter((item) => item.included && item.id !== 'titlePage' && item.id !== 'tableOfContents').map((item) => <View key={item.id} style={s.readerMatter}><Text style={s.readerMatterTitle}>{item.label}</Text><Text style={[s.readerBody, { textAlign: studio.appearance.alignment }]}>{item.content}</Text></View>)}{book.chapters.map((chapter, index) => <View key={chapter.key} style={s.readerChapter}><Text style={[s.readerChapterTitle, studio.appearance.headingStyle === 'modern' && s.readerChapterTitleModern]}>{chapter.title}</Text>{chapter.content ? chapter.content.split(/\n\s*\n/).map((paragraph, paragraphIndex) => <Text key={`${chapter.key}-${paragraphIndex}`} style={[s.readerBody, { fontSize: studio.appearance.fontSize, lineHeight: studio.appearance.fontSize * studio.appearance.lineSpacing, marginBottom: studio.appearance.paragraphSpacing, textAlign: studio.appearance.alignment }]}>{paragraph}</Text>) : <View style={s.readerMissing}><Text style={s.readerMissingIcon}>⌁</Text><Text style={s.readerMissingTitle}>This part is not drafted yet.</Text><Text style={s.readerMissingCopy}>It is intentionally left out of the reading flow until you write it.</Text><Pressable onPress={() => openWritingPart(chapter.key)} style={s.readerWriteButton}><Text style={s.readerWriteButtonText}>Open in Write</Text></Pressable></View>}</View>)}{book.backMatter.filter((item) => item.included).map((item) => <View key={item.id} style={s.readerMatter}><Text style={s.readerMatterTitle}>{item.label}</Text><Text style={[s.readerBody, { textAlign: studio.appearance.alignment }]}>{item.content}</Text></View>)}</View></>;
  const renderListen = () => <><View style={s.listenHero}><View style={s.listenOrb}><Text style={s.listenOrbText}>{isSpeaking ? '◷' : '♫'}</Text></View><View style={s.listenHeroCopy}><Text style={s.studioKicker}>READ ALOUD</Text><Text style={s.listenTitle}>{isSpeaking ? `Listening to ${speakingLabel}` : 'Hear the book take shape.'}</Text><Text style={s.listenCopy}>Uses your device’s built-in voice and the same drafted manuscript shown in Read.</Text></View></View><View style={s.listenControls}><Pressable onPress={isSpeaking ? stopSpeaking : () => speakSegments(speechSegments)} style={[s.studioPrimaryButton, isSpeaking && s.studioStopButton]}><Text style={s.studioPrimaryButtonText}>{isSpeaking ? 'Stop listening' : 'Listen to book'}</Text><Text style={s.studioPrimaryButtonArrow}>{isSpeaking ? '×' : '▶'}</Text></Pressable><Text style={s.listenNote}>On iPhone, turn off silent mode to hear speech.</Text></View><Text style={s.studioSectionTitle}>Drafted parts</Text>{book.chapters.map((chapter) => <View key={chapter.key} style={s.listenRow}><View style={s.listenRowIcon}><Text style={s.listenRowIconText}>{chapter.complete ? '♫' : '—'}</Text></View><View style={s.studioOrderCopy}><Text style={s.studioOrderTitle}>{chapter.title}</Text><Text style={s.studioOrderMeta}>{chapter.complete ? `${formatCount(chapter.words)} words` : 'Not available until drafted'}</Text></View>{chapter.complete && <Pressable onPress={() => speakSegments([{ label: chapter.title, text: chapter.content }])} style={s.listenRowButton}><Text style={s.listenRowButtonText}>Listen</Text></Pressable>}</View>)}</>;
  const renderExport = () => <><View style={s.exportHero}><Text style={s.studioKicker}>EXPORT</Text><Text style={s.exportTitle}>Take the book with you.</Text><Text style={s.exportCopy}>Bookez can share the assembled manuscript as plain text using your device’s share sheet. PDF, EPUB, and DOCX are not available in this build.</Text></View><View style={s.exportStats}><View><Text style={s.exportStatValue}>{formatCount(book.totalWords)}</Text><Text style={s.exportStatLabel}>WORDS</Text></View><View style={s.exportStatDivider} /><View><Text style={s.exportStatValue}>{book.chapters.filter((chapter) => chapter.complete).length}/{book.chapters.length}</Text><Text style={s.exportStatLabel}>PARTS DRAFTED</Text></View></View><Pressable onPress={shareBook} style={s.studioPrimaryButton}><Text style={s.studioPrimaryButtonText}>Share plain-text book</Text><Text style={s.studioPrimaryButtonArrow}>↗</Text></Pressable><Text style={s.exportFootnote}>The share sheet lets you send the current assembled text to another app or save it where your device supports it.</Text></>;

  return <View style={s.studioPage}><View style={s.studioHeader}><Pressable onPress={onBack} style={s.studioBackButton} accessibilityLabel="Back to Library"><Text style={s.studioBackIcon}>‹</Text></Pressable><Pressable onPress={() => setPickerOpen(true)} style={s.studioHeaderCopy}><Text style={s.studioOverline}>BOOKEZ / BOOK STUDIO</Text><Text numberOfLines={1} style={s.studioHeaderTitle}>{project.title}</Text><Text style={s.studioHeaderMeta}>{snapshot.stage} · {snapshot.progressPercent}% · {project.updatedAt ? `Saved ${formatLastEdited(project.updatedAt)}` : 'Local draft'}</Text></Pressable><Pressable onPress={() => setMenuOpen(true)} style={s.studioOverflowButton} accessibilityLabel="Open Book Studio menu"><Text style={s.studioOverflowText}>•••</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.studioTabs}>{(['assemble', 'read', 'listen', 'export'] as StudioSection[]).map((item) => <Pressable key={item} onPress={() => changeSection(item)} style={[s.studioTab, section === item && s.studioTabSelected]}><Text style={[s.studioTabText, section === item && s.studioTabTextSelected]}>{item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</ScrollView>{section === 'assemble' ? renderAssemble() : section === 'read' ? renderRead() : section === 'listen' ? renderListen() : renderExport()}
    <Modal animationType="fade" visible={menuOpen} transparent onRequestClose={() => setMenuOpen(false)}><Pressable style={s.studioMenuShade} onPress={() => setMenuOpen(false)}><View style={s.studioMenu}><Text style={s.libraryMenuOverline}>THIS BOOK</Text><Text numberOfLines={1} style={s.libraryMenuTitle}>{project.title}</Text><Pressable onPress={() => { setMenuOpen(false); openWritingPart(book.chapters[readerIndex]?.key ?? book.chapters[0]?.key ?? ''); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>✎</Text><Text style={s.libraryMenuLabel}>Continue writing</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); onPage('Journey'); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>✦</Text><Text style={s.libraryMenuLabel}>View journey</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); changeSection('read'); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>◌</Text><Text style={s.libraryMenuLabel}>Review book</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); changeSection('export'); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>↗</Text><Text style={s.libraryMenuLabel}>Export</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable><Pressable onPress={() => { setMenuOpen(false); refreshPreview(); }} style={s.libraryMenuRow}><Text style={s.libraryMenuIcon}>⟳</Text><Text style={s.libraryMenuLabel}>Refresh preview</Text><Text style={s.libraryMenuArrow}>›</Text></Pressable></View></Pressable></Modal>
    <Modal animationType="slide" visible={pickerOpen} transparent onRequestClose={() => setPickerOpen(false)}><View style={s.studioPickerShade}><Pressable style={s.studioPickerDismiss} onPress={() => setPickerOpen(false)} /><View style={s.studioPickerSheet}><View style={s.sheetHandle} /><Text style={s.studioPickerOverline}>YOUR BOOKS</Text><Text style={s.studioPickerTitle}>Switch book</Text>{projects.map((item) => <Pressable key={item.title} onPress={() => { setPickerOpen(false); onSelectProject(item.title); onOpenBookStudio(item.title, section); }} style={[s.studioPickerRow, item.title === project.title && s.studioPickerRowSelected]}><View style={[s.studioPickerMark, { backgroundColor: item.color }]}><Text style={s.studioPickerMarkText}>{item.mark}</Text></View><View style={s.studioPickerCopy}><Text numberOfLines={1} style={s.studioPickerBookTitle}>{item.title}</Text><Text style={s.studioPickerBookMeta}>{item.type}</Text></View>{item.title === project.title && <Text style={s.studioPickerCheck}>✓</Text>}</Pressable>)}</View></View></Modal>
  </View>;
}

type LegalDocument = 'privacy' | 'terms';
type AccountAction = 'logout' | 'delete';

function Profile({ onLogout, onDeleteAccount }: { onLogout: () => void; onDeleteAccount: () => void }) {
  const [reminders, setReminders] = useState(true); const [cloud, setCloud] = useState(true);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);
  const isPrivacy = legalDocument === 'privacy';

  const confirmAccountAction = () => {
    const action = accountAction;
    setAccountAction(null);
    if (action === 'logout') onLogout();
    if (action === 'delete') onDeleteAccount();
  };

  return <><View style={s.profileTop}><View style={s.profileAvatar}><Text style={s.profileAvatarText}>L</Text><View style={s.profileHalo} /></View><Text style={s.profileName}>Lena Morris</Text><Text style={s.profileEmail}>lena@bookez.studio</Text><View style={s.pathfinder}><Text style={s.pathfinderText}>✦ PATHFINDER</Text></View></View>
    <Text style={s.preferenceTitle}>Your space</Text>
    <View style={s.preferences}><View style={s.prefRow}><View><Text style={s.prefTitle}>Writing reminders</Text><Text style={s.prefSub}>A gentle nudge each evening</Text></View><Switch value={reminders} onValueChange={setReminders} trackColor={{ false: '#D7D9E6', true: '#BAB6F1' }} thumbColor={reminders ? C.periwinkle : '#FFF'} /></View><View style={s.prefLine} /><View style={s.prefRow}><View><Text style={s.prefTitle}>Cloud backup</Text><Text style={s.prefSub}>Keep every chapter safe</Text></View><Switch value={cloud} onValueChange={setCloud} trackColor={{ false: '#D7D9E6', true: '#B7DAB9' }} thumbColor={cloud ? '#75AF80' : '#FFF'} /></View></View>
    <Text style={s.preferenceTitle}>Privacy & terms</Text>
    <View style={s.settingsCard}>
      <Pressable onPress={() => setLegalDocument('privacy')} style={s.settingsRow}><View style={s.settingsRowCopy}><View style={[s.settingsIcon, s.settingsIconBlue]}><Text style={s.settingsIconText}>⌁</Text></View><View><Text style={s.settingsText}>Privacy policy</Text><Text style={s.settingsSub}>How Bookez handles your writing</Text></View></View><Text style={s.chevron}>›</Text></Pressable>
      <View style={s.prefLine} />
      <Pressable onPress={() => setLegalDocument('terms')} style={s.settingsRow}><View style={s.settingsRowCopy}><View style={[s.settingsIcon, s.settingsIconGold]}><Text style={s.settingsIconText}>§</Text></View><View><Text style={s.settingsText}>Terms of service</Text><Text style={s.settingsSub}>The simple rules for using Bookez</Text></View></View><Text style={s.chevron}>›</Text></Pressable>
    </View>

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

function Stats({ projects, activeProject, onPage }: { projects: Project[]; activeProject: string; onPage: (page: Page) => void }) {
  const [range, setRange] = useState<StatsRange>('Week');
  const currentProject = projects.find((project) => project.title === activeProject) ?? projects[0];
  const stats = getStatsSnapshot(currentProject, range);
  const maxChartWords = Math.max(1, ...stats.chartRows.map((row) => row.words));
  const inputTotal = stats.dictationUses + stats.writingUses;
  const hasActivity = stats.entries.length > 0;
  const average = (value: number, suffix = '') => value ? `${value >= 10 ? Math.round(value) : value.toFixed(1)}${suffix}` : '—';

  return <>
    <View style={s.statsHero}><View style={s.statsHeroTop}><View style={{ flex: 1 }}><Text style={s.planHeroOverline}>YOUR WRITING RHYTHM</Text><Text style={s.statsTitle}>Small steps{`\n`}add up.</Text></View><Pressable onPress={() => onPage('Journey')} style={s.statsJourneyButton}><Text style={s.statsJourneyButtonText}>View Journey</Text><Text style={s.statsJourneyButtonArrow}>↗</Text></Pressable></View><Text numberOfLines={1} style={s.statsBookName}>{currentProject.title}</Text><View style={s.rangeRow}>{(['Week', 'Month', 'All time'] as StatsRange[]).map((item) => <Pill key={item} label={item} selected={range === item} onPress={() => setRange(item)} />)}</View></View>

    <View style={s.statsNumbers}><View style={s.statsHeadlineMetric}><Text style={s.bigNumber}>{stats.currentStreak || '—'}</Text><Text style={s.bigNumberLabel}>DAY STREAK</Text><Text style={s.statsMetricHint}>{stats.activeDays ? `${stats.activeDays} days here · ${stats.lifetimeActiveDays} lifetime` : 'Write to start a streak'}</Text></View><View style={s.statsHeadlineDivider} /><View style={s.statsHeadlineMetric}><Text style={s.bigNumber}>{formatCount(stats.journey.wordCount)}</Text><Text style={s.bigNumberLabel}>CURRENT WORDS</Text><Text style={s.statsMetricHint}>{stats.journey.progressPercent}% journey complete</Text></View></View>

    <View style={s.statsMetricGrid}><View style={[s.statsMetricCard, { backgroundColor: '#F3F0FF' }]}><Text style={s.statsMetricIcon}>✎</Text><Text style={s.statsMetricCardValue}>{average(stats.averageWords)}</Text><Text style={s.statsMetricCardLabel}>AVG WORDS / DAY</Text></View><View style={[s.statsMetricCard, { backgroundColor: '#FFF3E9' }]}><Text style={s.statsMetricIcon}>▤</Text><Text style={s.statsMetricCardValue}>{average(stats.averagePages)}</Text><Text style={s.statsMetricCardLabel}>AVG EST. PAGES / DAY</Text></View><View style={[s.statsMetricCard, { backgroundColor: '#EEF9EF' }]}><Text style={s.statsMetricIcon}>◷</Text><Text style={s.statsMetricCardValue}>{stats.averageMinutes ? formatDuration(stats.averageMinutes) : '—'}</Text><Text style={s.statsMetricCardLabel}>AVG ACTIVE / DAY</Text></View><View style={[s.statsMetricCard, { backgroundColor: '#EEF4FF' }]}><Text style={s.statsMetricIcon}>◌</Text><Text style={s.statsMetricCardValue}>{stats.completionAverage ? `${Math.round(stats.completionAverage)}%` : '—'}</Text><Text style={s.statsMetricCardLabel}>AVG % COMPLETED / DAY</Text></View></View>

    <View style={s.chartCard}><View style={s.chartHeader}><View><Text style={s.chartTitle}>Words by day</Text><Text style={s.statsCardHint}>{range === 'Week' ? 'Last seven days' : range === 'Month' ? 'Last thirty days' : 'Logged writing days'}</Text></View><Text style={s.chartTotal}>{stats.totalLoggedWords ? formatCount(stats.totalLoggedWords) : '—'}</Text></View><View style={s.chart}>{stats.chartRows.map((row, index) => <View key={row.key} style={s.barCol}><View style={[s.bar, { height: row.words ? Math.max(7, Math.round((row.words / maxChartWords) * 95)) : 3 }, row.words > 0 && index === stats.chartRows.length - 1 && s.barActive]} /><Text style={s.barLabel}>{formatActivityDay(row.key)}</Text></View>)}</View>{!hasActivity && <Text style={s.statsEmptyHint}>No writing days logged yet. Your next manuscript session will start the rhythm here.</Text>}</View>

    <View style={s.statsSectionHeader}><View><Text style={s.statsSectionTitle}>Daily ledger</Text><Text style={s.statsCardHint}>Words, estimated pages, time, and completion</Text></View><Text style={s.statsSectionCount}>{stats.activeDays ? `${stats.activeDays} days` : 'No days yet'}</Text></View>
    {stats.dailyRows.length ? stats.dailyRows.map((entry) => <View key={entry.key} style={s.statsDayRow}><View style={s.statsDayCopy}><Text style={s.statsDayTitle}>{formatActivityDay(entry.key, true)}</Text><Text style={s.statsDaySub}>{formatDuration(entry.minutes)} active</Text></View><View style={s.statsDayMetric}><Text style={s.statsDayValue}>{formatCount(entry.words)}</Text><Text style={s.statsDayLabel}>WORDS</Text></View><View style={s.statsDayMetric}><Text style={s.statsDayValue}>{entry.pages ? entry.pages.toFixed(1) : '—'}</Text><Text style={s.statsDayLabel}>EST. PAGES</Text></View><View style={s.statsDayMetric}><Text style={s.statsDayValue}>{entry.completion ? `${Math.round(entry.completion)}%` : '—'}</Text><Text style={s.statsDayLabel}>DONE</Text></View></View>) : <View style={s.statsEmptyCard}><Text style={s.statsEmptyIcon}>⌁</Text><Text style={s.statsEmptyTitle}>Your daily record is waiting.</Text><Text style={s.statsEmptyCopy}>Start writing in the manuscript and Bookez will track your words, pace, pages, and progress by day.</Text></View>}

    <View style={s.statsBreakdownCard}><View style={s.statsSectionHeader}><View><Text style={s.statsSectionTitle}>How you write</Text><Text style={s.statsCardHint}>Input events in the selected range</Text></View><Text style={s.statsSectionCount}>{inputTotal ? `${inputTotal} events` : 'No events yet'}</Text></View>{inputTotal ? <><View style={s.inputMixTrack}><View style={[s.inputMixDictation, { width: `${stats.dictationPercent}%` }]} /><View style={[s.inputMixWriting, { width: `${stats.writingPercent}%` }]} /></View><View style={s.inputMixLegend}><View style={s.inputMixLegendItem}><View style={[s.inputMixDot, { backgroundColor: C.coral }]} /><Text style={s.inputMixLabel}>Dictation</Text><Text style={s.inputMixValue}>{stats.dictationPercent}%</Text></View><View style={s.inputMixLegendItem}><View style={[s.inputMixDot, { backgroundColor: C.periwinkle }]} /><Text style={s.inputMixLabel}>Keyboard / writing</Text><Text style={s.inputMixValue}>{stats.writingPercent}%</Text></View></View></> : <Text style={s.statsEmptyHint}>Tap the microphone or type in the manuscript to build this breakdown.</Text>}</View>

    <View style={s.statsInsightCard}><Text style={s.statsInsightEyebrow}>A LITTLE SOMETHING TO NOTICE</Text>{stats.strongestDay ? <><Text style={s.statsInsightTitle}>Your strongest day was {formatActivityDay(stats.strongestDay.key, true)}.</Text><Text style={s.statsInsightCopy}>{formatCount(stats.strongestDay.words)} words, about {stats.strongestDay.pages.toFixed(1)} pages, with {Math.round(stats.strongestDay.completion)}% of the writing path complete.</Text></> : <><Text style={s.statsInsightTitle}>Your rhythm will reveal itself here.</Text><Text style={s.statsInsightCopy}>Once you have a writing day logged, you’ll see your strongest day and average active time per page.</Text></>}<View style={s.statsInsightMetric}><Text style={s.statsInsightMetricLabel}>AVG ACTIVE TIME / EST. PAGE</Text><Text style={s.statsInsightMetricValue}>{stats.averageMinutesPerPage ? formatDuration(stats.averageMinutesPerPage) : '—'}</Text></View></View>

    <Text style={s.preferenceTitle}>Book at a glance</Text><View style={s.statsBookCard}><View><Text style={s.statsBookCardLabel}>ESTIMATED MANUSCRIPT PAGES</Text><Text style={s.statsBookCardValue}>{stats.journey.wordCount ? `${(stats.journey.wordCount / 250).toFixed(1)}` : '—'}</Text></View><View style={s.statsBookCardDivider} /><View><Text style={s.statsBookCardLabel}>{stats.journey.blueprint.unitLabelPlural.toUpperCase()} WITH DRAFTS</Text><Text style={s.statsBookCardValue}>{stats.journey.completedUnits} / {stats.journey.unitCount}</Text></View></View>
  </>;
}

function Navigation({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  return <View style={s.navShell}>{bottomNavPages.map((item) => <Pressable key={item} onPress={() => onPage(item)} style={s.navItem}><Text style={[s.navIcon, page === item && s.navIconActive]}>{pageMeta[item].icon}</Text><Text style={[s.navLabel, page === item && s.navLabelActive]}>{pageMeta[item].short}</Text></Pressable>)}</View>;
}

export default function App() {
  const [page, setPage] = useState<Page>('Library');
  const [accountState, setAccountState] = useState<'active' | 'signedOut' | 'deleted'>('active');
  const [studioRoute, setStudioRoute] = useState<{ title: string; section: StudioSection }>({ title: 'The Midnight Atlas', section: 'assemble' });
  const [projects, setProjects] = useState<Project[]>([
    { title: 'The Midnight Atlas', color: C.periwinkle, mark: '✦', type: 'Fiction Book', pageGoal: '240', unitGoal: '24', plan: defaultPlanFor('Fiction Book') },
    { title: 'Letters to June', color: C.coral, mark: '✉', type: 'Memoir & Biography', pageGoal: '260', unitGoal: '18', plan: defaultPlanFor('Memoir & Biography') },
    { title: 'Wildflower Notes', color: C.sage, mark: '✳', type: 'Journal or Diary', pageGoal: '120', unitGoal: '30', plan: defaultPlanFor('Journal or Diary') },
  ]);
  const [activeProject, setActiveProject] = useState('The Midnight Atlas');
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
    if (page === 'Journey') return <Journey projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onPage={setPage} onBack={() => setPage('Library')} onOpenBookStudio={openBookStudio} />;
    if (page === 'BookStudio') return <BookStudio projects={projects} project={projects.find((project) => project.title === studioRoute.title) ?? projects.find((project) => project.title === activeProject)} initialSection={studioRoute.section} onBack={() => setPage('Library')} onPage={setPage} onSelectProject={setActiveProject} onUpdateProject={updateProject} onOpenBookStudio={openBookStudio} />;
    if (page === 'Profile') return <Profile onLogout={() => { setAccountState('signedOut'); setPage('Library'); }} onDeleteAccount={() => { setProjects([]); setAccountState('deleted'); setPage('Library'); }} />;
    return <Stats projects={projects} activeProject={activeProject} onPage={setPage} />;
  };
  return <><StatusBar style="dark" /><Ambient><SafeAreaView style={s.safe}>{accountState === 'active' ? <><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>{renderPage()}</ScrollView><Navigation page={page} onPage={setPage} /></> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}><AccountExit deleted={accountState === 'deleted'} onReturn={returnFromAccount} /></ScrollView>}</SafeAreaView></Ambient></>;
}

const s = StyleSheet.create({
  planHero: { marginHorizontal: -20, marginTop: -18, padding: 31, paddingTop: 51, paddingBottom: 29, overflow: 'hidden', backgroundColor: '#EDE8FF', borderBottomLeftRadius: 37, borderBottomRightRadius: 37 },
  planHeroOverline: { color: C.muted, fontSize: 9, letterSpacing: 1.05, fontWeight: '700' }, planHeroTitle: { color: C.ink, fontWeight: '700', fontSize: 29, lineHeight: 33, letterSpacing: -0.7, marginTop: 8 }, planHeroCopy: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 10, maxWidth: 260 }, planHeroOrb: { position: 'absolute', right: 18, bottom: -57, color: C.periwinkle, opacity: 0.34, fontSize: 204 },
  planTypeRow: { gap: 8, paddingTop: 18, paddingBottom: 3, paddingRight: 20 }, planTypePill: { height: 44, paddingHorizontal: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' }, planTypePillActive: { backgroundColor: '#FFF', borderColor: C.periwinkle }, planTypeDot: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, planTypeDotText: { color: '#FFF', fontSize: 12 }, planTypeText: { color: C.muted, fontSize: 10, fontWeight: '700', marginLeft: 7 }, planTypeTextActive: { color: C.ink },
  planSelectedCard: { marginTop: 15, padding: 14, borderRadius: 20, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, planSelectedIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, planSelectedIconText: { color: '#FFF', fontSize: 18 }, planSelectedOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, planSelectedTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 3 }, planSelectedSub: { color: C.muted, fontSize: 10, marginTop: 3 }, planJourneyLink: { minHeight: 35, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#F4F2FF', flexDirection: 'row', alignItems: 'center', gap: 5 }, planJourneyLinkText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, planSelectedArrow: { color: C.gold, fontSize: 15 },
  planSteps: { marginTop: 20, padding: 5, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.7)', flexDirection: 'row', gap: 4 }, planStep: { flex: 1, minHeight: 54, paddingHorizontal: 5, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, planStepActive: { backgroundColor: '#FFF' }, planStepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E7E7F2', alignItems: 'center', justifyContent: 'center', marginRight: 6 }, planStepNumberActive: { backgroundColor: C.periwinkle }, planStepNumberText: { color: C.muted, fontSize: 10, fontWeight: '700' }, planStepNumberTextActive: { color: '#FFF' }, planStepLabel: { color: C.muted, fontSize: 10, fontWeight: '700' }, planStepLabelActive: { color: C.ink }, planStepShort: { color: '#9B9FB8', fontSize: 8, marginTop: 2 },
  planStepCard: { marginTop: 16, padding: 17, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.82)' }, planSectionKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, planSectionTitle: { color: C.ink, fontSize: 23, lineHeight: 28, letterSpacing: -0.5, fontWeight: '700', marginTop: 6 }, planSectionCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 7 }, metricRow: { flexDirection: 'row', gap: 10, marginTop: 17 }, metricCard: { flex: 1, padding: 13, borderRadius: 17, backgroundColor: '#F5F2FF', borderWidth: 1, borderColor: '#ECE9FF' }, metricLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700' }, metricInput: { color: C.ink, fontSize: 26, fontWeight: '700', paddingVertical: 5, paddingHorizontal: 0 }, metricHint: { color: C.muted, fontSize: 9, lineHeight: 13 }, planTip: { marginTop: 14, padding: 12, borderRadius: 15, backgroundColor: '#FFF6DB', flexDirection: 'row', alignItems: 'flex-start' }, planTipIcon: { color: '#C9901B', fontSize: 14, marginRight: 8 }, planTipText: { flex: 1, color: '#8C6B29', fontSize: 10, lineHeight: 15 },
  structureList: { marginTop: 16, gap: 8 }, structureRow: { padding: 11, borderRadius: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E7E7F0', backgroundColor: '#FFF' }, structureRowActive: { borderColor: '#D8D1FA', backgroundColor: '#F7F5FF' }, structureCheck: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: '#CBCDDD', alignItems: 'center', justifyContent: 'center' }, structureCheckOn: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, structureCheckText: { color: '#FFF', fontSize: 13, fontWeight: '700' }, structureCopy: { flex: 1, marginLeft: 10, marginRight: 5 }, structureLabel: { color: C.ink, fontSize: 12, fontWeight: '700' }, structureHelper: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, structureFooter: { color: C.muted, fontSize: 10, marginTop: 13, textAlign: 'right' },
  planInputCard: { marginTop: 16, padding: 13, borderRadius: 17, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#ECE9FF' }, planInputLabel: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, planInputHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, planTextArea: { minHeight: 79, padding: 0, paddingTop: 10, color: C.ink, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' }, planTextAreaSmall: { minHeight: 62, padding: 0, paddingTop: 9, color: C.ink, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' }, plotGuide: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: '#EEF8FF', borderWidth: 1, borderColor: '#DFF1FB' }, plotGuideTitle: { color: '#4B7B9D', fontSize: 11, fontWeight: '700' }, plotGuideText: { color: '#5D7890', fontSize: 10, lineHeight: 15, marginTop: 5 }, plotPrompt: { marginTop: 12, padding: 13, borderRadius: 17, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E7F0' }, plotPromptTitle: { color: C.ink, fontSize: 12, fontWeight: '700' }, plotPromptHelper: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, planSubheading: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 21 },
  chapterHeader: { marginTop: 21, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, chapterHeaderHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, chapterCountBadge: { minWidth: 35, height: 30, borderRadius: 11, backgroundColor: '#FFF2C7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, chapterCountText: { color: '#A97819', fontSize: 12, fontWeight: '700' }, chapterRow: { marginTop: 9, padding: 9, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E7F0', flexDirection: 'row', alignItems: 'flex-start' }, chapterIndex: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center', marginRight: 9, marginTop: 2 }, chapterIndexText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, chapterTextInput: { flex: 1, minHeight: 47, padding: 0, color: C.ink, fontSize: 11, lineHeight: 16, textAlignVertical: 'top' }, emptyChapter: { marginTop: 12, padding: 15, borderRadius: 17, backgroundColor: '#F5F2FF', flexDirection: 'row', alignItems: 'center' }, emptyChapterIcon: { color: C.periwinkle, fontSize: 20, marginRight: 9 }, emptyChapterText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 15 },
  planFooter: { marginTop: 16, marginBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, planFooterText: { color: C.muted, fontSize: 8, letterSpacing: 0.8, fontWeight: '700' }, planNavButton: { minWidth: 79, height: 39, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#D9DAE8', backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' }, planNavButtonPrimary: { borderColor: C.periwinkle, backgroundColor: C.periwinkle }, planNavButtonDisabled: { opacity: 0.4 }, planNavButtonText: { color: C.muted, fontSize: 10, fontWeight: '700' }, planNavButtonTextPrimary: { color: '#FFF' },
  dictationField: { position: 'relative' }, dictationFieldGrow: { flex: 1, minWidth: 0 }, dictationTextInput: { paddingRight: 36 }, dictationButton: { position: 'absolute', right: 4, bottom: 7, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFF', borderWidth: 1, borderColor: '#DDD8FA' }, dictationIcon: { fontSize: 14, lineHeight: 16 },
  planHeroSwitcher: { position: 'absolute', top: 15, right: 20, width: 214, minHeight: 40, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.44)', borderWidth: 1, borderColor: 'rgba(139,138,232,0.2)' }, planTopBar: { marginTop: -6, marginBottom: 10, alignItems: 'flex-end' }, planTopSwitcher: { minWidth: 220, maxWidth: 292, minHeight: 48, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: '#E0DDF8', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, planTopIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, planTopIconText: { color: '#FFF', fontSize: 14 }, planTopSwitcherCopy: { flex: 1, marginLeft: 9 }, planTopOverline: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.85, fontWeight: '700' }, planTopTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 2 }, planTopChevron: { color: C.periwinkle, fontSize: 20, lineHeight: 20, marginLeft: 8 }, projectMenuShade: { flex: 1, backgroundColor: 'rgba(29,33,69,0.22)', paddingTop: 63, paddingHorizontal: 20, alignItems: 'flex-end' }, projectMenu: { width: 292, padding: 12, borderRadius: 22, backgroundColor: '#FBFAFF', shadowColor: '#4E4A7F', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 }, projectMenuHeader: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginHorizontal: 5, marginTop: 2 }, projectMenuHint: { color: C.muted, fontSize: 10, marginHorizontal: 5, marginTop: 4, marginBottom: 9 }, projectMenuRow: { minHeight: 56, paddingHorizontal: 9, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECEBF4', marginTop: 7 }, projectMenuRowActive: { backgroundColor: '#F3F1FF', borderColor: '#D9D2FA' }, projectMenuIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, projectMenuIconText: { color: '#FFF', fontSize: 14 }, projectMenuCopy: { flex: 1, marginLeft: 9 }, projectMenuProject: { color: C.ink, fontSize: 12, fontWeight: '700' }, projectMenuType: { color: C.muted, fontSize: 9, marginTop: 3 }, projectMenuCheck: { width: 21, height: 21, borderRadius: 10, borderWidth: 1.5, borderColor: '#D4D5E3', alignItems: 'center', justifyContent: 'center', marginLeft: 7 }, projectMenuCheckActive: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, projectMenuCheckText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  page: { flex: 1, backgroundColor: C.paper, overflow: 'hidden' }, safe: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 112 },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.46 }, orbOne: { width: 270, height: 270, backgroundColor: C.lavender, top: -110, right: -100 }, orbTwo: { width: 230, height: 230, backgroundColor: C.sky, top: 310, left: -155 }, orbThree: { width: 190, height: 190, backgroundColor: C.peach, bottom: 20, right: -110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }, overline: { color: C.muted, fontSize: 9, letterSpacing: 1.15, fontWeight: '700' }, pageTitle: { color: C.ink, fontSize: 31, letterSpacing: -0.8, fontWeight: '700', marginTop: 4 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 }, tinyButton: { width: 39, height: 39, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, tinyButtonText: { color: C.periwinkle, fontSize: 18 }, avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F3', shadowColor: '#666187', shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, avatarText: { color: C.coral, fontWeight: '700', fontSize: 16 }, avatarDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', right: 0, bottom: 2, borderWidth: 2, borderColor: '#FFF8F3', backgroundColor: C.sage },
  intro: { fontSize: 15, lineHeight: 21, color: C.muted, marginBottom: 21, maxWidth: 310 }, focusCard: { height: 206, borderRadius: 28, padding: 21, overflow: 'hidden', shadowColor: '#5D598A', shadowOpacity: 0.21, shadowRadius: 19, shadowOffset: { width: 0, height: 10 }, elevation: 7 }, focusEyebrow: { color: '#F7F9FF', fontSize: 9, letterSpacing: 1.05, fontWeight: '700' }, focusTitle: { color: '#FFF', fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: 10 }, focusCopy: { color: '#F5F4FF', fontSize: 12, marginTop: 5, maxWidth: 245 }, focusActions: { position: 'absolute', left: 21, right: 21, bottom: 17, flexDirection: 'row', alignItems: 'center', gap: 8 }, lightAction: { flex: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.22)' }, lightActionText: { fontSize: 11, color: '#FFF', fontWeight: '700' }, lightArrow: { color: '#FFF', fontSize: 16 }, focusJourneyAction: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }, focusJourneyActionText: { color: '#FFF', fontSize: 10, fontWeight: '700' }, focusShape: { position: 'absolute', right: -15, bottom: -58, fontSize: 195, color: '#FFF1DF', opacity: 0.55, transform: [{ rotate: '-12deg' }] },
  sectionBar: { marginTop: 28, marginBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: C.ink }, link: { color: C.periwinkle, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }, newProjectButton: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#EEEDFF' }, newProjectText: { color: C.periwinkle, fontSize: 9, fontWeight: '700', letterSpacing: 0.65 }, projectRow: { minHeight: 74, marginBottom: 9, padding: 12, borderRadius: 19, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.68)' }, projectRowActive: { backgroundColor: '#FFF', shadowColor: '#68638D', shadowOpacity: 0.11, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, projectMark: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, projectMarkText: { color: '#FFF', fontSize: 18 }, projectCopy: { flex: 1, marginLeft: 12 }, projectTitle: { color: C.ink, fontWeight: '700', fontSize: 14 }, projectDetail: { color: C.muted, marginTop: 4, fontSize: 10, letterSpacing: 0.25 }, continueTag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: '#EEEDFF' }, continueTagText: { fontSize: 8, letterSpacing: 0.6, color: C.periwinkle, fontWeight: '700' }, chevron: { color: C.periwinkle, fontSize: 25 }, addProjectRow: { marginTop: 4, borderRadius: 19, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C8C8E8', minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.32)' }, addProjectPlus: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center' }, addProjectPlusText: { color: C.periwinkle, fontSize: 24, fontWeight: '400' }, addProjectTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginLeft: 12 }, addProjectSub: { color: C.muted, fontSize: 10, marginLeft: 12, marginTop: 4 },
  modalShade: { flex: 1, backgroundColor: 'rgba(29, 33, 69, 0.35)', justifyContent: 'flex-end' }, composerSheet: { height: '88%', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, backgroundColor: '#FAFAFF', borderTopLeftRadius: 32, borderTopRightRadius: 32 }, sheetHandle: { width: 38, height: 4, borderRadius: 4, backgroundColor: '#D9D9E7', alignSelf: 'center' }, composerHeader: { marginTop: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, composerOverline: { color: C.periwinkle, letterSpacing: 1, fontSize: 9, fontWeight: '700' }, composerTitle: { color: C.ink, fontSize: 23, letterSpacing: -0.5, fontWeight: '700', marginTop: 5 }, closeButton: { height: 34, width: 34, borderRadius: 17, backgroundColor: '#F0F0F9', alignItems: 'center', justifyContent: 'center' }, closeButtonText: { color: C.muted, fontSize: 23, lineHeight: 24 }, projectInput: { marginTop: 17, minHeight: 50, paddingHorizontal: 15, backgroundColor: '#FFF', borderRadius: 15, color: C.ink, fontSize: 14, borderWidth: 1, borderColor: '#E5E5F0' }, typePrompt: { color: C.muted, fontSize: 9, letterSpacing: 0.9, fontWeight: '700', marginTop: 20, marginBottom: 10 }, typeScroller: { flex: 1 }, typeGrid: { paddingBottom: 14, gap: 8 }, typeCard: { padding: 10, minHeight: 63, borderRadius: 17, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EBEBF2', backgroundColor: '#FFF' }, typeCardSelected: { borderColor: C.periwinkle, backgroundColor: '#F4F2FF' }, typeIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, typeIconText: { color: '#FFF', fontSize: 16 }, typeCopy: { flex: 1, marginLeft: 10 }, typeName: { color: C.ink, fontSize: 12, fontWeight: '700' }, typeExample: { color: C.muted, fontSize: 9, marginTop: 3 }, typeCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#D2D4E2', alignItems: 'center', justifyContent: 'center' }, typeCheckSelected: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, typeCheckText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, createProjectButton: { marginTop: 11, backgroundColor: C.periwinkle, height: 53, borderRadius: 17, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#7470C9', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }, createProjectButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' }, createProjectArrow: { color: '#FFF', fontSize: 21 },
  structureLegend: { marginTop: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }, structureLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, structureLegendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D9DAE8' }, structureLegendDotRecommended: { backgroundColor: C.periwinkle }, structureLegendText: { color: C.muted, fontSize: 8, fontWeight: '700' }, structureLegendHint: { color: '#A4A7BE', fontSize: 8, marginLeft: 3 }, structureChecklistHeader: { marginTop: 16, padding: 11, borderRadius: 15, backgroundColor: '#F4F2FF', borderWidth: 1, borderColor: '#E4E1F4', flexDirection: 'row', alignItems: 'center' }, structureChecklistCopy: { flex: 1 }, structureChecklistTitle: { color: C.ink, fontSize: 9, letterSpacing: 0.8, fontWeight: '700' }, structureChecklistHint: { color: C.muted, fontSize: 9, marginTop: 4 }, partTag: { paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, fontSize: 6, letterSpacing: 0.35, fontWeight: '700' }, recommendedTag: { color: C.periwinkle, backgroundColor: '#EEEDFF' }, optionalTag: { color: C.muted, backgroundColor: '#F1F1F6' },
  structureFooterRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, structureFooterCompact: { color: C.muted, fontSize: 10 }, structurePager: { flexDirection: 'row', alignItems: 'center', gap: 7 }, structurePagerButton: { width: 27, height: 27, borderRadius: 10, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center' }, structurePagerButtonDisabled: { opacity: 0.35 }, structurePagerButtonText: { color: C.periwinkle, fontSize: 19, lineHeight: 21 }, structurePagerCount: { color: C.muted, fontSize: 9, fontWeight: '700', minWidth: 27, textAlign: 'center' },
  storyMapPager: { marginTop: 16, padding: 9, borderRadius: 16, backgroundColor: '#F4F2FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, storyMapPagerButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E4E1F4' }, storyMapPagerButtonDisabled: { opacity: 0.35 }, storyMapPagerButtonText: { color: C.periwinkle, fontSize: 20, lineHeight: 22 }, storyMapPagerCopy: { flex: 1, alignItems: 'center' }, storyMapPagerLabel: { color: C.ink, fontSize: 11, fontWeight: '700' }, storyMapPagerCount: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', marginTop: 3 }, storyMapPageHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 6, marginBottom: 2 },
  writeProjectBar: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 7 }, writeProjectSwitcher: { maxWidth: 235, minHeight: 50, flexShrink: 1, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: '#E0DDF8', flexDirection: 'row', alignItems: 'center' }, writeProjectIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, writeProjectIconText: { color: '#FFF', fontSize: 15 }, writeProjectCopy: { flex: 1, marginLeft: 9 }, writeProjectOverline: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.8, fontWeight: '700' }, writeProjectTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 2 }, writeProjectChevron: { color: C.periwinkle, fontSize: 19, lineHeight: 20, marginLeft: 8 }, writeJourneyLink: { minHeight: 37, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#F4F2FF', flexDirection: 'row', alignItems: 'center', gap: 4 }, writeJourneyLinkText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, writeJourneyLinkArrow: { color: C.periwinkle, fontSize: 13 }, writeProgress: { width: 95, flexShrink: 0, marginLeft: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 13, backgroundColor: '#EEEDFF', borderWidth: 1, borderColor: '#E1DDFB' }, writeProgressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, writeProgressValue: { color: C.ink, fontSize: 14, fontWeight: '700' }, writeProgressLabel: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.5, fontWeight: '700' }, writeProgressTrack: { height: 4, marginTop: 5, borderRadius: 3, backgroundColor: '#DCD8F4', overflow: 'hidden' }, writeProgressFill: { height: 4, borderRadius: 3, backgroundColor: C.periwinkle }, writeProgressText: { color: C.muted, fontSize: 7, letterSpacing: 0.35, fontWeight: '700', marginTop: 5 }, writeFormat: { color: C.muted, fontSize: 9, marginTop: 10 },
  writePartHeader: { marginTop: 18, padding: 14, borderRadius: 21, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, writePartNumber: { width: 44, height: 44, borderRadius: 15, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, writePartNumberText: { color: '#FFF', fontSize: 13, fontWeight: '700' }, writePartCopy: { flex: 1 }, writePartKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, writePartTitle: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 4 }, writePartHelper: { color: C.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  writeNotesBanner: { marginTop: 13, padding: 13, borderRadius: 19, backgroundColor: '#FFF9E9', borderWidth: 1, borderColor: '#F5E5B7', shadowColor: '#B4914D', shadowOpacity: 0.08, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, writeNotesTapArea: { flexDirection: 'row', alignItems: 'flex-start' }, writeNotesIcon: { width: 30, height: 30, borderRadius: 11, backgroundColor: '#F5C75C', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, writeNotesIconText: { color: '#FFF', fontSize: 13 }, writeNotesCopy: { flex: 1 }, writeNotesTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, writeNotesLabel: { color: '#A97819', fontSize: 8, letterSpacing: 0.75, fontWeight: '700' }, writeNotesAction: { color: '#A97819', fontSize: 7, letterSpacing: 0.65, fontWeight: '700' }, writeNoteRow: { marginTop: 6 }, writeNoteLabel: { color: '#9A7628', fontSize: 8, fontWeight: '700' }, writeNoteText: { color: '#7E682F', fontSize: 10, lineHeight: 14, marginTop: 2 }, writeNotesEmpty: { color: '#8C6B29', fontSize: 10, lineHeight: 15, marginTop: 5 }, writeSavedNote: { marginTop: 10, marginLeft: 40, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F1DEAA' }, writeSavedNoteLabel: { color: '#A97819', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, writeSavedNoteText: { color: '#7E682F', fontSize: 10, lineHeight: 14, marginTop: 3 }, writeQuickNote: { marginTop: 11, marginLeft: 40, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1DEAA' }, writeQuickNoteLabel: { color: '#A97819', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, writeQuickNoteInput: { minHeight: 65, padding: 0, paddingTop: 8, color: '#6D5D34', fontSize: 11, lineHeight: 16, textAlignVertical: 'top' },
  writeEditorCard: { marginTop: 15, padding: 15, borderRadius: 21, backgroundColor: '#FFFDF9', shadowColor: '#807A96', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, writeEditorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, writeEditorLabel: { color: C.coral, fontSize: 8, letterSpacing: 1.1, fontWeight: '700' }, writeEditorHint: { color: C.muted, fontSize: 8 }, writeEditorInput: { minHeight: 270, padding: 0, paddingTop: 14, color: '#353B5B', fontSize: 16, lineHeight: 25, textAlignVertical: 'top' }, writeTools: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEEAF2', flexDirection: 'row', alignItems: 'center', gap: 7 }, writeToolButton: { minHeight: 32, paddingHorizontal: 9, borderRadius: 10, backgroundColor: '#F1EEFF', flexDirection: 'row', alignItems: 'center', gap: 5 }, writeToolDisabled: { opacity: 0.4 }, writeToolIcon: { color: C.periwinkle, fontSize: 11, fontWeight: '700' }, writeToolText: { color: C.ink, fontSize: 9, fontWeight: '700' }, writeToolHint: { color: '#A1A4BB', fontSize: 8, marginLeft: 'auto' }, writeNavigation: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, writeNextButton: { flex: 1, minHeight: 47, paddingHorizontal: 15, borderRadius: 15, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, writeNextButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, writeSecondaryButton: { minHeight: 43, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#D9DAE8', backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' }, writeSecondaryButtonText: { color: C.muted, fontSize: 10, fontWeight: '700' }, writeButtonDisabled: { opacity: 0.35 },
  writeEmpty: { marginTop: 20, padding: 24, borderRadius: 23, backgroundColor: '#FFF', alignItems: 'center' }, writeEmptyIcon: { color: C.periwinkle, fontSize: 25 }, writeEmptyTitle: { color: C.ink, fontSize: 18, fontWeight: '700', marginTop: 10 }, writeEmptyCopy: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 }, writeComplete: { marginTop: 20, padding: 25, borderRadius: 23, backgroundColor: '#EEF9EF', alignItems: 'center', borderWidth: 1, borderColor: '#D7EED9' }, writeCompleteIcon: { color: '#69A772', fontSize: 28 }, writeCompleteTitle: { color: C.ink, fontSize: 19, fontWeight: '700', textAlign: 'center', marginTop: 9 }, writeCompleteCopy: { color: '#66836B', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 7 },
  writeMenuShade: { flex: 1, backgroundColor: 'rgba(29,33,69,0.22)', paddingTop: 57, paddingHorizontal: 20, alignItems: 'flex-start' }, writeMenu: { width: 292, padding: 12, borderRadius: 22, backgroundColor: '#FBFAFF', shadowColor: '#4E4A7F', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 }, writeMenuHeader: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginHorizontal: 5, marginTop: 2 }, writeMenuHint: { color: C.muted, fontSize: 10, marginHorizontal: 5, marginTop: 4, marginBottom: 9 }, writeMenuRow: { minHeight: 56, paddingHorizontal: 9, borderRadius: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECEBF4', marginTop: 7 }, writeMenuRowActive: { backgroundColor: '#F3F1FF', borderColor: '#D9D2FA' }, writeMenuIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, writeMenuIconText: { color: '#FFF', fontSize: 14 }, writeMenuCopy: { flex: 1, marginLeft: 9 }, writeMenuProject: { color: C.ink, fontSize: 12, fontWeight: '700' }, writeMenuType: { color: C.muted, fontSize: 9, marginTop: 3 }, writeMenuCheck: { color: C.periwinkle, fontSize: 16, fontWeight: '700', marginLeft: 7 },
  writeTop: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, writeTitle: { color: C.ink, fontSize: 29, lineHeight: 34, letterSpacing: -0.7, fontWeight: '700', marginTop: 6 }, saveChip: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#D5D7E5', borderRadius: 12 }, saveChipDone: { backgroundColor: '#EFFAEF', borderColor: '#D5EFD7' }, saveChipText: { color: C.muted, fontSize: 9, letterSpacing: 0.5, fontWeight: '700' }, saveChipTextDone: { color: '#5B9C67' },
  journeyHeader: { marginTop: -4, flexDirection: 'row', alignItems: 'center', minHeight: 54 }, journeyBackButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }, journeyBackIcon: { color: C.ink, fontSize: 28, lineHeight: 29, marginTop: -2 }, journeyHeaderCopy: { flex: 1, marginLeft: 12 }, journeyOverline: { color: C.muted, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, journeyHeaderTitle: { color: C.ink, fontSize: 23, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 }, journeyOverflowButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }, journeyOverflowText: { color: C.muted, fontSize: 15, letterSpacing: 1, marginTop: -7 }, journeyBookPicker: { marginTop: 13, padding: 10, borderRadius: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.86)' }, journeyBookMark: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, journeyBookMarkText: { color: '#FFF', fontSize: 17 }, journeyBookPickerCopy: { flex: 1, marginLeft: 10 }, journeyBookPickerLabel: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.9, fontWeight: '700' }, journeyBookPickerTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 3 }, journeyBookPickerMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, journeyPickerChevron: { color: C.periwinkle, fontSize: 20, lineHeight: 21, marginHorizontal: 6 },
  journeySummaryCard: { marginTop: 14, padding: 16, borderRadius: 23, backgroundColor: '#FFF', shadowColor: '#66638D', shadowOpacity: 0.13, shadowRadius: 17, shadowOffset: { width: 0, height: 8 }, elevation: 4 }, journeySummaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, journeySummaryEyebrow: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, journeySummaryStage: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 5 }, journeySummaryPercent: { color: C.periwinkle, fontSize: 25, fontWeight: '700', letterSpacing: -0.5 }, journeyProgressTrack: { height: 8, marginTop: 13, borderRadius: 4, backgroundColor: '#E8E6F4', overflow: 'hidden' }, journeyProgressFill: { height: 8, borderRadius: 4, backgroundColor: C.periwinkle }, journeyStatsRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center' }, journeyStat: { flex: 1 }, journeyStatDivider: { width: 1, height: 37, backgroundColor: '#E7E6EF', marginHorizontal: 14 }, journeyStatValue: { color: C.ink, fontSize: 15, fontWeight: '700' }, journeyStatLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.65, fontWeight: '700', marginTop: 5 }, journeyStatSub: { color: '#9A9CB1', fontSize: 8, marginTop: 3 }, journeyNextRow: { marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#EFEFF4', flexDirection: 'row', alignItems: 'center' }, journeyNextDot: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1C9' }, journeyNextDotText: { color: '#B4871A', fontSize: 14 }, journeyNextCopy: { flex: 1, marginLeft: 9 }, journeyNextEyebrow: { color: '#A97819', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, journeyNextTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 3 }, journeyNextArrow: { color: C.periwinkle, fontSize: 19 }, journeyContinueButton: { marginTop: 14, minHeight: 50, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center', shadowColor: '#7772CF', shadowOpacity: 0.25, shadowRadius: 11, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, journeyContinueText: { color: '#FFF', fontSize: 12, fontWeight: '700' }, journeyContinueAction: { flex: 1, color: '#EDEBFF', fontSize: 9, textAlign: 'right', marginRight: 9 }, journeyContinueArrow: { color: '#FFF', fontSize: 18 },
  journeyMapHeading: { marginTop: 27, marginBottom: 4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, journeyMapEyebrow: { color: C.muted, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, journeyMapTitle: { color: C.ink, fontSize: 17, fontWeight: '700', marginTop: 5 }, journeyMapHint: { color: '#9A9CB1', fontSize: 8, marginBottom: 2 }, journeyMap: { position: 'relative', marginTop: 9 }, journeyRoute: { position: 'absolute', height: 3, borderRadius: 3, backgroundColor: '#D7D4EA', shadowColor: '#FFF', shadowOpacity: 0.8, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }, journeyRouteComplete: { backgroundColor: C.periwinkle }, journeyMilestone: { position: 'absolute', alignItems: 'center' }, journeyNode: { width: 55, height: 55, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 4, shadowColor: '#68638D', shadowOpacity: 0.18, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 4 }, journeyNodeComplete: { backgroundColor: C.periwinkle, borderColor: '#DDD9FF' }, journeyNodeCurrent: { backgroundColor: C.coral, borderColor: '#FFE0D4' }, journeyNodeFuture: { backgroundColor: '#F5F4FA', borderColor: '#D9D8E6', shadowOpacity: 0.06 }, journeyNodeIcon: { color: '#FFF', fontSize: 21, fontWeight: '700' }, journeyMilestoneCard: { width: 142, marginTop: 8, padding: 10, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: 'rgba(231,230,242,0.95)', shadowColor: '#777391', shadowOpacity: 0.08, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, journeyMilestoneCardCurrent: { backgroundColor: '#FFF7F0', borderColor: '#F4D5C7' }, journeyMilestoneCardComplete: { borderColor: '#DDD9FA' }, journeyMilestoneTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 5 }, journeyMilestoneTitle: { flex: 1, color: C.ink, fontSize: 11, fontWeight: '700', lineHeight: 14 }, journeyMilestoneState: { fontSize: 6, letterSpacing: 0.45, fontWeight: '700', marginTop: 1 }, journeyStateComplete: { color: '#6A71B5' }, journeyStateCurrent: { color: C.coral }, journeyStateFuture: { color: '#A7A8BB' }, journeyMilestoneDetail: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 5 },
  journeyModalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.22)' }, journeyModalDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, journeySelectorSheet: { padding: 20, paddingBottom: 26, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF', shadowColor: '#39365B', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 10 }, journeySheetEyebrow: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, journeySheetTitle: { color: C.ink, fontSize: 23, fontWeight: '700', letterSpacing: -0.4, marginTop: 5 }, journeySheetHint: { color: C.muted, fontSize: 10, marginTop: 5, marginBottom: 9 }, journeyBookRow: { minHeight: 67, marginTop: 8, padding: 9, borderRadius: 17, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EBEAF2' }, journeyBookRowActive: { backgroundColor: '#F3F1FF', borderColor: '#D8D1FA' }, journeyBookRowCopy: { flex: 1, marginLeft: 10 }, journeyBookRowTitle: { color: C.ink, fontSize: 12, fontWeight: '700' }, journeyBookRowMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, journeyBookRowEdited: { color: '#9A9CB1', fontSize: 8, marginTop: 4 }, journeyBookRowCheck: { color: C.periwinkle, fontSize: 17, fontWeight: '700', marginLeft: 7 }, journeyMenuShade: { flex: 1, alignItems: 'flex-end', backgroundColor: 'rgba(32,41,84,0.18)', paddingTop: 58, paddingHorizontal: 20 }, journeyMenu: { width: 218, padding: 13, borderRadius: 20, backgroundColor: '#FBFAFF', shadowColor: '#39365B', shadowOpacity: 0.2, shadowRadius: 17, shadowOffset: { width: 0, height: 7 }, elevation: 8 }, journeyMenuTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: 7 }, journeyMenuRow: { minHeight: 38, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#ECEBF3' }, journeyMenuIcon: { color: C.periwinkle, fontSize: 14, width: 22 }, journeyMenuLabel: { flex: 1, color: C.ink, fontSize: 10, fontWeight: '600' }, journeyMenuArrow: { color: C.muted, fontSize: 18 },
  journeyHero: { paddingTop: 13, alignItems: 'center' }, journeyTitle: { color: C.ink, textAlign: 'center', fontSize: 27, fontWeight: '700', lineHeight: 32, letterSpacing: -0.7, marginTop: 8 }, journeyRing: { height: 153, width: 153, borderRadius: 77, marginTop: 23, borderWidth: 15, borderColor: C.periwinkle, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.65)', shadowColor: '#7772AF', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, journeyRingValue: { color: C.ink, fontSize: 32, fontWeight: '700' }, journeyRingLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.8, marginTop: 2, fontWeight: '700' }, nextCard: { marginTop: 25, borderRadius: 21, backgroundColor: '#FFF4E9', padding: 15, flexDirection: 'row', alignItems: 'center' }, nextIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' }, nextIconText: { color: '#A35B4D', fontSize: 19 }, nextOverline: { color: '#B36B61', fontSize: 8, letterSpacing: 0.75, fontWeight: '700', marginLeft: 11 }, nextTitle: { color: C.ink, fontSize: 12, lineHeight: 17, fontWeight: '700', marginLeft: 11, marginTop: 4 }, journeyRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(111,111,153,0.1)' }, journeyIcon: { width: 38, height: 38, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, journeyIconText: { color: '#FFF', fontSize: 16 }, journeyRowTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginLeft: 11 }, journeyRowDate: { color: C.muted, fontSize: 9, letterSpacing: 0.5, marginTop: 4, marginLeft: 11 }, journeyArrow: { color: C.periwinkle, fontSize: 21 },
  profileTop: { alignItems: 'center', paddingTop: 17 }, profileAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFF7F1', alignItems: 'center', justifyContent: 'center', shadowColor: '#65608A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, profileAvatarText: { fontSize: 33, color: C.coral, fontWeight: '700' }, profileHalo: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#FFF', opacity: 0.8 }, profileName: { color: C.ink, fontSize: 23, fontWeight: '700', marginTop: 16 }, profileEmail: { color: C.muted, fontSize: 12, marginTop: 5 }, pathfinder: { paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFF3CB', borderRadius: 13, marginTop: 13 }, pathfinderText: { color: '#A97819', fontSize: 9, letterSpacing: 0.7, fontWeight: '700' }, preferenceTitle: { marginTop: 28, marginBottom: 10, color: C.ink, fontSize: 17, fontWeight: '700' }, preferences: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 20, paddingHorizontal: 15 }, prefRow: { minHeight: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, prefTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, prefSub: { color: C.muted, fontSize: 10, marginTop: 4 }, prefLine: { height: 1, backgroundColor: '#EBEBF1' }, settingsRow: { paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(111,111,153,0.1)' }, settingsText: { color: C.ink, fontSize: 13, fontWeight: '600' },
  settingsCard: { paddingHorizontal: 15, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.75)' }, settingsRowCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }, settingsIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, settingsIconBlue: { backgroundColor: '#EAF4FF' }, settingsIconGold: { backgroundColor: '#FFF4D7' }, settingsIconSage: { backgroundColor: '#ECF8EE' }, settingsIconCoral: { backgroundColor: '#FFF0EC' }, settingsIconText: { color: C.ink, fontSize: 17, fontWeight: '700' }, settingsSub: { color: C.muted, fontSize: 9, marginTop: 3 }, accountCard: { paddingHorizontal: 15, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.75)' }, accountActionRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center' }, deleteText: { color: '#C96567', fontSize: 13, fontWeight: '600' }, profileFootnote: { color: '#9A9CB1', fontSize: 9, textAlign: 'center', marginTop: 20, marginBottom: 4 }, profileModalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.25)' }, profileModalDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, legalSheet: { maxHeight: '88%', padding: 20, paddingBottom: 25, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF', shadowColor: '#39365B', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 10 }, legalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, legalOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, legalTitle: { color: C.ink, fontSize: 24, letterSpacing: -0.4, fontWeight: '700', marginTop: 5 }, legalContent: { paddingTop: 18, paddingBottom: 10 }, legalUpdated: { color: '#9A9CB1', fontSize: 9, letterSpacing: 0.3 }, legalIntro: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 13 }, legalSectionTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 21, marginBottom: 5 }, legalBody: { color: C.muted, fontSize: 11, lineHeight: 17 }, confirmSheet: { padding: 22, paddingBottom: 25, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF', alignItems: 'center', shadowColor: '#39365B', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 10 }, confirmIcon: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, confirmIconDelete: { backgroundColor: '#FFF0EC' }, confirmIconLogout: { backgroundColor: '#ECF8EE' }, confirmIconText: { color: C.ink, fontSize: 25, fontWeight: '700' }, confirmTitle: { color: C.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' }, confirmCopy: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8, maxWidth: 305 }, confirmButton: { alignSelf: 'stretch', minHeight: 48, marginTop: 20, borderRadius: 15, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, confirmButtonDelete: { backgroundColor: C.coral }, confirmButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, cancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' }, cancelButtonText: { color: C.muted, fontSize: 10, fontWeight: '700' }, accountExit: { flex: 1, minHeight: 620, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }, accountExitIcon: { width: 72, height: 72, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, accountExitTitle: { color: C.ink, fontSize: 27, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center' }, accountExitCopy: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 290, marginTop: 10 }, accountExitButton: { minHeight: 49, marginTop: 25, paddingHorizontal: 18, borderRadius: 15, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center' }, accountExitButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, accountExitButtonArrow: { color: '#FFF', fontSize: 18, marginLeft: 12 },
  statsHero: { paddingTop: 13 }, statsHeroTop: { flexDirection: 'row', alignItems: 'flex-start' }, statsJourneyButton: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F4F2FF', flexDirection: 'row', alignItems: 'center', gap: 5 }, statsJourneyButtonText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, statsJourneyButtonArrow: { color: C.periwinkle, fontSize: 13 }, statsTitle: { fontSize: 29, lineHeight: 33, letterSpacing: -0.7, color: C.ink, fontWeight: '700', marginTop: 8 }, statsBookName: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 10 }, rangeRow: { flexDirection: 'row', gap: 8, marginTop: 17 }, pill: { paddingVertical: 8, paddingHorizontal: 13, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 13 }, pillSelected: { backgroundColor: C.periwinkle }, pillText: { color: C.muted, fontSize: 10, fontWeight: '700' }, pillTextSelected: { color: '#FFF' }, statsNumbers: { marginTop: 20, padding: 18, backgroundColor: '#FFF', borderRadius: 23, flexDirection: 'row', alignItems: 'center', shadowColor: '#706C98', shadowOpacity: 0.1, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, statsHeadlineMetric: { flex: 1 }, statsHeadlineDivider: { width: 1, height: 47, backgroundColor: '#E8E7F0', marginHorizontal: 15 }, bigNumber: { color: C.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.6 }, bigNumberLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', marginTop: 5 }, statsMetricHint: { color: '#9A9CB1', fontSize: 8, marginTop: 5 }, statsMetricGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, statsMetricCard: { width: '48%', minHeight: 104, padding: 13, borderRadius: 18 }, statsMetricIcon: { color: C.periwinkle, fontSize: 17 }, statsMetricCardValue: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 13 }, statsMetricCardLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.5, fontWeight: '700', marginTop: 5 }, chartCard: { marginTop: 17, backgroundColor: '#F4F2FF', borderRadius: 22, padding: 17 }, chartHeader: { flexDirection: 'row', justifyContent: 'space-between' }, chartTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, chartTotal: { color: C.periwinkle, fontWeight: '700', fontSize: 13 }, statsCardHint: { color: '#9A9CB1', fontSize: 8, marginTop: 3 }, chart: { height: 125, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }, barCol: { alignItems: 'center', justifyContent: 'flex-end', width: 25, height: '100%' }, bar: { width: 15, borderRadius: 8, backgroundColor: '#CFC8F6' }, barActive: { backgroundColor: C.coral }, barLabel: { color: C.muted, fontSize: 9, marginTop: 8 }, statsEmptyHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 11 }, statsSectionHeader: { marginTop: 24, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, statsSectionTitle: { color: C.ink, fontSize: 17, fontWeight: '700' }, statsSectionCount: { color: C.periwinkle, fontSize: 9, fontWeight: '700', marginBottom: 2 }, statsDayRow: { marginTop: 9, padding: 11, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ECEBF3' }, statsDayCopy: { flex: 1 }, statsDayTitle: { color: C.ink, fontSize: 10, fontWeight: '700' }, statsDaySub: { color: '#9A9CB1', fontSize: 8, marginTop: 4 }, statsDayMetric: { width: 43, alignItems: 'flex-end', marginLeft: 4 }, statsDayValue: { color: C.ink, fontSize: 10, fontWeight: '700' }, statsDayLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.35, fontWeight: '700', marginTop: 3 }, statsEmptyCard: { marginTop: 10, padding: 18, borderRadius: 18, backgroundColor: '#F4F2FF', alignItems: 'center' }, statsEmptyIcon: { color: C.periwinkle, fontSize: 24 }, statsEmptyTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginTop: 8 }, statsEmptyCopy: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5 }, statsBreakdownCard: { marginTop: 22, padding: 16, borderRadius: 21, backgroundColor: '#FFF', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, inputMixTrack: { height: 12, marginTop: 16, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#E8E7F3' }, inputMixDictation: { height: 12, backgroundColor: C.coral }, inputMixWriting: { height: 12, backgroundColor: C.periwinkle }, inputMixLegend: { marginTop: 13, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, inputMixLegendItem: { flex: 1, flexDirection: 'row', alignItems: 'center' }, inputMixDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 }, inputMixLabel: { color: C.muted, fontSize: 8, flex: 1 }, inputMixValue: { color: C.ink, fontSize: 9, fontWeight: '700' }, statsInsightCard: { marginTop: 17, padding: 17, borderRadius: 21, backgroundColor: '#FFF4E8' }, statsInsightEyebrow: { color: '#A97819', fontSize: 8, letterSpacing: 0.8, fontWeight: '700' }, statsInsightTitle: { color: C.ink, fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 8 }, statsInsightCopy: { color: '#866F50', fontSize: 10, lineHeight: 15, marginTop: 5 }, statsInsightMetric: { marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F0DDB8', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, statsInsightMetricLabel: { color: '#A97819', fontSize: 7, letterSpacing: 0.55, fontWeight: '700' }, statsInsightMetricValue: { color: C.ink, fontSize: 12, fontWeight: '700' }, statsBookCard: { marginTop: 10, padding: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center' }, statsBookCardDivider: { width: 1, height: 40, backgroundColor: '#E8E7EF', marginHorizontal: 15 }, statsBookCardLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.5, fontWeight: '700' }, statsBookCardValue: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 6 }, winGrid: { flexDirection: 'row', gap: 10 }, winCard: { flex: 1, padding: 15, borderRadius: 20, minHeight: 123 }, winIcon: { fontSize: 19, color: C.periwinkle }, winValue: { color: C.ink, fontWeight: '700', fontSize: 21, marginTop: 15 }, winLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.55, fontWeight: '700', marginTop: 5 },
  librarySectionEyebrow: { color: C.muted, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginTop: 22, marginBottom: 9 }, libraryProjectCard: { marginBottom: 11, padding: 12, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#68638D', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, libraryProjectCardArchived: { opacity: 0.66 }, libraryProjectTop: { flexDirection: 'row', alignItems: 'center' }, projectType: { color: C.muted, fontSize: 9, marginTop: 3 }, projectOverflowButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F2FF' }, projectOverflowText: { color: C.muted, fontSize: 13, letterSpacing: 1, marginTop: -6 }, projectStats: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EBEBF2', flexDirection: 'row', alignItems: 'center', gap: 6 }, projectStatText: { color: C.muted, fontSize: 9, flexShrink: 1 }, projectStatDot: { color: '#B4B5C8', fontSize: 9 }, projectCardActions: { marginTop: 11, flexDirection: 'row', gap: 8 }, projectContinueButton: { flex: 1, minHeight: 39, paddingHorizontal: 12, borderRadius: 13, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, projectContinueText: { color: '#FFF', fontSize: 10, fontWeight: '700' }, projectContinueArrow: { color: '#FFF', fontSize: 16 }, projectPreviewButton: { minHeight: 39, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#D8D5F5', backgroundColor: '#F7F5FF', alignItems: 'center', justifyContent: 'center' }, projectPreviewText: { color: C.periwinkle, fontSize: 10, fontWeight: '700' }, libraryMenuShade: { flex: 1, backgroundColor: 'rgba(29,33,69,0.22)', paddingTop: 80, paddingHorizontal: 20, alignItems: 'flex-end' }, libraryMenu: { width: 270, padding: 13, borderRadius: 22, backgroundColor: '#FBFAFF', shadowColor: '#4E4A7F', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 9 }, elevation: 8 }, libraryMenuOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700', marginBottom: 4 }, libraryMenuTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginBottom: 5 }, libraryMenuRow: { minHeight: 40, paddingHorizontal: 5, borderTopWidth: 1, borderTopColor: '#ECEBF3', flexDirection: 'row', alignItems: 'center' }, libraryMenuIcon: { color: C.periwinkle, width: 26, fontSize: 15 }, libraryMenuIconDelete: { color: C.coral, width: 26, fontSize: 18 }, libraryMenuLabel: { flex: 1, color: C.ink, fontSize: 10, fontWeight: '600' }, libraryMenuDeleteLabel: { flex: 1, color: C.coral, fontSize: 10, fontWeight: '600' }, libraryMenuArrow: { color: C.muted, fontSize: 18 }, renameModalShade: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(32,41,84,0.25)' }, renameSheet: { padding: 20, borderRadius: 24, backgroundColor: '#FBFAFF' }, renameTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 4 }, renameInput: { minHeight: 46, marginTop: 16, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: '#DCDCEA', color: C.ink, fontSize: 13, backgroundColor: '#FFF' }, renameActions: { marginTop: 15, flexDirection: 'row', justifyContent: 'flex-end', gap: 9 }, renameCancel: { minHeight: 40, paddingHorizontal: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, renameCancelText: { color: C.muted, fontSize: 10, fontWeight: '700' }, renameSave: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, renameSaveText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  studioPage: { paddingBottom: 7 }, studioHeader: { minHeight: 57, flexDirection: 'row', alignItems: 'center' }, studioBackButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)' }, studioBackIcon: { color: C.ink, fontSize: 28, lineHeight: 29, marginTop: -2 }, studioHeaderCopy: { flex: 1, marginLeft: 11, marginRight: 8 }, studioOverline: { color: C.muted, fontSize: 7, letterSpacing: 1, fontWeight: '700' }, studioHeaderTitle: { color: C.ink, fontSize: 20, fontWeight: '700', marginTop: 3 }, studioHeaderMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, studioOverflowButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)' }, studioOverflowText: { color: C.muted, fontSize: 14, letterSpacing: 1, marginTop: -7 }, studioTabs: { gap: 7, paddingTop: 10, paddingBottom: 4, paddingRight: 20 }, studioTab: { minWidth: 80, minHeight: 35, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.65)' }, studioTabSelected: { backgroundColor: C.periwinkle }, studioTabText: { color: C.muted, fontSize: 10, fontWeight: '700' }, studioTabTextSelected: { color: '#FFF' }, studioKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, studioSummaryCard: { marginTop: 15, padding: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', shadowColor: '#6B6794', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, studioSummaryTitle: { color: C.ink, fontSize: 17, fontWeight: '700', marginTop: 5 }, studioSummaryCopy: { color: C.muted, fontSize: 9, marginTop: 5 }, studioStatusDot: { width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1D0' }, studioStatusDotFinished: { backgroundColor: '#E9F7EB' }, studioStatusDotText: { color: '#A97819', fontSize: 20, fontWeight: '700' }, studioAccordion: { marginTop: 10, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: '#ECEBF3' }, studioAccordionHeader: { minHeight: 66, padding: 12, flexDirection: 'row', alignItems: 'center' }, studioAccordionIcon: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EEFF' }, studioAccordionIconText: { color: C.periwinkle, fontSize: 17, fontWeight: '700' }, studioAccordionCopy: { flex: 1, marginLeft: 10 }, studioAccordionTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, studioAccordionHint: { color: C.muted, fontSize: 9, marginTop: 3 }, studioAccordionChevron: { color: C.periwinkle, fontSize: 18, marginLeft: 8 }, studioAccordionBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#EEEEF4' }, studioOrderRow: { minHeight: 53, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EFF5', flexDirection: 'row', alignItems: 'center', gap: 5 }, studioOrderNumber: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EEFF' }, studioOrderNumberText: { color: C.periwinkle, fontSize: 8, fontWeight: '700' }, studioOrderCopy: { flex: 1, minWidth: 0 }, studioOrderTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, studioOrderMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, studioMoveButton: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F2FF' }, studioMoveDisabled: { opacity: 0.3 }, studioMoveText: { color: C.periwinkle, fontSize: 14, fontWeight: '700' }, studioOpenWrite: { minHeight: 27, paddingHorizontal: 7, borderRadius: 9, backgroundColor: '#FFF3E9', alignItems: 'center', justifyContent: 'center' }, studioOpenWriteText: { color: '#A97819', fontSize: 8, fontWeight: '700' }, studioMatterRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EFF5', flexDirection: 'row', alignItems: 'flex-start' }, studioCheck: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: '#D2D2DF', alignItems: 'center', justifyContent: 'center' }, studioCheckOn: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, studioCheckText: { color: '#FFF', fontSize: 12, fontWeight: '700' }, studioMatterCopy: { flex: 1, marginLeft: 10 }, studioMatterTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, studioMatterMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, studioMatterInput: { minHeight: 51, marginTop: 7, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E1EC', color: C.ink, fontSize: 10, lineHeight: 15, textAlignVertical: 'top', backgroundColor: '#FFF' }, studioManuscriptRow: { minHeight: 53, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EFF5', flexDirection: 'row', alignItems: 'center' }, studioManuscriptDot: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F1F7' }, studioManuscriptDotComplete: { backgroundColor: '#E9F7EB' }, studioManuscriptDotText: { color: C.muted, fontSize: 15, fontWeight: '700' }, studioControlRow: { minHeight: 51, borderBottomWidth: 1, borderBottomColor: '#F0EFF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, studioControlLabel: { color: C.ink, fontSize: 10, fontWeight: '700' }, studioControlOptions: { flexDirection: 'row', gap: 6 }, studioOption: { minHeight: 30, paddingHorizontal: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F1F7' }, studioOptionSelected: { backgroundColor: '#EEEDFF', borderWidth: 1, borderColor: C.periwinkle }, studioOptionText: { color: C.muted, fontSize: 9, fontWeight: '700' }, studioPrimaryButton: { minHeight: 49, marginTop: 16, paddingHorizontal: 15, borderRadius: 15, backgroundColor: C.periwinkle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, studioPrimaryButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, studioPrimaryButtonArrow: { color: '#FFF', fontSize: 19 }, studioStopButton: { backgroundColor: C.coral }, studioMenuShade: { flex: 1, backgroundColor: 'rgba(29,33,69,0.22)', paddingTop: 75, paddingHorizontal: 20, alignItems: 'flex-end' }, studioMenu: { width: 260, padding: 13, borderRadius: 21, backgroundColor: '#FBFAFF' }, studioPickerShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.22)' }, studioPickerDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, studioPickerSheet: { padding: 20, paddingBottom: 25, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF' }, studioPickerOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, studioPickerTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 5, marginBottom: 8 }, studioPickerRow: { minHeight: 57, marginTop: 8, padding: 9, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#ECEBF3' }, studioPickerRowSelected: { backgroundColor: '#F3F1FF', borderColor: '#D9D2FA' }, studioPickerMark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, studioPickerMarkText: { color: '#FFF', fontSize: 16 }, studioPickerCopy: { flex: 1, marginLeft: 9 }, studioPickerBookTitle: { color: C.ink, fontSize: 11, fontWeight: '700' }, studioPickerBookMeta: { color: C.muted, fontSize: 8, marginTop: 3 }, studioPickerCheck: { color: C.periwinkle, fontSize: 17, fontWeight: '700' }, studioError: { minHeight: 500, alignItems: 'center', justifyContent: 'center', padding: 24 }, studioErrorIcon: { color: C.periwinkle, fontSize: 29 }, studioErrorTitle: { color: C.ink, fontSize: 22, fontWeight: '700', marginTop: 10 }, studioErrorCopy: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 7, lineHeight: 17 },
  readerToolbar: { marginTop: 15, padding: 15, borderRadius: 20, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, readerToolbarTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 5 }, readerListenButton: { minHeight: 35, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#FFF3E9', alignItems: 'center', justifyContent: 'center' }, readerListenText: { color: '#A97819', fontSize: 9, fontWeight: '700' }, readerToc: { marginTop: 11, padding: 13, borderRadius: 20, backgroundColor: '#F2F0FF' }, readerTocTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginBottom: 5 }, readerTocRow: { minHeight: 32, paddingHorizontal: 7, borderRadius: 9, flexDirection: 'row', alignItems: 'center' }, readerTocRowSelected: { backgroundColor: '#FFF' }, readerTocNumber: { color: C.periwinkle, width: 23, fontSize: 8, fontWeight: '700' }, readerTocLabel: { flex: 1, color: C.ink, fontSize: 9 }, readerTocState: { color: C.muted, fontSize: 10 }, readerBook: { marginTop: 14, padding: 18, borderRadius: 23, backgroundColor: '#FFFDF9', shadowColor: '#81798C', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, readerTitlePage: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#EEE7DD' }, readerTitleKicker: { color: C.coral, fontSize: 8, letterSpacing: 1.2, fontWeight: '700' }, readerBookTitle: { maxWidth: 275, color: C.ink, fontSize: 31, lineHeight: 36, fontWeight: '700', textAlign: 'center', marginTop: 13 }, readerBookTitleModern: { letterSpacing: 1, textTransform: 'uppercase' }, readerBookStatus: { color: C.muted, fontSize: 9, marginTop: 9 }, readerMatter: { paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#EEE7DD' }, readerMatterTitle: { color: C.ink, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 10 }, readerChapter: { paddingTop: 29, paddingBottom: 8 }, readerChapterTitle: { color: C.ink, fontSize: 21, lineHeight: 27, fontWeight: '700', marginBottom: 14 }, readerChapterTitleModern: { color: C.periwinkle, letterSpacing: 0.7, textTransform: 'uppercase', fontSize: 17 }, readerBody: { color: '#46465C', fontSize: 16, lineHeight: 25 }, readerMissing: { padding: 15, borderRadius: 15, backgroundColor: '#F5F2FF', alignItems: 'center' }, readerMissingIcon: { color: C.periwinkle, fontSize: 22 }, readerMissingTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 7 }, readerMissingCopy: { color: C.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 4 }, readerWriteButton: { minHeight: 33, marginTop: 11, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, readerWriteButtonText: { color: '#FFF', fontSize: 9, fontWeight: '700' }, listenHero: { marginTop: 15, padding: 17, borderRadius: 22, backgroundColor: '#F1F0FF', flexDirection: 'row', alignItems: 'center' }, listenOrb: { width: 55, height: 55, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.periwinkle }, listenOrbText: { color: '#FFF', fontSize: 25 }, listenHeroCopy: { flex: 1, marginLeft: 13 }, listenTitle: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 5 }, listenCopy: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 5 }, listenControls: { marginTop: 2 }, listenNote: { color: '#9A9CB1', fontSize: 8, textAlign: 'center', marginTop: 7 }, studioSectionTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 23, marginBottom: 9 }, listenRow: { minHeight: 61, padding: 10, marginBottom: 7, borderRadius: 16, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, listenRowIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF3E9' }, listenRowIconText: { color: '#A97819', fontSize: 15 }, listenRowButton: { minHeight: 30, paddingHorizontal: 9, borderRadius: 10, backgroundColor: '#EEEDFF', justifyContent: 'center' }, listenRowButtonText: { color: C.periwinkle, fontSize: 8, fontWeight: '700' }, exportHero: { marginTop: 15, padding: 18, borderRadius: 22, backgroundColor: '#EAF4FF' }, exportTitle: { color: C.ink, fontSize: 24, lineHeight: 29, fontWeight: '700', marginTop: 6 }, exportCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 8 }, exportStats: { marginTop: 11, padding: 17, borderRadius: 19, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, exportStatValue: { color: C.ink, fontSize: 22, fontWeight: '700', textAlign: 'center' }, exportStatLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', marginTop: 4, textAlign: 'center' }, exportStatDivider: { width: 1, height: 34, backgroundColor: '#E9E8F0' }, exportFootnote: { color: '#9A9CB1', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 14, paddingHorizontal: 12 },
  navShell: { position: 'absolute', left: 13, right: 13, bottom: 12, height: 67, paddingHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 24, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#5F5C8B', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 }, navItem: { width: 45, alignItems: 'center' }, navIcon: { height: 26, color: '#A3A6C1', fontSize: 18 }, navIconActive: { color: C.periwinkle }, navLabel: { color: '#A3A6C1', fontSize: 8 }, navLabelActive: { color: C.ink, fontWeight: '700' },
});
