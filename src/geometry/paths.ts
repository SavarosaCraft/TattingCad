// src/geometry/paths.ts
//
// Pure path geometry functions — no React, no component state.
// Extracted from tattingindex.tsx where they were defined as component-level constants.
//
// Note: createSplitRingPath, createSplitRingPathFromEl, and rotatePathsAroundCenter
// require dsWidth as an explicit parameter (previously closed over component state).

import { sampleBezierPath, calculatePathLength } from '../geometry/bezier';
import { getEndAllowance, elementPathLength, allowsEndAllowance } from '../geometry/stitchGeometry';

// ── Chain length guard ───────────────────────────────────────────────────────

// How far past its physical thread length (stitchCount * dsWidth, plus the
// end allowance at each end — elementPathLength) a chain's
// endpoints are allowed to be dragged before it's flagged "too short". A
// chain can always bulge (endpoints close together) or flatten out toward a
// straight line (endpoints near the physical length apart) to span whatever
// chord distance its endpoints currently sit at — a curve of a given arc
// length can have any chord from 0 up to that same arc length (fully
// straight is the maximum). So "too short" should only ever mean "the
// endpoints are farther apart than the thread can physically reach, even
// fully straight" — not anything about the curve's current bow. This is
// deliberately blind to the chain's current control points for exactly that
// reason: checking the currently-rendered curve's own arc-length-to-chord
// ratio (the old approach) meant the flag depended on whatever shape
// happened to be sitting there, which drifted from unrelated edits,
// regeneration, reversal, etc. — see session 49/50 handoffs for the trail of
// bugs that caused. Physical length vs actual chord sidesteps all of it.
const TOO_SHORT_OVERSTRETCH_TOLERANCE = 1.10;

export const isChainTooShort = (el: any, dsWidth: number): boolean => {
  if (el.isClosed || el.type !== 'chain' || el.paths?.length !== 1) return false;
  const p = el.paths[0];
  const physicalLength = elementPathLength(el, dsWidth);
  if (physicalLength <= 0) return false;
  const endpointDist = Math.hypot(p.endX - p.x, p.endY - p.y);
  return endpointDist > physicalLength * TOO_SHORT_OVERSTRETCH_TOLERANCE;
};

// ── Circle ────────────────────────────────────────────────────────────────────

export const createCirclePath = (cx: number, cy: number, targetLength: number, squeeze = 0) => {
  const radius = targetLength / (2 * Math.PI);
  const widthFactor  = 1 - squeeze;
  const heightFactor = 1 + squeeze;
  const radiusX = radius * widthFactor;
  const radiusY = radius * heightFactor;
  return {
    isClosed: true,
    shapeStyle: 'circle',
    paths: [
      { type: 'quadratic', x: cx + radiusX, y: cy,
        controlX: cx + radiusX, controlY: cy - radiusY * 1.5,
        endX: cx - radiusX, endY: cy },
      { type: 'quadratic', x: cx - radiusX, y: cy,
        controlX: cx - radiusX, controlY: cy + radiusY * 1.5,
        endX: cx + radiusX, endY: cy },
    ],
  };
};

// ── Teardrop ──────────────────────────────────────────────────────────────────

export const createTeardropPath = (cx: number, cy: number, targetLength: number, squeeze = 0) => {
  // The SVG shape with heightRatio=2.4 and widthRatio=1.6 has an actual
  // circumference ~2× the simple calculation, so we scale down accordingly.
  const scale = (targetLength / 3) * 0.495;

  const heightRatio = 2.4;
  const widthRatio  = 1.6;
  const widthFactor  = 1 - squeeze;
  const heightFactor = 1 + squeeze;

  const height  = scale * heightRatio * heightFactor;
  const width   = scale * widthRatio  * widthFactor;
  const tipY    = cy - height / 2;
  const bottomY = cy + height / 2;
  const bulgeY  = cy + height * 0.15;

  return {
    isClosed: true,
    shapeStyle: 'teardrop',
    paths: [
      { type: 'cubic', x: cx, y: tipY,
        control1X: cx + width * 0.3, control1Y: tipY + height * 0.15,
        control2X: cx + width * 0.5, control2Y: bulgeY - height * 0.1,
        endX: cx + width / 2, endY: bulgeY },
      { type: 'cubic', x: cx + width / 2, y: bulgeY,
        control1X: cx + width * 0.45, control1Y: bulgeY + height * 0.25,
        control2X: cx + width * 0.2,  control2Y: bottomY - height * 0.05,
        endX: cx, endY: bottomY },
      { type: 'cubic', x: cx, y: bottomY,
        control1X: cx - width * 0.2,  control1Y: bottomY - height * 0.05,
        control2X: cx - width * 0.45, control2Y: bulgeY + height * 0.25,
        endX: cx - width / 2, endY: bulgeY },
      { type: 'cubic', x: cx - width / 2, y: bulgeY,
        control1X: cx - width * 0.5, control1Y: bulgeY - height * 0.1,
        control2X: cx - width * 0.3, control2Y: tipY + height * 0.15,
        endX: cx, endY: tipY },
    ],
  };
};

