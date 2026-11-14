// domain/ghostArrays.ts — rebuilding a mother's ghost copies (Task 2 step 2:
// moved out of tattingindex.tsx unchanged) and checking the array list read
// from a file (fix 14, session 64).
import { describe, it, expect } from 'vitest';
import { regenerateGhostArrays, normalizeGhostArrays, rewireJoinsForArrayChange, syncJointFlags } from '../../src/domain/ghostArrays';

const mother = (x = 0, y = -90) => ({
  id: 'm', type: 'ring', isGhostMother: true, center: { x, y }, rotation: 0, isClosed: true, stitchCount: 12,
  paths: [{ type: 'cubic', x: x + 10, y, endX: x - 10, endY: y, control1X: x + 10, control1Y: y - 20, control2X: x - 10, control2Y: y - 20 }],
  picots: [],
});
const ghost = (id: string) => ({ id, type: 'ghost', sourceId: 'm', center: { x: 0, y: 0 }, paths: [], picots: [] });
const polarArray = (extra: any = {}) => ({ id: 'A', type: 'polar', sourceId: 'm', instanceCount: 6, angle: 360, pivotId: 'grid', ghostIds: ['g1', 'g2', 'g3', 'g4', 'g5'], ...extra });
const ctx = { polarGrids: [{ id: 'grid', center: { x: 0, y: 0 } }], dsWidth: 10 };
const r2 = (n: number) => Math.round(n * 100) / 100;

describe('regenerateGhostArrays', () => {
  it('polar: old copies out, new copies around the grid centre, ids remapped slot by slot', () => {
    const els = [mother(), ghost('g1'), ghost('g2'), ghost('g3'), ghost('g4'), ghost('g5'), { id: 'other', type: 'chain' }];
    const res = regenerateGhostArrays(els, [polarArray()], ['m'], ctx);
    const ghosts = res.elements.filter(e => e.type === 'ghost');
    expect(ghosts).toHaveLength(5);
    expect(res.elements.some(e => e.id === 'g1')).toBe(false);
    expect(res.elements.map(e => e.id).slice(0, 2)).toEqual(['m', 'other']);    // the rest kept, copies last
    expect(ghosts.map(g => g.rotation)).toEqual([60, 120, 180, 240, 300]);
    expect(ghosts.map(g => [r2(g.center.x), r2(g.center.y)])[2]).toEqual([0, 90]);
    expect(ghosts.map(g => g.isBoundary)).toEqual([true, false, false, false, true]);
    expect([...res.connectionIdMap.keys()]).toEqual(['g1', 'g2', 'g3', 'g4', 'g5']);
    expect([...res.connectionIdMap.values()]).toEqual(ghosts.map(g => g.id));
    const arr = res.ghostArrays[0];
    expect(arr.ghostIds).toEqual(ghosts.map(g => g.id));
    expect(arr.boundaryIds).toEqual([ghosts[0].id, ghosts[4].id]);
    expect(arr.inheritedJoins).toEqual([]);
  });

  it('polar: a pivot grid that is gone → the mother\'s own centre; growing maps only the old slots', () => {
    const res = regenerateGhostArrays([mother(), ghost('g1')], [polarArray({ instanceCount: 4, ghostIds: ['g1'] })], ['m'], { ...ctx, polarGrids: [] });
    const ghosts = res.elements.filter(e => e.type === 'ghost');
    expect(ghosts).toHaveLength(3);
    for (const g of ghosts) expect([r2(g.center.x), r2(g.center.y)]).toEqual([0, -90]);
    expect([...res.connectionIdMap.entries()]).toEqual([['g1', ghosts[0].id]]);
  });

  it('polar: the pivot is the grid\'s centre (both x and y), not the mother\'s', () => {
    const res = regenerateGhostArrays([mother()], [polarArray({ instanceCount: 2, ghostIds: [] })], ['m'],
      { ...ctx, polarGrids: [{ id: 'grid', center: { x: 50, y: 50 } }] });
    const [g] = res.elements.filter(e => e.type === 'ghost');
    expect([r2(g.center.x), r2(g.center.y)]).toEqual([100, 190]);            // half a turn about (50, 50)
  });

  it('linear: spaced by the stored element size × spacing %, first copy is the boundary', () => {
    const arr = { id: 'L', type: 'linear', sourceId: 'm', instanceCount: 4, angle: 0, spacing: 150, rotStep: 0, elementSize: 40, ghostIds: [] };
    const res = regenerateGhostArrays([mother(100, 100)], [arr], ['m'], ctx);
    const ghosts = res.elements.filter(e => e.type === 'ghost');
    expect(ghosts.map(g => g.center)).toEqual([{ x: 160, y: 100 }, { x: 220, y: 100 }, { x: 280, y: 100 }]);
    expect(ghosts.map(g => g.isBoundary)).toEqual([true, false, false]);
    expect(res.ghostArrays[0].boundaryIds).toEqual([ghosts[0].id]);
  });

  it('nothing happens for an element that is not a mother, or a mother with no array', () => {
    const notMother = { ...mother(), isGhostMother: false };
    const els = [notMother, ghost('g1')];
    const arrays = [polarArray()];
    const res = regenerateGhostArrays(els, arrays, ['m', 'nobody'], ctx);
    expect(res.elements).toBe(els);
    expect(res.ghostArrays).toBe(arrays);
    expect(res.connectionIdMap.size).toBe(0);
    const res2 = regenerateGhostArrays([mother()], [], ['m'], ctx);
    expect(res2.elements.map(e => e.id)).toEqual(['m']);
  });

  it('other arrays in the list are left as they are', () => {
    const other = { id: 'B', type: 'polar', sourceId: 'x', instanceCount: 3, angle: 360, ghostIds: ['q'] };
    const res = regenerateGhostArrays([mother()], [polarArray({ ghostIds: [] }), other], ['m'], ctx);
    expect(res.ghostArrays[1]).toBe(other);
  });
});

