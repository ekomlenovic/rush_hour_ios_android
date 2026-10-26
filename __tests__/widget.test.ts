import fs from 'fs';
import path from 'path';
import i18next, { TFunction } from 'i18next';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import { useGameStore } from '../store/gameStore';
import { addDays, getLocalDateString } from '../utils/date';
import { todayDailyHref } from '../utils/challengeDates';
import { buildWidgetData, widgetDayFor, widgetExtra, widgetInput, WIDGET_DAILY_LINK, WIDGET_DATA_VERSION } from '../utils/widget';
import { resetStore, setToday, winDaily } from './helpers';

// Level-up rewards also give freezes: kept out of the comparison with the app open
const mockPlayer = { level: 1 };
jest.mock('../data/progression', () => ({ ...jest.requireActual('../data/progression'), getPlayerLevel: () => mockPlayer.level }));

const i18n = i18next.createInstance();
let t: TFunction;
beforeAll(async () => {
  await i18n.init({ lng: 'fr', resources: { fr: { translation: fr }, en: { translation: en } }, interpolation: { escapeValue: false } });
  t = i18n.t;
});

beforeEach(() => {
  jest.useFakeTimers();
  resetStore();
  mockPlayer.level = 1;
});

afterEach(() => {
  jest.useRealTimers();
});

const state = () => useGameStore.getState();
const widgetData = (now = new Date(), translate: TFunction = t) => buildWidgetData(translate, widgetInput(state(), now));
const shown = (date: string, now = new Date()) => {
  const day = widgetDayFor(widgetData(now), date);
  return { streak: day.streak, freezes: day.freezes, done: day.done, stars: day.stars };
};

