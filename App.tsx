import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

type Page = 'Library' | 'Plan' | 'Write' | 'Journey' | 'Profile' | 'Stats';

const C = {
  ink: '#202954', muted: '#6E7699', periwinkle: '#8B8AE8', sky: '#A5DCF7', lavender: '#C9BCF5',
  sage: '#A7D4AD', peach: '#FFC09D', coral: '#F78385', gold: '#F5C75C', paper: '#F8F8FF', white: '#FFFFFF',
};

const pageMeta: Record<Page, { icon: string; short: string }> = {
  Library: { icon: '▦', short: 'Library' }, Plan: { icon: '⌘', short: 'Plan' }, Write: { icon: '✎', short: 'Write' },
  Journey: { icon: '✦', short: 'Journey' }, Profile: { icon: '◉', short: 'Profile' }, Stats: { icon: '▥', short: 'Stats' },
};

type Project = { title: string; detail: string; color: string; mark: string; type: string; pageGoal: string; unitGoal: string };

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

function Library({ projects, activeProject, onPage, onSelectProject, onProjectsChange }: { projects: Project[]; activeProject: string; onPage: (page: Page) => void; onSelectProject: (title: string) => void; onProjectsChange: (projects: Project[]) => void }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(projectTypes[0]);
  const [projectName, setProjectName] = useState('');

  const createProject = () => {
    const name = projectName.trim() || `Untitled ${selectedType.name}`;
    onProjectsChange([{ title: name, detail: `New ${selectedType.name} · 0%`, color: selectedType.color, mark: selectedType.icon, type: selectedType.name, pageGoal: planBlueprints[selectedType.name].defaultPages, unitGoal: planBlueprints[selectedType.name].defaultUnits }, ...projects]);
    onSelectProject(name);
    setProjectName('');
    setComposerOpen(false);
  };

  return <><PageHeader page="Library" onPage={onPage} /><Text style={s.intro}>Pick up a thread, or begin a brand new little world.</Text>
    <View style={s.focusCard}><LinearGradient colors={['#A6DDF7', '#8B8AE8']} style={StyleSheet.absoluteFill} />
      <Text style={s.focusEyebrow}>CONTINUE WRITING</Text><Text style={s.focusTitle}>{activeProject}</Text><Text style={s.focusCopy}>Your next scene is waiting for you.</Text>
      <Pressable onPress={() => onPage('Write')} style={s.lightAction}><Text style={s.lightActionText}>Open manuscript</Text><Text style={s.lightArrow}>→</Text></Pressable>
      <Text style={s.focusShape}>◢</Text>
    </View>
    <View style={s.sectionBar}><Text style={s.sectionTitle}>Your projects</Text><Pressable onPress={() => setComposerOpen(true)} style={s.newProjectButton}><Text style={s.newProjectText}>+ NEW</Text></Pressable></View>
    {projects.map((project) => <Pressable key={project.title} onPress={() => onSelectProject(project.title)} style={[s.projectRow, activeProject === project.title && s.projectRowActive]}>
      <View style={[s.projectMark, { backgroundColor: project.color }]}><Text style={s.projectMarkText}>{project.mark}</Text></View>
      <View style={s.projectCopy}><Text style={s.projectTitle}>{project.title}</Text><Text style={s.projectDetail}>{project.detail}</Text></View>
      {activeProject === project.title ? <View style={s.continueTag}><Text style={s.continueTagText}>OPEN</Text></View> : <Text style={s.chevron}>›</Text>}
    </Pressable>)}
    <Pressable onPress={() => setComposerOpen(true)} style={s.addProjectRow}><View style={s.addProjectPlus}><Text style={s.addProjectPlusText}>+</Text></View><View><Text style={s.addProjectTitle}>Start another project</Text><Text style={s.addProjectSub}>Choose a format and make it yours</Text></View></Pressable>

    <Modal animationType="slide" visible={composerOpen} transparent onRequestClose={() => setComposerOpen(false)}>
      <View style={s.modalShade}><View style={s.composerSheet}>
        <View style={s.sheetHandle} />
        <View style={s.composerHeader}><View><Text style={s.composerOverline}>A FRESH BEGINNING</Text><Text style={s.composerTitle}>What are you making?</Text></View><Pressable onPress={() => setComposerOpen(false)} style={s.closeButton}><Text style={s.closeButtonText}>×</Text></Pressable></View>
        <TextInput value={projectName} onChangeText={setProjectName} placeholder="Give your project a name" placeholderTextColor="#9298B3" style={s.projectInput} returnKeyType="done" onSubmitEditing={createProject} />
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
  </>;
}

