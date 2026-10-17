import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { formatDuration } from '@/utils/date';
import type { DuelListing, MultiApi } from '@/utils/multi/api';
import type { UiColors } from '@/theme';

/** The list follows the server this often while the screen is shown */
const REFRESH_MS = 4000;

interface Props {
  api: MultiApi;
  colors: UiColors;
  myPlayerId: number;
  /** Server clock minus phone clock, for the time of the duels being played */
  clockOffset: number;
  disabled: boolean;
  onCreate: () => void;
  onCode: () => void;
  /** Join an open duel, or go back to mine (null code: the one I am in) */
  onOpen: (code: string | null) => void;
}

/**
 * The duels of the server, under the challenge of the day: the open ones, joined in
 * one tap (no code needed), and the ones being played. The list grows with the duels.
 */
export default function DuelsCard({ api, colors, myPlayerId, clockOffset, disabled, onCreate, onCode, onOpen }: Props) {
  const { t } = useTranslation();
  const [duels, setDuels] = useState<DuelListing[] | null>(null);
  const [now, setNow] = useState(Date.now());

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = () => api.duels()
      .then(r => { if (active) { setDuels(r.duels); setNow(Date.now()); } })
      // An older server has no duels: the card stays empty
      .catch(() => { if (active) setDuels([]); });
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, [api]));

  const open = duels?.filter(d => d.status === 'waiting' && !d.mine) ?? [];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">⚔️ {t('multi.duel.title')}</Text>
        {open.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{t('multi.duel.open_count', { count: open.length })}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.duel.card_desc')}</Text>

      {duels !== null && duels.length === 0 && (
        <Text style={[styles.empty, { color: colors.textMuted }]}>{t('multi.duel.none_open')}</Text>
      )}

      {duels?.map(duel => (
        <Animated.View key={`${duel.createdAt}-${duel.players[0]?.id}`} entering={FadeInDown.springify()} exiting={FadeIn.duration(0)} layout={LinearTransition}>
          <DuelRow duel={duel} colors={colors} myPlayerId={myPlayerId} serverNow={now + clockOffset} disabled={disabled} onOpen={onOpen} />
        </Animated.View>
      ))}

      <Pressable
        onPress={onCreate}
        disabled={disabled}
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}
        accessibilityRole="button"
        accessibilityHint={t('multi.duel.button_hint')}
      >
        <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>{t('multi.duel.create')}</Text>
      </Pressable>
      <Pressable onPress={onCode} disabled={disabled} style={styles.link} accessibilityRole="button">
        <Text style={[styles.linkText, { color: colors.primaryText }]}>{t('multi.duel.have_code')}</Text>
      </Pressable>
    </View>
  );
}

interface RowProps {
  duel: DuelListing;
  colors: UiColors;
  myPlayerId: number;
  serverNow: number;
  disabled: boolean;
  onOpen: (code: string | null) => void;
}

function DuelRow({ duel, colors, myPlayerId, serverNow, disabled, onOpen }: RowProps) {
  const { t } = useTranslation();
  const [first, second] = duel.players;
  const name = (p: { id: number; pseudo: string }) => (p.id === myPlayerId ? t('multi.duel.me') : p.pseudo);
  const difficulty = t(`difficulty.${duel.difficulty}`);

  if (duel.status === 'waiting') {
    const label = duel.mine ? t('multi.duel.my_open') : first.pseudo;
    const action = duel.mine ? t('multi.duel.back_to_it') : t('multi.duel.fight');
    return (
      <Pressable
        onPress={() => onOpen(duel.mine ? null : duel.code)}
        disabled={disabled}
        style={[styles.row, { backgroundColor: duel.mine ? colors.primarySoft : colors.card }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${difficulty}${duel.private ? `, ${t('multi.duel.private')}` : ''}, ${action}`}
      >
        <View style={styles.rowMain}>
          <Text style={[styles.pseudo, { color: colors.text }]} numberOfLines={1}>{duel.private ? '🔒 ' : ''}{label}</Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>{difficulty} · {t('multi.duel.waiting_short')}</Text>
        </View>
        <View style={[styles.action, { backgroundColor: duel.mine ? colors.neutralSoft : colors.primary }]}>
          <Text style={[styles.actionText, { color: duel.mine ? colors.text : colors.onPrimary }]}>{action}</Text>
        </View>
      </Pressable>
    );
  }

  const time = duel.startsAt !== null && serverNow > duel.startsAt ? formatDuration(serverNow - duel.startsAt) : null;
  const versus = second ? t('multi.duel.vs', { a: name(first), b: name(second) }) : name(first);
  return (
    <Pressable
      onPress={() => onOpen(null)}
      disabled={!duel.mine || disabled}
      style={[styles.row, { backgroundColor: duel.mine ? colors.warningSoft : 'transparent' }]}
      accessibilityRole={duel.mine ? 'button' : 'text'}
      accessibilityLabel={`${versus}, ${difficulty}, ${t('multi.duel.playing_short')}${duel.mine ? `, ${t('multi.duel.back_to_it')}` : ''}`}
    >
      <View style={styles.rowMain}>
        <Text style={[styles.pseudo, { color: colors.text }]} numberOfLines={1}>{versus}</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {difficulty} · {t('multi.duel.playing_short')}{time ? ` · ⏱ ${time}` : ''}
        </Text>
      </View>
      {duel.mine && (
        <View style={[styles.action, { backgroundColor: colors.warning }]}>
          <Text style={[styles.actionText, { color: colors.onPrimary }]}>{t('multi.duel.back_to_it')}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: RFValue(18),
    marginTop: RFValue(16),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: RFValue(8),
  },
  title: {
    fontSize: RFValue(22),
    fontWeight: '800',
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: RFValue(10),
  },
  badgeText: {
    fontSize: RFValue(12),
    fontWeight: '800',
  },
  muted: {
    fontSize: RFValue(13),
    marginTop: 4,
    marginBottom: RFValue(8),
  },
  empty: {
    fontSize: RFValue(14),
    textAlign: 'center',
    paddingVertical: RFValue(14),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(12),
    borderRadius: 12,
    marginTop: RFValue(6),
  },
  rowMain: {
    flex: 1,
  },
  pseudo: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  detail: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginTop: 2,
  },
  action: {
    paddingVertical: RFValue(8),
    paddingHorizontal: RFValue(12),
    borderRadius: 10,
  },
  actionText: {
    fontSize: RFValue(13),
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
  link: {
    alignItems: 'center',
    paddingTop: RFValue(12),
  },
  linkText: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
});
