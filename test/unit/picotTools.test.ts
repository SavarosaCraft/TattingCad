// domain/picotTools.ts — Picot Tools (Clear, Add, Fill, Group / Expand,
// Scale). Fixed examples from architecture.md, then rules that must hold for
// thousands of random valid notations.
import { describe, it, expect } from 'vitest';
import * as PT from '../../src/domain/picotTools';
import * as Pz from '../../src/domain/parser';

/** The element's picots as the app would hold them; `joined` = indexes to mark joined. */
const pics = (notation: string, joined: number[] = []) =>
  (Pz.parseNotation(notation, true)?.picots || []).map((p, i) => ({ ...p, isJoint: joined.includes(i) || p.isJoint }));

describe('analyzeNotation', () => {
  it('walks a notation into runs, picots and bead barriers', () => {
    const a = PT.analyzeNotation('r: 4ds-bc:Y-1ds-p-2rds', pics('r: 4ds-bc:Y-1ds-p-2rds', [1]));
    expect(a.supported).toBe(true);
    expect(a.type).toBe('r');
    expect(a.segments.map(s => [s.kind, s.raw, !!s.joined])).toEqual([
      ['run', '4ds', false], ['barrier', 'bc:Y', false], ['run', '1ds', false], ['picot', 'p', true], ['run', '2rds', false]]);
    expect(PT.totalRunStitches(a.segments)).toBe(7);
    expect(PT.totalRunDs(a.segments)).toBe(8);   // 4 + 1 + 2 × 1.5
  });
  it('joins neighbouring stitch tokens of one run, keeping their types in order', () => {
    const a = PT.analyzeNotation('c: 2ds-1ds-1rds-3ss', []);
    expect(a.segments).toHaveLength(1);
    expect(a.segments[0].stitches).toEqual([{ type: 'ds', n: 3 }, { type: 'rds', n: 1 }, { type: 'ss', n: 3 }]);
    expect(a.segments[0].count).toBe(7);
    expect(a.segments[0].ds).toBe(6);
  });
  it.each([
    ['r: 3ds-p-p-3ds', 'invalid'],        // review #21: two picots side by side
    ['c: 3ds-lp-jp-3ds', 'invalid'],
    ['r: 2ds-bc:Y-p-2ds', 'invalid'],
    ['r: 3ds-bc:YZ-3ds', 'picotMismatch'], // a bead sequence: one token, two picots
    ['r: 3ds-foo', 'unsupportedToken'],
    ['nope', 'unparsable'],
    ['', 'unparsable'],
  ])('refuses %j (%s)', (n, reason) => {
    const a = PT.analyzeNotation(n, pics(n));
    expect(a.supported).toBe(false);
    expect(a.reason).toBe(reason);
    expect(PT.clearUnjoinedPicots(n, pics(n))).toBeNull();
    expect(PT.addPicotsToRuns(n, pics(n), true)).toBeNull();
    expect(PT.previewFillDensity(n, pics(n), 2)).toBeNull();
    expect(PT.scaleNotation(n, pics(n), 2)).toBeNull();
    expect(PT.hasUnjoinedPicots(n, pics(n))).toBe(false);
    expect(PT.hasAddablePicotRuns(n, pics(n))).toBe(false);
  });
  it('refuses when the picot list does not match the notation', () => {
    expect(PT.analyzeNotation('r: 3ds-p-3ds', []).reason).toBe('picotMismatch');
    expect(PT.analyzeNotation('r: 6ds', [{ isJoint: false }]).reason).toBe('picotMismatch');
  });
  it('accepts every element prefix, split-ring sides included', () => {
    for (const t of ['r', 'c', 'sc', 'sr', 'fr', 'mr']) expect(PT.analyzeNotation(`${t}: 3ds-p-3ds`, pics(`${t}: 3ds-p-3ds`)).supported, t).toBe(true);
    expect(PT.analyzeNotation('jk: 4ss-p-4ss', pics('jk: 4ss-p-4ss')).supported).toBe(true);
  });
});

