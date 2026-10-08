export type BookProgressStageKey = 'setup' | 'planning' | 'writing' | 'revision' | 'finishing';
export type BookProgressRoute = 'Plan' | 'Write' | 'Editor' | 'BookStudio';
export type BookProgressAction = 'plan' | 'write' | 'review' | 'export' | 'complete';

export const BOOK_PROGRESS_STAGE_WEIGHTS: Record<BookProgressStageKey, number> = {
  setup: 7,
  planning: 23,
  writing: 50,
  revision: 15,
  finishing: 5,
};

export const BOOK_PROGRESS_STAGE_LABELS: Record<BookProgressStageKey, string> = {
  setup: 'Book setup',
  planning: 'Planning',
  writing: 'Writing',
  revision: 'Revision',
  finishing: 'Finishing',
};

export type BookProgressPlanBrief = {
  purpose?: string;
  conflict?: string;
  setting?: string;
  pov?: string;
  time?: string;
  mustHappen?: string[];
};

export type BookProgressPartInput = {
  id: string;
  title: string;
  kind: 'unit' | 'structure';
  required: boolean;
  unitIndex?: number;
  customTitle?: boolean;
  targetWords?: number;
  outlineNote?: string;
  partNote?: string;
  brief?: BookProgressPlanBrief;
  draft: string;
  markedComplete?: boolean;
};

export type BookProgressIssueInput = {
  id: string;
  title: string;
  sectionId?: string | null;
  status: 'open' | 'in-progress' | 'resolved' | 'dismissed';
  updatedAt?: string | number;
};

export type BookProgressActivityInput = {
  date: string;
  words: number;
  completedPartIds: string[];
};

export type BookProgressNextStep = {
  id: string;
  title: string;
  description: string;
  stage: BookProgressStageKey;
  route: BookProgressRoute;
  bookId: string;
  chapterId?: string;
  sectionId?: string;
  fieldTarget?: string;
  actionType: BookProgressAction;
  routeSection?: 'read' | 'export';
  issueId?: string;
  buttonLabel: string;
};

export type BookProgressSource = {
  bookId: string;
  title: string;
  projectType: string;
  targetWords: number;
  targetUnits: number;
  selectedStructureCount: number;
  idea: string;
  pointOfView: string;
  throughline: string;
  people: string;
  plotNotes: string[];
  parts: BookProgressPartInput[];
  issues: BookProgressIssueInput[];
  writeIndex: number;
  finalReviewAt?: number;
  exportedAt?: number;
  exportMatchesDraft?: boolean;
  exportSignature?: string;
  activity: BookProgressActivityInput[];
};

export type BookProgressPart = {
  id: string;
  title: string;
  kind: BookProgressPartInput['kind'];
  required: boolean;
  planningPercent: number;
  writingPercent: number;
  wordCount: number;
  readyToWrite: boolean;
};

