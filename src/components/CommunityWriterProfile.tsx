import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

const C = { ink: '#2E3152', muted: '#797C9B', periwinkle: '#7068C9', lavender: '#BDB7EA', gold: '#B78736', cream: '#FBFAFF' };

export type CommunityWriterBook = {
  id: string;
  title: string | null;
  genre: string | null;
  projectType: string | null;
  completionPercent: number | null;
  stage: string | null;
  publicStatus: string | null;
  completed: boolean;
  finishedLabel: string | null;
  coverColor: string;
  coverImagePath: string | null;
  coverImageUri?: string;
  updatedAt?: string;
};

export type CommunityWriterStats = {
  booksWritten: number;
  wordsWritten: number;
  booksCompleted: number;
  followers: number;
  following: number;
};

export type CommunityWriterProfile = {
  userId: string;
  displayName: string;
  bio: string | null;
  avatarInitials: string | null;
  avatarPath: string | null;
  avatarImageUri?: string;
  joinedAt: string | null;
  isSelf: boolean;
  isPublic: boolean;
  isFollowing: boolean;
  books: CommunityWriterBook[];
  stats: CommunityWriterStats;
  demo?: boolean;
};

export type CommunityWriterFallback = {
  userId: string;
  displayName: string;
  bio?: string | null;
  avatarInitials?: string | null;
  avatarImageUri?: string;
  avatarColor: string;
  demo?: boolean;
  book?: {
    id: string;
    title?: string | null;
    genre?: string | null;
    projectType?: string | null;
    completionPercent?: number | null;
    stage?: string | null;
    publicStatus?: string | null;
    completed?: boolean;
    finishedLabel?: string | null;
    coverColor?: string;
    coverImageUri?: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function normalizeBook(value: unknown, index: number): CommunityWriterBook | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = asString(row.project_id) ?? asString(row.id);
  if (!id) return null;
  return {
    id,
    title: asString(row.project_title) ?? asString(row.title),
    genre: asString(row.genre),
    projectType: asString(row.project_type) ?? asString(row.projectType),
    completionPercent: row.completion_percent === null || row.completionPercent === null ? null : asNumber(row.completion_percent ?? row.completionPercent, 0),
    stage: asString(row.stage),
    publicStatus: asString(row.public_status) ?? asString(row.publicStatus),
    completed: asBoolean(row.completed),
    finishedLabel: asString(row.finished_label) ?? asString(row.finishedLabel),
    coverColor: asString(row.cover_color) ?? '#5B638E',
    coverImagePath: asString(row.cover_image_path),
    updatedAt: asString(row.updated_at) ?? asString(row.updatedAt) ?? undefined,
  };
}

export function normalizeCommunityWriterProfile(value: unknown): CommunityWriterProfile | null {
  const row = asRecord(value);
  if (!row) return null;
  const userId = asString(row.user_id) ?? asString(row.userId);
  if (!userId) return null;
  const statsRow = asRecord(row.stats);
  const books = Array.isArray(row.books) ? row.books.map(normalizeBook).filter((book): book is CommunityWriterBook => Boolean(book)) : [];
  return {
    userId,
    displayName: asString(row.display_name) ?? asString(row.displayName) ?? 'Bookez writer',
    bio: asString(row.bio),
    avatarInitials: asString(row.avatar_initials) ?? asString(row.avatarInitials),
    avatarPath: asString(row.avatar_path) ?? asString(row.avatarPath),
    joinedAt: asString(row.joined_at) ?? asString(row.joinedAt),
    isSelf: asBoolean(row.is_self ?? row.isSelf),
    isPublic: asBoolean(row.is_public ?? row.isPublic),
    isFollowing: asBoolean(row.is_following ?? row.isFollowing),
    books,
    stats: {
      booksWritten: asNumber(statsRow?.books_written ?? statsRow?.booksWritten, books.length),
      wordsWritten: asNumber(statsRow?.words_written ?? statsRow?.wordsWritten),
      booksCompleted: asNumber(statsRow?.books_completed ?? statsRow?.booksCompleted),
      followers: asNumber(statsRow?.followers),
      following: asNumber(statsRow?.following),
    },
  };
}

function fallbackProfile(fallback: CommunityWriterFallback): CommunityWriterProfile {
  const book = fallback.book;
  const books = book ? [{
    id: book.id,
    title: book.title ?? null,
    genre: book.genre ?? null,
    projectType: book.projectType ?? null,
    completionPercent: book.completionPercent ?? null,
    stage: book.stage ?? null,
    publicStatus: book.publicStatus ?? null,
    completed: Boolean(book.completed),
    finishedLabel: book.finishedLabel ?? null,
    coverColor: book.coverColor ?? '#5B638E',
    coverImagePath: null,
    coverImageUri: book.coverImageUri,
  }] : [];
  return {
    userId: fallback.userId,
    displayName: fallback.displayName,
    bio: fallback.bio ?? null,
    avatarInitials: fallback.avatarInitials ?? null,
    avatarPath: null,
    avatarImageUri: fallback.avatarImageUri,
    joinedAt: null,
    isSelf: false,
    isPublic: true,
    isFollowing: false,
    books,
    stats: { booksWritten: books.length, wordsWritten: 0, booksCompleted: books.filter((entry) => entry.completed).length, followers: 0, following: 0 },
    demo: fallback.demo,
  };
}

async function resolveProfileAssets(profile: CommunityWriterProfile): Promise<CommunityWriterProfile> {
  const avatar = profile.avatarPath ? await supabase.storage.from('bookez-files').createSignedUrl(profile.avatarPath, 60 * 60) : null;
  const books = await Promise.all(profile.books.map(async (book) => {
    if (!book.coverImagePath) return book;
    const cover = await supabase.storage.from('bookez-files').createSignedUrl(book.coverImagePath, 60 * 60);
    return cover.data?.signedUrl ? { ...book, coverImageUri: cover.data.signedUrl } : book;
  }));
  return { ...profile, ...(avatar?.data?.signedUrl ? { avatarImageUri: avatar.data.signedUrl } : {}), books };
}

async function fetchWriterProfile(userId: string): Promise<CommunityWriterProfile> {
  const { data, error } = await supabase.rpc('get_community_writer_profile', { p_user_id: userId });
  if (error) throw error;
  const profile = normalizeCommunityWriterProfile(data);
  if (!profile) throw new Error('Writer profile unavailable');
  return resolveProfileAssets(profile);
}

function joinedLabel(date: string | null): string {
  if (!date) return 'Bookez writer';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Bookez writer' : `Member since ${parsed.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
}

function formatCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(Math.max(0, Math.round(value)));
}