function Plan({ projects, activeProject, onSelectProject, onUpdateProject }: { projects: Project[]; activeProject: string; onSelectProject: (title: string) => void; onUpdateProject: (title: string, changes: Partial<Project>) => void }) {
  const currentProject = projects.find((project) => project.title === activeProject) ?? projects[0];
  const initialBlueprint = planBlueprints[currentProject?.type] ?? planBlueprints['Custom Project'];
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState('');
  const [plotThread, setPlotThread] = useState('');
  const [people, setPeople] = useState('');
  const [structure, setStructure] = useState(defaultStructureFor(initialBlueprint));
  const [structurePage, setStructurePage] = useState(0);
  const [plotNotes, setPlotNotes] = useState<Record<string, string>>({});
  const [unitIdeas, setUnitIdeas] = useState<string[]>([]);

  const selectedType = projectTypes.find((type) => type.name === currentProject?.type) ?? projectTypes[projectTypes.length - 1];
  const blueprint = planBlueprints[selectedType.name];
  const pageGoal = currentProject?.pageGoal ?? blueprint.defaultPages;
  const unitGoal = currentProject?.unitGoal ?? blueprint.defaultUnits;
  const unitCount = Math.min(Math.max(Number.parseInt(unitGoal, 10) || 0, 0), 24);
  const structurePageSize = 4;
  const structurePageCount = Math.max(1, Math.ceil(blueprint.structureItems.length / structurePageSize));
  const visibleStructureItems = blueprint.structureItems.slice(structurePage * structurePageSize, (structurePage + 1) * structurePageSize);

  const chooseProject = (project: Project) => {
    if (project.title === activeProject) return;
    const nextBlueprint = planBlueprints[project.type] ?? planBlueprints['Custom Project'];
    onSelectProject(project.title);
    setIdea('');
    setPlotThread('');
    setPeople('');
    setStructure(defaultStructureFor(nextBlueprint));
    setStructurePage(0);
    setPlotNotes({});
    setUnitIdeas([]);
  };

  const updatePlotNote = (label: string, value: string) => setPlotNotes((current) => ({ ...current, [label]: value }));
  const updateUnitIdea = (index: number, value: string) => setUnitIdeas((current) => {
    const next = [...current];
    next[index] = value;
    return next;
  });

  const stepMeta = [
    { label: 'Scope', short: 'Size + pace' },
    { label: 'Structure', short: 'What belongs' },
    { label: 'Story map', short: 'Idea + arc' },
  ];

  return <>
    <View style={s.planHero}>
      <Text style={s.planHeroOverline}>A KINDER WAY TO BEGIN</Text>
      <Text style={s.planHeroTitle}>Plan the shape{`\n`}of your work.</Text>
      <Text style={s.planHeroCopy}>Choose a format, then make the plan feel like yours.</Text>
      <Text style={s.planHeroOrb}>◒</Text>
    </View>

    <Text style={s.planSwitcherLabel}>SWITCH PROJECT</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.planTypeRow}>
      {projects.map((project) => {
        const projectType = projectTypes.find((type) => type.name === project.type) ?? projectTypes[projectTypes.length - 1];
        return <Pressable key={project.title} onPress={() => chooseProject(project)} style={[s.planProjectPill, activeProject === project.title && s.planTypePillActive]}>
          <View style={[s.planTypeDot, { backgroundColor: projectType.color }]}><Text style={s.planTypeDotText}>{projectType.icon}</Text></View>
          <View style={s.planProjectCopy}><Text numberOfLines={1} style={[s.planTypeText, activeProject === project.title && s.planTypeTextActive]}>{project.title}</Text><Text numberOfLines={1} style={s.planProjectType}>{project.type}</Text></View>
        </Pressable>;
      })}
    </ScrollView>

    <View style={s.planSelectedCard}>
      <View style={[s.planSelectedIcon, { backgroundColor: selectedType.color }]}><Text style={s.planSelectedIconText}>{selectedType.icon}</Text></View>
      <View style={{ flex: 1 }}><Text style={s.planSelectedOverline}>PLANNING</Text><Text style={s.planSelectedTitle}>{selectedType.name}</Text><Text style={s.planSelectedSub}>{blueprint.unitLabelPlural} · {pageGoal || '—'} pages</Text></View>
      <Text style={s.planSelectedArrow}>✦</Text>
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
      <Text style={s.planSectionCopy}>{blueprint.structureIntro} Keep the suggested pieces, or tap any row to add and take away parts.</Text>
      <View style={s.structureList}>
        {visibleStructureItems.map((item) => <Pressable key={item.label} onPress={() => setStructure((current) => ({ ...current, [item.label]: !current[item.label] }))} style={[s.structureRow, structure[item.label] && s.structureRowActive]}>
          <View style={[s.structureCheck, structure[item.label] && s.structureCheckOn]}><Text style={s.structureCheckText}>{structure[item.label] ? '✓' : ''}</Text></View>
          <View style={s.structureCopy}><Text style={s.structureLabel}>{item.label}</Text><Text style={s.structureHelper}>{item.helper}</Text></View>
          {!item.recommended && <Text style={s.optionalTag}>OPTIONAL</Text>}
        </Pressable>)}
      </View>
      <View style={s.structureFooterRow}>
        <Text style={[s.structureFooter, s.structureFooterCompact]}>{Object.values(structure).filter(Boolean).length} pieces in your current plan</Text>
        {structurePageCount > 1 && <View style={s.structurePager}>
          <Pressable onPress={() => setStructurePage(Math.max(0, structurePage - 1))} disabled={structurePage === 0} style={[s.structurePagerButton, structurePage === 0 && s.structurePagerButtonDisabled]}><Text style={s.structurePagerButtonText}>‹</Text></Pressable>
          <Text style={s.structurePagerCount}>{structurePage + 1} / {structurePageCount}</Text>
          <Pressable onPress={() => setStructurePage(Math.min(structurePageCount - 1, structurePage + 1))} disabled={structurePage === structurePageCount - 1} style={[s.structurePagerButton, structurePage === structurePageCount - 1 && s.structurePagerButtonDisabled]}><Text style={s.structurePagerButtonText}>›</Text></Pressable>
        </View>}
      </View>
    </View>}

    {step === 2 && <View style={s.planStepCard}>
      <Text style={s.planSectionKicker}>SECTION 3 · MAKE THE STORY MAP</Text>
      <Text style={s.planSectionTitle}>Put the heart on the page.</Text>
      <Text style={s.planSectionCopy}>Start loose. These notes are here to give you somewhere to return when the draft gets foggy.</Text>

      <View style={s.planInputCard}><Text style={s.planInputLabel}>THE BIG IDEA</Text><Text style={s.planInputHint}>One clear sentence is enough for now.</Text><TextInput value={idea} onChangeText={setIdea} placeholder={blueprint.ideaPlaceholder} placeholderTextColor="#9A9DB7" multiline style={s.planTextArea} /></View>

      <View style={s.plotGuide}><Text style={s.plotGuideTitle}>{blueprint.plotLabel}</Text><Text style={s.plotGuideText}>{blueprint.plotNote}</Text></View>
      <View style={s.planInputCard}><Text style={s.planInputLabel}>ONE-LINE THROUGHLINE</Text><Text style={s.planInputHint}>If you had to explain the movement in one breath.</Text><TextInput value={plotThread} onChangeText={setPlotThread} placeholder="It starts with… and ends with…" placeholderTextColor="#9A9DB7" multiline style={s.planTextAreaSmall} /></View>

      <Text style={s.planSubheading}>{blueprint.plotLabel}</Text>
      {blueprint.plotPrompts.map((prompt) => <View key={prompt.label} style={s.plotPrompt}><Text style={s.plotPromptTitle}>{prompt.label}</Text><Text style={s.plotPromptHelper}>{prompt.helper}</Text><TextInput value={plotNotes[prompt.label] || ''} onChangeText={(value) => updatePlotNote(prompt.label, value)} placeholder="A few calm notes…" placeholderTextColor="#A0A3BB" multiline style={s.planTextAreaSmall} /></View>)}

      <View style={s.planInputCard}><Text style={s.planInputLabel}>{blueprint.peopleLabel.toUpperCase()}</Text><Text style={s.planInputHint}>{blueprint.peopleHelper}</Text><TextInput value={people} onChangeText={setPeople} placeholder={blueprint.peoplePlaceholder} placeholderTextColor="#9A9DB7" multiline style={s.planTextArea} /></View>

      <View style={s.chapterHeader}><View><Text style={s.planSubheading}>{blueprint.unitLabelPlural[0].toUpperCase() + blueprint.unitLabelPlural.slice(1)} map</Text><Text style={s.chapterHeaderHint}>One note for each {blueprint.unitLabel} keeps the draft moving.</Text></View><View style={s.chapterCountBadge}><Text style={s.chapterCountText}>{unitCount || '—'}</Text></View></View>
      {unitCount > 0 ? Array.from({ length: unitCount }, (_, index) => <View key={index} style={s.chapterRow}><View style={s.chapterIndex}><Text style={s.chapterIndexText}>{String(index + 1).padStart(2, '0')}</Text></View><TextInput value={unitIdeas[index] || ''} onChangeText={(value) => updateUnitIdea(index, value)} placeholder={`${blueprint.unitLabel[0].toUpperCase() + blueprint.unitLabel.slice(1)} ${index + 1}: what happens, is taught, or is felt?`} placeholderTextColor="#A0A3BB" multiline style={s.chapterTextInput} /></View>) : <View style={s.emptyChapter}><Text style={s.emptyChapterIcon}>⌁</Text><Text style={s.emptyChapterText}>Set a target number in Section 1 and your {blueprint.unitLabelPlural} map will appear here.</Text></View>}
      {Number.parseInt(unitGoal, 10) > 24 && <Text style={s.chapterLimitNote}>Showing the first 24 {blueprint.unitLabelPlural} here so the plan stays easy to scan.</Text>}
    </View>}

    <View style={s.planFooter}>
      <Pressable onPress={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={[s.planNavButton, step === 0 && s.planNavButtonDisabled]}><Text style={s.planNavButtonText}>← Back</Text></Pressable>
      <Text style={s.planFooterText}>STEP {step + 1} OF 3</Text>
      <Pressable onPress={() => setStep(Math.min(2, step + 1))} disabled={step === 2} style={[s.planNavButton, s.planNavButtonPrimary, step === 2 && s.planNavButtonDisabled]}><Text style={[s.planNavButtonText, s.planNavButtonTextPrimary]}>{step === 2 ? 'Plan ready' : 'Next →'}</Text></Pressable>
    </View>
  </>;
}

