import { readFileSync } from 'fs';
import { join } from 'path';
import { transformSync } from '@babel/core';

/**
 * The solver runs on a worklet runtime (utils/solver.background.ts): the worklet plugin
 * copies each 'worklet' function there as a string, and the variables it uses from outside
 * arrive through this.__closure, read at the top of the body. A parameter's default value is
 * computed before that, so one using an outside variable throws on the device
 * ("Property 'MAX_VALIDATE_STATES' doesn't exist") while the tests, on the JS thread, pass.
 */
describe('worklets', () => {
  it('no default parameter of the solver uses a variable from outside the worklet', () => {
    const file = join(__dirname, '../utils/solver.ts');
    const out = transformSync(readFileSync(file, 'utf8'), {
      filename: file,
      caller: { name: 'metro', platform: 'ios' } as never,
    })!.code!;
    const worklets = [...out.matchAll(/code:"function (\w+)\(([^)]*)\)\{(?:const\{([^}]*)\}=this\.__closure;)?/g)];
    expect(worklets.length).toBeGreaterThanOrEqual(3);
    for (const [, name, params, closure = ''] of worklets) {
      for (const outside of closure.split(',').filter(Boolean)) {
        expect({ name, uses: new RegExp(`\\b${outside}\\b`).test(params) }).toEqual({ name, uses: false });
      }
    }
  });
});
