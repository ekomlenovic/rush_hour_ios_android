import { readFileSync } from 'fs';
import { join } from 'path';
import { transformSync } from '@babel/core';
import * as worklets from 'react-native-worklets';
import { DIFFICULTY_LEVELS, generateDailyLevel, generateSeededLevelSync } from '../utils/generator';
import { DAILY_LEVEL_ID } from '../store/levelIds';

/** The worklets of a file, as the worklet plugin compiles them: name, parameters, outside variables */
const workletsOf = (relative: string) => {
  const file = join(__dirname, relative);
  const out = transformSync(readFileSync(file, 'utf8'), {
    filename: file,
    caller: { name: 'metro', platform: 'ios' } as never,
  })!.code!;
  // Plugin 0.13: code:"(function name(…){const[a,b]=this.__closure;… (before: no parenthesis, const{a,b})
  return [...out.matchAll(/code:"\(?function (\w+)\(([^)]*)\)\{(?:const[{[]([^}\]]*)[}\]]=this\.__closure;)?/g)]
    // The plugin suffixes the names with the file: generateLevelWith_generatorCoreTs9
    .map(([, name, params, closure = '']) => ({
      name: name.replace(/_\w+Ts\d+$/, ''), params, closure: closure.split(',').filter(Boolean),
    }));
};

/**
 * The solver and the generator of the daily run on a worklet runtime (utils/solver.background.ts):
 * the worklet plugin copies each 'worklet' function there as a string, and the variables it uses
 * from outside arrive through this.__closure, read at the top of the body. A parameter's default
 * value is computed before that, so one using an outside variable throws on the device
 * ("Property 'MAX_VALIDATE_STATES' doesn't exist") while the tests, on the JS thread, pass.
 */
describe('worklets', () => {
  it.each([
    ['../utils/solver.ts', ['solvePuzzle', 'getHint', 'validateLevel']],
    ['../utils/generator.core.ts', [
      'createPRNG', 'generateSeededLevelSync', 'pickExitSide', 'generateScrambledLevel', 'scrambleOnce',
      'shuffle', 'clamp', 'canPlace', 'generateLevelWith',
    ]],
  ])('no default parameter of %s uses a variable from outside the worklet', (file, expected) => {
    const found = workletsOf(file);
    expect(found.map(w => w.name)).toEqual(expect.arrayContaining(expected));
    for (const { name, params, closure } of found) {
      for (const outside of closure) {
        expect({ name, uses: new RegExp(`\\b${outside}\\b`).test(params) }).toEqual({ name, uses: false });
      }
    }
  });

  it('each worklet of the generator only calls worklets defined above it, or plain values', () => {
    // A worklet becomes a constant that captures what it calls when it is created: a worklet
    // defined below is still undefined then, and a plain function does not exist on the runtime
    const found = workletsOf('../utils/generator.core.ts');
    const plainValues = ['COLORS', 'TARGET_CAR_COLOR', 'GENERATOR_MAX_STATES', 'solvePuzzle'];
    found.forEach(({ name, closure }, i) => {
      const above = found.slice(0, i).map(w => w.name);
      for (const outside of closure) {
        expect({ name, outside, ok: above.includes(outside) || plainValues.includes(outside) })
          .toEqual({ name, outside, ok: true });
      }
    });
  });

  it('generates the daily on the solver runtime, the same level as generateSeededLevelSync (issue 159)', async () => {
    const spy = jest.spyOn(worklets, 'runOnRuntimeAsync');
    try {
      // Mondays (HARD) and ordinary days (NORMAL)
      for (const [date, difficulty] of [
        ['2026-10-26', DIFFICULTY_LEVELS.HARD], ['2026-11-02', DIFFICULTY_LEVELS.HARD],
        ['2026-10-27', DIFFICULTY_LEVELS.NORMAL], ['2026-11-01', DIFFICULTY_LEVELS.NORMAL],
      ] as const) {
        spy.mockClear();
        const level = await generateDailyLevel(date);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][1]).toBe(generateSeededLevelSync);
        const { updatedAt, ...expected } = generateSeededLevelSync(date, DAILY_LEVEL_ID, difficulty)!;
        expect({ ...level!, updatedAt }).toEqual(expected && { ...expected, updatedAt });
      }
    } finally {
      spy.mockRestore();
    }
  }, 120_000);
});
