import { requireOptionalNativeModule } from 'expo';

/**
 * Saved Games of Play Games Services (issue 320), Android only: absent on iOS, on the web, in Expo Go
 * and in the tests. Present but not available (`isAvailable` false) on an app not installed from
 * Google Play, or built without a Play Games project id (plugins/withPlayGames.js).
 */
export interface RushPlayGamesModule {
  isAvailable(): boolean;
  isSignedIn(): Promise<boolean>;
  signIn(): Promise<boolean>;
  /** Every version of the snapshot read (several after a conflict), kept open until commit or discard */
  open(name: string): Promise<{ handle: number; contents: string[] }>;
  /** Writes the snapshot and closes it; rejects with code 'too_big' over the Saved Games size limit */
  commit(handle: number, data: string, description: string): Promise<boolean>;
  discard(handle: number): Promise<boolean>;
}

const native = requireOptionalNativeModule<RushPlayGamesModule>('RushPlayGames');

/** The Play Games module when it can be used on this phone, null anywhere else */
export function getPlayGames(): RushPlayGamesModule | null {
  try {
    return native?.isAvailable() ? native : null;
  } catch {
    return null;
  }
}
