// Review #1 (numbers from pattern files), #6 (notation must be text; crash
// screen) and #13 (one toast timer) — session 63.
import { test, expect, fixture, fixtureJson, type App } from './harness';
import type { Page } from '@playwright/test';

// A ring, a circle ring and a chain; the circle's centre x is markup text
// that used to become a live red "CLICK ME" link in the realistic view.
const CRAFTED = fixtureJson('crafted-number.tatcad');
const F = '/home/me/Crafted.tatcad';

const toRealistic = async (a: App) => {
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('v');
  await a.page.waitForTimeout(1500);
};
const probe = (a: App) => a.page.evaluate(() => ({
  links: document.querySelectorAll('svg a').length,
  clickMe: document.body.innerHTML.includes('CLICK ME') || document.body.innerHTML.includes('INJ3CT'),
  bakedPaths: document.querySelectorAll('svg g[data-el] *').length,
  bakedElements: document.querySelectorAll('svg g[data-el]').length,
}));
const expectClean = async (a: App) => {
  await toRealistic(a);
  const p = await probe(a);
  expect(p.links, 'links in the drawing').toBe(0);
  expect(p.clickMe, 'the crafted text on the page').toBe(false);
  expect(p.bakedElements, 'the two sound elements are drawn').toBe(2);
  expect(p.bakedPaths, 'shapes drawn for them').toBeGreaterThanOrEqual(4);
};

test.describe('a crafted pattern: the damaged element is left out, the rest opens (#1)', () => {
  test('the fixture really holds the attack', () => {
    expect(String(CRAFTED.elements[1].center.x)).toContain('<a href=');
    expect(CRAFTED.elements).toHaveLength(3);
  });

  test('file open', async ({ launch }) => {
    const a = await launch({ fs: { [F]: JSON.stringify(CRAFTED) } });
    await a.newProject();
    await a.set({ openPath: F });
    await a.menu('menuFile', 'fileLoad');
    await a.page.getByText('Browse for file', { exact: false }).first().click();
    expect(await a.waitToast(4000)).toContain('1 damaged element(s) were left out.');
    await a.page.waitForTimeout(600);
    expect(await a.status()).toContain('Elements: 2');
    await expectClean(a);
  });

  test('Resume', async ({ launch }) => {
    const autosave = { ...CRAFTED, autoSaved: '2026-11-11T10:00:00Z', _resumeUnsaved: true };
    const a = await launch({ autosave: JSON.stringify(autosave) });
    await a.page.getByText('Resume: Crafted').click();
    expect(await a.waitToast(4000)).toContain('1 damaged element(s) were left out.');
    await a.page.waitForTimeout(600);
    await expectClean(a);
  });

  test('paste from the system clipboard', async ({ launch }) => {
    const clipboard = 'TATCAD_ELEMENTS:' + JSON.stringify({ elements: CRAFTED.elements, connections: CRAFTED.picotConnections });
    const a = await launch({ clipboard });
    await a.newProject();
    await a.page.mouse.click(700, 500);
    await a.page.keyboard.press('Control+v');
    expect(await a.waitToast(4000)).toContain('1 damaged element(s) were left out.');
    await a.page.waitForTimeout(600);
    expect(await a.status()).toContain('Elements: 2');
    await expectClean(a);
  });

  test('the far side of the dropped element\'s join is no longer "joined"', async ({ launch }) => {
    const a = await launch({ fs: { [F]: JSON.stringify(CRAFTED) } });
    await a.newProject();
    await a.openFile(F);
    await a.save();
    const file = await a.saved(F);
    expect(file.elements.map((e: any) => e.id)).toEqual(['tear', 'chain']);
    expect(file.picotConnections).toEqual([]);
    expect(file.elements[0].picots.every((p: any) => !p.isJoint || p.picotKind === 'cjp' || p.isCoreJoin)).toBe(true);
  });
});

