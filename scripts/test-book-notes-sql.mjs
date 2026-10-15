import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.BOOKEZ_TEST_PGLITE_MODULE ?? "@electric-sql/pglite"
);
const db = new PGlite();
const writer = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const book = "20000000-0000-4000-8000-000000000001";
const otherBook = "20000000-0000-4000-8000-000000000002";
const noteId = "30000000-0000-4000-8000-000000000001";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema bookez;
    create table auth.users(id uuid primary key); create table bookez.projects(id uuid primary key,user_id uuid references auth.users on delete cascade,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,bookez to authenticated; grant execute on function auth.uid() to authenticated;
    alter table bookez.projects enable row level security; grant select on bookez.projects to authenticated;
    create policy own_projects on bookez.projects for select to authenticated using(user_id = auth.uid());`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261013120000_bookez_book_notes.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values($1),($2)", [writer, other]);
  await db.query(
    "insert into bookez.projects values($1,$2,null),($3,$4,null)",
    [book, writer, otherBook, other],
  );
  const role = async (id) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  const note = {
    id: noteId,
    bookId: book,
    title: "Hidden letter",
    content: "Private note",
    status: "active",
    links: [],
    attachments: [],
    category: "Plot",
    tags: [],
    folder: "",
    pinned: false,
    createdAt: 1,
    updatedAt: 1,
  };
  const save = async (document = note, revision = 0, projectId = book) =>
    (
      await db.query("select bookez.save_book_note($1,$2,$3,$4) result", [
        noteId,
        projectId,
        JSON.stringify(document),
        revision,
      ])
    ).rows[0].result;
  await role(writer);
  const first = await save();
  assert.equal(first.saved, true);
  assert.equal(first.entry.revision, 1);
  const next = await save({ ...note, content: "Updated" }, 1);
  assert.equal(next.entry.revision, 2);
  const retry = await save({ ...note, content: "Updated" }, 1);
  assert.equal(retry.saved, true);
  assert.equal(retry.entry.revision, 2);
  const stale = await save({ ...note, content: "Stale offline edit" }, 1);
  assert.equal(stale.saved, false);
  assert.equal(stale.entry.document.content, "Updated");
  assert.equal(
    (await db.query("select * from bookez.book_notes")).rows.length,
    1,
  );
  await assert.rejects(
    db.query("update bookez.book_notes set revision=55"),
    /permission denied/,
  );
  await assert.rejects(
    save(
      {
        ...note,
        attachments: [{ storagePath: `${other}/${otherBook}/private.pdf` }],
      },
      2,
    ),
    /Attachment belongs/,
  );
  await assert.rejects(save({ ...note, bookId: otherBook }, 2), /Invalid note/);
  await role(other);
  assert.equal(
    (await db.query("select * from bookez.book_notes")).rows.length,
    0,
  );
  await assert.rejects(save(), /not available/);
  await assert.rejects(
    save({ ...note, bookId: otherBook }, 0, otherBook),
    /Note access denied/,
  );
  await role(writer);
  const trashed = await save({ ...note, status: "trash" }, 2);
  assert.equal(trashed.entry.document.status, "trash");
  const restored = await save(note, 3);
  assert.equal(restored.entry.document.status, "active");
  await db.exec("reset role");
  await db.query("delete from auth.users where id=$1", [writer]);
  assert.equal(
    (await db.query("select * from bookez.book_notes")).rows.length,
    0,
  );
  console.log(
    "Book Notes SQL: real migration, owner isolation, direct-write denial, compare-and-swap conflicts, cross-book attachment denial, trash/restore and account deletion cascade passed.",
  );
} finally {
  await db.close();
}
