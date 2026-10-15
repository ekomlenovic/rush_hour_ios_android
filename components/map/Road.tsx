import React from 'react';
import { View } from 'react-native';
import type { UiColors } from '@/theme';
import { RoadSegment } from './path';

const ROAD_WIDTH = 26;
const EDGE = 3;

/** One straight bar along a segment, centered on it, extended by its thickness so the joints stay round */
function Bar({ segment, thickness, color, lengthRatio = 1, extend = true, zIndex }: {
  segment: RoadSegment;
  thickness: number;
  color: string;
  lengthRatio?: number;
  extend?: boolean;
  zIndex: number;
}) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const length = Math.sqrt(dx * dx + dy * dy) * lengthRatio + (extend ? thickness : 0);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (segment.x1 + segment.x2) / 2 - length / 2,
        top: (segment.y1 + segment.y2) / 2 - thickness / 2,
        width: length,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
        zIndex,
      }}
    />
  );
}

/**
 * Road of the world map (plain Views, no SVG): an asphalt band with a dashed center line,
 * the center line turning into a solid stripe of the primary color where the levels are beaten.
 */
const Road = React.memo(({ segments, maxUnlockedLevel, colors }: {
  segments: RoadSegment[];
  maxUnlockedLevel: number;
  colors: UiColors;
}) => (
  <>
    {segments.map(s => (
      <Bar key={`e${s.key}`} segment={s} thickness={ROAD_WIDTH + EDGE * 2} color={colors.mapRoadEdge} zIndex={1} />
    ))}
    {segments.map(s => (
      <Bar key={`a${s.key}`} segment={s} thickness={ROAD_WIDTH} color={colors.mapRoad} zIndex={2} />
    ))}
    {segments.map(s => {
      const driven = maxUnlockedLevel > s.fromId;
      return driven
        ? <Bar key={`l${s.key}`} segment={s} thickness={6} color={colors.primary} zIndex={3} />
        : <Bar key={`l${s.key}`} segment={s} thickness={3} color={colors.mapRoadDash} lengthRatio={0.45} extend={false} zIndex={3} />;
    })}
  </>
));

export default Road;
