// domain/parser.ts — the notation parser. The big table is in
// parser.cases.ts; this file runs it and tests the helper functions.
import { describe, it, expect } from 'vitest';
import * as Pz from '../../src/domain/parser';
import { NOTATION_CASES, NOTATION_QUIRKS, type NotationCase, type PicotSummary } from './parser.cases';

export const summarize = (p: any): PicotSummary => {
  const o: PicotSummary = { at: p.stitchesBefore };
  if (p.length === 'small' || p.length === 'large') o.size = p.length;
  if (p.isJoint) o.joins = true;
  if (p.isGuide) o.guide = true;
  if (p.isGuidePoint) o.guidePoint = true;
  if (p.isCoreJoin) o.coreJoin = true;
  if (p.hasPicotArm) o.arm = true;
  if (p.beadType != null) o.bead = p.beadType;
  if (p.beadSeq != null) o.beads = p.beadSeq;
  if (p.beadSize != null) o.beadSize = p.beadSize;
  if (p.coreSize != null) o.core = p.coreSize;
  return o;
};

const runCase = (c: NotationCase) => {
  const parsed = Pz.parseNotation(c.notation, true);
  if (c.stitches === null) expect(parsed, 'should be refused').toBeNull();
  else {
    expect(parsed, 'should parse').not.toBeNull();
    expect(parsed!.type).toBe(c.type);
    expect(parsed!.stitchCount).toBe(c.stitches);
    expect(parsed!.isSplitChain).toBe(!!c.splitChain);
    expect(parsed!.picots.map(summarize)).toEqual(c.picots);
  }
  expect(Pz.isNotationValid(c.notation), 'isNotationValid').toBe(c.valid);
  if (c.count !== undefined) expect(Pz.countActualStitches(c.notation), 'countActualStitches').toBe(c.count);
};

describe('parseNotation — the notation table', () => {
  it.each(NOTATION_CASES.map(c => [c.notation, c.note, c] as const))('%s  (%s)', (_n, _note, c) => runCase(c));
});
describe('parseNotation — behaviour to confirm with the user (pinned as it is today)', () => {
  it.each(NOTATION_QUIRKS.map(c => [c.notation, c.note, c] as const))('%s  (%s)', (_n, _note, c) => runCase(c));
});

describe('parseNotation — general', () => {
  it('gives every picot its own id', () => {
    const r = Pz.parseNotation('r: 5*(2ds-p)-2ds', true)!;
    expect(new Set(r.picots.map(p => p.id)).size).toBe(5);
  });
  it('a plain picot has every flag off', () => {
    const p = Pz.parseNotation('r: 3ds-p-3ds', true)!.picots[0];
    expect(p).toMatchObject({ stitchesBefore: 3, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null });
  });
  it('a bead element starts as an empty core structure', () => {
    const p = Pz.parseNotation('r: 3ds-be-3ds', true)!.picots[0];
    expect(p).toMatchObject({ beadType: 'be', beStructure: 'core', beIsJoint: false, coreBeads: [null, null, null], picotBeads: [null, null, null] });
  });
  it('reports errors through onError, and not at all when silent', () => {
    const msgs: (string | null)[] = [];
    expect(Pz.parseNotation('r: 3ds-foo', false, m => msgs.push(m))).toBeNull();
    expect(msgs).toEqual([null, 'Unknown element: foo']);
    const quiet: any[] = [];
    Pz.parseNotation('r: 3ds-foo', true, m => quiet.push(m));
    Pz.parseNotation('nope', true, m => quiet.push(m));
    expect(quiet).toEqual([]);
    const fmt: any[] = [];
    Pz.parseNotation('nope', false, m => fmt.push(m));
    expect(fmt).toEqual([null, 'Invalid format']);
    const jk: any[] = [];
    Pz.parseNotation('jk: 3ds', false, m => jk.push(m));
    expect(jk).toEqual([null, 'Josephine Knot only accepts ss stitches: 3ds']);
  });
  it('picot positions never run backwards and never pass the stitch count', () => {
    for (const c of [...NOTATION_CASES, ...NOTATION_QUIRKS]) {
      const r = Pz.parseNotation(c.notation, true);
      if (!r) continue;
      let last = 0;
      for (const p of r.picots) {
        expect(p.stitchesBefore, c.notation).toBeGreaterThanOrEqual(last);
        expect(p.stitchesBefore, c.notation).toBeLessThanOrEqual(r.stitchCount);
        last = p.stitchesBefore;
      }
    }
  });
});

