import './setup';
import { Alert } from 'react-native';
import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import i18n from '@/utils/i18n';
import MapScreen from '@/app/map';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { startLevelGeneration } from '@/hooks/useLevelGenerator';
import { resetStore } from '../helpers';

jest.mock('@/hooks/useLevelGenerator', () => {
  const actual = jest.requireActual('@/hooks/useLevelGenerator');
  const startLevelGeneration = jest.fn();
  return { ...actual, startLevelGeneration, useLevelGenerator: () => startLevelGeneration };
});

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
const button = (name: string) => screen.getByRole('button', { name });
const press = (name: string) => fireEvent.press(button(name));

const openMap = async () => {
  await renderRouter({ _layout: require('@/app/_layout'), map: MapScreen }, { initialUrl: '/map' });
  await waitFor(() => expect(button(t('map.filter_title'))).toBeTruthy());
};

/** Levels 1 to 5 won: 3, 2, 1, 3 and 2 stars */
const winFirstLevels = () => {
  useGameStore.setState({
    maxUnlockedLevel: 6,
    progress: [3, 2, 1, 3, 2].map((stars, i) => ({ levelId: i + 1, completed: true, bestScore: stars * 100, stars })),
  });
};

describe('world map', () => {
  beforeEach(() => {
    resetStore();
    jest.mocked(startLevelGeneration).mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    winFirstLevels();
  });

  describe('search', () => {
    it('finds the levels without 3 stars and goes from one to the next, on the map itself', async () => {
      await openMap();
      await press(t('map.filter_title'));
      await press(t('map.filter_under_three'));
      // Levels 2, 3 and 5 (1 or 2 stars), and the three levels playable but not won: 6, 7, 8
      await press(t('map.filter_show', { count: 6 }));

      // The search starts on the match closest to the middle of the screen (the map opens around level 6, the next one to play)
      expect(screen.getByLabelText(t('a11y.filter_position', { id: 5, position: 3, total: 6 }))).toBeTruthy();
      await press(t('a11y.filter_next'));
      expect(screen.getByLabelText(t('a11y.filter_position', { id: 6, position: 4, total: 6 }))).toBeTruthy();
      await press(t('a11y.filter_previous'));
      await press(t('a11y.filter_previous'));
      expect(screen.getByLabelText(t('a11y.filter_position', { id: 3, position: 2, total: 6 }))).toBeTruthy();
      // Round at the ends
      await press(t('a11y.filter_previous'));
      await press(t('a11y.filter_previous'));
      expect(screen.getByLabelText(t('a11y.filter_position', { id: 8, position: 6, total: 6 }))).toBeTruthy();

      // Quitting the search gives the map and its tools back
      await press(t('a11y.filter_close'));
      expect(screen.queryByRole('button', { name: t('a11y.filter_next') })).toBeNull();
      expect(button(t('map.filter_title'))).toBeTruthy();
    });

    it('follows the progress: a level won with 3 stars leaves the search', async () => {
      await openMap();
      await press(t('map.filter_title'));
      await press(t('a11y.level_stars', { count: 2 }));
      await press(t('map.filter_show', { count: 2 }));
      expect(screen.getByLabelText(t('a11y.filter_position', { id: 5, position: 2, total: 2 }))).toBeTruthy();

      useGameStore.setState(s => ({ progress: s.progress.map(p => (p.levelId === 5 ? { ...p, stars: 3 } : p)) }));
      // Level 5 does not match any more: the search goes on from it
      await waitFor(() => expect(screen.getByLabelText(t('a11y.filter_position', { id: 5, position: 0, total: 1 }))).toBeTruthy());
      await press(t('a11y.filter_next'));
      expect(screen.getByLabelText(t('a11y.filter_position', { id: 2, position: 1, total: 1 }))).toBeTruthy();
    });

    it('goes straight to a level typed by its number, a locked one included', async () => {
      await openMap();
      await press(t('map.filter_title'));
      const field = () => screen.getByLabelText(t('a11y.go_to_level', { max: sampleLevels.length }));
      // Not a level of the map
      await fireEvent.changeText(field(), String(sampleLevels.length + 1));
      expect(button(t('map.go_to_level_btn')).props.accessibilityState).toMatchObject({ disabled: true });

      await fireEvent.changeText(field(), '250');
      await press(t('map.go_to_level_btn'));
      // The sheet is closed, the map shows the level (locked: it is not opened) and the tools are back
      expect(screen.queryByText(t('map.go_to_level'))).toBeNull();
      expect(screen.getByLabelText(new RegExp(`^${t('a11y.level', { id: 250 })},`))).toBeTruthy();
      expect(button(t('map.filter_title'))).toBeTruthy();
    });

    it('goes on from a level typed during a search', async () => {
      await openMap();
      await press(t('map.filter_title'));
      await press(t('a11y.level_stars', { count: 2 }));
      await press(t('map.filter_show', { count: 2 }));
      await press(t('a11y.filter_edit'));
      await fireEvent.changeText(screen.getByLabelText(t('a11y.go_to_level', { max: sampleLevels.length })), '4');
      await press(t('map.go_to_level_btn'));
      // Level 4 has 3 stars: shown, out of the matches (levels 2 and 5)
      expect(screen.getByLabelText(t('a11y.filter_position', { id: 4, position: 0, total: 2 }))).toBeTruthy();
      await press(t('a11y.filter_next'));
      expect(screen.getByLabelText(t('a11y.filter_position', { id: 5, position: 2, total: 2 }))).toBeTruthy();
    });

    it('does not start a search that finds nothing', async () => {
      await openMap();
      await press(t('map.filter_title'));
      // No generated level yet
      await press(t('map.filter_sources.generated'));
      expect(button(t('map.filter_none')).props.accessibilityState).toMatchObject({ disabled: true });
    });
  });

  describe('level generator', () => {
    it('generates the number of levels typed, in the proportions chosen', async () => {
      await openMap();
      await press(t('map.level_generator'));
      await fireEvent.changeText(screen.getByLabelText(t('map.amount_label')), '20');
      // 1 part of Normal (the default) and 1 of Easy; 6x6 and 7x7
      await press(t('a11y.increase', { name: t('difficulty.EASY') }));
      await press(t('a11y.increase', { name: '7x7' }));
      await press(screen.getByText(/^(Generate|Générer|Generiši) 20 /).props.children);

      const plan = jest.mocked(startLevelGeneration).mock.calls[0][0];
      expect(plan.reduce((sum, b) => sum + b.count, 0)).toBe(20);
      expect(plan.filter(b => b.difficulty === 'EASY').reduce((sum, b) => sum + b.count, 0)).toBe(10);
      expect(plan.filter(b => b.gridSize === 7).reduce((sum, b) => sum + b.count, 0)).toBe(10);
      expect(new Set(plan.map(b => b.difficulty))).toEqual(new Set(['EASY', 'NORMAL']));
    });

    it('takes a minimum of moves per difficulty, for the difficulties being generated', async () => {
      await openMap();
      await press(t('map.level_generator'));
      const field = (difficulty: 'NORMAL' | 'HARD', min: number, max: number) =>
        t('a11y.min_moves', { name: t(`difficulty.${difficulty}`), min, max });
      // Only Normal is generated at first: no minimum to give for Hard
      expect(screen.queryByLabelText(field('HARD', 15, 25))).toBeNull();
      await press(t('a11y.increase', { name: t('difficulty.HARD') }));
      await fireEvent.changeText(screen.getByLabelText(field('HARD', 15, 25)), '20');
      await fireEvent.changeText(screen.getByLabelText(field('NORMAL', 10, 15)), '12');
      await fireEvent.changeText(screen.getByLabelText(t('map.amount_label')), '4');
      await press(screen.getByText(/^(Generate|Générer|Generiši) 4 /).props.children);
      expect(jest.mocked(startLevelGeneration).mock.calls[0][0]).toEqual([
        { difficulty: 'NORMAL', gridSize: 6, count: 2, minMoves: 12 },
        { difficulty: 'HARD', gridSize: 6, count: 2, minMoves: 20 },
      ]);
    });

    it('asks before a minimum of moves that makes the levels long to find', async () => {
      await openMap();
      await press(t('map.level_generator'));
      await press(t('a11y.increase', { name: t('difficulty.HARD') }));
      await press(t('a11y.decrease', { name: t('difficulty.NORMAL') }));
      // The most of Hard: never over it, and such levels are rare
      await fireEvent.changeText(screen.getByLabelText(t('a11y.min_moves', { name: t('difficulty.HARD'), min: 15, max: 25 })), '40');
      await press(screen.getByText(/^(Generate|Générer|Generiši) 3 /).props.children);
      expect(startLevelGeneration).not.toHaveBeenCalled();
      expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[1]).toContain(`${t('difficulty.HARD')} 6x6 (${t('map.min_moves_short', { count: 25 })})`);
    });

    it('opens from the padlock at the end of the map, and keeps one difficulty at least', async () => {
      useGameStore.setState({ maxUnlockedLevel: sampleLevels.length + 1, lastPlayedLevelId: null });
      await openMap();
      await press(t('a11y.map_end'));
      expect(screen.getByLabelText(t('map.amount_label')).props.value).toBe('3');
      expect(button(t('a11y.decrease', { name: t('difficulty.NORMAL') })).props.accessibilityState).toMatchObject({ disabled: true });
    });

    it('asks before a generation that can freeze the app', async () => {
      await openMap();
      await press(t('map.level_generator'));
      await press(t('a11y.increase', { name: t('difficulty.EXPERT') }));
      await press(screen.getByText(/^(Generate|Générer|Generiši) 3 /).props.children);
      expect(startLevelGeneration).not.toHaveBeenCalled();
      expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[0]).toBe(t('map.long_generation_title'));
      expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[1]).toContain(`${t('difficulty.EXPERT')} 6x6`);
    });
  });
});
