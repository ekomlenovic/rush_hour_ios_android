import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, TextInput, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import type { AdminPlayer, MultiApi } from '@/utils/multi/api';
import { matchesPseudo } from '@/utils/multi/format';
import type { UiColors } from '@/theme';
import BottomSheet from '@/components/home/BottomSheet';
import { multiErrorMessage } from '../errors';
import AdminButton from './AdminButton';
import { useAdminRefresh } from './AdminPage';
import { adminStyles as styles } from './styles';
import LoadingIndicator from '@/components/LoadingIndicator';

/** iOS drops an alert shown while a sheet is sliding away */
const AFTER_SHEET_MS = 350;

interface Props { api: MultiApi; colors: UiColors; isDark: boolean; myPlayerId: number }

/** The players, found by their nickname; a touch gives the actions: rename, recovery code, exclude, delete */
export default function AdminPlayers({ api, colors, isDark, myPlayerId }: Props) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlayers((await api.admin.players()).players);
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
      setPlayers(p => p ?? []);
    }
  }, [api, t]);

  useEffect(() => { void load(); }, [load]);
  useAdminRefresh(load);

  const selected = players?.find(p => p.id === selectedId) ?? null;
  const close = () => {
    setSelectedId(null);
    setRenaming(null);
  };
  /** The sheet closes, then the alert shows */
  const thenAlert = (...args: Parameters<typeof Alert.alert>) => {
    close();
    setTimeout(() => Alert.alert(...args), AFTER_SHEET_MS);
  };

  const guard = async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
    }
  };

  const rename = (player: AdminPlayer) => renaming !== null && guard(async () => {
    await api.admin.updatePlayer(player.id, { pseudo: renaming });
    setRenaming(null);
  });

  const toggleBan = (player: AdminPlayer) => {
    if (player.banned) {
      close();
      return guard(async () => { await api.admin.updatePlayer(player.id, { banned: false }); });
    }
    thenAlert(t('multi.admin_ban_title'), t('multi.admin_ban_body', { pseudo: player.pseudo }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('multi.admin_ban'), style: 'destructive', onPress: () => guard(async () => { await api.admin.updatePlayer(player.id, { banned: true }); }) },
    ]);
  };

  const transfer = (player: AdminPlayer) => {
    thenAlert(t('multi.admin_transfer_title'), t('multi.admin_transfer_body', { pseudo: player.pseudo }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.continue'), onPress: () => guard(async () => {
          const { recoveryCode } = await api.admin.transferCode(player.id);
          await Clipboard.setStringAsync(recoveryCode);
          Alert.alert(t('multi.admin_transfer_done_title'), t('multi.admin_transfer_done_body', { pseudo: player.pseudo, code: recoveryCode }));
        }),
      },
    ]);
  };

  const remove = (player: AdminPlayer) => {
    thenAlert(t('multi.admin_delete_player_title'), t('multi.admin_delete_player_body', { pseudo: player.pseudo }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => guard(async () => { await api.admin.deletePlayer(player.id); }) },
    ]);
  };

  if (!players) return <LoadingIndicator />;

  const shown = players.filter(p => matchesPseudo(p.pseudo, query));
  const details = (p: AdminPlayer) => [
    t('multi.admin_player_games', { count: p.games }),
    p.reports > 0 ? t('multi.admin_player_reports', { count: p.reports }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <View>
      <View style={[local.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={RFValue(16)} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('multi.admin_players_search')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={[local.searchInput, { color: colors.text }]}
          accessibilityLabel={t('multi.admin_players_search')}
        />
      </View>
      {shown.length === 0 && <Text style={[styles.empty, { color: colors.textMuted }]}>{t('multi.admin_players_none')}</Text>}
      {shown.length > 0 && (
        <View style={[local.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {shown.map((player, i) => (
            <Pressable
              key={player.id}
              onPress={() => setSelectedId(player.id)}
              style={({ pressed }) => [
                local.player,
                i < shown.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={[player.pseudo, details(player), player.banned ? t('multi.admin_banned') : null].filter(Boolean).join(', ')}
            >
              <View style={{ flex: 1, opacity: player.banned ? 0.6 : 1 }}>
                <View style={local.name}>
                  {player.isAdmin && <Ionicons name="construct-outline" size={RFValue(14)} color={colors.primaryText} />}
                  <Text style={[local.pseudo, { color: colors.text }]} numberOfLines={1}>
                    {player.pseudo}{player.id === myPlayerId ? ` (${t('multi.you')})` : ''}
                  </Text>
                </View>
                <Text style={[styles.muted, { color: colors.textMuted }]}>{details(player)}</Text>
              </View>
              {player.banned && (
                <View style={[local.tag, { backgroundColor: colors.dangerSoft }]}>
                  <Text style={[local.tagText, { color: colors.danger }]}>{t('multi.admin_banned')}</Text>
                </View>
              )}
              {player.reports > 0 && !player.banned && <Ionicons name="flag" size={RFValue(14)} color={colors.warning} />}
              <Ionicons name="ellipsis-horizontal" size={RFValue(18)} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      <BottomSheet visible={!!selected} title={selected?.pseudo ?? ''} colors={colors} isDark={isDark} onClose={close} onRequestClose={close}>
        {selected && (
          <View>
            <Text style={[styles.muted, { color: colors.textMuted, marginBottom: RFValue(12) }]}>{details(selected)}</Text>
            {renaming !== null ? (
              <>
                <TextInput
                  value={renaming}
                  onChangeText={setRenaming}
                  maxLength={20}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => rename(selected)}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: RFValue(10), color: colors.text, fontSize: RFValue(15) }}
                  accessibilityLabel={t('multi.pseudo')}
                />
                <View style={styles.actions}>
                  <AdminButton label={t('common.ok')} onPress={() => rename(selected)} background={colors.primary} color={colors.onPrimary} />
                  <AdminButton label={t('common.cancel')} onPress={() => setRenaming(null)} background={colors.neutralSoft} color={colors.text} />
                </View>
              </>
            ) : (
              <>
                <SheetAction icon="pencil" label={t('multi.admin_rename')} onPress={() => setRenaming(selected.pseudo)} colors={colors} />
                <SheetAction icon="key-outline" label={t('multi.admin_transfer')} onPress={() => transfer(selected)} colors={colors} />
                {!selected.isAdmin && (
                  <SheetAction
                    icon={selected.banned ? 'checkmark-circle-outline' : 'ban'}
                    label={selected.banned ? t('multi.admin_unban') : t('multi.admin_ban')}
                    onPress={() => toggleBan(selected)}
                    colors={colors}
                    color={selected.banned ? colors.success : colors.warning}
                  />
                )}
                {!selected.isAdmin && (
                  <SheetAction icon="trash-outline" label={t('multi.admin_delete_player')} onPress={() => remove(selected)} colors={colors} color={colors.danger} />
                )}
              </>
            )}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

interface ActionProps { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; colors: UiColors; color?: string }

function SheetAction({ icon, label, onPress, colors, color = colors.text }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [local.action, { borderColor: colors.border }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={RFValue(18)} color={color} />
      <Text style={[local.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const local = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: RFValue(12),
    marginBottom: RFValue(12),
  },
  searchInput: {
    flex: 1,
    paddingVertical: RFValue(10),
    fontSize: RFValue(15),
  },
  list: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(12),
    minHeight: 52,
  },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pseudo: {
    fontSize: RFValue(15),
    fontWeight: '700',
    flexShrink: 1,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: RFValue(11),
    fontWeight: '800',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: RFValue(13),
    paddingHorizontal: RFValue(14),
    marginBottom: RFValue(10),
  },
  actionText: {
    fontSize: RFValue(16),
    fontWeight: '700',
  },
});
