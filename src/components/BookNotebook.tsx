import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import { useBookezReduceMotion } from "./BookezUI";
import DictationInput from "./DictationInput";
import {
  bookNotesCloudEnabled,
  keepNoteAttachment,
  noteAttachmentUri,
  useBookNotes,
} from "../lib/book-notes";
import {
  NOTE_CATEGORIES,
  filterBookNotes,
  formatNoteSelection,
  notePlainText,
  noteTags,
  noteTitle,
  safeNoteUrl,
  toggleNoteChecklist,
  type BookNote,
  type NoteAttachment,
  type NoteCategory,
  type NoteConversion,
  type NoteDestination,
  type NoteFormat,
  type NoteLink,
  type NoteLinkKind,
  type NoteStatus,
} from "../lib/book-notes-model";
import {
  AIWritingService,
  type AIProviderPreference,
  type AIWritingOperation,
} from "../lib/ai-writing";
import { AI_PROVIDER_STORAGE_KEY } from "../lib/ai-provider";
import {
  aiUsageRefillLabel,
  recordAIUsage,
  saveCloudAIUsage,
} from "../lib/ai-usage";
import { bookezSecureStorage } from "../lib/secure-storage";
import {
  bookezImageModerationErrorMessage,
  pickModeratedBookezImage,
} from "../lib/bookez-image-moderation";
import { bookezColors as c, bookezType } from "../theme/bookez";

export type NotebookBook = {
  id: string;
  title: string;
  type: string;
  destinations: NoteDestination[];
};
type Props = {
  book: NotebookBook;
  ownerId: string | null;
  onClose: () => void;
  onConvert?: (conversion: NoteConversion, linkId: string) => NoteLink;
  initialNoteId?: string;
  initialChapterId?: string;
};
const conversionKinds: Array<{
  kind: NoteLinkKind;
  label: string;
  hint: string;
}> = [
  { kind: "plot", label: "Plot point", hint: "Add to the existing plot plan" },
  {
    kind: "scene",
    label: "New scene / writing part",
    hint: "Create a planned part with an empty manuscript",
  },
  {
    kind: "outline",
    label: "Chapter outline",
    hint: "Add to a chapter’s existing outline",
  },
  {
    kind: "character",
    label: "Character detail",
    hint: "Add to the existing character plan",
  },
  {
    kind: "task",
    label: "Writing task",
    hint: "Add a reminder to the existing Editor / Next Step flow",
  },
];
const lunaActions: Array<{
  label: string;
  operation: AIWritingOperation;
  instruction: string;
}> = [
  {
    label: "Summarize",
    operation: "shorten",
    instruction:
      "Summarize this private book note concisely. Keep its important facts. Return the summary as one option.",
  },
  {
    label: "Organize",
    operation: "rewrite",
    instruction:
      "Organize this private book note with clear headings and bullet points. Preserve all facts and ideas. Return one organized version.",
  },
  {
    label: "Expand",
    operation: "expand",
    instruction:
      "Develop the ideas in this private book note. Clearly distinguish new possibilities from established facts. Return one expanded version.",
  },
  {
    label: "Brainstorm",
    operation: "brainstorm",
    instruction:
      "Suggest useful possibilities based on this private book note. Treat suggestions as possibilities, not established plot facts.",
  },
];

export function NotebookMark({ size = 24 }: { size?: number }) {
  const gradient = useRef(`note-${Crypto.randomUUID()}`).current;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessible={false}>
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <Stop stopColor="#F5DCB1" />
          <Stop offset="1" stopColor="#C39B64" />
        </LinearGradient>
      </Defs>
      <Rect
        x="6"
        y="5"
        width="24"
        height="28"
        rx="4"
        fill="#8C6339"
        opacity=".22"
      />
      <Path
        d="M8 3h17l6 6v19a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V7a4 4 0 0 1 3-4Z"
        fill={`url(#${gradient})`}
        stroke="#976C35"
        strokeWidth="1.2"
      />
      <Path
        d="M25 3v7h6M11 14h13M11 19h13M11 24h8"
        fill="none"
        stroke="#76542E"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <Path d="M9 5v25" stroke="#AF753F" strokeWidth="1" opacity=".5" />
      <Circle cx="23" cy="4" r="2.3" fill={c.accent} />
    </Svg>
  );
}

/** Occupies the spare trailing space in the existing card row; no card geometry changes. */
export function LibraryNotesButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  const reduceMotion = useBookezReduceMotion();
  const settle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      settle.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.delay(300),
      Animated.timing(settle, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, settle]);
  return (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={s.libraryButton}
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 3 }}
      accessibilityRole="button"
      accessibilityLabel={`Open Notes for ${title}`}
      accessibilityHint="Opens this book’s private notebook"
    >
      <Animated.View
        style={{
          transform: [
            {
              rotate: settle.interpolate({
                inputRange: [0, 0.55, 1],
                outputRange: ["-9deg", "3deg", "0deg"],
              }),
            },
            {
              scale: settle.interpolate({
                inputRange: [0, 1],
                outputRange: [0.88, 1],
              }),
            },
          ],
        }}
      >
        <NotebookMark size={18} />
      </Animated.View>
      <Text style={s.libraryButtonText}>Notes</Text>
    </Pressable>
  );
}

function Action({
  children,
  onPress,
  active = false,
  primary = false,
  disabled = false,
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.action,
        active && s.actionActive,
        primary && s.primary,
        disabled && s.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
    >
      <Text style={[s.actionText, (active || primary) && s.onAccent]}>
        {children}
      </Text>
    </Pressable>
  );
}

function InlineText({ text }: { text: string }) {
  const pieces = text.split(
    /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g,
  );
  return (
    <>
      {pieces.map((piece, index) => {
        const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(piece);
        if (link)
          return (
            <Text
              key={index}
              style={s.inlineLink}
              accessibilityRole="link"
              onPress={() => {
                const url = safeNoteUrl(link[2]);
                if (url)
                  void Linking.openURL(url).catch(() =>
                    Alert.alert(
                      "Could not open link",
                      "Check the address and try again.",
                    ),
                  );
              }}
            >
              {link[1]}
            </Text>
          );
        if (piece.startsWith("**") && piece.endsWith("**"))
          return (
            <Text key={index} style={s.bold}>
              {piece.slice(2, -2)}
            </Text>
          );
        if (piece.startsWith("*") && piece.endsWith("*"))
          return (
            <Text key={index} style={s.italic}>
              {piece.slice(1, -1)}
            </Text>
          );
        return <Text key={index}>{piece}</Text>;
      })}
    </>
  );
}

export function NoteReadingView({
  content,
  onChange,
}: {
  content: string;
  onChange?: (content: string) => void;
}) {
  return (
    <View style={s.reading}>
      {content.split("\n").map((line, index) => {
        const checklist = /^\s*- \[([ xX])\]\s*(.*)$/.exec(line);
        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
        const numbered = /^\s*(\d+)\.\s+(.*)$/.exec(line);
        if (checklist)
          return (
            <Pressable
              key={index}
              disabled={!onChange}
              onPress={() => onChange?.(toggleNoteChecklist(content, index))}
              style={s.checkRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: checklist[1] !== " " }}
              accessibilityLabel={checklist[2]}
            >
              <View
                style={[s.checkbox, checklist[1] !== " " && s.checkboxDone]}
              >
                <Text style={s.checkmark}>
                  {checklist[1] !== " " ? "✓" : ""}
                </Text>
              </View>
              <Text
                style={[
                  s.readText,
                  s.checkText,
                  checklist[1] !== " " && s.checkedText,
                ]}
              >
                <InlineText text={checklist[2]} />
              </Text>
            </Pressable>
          );
        if (heading)
          return (
            <Text
              key={index}
              style={[
                s.readHeading,
                heading[1].length === 1 && s.readHeadingLarge,
              ]}
            >
              <InlineText text={heading[2]} />
            </Text>
          );
        if (bullet || numbered)
          return (
            <View key={index} style={s.checkRow}>
              <Text style={s.bullet}>{bullet ? "•" : `${numbered![1]}.`}</Text>
              <Text style={[s.readText, s.checkText]}>
                <InlineText text={bullet?.[1] ?? numbered![2]} />
              </Text>
            </View>
          );
        return (
          <Text key={index} style={s.readText}>
            <InlineText text={line || " "} />
          </Text>
        );
      })}
    </View>
  );
}

