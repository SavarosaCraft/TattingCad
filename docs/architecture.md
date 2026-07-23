# TattingCAD — Architecture

## Module structure

```
src/
  tattingindex.tsx        Main component (orchestration only)
  main.tsx
  index.css

  utils/
    id.ts                 generateId() — crypto.randomUUID() only, no Date.now()

  geometry/
    bezier.ts             sampleBezierPath, calculatePathLength,
                          getPointAndAngleAtDistanceFast, getPointAndAngleAtDistance,
                          interpolateColor
    layout.ts             getBoundingBox(ids, elements, dsWidth)
    paths.ts              createCirclePath, createTeardropPath, createSplitRingPath,
                          createSplitRingPathFromEl, rotatePaths, mirrorPaths,
                          applyRotationToPathData, rotatePathsAroundCenter,
                          applyPathPreset, applyLinePreset

  domain/
    parser.ts             parseNotation, reverseNotation, buildSegmentLabel,
                          getSegmentRuns, countActualStitches, countStitchesInRange,
                          getStitchTypes, expandTokens, isZeroWidth, isNotationValid,
                          normalizePattern, normalizeNotationInput
    patternOutput.ts      generatePatternText() — pure pattern text builder
    picotTools.ts         Picot Wizard pure transforms — all notation-text operations.
                          No React dependencies. 93 unit tests in test_picotTools.js.
                          Exports (grouped by feature):
                          — Analysis: analyzeNotation, totalRunDs
                          — Clear: clearUnjoinedPicots, hasUnjoinedPicots
                          — Add: addPicotsToRuns, hasAddablePicotRuns
                          — Protected zones: getProtectedZones, isRunProtected,
                            clampProtectedFloor
                          — Fill density: previewFillDensity, maxUsefulFillGap
                          — Compact: compactRepeatedPicots, hasCompactableGroups,
                            autoCompact (auto-compacts any transform result before commit)
                          — Scale: scaleNotation, suggestScalePresets (returns
                            { exact, rounded } rows), suggestScalePresetsMulti
                          All transform functions (clearUnjoinedPicots, addPicotsToRuns,
                          previewFillDensity) return a resultZeroWidth array alongside
                          the new notation string — required for autoCompact to know
                          which picots are new (safe to fold) vs carried over (must
                          respect isJoint as a group break).

  render/
    svgExport.ts          prepareSvgForExport(), ORDER_GROUP_COLORS

  components/
    ScaleControls.tsx     Shared presentational Scale UI — two rows of preset buttons
                          (exact/rounded), percentage input, preview line, clamped
                          warning, and Apply button. Used by both the single-element
                          Picot Wizard and the multi-element batch Scale tool.
                          Exports ScaleControls (component) and WIZARD_BUTTON_CLASS
                          (shared Tailwind class string for all wizard action buttons).
                          Multi-element callers pass roundedPresets={[]} to suppress
                          the rounded row — it only appears for single-element scale.

  tauri/
    file.ts               showSaveDialog, showOpenDialog, showSaveSvgDialog,
                          writeProjectFile, writeTextToFile, readProjectFile,
                          addToRecents, getRecents, generateThumbnail,
                          writeClipboardText, readClipboardText

  hooks/
    useUIState.ts         All dialog, menu, and UI visibility state
                          ⚠ Must run automated cross-check against tattingindex.tsx
                            destructure whenever adding new state — missing declarations
                            crash silently mid-function (dialog never closes, state never
                            updates). See session 37 for the cross-check script.
    useCanvasInteraction.ts  Canvas drag, pivot, selection, rotation handle state
    useTattingOrder.ts    Tatting order mode state
    useProjectState.ts    Project/file state
    useBeadState.ts       Bead, picot, thread state
    useViewState.ts       Visual settings state
    usePatternState.ts    Core domain state (elements, picotConnections, materials…)
    useHistoryActions.ts  pushHistoryState — snapshot includes elements, picotConnections,
                          orderGroups, polarGrids. Carries forward previous polarGrids when
                          grids argument is omitted (safe default for the ~25 action call
                          sites that don't touch grids).
    useEditorActions.ts   All element-level actions: creation, deletion, clipboard,
                          ordering, grouping, alignment, rotation.
                          Returns helpers (getElementBounds, getSelectionBoundingBox,
                          moveElement, getElementPivot, getPolarPivot) still needed by
                          tattingindex for rotation and other callbacks.
    useInputHandlers.ts   handleMouseDown/Move/Up. Zero state-mirror ref reads.
    useJoinActions.ts     joinSelectedPicots, breakSelectedPicots,
                          checkAndStoreInheritedJoin, removeInheritedJoins
    useBEClipboard.ts     copyBEToClipboard, cutBEToClipboard, pasteBeClipboard
    useProjectFile.ts     buildProjectData, saveToPath, performSave, saveProject,
                          saveProjectAs, applyProjectData, loadFromPath, loadProject,
                          exportSVG

  i18n/
    translations_en.json  Bundled English strings — canonical fallback,
                          loaded unconditionally at startup, cannot be deleted by users
```

