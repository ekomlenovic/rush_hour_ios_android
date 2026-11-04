import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCloudSyncStore, type CloudSyncStatus } from '@/store/cloudSyncStore';
import { isCloudSyncAvailable, signInAndSync, syncProgress } from '@/utils/cloudSync';
import { haptics, Haptics } from '@/utils/haptics';
import type { UiColors } from '@/theme';
import { settingsStyles as styles } from './styles';

interface Props {
  colors: UiColors;
}

/**
 * Options → Sauvegarde, Android installed from Google Play only (issue 320): the automatic sync with
 * Play Jeux, on by default, that the player can turn off; where it stands, and a sign-in when the
 * player is not signed in to Play Jeux. Nothing on iOS, the web or the APK from GitHub.
 */
export default function CloudSyncRow({ colors }: Props) {
  const { t, i18n } = useTranslation();
  const enabled = useCloudSyncStore(s => s.enabled);
  const status = useCloudSyncStore(s => s.status);
  const lastSyncAt = useCloudSyncStore(s => s.lastSyncAt);
  const setEnabled = useCloudSyncStore(s => s.setEnabled);
  if (!isCloudSyncAvailable()) return null;

  const toggle = (value: boolean) => {
    haptics.selectionAsync();
    setEnabled(value);
    if (value) syncProgress('manual');
  };

  const statusText = (current: CloudSyncStatus): string => {
    if (!enabled) return t('save.cloud_off');
    if (current === 'syncing') return t('save.cloud_syncing');
    if (current === 'signed_out') return t('save.cloud_signed_out');
    if (current === 'remote_newer') return t('save.cloud_remote_newer');
    if (current === 'too_big') return t('save.cloud_too_big');
    if (current === 'failed') return t('save.cloud_failed');
    if (lastSyncAt) {
      const date = new Date(lastSyncAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
      return t('save.cloud_last_sync', { date });
    }
    return t('save.cloud_on');
  };

  const linkButton = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={{ paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={[styles.settingSub, { color: colors.primaryText, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={[styles.settingRow, { marginBottom: 4 }]}>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('save.cloud_title')}</Text>
          <Text style={[styles.settingSub, { color: colors.textMuted }]}>{t('save.cloud_desc')}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
          accessibilityLabel={t('save.cloud_title')}
        />
      </View>
      <Text style={[styles.settingSub, { color: colors.textMuted }]} accessibilityLiveRegion="polite">{statusText(status)}</Text>
      {enabled && status === 'signed_out' && linkButton(t('save.cloud_sign_in_btn'), () => {
        haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        signInAndSync();
      })}
      {enabled && status !== 'signed_out' && status !== 'syncing' && linkButton(t('save.cloud_sync_now_btn'), () => {
        haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        syncProgress('manual');
      })}
    </View>
  );
}
