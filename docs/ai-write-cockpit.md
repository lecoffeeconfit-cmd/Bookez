# Luna cockpit — implementation and release checks

Status: implemented locally, with automated safety checks passing. **Not yet
release-validated.** No migration, Edge Function, production deployment, or native
build was deployed/submitted during this task. Physical-device audio, visual,
frame-rate, and long-session profiling remain required.

## What is included

- One small tan/burgundy Luna cockpit launcher in the existing Write masthead.
  No new page or navigation destination. No other page layout is changed.
- Lazily evaluated panel, isolated from editor state. Minimize retains its work
  while allowing normal writing; Exit stops voice and saves scoped recovery.
  Write is never unmounted, focused, selected, or navigated by cockpit actions.
- Capture: spoken ideas become real per-book Notes, linked to the selected
  chapter. Consecutive captures share a bounded note; long notes roll over.
- Dictate: finalized speech is appended through the existing manuscript update
  path. A changed/missing book or a chapter over 200,000 characters falls back to
  the original notebook instead of risking an unsafe manuscript edit.
- Commands require an explicit Luna/Bookez prefix. Unknown commands are kept in
  Notes, not prose. Capture mode defers editing requests into Notes for later.
- Continue and complete-section Rewrite previews, editable before application.
  Rewrite is limited to 12,000 source characters; existing passage/page tools
  remain available for larger revisions. Phone rewrite follows the existing
  native-provider limit (2,500 characters).
- Structured character profiles append to existing `plan.people`. Next-chapter
  outlines update an existing `unitIdeas` entry. They do not create chapters or
  change chapter order. Remote targets are chosen inside settings without moving
  the active editor.
- Exact-source/project/revision guards, checkpoints, guarded undo, and encrypted
  recovery of pending requests, unapplied/applied previews, and instructions.
- Foreground-only optional keep-listening and spoken confirmations. Microphone
  ownership is shared with existing editor dictation. TTS pauses the microphone;
  backgrounding, errors, exit and unmount stop listening. Opening never records.
  Long captures are preserved in bounded segments; overlong commands are
  rejected rather than executing a silently clipped instruction.
- Small optional Luna-light animation uses native-driver transforms, starts only
  during visible active processing/listening, and honors Reduce Motion. History
  is capped at 24 messages / 24,000 characters; no token-by-token editor updates.

Driving-oriented use is **capture-first**, set up while parked. AI generation
requires a visible cost approval, and applying edits requires manual review.
This does not claim that interacting with the app while driving is safe.

## Existing services reused

`AIWritingService`, existing Luna operation/schema/provider routing, existing
credit policy/ledger, native Bookez AI module, encrypted storage, Notes store and
cloud sync, manuscript autosave/cloud queue and revision CAS, draft checkpoints,
`expo-speech-recognition`, `expo-speech`, saved reading voice, and Bookez theme /
Reduce Motion support. No runtime package or new microphone permission was added.

Ordinary typing/autosave/navigation were not rewritten. Cockpit snapshots include
only the selected section and bounded planning snippets, not every chapter's
prose. Transcript/progress state stays inside the panel.

## AI credit safety and activation

- Opening, capture, dictation, apply, undo and local planning application are
  free. Supported phone AI uses zero Bookez credits and never silently falls
  back to cloud.
- Cloud Continue/Rewrite: 2 credits per preview. Character/Outline: 4. Actual
  backend balance is checked before execution; costs are displayed beforehand.
- Existing policy remains 120/month by default, resetting at the next UTC month,
  with the last 30% (36 of 120) protected for project tools.
- Stable UUID plus canonical payload fingerprint: concurrent duplicate requests
  cannot charge twice. A completed replay returns the paid preview; failed IDs
  cannot execute again. Failed/invalid output releases its reservation. Invalid
  character JSON is rejected server-side before successful settlement.
- Cancel stops client waiting; already-authorized cloud work may still finish
  and charge. Exact pending request/ID is encrypted locally for recovery. No
  automatic paid retries or additional charge to apply a preview.
- Paid results are replayable for seven days. Expired response data is cleared
  on the owner's next new authorized request; deduplication/credit records remain.
  Cached prose is service-role-only and cascades on account deletion. This is not
  a scheduled hard seven-day purge; a production retention job is recommended.
- Existing non-ID cloud callers keep their prior billing behavior. Native jobs
  are serialized; legacy Cancel cannot interrupt a signal-scoped cockpit job.

Cockpit cloud calls fail closed unless `readCloudStatus` confirms that the new
server safeguards exist. Until approved deployment, the UI explains the lock;
capture, Notes, and supported phone AI still work.

Prepared migration: `20261014120000_bookez_ai_cockpit_idempotency.sql`, additive
columns and service-only RPCs on the existing credit ledger. It depends on
`20261011150000_bookez_ai_credits.sql`. Approval must cover the reviewed credit
migration state and matching `bookez-ai-writing` Edge Function. Do not blindly
push unrelated pending migrations.

Feature flag: `EXPO_PUBLIC_AI_COCKPIT_ENABLED=false` removes the launcher and
prevents panel/module mounting. Restart/rebundle after changing an Expo public
environment variable. Keep it disabled in production until release QA passes.

## Measurements

