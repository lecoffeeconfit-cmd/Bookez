import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { supabase } from "./supabase";
import { bookezSecureStorage } from "./secure-storage";
import type { Json } from "./database.types";
import { BookNotesStore } from "./book-notes-store";
import {
  parseBookNote,
  type BookNote,
  type NoteAttachment,
  type StoredBookNote,
} from "./book-notes-model";

const prefix = "bookez.notes.v1.";
const stores = new Map<string, BookNotesStore>();
const cloudOwners = new Set<string>();
export const bookNotesCloudEnabled = (owner: string | null) =>
  Boolean(owner && cloudOwners.has(owner));
const maxAttachmentBytes = 10 * 1024 * 1024;
const pathPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");
const storageKey = (owner: string | null, bookId: string) =>
  `${prefix}${owner ?? "local"}.${bookId}`;
const attachmentDirectory = (owner: string | null, bookId: string) =>
  new Directory(
    Paths.document,
    "bookez-notes",
    pathPart(owner ?? "local"),
    pathPart(bookId),
  );

async function assertOwner(owner: string) {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== owner)
    throw new Error("Sign in again to sync this notebook.");
}

async function uploadAttachments(
  note: BookNote,
  owner: string,
): Promise<BookNote> {
  const attachments: NoteAttachment[] = [];
  for (const attachment of note.attachments) {
    if (attachment.kind === "link" || attachment.storagePath) {
      attachments.push(attachment);
      continue;
    }
    // Images use Bookez's existing moderated picker/upload path, never generic storage.
    if (attachment.kind === "image") {
      attachments.push(attachment);
      continue;
    }
    if (!attachment.uri)
      throw new Error("The attachment is not available on this device.");
    const file = new File(attachment.uri);
    if (!file.exists || file.size > maxAttachmentBytes)
      throw new Error("This file cannot be uploaded.");
    const storagePath = `${owner}/${note.bookId}/notes/${attachment.id}-${attachment.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100)}`;
    const { error } = await supabase.storage
      .from("bookez-files")
      .upload(storagePath, await file.bytes(), {
        contentType: attachment.mimeType || "application/octet-stream",
        upsert: true,
      });
    if (error) throw error;
    attachments.push({ ...attachment, storagePath });
  }
  return { ...note, attachments };
}

function cloudDocument(note: BookNote): Json {
  return JSON.parse(
    JSON.stringify({
      ...note,
      attachments: note.attachments.map((attachment) => ({
        ...attachment,
        ...(attachment.kind !== "link" ? { uri: undefined } : {}),
      })),
    }),
  ) as Json;
}

function cloudEntry(value: unknown, bookId: string): StoredBookNote {
  const row = value as { document?: unknown; revision?: number };
  const note = parseBookNote(row.document, bookId);
  if (!note || !Number.isSafeInteger(row.revision))
    throw new Error("Invalid cloud notebook response.");
  return { note, revision: row.revision!, dirty: false };
}

export function getBookNotesStore(owner: string | null, bookId: string) {
  const key = storageKey(owner, bookId);
  let store = stores.get(key);
  if (!store) {
    store = new BookNotesStore(bookId, {
      read: () => bookezSecureStorage.getItem(key),
      write: (value) => bookezSecureStorage.setItem(key, value),
      id: Crypto.randomUUID,
      ...(owner
        ? {
            canSync: () => cloudOwners.has(owner),
            pull: async () => {
              await assertOwner(owner);
              const rows: StoredBookNote[] = [];
              for (let offset = 0; ; offset += 200) {
                const { data, error } = await supabase
                  .from("book_notes")
                  .select("document,revision")
                  .eq("user_id", owner)
                  .eq("project_id", bookId)
                  .order("id")
                  .range(offset, offset + 199);
                if (error) throw error;
                rows.push(
                  ...(data ?? []).map((row) => cloudEntry(row, bookId)),
                );
                if ((data?.length ?? 0) < 200) break;
              }
              return rows;
            },
            push: async (entry: StoredBookNote) => {
              await assertOwner(owner);
              const note = await uploadAttachments(entry.note, owner);
              const { data, error } = await supabase.rpc("save_book_note", {
                p_id: note.id,
                p_project_id: bookId,
                p_document: cloudDocument(note),
                p_expected_revision: entry.revision,
              });
              if (error) throw error;
              const result = data as {
                saved?: boolean;
                entry?: unknown;
              } | null;
              if (!result || typeof result.saved !== "boolean")
                throw new Error("Invalid cloud notebook response.");
              const saved = cloudEntry(result.entry, bookId);
              // Keep durable device file paths; another device resolves its own signed URLs.
              if (result.saved) saved.note.attachments = note.attachments;
              return { saved: result.saved, entry: saved };
            },
          }
        : {}),
    });
    stores.set(key, store);
  }
  return store;
}

