import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const operations = ['continue', 'improve', 'rewrite', 'expand', 'shorten', 'grammar', 'match-style', 'notes-to-prose', 'brainstorm', 'ask'];
const component = await readFile(new URL('../src/components/AIWritingTools.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/lib/ai-writing.ts', import.meta.url), 'utf8');
const swift = await readFile(new URL('../modules/bookez-ai-writing/ios/BookezAIWritingModule.swift', import.meta.url), 'utf8');
const kotlin = await readFile(new URL('../modules/bookez-ai-writing/android/src/main/java/expo/modules/bookezaiwriting/BookezAIWritingModule.kt', import.meta.url), 'utf8');
const moduleConfig = JSON.parse(await readFile(new URL('../modules/bookez-ai-writing/expo-module.config.json', import.meta.url), 'utf8'));

const toolKeys = [...component.matchAll(/\{ key: '([^']+)'/g)].map((match) => match[1]);
assert.deepEqual([...toolKeys].sort(), [...operations].sort(), 'The UI should expose each writing operation exactly once.');

for (const operation of operations) {
  const key = operation.includes('-') ? `'${operation}'` : operation;
  assert.match(component, new RegExp(`${key}: \\{ input:`), `${operation} should have an example.`);
  assert.match(component, new RegExp(`${key}: '`), `${operation} should have explanatory copy.`);
  assert.ok(swift.includes(`"${operation}":`) || (operation === 'rewrite' && swift.includes('?? "Improve the supplied writing faithfully."')), `Swift should handle ${operation}.`);
  assert.ok(kotlin.includes(`"${operation}" ->`) || (operation === 'rewrite' && kotlin.includes('else -> "Return one rewritten passage')), `Kotlin should handle ${operation}.`);
}

assert.match(service, /requireOptionalNativeModule\('BookezAIWriting'\)/, 'The client should load the native writing module safely.');
assert.match(service, /providerRoute\(preference/, 'Provider routing must be centralized.');
assert.match(service, /if \(route === 'unavailable'\) throw/, 'Phone-only mode must not silently spend cloud credits.');
assert.match(service, /if \(provider === 'device'\)/, 'A resolved phone request must call the native model.');
assert.match(component, /if \(provider === 'cloud'\) await recordUsage\(mode, providerPreference === 'auto'\)/, 'Only cloud requests should consume Bookez credits, with the automatic reserve protected.');
for (const operation of ['project-scan', 'project-edit', 'project-add']) {
  assert.ok(swift.includes(`"${operation}":`), `Apple on-device AI should handle ${operation}.`);
  assert.ok(kotlin.includes(`"${operation}" ->`), `Android on-device AI should handle ${operation}.`);
}
assert.deepEqual(moduleConfig.platforms, ['apple', 'android']);
assert.deepEqual(moduleConfig.apple.modules, ['BookezAIWritingModule']);
assert.deepEqual(moduleConfig.android.modules, ['expo.modules.bookezaiwriting.BookezAIWritingModule']);

console.log(`AI writing contract: ${operations.length}/${operations.length} tools covered on iOS and Android`);
