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
let feedbackRequestId;
let userAId;
let userBId;

const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const signInA = await userA.auth.signInWithPassword({ email: emailA, password: passwordA });
  assert(signInA.data.user, `User A sign-in failed${signInA.error ? `: ${signInA.error.message} (${signInA.error.code ?? 'no error code'})` : ''}`);
  const signInB = await userB.auth.signInWithPassword({ email: emailB, password: passwordB });
  assert(signInB.data.user, `User B sign-in failed${signInB.error ? `: ${signInB.error.message} (${signInB.error.code ?? 'no error code'})` : ''}`);
  const idA = (await userA.auth.getUser()).data.user?.id;
  const idB = (await userB.auth.getUser()).data.user?.id;
  assert(idA && idB && idA !== idB, 'The two test users must be different accounts');
  userAId = idA;
  userBId = idB;

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

  const feedbackRequest = await userA.from('community_feedback_requests').insert({
    user_id: idA,
    project_id: projectId,
    project_title: title,
    focus: 'Overall direction',
    status: 'open',
  }).select('id').single();
  assert(!feedbackRequest.error && feedbackRequest.data, `User A feedback request create failed: ${feedbackRequest.error?.message ?? 'unknown error'}`);
  feedbackRequestId = feedbackRequest.data.id;
  const content = await userA.from('community_feedback_request_content').insert({
    request_id: feedbackRequestId,
    item_id: 'opening',
    item_title: 'Opening',
    item_text: 'This selected passage is visible only to eligible readers.',
  }).select('id').single();
  assert(!content.error && content.data, `User A feedback content create failed: ${content.error?.message ?? 'unknown error'}`);
  const visibleContent = await userB.from('community_feedback_request_content').select('id').eq('request_id', feedbackRequestId);
  assert(!visibleContent.error && visibleContent.data?.length === 1, 'An eligible reader could not read an open feedback passage');
  const block = await userA.from('community_blocks').insert({ blocker_id: idA, blocked_id: idB }).select().single();
  assert(!block.error && block.data, `User A block create failed: ${block.error?.message ?? 'unknown error'}`);
  const blockedContent = await userB.from('community_feedback_request_content').select('id').eq('request_id', feedbackRequestId);
  assert(!blockedContent.error && blockedContent.data?.length === 0, 'A blocked reader could read an open feedback passage');
  console.log('Bookez RLS checks passed for two authenticated users and anon.');
} finally {
  if (userAId && userBId) await userA.from('community_blocks').delete().eq('blocker_id', userAId).eq('blocked_id', userBId);
  if (feedbackRequestId) await userA.from('community_feedback_requests').delete().eq('id', feedbackRequestId);
  if (projectId) await userA.from('projects').delete().eq('id', projectId);
  await userA.auth.signOut();
  await userB.auth.signOut();
}
