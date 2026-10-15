import {
  createBookNote,
  mergeRemoteNotes,
  parseBookNote,
  type BookNote,
  type NoteCategory,
  type StoredBookNote,
} from "./book-notes-model";

export type NotesSnapshot = {
  entries: StoredBookNote[];
  loaded: boolean;
  saving: boolean;
  error: string;
  sync: "local" | "syncing" | "synced" | "offline" | "paused";
};
export type NotesAdapter = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  id: () => string;
  pull?: () => Promise<StoredBookNote[]>;
  push?: (
    entry: StoredBookNote,
  ) => Promise<{ saved: boolean; entry: StoredBookNote }>;
  canSync?: () => boolean;
};

/** One serialized local writer per owner/book, independent of modal lifetimes. */
export class BookNotesStore {
  private snapshot: NotesSnapshot = {
    entries: [],
    loaded: false,
    saving: false,
    error: "",
    sync: "local",
  };
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private syncing: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private version = 0;
  private persistedVersion = 0;
  private discarded = false;
  constructor(
    readonly bookId: string,
    private adapter: NotesAdapter,
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(changes: Partial<NotesSnapshot>) {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.listeners) listener();
  }
  load = () => {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const raw = await this.adapter.read();
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) throw new Error("Invalid notebook");
        const entries = parsed.flatMap((item) => {
          const note = parseBookNote(item?.note, this.bookId);
          return note
            ? [
                {
                  note,
                  revision: Number.isSafeInteger(item.revision)
                    ? item.revision
                    : 0,
                  dirty: item.dirty === true,
                },
              ]
            : [];
        });
        if (!this.discarded) this.emit({ entries, loaded: true, error: "" });
      } catch {
        this.loading = null;
        this.emit({
          error: "Your notebook could not be loaded. Please retry.",
        });
      }
    })();
    return this.loading;
  };
  private changed(entries: StoredBookNote[], syncAfter = true) {
    if (this.discarded) return;
    this.version += 1;
    this.emit({ entries, saving: true, error: "" });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush()
        .then(() => (syncAfter ? this.sync() : undefined))
        .catch(() => undefined);
    }, 350);
  }
  create = (category: NoteCategory = "Ideas") => {
    if (!this.snapshot.loaded)
      throw new Error("Wait for your notebook to load.");
    const note = createBookNote(this.bookId, this.adapter.id(), category);
    this.changed([
      ...this.snapshot.entries,
      { note, revision: 0, dirty: true },
    ]);
    return note;
  };
  update = (
    id: string,
    changes: Partial<Omit<BookNote, "id" | "bookId" | "createdAt">>,
  ) => {
    this.changed(
      this.snapshot.entries.map((entry) =>
        entry.note.id === id
          ? {
              ...entry,
              dirty: true,
              note: { ...entry.note, ...changes, updatedAt: Date.now() },
            }
          : entry,
      ),
    );
  };
  flush = async () => {
    if (this.discarded) return;
    clearTimeout(this.timer);
    const version = this.version;
    const value = JSON.stringify(this.snapshot.entries);
    const write = this.writing
      .catch(() => undefined)
      .then(async () => {
        if (this.discarded || version <= this.persistedVersion) return;
        await this.adapter.write(value);
        this.persistedVersion = version;
        if (version === this.version) this.emit({ saving: false, error: "" });
      });
    this.writing = write;
    try {
      await write;
    } catch {
      this.emit({
        saving: false,
        error:
          "Could not save this note on your device. Keep Notes open and retry.",
      });
      throw new Error("Note save failed");
    }
  };
  sync = () => {
    if (this.discarded) return Promise.resolve();
    if (this.adapter.canSync?.() === false) {
      this.emit({ sync: "paused" });
      return Promise.resolve();
    }
    if (!this.adapter.pull || !this.adapter.push || !this.snapshot.loaded)
      return Promise.resolve();
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      this.emit({ sync: "syncing" });
      try {
        await this.flush();
        // Always pull all notes, including archive/trash tombstones, after reconnect.
        const remote = await this.adapter.pull!();
        if (this.discarded) return;
        this.changed(mergeRemoteNotes(this.snapshot.entries, remote), false);
        for (const pending of [...this.snapshot.entries].filter(
          (entry) => entry.dirty,
        )) {
          if (this.discarded || this.adapter.canSync?.() === false) break;
          const result = await this.adapter.push!(pending);
          const current = this.snapshot.entries.find(
            (entry) => entry.note.id === pending.note.id,
          );
          if (!current) continue;
          const unchanged =
            JSON.stringify(current.note) === JSON.stringify(pending.note);
          if (result.saved) {
            this.changed(
              this.snapshot.entries.map((entry) =>
                entry.note.id === pending.note.id
                  ? {
                      note: unchanged ? result.entry.note : entry.note,
                      revision: result.entry.revision,
                      dirty: !unchanged,
                    }
                  : entry,
              ),
              false,
            );
          } else {
            // Concurrent edits are preserved as a second note, never silently overwritten.
            const recovery = {
              ...result.entry.note,
              id: this.adapter.id(),
              title: `${result.entry.note.title || "Untitled note"} · cloud copy`,
              updatedAt: Date.now(),
            };
            this.changed(
              [
                ...this.snapshot.entries.filter(
                  (entry) => entry.note.id !== pending.note.id,
                ),
                { ...current, revision: result.entry.revision, dirty: true },
                { note: recovery, revision: 0, dirty: true },
              ],
              false,
            );
          }
        }
        await this.flush();
        this.emit({
          sync: this.snapshot.entries.some((entry) => entry.dirty)
            ? "offline"
            : "synced",
        });
      } catch {
        if (!this.discarded)
          this.emit({
            sync: this.adapter.canSync?.() === false ? "paused" : "offline",
          });
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  };
  discard = async () => {
    this.discarded = true;
    clearTimeout(this.timer);
    await this.writing.catch(() => undefined);
    this.emit({ entries: [], loaded: true, saving: false });
  };
}
