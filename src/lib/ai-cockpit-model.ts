/** Pure cockpit boundaries: no React, microphone, AI request, or storage work. */
export const COCKPIT_HISTORY_LIMIT = 24;
export const COCKPIT_HISTORY_CHARS = 24_000;
export const COCKPIT_MESSAGE_CHARS = 4_000;
export const COCKPIT_INPUT_CHARS = 12_000;
export const COCKPIT_OUTPUT_CHARS = 24_000;
export const COCKPIT_RECEIPT_LIMIT = 48;
const MAX_COCKPIT_UNIT_INDEX = 9_999;

export type CockpitAction = 'note' | 'continue' | 'rewrite' | 'character' | 'outline' | 'undo' | 'read' | 'stop' | 'close';
export type CockpitSpeechMode = 'commands' | 'dictation' | 'capture';
export type CockpitIntent =
  | { kind: 'command'; action: CockpitAction; text: string }
  | { kind: 'dictation' | 'capture' | 'unrecognized'; text: string }
  | { kind: 'deferred'; action: CockpitAction; text: string };

/** Commands deliberately require a wake word, including when dictating prose. */
export function routeCockpitSpeech(value: string, mode: CockpitSpeechMode): CockpitIntent {
  const text = value.trim().slice(0, COCKPIT_INPUT_CHARS);
  const wake = /^(?:(?:hey|okay|ok)\s+)?(?:luna|bookez)\b[\s,.:;!—-]*/i.exec(text);
  if (!wake) return { kind: mode === 'commands' ? 'unrecognized' : mode, text };
  const command = text.slice(wake[0].length).trim();
  const rules: Array<[RegExp, CockpitAction]> = [
    [/^(?:stop(?: listening| recording| dictation)?|pause(?: listening| recording)?)\b/i, 'stop'],
    [/^(?:close(?: (?:the )?cockpit)?|exit(?: (?:the )?cockpit)?)\b/i, 'close'],
    [/^(?:add(?: a)? note|new note|take(?: a)? note|note)\b/i, 'note'],
    [/^(?:continue(?: writing| (?:the )?(?:chapter|story))?)\b/i, 'continue'],
    [/^(?:rewrite(?: (?:the )?(?:chapter|passage|writing))?)\b/i, 'rewrite'],
    [/^(?:create(?: a)? character|new character|character)\b/i, 'character'],
    [/^(?:outline(?: (?:the )?next chapter| (?:the )?next section)?|plan(?: (?:the )?next chapter))\b/i, 'outline'],
    [/^(?:undo(?: (?:the )?(?:last )?(?:change|edit))?)\b/i, 'undo'],
    [/^(?:read(?: (?:the )?(?:chapter|writing|preview))?(?: aloud| to me)?)\b/i, 'read'],
  ];
  for (const [pattern, action] of rules) {
    const match = pattern.exec(command);
    if (!match) continue;
    const detail = command.slice(match[0].length).replace(/^[\s,.:;—-]+/, '').trim();
    if (mode === 'capture' && action !== 'note' && action !== 'stop' && action !== 'close') {
      return { kind: 'deferred', action, text: detail };
    }
    return { kind: 'command', action, text: detail };
  }
  // Unknown wake-word commands must never silently enter a chapter or note.
  return { kind: 'unrecognized', text };
}

export type CockpitMessage = { id: string; role: 'user' | 'luna' | 'status'; text: string; createdAt: number };

/** Keep small conversations even during a many-hour session; no manuscript cache. */
export function appendCockpitHistory(history: readonly CockpitMessage[], message: CockpitMessage): CockpitMessage[] {
  const bounded = [...history.filter((item) => item.id !== message.id), message]
    .slice(-COCKPIT_HISTORY_LIMIT)
    .map((item) => ({ ...item, text: item.text.slice(0, COCKPIT_MESSAGE_CHARS) }));
  let remaining = COCKPIT_HISTORY_CHARS;
  const result: CockpitMessage[] = [];
  for (let index = bounded.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const item = bounded[index];
    const text = item.text.slice(-remaining);
    result.push({ ...item, text });
    remaining -= text.length;
  }
  return result.reverse();
}