export default function BookNotebook({
  book,
  ownerId,
  onClose,
  onConvert,
  initialNoteId,
  initialChapterId,
}: Props) {
  const { height, width } = useWindowDimensions();
  const reduceMotion = useBookezReduceMotion();
  const { notes, store, loaded, saving, error, sync } = useBookNotes(
    ownerId,
    book.id,
  );
  const [expanded, setExpanded] = useState(Boolean(initialNoteId));
  const sheetHeight = useRef(
    new Animated.Value(initialNoteId ? height : height * 0.82),
  ).current;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialNoteId ?? null,
  );
  const [freshNoteId, setFreshNoteId] = useState<string | null>(null);
  const [chapterFilter, setChapterFilter] = useState(initialChapterId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [folder, setFolder] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<NoteStatus>("active");
  const [organize, setOrganize] = useState(false);
  const [reading, setReading] = useState(false);
  const [panel, setPanel] = useState<
    | "organize"
    | "links"
    | "convert"
    | "luna"
    | "web-link"
    | "text-link"
    | "destination"
    | null
  >(null);
  const [connectedLink, setConnectedLink] = useState<NoteLink | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [conversion, setConversion] = useState<NoteConversion | null>(null);
  const [conversionWarning, setConversionWarning] = useState("");
  const [provider, setProvider] = useState<AIProviderPreference>("auto");
  const [lunaBusy, setLunaBusy] = useState(false);
  const [lunaResult, setLunaResult] = useState("");
  const [lunaError, setLunaError] = useState("");
  const [lunaLabel, setLunaLabel] = useState("");
  const [creditLabel, setCreditLabel] = useState("");
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const input = useRef<TextInput>(null);
  const mounted = useRef(true);
  const lunaToken = useRef(0);
  const active = notes.find((note) => note.id === selectedId);
  const latestNote = useRef(active);
  latestNote.current = active;
  const folders = useMemo(
    () =>
      [
        ...new Set(
          notes
            .filter((note) => note.status === status)
            .map((note) => note.folder)
            .filter(Boolean),
        ),
      ].sort(),
    [notes, status],
  );
  const tags = useMemo(
    () =>
      [
        ...new Set(
          notes
            .filter((note) => note.status === status)
            .flatMap((note) => note.tags),
        ),
      ].sort(),
    [notes, status],
  );
  const filtered = filterBookNotes(notes, book.id, {
    query,
    category,
    folder,
    tag,
    status,
    ...(!selectedId && chapterFilter ? { linkedTo: chapterFilter } : {}),
  });
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 8,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy < -15) setExpanded(true);
          else if (gesture.dy > 40) setExpanded(false);
        },
      }),
    [],
  );

  useEffect(() => {
    Animated.timing(sheetHeight, {
      toValue: expanded ? height : height * 0.82,
      duration: reduceMotion ? 0 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded, height, reduceMotion, sheetHeight]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      lunaToken.current += 1;
    };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void store.flush().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [store]);
  useEffect(() => {
    void bookezSecureStorage.getItem(AI_PROVIDER_STORAGE_KEY).then((saved) => {
      if (
        mounted.current &&
        (saved === "auto" || saved === "device" || saved === "cloud")
      )
        setProvider(saved);
    });
  }, []);
  const update = (changes: Partial<BookNote>) => {
    if (active) store.update(active.id, changes);
  };
  const changeNote = (id: string | null, preview = Boolean(id)) => {
    Keyboard.dismiss();
    setSelectedId(id);
    setPanel(null);
    setConversion(null);
    setLunaResult("");
    setLunaError("");
    setReading(preview);
    setSelection({ start: 0, end: 0 });
  };
  const stopLuna = () => {
    lunaToken.current += 1;
    setLunaBusy(false);
    setLunaError(
      "Stopped waiting. A cloud request already in progress may still use its credit.",
    );
    void AIWritingService.cancel();
  };
  const close = async (force = false) => {
    if (closing) return;
    if (lunaBusy && !force) {
      Alert.alert(
        "Leave Luna?",
        "A cloud request already in progress may still use its credit. Your original note is saved.",
        [
          { text: "Keep waiting", style: "cancel" },
          {
            text: "Leave Notes",
            onPress: () => {
              stopLuna();
              void close(true);
            },
          },
        ],
      );
      return;
    }
    setClosing(true);
    Keyboard.dismiss();
    try {
      await store.flush();
      onClose();
    } catch {
      setClosing(false);
    }
  };
  const create = () => {
    const note = store.create(
      NOTE_CATEGORIES.includes(category as NoteCategory)
        ? (category as NoteCategory)
        : "Ideas",
    );
    if (initialChapterId) {
      const destination = book.destinations.find(
        (item) => item.id === initialChapterId,
      );
      if (destination)
        store.update(note.id, {
          links: [
            {
              id: Crypto.randomUUID(),
              kind: "chapter",
              targetId: destination.id,
              label: destination.label,
            },
          ],
        });
    }
    setFreshNoteId(note.id);
    changeNote(note.id, false);
    setExpanded(true);
    setStatus("active");
  };
  const format = (kind: NoteFormat, url?: string) => {
    if (!active) return;
    try {
      const result = formatNoteSelection(
        active.content,
        selection.start,
        selection.end,
        kind,
        url,
      );
      update({ content: result.content });
      setSelection(result.selection);
      setReading(false);
      setPanel(null);
      requestAnimationFrame(() => input.current?.focus());
    } catch (caught) {
      Alert.alert(
        "Check the link",
        caught instanceof Error
          ? caught.message
          : "Use a complete web address.",
      );
    }
  };
  const openAttachment = async (attachment: NoteAttachment) => {
    try {
      const uri = await noteAttachmentUri(ownerId, book.id, attachment);
      if (!uri || !mounted.current) return;
      if (attachment.kind === "image") setImagePreview(uri);
      else if (attachment.kind === "link") {
        const url = safeNoteUrl(uri);
        if (url) await Linking.openURL(url);
      } else if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: attachment.mimeType,
          dialogTitle: attachment.name,
        });
      else
        Alert.alert(
          "File saved",
          "This file is safely attached. File preview is not supported on this device.",
        );
    } catch (caught) {
      Alert.alert(
        "Attachment unavailable",
        caught instanceof Error ? caught.message : "Try again when connected.",
      );
    }
  };
  const attach = async (kind: "image" | "file") => {
    if (!active || attachmentBusy) return;
    if (active.attachments.length >= 30) {
      Alert.alert("Attachment limit", "Keep up to 30 attachments per note.");
      return;
    }
    const noteId = active.id;
    setAttachmentBusy(true);
    try {
      let attachment: NoteAttachment | null = null;
      if (kind === "image") {
        if (ownerId && !bookNotesCloudEnabled(ownerId))
          throw new Error(
            "Turn on cloud backup to add a reference image with Bookez’s image safety check.",
          );
        const result = await pickModeratedBookezImage({
          userId: ownerId,
          projectId: book.id,
          purpose: "book-image",
        });
        if (result) {
          if (ownerId && !result.storagePath)
            throw new Error(
              "Sync this book before adding a reference image, then try again.",
            );
          attachment = {
            id: Crypto.randomUUID(),
            kind,
            name: result.asset.fileName || "Reference image.jpg",
            uri: result.asset.uri,
            mimeType: result.asset.mimeType || "image/jpeg",
            storagePath: result.storagePath,
          };
        }
      } else {
        const result = await File.pickFileAsync({ mimeTypes: "*/*" });
        if (!result.canceled) {
          const file = result.result;
          if (
            /^image\//i.test(file.type) ||
            /\.(avif|bmp|gif|heic|heif|jpeg|jpg|png|webp)$/i.test(file.name)
          )
            throw new Error("Use “Image” to attach reference photos.");
          attachment = {
            id: Crypto.randomUUID(),
            kind,
            name: file.name,
            uri: file.uri,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          };
        }
      }
      if (attachment) {
        const kept = await keepNoteAttachment(ownerId, book.id, attachment);
        const current = store
          .getSnapshot()
          .entries.find((entry) => entry.note.id === noteId)?.note;
        if (current)
          store.update(noteId, { attachments: [...current.attachments, kept] });
      }
    } catch (caught) {
      Alert.alert(
        "Could not attach",
        caught instanceof Error && !("code" in caught)
          ? caught.message
          : kind === "image"
            ? bookezImageModerationErrorMessage(caught)
            : "Try again.",
      );
    } finally {
      if (mounted.current) setAttachmentBusy(false);
    }
  };
  const saveLink = () => {
    const url = safeNoteUrl(linkUrl);
    if (!url) {
      Alert.alert("Check the link", "Enter a complete http or https address.");
      return;
    }
    if (panel === "text-link") {
      format("link", url);
      return;
    }
    if (active && active.attachments.length < 30)
      update({
        attachments: [
          ...active.attachments,
          {
            id: Crypto.randomUUID(),
            kind: "link",
            name: linkName.trim() || new URL(url).hostname,
            uri: url,
          },
        ],
      });
    setPanel(null);
  };
  const beginConversion = (kind: NoteLinkKind) => {
    if (!active) return;
    const destination = book.destinations.find(
      (item) =>
        item.kind === kind || (kind === "outline" && item.kind === "chapter"),
    );
    setConversion({
      kind,
      destinationId: destination?.id ?? (kind === "plot" ? "plotThread" : ""),
      title: noteTitle(active),
      content: notePlainText(active.content),
    });
    setConversionWarning("");
  };
  const commitConversion = () => {
    if (!active || !conversion || !onConvert) return;
    const duplicate = active.links.some(
      (link) =>
        link.converted &&
        link.kind === conversion.kind &&
        (link.targetId === conversion.destinationId ||
          ["scene", "task", "character"].includes(conversion.kind)),
    );
    if (duplicate && !conversionWarning) {
      setConversionWarning(
        "This note was already converted here. Choose “Create another” only if you want an additional item.",
      );
      return;
    }
    try {
      const link = onConvert(conversion, Crypto.randomUUID());
      update({ links: [...active.links, link] });
      setConversion(null);
      setPanel(null);
      Alert.alert(
        "Added to your book",
        "The original note is still here. Your manuscript has not been changed.",
      );
    } catch (caught) {
      Alert.alert(
        "Could not convert note",
        caught instanceof Error ? caught.message : "Please try again.",
      );
    }
  };
  const askLuna = async (action: (typeof lunaActions)[number]) => {
    if (!active?.content.trim() || lunaBusy) return;
    const noteId = active.id;
    const source = active.content;
    const token = ++lunaToken.current;
    setLunaBusy(true);
    setLunaResult("");
    setLunaError("");
    setLunaLabel(action.label);
    try {
      const request = {
        operation: action.operation,
        text: source,
        instruction: action.instruction,
        protectReserve: provider === "auto",
        context: {
          contextMode: "page" as const,
          projectTitle: book.title,
          projectType: book.type,
          chapterTitle: noteTitle(active),
        },
      };
      const resolved = await AIWritingService.resolveProvider(
        provider,
        request,
      );
      setCreditLabel(
        resolved === "device"
          ? "Phone AI · 0 Bookez credits"
          : "Bookez cloud · 1 credit",
      );
      const result = await AIWritingService.generate(request, resolved);
      if (resolved === "cloud") {
        if (result.usage)
          await saveCloudAIUsage(result.usage.month, result.usage.usedCredits);
        else await recordAIUsage(1, provider === "auto");
      }
      if (
        !mounted.current ||
        token !== lunaToken.current ||
        latestNote.current?.id !== noteId
      )
        return;
      const text =
        result.options?.[0] ||
        result.ideas
          ?.map((idea) => `## ${idea.title}\n${idea.detail}`)
          .join("\n\n") ||
        result.feedback ||
        "";
      if (!text.trim())
        throw new Error(
          "Luna returned no suggestions. Try a different action.",
        );
      setLunaResult(text);
    } catch (caught) {
      if (mounted.current && token === lunaToken.current)
        setLunaError(
          caught instanceof Error
            ? caught.message
            : "Luna could not complete this request.",
        );
    } finally {
      if (mounted.current && token === lunaToken.current) setLunaBusy(false);
    }
  };

  const panelTitle =
    panel === "organize"
      ? "Organize this note"
      : panel === "links"
        ? "Link to your book"
        : panel === "convert"
          ? "Convert to…"
          : panel === "luna"
            ? "Luna · note assistant"
            : panel === "destination"
              ? "Connected book item"
              : "Add a web link";
  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      statusBarTranslucent
      onRequestClose={() => {
        void close();
      }}
    >
      <View style={s.shade}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            void close();
          }}
          accessibilityLabel="Close notebook"
        />
        <View style={s.modalDock}>
          <Animated.View
            style={[
              s.sheet,
              { height: sheetHeight, maxWidth: width > 850 ? 850 : undefined },
              expanded && s.sheetExpanded,
            ]}
            accessibilityViewIsModal
          >
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.safe}>
            <SafeAreaView style={s.safe}>
              <View {...swipe.panHandlers} style={s.grabberArea}>
                <View style={s.grabber} />
              </View>
              <View style={s.header}>
                <View style={s.headerIcon}>
                  <NotebookMark size={30} />
                </View>
                <View style={s.headerCopy}>
                  <Text style={s.eyebrow}>BOOKEZ / PRIVATE NOTEBOOK</Text>
                  <Text numberOfLines={1} style={s.bookTitle}>
                    {book.title}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setExpanded(!expanded)}
                  style={s.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel={
                    expanded
                      ? "Collapse notebook"
                      : "Expand notebook to full screen"
                  }
                >
                  <Text style={s.iconText}>{expanded ? "↙" : "↗"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void close();
                  }}
                  disabled={closing}
                  style={[s.iconButton, closing && s.disabled]}
                  accessibilityRole="button"
                  accessibilityLabel={initialChapterId ? 'Close Notes and return to writing' : 'Close Notes and return to Library'}
                >
                  <Text style={s.closeText}>×</Text>
                </Pressable>
              </View>
              <View style={s.saveRow}>
                <Text style={s.saveText} accessibilityLiveRegion="polite">
                  {error
                    ? "Save needs attention"
                    : saving
                      ? "Saving…"
                      : loaded
                        ? "✓ Saved on this device"
                        : "Opening notebook…"}
                </Text>
                <Pressable
                  onPress={() => void store.sync()}
                  accessibilityRole="button"
                  accessibilityLabel="Retry notebook sync"
                >
                  <Text style={s.syncText}>
                    {sync === "synced"
                      ? "Cloud synced"
                      : sync === "syncing"
                        ? "Syncing…"
                        : sync === "offline"
                          ? "Cloud pending · retry"
                          : sync === "paused"
                            ? "Cloud backup paused"
                            : "Private notes"}
                  </Text>
                </Pressable>
              </View>
              {!!error && (
                <Pressable
                  style={s.error}
                  onPress={() => {
                    void (loaded ? store.flush() : store.load()).catch(
                      () => undefined,
                    );
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.errorText}>{error} Tap to retry.</Text>
                </Pressable>
              )}
              {!loaded ? (
                <View style={s.loading}>
                  <ActivityIndicator color={c.accent} />
                </View>
              ) : active ? (
                <>
                  <View style={s.editorNav}>
                    <Action
                      onPress={() => changeNote(null)}
                      disabled={lunaBusy}
                    >
                      ‹ All notes
                    </Action>
                    <View style={s.flex} />
                    <Action
                      onPress={() => setReading(!reading)}
                      active={reading}
                    >
                      {reading ? "Edit" : "Read & check"}
                    </Action>
                    <Action
                      onPress={() => update({ pinned: !active.pinned })}
                      active={active.pinned}
                    >
                      {active.pinned ? "Pinned" : "Pin"}
                    </Action>
                  </View>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={s.editorContent}
                  >
                    {active.status !== "active" && (
                      <View style={s.notice}>
                        <Text style={s.hint}>
                          {active.status === "trash"
                            ? "This note is in Trash. Restore it to keep working."
                            : "This note is archived."}
                        </Text>
                        <Action
                          onPress={() => update({ status: "active" })}
                          primary
                        >
                          Restore note
                        </Action>
                      </View>
                    )}
                    <TextInput
                      key={active.id}
                      autoFocus={active.id === freshNoteId}
                      editable={active.status === "active" && !lunaBusy}
                      value={active.title}
                      onChangeText={(title) => update({ title })}
                      placeholder="Give this thought a title…"
                      placeholderTextColor={c.cardTextSecondary}
                      maxLength={200}
                      style={s.titleInput}
                      accessibilityLabel="Note title"
                      onFocus={() => setExpanded(true)}
                    />
                    <View style={s.metadata}>
                      <Text style={s.metaText}>{active.category}</Text>
                      {active.folder ? (
                        <Text style={s.metaText}> / {active.folder}</Text>
                      ) : null}
                      <Text style={s.metaDate}>
                        Updated{" "}
                        {new Date(active.updatedAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </Text>
                    </View>
                    {active.tags.length > 0 && (
                      <View style={s.wrap}>
                        {active.tags.map((value) => (
                          <Text key={value} style={s.tag}>
                            #{value}
                          </Text>
                        ))}
                      </View>
                    )}
                    {reading ? (
                      <NoteReadingView
                        content={
                          active.content || "Your next idea starts here."
                        }
                        onChange={
                          active.status === "active"
                            ? (content) => update({ content })
                            : undefined
                        }
                      />
                    ) : (
                      <>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="always"
                          contentContainerStyle={s.formatRail}
                        >
                          {(
                            [
                              ["heading", "H"],
                              ["bold", "B"],
                              ["italic", "I"],
                              ["bullet", "•"],
                              ["number", "1."],
                              ["checklist", "☑"],
                              ["link", "↗"],
                            ] as Array<[NoteFormat, string]>
                          ).map(([kind, label]) => (
                            <Pressable
                              key={kind}
                              disabled={active.status !== "active" || lunaBusy}
                              onPress={() => {
                                if (kind === "link") {
                                  setLinkUrl("");
                                  setPanel("text-link");
                                } else format(kind);
                              }}
                              style={s.formatButton}
                              accessibilityRole="button"
                              accessibilityLabel={`Format ${kind}`}
                            >
                              <Text
                                style={[
                                  s.formatText,
                                  kind === "bold" && s.bold,
                                  kind === "italic" && s.italic,
                                ]}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          ))}
                          <Text style={s.formatHint}>
                            Formatting · preview in Read
                          </Text>
                        </ScrollView>
                        <View style={s.paper}>
                          <View pointerEvents="none" style={s.paperMargin} />
                          <DictationInput
                            ref={input}
                            editorial
                            dictationEnabled={
                              active.status === "active" && !lunaBusy
                            }
                            editable={active.status === "active" && !lunaBusy}
                            value={active.content}
                            onChangeText={(content) => update({ content })}
                            onSelectionChange={(event) =>
                              setSelection(event.nativeEvent.selection)
                            }
                            onFocus={() => setExpanded(true)}
                            placeholder="An idea, a question, a line you don’t want to lose…"
                            placeholderTextColor={c.cardTextSecondary}
                            multiline
                            maxLength={100_000}
                            style={s.bodyInput}
                            accessibilityLabel="Private note content"
                          />
                        </View>
                      </>
                    )}
                    {active.links.length > 0 && (
                      <View style={s.linkedSection}>
                        <Text style={s.label}>CONNECTED TO THIS BOOK</Text>
                        {active.links.map((link) => (
                          <View key={link.id} style={s.linkRow}>
                            <Text
                              style={s.linkLabel}
                              accessibilityRole="button"
                              onPress={() => {
                                setConnectedLink(link);
                                setPanel("destination");
                              }}
                            >
                              {link.converted ? "↗ Created" : "⌁ Linked"} ·{" "}
                              {link.label}
                            </Text>
                            <Pressable
                              onPress={() =>
                                update({
                                  links: active.links.filter(
                                    (item) => item.id !== link.id,
                                  ),
                                })
                              }
                              disabled={active.status !== "active"}
                              style={s.removeButton}
                              accessibilityLabel={`Unlink ${link.label}`}
                            >
                              <Text style={s.removeText}>×</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                    {active.attachments.length > 0 && (
                      <View style={s.linkedSection}>
                        <Text style={s.label}>REFERENCE ATTACHMENTS</Text>
                        {active.attachments.map((attachment) => (
                          <View key={attachment.id} style={s.attachment}>
                            <Pressable
                              style={s.attachmentOpen}
                              onPress={() => void openAttachment(attachment)}
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${attachment.name}`}
                            >
                              <Text style={s.attachmentIcon}>
                                {attachment.kind === "image"
                                  ? "▧"
                                  : attachment.kind === "link"
                                    ? "↗"
                                    : "▤"}
                              </Text>
                              <View style={s.flex}>
                                <Text
                                  numberOfLines={1}
                                  style={s.attachmentName}
                                >
                                  {attachment.name}
                                </Text>
                                <Text style={s.hint}>
                                  {attachment.kind === "link"
                                    ? new URL(attachment.uri!).hostname
                                    : attachment.storagePath
                                      ? "Private attachment · synced"
                                      : "Saved on this device"}
                                </Text>
                              </View>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                update({
                                  attachments: active.attachments.filter(
                                    (item) => item.id !== attachment.id,
                                  ),
                                })
                              }
                              disabled={active.status !== "active"}
                              style={s.removeButton}
                              accessibilityLabel={`Remove ${attachment.name} from note`}
                            >
                              <Text style={s.removeText}>×</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                    {active.status === "active" && (
                      <>
                        <View style={s.toolGrid}>
                          <Action
                            onPress={() => setPanel("organize")}
                            disabled={lunaBusy}
                          >
                            Organize
                          </Action>
                          <Action
                            onPress={() => setPanel("links")}
                            disabled={lunaBusy}
                          >
                            Link to chapter
                          </Action>
                          {onConvert && (
                            <Action
                              onPress={() => {
                                setConversion(null);
                                setPanel("convert");
                              }}
                              disabled={lunaBusy}
                            >
                              Convert to…
                            </Action>
                          )}
                          <Action
                            onPress={() => {
                              setPanel("luna");
                              setLunaResult("");
                            }}
                            disabled={lunaBusy}
                          >
                            ☾ Luna
                          </Action>
                        </View>
                        <View style={s.toolGrid}>
                          <Action
                            onPress={() => void attach("image")}
                            disabled={attachmentBusy || lunaBusy}
                          >
                            ＋ Image
                          </Action>
                          <Action
                            onPress={() => void attach("file")}
                            disabled={attachmentBusy || lunaBusy}
                          >
                            ＋ File
                          </Action>
                          <Action
                            onPress={() => {
                              setLinkUrl("");
                              setLinkName("");
                              setPanel("web-link");
                            }}
                            disabled={lunaBusy}
                          >
                            ＋ Web link
                          </Action>
                          {attachmentBusy && (
                            <ActivityIndicator color={c.accent} />
                          )}
                        </View>
                        <Text style={s.hint}>
                          Tap the microphone in your note to dictate an idea.
                        </Text>
                      </>
                    )}
                    <View style={s.footerActions}>
                      <Action
                        onPress={() =>
                          void Share.share({
                            title: noteTitle(active),
                            message: `${noteTitle(active)}\n\n${notePlainText(active.content)}`,
                          })
                        }
                      >
                        Share note
                      </Action>
                      {active.status === "active" && (
                        <Action
                          onPress={() => {
                            update({ status: "archived" });
                            changeNote(null);
                          }}
                        >
                          Archive
                        </Action>
                      )}
                      {active.status !== "trash" && (
                        <Action
                          disabled={lunaBusy}
                          onPress={() =>
                            Alert.alert(
                              "Move note to Trash?",
                              "You can restore it from this book’s Trash. Linked book content stays intact.",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Move to Trash",
                                  style: "destructive",
                                  onPress: () => {
                                    update({ status: "trash" });
                                    changeNote(null);
                                  },
                                },
                              ],
                            )
                          }
                        >
                          Trash
                        </Action>
                      )}
                    </View>
                  </ScrollView>
                </>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(note) => note.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={s.listContent}
                  ListHeaderComponent={
                    <>
                      <View style={s.listHeading}>
                        <View style={s.flex}>
                          <Text style={s.pageTitle}>
                            {chapterFilter ? "Chapter notes" : "My book notes"}
                          </Text>
                          <Text style={s.hint}>
                            {
                              notes.filter((note) => note.status === "active")
                                .length
                            }{" "}
                            {notes.filter((note) => note.status === 'active').length === 1 ? 'note' : 'notes'} · a little room for every thought
                          </Text>
                        </View>
                        <Action
                          primary
                          onPress={create}
                          label="Create a new note"
                        >
                          ＋ New Note
                        </Action>
                      </View>
                      {initialChapterId && (
                        <View style={[s.wrap, { marginBottom: 12 }]}>
                          <Action
                            active={Boolean(chapterFilter)}
                            onPress={() => setChapterFilter(initialChapterId)}
                          >
                            This chapter
                          </Action>
                          <Action
                            active={!chapterFilter}
                            onPress={() => setChapterFilter(undefined)}
                          >
                            All book notes
                          </Action>
                        </View>
                      )}
                      <View style={s.searchRow}>
                        <Text style={s.searchIcon}>⌕</Text>
                        <TextInput
                          value={query}
                          onChangeText={setQuery}
                          placeholder="Search titles, thoughts, tags…"
                          placeholderTextColor={c.cardTextSecondary}
                          style={s.searchInput}
                          accessibilityLabel="Search notes in this book"
                          clearButtonMode="while-editing"
                        />
                        <Pressable
                          onPress={() => setOrganize(!organize)}
                          style={s.filterButton}
                          accessibilityRole="button"
                          accessibilityLabel="Filter folders, tags, archive and trash"
                        >
                          <Text style={s.filterText}>☷</Text>
                        </Pressable>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.categoryRail}
                      >
                        {["All", ...NOTE_CATEGORIES].map((value) => (
                          <Action
                            key={value}
                            active={category === value}
                            onPress={() => setCategory(value)}
                          >
                            {value}
                          </Action>
                        ))}
                      </ScrollView>
                      {organize && (
                        <View style={s.filterPanel}>
                          <View style={s.wrap}>
                            {(
                              [
                                ["active", "Notes"],
                                ["archived", "Archive"],
                                ["trash", "Trash"],
                              ] as Array<[NoteStatus, string]>
                            ).map(([value, label]) => (
                              <Action
                                key={value}
                                active={status === value}
                                onPress={() => {
                                  setStatus(value);
                                  setFolder("");
                                  setTag("");
                                }}
                              >
                                {label}
                              </Action>
                            ))}
                          </View>
                          {folders.length > 0 && (
                            <>
                              <Text style={s.label}>FOLDERS</Text>
                              <View style={s.wrap}>
                                <Action
                                  active={!folder}
                                  onPress={() => setFolder("")}
                                >
                                  All folders
                                </Action>
                                {folders.map((value) => (
                                  <Action
                                    key={value}
                                    active={folder === value}
                                    onPress={() => setFolder(value)}
                                  >
                                    {value}
                                  </Action>
                                ))}
                              </View>
                            </>
                          )}
                          {tags.length > 0 && (
                            <>
                              <Text style={s.label}>TAGS</Text>
                              <View style={s.wrap}>
                                <Action
                                  active={!tag}
                                  onPress={() => setTag("")}
                                >
                                  All tags
                                </Action>
                                {tags.map((value) => (
                                  <Action
                                    key={value}
                                    active={tag === value}
                                    onPress={() => setTag(value)}
                                  >
                                    #{value}
                                  </Action>
                                ))}
                              </View>
                            </>
                          )}
                        </View>
                      )}
                      {status !== "active" && (
                        <Text style={s.collectionLabel}>
                          {status === "trash"
                            ? "TRASH · OPEN A NOTE TO RESTORE IT"
                            : "ARCHIVED NOTES"}
                        </Text>
                      )}
                    </>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        changeNote(item.id);
                        setExpanded(true);
                      }}
                      style={s.noteCard}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.pinned ? "Pinned: " : ""}${noteTitle(item)}`}
                    >
                      <View style={s.noteCardTop}>
                        <Text style={s.noteCategory}>
                          {item.category.toUpperCase()}
                        </Text>
                        <Text style={s.cardDate}>
                          {item.pinned
                            ? "⌁ PINNED"
                            : new Date(item.updatedAt).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                        </Text>
                      </View>
                      <Text numberOfLines={2} style={s.noteCardTitle}>
                        {noteTitle(item)}
                      </Text>
                      <Text numberOfLines={3} style={s.notePreview}>
                        {notePlainText(item.content) ||
                          "A fresh page, ready for a thought."}
                      </Text>
                      <View style={s.noteCardBottom}>
                        <Text numberOfLines={1} style={s.noteCardMeta}>
                          {[
                            item.folder,
                            item.links[0]?.label,
                            item.tags[0] ? `#${item.tags[0]}` : "",
                            item.attachments.length
                              ? `${item.attachments.length} attachments`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Private to this book"}
                        </Text>
                        <Text style={s.cardArrow}>↗</Text>
                      </View>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <View style={s.empty}>
                      <NotebookMark size={66} />
                      <Text style={s.emptyTitle}>
                        {query || category !== "All" || folder || tag
                          ? "No matching thoughts yet."
                          : status === "trash"
                            ? "Your Trash is empty."
                            : status === "archived"
                              ? "Nothing archived yet."
                              : "Every book starts with a thought."}
                      </Text>
                      <Text style={s.emptyHint}>
                        {status === "active"
                          ? "Save an idea, a detail, or a line of dialogue. It will be here when you need it."
                          : "Your original notes stay separate from the manuscript."}
                      </Text>
                      {status === "active" && (
                        <Action onPress={create} primary>
                          ＋ Capture a thought
                        </Action>
                      )}
                    </View>
                  }
                />
              )}
              {!!panel && !!active && (
                <View style={s.panelOverlay}>
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => {
                      if (!lunaBusy) {
                        setPanel(null);
                        setConversion(null);
                      }
                    }}
                  />
                  <View style={s.panel}>
                    <View style={s.panelHeader}>
                      <Text style={s.panelTitle}>{panelTitle}</Text>
                      <Pressable
                        onPress={() => {
                          if (!lunaBusy) {
                            setPanel(null);
                            setConversion(null);
                          }
                        }}
                        disabled={lunaBusy}
                        style={s.iconButton}
                        accessibilityLabel="Close note options"
                      >
                        <Text style={s.closeText}>×</Text>
                      </Pressable>
                    </View>
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={s.panelContent}
                    >
                      {panel === "destination" && connectedLink && (
                        <>
                          <Text style={s.label}>
                            {connectedLink.kind.toUpperCase()} ·{" "}
                            {connectedLink.converted
                              ? "CREATED FROM THIS NOTE"
                              : "LINKED REFERENCE"}
                          </Text>
                          <Text style={s.panelTitle}>
                            {book.destinations.find(
                              (item) => item.id === connectedLink.targetId,
                            )?.label ?? connectedLink.label}
                          </Text>
                          <NoteReadingView
                            content={
                              book.destinations.find(
                                (item) => item.id === connectedLink.targetId,
                              )?.detail ||
                              "This note is linked to this part of your book. Open the existing Notes tool while writing to use it as a reference."
                            }
                          />
                        </>
                      )}
                      {panel === "organize" && (
                        <>
                          <Text style={s.label}>CATEGORY</Text>
                          <View style={s.wrap}>
                            {NOTE_CATEGORIES.map((value) => (
                              <Action
                                key={value}
                                active={active.category === value}
                                onPress={() => update({ category: value })}
                              >
                                {value}
                              </Action>
                            ))}
                          </View>
                          <Text style={s.label}>FOLDER</Text>
                          <TextInput
                            value={active.folder}
                            onChangeText={(value) => update({ folder: value })}
                            maxLength={80}
                            placeholder="e.g. Act 2"
                            placeholderTextColor={c.cardTextSecondary}
                            style={s.field}
                            accessibilityLabel="Note folder"
                          />
                          <Text style={s.label}>
                            TAGS · SEPARATE WITH COMMAS
                          </Text>
                          <TagsInput
                            key={active.id}
                            tags={active.tags}
                            onChange={(value) =>
                              update({ tags: noteTags(value) })
                            }
                          />
                          <Text style={s.hint}>
                            Folders and tags belong only to this book’s
                            notebook.
                          </Text>
                          <Action primary onPress={() => setPanel(null)}>
                            Done
                          </Action>
                        </>
                      )}
                      {panel === "links" && (
                        <>
                          <Text style={s.hint}>
                            Keep one note connected to several parts of your
                            book. Chapter links appear in the existing Write →
                            Notes tool.
                          </Text>
                          {book.destinations.map((destination) => {
                            const linked = active.links.some(
                              (link) =>
                                link.targetId === destination.id &&
                                !link.converted,
                            );
                            return (
                              <Pressable
                                key={`${destination.kind}:${destination.id}`}
                                style={s.destination}
                                onPress={() =>
                                  update({
                                    links: linked
                                      ? active.links.filter(
                                          (link) =>
                                            link.converted ||
                                            link.targetId !== destination.id,
                                        )
                                      : [
                                          ...active.links,
                                          {
                                            id: Crypto.randomUUID(),
                                            kind: destination.kind,
                                            targetId: destination.id,
                                            label: destination.label,
                                          },
                                        ],
                                  })
                                }
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: linked }}
                              >
                                <View style={s.flex}>
                                  <Text style={s.destinationTitle}>
                                    {destination.label}
                                  </Text>
                                  <Text style={s.hint}>{destination.kind}</Text>
                                </View>
                                <Text style={s.destinationCheck}>
                                  {linked ? "✓" : "＋"}
                                </Text>
                              </Pressable>
                            );
                          })}
                          <Action primary onPress={() => setPanel(null)}>
                            Done
                          </Action>
                        </>
                      )}
                      {panel === "convert" &&
                        (!conversion ? (
                          <>
                            <Text style={s.hint}>
                              Preview before adding anything. The original note
                              stays in your notebook.
                            </Text>
                            {conversionKinds.map((item) => (
                              <Pressable
                                key={item.kind}
                                onPress={() => beginConversion(item.kind)}
                                style={s.destination}
                              >
                                <View style={s.flex}>
                                  <Text style={s.destinationTitle}>
                                    {item.label}
                                  </Text>
                                  <Text style={s.hint}>{item.hint}</Text>
                                </View>
                                <Text style={s.cardArrow}>›</Text>
                              </Pressable>
                            ))}
                          </>
                        ) : (
                          <>
                            <Action onPress={() => setConversion(null)}>
                              ‹ Choose another type
                            </Action>
                            <Text style={s.label}>
                              PREVIEW ·{" "}
                              {conversionKinds
                                .find((item) => item.kind === conversion.kind)
                                ?.label.toUpperCase()}
                            </Text>
                            <TextInput
                              value={conversion.title}
                              onChangeText={(title) =>
                                setConversion({ ...conversion, title })
                              }
                              style={s.field}
                              placeholder="Title"
                              accessibilityLabel="Converted item title"
                            />
                            <TextInput
                              value={conversion.content}
                              onChangeText={(content) =>
                                setConversion({ ...conversion, content })
                              }
                              multiline
                              style={[s.field, s.previewEditor]}
                              accessibilityLabel="Converted item content"
                            />
                            {["outline", "plot"].includes(conversion.kind) && (
                              <>
                                <Text style={s.label}>DESTINATION</Text>
                                {book.destinations
                                  .filter((item) =>
                                    conversion.kind === "outline"
                                      ? item.kind === "chapter"
                                      : item.kind === "plot",
                                  )
                                  .map((item) => (
                                    <Action
                                      key={item.id}
                                      active={
                                        conversion.destinationId === item.id
                                      }
                                      onPress={() =>
                                        setConversion({
                                          ...conversion,
                                          destinationId: item.id,
                                        })
                                      }
                                    >
                                      {item.label}
                                    </Action>
                                  ))}
                              </>
                            )}
                            <Text style={s.hint}>
                              Direct conversion uses 0 AI credits. Your
                              manuscript stays intact.
                            </Text>
                            {conversionWarning ? (
                              <Text style={s.warning}>{conversionWarning}</Text>
                            ) : null}
                            <Action
                              primary
                              disabled={
                                (!conversion.title.trim() &&
                                  !conversion.content.trim()) ||
                                (conversion.kind === "outline" &&
                                  !conversion.destinationId)
                              }
                              onPress={commitConversion}
                            >
                              {conversionWarning
                                ? "Create another"
                                : "Confirm & create"}
                            </Action>
                          </>
                        ))}
                      {(panel === "web-link" || panel === "text-link") && (
                        <>
                          <Text style={s.hint}>
                            {panel === "text-link"
                              ? "Turn the selected note text into a hyperlink."
                              : "Keep a source or inspiration beside this note."}
                          </Text>
                          {panel === "web-link" && (
                            <TextInput
                              value={linkName}
                              onChangeText={setLinkName}
                              placeholder="Link title (optional)"
                              style={s.field}
                              accessibilityLabel="Reference link title"
                            />
                          )}
                          <TextInput
                            autoFocus
                            value={linkUrl}
                            onChangeText={setLinkUrl}
                            placeholder="https://…"
                            autoCapitalize="none"
                            keyboardType="url"
                            style={s.field}
                            accessibilityLabel="Reference web address"
                          />
                          <Action primary onPress={saveLink}>
                            Add link
                          </Action>
                        </>
                      )}
                      {panel === "luna" && (
                        <>
                          <Text style={s.hint}>
                            Luna works only with this note. Review suggestions
                            before adding them.
                          </Text>
                          <View style={s.wrap}>
                            {(
                              [
                                ["auto", "Phone first"],
                                ["device", "Phone only"],
                                ["cloud", "Bookez credits"],
                              ] as Array<[AIProviderPreference, string]>
                            ).map(([value, label]) => (
                              <Action
                                key={value}
                                active={provider === value}
                                disabled={lunaBusy}
                                onPress={() => setProvider(value)}
                              >
                                {label}
                              </Action>
                            ))}
                          </View>
                          <Text style={s.hint}>
                            Phone AI: 0 credits. Cloud: 1 credit per action from
                            your existing monthly allowance.{" "}
                            {aiUsageRefillLabel()}.
                          </Text>
                          <View style={s.wrap}>
                            {lunaActions.map((action) => (
                              <Action
                                key={action.label}
                                disabled={lunaBusy || !active.content.trim()}
                                onPress={() => void askLuna(action)}
                              >
                                {action.label}
                              </Action>
                            ))}
                          </View>
                          {lunaBusy && (
                            <View style={s.lunaLoading}>
                              <ActivityIndicator color={c.accent} />
                              <Text style={s.hint}>
                                Luna is thinking about your note…
                              </Text>
                              <Action onPress={stopLuna}>Stop</Action>
                            </View>
                          )}
                          {!!creditLabel && (
                            <Text style={s.label}>{creditLabel}</Text>
                          )}
                          {!!lunaError && (
                            <Text style={s.warning}>{lunaError}</Text>
                          )}
                          {!!lunaResult && (
                            <>
                              <Text style={s.label}>
                                {lunaLabel.toUpperCase()} · PREVIEW
                              </Text>
                              <NoteReadingView content={lunaResult} />
                              <Action
                                primary
                                onPress={() => {
                                  const note = store.create(active.category);
                                  store.update(note.id, {
                                    title: `${noteTitle(active)} · ${lunaLabel.toLowerCase()}`,
                                    content: lunaResult,
                                    folder: active.folder,
                                    tags: [...active.tags],
                                    links: active.links
                                      .filter((link) => !link.converted)
                                      .map((link) => ({
                                        ...link,
                                        id: Crypto.randomUUID(),
                                      })),
                                  });
                                  changeNote(note.id);
                                }}
                              >
                                Save as a new note
                              </Action>
                              <Action
                                onPress={() => {
                                  update({
                                    content: `${active.content}\n\n${lunaResult}`,
                                  });
                                  setPanel(null);
                                }}
                              >
                                Append to this note
                              </Action>
                            </>
                          )}
                        </>
                      )}
                    </ScrollView>
                  </View>
                </View>
              )}
              {!!imagePreview && (
                <View style={s.imageOverlay}>
                  <Pressable
                    onPress={() => setImagePreview(null)}
                    style={s.imageClose}
                    accessibilityLabel="Close image preview"
                  >
                    <Text style={s.onAccent}>Close image ×</Text>
                  </Pressable>
                  <Image
                    source={{ uri: imagePreview }}
                    style={s.imagePreview}
                    resizeMode="contain"
                  />
                </View>
              )}
            </SafeAreaView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function TagsInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(tags.join(", "));
  return (
    <TextInput
      value={value}
      onChangeText={(text) => {
        setValue(text);
        onChange(text);
      }}
      placeholder="Mystery, Character arc"
      placeholderTextColor={c.cardTextSecondary}
      style={s.field}
      accessibilityLabel="Note tags separated by commas"
    />
  );
}

/** Rendered only after opening the existing Notes tool; no resting Write layout changes. */
export function LinkedBookNotes({
  ownerId,
  book,
  chapterId,
  onConvert,
}: {
  ownerId: string | null;
  book: NotebookBook;
  chapterId: string;
  onConvert?: Props["onConvert"];
}) {
  const { notes, store } = useBookNotes(ownerId, book.id);
  const [open, setOpen] = useState(false);
  const [noteId, setNoteId] = useState<string | undefined>();
  const linked = filterBookNotes(notes, book.id, { linkedTo: chapterId });
  return (
    <View style={s.linkedSection}>
      <View style={s.linkedHeading}>
        <Text style={s.label}>BOOK NOTEBOOK · {linked.length} LINKED</Text>
        <Action
          onPress={() => {
            setNoteId(undefined);
            setOpen(true);
          }}
        >
          Open notebook
        </Action>
      </View>
      {linked.map((note) => (
        <View key={note.id} style={s.linkedNote}>
          <Pressable
            onPress={() => {
              setNoteId(note.id);
              setOpen(true);
            }}
            accessibilityRole="button"
          >
            <Text style={s.destinationTitle}>{noteTitle(note)}</Text>
          </Pressable>
          <Text numberOfLines={3} style={s.hint}>
            {notePlainText(note.content)}
          </Text>
        </View>
      ))}
      {!linked.length && (
        <Text style={s.hint}>
          Link a book note to this chapter to keep it beside your writing.
        </Text>
      )}
      {open && (
        <BookNotebook
          ownerId={ownerId}
          book={book}
          initialNoteId={noteId}
          initialChapterId={chapterId}
          onClose={() => setOpen(false)}
          onConvert={onConvert}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  libraryButton: {
    position: "absolute",
    right: 3,
    top: 0,
    bottom: 0,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.cardBorder,
  },
  libraryButtonText: { color: c.accent, fontSize: 9, fontWeight: "700" },
  shade: {
    flex: 1,
    backgroundColor: "rgba(19,36,61,0.42)",
    justifyContent: "flex-end",
  },
  modalDock: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
    maxHeight: "100%",
  },
  sheet: {
    width: "100%",
    backgroundColor: c.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: c.shadowWarm,
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 12,
  },
  sheetExpanded: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  safe: { flex: 1 },
  grabberArea: { height: 21, alignItems: "center", justifyContent: "center" },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 3,
    backgroundColor: c.cardBorder,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    gap: 8,
  },
  headerIcon: {
    width: 42,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: c.secondaryAccent,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  bookTitle: {
    color: c.textPrimary,
    fontFamily: bookezType.sectionTitle.fontFamily,
    fontSize: 18,
    lineHeight: 24,
    marginTop: 3,
  },
  iconButton: {
    width: 36,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: c.surfaceMuted,
  },
  iconText: { color: c.accent, fontSize: 19 },
  closeText: { color: c.accent, fontSize: 25, lineHeight: 28 },
  saveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.cardBorder,
  },
  saveText: { color: c.cardTextSecondary, fontSize: 10 },
  syncText: { color: c.secondaryAccent, fontSize: 10 },
  flex: { flex: 1, minWidth: 0 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 20, paddingBottom: 45 },
  listHeading: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  pageTitle: {
    color: c.textPrimary,
    fontFamily: bookezType.sectionTitle.fontFamily,
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 5,
  },
  hint: { color: c.cardTextSecondary, fontSize: 11, lineHeight: 17 },
  action: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { color: c.textPrimary, fontSize: 11, fontWeight: "700" },
  actionActive: { backgroundColor: c.accent, borderColor: c.accent },
  primary: { backgroundColor: c.accentStrong, borderColor: c.accentStrong },
  onAccent: { color: c.textOnAccent },
  disabled: { opacity: 0.45 },
  searchRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    borderRadius: 13,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchIcon: { color: c.accent, fontSize: 24, marginRight: 8 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: c.textPrimary,
    fontSize: 12,
    paddingVertical: 10,
  },
  filterButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: { color: c.accent, fontSize: 22 },
  categoryRail: { gap: 6, paddingVertical: 14, paddingRight: 8 },
  filterPanel: {
    gap: 12,
    padding: 12,
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: c.surfaceMuted,
  },
  collectionLabel: {
    color: c.cardTextSecondary,
    fontSize: 9,
    letterSpacing: 0.7,
    marginBottom: 14,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  noteCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 15,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderLeftWidth: 3,
    shadowColor: c.shadowWarm,
    shadowOpacity: 0.08,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  noteCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 9,
  },
  noteCategory: {
    color: c.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardDate: { color: c.cardTextSecondary, fontSize: 9 },
  noteCardTitle: {
    color: c.textPrimary,
    fontFamily: bookezType.sectionTitle.fontFamily,
    fontSize: 20,
    lineHeight: 25,
  },
  notePreview: {
    color: c.cardTextSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
  noteCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.cardBorder,
  },
  noteCardMeta: { flex: 1, color: c.cardTextSecondary, fontSize: 10 },
  cardArrow: { color: c.accent, fontSize: 18, marginLeft: 8 },
  empty: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 15,
  },
  emptyTitle: {
    color: c.textPrimary,
    fontFamily: bookezType.sectionTitle.fontFamily,
    fontSize: 23,
    textAlign: "center",
  },
  emptyHint: {
    color: c.cardTextSecondary,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 270,
  },
  editorNav: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
  },
  editorContent: { padding: 20, paddingBottom: 45 },
  titleInput: {
    color: c.textPrimary,
    fontFamily: bookezType.sectionTitle.fontFamily,
    fontSize: 27,
    lineHeight: 34,
    paddingVertical: 8,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  metaText: { color: c.accent, fontSize: 11, fontWeight: "700" },
  metaDate: { color: c.cardTextSecondary, fontSize: 9, marginLeft: "auto" },
  tag: {
    color: c.cardTextSecondary,
    fontSize: 10,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  formatRail: { alignItems: "center", gap: 5, paddingVertical: 12 },
  formatButton: {
    minWidth: 32,
    height: 34,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.card,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.cardBorder,
  },
  formatText: { color: c.textPrimary, fontSize: 14 },
  formatHint: { color: c.cardTextSecondary, fontSize: 9, marginLeft: 8 },
  paper: {
    position: "relative",
    backgroundColor: c.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: c.border,
    minHeight: 230,
    padding: 15,
    paddingLeft: 22,
  },
  paperMargin: {
    position: "absolute",
    left: 14,
    top: 15,
    bottom: 15,
    width: StyleSheet.hairlineWidth,
    backgroundColor: c.cardBorder,
    opacity: 0.5,
  },
  bodyInput: {
    minHeight: 230,
    color: c.textPrimary,
    fontSize: 16,
    lineHeight: 26,
    textAlignVertical: "top",
    paddingBottom: 35,
  },
  reading: { paddingVertical: 12, gap: 4 },
  readText: { color: c.textPrimary, fontSize: 15, lineHeight: 25 },
  readHeading: {
    color: c.textPrimary,
    fontFamily: bookezType.sectionTitle.fontFamily,
    fontSize: 21,
    lineHeight: 28,
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "600",
  },
  readHeadingLarge: { fontSize: 25, lineHeight: 31 },
  bold: { fontWeight: "800" },
  italic: { fontStyle: "italic" },
  inlineLink: { color: c.accent, textDecorationLine: "underline" },
  checkRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  checkbox: {
    width: 23,
    height: 23,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: c.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  checkboxDone: { backgroundColor: c.accent, borderColor: c.accent },
  checkmark: { color: c.textOnAccent, fontSize: 14 },
  checkText: { flex: 1 },
  checkedText: {
    color: c.cardTextSecondary,
    textDecorationLine: "line-through",
  },
  bullet: { color: c.accent, fontSize: 15, lineHeight: 25, minWidth: 22 },
  linkedSection: {
    marginTop: 20,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.cardBorder,
  },
  linkedHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: c.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginVertical: 9,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingLeft: 11,
    minHeight: 39,
    borderRadius: 10,
    backgroundColor: c.surfaceMuted,
  },
  linkLabel: { flex: 1, color: c.textPrimary, fontSize: 11 },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: c.accent, fontSize: 20 },
  attachment: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 8,
    borderRadius: 11,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.cardBorder,
  },
  attachmentOpen: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  attachmentIcon: { color: c.accent, fontSize: 25 },
  attachmentName: { color: c.textPrimary, fontSize: 12, fontWeight: "700" },
  toolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 15,
    marginBottom: 5,
  },
  footerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 25,
  },
  panelOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    backgroundColor: "rgba(19,36,61,0.3)",
  },
  panel: {
    maxHeight: "88%",
    backgroundColor: c.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: c.cardBorder,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 17,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.cardBorder,
  },
  panelTitle: {
    color: c.textPrimary,
    fontFamily: bookezType.sectionTitle.fontFamily,
    fontSize: 22,
  },
  panelContent: { padding: 20, gap: 12, paddingBottom: 30 },
  field: {
    color: c.textPrimary,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 11,
    minHeight: 44,
    padding: 12,
    fontSize: 14,
  },
  previewEditor: {
    minHeight: 130,
    maxHeight: 240,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  destination: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  destinationTitle: {
    color: c.textPrimary,
    fontFamily: bookezType.sectionTitle.fontFamily,
    fontSize: 16,
    lineHeight: 22,
  },
  destinationCheck: { color: c.accent, fontSize: 20 },
  warning: {
    color: c.accent,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: c.accentSoft,
    padding: 12,
    borderRadius: 10,
  },
  lunaLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 12,
  },
  error: {
    padding: 12,
    backgroundColor: c.destructiveSoft,
    margin: 12,
    borderRadius: 12,
  },
  errorText: { color: c.accent, fontSize: 12, lineHeight: 18 },
  notice: {
    backgroundColor: c.card,
    padding: 13,
    borderRadius: 12,
    gap: 9,
    marginBottom: 15,
  },
  linkedNote: {
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.cardBorder,
    padding: 12,
    marginTop: 9,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: c.textPrimary,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  imagePreview: { width: "100%", height: "80%" },
  imageClose: {
    position: "absolute",
    right: 20,
    top: 25,
    padding: 15,
    zIndex: 2,
  },
});
