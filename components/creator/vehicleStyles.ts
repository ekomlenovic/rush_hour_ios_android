import { StyleSheet } from 'react-native';
import { fixedColors } from '@/theme/ui';

/** Vehicle styles shared by the board vehicles and the floating drag preview */
export const vehicleStyles = StyleSheet.create({
  vehicleBlock: { position: 'absolute', justifyContent: 'center', alignItems: 'center', borderRadius: 9, borderWidth: 1, shadowColor: fixedColors.shadow, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, overflow: 'hidden' },
  vehicleShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%', borderRadius: 9 },
  vehicleShineV: { height: undefined, top: 0, bottom: undefined, right: 0, left: 0, width: '38%' },
  vehicleGrip: { flexDirection: 'row', gap: 5, opacity: 0.55 },
  gripDot: { width: 5, height: 5, borderRadius: 3 },
  /** A drawn vehicle has its own body, chrome and shadow */
  drawnBlock: { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, overflow: 'visible' },
});
