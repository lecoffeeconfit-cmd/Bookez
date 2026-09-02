import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Image, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type BiomeId = 'meadow' | 'moonriver' | 'lake' | 'desert' | 'sunset';

type BiomeConfig = {
  id: BiomeId;
  base: string;
  accent: string;
};

const BIOME_ARTWORK = [
  require('../../assets/journey/journey-meadow.png'),
  require('../../assets/journey/journey-alpine.png'),
  require('../../assets/journey/journey-night-forest.png'),
  require('../../assets/journey/journey-canyon.png'),
  require('../../assets/journey/journey-sunset.png'),
] as const;

const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized;
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`;
};

const BIOMES: BiomeConfig[] = [
  {
    id: 'meadow',
    base: '#DDEEC7',
    accent: '#5F9F54',
  },
  {
    id: 'lake',
    base: '#BFE8EE',
    accent: '#4C8798',
  },
  {
    id: 'moonriver',
    base: '#445487',
    accent: '#8290C7',
  },
  {
    id: 'desert',
    base: '#EDB96F',
    accent: '#8E4D30',
  },
  {
    id: 'sunset',
    base: '#E88758',
    accent: '#173343',
  },
];

function ScenicLayer({ width, height }: { width: number; height: number }) {
  const sectionHeight = height / BIOME_ARTWORK.length;
  const transitionOverlap = Math.min(180, Math.max(110, sectionHeight * 0.16));

  // Keep each biome on one complete source image. Mixing separately generated
  // continuations into the same frame made their different crops visible as
  // hard horizontal seams.
  return <View pointerEvents="none" style={[styles.scenicLayer, { width, height }]}>
    {BIOME_ARTWORK.map((source, index) => {
      const biome = BIOMES[index];
      const isFirst = index === 0;
      const isLast = index === BIOME_ARTWORK.length - 1;
      const frameTop = index * sectionHeight - (isFirst ? 0 : transitionOverlap);
      const frameHeight = sectionHeight + (isFirst ? 0 : transitionOverlap) + (isLast ? 0 : transitionOverlap);
      const fadeHeight = Math.min(transitionOverlap, frameHeight * 0.24);
      const topFadeStop = isFirst ? 0 : fadeHeight / frameHeight;
      const bottomFadeStop = isLast ? 1 : 1 - fadeHeight / frameHeight;
      return <View key={biome.id} collapsable={false} style={[styles.biomeArtworkFrame, { width, height: frameHeight, top: frameTop }]}>
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={<LinearGradient
            colors={[isFirst ? '#000000' : 'transparent', '#000000', '#000000', isLast ? '#000000' : 'transparent'] as const}
            locations={[0, topFadeStop, bottomFadeStop, 1] as const}
            style={styles.artworkMask}
          />}
        >
          <Image
            source={source}
            resizeMode="cover"
            fadeDuration={0}
            accessibilityIgnoresInvertColors
            style={styles.maskedArtworkImage}
          />
        </MaskedView>
        <LinearGradient
          colors={[withAlpha(biome.base, 0.08), 'rgba(255,255,255,0.01)', withAlpha(biome.base, 0.08)] as const}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.scenicSideVignette}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.005)', 'rgba(222,242,247,0.04)', 'rgba(255,255,255,0.005)'] as const}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.pathReadabilityVeil}
        />
      </View>;
    })}
  </View>;
}

function Cloud({ compact = false, night = false }: { compact?: boolean; night?: boolean }) {
  return <View style={[styles.cloud, compact && styles.cloudCompact, night && styles.cloudNight]}>
    <View style={[styles.cloudPuff, compact && styles.cloudPuffCompact, night && styles.cloudPuffNight]} />
    <View style={[styles.cloudPuff, styles.cloudPuffSecond, compact && styles.cloudPuffSecondCompact, night && styles.cloudPuffNight]} />
  </View>;
}

type SparkleProps = { size?: number; color: string; style?: StyleProp<ViewStyle> };

function Sparkle({ size = 6, color, style }: SparkleProps) {
  const rayThickness = Math.max(1, Math.round(size / 5));
  const rayLength = Math.max(3, Math.round(size * 0.82));
  return <View pointerEvents="none" style={[styles.sparkle, { width: size, height: size }, style]}>
    <View style={[styles.sparkleRay, { width: rayThickness, height: rayLength, borderRadius: rayThickness / 2, backgroundColor: color }]} />
    <View style={[styles.sparkleRay, { width: rayLength, height: rayThickness, borderRadius: rayThickness / 2, backgroundColor: color }]} />
    <View style={[styles.sparkleCore, { width: rayThickness + 1, height: rayThickness + 1, borderRadius: (rayThickness + 1) / 2, backgroundColor: color }]} />
  </View>;
}

function LightDot({ size = 4, color, style }: SparkleProps) {
  return <View pointerEvents="none" style={[styles.lightDot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

function BiomeMotion({ biome, index, sectionHeight, width, phase, shimmer }: { biome: BiomeConfig; index: number; sectionHeight: number; width: number; phase: SharedValue<number>; shimmer: SharedValue<number> }) {
  const top = index * sectionHeight;
  const cloudFarStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(phase.value, [0, 1], [-22, 28]) }, { translateY: interpolate(shimmer.value, [0, 1], [-2, 3]) }] }));
  const cloudNearStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(phase.value, [0, 1], [18, -24]) }, { translateY: interpolate(shimmer.value, [0, 1], [2, -2]) }] }));
  const waterStyle = useAnimatedStyle(() => ({ opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.14, 0.48, 0.14]), transform: [{ translateX: interpolate(phase.value, [0, 1], [-10, 13]) }] }));
  const particleStyle = useAnimatedStyle(() => ({ opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.2, 0.72, 0.2]), transform: [{ translateX: interpolate(phase.value, [0, 1], [-8, 14]) }, { translateY: interpolate(phase.value, [0, 1], [8, -10]) }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.18, 0.36, 0.18]), transform: [{ scale: interpolate(shimmer.value, [0, 0.5, 1], [0.98, 1.03, 0.98]) }] }));

  if (biome.id === 'meadow') return <View style={[styles.motionSection, { top, height: sectionHeight, width }]}>
    <Animated.View style={[styles.cloudFar, cloudFarStyle]}><Cloud /></Animated.View>
    <Animated.View style={[styles.cloudNear, cloudNearStyle]}><Cloud compact /></Animated.View>
    <Animated.View style={[styles.pollenField, particleStyle]}><Sparkle size={7} color="#FFF0A0" style={styles.pollenSparkle} /><LightDot size={4} color="#F6EAA4" style={styles.pollenDot} /><Sparkle size={5} color="#FFF0A0" style={styles.pollenSparkleSecond} /></Animated.View>
  </View>;

  if (biome.id === 'moonriver') return <View style={[styles.motionSection, { top, height: sectionHeight, width }]}>
    <Animated.View style={[styles.moonGlow, glowStyle]} />
    <Animated.View style={[styles.cloudFar, styles.moonCloud, cloudFarStyle]}><Cloud compact /></Animated.View>
    <Animated.View style={[styles.riverGlint, waterStyle]}><LightDot size={4} color="#E2F6D6" style={styles.riverGlintOne} /><Sparkle size={6} color="#E2F6D6" style={styles.riverGlintTwo} /><LightDot size={3} color="#E2F6D6" style={styles.riverGlintThree} /></Animated.View>
    <Animated.View style={[styles.fireflyField, particleStyle]}><Sparkle size={6} color="#F8E5A5" style={styles.fireflySparkle} /><LightDot size={5} color="#E8F4BF" style={styles.fireflySecond} /></Animated.View>
  </View>;

  if (biome.id === 'lake') return <View style={[styles.motionSection, { top, height: sectionHeight, width }]}>
    <Animated.View style={[styles.cloudFar, cloudFarStyle]}><Cloud /></Animated.View>
    <Animated.View style={[styles.cloudNear, cloudNearStyle]}><Cloud compact /></Animated.View>
    <Animated.View style={[styles.waterHighlights, waterStyle]}><LightDot size={4} color="#E7FBFF" style={styles.waterHighlightOne} /><Sparkle size={6} color="#FFFFFF" style={styles.waterHighlightTwo} /><LightDot size={3} color="#E7FBFF" style={styles.waterHighlightThree} /></Animated.View>
  </View>;

  if (biome.id === 'desert') return <View style={[styles.motionSection, { top, height: sectionHeight, width }]}>
    <Animated.View style={[styles.dustField, particleStyle]}><View style={styles.dustLarge} /><View style={styles.dustSmall} /><View style={styles.dustTiny} /></Animated.View>
  </View>;

  return <View style={[styles.motionSection, { top, height: sectionHeight, width }]}>
    <Animated.View style={[styles.sunsetFireflies, particleStyle]}><Sparkle size={6} color="#FFE39A" style={styles.sunsetSparkleOne} /><LightDot size={5} color="#FFE39A" style={styles.sunsetSparkleSecond} /><Sparkle size={4} color="#FFE39A" style={styles.sunsetSparkleThird} /></Animated.View>
  </View>;
}

type JourneyEnvironmentProps = {
  width: number;
  height: number;
  progress: number;
  reduceMotion: boolean;
  scrollY?: SharedValue<number>;
  mapOffsetY: number;
  celebrating?: boolean;
};

export default function JourneyEnvironment({ width, height, progress, reduceMotion, scrollY, mapOffsetY, celebrating = false }: JourneyEnvironmentProps) {
  const { height: viewportHeight } = useWindowDimensions();
  const [activeBiome, setActiveBiome] = useState(0);
  const phase = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const celebration = useSharedValue(0);
  const sectionHeight = height / BIOMES.length;

  useAnimatedReaction(
    () => {
      if (!scrollY) return 0;
      const localCenter = Math.max(0, scrollY.value - mapOffsetY + viewportHeight * 0.48);
      return Math.max(0, Math.min(BIOMES.length - 1, Math.floor(localCenter / sectionHeight)));
    },
    (next, previous) => {
      if (next !== previous) runOnJS(setActiveBiome)(next);
    },
    [height, mapOffsetY, sectionHeight, viewportHeight],
  );

  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(shimmer);
    if (reduceMotion) {
      phase.value = 0.5;
      shimmer.value = 0.5;
      return undefined;
    }
    phase.value = 0;
    shimmer.value = 0;
    phase.value = withRepeat(withTiming(1, { duration: 12_000, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }), -1, true, undefined, ReduceMotion.System);
    shimmer.value = withRepeat(withTiming(1, { duration: 7_200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }), -1, true, undefined, ReduceMotion.System);
    return () => {
      cancelAnimation(phase);
      cancelAnimation(shimmer);
    };
  }, [phase, reduceMotion, shimmer]);

  useEffect(() => {
    celebration.value = withTiming(celebrating ? 1 : 0, { duration: celebrating ? 520 : 300, reduceMotion: ReduceMotion.System });
  }, [celebrating, celebration]);

  const atmosphereStyle = useAnimatedStyle(() => {
    const localCenter = scrollY ? scrollY.value - mapOffsetY + viewportHeight * 0.5 : 0;
    return { transform: [{ translateY: interpolate(localCenter, [0, height], [-22, 22], Extrapolation.CLAMP) }] };
  });
  const celebrationStyle = useAnimatedStyle(() => ({ opacity: interpolate(celebration.value, [0, 1], [0, 0.54], Extrapolation.CLAMP), transform: [{ scale: interpolate(celebration.value, [0, 1], [0.96, 1.06], Extrapolation.CLAMP) }] }));
  const nearbyBiomes = BIOMES.map((biome, index) => ({ biome, index })).filter(({ index }) => Math.abs(index - activeBiome) <= 1);

  return <View pointerEvents="none" accessible={false} style={[styles.environment, { width, height }]}>
    <ScenicLayer width={width} height={height} />
    {!reduceMotion && <Animated.View style={[styles.atmosphereLayer, { width, height }, atmosphereStyle]}>{nearbyBiomes.map(({ biome, index }) => <BiomeMotion key={biome.id} biome={biome} index={index} sectionHeight={sectionHeight} width={width} phase={phase} shimmer={shimmer} />)}</Animated.View>}
    <Animated.View style={[styles.celebrationGlow, { top: height * Math.max(0.05, Math.min(0.92, progress / 100)) - 36 }, celebrationStyle]} />
  </View>;
}

const styles = StyleSheet.create({
  environment: { position: 'absolute', top: 0, left: 0, backgroundColor: '#DDEEC7' },
  scenicLayer: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  biomeArtworkFrame: { position: 'absolute', left: 0, overflow: 'hidden' },
  artworkMask: { flex: 1 },
  maskedArtworkImage: { width: '100%', height: '100%' },
  scenicSideVignette: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pathReadabilityVeil: { position: 'absolute', top: 0, right: '28%', bottom: 0, left: '28%' },
  atmosphereLayer: { position: 'absolute', top: 0, left: 0 },
  motionSection: { position: 'absolute', left: 0, overflow: 'hidden' },
  cloudFar: { position: 'absolute', top: '9%', left: '5%' },
  cloudNear: { position: 'absolute', top: '21%', right: '6%' },
  cloud: { width: 108, height: 27, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.74)' },
  cloudCompact: { width: 76, height: 20, backgroundColor: 'rgba(255,255,255,0.64)' },
  cloudNight: { backgroundColor: 'rgba(189,202,247,0.38)' },
  cloudPuff: { position: 'absolute', left: 15, top: -11, width: 43, height: 33, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.78)' },
  cloudPuffCompact: { left: 10, top: -7, width: 31, height: 24 },
  cloudPuffSecond: { left: 54, top: -4, width: 34, height: 25, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)' },
  cloudPuffSecondCompact: { left: 39, top: -3, width: 25, height: 19 },
  cloudPuffNight: { backgroundColor: 'rgba(202,213,250,0.42)' },
  pollenField: { position: 'absolute', top: '43%', left: '12%', width: 80, height: 70 },
  pollenSparkle: { position: 'absolute', left: 5, top: 8 },
  pollenDot: { position: 'absolute', left: 37, top: 25 },
  pollenSparkleSecond: { position: 'absolute', left: 62, top: 39 },
  moonGlow: { position: 'absolute', top: '7%', left: '8%', width: 98, height: 98, borderRadius: 49, backgroundColor: 'rgba(197,225,172,0.42)' },
  moonCloud: { top: '20%', left: '3%' },
  riverGlint: { position: 'absolute', top: '59%', left: '28%', width: 146, height: 30 },
  riverGlintOne: { position: 'absolute', left: 26, top: 11 },
  riverGlintTwo: { position: 'absolute', left: 72, top: 4 },
  riverGlintThree: { position: 'absolute', left: 113, top: 18 },
  fireflyField: { position: 'absolute', top: '51%', right: '10%', width: 74, height: 90 },
  fireflySparkle: { position: 'absolute', left: 5, top: 8 },
  fireflySecond: { position: 'absolute', left: 45, top: 44 },
  waterHighlights: { position: 'absolute', top: '54%', left: '3%', width: 174, height: 98 },
  waterHighlightOne: { position: 'absolute', left: 20, top: 14 },
  waterHighlightTwo: { position: 'absolute', left: 76, top: 44 },
  waterHighlightThree: { position: 'absolute', left: 133, top: 76 },
  dustField: { position: 'absolute', top: '56%', left: '12%', width: 108, height: 74 },
  dustLarge: { position: 'absolute', left: 11, top: 24, width: 9, height: 9, borderRadius: 5, backgroundColor: '#F7D39D' },
  dustSmall: { position: 'absolute', left: 54, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#ECC184' },
  dustTiny: { position: 'absolute', left: 91, top: 50, width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFE0B1' },
  sunsetFireflies: { position: 'absolute', top: '56%', left: '10%', width: 128, height: 112 },
  sunsetSparkleOne: { position: 'absolute', left: 5, top: 8 },
  sunsetSparkleSecond: { position: 'absolute', left: 60, top: 29 },
  sunsetSparkleThird: { position: 'absolute', left: 106, top: 72 },
  sparkle: { alignItems: 'center', justifyContent: 'center' },
  sparkleRay: { position: 'absolute' },
  sparkleCore: { position: 'absolute' },
  lightDot: { position: 'absolute' },
  celebrationGlow: { position: 'absolute', left: '35%', width: '30%', height: 72, borderRadius: 36, backgroundColor: 'rgba(255,223,142,0.24)' },
});
