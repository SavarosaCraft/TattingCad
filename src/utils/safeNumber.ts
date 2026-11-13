// utils/safeNumber.ts
//
// Session 63 — security fix (code review #1), the number twin of
// utils/safeColor.ts. Pattern files are shared, so nothing in them can be
// trusted to be what its name says. A "number" that is really text is
// dangerous in one place — the realistic view is built as SVG TEXT, and
// `cx + radius` with a text cx JOINS the text in (a circle ring's centre
// used to become live markup) — and merely harmful everywhere else (NaN
// geometry, crashes while drawing). Two layers, like the colours:
//   1. markupNum() at every place a coordinate goes into markup text without
//      its own number formatting (render/realisticRenderer.ts);
//   2. sanitizeProjectNumbers() when a pattern comes in (file, sample,
//      handed-over file, Resume, system-clipboard paste) — an element whose
//      geometry isn't made of real numbers is left out, lesser numbers go
//      back to their default, so the rest of the app never sees them.

/** A real, finite number (not text, not NaN / Infinity). */
export const isRealNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** The number itself when it is one, else the fallback. Real numbers come
 *  back untouched, so text built from them is exactly what it was. */
export const safeNum = (value: unknown, fallback = 0): number =>
  isRealNumber(value) ? value : fallback;

/** For markup text: any value of the number TYPE passes exactly as it is
 *  (NaN / Infinity print as harmless words, as they always did — so sound
 *  patterns give byte-identical output); anything else becomes 0. */
export const markupNum = (value: unknown): number =>
  typeof value === 'number' ? value : 0;

const present = (v: unknown) => v !== undefined && v !== null;

// Path coordinates. Every path needs its start and end; a cubic also its
// two control points, anything else (the quadratic — what every drawing
// routine treats a non-cubic path as) its one. Control points of the other
// kind only have to be real numbers when the file carries them.
const PATH_ENDS = ['x', 'y', 'endX', 'endY'];
const CUBIC_CONTROLS = ['control1X', 'control1Y', 'control2X', 'control2Y'];
const QUAD_CONTROLS = ['controlX', 'controlY'];

// Numbers an element can live without: a wrong one goes back to its default.
const ELEMENT_DEFAULTS: Record<string, (el: any) => number> = {
  rotation: () => 0,
  lineWidth: () => 2,
  labelOffset: () => 8,
  picotSideMultiplier: () => 1,
  endAllowance: () => 0,
  squeeze: el => (el.isSplitRing ? 0.25 : 0),
  squeezeCA: () => 0.75,
  squeezeCB: () => 0.75,
};

// Element kinds the app draws (same list as applyProjectData's VALID_TYPES).
const VALID_ELEMENT_TYPES = new Set(['ring', 'chain', 'line', 'ghost']);

/** Why an element can't be used, or null when it is sound. requireStructure
 *  (session 63, review #6): also an id, a known type and a paths list —
 *  for paste and Resume; file open refuses such a FILE instead (its own
 *  check in applyProjectData, unchanged). */
const elementDamage = (el: any, requireStructure = false): string | null => {
  if (!el || typeof el !== 'object' || Array.isArray(el)) return 'not an object';
  if (requireStructure) {
    if (typeof el.id !== 'string' || !el.id) return 'id';
    if (!VALID_ELEMENT_TYPES.has(el.type)) return 'type';
    if (!Array.isArray(el.paths)) return 'paths';
  }
  // Session 63 (review #6): notation is read as text everywhere (trim,
  // split…) — a number there crashed the app to a blank window on open.
  if (present(el.notation) && typeof el.notation !== 'string') return 'notation';
  if (present(el.notationB) && typeof el.notationB !== 'string') return 'notationB';
  if (!el.center || typeof el.center !== 'object'
    || !isRealNumber(el.center.x) || !isRealNumber(el.center.y)) return 'center';
  if (present(el.paths)) {
    if (!Array.isArray(el.paths)) return 'paths';
    for (const path of el.paths) {
      if (!path || typeof path !== 'object') return 'paths';
      const cubic = path.type === 'cubic';
      for (const k of PATH_ENDS) if (!isRealNumber(path[k])) return `path.${k}`;
      for (const k of (cubic ? CUBIC_CONTROLS : QUAD_CONTROLS)) if (!isRealNumber(path[k])) return `path.${k}`;
      for (const k of (cubic ? QUAD_CONTROLS : CUBIC_CONTROLS)) if (present(path[k]) && !isRealNumber(path[k])) return `path.${k}`;
    }
  }
  if (present(el.stitchCount) && !isRealNumber(el.stitchCount)) return 'stitchCount';
  if (present(el.splitPosition) && !isRealNumber(el.splitPosition)) return 'splitPosition';
  if (present(el.picots)) {
    if (!Array.isArray(el.picots)) return 'picots';
    for (const pic of el.picots) {
      if (!pic || typeof pic !== 'object') return 'picots';
      if (present(pic.stitchesBefore) && !isRealNumber(pic.stitchesBefore)) return 'picot.stitchesBefore';
    }
  }
  return null;
};

