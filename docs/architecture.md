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
    color.ts               COLORS (base palette), BG_COLORS, hexToHsv,
                          hsvToHex, parseGradientStops — promoted out of
                          tattingindex.tsx (session — Color Picker
                          extraction, batch 9). hexToHsv/hsvToHex were dead
                          code in tattingindex.tsx after the Color Picker's
                          Picker tab moved to ColorPickerPickerTab.tsx (their
                          only remaining callers), so they were deleted from
                          tattingindex.tsx rather than left as unused local
                          definitions alongside the new import. COLORS and
                          BG_COLORS are still used directly in
                          tattingindex.tsx (allColors, editingColorIndex,
                          theme background cycling) so those stayed as
                          imports, not deletions. `categorizeColor` was NOT
                          moved here despite being equally pure — it's
                          passed into ColorPickerSwatchesTab.tsx as a prop
                          instead, since moving it wasn't necessary for that
                          extraction; candidate for promotion here later if
                          another caller needs it.

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
    ShapeAndSqueezeControls.tsx  Shape toggle (Teardrop/Circle/Josephine Knot)
                          + squeeze sliders (split-ring 3-slider variant or
                          regular-ring single-slider variant), from the
                          per-element properties bar (session — JSX panel
                          extraction, batch 4). Only rendered when
                          selectedElement.isClosed — moved that check INSIDE
                          the component (returns null otherwise) rather than
                          wrapping the call site in a condition, so the call
                          site reads the same as every other unconditional
                          section here. Touches notation/paths/rotation
                          directly (shape toggle rewrites notation and
                          regenerates paths; squeeze sliders regenerate paths
                          on every change) — moved verbatim, deliberately NOT
                          routed through updateElement/updateSelected; see
                          elementUpdates.ts's own note on why these stay as
                          plain prev.map(). While executing this one, a
                          post-edit view looked like it had left two orphaned
                          closing tags (`</>` + `)}`) right after the new
                          component call — turned out to be a false alarm:
                          AST confirmed those closed the OUTER "everything
                          else" element-type-branch fragment (unrelated to
                          this extraction), not anything left over from this
                          edit. Removing them broke the parse immediately, so
                          the removal was reverted, not shipped. Included here
                          as a reminder that "looks orphaned" is not the same
                          as "is orphaned" — always check what a tag actually
                          closes via the AST before deleting it, not by eye.
    TopMenuBar.tsx         Row 1 of the two-row header: File/View dropdown
                          triggers, Undo/Redo, Copy/Cut/Paste,
                          Send-to-back/Bring-to-front, Fit All, and the
                          Arrange/Options/Help dropdown triggers (session —
                          JSX panel extraction, batch 5). ~30 props — the one
                          section in "Chrome" where a large flat prop list is
                          the accepted trade-off, not a red flag: this is
                          genuinely the app's central control row and touches
                          a wide slice of state by nature (see the
                          Properties-vs-Canvas overlap analysis below for why
                          that's fine without Context/reducer first). Does
                          NOT own any dropdown menu content — those are
                          separate DropdownMenu.tsx instances rendered
                          elsewhere; this only owns the trigger buttons and
                          the direct-action buttons.
    SplitRingNotationInput.tsx  The split-ring "A:"/"B:" notation text field
                          (session — JSX panel extraction, batch 6). This is
                          the ORIGINAL audit's item #8 ("Notation Input with
                          Escape/Blur Handling") — genuinely duplicated (side
                          A and B are identical shells, differing only in
                          which field they edit), not just similar-looking.
                          The escape-guard check (pendingNotationRef reset +
                          notationEscapeRef bail) is centralized here since
                          it's identical both sides; validation, the
                          updateNotation call shape, and the revert-on-escape
                          value are genuinely different per side and stay
                          with the caller as callbacks. Does NOT cover the
                          single/regular-ring notation input a few lines
                          away — that one has extra behavior (draftNotation
                          tracking, notationError state,
                          normalizeNotationInput) this doesn't, so it wasn't
                          forced into this shape; see NotationInput.tsx
                          below, extracted in a later session. Candidate for
                          its own extraction later if wanted, along with the
                          4th site the original audit mentioned
                          (multi-select notation) — not yet
                          located/verified this session.
    NotationInput.tsx     The regular/non-split-ring notation text field —
                          the item flagged repeatedly across batches 6 and 8
                          and left open at the end of that session (later
                          session — batch 11, single-notation-input
                          extraction). Same prop-passing shape as
                          SplitRingNotationInput.tsx: this component owns
                          only the DOM/event wiring (change/blur/keydown);
                          draftNotation, notationError, and all
                          parse/normalize/updateNotation/alert logic stay in
                          tattingindex.tsx via callback props
                          (onChangeRaw/onCommit/getRevertValue/onEscape),
                          since draftNotation is also read elsewhere
                          (canvas rendering) and is genuinely parent state,
                          not local to the input. One behavioral subtlety
                          preserved deliberately: the original Escape
                          handler only overwrote the DOM value if
                          `elementById.get(selectedElement.id)` resolved,
                          otherwise it left the field untouched — so
                          `getRevertValue` returns `string | null`, and the
                          component only writes `target.value` when it's
                          non-null. An early draft of this prop always
                          returned a string, which would have silently
                          changed that behavior; caught while designing the
                          prop, before writing the replacement, not after.
    TattingOrderModeBar.tsx  One of six mutually-exclusive branches of the top
                          properties-bar mode dispatch (session — JSX panel
                          extraction, batch 7). Like BeadingModeBar, genuinely
                          self-contained enough to move its local derivations
                          (numbered/total counts, activeGroup/activeBadgeFill,
                          numberedInScope/totalInScope) wholesale — none of it
                          is referenced outside this branch. Contains the
                          bordered "RW" toggle variant documented in
                          RwToggleButton.tsx (uses `selectedEl`, has a border,
                          own manual setElements+pushHistoryState) — this is
                          that site, confirmed directly this time rather than
                          inferred; left exactly as-is per the reasoning
                          already on record there.
    MultiSelectSummaryBar.tsx  The "nothing selected but selectedIds.length >
                          0" branch of the properties bar — either a group
                          selection (multiple elements sharing a groupId) or
                          a free multi-selection (session — JSX panel
                          extraction, batch 8). Largest single-file move this
                          session at 517 lines; moved verbatim including the
                          early `if`/`return` structure (group branch, free
                          multi-select branch, `return null` fallback) rather
                          than being reshaped into cleaner control flow —
                          reshaping control flow while relocating code is how
                          you introduce a bug you can't blame on either
                          change in isolation. Contains the audit's item #8
                          4th site (multi-select notation input) — located
                          but deliberately NOT folded into
                          SplitRingNotationInput.tsx: this variant never
                          touches pendingNotationRef (unlike the split-ring
                          A/B inputs), so reusing that component's onBlur
                          (which unconditionally nulls pendingNotationRef)
                          would be a small but real behavior change. Also
                          contains the dual-field materialId/materialIdB
                          assignment (split rings set both fields) documented
                          as deliberately not folded into PresetChip.tsx —
                          same site, now visible directly rather than
                          inferred. Depends on `rotatePaths` from
                          geometry/paths.ts in its group-rotate handlers —
                          noted in the file's own header comment since it's
                          easy to miss when only skimming the props list.
    GradientSwatch.tsx     The gradient-stops SVG (parse stops -> linearGradient
                          -> rect) — appeared 4 times identically (swatch grid
                          item + preview, in both the Swatches and Gradients
                          tabs of the Color Picker dialog) before this
                          extraction (session — Color Picker extraction,
                          batch 9). Props: gradientId (must be unique per
                          rendered instance — used as the SVG defs id), stops.
    ColorPickerPickerTab.tsx     The Color Picker dialog's three tabs
    ColorPickerSwatchesTab.tsx   (session — Color Picker extraction, batch 9).
    ColorPickerGradientsTab.tsx  Swatches and Gradients tabs use
                          GradientSwatch.tsx for their gradient rendering;
                          Gradients tab also uses PresetChip.tsx for its
                          thread-line filter chips — confirms this dialog was
                          built/touched after that component existed, unlike
                          the Picker tab which has none of the session's
                          shared components. The dialog's own shell (backdrop,
                          header/footer, tab-switch buttons) was converted to
                          Modal.tsx in the same batch — see the note under
                          Modal.tsx below for what changed and why.

    ⚠ CAUTION — near-miss during this extraction: an early attempt at the
      shell+header+footer replacement was written from memory/pattern-
      completion instead of the actual viewed source (the footer's OK/Cancel
      button logic — editingColorIndex, pickerCallback, pickerGradientCallback
      — was typed out before ever viewing those exact lines). It happened to
      parse successfully and was CLOSE to correct, which is precisely why this
      matters: a parse check alone would not have caught a wrong detail here,
      because syntactically-valid fabricated JSX is indistinguishable from
      real JSX to a parser. Caught only by stopping to double check the
      actual content had been viewed, not inferred — the block was reverted
      to the genuine original text and redone by copying the real,
      now-directly-viewed source. The lesson: for any multi-hundred-line
      block being restructured (not just relocated verbatim), view the exact
      original text immediately before writing the replacement, every time —
      don't reuse a partial view from earlier in the same session, and don't
      let "this looks like it's probably right" substitute for having the
      actual text in front of you.
    ArrayInput.tsx         Numeric input with draft-value editing (typing
                          doesn't commit until blur/Enter, Escape reverts,
                          arrow keys step by `step`). Promoted out of
                          tattingindex.tsx (session — final JSX panel
                          extraction, batch 10) — used 18+ times there for
                          counts/spacing/angles, and needed directly by
                          LineBeadPicker.tsx, which is why it got its own
                          file rather than staying local.
    LineBeadPicker.tsx     The bead-slot picker for line elements — count
                          spinner, collapsed/expanded per-slot dropdowns,
                          copy/cut/paste (session — final JSX panel
                          extraction, batch 10). Last major piece of the
                          'line'-type branch; genuinely self-contained, moved
                          wholesale like BeadingModeBar/TattingOrderModeBar.
                          With this, the 'line'-type branch is down to ~65
                          lines from its original 248 — just the notation
                          display, rotate/flip controls, and the calls to
                          OrderNumberInput/RoundGroupPicker/LineBeadPicker.
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
                          A NINTH call site — Color Picker (session — Color
                          Picker extraction, batch 9) — is different from the
                          rest of this list: unlike every other conversion
                          above, this one is NOT behavior-neutral. The
                          original Color Picker (the oldest dialog in the
                          file, predating PresetChip/Modal) had no
                          click-outside-to-close at all; converting it to
                          Modal adds that interaction, plus Modal's
                          rounded-xl/border/shadow-2xl treatment in place of
                          the original's plain rounded-lg with no border. Both
                          changes were an explicit request ("make it more
                          similar to the other ones"), not a side effect —
                          flagged here in case that's ever unclear from a
                          diff alone.

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
    useHistoryActions.ts  pushHistoryState(els, conns, groups?, grids?) — reviewed directly
                          (later session), then extended in the same session to add a real
                          4th parameter. Snapshot is now {elements, connections, orderGroups,
                          polarGrids} — polarGrids carries forward the previous entry's value
                          when omitted, matching the ~23 explicit call sites that never touch
                          grids and only pass 3 args; only the primary auto-push effect below
                          passes a real 4th argument. De-dupes by comparing JSON.stringify(new)
                          against the last history entry — calling this twice in a row with an
                          unchanged result is a harmless no-op, not a duplicate undo step. This
                          is load-bearing: see the auto-push mechanism below, which relies on
                          redundant calls being free.

                          FIXED (later session, same session it was found in). Root cause was
                          worse than an earlier version of this note first characterized it:
                          the auto-push effect always called `pushHistoryState(elements,
                          picotConnections, orderGroupsRef.current, polarGrids)` with a real 4th
                          argument, but since the function only destructured 3 params, it was
                          silently dropped by normal JS call semantics — not just "forgotten,"
                          but invisible to the de-dupe comparison too. Concretely: a pure
                          grids-only change (no element/connection/orderGroups change) compared
                          equal to the previous entry under the old 3-field comparison, so
                          `pushHistoryState` returned early and never created a new history
                          entry at all — a grids-only edit had NO undo step, not merely an
                          incomplete one. (Corrects an earlier, too-generous version of this
                          note that said a grids change "does trigger a new history step" —
                          that was true only when grids changed alongside something else that
                          WAS compared, e.g. elements; even then the step didn't remember the
                          new grids value.) Fix: `pushHistoryState` now accepts and compares a
                          real `grids` parameter; `undo`/`redo` in `useEditorActions.ts` now
                          restore it via `p.setPolarGrids(...)`, guarded by `if
                          (state.polarGrids)` — same conditional pattern already used for
                          `orderGroups`, since the initial `historyRef` seed and both
                          `setHistory([{...}])` resets predate this field and don't have it.
                          `setPolarGrids` was already being passed into `useEditorActions(...)`
                          at its call site in tattingindex.tsx (just unused) — no changes needed
                          to tattingindex.tsx itself; the auto-push effect below was already
                          calling correctly, just waiting on the callee to catch up.

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
                              pushHistoryState(elements, picotConnections, orderGroupsRef.current, polarGrids); // 4th arg now used — see FIXED note above
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
                          ordering, grouping, alignment, rotation, undo/redo (reviewed
                          directly, later session — see "Endpoint joints across ghost
                          arrays" addendum under Rules for the undo/redo × inheritedJoins
                          fix found and made here). undo/redo restore elements/
                          connections/orderGroups from a history snapshot — NOT
                          ghostArrays, which was never part of the snapshot to begin
                          with (see useHistoryActions.ts below).
                          Returns helpers (getElementBounds, getSelectionBoundingBox,
                          moveElement, getElementPivot, getPolarPivot) still needed by
                          tattingindex for rotation and other callbacks.
    useInputHandlers.ts   handleMouseDown/Move/Up. Zero state-mirror ref reads.
    useJoinActions.ts     joinSelectedPicots, breakSelectedPicots, reapplyInheritedJoins,
                          checkAndStoreInheritedJoin, removeInheritedJoins (reviewed directly,
                          later session — see "Endpoint joints across ghost arrays — implemented"
                          under Rules for the pseudo-picot gap fixed here, and its
                          "reapply-on-regeneration" follow-up for reapplyInheritedJoins).
                          checkAndStoreInheritedJoin/removeInheritedJoins are internal — not
                          destructured at the tattingindex.tsx call site, only called from inside
                          joinSelectedPicots/breakSelectedPicots respectively. reapplyInheritedJoins
                          IS destructured/exported — called from applyGhostRegenResult in
                          tattingindex.tsx after every array regeneration. Inherited joins are
                          stored on the ghost array as {sourcePicotIndex, targetPicotIndex} —
                          array indices into el.picots — and replayed across ghosts by indexing
                          ghost.picots[idx]; this is why pseudo-picots (not stored in el.picots)
                          don't fit the model without a parallel ID-based field.
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

### Endpoint joints across ghost arrays — implemented (later session)

**Status:** DONE. `useJoinActions.ts` reviewed directly, root cause confirmed, fix implemented and
verified (parse check + full diff review against the uploaded original — see below). The earlier
"likely cause" guess (a single patchable lookup) was wrong — the real gap was two blockers, one
structural. Both fixed.

**Confirmed root cause — two blockers, not one:**

1. **`checkAndStoreInheritedJoin` was never even called for the endpoint case.** In
   `joinSelectedPicots`:
   ```ts
   if (!sel.some(sp => isEndpointPicotId(sp.picotId))) checkAndStoreInheritedJoin(sel, newEls);
   ```
   A deliberate early bail-out, not a bug inside the inheritance function itself — if either selected
   picot was `__start__`/`__end__`/`__anchor__`, the whole inheritance mechanism was skipped.

2. **Even without that guard, the lookup inside it would still have failed.**
   `checkAndStoreInheritedJoin` resolved picots via `ghostEl.picots?.findIndex(p => p.id ===
   selPicots[...].picotId)`. Pseudo-picot IDs are never stored in `el.picots` (confirmed
   independently from `tattingindex.tsx`'s `getEndpointPseudoPicots` — they're synthesized on demand
   from path endpoints, not persisted per element), so this lookup returned `-1` regardless of
   blocker #1.

**Why it wasn't a narrow fix — the storage model itself didn't fit pseudo-picots.** Inherited joins
are stored on the ghost array as `{ sourcePicotIndex, targetPicotIndex }` — numeric *array indices*
into `el.picots` — and replayed across every ghost via `ghost.picots[idx]`. A pseudo-picot has no
natural index: a ring has exactly one (`__anchor__`), a chain/split-ring has exactly two
(`__start__`/`__end__`), and the same fixed IDs recur identically on every ghost instance of that
source element — there's no "which one of several" ambiguity to resolve via index, unlike real
picots along a notation.

**Implementation (deviates from the original plan in one deliberate way):** the plan called for
adding separate `sourcePicotId`/`targetPicotId` fields alongside the existing numeric ones. Instead,
`sourcePicotIndex`/`targetPicotIndex` were **widened to accept `number | string`** rather than
renamed/duplicated — chosen specifically because this hook file wasn't visible from
`tattingindex.tsx` this session, so there was no way to confirm whether any other file reads that
exact field name; widening is lower-risk than introducing new field names that might not be picked
up elsewhere. Two new local helpers in `useJoinActions.ts` do the work:
- `resolvePicotSlot(el, picotId)` — returns a numeric array index for real picots (unchanged
  behavior), or the pseudo-picot ID string itself for endpoints (no lookup needed — the ID is
  already the portable, instance-independent slot identifier), or `null` if a real picot ID isn't
  found.
- `getPicotAtSlot(ghostInstance, slot)` — the inverse: numeric slots look up that ghost's own
  `.picots` array (unchanged real-picot behavior); string slots resolve directly to `{id: slot}`
  with no lookup.

All resolution/dedupe/propagation code in `checkAndStoreInheritedJoin` now routes through these two
helpers instead of raw `.findIndex`/`.picots[idx]`. `removeInheritedJoins` and `breakSelectedPicots`
needed no changes — confirmed during the investigation that `removeInheritedJoins` was already called
unconditionally (no pseudo-picot guard) and doesn't rely on the index-based shape at all, since it
just clears `inheritedJoins` wholesale for any array with an affected boundary ghost.

One naming note: the original code's inner `findIndex` callback used `p` as its own parameter name,
shadowing the outer hook's `p: UseJoinActionsParams` within that arrow function. Moving that lookup
into `resolvePicotSlot` (with its own `el`/`picotId`/`pic` names) incidentally removed that shadow —
a small side-benefit, not something that needed touching on its own.

**Follow-up, same session — reapply-on-regeneration:** while investigating, it became clear that
nothing in either `tattingindex.tsx` or `useJoinActions.ts` actually *read* `ghostArray.inheritedJoins`
to reapply joins onto newly-created ghosts after `regenerateGhostArrays` runs (e.g. when an array
grows from 5 to 8 instances) — `inheritedJoins`'s only consumer was the `alreadyExists` dedupe check
inside `checkAndStoreInheritedJoin` itself. Initially deferred as out of scope. User pushback was
correct to push on this — "there will always be 2+ copies, though at 2 it might be a problem" — and
checking precisely (rather than reasoning abstractly) turned up a real, separate gap worth fixing
alongside it:

- **Verified the floor:** both `polarArrayCount` (guarded `< 2` at the preview site) and
  `linearArrayCount` (`min={2}` on its `ArrayInput`) enforce a minimum of 2 "copies." But `copies`
  counts the source *plus* ghosts — `createPolarInstance`/`createLinearInstance` loop
  `for (i = 1; i < count; i++)`, so ghosts = count − 1. At the minimum, that's exactly **1 ghost**.
- **The actual problem at 2:** `checkAndStoreInheritedJoin`'s `if (sortedGhosts.length < 2) return;`
  guard is correct on its own terms (with 1 ghost there's nothing else to propagate a join to), but it
  sat *before* the `inheritedJoins` bookkeeping write — so a join made while an array had only 1 ghost
  was never recorded at all, not even for future replay once the array grew. Fixed by moving the
  bookkeeping write in `checkAndStoreInheritedJoin` to happen unconditionally, before the
  connection-building step, rather than after it.

**Implementation:**
- Extracted the two propagation loops (previously duplicated inline in `checkAndStoreInheritedJoin`)
  into a shared `buildConnectionsForInheritedJoin(matchingArray, currentElements, isSourceElement,
  sourcePicotIndex, targetPicotIndex, existingConns, materialId)` — used by both the live-join path
  and the new replay path, so there's exactly one implementation of the connection topology instead
  of two that could drift apart. `materialId` is an explicit parameter rather than derived internally:
  the live-join caller passes the specific boundary ghost's `materialId` (preserving exact prior
  behavior, zero regression), while the new replay caller falls back to the source element's, since
  the originally-selected ghost may no longer exist after regeneration.
- Added `isSourceElement: boolean` to each stored `inheritedJoins` entry. The two connection
  topologies (boundary↔source vs. boundary↔boundary) are genuinely different loop shapes, and were
  previously re-derived fresh from the live selection each time — with no selection to re-derive from
  at regeneration time, this has to be stored explicitly instead.
- Added `reapplyInheritedJoins(currentElements, currentGhostArrays)`, exported from the hook and
  destructured at the `useJoinActions(...)` call site in `tattingindex.tsx`. Iterates every ghost
  array's `inheritedJoins` entries and calls `buildConnectionsForInheritedJoin` for each, threading an
  accumulating connection list through so cross-entry duplicates are caught too, not just
  duplicates against pre-existing connections.
- **Legacy data — skip rather than guess:** entries recorded before this fix don't have
  `isSourceElement` at all. `reapplyInheritedJoins` checks `typeof entry.isSourceElement !== 'boolean'`
  and skips those entries rather than guessing the topology from the stored index pair — a wrong
  guess would silently create an incorrect connection, which is worse than not replaying that one
  pre-existing record. Pre-existing save files won't retroactively benefit from replay on their old
  inherited joins; only joins made after this fix ships get the `isSourceElement` needed for replay.
- **Wiring:** `applyGhostRegenResult` in `tattingindex.tsx` is the single funnel point all 4
  regeneration call sites already go through (`updateGhostArraysForMother` and three inline call
  sites). Changed its `picotConnections` remap from a `setPicotConnections(prev => ...)` updater to a
  synchronously-computed value (mirrored to `picotConnectionsRef.current` immediately after, matching
  the ref-mirror discipline used throughout this file), specifically so `reapplyInheritedJoins` could
  be called right after with fresh, non-stale `result.elements`/`result.ghostArrays` — same
  compute-then-set discipline as the "Ghost array regeneration — critical rule" documented above, not
  a new pattern.

Verified: parse check on both files, JSX tag balance (751/751, unchanged from before this edit since
no JSX was touched), and full diff review against the last-shipped versions — confirmed the
`tattingindex.tsx` diff was exactly the destructuring line plus the `applyGhostRegenResult` body,
nothing else in the 11,577-line file moved.

**Post-implementation, real user testing found two more bugs — this is exactly why "verify with a
real reproduction" matters, not just code tracing.** Reported after building a minimal repro (one
ring, 3 picots, a small ghost array) and joining the mother to the left boundary ghost:

