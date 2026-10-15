import { useEffect, useMemo } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useGameStore } from '@/store/gameStore';
import { getUiColors, resolveScheme, type ColorScheme, type UiColors } from './ui';
import { getSkinnedBoard, type BoardColors, type VehiclePaletteId } from './board';

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  /** Interface colors */
  colors: UiColors;
  /** Board and vehicle colors, with the selected board theme and car skin */
  board: BoardColors;
  /** Selected palette of the other vehicles */
  palette: VehiclePaletteId;
}

/** Applies the player's choice to the native UI too (alerts, switches, keyboard): call once at the root */
export function useAppearanceSync(): void {
  const mode = useGameStore((s) => s.themeMode);
  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);
}

/** Active theme: the player's light / dark choice and the selected cosmetics */
export function useTheme(): Theme {
  const system = useColorScheme();
  const mode = useGameStore((s) => s.themeMode);
  const cosmetics = useGameStore((s) => s.cosmetics);
  const scheme = resolveScheme(mode, system);
  return {
    scheme,
    isDark: scheme === 'dark',
    colors: getUiColors(scheme),
    board: useMemo(() => getSkinnedBoard(cosmetics.board, cosmetics.skin, scheme), [cosmetics.board, cosmetics.skin, scheme]),
    palette: cosmetics.palette,
  };
}
