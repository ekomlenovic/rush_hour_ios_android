import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, useColorScheme, Pressable,
  Dimensions, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withTiming,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useGameStore, Vehicle, Level } from '@/store/gameStore';
import { validateLevel } from '@/utils/solver';
import * as Haptics from 'expo-haptics';

const SNAP = (val: number) => {
  'worklet';
  return withTiming(val, { duration: 110 });
};

const BOARD_PADDING = 20;
const GRID_SIZE = 6;
const MINI_CELL = 30;

// ─── Palettes et Données ──────────────────────────────────────────────────────

const CAR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
  '#6366F1', '#84CC16', '#D946EF', '#0EA5E9'
];

type VehicleTemplate = {
  type: 'car' | 'truck';
  orientation: 'horizontal' | 'vertical';
  length: number;
  color: string;
  label: string;
  dirIcon: string;
};

type ActiveDrag = {
  id: string;
  orientation: 'horizontal' | 'vertical';
  length: number;
  color: string;
  screenX: number;
  screenY: number;
  targetRow: number;
  targetCol: number;
  isValid: boolean;
};

const TOOLBOX_ITEMS: VehicleTemplate[] = [
  { type: 'car', orientation: 'horizontal', length: 2, color: '#3B82F6', label: 'Car', dirIcon: '⟷' },
  { type: 'car', orientation: 'vertical', length: 2, color: '#10B981', label: 'Car', dirIcon: '↕' },
  { type: 'truck', orientation: 'horizontal', length: 3, color: '#F59E0B', label: 'Truck', dirIcon: '⟷' },
  { type: 'truck', orientation: 'vertical', length: 3, color: '#8B5CF6', label: 'Truck', dirIcon: '↕' },
];

