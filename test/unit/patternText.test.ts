// domain/patternOutput.ts — the numbered lines of the pattern text
// (Copy pattern / notes output). Session 64, user decisions:
//  - each line is the element's own notation as typed: its prefix (fr: mr:
//    jk: …), every stitch (ss, lss/rss, rds/bds) and every bead token kept;
//  - a joined picot gets the usual //ref// mark (a joined plain picot is
//    written jp, a fold fp — as before); an unjoined joining picot (jp, jpg,
//    cj, cjp, bjp, bcjp) is marked (?);
//  - gp and jpg stay as written; an unjoined gp is left out (drawing aid);
//  - a repeat n*(…) stays short unless a picot inside is joined;
//  - a split ring is written "sr: side A / side B".
import { describe, it, expect } from 'vitest';
import { generatePatternText } from '../../src/domain/patternOutput';
import { parseNotation } from '../../src/domain/parser';
import en from '../../src/i18n/translations_en.json';

let nextId = 0;
const el = (notation: string, order: number | null, extra: any = {}) => {
  const r = parseNotation(notation, true)!;
  const type = /^(c|sc):/i.test(notation) ? 'chain' : 'ring';
  return { id: 'e' + (++nextId), type, isSplitChain: /^sc:/i.test(notation), notation, stitchCount: r.stitchCount,
    picots: r.picots.map((p, i) => ({ ...p, id: `p${i}` })), orderNumber: order, ...extra };
};
/** A split ring the way the app stores it: side A's picots counted from the shared start (session 62). */
const splitRing = (sideA: string, sideB: string, order: number) => {
  const a = parseNotation(`sr: ${sideA}`, true)!, b = parseNotation(`sr: ${sideB}`, true)!;
  const slot = (p: any) => ['bc', 'bcp', 'bcjp', 'be'].includes(p.beadType);
  const picots = [
    ...a.picots.map((p, i) => ({ ...p, id: `a${i}`, stitchesBefore: a.stitchCount - p.stitchesBefore - (slot(p) ? 1 : 0) })),
    ...b.picots.map((p, i) => ({ ...p, id: `b${i}`, stitchesBefore: a.stitchCount + p.stitchesBefore })),
  ];
  return { id: 'e' + (++nextId), type: 'ring', isSplitRing: true, notation: `sr: ${sideA}`, notationB: sideB,
    stitchCount: a.stitchCount + b.stitchCount, splitPosition: a.stitchCount, picots, orderNumber: order };
};
const join = (a: any, ai: number, b: any, bi: number, extra: any = {}) => {
  a.picots[ai].isJoint = true; b.picots[bi].isJoint = true;
  return { id: `c${++nextId}`, picots: [{ elementId: a.id, picotId: a.picots[ai].id }, { elementId: b.id, picotId: b.picots[bi].id }], ...extra };
};
const lines = (elements: any[], picotConnections: any[] = []) =>
  generatePatternText({ elements, picotConnections, rounds: [], materials: [], beadLibrary: [], threadPresets: [], activePresetId: '',
    dsWidth: 10, patternNotes: '', projectName: 'Test', currentFilePath: null, t: (k: string) => (en as any)[k] ?? k })!
    .text.split('\n').filter(l => /^\d+\. /.test(l)).map(l => l.replace(/^\d+\. /, ''));
const one = (notation: string) => lines([el(notation, 1)])[0];

describe('a numbered line keeps the notation as typed', () => {
  it.each([
    'fr: 6ds-p-6ds', 'mr: 6ds-p-6ds', 'jk: 12ss', 'jk: 4lss-4rss',
    'r: 4ss-p-4ss', 'r: 2rds-p-2bds', 'r: 3lss-3rss-p-2ds',
    'r: 3ds-bc:Y-3ds', 'r: 3ds-bc:2Y1Z-3ds', 'r: 3ds-bcp:Y:ZZ-3ds', 'r: 3ds-bp:YZ-3ds', 'r: 3ds-sb:Y-3ds', 'r: 3ds-be-3ds',
    'r: 3ds-cp-3ds-lp-3ds-sp-3ds',
    'c: p-6ds-p', 'sc: 4ds-p-4ds', 'r: 3ds-p-3ds-p-3ds',
  ])('%s', notation => { expect(one(notation)).toBe(notation); });
});

