import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, Dimensions, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useGameStore, Vehicle, Level } from '@/store/gameStore';
import { validateLevel } from '@/utils/solver';
import * as Haptics from 'expo-haptics';

const BOARD_PADDING = 20;
const GRID_SIZE = 6;

type VehicleTemplate = {
  type: 'car' | 'truck';
  orientation: 'horizontal' | 'vertical';
  length: number;
  color: string;
};

const TOOLBOX_ITEMS: VehicleTemplate[] = [
  { type: 'car', orientation: 'horizontal', length: 2, color: '#3B82F6' },
  { type: 'car', orientation: 'vertical', length: 2, color: '#10B981' },
  { type: 'truck', orientation: 'horizontal', length: 3, color: '#F59E0B' },
  { type: 'truck', orientation: 'vertical', length: 3, color: '#8B5CF6' },
];

export default function LevelCreatorScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{ levelId: string }>();
  const { saveCreatedLevel, createdLevels, importedLevels } = useGameStore();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [exitRow, setExitRow] = useState(2);

  const screenWidth = Dimensions.get('window').width;
  const boardSize = screenWidth - BOARD_PADDING * 2;
  const cellSize = boardSize / GRID_SIZE;

  // Load existing level if editing
  useEffect(() => {
    if (params.levelId) {
      const id = parseInt(params.levelId);
      const level = [...createdLevels, ...importedLevels].find(l => l.id === id);
      if (level) {
        setVehicles(level.vehicles.map(v => ({ ...v })));
        setExitRow(level.exitRow || 2);
      }
    } else {
      // Default: Red Target Car
      setVehicles([
        {
          id: 'target',
          row: 2,
          col: 0,
          length: 2,
          orientation: 'horizontal',
          isTarget: true,
          color: '#EF4444'
        }
      ]);
    }
  }, [params.levelId]);

  const addVehicle = useCallback((template: VehicleTemplate, row: number, col: number) => {
    // Check if within bounds
    if (template.orientation === 'horizontal') {
      if (col + template.length > GRID_SIZE) return;
    } else {
      if (row + template.length > GRID_SIZE) return;
    }

    // Check collision
    const overlaps = vehicles.some(v => {
      for (let i = 0; i < v.length; i++) {
        const vr = v.orientation === 'vertical' ? v.row + i : v.row;
        const vc = v.orientation === 'horizontal' ? v.col + i : v.col;
        
        for (let j = 0; j < template.length; j++) {
          const tr = template.orientation === 'vertical' ? row + j : row;
          const tc = template.orientation === 'horizontal' ? col + j : col;
          if (vr === tr && vc === tc) return true;
        }
      }
      return false;
    });

    if (overlaps) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    const newVehicle: Vehicle = {
      id: `v${Date.now()}`,
      row,
      col,
      length: template.length,
      orientation: template.orientation,
      isTarget: false,
      color: template.color
    };

    setVehicles([...vehicles, newVehicle]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [vehicles]);

  const removeVehicle = useCallback((id: string) => {
    if (id === 'target') return; // Cannot remove target car
    setVehicles(vehicles.filter(v => v.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [vehicles]);

  const handleTest = () => {
    const minMoves = validateLevel(vehicles, GRID_SIZE, exitRow, 5);
    if (minMoves === -1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Unsolvable", "This level has no solution. Keep trying!");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `This level is solvable in at least ${minMoves} moves!`);
    }
  };

  const handleSave = async () => {
    const minMoves = validateLevel(vehicles, GRID_SIZE, exitRow, 5);

    if (minMoves === -1) {
      Alert.alert("Unsolvable", "This level has no solution. Please try moving pieces.");
      return;
    }

    // If we're editing an imported level, save it as a NEW created level
    const isImported = params.levelId && importedLevels.some(l => l.id === parseInt(params.levelId));
    const newId = isImported ? Date.now() : (params.levelId ? parseInt(params.levelId) : Date.now());

    const newLevel: Level = {
      id: newId,
      gridSize: GRID_SIZE,
      vehicles,
      exitRow,
      exitCol: 5,
      minMoves
    };

    saveCreatedLevel(newLevel);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", isImported ? "Imported level saved as a new Created level!" : "Level saved successfully!", [
      { text: "OK", onPress: () => router.back() }
    ]);
  };

  const colors = isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', card: 'rgba(255,255,255,0.06)', grid: 'rgba(255,255,255,0.1)' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', card: 'rgba(0,0,0,0.04)', grid: 'rgba(0,0,0,0.1)' };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.sub }]}>←</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Level Creator</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={handleTest} style={[styles.testBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent }]}>
                <Text style={[styles.testBtnText, { color: colors.accent }]}>Test</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.accent }]}>
                <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.boardWrapper}>
          <View style={[styles.board, { width: boardSize, height: boardSize, borderColor: colors.grid }]}>
            {/* Grid lines */}
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
              <React.Fragment key={i}>
                <View style={[styles.gridLineH, { top: i * cellSize, backgroundColor: colors.grid }]} />
                <View style={[styles.gridLineV, { left: i * cellSize, backgroundColor: colors.grid }]} />
              </React.Fragment>
            ))}

            {/* Exit Indicator */}
            <View style={[styles.exitIndicator, { top: exitRow * cellSize + cellSize * 0.2, right: -5, height: cellSize * 0.6 }]} />

            {/* Vehicles on board */}
            {vehicles.map(v => (
              <Pressable
                key={v.id}
                onLongPress={() => removeVehicle(v.id)}
                style={[
                  styles.vehicle,
                  {
                    top: v.row * cellSize + 2,
                    left: v.col * cellSize + 2,
                    width: (v.orientation === 'horizontal' ? v.length : 1) * cellSize - 4,
                    height: (v.orientation === 'vertical' ? v.length : 1) * cellSize - 4,
                    backgroundColor: v.color,
                    borderRadius: 8
                  }
                ]}
              >
                <Text style={styles.vehicleId}>{v.isTarget ? '🏠' : ''}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.sub }]}>Long press a vehicle to remove it.</Text>
        </View>

        <View style={styles.toolbox}>
          <Text style={[styles.toolboxTitle, { color: colors.text }]}>Toolbox</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolboxContent}>
            {TOOLBOX_ITEMS.map((item, idx) => (
              <ToolboxItem 
                key={idx} 
                template={item} 
                cellSize={cellSize} 
                colors={colors}
                onDrop={(r: number, c: number) => addVehicle(item, r, c)}
                boardSize={boardSize}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

function ToolboxItem({ template, cellSize, colors, onDrop, boardSize }: { template: VehicleTemplate, cellSize: number, colors: any, onDrop: (r: number, c: number) => void, boardSize: number }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const gesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
    })
    .onEnd((event) => {
      isDragging.value = false;
      
      const dropX = event.absoluteX - BOARD_PADDING;
      // Heuristic for board position since we don't have accurate layout measurements yet
      const dropY = event.absoluteY - 180; 

      if (dropX >= 0 && dropX < boardSize && dropY >= 0 && dropY < boardSize) {
        const col = Math.floor(dropX / cellSize);
        const row = Math.floor(dropY / cellSize);
        runOnJS(onDrop)(row, col);
      }

      x.value = 0;
      y.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: isDragging.value ? 1.2 : 1 }
    ],
    zIndex: isDragging.value ? 1000 : 1,
  }));

  const width = (template.orientation === 'horizontal' ? template.length : 1) * 30; // mini preview
  const height = (template.orientation === 'vertical' ? template.length : 1) * 30;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.toolboxItem, animatedStyle, { backgroundColor: colors.card }]}>
        <View style={{ 
          width, 
          height, 
          backgroundColor: template.color, 
          borderRadius: 4,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)'
        }} />
        <Text style={[styles.toolLabel, { color: colors.sub }]}>{template.length}x1</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingTop: 60, 
    paddingHorizontal: 20,
    marginBottom: 20
  },
  backButton: { width: 44, height: 44, justifyContent: 'center' },
  backText: { fontSize: 24, fontWeight: '700' },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  saveBtnText: { color: '#FFF', fontWeight: '700' },
  testBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  testBtnText: { fontWeight: '700' },
  boardWrapper: { alignItems: 'center', marginTop: 20 },
  board: { 
    position: 'relative', 
    borderWidth: 2, 
    borderRadius: 12, 
    backgroundColor: 'rgba(0,0,0,0.02)',
    overflow: 'hidden'
  },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1 },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  exitIndicator: { position: 'absolute', width: 6, backgroundColor: '#EF4444', borderRadius: 3 },
  vehicle: { position: 'absolute', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 },
  vehicleId: { color: '#FFF', fontSize: 20 },
  hint: { marginTop: 16, fontSize: 14, fontStyle: 'italic' },
  toolbox: { marginTop: 'auto', paddingBottom: 40, paddingHorizontal: 20 },
  toolboxTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  toolboxContent: { gap: 16, paddingRight: 40 },
  toolboxItem: { padding: 12, borderRadius: 16, alignItems: 'center', gap: 8 },
  toolLabel: { fontSize: 12, fontWeight: '600' }
});
