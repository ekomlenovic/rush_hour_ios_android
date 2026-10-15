import { useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useGameStore } from '@/store/gameStore';
import { getUiColors, resolveScheme, type ColorScheme, type UiColors } from './ui';
import { getBoardColors, type BoardColors, type BoardThemeId } from './board';

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  /** Interface colors */
  colors: UiColors;
  /** Board and vehicle colors */
  board: BoardColors;
}

/** Applies the player's choice to the native UI too (alerts, switches, keyboard): call once at the root */
export function useAppearanceSync(): void {
  const mode = useGameStore((s) => s.themeMode);
  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);
}

/** Active theme: the player's light / dark choice and (later) the cosmetic board theme of the store */
export function useTheme(): Theme {
  const system = useColorScheme();
  const mode = useGameStore((s) => s.themeMode);
  const boardTheme: BoardThemeId = 'classic';
  const scheme = resolveScheme(mode, system);
  return {
    scheme,
    isDark: scheme === 'dark',
    colors: getUiColors(scheme),
    board: getBoardColors(boardTheme, scheme),
  };
}
