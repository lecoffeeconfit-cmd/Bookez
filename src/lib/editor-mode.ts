export type EditorIssueType = 'revisit' | 'rewrite' | 'unclear' | 'continuity' | 'research' | 'fact-check' | 'expand' | 'shorten' | 'repetition' | 'transition' | 'grammar' | 'style' | 'pacing' | 'structure' | 'custom';
export type EditorIssueSeverity = 'low' | 'medium' | 'high';
export type EditorIssueStatus = 'open' | 'in-progress' | 'resolved' | 'dismissed';
export type EditorIssueSource = 'user' | 'local-check' | 'ai';
export type EditorPass = 'all' | 'structure' | 'continuity' | 'writing' | 'mine';
export type EditorSection = { id: string; title: string; text: string; planned?: boolean };
export type EditorIssue = {
  id: string;
  projectId: string;
  sectionId: string | null;
  startOffset?: number;
  endOffset?: number;
  anchorText?: string;
  contextBefore?: string;
  contextAfter?: string;
  type: EditorIssueType;
  severity: EditorIssueSeverity;
  source: EditorIssueSource;
  title: string;
  note: string;
  status: EditorIssueStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  localKey?: string;
  confidence?: number;
  explanation?: string;
  suggestedFix?: string;
  relatedIssueIds?: string[];
  relatedSectionIds?: string[];
};

export const editorIssueTypes: { id: EditorIssueType; label: string }[] = [
  { id: 'revisit', label: 'Revisit' }, { id: 'rewrite', label: 'Rewrite later' },
  { id: 'unclear', label: 'Doesn’t make sense' }, { id: 'continuity', label: 'Check continuity' },
  { id: 'research', label: 'Needs research' }, { id: 'fact-check', label: 'Verify fact' },
  { id: 'expand', label: 'Expand' }, { id: 'shorten', label: 'Shorten' },
  { id: 'repetition', label: 'Repetition' }, { id: 'transition', label: 'Transition' },
  { id: 'grammar', label: 'Grammar' }, { id: 'style', label: 'Style' },
  { id: 'pacing', label: 'Pacing' }, { id: 'structure', label: 'Structure' },
  { id: 'custom', label: 'Custom note' },
];
export const editorTypeLabel = (type: EditorIssueType) => editorIssueTypes.find((item) => item.id === type)?.label ?? 'Note';
export const editorPassTypes: Record<Exclude<EditorPass, 'all' | 'mine'>, EditorIssueType[]> = {
  structure: ['structure', 'transition', 'pacing'],
  continuity: ['continuity', 'fact-check', 'research'],
  writing: ['unclear', 'rewrite', 'expand', 'shorten', 'repetition', 'grammar', 'style', 'revisit', 'custom'],
};

export const editorIssuesForProject = (issues: EditorIssue[] | undefined, projectId: string) =>
  (Array.isArray(issues) ? issues : []).filter((issue) => issue && issue.projectId === projectId);

export function mergeSyncedEditorIssues(local: EditorIssue[] | undefined, remote: EditorIssue[] | undefined, deletedIds: string[] = []): EditorIssue[] {
  const deleted = new Set(deletedIds);
  const merged = new Map<string, EditorIssue>();
  for (const issue of [...(Array.isArray(remote) ? remote : []), ...(Array.isArray(local) ? local : [])]) {
    if (!issue?.id || deleted.has(issue.id)) continue;
    const previous = merged.get(issue.id);
    if (!previous || issue.updatedAt >= previous.updatedAt) merged.set(issue.id, issue);
  }
  return [...merged.values()];
}

export const removeEditorIssue = (issues: EditorIssue[], id: string): EditorIssue[] => issues.filter((issue) => issue.id !== id);

export type EditorIssueInput = {
  sectionId: string | null;
  startOffset?: number;
  endOffset?: number;
  type: EditorIssueType;
  severity?: EditorIssueSeverity;
  title?: string;
  note?: string;
  source?: EditorIssueSource;
  localKey?: string;
};

