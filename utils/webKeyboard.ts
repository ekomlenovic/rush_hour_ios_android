import { BackHandler, Platform } from 'react-native';

/**
 * Escape in the web version (see docs/GAME_DESIGN.md, Version web): the back button of Android.
 * A modal (sheet, alert, win screen) closes itself on Escape (onRequestClose, the Modal of
 * react-native-web); otherwise the screen's back handlers run (BackHandler, which does nothing on
 * the web: replaced here, e.g. the achievement panel of the profile), then the previous screen.
 */

type Handler = () => boolean | null | undefined;

const handlers: Handler[] = [];

/** A modal of react-native-web is open: a portal child of body, next to #root, with content */
const isModalOpen = () => document.querySelector('body > div:not(#root) > *') !== null;

/** Listens to Escape; goBack is called when nothing on the screen took it. Returns the unsubscribe */
export function listenToEscape(goBack: () => void): () => void {
  if (Platform.OS !== 'web') return () => {};
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || isModalOpen()) return;
    // The last handler added first, like Android
    for (const handler of [...handlers].reverse()) if (handler()) return;
    goBack();
  };
  document.addEventListener('keyup', onKeyUp);
  return () => document.removeEventListener('keyup', onKeyUp);
}

if (Platform.OS === 'web') {
  BackHandler.addEventListener = ((_event: string, handler: Handler) => {
    handlers.push(handler);
    return { remove: () => { const i = handlers.lastIndexOf(handler); if (i >= 0) handlers.splice(i, 1); } };
  }) as typeof BackHandler.addEventListener;
}
