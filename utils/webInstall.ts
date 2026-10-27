import { Platform } from 'react-native';

/**
 * Installing the web version on the home screen (PWA, see docs/GAME_DESIGN.md, Version web).
 * The save lives in the browser's storage: Safari erases it after 7 days without a visit for a
 * site that is not on the home screen, so the home screen invites the player to install it
 * (InstallHint), and the page asks the browser to keep its storage (navigator.storage.persist).
 */

/** Chrome / Edge on Android and computers: the install prompt, kept for the Install button */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());

const DISMISSED_KEY = 'rush-hours-install-hint-dismissed';

export type InstallMode = 'ios' | 'prompt' | null;

/** Already opened from the home screen (or as an app) */
function isInstalled(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone and iPad (iPadOS says it is a Mac, with a touch screen) */
function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** How the game installs here: Safari's own menu on iOS, the browser's prompt elsewhere, or not at all */
export function installMode(): InstallMode {
  if (Platform.OS !== 'web' || isInstalled()) return null;
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return null;
  } catch {
    // No storage (private browsing): the hint shows, it cannot be remembered
  }
  if (isIos()) return 'ios';
  return installPrompt ? 'prompt' : null;
}

/** Follows the install prompt arriving (Chrome sends it a moment after the page loads) */
export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Shows the browser's install prompt */
export async function promptInstall(): Promise<void> {
  const prompt = installPrompt;
  if (!prompt) return;
  installPrompt = null;
  await prompt.prompt();
  await prompt.userChoice.catch(() => null);
  changed();
}

/** The player closed the hint: not shown again in this browser */
export function dismissInstallHint(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Not remembered: it shows again at the next visit
  }
  changed();
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    changed();
  });
  // Best effort: Chrome grants it to an installed or much used site, Safari to a home screen app
  navigator.storage?.persist?.().catch(() => {});
}
