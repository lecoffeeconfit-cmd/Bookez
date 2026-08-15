import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL, a publishable key, and SUPABASE_SECRET_KEY before running the ephemeral RLS check.');
}

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = () => `Bz!${randomBytes(20).toString('base64url')}9a`;
const email = (label) => `bookez-rls-${label}-${randomUUID()}@example.invalid`;
const createdUserIds = [];

function createVerifiedUser(label) {
  const userEmail = email(label);
  const userPassword = password();
  return admin.auth.admin.createUser({ email: userEmail, password: userPassword, email_confirm: true })
    .then((result) => {
      if (result.error || !result.data.user) throw result.error ?? new Error(`Could not create test user ${label}.`);
      createdUserIds.push(result.data.user.id);
      return { email: userEmail, password: userPassword };
    });
}

function runRlsTest(userA, userB) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/verify-bookez-rls.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        EXPO_PUBLIC_SUPABASE_URL: url,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        BOOKEZ_TEST_USER_A_EMAIL: userA.email,
        BOOKEZ_TEST_USER_A_PASSWORD: userA.password,
        BOOKEZ_TEST_USER_B_EMAIL: userB.email,
        BOOKEZ_TEST_USER_B_PASSWORD: userB.password,
      },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`RLS test exited with code ${code}.`)));
  });
}

try {
  const [userA, userB] = await Promise.all([createVerifiedUser('a'), createVerifiedUser('b')]);
  await runRlsTest(userA, userB);
  console.log('Ephemeral Bookez RLS verification passed; temporary users will be removed.');
} finally {
  await Promise.all(createdUserIds.map((id) => admin.auth.admin.deleteUser(id)));
}
