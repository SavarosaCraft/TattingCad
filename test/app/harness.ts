// The app-test harness: starts the app in a fresh browser context with the
// fake Tauri layer, and gives the tests short words for what a user does
// (new project, add a ring, save, open a file, resume, close the window).
//
// One App = one run of the program. app.end() is "the app dies": nothing
// more runs, like a crash or a kill. What a run leaves behind — the files
// (app.fs()) and the autosave (app.autosaveRaw()) — is handed to the next
// App to play "start the app again".
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tauriMockScript, AUTOSAVE_KEY, type MockOptions } from './tauri-mock';

const here = path.dirname(fileURLToPath(import.meta.url));
const texts = (code: string) => JSON.parse(fs.readFileSync(path.join(here, `../../src/i18n/translations_${code}.json`), 'utf8'));
/** The app's bundled texts, so tests click what the app shows instead of hard-coded words. */
export const TEXTS: Record<string, Record<string, string>> = { en: texts('en'), es: texts('es'), hu: texts('hu') };

/** A fixture file's text (test/fixtures/<name>). */
export const fixture = (name: string): string => fs.readFileSync(path.join(here, '../fixtures', name), 'utf8');
export const fixtureJson = (name: string): any => JSON.parse(fixture(name));
export const elementCount = (fileText: string): number => JSON.parse(fileText).elements.length;

export interface StartOptions extends MockOptions {
  /** Emulate a touch screen (tablet). */
  touch?: boolean;
  viewport?: { width: number; height: number };
  /** Page errors that are expected in this run (text fragments). */
  allowErrors?: string[];
  /** Runs on the new page before the app loads (extra routes, scripts). */
  before?: (page: Page) => Promise<void>;
}

export class App {
  readonly errors: string[] = [];
  private constructor(readonly ctx: BrowserContext, readonly page: Page, readonly lang: string, private allow: string[]) {}

