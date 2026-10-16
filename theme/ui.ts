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
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  /** Weekly challenge */
  weekly: string;
  /** Favorite star */
  star: string;
  /** Streak freeze in the calendar */
  frozen: string;
  /** Daily challenge result in the calendar, by number of stars (1 to 3) */
  dailyStars: [string, string, string];
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
  levelEasy: '#10B981',
  levelMedium: '#F59E0B',
  levelHard: '#EF4444',
  levelUnknown: '#8B5CF6',
  levelTutorial: '#3B82F6',
  levelCustom: '#5A4FE0',
  mapNodeDepth: 'rgba(0,0,0,0.28)',
  mapZoneAccents: ['#6366F1', '#10B981', '#06B6D4', '#16A34A', '#F59E0B', '#64748B', '#38BDF8', '#EC4899', '#8B5CF6'],
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
  warningSoft: 'rgba(245,158,11,0.15)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.18)',
  weekly: '#F97316',
  star: '#FFD700',
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
  textMuted: '#6B6B80',
  primary: '#5A4FE0',
  primaryText: '#5A4FE0',
  primarySoft: 'rgba(90,79,224,0.08)',
  primaryBorder: 'rgba(90,79,224,0.2)',
  success: '#047857',
  successSoft: 'rgba(5,150,105,0.08)',
  successBorder: 'rgba(5,150,105,0.25)',
  warning: '#B45309',
  warningSoft: 'rgba(217,119,6,0.1)',
  danger: '#B91C1C',
  dangerSoft: 'rgba(239,68,68,0.1)',
  weekly: '#C2410C',
  star: '#FFB800',
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
  ],
};

/** Light or dark, from the player's choice ('system' follows the device) */
export function resolveScheme(mode: 'system' | 'light' | 'dark', system: string | null | undefined): ColorScheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return system === 'dark' ? 'dark' : 'light';
}

export function getUiColors(scheme: ColorScheme): UiColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