const DIR_LABEL = {
  horizontal: '↔',
  vertical: '↕',
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LevelCreatorScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{ levelId: string }>();
  const { saveCreatedLevel, createdLevels, importedLevels } = useGameStore();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [exitRow, setExitRow] = useState(2);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const boardRef = useRef<View>(null);
  const boardPos = useRef({ x: 0, y: 0 });
  const vehiclesRef = useRef<Vehicle[]>([]);

  const screenWidth = Dimensions.get('window').width;
  const boardSize = screenWidth - BOARD_PADDING * 2;
  const cellSize = boardSize / GRID_SIZE;

  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y) => {
      boardPos.current = { x, y };
    });
  }, []);

  // ── Load existing level ──
  useEffect(() => {
    if (params.levelId) {
      const id = parseInt(params.levelId);
      const level = [...createdLevels, ...importedLevels].find(l => l.id === id);
      if (level) {
        setVehicles(level.vehicles.map(v => ({ ...v })));
        setExitRow(level.exitRow ?? 2);
        return;
      }
    }
    setVehicles([{
      id: 'target', row: 2, col: 0, length: 2,
      orientation: 'horizontal', isTarget: true, color: '#EF4444',
    }]);
  }, []);

  // ── Helpers ──

  /** Convertit la position centrale du véhicule en ligne/colonne de grille (avec gestion du vrai offset) */
  const screenToGrid = useCallback((
    centerX: number, centerY: number,
    orientation: 'horizontal' | 'vertical', length: number,
  ) => {
    // 1. Position relative au plateau
    const lx = centerX - boardPos.current.x;
    const ly = centerY - boardPos.current.y;

    // 2. Taille en pixels du véhicule
    const itemW = (orientation === 'horizontal' ? length : 1) * cellSize;
    const itemH = (orientation === 'vertical' ? length : 1) * cellSize;

    // 3. Calcul du coin supérieur gauche du véhicule pour un "snap" parfait
    const topX = lx - itemW / 2;
    const topY = ly - itemH / 2;

    // 4. Bornes maximales
    const maxCol = GRID_SIZE - (orientation === 'horizontal' ? length : 1);
    const maxRow = GRID_SIZE - (orientation === 'vertical' ? length : 1);

    return {
      col: Math.max(0, Math.min(maxCol, Math.round(topX / cellSize))),
      row: Math.max(0, Math.min(maxRow, Math.round(topY / cellSize))),
    };
  }, [cellSize]);

  const hasCollision = useCallback((
    row: number, col: number,
    orientation: 'horizontal' | 'vertical', length: number,
    excludeId?: string,
  ) => {
    const cells: [number, number][] = [];
    for (let i = 0; i < length; i++) {
      cells.push([
        orientation === 'vertical' ? row + i : row,
        orientation === 'horizontal' ? col + i : col,
      ]);
    }
    return vehiclesRef.current.some(v => {
      if (v.id === excludeId) return false;
      for (let i = 0; i < v.length; i++) {
        const vr = v.orientation === 'vertical' ? v.row + i : v.row;
        const vc = v.orientation === 'horizontal' ? v.col + i : v.col;
        if (cells.some(([r, c]) => r === vr && c === vc)) return true;
      }
      return false;
    });
  }, []);

  const updateDrag = useCallback((
    id: string,
    orientation: 'horizontal' | 'vertical', length: number, color: string,
    centerX: number, centerY: number,
    excludeId?: string,
  ) => {
    const { row, col } = screenToGrid(centerX, centerY, orientation, length);
    const isValid = !hasCollision(row, col, orientation, length, excludeId);
    setActiveDrag({ id, orientation, length, color, screenX: centerX, screenY: centerY, targetRow: row, targetCol: col, isValid });
  }, [screenToGrid, hasCollision]);

  /** Calcule la position centrale visuelle d'un véhicule du plateau en cours de drag */
  const getVehicleVisualCenter = useCallback((v: Vehicle, tx: number, ty: number) => {
    const w = (v.orientation === 'horizontal' ? v.length : 1) * cellSize;
    const h = (v.orientation === 'vertical' ? v.length : 1) * cellSize;
    const cx = boardPos.current.x + v.col * cellSize + w / 2 + tx;
    const cy = boardPos.current.y + v.row * cellSize + h / 2 + ty;
    return { cx, cy };
  }, [cellSize]);

  // ── Mutations ──
  const moveVehicle = useCallback((vehicleId: string, row: number, col: number) => {
    setVehicles(prev => {
      const next = prev.map(v => v.id === vehicleId ? { ...v, row, col } : v);
      if (next.find(v => v.id === vehicleId)?.isTarget) setExitRow(row);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const placeFromToolbox = useCallback((template: VehicleTemplate, screenX: number, screenY: number) => {
    const lx = screenX - boardPos.current.x;
    const ly = screenY - boardPos.current.y;

    // Annuler si lâché beaucoup trop loin du plateau
    if (lx < -cellSize || lx > boardSize + cellSize || ly < -cellSize || ly > boardSize + cellSize) return;

    const { row, col } = screenToGrid(screenX, screenY, template.orientation, template.length);

    if (hasCollision(row, col, template.orientation, template.length)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setVehicles(prev => [...prev, {
      id: `v${Date.now()}`, row, col,
      length: template.length, orientation: template.orientation,
      isTarget: false, color: template.color,
    }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [screenToGrid, hasCollision, boardSize, cellSize]);

  const removeVehicle = useCallback((id: string) => {
    if (id === 'target') return;
    setVehicles(prev => prev.filter(v => v.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // ── Actions ──
  const handleTest = () => {
    const minMoves = validateLevel(vehicles, GRID_SIZE, exitRow, 5);
    if (minMoves === -1) {
      Alert.alert('Unsolvable ✗', 'No valid solution found. Keep adjusting!');
    } else {
      Alert.alert('Solvable ✓', `Minimum ${minMoves} move${minMoves === 1 ? '' : 's'} to complete.`);
    }
  };

  const handleSave = () => {
    const minMoves = validateLevel(vehicles, GRID_SIZE, exitRow, 5);
    if (minMoves === -1) {
      Alert.alert('Unsolvable', 'Fix the level before saving.');
      return;
    }
    const isImported = params.levelId && importedLevels.some(l => l.id === parseInt(params.levelId));
    const newId = isImported ? Date.now() : (params.levelId ? parseInt(params.levelId) : Date.now());
    const newLevel: Level = { id: newId, gridSize: GRID_SIZE, vehicles, exitRow, exitCol: 5, minMoves };
    saveCreatedLevel(newLevel);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved!', isImported ? 'Saved as a new level.' : 'Level updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  // ── Couleurs Dynamiques ──
  const usedColors = vehicles.map(v => v.color);
  const getNextAvailableColor = (baseColor: string) => {
    if (!usedColors.includes(baseColor)) return baseColor;
    const available = CAR_PALETTE.filter(c => !usedColors.includes(c) && c !== '#EF4444');
    return available.length > 0 ? available[0] : CAR_PALETTE[Math.floor(Math.random() * CAR_PALETTE.length)];
  };

  // ── Theme & Rendering Data ──
  const C = isDark ? {
    bg: '#0C0C18', surface: '#13131F', text: '#EEEEFF', sub: '#6E6E8A',
    accent: '#7B71FF', card: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.09)',
    grid: 'rgba(255,255,255,0.06)', boardBg: 'rgba(255,255,255,0.015)', toolBg: 'rgba(255,255,255,0.04)',
  } : {
    bg: '#ECEAF5', surface: '#F8F7FF', text: '#18182C', sub: '#7070A0',
    accent: '#5B4FE8', card: 'rgba(255,255,255,0.85)', border: 'rgba(90,79,224,0.15)',
    grid: 'rgba(0,0,0,0.06)', boardBg: 'rgba(255,255,255,0.6)', toolBg: 'rgba(255,255,255,0.7)',
  };

  const ghostCells: [number, number][] = [];
  if (activeDrag) {
    for (let i = 0; i < activeDrag.length; i++) {
      ghostCells.push([
        activeDrag.orientation === 'vertical' ? activeDrag.targetRow + i : activeDrag.targetRow,
        activeDrag.orientation === 'horizontal' ? activeDrag.targetCol + i : activeDrag.targetCol,
      ]);
    }
  }

  const floatW = activeDrag ? (activeDrag.orientation === 'horizontal' ? activeDrag.length : 1) * cellSize - 4 : 0;
  const floatH = activeDrag ? (activeDrag.orientation === 'vertical' ? activeDrag.length : 1) * cellSize - 4 : 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: C.bg }]}>

        {/* ── Header ── */}
        <View style={[styles.header, { backgroundColor: C.bg }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backArrow, { color: C.sub }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: C.text }]}>Level Creator</Text>
          <View style={styles.headerRight}>
            <Pressable onPress={handleTest} style={[styles.pill, { borderColor: C.accent, borderWidth: 1.5 }]}>
              <Text style={[styles.pillText, { color: C.accent }]}>Test</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.pill, { backgroundColor: C.accent }]}>
              <Text style={[styles.pillText, { color: '#FFF' }]}>Save</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Board ── */}
        <View style={styles.boardWrapper}>
          <View style={[styles.exitLabelWrap, { top: exitRow * cellSize + cellSize * 0.5 - 10 }]}>
            <Text style={styles.exitLabel}>EXIT</Text>
            <Text style={styles.exitArrow}>▶</Text>
          </View>

          <View
            ref={boardRef}
            onLayout={() => requestAnimationFrame(measureBoard)}
            style={[styles.board, { width: boardSize, height: boardSize, borderColor: C.border, backgroundColor: C.boardBg }]}
          >
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
              <React.Fragment key={i}>
                <View style={[styles.gridH, { top: i * cellSize, backgroundColor: C.grid }]} />
                <View style={[styles.gridV, { left: i * cellSize, backgroundColor: C.grid }]} />
              </React.Fragment>
            ))}

            {ghostCells.map(([r, c], i) => (
              <View
                key={`ghost-${i}`} pointerEvents="none"
                style={[styles.ghostCell, {
                  top: r * cellSize + 2, left: c * cellSize + 2, width: cellSize - 4, height: cellSize - 4,
                  backgroundColor: activeDrag?.isValid ? 'rgba(74,222,128,0.28)' : 'rgba(248,113,113,0.28)',
                  borderColor: activeDrag?.isValid ? 'rgba(74,222,128,0.75)' : 'rgba(248,113,113,0.75)',
                }]}
              />
            ))}

            {vehicles.map(v => (
              <BoardVehicle
                key={v.id} vehicle={v} cellSize={cellSize} isGhost={activeDrag?.id === v.id}
                onDragStart={() => {
                  const { cx, cy } = getVehicleVisualCenter(v, 0, 0);
                  updateDrag(v.id, v.orientation, v.length, v.color, cx, cy, v.id);
                }}
                onDragMove={(tx, ty) => {
                  const { cx, cy } = getVehicleVisualCenter(v, tx, ty);
                  updateDrag(v.id, v.orientation, v.length, v.color, cx, cy, v.id);
                }}
                onDragEnd={(tx, ty) => {
                  const { cx, cy } = getVehicleVisualCenter(v, tx, ty);
                  const { row, col } = screenToGrid(cx, cy, v.orientation, v.length);
                  if (!hasCollision(row, col, v.orientation, v.length, v.id)) moveVehicle(v.id, row, col);
                  setActiveDrag(null);
                }}
                onRemove={() => removeVehicle(v.id)}
              />
            ))}
          </View>
          <Text style={[styles.hint, { color: C.sub }]}>Drag to move  ·  Long press to remove</Text>
        </View>

        {/* ── Floating preview (Le véhicule centré sur le doigt !) ── */}
        {activeDrag && (
          <View
            pointerEvents="none"
            style={[styles.floatingPreview, {
              left: activeDrag.screenX - floatW / 2,
              top: activeDrag.screenY - floatH / 2,
              width: floatW,
              height: floatH,
              backgroundColor: activeDrag.color,
            }]}
          >
            <View style={[styles.vehicleShine, activeDrag.orientation === 'vertical' && styles.vehicleShineV]} />
          </View>
        )}

        {/* ── Toolbox ── */}
        <View style={[styles.toolbox, { borderTopColor: C.border, backgroundColor: C.bg }]}>
          <Text style={[styles.toolboxHeading, { color: C.sub }]}>VEHICLES</Text>
          <View style={styles.toolboxGrid}>
            {TOOLBOX_ITEMS.map((item, idx) => {
              const dynamicColor = getNextAvailableColor(item.color);
              const templateWithColor = { ...item, color: dynamicColor };

              return (
                <ToolboxItem
                  key={idx}
                  template={templateWithColor}
                  colors={C}
                  onDragUpdate={(sx, sy, active) => {
                    if (!active) { setActiveDrag(null); return; }
                    updateDrag(`toolbox-${idx}`, templateWithColor.orientation, templateWithColor.length, templateWithColor.color, sx, sy);
                  }}
                  onDrop={(sx, sy) => placeFromToolbox(templateWithColor, sx, sy)}
                />
              );
            })}
          </View>
        </View>

      </View>
    </GestureHandlerRootView>
  );
}

