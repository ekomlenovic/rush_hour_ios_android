import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import { serverHost } from '@/utils/multi/serverUrl';
import type { ServerAccount } from '@/store/multiStore';
import type { UiColors } from '@/theme';

interface Props {
  visible: boolean;
  accounts: ServerAccount[];
  activeUrl: string | null;
  colors: UiColors;
  isDark: boolean;
  onSelect: (url: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

/** The servers joined, one identity on each: pick the one to play on, or add one */
export default function ServerPickerSheet({ visible, accounts, activeUrl, colors, isDark, onSelect, onAdd, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} title={t('multi.servers')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      {accounts.map(account => {
        const active = account.url === activeUrl;
        return (
          <Pressable
            key={account.url}
            onPress={() => onSelect(account.url)}
            style={[styles.row, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : 'transparent' }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${account.name}, ${serverHost(account.url)}, ${account.pseudo}`}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{account.name}</Text>
              <Text style={[styles.host, { color: colors.textMuted }]} numberOfLines={1}>{serverHost(account.url)} · {account.pseudo}</Text>
            </View>
            {active && <Ionicons name="checkmark" size={RFValue(20)} color={colors.primaryText} />}
          </Pressable>
        );
      })}
      <Pressable onPress={onAdd} style={[styles.add, { borderColor: colors.border }]} accessibilityRole="button">
        <Text style={[styles.addText, { color: colors.primaryText }]}>＋ {t('multi.add_server')}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: RFValue(12),
    marginBottom: RFValue(10),
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: RFValue(16),
    fontWeight: '700',
  },
  host: {
    fontSize: RFValue(13),
    marginTop: 2,
  },
  add: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: RFValue(14),
    alignItems: 'center',
  },
  addText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
});
