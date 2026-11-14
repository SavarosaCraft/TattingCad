// Ghost arrays — today's behaviour, recorded before Task 2 moves the code
// out of tattingindex.tsx (session 64, step 0). Ghost arrays are benched
// (experimental), so these tests pin what the app DOES, including two things
// that look wrong (marked TO CONFIRM). Every test makes its arrays through
// the real dialogs.
//
// Fixture ghost-source.tatcad: a ring "r: 3ds-p-3ds-p-3ds-p-3ds" (id
// mother-ring) at (0, -90) with a polar grid centred on (0, 0), and a chain
// "c: 4ds-p-4ds" (id mother-chain) at (220, 160).
//
// After every step the saved file is written into one stored reference
// (baselines/ghost-arrays.scenario.txt), with generated ids replaced by
// stable names (#1, #2 … in order of appearance) — so a refactor must give
// the same elements, copies and joins at every step.
import { test, expect, fixture, type App } from './harness';
import { checkBaseline } from '../helpers/baseline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const F = '/home/me/Ghosts.tatcad';
const here = path.dirname(fileURLToPath(import.meta.url));

// ── helpers ───────────────────────────────────────────────────────────────
/** Pattern coordinates → screen pixels (through the drawing's own transform). */
const toScreen = (a: App, x: number, y: number) => a.page.evaluate(([x, y]) => {
  const g = document.querySelector('g[data-round]') as SVGGraphicsElement;
  const p = new DOMPoint(x, y).matrixTransform(g.getScreenCTM()!);
  return [p.x, p.y] as [number, number];
}, [x, y] as const);

const selectTool = async (a: App) => {
  await a.page.getByTitle(a.t('toolSelect'), { exact: true }).first().click();
  await a.page.waitForTimeout(150);
};
/** Box-selects whatever lies inside a rectangle given in pattern coordinates. */
const selectBox = async (a: App, x1: number, y1: number, x2: number, y2: number) => {
  await a.page.keyboard.press('Escape');
  await selectTool(a);
  const [sx1, sy1] = await toScreen(a, x1, y1), [sx2, sy2] = await toScreen(a, x2, y2);
  await a.page.mouse.move(sx1, sy1);
  await a.page.mouse.down();
  await a.page.mouse.move(sx2, sy2, { steps: 6 });
  await a.page.mouse.up();
  await a.page.waitForTimeout(300);
};
const selectRing = (a: App) => selectBox(a, -40, -140, 40, -40);
// start the box in empty space below-right — starting on the chain would drag it
const selectChain = (a: App) => selectBox(a, 295, 215, 160, 110);

const openGhostSource = async (launch: any): Promise<App> => {
  const a: App = await launch({ fs: { [F]: fixture('ghost-source.tatcad') } });
  await a.newProject();
  await a.openFile(F);
  return a;
};
/** Arrange → Polar Array… → "Create as ghosts" → Apply (6 copies, around the grid). */
const polarGhosts = async (a: App) => {
  await selectRing(a);
  expect(await a.status()).toContain('1 object selected');
  await a.menu('menuArrange', 'arrangePolarArray', { escape: false });
  await a.page.locator('#polar-ghosts').check();
  await a.page.getByText(a.t('polarArrayApply'), { exact: true }).click();
  await a.page.waitForTimeout(600);
};
/** Arrange → Linear Array… → "Create as ghosts" → Apply (4 copies, 100 %). */
const linearGhosts = async (a: App) => {
  await selectChain(a);
  expect(await a.status()).toContain('1 object selected');
  await a.menu('menuArrange', 'arrangeLinearArray', { escape: false });
  await a.page.locator('#linear-ghosts').check();
  await a.page.getByText(a.t('polarArrayApply'), { exact: true }).last().click();
  await a.page.waitForTimeout(600);
};
const openManager = async (a: App) => {
  await a.menu('menuArrange', 'ghostArrayManagerTitle');
  await a.page.waitForTimeout(300);
};
const closeManager = async (a: App) => {
  await a.page.keyboard.press('Escape');
  await a.page.waitForTimeout(300);
};
/** Picot Join mode: the dot nearest each pattern point, Shift for the second, then J. */
const joinDots = async (a: App, p1: [number, number], p2: [number, number]) => {
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Shift+J');
  await a.page.waitForTimeout(300);
  const tip = a.page.getByRole('button', { name: 'Got it', exact: true });
  if (await tip.count()) { await tip.first().click(); await a.page.waitForTimeout(200); }
  const [x1, y1] = await toScreen(a, ...p1), [x2, y2] = await toScreen(a, ...p2);
  await a.page.mouse.click(x1, y1);
  await a.page.waitForTimeout(200);
  await a.page.keyboard.down('Shift');
  await a.page.mouse.click(x2, y2);
  await a.page.keyboard.up('Shift');
  await a.page.waitForTimeout(200);
  await a.page.keyboard.press('j');
  await a.page.waitForTimeout(500);
  await a.page.keyboard.press('Shift+J');
  await a.page.waitForTimeout(300);
};
// The ring's right picot (17.1, -82.8) and the first copy's left picot,
// i.e. the ring's left picot (-17.1, -82.8) turned 60° about the grid.
const MOTHER_RIGHT: [number, number] = [17.1, -82.8];
const COPY1_LEFT: [number, number] = [63.2, -56.3];

