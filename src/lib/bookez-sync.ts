import { supabase } from './supabase';
import type { BookezInsert, Database } from './database.types';
import { bookezSecureStorage } from './secure-storage';

const syncQueueKey = 'bookez.sync.queue.v2';
const syncConflictKey = 'bookez.sync.conflicts.v1';
const syncCursorKey = 'bookez.sync.cursor.v1';
const maxRetryDelayMs = 60_000;
const pageSize = 100;

export type BookezSyncState = 'saved' | 'saving' | 'offline' | 'error' | 'conflict';
export type SyncTable = 'projects' | 'chapters' | 'plan_settings' | 'writing_sessions';
export type SyncOperation = {
  id: string;
  userId: string;
  table: SyncTable;
  recordId: string;
  projectId?: string;
  payload: Record<string, unknown>;
  expectedRevision?: number;
  kind?: 'upsert' | 'delete';
  queuedAt: number;
  attempts: number;
  nextAttemptAt?: number;
  lastError?: string;
  blocked?: boolean;
};

export type BookezConflict = {
  id: string;
  userId: string;
  table: 'projects' | 'chapters';
  recordId: string;
  projectId?: string;
  localPayload: Record<string, unknown>;
  serverRevision?: number;
  createdAt: number;
  resolvedAt?: number;
};

export type SyncCursor = { updatedAt: string; id: string };
export type BookezStorageSummary = { projects: number; chapters: number; words: number; fetchedAt: string };
type SyncCursorMap = Record<string, SyncCursor | undefined>;
let flushPromise: Promise<FlushResult> | null = null;
let queueWritePromise: Promise<void> = Promise.resolve();

export type FlushResult = {
  state: BookezSyncState;
  remaining: number;
  conflicts: number;
  applied: Array<{ table: SyncTable; recordId: string; revision?: number }>;
};

export async function clearBookezLocalSyncData() {
  await bookezSecureStorage.multiRemove([syncQueueKey, syncConflictKey, syncCursorKey]);
}

const operationKey = (operation: Pick<SyncOperation, 'userId' | 'table' | 'recordId'>) => `${operation.userId}:${operation.table}:${operation.recordId}`;

