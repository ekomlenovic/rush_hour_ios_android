/**
 * Interface theme: semantic color tokens of the screens, with a light and a dark variant.
 * The only place (with theme/board.ts) where colors are written: screens read them through useTheme().
 */
export interface UiColors {
  /** Screen background */
  background: string;
  /** Screen background behind a blurred header */
  backgroundTranslucent: string;
  /** Screen background veiling the content behind a modal */
  backgroundVeil: string;
  /** Opaque surface: sheets, modals, cards, toasts */
  surface: string;
  /** Floating pill above the content */
  floating: string;
  /** Translucent card on the background */
  card: string;
  /** Neutral tint behind segmented controls and secondary elements */
  neutralSoft: string;
  /** Card and separator borders */
  border: string;
  /** Hairline separators (map path) */
  divider: string;
  /** Locked or inactive element */
  inactive: string;
  text: string;
  textMuted: string;
  /** Fill of the main buttons and selected elements */
  primary: string;
  /** Primary color for text and links on the background or a surface */
  primaryText: string;
  /** Text and icons on a primary (or any saturated) fill */
  onPrimary: string;
  primarySoft: string;
  primaryBorder: string;
  success: string;
  successSoft: string;
  successBorder: string;
  /** Hints, streak, achievements */
  warning: string;
  /** Warning color for small text on a card or a warning-tinted fill (hint button, hints left) */
  warningText: string;
  warningSoft: string;
  /** Text on a warning fill */
  onWarning: string;
  danger: string;
  dangerSoft: string;
  /** Weekly challenge */
  weekly: string;
  /** Favorite star */
  star: string;
  /** Star count written as text: readable on the background and surfaces */
  starText: string;
  /** Streak freeze in the calendar */
  frozen: string;
  /** Daily challenge result in the calendar, by number of stars (1 to 3) */
  dailyStars: [string, string, string];
  /** Text on the light calendar fills (1-2 stars, frozen), whatever the theme */
  onLightFill: string;
  /** Level nodes of the map, by difficulty */
  levelEasy: string;
  levelMedium: string;
  levelHard: string;
  levelUnknown: string;
  levelTutorial: string;
  levelCustom: string;
  /** World map: road, its edges and the dashes of its center line */
  mapRoad: string;
  mapRoadEdge: string;
  mapRoadDash: string;
  /** World map: locked level token and its number */
  mapLocked: string;
  mapLockedText: string;
  /** World map: darker rim under a level token (3D button) */
  mapNodeDepth: string;
  /** World map: halo pulsing around the next level */
  mapHalo: string;
  /** World map: accent of each zone, and the soft tint of its background band */
  mapZoneAccents: string[];
  mapZoneTints: string[];
  /** Dimmed backdrop behind a modal */
  overlay: string;
  overlayStrong: string;
  shadow: string;
  /** Off track of a switch */
  switchTrackOff: string;
  /** Behind a QR code (must stay white to be scanned) */
  qrBackground: string;
  /** Dark modules of a QR code (must stay black to be scanned) */
  qrForeground: string;
  /** GitHub brand button */
  github: string;
  /** Shine on a saturated fill */
  shine: string;
  shineFaint: string;
  /** Text shadow on a saturated fill */
  textShadow: string;
}

export type ColorScheme = 'light' | 'dark';

/** Tokens identical in light and dark: usable in static StyleSheet.create() styles */
export const fixedColors = {
  onPrimary: '#FFFFFF',
  frozen: '#7DD3FC',
  dailyStars: ['#A5D6A7', '#66BB6A', '#2E7D32'] as [string, string, string],
  onLightFill: '#0F0F1A',
  levelEasy: '#10B981',
  levelMedium: '#F59E0B',
  levelHard: '#EF4444',
  levelUnknown: '#8B5CF6',
  levelTutorial: '#3B82F6',
  levelCustom: '#5A4FE0',
  mapNodeDepth: 'rgba(0,0,0,0.28)',
  mapZoneAccents: ['#6366F1', '#10B981', '#06B6D4', '#16A34A', '#F59E0B', '#64748B', '#38BDF8', '#EC4899', '#8B5CF6',
    '#EAB308', '#84CC16', '#059669', '#EA580C', '#3B82F6', '#14B8A6', '#F43F5E', '#A855F7'],
  overlay: 'rgba(0,0,0,0.5)',
  overlayStrong: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  switchTrackOff: '#767577',
  qrBackground: '#FFFFFF',
  qrForeground: '#000000',
  github: '#24292E',
  shine: 'rgba(255,255,255,0.2)',
  shineFaint: 'rgba(255,255,255,0.05)',
  textShadow: 'rgba(0,0,0,0.4)',
  neutralSoft: 'rgba(128,128,128,0.1)',
} satisfies Partial<UiColors>;

/** Full-screen slides of the recap (issue 125): a gradient each, white text, same in light and dark */
export const recapSlideColors = {
  intro: ['#1E1B4B', '#4338CA'],
  levels: ['#431407', '#C2410C'],
  time: ['#042F2E', '#0F766E'],
  challenges: ['#052E16', '#15803D'],
  feats: ['#4C0519', '#BE123C'],
  unlocks: ['#422006', '#A16207'],
  share: ['#0F0F1A', '#312E81'],
} as const;

/** Text and chips on the recap slides */
export const recapSlideText = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.8)',
  chip: 'rgba(255,255,255,0.14)',
  track: 'rgba(255,255,255,0.3)',
};

