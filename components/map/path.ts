export interface PathPoint {
  id: number;
  x: number;
  y: number;
}

// Candy crush style path generator (Bottom to Top)
export const generatePathPoints = (count: number, width: number, screenHeight: number) => {
  const points: PathPoint[] = [];
  const amplitude = width * 0.25;
  const centerX = width / 2;
  const nodeSpacing = 130;

  // Calculate a total height that guarantees the content can be scrolled if needed,
  // or at least fills the screen so the bottom-most level is near the bottom edge.
  const contentHeight = count * nodeSpacing + 150;
  const totalHeight = Math.max(screenHeight * 1.1, contentHeight);

  // Level 0 (Tutorial) - Positioned to the left of Level 1
  points.push({
    id: 0,
    x: centerX - 80, // Left of center
    y: totalHeight - 150,
  });

  for (let i = 0; i < count; i++) {
    // i=0 is level 1. It goes at the BOTTOM.
    const xOffset = Math.sin(i * 1.5) * amplitude;
    points.push({
      id: i + 1,
      x: centerX + xOffset,
      y: totalHeight - 150 - (i * nodeSpacing),
    });
  }
  return { points, totalHeight };
};
