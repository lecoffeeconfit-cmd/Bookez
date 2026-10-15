import type { CockpitSnapshot } from '../components/AIWriteCockpitEntry';
import type { AIWritingContext, AIWritingRequest } from './ai-writing';
import type { CockpitPreview } from './ai-cockpit-model';

export type CockpitRecoveryAction = 'note' | 'continue' | 'rewrite' | 'character' | 'outline';
export type CockpitRecoveryPending = {
  action: Exclude<CockpitRecoveryAction, 'note'>;
  snapshot: CockpitSnapshot;
  request: AIWritingRequest;
  provider: 'device' | 'cloud';
};
export type CockpitRecovery = {
  ownerId: string | null;
  projectId: string;
  input: string;
  action: CockpitRecoveryAction;
  preview: CockpitPreview | null;
  pending: CockpitRecoveryPending | null;
  undo?: CockpitPreview | null;
};
export type CockpitRecoveryScope = { projectId: string; ownerId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PART_KEY = /^(?:unit:(?:0|[1-9][0-9]{0,3})|structure:[a-z0-9]+(?:-[a-z0-9]+)*|freewrite:0)$/;
const ACTIONS = new Set(['note', 'continue', 'rewrite', 'character', 'outline']);
const PREVIEW_KINDS = new Set(['append', 'rewrite', 'dictation', 'character', 'outline']);
const MAX_PARTS = 1_024;
const MAX_IDEAS_CHARS = 512_000;

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const text = (value: unknown, max: number, nonempty = false): value is string => typeof value === 'string' && value.length <= max && (!nonempty || value.trim().length > 0);
const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max;
const knownKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every((key) => allowed.includes(key));
const optional = (value: unknown, check: (item: unknown) => boolean) => value === undefined || check(value);
const partKey = (value: unknown): value is string => text(value, 120, true) && PART_KEY.test(value);
const owner = (value: unknown): value is string | null => value === null || (typeof value === 'string' && UUID.test(value));

const CONTEXT_LIMITS = {
  projectTitle: 200, projectType: 120, chapterTitle: 200, chapterPlan: 2_000,
  nearbyText: 4_000, notes: 2_000, compass: 2_000, bookIdea: 2_000,
  pointOfView: 500, plotThread: 2_000, characters: 4_000,
  chapterSummaries: 8_000, earlierWriting: 10_000, continuity: 3_000,
  references: 3_000, toneSample: 1_500, currentSectionSummary: 2_000,
} as const;

function validContext(value: unknown): value is AIWritingContext {
  if (!record(value) || !knownKeys(value, ['contextMode', ...Object.keys(CONTEXT_LIMITS)])) return false;
  if (!text(value.chapterTitle, CONTEXT_LIMITS.chapterTitle, true)) return false;
  if (!optional(value.contextMode, (mode) => mode === 'auto' || mode === 'page' || mode === 'nearby' || mode === 'book-aware')) return false;
  return Object.entries(CONTEXT_LIMITS).every(([key, max]) => optional(value[key], (item) => text(item, max)));
}

function validSnapshot(value: unknown, scope: CockpitRecoveryScope): value is CockpitSnapshot {
  if (!record(value) || !knownKeys(value, ['ownerId', 'projectId', 'projectTitle', 'partKey', 'partTitle', 'text', 'revision', 'people', 'unitIdeas', 'nextUnit', 'parts', 'context'])) return false;
  if (value.ownerId !== scope.ownerId || value.projectId !== scope.projectId) return false;
  if (!text(value.projectTitle, 200, true) || !partKey(value.partKey) || !text(value.partTitle, 200, true) || !text(value.text, 200_000) || !text(value.people, 40_000)) return false;
  if (!optional(value.revision, integer)) return false;
  if (!Array.isArray(value.unitIdeas) || value.unitIdeas.length > MAX_PARTS || !value.unitIdeas.every((idea) => text(idea, 40_000))) return false;
  if (value.unitIdeas.reduce((size, idea) => size + idea.length, 0) > MAX_IDEAS_CHARS) return false;
  if (!Array.isArray(value.parts) || value.parts.length === 0 || value.parts.length > MAX_PARTS) return false;
  const keys = new Set<string>();
  for (const item of value.parts) {
    if (!record(item) || !knownKeys(item, ['key', 'title']) || !partKey(item.key) || !text(item.title, 200, true) || keys.has(item.key)) return false;
    keys.add(item.key);
  }
  const currentIndex = value.parts.findIndex((item) => item.key === value.partKey && item.title === value.partTitle);
  if (currentIndex < 0) return false;
  const next = value.parts.slice(currentIndex + 1).find((item) => item.key.startsWith('unit:'));
  if (value.nextUnit !== undefined) {
    const unit = value.nextUnit;
    if (!record(unit) || !knownKeys(unit, ['key', 'title', 'index']) || !integer(unit.index, 9_999) || unit.key !== `unit:${unit.index}` || !text(unit.title, 200, true)) return false;
    if (!next || next.key !== unit.key || next.title !== unit.title) return false;
  } else if (next) return false;
  if (!validContext(value.context) || value.context.projectTitle !== value.projectTitle || value.context.chapterTitle !== value.partTitle) return false;
  // These three context snippets are derived directly by the Write bridge.
  if (value.context.nearbyText !== value.text.slice(-1_800) || value.context.toneSample !== value.text.slice(-900) || value.context.characters !== value.people.slice(0, 2_000)) return false;
  return true;
}

function appendedText(before: string, after: string): string | null {
  if (after === before) return '';
  const separator = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const prefix = `${before}${separator}`;
  if (!after.startsWith(prefix)) return null;
  const addition = after.slice(prefix.length);
  return addition.length <= 24_000 ? addition : null;
}

function validPreview(value: unknown, scope: CockpitRecoveryScope): value is CockpitPreview {
  if (!record(value) || !knownKeys(value, ['id', 'projectId', 'kind', 'partKey', 'partTitle', 'before', 'after', 'unitIndex', 'baseRevision', 'createdAt'])) return false;
  if (!text(value.id, 128, true) || !/^[a-z0-9:_-]+$/i.test(value.id) || value.projectId !== scope.projectId || !PREVIEW_KINDS.has(String(value.kind))) return false;
  if (!text(value.partTitle, 200, true) || !text(value.before, value.kind === 'character' || value.kind === 'outline' ? 40_000 : 200_000) || !text(value.after, 224_000) || !integer(value.createdAt)) return false;
  if (!optional(value.baseRevision, integer)) return false;
  if (value.kind === 'character') {
    if (value.partKey !== 'people' || value.partTitle !== 'Characters' || value.unitIndex !== undefined || value.baseRevision !== undefined) return false;
    // Writers can be midway through editing the originally structured profile.
    // Preserve that draft, while never permitting it to erase existing people.
    return value.after.startsWith(value.before) && value.after.length - value.before.length <= 24_002;
  }
  if (!partKey(value.partKey)) return false;
  if (value.kind === 'outline') return integer(value.unitIndex, 9_999) && value.partKey === `unit:${value.unitIndex}` && value.baseRevision === undefined && value.after.length <= 24_000;
  if (value.unitIndex !== undefined) return false;
  if (value.kind === 'rewrite') return value.before.length <= 12_000 && value.after.length <= 24_000;
  return appendedText(value.before, value.after) !== null;
}

// Match the existing service's context preparation without importing native code.
function requestContext(snapshot: CockpitSnapshot, mode: 'nearby' | 'book-aware'): Record<string, unknown> {
  const source = snapshot.context;
  const labels = mode === 'nearby' ? ['Point of view'] : ['Core concept', 'Point of view', 'Outline · throughline', 'Characters', 'Character goals & motivations'];
  const notes = source.notes?.split('\n').filter((line) => !labels.some((label) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))).join('\n');
  if (mode === 'book-aware') return { ...source, contextMode: mode, notes };
  return { contextMode: mode, chapterTitle: source.chapterTitle, chapterPlan: source.chapterPlan, nearbyText: source.nearbyText, notes,
    compass: source.compass, projectTitle: source.projectTitle, projectType: source.projectType, pointOfView: source.pointOfView, toneSample: source.toneSample, currentSectionSummary: source.currentSectionSummary };
}

