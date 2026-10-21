import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { selectActiveAccount, useMultiStore } from '@/store/multiStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import type { AdminSummary } from '@/utils/multi/api';
import AdminPage, { useAdminRefresh } from '@/components/multi/admin/AdminPage';
import AdminRow, { AdminGroup } from '@/components/multi/admin/AdminRow';
import type { AdminSection } from '@/components/multi/admin/sections';
import { multiErrorMessage } from '@/components/multi/errors';

/** Home of the admin panel of the server (#50): what waits first, then the players, the server, the dangerous actions last */
export default function AdminScreen() {
  const { t } = useTranslation();
  return (
    <AdminPage title={t('multi.admin_panel')}>
      <AdminHome />
    </AdminPage>
  );
}

function AdminHome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const account = useMultiStore(selectActiveAccount);
  const updateAccount = useMultiStore(s => s.updateAccount);
  const api = useMultiApi(account);
  // Null on a server too old to give it: the lines are there, without their summary
  const [summary, setSummary] = useState<AdminSummary | null>(null);

  const load = useCallback(async () => {
    if (!api) return;
    setSummary(await api.admin.summary().catch(() => null));
  }, [api]);

  // Again when back from a page: a decision or a setting changes what is shown
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useAdminRefresh(load);

  const open = (section: AdminSection) => router.push(`/multi/admin/${section}`);

  const resetSettings = () => Alert.alert(t('multi.admin_reset_title'), t('multi.admin_reset_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('multi.admin_reset'), style: 'destructive', onPress: async () => {
        if (!api || !account) return;
        try {
          const next = await api.admin.resetSettings();
          updateAccount(account.url, { name: next.serverName });
          void load();
        } catch (e) {
          Alert.alert(t('common.error'), multiErrorMessage(t, e));
        }
      },
    },
  ]);

  const s = summary;
  const puzzlesText = !s ? null
    : s.puzzles.working ? t('multi.admin_home.puzzles_working', { difficulty: t(`difficulty.${s.puzzles.working.difficulty}`) })
    : t('multi.admin_home.puzzles_ready', { ready: s.puzzles.ready, size: s.puzzles.size });

  return (
    <>
      <AdminGroup title={t('multi.admin_home.group_todo')} colors={colors}>
        <AdminRow
          icon="eye-outline" title={t('multi.admin_home.games')} colors={colors} divider onPress={() => open('games')}
          subtitle={s && (s.toReview ? t('multi.admin_home.games_to_review', { count: s.toReview }) : t('multi.admin_home.games_none'))}
          badge={s?.toReview}
        />
        <AdminRow
          icon="flag-outline" title={t('multi.admin_home.reports')} colors={colors} onPress={() => open('reports')}
          subtitle={s && (s.reports ? t('multi.admin_player_reports', { count: s.reports }) : t('multi.admin_no_reports'))}
          badge={s?.reports}
        />
      </AdminGroup>

      <AdminGroup title={t('multi.admin_home.group_community')} colors={colors}>
        <AdminRow
          icon="people-outline" title={t('multi.admin_home.players')} colors={colors} divider onPress={() => open('players')}
          subtitle={s && [
            t('multi.admin_home.players_count', { count: s.players }),
            s.banned ? t('multi.admin_home.players_banned', { count: s.banned }) : null,
          ].filter(Boolean).join(' · ')}
        />
        <AdminRow
          icon="mail-outline" title={t('multi.admin_home.invites')} colors={colors} onPress={() => open('invites')}
          subtitle={s && [
            s.joinOpen ? t('multi.admin_home.join_open') : t('multi.admin_home.join_closed'),
            s.joinOpen && s.invitesAdminOnly ? t('multi.admin_home.invites_admin_only') : null,
          ].filter(Boolean).join(' · ')}
        />
      </AdminGroup>

      <AdminGroup title={t('multi.admin_home.group_server')} colors={colors}>
        <AdminRow icon="calendar-outline" title={t('multi.admin_home.challenge')} colors={colors} divider onPress={() => open('challenge')}
          subtitle={s && t('multi.admin_home.challenge_release', { time: s.releaseTime })} />
        <AdminRow icon="extension-puzzle-outline" title={t('multi.admin_home.puzzles')} colors={colors} divider onPress={() => open('puzzles')}
          subtitle={puzzlesText} />
        <AdminRow icon="shield-checkmark-outline" title={t('multi.admin_home.anticheat')} colors={colors} divider onPress={() => open('anticheat')}
          subtitle={t('multi.admin_home.anticheat_help')} />
        <AdminRow icon="server-outline" title={t('multi.admin_home.server')} colors={colors} onPress={() => open('server')}
          subtitle={s?.serverName} />
      </AdminGroup>

      <AdminGroup title={t('multi.admin_home.group_danger')} colors={colors}>
        <AdminRow icon="trash-outline" title={t('multi.admin_home.reset')} colors={colors} danger divider onPress={() => open('reset')}
          subtitle={t('multi.admin_home.reset_help')} />
        <AdminRow icon="refresh-outline" title={t('multi.admin_home.reset_settings')} colors={colors} danger action onPress={resetSettings}
          subtitle={t('multi.admin_home.reset_settings_help')} />
      </AdminGroup>
    </>
  );
}
