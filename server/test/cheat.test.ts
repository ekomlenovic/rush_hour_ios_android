import { describe, expect, it } from 'vitest';
import { analyzeGame, DEFAULT_THRESHOLDS as TH, variation } from '../src/cheat';
import type { MoveRecord } from '../src/core';

/** n moves at the given times (ms from the start) */
const moves = (times: number[]): MoveRecord[] => times.map((t, i) => ({ vehicleId: `v${i % 3}`, delta: 1, t }));
const codes = (flags: { code: string }[]) => flags.map(f => f.code);

describe('suspicion signals', () => {
  it('an ordinary human game raises nothing', () => {
    // 12 moves, a few hesitations, one wasted move
    const log = moves([8000, 11000, 12500, 20000, 21000, 26000, 27500, 31000, 40000, 42000, 43000, 47000]);
    expect(analyzeGame({ moves: log, minMoves: 11, serverMs: 48_000, clientMs: 47_500 }, TH)).toEqual([]);
  });

  it('too fast for a human', () => {
    const log = moves([300, 600, 900, 1200, 1500]);
    expect(analyzeGame({ moves: log, minMoves: 5, serverMs: 1800, clientMs: 1700 }, TH))
      .toEqual([{ code: 'too_fast', values: { msPerMove: 360, threshold: 600 } }]);
  });

  it('"copied": a long pause, then the optimal solution without a mistake at a steady pace', () => {
    // 3 minutes to find it elsewhere, then 10 moves one every ~1.5 s
    const log = moves([180_000, 181_500, 183_000, 184_400, 186_000, 187_500, 189_000, 190_600, 192_000, 193_500]);
    const flags = analyzeGame({ moves: log, minMoves: 10, serverMs: 194_000, clientMs: 193_800 }, TH);
    expect(flags).toEqual([{ code: 'copied', values: { pausePercent: 93, pauseMs: 180_000 } }]);
  });

  it('a long think then a perfect but irregular game is not "copied"', () => {
    const log = moves([120_000, 121_000, 135_000, 136_000, 150_000, 151_000, 152_000, 170_000, 171_000, 180_000]);
    expect(codes(analyzeGame({ moves: log, minMoves: 10, serverMs: 181_000, clientMs: 181_000 }, TH))).toEqual([]);
  });

  it('not "copied" when not optimal, or a short puzzle', () => {
    const steady = [180_000, 181_500, 183_000, 184_500, 186_000, 187_500, 189_000, 190_500, 192_000, 193_500];
    expect(codes(analyzeGame({ moves: moves(steady), minMoves: 9, serverMs: 194_000, clientMs: null }, TH))).toEqual([]);
    expect(codes(analyzeGame({ moves: moves(steady.slice(0, 5)), minMoves: 5, serverMs: 187_000, clientMs: null }, TH))).toEqual([]);
  });

  it('a phone clock that does not match the server: a modified app', () => {
    const log = moves([5000, 10_000, 15_000, 20_000]);
    // The phone says 5 s for a 60 s game
    expect(codes(analyzeGame({ moves: log, minMoves: 4, serverMs: 60_000, clientMs: 5000 }, TH))).toEqual(['clock_mismatch']);
    // A move after the end of the game
    expect(codes(analyzeGame({ moves: moves([5000, 90_000]), minMoves: 2, serverMs: 60_000, clientMs: 60_000 }, TH))).toEqual(['clock_mismatch']);
    // Network delays are tolerated
    expect(codes(analyzeGame({ moves: log, minMoves: 4, serverMs: 60_000, clientMs: 50_000 }, TH))).toEqual([]);
  });

  it('thresholds can be adjusted', () => {
    const log = moves([300, 600, 900, 1200, 1500]);
    expect(analyzeGame({ moves: log, minMoves: 5, serverMs: 1800, clientMs: null }, { ...TH, minMsPerMove: 200 })).toEqual([]);
  });

  it('variation: 0 for a perfectly regular rhythm', () => {
    expect(variation([1000, 1000, 1000])).toBe(0);
    expect(variation([500, 1500])).toBeCloseTo(0.5);
    expect(variation([7])).toBe(0);
  });
});
