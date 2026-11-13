// Editing a joined ring's notation through the property bar:
//  - review #22: a joined picot that becomes a bead which can't be joined
//    loses its join (with the usual warning); bjp / bcjp / lp keep it;
//  - bcjp (finished in session 63) parses, keeps the join, draws;
//  - review #21: Picot Tools refuse invalid notation.
import { test, expect, fixture, type App } from './harness';

const F = '/home/me/Groups.tatcad';     // two rings "r: 3ds-p-3ds", joined picot to picot

const editFirstRing = async (launch: any, notation: string) => {
  const a: App = await launch({ fs: { [F]: fixture('groups.tatcad') } });
  await a.newProject();
  await a.openFile(F);
  await a.selectFirstElement();
  await a.typeNotation('r: 3ds-p-3ds', notation);
  const warning = await a.dialog();              // "this edit removes a join" — only when it does
  if (warning) { await a.page.locator('.fixed button').first().click(); await a.page.waitForTimeout(600); }
  return { a, warning };
};
const savedState = async (a: App) => {
  await a.page.keyboard.press('Escape');
  await a.save();
  const file = await a.saved(F);
  return {
    joins: file.picotConnections.length,
    joined: file.elements.flatMap((e: any) => e.picots.map((p: any) => !!p.isJoint)),
    beads: file.elements.flatMap((e: any) => e.picots.filter((p: any) => p.beadType).map((p: any) => [p.beadType, p.coreSize ?? null, p.beadSeq ?? null, p.stitchesBefore])),
    notations: file.elements.map((e: any) => e.notation),
  };
};

test.describe('a joined picot changes kind (#22)', () => {
  for (const [notation, beads] of [
    ['r: 3ds-lp-3ds', []],
    ['r: 3ds-bjp:Y-3ds', [['bjp', null, 'Y', 3]]],
    ['r: 3ds-bcjp:Y-3ds', [['bcjp', 'Y', null, 3]]],
    ['r: 3ds-bcjp:Y:ZZ-3ds', [['bcjp', 'Y', 'ZZ', 3]]],
  ] as const) {
    test(`${notation} keeps the join, no warning`, async ({ launch }) => {
      const { a, warning } = await editFirstRing(launch, notation);
      expect(warning).toBeNull();
      const s = await savedState(a);
      expect(s.notations).toContain(notation);
      expect(s.joins).toBe(1);
      expect(s.joined).toEqual([true, true]);
      expect(s.beads).toEqual(beads);
    });
  }

  test('r: 3ds-bc:Y-3ds (a core bead can\'t be joined) → warning, the join goes, both sides unjoined', async ({ launch }) => {
    const { a, warning } = await editFirstRing(launch, 'r: 3ds-bc:Y-3ds');
    expect(warning).not.toBeNull();
    expect(warning!.title + warning!.body).toMatch(/join/i);
    const s = await savedState(a);
    expect(s.notations).toContain('r: 3ds-bc:Y-3ds');
    expect(s.joins).toBe(0);
    expect(s.joined).toEqual([false, false]);
    expect(s.beads).toEqual([['bc', null, null, 3]]);
  });

  test('bcjp is typed in small letters too, is not shown as invalid, and draws in realistic view', async ({ launch }) => {
    const { a } = await editFirstRing(launch, 'r: 3ds-bcjp:y:zz-3ds');
    const invalid = await a.page.evaluate(() => [...document.querySelectorAll('input')].some(i => /bcjp/i.test(i.value) && /red/.test(i.className)));
    expect(invalid, 'notation box marked red').toBe(false);
    await a.page.mouse.click(1250, 780);
    await a.page.keyboard.press('v');
    await a.page.waitForTimeout(1500);
    expect(await a.page.evaluate(() => document.querySelectorAll('svg g[data-el]').length)).toBe(2);
    const s = await savedState(a);
    expect(s.beads).toEqual([['bcjp', 'Y', 'ZZ', 3]]);
    expect(s.joins).toBe(1);
  });
});

test.describe('Picot Tools and invalid notation (#21)', () => {
  const panelText = async (a: App) => {
    await a.page.getByTitle(a.t('picotWizardTitle')).first().click();
    await a.page.waitForTimeout(600);
    return a.page.evaluate(() => (document.querySelector('.picot-wizard-pop') as HTMLElement | null)?.innerText || '');
  };
  test('two picots side by side → "Fix the notation first"', async ({ launch }) => {
    const { a } = await editFirstRing(launch, 'r: 3ds-p-p-3ds');
    const text = await panelText(a);
    expect(text).toContain('Fix the notation first');
  });
  test('valid notation with an end picot → the tools are offered', async ({ launch }) => {
    const { a } = await editFirstRing(launch, 'r: 3ds-p-3ds-p');
    const text = await panelText(a);
    expect(text).not.toContain('Fix the notation');
    expect(text.length).toBeGreaterThan(50);
    expect(text).toContain('Apply scale');
  });
});
