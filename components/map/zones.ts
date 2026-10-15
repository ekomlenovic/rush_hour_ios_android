/** Story levels per zone of the world map */
export const ZONE_SIZE = 20;

/** Themes of the story zones, in order, repeated after the last one (keys of map.zones.* in the locales) */
export const ZONE_THEMES = ['downtown', 'suburbs', 'harbor', 'forest', 'desert', 'mountains', 'snow', 'night'] as const;
export type ZoneTheme = typeof ZONE_THEMES[number] | 'workshop';

/** Scenery drawn beside the road of each zone */
export const ZONE_SCENERY: Record<ZoneTheme, string[]> = {
  downtown: ['🏢', '🚦', '🏬', '🏙️', '🚕'],
  suburbs: ['🏡', '🌳', '🏠', '⛲', '🚲'],
  harbor: ['⚓', '🚢', '⛵', '🌊', '🐟'],
  forest: ['🌲', '🌳', '🍄', '🦌', '🌲'],
  desert: ['🌵', '🏜️', '🐪', '☀️', '🌵'],
  mountains: ['⛰️', '🏔️', '🌲', '🦅', '🚠'],
  snow: ['❄️', '☃️', '🌨️', '⛷️', '🌲'],
  night: ['🌃', '🌙', '✨', '🎡', '⭐'],
  workshop: ['🚧', '🛠️', '⚙️', '🏗️', '🔧'],
};

export const ZONE_ICONS: Record<ZoneTheme, string> = {
  downtown: '🏙️',
  suburbs: '🏡',
  harbor: '⚓',
  forest: '🌲',
  desert: '🌵',
  mountains: '🏔️',
  snow: '❄️',
  night: '🌃',
  workshop: '🛠️',
};

export interface MapZone {
  /** 1 for the first zone; the zone of the generated levels comes last */
  number: number;
  theme: ZoneTheme;
  /** Index in the zone colors of the theme (mapZoneAccents / mapZoneTints) */
  colorIndex: number;
  firstId: number;
  lastId: number;
  generated: boolean;
}

/**
 * Zones of the map: groups of ZONE_SIZE story levels, then one zone for every generated level.
 * The tutorial (level 0) and the padlock at the end belong to the first and last zones.
 */
export function buildZones(storyCount: number, generatedCount: number): MapZone[] {
  const zones: MapZone[] = [];
  for (let first = 1; first <= storyCount; first += ZONE_SIZE) {
    const index = zones.length;
    zones.push({
      number: index + 1,
      theme: ZONE_THEMES[index % ZONE_THEMES.length],
      colorIndex: index % ZONE_THEMES.length,
      firstId: first,
      lastId: Math.min(first + ZONE_SIZE - 1, storyCount),
      generated: false,
    });
  }
  if (generatedCount > 0) {
    zones.push({
      number: zones.length + 1,
      theme: 'workshop',
      colorIndex: ZONE_THEMES.length,
      firstId: storyCount + 1,
      lastId: storyCount + generatedCount,
      generated: true,
    });
  }
  return zones;
}

/** Zone of a level (the closest one for the tutorial and the padlock) */
export function zoneOf(zones: MapZone[], levelId: number): MapZone | undefined {
  return zones.find(z => levelId <= z.lastId) ?? zones[zones.length - 1];
}

/** Stable pseudo-random number in [0, 1) for a seed: the scenery stays in place between renders */
export function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
