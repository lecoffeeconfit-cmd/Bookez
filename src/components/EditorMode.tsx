import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { bookezColors as c, bookezFonts, bookezRadii, bookezSpacing } from '../theme/bookez';
import {
  createEditorIssue, editEditorIssue, editorIssueTypes, editorIssuesForProject, editorPassTypes, editorTypeLabel,
  filterEditorIssues, locateEditorIssue, mergeEditorFindings, removeEditorIssue, scanEditorSections,
  type EditorCheckOptions, type EditorFilter, type EditorIssue, type EditorIssueInput,
  type EditorIssueSeverity, type EditorIssueStatus, type EditorIssueType, type EditorLocation,
  type EditorPass, type EditorSection,
} from '../lib/editor-mode';

type ComposerProps = {
  visible: boolean;
  sections: EditorSection[];
  initialSectionId?: string | null;
  initialRange?: { start: number; end: number };
  issue?: EditorIssue | null;
  onClose: () => void;
  onSave: (input: EditorIssueInput) => void;
  onEdit?: (changes: Partial<Pick<EditorIssue, 'type' | 'severity' | 'title' | 'note'>>) => void;
};

export function EditorIssueComposer({ visible, sections, initialSectionId, initialRange, issue, onClose, onSave, onEdit }: ComposerProps) {
  const [sectionId, setSectionId] = useState<string | null>(initialSectionId ?? null);
  const [type, setType] = useState<EditorIssueType>('revisit');
  const [severity, setSeverity] = useState<EditorIssueSeverity>('medium');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!visible) return;
    setSectionId(issue?.sectionId ?? initialSectionId ?? null);
    setType(issue?.type ?? 'revisit');
    setSeverity(issue?.severity ?? 'medium');
    setTitle(issue?.title ?? '');
    setNote(issue?.note ?? '');
  }, [visible, issue?.id, initialSectionId, initialRange?.start, initialRange?.end]);
  const save = () => {
    if (issue) onEdit?.({ type, severity, title: title.trim() || editorTypeLabel(type), note });
    else onSave({ sectionId, ...(sectionId === initialSectionId && initialRange ? { startOffset: initialRange.start, endOffset: initialRange.end } : {}), type, severity, title, note });
    onClose();
  };
  const chosenSection = sections.find((section) => section.id === sectionId);
  const excerpt = !issue && initialRange && chosenSection && sectionId === initialSectionId ? chosenSection.text.slice(initialRange.start, initialRange.end) : issue?.anchorText;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.shade}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><View style={st.sheet}><View style={st.sheetHandle} /><View style={st.sheetHeader}><View style={{ flex: 1 }}><Text style={st.eyebrow}>BOOKEZ / EDITOR</Text><Text style={st.sheetTitle}>{issue ? 'Edit your note' : 'Flag for review'}</Text></View><Pressable onPress={onClose} style={st.close} accessibilityRole="button" accessibilityLabel="Close flag composer"><Text style={st.closeText}>×</Text></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={st.sheetContent}>
        {excerpt ? <View style={st.quote}><Text numberOfLines={4} style={st.quoteText}>“{excerpt.trim()}”</Text></View> : null}
        {!issue && <><Text style={st.fieldLabel}>SCOPE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}><Chip label="Whole book" selected={sectionId === null} onPress={() => setSectionId(null)} />{sections.map((section) => <Chip key={section.id} label={section.title} selected={sectionId === section.id} onPress={() => setSectionId(section.id)} />)}</ScrollView></>}
        <Text style={st.fieldLabel}>REVIEW AS</Text><View style={st.typeGrid}>{editorIssueTypes.map((kind) => <Pressable key={kind.id} onPress={() => setType(kind.id)} style={[st.typeChoice, type === kind.id && st.typeChoiceSelected]} accessibilityRole="button" accessibilityState={{ selected: type === kind.id }}><Text style={[st.typeChoiceText, type === kind.id && st.typeChoiceTextSelected]}>{kind.label}</Text></Pressable>)}</View>
        <Text style={st.fieldLabel}>PRIORITY</Text><View style={st.chips}>{(['low', 'medium', 'high'] as EditorIssueSeverity[]).map((value) => <Chip key={value} label={value[0].toUpperCase() + value.slice(1)} selected={severity === value} onPress={() => setSeverity(value)} />)}</View>
        <Text style={st.fieldLabel}>TITLE · OPTIONAL</Text><TextInput value={title} onChangeText={setTitle} maxLength={100} placeholder={editorTypeLabel(type)} placeholderTextColor={c.textMuted} style={st.input} accessibilityLabel="Editor flag title" />
        <Text style={st.fieldLabel}>PRIVATE NOTE · OPTIONAL</Text><TextInput value={note} onChangeText={setNote} maxLength={2000} multiline textAlignVertical="top" placeholder="What should you remember when you return?" placeholderTextColor={c.textMuted} style={[st.input, st.noteInput]} accessibilityLabel="Editor flag note" />
      </ScrollView><View style={st.sheetActions}><Pressable onPress={onClose} style={st.secondaryButton}><Text style={st.secondaryText}>Cancel</Text></Pressable><Pressable onPress={save} style={st.primaryButton}><Text style={st.primaryText}>{issue ? 'Save changes' : 'Save flag'}</Text></Pressable></View>
    </View></KeyboardAvoidingView>
  </Modal>;
}

