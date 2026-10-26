/**
 * The hint highlight with the system "Reduce motion" setting (#154): Reanimated keeps the starting
 * value of an infinite reversed withRepeat (0, invisible), so the highlight is set to a fixed opacity.
 */
type Hint = typeof import('../utils/hintGlow');
type Start = (hint: Hint, value: { value: number }, R: typeof import('react-native-reanimated')) => void;

/** Values of the highlight every 200 ms for 3.2 s, with the real Reanimated and fake timers */
const sample = (start: Start): number[] => {
  const out: number[] = [];
  jest.isolateModules(() => {
    jest.useFakeTimers();
    // Under Jest, Reanimated runs on JSReanimated, which has no CSS event handler for its initializer
    require('react-native-reanimated/lib/module/ReanimatedModule').ReanimatedModule.setCSSEventHandler = () => {};
    const R = require('react-native-reanimated');
    const hint = require('../utils/hintGlow');
    // The plain JS shared value (the .native one goes through the UI runtime, absent under Jest)
    const value = require('react-native-reanimated/lib/module/mutables.js').makeMutable(0);
    start(hint, value, R);
    for (let i = 0; i < 16; i++) {
      jest.advanceTimersByTime(200);
      out.push(value.value);
    }
    jest.useRealTimers();
  });
  return out;
};

describe('hint glow', () => {
  it('a reversed infinite loop keeps its starting value with reduced motion (the cause of #154)', () => {
    const values = sample((_hint, v, R) => {
      v.value = R.withRepeat(
        R.withSequence(R.withTiming(1, { duration: 600 }), R.withTiming(0.3, { duration: 600 })),
        -1,
        true,
        undefined,
        R.ReduceMotion.Always,
      );
    });
    expect(values.every(x => x === 0)).toBe(true);
  });

  it('keeps the hint visible and still with reduced motion', () => {
    const values = sample((hint, v) => hint.startHintGlow(v as never, true));
    expect(values.every(x => x >= 0.6)).toBe(true);
    expect(new Set(values).size).toBe(1);
  });

  it('keeps a second hint visible after the first one is cleared', () => {
    const values = sample((hint, v) => {
      hint.startHintGlow(v as never, true);
      hint.stopHintGlow(v as never);
      jest.advanceTimersByTime(400);
      hint.startHintGlow(v as never, true);
    });
    expect(values.every(x => x >= 0.6)).toBe(true);
  });

  it('pulses as before without reduced motion', () => {
    const values = sample((hint, v) => hint.startHintGlow(v as never, false));
    expect(Math.max(...values)).toBeGreaterThan(0.9);
    expect(Math.min(...values)).toBeLessThan(0.5);
  });

  it('is hidden once cleared', () => {
    const values = sample((hint, v) => {
      hint.startHintGlow(v as never, false);
      hint.stopHintGlow(v as never);
    });
    expect(values[values.length - 1]).toBe(0);
  });
});
