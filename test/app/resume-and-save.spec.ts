// Review #4 (session 63): Resume can't write older work over a newer file.
// Each App is one run of the program; app.end() is the program dying.
import { test, expect, elementCount, type App } from './harness';

const P = '/home/me/Other.tatcad';

/**
 * Run 1 of the bug scenario: autosave, more edits, Save, then the app dies.
 * Played once per worker — every test below starts from what it left behind.
 */
type FirstRun = { files: Record<string, string>; autosaveRaw: string; autosave: any };
let played: Promise<FirstRun> | null = null;
const firstRun = (launch: any): Promise<FirstRun> => (played ??= playFirstRun(launch));
const playFirstRun = async (launch: any): Promise<FirstRun> => {
  const a: App = await launch();
  await a.newProject();
  await a.ring();
  await a.set({ savePath: P });
  await a.save();                          // first Save → dialog → Other.tatcad (1 ring)
  await a.ring(400, 300);
  await a.hide();                          // autosave: 2 rings, unsaved
  await a.ring(1000, 650);
  await a.save();                          // Save → 3 rings in the file
  const files = await a.fs();
  const autosaveRaw = (await a.autosaveRaw())!;
  await a.end();
  return { files, autosaveRaw, autosave: JSON.parse(autosaveRaw) };
};

test('the autosave is refreshed right after every Save', async ({ launch }) => {
  const { files, autosave } = await firstRun(launch);
  expect(elementCount(files[P])).toBe(3);
  expect(autosave.elements).toHaveLength(3);
  expect(autosave._resumeUnsaved).toBe(false);
  expect(autosave._resumeFilePath).toBe(P);
  expect(typeof autosave._resumeFileHash).toBe('string');
});

test('Resume gets the newest work; Save then writes without asking', async ({ launch }) => {
  const { files, autosaveRaw } = await firstRun(launch);
  const b = await launch({ fs: files, autosave: autosaveRaw });
  const label = await b.resume();
  expect(label).toContain('Other');
  expect(await b.star()).toBe(false);
  await b.ring(300, 700);
  await b.save();
  expect(elementCount((await b.fs())[P])).toBe(4);
  expect(await b.dialog()).toBeNull();
  expect(await b.log()).not.toContain('saveDialog');
});

test.describe('the file changed elsewhere after the autosave', () => {
  const changedElsewhere = (files: Record<string, string>) => {
    const d = JSON.parse(files[P]);
    d.elements.push({ ...d.elements[0], id: 'from-other-pc' });
    return { ...files, [P]: JSON.stringify(d, null, 2) };
  };
  const untilDialog = async (launch: any) => {
    const { files, autosaveRaw } = await firstRun(launch);
    const changed = changedElsewhere(files);
    const c: App = await launch({ fs: changed, autosave: autosaveRaw });
    await c.resume();
    await c.ring(300, 700);
    await c.save();
    return { c, changed };
  };

  test('Save asks: "The file has changed" — Overwrite (red), Save As… (blue)', async ({ launch }) => {
    const { c, changed } = await untilDialog(launch);
    const dialog = (await c.dialog())!;
    expect(dialog).not.toBeNull();
    expect(dialog.title).toBe('The file has changed');
    expect(dialog.body).toContain('Other');
    expect(dialog.buttons).toEqual(expect.arrayContaining([{ text: 'Overwrite', color: 'red' }, { text: 'Save As…', color: 'blue' }]));
    expect((await c.fs())[P]).toBe(changed[P]);                // nothing written yet
  });

  test('Save As… writes a new file and leaves the changed one alone', async ({ launch }) => {
    const { c, changed } = await untilDialog(launch);
    await c.set({ savePath: '/home/me/Snow copy.tatcad' });
    await c.clickButton('Save As…');
    const files = await c.fs();
    expect(files[P]).toBe(changed[P]);
    expect(await c.log()).toContain('saveDialog');
    expect(elementCount(files['/home/me/Snow copy.tatcad'])).toBe(4);
  });

  test('Overwrite writes over it, and the next Save does not ask again', async ({ launch }) => {
    const { c, changed } = await untilDialog(launch);
    await c.clickButton('Overwrite');
    let files = await c.fs();
    expect(files[P]).not.toBe(changed[P]);
    expect(elementCount(files[P])).toBe(4);
    expect(await c.log()).not.toContain('saveDialog');
    await c.ring(500, 750);
    await c.save();
    expect(await c.dialog()).toBeNull();
    expect(elementCount((await c.fs())[P])).toBe(5);
  });

  test('Esc closes the question and nothing is saved', async ({ launch }) => {
    const { c, changed } = await untilDialog(launch);
    await c.page.keyboard.press('Escape');
    await c.page.waitForTimeout(600);
    expect(await c.dialog()).toBeNull();
    expect((await c.fs())[P]).toBe(changed[P]);
    expect(await c.log()).not.toContain('saveDialog');
    expect(await c.star()).toBe(true);                         // still unsaved
  });
});

