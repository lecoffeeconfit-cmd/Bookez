import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { FeedbackHub, FeedbackRequestBuilder } from './CommunityFeedback';

type ReactionType = 'keep_going' | 'great_progress' | 'congrats';

export type CommunityDraftPart = { id: string; title: string; text: string };
export type CommunityProject = {
  id?: string;
  title: string;
  genre: string;
  progress: number;
  stage: string;
  parts?: CommunityDraftPart[];
  mark?: string;
  color?: string;
  coverImagePath?: string;
};

type Preferences = {
  show_profile: boolean;
  show_current_project: boolean;
  show_project_title: boolean;
  show_genre: boolean;
  show_completion_percent: boolean;
  show_current_stage: boolean;
  show_current_section: boolean;
  show_writing_now: boolean;
  show_streak: boolean;
  show_completed_projects: boolean;
};

type CommunityItem = {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  projectTitle?: string | null;
  genre?: string | null;
  projectType?: string | null;
  completionPercent?: number | null;
  stage?: string | null;
  publicStatus?: string | null;
  writingNow: boolean;
  completed: boolean;
  finishedLabel?: string | null;
  updatedAt?: string;
  avatarInitials?: string | null;
  avatarColor: string;
  coverColor: string;
  coverImagePath?: string | null;
  coverImageUri?: string;
  reactions: Record<ReactionType, number>;
  myReaction?: ReactionType | null;
  demo?: boolean;
  feedbackMode?: boolean;
  feedbackProject?: CommunityProject;
  hubMode?: boolean;
  feedbackManage?: boolean;
  feedbackRequestId?: string;
  feedbackRequestSummary?: string;
};

export type CommunityProps = { userId: string | null; activeProject?: CommunityProject; projects?: CommunityProject[]; onSelectProject?: (title: string) => void; initialFeedbackProjectTitle?: string | null; onFeedbackOpened?: () => void };

const C = { ink: '#2E3152', muted: '#797C9B', periwinkle: '#7068C9', lavender: '#BDB7EA', green: '#6DAD79', gold: '#B78736', coral: '#D77E86', cream: '#FBFAFF' };
const reactionOptions: Array<{ key: ReactionType; label: string; icon: string }> = [
  { key: 'keep_going', label: 'Keep Going', icon: '↗' },
  { key: 'great_progress', label: 'Great Progress', icon: '✦' },
  { key: 'congrats', label: 'Congrats', icon: '✧' },
];
const defaultPreferences: Preferences = { show_profile: false, show_current_project: false, show_project_title: false, show_genre: false, show_completion_percent: false, show_current_stage: false, show_current_section: false, show_writing_now: false, show_streak: false, show_completed_projects: false };

type FeedbackRequestFeedRow = {
  id: string;
  user_id: string;
  project_title: string;
  author_display_name: string;
  author_visibility: string;
  genre: string | null;
  completion_percent: number | null;
  stage: string | null;
  cover_image_path: string | null;
  selected_item_count: number;
  content_scope: string;
  focuses: unknown;
  custom_question: string | null;
};

const feedbackRequestLabel = (row: FeedbackRequestFeedRow) => {
  const focus = Array.isArray(row.focuses) && typeof row.focuses[0] === 'string' ? row.focuses[0] : null;
  const part = row.content_scope === 'entire_manuscript' ? 'Full manuscript' : `${row.selected_item_count} selected section${row.selected_item_count === 1 ? '' : 's'}`;
  return `${part}${focus ? ` · ${focus}` : ''}`;
};

const demoItems: CommunityItem[] = [
  { id: 'demo-quiet-moon', userId: 'demo-quiet-moon', displayName: 'Mara Ellis', projectTitle: 'The Quiet Moon', genre: 'Fantasy', projectType: 'Novel', completionPercent: 84, stage: 'Revising', publicStatus: 'Polishing the middle act', writingNow: true, completed: false, avatarInitials: 'ME', avatarColor: '#D6C8F4', coverColor: '#5B638E', reactions: { keep_going: 12, great_progress: 8, congrats: 2 }, demo: true },
  { id: 'demo-paper-kingdom', userId: 'demo-paper-kingdom', displayName: 'Jon Bell', projectTitle: 'A Paper Kingdom', genre: 'Memoir', projectType: 'Book', completionPercent: 48, stage: 'Drafting', publicStatus: 'Finding the shape of chapter five', writingNow: true, completed: false, avatarInitials: 'JB', avatarColor: '#F1C7B6', coverColor: '#B76E58', reactions: { keep_going: 7, great_progress: 11, congrats: 1 }, demo: true },
  { id: 'demo-soft-landing', userId: 'demo-soft-landing', displayName: 'Priya Shah', projectTitle: 'Soft Landing', genre: 'Romance', projectType: 'Novel', completionPercent: 96, stage: 'Final review', publicStatus: 'One last read-through', writingNow: false, completed: false, avatarInitials: 'PS', avatarColor: '#F4D8A7', coverColor: '#C97883', reactions: { keep_going: 4, great_progress: 9, congrats: 15 }, demo: true },
  { id: 'demo-small-hours', userId: 'demo-small-hours', displayName: 'Theo Martin', projectTitle: 'Small Hours', genre: 'Poetry', projectType: 'Collection', completionPercent: 100, stage: 'Complete', publicStatus: 'A finished collection', writingNow: false, completed: true, finishedLabel: 'Finished this week', avatarInitials: 'TM', avatarColor: '#BFD8CC', coverColor: '#6C947C', reactions: { keep_going: 1, great_progress: 6, congrats: 22 }, demo: true },
  { id: 'demo-salt-lines', userId: 'demo-salt-lines', displayName: 'Nadia Woods', projectTitle: 'Salt Lines', genre: 'Mystery', projectType: 'Novel', completionPercent: 54, stage: 'Drafting', publicStatus: 'Building the case', writingNow: false, completed: false, avatarInitials: 'NW', avatarColor: '#F0C6D2', coverColor: '#806AA4', reactions: { keep_going: 9, great_progress: 5, congrats: 0 }, demo: true },
  { id: 'demo-light-between', userId: 'demo-light-between', displayName: 'Alex Rivera', projectTitle: 'The Light Between', genre: 'Nonfiction', projectType: 'Essay', completionPercent: 22, stage: 'Planning', publicStatus: 'Collecting the first ideas', writingNow: false, completed: false, avatarInitials: 'AR', avatarColor: '#C7DDF0', coverColor: '#6888A8', reactions: { keep_going: 13, great_progress: 3, congrats: 0 }, demo: true },
];

const safeNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const normalizeItem = (row: Record<string, unknown>): CommunityItem => ({
  id: String(row.project_id ?? row.id), userId: String(row.user_id), displayName: String(row.display_name ?? 'Bookez writer'), bio: typeof row.bio === 'string' ? row.bio : null,
  projectTitle: typeof row.project_title === 'string' ? row.project_title : null, genre: typeof row.genre === 'string' ? row.genre : null, projectType: typeof row.project_type === 'string' ? row.project_type : null,
  completionPercent: safeNumber(row.completion_percent), stage: typeof row.stage === 'string' ? row.stage : null, publicStatus: typeof row.public_status === 'string' ? row.public_status : null,
  writingNow: row.writing_now === true, completed: row.completed === true, finishedLabel: typeof row.finished_label === 'string' ? row.finished_label : null, updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  avatarInitials: typeof row.avatar_initials === 'string' ? row.avatar_initials : null, avatarColor: typeof row.avatar_color === 'string' ? row.avatar_color : '#C9BCF5', coverColor: typeof row.cover_color === 'string' ? row.cover_color : '#5B638E',
  coverImagePath: typeof row.cover_image_path === 'string' ? row.cover_image_path : null, reactions: { keep_going: 0, great_progress: 0, congrats: 0 },
});

function EmptyState({ icon, title, copy }: { icon: string; title: string; copy: string }) {
  return <View style={s.empty}><Text style={s.emptyIcon}>{icon}</Text><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyCopy}>{copy}</Text></View>;
}

function Cover({ item, large = false }: { item: CommunityItem; large?: boolean }) {
  return <View style={[s.cover, large && s.coverLarge, { backgroundColor: item.coverColor }]}>{item.coverImageUri ? <Image source={{ uri: item.coverImageUri }} style={s.coverImage} resizeMode="cover" /> : <><Text style={s.coverMark}>{item.projectTitle?.slice(0, 1).toUpperCase() ?? '✦'}</Text><Text style={s.coverLabel}>{item.genre ?? 'BOOK'}</Text></>}<LinearGradient pointerEvents="none" colors={['rgba(255,210,52,0.99)', 'rgba(255,226,94,0.58)', 'rgba(255,255,255,0)']} locations={[0, 0.16, 0.52]} style={s.coverLight} /></View>;
}

