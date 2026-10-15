export interface PathPoint {
  id: number;
  x: number;
  y: number;
}

/** Straight piece of the drawn road, between two samples of the curve */
export interface RoadSegment {
  /** Unique key */
  key: string;
  /** Level the piece leaves from: the road is "driven" once this level is beaten */
  fromId: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Geometry of the world map. Positions along the road are counted in levels: t = 0 is level 1,
 * t = 1.5 is halfway between levels 2 and 3. The map is drawn bottom to top.
 */
export interface MapLayout {
  points: PathPoint[];
  totalHeight: number;
  /** Horizontal position of the road at t */
  xAt: (t: number) => number;
  /** Height of the road at t */
  yAt: (t: number) => number;
  /** Position on the road shown at a height of the map */
  tAt: (y: number) => number;
}

const NODE_SPACING = 130;
/** Extra room between two zones, for the zone banner */
export const ZONE_GAP = 100;
const BOTTOM_MARGIN = 230;
/** Room above the last node, under the header */
const TOP_MARGIN = 110;
const WAVE = 1.5;
/** Samples of the curve between two levels: enough for the road to look smooth */
const SAMPLES_PER_GAP = 6;

/**
 * Candy crush style path, bottom to top.
 * @param count levels on the road, the padlock at the end included
 * @param zoneStarts first level of every zone but the first one: the gap under it is stretched by ZONE_GAP
 */
export const createMapLayout = (count: number, width: number, screenHeight: number, zoneStarts: number[]): MapLayout => {
  // The gap under level b goes from t = b - 2 to t = b - 1
  const gaps = zoneStarts.filter(b => b >= 2 && b <= count).map(b => b - 2).sort((a, b) => a - b);

  // Calculate a total height that guarantees the content can be scrolled if needed,
  // or at least fills the screen so the bottom-most level is near the bottom edge.
  const contentHeight = count * NODE_SPACING + gaps.length * ZONE_GAP + BOTTOM_MARGIN + TOP_MARGIN;
  const totalHeight = Math.max(screenHeight * 1.1, contentHeight);

  const rise = (t: number) => {
    let r = t * NODE_SPACING;
    for (const g of gaps) {
      if (t <= g) break;
      r += ZONE_GAP * Math.min(1, t - g);
    }
    return r;
  };

  const xAt = (t: number) => width / 2 + Math.sin(t * WAVE) * width * 0.25;
  const yAt = (t: number) => totalHeight - BOTTOM_MARGIN - rise(t);
  const tAt = (y: number) => {
    const target = totalHeight - BOTTOM_MARGIN - y;
    let lo = -1;
    let hi = count + 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (rise(mid) < target) lo = mid; else hi = mid;
    }
    return lo;
  };

  // Level 0 (Tutorial) - Positioned to the left of Level 1
  const points: PathPoint[] = [{ id: 0, x: width / 2 - 80, y: yAt(0) }];
  for (let i = 0; i < count; i++) {
    // i=0 is level 1. It goes at the BOTTOM.
    points.push({ id: i + 1, x: xAt(i), y: yAt(i) });
  }

  return { points, totalHeight, xAt, yAt, tAt };
};

/** The road through the levels, following the wave between them (straight to the tutorial) */
export const generateRoadSegments = (layout: MapLayout) => {
  const { points, xAt, yAt } = layout;
  const segments: RoadSegment[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    if (from.id === 0) {
      segments.push({ key: 'r0', fromId: 0, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
      continue;
    }
    const t0 = from.id - 1;
    for (let s = 0; s < SAMPLES_PER_GAP; s++) {
      const a = t0 + s / SAMPLES_PER_GAP;
      const b = t0 + (s + 1) / SAMPLES_PER_GAP;
      segments.push({ key: `r${from.id}-${s}`, fromId: from.id, x1: xAt(a), y1: yAt(a), x2: xAt(b), y2: yAt(b) });
    }
  }
  return segments;
};