test('an autosave from before the fingerprint existed → asks before writing', async ({ launch }) => {
  const { files, autosave } = await firstRun(launch);
  const old = { ...autosave, _resumeUnsaved: true, elements: autosave.elements.slice(0, 2) };
  delete old._resumeFileHash;
  const e = await launch({ fs: files, autosave: JSON.stringify(old) });
  await e.resume();
  await e.save();
  expect(await e.dialog()).not.toBeNull();
  expect((await e.fs())[P]).toBe(files[P]);
});

test('the file was deleted → nothing to lose → saves without asking', async ({ launch }) => {
  const { autosaveRaw } = await firstRun(launch);
  const g = await launch({ fs: {}, autosave: autosaveRaw });
  await g.resume();
  await g.ring(300, 700);
  await g.save();
  expect(await g.dialog()).toBeNull();
  expect(elementCount((await g.fs())[P])).toBe(4);
});

test('resumed UNSAVED work with the file unchanged → star, then saves without asking', async ({ launch }) => {
  const { files, autosaveRaw } = await firstRun(launch);
  const h = await launch({ fs: files, autosave: autosaveRaw });
  await h.resume();
  await h.ring(300, 700);
  await h.hide();                                              // autosave holds 4 rings, unsaved
  const unsavedAutosave = (await h.autosaveRaw())!;
  expect(JSON.parse(unsavedAutosave)._resumeUnsaved).toBe(true);
  await h.end();
  const i = await launch({ fs: files, autosave: unsavedAutosave });
  await i.resume();
  expect(await i.star()).toBe(true);
  await i.save();
  expect(await i.dialog()).toBeNull();
  expect(elementCount((await i.fs())[P])).toBe(4);
  expect(await i.star()).toBe(false);
});

test.describe('closing the window', () => {
  test('with unsaved changes: asks; "close anyway" writes the autosave before the window goes', async ({ launch }) => {
    const { files, autosaveRaw } = await firstRun(launch);
    const j = await launch({ fs: files, autosave: autosaveRaw });
    await j.resume();
    await j.ring(300, 700);
    await j.ring(900, 300);                                    // 5 rings, unsaved, no autosave since
    await j.requestClose();
    const log = await j.log();
    expect(log).toContain('ask');
    expect(log.filter(l => l.startsWith('destroy'))).toEqual(['destroy autosave=5']);
    expect((await j.autosave())._resumeUnsaved).toBe(true);
  });

  test('with unsaved changes, answering No: the window stays', async ({ launch }) => {
    const j = await launch();
    await j.newProject();
    await j.ring();
    await j.set({ ask: 'No' });
    await j.requestClose();
    const log = await j.log();
    expect(log).toContain('ask');
    expect(log.some(l => l.startsWith('destroy'))).toBe(false);
  });

  test('clean: no question; the autosave is written first and says "saved"', async ({ launch }) => {
    const { files, autosaveRaw } = await firstRun(launch);
    const k = await launch({ fs: files, autosave: autosaveRaw });
    await k.resume();
    await k.ring(300, 700);
    await k.save();
    await k.requestClose();
    const log = await k.log();
    expect(log).not.toContain('ask');
    expect(log.filter(l => l.startsWith('destroy'))).toEqual(['destroy autosave=4']);
    expect((await k.autosave())._resumeUnsaved).toBe(false);
  });

  test('an empty new project closes without a question', async ({ launch }) => {
    const j = await launch();
    await j.newProject();
    await j.requestClose();
    const log = await j.log();
    expect(log).not.toContain('ask');
    expect(log.some(l => l.startsWith('destroy'))).toBe(true);
  });
});

test('harness check: rings added by the tests sit at different places', async ({ launch }) => {
  const a = await launch();
  await a.newProject();
  await a.ring(); await a.ring(400, 300); await a.ring(1000, 650); await a.ring(300, 700);
  await a.set({ savePath: P });
  await a.save();
  const centres = (await a.saved(P)).elements.map((e: any) => `${Math.round(e.center.x)},${Math.round(e.center.y)}`);
  expect(new Set(centres).size).toBe(4);
  expect(await a.dialog()).toBeNull();
});
