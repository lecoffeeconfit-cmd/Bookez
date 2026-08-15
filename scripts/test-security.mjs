import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [storage, supabase, auth, app, config, policy, blockPolicy] = await Promise.all([
  readFile(new URL('../src/lib/secure-storage.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/bookez-auth.ts', import.meta.url), 'utf8'),
  readFile(new URL('../App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260805170000_bookez_community_feedback_block_hardening.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260805180000_bookez_community_block_rls_fix.sql', import.meta.url), 'utf8'),
]);

assert.match(storage, /expo-secure-store/, 'Native encrypted storage must use Expo SecureStore for its encryption key.');
assert.match(storage, /react-native-get-random-values/, 'Encrypted storage must use a cryptographically secure random key.');
assert.match(storage, /encryptedValuePrefix/, 'Stored Bookez data must be encrypted before AsyncStorage persistence.');
assert.match(supabase, /storage: bookezSecureStorage/, 'Supabase sessions must use encrypted Bookez storage.');
assert.match(app, /bookezSecureStorage\.setItem\(projectStorageKey/, 'Local manuscript projects must use encrypted Bookez storage.');
assert.match(auth, /isTrustedBookezAuthCallback/, 'Auth URLs must be constrained to the configured callback.');
assert.doesNotMatch(auth, /supabase\.auth\.setSession/, 'The auth callback must not accept implicit-flow token fragments.');
assert.match(config, /minimum_password_length = 10/, 'Supabase must enforce the password length minimum.');
assert.match(config, /password_requirements = "lower_upper_letters_digits"/, 'Supabase must enforce password complexity.');
assert.match(policy, /community_blocks block/, 'Feedback passage policy must respect Community blocks.');
assert.match(policy, /request\.status = 'open'/, 'Only open feedback requests may expose passages to readers.');
assert.match(blockPolicy, /security definer/, 'Block checks in RLS must see inbound blocks as well as caller-owned blocks.');
assert.match(blockPolicy, /not bookez\.is_community_blocked/, 'Community feedback policies must use the RLS-safe block helper.');

console.log('Security contract: encrypted local data, PKCE callback validation, password policy, and feedback block RLS are present.');
