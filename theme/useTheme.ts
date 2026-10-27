import { createContext, useContext, useEffect, useMemo } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { useGameStore } from '@/store/gameStore';
import { getUiColors, resolveScheme, type ColorScheme, type UiColors } from './ui';
import { getSkinnedBoard, type BoardColors, type BoardLook, type VehiclePaletteId } from './board';

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

/** Another player's look for the board inside it (and its vehicles) */
const BoardLookContext = createContext<BoardLook | null>(null);
export const BoardLookProvider = BoardLookContext.Provider;

/** The colors and the palette of a board: another player's look (multiplayer), or the selected cosmetics */
export function useBoardTheme(look?: BoardLook): { board: BoardColors; palette: VehiclePaletteId } {
  const { scheme, board, palette } = useTheme();
  const inherited = useContext(BoardLookContext);
  const override = look ?? inherited;
  const skinned = useMemo(() => override && getSkinnedBoard(override.board, override.skin, scheme), [override, scheme]);
  return override && skinned ? { board: skinned, palette: override.palette } : { board, palette };
}

/** Applies the player's choice to the native UI too (alerts, switches, keyboard): call once at the root */
export function useAppearanceSync(): void {
  const mode = useGameStore((s) => s.themeMode);
  const system = useColorScheme();
  const background = getUiColors(resolveScheme(mode, system)).background;
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // The web has no native UI to set: the page tells the browser its scheme (scroll bars, form fields),
    // and paints the sides of the column (big screen) and the status bar of the iPhone (theme-color) like the app
    document.documentElement.style.colorScheme = mode === 'system' ? 'light dark' : mode;
    document.body.style.backgroundColor = background;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', background));
  }, [mode, background]);
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
