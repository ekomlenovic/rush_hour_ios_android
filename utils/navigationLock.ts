/** After a push or a back, the buttons of the same screen don't navigate again for this delay */
export const NAVIGATION_LOCK_MS = 500;

/**
 * Navigation lock of one screen. A push or a back is ignored when the screen is no longer the one
 * shown (the screen opened by the first tap is already there: on a slow Android phone, the second
 * tap only arrives after it) or when one just left from it (the second tap arrives before the new
 * screen is there). A button spammed opens the screen only once, back spammed leaves only one
 * screen, and the screen back on top navigates again at once.
 */
export class NavigationLock {
  private last = -Infinity;

  /** True when the navigation may go ahead */
  claim(isShown: boolean, now: number = Date.now()): boolean {
    if (!isShown || now - this.last < NAVIGATION_LOCK_MS) return false;
    this.last = now;
    return true;
  }
}
