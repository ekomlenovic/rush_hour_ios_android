import { NAVIGATION_LOCK_MS, NavigationLock } from '../utils/navigationLock';

describe('navigation lock', () => {
  it('opens a screen only once when its button is spammed', () => {
    const lock = new NavigationLock();
    expect(lock.claim(true, 1000)).toBe(true);
    // The new screen is not there yet
    expect(lock.claim(true, 1100)).toBe(false);
    // A slow Android phone: the second tap arrives once the new screen is there
    expect(lock.claim(false, 1000 + NAVIGATION_LOCK_MS * 4)).toBe(false);
  });

  it('navigates again at once when the screen is back on top', () => {
    const lock = new NavigationLock();
    expect(lock.claim(true, 1000)).toBe(true);
    expect(lock.claim(true, 1000 + NAVIGATION_LOCK_MS)).toBe(true);
  });

  it('keeps a lock per screen: the opened screen may go back on its own right away', () => {
    const home = new NavigationLock();
    const game = new NavigationLock();
    expect(home.claim(true, 1000)).toBe(true);
    expect(game.claim(true, 1250)).toBe(true);
  });
});