// ── Split ring math helpers ───────────────────────────────────────────────────
// These are used only by createSplitRingPath — not exported.

const splitRingMeasure = (h: number, bulge: number, c: number): number => {
  const half = h / 2;
  const x0 = 0, y0 = half, cx1 = -bulge, cy1 = half * c, cx2 = -bulge, cy2 = -half * c, x1 = 0, y1 = -half;
  let len = 0, px = x0, py = y0;
  for (let i = 1; i <= 60; i++) {
    const t = i / 60, u = 1 - t;
    const nx = u*u*u*x0 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x1;
    const ny = u*u*u*y0 + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*y1;
    len += Math.hypot(nx - px, ny - py); px = nx; py = ny;
  }
  return len;
};

const splitRingMaxH = (arc: number, c: number): number => {
  if (c <= 0) return arc * 0.95;
  let lo = 0, hi = arc;
  while (splitRingMeasure(hi, 0, c) <= arc && hi < arc * 10) hi *= 1.5;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (splitRingMeasure(mid, 0, c) <= arc) lo = mid; else hi = mid;
  }
  return lo;
};

const splitRingSolveBulge = (h: number, c: number, target: number): number => {
  if (splitRingMeasure(h, 0, c) >= target) return 0;
  let lo = 0, hi = target * 4;
  while (splitRingMeasure(h, hi, c) < target) hi *= 2;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (splitRingMeasure(h, mid, c) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
};

// ── Split ring ────────────────────────────────────────────────────────────────

export const createSplitRingPath = (
  cx: number, cy: number,
  stitchCountA: number, stitchCountB: number,
  dsWidth: number,
  hFrac = 0, squeezeCA = 0.75, squeezeCB = 0.75,
  endAllowance = 0, // ds of bare thread at EACH end of EACH side (both points)
) => {
  const arcA = (stitchCountA + 2 * endAllowance) * dsWidth;
  const arcB = (stitchCountB + 2 * endAllowance) * dsWidth;
  const hA = splitRingMaxH(arcA, squeezeCA);
  const hB = splitRingMaxH(arcB, squeezeCB);
  const hMax = Math.min(hA, hB);
  const hMin = hMax * 0.15;
  const h = hMax - (hMax - hMin) * hFrac;
  const topY = cy - h / 2;
  const botY = cy + h / 2;
  const bulgeA = splitRingSolveBulge(h, squeezeCA, arcA);
  const bulgeB = splitRingSolveBulge(h, squeezeCB, arcB);
  const c1yA = cy + (h / 2) * squeezeCA;
  const c2yA = cy - (h / 2) * squeezeCA;
  const c1yB = cy - (h / 2) * squeezeCB;
  const c2yB = cy + (h / 2) * squeezeCB;
  return {
    isClosed: true,
    shapeStyle: 'split-ring',
    paths: [
      { type: 'cubic', x: cx, y: botY,  control1X: cx - bulgeA, control1Y: c1yA, control2X: cx - bulgeA, control2Y: c2yA, endX: cx, endY: topY },
      { type: 'cubic', x: cx, y: topY, control1X: cx + bulgeB, control1Y: c1yB, control2X: cx + bulgeB, control2Y: c2yB, endX: cx, endY: botY },
    ],
    splitPosition: stitchCountA,
  };
};

// Convenience wrapper — reads squeeze/split fields from the element.
export const createSplitRingPathFromEl = (
  el: any,
  dsWidth: number,
  opts: {
    cx?: number; cy?: number;
    stitchCountA?: number; stitchCountB?: number;
    squeeze?: number; squeezeCA?: number; squeezeCB?: number;
  } = {},
) => {
  const cx  = opts.cx  ?? el.center.x;
  const cy  = opts.cy  ?? el.center.y;
  const scA = opts.stitchCountA ?? el.splitPosition;
  const scB = opts.stitchCountB ?? (el.stitchCount - el.splitPosition);
  return createSplitRingPath(
    cx, cy, scA, scB, dsWidth,
    opts.squeeze   ?? el.squeeze   ?? 0.25,
    opts.squeezeCA ?? el.squeezeCA ?? 0.75,
    opts.squeezeCB ?? el.squeezeCB ?? 0.75,
    getEndAllowance(el),
  );
};

// ── Path transforms ───────────────────────────────────────────────────────────

// Mirror paths horizontally (around x=cx) or vertically (around y=cy).
// Swaps start↔end and control points to preserve traversal direction.
export const mirrorPaths = (paths: any[], isHorizontal: boolean, cx: number, cy: number): any[] => {
  const mPt = (px: number, py: number) => isHorizontal
    ? { x: 2 * cx - px, y: py }
    : { x: px, y: 2 * cy - py };
  return paths.map(path => {
    if (path.type === 'cubic') {
      const s  = mPt(path.endX,      path.endY);
      const e2 = mPt(path.x,         path.y);
      const c1 = mPt(path.control2X, path.control2Y);
      const c2 = mPt(path.control1X, path.control1Y);
      return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y,
        control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
    }
    const s    = mPt(path.endX,    path.endY);
    const e2   = mPt(path.x,       path.y);
    const ctrl = mPt(path.controlX, path.controlY);
    return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
  }).reverse();
};

// Rotate path segments around (cx, cy) by angleDeg degrees.
// Handles both cubic and quadratic segments. Returns a new array.
export const rotatePaths = (paths: any[], cx: number, cy: number, angleDeg: number): any[] => {
  if (!angleDeg || !paths?.length) return paths;
  const rad = angleDeg * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rp = (px: number, py: number) => {
    const dx = px - cx, dy = py - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };
  return paths.map(p => {
    const s = rp(p.x, p.y), e2 = rp(p.endX, p.endY);
    if (p.type === 'cubic') {
      const c1 = rp(p.control1X, p.control1Y), c2 = rp(p.control2X, p.control2Y);
      return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y,
        control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
    }
    const c = rp(p.controlX, p.controlY);
    return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: c.x, controlY: c.y };
  });
};

