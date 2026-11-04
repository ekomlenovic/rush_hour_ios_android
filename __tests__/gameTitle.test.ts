import i18n from '../utils/i18n';
import { gameTitle, type GameTitleContext } from '../utils/gameTitle';
import { sampleLevels } from '../data/sampleLevels';
import { isBossLevel } from '../data/bosses';
import { ARCHIVE_LEVEL_ID, DAILY_LEVEL_ID, WEEKLY_LEVEL_ID } from '../store/gameStore';

const t = i18n.t;
const base: GameTitleContext = { level: sampleLevels[0], challengeKind: null, archiveDate: null, customKind: null, customLevels: [], language: 'fr' };

describe('gameTitle (issue 170)', () => {
  it('never names a challenge or an archive by its reserved id', () => {
    const daily = gameTitle(t, { ...base, level: { ...sampleLevels[0], id: DAILY_LEVEL_ID }, challengeKind: 'daily' });
    const weekly = gameTitle(t, { ...base, level: { ...sampleLevels[0], id: WEEKLY_LEVEL_ID }, challengeKind: 'weekly' });
    const archive = gameTitle(t, { ...base, level: { ...sampleLevels[0], id: ARCHIVE_LEVEL_ID }, archiveDate: '2026-10-14' });
    expect(daily).toBe(t('home.daily_challenge'));
    expect(weekly).toBe(t('home.weekly_challenge'));
    expect(archive).toBe(t('game.archive_title', { date: new Date(2026, 9, 14).toLocaleDateString('fr', { day: 'numeric', month: 'short' }) }));
    for (const title of [daily, weekly, archive]) expect(title).not.toMatch(/99999/);
  });

  it('names a map level, a boss and a custom level as the header does', () => {
    expect(gameTitle(t, base)).toBe(t('game.level_count', { id: sampleLevels[0].id }));
    const boss = sampleLevels.find(l => isBossLevel(l.id))!;
    expect(gameTitle(t, { ...base, level: boss })).toBe(t('game.level_boss', { id: boss.id }));
    const custom = { ...sampleLevels[0], id: 1_700_000_000_000, name: 'Mon niveau' };
    expect(gameTitle(t, { ...base, level: custom, customKind: 'created', customLevels: [custom] })).toBe('Mon niveau');
  });
});
