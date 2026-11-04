import fs from 'fs';
import path from 'path';

/**
 * Every network call of the app is listed in Privacy_Policy.md (sections 1 and 5) and docs/PLAY_STORE.md
 * (issue 198). A new one fails here: update the policy and the Data safety notes, then this list.
 */
const ALLOWED = [
  'hooks/useDuel.ts', // multiplayer duels, to a server the player joined
  'utils/multi/api.ts', // multiplayer, to a server the player joined
  'utils/multi/connectionTest.ts', // multiplayer, the server the player is adding
  'utils/updateChecker.ts', // "Check for updates": a version file from GitHub
  'utils/shareSave.web.ts', // web: reads the save file the player picked (a local blob URL)
];

const ROOT = path.join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'utils', 'context', 'store', 'modules', 'data'];
const NETWORK = /\bfetch\s*\(|=\s*fetch\b|\bnew WebSocket\b|\bXMLHttpRequest\b|\bEventSource\b/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

it('the app only goes online where the privacy policy says (issue 198)', () => {
  const callers = SOURCE_DIRS
    .map(dir => path.join(ROOT, dir))
    .filter(dir => fs.existsSync(dir))
    .flatMap(sourceFiles)
    .filter(file => NETWORK.test(fs.readFileSync(file, 'utf8')))
    .map(file => path.relative(ROOT, file).split(path.sep).join('/'))
    .sort();
  expect(callers).toEqual([...ALLOWED].sort());
});
