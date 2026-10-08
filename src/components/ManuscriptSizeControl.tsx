import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bookezColors as c, bookezRadii } from '../theme/bookez';

export type ManuscriptSize = 'sentence' | 'half' | 'full';

export const manuscriptHeight = (size: ManuscriptSize): number | undefined =>
  size === 'sentence' ? 96 : size === 'half' ? 180 : undefined;

const sizeLabels: Record<ManuscriptSize, string> = {
  sentence: 'Sentence',
  half: 'Half page',
  full: 'Full page',
};

export default function ManuscriptSizeControl({ size, onChange }: { size: ManuscriptSize; onChange: (size: ManuscriptSize) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.wrap}>
    <Pressable onPress={() => setOpen((value) => !value)} hitSlop={6} style={styles.trigger} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Writing space size: ${sizeLabels[size]}`} accessibilityHint="Choose how much of the manuscript box is visible. Your writing stays unchanged.">
      <Text style={styles.icon}>↕</Text><Text style={styles.triggerText}>{sizeLabels[size]}</Text><Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
    {open && <View style={styles.options} accessibilityLabel="Writing space sizes">{(['sentence', 'half', 'full'] as ManuscriptSize[]).map((option) => <Pressable key={option} onPress={() => { onChange(option); setOpen(false); }} hitSlop={3} style={[styles.option, size === option && styles.selected]} accessibilityRole="button" accessibilityState={{ selected: size === option }} accessibilityLabel={`Show ${sizeLabels[option].toLowerCase()} writing space`}><Text style={[styles.optionText, size === option && styles.selectedText]}>{sizeLabels[option]}</Text></Pressable>)}</View>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', marginTop: 9 },
  trigger: { minHeight: 31, paddingHorizontal: 9, borderRadius: bookezRadii.control, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 5 },
  icon: { color: c.secondaryAccent, fontSize: 14, lineHeight: 17, fontWeight: '700' },
  triggerText: { color: c.textSecondary, fontSize: 9, fontWeight: '800' },
  chevron: { color: c.textMuted, fontSize: 12, lineHeight: 15 },
  options: { flexDirection: 'row', gap: 5, marginTop: 7 },
  option: { minHeight: 36, paddingHorizontal: 9, borderRadius: bookezRadii.control, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: 'center' },
  selected: { borderColor: c.accent, backgroundColor: c.accentSoft },
  optionText: { color: c.textSecondary, fontSize: 9, fontWeight: '700' },
  selectedText: { color: c.accent },
});
