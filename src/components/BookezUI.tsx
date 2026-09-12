import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bookezColors, bookezFonts, bookezIcons, bookezMotion, bookezRadii, bookezShadows, bookezSpacing, bookezToneColors, bookezType, bookezWithAlpha, type BookezIconName, type BookezTone } from '../theme/bookez';

export function useBookezReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

type BookezInkRevealProps = {
  children: ReactNode;
  triggerKey?: string | number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export function BookezInkReveal({ children, triggerKey, delay = 30, style }: BookezInkRevealProps) {
  const reduceMotion = useBookezReduceMotion();
  const reveal = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const settle = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    reveal.stopAnimation();
    settle.stopAnimation();
    if (reduceMotion) {
      reveal.setValue(1);
      settle.setValue(1);
      return;
    }
    reveal.setValue(0);
    settle.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(reveal, {
        toValue: 1,
        delay,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.spring(settle, {
        toValue: 1,
        delay,
        speed: 14,
        bounciness: 3,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, reduceMotion, reveal, settle, triggerKey]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: reveal,
          transform: [
            { perspective: 900 },
            { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) },
            { rotateX: settle.interpolate({ inputRange: [0, 1], outputRange: ['1.2deg', '0deg'] }) },
            { scale: settle.interpolate({ inputRange: [0, 0.76, 1], outputRange: [0.989, 1.003, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

type PressScaleProps = {
  children: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
} & Pick<PressableProps, 'accessibilityLabel' | 'accessibilityRole' | 'accessibilityState' | 'hitSlop' | 'onLongPress' | 'onPress' | 'testID'>;

export function BookezPressable({ children, disabled, style, ...pressableProps }: PressScaleProps) {
  const reduceMotion = useBookezReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = (toValue: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue,
      duration: bookezMotion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      {...pressableProps}
      disabled={disabled}
      onPressIn={() => animateScale(bookezMotion.pressScale)}
      onPressOut={() => animateScale(1)}
      style={[style, disabled && styles.disabled]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

type BookezIconProps = {
  name: BookezIconName;
  size?: number;
  tone?: BookezTone;
  color?: string;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
};

export function BookezIcon({ name, size = 18, tone = 'default', color, accessibilityLabel, style }: BookezIconProps) {
  return (
    <Text
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[styles.icon, { color: color ?? bookezToneColors[tone], fontSize: size, lineHeight: size + 3 }, style]}
    >
      {bookezIcons[name]}
    </Text>
  );
}

export type BookezButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';

type BookezButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: BookezButtonVariant;
  icon?: BookezIconName;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function BookezButton({ label, onPress, variant = 'primary', icon, disabled, compact, fullWidth, accessibilityLabel, style }: BookezButtonProps) {
  const reduceMotion = useBookezReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const colors = buttonColors[variant];

  const animateScale = (toValue: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, { toValue, duration: bookezMotion.fast, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animateScale(bookezMotion.pressScale)}
      onPressOut={() => animateScale(1)}
      style={[styles.button, compact && styles.buttonCompact, fullWidth && styles.buttonFullWidth, { backgroundColor: colors.background, borderColor: colors.border }, disabled && styles.disabled, style]}
    >
      <Animated.View style={[styles.buttonContent, { transform: [{ scale }] }]}>
        {icon ? <BookezIcon name={icon} size={compact ? 15 : 17} color={colors.text} /> : null}
        <Text style={[bookezType.button, styles.buttonText, { color: colors.text }, icon && styles.buttonTextWithIcon]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const buttonColors: Record<BookezButtonVariant, { background: string; border: string; text: string }> = {
  primary: { background: bookezColors.accent, border: bookezColors.accent, text: bookezColors.textOnAccent },
  secondary: { background: bookezColors.surfaceRaised, border: bookezColors.border, text: bookezColors.textPrimary },
  quiet: { background: 'transparent', border: 'transparent', text: bookezColors.accent },
  destructive: { background: bookezColors.destructiveSoft, border: bookezColors.destructiveSoft, text: bookezColors.destructive },
};

type BookezIconButtonProps = {
  icon: BookezIconName;
  label: string;
  onPress?: () => void;
  tone?: BookezTone;
  variant?: 'ghost' | 'outline' | 'solid';
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BookezIconButton({ icon, label, onPress, tone = 'default', variant = 'ghost', size = 42, disabled, style }: BookezIconButtonProps) {
  const backgroundColor = variant === 'solid' ? bookezColors.accent : variant === 'outline' ? bookezColors.surfaceRaised : bookezWithAlpha(bookezColors.surfaceRaised, 0.66);
  const borderColor = variant === 'ghost' ? 'transparent' : variant === 'solid' ? bookezColors.accent : bookezColors.border;
  return (
    <BookezPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, { width: size, height: size, borderRadius: Math.min(size / 2, bookezRadii.control), backgroundColor, borderColor }, disabled && styles.disabled, style]}
    >
      <BookezIcon name={icon} size={Math.round(size * 0.43)} tone={variant === 'solid' ? 'onAccent' : tone} />
    </BookezPressable>
  );
}

type BookezCardProps = {
  children: ReactNode;
  tone?: 'default' | 'subtle' | 'manuscript' | 'accent' | 'success';
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BookezCard({ children, tone = 'default', elevated = true, style }: BookezCardProps) {
  return <View style={[styles.card, cardTones[tone], elevated && bookezShadows.subtle, style]}>{children}</View>;
}

const cardTones: Record<NonNullable<BookezCardProps['tone']>, ViewStyle> = {
  default: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  subtle: { backgroundColor: bookezColors.surfaceMuted, borderColor: bookezColors.divider },
  manuscript: { backgroundColor: bookezColors.manuscript, borderColor: bookezColors.manuscriptEdge },
  accent: { backgroundColor: bookezColors.accentSoft, borderColor: '#E5C9D0' },
  success: { backgroundColor: bookezColors.successSoft, borderColor: '#C8DEC6' },
};

type BookezSectionHeaderProps = {
  title: string;
  eyebrow?: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BookezSectionHeader({ title, eyebrow, detail, actionLabel, onAction, style }: BookezSectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionHeaderCopy}>
        {eyebrow ? <Text style={bookezType.label}>{eyebrow}</Text> : null}
        <Text style={bookezType.sectionTitle}>{title}</Text>
        {detail ? <Text style={[bookezType.bodySecondary, styles.sectionDetail]}>{detail}</Text> : null}
      </View>
      {actionLabel ? <BookezButton label={actionLabel} variant="quiet" compact onPress={onAction} /> : null}
    </View>
  );
}

type BookezFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function BookezField({ label, hint, error, containerStyle, style, ...inputProps }: BookezFieldProps) {
  return (
    <View style={containerStyle}>
      {label ? <Text style={bookezType.label}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        placeholderTextColor={inputProps.placeholderTextColor ?? bookezColors.textMuted}
        style={[styles.field, error && styles.fieldError, style]}
      />
      {error ? <Text style={[bookezType.caption, styles.errorText]}>{error}</Text> : hint ? <Text style={[bookezType.caption, styles.fieldHint]}>{hint}</Text> : null}
    </View>
  );
}

type BookezSegmentedOption<Value extends string> = { label: string; value: Value };

type BookezSegmentedControlProps<Value extends string> = {
  options: readonly BookezSegmentedOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function BookezSegmentedControl<Value extends string>({ options, value, onChange, accessibilityLabel, style }: BookezSegmentedControlProps<Value>) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.segmented, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segmentedOption, selected && styles.segmentedOptionSelected]}
          >
            <Text style={[bookezType.button, styles.segmentedText, selected && styles.segmentedTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type BookezChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'accent' | 'neutral' | 'success';
  style?: StyleProp<ViewStyle>;
};

export function BookezChip({ label, selected, onPress, tone = 'accent', style }: BookezChipProps) {
  const toneStyle = chipTones[tone];
  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { selected } : undefined} style={[styles.chip, toneStyle.container, selected && styles.chipSelected, style]}>
      <Text style={[bookezType.metadata, toneStyle.text, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const chipTones = {
  accent: { container: { backgroundColor: bookezColors.accentSoft, borderColor: '#E5C9D0' }, text: { color: bookezColors.accent } },
  neutral: { container: { backgroundColor: bookezColors.surfaceMuted, borderColor: bookezColors.border }, text: { color: bookezColors.textSecondary } },
  success: { container: { backgroundColor: bookezColors.successSoft, borderColor: '#C8DEC6' }, text: { color: bookezColors.success } },
} satisfies Record<string, { container: ViewStyle; text: TextStyle }>;

type BookezToolbarControlProps = Omit<BookezIconButtonProps, 'variant'> & { active?: boolean };

export function BookezToolbarControl({ active, ...props }: BookezToolbarControlProps) {
  return <BookezIconButton {...props} variant={active ? 'solid' : 'outline'} size={38} />;
}

type BookezSheetSurfaceProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  onClose?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BookezSheetSurface({ children, title, description, onClose, style }: BookezSheetSurfaceProps) {
  return (
    <View style={[styles.sheet, style]}>
      <View style={styles.sheetHandle} />
      {(title || description || onClose) && (
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderCopy}>
            {title ? <Text style={bookezType.pageTitle}>{title}</Text> : null}
            {description ? <Text style={[bookezType.bodySecondary, styles.sheetDescription]}>{description}</Text> : null}
          </View>
          {onClose ? <BookezIconButton icon="close" label="Close" onPress={onClose} /> : null}
        </View>
      )}
      {children}
    </View>
  );
}

type BookezEmptyStateProps = {
  icon?: BookezIconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function BookezEmptyState({ icon = 'book', title, body, actionLabel, onAction, style }: BookezEmptyStateProps) {
  return (
    <View style={[styles.emptyState, style]}>
      <View style={styles.emptyIcon}><BookezIcon name={icon} tone="accent" size={24} /></View>
      <Text style={bookezType.cardTitle}>{title}</Text>
      <Text style={[bookezType.bodySecondary, styles.emptyBody]}>{body}</Text>
      {actionLabel ? <BookezButton label={actionLabel} compact onPress={onAction} /> : null}
    </View>
  );
}

type BookezStatTileProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: 'default' | 'accent' | 'success' | 'warm';
  style?: StyleProp<ViewStyle>;
};

export function BookezStatTile({ label, value, detail, tone = 'default', style }: BookezStatTileProps) {
  return (
    <View style={[styles.statTile, statTones[tone], style]}>
      <Text style={bookezType.label}>{label}</Text>
      <Text style={[bookezType.sectionTitle, styles.statValue]}>{value}</Text>
      {detail ? <Text style={[bookezType.caption, styles.statDetail]}>{detail}</Text> : null}
    </View>
  );
}

const statTones: Record<NonNullable<BookezStatTileProps['tone']>, ViewStyle> = {
  default: { backgroundColor: bookezColors.surfaceRaised, borderColor: bookezColors.border },
  accent: { backgroundColor: bookezColors.accentSoft, borderColor: '#E5C9D0' },
  success: { backgroundColor: bookezColors.successSoft, borderColor: '#C8DEC6' },
  warm: { backgroundColor: bookezColors.secondaryAccentSoft, borderColor: '#E8D8B6' },
};

type BookezProgressBarProps = {
  progress: number;
  tone?: 'accent' | 'success' | 'warm';
  height?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function BookezProgressBar({ progress, tone = 'accent', height = 8, accessibilityLabel, style }: BookezProgressBarProps) {
  const reduceMotion = useBookezReduceMotion();
  const animatedProgress = useRef(new Animated.Value(Math.max(0, Math.min(1, progress)))).current;
  const nextProgress = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    if (reduceMotion) {
      animatedProgress.setValue(nextProgress);
      return;
    }
    Animated.timing(animatedProgress, { toValue: nextProgress, duration: bookezMotion.gentle, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [animatedProgress, nextProgress, reduceMotion]);

  const width = animatedProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 1, now: nextProgress }} style={[styles.progressTrack, { height }, style]}>
      <Animated.View style={[styles.progressFill, progressTones[tone], { width, height }]} />
    </View>
  );
}

const progressTones: Record<NonNullable<BookezProgressBarProps['tone']>, ViewStyle> = {
  accent: { backgroundColor: bookezColors.accent },
  success: { backgroundColor: bookezColors.success },
  warm: { backgroundColor: bookezColors.secondaryAccent },
};

const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  icon: { fontWeight: '700', textAlign: 'center' },
  button: { minHeight: 46, paddingHorizontal: bookezSpacing.md, borderRadius: bookezRadii.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonCompact: { minHeight: 36, paddingHorizontal: bookezSpacing.sm, borderRadius: 10 },
  buttonFullWidth: { alignSelf: 'stretch' },
  buttonContent: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonText: { textAlign: 'center' },
  buttonTextWithIcon: { marginLeft: bookezSpacing.xs },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  card: { padding: bookezSpacing.md, borderRadius: bookezRadii.card, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  sectionDetail: { marginTop: bookezSpacing.xxs },
  field: { minHeight: 48, marginTop: bookezSpacing.xs, paddingHorizontal: bookezSpacing.sm, paddingVertical: bookezSpacing.xs, borderRadius: bookezRadii.control, borderWidth: 1, borderColor: bookezColors.border, backgroundColor: bookezColors.surfaceRaised, color: bookezColors.textPrimary, fontFamily: bookezFonts.sans, fontSize: 14 },
  fieldError: { borderColor: bookezColors.destructive },
  fieldHint: { marginTop: bookezSpacing.xxs },
  errorText: { marginTop: bookezSpacing.xxs, color: bookezColors.destructive },
  segmented: { minHeight: 44, padding: 3, borderRadius: bookezRadii.control + 2, backgroundColor: bookezColors.surfaceMuted, borderWidth: 1, borderColor: bookezColors.divider, flexDirection: 'row' },
  segmentedOption: { flex: 1, minHeight: 36, paddingHorizontal: bookezSpacing.xs, borderRadius: bookezRadii.control - 2, alignItems: 'center', justifyContent: 'center' },
  segmentedOptionSelected: { backgroundColor: bookezColors.surfaceRaised, ...bookezShadows.subtle },
  segmentedText: { color: bookezColors.textSecondary, textAlign: 'center' },
  segmentedTextSelected: { color: bookezColors.textPrimary },
  chip: { minHeight: 30, paddingHorizontal: bookezSpacing.sm, borderRadius: bookezRadii.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: bookezColors.accent, borderColor: bookezColors.accent },
  chipTextSelected: { color: bookezColors.textOnAccent },
  sheet: { padding: bookezSpacing.xl, paddingBottom: bookezSpacing.xxl, borderTopLeftRadius: bookezRadii.sheet, borderTopRightRadius: bookezRadii.sheet, backgroundColor: bookezColors.surface, ...bookezShadows.lifted },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, marginBottom: bookezSpacing.lg, borderRadius: 2, backgroundColor: bookezColors.manuscriptEdge },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetHeaderCopy: { flex: 1, minWidth: 0, paddingRight: bookezSpacing.sm },
  sheetDescription: { marginTop: bookezSpacing.xs },
  emptyState: { padding: bookezSpacing.xl, borderRadius: bookezRadii.card, alignItems: 'center', backgroundColor: bookezColors.surface, borderWidth: 1, borderColor: bookezColors.border },
  emptyIcon: { width: 54, height: 54, marginBottom: bookezSpacing.sm, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: bookezColors.accentSoft },
  emptyBody: { maxWidth: 290, marginTop: bookezSpacing.xs, marginBottom: bookezSpacing.md, textAlign: 'center' },
  statTile: { flex: 1, minWidth: 132, padding: bookezSpacing.sm, borderRadius: bookezRadii.control + 2, borderWidth: 1 },
  statValue: { marginTop: bookezSpacing.xxs },
  statDetail: { marginTop: bookezSpacing.xxs },
  progressTrack: { overflow: 'hidden', borderRadius: bookezRadii.pill, backgroundColor: bookezColors.surfaceMuted },
  progressFill: { minWidth: 2, borderRadius: bookezRadii.pill },
});
