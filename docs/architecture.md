# TattingCAD — Architecture

## Module structure

```
src/
  tattingindex.tsx        Main component (orchestration only)
  main.tsx
  index.css

  utils/
    id.ts                 generateId() — crypto.randomUUID() only, no Date.now()
    elementUpdates.ts      updateElement(prev, id, updates), updateSelected(prev, ids,
                          updates), updateWhere(prev, predicate, updates) — the
                          "patch matching elements" shape of setElements(prev =>
                          prev.map(...)). `updates` may be a plain object or a
                          function of the current element (for patches that read
                          the element being updated, e.g. toggling a boolean).
                          Converted 19 of the ~39 setElements(prev => prev.map(el
                          => ...)) call sites in tattingindex.tsx (session —
                          element update extraction); the other ~20 were left as
                          plain prev.map() because they touch notation, paths,
                          rotation math, or picot/bead structure and must keep
                          going through computeElementAfterNotationEdit /
                          regenerateGhostArrays / explicit path regeneration
                          rather than a generic patch helper. Do not "clean up"
                          those remaining sites into updateElement/updateSelected
                          without re-checking each one individually against that
                          rule — that's what makes them ineligible in the first
                          place, not oversight.

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
    AddPicotsSection.tsx   Presentational "Add" section of the single-element Picot
    FillPicotsSection.tsx  Wizard popover (symmetric/asymmetric toggle; density slider
    CompactPicotsSection.tsx + preview; a plain apply button) — extracted from that
                          popover's ~150-line inline IIFE (session — Picot Wizard
                          section extraction), same pattern as ScaleControls. Unlike
                          ScaleControls these are each used in exactly ONE place —
                          the single-element wizard only; the multi-element batch
                          Scale popover deliberately has no Add/Fill/Compact (see its
                          own comment: "no Clear/Add/Fill/Compact here — just Scale").
                          So this extraction's value is readability/separation of
                          concerns (shrinking one dense IIFE into named pieces), not
                          duplication removal — worth knowing before reaching for
                          these expecting a second call site to exist somewhere.
                          Reverse and Clear stayed as plain inline buttons — each is
                          a single <button>, not worth a component.
    RealisticModeBar.tsx   One of six mutually-exclusive branches of the top
    PicotJoinModeBar.tsx   properties-bar mode dispatch (see "Properties-bar mode
                          dispatch" note below) — extracted session (JSX panel
                          extraction, batch 1). Each only needs a handful of props;
                          no shared-state concerns since only one branch is ever
                          mounted at a time.
    OrderNumberInput.tsx   The "order number" input used in the per-element
                          properties bar. TWO call sites (the 'line'-type branch
                          and the generic element branch) — genuinely NOT
                          identical: the 'line' site shares its flex wrapper div
                          with an adjacent "round group picker" dropdown as
                          siblings, while the generic site's wrapper is fully
                          self-contained. Found this the hard way — an early
                          version of this component rendered its own wrapper
                          div internally, which was correct for the
                          self-contained site but broke the shared-wrapper site
                          (silently ate a `</div>`, caught by the parse check,
                          not by inspection). Fixed by having the component
                          return a fragment (label + input only) and requiring
                          each call site to supply its own wrapper div
                          explicitly — don't revert to an internal wrapper div
                          without re-checking both call sites' surrounding JSX.
                          Props: value, onChange, onCommit(inputEl?) — called
                          on Enter WITH the input element (so it can be blurred)
                          and on blur with no argument, matching the original's
                          two different call shapes — onCancel, onFocus, label.
    RwToggleButton.tsx     The "RW" (right/wrong-side) toggle in the per-element
                          properties bar. Only ONE of the two "RW" buttons in the
                          file uses this shape — the other (in the per-element
                          multi-select-in-a-list context, uses `selectedEl` not
                          `selectedElement`) has a `border` class and its own
                          manual setElements+pushHistoryState instead of the
                          updateElement/needsHistoryPushRef pattern — genuinely
                          different, deliberately NOT folded in here (same
                          bordered-variant note as PresetChip.tsx above).
    NotationRotationControls.tsx  The rotate/flip controls + notation label
                          offset slider + hide-label toggle + polar rotation
                          center dropdown, from the per-element properties bar
                          (session — JSX panel extraction, batch 2). Originally
                          mis-catalogued during charting as "materials/color" —
                          it's actually the rotation/label display controls.
                          Only ONE call site.
    RoundGroupPicker.tsx   The "assign to round/group" dropdown in the
                          per-element properties bar (session — JSX panel
                          extraction, batch 2). TWO call sites, both
                          structurally self-contained (unlike OrderNumberInput's
                          two sites), but their onSelectUngrouped/onSelectGroup/
                          onCreateNew handlers are genuinely different: the
                          'line'-type branch's site still uses the older
                          elementsRef.current.map + manual pushHistoryState(...)
                          pattern; the generic element branch's site uses
                          updateElement + a separate pushOrderHistory() call.
                          Deliberately NOT unified — each call site passes its
                          own existing handler as a prop. If unifying these two
                          patterns is ever wanted, that's a real behavior
                          decision (which history-push shape is correct) and
                          should be made explicitly, not as a side effect of
                          sharing a component.
    BeadingModeBar.tsx     One of six mutually-exclusive branches of the top
                          properties-bar mode dispatch (session — JSX panel
                          extraction, batch 3). Unlike the other mode bars,
                          this one's local derivations (STRUCTURES array,
                          updateBEPicot, the BeadSlot sub-component) moved
                          wholesale into the component — none of it was
                          referenced outside this branch, verified before
                          moving it. Note: updateBEPicot doesn't call
                          pushHistoryState or set needsHistoryPushRef —
                          matches the original exactly, relies entirely on
                          the auto-push effect (see useHistoryActions.ts
                          above) picking up the setElements call.
    DropdownMenu.tsx      Shared shell for the top-bar dropdown menus (File, View,
                          Arrange, Options, Help). Owns the click-away overlay and
                          the getBoundingClientRect()-based positioning, including
                          the flip-to-left-edge behavior when there isn't room to
                          the right of the trigger button. Callers keep their own
                          show/hide state and button ref; only children (the menu
                          items) are passed in. Extracted from 5 duplicated inline
                          blocks in tattingindex.tsx (session — dropdown shell
                          extraction). Props: buttonRef, onClose, width (default
                          200, also used for the left-flip threshold), children.
    ToolbarButton.tsx     Shared icon-button shell for the left tool rail (pan,
                          select, path edit, ruler, picot-join, beading,
                          add-ring/split-ring/line/chain, delete, group,
                          ungroup, zoom in/out/fit/rect, image, notes).
                          Extracted from 21 duplicated inline <button> blocks
                          in tattingindex.tsx (session — toolbar button
                          extraction). Props: onClick, active, activeColor
                          (default 'bg-blue-600' — pass 'bg-orange-600' /
                          'bg-purple-600' / 'bg-yellow-600' / 'bg-amber-600'
                          for the ortho-lock/beading/zoom-rect/notes buttons),
                          disabled, title, colSpan2, flexCenter, className,
                          children. Does NOT cover the small pill-style preset
                          buttons (polar/linear/spiral array counts, gradient
                          category tabs) — see PresetChip.tsx below, a
                          visually similar but separate pattern (no title, no
                          touch handling).
    PresetChip.tsx        Shared selectable "chip" button for quick-pick
                          presets: polar/linear/spiral array count and angle
                          presets, linear spacing/rotation shortcuts, spiral
                          type toggle, gradient category tabs. Extracted from
                          13 duplicated inline <button> blocks in
                          tattingindex.tsx (session — preset chip
                          extraction). Props: onClick, selected, selectedColor
                          (default 'bg-blue-600 text-white'), unselectedColor
                          (default 'bg-gray-700 hover:bg-gray-600
                          text-gray-300'), className (padding/sizing/font —
                          default 'px-2 py-1', override for e.g. 'px-3 py-1
                          font-semibold' or 'flex-1 py-1.5 font-semibold'),
                          children. Buttons with no real "selected" state
                          (e.g. the linear-array Reset button) just omit
                          `selected`, which defaults to false. Does NOT cover
                          the bordered variants used by the bead size/shape
                          pickers or the `rw` (right/wrong-side) toggle
                          (lines ~7207, 8042, 12934, 12970) — those add a
                          `border` class and different color pairs
                          (amber/purple) and weren't folded in to keep this
                          extraction's diff reviewable; candidate for a
                          second pass if useful.
    Modal.tsx              Generalized dialog shell — backdrop, centering,
                          peek-to-fade, click-outside-to-close. Promoted from
                          a one-off (`ArrayDialogShell`, still defined in
                          tattingindex.tsx as a thin wrapper around Modal so
                          its 3 existing call sites — Polar/Linear/Spiral
                          array dialogs — didn't need to change). Also used
                          directly by: Recent Projects dialog, About panel,
                          Materials Manager, Bead Library, Polar Grid Panel,
                          Thread Properties, Confirm Dialog, Alert Dialog
                          (session — modal shell extraction). Props: show,
                          peek (default false), onClose, backdropZIndex,
                          wrapperZIndex — both REQUIRED, passed as explicit
                          literals rather than derived (e.g. base/base+1)
                          because real call sites don't agree on a
                          convention: most pairs are one apart, but Confirm
                          and Alert both use the identical literal
                          2147483647 for backdrop AND wrapper. Also:
                          backdropClassName (default 'bg-black
                          bg-opacity-60'), contentClassName (default 'flex
                          flex-col gap-4 p-5'), contentStyle, children.
                          Two other modal-shaped spots deliberately do NOT
                          use this: the Ghost Array Manager (no backdrop, no
                          click-outside-close — clicking outside currently
                          does nothing) and the small Update toast (no
                          backdrop at all, non-blocking). Both differ in
                          actual interaction behavior, not just styling, so
                          folding them in would silently change what they
                          do — left alone on purpose, not an oversight.
                          Recent Projects and About previously centered via
                          `top/left/transform` on the content div directly
                          (no middle flex-center wrapper, 2-layer instead of
                          3); converting them to Modal changes the technique
                          but not the visual result (still centered) — a
                          deliberate behavior-neutral simplification, not
                          an accidental one.

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
    useHistoryActions.ts  pushHistoryState(els, conns, groups?) — snapshot includes elements,
                          picotConnections, orderGroups, polarGrids. Carries forward previous
                          polarGrids when grids argument is omitted (safe default for the ~25
                          action call sites that don't touch grids). De-dupes by comparing
                          JSON.stringify(new) against the last history entry — calling this
                          twice in a row with an unchanged result is a harmless no-op, not a
                          duplicate undo step. This is load-bearing: see the auto-push
                          mechanism below, which relies on redundant calls being free.

                          THE REAL HISTORY MECHANISM (verified session — history push
                          investigation; this replaces an earlier, incorrect note that called
                          this "candidate for structural diff redesign" — the design is sound,
                          it just wasn't documented anywhere before now):

                          A single generic effect in tattingindex.tsx is the primary path —
                          NOT the ~28+ explicit pushHistoryState call sites scattered across
                          tattingindex.tsx/useEditorActions.ts/useJoinActions.ts/
                          useInputHandlers.ts:

                            useEffect(() => {
                              if (isUndoRedoRef.current) return;
                              if (skipAutoHistoryRef.current) { skipAutoHistoryRef.current = false; return; }
                              if (isInteractingRef.current) { needsHistoryPushRef.current = true; return; }
                              if (nudgeActiveRef.current) return;
                              pushHistoryState(elements, picotConnections, orderGroupsRef.current, polarGrids);
                            }, [elements, picotConnections, polarGrids]);

                          Every setElements/setPicotConnections call already triggers a history
                          push through this effect. Four guard refs handle the real edge cases:
                          - isUndoRedoRef: true during undo/redo replay, so restoring a past
                            state doesn't itself get pushed as a new entry.
                          - skipAutoHistoryRef: set to true immediately before an explicit
                            pushHistoryState call that needs to bundle multiple pieces of state
                            (elements + connections + groups) into ONE atomic entry — otherwise
                            the effect would push again right after, redundantly (harmless
                            per the de-dupe above, but wasteful: a full JSON.stringify +
                            JSON.parse deep-clone + string compare for nothing). Also used to
                            suppress history for a *secondary* setElements call that shouldn't
                            get its own undo step (e.g. useInputHandlers.ts's ghost-array
                            regeneration after a rotation — see the comment at that call site).
                          - isInteractingRef / needsHistoryPushRef: during a drag/rotate/resize,
                            you don't want a history entry per animation frame. isInteractingRef
                            suppresses the per-frame auto-push and sets needsHistoryPushRef
                            instead; useInputHandlers.ts's mouse-up/touch-end handler checks
                            that flag and pushes exactly once, using the final state.
                          - nudgeActiveRef: same idea for held-key nudging (push once on
                            keyup, not per repeat).

                          CONVENTION: any new explicit pushHistoryState call must set
                          skipAutoHistoryRef.current = true on the line immediately before it.
                          useEditorActions.ts's 3 explicit-push sites do this correctly.
                          useJoinActions.ts's 2 sites (joinSelectedPicots, breakSelectedPicots)
                          did NOT — fixed in the same session that found it. Verify this
                          convention is still followed before adding new explicit push sites;
                          don't assume the auto-effect will silently cover a missed one — it
                          usually will (via the de-dupe), but the whole point of the convention
                          is to not depend on that as the safety net.

                          NOT a real risk despite how it looked from the audit doc: the ~28+
                          call sites are not "easy to forget to pair with setElements" — the
                          auto-effect already covers every setElements call unconditionally.
                          The actual — much narrower — risk is only: an explicit push site
                          that (a) legitimately needs to bundle multiple state pieces into one
                          entry, and (b) forgets the skipAutoHistoryRef line. That produces a
                          wasted redundant push, not a lost undo step, because of the de-dupe.
                          Don't "fix" this with a mechanical retrofit of all call sites —
                          most of them are already correct; check skipAutoHistoryRef usage at
                          each site individually before touching it.
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
- History undo/redo — the push mechanism itself lives across `useHistoryActions`,
  `useEditorActions`, `useJoinActions`, and `useInputHandlers` now (see the full writeup
  under `useHistoryActions.ts` in the module structure above — verified, not guessed at).
  Full JSON stringify + deep-clone per history entry is still real cost, but it is NOT
  "candidate for structural diff redesign" in the sense of being broken or fragile — it's
  a deliberate, working design with a documented convention. A structural-diff rewrite
  would only be worth it for raw performance (fewer bytes cloned per entry on very large
  patterns), not for correctness.
- All rendering (SVG, realistic baking) — needs a data interface design before extracting
- Picot Wizard popover JSX — single-element (Reverse/Clear/Add/Fill/Compact/Scale) and
  multi-element (Scale only) popovers. Add/Fill/Compact are now `AddPicotsSection`/
  `FillPicotsSection`/`CompactPicotsSection`, Scale is `ScaleControls` — see
  components/ above. What's left inline in tattingindex.tsx is the actual analysis
  logic (split-ring side-splitting, `applyToSides`, the various `can*`/`*Preview`
  derived values) and the popover shell itself (overlay, positioning, title, the
  plain Reverse/Clear buttons) — that's the genuinely component-specific part and
  isn't a good candidate for further extraction without also carrying the notation
  analysis with it, which would just move the complexity rather than reduce it.

---

## Properties-bar mode dispatch (charted session — JSX panel extraction)

The main return (~7,700 lines) is NOT a flat blob — it has clean natural boundaries
at every level once you actually look, verified via AST rather than guessed at:

```
Main return
├─ <style> block (360 lines) — static CSS
├─ Big wrapper div
│  ├─ "Chrome" div (2,485 lines) — only 22 identifiers shared with Canvas+Toolbar
│  │  ├─ Top Menu Bar (170 lines) — File/View/Arrange/Options/Help + Undo/Redo
│  │  └─ Mode-dispatch ternary (2,309 lines) — mutually exclusive, one mounted at a time:
│  │     ├─ Realistic mode bar ................ 15 lines → RealisticModeBar.tsx ✅
│  │     ├─ Picot Join mode bar ................ 37 lines → PicotJoinModeBar.tsx ✅
│  │     ├─ Beading mode bar .................. 171 lines → BeadingModeBar.tsx ✅
│  │     ├─ Tatting Order mode bar ............ 370 lines
│  │     ├─ Element properties bar (1,051 lines) — splits on selectedElement.type:
│  │     │  ├─ 'line' type branch ............ 248 lines (has its own OrderNumberInput ✅)
│  │     │  └─ everything-else branch (720 lines) → sibling sections:
│  │     │     ├─ Notation input + Picot Wizard . 348 lines (Wizard already extracted)
│  │     │     ├─ Rotate/label controls .......... 60 lines → NotationRotationControls.tsx ✅
│  │     │     │  (mis-catalogued during charting as "materials/color" — corrected)
│  │     │     ├─ small section (Order Number) ... 15 lines → OrderNumberInput.tsx ✅
│  │     │     ├─ Round Group Picker ............. 75 lines → RoundGroupPicker.tsx ✅
│  │     │     │  (mis-catalogued as "rw/hide-label/bead" — it's actually the
│  │     │     │   group-assignment dropdown; RW toggle turned out to be its
│  │     │     │   own separate sibling, not nested inside this one)
│  │     │     ├─ tiny section (RW toggle) ....... 11 lines → RwToggleButton.tsx ✅
│  │     │     └─ Shape toggle + materials (still pending, not "group/order
│  │     │        management" as originally guessed — corrected) .. 190 lines
│  │     └─ Nothing-selected bar (651 lines)
│  │        ├─ Multi-select summary/actions .... 517 lines (further splits on group-vs-not)
│  │        └─ two smaller trailing bits ........ 4 + 123 lines
│  └─ Canvas+Toolbar div (1,905 lines) — 112 identifiers used nowhere else
├─ Color Picker dialog (602 lines) — never touched, still hand-rolled centering
└─ Long tail (~2,600 lines) — the dialogs refactored earlier this session (Modal-based)
```

Every boundary above is either a mutually-exclusive branch (mode/type dispatch,
truthy-check) or a low-overlap sibling — none of it needs Context or a reducer to
split safely; that's only a real question for the ~14 remaining ref-mirrors
(separate item, see "Ref mirror → useReducer" below) and is NOT a blocker for this
list. Two real duplication traps found while executing this list, both fixed:
- `OrderNumberInput`'s two call sites look identical at a glance but aren't — one
  has a self-contained wrapper div, the other shares its wrapper with an adjacent
  "round group picker" dropdown. See the `OrderNumberInput.tsx` entry above.
- The "RW" toggle has a second, bordered, `selectedEl`-based sibling elsewhere
  that is NOT the same component and wasn't folded in — see `RwToggleButton.tsx`.

Batch 2 done: rotate/label controls, Order Number's second call site fix, both
Round Group Picker sites, RW toggle's tiny neighbor. Two labels from the
original chart turned out wrong once actually opened — "materials/color" was
really rotate/label controls, and "rw/hide-label/bead" was really the group
picker (RW turned out to be its own separate sibling). Corrected above; take
the remaining un-opened labels below as provisional guesses, not confirmed
until actually drilled into, same as these were.

Batch 3 done: Beading mode bar. Caught one real bug executing it — an
incomplete str_replace dropped the ternary chain's continuation into the next
branch (`tattingOrder`), leaving its IIFE wrapper `(() => {` missing; caught by
the parse check immediately, fixed by restoring the dropped continuation.
Same lesson as before: verify immediately after every edit, don't batch
several before checking.

Suggested remaining order, cheapest first: Shape toggle + materials, 190
lines, not yet drilled → Top Menu Bar (170) → Notation+Picot Wizard (348) →
Tatting Order (370), Multi-select summary (517), Color Picker (602, worth a
shallow drill first) → 'line' type branch (now much smaller after batch 2's
shared extractions) and the two coordinating wrapper branches last, once
their children are already components.

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
| History system — perf only | Replace full JSON stringify/deep-clone per entry with structural diff, for large-pattern performance. NOT a correctness fix — the push mechanism itself is sound and documented under `useHistoryActions.ts` above. |
| `regenerateGhostArrays` → dedicated hook/module | Needs clean data interface for `createPolarInstance`/`createLinearInstance` |
| Ref mirror → `useReducer` | The big architectural unlock; makes memoization meaningful and eliminates the remaining ~14 mirror refs |
| JSX panel extraction | See "Properties-bar mode dispatch" and the charted return-statement structure below — this is NOT one flat 8,000-line blob, it already has clean natural boundaries. In progress: batch 1 of the mode-dispatch branches done (session — JSX panel extraction, batch 1). |
| OBB bounding box | Oriented bounding box for single-element selection (rotate box with object); AABB stays for multi-select |
| `isTooShort` flag on move/transform | Currently only set when notation changes (via `computeElementAfterNotationEdit`); needs a second write-site in move/transform handlers for when endpoints shift without notation changing |
| Endpoint joints across ghost arrays | `checkAndStoreInheritedJoin` only handles regular picots; `__start__`/`__end__`/`__anchor__` pseudo-picots not yet inherited |