function Write() {
  const [words, setWords] = useState(842);
  const [saved, setSaved] = useState(true);
  return <><View style={s.writeTop}><View><Text style={s.overline}>THE MIDNIGHT ATLAS · CHAPTER 12</Text><Text style={s.writeTitle}>A door opens{`\n`}in the rain.</Text></View><Pressable onPress={() => setSaved(!saved)} style={[s.saveChip, saved && s.saveChipDone]}><Text style={[s.saveChipText, saved && s.saveChipTextDone]}>{saved ? '✓ SAVED' : 'SAVE'}</Text></Pressable></View>
    <View style={s.manuscript}><Text style={s.manuscriptKicker}>CHAPTER TWELVE</Text><Text style={s.manuscriptText}>The road disappeared before the sea did. Mara kept walking anyway, following the small amber lamps where they swayed in the fog.</Text><Text style={s.manuscriptText}>At the end of the pier, a blue door stood open. A warm room glowed inside it, as if it had been waiting all this time.</Text><View style={s.cursorLine}><View style={s.cursor} /></View></View>
    <View style={s.writePrompt}><View style={s.promptIcon}><Text style={s.promptIconText}>✦</Text></View><View style={{ flex: 1 }}><Text style={s.promptTitle}>Keep the thread</Text><Text style={s.promptText}>What does Mara notice first?</Text></View><Pressable onPress={() => setWords(words + 37)} style={s.addWords}><Text style={s.addWordsText}>+37</Text></Pressable></View>
    <View style={s.writerFooter}><Text style={s.writerFooterText}>{words} words today</Text><View style={s.wordDots}>{[1, 2, 3, 4, 5].map((dot) => <View key={dot} style={[s.wordDot, dot < 5 && s.wordDotFilled]} />)}</View><Text style={s.writerFooterText}>Goal 1,000</Text></View>
  </>;
}

