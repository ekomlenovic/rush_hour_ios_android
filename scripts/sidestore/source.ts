/**
 * SideStore / AltStore source of the iOS app (`sidestore-source.json`), in the AltStore
 * "source 2.0" format: one entry per build in `versions`, newest first. The old top-level
 * fields (`version`, `downloadURL`…) repeat the newest version for older SideStore clients.
 * Rules in docs/GAME_DESIGN.md (« Source SideStore »). No Node import here: the tests load it.
 */

export type VersionEntry = {
  version: string;
  buildVersion: string;
  date: string;
  localizedDescription?: string;
  downloadURL: string;
  size: number;
  sha256?: string;
  minOSVersion?: string;
};

export type AppEntry = {
  name: string;
  bundleIdentifier: string;
  category: string;
  appPermissions: {
    entitlements: string[];
    privacy: Record<string, string>;
  };
  versions: VersionEntry[];
  version: string;
  buildVersion: string;
  versionDate: string;
  versionDescription?: string;
  downloadURL: string;
  size: number;
  [field: string]: unknown;
};

export type SideStoreSource = {
  name: string;
  identifier: string;
  sourceURL: string;
  apps: AppEntry[];
  [field: string]: unknown;
};

/** Categories SideStore / AltStore know */
export const CATEGORIES = [
  'developer',
  'entertainment',
  'games',
  'lifestyle',
  'other',
  'photo-video',
  'social',
  'utilities',
];

export const BUNDLE_IDENTIFIER = 'com.rushhours.app';
export const REPOSITORY = 'ekomlenovic/rush_hour_ios_android';
/** Deployment target of the app and of its widget (targets/widget/expo-target.config.js) */
export const MIN_OS_VERSION = '16.4';

/** -1, 0 or 1, like a sort comparator: "2.0.10" is after "2.0.9" */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/** The English Play Store notes of docs/RELEASE_NOTES_X.Y.Z.md (`<en-US>` block), or undefined */
export function englishReleaseNotes(markdown: string): string | undefined {
  const match = markdown.match(/<en-US>\s*([\s\S]*?)\s*<\/en-US>/);
  return match ? match[1] : undefined;
}

export function rushHoursApp(source: SideStoreSource): AppEntry {
  const app = source.apps.find((a) => a.bundleIdentifier === BUNDLE_IDENTIFIER);
  if (!app) throw new Error(`No ${BUNDLE_IDENTIFIER} app in the source`);
  return app;
}

/**
 * The source with a new build: it becomes the newest version. A rebuild of the version on
 * top replaces it (same or larger build number: a re-run keeps its number); an older
 * version or build than the newest is refused, SideStore would never offer it as an update.
 */
export function addVersion(source: SideStoreSource, entry: VersionEntry): SideStoreSource {
  const app = rushHoursApp(source);
  const latest = app.versions[0];
  if (latest && compareVersions(entry.version, latest.version) < 0) {
    throw new Error(`Version ${entry.version} is older than ${latest.version}, already in the source`);
  }
  if (latest && entry.version === latest.version && Number(entry.buildVersion) < Number(latest.buildVersion)) {
    throw new Error(`Build ${entry.buildVersion} of ${entry.version} is older than build ${latest.buildVersion}`);
  }
  const versions = [entry, ...app.versions.filter((v) => v.version !== entry.version)];
  const updated: AppEntry = {
    ...app,
    versions,
    version: entry.version,
    buildVersion: entry.buildVersion,
    versionDate: entry.date,
    versionDescription: entry.localizedDescription,
    downloadURL: entry.downloadURL,
    size: entry.size,
  };
  if (!updated.versionDescription) delete updated.versionDescription;
  return { ...source, apps: source.apps.map((a) => (a === app ? updated : a)) };
}