function Avatar({ item }: { item: CommunityItem }) {
  return <View style={[s.avatar, { backgroundColor: item.avatarColor }]}><Text style={s.avatarText}>{item.avatarInitials ?? item.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</Text></View>;
}

function ReactionTotals({ item }: { item: CommunityItem }) {
  const total = Object.values(item.reactions).reduce((sum, value) => sum + value, 0);
  if (item.feedbackRequestId) return <Text style={s.reactionTotals}>Answer the author’s question</Text>;
  if (item.feedbackMode) return <Text style={s.reactionTotals}>Choose what you want help with</Text>;
  return <Text style={s.reactionTotals}>{total ? `${total} writer${total === 1 ? '' : 's'} encouraged this` : 'Be the first to encourage this'}</Text>;
}

function ProjectCard({ item, onPress, onReact }: { item: CommunityItem; onPress: () => void; onReact: (item: CommunityItem, reaction: ReactionType) => void }) {
  return <Pressable onPress={onPress} style={s.card} accessibilityRole="button" accessibilityLabel={`Open ${item.projectTitle ?? 'writer project'}`}><View style={s.cardTop}><Cover item={item} /><View style={s.cardCopy}><View style={s.writerRow}><Avatar item={item} /><Text numberOfLines={1} style={s.writerName}>{item.displayName}</Text>{item.writingNow && <View style={s.writingPill}><View style={s.liveDot} /><Text style={s.writingPillText}>Writing now</Text></View>}</View><Text numberOfLines={2} style={s.projectTitle}>{item.projectTitle ?? 'Untitled project'}</Text><Text numberOfLines={1} style={s.projectMeta}>{item.genre ?? item.projectType ?? 'Writing project'} · {item.stage ?? 'In progress'}</Text>{item.publicStatus && <Text numberOfLines={1} style={s.publicStatus}>{item.publicStatus}</Text>}<View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.max(2, Math.min(100, item.completionPercent ?? 0))}%`, backgroundColor: item.completed ? C.gold : C.periwinkle }]} /></View><Text style={s.progressText}>{item.completionPercent ?? 0}% complete</Text></View><Text style={s.cardArrow}>›</Text></View><View style={s.cardFooter}><ReactionTotals item={item} />{item.feedbackRequestId ? <Text style={s.feedbackCardAction}>Open</Text> : <View style={s.reactionActions}>{reactionOptions.map((reaction) => <Pressable key={reaction.key} onPress={(event) => { event.stopPropagation(); onReact(item, reaction.key); }} style={[s.reactionButton, item.myReaction === reaction.key && s.reactionButtonActive]} accessibilityLabel={reaction.label}><Text style={[s.reactionIcon, item.myReaction === reaction.key && s.reactionIconActive]}>{reaction.icon}</Text></Pressable>)}</View>}</View></Pressable>;
}

const feedbackFocuses = ['Title or cover', 'Opening', 'Pacing', 'Characters', 'Overall direction'];

function FeedbackPicker({ item, userId, onClose }: { item: CommunityItem; userId: string | null; onClose: () => void }) {
  const project = item.feedbackProject;
  const [focus, setFocus] = useState(feedbackFocuses[0]);
  const [question, setQuestion] = useState('');
  const [saving, setSaving] = useState(false);
  if (!project) return null;
  const send = async () => {
    if (!userId) { Alert.alert('Sign in to ask for feedback', 'You can browse Community without sharing. Sign in to send a book here.'); return; }
    if (!project.id) { Alert.alert('Sync this project first', 'This book needs to be connected to your Bookez account before it can be shared with Community.'); return; }
    setSaving(true);
    const { error } = await supabase.from('community_feedback_requests').insert({ user_id: userId, project_id: project.id, project_title: project.title, genre: project.genre, completion_percent: project.progress, stage: project.stage, cover_image_path: project.coverImagePath ?? null, focus, question: question.trim() || null, status: 'open' });
    setSaving(false);
    if (error) { Alert.alert('Could not share this yet', 'Bookez could not open the feedback request. Please try again.'); return; }
    Alert.alert('Sent to Community', `${project.title} is now open for focused feedback on ${focus.toLowerCase()}.`, [{ text: 'Done', onPress: onClose }]);
  };
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={s.modalShade}><Pressable style={s.modalDismiss} onPress={onClose} /><View style={s.smallSheet}><View style={s.sheetHandle} /><Text style={s.overline}>COMMUNITY / FEEDBACK</Text><Text style={s.sheetTitle}>What would you like help with?</Text><Text style={s.sheetHint}>{project.title} does not need to be finished. Choose one focused area so other writers know where their perspective would be useful.</Text><View style={s.feedbackProjectSummary}><Text style={s.feedbackProjectTitle}>{project.title}</Text><Text style={s.feedbackProjectMeta}>{project.genre} · {project.progress}% · {project.stage}</Text></View><Text style={s.fieldLabel}>FOCUS</Text><View style={s.feedbackFocusGrid}>{feedbackFocuses.map((option) => <Pressable key={option} onPress={() => setFocus(option)} style={[s.pill, focus === option && s.pillActive]}><Text style={[s.pillText, focus === option && s.pillTextActive]}>{option}</Text></Pressable>)}</View><Text style={s.fieldLabel}>OPTIONAL QUESTION</Text><TextInput value={question} onChangeText={setQuestion} multiline placeholder="What should readers pay attention to?" placeholderTextColor="#A0A3BB" style={s.feedbackInput} /><Pressable disabled={saving} onPress={() => void send()} style={[s.primaryButton, saving && s.primaryDisabled]}><Text style={s.primaryButtonText}>{saving ? 'Sending…' : 'Send to Community'}</Text></Pressable></View></View></Modal>;
}

function ProjectDetail({ item, userId, onClose, onReact, onBlock, onReport, onFeedbackChanged }: { item: CommunityItem | null; userId: string | null; onClose: () => void; onReact: (item: CommunityItem, reaction: ReactionType) => void; onBlock: (item: CommunityItem) => void; onReport: (item: CommunityItem) => void; onFeedbackChanged?: () => void }) {
  if (!item) return null;
  if (item.feedbackMode && item.feedbackProject && item.feedbackManage && item.feedbackRequestId) return <FeedbackHub userId={userId} initialRequestId={item.feedbackRequestId} onChanged={onFeedbackChanged} onClose={onClose} />;
  if (item.feedbackMode && item.feedbackProject) return <FeedbackRequestBuilder project={item.feedbackProject} userId={userId} onPublished={onFeedbackChanged} onClose={onClose} />;
  if (item.hubMode) return <FeedbackHub userId={userId} initialRequestId={item.feedbackRequestId} onClose={onClose} />;
  return <Modal visible={Boolean(item)} transparent animationType="slide" onRequestClose={onClose}><View style={s.modalShade}><Pressable style={s.modalDismiss} onPress={onClose} /><View style={s.detailSheet}><View style={s.sheetHandle} /><View style={s.detailHeader}><Cover item={item} large /><View style={s.detailHeaderCopy}><View style={s.writerRow}><Avatar item={item} /><Text style={s.writerName}>{item.displayName}</Text></View><Text style={s.detailTitle}>{item.projectTitle ?? 'Untitled project'}</Text><Text style={s.projectMeta}>{item.genre ?? item.projectType ?? 'Writing project'} · {item.stage ?? 'In progress'}</Text></View></View><Text style={s.detailBio}>{item.bio ?? `${item.displayName} is making steady progress on this writing project.`}</Text><View style={s.detailProgress}><View style={s.detailProgressTop}><Text style={s.detailProgressLabel}>CURRENT PROGRESS</Text><Text style={s.detailProgressValue}>{item.completionPercent ?? 0}%</Text></View><View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.max(2, Math.min(100, item.completionPercent ?? 0))}%`, backgroundColor: item.completed ? C.gold : C.periwinkle }]} /></View><Text style={s.detailStage}>{item.completed ? item.finishedLabel ?? 'Completed project' : item.publicStatus ?? item.stage ?? 'In progress'}</Text></View><Text style={s.detailSectionTitle}>Encourage this writer</Text><View style={s.detailReactions}>{reactionOptions.map((reaction) => <Pressable key={reaction.key} onPress={() => onReact(item, reaction.key)} style={[s.detailReaction, item.myReaction === reaction.key && s.detailReactionActive]}><Text style={[s.detailReactionIcon, item.myReaction === reaction.key && s.detailReactionTextActive]}>{reaction.icon}</Text><Text style={[s.detailReactionText, item.myReaction === reaction.key && s.detailReactionTextActive]}>{reaction.label}</Text></Pressable>)}</View>{!userId && <Text style={s.detailSignIn}>Sign in to send an encouragement.</Text>}<View style={s.detailActions}><Pressable onPress={() => onReport(item)} style={s.detailAction}><Text style={s.detailActionText}>Report</Text></Pressable>{item.userId !== userId && !item.demo && <Pressable onPress={() => onBlock(item)} style={s.detailAction}><Text style={s.detailActionText}>Block writer</Text></Pressable>}</View><Pressable onPress={onClose} style={s.closeButton}><Text style={s.closeButtonText}>Done</Text></Pressable></View></View></Modal>;
}

