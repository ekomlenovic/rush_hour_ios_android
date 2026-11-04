import * as fs from 'fs';
import * as path from 'path';
import { darkColors, lightColors, resolveScheme, statusBarStyle, type UiColors } from '../theme/ui';
import { BOARD_THEMES, CAR_SKINS, CLASSIC_VEHICLE_COLORS, GENERATOR_VEHICLE_COLORS, TARGET_CAR_COLOR, VEHICLE_PALETTES, toBoardLook } from '../theme/board';
import { LABEL_MIN_CONTRAST, contrastRatio, labelOn, over } from '../theme/contrast';
import { fixedColors } from '../theme/ui';

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

describe('statusBarStyle', () => {
  it('uses dark icons on the light theme and light icons on the dark theme', () => {
    expect(statusBarStyle('light')).toBe('dark');
    expect(statusBarStyle('dark')).toBe('light');
  });

  it('is mounted at the root, following the theme, under the recap override (issue 205)', () => {
    const layout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/import \{ StatusBar \} from 'expo-status-bar'/);
    expect(layout).toMatch(/<StatusBar style=\{statusBarStyle\(scheme\)\} \/>/);
    const recap = fs.readFileSync(path.join(__dirname, '../app/recap.tsx'), 'utf8');
    expect(recap).toMatch(/<StatusBar style="light" \/>/);
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

describe('labels on fills (issue 157)', () => {
  const fills = [
    ...CLASSIC_VEHICLE_COLORS,
    ...GENERATOR_VEHICLE_COLORS,
    ...Object.values(VEHICLE_PALETTES).flatMap(colors => colors ?? []),
    TARGET_CAR_COLOR,
    ...Object.values(CAR_SKINS).flatMap(skin => (skin.color ? [skin.color] : [])),
  ];

  it.each(Object.keys(BOARD_THEMES))('vehicle letters and the target star are readable on every vehicle of the %s board', id => {
    for (const board of Object.values(BOARD_THEMES[id as keyof typeof BOARD_THEMES])) {
      for (const fill of [...fills, ...board.vehicles, board.targetCar]) {
        const label = labelOn(fill, board.vehicleLabel, board.vehicleLabelDark);
        expect(contrastRatio(label, fill)).toBeGreaterThanOrEqual(LABEL_MIN_CONTRAST);
      }
    }
  });

  it('the number of a map node is readable on every face', () => {
    const faces = [...fills, fixedColors.levelEasy, fixedColors.levelMedium, fixedColors.levelHard, fixedColors.levelUnknown,
      fixedColors.levelTutorial, fixedColors.levelCustom, lightColors.primary, darkColors.primary];
    for (const face of faces) {
      expect(contrastRatio(labelOn(face, fixedColors.onPrimary, fixedColors.onLightFill), face)).toBeGreaterThanOrEqual(LABEL_MIN_CONTRAST);
    }
  });

  it('keeps white where it already reads, and on a color it cannot read', () => {
    expect(labelOn('#1D4ED8', '#FFFFFF', '#0F0F1A')).toBe('#FFFFFF');
    expect(labelOn('#FACC15', '#FFFFFF', '#0F0F1A')).toBe('#0F0F1A');
    expect(labelOn('red', '#FFFFFF', '#0F0F1A')).toBe('#FFFFFF');
  });
});

describe('contrast (WCAG AA)', () => {
  const TEXT_TOKENS = ['text', 'textMuted', 'primaryText', 'success', 'warning', 'warningText', 'danger', 'weekly', 'starText'] as const;

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

  // Pairs drawn on a translucent fill, laid over the screen background (issue 166)
  it.each(SCHEMES)('text on the %s composed fills is readable', (_, colors) => {
    const pairs: [string, string, string][] = [
      ['stats bar labels', colors.textMuted, over(colors.card, colors.background)],
      ['hints left, stats bar', colors.warningText, over(colors.card, colors.background)],
      ['hint button label', colors.warningText, over(colors.warning + '22', colors.background)],
      ['multi resume button', colors.onWarning, colors.warning],
      ['recap "new" pill', colors.onWarning, colors.warning],
    ];
    for (const [use, text, bg] of pairs) {
      expect({ use, ratio: contrastRatio(text, bg) >= 4.5 }).toEqual({ use, ratio: true });
    }
  });

  it('composes a translucent color over an opaque background', () => {
    expect(over('rgba(0,0,0,0.5)', '#FFFFFF')).toBe('#808080');
    expect(over('#FF000000', '#123456')).toBe('#123456');
    expect(over('#FF0000', '#123456')).toBe('#ff0000');
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

describe('toBoardLook', () => {
  it("draws another player's board with their cosmetics", () => {
    expect(toBoardLook({ board: 'neon', skin: 'taxi', palette: 'ocean' })).toEqual({ board: 'neon', skin: 'taxi', palette: 'ocean' });
  });

  it('draws what this app does not know (a newer cosmetic) as the classic look', () => {
    expect(toBoardLook({ board: 'volcano', skin: 'taxi', palette: 'rainbow' })).toEqual({ board: 'classic', skin: 'taxi', palette: 'classic' });
    expect(toBoardLook({ board: 'toString', skin: 'constructor', palette: '__proto__' })).toEqual({ board: 'classic', skin: 'classic', palette: 'classic' });
  });

  it('no look (an older app or server): my own board', () => {
    expect(toBoardLook(null)).toBeUndefined();
    expect(toBoardLook(undefined)).toBeUndefined();
  });
});
