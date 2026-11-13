// Shared test data for the unit tests: one sound element of every kind, a
// seeded random-pattern generator, and a bake helper. Everything is
// deterministic (no Math.random, no dates), so a failing case can be rerun.
import { bakeRealisticView } from '../../../src/render/realisticRenderer';
import { getStitchTypes } from '../../../src/domain/parser';
import * as P from '../../../src/geometry/paths';

export const DS = 10;

const pic = (sb: number, extra: any = {}) => ({
  id: 'p' + sb, stitchesBefore: sb, length: 'medium', isJoint: false,
  isGuide: false, isGuidePoint: false, beadType: null, ...extra,
});

/** One sound element of each kind: tear, circ, jk, sr, chain, line, ghost. */
export const baseElements = (): any[] => {
  const tear = { id: 'tear', type: 'ring', endAllowance: 1.5, materialId: 'default', center: { x: 100, y: 100 }, rotation: 30, stitchCount: 12, color: '#FFFFFF',
    picots: [pic(6), pic(3, { picotKind: 'cjp' })], notation: 'r: 3ds-cjp-3ds-p-6ds', labelOffset: 8, squeeze: 0, picotSideMultiplier: 1, lineWidth: 2, ...P.createTeardropPath(100, 100, 15 * DS, 0) };
  const circ = { id: 'circ', type: 'ring', materialId: 'default', center: { x: 300, y: 100 }, rotation: 0, stitchCount: 12, color: '#FFFFFF', shapeStyle: 'circle',
    picots: [pic(6)], notation: 'r: 6ds-p-6ds', labelOffset: 8, squeeze: 0, picotSideMultiplier: 1, lineWidth: 2, ...P.createCirclePath(300, 100, 12 * DS, 0) };
  const jk = { ...JSON.parse(JSON.stringify(circ)), id: 'jk', notation: 'jk: 12ss', picots: [], center: { x: 500, y: 100 } };
  const sr = { id: 'sr', type: 'ring', endAllowance: 0.375, materialId: 'default', materialIdB: 'default', center: { x: 100, y: 300 }, rotation: 0, stitchCount: 12, color: '#FFFFFF', colorB: '#FFFFFF',
    picots: [pic(3), pic(9)], notation: 'sr: 3ds-p-3ds', notationB: '3ds-p-3ds', labelOffset: 8, squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75, splitPosition: 6,
    picotSideMultiplier: 1, isSplitRing: true, lineWidth: 2, ...P.createSplitRingPath(100, 300, 6, 6, DS, 0.25, 0.75, 0.75, 0.375) };
  const chain = { id: 'chain', type: 'chain', endAllowance: 0, materialId: 'default', center: { x: 300, y: 300 }, isClosed: false, shapeStyle: 'chain', rotation: 0,
    paths: [{ type: 'cubic', x: 245, y: 300, control1X: 282, control1Y: 263, control2X: 318, control2Y: 263, endX: 355, endY: 300 }],
    stitchCount: 12, color: '#FFFFFF', picots: [pic(6)], notation: 'c: 6ds-p-6ds', labelOffset: 8, picotSideMultiplier: 1, lineWidth: 2 };
  const line = { id: 'line', type: 'line', materialId: 'default', center: { x: 500, y: 300 }, isClosed: false, rotation: 0,
    paths: [{ type: 'cubic', x: 400, y: 300, control1X: 466, control1Y: 300, control2X: 534, control2Y: 300, endX: 600, endY: 300 }], color: '#FFFFFF', notation: 'line', lineWidth: 2 };
  const ghost = { ...JSON.parse(JSON.stringify(circ)), id: 'ghost', type: 'ghost', sourceType: 'ring', isGhost: true, center: { x: 700, y: 100 } };
  return [tear, circ, jk, sr, chain, line, ghost];
};

export const bake = (elements: any[], dsWidth: any = DS, picotConnections: any[] = []) => bakeRealisticView({
  elements, dsWidth, picotConnections,
  getElementColor: (e: any) => ({ isGradient: false, color: e.color }),
  getGradientColorAtPosition: () => '#fff',
  getStitchTypes,
} as any);