const saveFile = async (a: App) => { await a.save(); return a.saved(F); };
const ghosts = (file: any, sourceId: string) => file.elements.filter((e: any) => e.type === 'ghost' && e.sourceId === sourceId);
const round = (n: number) => Math.round(n * 100) / 100;
const centres = (els: any[]) => els.map((e: any) => [round(e.center.x), round(e.center.y)]);

/** The saved file as text, ids made stable, numbers to 6 places, without camera / date. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const stable = (file: any): string => {
  const { created, camera, zoom, ...rest } = file;
  void created; void camera; void zoom;
  const text = JSON.stringify(rest, (_k, v) => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v, 1);
  const names = new Map<string, string>();
  return text.replace(UUID, id => { if (!names.has(id)) names.set(id, `#${names.size + 1}`); return names.get(id)!; });
};
const scenario: string[] = [];
const record = (step: string, file: any) => { scenario.push(`=== ${step}\n${stable(file)}`); };

// ── the tests ─────────────────────────────────────────────────────────────
test.describe.configure({ mode: 'serial' });

test('a polar ghost array: 5 copies around the grid, the first and last are boundary copies', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  const file = await saveFile(a);
  record('polar ghost array made', file);
  const copies = ghosts(file, 'mother-ring');
  expect(copies).toHaveLength(5);
  expect(file.elements.find((e: any) => e.id === 'mother-ring').isGhostMother).toBe(true);
  expect(copies.map((g: any) => g.isBoundary)).toEqual([true, false, false, false, true]);
  expect(copies.map((g: any) => g.rotation)).toEqual([60, 120, 180, 240, 300]);
  expect(centres(copies)).toEqual([[77.94, -45], [77.94, 45], [0, 90], [-77.94, 45], [-77.94, -45]]);
  expect(copies.every((g: any) => g.sourceType === 'ring' && g.stitchCount === 12 && g.picots.length === 3)).toBe(true);
  expect(await a.status()).toContain('Elements: 7');
});

test('a linear ghost array: 3 copies in a row, the first is the boundary copy', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await linearGhosts(a);
  const file = await saveFile(a);
  record('linear ghost array made', file);
  expect(file.elements.find((e: any) => e.id === 'mother-chain').center).toEqual({ x: 220, y: 160 });   // not moved
  const copies = ghosts(file, 'mother-chain');
  expect(copies).toHaveLength(3);
  expect(copies.map((g: any) => !!g.isBoundary)).toEqual([true, false, false]);
  const ys = copies.map((g: any) => round(g.center.y));
  expect(new Set(ys)).toEqual(new Set([160]));                    // a horizontal row
  const xs = copies.map((g: any) => g.center.x);
  expect(xs[0]).toBeGreaterThan(220);
  expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 6);            // evenly spaced
});

test('moving the mother moves its copies; Undo (one step per arrow press) brings them back', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  const before = await saveFile(a);
  await selectRing(a);
  for (let i = 0; i < 3; i++) await a.page.keyboard.press('Shift+ArrowRight');   // 3 ds = 30 units
  await a.page.waitForTimeout(400);
  const moved = await saveFile(a);
  record('mother moved 3 ds right', moved);
  const mother = moved.elements.find((e: any) => e.id === 'mother-ring');
  expect(round(mother.center.x)).toBe(30);
  const was = centres(ghosts(before, 'mother-ring')), now = centres(ghosts(moved, 'mother-ring'));
  expect(now).toHaveLength(5);
  expect(now).not.toEqual(was);                                     // the copies followed (around the grid)
  for (const [x, y] of now) expect(Math.hypot(x, y)).toBeCloseTo(Math.hypot(30, -90), 1);
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Control+z');
  await a.page.waitForTimeout(500);
  const one = await saveFile(a);
  expect(round(one.elements.find((e: any) => e.id === 'mother-ring').center.x)).toBe(20);   // each press is one step
  for (const [x, y] of centres(ghosts(one, 'mother-ring'))) expect(Math.hypot(x, y)).toBeCloseTo(Math.hypot(20, -90), 1);
  for (let i = 0; i < 2; i++) { await a.page.keyboard.press('Control+z'); await a.page.waitForTimeout(400); }
  const undone = await saveFile(a);
  expect(round(undone.elements.find((e: any) => e.id === 'mother-ring').center.x)).toBe(0);
  expect(centres(ghosts(undone, 'mother-ring'))).toEqual(was);
});

test('editing the mother\'s notation changes every copy', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await selectRing(a);
  await a.typeNotation('r: 3ds-p-3ds-p-3ds-p-3ds', 'r: 4ds-p-4ds-p-4ds-p-4ds');
  await a.page.keyboard.press('Escape');
  const file = await saveFile(a);
  record('mother notation 3ds → 4ds', file);
  const copies = ghosts(file, 'mother-ring');
  expect(copies).toHaveLength(5);
  expect(copies.every((g: any) => g.stitchCount === 16)).toBe(true);
  expect(copies.every((g: any) => g.picots.map((p: any) => p.stitchesBefore).join() === '4,8,12')).toBe(true);
});

test('a join between the mother and the first copy is repeated around the array', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await joinDots(a, MOTHER_RIGHT, COPY1_LEFT);
  const file = await saveFile(a);
  record('mother ↔ first copy joined', file);
  const ids = new Set(file.elements.map((e: any) => e.id));
  expect(file.picotConnections.length).toBeGreaterThanOrEqual(2);  // the join itself + its repeats
  for (const c of file.picotConnections) for (const p of c.picots) expect(ids.has(p.elementId)).toBe(true);
  const copies = ghosts(file, 'mother-ring');
  const joinedCopies = copies.filter((g: any) => g.picots.some((p: any) => p.isJoint)).length;
  expect(joinedCopies).toBeGreaterThanOrEqual(2);
});

test('joins survive the copies being rebuilt (mother moved after joining)', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await joinDots(a, MOTHER_RIGHT, COPY1_LEFT);
  const joined = await saveFile(a);
  await selectRing(a);
  await a.page.keyboard.press('Shift+ArrowUp');
  await a.page.waitForTimeout(400);
  const file = await saveFile(a);
  record('joined, then mother moved 1 ds up', file);
  const ids = new Set(file.elements.map((e: any) => e.id));
  for (const c of file.picotConnections) for (const p of c.picots) expect(ids.has(p.elementId)).toBe(true);
  expect(file.picotConnections).toHaveLength(joined.picotConnections.length);
});

// ── Array Manager → Apply (fix 13, session 64) ─────────────────────────────
// Apply gives the SAME array new settings; joins copied around it are made
// again for the new copies, the user's own (anchor) join follows its copy,
// other joins to its copies are removed (user: remove them), and every
// "joined" mark matches a real join. One click = one Undo step.
const managerApply = async (a: App, fields: { count?: string; angle?: string }) => {
  await openManager(a);
  if (fields.count) await a.page.locator('input[id^="ghost-count-"]').first().fill(fields.count);
  if (fields.angle) await a.page.locator('input[id^="ghost-angle-"]').first().fill(fields.angle);
  await a.page.getByRole('button', { name: a.t('ghostArrayApply'), exact: true }).first().click();
  await a.page.waitForTimeout(500);
  await closeManager(a);
};
const pairs = (file: any) => file.picotConnections.map((c: any) => c.picots.map((p: any) => p.elementId));
/** Every "joined" mark has a join, and every join end is marked. */
const marksMatchJoins = (file: any) => {
  const inAJoin = new Set(file.picotConnections.flatMap((c: any) => c.picots.map((p: any) => `${p.elementId}/${p.picotId}`)));
  const marked = new Set(file.elements.flatMap((e: any) => (e.picots ?? []).filter((p: any) => p.isJoint).map((p: any) => `${e.id}/${p.id}`)));
  expect([...marked].filter(k => !inAJoin.has(k)), 'marked "joined" but in no join').toEqual([]);
  expect([...inAJoin].filter(k => !marked.has(k as string)), 'in a join but not marked').toEqual([]);
};
/** A closed ring of joins: mother → copy 1 → … → last copy → mother. */
const closedRing = (file: any) => {
  const ids = ['mother-ring', ...ghosts(file, 'mother-ring').map((g: any) => g.id)];
  const want = ids.map((id, i) => [id, ids[(i + 1) % ids.length]].sort().join('|')).sort();
  expect(pairs(file).map((p: string[]) => [...p].sort().join('|')).sort()).toEqual(want);
};

