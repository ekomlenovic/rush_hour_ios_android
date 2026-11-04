// Demo save for the store screenshots: about two months of play, reachable by a real player
// (level 7, 72 levels cleared, 23-day streak). Dates are relative to today so the streak stays alive.
import fs from 'fs';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const score = (mv, mn) => Math.max(0, mn * 100 - Math.max(0, mv - mn) * 15);
const stars = (mv, mn) => (mv <= mn ? 3 : mv <= mn + Math.max(1, Math.ceil(mn / 2)) ? 2 : 1);
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (today, k) => { const d = new Date(today); d.setDate(d.getDate() - k); return d; };
const weekKey = d => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${pad(Math.ceil(((t - yearStart) / 864e5 + 1) / 7))}`;
};

const LEVEL_NAMES = {
  en: ['Morning traffic', 'Harbor gridlock'],
  fr: ['Bouchon du matin', 'Embouteillage au port'],
};

export function buildSeed({ scheme = 'light', lang = 'en', today = new Date() } = {}) {
  const src = fs.readFileSync(`${ROOT}data/sampleLevels.ts`, 'utf8');
  const levels = JSON.parse(src.slice(src.indexOf('= [') + 2, src.lastIndexOf(']') + 1));
  let rnd = 7;
  const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;

  // Campaign: levels 1 to 72 cleared, mostly with 3 stars
  const N = 72;
  const progress = [];
  let xp = 0, totalMoves = 0, hardest = 0;
  for (let i = 1; i <= N; i++) {
    const mn = levels[i - 1].minMoves;
    const x = r();
    const mv = x < 0.6 ? mn : x < 0.9 ? mn + Math.ceil(mn * 0.3) : mn * 2;
    const st = stars(mv, mn);
    progress.push({ levelId: i, completed: true, bestScore: score(mv, mn), stars: st, bestTimeMs: Math.round((20 + mn * 6 + r() * 60) * 1000), noHint: x < 0.8, noHelp: x < 0.6 });
    xp += Math.round((10 + 2 * Math.min(mn, 60)) * [0, 0.5, 0.75, 1][st]);
    totalMoves += mv;
    hardest = Math.max(hardest, mn);
  }

  // Daily challenges: 23-day streak ending yesterday (2 days covered by freezes), older scattered wins
  const daily = {};
  const frozenDates = [];
  let streak = 0;
  for (let k = 1; k <= 25; k++) {
    const d = daysAgo(today, k);
    if (k === 9 || k === 17) { frozenDates.push(dayKey(d)); continue; }
    const mn = 14 + Math.floor(r() * 12);
    const mv = r() < 0.55 ? mn : mn + Math.ceil(r() * 6);
    daily[dayKey(d)] = { completed: true, score: score(mv, mn), stars: stars(mv, mn), timeMs: Math.round((60 + r() * 200) * 1000), moves: mv, minMoves: mn };
    xp += 60 + 20 * stars(mv, mn);
    streak++;
  }
  for (let k = 28; k <= 60; k++) {
    if (r() < 0.6) {
      daily[dayKey(daysAgo(today, k))] = { completed: true, score: 1470, stars: 2, timeMs: 150000, moves: 17, minMoves: 15 };
      xp += 100;
    }
  }
  const weekly = {
    [weekKey(daysAgo(today, 14))]: { completed: true, score: 2800, stars: 3, timeMs: 640000, moves: 28, minMoves: 28 },
    [weekKey(daysAgo(today, 7))]: { completed: true, score: 3000, stars: 2, timeMs: 900000, moves: 36, minMoves: 30 },
  };
  xp += 300 + 250 + 14 * 100; // weeklies and mission days

  const created = (id, base, name) => ({ ...levels.find(l => l.id === base), id, name, updatedAt: id });
  const [name1, name2] = LEVEL_NAMES[lang] ?? LEVEL_NAMES.en;

  const state = {
    progress,
    maxUnlockedLevel: N + 1,
    lastPlayedLevelId: N + 1,
    createdLevels: [created(1760100000000, 120, name1), created(1760200000000, 64, name2)],
    dailyChallengeProgress: daily,
    weeklyChallengeProgress: weekly,
    stats: {
      totalPlayTimeMs: 6.5 * 3600e3, totalMoves, totalUndos: 41, totalResets: 18,
      totalWins: N + Object.keys(daily).length + 2, firstTryWins: N - 8,
      winsByGridSize: { 6: 30, 7: 42 }, levelsShared: 2, resultsShared: 5, levelsImported: 0,
      hardestWinMoves: hardest, fastestWinMs: 41000, nightWins: 0, newYearWins: 0, specialDayWins: {},
      longestWinMs: 600000, maxResetsBeforeWin: 3, hardestPerfectMoves: 30, earlyDailyWins: 2,
      lastMinuteWeeklies: 0, freezesEarned: 6, freezesUsed: 2, missionDaysCompleted: 14, longestAbsenceDays: 2,
    },
    currentStreak: streak,
    bestStreak: streak,
    lastStreakDate: dayKey(daysAgo(today, 1)),
    streakFreezes: 2,
    frozenDates,
    lastOpenDate: dayKey(today),
    totalHintsUsed: 12,
    xp,
    notificationsPrompted: true,
    themeMode: scheme,
    isMusicEnabled: false,
    cosmetics: { board: 'classic', skin: 'classic', palette: 'classic', effect: 'confetti' },
  };
  const version = +fs.readFileSync(`${ROOT}store/migrations.ts`, 'utf8').match(/STORE_VERSION = (\d+)/)[1];
  return JSON.stringify({ state, version });
}