describe('home screen widget (rules in docs/GAME_DESIGN.md, issue 151)', () => {
  it('shows the streak, the freezes and the daily to do, read in one go', () => {
    useGameStore.setState({ currentStreak: 12, lastStreakDate: '2026-10-20', streakFreezes: 2 });
    setToday('2026-10-21');
    const data = widgetData();
    const today = widgetDayFor(data, '2026-10-21');

    expect(today).toMatchObject({ streak: 12, freezes: 2, done: false, stars: 0, unit: 'jours de streak', status: 'À faire' });
    expect(today.label).toBe('Streak de 12 jours, 2 gels, défi du jour à faire');
    expect(data.capacity).toBe(2);
    expect(data.texts.daily).toBe('Défi du jour');
  });

  it('says "Fait" with the stars once the daily is won, and "à faire" again at midnight without the app', () => {
    winDaily('2026-10-20');
    winDaily('2026-10-21', 2);
    const lateEvening = new Date(2026, 9, 21, 23, 59);
    const data = widgetData(lateEvening);

    const today = widgetDayFor(data, getLocalDateString(lateEvening));
    expect(today).toMatchObject({ streak: 2, done: true, stars: 2, status: 'Fait' });
    expect(today.label).toBe('Streak de 2 jours, 0 gel, défi du jour fait, 2 étoiles');

    // The widget picks its entry from its own date: no "done" flag left over from yesterday
    const tomorrow = widgetDayFor(data, getLocalDateString(new Date(2026, 9, 22, 0, 0)));
    expect(tomorrow).toMatchObject({ date: '2026-10-22', streak: 2, done: false, stars: 0, status: 'À faire' });
  });

  it('uses the freezes day after day, then shows a lost streak at 0 with its freezes kept', () => {
    useGameStore.setState({ currentStreak: 5, lastStreakDate: '2026-10-20', streakFreezes: 2 });
    setToday('2026-10-21');
    const data = widgetData();

    expect(data.days.map(d => [d.date, d.streak, d.freezes])).toEqual([
      ['2026-10-21', 5, 2],
      ['2026-10-22', 5, 1],
      ['2026-10-23', 5, 0],
      ['2026-10-24', 0, 2],
    ]);
    // Nothing changes any more: a later date shows the last entry
    expect(widgetDayFor(data, '2026-12-25')).toMatchObject({ streak: 0, freezes: 2, done: false });
  });

  // The widget never shows a streak the app shows at 0 (settleStreak at the app open)
  it.each([
    ['played yesterday, no freeze', { currentStreak: 4, lastStreakDate: '2026-10-20', streakFreezes: 0 }, 1],
    ['played yesterday, 2 freezes', { currentStreak: 9, lastStreakDate: '2026-10-20', streakFreezes: 2 }, 1],
    ['6 freezes, the most a player can have', { currentStreak: 40, lastStreakDate: '2026-10-20', streakFreezes: 6 }, 30],
    ['already 2 days missed', { currentStreak: 7, lastStreakDate: '2026-10-18', streakFreezes: 3 }, 10],
    ['no streak yet', { currentStreak: 0, lastStreakDate: null, streakFreezes: 2 }, 1],
    ['a save made ahead in time', { currentStreak: 3, lastStreakDate: '2026-10-22', streakFreezes: 1 }, 1],
  ])('agrees with the app on every day to come: %s', (_, saved, level) => {
    mockPlayer.level = level;
    useGameStore.setState(saved);
    setToday('2026-10-21');
    const data = widgetData();
    const base = { ...state() };

    for (let i = 0; i < 15; i++) {
      const date = addDays('2026-10-21', i);
      useGameStore.setState(base, true);
      setToday(date);
      state().recordAppOpen();
      expect([date, state().currentStreak, state().streakFreezes]).toEqual([
        date, widgetDayFor(data, date).streak, widgetDayFor(data, date).freezes,
      ]);
    }
    expect(data.days.length).toBeLessThanOrEqual(10);
  });

  it('shows the day as missed while its daily is left open in the app past midnight: the app shows the same once it is closed without the win', () => {
    useGameStore.setState({ currentStreak: 4, lastStreakDate: '2026-10-19', streakFreezes: 0 });
    setToday('2026-10-21', 0);
    // The widget cannot know whether the app is still open: it never shows a streak the app may show at 0
    state().setOpenDailyDate('2026-10-20');
    expect(shown('2026-10-21').streak).toBe(0);

    state().setOpenDailyDate(null);
    state().recordAppOpen();
    expect(state().currentStreak).toBe(0);
  });

  it('shows the streak going on as soon as that daily is won after midnight', () => {
    useGameStore.setState({ currentStreak: 4, lastStreakDate: '2026-10-19', streakFreezes: 0 });
    setToday('2026-10-21', 0);
    state().setOpenDailyDate('2026-10-20');
    state().completeDailyChallenge('2026-10-20', 300, 3);
    expect(shown('2026-10-21')).toEqual({ streak: 5, freezes: 0, done: false, stars: 0 });
  });

  it('shows a streak never started at 0, with the daily to do', () => {
    setToday('2026-10-21');
    expect(shown('2026-10-21')).toEqual({ streak: 0, freezes: 0, done: false, stars: 0 });
  });

  it('has as many freeze slots as the player level gives', () => {
    mockPlayer.level = 20;
    setToday('2026-10-21');
    expect(widgetData().capacity).toBe(5);
  });

  it('switches day at local midnight in every time zone, also across a daylight saving change', () => {
    // Paris leaves summer time on October 25th, New York on November 1st
    mockPlayer.level = 30;
    useGameStore.setState({ currentStreak: 20, lastStreakDate: '2026-10-24', streakFreezes: 6 });
    setToday('2026-10-25');
    const data = widgetData();

    data.days.forEach((day, i) => {
      expect(day.date).toBe(addDays('2026-10-25', i));
      expect(widgetDayFor(data, getLocalDateString(new Date(2026, 9, 25 + i, 0, 0, 0)))).toBe(day);
      expect(widgetDayFor(data, getLocalDateString(new Date(2026, 9, 25 + i, 23, 59, 59)))).toBe(day);
    });
    expect(data.days.map(d => d.date)).toEqual(expect.arrayContaining(['2026-10-25', '2026-11-01']));
  });

  it('medium widget: countdown once done, "streak en danger" in the evening, "touche pour jouer" otherwise', () => {
    useGameStore.setState({ currentStreak: 3, lastStreakDate: '2026-10-20', streakFreezes: 0, reminderHour: 19 });
    setToday('2026-10-21');
    const data = widgetData();

    expect(data.dangerHour).toBe(21); // as the "streak en danger" reminder
    expect(widgetExtra(data, new Date(2026, 9, 21, 12))).toBe('play');
    expect(widgetExtra(data, new Date(2026, 9, 21, 20, 59))).toBe('play');
    expect(widgetExtra(data, new Date(2026, 9, 21, 21))).toBe('danger');

    winDaily('2026-10-21');
    expect(widgetExtra(widgetData(), new Date(2026, 9, 21, 22))).toBe('next');
    // Next day, not played yet: in danger again in the evening
    expect(widgetExtra(widgetData(), new Date(2026, 9, 22, 22))).toBe('danger');
  });

  it('never says "streak en danger" without a streak, and follows the reminder hour', () => {
    useGameStore.setState({ reminderHour: 22 });
    setToday('2026-10-21');
    expect(widgetExtra(widgetData(), new Date(2026, 9, 21, 23, 30))).toBe('play');
    expect(widgetData().dangerHour).toBe(23);
  });

  it('opens today\'s daily: the link has no date, the app adds the date of the opening', () => {
    setToday('2026-10-21');
    expect(widgetData().link).toBe(WIDGET_DAILY_LINK);
    expect(WIDGET_DAILY_LINK).not.toContain('date=');
    expect(todayDailyHref(new Date(2026, 9, 22, 0, 1))).toBe('/game?levelId=daily&date=2026-10-22');
  });

  it('is written in the language of the app', () => {
    useGameStore.setState({ currentStreak: 1, lastStreakDate: '2026-10-21', streakFreezes: 1 });
    useGameStore.setState({ dailyChallengeProgress: { '2026-10-21': { completed: true, score: 100, stars: 1 } } });
    setToday('2026-10-21');
    const data = widgetData(new Date(), i18n.getFixedT('en'));

    expect(widgetDayFor(data, '2026-10-21')).toMatchObject({ unit: 'day streak', status: 'Done' });
    expect(widgetDayFor(data, '2026-10-21').label).toBe('1-day streak, 1 freeze, daily challenge done, 1 star');
    expect(data.texts).toEqual({
      daily: 'Daily challenge',
      nextIn: 'Next challenge in',
      danger: 'Streak in danger',
      timeLeft: 'Time left',
      play: 'Tap to play',
    });
  });
});

