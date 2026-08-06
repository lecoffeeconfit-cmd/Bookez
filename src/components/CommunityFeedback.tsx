import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import * as Speech from 'expo-speech';
import { supabase } from '../lib/supabase';
import type { CommunityProject } from './Community';

type FeedbackRequest = {
  id: string;
  user_id: string;
  project_id: string;
  project_title: string;
  author_display_name: string;
  genre: string | null;
  completion_percent: number | null;
  stage: string | null;
  cover_image_path: string | null;
  content_scope: string;
  selected_word_count: number;
  reading_minutes: number;
  listening_minutes: number;
  selected_item_count: number;
  focuses: unknown;
  custom_question: string | null;
  author_visibility: string;
  reading_enabled: boolean;
  listening_enabled: boolean;
  passage_comments_enabled: boolean;
  general_feedback_enabled: boolean;
  response_visibility: string;
  response_limit: number | null;
  closes_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ContentItem = { id: string; title: string; text: string; position: number; source_type: string };
type FeedbackResponse = {
  id: string;
  request_id: string;
  responder_id: string;
  anonymous: boolean;
  overall_impression: string | null;
  strengths: string | null;
  unclear_sections: string | null;
  suggestions: string | null;
  question_answers: Record<string, string>;
  additional_comments: string | null;
  quick_reactions: unknown;
  status: string;
  is_helpful: boolean;
  thanked_at: string | null;
  archived: boolean;
  submitted_at: string | null;
  created_at: string;
};
type FeedbackReply = { id: string; request_id: string; response_id: string; author_id: string; body: string; created_at: string; updated_at: string };
type ReaderResponse = { id: string; request_id: string; response_id: string; responder_id: string; anonymous: boolean; body: string; created_at: string; updated_at: string };

const C = { ink: '#2E3152', muted: '#797C9B', purple: '#7068C9', lavender: '#F0EDFF', border: '#E4E2EF', paper: '#FBFAFF', green: '#6DAD79' };
const quickReactionOptions = [
  { key: 'would_keep_reading', label: 'Would keep reading' },
  { key: 'strong_opening', label: 'Strong opening' },
  { key: 'great_dialogue', label: 'Great dialogue' },
  { key: 'confusing', label: 'Confusing' },
  { key: 'needs_more_context', label: 'Needs more context' },
];
const focusOptions = ['General impressions', 'Opening strength', 'Story pacing', 'Characters', 'Dialogue', 'Clarity', 'Structure', 'Grammar and readability', 'Emotional impact', 'Plot consistency', 'Tone and voice', 'Ending'];
const scopeOptions: Array<{ key: string; label: string; hint: string }> = [
  { key: 'entire_manuscript', label: 'Entire manuscript', hint: 'Share every selected writing section.' },
  { key: 'one_item', label: 'One chapter or section', hint: 'Choose one writing object from the outline.' },
  { key: 'multiple_items', label: 'Multiple chapters or sections', hint: 'Choose a focused group of sections.' },
  { key: 'passage', label: 'Selected passage', hint: 'Highlight a passage and ask about that moment.' },
  { key: 'custom_combination', label: 'Custom combination', hint: 'Mix chapters, sections, and writing objects.' },
];

const wordsIn = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
const minutesFor = (words: number, rate: number) => Math.max(1, Math.ceil(words / rate));
const asStringArray = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const scopeLabel = (scope: string, count: number) => scope === 'entire_manuscript' ? 'Full manuscript' : scope === 'passage' ? 'Selected passage' : `${count} chapter${count === 1 ? '' : 's'} or section${count === 1 ? '' : 's'}`;
const normalizedParts = (project: CommunityProject): ContentItem[] => {
  const parts = (project.parts ?? []).filter((part) => part.text.trim()).map((part, position) => ({ id: part.id, title: part.title || `Section ${position + 1}`, text: part.text, position, source_type: 'writing_object' }));
  return parts.length ? parts : [{ id: 'current-writing', title: 'Current writing', text: '', position: 0, source_type: 'writing_object' }];
};

function FeedbackTextInput({ style, accessibilityLabel, ...props }: TextInputProps) {
  const inputRef = useRef<TextInput>(null);
  const openDictation = () => inputRef.current?.focus();
  return <View style={s.dictationField}><TextInput ref={inputRef} {...props} accessibilityLabel={accessibilityLabel} style={[style, s.dictationInput]} /><Pressable onPress={openDictation} hitSlop={8} style={s.dictationButton} accessibilityRole="button" accessibilityLabel={`Open microphone${accessibilityLabel ? ` for ${accessibilityLabel}` : ''}`} accessibilityHint="Focuses this field and opens the keyboard. Tap the keyboard microphone to dictate, then edit your words."><Text style={s.dictationIcon}>🎙</Text></Pressable></View>;
}

function Sheet({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={s.shade}><Pressable style={s.dismiss} onPress={onClose} /><View style={[s.sheet, wide && s.wideSheet]}><View style={s.handle} />{children}</View></View></Modal>;
}

function Cover({ title, imagePath, large = false }: { title: string; imagePath?: string | null; large?: boolean }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => { let active = true; if (!imagePath) { setUri(null); return () => { active = false; }; } void supabase.storage.from('bookez-files').createSignedUrl(imagePath, 60 * 60).then(({ data }) => { if (active) setUri(data?.signedUrl ?? null); }); return () => { active = false; }; }, [imagePath]);
  return <View style={[s.cover, large && s.coverLarge]}>{uri ? <Image source={{ uri }} style={s.coverImage} resizeMode="cover" /> : <><Text style={s.coverMark}>{title.slice(0, 1).toUpperCase() || '✦'}</Text><Text style={s.coverType}>BOOKEZ</Text></>}<View pointerEvents="none" style={s.coverGlow} /></View>;
}

function Stats({ items }: { items: ContentItem[] }) {
  const words = items.reduce((sum, item) => sum + wordsIn(item.text), 0);
  return <View style={s.stats}><View><Text style={s.statValue}>{words.toLocaleString()}</Text><Text style={s.statLabel}>WORDS</Text></View><View><Text style={s.statValue}>{minutesFor(words, 220)} min</Text><Text style={s.statLabel}>READ</Text></View><View><Text style={s.statValue}>{minutesFor(words, 160)} min</Text><Text style={s.statLabel}>LISTEN</Text></View><View><Text style={s.statValue}>{items.length}</Text><Text style={s.statLabel}>SECTIONS</Text></View></View>;
}

function StepHeader({ step, title, hint }: { step: number; title: string; hint: string }) {
  return <View><Text style={s.kicker}>REQUEST FEEDBACK · STEP {step} OF 4</Text><Text style={s.title}>{title}</Text><Text style={s.hint}>{hint}</Text></View>;
}

function PassagePicker({ items, onClose, onUse }: { items: ContentItem[]; onClose: () => void; onUse: (item: ContentItem, start: number, end: number, excerpt: string) => void }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const item = items.find((entry) => entry.id === itemId) ?? items[0];
  if (!item) return null;
  const useSelection = () => {
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    const excerpt = start !== end ? item.text.slice(start, end) : item.text.slice(0, 500);
    if (!excerpt.trim()) { Alert.alert('Select a passage first', 'Highlight text in the writing area, then choose it for feedback.'); return; }
    onUse(item, start, end || Math.min(item.text.length, 500), excerpt.trim());
  };
  return <Sheet onClose={onClose} wide><Text style={s.kicker}>MANUSCRIPT READER</Text><Text style={s.title}>Highlight a passage</Text><Text style={s.hint}>Only the highlighted text will be attached to this request. Use the text selection handles, then save it.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRail}>{items.map((entry) => <Pressable key={entry.id} onPress={() => { setItemId(entry.id); setSelection({ start: 0, end: 0 }); }} style={[s.pill, item.id === entry.id && s.pillActive]}><Text style={[s.pillText, item.id === entry.id && s.pillTextActive]}>{entry.title}</Text></Pressable>)}</ScrollView><TextInput editable={false} selectTextOnFocus multiline value={item.text} onSelectionChange={(event) => setSelection(event.nativeEvent.selection)} style={s.readerText} /><Text style={s.readerSelection}>{selection.start !== selection.end ? `${selection.end - selection.start} characters selected` : 'Select text above to attach a passage.'}</Text><Pressable onPress={useSelection} style={s.primary}><Text style={s.primaryText}>Use selected passage</Text></Pressable></Sheet>;
}

