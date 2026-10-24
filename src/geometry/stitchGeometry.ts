// src/geometry/stitchGeometry.ts
//
// Pure stitch angle/orientation helpers. No React, no closures over
// component state — take only plain arguments. Promoted out of
// tattingindex.tsx (realistic-renderer extraction, Phase 2).

// A flip (horizontal XOR vertical, not both) reverses the effective
// direction of "which way around" a shape. Two flips (both H and V) net
// out to a plain 180° rotation, so no sign correction is needed there —
// only an odd number of flips needs the -1.
// Single source of truth — getPicotPosition, renderPicots, and the baked
// renderer all call this instead of re-deriving the formula, so a fix
// here can't drift out of sync between snap/hit-testing and rendering.
export const getFlipSign = (element: any): number => (
  (element.isFlippedH || false) !== (element.isFlippedV || false) ? -1 : 1
);

// Angle (radians) of a stitch position around a circle-shaped closed ring
// (plain circles and Josephine Knots). stitchesBefore is the raw stitch
// position (already includes the +0.5 bead offset where applicable).
export const getCircleStitchAngle = (element: any, stitchesBefore: number): number => {
  // flipSign applies to the -π/2 reference-phase term only. stitchesBefore
  // already encodes the post-flip stitch order (it's recomputed as
  // stitchCount - old value by the notation-reversal pipeline), so
  // flipping the progress term too would double-count the reversal —
  // that was the bug: it left position-0 markers (Josephine Knot guide
  // points) completely unmoved by a flip, since 0 * anything = 0.
  const flipSign = getFlipSign(element);
  const rotation = (element.rotation || 0) * Math.PI / 180;
  return (stitchesBefore / element.stitchCount) * Math.PI * 2 - (Math.PI / 2) * flipSign + rotation;
};

// ── Stitch position → place on the path ─────────────────────────────────────
//
// Session 57 (end-allowance work, step 1). Every "where along this element's
// path is stitch position s?" calculation goes through the helpers below, so
// the end allowance (a stretch of bare, unstitched thread at each path end —
// see handoff-session56.md "element end allowance") only has to be applied
// in one place.
//
// Model: a stitched run of `count` stitches with `a` ds of allowance at each
// end occupies a path of (count + 2a) ds. Stitch position s (0..count, same
// units as picot.stitchesBefore / run.midDS) sits a + s ds along it, so its
// fraction of the path is (s + a) / (count + 2a). With a = 0 this is exactly
// the old s / count — bit-for-bit (x + 0 === x).
//
// These return a FRACTION of path length (0..1), not a point: each call site
// keeps its own way of turning a fraction into a point (some walk arc length,
// some map it straight onto bezier t) so nothing moves in step 1.
//
// NOT for colour: gradient sampling is by stitch progress (s / count) and
// must stay that way — the allowance is bare thread, not part of the colour
// run. Circles (incl. Josephine knots) have no allowance and keep their own
// angle formula (getCircleStitchAngle above).

// End allowance, in ds, at each path end of this element.
//
// Stored per element as `el.endAllowance` (session 57, step 2) — NOT a global
// setting, because paths are saved as geometry: a global value would make
// every saved path the wrong length the moment it changed. Absent = 0, so
// every element saved before this field existed keeps its exact geometry.
// Copy/paste/duplicate/undo carry it (they deep-clone elements); polar ghost
// instances copy it explicitly (createPolarInstance).
//
// Live since step 3. Which shapes get it (design, handoff-session56.md):
//   chains and split chains ............ yes
//   teardrop rings (incl. fr:/mock) ...... yes
//   split rings ......................... yes (each side has two ends)
//   circle-shaped rings, Josephine knots, lines ... never (always 0)
// A circle keeps any stored value; it applies again if toggled back to a
// teardrop (the "size jumps 2 ds" case — intended).
//
// INVARIANT: an element's paths must have been built (count + 2a) ds long
// for the `a` this returns. Every place that builds or resizes a path from
// the stitch count uses elementPathLength / createSplitRingPath's allowance
// argument for exactly this reason.
export const allowsEndAllowance = (element: any): boolean => {
  const type = effectiveElementType(element);
  if (type === 'chain') return true;
  if (type !== 'ring') return false;
  if (element.isSplitRing) return true;
  if (element.shapeStyle === 'circle') return false;
  if (/^jk:/i.test(element.notation || '')) return false;
  return true;
};

export const getEndAllowance = (element: any): number => {
  if (!element || !allowsEndAllowance(element)) return 0;
  const v = Number(element.endAllowance ?? 0);
  return isFinite(v) && v > 0 ? v : 0;
};

// Path length (canvas units) the element's paths should have: its stitches
// plus the allowance at each end. For a split ring this is both sides
// together (each side is built separately by createSplitRingPath).
export const elementPathLength = (element: any, dsWidth: number): number => {
  const a = getEndAllowance(element);
  const n = element.stitchCount || 0;
  return (n + (element.isSplitRing ? 4 : 2) * a) * dsWidth;
};

// ── Tension (what the user sees) ↔ end allowance (what geometry uses) ──
// The UI never shows "end allowance" or ds: it shows TENSION, 1–5, because
// how much bare thread is left at the ends depends on how tight the person
// tats (user decision, session 57). Decimals allowed. Linear:
//   tension 1 (tightest) = 0 ds  ...  tension 5 (loosest) = MAX_END_ALLOWANCE ds
// Internally everything — elements, presets, files — stays in ds
// (`endAllowance`), so changing this mapping never alters saved geometry.
export const MIN_TENSION = 1;
export const MAX_TENSION = 5;
// Session 57, retuned after realistic-view testing: doubled from 1.5, so the
// amount that used to be tension 5 is now tension 3 (the default) — 0.75 ds
// per tension step. Only the mapping changed; stored values are ds.
export const MAX_END_ALLOWANCE = 3; // ds at tension 5
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const tensionToAllowance = (tension: number): number =>
  (clamp(Number(tension) || MIN_TENSION, MIN_TENSION, MAX_TENSION) - MIN_TENSION)
    / (MAX_TENSION - MIN_TENSION) * MAX_END_ALLOWANCE;