/** Seeded random numbers (LCG) — the same sequence on every run. */
export const makeRng = (seed0: number) => {
  let seed = seed0 >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const pick = <T,>(list: T[]): T => list[int(0, list.length - 1)];
  return { rnd, int, pick };
};

const NOTATIONS = ['3ds-p-3ds', '2rds-p-6ds', '4ss-p-4ss-lp-2ds', '5ds-sp-2ds-p-2ds-p-5ds', '6ds', '2ds-cjp-4ds-p-2ds', '3*(2ds-p)-2ds'];

/** A random but sound pattern of 1–6 elements (every kind can appear). */
export const randomPattern = (rng: ReturnType<typeof makeRng>, ds: number): any[] => {
  const { rnd, int, pick } = rng;
  const els: any[] = [];
  const count = int(1, 6);
  for (let i = 0; i < count; i++) {
    const kind = int(0, 5), cx = int(-400, 900) + rnd(), cy = int(-400, 900) + rnd(), sc = int(4, 30);
    const picots = Array.from({ length: int(0, 4) }, (_, k) => ({ id: 'p' + i + k, stitchesBefore: int(0, sc), length: pick(['small', 'medium', 'long']), isJoint: rnd() < 0.3, picotKind: rnd() < 0.2 ? 'cjp' : undefined }));
    const common = { id: 'e' + i, materialId: 'default', center: { x: cx, y: cy }, rotation: int(0, 359), stitchCount: sc, color: pick(['#FFFFFF', '#ff0000', 'rgb(1,2,3)']), picots, notation: 'r: ' + pick(NOTATIONS), picotSideMultiplier: rnd() < 0.5 ? 1 : -1, lineWidth: int(1, 5) };
    if (kind === 0) els.push({ ...common, type: 'ring', endAllowance: rnd() * 3, squeeze: rnd(), ...P.createTeardropPath(cx, cy, (sc + 3) * ds, rnd() * 0.5) });
    else if (kind === 1) els.push({ ...common, type: 'ring', shapeStyle: 'circle', ...P.createCirclePath(cx, cy, sc * ds, 0) });
    else if (kind === 2) els.push({ ...common, type: 'ring', shapeStyle: 'circle', notation: 'jk: ' + sc + 'ss', picots: [], ...P.createCirclePath(cx, cy, sc * ds, 0) });
    else if (kind === 3) { const a = int(2, 12), b = int(2, 12); els.push({ ...common, type: 'ring', isSplitRing: true, stitchCount: a + b, splitPosition: a, notation: 'sr: ' + a + 'ds', notationB: b + 'ds', picots: [], endAllowance: 0.375, ...P.createSplitRingPath(cx, cy, a, b, ds, 0.25, 0.75, 0.75, 0.375) }); }
    else if (kind === 4) els.push({ ...common, type: 'chain', isClosed: false, shapeStyle: 'chain', notation: 'c: ' + pick(NOTATIONS), paths: [{ type: 'cubic', x: cx - 50, y: cy, control1X: cx - 20, control1Y: cy - int(5, 60), control2X: cx + 20, control2Y: cy - int(5, 60), endX: cx + 50, endY: cy }] });
    else els.push({ id: 'e' + i, type: 'line', materialId: 'default', center: { x: cx, y: cy }, isClosed: false, color: '#00ff00', notation: 'line', lineWidth: int(1, 6), paths: [{ type: 'cubic', x: cx - 80, y: cy, control1X: cx - 30, control1Y: cy + int(-40, 40), control2X: cx + 30, control2Y: cy + int(-40, 40), endX: cx + 80, endY: cy }] });
  }
  return els;
};

/** Every leaf path of an object, e.g. ['center','x'] or ['paths',0,'endX']. */
export const leafPaths = (o: any, pre: (string | number)[] = []): (string | number)[][] => {
  const out: (string | number)[][] = [];
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === 'object') out.push(...leafPaths(v, [...pre, k])); else out.push([...pre, k]);
  }
  return out;
};
export const setAt = (o: any, path: (string | number)[], v: any) => {
  let c = o;
  for (let i = 0; i < path.length - 1; i++) c = c[path[i]];
  c[path[path.length - 1]] = v;
};