export type CockpitSpeechReceipt = { sessionId: string; utteranceId: string };

/** Final result IDs, not transcript text: intentionally repeating a note is allowed. */
export function acceptCockpitUtterance(
  receipts: readonly CockpitSpeechReceipt[],
  sessionId: string,
  utteranceId: string,
): { accepted: boolean; receipts: CockpitSpeechReceipt[] } {
  const duplicate = !sessionId || !utteranceId || receipts.some((item) => item.sessionId === sessionId && item.utteranceId === utteranceId);
  return { accepted: !duplicate, receipts: duplicate ? [...receipts] : [...receipts, { sessionId, utteranceId }].slice(-COCKPIT_RECEIPT_LIMIT) };
}

export type CockpitDraftTarget = { projectId: string; partKey: string; partTitle: string; baseText: string; baseRevision?: number };
export type CockpitPreview = {
  id: string;
  projectId: string;
  kind: 'append' | 'rewrite' | 'dictation' | 'character' | 'outline';
  partKey: string;
  partTitle: string;
  before: string;
  after: string;
  unitIndex?: number;
  baseRevision?: number;
  createdAt: number;
};
export type CockpitPlan = {
  drafts: Record<string, string>;
  people: string;
  unitIdeas: string[];
  partNotes: Record<string, string>;
  writeIndex: number;
  chapterRevisions?: Record<string, number>;
};
export type CockpitApplyResult<P> = { ok: true; plan: P; undo: CockpitPreview } | { ok: false; reason: string };

const previewId = (kind: string, now: number) => `cockpit-${kind}-${now}-${Math.random().toString(36).slice(2, 9)}`;
const proposalText = (value: string) => {
  const text = value.trim();
  if (!text) throw new Error('Luna returned no content to preview.');
  // Reject rather than silently truncate generated work or captured speech.
  if (text.length > COCKPIT_OUTPUT_CHARS) throw new Error('This result is too long. Ask for a shorter passage.');
  return text;
};
const joinParagraph = (before: string, after: string) => before ? `${before}${before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'}${after}` : after;

export function createCockpitDraftPreview(
  target: CockpitDraftTarget,
  text: string,
  kind: 'append' | 'rewrite' | 'dictation' = 'append',
  id?: string,
  now = Date.now(),
): CockpitPreview {
  if (!target.projectId || !target.partKey) throw new Error('Choose a book and writing section first.');
  const proposal = proposalText(text);
  return { id: id ?? previewId(kind, now), projectId: target.projectId, kind, partKey: target.partKey, partTitle: target.partTitle,
    before: target.baseText, after: kind === 'rewrite' ? proposal : joinParagraph(target.baseText, proposal),
    baseRevision: target.baseRevision, createdAt: now };
}

/** Existing character planning is structured plain text in plan.people. */
export function createCockpitCharacterPreview(projectId: string, before: string, profileText: string, id?: string, now = Date.now()): CockpitPreview {
  if (!projectId) throw new Error('Choose a book first.');
  const profile = proposalText(profileText);
  return { id: id ?? previewId('character', now), projectId, kind: 'character', partKey: 'people', partTitle: 'Characters', before, after: joinParagraph(before, profile), createdAt: now };
}

export function createCockpitOutlinePreview(
  projectId: string,
  target: { partKey: string; partTitle: string; unitIndex: number },
  before: string,
  text: string,
  id?: string,
  now = Date.now(),
): CockpitPreview {
  if (!projectId || !Number.isInteger(target.unitIndex) || target.unitIndex < 0 || target.unitIndex > MAX_COCKPIT_UNIT_INDEX || target.partKey !== `unit:${target.unitIndex}`) throw new Error('Choose an existing chapter to outline.');
  return { id: id ?? previewId('outline', now), projectId, kind: 'outline', partKey: target.partKey, partTitle: target.partTitle, unitIndex: target.unitIndex,
    before, after: proposalText(text), createdAt: now };
}

