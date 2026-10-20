import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { BookezDefaultCover, BookezOpenBook, BookezQuill } from './bookez-art';
import { useBookezReduceMotion } from './BookezUI';
import { bookezColors as c, bookezType, bookezWithAlpha as alpha } from '../theme/bookez';
import { getLibraryDashboardSummary, type LibraryDashboardBook } from '../lib/library-dashboard';
import type { BookProgressStageKey } from '../lib/book-progress';

type Props = {
  books: LibraryDashboardBook[];
  activeBookId?: string;
  onChooseBook: () => void;
  onSelectBook: (book: LibraryDashboardBook) => void;
  onContinue: () => void;
  onViewJourney: () => void;
  onViewStats: () => void;
  onCreateBook: () => void;
  onDailyCheckIn: () => void;
  dailyCheckInOpen: boolean;
  checkedInToday: boolean;
};

const stages: BookProgressStageKey[] = ['setup', 'planning', 'writing', 'revision', 'finishing'];
const count = (value: number) => Math.round(value).toLocaleString('en-US');
const compactCount = (value: number) => value >= 1000000 ? `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}m` : value >= 100000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : count(value);

/** Curved leaves, page strata, leather grain and reflected light stay vector sharp. */
function LedgerArtwork({ wide }: { wide: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fold = wide ? 235 : 30;
  return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 600 400" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
    <Defs>
      <SvgGradient id={`${id}leather`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#79364C" /><Stop offset="0.22" stopColor={c.bookCoverLight} /><Stop offset="0.7" stopColor={c.bookCover} /><Stop offset="1" stopColor="#2C101B" /></SvgGradient>
      <SvgGradient id={`${id}left`} x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#BCA175" /><Stop offset="0.07" stopColor="#EFE0C1" /><Stop offset="0.6" stopColor="#F6EACF" /><Stop offset="0.9" stopColor="#D9C49B" /><Stop offset="1" stopColor="#AB8D5F" /></SvgGradient>
      <SvgGradient id={`${id}right`} x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#BBA078" /><Stop offset="0.045" stopColor="#E3CFAC" /><Stop offset="0.15" stopColor="#FBF1DC" /><Stop offset="0.7" stopColor="#F7EAD0" /><Stop offset="0.96" stopColor="#EAD7B6" /><Stop offset="1" stopColor="#D4B98D" /></SvgGradient>
      <SvgGradient id={`${id}metal`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#F5DFA4" /><Stop offset="0.4" stopColor="#B89150" /><Stop offset="0.65" stopColor="#E4C382" /><Stop offset="1" stopColor="#846132" /></SvgGradient>
      <SvgGradient id={`${id}curl`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFF8E9" /><Stop offset="0.5" stopColor="#F5E5C5" /><Stop offset="1" stopColor="#B59B71" /></SvgGradient>
    </Defs>
    <Rect x="2" y="4" width="596" height="391" rx="12" fill={`url(#${id}leather)`} />
    <Rect x="8" y="9" width="584" height="379" rx="9" fill="none" stroke="#C29B60" strokeOpacity="0.6" strokeWidth="0.8" />
    <Rect x="11" y="12" width="578" height="373" rx="7" fill="none" stroke="#E4C891" strokeOpacity="0.18" strokeWidth="0.5" />
    {Array.from({ length: 34 }, (_, i) => <Path key={i} d={`M${15 + i * 17} 6 l-4 383`} stroke="#190911" strokeWidth="0.5" opacity="0.12" />)}
    {/* Each visible leaf has its own edge and bowed fore-edge. */}
    {[0, 1, 2, 3].map(i => <Path key={i} d={`M18 ${35 + i * 2} Q${fold / 2} ${27 + i * 2} ${fold} ${36 + i * 2} Q410 ${24 + i * 2} 582 ${34 + i * 2} L582 ${371 + i * 2} Q410 ${383 + i * 2} ${fold} ${374 + i * 2} Q110 ${382 + i * 2} 18 ${372 + i * 2} Z`} fill={i % 2 ? '#D3BD96' : '#F2E2C5'} stroke="#9D8056" strokeOpacity="0.6" strokeWidth="0.6" />)}
    <Path d={`M18 32 Q${fold / 2} 23 ${fold} 34 L${fold} 369 Q110 378 18 368 Z`} fill={`url(#${id}left)`} />
    <Path d={`M${fold} 34 Q410 22 582 32 L582 365 Q410 377 ${fold} 369 Z`} fill={`url(#${id}right)`} />
    <Path d={`M${fold} 36 Q${fold - 3} 190 ${fold} 367`} fill="none" stroke="#725335" strokeOpacity="0.35" strokeWidth="1.4" />
    <Path d={`M${fold + 3} 36 Q${fold + 1} 190 ${fold + 3} 367`} fill="none" stroke="#FFF7E1" strokeOpacity="0.75" strokeWidth="1.2" />
    {[88, 154, 225, 296].map((y, i) => <Path key={y} d={`M${fold + 17} ${y} Q390 ${y - 3} 565 ${y + 1}`} stroke="#AA8754" opacity="0.055" strokeWidth="0.6" fill="none" />)}
    <Path d="M562 32 L582 52 L562 49 Q566 40 562 32Z" fill="#B59B71" opacity="0.15" />
    <Path d="M562 32 Q571 38 582 32 L582 52 Q576 45 562 49Z" fill={`url(#${id}curl)`} />
    <Path d="M5 58 h8 M5 149 h8 M5 247 h8 M5 343 h8" stroke={`url(#${id}metal)`} strokeWidth="3" />
    <Path d="M582 384 h9 v-11 M19 384 h-9 v-11" stroke={`url(#${id}metal)`} strokeWidth="2" fill="none" />
    <Path d="M550 6 h13 v42 l-6.5-6-6.5 6Z" fill={`url(#${id}metal)`} />
    <Path d="M552 7 v32" stroke="#FFE9B8" strokeOpacity="0.55" strokeWidth="0.7" />
  </Svg>;
}

export default function LibraryBookDashboard({ books, activeBookId, onChooseBook, onSelectBook, onContinue, onViewJourney, onViewStats, onCreateBook, onDailyCheckIn, dailyCheckInOpen, checkedInToday }: Props) {
  const [width, setWidth] = useState(0);
  const wide = width >= 620;
  const reduceMotion = useBookezReduceMotion();
  const breathe = useRef(new Animated.Value(0)).current;
  const gleam = useRef(new Animated.Value(0)).current;
  const summary = getLibraryDashboardSummary(books, activeBookId);
  const book = summary.focusBook;
  const progress = book?.progress;
  const remainingParts = progress ? Math.max(0, progress.requiredPartCount - progress.completedPartCount) : 0;
  const remaining = !progress ? '' : progress.progressPercent === 100 ? 'Finished, and ready to share.' : !progress.writingComplete ? `${remainingParts} ${remainingParts === 1 ? 'part' : 'parts'} left to draft` : !progress.reviewComplete ? `${progress.unresolvedIssueCount ? `${progress.unresolvedIssueCount} review items · ` : ''}Final review is next` : 'Ready for your final export';

  useEffect(() => {
    breathe.setValue(0);
    gleam.setValue(0);
    if (reduceMotion) return;
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(breathe, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    const light = Animated.loop(Animated.sequence([
      Animated.delay(2400),
      Animated.timing(gleam, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
      Animated.delay(5800),
      Animated.timing(gleam, { toValue: 0, duration: 0, useNativeDriver: true, isInteraction: false }),
    ]));
    motion.start(); light.start();
    return () => { motion.stop(); light.stop(); };
  }, [breathe, gleam, reduceMotion]);

  const metrics = <Pressable onPress={onViewStats} style={[s.metrics, wide && s.metricsWide]} accessibilityRole="button" accessibilityLabel={`Writing review: ${count(summary.totalWords)} words, ${summary.completedParts} parts finished, ${count(summary.weekWords)} words this week. View all stats.`}>
    <View style={s.metric}><Text numberOfLines={1} adjustsFontSizeToFit style={[s.metricValue, wide && s.metricValueWide]}>{compactCount(summary.totalWords)}</Text><Text style={s.metricLabel}>words written</Text></View>
    <View style={[s.metric, !wide && s.metricDivider]}><Text style={[s.metricValue, wide && s.metricValueWide]}>{summary.completedParts}</Text><Text style={s.metricLabel}>parts finished</Text></View>
    <View style={[s.metric, !wide && s.metricDivider]}><Text numberOfLines={1} adjustsFontSizeToFit style={[s.metricValue, wide && s.metricValueWide]}>{compactCount(summary.weekWords)}</Text><Text style={s.metricLabel}>words this week</Text></View>
    {!wide && <Text style={s.metricArrow}>↗</Text>}
  </Pressable>;

  const nextBook = <Pressable onPress={() => summary.nextBook ? onSelectBook(summary.nextBook) : onCreateBook()} style={[s.nextBook, wide && s.nextBookWide]} accessibilityRole="button" accessibilityLabel={summary.nextBook ? `Focus on ${summary.nextBook.title}` : 'Start a new book'}>
    <View style={s.nextBookCopy}><Text style={s.eyebrow}>{summary.nextBook ? 'NEXT ON YOUR SHELF' : 'YOUR NEXT LITTLE WORLD'}</Text><Text numberOfLines={1} style={s.nextBookTitle}>{summary.nextBook?.title ?? 'Start a new book'}</Text></View><Text style={s.nextArrow}>↗</Text>
  </Pressable>;

  return <View testID="library-book-dashboard" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={s.wrap}>
    <View pointerEvents="none" style={s.contactShadow} />
    <Animated.View style={[s.book, { transform: [{ perspective: 1200 }, { rotateX: breathe.interpolate({ inputRange: [0, 1], outputRange: ['1.6deg', '2.2deg'] }) }, { rotateZ: breathe.interpolate({ inputRange: [0, 1], outputRange: ['-0.3deg', '0.1deg'] }) }, { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) }] }]}>
      <LedgerArtwork wide={wide} />
      <View style={s.coverHeader}><BookezOpenBook width={21} height={15} color={c.bookPaperLight} accent={c.bookBrass} /><Text style={s.coverTitle}>THE DAILY LEDGER</Text>{book && <Pressable onPress={onDailyCheckIn} hitSlop={6} style={s.checkIn} accessibilityRole="button" accessibilityLabel="Writing goals and daily check-in" accessibilityState={{ expanded: dailyCheckInOpen }}><Text style={s.checkInText}>{checkedInToday ? '✓ Checked in' : 'Daily check-in'} <Text style={s.checkInChevron}>{dailyCheckInOpen ? '−' : '＋'}</Text></Text></Pressable>}</View>
      <View style={[s.contents, wide && s.contentsWide]}>
        {wide && <View style={s.recapPage}><View style={s.recapHeading}><Text style={s.eyebrow}>YOUR WRITING REVIEW</Text><BookezQuill width={24} height={34} color={c.bookInk} accent={c.bookBrass} /></View><Text style={s.recapTitle}>A little closer,<Text style={s.italic}> every day.</Text></Text>{metrics}<Pressable onPress={onViewStats} style={s.statsLink} accessibilityRole="button"><Text style={s.statsLinkText}>Full writing review</Text><Text style={s.nextArrow}>↗</Text></Pressable><Text style={s.recapFoot}>{summary.activeBooks} in progress · {summary.completedBooks} finished</Text></View>}
        <View style={[s.focusPage, wide && s.focusPageWide]}>
          {book && progress ? <>
            <Pressable onPress={onChooseBook} style={s.bookIdentity} accessibilityRole="button" accessibilityLabel="Choose the book shown in your dashboard">
              <View style={s.coverThumb}>{book.coverImageUri ? <Image source={{ uri: book.coverImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <BookezDefaultCover type={book.type} width={33} height={46} />}<View pointerEvents="none" style={s.thumbSpine} /></View>
              <View style={s.identityCopy}><Text style={s.eyebrow}>YOUR FOCUS BOOK</Text><Text numberOfLines={2} style={[s.bookTitle, wide && s.bookTitleWide]}>{book.title}</Text></View><Text style={s.switchArrow}>⌄</Text>
            </Pressable>
            <View style={s.progressHeading}><Text style={s.progressLabel}><Text style={s.percent}>{progress.progressPercent}%</Text> · {progress.stageLabel}</Text><Text style={s.partsCount}>{progress.completedPartCount}/{progress.requiredPartCount} parts</Text></View>
            <View style={s.stageTrack} accessibilityRole="progressbar" accessibilityLabel={`Book completion, ${progress.stageLabel}`} accessibilityValue={{ min: 0, max: 100, now: progress.progressPercent }}>{stages.map(stage => <View key={stage} style={s.stageSegment}><View style={[s.stageFill, { width: `${progress.stageProgress[stage]}%` }, progress.stageProgress[stage] >= 100 && s.stageComplete]} /></View>)}</View>
            <View style={s.nextStep}><Text style={s.eyebrow}>PICK UP WHERE YOU LEFT OFF</Text><Text numberOfLines={2} style={s.nextStepTitle}>{progress.nextStep.title}</Text><Text numberOfLines={1} style={s.remaining}>{remaining}</Text>{wide && <Text numberOfLines={2} style={s.nextStepDetail}>{progress.nextStep.description}</Text>}</View>
            <View style={s.actions}><Pressable onPress={onContinue} style={({ pressed }) => [s.continueButton, pressed && s.buttonPressed]} accessibilityRole="button"><Text numberOfLines={1} style={s.continueText}>{progress.nextStep.buttonLabel}</Text><Text style={s.continueArrow}>→</Text></Pressable><Pressable onPress={onViewJourney} style={({ pressed }) => [s.journeyButton, pressed && s.buttonPressed]} accessibilityRole="button"><Text style={s.journeyText}>Journey ↗</Text></Pressable></View>
          </> : <View style={s.empty}><BookezOpenBook width={88} height={55} color={c.bookInk} accent={c.bookBrass} /><Text style={s.emptyTitle}>Your story starts here.</Text><Text style={s.nextStepDetail}>A name, an idea, a first page. We’ll keep your next step here.</Text><Pressable onPress={onCreateBook} style={[s.continueButton, s.emptyButton]} accessibilityRole="button"><Text style={s.continueText}>Start your first book</Text><Text style={s.continueArrow}>→</Text></Pressable></View>}
          {!wide && metrics}
          {nextBook}
        </View>
      </View>
      <Animated.View pointerEvents="none" style={[s.gleam, { opacity: gleam.interpolate({ inputRange: [0, 0.15, 0.65, 1], outputRange: [0, 0.2, 0.16, 0] }), transform: [{ translateX: gleam.interpolate({ inputRange: [0, 1], outputRange: [-70, width + 50] }) }, { skewX: '-18deg' }] }]}><LinearGradient colors={['transparent', '#FFF7DA', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>
    </Animated.View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { marginTop: 9, marginBottom: 5, paddingBottom: 8, paddingHorizontal: 1 },
  contactShadow: { position: 'absolute', left: 16, right: 8, bottom: 7, height: 21, borderRadius: 50, backgroundColor: alpha(c.bookInk, 0.13), shadowColor: c.bookInk, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  book: { paddingLeft: 27, paddingRight: 16, paddingBottom: 24, shadowColor: '#52361F', shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 3, height: 9 }, elevation: 5 },
  coverHeader: { minHeight: 34, paddingTop: 2, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  coverTitle: { flex: 1, color: '#F2DEBA', fontSize: 8, letterSpacing: 1.25, fontWeight: '700' },
  checkIn: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 2 },
  checkInText: { color: '#F8E6C8', fontSize: 10, fontWeight: '600' },
  checkInChevron: { color: '#D6B06D', fontSize: 12 },
  contents: { paddingTop: 9, paddingBottom: 1 },
  contentsWide: { flexDirection: 'row', paddingTop: 13 },
  recapPage: { width: '38%', paddingLeft: 3, paddingRight: 24 },
  recapHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: c.bookInkMuted, fontSize: 8, lineHeight: 11, letterSpacing: 0.85, fontWeight: '800' },
  recapTitle: { color: c.bookInk, fontFamily: bookezType.sectionTitle.fontFamily, fontSize: 25, lineHeight: 30, marginTop: 7, maxWidth: 230 },
  italic: { fontStyle: 'italic' },
  focusPage: { paddingLeft: 1, paddingRight: 2 },
  focusPageWide: { flex: 1, paddingLeft: 22, paddingRight: 7 },
  bookIdentity: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10 },
  coverThumb: { width: 33, height: 46, borderRadius: 2, backgroundColor: c.bookCover, shadowColor: c.bookInk, shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 2, height: 3 }, transform: [{ perspective: 400 }, { rotateY: '-10deg' }, { rotateZ: '-3deg' }] },
  thumbSpine: { position: 'absolute', left: 2, width: 1, top: 1, bottom: 1, backgroundColor: '#FFF6D4', opacity: 0.35 },
  identityCopy: { flex: 1, minWidth: 0 },
  bookTitle: { color: c.bookInk, fontFamily: bookezType.pageTitle.fontFamily, fontSize: 17, lineHeight: 20, fontWeight: '600', letterSpacing: -0.4, marginTop: 3 },
  bookTitleWide: { fontSize: 23, lineHeight: 27 },
  switchArrow: { color: c.bookCover, fontSize: 17, paddingLeft: 3 },
  progressHeading: { marginTop: 9, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  progressLabel: { color: c.bookInkMuted, fontSize: 10 },
  percent: { color: c.bookCover, fontSize: 15, fontWeight: '800' },
  partsCount: { color: c.bookInkMuted, fontSize: 9 },
  stageTrack: { flexDirection: 'row', gap: 3, height: 4, marginTop: 5 },
  stageSegment: { flex: 1, borderRadius: 2, backgroundColor: alpha(c.bookPaperEdge, 0.25), overflow: 'hidden' },
  stageFill: { height: '100%', backgroundColor: c.bookCover, borderRadius: 2 },
  stageComplete: { backgroundColor: c.success },
  nextStep: { marginTop: 11, minHeight: 61 },
  nextStepTitle: { color: c.bookInk, fontFamily: bookezType.sectionTitle.fontFamily, fontSize: 16, lineHeight: 20, fontWeight: '600', marginTop: 3 },
  remaining: { color: c.bookCover, fontSize: 10, lineHeight: 14, marginTop: 3 },
  nextStepDetail: { color: c.bookInkMuted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 6 },
  continueButton: { flex: 1, minHeight: 42, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: c.bookCover, borderTopWidth: 1, borderTopColor: '#865064', borderBottomWidth: 2, borderBottomColor: '#2D0B18', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  buttonPressed: { opacity: 0.82, transform: [{ translateY: 1 }] },
  continueText: { flexShrink: 1, color: c.textOnAccent, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  continueArrow: { color: c.bookPaperLight, fontSize: 19 },
  journeyButton: { minHeight: 42, paddingHorizontal: 10, borderRadius: 8, backgroundColor: alpha('#FFF9E9', 0.35), borderWidth: 1, borderColor: alpha(c.bookCover, 0.25), justifyContent: 'center' },
  journeyText: { color: c.bookCover, fontSize: 10, fontWeight: '700' },
  metrics: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: alpha(c.bookPaperEdge, 0.35), marginTop: 10, paddingTop: 9, paddingBottom: 6, minHeight: 49 },
  metricsWide: { flexWrap: 'wrap', borderTopWidth: 0, marginTop: 14, gap: 13, paddingTop: 0, paddingBottom: 0 },
  metric: { flex: 1, minWidth: 0, paddingRight: 5 },
  metricDivider: { borderLeftWidth: 1, borderLeftColor: alpha(c.bookPaperEdge, 0.25), paddingLeft: 9 },
  metricValue: { color: c.bookInk, fontFamily: bookezType.sectionTitle.fontFamily, fontSize: 18, lineHeight: 22, fontWeight: '600' },
  metricValueWide: { fontSize: 22, lineHeight: 27 },
  metricLabel: { color: c.bookInkMuted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  metricArrow: { color: c.bookCover, fontSize: 14, paddingLeft: 3 },
  statsLink: { minHeight: 44, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsLinkText: { color: c.bookCover, fontSize: 11, fontWeight: '700' },
  recapFoot: { color: c.bookInkMuted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  nextBook: { minHeight: 43, marginTop: 3, borderTopWidth: 1, borderTopColor: alpha(c.bookPaperEdge, 0.35), paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextBookWide: { marginTop: 13 },
  nextBookCopy: { flex: 1, minWidth: 0 },
  nextBookTitle: { color: c.bookInk, fontFamily: bookezType.sectionTitle.fontFamily, fontSize: 13, lineHeight: 17, marginTop: 1, fontWeight: '600' },
  nextArrow: { color: c.bookCover, fontSize: 17 },
  gleam: { position: 'absolute', top: 4, bottom: 9, width: 55 },
  empty: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  emptyTitle: { color: c.bookInk, fontFamily: bookezType.sectionTitle.fontFamily, fontSize: 21, lineHeight: 26, marginTop: 9 },
  emptyButton: { flex: 0, alignSelf: 'stretch', marginTop: 13 },
});
