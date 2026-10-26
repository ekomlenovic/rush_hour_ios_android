/**
 * Home screen widget of iOS (issue 151): streak, freezes and the daily challenge.
 * Same colors as the app (theme/ui.ts), light and dark. Rules in docs/GAME_DESIGN.md.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'widget',
  displayName: 'Rush Hours',
  bundleIdentifier: '.widget',
  icon: '../../assets/icon.png',
  // The app's (Podfile)
  deploymentTarget: '16.4',
  // The app group the app writes the widget's data in (modules/rush-widget)
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
  colors: {
    $widgetBackground: { light: '#FFFFFF', dark: '#1A1A2E' },
    $accent: { light: '#5A4FE0', dark: '#8B85FF' },
    rushBackground: { light: '#FFFFFF', dark: '#1A1A2E' },
    rushText: { light: '#1A1A2E', dark: '#FFFFFF' },
    rushMuted: { light: '#6B6B80', dark: '#8E8EA0' },
    rushFlame: { light: '#B45309', dark: '#F59E0B' },
    rushFrozen: '#7DD3FC',
    rushOnFrozen: '#0F0F1A',
    rushSuccess: { light: '#047857', dark: '#10B981' },
    rushDanger: { light: '#B91C1C', dark: '#EF4444' },
    rushStar: { light: '#FFB800', dark: '#FFD700' },
    rushPrimary: { light: '#5A4FE0', dark: '#8B85FF' },
  },
});