export function FeedbackRequestBuilder({ project, userId, onClose, onPublished }: { project: CommunityProject; userId: string | null; onClose: () => void; onPublished?: () => void }) {
  const items = useMemo(() => normalizedParts(project), [project]);
  const [step, setStep] = useState(1);
  const [scope, setScope] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [passage, setPassage] = useState<ContentItem | null>(null);
  const [passageRange, setPassageRange] = useState({ start: 0, end: 0 });
  const [focuses, setFocuses] = useState<string[]>([]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [authorVisibility, setAuthorVisibility] = useState('display_name');
  const [readingEnabled, setReadingEnabled] = useState(true);
  const [listeningEnabled, setListeningEnabled] = useState(true);
  const [passageCommentsEnabled, setPassageCommentsEnabled] = useState(true);
  const [generalFeedbackEnabled, setGeneralFeedbackEnabled] = useState(true);
  const [closesAt, setClosesAt] = useState('');
  const [responseLimit, setResponseLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [passageOpen, setPassageOpen] = useState(false);

  const selectedItems = scope === 'passage' ? (passage ? [{ ...passage, text: passage.text.slice(passageRange.start, passageRange.end) }] : []) : scope === 'entire_manuscript' ? items : items.filter((item) => selectedIds.includes(item.id));
  const words = selectedItems.reduce((sum, item) => sum + wordsIn(item.text), 0);
  const canContinue = scope === 'passage' ? Boolean(passage && words) : selectedItems.length > 0 && selectedItems.some((item) => item.text.trim());

  const toggleItem = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  const toggleFocus = (focus: string) => setFocuses((current) => current.includes(focus) ? current.filter((entry) => entry !== focus) : [...current, focus]);
  const validatePublish = () => {
    if (!userId) { Alert.alert('Sign in to share', 'You can prepare a request, but publishing it requires a Bookez account.'); return false; }
    if (!project.id) { Alert.alert('Sync this project first', 'This writing object needs to be connected to Bookez before it can be shared with Community.'); return false; }
    if (!focuses.length && !customQuestion.trim()) { Alert.alert('Choose a feedback focus', 'Select at least one category or add a custom question.'); return false; }
    if (!canContinue) { Alert.alert('Choose content to share', 'Select at least one section with writing before publishing.'); return false; }
    return true;
  };
  const persist = async (status: 'draft' | 'open') => {
    if (!userId || !project.id) { Alert.alert('Sign in and sync first', 'A saved feedback request needs a signed-in account and a synced project.'); return; }
    if (status === 'open' && !validatePublish()) return;
    setSaving(true);
    const safeItems = selectedItems.map((item, position) => ({ id: item.id, title: item.title, position, source_type: item.source_type }));
    const authUser = await supabase.auth.getUser();
    const authorDisplayName = String(authUser.data.user?.user_metadata?.display_name ?? authUser.data.user?.email?.split('@')[0] ?? 'Bookez writer').slice(0, 120);
    const payload = { user_id: userId, project_id: project.id, project_title: project.title, author_display_name: authorDisplayName || 'Bookez writer', genre: project.genre, completion_percent: project.progress, stage: project.stage, cover_image_path: project.coverImagePath ?? null, focus: focuses[0] ?? 'General impressions', question: customQuestion.trim() || null, content_scope: scope, content_snapshot: safeItems, selected_word_count: words, reading_minutes: minutesFor(words, 220), listening_minutes: minutesFor(words, 160), selected_item_count: selectedItems.length, focuses, custom_question: customQuestion.trim() || null, author_visibility: authorVisibility, reading_enabled: readingEnabled, listening_enabled: listeningEnabled, passage_comments_enabled: passageCommentsEnabled, general_feedback_enabled: generalFeedbackEnabled, response_visibility: 'private', response_limit: responseLimit.trim() ? Number(responseLimit) : null, closes_at: closesAt.trim() || null, status };
    const requestResult = await supabase.from('community_feedback_requests').insert(payload).select('id').single();
    if (requestResult.error || !requestResult.data) { setSaving(false); Alert.alert('Could not save request', requestResult.error?.message ?? 'Please try again.'); return; }
    const contentRows = selectedItems.map((item, position) => ({ request_id: requestResult.data.id, item_id: item.id, item_title: item.title, item_text: item.text, position, source_type: item.source_type }));
    const contentResult = await supabase.from('community_feedback_request_content').insert(contentRows);
    setSaving(false);
    if (contentResult.error) { await supabase.from('community_feedback_requests').delete().eq('id', requestResult.data.id); Alert.alert('Could not attach the selected writing', 'Nothing was published. Please try again.'); return; }
    Alert.alert(status === 'open' ? 'Feedback request published' : 'Draft saved', status === 'open' ? 'Your selected writing is now available to Community readers.' : 'You can return to the Feedback Hub to finish it later.', [{ text: 'Done', onPress: () => { onPublished?.(); onClose(); } }]);
  };

  return <Sheet onClose={onClose} wide>{step === 1 && <><StepHeader step={1} title="Choose what to share" hint="Select explicit manuscript content. Bookez will never expose the rest of this project." /><View style={s.optionList}>{scopeOptions.map((option) => <Pressable key={option.key} onPress={() => { setScope(option.key); if (option.key === 'entire_manuscript') setSelectedIds(items.map((item) => item.id)); }} style={[s.option, scope === option.key && s.optionActive]}><View style={s.optionCopy}><Text style={[s.optionTitle, scope === option.key && s.optionTitleActive]}>{option.label}</Text><Text style={s.optionHint}>{option.hint}</Text></View><Text style={s.radio}>{scope === option.key ? '●' : '○'}</Text></Pressable>)}</View>{scope === 'passage' && <Pressable onPress={() => setPassageOpen(true)} style={s.secondary}><Text style={s.secondaryText}>{passage ? `Passage selected · ${wordsIn(passage.text.slice(passageRange.start, passageRange.end))} words` : 'Open manuscript reader to highlight'}</Text></Pressable>}{scope !== 'entire_manuscript' && scope !== 'passage' && <><Text style={s.sectionLabel}>MANUSCRIPT OUTLINE</Text><View style={s.outline}>{items.map((item) => <Pressable key={item.id} onPress={() => toggleItem(item.id)} style={s.outlineRow}><View style={[s.checkbox, selectedIds.includes(item.id) && s.checkboxOn]}><Text style={s.checkboxMark}>{selectedIds.includes(item.id) ? '✓' : ''}</Text></View><View style={s.outlineCopy}><Text style={s.outlineTitle}>{item.title}</Text><Text style={s.outlineMeta}>{wordsIn(item.text).toLocaleString()} words · {item.source_type}</Text></View></Pressable>)}</View></>}<Stats items={selectedItems} /><Pressable disabled={!canContinue} onPress={() => setStep(2)} style={[s.primary, !canContinue && s.disabled]}><Text style={s.primaryText}>Continue to feedback focus</Text></Pressable></>}{step === 2 && <><StepHeader step={2} title="What should readers focus on?" hint="Choose one or more areas, then add your own question if you want." /><View style={s.focusGrid}>{focusOptions.map((focus) => <Pressable key={focus} onPress={() => toggleFocus(focus)} style={[s.pill, focuses.includes(focus) && s.pillActive]}><Text style={[s.pillText, focuses.includes(focus) && s.pillTextActive]}>{focus}</Text></Pressable>)}</View><FeedbackTextInput value={customQuestion} onChangeText={setCustomQuestion} multiline placeholder="Custom question, such as: Does the opening feel strong enough?" placeholderTextColor="#A0A3BB" style={s.input} accessibilityLabel="Custom feedback question" /><View style={s.stepActions}><Pressable onPress={() => setStep(1)} style={s.secondary}><Text style={s.secondaryText}>Back</Text></Pressable><Pressable disabled={!focuses.length && !customQuestion.trim()} onPress={() => setStep(3)} style={[s.primary, (!focuses.length && !customQuestion.trim()) && s.disabled]}><Text style={s.primaryText}>Sharing settings</Text></Pressable></View></>}{step === 3 && <><StepHeader step={3} title="Set sharing permissions" hint="Responses stay private between the reader and author." /><Toggle label="Community members can read" hint="Readers only see the selected snapshot." value={readingEnabled} onChange={setReadingEnabled} /><Toggle label="Community members can listen" hint="Uses on-device text-to-speech; no audio file is stored." value={listeningEnabled} onChange={setListeningEnabled} /><Toggle label="Allow passage-specific comments" hint="Readers can highlight selected content and leave notes." value={passageCommentsEnabled} onChange={setPassageCommentsEnabled} /><Toggle label="Allow general feedback" hint="Readers can answer your focus questions." value={generalFeedbackEnabled} onChange={setGeneralFeedbackEnabled} /><Toggle label="Display my name" hint="Turn off to appear as Anonymous Writer." value={authorVisibility === 'display_name'} onChange={(value) => setAuthorVisibility(value ? 'display_name' : 'anonymous')} /><Text style={s.sectionLabel}>OPTIONAL CLOSE DATE</Text><TextInput value={closesAt} onChangeText={setClosesAt} placeholder="YYYY-MM-DD" placeholderTextColor="#A0A3BB" style={s.input} /><Text style={s.sectionLabel}>OPTIONAL RESPONSE LIMIT</Text><TextInput value={responseLimit} onChangeText={setResponseLimit} keyboardType="number-pad" placeholder="For example, 5" placeholderTextColor="#A0A3BB" style={s.input} /><View style={s.stepActions}><Pressable onPress={() => setStep(2)} style={s.secondary}><Text style={s.secondaryText}>Back</Text></Pressable><Pressable onPress={() => setStep(4)} style={s.primary}><Text style={s.primaryText}>Preview request</Text></Pressable></View></>}{step === 4 && <><StepHeader step={4} title="Preview and publish" hint="Review the exact content and permissions before you intentionally publish." /><ScrollView showsVerticalScrollIndicator={false} style={s.previewScroll}><View style={s.previewHeader}><Cover title={project.title} imagePath={project.coverImagePath} /><View style={s.previewCopy}><Text style={s.previewTitle}>{project.title}</Text><Text style={s.previewMeta}>{project.genre} · {project.progress}% · {authorVisibility === 'display_name' ? 'You' : 'Anonymous Writer'}</Text></View></View><Text style={s.previewLabel}>SHARED CONTENT</Text><Text style={s.previewValue}>{scopeLabel(scope, selectedItems.length)}</Text><Text style={s.previewValue}>{selectedItems.map((item) => item.title).join(' · ')}</Text><Stats items={selectedItems} /><Text style={s.previewLabel}>FOCUS</Text><Text style={s.previewValue}>{focuses.join(' · ') || 'Custom question'}</Text>{customQuestion.trim() && <Text style={s.previewQuestion}>“{customQuestion.trim()}”</Text>}<Text style={s.previewLabel}>PERMISSIONS</Text><Text style={s.previewValue}>{readingEnabled ? 'Read' : 'Reading off'} · {listeningEnabled ? 'Listen' : 'Listening off'} · Private responses</Text></ScrollView><View style={s.stepActions}><Pressable onPress={() => setStep(3)} style={s.secondary}><Text style={s.secondaryText}>Edit</Text></Pressable><Pressable disabled={saving} onPress={() => void persist('open')} style={[s.primary, saving && s.disabled]}><Text style={s.primaryText}>{saving ? 'Publishing…' : 'Publish Feedback Request'}</Text></Pressable></View><Pressable disabled={saving} onPress={() => void persist('draft')} style={s.draftButton}><Text style={s.draftText}>Save as draft</Text></Pressable></>}{passageOpen && <PassagePicker items={items} onClose={() => setPassageOpen(false)} onUse={(item, start, end) => { setPassage(item); setPassageRange({ start, end }); setPassageOpen(false); }} />}</Sheet>;
}

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Pressable onPress={() => onChange(!value)} style={s.toggleRow}><View style={s.toggleCopy}><Text style={s.toggleTitle}>{label}</Text><Text style={s.toggleHint}>{hint}</Text></View><View style={[s.switch, value && s.switchOn]}><View style={[s.switchThumb, value && s.switchThumbOn]} /></View></Pressable>;
}

function RequestCard({ request, onOpen, own = false, responseCount = 0 }: { request: FeedbackRequest; onOpen: () => void; own?: boolean; responseCount?: number }) {
  const focuses = asStringArray(request.focuses);
  const closed = request.status === 'closed' || (request.closes_at ? Date.parse(request.closes_at) < Date.now() : false);
  return <Pressable onPress={onOpen} style={s.requestCard}><View style={s.requestTop}><Cover title={request.project_title} imagePath={request.cover_image_path} /><View style={s.requestCopy}><Text style={s.requestTitle} numberOfLines={2}>{request.project_title}</Text><Text style={s.requestMeta}>{own ? 'Your request' : request.author_visibility === 'anonymous' ? 'Anonymous Writer' : request.author_display_name} · {request.genre ?? 'Writing project'}</Text><Text style={s.requestScope}>{scopeLabel(request.content_scope, request.selected_item_count)} · {request.reading_minutes} min read · {request.listening_minutes} min listen</Text></View></View><View style={s.requestFocusRow}>{focuses.slice(0, 3).map((focus) => <View key={focus} style={s.miniPill}><Text style={s.miniPillText}>{focus}</Text></View>)}{request.custom_question && <View style={s.miniPill}><Text style={s.miniPillText}>Custom question</Text></View>}</View><View style={s.requestFooter}><Text style={[s.requestStatus, closed && s.requestClosed]}>{closed ? 'Closed' : request.status === 'draft' ? 'Draft' : 'Open for feedback'}</Text><Text style={s.requestDate}>{responseCount} response{responseCount === 1 ? '' : 's'} · {request.closes_at ? `Closes ${new Date(request.closes_at).toLocaleDateString()}` : `${request.selected_word_count.toLocaleString()} words`}</Text><Text style={s.requestArrow}>›</Text></View></Pressable>;
}

function HubTabs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tabs = [['needs', 'Needs Feedback'], ['mine', 'My Requests'], ['received', 'Responses Received'], ['given', 'Feedback I Gave'], ['drafts', 'Drafts'], ['closed', 'Closed']];
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>{tabs.map(([key, label]) => <Pressable key={key} onPress={() => onChange(key)} style={[s.tab, value === key && s.tabActive]}><Text style={[s.tabText, value === key && s.tabTextActive]}>{label}</Text></Pressable>)}</ScrollView>;
}

