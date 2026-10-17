import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { formatDuration } from '@/utils/date';
import { useTheme } from '@/theme';
import { selectActiveAccount, useMultiStore } from '@/store/multiStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import { checkCompatibility, type Period, type Today } from '@/utils/multi/api';
import { formatRemaining } from '@/utils/multi/format';
import { serverHost } from '@/utils/multi/serverUrl';
import MultiHeader from '@/components/multi/MultiHeader';
import Leaderboard, { type RowPlayer } from '@/components/multi/Leaderboard';
import PlayerActionsSheet from '@/components/multi/PlayerActionsSheet';
import InviteSheet from '@/components/multi/InviteSheet';
import ServerPickerSheet from '@/components/multi/ServerPickerSheet';
import DuelsCard from '@/components/multi/DuelsCard';
import DuelHistoryCard from '@/components/multi/DuelHistoryCard';
import DuelLeaderboard from '@/components/multi/DuelLeaderboard';
import HomeTabBar from '@/components/home/HomeTabBar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { joinableCount, useServerDuels } from '@/hooks/useServerDuels';
import { DuelCodeSheet, NewDuelSheet } from '@/components/multi/DuelSheets';
import { errorCode, multiErrorMessage } from '@/components/multi/errors';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** The tabs at the bottom: the challenge of the day, the rankings of the week and the month, the duels */
type MultiTab = 'challenge' | 'weekly' | 'duels';
const DAY: Period[] = ['day'];
const WEEK_MONTH: Period[] = ['week', 'month'];

