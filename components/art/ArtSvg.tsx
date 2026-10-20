import React, { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { ArtDrawing } from '@/theme/art/art';

interface Props {
  drawing: ArtDrawing;
  width: number;
  height: number;
  /** Turned a quarter left: a drawing facing right then faces up */
  turnUp?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ELEMENTS = { rect: Rect, circle: Circle, ellipse: Ellipse, path: Path, line: Line } as const;

/** Turned a quarter left inside a box of drawing.height × drawing.width: a drawing facing right then faces up */
const turnUpTransform = (drawing: ArtDrawing) => `rotate(-90) translate(-${drawing.width} 0)`;

/** The gradients and shapes of a drawing, in its own units; gradient ids are made unique with `prefix` */
function ArtContent({ drawing, prefix, turnUp }: { drawing: ArtDrawing; prefix: string; turnUp: boolean }) {
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
      <G transform={turnUp ? turnUpTransform(drawing) : undefined}>
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
export default function ArtSvg({ drawing, width, height, turnUp = false, style }: Props) {
  const prefix = usePrefix();
  return (
    <Svg
      width={width}
      height={height}
      viewBox={turnUp ? `0 0 ${drawing.height} ${drawing.width}` : `0 0 ${drawing.width} ${drawing.height}`}
      preserveAspectRatio="none"
      style={style}
    >
      <ArtContent drawing={drawing} prefix={prefix} turnUp={turnUp} />
    </Svg>
  );
}

/** The same drawing inside another Svg (an image drawn as one Svg, like the recap), stretched to the box x, y, width × height */
export function ArtGroup({ drawing, x, y, width, height, turnUp = false }: { drawing: ArtDrawing; x: number; y: number; width: number; height: number; turnUp?: boolean }) {
  const prefix = usePrefix();
  const units = turnUp ? { w: drawing.height, h: drawing.width } : { w: drawing.width, h: drawing.height };
  return (
    <G transform={`translate(${x} ${y}) scale(${width / units.w} ${height / units.h})`}>
      <ArtContent drawing={drawing} prefix={prefix} turnUp={turnUp} />
    </G>
  );
}
