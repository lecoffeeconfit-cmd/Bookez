export const NOTE_CATEGORIES = [
  "Ideas",
  "Plot",
  "Characters",
  "Research",
  "Dialogue",
  "Worldbuilding",
  "Tasks",
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];
export type NoteStatus = "active" | "archived" | "trash";
export type NoteLinkKind =
  | "chapter"
  | "plot"
  | "character"
  | "outline"
  | "scene"
  | "task";
export type NoteLink = {
  id: string;
  kind: NoteLinkKind;
  targetId: string;
  label: string;
  converted?: boolean;
};
export type NoteAttachment = {
  id: string;
  kind: "image" | "file" | "link";
  name: string;
  uri?: string;
  storagePath?: string;
  mimeType?: string;
  size?: number;
};
export type BookNote = {
  id: string;
  bookId: string;
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  folder: string;
  pinned: boolean;
  status: NoteStatus;
  links: NoteLink[];
  attachments: NoteAttachment[];
  createdAt: number;
  updatedAt: number;
};
export type StoredBookNote = {
  note: BookNote;
  revision: number;
  dirty: boolean;
};
export type NoteDestination = {
  id: string;
  kind: NoteLinkKind;
  label: string;
  detail?: string;
};
export type NoteConversion = {
  kind: NoteLinkKind;
  destinationId: string;
  title: string;
  content: string;
};
export type NotesFilter = {
  query?: string;
  category?: string;
  folder?: string;
  tag?: string;
  status?: NoteStatus;
  linkedTo?: string;
};

export function createBookNote(
  bookId: string,
  id: string,
  category: NoteCategory = "Ideas",
  now = Date.now(),
): BookNote {
  return {
    id,
    bookId,
    title: "",
    content: "",
    category,
    tags: [],
    folder: "",
    pinned: false,
    status: "active",
    links: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const noteTitle = (note: BookNote) =>
  note.title.trim() ||
  notePlainText(note.content)
    .split("\n")
    .find((line) => line.trim())
    ?.trim()
    .slice(0, 70) ||
  "Untitled note";
export const notePlainText = (content: string) =>
  content
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,3}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*- \[[ xX]\]\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "");
export const noteTags = (value: string) =>
  [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, "").slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 20);
export const safeNoteUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export function filterBookNotes(
  notes: BookNote[],
  bookId: string,
  filter: NotesFilter = {},
): BookNote[] {
  const words = (filter.query ?? "")
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return notes
    .filter(
      (note) =>
        note.bookId === bookId &&
        note.status === (filter.status ?? "active") &&
        (!filter.category ||
          filter.category === "All" ||
          note.category === filter.category) &&
        (!filter.folder || note.folder === filter.folder) &&
        (!filter.tag || note.tags.includes(filter.tag)) &&
        (!filter.linkedTo ||
          note.links.some((link) => link.targetId === filter.linkedTo)) &&
        words.every((word) =>
          `${note.title} ${note.content} ${note.folder} ${note.tags.join(" ")}`
            .toLocaleLowerCase()
            .includes(word),
        ),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt - a.updatedAt ||
        a.id.localeCompare(b.id),
    );
}

export function toggleNoteChecklist(
  content: string,
  lineIndex: number,
): string {
  const lines = content.split("\n");
  if (lines[lineIndex] !== undefined)
    lines[lineIndex] = lines[lineIndex].replace(
      /^(\s*- \[)([ xX])(\])/,
      (_all, start: string, checked: string, end: string) =>
        `${start}${checked === " " ? "x" : " "}${end}`,
    );
  return lines.join("\n");
}

export type NoteFormat =
  | "heading"
  | "bold"
  | "italic"
  | "bullet"
  | "number"
  | "checklist"
  | "link";
export function formatNoteSelection(
  content: string,
  start: number,
  end: number,
  format: NoteFormat,
  url?: string,
) {
  start = Math.max(0, Math.min(start, content.length));
  end = Math.max(start, Math.min(end, content.length));
  const selected = content.slice(start, end);
  let inserted: string;
  if (format === "bold" || format === "italic") {
    const marker = format === "bold" ? "**" : "*";
    inserted = `${marker}${selected || "text"}${marker}`;
  } else if (format === "link") {
    const safe = safeNoteUrl(url ?? "");
    if (!safe) throw new Error("Enter a complete http or https web link.");
    inserted = `[${selected || "Link"}](${safe})`;
  } else {
    const prefix = {
      heading: "## ",
      bullet: "- ",
      number: "1. ",
      checklist: "- [ ] ",
    }[format];
    inserted = `${start > 0 && content[start - 1] !== "\n" ? "\n" : ""}${(
      selected || (format === "heading" ? "Heading" : "New item")
    )
      .split("\n")
      .map(
        (line, index) =>
          `${format === "number" ? `${index + 1}. ` : prefix}${line}`,
      )
      .join("\n")}`;
  }
  return {
    content: content.slice(0, start) + inserted + content.slice(end),
    selection: { start: start + inserted.length, end: start + inserted.length },
  };
}