test('Array Manager: Apply with a bigger count — copies around the circle, the joins follow (fix 13)', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await joinDots(a, MOTHER_RIGHT, COPY1_LEFT);
  closedRing(await saveFile(a));
  await managerApply(a, { count: '8' });
  const file = await saveFile(a);
  record('Array Manager: count 6 → 8', file);
  const copies = ghosts(file, 'mother-ring');
  expect(copies).toHaveLength(7);
  expect(copies.map((g: any) => g.rotation)).toEqual([45, 90, 135, 180, 225, 270, 315]);
  expect(file.ghostArrays).toHaveLength(1);                         // the same array, not a new one
  expect(file.ghostArrays[0].instanceCount).toBe(8);
  expect(file.ghostArrays[0].inheritedJoins).toHaveLength(1);       // its join rule kept
  closedRing(file);                                                 // 8 joins, closing one from copy 7
  marksMatchJoins(file);
});

test('Apply with a smaller count — no joins left to copies that are gone (fix 13)', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await joinDots(a, MOTHER_RIGHT, COPY1_LEFT);
  await managerApply(a, { count: '4' });
  const file = await saveFile(a);
  record('Array Manager: count 6 → 4', file);
  expect(ghosts(file, 'mother-ring')).toHaveLength(3);
  const ids = new Set(file.elements.map((e: any) => e.id));
  for (const c of file.picotConnections) for (const p of c.picots) expect(ids.has(p.elementId), 'a join points at a gone copy').toBe(true);
  closedRing(file);
  marksMatchJoins(file);
});

