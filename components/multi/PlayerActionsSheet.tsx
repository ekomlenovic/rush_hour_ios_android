import React, { useState } from 'react';
import { Text, StyleSheet, Pressable, Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import type { MultiApi } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import type { RowPlayer } from './Leaderboard';
import { multiErrorMessage } from './errors';
import { REPORT_REASONS, type ReportReason } from './verdict';
import IconText, { type IconName } from './IconText';

interface Props {
  player: RowPlayer | null;
  isMe: boolean;
  isBlocked: boolean;
  api: MultiApi;
  colors: UiColors;
  isDark: boolean;
  onReplay: (attemptId: number) => void;
  onToggleBlock: (player: { playerId: number; pseudo: string }, blocked: boolean) => void;
  onClose: () => void;
}

/** What can be done about a player of the leaderboard: watch their game, report or block them */
export default function PlayerActionsSheet({ player, isMe, isBlocked, api, colors, isDark, onReplay, onToggleBlock, onClose }: Props) {
  const { t } = useTranslation();
  const [reporting, setReporting] = useState(false);

  const close = () => {
    setReporting(false);
    onClose();
  };

  const report = async (reason: ReportReason) => {
    if (!player) return;
    try {
      await api.report(player.playerId, reason);
      close();
      Alert.alert(t('multi.report_sent_title'), t('multi.report_sent_body'));
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
    }
  };

  const action = (label: string, onPress: () => void, tint = colors.text, icon?: IconName) => (
    <Pressable key={label} onPress={onPress} style={[styles.action, { borderColor: colors.border }]} accessibilityRole="button">
      {icon ? <IconText icon={icon} color={tint} textStyle={styles.actionText}>{label}</IconText>
        : <Text style={[styles.actionText, { color: tint }]}>{label}</Text>}
    </Pressable>
  );

  return (
    <BottomSheet visible={!!player} title={player?.pseudo ?? ''} colors={colors} isDark={isDark} onClose={close} onRequestClose={close}>
      {player && !reporting && (
        <View>
          {player.won && player.attemptId !== undefined && action(t('multi.watch_game'), () => { const id = player.attemptId!; close(); onReplay(id); }, colors.text, 'play')}
          {!isMe && action(t('multi.report'), () => setReporting(true), colors.warning, 'flag')}
          {!isMe && action(
            isBlocked ? t('multi.unblock') : t('multi.block'),
            () => { onToggleBlock({ playerId: player.playerId, pseudo: player.pseudo }, !isBlocked); close(); },
            colors.danger,
            isBlocked ? undefined : 'ban',
          )}
          {!isMe && <Text style={[styles.help, { color: colors.textMuted }]}>{t('multi.block_help')}</Text>}
        </View>
      )}
      {player && reporting && (
        <View>
          <Text style={[styles.help, { color: colors.textMuted, marginBottom: 12 }]}>{t('multi.report_help')}</Text>
          {REPORT_REASONS.map(reason => action(t(`multi.report_reason.${reason}`), () => report(reason)))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  action: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: RFValue(13),
    paddingHorizontal: RFValue(14),
    marginBottom: RFValue(10),
  },
  actionText: {
    fontSize: RFValue(16),
    fontWeight: '700',
  },
  help: {
    fontSize: RFValue(12),
    lineHeight: RFValue(17),
  },
});
