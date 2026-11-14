// A single guide point (gp) can be joined in Picot Join mode, like a ring's
// guide point (session 64, user report: the green dot showed, but clicking
// it did nothing). Its notation stays "gp"; the pattern text writes it with
// the usual join mark, gp//r2//.
// Fixture: "c: 6ds-gp-6ds" numbered 1 and "fr: 6ds-p-6ds" numbered 2.
import { test, expect, fixture, type App } from './harness';

const F = '/home/me/FloatingRing test.tatcad';

/** Screen centre of the join dot nearest a world point (the dots are SVG circles). */
const dotNear = (a: App, wx: number, wy: number) => a.page.evaluate(([x, y]) => {
  let best: { d: number; sx: number; sy: number } | null = null;
  for (const c of document.querySelectorAll('svg circle')) {
    const cx = parseFloat(c.getAttribute('cx') || 'NaN'), cy = parseFloat(c.getAttribute('cy') || 'NaN');
    if (!isFinite(cx)) continue;
    const d = Math.hypot(cx - x, cy - y);
    const r = c.getBoundingClientRect();
    if (!best || d < best.d) best = { d, sx: r.x + r.width / 2, sy: r.y + r.height / 2 };
  }
  return best!;
}, [wx, wy] as const);

const joinGpToRing = async (launch: any, zoom?: number) => {
  const pattern = JSON.parse(fixture('floating-ring-gp.tatcad'));
  if (zoom) pattern.zoom = zoom;
  const a: App = await launch({ fs: { [F]: JSON.stringify(pattern) } });
  await a.newProject();
  await a.openFile(F);
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Shift+J');                        // Picot Join mode
  await a.page.waitForTimeout(400);
  const tip = a.page.getByRole('button', { name: 'Got it', exact: true });   // first-time tip over the canvas
  if (await tip.count()) { await tip.first().click(); await a.page.waitForTimeout(300); }
  const gpDot = await a.page.evaluate(() => {                   // the green guide-point dot
    const c = document.querySelector('g.guide-picot circle'); if (!c) return null;
    const r = c.getBoundingClientRect(); return { sx: r.x + r.width / 2, sy: r.y + r.height / 2 };
  });
  expect(gpDot, 'the guide point shows its join dot').not.toBeNull();
  const ringPicot = await dotNear(a, -145.55, -44.73);            // the floating ring's picot (tip of the ring)
  await a.page.mouse.click(gpDot!.sx, gpDot!.sy);
  await a.page.waitForTimeout(250);
  await a.page.keyboard.down('Shift');
  await a.page.mouse.click(ringPicot.sx, ringPicot.sy);
  await a.page.keyboard.up('Shift');
  await a.page.waitForTimeout(250);
  await a.page.keyboard.press('j');
  await a.page.waitForTimeout(500);
  await a.page.keyboard.press('Shift+J');                        // back out of the mode
  await a.save();
  return { a, file: await a.saved(F) };
};

for (const zoom of [undefined, 0.6]) {
  test(`a gp joins to a ring's picot (zoom ${zoom ?? 'as saved, 1.8'})`, async ({ launch }) => {
    const { file } = await joinGpToRing(launch, zoom);
    expect(file.picotConnections).toHaveLength(1);
    const chain = file.elements.find((e: any) => e.type === 'chain');
    const ring = file.elements.find((e: any) => e.type === 'ring');
    expect(file.picotConnections[0].picots.map((p: any) => p.elementId).sort()).toEqual([chain.id, ring.id].sort());
    expect(chain.notation).toBe('c: 6ds-gp-6ds');                  // stays gp
    expect(chain.picots[0].isJoint).toBe(true);
    expect(ring.picots[0].isJoint).toBe(true);
  });
}

test('the joined gp survives reopening the file', async ({ launch }) => {
  const { a } = await joinGpToRing(launch);
  const files = await a.fs();
  await a.end();
  const b: App = await launch({ fs: files });
  await b.newProject();
  await b.openFile(F);
  await b.save();
  const file = await b.saved(F);
  expect(file.picotConnections).toHaveLength(1);
  expect(file.elements.find((e: any) => e.type === 'chain').picots[0].isJoint).toBe(true);
});
