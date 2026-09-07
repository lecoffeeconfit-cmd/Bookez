import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { bookezColors, bookezWithAlpha } from '../../theme/bookez';
import { BookezMysticIcon } from './BookezMysticIcon';

type Props = {
  type: string;
  width?: number;
  height?: number;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

type CoverPalette = {
  start: string;
  end: string;
  accent: string;
  glyph: string;
  label: string;
  motif: 'arch' | 'band' | 'diamond' | 'moon' | 'rules' | 'stars';
};

const fallbackPalette: CoverPalette = {
  start: '#314A68',
  end: '#1B2D47',
  accent: '#AE9AC8',
  glyph: 'Custom Project',
  label: 'CUSTOM',
  motif: 'diamond',
};

function coverPaletteFor(type: string): CoverPalette {
  const normalized = type.toLowerCase();
  if (normalized.includes('nonfiction')) return { start: '#417478', end: '#244C58', accent: '#9CBBA9', glyph: 'section-brief', label: 'NONFICTION', motif: 'rules' };
  if (normalized.includes('fiction')) return { start: '#5D4B82', end: '#343052', accent: '#B7A2D0', glyph: 'Fiction Book', label: 'FICTION', motif: 'stars' };
  if (normalized.includes('memoir') || normalized.includes('biography')) return { start: '#7B4053', end: '#4E293A', accent: '#CCA08E', glyph: 'Memoir & Biography', label: 'MEMOIR', motif: 'arch' };
  if (normalized.includes('children')) return { start: '#4A6D91', end: '#384C75', accent: '#CFB370', glyph: 'Children’s Book', label: 'STORY', motif: 'moon' };
  if (normalized.includes('poetry')) return { start: '#704265', end: '#432D50', accent: '#C3A0B8', glyph: 'Poetry Collection', label: 'POETRY', motif: 'stars' };
  if (normalized.includes('journal') || normalized.includes('diary')) return { start: '#62735B', end: '#3B554C', accent: '#C2B178', glyph: 'writing-rhythm', label: 'JOURNAL', motif: 'rules' };
  if (normalized.includes('workbook')) return { start: '#555F88', end: '#353C62', accent: '#A9B9B5', glyph: 'Workbook', label: 'WORKBOOK', motif: 'band' };
  if (normalized.includes('guide') || normalized.includes('manual')) return { start: '#3E6B79', end: '#294C61', accent: '#B7A36E', glyph: 'Guide or Manual', label: 'GUIDE', motif: 'diamond' };
  if (normalized.includes('essay')) return { start: '#68516E', end: '#423747', accent: '#BFA88A', glyph: 'find-across-book', label: 'ESSAYS', motif: 'arch' };
  if (normalized.includes('script')) return { start: '#865947', end: '#57382F', accent: '#D0A175', glyph: 'Script', label: 'SCRIPT', motif: 'band' };
  if (normalized.includes('speech') || normalized.includes('presentation')) return { start: '#793349', end: '#4F2034', accent: '#C7A46B', glyph: 'Speech or Presentation', label: 'SPEECH', motif: 'arch' };
  if (normalized.includes('custom')) return fallbackPalette;
  return fallbackPalette;
}

function CoverMotif({ kind, accent }: { kind: CoverPalette['motif']; accent: string }) {
  if (kind === 'band') return <View pointerEvents="none" style={[styles.band, { borderColor: bookezWithAlpha(accent, 0.54), backgroundColor: bookezWithAlpha(accent, 0.08) }]} />;
  if (kind === 'arch') return <View pointerEvents="none" style={[styles.arch, { borderColor: bookezWithAlpha(accent, 0.44) }]} />;
  if (kind === 'moon') return <><View pointerEvents="none" style={[styles.moon, { borderColor: bookezWithAlpha(accent, 0.5) }]} /><View pointerEvents="none" style={[styles.starDot, { backgroundColor: accent }]} /></>;
  if (kind === 'rules') return <View pointerEvents="none" style={styles.ruleGroup}><View style={[styles.rule, { backgroundColor: bookezWithAlpha(accent, 0.42) }]} /><View style={[styles.rule, styles.ruleShort, { backgroundColor: bookezWithAlpha(accent, 0.3) }]} /><View style={[styles.rule, { backgroundColor: bookezWithAlpha(accent, 0.2) }]} /></View>;
  if (kind === 'stars') return <><Text pointerEvents="none" style={[styles.starOne, { color: accent }]}>·</Text><Text pointerEvents="none" style={[styles.starTwo, { color: accent }]}>✦</Text><Text pointerEvents="none" style={[styles.starThree, { color: accent }]}>·</Text></>;
  return <View pointerEvents="none" style={[styles.diamond, { borderColor: bookezWithAlpha(accent, 0.46) }]} />;
}

export function BookezDefaultCover({ type, width, height, animated = false, style }: Props) {
  const palette = coverPaletteFor(type);
  const [reduceMotion, setReduceMotion] = useState(false);
  const gleam = useRef(new Animated.Value(0)).current;
  const measuredWidth = width ?? 44;
  const rootWidth: DimensionValue = width ?? '100%';
  const rootHeight: DimensionValue = height ?? '100%';
  const iconSize = Math.max(18, Math.min(34, Math.round(measuredWidth * 0.57)));
  const compact = measuredWidth < 42;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => mounted && setReduceMotion(enabled));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    gleam.stopAnimation();
    gleam.setValue(0);
    if (reduceMotion) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (minimumDelay = 10_950) => {
      timer = setTimeout(() => {
        if (stopped) return;
        gleam.setValue(0);
        Animated.timing(gleam, { toValue: 1, duration: 1050, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }).start(({ finished }) => {
          if (finished && !stopped) schedule();
        });
      }, minimumDelay + Math.round(Math.random() * 6_000));
    };
    schedule(12_000);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      gleam.stopAnimation();
    };
  }, [gleam, reduceMotion]);

  const gleamTravel = gleam.interpolate({ inputRange: [0, 1], outputRange: [-measuredWidth * 0.85, measuredWidth * 1.15] });
  const gleamOpacity = gleam.interpolate({ inputRange: [0, 0.12, 0.55, 0.9, 1], outputRange: [0, 0.08, 0.2, 0.06, 0] });

  return <View style={[styles.cover, { width: rootWidth, height: rootHeight, borderRadius: Math.max(6, measuredWidth * 0.14) }, style]}>
    <LinearGradient colors={[palette.start, palette.end]} start={{ x: 0.08, y: 0 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={[styles.spine, { width: Math.max(4, measuredWidth * 0.11), backgroundColor: bookezWithAlpha('#161524', 0.22), borderRightColor: bookezWithAlpha(palette.accent, 0.45) }]} />
    <View pointerEvents="none" style={[styles.frame, { borderRadius: Math.max(4, measuredWidth * 0.1), borderColor: bookezWithAlpha(palette.accent, 0.72) }]} />
    <CoverMotif kind={palette.motif} accent={palette.accent} />
    <View pointerEvents="none" style={[styles.sigil, { width: iconSize + 7, height: iconSize + 7, borderRadius: (iconSize + 7) / 2, borderColor: bookezWithAlpha(palette.accent, 0.58), backgroundColor: bookezWithAlpha('#182236', 0.13) }]}>
      <BookezMysticIcon name={palette.glyph} size={iconSize} surface="bare" tone={bookezColors.textOnAccent} animated={animated} />
    </View>
    {!compact && <Text numberOfLines={1} pointerEvents="none" style={[styles.label, { color: palette.accent, fontSize: Math.max(4.5, measuredWidth * 0.085) }]}>{palette.label}</Text>}
    <View pointerEvents="none" style={[styles.cornerTop, { borderColor: bookezWithAlpha(palette.accent, 0.78) }]} />
    <View pointerEvents="none" style={[styles.cornerBottom, { borderColor: bookezWithAlpha(palette.accent, 0.78) }]} />
    {!reduceMotion && <Animated.View pointerEvents="none" style={[styles.gleam, { width: Math.max(8, measuredWidth * 0.24), opacity: gleamOpacity, transform: [{ translateX: gleamTravel }, { rotate: '-18deg' }] }]}><LinearGradient colors={['rgba(255,248,226,0)', bookezWithAlpha(palette.accent, 0.8), 'rgba(255,248,226,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  cover: { position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: bookezColors.manuscriptEdge, shadowColor: '#241D26', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  spine: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRightWidth: StyleSheet.hairlineWidth },
  frame: { position: 'absolute', top: 4, right: 4, bottom: 4, left: 5, borderWidth: StyleSheet.hairlineWidth },
  sigil: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  label: { position: 'absolute', right: 5, bottom: 5, left: 7, fontWeight: '800', letterSpacing: 0.7, textAlign: 'center' },
  band: { position: 'absolute', top: '27%', right: 4, left: 5, height: '45%', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  arch: { position: 'absolute', top: '15%', width: '58%', height: '66%', borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderTopLeftRadius: 99, borderTopRightRadius: 99 },
  moon: { position: 'absolute', top: '15%', right: '12%', width: '22%', aspectRatio: 1, borderRadius: 99, borderWidth: StyleSheet.hairlineWidth, borderLeftColor: 'transparent' },
  starDot: { position: 'absolute', top: '20%', left: '18%', width: 2, height: 2, borderRadius: 1, opacity: 0.72 },
  ruleGroup: { position: 'absolute', right: '13%', bottom: '17%', left: '22%', gap: 3 },
  rule: { height: StyleSheet.hairlineWidth },
  ruleShort: { width: '68%' },
  starOne: { position: 'absolute', top: '12%', left: '22%', fontSize: 8, opacity: 0.78 },
  starTwo: { position: 'absolute', top: '17%', right: '15%', fontSize: 6, opacity: 0.68 },
  starThree: { position: 'absolute', bottom: '18%', right: '20%', fontSize: 9, opacity: 0.62 },
  diamond: { position: 'absolute', top: '12%', width: '54%', aspectRatio: 1, borderWidth: StyleSheet.hairlineWidth, transform: [{ rotate: '45deg' }], opacity: 0.52 },
  cornerTop: { position: 'absolute', top: 7, left: 8, width: 6, height: 6, borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth },
  cornerBottom: { position: 'absolute', right: 6, bottom: 7, width: 6, height: 6, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  gleam: { position: 'absolute', top: -18, bottom: -18, left: 0, zIndex: 8 },
});
