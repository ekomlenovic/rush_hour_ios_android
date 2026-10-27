import { Alert, Platform, Share, type AlertButton, type AlertOptions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import i18n from './i18n';

/**
 * The web version (see docs/GAME_DESIGN.md, Version web) has no system alert nor share sheet:
 * react-native-web's Alert.alert does nothing and its Share.share needs navigator.share. The app
 * calls both everywhere, so they are replaced once, on the web only: the alerts are drawn by
 * WebDialogHost (components/web/WebDialogHost.tsx), a share without navigator.share copies the
 * message instead.
 */

export interface WebDialog {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  /** Escape or a click outside: the cancel button, when the dialog has one */
  cancelable: boolean;
  onDismiss?: () => void;
}

type Listener = (dialogs: WebDialog[]) => void;

let dialogs: WebDialog[] = [];
let nextId = 0;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach(listener => listener(dialogs));

/** Follows the dialogs waiting to be shown, the first one on screen: returns the unsubscribe */
export function subscribeWebDialogs(listener: Listener): () => void {
  listeners.add(listener);
  listener(dialogs);
  return () => { listeners.delete(listener); };
}

/** Closes a dialog, then runs the button touched (the next dialog it opens comes after) */
export function closeWebDialog(id: number, button?: AlertButton): void {
  const dialog = dialogs.find(d => d.id === id);
  dialogs = dialogs.filter(d => d.id !== id);
  emit();
  if (button) button.onPress?.();
  else dialog?.onDismiss?.();
}

/** Without the host (the root layout crashed), the browser's own dialogs */
function browserAlert(title: string, message: string | undefined, buttons: AlertButton[]) {
  const text = message ? `${title}\n\n${message}` : title;
  const cancel = buttons.find(b => b.style === 'cancel');
  const actions = buttons.filter(b => b !== cancel);
  if (actions.length <= 1 && !cancel) {
    window.alert(text);
    actions[0]?.onPress?.();
  } else {
    (window.confirm(text) ? actions[actions.length - 1] : cancel)?.onPress?.();
  }
}

export function showWebAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
  const shown = buttons?.length ? buttons : [{ text: i18n.t('common.ok') }];
  if (listeners.size === 0) {
    browserAlert(title, message, shown);
    return;
  }
  dialogs = [...dialogs, {
    id: nextId++,
    title,
    message,
    buttons: shown,
    cancelable: options?.cancelable ?? shown.some(b => b.style === 'cancel'),
    onDismiss: options?.onDismiss,
  }];
  emit();
}

type ShareContent = Parameters<typeof Share.share>[0];

/** navigator.share where the browser has it (phones), else the message is copied */
export async function shareOnWeb(content: ShareContent): Promise<{ action: string }> {
  const message = 'message' in content ? content.message : undefined;
  const url = 'url' in content ? content.url : undefined;
  const text = [message, url && !message?.includes(url) ? url : null].filter(Boolean).join('\n');
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: content.title ?? undefined, text });
      return { action: Share.sharedAction };
    } catch (error) {
      // Closed by the player: nothing shared, nothing to say
      if ((error as Error)?.name === 'AbortError') return { action: Share.dismissedAction };
    }
  }
  await Clipboard.setStringAsync(text);
  showWebAlert(i18n.t('web.share_copied_title'), i18n.t('web.share_copied_body'));
  return { action: Share.sharedAction };
}

if (Platform.OS === 'web') {
  Alert.alert = showWebAlert;
  Share.share = shareOnWeb as typeof Share.share;
}
