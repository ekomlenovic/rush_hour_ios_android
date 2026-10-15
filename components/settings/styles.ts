import { StyleSheet } from 'react-native';
import { RFValue } from '@/utils/responsive';
import { fixedColors } from '@/theme';

/** Styles shared by the sections of the options sheet */
export const settingsStyles = StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingText: {
    flexShrink: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSub: {
    fontSize: RFValue(13),
  },
  divider: {
    height: 1,
    opacity: 0.2,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: RFValue(14),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: fixedColors.neutralSoft,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  mainBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  mainBtnText: {
    color: fixedColors.onPrimary,
    fontSize: RFValue(16),
    fontWeight: '800',
  },
  outlineBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
});
