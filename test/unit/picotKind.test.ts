import { describe, it, expect } from 'vitest';
import { parseNotation } from '../../src/domain/parser';
import { PICOT_KIND_TOKENS, picotKindToken, replacePicotKinds, planPicotKindChange, picotKindSelectionInfo } from '../../src/domain/picotKind';

const el = (notation: string, extra: any = {}) => {
  const parsed = parseNotation(notation)!;
  return { id: 'E', notation, picots: parsed.picots, ...extra };
};
const splitEl = (a: string, b: string) => {
  const pa = parseNotation(`sr: ${a}`)!, pb = parseNotation(`sr: ${b}`)!;
  const picots = [...pa.picots.slice().reverse(), ...pb.picots];
  return { id: 'S', isSplitRing: true, notation: `sr: ${a}`, notationB: b, picots };
};
const kindsOf = (notation: string) => parseNotation(notation)!.picots.map(picotKindToken);

describe('picotKindToken', () => {
  it.each(PICOT_KIND_TOKENS)('reads %s back from the parser', (tok) => {
    expect(kindsOf(`r: 2ds-${tok}-2ds`)).toEqual([tok]);
  });
  it('jp counts as p, cp as sp, bead picots as null', () => {
    expect(kindsOf('r: 2ds-jp-2ds')).toEqual(['p']);
    expect(kindsOf('r: 2ds-cp-2ds')).toEqual(['sp']);
    expect(kindsOf('r: 2ds-bp-2ds')).toEqual([null]);
    expect(kindsOf('r: 2ds-bjp:Y-2ds')).toEqual([null]);
  });
});

describe('every kind to every kind', () => {
  for (const from of PICOT_KIND_TOKENS) for (const to of PICOT_KIND_TOKENS) {
    if (from === to) continue;
    it(`${from} → ${to}`, () => {
      const e = el(`r: 2ds-p-2ds-${from}-2ds-p`);
      const plan = planPicotKindChange(e, [e.picots[1].id], to)!;
      expect(plan.notation).toBe(`r: 2ds-p-2ds-${to}-2ds-p`);
      expect(kindsOf(plan.notation)).toEqual(['p', to, 'p']);
    });
  }
});

describe('planPicotKindChange', () => {
  it('nothing to do when already that kind', () => {
    const e = el('r: 2ds-lp-2ds');
    expect(planPicotKindChange(e, [e.picots[0].id], 'lp')).toBeNull();
  });
  it('keeps the prefix as typed (fr:, c:)', () => {
    const e = el('fr: 3ds-p-3ds');
    expect(planPicotKindChange(e, [e.picots[0].id], 'sp')!.notation).toBe('fr: 3ds-sp-3ds');
    const c = el('c: 3ds-p-3ds');
    expect(planPicotKindChange(c, [c.picots[0].id], 'gp')!.notation).toBe('c: 3ds-gp-3ds');
  });
  it('several picots at once', () => {
    const e = el('r: p-2ds-p-2ds-p');
    const plan = planPicotKindChange(e, [e.picots[0].id, e.picots[2].id], 'lp')!;
    expect(plan.notation).toBe('r: lp-2ds-p-2ds-lp');
  });
  it('a repeat holding the picot is written out; the other repeat stays', () => {
    const e = el('r: 3*(2ds-p)-2ds-2*(1ds-sp)');
    const plan = planPicotKindChange(e, [e.picots[1].id], 'lp')!;
    expect(plan.notation).toBe('r: 2ds-p-2ds-lp-2ds-p-2ds-2*(1ds-sp)');
    expect(kindsOf(plan.notation)).toEqual(['p', 'lp', 'p', 'sp', 'sp']);
  });
  it('a repeat that is not touched stays as typed', () => {
    const e = el('r: 2ds-p-2ds-2*(1ds-p)');
    const plan = planPicotKindChange(e, [e.picots[0].id], 'lp')!;
    expect(plan.notation).toBe('r: 2ds-lp-2ds-2*(1ds-p)');
  });
  it('3p is written out when one of the three changes', () => {
    const e = el('r: 2ds-3p-2ds');
    const plan = planPicotKindChange(e, [e.picots[1].id], 'lp')!;
    expect(plan.notation).toBe('r: 2ds-p-lp-p-2ds');
  });
  it('counts the picots a bead token makes before the target', () => {
    const e = el('r: bc:YZ-2ds-p');
    expect(e.picots.length).toBe(3);
    const plan = planPicotKindChange(e, [e.picots[2].id], 'gp')!;
    expect(plan.notation).toBe('r: bc:YZ-2ds-gp');
  });
  it('refuses a bead picot', () => {
    const e = el('r: 2ds-bp:YZ-2ds-p');
    expect(planPicotKindChange(e, [e.picots[0].id], 'lp')).toBeNull();
  });
  it('refuses when the picot list does not match the notation', () => {
    const e = el('r: 2ds-p-2ds-p');
    const stale = { ...e, picots: [e.picots[0]] };
    expect(planPicotKindChange(stale, [e.picots[0].id], 'lp')).toBeNull();
  });
  it('split ring: side A (stored reversed) and side B', () => {
    const e = splitEl('2ds-p-2ds-sp-1ds', '1ds-p-3ds');
    // stored order: A reversed → [sp, p], then B → [p]
    expect(e.picots.map(picotKindToken)).toEqual(['sp', 'p', 'p']);
    const a1 = planPicotKindChange(e, [e.picots[0].id], 'lp')!;   // the sp, last picot of side A
    expect(a1.notation).toBe('sr: 2ds-p-2ds-lp-1ds');
    expect(a1.notationB).toBe('1ds-p-3ds');
    const b1 = planPicotKindChange(e, [e.picots[2].id], 'cjp')!;
    expect(b1.notation).toBe('sr: 2ds-p-2ds-sp-1ds');
    expect(b1.notationB).toBe('1ds-cjp-3ds');
    const both = planPicotKindChange(e, [e.picots[1].id, e.picots[2].id], 'gp')!;
    expect(both.notation).toBe('sr: 2ds-gp-2ds-sp-1ds');
    expect(both.notationB).toBe('1ds-gp-3ds');
  });
});

describe('picotKindSelectionInfo', () => {
  const e = el('r: p-2ds-lp-2ds-bp:Y');
  const sel = (i: number) => ({ elementId: 'E', picotId: e.picots[i].id });
  it('nothing selected → null', () => expect(picotKindSelectionInfo([], [e])).toBeNull());
  it('same kind → active', () => expect(picotKindSelectionInfo([sel(0)], [e])).toEqual({ active: 'p', canChange: true }));
  it('mixed → none lit, still changeable', () => expect(picotKindSelectionInfo([sel(0), sel(1)], [e])).toEqual({ active: null, canChange: true }));
  it('bead picot → cannot change', () => expect(picotKindSelectionInfo([sel(0), sel(2)], [e])).toEqual({ active: null, canChange: false }));
});
