import React from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { selectActiveAccount, useMultiStore } from '@/store/multiStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import AdminPage from '@/components/multi/admin/AdminPage';
import AdminGames from '@/components/multi/admin/AdminGames';
import AdminReports from '@/components/multi/admin/AdminReports';
import AdminPlayers from '@/components/multi/admin/AdminPlayers';
import AdminInvites from '@/components/multi/admin/AdminInvites';
import AdminPuzzles from '@/components/multi/admin/AdminPuzzles';
import AdminChallenge from '@/components/multi/admin/AdminChallenge';
import AdminAntiCheat from '@/components/multi/admin/AdminAntiCheat';
import AdminServer from '@/components/multi/admin/AdminServer';
import AdminReset from '@/components/multi/admin/AdminReset';
import { adminStyles } from '@/components/multi/admin/styles';
import { isAdminSection } from '@/components/multi/admin/sections';

/** A page of the admin panel (#50) */
export default function AdminSectionScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { section } = useLocalSearchParams<{ section: string }>();
  const account = useMultiStore(selectActiveAccount);
  const api = useMultiApi(account);

  if (!isAdminSection(section)) {
    return (
      <AdminPage title={t('multi.admin_panel')}>
        <Text style={[adminStyles.empty, { color: colors.textMuted }]}>{t('multi.errors.not_found')}</Text>
      </AdminPage>
    );
  }

  return (
    <AdminPage title={t(`multi.admin_home.${section}`)}>
      {api && account && (
        section === 'games' ? <AdminGames api={api} colors={colors} />
          : section === 'reports' ? <AdminReports api={api} colors={colors} />
          : section === 'players' ? <AdminPlayers api={api} colors={colors} isDark={isDark} myPlayerId={account.playerId} />
          : section === 'invites' ? <AdminInvites api={api} colors={colors} serverUrl={account.url} />
          : section === 'puzzles' ? <AdminPuzzles api={api} colors={colors} />
          : section === 'challenge' ? <AdminChallenge api={api} colors={colors} isDark={isDark} />
          : section === 'anticheat' ? <AdminAntiCheat api={api} colors={colors} />
          : section === 'server' ? <AdminServer api={api} colors={colors} serverUrl={account.url} />
          : <AdminReset api={api} colors={colors} />
      )}
    </AdminPage>
  );
}
