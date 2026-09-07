import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { bookezColors, bookezWithAlpha } from '../../theme/bookez';

export type BookezMysticSurface = 'parchment' | 'jewel' | 'bare';
export type BookezMysticShape = 'seal' | 'bookplate';

type Props = {
  name: string;
  size?: number;
  tone?: string;
  surface?: BookezMysticSurface;
  shape?: BookezMysticShape;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

type GlyphName =
  | 'astrolabe'
  | 'bell'
  | 'book'
  | 'cameo'
  | 'cards'
  | 'compass'
  | 'constellation'
  | 'flag'
  | 'hourglass'
  | 'image'
  | 'key'
  | 'knot'
  | 'lantern'
  | 'masks'
  | 'microphone'
  | 'moon'
  | 'ouroboros'
  | 'quill'
  | 'rune'
  | 'scroll'
  | 'spark'
  | 'sun'
  | 'target'
  | 'wand'
  | 'workbook';

const antiqueTones = {
  plum: '#67263F',
  violet: '#5F568D',
  blue: '#3E657E',
  teal: '#3F716F',
  sage: '#596C53',
  rust: '#8A5C45',
  gold: '#98703B',
} as const;

const antiqueAccents = {
  plum: '#C58C88',
  violet: '#B8A0CE',
  blue: '#8EB4BE',
  teal: '#91B09B',
  sage: '#C1A56B',
  rust: '#C69378',
  gold: '#A97A8A',
} as const;

const glyphByName: Record<string, GlyphName> = {
  'ai-writing': 'spark',
  polish: 'wand',
  grammar: 'book',
  dictation: 'microphone',
  'help-me-write': 'lantern',
  'writing-compass': 'compass',
  'private-notes': 'scroll',
  context: 'rune',
  'outline-peek': 'constellation',
  storyboard: 'cards',
  brainstorm: 'spark',
  'character-notes': 'cameo',
  timeline: 'hourglass',
  'plot-threads': 'knot',
  'scene-beats': 'moon',
  research: 'key',
  sources: 'scroll',
  'continuity-check': 'knot',
  rewrite: 'ouroboros',
  expand: 'sun',
  continue: 'compass',
  simplify: 'quill',
  'make-clearer': 'lantern',
  improve: 'wand',
  'dialogue-help': 'masks',
  'description-help': 'sun',
  'writing-stats': 'astrolabe',
  'writing-rhythm': 'hourglass',
  'focus-mode': 'moon',
  'goal-meter': 'target',
  'version-history': 'cards',
  'session-log': 'scroll',
  'add-visual': 'image',
  'read-aloud': 'bell',
  'repetition-scan': 'ouroboros',
  'reference-shelf': 'key',
  'find-across-book': 'lantern',
  'section-brief': 'scroll',
  'outline-navigator': 'constellation',
  'continuity-tracker': 'knot',
  'writing-flags': 'flag',
  shorten: 'quill',
  'match-style': 'rune',
  'notes-to-prose': 'scroll',
  ask: 'key',
  'add-tool': 'spark',
};

function projectGlyph(name: string): GlyphName | null {
  const normalized = name.toLowerCase();
  if (normalized.includes('nonfiction')) return 'scroll';
  if (normalized.includes('fiction')) return 'book';
  if (normalized.includes('memoir') || normalized.includes('biography')) return 'cameo';
  if (normalized.includes('children')) return 'moon';
  if (normalized.includes('poetry')) return 'quill';
  if (normalized.includes('journal') || normalized.includes('diary')) return 'scroll';
  if (normalized.includes('workbook')) return 'workbook';
  if (normalized.includes('guide') || normalized.includes('manual')) return 'compass';
  if (normalized.includes('essay')) return 'quill';
  if (normalized.includes('script')) return 'masks';
  if (normalized.includes('speech') || normalized.includes('presentation')) return 'bell';
  if (normalized.includes('custom')) return 'rune';
  return null;
}

function resolveGlyph(name: string): GlyphName {
  return glyphByName[name.toLowerCase()] ?? projectGlyph(name) ?? 'spark';
}

export function bookezMysticToneFor(name: string) {
  const glyph = resolveGlyph(name);
  if (['wand', 'sun', 'flag'].includes(glyph)) return antiqueTones.gold;
  if (['compass', 'lantern', 'astrolabe'].includes(glyph)) return antiqueTones.blue;
  if (['key', 'knot', 'constellation', 'workbook'].includes(glyph)) return antiqueTones.teal;
  if (['moon', 'hourglass'].includes(glyph)) return antiqueTones.violet;
  if (['cameo', 'masks', 'bell'].includes(glyph)) return antiqueTones.rust;
  if (['scroll', 'quill', 'book', 'cards'].includes(glyph)) return antiqueTones.plum;
  return antiqueTones.violet;
}

export function bookezMysticAccentFor(name: string) {
  const glyph = resolveGlyph(name);
  if (['wand', 'sun', 'flag'].includes(glyph)) return antiqueAccents.gold;
  if (['compass', 'lantern', 'astrolabe'].includes(glyph)) return antiqueAccents.blue;
  if (['key', 'knot', 'constellation', 'workbook'].includes(glyph)) return antiqueAccents.teal;
  if (['moon', 'hourglass'].includes(glyph)) return antiqueAccents.violet;
  if (['cameo', 'masks', 'bell'].includes(glyph)) return antiqueAccents.rust;
  if (['scroll', 'quill', 'book', 'cards'].includes(glyph)) return antiqueAccents.plum;
  return antiqueAccents.violet;
}

function MysticGlyph({ name, size, color, accent }: { name: GlyphName; size: number; color: string; accent: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.55, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const accentCommon = { fill: 'none', stroke: accent, strokeWidth: 1.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let glyph;

  switch (name) {
    case 'book':
      glyph = <><G {...common}><Path d="M5.5 8.5c4.1-.8 7.3.1 10.5 2.5v14c-3.2-2.4-6.4-3.2-10.5-2.4zM26.5 8.5c-4.1-.8-7.3.1-10.5 2.5v14c3.2-2.4 6.4-3.2 10.5-2.4z" /><Path d="M16 11v14M8.5 13c2.1-.2 3.9.2 5.4 1m-5.4 3c2.1-.2 3.9.2 5.4 1m9.6-5c-2.1-.2-3.9.2-5.4 1m5.4 3c-2.1-.2-3.9.2-5.4 1" /></G><Path {...accentCommon} d="m16 4 1.1 2.8L20 8l-2.9 1.1L16 12l-1.1-2.9L12 8l2.9-1.2z" /></>;
      break;
    case 'quill':
      glyph = <><G {...common}><Path d="M8 25C12 18 17 10 24 5c2.3 5.5.7 11-3.7 14.7C16.8 22.6 12.7 24 8 25z" /><Path d="M8 25C13.6 19.4 18.8 12.8 24 5M12.2 21.2l6.1-1.1m-3.2-2.4 5.9-1.5m-3.3-2.1 5-1.9M8 25l-2 3" /></G><Circle cx="25.5" cy="7" r="1.3" fill={accent} /></>;
      break;
    case 'wand':
      glyph = <><G {...common}><Path d="M8 25 21.5 11.5M6.5 26.5l3-3" /><Path d="m22.5 4 1.2 3.3L27 8.5l-3.3 1.2-1.2 3.3-1.2-3.3L18 8.5l3.3-1.2z" /></G><G {...accentCommon}><Path d="m9 7 .8 2.1 2.2.9-2.2.8L9 13l-.9-2.2L6 10l2.1-.9z" /><Path d="M26 17v4m-2-2h4" /></G></>;
      break;
    case 'microphone':
      glyph = <><G {...common}><Rect x="11" y="5" width="10" height="15" rx="5" /><Path d="M8 15c0 5.2 3 8 8 8s8-2.8 8-8M16 23v4m-4 0h8" /><Path d="M13.5 9h5m-5 3h5m-5 3h5" /></G><Path {...accentCommon} d="m25 6 .7 1.8 1.8.7-1.8.7L25 11l-.7-1.8-1.8-.7 1.8-.7z" /></>;
      break;
    case 'compass':
      glyph = <><G {...common}><Circle cx="16" cy="16" r="10.5" /><Circle cx="16" cy="16" r="2" /><Path d="m19.7 12.3-2.2 5.2-5.2 2.2 2.2-5.2zM16 3.5v3m0 19v3M3.5 16h3m19 0h3" /></G><Path d="m19.7 12.3-2.2 5.2-3-3z" fill={accent} fillOpacity={0.7} /></>;
      break;
    case 'scroll':
      glyph = <><G {...common}><Path d="M9 6h14c-2 1.6-2 3.5 0 5v14H9V10c-2-1.2-2-4 0-4z" /><Path d="M9 6c2 1.5 2 3.5 0 5m14 14c2-1.4 2-3.8 0-5M12 13h8m-8 4h8m-8 4h5" /></G><Path {...accentCommon} d="M7 25h16" /></>;
      break;
    case 'rune':
      glyph = <><G {...common}><Path d="m16 5 8.5 11L16 27 7.5 16z" /><Circle cx="16" cy="16" r="3.5" /><Path d="M16 8v4m0 8v4M10 16h3m6 0h3" /></G><Circle cx="16" cy="16" r="1.1" fill={accent} /></>;
      break;
    case 'constellation':
      glyph = <><G {...common}><Path d="m7 22 6-11 6 7 6-10M7 22l12-4 6 6" /><Circle cx="7" cy="22" r="2" /><Circle cx="13" cy="11" r="2" /><Circle cx="19" cy="18" r="2" /><Circle cx="25" cy="8" r="2" /></G><Circle cx="25" cy="24" r="1.5" fill={accent} /></>;
      break;
    case 'cards':
      glyph = <><G {...common}><Rect x="8" y="6" width="15" height="20" rx="2" transform="rotate(-6 15.5 16)" /><Rect x="11" y="6" width="14" height="20" rx="2" /><Path d="M15 11h6m-6 4h6m-6 4h4" /></G><Path {...accentCommon} d="m18 8 .8 1.8 1.7.7-1.7.8L18 13l-.7-1.7-1.8-.8 1.8-.7z" /></>;
      break;
    case 'cameo':
      glyph = <><G {...common}><Path d="M16 5c5 0 8.5 4.8 8.5 10.5S21 27 16 27 7.5 21.2 7.5 15.5 11 5 16 5z" /><Circle cx="16" cy="12" r="3.2" /><Path d="M10.5 22c.9-4 2.8-6 5.5-6s4.6 2 5.5 6" /></G><Path {...accentCommon} d="M8 9 5.5 6.5M24 9l2.5-2.5" /></>;
      break;
    case 'hourglass':
      glyph = <><G {...common}><Path d="M10 5h12M10 27h12M11 6c0 5.5 2 7.6 5 10-3 2.4-5 4.7-5 10m10-20c0 5.5-2 7.6-5 10 3 2.4 5 4.7 5 10" /><Path d="M12.5 8h7l-3.5 5zM12.5 24h7L16 19z" /></G><Circle cx="25" cy="16" r="1.2" fill={accent} /></>;
      break;
    case 'knot':
      glyph = <><G {...common}><Path d="M9 16c-5-5 2-11 7-5l7 8c4 5-3 10-7 5l-7-8z" /><Path d="M23 16c5-5-2-11-7-5l-7 8c-4 5 3 10 7 5l7-8z" /></G><Circle cx="16" cy="16" r="2" fill={accent} fillOpacity={0.6} /></>;
      break;
    case 'moon':
      glyph = <><Path {...common} d="M21.5 24.5A10.5 10.5 0 0 1 12 6c-1 7.5 3.4 13.5 9.5 18.5z" /><Path {...accentCommon} d="m23 7 .9 2.3 2.3.9-2.3.9L23 13.5l-.9-2.4-2.3-.9 2.3-.9z" /><Circle cx="8" cy="22" r="1.2" fill={accent} /></>;
      break;
    case 'key':
      glyph = <><G {...common}><Circle cx="11" cy="12" r="5" /><Path d="m14.5 15.5 10 10m-3.8-3.8 2.3-2.3m-5 0 2.4-2.4" /></G><Circle cx="11" cy="12" r="1.5" fill={accent} /></>;
      break;
    case 'lantern':
      glyph = <><G {...common}><Path d="M12 8h8l2.5 5v11h-13V13zM11 13h10M12 24l-2 3m10-3 2 3M13 8c0-4 6-4 6 0" /><Path d="M13 17c1.5-2.5 4.5-2.5 6 0-1.5 2.5-4.5 2.5-6 0z" /></G><Circle cx="16" cy="17" r="1.5" fill={accent} /></>;
      break;
    case 'ouroboros':
      glyph = <><G {...common}><Path d="M23.5 10A9.5 9.5 0 1 1 16 6.5" /><Path d="m20 6 4 4-5 1M10 10c2-1.7 4.3-2.5 7-2.4" /></G><Path {...accentCommon} d="M8 21c2 2.6 5.2 4 8.5 4" /></>;
      break;
    case 'sun':
      glyph = <><G {...common}><Circle cx="16" cy="16" r="5" /><Line x1="16" y1="4" x2="16" y2="8" /><Line x1="16" y1="24" x2="16" y2="28" /><Line x1="4" y1="16" x2="8" y2="16" /><Line x1="24" y1="16" x2="28" y2="16" /><Path d="m7.5 7.5 2.8 2.8m11.4 11.4 2.8 2.8m0-17-2.8 2.8M10.3 21.7l-2.8 2.8" /></G><Circle cx="16" cy="16" r="2" fill={accent} /></>;
      break;
    case 'astrolabe':
      glyph = <><G {...common}><Circle cx="16" cy="16" r="10" /><Circle cx="16" cy="16" r="5" /><Path d="M16 6v20M6 16h20m-8-8 6 6m-10 10-6-6" /><Circle cx="16" cy="16" r="1.5" /></G><Path {...accentCommon} d="M9 9c4-3 10-3 14 0" /></>;
      break;
    case 'target':
      glyph = <><G {...common}><Circle cx="15" cy="17" r="10" /><Circle cx="15" cy="17" r="5" /><Path d="m15 17 10-10m-4 0h4v4" /></G><Circle cx="15" cy="17" r="1.5" fill={accent} /></>;
      break;
    case 'bell':
      glyph = <><G {...common}><Path d="M9 22h14c-2-2-2.5-4-2.5-8 0-3-1.6-5.5-4.5-5.5S11.5 11 11.5 14c0 4-.5 6-2.5 8zM13.5 24c.6 2.5 4.4 2.5 5 0M16 5v3" /></G><Path {...accentCommon} d="m24 8 .7 1.8 1.8.7-1.8.8L24 13l-.7-1.7-1.8-.8 1.8-.7z" /></>;
      break;
    case 'image':
      glyph = <><G {...common}><Rect x="6" y="7" width="20" height="18" rx="2" /><Circle cx="20.5" cy="12.5" r="2" /><Path d="m8.5 22 5.5-6 3.2 3.1 2.3-2.2 4 5.1" /></G><Path {...accentCommon} d="m9 8 .7 1.7 1.8.8-1.8.7L9 13l-.7-1.8-1.8-.7 1.8-.8z" /></>;
      break;
    case 'flag':
      glyph = <><G {...common}><Path d="M10 27V6m0 2c5-3 8 3 14-1v10c-6 4-9-2-14 1" /><Path d="M7 27h6" /></G><Path {...accentCommon} d="m18 10 .8 1.8 1.7.7-1.7.8L18 15l-.7-1.7-1.8-.8 1.8-.7z" /></>;
      break;
    case 'masks':
      glyph = <><G {...common}><Path d="M6 9c4-2 8-2 12 0v8c-2 5-8 5-10 0zM15 13c3-2 7-2 11 0l-2 9c-3 4-8 3-10-1" /><Path d="M9 13h2m3 0h2m-5 4c1 1 2 1 3 0m5 0h2m-3 4c1-1 2-1 3 0" /></G><Circle cx="24" cy="8" r="1.3" fill={accent} /></>;
      break;
    case 'workbook':
      glyph = <><G {...common}><Rect x="8" y="5" width="17" height="22" rx="2" /><Path d="M12 5v22m3-17h6m-6 5h6m-6 5h4M6 9h4m-4 6h4m-4 6h4" /></G><Path {...accentCommon} d="m18 23 2 2 4-5" /></>;
      break;
    case 'spark':
    default:
      glyph = <><G {...common}><Circle cx="16" cy="16" r="10" strokeDasharray="1 3" /><Path d="m16 7 1.8 6.2L24 15l-6.2 1.8L16 23l-1.8-6.2L8 15l6.2-1.8z" /></G><Circle cx="25" cy="8" r="1.4" fill={accent} /></>;
      break;
  }

  return <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false}>{glyph}</Svg>;
}

export function BookezMysticIcon({ name, size = 36, tone, surface = 'parchment', shape = 'seal', animated = false, style }: Props) {
  const resolvedTone = tone ?? bookezMysticToneFor(name);
  const resolvedAccent = bookezMysticAccentFor(name);
  const [reduceMotion, setReduceMotion] = useState(false);
  const glint = useRef(new Animated.Value(0)).current;
  const enchantment = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => mounted && setReduceMotion(enabled));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, [animated]);

  useEffect(() => {
    if (!animated || reduceMotion) {
      glint.setValue(0);
      enchantment.setValue(0);
      return;
    }
    const glintLoop = Animated.loop(Animated.sequence([
      Animated.delay(550),
      Animated.timing(glint, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glint, { toValue: 0, duration: 1050, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(1450),
    ]));
    const enchantmentLoop = Animated.loop(Animated.sequence([
      Animated.timing(enchantment, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(enchantment, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    glintLoop.start();
    enchantmentLoop.start();
    return () => { glintLoop.stop(); enchantmentLoop.stop(); };
  }, [animated, enchantment, glint, reduceMotion]);

  const jewel = surface === 'jewel';
  const bare = surface === 'bare';
  const glyphColor = jewel ? bookezColors.textOnAccent : resolvedTone;
  const accent = resolvedAccent;
  const radius = shape === 'seal' ? size / 2 : size * 0.3;
  const glyphSize = Math.round(size * (bare ? 0.92 : 0.68));
  const glintScale = glint.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] });
  const enchantedScale = enchantment.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const enchantedLift = enchantment.interpolate({ inputRange: [0, 1], outputRange: [0, -0.7] });
  const enchantedTurn = enchantment.interpolate({ inputRange: [0, 1], outputRange: ['-0.45deg', '0.45deg'] });
  const auraOpacity = enchantment.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.82] });
  const auraScale = enchantment.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] });

  return <View style={[styles.icon, {
    width: size,
    height: size,
    borderRadius: radius,
    backgroundColor: bare ? 'transparent' : jewel ? resolvedTone : bookezColors.secondaryAccentSoft,
    borderColor: bare ? 'transparent' : jewel ? bookezWithAlpha('#D9BA79', 0.7) : bookezWithAlpha(resolvedTone, 0.42),
    borderWidth: bare ? 0 : 1,
  }, jewel && styles.jewelShadow, style]}>
    {jewel && <Animated.View pointerEvents="none" style={[styles.jewelAura, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35, backgroundColor: bookezWithAlpha(resolvedAccent, 0.14) }, animated && !reduceMotion && { opacity: auraOpacity, transform: [{ scale: auraScale }] }]} />}
    {!bare && <View pointerEvents="none" style={[styles.innerRing, { borderRadius: Math.max(2, radius - 3), borderColor: jewel ? bookezWithAlpha('#FFF8EE', 0.22) : bookezWithAlpha(resolvedTone, 0.15) }]} />}
    <Animated.View style={[styles.glyphMotion, animated && !reduceMotion && { transform: [{ translateY: enchantedLift }, { rotate: enchantedTurn }, { scale: enchantedScale }] }]}><MysticGlyph name={resolveGlyph(name)} size={glyphSize} color={glyphColor} accent={accent} /></Animated.View>
    {animated && !reduceMotion && <><Animated.View pointerEvents="none" style={[styles.mote, styles.moteOne, { backgroundColor: resolvedAccent, opacity: enchantment.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.62, 0.24] }), transform: [{ translateY: enchantment.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) }, { scale: enchantment.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }] }]} /><Animated.View pointerEvents="none" style={[styles.mote, styles.moteTwo, { backgroundColor: bookezColors.textOnAccent, opacity: enchantment.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.08, 0.38, 0.14] }), transform: [{ translateY: enchantment.interpolate({ inputRange: [0, 1], outputRange: [-1, 2] }) }] }]} /></>}
    {animated && !reduceMotion && <Animated.View pointerEvents="none" style={[styles.glint, { opacity: glint, transform: [{ scale: glintScale }, { rotate: '-8deg' }] }]}>
      <Svg width={Math.max(8, size * 0.24)} height={Math.max(8, size * 0.24)} viewBox="0 0 12 12" accessible={false}><Polygon points="6,0.5 7.4,4.6 11.5,6 7.4,7.4 6,11.5 4.6,7.4 0.5,6 4.6,4.6" fill={jewel ? '#FFF3D3' : accent} /></Svg>
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  jewelAura: { position: 'absolute' },
  innerRing: { position: 'absolute', top: 3, right: 3, bottom: 3, left: 3, borderWidth: 1 },
  glyphMotion: { alignItems: 'center', justifyContent: 'center' },
  jewelShadow: { shadowColor: '#342630', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  mote: { position: 'absolute', width: 2.5, height: 2.5, borderRadius: 2 },
  moteOne: { top: 5, left: 6 },
  moteTwo: { right: 6, bottom: 5, width: 1.5, height: 1.5 },
  glint: { position: 'absolute', top: -2, right: -2 },
});
