import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { useTheme } from '@/theme';
import { selectActiveAccount, useMultiStore } from '@/store/multiStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import MultiHeader from '@/components/multi/MultiHeader';
import KeyboardScreen from '@/components/KeyboardScreen';
import AdminGames from '@/components/multi/admin/AdminGames';
import AdminPlayers from '@/components/multi/admin/AdminPlayers';
import AdminReports from '@/components/multi/admin/AdminReports';
import AdminPuzzles from '@/components/multi/admin/AdminPuzzles';
import AdminSettingsPanel from '@/components/multi/admin/AdminSettingsPanel';
import AdminReset from '@/components/multi/admin/AdminReset';

const TABS = ['games', 'players', 'puzzles', 'reports', 'settings', 'reset'] as const;
type Tab = typeof TABS[number];

/** Panel of the admin of the server (#50): suspect games, players, duel puzzles, reports, settings, back to zero */
export default function AdminScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const account = useMultiStore(selectActiveAccount);
  const api = useMultiApi(account);
  const [tab, setTab] = useState<Tab>('games');

  return (
    <KeyboardScreen style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.admin_panel')} colors={colors} />
      <View style={[styles.tabs, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
        {TABS.map(name => (
          <Pressable
            key={name}
            onPress={() => setTab(name)}
            style={[styles.tab, name === tab && { backgroundColor: colors.primary }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: name === tab }}
          >
            <Text style={[styles.tabText, { color: name === tab ? colors.onPrimary : colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t(`multi.admin_tab.${name}`)}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {api && account && (
          tab === 'games' ? <AdminGames api={api} colors={colors} />
            : tab === 'players' ? <AdminPlayers api={api} colors={colors} myPlayerId={account.playerId} />
            : tab === 'puzzles' ? <AdminPuzzles api={api} colors={colors} />
            : tab === 'reports' ? <AdminReports api={api} colors={colors} />
            : tab === 'reset' ? <AdminReset api={api} colors={colors} />
            : <AdminSettingsPanel api={api} colors={colors} isDark={isDark} serverUrl={account.url} />
        )}
      </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    margin: RFValue(16),
    marginBottom: RFValue(4),
  },
  tab: {
    flex: 1,
    paddingVertical: RFValue(8),
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  content: {
    padding: RFValue(16),
    paddingBottom: RFValue(48),
  },
});