// Apply rotation + flip transforms to newly-generated path data.
// Used when regenerating paths for an element that has been rotated/flipped.
export const applyRotationToPathData = (el: any, newPathData: any) => {
  let paths = newPathData.paths ?? [];
  const cx = el.center.x, cy = el.center.y;
  if (el.rotation)   paths = rotatePaths(paths, cx, cy, el.rotation);
  if (el.isFlippedH) paths = mirrorPaths(paths, true,  cx, cy);
  if (el.isFlippedV) paths = mirrorPaths(paths, false, cx, cy);
  return { ...newPathData, paths };
};

// Rotate paths around (cx, cy) by deltaDeg, respecting element shape type.
// For teardrops/split rings, regenerates the canonical path then applies
// the absolute rotation — avoids drift from repeated incremental rotations.
export const rotatePathsAroundCenter = (
  paths: any[], cx: number, cy: number,
  deltaDeg: number, dsWidth: number,
  el?: any, absoluteRot?: number,
): any[] => {
  if (!paths || deltaDeg === 0) return paths;
  if (el?.isSplitRing && el?.splitPosition !== undefined && absoluteRot !== undefined) {
    // Rotate the real arcs, then re-tidy in place (session 57) — rebuilding
    // from rotation/flip fields mis-mirrored flipped split rings.
    return rebuildSplitRingInPlace({ ...el, paths: rotatePaths(paths, cx, cy, deltaDeg) }, dsWidth);
  }
  if (el?.type === 'ring' && (el?.shapeStyle === 'teardrop' || (el?.squeeze !== undefined && el?.squeeze > 0)) && absoluteRot !== undefined) {
    const mockEl = { ...el, center: { x: cx, y: cy }, rotation: absoluteRot };
    return applyRotationToPathData(mockEl, createTeardropPath(cx, cy, elementPathLength(el, dsWidth), el.squeeze ?? 0)).paths;
  }
  return rotatePaths(paths, cx, cy, deltaDeg);
};

