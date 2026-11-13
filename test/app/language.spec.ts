// Texts that used to show raw keys or the wrong language (session 63):
// the group-merge dialog, new group names, old "groupDefaultName N" names
// in files, and the Export SVG dialog after a language switch.
import { test, expect, fixture, fixtureJson, TEXTS, type App } from './harness';

const F = '/home/me/Groups.tatcad';
const groupNames = (a: App) => a.page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value).filter(v => /(Group|Csoport|Grupo|groupDefaultName)/.test(v)));

for (const language of ['en', 'hu'] as const) {
  test(`the "Merge groups?" dialog is in the app's language (${language})`, async ({ launch }) => {
    const a = await launch({ fs: { [F]: fixture('groups.tatcad') }, language });
    await a.newProject();
    await a.openFile(F);
    await a.page.mouse.click(1250, 780);
    await a.page.keyboard.press('Control+a');
    await a.page.waitForTimeout(300);
    await a.page.locator(`button[title="${a.t('toolGroup')}"]`).first().click();
    await a.page.waitForTimeout(600);
    const dialog = (await a.dialog())!;
    expect(dialog).not.toBeNull();
    expect(dialog.title).toBe(TEXTS[language].groupMergeTitle);
    expect(dialog.buttons.map(b => b.text)).toContain(TEXTS[language].groupMergeConfirm);
    for (const text of [dialog.title, dialog.body, ...dialog.buttons.map(b => b.text)]) expect(text).not.toMatch(/^groupMerge/);
    expect(dialog.body.length).toBeGreaterThan(20);
  });

  test(`a new group is named in the app's language (${language})`, async ({ launch }) => {
    const a = await launch({ language });
    await a.newProject();
    await a.ring();
    await a.ring(900, 500);
    await a.page.keyboard.press('Control+a');
    await a.page.waitForTimeout(300);
    await a.page.keyboard.press('Control+g');
    await a.page.waitForTimeout(600);
    expect(await groupNames(a)).toContain(`${TEXTS[language].groupDefaultName} 1`);
  });
}

test('a file with old raw-key group names ("groupDefaultName 1") opens as "Group 1", and is saved that way', async ({ launch }) => {
  const old = fixtureJson('groups.tatcad');
  old.spatialGroups = [{ id: 'g1', name: 'groupDefaultName 1', color: '#ff00aa' }, { id: 'g2', name: 'groupDefaultName 2', color: '#00aaff' }];
  const O = '/home/me/OldGroups.tatcad';
  const a = await launch({ fs: { [O]: JSON.stringify(old) } });
  await a.newProject();
  await a.openFile(O);
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Control+a');
  await a.page.waitForTimeout(500);
  const names = await groupNames(a);
  expect(names.some(n => n.includes('groupDefaultName'))).toBe(false);
  expect(names.some(n => n === 'Group 1' || n === 'Group 2')).toBe(true);
  await a.save();
  expect((await a.saved(O)).spatialGroups.map((g: any) => g.name)).toEqual(['Group 1', 'Group 2']);
});

test('the Export SVG dialog follows a language switch made while the app runs', async ({ launch }) => {
  const a = await launch();
  await a.newProject();
  await a.ring();
  await a.page.waitForTimeout(300);
  let picker = a.page.locator('select:has(option[value="hu"])').first();
  if (await picker.count() === 0) {
    await a.page.getByText(a.t('menuOptions'), { exact: true }).first().click();
    await a.page.waitForTimeout(400);
    picker = a.page.locator('select:has(option[value="hu"])').first();
  }
  await picker.selectOption('hu');
  await a.page.waitForTimeout(1200);
  await a.page.keyboard.press('Escape');
  await a.set({ savePath: null });
  await a.page.getByText(TEXTS.hu.menuFile, { exact: true }).first().click();
  await a.page.waitForTimeout(300);
  await a.page.getByText(TEXTS.hu.fileExportSvg, { exact: true }).first().click();
  await a.page.waitForTimeout(1000);
  const dialogs = await a.dialogs();
  const last = dialogs[dialogs.length - 1].options;
  expect(last.title).toBe(TEXTS.hu.fileExportSvg);
  expect(last.filters[0].name).toBe(TEXTS.hu.fileTypeSvg);
});
