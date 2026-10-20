import type { ColorScheme } from './ui';

/**
 * Board theme: colors of the grid and the vehicles (Board, Block, creator board),
 * independent from the interface theme so a cosmetic skin can change the board alone (#7).
 */
export interface BoardColors {
  /** Inside of the grid */
  background: string;
  /** Frame around the grid */
  frame: string;
  /** Cell lines */
  grid: string;
  /** Exit indicator */
  exit: string;
  /** Outline of the exit indicator */
  exitOutline: string;
  /** The red car to get out (overrides the color saved in the level) */
  targetCar: string;
  /** Colors given to the other vehicles (generator, creator) */
  vehicles: string[];
  vehicleBorder: string;
  /** Shine on the top of a vehicle */
  vehicleShine: string;
  /** Shine on the toolbox previews of the creator */
  vehicleShineStrong: string;
  /** Letter on a vehicle (accessibility) */
  vehicleLabel: string;
  vehicleLabelShadow: string;
  /** Grip dots of the creator vehicles */
  vehicleGrip: string;
  /** Border of a dragged vehicle */
  dragBorder: string;
  /** Hinted vehicle */
  hint: string;
  hintOutline: string;
  /** Veil and badge over the board once solved */
  winVeil: string;
  winBadge: string;
  winBadgeBorder: string;
  /** Drop preview of the creator */
  dropValid: string;
  dropValidBorder: string;
  dropInvalid: string;
  dropInvalidBorder: string;
  /** Corner radius of the vehicles, as a share of the cell size */
  vehicleRadius: number;
  /** Corner radius of the board */
  boardRadius: number;
  /** Drawn on the target car (car skin) */
  targetIcon?: string;
  /** Drawing of the target car instead of a colored block (car skin) */
  targetArt?: VehicleArt;
}

/**
 * Vehicles drawn instead of colored blocks: 'vintage' for the 1930s cars of the Mafia skin and palette,
 * 'ship' for the schooners and paddle steamers of the 1800 ones (Anno 1800 style)
 */
export type VehicleArt = 'vintage' | 'ship';

/** Board themes, persisted in the cosmetics selection: never rename one, only add */
export type BoardThemeId = 'classic' | 'paper' | 'wood' | 'neon' | 'pixel' | 'snow' | 'fire' | 'beach' | 'space';

/** Vehicle colors of the classic board (also the creator palette) */
export const CLASSIC_VEHICLE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
  '#6366F1', '#84CC16', '#D946EF', '#0EA5E9',
];

/** Color saved in the levels for the target car */
export const TARGET_CAR_COLOR = '#EF4444';

/** Colors given by the level generator (saved in the generated levels) */
export const GENERATOR_VEHICLE_COLORS = [
  '#F59E0B', '#10B981', '#3B82F6', '#EC4899',
  '#06B6D4', '#8B5CF6', '#F97316', '#64748B', '#14B8A6',
];

const classicShared = {
  exit: TARGET_CAR_COLOR,
  exitOutline: '#000000',
  targetCar: TARGET_CAR_COLOR,
  vehicles: CLASSIC_VEHICLE_COLORS,
  vehicleShine: 'rgba(255,255,255,0.18)',
  vehicleShineStrong: 'rgba(255,255,255,0.28)',
  vehicleLabel: '#FFFFFF',
  vehicleLabelShadow: 'rgba(0,0,0,0.6)',
  vehicleGrip: 'rgba(255,255,255,0.9)',
  dragBorder: 'rgba(255,255,255,0.4)',
  hint: '#F59E0B',
  hintOutline: '#000000',
  dropValid: 'rgba(74,222,128,0.28)',
  dropValidBorder: 'rgba(74,222,128,0.75)',
  dropInvalid: 'rgba(248,113,113,0.28)',
  dropInvalidBorder: 'rgba(248,113,113,0.75)',
  vehicleRadius: 0.18,
  boardRadius: 16,
};

