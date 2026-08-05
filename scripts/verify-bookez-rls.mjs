import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const emailA = process.env.BOOKEZ_TEST_USER_A_EMAIL;
const passwordA = process.env.BOOKEZ_TEST_USER_A_PASSWORD;
const emailB = process.env.BOOKEZ_TEST_USER_B_EMAIL;
const passwordB = process.env.BOOKEZ_TEST_USER_B_PASSWORD;

if (!url || !key || !emailA || !passwordA || !emailB || !passwordB) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and two existing test-user email/password pairs before running this test.');
}

const makeClient = () => createClient(url, key, { db: { schema: 'bookez' }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const userA = makeClient();
const userB = makeClient();
const anon = makeClient();
const title = `RLS test ${Date.now()}`;
let projectId;

const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  assert((await userA.auth.signInWithPassword({ email: emailA, password: passwordA })).data.user, 'User A sign-in failed');
  assert((await userB.auth.signInWithPassword({ email: emailB, password: passwordB })).data.user, 'User B sign-in failed');
  const idA = (await userA.auth.getUser()).data.user?.id;
  const idB = (await userB.auth.getUser()).data.user?.id;
  assert(idA && idB && idA !== idB, 'The two test users must be different accounts');

  const profile = await userA.from('profiles').upsert({ user_id: idA, display_name: 'RLS Test A' }).select().single();
  assert(!profile.error, `User A profile create/read failed: ${profile.error?.message ?? 'unknown error'}`);

  const created = await userA.from('projects').insert({ user_id: idA, title, writing_type: 'RLS Test', target_words: 10 }).select().single();
  assert(!created.error && created.data, `User A project create/read failed: ${created.error?.message ?? 'unknown error'}`);
  projectId = created.data.id;

  const ownProject = await userA.from('projects').select('id').eq('id', projectId).single();
  assert(!ownProject.error && ownProject.data?.id === projectId, 'User A project read failed');
  const ownUpdate = await userA.from('projects').update({ title: `${title} updated` }).eq('id', projectId).select().single();
  assert(!ownUpdate.error && ownUpdate.data?.title === `${title} updated`, 'User A project update failed');

  const hiddenProject = await userB.from('projects').select('id').eq('id', projectId).maybeSingle();
  assert(!hiddenProject.error && !hiddenProject.data, 'User B could read User A project');
  const forbiddenUpdate = await userB.from('projects').update({ title: 'should not update' }).eq('id', projectId).select().maybeSingle();
  assert(!forbiddenUpdate.error && !forbiddenUpdate.data, 'User B could update User A project');
  const forbiddenDelete = await userB.from('projects').delete().eq('id', projectId).select().maybeSingle();
  assert(!forbiddenDelete.error && !forbiddenDelete.data, 'User B could delete User A project');

  const forbiddenChapter = await userB.from('chapters').insert({ project_id: projectId, user_id: idB, title: 'Should fail', position: 0 }).select().maybeSingle();
  assert(!forbiddenChapter.data, 'User B could create a chapter under User A project');
  const forbiddenSession = await userB.from('writing_sessions').insert({ project_id: projectId, user_id: idB, words_written: 1, duration_seconds: 1, started_at: new Date().toISOString() }).select().maybeSingle();
  assert(!forbiddenSession.data, 'User B could create a writing session under User A project');

  const unauthenticated = await anon.from('projects').select('id').eq('id', projectId).maybeSingle();
  assert(!unauthenticated.data, 'Unauthenticated client could read a private Bookez project');
  console.log('Bookez RLS checks passed for two authenticated users and anon.');
} finally {
  if (projectId) await userA.from('projects').delete().eq('id', projectId);
  await userA.auth.signOut();
  await userB.auth.signOut();
}
