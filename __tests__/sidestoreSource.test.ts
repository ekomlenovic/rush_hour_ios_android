import fs from 'fs';
import path from 'path';
import source from '../sidestore-source.json';
import app from '../app.json';
import pkg from '../package.json';
import {
  addVersion,
  compareVersions,
  englishReleaseNotes,
  expectedPermissions,
  MIN_OS_VERSION,
  rushHoursApp,
  sourceErrors,
  type SideStoreSource,
  type VersionEntry,
} from '../scripts/sidestore/source';

const current = source as unknown as SideStoreSource;
const expected = { version: pkg.version, ...expectedPermissions(app.expo) };
const releases = 'https://github.com/ekomlenovic/rush_hour_ios_android/releases/download';

const build = (version: string, buildVersion: string): VersionEntry => ({
  version,
  buildVersion,
  date: '2026-11-01',
  downloadURL: `${releases}/v${version}-b${buildVersion}/rush-hours-unsigned.ipa`,
  size: 1000,
  sha256: 'a'.repeat(64),
  minOSVersion: MIN_OS_VERSION,
});

describe('SideStore source', () => {
  it('is valid and announces what the app uses', () => {
    expect(sourceErrors(current, expected)).toEqual([]);
    expect(expected.entitlements).toEqual(['com.apple.security.application-groups']);
    expect(Object.keys(expected.privacy).sort()).toEqual(['NSCameraUsageDescription', 'NSLocalNetworkUsageDescription']);
  });

  it('points to images that exist in the repository', () => {
    const entry = rushHoursApp(current);
    const screenshots = entry.screenshots as Record<string, { imageURL: string }[]>;
    const urls = [entry.iconURL as string, current.iconURL as string, ...Object.values(screenshots).flat().map((s) => s.imageURL)];
    for (const url of urls) {
      const file = url.replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/refs\/heads\/main\//, '');
      expect(fs.existsSync(path.join(__dirname, '..', file))).toBe(true);
    }
  });

  it('has the deployment target of the widget', () => {
    const widget = require('../targets/widget/expo-target.config.js')(app.expo);
    expect(widget.deploymentTarget).toBe(MIN_OS_VERSION);
  });

  it('compares versions number by number', () => {
    expect(compareVersions('2.0.10', '2.0.9')).toBe(1);
    expect(compareVersions('2.0.4', '2.0.5')).toBe(-1);
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
  });

  it('takes the English notes of the release notes', () => {
    const notes = fs.readFileSync(path.join(__dirname, '../docs/RELEASE_NOTES_2.0.5.md'), 'utf8');
    expect(englishReleaseNotes(notes)).toMatch(/^New:\n• If the app crashes/);
    expect(englishReleaseNotes('# No Play Store notes')).toBeUndefined();
  });

  it('adds a build on top and repeats it in the top-level fields', () => {
    const updated = addVersion(current, build('2.0.5', '60'));
    const entry = rushHoursApp(updated);
    expect(entry.versions.map((v) => `${v.version} (${v.buildVersion})`)).toEqual(['2.0.5 (60)', '2.0.4 (1)']);
    expect(entry).toMatchObject({ version: '2.0.5', buildVersion: '60', versionDate: '2026-11-01', size: 1000 });
    expect(sourceErrors(updated, expected)).toEqual([]);

    // A rebuild of the same version replaces it, a re-run keeps its number
    const rebuilt = rushHoursApp(addVersion(addVersion(updated, build('2.0.5', '61')), build('2.0.5', '61')));
    expect(rebuilt.versions.map((v) => v.buildVersion)).toEqual(['61', '1']);
  });

  it('refuses a build SideStore would not offer as an update', () => {
    const updated = addVersion(current, build('2.0.5', '60'));
    expect(() => addVersion(updated, build('2.0.4', '70'))).toThrow('older than 2.0.5');
    expect(() => addVersion(updated, build('2.0.5', '59'))).toThrow('older than build 60');
  });

  it('finds what SideStore or the community source would refuse', () => {
    const entry = rushHoursApp(current);
    const broken: SideStoreSource = {
      ...current,
      apps: [
        {
          ...entry,
          category: 'puzzles',
          iconURL: 'https://i.imgur.com/71j15Xh.png',
          appPermissions: { entitlements: [], privacy: { NSPhotoLibraryUsageDescription: 'Photos' } },
          buildVersion: '59',
        },
      ],
    };
    expect(sourceErrors(broken, { ...expected, version: '2.0.3' })).toEqual([
      'Unknown category "puzzles"',
      'iconURL is not a file of this repository',
      'Entitlements  instead of com.apple.security.application-groups',
      'Privacy key NSLocalNetworkUsageDescription missing or different',
      'Privacy key NSCameraUsageDescription missing or different',
      'Privacy key NSPhotoLibraryUsageDescription announced but not in the app',
      'The top-level version fields are not the newest version',
      'The app (2.0.3) is older than the source (2.0.4): bump its version',
    ]);
  });
});
