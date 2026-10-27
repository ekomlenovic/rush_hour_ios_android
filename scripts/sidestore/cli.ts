/**
 * Checks and updates sidestore-source.json (run by .github/workflows/build.yml, Node 22).
 *   node scripts/sidestore/cli.ts check
 *   node scripts/sidestore/cli.ts add <ipa> <buildNumber> <downloadURL>
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  addVersion,
  englishReleaseNotes,
  expectedPermissions,
  MIN_OS_VERSION,
  sourceErrors,
  type SideStoreSource,
} from './source.ts';

const SOURCE_FILE = 'sidestore-source.json';

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const source: SideStoreSource = readJson(SOURCE_FILE);
const expo = readJson('app.json').expo;
const packageVersion: string = readJson('package.json').version;

const [command, ipa, buildNumber, downloadURL] = process.argv.slice(2);

if (expo.version !== packageVersion) {
  console.error(`app.json (${expo.version}) and package.json (${packageVersion}) disagree on the version`);
  process.exit(1);
}

if (command === 'check') {
  const errors = sourceErrors(source, { version: packageVersion, ...expectedPermissions(expo) });
  for (const error of errors) console.error(`- ${error}`);
  if (errors.length) process.exit(1);
  console.log(`${SOURCE_FILE} is valid, the app (${packageVersion}) can be published`);
} else if (command === 'add' && ipa && /^\d+$/.test(buildNumber ?? '') && downloadURL) {
  const file = readFileSync(ipa);
  const notesFile = `docs/RELEASE_NOTES_${packageVersion}.md`;
  const notes = existsSync(notesFile) ? englishReleaseNotes(readFileSync(notesFile, 'utf8')) : undefined;
  const updated = addVersion(source, {
    version: packageVersion,
    buildVersion: buildNumber,
    date: new Date().toISOString().slice(0, 10),
    ...(notes ? { localizedDescription: notes } : {}),
    downloadURL,
    size: file.length,
    sha256: createHash('sha256').update(file).digest('hex'),
    minOSVersion: MIN_OS_VERSION,
  });
  writeFileSync(SOURCE_FILE, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`${SOURCE_FILE}: ${packageVersion} (${buildNumber}) added`);
} else {
  console.error('Usage: node scripts/sidestore/cli.ts check | add <ipa> <buildNumber> <downloadURL>');
  process.exit(1);
}