const classic: Record<ColorScheme, BoardColors> = {
  dark: {
    ...classicShared,
    background: 'rgba(0,0,0,0.2)',
    frame: 'rgba(255,255,255,0.1)',
    grid: 'rgba(255,255,255,0.1)',
    vehicleBorder: 'rgba(255,255,255,0.15)',
    winVeil: 'rgba(15,15,26,0.72)',
    winBadge: 'rgba(30,30,50,0.85)',
    winBadgeBorder: 'rgba(255,255,255,0.15)',
  },
  light: {
    ...classicShared,
    background: 'rgba(0,0,0,0.02)',
    frame: 'rgba(0,0,0,0.1)',
    grid: 'rgba(0,0,0,0.06)',
    vehicleBorder: 'rgba(0,0,0,0.08)',
    winVeil: 'rgba(255,255,255,0.45)',
    winBadge: 'rgba(255,255,255,0.9)',
    winBadgeBorder: 'rgba(0,0,0,0.1)',
  },
};

/** Same board in light and dark mode (themes with their own opaque background) */
const both = (colors: BoardColors): Record<ColorScheme, BoardColors> => ({ light: colors, dark: colors });

const paper: Record<ColorScheme, BoardColors> = {
  light: {
    ...classicShared,
    background: '#FBF8EF',
    frame: '#2F3A56',
    grid: 'rgba(59,92,170,0.28)',
    exitOutline: '#2F3A56',
    vehicleBorder: 'rgba(30,30,40,0.7)',
    vehicleShine: 'rgba(255,255,255,0.1)',
    winVeil: 'rgba(251,248,239,0.6)',
    winBadge: 'rgba(255,255,255,0.95)',
    winBadgeBorder: 'rgba(47,58,86,0.3)',
    vehicleRadius: 0.12,
  },
  dark: {
    ...classicShared,
    background: '#2A2925',
    frame: '#D9D3C0',
    grid: 'rgba(217,211,192,0.18)',
    exitOutline: '#D9D3C0',
    vehicleBorder: 'rgba(240,235,220,0.6)',
    vehicleShine: 'rgba(255,255,255,0.08)',
    winVeil: 'rgba(42,41,37,0.7)',
    winBadge: 'rgba(60,58,52,0.9)',
    winBadgeBorder: 'rgba(217,211,192,0.3)',
    vehicleRadius: 0.12,
  },
};

const wood: Record<ColorScheme, BoardColors> = {
  light: {
    ...classicShared,
    background: '#D9A86C',
    frame: '#7A4A21',
    grid: 'rgba(110,62,25,0.35)',
    vehicleBorder: 'rgba(80,40,10,0.45)',
    winVeil: 'rgba(240,215,180,0.55)',
    winBadge: 'rgba(255,245,230,0.92)',
    winBadgeBorder: 'rgba(122,74,33,0.4)',
  },
  dark: {
    ...classicShared,
    background: '#5C3B1E',
    frame: '#3B2410',
    grid: 'rgba(20,10,0,0.35)',
    vehicleBorder: 'rgba(20,10,0,0.45)',
    winVeil: 'rgba(40,25,10,0.7)',
    winBadge: 'rgba(70,45,22,0.92)',
    winBadgeBorder: 'rgba(255,220,180,0.2)',
  },
};

const neon = both({
  ...classicShared,
  background: '#0B0620',
  frame: '#00E5FF',
  grid: 'rgba(0,229,255,0.22)',
  exit: '#FF2BD6',
  exitOutline: '#FFFFFF',
  vehicleBorder: 'rgba(255,255,255,0.55)',
  vehicleShine: 'rgba(255,255,255,0.25)',
  hint: '#FFF200',
  hintOutline: '#FF2BD6',
  winVeil: 'rgba(11,6,32,0.7)',
  winBadge: 'rgba(30,10,60,0.9)',
  winBadgeBorder: 'rgba(0,229,255,0.6)',
});

const pixel = both({
  ...classicShared,
  background: '#9BBC0F',
  frame: '#0F380F',
  grid: 'rgba(15,56,15,0.3)',
  exit: '#0F380F',
  exitOutline: '#9BBC0F',
  vehicleBorder: '#0F380F',
  vehicleShine: 'rgba(255,255,255,0.12)',
  hint: '#0F380F',
  hintOutline: '#8BAC0F',
  winVeil: 'rgba(139,172,15,0.6)',
  winBadge: 'rgba(155,188,15,0.95)',
  winBadgeBorder: '#0F380F',
  vehicleRadius: 0.02,
  boardRadius: 2,
});

