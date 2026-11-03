import React, { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { facingTransform, isUpright, type ArtDrawing, type Facing } from '@/theme/art/art';

interface Props {
  drawing: ArtDrawing;
  width: number;
  height: number;
  /** Where the front of a drawing facing right points: turned or mirrored to face that way (right: as drawn) */
  facing?: Facing;
  style?: StyleProp<ViewStyle>;
}

const ELEMENTS = { rect: Rect, circle: Circle, ellipse: Ellipse, path: Path, line: Line } as const;

/** The gradients and shapes of a drawing, in its own units; gradient ids are made unique with `prefix` */
function ArtContent({ drawing, prefix, facing }: { drawing: ArtDrawing; prefix: string; facing: Facing }) {
  // `url(#body)` of one drawing must not pick another's
  const ref = (value: string | number) => (typeof value === 'string' ? value.replace(/url\(#(\w+)\)/, `url(#${prefix}-$1)`) : value);
  return (
    <>
      <Defs>
        {drawing.gradients.map(g => {
          const stops = g.stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />);
          return g.radial
            ? <RadialGradient key={g.id} id={`${prefix}-${g.id}`} cx="50%" cy="50%" r="50%">{stops}</RadialGradient>
            : <LinearGradient key={g.id} id={`${prefix}-${g.id}`} x1="0" y1="0" x2={g.horizontal ? '1' : '0'} y2={g.horizontal ? '0' : '1'}>{stops}</LinearGradient>;
        })}
      </Defs>
      <G transform={facingTransform(drawing, facing)}>
        {drawing.shapes.map((shape, i) => {
          const Element = ELEMENTS[shape.kind] as unknown as React.ComponentType<Record<string, string | number>>;
          return <Element key={i} {...Object.fromEntries(Object.entries(shape.attrs).map(([key, value]) => [key, ref(value)]))} />;
        })}
      </G>
    </>
  );
}

const usePrefix = () => useId().replace(/[^a-zA-Z0-9]/g, '');

/** A drawing of theme/art stretched to width × height */
export default function ArtSvg({ drawing, width, height, facing = 'right', style }: Props) {
  const prefix = usePrefix();
  return (
    <Svg
      width={width}
      height={height}
      viewBox={isUpright(facing) ? `0 0 ${drawing.height} ${drawing.width}` : `0 0 ${drawing.width} ${drawing.height}`}
      preserveAspectRatio="none"
      style={style}
    >
      <ArtContent drawing={drawing} prefix={prefix} facing={facing} />
    </Svg>
  );
}

/** The same drawing inside another Svg (an image drawn as one Svg, like the recap), stretched to the box x, y, width × height */
export function ArtGroup({ drawing, x, y, width, height, facing = 'right' }: { drawing: ArtDrawing; x: number; y: number; width: number; height: number; facing?: Facing }) {
  const prefix = usePrefix();
  const units = isUpright(facing) ? { w: drawing.height, h: drawing.width } : { w: drawing.width, h: drawing.height };
  return (
    <G transform={`translate(${x} ${y}) scale(${width / units.w} ${height / units.h})`}>
      <ArtContent drawing={drawing} prefix={prefix} facing={facing} />
    </G>
  );
}
