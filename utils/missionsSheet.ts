/**
 * Lets the "mission completed" toast (root layout) open the missions sheet of the screen under it.
 * Only the game screen registers: elsewhere, touching the toast just closes it.
 */
let opener: (() => void) | null = null;

/** The screen on top offers its missions sheet; returns the cleanup */
export function registerMissionsSheet(open: () => void): () => void {
  opener = open;
  return () => {
    if (opener === open) opener = null;
  };
}

export const canOpenMissionsSheet = (): boolean => opener !== null;

/** Opens the missions sheet of the current screen; false when it has none */
export function openMissionsSheet(): boolean {
  if (!opener) return false;
  opener();
  return true;
}