// ─── BoardVehicle ─────────────────────────────────────────────────────────────

type BoardVehicleProps = {
  vehicle: Vehicle;
  cellSize: number;
  isGhost: boolean;
  onDragStart: () => void;
  onDragMove: (tx: number, ty: number) => void;
  onDragEnd: (tx: number, ty: number) => void;
  onRemove: () => void;
};

function BoardVehicle({ vehicle: v, cellSize, isGhost, onDragStart, onDragMove, onDragEnd, onRemove }: BoardVehicleProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = SNAP(isGhost ? 0.12 : 1);
  }, [isGhost]);

  const pan = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      sc.value = SNAP(1.05);
      runOnJS(onDragStart)();
    })
    .onUpdate(e => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      runOnJS(onDragMove)(e.translationX, e.translationY);
    })
    .onEnd(e => {
      sc.value = SNAP(1);
      tx.value = SNAP(0);
      ty.value = SNAP(0);
      runOnJS(onDragEnd)(e.translationX, e.translationY);
    });

  const longPress = Gesture.LongPress()
    .minDuration(600)
    .onStart(() => runOnJS(onRemove)());

  const gesture = Gesture.Exclusive(pan, longPress);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: sc.value },
    ],
    opacity: opacity.value,
    zIndex: sc.value > 1 ? 80 : 2,
    elevation: sc.value > 1 ? 10 : 4,
  }));

  const w = (v.orientation === 'horizontal' ? v.length : 1) * cellSize - 4;
  const h = (v.orientation === 'vertical' ? v.length : 1) * cellSize - 4;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[
        styles.vehicleBlock, animStyle,
        { top: v.row * cellSize + 2, left: v.col * cellSize + 2, width: w, height: h, backgroundColor: v.color },
      ]}>
        <View style={[styles.vehicleShine, v.orientation === 'vertical' && styles.vehicleShineV]} />
        {v.isTarget
          ? <Text style={styles.targetIcon}>🚗</Text>
          : <View style={[styles.vehicleGrip, v.orientation === 'vertical' && { flexDirection: 'column' }]}>
            <View style={styles.gripDot} /><View style={styles.gripDot} />
          </View>
        }
      </Animated.View>
    </GestureDetector>
  );
}

