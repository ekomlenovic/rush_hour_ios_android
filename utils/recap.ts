import type { TFunction } from 'i18next';
import type { ChallengeResult, PeriodStats, RecapsSeen } from '../store/types';
import { emptyPeriodStats, monthKeyOf } from '../store/periodStats';
import { addMonths, computeDayRuns, dateLocale, formatPlayTime, getLocalDateString, getWeekStart, parseLocalDateString } from './date';
import { APP_URL } from './shareResult';

/**
 * Monthly and yearly recap, Spotify Wrapped style (issue 125, see docs/GAME_DESIGN.md, Récap).
 * The counters come from monthlyStats / yearlyStats; what is already dated (challenges, frozen days,
 * achievements) is read from where it is saved.
 */

export type RecapKind = 'month' | 'year';

/** The player's profile over the period, one short sentence on the first card */
export type RecapProfile = 'loyal' | 'perfectionist' | 'early' | 'night' | 'boss' | 'explorer' | 'challenger' | 'driver';

/** Store fields a recap is built from */
export interface RecapSource {
  monthlyStats: Record<string, PeriodStats>;
  yearlyStats: Record<string, PeriodStats>;
  achievementMonths: Record<string, string>;
  recapSince: string | null;
  dailyChallengeProgress: Record<string, ChallengeResult>;
  weeklyChallengeProgress: Record<string, ChallengeResult>;
  frozenDates: string[];
}

export interface Recap {
  kind: RecapKind;
  /** YYYY-MM or YYYY */
  key: string;
  /** First and last day of the period (YYYY-MM-DD) */
  start: string;
  end: string;
  stats: PeriodStats;
  dailies: number;
  perfectDailies: number;
  /** Longest run of dailies won in a row within the period */
  bestDailyRun: number;
  freezesUsed: number;
  weeklies: number;
  /** Achievements unlocked in the period, oldest first */
  achievementIds: string[];
  /**
   * Day the counters started, when it falls after the start of the period: before it, only the
   * challenges are known (the update that added the recap). The recap says so rather than show zeros
   */
  partialSince: string | null;
  /** The period before, to compare with; wins only when it was fully counted */
  previous: { key: string; wins: number | null; dailies: number } | null;
  profile: RecapProfile;
}

export const recapKind = (key: string): RecapKind => (key.length === 4 ? 'year' : 'month');

/** First and last day of a month or a year */
export function periodBounds(key: string): { start: string; end: string } {
  if (recapKind(key) === 'year') return { start: `${key}-01-01`, end: `${key}-12-31` };
  const [year, month] = key.split('-').map(Number);
  return { start: `${key}-01`, end: getLocalDateString(new Date(year, month, 0)) };
}

const previousKey = (key: string): string => (recapKind(key) === 'year' ? String(Number(key) - 1) : addMonths(key, -1));

const inPeriod = (dateKey: string, start: string, end: string) => dateKey >= start && dateKey <= end;

function wonKeys(results: Record<string, ChallengeResult>, start: string, end: string, dateOf: (key: string) => string = k => k): [string, ChallengeResult][] {
  return Object.entries(results).filter(([key, r]) => r?.completed && inPeriod(dateOf(key), start, end));
}

const isWeekKey = (key: string) => /^\d{4}-W\d{2}$/.test(key);

/** Profile of the period: the first one that fits, the plain driver otherwise */
export function pickProfile(stats: PeriodStats, dailies: number, days: number, weeklies = 0): RecapProfile {
  if (dailies >= 7 && dailies >= days * 0.8) return 'loyal';
  if (stats.wins >= 5 && stats.perfectWins / stats.wins >= 0.6) return 'perfectionist';
  if (stats.earlyWins >= 3) return 'early';
  if (stats.nightWins >= 3) return 'night';
  if (stats.bossWins >= 2) return 'boss';
  if (stats.newLevels >= 20) return 'explorer';
  if (dailies + weeklies >= 3) return 'challenger';
  return 'driver';
}

export function buildRecap(source: RecapSource, key: string, now: Date = new Date()): Recap {
  const kind = recapKind(key);
  const { start, end } = periodBounds(key);
  const stats = { ...emptyPeriodStats(), ...(kind === 'year' ? source.yearlyStats[key] : source.monthlyStats[key]) };

  const dailies = wonKeys(source.dailyChallengeProgress, start, end);
  const weeklies = wonKeys(source.weeklyChallengeProgress, start, end, k => (isWeekKey(k) ? getWeekStart(k) : ''));
  const achievementIds = Object.entries(source.achievementMonths)
    .filter(([, month]) => (kind === 'year' ? month.slice(0, 4) === key : month === key))
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([id]) => id);

  const since = source.recapSince;
  const partialSince = since && since > start ? since : null;

  const prevKey = previousKey(key);
  const prevBounds = periodBounds(prevKey);
  const prevStats = kind === 'year' ? source.yearlyStats[prevKey] : source.monthlyStats[prevKey];
  const prevDailies = wonKeys(source.dailyChallengeProgress, prevBounds.start, prevBounds.end).length;
  const prevCounted = !since || since <= prevBounds.start;
  const previous = prevStats || prevDailies > 0
    ? { key: prevKey, wins: prevCounted && prevStats ? prevStats.wins : null, dailies: prevDailies }
    : null;

  // Days of the period played so far, for the share of dailies won
  const today = getLocalDateString(now);
  const lastDay = end < today ? end : today;
  const days = Math.max(1, Math.round((parseLocalDateString(lastDay).getTime() - parseLocalDateString(start).getTime()) / 86400000) + 1);

  return {
    kind,
    key,
    start,
    end,
    stats,
    dailies: dailies.length,
    perfectDailies: dailies.filter(([, r]) => r.stars === 3).length,
    bestDailyRun: computeDayRuns(dailies.map(([k]) => k)).longest,
    freezesUsed: source.frozenDates.filter(d => inPeriod(d, start, end)).length,
    weeklies: weeklies.length,
    achievementIds,
    partialSince,
    previous,
    profile: pickProfile(stats, dailies.length, days, weeklies.length),
  };
}

