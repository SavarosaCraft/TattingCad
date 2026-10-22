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

// End allowance, in ds, at each path end of this element. Always 0 in step 1
// — no element carries one yet. Step 2 adds a stored per-element value;
// step 3 returns it here for chains, split chains, teardrop rings and split
// rings (circle-shaped rings, Josephine knots and lines stay 0).
export const getEndAllowance = (_element: any): number => 0;

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
