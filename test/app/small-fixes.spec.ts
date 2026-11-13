// Session 63's smaller fixes: #12 (a failed SVG export says so), #14 (drag
// after Shift is released), #16 / #17 (file names and dialog texts), #20
// (selection after Undo), #10 (±1° on a touch screen), #8 (autosave when
// storage is full).
import { test, expect, fixture, fixtureJson, type App } from './harness';

const F = '/home/me/Groups.tatcad';
const opened = async (launch: any, o: any = {}): Promise<App> => {
  const a: App = await launch({ fs: { [F]: fixture('groups.tatcad') }, ...o });
  await a.newProject();
  await a.openFile(F);
  return a;
};
const optionsOf = (dialogs: { cmd: string; options: any }[], cmd: string) => dialogs.filter(d => d.cmd === cmd).map(d => d.options || {});

test.describe('file dialogs (#16, #17) and export errors (#12)', () => {
  test('Open, Save As and Export SVG dialogs carry a title and a file-type name', async ({ launch }) => {
    const a = await opened(launch);
    await a.set({ savePath: '/home/me/Copy.tatcad' });
    await a.menu('menuFile', 'fileSaveAs');
    await a.page.waitForTimeout(900);
    await a.set({ savePath: '/home/me/Groups.svg' });
    await a.menu('menuFile', 'fileExportSvg');
    await a.page.waitForTimeout(900);
    const dialogs = await a.dialogs();
    const open = optionsOf(dialogs, 'plugin:dialog|open')[0];
    const [saveAs, exportSvg] = optionsOf(dialogs, 'plugin:dialog|save');
    expect(open.title).toBe('Load Project');
    expect(open.filters[0].name).toBe('TattingCAD pattern');
    expect(saveAs.title).toBe('Save Project');
    expect(saveAs.filters[0]).toEqual({ name: 'TattingCAD pattern', extensions: ['tatcad'] });
    expect(exportSvg.title).toBe('Export SVG');
    expect(exportSvg.filters[0].name).toBe('SVG image');
    const files = await a.fs();
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['/home/me/Copy.tatcad', '/home/me/Groups.svg']));
    expect(files['/home/me/Groups.svg']).toContain('<svg');
  });

  test('the default file name keeps spaces and accents (#16)', async ({ launch }) => {
    const pattern = { ...fixtureJson('groups.tatcad'), name: 'Hópehely két' };
    const a = await launch({ fs: { '/home/me/Hópehely két.tatcad': JSON.stringify(pattern) } });
    await a.newProject();
    await a.openFile('/home/me/Hópehely két.tatcad');
    await a.set({ savePath: null });                 // cancel the dialog; only its suggestion matters
    await a.menu('menuFile', 'fileSaveAs');
    await a.page.waitForTimeout(600);
    const saveAs = optionsOf(await a.dialogs(), 'plugin:dialog|save')[0];
    expect(saveAs.defaultPath).toBe('Hópehely két.tatcad');
  });

  test('an SVG export that can\'t be written shows an error message (#12)', async ({ launch }) => {
    const a = await opened(launch);
    await a.set({ savePath: '/readonly/Groups.svg', failWrite: '\\.svg$' });
    await a.menu('menuFile', 'fileExportSvg');
    expect(await a.waitToast(4000)).toContain(a.t('saveErrFailed'));
    expect(Object.keys(await a.fs())).not.toContain('/readonly/Groups.svg');
  });

  test('a pattern Save that can\'t be written shows the error and stays unsaved', async ({ launch }) => {
    const a = await launch();
    await a.newProject();
    await a.ring();
    await a.set({ savePath: '/readonly/New.tatcad', failWrite: '^/readonly/' });
    await a.save();
    expect(await a.waitToast(4000)).toContain(a.t('saveErrFailed'));
    expect(await a.star()).toBe(true);
  });
});

test.describe('selection after Undo / Redo (#20)', () => {
  test('undoing a new ring leaves nothing selected; Redo brings the ring back', async ({ launch }) => {
    const a = await launch();
    await a.newProject();
    await a.ring();
    expect(await a.status()).toContain('1 object selected');
    await a.page.mouse.click(1250, 780);
    await a.page.keyboard.press('Control+z');
    await a.page.waitForTimeout(500);
    const afterUndo = await a.status();
    expect(afterUndo).toContain(a.t('infoNoSelection'));
    expect(afterUndo).toContain('Elements: 0');
    await a.page.keyboard.press('Control+Shift+z');
    await a.page.waitForTimeout(500);
    expect(await a.status()).toContain('Elements: 1');
  });
});

test('a drag keeps following the pointer after Shift (axis lock) is released (#14)', async ({ launch }) => {
  const a = await opened(launch);
  await a.page.getByTitle(a.t('toolSelect'), { exact: true }).first().click();
  await a.page.waitForTimeout(200);
  const group = a.page.locator('g[data-round]').first();
  const before = (await group.boundingBox())!;
  // a point on the ring's line (the middle of a ring is empty)
  const [gx, gy] = await a.page.evaluate(() => {
    const g = document.querySelector('g[data-round]')!; const r = g.getBoundingClientRect();
    for (let fy = 0.02; fy < 1; fy += 0.02) for (let fx = 0.3; fx < 0.7; fx += 0.02) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy; const e = document.elementFromPoint(x, y);
      if (e && g.contains(e)) return [x, y];
    }
    return [r.x + r.width / 2, r.y + r.height / 2];
  });
  await a.page.mouse.move(gx, gy);
  await a.page.mouse.down();
  await a.page.mouse.move(gx + 10, gy + 4, { steps: 3 });
  await a.page.keyboard.down('Shift');
  await a.page.mouse.move(gx + 80, gy + 30, { steps: 6 });
  await a.page.keyboard.up('Shift');
  await a.page.mouse.move(gx + 120, gy + 90, { steps: 6 });
  await a.page.waitForTimeout(100);
  await a.page.mouse.up();
  await a.page.waitForTimeout(400);
  const after = (await a.page.locator('g[data-round]').first().boundingBox())!;
  expect(Math.abs(after.x - before.x - 120), `moved ${after.x - before.x}, ${after.y - before.y}; pointer 120, 90`).toBeLessThan(4);
  expect(Math.abs(after.y - before.y - 90)).toBeLessThan(4);
});

