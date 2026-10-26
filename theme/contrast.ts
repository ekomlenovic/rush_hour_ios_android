/** WCAG 2.x contrast helpers, for opaque '#RRGGBB' colors */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not an opaque #RRGGBB color: ${hex}`);
  const n = parseInt(match[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** An 'rgba(r,g,b,a)' or '#RRGGBBAA' color laid over an opaque '#RRGGBB' background, as the opaque color seen */
export function over(color: string, background: string): string {
  const bg = /^#([0-9a-f]{6})$/i.exec(background);
  if (!bg) throw new Error(`Not an opaque #RRGGBB color: ${background}`);
  let rgb: number[];
  let alpha: number;
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color);
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    alpha = hex[2] ? parseInt(hex[2], 16) / 255 : 1;
  } else if (rgba) {
    rgb = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  } else {
    throw new Error(`Not a #RRGGBB(AA) or rgba() color: ${color}`);
  }
  const n = parseInt(bg[1], 16);
  const under = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return '#' + rgb.map((c, i) => Math.round(c * alpha + under[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}
