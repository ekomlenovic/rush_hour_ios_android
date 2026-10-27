import './setup';
import { AccessibilityInfo, Alert } from 'react-native';
import { renderRouter, screen, fireEvent, waitFor } from 'expo-router/testing-library';
import i18n from '@/utils/i18n';
import CreatorScreen from '@/app/creator';
import { useGameStore, type Level } from '@/store/gameStore';
import { TARGET_CAR_COLOR } from '@/theme';
import { resetStore } from '../helpers';

// The check runs on the solver thread in the app; here, on the test thread (the solver has its own tests)
jest.mock('@/utils/solver.background', () => {
  const { validateLevel } = jest.requireActual('@/utils/solver');
  return { validateLevelAsync: async (...args: Parameters<typeof validateLevel>) => validateLevel(...args) };
});

/** A created level whose target car is stuck behind a car on its own row: no solution */
const STUCK: Level = {
  id: 1_700_000_000_000, gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 0, updatedAt: 0,
  vehicles: [
    { id: 'target', row: 2, col: 0, length: 2, orientation: 'horizontal', isTarget: true, color: TARGET_CAR_COLOR },
    { id: 'v1', row: 2, col: 4, length: 2, orientation: 'horizontal', isTarget: false, color: '#10B981' },
  ],
};

const openCreator = async (url = '/creator') => {
  await renderRouter({ _layout: require('@/app/_layout'), creator: CreatorScreen }, { initialUrl: url });
  await waitFor(() => expect(screen.getByLabelText(i18n.t('a11y.target_car'))).toBeTruthy());
};

/** The last alert shown: [title, message] */
const lastAlert = () => jest.mocked(Alert.alert).mock.calls.at(-1)?.slice(0, 2);

describe('level creator', () => {
  beforeEach(() => {
    resetStore();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });

  it('a new level starts with the target car alone, and a vehicle can be added without dragging', async () => {
    await openCreator();
    expect(screen.getByRole('header', { name: i18n.t('creator.title') })).toBeTruthy();
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const truckA = new RegExp(`^${escape(i18n.t('a11y.truck', { letter: 'A', color: '@' })).replace('@', '.+')}$`);
    expect(screen.queryAllByLabelText(truckA)).toHaveLength(0);

    // "Add to the board" on the vertical truck of the toolbox: the first free cell
    const truck = screen.getAllByRole('button').find(el =>
      String(el.props.accessibilityLabel).startsWith(`${i18n.t('creator.truck')}, ${i18n.t('a11y.vertical')}`))!;
    await fireEvent(truck, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });

    expect(screen.getAllByLabelText(truckA)).toHaveLength(1);
    expect(jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.at(-1)?.[0])
      .toMatch(new RegExp(truckA.source.slice(1, -1)));
  });

  it('Test: says how many moves a solvable level takes', async () => {
    await openCreator();
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('creator.test') }));
    await waitFor(() => expect(lastAlert()).toEqual([i18n.t('creator.solvable_title'), i18n.t('creator.solvable_desc', { count: 1 })]));
  });

  it('a level without solution: Test says so, and it cannot be saved', async () => {
    useGameStore.setState({ createdLevels: [STUCK] });
    await openCreator(`/creator?levelId=${STUCK.id}`);

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('creator.test') }));
    await waitFor(() => expect(lastAlert()).toEqual([i18n.t('creator.unsolvable_title'), i18n.t('creator.unsolvable_desc')]));

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('creator.save') }));
    await waitFor(() => expect(lastAlert()).toEqual([i18n.t('creator.unsolvable_title'), i18n.t('creator.fix_before_save')]));
    expect(screen.queryByLabelText(i18n.t('custom_levels.name_label'))).toBeNull();
    expect(useGameStore.getState().createdLevels).toEqual([STUCK]);
  });

  it('Save: checked, named, then kept in the created levels with its optimum', async () => {
    await openCreator();
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('creator.save') }));

    const input = await screen.findByLabelText(i18n.t('custom_levels.name_label'));
    await fireEvent.changeText(input, '  Sortie express ');
    // The sheet's button, under the creator's own Save
    await fireEvent.press(screen.getAllByRole('button', { name: i18n.t('custom_levels.save_name') }).at(-1)!);

    const [level] = useGameStore.getState().createdLevels;
    expect(level).toMatchObject({ gridSize: 6, exitRow: 2, exitCol: 6, minMoves: 1, name: 'Sortie express' });
    expect(level.vehicles).toEqual([
      { id: 'target', row: 2, col: 0, length: 2, orientation: 'horizontal', isTarget: true, color: TARGET_CAR_COLOR },
    ]);
    await waitFor(() => expect(lastAlert()).toEqual([i18n.t('common.saved'), i18n.t('creator.level_updated')]));
  });
});