/** The recap image shared (issue 125): it leaves the app, same colors in light and dark */
export const recapImageColors = {
  top: '#1E1B4B',
  bottom: '#4338CA',
  text: '#FFFFFF',
  muted: '#C7D2FE',
  box: 'rgba(255,255,255,0.12)',
  accent: '#FACC15',
  /** Text on the accent fill (profile pill) */
  onAccent: '#1E1B4B',
  /** Faint cells of a board behind everything */
  gridLine: 'rgba(255,255,255,0.05)',
  shadow: 'rgba(0,0,0,0.35)',
  /** Speed lines of the car getting out */
  speed: 'rgba(255,255,255,0.55)',
  road: '#1F2937',
  roadEdge: 'rgba(255,255,255,0.7)',
  roadLine: '#FACC15',
};

export const darkColors: UiColors = {
  ...fixedColors,
  background: '#0F0F1A',
  backgroundTranslucent: 'rgba(15,15,26,0.85)',
  backgroundVeil: 'rgba(15,15,26,0.6)',
  surface: '#1A1A2E',
  floating: 'rgba(22,20,40,0.96)',
  card: 'rgba(255,255,255,0.06)',
  border: '#2D2D3A',
  divider: 'rgba(255,255,255,0.1)',
  inactive: '#2A2A35',
  text: '#FFFFFF',
  textMuted: '#8E8EA0',
  primary: '#6359F7',
  primaryText: '#8B85FF',
  primarySoft: 'rgba(108,99,255,0.1)',
  primaryBorder: 'rgba(108,99,255,0.2)',
  success: '#10B981',
  successSoft: 'rgba(16,185,129,0.12)',
  successBorder: 'rgba(16,185,129,0.35)',
  warning: '#F59E0B',
  warningText: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.15)',
  onWarning: '#0F0F1A',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.18)',
  weekly: '#F97316',
  star: '#FFD700',
  starText: '#FFD700',
  mapRoad: '#262639',
  mapRoadEdge: 'rgba(255,255,255,0.07)',
  mapRoadDash: 'rgba(255,255,255,0.32)',
  mapLocked: '#25253A',
  mapLockedText: '#6E6E86',
  mapHalo: 'rgba(239,68,68,0.35)',
  mapZoneTints: [
    'rgba(99,102,241,0.08)', 'rgba(16,185,129,0.07)', 'rgba(6,182,212,0.08)', 'rgba(22,163,74,0.08)',
    'rgba(245,158,11,0.07)', 'rgba(148,163,184,0.07)', 'rgba(56,189,248,0.08)', 'rgba(236,72,153,0.08)',
    'rgba(139,92,246,0.08)',
    'rgba(234,179,8,0.07)', 'rgba(132,204,22,0.07)', 'rgba(5,150,105,0.08)', 'rgba(234,88,12,0.08)',
    'rgba(59,130,246,0.08)', 'rgba(20,184,166,0.08)', 'rgba(244,63,94,0.07)', 'rgba(168,85,247,0.08)',
  ],
};

export const lightColors: UiColors = {
  ...fixedColors,
  background: '#F5F5FA',
  backgroundTranslucent: 'rgba(245,245,250,0.85)',
  backgroundVeil: 'rgba(245,245,250,0.6)',
  surface: '#FFFFFF',
  floating: 'rgba(255,255,255,0.96)',
  card: 'rgba(0,0,0,0.04)',
  border: '#E0E0E8',
  divider: 'rgba(0,0,0,0.1)',
  inactive: '#E0E0E8',
  text: '#1A1A2E',
  textMuted: '#62627A',
  primary: '#5A4FE0',
  primaryText: '#5A4FE0',
  primarySoft: 'rgba(90,79,224,0.08)',
  primaryBorder: 'rgba(90,79,224,0.2)',
  success: '#047857',
  successSoft: 'rgba(5,150,105,0.08)',
  successBorder: 'rgba(5,150,105,0.25)',
  warning: '#B45309',
  warningText: '#92400E',
  warningSoft: 'rgba(217,119,6,0.1)',
  onWarning: '#FFFFFF',
  danger: '#B91C1C',
  dangerSoft: 'rgba(239,68,68,0.1)',
  weekly: '#C2410C',
  star: '#FFB800',
  starText: '#A16207',
  mapRoad: '#D4D4E2',
  mapRoadEdge: 'rgba(0,0,0,0.05)',
  mapRoadDash: 'rgba(255,255,255,0.95)',
  mapLocked: '#E4E4EE',
  mapLockedText: '#9A9AAE',
  mapHalo: 'rgba(239,68,68,0.25)',
  mapZoneTints: [
    'rgba(99,102,241,0.07)', 'rgba(16,185,129,0.07)', 'rgba(6,182,212,0.08)', 'rgba(22,163,74,0.07)',
    'rgba(245,158,11,0.08)', 'rgba(100,116,139,0.07)', 'rgba(56,189,248,0.08)', 'rgba(236,72,153,0.06)',
    'rgba(139,92,246,0.07)',
    'rgba(234,179,8,0.08)', 'rgba(132,204,22,0.08)', 'rgba(5,150,105,0.07)', 'rgba(234,88,12,0.07)',
    'rgba(59,130,246,0.07)', 'rgba(20,184,166,0.07)', 'rgba(244,63,94,0.06)', 'rgba(168,85,247,0.07)',
  ],
};

/** Light or dark, from the player's choice ('system' follows the device) */
export function resolveScheme(mode: 'system' | 'light' | 'dark', system: string | null | undefined): ColorScheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return system === 'dark' ? 'dark' : 'light';
}

/** Status bar icons readable on the screen background: dark icons on the light theme, light ones on the dark theme */
export function statusBarStyle(scheme: ColorScheme): 'light' | 'dark' {
  return scheme === 'dark' ? 'light' : 'dark';
}

export function getUiColors(scheme: ColorScheme): UiColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
