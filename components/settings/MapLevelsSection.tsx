import React from 'react';
import { View, Text, Pressable, Alert, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { haptics, Haptics } from '@/utils/haptics';
import type { UiColors } from '@/theme';
import IconText from '../IconText';
import { settingsStyles as styles } from './styles';

const REQUEST_LEVELS_URL = 'https://github.com/ekomlenovic/rush_hour_ios_android/issues/new?title=Request:%20New%20Complex%20Levels&body=I%20would%20like%20to%20see%20more%20high-difficulty%20levels%21';

/** World map only: community levels and unlocking every level (the generator has its own sheet: GeneratorSheet) */
export default function MapLevelsSection({ colors }: { colors: UiColors }) {
  const { t } = useTranslation();
  const unlockAllLevels = useGameStore(s => s.unlockAllLevels);

  const handleUnlockAll = () => {
    Alert.alert(
      t('home.unlock_all'),
      t('home.unlock_all_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          onPress: () => {
            unlockAllLevels();
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(t('common.success'), t('home.unlock_all_success'));
          },
        },
      ]
    );
  };

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.primaryText }]} accessibilityRole="header">{t('map.community_levels')}</Text>
      <Pressable
        style={[styles.mainBtn, { backgroundColor: colors.github, marginBottom: 12 }]}
        onPress={() => Linking.openURL(REQUEST_LEVELS_URL)}
        accessibilityRole="link"
      >
        <Text style={styles.mainBtnText}>{t('map.request_github')}</Text>
      </Pressable>
      <Pressable
        style={[styles.outlineBtn, { borderColor: colors.primary }]}
        onPress={handleUnlockAll}
        accessibilityRole="button"
        accessibilityLabel={t('home.unlock_all')}
      >
        <IconText icon="lock-open" color={colors.primaryText} textStyle={styles.outlineBtnText}>{t('home.unlock_all')}</IconText>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />
    </View>
  );
}