test('Apply is one Undo step; Undo gives back the copies and joins as they were', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await joinDots(a, MOTHER_RIGHT, COPY1_LEFT);
  const before = await saveFile(a);
  await managerApply(a, { count: '8' });
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Control+z');
  await a.page.waitForTimeout(500);
  const undone = await saveFile(a);
  // Decision 17 (fixed, session 64): the join's Undo step now holds the
  // array's new join rule — Undo brings back everything, the rule included…
  expect(stable(undone)).toBe(stable(before));
  expect(undone.ghostArrays[0].inheritedJoins).toHaveLength(1);
  // …so the array still repeats the join afterwards
  await managerApply(a, { count: '8' });
  closedRing(await saveFile(a));
});

/** The join dot nearest to a pattern point (Join mode must be on). */
const dotNear = async (a: App, x: number, y: number): Promise<[number, number]> => a.page.evaluate(([x, y]) => {
  // A copy's dots are drawn inside its own transform: take each dot's centre
  // on screen and turn it back into pattern coordinates.
  const round = (document.querySelector('g[data-round]') as SVGGraphicsElement).getScreenCTM()!.inverse();
  let best: [number, number] = [x, y], d = Infinity;
  for (const c of document.querySelectorAll('g[data-round] circle') as NodeListOf<SVGCircleElement>) {
    const m = c.getScreenCTM(); if (!m) continue;
    const p = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value).matrixTransform(m).matrixTransform(round);
    const dd = Math.hypot(p.x - x, p.y - y);
    if (dd < d) { d = dd; best = [p.x, p.y]; }
  }
  return best;
}, [x, y] as const);

