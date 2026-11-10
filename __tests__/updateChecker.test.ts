jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '2.2.0' } } }));

import { checkForUpdate } from '@/utils/updateChecker';

const source = (version: string) => ({
  ok: true,
  json: async () => ({ apps: [{ version, downloadURL: 'https://github.com/x/releases/download/v/rush-hours-unsigned.ipa' }] }),
});

describe('checkForUpdate', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('offers a newer version from the source', async () => {
    global.fetch = jest.fn().mockResolvedValue(source('2.2.1')) as unknown as typeof fetch;
    const info = await checkForUpdate();
    expect(info.isUpdateAvailable).toBe(true);
    expect(info.latestVersion).toBe('2.2.1');
  });

  it('says up to date on the same version', async () => {
    global.fetch = jest.fn().mockResolvedValue(source('2.2.0')) as unknown as typeof fetch;
    expect((await checkForUpdate()).isUpdateAvailable).toBe(false);
  });

  it('never reads a cached copy of the source, so a release shows up at once', async () => {
    const fetchMock = jest.fn().mockResolvedValue(source('2.2.1'));
    global.fetch = fetchMock as unknown as typeof fetch;
    await checkForUpdate();
    await checkForUpdate();
    const [url1, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ cache: 'no-store' });
    expect(url1).toMatch(/source\.json\?t=\d+$/);
  });
});
