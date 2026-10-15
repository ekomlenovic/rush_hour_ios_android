import { withTiming } from 'react-native-reanimated';

/** Short timing used by the creator's drag animations */
export const SNAP = (val: number) => {
  'worklet';
  return withTiming(val, { duration: 110 });
};
