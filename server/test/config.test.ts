import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, parseDifficulty, parseDuration } from '../src/config';

const base = { SERVER_SECRET: 'a-long-enough-secret', ADMIN_TOKEN: 'a-long-enough-token' };

describe('configuration', () => {
  it('has defaults for everything but the secrets', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      serverName: 'Rush Hours', timeZone: 'Europe/Paris', releaseTime: '12:00', inviteCode: '',
      pregenerateAheadMs: 48 * 3_600_000, gracePeriodMs: 3_600_000, replayRetentionDays: 7, port: 3000, dataDir: '/data',
      trustProxy: 'loopback,uniquelocal',
    });
    // NORMAL, HARD on Mondays, like the daily challenge of the app
    expect(config.difficultyByWeekday).toEqual(['NORMAL', 'HARD', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL', 'NORMAL']);
  });

  it.each([
    [{ SERVER_SECRET: '' }, /SERVER_SECRET/],
    [{ ADMIN_TOKEN: 'short' }, /ADMIN_TOKEN/],
    [{ TZ: 'Mars/Olympus' }, /TZ/],
    [{ RELEASE_TIME: '25:00' }, /RELEASE_TIME/],
    [{ RELEASE_TIME: '12h' }, /RELEASE_TIME/],
    [{ PREGENERATE_AHEAD: 'two days' }, /PREGENERATE_AHEAD/],
    [{ GRACE_PERIOD: '-1h' }, /GRACE_PERIOD/],
    [{ DIFFICULTY: 'IMPOSSIBLE' }, /DIFFICULTY/],
    [{ DIFFICULTY: 'NORMAL,FUNDAY=HARD' }, /DIFFICULTY/],
    [{ INVITE_CODE: 'abc' }, /INVITE_CODE/],
    [{ REPLAY_RETENTION_DAYS: 'week' }, /REPLAY_RETENTION_DAYS/],
  ])('refuses %o', (env, message) => {
    expect(() => loadConfig({ ...base, ...env })).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, ...env })).toThrow(message);
  });

  it('reads durations', () => {
    expect(parseDuration('90s', 'X')).toBe(90_000);
    expect(parseDuration('30m', 'X')).toBe(1_800_000);
    expect(parseDuration('2d', 'X')).toBe(172_800_000);
  });

  it('reads a difficulty for each day of the week', () => {
    expect(parseDifficulty('expert')).toEqual(Array(7).fill('EXPERT'));
    expect(parseDifficulty('HARD, saturday=MASTER, sunday=EASY')).toEqual(['EASY', 'HARD', 'HARD', 'HARD', 'HARD', 'HARD', 'MASTER']);
    // The order does not matter
    expect(parseDifficulty('MONDAY=HARD,EASY')[1]).toBe('HARD');
  });

  it('TRUST_PROXY can be turned off or set', () => {
    expect(loadConfig({ ...base, TRUST_PROXY: 'false' }).trustProxy).toBe(false);
    expect(loadConfig({ ...base, TRUST_PROXY: '10.0.0.1' }).trustProxy).toBe('10.0.0.1');
  });
});
