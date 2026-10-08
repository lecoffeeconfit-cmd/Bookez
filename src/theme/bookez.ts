import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Bookez visual language
 *
 * Keep product-wide decisions here. Screen-specific styling can still live
 * beside a screen, but new UI should start with these semantic tokens instead
 * of introducing another color, radius, or spacing vocabulary.
 */

const bookezPalette = {
  appBackground: '#F5EEE1',
  surfacePrimary: '#FAF6ED',
  surfaceSecondary: '#EAE1D4',
  surfaceRaised: '#F9F4EA',
  surfaceTint: '#EFE6D8',
  inkPrimary: '#13243D',
  inkSecondary: '#5E6877',
  inkMuted: '#89877F',
  burgundy: '#5B1830',
  burgundyDeep: '#461326',
  burgundySoft: '#F1E1E3',
  gold: '#A47A42',
  goldDark: '#9D743C',
  goldSoft: '#EFE4D0',
  borderWarm: '#DDCDB5',
  borderStrong: '#DDCDB5',
  divider: '#E8DECE',
  sage: '#667A60',
  sageSoft: '#E6ECDF',
  amethyst: '#8E83B5',
  amethystSoft: '#D6C9DE',
  dustyBlue: '#B8D0D4',
  dustyBlueSoft: '#B8D0D4',
  rose: '#9E575A',
  roseSoft: '#F2E0DE',
  shadowWarm: '#493F35',
  shadowDeep: '#493F35',
} as const;

export const bookezColors = {
  background: bookezPalette.appBackground,
  surface: bookezPalette.surfacePrimary,
  surfaceRaised: bookezPalette.surfaceRaised,
  surfaceMuted: bookezPalette.surfaceSecondary,
  surfaceAccent: '#F3E7E1',
  manuscript: bookezPalette.surfaceTint,
  manuscriptEdge: bookezPalette.borderStrong,
  textPrimary: bookezPalette.inkPrimary,
  textSecondary: bookezPalette.inkSecondary,
  textMuted: bookezPalette.inkMuted,
  textOnAccent: '#FFF8EE',
  border: bookezPalette.borderWarm,
  divider: bookezPalette.divider,
  accent: bookezPalette.burgundy,
  accentStrong: bookezPalette.burgundyDeep,
  accentSoft: bookezPalette.burgundySoft,
  secondaryAccent: bookezPalette.gold,
  secondaryAccentSoft: bookezPalette.goldSoft,
  success: bookezPalette.sage,
  successSoft: bookezPalette.sageSoft,
  warning: bookezPalette.goldDark,
  warningSoft: '#F0E5D1',
  destructive: bookezPalette.rose,
  destructiveSoft: bookezPalette.roseSoft,
  selection: '#E9DEC8',
  focusRing: '#8B6170',
  white: '#FFF8EE',
  black: '#000000',
  // Explicit names for new surfaces and future components.
  appBackground: bookezPalette.appBackground,
  surfacePrimary: bookezPalette.surfacePrimary,
  surfaceSecondary: bookezPalette.surfaceSecondary,
  surfaceTint: bookezPalette.surfaceTint,
  inkPrimary: bookezPalette.inkPrimary,
  inkSecondary: bookezPalette.inkSecondary,
  inkMuted: bookezPalette.inkMuted,
  burgundy: bookezPalette.burgundy,
  burgundyDeep: bookezPalette.burgundyDeep,
  burgundySoft: bookezPalette.burgundySoft,
  gold: bookezPalette.gold,
  goldDark: bookezPalette.goldDark,
  goldSoft: bookezPalette.goldSoft,
  borderWarm: bookezPalette.borderWarm,
  borderStrong: bookezPalette.borderStrong,
  sage: bookezPalette.sage,
  sageSoft: bookezPalette.sageSoft,
  amethyst: bookezPalette.amethyst,
  amethystSoft: bookezPalette.amethystSoft,
  dustyBlue: bookezPalette.dustyBlue,
  dustyBlueSoft: bookezPalette.dustyBlueSoft,
  rose: bookezPalette.rose,
  roseSoft: bookezPalette.roseSoft,
  shadowWarm: bookezPalette.shadowWarm,
  shadowDeep: bookezPalette.shadowDeep,
  // Semantic aliases for new surfaces. Keep screen code readable without
  // introducing a second palette vocabulary.
  surfaceElevated: bookezPalette.surfaceRaised,
  parchment: bookezPalette.surfaceTint,
  parchmentDark: bookezPalette.borderStrong,
  parchmentInk: bookezPalette.inkPrimary,
  rust: bookezPalette.goldSoft,
  goldMuted: bookezPalette.goldDark,
  forest: bookezPalette.sageSoft,
} as const;

