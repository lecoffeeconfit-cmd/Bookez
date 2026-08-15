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
    chapterTitle: string;
    chapterPlan?: string;
    nearbyText?: string;
    notes?: string;
    compass?: string;
  };
};
