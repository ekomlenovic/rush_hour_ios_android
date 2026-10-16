import * as fs from 'fs';
import * as path from 'path';
import { darkColors, lightColors, resolveScheme, type UiColors } from '../theme/ui';
import { BOARD_THEMES } from '../theme/board';
import { contrastRatio } from '../theme/contrast';

const SCHEMES: [string, UiColors][] = [['dark', darkColors], ['light', lightColors]];

describe('resolveScheme', () => {
  it('follows the system in automatic mode', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
  });

  it('forces the chosen mode', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});

describe('theme variants', () => {
  it('define the same tokens in light and dark', () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(darkColors).sort());
    for (const variants of Object.values(BOARD_THEMES)) {
      expect(Object.keys(variants.light).sort()).toEqual(Object.keys(variants.dark).sort());
    }
  });
});

describe('contrast (WCAG AA)', () => {
  const TEXT_TOKENS = ['text', 'textMuted', 'primaryText', 'success', 'warning', 'danger', 'weekly', 'starText'] as const;

  it.each(SCHEMES)('text tokens are readable on the %s background and surfaces', (_, colors) => {
    for (const token of TEXT_TOKENS) {
      for (const bg of ['background', 'surface'] as const) {
        expect({ token, bg, ratio: contrastRatio(colors[token], colors[bg]) >= 4.5 }).toEqual({ token, bg, ratio: true });
      }
    }
  });

  it.each(SCHEMES)('button text is readable on the %s primary fill', (_, colors) => {
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('hardcoded colors', () => {
  const ROOT = path.join(__dirname, '..');
  // Level data (data/) stores the vehicle colors of each level: it is content, not styling
  const SCANNED = ['app', 'components', 'context', 'hooks', 'utils', 'store'];
  const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

  const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });

  it('only appear in theme/', () => {
    const offenders = SCANNED.flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .flatMap((file) => fs.readFileSync(file, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${path.relative(ROOT, file)}:${i + 1}` }))
        .filter(({ line }) => COLOR.test(line))
        .map(({ at, line }) => `${at}  ${line.trim()}`));
    expect(offenders).toEqual([]);
  });
});
