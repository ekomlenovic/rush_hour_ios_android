import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '@/utils/date';
import type { AdminGame, MultiApi } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import { multiErrorMessage } from '../errors';
import { reasonsText, verdictIcon } from '../verdict';
import AdminButton from './AdminButton';
import AdminSegmented from './AdminSegmented';
import { useAdminRefresh } from './AdminPage';
import { adminStyles as styles } from './styles';
import IconText from '@/components/IconText';
import LoadingIndicator from '@/components/LoadingIndicator';

interface Props { api: MultiApi; colors: UiColors }

/** Games to review: the signals, the replay, then confirm the cheating or lift the suspicion */
export default function AdminGames({ api, colors }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<'suspects' | 'all'>('suspects');
  const [games, setGames] = useState<AdminGame[] | null>(null);

  const load = useCallback(async () => {
    try {
      setGames((await api.admin.games(filter)).games);
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
      setGames(g => g ?? []);
    }
  }, [api, filter, t]);

  const changeFilter = (next: 'suspects' | 'all') => {
    setGames(null);
    setFilter(next);
  };

  useEffect(() => { void load(); }, [load]);
  useAdminRefresh(load);

  const setVerdict = async (game: AdminGame, verdict: 'cheater' | 'cleared' | null) => {
    try {
      await api.admin.setVerdict(game.attemptId, verdict);
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
    }
  };

  const confirmCheater = (game: AdminGame) => Alert.alert(
    t('multi.admin_confirm_cheater_title'),
    t('multi.admin_confirm_cheater_body', { pseudo: game.pseudo }),
    [{ text: t('common.cancel'), style: 'cancel' }, { text: t('multi.admin_cheater'), style: 'destructive', onPress: () => setVerdict(game, 'cheater') }],
  );

  return (
    <View>
      <AdminSegmented
        options={(['suspects', 'all'] as const).map(f => ({ value: f, label: t(`multi.admin_filter_${f}`) }))}
        value={filter}
        onChange={changeFilter}
        colors={colors}
      />
      {!games && <LoadingIndicator />}
      {games?.length === 0 && <Text style={[styles.empty, { color: colors.textMuted }]}>{t('multi.admin_no_games')}</Text>}
      {games?.map(game => (
        <View key={game.attemptId} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {game.verdict ? (
            <IconText icon={verdictIcon(game.verdict)} color={game.verdict === 'cheater' ? colors.danger : colors.warning} textStyle={[styles.title, { color: colors.text }]}>
              {game.pseudo} · {game.date}
            </IconText>
          ) : <Text style={[styles.title, { color: colors.text }]}>{game.pseudo} · {game.date}</Text>}
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {t('multi.moves', { count: game.moves })}{game.minMoves ? ` / ${game.minMoves}` : ''} · {formatDuration(game.timeMs)}
            {game.clientMs !== null ? ` · ${t('multi.admin_phone_time', { time: formatDuration(game.clientMs) })}` : ''}
          </Text>
          {!!game.backgroundMs && (
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_background', { time: formatDuration(game.backgroundMs) })}</Text>
          )}
          {game.flags.length > 0 && <Text style={[styles.warning, { color: colors.warning }]}>{reasonsText(t, game.flags)}</Text>}
          {game.adminVerdict && (
            <Text style={[styles.warning, { color: game.adminVerdict === 'cheater' ? colors.danger : colors.success }]}>
              {game.adminVerdict === 'cheater' ? t('multi.admin_state_cheater') : t('multi.admin_state_cleared')}
            </Text>
          )}
          <View style={styles.actions}>
            {game.hasReplay && (
              <AdminButton label={t('multi.watch_game')} icon="play" onPress={() => router.push(`/multi/replay?attemptId=${game.attemptId}`)} background={colors.neutralSoft} color={colors.text} />
            )}
            {game.adminVerdict !== 'cheater' && (
              <AdminButton label={t('multi.admin_cheater')} icon="ban" onPress={() => confirmCheater(game)} background={colors.dangerSoft} color={colors.danger} />
            )}
            {game.adminVerdict !== 'cleared' && game.flags.length > 0 && (
              <AdminButton label={t('multi.admin_clear')} icon="checkmark" onPress={() => setVerdict(game, 'cleared')} background={colors.successSoft} color={colors.success} />
            )}
            {game.adminVerdict && (
              <AdminButton label={t('multi.admin_undo_verdict')} onPress={() => setVerdict(game, null)} background={colors.neutralSoft} color={colors.text} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
