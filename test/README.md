# TattingCAD — tests

One command runs everything:

```
npm test
```

That is: the type check, the unit tests, then the app tests. Each part alone:

| Command | What | Time |
|---|---|---|
| `npm run typecheck` | TypeScript check of `src/` (tsconfig.json) | ~15 s |
| `npm run test:unit` | Unit and property tests (Vitest) — pure code, no browser | ~1 min |
| `npm run test:app` | The real app in a browser (Playwright) with a fake Tauri layer | ~8 min |
| `npm run test:update` | Rewrites the frozen baselines — only for a change that is meant | |

One file: `npx vitest run test/unit/parser.test.ts` ·
`npx playwright test test/app/resume-and-save` · by name:
`npx playwright test -g "file has changed"`.

**First time on a computer:** `npm install`, then
`npx playwright install chromium` (downloads the test browser once).

## Layout

```
test/
  unit/                 Vitest — domain/, utils/, render/ (no browser)
    parser.cases.ts       THE NOTATION TABLE: notation → what the parser makes of it
    parser.test.ts        runs the table + the parser's helper functions
    picotTools.test.ts    every Picot Tools action + rules over 6,000 random notations
    safeNumber.test.ts    review #1 / #6: numbers from files; markup never reaches the drawing
    safeColor.test.ts     colours from files
    fileFingerprint / safeFileName / projectFile (save format, groups, unsaved key)
    realisticRenderer.test.ts   gradient on split rings, element groups, frozen bakes
    translations.test.ts  en / es / hu in step; public/ copies equal to src/i18n
    helpers/patterns.ts   one element of every kind, seeded random patterns
    baselines/            frozen realistic bakes
  app/                  Playwright — the app itself
    harness.ts            App: newProject, ring, save, openFile, resume, requestClose …
    tauri-mock.ts         the fake Tauri layer (in-memory files, dialogs, clipboard)
    global-setup.ts       starts Vite on a free port for the run
    resume-and-save       review #4 — Resume, "The file has changed", closing
    unsaved-and-groups    #2 unsaved star, #3 groups in the file, #5 New
    damaged-files         #1 crafted files (open / Resume / paste), #6 crash screen, #13 toast
    notation-and-joins    #22 join kept / removed, bcjp, #21 Picot Tools message
    small-fixes           #8 storage full, #10 touch ±1°, #12, #14, #16, #17, #20
    language              group-merge dialog, group names, Export SVG after a language switch
    tatting-order         repeat R colours, Assign Repeat, SVG round layers
    guide-point-join      a lone gp can be joined (zoom in / out, after reopening)
    ghost-arrays          ghost arrays step by step → baselines/ghost-arrays.scenario.txt
                          (Task 2 safety net; pattern coords → screen via getScreenCTM)
    baselines             every pattern in fixtures/patterns: saved file + SVG, both views
    baselines/            the frozen results
  fixtures/             pattern files the tests open
    patterns/             ← drop a .tatcad here and it gets baselines on the next run
  helpers/baseline.ts   the baseline compare (line-ending safe)
  tools/                update-baselines.mjs
```

## How the app tests work

The app runs in Chromium from the Vite dev server, which the test run starts
itself on a port the system picks (never a fixed port, never a server left
from an earlier run). Before the page loads, `tauri-mock.ts` puts a fake
`window.__TAURI_INTERNALS__` in place, so the app believes it is the desktop
app: Save and Open go to an in-memory "disk", dialogs answer what the test
set, the window's X and the clipboard can be driven.

One `App` is one run of the program. `app.end()` is the program dying.
What a run leaves behind — its files (`app.fs()`) and its autosave
(`app.autosaveRaw()`) — is handed to the next `launch({ fs, autosave })`:
that is "start the app again".

A test fails on any exception the app didn't catch (unless the test says
it expects one, e.g. the crash-screen tests).

Tests click what the app shows through the translation key
(`a.t('fileExportSvg')`), so a reworded button doesn't break them.

## Frozen baselines

A baseline is a stored result: the realistic bake of fixed patterns
(`unit/baselines`), and for every pattern in `fixtures/patterns/` the saved
file and the SVG export in both views (`app/baselines`). A refactor must
leave them exactly as they are — that is the proof of "same behaviour".

- A missing baseline is written on the first run (and the test passes).
- A baseline that changes **on purpose**: `npm run test:update`, then read
  the diff of the baseline files before committing them.
- The more real patterns in `fixtures/patterns/`, the more a refactor is
  held to. Good candidates: the shipped samples, a pattern with ghost
  arrays, with beads, with split rings, with a reference image.

## Tests marked "TO CONFIRM" / "FINDING"

These pin behaviour that looks like a slip, as the code is today, so that a
change is noticed. They are questions for the user, not rules. When one is
decided and fixed, its test is rewritten to the agreed behaviour.

## Writing a new test

- Pure function → `test/unit/`. Prefer a rule over many random inputs
  (seeded, see `makeRng`) to a handful of examples.
- Something a user does → `test/app/`, with the `App` words. Wait for a
  thing to happen (`waitForFunction`, `waitToast`) rather than a long sleep.
- After writing it, break the code on purpose and see the test fail. A test
  that can't fail proves nothing.

**Windows: start the tests from `C:\…`, not `c:\…`.** If the terminal's path
has a lowercase drive letter (the VS Code terminal often does), Vitest loads
itself twice and every unit test file fails at its first `describe` with
"Cannot read properties of undefined (reading 'config')" or "Vitest failed to
find the runner". Fix: `cd C:\TattingCad` (capital C), then run again.

**The pattern baselines (`test/app/baselines/<pattern>.*`) belong to your
computer.** The SVG export carries colour data from the project's `public/`
folder, so they can only be made where the real `public/` is. Make them with
`npm run test:update` on your machine and commit them; Claude's zips don't
contain them (session 64: a zip carried baselines made with a stand-in
`public/` and overwrote yours — 4 SVG tests failed). The ghost reference
(`ghost-arrays.scenario.txt`, saved-file text only) is the same everywhere.