export function createEditorIssue(projectId: string, sections: EditorSection[], input: EditorIssueInput, id: string, now = new Date()): EditorIssue {
  const section = sections.find((item) => item.id === input.sectionId);
  const validRange = section && Number.isInteger(input.startOffset) && Number.isInteger(input.endOffset)
    && input.startOffset! >= 0 && input.endOffset! > input.startOffset! && input.endOffset! <= section.text.length;
  const start = validRange ? input.startOffset! : undefined;
  const end = validRange ? input.endOffset! : undefined;
  const anchorText = start !== undefined && end !== undefined ? section!.text.slice(start, end).slice(0, 1000) : undefined;
  const timestamp = now.toISOString();
  return {
    id, projectId, sectionId: input.sectionId,
    ...(anchorText ? { startOffset: start, endOffset: end, anchorText,
      contextBefore: section!.text.slice(Math.max(0, start! - 45), start),
      contextAfter: section!.text.slice(end!, end! + 45) } : {}),
    type: input.type, severity: input.severity ?? 'medium', source: input.source ?? 'user',
    title: input.title?.trim().slice(0, 100) || editorTypeLabel(input.type),
    note: input.note?.trim().slice(0, 2000) ?? '', status: 'open', createdAt: timestamp, updatedAt: timestamp,
    ...(input.localKey ? { localKey: input.localKey } : {}),
  };
}

export function editEditorIssue(issue: EditorIssue, changes: Partial<Pick<EditorIssue, 'type' | 'severity' | 'title' | 'note' | 'status'>>, now = new Date()): EditorIssue {
  const status = changes.status ?? issue.status;
  return { ...issue, ...changes, title: changes.title?.trim().slice(0, 100) ?? issue.title,
    note: changes.note?.trim().slice(0, 2000) ?? issue.note, updatedAt: now.toISOString(),
    resolvedAt: status === 'resolved' ? issue.resolvedAt ?? now.toISOString() : undefined };
}

export type EditorLocation = { state: 'exact' | 'relocated' | 'changed' | 'unavailable' | 'section' | 'project'; start?: number; end?: number };
export function locateEditorIssue(issue: EditorIssue, sections: EditorSection[]): EditorLocation {
  if (issue.sectionId === null) return { state: 'project' };
  const section = sections.find((item) => item.id === issue.sectionId);
  if (!section) return { state: 'unavailable' };
  if (!issue.anchorText) return { state: 'section' };
  const text = section.text;
  const anchor = issue.anchorText;
  const start = issue.startOffset ?? -1;
  if (start >= 0 && text.slice(start, start + anchor.length) === anchor) {
    const before = issue.contextBefore ?? '';
    const after = issue.contextAfter ?? '';
    const contextMatches = (!before || text.slice(Math.max(0, start - before.length), start) === before)
      && (!after || text.slice(start + anchor.length, start + anchor.length + after.length) === after);
    if (contextMatches || anchor.length >= 12 && text.indexOf(anchor, start + anchor.length) < 0 && text.indexOf(anchor) === start) return { state: 'exact', start, end: start + anchor.length };
  }
  const matches: number[] = [];
  let cursor = 0;
  while (cursor < text.length && matches.length < 50) {
    const found = text.indexOf(anchor, cursor);
    if (found < 0) break;
    matches.push(found);
    cursor = found + Math.max(1, anchor.length);
  }
  if (matches.length === 1) {
    const position = matches[0];
    const before = issue.contextBefore ?? '';
    const after = issue.contextAfter ?? '';
    const contextual = before && text.slice(Math.max(0, position - before.length), position) === before
      || after && text.slice(position + anchor.length, position + anchor.length + after.length) === after;
    if (anchor.length >= 12 || contextual) return { state: 'relocated', start: position, end: position + anchor.length };
    return { state: 'changed' };
  }
  if (matches.length > 1) {
    const scored = matches.map((position) => {
      const before = issue.contextBefore ?? '';
      const after = issue.contextAfter ?? '';
      let score = 0;
      if (before && text.slice(Math.max(0, position - before.length), position) === before) score += 2;
      if (after && text.slice(position + anchor.length, position + anchor.length + after.length) === after) score += 2;
      if (start >= 0 && Math.abs(position - start) < 60) score += 1;
      return { position, score };
    }).sort((a, b) => b.score - a.score);
    if (scored[0].score >= 2 && scored[0].score > scored[1].score) return { state: 'relocated', start: scored[0].position, end: scored[0].position + anchor.length };
  }
  return { state: 'changed' };
}

