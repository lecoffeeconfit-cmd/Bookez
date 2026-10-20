import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { bookezColors as c, bookezShadows, bookezWithAlpha as alpha } from '../theme/bookez';

export const libraryBookCardStyles = StyleSheet.create({
  card: { marginBottom: 13, padding: 15, borderRadius: 16, overflow: 'hidden', backgroundColor: c.libraryCard, borderWidth: 1, borderColor: c.libraryCardBorder, ...bookezShadows.subtle, shadowOpacity: 0.07 },
  selected: { borderColor: alpha(c.accent, 0.3) },
  paperEdge: { position: 'absolute', left: 5, top: 12, bottom: 12, width: 2, borderRadius: 2, backgroundColor: alpha(c.secondaryAccent, 0.2) },
});

export default function LibraryBookCardSurface() {
  return <>
    <LinearGradient pointerEvents="none" colors={[c.surfacePrimary, c.libraryCard, c.libraryCardShade]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={libraryBookCardStyles.paperEdge} />
  </>;
}
