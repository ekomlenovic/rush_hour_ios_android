import * as Clipboard from 'expo-clipboard';
import { copySaveCode } from '../utils/copySaveCode';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import sr from '../locales/sr.json';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

describe('copying a save code (issue 180)', () => {
  it('says whether the code is in the clipboard', async () => {
    await expect(copySaveCode('RHSAVE1.abc.def')).resolves.toBe(true);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('RHSAVE1.abc.def');
  });

  it('never rejects when the system refuses a code too long for the clipboard', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('TransactionTooLargeException'));
    await expect(copySaveCode('x'.repeat(800_000))).resolves.toBe(false);
    warn.mockRestore();
  });

  it('has its messages in every language', () => {
    for (const locale of [fr, en, sr]) {
      expect(locale.save.copy_failed_title).toBeTruthy();
      expect(locale.save.copy_failed_body).toBeTruthy();
      expect(locale.save.paste_failed_body).toBeTruthy();
    }
  });
});