export function queueBookezOperation(operation: Omit<SyncOperation, 'id' | 'queuedAt' | 'attempts'>) {
  const write = queueWritePromise.then(async () => {
    const queue = await readQueue();
    const existingIndex = queue.findIndex((candidate) => operationKey(candidate) === operationKey(operation));
    const next: SyncOperation = {
      ...operation,
      id: existingIndex >= 0 ? queue[existingIndex].id : `${operation.table}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      queuedAt: existingIndex >= 0 ? queue[existingIndex].queuedAt : Date.now(),
      attempts: existingIndex >= 0 ? queue[existingIndex].attempts : 0,
      nextAttemptAt: undefined,
      blocked: false,
    };
    if (existingIndex >= 0) queue[existingIndex] = next;
    else queue.push(next);
    await writeQueue(queue);
  });
  queueWritePromise = write.catch(() => undefined);
  return write;
}

export async function flushBookezQueue(options: { force?: boolean } = {}): Promise<FlushResult> {
  if (flushPromise) return flushPromise;
  const scheduledFlush = queueWritePromise.then(() => flushBookezQueueInternal(options));
  queueWritePromise = scheduledFlush.then(() => undefined, () => undefined);
  flushPromise = scheduledFlush.finally(() => { flushPromise = null; });
  return flushPromise;
}

async function flushBookezQueueInternal(options: { force?: boolean }): Promise<FlushResult> {
  const { data: sessionResult } = await supabase.auth.getSession();
  const queue = await readQueue();
  if (!sessionResult.session) return { state: 'offline', remaining: queue.length, conflicts: await unresolvedConflictCount(), applied: [] };

  const now = Date.now();
  const remaining: SyncOperation[] = [];
  const applied: FlushResult['applied'] = [];
  let hadRetryableError = false;
  let hadBlockedError = false;

  for (const operation of queue) {
    if (operation.userId !== sessionResult.session.user.id || (!options.force && (operation.blocked || (operation.nextAttemptAt ?? 0) > now))) {
      remaining.push(operation);
      continue;
    }

    const result = await writeOperation(operation);
    if (!result.error) {
      const revision = isRevisionRow(result.data) ? result.data.revision : undefined;
      applied.push({ table: operation.table, recordId: operation.recordId, revision });
      continue;
    }

    const message = getErrorMessage(result.error);
    if (operation.table === 'projects' || operation.table === 'chapters') {
      const serverRevision = parseConflictRevision(message);
      if (message.includes('BOOKEZ_CONFLICT')) {
        await addConflict({
          id: operation.id,
          userId: operation.userId,
          table: operation.table,
          recordId: operation.recordId,
          projectId: operation.projectId,
          localPayload: operation.payload,
          serverRevision,
          createdAt: Date.now(),
        });
        continue;
      }
    }

    if (isRetryableError(result.error)) {
      hadRetryableError = true;
      const attempts = operation.attempts + 1;
      remaining.push({ ...operation, attempts, nextAttemptAt: Date.now() + retryDelayMs(attempts), lastError: message });
    } else {
      hadBlockedError = true;
      remaining.push({ ...operation, blocked: true, lastError: message });
    }
  }

  await writeQueue(remaining);
  const conflicts = await unresolvedConflictCount();
  return {
    state: conflicts ? 'conflict' : hadBlockedError || hadRetryableError ? 'error' : 'saved',
    remaining: remaining.length,
    conflicts,
    applied,
  };
}

export async function saveBookezProject(payload: Database['bookez']['Tables']['projects']['Insert']) {
  return saveWithQueue('projects', payload, String(payload.id), undefined, Number(payload.revision ?? 0));
}

export async function saveBookezChapter(payload: Database['bookez']['Tables']['chapters']['Insert']) {
  return saveWithQueue('chapters', payload, String(payload.id), String(payload.project_id), Number(payload.revision ?? 0));
}

export async function saveBookezPlanSettings(payload: Database['bookez']['Tables']['plan_settings']['Insert']) {
  return saveWithQueue('plan_settings', payload, String(payload.project_id), String(payload.project_id));
}

export async function recordBookezWritingSession(payload: Database['bookez']['Tables']['writing_sessions']['Insert']) {
  return saveWithQueue('writing_sessions', payload, String(payload.id ?? `${payload.project_id}-${payload.started_at}`), String(payload.project_id));
}

async function saveWithQueue(table: SyncTable, payload: Record<string, unknown>, recordId: string, projectId?: string, expectedRevision?: number) {
  const userId = String(payload.user_id ?? '');
  if (!userId || !recordId || recordId === 'undefined') return { state: 'error' as BookezSyncState, error: new Error('Missing sync identity') };
  await queueBookezOperation({ userId, table, recordId, projectId, payload, expectedRevision, kind: 'upsert' });
  return { state: 'saving' as BookezSyncState };
}

export async function queueBookezDelete(args: { userId: string; table: 'projects' | 'chapters'; recordId: string; projectId?: string; expectedRevision: number; payload: Record<string, unknown> }) {
  await queueBookezOperation({ ...args, kind: 'delete' });
}

async function writeOperation(operation: SyncOperation) {
  if (operation.table === 'projects') {
    const p = operation.payload;
    return supabase.rpc('update_project_if_revision', {
      p_id: operation.recordId,
      p_user_id: operation.userId,
      p_expected_revision: operation.expectedRevision ?? 0,
      p_title: String(p.title ?? ''),
      p_writing_type: String(p.writing_type ?? 'book'),
      p_target_words: toNullableNumber(p.target_words),
      p_target_chapters: toNullableNumber(p.target_chapters),
      p_status: String(p.status ?? 'active'),
      p_current_word_count: Number(p.current_word_count ?? 0),
      p_deleted_at: operation.kind === 'delete' ? new Date().toISOString() : toNullableString(p.deleted_at),
    });
  }
  if (operation.table === 'chapters') {
    const p = operation.payload;
    return supabase.rpc('update_chapter_if_revision', {
      p_id: operation.recordId,
      p_project_id: String(p.project_id ?? operation.projectId ?? ''),
      p_user_id: operation.userId,
      p_expected_revision: operation.expectedRevision ?? 0,
      p_title: String(p.title ?? ''),
      p_position: Number(p.position ?? 0),
      p_content: String(p.content ?? ''),
      p_notes: String(p.notes ?? ''),
      p_word_count: Number(p.word_count ?? 0),
      p_target_words: toNullableNumber(p.target_words),
      p_status: String(p.status ?? 'not_started'),
      p_deleted_at: operation.kind === 'delete' ? new Date().toISOString() : toNullableString(p.deleted_at),
    });
  }
  if (operation.table === 'plan_settings') return supabase.from('plan_settings').upsert(operation.payload as BookezInsert<'plan_settings'>, { onConflict: 'project_id' });
  return supabase.from('writing_sessions').insert(operation.payload as BookezInsert<'writing_sessions'>);
}

export async function pullBookezProjectSummaries(userId: string) {
  const cursorMap = await readCursorMap();
  const cursor = cursorMap[userId];
  const rows: Database['bookez']['Tables']['projects']['Row'][] = [];
  let page = 0;
  let lastCursor = cursor;
  let hasMore = true;

  while (hasMore && page < 20) {
    let query = supabase
      .from('projects')
      .select('id,user_id,title,writing_type,target_words,target_chapters,status,current_word_count,revision,deleted_at,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (cursor) query = query.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as Database['bookez']['Tables']['projects']['Row'][];
    rows.push(...batch);
    if (batch.length) lastCursor = { updatedAt: batch[batch.length - 1].updated_at, id: batch[batch.length - 1].id };
    hasMore = batch.length === pageSize;
    page += 1;
  }

  const projectIds = rows.map((row) => row.id);
  const planSettings: Database['bookez']['Tables']['plan_settings']['Row'][] = [];
  if (projectIds.length) {
    const { data, error } = await supabase
      .from('plan_settings')
      .select('id,project_id,user_id,writing_frequency,reminder_enabled,reminder_time,pace,planned_completion_date,words_per_session,plan_json,revision,deleted_at,created_at,updated_at')
      .eq('user_id', userId)
      .in('project_id', projectIds);
    if (error) throw error;
    planSettings.push(...((data ?? []) as Database['bookez']['Tables']['plan_settings']['Row'][]));
  }
  return { projects: rows, planSettings, cursor: lastCursor, hasMore };
}

export async function commitBookezProjectCursor(userId: string, cursor?: SyncCursor) {
  if (!cursor) return;
  const cursorMap = await readCursorMap();
  cursorMap[userId] = cursor;
  await bookezSecureStorage.setItem(syncCursorKey, JSON.stringify(cursorMap));
}

export async function loadBookezProjectChapters(userId: string, projectId: string) {
  const chapters: Database['bookez']['Tables']['chapters']['Row'][] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('chapters')
      .select('id,project_id,user_id,title,position,content,notes,word_count,target_words,status,revision,deleted_at,created_at,updated_at')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .order('position', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as Database['bookez']['Tables']['chapters']['Row'][];
    chapters.push(...batch);
    if (batch.length < pageSize) break;
  }
  return chapters;
}

export async function getBookezStorageSummary(userId: string): Promise<BookezStorageSummary> {
  const [{ data: projects, error: projectsError }, { data: chapters, error: chaptersError }] = await Promise.all([
    supabase.from('projects').select('id,current_word_count').eq('user_id', userId).is('deleted_at', null),
    supabase.from('chapters').select('id,word_count').eq('user_id', userId).is('deleted_at', null),
  ]);
  if (projectsError) throw projectsError;
  if (chaptersError) throw chaptersError;
  return {
    projects: projects?.length ?? 0,
    chapters: chapters?.length ?? 0,
    words: (chapters ?? []).reduce((total, chapter) => total + Number(chapter.word_count ?? 0), 0),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getBookezSyncSnapshot() {
  return {
    queued: (await readQueue()).length,
    conflicts: await readConflicts(),
  };
}

export async function resolveBookezConflict(conflictId: string) {
  const conflicts = await readConflicts();
  await bookezSecureStorage.setItem(syncConflictKey, JSON.stringify(conflicts.map((conflict) => conflict.id === conflictId ? { ...conflict, resolvedAt: Date.now() } : conflict)));
}

export async function keepBookezLocalConflict(conflictId: string) {
  const conflict = (await readConflicts()).find((candidate) => candidate.id === conflictId);
  if (!conflict) return;
  await queueBookezOperation({
    userId: conflict.userId,
    table: conflict.table,
    recordId: conflict.recordId,
    projectId: conflict.projectId,
    payload: conflict.localPayload,
    expectedRevision: conflict.serverRevision ?? 0,
    kind: 'upsert',
  });
  await resolveBookezConflict(conflictId);
}

async function readQueue(): Promise<SyncOperation[]> {
  const raw = await bookezSecureStorage.getItem(syncQueueKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SyncOperation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: SyncOperation[]) {
  await bookezSecureStorage.setItem(syncQueueKey, JSON.stringify(queue));
}

async function readConflicts(): Promise<BookezConflict[]> {
  const raw = await bookezSecureStorage.getItem(syncConflictKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BookezConflict[];
    return Array.isArray(parsed) ? parsed.filter((conflict) => !conflict.resolvedAt) : [];
  } catch {
    return [];
  }
}

async function addConflict(conflict: BookezConflict) {
  const conflicts = await readConflicts();
  const next = conflicts.filter((candidate) => operationKey(candidate) !== operationKey(conflict));
  next.push(conflict);
  await bookezSecureStorage.setItem(syncConflictKey, JSON.stringify(next));
}

async function unresolvedConflictCount() {
  return (await readConflicts()).length;
}

async function readCursorMap(): Promise<SyncCursorMap> {
  const raw = await bookezSecureStorage.getItem(syncCursorKey);
  if (!raw) return {};
  try { return JSON.parse(raw) as SyncCursorMap; } catch { return {}; }
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error);
const parseConflictRevision = (message: string) => { const match = message.match(/BOOKEZ_CONFLICT:(\d+)/); return match ? Number(match[1]) : undefined; };
const isRevisionRow = (value: unknown): value is { revision: number } => Boolean(value && typeof value === 'object' && 'revision' in value && typeof value.revision === 'number');
const toNullableNumber = (value: unknown) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; };
const toNullableString = (value: unknown) => typeof value === 'string' && value ? value : null;
const isRetryableError = (error: unknown) => { const value = error as { status?: number; message?: string } | null; const status = value?.status; const message = String(value?.message ?? error).toLowerCase(); return !status || status === 408 || status === 429 || status >= 500 || message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('offline'); };

export const retryDelayMs = (attempts: number) => Math.min(maxRetryDelayMs, 1_000 * 2 ** Math.min(attempts, 6));
