import assert from 'node:assert/strict';
import { BookProgressEngine } from '../src/lib/book-progress.ts';

const base = {
  bookId: 'book-1',
  title: 'The Quiet Map',
  projectType: 'Fiction Book',
  targetWords: 1000,
  targetUnits: 2,
  selectedStructureCount: 1,
  idea: '',
  pointOfView: '',
  throughline: '',
  people: '',
  plotNotes: [],
  parts: [
    { id: 'unit:0', title: 'Chapter 1', kind: 'unit', required: true, unitIndex: 0, draft: '' },
    { id: 'unit:1', title: 'Chapter 2', kind: 'unit', required: true, unitIndex: 1, draft: '' },
  ],
  issues: [],
  writeIndex: 0,
  activity: [],
};

const setup = BookProgressEngine(base);
assert.equal(setup.progressPercent, 7);
assert.equal(setup.nextStep.fieldTarget, 'idea');
assert.equal(setup.nextStep.route, 'Plan');

const ready = BookProgressEngine({
  ...base,
  idea: 'A cartographer must find the lost city.',
  parts: [{ ...base.parts[0], outlineNote: 'Mara discovers a hidden map.' }, base.parts[1]],
});
assert.equal(ready.nextStep.route, 'Write');
assert.equal(ready.nextStep.chapterId, 'unit:0');

const shortDraftInput = {
  ...base,
  idea: 'A cartographer must find the lost city.',
  writeIndex: 99,
  parts: [
    { ...base.parts[0], draft: 'Mara opens the map.' },
    base.parts[1],
  ],
};
const shortDraft = BookProgressEngine(shortDraftInput);
const sameDraftDifferentPage = BookProgressEngine({ ...shortDraftInput, writeIndex: 0 });
assert.equal(shortDraft.writingComplete, false, 'changing pages must not complete the manuscript');
assert.equal(shortDraft.progressPercent, sameDraftDifferentPage.progressPercent, 'page visits must not change completion');

const fullDraft = BookProgressEngine({
  ...base,
  idea: 'A cartographer must find the lost city.',
  parts: [
    { ...base.parts[0], draft: Array(500).fill('word').join(' ') },
    { ...base.parts[1], draft: Array(500).fill('word').join(' ') },
  ],
});
assert.equal(fullDraft.writingComplete, true);
assert.equal(fullDraft.reviewComplete, false);
assert.equal(fullDraft.nextStep.id, 'final-read-through');

const flaggedDraft = BookProgressEngine({
  ...base,
  idea: 'A cartographer must find the lost city.',
  parts: fullDraft.parts.map((part) => ({ ...part, draft: Array(500).fill('word').join(' ') })),
  issues: [{ id: 'issue-1', title: 'Check the map continuity', sectionId: 'unit:0', status: 'open' }],
});
assert.equal(flaggedDraft.nextStep.route, 'Editor');
assert.equal(flaggedDraft.nextStep.issueId, 'issue-1');

const reviewed = BookProgressEngine({
  ...base,
  idea: 'A cartographer must find the lost city.',
  parts: fullDraft.parts.map((part) => ({ ...part, draft: Array(500).fill('word').join(' ') })),
  finalReviewAt: 100,
  exportedAt: 200,
  exportMatchesDraft: false,
});
assert.equal(reviewed.reviewComplete, true);
assert.equal(reviewed.exported, false, 'an export of older content must be refreshed');
assert.equal(reviewed.nextStep.actionType, 'export');

const finished = BookProgressEngine({
  ...base,
  idea: 'A cartographer must find the lost city.',
  parts: fullDraft.parts.map((part) => ({ ...part, draft: Array(500).fill('word').join(' ') })),
  finalReviewAt: 100,
  exportedAt: 200,
  exportMatchesDraft: true,
});
assert.equal(finished.exported, true);
assert.equal(finished.nextStep.actionType, 'complete');

console.log('Book progress engine tests passed.');