- **Bug 2 (root cause confirmed, fixed):** after undo, recreating the same join never propagated to
  other ghosts again. Root cause: `ghostArrays` (and therefore `inheritedJoins` bookkeeping) is
  **never part of a history snapshot at all** — `pushHistoryState`
  (`useHistoryActions.ts`) only ever captures `{elements, connections, orderGroups}`, and `undo`/`redo`
  (`useEditorActions.ts`, lines ~337–365) only ever restore those same three, despite `setGhostArrays`
  being available to that hook (used elsewhere in it, for mother-deletion cleanup) — it's just never
  called during undo/redo. So after undo, the connections/isJoint flags correctly revert (they're in
  the snapshot) but `ghostArrays[x].inheritedJoins` still holds the entry from the original join. On
  re-join, `checkAndStoreInheritedJoin`'s `alreadyExists` dedupe check finds the stale entry and
  returns immediately — zero propagation. Confirmed pre-existing (existed before this session's other
  work; `ghostArrays` was already excluded from history capture beforehand).
  - **Fix:** rather than threading `ghostArrays` through every `pushHistoryState` call site across
    multiple files (high risk of missing one, since call sites exist in at least `useJoinActions.ts`
    and probably more throughout `tattingindex.tsx`), added a targeted reconciliation step run right
    after `undo`/`redo` restore connections: `reconcileGhostArraysAfterHistoryRestore(restoredConns)`
    — if a ghost array has zero connections tagged `isInheritedJoin === array.id` surviving the
    restore, its `inheritedJoins` entries are stale and get cleared. Self-contained inside
    `useEditorActions.ts`, no new cross-hook coupling.
  - **Known limitation, documented rather than fixed:** this is coarse per-array, not per-record. If
    an array has multiple distinct `inheritedJoins` records and undo lands at a point where only some
    are gone, this can't distinguish between them — it keeps all records as long as at least one
    tagged connection survives anywhere. Precise per-record reconciliation would need
    `buildConnectionsForInheritedJoin` from `useJoinActions.ts`, which isn't available inside
    `useEditorActions.ts` without new cross-hook coupling. Left as a follow-up, not attempted now —
    the reported bug is the simple single-join case, which this fixes correctly.

