import assert from 'node:assert/strict';
import {
  createEditorIssue, editEditorIssue, editorIssuesForProject, filterEditorIssues,
  locateEditorIssue, mergeEditorFindings, mergeSyncedEditorIssues, removeEditorIssue, scanEditorSections,
} from '../src/lib/editor-mode.ts';

const date = (minute) => new Date(`2026-10-05T12:${String(minute).padStart(2, '0')}:00.000Z`);
const projectId = 'book-a';
const sections = [
  { id: 'unit:0', title: 'Opening', text: 'Before the storm, Mira waited. The lantern was still lit.', planned: true },
  { id: 'unit:1', title: 'Ending', text: 'The door opened at last.', planned: true },
];
const base = createEditorIssue(projectId, sections, { sectionId: 'unit:0', startOffset: 18, endOffset: 30, type: 'revisit', note: 'Check tone', severity: 'high' }, 'issue-1', date(0));
assert.equal(base.projectId, projectId);
assert.equal(base.sectionId, 'unit:0');
assert.equal(base.anchorText, sections[0].text.slice(18, 30));
assert.equal(base.note, 'Check tone');
assert.equal(base.status, 'open');
assert.equal(locateEditorIssue(base, sections).state, 'exact');

const edited = editEditorIssue(base, { type: 'continuity', title: 'Timeline', severity: 'low', note: 'Ask when the storm begins', status: 'in-progress' }, date(1));
assert.equal(edited.type, 'continuity');
assert.equal(edited.title, 'Timeline');
assert.equal(edited.severity, 'low');
assert.equal(edited.status, 'in-progress');
const resolved = editEditorIssue(edited, { status: 'resolved' }, date(2));
assert.equal(resolved.resolvedAt, date(2).toISOString());
const reopened = editEditorIssue(resolved, { status: 'open' }, date(3));
assert.equal(reopened.resolvedAt, undefined);
const dismissed = editEditorIssue(reopened, { status: 'dismissed' }, date(4));
assert.equal(dismissed.status, 'dismissed');
assert.equal(editEditorIssue(dismissed, { status: 'open' }, date(5)).status, 'open');
assert.deepEqual(removeEditorIssue([base, { ...base, id: 'placeholder' }], base.id).map((item) => item.id), ['placeholder']);

// Saved projects can be serialized without a special storage adapter. Old plans have no field.
assert.deepEqual(JSON.parse(JSON.stringify({ editorIssues: [dismissed] })).editorIssues, [JSON.parse(JSON.stringify(dismissed))]);
assert.deepEqual(editorIssuesForProject(undefined, projectId), []);
assert.deepEqual(editorIssuesForProject([], projectId), []);
const sameTitleOtherBook = createEditorIssue('book-b', sections, { sectionId: null, type: 'structure', title: 'Same title, different ID' }, 'issue-b', date(1));
assert.deepEqual(editorIssuesForProject([base, sameTitleOtherBook], projectId).map((item) => item.id), ['issue-1']);
assert.equal(locateEditorIssue(sameTitleOtherBook, sections).state, 'project');

const endingIssue = createEditorIssue(projectId, sections, { sectionId: 'unit:1', type: 'rewrite', severity: 'medium' }, 'issue-2', date(1));
assert.equal(locateEditorIssue(endingIssue, sections).state, 'section');
const queue = [endingIssue, base, sameTitleOtherBook];
assert.deepEqual(filterEditorIssues(queue, sections).map((item) => item.id), ['issue-b', 'issue-1', 'issue-2']);
assert.deepEqual(filterEditorIssues(queue, sections, { sectionId: 'unit:1' }).map((item) => item.id), ['issue-2']);
assert.deepEqual(filterEditorIssues(queue, sections, { sectionId: '__project__' }).map((item) => item.id), ['issue-b']);
assert.deepEqual(filterEditorIssues(queue, sections, { pass: 'continuity' }).map((item) => item.id), []);
assert.deepEqual(filterEditorIssues(queue, sections, { pass: 'writing', source: 'user', severity: 'high', query: 'tone' }).map((item) => item.id), ['issue-1']);
assert.deepEqual(filterEditorIssues(queue, sections, { sort: 'newest' }).map((item) => item.id)[0], 'issue-2');
assert.deepEqual(filterEditorIssues(queue, sections, { sort: 'severity' }).map((item) => item.id)[0], 'issue-1');
assert.deepEqual(filterEditorIssues([resolved, endingIssue], sections).map((item) => item.id), ['issue-2']);
assert.deepEqual(filterEditorIssues([resolved, endingIssue], sections, { status: 'resolved' }).map((item) => item.id), ['issue-1']);

