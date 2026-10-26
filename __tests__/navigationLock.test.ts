import { NAVIGATION_FALLBACK_MS, NavigationLock } from '../utils/navigationLock';

describe('navigation lock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('opens a screen only once when its button is spammed, however slow the transition', () => {
    const lock = new NavigationLock();
    expect(lock.claim()).toBe(true);
    expect(lock.claim()).toBe(false);
    lock.blurred();
    // A slow Android device: the second tap arrives long after the first one
    jest.advanceTimersByTime(NAVIGATION_FALLBACK_MS * 3);
    expect(lock.claim()).toBe(false);
  });

  it('navigates again once the screen is shown again', () => {
    const lock = new NavigationLock();
    expect(lock.claim()).toBe(true);
    lock.blurred();
    lock.focused();
    expect(lock.claim()).toBe(true);
  });

  it('frees the buttons when the navigation did not leave the screen', () => {
    const lock = new NavigationLock();
    expect(lock.claim()).toBe(true);
    jest.advanceTimersByTime(NAVIGATION_FALLBACK_MS - 1);
    expect(lock.claim()).toBe(false);
    jest.advanceTimersByTime(1);
    expect(lock.claim()).toBe(true);
  });

  it('keeps a lock per screen: the opened screen may go back on its own right away', () => {
    const home = new NavigationLock();
    const game = new NavigationLock();
    expect(home.claim()).toBe(true);
    expect(game.claim()).toBe(true);
  });
});