test.describe('a pattern whose notation is a number (#6)', () => {
  const N = '/home/me/Crash.tatcad';
  test('opens without crashing; the element is left out', async ({ launch }) => {
    const a = await launch({ fs: { [N]: fixture('notation-as-number.tatcad') } });
    await a.newProject();
    await a.set({ openPath: N });
    await a.menu('menuFile', 'fileLoad');
    await a.page.getByText('Browse for file', { exact: false }).first().click();
    expect(await a.waitToast(4000)).toContain('1 damaged element(s) were left out.');
    expect(await a.page.getByText('ran into a problem').count()).toBe(0);
    expect(await a.status()).toContain('Elements: 1');
  });

  test('the "damaged" message stays about 4 seconds — an older message\'s timer does not hide it early (#13)', async ({ launch }) => {
    const G = '/home/me/Groups.tatcad';
    const a = await launch({ fs: { [N]: fixture('notation-as-number.tatcad'), [G]: fixture('groups.tatcad') } });
    await a.newProject();
    await a.openFile(G);                               // "Load completed" — its 3 s timer is running
    expect(await a.toast(), 'the older message is still up').not.toBeNull();
    await a.page.waitForTimeout(900);
    await a.set({ openPath: N });
    await a.menu('menuFile', 'fileLoad');
    await a.page.getByText('Browse for file', { exact: false }).first().click();
    let shown = 0;
    for (let i = 0; i < 60; i++) {
      await a.page.waitForTimeout(100);
      if (((await a.toast()) || '').includes('damaged')) shown++;
    }
    expect(shown / 10, 'seconds the message was visible').toBeGreaterThan(3);
    expect(shown / 10).toBeLessThan(5.5);
  });
});

// ── the crash screen ──────────────────────────────────────────────────────
// An error while drawing is injected by rewriting one module on its way to
// the browser: getCircleStitchAngle throws while window.__crashNow is set.
const injectCrash = async (page: Page) => {
  await page.route('**/src/geometry/stitchGeometry.ts*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    const marker = 'export const getCircleStitchAngle = (';
    if (!body.includes(marker)) throw new Error('crash injection: getCircleStitchAngle not found in stitchGeometry.ts');
    body = body.replace(marker, 'export const getCircleStitchAngle = (...__a) => { if (globalThis.__crashNow) throw new Error("TEST CRASH"); return __gcsa(...__a); };\nconst __gcsa = (');
    await route.fulfill({ response, body });
  });
};
const G = '/home/me/Groups.tatcad';
const crashed = async (launch: any): Promise<App> => {
  const a: App = await launch({ fs: { [G]: fixture('groups.tatcad') }, before: injectCrash, allowErrors: ['TEST CRASH'] });
  await a.newProject();
  await a.openFile(G);
  await a.page.waitForTimeout(600);
  await a.page.evaluate(() => { (globalThis as any).__crashNow = true; });
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Shift+R');        // any redraw of the circle rings' picots → the injected error
  await a.page.getByText('TattingCAD ran into a problem').waitFor({ timeout: 8000 });
  await a.page.evaluate(() => { (globalThis as any).__crashNow = false; });
  return a;
};

test.describe('crash screen (#6)', () => {
  test('a crash shows the screen, not a blank window', async ({ launch }) => {
    const a = await crashed(launch);
    expect(await a.page.evaluate(() => document.body.innerText.trim().length)).toBeGreaterThan(50);
    for (const name of ['Save a copy…', 'Restart', 'Close']) expect(await a.page.getByRole('button', { name, exact: true }).count(), name).toBe(1);
  });

  test('Save a copy… writes the last good state as a plain pattern file', async ({ launch }) => {
    const a = await crashed(launch);
    await a.set({ savePath: '/home/me/Groups (recovered).tatcad' });
    await a.clickButton('Save a copy…');
    const copy = await a.saved('/home/me/Groups (recovered).tatcad');
    expect(copy).not.toBeNull();
    expect(copy.elements).toHaveLength(2);                       // the state before the crashing edit
    expect(copy.patternNotes).toBe('Old notes');
    expect(Object.keys(copy).filter(k => k.startsWith('_resume') || k === 'autoSaved')).toEqual([]);
    const dialogs = await a.dialogs();
    expect(dialogs[dialogs.length - 1].options.defaultPath).toContain('(recovered)');
  });

  test('the window\'s X closes it again', async ({ launch }) => {
    const a = await crashed(launch);
    expect(await a.requestClose()).toBeGreaterThan(0);
    expect((await a.log()).some(l => l.startsWith('destroy'))).toBe(true);
  });

  test('Close closes the window', async ({ launch }) => {
    const a = await crashed(launch);
    await a.clickButton('Close');
    expect((await a.log()).some(l => l.startsWith('destroy'))).toBe(true);
  });

  test('Restart → the start screen offers Resume with the last good state', async ({ launch }) => {
    const a = await crashed(launch);
    await a.page.getByRole('button', { name: 'Restart', exact: true }).click();
    await a.page.getByText('Resume:', { exact: false }).first().waitFor({ timeout: 15_000 });
    expect((await a.autosave()).elements).toHaveLength(2);
    await a.resume();
    expect(await a.status()).toContain('Elements: 2');
  });
});
