// utils/safeNumber.ts — review #1 (numbers from pattern files) and #6
// (notation must be text; structure check for paste / Resume).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRealNumber, safeNum, markupNum, sanitizeProjectNumbers } from '../../src/utils/safeNumber';
import { baseElements, bake, makeRng, randomPattern, leafPaths, setAt, DS } from './helpers/patterns';

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });

describe('isRealNumber / safeNum / markupNum', () => {
  it('accepts only finite numbers', () => {
    for (const v of [0, -1, 1.5, 1e9]) expect(isRealNumber(v)).toBe(true);
    for (const v of ['1', NaN, Infinity, -Infinity, null, undefined, [1], {}, true]) expect(isRealNumber(v)).toBe(false);
  });
  it('safeNum gives the number or the fallback', () => {
    expect(safeNum(3.25)).toBe(3.25);
    expect(safeNum('3')).toBe(0);
    expect(safeNum(NaN, 7)).toBe(7);
  });
  it('markupNum passes anything of the number type untouched, else 0', () => {
    expect(markupNum(12.5)).toBe(12.5);
    expect(Number.isNaN(markupNum(NaN))).toBe(true);
    expect(markupNum('5"/><a>')).toBe(0);
    expect(markupNum([5])).toBe(0);
    expect(markupNum(null)).toBe(0);
  });
});

describe('sanitizeProjectNumbers — sound patterns are not changed', () => {
  it('leaves one element of every kind untouched', () => {
    const data = { dsWidth: DS, elements: baseElements(), picotConnections: [] };
    const before = JSON.stringify(data);
    expect(sanitizeProjectNumbers(data)).toEqual({ dropped: 0, reset: 0 });
    expect(JSON.stringify(data)).toBe(before);
  });
  it('leaves 600 random sound patterns untouched', () => {
    const rng = makeRng(12345);
    for (let k = 0; k < 600; k++) {
      const ds = [6, 10, 14][k % 3];
      const data = { dsWidth: ds, elements: randomPattern(rng, ds), picotConnections: [] };
      const before = JSON.stringify(data);
      const r = sanitizeProjectNumbers(data);
      expect(r, `case ${k}`).toEqual({ dropped: 0, reset: 0 });
      expect(JSON.stringify(data), `case ${k}`).toBe(before);
    }
  });
});

describe('sanitizeProjectNumbers — damage', () => {
  it('leaves a damaged element out with its joins, resets lesser numbers', () => {
    const els = baseElements(); // tear, circ, jk, sr, chain, line, ghost
    els[0].picots[0].isJoint = true; els[1].picots[0].isJoint = true; els[4].picots[0].isJoint = true; els[3].picots[0].isJoint = true;
    const conns = [
      { id: 'c1', picots: [{ elementId: 'tear', picotId: 'p6' }, { elementId: 'circ', picotId: 'p6' }] },
      { id: 'c2', picots: [{ elementId: 'chain', picotId: 'p6' }, { elementId: 'sr', picotId: 'p3' }] },
    ];
    els[1].center.x = '5"/><a>'; els[5].rotation = 'abc'; els[5].lineWidth = [3]; els[3].squeeze = 'x';
    const data: any = { dsWidth: '10', elements: els, picotConnections: conns };
    const r = sanitizeProjectNumbers(data);
    expect(r).toEqual({ dropped: 1, reset: 4 });
    expect(data.elements.map((e: any) => e.id)).toEqual(['tear', 'jk', 'sr', 'chain', 'line', 'ghost']);
    expect(data.picotConnections.map((c: any) => c.id)).toEqual(['c2']);            // its join removed, the other kept
    expect(data.elements.find((e: any) => e.id === 'tear').picots[0].isJoint).toBe(false); // far side demoted
    expect(data.elements.find((e: any) => e.id === 'chain').picots[0].isJoint).toBe(true); // other join untouched
    const line = data.elements.find((e: any) => e.id === 'line');
    expect([line.rotation, line.lineWidth]).toEqual([0, 2]);
    expect(data.elements.find((e: any) => e.id === 'sr').squeeze).toBe(0.25);
    expect('dsWidth' in data).toBe(false);
  });

  it('a far-side picot stays joined when another join still holds it', () => {
    const els = baseElements();
    els[0].picots[0].isJoint = true;
    const data: any = { elements: els, picotConnections: [
      { id: 'c1', picots: [{ elementId: 'tear', picotId: 'p6' }, { elementId: 'circ', picotId: 'p6' }] },
      { id: 'c2', picots: [{ elementId: 'tear', picotId: 'p6' }, { elementId: 'chain', picotId: 'p6' }] },
    ] };
    els[1].center.y = null;
    sanitizeProjectNumbers(data);
    expect(data.picotConnections.map((c: any) => c.id)).toEqual(['c2']);
    expect(data.elements[0].picots[0].isJoint).toBe(true);
  });

  it('works on clipboard data (connections) and non-object elements', () => {
    const clip: any = { elements: baseElements(), connections: [{ id: 'c', picots: [{ elementId: 'tear', picotId: 'p6' }, { elementId: 'jk', picotId: 'x' }] }] };
    clip.elements[2].paths[0].endX = null; clip.elements.push(null, 'text', 7);
    const r = sanitizeProjectNumbers(clip);
    expect(r.dropped).toBe(4);
    expect(clip.connections).toEqual([]);
    expect(clip.elements).toHaveLength(6);
  });

  it('copes with odd input', () => {
    expect(sanitizeProjectNumbers(null)).toEqual({ dropped: 0, reset: 0 });
    expect(sanitizeProjectNumbers('text')).toEqual({ dropped: 0, reset: 0 });
    expect(sanitizeProjectNumbers({ elements: 'x' })).toEqual({ dropped: 0, reset: 0 });
  });

  it.each([
    ['center.x', (e: any) => { e.center.x = '1'; }],
    ['center missing', (e: any) => { delete e.center; }],
    ['path point', (e: any) => { e.paths[0].endY = NaN; }],
    ['path control', (e: any) => { const p = e.paths[0]; if (p.type === 'cubic') p.control1X = 'a'; else p.controlX = 'a'; }],
    ['paths not a list', (e: any) => { e.paths = 'M0 0'; }],
    ['stitchCount', (e: any) => { e.stitchCount = '12'; }],
    ['splitPosition', (e: any) => { e.splitPosition = Infinity; }],
    ['picots not a list', (e: any) => { e.picots = {}; }],
    ['picot.stitchesBefore', (e: any) => { e.picots = [{ id: 'x', stitchesBefore: '3' }]; }],
    ['notation a number (review #6)', (e: any) => { e.notation = 12; }],
    ['notationB a list (review #6)', (e: any) => { e.notationB = ['3ds']; }],
  ])('leaves an element out for: %s', (_name, damage) => {
    const els = baseElements(); damage(els[0]);
    const data: any = { elements: els, picotConnections: [] };
    expect(sanitizeProjectNumbers(data).dropped).toBe(1);
    expect(data.elements.some((e: any) => e.id === 'tear')).toBe(false);
  });

  it.each([
    ['rotation', 0], ['lineWidth', 2], ['labelOffset', 8], ['picotSideMultiplier', 1],
    ['endAllowance', 0], ['squeeze', 0], ['squeezeCA', 0.75], ['squeezeCB', 0.75],
  ])('resets %s to %s', (key, value) => {
    const els = baseElements(); els[0][key] = 'bad';
    const data: any = { elements: els, picotConnections: [] };
    expect(sanitizeProjectNumbers(data)).toEqual({ dropped: 0, reset: 1 });
    expect(els[0][key]).toBe(value);
  });

  it('removes a bad dsWidth (text, zero, negative)', () => {
    for (const bad of ['10', 0, -4, NaN]) {
      const data: any = { dsWidth: bad, elements: [] };
      expect(sanitizeProjectNumbers(data).reset).toBe(1);
      expect('dsWidth' in data).toBe(false);
    }
  });

  it('requireStructure (paste / Resume): also needs an id, a known type and a paths list', () => {
    const mk = () => baseElements().slice(0, 4);
    const loose: any = { elements: mk() }; delete loose.elements[0].id; loose.elements[1].type = 'blob'; delete loose.elements[2].paths;
    expect(sanitizeProjectNumbers(loose).dropped).toBe(0);            // file open has its own whole-file check
    const strict: any = { elements: mk() }; delete strict.elements[0].id; strict.elements[1].type = 'blob'; delete strict.elements[2].paths;
    expect(sanitizeProjectNumbers(strict, { requireStructure: true }).dropped).toBe(3);
    expect(strict.elements.map((e: any) => e.id)).toEqual(['sr']);
  });
});