describe('Clear unjoined picots', () => {
  it.each([
    ['r: 2ss-3ds-p-3ds', [], 'r: 2ss-6ds'],                // half stitches stay half stitches
    ['r: 3ds-p-3ds-p-3ds', [], 'r: 9ds'],
    ['r: 3ds-p-3ds-p-3ds', [0], 'r: 3ds-p-6ds'],           // the joined one stays
    ['r: 3ds-bc:Y-3ds-p-2ds', [], 'r: 3ds-bc:Y-5ds'],      // beads stay
    ['r: 6ds', [], 'r: 6ds'],
  ])('%s (joined %j) → %s', (n, joined, expected) => {
    expect(PT.clearUnjoinedPicots(n, pics(n, joined as number[]))!.notation).toBe(expected);
  });
  it('hasUnjoinedPicots', () => {
    expect(PT.hasUnjoinedPicots('r: 3ds-p-3ds', pics('r: 3ds-p-3ds'))).toBe(true);
    expect(PT.hasUnjoinedPicots('r: 3ds-p-3ds', pics('r: 3ds-p-3ds', [0]))).toBe(false);
    expect(PT.hasUnjoinedPicots('r: 3ds-bc:Y-3ds', pics('r: 3ds-bc:Y-3ds'))).toBe(false);
  });
});

describe('Add picots', () => {
  it.each([
    ['r: 6ds', true, 'r: 3ds-p-3ds'],
    ['r: 5ds', true, 'r: 2ds-p-1ds-p-2ds'],   // odd, symmetric: two picots
    ['r: 5ds', false, 'r: 2ds-p-3ds'],        // odd, asymmetric: one picot
    ['r: 4rds', true, 'r: 2rds-p-2rds'],      // a cut falls between stitches
    ['c: 2ds-1rds-3ss', true, 'c: 2ds-1rds-p-3ss'],
    ['jk: 8ss', true, 'jk: 4ss-p-4ss'],
    ['r: 1ds', true, 'r: 1ds'],               // no room
    ['r: 6ds-p-5ds', false, 'r: 3ds-p-3ds-p-2ds-p-3ds'],
  ])('%s (symmetric %s) → %s', (n, sym, expected) => {
    expect(PT.addPicotsToRuns(n, pics(n), sym as boolean)!.notation).toBe(expected);
  });
  it('leaves a short run next to a joined first / last picot alone (protected zone)', () => {
    const n = 'r: 2ds-p-8ds';
    expect(PT.addPicotsToRuns(n, pics(n, [0]), true)!.notation).toBe('r: 2ds-p-4ds-p-4ds');
    expect(PT.addPicotsToRuns(n, pics(n), true)!.notation).toBe('r: 1ds-p-1ds-p-4ds-p-4ds');
  });
  it('hasAddablePicotRuns', () => {
    expect(PT.hasAddablePicotRuns('r: 6ds', [])).toBe(true);
    expect(PT.hasAddablePicotRuns('r: 1ds-p-1ds', pics('r: 1ds-p-1ds'))).toBe(false);
  });
});

describe('protected zones', () => {
  const seg = (n: string, joined: number[]) => PT.analyzeNotation(n, pics(n, joined)).segments;
  it('a joined first / last picot protects a run of up to 3 stitches beside it', () => {
    expect(PT.getProtectedZones(seg('r: 2ds-p-8ds-p-3ds', [0, 1]))).toEqual({ firstRunProtected: true, lastRunProtected: true, firstRunIndex: 0, lastRunIndex: 4 });
    expect(PT.getProtectedZones(seg('r: 4ds-p-8ds-p-4ds', [0, 1]))).toMatchObject({ firstRunProtected: false, lastRunProtected: false, firstRunIndex: -1, lastRunIndex: -1 });
    expect(PT.getProtectedZones(seg('r: 2ds-p-8ds-p-3ds', []))).toMatchObject({ firstRunProtected: false, lastRunProtected: false });
  });
  it('isRunProtected / clampProtectedFloor', () => {
    const s = seg('r: 2ds-p-8ds-p-3ds', [0]);
    expect([0, 2, 4].map(i => PT.isRunProtected(s, i))).toEqual([true, false, false]);
    expect(PT.clampProtectedFloor(0, true)).toBe(1);
    expect(PT.clampProtectedFloor(0, false)).toBe(0);
    expect(PT.clampProtectedFloor(4, true)).toBe(4);
  });
});

