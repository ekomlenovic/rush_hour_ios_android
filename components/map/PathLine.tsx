import React from 'react';
import { View } from 'react-native';
import { PathPoint } from './path';

/** Segment of the map path between two level nodes (plain Views, no SVG) */
export default function PathLine({ from, to, color }: { from: PathPoint; to: PathPoint; color: string }) {
  // Calculate angle and distance for the line segment
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <View
      style={{
        position: 'absolute',
        left: from.x,
        top: from.y,
        width: distance,
        height: 8,
        backgroundColor: color,
        borderRadius: 4,
        transform: [
          { translateX: 0 },
          { translateY: -4 }, // Center the line
          { rotate: `${angle}deg` },
          { translateX: distance / 2 - distance / 2 }, // Reset origin (React Native transforms are from center by default)
        ],
        // Quick fix for transform origin in React Native
        transformOrigin: 'left',
        zIndex: 1,
      }}
    />
  );
}
