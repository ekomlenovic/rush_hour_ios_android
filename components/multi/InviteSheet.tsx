import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, ActivityIndicator, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import { buildInviteLink } from '@/utils/multi/serverUrl';
import type { MultiApi } from '@/utils/multi/api';
import type { ServerAccount } from '@/store/multiStore';
import type { UiColors } from '@/theme';
import QrCode from './QrCode';
import ShareIcon from '@/components/share/ShareIcon';
import { multiErrorMessage } from './errors';

interface Props {
  visible: boolean;
  account: ServerAccount;
  api: MultiApi;
  colors: UiColors;
  isDark: boolean;
  onClose: () => void;
}

/** Invite a friend: a QR code to scan with the camera of the phone, or the link to send */
export default function InviteSheet({ visible, account, api, colors, isDark, onClose }: Props) {
  const { t } = useTranslation();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!visible) return;
    setLink(null);
    setError(null);
    api.invite()
      .then(({ inviteCode }) => setLink(buildInviteLink(account.url, inviteCode)))
      .catch(setError);
  }, [visible, api, account.url]);

  const share = async () => {
    if (!link) return;
    await Share.share({ message: t('multi.invite_message', { server: account.name, link }) });
  };

  const copy = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    Alert.alert(t('common.copied'), t('common.link_copied'));
  };

  return (
    <BottomSheet visible={visible} title={t('multi.invite_title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.text, { color: colors.textMuted }]}>{t('multi.invite_desc', { server: account.name })}</Text>
      <View style={styles.qr}>
        {link ? <QrCode value={link} size={RFValue(220)} accessibilityLabel={t('multi.invite_qr_a11y')} />
          : error ? <Text style={[styles.text, { color: colors.danger }]}>{multiErrorMessage(t, error)}</Text>
          : <ActivityIndicator color={colors.primary} />}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={share} disabled={!link} style={[styles.button, { backgroundColor: colors.primary, opacity: link ? 1 : 0.5 }]} accessibilityRole="button">
          <ShareIcon size={RFValue(18)} color={colors.onPrimary} />
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('multi.invite_share')}</Text>
        </Pressable>
        <Pressable onPress={copy} disabled={!link} style={[styles.button, { backgroundColor: colors.neutralSoft, opacity: link ? 1 : 0.5 }]} accessibilityRole="button">
          <Text style={[styles.buttonText, { color: colors.text }]}>{t('multi.invite_copy')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
    textAlign: 'center',
  },
  qr: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: RFValue(240),
    marginVertical: RFValue(16),
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: RFValue(13),
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
});
