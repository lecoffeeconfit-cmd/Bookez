import { requireOptionalNativeModule } from 'expo';

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

export type AIWritingContext = {
  chapterTitle: string;
  chapterPlan?: string;
  nearbyText?: string;
  notes?: string;
  compass?: string;
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

type NativeAIWritingModule = {
  isAvailable?: () => Promise<boolean>;
  getAvailabilityReason?: () => Promise<string | null>;
  generate?: (request: AIWritingRequest) => Promise<AIWritingResponse>;
  cancel?: () => Promise<void>;
  getPlatformInfo?: () => Promise<{ provider?: string; model?: string }>;
};

// This module is intentionally optional: Expo Go and phones without an on-device
// model continue to have a fully functional editor and dictation experience.
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
    throw new Error(await this.getAvailabilityReason());
  },
  async cancel() {
    try { await nativeModule?.cancel?.(); } catch { /* A cancellation should never disrupt writing. */ }
  },
  async getPlatformInfo() {
    try { return await nativeModule?.getPlatformInfo?.(); } catch { return undefined; }
  },
};