---

## Rules

### ID system
Always use `generateId()` from `src/utils/id.ts`. Never use `Date.now()` or `Math.random()` for element IDs. The one exception is `addToRecents` entry IDs which are UI-only and not tatting elements.

### Pure functions
Functions in `geometry/` and `domain/` must have zero React dependencies. No `useState`, no `useRef`, no component state. They accept all dependencies as explicit parameters.

### Tauri isolation
All `@tauri-apps/*` imports live exclusively in `src/tauri/`. The main component imports from `src/tauri/file.ts` only. The one remaining exception is `ask` (exit confirmation dialog) which is used in a `useEffect` — candidate for moving to `tauri/` in a future session.

### State hooks
State grouped by concern into custom hooks in `src/hooks/`. The hook returns all state and setters. The component destructures them at the top. Hooks must not import from each other.

### Picot Wizard — notation update options
`updateNotation` and `updateNotationForMultiple` both accept a `NotationUpdateOpts` object:

```ts
interface NotationUpdateOpts {
  preservesExistingPicots?: boolean;       // default false
  picotMatchMode?: 'stitchesBefore' | 'order'; // default 'stitchesBefore'
}
```

**`preservesExistingPicots: true`** — skips the wipe-and-confirm dialog and lets
the ordinary stitchesBefore-based merge re-attach `isJoint` flags. Only valid when
the caller can prove no existing picot's position shifts: Clear, Add, Fill, and
Compact all satisfy this (they only insert/remove zero-width tokens inside
picot-free runs, or re-serialise to repeat-group syntax).

**`picotMatchMode: 'order'`** — matches old↔new picots by sequential index instead
of `stitchesBefore`. Required for Scale, where ds counts around picots change so
position-keyed matching would silently lose every join. Only valid when the caller
can prove the same picots survive in the same order with nothing added or removed.

Always use both together for Scale:
```ts
updateNotation(notation, null, id, { preservesExistingPicots: true, picotMatchMode: 'order' });
```

### Picot Wizard — batch update
`updateNotationForMultiple(targets, opts)` reads `elementsRef.current` **once**,
applies all targets in a single pass, and commits with one `setElements` + one
history entry. Never call `updateNotation` in a loop — `elementsRef` syncs from
state via `useEffect` (after commit), so a second call in the same tick would read
a stale snapshot and overwrite the first change.

`updateNotationForMultiple` only supports `preservesExistingPicots: true` callers
and silently skips ghost-mother elements (ghost regeneration is single-target;
batching it is deferred).

### Picot Wizard — auto-compaction
Always call `autoCompact(notation, resultZeroWidth)` on a transform result before
passing it to `updateNotation`. This folds repeated `(Xds-p)` sequences into
repeat-group syntax automatically, so the user sees clean grouped notation without
a manual "Group repeated picots" step. `autoCompact` falls back to the uncompacted
notation if analysis fails — it is always safe to call.

The `resultZeroWidth` array comes from the transform function's return value
(Clear, Add, Fill). For Scale (which never changes picot count or order), pass the
original `el.picots` array directly.

### Translation files — safe update process
**Never round-trip translation JSON through `json.dumps` with `indent=None`** — this
collapses the file to one line, silently corrupting it. Always use `indent=2` for
HU/ES files (which use 2-space indentation) and preserve the original indent style
for EN.

The safest pattern, especially in long sessions where multiple edits have accumulated:
rebuild from the pristine original upload and reapply all fixes in one traceable pass,
then diff against the original to confirm zero unexpected changes. Session 38 had a
silent key-loss bug caught this way.

Translation files are currently at **558 keys** (534 pristine + 24 added in session 38).

### Translation fallback chain
`t(key)` resolution order:
1. `extraTranslations[currentLanguage][key]` — external JSON for current language
2. `TRANSLATIONS[currentLanguage][key]` — any remaining hardcoded strings
3. `extraTranslations['en'][key]` — bundled `translations_en.json`
4. `key` itself — last resort, visible to user as a string