// Rounded to 2 decimals for display (avoids 3.3000000000000003).
export const allowanceToTension = (allowance: number): number =>
  Math.round((MIN_TENSION + clamp(Number(allowance) || 0, 0, MAX_END_ALLOWANCE)
    / MAX_END_ALLOWANCE * (MAX_TENSION - MIN_TENSION)) * 100) / 100;

// Default for NEW elements, from the active thread preset (Thread
// Properties). Presets saved before this setting existed have no field and
// get the default. Default tension 3 = 1.5 ds (user decision, session 57;
// was 0.75 ds before the scale was doubled).
// The built-in DEFAULT_THREAD_PRESET copies (tattingindex.tsx,
// useBeadState.ts, patternOutput.ts) all read DEFAULT_END_ALLOWANCE, so this
// is the one place to change it.
export const DEFAULT_TENSION = 3;
export const DEFAULT_END_ALLOWANCE = tensionToAllowance(DEFAULT_TENSION);
// Split rings have FOUR ends (two per side) meeting at their two points, so
// the full allowance leaves a much bigger gap there than on a teardrop. User
// decision (session 57, after comparing 0 / 0.25 / 0.5 / 0.75 / 1 ds side by
// side): a new split ring gets this fraction of the preset value — 0.25 ds
// per side end at the default of 1. Applied when the element is created and
// stored on it like any other value, so changing this later never alters
// existing split rings.
export const SPLIT_RING_END_ALLOWANCE_FACTOR = 0.25;
// Chains get NO allowance (user decision, session 57, after mock-ups of
// chain–ring–chain joins): the stitches of a chain run right up to the ring
// it meets — the bare thread at that join is the ring closing, i.e. the
// ring's own tension. Chains stay ELIGIBLE (allowsEndAllowance) so chains
// made earlier with an allowance keep consistent geometry, and the
// "Tension" button can take it off (factor 0 → target 0).
export const CHAIN_END_ALLOWANCE_FACTOR = 0;
// Fraction of the preset value a NEW element of this shape gets (and what
// the "Tension" button applies): rings 1, split rings ¼, chains 0.
export const endAllowanceFactor = (element: any): number => {
  if (element?.isSplitRing) return SPLIT_RING_END_ALLOWANCE_FACTOR;
  if (effectiveElementType(element) === 'chain') return CHAIN_END_ALLOWANCE_FACTOR;
  return 1;
};
export const presetEndAllowance = (preset: any): number => {
  const v = Number(preset?.endAllowance ?? DEFAULT_END_ALLOWANCE);
  if (!isFinite(v)) return DEFAULT_END_ALLOWANCE;
  return clamp(v, 0, MAX_END_ALLOWANCE);
};
// The preset's value as a tension (for Thread Properties and tooltips).
export const presetTension = (preset: any): number => allowanceToTension(presetEndAllowance(preset));
// An element's own tension, as it was applied: split rings store ¼ of the
// preset value (endAllowanceFactor), so undo that first. null for shapes
// with no tension: circles, JKs, lines — and chains (factor 0).
export const elementTension = (element: any): number | null => {
  if (!element || !allowsEndAllowance(element)) return null;
  const f = endAllowanceFactor(element);
  if (f <= 0) return null;
  const a = Number(element.endAllowance ?? 0) || 0;
  return allowanceToTension(a / f);
};

// Fraction (0..1) of one stitched run's path at stitch position s.
export const stitchRunFraction = (s: number, count: number, allowance = 0): number =>
  (s + allowance) / (count + 2 * allowance);

// Split position of a split ring (stitches on side A), with the same
// fallback every caller already uses.
export const getSplitRingSplitPos = (element: any): number =>
  element.splitPosition || Math.floor(element.stitchCount / 2);

// Fraction (0..1) of the element's WHOLE path — all of el.paths end to end —
// at stitch position s. Chains and teardrops are one run. A split ring's
// paths are side A then side B, each its own run with its own two ends, so
// side B is offset by side A's two allowances. `onSideA` lets a caller that
// has already decided the side (e.g. a bead at stitchesBefore + 0.5) say so;
// otherwise s <= splitPos is side A, matching getSplitRingSide.
export const elementStitchFraction = (element: any, s: number, onSideA?: boolean): number => {
  const a = getEndAllowance(element);
  if (element.isSplitRing) {
    const sideA = onSideA ?? (s <= getSplitRingSplitPos(element));
    return (s + (sideA ? a : 3 * a)) / (element.stitchCount + 4 * a);
  }
  return stitchRunFraction(s, element.stitchCount, a);
};

// Fraction (0..1) of ONE split-ring side's path (el.paths[0] for A,
// el.paths[1] for B) at a side-local stitch position (0..that side's count).
// `count` is passed in because every caller already has it.
export const splitRingSideFraction = (element: any, localS: number, count: number): number =>
  stitchRunFraction(localS, count, getEndAllowance(element));

// Ghost elements' own `type` is always 'ghost' (join logic elsewhere relies
// on that staying true) — this resolves to the shape it's actually a copy
// of, via sourceType (see createPolarInstance), for the rendering branches
// that need to know whether to draw it as a chain/ring/line.
export const effectiveElementType = (el: any): string => el.type === 'ghost' ? (el.sourceType ?? el.type) : el.type;