export type RecapSlideId = 'intro' | 'levels' | 'time' | 'challenges' | 'feats' | 'unlocks';

/** A number of a slide; `key` names its label (recap.hero_<key> for the big one, recap.<key> for the others) */
export interface RecapFigure {
  key: string;
  value: number;
  format?: 'time' | 'days' | 'plus';
}

/** One idea per slide: a big number, and a few others under it */
export interface RecapSlide {
  id: RecapSlideId;
  hero: RecapFigure | null;
  details: RecapFigure[];
}

/** Achievements unlocked in the period: before the update that dated them, only the count since is known */
export const recapAchievementCount = (recap: Recap): number =>
  (recap.partialSince ? recap.stats.achievements : recap.achievementIds.length);

/**
 * The slides of the recap, before the sharing one. A number at zero is left out, and a slide with
 * nothing to tell is skipped: a recap never shows a row of zeros
 */
export function recapSlides(recap: Recap): RecapSlide[] {
  const { stats } = recap;
  const fig = (key: string, value: number, format?: RecapFigure['format']): RecapFigure => ({ key, value, ...(format && { format }) });
  const nonZero = (figures: RecapFigure[]) => figures.filter(f => f.value > 0);
  const first = (figures: RecapFigure[]) => nonZero(figures)[0] ?? null;
  const rest = (figures: RecapFigure[], hero: RecapFigure | null) => nonZero(figures).filter(f => f !== hero);

  const time = [fig('play_time', stats.playTimeMs >= 60_000 ? stats.playTimeMs : 0, 'time'), fig('moves', stats.moves)];
  const challenges = [
    fig('dailies', recap.dailies),
    fig('weeklies', recap.weeklies),
    fig('perfect_dailies', recap.perfectDailies),
    fig('best_run', recap.bestDailyRun > 1 ? recap.bestDailyRun : 0, 'days'),
    fig('freezes_used', recap.freezesUsed),
  ];
  const unlocks = [fig('achievements', recapAchievementCount(recap)), fig('styles', stats.cosmetics)];
  const slides: RecapSlide[] = [
    { id: 'intro', hero: null, details: [] },
    {
      id: 'levels',
      hero: first([fig('wins', stats.wins)]),
      details: nonZero([fig('new_levels', stats.newLevels), fig('stars_gained', stats.starsGained, 'plus'), fig('perfect_wins', stats.perfectWins)]),
    },
    { id: 'time', hero: first(time), details: [] },
    { id: 'challenges', hero: first(challenges), details: [] },
    { id: 'feats', hero: first([fig('hardest_win', stats.hardestWinMoves)]), details: nonZero([fig('boss_wins', stats.bossWins)]) },
    { id: 'unlocks', hero: first(unlocks), details: [] },
  ];
  for (const [slide, figures] of [[slides[2], time], [slides[3], challenges], [slides[5], unlocks]] as const) {
    slide.details = rest(figures, slide.hero);
  }
  return slides.filter(slide => slide.id === 'intro' || slide.hero);
}

/** Whether there is anything to tell about the period */
export const hasActivity = (recap: Recap): boolean =>
  recap.stats.wins > 0 || recap.stats.moves > 0 || recap.dailies > 0 || recap.weeklies > 0;

/** The annual recap is announced from December 26th, the monthly one from the 1st, for 7 days at most */
const ANNOUNCE_DAYS = 7;
const YEAR_RECAP_DAY = 26;

/** The recap the home screen announces today, if there is one not opened yet */
export function pendingRecap(source: RecapSource & { recapsSeen: RecapsSeen }, now: Date = new Date()): string | null {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const candidates: string[] = [];
  // December 26th to January 1st (7 days): the year that ends, then the one that just ended
  if (month === 12 && day >= YEAR_RECAP_DAY) candidates.push(String(now.getFullYear()));
  if (month === 1 && day === 1) candidates.push(String(now.getFullYear() - 1));
  if (day <= ANNOUNCE_DAYS) candidates.push(addMonths(monthKeyOf(now), -1));

  for (const key of candidates) {
    const seen = recapKind(key) === 'year' ? source.recapsSeen.year : source.recapsSeen.month;
    if (seen && seen >= key) continue;
    if (hasActivity(buildRecap(source, key, now))) return key;
  }
  return null;
}

