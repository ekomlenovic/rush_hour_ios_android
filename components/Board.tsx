import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform, type HostInstance } from 'react-native';
import { Vehicle, useGameStore } from '@/store/gameStore';
import { getMoveBounds } from '@/utils/collision';
import Block, { BlockA11yStrings } from './Block';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getVehicleLetters, describeVehicle, describePosition, describeExit } from '@/utils/accessibility';
import { useTheme, useBoardTheme, BoardLookProvider, applyPalette, PALETTE_ART, type BoardLook } from '@/theme';


interface BoardProps {
  gridSize: number;
  vehicles: Vehicle[];
  exitRow: number;
  exitCol: number;
  /** false when the move is refused (another vehicle got there first): the vehicle goes back */
  onMoveEnd: (vehicleId: string, newRow: number, newCol: number) => boolean | void;
  hintVehicleId?: string | null;
  disabled?: boolean;
  /** No dragging, without the lock overlay (solution replay) */
  readOnly?: boolean;
  /** Width of the board; the width of the screen by default */
  size?: number;
  /** Another player's look (multiplayer); the selected cosmetics by default */
  look?: BoardLook;
}


const BOARD_PADDING = 24;
// The frame border is drawn inside the board's width: cells only get what is left
const BOARD_BORDER = 2;