const snow: Record<ColorScheme, BoardColors> = {
  light: {
    ...classicShared,
    background: '#EAF4FB',
    frame: '#9CC7E8',
    grid: 'rgba(110,160,205,0.3)',
    vehicleBorder: 'rgba(255,255,255,0.9)',
    vehicleShine: 'rgba(255,255,255,0.35)',
    winVeil: 'rgba(234,244,251,0.6)',
    winBadge: 'rgba(255,255,255,0.95)',
    winBadgeBorder: 'rgba(156,199,232,0.8)',
  },
  dark: {
    ...classicShared,
    background: '#16253A',
    frame: '#9CC7E8',
    grid: 'rgba(156,199,232,0.2)',
    vehicleBorder: 'rgba(220,240,255,0.6)',
    vehicleShine: 'rgba(255,255,255,0.3)',
    winVeil: 'rgba(22,37,58,0.7)',
    winBadge: 'rgba(30,50,75,0.92)',
    winBadgeBorder: 'rgba(156,199,232,0.5)',
  },
};

const fire: Record<ColorScheme, BoardColors> = {
  light: {
    ...classicShared,
    background: '#FFE8D6',
    frame: '#FF6A00',
    grid: 'rgba(255,106,0,0.25)',
    exit: '#FF6A00',
    vehicleBorder: 'rgba(160,40,0,0.35)',
    hint: '#FFD000',
    winVeil: 'rgba(255,232,214,0.6)',
    winBadge: 'rgba(255,250,245,0.95)',
    winBadgeBorder: 'rgba(255,106,0,0.5)',
  },
  dark: {
    ...classicShared,
    background: '#2A0A02',
    frame: '#FF6A00',
    grid: 'rgba(255,120,0,0.22)',
    exit: '#FFB000',
    vehicleBorder: 'rgba(255,150,60,0.4)',
    hint: '#FFD000',
    winVeil: 'rgba(42,10,2,0.7)',
    winBadge: 'rgba(70,20,5,0.92)',
    winBadgeBorder: 'rgba(255,106,0,0.5)',
  },
};

const beach: Record<ColorScheme, BoardColors> = {
  light: {
    ...classicShared,
    background: '#F6E3B4',
    frame: '#0E7490',
    grid: 'rgba(180,130,60,0.3)',
    vehicleBorder: 'rgba(120,80,30,0.35)',
    winVeil: 'rgba(246,227,180,0.6)',
    winBadge: 'rgba(255,250,240,0.95)',
    winBadgeBorder: 'rgba(14,116,144,0.4)',
  },
  dark: {
    ...classicShared,
    background: '#3A3020',
    frame: '#0E7490',
    grid: 'rgba(240,210,150,0.18)',
    vehicleBorder: 'rgba(240,210,150,0.35)',
    winVeil: 'rgba(58,48,32,0.7)',
    winBadge: 'rgba(80,66,44,0.92)',
    winBadgeBorder: 'rgba(34,211,238,0.4)',
  },
};

const space = both({
  ...classicShared,
  background: '#070B1F',
  frame: '#A855F7',
  grid: 'rgba(168,85,247,0.2)',
  exit: '#FACC15',
  exitOutline: '#FFFFFF',
  vehicleBorder: 'rgba(255,255,255,0.4)',
  vehicleShine: 'rgba(255,255,255,0.22)',
  hint: '#FACC15',
  hintOutline: '#A855F7',
  winVeil: 'rgba(7,11,31,0.7)',
  winBadge: 'rgba(25,20,60,0.9)',
  winBadgeBorder: 'rgba(168,85,247,0.6)',
});

export const BOARD_THEMES: Record<BoardThemeId, Record<ColorScheme, BoardColors>> = {
  classic, paper, wood, neon, pixel, snow, fire, beach, space,
};

export function getBoardColors(id: BoardThemeId, scheme: ColorScheme): BoardColors {
  return (BOARD_THEMES[id] ?? classic)[scheme];
}

// ─── Target car skins ─────────────────────────────────────────────────────────

export type CarSkinId = 'classic' | 'taxi' | 'bus' | 'police' | 'sport' | 'rocket' | 'gold' | 'tractor' | 'ufo' | 'mafia' | 'flagship';

export interface CarSkin {
  /** Body color, the board's target car color when absent */
  color?: string;
  /** Drawn on the car (and the icon of the skin in the garage) */
  icon?: string;
  /** The car is drawn rather than a block with an icon */
  art?: VehicleArt;
}