// Review #1: markup text placed in ANY field of ANY element kind must never
// reach the realistic view's SVG text — with either wall alone, and both.
describe('realistic view: markup in number fields never gets through', () => {
  const MARK = 'INJ3CT';
  const PAY = `7"/><a href="https://x.invalid/${MARK}">X</a><path d="M0 0`;
  const payloads: any[] = [PAY, [PAY], `0 ${PAY}`];
  const EXTRA = ['rotation', 'lineWidth', 'endAllowance', 'stitchCount', 'squeeze', 'squeezeCA', 'squeezeCB', 'splitPosition', 'picotSideMultiplier', 'labelOffset', 'isFlippedH', 'isFlippedV', 'scale', 'radius', 'width', 'height'];

  const fuzz = (sanitize: boolean) => {
    let runs = 0; const hits: string[] = [], throws: string[] = [], nans: string[] = [];
    baseElements().forEach((el0, ei) => {
      const paths = [...leafPaths(el0), ...EXTRA.filter(k => !(k in el0)).map(k => [k])];
      for (const path of paths) for (let pi = 0; pi < payloads.length; pi++) {
        const els = baseElements(); setAt(els[ei], path, payloads[pi]); runs++;
        const data: any = { dsWidth: DS, elements: els, picotConnections: [] };
        const where = `${el0.id}.${path.join('.')} [payload ${pi}]`;
        if (sanitize) sanitizeProjectNumbers(data);
        try {
          const svg = bake(data.elements, data.dsWidth ?? DS);
          if (svg.includes(MARK)) hits.push(where);
          if (sanitize && svg.includes('NaN')) nans.push(where);
        } catch { throws.push(where); }
      }
    });
    return { runs, hits, throws, nans };
  };

  it('the baseline bake is clean', () => {
    const svg = bake(baseElements());
    expect(svg.length).toBeGreaterThan(1000);
    expect(svg.includes(MARK)).toBe(false);
  });
  it('renderer wall alone (no input check)', () => {
    const r = fuzz(false);
    expect(r.runs).toBeGreaterThan(800);
    expect(r.hits).toEqual([]);
  });
  it('both walls: nothing through, no throw, no NaN', () => {
    const r = fuzz(true);
    expect(r.hits).toEqual([]);
    expect(r.throws).toEqual([]);
    expect(r.nans).toEqual([]);
  });
  it('a text dsWidth does not get through either', () => {
    for (const pl of payloads) {
      let svg = '';
      try { svg = bake(baseElements(), pl); } catch { /* a throw is fine: nothing drawn */ }
      expect(svg.includes(MARK)).toBe(false);
    }
  });
});