function sameContext(actual: AIWritingContext, expected: Record<string, unknown>): boolean {
  const actualKeys = Object.keys(actual).filter((key) => actual[key as keyof AIWritingContext] !== undefined).sort();
  const expectedKeys = Object.keys(expected).filter((key) => expected[key] !== undefined).sort();
  return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index] && actual[key as keyof AIWritingContext] === expected[key]);
}

function validPending(value: unknown, scope: CockpitRecoveryScope): value is CockpitRecoveryPending {
  if (!record(value) || !knownKeys(value, ['action', 'snapshot', 'request', 'provider']) || !ACTIONS.has(String(value.action)) || value.action === 'note' || (value.provider !== 'device' && value.provider !== 'cloud')) return false;
  if (!validSnapshot(value.snapshot, scope)) return false;
  const request = value.request;
  if (!record(request) || !knownKeys(request, ['requestId', 'cockpitAction', 'operation', 'text', 'instruction', 'protectReserve', 'context'])) return false;
  if (typeof request.requestId !== 'string' || !UUID.test(request.requestId) || request.protectReserve !== true || !text(request.instruction, 1_000, true) || !text(request.text, 12_000) || !validContext(request.context)) return false;
  const planning = value.action === 'character' || value.action === 'outline';
  if (request.operation !== (planning ? 'ask' : value.action)) return false;
  if (request.cockpitAction !== (planning ? value.action : undefined)) return false;
  if (request.text !== (value.action === 'rewrite' ? value.snapshot.text : value.snapshot.text.slice(-2_400))) return false;
  if (value.action === 'rewrite' && (!value.snapshot.text.trim() || value.snapshot.text.length > 12_000)) return false;
  if (value.action === 'outline' && !value.snapshot.nextUnit) return false;
  if (!sameContext(request.context, requestContext(value.snapshot, planning ? 'book-aware' : 'nearby'))) return false;
  const inputChars = request.text.length + request.instruction.length + Object.values(request.context).reduce((total, item) => total + (typeof item === 'string' ? item.length : 0), 0);
  if (inputChars > 30_000) return false;
  return true;
}

/**
 * A cached operation is an instruction to spend credits or modify a manuscript.
 * Reject the entire record on corruption; never repair, truncate, or guess it.
 * The original request object/UUID is returned unchanged for an idempotent retry.
 */
export function parseCockpitRecovery(value: unknown, scope: CockpitRecoveryScope): CockpitRecovery | null {
  try {
    if (!UUID.test(scope.projectId) || !owner(scope.ownerId)) return null;
    if (!record(value) || !knownKeys(value, ['ownerId', 'projectId', 'input', 'action', 'preview', 'pending', 'undo'])) return null;
    if (value.ownerId !== scope.ownerId || value.projectId !== scope.projectId || !text(value.input, 1_000) || !ACTIONS.has(String(value.action))) return null;
    if (value.preview !== null && !validPreview(value.preview, scope)) return null;
    if (value.pending !== null && !validPending(value.pending, scope)) return null;
    if (!optional(value.undo, (item) => item === null || validPreview(item, scope))) return null;
    if (value.preview !== null && value.pending !== null) return null;
    return value as CockpitRecovery;
  } catch { return null; }
}
