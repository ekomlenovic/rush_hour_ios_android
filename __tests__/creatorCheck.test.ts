/**
 * The creator's "Test" and "Save" (#204): a tap during a check does nothing, one tap gives
 * one check and one result, and the "checking" state is reset after a rejection.
 */
import { createExclusiveTask } from '../utils/exclusiveTask';

/** A slow check, resolved by hand */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('createExclusiveTask', () => {
  it('runs a single check and gives a single result for repeated taps', async () => {
    const busy: boolean[] = [];
    const run = createExclusiveTask(b => busy.push(b));
    const check = deferred<number>();
    const solver = jest.fn(() => check.promise);
    const onResult = jest.fn();

    const first = run(solver, onResult);
    const second = run(solver, onResult);
    const third = run(solver, onResult);
    expect(solver).toHaveBeenCalledTimes(1);
    expect(busy).toEqual([true]);

    check.resolve(7);
    await Promise.all([first, second, third]);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(7);
    expect(busy).toEqual([true, false]);
  });

  it('runs a new check once the previous one is over', async () => {
    const run = createExclusiveTask(() => {});
    const solver = jest.fn(async () => 3);
    const onResult = jest.fn();
    await run(solver, onResult);
    await run(solver, onResult);
    expect(solver).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  it('is no longer busy after a rejected check, and accepts the next tap', async () => {
    const busy: boolean[] = [];
    const run = createExclusiveTask(b => busy.push(b));
    const onResult = jest.fn();
    await expect(run(() => Promise.reject(new Error('worklet')), onResult)).rejects.toThrow('worklet');
    expect(busy).toEqual([true, false]);
    expect(onResult).not.toHaveBeenCalled();

    await run(async () => 1, onResult);
    expect(onResult).toHaveBeenCalledWith(1);
  });
});
