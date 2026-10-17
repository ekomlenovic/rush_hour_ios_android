import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import { DUEL_DIFFICULTIES, normalizeDuelCode, type DuelDifficulty } from '@/utils/multi/duel';
import type { UiColors } from '@/theme';

interface NewDuelProps {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  onClose: () => void;
  onCreate: (difficulty: DuelDifficulty, isPrivate: boolean) => void;
}

/** A new duel: its difficulty, and whether it is private (joined with its code only) */
export function NewDuelSheet({ visible, colors, isDark, onClose, onCreate }: NewDuelProps) {
  const { t } = useTranslation();
  const [difficulty, setDifficulty] = useState<DuelDifficulty>('NORMAL');
  const [isPrivate, setPrivate] = useState(false);

  return (
    <BottomSheet visible={visible} title={t('multi.duel.new_title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('multi.duel.difficulty')}</Text>
      {DUEL_DIFFICULTIES.map(d => {
        const selected = d === difficulty;
        return (
          <Pressable
            key={d}
            onPress={() => setDifficulty(d)}
            style={[styles.option, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : 'transparent' }]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.optionText, { color: selected ? colors.primaryText : colors.text }]}>{t(`difficulty.${d}`)}</Text>
            {selected && <Text style={[styles.optionText, { color: colors.primaryText }]}>✓</Text>}
          </Pressable>
        );
      })}

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={[styles.optionText, { color: colors.text }]}>🔒 {t('multi.duel.private')}</Text>
          <Text style={[styles.help, { color: colors.textMuted }]}>{isPrivate ? t('multi.duel.private_help') : t('multi.duel.public_help')}</Text>
        </View>
        <Switch value={isPrivate} onValueChange={setPrivate} accessibilityLabel={t('multi.duel.private')} />
      </View>

      <Pressable onPress={() => onCreate(difficulty, isPrivate)} style={[styles.button, { backgroundColor: colors.primary }]} accessibilityRole="button">
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('multi.duel.create')}</Text>
      </Pressable>
    </BottomSheet>
  );
}

interface CodeProps {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
}

/** Join a private duel with the code given by its player */
export function DuelCodeSheet({ visible, colors, isDark, onClose, onJoin }: CodeProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  useEffect(() => { if (visible) setCode(''); }, [visible]);
  const valid = normalizeDuelCode(code).length >= 4;
  const join = () => valid && onJoin(normalizeDuelCode(code));

  return (
    <BottomSheet visible={visible} title={t('multi.duel.code_title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose} avoidKeyboard>
      <Text style={[styles.help, styles.center, { color: colors.textMuted }]}>{t('multi.duel.code_help')}</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="ABCD3"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={12}
        returnKeyType="go"
        onSubmitEditing={join}
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
        accessibilityLabel={t('multi.duel.code_label')}
      />
      <Pressable
        onPress={join}
        disabled={!valid}
        style={[styles.button, { backgroundColor: colors.primary, opacity: valid ? 1 : 0.5 }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid }}
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('multi.duel.join')}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: RFValue(13),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: RFValue(8),
  },
  option: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: RFValue(11),
    paddingHorizontal: RFValue(14),
    marginBottom: RFValue(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: RFValue(16),
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(12),
    marginTop: RFValue(8),
  },
  switchText: {
    flex: 1,
  },
  help: {
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
    marginTop: 2,
  },
  center: {
    textAlign: 'center',
    marginBottom: RFValue(14),
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: RFValue(14),
    fontSize: RFValue(26),
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
  },
  button: {
    marginTop: RFValue(16),
    paddingVertical: RFValue(15),
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: RFValue(17),
    fontWeight: '800',
  },
});