`translations_en.json` is loaded unconditionally at startup before any manifest check. External `translations_en.json` in the user's app folder merges over it (allowing overrides) but cannot break the fallback since the bundled file is always loaded first.

### Ghost array regeneration — critical rule
**Never call `generateId()` inside a `setElements(fn)` functional updater.**
React (Strict Mode) double-invokes functional updaters to catch impure ones.
`generateId()` is non-deterministic — two different sets of IDs get generated from
the same old IDs, desyncing the IDs committed to state from the ones used to rewire
`picotConnections`.

Always use `regenerateGhostArrays()` as a pure function and commit with plain values:

```ts
// CORRECT
const result = regenerateGhostArrays(elementsRef.current, ghostArrays, [motherId]);
setElements(result.elements);          // plain value, not fn
setGhostArrays(result.ghostArrays);
if (result.connectionIdMap.size > 0) {
  setPicotConnections(prev => prev.map(conn => ({
    ...conn,
    picots: conn.picots.map(cp => ({
      ...cp,
      elementId: result.connectionIdMap.get(cp.elementId) || cp.elementId,
    })),
  })));
}

// WRONG — React may call the updater twice, generateId() produces different IDs each time
setElements(prev => {
  const result = regenerateGhostArrays(prev, ghostArrays, [motherId]); // BUG
  return result.elements;
});
```

---

## What stays in tattingindex.tsx for now

- `computeElementAfterNotationEdit` — extracted from `updateNotation` as a pure
  per-element helper, now reused by both `updateNotation` and
  `updateNotationForMultiple`. Still lives in `tattingindex.tsx` because it closes
  over `parseNotation`, `dsWidth`, `restoreBEConfigs`, `extractBEConfigs`,
  `calculatePathLength`, and `sampleBezierPath` — candidate for `domain/` once
  those dependencies are explicitly parameterised.
- `getGradientColorAtPosition` — closes over `dmcColors` state, needs redesign before extracting
- `getSnapPoints` — depends on `getPicotPosition` which is itself a large component function
- `regenerateGhostArrays` / `updateGhostArraysForMother` — needs `createPolarInstance`, `createLinearInstance`, `polarGrids` in scope; candidate for extraction once a clean data interface is designed
- `executePolarArray` / `executeLinearArray` / `executeSpiralArray` — array creation dialogs; closely coupled to dialog state
- History undo/redo — moved to `useEditorActions`; full JSON stringify on every change, candidate for structural diff redesign
- All rendering (SVG, realistic baking) — needs a data interface design before extracting
- Picot Wizard popover JSX — single-element (Clear/Add/Fill/Compact/Scale) and
  multi-element (Scale only) popovers. Scale UI is shared via `ScaleControls`
  component; Clear/Add/Fill/Compact are still inline IIFE blocks (~150 lines),
  candidates for componentisation in the same pattern.

---

## Pending refactor work (not done)

| Item | Notes |
|---|---|
| `computeElementAfterNotationEdit` → `domain/` | Currently in tattingindex.tsx; needs explicit params for dsWidth, bezier helpers |
| Picot Wizard popovers → components | Clear/Add/Fill/Compact still inline IIFEs; follow the ScaleControls pattern |
| `usePicotWizardState.ts` | 6 wizard state entries currently in `useUIState.ts`; enough to warrant a dedicated hook once the popovers are componentised |
| `getSnapPoints` → `geometry/layout.ts` | Blocked by `getPicotPosition` dependency |
| `bakeRealisticView` → `render/realisticRenderer.ts` | Needs explicit data interface design first |
| Tauri `ask` call → `tauri/file.ts` | Small, low priority |
| History system | Replace full JSON stringify with structural diff or command pattern |
| `regenerateGhostArrays` → dedicated hook/module | Needs clean data interface for `createPolarInstance`/`createLinearInstance` |
| Ref mirror → `useReducer` | The big architectural unlock; makes memoization meaningful and eliminates the remaining ~14 mirror refs |
| JSX panel extraction | ~8,000-line return still monolithic; extract ToolbarPanel, PropertiesPanel, CanvasLayer, dialogs |
| OBB bounding box | Oriented bounding box for single-element selection (rotate box with object); AABB stays for multi-select |
| `isTooShort` flag on move/transform | Currently only set when notation changes (via `computeElementAfterNotationEdit`); needs a second write-site in move/transform handlers for when endpoints shift without notation changing |
| Endpoint joints across ghost arrays | `checkAndStoreInheritedJoin` only handles regular picots; `__start__`/`__end__`/`__anchor__` pseudo-picots not yet inherited |
