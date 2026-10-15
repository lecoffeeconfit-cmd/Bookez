import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BookezAdminAccessError, BookezAdminService } from '../lib/bookez-admin';
import { adminCreditPercent, adminDuration, adminLabel, adminRangeOptions, supportCategories, supportPriorities, supportStatuses, writerActionCopy, type AdminAction, type AdminDashboard, type AdminInbox, type AdminRange, type AdminWriter, type SupportPriority, type SupportStatus } from '../lib/admin-model';
import { bookezColors as c, bookezFonts } from '../theme/bookez';

const number = (value: number) => value.toLocaleString();
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export function AdminShield({ light = false }: { light?: boolean }) {
  return <Svg width={24} height={27} viewBox="0 0 24 27"><Path d="M12 2 3 5v7c0 6 4 10 9 13 5-3 9-7 9-13V5L12 2Z" fill="none" stroke={light ? c.textOnAccent : c.accent} strokeWidth={1.6} strokeLinejoin="round" /><Path d="m7.5 13 3 3 6-7" fill="none" stroke={light ? c.textOnAccent : c.secondaryAccent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function Choices<T extends string>({ label, values, value, onChange, disabled = false }: { label?: string; values: Array<{ id: T; label: string }>; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  return <View>{label ? <Text style={s.kicker}>{label}</Text> : null}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.choices}>{values.map((item) => <Pressable key={item.id} disabled={disabled} onPress={() => onChange(item.id)} style={[s.choice, value === item.id && s.choiceActive]} accessibilityRole="button" accessibilityLabel={`${label ? `${label}: ` : ''}${item.label}`} accessibilityState={{ selected: value === item.id, disabled }}><Text style={[s.choiceText, value === item.id && s.choiceTextActive]}>{item.label}</Text></Pressable>)}</ScrollView></View>;
}
function Pager({ page, total, onChange, disabled = false }: { page: number; total: number; onChange: (page: number) => void; disabled?: boolean }) {
  if (total < 2) return null;
  return <View style={s.pager}><Pressable disabled={disabled || page <= 1} onPress={() => onChange(page - 1)} style={[s.smallButton, (page <= 1 || disabled) && s.disabled]} accessibilityRole="button"><Text style={s.buttonText}>← Previous</Text></Pressable><Text style={s.hint}>{page} / {total}</Text><Pressable disabled={disabled || page >= total} onPress={() => onChange(page + 1)} style={[s.smallButton, (page >= total || disabled) && s.disabled]} accessibilityRole="button"><Text style={s.buttonText}>Next →</Text></Pressable></View>;
}
function Heading({ kicker, title, note }: { kicker: string; title: string; note?: string }) {
  return <View style={s.sectionHeading}><Text style={s.kicker}>{kicker}</Text><Text style={s.sectionTitle}>{title}</Text>{note ? <Text style={s.hint}>{note}</Text> : null}</View>;
}
function Stat({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return <View style={[s.stat, dark && s.statDark]}><Text style={[s.statValue, dark && s.light]}>{value}</Text><Text style={[s.statLabel, dark && s.light]}>{label}</Text></View>;
}

export default function BookezAdminCenter({ onClose, onAccessLost = onClose }: { onClose: () => void; onAccessLost?: () => void }) {
  const [section, setSection] = useState<'overview' | 'feedback'>('overview');
  const [range, setRange] = useState<AdminRange>('30d');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [inbox, setInbox] = useState<AdminInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [expanded, setExpanded] = useState('');
  const [leaderPage, setLeaderPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [category, setCategory] = useState('all');
  const [order, setOrder] = useState('newest');
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const requestId = useRef(0);
  const busyRef = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const focusDirectory = useRef(false);
  const live = useRef(true);
  const onAccessLostRef = useRef(onAccessLost);
  onAccessLostRef.current = onAccessLost;
  useEffect(() => { live.current = true; return () => { live.current = false; requestId.current += 1; }; }, []);

  const load = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    setError(''); setRefreshing(refresh); setLoading(!refresh);
    try {
      if (section === 'overview') {
        const result = await BookezAdminService.dashboard(range, page, query);
        if (live.current && id === requestId.current) setDashboard(result);
      } else {
        const result = await BookezAdminService.inbox({ status, priority, category, order, page: feedbackPage });
        if (live.current && id === requestId.current) setInbox(result);
      }
    } catch (caught) {
      if (!live.current || id !== requestId.current) return;
      setDashboard(null); setInbox(null);
      if (caught instanceof BookezAdminAccessError) { onAccessLostRef.current(); return; }
      setError(caught instanceof Error ? caught.message : 'Admin data is unavailable.');
    } finally { if (live.current && id === requestId.current) { setLoading(false); setRefreshing(false); } }
  }, [section, range, page, query, status, priority, category, order, feedbackPage]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); setExpanded(''); }, [section]);
  useEffect(() => { setLeaderPage((current) => Math.min(current,Math.max(1,Math.ceil((dashboard?.topWriters.length ?? 0) / 5)))); }, [dashboard?.topWriters.length]);

  const perform = async (action: AdminAction, target: string, payload: Record<string, unknown> = {}) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(target); setError('');
    try {
      await BookezAdminService.action(action, target, payload);
      if (!live.current) return;
      if (action === 'update_feedback' && payload.reply) setReplies((current) => ({ ...current, [target]: '' }));
      await load(true);
    } catch (caught) {
      if (!live.current) return;
      if (caught instanceof BookezAdminAccessError) { setDashboard(null); setInbox(null); onAccessLostRef.current(); return; }
      Alert.alert('Update not saved', caught instanceof Error ? caught.message : 'Please try again.');
    } finally { busyRef.current = false; if (live.current) setBusy(''); }
  };
  const confirmWriter = (writer: AdminWriter, action: AdminAction) => {
    const copy = writerActionCopy(writer, action);
    Alert.alert(copy.title, copy.detail, [{ text: 'Cancel', style: 'cancel' }, { text: copy.confirm, style: action === 'hide_sharing' || action === 'remove_avatar' ? 'destructive' : 'default', onPress: () => { void perform(action, writer.id); } }]);
  };
  const applySearch = () => { Keyboard.dismiss(); focusDirectory.current = true; setPage(1); setQuery(search.trim()); setExpanded(''); };
  const metrics = dashboard?.metrics;
  const rangeLabel = adminRangeOptions.find((item) => item.id === range)?.label ?? '30 days';
  const unresolved = section === 'feedback' ? inbox?.unresolved ?? 0 : metrics?.openFeedback ?? 0;

  return <View style={s.screen}>
    <View style={s.header}><View style={s.shield}><AdminShield light /></View><View style={s.headerCopy}><Text style={s.kicker}>BOOKEZ / PRIVATE OPERATIONS</Text><Text style={s.title}>Admin center</Text><Text style={s.hint}>Writer health, product signals, and support.</Text></View><Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close admin center"><Text style={s.closeText}>×</Text></Pressable></View>
    <View style={s.tabs}>{(['overview','feedback'] as const).map((value) => <Pressable key={value} disabled={Boolean(busy)} onPress={() => setSection(value)} style={[s.tab, section === value && s.tabActive]} accessibilityRole="button" accessibilityState={{ selected: section === value }}><Text style={[s.tabText, section === value && s.light]}>{value === 'overview' ? 'Overview' : 'Feedback'}</Text>{value === 'feedback' && unresolved > 0 ? <Text style={s.badge}>{unresolved > 99 ? '99+' : unresolved}</Text> : null}</Pressable>)}</View>
    <ScrollView ref={scroll} style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.accent} />}>
      {section === 'overview' ? <View style={s.card}><Choices label="REPORTING RANGE" values={adminRangeOptions} value={range} disabled={Boolean(busy)} onChange={(value) => { setRange(value); setPage(1); setLeaderPage(1); }} /><Text style={s.hint}>Activity uses this range. Library totals and open queues are current. “Today” begins at midnight UTC.</Text></View> : <View style={s.card}><Text style={s.sectionTitle}>Support inbox</Text><Text style={s.hint}>Read, prioritize, and reply to messages sent from Bookez Profile.</Text><Choices label="STATUS" values={['all',...supportStatuses].map((id) => ({ id, label: adminLabel(id) }))} value={status} disabled={Boolean(busy)} onChange={(value) => { setStatus(value); setFeedbackPage(1); }} /><Choices label="PRIORITY" values={['all',...supportPriorities].map((id) => ({ id, label: adminLabel(id) }))} value={priority} disabled={Boolean(busy)} onChange={(value) => { setPriority(value); setFeedbackPage(1); }} /><Choices disabled={Boolean(busy)} label="CATEGORY" values={['all',...supportCategories].map((id) => ({ id, label: adminLabel(id) }))} value={category} onChange={(value) => { setCategory(value); setFeedbackPage(1); }} /><Pressable disabled={Boolean(busy)} onPress={() => { setOrder(order === 'newest' ? 'oldest' : 'newest'); setFeedbackPage(1); }} style={s.smallButton} accessibilityRole="button"><Text style={s.buttonText}>{order === 'newest' ? 'Newest first ↓' : 'Oldest first ↑'}</Text></Pressable></View>}
      {error ? <View style={s.error} accessibilityRole="alert"><Text style={s.errorTitle}>Admin data is unavailable</Text><Text style={s.body}>{error}</Text><Pressable onPress={() => void load()} style={s.smallButton} accessibilityRole="button"><Text style={s.buttonText}>Retry</Text></Pressable></View> : null}
      {loading ? <View style={s.loading}><ActivityIndicator color={c.accent} /><Text style={s.hint}>Loading secure workspace…</Text></View> : section === 'overview' && dashboard && metrics ? <>
        <View style={s.grid}><Stat dark label="TOTAL WRITERS" value={number(metrics.totalUsers)} /><Stat label={`ACTIVE · ${rangeLabel.toUpperCase()}`} value={number(metrics.activeWriters)} /><Stat label={`NEW · ${rangeLabel.toUpperCase()}`} value={number(metrics.newUsers)} /><Stat label={`WORDS WRITTEN · ${rangeLabel.toUpperCase()}`} value={number(metrics.wordsWritten)} /></View>
        <Heading kicker="PRODUCT SIGNALS" title="What to improve next" note={`Updated ${new Date(dashboard.generatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`} />
        <View style={s.card}>{[[dashboard.signals.noProject,'Writers without a project','Check whether onboarding makes the first step clear.'],[dashboard.signals.noDraft,'Projects waiting for first words','Look for friction between planning and starting a draft.'],[dashboard.signals.lowAI,'Writers near their AI limit','80% or more of this month’s allowance is used.']] .map(([count,title,detail]) => <View key={String(title)} style={s.signal}><Text style={s.signalNumber}>{number(Number(count))}</Text><View style={s.grow}><Text style={s.rowTitle}>{title}</Text><Text style={s.hint}>{detail}</Text></View></View>)}</View>
        <View style={s.grid}><Stat label="CLOUD PROJECTS · CURRENT" value={number(metrics.projects)} /><Stat label="MANUSCRIPT WORDS · CURRENT" value={number(metrics.words)} /><Stat label={`SESSIONS · ${rangeLabel.toUpperCase()}`} value={number(metrics.sessions)} /><Stat label="WRITERS WITH REMINDERS" value={number(metrics.reminders)} /></View>
        <Heading kicker={`TIME & AI · ${rangeLabel.toUpperCase()}`} title="The writing rhythm" note="Aggregate completed sessions only. No private manuscript text or browsing history." />
        <View style={s.card}><View style={s.split}><View><Text style={s.kicker}>COMPLETED WRITING TIME</Text><Text style={s.bigValue}>{adminDuration(metrics.writingSeconds)}</Text></View><Text style={s.tag}>{number(metrics.sessions)} sessions</Text></View><View style={s.divider} /><Text style={s.rowTitle}>{number(metrics.aiCredits)} AI credits · {number(metrics.aiRequests)} completed requests</Text><Text style={s.hint}>Product credits used in this range, before admin refills—not API spending. Account controls show the current monthly balance.</Text></View>
        <Heading kicker="COMMUNITY" title="Connection health" />
        <View style={s.grid}><Stat label="SHARED BOOKS · CURRENT" value={number(metrics.sharedBooks)} /><Stat label="OPEN REPORTS · CURRENT" value={number(metrics.openReports)} /><Stat label={`ENCOURAGEMENT · ${rangeLabel.toUpperCase()}`} value={number(metrics.reactions)} /><Stat label={`FEEDBACK RESPONSES · ${rangeLabel.toUpperCase()}`} value={number(metrics.feedbackResponses)} /></View>
        <Text style={s.hint}>{number(metrics.follows)} new follows in this range. Community reports are separate from private support messages.</Text>
        <View style={s.card}><Text style={s.kicker}>OPEN COMMUNITY REPORTS</Text>{dashboard.reports.length ? dashboard.reports.map((report) => <View key={report.id} style={s.report}><Text style={s.rowTitle}>{report.name || 'Bookez writer'}</Text><Text style={s.body}>{report.reason}</Text><Text style={s.hint}>{date(report.createdAt)}</Text><View style={s.actions}><Pressable disabled={Boolean(busy)} style={s.smallButton} onPress={() => Alert.alert('Resolve this report?', 'Mark it as reviewed. This does not hide the writer’s shared books.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Resolve report', onPress: () => { void perform('resolve_report',report.id); } }])} accessibilityRole="button"><Text style={s.buttonText}>Resolve report</Text></Pressable>{report.userId ? <Pressable style={s.smallButton} disabled={Boolean(busy)} onPress={() => { focusDirectory.current = true; setSearch(report.userId!); setQuery(report.userId!); setPage(1); }} accessibilityRole="button"><Text style={s.buttonText}>Find writer ↓</Text></Pressable> : null}</View></View>) : <Text style={s.hint}>No open Community reports.</Text>}{metrics.openReports > dashboard.reports.length && <Text style={s.hint}>Showing the oldest {dashboard.reports.length}; resolve these to review the next reports.</Text>}</View>
        <Heading kicker={`WRITING ACTIVITY · ${rangeLabel.toUpperCase()}`} title="Most active writers" note="Top 20, ranked by session word counts. Counts only—never manuscript content." />
        <View style={s.card}>{dashboard.topWriters.length ? dashboard.topWriters.slice((leaderPage - 1) * 5,leaderPage * 5).map((writer,index) => <View key={writer.id} style={s.leader}><Text style={s.rank}>{(leaderPage - 1) * 5 + index + 1}</Text><View style={s.grow}><Text style={s.rowTitle}>{writer.name || 'Bookez writer'}</Text><Text style={s.hint}>{number(writer.sessions)} sessions · {adminDuration(writer.seconds)}</Text></View><Text style={s.count}>{number(writer.words)}<Text style={s.hint}> words</Text></Text></View>) : <Text style={s.hint}>Completed writing activity will appear here.</Text>}<Pager page={leaderPage} total={Math.ceil(dashboard.topWriters.length / 5)} onChange={setLeaderPage} /></View>
        <Heading kicker="LIBRARY MIX · CURRENT" title="What writers are making" />
        <View style={s.card}>{dashboard.projectTypes.length ? dashboard.projectTypes.map((type) => <View key={type.label} style={s.typeRow}><View style={s.split}><Text style={s.rowTitle}>{type.label}</Text><Text style={s.count}>{number(type.count)}</Text></View><View style={s.track}><View style={[s.fill,{ width: `${Math.round(type.count / Math.max(1,metrics.projects) * 100)}%` }]} /></View></View>) : <Text style={s.hint}>Project types appear after writers create cloud projects.</Text>}</View>
        <View onLayout={(event) => { if (focusDirectory.current) { focusDirectory.current = false; scroll.current?.scrollTo({ y: event.nativeEvent.layout.y,animated: true }); } }}><Heading kicker="USER CONTROLS" title="Writer directory" note="Search all Bookez writers by name or email. Local-only work is not included." /></View>
        <View style={s.search}><TextInput value={search} onChangeText={setSearch} onSubmitEditing={applySearch} editable={!busy} maxLength={120} placeholder="Name or email" placeholderTextColor={c.textMuted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={s.searchInput} accessibilityLabel="Search Bookez writer directory" /><Pressable disabled={Boolean(busy)} onPress={applySearch} style={s.smallButton} accessibilityRole="button"><Text style={s.buttonText}>Search</Text></Pressable></View>
        <Text style={s.hint}>{number(dashboard.directory.totalUsers)} matching writer{dashboard.directory.totalUsers === 1 ? '' : 's'} · Updates are audited; allowance and Community controls ask for confirmation.</Text>
        {dashboard.users.map((writer) => <View key={writer.id} style={s.card}><Pressable onPress={() => setExpanded(expanded === writer.id ? '' : writer.id)} style={s.split} accessibilityRole="button" accessibilityState={{ expanded: expanded === writer.id }}><View style={s.grow}><Text style={s.rowTitle}>{writer.name || 'Bookez writer'}</Text><Text style={s.body}>{writer.email || 'No email provided'}</Text><Text style={s.hint}>{number(writer.projects)} projects · {number(writer.words)} manuscript words</Text></View><Text style={s.count}>{expanded === writer.id ? '−' : '+'}</Text></Pressable>{expanded === writer.id && <View style={s.expanded}><Text style={s.hint}>Joined {date(writer.createdAt)} · Last sync/activity {date(writer.lastActiveAt)}</Text><Text style={s.rowTitle}>AI allowance: {Math.max(0,writer.aiMonthly - writer.aiUsed)} / {writer.aiMonthly} credits left</Text><View style={s.track}><View style={[s.fill,{ width: `${adminCreditPercent(writer.aiUsed,writer.aiMonthly)}%` }]} /></View><Text style={s.hint}>{writer.sharingHeld ? 'Community sharing is paused by an admin.' : 'The writer controls Community sharing.'}</Text><View style={s.actions}>{([['refill_ai','Refill AI allowance'],[writer.sharingHeld ? 'restore_sharing' : 'hide_sharing',writer.sharingHeld ? 'Restore sharing' : 'Pause sharing'],['remove_avatar','Remove public picture']] as Array<[AdminAction,string]>).map(([action,label]) => <Pressable key={action} disabled={Boolean(busy) || (action === 'refill_ai' && writer.aiUsed === 0)} onPress={() => confirmWriter(writer,action)} style={[s.smallButton, Boolean(busy) && s.disabled]} accessibilityRole="button"><Text style={s.buttonText}>{busy === writer.id ? 'Saving…' : label}</Text></Pressable>)}</View></View>}</View>)}
        {!dashboard.users.length && <View style={s.card}><Text style={s.hint}>No writers match this search.</Text></View>}
        <Pager page={dashboard.directory.page} total={dashboard.directory.totalPages} disabled={Boolean(busy) || refreshing} onChange={(value) => { setPage(value); setExpanded(''); }} />
        <Heading kicker="AUDIT TRAIL" title="Recent admin actions" />
        <View style={s.card}>{dashboard.audit.length ? dashboard.audit.map((event) => <View key={event.id} style={s.split}><Text style={s.body}>{adminLabel(event.action)}</Text><Text style={s.hint}>{date(event.createdAt)}</Text></View>) : <Text style={s.hint}>Administrative updates will be recorded here.</Text>}</View>
        <Text style={s.privacy}>Private writing, notes, research, and shared sign-in account deletion are not exposed here. Bookez admin access does not grant access to other apps.</Text>
      </> : section === 'feedback' && inbox ? <>
        <Text style={s.hint}>{inbox.unresolved} unresolved · {inbox.total} matching messages</Text>
        {inbox.tickets.map((ticket) => <View key={ticket.id} style={s.card}><Pressable onPress={() => setExpanded(expanded === ticket.id ? '' : ticket.id)} style={s.split} accessibilityRole="button" accessibilityState={{ expanded: expanded === ticket.id }}><View style={s.grow}><Text style={s.kicker}>{adminLabel(ticket.category).toUpperCase()}</Text><Text style={s.rowTitle}>{ticket.subject}</Text><Text style={s.hint}>{ticket.name || ticket.email || 'Bookez writer'} · {date(ticket.created_at)}</Text></View><View><Text style={s.tag}>{adminLabel(ticket.status)}</Text><Text style={s.hint}>{ticket.priority}</Text></View></Pressable>{expanded === ticket.id && <View style={s.expanded}><Text selectable style={s.body}>{ticket.message}</Text><Choices label="UPDATE STATUS" values={supportStatuses.map((id) => ({ id,label: adminLabel(id) }))} value={ticket.status} disabled={Boolean(busy)} onChange={(value: SupportStatus) => { void perform('update_feedback',ticket.id,{ status: value }); }} /><Choices label="UPDATE PRIORITY" values={supportPriorities.map((id) => ({ id,label: adminLabel(id) }))} value={ticket.priority} disabled={Boolean(busy)} onChange={(value: SupportPriority) => { void perform('update_feedback',ticket.id,{ priority: value }); }} />{ticket.messages.map((message) => <View key={message.id} style={s.reply}><Text style={s.kicker}>BOOKEZ REPLY · {date(message.created_at)}</Text><Text style={s.body}>{message.body}</Text></View>)}<Text style={s.kicker}>REPLY TO WRITER</Text><TextInput value={replies[ticket.id] ?? ''} onChangeText={(value) => setReplies((current) => ({ ...current,[ticket.id]: value }))} multiline maxLength={4000} editable={!busy} placeholder="A thoughtful reply…" placeholderTextColor={c.textMuted} style={s.replyInput} accessibilityLabel={`Reply to ${ticket.subject}`} /><Text style={s.hint}>Visible only to this writer in Profile → Feedback & suggestions.</Text><Pressable disabled={Boolean(busy) || !replies[ticket.id]?.trim()} onPress={() => void perform('update_feedback',ticket.id,{ reply: replies[ticket.id].trim() })} style={[s.primary,(Boolean(busy) || !replies[ticket.id]?.trim()) && s.disabled]} accessibilityRole="button"><Text style={s.light}>{busy === ticket.id ? 'Sending…' : 'Send reply →'}</Text></Pressable></View>}</View>)}
        {!inbox.tickets.length && <View style={s.card}><Text style={s.sectionTitle}>Nothing to review</Text><Text style={s.hint}>No messages match these filters.</Text></View>}
        <Pager page={inbox.page} total={inbox.totalPages} disabled={Boolean(busy) || refreshing} onChange={setFeedbackPage} />
      </> : null}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 24) + 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 }, shield: { width: 46, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentStrong }, headerCopy: { flex: 1 }, kicker: { color: c.secondaryAccent, fontSize: 9, fontWeight: '800', letterSpacing: 0.85, marginTop: 8 }, title: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 30, marginTop: 5 }, hint: { color: c.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 5 }, close: { width: 40, height: 40, borderRadius: 13, backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, closeText: { color: c.textPrimary, fontSize: 25 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, padding: 5, gap: 5, borderRadius: 15, backgroundColor: c.surfaceMuted, marginBottom: 6 }, tab: { flex: 1, minHeight: 44, borderRadius: 11, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, tabActive: { backgroundColor: c.accentStrong }, tabText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' }, badge: { color: c.accent, backgroundColor: c.accentSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 10, fontWeight: '800' }, scroll: { flex: 1 }, content: { padding: 20, paddingBottom: 48, maxWidth: 800, width: '100%', alignSelf: 'center' }, card: { padding: 15, marginTop: 12, borderWidth: 1, borderColor: c.border, borderRadius: 18, backgroundColor: c.surfaceRaised },
  choices: { gap: 6, paddingVertical: 10 }, choice: { minHeight: 38, paddingHorizontal: 13, borderRadius: 11, backgroundColor: c.surfaceMuted, justifyContent: 'center' }, choiceActive: { backgroundColor: c.accentStrong }, choiceText: { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }, choiceTextActive: { color: c.textOnAccent }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginTop: 14 }, stat: { width: '48%', minHeight: 107, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }, statDark: { backgroundColor: c.accentStrong, borderColor: c.accentStrong }, statValue: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 29 }, statLabel: { color: c.textSecondary, fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 9 }, light: { color: c.textOnAccent, fontWeight: '700' }, sectionHeading: { marginTop: 23 }, sectionTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 23, marginTop: 6 }, body: { color: c.textPrimary, fontSize: 13, lineHeight: 20, marginTop: 5 }, rowTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 4 },
  signal: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 10 }, signalNumber: { color: c.accent, fontFamily: bookezFonts.serif, fontSize: 27, width: 42 }, grow: { flex: 1, minWidth: 0 }, split: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 3 }, bigValue: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 32, marginTop: 7 }, tag: { color: c.accent, backgroundColor: c.accentSoft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, fontSize: 10, textTransform: 'capitalize' }, divider: { height: 1, backgroundColor: c.divider, marginVertical: 15 }, report: { borderTopWidth: 1, borderTopColor: c.divider, marginTop: 11, paddingTop: 12 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }, smallButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, buttonText: { color: c.accent, fontSize: 11, fontWeight: '700' }, disabled: { opacity: 0.4 }, leader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }, rank: { color: c.secondaryAccent, fontFamily: bookezFonts.serif, fontSize: 22, width: 24 }, count: { color: c.accent, fontSize: 13, fontWeight: '700' }, pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, typeRow: { marginVertical: 8 }, track: { height: 6, backgroundColor: c.surfaceMuted, borderRadius: 4, overflow: 'hidden', marginTop: 9 }, fill: { height: '100%', backgroundColor: c.secondaryAccent, borderRadius: 4 },
  search: { marginTop: 15, padding: 7, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, flexDirection: 'row', gap: 7 }, searchInput: { color: c.textPrimary, fontSize: 13, paddingHorizontal: 8, flex: 1 }, expanded: { borderTopWidth: 1, borderTopColor: c.divider, marginTop: 13, paddingTop: 12, gap: 9 }, reply: { backgroundColor: c.surfaceMuted, padding: 12, borderRadius: 12, marginVertical: 5 }, replyInput: { minHeight: 110, maxHeight: 200, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.textPrimary, padding: 12, fontSize: 13, lineHeight: 20, textAlignVertical: 'top' }, primary: { minHeight: 46, borderRadius: 12, backgroundColor: c.accentStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 }, privacy: { color: c.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 22 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 }, error: { marginTop: 15, padding: 15, borderRadius: 16, backgroundColor: c.destructiveSoft }, errorTitle: { color: c.destructive, fontWeight: '700', fontSize: 14 },
});
