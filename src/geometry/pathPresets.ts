// pathPresets.ts — Preset angle snapping for bezier path handles
// Pure geometry functions, no React dependencies

import { BezierPath, sampleBezierPath, calculatePathLength } from './bezier';

/**
 * Determine which side of the chord a point sits on.
 * Uses the 2D cross product of (chord vector) × (point vector).
 *
 * Positive = point is on the "left" side of the chord (counter-clockwise)
 * Negative = point is on the "right" side of the chord (clockwise)
 *
 * Note: canvas Y is flipped (down = positive), but cross product
 * sign convention still holds for determining "same side as before".
 */
export function sideOfChord(
  startX: number, startY: number,
  endX: number, endY: number,
  pointX: number, pointY: number
): number {
  const chordDx = endX - startX;
  const chordDy = endY - startY;
  const pointDx = pointX - startX;
  const pointDy = pointY - startY;
  // 2D cross product (z-component): chord × point
  return Math.sign(chordDx * pointDy - chordDy * pointDx);
}

/**
 * Build a cubic bezier path with control points placed at preset angles
 * from their anchors, with handle lengths adjusted to match target path length.
 *
 * @param path - The original bezier path
 * @param presetDegrees - The angle offset from the chord (e.g. 90, 60, 30)
 * @param targetLength - Desired arc length of the bezier curve
 * @returns New path with control points at preset angles, same arc length
 */
export function applyPathPreset(
  path: BezierPath,
  presetDegrees: number,
  targetLength: number
): BezierPath {
  if (path.type !== 'cubic') {
    // Quadratic beziers don't have two independent control points
    // Return unchanged — we don't mutate legacy paths
    return path;
  }

  const P0 = { x: path.x, y: path.y };
  const P3 = { x: path.endX, y: path.endY };

  const chordDx = P3.x - P0.x;
  const chordDy = P3.y - P0.y;
  const chordAngle = Math.atan2(chordDy, chordDx);
  const chordLength = Math.hypot(chordDx, chordDy);

  // If start and end are coincident, no meaningful preset can be applied
  if (chordLength < 0.001) return path;

  // Determine which side of the chord each control point currently sits on
  const side1 = sideOfChord(P0.x, P0.y, P3.x, P3.y, path.control1X!, path.control1Y!);
  const side2 = sideOfChord(P0.x, P0.y, P3.x, P3.y, path.control2X!, path.control2Y!);

  // If a control point is exactly on the chord (side === 0), preserve its current side
  // by using the other control point's side, defaulting to +1 if both are zero
  const effectiveSide1 = side1 !== 0 ? side1 : (side2 !== 0 ? side2 : 1);
  const effectiveSide2 = side2 !== 0 ? side2 : (side1 !== 0 ? side1 : 1);

  // Preset angles for each control point relative to the chord.
  // control1 is anchored at the START → uses chordAngle as base
  // control2 is anchored at the END → uses chordAngle + 180° as base
  // (because the natural direction from end points back toward start)
  const angle1 = chordAngle + (presetDegrees * Math.PI / 180) * effectiveSide1;
  const angle2 = chordAngle + Math.PI - (presetDegrees * Math.PI / 180) * effectiveSide2;

  // Binary search: find handle lengths that produce the target arc length.
  // We search both handles simultaneously by using a single length parameter
  // shared between both — this produces symmetric, balanced curves.
  // (Each handle gets the same distance from its anchor.)

  const tolerance = targetLength * 0.07;
  let minLen = 0;
  let maxLen = targetLength * 2; // Allow handles up to 2x target length
  let bestLen = targetLength / 3; // Start with a reasonable default

  // If the preset angle produces a path that can never reach target length
  // (e.g. straight line with 0° preset), fall back to current handle lengths
  const currentLength = calculatePathLength(sampleBezierPath(path, 20));

  for (let iter = 0; iter < 30; iter++) {
    const len = (minLen + maxLen) / 2;

    const c1x = P0.x + Math.cos(angle1) * len;
    const c1y = P0.y + Math.sin(angle1) * len;
    const c2x = P3.x + Math.cos(angle2) * len;
    const c2y = P3.y + Math.sin(angle2) * len;

    const testPath: BezierPath = {
      type: 'cubic',
      x: P0.x, y: P0.y,
      control1X: c1x, control1Y: c1y,
      control2X: c2x, control2Y: c2y,
      endX: P3.x, endY: P3.y,
    };

    const testLength = calculatePathLength(sampleBezierPath(testPath, 20));

    if (Math.abs(testLength - targetLength) < tolerance * 0.3) {
      bestLen = len;
      break;
    }

    if (testLength < targetLength) {
      minLen = len;
    } else {
      maxLen = len;
    }
    bestLen = len;
  }

  const newLength = calculatePathLength(sampleBezierPath({
    type: 'cubic',
    x: P0.x, y: P0.y,
    control1X: P0.x + Math.cos(angle1) * bestLen,
    control1Y: P0.y + Math.sin(angle1) * bestLen,
    control2X: P3.x + Math.cos(angle2) * bestLen,
    control2Y: P3.y + Math.sin(angle2) * bestLen,
    endX: P3.x, endY: P3.y,
  }, 20));

  const newDiff = Math.abs(newLength - targetLength);
  const converged = newDiff < tolerance;
  if (!converged && Math.abs(bestLen - targetLength / 3) < 0.01) {
    return path;
  }

  return {
    ...path,
    control1X: P0.x + Math.cos(angle1) * bestLen,
    control1Y: P0.y + Math.sin(angle1) * bestLen,
    control2X: P3.x + Math.cos(angle2) * bestLen,
    control2Y: P3.y + Math.sin(angle2) * bestLen,
  };
}

/**
 * Apply a preset to all paths in a paths array (usually just one path).
 */
export function applyPathPresetToPaths(
  paths: BezierPath[],
  presetDegrees: number,
  targetLength: number
): BezierPath[] {
  return paths.map(p => applyPathPreset(p, presetDegrees, targetLength));
}