/** Accept only this book's documents; persisted content never determines ownership. */
export function parseBookNote(value: unknown, bookId: string): BookNote | null {
  if (!value || typeof value !== "object") return null;
  const note = value as Partial<BookNote>;
  if (
    typeof note.id !== "string" ||
    note.bookId !== bookId ||
    typeof note.title !== "string" ||
    typeof note.content !== "string"
  )
    return null;
  if (!Number.isFinite(note.createdAt) || !Number.isFinite(note.updatedAt))
    return null;
  const linkKinds = [
    "chapter",
    "plot",
    "character",
    "outline",
    "scene",
    "task",
  ];
  return {
    id: note.id,
    bookId,
    title: note.title.slice(0, 200),
    content: note.content.slice(0, 100_000),
    category: NOTE_CATEGORIES.includes(note.category as NoteCategory)
      ? note.category!
      : "Ideas",
    folder: typeof note.folder === "string" ? note.folder.slice(0, 80) : "",
    tags: Array.isArray(note.tags)
      ? noteTags(note.tags.filter((tag) => typeof tag === "string").join(","))
      : [],
    pinned: note.pinned === true,
    status:
      note.status === "archived" || note.status === "trash"
        ? note.status
        : "active",
    links: Array.isArray(note.links)
      ? note.links
          .filter(
            (link) =>
              link &&
              typeof link.id === "string" &&
              linkKinds.includes(link.kind) &&
              typeof link.targetId === "string" &&
              typeof link.label === "string",
          )
          .slice(0, 100)
      : [],
    attachments: Array.isArray(note.attachments)
      ? note.attachments
          .filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              ["image", "file", "link"].includes(item.kind) &&
              (item.kind !== "link" || Boolean(safeNoteUrl(item.uri ?? ""))),
          )
          .slice(0, 30)
      : [],
    createdAt: note.createdAt!,
    updatedAt: note.updatedAt!,
  };
}

/** A dirty local edit wins in memory until the revision-checked server write resolves it. */
export function mergeRemoteNotes(
  local: StoredBookNote[],
  remote: StoredBookNote[],
): StoredBookNote[] {
  const merged = new Map(local.map((item) => [item.note.id, item]));
  for (const item of remote) {
    const current = merged.get(item.note.id);
    if (!current || (!current.dirty && item.revision >= current.revision)) {
      const note = {
        ...item.note,
        attachments: item.note.attachments.map((attachment) => {
          const device = current?.note.attachments.find(
            (local) =>
              local.id === attachment.id &&
              local.storagePath === attachment.storagePath,
          );
          return device?.uri && attachment.kind !== "link"
            ? { ...attachment, uri: device.uri }
            : attachment;
        }),
      };
      merged.set(item.note.id, { ...item, note });
    }
  }
  return [...merged.values()];
}

export type ConvertiblePlan = {
  idea: string;
  plotThread: string;
  people: string;
  plotNotes: Record<string, string>;
  unitIdeas: string[];
  unitTitles?: string[];
  partNotes: Record<string, string>;
  writingFlags?: Array<{
    id: string;
    partKey: string;
    partTitle: string;
    start: number;
    end: number;
    excerpt: string;
    note: string;
    kind: "revisit" | "question" | "research" | "idea";
    resolved: boolean;
    createdAt: number;
    updatedAt?: number;
  }>;
};
/** Add to the existing planning fields. No conversion reads or writes manuscript drafts. */
export function convertBookNote<T extends ConvertiblePlan>(
  plan: T,
  unitGoal: string,
  conversion: NoteConversion,
  linkId: string,
  now = Date.now(),
): { plan: T; unitGoal: string; link: NoteLink } {
  const text = [
    conversion.title.trim(),
    notePlainText(conversion.content).trim(),
  ]
    .filter(Boolean)
    .join("\n");
  if (!text)
    throw new Error("Add a title or some note text before converting.");
  const append = (before: string | undefined) =>
    [before?.trim(), text].filter(Boolean).join("\n\n");
  let next: T = { ...plan };
  let targetId = conversion.destinationId;
  let label = conversion.title.trim() || "Note";
  let nextGoal = unitGoal;
  if (conversion.kind === "plot") {
    if (targetId === "plotThread") next.plotThread = append(plan.plotThread);
    else
      next.plotNotes = {
        ...plan.plotNotes,
        [targetId]: append(plan.plotNotes[targetId]),
      };
  } else if (conversion.kind === "character") {
    next.people = append(plan.people);
    targetId = "people";
  } else if (conversion.kind === "task") {
    targetId = linkId;
    next.writingFlags = [
      ...(plan.writingFlags ?? []),
      {
        id: linkId,
        partKey: conversion.destinationId,
        partTitle: "",
        start: 0,
        end: 0,
        excerpt: "",
        note: text,
        kind: "revisit",
        resolved: false,
        createdAt: now,
      },
    ];
  } else if (conversion.kind === "scene") {
    const index = Math.max(
      0,
      Number.parseInt(unitGoal, 10) || 0,
      plan.unitIdeas.length,
      plan.unitTitles?.length ?? 0,
    );
    const ideas = [...plan.unitIdeas];
    const titles = [...(plan.unitTitles ?? [])];
    ideas[index] = notePlainText(conversion.content).trim();
    titles[index] = conversion.title.trim() || `Scene ${index + 1}`;
    next.unitIdeas = ideas;
    next.unitTitles = titles;
    nextGoal = String(index + 1);
    targetId = `unit:${index}`;
    label = titles[index];
  } else {
    const match = /^unit:(\d+)$/.exec(targetId);
    if (conversion.kind === "outline" && match) {
      const ideas = [...plan.unitIdeas];
      ideas[Number(match[1])] = append(ideas[Number(match[1])]);
      next.unitIdeas = ideas;
    } else
      next.partNotes = {
        ...plan.partNotes,
        [targetId]: append(plan.partNotes[targetId]),
      };
  }
  return {
    plan: next,
    unitGoal: nextGoal,
    link: {
      id: linkId,
      kind: conversion.kind,
      targetId,
      label,
      converted: true,
    },
  };
}
