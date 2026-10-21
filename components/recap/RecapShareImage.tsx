import React, { useMemo } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { CLASSIC_VEHICLE_COLORS, PALETTE_ART, TARGET_CAR_COLOR, TRAFFIC_LIGHT, applyPalette, getSkinnedBoard, recapImageColors, type VehicleArt } from '@/theme';
import { drawVehicle } from '@/theme/art/vehicles';
import { ArtGroup } from '@/components/art/ArtSvg';
import type { CosmeticSelection } from '@/data/cosmetics';
import type { Vehicle } from '@/store/types';

/** Size of the shared image: vertical, 9:16 like the stories */
export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1920;

/** Same colors in light and dark mode: the image leaves the app */
const IMAGE_COLORS = recapImageColors;

/** The board of the image, tilted a little: the puzzle just solved, the target car getting out */
const GRID = 6;
const BOARD_SIZE = 440;
const BOARD_X = (SHARE_IMAGE_WIDTH - BOARD_SIZE) / 2;
const BOARD_Y = 620;
const BOARD_TILT = -5;
const CELL = BOARD_SIZE / GRID;
/** Row of the target car and of the exit */
const EXIT_ROW = 2;

/** Columns may be fractional: the target car is half through the exit */
const VEHICLES: Vehicle[] = [
  { id: 'target', row: EXIT_ROW, col: 4.6, length: 2, orientation: 'horizontal', isTarget: true, color: TARGET_CAR_COLOR },
  { id: 'a', row: 3, col: 2, length: 3, orientation: 'vertical', isTarget: false, color: CLASSIC_VEHICLE_COLORS[0] },
  { id: 'b', row: 0, col: 0, length: 2, orientation: 'horizontal', isTarget: false, color: CLASSIC_VEHICLE_COLORS[1] },
  { id: 'c', row: 3, col: 5, length: 2, orientation: 'vertical', isTarget: false, color: CLASSIC_VEHICLE_COLORS[2] },
  { id: 'd', row: 1, col: 3, length: 3, orientation: 'horizontal', isTarget: false, color: CLASSIC_VEHICLE_COLORS[3] },
  { id: 'e', row: 2, col: 0, length: 3, orientation: 'vertical', isTarget: false, color: CLASSIC_VEHICLE_COLORS[4] },
  { id: 'f', row: 5, col: 3, length: 2, orientation: 'horizontal', isTarget: false, color: CLASSIC_VEHICLE_COLORS[5] },
  { id: 'g', row: 0, col: 2, length: 2, orientation: 'vertical', isTarget: false, color: CLASSIC_VEHICLE_COLORS[6] },
];

/** Numbers as tiles, two per row, three rows at most */
const TILES_Y = 1125;
const TILE_W = 420;
const TILE_H = 160;
const TILE_GAP = 40;
const TILE_ROW_GAP = 22;
export const MAX_IMAGE_TILES = 6;

/** The road at the bottom, with a few cars on it */
const ROAD_Y = 1690;
const ROAD_H = 150;
/** Drawn vehicles keep their proportions on the road: a cell is this high */
const ROAD_CELL = 60;

interface Props {
  /** Only on the copy that is exported */
  svgRef?: React.Ref<Svg>;
  /** Displayed size; the image itself is exported at SHARE_IMAGE_WIDTH × SHARE_IMAGE_HEIGHT */
  width: number;
  title: string;
  period: string;
  profile: string;
  /** The sentence that explains the profile */
  profileDescription: string;
  highlights: { value: string; label: string }[];
  /** Progress since the period before, stuck on the board: shown only when it went up */
  sticker: { value: string; label: string; period: string } | null;
  footer: string;
  /** Styles equipped in the garage: the board of the image is the player's own */
  cosmetics: CosmeticSelection;
}

/**
 * The recap as a vertical image, drawn on the phone (no online service, like the QR codes): the
 * player's board with the target car getting out, the green light of the game, the strong numbers
 * and a road. No emoji: they only go in the shared text
 */
