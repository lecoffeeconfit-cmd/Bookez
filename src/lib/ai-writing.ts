import { requireOptionalNativeModule } from 'expo';
import { supabase } from './supabase';
import { deviceSourceLimit, providerRoute, type AIProviderPreference, type AIResolvedProvider } from './ai-provider';

export { AI_PROVIDER_STORAGE_KEY, deviceSourceLimit } from './ai-provider';
export type { AIProviderPreference, AIResolvedProvider } from './ai-provider';

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

export type AIProjectOperation = 'project-scan' | 'project-edit' | 'project-add';

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
  /** A compact book-level POV anchor also kept for Nearby requests. */
  pointOfView?: string;
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
  operation: AIWritingOperation | AIProjectOperation;
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

const withoutContextNotes = (notes: string | undefined, duplicateLabels: string[]) => {
  if (!notes) return notes;
  const labels = duplicateLabels.map((label) => `${label.toLowerCase()}:`);
  return notes.split('\n').filter((line) => !labels.some((label) => line.toLowerCase().startsWith(label))).join('\n');
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
      notes: withoutContextNotes(context.notes, ['Point of view']),
      compass: context.compass,
      projectTitle: context.projectTitle,
      projectType: context.projectType,
      pointOfView: context.pointOfView,
      toneSample: context.toneSample,
      currentSectionSummary: context.currentSectionSummary,
    };
  }
  return {
    ...base,
    notes: withoutContextNotes(context.notes, ['Core concept', 'Point of view', 'Outline · throughline', 'Characters', 'Character goals & motivations']),
  };
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
  async resolveProvider(preference: AIProviderPreference = 'auto', request?: AIWritingRequest): Promise<AIResolvedProvider> {
    if (preference === 'cloud') return 'cloud';
    const route = providerRoute(preference, Boolean(await nativeIsAvailable() && nativeModule?.generate), Boolean(request && request.text.length > deviceSourceLimit(request.operation)));
    if (route === 'unavailable') throw new Error(await this.getAvailabilityReason());
    if (route === 'too-long') throw new Error(`This passage is too long for phone AI. Select a shorter passage (up to ${deviceSourceLimit(request?.operation ?? 'rewrite')} characters) or choose Bookez credits.`);
    return route;
  },
  async generate(request: AIWritingRequest, preference: AIProviderPreference = 'auto') {
    const provider = await this.resolveProvider(preference, request);
    if (provider === 'device') {
      if (!nativeModule?.generate) throw new Error('On-device AI requires a current Bookez app build.');
      return nativeModule.generate(request);
    }
    return cloudGenerate(request);
  },
  async cancel() {
    try { await nativeModule?.cancel?.(); } catch { /* A cancellation should never disrupt writing. */ }
  },
  async getPlatformInfo() {
    try { return await nativeModule?.getPlatformInfo?.(); } catch { return undefined; }
  },
};
