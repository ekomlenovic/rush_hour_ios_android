import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { UiColors } from '@/theme';
import AdminButton from './AdminButton';
import { adminStyles as styles } from './styles';

interface Props { label: string; value: string; onMinus: () => void; onPlus: () => void; colors: UiColors }

/** A setting changed a step at a time */
export default function Stepper({ label, value, onMinus, onPlus, colors }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessible={false}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <AdminButton label="−" onPress={onMinus} background={colors.neutralSoft} color={colors.text} accessibilityLabel={`${t('multi.admin_less')}, ${label}`} />
      <Text style={{ color: colors.text, fontWeight: '800', minWidth: 64, textAlign: 'center' }} accessibilityLabel={`${label} : ${value}`}>{value}</Text>
      <AdminButton label="+" onPress={onPlus} background={colors.neutralSoft} color={colors.text} accessibilityLabel={`${t('multi.admin_more')}, ${label}`} />
    </View>
  );
}