describe('Fill', () => {
  it.each([
    ['r: 12ds', 3, 'r: 3ds-p-3ds-p-3ds-p-3ds', 3],
    ['r: 7ds-p-5ds', 2, 'r: 1ds-p-2ds-p-2ds-p-2ds-p-1ds-p-2ds-p-2ds', 5],
    ['r: 4rds-p-2ds', 2, 'r: 2rds-p-2rds-p-2ds', 1],
    ['r: 12ds', 12, 'r: 12ds', 0],
  ])('%s every %d → %s (+%d)', (n, gap, expected, added) => {
    const r = PT.previewFillDensity(n, pics(n), gap as number)!;
    expect(r.notation).toBe(expected);
    expect(r.addedCount).toBe(added);
  });
  it('gap 1 is the densest: a picot between every two stitches', () => {
    expect(PT.previewFillDensity('r: 4ds', [], 1)!.notation).toBe('r: 1ds-p-1ds-p-1ds-p-1ds');
    expect(PT.previewFillDensity('r: 4ds', [], 0)!.notation).toBe('r: 1ds-p-1ds-p-1ds-p-1ds'); // below 1 counts as 1
  });
  it('maxUsefulFillGap', () => {
    expect(PT.maxUsefulFillGap('r: 12ds', [])).toBe(11);
    expect(PT.maxUsefulFillGap('r: 7ds-p-5ds', pics('r: 7ds-p-5ds'))).toBe(6);
  });
});

describe('Group / Expand repeats', () => {
  it.each([
    ['r: 3ds-p-3ds-p-3ds-p-3ds', 'r: 3*(3ds-p)-3ds'],
    ['r: 3ds-p-3ds-p', 'r: 2*(3ds-p)'],
    ['r: 2ds-p-2ds-p-2ds-p-5ds-lp-1ds', 'r: 3*(2ds-p)-5ds-lp-1ds'],
  ])('Group %s → %s', (n, expected) => {
    expect(PT.compactRepeatedPicots(n, pics(n))).toEqual({ notation: expected, groupsCreated: 1 });
    expect(PT.hasCompactableGroups(n, pics(n))).toBe(true);
  });
  it('Group includes joined picots (session 60, user decision)', () => {
    const n = 'r: 3ds-p-3ds-p';
    expect(PT.compactRepeatedPicots(n, pics(n, [0]))!.notation).toBe('r: 2*(3ds-p)');
  });
  it('nothing to group', () => {
    expect(PT.compactRepeatedPicots('r: 3ds-p-3ds', pics('r: 3ds-p-3ds'))).toEqual({ notation: 'r: 3ds-p-3ds', groupsCreated: 0 });
    expect(PT.hasCompactableGroups('r: 3ds-p-3ds', pics('r: 3ds-p-3ds'))).toBe(false);
  });
  it('autoCompact groups a result, and gives the text back when it cannot analyse it', () => {
    expect(PT.autoCompact('r: 3ds-p-3ds-p-3ds-p-3ds', [{ isJoint: false }, { isJoint: true }, { isJoint: false }])).toBe('r: 3*(3ds-p)-3ds');
    expect(PT.autoCompact('r: nonsense-foo', [])).toBe('r: nonsense-foo');
  });
  it.each([
    ['r: 3*(3ds-p)-3ds', 'r: 3ds-p-3ds-p-3ds-p-3ds'],
    ['r: 2*(3ds-p-3ds)', 'r: 3ds-p-6ds-p-3ds'],       // runs that meet are added together
    ['r: (2ds-p)x2-1ds', 'r: 2ds-p-2ds-p-1ds'],
    ['sr: 2*(1rds-p)-2ss', 'sr: 1rds-p-1rds-p-2ss'],
  ])('Expand %s → %s', (n, expected) => {
    expect(PT.hasRepeatGroups(n)).toBe(true);
    expect(PT.expandRepeatGroups(n)).toBe(expected);
  });
  it('Expand: nothing to do without a repeat group (plain brackets do not count)', () => {
    for (const n of ['r: 3ds-p-3ds', 'r: 2ds-(p-2ds)']) {
      expect(PT.hasRepeatGroups(n)).toBe(false);
      expect(PT.expandRepeatGroups(n)).toBeNull();
    }
  });
});

