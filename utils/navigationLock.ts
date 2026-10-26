/** Time during which a second push or back is ignored: about one screen transition */
export const NAVIGATION_LOCK_MS = 500;

export type NavigationKind = 'push' | 'back';

let lastPush = -Infinity;
let lastBack = -Infinity;

/**
 * Claims the navigation: false when it would repeat one that started a moment ago. A button tapped
 * twice (or two buttons tapped together) during the transition opens the screen only once, and back
 * tapped twice leaves only one screen. A back right after a push stays allowed: a screen that
 * can't load goes back on its own as soon as it opens.
 */
export function claimNavigation(kind: NavigationKind, now: number = Date.now()): boolean {
  const last = kind === 'push' ? Math.max(lastPush, lastBack) : lastBack;
  if (now - last < NAVIGATION_LOCK_MS) return false;
  if (kind === 'push') lastPush = now;
  else lastBack = now;
  return true;
}

/** For the tests */
export function resetNavigationLock(): void {
  lastPush = -Infinity;
  lastBack = -Infinity;
}