// ── The array list from a file (fix 14, session 64) ─────────────────────────
describe('normalizeGhostArrays (the list read from a file)', () => {
  const els = [
    { id: 'm', type: 'ring', isGhostMother: true },
    { id: 'plain', type: 'ring' },
    { id: 'g1', type: 'ghost', sourceId: 'm' }, { id: 'g2', type: 'ghost', sourceId: 'm' },
    { id: 'x1', type: 'ghost', sourceId: 'other' },
    { id: 'lm', type: 'chain', isGhostMother: true }, { id: 'l1', type: 'ghost', sourceId: 'lm' },
  ];
  const polar = (extra: any = {}) => ({ id: 'A', name: 'Polar Array 1', type: 'polar', sourceId: 'm', instanceCount: 3, angle: 360, spacing: 0, rotStep: 0, pivotId: 'grid', ghostIds: ['g1', 'g2'], boundaryIds: ['g1', 'g2'], inheritedJoins: [], ...extra });
  const linear = (extra: any = {}) => ({ id: 'L', name: 'Linear Array 1', type: 'linear', sourceId: 'lm', instanceCount: 2, angle: 0, spacing: 100, elementSize: 85, rotStep: 0, ghostIds: ['l1'], boundaryIds: ['l1'], inheritedJoins: [], ...extra });

  it('a list as the app saves it comes back the same', () => {
    expect(normalizeGhostArrays([polar(), linear()], els)).toEqual([polar(), linear()]);
  });
  it('not a list / older file → no arrays', () => {
    for (const v of [undefined, null, 'x', 5, {}]) expect(normalizeGhostArrays(v, els)).toEqual([]);
  });
  it('drops an array whose mother is missing, a copy, or not a mother', () => {
    for (const sourceId of ['nobody', 'g1', 'plain', 5]) expect(normalizeGhostArrays([polar({ sourceId })], els)).toEqual([]);
  });
  it('drops an array with a bad required value — never guesses', () => {
    const bad = [
      { id: '' }, { id: 5 }, { type: 'spiral' }, { type: undefined },
      { instanceCount: 1 }, { instanceCount: 101 }, { instanceCount: 1e9 }, { instanceCount: 2.5 }, { instanceCount: '6' },
      { angle: NaN }, { angle: '360' }, { angle: Infinity }, { rotStep: 'x' },
    ];
    for (const b of bad) expect(normalizeGhostArrays([polar(b)], els), JSON.stringify(b)).toEqual([]);
    for (const b of [{ spacing: -1 }, { spacing: 501 }, { spacing: null }, { elementSize: 0 }, { elementSize: undefined }])
      expect(normalizeGhostArrays([linear(b)], els), JSON.stringify(b)).toEqual([]);
  });
  it('keeps only real copies of this mother; boundaries only from those; one array per id', () => {
    const [a] = normalizeGhostArrays([polar({ ghostIds: ['g1', 'x1', 'nope', 'm', 7, 'g2', 'g1'], boundaryIds: ['g2', 'x1', 'zzz'] }), polar({ name: 'dup' })], els);
    expect(a.ghostIds).toEqual(['g1', 'g2']);
    expect(a.boundaryIds).toEqual(['g2']);
    expect(normalizeGhostArrays([polar(), polar({ name: 'dup' })], els)).toHaveLength(1);
  });
  it('unknown fields are not carried over; the name is text, at most 200 characters', () => {
    const [a] = normalizeGhostArrays([polar({ evil: '<script>', name: 'n'.repeat(500) })], els);
    expect(a.evil).toBeUndefined();
    expect(a.name).toHaveLength(200);
    expect(normalizeGhostArrays([polar({ name: { x: 1 } })], els)[0].name).toBe('');
  });
  it('inherited joins: only well-formed ones; connExtra only as a fold with its four numbers', () => {
    const joins = [
      { sourcePicotIndex: 2, targetPicotIndex: 0, isSourceElement: true, anchorEnd: 'end' },
      { sourcePicotIndex: '__start__', targetPicotIndex: 1, isSourceElement: false, anchorEnd: 'sideways' },
      { sourcePicotIndex: 2, targetPicotIndex: 0, isSourceElement: true, connExtra: { connectionType: 'fold', outerLength: 120, innerLength: 'x', angleA: 5, angleB: 0, color: 'red' } },
      { sourcePicotIndex: 2, targetPicotIndex: 0, isSourceElement: true, connExtra: { materialId: 'm1', isInheritedJoin: 'B' } },
      { sourcePicotIndex: -1, targetPicotIndex: 0, isSourceElement: true },
      { sourcePicotIndex: 1000, targetPicotIndex: 0, isSourceElement: true },
      { sourcePicotIndex: 'p1', targetPicotIndex: 0, isSourceElement: true },
      { sourcePicotIndex: 1, targetPicotIndex: 0 },                       // no isSourceElement (legacy: skipped by the app anyway)
      null, 'join',
    ];
    const [a] = normalizeGhostArrays([polar({ inheritedJoins: joins })], els);
    expect(a.inheritedJoins).toEqual([
      { sourcePicotIndex: 2, targetPicotIndex: 0, isSourceElement: true, anchorEnd: 'end' },
      { sourcePicotIndex: '__start__', targetPicotIndex: 1, isSourceElement: false },
      { sourcePicotIndex: 2, targetPicotIndex: 0, isSourceElement: true, connExtra: { connectionType: 'fold', outerLength: 120, innerLength: 100, angleA: 5, angleB: 0 } },
      { sourcePicotIndex: 2, targetPicotIndex: 0, isSourceElement: true },
    ]);
  });
});