describe('Scale', () => {
  it.each([
    ['r: 2rds-p-6ds', 2, 'r: 4rds-p-12ds'],     // each run keeps its stitch types
    ['r: 2rds-p-6ds', 0.5, 'r: 1rds-p-3ds'],
    ['r: 2ds-2rds', 0.5, 'r: 1ds-1rds'],        // several types in one run: each gets its share
    ['r: 3ds-2rds', 0.6, 'r: 2ds-1rds'],        // … by cumulative rounding (3 of 5 → 2 + 1)
    ['r: 1ds-3rds-1ss', 0.6, 'r: 1ds-1rds-1ss'],
    ['r: 3ds-bc:Y-3ds', 2, 'r: 6ds-bc:Y-6ds'],  // beads stay where they are in the order
    ['r: 5ds-p-5ds', 1, 'r: 5ds-p-5ds'],
    // review #21: a picot at the very end stays at the end; at the start it always did
    ['c: 6ds-p', 2, 'c: 12ds-p'],
    ['c: 6ds-p', 0.5, 'c: 3ds-p'],
    ['r: 3ds-p-3ds-p', 2, 'r: 6ds-p-6ds-p'],
    ['c: p-6ds', 2, 'c: p-12ds'],
  ])('%s × %s → %s', (n, f, expected) => {
    expect(PT.scaleNotation(n, pics(n), f as number)!.notation).toBe(expected);
  });
  it('reports the real lengths and stitch counts', () => {
    const r = PT.scaleNotation('r: 2rds-p-6ds', pics('r: 2rds-p-6ds'), 0.5)!;
    expect(r).toMatchObject({ originalTotalDs: 9, actualTotalDs: 4.5, originalStitches: 8, actualStitches: 4 });
  });
  it('presets: exact where every stitch count divides, rounded otherwise', () => {
    const presets = (n: string) => { const a = PT.analyzeNotation(n, pics(n)); const p = PT.suggestScalePresets([{ type: a.type, segments: a.segments }]); return { exact: p.exact.map(x => x.label), rounded: p.rounded.map(x => x.label) }; };
    expect(presets('r: 6ds-p-6ds')).toEqual({ exact: [':2', ':3', 'x2', 'x3'], rounded: [':4'] });
    expect(presets('r: 5ds-p-7ds')).toEqual({ exact: ['x2', 'x3'], rounded: [':2', ':3', ':4'] });
    expect(presets('c: 6ds-p')).toEqual({ exact: [':2', ':3', 'x2', 'x3'], rounded: [':4'] }); // review #21: an end picot allows exact
  });
  it('a preset tells the length Apply will give', () => {
    const a = PT.analyzeNotation('r: 6ds-p-6ds', pics('r: 6ds-p-6ds'));
    for (const p of [...PT.suggestScalePresets([{ type: a.type, segments: a.segments }]).exact]) {
      expect(PT.scaleNotation('r: 6ds-p-6ds', pics('r: 6ds-p-6ds'), p.factor)!.actualTotalDs, p.label).toBe(p.resultingTotalDs);
    }
  });
  it('multi-select presets: a divisor only when it divides every element', () => {
    expect(PT.suggestScalePresetsMulti([12, 18]).map(p => p.label)).toEqual([':2', ':3', 'x2', 'x3']);
    expect(PT.suggestScalePresetsMulti([7, 5]).map(p => p.label)).toEqual(['x2', 'x3']);
  });
});

describe('splitRingSides', () => {
  it('splits by count: a picot at the very start of side A is side A, beads take their slot', () => {
    // side A "p-2ds-bc:Y-3ds" = 6 slots, stored reversed and counted from the far end
    const sr = { notation: 'sr: p-2ds-bc:Y-3ds', notationB: '2ds-p-2ds', stitchCount: 10, splitPosition: 6,
      picots: [{ id: 'bead', stitchesBefore: 3, beadType: 'bc' }, { id: 'a0', stitchesBefore: 6 }, { id: 'b', stitchesBefore: 8 }] };
    expect(PT.splitRingSides(sr)).toEqual({
      notationA: 'sr: p-2ds-bc:Y-3ds', notationB: 'sr: 2ds-p-2ds',
      picotsA: [{ id: 'a0', stitchesBefore: 0 }, { id: 'bead', stitchesBefore: 2, beadType: 'bc' }],
      picotsB: [{ id: 'b', stitchesBefore: 2 }],
    });
  });
  it('each side can be analysed on its own', () => {
    const sr = { notation: 'sr: 3ds-p-3ds', notationB: '2ds-p-4ds', stitchCount: 12, splitPosition: 6, picots: [{ id: 'a', stitchesBefore: 3, isJoint: true }, { id: 'b', stitchesBefore: 8 }] };
    const s = PT.splitRingSides(sr);
    expect(PT.analyzeNotation(s.notationA, s.picotsA).segments.map(x => !!x.joined)).toEqual([false, true, false]);
    expect(PT.analyzeNotation(s.notationB, s.picotsB).supported).toBe(true);
  });
  it('copes with an empty element', () => {
    expect(PT.splitRingSides(null)).toEqual({ notationA: '', notationB: 'sr: ', picotsA: [], picotsB: [] });
  });
});