test.describe('±1° on a touch screen (#10)', () => {
  const P = '/home/me/Turn.tatcad';
  const rotation = async (a: App) => { await a.save(); return (await a.saved(P)).elements[0].rotation; };
  const withRing = async (launch: any) => {
    const a: App = await launch({ touch: true });
    await a.newProject();
    await a.ring();                                  // the new ring is selected
    await a.set({ savePath: P });
    const plus = a.page.getByTitle(a.t('rotateNudgePlus'), { exact: true }).first();
    const box = (await plus.boundingBox())!;
    return { a, x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  test('one tap = exactly +1°, and one Undo takes it back', async ({ launch }) => {
    const { a, x, y } = await withRing(launch);
    await a.page.touchscreen.tap(x, y);
    await a.page.waitForTimeout(600);
    expect(await rotation(a)).toBe(1);
    await a.page.keyboard.press('Control+z');
    await a.page.waitForTimeout(400);
    const file = await (async () => { await a.save(); return a.saved(P); })();
    expect(file.elements).toHaveLength(1);           // the ring is still there: only the turn was undone
    expect(file.elements[0].rotation).toBe(0);
  });

  test('a one-second hold repeats, and is one Undo step', async ({ launch }) => {
    const { a, x, y } = await withRing(launch);
    const cdp = await a.ctx.newCDPSession(a.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await a.page.waitForTimeout(1000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await a.page.waitForTimeout(600);
    expect(await rotation(a)).toBeGreaterThan(2);
    await a.page.keyboard.press('Control+z');
    await a.page.waitForTimeout(400);
    await a.save();
    const file = await a.saved(P);
    expect(file.elements).toHaveLength(1);
    expect(file.elements[0].rotation).toBe(0);
  });
});

test.describe('autosave when storage is full (#8)', () => {
  const PH = '/home/me/Photo.tatcad';
  const PHOTO = fixture('photo.tatcad');             // 2 rings and a ~100 kB reference image
  // Fills localStorage, then frees about `leave` characters.
  const fill = (a: App, leave: number) => a.page.evaluate((leaveChars) => {
    const big = 'x'.repeat(1 << 20); let i = 0;
    for (;;) { try { localStorage.setItem('__fill' + i, big); i++; } catch { break; } }
    let size = 1 << 19;
    while (size >= 1024) { try { localStorage.setItem('__fill' + i, 'x'.repeat(size)); i++; } catch { size >>= 1; } }
    let freed = 0, j = i - 1;
    while (freed < leaveChars && j >= 0) { freed += localStorage.getItem('__fill' + j)!.length; localStorage.removeItem('__fill' + j); j--; }
    return freed;
  }, leave);

  test('nearly full: kept without the reference image, one warning; Resume takes the image back from the file', async ({ launch }) => {
    const a = await launch({ fs: { [PH]: PHOTO } });
    await a.newProject();
    await a.openFile(PH);
    await a.page.evaluate(() => localStorage.removeItem('tatting-designer-autosave'));
    await fill(a, 60_000);                           // room for the pattern, not for the image
    await a.ring(300, 650);
    await a.hide();
    expect(await a.waitToast(3000)).toContain(a.t('autosaveNoImage'));
    const autosave = await a.autosave();
    expect(autosave).not.toBeNull();
    expect(autosave._refImageOmitted).toBe(true);
    expect(autosave.referenceImage).toBeFalsy();
    expect(autosave.elements).toHaveLength(3);

    await a.page.waitForTimeout(4500);               // the first warning is gone
    await a.hide();
    await a.page.waitForTimeout(300);
    expect(await a.toast(), 'no second warning').toBeNull();

    const raw = (await a.autosaveRaw())!;
    await a.end();
    const b = await launch({ fs: { [PH]: PHOTO }, autosave: raw });
    await b.resume();
    await b.page.waitForTimeout(800);
    await b.save();
    const file = await b.saved(PH);
    expect(file.referenceImage).toBe(JSON.parse(PHOTO).referenceImage);
    expect(file.elements).toHaveLength(3);
  });

  test('completely full: "Autosave failed — save your work"', async ({ launch }) => {
    const a = await launch({ fs: { [PH]: PHOTO } });
    await a.newProject();
    await a.openFile(PH);
    await fill(a, 0);
    await a.ring(900, 650);
    await a.hide();
    expect(await a.waitToast(3000)).toContain(a.t('autosaveFailed'));
  });

  test('Resume of an image-less autosave with no file to take it from → says so', async ({ launch }) => {
    const pattern = JSON.parse(PHOTO);
    const autosave = { ...pattern, referenceImage: null, _refImageOmitted: true, _resumeFilePath: null, _resumeUnsaved: true, autoSaved: '2026-11-11T10:00:00Z' };
    const a = await launch({ autosave: JSON.stringify(autosave) });
    await a.resume();
    expect(await a.waitToast(3000)).toContain(a.t('resumeImageMissing'));
  });
});
