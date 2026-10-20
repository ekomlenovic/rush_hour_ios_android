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

/** A drawing of theme/art stretched to width × height */
export default function ArtSvg({ drawing, width, height, turnUp = false, style }: Props) {
  // Gradient ids are made unique: `url(#body)` of one drawing must not pick another's
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ref = (value: string | number) => (typeof value === 'string' ? value.replace(/url\(#(\w+)\)/, `url(#${prefix}-$1)`) : value);

  return (
    <Svg
      width={width}
      height={height}
      viewBox={turnUp ? `0 0 ${drawing.height} ${drawing.width}` : `0 0 ${drawing.width} ${drawing.height}`}
      preserveAspectRatio="none"
      style={style}
    >
      <Defs>
        {drawing.gradients.map(g => {
          const stops = g.stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />);
          return g.radial
            ? <RadialGradient key={g.id} id={`${prefix}-${g.id}`} cx="50%" cy="50%" r="50%">{stops}</RadialGradient>
            : <LinearGradient key={g.id} id={`${prefix}-${g.id}`} x1="0" y1="0" x2={g.horizontal ? '1' : '0'} y2={g.horizontal ? '0' : '1'}>{stops}</LinearGradient>;
        })}
      </Defs>
      <G transform={turnUp ? `rotate(-90) translate(-${drawing.width} 0)` : undefined}>
        {drawing.shapes.map((shape, i) => {
          const Element = ELEMENTS[shape.kind] as unknown as React.ComponentType<Record<string, string | number>>;
          return <Element key={i} {...Object.fromEntries(Object.entries(shape.attrs).map(([key, value]) => [key, ref(value)]))} />;
        })}
      </G>
    </Svg>
  );
}