// ── Rules for random valid notation ────────────────────────────────────────
// 6,000 notations: 1–5 runs of ds / rds / ss, a picot or core bead between
// runs, sometimes one at the very start or end, a third of the picots joined.
const ST = ['ds', 'ds', 'ds', 'rds', 'ss'], ZW = ['p', 'p', 'lp', 'jp', 'bc:Y'];
const FACTORS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1.5, 2, 3, 0.1];
const randomNotations = (count: number) => {
  let seed = 7;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed >>> 12) % n; };
  const out: { n: string; type: string; startP: boolean; endP: boolean; picots: any[] }[] = [];
  while (out.length < count) {
    const type = ['r', 'c', 'sr'][rnd(3)];
    const parts: string[] = [];
    const startP = rnd(6) === 0, endP = rnd(4) === 0;
    if (startP) parts.push(ZW[rnd(5)]);
    const nRuns = 1 + rnd(5);
    for (let i = 0; i < nRuns; i++) { parts.push(`${1 + rnd(9)}${ST[rnd(5)]}`); if (i < nRuns - 1) parts.push(ZW[rnd(5)]); }
    if (endP) parts.push(ZW[rnd(5)]);
    const n = `${type}: ${parts.join('-')}`;
    if (!Pz.isNotationValid(n)) continue;
    const picots = Pz.parseNotation(n, true)!.picots.map(p => ({ ...p, isJoint: p.isJoint || rnd(3) === 0 }));
    out.push({ n, type, startP, endP, picots });
  }
  return out;
};
const CASES = randomNotations(6000);

/** Every stitch of the notation in order, one entry per stitch ("ds", "rds"…). */
const stitchList = (n: string) => Pz.expandTokens(n.replace(/^\w+:\s*/, '')).flatMap(t => {
  const m = /^(\d+)?\s*(bds|rds|ds|lss|rss|ss)$/i.exec(t);
  return m ? Array(m[1] ? parseInt(m[1], 10) : 1).fill(m[2].toLowerCase()) : [];
});
const zeroWidth = (n: string) => Pz.expandTokens(n.replace(/^\w+:\s*/, '')).filter(t => Pz.isZeroWidth(t));
const positions = (n: string) => Pz.parseNotation(n, true)!.picots.map(p => p.stitchesBefore);
const isSubsequence = (small: any[], big: any[]) => { let i = 0; for (const b of big) if (i < small.length && b === small[i]) i++; return i === small.length; };

