import './setup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/utils/i18n';
import { dateLocale } from '@/utils/date';
import StreakCalendar from '@/components/profile/StreakCalendar';
import { getUiColors } from '@/theme/ui';
import { resetStore } from '../helpers';

const mockPush = jest.fn();
jest.mock('@/hooks/useRouter', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }) }));

const todayCell = () => screen.getAllByRole('button').find(b => b.props.accessibilityHint === i18n.t('archives.today_hint'))!;

describe('streak calendar (issue 185)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
    mockPush.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('follows the clock: left open past midnight, today is the new day and opens its daily', async () => {
    jest.setSystemTime(new Date(2026, 9, 31, 23, 59, 30));
    await render(<StreakCalendar colors={getUiColors('light')} />);
    await fireEvent.press(todayCell());
    expect(mockPush).toHaveBeenLastCalledWith('/game?levelId=daily&date=2026-10-31');

    // The clock goes past midnight, into a new month: it shows up and today moves to it
    await act(async () => { jest.advanceTimersByTime(2 * 60_000); });
    const november = new Date(2026, 10, 1).toLocaleDateString(dateLocale(i18n.language), { month: 'long', year: 'numeric' });
    expect(screen.getByRole('header', { name: november })).toBeTruthy();
    await fireEvent.press(todayCell());
    expect(mockPush).toHaveBeenLastCalledWith('/game?levelId=daily&date=2026-11-01');
  });
});