const Board = React.memo(({ gridSize, vehicles, exitRow, exitCol, onMoveEnd, hintVehicleId, disabled = false, readOnly = false, size, look }: BoardProps) => {

  const { colors } = useTheme();
  const { board, palette } = useBoardTheme(look);

  const { width: screenWidth } = useWindowDimensions();
  const boardSize = size ?? screenWidth - BOARD_PADDING * 2;
  const cellSize = (boardSize - BOARD_BORDER * 2) / gridSize;

  const gridColor = board.grid;
  const boardBg = board.background;
  const exitColor = board.exit;

  // The web version: the board never pans the page (see docs/GAME_DESIGN.md, Version web). The touch-action
  // gesture-handler puts on a vehicle changes when it is enabled (end of a duel's countdown), and Safari on
  // iOS can keep the old one: its own pan took the finger, and the vehicle did not move. Set once on the board
  // (the vehicles inside take it), and a touchmove refused, which Safari always respects
  const boardRef = useRef<HostInstance>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = boardRef.current as unknown as HTMLElement | null;
    if (!node) return;
    node.style.touchAction = 'none';
    const refuse = (event: TouchEvent) => { if (event.cancelable) event.preventDefault(); };
    node.addEventListener('touchmove', refuse, { passive: false });
    return () => node.removeEventListener('touchmove', refuse);
  }, []);

  const { t } = useTranslation();
  const showVehicleLetters = useGameStore(s => s.showVehicleLetters);
  const letters = useMemo(() => getVehicleLetters(vehicles), [vehicles]);
  // Colors of the selected palette (cosmetic), the level's own colors with the classic one
  const displayColors = useMemo(() => applyPalette(vehicles, palette), [vehicles, palette]);
  const a11yStrings = useMemo<BlockA11yStrings>(() => ({
    hint: t('a11y.vehicle_hint'),
    blocked: t('a11y.blocked'),
    left: t('a11y.move_left'),
    right: t('a11y.move_right'),
    up: t('a11y.move_up'),
    down: t('a11y.move_down'),
  }), [t]);

  // Calculate bounds for all vehicles at once
  // This ensures that when ANY vehicle moves, we re-calculate for all,
  // and pass the new numeric props down.
  const vehicleBounds = useMemo(() => {
    return vehicles.map(v => ({
      id: v.id,
      bounds: getMoveBounds(v, vehicles, gridSize)
    }));
  }, [vehicles, gridSize]);

  // Build grid lines
  const gridLines = [];
  for (let i = 0; i <= gridSize; i++) {
    // Horizontal lines
    gridLines.push(
      <View
        key={`h-${i}`}
        style={{
          position: 'absolute',
          top: i * cellSize,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: gridColor,
        }}
      />
    );
    // Vertical lines
    gridLines.push(
      <View
        key={`v-${i}`}
        style={{
          position: 'absolute',
          left: i * cellSize,
          top: 0,
          bottom: 0,
          width: 1,
          backgroundColor: gridColor,
        }}
      />
    );
  }

  return (
    // Its vehicles drawn with the same look
    <BoardLookProvider value={look ?? null}>
      <View
        ref={boardRef}
        style={[
          styles.boardContainer,
          {
            width: boardSize,
            height: boardSize,
            backgroundColor: boardBg,
            borderColor: board.frame,
            borderRadius: board.boardRadius,
          },
        ]}
      >
        {/* Grid lines */}
        {gridLines}

        {/* Vehicles */}
        {cellSize > 0 && !isNaN(cellSize) && vehicles.map((v) => {
          const b = vehicleBounds.find(vb => vb.id === v.id)?.bounds || { min: 0, max: gridSize - v.length };
          const color = displayColors.get(v.id) ?? v.color;
          return (
            <Block
              key={v.id}
              vehicle={v}
              color={color}
              allVehicles={vehicles}
              gridSize={gridSize}
              cellSize={cellSize}
              onMoveEnd={onMoveEnd}
              isHinted={hintVehicleId === v.id}
              min={b.min}
              max={b.max}
              disabled={disabled || readOnly}
              a11yLabel={describeVehicle(t, { ...v, color }, letters[v.id])}
              a11yValue={describePosition(t, v)}
              a11yStrings={a11yStrings}
              letter={showVehicleLetters ? (v.isTarget ? '★' : letters[v.id]) : undefined}
              art={v.isTarget ? board.targetArt : PALETTE_ART[palette]}
            />
          );
        })}

        {/* Exit indicator and glow - Rendered AFTER vehicles to be on top */}
        {(() => {
          const isRight = exitCol >= gridSize && exitCol !== 255;
          const isLeft = exitCol === 255 || exitCol < 0;
          const isBottom = exitRow >= gridSize && exitRow !== 255;
          const isTop = exitRow === 255 || exitRow < 0;

          let indicatorStyle: any = {};
          let glowStyle: any = {};

          // Back to original dimensions but with high zIndex and a black border
          if (isRight) {
            indicatorStyle = { top: exitRow * cellSize + cellSize * 0.2, right: 0, width: 6, height: cellSize * 0.6, borderRadius: 3 };
            glowStyle = { top: exitRow * cellSize, right: -8, width: 16, height: cellSize, opacity: 0.15, borderRadius: 8 };
          } else if (isLeft) {
            indicatorStyle = { top: exitRow * cellSize + cellSize * 0.2, left: 0, width: 6, height: cellSize * 0.6, borderRadius: 3 };
            glowStyle = { top: exitRow * cellSize, left: -8, width: 16, height: cellSize, opacity: 0.15, borderRadius: 8 };
          } else if (isBottom) {
            indicatorStyle = { left: exitCol * cellSize + cellSize * 0.2, bottom: 0, height: 6, width: cellSize * 0.6, borderRadius: 3 };
            glowStyle = { left: exitCol * cellSize, bottom: -8, height: 16, width: cellSize, opacity: 0.15, borderRadius: 8 };
          } else if (isTop) {
            indicatorStyle = { left: exitCol * cellSize + cellSize * 0.2, top: 0, height: 6, width: cellSize * 0.6, borderRadius: 3 };
            glowStyle = { left: exitCol * cellSize, top: -8, height: 16, width: cellSize, opacity: 0.15, borderRadius: 8 };
          }

          return (
            <>
              <View
                accessible
                accessibilityLabel={describeExit(t, exitRow, exitCol, gridSize)}
                style={[
                  styles.exitIndicator, 
                  { 
                    backgroundColor: exitColor, 
                    ...indicatorStyle,
                    borderColor: board.exitOutline,
                    borderWidth: 1,
                    zIndex: 60, // Ensure it's above vehicles
                  }
                ]} 
              />
              <View 
                style={{ 
                  position: 'absolute', 
                  backgroundColor: exitColor, 
                  ...glowStyle,
                  zIndex: 59,
                }} 
              />
            </>
          );
        })()}

        {disabled && (
          <View
            pointerEvents="auto"
            accessible
            accessibilityLabel={t('a11y.board_locked')}
            style={[
              StyleSheet.absoluteFill, 
              { 
                backgroundColor: board.winVeil,
                zIndex: 100,
                justifyContent: 'center',
                alignItems: 'center',
              }
            ]} 
          >
            <View
              style={{
                backgroundColor: board.winBadge,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: board.winBadgeBorder,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Ionicons name="lock-closed" size={24} color={colors.text} />
            </View>
          </View>
        )}
      </View>
    </BoardLookProvider>
  );
});

const styles = StyleSheet.create({
  boardContainer: {
    borderWidth: BOARD_BORDER,
    overflow: 'hidden',
    position: 'relative',
  },
  exitIndicator: {
    position: 'absolute',
    width: 6,
    borderRadius: 3,
    zIndex: 10,
  },
});

export default Board;
