import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import vm from 'node:vm';
import ts from 'typescript';
import { projectFingerprint } from '../src/lib/ai-project.ts';

// Host microbenchmarks of actual source, not a mobile FPS or latency claim.
const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const memorySource = source.slice(source.indexOf('const aiContextSnippet ='), source.indexOf('const writingFlagRange ='));
const bridgeStart = source.indexOf('  cockpitHandlers.current = {');
const bridgeEnd = source.indexOf('\n\n  return <>', bridgeStart);
const bridgeSource = source.slice(bridgeStart, bridgeEnd);
const compile = (code) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function measure(fn) {
  for (let index = 0; index < 3; index += 1) fn();
  const samples = Array.from({ length: 20 }, () => { const start = performance.now(); fn(); return performance.now() - start; }).sort((a, b) => a - b);
  return { medianMs: Number(samples[10].toFixed(3)), p95Ms: Number(samples[19].toFixed(3)) };
}
for (const [chapters, chars] of [[24, 20_000], [100, 60_000]]) {
  const text = 'A writer walks beneath the moon. '.repeat(Math.ceil(chars / 32)).slice(0, chars);
  const parts = Array.from({ length: chapters }, (_, index) => ({ key: `unit:${index}`, title: `Chapter ${index + 1}`, helper: 'A new discovery.', kind: 'unit', unitIndex: index }));
  const plan = { drafts: Object.fromEntries(parts.map((part) => [part.key, text])), partNotes: {}, people: 'Mara: a mapmaker.', idea: 'A lost atlas.', plotThread: 'Find the road home.', unitIdeas: parts.map(() => 'A new discovery.'), writeIndex: Math.floor(chapters / 2) };
  const currentProject = { title: 'Benchmark', type: 'Fiction Book', cloudId: 'c12675af-f611-4a63-ae5e-4565b7651458', plan };
  const context = vm.createContext({ cockpitHandlers: { current: {} }, latestPlans: { current: { Benchmark: plan } }, currentProject, parts, activePart: parts[plan.writeIndex], userId: null });
  vm.runInContext(compile(`${memorySource}\nglobalThis.memory = getAISectionMemory;\n${bridgeSource}`), context);
  const projectParts = parts.map((part) => ({ key: part.key, title: part.title, text, plan: part.helper }));
  console.log(JSON.stringify({ chapters, charsPerChapter: chars, existingSectionMemory: measure(() => context.memory(parts, plan, plan.writeIndex)), existingFingerprint: measure(() => projectFingerprint(projectParts)), cockpitTargetSnapshot: measure(() => context.cockpitHandlers.current.getSnapshot()), hostHeapMiB: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)) }));
}
console.log('Host-only source microbenchmarks. Physical typing, frames, audio, transitions, and long-session memory still require device profiling.');
