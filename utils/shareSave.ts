import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { saveFileName } from './saveTransfer';

/**
 * Shares a save code as a .rushsave file (share sheet of the system). Returns false when the
 * device cannot share files: the caller then copies the code instead (see docs/GAME_DESIGN.md, Sauvegarde).
 */
export async function shareSaveFile(code: string, dialogTitle: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    const file = new File(Paths.cache, saveFileName());
    file.create({ overwrite: true });
    file.write(code);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle });
    return true;
  } catch {
    return false;
  }
}

/** The text of a file picked with expo-document-picker (copied to the cache) */
export async function readPickedFile(asset: { uri: string }): Promise<string> {
  return new File(asset.uri).text();
}

/**
 * Shares a PNG image drawn by the app (recap), from its base64 data. Returns whether it went
 * out; throws when the device cannot share it.
 */
export async function sharePngFile(name: string, base64: string, dialogTitle: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
  return true;
}