export default function RecapShareImage({
  svgRef, width, title, period, profile, profileDescription, highlights, sticker, footer, cosmetics,
}: Props) {
  const height = (width * SHARE_IMAGE_HEIGHT) / SHARE_IMAGE_WIDTH;
  const board = getSkinnedBoard(cosmetics.board, cosmetics.skin, 'dark');
  const palette = useMemo(() => applyPalette(VEHICLES, cosmetics.palette), [cosmetics.palette]);
  const vehicleColors = VEHICLES.filter(v => !v.isTarget).map(v => palette.get(v.id) ?? v.color);
  // Drawn skin and palette (Mafia, 1800, every car but the red one): the vehicles of the image are drawn too
  const artOf = (isTarget: boolean): VehicleArt | undefined => (isTarget ? board.targetArt : PALETTE_ART[cosmetics.palette]);
  const profileWidth = Math.min(900, 120 + profile.length * 34);

  return (
    <Svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${SHARE_IMAGE_WIDTH} ${SHARE_IMAGE_HEIGHT}`}>
      <Defs>
        <LinearGradient id="recapBackground" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={IMAGE_COLORS.top} />
          <Stop offset="1" stopColor={IMAGE_COLORS.bottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={SHARE_IMAGE_WIDTH} height={SHARE_IMAGE_HEIGHT} fill="url(#recapBackground)" />

      {/* Faint cells of a board behind everything */}
      {Array.from({ length: SHARE_IMAGE_WIDTH / 120 + 1 }, (_, i) => (
        <Line key={`v${i}`} x1={i * 120} y1={0} x2={i * 120} y2={ROAD_Y} stroke={IMAGE_COLORS.gridLine} strokeWidth={2} />
      ))}
      {Array.from({ length: ROAD_Y / 120 + 1 }, (_, i) => (
        <Line key={`h${i}`} x1={0} y1={i * 120} x2={SHARE_IMAGE_WIDTH} y2={i * 120} stroke={IMAGE_COLORS.gridLine} strokeWidth={2} />
      ))}

      {/* The green light of the game, then the name */}
      <Rect x={440} y={70} width={200} height={70} rx={35} fill={TRAFFIC_LIGHT.housing} />
      <Circle cx={480} cy={105} r={22} fill={TRAFFIC_LIGHT.off} />
      <Circle cx={540} cy={105} r={22} fill={TRAFFIC_LIGHT.off} />
      <Circle cx={600} cy={105} r={22} fill={TRAFFIC_LIGHT.green} />
      <SvgText x={540} y={210} fill={IMAGE_COLORS.accent} fontSize={60} fontWeight="bold" textAnchor="middle" letterSpacing={10}>
        RUSH HOURS
      </SvgText>

      <SvgText x={540} y={295} fill={IMAGE_COLORS.muted} fontSize={46} textAnchor="middle">{title}</SvgText>
      <SvgText x={540} y={390} fill={IMAGE_COLORS.text} fontSize={92} fontWeight="bold" textAnchor="middle">{period}</SvgText>
      <Rect x={540 - profileWidth / 2} y={425} width={profileWidth} height={80} rx={40} fill={IMAGE_COLORS.accent} />
      <SvgText x={540} y={480} fill={IMAGE_COLORS.onAccent} fontSize={46} fontWeight="bold" textAnchor="middle">{profile}</SvgText>
      <SvgText x={540} y={560} fill={IMAGE_COLORS.muted} fontSize={34} textAnchor="middle">{profileDescription}</SvgText>

      {/* The player's board, the target car on its way out */}
      <G transform={`rotate(${BOARD_TILT} ${SHARE_IMAGE_WIDTH / 2} ${BOARD_Y + BOARD_SIZE / 2})`}>
        <Rect x={BOARD_X + 18} y={BOARD_Y + 26} width={BOARD_SIZE} height={BOARD_SIZE} rx={36} fill={IMAGE_COLORS.shadow} />
        <Rect x={BOARD_X - 14} y={BOARD_Y - 14} width={BOARD_SIZE + 28} height={BOARD_SIZE + 28} rx={40} fill={board.frame} />
        <Rect x={BOARD_X} y={BOARD_Y} width={BOARD_SIZE} height={BOARD_SIZE} rx={28} fill={board.background} />
        {Array.from({ length: GRID - 1 }, (_, i) => (
          <React.Fragment key={i}>
            <Line x1={BOARD_X + (i + 1) * CELL} y1={BOARD_Y} x2={BOARD_X + (i + 1) * CELL} y2={BOARD_Y + BOARD_SIZE} stroke={board.grid} strokeWidth={3} />
            <Line x1={BOARD_X} y1={BOARD_Y + (i + 1) * CELL} x2={BOARD_X + BOARD_SIZE} y2={BOARD_Y + (i + 1) * CELL} stroke={board.grid} strokeWidth={3} />
          </React.Fragment>
        ))}
        {/* Exit, and the speed lines behind the car getting out */}
        <Rect x={BOARD_X + BOARD_SIZE - 8} y={BOARD_Y + EXIT_ROW * CELL + CELL * 0.15} width={30} height={CELL * 0.7} rx={8} fill={board.exit} />
        {[0.3, 0.5, 0.7].map((at, i) => (
          <Line
            key={at}
            x1={BOARD_X + CELL * (1.3 + i * 0.4)}
            y1={BOARD_Y + (EXIT_ROW + at) * CELL}
            x2={BOARD_X + CELL * 4.3}
            y2={BOARD_Y + (EXIT_ROW + at) * CELL}
            stroke={IMAGE_COLORS.speed}
            strokeWidth={10}
            strokeLinecap="round"
          />
        ))}
        {/* The target car last: it goes over the frame on its way out */}
        {[...VEHICLES].sort((x, y) => Number(x.isTarget) - Number(y.isTarget)).map(v => {
          const inset = 8;
          const x = BOARD_X + v.col * CELL + inset;
          const y = BOARD_Y + v.row * CELL + inset;
          const w = (v.orientation === 'horizontal' ? v.length : 1) * CELL - inset * 2;
          const h = (v.orientation === 'vertical' ? v.length : 1) * CELL - inset * 2;
          const radius = CELL * board.vehicleRadius;
          const art = artOf(v.isTarget);
          if (art) {
            const color = v.isTarget ? board.targetCar : palette.get(v.id) ?? v.color;
            return <ArtGroup key={v.id} drawing={drawVehicle(art, v.length, color)} x={x} y={y} width={w} height={h} turnUp={v.orientation === 'vertical'} />;
          }
          return (
            <React.Fragment key={v.id}>
              <Rect x={x} y={y} width={w} height={h} rx={radius} fill={v.isTarget ? board.targetCar : palette.get(v.id) ?? v.color} stroke={board.vehicleBorder} strokeWidth={3} />
              <Rect x={x + 6} y={y + 6} width={w - 12} height={h * 0.42} rx={radius * 0.75} fill={board.vehicleShine} />
            </React.Fragment>
          );
        })}
      </G>

      {/* Progress since the period before, like a sticker on the board */}
      {sticker ? (
        <G transform="rotate(8 905 690)">
          <Rect x={790} y={610} width={230} height={160} rx={30} fill={IMAGE_COLORS.accent} />
          <SvgText x={905} y={685} fill={IMAGE_COLORS.onAccent} fontSize={70} fontWeight="bold" textAnchor="middle">{sticker.value}</SvgText>
          <SvgText x={905} y={724} fill={IMAGE_COLORS.onAccent} fontSize={28} fontWeight="bold" textAnchor="middle">{sticker.label}</SvgText>
          <SvgText x={905} y={756} fill={IMAGE_COLORS.onAccent} fontSize={26} textAnchor="middle">{sticker.period}</SvgText>
        </G>
      ) : null}

      {/* The strong numbers, as tiles with the colors of the vehicles */}
      {highlights.slice(0, MAX_IMAGE_TILES).map((item, i, shown) => {
        const alone = shown.length % 2 === 1 && i === shown.length - 1;
        const x = alone ? (SHARE_IMAGE_WIDTH - TILE_W) / 2 : i % 2 === 0 ? 100 : 100 + TILE_W + TILE_GAP;
        // Fewer rows are centered in the room left for the three
        const missingRows = MAX_IMAGE_TILES / 2 - Math.ceil(shown.length / 2);
        const y = TILES_Y + (missingRows / 2 + Math.floor(i / 2)) * (TILE_H + TILE_ROW_GAP);
        return (
          <React.Fragment key={item.label}>
            <Rect x={x} y={y} width={TILE_W} height={TILE_H} rx={32} fill={IMAGE_COLORS.box} />
            <Rect x={x} y={y + 26} width={14} height={TILE_H - 52} rx={7} fill={vehicleColors[i % vehicleColors.length]} />
            <SvgText x={x + 46} y={y + 88} fill={IMAGE_COLORS.text} fontSize={76} fontWeight="bold">{item.value}</SvgText>
            <SvgText x={x + 46} y={y + 132} fill={IMAGE_COLORS.muted} fontSize={34}>{item.label}</SvgText>
          </React.Fragment>
        );
      })}

      {/* The road, a few cars driving on it */}
      <Rect x={0} y={ROAD_Y} width={SHARE_IMAGE_WIDTH} height={ROAD_H} fill={IMAGE_COLORS.road} />
      <Line x1={0} y1={ROAD_Y + 8} x2={SHARE_IMAGE_WIDTH} y2={ROAD_Y + 8} stroke={IMAGE_COLORS.roadEdge} strokeWidth={6} />
      <Line x1={0} y1={ROAD_Y + ROAD_H - 8} x2={SHARE_IMAGE_WIDTH} y2={ROAD_Y + ROAD_H - 8} stroke={IMAGE_COLORS.roadEdge} strokeWidth={6} />
      <Line x1={0} y1={ROAD_Y + ROAD_H / 2} x2={SHARE_IMAGE_WIDTH} y2={ROAD_Y + ROAD_H / 2} stroke={IMAGE_COLORS.roadLine} strokeWidth={8} strokeDasharray="50 40" />
      {[
        { x: 110, lane: 0, length: 170, cells: 2, color: vehicleColors[0], art: artOf(false) },
        { x: 470, lane: 1, length: 250, cells: 3, color: vehicleColors[3], art: artOf(false) },
        { x: 800, lane: 0, length: 170, cells: 2, color: board.targetCar, art: artOf(true) },
      ].map(car => car.art ? (
        <ArtGroup
          key={car.x}
          drawing={drawVehicle(car.art, car.cells, car.color)}
          x={car.x}
          y={ROAD_Y + 43 + car.lane * 66 - ROAD_CELL / 2}
          width={car.cells * ROAD_CELL}
          height={ROAD_CELL}
        />
      ) : (
        <React.Fragment key={car.x}>
          <Rect x={car.x} y={ROAD_Y + 22 + car.lane * 66} width={car.length} height={42} rx={14} fill={car.color} stroke={board.vehicleBorder} strokeWidth={3} />
          <Rect x={car.x + 6} y={ROAD_Y + 26 + car.lane * 66} width={car.length - 12} height={16} rx={8} fill={board.vehicleShine} />
        </React.Fragment>
      ))}

      <SvgText x={540} y={1895} fill={IMAGE_COLORS.muted} fontSize={32} textAnchor="middle">{footer}</SvgText>
    </Svg>
  );
}