describe('rules for 6,000 random valid notations', () => {
  it('the generator gives a real mix', () => {
    expect(CASES.filter(c => c.endP).length).toBeGreaterThan(500);
    expect(CASES.filter(c => c.startP).length).toBeGreaterThan(300);
    expect(CASES.filter(c => /rds|ss/.test(c.n)).length).toBeGreaterThan(2000);
    for (const c of CASES.slice(0, 200)) expect(PT.analyzeNotation(c.n, c.picots).supported, c.n).toBe(true);
  });

  it('Clear: same stitches in the same order; joined picots and beads stay at their place; no unjoined picot left', () => {
    for (const c of CASES) {
      const r = PT.clearUnjoinedPicots(c.n, c.picots)!;
      expect(Pz.isNotationValid(r.notation), c.n).toBe(true);
      expect(stitchList(r.notation), c.n).toEqual(stitchList(c.n));
      const before = Pz.parseNotation(c.n, true)!, after = Pz.parseNotation(r.notation, true)!;
      expect(after.stitchCount, c.n).toBe(before.stitchCount);
      const kept = before.picots.filter((p, i) => c.picots[i].isJoint || p.beadType);
      expect(after.picots.map(p => p.stitchesBefore), c.n).toEqual(kept.map(p => p.stitchesBefore));
      expect(r.resultZeroWidth.length, c.n).toBe(after.picots.length);
      const again = PT.analyzeNotation(r.notation, r.resultZeroWidth);
      expect(again.segments.some(s => s.kind === 'picot' && !s.joined), c.n).toBe(false);
    }
  });

  it('Add and Fill: same stitches in the same order; every old picot stays at its place; only plain "p" is added', () => {
    for (const c of CASES) {
      const oldPos = positions(c.n), oldZw = zeroWidth(c.n);
      const results = [PT.addPicotsToRuns(c.n, c.picots, true)!, PT.addPicotsToRuns(c.n, c.picots, false)!, PT.previewFillDensity(c.n, c.picots, 1)!, PT.previewFillDensity(c.n, c.picots, 3)!];
      for (const r of results) {
        expect(Pz.isNotationValid(r.notation), `${c.n} → ${r.notation}`).toBe(true);
        expect(stitchList(r.notation), c.n).toEqual(stitchList(c.n));
        expect(isSubsequence(oldPos, positions(r.notation)), `${c.n} → ${r.notation}`).toBe(true);
        const newZw = zeroWidth(r.notation);
        expect(isSubsequence(oldZw, newZw), `${c.n} → ${r.notation}`).toBe(true);
        expect(newZw.filter(t => t === 'p').length - oldZw.filter(t => t === 'p').length, c.n).toBe(newZw.length - oldZw.length);
        expect(r.resultZeroWidth.length, c.n).toBe(newZw.length);
      }
      const fill = results[2] as PT.FillDensityPreview;
      expect(fill.addedCount, c.n).toBe(zeroWidth(fill.notation).length - oldZw.length);
    }
  });

  it('Fill at gap 1 leaves no run longer than one stitch', () => {
    for (const c of CASES) {
      const r = PT.previewFillDensity(c.n, c.picots, 1)!;
      const a = PT.analyzeNotation(r.notation, r.resultZeroWidth);
      expect(a.segments.every(s => s.kind !== 'run' || (s.count || 0) <= 1), `${c.n} → ${r.notation}`).toBe(true);
    }
  });

  it('Group then Expand gives the same stitches and picots; Group never moves anything', () => {
    for (const c of CASES) {
      const g = PT.compactRepeatedPicots(c.n, c.picots)!;
      const before = Pz.parseNotation(c.n, true)!, after = Pz.parseNotation(g.notation, true)!;
      expect(after, `${c.n} → ${g.notation}`).not.toBeNull();
      expect(after.stitchCount, c.n).toBe(before.stitchCount);
      expect(after.picots.map(p => [p.stitchesBefore, p.length, p.beadType]), c.n).toEqual(before.picots.map(p => [p.stitchesBefore, p.length, p.beadType]));
      expect(stitchList(g.notation), c.n).toEqual(stitchList(c.n));
      if (g.groupsCreated > 0) {
        const e = PT.expandRepeatGroups(g.notation)!;
        expect(stitchList(e), c.n).toEqual(stitchList(c.n));
        expect(zeroWidth(e), c.n).toEqual(zeroWidth(c.n));
        expect(PT.hasRepeatGroups(e), c.n).toBe(false);
      } else expect(g.notation, c.n).toBe(PT.clearUnjoinedPicots(c.n, c.picots.map(p => ({ ...p, isJoint: true })))!.notation);
    }
  });

  it('Scale: valid result, the same picots and beads in the same order, start / end picots stay put', () => {
    let withEnd = 0, misreported = 0; const misreportedExamples: string[] = [];
    for (const c of CASES) for (const f of FACTORS) {
      const r = PT.scaleNotation(c.n, c.picots, f)!;
      const where = `${c.n} × ${f} → ${r?.notation}`;
      expect(r, where).not.toBeNull();
      expect(Pz.isNotationValid(r.notation), where).toBe(true);
      expect(zeroWidth(r.notation), where).toEqual(zeroWidth(c.n));
      if (c.endP) { withEnd++; expect(/-(p|lp|jp|bc:Y)$/.test(r.notation), where).toBe(true); }
      if (c.startP) expect(/^\w+: (p|lp|jp|bc:Y)-/.test(r.notation), where).toBe(true);
      expect(r.originalStitches, where).toBe(stitchList(c.n).length);
      expect(r.actualStitches, where).toBeGreaterThanOrEqual(1);
      // The reported stitch count is normally the real one; it can be too
      // low when picots crowd together (see the two "TO CONFIRM" tests).
      const real = stitchList(r.notation).length;
      expect(real, where).toBeGreaterThanOrEqual(r.actualStitches);
      if (real !== r.actualStitches) { misreported++; if (misreportedExamples.length < 3) misreportedExamples.push(where); }
    }
    expect(withEnd).toBeGreaterThan(10000);
    // FINDING (session 64): today about 1 in 18 of these — see the tests below.
    expect(misreported, misreportedExamples.join(' | ')).toBeLessThan(CASES.length * FACTORS.length * 0.07);
  });

  // FINDINGS (session 64) — pinned as the code behaves today, to be decided
  // with the user. When fixed, these two tests change and the 7 % allowance
  // above can go (the reported count should then always be the real one).
  it('TO CONFIRM (finding): a short gap before an END picot grows by a stitch when scaling down', () => {
    // 10 stitches × 0.5 = 5: expected "4ds-lp-1ds-p". The end picot is
    // pushed one past the new total instead, so the result has 6 stitches
    // while Scale reports 5. (Since review #21 pinned end picots.)
    const n = 'r: 9ds-lp-1ds-p';
    const r = PT.scaleNotation(n, pics(n), 0.5)!;
    expect(r.notation).toBe('r: 4ds-lp-2ds-p');
    expect(r.actualStitches).toBe(5);
    expect(stitchList(r.notation).length).toBe(6);
    // without the end picot the same gap is right:
    expect(PT.scaleNotation('r: 9ds-lp-1ds', pics('r: 9ds-lp-1ds'), 0.5)!.notation).toBe('r: 4ds-lp-1ds');
  });
  it('TO CONFIRM (finding): scaled smaller than its picots allow, the result has more stitches than reported', () => {
    // 18 stitches × 0.1 = 2, but four picots / beads need a stitch between
    // each: the result has 3 stitches, the last run is gone (the last picot
    // ends up at the very end), and actualStitches still says 2.
    const n = 'r: p-3ss-bc:Y-4ds-jp-7ds-p-4ds';
    const r = PT.scaleNotation(n, pics(n), 0.1)!;
    expect(r.notation).toBe('r: p-1ss-bc:Y-1ds-jp-1ds-p');
    expect(r.actualStitches).toBe(2);
    expect(stitchList(r.notation).length).toBe(3);
  });

  it('Scale × 1 changes nothing but the spelling; × 2 and × 3 multiply every stitch count exactly', () => {
    for (const c of CASES) {
      const same = PT.scaleNotation(c.n, c.picots, 1)!;
      expect(stitchList(same.notation), c.n).toEqual(stitchList(c.n));
      expect(positions(same.notation), c.n).toEqual(positions(c.n));
      for (const k of [2, 3]) {
        const r = PT.scaleNotation(c.n, c.picots, k)!;
        expect(stitchList(r.notation), `${c.n} × ${k}`).toEqual(stitchList(c.n).flatMap(t => Array(k).fill(t)));
        expect(r.actualTotalDs, `${c.n} × ${k}`).toBeCloseTo(r.originalTotalDs * k, 9);
      }
    }
  });

  it('an "exact" preset really is exact: scaling back by the opposite factor returns the original', () => {
    let checked = 0;
    for (const c of CASES) {
      const a = PT.analyzeNotation(c.n, c.picots);
      for (const p of PT.suggestScalePresets([{ type: a.type, segments: a.segments }]).exact) {
        const r = PT.scaleNotation(c.n, c.picots, p.factor)!;
        expect(r.actualTotalDs, `${c.n} ${p.label}`).toBeCloseTo(p.resultingTotalDs, 9);
        if (p.factor < 1) {
          const back = PT.scaleNotation(r.notation, Pz.parseNotation(r.notation, true)!.picots, Math.round(1 / p.factor))!;
          expect(stitchList(back.notation), `${c.n} ${p.label} and back`).toEqual(stitchList(c.n));
          expect(positions(back.notation), `${c.n} ${p.label} and back`).toEqual(positions(c.n));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});