/** First visit: what the multiplayer mode is, then join or create a server */
function Intro() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const setIntroSeen = useMultiStore(s => s.setIntroSeen);
  const steps = ['multi.intro_step_server', 'multi.intro_step_daily', 'multi.intro_step_rank'] as const;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Animated.Text entering={FadeInDown.springify()} style={[styles.introEmoji]}>🏁</Animated.Text>
      <Text style={[styles.introTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.intro_title')}</Text>
      <Text style={[styles.introText, { color: colors.textMuted }]}>{t('multi.intro_desc')}</Text>
      {steps.map((key, i) => (
        <Animated.View key={key} entering={FadeInDown.delay(100 + i * 100).springify()} style={[styles.step, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.stepNumber, { color: colors.primaryText }]}>{i + 1}</Text>
          <Text style={[styles.stepText, { color: colors.text }]}>{t(key)}</Text>
        </Animated.View>
      ))}
      <Text style={[styles.introNote, { color: colors.textMuted }]}>{t('multi.intro_optional')}</Text>
      <Pressable
        onPress={() => { setIntroSeen(); router.push('/multi/join'); }}
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
      >
        <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>{t('multi.join_server')}</Text>
      </Pressable>
      <Pressable
        onPress={() => { setIntroSeen(); router.push('/multi/create'); }}
        style={[styles.secondaryButton, { borderColor: colors.primary }]}
        accessibilityRole="button"
      >
        <Text style={[styles.secondaryButtonText, { color: colors.primaryText }]}>{t('multi.create_server')}</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function MultiplayerScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const accounts = useMultiStore(s => s.accounts);
  const activeUrl = useMultiStore(s => s.activeUrl);
  const setActive = useMultiStore(s => s.setActive);
  const removeAccount = useMultiStore(s => s.removeAccount);
  const blockedByServer = useMultiStore(s => s.blocked);
  const setBlocked = useMultiStore(s => s.setBlocked);
  const account = useMultiStore(selectActiveAccount);
  const api = useMultiApi(account);

  const [today, setToday] = useState<Today | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [compat, setCompat] = useState<'ok' | 'update_app' | 'update_server'>('ok');
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [isInviteVisible, setInviteVisible] = useState(false);
  const [isNewDuelVisible, setNewDuelVisible] = useState(false);
  const [isDuelCodeVisible, setDuelCodeVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<RowPlayer | null>(null);
  const [tab, setTab] = useState<MultiTab>('challenge');
  const [rankingKind, setRankingKind] = useState<'challenges' | 'duels'>('challenges');
  const insets = useSafeAreaInsets();
  const serverDuels = useServerDuels(api);
  const joinable = joinableCount(serverDuels.duels);

  const load = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const [info, day] = await Promise.all([api.info(), api.today()]);
      setCompat(checkCompatibility(info, APP_VERSION));
      // The admin may have renamed the server in the app
      const current = selectActiveAccount(useMultiStore.getState());
      if (current && info.name && info.name !== current.name) useMultiStore.getState().updateAccount(current.url, { name: info.name });
      setToday(day);
      setClockOffset(day.serverNow - Date.now());
      // The clock on screen may have stood still while a game was played
      setNow(Date.now());
      setRefreshKey(k => k + 1);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Reload when coming back (from a game) or when the server changes
  useFocusEffect(useCallback(() => {
    setToday(null);
    void load();
  }, [load]));

  // Countdowns; every second while a game runs, its time is on the Resume button
  const gameRunning = today?.me?.status === 'playing' || !!today?.pending;
  useFocusEffect(useCallback(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), gameRunning ? 1000 : 30_000);
    return () => clearInterval(timer);
  }, [gameRunning]));
  // The puzzle of a server that was just started
  useEffect(() => {
    if (today?.status !== 'preparing') return;
    const retry = setTimeout(load, 5000);
    return () => clearTimeout(retry);
  }, [today?.status, load]);

  if (!account) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.title')} colors={colors} />
      <Intro />
    </View>
  );

  const serverNow = now + clockOffset;
  const blocked = (blockedByServer[account.url] ?? []).map(p => p.playerId);
  const me = today?.me;
  const finishedCount = today?.results.filter(r => r.status === 'won').length ?? 0;

  const forgetServer = () => {
    Alert.alert(t('multi.account_gone_title'), t('multi.account_gone_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('multi.leave_server'), style: 'destructive', onPress: () => removeAccount(account.url) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader
        title={t('multi.title')}
        colors={colors}
        right={(
          <View style={styles.headerActions}>
            <Pressable onPress={() => setInviteVisible(true)} accessibilityRole="button" accessibilityLabel={t('multi.invite')} hitSlop={8}>
              <Ionicons name="person-add" size={RFValue(21)} color={colors.primaryText} />
            </Pressable>
            <Pressable onPress={() => router.push('/multi/account')} accessibilityRole="button" accessibilityLabel={t('multi.account')} hitSlop={8}>
              <Ionicons name="person-circle" size={RFValue(25)} color={colors.primaryText} />
            </Pressable>
          </View>
        )}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading && !!today} onRefresh={load} tintColor={colors.primary} />}
      >
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={[styles.serverChip, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel={t('multi.server_a11y', { name: account.name, pseudo: account.pseudo })}
          accessibilityHint={t('multi.servers')}
        >
          <Text style={[styles.serverName, { color: colors.text }]} numberOfLines={1}>🖥️ {account.name} ▾</Text>
          <Text style={[styles.serverHost, { color: colors.textMuted }]} numberOfLines={1}>{serverHost(account.url)} · {account.pseudo}</Text>
        </Pressable>

        {compat !== 'ok' && (
          <Text style={[styles.banner, { backgroundColor: colors.warningSoft, color: colors.text }]}>{multiErrorMessage(t, compat)}</Text>
        )}

        {/* The challenge of the day */}
        {tab === 'challenge' && <>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!today && loading && <ActivityIndicator color={colors.primary} style={styles.cardState} />}

          {!today && !loading && !!error && (
            <View style={styles.cardState}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{multiErrorMessage(t, error)}</Text>
              {errorCode(error) === 'unauthorized' ? (
                <Pressable onPress={forgetServer} accessibilityRole="button">
                  <Text style={[styles.link, { color: colors.primaryText }]}>{t('multi.leave_server')}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={load} accessibilityRole="button">
                  <Text style={[styles.link, { color: colors.primaryText }]}>{t('multi.retry')}</Text>
                </Pressable>
              )}
            </View>
          )}

          {today && (
            <>
              <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.challenge_number', { number: today.number })}</Text>
              <Text style={[styles.cardMuted, { color: colors.textMuted }]}>
                {finishedCount === 0 ? t('multi.nobody_yet') : t('multi.players_done', { count: finishedCount })}
              </Text>

              {today.pending && (
                <Pressable
                  onPress={() => router.push(`/multi/play?date=${today.pending!.date}`)}
                  style={[styles.pending, { backgroundColor: colors.warningSoft }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.pendingText, { color: colors.text }]}>
                    ⏳ {t('multi.pending', { time: formatRemaining(t, today.pending.deadline - serverNow) })}
                  </Text>
                </Pressable>
              )}

              {today.status === 'preparing' && (
                <Text style={[styles.cardBody, { color: colors.textMuted }]}>⚙️ {t('multi.preparing')}</Text>
              )}

              {today.status === 'ready' && !me && (
                <>
                  <Pressable
                    onPress={() => router.push('/multi/play')}
                    disabled={compat !== 'ok'}
                    style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: compat === 'ok' ? 1 : 0.5 }]}
                    accessibilityRole="button"
                    accessibilityHint={t('multi.start_hint')}
                  >
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>{t('multi.start')}</Text>
                  </Pressable>
                  <Text style={[styles.cardMuted, styles.startHint, { color: colors.textMuted }]}>{t('multi.start_hint')}</Text>
                </>
              )}

              {me?.status === 'playing' && (
                <Pressable onPress={() => router.push(`/multi/play?date=${today.date}`)} style={[styles.primaryButton, { backgroundColor: colors.warning }]} accessibilityRole="button">
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    {t('multi.resume', { time: formatDuration(Math.max(0, serverNow - me.startedAt)) })}
                  </Text>
                </Pressable>
              )}

              {me?.status === 'won' && (
                <Text style={[styles.cardBody, { color: colors.success }]}>
                  ✅ {t('multi.my_win', { moves: me.moves, time: formatDuration(me.timeMs ?? 0), min: me.minMoves })}
                </Text>
              )}
              {(me?.status === 'abandoned' || me?.status === 'unfinished') && (
                <Text style={[styles.cardBody, { color: colors.textMuted }]}>{t(`multi.my_${me.status}`, { min: me.minMoves })}</Text>
              )}

              <Text style={[styles.cardMuted, { color: colors.textMuted, marginTop: RFValue(10) }]}>
                {t('multi.next_in', { time: formatRemaining(t, today.closesAt - serverNow) })}
              </Text>
            </>
          )}
        </View>

        {api && (
          <Leaderboard
            api={api}
            colors={colors}
            myPlayerId={account.playerId}
            refreshKey={refreshKey}
            blocked={blocked}
            onRowPress={setSelectedPlayer}
            periods={DAY}
            title={t('multi.leaderboard_day')}
          />
        )}
        </>}

        {/* The rankings of the week and of the month: challenges or duels */}
        {tab === 'weekly' && api && <>
          <View style={[styles.segment, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
            {(['challenges', 'duels'] as const).map(kind => (
              <Pressable
                key={kind}
                onPress={() => setRankingKind(kind)}
                style={[styles.segmentItem, kind === rankingKind && { backgroundColor: colors.surface }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: kind === rankingKind }}
              >
                <Ionicons name={kind === 'challenges' ? 'calendar' : 'flash'} size={16} color={kind === rankingKind ? colors.primaryText : colors.textMuted} />
                <Text style={[styles.segmentText, { color: kind === rankingKind ? colors.text : colors.textMuted }]}>{t(`multi.ranking_${kind}`)}</Text>
              </Pressable>
            ))}
          </View>
          {rankingKind === 'challenges' ? (
            <Leaderboard
              api={api}
              colors={colors}
              myPlayerId={account.playerId}
              refreshKey={refreshKey}
              blocked={blocked}
              onRowPress={setSelectedPlayer}
              periods={WEEK_MONTH}
              title={t('multi.ranking_challenges_title')}
            />
          ) : (
            <DuelLeaderboard api={api} colors={colors} myPlayerId={account.playerId} refreshKey={refreshKey} blocked={blocked} onRowPress={setSelectedPlayer} />
          )}
        </>}

        {/* The duels: live, and mine */}
        {tab === 'duels' && api && <>
          <DuelsCard
            duels={serverDuels.duels}
            loadedAt={serverDuels.loadedAt}
            colors={colors}
            myPlayerId={account.playerId}
            clockOffset={clockOffset}
            disabled={compat !== 'ok'}
            onCreate={() => setNewDuelVisible(true)}
            onCode={() => setDuelCodeVisible(true)}
            onOpen={(code) => router.push(code ? `/multi/duel?join=${code}` : '/multi/duel')}
          />
          <DuelHistoryCard
            api={api}
            colors={colors}
            myPlayerId={account.playerId}
            refreshKey={refreshKey}
            onReplay={(duelId) => router.push(`/multi/duel-replay?duelId=${duelId}`)}
          />
        </>}
      </ScrollView>

      <HomeTabBar
        colors={colors}
        bottomInset={insets.bottom}
        activeKey={tab}
        tabs={[
          { key: 'challenge', icon: 'calendar', label: t('multi.tab_challenge'), onPress: () => setTab('challenge') },
          { key: 'weekly', icon: 'trophy', label: t('multi.tab_weekly'), onPress: () => setTab('weekly') },
          {
            key: 'duels',
            icon: 'flash',
            label: t('multi.tab_duels'),
            badge: joinable,
            accessibilityLabel: joinable > 0 ? `${t('multi.tab_duels')}, ${t('multi.duel.open_count', { count: joinable })}` : t('multi.tab_duels'),
            onPress: () => setTab('duels'),
          },
        ]}
      />

      <ServerPickerSheet
        visible={isPickerVisible}
        accounts={accounts}
        activeUrl={activeUrl}
        colors={colors}
        isDark={isDark}
        onSelect={(url) => { setActive(url); setPickerVisible(false); }}
        onAdd={() => { setPickerVisible(false); router.push('/multi/join'); }}
        onClose={() => setPickerVisible(false)}
      />
      {api && (
        <PlayerActionsSheet
          player={selectedPlayer}
          isMe={selectedPlayer?.playerId === account.playerId}
          isBlocked={!!selectedPlayer && blocked.includes(selectedPlayer.playerId)}
          api={api}
          colors={colors}
          isDark={isDark}
          onReplay={(attemptId) => router.push(`/multi/replay?attemptId=${attemptId}`)}
          onToggleBlock={(player, block) => setBlocked(account.url, player, block)}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
      <NewDuelSheet
        visible={isNewDuelVisible}
        ready={serverDuels.ready}
        metrics={serverDuels.metrics}
        colors={colors}
        isDark={isDark}
        onClose={() => setNewDuelVisible(false)}
        onCreate={(difficulty, metric, isPrivate) => {
          setNewDuelVisible(false);
          router.push(`/multi/duel?create=${difficulty}&metric=${metric}${isPrivate ? '&private=1' : ''}`);
        }}
      />
      <DuelCodeSheet
        visible={isDuelCodeVisible}
        colors={colors}
        isDark={isDark}
        onClose={() => setDuelCodeVisible(false)}
        onJoin={(code) => {
          setDuelCodeVisible(false);
          router.push(`/multi/duel?join=${code}`);
        }}
      />
      {api && (
        <InviteSheet visible={isInviteVisible} account={account} api={api} colors={colors} isDark={isDark} onClose={() => setInviteVisible(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: RFValue(20),
    paddingBottom: RFValue(48),
  },
  introEmoji: {
    fontSize: RFValue(56),
    textAlign: 'center',
    marginTop: RFValue(8),
  },
  introTitle: {
    fontSize: RFValue(26),
    fontWeight: '800',
    textAlign: 'center',
    marginTop: RFValue(8),
  },
  introText: {
    fontSize: RFValue(15),
    lineHeight: RFValue(22),
    textAlign: 'center',
    marginVertical: RFValue(14),
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: RFValue(14),
    marginBottom: RFValue(10),
    gap: RFValue(12),
  },
  stepNumber: {
    fontSize: RFValue(20),
    fontWeight: '900',
    width: RFValue(22),
    textAlign: 'center',
  },
  stepText: {
    flex: 1,
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
    fontWeight: '600',
  },
  introNote: {
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
    textAlign: 'center',
    marginVertical: RFValue(10),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(14),
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: RFValue(9),
    borderRadius: 11,
  },
  segmentText: {
    fontSize: RFValue(14),
    fontWeight: '800',
  },
  primaryButton: {
    marginTop: RFValue(14),
    paddingVertical: RFValue(15),
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: RFValue(17),
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: RFValue(14),
    paddingVertical: RFValue(13),
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: RFValue(16),
    fontWeight: '700',
  },
  serverChip: {
    borderRadius: 14,
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(14),
    marginBottom: RFValue(14),
  },
  serverName: {
    fontSize: RFValue(16),
    fontWeight: '800',
  },
  serverHost: {
    fontSize: RFValue(12),
    marginTop: 2,
  },
  banner: {
    borderRadius: 12,
    padding: RFValue(12),
    fontSize: RFValue(14),
    fontWeight: '600',
    marginBottom: RFValue(14),
    overflow: 'hidden',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: RFValue(18),
  },
  cardState: {
    alignItems: 'center',
    paddingVertical: RFValue(20),
    gap: 8,
  },
  cardTitle: {
    fontSize: RFValue(22),
    fontWeight: '800',
  },
  cardMuted: {
    fontSize: RFValue(13),
    marginTop: 4,
  },
  startHint: {
    textAlign: 'center',
    marginTop: RFValue(8),
  },
  cardBody: {
    fontSize: RFValue(16),
    fontWeight: '700',
    marginTop: RFValue(14),
  },
  pending: {
    borderRadius: 12,
    padding: RFValue(12),
    marginTop: RFValue(12),
  },
  pendingText: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  errorText: {
    fontSize: RFValue(14),
    textAlign: 'center',
  },
  link: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
});
