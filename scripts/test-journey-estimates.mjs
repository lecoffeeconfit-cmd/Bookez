import assert from 'node:assert/strict';
import { combineJourneyEstimates, estimateJourneyDraft, journeyTimeRange } from '../src/lib/journey-estimates.ts';

const estimate = (changes = {}) => estimateJourneyDraft({ remainingWords: 1000, activity: [], sessionMinutes: 25, sessionWords: 0, ...changes });
const baseline = estimate();
assert.equal(baseline.label, '40–65 min');
assert.equal(baseline.minMinutes, 40);
assert.equal(baseline.maxMinutes, 65);
assert.match(baseline.detail, /starting pace/);
assert.ok(estimate({ remainingWords: 250 }).maxMinutes < baseline.maxMinutes, 'Time drops as the remaining draft gets shorter.');
assert.ok(estimate({ remainingWords: 10000 }).minMinutes > baseline.maxMinutes, 'A long chapter must not get the same fixed estimate as a short one.');

const recent = estimate({ activity: [{ words: 1500, minutes: 30 }, { words: 0, minutes: 1000 }, { words: 4000, minutes: 0 }] });
assert.equal(recent.minMinutes, 15);
assert.match(recent.detail, /recent writing pace/);
assert.equal(estimate({ activity: [{ words: 100, minutes: 2 }] }).label, baseline.label, 'A tiny sample does not replace the starting pace.');
const planned = estimate({ sessionWords: 1000, sessionMinutes: 20 });
assert.equal(planned.label, recent.label);
assert.match(planned.detail, /planned session pace/);
const newest = estimate({ activity: [{ words: 100, minutes: 1000 }, ...Array.from({ length: 14 }, () => ({ words: 1500, minutes: 30 }))] });
assert.equal(newest.label, recent.label, 'Only the latest fourteen timed writing days determine the pace.');

assert.equal(journeyTimeRange(5, 10, '').label, '5–10 min');
assert.equal(journeyTimeRange(10, 10, '').label, '10 min');
assert.equal(journeyTimeRange(60, 120, '').label, '1–2 hr');
const sum = combineJourneyEstimates([journeyTimeRange(5, 10, ''), journeyTimeRange(10, 15, '')]);
assert.equal(sum.label, '15–25 min');
assert.equal(sum.minMinutes, 15);
assert.equal(sum.maxMinutes, 25);
assert.equal(combineJourneyEstimates([]).minMinutes, 0, 'An empty checkpoint does not invent more work.');
assert.equal(estimate({ remainingWords: -100 }).minMinutes, 0, 'Over-target parts have no writing time remaining.');
console.log('Journey estimates passed: remaining words, chapter length, measured and planned pace, sample size, recent activity, and checkpoint totals.');