describe('bcjp parses like bcp, except that its picot joins (session 63)', () => {
  const strip = (r: any, kind: string) => ({ ...r, picots: r.picots.map(({ id, ...p }: any) =>
    p.beadType === kind ? { ...p, beadType: 'X', isJoint: 'X' } : p) });
  it.each(['r: 6ds-X-6ds', 'r: 4ds-X:ZZ-4ds', 'c: 2ds-p-3ds-X-1ds-X:YZY-2ds', 'r: 2rds-X-1ss-p-3ds', 'r: 3*(2ds-X)-2ds'])('%s', tpl => {
    const a = Pz.parseNotation(tpl.replace(/X/g, 'bcp:Y'), true)!, b = Pz.parseNotation(tpl.replace(/X/g, 'bcjp:Y'), true)!;
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect(strip(b, 'bcjp')).toEqual(strip(a, 'bcp'));
    for (const p of b.picots.filter(p => p.beadType === 'bcjp')) expect(p).toMatchObject({ isJoint: true, coreSize: 'Y' });
    for (const p of a.picots.filter(p => p.beadType === 'bcp')) expect(p.isJoint).toBe(false);
    expect(Pz.getStitchTypes(tpl.replace(/X/g, 'bcjp:Y'))).toEqual(Pz.getStitchTypes(tpl.replace(/X/g, 'bcp:Y')));
    expect(Pz.countActualStitches(tpl.replace(/X/g, 'bcjp:Y'))).toBe(Pz.countActualStitches(tpl.replace(/X/g, 'bcp:Y')));
  });
  it('split ring side A: stored at the same place as bcp', () => {
    const sideA = (x: string) => { const r = Pz.parseNotation(`sr: 2ds-${x}-3ds`, true)!; return r.picots.map(p => Pz.splitRingSideAPosition(p, r.stitchCount)); };
    expect(sideA('bcjp:Y')).toEqual(sideA('bcp:Y'));
    expect(sideA('bcjp:Y')).toEqual([3]);
  });
});

describe('isZeroWidth / isSlotBead', () => {
  it('picots and beads are zero-width tokens; stitches are not', () => {
    for (const t of ['p', 'sp', 'cp', 'lp', 'jp', 'jpg', 'bjp', 'cj', 'cjp', 'gp', '2p', 'be', 'BE', 'bc:Y', 'bp:Y', 'bcp:Y', 'bcjp:Y', 'bcjp:Z:YY', 'sb:Y', 'bjp:Y', ' P ']) expect(Pz.isZeroWidth(t), t).toBe(true);
    for (const t of ['ds', '3ds', 'ss', 'rds', 'foo', '']) expect(Pz.isZeroWidth(t), t).toBe(false);
  });
  it('old-style bp / bp1 are NOT in the zero-width list (as it is today)', () => {
    expect(Pz.isZeroWidth('bp')).toBe(false);
    expect(Pz.isZeroWidth('bp1')).toBe(false);
  });
  it('slot beads: bc, bcp, bcjp, be', () => {
    for (const t of ['bc', 'bcp', 'bcjp', 'be']) expect(Pz.isSlotBead({ beadType: t }), t).toBe(true);
    for (const t of ['bp', 'bjp', 'sb', 'default', null, undefined]) expect(Pz.isSlotBead({ beadType: t }), String(t)).toBe(false);
    expect(Pz.isSlotBead(null)).toBe(false);
  });
});