export const CAR_SKINS: Record<CarSkinId, CarSkin> = {
  classic: { icon: '🚗' },
  taxi: { color: '#FACC15', icon: '🚕' },
  bus: { color: '#F59E0B', icon: '🚌' },
  police: { color: '#1E3A8A', icon: '🚓' },
  // British racing green, the red emoji disappeared on a red body
  sport: { color: '#15803D', icon: '🏎️' },
  rocket: { color: '#7C3AED', icon: '🚀' },
  gold: { color: '#EAB308', icon: '👑' },
  // Green body: the red tractor emoji stays visible
  tractor: { color: '#16A34A', icon: '🚜' },
  ufo: { color: '#64748B', icon: '🛸' },
  // 1930s sedan of Lost Heaven, burgundy: still the red car to get out, among the black cars of the Mafia palette
  mafia: { color: '#7A1424', icon: '🎩', art: 'vintage' },
  // Schooner of the industrial age (Anno 1800 style), crimson hull: the red one to get out
  flagship: { color: '#9B1B30', icon: '⛵', art: 'ship' },
};

// ─── Vehicle palettes ─────────────────────────────────────────────────────────

/** 'classic' keeps the colors saved in each level */
export type VehiclePaletteId = 'classic' | 'pastel' | 'ocean' | 'earth' | 'neon' | 'candy' | 'lava' | 'jungle' | 'mafia' | 'fleet';

export const VEHICLE_PALETTES: Record<VehiclePaletteId, string[] | null> = {
  classic: null,
  pastel: ['#93C5FD', '#86EFAC', '#FDE68A', '#C4B5FD', '#F9A8D4', '#99F6E4', '#FDBA74', '#A5F3FC'],
  ocean: ['#0EA5E9', '#14B8A6', '#1D4ED8', '#06B6D4', '#0F766E', '#38BDF8', '#2563EB', '#5EEAD4'],
  earth: ['#A16207', '#4D7C0F', '#78716C', '#B45309', '#365314', '#92400E', '#57534E', '#65A30D'],
  neon: ['#00E5FF', '#39FF14', '#FFF200', '#B026FF', '#FF6EC7', '#00FFA3', '#FF9E00', '#4D4DFF'],
  candy: ['#F472B6', '#A78BFA', '#34D399', '#FBBF24', '#60A5FA', '#FB923C', '#2DD4BF', '#E879F9'],
  // No red: the target car must stand out
  lava: ['#EA580C', '#F59E0B', '#FACC15', '#78350F', '#FB923C', '#57534E', '#B45309', '#FDE047'],
  jungle: ['#15803D', '#65A30D', '#0D9488', '#CA8A04', '#166534', '#4ADE80', '#A3E635', '#0F766E'],
  // 1930s cars: black, cream, bottle green, chocolate, navy, chrome grey… no red for the target car
  mafia: ['#292524', '#E7DCC4', '#14532D', '#5C3A21', '#1E3A5F', '#A8A29E', '#78716C', '#B08D57'],
  // Hulls of the industrial age: bottle green, navy, ochre, brick, slate, cream, teal, coal… no red for the target ship
  fleet: ['#1F4D3A', '#23395B', '#B8862B', '#7A3E1D', '#5B6770', '#E8DCC0', '#2E6F6A', '#2B2B2B'],
};

/** Palettes whose vehicles are drawn rather than colored blocks */
export const PALETTE_ART: Partial<Record<VehiclePaletteId, VehicleArt>> = {
  mafia: 'vintage',
  fleet: 'ship',
};

/** Board colors with the target car skin applied */
export function getSkinnedBoard(id: BoardThemeId, skin: CarSkinId, scheme: ColorScheme): BoardColors {
  const board = getBoardColors(id, scheme);
  const carSkin = CAR_SKINS[skin] ?? CAR_SKINS.classic;
  return { ...board, targetCar: carSkin.color ?? board.targetCar, targetIcon: carSkin.icon, targetArt: carSkin.art };
}

/** Color of each non-target vehicle in the order of the level, for a palette */
export function applyPalette<T extends { id: string; isTarget: boolean; color: string }>(vehicles: T[], palette: VehiclePaletteId): Map<string, string> {
  const colors = VEHICLE_PALETTES[palette];
  const result = new Map<string, string>();
  let index = 0;
  for (const v of vehicles) {
    if (v.isTarget) continue;
    result.set(v.id, colors ? colors[index % colors.length] : v.color);
    index++;
  }
  return result;
}
