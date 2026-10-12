export type AIInsertPlacement = 'cursor' | 'start' | 'end';
export const AI_MAX_DRAFT_PAGES = 5;
export const AI_REVISION_CHUNK_CHARS = 2_800;
export type AIPreviewTarget = { partKey: string; sourceText: string; start: number };

export const isAIPreviewCurrent = (partKey: string, text: string, target: AIPreviewTarget) =>
  partKey === target.partKey && text === target.sourceText;

/** Keep completed work on failure/stop; callers retain each result before the next call. */
export const runAIPageBatch = async ({ count, completed, shouldStop, generate, onComplete }: {
  count: number;
  completed: string[];
  shouldStop: () => boolean;
  generate: (index: number, previous: string[]) => Promise<string>;
  onComplete: (pages: string[]) => void;
}) => {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Invalid writing batch size.');
  const pages = [...completed];
  if (pages.length > count) throw new Error('This preview no longer matches the requested batch.');
  for (let index = pages.length; index < count; index += 1) {
    if (shouldStop()) break;
    const output = (await generate(index, [...pages])).trim();
    if (!output) throw new Error('Bookez returned no writing. Retry the unfinished pages.');
    pages.push(output);
    onComplete([...pages]);
  }
  return pages;
};

/** Preserve source boundary whitespace when long-page edits are stitched together. */
export const joinAIRevisions = (sources: string[], outputs: string[]) => {
  if (sources.length !== outputs.length) throw new Error('Finish every segment before applying a whole-page revision.');
  return sources.map((source, index) => `${source.match(/^\s*/)?.[0] ?? ''}${outputs[index].trim()}${source.match(/\s*$/)?.[0] ?? ''}`).join('');
};

/** Insert a generated passage without joining it to an existing sentence. */
export const insertAIProse = (source: string, generated: string, placement: AIInsertPlacement, cursor: number) => {
  const point = placement === 'start' ? 0 : placement === 'end' ? source.length : Math.max(0, Math.min(cursor, source.length));
  const before = source.slice(0, point);
  const after = source.slice(point);
  const prose = generated.trim();
  const prefix = before.trim() && !/\n\s*\n$/.test(before) ? '\n\n' : '';
  const suffix = after.trim() && !/^\n\s*\n/.test(after) ? '\n\n' : '';
  const start = before.length + prefix.length;
  return { text: `${before}${prefix}${prose}${suffix}${after}`, start, end: start + prose.length };
};
