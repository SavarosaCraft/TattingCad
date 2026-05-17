// src/geometry/paths.ts
//
// Pure path geometry functions — no React, no component state.
// Extracted from tattingindex.tsx where they were defined as component-level constants.
//
// Note: createSplitRingPath, createSplitRingPathFromEl, and rotatePathsAroundCenter
// require dsWidth as an explicit parameter (previously closed over component state).

import { sampleBezierPath, calculatePathLength } from '../geometry/bezier';

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
) => {
  const arcA = stitchCountA * dsWidth;
  const arcB = stitchCountB * dsWidth;
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
    const mockEl = { ...el, center: { x: cx, y: cy }, rotation: absoluteRot };
    return applyRotationToPathData(mockEl, createSplitRingPathFromEl(mockEl, dsWidth)).paths;
  }
  if (el?.type === 'ring' && (el?.shapeStyle === 'teardrop' || (el?.squeeze !== undefined && el?.squeeze > 0)) && absoluteRot !== undefined) {
    const mockEl = { ...el, center: { x: cx, y: cy }, rotation: absoluteRot };
    return applyRotationToPathData(mockEl, createTeardropPath(cx, cy, el.stitchCount * dsWidth, el.squeeze ?? 0)).paths;
  }
  return rotatePaths(paths, cx, cy, deltaDeg);
};

// ── Path presets ──────────────────────────────────────────────────────────────

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
    let lo = 0, hi = chordLen * 4, t = chordLen / 3;
    for (let iter = 0; iter < 24; iter++) {
      const c1x = x + t * d1x, c1y = y + t * d1y;
      const tryPath = { type: 'cubic', x, y, endX, endY, control1X: c1x, control1Y: c1y, control2X: path.control2X, control2Y: path.control2Y };
      const len = calculatePathLength(sampleBezierPath(tryPath, 30));
      if (Math.abs(len - targetLength) < targetLength * 0.005) break;
      if (len < targetLength) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return { ...path, control1X: x + t * d1x, control1Y: y + t * d1y };
  }

  const d2x = cos * ux - sin * px, d2y = cos * uy - sin * py;
  let lo = 0, hi = chordLen * 4, t = chordLen / 3;
  for (let iter = 0; iter < 24; iter++) {
    const c1x = x + t * d1x, c1y = y + t * d1y;
    const c2x = endX - t * d2x, c2y = endY - t * d2y;
    const tryPath = { type: 'cubic', x, y, endX, endY, control1X: c1x, control1Y: c1y, control2X: c2x, control2Y: c2y };
    const len = calculatePathLength(sampleBezierPath(tryPath, 30));
    if (Math.abs(len - targetLength) < targetLength * 0.005) break;
    if (len < targetLength) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return {
    ...path,
    control1X: x + t * d1x,   control1Y: y + t * d1y,
    control2X: endX - t * d2x, control2Y: endY - t * d2y,
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
