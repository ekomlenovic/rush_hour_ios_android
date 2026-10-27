import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { sampleLevels } from '../data/sampleLevels';
import { getShareUrl, parseSharedLevel } from '../utils/sharing';
import { validateLevel } from '../utils/solver';
import { closeWebDialog, shareOnWeb, showWebAlert, subscribeWebDialogs, type WebDialog } from '../utils/webDialogs';
import { runOnSolverRuntime } from '../utils/solverRuntime.web';
import { WEB_APP_URL } from '../utils/webApp';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

/** The web version (see docs/GAME_DESIGN.md, Version web) */
describe('web version', () => {
  describe('alerts', () => {
    it('shows the alerts one at a time and runs the button touched', () => {
      let shown: WebDialog[] = [];
      const unsubscribe = subscribeWebDialogs(dialogs => { shown = dialogs; });
      try {
        const onReset = jest.fn();
        showWebAlert('Reset?', 'Everything goes', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: onReset }]);
        showWebAlert('Done');
        expect(shown.map(d => d.title)).toEqual(['Reset?', 'Done']);
        // An alert without buttons gets OK, like on the phones
        expect(shown[1].buttons.map(b => b.text)).toEqual(['OK']);
        expect(shown[0].cancelable).toBe(true);

        closeWebDialog(shown[0].id, shown[0].buttons[1]);
        expect(onReset).toHaveBeenCalledTimes(1);
        expect(shown.map(d => d.title)).toEqual(['Done']);
        closeWebDialog(shown[0].id);
        expect(shown).toEqual([]);
      } finally {
        unsubscribe();
      }
    });
  });

  describe('share', () => {
    const navigatorOf = global as unknown as { navigator?: { share?: unknown } };
    const saved = navigatorOf.navigator;
    afterEach(() => { navigatorOf.navigator = saved; });

    it('copies the message where the browser cannot share, and counts it as shared', async () => {
      navigatorOf.navigator = {};
      const unsubscribe = subscribeWebDialogs(() => {});
      try {
        await expect(shareOnWeb({ message: 'Level https://example.org' })).resolves.toEqual({ action: Share.sharedAction });
        expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Level https://example.org');
      } finally {
        unsubscribe();
      }
    });

    it('uses the share sheet of the phone, and counts nothing when it is closed', async () => {
      const share = jest.fn(async () => {});
      navigatorOf.navigator = { share };
      await expect(shareOnWeb({ message: 'Level' })).resolves.toEqual({ action: Share.sharedAction });
      expect(share).toHaveBeenCalledWith({ title: undefined, text: 'Level' });

      navigatorOf.navigator = { share: jest.fn(async () => { throw Object.assign(new Error('closed'), { name: 'AbortError' }); }) };
      await expect(shareOnWeb({ message: 'Level' })).resolves.toEqual({ action: Share.dismissedAction });
    });
  });

  it('shares a level with a link of the web version, which the app reads too', () => {
    const level = sampleLevels[3];
    const restore = jest.replaceProperty(Platform, 'OS', 'web');
    let url: string;
    try {
      url = getShareUrl(level);
    } finally {
      restore.restore();
    }
    expect(url.startsWith(`${WEB_APP_URL}/game?data=`)).toBe(true);
    expect(parseSharedLevel(url, 7)!.vehicles).toEqual(level.vehicles);
    // The app keeps its own link
    expect(getShareUrl(level).startsWith('rush-hours://game?data=')).toBe(true);
  });

  it('solves on the page when the browser has no worker, with the same result', async () => {
    const { vehicles, gridSize, exitRow, exitCol } = sampleLevels[3];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(runOnSolverRuntime(validateLevel, vehicles, gridSize, exitRow, exitCol))
      .resolves.toBe(validateLevel(vehicles, gridSize, exitRow, exitCol));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('finishes the export for GitHub Pages: 404.html for the links, a service worker for offline play', () => {
    const dist = mkdtempSync(join(tmpdir(), 'rush-web-'));
    mkdirSync(join(dist, '_expo'));
    writeFileSync(join(dist, 'index.html'), '<html>app</html>');
    writeFileSync(join(dist, '_expo', 'entry-abc.js'), 'code');
    writeFileSync(join(dist, 'music.mp3'), 'mp3');
    writeFileSync(join(dist, 'metadata.json'), '{}');
    const run = () => execFileSync('node', [join(__dirname, '../scripts/web/postExport.mjs'), dist]);

    run();
    expect(readFileSync(join(dist, '404.html'), 'utf8')).toBe('<html>app</html>');
    const worker = readFileSync(join(dist, 'sw.js'), 'utf8');
    const precache = JSON.parse(/const PRECACHE = (.*);/.exec(worker)![1]);
    // The page itself is its base address; the music is cached once played
    expect(precache).toEqual(['_expo/entry-abc.js', '']);
    const cache = /const CACHE = '(.*)';/.exec(worker)![1];

    // Same files, same cache: the players do not download it again
    run();
    expect(readFileSync(join(dist, 'sw.js'), 'utf8')).toContain(`'${cache}'`);
    writeFileSync(join(dist, '_expo', 'entry-abc.js'), 'new code');
    run();
    expect(readFileSync(join(dist, 'sw.js'), 'utf8')).not.toContain(`'${cache}'`);
  });
});
