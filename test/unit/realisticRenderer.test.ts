// render/realisticRenderer.ts — the realistic view's baked SVG text.
//  - review #23: split-ring side A's gradient runs from the shared start;
//  - layers (session 63): each element's pieces sit in <g data-el="i">;
//  - frozen baselines: the bake of fixed patterns must not change unless a
//    change is meant (refactors: "same behaviour — prove it").
//
// A baseline that changes ON PURPOSE is updated with:  npm run test:update
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bakeRealisticView } from '../../src/render/realisticRenderer';
import { getStitchTypes } from '../../src/domain/parser';
import * as P from '../../src/geometry/paths';
import { baseElements, bake, makeRng, randomPattern, DS } from './helpers/patterns';
import { checkBaseline } from '../helpers/baseline';

const baseline = (name: string, text: string) => {
  const r = checkBaseline(fileURLToPath(new URL(`./baselines/${name}`, import.meta.url)), text);
  expect(r.ok, r.message).toBe(true);
};

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

describe('split-ring gradient (review #23)', () => {
  it('side A runs from the shared start, in notation order; side B as before; the picot at its notation place', () => {
    // side A: 2rds-p-5ds = 8 slots, picot at notation slot 3 (stored 8 − 3 = 5); side B: 4ds
    const sr = { id: 'sr', type: 'ring', endAllowance: 0.375, materialId: 'g', materialIdB: 'g', center: { x: 100, y: 300 }, rotation: 0,
      stitchCount: 12, color: '#FFFFFF', picots: [{ id: 'pa', stitchesBefore: 5, length: 'medium', isJoint: false }],
      notation: 'sr: 2rds-p-5ds', notationB: '4ds', labelOffset: 8, squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75, splitPosition: 8,
      picotSideMultiplier: 1, isSplitRing: true, lineWidth: 2, ...P.createSplitRingPath(100, 300, 8, 4, DS, 0.25, 0.75, 0.75, 0.375) };
    const asked: number[] = [];
    bakeRealisticView({ elements: [sr], dsWidth: DS, picotConnections: [],
      getElementColor: () => ({ isGradient: true, id: 'g' }),
      getGradientColorAtPosition: (_id: string, pos: number) => { asked.push(pos); return '#123456'; },
      getStitchTypes } as any);
    expect(asked).toEqual([
      0, 1.5 / 8,                               // side A: 2 rds (1.5 slots each) from the shared start
      3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8,        // side A: 5 ds
      0, 1 / 4, 2 / 4, 3 / 4,                   // side B: 4 ds
      3 / 8,                                    // side A's picot, at notation slot 3
    ]);
  });
});

describe('element groups for the SVG export layers (session 63)', () => {
  it('wraps each element in <g data-el="i">, i = its place in the list', () => {
    const svg = bake(baseElements());
    const tags = [...svg.matchAll(/<g data-el="(\d+)">/g)].map(m => Number(m[1]));
    expect(tags.length).toBeGreaterThan(0);
    expect([...new Set(tags)].sort((a, b) => a - b)).toEqual(tags.slice().sort((a, b) => a - b)); // each at most once
    expect(Math.max(...tags)).toBeLessThan(baseElements().length);
    expect((svg.match(/<g data-el=/g) || []).length).toBe((svg.match(/<\/g>/g) || []).length);
  });
});

describe('frozen baselines — the realistic bake', () => {
  it('one element of every kind, with a join (full text)', () => {
    const els = baseElements();
    els[0].picots[0].isJoint = true; els[1].picots[0].isJoint = true;
    const svg = bake(els, DS, [{ id: 'c1', picots: [{ elementId: 'tear', picotId: 'p6' }, { elementId: 'circ', picotId: 'p6' }] }]);
    baseline('realistic-every-kind.svg.txt', svg.replace(/></g, '>\n<'));
  });
  it('300 random patterns at three thread sizes (fingerprints)', () => {
    const rng = makeRng(20261112);
    const lines: string[] = [];
    for (let k = 0; k < 300; k++) {
      const ds = [6, 10, 14][k % 3];
      const els = randomPattern(rng, ds);
      const svg = bake(els, ds);
      expect(svg.includes('NaN'), `case ${k}`).toBe(false);
      lines.push(`${String(k).padStart(3, '0')} ds=${ds} elements=${els.length} chars=${svg.length} ${sha(svg)}`);
    }
    baseline('realistic-random-300.txt', lines.join('\n') + '\n');
  });
  it('the bake does not change its input', () => {
    const els = baseElements(); const before = JSON.stringify(els);
    bake(els);
    expect(JSON.stringify(els)).toBe(before);
  });
  it('the same input always gives the same text', () => {
    expect(bake(baseElements())).toBe(bake(baseElements()));
  });
});
