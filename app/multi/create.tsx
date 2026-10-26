import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, TextInput, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from '@/hooks/useRouter';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { useTheme, type UiColors } from '@/theme';
import MultiHeader from '@/components/multi/MultiHeader';
import KeyboardScreen from '@/components/KeyboardScreen';
import CodeBlock from '@/components/multi/CodeBlock';
import { multiErrorMessage } from '@/components/multi/errors';
import { buildCompose, buildNginx, deviceTimeZone, domainOf, SECRET_PLACEHOLDER, SETUP_COMMANDS } from '@/utils/multi/serverSetup';
import { testConnection, type ConnectionResult } from '@/utils/multi/connectionTest';
import type { Difficulty } from '@/utils/multi/api';
import IconText from '@/components/IconText';

/** Full documentation of the server: every setting, updates, backups */
export const SERVER_DOCS_URL = 'https://github.com/ekomlenovic/rush_hour_ios_android/blob/main/server/README.md';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'];

/**
 * Create a server between friends, step by step (#51): what it takes, the secrets,
 * the docker-compose.yml and the nginx site filled in with the choices made here,
 * starting it, testing the connection, then joining it and becoming its admin.
 */
export default function CreateServerScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [name, setName] = useState('');
  const [releaseTime, setReleaseTime] = useState('12:00');
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [hardMonday, setHardMonday] = useState(true);
  const [domain, setDomain] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);

  const timeZone = useMemo(deviceTimeZone, []);
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(releaseTime);
  const difficultySetting = hardMonday && difficulty !== 'HARD' && difficulty !== 'EXPERT' && difficulty !== 'MASTER'
    ? `${difficulty},MONDAY=HARD` : difficulty;
  const compose = buildCompose({ name, timeZone, releaseTime: validTime ? releaseTime : '12:00', difficulty: difficultySetting });
  const host = domainOf(domain);

  const test = async () => {
    setTesting(true);
    setResult(await testConnection(domain, APP_VERSION));
    setTesting(false);
  };

  const input = [styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }];

  return (
    <KeyboardScreen style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.create_title')} colors={colors} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.textMuted }]}>{t('multi.create_desc')}</Text>

        <StepCard colors={colors} n={1} title={t('multi.setup_needs_title')}>
          {(['multi.create_need_machine', 'multi.create_need_domain', 'multi.create_need_https'] as const).map(key => (
            <Text key={key} style={[styles.item, { color: colors.text }]}>• {t(key)}</Text>
          ))}
          <Paragraph colors={colors}>{t('multi.setup_needs_help')}</Paragraph>
        </StepCard>

        <StepCard colors={colors} n={2} title={t('multi.setup_choices_title')}>
          <Text style={[styles.label, { color: colors.text }]}>{t('multi.setup_name')}</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Rush Hours" placeholderTextColor={colors.textMuted} maxLength={40} style={input} accessibilityLabel={t('multi.setup_name')} />
          <Text style={[styles.label, { color: colors.text }]}>{t('multi.setup_release_time')}</Text>
          <TextInput value={releaseTime} onChangeText={setReleaseTime} placeholder="12:00" placeholderTextColor={colors.textMuted} maxLength={5} keyboardType="numbers-and-punctuation" style={input} accessibilityLabel={t('multi.setup_release_time')} />
          {!validTime && <Text style={[styles.error, { color: colors.danger }]}>{t('multi.setup_bad_time')}</Text>}
          <Paragraph colors={colors}>{t('multi.setup_time_zone', { zone: timeZone })}</Paragraph>
          <Text style={[styles.label, { color: colors.text }]}>{t('multi.setup_difficulty')}</Text>
          <View style={styles.pills}>
            {DIFFICULTIES.map(d => (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.pill, { backgroundColor: d === difficulty ? colors.primary : colors.neutralSoft }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: d === difficulty }}
              >
                <Text style={[styles.pillText, { color: d === difficulty ? colors.onPrimary : colors.text }]}>{t(`difficulty.${d}`)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{t('multi.setup_hard_monday')}</Text>
            <Switch value={hardMonday} onValueChange={setHardMonday} accessibilityLabel={t('multi.setup_hard_monday')} />
          </View>
          <Paragraph colors={colors}>{t('multi.setup_choices_help')}</Paragraph>
        </StepCard>

        <StepCard colors={colors} n={3} title={t('multi.setup_secrets_title')}>
          <Paragraph colors={colors}>{t('multi.setup_secrets_help', { placeholder: SECRET_PLACEHOLDER })}</Paragraph>
          <CodeBlock code={SETUP_COMMANDS.secrets} colors={colors} label={t('multi.setup_secrets_title')} />
        </StepCard>

        <StepCard colors={colors} n={4} title={t('multi.setup_compose_title')}>
          <Paragraph colors={colors}>{t('multi.setup_compose_help')}</Paragraph>
          <CodeBlock code={compose} colors={colors} label="docker-compose.yml" />
        </StepCard>

        <StepCard colors={colors} n={5} title={t('multi.setup_nginx_title')}>
          <Paragraph colors={colors}>{t('multi.setup_nginx_help')}</Paragraph>
          <Text style={[styles.label, { color: colors.text }]}>{t('multi.setup_domain')}</Text>
          <TextInput value={domain} onChangeText={setDomain} placeholder="monserveur.duckdns.org" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={input} accessibilityLabel={t('multi.setup_domain')} />
          <CodeBlock code={buildNginx(host)} colors={colors} label="nginx" />
          <Paragraph colors={colors}>{t('multi.setup_certificate_help', { domain: host || 'monserveur.duckdns.org' })}</Paragraph>
        </StepCard>

        <StepCard colors={colors} n={6} title={t('multi.setup_start_title')}>
          <Paragraph colors={colors}>{t('multi.setup_start_help')}</Paragraph>
          <CodeBlock code={SETUP_COMMANDS.start} colors={colors} label={t('multi.setup_start_title')} />
          <Paragraph colors={colors}>{t('multi.setup_invite_help')}</Paragraph>
          <CodeBlock code={SETUP_COMMANDS.inviteCode} colors={colors} label={t('multi.invite_code')} />
        </StepCard>

        <StepCard colors={colors} n={7} title={t('multi.setup_test_title')}>
          <Paragraph colors={colors}>{t('multi.setup_test_help')}</Paragraph>
          <Pressable
            onPress={test}
            disabled={testing || !domain.trim()}
            style={[styles.button, { backgroundColor: colors.primary, opacity: testing || !domain.trim() ? 0.5 : 1 }]}
            accessibilityRole="button"
          >
            {testing ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('multi.setup_test')}</Text>}
          </Pressable>
          {result && (
            <View style={[styles.result, { backgroundColor: result.ok ? colors.successSoft : colors.dangerSoft }]} accessibilityLiveRegion="polite">
              {result.ok ? (
                <IconText icon="checkmark-circle" color={colors.success} textStyle={styles.resultText}>{t('multi.setup_test_ok', { name: result.info.name })}</IconText>
              ) : (
                <>
                  <IconText icon="close-circle" color={colors.danger} textStyle={styles.resultText}>{t(`multi.setup_test_fail.${result.step}`)}</IconText>
                  <Text style={[styles.text, { color: colors.text }]}>{multiErrorMessage(t, result.error)}</Text>
                </>
              )}
            </View>
          )}
        </StepCard>

        <StepCard colors={colors} n={8} title={t('multi.setup_join_title')}>
          <Paragraph colors={colors}>{t('multi.setup_join_help')}</Paragraph>
          <Pressable
            onPress={() => router.replace(result?.ok ? `/multi/join?server=${encodeURIComponent(result.url)}` : '/multi/join')}
            style={[styles.button, { backgroundColor: result?.ok ? colors.primary : colors.neutralSoft }]}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: result?.ok ? colors.onPrimary : colors.text }]}>{t('multi.create_then_join')}</Text>
          </Pressable>
        </StepCard>

        <Pressable onPress={() => Linking.openURL(SERVER_DOCS_URL)} style={styles.link} accessibilityRole="link">
          <Text style={[styles.linkText, { color: colors.primaryText }]}>{t('multi.create_open_guide')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardScreen>
  );
}

