import assert from 'node:assert/strict';
import { nativeModuleProblems } from './check-ios-native-modules.mjs';

const modules = [
  ['expo-crypto', 'ExpoCrypto', 'CryptoModule', '57.0.2'],
  ['expo-web-browser', 'ExpoWebBrowser', 'WebBrowserModule', '57.0.2'],
  ['expo-apple-authentication', 'ExpoAppleAuthentication', 'AppleAuthenticationModule', '57.0.1'],
  ['expo-splash-screen', 'ExpoSplashScreen', 'SplashScreenModule', '57.0.9'],
].map(([packageName, podName, moduleClass, packageVersion]) => ({ packageName, packageVersion, pods: [{ podName }], modules: [{ class: moduleClass }] }));
const manifest = `PODS:\n${modules.map((module) => `  - ${module.pods[0].podName} (${module.packageVersion})`).join('\n')}\n\nDEPENDENCIES:\n  - ExpoCrypto (from \`../node_modules/expo-crypto/ios\`)\n`;
const provider = modules.map((module) => `(module: ${module.modules[0].class}.self, name: nil)`).join(',\n');

// Build 4 had a valid, mutually matching Podfile.lock/Manifest.lock, but neither
// included the new dependencies. Merely checking those two lockfiles missed it.
const stale = nativeModuleProblems(modules, 'PODS:\n  - Expo (57.0.11)\n', 'ExpoFetchModule.self');
for (const module of modules) assert.ok(stale.includes(`${module.packageName}: missing ${module.pods[0].podName}`));
assert.deepEqual(nativeModuleProblems(modules, manifest, provider), []);
assert.ok(nativeModuleProblems(modules, manifest.replace('ExpoCrypto (57.0.2)', 'ExpoCrypto (57.0.1)'), provider).some((problem) => problem.includes('installed 57.0.1, expected 57.0.2')));
assert.ok(nativeModuleProblems(modules, manifest, provider.replace('CryptoModule.self', 'OtherModule.self')).some((problem) => problem.includes('CryptoModule is not registered')));
assert.deepEqual(nativeModuleProblems([{ ...modules[0], debugOnly: true }], '', ''), []);
assert.deepEqual(nativeModuleProblems([{ ...modules[0], packageVersion: '' }], manifest, provider), []);
console.log('iOS native dependency regression checks passed.');