// ── Joins when an array's settings change (fix 13, session 64) ──────────────
describe('rewireJoinsForArrayChange', () => {
  const conn = (id: string, a: string, b: string, extra: any = {}) => ({ id, picots: [{ elementId: a, picotId: 'p0' }, { elementId: b, picotId: 'p2' }], ...extra });
  const oldArr = (rule: any) => ({ id: 'A', sourceId: 'm', ghostIds: ['g1', 'g2', 'g3'], inheritedJoins: [rule] });
  const newArr = { id: 'A', sourceId: 'm', ghostIds: ['n1', 'n2', 'n3', 'n4', 'n5'] };
  const START = { isSourceElement: true, anchorEnd: 'start', sourcePicotIndex: 0, targetPicotIndex: 2 };

  it('copied joins are dropped (made again later); the anchor moves to the new first copy, keeping its settings', () => {
    const conns = [
      conn('anchor', 'm', 'g1', { connectionType: 'fold', outerLength: 99 }),
      conn('c1', 'g1', 'g2', { isInheritedJoin: 'A' }), conn('c2', 'g2', 'g3', { isInheritedJoin: 'A' }),
      conn('c3', 'g3', 'm', { isInheritedJoin: 'A' }),
    ];
    const out = rewireJoinsForArrayChange(conns, oldArr(START), newArr);
    expect(out).toEqual([{ ...conns[0], picots: [{ elementId: 'm', picotId: 'p0' }, { elementId: 'n1', picotId: 'p2' }] }]);
  });
  it('an anchor on the last copy moves to the new last copy', () => {
    const out = rewireJoinsForArrayChange([conn('anchor', 'g3', 'm')], oldArr({ ...START, anchorEnd: 'end' }), newArr);
    expect(out.map(c => c.picots.map((p: any) => p.elementId))).toEqual([['n5', 'm']]);
  });
  it('first ↔ last copy rule (no mother): that join follows both ends', () => {
    const out = rewireJoinsForArrayChange([conn('anchor', 'g1', 'g3')], oldArr({ isSourceElement: false, sourcePicotIndex: 0, targetPicotIndex: 2 }), newArr);
    expect(out.map(c => c.picots.map((p: any) => p.elementId))).toEqual([['n1', 'n5']]);
  });
  it('other joins to a copy are removed; joins elsewhere (and copied joins of OTHER arrays) are kept as they are', () => {
    const elsewhere = conn('x', 'm', 'chain'), other = conn('o', 'q1', 'q2', { isInheritedJoin: 'B' });
    const conns = [conn('h', 'g2', 'chain'), conn('m-g2', 'm', 'g2'), elsewhere, other];
    const out = rewireJoinsForArrayChange(conns, oldArr(START), newArr);
    expect(out).toEqual([elsewhere, other]);
    expect(out[0]).toBe(elsewhere);
  });
  it('one copy only: the copied join back to the mother (same pair as the anchor) is not taken for the anchor', () => {
    const one = { id: 'A', sourceId: 'm', ghostIds: ['g1'], inheritedJoins: [START] };
    const out = rewireJoinsForArrayChange([conn('anchor', 'm', 'g1'), conn('wrap', 'g1', 'm', { isInheritedJoin: 'A' })], one, newArr);
    expect(out.map(c => c.id)).toEqual(['anchor']);
  });
  it('no rule recorded → every join to a copy goes', () => {
    const out = rewireJoinsForArrayChange([conn('j', 'm', 'g1')], { ...oldArr(START), inheritedJoins: [] }, newArr);
    expect(out).toEqual([]);
  });
});

describe('syncJointFlags', () => {
  const el = (id: string, joints: boolean[]) => ({ id, picots: joints.map((j, i) => ({ id: `p${i}`, isJoint: j })) });
  it('marks follow the real joins, only on the listed elements; unchanged elements are the same objects', () => {
    const els = [el('a', [true, true, false]), el('b', [false, false]), el('c', [true])];
    const conns = [{ picots: [{ elementId: 'a', picotId: 'p2' }, { elementId: 'b', picotId: 'p1' }] }];
    const out = syncJointFlags(els, conns, new Set(['a', 'b']));
    expect(out[0].picots.map((p: any) => p.isJoint)).toEqual([false, false, true]);
    expect(out[1].picots.map((p: any) => p.isJoint)).toEqual([false, true]);
    expect(out[2]).toBe(els[2]);                                     // not listed: left alone
    const same = syncJointFlags(out, conns, new Set(['a', 'b']));
    expect(same[0]).toBe(out[0]);
  });
});
