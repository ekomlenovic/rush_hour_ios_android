import fs from 'fs';
import path from 'path';
import { MAX_UI_FONT_SCALE, boardSizeFor } from '../utils/boardSize';

const ROOT = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('board size (issues 155 and 156)', () => {
  it('is unchanged on phones at the default font size', () => {
    expect(boardSizeFor({ width: 375, height: 667 })).toBe(327);
    expect(boardSizeFor({ width: 390, height: 844 })).toBe(342);
    expect(boardSizeFor({ width: 360, height: 640, fontScale: 1 })).toBe(312);
  });

  it('leaves room for the actions on an iPad in landscape', () => {
    const size = boardSizeFor({ width: 1180, height: 820 });
    expect(size).toBeLessThan(820 - 250);
  });

  it('shrinks with a large font on a small phone, up to the font cap of the game screen', () => {
    const normal = boardSizeFor({ width: 375, height: 667 });
    const large = boardSizeFor({ width: 375, height: 667, fontScale: MAX_UI_FONT_SCALE });
    expect(large).toBeLessThan(normal);
    expect(boardSizeFor({ width: 375, height: 667, fontScale: 3.571 })).toBe(large);
    expect(large).toBeGreaterThanOrEqual(200);
  });

  it('never gets wider than the screen allows', () => {
    expect(boardSizeFor({ width: 300, height: 300 })).toBeLessThanOrEqual(252);
  });
});

describe('font scaling (issue 156)', () => {
  it('leaves out the texts sized on the board or on a map token', () => {
    const block = read('components/Block.tsx');
    expect(block).toMatch(/<Text allowFontScaling=\{false\}[^>]*styles\.letter/);
    expect(read('components/map/LevelNode.tsx')).toMatch(/<Text\s+allowFontScaling=\{false\}\s+style=\{\[\s*styles\.nodeText/);
  });

  it('caps the texts around the board', () => {
    for (const file of ['components/game/GameActions.tsx', 'components/game/GameStatsBar.tsx']) {
      const source = read(file);
      const texts = source.match(/<Text\b[^>]*>/g) ?? [];
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) {
        // A nested <Text> (inside a capped one) follows its parent
        if (/fontSize: 13/.test(text)) continue;
        expect([file, text]).toEqual([file, expect.stringContaining('maxFontSizeMultiplier={MAX_UI_FONT_SCALE}')]);
      }
    }
  });
});

describe('iPad (issue 155)', () => {
  it('stays in portrait, full screen, like the iPhone', () => {
    const { expo } = JSON.parse(read('app.json'));
    expect(expo.orientation).toBe('portrait');
    expect(expo.ios.requireFullScreen).toBe(true);
  });
});