// ── Path presets ──────────────────────────────────────────────────────────────

// Finds the control-point magnitude t for which build(t) has the target arc
// length, by bisection on [0, hi] starting from the guess t0. Arc length
// grows with t here, so: too short → raise lo, too long → lower hi. Stops
// early once within 0.5% of the target. Shared by both branches of
// applyPathPreset below (symmetric and one-sided), which used to carry two
// hand-written copies of exactly this loop.
//
// The split-ring solvers above (splitRingMaxH, splitRingSolveBulge) are
// deliberately NOT routed through this: they first grow their upper bound
// until it overshoots, run a fixed iteration count with no early exit, and
// return a bound or midpoint rather than the last guess. Forcing them into
// this shape would shift every existing split ring's geometry slightly.
const solvePathMagnitude = (
  build: (t: number) => any,
  targetLength: number,
  hi: number,
  t0: number,
  iterations = 24,
): number => {
  let lo = 0, t = t0;
  for (let iter = 0; iter < iterations; iter++) {
    const len = calculatePathLength(sampleBezierPath(build(t), 30));
    if (Math.abs(len - targetLength) < targetLength * 0.005) break;
    if (len < targetLength) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return t;
};

// Apply a bow-angle preset to a chain path, keeping both endpoints fixed.
// presetDeg: angle of the tangent at start/end relative to the chord (45/60/90).
// targetLength: desired arc length — scales control-point magnitude via binary search.
export const applyPathPreset = (path: any, presetDeg: number, targetLength: number, symmetric = true): any => {
  const { x, y, endX, endY } = path;
  const chordX = endX - x, chordY = endY - y;
  const chordLen = Math.hypot(chordX, chordY);
  if (chordLen < 0.001) return path;
  const ux = chordX / chordLen, uy = chordY / chordLen;

  // Detect bow direction: cross product of chord with (control1 - start)
  const c1dx = (path.control1X ?? path.x) - x;
  const c1dy = (path.control1Y ?? path.y) - y;
  const cross = chordX * c1dy - chordY * c1dx;
  const bowSign = cross >= 0 ? 1 : -1;

  const px = -uy * bowSign, py = ux * bowSign;
  const rad = presetDeg * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const d1x = cos * ux + sin * px, d1y = cos * uy + sin * py;

  if (!symmetric) {
    // One-sided: only control1 moves; control2 stays where it was.
    const t = solvePathMagnitude(
      t => ({ type: 'cubic', x, y, endX, endY,
        control1X: x + t * d1x, control1Y: y + t * d1y,
        control2X: path.control2X, control2Y: path.control2Y }),
      targetLength, chordLen * 4, chordLen / 3,
    );
    return { ...path, control1X: x + t * d1x, control1Y: y + t * d1y };
  }

  const d2x = cos * ux - sin * px, d2y = cos * uy - sin * py;
  const t = solvePathMagnitude(
    t => ({ type: 'cubic', x, y, endX, endY,
      control1X: x + t * d1x, control1Y: y + t * d1y,
      control2X: endX - t * d2x, control2Y: endY - t * d2y }),
    targetLength, chordLen * 4, chordLen / 3,
  );
  return {
    ...path,
    control1X: x + t * d1x,   control1Y: y + t * d1y,
    control2X: endX - t * d2x, control2Y: endY - t * d2y,
  };
};

// ── Reset transform ───────────────────────────────────────────────────────────

// Resets a single element's shape back to a "relaxed" default and clears
// rotation to 0. "Pivot reset to itself" means two things together, both
// handled here:
//   - rotation: 0 — the baseline angle.
//   - polarRotationGridId: null — elements linked to a polar grid pivot
//     rotation around that grid's center instead of their own (see
//     getPolarPivot/getElementPivot in tattingindex.tsx's
//     setSingleRotationAbsolute — the polar pivot wins whenever it's set,
//     regardless of the rotation value). Leaving this set would silently
//     keep the external pivot even after rotation was zeroed, which is
//     exactly the bug this function exists to fix.
//
// Deliberately reuses two formulas that already exist elsewhere rather than
// inventing a third default:
//   - closed rings/teardrops/circles/split-rings: the exact same squeeze
//     defaults + rotation:0 as the per-element squeeze "Reset" button
//     (ShapeAndSqueezeControls.tsx) already uses.
//   - open chains (single cubic path): the same chord/arcLift bow formula
//     addChain (useEditorActions.ts) uses to build a brand-new chain,
//     centered on the element's own `center` (not the viewport center) and
//     keeping its actual stitchCount — see addChain's comment for why
//     chord/3 (not chord/5) is the right divisor.
//
// Returns null for anything this doesn't handle yet (ghosts, lines,
// multi-segment/split chains) — callers should treat null as "not
// resettable" (disable the button / skip the element) rather than applying
// a partial patch.
export const resetElementShape = (el: any, dsWidth: number): any | null => {
  if (el.type === 'ghost' || el.isGhost) return null;

  if (el.isSplitRing) {
    // Reset = upright, unmirrored canonical ring at its centre, so the flip
    // flags are cleared too (session 57) — they'd otherwise describe a
    // mirror the paths no longer have.
    return {
      squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75, rotation: 0, polarRotationGridId: null,
      isFlippedH: false, isFlippedV: false,
      ...createSplitRingPathFromEl(el, dsWidth, { squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75 }),
    };
  }

  if (el.isClosed) {
    const targetLength = elementPathLength(el, dsWidth); // circles: allowance is always 0
    const newPathData = el.shapeStyle === 'circle'
      ? createCirclePath(el.center.x, el.center.y, targetLength, 0)
      : createTeardropPath(el.center.x, el.center.y, targetLength, 0);
    return { squeeze: 0, rotation: 0, polarRotationGridId: null, ...newPathData };
  }

  if (el.type === 'chain' && !el.isSplitChain && el.paths?.length === 1) {
    const cx = el.center.x, cy = el.center.y;
    const chord = elementPathLength(el, dsWidth) * 0.92; // same ratio addChain uses (allowance included, as there)
    const halfChord = chord / 2;
    const arcLift = chord / 3; // same divisor addChain uses (see its own comment re: isTooShort margin)
    const startX = cx - halfChord, startY = cy;
    const endX = cx + halfChord, endY = cy;
    return {
      rotation: 0, polarRotationGridId: null,
      paths: [{
        type: 'cubic', x: startX, y: startY,
        control1X: startX + chord / 3, control1Y: startY - arcLift,
        control2X: startX + chord * 2 / 3, control2Y: startY - arcLift,
        endX, endY,
      }],
    };
  }

  return null;
};

// ── Resizing an existing element to a new thread length ──────────────────────
// Shared by notation edits (computeElementAfterNotationEdit, tattingindex.tsx)
// and "apply end allowance to selected" (resizeElementForAllowance below).
// Moved here verbatim from computeElementAfterNotationEdit (session 57) —
// verified identical output on random inputs before and after the move.

// Uniformly scale paths about (cx, cy). Closed rings use this so a resize
// keeps the ring's own squeeze / rotation / flip / Path Edit shaping.
export const scalePathsAboutPoint = (paths: any[], cx: number, cy: number, scaleFactor: number): any[] =>
  paths.map(path => {
    const scPt = (px: number, py: number) => ({ x: cx + (px - cx) * scaleFactor, y: cy + (py - cy) * scaleFactor });
    if (path.type === 'cubic') {
      const s = scPt(path.x, path.y), e = scPt(path.endX, path.endY);
      const c1 = scPt(path.control1X, path.control1Y), c2 = scPt(path.control2X, path.control2Y);
      return { ...path, x: s.x, y: s.y, endX: e.x, endY: e.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
    }
    const s = scPt(path.x, path.y), e = scPt(path.endX, path.endY), c = scPt(path.controlX, path.controlY);
    return { ...path, x: s.x, y: s.y, endX: e.x, endY: e.y, controlX: c.x, controlY: c.y };
  });

// Re-bend one open-chain path to `newLength` keeping BOTH endpoints fixed
// (cubic: bisection on the bow depth, bowing to the side it already bows
// to; quadratic: scaled from its start by newLength / oldLength, as before).
export const rebendChainPathToLength = (path: any, oldLength: number, newLength: number): any => {
  const tolerance = newLength * 0.005;
  if (path.type !== 'cubic') {
    const startX = path.x, startY = path.y;
    const scaleFactor = newLength / oldLength;
    return { ...path,
      endX: startX+(path.endX-startX)*scaleFactor, endY: startY+(path.endY-startY)*scaleFactor,
      controlX: startX+(path.controlX-startX)*scaleFactor, controlY: startY+(path.controlY-startY)*scaleFactor };
  }
  const sx=path.x,sy=path.y,ex=path.endX,ey=path.endY;
  const midX=(sx+ex)/2,midY=(sy+ey)/2;
  const axisX=ex-sx,axisY=ey-sy,perpX=-axisY,perpY=axisX;
  const perpLen=Math.hypot(perpX,perpY);
  const oldMidX=(path.control1X+path.control2X)/2,oldMidY=(path.control1Y+path.control2Y)/2;
  const sideSign=perpLen>0?(Math.sign(((oldMidX-midX)*perpX+(oldMidY-midY)*perpY))||1):1;
  let minDepth=0,maxDepth=newLength,bestC1X=path.control1X,bestC1Y=path.control1Y,bestC2X=path.control2X,bestC2Y=path.control2Y;
  for (let iter=0;iter<20;iter++) {
    const tryDepth=(minDepth+maxDepth)/2;
    const offX=perpLen>0?(perpX/perpLen)*tryDepth*sideSign:0;
    const offY=perpLen>0?(perpY/perpLen)*tryDepth*sideSign:0;
    const c1x=sx+axisX*0.33+offX,c1y=sy+axisY*0.33+offY;
    const c2x=sx+axisX*0.67+offX,c2y=sy+axisY*0.67+offY;
    const tryPath={type:'cubic',x:sx,y:sy,endX:ex,endY:ey,control1X:c1x,control1Y:c1y,control2X:c2x,control2Y:c2y};
    const tryLen=calculatePathLength(sampleBezierPath(tryPath as any,20));
    bestC1X=c1x;bestC1Y=c1y;bestC2X=c2x;bestC2Y=c2y;
    if(Math.abs(tryLen-newLength)<tolerance)break;
    if(tryLen<newLength)minDepth=tryDepth;else maxDepth=tryDepth;
  }
  return {...path,x:sx,y:sy,endX:ex,endY:ey,control1X:bestC1X,control1Y:bestC1Y,control2X:bestC2X,control2Y:bestC2Y};
};

// Rebuild a split ring's two arcs (new counts / squeeze / allowance via
// `overrides`) while keeping it exactly where and how it currently sits.
// Position, orientation AND mirror state are read from its existing side-A
// arc — chord midpoint, chord direction, and which side it bulges to — not
// from the rotation / isFlippedH / isFlippedV fields. (Session 57 found that
// rebuilding a FLIPPED split ring from those fields via
// applyRotationToPathData — what the squeeze sliders, Reset and notation
// edits do today — reflects it the wrong way; see handoff-session57.md.)
// Falls back to that field-based rebuild only if the element has no paths.
export const rebuildSplitRingInPlace = (el: any, dsWidth: number, overrides: any = {}): any[] => {
  const next = { ...el, ...overrides };
  const A = el.paths?.[0];
  if (!A) return applyRotationToPathData(next, createSplitRingPathFromEl(next, dsWidth)).paths;
  const canon = createSplitRingPathFromEl(next, dsWidth, { cx: 0, cy: 0 }).paths;
  // Frame = side A's chord (middle + direction) and which side the ring
  // bulges to. Side A can be dead straight (overall squeeze 0 makes the
  // shorter side straight), so the bulge side is taken from whichever arc
  // bulges more — side B bulges the opposite way, hence the minus.
  const frame = (pa: any, pb: any) => {
    const l = Math.hypot(pa.endX - pa.x, pa.endY - pa.y) || 1;
    const u = { x: (pa.endX - pa.x) / l, y: (pa.endY - pa.y) / l };
    const n = { x: -u.y, y: u.x };
    const c = { x: (pa.x + pa.endX) / 2, y: (pa.y + pa.endY) / 2 };
    const off = (p: any) => { const m = sampleBezierPath(p, 2)[1]; return (m.x - c.x) * n.x + (m.y - c.y) * n.y; }; // t = 0.5
    const oa = off(pa), ob = pb ? off(pb) : 0;
    const side = Math.sign(Math.abs(oa) >= Math.abs(ob) ? oa : -ob) || 1;
    return { u, n, c, side };
  };
  const fc = frame(canon[0], canon[1]), fe = frame(A, el.paths[1]);
  const refl = fc.side === fe.side ? 1 : -1;
  const map = (x: number, y: number) => {
    const dx = x - fc.c.x, dy = y - fc.c.y;
    const a = dx * fc.u.x + dy * fc.u.y;
    const b = (dx * fc.n.x + dy * fc.n.y) * refl;
    return { x: fe.c.x + a * fe.u.x + b * fe.n.x, y: fe.c.y + a * fe.u.y + b * fe.n.y };
  };
  return canon.map((p: any) => {
    const s = map(p.x, p.y), e = map(p.endX, p.endY);
    const c1 = map(p.control1X, p.control1Y), c2 = map(p.control2X, p.control2Y);
    return { ...p, x: s.x, y: s.y, endX: e.x, endY: e.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
  });
};

// "Apply end allowance" (session 57, step 5): the patch that gives `el` a
// new end allowance `allowance` (ds) and rebuilds its paths at the matching
// length, or null when the element can't take one (circle rings, JKs, lines,
// ghosts) or already has exactly that value.
//   teardrop ring  — scaled about its centre (keeps squeeze/rotation/flips
//                    and any Path Edit shaping), like a notation edit;
//   split ring     — rebuilt from its own squeeze/split fields, in place
//                    (rebuildSplitRingInPlace — correct for flipped rings);
//   chain          — re-bent with both endpoints fixed, like a notation
//                    edit: a single path targets the nominal new length; a
//                    multi-path chain gives each path its share of it.
// Joins are by picot id and survive; join lines stretch as with any resize.
export const resizeElementForAllowance = (el: any, allowance: number, dsWidth: number): any | null => {
  if (!el || el.type === 'ghost' || el.isGhost || !allowsEndAllowance(el)) return null;
  const a = Math.max(0, Number(allowance) || 0);
  if (getEndAllowance(el) === a && (el.endAllowance ?? 0) === a) return null;
  const next = { ...el, endAllowance: a };
  if (!el.paths?.length) return { endAllowance: a };

  if (el.isSplitRing) {
    return { endAllowance: a, paths: rebuildSplitRingInPlace(el, dsWidth, { endAllowance: a }) };
  }

  const oldLength = elementPathLength(el, dsWidth);
  const newLength = elementPathLength(next, dsWidth);
  if (!(oldLength > 0) || Math.abs(oldLength - newLength) <= 0.01) return { endAllowance: a };

  if (el.isClosed) {
    return { endAllowance: a, paths: scalePathsAboutPoint(el.paths, el.center.x, el.center.y, newLength / oldLength) };
  }

  if (el.paths.length === 1) {
    return { endAllowance: a, paths: [rebendChainPathToLength(el.paths[0], oldLength, newLength)] };
  }
  const lens = el.paths.map((p: any) => calculatePathLength(sampleBezierPath(p, 20)));
  const total = lens.reduce((s: number, x: number) => s + x, 0) || 1;
  return {
    endAllowance: a,
    paths: el.paths.map((p: any, i: number) =>
      rebendChainPathToLength(p, lens[i], lens[i] * newLength / total)),
  };
};

// Apply an angle preset to a line element (presetDeg = 0 → horizontal).
// Keeps start (x, y) fixed; rotates endpoint to new angle at the same length.
export const applyLinePreset = (path: any, presetDeg: number): any => {
  const { x, y, endX, endY } = path;
  const len = Math.hypot(endX - x, endY - y);
  if (len < 0.001) return path;
  const rad = presetDeg * Math.PI / 180;
  const newEndX = x + Math.cos(rad) * len;
  const newEndY = y + Math.sin(rad) * len;
  return {
    ...path,
    endX: newEndX, endY: newEndY,
    control1X: x + Math.cos(rad) * len * 0.33, control1Y: y + Math.sin(rad) * len * 0.33,
    control2X: x + Math.cos(rad) * len * 0.67, control2Y: y + Math.sin(rad) * len * 0.67,
  };
};
