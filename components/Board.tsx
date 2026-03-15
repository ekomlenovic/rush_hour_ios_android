import React, { useMemo } from 'react';
import { View, StyleSheet, useColorScheme, Dimensions } from 'react-native';
import { Vehicle } from '@/store/gameStore';
import { getMoveBounds } from '@/utils/collision';
import Block from './Block';

interface BoardProps {
  gridSize: number;
  vehicles: Vehicle[];
  exitRow: number;
  exitCol: number;
  onMoveEnd: (vehicleId: string, newRow: number, newCol: number) => void;
  hintVehicleId?: string | null;
}

const BOARD_PADDING = 24;

const Board = React.memo(({ gridSize, vehicles, exitRow, exitCol, onMoveEnd, hintVehicleId }: BoardProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const screenWidth = Dimensions.get('window').width;
  const boardSize = screenWidth - BOARD_PADDING * 2;
  const cellSize = boardSize / gridSize;

  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const boardBg = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.02)';
  const exitColor = '#EF4444';

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
    <View
      style={[
        styles.boardContainer,
        {
          width: boardSize,
          height: boardSize,
          backgroundColor: boardBg,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        },
      ]}
    >
      {/* Grid lines */}
      {gridLines}

      {/* Exit indicator */}
      <View
        style={[
          styles.exitIndicator,
          {
            top: exitRow * cellSize + cellSize * 0.2,
            left: boardSize - 3,
            height: cellSize * 0.6,
            backgroundColor: exitColor,
          },
        ]}
      />

      {/* Exit glow */}
      <View
        style={{
          position: 'absolute',
          top: exitRow * cellSize,
          right: -8,
          width: 16,
          height: cellSize,
          backgroundColor: exitColor,
          opacity: 0.15,
          borderRadius: 8,
        }}
      />

      {/* Vehicles */}
      {vehicles.map((v) => {
        const b = vehicleBounds.find(vb => vb.id === v.id)?.bounds || { min: 0, max: gridSize };
        return (
          <Block
            key={v.id}
            vehicle={v}
            allVehicles={vehicles}
            gridSize={gridSize}
            cellSize={cellSize}
            onMoveEnd={onMoveEnd}
            isHinted={hintVehicleId === v.id}
            min={b.min}
            max={b.max}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  boardContainer: {
    borderRadius: 16,
    borderWidth: 2,
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