async function loadResponseCount(requestIds: string[]) {
  if (!requestIds.length) return new Map<string, number>();
  const { data } = await supabase.from('community_feedback_responses').select('request_id,status').in('request_id', requestIds).eq('status', 'submitted');
  const counts = new Map<string, number>();
  (data ?? []).forEach((row) => counts.set(row.request_id, (counts.get(row.request_id) ?? 0) + 1));
  return counts;
}

export function FeedbackHub({ userId, initialRequestId, onChanged, onClose }: { userId: string | null; initialRequestId?: string; onChanged?: () => void; onClose: () => void }) {
  const [tab, setTab] = useState('needs');
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<FeedbackRequest | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const load = async () => {
    setLoading(true); setOffline(false);
    const { data, error } = await supabase.from('community_feedback_requests').select('*').order('created_at', { ascending: false });
    if (error) { setOffline(true); setRequests([]); setLoading(false); return; }
    const next = (data ?? []) as unknown as FeedbackRequest[];
    setRequests(next); setCounts(await loadResponseCount(next.map((request) => request.id))); setLoading(false);
  };
  useEffect(() => { if (userId) void load(); else { setLoading(false); setRequests([]); } }, [userId]);
  useEffect(() => { if (initialRequestId) { const request = requests.find((entry) => entry.id === initialRequestId); if (request) setSelected(request); } }, [initialRequestId, requests]);

  const visible = useMemo(() => {
    if (tab === 'needs') return requests.filter((request) => request.status === 'open' && request.user_id !== userId);
    if (tab === 'mine') return requests.filter((request) => request.user_id === userId && request.status !== 'draft' && request.status !== 'closed');
    if (tab === 'drafts') return requests.filter((request) => request.user_id === userId && request.status === 'draft');
    if (tab === 'closed') return requests.filter((request) => request.status === 'closed' && request.user_id === userId);
    if (tab === 'received') return requests.filter((request) => request.user_id === userId && (counts.get(request.id) ?? 0) > 0);
    return requests.filter((request) => request.user_id !== userId && (counts.get(request.id) ?? 0) > 0);
  }, [counts, requests, tab, userId]);

  return <Sheet onClose={onClose} wide><View style={s.hubHeader}><View><Text style={s.kicker}>COMMUNITY / SEE ALL</Text><Text style={s.title}>Feedback Hub</Text><Text style={s.hint}>Read, listen, and give thoughtful perspective without exposing private manuscripts.</Text></View><Pressable onPress={onClose}><Text style={s.close}>×</Text></Pressable></View><HubTabs value={tab} onChange={setTab} />{loading ? <View style={s.empty}><Text style={s.emptyIcon}>◌</Text><Text style={s.emptyTitle}>Loading feedback requests…</Text></View> : offline ? <View style={s.empty}><Text style={s.emptyIcon}>!</Text><Text style={s.emptyTitle}>Feedback Hub is offline</Text><Text style={s.emptyHint}>Your drafts and private writing remain safe. Try again when connected.</Text><Pressable onPress={() => void load()} style={s.secondary}><Text style={s.secondaryText}>Retry</Text></Pressable></View> : <ScrollView showsVerticalScrollIndicator={false}>{visible.length ? visible.map((request) => <RequestCard key={request.id} request={request} responseCount={counts.get(request.id) ?? 0} own={request.user_id === userId} onOpen={() => setSelected(request)} />) : <View style={s.empty}><Text style={s.emptyIcon}>{tab === 'needs' ? '✦' : '◌'}</Text><Text style={s.emptyTitle}>{tab === 'needs' ? 'No open requests yet' : 'Nothing here yet'}</Text><Text style={s.emptyHint}>{tab === 'needs' ? 'When another writer asks for perspective, their selected pages will appear here.' : 'Your feedback activity will appear in this space.'}</Text></View>}</ScrollView>}{selected && <FeedbackRequestDetail request={selected} userId={userId} responseCount={counts.get(selected.id) ?? 0} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); onChanged?.(); void load(); }} />}</Sheet>;
}

