// geometry/arrays.ts — one copy of an element at slot `index` of a polar or
// linear array (Task 2 step 1: moved out of tattingindex.tsx unchanged).
import { describe, it, expect } from 'vitest';
import { createPolarInstance, createLinearInstance } from '../../src/geometry/arrays';

const ring = () => ({
  id: 'r1', type: 'ring', center: { x: 0, y: -90 }, rotation: 0, orderNumber: 3, groupId: 'g1',
  isClosed: true, stitchCount: 12, isGhostMother: true,
  paths: [{ type: 'cubic', x: 10, y: -90, endX: -10, endY: -90, control1X: 10, control1Y: -110, control2X: -10, control2Y: -110 }],
  picots: [{ id: 'p0', stitchesBefore: 3 }],
});
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('createPolarInstance', () => {
  it('a ghost: turned about the pivot, an explicit field list, the source kept', () => {
    const g: any = createPolarInstance(ring(), 1, 0, 0, 6, 360, { asGhost: true, sourceId: 'r1', isBoundary: true });
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