These are host source microbenchmarks, **not mobile performance measurements**.
Warm-up: 3 calls, 20 samples, median/p95. Before measurements were recorded prior
to cockpit edits. After measurements were run alone after the test suite. Existing
memory/fingerprint algorithms are unchanged; their variation is not a claimed
speedup. The added targeted snapshot does not scan all chapter prose.

| Workload | Existing memory before median/p95 | After median/p95 | New cockpit snapshot median/p95 |
| --- | --- | --- | --- |
| 24 × 20k characters | 8.459 / 55.374 ms | 5.445 / 6.662 ms | 0.002 / 0.092 ms |
| 100 × 60k characters | 46.790 / 91.539 ms | 44.876 / 51.006 ms | 0.004 / 0.004 ms |

Existing fingerprint median: 1.277 → 1.146 ms (24 chapters), 15.458 → 14.738 ms
(100 chapters). Host benchmark heap was 45.4 / 60.4 MiB after warm-up, not a
long-session or device memory/leak result. Run `npm run benchmark:ai-cockpit`.

The pre-existing Write memory/fingerprint work is material on very large books.
It is not triggered by cockpit transcripts, but should be separately profiled
and optimized before claiming 60 FPS for all large-manuscript typing.

Still unmeasured on physical devices: typing latency, chapter load/navigation,
open/close duration (target about 300 ms), frame rate/animation CPU, recognition
latency/accuracy, interruption/background/resume, offline transitions and
multi-hour memory. No claim of zero lag or physical-device performance success.

## Verification

Passed:

- `npx tsc --noEmit`, `git diff --check`.
- `test:ai-cockpit`: 15 model safety suites, including >1 MB draft preservation.
- `test:ai-cockpit-recovery`: 55 scoped/shape/cost/retry/preview validation suites.
- `test:cockpit-voice`: actual compiled hook/coordinator with mocked native audio;
  partial recovery, duplicate suppression, permission races, microphone ownership,
  background/unmount cleanup, TTS isolation and hands-free sequencing.
- `test:ai-cockpit-ui`: actual compiled launcher/panel callback harness; 20
  minimize/reopen cycles, input/editor-location preservation, rapid-save dedupe,
  typing-during-save preservation, target queue isolation, mode boundaries,
  stale generation, reject/apply/undo, Exit/reopen recovery, blank rewrite denial,
  hidden-animation cleanup, and feature flag.
- `test:ai-cockpit-credits`: actual service/Edge Function with mocked transport,
  and real migrations executed in temporary PGlite. Concurrent/exact-once replay,
  failed-call release, account/payload isolation, reserve, permissions, stale
  settlement, character validation, and native cancellation ownership.
- Existing `test:ai-writing`, `test:ai-drafting`, `test:ai-credits`,
  `test:ai-project`, `test:notes`, `test:notes-sql`, `test:editor-mode`,
  `test:book-progress`, and `test:security`.
- Synthetic cockpit iOS Metro bundle compiled successfully (843 modules).
- Current full Bookez Android Metro bundle compiled successfully.

SQL QA command uses the already available temporary test dependency, not a new
application dependency:

```sh
BOOKEZ_TEST_PGLITE_MODULE=/private/tmp/bookez-sqlcheck/node_modules/@electric-sql/pglite/dist/index.js npm run test:ai-cockpit-credits
```

No available iOS simulator devices were returned in this environment, so actual
visual/native UI execution was not completed. Mock callback tests and bundling
do not substitute for real touch, VoiceOver/TalkBack, keyboard or microphone QA.

## Files changed for this task

- `App.tsx`: launcher, stable latest-plan bridge, guarded updates/checkpoints,
  account-scoped cockpit recovery cleanup.
- `src/components/AIWriteCockpitEntry.tsx`, `AIWriteCockpit.tsx`: new isolated UI.
- `src/lib/ai-cockpit-model.ts`, `ai-cockpit-recovery.ts`: pure safety boundaries.
- `src/lib/cockpit-voice.ts`, `speech-session.ts`, and minimal
  `src/components/DictationInput.tsx` changes: shared audio lifecycle.
- `src/lib/ai-writing.ts`, `supabase/functions/bookez-ai-writing/index.ts`, and
  the new idempotency migration: optional backend/client protections.
- Six cockpit test/benchmark scripts, package aliases, and this report.

Earlier unrelated dirty worktree changes were preserved.

## Remaining gates and deliberately omitted features

Real-device microphone permission, recognition accuracy/locale support, calls /
headphones / route changes, spoken confirmations and long sessions need testing
on representative iOS and Android devices. Direct recognition needs a current
Bookez native build (not Expo Go). Offline recognition depends on installed
language support; otherwise the platform recognition service may use the
network. No lock-screen/background recording or assistant is provided. Native
AI availability and best-effort cancellation depend on the existing provider.

Move Scene, arbitrary book/chapter navigation commands, autonomous multi-step
manuscript changes, background driving automation, and unattended paid actions
are deliberately not exposed. Planning/remote edits use manual safe previews;
voice prepares them without silently authorizing spending or applying edits.

Before release: approve/review backend deployment, test live credit recovery
with a test account, verify cloud sync conflicts without manuscript loss, profile
all physical-device scenarios above, visually review dynamic type/accessibility
and keyboard layout, and resolve measured regressions. The cloud activation and
physical-device release criteria are unfinished, not silently marked complete.
