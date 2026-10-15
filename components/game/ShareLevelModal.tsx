import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Image } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { getQRCodeUrl } from '@/utils/sharing';
import { fixedColors, type UiColors } from '@/theme';

interface Props {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  shareUrl: string;
  onShare: () => void;
  onCopyLink: () => void;
  onClose: () => void;
}

/** QR code and link to share the current level */
export default function ShareLevelModal({ visible, colors, isDark, shareUrl, onShare, onCopyLink, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInDown.springify()} style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]} accessibilityRole="header">{t('game.share_level')}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={8}>
              <Text style={{ fontSize: 20, color: colors.textMuted, padding: 8 }}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.qrContainer}>
              <Image
                  source={{ uri: getQRCodeUrl(shareUrl) }}
                  accessibilityIgnoresInvertColors
                  accessible={false}
                   style={styles.qrCode}
              />
              <Text style={[styles.qrHint, { color: colors.textMuted }]}>{t('game.qr_hint')}</Text>
          </View>

          <View style={styles.shareButtonsRow}>
              <Pressable
                style={[styles.mainBtn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={onShare}
                accessibilityRole="button"
              >
                 <Text style={styles.mainBtnText}>{t('game.share_link')}</Text>
              </Pressable>
              <Pressable
                style={[styles.mainBtn, { backgroundColor: colors.textMuted, flex: 1 }]}
                onPress={onCopyLink}
                accessibilityRole="button"
              >
                 <Text style={styles.mainBtnText}>{t('game.copy_url')}</Text>
              </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: fixedColors.overlay,
  },
  modalContent: {
    width: '85%',
    borderRadius: 24,
    padding: 24,
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  qrContainer: {
    alignItems: 'center',
    padding: 10,
  },
  qrCode: {
    width: 250,
    height: 250,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: fixedColors.qrBackground,
  },
  qrHint: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  mainBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  mainBtnText: {
    color: fixedColors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
});