const currentValue = (plan: CockpitPlan, preview: CockpitPreview): string | undefined => {
  if (preview.kind === 'character') return preview.partKey === 'people' ? plan.people : undefined;
  if (preview.kind === 'outline') {
    return preview.unitIndex !== undefined && Number.isInteger(preview.unitIndex) && preview.unitIndex >= 0 && preview.unitIndex <= MAX_COCKPIT_UNIT_INDEX && preview.partKey === `unit:${preview.unitIndex}`
      ? plan.unitIdeas[preview.unitIndex] ?? '' : undefined;
  }
  return Object.prototype.hasOwnProperty.call(plan.drafts, preview.partKey) ? plan.drafts[preview.partKey] : '';
};

function writePreviewValue<P extends CockpitPlan>(plan: P, preview: CockpitPreview, value: string): P {
  if (preview.kind === 'character') return { ...plan, people: value };
  if (preview.kind === 'outline') {
    const unitIdeas = [...plan.unitIdeas];
    // Sparse plans are existing Bookez behavior; the UI validates the part exists.
    while (unitIdeas.length <= preview.unitIndex!) unitIdeas.push('');
    unitIdeas[preview.unitIndex!] = value;
    return { ...plan, unitIdeas };
  }
  return { ...plan, drafts: { ...plan.drafts, [preview.partKey]: value } };
}

/** The caller publishes this plan through existing autosave/checkpoint callbacks. */
export function applyCockpitPreview<P extends CockpitPlan>(plan: P, projectId: string, preview: CockpitPreview): CockpitApplyResult<P> {
  if (projectId !== preview.projectId) return { ok: false, reason: 'This preview belongs to a different book.' };
  if (currentValue(plan, preview) !== preview.before) return { ok: false, reason: 'Your writing or plan changed. Generate a fresh preview to keep those newer changes.' };
  if (preview.kind !== 'character' && preview.kind !== 'outline' && preview.baseRevision !== undefined && (plan.chapterRevisions?.[preview.partKey] ?? 0) !== preview.baseRevision) {
    return { ok: false, reason: 'This chapter changed during synchronization. Generate a fresh preview.' };
  }
  if (preview.after === preview.before) return { ok: false, reason: 'There is no change to apply.' };
  return { ok: true, plan: writePreviewValue(plan, preview, preview.after), undo: preview };
}

/** Undo touches only the last result's field, never a newer editor revision. */
export function undoCockpitPreview<P extends CockpitPlan>(plan: P, projectId: string, preview: CockpitPreview): CockpitApplyResult<P> {
  if (projectId !== preview.projectId) return { ok: false, reason: 'This change belongs to a different book.' };
  if (currentValue(plan, preview) !== preview.after) return { ok: false, reason: 'This content changed after Luna applied it. Undo will not overwrite newer work.' };
  return { ok: true, plan: writePreviewValue(plan, preview, preview.before), undo: preview };
}

export type CockpitCharacter = { name: string; role: string; goal: string; motivation: string; conflict: string; voice: string; arc: string };

/** Accept structured model output only; malformed responses stay unapplied. */
export function parseCockpitCharacter(value: string): CockpitCharacter {
  const source = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (source.length > COCKPIT_OUTPUT_CHARS) throw new Error('The character profile is too long.');
  let data: unknown;
  try { data = JSON.parse(source); } catch { throw new Error('Luna did not return a valid character profile. Please try again.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Luna did not return a valid character profile.');
  const result = {} as CockpitCharacter;
  for (const key of ['name', 'role', 'goal', 'motivation', 'conflict', 'voice', 'arc'] as const) {
    const item = (data as Record<string, unknown>)[key];
    if (typeof item !== 'string' || !item.trim() || item.length > 2_000) throw new Error(`The character profile is missing a valid ${key}. Please try again.`);
    result[key] = item.trim();
  }
  return result;
}

export function formatCockpitCharacter(profile: CockpitCharacter): string {
  return `## ${profile.name}\nRole: ${profile.role}\nGoal: ${profile.goal}\nMotivation: ${profile.motivation}\nConflict: ${profile.conflict}\nVoice: ${profile.voice}\nArc: ${profile.arc}`;
}
