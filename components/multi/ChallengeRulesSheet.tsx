import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import IconText, { type IconName } from '@/components/IconText';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';

interface Props {
  visible: boolean;
  /** When the challenges come out, in the phone's time: '09:00' */
  releaseTime: string | null;
  server: string;
  colors: UiColors;
  isDark: boolean;
  onClose: () => void;
}

/** How the challenge of the day works: one try, the clock, the ranking and its points */
export default function ChallengeRulesSheet({ visible, releaseTime, server, colors, isDark, onClose }: Props) {
  const { t } = useTranslation();
  const rules: { icon: IconName; text: string }[] = [
    { icon: 'calendar-outline', text: releaseTime ? t('multi.rules.daily_at', { time: releaseTime, server }) : t('multi.rules.daily', { server }) },
    { icon: 'timer-outline', text: t('multi.rules.one_try') },
    { icon: 'close-circle-outline', text: t('multi.rules.no_help') },
    { icon: 'podium-outline', text: t('multi.rules.ranking') },
    { icon: 'trophy-outline', text: t('multi.rules.points') },
    { icon: 'hourglass-outline', text: t('multi.rules.grace') },
    { icon: 'leaf-outline', text: t('multi.intro_optional') },
  ];
  return (
    <BottomSheet visible={visible} title={t('multi.rules.title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <View style={styles.list}>
        {rules.map(rule => (
          <IconText key={rule.icon} icon={rule.icon} color={colors.text} size={RFValue(20)} style={styles.row} textStyle={styles.text}>{rule.text}</IconText>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: RFValue(14),
  },
  row: {
    alignItems: 'flex-start',
    gap: RFValue(12),
  },
  text: {
    fontSize: RFValue(15),
    lineHeight: RFValue(21),
  },
});
