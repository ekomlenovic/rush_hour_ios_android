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
