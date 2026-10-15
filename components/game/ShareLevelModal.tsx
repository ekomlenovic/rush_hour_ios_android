import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Image } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { getQRCodeUrl } from '@/utils/sharing';
import { GameColors } from './colors';

interface Props {
  visible: boolean;
  colors: GameColors;
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
        <Animated.View entering={FadeInDown.springify()} style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('game.share_level')}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 20, color: colors.sub, padding: 8 }}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.qrContainer}>
              <Image
                  source={{ uri: getQRCodeUrl(shareUrl) }}
                   style={styles.qrCode}
              />
              <Text style={[styles.qrHint, { color: colors.sub }]}>{t('game.qr_hint')}</Text>
          </View>

          <View style={styles.shareButtonsRow}>
              <Pressable
                style={[styles.mainBtn, { backgroundColor: colors.accent, flex: 1 }]}
                onPress={onShare}
              >
                 <Text style={styles.mainBtnText}>{t('game.share_link')}</Text>
              </Pressable>
              <Pressable
                style={[styles.mainBtn, { backgroundColor: colors.sub, flex: 1 }]}
                onPress={onCopyLink}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
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
    backgroundColor: '#FFF',
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
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
});
