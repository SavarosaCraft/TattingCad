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

// Ghost elements' own `type` is always 'ghost' (join logic elsewhere relies
// on that staying true) — this resolves to the shape it's actually a copy
// of, via sourceType (see createPolarInstance), for the rendering branches
// that need to know whether to draw it as a chain/ring/line.
export const effectiveElementType = (el: any): string => el.type === 'ghost' ? (el.sourceType ?? el.type) : el.type;