export default function Community({ userId, activeProject, projects = [], onSelectProject, initialFeedbackProjectTitle, onFeedbackOpened }: CommunityProps) {
  const [items, setItems] = useState<CommunityItem[]>(demoItems);
  const [usingDemo, setUsingDemo] = useState(true);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [feedbackRequestFeed, setFeedbackRequestFeed] = useState<CommunityItem[]>([]);
  const [selected, setSelected] = useState<CommunityItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState('All stages');
  const [writingOnly, setWritingOnly] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [browseSection, setBrowseSectionState] = useState<string | null>(null);
  const setBrowseSection = (value: string | null) => {
    if (value === 'feedback') {
      setBrowseSectionState(null);
      setSelected({ id: 'feedback-hub', userId: userId ?? '', displayName: 'Feedback Hub', projectTitle: 'Feedback Hub', genre: 'Feedback', completionPercent: 0, stage: '', publicStatus: null, writingNow: false, completed: false, avatarColor: '#D6C8F4', coverColor: '#5B638E', reactions: { keep_going: 0, great_progress: 0, congrats: 0 }, hubMode: true });
      return;
    }
    setBrowseSectionState(value);
  };

  const loadPreferences = async () => {
    if (!userId) return;
    const { data } = await supabase.from('community_preferences').select('*').eq('user_id', userId).maybeSingle();
    if (data) setPreferences({ ...defaultPreferences, ...data });
  };

  const loadFeed = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setOffline(false);
    try {
      if (!userId) { setItems(demoItems); setUsingDemo(true); return; }
      const { data, error } = await supabase.rpc('get_community_feed', { p_limit: 60, p_offset: 0 });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) { setItems(demoItems); setUsingDemo(true); return; }
      let next = rows.map((row) => normalizeItem(row as Record<string, unknown>));
      const ids = next.map((item) => item.id);
      const [summaryResult, ownResult] = await Promise.all([
        supabase.rpc('get_community_reaction_summary', { p_item_ids: ids }),
        supabase.from('community_reactions').select('item_id,reaction_type').eq('user_id', userId).eq('item_type', 'project').in('item_id', ids),
      ]);
      const summary = Array.isArray(summaryResult.data) ? summaryResult.data : [];
      const own = Array.isArray(ownResult.data) ? ownResult.data : [];
      next = next.map((item) => {
        const reactions = { keep_going: 0, great_progress: 0, congrats: 0 } as Record<ReactionType, number>;
        summary.forEach((entry) => { const row = entry as { item_id?: string; reaction_type?: ReactionType; total?: number }; if (row.item_id === item.id && row.reaction_type && row.reaction_type in reactions) reactions[row.reaction_type] = Number(row.total ?? 0); });
        const mine = own.find((entry) => entry.item_id === item.id)?.reaction_type as ReactionType | undefined;
        return { ...item, reactions, myReaction: mine ?? null };
      });
      next = await Promise.all(next.map(async (item) => { if (!item.coverImagePath) return item; const signed = await supabase.storage.from('bookez-files').createSignedUrl(item.coverImagePath, 60 * 60); return signed.data?.signedUrl ? { ...item, coverImageUri: signed.data.signedUrl } : item; }));
      setItems(next); setUsingDemo(false);
    } catch { setOffline(true); setItems(demoItems); setUsingDemo(true); } finally { setLoading(false); setRefreshing(false); }
  };

  const loadFeedbackRequestFeed = async () => {
    if (!userId) { setFeedbackRequestFeed([]); return; }
    const { data, error } = await supabase.from('community_feedback_requests').select('id,user_id,project_title,author_display_name,author_visibility,genre,completion_percent,stage,cover_image_path,selected_item_count,content_scope,focuses,custom_question').eq('status', 'open').order('created_at', { ascending: false }).limit(30);
    if (error) { setFeedbackRequestFeed([]); return; }
    setFeedbackRequestFeed((data ?? []).map((row) => {
      const request = row as unknown as FeedbackRequestFeedRow;
      return { id: `feedback-request-${request.id}`, userId: request.user_id, displayName: request.author_visibility === 'anonymous' ? 'Anonymous Writer' : request.author_display_name, projectTitle: request.project_title, genre: request.genre, projectType: request.genre, completionPercent: request.completion_percent, stage: request.stage, publicStatus: `${feedbackRequestLabel(request)}${request.custom_question ? ` · ${request.custom_question}` : ''}`, writingNow: false, completed: false, avatarInitials: request.author_visibility === 'anonymous' ? 'AW' : request.author_display_name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), avatarColor: '#D6C8F4', coverColor: '#5B638E', coverImagePath: request.cover_image_path, reactions: { keep_going: 0, great_progress: 0, congrats: 0 }, feedbackMode: true, hubMode: true, feedbackRequestId: request.id, feedbackRequestSummary: feedbackRequestLabel(request) };
    }));
  };
  useEffect(() => { void loadPreferences(); void loadFeed(); void loadFeedbackRequestFeed(); }, [userId]);
  const upsertCurrentProject = async (nextPreferences: Preferences) => {
    if (!userId || !activeProject?.id) return;
    await supabase.from('community_profiles').upsert({ user_id: userId, display_name: 'Bookez writer' }, { onConflict: 'user_id' });
    await supabase.from('community_projects').upsert({ project_id: activeProject.id, user_id: userId, project_title: nextPreferences.show_project_title ? activeProject.title : null, genre: nextPreferences.show_genre ? activeProject.genre : null, project_type: nextPreferences.show_genre ? activeProject.genre : null, completion_percent: nextPreferences.show_completion_percent ? activeProject.progress : null, stage: nextPreferences.show_current_stage ? activeProject.stage : null, public_status: nextPreferences.show_current_section ? activeProject.stage : null, cover_color: activeProject.color ?? '#5B638E', cover_image_path: nextPreferences.show_project_title ? activeProject.coverImagePath ?? null : null }, { onConflict: 'project_id' });
  };

  const savePreference = async (key: keyof Preferences, value: boolean) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    if (!userId) { setPrivacyOpen(false); return; }
    const { error } = await supabase.from('community_preferences').upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });
    if (error) { Alert.alert('Could not save that setting', 'Your sharing preference remains private on this device.'); return; }
    await upsertCurrentProject(next);
  };

  const react = async (item: CommunityItem, reaction: ReactionType) => {
    if (item.feedbackMode || item.hubMode) { setSelected(item); return; }
    if (item.demo) { Alert.alert('Community preview', 'Encouragement reactions become available when writers opt into the live Community.'); return; }
    if (!userId) { Alert.alert('Sign in to encourage', 'You can browse Community now; sign in to send a reaction.'); return; }
    const nextReaction = item.myReaction === reaction ? null : reaction;
    setItems((current) => current.map((entry) => { if (entry.id !== item.id) return entry; const reactions = { ...entry.reactions }; if (entry.myReaction) reactions[entry.myReaction] = Math.max(0, reactions[entry.myReaction] - 1); if (nextReaction) reactions[nextReaction] += 1; return { ...entry, reactions, myReaction: nextReaction }; }));
    if (nextReaction) await supabase.from('community_reactions').upsert({ user_id: userId, item_id: item.id, item_type: 'project', reaction_type: nextReaction }, { onConflict: 'user_id,item_id,item_type' });
    else await supabase.from('community_reactions').delete().eq('user_id', userId).eq('item_id', item.id).eq('item_type', 'project');
  };

  const block = (item: CommunityItem) => {
    if (!userId) { Alert.alert('Sign in to block', 'Blocking is available after you sign in.'); return; }
    Alert.alert('Block this writer?', 'They will disappear from your Community sections.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => { void supabase.from('community_blocks').insert({ blocker_id: userId, blocked_id: item.userId }).then(() => { setSelected(null); void loadFeed(true); }); } }]);
  };

  const report = (item: CommunityItem) => {
    if (!userId) { Alert.alert('Sign in to report', 'Reporting is available after you sign in.'); return; }
    Alert.alert('Report this project?', 'Bookez will review the report privately.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: () => { void supabase.from('community_reports').insert({ reporter_id: userId, reported_user_id: item.userId, project_id: item.id, reason: 'Community project report' }).then(() => Alert.alert('Report sent', 'Thank you for helping keep the writing room welcoming.')); } }]);
  };

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => { const matchesQuery = !normalizedQuery || [item.displayName, item.projectTitle, item.genre, item.projectType].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery)); const matchesStage = stageFilter === 'All stages' || item.stage === stageFilter; return matchesQuery && matchesStage && (!writingOnly || item.writingNow); });
  }, [items, query, stageFilter, writingOnly]);
  const activeGenre = activeProject?.genre?.toLowerCase();
  const sections = useMemo(() => {
    const recent = [...visibleItems].sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? ''));
    const active = [...visibleItems].sort((a, b) => ((b.completionPercent ?? 0) + (b.writingNow ? 20 : 0)) - ((a.completionPercent ?? 0) + (a.writingNow ? 20 : 0)));
    return [
      { key: 'writing', title: 'Writing Now', hint: 'The writing room is active.', items: visibleItems.filter((item) => item.writingNow), empty: ['◌', 'The writing room is quiet right now.', 'Check back soon for writers making progress.'] },
      { key: 'active', title: 'Most Active This Week', hint: 'Steady progress worth celebrating.', items: active.slice(0, 6), empty: ['✦', 'No activity to show yet.', 'Writers will appear here as they make meaningful progress.'] },
      { key: 'near', title: 'Near Completion', hint: 'Projects close to the finish line.', items: visibleItems.filter((item) => (item.completionPercent ?? 0) >= 75 && (item.completionPercent ?? 0) < 100), empty: ['◎', 'No books are nearing the finish line yet.', 'Check back soon.'] },
      { key: 'feedback', title: 'Feedback requests', hint: 'Writers have selected pages for thoughtful reader perspective.', items: feedbackRequestFeed, empty: ['✎', 'No open feedback requests yet.', 'When a writer asks a focused question, their selected pages will appear here.'] },
      { key: 'finished', title: 'Recently Finished', hint: 'A little gold for the completed work.', items: visibleItems.filter((item) => item.completed), empty: ['✧', 'No recent completions yet.', 'Every finished page starts with one small session.'] },
      { key: 'genre', title: activeGenre ? `Same Genre · ${activeProject?.genre}` : 'Same Genre', hint: activeGenre ? 'Writers working in a similar room.' : 'Choose a project to find your writing neighbors.', items: activeGenre ? visibleItems.filter((item) => item.genre?.toLowerCase() === activeGenre) : [], empty: ['◇', activeGenre ? 'No similar-genre writers found.' : 'Start a project to discover writers in your genre.', 'Bookez will bring them here as the room grows.'] },
      { key: 'progress', title: 'Similar Progress', hint: activeProject ? `Around ${activeProject.progress}% complete.` : 'Writers moving at a similar pace.', items: activeProject ? visibleItems.filter((item) => Math.abs((item.completionPercent ?? 0) - activeProject.progress) <= 15) : visibleItems.slice(0, 5), empty: ['≈', 'No writers at this stage yet.', 'Keep writing; your people are on their way.'] },
    ];
  }, [activeGenre, activeProject, feedbackRequestFeed, visibleItems]);
  const currentBrowse = sections.find((section) => section.key === browseSection);
  useEffect(() => {
    if (!initialFeedbackProjectTitle) return;
    const project = projects.find((entry) => entry.title === initialFeedbackProjectTitle);
    if (!project) return;
    setSelected({ id: `feedback-compose-${project.title}`, userId: userId ?? 'local-writer', displayName: 'Your project', projectTitle: project.title, genre: project.genre, projectType: project.genre, completionPercent: project.progress, stage: project.stage, writingNow: false, completed: project.progress >= 100, avatarInitials: 'YOU', avatarColor: '#D6C8F4', coverColor: project.color ?? '#5B638E', coverImagePath: project.coverImagePath ?? null, reactions: { keep_going: 0, great_progress: 0, congrats: 0 }, feedbackMode: true, feedbackProject: project });
    onFeedbackOpened?.();
  }, [initialFeedbackProjectTitle, onFeedbackOpened, projects, userId]);
  return <View style={s.page}>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadFeed(true); void loadFeedbackRequestFeed(); }} tintColor={C.periwinkle} />} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={s.header}><View style={s.headerCopy}><Text style={s.overline}>BOOKEZ / WRITING ROOM</Text><Text style={s.title}>Community</Text><Text style={s.subtitle}>See what other writers are creating.</Text></View><View style={s.headerActions}><Pressable onPress={() => setSearchOpen((value) => !value)} style={s.iconButton} accessibilityLabel="Search Community"><Text style={s.iconButtonText}>⌕</Text></Pressable><Pressable onPress={() => setPrivacyOpen(true)} style={s.iconButton} accessibilityLabel="Community sharing settings"><Text style={s.iconButtonText}>⚙</Text></Pressable></View></View>
      {searchOpen && <View style={s.searchBox}><TextInput value={query} onChangeText={setQuery} autoFocus placeholder="Search writers, books, or genres" placeholderTextColor="#A0A3BB" style={s.searchInput} /><Pressable onPress={() => { setQuery(''); setSearchOpen(false); }}><Text style={s.clearSearch}>×</Text></Pressable></View>}
      <View style={s.introCard}><View style={s.introCopy}><Text style={s.introEyebrow}>A QUIET WRITING ROOM</Text><Text style={s.introTitle}>Progress is better together.</Text><Text style={s.introText}>Browse public writing progress, discover books taking shape, and leave a little encouragement.</Text></View><View style={s.introSeal}><Text style={s.introSealMark}>✦</Text><Text style={s.introSealText}>{visibleItems.length} writers</Text></View></View>
      <View style={s.toolbar}><Text style={s.toolbarText}>{usingDemo ? 'Previewing the writing room' : 'Public progress from Bookez writers'}</Text><Pressable onPress={() => setFilterOpen(true)} style={s.filterButton}><Text style={s.filterButtonText}>{writingOnly || stageFilter !== 'All stages' ? 'Filtered' : 'Filter'} · ≡</Text></Pressable></View>
      {offline && <View style={s.offline}><Text style={s.offlineText}>Community is offline right now. Your private writing is safe.</Text><Pressable onPress={() => void loadFeed(true)}><Text style={s.retry}>Retry</Text></Pressable></View>}
      {loading ? <View style={s.loading}><ActivityIndicator color={C.periwinkle} /><Text style={s.loadingText}>Opening the writing room…</Text></View> : sections.map((section) => <View key={section.key} style={s.section}><View style={s.sectionHeader}><View><Text style={s.sectionTitle}>{section.title}</Text><Text style={s.sectionHint}>{section.hint}</Text></View><Pressable onPress={() => setBrowseSection(section.key)}><Text style={s.seeAll}>See all</Text></Pressable></View>{section.items.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cardRail}>{section.items.map((item) => <ProjectCard key={`${section.key}-${item.id}`} item={item} onPress={() => { setSelected(item); if (item.demo || item.feedbackRequestId) return; onSelectProject?.(item.projectTitle ?? ''); }} onReact={react} />)}</ScrollView> : <EmptyState icon={section.empty[0]} title={section.empty[1]} copy={section.empty[2]} />}</View>)}
      {!userId && <View style={s.signInNote}><Text style={s.signInTitle}>Sharing is optional</Text><Text style={s.signInCopy}>You can browse the writing room without sharing your own work. Sign in when you want to participate.</Text></View>}
    </ScrollView>
    <ProjectDetail item={selected} userId={userId} onClose={() => setSelected(null)} onReact={react} onBlock={block} onReport={report} onFeedbackChanged={() => void loadFeedbackRequestFeed()} />
    <Modal visible={Boolean(currentBrowse)} transparent animationType="slide" onRequestClose={() => setBrowseSection(null)}><View style={s.modalShade}><Pressable style={s.modalDismiss} onPress={() => setBrowseSection(null)} /><View style={s.browseSheet}><View style={s.sheetHandle} /><View style={s.sheetHeader}><View><Text style={s.overline}>COMMUNITY / SEE ALL</Text><Text style={s.sheetTitle}>{currentBrowse?.title}</Text><Text style={s.sheetHint}>{currentBrowse?.hint}</Text></View><Pressable onPress={() => setBrowseSection(null)}><Text style={s.closeText}>×</Text></Pressable></View>{currentBrowse?.items.length ? <ScrollView showsVerticalScrollIndicator={false}>{currentBrowse.items.map((item) => <ProjectCard key={`browse-${item.id}`} item={item} onPress={() => { setBrowseSection(null); setSelected(item); }} onReact={react} />)}</ScrollView> : <EmptyState icon="◌" title="Nothing here yet" copy="The writing room will fill in as more writers opt into sharing." />}</View></View></Modal>
    <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}><View style={s.modalShade}><Pressable style={s.modalDismiss} onPress={() => setFilterOpen(false)} /><View style={s.smallSheet}><View style={s.sheetHandle} /><Text style={s.sheetTitle}>Filter Community</Text><Text style={s.fieldLabel}>WRITING STAGE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRail}>{['All stages', 'Planning', 'Drafting', 'Revising', 'Final review', 'Complete'].map((stage) => <Pressable key={stage} onPress={() => setStageFilter(stage)} style={[s.pill, stageFilter === stage && s.pillActive]}><Text style={[s.pillText, stageFilter === stage && s.pillTextActive]}>{stage}</Text></Pressable>)}</ScrollView><Pressable onPress={() => setWritingOnly((value) => !value)} style={s.filterRow}><View><Text style={s.filterRowTitle}>Writing now only</Text><Text style={s.filterRowHint}>Show people actively making progress.</Text></View><View style={[s.toggle, writingOnly && s.toggleOn]}><View style={[s.toggleThumb, writingOnly && s.toggleThumbOn]} /></View></Pressable><Pressable onPress={() => setFilterOpen(false)} style={s.primaryButton}><Text style={s.primaryButtonText}>Apply filters</Text></Pressable></View></View></Modal>
    <Modal visible={privacyOpen} transparent animationType="slide" onRequestClose={() => setPrivacyOpen(false)}><View style={s.modalShade}><Pressable style={s.modalDismiss} onPress={() => setPrivacyOpen(false)} /><View style={s.smallSheet}><View style={s.sheetHandle} /><Text style={s.overline}>COMMUNITY / PRIVACY</Text><Text style={s.sheetTitle}>Choose what to share</Text><Text style={s.sheetHint}>All sharing is optional. You can browse and encourage writers without publishing your own work.</Text>{([['show_profile', 'Show my profile', 'Display your name in the writing room'], ['show_current_project', 'Show my current project', 'Let others discover that you are making a book'], ['show_project_title', 'Show project title', 'Display the title and cover image'], ['show_genre', 'Show genre or type', 'Help writers find their creative neighbors'], ['show_completion_percent', 'Show completion percentage', 'Share a broad progress marker'], ['show_current_stage', 'Show current stage', 'Planning, drafting, revising, or complete'], ['show_writing_now', 'Show Writing Now status', 'Use a subtle active indicator while you write'], ['show_completed_projects', 'Show completed projects', 'Celebrate finished work in Community'] ] as Array<[keyof Preferences, string, string]>).map(([key, label, hint]) => <Pressable key={key} onPress={() => void savePreference(key, !preferences[key])} style={s.privacyRow}><View style={s.privacyCopy}><Text style={s.privacyTitle}>{label}</Text><Text style={s.privacyHint}>{hint}</Text></View><View style={[s.toggle, preferences[key] && s.toggleOn]}><View style={[s.toggleThumb, preferences[key] && s.toggleThumbOn]} /></View></Pressable>)}<Pressable onPress={() => setPrivacyOpen(false)} style={s.primaryButton}><Text style={s.primaryButtonText}>Done</Text></Pressable></View></View></Modal>
  </View>;
}

