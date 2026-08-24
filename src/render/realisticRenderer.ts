// src/render/realisticRenderer.ts
//
// Serializes all stitch geometry into a baked SVG string for realistic-mode
// rendering. Extracted from tattingindex.tsx's bakeRealisticView (session
// 51 extraction plan). No React — takes explicit params instead of closing
// over component state.

import {
  sampleBezierPath,
  calculatePathLength,
  getPointAndAngleAtDistanceFast,
  getPointAndAngleAtDistance,
} from '../geometry/bezier';
import { getCircleStitchAngle, effectiveElementType } from '../geometry/stitchGeometry';
import { STITCH_WIDTH_DS } from '../domain/parser';

// ============================================================================
// WEDGE SHAPES - Bounding rectangles for each stitch type in normalized coords
// Derived by tracing the SVG sub-paths of DS/SS/RDS stitch symbols.
// Format: [x_left, x_right, y_outer, y_inner]
//   x: tangent direction (positive = forward along path)
//   y: perpendicular direction (positive = INWARD toward ring center)
//   Origin = stitch center point, already offset outward from ring by offsetAmount
//   Scale factor: 0.4 normalized units = 1 DS width
// ============================================================================
const WEDGE_SHAPES = {
  'ds': [
    [-0.2609,  0.0492,  0.0500, 0.2002],  // horizontal bar
    [-0.2622, -0.1123,  0.2128, 0.5229],  // left post
    [-0.0995,  0.0504,  0.2128, 0.5229],  // right post
  ],
  'ss': [
    [-0.1023,  0.0463,  0.0500, 0.2002],  // bar (half width of DS)
    [-0.1023,  0.0463,  0.2128, 0.5229],  // post (same width as bar)
  ],
  'lss': [
    [-0.1023,  0.0463,  0.0500, 0.2002],
    [-0.1023,  0.0463,  0.2128, 0.5229],
  ],
  'rss': [
    [-0.1023,  0.0463,  0.0500, 0.2002],
    [-0.1023,  0.0463,  0.2128, 0.5229],
  ],
  'rds': [
    [-0.5933,  0.0798,  0.0500, 0.2002],  // wide bar
    [-0.5946, -0.4447,  0.2128, 0.5229],  // post 1
    [-0.4198, -0.2699,  0.2128, 0.5229],  // post 2
    [-0.2450, -0.0951,  0.2128, 0.5229],  // post 3
    [-0.0705,  0.0794,  0.2128, 0.5229],  // post 4
  ],
  'bds': [
    // bds is an alias for rds — same realistic-mode shape, different
    // notation keyword.
    [-0.5933,  0.0798,  0.0500, 0.2002],
    [-0.5946, -0.4447,  0.2128, 0.5229],
    [-0.4198, -0.2699,  0.2128, 0.5229],
    [-0.2450, -0.0951,  0.2128, 0.5229],
    [-0.0705,  0.0794,  0.2128, 0.5229],
  ],
};

// The x-extents (leftmost/rightmost x across all WEDGE_SHAPES rects) for
// each stitch type — used to map a symbol's normalized x-coordinates onto
// a stitch's angular/path-distance span. Single source of truth: this used
// to be redeclared as 4 separate local consts, one per render branch
// (renderWedgeRingShapes, renderWedgeTeardropShapes, renderWedgeSplitRingShapes,
// renderWedgeChainShapes), and had already drifted — one copy had 'ss'
// xMin -0.1036 while the other three (correctly, matching WEDGE_SHAPES.ss
// itself) had -0.1023. Fixed to -0.1023 here.
const STITCH_X_EXTENTS: Record<string, { xMin: number; xMax: number }> = {
  'ds':  { xMin: -0.2622, xMax:  0.0504 },
  'ss':  { xMin: -0.1023, xMax:  0.0463 },
  'lss': { xMin: -0.1023, xMax:  0.0463 },
  'rss': { xMin: -0.1023, xMax:  0.0463 },
  'rds': { xMin: -0.5946, xMax:  0.0798 },
  'bds': { xMin: -0.5946, xMax:  0.0798 }, // alias for rds
};

// How far outward from the path centerline stitch shapes are drawn, as a
// function of thread thickness (dsWidth): a fraction of dsWidth itself, plus
// a flat padding term that doesn't scale with thread thickness. Both terms
// were previously inlined as bare numbers (`dsWidth * 0.125 + 5`) at the one
// call site; named here since their roles (proportional vs. flat) differ.
const OFFSET_DS_FRACTION = 0.125;
const OFFSET_BASE_PADDING = 5;

// Picot tip length, in DS-width units (multiplied by dsWidth to get the
// drawn length). Two keyword forms map to the same three sizes — sp/p/lp
// (tatting's small/medium/large picot shorthand) and small/medium/large
// (their full-word equivalents) — both appear in saved notation/UI, so both
// need an entry here rather than normalizing to one form at this layer.
const PICOT_TIP_LENGTH_DS: Record<string, number> = {
  sp: 1.2, p: 2.0, lp: 3.2,
  small: 1.2, medium: 2.0, large: 3.2,
};
const PICOT_TIP_LENGTH_DEFAULT = 2.0; // used when picot.length is missing/unrecognized