function Journey({ onPage }: { onPage: (page: Page) => void }) {
  return <><View style={s.journeyHero}><Text style={s.planHeroOverline}>YOUR CREATIVE JOURNEY</Text><Text style={s.journeyTitle}>You’re making{`\n`}beautiful progress.</Text><View style={s.journeyRing}><Text style={s.journeyRingValue}>68%</Text><Text style={s.journeyRingLabel}>DRAFTED</Text></View></View>
    <View style={s.nextCard}><View style={s.nextIcon}><Text style={s.nextIconText}>→</Text></View><View style={{ flex: 1 }}><Text style={s.nextOverline}>YOUR NEXT SMALL STEP</Text><Text style={s.nextTitle}>Write 158 words to meet today’s goal.</Text></View></View>
    <View style={s.sectionBar}><Text style={s.sectionTitle}>The path so far</Text><Pressable onPress={() => onPage('Stats')}><Text style={s.link}>VIEW STATS</Text></Pressable></View>
    {[['✦', 'First draft halfway there', 'TODAY', C.gold], ['✓', 'Seven-day writing rhythm', 'YESTERDAY', C.sage], ['⌁', 'Outline is taking shape', 'JUL 28', C.lavender]].map(([icon, title, date, color]) => <View key={String(title)} style={s.journeyRow}><View style={[s.journeyIcon, { backgroundColor: String(color) }]}><Text style={s.journeyIconText}>{icon}</Text></View><View style={{ flex: 1 }}><Text style={s.journeyRowTitle}>{title}</Text><Text style={s.journeyRowDate}>{date}</Text></View><Text style={s.journeyArrow}>›</Text></View>)}
  </>;
}

function Profile() {
  const [reminders, setReminders] = useState(true); const [cloud, setCloud] = useState(true);
  return <><View style={s.profileTop}><View style={s.profileAvatar}><Text style={s.profileAvatarText}>L</Text><View style={s.profileHalo} /></View><Text style={s.profileName}>Lena Morris</Text><Text style={s.profileEmail}>lena@bookez.studio</Text><View style={s.pathfinder}><Text style={s.pathfinderText}>✦ PATHFINDER</Text></View></View>
    <Text style={s.preferenceTitle}>Your space</Text>
    <View style={s.preferences}><View style={s.prefRow}><View><Text style={s.prefTitle}>Writing reminders</Text><Text style={s.prefSub}>A gentle nudge each evening</Text></View><Switch value={reminders} onValueChange={setReminders} trackColor={{ false: '#D7D9E6', true: '#BAB6F1' }} thumbColor={reminders ? C.periwinkle : '#FFF'} /></View><View style={s.prefLine} /><View style={s.prefRow}><View><Text style={s.prefTitle}>Cloud backup</Text><Text style={s.prefSub}>Keep every chapter safe</Text></View><Switch value={cloud} onValueChange={setCloud} trackColor={{ false: '#D7D9E6', true: '#B7DAB9' }} thumbColor={cloud ? '#75AF80' : '#FFF'} /></View></View>
    <Text style={s.preferenceTitle}>Preferences</Text>{['Appearance', 'Writing goals', 'Export your work'].map((item) => <Pressable key={item} style={s.settingsRow}><Text style={s.settingsText}>{item}</Text><Text style={s.chevron}>›</Text></Pressable>)}
  </>;
}

function Stats() {
  const [range, setRange] = useState('Week');
  const bars = [44, 62, 38, 78, 55, 92, 67];
  return <><View style={s.statsHero}><Text style={s.planHeroOverline}>THE MIDNIGHT ATLAS</Text><Text style={s.statsTitle}>A little look{`\n`}at your rhythm.</Text><View style={s.rangeRow}>{['Week', 'Month', 'All time'].map((item) => <Pill key={item} label={item} selected={range === item} onPress={() => setRange(item)} />)}</View></View>
    <View style={s.statsNumbers}><View><Text style={s.bigNumber}>{range === 'Week' ? '3,842' : range === 'Month' ? '11,260' : '48,915'}</Text><Text style={s.bigNumberLabel}>WORDS WRITTEN</Text></View><View style={s.statHighlight}><Text style={s.statHighlightTop}>+18%</Text><Text style={s.statHighlightBottom}>from last week</Text></View></View>
    <View style={s.chartCard}><View style={s.chartHeader}><Text style={s.chartTitle}>Words this week</Text><Text style={s.chartTotal}>3.8K</Text></View><View style={s.chart}>{bars.map((height, index) => <View key={index} style={s.barCol}><View style={[s.bar, { height }, index === 5 && s.barActive]} /><Text style={s.barLabel}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text></View>)}</View></View>
    <Text style={s.preferenceTitle}>Small wins</Text><View style={s.winGrid}><View style={[s.winCard, { backgroundColor: '#F3F0FF' }]}><Text style={s.winIcon}>⌁</Text><Text style={s.winValue}>7 days</Text><Text style={s.winLabel}>LONGEST STREAK</Text></View><View style={[s.winCard, { backgroundColor: '#FFF1E6' }]}><Text style={s.winIcon}>✦</Text><Text style={s.winValue}>12</Text><Text style={s.winLabel}>CHAPTERS MADE</Text></View></View>
  </>;
}

