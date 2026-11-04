import * as Clipboard from 'expo-clipboard';

/**
 * Puts a save code in the clipboard; false if the system refused it (issue 180). A year of play makes a
 * code of some 750 000 characters, and Android's clipboard goes through Binder (about 1 MB per call):
 * a refusal is told to the player, who can export a file instead, never a silent failure.
 */
export async function copySaveCode(code: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(code);
    return true;
  } catch (error) {
    console.warn('[save] code not copied', error);
    return false;
  }
}