/** A step of the guide: defined out of the screen, so that its text fields keep the focus while typing */
function StepCard({ n, title, colors, children }: { n: number; title: string; colors: UiColors; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.stepTitle, { color: colors.text }]} accessibilityRole="header">
        <Text style={{ color: colors.primaryText }}>{n}. </Text>{title}
      </Text>
      {children}
    </View>
  );
}

function Paragraph({ colors, children }: { colors: UiColors; children: React.ReactNode }) {
  return <Text style={[styles.text, { color: colors.textMuted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: RFValue(16),
    paddingBottom: RFValue(48),
  },
  intro: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
    marginBottom: RFValue(12),
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: RFValue(14),
    marginBottom: RFValue(12),
  },
  stepTitle: {
    fontSize: RFValue(16),
    fontWeight: '800',
    marginBottom: RFValue(4),
  },
  text: {
    fontSize: RFValue(13),
    lineHeight: RFValue(19),
    marginTop: RFValue(6),
  },
  item: {
    fontSize: RFValue(14),
    lineHeight: RFValue(21),
  },
  label: {
    fontSize: RFValue(13),
    fontWeight: '700',
    marginTop: RFValue(10),
    marginBottom: RFValue(4),
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: RFValue(12),
    paddingVertical: RFValue(9),
    fontSize: RFValue(15),
  },
  error: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginTop: 4,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(10),
    borderRadius: 10,
  },
  pillText: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: RFValue(10),
  },
  switchLabel: {
    flex: 1,
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  button: {
    marginTop: RFValue(12),
    paddingVertical: RFValue(13),
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: RFValue(15),
    fontWeight: '800',
  },
  result: {
    borderRadius: 12,
    padding: RFValue(12),
    marginTop: RFValue(12),
  },
  resultText: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  link: {
    alignItems: 'center',
    padding: RFValue(14),
  },
  linkText: {
    fontSize: RFValue(14),
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
