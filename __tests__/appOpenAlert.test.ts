import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import i18n from '../utils/i18n';
import { useGameStore, whenSaveLoaded } from '../store/gameStore';
import { useAppOpenAlert } from '../hooks/useAppOpenAlert';
import { useOpenDaily } from '../hooks/useOpenDaily';
import { addDays } from '../utils/date';
import { resetStore, setToday, winDaily } from './helpers';

// Level-up rewards also give freezes: tested in progression.test.ts, kept out of the streak rules here
jest.mock('../data/progression', () => ({ ...jest.requireActual('../data/progression'), getPlayerLevel: () => 1 }));

const state = () => useGameStore.getState();

/** The home screen, kept mounted under the others: `today` follows the clock (useNow) */
function Home({ today }: { today: string }) {
  useAppOpenAlert(today);
  return null;
}

/** The game screen on a daily: app/game.tsx gives its day while it is loaded and not won, null otherwise */
function Game({ daily }: { daily: string | null }) {
  useOpenDaily(daily);
  return null;
}

/** The home screen, with the game screen on top of it while `daily` is given */
const screens = (today: string, daily?: string | null) => React.createElement(React.Fragment, null,
  React.createElement(Home, { today }),
  daily !== undefined && React.createElement(Game, { daily }),
);

let renderer: ReactTestRenderer | null = null;
let alert: jest.SpyInstance;

/** Renders, then lets the app open be recorded (on the loaded save) and its alert show */
async function show(element: React.ReactElement) {
  await act(async () => {
    if (renderer) renderer.update(element);
    else renderer = create(element);
  });
  act(() => { jest.advanceTimersByTime(500); });
}

/** Streak of 5 up to 10-19, then the daily of 10-20 open on the game screen, still there at midnight */
async function openPastMidnight(freezes: number) {
  for (let i = 0; i < 5; i++) winDaily(addDays('2026-10-15', i));
  useGameStore.setState({ streakFreezes: freezes });
  setToday('2026-10-20', 23);
  await show(screens('2026-10-20', '2026-10-20'));
  // The home screen under the game moves to the new day
  setToday('2026-10-21', 0);
  await show(screens('2026-10-21', '2026-10-20'));
}

beforeAll(async () => {
  await whenSaveLoaded();
});

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  alert.mockRestore();
  jest.useRealTimers();
});

describe('the home screen under a daily left open past midnight', () => {
  it('alerts nothing at midnight nor once it is won, and uses no freeze', async () => {
    await openPastMidnight(1);
    expect(alert).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ currentStreak: 5, streakFreezes: 1 });

    act(() => { state().completeDailyChallenge('2026-10-20', 300, 3); });
    // Won: the game screen no longer gives its day, then is closed
    await show(screens('2026-10-21', null));
    await show(screens('2026-10-21'));
    expect(alert).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ currentStreak: 6, streakFreezes: 1, frozenDates: [] });
  });

  it('closed without a win, alerts the lost streak right away', async () => {
    await openPastMidnight(0);
    expect(alert).not.toHaveBeenCalled();
    await show(screens('2026-10-21'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('🔥', i18n.t('home.streak_lost', { count: 5 }));
    expect(state().currentStreak).toBe(0);
  });

  it('closed without a win, a freeze covers its day', async () => {
    await openPastMidnight(1);
    expect(alert).not.toHaveBeenCalled();
    await show(screens('2026-10-21'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('❄️', i18n.t('home.freeze_used', { count: 1, streak: 5 }));
    expect(state()).toMatchObject({ currentStreak: 5, streakFreezes: 0, frozenDates: ['2026-10-20'] });
  });
});

describe('the game screen on a daily', () => {
  it('gives its day to the store while open, until won or closed', async () => {
    setToday('2026-10-20');
    await show(React.createElement(Game, { daily: '2026-10-20' }));
    expect(state().openDailyDate).toBe('2026-10-20');
    await show(React.createElement(Game, { daily: null }));
    expect(state().openDailyDate).toBeNull();

    await show(React.createElement(Game, { daily: '2026-10-20' }));
    act(() => renderer!.unmount());
    renderer = null;
    expect(state().openDailyDate).toBeNull();
  });
});

describe('launched by the widget, the game screen alone (issue 188)', () => {
  /** The root layout records the open, whatever the first screen: here the game screen alone */
  const launch = (today: string, daily: string | null) => React.createElement(React.Fragment, null,
    React.createElement(Home, { today }),
    React.createElement(Game, { daily }),
  );

  /** A cold launch on the daily of the day, won, then the app left without the home screen */
  async function dailyFromWidget(day: string) {
    setToday(day);
    await show(launch(day, day));
    act(() => { state().completeDailyChallenge(day, 300, 3); });
    await show(launch(day, null));
    act(() => renderer!.unmount());
    renderer = null;
  }

  it('records each open: no false welcome back, the freeze is announced once, at the open that sees it', async () => {
    setToday('2026-10-14');
    await show(screens('2026-10-14'));
    act(() => { state().completeDailyChallenge('2026-10-14', 300, 3); });
    useGameStore.setState({ streakFreezes: 1 });
    act(() => renderer!.unmount());
    renderer = null;

    // The 15th skipped; the 16th and the 17th won from the widget
    await dailyFromWidget('2026-10-16');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('❄️', i18n.t('home.freeze_used', { count: 1, streak: 1 }));
    expect(state().lastOpenDate).toBe('2026-10-16');
    await dailyFromWidget('2026-10-17');

    // The home screen at last
    setToday('2026-10-17', 20);
    await show(screens('2026-10-17'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalledWith(i18n.t('home.welcome_back'), expect.anything());
    expect(state()).toMatchObject({ currentStreak: 3, streakFreezes: 0, frozenDates: ['2026-10-15'], lastOpenDate: '2026-10-17' });
    expect(state().stats.longestAbsenceDays).toBe(2);
  });
});
