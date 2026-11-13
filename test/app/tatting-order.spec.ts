// Tatting Order (session 63): a repeat's "R" has the colours of its round's
// numbers; Assign Repeat moves a repeat into the chosen round in one click.
// Fixture: 7 rings — Round 1: #1 + one repeat; Round 2: #1 + two repeats;
// no round: one repeat and a ring numbered 5.
import { test, expect, fixture, type App } from './harness';

const F = '/home/me/Rounds.tatcad';
const R1 = 'round-one', R2 = 'round-two';

const inTattingOrder = async (launch: any): Promise<App> => {
  const a: App = await launch({ fs: { [F]: fixture('rounds.tatcad') } });
  await a.newProject();
  await a.openFile(F);
  await a.menu('menuView', 'viewTattingOrder');
  await a.page.waitForTimeout(800);
  return a;
};
const badges = (a: App) => a.page.evaluate(() => [...document.querySelectorAll('text[data-layer="order"]')].map(t => ({
  text: t.textContent, fill: t.getAttribute('fill'), stroke: t.getAttribute('stroke'),
  round: t.closest('g[data-round]')?.getAttribute('data-round') || '',
})));
const repeatsIn = (a: App, round: string) => a.page.evaluate((r) =>
  [...document.querySelectorAll(`g[data-round="${r}"] text[data-layer="order"]`)].filter(t => t.textContent === 'R').length, round);

test('each R has its round\'s number colours; an R in no round keeps the grey theme colour', async ({ launch }) => {
  const a = await inTattingOrder(launch);
  const all = await badges(a);
  const colours = (round: string, repeat: boolean) => [...new Set(all.filter(b => b.round === round && (b.text === 'R') === repeat).map(b => `${b.fill}/${b.stroke}`))];
  expect(all.filter(b => b.text === 'R')).toHaveLength(4);
  for (const round of [R1, R2]) {
    expect(colours(round, false), `numbers of ${round}`).toHaveLength(1);
    expect(colours(round, true), `R of ${round}`).toEqual(colours(round, false));
  }
  expect(colours(R1, false)).not.toEqual(colours(R2, false));     // the two rounds differ
  const loose = all.filter(b => b.round === '' && b.text === 'R');
  expect(loose).toHaveLength(1);
  expect(loose[0].fill).toBe('#9ca3af');                           // theme: orderRepeatText
  expect(colours('', true)).not.toEqual(colours('', false));       // apart from the unassigned numbers
});

test('Assign Repeat moves a repeat into the round chosen in the dropdown, in one click; Undo after Exit puts it back', async ({ launch }) => {
  const a = await inTattingOrder(launch);
  expect([await repeatsIn(a, R1), await repeatsIn(a, R2)]).toEqual([1, 2]);
  // choose Round 1 in the dropdown
  await a.page.getByText(a.t('tattingOrderUngrouped'), { exact: false }).first().click();
  await a.page.waitForTimeout(300);
  await a.page.getByText('Round 1', { exact: true }).first().click();
  await a.page.waitForTimeout(300);
  // select one of Round 2's repeats by clicking its R
  const [x, y] = await a.page.evaluate((r) => {
    const t = [...document.querySelectorAll(`g[data-round="${r}"] text[data-layer="order"]`)].find(t => t.textContent === 'R')!;
    const box = t.getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2];
  }, R2);
  await a.page.mouse.click(x, y);
  await a.page.waitForTimeout(500);
  const assign = a.page.getByText(a.t('btnAssignRepeat'), { exact: true }).first();
  expect(await assign.isEnabled(), 'Assign Repeat is active for a repeat in another round').toBe(true);
  await assign.click();
  await a.page.waitForTimeout(500);
  expect([await repeatsIn(a, R1), await repeatsIn(a, R2)]).toEqual([2, 1]);
  expect(await assign.isEnabled(), 'greyed out: already a repeat in this round').toBe(false);

  // Undo is off inside the mode; the step undoes after Exit Mode.
  await a.page.getByText(a.t('picotExitBtn'), { exact: false }).first().click();
  await a.page.waitForTimeout(400);
  await a.page.mouse.click(1250, 780);
  await a.page.keyboard.press('Control+z');
  await a.page.waitForTimeout(500);
  await a.save();
  const file = await a.saved(F);
  expect(file.elements.filter((e: any) => e.isRepeat).map((e: any) => e.roundId ?? null).sort()).toEqual([R1, R2, R2, null].sort());
});

// Rounds as SVG layers (session 63): with two or more rounds in use, Design /
// Notation / Order Numbers each get a sub-layer per round.
test.describe('SVG export: a sub-layer per round', () => {
  const layers = (svg: string) => [...svg.matchAll(/inkscape:label="([^"]*)"/g)].map(m => m[1]);
  const exportSvg = async (a: App, realistic: boolean) => {
    if (realistic) { await a.page.mouse.click(1250, 780); await a.page.keyboard.press('v'); await a.page.waitForTimeout(1500); }
    await a.set({ savePath: '/home/me/out.svg' });
    await a.menu('menuFile', 'fileExportSvg', { escape: false });
    await a.page.waitForFunction(() => '/home/me/out.svg' in (window as any).__t.fs, null, { timeout: 8000 });
    return (await a.fs())['/home/me/out.svg'];
  };
  const open = async (launch: any, name: string) => {
    const a: App = await launch({ fs: { [F]: fixture(name) } });
    await a.newProject();
    await a.openFile(F);
    return a;
  };

  test('schematic: Round 1 / Round 2 under Design, Notation and Order Numbers; joins in one layer', async ({ launch }) => {
    const svg = await exportSvg(await open(launch, 'rounds.tatcad'), false);
    const all = layers(svg);
    expect(all.filter(l => l === 'Round 1')).toHaveLength(3);
    expect(all.filter(l => l === 'Round 2')).toHaveLength(3);
    for (const top of ['Design', 'Notation', 'Order Numbers', 'Joins']) expect(all.filter(l => l === top), top).toHaveLength(1);
    expect(svg).not.toMatch(/data-round=|data-el=/);            // working marks don't reach the file
  });

  test('realistic: the baked drawing is split by round too', async ({ launch }) => {
    const svg = await exportSvg(await open(launch, 'rounds.tatcad'), true);
    const all = layers(svg);
    expect(all.filter(l => l === 'Round 1').length).toBeGreaterThanOrEqual(1);
    expect(all.filter(l => l === 'Round 1').length).toBe(all.filter(l => l === 'Round 2').length);
    expect(svg).not.toMatch(/data-round=|data-el=/);
  });

  test('a pattern without rounds has no round layers', async ({ launch }) => {
    const svg = await exportSvg(await open(launch, 'groups.tatcad'), false);
    expect(layers(svg).some(l => /^Round/.test(l))).toBe(false);
    expect(layers(svg)).toContain('Design');
  });
});
