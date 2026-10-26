import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MultiApi } from '@/utils/multi/api';
import { useMultiStore } from '@/store/multiStore';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import AdminButton from './AdminButton';
import { useAdminSettings } from './useAdminSettings';
import { adminStyles as styles } from './styles';
import LoadingIndicator from '@/components/LoadingIndicator';

const SERVER_NAME_MAX = 40;

interface Props { api: MultiApi; colors: UiColors; serverUrl: string }

/** The name of the server, shown to the players */
export default function AdminServer({ api, colors, serverUrl }: Props) {
  const { t } = useTranslation();
  const updateAccount = useMultiStore(s => s.updateAccount);
  const { settings, update } = useAdminSettings(api);
  const [name, setName] = useState('');

  useEffect(() => { if (settings) setName(settings.serverName); }, [settings?.serverName]);

  if (!settings) return <LoadingIndicator />;

  const nameChanged = name.trim() !== settings.serverName && name.trim().length > 0;
  const saveName = async () => {
    const next = await update({ serverName: name.trim() });
    if (next) {
      setName(next.serverName);
      updateAccount(serverUrl, { name: next.serverName });
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_server_name')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={SERVER_NAME_MAX}
        returnKeyType="done"
        onSubmitEditing={() => nameChanged && void saveName()}
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: RFValue(8), marginTop: RFValue(8), color: colors.text, fontSize: RFValue(15) }}
        accessibilityLabel={t('multi.admin_server_name')}
      />
      {nameChanged && (
        <View style={styles.actions}>
          <AdminButton label={t('common.ok')} onPress={saveName} background={colors.primary} color={colors.onPrimary} />
          <AdminButton label={t('common.cancel')} onPress={() => setName(settings.serverName)} background={colors.neutralSoft} color={colors.text} />
        </View>
      )}
    </View>
  );
}
