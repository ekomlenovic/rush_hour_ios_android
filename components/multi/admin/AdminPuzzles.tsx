import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, type UiColors } from '@/theme';
import { useGameStore } from '@/store/gameStore';
import type { AdminPuzzles as Puzzles, MultiApi } from '@/utils/multi/api';
import { RFValue } from '@/utils/responsive';
import BoardPreview from '@/components/garage/BoardPreview';
import { errorCode, multiErrorMessage } from '../errors';
import { useAdminRefresh } from './AdminPage';
import { adminStyles as styles } from './styles';

const THUMB = 72;

interface Props { api: MultiApi; colors: UiColors }

/**
 * The duel puzzles ready ahead on the server: how many by difficulty, the catalog of
 * variants, what is being generated, and the boards on demand (they spoil the next duels)
 */
export default function AdminPuzzles({ api, colors }: Props) {
  const { t, i18n } = useTranslation();
  const { scheme } = useTheme();
  const cosmetics = useGameStore(s => s.cosmetics);
  const [data, setData] = useState<Puzzles | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBoards, setShowBoards] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.admin.puzzles());
      setError(null);
    } catch (e) {
      // A server without this route
      setError(errorCode(e) === 'not_found' ? t('multi.admin_puzzles_old_server') : multiErrorMessage(t, e));
    }
  }, [api, t]);

  useEffect(() => { void load(); }, [load]);
  useAdminRefresh(load);

  const time = (at: number) => new Date(at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const date = (at: number) => new Date(at).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (error && !data) return <Text style={[styles.empty, { color: colors.textMuted }]}>{error}</Text>;
  if (!data) return <ActivityIndicator color={colors.primary} />;

  const { working } = data;
  return (
    <View>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_puzzles_help')}</Text>
      <Text style={[styles.warning, { color: working ? colors.warning : colors.success }]}>
        {working
          ? t(`multi.admin_puzzles_working_${working.kind}`, {
            difficulty: t(`difficulty.${working.difficulty}`),
            minutes: Math.max(0, Math.floor((Date.now() - working.since) / 60_000)),
          })
          : t('multi.admin_puzzles_idle')}
      </Text>
      <View style={styles.row}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_puzzles_show_boards')}</Text>
        <Switch value={showBoards} onValueChange={setShowBoards} accessibilityLabel={t('multi.admin_puzzles_show_boards')} />
      </View>
      {showBoards && <Text style={[styles.muted, { color: colors.warning }]}>{t('multi.admin_puzzles_spoiler')}</Text>}

      {data.difficulties.map(d => {
        const puzzles = data.puzzles.filter(p => p.difficulty === d.difficulty);
        return (
          <View key={d.difficulty} style={[styles.card, local.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t(`difficulty.${d.difficulty}`)}</Text>
            <Text style={[styles.muted, { color: d.ready < d.size ? colors.warning : colors.textMuted }]}>
              {t('multi.admin_puzzles_ready', { ready: d.ready, size: d.size })}
            </Text>
            {d.catalog && (
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                {t('multi.admin_puzzles_catalog', { count: d.catalog.total, fresh: d.catalog.fresh })}
              </Text>
            )}
            {d.asideUntil !== null && (
              <Text style={[styles.warning, { color: colors.warning }]}>{t('multi.admin_puzzles_aside', { time: time(d.asideUntil) })}</Text>
            )}
            {showBoards && puzzles.map((p, i) => (
              <View key={p.id} style={local.puzzle}>
                <BoardPreview selection={cosmetics} scheme={scheme} size={THUMB} level={p.level} />
                <View style={local.puzzleText}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {i === 0 ? t('multi.admin_puzzles_next') : `#${i + 1}`}
                  </Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>
                    {t('custom_levels.stats_line', { size: p.level.gridSize, count: p.level.vehicles.length, moves: p.level.minMoves })}
                  </Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_puzzles_created', { date: date(p.createdAt) })}</Text>
                </View>
              </View>
            ))}
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
  puzzle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: RFValue(10),
  },
  puzzleText: {
    flex: 1,
  },
});