export type BookProgressState = {
  bookId: string;
  title: string;
  progressPercent: number;
  stage: BookProgressStageKey;
  stageLabel: string;
  stageCompletion: number;
  stageProgress: Record<BookProgressStageKey, number>;
  setupProgress: number;
  planningProgress: number;
  writingProgress: number;
  revisionProgress: number;
  finishingProgress: number;
  wordCount: number;
  requiredPartCount: number;
  completedPartCount: number;
  draftedPartCount: number;
  writingComplete: boolean;
  reviewComplete: boolean;
  exported: boolean;
  unresolvedIssueCount: number;
  parts: BookProgressPart[];
  nextStep: BookProgressNextStep;
  lastMeaningfulCompletedItem?: { title: string; date?: string };
  lastLeftOff: string;
  draftSignature: string;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const normalize = (value: string | undefined) => (value ?? '').trim().replace(/\s+/g, ' ');
const countWords = (value: string) => normalize(value) ? normalize(value).split(' ').length : 0;
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function textProgress(value: string | undefined, targetWords: number): number {
  const words = countWords(value ?? '');
  if (words < 2) return 0;
  return Math.round(clamp(20 + ((words - 2) / Math.max(1, targetWords - 2)) * 80));
}

const hasMeaningfulText = (value: string | undefined) => countWords(value ?? '') >= 2;

function partPlanning(part: BookProgressPartInput) {
  const brief = part.brief ?? {};
  const purpose = textProgress(brief.purpose, 12);
  const conflict = textProgress(brief.conflict, 12);
  const setting = textProgress(brief.setting, 12);
  const pov = textProgress(brief.pov, 8);
  const time = textProgress(brief.time, 8);
  const beats = (brief.mustHappen ?? []).filter(hasMeaningfulText).length;
  if (part.kind === 'unit') {
    const progress = (part.customTitle ? 10 : 0)
      + textProgress(part.outlineNote, 24) * 0.45
      + purpose * 0.15
      + conflict * 0.15
      + setting * 0.05
      + pov * 0.05
      + time * 0.025
      + (beats ? 5 : 0);
    return { percent: Math.round(clamp(progress)), ready: hasMeaningfulText(part.outlineNote) || hasMeaningfulText(brief.purpose) || hasMeaningfulText(brief.conflict) };
  }
  const progress = textProgress(part.partNote, 18) * 0.45
    + purpose * 0.2
    + conflict * 0.2
    + setting * 0.05
    + pov * 0.05
    + time * 0.025
    + (beats ? 2.5 : 0);
  return { percent: Math.round(clamp(progress)), ready: hasMeaningfulText(part.partNote) || hasMeaningfulText(brief.purpose) || hasMeaningfulText(brief.conflict) };
}

export function getBookDraftSignature(parts: Array<Pick<BookProgressPartInput, 'id' | 'draft'>>): string {
  let hash = 2166136261;
  for (const part of parts) {
    const source = `${part.id}\u0000${part.draft}\u0001`;
    for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createNextStep(source: BookProgressSource, stage: BookProgressStageKey, fields: {
  id: string;
  title: string;
  description: string;
  route: BookProgressRoute;
  actionType: BookProgressAction;
  buttonLabel: string;
  sectionId?: string;
  chapterId?: string;
  fieldTarget?: string;
  routeSection?: 'read' | 'export';
  issueId?: string;
}): BookProgressNextStep {
  return { ...fields, stage, bookId: source.bookId };
}

export function NextStepEngine(source: BookProgressSource, progress: Pick<BookProgressState, 'setupProgress' | 'writingProgress' | 'revisionProgress' | 'finishingProgress' | 'parts' | 'writingComplete' | 'reviewComplete' | 'exported' | 'unresolvedIssueCount' | 'draftedPartCount'>): BookProgressNextStep {
  const requiredParts = progress.parts.filter((part) => part.required);
  const indexedPart = source.parts[Math.min(Math.max(0, source.writeIndex), Math.max(0, source.parts.length - 1))];
  const activePart = requiredParts.find((part) => part.id === indexedPart?.id) ?? requiredParts[0];
  const draftIncompleteParts = requiredParts.filter((part) => part.wordCount > 0 && part.writingPercent < 100);
  const firstReadyPart = requiredParts.find((part) => part.readyToWrite && part.writingPercent < 100);
  const partForPlanning = requiredParts.find((part) => !part.readyToWrite && part.writingPercent < 100);

  if (progress.setupProgress < 100) return createNextStep(source, 'setup', {
    id: 'setup-scope', title: 'Set the book’s shape and size', description: 'Choose a writing scope and the parts that belong in this book.', route: 'Plan', actionType: 'plan', fieldTarget: 'scope', buttonLabel: 'Open Plan',
  });

  if (!progress.writingComplete && progress.draftedPartCount > 0) {
    const resumePart = draftIncompleteParts.find((part) => part.id === activePart?.id) ?? draftIncompleteParts[0];
    if (resumePart) return createNextStep(source, 'writing', {
      id: `continue-${resumePart.id}`, title: `Continue ${resumePart.title}`, description: 'Pick up where you left off in this part of the manuscript.', route: 'Write', actionType: 'write', chapterId: resumePart.id, sectionId: resumePart.id, buttonLabel: 'Continue writing',
    });
  }

  if (!progress.writingComplete && firstReadyPart) return createNextStep(source, 'writing', {
    id: `start-${firstReadyPart.id}`, title: `Start ${firstReadyPart.title}`, description: 'This part has enough direction to begin. You can plan the rest as you go.', route: 'Write', actionType: 'write', chapterId: firstReadyPart.id, sectionId: firstReadyPart.id, buttonLabel: 'Open in Write',
  });

  if (!progress.writingComplete && !hasMeaningfulText(source.idea)) return createNextStep(source, 'planning', {
    id: 'plan-core-concept', title: 'Define the book’s central idea', description: 'Name the core conflict, promise, or question that can carry the book.', route: 'Plan', actionType: 'plan', fieldTarget: 'idea', buttonLabel: 'Shape the idea',
  });

  if (!progress.writingComplete && partForPlanning) {
    const part = source.parts.find((candidate) => candidate.id === partForPlanning.id);
    const unitIndex = part?.unitIndex;
    return createNextStep(source, 'planning', {
      id: `plan-${partForPlanning.id}`, title: `Plan ${partForPlanning.title}`, description: 'Add a short purpose, conflict, or outline note. One useful detail is enough to start writing.', route: 'Plan', actionType: 'plan', chapterId: partForPlanning.id, sectionId: partForPlanning.id, fieldTarget: unitIndex === undefined ? 'outline' : 'unitIdea', buttonLabel: 'Open this plan',
    });
  }

  if (!progress.writingComplete && !hasMeaningfulText(source.throughline) && progress.draftedPartCount === 0) return createNextStep(source, 'planning', {
    id: 'plan-throughline', title: 'Map the book’s main turning points', description: 'Add a flexible throughline or a few plot notes, then begin when a part feels ready.', route: 'Plan', actionType: 'plan', fieldTarget: 'plotThread', buttonLabel: 'Open the outline',
  });

  if (!progress.writingComplete) {
    const next = requiredParts.find((part) => part.writingPercent < 100) ?? requiredParts[0];
    return createNextStep(source, 'writing', {
      id: `write-${next?.id ?? 'first-part'}`, title: next ? `Start ${next.title}` : 'Open your manuscript', description: 'Begin with the next part that feels ready. You can return to planning at any time.', route: 'Write', actionType: 'write', ...(next ? { chapterId: next.id, sectionId: next.id } : {}), buttonLabel: 'Open in Write',
    });
  }

  if (progress.unresolvedIssueCount > 0) {
    const issue = source.issues.find((item) => item.status === 'open' || item.status === 'in-progress');
    if (issue) return createNextStep(source, 'revision', {
      id: `review-issue-${issue.id}`, title: issue.title || 'Review an Editor flag', description: 'Resolve or dismiss this flagged item, then return to the final read-through.', route: 'Editor', actionType: 'review', ...(issue.sectionId ? { sectionId: issue.sectionId } : {}), issueId: issue.id, buttonLabel: 'Review in Editor',
    });
  }

  if (!progress.reviewComplete) return createNextStep(source, 'revision', {
    id: 'final-read-through', title: 'Read through the full manuscript', description: 'Use Book Studio’s reading view for one complete pass. Mark the review complete at the end.', route: 'BookStudio', actionType: 'review', routeSection: 'read', buttonLabel: 'Open manuscript review',
  });

  if (!progress.exported) return createNextStep(source, 'finishing', {
    id: 'export-finished-book', title: 'Export your finished book', description: 'Choose a format and save or share the reviewed manuscript from Book Studio.', route: 'BookStudio', actionType: 'export', routeSection: 'export', buttonLabel: 'Open export options',
  });

  return createNextStep(source, 'finishing', {
    id: 'finished-book', title: 'Your book is finished', description: 'Your reviewed book has been exported. You can open Book Studio to create another format or share a fresh copy.', route: 'BookStudio', actionType: 'complete', routeSection: 'export', buttonLabel: 'Open Book Studio',
  });
}

export function BookProgressEngine(source: BookProgressSource): BookProgressState {
  const requiredParts = source.parts.filter((part) => part.required);
  const selectedStructure = clamp(source.selectedStructureCount > 0 || source.targetUnits > 0 ? 100 : 0);
  const setupProgress = Math.round(
    (source.title.trim() ? 30 : 0)
    + (source.projectType.trim() ? 20 : 0)
    + (source.targetWords > 0 ? 25 : 0)
    + selectedStructure * 0.25,
  );

  const parts = source.parts.map((part) => {
    const planning = partPlanning(part);
    const wordCount = countWords(part.draft);
    const targetWordsPerPart = Math.max(75, Math.ceil(part.targetWords ?? ((source.targetWords || requiredParts.length * 500) / Math.max(1, requiredParts.length))));
    const writingPercent = part.markedComplete ? 100 : Math.round(clamp((wordCount / targetWordsPerPart) * 100));
    return { id: part.id, title: part.title, kind: part.kind, required: part.required, planningPercent: planning.percent, writingPercent, wordCount, readyToWrite: planning.ready };
  });

  const ideaProgress = textProgress(source.idea, 24);
  const povProgress = /still deciding/i.test(source.pointOfView) ? 0 : textProgress(source.pointOfView, 5);
  const throughlineProgress = textProgress(source.throughline, 20);
  const peopleProgress = textProgress(source.people, 36);
  const plotNotesProgress = Math.round(mean(source.plotNotes.map((note) => textProgress(note, 16))));
  const partPlanningProgress = Math.round(mean(parts.filter((part) => part.required).map((part) => part.planningPercent)));
  const planningProgress = Math.round(
    ideaProgress * 0.25
    + povProgress * 0.1
    + peopleProgress * 0.15
    + throughlineProgress * 0.2
    + plotNotesProgress * 0.1
    + partPlanningProgress * 0.2,
  );

  const writingProgress = Math.round(mean(parts.filter((part) => part.required).map((part) => part.writingPercent)));
  const writingComplete = requiredParts.length > 0 && parts.filter((part) => part.required).every((part) => part.writingPercent >= 100);
  const completedPartCount = parts.filter((part) => part.required && part.writingPercent >= 100).length;
  const draftedPartCount = parts.filter((part) => part.required && part.wordCount > 0).length;
  const revisionIssues = source.issues.filter((issue) => issue.status !== 'dismissed');
  const resolvedIssues = revisionIssues.filter((issue) => issue.status === 'resolved').length;
  const unresolvedIssueCount = source.issues.filter((issue) => issue.status === 'open' || issue.status === 'in-progress').length;
  const reviewComplete = writingComplete && Boolean(source.finalReviewAt) && unresolvedIssueCount === 0;
  const revisionProgress = reviewComplete ? 100 : revisionIssues.length ? Math.round((resolvedIssues / revisionIssues.length) * 70) : 0;
  const draftSignature = source.exportSignature ?? getBookDraftSignature(source.parts);
  const exported = reviewComplete && Boolean(source.exportedAt) && (source.exportMatchesDraft !== false);
  const finishingProgress = exported ? 100 : 0;
  const stageProgress: Record<BookProgressStageKey, number> = { setup: setupProgress, planning: planningProgress, writing: writingProgress, revision: revisionProgress, finishing: finishingProgress };
  const progressPercent = Math.round(Object.entries(BOOK_PROGRESS_STAGE_WEIGHTS).reduce((total, [key, weight]) => total + (stageProgress[key as BookProgressStageKey] * weight) / 100, 0));
  const stage: BookProgressStageKey = setupProgress < 100 ? 'setup'
    : !writingComplete && (draftedPartCount > 0 || parts.some((part) => part.required && part.readyToWrite)) ? 'writing'
      : !writingComplete ? 'planning'
        : !reviewComplete ? 'revision'
          : 'finishing';
  const nextStep = NextStepEngine(source, { setupProgress, writingProgress, revisionProgress, finishingProgress, parts, writingComplete, reviewComplete, exported, unresolvedIssueCount, draftedPartCount });
  const indexedPart = source.parts[Math.min(Math.max(0, source.writeIndex), Math.max(0, source.parts.length - 1))];
  const activePart = requiredParts.find((part) => part.id === indexedPart?.id) ?? requiredParts[0];
  const lastLeftOff = draftedPartCount ? `Write · ${activePart?.title ?? 'your manuscript'}` : nextStep.route === 'Plan' ? `Plan · ${nextStep.title}` : `Write · ${nextStep.title}`;

  const events: Array<{ title: string; timestamp: number; date?: string }> = [];
  source.activity.forEach((entry) => {
    if (entry.words > 0 && entry.date) events.push({ title: 'Drafting progress saved', timestamp: Date.parse(`${entry.date}T12:00:00`), date: entry.date });
    entry.completedPartIds.forEach((partId) => {
      const part = source.parts.find((candidate) => candidate.id === partId);
      if (part) events.push({ title: `${part.title} draft completed`, timestamp: Date.parse(`${entry.date}T12:00:00`), date: entry.date });
    });
  });
  source.issues.filter((issue) => issue.status === 'resolved' && issue.updatedAt).forEach((issue) => {
    const timestamp = typeof issue.updatedAt === 'number' ? issue.updatedAt : Date.parse(issue.updatedAt!);
    if (Number.isFinite(timestamp)) events.push({ title: `Resolved: ${issue.title}`, timestamp });
  });
  if (source.finalReviewAt) events.push({ title: 'Final manuscript review completed', timestamp: source.finalReviewAt });
  if (source.exportedAt && exported) events.push({ title: 'Book exported', timestamp: source.exportedAt });
  const latestEvent = events.filter((event) => Number.isFinite(event.timestamp)).sort((a, b) => b.timestamp - a.timestamp)[0];
  const lastMeaningfulCompletedItem = latestEvent ? { title: latestEvent.title, ...(latestEvent.date ? { date: latestEvent.date } : {}) } : undefined;
  const wordCount = parts.reduce((total, part) => total + part.wordCount, 0);

  return {
    bookId: source.bookId,
    title: source.title,
    progressPercent,
    stage,
    stageLabel: BOOK_PROGRESS_STAGE_LABELS[stage],
    stageCompletion: stageProgress[stage],
    stageProgress,
    setupProgress,
    planningProgress,
    writingProgress,
    revisionProgress,
    finishingProgress,
    wordCount,
    requiredPartCount: requiredParts.length,
    completedPartCount,
    draftedPartCount,
    writingComplete,
    reviewComplete,
    exported,
    unresolvedIssueCount,
    parts,
    nextStep,
    lastMeaningfulCompletedItem,
    lastLeftOff,
    draftSignature,
  };
}