  static async start(browser: Browser, o: StartOptions = {}): Promise<App> {
    const url = process.env.TCAD_TEST_URL;
    if (!url) throw new Error('TCAD_TEST_URL is not set — run the app tests with "npm run test:app"');
    const ctx = await browser.newContext({
      viewport: o.viewport ?? { width: 1400, height: 900 },
      ...(o.touch ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    const app = new App(ctx, page, o.language ?? 'en', o.allowErrors ?? []);
    page.on('pageerror', e => { const text = String(e); if (!app.allow.some(a => text.includes(a))) app.errors.push(text.slice(0, 300)); });
    await page.addInitScript(tauriMockScript(o));
    if (o.before) await o.before(page);
    await page.goto(url);
    // The start screen is up once its texts are (they arrive after the page).
    await page.getByText(app.t('splashNewProject'), { exact: true }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(300);
    return app;
  }

  /** The app's own text for a key, in this run's language. */
  t(key: string): string { return TEXTS[this.lang]?.[key] ?? TEXTS.en[key] ?? key; }

  /** The app dies: nothing more runs. */
  async end() { await this.ctx.close(); }

  // ── what a user does ──────────────────────────────────────────────────
  async newProject() {
    await this.page.getByText(this.t('splashNewProject'), { exact: true }).first().click();
    await this.page.waitForTimeout(400);
  }
  /**
   * Adds a ring (Shift+R). A new ring always lands in the middle of the
   * view, so to get rings at DIFFERENT places the view is dragged a little
   * first (Pan tool — the start tool in these tests). x / y only say how
   * far: a quarter of their distance from (700, 500). The same x / y as the
   * ring before = a ring on top of it, which the app reports as a duplicate.
   */
  async ring(x = 700, y = 500) {
    await this.page.keyboard.press('Escape');
    const dx = Math.round((x - 700) / 4), dy = Math.round((y - 500) / 4);
    if (dx || dy) {
      await this.page.mouse.move(1250, 780);
      await this.page.mouse.down();
      await this.page.mouse.move(1250 + dx / 2, 780 + dy / 2, { steps: 2 });
      await this.page.mouse.move(1250 + dx, 780 + dy, { steps: 2 });
      await this.page.mouse.up();
    } else await this.page.mouse.click(1250, 780);
    await this.page.keyboard.press('Shift+R');
    await this.page.waitForTimeout(250);
  }
  /** Ctrl+S. Waits until the save has written, asked where, or asked "the file has changed". */
  async save() {
    const before = (await this.log()).length;
    await this.page.mouse.click(1300, 820);      // out of any text box
    await this.page.keyboard.press('Control+s');
    await this.page.waitForFunction(
      (n) => (window as any).__t.log.length > n || !!document.querySelector('.fixed h2'),
      before, { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(700);         // thumbnail, autosave after the save, title
  }
  /** Start screen → "Resume: …". Returns the button's text. */
  async resume(): Promise<string> {
    const button = this.page.getByText('Resume:', { exact: false }).first();
    const label = ((await button.textContent()) || '').trim();
    await button.click();
    await this.page.waitForTimeout(800);
    return label;
  }
  /** Opens a top menu (File, View, …) and clicks an item, both by their translation keys. */
  async menu(menuKey: string, itemKey: string, o: { escape?: boolean } = {}) {
    if (o.escape !== false) await this.page.keyboard.press('Escape');   // note: Esc also leaves the realistic view
    await this.page.getByText(this.t(menuKey), { exact: true }).first().click();
    await this.page.waitForTimeout(250);
    await this.page.getByText(this.t(itemKey), { exact: true }).first().click();
    await this.page.waitForTimeout(400);
  }
  /** File → Load Project → Browse for file…, answering the dialog with `filePath`. */
  async openFile(filePath: string) {
    await this.set({ openPath: filePath });
    await this.menu('menuFile', 'fileLoad');
    await this.page.getByText(this.t('recentProjectsBrowse').replace(/[….]+$/, ''), { exact: false }).first().click();
    await this.page.waitForFunction((p) => (window as any).__t.log.includes('read ' + p), filePath, { timeout: 8000 });
    await this.page.waitForTimeout(900);         // the pattern is applied and settles
  }
  /** The window goes to the background — the app autosaves. */
  async hide() {
    await this.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete (document as any).visibilityState;
    });
    await this.page.waitForTimeout(250);
  }
  /** The window's X button. Returns how many listeners heard it. */
  async requestClose(): Promise<number> {
    const n = await this.page.evaluate(() => (window as any).__t.emit('close-requested'));
    await this.page.waitForTimeout(700);
    return n;
  }
  async clickButton(name: string) {
    await this.page.getByRole('button', { name, exact: true }).click();
    await this.page.waitForTimeout(900);
  }
  /** Switches the canvas to the Select tool and drags a box around the first element. */
  async selectFirstElement() {
    const box = (await this.page.locator('g[data-round]').first().boundingBox())!;
    await this.page.getByTitle(this.t('toolSelect'), { exact: true }).first().click();
    await this.page.waitForTimeout(200);
    await this.page.mouse.move(box.x - 15, box.y - 15);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await this.page.mouse.move(box.x + box.width + 15, box.y + box.height + 15, { steps: 5 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(500);
    return box;
  }
  /** Types a new notation into the property bar's notation box (which shows `current`) and presses Enter. */
  async typeNotation(current: string, next: string) {
    const found = await this.page.evaluate((v) => {
      const box = [...document.querySelectorAll('input')].find(i => i.value === v);
      if (!box) return false; box.focus(); return true;
    }, current);
    expect(found, `notation box showing "${current}"`).toBe(true);
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type(next);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(700);
  }

  // ── what a test looks at ──────────────────────────────────────────────
  /** Sets fields of the fake Tauri layer (openPath, savePath, ask, clipboard, failWrite). */
  async set(values: Record<string, unknown>) { await this.page.evaluate((v) => Object.assign((window as any).__t, v), values); }
  async fs(): Promise<Record<string, string>> { return this.page.evaluate(() => (window as any).__t.fs); }
  async saved(filePath: string): Promise<any> { const f = await this.fs(); return filePath in f ? JSON.parse(f[filePath]) : null; }
  async log(): Promise<string[]> { return this.page.evaluate(() => (window as any).__t.log); }
  async dialogs(): Promise<{ cmd: string; options: any }[]> { return this.page.evaluate(() => (window as any).__t.dialogs); }
  async autosaveRaw(): Promise<string | null> { return this.page.evaluate((k) => localStorage.getItem(k), AUTOSAVE_KEY); }
  async autosave(): Promise<any> { const raw = await this.autosaveRaw(); return raw ? JSON.parse(raw) : null; }
  /** The title starts with * when there are unsaved changes. */
  async star(): Promise<boolean> { return (await this.page.title()).startsWith('*'); }
  /** The message at the bottom of the window, or null. */
  async toast(): Promise<string | null> {
    return this.page.evaluate(() => { const e = document.querySelector('.fixed.bottom-8'); return e ? e.textContent : null; });
  }
  /** Polls for a toast for up to `ms` (they come and go). */
  async waitToast(ms = 2500): Promise<string | null> {
    const until = Date.now() + ms;
    while (Date.now() < until) { const t = await this.toast(); if (t) return t; await this.page.waitForTimeout(80); }
    return null;
  }
  async status(): Promise<string> {
    return this.page.evaluate(() => (document.querySelector('.info-bar')?.textContent || '').replace(/\s+/g, ' ').trim());
  }
  /** The confirm dialog on screen: title, body, and its buttons with their colour — or null. */
  async dialog(): Promise<{ title: string; body: string; buttons: { text: string; color: string }[] } | null> {
    return this.page.evaluate(() => {
      const h = [...document.querySelectorAll('.fixed h2')].pop();
      if (!h) return null;
      const box = h.parentElement!;
      return {
        title: h.textContent || '', body: box.querySelector('p')?.textContent || '',
        buttons: [...box.querySelectorAll('button')].map(b => ({ text: b.textContent || '', color: (b.className.match(/bg-(red|blue|gray|green|amber|orange)-\d+/) || ['', ''])[1] })),
      };
    });
  }
}

// ── the test object ───────────────────────────────────────────────────────
// `launch(options)` starts an App; every App of a test is closed at its end,
// and the test fails if any of them reported a page error (an exception the
// app didn't catch) that the test didn't expect.
export const test = base.extend<{ launch: (o?: StartOptions) => Promise<App> }>({
  launch: async ({ browser }, use) => {
    const apps: App[] = [];
    await use(async (o) => { const app = await App.start(browser, o); apps.push(app); return app; });
    const errors = apps.flatMap(a => a.errors);
    for (const a of apps) await a.end().catch(() => {});
    expect(errors, 'page errors (exceptions the app did not catch)').toEqual([]);
  },
});
export { expect };