/**
 * Whether opening the recap marks it as seen: only the one announced or a period already over. Looking
 * at the current month (or year) keeps its announcement once it is over (issue 182)
 */
export function shouldMarkRecapSeen(source: RecapSource & { recapsSeen: RecapsSeen }, key: string, now: Date = new Date()): boolean {
  return pendingRecap(source, now) === key || !isInProgress(buildRecap(source, key, now), now);
}

/** Recaps that can be opened again: the last 12 months and the current one, then every year, latest first */
export function availableRecaps(source: RecapSource, now: Date = new Date()): string[] {
  const current = monthKeyOf(now);
  const months = Array.from({ length: 13 }, (_, i) => addMonths(current, -i));
  const years = new Set(Object.keys(source.yearlyStats));
  for (const key of Object.keys(source.dailyChallengeProgress)) years.add(key.slice(0, 4));
  return [
    ...months,
    ...[...years].filter(y => /^\d{4}$/.test(y)).sort().reverse(),
  ].filter(key => hasActivity(buildRecap(source, key, now)));
}

/** 'octobre 2026' / '2026' */
export function periodLabel(key: string, language: string): string {
  if (recapKind(key) === 'year') return key;
  return parseLocalDateString(`${key}-01`).toLocaleDateString(dateLocale(language), { month: 'long', year: 'numeric' });
}

/** Whether the period is still going on */
export const isInProgress = (recap: Recap, now: Date = new Date()): boolean => recap.end >= getLocalDateString(now);

/**
 * The strong numbers of the recap, the most telling first, none at zero: the tiles of the share
 * image (6 at most) and the lines of the shared text. Each one is a number shown on the slides
 */
export function recapHighlights(t: TFunction, recap: Recap, max = 6): { key: string; value: string; label: string; emoji: string }[] {
  const { stats } = recap;
  const achievements = recapAchievementCount(recap);
  const items: { key: string; amount: number; value?: string; emoji: string }[] = [
    { key: 'wins', amount: stats.wins, emoji: '🏁' },
    { key: 'dailies', amount: recap.dailies, emoji: '🧩' },
    { key: 'hardest_win', amount: stats.hardestWinMoves, emoji: '🧠' },
    { key: 'stars_gained', amount: stats.starsGained, value: `+${stats.starsGained}`, emoji: '⭐' },
    { key: 'best_run', amount: recap.bestDailyRun > 1 ? recap.bestDailyRun : 0, emoji: '🔥' },
    { key: 'play_time', amount: stats.playTimeMs >= 60_000 ? stats.playTimeMs : 0, value: formatPlayTime(stats.playTimeMs), emoji: '⏱️' },
    { key: 'achievements', amount: achievements, emoji: '🏆' },
    { key: 'weeklies', amount: recap.weeklies, emoji: '⚔️' },
    { key: 'perfect_wins', amount: stats.perfectWins, emoji: '🎯' },
    { key: 'new_levels', amount: stats.newLevels, emoji: '🗺️' },
    { key: 'boss_wins', amount: stats.bossWins, emoji: '👑' },
    { key: 'styles', amount: stats.cosmetics, emoji: '🎨' },
    { key: 'moves', amount: stats.moves, emoji: '🚗' },
    { key: 'perfect_dailies', amount: recap.perfectDailies, emoji: '🌟' },
    { key: 'freezes_used', amount: recap.freezesUsed, emoji: '❄️' },
  ];
  return items
    .filter(item => item.amount > 0)
    .slice(0, max)
    .map(item => ({
      key: item.key,
      value: item.value ?? String(item.amount),
      label: t(`recap.tile_${item.key}`, { count: item.amount }),
      emoji: item.emoji,
    }));
}

/**
 * Progress since the period before, for the sticker of the share image: only when it went up
 * (a recap is shared to show off). Wins when the period before was fully counted, dailies otherwise
 */
export function recapProgress(recap: Recap): { key: 'wins' | 'dailies'; diff: number; previousKey: string } | null {
  const { previous } = recap;
  if (!previous) return null;
  const progress = previous.wins !== null
    ? { key: 'wins' as const, diff: recap.stats.wins - previous.wins }
    : { key: 'dailies' as const, diff: recap.dailies - previous.dailies };
  return progress.diff > 0 ? { ...progress, previousKey: previous.key } : null;
}

/** Wordle-like text of the recap: emojis in the shared text only (see docs/GAME_DESIGN.md, Icônes) */
export function buildRecapShareText(t: TFunction, recap: Recap, language: string): string {
  const plain = { interpolation: { escapeValue: false } };
  const title = recap.kind === 'year'
    ? t('recap.share_title_year', { period: periodLabel(recap.key, language), ...plain })
    : t('recap.share_title_month', { period: periodLabel(recap.key, language), ...plain });
  const lines = recapHighlights(t, recap, 5).map(h => `${h.emoji} ${h.value} ${h.label}`);
  return [`Rush Hours — ${title} 🎁`, ...lines, t(`recap.profile_${recap.profile}`), APP_URL].join('\n');
}
