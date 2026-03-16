import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 375;

/**
 * Scales a size based on screen width.
 * @param size The size to scale.
 */
export const scale = (size: number) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Scales a font size with a limit to avoid it becoming too large or too small.
 * @param size The original font size.
 */
export const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Returns a responsive font size.
 */
export const RFValue = (fontSize: number) => {
  const scaledSize = moderateScale(fontSize);
  // PixelRatio.getFontScale() handles the user's OS-level font size preference
  return Math.round(scaledSize);
};
