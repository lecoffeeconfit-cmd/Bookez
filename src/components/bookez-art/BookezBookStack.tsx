import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { bookezColors } from '../../theme/bookez';

type VolumeProps = {
  x: number;
  y: number;
  width: number;
  thickness: number;
  cover: string;
  top: string;
  angle?: number;
  bookmark?: boolean;
};

function StackVolume({ x, y, width: w, thickness: h, cover, top, angle = 0, bookmark = false }: VolumeProps) {
  const { secondaryAccent: gold, surfaceRaised: paper, manuscriptEdge } = bookezColors;
  const ribbon = Math.round(w * 0.6);

  return <G transform={`translate(${x} ${y})`}>
    <G rotation={angle} origin={`${w / 2},${h}`} stroke={cover} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <Path d={`M0 0l10-6h${w}l-10 6Z`} fill={top} />
      <Path d={`M${w} 0l10-6v${h}l-10 6Z`} fill={cover} />
      <Path d={`M${w} 4l7-4v${h - 8}l-7 4Z`} fill={bookezColors.manuscript} strokeWidth={0.8} />
      <Path d={`M0 0h${w}v${h}H0C-9 ${h} -9 0 0 0Z`} fill={cover} />
      <Path d={`M7 4h${w - 7}v${h - 8}H7c-5 0-5 ${8 - h} 0 ${8 - h}Z`} fill={paper} strokeWidth={0.9} />
      <Path d={`M13 8h${w - 13}l7-4M15 ${h - 8}h${w - 15}l7-4`} fill="none" stroke={manuscriptEdge} strokeWidth={0.7} />
      <Path d={`M0 4v${h - 8}m-4 ${9 - h}v${h - 10}`} fill="none" stroke={gold} strokeWidth={0.8} />
      <Path d={`M7 ${h}h${w - 7}l10-6`} fill="none" strokeWidth={1.8} />
      {bookmark && <Path d={`M${ribbon} 4v${h + 4}l4-3 4 3V4Z`} fill={bookezColors.accent} stroke={bookezColors.accent} strokeWidth={0.8} />}
    </G>
  </G>;
}

/** Six clothbound volumes, offset slightly but sharing a consistent perspective. */
export function BookezBookStack({ width = 112, height = width * 160 / 112, style }: { width?: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const { secondaryAccent: gold, secondaryAccentSoft: goldSoft, sage, sageSoft, accent, accentSoft } = bookezColors;

  return <Svg width={width} height={height} viewBox="0 0 112 160" style={style} accessible={false} accessibilityElementsHidden>
    <Path d="M7 155c26 3 64 3 96-1" fill="none" stroke={gold} strokeWidth={1.1} strokeOpacity={0.2} strokeLinecap="round" />
    {/* Draw bottom to top; small overhangs and varied thickness keep the stack relaxed. */}
    <StackVolume x={11} y={130} width={84} thickness={21} cover={sage} top={sageSoft} />
    <StackVolume x={19} y={110} width={74} thickness={20} cover={accent} top={accentSoft} />
    <StackVolume x={10} y={91} width={81} thickness={19} cover={gold} top={goldSoft} />
    <StackVolume x={23} y={69} width={70} thickness={22} cover={bookezColors.textSecondary} top={bookezColors.dustyBlueSoft} />
    <StackVolume x={16} y={52} width={74} thickness={17} cover={sage} top={sageSoft} />
    <StackVolume x={26} y={31} width={62} thickness={21} cover={gold} top={goldSoft} angle={-3} bookmark />
  </Svg>;
}
