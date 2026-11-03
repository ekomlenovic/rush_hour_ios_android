import { facingTransform, isUpright, type ArtDrawing } from '../theme/art/art';
import { vehicleFacing } from '../utils/facing';

const target = (orientation: 'horizontal' | 'vertical') => ({ orientation, isTarget: true });
const other = (orientation: 'horizontal' | 'vertical') => ({ orientation, isTarget: false });

describe('vehicleFacing', () => {
  it('the target car faces its exit, on every side', () => {
    expect(vehicleFacing(target('horizontal'), 2, 6, 6)).toBe('right');
    expect(vehicleFacing(target('horizontal'), 3, 255, 6)).toBe('left');
    expect(vehicleFacing(target('horizontal'), 3, -1, 6)).toBe('left');
    expect(vehicleFacing(target('vertical'), 255, 2, 6)).toBe('up');
    expect(vehicleFacing(target('vertical'), -1, 2, 6)).toBe('up');
    expect(vehicleFacing(target('vertical'), 7, 4, 7)).toBe('down');
  });

  it('the other vehicles face right or up, wherever the exit is', () => {
    for (const [row, col] of [[2, 6], [2, 255], [255, 2], [6, 2]]) {
      expect(vehicleFacing(other('horizontal'), row, col, 6)).toBe('right');
      expect(vehicleFacing(other('vertical'), row, col, 6)).toBe('up');
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
