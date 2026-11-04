// tauri/userLanguages.ts
//
// Session 60. Languages a user adds or edits WITHOUT a new build.
//
// The built-in languages (src/i18n + public/) are packed into the app at
// build time — the installed app never reads them from disk. This adds one
// folder the installed app DOES read, at every start:
//
//   <app data folder>/languages/
//     Windows  %APPDATA%\com.savarosa.tattingcad\languages\
//     macOS    ~/Library/Application Support/com.savarosa.tattingcad/languages/
//     Linux    ~/.local/share/com.savarosa.tattingcad/languages/
//
// (The app's own data folder, not Documents: reading Documents makes macOS
// ask for permission at every start, for every user.)
//
//   languages.json         optional — { "de": "Deutsch" }: adds languages to
//                          the menu (or renames a built-in one)
//   translations_xx.json   that language's texts; merged OVER the built-in
//                          file key by key — a partial file is fine, missing
//                          texts fall back to the built-in ones, then English
//
// Options → "Add or edit languages…" creates the folder with a README and a
// template, and opens it in the file manager. Desktop app only (Android
// users can't reach that folder; the browser has no files).
//
// Nothing here throws: a missing folder = nothing to add; a broken file is
// skipped and reported in `errors` (shown once as a toast).

import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

export const isDesktopApp = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__
  && !/android|iphone|ipad/i.test(navigator.userAgent || '');

export const userLanguagesDir = async (): Promise<string> =>
  join(await appDataDir(), 'languages');

export interface UserLanguages {
  /** Languages the user's languages.json adds or renames ({} if none). */
  manifest: Record<string, string>;
  /** code → flat texts, for every translations_xx.json found. */
  files: Record<string, Record<string, string>>;
  /** "file name: problem" for each file that couldn't be used. */
  errors: string[];
}

const LANG_CODE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

const flatten = (data: unknown): Record<string, string> | null => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (!k.startsWith('_') && typeof v === 'string') flat[k] = v;
  }
  return flat;
};

/**
 * Read the user's language folder. `knownCodes` = the built-in languages
 * (their translation files are looked for even without a user manifest).
 */
export const readUserLanguages = async (knownCodes: string[]): Promise<UserLanguages> => {
  const result: UserLanguages = { manifest: {}, files: {}, errors: [] };
  if (!isDesktopApp()) return result;
  let dir: string;
  try {
    dir = await userLanguagesDir();
    if (!(await exists(dir))) return result;
  } catch {
    return result;
  }

  const manifestPath = await join(dir, 'languages.json');
  try {
    if (await exists(manifestPath)) {
      const data = JSON.parse(await readTextFile(manifestPath));
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        result.errors.push('languages.json: not a list of "code": "name" pairs');
      } else {
        for (const [code, name] of Object.entries(data as Record<string, unknown>)) {
          if (code.startsWith('_')) continue;
          if (!LANG_CODE_RE.test(code) || typeof name !== 'string' || !name.trim()) {
            result.errors.push(`languages.json: "${code}" skipped (use e.g. "de": "Deutsch")`);
            continue;
          }
          result.manifest[code] = name.trim();
        }
      }
    }
  } catch (err: any) {
    result.errors.push(`languages.json: ${err?.message ?? String(err)}`);
  }

  const codes = Array.from(new Set([...knownCodes, ...Object.keys(result.manifest)]));
  for (const code of codes) {
    const name = `translations_${code}.json`;
    try {
      const path = await join(dir, name);
      if (!(await exists(path))) continue;
      const flat = flatten(JSON.parse(await readTextFile(path)));
      if (!flat) { result.errors.push(`${name}: not a list of "key": "text" pairs`); continue; }
      result.files[code] = flat;
    } catch (err: any) {
      result.errors.push(`${name}: ${err?.message ?? String(err)}`);
    }
  }
  return result;
};

const README = `TattingCAD — your own languages
================================

TattingCAD reads this folder every time it starts. Use it to add a new
language, or to change texts of an existing one — no new version of the
app needed.

ADD A LANGUAGE (example: German, code "de")
1. Copy "translations_TEMPLATE.json" and rename the copy to
   "translations_de.json". It contains every English text of the app.
2. Translate the texts on the RIGHT of each line. Leave the names on the
   left (the "keys") and anything in {curly brackets} exactly as they are.
     "menuFile": "File",   →   "menuFile": "Datei",
   You don't have to translate everything: a text you delete or leave out
   is shown in English.
3. Open "languages.json" (create it if it isn't here) and list your
   language with its code and its name in that language:
     { "de": "Deutsch" }
   Several languages: { "de": "Deutsch", "fr": "Français" }
4. Restart TattingCAD and pick the language in Options → Language.

CHANGE TEXTS OF A BUILT-IN LANGUAGE
Make "translations_en.json", "translations_es.json" or
"translations_hu.json" here with ONLY the lines you want to change, e.g.
     { "menuFile": "Files" }
Restart TattingCAD. Everything else stays as it was — and new texts in
later versions of the app still appear.

TIPS
- Save the files as UTF-8 (most editors do; in Notepad: Save As →
  Encoding UTF-8). Each line ends with a comma except the last one.
- If a file has a mistake, TattingCAD shows a short message when it starts
  and uses the built-in texts instead.
- "translations_TEMPLATE.json" itself is never loaded — it is only a
  starting point. It is refreshed when you use Options → "Add or edit
  languages…" in a newer version, so it always lists all current texts.
- Want your language in TattingCAD for everyone? Send the file to the
  author — it can be included in the next version.
`;

/**
 * Create the folder (with README.txt and a fresh template made from the
 * English texts) and open it in the file manager. Returns the folder path
 * and whether the file manager could be opened.
 */
export const openUserLanguagesFolder = async (englishFile: Record<string, unknown>): Promise<{ dir: string; opened: boolean }> => {
  const dir = await userLanguagesDir();
  await mkdir(dir, { recursive: true });
  await writeTextFile(await join(dir, 'README.txt'), README);
  // The English file as shipped, same order, its "_comment…" notes kept
  // (they say what a group of texts is for; keys starting with "_" are
  // never loaded).
  await writeTextFile(await join(dir, 'translations_TEMPLATE.json'), JSON.stringify(englishFile, null, 2) + '\n');
  try {
    await invoke('plugin:opener|open_path', { path: dir });
    return { dir, opened: true };
  } catch (err) {
    // No file manager to open it with (some Linux setups) — the folder is
    // ready anyway; the caller shows its path instead.
    console.warn('[TATCAD] open languages folder:', err);
    return { dir, opened: false };
  }
};