function WriterAvatar({ profile, large = false }: { profile: CommunityWriterProfile; large?: boolean }) {
  const initials = profile.avatarInitials ?? (profile.displayName.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'W');
  return <View style={[wS.avatar, large && wS.avatarLarge]}>{profile.avatarImageUri ? <Image source={{ uri: profile.avatarImageUri }} style={wS.avatarImage} resizeMode="cover" /> : <Text style={[wS.avatarText, large && wS.avatarTextLarge]}>{initials}</Text>}</View>;
}

function WriterBookCard({ book, compact = false }: { book: CommunityWriterBook; compact?: boolean }) {
  const title = book.title?.trim() || 'Untitled project';
  const progress = Math.max(0, Math.min(100, book.completionPercent ?? 0));
  return <View style={[wS.bookCard, compact && wS.bookCardCompact]}><View style={[wS.bookCover, compact && wS.bookCoverCompact, { backgroundColor: book.coverColor }]}>{book.coverImageUri ? <Image source={{ uri: book.coverImageUri }} style={wS.bookCoverImage} resizeMode="cover" /> : <><Text style={wS.bookCoverMark}>{title.slice(0, 1).toUpperCase()}</Text><Text style={wS.bookCoverLabel}>{book.genre ?? 'BOOK'}</Text></>}</View><Text numberOfLines={2} style={[wS.bookTitle, compact && wS.bookTitleCompact]}>{title}</Text><Text numberOfLines={1} style={wS.bookMeta}>{book.genre ?? book.projectType ?? book.stage ?? 'Writing project'}</Text><View style={wS.bookProgressTrack}><View style={[wS.bookProgressFill, { width: `${Math.max(progress, progress ? 2 : 0)}%`, backgroundColor: book.completed ? C.gold : C.periwinkle }]} /></View><Text style={wS.bookProgressText}>{book.completed ? book.finishedLabel ?? 'Completed' : `${Math.round(progress)}% in progress`}</Text></View>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={wS.stat}><Text style={wS.statValue}>{value}</Text><Text style={wS.statLabel}>{label}</Text></View>;
}

