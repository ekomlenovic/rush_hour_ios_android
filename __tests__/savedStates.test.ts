import { useGameStore } from '../store/gameStore';
import type { LevelSaveState } from '../store/types';
import { resetStore, setToday } from './helpers';

/** Games in progress are cleaned at each app open (#83): the past challenges never pile up */
const state = () => useGameStore.getState();
const save = (moveCount: number): LevelSaveState => ({ vehicles: [], moveCount, history: [] });

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('opening the app', () => {
  // Just after midnight and just before: the day and the week are the local ones
  it.each([0, 23])('keeps the games of today and this week, at %ih', hour => {
    setToday('2026-11-20', hour);
    useGameStore.setState({
      savedStates: {
        5: save(1),
        'daily-2026-11-20': save(2),
        'daily-2026-11-19': save(3),
        'weekly-2026-W47': save(4),
        'weekly-2026-W46': save(5),
        'archive-2026-10-14': save(6),
      },
    });
    state().recordAppOpen();
    expect(state().savedStates).toEqual({
      5: save(1),
      'daily-2026-11-20': save(2),
      // Yesterday's daily can no longer be played as such: it carries on in its archive
      'archive-2026-11-19': save(3),
      'weekly-2026-W47': save(4),
      'archive-2026-10-14': save(6),
    });
  });

  it('forgets the archives out of reach (more than 90 days ago)', () => {
    setToday('2027-02-01');
    useGameStore.setState({ savedStates: { 'archive-2026-10-14': save(1), 'archive-2026-12-01': save(2) } });
    state().recordAppOpen();
    expect(state().savedStates).toEqual({ 'archive-2026-12-01': save(2) });
  });
});
