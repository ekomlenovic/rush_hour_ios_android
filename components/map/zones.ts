/** Story levels per zone of the world map */
export const ZONE_SIZE = 20;

/** Themes of the first zones, in order, played twice (keys of map.zones.* in the locales) */
export const ZONE_THEMES = ['downtown', 'suburbs', 'harbor', 'forest', 'desert', 'mountains', 'snow', 'night'] as const;
/** Themes added with the 1000-level campaign (#40): they open the zones after the first two rounds */
export const NEW_ZONE_THEMES = ['beach', 'farm', 'jungle', 'volcano', 'lake', 'airport', 'fairground', 'space'] as const;
export type ZoneTheme = typeof ZONE_THEMES[number] | typeof NEW_ZONE_THEMES[number] | 'workshop';

/** Zones that keep the order of the first themes: the 16 zones of the 309-level campaign */
const FIRST_ROUNDS = ZONE_THEMES.length * 2;
/** After them, every theme in turn, the new ones first */
const LATER_THEMES: ZoneTheme[] = [...NEW_ZONE_THEMES, ...ZONE_THEMES];
/** Index of each theme in the zone colors of the theme (mapZoneAccents / mapZoneTints) */
const COLOR_ORDER: ZoneTheme[] = [...ZONE_THEMES, 'workshop', ...NEW_ZONE_THEMES];

/** Theme of the story zone at this index (0 for the first zone) */
export function zoneTheme(index: number): ZoneTheme {
  return index < FIRST_ROUNDS
    ? ZONE_THEMES[index % ZONE_THEMES.length]
    : LATER_THEMES[(index - FIRST_ROUNDS) % LATER_THEMES.length];
}

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
  beach: ['🏖️', '🌴', '🦀', '🐚', '🏄'],
  farm: ['🚜', '🌾', '🐄', '🌻', '🐓'],
  jungle: ['🌴', '🦜', '🐒', '🌺', '🐍'],
  volcano: ['🌋', '🔥', '🦖', '💨', '🌋'],
  lake: ['🏞️', '🦆', '🛶', '🎣', '🌿'],
  airport: ['✈️', '🛫', '🧳', '🛬', '🚁'],
  fairground: ['🎢', '🎠', '🎪', '🍭', '🎈'],
  space: ['🚀', '🛰️', '🌕', '👽', '🌌'],
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
  beach: '🏖️',
  farm: '🚜',
  jungle: '🦜',
  volcano: '🌋',
  lake: '🏞️',
  airport: '✈️',
  fairground: '🎢',
  space: '🚀',
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
    const theme = zoneTheme(zones.length);
    zones.push({
      number: zones.length + 1,
      theme,
      colorIndex: COLOR_ORDER.indexOf(theme),
      firstId: first,
      lastId: Math.min(first + ZONE_SIZE - 1, storyCount),
      generated: false,
    });
  }
  if (generatedCount > 0) {
    zones.push({
      number: zones.length + 1,
      theme: 'workshop',
      colorIndex: COLOR_ORDER.indexOf('workshop'),
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
