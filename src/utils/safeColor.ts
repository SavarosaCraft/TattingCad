// utils/safeColor.ts
//
// Session 60 — security fix. Colour values come from pattern files, which
// people now share (.tatcad). A few places build SVG as TEXT and insert it as
// markup (the realistic view: render/realisticRenderer.ts), so a crafted
// "colour" such as  red"/><image href=x onerror="…">  would have become live
// markup and run code. Two layers:
//   1. safeColor() at every place a colour goes into markup text — the
//      value can only ever be a real colour;
//   2. sanitizeProjectColors() when a pattern is opened (file, sample,
//      autosave, paste) — anything that isn't a colour is replaced, so the
//      rest of the app never sees it either.
// React-rendered attributes are escaped by React already; this is for text.

// #rgb #rgba #rrggbb #rrggbbaa · rgb()/rgba()/hsl()/hsla() with numbers,
// %, commas, spaces, dots, slashes · a plain colour word (red, transparent,
// currentColor). Nothing else — no quotes, < >, = or url(…).
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_RE = /^(?:rgba?|hsla?)\(\s*[-\d.%\s,/]+\)$/i;
const WORD_RE = /^[a-z]{3,30}$/i;

export const isSafeColor = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 64
  && (HEX_RE.test(value.trim()) || FUNC_RE.test(value.trim()) || WORD_RE.test(value.trim()));

/** The colour itself when it is a real colour, else the fallback. */
export const safeColor = (value: unknown, fallback = '#888888'): string =>
  isSafeColor(value) ? value.trim() : fallback;

/**
 * Replace every colour in a pattern's data that isn't a real colour.
 * Mutates and returns the object it was given (callers pass freshly parsed
 * JSON). Returns how many values were replaced, for a console note.
 */
export const sanitizeProjectColors = (data: any): number => {
  if (!data || typeof data !== 'object') return 0;
  let fixed = 0;
  const fix = (obj: any, key: string, fallback: string) => {
    if (!obj || typeof obj !== 'object' || obj[key] == null) return;
    if (!isSafeColor(obj[key])) { obj[key] = fallback; fixed++; }
  };
  const each = (list: any, fn: (item: any) => void) => {
    if (Array.isArray(list)) for (const item of list) if (item && typeof item === 'object') fn(item);
  };
  fix(data, 'bgColor', '#1F2937');
  each(data.elements, el => {
    fix(el, 'color', '#FFFFFF');
    fix(el, 'colorB', '#FFFFFF');
  });
  each(data.materials, m => {
    fix(m, 'color', '#FFFFFF');
    if (Array.isArray(m.stops)) each(m.stops, s => fix(s, 'color', '#FFFFFF'));
  });
  each(data.beadLibrary, b => fix(b, 'color', '#888888'));
  each(data.polarGrids, g => fix(g, 'color', '#4B9FE1'));
  each(data.spatialGroups, g => fix(g, 'color', '#888888')); // session 63 (review #3)
  if (Array.isArray(data.customColors)) {
    const before = data.customColors.length;
    data.customColors = data.customColors.filter((c: any) => isSafeColor(c) || (c && typeof c === 'object' && isSafeColor(c.color)));
    fixed += before - data.customColors.length;
  }
  if (fixed > 0) console.warn(`[TATCAD] ${fixed} invalid colour value(s) in this pattern were replaced.`);
  return fixed;
};