/**
 * The existing app uses this compact palette throughout App.tsx. Keeping its
 * values centralized gives the current screens a safe migration path while
 * the editorial tokens above are adopted screen by screen.
 */
export const bookezLegacyColors = {
  ink: '#13243D',
  muted: '#68707B',
  periwinkle: '#8E83B5',
  sky: '#B8D0D4',
  lavender: '#D6C9DE',
  sage: '#A9B99C',
  peach: '#E8C2A7',
  coral: '#C7817E',
  gold: '#B18A53',
  paper: '#F5EEE1',
  white: '#FFF8EE',
} as const;

export const bookezSpacing = {
  hairline: 1,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  page: 20,
  section: 28,
} as const;

export const bookezRadii = {
  control: 12,
  card: 18,
  cardLarge: 24,
  pill: 999,
  sheet: 28,
  round: 999,
} as const;

const serifFamily = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
const sansFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const bookezFonts = {
  serif: serifFamily,
  sans: sansFamily,
} as const;

export const bookezType = {
  display: {
    fontFamily: serifFamily,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: bookezColors.textPrimary,
  } satisfies TextStyle,
  pageTitle: {
    fontFamily: serifFamily,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: bookezColors.textPrimary,
  } satisfies TextStyle,
  sectionTitle: {
    fontFamily: serifFamily,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '600',
    color: bookezColors.textPrimary,
  } satisfies TextStyle,
  cardTitle: {
    fontFamily: sansFamily,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: bookezColors.textPrimary,
  } satisfies TextStyle,
  body: {
    fontFamily: sansFamily,
    fontSize: 14,
    lineHeight: 21,
    color: bookezColors.textPrimary,
  } satisfies TextStyle,
  bodySecondary: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 19,
    color: bookezColors.textSecondary,
  } satisfies TextStyle,
  metadata: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: bookezColors.textMuted,
  } satisfies TextStyle,
  label: {
    fontFamily: sansFamily,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: bookezColors.textSecondary,
  } satisfies TextStyle,
  button: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.1,
  } satisfies TextStyle,
  caption: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 15,
    color: bookezColors.textMuted,
  } satisfies TextStyle,
  editorial: {
    fontFamily: serifFamily,
    fontSize: 17,
    lineHeight: 27,
    color: bookezColors.textPrimary,
  } satisfies TextStyle,
} as const;

export const bookezShadows = {
  subtle: {
    shadowColor: bookezPalette.shadowWarm,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  } satisfies ViewStyle,
  lifted: {
    shadowColor: bookezPalette.shadowWarm,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  } satisfies ViewStyle,
  feature: {
    shadowColor: bookezPalette.shadowWarm,
    shadowOpacity: 0.13,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  } satisfies ViewStyle,
  hero: {
    shadowColor: bookezPalette.shadowDeep,
    shadowOpacity: 0.16,
    shadowRadius: 19,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
  } satisfies ViewStyle,
  button: {
    shadowColor: bookezPalette.shadowWarm,
    shadowOpacity: 0.13,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } satisfies ViewStyle,
} as const;

export const bookezMotion = {
  fast: 150,
  standard: 240,
  gentle: 360,
  pressScale: 0.985,
  enterOffset: 8,
} as const;

export const bookezIcons = {
  arrowUpRight: '↗',
  bookmark: '▱',
  book: '▣',
  check: '✓',
  chevronDown: '⌄',
  chevronRight: '›',
  close: '×',
  clock: '◷',
  community: '♧',
  feather: '✎',
  focus: '◌',
  more: '•••',
  plus: '+',
  profile: '◉',
  search: '⌕',
  settings: '⚙',
  spark: '✦',
  stats: '▥',
  write: '✧',
} as const;

export type BookezIconName = keyof typeof bookezIcons;
export type BookezTone = 'default' | 'accent' | 'muted' | 'success' | 'warning' | 'destructive' | 'onAccent';

export const bookezToneColors: Record<BookezTone, string> = {
  default: bookezColors.textPrimary,
  accent: bookezColors.accent,
  muted: bookezColors.textMuted,
  success: bookezColors.success,
  warning: bookezColors.warning,
  destructive: bookezColors.destructive,
  onAccent: bookezColors.textOnAccent,
};

export const bookezWithAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized;
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`;
};

export const bookezPlaceholderCoverGradient = [
  bookezWithAlpha(bookezColors.accent, 0.99),
  bookezWithAlpha(bookezColors.textOnAccent, 0.58),
  bookezWithAlpha(bookezColors.textOnAccent, 0),
] as const;

export const bookezTheme = {
  colors: bookezColors,
  spacing: bookezSpacing,
  radii: bookezRadii,
  fonts: bookezFonts,
  type: bookezType,
  shadows: bookezShadows,
  motion: bookezMotion,
  icons: bookezIcons,
} as const;