function RequestSummary({ request, responseCount }: { request: FeedbackRequest; responseCount: number }) {
  return <View style={s.detailSummary}><Cover title={request.project_title} imagePath={request.cover_image_path} large /><View style={s.detailSummaryCopy}><Text style={s.detailTitle}>{request.project_title}</Text><Text style={s.detailMeta}>{request.author_visibility === 'anonymous' ? 'Anonymous Writer' : request.author_display_name} · {request.genre ?? 'Writing project'}</Text><Text style={s.detailMeta}>{scopeLabel(request.content_scope, request.selected_item_count)}</Text><Text style={s.detailMeta}>{request.selected_word_count.toLocaleString()} words · {request.reading_minutes} min read</Text><Text style={s.detailMeta}>{responseCount} response{responseCount === 1 ? '' : 's'}</Text></View></View>;
}

function FeedbackResponseCard({ response, authorView, reply, readerResponse, onUpdate, onSaveReply }: { response: FeedbackResponse; authorView: boolean; reply?: FeedbackReply; readerResponse?: ReaderResponse; onUpdate: () => void; onSaveReply: (responseId: string, body: string) => Promise<void> }) {
  const name = response.anonymous ? 'Anonymous Writer' : 'Community reader';
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState(reply?.body ?? '');
  const update = async (changes: { is_helpful?: boolean; thanked_at?: string; archived?: boolean }) => { const { error } = await supabase.from('community_feedback_responses').update(changes).eq('id', response.id); if (error) Alert.alert('Could not update response', error.message); else onUpdate(); };
  const quickReactions = asStringArray(response.quick_reactions);
  return <View style={[s.responseCard, response.archived && s.archived]}><View style={s.responseHeader}><Text style={s.responseName}>{name}</Text><Text style={s.responseDate}>{response.submitted_at ? new Date(response.submitted_at).toLocaleDateString() : 'Draft'}</Text></View>{quickReactions.length > 0 && <View style={s.responseReactionRow}>{quickReactions.map((key) => <View key={key} style={s.miniPill}><Text style={s.miniPillText}>{quickReactionOptions.find((option) => option.key === key)?.label ?? key}</Text></View>)}</View>}{response.overall_impression && <ResponseField label="Overall impression" value={response.overall_impression} />}{response.strengths && <ResponseField label="What worked well" value={response.strengths} />}{response.unclear_sections && <ResponseField label="What felt unclear" value={response.unclear_sections} />}{response.suggestions && <ResponseField label="Suggested improvement" value={response.suggestions} />}{response.additional_comments && <ResponseField label="Additional comments" value={response.additional_comments} />}{readerResponse && <View style={s.readerResponse}><Text style={s.responseLabel}>Reader response</Text><Text style={s.responseValue}>{readerResponse.body}</Text></View>}{reply && <View style={s.authorReply}><Text style={s.responseLabel}>Author reply</Text><Text style={s.responseValue}>{reply.body}</Text></View>}<View style={s.responseActions}>{authorView && <><Pressable onPress={() => void update({ is_helpful: !response.is_helpful })} style={s.textAction}><Text style={s.textActionText}>{response.is_helpful ? 'Marked helpful' : 'Mark helpful'}</Text></Pressable><Pressable onPress={() => void update({ thanked_at: new Date().toISOString() })} style={s.textAction}><Text style={s.textActionText}>{response.thanked_at ? 'Thanked' : 'Thank reader'}</Text></Pressable><Pressable onPress={() => { setReplyBody(reply?.body ?? ''); setReplyOpen((value) => !value); }} style={s.textAction}><Text style={s.textActionText}>{reply ? 'Edit reply' : 'Reply to reader'}</Text></Pressable><Pressable onPress={() => void update({ archived: !response.archived })} style={s.textAction}><Text style={s.textActionText}>{response.archived ? 'Restore' : 'Archive'}</Text></Pressable></>}</View>{authorView && replyOpen && <View style={s.replyComposer}><FeedbackTextInput value={replyBody} onChangeText={setReplyBody} multiline placeholder="Write a warm, useful reply…" placeholderTextColor="#A0A3BB" style={s.input} accessibilityLabel="Author reply" /><Pressable onPress={async () => { await onSaveReply(response.id, replyBody); setReplyOpen(false); }} style={s.primarySmall}><Text style={s.primaryText}>{reply ? 'Save reply' : 'Post reply'}</Text></Pressable></View>}</View>;
}

function ResponseField({ label, value }: { label: string; value: string }) {
  return <View style={s.responseField}><Text style={s.responseLabel}>{label}</Text><Text style={s.responseValue}>{value}</Text></View>;
}

