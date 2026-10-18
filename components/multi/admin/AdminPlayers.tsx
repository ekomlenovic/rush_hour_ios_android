import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import type { AdminPlayer, MultiApi } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import { multiErrorMessage } from '../errors';
import AdminButton from './AdminButton';
import { adminStyles as styles } from './styles';

interface Props { api: MultiApi; colors: UiColors; myPlayerId: number }

/** The players: rename, exclude or bring back, give a new recovery code, delete their account */
export default function AdminPlayers({ api, colors, myPlayerId }: Props) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [editing, setEditing] = useState<{ id: number; pseudo: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setPlayers((await api.admin.players()).players);
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
      setPlayers([]);
    }
  }, [api, t]);

  useEffect(() => { void load(); }, [load]);

  const guard = async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
    }
  };

  const rename = () => editing && guard(async () => {
    await api.admin.updatePlayer(editing.id, { pseudo: editing.pseudo });
    setEditing(null);
  });

  const toggleBan = (player: AdminPlayer) => {
    if (player.banned) return guard(async () => { await api.admin.updatePlayer(player.id, { banned: false }); });
    Alert.alert(t('multi.admin_ban_title'), t('multi.admin_ban_body', { pseudo: player.pseudo }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('multi.admin_ban'), style: 'destructive', onPress: () => guard(async () => { await api.admin.updatePlayer(player.id, { banned: true }); }) },
    ]);
  };

  const transfer = (player: AdminPlayer) => Alert.alert(t('multi.admin_transfer_title'), t('multi.admin_transfer_body', { pseudo: player.pseudo }), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.continue'), onPress: () => guard(async () => {
        const { recoveryCode } = await api.admin.transferCode(player.id);
        await Clipboard.setStringAsync(recoveryCode);
        Alert.alert(t('multi.admin_transfer_done_title'), t('multi.admin_transfer_done_body', { pseudo: player.pseudo, code: recoveryCode }));
      }),
    },
  ]);

  const remove = (player: AdminPlayer) => Alert.alert(t('multi.admin_delete_player_title'), t('multi.admin_delete_player_body', { pseudo: player.pseudo }), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: () => guard(async () => { await api.admin.deletePlayer(player.id); }) },
  ]);

  if (!players) return <ActivityIndicator color={colors.primary} />;

  return (
    <View>
      {players.map(player => (
        <View key={player.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: player.banned ? 0.7 : 1 }]}>
          {editing?.id === player.id ? (
            <TextInput
              value={editing.pseudo}
              onChangeText={pseudo => setEditing({ id: player.id, pseudo })}
              maxLength={20}
              autoFocus
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: RFValue(8), color: colors.text, fontSize: RFValue(15) }}
              accessibilityLabel={t('multi.pseudo')}
            />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {player.isAdmin && <Ionicons name="construct-outline" size={RFValue(15)} color={colors.primaryText} />}
              <Text style={[styles.title, { color: colors.text }]}>
                {player.pseudo}{player.id === myPlayerId ? ` (${t('multi.you')})` : ''}
              </Text>
            </View>
          )}
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {t('multi.admin_player_games', { count: player.games })}
            {player.reports > 0 ? ` · ${t('multi.admin_player_reports', { count: player.reports })}` : ''}
          </Text>
          {player.banned && <Text style={[styles.warning, { color: colors.danger }]}>{t('multi.admin_banned')}</Text>}
          <View style={styles.actions}>
            {editing?.id === player.id ? (
              <>
                <AdminButton label={t('common.ok')} onPress={rename} background={colors.primary} color={colors.onPrimary} />
                <AdminButton label={t('common.cancel')} onPress={() => setEditing(null)} background={colors.neutralSoft} color={colors.text} />
              </>
            ) : (
              <AdminButton label={t('multi.admin_rename')} onPress={() => setEditing({ id: player.id, pseudo: player.pseudo })} background={colors.neutralSoft} color={colors.text} />
            )}
            <AdminButton label={t('multi.admin_transfer')} onPress={() => transfer(player)} background={colors.neutralSoft} color={colors.text} />
            {!player.isAdmin && (
              <AdminButton
                label={player.banned ? t('multi.admin_unban') : t('multi.admin_ban')}
                onPress={() => toggleBan(player)}
                background={player.banned ? colors.successSoft : colors.dangerSoft}
                color={player.banned ? colors.success : colors.danger}
              />
            )}
            {!player.isAdmin && (
              <AdminButton label={t('multi.admin_delete_player')} onPress={() => remove(player)} background={colors.dangerSoft} color={colors.danger} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
