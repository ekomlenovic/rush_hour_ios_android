import { buildZones, zoneOf, ZONE_SIZE, ZONE_THEMES, NEW_ZONE_THEMES, ZONE_SCENERY, ZONE_ICONS } from '../components/map/zones';
import { lightColors, darkColors } from '../theme/ui';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import { getMapFocusLevel, nextMapLevel } from '@/utils/mapFocus';
import { createMapLayout, generateRoadSegments, ZONE_GAP } from '../components/map/path';

describe('map zones', () => {
  it('groups the story levels by ZONE_SIZE, then the generated levels in one zone', () => {
    const zones = buildZones(45, 3);
    expect(zones.map(z => [z.firstId, z.lastId, z.generated])).toEqual([
      [1, 20, false], [21, 40, false], [41, 45, false], [46, 48, true],
    ]);
    expect(zones[3].theme).toBe('workshop');
    expect(ZONE_SIZE).toBe(20);
  });

  it('keeps the themes of the first 16 zones, then opens with the new ones (#40)', () => {
    const themes = buildZones(734, 1).map(z => z.theme);
    expect(themes.slice(0, 16)).toEqual([...ZONE_THEMES, ...ZONE_THEMES]);
    expect(themes.slice(16, 24)).toEqual([...NEW_ZONE_THEMES]);
    expect(themes.slice(24, 32)).toEqual([...ZONE_THEMES]);
    expect(themes[themes.length - 1]).toBe('workshop');
  });

  it('gives every theme its own zone color', () => {
    const zones = buildZones(48 * ZONE_SIZE, 1);
    const colorOf = new Map(zones.map(z => [z.theme, z.colorIndex]));
    expect(colorOf.size).toBe(ZONE_THEMES.length + NEW_ZONE_THEMES.length + 1);
    expect(new Set(colorOf.values()).size).toBe(colorOf.size);
    for (const colors of [lightColors, darkColors]) {
      expect(colors.mapZoneAccents).toHaveLength(colorOf.size);
      expect(colors.mapZoneTints).toHaveLength(colorOf.size);
    }
    for (const theme of colorOf.keys()) {
      expect(ZONE_SCENERY[theme].length).toBeGreaterThan(0);
      expect(ZONE_ICONS[theme]).toBeTruthy();
      expect(fr.map.zones[theme]).toBeTruthy();
      expect(en.map.zones[theme]).toBeTruthy();
    }
  });

  it('finds the zone of a level, the tutorial and the padlock included', () => {
    const zones = buildZones(45, 0);
    expect(zoneOf(zones, 0)?.number).toBe(1);
    expect(zoneOf(zones, 21)?.number).toBe(2);
    expect(zoneOf(zones, 46)?.number).toBe(3);
  });
});

describe('map layout', () => {
  const zones = buildZones(45, 0);
  const layout = createMapLayout(46, 390, 844, zones.slice(1).map(z => z.firstId));

  it('places the levels bottom to top, with more room between two zones', () => {
    const gap = (id: number) => layout.points[id - 1].y - layout.points[id].y;
    expect(gap(5)).toBeCloseTo(130);
    expect(gap(21)).toBeCloseTo(130 + ZONE_GAP);
    expect(gap(41)).toBeCloseTo(130 + ZONE_GAP);
  });

  it('finds the road position back from a height', () => {
    for (const t of [0, 3.5, 19.5, 20.25, 44]) {
      expect(layout.tAt(layout.yAt(t))).toBeCloseTo(t, 3);
    }
  });

  it('draws a continuous road from the tutorial to the padlock', () => {
    const segments = generateRoadSegments(layout);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].x1).toBeCloseTo(segments[i - 1].x2);
      expect(segments[i].y1).toBeCloseTo(segments[i - 1].y2);
    }
    const last = segments[segments.length - 1];
    const padlock = layout.points[layout.points.length - 1];
    expect([last.x2, last.y2]).toEqual([padlock.x, padlock.y]);
  });
});

describe('getMapFocusLevel', () => {
  it('opens on the last map level played', () => {
    expect(getMapFocusLevel(12, 30)).toBe(12);
  });

  it('opens on the next level to play when nothing was played', () => {
    expect(getMapFocusLevel(null, 30)).toBe(30);
  });

  it('ignores daily and weekly challenges', () => {
    expect(getMapFocusLevel(999999, 30)).toBe(30);
  });

  it('opens on the next level to play once the last one played is won', () => {
    const won = new Set([12, 29]);
    expect(getMapFocusLevel(12, 30, id => won.has(id))).toBe(30);
    expect(getMapFocusLevel(29, 30, id => won.has(id))).toBe(30);
  });

  it('keeps a level being played, even past the next one', () => {
    const won = new Set([12]);
    expect(getMapFocusLevel(31, 30, id => won.has(id))).toBe(31);
  });
});

describe('nextMapLevel', () => {
  it('is the following level of the map, generated levels included', () => {
    expect(nextMapLevel(12, 734)).toBe(13);
    expect(nextMapLevel(734, 740)).toBe(735);
  });

  it('is none after the last level, for the tutorial and for the challenges', () => {
    expect(nextMapLevel(734, 734)).toBeNull();
    expect(nextMapLevel(0, 734)).toBeNull();
    expect(nextMapLevel(999999, 734)).toBeNull();
  });
});