- **Bug 1 — root cause found and fixed (later session), though NOT confirmed as the exact cause of
  the specific reported pattern.** "the inheriting just went crazy" — picots connected to the wrong
  picots — on the very first join (mother → left boundary), before any undo. Initial code-tracing
  (comparing the `isSourceElement` branch against the pre-session original) found the slot-resolution
  math unchanged — that ruled out this session's refactor as the cause, but didn't find the actual
  bug. Found by re-examining `sortedGhosts`, the ordering `buildConnectionsForInheritedJoin` uses to
  decide which ghost connects to which:

  **Confirmed, real bug (pre-existing, not introduced this session):** `sortedGhosts` was built by
  sorting ghosts on **raw** `rotation % 360`. `createPolarInstance` computes each ghost's rotation as
  `(sourceEl.rotation + angleDeg) % 360` — if the source element had any nonzero rotation before the
  array was created, that modulo can wrap SOME ghosts' rotation values past 360° while leaving others
  unwrapped, silently reordering `sortedGhosts` relative to actual creation order. Since the
  propagation loop assumes `sortedGhosts[0]` is adjacent to the mother and each consecutive pair is
  physically adjacent, a scrambled order means the wrong ghost pairs get connected — worked out by
  hand with concrete numbers (source rotation 290°, 6 copies) showing the boundary ghost the user
  actually selected can end up sorted LAST instead of first. This is a strong candidate for "seemingly
  random, hard-to-pin-down" wrong connections, though whether the user's specific ring had nonzero
  rotation wasn't confirmed (real repro — screenshot or saved project — offered for later).
  - **Fix:** `sortedGhosts` in `buildConnectionsForInheritedJoin` now uses `matchingArray.ghostIds`'
    existing order directly instead of re-deriving order from rotation. Verified `ghostIds` is always
    built in creation order — every push site across both creation paths (`executePolarArray`/
    `executeLinearArray` and `regenerateGhostArrays`) appends inside a `for (i = 1; i < count; i++)`
    loop — so it's already authoritative and needs no rotation math at all. This also matches how
    `regenerateGhostArrays`'s own `connectionIdMap` already worked (maps `oldGhostIds[k] →
    newGhostIds[k]` by array index, never by rotation-sort) — that path was already immune to this
    bug; only `buildConnectionsForInheritedJoin` and two other sites (below) had it.

  **Second confirmed bug, found while fixing the first:** the wraparound-to-source connection (closing
  a polar array into a loop) only checked `matchingArray.type === 'polar'`, not whether the array
  actually closes into a full circle. A partial-arc polar array (e.g. a 180° fan) has boundary ghosts
  spanning an open arc, not a closed ring — wrapping the far end back to the source would incorrectly
  link across the empty gap. The boundary-to-boundary branch (`else`) had the same issue in a
  different form: its modulo-based `prevIndex` always wraps ghost[0] to the last ghost regardless of
  array closure, with no guard at all.
  - **Fix:** added `isClosedCircle = matchingArray.type === 'polar' && matchingArray.angle % 360 === 0`
    (with float tolerance), hoisted above both branches. The source-wrap now requires it; the
    boundary-to-boundary loop now starts at `i = 1` instead of `i = 0` (skipping the one wrapping
    pair) when it's false.

  **Same rotation-sort root cause found in two more places, fixed for consistency:** the "edit ghost
  array params" inline UI flow (search `oldGhostIdsSorted`/`newGhostIdsSorted` in `tattingindex.tsx`)
  — a separate, older `setTimeout`-based remapping flow, not the primary `regenerateGhostArrays` path
  — used the identical raw-rotation-sort pattern to remap old→new ghost IDs by position. For the old
  ghosts, fixed the same way (use `array.ghostIds`' existing order directly — available in that
  closure). For the new ghosts (after recreation), no authoritative order list is cleanly reachable
  without larger changes — this codebase has no `ghostArraysRef` mirror at all, and this legacy flow
  reads from `elementsRef`/closures rather than fresh `ghostArrays` state — so applied a smaller,
  self-contained fix instead: sort by rotation *relative to* `sourceEl.rotation`
  (`((ghost.rotation - sourceRotation) % 360 + 360) % 360`), which recovers the original monotonic
  `angleDeg` ordering regardless of the source's own rotation, without needing the authoritative list.
  Verified by hand: subtracting a constant offset before the modulo undoes the wrap consistently for
  every ghost, since they all had the same offset added at creation time.

  Not attempted: restructuring this legacy inline-edit flow to use the primary
  `regenerateGhostArrays`/`applyGhostRegenResult` path instead of its own parallel `setTimeout`-based
  reimplementation, which would eliminate the need for either fix here entirely. That's a real
  improvement but a larger, separate change — flagged, not done opportunistically inside a bug-hunt.

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
│  │  ├─ Top Menu Bar (170 lines) → TopMenuBar.tsx ✅ — File/View/Arrange/Options/Help + Undo/Redo
│  │  └─ Mode-dispatch ternary (2,309 lines) — mutually exclusive, one mounted at a time:
│  │     ├─ Realistic mode bar ................ 15 lines → RealisticModeBar.tsx ✅
│  │     ├─ Picot Join mode bar ................ 37 lines → PicotJoinModeBar.tsx ✅
│  │     ├─ Beading mode bar .................. 171 lines → BeadingModeBar.tsx ✅
│  │     ├─ Tatting Order mode bar ............ 370 lines → TattingOrderModeBar.tsx ✅
│  │     ├─ Element properties bar (1,051 lines) — splits on selectedElement.type:
│  │     │  ├─ 'line' type branch ............ 248 lines (has its own OrderNumberInput ✅)
│  │     │  └─ everything-else branch (720 lines) → sibling sections:
│  │     │     ├─ Notation input + Picot Wizard . 348 lines — split-ring A/B
│  │     │     │  fields → SplitRingNotationInput.tsx ✅; single-notation field
│  │     │     │  → NotationInput.tsx ✅ (batch 11, later session); Picot
│  │     │     │  Wizard trigger/analysis deliberately left inline
│  │     │     │  (genuinely different behavior / already-documented reasoning)
│  │     │     ├─ Rotate/label controls .......... 60 lines → NotationRotationControls.tsx ✅
│  │     │     │  (mis-catalogued during charting as "materials/color" — corrected)
│  │     │     ├─ small section (Order Number) ... 15 lines → OrderNumberInput.tsx ✅
│  │     │     ├─ Round Group Picker ............. 75 lines → RoundGroupPicker.tsx ✅
│  │     │     │  (mis-catalogued as "rw/hide-label/bead" — it's actually the
│  │     │     │   group-assignment dropdown; RW toggle turned out to be its
│  │     │     │   own separate sibling, not nested inside this one)
│  │     │     ├─ tiny section (RW toggle) ....... 11 lines → RwToggleButton.tsx ✅
│  │     │     └─ Shape toggle + squeeze sliders . 190 lines → ShapeAndSqueezeControls.tsx ✅
│  │     │        (turned out to be shape/squeeze, not "materials" — corrected
│  │     │         again; every guessed label in this chart has needed correction
│  │     │         once actually opened — treat unopened labels below the same way)
│  │     └─ Nothing-selected bar (651 lines)
│  │        ├─ Multi-select summary/actions .... 517 lines → MultiSelectSummaryBar.tsx ✅
│  │        └─ two smaller trailing bits ........ 4 + 123 lines
│  └─ Canvas+Toolbar div (1,905 lines) — 112 identifiers used nowhere else
├─ Color Picker dialog (602 lines) → Modal.tsx (shell) + ColorPickerPickerTab.tsx
│  / ColorPickerSwatchesTab.tsx / ColorPickerGradientsTab.tsx ✅ — the oldest
│  dialog in the file; now brought up to the same shell/component patterns
│  as everything else, including click-outside-close (explicitly added, see
│  Modal.tsx's note on this — the one non-behavior-neutral Modal conversion)
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

Batch 4 done: Shape toggle + squeeze sliders. No real bug this time, but a
scare that looked like one — a post-edit view showed what appeared to be two
orphaned closing tags right after the new component call. AST-checked before
"fixing" it; the fix would have broken the parse (they were legitimately
closing the outer element-type-branch fragment, unrelated to this edit).
Reverted the unnecessary fix rather than shipping it. Lesson reinforced: a
visual "this looks orphaned" read is not sufficient by itself — confirm via
the AST what a tag actually closes before deleting it, the same discipline
that's caught every real bug in this list so far.

Batch 5 done: Top Menu Bar. Clean extraction, no surprises — mechanical prop
wiring only, no notation/path/history logic involved. Note: this component
reads window.innerWidth directly for its responsive width style (matching
the original inline logic exactly) rather than taking it as a prop; that's
a live browser read, not reactive state, so it won't update on resize
without a remount — same behavior as the original code had.

Batch 6 done: split-ring A/B notation input (the original audit's item #8).
Deliberately scoped narrowly — the single-notation input and the Picot
Wizard trigger/analysis logic in the same 348-line section stayed inline,
per the reasoning already documented above (genuinely different behavior /
would just relocate complexity, not reduce it). No surprises executing this
one — used a precise line-range script rather than str_replace for the bulk
of it, given the earlier mystery str_replace failure in batch 1.

Batch 7 done: Tatting Order mode bar. Clean extraction using the same
precise line-range-script approach as batch 6 (given the ternary chain
continuation needs care — see batch 3's near-miss) — verified the exact
opening/closing lines including the chain continuation into the next
branch (`) : selectedElement ? (`) before running the replacement, so no
repeat of that mistake this time.

Batch 8 done: Multi-select summary bar — largest single move this session
(517 lines). Moved verbatim including its early-return control flow, no
reshaping. This resolved the "4th notation input site" open question from
batch 6: found it, and it genuinely doesn't fit SplitRingNotationInput's
shape (no pendingNotationRef usage), so it was correctly left inline rather
than forced. Also resolved which site the bordered dual-field
materialId/materialIdB assignment (noted since the PresetChip extraction)
actually lives at — same site, now visible directly.

Batch 9 done: Color Picker dialog — shell converted to Modal (with
click-outside-close explicitly added, a deliberate exception to every other
Modal conversion being behavior-neutral — see Modal.tsx's note), three tabs
extracted, plus a new utils/color.ts and GradientSwatch.tsx pulling out real
4x-duplicated gradient-rendering code. Also the batch with a real near-miss:
an early draft of the header/footer replacement was written from
pattern-completion instead of the actually-viewed source, caught before
shipping, reverted, and redone from the genuine text — see the full note
under ColorPickerPickerTab.tsx above. Worth remembering next session even
though nothing wrong shipped.

Batch 10 (final) done: promoted ArrayInput.tsx (a genuinely shared,
18-call-site component that had been living as a local definition) and
extracted LineBeadPicker.tsx, the last substantial piece of the
'line'-type branch. With this, the JSX PANEL EXTRACTION LIST FROM
architecture.md's ORIGINAL "Pending refactor work" TABLE IS DONE. The
top-level properties-bar mode-dispatch chain — the thing that used to be
one 2,309-line unbroken block — is now 798 lines total, and everything
left inside it is either irreducible dispatch/routing logic (the ternary
chains themselves — extracting the switchboard into its own component
would relocate complexity, not reduce it, same reasoning as the Picot
Wizard's analysis logic staying inline) or content already deliberately
left inline earlier with documented reasons (Reverse/Clear buttons, the
notation-analysis machinery, the regular/non-split-ring notation input).
The two "coordinating wrapper branches" mentioned in earlier batches
turned out not to need separate extraction once their children were
componentized — they're just clean dispatch code now, nothing left to
pull out of them.

Batch 11 (later session) done: single-notation-input extraction — the
regular/non-split-ring notation field, flagged repeatedly across batches 6
and 8 and left open at the end of that session. Same prop-passing shape as
SplitRingNotationInput.tsx (see NotationInput.tsx above); draftNotation and
notationError stayed in tattingindex.tsx since draftNotation is genuinely
parent state (also read at the canvas-render draft-preview site). Caught
one real near-miss while designing the `getRevertValue` prop, before any
code was written: the original Escape handler only overwrites the input's
DOM value when the element still resolves in `elementById`, otherwise it
leaves the field untouched. A first pass at the prop would have always
returned a string and silently dropped that conditional. Fixed by typing
`getRevertValue` as `() => string | null` and only writing `target.value`
when non-null — verified against the full diff afterward, which showed
only the intended block and one import line changed.

Still open, not part of this list, fair game for a future session:
- Promoting `categorizeColor` to utils/color.ts if another caller
  ever needs it (currently fine as a prop into ColorPickerSwatchesTab.tsx).
- The Ref mirror → useReducer item and the Beading/TattingOrder mode
  bars' remaining ~14 mirror refs — separate, larger architectural
  decision, deliberately not touched this session (see the top-level
  discussion before this list started).

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
| ~~JSX panel extraction~~ | DONE (10 batches, + batch 11 single-notation-input in a later session) — see "Properties-bar mode dispatch" below for the full history and what's still open (categorizeColor promotion — minor). |
| OBB bounding box | Oriented bounding box for single-element selection (rotate box with object); AABB stays for multi-select |
| `isTooShort` flag on move/transform | Currently only set when notation changes (via `computeElementAfterNotationEdit`). Investigated (later session): the flag compares `endpointDist` (straight-line distance between the element's actual endpoint coordinates) against `newLength` (notation-derived physical curve length) — see the computation and its comment around line 3724 in tattingindex.tsx. This means it's NOT purely a notation-derived property, despite the name suggesting otherwise. Verified: plain whole-element move/drag translates both endpoints by the same offset, so `endpointDist` is invariant — that case genuinely cannot trigger the bug, confirming a fix targeting "move" specifically would be unnecessary. NOT verified: path-edit-mode single-endpoint dragging (moving one endpoint handle independently of the other) — this is the case that could plausibly change `endpointDist` without any notation edit, but the handler for it lives in `useCanvasInteraction.ts`/`useInputHandlers.ts`, neither of which were in the sandbox this session. Before doing this fix: get those two files uploaded and confirm whether single-endpoint dragging actually leaves `isTooShort` stale — don't assume the original table note was right, and don't assume it was wrong either. |
| ~~Endpoint joints across ghost arrays~~ | DONE (later session) — see "Endpoint joints across ghost arrays — implemented" under Rules above for root cause and implementation details. |