/**
 * Check every number in a pattern's elements. Mutates the object it was
 * given (callers pass freshly parsed JSON) — works on a pattern file
 * (`elements` + `picotConnections`) and on clipboard data (`elements` +
 * `connections`).
 *   - an element whose geometry isn't real numbers is LEFT OUT, with its
 *     joins; picots on the far side of those joins stop being "joined"
 *     unless another join still holds them;
 *   - lesser numbers (rotation, line width, squeeze, tension, label
 *     offset…) and `dsWidth` go back to their default.
 * Returns how many elements were left out and how many values were reset.
 * Sound patterns are not changed at all.
 */
export const sanitizeProjectNumbers = (data: any, opts?: { requireStructure?: boolean }): { dropped: number; reset: number } => {
  const result = { dropped: 0, reset: 0 };
  if (!data || typeof data !== 'object') return result;

  if (present(data.dsWidth) && !(isRealNumber(data.dsWidth) && data.dsWidth > 0)) {
    delete data.dsWidth; // loaders fall back to the default width
    result.reset++;
  }

  if (!Array.isArray(data.elements)) return result;

  const droppedIds = new Set<unknown>();
  const kept: any[] = [];
  for (const el of data.elements) {
    const damage = elementDamage(el, !!opts?.requireStructure);
    if (damage) {
      result.dropped++;
      if (el && typeof el === 'object' && present(el.id)) droppedIds.add(el.id);
      continue;
    }
    for (const key of Object.keys(ELEMENT_DEFAULTS)) {
      if (present(el[key]) && !isRealNumber(el[key])) {
        el[key] = ELEMENT_DEFAULTS[key](el);
        result.reset++;
      }
    }
    kept.push(el);
  }

  if (result.dropped > 0) {
    data.elements = kept;
    // Joins that reached a left-out element go with it.
    const connKey = Array.isArray(data.picotConnections) ? 'picotConnections'
      : Array.isArray(data.connections) ? 'connections' : null;
    if (connKey) {
      const all: any[] = data[connKey];
      const touchesDropped = (conn: any) => !conn || !Array.isArray(conn.picots)
        || conn.picots.some((cp: any) => !cp || droppedIds.has(cp.elementId));
      const remaining = all.filter(conn => !touchesDropped(conn));
      if (remaining.length !== all.length) {
        const key = (cp: any) => `${cp.elementId}::${cp.picotId}`;
        const stillJoined = new Set<string>();
        for (const conn of remaining) for (const cp of conn.picots) stillJoined.add(key(cp));
        const freed = new Set<string>();
        for (const conn of all) {
          if (!touchesDropped(conn) || !conn || !Array.isArray(conn.picots)) continue;
          for (const cp of conn.picots) if (cp && !stillJoined.has(key(cp))) freed.add(key(cp));
        }
        for (const el of kept) {
          if (!Array.isArray(el.picots)) continue;
          for (const pic of el.picots) {
            if (pic.isJoint && freed.has(`${el.id}::${pic.id}`)) pic.isJoint = false;
          }
        }
        data[connKey] = remaining;
      }
    }
  }

  if (result.dropped > 0 || result.reset > 0) {
    console.warn(`[TATCAD] pattern numbers checked: ${result.dropped} damaged element(s) left out, ${result.reset} value(s) reset.`);
  }
  return result;
};