// Half-width, in DS-stitch-count units, of the gap left in the stitch fill
// on either side of a picot's stitch position (picot.stitchesBefore) — the
// span [stitchesBefore - PICOT_GAP_HALF_WIDTH_DS, stitchesBefore + same] is
// excluded from ordinary stitch geometry so the picot has room to draw.
const PICOT_GAP_HALF_WIDTH_DS = 0.6;

export interface BakeRealisticViewParams {
  elements: any[];
  dsWidth: number;
  picotConnections: any[];
  getElementColor: (element: any) => any;
  getGradientColorAtPosition: (gradientId: string, position: number) => string;
  getStitchTypes: (notation: string) => any;
}

export function bakeRealisticView(params: BakeRealisticViewParams): string {
  const { elements, dsWidth, picotConnections, getElementColor, getGradientColorAtPosition, getStitchTypes } = params;

  // ── Group A geometry/render helpers (nested so they close over the
  // params destructured above, matching their original closure behavior
  // verbatim) ──────────────────────────────────────────────────────────────
  const calculatePathStitches = (element) => {
    if (!element || !element.paths || element.paths.length === 0) return [];
    
    const stitches = [];
    const stitchCount = element.stitchCount || 0;
    
    // Parse stitch types from notation
    const stitchTypeMap = getStitchTypes(element.notation || '');
    
    const renderPaths = element.paths;
    
    // Pre-sample each path ONCE - avoids re-sampling on every getPointAndAngle call
    const allSamples = renderPaths.map(p => sampleBezierPath(p, 50));
    const pathLengths = allSamples.map(s => calculatePathLength(s));
    const totalLength = pathLengths.reduce((a, b) => a + b, 0);

    // Determine step size: 0.5 when the element uses ss/lss/rss stitches
    // (which sit at half-integer dsPosition keys), 1 otherwise.
    const hasHalfStitches = Object.keys(stitchTypeMap).some(k => parseFloat(k) % 1 !== 0);
    const step = hasHalfStitches ? 0.5 : 1;
    const totalSteps = Math.round(stitchCount / step);

    for (let step_i = 0; step_i < totalSteps; step_i++) {
      const i = step_i * step;
      let type = stitchTypeMap[i];
      if (type === undefined) {
        // No map entry at this half-step slot — before defaulting to a
        // brand new stitch, check whether it's actually the tail half of
        // a plain 'ds' that started at the previous half-step. ds/rds/bds
        // are the only types that span more than one half-step slot;
        // rds/bds already leave their own 'rds-cont' markers, but ds
        // (which only needs the half-step grid because something ELSE in
        // this notation forced hasHalfStitches on) doesn't — so without
        // this check every plain ds next to an rds/bds/ss run rendered as
        // itself PLUS a spurious extra 'ss' mark in its own tail half.
        if (step === 0.5 && stitchTypeMap[i - 0.5] === 'ds') continue;
        type = step === 0.5 ? 'ss' : 'ds';
      }
      if (type === 'rds-cont') continue; // second/third half-step of RDS/BDS — skip

      // RDS/BDS spans 1.5 DS slots: sample at midpoint of the full span
      const position = type === 'rds' ? (i + 0.75) / stitchCount : (i + step * 0.5) / stitchCount;
      const distance = position * totalLength;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, distance);
      
      const startDist = (i / stitchCount) * totalLength;
      const endDist = ((i + (type === 'rds' ? 1.5 : step)) / stitchCount) * totalLength;
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, startDist);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, endDist);
      
      const _matEC = getElementColor(element);
      const color = _matEC.isGradient ? getGradientColorAtPosition(_matEC.id, position) : (_matEC.color || element.color);
      
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type, dsPosition: i });
    }
    
    // Return stitches + the pre-sampled path data so the render can reuse it
    // without calling sampleBezierPath again (totalPathLength IIFE in JSX)
    return { stitches, allSamples, pathLengths, totalLength };
  };

  // Calculate stitch positions for split rings (two separate paths)
  const calculateSplitRingStitches = (element) => {
    if (!element || !element.paths || element.paths.length < 2) return [];
    
    const stitches = [];
    const stitchCountA = element.splitPosition || Math.floor(element.stitchCount / 2);
    const stitchCountB = element.stitchCount - stitchCountA;
    
    const notationA = element.notation || 'sr: 5ds';
    const notationB = element.notationB ? `sr: ${element.notationB}` : 'sr: 5ds';
    const stitchTypeMapA = getStitchTypes(notationA);
    const stitchTypeMapB = getStitchTypes(notationB);
    
    // Pre-sample each path ONCE
    const pathA = element.paths[0];
    const samplesA = [sampleBezierPath(pathA, 50)];
    const lengthsA = [calculatePathLength(samplesA[0])];
    const lengthA = lengthsA[0];
    
    // Path A uses materialId, Path B uses materialIdB (fallback to materialId)
    const ecA = getElementColor({ ...element });
    const ecB = getElementColor({ ...element, materialId: element.materialIdB || element.materialId });

    for (let i = 0; i < stitchCountA; i++) {
      const distance = ((i + 0.5) / stitchCountA) * lengthA;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, distance);
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, (i / stitchCountA) * lengthA);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, ((i + 1) / stitchCountA) * lengthA);
      const color = ecA.isGradient ? getGradientColorAtPosition(ecA.id, i / stitchCountA) : ecA.color;
      const type = stitchTypeMapA[i] || 'ds';
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type });
    }
    
    const pathB = element.paths[1];
    const samplesB = [sampleBezierPath(pathB, 50)];
    const lengthsB = [calculatePathLength(samplesB[0])];
    const lengthB = lengthsB[0];
    
    for (let i = 0; i < stitchCountB; i++) {
      const distance = ((i + 0.5) / stitchCountB) * lengthB;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, distance);
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, (i / stitchCountB) * lengthB);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, ((i + 1) / stitchCountB) * lengthB);
      const color = ecB.isGradient ? getGradientColorAtPosition(ecB.id, i / stitchCountB) : ecB.color;
      const type = stitchTypeMapB[i] || 'ds';
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type });
    }
    
    return stitches;
  };

  // Calculate stitch positions for circular rings
  const calculateCircleStitches = (element) => {
    if (!element || element.shapeStyle !== 'circle') return [];
    
    const stitches = [];
    const stitchCount = element.stitchCount || 0;
    const targetCircumference = stitchCount * dsWidth;
    const radius = targetCircumference / (2 * Math.PI);
    const rotation = (element.rotation || 0) * Math.PI / 180;
    
    // Parse stitch types from notation
    const stitchTypeMap = getStitchTypes(element.notation || '');

    // Use 0.5 step when the element has half-stitches (ss/lss/rss sit at
    // half-integer dsPosition keys). Integer-only step misses them entirely.
    const hasHalfStitches = Object.keys(stitchTypeMap).some(k => parseFloat(k) % 1 !== 0);
    const step = hasHalfStitches ? 0.5 : 1;
    const totalSteps = Math.round(stitchCount / step);

    for (let step_i = 0; step_i < totalSteps; step_i++) {
      const i = step_i * step;
      let type = stitchTypeMap[i];
      if (type === undefined) {
        // See the matching comment in calculateChainStitches — plain ds's
        // tail half under a half-step grid forced on by something else in
        // the notation, not a real gap.
        if (step === 0.5 && stitchTypeMap[i - 0.5] === 'ds') continue;
        type = hasHalfStitches ? ['ss', 'ss'] : 'ds';
      }
      if (type === 'rds-cont') continue;
      
      const position = type === 'rds' ? (i + 0.75) / stitchCount : (i + step * 0.5) / stitchCount;
      const angle = position * Math.PI * 2 + rotation;
      const x = element.center.x + Math.cos(angle) * radius;
      const y = element.center.y + Math.sin(angle) * radius;
      const tangentAngle = angle + Math.PI / 2;
      
      let color;
      const ec = getElementColor(element);
      if (ec.isGradient) {
        color = getGradientColorAtPosition(ec.id, position);
      } else {
        color = ec.color;
      }
      
      stitches.push({ x, y, angle: tangentAngle, centerPolarAngle: angle, color, type, dsPosition: i });
    }
    
    return stitches;
  };



  // ============================================================================
  // WEDGE STITCH RENDERING
  // Trapezoid shapes that conform to path curvature, filling gaps between stitches.
  // ============================================================================

  // Render a DS/SS/RDS stitch as trapezoid paths for circular rings.
  // Works in world coordinates using exact polar geometry — perfect radial edges.
  // Returns an array of SVG "d" path strings (one per sub-shape: bar + posts).
  const renderWedgeRingShapes = (stitch, el, scale, offsetAmount, stitchType) => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const cx = el.center.x;
    const cy = el.center.y;
    const r = el.stitchCount * dsWidth / (2 * Math.PI);
    const baseRadius = r + offsetAmount;

    // centerPolarAngle is the polar angle of this stitch's midpoint from ring center
    const centerPolarAngle = stitch.centerPolarAngle;

    // Angular half-span for this stitch type (RDS = 2 DS slots wide)
    const halfArc = (Math.PI / el.stitchCount) * (STITCH_WIDTH_DS[stitchType] || 1.0);

    // The WEDGE_SHAPES x-extents of the DS/SS/RDS base symbol
    // These are the leftmost and rightmost x coords across ALL rects for this type
    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;     // full symbol width in normalized units
    const alphaStart = centerPolarAngle - halfArc;  // left edge of this stitch's arc
    const alphaEnd   = centerPolarAngle + halfArc;  // right edge

    return shapes.map(([xl, xr, yo, yi]) => {
      // Convert symbol y to radial distances from ring center.
      // Positive y in symbol = inward = SUBTRACT from baseRadius.
      const d_outer = baseRadius - yo * scale;
      const d_inner = baseRadius - yi * scale;

      // Map symbol x linearly onto the stitch's full angular span.
      // xl=ext.xMin → alphaStart, xr=ext.xMax → alphaEnd
      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;
      const a_left  = alphaStart + tLeft  * (alphaEnd - alphaStart);
      const a_right = alphaStart + tRight * (alphaEnd - alphaStart);

      // Four trapezoid corners in world coordinates
      const p1x = cx + d_outer * Math.cos(a_left);
      const p1y = cy + d_outer * Math.sin(a_left);
      const p2x = cx + d_outer * Math.cos(a_right);
      const p2y = cy + d_outer * Math.sin(a_right);
      const p3x = cx + d_inner * Math.cos(a_right);
      const p3y = cy + d_inner * Math.sin(a_right);
      const p4x = cx + d_inner * Math.cos(a_left);
      const p4y = cy + d_inner * Math.sin(a_left);

      return `M ${p1x},${p1y} L ${p2x},${p2y} L ${p3x},${p3y} L ${p4x},${p4y} Z`;
    });
  };

  // Wedge trapezoid rendering for CLOSED non-circle paths (teardrops, squeezed rings).
  // SMOOTH OUTER CURVE PRIORITY: Uses a pre-sampled continuous offset curve for the outer edge,
  // then bridges to polar-computed inner edge. Accepts slight distortion of hidden inner parts
  // to achieve smooth visible appearance.
  // Sample a segment of the path between startDist and endDist with offset perpendicular
  // Sample entire path with perpendicular offset, returning array of points
  const sampleFullPathWithOffset = (paths, offset, totalSamples) => {
    let totalLength = 0;
    for (const path of paths) {
      const samples = sampleBezierPath(path, 50);
      totalLength += calculatePathLength(samples);
    }

    const points = [];
    for (let i = 0; i <= totalSamples; i++) {
      const dist = (i / totalSamples) * totalLength;
      const { x, y, angle } = getPointAndAngleAtDistance(paths, dist);
      const perpAngle = angle - Math.PI / 2;
      points.push({
        x: x + Math.cos(perpAngle) * offset,
        y: y + Math.sin(perpAngle) * offset
      });
    }
    
    return points;
  };

  // Shared core for teardrop / chain / split-ring wedge rendering. All three
  // sample two parallel offset curves (outer + inner edge of the stitch symbol)
  // over some set of paths, then slice both curves per WEDGE_SHAPES rectangle
  // and stitch outer-forward/inner-backward into a closed quad path.
  //
  // Consolidated from three near-identical copies (session 51 cleanup) that
  // differed only in which paths get sampled and what count the sampling is
  // normalized against:
  //   - teardrop/chain: el.paths (all paths), against el.stitchCount
  //   - split ring:      one path half,        against that half's local count
  // Verified behavior-preserving, not just similar-looking: the original
  // teardrop/chain bodies computed `stitchSliceStart` via a `baseIndex +
  // fraction` split of stitchIndex that is a mathematical no-op
  // (floor(x) + (x - floor(x)) === x for all x), so collapsing it to use
  // stitchOffset directly — matching what split ring already did — changes
  // nothing about the output.
  const renderWedgePathShapes = (
    paths: any[],
    stitchCountForSampling: number,
    stitchOffset: number,
    scale: number,
    offsetAmount: number,
    stitchType: string,
  ): string[] => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const samplesPerDS = 10;
    const totalSamples = stitchCountForSampling * samplesPerDS;

    // DS-equivalent width for this stitch type (SS is half of DS, RDS/BDS are wider)
    const stitchWidth = STITCH_WIDTH_DS[stitchType] || 1.0;
    const samplesForThisStitch = samplesPerDS * stitchWidth;

    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;

    return shapes.map(([xl, xr, yo, yi]) => {
      // Sample TWO parallel curves at this rectangle's outer and inner radii
      const outerOffset = offsetAmount - yo * scale;
      const innerOffset = offsetAmount - yi * scale;

      const outerCurve = sampleFullPathWithOffset(paths, outerOffset, totalSamples);
      const innerCurve = sampleFullPathWithOffset(paths, innerOffset, totalSamples);

      // Map this rectangle's horizontal position to slice indices
      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;

      const stitchSliceStart = stitchOffset * samplesPerDS;
      const rectStart = Math.round(stitchSliceStart + tLeft  * samplesForThisStitch);
      const rectEnd   = Math.round(stitchSliceStart + tRight * samplesForThisStitch);

      const outerSlice = outerCurve.slice(rectStart, rectEnd + 1);
      const innerSlice = innerCurve.slice(rectStart, rectEnd + 1);
      if (outerSlice.length < 2 || innerSlice.length < 2) return '';

      // Build closed path: outer curve forward, inner curve backward
      let pathD = `M ${outerSlice[0].x},${outerSlice[0].y}`;
      for (let j = 1; j < outerSlice.length; j++) {
        pathD += ` L ${outerSlice[j].x},${outerSlice[j].y}`;
      }
      pathD += ` L ${innerSlice[innerSlice.length - 1].x},${innerSlice[innerSlice.length - 1].y}`;
      for (let j = innerSlice.length - 2; j >= 0; j--) {
        pathD += ` L ${innerSlice[j].x},${innerSlice[j].y}`;
      }
      return pathD + ' Z';
    });
  };

  // Render closed path stitches (teardrops / squeezed rings) using two
  // parallel offset curves sampled across the element's full path set.
  const renderWedgeTeardropShapes = (el, scale, offsetAmount, stitchType, stitchIndex) =>
    renderWedgePathShapes(el.paths, el.stitchCount, stitchIndex, scale, offsetAmount, stitchType);

  // Render split ring stitches using two parallel offset curves per path
  // half. Each half (pathA / pathB) is treated independently, like a mini
  // teardrop ring scoped to just that half's stitch range.
  const renderWedgeSplitRingShapes = (el, scale, offsetAmount, stitchType, globalIndex) => {
    const splitPos = el.splitPosition || Math.floor(el.stitchCount / 2);
    const inA = globalIndex < splitPos;
    const path = inA ? el.paths[0] : el.paths[1];
    if (!path) return (WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds']).map(() => '');
    const localCount = inA ? splitPos : el.stitchCount - splitPos;
    const localIndex = inA ? globalIndex : globalIndex - splitPos;
    return renderWedgePathShapes([path], localCount, localIndex, scale, offsetAmount, stitchType);
  };

  // Render open-path (chain) stitches — same curve-slicing approach as
  // teardrops, just over an unclosed path set.
  const renderWedgeChainShapes = (el, scale, offsetAmount, stitchType, stitchIndex) =>
    renderWedgePathShapes(el.paths, el.stitchCount, stitchIndex, scale, offsetAmount, stitchType);

  const scale = dsWidth / 0.4; // calculateStitchScale inlined (see extraction plan) — 0.4 normalized units = 1 DS width, see WEDGE_SHAPES comment above
  const offsetAmount = dsWidth * OFFSET_DS_FRACTION + OFFSET_BASE_PADDING;

    // ── bounds tracking ──
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const expand = (x: number, y: number) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };

    // ── shared picot helpers ──────────────────────────────────────────────────
    const shouldSkipPicot = (picot: any, elId: string): boolean => {
      if (picot.isGuidePoint) return true;
      if (picot.beadType) return true;
      // cj (core join, no arm) — nothing to render
      if (picot.isCoreJoin && !picot.hasPicotArm) return true;
      // cjp (core join + arm) — render the arm, don't skip
      if (picot.isCoreJoin && picot.hasPicotArm) return false;
      // For all other picots (regular, jp): skip if they appear in any connection.
      // Checks picotConnections directly rather than relying on isJoint flag,
      // so a stale/missing flag doesn't cause double-rendering.
      return picotConnections.some(conn =>
        conn.picots.some(cp => cp.elementId === elId && cp.picotId === picot.id)
      );
    };

    const emitPicot = (
      bL: {x:number,y:number}, bR: {x:number,y:number},
      tip: {x:number,y:number}, color: string, lw: number
    ): string => {
      const cpx = 2 * tip.x - 0.5 * (bL.x + bR.x);
      const cpy = 2 * tip.y - 0.5 * (bL.y + bR.y);
      const d = `M ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${bR.x.toFixed(2)} ${bR.y.toFixed(2)}`;
      expand(bL.x, bL.y); expand(tip.x, tip.y); expand(bR.x, bR.y);
      return `<path d="${d}" stroke="black" stroke-width="${lw + 2}" fill="none" stroke-linecap="round"/>` +
             `<path d="${d}" stroke="${color}" stroke-width="${lw}" fill="none" stroke-linecap="round"/>`;
    };

    // ── per-element SVG fragments ──
    const fragments: string[] = [];

    for (const el of elements) {
      const elColor = getElementColor(el);

      // ── helper: picot SVG for a path element ──
      const picotSVG = (totalPathLength: any): string => {
        if (!el.picots) return '';
        const picotSideDir = el.picotSideMultiplier || 1;
        const N = el.stitchCount;
        let out = '';
        for (const picot of el.picots) {
          // cjp: core join with picot arm — render arm in realistic mode
          if (picot.isJoint && picot.isCoreJoin && picot.hasPicotArm) {
            const tMid   = picot.stitchesBefore / N;
            const tLeft  = Math.max(0, (picot.stitchesBefore - PICOT_GAP_HALF_WIDTH_DS) / N);
            const tRight = Math.min(1, (picot.stitchesBefore + PICOT_GAP_HALF_WIDTH_DS) / N);
            const tipH   = (PICOT_TIP_LENGTH_DS[picot.length] || PICOT_TIP_LENGTH_DEFAULT) * dsWidth;
            const ptAt = (frac: number) =>
              getPointAndAngleAtDistanceFast(
                totalPathLength.allSamples,
                totalPathLength.pathLengths,
                frac * totalPathLength.totalLength
              );
            const ptMid   = ptAt(tMid);
            const ptLeft  = ptAt(tLeft);
            const ptRight = ptAt(tRight);
            let nx: number, ny: number;
            const isHalfway = el.isClosed && Math.abs(picot.stitchesBefore - N / 2) < 1.5;
            if (isHalfway) {
              const ptJoin = ptAt(0);
              const ax = ptMid.x - ptJoin.x, ay = ptMid.y - ptJoin.y;
              const al = Math.sqrt(ax*ax + ay*ay) || 1;
              nx = (ax / al) * picotSideDir;
              ny = (ay / al) * picotSideDir;
            } else {
              nx =  Math.sin(ptMid.angle) * picotSideDir;
              ny = -Math.cos(ptMid.angle) * picotSideDir;
            }
            const bL  = { x: ptLeft.x,  y: ptLeft.y  };
            const bR  = { x: ptRight.x, y: ptRight.y };
            const tip = { x: ptMid.x + nx * tipH, y: ptMid.y + ny * tipH };
            const cpx = 2 * tip.x - 0.5 * (bL.x + bR.x);
            const cpy = 2 * tip.y - 0.5 * (bL.y + bR.y);
            const cjColor = elColor.isGradient
              ? getGradientColorAtPosition(elColor.id, tMid)
              : elColor.color;
            const lw = el.lineWidth || 2;
            const d = `M ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${bR.x.toFixed(2)} ${bR.y.toFixed(2)}`;
            expand(bL.x, bL.y); expand(tip.x, tip.y); expand(bR.x, bR.y);
            out += `<path d="${d}" stroke="black" stroke-width="${lw + 2}" fill="none" stroke-linecap="round"/>`;
            out += `<path d="${d}" stroke="${cjColor}" stroke-width="${lw}" fill="none" stroke-linecap="round"/>`;
            continue;
          }
          if (shouldSkipPicot(picot, el.id)) continue;
          const tMid   = picot.stitchesBefore / N;
          const tLeft  = Math.max(0, (picot.stitchesBefore - PICOT_GAP_HALF_WIDTH_DS) / N);
          const tRight = Math.min(1, (picot.stitchesBefore + PICOT_GAP_HALF_WIDTH_DS) / N);
          const tipH   = (PICOT_TIP_LENGTH_DS[picot.length] || PICOT_TIP_LENGTH_DEFAULT) * dsWidth;

          const ptAt = (frac: number) =>
            getPointAndAngleAtDistanceFast(
              totalPathLength.allSamples,
              totalPathLength.pathLengths,
              frac * totalPathLength.totalLength
            );

          const ptMid   = ptAt(tMid);
          const ptLeft  = ptAt(tLeft);
          const ptRight = ptAt(tRight);

          let nx: number, ny: number;
          const isHalfway = el.isClosed && Math.abs(picot.stitchesBefore - N / 2) < 1.5;
          if (isHalfway) {
            const ptJoin = ptAt(0);
            const ax = ptMid.x - ptJoin.x, ay = ptMid.y - ptJoin.y;
            const al = Math.sqrt(ax*ax + ay*ay) || 1;
            nx = (ax / al) * picotSideDir;
            ny = (ay / al) * picotSideDir;
          } else {
            nx =  Math.sin(ptMid.angle) * picotSideDir;
            ny = -Math.cos(ptMid.angle) * picotSideDir;
          }

          const bL  = { x: ptLeft.x,  y: ptLeft.y  };
          const bR  = { x: ptRight.x, y: ptRight.y };
          const tip = { x: ptMid.x + nx * tipH, y: ptMid.y + ny * tipH };
          const cpx = 2 * tip.x - 0.5 * (bL.x + bR.x);
          const cpy = 2 * tip.y - 0.5 * (bL.y + bR.y);

          const picotColor = elColor.isGradient
            ? getGradientColorAtPosition(elColor.id, tMid)
            : elColor.color;
          const lw = el.lineWidth || 2;
          const d = `M ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${bR.x.toFixed(2)} ${bR.y.toFixed(2)}`;

          expand(bL.x, bL.y); expand(tip.x, tip.y); expand(bR.x, bR.y);

          out += `<path d="${d}" stroke="black" stroke-width="${lw + 2}" fill="none" stroke-linecap="round"/>`;
          out += `<path d="${d}" stroke="${picotColor}" stroke-width="${lw}" fill="none" stroke-linecap="round"/>`;
        }
        return out;
      };

      // ── stitch buckets → merged paths per color ──
      const stitchesToSVG = (stitches: any[], isCircle: boolean, isSplitRing = false): string => {
        if (!stitches || stitches.length === 0) return '';
        const buckets = new Map<string, string[]>();
        const strokeW = 0.05 * scale;

        for (let i = 0; i < stitches.length; i++) {
          const stitch = stitches[i];
          const stitchTypes = Array.isArray(stitch.type) ? stitch.type : [stitch.type];
          for (let subIdx = 0; subIdx < stitchTypes.length; subIdx++) {
            const type = stitchTypes[subIdx];
            const dsPos = stitch.dsPosition ?? i;
            const effectiveIndex = stitchTypes.length > 1
              ? dsPos + (subIdx / stitchTypes.length)
              : dsPos;

            let wedgePaths: string[];
            if (isCircle) {
              wedgePaths = renderWedgeRingShapes(stitch, el, scale, offsetAmount, type);
            } else if (isSplitRing) {
              wedgePaths = renderWedgeSplitRingShapes(el, scale, offsetAmount, type, i);
            } else if (el.isClosed) {
              wedgePaths = renderWedgeTeardropShapes(el, scale, offsetAmount, type, effectiveIndex);
            } else {
              wedgePaths = renderWedgeChainShapes(el, scale, offsetAmount, type, effectiveIndex);
            }

            const existing = buckets.get(stitch.color) || [];
            buckets.set(stitch.color, existing.concat(wedgePaths));

            // expand bounds from stitch positions
            expand(stitch.x - dsWidth, stitch.y - dsWidth);
            expand(stitch.x + dsWidth, stitch.y + dsWidth);
          }
        }

        let out = '';
        for (const [color, dParts] of buckets.entries()) {
          const d = dParts.filter(Boolean).join(' ');
          if (d) out += `<path d="${d}" fill="${color}" stroke="black" stroke-width="${strokeW.toFixed(3)}" stroke-linejoin="miter"/>`;
        }
        return out;
      };

      let frag = '';

      if (el.isClosed && el.shapeStyle === 'circle') {
        // ── circle ring ──
        const stitches = calculateCircleStitches(el);
        const r = el.stitchCount * dsWidth / (2 * Math.PI);
        expand(el.center.x - r - dsWidth*2, el.center.y - r - dsWidth*2);
        expand(el.center.x + r + dsWidth*2, el.center.y + r + dsWidth*2);

        // ── picots first so they render underneath stitches ──
        if (el.picots?.length) {
          const N = el.stitchCount;
          const picotSideDir = el.picotSideMultiplier || 1;
          let out = '';
          for (const picot of el.picots) {
            if (shouldSkipPicot(picot, el.id)) continue;
            const tipH   = (PICOT_TIP_LENGTH_DS[picot.length] || PICOT_TIP_LENGTH_DEFAULT) * dsWidth;
            const tMid   = picot.stitchesBefore / N;
            const tLeft  = Math.max(0, (picot.stitchesBefore - PICOT_GAP_HALF_WIDTH_DS) / N);
            const tRight = Math.min(1, (picot.stitchesBefore + PICOT_GAP_HALF_WIDTH_DS) / N);
            // t is a stitch-progress fraction (0-1), same role as
            // stitchesBefore/stitchCount — pass it through as N*t so this
            // goes through the same flip-aware formula as everywhere else.
            const angleOf = (t: number) => getCircleStitchAngle(el, t * N);
            const ptOn    = (t: number) => ({
              x: el.center.x + Math.cos(angleOf(t)) * r,
              y: el.center.y + Math.sin(angleOf(t)) * r,
            });
            const bL  = ptOn(tLeft);
            const bR  = ptOn(tRight);
            const mx  = ptOn(tMid);
            const tip = {
              x: mx.x + Math.cos(angleOf(tMid)) * picotSideDir * tipH,
              y: mx.y + Math.sin(angleOf(tMid)) * picotSideDir * tipH,
            };
            const color = elColor.isGradient
              ? getGradientColorAtPosition(elColor.id, tMid)
              : elColor.color;
            out += emitPicot(bL, bR, tip, color, el.lineWidth || 2);
          }
          frag += out;
        }
        // ── stitches after picots so they render on top ──
        frag += stitchesToSVG(stitches, true);

      } else if (el.isSplitRing) {
        // ── split ring ──
        const cached = calculateSplitRingStitches(el);
        for (const path of el.paths || []) {
          const pts = sampleBezierPath(path, 20);
          for (const pt of pts) expand(pt.x, pt.y);
        }

        // ── picots for split ring — emitted BEFORE stitches so they sit underneath ──
        if (el.picots?.length && el.paths?.[0] && el.paths?.[1]) {
          const splitPos = el.splitPosition || Math.floor(el.stitchCount / 2);
          const countA = splitPos;
          const countB = el.stitchCount - splitPos;
          const picotSideDir = el.picotSideMultiplier || 1;
          const samplesA = sampleBezierPath(el.paths[0], 60);
          const samplesB = sampleBezierPath(el.paths[1], 60);
          const lenA = calculatePathLength(samplesA);
          const lenB = calculatePathLength(samplesB);
          const lw = el.lineWidth || 2;
          // Same side/color split already used for stitch fill above (bug
          // fix, session 52 — picot color previously always used side A's
          // material/gradient regardless of which side the picot was
          // actually on; the side itself was already being derived
          // correctly for position/gradient sampling below via `inA`, just
          // never applied to color selection).
          const elColorA = getElementColor(el);
          const elColorB = getElementColor({ ...el, materialId: el.materialIdB || el.materialId });

          // Walk a pre-computed sample array to find position at fractional distance
          // Defined once outside the picot loop — not recreated per picot
          const ptAtFrac = (samples: any[], pathLen: number, frac: number) => {
            const target = frac * pathLen;
            let accum = 0;
            for (let i = 1; i < samples.length; i++) {
              const seg = Math.hypot(
                samples[i].x - samples[i-1].x,
                samples[i].y - samples[i-1].y
              );
              if (accum + seg >= target) {
                const lt = (target - accum) / seg;
                return {
                  x: samples[i-1].x + lt * (samples[i].x - samples[i-1].x),
                  y: samples[i-1].y + lt * (samples[i].y - samples[i-1].y),
                  angle: Math.atan2(
                    samples[i].y - samples[i-1].y,
                    samples[i].x - samples[i-1].x
                  ),
                };
              }
              accum += seg;
            }
            const last = samples[samples.length - 1];
            const prev = samples[samples.length - 2] ?? last;
            return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
          };

          let out = '';
          for (const picot of el.picots) {
            if (shouldSkipPicot(picot, el.id)) continue;
            const inA = picot.stitchesBefore <= splitPos;
            const localCount = inA ? countA : countB;
            if (localCount <= 0) continue; // degenerate split — skip
            const localSb = inA ? picot.stitchesBefore : picot.stitchesBefore - splitPos;
            const samples = inA ? samplesA : samplesB;
            const pathLen = inA ? lenA : lenB;
            const tMid   = localSb / localCount;
            const tLeft  = Math.max(0, (localSb - PICOT_GAP_HALF_WIDTH_DS) / localCount);
            const tRight = Math.min(1, (localSb + PICOT_GAP_HALF_WIDTH_DS) / localCount);
            const tipH   = (PICOT_TIP_LENGTH_DS[picot.length] || PICOT_TIP_LENGTH_DEFAULT) * dsWidth;
            const ptMid   = ptAtFrac(samples, pathLen, tMid);
            const ptLeft  = ptAtFrac(samples, pathLen, tLeft);
            const ptRight = ptAtFrac(samples, pathLen, tRight);
            const nx =  Math.sin(ptMid.angle) * picotSideDir;
            const ny = -Math.cos(ptMid.angle) * picotSideDir;
            const bL  = { x: ptLeft.x,  y: ptLeft.y  };
            const bR  = { x: ptRight.x, y: ptRight.y };
            const tip = { x: ptMid.x + nx * tipH, y: ptMid.y + ny * tipH };
            const elColor = inA ? elColorA : elColorB;
            const color = elColor.isGradient
              ? getGradientColorAtPosition(elColor.id, tMid)
              : elColor.color;
            out += emitPicot(bL, bR, tip, color, lw);
          }
          frag += out;
        }
        // ── stitches after picots so they render on top ──
        frag += stitchesToSVG(cached, false, true);

      } else if (effectiveElementType(el) === 'chain' || effectiveElementType(el) === 'ring') {
        // ── path element (chain / teardrop ring) ──
        const cached = calculatePathStitches(el);
        const stitches = cached?.stitches ?? cached;
        if (stitches && stitches.length > 0) {
          const allSamples = (el.paths || []).map((p: any) => sampleBezierPath(p, 50));
          const pathLengths = allSamples.map((s: any[]) => calculatePathLength(s));
          const totalLength = pathLengths.reduce((a: number, b: number) => a + b, 0);
          const totalPathLength = { allSamples, pathLengths, totalLength };

          // expand bounds from path
          for (const path of el.paths || []) {
            const pts = sampleBezierPath(path, 20);
            for (const pt of pts) expand(pt.x, pt.y);
          }

          frag += picotSVG(totalPathLength);
          frag += stitchesToSVG(stitches, false);
        }

      } else if (effectiveElementType(el) === 'line') {
        // ── line element — simple stroke ──
        const elStroke = elColor.isGradient
          ? getGradientColorAtPosition(elColor.id, 0.5)
          : elColor.color;
        for (const path of el.paths || []) {
          let d: string;
          if (path.type === 'cubic') {
            d = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
          } else {
            d = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
          }
          frag += `<path d="${d}" fill="none" stroke="black" stroke-width="${(el.lineWidth || 2) + 2}" stroke-linecap="round"/>`;
          frag += `<path d="${d}" fill="none" stroke="${elStroke}" stroke-width="${el.lineWidth || 2}" stroke-linecap="round"/>`;
          const pts = sampleBezierPath(path, 20);
          for (const pt of pts) expand(pt.x, pt.y);
        }
      }

      if (frag) fragments.push(frag);
    }

    // ── fallback bounds ──
    if (!isFinite(minX)) { minX = -100; minY = -100; maxX = 100; maxY = 100; }
    const PAD = dsWidth * 3;
    minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
    const W = maxX - minX, H = maxY - minY;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}">${fragments.join('')}</svg>`;
    return svg;
}
