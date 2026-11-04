import { getPlayGames, type RushPlayGamesModule } from '../modules/rush-play-games';
import { useGameStore, whenSaveLoaded, type LevelProgress } from '../store/gameStore';
import { useCloudSyncStore, whenCloudSettingsLoaded, type CloudSyncStatus } from '../store/cloudSyncStore';
import { getPlayerLevel } from '../data/progression';
import { canTransferSave, exportProgress, parseSave, transferableState } from './saveTransfer';
import { hasNotPlayed, isSameSave, mergeSaves } from './cloudMerge';
import i18n from './i18n';

/**
 * Automatic sync of the progress with the Saved Games of Play Jeux (issue 320, see
 * docs/GAME_DESIGN.md, « Synchro automatique (Play Jeux) »). Android installed from Google Play only:
 * anywhere else `getPlayGames()` is null and nothing happens; the export / import stays the way to
 * move a save everywhere else and between platforms.
 *
 * One sync: the cloud save is read (every version of it after a conflict), each one goes through the
 * checks of an import (`parseSave`: migrations, consistency), is merged into this phone's progress
 * (`mergeSaves`, nothing earned on either side is lost), and the merged progress is written back,
 * in the same code as a .rushsave. Nothing is written over a cloud save this version cannot read
 * (a newer version of the game), nor before this phone's save is loaded.
 */

/** Name of the snapshot in Saved Games: never renamed (the saves already in the cloud are under it) */
export const SNAPSHOT_NAME = 'rush-hours-progress';

export type SyncReason = 'launch' | 'foreground' | 'background' | 'win' | 'manual';

let running: Promise<CloudSyncStatus> | null = null;
let queued = false;

/** Whether the sync can run on this phone (the Sauvegarde section shows it only then) */
export const isCloudSyncAvailable = (): boolean => getPlayGames() !== null;

/**
 * Syncs now; a sync asked while one runs is done once more after it (it would read the state
 * before the change that asked for it). Never throws: the result is also in useCloudSyncStore.
 */
export function syncProgress(reason: SyncReason, playGames: RushPlayGamesModule | null = getPlayGames()): Promise<CloudSyncStatus> {
  if (running) {
    queued = true;
    return running;
  }
  running = (async () => {
    let status = await syncOnce(reason, playGames);
    while (queued) {
      queued = false;
      status = await syncOnce(reason, playGames);
    }
    return status;
  })().finally(() => { running = null; });
  return running;
}

async function syncOnce(reason: SyncReason, playGames: RushPlayGamesModule | null): Promise<CloudSyncStatus> {
  if (!playGames) return 'idle';
  await whenCloudSettingsLoaded();
  const settings = useCloudSyncStore.getState();
  if (!settings.enabled && reason !== 'manual') return settings.status;
  // Never before this phone's save is read back (an empty state would be merged and written), nor after it failed to
  await whenSaveLoaded();
  if (!canTransferSave()) return settings.status;

  settings.setStatus('syncing');
  const status = await exchange(playGames).catch((error: { code?: string }) => {
    console.warn('[cloudSync] sync failed', error);
    return (error?.code === 'too_big' ? 'too_big' : 'failed') as CloudSyncStatus;
  });
  if (status === 'synced') useCloudSyncStore.getState().markSynced(Date.now());
  else useCloudSyncStore.getState().setStatus(status);
  return status;
}

async function exchange(playGames: RushPlayGamesModule): Promise<CloudSyncStatus> {
  // Play Jeux signs the player in by itself: signed out, nothing is sent (no account is ever required)
  if (!(await playGames.isSignedIn())) return 'signed_out';

  const { handle, contents } = await playGames.open(SNAPSHOT_NAME);
  let committed = false;
  try {
    const remotes: Record<string, unknown>[] = [];
    let blocked: CloudSyncStatus | null = null;
    for (const code of contents) {
      const result = parseSave(code);
      if (result.ok) remotes.push(result.state);
      // A save this version cannot read is kept as is: a newer version of the game made it, or a phone
      // whose date is ahead. An unreadable or broken one is of use to no one: it is written over
      else if (result.error === 'too_new') blocked = 'remote_newer';
      else if (result.error === 'inconsistent') blocked ??= 'failed';
    }
    if (blocked) return blocked;
    // The player may have played while the cloud was read
    if (!canTransferSave()) return 'failed';

    const local = transferableState();
    const merged = remotes.reduce<Record<string, unknown>>((state, remote) => mergeSaves(state, remote), local);
    if (remotes.length > 0 && !isSameSave(local, merged)) {
      useGameStore.getState().applyMergedProgress(merged);
      // A new phone: its progress came back by itself, the player is told once
      if (hasNotPlayed(local) && !hasNotPlayed(merged)) useCloudSyncStore.setState({ restored: true });
    }

    // A phone that has not played and found nothing in the cloud has nothing to save
    if (remotes.length === 0 && hasNotPlayed(transferableState())) return 'synced';

    await playGames.commit(handle, exportProgress(), snapshotDescription());
    committed = true;
    return 'synced';
  } finally {
    if (!committed) await playGames.discard(handle).catch(() => {});
  }
}

/** Shown by Play Jeux in its list of saved games */
function snapshotDescription(): string {
  const { xp, progress } = useGameStore.getState();
  const stars = (progress as LevelProgress[]).filter(p => p.completed).reduce((sum, p) => sum + (p.stars || 0), 0);
  return i18n.t('save.cloud_snapshot', { level: getPlayerLevel(xp), stars });
}

/** The player signs in from the Sauvegarde section, then the sync runs */
export async function signInAndSync(playGames: RushPlayGamesModule | null = getPlayGames()): Promise<CloudSyncStatus> {
  if (!playGames) return 'idle';
  const signedIn = await playGames.signIn().catch(() => false);
  if (!signedIn) {
    useCloudSyncStore.getState().setStatus('signed_out');
    return 'signed_out';
  }
  return syncProgress('manual', playGames);
}
