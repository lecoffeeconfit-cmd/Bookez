import assert from 'node:assert/strict';
import { getLibraryDashboardSummary } from '../src/lib/library-dashboard.ts';

const book = (id, changes = {}) => ({
  id, title: id, type: 'Fiction Book', weekWords: 120, updatedAt: 10,
  progress: { progressPercent: 40, wordCount: 900, completedPartCount: 2 },
  ...changes,
});
const first = book('current', { updatedAt: 1 });
const next = book('next', { updatedAt: 25 });
const archived = book('archived', { archived: true, updatedAt: 1000 });
const finished = book('finished', { progress: { progressPercent: 100, wordCount: 2000, completedPartCount: 5 }, updatedAt: 2000 });
const result = getLibraryDashboardSummary([first, next, archived, finished], 'current');
assert.equal(result.focusBook.id, 'current', 'The selected book stays in focus even when another book was edited more recently.');
assert.equal(result.nextBook.id, 'next', 'Archived and finished books cannot become the next writing recommendation.');
assert.equal(result.totalWords, 4700, 'The review includes retained writing from archived and finished books.');
assert.equal(result.completedParts, 11);
assert.equal(result.completedBooks, 1);
assert.equal(result.activeBooks, 2);
assert.equal(result.weekWords, 480);
assert.equal(getLibraryDashboardSummary([archived, next], 'archived').focusBook.id, 'next');
assert.equal(getLibraryDashboardSummary([finished], 'finished').nextBook, undefined);
const empty = getLibraryDashboardSummary([]);
assert.equal(empty.focusBook, undefined);
assert.equal(empty.totalWords, 0);
assert.equal(empty.activeBooks, 0);
console.log('Library dashboard: selected book, next recommendation, retained totals, completion counts, and empty state passed.');
