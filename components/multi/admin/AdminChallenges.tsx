import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme, type UiColors } from '@/theme';
import { useGameStore } from '@/store/gameStore';
import type { AdminChallenge, MultiApi } from '@/utils/multi/api';
import { RFValue } from '@/utils/responsive';
import BoardPreview from '@/components/garage/BoardPreview';
import { errorCode, multiErrorMessage } from '../errors';
import { useAdminRefresh } from './AdminPage';
import { adminStyles as styles } from './styles';

const THUMB = 72;

/** '< 1 s', '12 s', '3 min', '1 h 05' */
function formatGeneration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return '< 1 s';
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Where the puzzle comes from, and how long it took */
function originOf(t: TFunction, puzzle: NonNullable<AdminChallenge['puzzle']>): string {
  const origin = puzzle.variantOf !== null
    ? t('multi.admin_challenges_variant', { level: puzzle.variantOf })
    : t('multi.admin_challenges_scratch');
  return puzzle.generationMs !== null
    ? t('multi.admin_challenges_origin_in', { origin, duration: formatGeneration(puzzle.generationMs) })
    : origin;
}

interface Props { api: MultiApi; colors: UiColors; timeZone: string }

/**
 * The daily challenges prepared on the server: the current one and the next ones, ready
 * or not, where their puzzle comes from, and the boards on demand (they spoil the next days)
 */
export default function AdminChallenges({ api, colors, timeZone }: Props) {
  const { t, i18n } = useTranslation();
  const { scheme } = useTheme();
  const cosmetics = useGameStore(s => s.cosmetics);
  const [challenges, setChallenges] = useState<AdminChallenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBoards, setShowBoards] = useState(false);

  const load = useCallback(async () => {
    try {
      setChallenges((await api.admin.challenges()).challenges);
      setError(null);
    } catch (e) {
      // A server without this route
      setError(errorCode(e) === 'not_found' ? t('multi.admin_challenges_old_server') : multiErrorMessage(t, e));
    }
  }, [api, t]);

  useEffect(() => { void load(); }, [load]);
  useAdminRefresh(load);

  /** In the time zone of the server, like the release time */
  const at = (ms: number, options: Intl.DateTimeFormatOptions) => {
    try {
      return new Date(ms).toLocaleString(i18n.language, { ...options, timeZone });
    } catch {
      return new Date(ms).toLocaleString(i18n.language, options);
    }
  };
  const when = (ms: number) => at(ms, { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const time = (ms: number) => at(ms, { hour: '2-digit', minute: '2-digit' });
  // A day of the calendar, whatever the time zone
  const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  if (error && !challenges) return <Text style={[styles.muted, { color: colors.textMuted }]}>{error}</Text>;
  if (!challenges) return <ActivityIndicator color={colors.primary} />;

  const statusLine = (c: AdminChallenge): { text: string; color: string } => {
    switch (c.status) {
      case 'ready': return { text: t('multi.admin_challenges_ready', { count: c.puzzle!.minMoves }), color: colors.success };
      case 'generating': return {
        text: t('multi.admin_challenges_generating', { minutes: Math.max(0, Math.floor((Date.now() - c.generatingSince!) / 60_000)) }),
        color: colors.warning,
      };
      case 'failed': return { text: t('multi.admin_challenges_failed', { time: time(c.failedAt!) }), color: colors.danger };
      default: return c.generatesAt <= Date.now()
        // In the window, the background work takes it within a minute
        ? { text: t('multi.admin_challenges_soon'), color: colors.textMuted }
        : { text: t('multi.admin_challenges_waiting', { date: when(c.generatesAt) }), color: colors.textMuted };
    }
  };

  return (
    <View>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_challenges_help')}</Text>
      <View style={styles.row}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_challenges_show_boards')}</Text>
        <Switch value={showBoards} onValueChange={setShowBoards} accessibilityLabel={t('multi.admin_challenges_show_boards')} />
      </View>
      {showBoards && <Text style={[styles.muted, { color: colors.warning }]}>{t('multi.admin_challenges_spoiler')}</Text>}

      {challenges.map(c => {
        const status = statusLine(c);
        const { puzzle } = c;
        // Prepared in a difficulty changed since: generated again before its release
        const outdated = puzzle && puzzle.difficulty !== c.difficulty;
        return (
          <View key={c.date} style={[styles.card, local.card, { backgroundColor: colors.surface, borderColor: c.current ? colors.primary : colors.border }]}>
            <View style={local.header}>
              <Text style={[styles.title, local.title, { color: colors.text }]}>
                {t('multi.admin_challenges_title', { number: c.number, day: day(c.date) })}
              </Text>
              {c.current && (
                <Text style={[local.badge, { color: colors.primaryText, backgroundColor: colors.primarySoft }]}>{t('multi.admin_challenges_current')}</Text>
              )}
            </View>
            <Text style={[styles.muted, { color: colors.text }]}>
              {t(`difficulty.${c.difficulty}`)} · {c.current || c.releaseAt <= Date.now()
                ? t('multi.admin_challenges_released', { date: when(c.releaseAt) })
                : t('multi.admin_challenges_release', { date: when(c.releaseAt) })}
            </Text>
            <Text style={[styles.muted, local.status, { color: status.color }]}>{status.text}</Text>
            {puzzle && (
              <View style={local.puzzle}>
                {showBoards && <BoardPreview selection={cosmetics} scheme={scheme} size={THUMB} level={puzzle.level} />}
                <View style={local.puzzleText}>
                  {outdated && (
                    <Text style={[styles.muted, { color: colors.warning }]}>
                      {t('multi.admin_challenges_outdated', { old: t(`difficulty.${puzzle.difficulty}`), difficulty: t(`difficulty.${c.difficulty}`) })}
                    </Text>
                  )}
                  <Text style={[styles.muted, { color: puzzle.variantOf !== null ? colors.warning : colors.textMuted }]}>{originOf(t, puzzle)}</Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>
                    {t('custom_levels.stats_line', { size: puzzle.level.gridSize, count: puzzle.level.vehicles.length, moves: puzzle.minMoves })}
                  </Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_puzzles_created', { date: when(puzzle.generatedAt) })}</Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    marginTop: RFValue(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  badge: {
    fontSize: RFValue(11),
    fontWeight: '800',
    paddingHorizontal: RFValue(8),
    paddingVertical: RFValue(3),
    borderRadius: 999,
    overflow: 'hidden',
  },
  status: {
    fontWeight: '700',
  },
  puzzle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: RFValue(6),
  },
  puzzleText: {
    flex: 1,
  },
});
