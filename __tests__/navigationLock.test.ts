import { claimNavigation, NAVIGATION_LOCK_MS, resetNavigationLock } from '../utils/navigationLock';

describe('navigation lock', () => {
  beforeEach(resetNavigationLock);

  it('opens a screen only once when its button is spammed', () => {
    expect(claimNavigation('push', 1000)).toBe(true);
    expect(claimNavigation('push', 1100)).toBe(false);
    expect(claimNavigation('push', 1000 + NAVIGATION_LOCK_MS - 1)).toBe(false);
    expect(claimNavigation('push', 1000 + NAVIGATION_LOCK_MS)).toBe(true);
  });

  it('leaves only one screen when back is spammed', () => {
    expect(claimNavigation('back', 1000)).toBe(true);
    expect(claimNavigation('back', 1200)).toBe(false);
    expect(claimNavigation('back', 2000)).toBe(true);
  });

  it('lets a screen go back on its own right after opening', () => {
    expect(claimNavigation('push', 1000)).toBe(true);
    expect(claimNavigation('back', 1250)).toBe(true);
  });

  it('ignores a push during the transition of a back', () => {
    expect(claimNavigation('back', 1000)).toBe(true);
    expect(claimNavigation('push', 1100)).toBe(false);
  });
});
