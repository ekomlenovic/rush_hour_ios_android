import fs from 'fs';
import path from 'path';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import sr from '../locales/sr.json';
import { dateLocale } from '../utils/date';

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

  it.each([['en', en], ['fr', fr], ['sr', sr]] as const)('every key used in the code exists in %s', (_, strings) => {
    const missing = [...keys].filter(([key]) => !hasKey(strings, key)).map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });
});

/** Every string of a translation file, by its dotted path */
function flatten(node: object, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value as string]]);
}

const variables = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map(m => m[1]).sort();

describe('Serbian translation', () => {
  const english = new Map(flatten(en));
  const serbian = new Map(flatten(sr));
  // Serbian has three plural forms: an English key_one / key_other pair is key_one / key_few / key_other
  const expected = new Map<string, string>();
  for (const [key, text] of english) {
    const plural = key.match(/^(.*)_(one|other)$/);
    if (plural) for (const form of ['one', 'few', 'other']) expected.set(`${plural[1]}_${form}`, english.get(`${plural[1]}_other`)!);
    else expected.set(key, text);
  }

  it('has the same keys as English, with the Serbian plural forms', () => {
    expect([...serbian.keys()].filter(key => !expected.has(key))).toEqual([]);
    expect([...expected.keys()].filter(key => !serbian.has(key))).toEqual([]);
  });

  it('keeps the variables of each English text', () => {
    const wrong = [...serbian].filter(([key, text]) => {
      // The one form also covers 21, 31…: it may name the count where English says "one"
      const own = variables(text).filter(name => name !== 'count');
      const reference = variables(expected.get(key) ?? '').filter(name => name !== 'count');
      return own.join() !== reference.join();
    });
    expect(wrong).toEqual([]);
  });

  it('keeps {{count}} in the forms that need it, the one form included (21, 31…)', () => {
    const missing = [...serbian].filter(([key, text]) => /{{count}}/.test(expected.get(key) ?? '') && !/{{count}}/.test(text));
    expect(missing).toEqual([]);
  });

  it('is written in Latin script', () => {
    expect([...serbian].filter(([, text]) => /[\u0400-\u04FF]/.test(text))).toEqual([]);
  });

  it('formats dates in Latin script too', () => {
    expect(dateLocale('sr')).toBe('sr-Latn');
    expect(dateLocale('fr')).toBe('fr');
    expect(new Date(2026, 9, 1).toLocaleDateString(dateLocale('sr'), { month: 'long' })).not.toMatch(/[\u0400-\u04FF]/);
  });
});
