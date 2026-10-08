import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AI_PROJECT_DEVICE_EDIT_CHARS, AI_PROJECT_DEVICE_SCAN_CHARS, AI_PROJECT_EDIT_CHARS, AI_PROJECT_SCAN_CHARS, chunkWriting, memoryText, projectAddCredits, projectAIContext, projectFingerprint } from '../src/lib/ai-project.ts';
import { deviceSourceLimit, providerRoute } from '../src/lib/ai-provider.ts';

assert.equal(providerRoute('auto', true, false), 'device');
assert.equal(providerRoute('auto', false, false), 'cloud');
assert.equal(providerRoute('auto', true, true), 'cloud');
assert.equal(providerRoute('device', false, false), 'unavailable');
assert.equal(providerRoute('device', true, true), 'too-long');
assert.equal(providerRoute('cloud', true, false), 'cloud');
assert.ok(AI_PROJECT_DEVICE_SCAN_CHARS <= deviceSourceLimit('project-scan'));
assert.ok(AI_PROJECT_DEVICE_EDIT_CHARS <= deviceSourceLimit('project-edit'));

const manuscript = 'One long paragraph. '.repeat(800) + '\n\n' + 'A second chapter starts here. '.repeat(400);
for (const max of [AI_PROJECT_SCAN_CHARS, AI_PROJECT_EDIT_CHARS, AI_PROJECT_DEVICE_SCAN_CHARS, AI_PROJECT_DEVICE_EDIT_CHARS]) {
  const chunks = chunkWriting(manuscript, max);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= max));
  assert.equal(chunks.join(''), manuscript, 'Chunking must never lose manuscript characters.');
}

const parts = [{ key: 'unit:0', title: 'Chapter 1', text: manuscript, plan: 'Opening' }];
assert.notEqual(projectFingerprint(parts), projectFingerprint([{ ...parts[0], text: `${manuscript}!` }]));
assert.notEqual(projectFingerprint(parts), projectFingerprint([{ ...parts[0], plan: 'Revised opening' }]));
assert.ok(projectAddCredits(manuscript, 8, 3) >= chunkWriting(manuscript, AI_PROJECT_EDIT_CHARS).length * 3);
assert.ok(projectAddCredits('', 8, 3) >= 8);

const memory = { fingerprint: projectFingerprint(parts), createdAt: Date.now(), summaries: Array.from({ length: 18 }, (_, index) => ({ key: `unit:${index}`, title: `Chapter ${index + 1}`, summary: `A distinct event in part ${index + 1}. `.repeat(80) })) };
assert.ok(memoryText(memory).length <= 7_500);
assert.ok(memoryText(memory).includes('Chapter 18:'), 'Compact memory must represent late sections too.');
const longPartMemory = { ...memory, summaries: [{ key: 'unit:0', title: 'Long chapter', summary: Array.from({ length: 20 }, (_, index) => `${index + 1}. Event ${index + 1} in this chunk. `.repeat(15)).join('\n') }] };
assert.ok(memoryText(longPartMemory).includes('Event 20'), 'Compact memory must represent late chunks in a long section.');
const context = projectAIContext({ chapterTitle: 'Chapter 1', projectTitle: 'My Book', nearbyText: manuscript }, parts[0], memory);
assert.equal(context.contextMode, 'book-aware');
assert.equal(context.chapterSummaries, memoryText(memory, 2_500));
assert.ok(context.chapterSummaries.includes('Chapter 18:'), 'The small repeated context should still include late sections.');
assert.ok((context.currentSectionSummary ?? '').length <= 900);
assert.equal(context.nearbyText, undefined, 'Project calls should not duplicate the source writing as context.');
const phoneContext = projectAIContext({ chapterTitle: 'Chapter 1', projectTitle: 'My Book', nearbyText: manuscript }, parts[0], memory, true);
assert.ok((phoneContext.chapterSummaries ?? '').length <= 600, 'Phone context must fit its smaller model window.');
assert.ok((phoneContext.currentSectionSummary ?? '').length <= 250);

const projectComponent = await readFile(new URL('../src/components/AIProjectTools.tsx', import.meta.url), 'utf8');
assert.match(projectComponent, /if \(provider === 'cloud'\) setUsedCredits\(await recordAIUsage/, 'Only cloud project requests should consume credits.');

const edge = await readFile(new URL('../supabase/functions/bookez-ai-writing/index.ts', import.meta.url), 'utf8');
for (const operation of ['project-scan', 'project-edit', 'project-add']) assert.ok(edge.includes(`'${operation}'`));
assert.match(edge, /request\.operation === 'project-edit' \|\| request\.operation === 'project-add' \? 4000/);
console.log('Project AI contract: chunk preservation, stale-scan identity, compact context, and cloud operations verified.');
