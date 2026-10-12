/** Interim speech replaces only the current utterance; final utterances become the next base. */
export const appendDictationSegment = (committed: string, transcript: string, maxLength?: number) => {
  const next = `${committed}${committed.trim() && !/\s$/.test(committed) ? ' ' : ''}${transcript.trim()}`;
  return maxLength === undefined ? next : next.slice(0, maxLength);
};
