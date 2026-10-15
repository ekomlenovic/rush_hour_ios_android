import fs from 'fs';
import path from 'path';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

const ROOT = path.join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'utils', 'context'];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function hasKey(strings: unknown, key: string): boolean {
  const lookup = (k: string) => k.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    strings,
  );
  // Plural keys only exist with their suffixes (key_one, key_other)
  return [key, `${key}_one`, `${key}_other`].some(k => typeof lookup(k) === 'string');
}

describe('translations', () => {
  // Literal keys only: t('a.b'); keys built at runtime (t(`a.${x}`)) are checked by their own tests
  const keys = new Map<string, string>();
  for (const dir of SOURCE_DIRS) {
    const absolute = path.join(ROOT, dir);
    if (!fs.existsSync(absolute)) continue;
    for (const file of sourceFiles(absolute)) {
      for (const match of fs.readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'/g)) {
        keys.set(match[1], path.relative(ROOT, file));
      }
    }
  }

  it('finds the keys used by the screens', () => {
    expect(keys.size).toBeGreaterThan(100);
  });

  it.each([['en', en], ['fr', fr]] as const)('every key used in the code exists in %s', (_, strings) => {
    const missing = [...keys].filter(([key]) => !hasKey(strings, key)).map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });
});
