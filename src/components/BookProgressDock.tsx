import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BOOK_PROGRESS_STAGE_LABELS, type BookProgressStageKey, type BookProgressState } from '../lib/book-progress';
import { bookezColors as c, bookezRadii, bookezSpacing } from '../theme/bookez';

export type ProgressDockMode = 'expanded' | 'collapsed' | 'minimized';

type Props = {
  progress: BookProgressState;
  mode: ProgressDockMode;
  keyboardOpen: boolean;
  onModeChange: (mode: ProgressDockMode) => void;
  onContinue: () => void;
  onViewJourney: () => void;
};

const stageOrder: BookProgressStageKey[] = ['setup', 'planning', 'writing', 'revision', 'finishing'];

function Segments({ progress, accessibilityLabel }: { progress: number; accessibilityLabel: string }) {
  const filled = Math.round(Math.max(0, Math.min(100, progress)) / 10);
  return <View style={styles.segments} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={{ min: 0, max: 100, now: progress }}>
    {Array.from({ length: 10 }, (_, index) => <View key={index} style={[styles.segment, index < filled && styles.segmentFilled]} />)}
  </View>;
}

export default function BookProgressDock({ progress, mode, keyboardOpen, onModeChange, onContinue, onViewJourney }: Props) {
  const previous = useRef<{ bookId: string; progress: number; nextStepId: string; nextStepTitle: string } | null>(null);
  const [feedback, setFeedback] = useState('');
  const effectiveMode = keyboardOpen ? 'minimized' : mode;

  useEffect(() => {
    const prior = previous.current;
    if (prior?.bookId === progress.bookId && prior.nextStepId !== progress.nextStep.id && progress.progressPercent > prior.progress) {
      setFeedback(`${prior.nextStepTitle} · ${prior.progress}% → ${progress.progressPercent}%`);
      const timer = setTimeout(() => setFeedback(''), 3200);
      previous.current = { bookId: progress.bookId, progress: progress.progressPercent, nextStepId: progress.nextStep.id, nextStepTitle: progress.nextStep.title };
      return () => clearTimeout(timer);
    }
    previous.current = { bookId: progress.bookId, progress: progress.progressPercent, nextStepId: progress.nextStep.id, nextStepTitle: progress.nextStep.title };
  }, [progress.bookId, progress.nextStep.id, progress.nextStep.title, progress.progressPercent]);

  if (effectiveMode === 'minimized') return <View style={styles.minimizedWrap}>
    <Pressable onPress={() => onModeChange('expanded')} style={styles.minimized} accessibilityRole="button" accessibilityState={{ expanded: false }} accessibilityLabel={`${progress.title}: ${progress.progressPercent}% complete. Expand book progress.`}>
      <Text style={styles.minimizedValue}>{progress.progressPercent}%</Text><Text style={styles.minimizedArrow}>↑</Text>
    </Pressable>
  </View>;

  if (effectiveMode === 'collapsed') return <Pressable onPress={() => onModeChange('expanded')} style={styles.collapsed} accessibilityRole="button" accessibilityState={{ expanded: false }} accessibilityLabel={`${progress.title}: ${progress.progressPercent}% complete. Next step: ${progress.nextStep.title}. Expand book progress.`}>
    <View style={styles.percentBlock}><Text style={styles.percent}>{progress.progressPercent}%</Text><Text style={styles.percentLabel}>BOOK</Text></View>
    <View style={styles.collapsedContent}><Segments progress={progress.progressPercent} accessibilityLabel={`Book progress ${progress.progressPercent}%`} /><Text numberOfLines={1} style={styles.collapsedNext}>{progress.nextStep.title}</Text></View>
    <Text style={styles.expandArrow}>⌃</Text>
  </Pressable>;

  return <View style={styles.expanded}>
    <View style={styles.expandedHeader}>
      <View style={styles.headerCopy}><Text numberOfLines={1} style={styles.bookTitle}>{progress.title}</Text><Text style={styles.stageLine}>{progress.stageLabel} · {progress.stageCompletion}% complete</Text></View>
      <Text style={styles.expandedPercent}>{progress.progressPercent}%</Text>
      <Pressable onPress={() => onModeChange('minimized')} style={styles.minimizeButton} accessibilityRole="button" accessibilityLabel="Minimize book progress"><Text style={styles.minimizeText}>–</Text></Pressable>
      <Pressable onPress={() => onModeChange('collapsed')} style={styles.collapseButton} accessibilityRole="button" accessibilityLabel="Collapse book progress"><Text style={styles.collapseText}>⌄</Text></Pressable>
    </View>

    <ScrollView style={styles.expandedScroll} contentContainerStyle={styles.expandedContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      <View style={styles.stageList}>
        {stageOrder.map((stage) => <View key={stage} style={styles.stageRow}>
          <Text numberOfLines={1} style={[styles.stageName, progress.stage === stage && styles.stageNameCurrent]}>{BOOK_PROGRESS_STAGE_LABELS[stage]}</Text>
          <Segments progress={progress.stageProgress[stage]} accessibilityLabel={`${BOOK_PROGRESS_STAGE_LABELS[stage]} ${progress.stageProgress[stage]}%`} />
          <Text style={styles.stageValue}>{progress.stageProgress[stage]}%</Text>
        </View>)}
      </View>

      {progress.lastMeaningfulCompletedItem && <View style={styles.lastDone}>
        <Text style={styles.detailLabel}>LAST MADE PROGRESS</Text>
        <Text numberOfLines={1} style={styles.lastDoneText}>{progress.lastMeaningfulCompletedItem.title}</Text>
      </View>}
      <View style={styles.lastLeftOff}>
        <Text style={styles.detailLabel}>LAST LEFT OFF</Text>
        <Text numberOfLines={1} style={styles.lastDoneText}>{progress.lastLeftOff}</Text>
      </View>

      <View style={styles.nextStepCard}>
        <View style={styles.nextStepCopy}><Text style={styles.nextStepKicker}>YOUR NEXT STEP</Text><Text style={styles.nextStepTitle}>{progress.nextStep.title}</Text><Text style={styles.nextStepDescription}>{progress.nextStep.description}</Text></View>
        <Pressable onPress={onContinue} style={styles.continueButton} accessibilityRole="button" accessibilityLabel={progress.nextStep.buttonLabel}>
          <Text numberOfLines={1} style={styles.continueText}>{progress.nextStep.buttonLabel}</Text><Text style={styles.continueArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.partProgressHeader}><Text style={styles.detailLabel}>PART PROGRESS</Text><Text style={styles.partProgressCount}>{progress.completedPartCount} / {progress.requiredPartCount} complete</Text></View>
      {progress.parts.filter((part) => part.required).map((part) => <View key={part.id} style={styles.partRow}>
        <Text numberOfLines={1} style={styles.partTitle}>{part.title}</Text>
        <View style={styles.partBars}><Segments progress={part.planningPercent} accessibilityLabel={`${part.title} planning ${part.planningPercent}%`} /><Segments progress={part.writingPercent} accessibilityLabel={`${part.title} writing ${part.writingPercent}%`} /></View>
        <Text style={styles.partPercent}>{part.writingPercent}%</Text>
      </View>)}
      <View style={styles.partLegend}><Text style={styles.partLegendText}>PLAN</Text><Text style={styles.partLegendText}>WRITE</Text></View>
      <Pressable onPress={onViewJourney} style={styles.journeyLink} accessibilityRole="button"><Text style={styles.journeyLinkText}>View the full Journey</Text><Text style={styles.journeyLinkArrow}>→</Text></Pressable>
    </ScrollView>

    {feedback ? <View style={styles.feedback}><Text style={styles.feedbackMark}>✓</Text><Text numberOfLines={1} style={styles.feedbackText}>{feedback}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  minimizedWrap: { alignItems: 'center', paddingTop: 4, paddingBottom: 5 },
  minimized: { minWidth: 64, minHeight: 34, paddingHorizontal: 12, borderRadius: bookezRadii.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.borderStrong },
  minimizedValue: { color: c.accent, fontSize: 11, fontWeight: '900' },
  minimizedArrow: { color: c.secondaryAccent, fontSize: 13, fontWeight: '800' },
  collapsed: { minHeight: 53, marginHorizontal: bookezSpacing.page, marginTop: 4, marginBottom: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: bookezRadii.card, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border, shadowColor: c.inkPrimary, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  percentBlock: { width: 42, alignItems: 'center' },
  percent: { color: c.accent, fontSize: 13, fontWeight: '900', lineHeight: 16 },
  percentLabel: { color: c.textMuted, fontSize: 6, fontWeight: '900', letterSpacing: 0.8, marginTop: 1 },
  collapsedContent: { flex: 1, minWidth: 0, gap: 5 },
  segments: { height: 7, flexDirection: 'row', gap: 2, overflow: 'hidden' },
  segment: { flex: 1, borderRadius: 2, backgroundColor: c.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  segmentFilled: { backgroundColor: c.secondaryAccent, borderColor: c.secondaryAccent },
  collapsedNext: { color: c.textSecondary, fontSize: 9, fontWeight: '700' },
  expandArrow: { color: c.accent, fontSize: 16, fontWeight: '800', paddingHorizontal: 3 },
  expanded: { maxHeight: 390, marginHorizontal: bookezSpacing.page, marginTop: 4, marginBottom: 5, borderRadius: bookezRadii.card, backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border, overflow: 'hidden', shadowColor: c.inkPrimary, shadowOpacity: 0.1, shadowRadius: 9, shadowOffset: { width: 0, height: -2 }, elevation: 3 },
  expandedHeader: { minHeight: 54, paddingHorizontal: 13, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: c.divider },
  headerCopy: { flex: 1, minWidth: 0 },
  bookTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '800' },
  stageLine: { color: c.textSecondary, fontSize: 8, marginTop: 3 },
  expandedPercent: { color: c.accent, fontSize: 17, fontWeight: '900' },
  collapseButton: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceMuted },
  collapseText: { color: c.accent, fontSize: 17, fontWeight: '800' },
  minimizeButton: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
  minimizeText: { color: c.textSecondary, fontSize: 18, lineHeight: 20, fontWeight: '800' },
  expandedScroll: { flexGrow: 0 },
  expandedContent: { paddingHorizontal: 13, paddingTop: 10, paddingBottom: 12 },
  stageList: { gap: 6 },
  stageRow: { minHeight: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stageName: { width: 75, color: c.textSecondary, fontSize: 8, fontWeight: '700' },
  stageNameCurrent: { color: c.accent, fontWeight: '900' },
  stageValue: { width: 27, color: c.textMuted, fontSize: 8, fontWeight: '800', textAlign: 'right' },
  lastDone: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: c.divider },
  lastLeftOff: { marginTop: 8 },
  detailLabel: { color: c.textMuted, fontSize: 7, fontWeight: '900', letterSpacing: 0.75 },
  lastDoneText: { color: c.textPrimary, fontSize: 9, fontWeight: '700', marginTop: 3 },
  nextStepCard: { marginTop: 11, padding: 11, borderRadius: bookezRadii.control, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderWarm },
  nextStepCopy: { gap: 4 },
  nextStepKicker: { color: c.secondaryAccent, fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
  nextStepTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '800' },
  nextStepDescription: { color: c.textSecondary, fontSize: 9, lineHeight: 13 },
  continueButton: { minHeight: 38, marginTop: 9, paddingHorizontal: 11, borderRadius: bookezRadii.control, backgroundColor: c.accentStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  continueText: { color: c.textOnAccent, fontSize: 9, fontWeight: '900' },
  continueArrow: { color: c.textOnAccent, fontSize: 14, fontWeight: '900' },
  partProgressHeader: { marginTop: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partProgressCount: { color: c.textMuted, fontSize: 7, fontWeight: '800' },
  partRow: { minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider },
  partTitle: { flex: 1, minWidth: 0, color: c.textSecondary, fontSize: 8, fontWeight: '700' },
  partBars: { width: 76, gap: 3 },
  partPercent: { width: 24, color: c.textMuted, fontSize: 7, textAlign: 'right', fontWeight: '800' },
  partLegend: { width: 100, marginLeft: 'auto', marginTop: 3, flexDirection: 'row', justifyContent: 'space-between' },
  partLegendText: { color: c.textMuted, fontSize: 6, fontWeight: '900', letterSpacing: 0.6 },
  journeyLink: { minHeight: 35, marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  journeyLinkText: { color: c.accent, fontSize: 9, fontWeight: '800' },
  journeyLinkArrow: { color: c.accent, fontSize: 13, fontWeight: '900' },
  feedback: { minHeight: 25, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 8, borderRadius: bookezRadii.control, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.successSoft },
  feedbackMark: { color: c.success, fontSize: 11, fontWeight: '900' },
  feedbackText: { flex: 1, color: c.success, fontSize: 8, fontWeight: '800' },
});