function Chip({ label, selected, onPress, count }: { label: string; selected?: boolean; onPress: () => void; count?: number }) {
  return <Pressable onPress={onPress} style={[st.chip, selected && st.chipSelected]} accessibilityRole="button" accessibilityState={{ selected: Boolean(selected) }}><Text numberOfLines={1} style={[st.chipText, selected && st.chipTextSelected]}>{label}{count !== undefined ? ` ${count}` : ''}</Text></Pressable>;
}

type Props = {
  projectId: string;
  projectTitle: string;
  sections: EditorSection[];
  issues: EditorIssue[] | undefined;
  initialSelectedIssueId?: string | null;
  checkOptions?: EditorCheckOptions;
  onIssuesChange: (update: (issues: EditorIssue[]) => EditorIssue[]) => void;
  onCheckOptionsChange: (options: EditorCheckOptions) => void;
  onBack: () => void;
  onOpenWriting: (issue: EditorIssue, location: EditorLocation) => void;
  repetitionHints: (text: string) => { label: string; kind: string }[];
  makeId: () => string;
};

export default function EditorMode({ projectId, projectTitle, sections, issues, initialSelectedIssueId, checkOptions, onIssuesChange, onCheckOptionsChange, onBack, onOpenWriting, repetitionHints, makeId }: Props) {
  const scroll = useRef<ScrollView>(null);
  const scanToken = useRef(0);
  const [pass, setPass] = useState<EditorPass>('all');
  const [filter, setFilter] = useState<EditorFilter>({ status: 'active', sort: 'manuscript' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<EditorIssue | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);
  const [markersDraft, setMarkersDraft] = useState((checkOptions?.markers ?? ['TODO', 'TK', 'FIXME', '[research]', '[check]']).join(', '));
  const [scanBusy, setScanBusy] = useState(false);
  useEffect(() => () => { scanToken.current += 1; }, []);
  const projectIssues = useMemo(() => editorIssuesForProject(issues, projectId), [issues, projectId]);
  useEffect(() => {
    if (initialSelectedIssueId && projectIssues.some((issue) => issue.id === initialSelectedIssueId)) setSelectedId(initialSelectedIssueId);
  }, [initialSelectedIssueId, projectIssues]);
  const filtered = useMemo(() => filterEditorIssues(projectIssues, sections, { ...filter, pass }), [projectIssues, sections, filter, pass]);
  const active = projectIssues.filter((issue) => issue.status === 'open' || issue.status === 'in-progress');
  const resolved = projectIssues.filter((issue) => issue.status === 'resolved');
  const high = active.filter((issue) => issue.severity === 'high');
  const passCounts: Record<EditorPass, number> = {
    all: active.length,
    structure: active.filter((issue) => editorPassTypes.structure.includes(issue.type)).length,
    continuity: active.filter((issue) => editorPassTypes.continuity.includes(issue.type)).length,
    writing: active.filter((issue) => editorPassTypes.writing.includes(issue.type)).length,
    mine: active.filter((issue) => issue.source === 'user').length,
  };
  const selected = filtered.find((issue) => issue.id === selectedId) ?? filtered[0];
  const selectedIndex = selected ? filtered.findIndex((issue) => issue.id === selected.id) : -1;
  const selectedLocation = selected ? locateEditorIssue(selected, sections) : null;
  const progressDenominator = projectIssues.filter((issue) => issue.status !== 'dismissed').length;
  const progress = progressDenominator ? Math.round(100 * resolved.length / progressDenominator) : 0;
  const updateIssue = (id: string, changes: Partial<Pick<EditorIssue, 'type' | 'severity' | 'title' | 'note' | 'status'>>) => onIssuesChange((current) => current.map((issue) => issue.id === id && issue.projectId === projectId ? editEditorIssue(issue, changes) : issue));
  const finishIssue = (status: EditorIssueStatus) => {
    if (!selected) return;
    const next = filtered[selectedIndex + 1] ?? filtered[selectedIndex - 1];
    setSelectedId(next?.id ?? null);
    updateIssue(selected.id, { status });
  };
  const createIssue = (input: EditorIssueInput) => {
    onIssuesChange((current) => [...current, createEditorIssue(projectId, sections, input, makeId())]);
  };
  const deleteIssue = (issue: EditorIssue) => Alert.alert('Delete this flag?', 'Deletion cannot be undone. Resolve or dismiss it to keep the history instead.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { onIssuesChange((current) => removeEditorIssue(current, issue.id)); setSelectedId(null); } },
  ]);
  const scan = (oneSection: boolean) => {
    if (scanBusy) return;
    const target = oneSection && filter.sectionId && filter.sectionId !== 'all' ? sections.filter((section) => section.id === filter.sectionId) : sections;
    const options = { ...checkOptions, markers: markersDraft.split(',').map((item) => item.trim()).filter(Boolean) };
    onCheckOptionsChange(options);
    const token = ++scanToken.current;
    setScanBusy(true);
    const findings: ReturnType<typeof scanEditorSections> = [];
    let index = 0;
    const next = () => {
      if (token !== scanToken.current) return;
      if (index < target.length) {
        findings.push(...scanEditorSections([target[index]], options, repetitionHints));
        index += 1;
        setTimeout(next, 0);
        return;
      }
      const merged = mergeEditorFindings(issues ?? [], projectId, sections, findings, makeId);
      onIssuesChange((current) => mergeEditorFindings(current, projectId, sections, findings, makeId));
      setScanBusy(false);
      Alert.alert('Local review complete', `${merged.length - (issues ?? []).length} new suggestion${merged.length - (issues ?? []).length === 1 ? '' : 's'} added. Existing resolved or dismissed suggestions stayed as they were.`);
    };
    setTimeout(next, 0);
  };
  const select = (id: string) => { setSelectedId(id); scroll.current?.scrollTo({ y: 0, animated: true }); };
  const setField = <K extends keyof EditorFilter>(key: K, value: EditorFilter[K]) => setFilter((current) => ({ ...current, [key]: value }));
  const openEditor = (issue: EditorIssue, location: EditorLocation) => {
    if (location.state === 'unavailable') { Alert.alert('Section unavailable', 'This section is no longer in the current book structure. Your flag is safe; restore the section or resolve the flag here.'); return; }
    if (location.state === 'changed') Alert.alert('Original passage changed', 'The flagged text could not be located confidently. Bookez will open its section without selecting unrelated text.', [{ text: 'Open section', onPress: () => onOpenWriting(issue, location) }, { text: 'Stay here', style: 'cancel' }]);
    else onOpenWriting(issue, location);
  };
  return <SafeAreaView style={st.safe}><ScrollView ref={scroll} style={st.screen} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={st.header}><Pressable onPress={onBack} style={st.back} accessibilityRole="button" accessibilityLabel="Back from Editor"><Text style={st.backText}>‹</Text></Pressable><View style={st.headerCopy}><Text style={st.eyebrow}>BOOKEZ / REVISION</Text><Text style={st.headerTitle}>Editor</Text><Text numberOfLines={1} style={st.headerMeta}>{projectTitle}</Text></View><Pressable onPress={() => { setEditingIssue(null); setComposerOpen(true); }} style={st.addTop} accessibilityRole="button" accessibilityLabel="Add editor flag"><Text style={st.addTopText}>＋ Flag</Text></Pressable></View>
    <View style={st.hero}><Text style={st.heroKicker}>A SECOND LOOK</Text><Text style={st.heroTitle}>Shape the next draft.</Text><Text style={st.heroCopy}>Keep every thought in one place. A flag never edits your manuscript for you.</Text><View style={st.metricRow}><View><Text style={st.metricValue}>{active.length}</Text><Text style={st.metricLabel}>TO REVIEW</Text></View><View><Text style={st.metricValue}>{high.length}</Text><Text style={st.metricLabel}>HIGH PRIORITY</Text></View><View><Text style={st.metricValue}>{resolved.length}</Text><Text style={st.metricLabel}>RESOLVED</Text></View></View><View style={st.progressTrack}><View style={[st.progressFill, { width: `${progress}%` }]} /></View><Text style={st.progressText}>{progressDenominator ? `${progress}% of review items resolved` : 'Begin with a flag or a local check'}</Text></View>
    <View style={st.actions}><Pressable onPress={() => { setEditingIssue(null); setComposerOpen(true); }} style={st.primaryButton}><Text style={st.primaryText}>＋ Add a flag</Text></Pressable><Pressable onPress={() => setChecksOpen((open) => !open)} style={st.secondaryButton}><Text style={st.secondaryText}>Local checks</Text></Pressable></View>
    {checksOpen && <View style={st.toolPanel}><Text style={st.panelTitle}>A quiet, on-device check</Text><Text style={st.panelCopy}>Find writer markers, nearby repetition, long passages, sparse sections and clear formatting anomalies. These are suggestions, not judgments. Scans only run when you ask.</Text><Text style={st.fieldLabel}>WRITER MARKERS · COMMA SEPARATED</Text><TextInput value={markersDraft} onChangeText={setMarkersDraft} style={st.input} placeholder="TODO, TK, FIXME" placeholderTextColor={c.textMuted} accessibilityLabel="Writer markers to scan" /><Text style={st.fieldLabel}>PLANNED SECTIONS</Text><Chip label={checkOptions?.includeEmptySections ? '✓ Include sparse sections' : 'Include sparse sections'} selected={checkOptions?.includeEmptySections === true} onPress={() => onCheckOptionsChange({ ...checkOptions, includeEmptySections: !checkOptions?.includeEmptySections })} /><View style={st.actions}><Pressable onPress={() => onCheckOptionsChange({ ...checkOptions, markers: markersDraft.split(',').map((item) => item.trim()).filter(Boolean) })} style={st.secondaryButton}><Text style={st.secondaryText}>Save markers</Text></Pressable><Pressable disabled={scanBusy} onPress={() => scan(false)} style={[st.primaryButton, scanBusy && st.disabled]}><Text style={st.primaryText}>{scanBusy ? 'Checking…' : 'Check whole book'}</Text></Pressable></View>{filter.sectionId && filter.sectionId !== 'all' && filter.sectionId !== '__project__' && <Pressable disabled={scanBusy} onPress={() => scan(true)} style={st.inlineAction}><Text style={st.inlineActionText}>Check selected section only →</Text></Pressable>}</View>}
    <Text style={st.sectionLabel}>REVISION PASSES</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>{([['all', 'All'], ['structure', 'Structure'], ['continuity', 'Continuity'], ['writing', 'Writing'], ['mine', 'My flags']] as [EditorPass, string][]).map(([id, label]) => <Chip key={id} label={label} count={passCounts[id]} selected={pass === id} onPress={() => setPass(id)} />)}</ScrollView>
    <View style={st.listHeading}><View style={{ flex: 1 }}><Text style={st.listTitle}>Review queue</Text><Text style={st.listSubtitle}>{filtered.length} item{filtered.length === 1 ? '' : 's'} in this view · manuscript order by default</Text></View><Pressable onPress={() => setFiltersOpen((open) => !open)} style={st.filterButton}><Text style={st.filterButtonText}>Filter ⌄</Text></Pressable></View>
    {filtersOpen && <View style={st.toolPanel}><TextInput value={filter.query ?? ''} onChangeText={(value) => setField('query', value)} placeholder="Search notes, types, or passages" placeholderTextColor={c.textMuted} style={st.input} accessibilityLabel="Search editor issues" />
      <Text style={st.fieldLabel}>STATUS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>{(['active', 'open', 'in-progress', 'resolved', 'dismissed', 'all'] as const).map((value) => <Chip key={value} label={value === 'active' ? 'To review' : value.replace('-', ' ')} selected={(filter.status ?? 'active') === value} onPress={() => setField('status', value)} />)}</ScrollView>
      <Text style={st.fieldLabel}>SECTION</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}><Chip label="All" selected={!filter.sectionId || filter.sectionId === 'all'} onPress={() => setField('sectionId', 'all')} /><Chip label="Whole book" selected={filter.sectionId === '__project__'} onPress={() => setField('sectionId', '__project__')} />{sections.map((section) => <Chip key={section.id} label={section.title} selected={filter.sectionId === section.id} onPress={() => setField('sectionId', section.id)} />)}</ScrollView>
      <Text style={st.fieldLabel}>TYPE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}><Chip label="All" selected={!filter.type || filter.type === 'all'} onPress={() => setField('type', 'all')} />{editorIssueTypes.map((kind) => <Chip key={kind.id} label={kind.label} selected={filter.type === kind.id} onPress={() => setField('type', kind.id)} />)}</ScrollView>
      <Text style={st.fieldLabel}>PRIORITY · SOURCE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>{(['all', 'low', 'medium', 'high'] as const).map((value) => <Chip key={value} label={value} selected={(filter.severity ?? 'all') === value} onPress={() => setField('severity', value)} />)}</ScrollView><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>{(['all', 'user', 'local-check', 'ai'] as const).map((value) => <Chip key={value} label={value === 'user' ? 'My flags' : value === 'local-check' ? 'Local checks' : value} selected={(filter.source ?? 'all') === value} onPress={() => setField('source', value)} />)}</ScrollView>
      <Text style={st.fieldLabel}>SORT</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>{(['manuscript', 'newest', 'oldest', 'severity'] as const).map((value) => <Chip key={value} label={value === 'severity' ? 'Priority' : value} selected={(filter.sort ?? 'manuscript') === value} onPress={() => setField('sort', value)} />)}</ScrollView>
    </View>}
    {selected && selectedLocation && <View style={st.reviewCard}><View style={st.reviewTop}><Text style={st.reviewKicker}>NOW REVIEWING · {selectedIndex + 1} OF {filtered.length}</Text><Text style={st.sourceLabel}>{selected.source === 'user' ? 'YOUR FLAG' : selected.source === 'local-check' ? 'LOCAL CHECK' : 'EDITOR FINDING'}</Text></View><Text style={st.reviewTitle}>{selected.title}</Text><Text style={st.issueMeta}>{editorTypeLabel(selected.type)} · {sections.find((section) => section.id === selected.sectionId)?.title ?? (selected.sectionId === null ? 'Whole book' : 'Section unavailable')} · {selected.severity} priority</Text>{selected.anchorText && <Text style={st.anchorQuote}>“{selected.anchorText.trim().slice(0, 240)}{selected.anchorText.length > 240 ? '…' : ''}”</Text>}{selected.note ? <Text style={st.note}>{selected.note}</Text> : null}
      {(selectedLocation.state === 'changed' || selectedLocation.state === 'unavailable') && <Text style={st.anchorWarning}>{selectedLocation.state === 'changed' ? 'Original passage changed · open the section to locate it manually.' : 'Location unavailable · this section is not in the current structure.'}</Text>}
      {selectedLocation.state === 'relocated' && <Text style={st.anchorInfo}>Passage relocated after manuscript edits.</Text>}
      <View style={st.reviewActions}><Pressable onPress={() => openEditor(selected, selectedLocation)} style={st.primaryButton}><Text style={st.primaryText}>{selected.sectionId === null ? 'Open manuscript' : 'Go to text'}</Text></Pressable><Pressable onPress={() => { setEditingIssue(selected); setComposerOpen(true); }} style={st.secondaryButton}><Text style={st.secondaryText}>Edit flag</Text></Pressable></View>
      <View style={st.statusActions}>{selected.status !== 'in-progress' && selected.status !== 'resolved' && selected.status !== 'dismissed' && <Pressable onPress={() => updateIssue(selected.id, { status: 'in-progress' })} style={st.textAction}><Text style={st.textActionLabel}>In progress</Text></Pressable>}{selected.status !== 'resolved' && <Pressable onPress={() => finishIssue('resolved')} style={st.textAction}><Text style={st.textActionLabel}>✓ Resolve</Text></Pressable>}{selected.status !== 'dismissed' && <Pressable onPress={() => finishIssue('dismissed')} style={st.textAction}><Text style={st.textActionLabel}>Dismiss</Text></Pressable>}{(selected.status === 'resolved' || selected.status === 'dismissed') && <Pressable onPress={() => updateIssue(selected.id, { status: 'open' })} style={st.textAction}><Text style={st.textActionLabel}>Reopen</Text></Pressable>}<Pressable onPress={() => deleteIssue(selected)} style={st.textAction}><Text style={st.deleteLabel}>Delete</Text></Pressable></View>
      <View style={st.queueNav}><Pressable disabled={selectedIndex <= 0} onPress={() => select(filtered[selectedIndex - 1].id)} style={[st.queueNavButton, selectedIndex <= 0 && st.disabled]}><Text style={st.queueNavText}>← Previous</Text></Pressable><Pressable disabled={selectedIndex >= filtered.length - 1} onPress={() => select(filtered[selectedIndex + 1].id)} style={[st.queueNavButton, selectedIndex >= filtered.length - 1 && st.disabled]}><Text style={st.queueNavText}>Next →</Text></Pressable></View></View>}
    {filtered.length ? filtered.slice(0, visibleCount).map((issue) => <Pressable key={issue.id} onPress={() => select(issue.id)} style={[st.issueRow, selected?.id === issue.id && st.issueRowSelected]} accessibilityRole="button" accessibilityLabel={`Review ${issue.title}`}><View style={st.issueRowTop}><Text style={st.issueRowType}>{editorTypeLabel(issue.type).toUpperCase()}{issue.severity === 'high' ? ' · HIGH' : ''}</Text><Text style={st.issueRowStatus}>{issue.status.replace('-', ' ')}</Text></View><Text style={st.issueRowTitle}>{issue.title}</Text><Text numberOfLines={2} style={st.issueRowPreview}>{issue.note || issue.anchorText || 'A note for this section or book.'}</Text><Text style={st.issueRowSection}>{sections.find((section) => section.id === issue.sectionId)?.title ?? (issue.sectionId === null ? 'Whole book' : 'Section unavailable')} →</Text></Pressable>) : <View style={st.empty}><Text style={st.emptyMark}>✦</Text><Text style={st.emptyTitle}>{projectIssues.length ? 'No flags in this view' : 'A fresh page for revision'}</Text><Text style={st.emptyCopy}>{projectIssues.length ? 'Try another pass or adjust filters. Resolved and dismissed flags remain recoverable.' : 'Make your own flag while writing, or add a book-wide note here. Local checks are optional.'}</Text></View>}
    {filtered.length > visibleCount && <Pressable onPress={() => setVisibleCount((count) => count + 60)} style={st.secondaryButton} accessibilityRole="button"><Text style={st.secondaryText}>Show more flags ({filtered.length - visibleCount} remaining)</Text></Pressable>}
    <Text style={st.sectionLabel}>SECTION PROGRESS</Text>{sections.map((section) => { const sectionIssues = projectIssues.filter((issue) => issue.sectionId === section.id && issue.status !== 'dismissed'); const done = sectionIssues.filter((issue) => issue.status === 'resolved').length; return <Pressable key={section.id} onPress={() => { setField('sectionId', section.id); setFiltersOpen(true); scroll.current?.scrollTo({ y: 400, animated: true }); }} style={st.chapterRow}><Text numberOfLines={1} style={st.chapterTitle}>{section.title}</Text><Text style={st.chapterProgress}>{done} / {sectionIssues.length} resolved</Text></Pressable>; })}
    <Text style={st.footer}>Your manuscript stays in Write. Editor flags and local checks never change its words.</Text>
  </ScrollView><EditorIssueComposer visible={composerOpen} sections={sections} issue={editingIssue} initialSectionId={filter.sectionId && filter.sectionId !== 'all' && filter.sectionId !== '__project__' ? filter.sectionId : null} onClose={() => setComposerOpen(false)} onSave={createIssue} onEdit={(changes) => editingIssue && updateIssue(editingIssue.id, changes)} /></SafeAreaView>;
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, screen: { flex: 1 }, content: { paddingHorizontal: bookezSpacing.page, paddingTop: 12, paddingBottom: 50 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, backText: { color: c.accent, fontSize: 30, lineHeight: 33 }, headerCopy: { flex: 1, minWidth: 0 }, eyebrow: { color: c.secondaryAccent, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 }, headerTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 29, fontWeight: '600', lineHeight: 34 }, headerMeta: { color: c.textSecondary, fontSize: 11 }, addTop: { minHeight: 40, paddingHorizontal: 12, borderRadius: 13, backgroundColor: c.accentSoft, justifyContent: 'center' }, addTopText: { color: c.accent, fontWeight: '800', fontSize: 11 },
  hero: { backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border, borderRadius: 24, padding: 20, overflow: 'hidden' }, heroKicker: { color: c.secondaryAccent, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 }, heroTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 25, lineHeight: 30, marginTop: 6 }, heroCopy: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 7 }, metricRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: c.divider }, metricValue: { color: c.accent, fontFamily: bookezFonts.serif, fontSize: 23 }, metricLabel: { color: c.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }, progressTrack: { height: 5, borderRadius: 4, backgroundColor: c.surfaceSecondary, marginTop: 17, overflow: 'hidden' }, progressFill: { height: 5, backgroundColor: c.success }, progressText: { color: c.textSecondary, fontSize: 10, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 13 }, primaryButton: { minHeight: 44, flex: 1, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, primaryText: { color: c.textOnAccent, fontSize: 11, fontWeight: '800' }, secondaryButton: { minHeight: 44, flex: 1, borderRadius: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, secondaryText: { color: c.accent, fontSize: 11, fontWeight: '800' }, disabled: { opacity: 0.4 },
  sectionLabel: { color: c.secondaryAccent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 25, marginBottom: 10 }, chips: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 4 }, chip: { minHeight: 36, maxWidth: 175, paddingHorizontal: 13, borderRadius: bookezRadii.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }, chipSelected: { backgroundColor: c.accentSoft, borderColor: c.accent }, chipText: { color: c.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }, chipTextSelected: { color: c.accent }, listHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 10, gap: 8 }, listTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 21 }, listSubtitle: { color: c.textMuted, fontSize: 10, marginTop: 3 }, filterButton: { minHeight: 36, borderRadius: 11, backgroundColor: c.surfaceSecondary, paddingHorizontal: 11, justifyContent: 'center' }, filterButtonText: { color: c.accent, fontSize: 10, fontWeight: '800' },
  toolPanel: { backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border, borderRadius: 19, padding: 15, marginTop: 10 }, panelTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 18 }, panelCopy: { color: c.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 5 }, fieldLabel: { color: c.secondaryAccent, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 15, marginBottom: 7 }, input: { minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.textPrimary, paddingHorizontal: 12, fontSize: 12 }, noteInput: { minHeight: 85, paddingTop: 10 }, inlineAction: { paddingVertical: 12 }, inlineActionText: { color: c.accent, fontSize: 11, fontWeight: '800' },
  reviewCard: { backgroundColor: c.surfaceRaised, borderRadius: 20, borderWidth: 1, borderColor: c.secondaryAccent, padding: 17, marginBottom: 13 }, reviewTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, reviewKicker: { color: c.secondaryAccent, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }, sourceLabel: { color: c.textMuted, fontSize: 8, fontWeight: '800' }, reviewTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 22, marginTop: 9 }, issueMeta: { color: c.textSecondary, fontSize: 10, marginTop: 5 }, anchorQuote: { color: c.textSecondary, fontFamily: bookezFonts.serif, fontSize: 14, lineHeight: 21, padding: 12, backgroundColor: c.manuscript, borderRadius: 12, marginTop: 13 }, note: { color: c.textPrimary, fontSize: 12, lineHeight: 18, marginTop: 12 }, anchorWarning: { color: c.destructive, fontSize: 11, lineHeight: 16, marginTop: 12 }, anchorInfo: { color: c.success, fontSize: 11, marginTop: 12 }, reviewActions: { flexDirection: 'row', gap: 8, marginTop: 15 }, statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }, textAction: { minHeight: 36, paddingHorizontal: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 11, justifyContent: 'center' }, textActionLabel: { color: c.accent, fontSize: 10, fontWeight: '800' }, deleteLabel: { color: c.destructive, fontSize: 10, fontWeight: '800' }, queueNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 10 }, queueNavButton: { minHeight: 38, paddingHorizontal: 8, justifyContent: 'center' }, queueNavText: { color: c.accent, fontSize: 11, fontWeight: '800' },
  issueRow: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 17, padding: 15, marginBottom: 8 }, issueRowSelected: { borderColor: c.accent }, issueRowTop: { flexDirection: 'row', justifyContent: 'space-between' }, issueRowType: { color: c.secondaryAccent, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }, issueRowStatus: { color: c.textMuted, fontSize: 9, textTransform: 'capitalize' }, issueRowTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 17, marginTop: 5 }, issueRowPreview: { color: c.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 }, issueRowSection: { color: c.accent, fontSize: 10, fontWeight: '800', marginTop: 9 }, empty: { padding: 25, alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: 18, backgroundColor: c.surface }, emptyMark: { color: c.secondaryAccent, fontSize: 24 }, emptyTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 18, marginTop: 8 }, emptyCopy: { color: c.textSecondary, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 }, chapterRow: { flexDirection: 'row', minHeight: 46, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.divider }, chapterTitle: { flex: 1, color: c.textPrimary, fontSize: 11, fontWeight: '700' }, chapterProgress: { color: c.textSecondary, fontSize: 10 }, footer: { color: c.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 22 },
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(19,36,61,0.35)' }, sheet: { maxHeight: '88%', backgroundColor: c.surfaceRaised, borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 25 }, sheetHandle: { width: 35, height: 4, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginBottom: 14 }, sheetHeader: { flexDirection: 'row', alignItems: 'center' }, sheetTitle: { color: c.textPrimary, fontFamily: bookezFonts.serif, fontSize: 23, marginTop: 4 }, close: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }, closeText: { color: c.textPrimary, fontSize: 22 }, sheetContent: { paddingBottom: 15 }, sheetActions: { flexDirection: 'row', gap: 9, paddingTop: 9 }, quote: { backgroundColor: c.manuscript, padding: 12, borderRadius: 13, marginTop: 13 }, quoteText: { color: c.textSecondary, fontFamily: bookezFonts.serif, fontSize: 13 }, typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, typeChoice: { minHeight: 37, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: 'center' }, typeChoiceSelected: { borderColor: c.accent, backgroundColor: c.accentSoft }, typeChoiceText: { color: c.textSecondary, fontSize: 10, fontWeight: '700' }, typeChoiceTextSelected: { color: c.accent },
});
