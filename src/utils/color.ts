// utils/color.ts
//
// Pure color-conversion utilities and the base color palette, promoted out
// of tattingindex.tsx (see architecture.md). No React dependencies.

export const COLORS = [
  // Row 1 — dark shades
  '#000000', // Black
  '#999999', // Gray
  '#8B0000', // Dark Red
  '#228B22', // Dark Green
  '#ADD8E6', // Lt Blue
  '#FFAA33', // Orange
  '#702963', // Dark Violet
  // Row 2 — saturated / light
  '#FFFFFF', // White
  '#FFFCF4', // Cream
  '#D1001C', // Red
  '#93C572', // Pistachio
  '#0F52BA', // Royal Blue
  '#FFD700', // Topaz
  '#CF9FFF', // Violet
];

export const BG_COLORS = ['#111827', '#4B5563', '#FFFFFF'];

// Hex (#rrggbb, with or without '#') -> { h, s, v }, each in [0, 1].
export const hexToHsv = (hex: string): { h: number; s: number; v: number } => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substr(0, 2), 16) / 255;
  const g = parseInt(clean.substr(2, 2), 16) / 255;
  const b = parseInt(clean.substr(4, 2), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / delta + 2) / 6;
    else h = ((r - g) / delta + 4) / 6;
  }
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
};

// { h, s, v } (each in [0, 1]) -> hex color string ('#rrggbb').
export const hsvToHex = (h: number, s: number, v: number): string => {
  const c = v * s;
  const hPrime = h * 6;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = v - c;
  let r: number, g: number, b: number;
  if (hPrime < 1) { r = c; g = x; b = 0; }
  else if (hPrime < 2) { r = x; g = c; b = 0; }
  else if (hPrime < 3) { r = 0; g = c; b = x; }
  else if (hPrime < 4) { r = 0; g = x; b = c; }
  else if (hPrime < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (val: number) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Normalizes a gradient color's `stops` field (string "0:#fff,100:#000" or
 * an array of { offset, color }) into an array of { offset, color }. */
export const parseGradientStops = (
  stops: string | Array<{ offset: string; color: string }>
): Array<{ offset: string; color: string }> => {
  if (typeof stops === 'string') {
    return stops.split(',').map(stop => {
      const [offset, colorHex] = stop.split(':');
      return { offset: `${offset}%`, color: colorHex };
    });
  }
  return stops;
};
