import { StyleSheet } from 'react-native';
import { RFValue } from '@/utils/responsive';

/** Shared look of the admin panel */
export const adminStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: RFValue(12),
    marginBottom: RFValue(10),
  },
  title: {
    fontSize: RFValue(15),
    fontWeight: '800',
  },
  muted: {
    fontSize: RFValue(12),
    lineHeight: RFValue(17),
    marginTop: 2,
  },
  warning: {
    fontSize: RFValue(12),
    fontWeight: '700',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: RFValue(10),
  },
  button: {
    paddingVertical: RFValue(8),
    paddingHorizontal: RFValue(12),
    borderRadius: 10,
  },
  buttonText: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  empty: {
    fontSize: RFValue(14),
    textAlign: 'center',
    paddingVertical: RFValue(24),
  },
  sectionTitle: {
    fontSize: RFValue(14),
    fontWeight: '800',
    marginTop: RFValue(14),
    marginBottom: RFValue(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: RFValue(8),
    gap: 10,
  },
  rowLabel: {
    flex: 1,
    fontSize: RFValue(14),
    fontWeight: '600',
  },
});
