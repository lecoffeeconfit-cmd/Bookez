import assert from 'node:assert/strict';
import { insertAIProse } from '../src/lib/ai-drafting.ts';

assert.deepEqual(insertAIProse('', 'A new page.', 'cursor', 0), { text: 'A new page.', start: 0, end: 11 });
assert.equal(insertAIProse('Old page.', 'New page.', 'start', 4).text, 'New page.\n\nOld page.');
assert.equal(insertAIProse('Old page.', 'New page.', 'end', 4).text, 'Old page.\n\nNew page.');
assert.equal(insertAIProse('BeforeAfter', 'Middle', 'cursor', 6).text, 'Before\n\nMiddle\n\nAfter');
assert.equal(insertAIProse('Before\n\nAfter', 'Middle', 'cursor', 8).text, 'Before\n\nMiddle\n\nAfter');
console.log('AI drafting insertion: cursor, beginning, end, and paragraph spacing verified.');