describe('repeats stay short unless a picot inside is joined', () => {
  it('nothing joined → as written', () => {
    expect(one('r: 3*(3ds-p)-3ds')).toBe('r: 3*(3ds-p)-3ds');
    expect(one('r: (2ds-p)x3-2ds')).toBe('r: (2ds-p)x3-2ds');
  });
  it('a joined picot inside → that repeat written out with its join', () => {
    const a = el('r: 3*(3ds-p)-3ds', 1), b = el('r: 6ds-p-6ds', 2);
    const conn = join(a, 1, b, 0);
    expect(lines([a, b], [conn])).toEqual(['r: 3ds-p-3ds-jp//r2//-3ds-p-3ds', 'r: 6ds-jp//r1//-6ds']);
  });
  it('only the repeat holding the join is written out', () => {
    const a = el('r: 2*(2ds-p)-1ds-2*(1ds-p)', 1), b = el('r: 6ds-p-6ds', 2);
    const conn = join(a, 2, b, 0);
    expect(lines([a, b], [conn])[0]).toBe('r: 2*(2ds-p)-1ds-1ds-jp//r2//-1ds-p');
  });
});

describe('joins', () => {
  it('a joined plain picot is written jp with the element it joins', () => {
    const a = el('r: 3ds-p-3ds', 1), b = el('c: 4ds-lp-4ds', 2);
    expect(lines([a, b], [join(a, 0, b, 0)])).toEqual(['r: 3ds-jp//ch2//-3ds', 'c: 4ds-jp//r1//-4ds']);
  });
  it('a fold is fp', () => {
    const a = el('r: 3ds-p-3ds', 1), b = el('r: 3ds-p-3ds', 2);
    expect(lines([a, b], [join(a, 0, b, 0, { connectionType: 'fold' })])).toEqual(['r: 3ds-fp//r2//-3ds', 'r: 3ds-fp//r1//-3ds']);
  });
  it.each([
    ['r: 3ds-cjp-3ds', 'r: 3ds-cjp//r2//-3ds'],
    ['r: 3ds-cj-3ds', 'r: 3ds-cj//r2//-3ds'],
    ['r: 3ds-jpg-3ds', 'r: 3ds-jpg//r2//-3ds'],
    ['r: 3ds-bjp:YZ-3ds', 'r: 3ds-bjp:YZ//r2//-3ds'],
    ['r: 3ds-bcjp:Y:ZZ-3ds', 'r: 3ds-bcjp:Y:ZZ//r2//-3ds'],
    ['fr: 3ds-p-3ds', 'fr: 3ds-jp//r2//-3ds'],
  ])('%s joined → %s', (notation, expected) => {
    const a = el(notation, 1), b = el('r: 6ds-p-6ds', 2);
    expect(lines([a, b], [join(a, 0, b, 0)])[0]).toBe(expected);
  });
  it('several joins on one picot: every element, sorted', () => {
    const a = el('r: 3ds-p-3ds', 1), b = el('r: 3ds-p-3ds', 3), c = el('c: 3ds-p-3ds', 2);
    const conn = { id: 'x', picots: [{ elementId: a.id, picotId: 'p0' }, { elementId: b.id, picotId: 'p0' }, { elementId: c.id, picotId: 'p0' }] };
    [a, b, c].forEach(e => { e.picots[0].isJoint = true; });
    expect(lines([a, b, c], [conn])[0]).toBe('r: 3ds-jp//ch2//r3//-3ds');
  });
  it('a joining picot with nothing joined to it is marked (?)', () => {
    for (const [n, out] of [['r: 3ds-jp-3ds', 'r: 3ds-jp(?)-3ds'], ['r: 3ds-jpg-3ds', 'r: 3ds-jpg(?)-3ds'], ['r: 3ds-cjp-3ds', 'r: 3ds-cjp(?)-3ds'], ['r: 3ds-bjp:Y-3ds', 'r: 3ds-bjp:Y(?)-3ds']]) {
      expect(one(n), n).toBe(out);
      const loaded = el(n, 1); loaded.picots[0].isJoint = false;        // file open clears isJoint on an unjoined picot
      expect(lines([loaded])[0], n + ' after file open').toBe(out);
    }
  });
});

