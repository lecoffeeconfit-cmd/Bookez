import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function nativeModuleProblems(modules, manifest, provider) {
  const podsSection = manifest.split(/^DEPENDENCIES:/m)[0];
  const installed = new Map([...podsSection.matchAll(/^  - ([^\s/(:]+) \(([^)]+)\)/gm)].map((match) => [match[1], match[2]]));
  const problems = [];
  for (const module of modules) {
    if (module.debugOnly) continue;
    for (const pod of module.pods) {
      const version = installed.get(pod.podName);
      if (!version) problems.push(`${module.packageName}: missing ${pod.podName}`);
      else if (module.packageVersion && version !== module.packageVersion) problems.push(`${pod.podName}: installed ${version}, expected ${module.packageVersion}`);
    }
    for (const entry of module.modules) {
      if (!provider.includes(`${entry.class}.self`)) problems.push(`${module.packageName}: ${entry.class} is not registered`);
    }
  }
  return problems;
}

export function checkIOSNativeModules(root = projectRoot) {
  const require = createRequire(join(root, 'package.json'));
  const autolinking = join(dirname(require.resolve('expo-modules-autolinking/package.json')), 'bin/expo-modules-autolinking.js');
  const { modules } = JSON.parse(execFileSync(process.execPath, [autolinking, 'resolve', '--platform', 'apple', '--json'], { cwd: root, encoding: 'utf8' }));
  const pods = join(root, 'ios/Pods');
  const manifest = readFileSync(join(pods, 'Manifest.lock'), 'utf8');
  const provider = readFileSync(join(pods, 'Target Support Files/Pods-Bookez/ExpoModulesProvider.swift'), 'utf8');
  const problems = nativeModuleProblems(modules, manifest, provider);
  if (problems.length) throw new Error(problems.join('\n'));
  console.log('Bookez iOS native modules match the installed JavaScript dependencies.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    checkIOSNativeModules();
  } catch (error) {
    console.error(`error: Bookez's iOS project is out of date. A release can open to a blank screen when native Expo modules are missing.\n${error.message}\nRun npm run prepare:ios, then build/archive ios/Bookez.xcworkspace again.`);
    process.exitCode = 1;
  }
}
