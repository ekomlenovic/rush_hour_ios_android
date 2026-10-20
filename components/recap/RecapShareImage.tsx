import React from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { recapImageColors } from '@/theme';

/** Size of the shared image: vertical, 9:16 like the stories */
export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1920;

/** Same colors in light and dark mode: the image leaves the app */
const IMAGE_COLORS = recapImageColors;

interface Props {
  svgRef: React.Ref<Svg>;
  /** Displayed size; the image itself is exported at SHARE_IMAGE_WIDTH × SHARE_IMAGE_HEIGHT */
  width: number;
  title: string;
  period: string;
  profile: string;
  highlights: { value: string; label: string }[];
  footer: string;
}

/**
 * The recap as a vertical image, drawn on the phone (no online service, like the QR codes):
 * the name of the game and the strong numbers. No emoji: they only go in the shared text
 */
export default function RecapShareImage({ svgRef, width, title, period, profile, highlights, footer }: Props) {
  const height = (width * SHARE_IMAGE_HEIGHT) / SHARE_IMAGE_WIDTH;
  const boxTop = 640;
  const boxHeight = 230;
  const boxGap = 30;
  return (
    <Svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${SHARE_IMAGE_WIDTH} ${SHARE_IMAGE_HEIGHT}`}>
      <Defs>
        <LinearGradient id="recapBackground" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={IMAGE_COLORS.top} />
          <Stop offset="1" stopColor={IMAGE_COLORS.bottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={SHARE_IMAGE_WIDTH} height={SHARE_IMAGE_HEIGHT} fill="url(#recapBackground)" />

      <SvgText x={540} y={190} fill={IMAGE_COLORS.accent} fontSize={60} fontWeight="bold" textAnchor="middle" letterSpacing={8}>
        RUSH HOURS
      </SvgText>
      <SvgText x={540} y={330} fill={IMAGE_COLORS.muted} fontSize={52} textAnchor="middle">{title}</SvgText>
      <SvgText x={540} y={440} fill={IMAGE_COLORS.text} fontSize={92} fontWeight="bold" textAnchor="middle">{period}</SvgText>
      <SvgText x={540} y={545} fill={IMAGE_COLORS.accent} fontSize={60} fontWeight="bold" textAnchor="middle">{profile}</SvgText>

      {highlights.map((item, i) => {
        const y = boxTop + i * (boxHeight + boxGap);
        return (
          <React.Fragment key={item.label}>
            <Rect x={100} y={y} width={880} height={boxHeight} rx={40} fill={IMAGE_COLORS.box} />
            <SvgText x={160} y={y + 122} fill={IMAGE_COLORS.text} fontSize={110} fontWeight="bold">{item.value}</SvgText>
            <SvgText x={160} y={y + 192} fill={IMAGE_COLORS.muted} fontSize={50}>{item.label}</SvgText>
          </React.Fragment>
        );
      })}

      <SvgText x={540} y={1840} fill={IMAGE_COLORS.muted} fontSize={34} textAnchor="middle">{footer}</SvgText>
    </Svg>
  );
}
