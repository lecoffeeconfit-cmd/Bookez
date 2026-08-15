import { NativeModule, requireNativeModule } from 'expo';
import type { BookezAIWritingRequest, BookezAIWritingResult } from './BookezAIWriting.types';

declare class BookezAIWritingModule extends NativeModule<{}> {
  isAvailable(): Promise<boolean>;
  getAvailabilityReason(): Promise<string | null>;
  generate(request: BookezAIWritingRequest): Promise<BookezAIWritingResult>;
  cancel(): Promise<void>;
  getPlatformInfo(): Promise<{ provider: string; model: string }>;
}

export default requireNativeModule<BookezAIWritingModule>('BookezAIWriting');
