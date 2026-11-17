// geometry/arrays.ts — one copy of an element at slot `index` of a polar or
// linear array (Task 2 step 1: moved out of tattingindex.tsx unchanged).
import { describe, it, expect } from 'vitest';
import { createPolarInstance, createLinearInstance } from '../../src/geometry/arrays';
import { baseElements, bake } from './helpers/patterns';

const ring = () => ({
  id: 'r1', type: 'ring', center: { x: 0, y: -90 }, rotation: 0, orderNumber: 3, groupId: 'g1',
  isClosed: true, stitchCount: 12, isGhostMother: true,
  paths: [{ type: 'cubic', x: 10, y: -90, endX: -10, endY: -90, control1X: 10, control1Y: -110, control2X: -10, control2Y: -110 }],
  picots: [{ id: 'p0', stitchesBefore: 3 }],
});
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('createPolarInstance', () => {
  it('a ghost: turned about the pivot, a full copy (notation kept) without what makes a pattern member', () => {
    const g: any = createPolarInstance({ ...ring(), notation: 'jk: 12ss', roundId: 'R1', squeeze: 0.3, polarRotationGridId: 'G' }, 1, 0, 0, 6, 360, { asGhost: true, sourceId: 'r1', isBoundary: true });
    expect(g.notation).toBe('jk: 12ss');
    expect(g.squeeze).toBe(0.3);
    expect(g.isGhostMother).toBeUndefined();
    expect(g.roundId).toBeUndefined();
    expect(g.polarRotationGridId).toBeUndefined();
    expect(g.type).toBe('ghost');
    expect(g.sourceType).toBe('ring');
    expect(g.sourceId).toBe('r1');
    expect(g.isBoundary).toBe(true);
    expect(g.rotation).toBe(60);
    close(g.center.x, 90 * Math.sin(Math.PI / 3)); close(g.center.y, -45);
    close(g.paths[0].x, 10 * 0.5 + 90 * Math.sin(Math.PI / 3));
    expect(g.picots).toEqual([{ id: 'p0', stitchesBefore: 3 }]);
    expect(g.orderNumber).toBeUndefined();
    expect(g.groupId).toBeUndefined();
    expect(g.id).not.toBe('r1');
  });
  it('a real copy: everything copied, new id, no order number, new group, grid id', () => {
    const src = ring();
    const c: any = createPolarInstance(src, 3, 0, 0, 6, 360, { groupIdMap: new Map([['g1', 'g2']]), polarGridId: 'grid' });
    expect(c.type).toBe('ring');
    expect(c.orderNumber).toBeUndefined();
    expect(c.groupId).toBe('g2');
    expect(c.polarRotationGridId).toBe('grid');
    expect(c.rotation).toBe(180);
    close(c.center.x, 0); close(c.center.y, 90);
    expect(src.center).toEqual({ x: 0, y: -90 });               // the source is not touched
  });
});

describe('createLinearInstance', () => {
  it('slot i is moved i × (dx, dy); a ghost drops isGhostMother', () => {
    const g: any = createLinearInstance(ring(), 2, 85, 0, 0, 10, { asGhost: true, isBoundary: false });
    expect(g.type).toBe('ghost');
    expect(g.sourceType).toBe('ring');
    expect(g.sourceId).toBe('r1');
    expect(g.isGhostMother).toBeUndefined();
    expect(g.center).toEqual({ x: 170, y: -90 });
    expect(g.paths[0].x).toBe(180);
    expect(g.paths[0].control2X).toBe(160);
  });
  it('a rotation step turns each slot about its own centre', () => {
    const c: any = createLinearInstance(ring(), 1, 50, 0, 90, 10, {});
    expect(c.rotation).toBe(90);
    expect(c.center).toEqual({ x: 50, y: -90 });
    expect(c.paths[0].x).not.toBe(60);
  });
});

// Session 64: polar ghosts were a short field list without the notation, so
// the realistic view drew jk, beads and mixed stitches as plain ds.
describe('a ghost copy draws exactly like a real copy, for every element kind', () => {
  const base = baseElements().filter((e: any) => e.type !== 'ghost');
  const circ = base.find((e: any) => e.id === 'circ');
  const kinds = [...base,
    { ...JSON.parse(JSON.stringify(circ)), id: 'fr', notation: 'fr: 6ds-p-6ds' },
    { ...JSON.parse(JSON.stringify(circ)), id: 'mr', notation: 'mr: 6ds-p-6ds' },
    { ...JSON.parse(JSON.stringify(circ)), id: 'beads', notation: 'r: 4ds-bc:Y-1ds-p-2rds-5ds' },
    { ...JSON.parse(JSON.stringify(circ)), id: 'mixed', notation: 'r: 3rds-p-3lss-3ds-3ss' },
  ];
  const ids = (svg: string) => svg.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, 'ID').replace(/data-el="[^"]*"/g, '');
  it.each(kinds.map((k: any) => [k.id, k]))('%s', (_id, el: any) => {
    const real = createPolarInstance(el, 1, el.center.x, el.center.y + 50, 3, 360, {});
    const ghost = createPolarInstance(el, 1, el.center.x, el.center.y + 50, 3, 360, { asGhost: true, sourceId: el.id });
    expect(ids(bake([ghost]))).toBe(ids(bake([real])));
    const linReal = createLinearInstance(el, 1, 70, 0, 15, 10, {});
    const linGhost = createLinearInstance(el, 1, 70, 0, 15, 10, { asGhost: true, sourceId: el.id });
    expect(ids(bake([linGhost]))).toBe(ids(bake([linReal])));
  });
});