describe('expandTokens / normalizeNotationInput', () => {
  it.each([
    ['3ds-p-3ds', ['3ds', 'p', '3ds']],
    ['2*(2ds-p)-1ds', ['2ds', 'p', '2ds', 'p', '1ds']],
    ['(2ds-p)x2', ['2ds', 'p', '2ds', 'p']],
    ['2*(1ds-2*(p-1ds))', ['1ds', 'p', '1ds', 'p', '1ds', '1ds', 'p', '1ds', 'p', '1ds']],
    ['2ds-(p-2ds)', ['2ds', 'p', '2ds']],
    ['3ds space p', ['3ds', 'p']],
    ['3d-p-3d', ['3ds', 'p', '3ds']],
  ])('expandTokens(%j)', (input, expected) => { expect(Pz.expandTokens(input)).toEqual(expected); });
  it.each([
    ['r: 3d p 3d', 'r: 3ds-p-3ds'],
    ['R:3ds  -  p.3ds', 'R: 3ds-p-3ds'],
    ['c:5d', 'c: 5ds'],
    ['sr: 2ds-(p-2ds)', 'sr: 2ds-p-2ds'],
    ['r: 3ds', 'r: 3ds'],
    ['nope 3d', 'nope 3d'],
  ])('normalizeNotationInput(%j) → %j', (input, expected) => { expect(Pz.normalizeNotationInput(input)).toBe(expected); });
  it('tidying is stable: doing it twice changes nothing more', () => {
    for (const c of NOTATION_CASES) {
      const once = Pz.normalizeNotationInput(c.notation);
      expect(Pz.normalizeNotationInput(once), c.notation).toBe(once);
    }
  });
});

describe('reverseNotation', () => {
  it.each([
    ['r: 3ds-p-5ds', 'r: 5ds-p-3ds'],
    ['c: 2ds-lp-3*(1ds-p)-4ds', 'c: 4ds-3x(p-1ds)-lp-2ds'],
    ['c: (1ds-p)x3-4ds', 'c: 4ds-(p-1ds)x3'],
    ['sc: 2ds-p-4ds', 'sc: 4ds-p-2ds'],
    ['sr: 1ds-bc:Y-2ds', 'sr: 2ds-bc:Y-1ds'],
    ['r: 3ds-bcp:Y:ZZ-2rds', 'r: 2rds-bcp:Y:ZZ-3ds'],
    ['nope', 'nope'],
  ])('%j → %j', (input, expected) => { expect(Pz.reverseNotation(input)).toBe(expected); });
  it('keeps the stitch count, and reversing twice gives the same stitches and picots', () => {
    for (const c of NOTATION_CASES) {
      const a = Pz.parseNotation(c.notation, true);
      if (!a) continue;
      const rev = Pz.reverseNotation(c.notation);
      const b = Pz.parseNotation(rev, true)!;
      expect(b, rev).not.toBeNull();
      expect(b.stitchCount, c.notation).toBe(a.stitchCount);
      expect(b.picots.length, c.notation).toBe(a.picots.length);
      const back = Pz.parseNotation(Pz.reverseNotation(rev), true)!;
      expect(back.picots.map(summarize), c.notation).toEqual(a.picots.map(summarize));
    }
  });
});

describe('labels and counts along the path', () => {
  it.each([
    ['r: 3ds-p-5ds', 0, 3, '3', 3],
    ['r: 3ds-p-5ds', 3, 8, '5', 5],
    ['r: 2rds-p-4ss-2ds', 0, 3, '2', 2],
    ['r: 2rds-p-4ss-2ds', 3, 7, '4ss·2', 6],
    ['r: 2ds-bc:Y-3ds', 0, 6, '5', 5],
    ['r: 3*(2ds-p)-2ds', 0, 8, '8', 8],
    ['r: 3ds', 5, 9, '', 0],
  ])('%s from %d to %d → label %j, %d stitches', (n, a, b, label, count) => {
    expect(Pz.buildSegmentLabel(n, a, b)).toBe(label);
    expect(Pz.countStitchesInRange(n, a, b)).toBe(count);
  });
  it('getSegmentRuns: one run per stitch type, a bead slot splits a run', () => {
    expect(Pz.getSegmentRuns('r: 2rds-p-4ss-2ds', 3, 7)).toEqual([
      { label: '4ss', midDS: 4, startDS: 3, endDS: 5 }, { label: '2', midDS: 6, startDS: 5, endDS: 7 }]);
    expect(Pz.getSegmentRuns('r: 2ds-bc:Y-3ds', 0, 6)).toEqual([
      { label: '2', midDS: 1, startDS: 0, endDS: 2 }, { label: '3', midDS: 4.5, startDS: 3, endDS: 6 }]);
    expect(Pz.getSegmentRuns('r: 2rds', 0, 3)).toEqual([{ label: '2rds', midDS: 1.5, startDS: 0, endDS: 3 }]);
  });
  it('the whole range counts every stitch (same as countActualStitches)', () => {
    for (const c of NOTATION_CASES) {
      const r = Pz.parseNotation(c.notation, true);
      if (!r) continue;
      expect(Pz.countStitchesInRange(c.notation, 0, r.stitchCount + 1), c.notation).toBe(Pz.countActualStitches(c.notation));
    }
  });
});

