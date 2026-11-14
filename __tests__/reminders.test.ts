import type { TFunction } from 'i18next';
import { planReminders, ReminderInput } from '../utils/reminders';

const t = ((key: string, options?: Record<string, unknown>) => (options?.count !== undefined ? `${key}:${options.count}` : key)) as unknown as TFunction;

/** Tuesday 20 October 2026 at noon, before the 7 pm reminder */
const input = (over: Partial<ReminderInput> = {}): ReminderInput => ({
  now: new Date(2026, 9, 20, 12),
  reminderHour: 19,
  completedDailies: new Set<string>(),
  completedWeeklies: new Set<string>(),
  currentStreak: 0,
  missionsLeftToday: 3,
  ...over,
});

const today = (over: Partial<ReminderInput> = {}) => planReminders(t, input(over)).filter(r => r.date.getDate() === 20 && r.id.startsWith('daily-'));

describe('the daily reminder: one notification for the daily challenge and the missions', () => {
  it('both still to do: one reminder for both, that opens the daily challenge', () => {
    const reminders = today({ missionsLeftToday: 2 });
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({
      id: 'daily-2026-10-20', title: 'reminders.daily_missions_title', body: 'reminders.daily_missions_body', url: '/game?levelId=daily',
    });
    expect(reminders[0].date).toEqual(new Date(2026, 9, 20, 19));
  });

  it('missions done, daily still to do: the daily challenge only', () => {
    expect(today({ missionsLeftToday: 0 })).toMatchObject([
      { id: 'daily-2026-10-20', title: 'reminders.daily_title', body: 'reminders.daily_body', url: '/game?levelId=daily' },
    ]);
  });

  it('daily done, missions still to do: the missions only, with how many are left, opening the app as it was left', () => {
    const reminders = today({ completedDailies: new Set(['2026-10-20']), missionsLeftToday: 2 });
    expect(reminders).toMatchObject([{ id: 'daily-2026-10-20', title: 'reminders.missions_title', body: 'reminders.missions_body:2' }]);
    expect(reminders[0].url).toBeUndefined();
  });

  it('both done: no reminder today', () => {
    expect(today({ completedDailies: new Set(['2026-10-20']), missionsLeftToday: 0 })).toEqual([]);
  });

  it('the days ahead, nothing started yet: both, whatever is done today', () => {
    const reminders = planReminders(t, input({ completedDailies: new Set(['2026-10-20']), missionsLeftToday: 0 }))
      .filter(r => r.id.startsWith('daily-'));
    expect(reminders).toHaveLength(6);
    expect(reminders.every(r => r.title === 'reminders.daily_missions_title')).toBe(true);
  });

  it('missions left out (old callers): counted as not started', () => {
    expect(today({ missionsLeftToday: undefined })[0].title).toBe('reminders.daily_missions_title');
  });
});
