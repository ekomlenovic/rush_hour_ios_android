import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import QrCode from '@/components/multi/QrCode';
import ShareIcon from './ShareIcon';
import { getShareUrl } from '@/utils/sharing';
import { copyLevelLink, shareLevel } from '@/utils/shareLevel';
import { haptics, Haptics } from '@/utils/haptics';
import type { Level } from '@/store/types';
import type { UiColors } from '@/theme';

interface Props {
  /** Level to share; the sheet is hidden when null */
  level: Level | null;
  /** Title shown and sent with the link (name or "Level 3") */
  title: string;
  colors: UiColors;
  isDark: boolean;
  onClose: () => void;
}

const QR_SIZE = 220;

/**
 * The one way to share a level, from the game and from My levels:
 * a QR code drawn on the phone (never an online service), the system share sheet, copy the link.
 */
export default function ShareLevelSheet({ level: shown, title: shownTitle, colors, isDark, onClose }: Props) {
  const { t } = useTranslation();
  // The last level stays drawn while the sheet slides away
  const last = useRef({ level: shown, title: shownTitle });
  if (shown) last.current = { level: shown, title: shownTitle };
  const { level, title } = last.current;

  const handleCopy = async () => {
    if (!level) return;
    await copyLevelLink(level);
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('common.copied'), t('common.link_copied'));
  };

  return (
    <BottomSheet visible={!!shown} title={t('game.share_level')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      {level ? (
        <View style={styles.content}>
          <Text style={[styles.levelName, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.levelStats, { color: colors.textMuted }]}>
            {t('custom_levels.stats_line', { size: level.gridSize, count: level.vehicles.length, moves: level.minMoves })}
          </Text>

          <View style={styles.qr}>
            <QrCode value={getShareUrl(level)} size={QR_SIZE} accessibilityLabel={t('game.qr_a11y', { name: title })} />
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('game.qr_hint')}</Text>

          <Pressable
            onPress={() => shareLevel(t, level, title)}
            style={[styles.mainBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <ShareIcon size={20} color={colors.onPrimary} />
            <Text style={[styles.mainBtnText, { color: colors.onPrimary }]}>{t('game.share_link')}</Text>
          </Pressable>
          <Pressable
            onPress={handleCopy}
            style={[styles.secondaryBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}
            accessibilityRole="button"
          >
            <Ionicons name="copy-outline" size={18} color={colors.primaryText} />
            <Text style={[styles.secondaryBtnText, { color: colors.primaryText }]}>{t('game.copy_url')}</Text>
          </Pressable>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  levelName: { fontSize: 18, fontWeight: '800', marginTop: -12 },
  levelStats: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  qr: { marginTop: 20, marginBottom: 12 },
  hint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20, marginBottom: 20 },
  mainBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  mainBtnText: { fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700' },
});
