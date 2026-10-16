import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { useTheme } from '@/theme';
import MultiHeader from '@/components/multi/MultiHeader';

/** Documentation of the server: installation with Docker, configuration, reverse proxy */
export const SERVER_DOCS_URL = 'https://github.com/ekomlenovic/rush_hour_ios_android/blob/main/server/README.md';

/** Create a server between friends: what it takes (the step-by-step guide comes with #51) */
export default function CreateServerScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const needs = ['multi.create_need_machine', 'multi.create_need_domain', 'multi.create_need_https'] as const;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.create_title')} colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.text, { color: colors.textMuted }]}>{t('multi.create_desc')}</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.create_needs')}</Text>
          {needs.map(key => (
            <Text key={key} style={[styles.item, { color: colors.text }]}>• {t(key)}</Text>
          ))}
        </View>
        <Pressable onPress={() => Linking.openURL(SERVER_DOCS_URL)} style={[styles.primary, { backgroundColor: colors.primary }]} accessibilityRole="link">
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>{t('multi.create_open_guide')}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/multi/join')} style={[styles.secondary, { borderColor: colors.primary }]} accessibilityRole="button">
          <Text style={[styles.secondaryText, { color: colors.primaryText }]}>{t('multi.create_then_join')}</Text>
        </Pressable>
      </ScrollView>
    </View>
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
  text: {
    fontSize: RFValue(15),
    lineHeight: RFValue(22),
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
  item: {
    fontSize: RFValue(14),
    lineHeight: RFValue(22),
  },
  primary: {
    marginTop: RFValue(20),
    paddingVertical: RFValue(15),
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: RFValue(16),
    fontWeight: '800',
  },
  secondary: {
    marginTop: RFValue(12),
    paddingVertical: RFValue(13),
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
});