export type EditorFilter = { pass?: EditorPass; query?: string; type?: EditorIssueType | 'all'; sectionId?: string | 'all'; severity?: EditorIssueSeverity | 'all'; source?: EditorIssueSource | 'all'; status?: EditorIssueStatus | 'all' | 'active'; sort?: 'manuscript' | 'newest' | 'oldest' | 'severity' };
export function filterEditorIssues(issues: EditorIssue[], sections: EditorSection[], filter: EditorFilter = {}): EditorIssue[] {
  const query = filter.query?.trim().toLocaleLowerCase() ?? '';
  const order = new Map(sections.map((section, index) => [section.id, index]));
  const severityRank = { high: 0, medium: 1, low: 2 };
  return issues.filter((issue) => {
    if (filter.pass === 'mine' && issue.source !== 'user') return false;
    if (filter.pass && filter.pass !== 'all' && filter.pass !== 'mine' && !editorPassTypes[filter.pass].includes(issue.type)) return false;
    if (filter.type && filter.type !== 'all' && issue.type !== filter.type) return false;
    if (filter.sectionId === '__project__' && issue.sectionId !== null) return false;
    if (filter.sectionId && filter.sectionId !== 'all' && filter.sectionId !== '__project__' && issue.sectionId !== filter.sectionId) return false;
    if (filter.severity && filter.severity !== 'all' && issue.severity !== filter.severity) return false;
    if (filter.source && filter.source !== 'all' && issue.source !== filter.source) return false;
    if (filter.status === 'active' || !filter.status) { if (issue.status === 'resolved' || issue.status === 'dismissed') return false; }
    else if (filter.status !== 'all' && issue.status !== filter.status) return false;
    if (query && ![issue.title, issue.note, issue.anchorText, editorTypeLabel(issue.type), sections.find((section) => section.id === issue.sectionId)?.title].some((value) => value?.toLocaleLowerCase().includes(query))) return false;
    return true;
  }).sort((a, b) => {
    if (filter.sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
    if (filter.sort === 'oldest') return a.createdAt.localeCompare(b.createdAt);
    if (filter.sort === 'severity') return severityRank[a.severity] - severityRank[b.severity] || a.createdAt.localeCompare(b.createdAt);
    const ai = a.sectionId === null ? -1 : order.get(a.sectionId) ?? sections.length;
    const bi = b.sectionId === null ? -1 : order.get(b.sectionId) ?? sections.length;
    return ai - bi || (a.startOffset ?? -1) - (b.startOffset ?? -1) || a.createdAt.localeCompare(b.createdAt);
  });
}

export type EditorCheckOptions = { markers?: string[]; longSentenceWords?: number; longParagraphWords?: number; nearbyCharacters?: number; includeEmptySections?: boolean };
export type EditorCheckFinding = EditorIssueInput & { title: string; localKey: string };
const wordCount = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;
const localKey = (sectionId: string, type: string, title: string, anchor: string) => `${sectionId}|${type}|${title}|${anchor.toLocaleLowerCase().replace(/\s+/g, ' ').slice(0, 90)}`;

export function scanEditorSections(sections: EditorSection[], options: EditorCheckOptions = {}, repetitionHints?: (text: string) => { label: string; kind: string }[]): EditorCheckFinding[] {
  const findings: EditorCheckFinding[] = [];
  const markers = (options.markers ?? ['TODO', 'TK', 'FIXME', '[research]', '[check]']).map((item) => item.trim()).filter(Boolean).slice(0, 20);
  const sentenceThreshold = Math.max(20, options.longSentenceWords ?? 45);
  const paragraphThreshold = Math.max(70, options.longParagraphWords ?? 180);
  const nearby = Math.max(100, options.nearbyCharacters ?? 1500);
  const add = (section: EditorSection, type: EditorIssueType, title: string, start?: number, end?: number, note = '') => {
    const anchor = start !== undefined && end !== undefined ? section.text.slice(start, end) : '';
    findings.push({ sectionId: section.id, type, title, note, severity: 'low', source: 'local-check', startOffset: start, endOffset: end, localKey: localKey(section.id, type, title, anchor) });
  };
  for (const section of sections) {
    const text = section.text;
    if (!text.trim()) { if (options.includeEmptySections === true && section.planned) add(section, 'structure', 'Section has little or no draft content'); continue; }
    if (wordCount(text) < 20 && options.includeEmptySections === true && section.planned) add(section, 'structure', 'Section has little or no draft content');
    for (const marker of markers) {
      const markerLower = marker.toLocaleLowerCase();
      const lower = text.toLocaleLowerCase();
      let position = 0;
      while ((position = lower.indexOf(markerLower, position)) >= 0) {
        const before = text[position - 1] ?? ' ';
        const after = text[position + marker.length] ?? ' ';
        if (!/[\w]/.test(before) && !/[\w]/.test(after)) add(section, 'research', `Writer marker: ${marker}`, position, position + marker.length);
        position += marker.length;
      }
    }
    const sentences = [...text.matchAll(/[^.!?\n]+[.!?]+(?=\s|$)/g)];
    const previousSentences = new Map<string, { start: number; text: string }>();
    for (const match of sentences) {
      const raw = match[0]; const clean = raw.trim(); const start = match.index! + raw.indexOf(clean);
      const words = wordCount(clean);
      if (words > sentenceThreshold) add(section, 'style', 'Long sentence', start, start + clean.length, `${words} words · a rhythm check, not an error`);
      if (words >= 12) {
        const key = clean.toLocaleLowerCase().replace(/\s+/g, ' ');
        const previous = previousSentences.get(key);
        if (previous && start - previous.start <= nearby) add(section, 'repetition', 'Repeated sentence nearby', start, start + clean.length);
        previousSentences.set(key, { start, text: clean });
      }
    }
    for (const match of text.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)) {
      const raw = match[0]; const words = wordCount(raw);
      if (words > paragraphThreshold) add(section, 'style', 'Long paragraph', match.index!, match.index! + Math.min(raw.length, 1000), `${words} words · consider the reading rhythm`);
    }
    const hints = repetitionHints?.(text).filter((hint) => hint.kind === 'phrase') ?? [];
    for (const hint of hints) {
      // The existing scan finds two-word candidates. Require a shared third word and nearby uses here.
      const lower = text.toLocaleLowerCase();
      const first = lower.indexOf(hint.label.toLocaleLowerCase());
      const second = first < 0 ? -1 : lower.indexOf(hint.label.toLocaleLowerCase(), first + hint.label.length);
      if (second < 0 || second - first > nearby) continue;
      const tailA = /^\s+([a-z][a-z'-]{3,})\b/i.exec(text.slice(first + hint.label.length));
      const tailB = /^\s+([a-z][a-z'-]{3,})\b/i.exec(text.slice(second + hint.label.length));
      if (tailA && tailB && tailA[1].toLocaleLowerCase() === tailB[1].toLocaleLowerCase()) {
        add(section, 'repetition', 'Repeated phrase nearby', second, second + hint.label.length + tailB[0].length);
      }
    }
    for (const match of text.matchAll(/ {3,}|\t{2,}|[ \t]+(?=\n)/g)) add(section, 'style', 'Formatting to check', match.index!, match.index! + match[0].length);
  }
  return findings.slice(0, 500);
}

export function mergeEditorFindings(existing: EditorIssue[], projectId: string, sections: EditorSection[], findings: EditorCheckFinding[], makeId: () => string, now = new Date()): EditorIssue[] {
  const keys = new Set(existing.filter((issue) => issue.projectId === projectId && issue.localKey).map((issue) => issue.localKey));
  const additions: EditorIssue[] = [];
  for (const finding of findings) {
    if (keys.has(finding.localKey)) continue;
    keys.add(finding.localKey);
    additions.push(createEditorIssue(projectId, sections, finding, makeId(), now));
  }
  return [...existing, ...additions];
}
