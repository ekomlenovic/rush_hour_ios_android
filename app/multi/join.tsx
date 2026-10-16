import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { useTheme } from '@/theme';
import { useMultiStore } from '@/store/multiStore';
import { checkCompatibility, multiApi } from '@/utils/multi/api';
import { normalizeServerUrl, parseInviteLink, parseRecoveryLink } from '@/utils/multi/serverUrl';
import MultiHeader from '@/components/multi/MultiHeader';
import KeyboardScreen from '@/components/KeyboardScreen';
import { multiErrorMessage } from '@/components/multi/errors';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

type Mode = 'join' | 'recover';

/**
 * Join a server (address, invite code, nickname), or get an account back on a new
 * phone with its recovery code. Opened prefilled by an invitation or recovery link.
 */
export default function JoinScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ server?: string; code?: string; mode?: Mode }>();
  const accounts = useMultiStore(s => s.accounts);
  const addAccount = useMultiStore(s => s.addAccount);
  const setIntroSeen = useMultiStore(s => s.setIntroSeen);

  const [mode, setMode] = useState<Mode>(params.mode === 'recover' ? 'recover' : 'join');
  const [server, setServer] = useState(params.server ?? '');
  const [inviteCode, setInviteCode] = useState(params.mode === 'recover' ? '' : params.code ?? '');
  const [recoveryCode, setRecoveryCode] = useState(params.mode === 'recover' ? params.code ?? '' : '');
  const [pseudo, setPseudo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // A whole link pasted in the address field fills the form
  const onServerChange = (text: string) => {
    const invite = parseInviteLink(text);
    const recovery = parseRecoveryLink(text);
    if (invite) {
      setServer(invite.server);
      setInviteCode(invite.code);
      setMode('join');
    } else if (recovery) {
      setServer(recovery.server);
      setRecoveryCode(recovery.code);
      setMode('recover');
    } else {
      setServer(text);
    }
  };

  const canSubmit = !busy && server.trim() !== '' && (mode === 'join' ? inviteCode.trim() !== '' && pseudo.trim() !== '' : recoveryCode.trim() !== '');

  const submit = async () => {
    const url = normalizeServerUrl(server);
    if (!url.ok) {
      setError(url.error);
      return;
    }
    const proceed = async () => {
      setBusy(true);
      setError(null);
      try {
        const api = multiApi(url.url);
        const compat = checkCompatibility(await api.info(), APP_VERSION);
        if (compat !== 'ok') throw compat;
        const result = mode === 'join' ? await api.join(inviteCode.trim(), pseudo) : await api.recover(recoveryCode.trim());
        addAccount({
          url: url.url,
          name: result.server.name,
          playerId: result.player.id,
          pseudo: result.player.pseudo,
          token: result.token,
          recoveryCode: result.recoveryCode ?? recoveryCode.trim().toUpperCase(),
          joinedAt: Date.now(),
        });
        setIntroSeen();
        router.dismissTo('/multi');
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    };

    // Joining again with a new nickname would leave the current account behind
    if (mode === 'join' && accounts.some(a => a.url === url.url)) {
      Alert.alert(t('multi.already_joined_title'), t('multi.already_joined_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.continue'), onPress: proceed },
      ]);
    } else {
      await proceed();
    }
  };

  const input = [styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }];

  return (
    <KeyboardScreen style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={mode === 'join' ? t('multi.join_title') : t('multi.recover_title')} colors={colors} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.textMuted }]}>{mode === 'join' ? t('multi.join_desc') : t('multi.recover_desc')}</Text>

        <Text style={[styles.label, { color: colors.text }]}>{t('multi.server_address')}</Text>
        <TextInput
          value={server}
          onChangeText={onServerChange}
          placeholder="monserveur.duckdns.org"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={input}
          accessibilityLabel={t('multi.server_address')}
        />

        {mode === 'join' ? (
          <>
            <Text style={[styles.label, { color: colors.text }]}>{t('multi.invite_code')}</Text>
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
              style={input}
              accessibilityLabel={t('multi.invite_code')}
            />
            <Text style={[styles.label, { color: colors.text }]}>{t('multi.pseudo')}</Text>
            <TextInput
              value={pseudo}
              onChangeText={setPseudo}
              maxLength={20}
              autoCorrect={false}
              style={input}
              accessibilityLabel={t('multi.pseudo')}
            />
            <Text style={[styles.help, { color: colors.textMuted }]}>{t('multi.pseudo_rules')}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.text }]}>{t('multi.recovery_code')}</Text>
            <TextInput
              value={recoveryCode}
              onChangeText={setRecoveryCode}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={input}
              accessibilityLabel={t('multi.recovery_code')}
            />
          </>
        )}

        {!!error && <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion="polite">{multiErrorMessage(t, error)}</Text>}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.button, { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.5 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy }}
        >
          {busy ? <ActivityIndicator color={colors.onPrimary} />
            : <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{mode === 'join' ? t('multi.join') : t('multi.recover')}</Text>}
        </Pressable>

        <Pressable onPress={() => { setMode(mode === 'join' ? 'recover' : 'join'); setError(null); }} style={styles.switch} accessibilityRole="button">
          <Text style={[styles.switchText, { color: colors.primaryText }]}>{mode === 'join' ? t('multi.have_account') : t('multi.new_account')}</Text>
        </Pressable>

        <View style={[styles.tip, { backgroundColor: colors.card }]}>
          <Text style={[styles.tipText, { color: colors.textMuted }]}>💡 {t('multi.join_tip')}</Text>
        </View>
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
  intro: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
    marginBottom: RFValue(8),
  },
  label: {
    fontSize: RFValue(14),
    fontWeight: '700',
    marginTop: RFValue(14),
    marginBottom: RFValue(6),
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: RFValue(14),
    paddingVertical: RFValue(12),
    fontSize: RFValue(16),
  },
  help: {
    fontSize: RFValue(12),
    marginTop: 6,
  },
  error: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginTop: RFValue(14),
  },
  button: {
    marginTop: RFValue(20),
    paddingVertical: RFValue(15),
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: RFValue(17),
    fontWeight: '800',
  },
  switch: {
    alignItems: 'center',
    padding: RFValue(14),
  },
  switchText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  tip: {
    borderRadius: 12,
    padding: RFValue(12),
    marginTop: RFValue(6),
  },
  tipText: {
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
  },
});