test('the join can be to the LAST copy — after Apply it moves to the new last copy (fix 13)', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await joinDots(a, [-17.1, -82.8], [-63.2, -56.3]);                // mother's left picot ↔ copy 5 (300°)
  const joined = await saveFile(a);
  closedRing(joined);
  expect(joined.ghostArrays[0].inheritedJoins[0].anchorEnd).toBe('end');
  await managerApply(a, { count: '8' });
  const file = await saveFile(a);
  record('join to the last copy, count 6 → 8', file);
  closedRing(file);
  marksMatchJoins(file);
});

test('a join by hand from a copy to another element is removed by Apply (user: remove them)', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Shift+J');
  await a.page.waitForTimeout(300);
  const tip = a.page.getByRole('button', { name: 'Got it', exact: true });
  if (await tip.count()) { await tip.first().click(); await a.page.waitForTimeout(200); }
  const chainDot = await dotNear(a, 220, 150);
  await a.page.keyboard.press('Shift+J');
  await a.page.waitForTimeout(300);
  // Join mode shows dots only on the boundary copies: copy 1's middle picot ↔ the chain's picot
  await joinDots(a, [55.65, -32.13], chainDot);
  const joined = await saveFile(a);
  expect(pairs(joined)).toHaveLength(1);
  expect(pairs(joined)[0]).toContain('mother-chain');
  await managerApply(a, { count: '8' });
  const file = await saveFile(a);
  expect(file.picotConnections).toEqual([]);
  marksMatchJoins(file);
  expect(file.elements.find((e: any) => e.id === 'mother-chain').picots.some((p: any) => p.isJoint)).toBe(false);
});

test('a linear array: Apply with a new count keeps the same array, copies evenly spaced', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await linearGhosts(a);
  const before = await saveFile(a);
  await managerApply(a, { count: '6' });
  const file = await saveFile(a);
  record('linear array: count 4 → 6', file);
  const copies = ghosts(file, 'mother-chain');
  expect(copies).toHaveLength(5);
  expect(file.ghostArrays.map((g: any) => g.id)).toEqual(before.ghostArrays.map((g: any) => g.id));
  const xs = copies.map((g: any) => g.center.x);
  for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(xs[1] - xs[0], 6);
  expect(centres(copies).slice(0, 3)).toEqual(centres(ghosts(before, 'mother-chain')));
});

test('Apply with nothing changed changes nothing (a join by hand stays too)', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Shift+J');
  await a.page.waitForTimeout(300);
  const tip = a.page.getByRole('button', { name: 'Got it', exact: true });
  if (await tip.count()) { await tip.first().click(); await a.page.waitForTimeout(200); }
  const chainDot = await dotNear(a, 220, 150);
  await a.page.keyboard.press('Shift+J');
  await a.page.waitForTimeout(300);
  await joinDots(a, [55.65, -32.13], chainDot);                      // copy 1 ↔ the chain (removed by a real change)
  const before = await saveFile(a);
  expect(before.picotConnections).toHaveLength(1);
  await managerApply(a, {});
  expect(stable(await saveFile(a))).toBe(stable(before));
});

