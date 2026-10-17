import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import { DUEL_DIFFICULTIES, normalizeDuelCode, type DuelDifficulty } from '@/utils/multi/duel';
import type { Difficulty } from '@/utils/multi/api';
import type { UiColors } from '@/theme';

interface NewDuelProps {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  onClose: () => void;
  onCreate: (difficulty: DuelDifficulty, isPrivate: boolean) => void;
  /** Puzzles ready by difficulty on the server; null: unknown (older server) */
  ready: Partial<Record<Difficulty, number>> | null;
  /** Difficulties with no puzzle ready and too long to generate for now */
  unavailable: Difficulty[];
}

/** A new duel: its difficulty, and whether it is private (joined with its code only) */
export function NewDuelSheet({ visible, colors, isDark, onClose, onCreate, ready, unavailable }: NewDuelProps) {
  const { t } = useTranslation();
  const [difficulty, setDifficulty] = useState<DuelDifficulty>('NORMAL');
  const [isPrivate, setPrivate] = useState(false);

  return (
    <BottomSheet visible={visible} title={t('multi.duel.new_title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('multi.duel.difficulty')}</Text>
      {DUEL_DIFFICULTIES.map(d => {
        const selected = d === difficulty;
        // A puzzle generated ahead: the duel starts at once; otherwise it is generated when someone joins
        const isReady = ready ? (ready[d] ?? 0) > 0 : null;
        const off = unavailable.includes(d);
        const status = off ? t('multi.duel.unavailable') : isReady === null ? null : isReady ? t('multi.duel.ready') : t('multi.duel.not_ready');
        const tint = off ? colors.danger : isReady ? colors.success : colors.warning;
        return (
          <Pressable
            key={d}
            onPress={() => setDifficulty(d)}
            disabled={off}
            style={[styles.option, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : 'transparent', opacity: off ? 0.6 : 1 }]}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: off }}
            accessibilityLabel={[t(`difficulty.${d}`), status].filter(Boolean).join(', ')}
          >
            <Text style={[styles.optionText, { color: selected ? colors.primaryText : colors.text }]}>{t(`difficulty.${d}`)}</Text>
            <View style={styles.optionEnd}>
              {status && (
                <View style={[styles.ready, { backgroundColor: off ? colors.dangerSoft : isReady ? colors.successSoft : colors.warningSoft }]}>
                  <Text style={[styles.readyText, { color: tint }]}>{status}</Text>
                </View>
              )}
              {selected && <Text style={[styles.optionText, { color: colors.primaryText }]}>✓</Text>}
            </View>
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

      <Pressable
        onPress={() => onCreate(difficulty, isPrivate)}
        disabled={unavailable.includes(difficulty)}
        style={[styles.button, { backgroundColor: colors.primary, opacity: unavailable.includes(difficulty) ? 0.5 : 1 }]}
        accessibilityRole="button"
      >
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
  optionEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
  },
  ready: {
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: RFValue(8),
  },
  readyText: {
    fontSize: RFValue(11),
    fontWeight: '800',
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
