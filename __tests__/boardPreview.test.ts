import { SAMPLE } from '../components/garage/BoardPreview';

describe('garage board preview', () => {
  it('draws a puzzle whose vehicles stay on the board without overlapping', () => {
    const taken = new Set<string>();
    for (const v of SAMPLE) {
      for (let i = 0; i < v.length; i++) {
        const row = v.row + (v.orientation === 'vertical' ? i : 0);
        const col = v.col + (v.orientation === 'horizontal' ? i : 0);
        expect([row, col].every(n => n >= 0 && n < 6)).toBe(true);
        const cell = `${row},${col}`;
        expect(taken.has(cell)).toBe(false);
        taken.add(cell);
      }
    }
  });
});