const s: Record<string, any> = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerCopy: { flex: 1 },
  overline: { color: C.periwinkle, fontSize: 7, letterSpacing: 1, fontWeight: '800' },
  title: { color: C.ink, fontSize: 28, lineHeight: 33, fontWeight: '800', marginTop: 5 },
  subtitle: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  headerActions: { flexDirection: 'row', gap: 7 },
  iconButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#F0EDFF', alignItems: 'center', justifyContent: 'center' },
  iconButtonText: { color: C.periwinkle, fontSize: 18 },
  searchBox: { marginTop: 12, minHeight: 43, borderRadius: 13, paddingHorizontal: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4E2EF', flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, color: C.ink, fontSize: 10 },
  clearSearch: { color: C.muted, fontSize: 20, paddingLeft: 8 },
  introCard: { marginTop: 18, padding: 16, borderRadius: 22, backgroundColor: '#F0EDFF', borderWidth: 1, borderColor: '#DED8FA', flexDirection: 'row', alignItems: 'center' },
  introCopy: { flex: 1, paddingRight: 9 }, introEyebrow: { color: C.periwinkle, fontSize: 7, letterSpacing: 0.9, fontWeight: '800' }, introTitle: { color: C.ink, fontSize: 20, lineHeight: 24, fontWeight: '800', marginTop: 5 }, introText: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 6 },
  introSeal: { width: 62, height: 62, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.78)', alignItems: 'center', justifyContent: 'center' }, introSealMark: { color: C.periwinkle, fontSize: 22 }, introSealText: { color: C.muted, fontSize: 7, fontWeight: '800', marginTop: 2 },
  toolbar: { marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, toolbarText: { color: C.muted, fontSize: 8, fontWeight: '700' }, filterButton: { minHeight: 28, paddingHorizontal: 9, borderRadius: 9, backgroundColor: '#F2F1F7', justifyContent: 'center' }, filterButtonText: { color: C.periwinkle, fontSize: 8, fontWeight: '800' },
  offline: { marginTop: 10, padding: 10, borderRadius: 13, backgroundColor: '#FFF8EA', borderWidth: 1, borderColor: '#F2E1BA', flexDirection: 'row', alignItems: 'center' }, offlineText: { flex: 1, color: '#8A6B2D', fontSize: 8, lineHeight: 12 }, retry: { color: '#A97819', fontSize: 8, fontWeight: '800', marginLeft: 8 }, loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center' }, loadingText: { color: C.muted, fontSize: 9, marginTop: 10 },
  section: { marginTop: 23 }, sectionHeader: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: C.ink, fontSize: 16, fontWeight: '800' }, sectionHint: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 3 }, seeAll: { color: C.periwinkle, fontSize: 8, fontWeight: '800' }, cardRail: { paddingTop: 8, paddingBottom: 2, paddingRight: 6, gap: 9 },
  card: { width: 270, padding: 10, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: '#E5E2F0', shadowColor: '#6E6A94', shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, cardTop: { flexDirection: 'row', minHeight: 108 }, cardCopy: { flex: 1, minWidth: 0, marginLeft: 9 }, cover: { width: 64, height: 86, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, coverLarge: { width: 82, height: 112, borderRadius: 17 }, coverImage: { width: '100%', height: '100%' }, coverLight: { ...StyleSheet.absoluteFill }, coverMark: { color: 'rgba(255,255,255,0.9)', fontSize: 20, fontWeight: '800' }, coverLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 5, letterSpacing: 0.7, fontWeight: '800', marginTop: 3 },
  writerRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 }, avatar: { width: 22, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.ink, fontSize: 7, fontWeight: '800' }, writerName: { color: C.muted, fontSize: 8, fontWeight: '800', marginLeft: 6, flexShrink: 1 }, writingPill: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', paddingLeft: 5 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginRight: 4 }, writingPillText: { color: C.green, fontSize: 7, fontWeight: '800' }, projectTitle: { color: C.ink, fontSize: 13, lineHeight: 17, fontWeight: '800', marginTop: 9 }, projectMeta: { color: C.muted, fontSize: 8, marginTop: 4 }, publicStatus: { color: C.periwinkle, fontSize: 8, marginTop: 4 }, progressTrack: { height: 5, marginTop: 9, borderRadius: 3, backgroundColor: '#ECEAF6', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3 }, progressText: { color: '#9294AE', fontSize: 7, marginTop: 4 }, cardArrow: { color: C.lavender, fontSize: 21, marginLeft: 6 },
  cardFooter: { marginTop: 8, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F0EEF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reactionTotals: { flex: 1, color: '#9194AC', fontSize: 7 }, feedbackCardAction: { color: C.periwinkle, fontSize: 8, fontWeight: '800' }, reactionActions: { flexDirection: 'row', gap: 5 }, reactionButton: { width: 25, height: 25, borderRadius: 8, backgroundColor: '#F3F1FA', alignItems: 'center', justifyContent: 'center' }, reactionButtonActive: { backgroundColor: '#E8E3FF' }, reactionIcon: { color: C.muted, fontSize: 12 }, reactionIconActive: { color: C.periwinkle },
  empty: { marginTop: 8, padding: 20, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.54)', alignItems: 'center', borderWidth: 1, borderColor: '#ECEAF4' }, emptyIcon: { color: C.lavender, fontSize: 24 }, emptyTitle: { color: C.ink, fontSize: 11, fontWeight: '800', marginTop: 6, textAlign: 'center' }, emptyCopy: { color: C.muted, fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: 4, maxWidth: 280 },
  signInNote: { marginTop: 22, padding: 13, borderRadius: 16, backgroundColor: '#EEF8FF', borderWidth: 1, borderColor: '#D8EDF8' }, signInTitle: { color: '#365D78', fontSize: 10, fontWeight: '800' }, signInCopy: { color: '#4B7B9D', fontSize: 8, lineHeight: 12, marginTop: 4 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.24)' }, modalDismiss: { ...StyleSheet.absoluteFill }, detailSheet: { maxHeight: '94%', padding: 20, paddingBottom: 28, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF' }, browseSheet: { maxHeight: '90%', padding: 20, paddingBottom: 28, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF' }, smallSheet: { maxHeight: '92%', padding: 20, paddingBottom: 28, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: '#FBFAFF' }, sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D7E4', marginBottom: 13 },
  detailHeader: { flexDirection: 'row', alignItems: 'center' }, detailHeaderCopy: { flex: 1, marginLeft: 13 }, detailTitle: { color: C.ink, fontSize: 21, lineHeight: 25, fontWeight: '800', marginTop: 11 }, detailBio: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 17 }, detailProgress: { marginTop: 18, padding: 13, borderRadius: 15, backgroundColor: '#F4F2FC' }, detailProgressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, detailProgressLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.8, fontWeight: '800' }, detailProgressValue: { color: C.periwinkle, fontSize: 12, fontWeight: '800' }, detailStage: { color: C.muted, fontSize: 8, marginTop: 7 }, detailSectionTitle: { color: C.ink, fontSize: 14, fontWeight: '800', marginTop: 19 }, detailReactions: { flexDirection: 'row', gap: 6, marginTop: 9 }, detailReaction: { flex: 1, minHeight: 47, borderRadius: 12, backgroundColor: '#F2F1F7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, detailReactionActive: { backgroundColor: '#E8E3FF' }, detailReactionIcon: { color: C.muted, fontSize: 14 }, detailReactionText: { color: C.muted, fontSize: 7, fontWeight: '800', textAlign: 'center', marginTop: 3 }, detailReactionTextActive: { color: C.periwinkle }, detailSignIn: { color: C.muted, fontSize: 8, marginTop: 10 }, detailActions: { flexDirection: 'row', justifyContent: 'center', gap: 17, marginTop: 18 }, detailAction: { padding: 5 }, detailActionText: { color: '#9A9CB0', fontSize: 8, fontWeight: '700', textDecorationLine: 'underline' }, closeButton: { minHeight: 43, marginTop: 14, borderRadius: 13, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, closeButtonText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, sheetTitle: { color: C.ink, fontSize: 22, lineHeight: 27, fontWeight: '800', marginTop: 5 }, sheetHint: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 5, paddingRight: 20 }, closeText: { color: C.ink, fontSize: 22 }, fieldLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.8, fontWeight: '800', marginTop: 18 }, pillRail: { paddingTop: 8, gap: 6 }, pill: { minHeight: 31, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F2F1F7', borderWidth: 1, borderColor: '#E5E2EE', alignItems: 'center', justifyContent: 'center' }, pillActive: { backgroundColor: '#F0EDFF', borderColor: '#C9C1F6' }, pillText: { color: C.muted, fontSize: 8, fontWeight: '700' }, pillTextActive: { color: C.periwinkle }, filterRow: { minHeight: 58, marginTop: 17, paddingHorizontal: 11, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4E2EF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filterRowTitle: { color: C.ink, fontSize: 9, fontWeight: '800' }, filterRowHint: { color: C.muted, fontSize: 8, marginTop: 3 }, toggle: { width: 42, height: 25, borderRadius: 14, padding: 3, backgroundColor: '#DADBE7' }, toggleOn: { backgroundColor: '#BAB6F1' }, toggleThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#FFF' }, toggleThumbOn: { alignSelf: 'flex-end' }, privacyRow: { minHeight: 54, marginTop: 7, paddingHorizontal: 11, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4E2EF', flexDirection: 'row', alignItems: 'center' }, privacyCopy: { flex: 1, paddingRight: 10 }, privacyTitle: { color: C.ink, fontSize: 9, fontWeight: '800' }, privacyHint: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 2 }, primaryButton: { minHeight: 43, marginTop: 17, borderRadius: 13, backgroundColor: C.periwinkle, alignItems: 'center', justifyContent: 'center' }, primaryButtonText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});

Object.assign(s, {
  feedbackProjectSummary: { marginTop: 16, padding: 12, borderRadius: 14, backgroundColor: '#F4F2FC', borderWidth: 1, borderColor: '#E4E0F5' },
  feedbackProjectTitle: { color: C.ink, fontSize: 11, fontWeight: '800' },
  feedbackProjectMeta: { color: C.muted, fontSize: 8, marginTop: 4 },
  feedbackFocusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  feedbackInput: { minHeight: 72, marginTop: 8, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4E2EF', color: C.ink, fontSize: 10, textAlignVertical: 'top' },
  primaryDisabled: { opacity: 0.55 },
});