test('Convert turns one array\'s copies into real rings; its joins stay', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await linearGhosts(a);
  await joinDots(a, MOTHER_RIGHT, COPY1_LEFT);
  await openManager(a);
  await a.page.getByRole('button', { name: a.t('ghostArrayConvert'), exact: true }).first().click();
  await a.page.waitForTimeout(300);
  await a.page.locator('.tcad-dialog.w-80').getByRole('button', { name: a.t('ghostArrayConvert'), exact: true }).click();   // the confirm box on top
  await a.page.waitForTimeout(500);
  await closeManager(a);
  const file = await saveFile(a);
  record('first array converted', file);
  expect(ghosts(file, 'mother-ring')).toHaveLength(0);
  expect(ghosts(file, 'mother-chain')).toHaveLength(3);              // the other array is untouched
  const rings = file.elements.filter((e: any) => e.type === 'ring');
  expect(rings).toHaveLength(6);
  const ids = new Set(file.elements.map((e: any) => e.id));
  for (const c of file.picotConnections) for (const p of c.picots) expect(ids.has(p.elementId)).toBe(true);
  expect(file.picotConnections.length).toBeGreaterThanOrEqual(2);
});

test('Convert All turns every copy real', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await linearGhosts(a);
  await openManager(a);
  await a.page.getByRole('button', { name: a.t('ghostArrayConvertAllTitle'), exact: true }).click();
  await a.page.waitForTimeout(300);
  await a.page.getByRole('button', { name: a.t('ghostArrayConvertAllBtn'), exact: true }).click();
  await a.page.waitForTimeout(500);
  await closeManager(a);
  const file = await saveFile(a);
  record('all arrays converted', file);
  expect(file.elements.filter((e: any) => e.type === 'ghost')).toHaveLength(0);
  expect(file.elements.filter((e: any) => e.type === 'ring')).toHaveLength(6);
  expect(file.elements.filter((e: any) => e.type === 'chain')).toHaveLength(4);
  await openManager(a);
  expect(await a.page.getByText(a.t('ghostArrayManagerEmpty')).count()).toBe(1);
});

test('deleting the mother removes its copies and its array', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await selectRing(a);
  await a.page.keyboard.press('Delete');
  await a.page.waitForTimeout(400);
  const dialog = await a.dialog();
  if (dialog) { await a.page.locator('.fixed button').filter({ hasText: /Delete|OK|Yes/ }).last().click(); await a.page.waitForTimeout(400); }
  const file = await saveFile(a);
  record('mother deleted', file);
  expect(file.elements.map((e: any) => e.id)).toEqual(['mother-chain']);
  await openManager(a);
  expect(await a.page.getByText(a.t('ghostArrayManagerEmpty')).count()).toBe(1);
});

test('Undo takes the array away; Redo brings it back with its copies', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  const made = await saveFile(a);
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Control+z');
  await a.page.waitForTimeout(500);
  const undone = await saveFile(a);
  expect(undone.elements.map((e: any) => e.id)).toEqual(['mother-ring', 'mother-chain']);
  await a.page.keyboard.press('Control+Shift+z');
  await a.page.waitForTimeout(500);
  const redone = await saveFile(a);
  expect(stable(redone)).toBe(stable(made));
  // …and the array still works after Redo: the copies follow the mother
  await selectRing(a);
  await a.page.keyboard.press('Shift+ArrowRight');
  await a.page.waitForTimeout(400);
  expect(centres(ghosts(await saveFile(a), 'mother-ring'))).not.toEqual(centres(ghosts(made, 'mother-ring')));
});

