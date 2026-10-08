import type { AIWritingContext } from './ai-writing';

export type AIProjectPart = { key: string; title: string; text: string; plan?: string };
export type AIProjectMemory = { fingerprint: string; summaries: Array<{ key: string; title: string; summary: string }>; createdAt: number };
export type AIProjectChange = { key: string; title: string; before: string; after: string };

export const AI_PROJECT_SCAN_CHARS = 8_000;
export const AI_PROJECT_EDIT_CHARS = 4_200;
export const AI_PROJECT_DEVICE_SCAN_CHARS = 1_500;
export const AI_PROJECT_DEVICE_EDIT_CHARS = 1_100;

/** Stable, small identity for rejecting stale previews; never used as a security hash. */
export const projectFingerprint = (parts: AIProjectPart[]) => {
  let hash = 2166136261;
  for (const part of parts) {
    const value = `${part.key}\u0000${part.title}\u0000${part.plan ?? ''}\u0000${part.text}\u0000`;
    for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return `${parts.length}-${(hash >>> 0).toString(36)}`;
};

/** Keep every character, but prefer paragraph boundaries for per-call limits. */
export const chunkWriting = (text: string, maxChars: number): string[] => {
  if (!text) return [];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(text.length, offset + maxChars);
    if (end < text.length) {
      const breakAt = text.lastIndexOf('\n\n', end - 2);
      const sentenceAt = text.lastIndexOf('. ', end - 2);
      const spaceAt = text.lastIndexOf(' ', end - 1);
      if (breakAt > offset + Math.floor(maxChars / 2)) end = breakAt + 2;
      else if (sentenceAt > offset + Math.floor(maxChars / 2)) end = sentenceAt + 2;
      else if (spaceAt > offset + Math.floor(maxChars / 2)) end = spaceAt + 1;
    }
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
};

export const projectAddCredits = (text: string, minimumCredits: number, editChunkCredits: number) =>
  Math.max(minimumCredits, chunkWriting(text, AI_PROJECT_EDIT_CHARS).length * editChunkCredits + 2);

export const memoryText = (memory: AIProjectMemory, maxChars = 7_500) => {
  const titleChars = memory.summaries.reduce((total, item) => total + item.title.length + 3, 0);
  const perPart = Math.max(12, Math.floor((maxChars - titleChars) / Math.max(1, memory.summaries.length)));
  return memory.summaries.map((item) => {
    const chunks = item.summary.split('\n').filter(Boolean);
    const perChunk = Math.max(8, Math.floor(perPart / Math.max(1, chunks.length)) - 1);
    return `${item.title}: ${chunks.map((chunk) => chunk.slice(0, perChunk)).join(' ').slice(0, perPart)}`;
  }).join('\n').slice(0, maxChars);
};

export const projectAIContext = (base: AIWritingContext, part: AIProjectPart, memory?: AIProjectMemory, device = false): AIWritingContext => ({
  contextMode: 'book-aware',
  projectTitle: base.projectTitle,
  projectType: base.projectType,
  chapterTitle: part.title,
  chapterPlan: part.plan?.slice(0, device ? 350 : 1_200),
  bookIdea: base.bookIdea?.slice(0, device ? 150 : 600),
  plotThread: base.plotThread?.slice(0, device ? 150 : 600),
  characters: base.characters?.slice(0, device ? 200 : 800),
  chapterSummaries: memory ? memoryText(memory, device ? 600 : 2_500) : undefined,
  currentSectionSummary: memory?.summaries.find((item) => item.key === part.key)
    ? memoryText({ ...memory, summaries: memory.summaries.filter((item) => item.key === part.key) }, device ? 250 : 900)
    : undefined,
  continuity: base.continuity?.slice(0, device ? 100 : 500),
  // The source chunk is already supplied as text. Do not pay to send it again.
});