describe('getStitchTypes (what the realistic view draws at each slot)', () => {
  it('ds, rds (3 half-slots) and half stitches', () => {
    expect(Pz.getStitchTypes('r: 2ds-p-1rds-2ss')).toEqual({ 0: 'ds', 1: 'ds', 2: 'rds', 2.5: 'rds-cont', 3: 'rds-cont', 3.5: ['ss', 'ss'], 4: ['ss', 'ss'] });
  });
  it('beads take their slot; bds draws as rds', () => {
    expect(Pz.getStitchTypes('r: 1ds-bc:YZ-1ds')).toEqual({ 0: 'ds', 3: 'ds' });
    expect(Pz.getStitchTypes('r: 1ds-bcp:Y-be-1lss-1rss-1bds')).toEqual({ 0: 'ds', 3: ['lss', 'lss'], 3.5: ['rss', 'rss'], 4: 'rds', 4.5: 'rds-cont', 5: 'rds-cont' });
  });
  it('uses the cache it is given', () => {
    const cache = new Map();
    const a = Pz.getStitchTypes('r: 2ds', cache);
    expect(cache.get('r: 2ds')).toBe(a);
    expect(Pz.getStitchTypes('r: 2ds', cache)).toBe(a);
  });
  it('TO CONFIRM: a repeat group gives no stitch types at all (as it is today)', () => {
    expect(Pz.getStitchTypes('r: 2*(1ds-p)')).toEqual({});
  });
});

describe('split ring side A positions (session 62, H5)', () => {
  it('counted from the shared start; a slot bead takes one more', () => {
    expect(Pz.splitRingSideAPosition({ stitchesBefore: 2 }, 8)).toBe(6);
    expect(Pz.splitRingSideAPosition({ stitchesBefore: 2, beadType: 'bc' }, 8)).toBe(5);
  });
  it('is its own inverse', () => {
    for (const beadType of [null, 'bc', 'bcp', 'bcjp', 'be', 'bp'])
      for (let s = 0; s <= 7; s++) {
        const stored = Pz.splitRingSideAPosition({ stitchesBefore: s, beadType }, 8);
        expect(Pz.splitRingSideAPosition({ stitchesBefore: stored, beadType }, 8)).toBe(s);
      }
  });
  it('repairSplitRingSideABeads moves a side-A bead stored the old way, once', () => {
    // side A "2ds-bc:Y-3ds": 6 slots, bead at notation slot 2 → stored 6-2-1 = 3 (old files: 4)
    const old = { isSplitRing: true, notation: 'sr: 2ds-bc:Y-3ds', picots: [{ id: 'a', stitchesBefore: 4, beadType: 'bc' }, { id: 'b', stitchesBefore: 8 }] };
    const fixed = Pz.repairSplitRingSideABeads(old);
    expect(fixed.picots.map((p: any) => p.stitchesBefore)).toEqual([3, 8]);
    expect(old.picots[0].stitchesBefore).toBe(4);                    // the original is not changed
    expect(Pz.repairSplitRingSideABeads(fixed)).toBe(fixed);         // a second run changes nothing
  });
  it('repairSplitRingSideABeads leaves everything else alone', () => {
    const ring = { notation: 'r: 2ds-bc:Y-3ds', picots: [{ stitchesBefore: 4, beadType: 'bc' }] };
    expect(Pz.repairSplitRingSideABeads(ring)).toBe(ring);
    const noBeads = { isSplitRing: true, notation: 'sr: 2ds-p-3ds', picots: [{ stitchesBefore: 3 }] };
    expect(Pz.repairSplitRingSideABeads(noBeads)).toBe(noBeads);
    const bad = { isSplitRing: true, notation: 'sr: nonsense', picots: [{ stitchesBefore: 4, beadType: 'bc' }] };
    expect(Pz.repairSplitRingSideABeads(bad)).toBe(bad);
    expect(Pz.repairSplitRingSideABeads(null)).toBeNull();
  });
});

describe('STITCH_WIDTH_DS', () => {
  it('is the one table of stitch widths', () => {
    expect(Pz.STITCH_WIDTH_DS).toEqual({ ds: 1, ss: 0.5, lss: 0.5, rss: 0.5, rds: 1.5, bds: 1.5 });
  });
});
