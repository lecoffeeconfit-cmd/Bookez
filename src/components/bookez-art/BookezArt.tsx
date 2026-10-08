import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
import { bookezColors, bookezWithAlpha } from '../../theme/bookez';

type ArtProps = {
  width?: number;
  height?: number;
  color?: string;
  accent?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

const artDefaults = {
  color: '#667A60',
  accent: '#5B1830',
  strokeWidth: 1.6,
};

export function BookezWritingDesk({ width = 160, height = 96, color = artDefaults.color, accent = artDefaults.accent, strokeWidth = artDefaults.strokeWidth, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 160 96" style={style} accessible={false}>
    <Defs>
      <SvgLinearGradient id="bookezDeskPaper" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={bookezColors.surfaceRaised} />
        <Stop offset="0.64" stopColor={bookezColors.manuscript} />
        <Stop offset="1" stopColor={bookezColors.surfaceMuted} />
      </SvgLinearGradient>
    </Defs>
    <Ellipse cx="80" cy="83" rx="66" ry="5" fill={bookezWithAlpha(color, 0.09)} />
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 70h132M27 70v13m106-13v13M20 63h123l-5 7H25z" fill={bookezColors.surfaceMuted} />
      <Path d="M39 57c5-7 12-11 21-13 10-2 20 0 29 6l-3 13H39z" fill="url(#bookezDeskPaper)" />
      <Path d="M42 60c7-5 14-8 22-8 8 0 15 2 22 7l-1 4H41z" stroke={accent} strokeWidth={strokeWidth * 0.62} strokeOpacity={0.64} />
      <Path d="M45 57c5-5 12-8 19-9 8-1 16 1 23 5M51 52l-5 11m15-15-2 16m14-15 4 15" />
      <Path d="M108 48c8-6 16-7 24-3l4 18h-29z" fill="url(#bookezDeskPaper)" />
      <Path d="M111 52h21m-20 6h21m-19 5h19" />
      <Path d="M32 63c1-7 5-13 11-17m-4 7 8-4m-11 10 10-4" stroke={accent} />
      <Path d="M118 39c7-8 13-13 23-17-5 10-11 16-20 20m-2-3 15-10" stroke={accent} />
      <Path d="M92 53h10l2 10H90zM93 53c1-4 7-4 8 0" fill={accent} fillOpacity={0.16} />
      <Path d="M28 68c18 2 35 2 52 0m18 0c13 2 26 2 39 0" stroke={accent} strokeWidth={strokeWidth * 0.58} strokeDasharray="1 3" strokeOpacity={0.58} />
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

export function BookezPlanningFolio({ width = 154, height = 94, color = artDefaults.color, accent = artDefaults.accent, strokeWidth = artDefaults.strokeWidth, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 160 100" style={style} accessible={false}>
    <Defs>
      <SvgLinearGradient id="bookezPlanningPaper" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={bookezColors.surfaceRaised} />
        <Stop offset="0.58" stopColor={bookezColors.manuscript} />
        <Stop offset="1" stopColor={bookezColors.surfaceMuted} />
      </SvgLinearGradient>
      <SvgLinearGradient id="bookezPlanningHardware" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={bookezColors.secondaryAccentSoft} />
        <Stop offset="0.45" stopColor={accent} />
        <Stop offset="1" stopColor="#5B1830" />
      </SvgLinearGradient>
    </Defs>

    <Ellipse cx="81" cy="87" rx="62" ry="6" fill={bookezWithAlpha(color, 0.1)} />
    <Path d="M25 25 132 18l6 60-106 9z" fill={bookezColors.surfaceMuted} stroke={bookezColors.manuscriptEdge} strokeWidth={strokeWidth * 0.72} />
    <Path d="M20 29 127 14l7 59L28 88z" fill={bookezColors.manuscript} stroke={accent} strokeOpacity={0.62} strokeWidth={strokeWidth * 0.78} />
    <Path d="M79 28C63 20 44 19 20 26l4 53c20-6 39-3 55 7z" fill="url(#bookezPlanningPaper)" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M79 28c18-9 37-11 61-6l-4 54c-21-5-39-1-57 10z" fill="url(#bookezPlanningPaper)" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M79 28v58" fill="none" stroke={accent} strokeWidth={strokeWidth * 0.78} strokeOpacity={0.82} />
    <Path d="M75 30c2 17 2 36 0 52M83 29c-2 18-2 37 0 53" fill="none" stroke={bookezColors.manuscriptEdge} strokeWidth={strokeWidth * 0.58} strokeOpacity={0.74} />

    <G fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth * 0.72} strokeOpacity={0.72}>
      <Path d="M29 37c14-3 27-2 40 2M29 45c12-2 24-1 37 2M30 53c13-2 24-1 36 2M31 62c10-2 20-1 29 1" />
      <Path d="M90 36c14-4 27-5 40-2M90 44c13-3 25-4 38-2M90 52c12-3 23-3 34-1M90 61c14-4 26-4 36-2" />
    </G>
    <G fill="none" stroke={accent} strokeLinecap="round" strokeWidth={strokeWidth * 0.62} strokeOpacity={0.7}>
      <Path d="m32 69 9-7 7 3 11-7 9 3M91 69c8-5 16-6 23-4 6 2 11 1 16-2" />
      <Path d="M20 27c20-7 40-4 59 3M140 23c-22-5-42-2-61 7" strokeDasharray="1.2 3.2" />
    </G>

    <Path d="m20 26 10 1-9 9zM140 22l-10 2 9 8z" fill={bookezColors.secondaryAccentSoft} stroke={accent} strokeWidth={strokeWidth * 0.52} strokeOpacity={0.7} />
    <Path d="M82 8v21" stroke="#5B1830" strokeWidth={strokeWidth * 0.85} strokeLinecap="round" />
    <Ellipse cx="84" cy="10" rx="8" ry="4" fill={bookezWithAlpha(color, 0.14)} />
    <Ellipse cx="82" cy="8" rx="7" ry="4" fill="url(#bookezPlanningHardware)" stroke="#5B1830" strokeWidth={strokeWidth * 0.65} />
    <Circle cx="80" cy="6.8" r="1.25" fill={bookezColors.surfaceRaised} fillOpacity={0.72} />
  </Svg>;
}

export function BookezPlanningLeaf({ width = 70, height = 68, color = artDefaults.color, accent = artDefaults.accent, strokeWidth = artDefaults.strokeWidth, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 70 68" style={style} accessible={false}>
    <Path d="M3 6c24-6 44-5 64 2l-4 53c-23-5-42-2-59 4z" fill={bookezColors.surfaceRaised} stroke={color} strokeWidth={strokeWidth * 0.72} strokeLinejoin="round" />
    <Path d="M10 18c16-3 31-2 46 2M10 27c14-3 28-2 42 1M10 36c16-3 30-2 44 2M10 45c12-2 23-1 34 1" fill="none" stroke={color} strokeWidth={strokeWidth * 0.52} strokeLinecap="round" strokeOpacity={0.52} />
    <Path d="M4 7c20-6 41-5 62 2M12 55c13-3 27-2 41 1" fill="none" stroke={accent} strokeWidth={strokeWidth * 0.52} strokeLinecap="round" strokeDasharray="1 3" strokeOpacity={0.66} />
  </Svg>;
}

export function BookezManuscriptFolio({ width = 176, height = 106, color = '#FFF8EE', accent = '#5B1830', strokeWidth = artDefaults.strokeWidth, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 176 106" style={style} accessible={false}>
    <Defs>
      <SvgLinearGradient id="bookezManuscriptPaper" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#A47A42" />
        <Stop offset="0.58" stopColor="#5B1830" />
        <Stop offset="1" stopColor="#5B1830" />
      </SvgLinearGradient>
      <SvgLinearGradient id="bookezManuscriptPin" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#5B1830" />
        <Stop offset="0.5" stopColor={accent} />
        <Stop offset="1" stopColor="#5B1830" />
      </SvgLinearGradient>
      <SvgLinearGradient id="bookezManuscriptFeather" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFF8EE" />
        <Stop offset="0.56" stopColor="#A47A42" />
        <Stop offset="1" stopColor={accent} />
      </SvgLinearGradient>
    </Defs>

    <Ellipse cx="91" cy="94" rx="69" ry="7" fill="#667A60" fillOpacity={0.34} />
    <Path d="M29 34 139 26l7 59-110 8z" fill="#5B1830" stroke="#5B1830" strokeWidth={strokeWidth * 0.78} strokeLinejoin="round" />
    <Path d="m25 28 112 3-2 58-113-3z" fill="#5B1830" stroke="#5B1830" strokeWidth={strokeWidth * 0.82} strokeLinejoin="round" />
    <Path d="m34 23 108 8-7 57L27 80z" fill="#5B1830" stroke="#5B1830" strokeWidth={strokeWidth * 0.74} strokeLinejoin="round" />
    <Path d="M31 31c34-6 70-5 108 2l-4 53c-35-5-70-4-105 3z" fill="url(#bookezManuscriptPaper)" stroke="#5B1830" strokeWidth={strokeWidth} strokeLinejoin="round" />

    <G fill="none" stroke="#5B1830" strokeLinecap="round" strokeOpacity={0.54} strokeWidth={strokeWidth * 0.58}>
      <Path d="M39 46c27-3 56-2 87 1M38 55c29-3 59-2 89 1M37 64c21-2 45-2 70 0M37 73c31-3 60-2 89 1" />
      <Path d="M74 40v41M112 42v41" strokeOpacity={0.28} />
    </G>
    <Path d="M68 39c10-2 22-2 34 0" fill="none" stroke="#5B1830" strokeLinecap="round" strokeWidth={strokeWidth * 0.72} strokeOpacity={0.72} />
    <Path d="M42 52c8-3 15-2 22 1m-20 9c7-2 14-2 21 0m53-8c4-1 8-1 12 0m-14 9c5-1 10-1 15 0" fill="none" stroke="#5B1830" strokeLinecap="round" strokeWidth={strokeWidth * 0.74} strokeOpacity={0.68} />

    <Path d="M91 15v21" stroke="#5B1830" strokeWidth={strokeWidth * 0.95} strokeLinecap="round" />
    <Ellipse cx="94" cy="19" rx="9" ry="4.6" fill="#667A60" fillOpacity={0.3} />
    <Ellipse cx="91" cy="15" rx="8" ry="4.8" fill="url(#bookezManuscriptPin)" stroke="#5B1830" strokeWidth={strokeWidth * 0.72} />
    <Circle cx="89" cy="13.8" r="1.4" fill="#FFF8EE" fillOpacity={0.7} />

    <G fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M127 70c10-19 18-38 30-60 7 13 5 26-5 38-7 9-15 16-25 22z" fill="url(#bookezManuscriptFeather)" fillOpacity={0.92} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M127 70c11-20 20-42 30-60M132 61c9-7 16-14 22-23m-18 16 12-2m-8-5 13-4m-9-4 12-5m-8-3 10-6" stroke="#5B1830" strokeWidth={strokeWidth * 0.72} />
      <Path d="m127 70-9 19m9-19 8 8" stroke={accent} strokeWidth={strokeWidth * 0.9} />
    </G>
  </Svg>;
}

export function BookezQuill({ width = 72, height = 88, color = '#5B1830', accent = '#5B1830', strokeWidth = artDefaults.strokeWidth, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 72 88" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 70C28 55 36 36 48 7c10 9 12 22 5 35-8 14-21 22-36 28z" fill={accent} fillOpacity={0.13} />
      <Path d="M17 70C29 52 38 29 48 7m-31 63c13-8 25-20 33-34m-26 24 14-4m-9-5 15-5m-10-4 13-6m-7-2 11-7" />
      <Path d="M17 70 9 82m8-12 10 7m-10-7 15-1" />
      <Path d="M9 82c8-2 16-4 23-8" stroke={accent} />
    </G>
    <Path d="M48 14c3 10 1 20-4 30M42 27c-3 9-7 18-12 26" fill="none" stroke={accent} strokeWidth={strokeWidth * 0.78} strokeLinecap="round" strokeOpacity={0.74} />
    <Path d="m10 79-3 5 6-2" fill={accent} fillOpacity={0.75} stroke={color} strokeWidth={strokeWidth * 0.6} strokeLinejoin="round" />
    <Circle cx="30" cy="74" r="1.2" fill={accent} fillOpacity={0.72} />
  </Svg>;
}

export function BookezManuscript({ width = 180, height = 48, color = '#667A60', accent = '#5B1830', strokeWidth = 1.2, style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 180 48" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 11c13-3 20 2 31 0s18-3 29 0 18 3 29 0 18-3 29 0 18 3 38 0M7 37c13 3 20-2 31 0s18 3 29 0 18-3 29 0 18 3 29 0 18-3 38 0" stroke={accent} strokeOpacity={0.85} />
      <Path d="M21 17h55m-44 6h36m37-6h53m-42 6h33" strokeOpacity={0.35} />
      <Path d="M83 15c4 4 5 11 0 17-5-6-4-13 0-17z" fill={accent} fillOpacity={0.12} />
    </G>
  </Svg>;
}

export function BookezBookmark({ width = 30, height = 46, color = '#5B1830', style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 30 46" style={style} accessible={false}>
    <Path d="M4 2h22v40l-11-8L4 42z" fill={color} fillOpacity={0.88} stroke="#5B1830" strokeWidth={1.2} strokeLinejoin="round" />
    <Path d="M8 5h14M8 9h14" stroke="#FFF8EE" strokeOpacity={0.45} strokeWidth={1} strokeLinecap="round" />
  </Svg>;
}

export function BookezAchievementSeal({ width = 60, height = 60, color = '#667A60', accent = '#5B1830', strokeWidth = 1.5, style }: ArtProps) {
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

export function BookezJourneyMarker({ width = 56, height = 56, color = '#667A60', accent = '#5B1830', strokeWidth = 1.5, style }: ArtProps) {
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

export function BookezCommunityMark({ width = 76, height = 58, color = '#667A60', accent = '#5B1830', strokeWidth = 1.5, style }: ArtProps) {
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

export function BookezPublishingBook({ width = 74, height = 64, color = '#5B1830', accent = '#5B1830', strokeWidth = 1.5, style }: ArtProps) {
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

export function BookezFlourish({ width = 180, height = 22, color = '#5B1830', style }: ArtProps) {
  return <Svg width={width} height={height} viewBox="0 0 180 22" style={style} accessible={false}>
    <G fill="none" stroke={color} strokeWidth={1.1} strokeLinecap="round">
      <Path d="M3 11h50c9 0 10-8 18-8 8 0 8 16 16 16s8-16 16-16c8 0 9 8 18 8h56" strokeOpacity={0.75} />
      <Path d="M74 11h32M84 7l-4 4 4 4m12-8 4 4-4 4" strokeOpacity={0.5} />
    </G>
  </Svg>;
}
