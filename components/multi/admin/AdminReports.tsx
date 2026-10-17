import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AdminReport, MultiApi } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import { multiErrorMessage } from '../errors';
import { reportReasonText } from '../verdict';
import AdminButton from './AdminButton';
import { adminStyles as styles } from './styles';
import IconText from '../IconText';

interface Props { api: MultiApi; colors: UiColors }

/** Nicknames reported by the players: rename or exclude from the Players tab, then delete the report */
export default function AdminReports({ api, colors }: Props) {
  const { t, i18n } = useTranslation();
  const [reports, setReports] = useState<AdminReport[] | null>(null);

  const load = useCallback(async () => {
    try {
      setReports((await api.admin.reports()).reports);
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
      setReports([]);
    }
  }, [api, t]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (report: AdminReport) => {
    try {
      await api.admin.deleteReport(report.id);
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
    }
  };

  if (!reports) return <ActivityIndicator color={colors.primary} />;
  if (reports.length === 0) return <Text style={[styles.empty, { color: colors.textMuted }]}>{t('multi.admin_no_reports')}</Text>;

  return (
    <View>
      {reports.map(report => (
        <View key={report.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconText icon="flag" color={colors.warning} textStyle={[styles.title, { color: colors.text }]}>{report.player.pseudo}</IconText>
          <Text style={[styles.warning, { color: colors.warning }]}>{reportReasonText(t, report.reason || 'other')}</Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {t('multi.admin_reported_by', { pseudo: report.reporter.pseudo, date: new Date(report.createdAt).toLocaleDateString(i18n.language) })}
          </Text>
          <View style={styles.actions}>
            <AdminButton label={t('multi.admin_report_done')} onPress={() => remove(report)} background={colors.neutralSoft} color={colors.text} />
          </View>
        </View>
      ))}
    </View>
  );
}
