import { facingTransform, isUpright, type ArtDrawing } from '../theme/art/art';
import { vehicleFacing } from '../utils/facing';

const target = (orientation: 'horizontal' | 'vertical') => ({ id: 'X', row: 2, col: 0, length: 2, orientation, isTarget: true });
const other = (id: string, orientation: 'horizontal' | 'vertical', row = 1, col = 1) =>
  ({ id, row, col, length: 2, orientation, isTarget: false });

describe('vehicleFacing', () => {
  it('the target car faces its exit, on every side', () => {
    expect(vehicleFacing(target('horizontal'), 2, 6, 6)).toBe('right');
    expect(vehicleFacing(target('horizontal'), 3, 255, 6)).toBe('left');
    expect(vehicleFacing(target('horizontal'), 3, -1, 6)).toBe('left');
    expect(vehicleFacing(target('vertical'), 255, 2, 6)).toBe('up');
    expect(vehicleFacing(target('vertical'), -1, 2, 6)).toBe('up');
    expect(vehicleFacing(target('vertical'), 7, 4, 7)).toBe('down');
  });

  it('the other vehicles face along their axis', () => {
    for (let i = 0; i < 20; i++) {
      expect(['right', 'left']).toContain(vehicleFacing(other(`h${i}`, 'horizontal'), 2, 6, 6));
      expect(['up', 'down']).toContain(vehicleFacing(other(`v${i}`, 'vertical'), 2, 6, 6));
    }
  });

  it('the other vehicles face both ways across a level', () => {
    const horizontal = new Set(Array.from({ length: 20 }, (_, i) => vehicleFacing(other(`h${i}`, 'horizontal'), 2, 6, 6)));
    const vertical = new Set(Array.from({ length: 20 }, (_, i) => vehicleFacing(other(`v${i}`, 'vertical'), 2, 6, 6)));
    expect(horizontal).toEqual(new Set(['right', 'left']));
    expect(vertical).toEqual(new Set(['up', 'down']));
  });

  it('a vehicle keeps its way while it slides along its lane', () => {
    for (let i = 0; i < 20; i++) {
      const h = vehicleFacing(other(`h${i}`, 'horizontal', 3, 0), 2, 6, 6);
      const v = vehicleFacing(other(`v${i}`, 'vertical', 0, 4), 2, 6, 6);
      for (let at = 0; at <= 4; at++) {
        expect(vehicleFacing(other(`h${i}`, 'horizontal', 3, at), 2, 6, 6)).toBe(h);
        expect(vehicleFacing(other(`v${i}`, 'vertical', at, 4), 2, 6, 6)).toBe(v);
      }
    }
  });
});

describe('facingTransform', () => {
  const drawing: ArtDrawing = { width: 200, height: 100, gradients: [], shapes: [] };
  /** Where a point of the drawing lands, for the transforms facingTransform writes */
  const apply = (transform: string | undefined, [x, y]: [number, number]): [number, number] => {
    if (!transform) return [x, y];
    const matrix = /^matrix\(([^)]+)\)$/.exec(transform);
    if (matrix) {
      const [a, b, c, d, e, f] = matrix[1].split(' ').map(Number);
      return [a * x + c * y + e, b * x + d * y + f];
    }
    // rotate(-90) translate(-W 0): translated, then turned a quarter left
    const tx = Number(/translate\((-?\d+) /.exec(transform)![1]);
    return [y, -(x + tx) + 0];
  };
  const front: [number, number] = [200, 50];
  const back: [number, number] = [0, 50];

  it.each([
    ['right', [200, 50], [0, 50]],
    ['left', [0, 50], [200, 50]],
    ['up', [50, 0], [50, 200]],
    ['down', [50, 200], [50, 0]],
  ] as const)('a drawing facing %s has its front on that side of its box', (facing, frontAt, backAt) => {
    const transform = facingTransform(drawing, facing);
    expect(apply(transform, front)).toEqual(frontAt);
    expect(apply(transform, back)).toEqual(backAt);
    expect(isUpright(facing)).toBe(facing === 'up' || facing === 'down');
  });
});
