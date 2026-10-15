import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, useColorScheme, Pressable,
  useWindowDimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useGameStore, Vehicle, Level } from '@/store/gameStore';
import { validateLevel } from '@/utils/solver';
import { haptics, Haptics } from '@/utils/haptics';
import {
  ExitSide, hasCollision as collides, vehicleCells, getExitSide, moveExitToSide, getNextAvailableColor,
} from '@/utils/creatorGeometry';
import {
  ActiveDrag, BOARD_PADDING, CAR_PALETTE, GRID_SIZES, TOOLBOX_ITEMS, VehicleTemplate, getCreatorColors,
} from '@/components/creator/constants';
import BoardVehicle from '@/components/creator/BoardVehicle';
import ToolboxItem from '@/components/creator/ToolboxItem';
import ExitMarker from '@/components/creator/ExitMarker';
import PillSelector from '@/components/creator/PillSelector';
import { vehicleStyles } from '@/components/creator/vehicleStyles';

const EXIT_SIDES = ['Right', 'Left', 'Top', 'Bottom'] as const;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LevelCreatorScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{ levelId: string }>();
  const saveCreatedLevel = useGameStore(s => s.saveCreatedLevel);
  const createdLevels = useGameStore(s => s.createdLevels);
  const importedLevels = useGameStore(s => s.importedLevels);

  const [gridSize, setGridSize] = useState(6);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [exitRow, setExitRow] = useState(2);
  const [exitCol, setExitCol] = useState(6);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [floatingTemplate, setFloatingTemplate] = useState<VehicleTemplate | null>(null);
  const lastTarget = useRef<{ id: string; row: number; col: number; isValid: boolean } | null>(null);

  // Shared values Reanimated pour le curseur flottant 100% sur le thread UI (120 FPS)
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragVisible = useSharedValue(0);

  const boardRef = useRef<View>(null);
  const boardPos = useRef({ x: 0, y: 0 });
  const vehiclesRef = useRef<Vehicle[]>([]);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const boardSize = Math.min(screenWidth - BOARD_PADDING * 2, screenHeight * 0.48);
  const cellSize = boardSize / gridSize;

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
        setGridSize(level.gridSize || 6);
        setVehicles(level.vehicles.map(v => ({ ...v })));
        setExitRow(level.exitRow ?? 2);
        setExitCol(level.exitCol ?? (level.gridSize || 6));
        return;
      }
    }
    const INITIAL_GRID = 6;
    setGridSize(INITIAL_GRID);
    setExitRow(2);
    setExitCol(6);
    setVehicles([{
      id: 'target', row: 2, col: 0, length: 2,
      orientation: 'horizontal', isTarget: true, color: '#EF4444',
    }]);
  }, []);

  // ── Helpers ──

  /** Collision with the latest vehicles (read through a ref: gesture callbacks may be stale) */
  const hasCollision = useCallback((
    row: number, col: number,
    orientation: 'horizontal' | 'vertical', length: number,
    excludeId?: string,
  ) => collides(vehiclesRef.current, row, col, orientation, length, excludeId), []);

  const handleExitSideChange = (side: ExitSide) => {
    const target = vehicles.find(v => v.id === 'target');
    if (!target) return;

    const next = moveExitToSide(target, side, gridSize);
    if (hasCollision(next.target.row, next.target.col, next.target.orientation, target.length, 'target')) {
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(t('creator.collision_title'), t('creator.collision_desc'));
      return;
    }

    setExitRow(next.exitRow);
    setExitCol(next.exitCol);

    // Update target car to match orientation
    setVehicles(prev => prev.map(v => (v.id === 'target' ? { ...v, ...next.target } : v)));
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // When grid size changes, ensure target car is correctly positioned
  const handleGridSizeChange = (newSize: number) => {
    setGridSize(newSize);
    const newTargetRow = Math.floor(newSize / 2) - (newSize % 2 === 0 ? 1 : 0);
    setExitRow(newTargetRow);
    setExitCol(newSize);
    setVehicles(prev => {
      const target = prev.find(v => v.id === 'target');
      if (target) {
        return [{ ...target, row: newTargetRow, col: Math.min(target.col, newSize - target.length), orientation: 'horizontal' }];
      }
      return [];
    });
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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
    const maxCol = gridSize - (orientation === 'horizontal' ? length : 1);
    const maxRow = gridSize - (orientation === 'vertical' ? length : 1);

    return {
      col: Math.max(0, Math.min(maxCol, Math.round(topX / cellSize))),
      row: Math.max(0, Math.min(maxRow, Math.round(topY / cellSize))),
    };
  }, [cellSize, gridSize]);

  const updateDrag = useCallback((
    id: string,
    orientation: 'horizontal' | 'vertical', length: number, color: string,
    centerX: number, centerY: number,
    excludeId?: string,
  ) => {
    const { row, col } = screenToGrid(centerX, centerY, orientation, length);
    const isValid = !hasCollision(row, col, orientation, length, excludeId);

    // ANTI-LAG : Ne déclenche un re-render React QUE si la cellule cible change !
    if (
      lastTarget.current &&
      lastTarget.current.id === id &&
      lastTarget.current.row === row &&
      lastTarget.current.col === col &&
      lastTarget.current.isValid === isValid
    ) {
      return;
    }

    lastTarget.current = { id, row, col, isValid };
    setActiveDrag({ id, orientation, length, color, targetRow: row, targetCol: col, isValid });
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
      if (next.find(v => v.id === vehicleId)?.isTarget) {
        // If target moves, sync exit position ONLY IF on correct axis
        const isH = next.find(v => v.id === vehicleId)?.orientation === 'horizontal';
        if (isH && (exitCol >= gridSize || exitCol === 255)) setExitRow(row);
        if (!isH && (exitRow >= gridSize || exitRow === 255)) setExitCol(col);
      }
      return next;
    });
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [exitCol, exitRow, gridSize]);

  const pivotVehicle = useCallback((id: string) => {
    if (id === 'target') {
      // Toggle orientation by switching exit side
      const currentIsHorizontal = vehicles.find(v => v.id === 'target')?.orientation === 'horizontal';
      if (currentIsHorizontal) {
        handleExitSideChange('Bottom');
      } else {
        handleExitSideChange('Right');
      }
      return;
    }
    setVehicles(prev => {
      const v = prev.find(v => v.id === id);
      if (!v) return prev;
      const newOrient = v.orientation === 'horizontal' ? 'vertical' : 'horizontal';

      // Check if pivot is possible (no OOB and no collision)
      const maxCol = gridSize - (newOrient === 'horizontal' ? v.length : 1);
      const maxRow = gridSize - (newOrient === 'vertical' ? v.length : 1);

      // Keep within bounds
      const nr = Math.min(v.row, maxRow);
      const nc = Math.min(v.col, maxCol);

      if (!hasCollision(nr, nc, newOrient, v.length, id)) {
        haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return prev.map(item => item.id === id ? { ...item, orientation: newOrient, row: nr, col: nc } : item);
      } else {
        haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(t('creator.collision_title'), t('creator.collision_desc'));
        return prev;
      }
    });
  }, [gridSize, hasCollision]);

  const placeFromToolbox = useCallback((template: VehicleTemplate, screenX: number, screenY: number) => {
    const lx = screenX - boardPos.current.x;
    const ly = screenY - boardPos.current.y;

    // Annuler si lâché beaucoup trop loin du plateau
    if (lx < -cellSize || lx > boardSize + cellSize || ly < -cellSize || ly > boardSize + cellSize) return;

    const { row, col } = screenToGrid(screenX, screenY, template.orientation, template.length);

    if (hasCollision(row, col, template.orientation, template.length)) {
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setVehicles(prev => [...prev, {
      id: `v${Date.now()}`, row, col,
      length: template.length, orientation: template.orientation,
      isTarget: false, color: template.color,
    }]);
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [screenToGrid, hasCollision, boardSize, cellSize]);

  const removeVehicle = useCallback((id: string) => {
    if (id === 'target') return;
    setVehicles(prev => prev.filter(v => v.id !== id));
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // ── Actions ──
  const handleTest = () => {
    const minMoves = validateLevel(vehicles, gridSize, exitRow, exitCol);
    if (minMoves === -1) {
      Alert.alert(t('creator.unsolvable_title'), t('creator.unsolvable_desc'));
    } else {
      Alert.alert(t('creator.solvable_title'), t('creator.solvable_desc', { count: minMoves }));
    }
  };

  const handleSave = () => {
    const minMoves = validateLevel(vehicles, gridSize, exitRow, exitCol);
    if (minMoves === -1) {
      Alert.alert(t('creator.unsolvable_title'), t('creator.fix_before_save'));
      return;
    }
    const isImported = params.levelId && importedLevels.some(l => l.id === parseInt(params.levelId));
    const newId = isImported ? Date.now() : (params.levelId ? parseInt(params.levelId) : Date.now());
    const newLevel: Level = { id: newId, gridSize, vehicles, exitRow, exitCol, minMoves, updatedAt: Date.now() };
    saveCreatedLevel(newLevel);
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('common.saved'), isImported ? t('creator.saved_new') : t('creator.level_updated'), [
      { text: t('common.ok'), onPress: () => router.back() },
    ]);
  };

  // ── Couleurs Dynamiques ──
  const usedColors = vehicles.map(v => v.color);

  // ── Theme & Rendering Data ──
  const C = getCreatorColors(isDark);

  const ghostCells = useMemo(() => {
    if (!activeDrag) return [];
    return vehicleCells(activeDrag.targetRow, activeDrag.targetCol, activeDrag.orientation, activeDrag.length);
  }, [activeDrag?.targetRow, activeDrag?.targetCol, activeDrag?.length, activeDrag?.orientation]);

  const floatW = floatingTemplate ? (floatingTemplate.orientation === 'horizontal' ? floatingTemplate.length : 1) * cellSize - 4 : 0;
  const floatH = floatingTemplate ? (floatingTemplate.orientation === 'vertical' ? floatingTemplate.length : 1) * cellSize - 4 : 0;

  const floatAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - floatW / 2 },
      { translateY: dragY.value - floatH / 2 },
    ],
    opacity: dragVisible.value,
  }));

  const target = vehicles.find(v => v.id === 'target');
  const exitSide = getExitSide(exitRow, exitCol, gridSize);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: C.bg }]}>

        {/* ── Header ── */}
        <View style={[styles.header, { backgroundColor: C.bg }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backArrow, { color: C.sub }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>{t('creator.title')}</Text>
          <View style={styles.headerRight}>
            <Pressable onPress={handleTest} style={[styles.pill, { borderColor: C.accent, borderWidth: 1.5 }]}>
              <Text style={[styles.pillText, { color: C.accent }]}>{t('creator.test')}</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.pill, { backgroundColor: C.accent }]}>
              <Text style={[styles.pillText, { color: '#FFF' }]}>{t('creator.save')}</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Grid Size Selector (Sub-header) ── */}
        <PillSelector
          title={t('map.grid_size_label')}
          options={GRID_SIZES}
          isActive={s => gridSize === s}
          getLabel={s => `${s}x${s}`}
          onSelect={handleGridSizeChange}
          colors={C}
        />

        {/* ── Board ── */}
        <View style={styles.boardWrapper}>
          <View style={{ width: boardSize, height: boardSize }}>
            <ExitMarker exitRow={exitRow} exitCol={exitCol} gridSize={gridSize} cellSize={cellSize} />

          <View
            ref={boardRef}
            onLayout={() => requestAnimationFrame(measureBoard)}
            style={[styles.board, { width: boardSize, height: boardSize, borderColor: C.border, backgroundColor: C.boardBg }]}
          >
            {Array.from({ length: gridSize + 1 }).map((_, i) => (
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
                  lastTarget.current = null;
                  setActiveDrag(null);
                }}
                onRemove={() => removeVehicle(v.id)}
                onPress={() => pivotVehicle(v.id)}
              />
            ))}
          </View>
          </View>
          <Text style={[styles.hint, { color: C.sub }]}>{t('creator.hint_text')}</Text>
        </View>

        {/* ── Exit Side Selector ── */}
        <PillSelector
          title={t('creator.exit_label')}
          options={EXIT_SIDES}
          isActive={side => {
            const isH = side === 'Right' || side === 'Left';
            const orientMatch = target ? (isH === (target.orientation === 'horizontal')) : true;
            return orientMatch && exitSide === side;
          }}
          getLabel={side => t(`creator.${side.toLowerCase()}`)}
          onSelect={handleExitSideChange}
          colors={C}
        />

        {/* ── Floating preview (Le véhicule centré sur le doigt !) ── */}
        {floatingTemplate && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.floatingPreview,
              {
                width: floatW,
                height: floatH,
                backgroundColor: floatingTemplate.color,
              },
              floatAnimStyle,
            ]}
          >
            <View style={[vehicleStyles.vehicleShine, floatingTemplate.orientation === 'vertical' && vehicleStyles.vehicleShineV]} />
          </Animated.View>
        )}

        {/* ── Toolbox ── */}
        <View style={[styles.toolbox, { borderTopColor: C.border, backgroundColor: C.bg, paddingBottom: Math.max(34, insets.bottom + 12) }]}>
          <Text style={[styles.toolboxHeading, { color: C.sub }]}>{t('creator.vehicles_toolbox', { defaultValue: 'VEHICLES' })}</Text>
          <View style={styles.toolboxGrid}>
            {TOOLBOX_ITEMS.map((item, idx) => {
              const dynamicColor = getNextAvailableColor(usedColors, item.color, CAR_PALETTE);
              const templateWithColor = { ...item, color: dynamicColor };

              return (
                <ToolboxItem
                  key={idx}
                  template={templateWithColor}
                  colors={C}
                  dragX={dragX}
                  dragY={dragY}
                  dragVisible={dragVisible}
                  onDragStart={(tmpl, sx, sy) => {
                    setFloatingTemplate(tmpl);
                    updateDrag(`toolbox-${idx}`, tmpl.orientation, tmpl.length, tmpl.color, sx, sy);
                  }}
                  onDragMove={(sx, sy) => {
                    updateDrag(`toolbox-${idx}`, templateWithColor.orientation, templateWithColor.length, templateWithColor.color, sx, sy);
                  }}
                  onDrop={(sx, sy) => {
                    lastTarget.current = null;
                    setActiveDrag(null);
                    setFloatingTemplate(null);
                    placeFromToolbox(templateWithColor, sx, sy);
                  }}
                />
              );
            })}
          </View>
        </View>

      </View>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  backArrow: { fontSize: 26, fontWeight: '600' },
  title: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
  headerRight: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: '700' },

  boardWrapper: { alignItems: 'center', paddingHorizontal: BOARD_PADDING, marginTop: 8 },
  board: { position: 'relative', borderWidth: 1.5, borderRadius: 14, overflow: 'hidden' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },

  ghostCell: { position: 'absolute', borderWidth: 2, borderRadius: 7 },

  floatingPreview: { position: 'absolute', top: 0, left: 0, borderRadius: 9, opacity: 0.9, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden', zIndex: 999 },

  hint: { marginTop: 10, fontSize: 12, fontStyle: 'italic', opacity: 0.75, letterSpacing: 0.2 },

  toolbox: { marginTop: 'auto', paddingTop: 12, paddingBottom: 34, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  toolboxHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, marginBottom: 10 },
  toolboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
