import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, Switch, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MultiApi } from '@/utils/multi/api';
import { buildInviteLink } from '@/utils/multi/serverUrl';
import type { UiColors } from '@/theme';
import { multiErrorMessage } from '../errors';
import AdminButton from './AdminButton';
import { useAdminRefresh } from './AdminPage';
import { useAdminSettings } from './useAdminSettings';
import { adminStyles as styles } from './styles';
import LoadingIndicator from '@/components/LoadingIndicator';

interface Props { api: MultiApi; colors: UiColors; serverUrl: string }

/** Who can join: open or closed, who can invite, the invitation code */
export default function AdminInvites({ api, colors, serverUrl }: Props) {
  const { t } = useTranslation();
  const { settings, save } = useAdminSettings(api);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const loadCode = useCallback(() => api.invite().then(r => setInviteCode(r.inviteCode)).catch(() => {}), [api]);
  useEffect(() => { void loadCode(); }, [loadCode]);
  useAdminRefresh(loadCode);

  const regenerate = () => Alert.alert(t('multi.admin_new_invite_title'), t('multi.admin_new_invite_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('multi.renew_code'), style: 'destructive', onPress: async () => {
        try {
          setInviteCode((await api.admin.newInviteCode()).inviteCode);
        } catch (e) {
          Alert.alert(t('common.error'), multiErrorMessage(t, e));
        }
      },
    },
  ]);

  if (!settings) return <LoadingIndicator />;

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  return (
    <View>
      <View style={card}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_join_open')}</Text>
          <Switch value={settings.joinOpen} onValueChange={v => save({ joinOpen: v })} accessibilityLabel={t('multi.admin_join_open')} />
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_invites_admin_only')}</Text>
          <Switch value={settings.invitesAdminOnly} onValueChange={v => save({ invitesAdminOnly: v })} accessibilityLabel={t('multi.admin_invites_admin_only')} />
        </View>
      </View>
      <View style={card}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.invite_code')}</Text>
        <Text style={[styles.title, { color: colors.text, marginTop: 4 }]} selectable>{inviteCode ?? '…'}</Text>
        <View style={styles.actions}>
          {inviteCode && (
            <AdminButton
              label={t('multi.invite_share')}
              icon="share-outline"
              onPress={() => Share.share({ message: buildInviteLink(serverUrl, inviteCode) })}
              background={colors.primary}
              color={colors.onPrimary}
            />
          )}
          <AdminButton label={t('multi.admin_new_invite')} onPress={regenerate} background={colors.dangerSoft} color={colors.danger} />
        </View>
      </View>
    </View>
  );
}
