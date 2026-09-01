import { requireOptionalNativeModule } from 'expo';
import { supabase } from './supabase';

export type AIWritingOperation =
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

export type AIWritingContextMode = 'auto' | 'page' | 'nearby' | 'book-aware';

export type AIWritingContext = {
  /** The resolved context level used for this request. Auto is resolved in the UI. */
  contextMode?: AIWritingContextMode;
  projectTitle?: string;
  projectType?: string;
  chapterTitle: string;
  chapterPlan?: string;
  nearbyText?: string;
  notes?: string;
  compass?: string;
  /** Book-level planning memory. Sent only for book-aware requests. */
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

export type AIWritingRequest = {
  operation: AIWritingOperation;
  text: string;
  instruction?: string;
  context: AIWritingContext;
};

export type AIWritingResponse = {
  /** Prose alternatives for transformations and continuations. */
  options?: string[];
  /** Short, non-destructive ideas for brainstorming. */
  ideas?: Array<{ title: string; detail: string }>;
  /** Concise writing feedback for section questions. */
  feedback?: string;
};

/**
 * Strip context that is not needed for the selected mode before a request
 * reaches either the native provider or the authenticated cloud function.
 * This keeps Page and Nearby requests deliberately small and avoids making
 * Book-aware mode a reason to send the manuscript on every request.
 */
export const prepareAIWritingContext = (context: AIWritingContext, mode: AIWritingContextMode): AIWritingContext => {
  const base = { ...context, contextMode: mode };
  if (mode === 'page') {
    return {
      contextMode: mode,
      chapterTitle: context.chapterTitle,
      projectTitle: context.projectTitle,
      projectType: context.projectType,
    };
  }
  if (mode === 'nearby') {
    return {
      contextMode: mode,
      chapterTitle: context.chapterTitle,
      chapterPlan: context.chapterPlan,
      nearbyText: context.nearbyText,
      notes: context.notes,
      compass: context.compass,
      projectTitle: context.projectTitle,
      projectType: context.projectType,
      toneSample: context.toneSample,
      currentSectionSummary: context.currentSectionSummary,
    };
  }
  return base;
};

type NativeAIWritingModule = {
  isAvailable?: () => Promise<boolean>;
  getAvailabilityReason?: () => Promise<string | null>;
  generate?: (request: AIWritingRequest) => Promise<AIWritingResponse>;
  cancel?: () => Promise<void>;
  getPlatformInfo?: () => Promise<{ provider?: string; model?: string }>;
};

// This module is intentionally optional: Expo Go and phones without an on-device
// model use the authenticated cloud fallback for writing tools.
const nativeModule = requireOptionalNativeModule('BookezAIWriting') as NativeAIWritingModule | null;

export class AIWritingCanceledError extends Error {
  constructor() {
    super('AI writing request canceled.');
    this.name = 'AIWritingCanceledError';
  }
}

const nativeIsAvailable = async () => {
  if (!nativeModule?.isAvailable) return false;
  try { return await nativeModule.isAvailable(); } catch { return false; }
};

const cloudErrorMessage = async (error: unknown) => {
  const response = (error as { context?: unknown } | null)?.context;
  if (response instanceof Response) {
    try {
      const payload = await response.clone().json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    } catch { /* Fall through to the SDK error. */ }
  }
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Bookez could not generate that right now.';
};

const cloudGenerate = async (request: AIWritingRequest): Promise<AIWritingResponse> => {
  const { data, error } = await supabase.functions.invoke<unknown>('bookez-ai-writing', { body: request });
  if (error) throw new Error(await cloudErrorMessage(error));
  if (!data || typeof data !== 'object') throw new Error('Bookez received an invalid AI response.');

  const result = data as Record<string, unknown>;
  return {
    options: Array.isArray(result.options) ? result.options.filter((value): value is string => typeof value === 'string') : [],
    ideas: Array.isArray(result.ideas)
      ? result.ideas.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const idea = value as Record<string, unknown>;
        return typeof idea.title === 'string' && typeof idea.detail === 'string'
          ? [{ title: idea.title, detail: idea.detail }]
          : [];
      })
      : [],
    feedback: typeof result.feedback === 'string' ? result.feedback : '',
  };
};

export const AIWritingService = {
  async isAvailable() {
    return nativeIsAvailable();
  },
  async getAvailabilityReason() {
    if (!nativeModule) return 'On-device AI requires a current Bookez app build.';
    try { return (await nativeModule.getAvailabilityReason?.()) ?? 'On-device AI isn’t available on this device.'; }
    catch { return 'On-device AI isn’t available on this device.'; }
  },
  async generate(request: AIWritingRequest) {
    if (await nativeIsAvailable() && nativeModule?.generate) return nativeModule.generate(request);
    return cloudGenerate(request);
  },
  async cancel() {
    try { await nativeModule?.cancel?.(); } catch { /* A cancellation should never disrupt writing. */ }
  },
  async getPlatformInfo() {
    try { return await nativeModule?.getPlatformInfo?.(); } catch { return undefined; }
  },
};