/** What the built app declares, read from app.json: what the source must announce */
export function expectedPermissions(expo: {
  ios?: { entitlements?: Record<string, unknown>; infoPlist?: Record<string, unknown> };
  plugins?: unknown[];
}): { entitlements: string[]; privacy: Record<string, string> } {
  const privacy: Record<string, string> = {};
  for (const [key, value] of Object.entries(expo.ios?.infoPlist ?? {})) {
    if (key.endsWith('UsageDescription') && typeof value === 'string') privacy[key] = value;
  }
  const camera = (expo.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-camera') as
    | [string, { cameraPermission?: string }]
    | undefined;
  if (camera?.[1]?.cameraPermission) privacy.NSCameraUsageDescription = camera[1].cameraPermission;
  return { entitlements: Object.keys(expo.ios?.entitlements ?? {}).sort(), privacy };
}

/**
 * What is wrong in the source (empty: fine). SideStore checks the downloaded app against
 * its entry: same version and build number, and the entitlements and privacy keys the app
 * uses must be announced. The community source also wants an icon, screenshots and a category.
 */
export function sourceErrors(
  source: SideStoreSource,
  expected: { version: string; entitlements: string[]; privacy: Record<string, string> },
): string[] {
  const errors: string[] = [];
  const app = rushHoursApp(source);
  const ownFile = (url: unknown) =>
    typeof url === 'string' && url.startsWith(`https://raw.githubusercontent.com/${REPOSITORY}/`);

  if (source.sourceURL !== `https://raw.githubusercontent.com/${REPOSITORY}/refs/heads/main/sidestore-source.json`) {
    errors.push('sourceURL is not the file of this repository on main');
  }
  if (!CATEGORIES.includes(app.category)) errors.push(`Unknown category "${app.category}"`);
  if (!ownFile(app.iconURL)) errors.push('iconURL is not a file of this repository');
  const screenshots = app.screenshots as Record<string, { imageURL: string }[]> | undefined;
  if (!screenshots?.iphone?.length) errors.push('No iPhone screenshot');
  for (const shot of Object.values(screenshots ?? {}).flat()) {
    if (!ownFile(shot.imageURL)) errors.push(`Screenshot ${shot.imageURL} is not a file of this repository`);
  }

  const declared = [...app.appPermissions.entitlements].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected.entitlements)) {
    errors.push(`Entitlements ${declared.join(', ')} instead of ${expected.entitlements.join(', ')}`);
  }
  for (const [key, text] of Object.entries(expected.privacy)) {
    if (app.appPermissions.privacy[key] !== text) errors.push(`Privacy key ${key} missing or different`);
  }
  for (const key of Object.keys(app.appPermissions.privacy)) {
    if (!(key in expected.privacy)) errors.push(`Privacy key ${key} announced but not in the app`);
  }

  if (!app.versions.length) errors.push('No version');
  for (let i = 1; i < app.versions.length; i++) {
    if (compareVersions(app.versions[i - 1].version, app.versions[i].version) <= 0) {
      errors.push(`Versions not newest first: ${app.versions[i - 1].version} before ${app.versions[i].version}`);
    }
  }
  for (const v of app.versions) {
    if (!/^\d+$/.test(v.buildVersion)) errors.push(`Build number "${v.buildVersion}" of ${v.version} is not a number`);
    if (!v.downloadURL.startsWith(`https://github.com/${REPOSITORY}/releases/download/`)) {
      errors.push(`${v.version} is not downloaded from the releases of this repository`);
    }
    if (!(v.size > 0)) errors.push(`No size for ${v.version}`);
    if (v.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(v.sha256)) errors.push(`Bad sha256 for ${v.version}`);
  }
  const latest = app.versions[0];
  if (latest) {
    if (
      app.version !== latest.version ||
      app.buildVersion !== latest.buildVersion ||
      app.versionDate !== latest.date ||
      app.downloadURL !== latest.downloadURL ||
      app.size !== latest.size
    ) {
      errors.push('The top-level version fields are not the newest version');
    }
    if (compareVersions(expected.version, latest.version) < 0) {
      errors.push(`The app (${expected.version}) is older than the source (${latest.version}): bump its version`);
    }
  }
  return errors;
}