export function WriterProfileSummaryCard({ userId, refreshKey, onEdit }: { userId: string | null; refreshKey?: string; onEdit?: () => void }) {
  const [profile, setProfile] = useState<CommunityWriterProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) { setProfile(null); setLoading(false); return; }
    let active = true;
    setLoading(true); setError('');
    void fetchWriterProfile(userId).then((next) => { if (active) setProfile(next); }).catch(() => { if (active) setError('Your public profile is not ready yet.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey, userId]);

  if (!userId) return null;
  return <View style={wS.summaryCard}><View style={wS.summaryHeader}><View style={wS.summaryHeaderCopy}><Text style={wS.overline}>PUBLIC PROFILE</Text><Text style={wS.summaryTitle}>{profile?.displayName ?? 'Your writing profile'}</Text></View>{onEdit && <Pressable onPress={onEdit} style={wS.editButton} accessibilityRole="button"><Text style={wS.editButtonText}>Edit</Text></Pressable>}</View>{loading && !profile ? <View style={wS.summaryLoading}><ActivityIndicator color={C.periwinkle} /><Text style={wS.summaryLoadingText}>Gathering your public writing…</Text></View> : error ? <Text style={wS.summaryError}>{error}</Text> : profile ? <><Text style={wS.summaryBio}>{profile.bio || 'Add a short bio so other writers know what kind of work you enjoy making.'}</Text><Text style={wS.joined}>{joinedLabel(profile.joinedAt)}</Text><View style={wS.statsRow}><Stat value={String(profile.stats.booksWritten)} label="Public books" /><Stat value={String(profile.stats.followers)} label="Followers" /><Stat value={String(profile.stats.following)} label="Following" /></View><Text style={wS.summaryStatLine}>{formatCount(profile.stats.wordsWritten)} words shared · {profile.stats.booksCompleted} completed</Text>{profile.books.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={wS.bookRail}>{profile.books.map((book) => <WriterBookCard key={book.id} book={book} compact />)}</ScrollView> : <View style={wS.empty}><Text style={wS.emptyTitle}>Your public shelf is empty</Text><Text style={wS.emptyCopy}>Choose a book in Community sharing when you’re ready for it to appear here.</Text></View>}</> : null}</View>;
}

export function WriterProfileSheet({ visible, userId, viewerId, fallback, onClose, onFollowChanged }: { visible: boolean; userId: string | null; viewerId: string | null; fallback?: CommunityWriterFallback | null; onClose: () => void; onFollowChanged?: (userId: string, following: boolean) => void }) {
  const [profile, setProfile] = useState<CommunityWriterProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState('');
  const isSelf = Boolean(profile && viewerId && profile.userId === viewerId);

  useEffect(() => {
    if (!visible || !userId) { if (!visible) setProfile(null); return; }
    let active = true;
    const fallbackWriter = fallback && fallback.userId === userId ? fallbackProfile(fallback) : null;
    if (fallbackWriter) setProfile(fallbackWriter);
    setLoading(!fallbackWriter); setError('');
    if (fallback?.demo) { setLoading(false); return () => { active = false; }; }
    void fetchWriterProfile(userId).then((next) => { if (active) setProfile(next); }).catch(() => { if (active) setError('This writer profile is unavailable right now.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fallback?.demo, fallback?.userId, fallback?.book?.id, userId, visible]);

  const toggleFollow = async () => {
    if (!profile || isSelf || followBusy) return;
    if (!viewerId) { Alert.alert('Sign in to follow writers', 'You can browse the writing room without an account. Sign in when you want to follow someone.'); return; }
    if (profile.demo) { Alert.alert('Sign in to follow writers', 'This preview writer is here to show how Community works. Sign in to follow real Bookez writers.'); return; }
    const following = !profile.isFollowing;
    setFollowBusy(true);
    const { data, error: followError } = await supabase.rpc('set_community_follow', { p_following_id: profile.userId, p_follow: following });
    setFollowBusy(false);
    if (followError || (following && data !== true)) { Alert.alert('Could not update your follows', 'Please try again in a moment.'); return; }
    setProfile((current) => current ? { ...current, isFollowing: following, stats: { ...current.stats, followers: Math.max(0, current.stats.followers + (following ? 1 : -1)) } } : current);
    onFollowChanged?.(profile.userId, following);
  };

  if (!visible || !userId) return null;
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={wS.shade}><Pressable style={wS.dismiss} onPress={onClose} /><View style={wS.sheet}><View style={wS.handle} /><View style={wS.sheetHeader}><View><Text style={wS.overline}>COMMUNITY / WRITER</Text><Text style={wS.sheetKicker}>A closer look at their writing</Text></View><Pressable onPress={onClose} style={wS.closeButton} accessibilityLabel="Close writer profile"><Text style={wS.closeText}>×</Text></Pressable></View>{loading && !profile ? <View style={wS.loading}><ActivityIndicator color={C.periwinkle} /><Text style={wS.loadingText}>Opening writer profile…</Text></View> : error && !profile ? <View style={wS.errorState}><Text style={wS.errorTitle}>Profile unavailable</Text><Text style={wS.errorCopy}>{error}</Text><Pressable onPress={onClose} style={wS.primaryButton}><Text style={wS.primaryButtonText}>Done</Text></Pressable></View> : profile ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={wS.sheetContent}><View style={wS.identity}><WriterAvatar profile={profile} large /><View style={wS.identityCopy}><Text numberOfLines={2} style={wS.name}>{profile.displayName}</Text><Text style={wS.joined}>{joinedLabel(profile.joinedAt)}</Text></View></View><Text style={wS.bio}>{profile.bio || `${profile.displayName} is making steady progress, one page at a time.`}</Text>{isSelf ? <View style={wS.selfPill}><Text style={wS.selfPillText}>This is your profile</Text></View> : <Pressable onPress={() => void toggleFollow()} disabled={followBusy} style={[wS.followButton, profile.isFollowing && wS.followingButton, followBusy && wS.disabledButton]} accessibilityRole="button" accessibilityState={{ busy: followBusy }}><Text style={[wS.followButtonText, profile.isFollowing && wS.followingButtonText]}>{followBusy ? 'Updating…' : profile.isFollowing ? 'Following' : 'Follow writer'}</Text></Pressable>}<View style={wS.statsPanel}><Stat value={String(profile.stats.followers)} label="Followers" /><Stat value={String(profile.stats.following)} label="Following" /><Stat value={String(profile.stats.booksWritten)} label="Public books" /></View><View style={wS.statLine}><Text style={wS.statLineText}>{formatCount(profile.stats.wordsWritten)} words shared · {profile.stats.booksCompleted} completed</Text></View><Text style={wS.sectionTitle}>Public books</Text>{profile.books.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={wS.bookRail}>{profile.books.map((book) => <WriterBookCard key={book.id} book={book} />)}</ScrollView> : <View style={wS.empty}><Text style={wS.emptyTitle}>No public books yet</Text><Text style={wS.emptyCopy}>When this writer chooses a project to share, it will appear here.</Text></View>}</ScrollView> : null}</View></View></Modal>;
}

const wS = StyleSheet.create({
  summaryCard: { marginTop: 13, padding: 15, borderRadius: 22, backgroundColor: '#F4F2FF', borderWidth: 1, borderColor: '#E5E1FA' },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  summaryHeaderCopy: { flex: 1, minWidth: 0 },
  overline: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.9, fontWeight: '800' },
  summaryTitle: { color: C.ink, fontSize: 16, fontWeight: '800', marginTop: 4 },
  editButton: { minHeight: 28, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#FFF', justifyContent: 'center' },
  editButtonText: { color: C.periwinkle, fontSize: 8, fontWeight: '800' },
  summaryBio: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 10 },
  joined: { color: '#9A9CB1', fontSize: 8, marginTop: 6 },
  statsRow: { marginTop: 13, flexDirection: 'row', gap: 7 },
  stat: { flex: 1, minWidth: 0, padding: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.75)' },
  statValue: { color: C.ink, fontSize: 14, fontWeight: '800' },
  statLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.5, fontWeight: '800', marginTop: 4 },
  summaryStatLine: { color: C.muted, fontSize: 8, textAlign: 'center', marginTop: 8 },
  bookRail: { paddingTop: 12, paddingBottom: 2, gap: 8 },
  bookCard: { width: 174, padding: 9, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9E5F5' },
  bookCardCompact: { width: 145, padding: 8 },
  bookCover: { width: 72, height: 94, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bookCoverCompact: { width: 58, height: 76, borderRadius: 10 },
  bookCoverImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  bookCoverMark: { color: 'rgba(255,255,255,0.9)', fontSize: 22, fontWeight: '800' },
  bookCoverLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 5, letterSpacing: 0.7, fontWeight: '800', marginTop: 3 },
  bookTitle: { color: C.ink, fontSize: 11, lineHeight: 14, fontWeight: '800', marginTop: 8 },
  bookTitleCompact: { fontSize: 9, lineHeight: 12, marginTop: 6 },
  bookMeta: { color: C.muted, fontSize: 7, marginTop: 3 },
  bookProgressTrack: { height: 4, marginTop: 8, borderRadius: 2, backgroundColor: '#ECEAF6', overflow: 'hidden' },
  bookProgressFill: { height: '100%', borderRadius: 2 },
  bookProgressText: { color: '#9194AC', fontSize: 7, marginTop: 4 },
  summaryLoading: { minHeight: 70, alignItems: 'center', justifyContent: 'center' },
  summaryLoadingText: { color: C.muted, fontSize: 8, marginTop: 7 },
  summaryError: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 10 },
  empty: { marginTop: 11, padding: 11, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.6)' },
  emptyTitle: { color: C.ink, fontSize: 9, fontWeight: '800' },
  emptyCopy: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 4 },
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.28)' },
  dismiss: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: '92%', padding: 20, paddingBottom: 24, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: C.cream },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D7E4', marginBottom: 13 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetKicker: { color: C.ink, fontSize: 17, fontWeight: '800', marginTop: 4 },
  closeButton: { padding: 3, marginLeft: 8 },
  closeText: { color: C.ink, fontSize: 22 },
  sheetContent: { paddingTop: 18, paddingBottom: 18 },
  identity: { flexDirection: 'row', alignItems: 'center' },
  identityCopy: { flex: 1, minWidth: 0, marginLeft: 13 },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#D6C8F4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarLarge: { width: 66, height: 66, borderRadius: 24 },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: C.ink, fontSize: 13, fontWeight: '800' },
  avatarTextLarge: { fontSize: 22 },
  name: { color: C.ink, fontSize: 21, lineHeight: 25, fontWeight: '800' },
  bio: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 15 },
  followButton: { minHeight: 42, marginTop: 15, borderRadius: 13, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' },
  followingButton: { backgroundColor: '#EEECFA', borderWidth: 1, borderColor: '#D7D1F4' },
  disabledButton: { opacity: 0.65 },
  followButtonText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  followingButtonText: { color: C.periwinkle },
  selfPill: { minHeight: 35, marginTop: 15, borderRadius: 11, backgroundColor: '#F0EDFF', alignItems: 'center', justifyContent: 'center' },
  selfPillText: { color: C.periwinkle, fontSize: 8, fontWeight: '800' },
  statsPanel: { marginTop: 14, flexDirection: 'row', gap: 7 },
  statLine: { paddingTop: 9, alignItems: 'center' },
  statLineText: { color: C.muted, fontSize: 8 },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: '800', marginTop: 21 },
  loading: { minHeight: 210, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.muted, fontSize: 9, marginTop: 9 },
  errorState: { paddingVertical: 28, alignItems: 'center' },
  errorTitle: { color: C.ink, fontSize: 14, fontWeight: '800' },
  errorCopy: { color: C.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 6 },
  primaryButton: { minWidth: 120, minHeight: 42, marginTop: 17, paddingHorizontal: 14, borderRadius: 13, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
