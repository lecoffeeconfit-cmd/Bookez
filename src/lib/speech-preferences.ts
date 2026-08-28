import { bookezSecureStorage } from './secure-storage';

export const bookezSpeechVoiceStorageKey = 'bookez.speech-voice';

export type BookezSpeechVoice = {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
};

function isSavedVoice(value: unknown): value is BookezSpeechVoice {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BookezSpeechVoice>;
  return typeof candidate.identifier === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.language === 'string'
    && (candidate.quality === undefined || typeof candidate.quality === 'string');
}

export async function loadBookezSpeechVoice(): Promise<BookezSpeechVoice | null> {
  const stored = await bookezSecureStorage.getItem(bookezSpeechVoiceStorageKey);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isSavedVoice(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveBookezSpeechVoice(voice: BookezSpeechVoice | null): Promise<void> {
  if (!voice) {
    await bookezSecureStorage.removeItem(bookezSpeechVoiceStorageKey);
    return;
  }
  await bookezSecureStorage.setItem(bookezSpeechVoiceStorageKey, JSON.stringify(voice));
}