function Navigation({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  return <View style={s.navShell}>{(Object.keys(pageMeta) as Page[]).map((item) => <Pressable key={item} onPress={() => onPage(item)} style={s.navItem}><Text style={[s.navIcon, page === item && s.navIconActive]}>{pageMeta[item].icon}</Text><Text style={[s.navLabel, page === item && s.navLabelActive]}>{pageMeta[item].short}</Text></Pressable>)}</View>;
}

export default function App() {
  const [page, setPage] = useState<Page>('Library');
  const [projects, setProjects] = useState<Project[]>([
    { title: 'The Midnight Atlas', detail: 'Chapter 12 · 68%', color: C.periwinkle, mark: '✦', type: 'Fiction Book', pageGoal: '240', unitGoal: '24' },
    { title: 'Letters to June', detail: 'Chapter 4 · 31%', color: C.coral, mark: '✉', type: 'Memoir & Biography', pageGoal: '260', unitGoal: '18' },
    { title: 'Wildflower Notes', detail: 'Research · 12%', color: C.sage, mark: '✳', type: 'Journal or Diary', pageGoal: '120', unitGoal: '30' },
  ]);
  const [activeProject, setActiveProject] = useState('The Midnight Atlas');
  const updateProject = (title: string, changes: Partial<Project>) => setProjects((current) => current.map((project) => project.title === title ? { ...project, ...changes } : project));
  const renderPage = () => {
    if (page === 'Library') return <Library projects={projects} activeProject={activeProject} onPage={setPage} onSelectProject={setActiveProject} onProjectsChange={setProjects} />;
    if (page === 'Plan') return <Plan projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onUpdateProject={updateProject} />;
    if (page === 'Write') return <Write />;
    if (page === 'Journey') return <Journey onPage={setPage} />;
    if (page === 'Profile') return <Profile />;
    return <Stats />;
  };
  return <><StatusBar style="dark" /><Ambient><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>{renderPage()}</ScrollView><Navigation page={page} onPage={setPage} /></SafeAreaView></Ambient></>;
}

const s = StyleSheet.create({
  planSwitcherLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.9, fontWeight: '700', marginTop: 15, marginBottom: 1 }, planProjectPill: { height: 54, paddingHorizontal: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' }, planProjectCopy: { flex: 1, minWidth: 112, marginLeft: 7 }, planProjectType: { color: C.muted, fontSize: 8, marginLeft: 7, marginTop: 2 },
  page: { flex: 1, backgroundColor: C.paper, overflow: 'hidden' }, safe: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 112 },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.46 }, orbOne: { width: 270, height: 270, backgroundColor: C.lavender, top: -110, right: -100 }, orbTwo: { width: 230, height: 230, backgroundColor: C.sky, top: 310, left: -155 }, orbThree: { width: 190, height: 190, backgroundColor: C.peach, bottom: 20, right: -110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }, overline: { color: C.muted, fontSize: 9, letterSpacing: 1.15, fontWeight: '700' }, pageTitle: { color: C.ink, fontSize: 31, letterSpacing: -0.8, fontWeight: '700', marginTop: 4 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 }, tinyButton: { width: 39, height: 39, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, tinyButtonText: { color: C.periwinkle, fontSize: 18 }, avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F3', shadowColor: '#666187', shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, avatarText: { color: C.coral, fontWeight: '700', fontSize: 16 }, avatarDot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', right: 0, bottom: 2, borderWidth: 2, borderColor: '#FFF8F3', backgroundColor: C.sage },
  intro: { fontSize: 15, lineHeight: 21, color: C.muted, marginBottom: 21, maxWidth: 310 }, focusCard: { height: 206, borderRadius: 28, padding: 21, overflow: 'hidden', shadowColor: '#5D598A', shadowOpacity: 0.21, shadowRadius: 19, shadowOffset: { width: 0, height: 10 }, elevation: 7 }, focusEyebrow: { color: '#F7F9FF', fontSize: 9, letterSpacing: 1.05, fontWeight: '700' }, focusTitle: { color: '#FFF', fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: 10 }, focusCopy: { color: '#F5F4FF', fontSize: 12, marginTop: 5 }, lightAction: { position: 'absolute', left: 21, bottom: 17, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.22)' }, lightActionText: { fontSize: 11, color: '#FFF', fontWeight: '700' }, lightArrow: { color: '#FFF', fontSize: 16 }, focusShape: { position: 'absolute', right: -15, bottom: -58, fontSize: 195, color: '#FFF1DF', opacity: 0.55, transform: [{ rotate: '-12deg' }] },
  sectionBar: { marginTop: 28, marginBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: C.ink }, link: { color: C.periwinkle, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }, newProjectButton: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#EEEDFF' }, newProjectText: { color: C.periwinkle, fontSize: 9, fontWeight: '700', letterSpacing: 0.65 }, projectRow: { minHeight: 74, marginBottom: 9, padding: 12, borderRadius: 19, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.68)' }, projectRowActive: { backgroundColor: '#FFF', shadowColor: '#68638D', shadowOpacity: 0.11, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, projectMark: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, projectMarkText: { color: '#FFF', fontSize: 18 }, projectCopy: { flex: 1, marginLeft: 12 }, projectTitle: { color: C.ink, fontWeight: '700', fontSize: 14 }, projectDetail: { color: C.muted, marginTop: 4, fontSize: 10, letterSpacing: 0.25 }, continueTag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: '#EEEDFF' }, continueTagText: { fontSize: 8, letterSpacing: 0.6, color: C.periwinkle, fontWeight: '700' }, chevron: { color: C.periwinkle, fontSize: 25 }, addProjectRow: { marginTop: 4, borderRadius: 19, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C8C8E8', minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.32)' }, addProjectPlus: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center' }, addProjectPlusText: { color: C.periwinkle, fontSize: 24, fontWeight: '400' }, addProjectTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginLeft: 12 }, addProjectSub: { color: C.muted, fontSize: 10, marginLeft: 12, marginTop: 4 },
  modalShade: { flex: 1, backgroundColor: 'rgba(29, 33, 69, 0.35)', justifyContent: 'flex-end' }, composerSheet: { height: '88%', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, backgroundColor: '#FAFAFF', borderTopLeftRadius: 32, borderTopRightRadius: 32 }, sheetHandle: { width: 38, height: 4, borderRadius: 4, backgroundColor: '#D9D9E7', alignSelf: 'center' }, composerHeader: { marginTop: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, composerOverline: { color: C.periwinkle, letterSpacing: 1, fontSize: 9, fontWeight: '700' }, composerTitle: { color: C.ink, fontSize: 23, letterSpacing: -0.5, fontWeight: '700', marginTop: 5 }, closeButton: { height: 34, width: 34, borderRadius: 17, backgroundColor: '#F0F0F9', alignItems: 'center', justifyContent: 'center' }, closeButtonText: { color: C.muted, fontSize: 23, lineHeight: 24 }, projectInput: { marginTop: 17, minHeight: 50, paddingHorizontal: 15, backgroundColor: '#FFF', borderRadius: 15, color: C.ink, fontSize: 14, borderWidth: 1, borderColor: '#E5E5F0' }, typePrompt: { color: C.muted, fontSize: 9, letterSpacing: 0.9, fontWeight: '700', marginTop: 20, marginBottom: 10 }, typeScroller: { flex: 1 }, typeGrid: { paddingBottom: 14, gap: 8 }, typeCard: { padding: 10, minHeight: 63, borderRadius: 17, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EBEBF2', backgroundColor: '#FFF' }, typeCardSelected: { borderColor: C.periwinkle, backgroundColor: '#F4F2FF' }, typeIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, typeIconText: { color: '#FFF', fontSize: 16 }, typeCopy: { flex: 1, marginLeft: 10 }, typeName: { color: C.ink, fontSize: 12, fontWeight: '700' }, typeExample: { color: C.muted, fontSize: 9, marginTop: 3 }, typeCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#D2D4E2', alignItems: 'center', justifyContent: 'center' }, typeCheckSelected: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, typeCheckText: { color: '#FFF', fontSize: 11, fontWeight: '700' }, createProjectButton: { marginTop: 11, backgroundColor: C.periwinkle, height: 53, borderRadius: 17, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#7470C9', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }, createProjectButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' }, createProjectArrow: { color: '#FFF', fontSize: 21 },
  planHero: { marginHorizontal: -20, marginTop: -18, padding: 31, paddingTop: 51, paddingBottom: 29, overflow: 'hidden', backgroundColor: '#EDE8FF', borderBottomLeftRadius: 37, borderBottomRightRadius: 37 }, planHeroOverline: { color: C.muted, fontSize: 9, letterSpacing: 1.05, fontWeight: '700' }, planHeroTitle: { color: C.ink, fontWeight: '700', fontSize: 29, lineHeight: 33, letterSpacing: -0.7, marginTop: 8 }, planHeroCopy: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 10, maxWidth: 260 }, planHeroOrb: { position: 'absolute', right: 18, bottom: -57, color: C.periwinkle, opacity: 0.34, fontSize: 204 }, planTypeRow: { gap: 8, paddingTop: 18, paddingBottom: 3, paddingRight: 20 }, planTypePill: { height: 44, paddingHorizontal: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' }, planTypePillActive: { backgroundColor: '#FFF', borderColor: C.periwinkle, shadowColor: '#7772AF', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, planTypeDot: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, planTypeDotText: { color: '#FFF', fontSize: 12 }, planTypeText: { color: C.muted, fontSize: 10, fontWeight: '700', marginLeft: 7 }, planTypeTextActive: { color: C.ink }, planSelectedCard: { marginTop: 15, padding: 14, borderRadius: 20, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', shadowColor: '#706C98', shadowOpacity: 0.11, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, planSelectedIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, planSelectedIconText: { color: '#FFF', fontSize: 18 }, planSelectedOverline: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, planSelectedTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 3 }, planSelectedSub: { color: C.muted, fontSize: 10, marginTop: 3 }, planSelectedArrow: { color: C.gold, fontSize: 18 }, planSteps: { marginTop: 20, padding: 5, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.7)', flexDirection: 'row', gap: 4 }, planStep: { flex: 1, minHeight: 54, paddingHorizontal: 5, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, planStepActive: { backgroundColor: '#FFF' }, planStepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E7E7F2', alignItems: 'center', justifyContent: 'center', marginRight: 6 }, planStepNumberActive: { backgroundColor: C.periwinkle }, planStepNumberText: { color: C.muted, fontSize: 10, fontWeight: '700' }, planStepNumberTextActive: { color: '#FFF' }, planStepLabel: { color: C.muted, fontSize: 10, fontWeight: '700' }, planStepLabelActive: { color: C.ink }, planStepShort: { color: '#9B9FB8', fontSize: 8, marginTop: 2 }, planStepCard: { marginTop: 16, padding: 17, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.82)', shadowColor: '#706C98', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, planSectionKicker: { color: C.periwinkle, fontSize: 8, letterSpacing: 1, fontWeight: '700' }, planSectionTitle: { color: C.ink, fontSize: 23, lineHeight: 28, letterSpacing: -0.5, fontWeight: '700', marginTop: 6 }, planSectionCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 7 }, metricRow: { flexDirection: 'row', gap: 10, marginTop: 17 }, metricCard: { flex: 1, padding: 13, borderRadius: 17, backgroundColor: '#F5F2FF', borderWidth: 1, borderColor: '#ECE9FF' }, metricLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700' }, metricInput: { color: C.ink, fontSize: 26, fontWeight: '700', paddingVertical: 5, paddingHorizontal: 0 }, metricHint: { color: C.muted, fontSize: 9, lineHeight: 13 }, planTip: { marginTop: 14, padding: 12, borderRadius: 15, backgroundColor: '#FFF6DB', flexDirection: 'row', alignItems: 'flex-start' }, planTipIcon: { color: '#C9901B', fontSize: 14, marginRight: 8 }, planTipText: { flex: 1, color: '#8C6B29', fontSize: 10, lineHeight: 15 }, structureList: { marginTop: 16, gap: 8 }, structureRow: { padding: 11, borderRadius: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E7E7F0', backgroundColor: '#FFF' }, structureRowActive: { borderColor: '#D8D1FA', backgroundColor: '#F7F5FF' }, structureCheck: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: '#CBCDDD', alignItems: 'center', justifyContent: 'center' }, structureCheckOn: { backgroundColor: C.periwinkle, borderColor: C.periwinkle }, structureCheckText: { color: '#FFF', fontSize: 13, fontWeight: '700' }, structureCopy: { flex: 1, marginLeft: 10, marginRight: 5 }, structureLabel: { color: C.ink, fontSize: 12, fontWeight: '700' }, structureHelper: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, optionalTag: { color: C.muted, fontSize: 7, letterSpacing: 0.5, fontWeight: '700' }, structureFooter: { color: C.muted, fontSize: 10, marginTop: 13, textAlign: 'right' }, planInputCard: { marginTop: 16, padding: 13, borderRadius: 17, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#ECE9FF' }, planInputLabel: { color: C.periwinkle, fontSize: 8, letterSpacing: 0.9, fontWeight: '700' }, planInputHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, planTextArea: { minHeight: 79, padding: 0, paddingTop: 10, color: C.ink, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' }, planTextAreaSmall: { minHeight: 62, padding: 0, paddingTop: 9, color: C.ink, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' }, plotGuide: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: '#EEF8FF', borderWidth: 1, borderColor: '#DFF1FB' }, plotGuideTitle: { color: '#4B7B9D', fontSize: 11, fontWeight: '700' }, plotGuideText: { color: '#5D7890', fontSize: 10, lineHeight: 15, marginTop: 5 }, planSubheading: { color: C.ink, fontSize: 15, fontWeight: '700', marginTop: 21 }, plotPrompt: { marginTop: 12, padding: 13, borderRadius: 17, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E7F0' }, plotPromptTitle: { color: C.ink, fontSize: 12, fontWeight: '700' }, plotPromptHelper: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, chapterHeader: { marginTop: 21, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, chapterHeaderHint: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 4 }, chapterCountBadge: { minWidth: 35, height: 30, borderRadius: 11, backgroundColor: '#FFF2C7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, chapterCountText: { color: '#A97819', fontSize: 12, fontWeight: '700' }, chapterRow: { marginTop: 9, padding: 9, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E7E7F0', flexDirection: 'row', alignItems: 'flex-start' }, chapterIndex: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center', marginRight: 9, marginTop: 2 }, chapterIndexText: { color: C.periwinkle, fontSize: 9, fontWeight: '700' }, chapterTextInput: { flex: 1, minHeight: 47, padding: 0, color: C.ink, fontSize: 11, lineHeight: 16, textAlignVertical: 'top' }, emptyChapter: { marginTop: 12, padding: 15, borderRadius: 17, backgroundColor: '#F5F2FF', flexDirection: 'row', alignItems: 'center' }, emptyChapterIcon: { color: C.periwinkle, fontSize: 20, marginRight: 9 }, emptyChapterText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 15 }, chapterLimitNote: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 9 }, planFooter: { marginTop: 16, marginBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, planFooterText: { color: C.muted, fontSize: 8, letterSpacing: 0.8, fontWeight: '700' }, planNavButton: { minWidth: 79, height: 39, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#D9DAE8', backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' }, planNavButtonPrimary: { borderColor: C.periwinkle, backgroundColor: C.periwinkle }, planNavButtonDisabled: { opacity: 0.4 }, planNavButtonText: { color: C.muted, fontSize: 10, fontWeight: '700' }, planNavButtonTextPrimary: { color: '#FFF' },
  structureFooterRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, structureFooterCompact: { color: C.muted, fontSize: 10 }, structurePager: { flexDirection: 'row', alignItems: 'center', gap: 7 }, structurePagerButton: { width: 27, height: 27, borderRadius: 10, backgroundColor: '#EEEDFF', alignItems: 'center', justifyContent: 'center' }, structurePagerButtonDisabled: { opacity: 0.35 }, structurePagerButtonText: { color: C.periwinkle, fontSize: 19, lineHeight: 21 }, structurePagerCount: { color: C.muted, fontSize: 9, fontWeight: '700', minWidth: 27, textAlign: 'center' },
  writeTop: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, writeTitle: { color: C.ink, fontSize: 29, lineHeight: 34, letterSpacing: -0.7, fontWeight: '700', marginTop: 6 }, saveChip: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#D5D7E5', borderRadius: 12 }, saveChipDone: { backgroundColor: '#EFFAEF', borderColor: '#D5EFD7' }, saveChipText: { color: C.muted, fontSize: 9, letterSpacing: 0.5, fontWeight: '700' }, saveChipTextDone: { color: '#5B9C67' }, manuscript: { marginTop: 27, backgroundColor: '#FFFDF9', borderRadius: 25, padding: 22, minHeight: 305, shadowColor: '#807A96', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, manuscriptKicker: { color: C.coral, fontSize: 9, letterSpacing: 1.3, fontWeight: '700', marginBottom: 19 }, manuscriptText: { color: '#353B5B', fontSize: 16, lineHeight: 25, letterSpacing: 0.05, marginBottom: 17 }, cursorLine: { height: 25 }, cursor: { height: 21, width: 2, backgroundColor: C.periwinkle }, writePrompt: { marginTop: 17, padding: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1EEFF', borderRadius: 19 }, promptIcon: { height: 38, width: 38, borderRadius: 19, backgroundColor: '#DCD5FB', alignItems: 'center', justifyContent: 'center' }, promptIconText: { color: C.periwinkle }, promptTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginLeft: 11 }, promptText: { color: C.muted, fontSize: 10, marginLeft: 11, marginTop: 4 }, addWords: { padding: 7, backgroundColor: '#FFF', borderRadius: 10 }, addWordsText: { color: C.periwinkle, fontSize: 10, fontWeight: '700' }, writerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 17, paddingHorizontal: 4 }, writerFooterText: { color: C.muted, fontSize: 10 }, wordDots: { flexDirection: 'row', gap: 4 }, wordDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D9DBE7' }, wordDotFilled: { backgroundColor: C.coral },
  journeyHero: { paddingTop: 13, alignItems: 'center' }, journeyTitle: { color: C.ink, textAlign: 'center', fontSize: 27, fontWeight: '700', lineHeight: 32, letterSpacing: -0.7, marginTop: 8 }, journeyRing: { height: 153, width: 153, borderRadius: 77, marginTop: 23, borderWidth: 15, borderColor: C.periwinkle, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.65)', shadowColor: '#7772AF', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 }, journeyRingValue: { color: C.ink, fontSize: 32, fontWeight: '700' }, journeyRingLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.8, marginTop: 2, fontWeight: '700' }, nextCard: { marginTop: 25, borderRadius: 21, backgroundColor: '#FFF4E9', padding: 15, flexDirection: 'row', alignItems: 'center' }, nextIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' }, nextIconText: { color: '#A35B4D', fontSize: 19 }, nextOverline: { color: '#B36B61', fontSize: 8, letterSpacing: 0.75, fontWeight: '700', marginLeft: 11 }, nextTitle: { color: C.ink, fontSize: 12, lineHeight: 17, fontWeight: '700', marginLeft: 11, marginTop: 4 }, journeyRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(111,111,153,0.1)' }, journeyIcon: { width: 38, height: 38, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, journeyIconText: { color: '#FFF', fontSize: 16 }, journeyRowTitle: { color: C.ink, fontSize: 13, fontWeight: '700', marginLeft: 11 }, journeyRowDate: { color: C.muted, fontSize: 9, letterSpacing: 0.5, marginTop: 4, marginLeft: 11 }, journeyArrow: { color: C.periwinkle, fontSize: 21 },
  profileTop: { alignItems: 'center', paddingTop: 17 }, profileAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFF7F1', alignItems: 'center', justifyContent: 'center', shadowColor: '#65608A', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, profileAvatarText: { fontSize: 33, color: C.coral, fontWeight: '700' }, profileHalo: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#FFF', opacity: 0.8 }, profileName: { color: C.ink, fontSize: 23, fontWeight: '700', marginTop: 16 }, profileEmail: { color: C.muted, fontSize: 12, marginTop: 5 }, pathfinder: { paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFF3CB', borderRadius: 13, marginTop: 13 }, pathfinderText: { color: '#A97819', fontSize: 9, letterSpacing: 0.7, fontWeight: '700' }, preferenceTitle: { marginTop: 28, marginBottom: 10, color: C.ink, fontSize: 17, fontWeight: '700' }, preferences: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 20, paddingHorizontal: 15 }, prefRow: { minHeight: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, prefTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, prefSub: { color: C.muted, fontSize: 10, marginTop: 4 }, prefLine: { height: 1, backgroundColor: '#EBEBF1' }, settingsRow: { paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(111,111,153,0.1)' }, settingsText: { color: C.ink, fontSize: 13, fontWeight: '600' },
  statsHero: { paddingTop: 13 }, statsTitle: { fontSize: 29, lineHeight: 33, letterSpacing: -0.7, color: C.ink, fontWeight: '700', marginTop: 8 }, rangeRow: { flexDirection: 'row', gap: 8, marginTop: 21 }, pill: { paddingVertical: 8, paddingHorizontal: 13, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 13 }, pillSelected: { backgroundColor: C.periwinkle }, pillText: { color: C.muted, fontSize: 10, fontWeight: '700' }, pillTextSelected: { color: '#FFF' }, statsNumbers: { marginTop: 24, padding: 18, backgroundColor: '#FFF', borderRadius: 23, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#706C98', shadowOpacity: 0.1, shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, bigNumber: { color: C.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.6 }, bigNumberLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: '700', marginTop: 5 }, statHighlight: { padding: 10, backgroundColor: '#EEF9EF', borderRadius: 14 }, statHighlightTop: { color: '#62A16D', fontSize: 13, fontWeight: '700', textAlign: 'center' }, statHighlightBottom: { color: '#6F9173', fontSize: 8, marginTop: 3 }, chartCard: { marginTop: 17, backgroundColor: '#F4F2FF', borderRadius: 22, padding: 17 }, chartHeader: { flexDirection: 'row', justifyContent: 'space-between' }, chartTitle: { color: C.ink, fontSize: 13, fontWeight: '700' }, chartTotal: { color: C.periwinkle, fontWeight: '700', fontSize: 13 }, chart: { height: 125, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }, barCol: { alignItems: 'center', justifyContent: 'flex-end', width: 25, height: '100%' }, bar: { width: 15, borderRadius: 8, backgroundColor: '#CFC8F6' }, barActive: { backgroundColor: C.coral }, barLabel: { color: C.muted, fontSize: 9, marginTop: 8 }, winGrid: { flexDirection: 'row', gap: 10 }, winCard: { flex: 1, padding: 15, borderRadius: 20, minHeight: 123 }, winIcon: { fontSize: 19, color: C.periwinkle }, winValue: { color: C.ink, fontWeight: '700', fontSize: 21, marginTop: 15 }, winLabel: { color: C.muted, fontSize: 8, letterSpacing: 0.55, fontWeight: '700', marginTop: 5 },
  navShell: { position: 'absolute', left: 13, right: 13, bottom: 12, height: 67, paddingHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 24, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#5F5C8B', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 }, navItem: { width: 52, alignItems: 'center' }, navIcon: { height: 26, color: '#A3A6C1', fontSize: 18 }, navIconActive: { color: C.periwinkle }, navLabel: { color: '#A3A6C1', fontSize: 8 }, navLabelActive: { color: C.ink, fontWeight: '700' },
});