// ── Fix 14 / 15 (session 64): the array list is saved with the pattern ─────
// (was pinned as TO CONFIRM in step 0: after reopening the copies stopped
// following the mother; opening another file kept the old pattern's arrays).
const managerListsPolar = async (a: App) => {
  await openManager(a);
  const n = await a.page.getByText(a.t('ghostArrayTypePolar'), { exact: true }).count();
  await closeManager(a);
  return n;
};
/** Next run of the program with this run's files (optionally changed first), then open F. */
const reopen = async (launch: any, a: App, change?: (file: any) => any, file = F): Promise<App> => {
  const files = await a.fs();
  if (change) files[file] = JSON.stringify(change(JSON.parse(files[file])));
  await a.end();
  const b: App = await launch({ fs: files });
  await b.newProject();
  await b.openFile(file);
  return b;
};
const radiusOK = (file: any, mx: number, my: number) => {
  const cs = centres(ghosts(file, 'mother-ring'));
  expect(cs).toHaveLength(5);
  for (const [x, y] of cs) expect(Math.hypot(x, y)).toBeCloseTo(Math.hypot(mx, my), 1);
};

test('fix 14: the file keeps the array list — after reopening the copies follow the mother again, joins too', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await joinDots(a, MOTHER_RIGHT, COPY1_LEFT);
  const saved = await saveFile(a);
  expect(saved.version).toBe(93);
  expect(saved.ghostArrays).toHaveLength(1);
  expect(saved.ghostArrays[0]).toMatchObject({ type: 'polar', sourceId: 'mother-ring', instanceCount: 6, angle: 360 });
  expect(saved.ghostArrays[0].inheritedJoins.length).toBeGreaterThanOrEqual(1);
  const b = await reopen(launch, a);
  expect(await managerListsPolar(b)).toBe(1);
  await selectRing(b);
  await b.page.keyboard.press('Shift+ArrowRight');
  await b.page.waitForTimeout(400);
  const after = await saveFile(b);
  record('fix 14: reopened, mother moved 1 ds right', after);
  expect(round(after.elements.find((e: any) => e.id === 'mother-ring').center.x)).toBe(10);
  radiusOK(after, 10, -90);
  expect(centres(ghosts(after, 'mother-ring'))).not.toEqual(centres(ghosts(saved, 'mother-ring')));
  const ids = new Set(after.elements.map((e: any) => e.id));
  expect(after.picotConnections).toHaveLength(saved.picotConnections.length);
  for (const c of after.picotConnections) for (const p of c.picots) expect(ids.has(p.elementId)).toBe(true);
});

test('fix 14: Undo back to the file as opened brings its array list back', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await a.save();
  const b = await reopen(launch, a);
  await openManager(b);
  await b.page.getByRole('button', { name: b.t('ghostArrayConvertAllTitle'), exact: true }).click();
  await b.page.waitForTimeout(300);
  await b.page.getByRole('button', { name: b.t('ghostArrayConvertAllBtn'), exact: true }).click();
  await b.page.waitForTimeout(500);
  await closeManager(b);
  expect(await managerListsPolar(b)).toBe(0);
  await b.page.mouse.click(1250, 780);
  await b.page.keyboard.press('Control+z');            // back to the first history entry (the file as opened)
  await b.page.waitForTimeout(500);
  expect(await managerListsPolar(b)).toBe(1);
  expect(ghosts(await saveFile(b), 'mother-ring')).toHaveLength(5);
});

test('fix 14: Resume (the autosave) keeps the array list', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await a.save();
  await a.hide();                                   // writes the autosave (as in resume-and-save)
  const files = await a.fs();
  const autosaveRaw = (await a.autosaveRaw())!;
  expect(JSON.parse(autosaveRaw).ghostArrays).toHaveLength(1);
  await a.end();
  const b: App = await launch({ fs: files, autosave: autosaveRaw });
  await b.resume();
  expect(await managerListsPolar(b)).toBe(1);
  await selectRing(b);
  await b.page.keyboard.press('Shift+ArrowRight');
  await b.page.waitForTimeout(400);
  radiusOK(await saveFile(b), 10, -90);
});

