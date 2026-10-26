/** Without leaving its screen, a navigation no longer blocks its buttons after this delay */
export const NAVIGATION_FALLBACK_MS = 1500;

/**
 * Navigation lock of one screen: after a push or a back, its buttons no longer navigate until the
 * screen is shown again. A button spammed during the transition opens the screen only once, and
 * back spammed leaves only one screen, however slow the transition (a delay was not enough on
 * Android: the second tap could arrive after it). A navigation that did not leave the screen (a
 * back stopped by "unsaved changes") frees the buttons after NAVIGATION_FALLBACK_MS.
 */
export class NavigationLock {
  private locked = false;
  private left = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** True when the navigation may go ahead; the following ones are then ignored */
  claim(): boolean {
    if (this.locked) return false;
    this.locked = true;
    this.left = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.left) this.locked = false;
    }, NAVIGATION_FALLBACK_MS);
    return true;
  }

  /** The screen is covered by another one or is leaving: locked until it is shown again */
  blurred(): void {
    this.left = true;
  }

  /** The screen is shown again: its buttons navigate */
  focused(): void {
    clearTimeout(this.timer);
    this.locked = false;
    this.left = false;
  }
}
