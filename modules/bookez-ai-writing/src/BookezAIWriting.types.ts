export type BookezAIWritingOperation =
  | 'continue'
  | 'improve'
  | 'rewrite'
  | 'expand'
  | 'shorten'
  | 'grammar'
  | 'match-style'
  | 'notes-to-prose'
  | 'brainstorm'
  | 'ask';

export type BookezAIWritingContextMode = 'auto' | 'page' | 'nearby' | 'book-aware';

export type BookezAIWritingResult = {
  options: string[];
  ideas: Array<{ title: string; detail: string }>;
  feedback: string;
};

export type BookezAIWritingRequest = {
  operation: BookezAIWritingOperation;
  text: string;
  instruction?: string;
  context: {
    contextMode?: BookezAIWritingContextMode;
    projectTitle?: string;
    projectType?: string;
    chapterTitle: string;
    chapterPlan?: string;
    nearbyText?: string;
    notes?: string;
    compass?: string;
    bookIdea?: string;
    plotThread?: string;
    characters?: string;
    chapterSummaries?: string;
    earlierWriting?: string;
    continuity?: string;
    references?: string;
    toneSample?: string;
    currentSectionSummary?: string;
  };
};