describe('guide points', () => {
  it('an unjoined gp is left out (a drawing aid), its two runs become one', () => {
    expect(one('c: 6ds-gp-6ds')).toBe('c: 12ds');
    expect(one('r: 2ss-gp-2ss-p-3ds')).toBe('r: 4ss-p-3ds');
    expect(one('r: gp-6ds')).toBe('r: 6ds');
    expect(one('r: 3ds-gp-2rds')).toBe('r: 3ds-2rds');
  });
  it('a joined gp stays gp, with the usual mark', () => {
    const a = el('c: 6ds-gp-6ds', 1), b = el('r: 6ds-p-6ds', 2);
    expect(lines([a, b], [join(a, 0, b, 0)])).toEqual(['c: 6ds-gp//r2//-6ds', 'r: 6ds-jp//ch1//-6ds']);
  });
});

describe('split rings: side A / side B', () => {
  it('both sides as typed', () => {
    expect(lines([splitRing('2ds-p-4ds', '3ds-p-3ds', 1)])).toEqual(['sr: 2ds-p-4ds / 3ds-p-3ds']);
    expect(lines([splitRing('2rds-bc:Y-3ss', '4lss-p-1ds', 1)])).toEqual(['sr: 2rds-bc:Y-3ss / 4lss-p-1ds']);
  });
  it('a join on each side lands on the right picot', () => {
    const s = splitRing('2ds-p-4ds-p-1ds', '3ds-p-3ds', 1), r = el('r: 6ds-p-6ds', 2), c = el('c: 6ds-p-6ds', 3);
    const ca = join(s, 1, r, 0);                    // side A, its SECOND picot (notation order)
    const cb = join(s, 2, c, 0);                    // side B's picot
    expect(lines([s, r, c], [ca, cb])[0]).toBe('sr: 2ds-p-4ds-jp//r2//-1ds / 3ds-jp//ch3//-3ds');
  });
});

describe('the rest of the text', () => {
  it('a numbered floating ring is not also listed as unnumbered', () => {
    const text = generatePatternText({ elements: [el('c: 6ds-gp-6ds', 1), el('fr: 6ds-p-6ds', 2)], picotConnections: [], rounds: [], materials: [], beadLibrary: [], threadPresets: [], activePresetId: '',
      dsWidth: 10, patternNotes: '', projectName: 'FloatingRing test', currentFilePath: null, t: (k: string) => (en as any)[k] ?? k })!.text;
    expect(text).toContain('1. c: 12ds\n2. fr: 6ds-p-6ds');
    expect(text).not.toContain(en.patternOutUnnumbered);
  });
  it('the unnumbered list names a Josephine knot JK', () => {
    const text = generatePatternText({ elements: [el('r: 6ds', 1), el('jk: 12ss', null)], picotConnections: [], rounds: [], materials: [], beadLibrary: [], threadPresets: [], activePresetId: '',
      dsWidth: 10, patternNotes: '', projectName: 'X', currentFilePath: null, t: (k: string) => (en as any)[k] ?? k })!.text;
    expect(text).toContain('• JK (12ss)');
  });
  it('a picot list that doesn\'t match the notation still gives a line (the old way) and no crash', () => {
    const odd = el('r: 3ds-p-3ds', 1); odd.picots = [];
    expect(lines([odd])).toEqual(['r: 6ds']);
  });
});
