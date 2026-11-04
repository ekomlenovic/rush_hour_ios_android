import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import ArtSvg from '@/components/art/ArtSvg';
import { useBoardTheme, useTheme, type BoardLook } from '@/theme';
import { boardBackdrop } from '@/theme/art/boardDecor';

interface Props {
  /** Another player's look (multiplayer); the selected cosmetics by default */
  look?: BoardLook;
  /** Where it is drawn: the whole parent by default (half of a duel otherwise) */
  style?: StyleProp<ViewStyle>;
}

/**
 * The backdrop of an event board (Halloween, Christmas…) behind a game screen, from top to bottom:
 * put first in the screen, it draws nothing with a board without one
 */
function BoardBackdrop({ look, style }: Props) {
  const { scheme } = useTheme();
  const { board } = useBoardTheme(look);
  const [size, setSize] = useState({ width: 0, height: 0 });
  if (!board.backdrop) return null;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(s => (Math.round(s.width) === Math.round(width) && Math.round(s.height) === Math.round(height) ? s : { width, height }));
  };
  const drawing = boardBackdrop(board.backdrop, scheme, size.width, size.height);
  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style ?? StyleSheet.absoluteFill}
    >
      {drawing && <ArtSvg drawing={drawing} width={size.width} height={size.height} />}
    </View>
  );
}

export default React.memo(BoardBackdrop);
