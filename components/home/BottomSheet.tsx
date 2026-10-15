import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RFValue } from '@/utils/responsive';
import { HomeColors } from './colors';

interface Props {
  visible: boolean;
  title: string;
  colors: HomeColors;
  isDark: boolean;
  onClose: () => void;
  /** Android back button; not set, the back button does not close the sheet */
  onRequestClose?: () => void;
  children: React.ReactNode;
}

/** Sheet sliding from the bottom over a blurred background, with a title and a close button */
export default function BottomSheet({ visible, title, colors, isDark, onClose, onRequestClose, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onRequestClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF', paddingBottom: Math.max(48, insets.bottom + 24) }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: RFValue(20), color: colors.sub, padding: 8 }}>✕</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: RFValue(24),
    fontWeight: '800',
  },
});
