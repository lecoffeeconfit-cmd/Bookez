import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AI_MAX_DRAFT_PAGES, AI_REVISION_CHUNK_CHARS, insertAIProse, isAIPreviewCurrent, joinAIRevisions, runAIPageBatch } from '../src/lib/ai-drafting.ts';
import { chunkWriting } from '../src/lib/ai-project.ts';
import { appendDictationSegment } from '../src/lib/dictation.ts';

assert.deepEqual(insertAIProse('', 'A new page.', 'cursor', 0), { text: 'A new page.', start: 0, end: 11 });
assert.equal(insertAIProse('Old page.', 'New page.', 'start', 4).text, 'New page.\n\nOld page.');
assert.equal(insertAIProse('Old page.', 'New page.', 'end', 4).text, 'Old page.\n\nNew page.');
assert.equal(insertAIProse('BeforeAfter', 'Middle', 'cursor', 6).text, 'Before\n\nMiddle\n\nAfter');
assert.equal(insertAIProse('Before\n\nAfter', 'Middle', 'cursor', 8).text, 'Before\n\nMiddle\n\nAfter');

assert.equal(AI_MAX_DRAFT_PAGES, 5);
const longPage = '  Opening paragraph. '.repeat(200) + '\n\n' + 'Closing paragraph. '.repeat(150) + '\n';
const sources = chunkWriting(longPage, AI_REVISION_CHUNK_CHARS);
assert.ok(sources.length > 1 && sources.every((part) => part.length <= AI_REVISION_CHUNK_CHARS));
assert.equal(sources.join(''), longPage, 'Long revisions must include every source character.');
assert.equal(joinAIRevisions(sources, sources.map((part) => part.trim())), longPage, 'Reassembly preserves original boundary whitespace.');
assert.throws(() => joinAIRevisions(['one', 'two'], ['one']), /Finish every segment/);
const target = { partKey: 'chapter-1', sourceText: 'Original.', start: 0 };
assert.equal(isAIPreviewCurrent('chapter-1', 'Original.', target), true);
assert.equal(isAIPreviewCurrent('chapter-2', 'Original.', target), false);
assert.equal(isAIPreviewCurrent('chapter-1', 'Edited.', target), false);

let saved = [];
const calls = [];
await assert.rejects(runAIPageBatch({ count: 3, completed: [], shouldStop: () => false,
  generate: async (index, previous) => { calls.push(index); assert.equal(previous.length, index); if (index === 1) throw new Error('Connection lost'); return 'Page one.'; },
  onComplete: (pages) => { saved = pages; },
}), /Connection lost/);
assert.deepEqual(saved, ['Page one.'], 'Keep paid completed work after a later failure.');
await runAIPageBatch({ count: 3, completed: saved, shouldStop: () => false,
  generate: async (index) => { calls.push(index); return `Page ${index + 1}.`; }, onComplete: (pages) => { saved = pages; },
});
assert.deepEqual(calls, [0, 1, 1, 2], 'Resume only unfinished calls, never charge again for page one.');
let stopped = false;
const stoppedPages = await runAIPageBatch({ count: 5, completed: [], shouldStop: () => stopped,
  generate: async () => { stopped = true; return 'The in-flight request finished.'; }, onComplete: () => {},
});
assert.equal(stoppedPages.length, 1, 'Stopping keeps the current result and prevents later calls.');
assert.deepEqual(await runAIPageBatch({ count: 2, completed: [], shouldStop: () => true, generate: async () => assert.fail('No call after stopping'), onComplete: () => {} }), []);
await assert.rejects(runAIPageBatch({ count: 1, completed: [], shouldStop: () => false, generate: async () => ' ', onComplete: () => assert.fail('Never save empty output') }), /no writing/);
for (const count of [0, -1, 1.5, 101]) await assert.rejects(runAIPageBatch({ count, completed: [], shouldStop: () => false, generate: async () => '', onComplete: () => {} }), /Invalid/);

let committed = 'Write a scene.';
assert.equal(appendDictationSegment(committed, 'Two sisters'), 'Write a scene. Two sisters');
assert.equal(appendDictationSegment(committed, 'Two sisters return home.'), 'Write a scene. Two sisters return home.', 'Interim text replaces only the current utterance.');
committed = appendDictationSegment(committed, 'Two sisters return home.');
assert.equal(appendDictationSegment(committed, 'It is raining.'), 'Write a scene. Two sisters return home. It is raining.', 'Continuous speech retains earlier final utterances.');
assert.equal(appendDictationSegment('Notes:\n', 'Speak here'), 'Notes:\nSpeak here');
assert.equal(appendDictationSegment('', 'Long instruction', 4), 'Long');

const component = await readFile(new URL('../src/components/AIPageComposer.tsx', import.meta.url), 'utf8');
assert.match(component, /running\.current = true;[\s\S]*?await AIWritingService\.readCloudUsage/, 'Lock double taps before asynchronous credit checks.');
assert.match(component, /if \(!usage\) throw/, 'No cloud batch begins without an authoritative allowance check.');
assert.match(component, /prepareAIWritingContext\(context, contextMode\),[\s\S]*?\}, 'cloud'\)/, 'Full-page work always uses the metered provider.');
assert.match(component, /needed > Math\.max\(0, usage\.monthlyCredits - usage\.usedCredits\)/);
assert.match(component, /stop\.current \|\| !live\.current/, 'Closing the composer must stop later requests.');
console.log('AI pages: insertion, complete revision assembly, safe resume/stop, stale protection, dictation, and credit preflight verified.');
