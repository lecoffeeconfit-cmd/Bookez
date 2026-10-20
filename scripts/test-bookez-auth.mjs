import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadAuth(os = 'android') {
  let exchanges = 0;
  const failures = new Map();
  let browserResult = { type: 'success', url: 'bookez://auth/callback?code=browser' };
  let options;
  const redirect = os === 'web' ? 'https://bookez.example/' : 'bookez://auth/callback';
  const supabase = {
    auth: {
      async exchangeCodeForSession(code) {
        exchanges++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { error: failures.get(code) ?? null };
      },
      async signInWithOAuth(value) { options = value; return { data: { url: 'https://accounts.google.com/' }, error: null }; },
      async getSession() { return { data: { session: null }, error: null }; },
    },
  };
  const dependencies = {
    'expo-linking': { parse: (url) => ({ queryParams: Object.fromEntries(new URL(url).searchParams) }) },
    'expo-apple-authentication': {},
    'expo-crypto': {},
    'expo-web-browser': { openAuthSessionAsync: async () => browserResult },
    'react-native': { Platform: { OS: os } },
    './supabase': { supabase, bookezRedirectUrl: redirect },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/bookez-auth.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, URL, URLSearchParams, Error, Promise });
  return { auth: module.exports, failures, exchanges: () => exchanges, options: () => options, setBrowserResult: (value) => { browserResult = value; } };
}
const native = loadAuth();
assert.equal(native.auth.isTrustedBookezAuthCallback('https://evil.example/auth/callback?code=x'), false);
assert.equal(await native.auth.handleBookezAuthUrl('bookez://evil/callback?code=x'), undefined);
assert.equal(native.exchanges(), 0);
await Promise.all(Array.from({ length: 5 }, () => native.auth.handleBookezAuthUrl('bookez://auth/callback?code=one')));
await native.auth.handleBookezAuthUrl('bookez://auth/callback?code=one');
assert.equal(native.exchanges(), 1, 'One-use code must only be exchanged once across duplicate deliveries');
await native.auth.handleBookezAuthUrl('bookez://auth/callback?code=two');
assert.equal(native.exchanges(), 2);
await assert.rejects(native.auth.handleBookezAuthUrl('bookez://auth/callback#error=access_denied&error_description=Google+denied+access'), /Google denied access/);
native.failures.set('bad', new Error('Invalid code'));
await assert.rejects(native.auth.handleBookezAuthUrl('bookez://auth/callback?code=bad'), /Invalid code/);
await native.auth.handleBookezAuthUrl('bookez://auth/callback?code=fresh');
native.setBrowserResult({ type: 'cancel' });
assert.equal(await native.auth.signInWithOAuthProvider('google'), false);
assert.equal(native.options().options.redirectTo, 'bookez://auth/callback');
assert.equal(native.options().options.skipBrowserRedirect, true);
native.setBrowserResult({ type: 'success', url: 'bookez://auth/callback?error=access_denied' });
await assert.rejects(native.auth.signInWithOAuthProvider('google'), /access_denied/);
native.setBrowserResult({ type: 'success', url: 'https://evil.example/?code=stolen' });
await assert.rejects(native.auth.signInWithOAuthProvider('google'), /unexpected callback/);
const web = loadAuth('web');
await web.auth.signInWithOAuthProvider('google');
assert.equal(web.options().options.redirectTo, 'https://bookez.example/');
assert.equal(web.options().options.skipBrowserRedirect, false);
await web.auth.handleBookezAuthUrl('https://bookez.example/?code=web');
assert.equal(web.exchanges(), 1);
assert.equal(web.auth.isTrustedBookezAuthCallback('https://evil.example/?code=web'), false);
console.log('Auth checks passed: duplicate PKCE delivery, untrusted callbacks, provider errors, retries, cancellation, and web/native redirects.');
