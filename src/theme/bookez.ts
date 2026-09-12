import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Bookez visual language
 *
 * Keep product-wide decisions here. Screen-specific styling can still live
 * beside a screen, but new UI should start with these semantic tokens instead
 * of introducing another color, radius, or spacing vocabulary.
 */

export const bookezColors = {
  background: '#0B1411',
  surface: '#17211E',
  surfaceRaised: '#1E2018',
  surfaceMuted: '#242117',
  surfaceAccent: '#302225',
  manuscript: '#B4A27B',
  manuscriptEdge: '#8C6429',
  textPrimary: '#F1DDA7',
  textSecondary: '#C8B995',
  textMuted: '#9E9273',
  textOnAccent: '#F7E8BC',
  border: '#8C6429',
  divider: '#493B27',
  accent: '#641B36',
  accentStrong: '#461326',
  accentSoft: '#38262D',
  secondaryAccent: '#BD8737',
  secondaryAccentSoft: '#3A3020',
  success: '#6A8A63',
  successSoft: '#27352B',
  warning: '#B7833A',
  warningSoft: '#3A301F',
  destructive: '#B06A62',
  destructiveSoft: '#382421',
  selection: '#4A3A22',
  focusRing: '#A87931',
  white: '#F1DDA7',
  black: '#000000',
  // Semantic aliases for new surfaces. Keep screen code readable without
  // introducing a second palette vocabulary.
  surfaceElevated: '#242117',
  parchment: '#B4A27B',
  parchmentDark: '#8F7B54',
  parchmentInk: '#432F1B',
  rust: '#55352B',
  goldMuted: '#A87931',
  burgundy: '#641B36',
  forest: '#284942',
} as const;

/**
 * The existing app uses this compact palette throughout App.tsx. Keeping its
 * values centralized gives the current screens a safe migration path while
 * the editorial tokens above are adopted screen by screen.
 */
export const bookezLegacyColors = {
  ink: '#F1DDA7',
  muted: '#9E9273',
  periwinkle: '#8976AF',
  sky: '#6E9F9B',
  lavender: '#6B5B85',
  sage: '#718461',
  peach: '#A27456',
  coral: '#B06A62',
  gold: '#BD8737',
  paper: '#0B1411',
  white: '#F1DDA7',
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
    shadowColor: '#493F35',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  } satisfies ViewStyle,
  lifted: {
    shadowColor: '#493F35',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
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
