import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Linking, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { haptics, Haptics } from '@/utils/haptics';
import { fixedColors, type UiColors } from '@/theme';

/** Time the "not recognized" message stays before the camera scans again */
const REJECT_PAUSE_MS = 1500;

interface Props {
  visible: boolean;
  title: string;
  /** Under the frame: what to point the camera at */
  hint: string;
  colors: UiColors;
  onClose: () => void;
  /** The text of a scanned QR code; false keeps scanning (not a code this screen reads) */
  onScanned: (data: string) => boolean;
}

/**
 * Full screen camera reading a QR code in the app (invitation, level link…), so a code shown
 * on another phone needs no trip through the system camera. Nothing leaves the phone
 */
export default function QrScanner({ visible, title, hint, colors, onClose, onScanned }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [rejected, setRejected] = useState(false);
  // The camera reports the same code many times a second: one at a time
  const locked = useRef(false);
  // The permission is asked once on opening, a refusal is not asked again right away
  const asked = useRef(false);

  useEffect(() => {
    if (!visible) {
      asked.current = false;
      return;
    }
    locked.current = false;
    setRejected(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || asked.current || !permission || permission.granted || !permission.canAskAgain) return;
    asked.current = true;
    requestPermission();
  }, [visible, permission, requestPermission]);

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (locked.current) return;
    locked.current = true;
    if (onScanned(data)) {
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      return;
    }
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setRejected(true);
    setTimeout(() => {
      locked.current = false;
      setRejected(false);
    }, REJECT_PAUSE_MS);
  };

  const renderBody = () => {
    if (!permission) return <ActivityIndicator color={fixedColors.onPrimary} style={styles.center} />;
    if (!permission.granted) {
      return (
        <View style={[styles.center, styles.denied]}>
          <Ionicons name="camera-outline" size={RFValue(48)} color={fixedColors.onPrimary} />
          <Text style={styles.deniedText}>{t('scanner.permission')}</Text>
          <Pressable
            onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
            style={[styles.button, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
              {permission.canAskAgain ? t('scanner.allow') : t('scanner.open_settings')}
            </Text>
          </Pressable>
        </View>
      );
    }
    return (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={rejected ? undefined : handleScan}
        />
        <View style={[styles.center, styles.frameWrap]} pointerEvents="none">
          <View style={[styles.frame, { borderColor: rejected ? colors.danger : fixedColors.onPrimary }]} />
          <Text style={styles.hint} accessibilityLiveRegion="polite">{rejected ? t('scanner.not_recognized') : hint}</Text>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        {visible ? renderBody() : null}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={8}>
            <Ionicons name="close" size={RFValue(24)} color={fixedColors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: fixedColors.shadow,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: fixedColors.overlay,
  },
  title: {
    flex: 1,
    fontSize: RFValue(18),
    fontWeight: '800',
    color: fixedColors.onPrimary,
  },
  close: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: fixedColors.overlay,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrap: {
    padding: 32,
  },
  frame: {
    width: RFValue(240),
    height: RFValue(240),
    borderWidth: 4,
    borderRadius: 24,
  },
  hint: {
    marginTop: RFValue(24),
    fontSize: RFValue(15),
    fontWeight: '700',
    textAlign: 'center',
    color: fixedColors.onPrimary,
    backgroundColor: fixedColors.overlayStrong,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  denied: {
    paddingHorizontal: 32,
    gap: RFValue(16),
  },
  deniedText: {
    fontSize: RFValue(16),
    lineHeight: RFValue(22),
    textAlign: 'center',
    color: fixedColors.onPrimary,
  },
  button: {
    paddingVertical: RFValue(13),
    paddingHorizontal: RFValue(24),
    borderRadius: 16,
  },
  buttonText: {
    fontSize: RFValue(16),
    fontWeight: '800',
  },
});
