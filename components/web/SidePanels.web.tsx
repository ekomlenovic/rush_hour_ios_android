import React, { useSyncExternalStore } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import QrCode from '@/components/multi/QrCode';
import { WEB_MAX_WIDTH } from '@/utils/webViewport';
import { APP_URL } from '@/utils/shareResult';
import { useTheme } from '@/theme';

// Room for a panel on each side of the column, and a mouse: a computer, not a phone or a tablet
const QUERY = '(min-width: 1100px) and (hover: hover) and (pointer: fine)';
// The install page of the portfolio: Google Play on Android, SideStore, LiveContainer or the .ipa on iPhone
const INSTALL_PAGE_URL = 'https://ekomlenovic.github.io/rush-hours/';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.rushhours.app';
const ISSUES_URL = `${APP_URL}/issues/new/choose`;

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null;
const subscribe = (onChange: () => void) => {
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};
const hasRoom = () => media?.matches ?? false;

/** The install page in the player's language: the portfolio has French (its default) and English, not Serbian */
const installPageUrl = (language: string) => (language.startsWith('fr') ? INSTALL_PAGE_URL : `${INSTALL_PAGE_URL}?lang=en`);

/**
 * The web version on a computer: the sides of the game column are empty. On the left, the apps
 * (a QR code to the install page, Google Play, iPhone), on the right the source code on GitHub.
 * Fixed to the window, beside the column (#root in public/index.html), only when both fit and the
 * pointer is a mouse. Mounted once by the root layout.
 */
export default function SidePanels() {
  const room = useSyncExternalStore(subscribe, hasRoom, () => false);
  return room ? <Panels /> : null;
}

function Panels() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const installUrl = installPageUrl(i18n.language);
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <>
      <View style={[styles.side, styles.left]}>
        <View style={card}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('web.side_app_title')}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{t('web.side_app_body')}</Text>
          <View style={styles.qr}>
            <QrCode value={installUrl} size={168} accessibilityLabel={t('web.side_app_qr')} />
          </View>
          <LinkButton icon="logo-google-playstore" label={t('web.side_app_android')} url={PLAY_STORE_URL} primary />
          <LinkButton icon="logo-apple" label={t('web.side_app_ios')} url={installUrl} />
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('web.side_app_save')}</Text>
        </View>
      </View>

      <View style={[styles.side, styles.right]}>
        <View style={card}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('web.side_code_title')}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{t('web.side_code_body')}</Text>
          <LinkButton icon="logo-github" label={t('web.side_code_github')} url={APP_URL} primary />
          <LinkButton icon="bug-outline" label={t('web.side_code_issue')} url={ISSUES_URL} />
        </View>
      </View>
    </>
  );
}

function LinkButton({ icon, label, url, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string; primary?: boolean }) {
  const { colors } = useTheme();
  const color = primary ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.button,
        primary
          ? { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed || hovered ? 0.88 : 1 }
          : { borderColor: colors.border, backgroundColor: pressed || hovered ? colors.neutralSoft : 'transparent' },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
      <Ionicons name="open-outline" size={14} color={color} style={styles.external} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // From the edge of the window to the edge of the column: position fixed takes them out of it
  side: { position: 'fixed', top: 0, bottom: 0, width: `calc(50% - ${WEB_MAX_WIDTH / 2}px)`, alignItems: 'center', justifyContent: 'center', padding: 32 } as never,
  left: { left: 0 },
  right: { right: 0 },
  card: { width: '100%', maxWidth: 300, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 22, gap: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  qr: { alignItems: 'center', marginVertical: 6 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  buttonText: { flex: 1, fontSize: 15, fontWeight: '600' },
  external: { opacity: 0.7 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
