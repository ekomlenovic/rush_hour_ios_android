import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { closeWebDialog, subscribeWebDialogs, type WebDialog } from '@/utils/webDialogs';
import { useTheme } from '@/theme';

/**
 * Draws the alerts of the web version (utils/webDialogs.ts), one at a time, like the system
 * alerts of the phones: title, message and buttons, Escape (onRequestClose, the Modal of
 * react-native-web: the top one only) or a click outside for the cancel
 * button. Mounted once by the root layout; nothing on iOS and Android.
 */
export default function WebDialogHost() {
  const [dialogs, setDialogs] = useState<WebDialog[]>([]);
  useEffect(() => (Platform.OS === 'web' ? subscribeWebDialogs(setDialogs) : undefined), []);
  const dialog = dialogs[0];
  return dialog ? <DialogCard key={dialog.id} dialog={dialog} /> : null;
}

function DialogCard({ dialog }: { dialog: WebDialog }) {
  const { colors } = useTheme();
  const cancel = dialog.buttons.find(b => b.style === 'cancel');
  const dismiss = () => { if (dialog.cancelable) closeWebDialog(dialog.id, cancel); };
  // Side by side when they fit, like iOS; stacked otherwise
  const row = dialog.buttons.length <= 2 && dialog.buttons.every(b => (b.text ?? '').length <= 14);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <Pressable style={[styles.veil, { backgroundColor: colors.backgroundVeil }]} onPress={dismiss} accessible={false}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="alert" accessibilityViewIsModal>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{dialog.title}</Text>
          {!!dialog.message && <Text style={[styles.message, { color: colors.textMuted }]}>{dialog.message}</Text>}
          <View style={[styles.buttons, row && styles.buttonsRow]}>
            {dialog.buttons.map((button, i) => {
              const color = button.style === 'destructive' ? colors.danger : button.style === 'cancel' ? colors.textMuted : colors.primaryText;
              return (
                <Pressable
                  key={i}
                  onPress={() => closeWebDialog(dialog.id, button)}
                  accessibilityRole="button"
                  style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                    styles.button,
                    row && styles.buttonInRow,
                    row && i > 0 && styles.buttonAfter,
                    { borderColor: colors.border, backgroundColor: pressed || hovered ? colors.neutralSoft : 'transparent' },
                  ]}
                >
                  <Text style={[styles.buttonText, { color, fontWeight: button.style === 'cancel' ? '600' : '700' }]}>{button.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veil: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingTop: 20, overflow: 'hidden', cursor: 'auto' } as never,
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', paddingHorizontal: 20 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  buttons: { marginTop: 18 },
  buttonsRow: { flexDirection: 'row' },
  button: { paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  buttonInRow: { flex: 1 },
  buttonAfter: { borderLeftWidth: StyleSheet.hairlineWidth },
  buttonText: { fontSize: 16, textAlign: 'center' },
});