// The widgets are native: what they share with the app is checked here, they cannot be run in the tests
describe('native widgets', () => {
  const read = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const ANDROID = 'modules/rush-widget/android/src/main/java/expo/modules/rushwidget';

  it('read the data format and the key the app writes', () => {
    expect(read('targets/widget/WidgetData.swift')).toContain(`static let currentVersion = ${WIDGET_DATA_VERSION}`);
    expect(read(`${ANDROID}/WidgetData.kt`)).toContain(`private const val VERSION = ${WIDGET_DATA_VERSION}`);
    expect(read('targets/widget/WidgetData.swift')).toContain('static let dataKey = "widgetData"');
    expect(read('modules/rush-widget/ios/RushWidgetModule.swift')).toContain('static let dataKey = "widgetData"');
  });

  it('use the same app group in the app and in the iOS widget (SideStore renames it)', () => {
    expect(read('targets/widget/RushAppGroup.swift')).toBe(read('modules/rush-widget/ios/RushAppGroup.swift'));
  });

  it('open the same dateless link when the app has written nothing', () => {
    expect(read(`${ANDROID}/StreakWidgets.kt`)).toContain(`DAILY_LINK = "${WIDGET_DAILY_LINK}"`);
    expect(read('targets/widget/WidgetData.swift')).toContain(`link: "${WIDGET_DAILY_LINK}"`);
  });
});
