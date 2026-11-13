// Frozen baselines for refactors ("same behaviour — prove it").
//
// For EVERY pattern file in test/fixtures/patterns/ the app opens it, saves
// it, and exports it as SVG in both views; the three results are compared
// with the stored ones in test/app/baselines/. A refactor of the canvas
// drawing, Tatting Order, ghost arrays or the file code must leave all of
// them exactly as they are.
//
//   Add a pattern:  drop a .tatcad / .json file into test/fixtures/patterns/
//                   and run the tests once — its baselines are written.
//   Meant change:   npm run test:update, then read the diff of the baselines.
import { test, expect, type App } from './harness';
import { checkBaseline } from '../helpers/baseline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const patternsDir = path.join(here, '../fixtures/patterns');
const baselineFile = (name: string) => path.join(here, 'baselines', name);
const patterns = fs.readdirSync(patternsDir).filter(f => /\.(tatcad|json)$/i.test(f)).sort();

const baseline = (name: string, text: string) => {
  const r = checkBaseline(baselineFile(name), text);
  expect(r.ok, r.message).toBe(true);
};
/** The saved file without what legitimately differs between runs / screens. */
const stableFile = (file: any): string => {
  const { created, camera, zoom, ...rest } = file;
  void created; void camera; void zoom;
  return JSON.stringify(rest, null, 1) + '\n';
};
/** One tag per line, so a difference points at a line. */
const stableSvg = (svg: string): string => svg.replace(/></g, '>\n<') + '\n';

const exportSvg = async (a: App, to: string): Promise<string> => {
  await a.set({ savePath: to });
  await a.menu('menuFile', 'fileExportSvg', { escape: false });   // Esc would leave the realistic view
  await a.page.waitForFunction((p) => p in (window as any).__t.fs, to, { timeout: 8000 });
  return (await a.fs())[to];
};

test('there are patterns to check', () => { expect(patterns.length).toBeGreaterThan(0); });

for (const file of patterns) {
  const stem = file.replace(/\.(tatcad|json)$/i, '');
  test.describe(`pattern: ${file}`, () => {
    const P = `/home/me/${file}`;
    const text = fs.readFileSync(path.join(patternsDir, file), 'utf8');
    const open = async (launch: any): Promise<App> => {
      const a: App = await launch({ fs: { [P]: text } });
      await a.newProject();
      await a.openFile(P);
      return a;
    };

    test('open → save: the file written', async ({ launch }) => {
      const a = await open(launch);
      expect(await a.star(), 'no unsaved star straight after opening').toBe(false);
      const dialog = await a.dialog();
      expect(dialog, 'no question on opening').toBeNull();
      await a.save();
      baseline(`${stem}.saved.json`, stableFile(await a.saved(P)));
    });

    test('open → save → open → save gives the same file again', async ({ launch }) => {
      const a = await open(launch);
      await a.save();
      const once = await a.saved(P);
      const files = await a.fs();
      await a.end();
      const b: App = await launch({ fs: files });
      await b.newProject();
      await b.openFile(P);
      await b.save();
      expect(stableFile(await b.saved(P))).toBe(stableFile(once));
    });

    test('SVG export, schematic', async ({ launch }) => {
      const a = await open(launch);
      baseline(`${stem}.schematic.svg`, stableSvg(await exportSvg(a, `/home/me/${stem}.svg`)));
    });

    test('SVG export, realistic', async ({ launch }) => {
      const a = await open(launch);
      await a.page.mouse.click(1250, 780);
      await a.page.keyboard.press('v');
      await a.page.waitForFunction(() => document.querySelectorAll('svg g[data-el]').length > 0, null, { timeout: 15_000 });
      await a.page.waitForTimeout(600);
      const svg = await exportSvg(a, `/home/me/${stem}-realistic.svg`);
      expect(await a.status(), 'still in the realistic view').toContain(a.t('renderRealistic'));
      baseline(`${stem}.realistic.svg`, stableSvg(svg));
    });
  });
}
