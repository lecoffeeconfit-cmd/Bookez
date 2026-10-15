# Book notebooks

Each Library book card has a small animated Notes action in the spare trailing
space of its existing activity row. The card's margins, padding, height and
primary actions are unchanged. Book Actions also contains a Notes entry. Opening
Notes keeps Library mounted; closing the modal returns to the same scroll offset
and does not select a different active book.

The notebook opens as a bottom sheet. Its expand control and grabber expand it
to full screen; creating a note expands it immediately. It uses Bookez's existing
cream, tan, gold and burgundy tokens and respects Reduce Motion.

## Notes

- Separate notes per stable book UUID, including renamed books.
- Quick capture, automatic local saving, a Saved indicator, pinning, live search,
  category filters, custom tags and optional folders.
- Headings, bold, italics, bullets, numbered lists and hyperlinks from the minimal
  formatting toolbar. Editing uses portable text formatting; Read & check renders
  the formatting and makes checklist boxes interactive. This is not a WebView or
  an HTML/WYSIWYG editor.
- Archive and recoverable Trash; neither deletes any linked book content.
- Dictation through Bookez's existing microphone input and keyboard fallback.
- Images through the existing moderated image picker. Files through Expo SDK 57's
  built-in File.pickFileAsync, and reference web links. No new native dependency.
  Each note supports up to 30 attachments; files are limited to 10 MB.
- Optional Luna summarize, organize, expand and brainstorm. Only the selected
  note is provided as Page context. Suggestions are reviewed before appending or
  saving as a new note. Cloud costs 1 credit per action using the existing service
  and monthly allowance; supported phone AI costs 0 Bookez credits.

Ordinary capture, editing, searching, linking and direct conversions do not call
AI or spend AI credits. Luna can be stopped or left without blocking the notebook;
an already-started cloud request may still be charged by the existing service.

## Connections

Notes can reference several existing chapters, plot/planning fields, characters
or writing reminders. Their connection chips preview the existing planning
content within Notes. Linked chapter notes appear only after opening the existing
Write Notes tool, where the same notebook can be opened and edited. No additional
resting toolbar or page section is introduced.

Convert to offers an editable preview and an explicit create action:

- Plot point: append to an existing plot prompt or throughline.
- Character detail: append to the existing character/people plan.
- Chapter outline: append to an existing part's outline/planning notes.
- New scene/writing part: add a named planned writing part using the existing
  unit-title and unit-outline system. Its manuscript remains empty.
- Writing task: add an existing revisit flag and Editor issue. It participates in
  the existing Editor and Next Step workflow rather than introducing a second
  task system.

All conversions preserve the source note and existing text. Repeated conversions
show a duplicate warning. Notes never insert or overwrite manuscript drafts.

## Persistence and sync

The device ledger uses Bookez's encrypted local storage, keyed by account and book
UUID. Saves are serialized and flush when closing Notes or backgrounding the app.
Private attachment files live separately in the app's document directory, with
only references stored in the note. Files reuse the existing private bookez-files
bucket and signed downloads; images reuse the moderated upload path.

The additive migration `20261013120000_bookez_book_notes.sql` creates the separate
bookez.book_notes collection. RLS restricts reads to the current owner and book.
Clients cannot insert or update rows directly. The save_book_note function checks
the authenticated owner, book, attachment paths and expected revision. Concurrent
edits preserve the active local note and create a separate cloud-copy note. A lost
response can safely retry the same document.

Cloud backup follows the app's existing backup toggle. Offline changes remain
local and retry on reconnect, foregrounding, or the notebook's sync action. An
unavailable database or service never prevents local capture. Images require the
existing authenticated moderation/upload service and a synced project. Cloud
Luna actions use the existing deployed AI function and policy; this feature does
not deploy or modify unrelated AI or admin services.

Account deletion cascades the new cloud records and removes this owner's local
notebooks and attachment directory. Other accounts' local notebooks are retained.

## Verification

Run `npm run test:notes` for real model/store behavior: book isolation, filters,
formatting, checklists, conversions, autosave, reopen, disk failures, offline
capture and simultaneous local/cloud edits.

Run `BOOKEZ_TEST_PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js npm run
test:notes-sql` to execute the actual migration in isolated PostgreSQL, including
owner isolation, direct-write denial, stale-revision rejection, idempotent retry,
cross-book attachment denial, trash/restore and account deletion cascade.

The simulator interaction check uses a separate temporary preview app and a
synthetic local notebook; it does not send test notes to a real user's account or
spend cloud AI credits.
