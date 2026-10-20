import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BookezAchievementSeal, BookezOpenBook, BookezPlanningLeaf, BookezQuill } from './bookez-art';
import { bookezColors as colors, bookezFonts, bookezWithAlpha } from '../theme/bookez';

type Props = {
  title: string;
  milestoneId: string;
  estimate: string;
  progress: number;
  current: boolean;
  locked: boolean;
  selected: boolean;
  compact?: boolean;
  meta?: string;
  index: number;
  pulse: Animated.Value;
  reduceMotion: boolean;
  style: StyleProp<ViewStyle>;
  onPress: () => void;
};

export default function JourneyStepCard({ title, milestoneId, estimate, progress, current, locked, selected, compact = false, meta, index, pulse, reduceMotion, style, onPress }: Props) {
  const press = useRef(new Animated.Value(1)).current;
  const complete = progress >= 100;
  const accent = complete ? colors.success : current ? colors.accent : colors.secondaryAccent;
  const status = complete ? 'COMPLETE' : locked ? 'LOCKED' : current ? 'YOU ARE HERE' : compact ? `STEP ${index + 1}` : 'AHEAD';
  const artProps = { width: compact ? 25 : 38, height: compact ? 25 : 38, color: accent, accent: colors.gold };
  const illustration = complete || milestoneId === 'manuscript-complete' ? <BookezAchievementSeal {...artProps} />
    : milestoneId === 'book-started' || milestoneId === 'outline' ? <BookezPlanningLeaf {...artProps} />
      : milestoneId === 'book-foundation' || milestoneId === 'halfway-point' ? <BookezOpenBook {...artProps} />
        : <BookezQuill {...artProps} />;
  const animatePress = (value: number) => {
    if (reduceMotion) return;
    Animated.timing(press, { toValue: value, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  return <Animated.View style={[styles.position, style, { transform: [{ scale: press }] }]}>
    <Pressable onPress={onPress} onPressIn={() => animatePress(0.97)} onPressOut={() => animatePress(1)}
      accessibilityRole="button" accessibilityState={{ expanded: selected }}
      accessibilityLabel={`${title}, ${Math.round(progress)} percent complete, ${status.toLowerCase()}, ${complete ? 'completed' : `estimated ${estimate}`}. Open details.`}
      style={[styles.card, compact && styles.compact, current && styles.current, complete && styles.complete, selected && styles.selected]}>
      <LinearGradient pointerEvents="none" colors={[bookezWithAlpha(accent, current ? 0.14 : 0.07), 'rgba(255,248,238,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.artRow, compact && styles.compactArtRow]}>
        <Animated.View style={[styles.illustration, compact && styles.compactIllustration, { backgroundColor: bookezWithAlpha(accent, 0.06), borderColor: bookezWithAlpha(accent, 0.16) }, current && !reduceMotion && { transform: [{ translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, -2] }) }, { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '3deg'] }) }] }]}>{illustration}</Animated.View>
        <Text style={[styles.waypoint, compact && styles.compactWaypoint, { color: accent }]}>{compact ? complete ? '✓ DONE' : current ? 'NEXT' : locked ? 'LATER' : `STEP ${index + 1}` : complete ? '✓' : String(index + 1).padStart(2, '0')}</Text>
      </View>
      {!compact && <View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: accent }]} /><Text style={[styles.status, { color: accent }]}>{status}</Text></View>}
      <Text numberOfLines={compact ? 2 : 3} style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
      {!compact && meta && <Text style={styles.meta}>{meta}</Text>}
      <View style={[styles.timeBadge, { backgroundColor: bookezWithAlpha(accent, 0.04), borderColor: bookezWithAlpha(accent, 0.14) }]}>
        {complete ? <Text style={[styles.timeText, { color: accent }]}>✓ Complete</Text> : <>
          <View accessibilityElementsHidden style={[styles.clock, { borderColor: accent }]}><View style={[styles.clockHand, { backgroundColor: accent }]} /><View style={[styles.clockHand, styles.clockMinute, { backgroundColor: accent }]} /></View>
          <Text style={[styles.timeText, { color: accent }]}>{estimate}</Text>
        </>}
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: accent }]} /></View>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute', zIndex: 4 },
  card: { overflow: 'hidden', padding: 10, paddingBottom: 15, borderRadius: 17, backgroundColor: 'rgba(255,248,238,0.98)', borderWidth: 1, borderColor: bookezWithAlpha(colors.secondaryAccent, 0.25), shadowColor: colors.shadowWarm, shadowOpacity: 0.09, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  compact: { padding: 9, paddingBottom: 11, borderRadius: 14 },
  current: { borderColor: bookezWithAlpha(colors.accent, 0.45), shadowColor: colors.accent, shadowOpacity: 0.14, shadowRadius: 11 },
  complete: { borderColor: bookezWithAlpha(colors.success, 0.35) },
  selected: { borderColor: colors.accent, backgroundColor: colors.white },
  artRow: { height: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  compactArtRow: { height: 27, marginBottom: 4 },
  illustration: { width: 43, height: 43, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  compactIllustration: { width: 29, height: 29, borderRadius: 15 },
  waypoint: { fontFamily: bookezFonts.serif, fontSize: 22, opacity: 0.5 },
  compactWaypoint: { fontFamily: bookezFonts.sans, fontSize: 7, letterSpacing: 0.4, fontWeight: '800', opacity: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  status: { fontSize: 7, lineHeight: 10, letterSpacing: 0.7, fontWeight: '800', flexShrink: 1 },
  title: { fontFamily: bookezFonts.serif, color: colors.textPrimary, fontSize: 13, lineHeight: 16, fontWeight: '600' },
  compactTitle: { fontFamily: bookezFonts.sans, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  meta: { fontSize: 9, lineHeight: 12, color: colors.textSecondary, marginTop: 7, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: bookezWithAlpha(colors.secondaryAccent, 0.2) },
  timeBadge: { marginTop: 7, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderRadius: 7, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  timeText: { fontSize: 9, lineHeight: 12, fontWeight: '700', flexShrink: 1 },
  clock: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  clockHand: { position: 'absolute', width: 1, height: 3, left: 3.5, top: 1.5, borderRadius: 1 },
  clockMinute: { height: 2.5, left: 4.5, top: 3.5, transform: [{ rotate: '-55deg' }] },
  track: { position: 'absolute', left: 9, bottom: 5, right: 9, height: 2, borderRadius: 2, overflow: 'hidden', backgroundColor: bookezWithAlpha(colors.secondaryAccent, 0.14) },
  fill: { height: '100%', borderRadius: 2 },
});