// ─── ToolboxItem ──────────────────────────────────────────────────────────────

type ToolboxItemProps = {
  template: VehicleTemplate;
  colors: Record<string, string>;
  onDragUpdate: (sx: number, sy: number, active: boolean) => void;
  onDrop: (sx: number, sy: number) => void;
};

function ToolboxItem({ template, colors, onDragUpdate, onDrop }: ToolboxItemProps) {
  const sc = useSharedValue(1);

  const gesture = Gesture.Pan()
    .onStart(() => {
      sc.value = SNAP(0.95);
    })
    .onUpdate(e => {
      runOnJS(onDragUpdate)(e.absoluteX, e.absoluteY, true);
    })
    .onEnd(e => {
      sc.value = SNAP(1);
      runOnJS(onDrop)(e.absoluteX, e.absoluteY);
      runOnJS(onDragUpdate)(e.absoluteX, e.absoluteY, false);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sc.value }]
  }));

  const isH = template.orientation === 'horizontal';
  const pw = (isH ? template.length : 1) * MINI_CELL;
  const ph = (!isH ? template.length : 1) * MINI_CELL;
  const dir = DIR_LABEL[template.orientation];
  const size = `${template.length}×1`;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.toolCard, animStyle, {
        backgroundColor: colors.toolBg,
        borderColor: colors.border,
      }]}>
        <View style={[styles.toolPreviewWrap, { width: pw + 8, height: Math.max(ph + 8, MINI_CELL + 8) }]}>
          <View style={[styles.toolPreview, { width: pw, height: ph, backgroundColor: template.color }]}>
            <View style={styles.toolPreviewShine} />
          </View>
        </View>

        <View style={styles.toolLabels}>
          <Text style={[styles.toolName, { color: colors.text }]}>{template.label}</Text>
          <View style={[styles.toolBadge, { backgroundColor: template.color + '28', borderColor: template.color + '55' }]}>
            <Text style={[styles.toolBadgeText, { color: template.color }]}>{dir} {size}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  backArrow: { fontSize: 26, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  pillText: { fontSize: 13, fontWeight: '700' },

  boardWrapper: { alignItems: 'center', paddingHorizontal: BOARD_PADDING, marginTop: 8 },
  exitLabelWrap: { position: 'absolute', right: 2, flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 10 },
  exitLabel: { fontSize: 7, fontWeight: '800', color: '#EF4444', letterSpacing: 0.8 },
  exitArrow: { fontSize: 11, color: '#EF4444' },
  board: { position: 'relative', borderWidth: 1.5, borderRadius: 14, overflow: 'hidden' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },

  ghostCell: { position: 'absolute', borderWidth: 2, borderRadius: 7 },

  vehicleBlock: { position: 'absolute', justifyContent: 'center', alignItems: 'center', borderRadius: 9, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, overflow: 'hidden' },
  vehicleShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 9 },
  vehicleShineV: { height: undefined, top: 0, bottom: undefined, right: 0, left: 0, width: '38%' },
  targetIcon: { fontSize: 18 },
  vehicleGrip: { flexDirection: 'row', gap: 5, opacity: 0.55 },
  gripDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)' },

  floatingPreview: { position: 'absolute', borderRadius: 9, opacity: 0.9, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden', zIndex: 999 },

  hint: { marginTop: 10, fontSize: 12, fontStyle: 'italic', opacity: 0.75, letterSpacing: 0.2 },

  toolbox: { marginTop: 'auto', paddingTop: 12, paddingBottom: 34, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  toolboxHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, marginBottom: 10 },
  toolboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  toolCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, flexBasis: '48%' },
  toolPreviewWrap: { justifyContent: 'center', alignItems: 'center', width: 52, height: 38 },
  toolPreview: { borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-start' },
  toolPreviewShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.28)' },
  toolLabels: { alignItems: 'flex-start', gap: 3 },
  toolName: { fontSize: 12, fontWeight: '700' },
  toolBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  toolBadgeText: { fontSize: 10, fontWeight: '700' },
});