export function useBookNotes(owner: string | null, bookId: string) {
  const store = useMemo(
    () => getBookNotesStore(owner, bookId),
    [owner, bookId],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => {
    void store.load().then(() => store.sync());
    return () => {
      void store.flush().catch(() => undefined);
    };
  }, [store]);
  return {
    ...snapshot,
    notes: snapshot.entries.map((entry) => entry.note),
    store,
  };
}

/** Reconnect retries survive closing Notes; ordinary app routes are unaffected. */
export function startBookNotesSync(owner: string) {
  cloudOwners.add(owner);
  let active = true;
  const sync = async () => {
    const keys = await bookezSecureStorage.getAllKeys();
    if (!active) return;
    for (const key of keys.filter((value) =>
      value.startsWith(`${prefix}${owner}.`),
    )) {
      if (!active) return;
      const store = getBookNotesStore(
        owner,
        key.slice(`${prefix}${owner}.`.length),
      );
      await store.load();
      await store.sync();
    }
  };
  void sync().catch(() => undefined);
  const timer = setInterval(() => {
    if (AppState.currentState === "active") void sync().catch(() => undefined);
  }, 45_000);
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") void sync().catch(() => undefined);
    else
      for (const [key, store] of stores)
        if (key.startsWith(`${prefix}${owner}.`))
          void store.flush().catch(() => undefined);
  });
  return () => {
    active = false;
    cloudOwners.delete(owner);
    clearInterval(timer);
    subscription.remove();
    for (const [key, store] of stores)
      if (key.startsWith(`${prefix}${owner}.`)) void store.sync();
  };
}

/** Called only after the user successfully deletes this account. */
export async function clearBookNotesForOwner(owner: string) {
  cloudOwners.delete(owner);
  for (const [key, store] of stores)
    if (key.startsWith(`${prefix}${owner}.`)) {
      await store.discard();
      stores.delete(key);
    }
  const keys = await bookezSecureStorage.getAllKeys();
  await bookezSecureStorage.multiRemove(
    keys.filter((key) => key.startsWith(`${prefix}${owner}.`)),
  );
  const directory = new Directory(
    Paths.document,
    "bookez-notes",
    pathPart(owner),
  );
  if (directory.exists) directory.delete();
}

export async function keepNoteAttachment(
  owner: string | null,
  bookId: string,
  attachment: NoteAttachment,
): Promise<NoteAttachment> {
  if (!attachment.uri || attachment.kind === "link") return attachment;
  const source = new File(attachment.uri);
  if (source.size > maxAttachmentBytes)
    throw new Error("Choose a file smaller than 10 MB.");
  const directory = attachmentDirectory(owner, bookId);
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(
    directory,
    `${attachment.id}-${attachment.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100)}`,
  );
  source.copy(destination);
  return { ...attachment, uri: destination.uri, size: source.size };
}

export async function noteAttachmentUri(
  owner: string | null,
  bookId: string,
  attachment: NoteAttachment,
) {
  if (attachment.kind === "link") return attachment.uri;
  if (attachment.uri && new File(attachment.uri).exists) return attachment.uri;
  if (
    !owner ||
    !attachment.storagePath ||
    !attachment.storagePath.startsWith(`${owner}/${bookId}/`)
  )
    throw new Error("This attachment has not synced to this device yet.");
  await assertOwner(owner);
  const { data, error } = await supabase.storage
    .from("bookez-files")
    .createSignedUrl(attachment.storagePath, 300);
  if (error || !data?.signedUrl)
    throw new Error(
      "Could not open this attachment. Try again when connected.",
    );
  const directory = attachmentDirectory(owner, bookId);
  directory.create({ intermediates: true, idempotent: true });
  const target = new File(
    directory,
    `${attachment.id}-${attachment.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100)}`,
  );
  return (
    await File.downloadFileAsync(data.signedUrl, target, { idempotent: true })
  ).uri;
}