function FeedbackRequestDetail({ request, userId, responseCount, onClose, onChanged }: { request: FeedbackRequest; userId: string | null; responseCount: number; onClose: () => void; onChanged: () => void }) {
  const own = request.user_id === userId;
  const [content, setContent] = useState<ContentItem[]>([]);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [replies, setReplies] = useState<Record<string, FeedbackReply>>({});
  const [readerResponses, setReaderResponses] = useState<ReaderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [reader, setReader] = useState(false);
  const [listener, setListener] = useState(false);
  const [composer, setComposer] = useState(false);
  const [error, setError] = useState(false);
  const focuses = asStringArray(request.focuses);

  const load = async () => {
    setLoading(true); setError(false);
    const contentResult = await supabase.from('community_feedback_request_content').select('*').eq('request_id', request.id).order('position');
    const responseResult = await supabase.from('community_feedback_responses').select('*').eq('request_id', request.id).order('created_at', { ascending: false });
    if (contentResult.error) setError(true); else setContent((contentResult.data ?? []) as unknown as ContentItem[]);
    const nextResponses = responseResult.error ? [] : (responseResult.data ?? []) as unknown as FeedbackResponse[];
    setResponses(nextResponses);
    const responseIds = nextResponses.map((response) => response.id);
    const [replyResult, readerResponseResult] = await Promise.all([
      responseIds.length ? supabase.from('community_feedback_replies').select('*').in('response_id', responseIds) : Promise.resolve({ data: [] }),
      supabase.from('community_feedback_reader_responses').select('*').eq('request_id', request.id).order('created_at', { ascending: false }),
    ]);
    const nextReplies: Record<string, FeedbackReply> = {};
    ((replyResult.data ?? []) as unknown as FeedbackReply[]).forEach((reply) => { nextReplies[reply.response_id] = reply; });
    setReplies(nextReplies);
    setReaderResponses((readerResponseResult.data ?? []) as unknown as ReaderResponse[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [request.id]);

  const setStatus = async (status: 'open' | 'closed') => { const { error: updateError } = await supabase.from('community_feedback_requests').update({ status }).eq('id', request.id); if (updateError) Alert.alert('Could not update request', updateError.message); else { Alert.alert(status === 'closed' ? 'Request closed' : 'Request reopened', status === 'closed' ? 'Readers can no longer open this content.' : 'The request is available to Community again.'); onChanged(); } };
  const saveReply = async (responseId: string, body: string) => {
    if (!userId) { Alert.alert('Sign in to reply', 'Author replies are available after you sign in.'); return; }
    if (!body.trim()) { Alert.alert('Write a reply first', 'Add a short response before posting.'); return; }
    const { error: replyError } = await supabase.from('community_feedback_replies').upsert({ request_id: request.id, response_id: responseId, author_id: userId, body: body.trim() }, { onConflict: 'response_id' });
    if (replyError) Alert.alert('Could not save reply', replyError.message); else await load();
  };
  const remove = () => Alert.alert('Remove feedback request?', 'This removes Community access and deletes its responses after confirmation.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void supabase.from('community_feedback_requests').delete().eq('id', request.id).then(({ error: deleteError }) => { if (deleteError) Alert.alert('Could not remove request', deleteError.message); else onChanged(); }); } }]);

  const submittedResponses = responses.filter((response) => response.status === 'submitted');
  return <Sheet onClose={onClose} wide><View style={s.hubHeader}><Pressable onPress={onClose}><Text style={s.back}>‹ Feedback Hub</Text></Pressable><Pressable onPress={() => void load()}><Text style={s.refresh}>↻</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false}><RequestSummary request={request} responseCount={responseCount} />{request.custom_question && <View style={s.questionBox}><Text style={s.responseLabel}>AUTHOR QUESTION</Text><Text style={s.questionText}>“{request.custom_question}”</Text></View>}<Text style={s.sectionLabel}>FEEDBACK FOCUS</Text><View style={s.focusGrid}>{focuses.map((focus) => <View key={focus} style={s.miniPill}><Text style={s.miniPillText}>{focus}</Text></View>)}</View>{loading ? <Text style={s.loadingText}>Opening shared content…</Text> : error ? <View style={s.empty}><Text style={s.emptyTitle}>Content unavailable</Text><Text style={s.emptyHint}>This request may have been removed or is no longer shared.</Text></View> : <><Text style={s.sectionLabel}>SHARED CONTENT</Text><Text style={s.hint}>{content.length} section{content.length === 1 ? '' : 's'} · only this selected snapshot is available</Text><View style={s.detailButtons}>{request.reading_enabled && <Pressable onPress={() => setReader(true)} style={s.primarySmall}><Text style={s.primaryText}>Read</Text></Pressable>}{request.listening_enabled && <Pressable onPress={() => setListener(true)} style={s.secondarySmall}><Text style={s.secondaryText}>Listen</Text></Pressable>}</View>{!own && request.status === 'open' && <Pressable onPress={() => setComposer(true)} style={s.primary}><Text style={s.primaryText}>Give Feedback</Text></Pressable>}{!own && readerResponses.length > 0 && <><Text style={s.sectionLabel}>READER RESPONSES</Text>{readerResponses.map((readerResponse) => <View key={readerResponse.id} style={s.publicReaderCard}><Text style={s.responseName}>{readerResponse.anonymous ? 'Anonymous Writer' : 'Community reader'}</Text><Text style={s.responseValue}>{readerResponse.body}</Text></View>)}</>}{own && <><Text style={s.sectionLabel}>RESPONSES · {submittedResponses.length}</Text>{submittedResponses.length ? submittedResponses.map((response) => <FeedbackResponseCard key={response.id} response={response} authorView reply={replies[response.id]} readerResponse={readerResponses.find((readerResponse) => readerResponse.response_id === response.id)} onUpdate={() => void load()} onSaveReply={saveReply} />) : <View style={s.emptyInline}><Text style={s.emptyTitle}>No responses yet</Text><Text style={s.emptyHint}>Readers will appear here after they submit thoughtful feedback.</Text></View>}</>}{own && <View style={s.management}><Text style={s.sectionLabel}>REQUEST MANAGEMENT</Text><Pressable onPress={() => void setStatus(request.status === 'closed' ? 'open' : 'closed')} style={s.secondary}><Text style={s.secondaryText}>{request.status === 'closed' ? 'Reopen request' : 'Close request'}</Text></Pressable><Pressable onPress={remove} style={s.dangerButton}><Text style={s.dangerText}>Remove request</Text></Pressable></View>}</>}</ScrollView>{reader && <SharedManuscriptReader request={request} content={content} userId={userId} onClose={() => setReader(false)} />}{listener && <SharedManuscriptPlayer request={request} content={content} userId={userId} onClose={() => setListener(false)} />}{composer && <FeedbackComposer request={request} userId={userId!} onClose={() => setComposer(false)} onSubmitted={() => { setComposer(false); void load(); }} />}</Sheet>;
}

function SharedManuscriptReader({ request, content, userId, onClose }: { request: FeedbackRequest; content: ContentItem[]; userId: string | null; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [fontSize, setFontSize] = useState(17);
  const [dark, setDark] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const item = content[index];
  const words = content.reduce((sum, entry) => sum + wordsIn(entry.text), 0);
  const completedWords = content.slice(0, index).reduce((sum, entry) => sum + wordsIn(entry.text), 0);
  useEffect(() => { if (!userId) return; void supabase.from('community_feedback_reader_progress').select('*').eq('request_id', request.id).eq('user_id', userId).maybeSingle().then(({ data }) => { if (data) setIndex(Math.min(Number(data.item_index ?? 0), Math.max(0, content.length - 1))); }); }, [content.length, request.id, userId]);
  useEffect(() => { return () => { if (userId) void supabase.from('community_feedback_reader_progress').upsert({ request_id: request.id, user_id: userId, item_index: index, word_offset: completedWords }, { onConflict: 'request_id,user_id' }); }; }, [completedWords, index, request.id, userId]);
  if (!item) return <Sheet onClose={onClose}><Text style={s.title}>No shared content</Text><Text style={s.hint}>This request no longer has a readable snapshot.</Text></Sheet>;
  const saveNote = async () => { const start = Math.min(selection.start, selection.end); const end = Math.max(selection.start, selection.end); const excerpt = item.text.slice(start, end); if (!note.trim() || !excerpt.trim() || !userId) { Alert.alert('Select text and add a note', 'Highlight a passage, then write what you noticed.'); return; } const { error } = await supabase.from('community_feedback_annotations').insert({ request_id: request.id, responder_id: userId, item_id: item.id, text_start: start, text_end: end, quoted_excerpt: excerpt, comment_text: note.trim() }); if (error) Alert.alert('Could not save passage feedback', error.message); else { setNote(''); setNoteOpen(false); Alert.alert('Passage feedback saved', 'You can include it with your feedback response.'); } };
  return <Sheet onClose={onClose} wide><View style={s.readerHeader}><View><Text style={s.kicker}>READING SHARED CONTENT</Text><Text style={s.readerTitle}>{request.project_title}</Text></View><Pressable onPress={onClose}><Text style={s.close}>×</Text></Pressable></View><View style={s.readerToolbar}><Pressable onPress={() => setFontSize((value) => Math.max(14, value - 1))} style={s.toolButton}><Text style={s.toolText}>A−</Text></Pressable><Text style={s.progressText}>{index + 1} / {content.length}</Text><Pressable onPress={() => setFontSize((value) => Math.min(24, value + 1))} style={s.toolButton}><Text style={s.toolText}>A+</Text></Pressable><Pressable onPress={() => setDark((value) => !value)} style={s.toolButton}><Text style={s.toolText}>{dark ? '☼' : '◐'}</Text></Pressable></View><View style={[s.readerProgress, { backgroundColor: dark ? '#3D405D' : '#ECEAF6' }]}><View style={[s.readerProgressFill, { width: `${Math.min(100, ((completedWords + wordsIn(item.text) * 0.25) / Math.max(1, words)) * 100)}%` }]} /></View><Text style={[s.readerSection, dark && s.darkText]}>{item.title}</Text><TextInput editable={false} selectTextOnFocus multiline value={item.text} selectionColor={C.purple} onSelectionChange={(event) => setSelection(event.nativeEvent.selection)} style={[s.readerBody, dark && s.readerBodyDark, { fontSize }]} /><Text style={[s.readerRemaining, dark && s.darkText]}>About {Math.max(1, minutesFor(Math.max(0, words - completedWords), 220))} minutes remaining</Text>{request.passage_comments_enabled && <><Pressable onPress={() => setNoteOpen((value) => !value)} style={s.secondary}><Text style={s.secondaryText}>Add feedback to highlighted passage</Text></Pressable>{noteOpen && <View style={s.noteBox}><FeedbackTextInput value={note} onChangeText={setNote} multiline placeholder="What should the author notice here?" placeholderTextColor="#A0A3BB" style={s.input} accessibilityLabel="Passage feedback note" /><Pressable onPress={() => void saveNote()} style={s.primary}><Text style={s.primaryText}>Save passage feedback</Text></Pressable></View>}</>}<View style={s.readerNav}><Pressable disabled={index === 0} onPress={() => setIndex((value) => Math.max(0, value - 1))} style={[s.secondarySmall, index === 0 && s.disabled]}><Text style={s.secondaryText}>Previous</Text></Pressable><Pressable disabled={index === content.length - 1} onPress={() => setIndex((value) => Math.min(content.length - 1, value + 1))} style={[s.primarySmall, index === content.length - 1 && s.disabled]}><Text style={s.primaryText}>Next section</Text></Pressable></View></Sheet>;
}

function SharedManuscriptPlayer({ request, content, userId, onClose }: { request: FeedbackRequest; content: ContentItem[]; userId: string | null; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState<string | undefined>();
  const item = content[index];
  useEffect(() => { void Speech.getAvailableVoicesAsync().then((voices) => { if (voices[0]?.identifier) setVoice(voices[0].identifier); }); return () => { void Speech.stop(); }; }, []);
  useEffect(() => { if (!playing || !item?.text) return; void Speech.stop(); Speech.speak(item.text, { rate: speed, voice, onDone: () => { if (index < content.length - 1) setIndex((value) => value + 1); else setPlaying(false); }, onStopped: () => setPlaying(false), onError: () => { setPlaying(false); Alert.alert('Listening unavailable', 'Text-to-speech could not start on this device.'); } }); }, [index, playing, speed, voice]);
  if (!item) return <Sheet onClose={onClose}><Text style={s.title}>No shared content</Text></Sheet>;
  const stopAnd = (next: number) => { void Speech.stop(); setPlaying(false); setIndex(Math.max(0, Math.min(content.length - 1, next))); };
  return <Sheet onClose={() => { void Speech.stop(); onClose(); }} wide><View style={s.readerHeader}><View><Text style={s.kicker}>LISTEN TO SHARED CONTENT</Text><Text style={s.readerTitle}>{request.project_title}</Text></View><Pressable onPress={onClose}><Text style={s.close}>×</Text></Pressable></View><View style={s.playerCard}><Text style={s.playerIcon}>◖</Text><Text style={s.playerSection}>{item.title}</Text><Text style={s.playerMeta}>{minutesFor(wordsIn(item.text), 160)} minutes · section {index + 1} of {content.length}</Text><View style={s.playerProgress}><View style={[s.readerProgressFill, { width: `${((index + 1) / content.length) * 100}%` }]} /></View><View style={s.playerActions}><Pressable onPress={() => stopAnd(index - 1)} style={s.toolButton}><Text style={s.toolText}>‹</Text></Pressable><Pressable onPress={() => setPlaying((value) => !value)} style={s.playButton}><Text style={s.playText}>{playing ? 'Ⅱ' : '▶'}</Text></Pressable><Pressable onPress={() => stopAnd(index + 1)} style={s.toolButton}><Text style={s.toolText}>›</Text></Pressable></View></View><Text style={s.sectionLabel}>PLAYBACK SPEED</Text><View style={s.focusGrid}>{[0.8, 1, 1.2, 1.5].map((value) => <Pressable key={value} onPress={() => setSpeed(value)} style={[s.pill, speed === value && s.pillActive]}><Text style={[s.pillText, speed === value && s.pillTextActive]}>{value}×</Text></Pressable>)}</View><Text style={s.hint}>Playback uses on-device text-to-speech and reads only the selected writing snapshot. Resume position is saved when you close this player.</Text><Pressable onPress={onClose} style={s.primary}><Text style={s.primaryText}>Done listening</Text></Pressable></Sheet>;
}

function FeedbackComposer({ request, userId, onClose, onSubmitted }: { request: FeedbackRequest; userId: string; onClose: () => void; onSubmitted: () => void }) {
  const [overall, setOverall] = useState('');
  const [strengths, setStrengths] = useState('');
  const [unclear, setUnclear] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [additional, setAdditional] = useState('');
  const [readerResponse, setReaderResponse] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [quickReactions, setQuickReactions] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const meaningful = [overall, strengths, unclear, suggestions, additional, questionAnswer].some((value) => value.trim());
  useEffect(() => { void supabase.from('community_feedback_responses').select('*').eq('request_id', request.id).eq('responder_id', userId).maybeSingle().then(async ({ data }) => { const response = data as unknown as FeedbackResponse | null; if (response) { setOverall(response.overall_impression ?? ''); setStrengths(response.strengths ?? ''); setUnclear(response.unclear_sections ?? ''); setSuggestions(response.suggestions ?? ''); setAdditional(response.additional_comments ?? ''); setAnonymous(response.anonymous); setQuickReactions(asStringArray(response.quick_reactions)); const answers = response.question_answers && typeof response.question_answers === 'object' && !Array.isArray(response.question_answers) ? response.question_answers as Record<string, unknown> : {}; setQuestionAnswer(request.custom_question ? String(answers[request.custom_question] ?? '') : ''); const { data: publicResponse } = await supabase.from('community_feedback_reader_responses').select('body,anonymous').eq('request_id', request.id).eq('responder_id', userId).maybeSingle(); setReaderResponse(publicResponse?.body ?? ''); if (publicResponse) setAnonymous(publicResponse.anonymous); } }); }, [request.custom_question, request.id, userId]);
  const save = async (status: 'draft' | 'submitted') => {
    if (status === 'submitted' && !meaningful) { Alert.alert('Add some feedback first', 'A response needs at least one meaningful note before it can be submitted.'); return; }
    if (status === 'submitted') { Alert.alert('Submit feedback?', 'Your response will be private between you and the author.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: () => { void saveNow(status); } }]); return; }
    await saveNow(status);
  };
  const saveNow = async (status: 'draft' | 'submitted') => {
    setSaving(true);
    const { data: savedResponse, error } = await supabase.from('community_feedback_responses').upsert({ request_id: request.id, responder_id: userId, anonymous, overall_impression: overall.trim() || null, strengths: strengths.trim() || null, unclear_sections: unclear.trim() || null, suggestions: suggestions.trim() || null, additional_comments: additional.trim() || null, question_answers: request.custom_question && questionAnswer.trim() ? { [request.custom_question]: questionAnswer.trim() } : {}, quick_reactions: quickReactions, status, submitted_at: status === 'submitted' ? new Date().toISOString() : null }, { onConflict: 'request_id,responder_id' }).select('id').single();
    setSaving(false);
    if (error) { Alert.alert('Could not save feedback', error.message); return; }
    if (savedResponse?.id && readerResponse.trim() && status === 'submitted') { const { error: publicResponseError } = await supabase.from('community_feedback_reader_responses').upsert({ request_id: request.id, response_id: savedResponse.id, responder_id: userId, anonymous, body: readerResponse.trim() }, { onConflict: 'request_id,responder_id' }); if (publicResponseError) { Alert.alert('Feedback saved, but Reader response could not be shared', publicResponseError.message); return; } }
    if (savedResponse?.id && !readerResponse.trim()) await supabase.from('community_feedback_reader_responses').delete().eq('request_id', request.id).eq('responder_id', userId);
    if (status === 'submitted') { Alert.alert('Feedback submitted', 'Thank you for helping another writer.', [{ text: 'Done', onPress: onSubmitted }]); } else Alert.alert('Draft saved', 'You can return to finish this response later.');
  };
  const field = (label: string, value: string, setValue: (value: string) => void, placeholder: string) => <View><Text style={s.sectionLabel}>{label}</Text><FeedbackTextInput value={value} onChangeText={setValue} multiline placeholder={placeholder} placeholderTextColor="#A0A3BB" style={s.input} accessibilityLabel={label} /><Text style={s.dictationHint}>You can tap the keyboard microphone to dictate, then edit the text before saving.</Text></View>;
  const toggleQuickReaction = (key: string) => setQuickReactions((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]);
  return <Sheet onClose={onClose} wide><View style={s.hubHeader}><View><Text style={s.kicker}>PRIVATE RESPONSE</Text><Text style={s.title}>Give thoughtful feedback</Text></View><Pressable onPress={onClose}><Text style={s.close}>×</Text></Pressable></View>{preview ? <ScrollView showsVerticalScrollIndicator={false}><Text style={s.previewLabel}>PREVIEW</Text><Text style={s.previewTitle}>{request.project_title}</Text>{quickReactions.length > 0 && <ResponseField label="Quick reactions" value={quickReactions.map((key) => quickReactionOptions.find((option) => option.key === key)?.label ?? key).join(' · ')} />}{request.custom_question && questionAnswer.trim() && <ResponseField label="Answer to author question" value={questionAnswer} />}{[["Overall impression", overall], ["What worked well", strengths], ["What felt unclear", unclear], ["Suggested improvement", suggestions], ["Additional comments", additional], ["Reader response", readerResponse]].filter(([, value]) => value.trim()).map(([label, value]) => <ResponseField key={label} label={label} value={value} />)}{!meaningful && <Text style={s.emptyHint}>Nothing written yet.</Text>}</ScrollView> : <ScrollView showsVerticalScrollIndicator={false}>{request.custom_question && field('ANSWER THE AUTHOR’S QUESTION', questionAnswer, setQuestionAnswer, request.custom_question)}<Text style={s.sectionLabel}>QUICK REACTIONS</Text><Text style={s.hint}>Tap any signals that match your reading.</Text><View style={s.focusGrid}>{quickReactionOptions.map((option) => <Pressable key={option.key} onPress={() => toggleQuickReaction(option.key)} style={[s.pill, quickReactions.includes(option.key) && s.pillActive]}><Text style={[s.pillText, quickReactions.includes(option.key) && s.pillTextActive]}>{option.label}</Text></Pressable>)}</View>{request.general_feedback_enabled && field('OVERALL IMPRESSION', overall, setOverall, 'What stayed with you after reading?')}{field('WHAT WORKED WELL', strengths, setStrengths, 'Name a moment, idea, or choice that worked.')}{field('WHAT FELT UNCLEAR', unclear, setUnclear, 'Where did you lose confidence or need more context?')}{field('SUGGESTED IMPROVEMENT', suggestions, setSuggestions, 'What is one useful next step for the author?')}{field('ADDITIONAL COMMENTS', additional, setAdditional, 'Anything else the author should know?')}<Text style={s.sectionLabel}>READER RESPONSE · OPTIONAL</Text><FeedbackTextInput value={readerResponse} onChangeText={setReaderResponse} multiline placeholder="Leave one short public note for future readers…" placeholderTextColor="#A0A3BB" style={s.input} accessibilityLabel="Reader response" /><Text style={s.dictationHint}>This is the only part other readers can see.</Text><Toggle label="Send anonymously" hint="The author and other readers will see Anonymous Writer instead of your name." value={anonymous} onChange={setAnonymous} /></ScrollView>}<View style={s.stepActions}><Pressable onPress={() => setPreview((value) => !value)} style={s.secondary}><Text style={s.secondaryText}>{preview ? 'Edit feedback' : 'Preview feedback'}</Text></Pressable><Pressable disabled={saving} onPress={() => void save('draft')} style={s.secondarySmall}><Text style={s.secondaryText}>{saving ? 'Saving…' : 'Save draft'}</Text></Pressable><Pressable disabled={saving} onPress={() => void save('submitted')} style={[s.primarySmall, saving && s.disabled]}><Text style={s.primaryText}>Submit</Text></Pressable></View></Sheet>;
}

const s = StyleSheet.create({
  responseReactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }, readerResponse: { marginTop: 10, padding: 9, borderRadius: 11, backgroundColor: '#F4F2FC' }, publicReaderCard: { marginTop: 8, padding: 11, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border }, authorReply: { marginTop: 10, padding: 9, borderLeftWidth: 2, borderLeftColor: C.purple, backgroundColor: '#F8F7FF' }, replyComposer: { marginTop: 8 },
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,41,84,0.28)' }, dismiss: { ...StyleSheet.absoluteFill }, sheet: { maxHeight: '94%', padding: 20, paddingBottom: 28, borderTopLeftRadius: 29, borderTopRightRadius: 29, backgroundColor: C.paper }, wideSheet: { maxHeight: '96%' }, handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D7E4', marginBottom: 14 }, kicker: { color: C.purple, fontSize: 7, letterSpacing: 0.9, fontWeight: '800' }, title: { color: C.ink, fontSize: 22, lineHeight: 27, fontWeight: '800', marginTop: 5 }, hint: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 5 }, close: { color: C.ink, fontSize: 23 }, back: { color: C.purple, fontSize: 10, fontWeight: '800' }, refresh: { color: C.purple, fontSize: 20 }, optionList: { marginTop: 16, gap: 7 }, option: { minHeight: 58, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, optionActive: { backgroundColor: C.lavender, borderColor: '#C9C1F6' }, optionCopy: { flex: 1, paddingRight: 8 }, optionTitle: { color: C.ink, fontSize: 10, fontWeight: '800' }, optionTitleActive: { color: C.purple }, optionHint: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 3 }, radio: { color: C.purple, fontSize: 17 }, sectionLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.8, fontWeight: '800', marginTop: 16 }, outline: { marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: '#FFF' }, outlineRow: { minHeight: 52, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F0EEF5', flexDirection: 'row', alignItems: 'center' }, checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: '#D7D5E3', alignItems: 'center', justifyContent: 'center' }, checkboxOn: { backgroundColor: C.purple, borderColor: C.purple }, checkboxMark: { color: '#FFF', fontSize: 13, fontWeight: '800' }, outlineCopy: { marginLeft: 9, flex: 1 }, outlineTitle: { color: C.ink, fontSize: 9, fontWeight: '800' }, outlineMeta: { color: C.muted, fontSize: 7, marginTop: 3 }, stats: { marginTop: 15, padding: 11, borderRadius: 14, backgroundColor: '#F4F2FC', flexDirection: 'row', justifyContent: 'space-between' }, statValue: { color: C.ink, fontSize: 11, fontWeight: '800', textAlign: 'center' }, statLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.6, fontWeight: '800', marginTop: 3, textAlign: 'center' }, primary: { minHeight: 43, marginTop: 15, borderRadius: 13, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, primarySmall: { minHeight: 38, flex: 1, borderRadius: 12, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 }, primaryText: { color: '#FFF', fontSize: 9, fontWeight: '800', textAlign: 'center' }, secondary: { minHeight: 42, marginTop: 11, borderRadius: 13, backgroundColor: '#F2F1F7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, secondarySmall: { minHeight: 38, flex: 1, borderRadius: 12, backgroundColor: '#F2F1F7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 }, secondaryText: { color: C.purple, fontSize: 9, fontWeight: '800', textAlign: 'center' }, disabled: { opacity: 0.5 }, stepActions: { flexDirection: 'row', gap: 7, marginTop: 15, alignItems: 'center' }, focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }, pill: { minHeight: 31, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F2F1F7', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }, pillActive: { backgroundColor: C.lavender, borderColor: '#C9C1F6' }, pillText: { color: C.muted, fontSize: 8, fontWeight: '700' }, pillTextActive: { color: C.purple }, pillRail: { paddingTop: 10, gap: 6 }, dictationField: { position: 'relative' }, dictationInput: { paddingRight: 38 }, dictationButton: { position: 'absolute', right: 5, bottom: 7, width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFF', borderWidth: 1, borderColor: '#DDD8FA' }, dictationIcon: { fontSize: 14, lineHeight: 16 }, input: { minHeight: 72, marginTop: 8, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border, color: C.ink, fontSize: 10, textAlignVertical: 'top' }, toggleRow: { minHeight: 58, marginTop: 8, paddingHorizontal: 11, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center' }, toggleCopy: { flex: 1, paddingRight: 9 }, toggleTitle: { color: C.ink, fontSize: 9, fontWeight: '800' }, toggleHint: { color: C.muted, fontSize: 8, lineHeight: 12, marginTop: 3 }, switch: { width: 42, height: 25, padding: 3, borderRadius: 14, backgroundColor: '#DADBE7' }, switchOn: { backgroundColor: '#BAB6F1' }, switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#FFF' }, switchThumbOn: { alignSelf: 'flex-end' }, previewScroll: { maxHeight: 440, marginTop: 15 }, previewHeader: { flexDirection: 'row', alignItems: 'center' }, previewCopy: { flex: 1, marginLeft: 12 }, previewTitle: { color: C.ink, fontSize: 14, lineHeight: 18, fontWeight: '800' }, previewMeta: { color: C.muted, fontSize: 8, marginTop: 5 }, previewLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.8, fontWeight: '800', marginTop: 15 }, previewValue: { color: C.ink, fontSize: 9, lineHeight: 14, marginTop: 4 }, previewQuestion: { color: C.purple, fontSize: 10, lineHeight: 15, marginTop: 8 }, draftButton: { alignItems: 'center', padding: 9 }, draftText: { color: C.purple, fontSize: 9, fontWeight: '800' }, cover: { width: 61, height: 82, borderRadius: 12, backgroundColor: '#5B638E', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, coverLarge: { width: 82, height: 110, borderRadius: 16 }, coverImage: { width: '100%', height: '100%' }, coverGlow: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,220,75,0.38)', opacity: 0.8 }, coverMark: { color: '#FFF', fontSize: 20, fontWeight: '800' }, coverType: { color: 'rgba(255,255,255,0.85)', fontSize: 5, letterSpacing: 0.8, fontWeight: '800', marginTop: 3 }, readerText: { minHeight: 190, maxHeight: 310, marginTop: 12, padding: 12, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border, color: C.ink, fontSize: 16, lineHeight: 26, textAlignVertical: 'top' }, readerSelection: { color: C.muted, fontSize: 8, marginTop: 6 }, hubHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, tabs: { gap: 6, paddingVertical: 15 }, tab: { minHeight: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F2F1F7', justifyContent: 'center' }, tabActive: { backgroundColor: C.lavender }, tabText: { color: C.muted, fontSize: 8, fontWeight: '700' }, tabTextActive: { color: C.purple }, requestCard: { marginBottom: 9, padding: 11, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border }, requestTop: { flexDirection: 'row' }, requestCopy: { flex: 1, marginLeft: 10 }, requestTitle: { color: C.ink, fontSize: 12, lineHeight: 16, fontWeight: '800' }, requestMeta: { color: C.muted, fontSize: 8, marginTop: 4 }, requestScope: { color: C.purple, fontSize: 8, lineHeight: 12, marginTop: 4 }, requestFocusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 }, miniPill: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, backgroundColor: C.lavender }, miniPillText: { color: C.purple, fontSize: 7, fontWeight: '700' }, requestFooter: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0EEF5', flexDirection: 'row', alignItems: 'center' }, requestStatus: { color: C.green, fontSize: 8, fontWeight: '800' }, requestClosed: { color: '#A97819' }, requestDate: { color: C.muted, fontSize: 7, marginLeft: 8 }, requestArrow: { color: '#BDB7EA', fontSize: 19, marginLeft: 'auto' }, detailSummary: { flexDirection: 'row', alignItems: 'center', marginTop: 14 }, detailSummaryCopy: { flex: 1, marginLeft: 13 }, detailTitle: { color: C.ink, fontSize: 20, lineHeight: 24, fontWeight: '800' }, detailMeta: { color: C.muted, fontSize: 8, marginTop: 5 }, questionBox: { marginTop: 15, padding: 12, borderRadius: 13, backgroundColor: '#FFF6DB', borderWidth: 1, borderColor: '#F2E2B4' }, questionText: { color: '#7E682F', fontSize: 10, lineHeight: 15, marginTop: 5 }, detailButtons: { flexDirection: 'row', gap: 7, marginTop: 12 }, management: { marginTop: 13, paddingTop: 4, paddingBottom: 10 }, dangerButton: { minHeight: 42, marginTop: 8, borderRadius: 13, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' }, dangerText: { color: '#B5545F', fontSize: 9, fontWeight: '800' }, responseCard: { marginTop: 9, padding: 12, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.border }, archived: { opacity: 0.62 }, responseHeader: { flexDirection: 'row', justifyContent: 'space-between' }, responseName: { color: C.ink, fontSize: 9, fontWeight: '800' }, responseDate: { color: C.muted, fontSize: 7 }, responseField: { marginTop: 9 }, responseLabel: { color: C.muted, fontSize: 7, letterSpacing: 0.6, fontWeight: '800' }, responseValue: { color: C.ink, fontSize: 9, lineHeight: 14, marginTop: 3 }, responseActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, textAction: { paddingVertical: 4 }, textActionText: { color: C.purple, fontSize: 8, fontWeight: '800' }, empty: { minHeight: 170, alignItems: 'center', justifyContent: 'center', padding: 18 }, emptyInline: { marginTop: 8, padding: 16, borderRadius: 13, backgroundColor: '#F4F2FC', alignItems: 'center' }, emptyIcon: { color: '#BDB7EA', fontSize: 26 }, emptyTitle: { color: C.ink, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 7 }, emptyHint: { color: C.muted, fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: 4, maxWidth: 280 }, loadingText: { color: C.muted, fontSize: 9, marginTop: 12, textAlign: 'center' }, readerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, readerTitle: { color: C.ink, fontSize: 16, fontWeight: '800', marginTop: 4 }, readerToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }, toolButton: { minWidth: 34, height: 32, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#F2F1F7', alignItems: 'center', justifyContent: 'center' }, toolText: { color: C.purple, fontSize: 10, fontWeight: '800' }, progressText: { color: C.muted, fontSize: 8, flex: 1, textAlign: 'center' }, readerProgress: { height: 5, marginTop: 10, borderRadius: 3, overflow: 'hidden' }, readerProgressFill: { height: '100%', backgroundColor: C.purple, borderRadius: 3 }, readerSection: { color: C.ink, fontSize: 15, fontWeight: '800', marginTop: 16 }, readerBody: { minHeight: 230, maxHeight: 340, marginTop: 8, padding: 0, color: C.ink, fontSize: 17, lineHeight: 28, textAlignVertical: 'top' }, readerRemaining: { color: C.muted, fontSize: 8, marginTop: 5 }, darkText: { color: '#F1F0FA' }, readerBodyDark: { color: '#F1F0FA', backgroundColor: '#30334E', borderRadius: 12, padding: 12 }, noteBox: { marginTop: 8 }, readerNav: { flexDirection: 'row', gap: 7, marginTop: 12 }, playerCard: { marginTop: 18, padding: 20, borderRadius: 21, backgroundColor: '#F0EDFF', alignItems: 'center' }, playerIcon: { color: C.purple, fontSize: 34 }, playerSection: { color: C.ink, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 9 }, playerMeta: { color: C.muted, fontSize: 8, marginTop: 5 }, playerProgress: { width: '100%', height: 5, marginTop: 18, borderRadius: 3, backgroundColor: '#DCD7F7', overflow: 'hidden' }, playerActions: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 17 }, playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }, playText: { color: '#FFF', fontSize: 16 }, dictationHint: { color: C.muted, fontSize: 7, lineHeight: 11, marginTop: 4 }
});
