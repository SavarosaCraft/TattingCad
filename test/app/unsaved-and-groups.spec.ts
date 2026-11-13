// Review #2 (settings outside Undo count as unsaved), #3 (group names and
// colours are saved), #5 (New clears notes / image / groups) — session 63.
import { test, expect, fixture, type App } from './harness';

const F = '/home/me/Groups.tatcad';
const PATTERN = fixture('groups.tatcad');   // 2 joined rings in 2 groups, notes "Old notes", a reference image

const opened = async (launch: any, o: any = {}): Promise<App> => {
  const a: App = await launch({ fs: { [F]: PATTERN }, ...o });
  await a.newProject();
  await a.openFile(F);
  return a;
};
const writeNotes = async (a: App, text: string) => {
  await a.page.getByTitle(a.t('notesOpen')).first().click();
  await a.page.waitForTimeout(300);
  await a.page.locator('textarea').first().fill(text);
  await a.page.waitForTimeout(200);
  await a.page.getByTitle(a.t('notesClose')).first().click();
  await a.page.waitForTimeout(300);
};

test.describe('unsaved star for settings outside Undo (#2)', () => {
  test('no star straight after opening a file', async ({ launch }) => {
    const a = await opened(launch);
    expect(await a.page.title()).toBe('Groups.tatcad — TattingCAD');
  });

  test('a notes edit → star, and closing asks first', async ({ launch }) => {
    const a = await opened(launch);
    await writeNotes(a, 'New notes');
    expect(await a.star()).toBe(true);
    await a.set({ ask: 'No' });
    await a.requestClose();
    expect(await a.log()).toContain('ask');
  });

  test('Save writes the notes and clears the star; the autosave then says "saved"', async ({ launch }) => {
    const a = await opened(launch);
    await writeNotes(a, 'New notes');
    await a.save();
    expect((await a.saved(F)).patternNotes).toBe('New notes');
    expect(await a.star()).toBe(false);
    expect((await a.autosave())._resumeUnsaved).toBe(false);
    await writeNotes(a, 'Old notes');                 // back to the old text — but not what was SAVED
    expect(await a.star()).toBe(true);
    await writeNotes(a, 'New notes');                 // back to what was saved
    expect(await a.star()).toBe(false);
  });

  test('no star after Resume of a saved pattern', async ({ launch }) => {
    const a = await opened(launch);
    await a.save();
    const autosave = (await a.autosaveRaw())!;
    const files = await a.fs();
    await a.end();
    const b = await launch({ fs: files, autosave });
    await b.resume();
    await b.page.waitForTimeout(800);
    expect(await b.star()).toBe(false);
  });

  test('no star after New', async ({ launch }) => {
    const a = await launch();
    await a.newProject();
    expect(await a.star()).toBe(false);
    expect(await a.page.title()).toBe('Untitled — TattingCAD');
  });
});

test.describe('group names and colours in the file (#3)', () => {
  test('Save writes the registry (file version 92): bad colour replaced, malformed entry dropped', async ({ launch }) => {
    const a = await opened(launch);
    await a.save();
    const file = await a.saved(F);
    expect(file.version).toBe(92);
    expect(file.spatialGroups).toEqual([{ id: 'g1', name: 'Petals', color: '#ff00aa' }, { id: 'g2', name: 'Leaves', color: '#888888' }]);
  });

  test('Resume keeps the registry', async ({ launch }) => {
    const a = await opened(launch);
    await a.save();
    const autosave = (await a.autosaveRaw())!;
    await a.end();
    const b = await launch({ fs: { [F]: PATTERN }, autosave });
    await b.resume();
    await b.save();
    expect((await b.saved(F)).spatialGroups[0]).toEqual({ id: 'g1', name: 'Petals', color: '#ff00aa' });
  });
});

test('New clears notes, reference image and groups (#5)', async ({ launch }) => {
  const a = await opened(launch);
  await a.menu('menuFile', 'fileNew');
  const confirm = a.page.getByRole('button', { name: a.t('newCanvasConfirm'), exact: true });
  if (await confirm.count()) { await confirm.first().click(); await a.page.waitForTimeout(500); }
  await a.ring();
  await a.set({ savePath: '/home/me/Fresh.tatcad' });
  await a.save();
  const fresh = await a.saved('/home/me/Fresh.tatcad');
  expect(fresh).not.toBeNull();
  expect(fresh.elements).toHaveLength(1);
  expect(fresh.patternNotes).toBe('');
  expect(fresh.referenceImage).toBeFalsy();
  expect(fresh.spatialGroups).toEqual([]);
});
