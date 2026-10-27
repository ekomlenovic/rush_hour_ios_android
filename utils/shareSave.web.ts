import { saveFileName } from './saveTransfer';

/**
 * Web version of shareSaveFile (utils/shareSave.ts): the .rushsave file is downloaded, the
 * browser has no share sheet for files. Returns false when the download cannot start: the
 * caller then copies the code instead (see docs/GAME_DESIGN.md, Sauvegarde).
 */
export async function shareSaveFile(code: string, _dialogTitle: string): Promise<boolean> {
  try {
    downloadFile(saveFileName(), new Blob([code], { type: 'text/plain' }));
    return true;
  } catch {
    return false;
  }
}

/** Starts the download of a file made by the page */
export function downloadFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked later: Safari reads the file after the click returns
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The text of a file picked with expo-document-picker: on the web, the browser's File */
export async function readPickedFile(asset: { uri: string; file?: Blob }): Promise<string> {
  if (asset.file) return asset.file.text();
  return (await fetch(asset.uri)).text();
}

/**
 * Web version of sharePngFile: the share sheet of the phone when the browser can send files
 * (navigator.share), else the image is downloaded. Returns whether it went out.
 */
export async function sharePngFile(name: string, base64: string, _dialogTitle: string): Promise<boolean> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const file = new File([bytes], name, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return false;
    }
  }
  downloadFile(name, file);
  return true;
}
