# Page writing and spoken AI instructions

The existing Write assistant now supports 1–5-page drafts and whole-page/part
revisions. A drafted page is approximately 250–350 words, not a new structural
page or chapter. Prose is inserted at the saved cursor, beginning, or end of the
current part only after review. Whole-part revisions are split into 2,800-character
segments and applied together only when every segment is ready. Existing undo
and version-history handling remain in the editor callbacks.

## Allowance and recovery

- Page drafts cost 5 / 6 / 8 credits per page for Page / Nearby / Book-aware
  context. Revisions cost 1 / 2 / 4 credits per segment, respectively.
- Full-page tools explicitly use the metered cloud provider, regardless of the
  saved provider preference. Existing shorter tools retain Phone first / Phone
  only / Bookez credits options.
- The client checks the server allowance before starting a batch. The server
  atomically reserves each request against the shared monthly allowance, so a
  second device cannot bypass it. Client estimates are not enforcement.
- Completed previews stay in the open assistant on a failure or stop. Resume
  starts at the first unfinished request. The current request may complete and
  use credits after Stop or Close; later requests are not started.
- Failed, refused, incomplete, invalid, or oversized model responses release
  their reservation. Completed work is still delivered if the final usage read
  temporarily fails. A network loss after server completion can still consume
  credits even if the client does not receive the result.
- Preview changes are not persisted across leaving the assistant or restarting
  the app. Leaving a paid preview requires confirmation. Apply rejects stale
  source text instead of overwriting newer work.

## Microphone

The existing `expo-speech-recognition` integration is reused for AI instructions
and questions. Permission is requested only on a microphone tap; speech becomes
editable text and never submits an AI request automatically. Continuous final
utterances accumulate without losing earlier speech. Closing, disabling, or
backgrounding the field stops its recognition session.

A native Bookez build containing the speech module and existing microphone/
speech permission configuration is required for direct dictation. Expo Go uses
the keyboard-dictation fallback; a simulator cannot validate real-device audio
quality or permission behavior. Speech recognition may use the OS speech service;
no new audio-to-OpenAI upload or transcription endpoint was added.

## Release prerequisites and checks

1. Restore connectivity to the configured Supabase project before live testing.
2. Ensure `20261011150000_bookez_ai_credits.sql` is applied, and deploy the latest
   `bookez-ai-writing` Edge Function with its existing server-only OpenAI and
   Supabase service credentials. Never place service credentials in Expo public
   environment variables. This implementation does not deploy remotely.
3. In a native test build, exercise allow/deny microphone permission, multiple
   utterances, stopping, backgrounding, and closing the assistant.
4. With a test account, verify shared allowance across devices, a monthly refill,
   near-empty budget, a stopped multi-page batch, preview editing, insertion,
   whole-part replacement, Undo, and version recovery.

Local automated checks:

```sh
npx tsc --noEmit
npm run test:ai-writing
npm run test:ai-drafting
npm run test:ai-credits
npm run test:ai-project
npm run test:editor-mode
npm run test:security
```

The credit tests execute the actual Edge Function with mocked provider and
ledger services. They do not prove that a remote migration or function has been
deployed. UI checks can use isolated mocked data without accessing a real
account or spending credits.