const shifted = [{ ...sections[0], text: `New opening. ${sections[0].text}` }, sections[1]];
const recovered = locateEditorIssue(base, shifted);
assert.equal(recovered.state, 'relocated');
assert.equal(recovered.start, base.startOffset + 'New opening. '.length);
const changed = [{ ...sections[0], text: 'The passage was completely rewritten.' }, sections[1]];
assert.equal(locateEditorIssue(base, changed).state, 'changed');
assert.equal(locateEditorIssue(base, [sections[1]]).state, 'unavailable');
const shortAnchor = createEditorIssue(projectId, [{ id: 'unit:0', title: 'A', text: 'TODO' }], { sectionId: 'unit:0', startOffset: 0, endOffset: 4, type: 'research' }, 'short');
assert.equal(locateEditorIssue(shortAnchor, [{ id: 'unit:0', title: 'A', text: 'An unrelated TODO remains.' }]).state, 'changed');
const ambiguousText = 'A sample phrase. New words. A sample phrase.';
const ambiguousSections = [{ id: 'unit:0', title: 'Opening', text: ambiguousText }];
const ambiguous = createEditorIssue(projectId, ambiguousSections, { sectionId: 'unit:0', startOffset: 0, endOffset: 15, type: 'revisit' }, 'ambiguous');
assert.equal(locateEditorIssue(ambiguous, [{ ...ambiguousSections[0], text: 'Changed. A sample phrase. Some other words. A sample phrase.' }]).state, 'changed');

const repeatedSentence = 'The copper lantern leaned against the old garden wall until dawn had finally arrived.';
const longSentence = `It was ${'a very long and tangled line '.repeat(20)}before the final stop.`;
const scanText = `TODO check names. The silver orchard glowed softly. ${repeatedSentence} ${repeatedSentence}\n\n${longSentence}\n\n${'paragraph words '.repeat(190)}\nThree   spaces.`;
const scanSections = [{ id: 'unit:0', title: 'Opening', text: scanText, planned: true }, { id: 'unit:1', title: 'Ending', text: '', planned: true }];
const findings = scanEditorSections(scanSections, { includeEmptySections: true });
assert(!scanEditorSections(scanSections).some((finding) => finding.title === 'Section has little or no draft content'));
const titles = findings.map((finding) => finding.title);
for (const expected of ['Writer marker: TODO', 'Repeated sentence nearby', 'Long sentence', 'Long paragraph', 'Formatting to check', 'Section has little or no draft content']) assert(titles.includes(expected), expected);
assert(findings.every((finding) => finding.source === 'local-check'));
assert(scanEditorSections([{ id: 'unit:0', title: 'A', text: 'Resolve TK later.', planned: true }], { markers: ['TK'] }).some((finding) => finding.title === 'Writer marker: TK'));
assert(!scanEditorSections([{ id: 'unit:0', title: 'A', text: 'A token is here.', planned: false }], { markers: ['TK'], includeEmptySections: false }).some((finding) => finding.title.includes('TK')));
const phraseText = 'The silver orchard glowed brightly. Later the silver orchard glowed softly.';
const phraseFindings = scanEditorSections([{ id: 'unit:0', title: 'A', text: phraseText }], {}, () => [{ kind: 'phrase', label: 'silver orchard' }]);
assert(phraseFindings.some((finding) => finding.title === 'Repeated phrase nearby'));

let counter = 0;
const merged = mergeEditorFindings([base], projectId, scanSections, findings, () => `local-${++counter}`, date(6));
assert(merged.length > 1);
assert.equal(mergeEditorFindings(merged, projectId, scanSections, findings, () => `local-${++counter}`, date(7)).length, merged.length);
const resolvedLocal = editEditorIssue(merged[1], { status: 'resolved' }, date(7));
const mergedAgain = mergeEditorFindings([base, resolvedLocal, ...merged.slice(2)], projectId, scanSections, findings, () => `local-${++counter}`, date(8));
assert.equal(mergedAgain.find((item) => item.id === resolvedLocal.id)?.status, 'resolved');
assert.equal(mergeSyncedEditorIssues([base], [edited], []).find((item) => item.id === base.id)?.status, 'in-progress');
assert.equal(mergeSyncedEditorIssues([base], [edited], [base.id]).length, 0);

console.log('Editor Mode model, lifecycle, navigation anchors, filtering, local checks and sync tests passed.');
