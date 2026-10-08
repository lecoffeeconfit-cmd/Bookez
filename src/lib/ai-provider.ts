export type AIProviderPreference = 'auto' | 'device' | 'cloud';
export type AIResolvedProvider = 'device' | 'cloud';
export const AI_PROVIDER_STORAGE_KEY = 'bookez.ai-provider.v1';

export const deviceSourceLimit = (operation: string) =>
  operation === 'project-scan' ? 1_600 : operation === 'project-edit' ? 1_200 : operation === 'project-add' ? 700 : 2_500;

/** Never silently charge cloud credits when the writer selected phone-only. */
export const providerRoute = (
  preference: AIProviderPreference,
  deviceAvailable: boolean,
  sourceTooLong: boolean,
): AIResolvedProvider | 'unavailable' | 'too-long' => {
  if (preference === 'cloud') return 'cloud';
  if (!deviceAvailable) return preference === 'device' ? 'unavailable' : 'cloud';
  if (sourceTooLong) return preference === 'device' ? 'too-long' : 'cloud';
  return 'device';
};
