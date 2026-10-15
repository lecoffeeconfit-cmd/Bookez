import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  createBookNote,
  filterBookNotes,
  formatNoteSelection,
  toggleNoteChecklist,
  noteTags,
  safeNoteUrl,
  parseBookNote,
  mergeRemoteNotes,
  convertBookNote,
} from "../src/lib/book-notes-model.ts";

// Load the real store with Node's type stripping; its app import has no extension.
const source = await readFile(
  new URL("../src/lib/book-notes-store.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(
  source.replace(
    /from ["']\.\/book-notes-model["']/,
    `from '${new URL("../src/lib/book-notes-model.ts", import.meta.url).href}'`,
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { BookNotesStore } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const base = createBookNote("book-a", "note-a", "Plot", 100);
const pinned = {
  ...base,
  id: "pin",
  pinned: true,
  updatedAt: 50,
  title: "Hidden letter",
  content: "The sister knows the mystery.",
  folder: "Act 2",
  tags: ["Mystery"],
};
const other = { ...base, id: "other", bookId: "book-b" };
assert.deepEqual(
  filterBookNotes([base, other, pinned], "book-a").map((note) => note.id),
  ["pin", "note-a"],
);
assert.deepEqual(
  filterBookNotes([base, pinned], "book-a", {
    query: "sister mystery",
    folder: "Act 2",
    tag: "Mystery",
    category: "Plot",
  }).map((note) => note.id),
  ["pin"],
);
assert.equal(
  filterBookNotes([{ ...base, status: "trash" }], "book-a").length,
  0,
);
assert.equal(
  filterBookNotes([{ ...base, status: "trash" }], "book-a", { status: "trash" })
    .length,
  1,
);
assert.equal(
  filterBookNotes(
    [
      {
        ...base,
        links: [
          { id: "l", kind: "chapter", targetId: "unit:5", label: "Chapter 6" },
        ],
      },
    ],
    "book-a",
    { linkedTo: "unit:5" },
  ).length,
  1,
);
assert.equal(
  filterBookNotes([base], "book-a", { linkedTo: "unit:5" }).length,
  0,
);
assert.equal(parseBookNote(base, "book-b"), null);
assert.deepEqual(noteTags("#Mystery, Mystery, Act 2, "), ["Mystery", "Act 2"]);
assert.equal(safeNoteUrl("javascript:alert(1)"), null);
assert.equal(safeNoteUrl("file:///private.txt"), null);
assert.equal(safeNoteUrl("https://user:password@example.com"), null);
assert.equal(
  formatNoteSelection("the letter", 4, 10, "bold").content,
  "the **letter**",
);
assert.equal(
  formatNoteSelection("one\ntwo", 0, 7, "number").content,
  "1. one\n2. two",
);
assert.equal(
  toggleNoteChecklist("- [ ] Find a source\n- [x] Draft", 0),
  "- [x] Find a source\n- [x] Draft",
);
assert.equal(
  toggleNoteChecklist("- [ ] Find a source\n- [x] Draft", 1),
  "- [ ] Find a source\n- [ ] Draft",
);
assert.throws(() => formatNoteSelection("x", 0, 1, "link", "javascript:bad"));

const plan = {
  idea: "Keep me",
  plotThread: "Before",
  people: "Mira",
  plotNotes: { Turn: "Existing turn" },
  unitIdeas: ["Opening"],
  unitTitles: ["Chapter 1"],
  partNotes: {},
  drafts: { "unit:0": "Original manuscript" },
  writingFlags: [],
};
const convert = (kind, destinationId = "unit:0") =>
  convertBookNote(
    plan,
    "1",
    { kind, destinationId, title: "Letter", content: "An old clue." },
    `created-${kind}`,
    200,
  );
const plot = convert("plot", "Turn");
assert.equal(plot.plan.plotNotes.Turn, "Existing turn\n\nLetter\nAn old clue.");
const outline = convert("outline");
assert.equal(outline.plan.unitIdeas[0], "Opening\n\nLetter\nAn old clue.");
const scene = convert("scene");
assert.equal(scene.unitGoal, "2");
assert.equal(scene.plan.unitTitles[1], "Letter");
assert.equal(scene.plan.unitIdeas[1], "An old clue.");
const task = convert("task");
assert.equal(task.plan.writingFlags[0].partKey, "unit:0");
assert.equal(task.plan.writingFlags[0].kind, "revisit");
for (const result of [plot, outline, scene, task, convert("character")])
  assert.deepEqual(result.plan.drafts, plan.drafts);
assert.deepEqual(plan.unitIdeas, ["Opening"]);
assert.equal(plan.plotNotes.Turn, "Existing turn");

let saved = null;
let id = 0;
let fail = false;
const adapter = {
  read: async () => saved,
  write: async (value) => {
    if (fail) throw new Error("Disk full");
    saved = value;
  },
  id: () => `generated-${++id}`,
};
const store = new BookNotesStore("book-a", adapter);
await store.load();
const note = store.create();
store.update(note.id, { title: "A thought", content: "First" });
const earlyFlush = store.flush();
store.update(note.id, { content: "Latest keystroke" });
await earlyFlush;
await store.flush();
assert.equal(JSON.parse(saved)[0].note.content, "Latest keystroke");
const reopened = new BookNotesStore("book-a", adapter);
await reopened.load();
assert.equal(reopened.getSnapshot().entries[0].note.title, "A thought");
fail = true;
store.update(note.id, { content: "Still safe in memory" });
await assert.rejects(store.flush());
assert.match(store.getSnapshot().error, /Could not save/);
assert.equal(
  store.getSnapshot().entries[0].note.content,
  "Still safe in memory",
);
fail = false;
await store.flush();
assert.equal(JSON.parse(saved)[0].note.content, "Still safe in memory");

// Concurrent cloud edits preserve both versions, and local dirty work survives a pull.
const local = {
  note: { ...base, content: "Local version" },
  revision: 1,
  dirty: true,
};
const remote = {
  note: { ...base, content: "Remote version" },
  revision: 2,
  dirty: false,
};
assert.equal(
  mergeRemoteNotes([local], [remote])[0].note.content,
  "Local version",
);
const attachment = { id: 'file-a', kind: 'file', name: 'research.pdf', storagePath: 'owner/book-a/notes/file-a.pdf' };
const deviceFile = { ...local, dirty: false, note: { ...base, attachments: [{ ...attachment, uri: 'file:///private/research.pdf' }] } };
const serverFile = { ...remote, note: { ...base, attachments: [attachment] } };
assert.equal(mergeRemoteNotes([deviceFile], [serverFile])[0].note.attachments[0].uri, 'file:///private/research.pdf');
let conflictDisk = JSON.stringify([local]);
const conflict = new BookNotesStore("book-a", {
  read: async () => conflictDisk,
  write: async (value) => {
    conflictDisk = value;
  },
  id: () => "recovery",
  pull: async () => [remote],
  push: async () => ({ saved: false, entry: remote }),
});
await conflict.load();
await conflict.sync();
assert.equal(conflict.getSnapshot().entries.length, 2);
assert.equal(
  conflict.getSnapshot().entries.find((entry) => entry.note.id === base.id).note
    .content,
  "Local version",
);
assert.equal(
  conflict.getSnapshot().entries.find((entry) => entry.note.id === "recovery")
    .note.content,
  "Remote version",
);

// Typing while a cloud request is running must remain dirty for the next sync.
let releasePush;
const inFlight = new Promise((resolve) => {
  releasePush = resolve;
});
let pushStarted;
const started = new Promise((resolve) => {
  pushStarted = resolve;
});
const concurrent = new BookNotesStore("book-a", {
  read: async () => JSON.stringify([local]),
  write: async () => {},
  id: () => "unused",
  pull: async () => [],
  push: async (entry) => {
    pushStarted();
    await inFlight;
    return { saved: true, entry: { ...entry, revision: 2, dirty: false } };
  },
});
await concurrent.load();
const syncing = concurrent.sync();
await started;
concurrent.update(base.id, { content: "Typed during sync" });
releasePush();
await syncing;
assert.equal(
  concurrent.getSnapshot().entries[0].note.content,
  "Typed during sync",
);
assert.equal(concurrent.getSnapshot().entries[0].dirty, true);
assert.equal(concurrent.getSnapshot().entries[0].revision, 2);
await concurrent.flush();

let cloudAllowed = false; let networkCalls = 0; let pausedDisk;
const paused = new BookNotesStore('paused-book', {
  read: async () => null, write: async (value) => { pausedDisk = value; }, id: () => 'paused-note',
  canSync: () => cloudAllowed,
  pull: async () => { networkCalls++; return []; },
  push: async (entry) => ({ saved: true, entry: { ...entry, revision: 1, dirty: false } }),
});
await paused.load(); const pausedNote = paused.create(); paused.update(pausedNote.id, { content: 'Local with backup off' });
await paused.flush(); await paused.sync();
assert.equal(networkCalls,0); assert.equal(paused.getSnapshot().sync,'paused');
assert.equal(JSON.parse(pausedDisk)[0].note.content,'Local with backup off');
cloudAllowed = true; await paused.sync(); assert.equal(networkCalls,1); assert.equal(paused.getSnapshot().sync,'synced');
await paused.discard(); paused.update(pausedNote.id, { content: 'Must not resurrect a deleted account' }); await paused.flush();
assert.equal(paused.getSnapshot().entries.length,0);

// A failing/cloud-missing backend does not prevent durable ordinary notes.
let offlineDisk;
const offline = new BookNotesStore("offline-book", {
  read: async () => null,
  write: async (value) => {
    offlineDisk = value;
  },
  id: () => "offline-note",
  pull: async () => {
    throw new Error("Offline");
  },
  push: async () => {
    throw new Error("Offline");
  },
});
await offline.load();
const offlineNote = offline.create();
offline.update(offlineNote.id, { content: "Available without a connection" });
await offline.sync();
assert.equal(
  JSON.parse(offlineDisk)[0].note.content,
  "Available without a connection",
);
assert.equal(offline.getSnapshot().sync, "offline");
await Promise.all(
  [store, reopened, conflict, concurrent, offline].map((item) => item.flush()),
);
console.log(
  "Book Notes: per-book isolation, filters, formatting, checklists, non-destructive conversions, autosave/reopen, disk failures, offline saving and concurrent-edit recovery passed.",
);