test('fix 15: opening another file — the previous pattern\'s arrays are gone', async ({ launch }) => {
  const other = '/home/me/Other.tatcad';
  const a: App = await launch({ fs: { [F]: fixture('ghost-source.tatcad'), [other]: fixture('groups.tatcad') } });
  await a.newProject();
  await a.openFile(F);
  await polarGhosts(a);
  await a.save();
  await a.openFile(other);
  const confirm = a.page.getByRole('button', { name: a.t('recentProjectsLoadConfirm'), exact: true });
  if (await confirm.count()) { await confirm.first().click(); await a.page.waitForTimeout(800); }
  expect(await a.status()).toContain('Elements: 2');
  await openManager(a);
  expect(await a.page.getByText(a.t('ghostArrayManagerEmpty')).count()).toBe(1);
});

test('New Project — no arrays left behind (it already did: kept as a check)', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  await a.save();
  await a.menu('menuFile', 'fileNew');                     // File → New (saved, so no question — or answer it)
  const discard = a.page.getByRole('button', { name: a.t('newCanvasConfirm'), exact: true });
  if (await discard.count()) { await discard.first().click(); await a.page.waitForTimeout(400); }
  expect(await a.status()).toContain('Elements: 0');
  await openManager(a);
  expect(await a.page.getByText(a.t('ghostArrayManagerEmpty')).count()).toBe(1);
});

test('a file from before version 93 (no list): copies stay where they are (user decision a)', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  const saved = await saveFile(a);
  const b = await reopen(launch, a, f => { const old = { ...f, version: 92 }; delete old.ghostArrays; return old; });
  expect(await managerListsPolar(b)).toBe(0);
  await selectRing(b);
  await b.page.keyboard.press('Shift+ArrowRight');
  await b.page.waitForTimeout(400);
  const after = await saveFile(b);
  expect(round(after.elements.find((e: any) => e.id === 'mother-ring').center.x)).toBe(10);
  expect(centres(ghosts(after, 'mother-ring'))).toEqual(centres(ghosts(saved, 'mother-ring')));   // they stay
  expect(after.ghostArrays).toEqual([]);
});

test('a damaged array list: bad entries are dropped, the pattern opens, the good array works', async ({ launch }) => {
  const a = await openGhostSource(launch);
  await polarGhosts(a);
  const saved = await saveFile(a);
  const good = saved.ghostArrays[0];
  const b = await reopen(launch, a, f => ({ ...f, ghostArrays: [
    { ...good, id: 'huge', instanceCount: 1e9 },                     // would hang the next rebuild
    { ...good, id: 'orphan', sourceId: 'nobody' },
    { ...good, id: 'copy-as-mother', sourceId: good.ghostIds[0] },
    { ...good, id: 'nan', angle: 'NaN' },
    'not an array', null,
    { ...good, inheritedJoins: [{ sourcePicotIndex: 0, targetPicotIndex: 2, isSourceElement: true, connExtra: { materialId: '<img src=x>' } }], extra: '<script>' },
  ] }));
  expect(await managerListsPolar(b)).toBe(1);
  await selectRing(b);
  await b.page.keyboard.press('Shift+ArrowRight');
  await b.page.waitForTimeout(400);
  const after = await saveFile(b);
  radiusOK(after, 10, -90);
  expect(after.ghostArrays).toHaveLength(1);
  expect(after.ghostArrays[0].id).toBe(good.id);
  expect(after.ghostArrays[0].extra).toBeUndefined();
  expect(after.ghostArrays[0].inheritedJoins).toEqual([{ sourcePicotIndex: 0, targetPicotIndex: 2, isSourceElement: true }]);
});

test('the recorded steps match the stored reference', () => {
  expect(scenario.length).toBeGreaterThanOrEqual(10);
  const r = checkBaseline(path.join(here, 'baselines', 'ghost-arrays.scenario.txt'), scenario.join('\n\n') + '\n');
  expect(r.ok, r.message).toBe(true);
});
