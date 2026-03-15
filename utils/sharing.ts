import { Level, Vehicle } from '@/store/gameStore';

// Simple Base64 implementation for cross-platform compatibility
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function customBtoa(input: string): string {
  let str = input;
  let output = '';
  for (let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || (map = '=', i % 1);
    output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3 / 4);
    block = block << 8 | charCode;
  }
  return output;
}

function customAtob(input: string): string {
  let str = input.replace(/=+$/, '');
  let output = '';
  for (let bc = 0, bs = 0, buffer, i = 0;
    buffer = str.charAt(i++);
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
      bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

/**
 * Serializes a Level object into a compact string format.
 */
export function serializeLevel(level: Level): string {
  const parts = [
    level.gridSize,
    level.exitRow,
    level.exitCol,
    level.minMoves
  ];

  const vehicleStrings = level.vehicles.map(v => {
    const orientation = v.orientation === 'horizontal' ? 'h' : 'v';
    const isTarget = v.isTarget ? '1' : '0';
    const color = v.color.replace('#', '');
    return `${v.row},${v.col},${v.length},${orientation},${isTarget},${color},${v.id}`;
  });

  const fullString = `${parts.join('|')}|${vehicleStrings.join(';')}`;
  return customBtoa(fullString);
}

/**
 * Deserializes a string back into a Level object.
 */
export function deserializeLevel(data: string, id: number = 999998): Level | null {
  try {
    const decoded = customAtob(data);
    const sections = decoded.split('|');
    if (sections.length < 5) return null;

    const gridSize = parseInt(sections[0], 10);
    const exitRow = parseInt(sections[1], 10);
    const exitCol = parseInt(sections[2], 10);
    const minMoves = parseInt(sections[3], 10);

    const vehicleStrings = sections[4].split(';');
    const vehicles: Vehicle[] = vehicleStrings.map(vStr => {
      const p = vStr.split(',');
      return {
        row: parseInt(p[0], 10),
        col: parseInt(p[1], 10),
        length: parseInt(p[2], 10),
        orientation: p[3] === 'h' ? 'horizontal' : 'vertical',
        isTarget: p[4] === '1',
        color: `#${p[5]}`,
        id: p[6] || `v${Math.random().toString(36).substr(2, 5)}`
      };
    });

    return {
      id,
      gridSize,
      exitRow,
      exitCol,
      minMoves,
      vehicles
    };
  } catch (err) {
    console.error('Failed to deserialize level:', err);
    return null;
  }
}

/**
 * Generates the sharing URL
 */
export function getShareUrl(level: Level): string {
  const data = serializeLevel(level);
  return `rush-hours://game?data=${encodeURIComponent(data)}`;
}


/**
 * Generates a QR Code URL using the QRServer API
 */
export function getQRCodeUrl(shareUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shareUrl)}`;
}
