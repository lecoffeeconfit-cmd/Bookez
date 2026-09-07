import Svg, { Circle, G, Path } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

type ArtProps = {
  width?: number;
  height?: number;
  color?: string;
  accent?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

const artDefaults = {
  color: '#1A2B43',
  accent: '#AE7B3E',
  strokeWidth: 1.6,
};

export function BookezWritingDesk({ width = 160, height = 96, color = artDefaults.color, accent = artDefaults.accent, strokeWidth = artDefaults.strokeWidth, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 160 96" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 70h132M27 70v13m106-13v13M20 63h123l-5 7H25z" />
      <Path d="M39 57c5-7 12-11 21-13 10-2 20 0 29 6l-3 13H39z" fill={accent} fillOpacity={0.12} />
      <Path d="M45 57c5-5 12-8 19-9 8-1 16 1 23 5M51 52l-5 11m15-15-2 16m14-15 4 15" />
      <Path d="M108 48c8-6 16-7 24-3l4 18h-29z" />
      <Path d="M111 52h21m-20 6h21m-19 5h19" />
      <Path d="M32 63c1-7 5-13 11-17m-4 7 8-4m-11 10 10-4" stroke={accent} />
      <Path d="M118 39c7-8 13-13 23-17-5 10-11 16-20 20m-2-3 15-10" stroke={accent} />
      <Path d="M15 75c9 2 18 2 27 0m76 0c11 2 20 2 29 0" stroke={accent} strokeOpacity={0.7} />
    </G>
  </Svg>;
}

export function BookezOpenBook({ width = 154, height = 94, color = artDefaults.color, accent = artDefaults.accent, strokeWidth = artDefaults.strokeWidth, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 154 94" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M77 77C61 68 45 66 22 70V18c22-4 38-1 55 8zm0 0c16-9 32-11 55-7V18c-22-4-38-1-55 8z" fill={accent} fillOpacity={0.1} />
      <Path d="M77 27v50M28 28c15-2 29 0 42 6m-42 4c14-2 28 0 42 6m-42 4c14-2 28 0 42 6m78-26c-15-2-29 0-42 6m42 4c-14-2-28 0-42 6m42 4c-14-2-28 0-42 6" />
      <Path d="M24 21c17-3 34-1 49 6m-48 45c17-3 33 0 49 8m56-59c-17-3-34-1-49 6m48 45c-17-3-33 0-49 8" stroke={accent} strokeWidth={strokeWidth * 0.72} strokeOpacity={0.62} />
      <Path d="m33 53 10-8m-5 12 11-9m-6 13 12-10m47-1 10 8m-5-12 11 9m-6-13 12 10" strokeWidth={strokeWidth * 0.68} strokeOpacity={0.28} />
      <Path d="M25 70c19-4 35-1 52 8 17-9 33-12 52-8M22 18l-5-5m115 5 5-5" stroke={accent} />
      <Path d="M107 11c7-6 15-8 24-8-5 8-11 13-20 15m-4-7 18-5m-18 5 2 67" stroke={accent} />
      <Path d="m109 77-3 8 7-6" stroke={accent} />
    </G>
  </Svg>;
}

export function BookezQuill({ width = 72, height = 88, color = '#6C2940', accent = '#AE7B3E', strokeWidth = artDefaults.strokeWidth, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 72 88" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 70C28 55 36 36 48 7c10 9 12 22 5 35-8 14-21 22-36 28z" fill={accent} fillOpacity={0.13} />
      <Path d="M17 70C29 52 38 29 48 7m-31 63c13-8 25-20 33-34m-26 24 14-4m-9-5 15-5m-10-4 13-6m-7-2 11-7" />
      <Path d="M17 70 9 82m8-12 10 7m-10-7 15-1" />
      <Path d="M9 82c8-2 16-4 23-8" stroke={accent} />
    </G>
  </Svg>;
}

export function BookezManuscript({ width = 180, height = 48, color = '#1A2B43', accent = '#AE7B3E', strokeWidth = 1.2, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 180 48" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 11c13-3 20 2 31 0s18-3 29 0 18 3 29 0 18-3 29 0 18 3 38 0M7 37c13 3 20-2 31 0s18 3 29 0 18-3 29 0 18 3 29 0 18-3 38 0" stroke={accent} strokeOpacity={0.85} />
      <Path d="M21 17h55m-44 6h36m37-6h53m-42 6h33" strokeOpacity={0.35} />
      <Path d="M83 15c4 4 5 11 0 17-5-6-4-13 0-17z" fill={accent} fillOpacity={0.12} />
    </G>
  </Svg>;
}

export function BookezBookmark({ width = 30, height = 46, color = '#AE7B3E', style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 30 46" style={style} accessible={false}>
    <Path d="M4 2h22v40l-11-8L4 42z" fill={color} fillOpacity={0.88} stroke="#76552E" strokeWidth={1.2} strokeLinejoin="round" />
    <Path d="M8 5h14M8 9h14" stroke="#F8F1E5" strokeOpacity={0.45} strokeWidth={1} strokeLinecap="round" />
  </Svg>;
}

export function BookezAchievementSeal({ width = 60, height = 60, color = '#5F7F61', accent = '#AE7B3E', strokeWidth = 1.5, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 60 60" style={style} accessible={false}>
    <Circle cx="30" cy="30" r="25" fill={color} fillOpacity={0.1} stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="30" cy="30" r="20" fill="none" stroke={accent} strokeWidth={1} strokeDasharray="1 4" />
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 25c5-2 9-1 12 2 3-3 7-4 12-2v14c-5-2-9-1-12 2-3-3-7-4-12-2z" />
      <Path d="M30 27v14m-8-10c3 0 5 1 8 3m8-3c-3 0-5 1-8 3" />
      <Path d="m24 18 4 3 8-7" stroke={accent} />
    </G>
  </Svg>;
}

export function BookezJourneyMarker({ width = 56, height = 56, color = '#5F7F61', accent = '#AE7B3E', strokeWidth = 1.5, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 56 56" style={style} accessible={false}>
    <Circle cx="28" cy="28" r="23" fill={color} fillOpacity={0.1} stroke={color} strokeWidth={strokeWidth} />
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 36c6-8 10-13 17-16 5-2 8-5 9-9" />
      <Path d="M15 36c7 0 13-2 18-7 4-4 6-8 8-14" />
      <Path d="M17 22c3-3 6-4 10-3m-7 8c3-2 6-2 9-1" stroke={accent} />
      <Circle cx="41" cy="11" r="3" fill={accent} stroke="none" />
    </G>
  </Svg>;
}

export function BookezCommunityMark({ width = 76, height = 58, color = '#7466A8', accent = '#AE7B3E', strokeWidth = 1.5, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 76 58" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="25" cy="18" r="6" fill={color} fillOpacity={0.1} />
      <Circle cx="51" cy="18" r="6" fill={color} fillOpacity={0.1} />
      <Circle cx="38" cy="11" r="6" fill={accent} fillOpacity={0.12} stroke={accent} />
      <Path d="M12 42c1-9 7-14 13-14s12 5 13 14m12 0c1-9 7-14 13-14s12 5 13 14M24 42c1-11 6-17 14-17s13 6 14 17" />
      <Path d="M28 48h20M31 52h14" stroke={accent} />
    </G>
  </Svg>;
}

export function BookezPublishingBook({ width = 74, height = 64, color = '#6C2940', accent = '#AE7B3E', strokeWidth = 1.5, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 74 64" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 14c13-4 23-2 30 4v34c-8-5-18-6-30-2z" fill={color} fillOpacity={0.08} />
      <Path d="M63 14c-13-4-23-2-30 4v34c8-5 18-6 30-2z" fill={accent} fillOpacity={0.11} />
      <Path d="M37 18v34M17 22c8-2 14-1 17 2m-17 5c7-2 13-1 17 2m23-9c-8-2-14-1-17 2m17 5c-7-2-13-1-17 2" />
      <Circle cx="37" cy="9" r="5" stroke={accent} />
      <Path d="m34 9 2 2 4-4" stroke={accent} />
    </G>
  </Svg>;
}

export function BookezFlourish({ width = 180, height = 22, color = '#AE7B3E', style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 180 22" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={1.1} strokeLinecap="round">
      <Path d="M3 11h50c9 0 10-8 18-8 8 0 8 16 16 16s8-16 16-16c8 0 9 8 18 8h56" strokeOpacity={0.75} />
      <Path d="M74 11h32M84 7l-4 4 4 4m12-8 4 4-4 4" strokeOpacity={0.5} />
    </G>
  </Svg>;
}
