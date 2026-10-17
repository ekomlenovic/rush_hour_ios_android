import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { useTheme } from '@/theme';
import { selectActiveAccount, useMultiStore } from '@/store/multiStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import { buildRecoveryLink, serverHost } from '@/utils/multi/serverUrl';
import MultiHeader from '@/components/multi/MultiHeader';
import KeyboardScreen from '@/components/KeyboardScreen';
import QrCode from '@/components/multi/QrCode';
import { multiErrorMessage } from '@/components/multi/errors';
import IconText from '@/components/IconText';

/** My account on the active server: nickname, recovery code, leave, delete my data */
export default function MultiAccountScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const account = useMultiStore(selectActiveAccount);
  const updateAccount = useMultiStore(s => s.updateAccount);
  const removeAccount = useMultiStore(s => s.removeAccount);
  const blocked = useMultiStore(s => (account ? s.blocked[account.url] : undefined)) ?? [];
  const setBlocked = useMultiStore(s => s.setBlocked);
  const api = useMultiApi(account);

  const [pseudo, setPseudo] = useState(account?.pseudo ?? '');
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [adminToken, setAdminToken] = useState('');
  const [claiming, setClaiming] = useState(false);

  // The nickname or the admin rights may have been changed (by the admin, on another phone)
  useEffect(() => {
    if (!api || !account) return;
    api.me().then(me => {
      updateAccount(account.url, { pseudo: me.pseudo, isAdmin: !!me.isAdmin });
      setPseudo(me.pseudo);
    }).catch(() => {});
  }, [api]);

  if (!account || !api) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.account')} colors={colors} />
    </View>
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const rename = () => run(async () => {
    const player = await api.rename(pseudo);
    updateAccount(account.url, { pseudo: player.pseudo });
    setPseudo(player.pseudo);
    Alert.alert(t('common.saved'));
  });

  const renewCode = () => Alert.alert(t('multi.renew_code_title'), t('multi.renew_code_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('multi.renew_code'), onPress: () => run(async () => {
        const { recoveryCode } = await api.renewRecoveryCode();
        updateAccount(account.url, { recoveryCode });
        setShowCode(true);
      }),
    },
  ]);

  const copyCode = async () => {
    await Clipboard.setStringAsync(account.recoveryCode);
    Alert.alert(t('common.copied'));
  };

  const claimAdmin = () => run(async () => {
    const me = await api.claimAdmin(adminToken);
    updateAccount(account.url, { isAdmin: !!me.isAdmin });
    setAdminToken('');
    setClaiming(false);
    router.push('/multi/admin');
  });

  const leave = () => Alert.alert(t('multi.leave_title'), t('multi.leave_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('multi.leave_server'), style: 'destructive', onPress: () => { removeAccount(account.url); router.back(); } },
  ]);

  const deleteData = () => Alert.alert(t('multi.delete_title'), t('multi.delete_body', { server: account.name }), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.delete'), style: 'destructive', onPress: () => run(async () => {
        await api.deleteAccount();
        removeAccount(account.url);
        router.back();
      }),
    },
  ]);

  return (
    <KeyboardScreen style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.account')} colors={colors} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.server, { color: colors.text }]}>{account.name}</Text>
        <Text style={[styles.host, { color: colors.textMuted }]}>{serverHost(account.url)}</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.pseudo')}</Text>
          <View style={styles.row}>
            <TextInput
              value={pseudo}
              onChangeText={setPseudo}
              maxLength={20}
              autoCorrect={false}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              accessibilityLabel={t('multi.pseudo')}
            />
            <Pressable
              onPress={rename}
              disabled={busy || pseudo.trim() === account.pseudo}
              style={[styles.smallButton, { backgroundColor: colors.primary, opacity: busy || pseudo.trim() === account.pseudo ? 0.5 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.smallButtonText, { color: colors.onPrimary }]}>{t('common.edit')}</Text>
            </Pressable>
          </View>
          <Text style={[styles.help, { color: colors.textMuted }]}>{t('multi.pseudo_rules')}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.recovery_code')}</Text>
          <Text style={[styles.help, { color: colors.textMuted }]}>{t('multi.recovery_desc')}</Text>
          {showCode ? (
            <View style={styles.codeBlock}>
              <QrCode value={buildRecoveryLink(account.url, account.recoveryCode)} size={RFValue(180)} accessibilityLabel={t('multi.recovery_qr_a11y')} />
              <Text style={[styles.code, { color: colors.text }]} selectable>{account.recoveryCode}</Text>
              <View style={styles.row}>
                <Pressable onPress={copyCode} style={[styles.smallButton, { backgroundColor: colors.neutralSoft }]} accessibilityRole="button">
                  <Text style={[styles.smallButtonText, { color: colors.text }]}>{t('multi.copy')}</Text>
                </Pressable>
                <Pressable onPress={renewCode} disabled={busy} style={[styles.smallButton, { backgroundColor: colors.neutralSoft }]} accessibilityRole="button">
                  <Text style={[styles.smallButtonText, { color: colors.text }]}>{t('multi.renew_code')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowCode(true)} style={[styles.reveal, { borderColor: colors.primary }]} accessibilityRole="button">
              <Text style={[styles.smallButtonText, { color: colors.primaryText }]}>{t('multi.show_recovery_code')}</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.admin')}</Text>
          {account.isAdmin ? (
            <Pressable onPress={() => router.push('/multi/admin')} style={[styles.reveal, { borderColor: colors.primary }]} accessibilityRole="button">
              <IconText icon="construct-outline" color={colors.primaryText} textStyle={styles.smallButtonText}>{t('multi.admin_panel')}</IconText>
            </Pressable>
          ) : claiming ? (
            <>
              <Text style={[styles.help, { color: colors.textMuted }]}>{t('multi.admin_claim_help')}</Text>
              <View style={[styles.row, { marginTop: 10 }]}>
                <TextInput
                  value={adminToken}
                  onChangeText={setAdminToken}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="ADMIN_TOKEN"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  accessibilityLabel={t('multi.admin_token')}
                />
                <Pressable
                  onPress={claimAdmin}
                  disabled={busy || !adminToken.trim()}
                  style={[styles.smallButton, { backgroundColor: colors.primary, opacity: busy || !adminToken.trim() ? 0.5 : 1 }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.smallButtonText, { color: colors.onPrimary }]}>{t('common.ok')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => setClaiming(true)} style={[styles.reveal, { borderColor: colors.border }]} accessibilityRole="button">
              <Text style={[styles.smallButtonText, { color: colors.text }]}>{t('multi.become_admin')}</Text>
            </Pressable>
          )}
        </View>

        {blocked.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.blocked_players')}</Text>
            {blocked.map(player => (
              <View key={player.playerId} style={[styles.row, styles.blockedRow]}>
                <Text style={[styles.blockedName, { color: colors.text }]} numberOfLines={1}>{player.pseudo}</Text>
                <Pressable onPress={() => setBlocked(account.url, player, false)} style={[styles.smallButton, { backgroundColor: colors.neutralSoft }]} accessibilityRole="button" accessibilityLabel={`${t('multi.unblock')} ${player.pseudo}`}>
                  <Text style={[styles.smallButtonText, { color: colors.text }]}>{t('multi.unblock')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {busy && <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />}
        {!!error && <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion="polite">{multiErrorMessage(t, error)}</Text>}

        <Pressable onPress={leave} style={[styles.dangerButton, { borderColor: colors.border }]} accessibilityRole="button">
          <Text style={[styles.dangerText, { color: colors.text }]}>{t('multi.leave_server')}</Text>
        </Pressable>
        <Pressable onPress={deleteData} disabled={busy} style={[styles.dangerButton, { borderColor: colors.danger }]} accessibilityRole="button">
          <Text style={[styles.dangerText, { color: colors.danger }]}>{t('multi.delete_data')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: RFValue(20),
    paddingBottom: RFValue(48),
  },
  server: {
    fontSize: RFValue(22),
    fontWeight: '800',
    textAlign: 'center',
  },
  host: {
    fontSize: RFValue(13),
    textAlign: 'center',
    marginTop: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: RFValue(16),
    marginTop: RFValue(16),
  },
  cardTitle: {
    fontSize: RFValue(16),
    fontWeight: '800',
    marginBottom: RFValue(8),
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: RFValue(12),
    paddingVertical: RFValue(10),
    fontSize: RFValue(16),
  },
  help: {
    fontSize: RFValue(12),
    lineHeight: RFValue(17),
    marginTop: 6,
  },
  smallButton: {
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(14),
    borderRadius: 12,
  },
  smallButtonText: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  codeBlock: {
    alignItems: 'center',
    marginTop: RFValue(14),
    gap: RFValue(12),
  },
  code: {
    fontSize: RFValue(20),
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  reveal: {
    marginTop: RFValue(12),
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: RFValue(10),
    alignItems: 'center',
  },
  error: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginTop: RFValue(12),
    textAlign: 'center',
  },
  blockedRow: {
    marginTop: RFValue(8),
  },
  blockedName: {
    flex: 1,
    fontSize: RFValue(15),
    fontWeight: '600',
  },
  dangerButton: {
    marginTop: RFValue(16),
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: RFValue(13),
    alignItems: 'center',
  },
  dangerText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
});
