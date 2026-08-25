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
                          applyPathPreset, applyLinePreset, resetElementShape
                          resetElementShape(el, dsWidth) — new (session 52).
                          Resets a single element's shape to a relaxed default
                          and clears rotation + polarRotationGridId to 0/null
                          (the "pivot reset to itself" request —
                          polarRotationGridId is what actually overrides an
                          element's own center as rotation pivot; rotation
                          alone isn't enough). Deliberately reuses two
                          existing formulas rather than inventing a third
                          default: the squeeze-reset defaults from
                          ShapeAndSqueezeControls.tsx for closed/split-ring
                          shapes, and addChain's chord/arcLift bow formula
                          (useEditorActions.ts) for open chains, centered on
                          the element's own `center` instead of the viewport
                          center. Returns null for ghosts, lines, and
                          multi-segment/split chains (not handled) — callers
                          treat null as "not resettable." Wired into
                          GeneralElementPropertyBar.tsx (single-select, Row 1)
                          and MultiSelectSummaryBar.tsx (batch over every
                          selected non-null-result element). See the
                          "ShapeAndSqueezeControls.tsx squeeze-reset buttons
                          vs resetElementShape" row in Pending refactor work
                          for the one piece of follow-up DRY cleanup this
                          created.
    stitchGeometry.ts      getFlipSign, getCircleStitchAngle, effectiveElementType —
                          promoted out of tattingindex.tsx (session 52, realistic-
                          renderer extraction, Phase 2/3). Pure — no closures over
                          component state, take only plain arguments.
                          getCircleStitchAngle is used both by the realistic
                          renderer (render/realisticRenderer.ts) and by schematic-
                          mode picot positioning in tattingindex.tsx, which is why
                          it lives here rather than folding into render/.

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
    realisticRenderer.ts   bakeRealisticView(params) — serializes all stitch
                          geometry into one baked SVG string for realistic-mode
                          rendering. Extracted from tattingindex.tsx (session 52,
                          following the realistic-renderer-extraction-plan.md
                          design doc). No React — takes an explicit
                          BakeRealisticViewParams object instead of closing over
                          component state (elements, dsWidth, picotConnections,
                          getElementColor, getGradientColorAtPosition,
                          getStitchTypes), and returns the SVG string instead of
                          calling setBakedRealisticSVG itself — that call now
                          happens at the tattingindex.tsx call site
                          (handleSetRenderMode).
                          Also contains: calculateCircleStitches,
                          calculatePathStitches, calculateSplitRingStitches,
                          renderWedgeRingShapes, sampleFullPathWithOffset, the
                          WEDGE_SHAPES/STITCH_X_EXTENTS constants, and the named
                          picot-geometry constants OFFSET_DS_FRACTION/
                          OFFSET_BASE_PADDING/PICOT_TIP_LENGTH_DS/
                          PICOT_TIP_LENGTH_DEFAULT/PICOT_GAP_HALF_WIDTH_DS
                          (promoted from inline magic numbers, same session).
                          renderWedgeTeardropShapes/renderWedgeSplitRingShapes/
                          renderWedgeChainShapes were consolidated into one
                          shared renderWedgePathShapes core (same session) — the
                          three were near-identical trapezoid-slicing logic,
                          differing only in which paths get sampled and what
                          count the sampling is normalized against.
                          renderWedgeRingShapes (circle variant) is genuinely
                          different — polar-angle math instead of path-sampling
                          — deliberately left separate.
                          Split-ring picot color now correctly selects
                          materialId vs materialIdB based on which half the
                          picot is actually on (session 52 bug fix — was always
                          using materialId regardless of side; see the matching
                          fix in tattingindex.tsx's getConnectionThreadColor).

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
                          PicotJoinModeBar.tsx specifically has grown two later
                          additions, undocumented here until session 52:
                          — Session 47: the Fold Picots feature. A sticky "Fold
                          Picots" toggle in row 1, and a row-2 block of drape
                          sliders (outerLength/innerLength/angleA/angleB) that
                          appears when activeFold is non-null — either just
                          created, or selected by clicking either picot of an
                          existing fold (fold picots auto-select their partner
                          on click; see useJoinActions.ts's getFoldPartner).
                          — Session 52: a connection color-override dropdown,
                          in row 1 between "Fold Picots" and "Exit" — same
                          position for both fold and regular joins. Options are
                          "Auto" (clears the override, connection live-tracks
                          its origin element's material) plus one entry per
                          material actually involved in the connection —
                          deliberately not an open color picker, by explicit
                          design decision. Driven by activeConnection in
                          tattingindex.tsx, which — unlike activeFold — uses a
                          SUBSET match (every selected picot must belong to the
                          connection, not an exact-set match) rather than an
                          exact match, because only fold picots auto-select
                          their partner; a regular join only ever has one picot
                          selected unless the user manually multi-selects both.
                          Getting this subset-vs-exact distinction wrong was
                          the initial bug: the dropdown never appeared for
                          regular joins until the match was relaxed.
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
    SingleSelectPropertyBar.tsx  Dispatcher for the single-selected-element
                          property bar (session — property bar cleanup,
                          batch 12, later session). Routes selectedElement.type
                          === 'line' to LineElementPropertyBar vs. everything
                          else to GeneralElementPropertyBar, then renders
                          MaterialAssignmentDropdown after the dispatch as a
                          shared sibling. Pure prop-drilling — no logic
                          changes from what was previously inline in
                          tattingindex.tsx. Replaces a 554-line inline block
                          with a 61-line component call.
    LineElementPropertyBar.tsx  The ~65-line 'line'-type branch (batch 10 had
                          already extracted its sub-pieces — OrderNumberInput,
                          RoundGroupPicker, LineBeadPicker — this batch wraps
                          what was left: the notation display + rotate/flip
                          controls call + the three sub-component calls) into
                          its own file.
    GeneralElementPropertyBar.tsx  The remaining non-line branch content:
                          split-ring/single notation input ternary, Picot
                          Wizard trigger + analysis logic (previously
                          documented as "deliberately left inline" in batches
                          6/8/11 — that reasoning was about not fragmenting it
                          further, not about it never getting its own file;
                          this batch gives it one without changing its
                          internal shape), plus the calls to
                          NotationRotationControls/RoundGroupPicker/
                          RwToggleButton/ShapeAndSqueezeControls. Does NOT
                          include the material-assignment dropdown — see next
                          entry.
    MaterialAssignmentDropdown.tsx  Newly discovered during this batch: the
                          material A/B selector at the end of the property bar
                          is NOT part of the general-element branch — it's a
                          sibling that renders after the entire line-vs-general
                          dispatch closes, so it applies to line elements too.
                          The original charting diagram had this folded into
                          the "everything-else branch" total; it should have
                          been its own sibling row all along. Caught by
                          compiling the extraction with `tsc` (structural JSX
                          check) rather than by reading — see batch 12 note
                          below for the full story.
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
    useCanvasInteraction.ts  Canvas drag, pivot, selection, rotation handle state.
                          `singleRotationInput` state removed (session — property
                          bar cleanup, later session): confirmed zero references
                          in tattingindex.tsx before deleting — dead since the
                          single-element rotation control was rebuilt on
                          NumberStepper.tsx in an earlier session and this field
                          was never wired to it.
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

                          ADDENDUM (session 52 — nearly repeated the exact mistake this
                          section already warns against): an undo/history audit initially
                          flagged ~10 handlers across MultiSelectSummaryBar.tsx and
                          useEditorActions.ts (group ±90° rotate buttons, hide-label
                          toggles, polar-grid selects, the material dropdown,
                          applyGroupRotation, applyMultiSelectRotationDelta, all six
                          align* functions) as likely missing history pushes, before
                          finding this section and re-reading the "NOT a real risk"
                          paragraph above. All ~10 were false positives — plain
                          setElements calls with none of the four guard refs touched,
                          correctly covered by the auto-push effect. Only two real bugs
                          existed, both matching the ACTUAL narrow risk this section
                          already describes ("an explicit push site that forgets
                          skipAutoHistoryRef") plus one new variant not previously
                          documented:

                          1. RoundGroupPicker (LineElementPropertyBar.tsx,
                          GeneralElementPropertyBar.tsx) — a second confirmed instance of
                          the exact useJoinActions.ts pattern above: an explicit
                          pushHistoryState call with no skipAutoHistoryRef set first, so
                          the auto-push effect also fires for the same change. Not a lost
                          undo step (de-dupe makes it harmless per this section's own
                          note) but a real duplicate entry in practice, since the
                          explicit call and the auto-effect's call don't always compare
                          equal at the exact moment each runs. Fixed by extracting both
                          files' handlers into utils/roundGroupActions.ts, following the
                          addRing-style pattern correctly this time.

                          2. NEW VARIANT — squeeze sliders (ShapeAndSqueezeControls.tsx):
                          this one isn't "forgot skipAutoHistoryRef," it's a case the
                          four-guard-ref design doesn't actually cover. The sliders
                          correctly set isInteractingRef.current = true on their own
                          onMouseDown (to batch drag ticks into one entry, exactly as
                          intended) — but nothing outside useInputHandlers.ts's
                          canvas-scoped onMouseUp actually consumes needsHistoryPushRef.
                          The sliders' own onMouseUp sets isInteractingRef.current =
                          false itself before any canvas mouseup could ever see it as
                          true, so the deferred push is silently orphaned — the final
                          dragged value never got its own undo entry. This mechanism is
                          fine for the canvas's own drag gestures (mousedown and mouseup
                          both go through the same canvas-scoped handler) but isn't safe
                          to reuse for ANY property-bar control that starts its own
                          isInteractingRef-gated interaction outside that pair. Fixed by
                          calling pushHistoryState directly on the slider's own
                          onMouseUp/onTouchEnd instead of routing through
                          needsHistoryPushRef. Worth grepping
                          `isInteractingRef.current = true` across the whole codebase
                          before trusting any other control that uses this pattern —
                          ShapeAndSqueezeControls.tsx was the only offender found this
                          session, but the search wasn't exhaustive beyond the files
                          uploaded so far.

                          LESSON FOR NEXT TIME: read this whole useHistoryActions.ts
                          section before auditing anything history-related. It already
                          documents the mechanism, the convention, a historical example
                          of exactly this bug class, and an explicit warning against
                          flagging plain setElements calls. Skipping that read cost a
                          full audit pass that had to be substantially walked back.
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
                          Also exports (undocumented here until session 52, though the Fold
                          Picots feature itself dates to session 47 — see
                          components/PicotJoinModeBar.tsx's own header comment):
                          foldSelectedPicots, updateFoldConnection (generic despite the name —
                          patches any connection by id, fold or regular, used by both the fold
                          drape sliders and the session-52 connection color-override dropdown),
                          getFoldPartner/getFoldConnection (fold-only picot-click auto-select —
                          NOT generalized to regular joins; this is why regular-joined picots
                          don't auto-select their partner on click the way fold picots do),
                          DEFAULT_FOLD_PROPS.
                          applyJointFlags — exported as of session 52 (previously module-private)
                          so tattingindex.tsx could reuse the same isJoint-demotion logic at two
                          more connection-removal sites (applyNotationChange, 
                          convertToJosephineKnot) that were leaving the far side of a removed
                          connection stranded showing isJoint: true — see the session 52 writeup
                          under Rules for the full bug and fix.
                          Session 52 also changed materialId handling on newly-created
                          connections: performJoin and both calls to
                          buildConnectionsForInheritedJoin no longer auto-populate a connection's
                          materialId from the origin element's current material at creation time.
                          It's left unset by default now, so a connection's rendered color
                          live-tracks its origin element's material going forward, instead of
                          freezing to a stale snapshot. materialId is still a real, working field
                          — it's the mechanism behind the session-52 color-override dropdown in
                          PicotJoinModeBar — it's just no longer auto-set; something (currently
                          only that dropdown) has to set it explicitly for an override to exist.
    useBEClipboard.ts     copyBEToClipboard, cutBEToClipboard, pasteBeClipboard
    useProjectFile.ts     buildProjectData, saveToPath, performSave, saveProject,
                          saveProjectAs, applyProjectData, loadFromPath, loadProject,
                          exportSVG
                          applyProjectData always sets renderMode to 'schematic' on
                          load now (session 52 bug fix), ignoring whatever
                          projectData.renderMode was saved as. bakedRealisticSVG
                          (the actual rendered content shown in realistic mode) is
                          intentionally not part of the save payload — it's
                          derived/rebuilt on demand by bakeRealisticView — so
                          restoring straight into 'realistic' left the canvas with
                          nothing baked until the user manually toggled modes.
                          tattingindex.tsx's separate loadFromAutosave() (restores
                          from the 'tatting-designer-autosave' localStorage key,
                          the splash-screen "restore autosave" button — a distinct
                          code path that doesn't go through this file at all) got
                          the identical fix in the same session, for the same
                          reason — easy to miss since it's not called from here.
                          KNOWN OPEN ISSUE as of session 52: despite both of the
                          above being fixed and tsc-clean, a user report of "file
                          load still opens in realistic mode" was NOT resolved by
                          end of session — every setRenderMode(...) call site in
                          both this file and tattingindex.tsx was enumerated and
                          only these two are load-related (the other two are the
                          manual toggle button, correct as-is), so either a third,
                          undiscovered load path exists (leading candidate: a
                          Tauri file-association/listen() handler not yet
                          uploaded/found), or the fix hadn't reached the build
                          being tested. See handoff.md from that session for the
                          full investigation and next steps.

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

### Realistic renderer extraction, connection color resolution, and related bug fixes (session 52)

**Extraction (per `realistic-renderer-extraction-plan.md`).** `bakeRealisticView`
and its dependency graph moved from tattingindex.tsx to render/realisticRenderer.ts
in three phases: (1) dead code removed first (`stitchCache` — computed but never
read, `sampleClosedPathOffset`/`getWedgePathTransform` — zero call sites); (2)
the pure Group B functions (`getFlipSign`, `getCircleStitchAngle`,
`effectiveElementType`) promoted to the new geometry/stitchGeometry.ts; (3)
Group A (the calculate*Stitches/renderWedge* functions) plus bakeRealisticView
itself moved, converted from closures to an explicit `BakeRealisticViewParams`
object. Verified `tsc`-clean against a pre-session baseline at every step (same
error set, only line numbers shifting) — see the extraction plan doc's own
"suggested order of operations" for the methodology, which was followed as
written. Live-tested working (mode switching, all four shape types, picots)
after Phase 3.

**Cleanup, same session, after the extraction.** The three near-identical
`renderWedgeTeardropShapes`/`SplitRingShapes`/`ChainShapes` functions were
consolidated into one shared `renderWedgePathShapes` core (see
render/realisticRenderer.ts entry above) — verified behavior-preserving, not
just similar-looking: a `baseIndex`/`fraction` split in the original
teardrop/chain bodies was a mathematical no-op (`floor(x) + (x - floor(x)) ===
x`), so collapsing it changed nothing about output. Also: inline magic numbers
(`dsWidth * 0.125 + 5`, the picot tip-length table, the `0.6` picot gap
half-width) promoted to named module-level constants.

**Bug: layer order.** Fold/join connection lines were painting on top of the
baked realistic shapes instead of underneath — the `bakedRealisticSVG` `<g>`
and the `picotConnections.map(...)` render block were siblings in the wrong
order, and the tier-sorted schematic-shape block that *would* have gotten this
right is `opacity: 0` in realistic mode, so it wasn't actually the visible
layer. Fixed by moving the connections block earlier in the JSX. Confirmed
working live.

**Bug: gradient color on fold/join lines.** `getSolidColor` (still used for
picot-arm rendering elsewhere, out of scope) always returns a gradient's first
stop, never samples by position. Fold arcs and realistic-mode join lines both
used it. New `getConnectionThreadColor` in tattingindex.tsx resolves color the
same way regular picots already do in the baked renderer —
`getElementColor` + `getGradientColorAtPosition`, sampled at the origin
picot's own stitch position via a new `getPicotPositionFraction` helper.

**Bug: connection color frozen at join time.** Even after the above fix,
color still didn't update when the joined elements' materials changed later.
Root cause was one layer deeper, in useJoinActions.ts: `conn.materialId` was
being auto-populated from the origin element's material at connection-creation
time (in `performJoin` and both calls to `buildConnectionsForInheritedJoin`),
and — because `'default'` is a truthy string — that "frozen" branch was always
taken in the color-resolution logic, permanently locking the color. Fixed by
no longer auto-populating it; connections now live-track by default, and
`materialId` is reserved for an explicit override (see the color-override
dropdown below).

**Bug: split-ring picots always using side-A material.** Split rings track
two materials (`materialId` for side A, `materialIdB` for side B), but picot
color resolution — in both the baked realistic renderer and
`getConnectionThreadColor` — only ever read `materialId`, regardless of which
side a given picot was actually on. Fixed by deriving the side from existing
data (`picot.stitchesBefore` vs `element.splitPosition`, the same comparison
already used for gradient-position sampling) via a new `getSplitRingSide`
helper — no new field stored on picots. Confirmed the equivalent case in
schematic mode (`renderOnePicot`'s `armColor`) has the same gap and is NOT
fixed — see the pending-refactor table.

**Bug: isJoint left stale after a connection silently disappears.** Two
places removed connections as a side effect (a notation edit dropping a
picot, in `applyNotationChange`; converting an element to a Josephine Knot,
in `convertToJosephineKnot`) without demoting `isJoint` on the *other* side
of the removed connection — leaving it showing as still-connected with no
connection record behind it. `breakSelectedPicots` (the explicit "Break"
action) already did this demotion correctly via a private `applyJointFlags`
helper in useJoinActions.ts; exported that helper and reused it at both
sites. A third, structurally similar site (ghost-array-regeneration's
connection remap) was flagged but not fixed — see pending-refactor table.

**Bug: New Project not resetting materials.** `confirmNewCanvas` reset ~13
pieces of project state but never called `setMaterials(...)` — a project
loaded before "New" would leave its materials/gradients carried over into the
nominally blank new project. Pre-existing, unrelated to any of the above;
found while investigating a different report. Fixed: resets to
`DEFAULT_MATERIALS` now, same constant used elsewhere.

**Bug: file load restoring realistic mode.** `bakedRealisticSVG` (the actual
rendered content in realistic mode) isn't part of any save/autosave payload —
it's derived on demand. Loading straight into a saved-as-realistic
`renderMode` left the canvas with nothing baked until the user manually
toggled modes. Fixed at the two load sites found (`useProjectFile.ts`'s
`applyProjectData`, and tattingindex.tsx's separate `loadFromAutosave`) to
always force `'schematic'` on load. **Not resolved as of end of session** —
user still saw the bug after both fixes; see pending-refactor table and
handoff.md for the open investigation.

**New feature: connection color-override dropdown.** In PicotJoinModeBar,
row 1, between "Fold Picots" and "Exit" — same position for both fold and
regular joins. Lets the user pick which of the connection's own involved
materials to freeze the color to (or "Auto" to clear the override and resume
live-tracking) — deliberately not an open color picker, by explicit design
decision. Required generalizing `activeFoldConnection` (exact-match, fold-
only) into a new `activeConnection` (subset-match, any connection type) in
tattingindex.tsx, since fold picots auto-select their partner on click but
regular-join picots don't — an exact-set match never fired for a
single-picot selection. See the PicotJoinModeBar.tsx and useJoinActions.ts
entries above for the full mechanism.

Translation keys `picotConnectionColorLabel`/`picotConnectionColorAuto` were
added to the dropdown's JSX but NOT to any i18n file — none were available
this session. Will render as raw keys until added.

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
│  │     ├─ Element properties bar — SingleSelectPropertyBar.tsx ✅
│  │     │  (session — property bar cleanup, batch 12, later session;
│  │     │  61-line component call replaces the old 554-line inline block):
│  │     │  ├─ 'line' type branch → LineElementPropertyBar.tsx ✅ (has its
│  │     │  │  own OrderNumberInput call, ~65 lines)
│  │     │  ├─ everything-else branch → GeneralElementPropertyBar.tsx ✅
│  │     │  │  ├─ Notation input + Picot Wizard . 348 lines — split-ring A/B
│  │     │  │  │  fields → SplitRingNotationInput.tsx ✅; single-notation field
│  │     │  │  │  → NotationInput.tsx ✅ (batch 11, later session); Picot
│  │     │  │  │  Wizard trigger/analysis stayed inline WITHIN this file
│  │     │  │  │  (genuinely different behavior / already-documented
│  │     │  │  │  reasoning — this batch relocated the file it lives in,
│  │     │  │  │  not its internal shape)
│  │     │  │  ├─ Rotate/label controls .......... 60 lines → NotationRotationControls.tsx ✅
│  │     │  │  ├─ small section (Order Number) ... 15 lines → OrderNumberInput.tsx ✅
│  │     │  │  ├─ Round Group Picker ............. 75 lines → RoundGroupPicker.tsx ✅
│  │     │  │  ├─ tiny section (RW toggle) ....... 11 lines → RwToggleButton.tsx ✅
│  │     │  │  └─ Shape toggle + squeeze sliders . 190 lines → ShapeAndSqueezeControls.tsx ✅
│  │     │  └─ Material assignment dropdown → MaterialAssignmentDropdown.tsx ✅
│  │     │     (session — batch 12; discovered to be a SIBLING of the
│  │     │     line/general dispatch, not nested inside the general branch
│  │     │     as the original charting diagram implied — applies to both
│  │     │     types. See MaterialAssignmentDropdown.tsx entry above.)
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

Batch 12 (later session, "property bar cleanup") done: gave the remaining
inline single-select property bar content its own files. This was the piece
batches 1-11 never fully closed out — earlier batches extracted specific
sub-components CALLED FROM WITHIN the inline JSX (OrderNumberInput,
RoundGroupPicker, etc.) but the wrapping JSX itself (line-vs-general dispatch,
notation/picot-wizard analysis block, material dropdown) stayed directly in
tattingindex.tsx. Result: 554 inline lines (7160-7713) replaced with a
61-line component call, split across 4 new files (SingleSelectPropertyBar,
LineElementPropertyBar, GeneralElementPropertyBar, MaterialAssignmentDropdown
— see component entries above for what each contains).

Two real findings, both caught by compiling the extraction with `tsc`
(structural-JSX-only check against each new file, then the full original
file for comparison) rather than by reading:
- The material-assignment dropdown is a SIBLING of the line/general dispatch,
  not nested inside the general branch. First-draft extraction included it
  in GeneralElementPropertyBar.tsx, which produced a real
  "JSX expressions must have one parent element" compiler error — traced via
  indentation-level comparison against the original file (matching indent
  on the ternary's opening `{selectedElement.type === 'line' ? (` and its
  closing `)}` confirmed the material section was outside that ternary
  entirely). This means the original charting diagram's line-count
  attribution for "everything-else branch (720 lines)" was slightly wrong —
  part of that total was actually shared-sibling content. Fixed by giving it
  its own file rather than duplicating it into both branches.
- Several picot-wizard helpers (`analyzeNotationForWizard`, `autoCompact`,
  `scaleNotation`, `reverseNotation`, `compactRepeatedPicots`, etc.) needed
  importing from `domain/picotTools` (most of them) and `domain/parser`
  (`reverseNotation`, `normalizeNotationInput`) — an early draft guessed
  they'd all come from `domain/parser` since that's what the adjacent
  notation-parsing code imports from; `tsc`'s "cannot find name" errors
  caught the wrong-module guesses immediately. Also caught: `updateNotation`
  takes an optional 4th options arg (several original call sites already
  used it), and `dsWidth`/`updateSelected`/`updateElement` were missing from
  the first prop-dependency scan entirely (only surfaced once the type
  checker actually tried to resolve them).

Verification approach for this batch, worth reusing: static dependency
scanning (regex cross-reference against component-scope declarations) to
draft the initial prop list, then `tsc --noEmit` against the isolated new
files (loose tsconfig — jsx:react, no strict, skipLibCheck — since sibling
components/domain files weren't in the sandbox) to catch structural and
naming errors before wiring into tattingindex.tsx, then `tsc` against the
FULL edited file afterward and diffed its error set against the same check
on the untouched original to confirm zero new errors introduced (the 3
pre-existing Modal `children` prop errors were unchanged). Line-count math
(removed 554, added 61 call site + 1 import line = exact predicted total)
also cross-checked as a cheap sanity gate.

**Post-batch-12 correction (live-tested same later session, after the
initial handoff):** the verification approach above still shipped a real
bug — `Uncaught ReferenceError: allPicots is not defined`, thrown the
moment a ring was selected. Root cause: the regex-based dependency scan
checks "is this name declared anywhere before line X in the file" but
doesn't check WHERE — so a name that's declared locally inside the block
being extracted (shadowing an outer prop, or just reused as an unrelated
object-literal key) reads as an external dependency. Two names got
promoted to props that were never real: `allPicots` (real dependency was a
same-named `const allPicots = currentElement?.picots || []` declared
*inside* a nested IIFE within the extracted block — pure shadowing, the
prop was never actually read) and `picotMatchMode` (its only appearance in
the extracted block is as an object-literal key —
`{ picotMatchMode: 'order' }` — not a variable reference at all). Both
props were wired at the tattingindex.tsx call site to variables that don't
exist at that scope, which is a plain `ReferenceError` at render time —
not a type error, so `noImplicitAny`/`any`-typed props didn't catch it
either.

Compounding factor: `tsc` actually did flag this (`TS2304: Cannot find
name 'allPicots'`), but every verification command that session filtered
`grep -v "TS2307"` (module-not-found, expected noise from the sandbox
having no node_modules) without also excluding `TS2304` from the *filtered
out* set — meaning `TS2304` should have stayed visible but at some point
got swept into a broader filter list (`TS2307|TS2304|TS2554|...`) built to
cut down noise for the OTHER prop-typing errors in that same pass, and the
real `TS2304` for these two names got lost in that. Lesson for next time:
`TS2304` ("cannot find name") should never be blanket-filtered — it's the
one error class that's essentially never sandbox noise and always worth
reading individually.

**Takeaway for the next dependency-scan-based extraction** (directly
relevant to the realistic-renderer extraction plan, which proposes the
same static-scan method): after drafting a prop list this way, grep the
candidate block for `const NAME =` and `NAME:` (destructure/object-key
patterns) to catch shadowing before finalizing the prop interface — not
just after wiring, when `tsc`'s `TS2304` is the last line of defense and
apparently easy to lose in filtered output.

**Unrelated pre-existing bug, found incidentally while chasing the above,
not fixed:** `tattingindex.tsx` line ~3012, inside `repairElements`, calls
`pushHistory()` — no function of that name is defined anywhere in the
file (confirmed via `tsc`'s `TS2304`, and confirmed present in the
untouched original file predating this session's edits — not introduced
by batch 12). Likely meant to call `pushHistoryState(...)` like every
other mutation path does. `repairElements` is the ring-geometry-corruption
repair path, so this would throw if that path is ever exercised. Not
touched this session — flagging for whenever ghost-array-adjacent geometry
work happens next, since that's the likeliest place `repairElements`
actually gets called from.

**Verification methodology upgrade (session 52):** the "loose tsconfig, no
@types/react" sandbox check used above is noisy enough to hide real errors
inside thousands of harmless TS7026 ("JSX element implicitly has type
'any'...") and TS7006 ("Parameter implicitly has an 'any' type")
diagnostics — every JSX line and every untyped callback param in the whole
file trips these, none of which would fire in the real project build (which
has actual @types/react). This noise masked a genuinely new TS2698
spread-type error and made several diffs unreadable by count alone.

Better approach, low cost: `npm install --no-save @types/react@18
@types/node` into the sandbox once, then run the same `tsc --noEmit --jsx
react-jsx --esModuleInterop --skipLibCheck --target es2020 <file>` checks as
before (note: react-jsx, not react, once real types are present). TS7026
disappears entirely; remaining diagnostics are real. This is how two more
pre-existing latent bugs were found this session (both same root cause):
`getPolarFlipGrid` and `repairElements` in tattingindex.tsx both do
`elementsRef.current.map(...)` — `elementsRef` there is declared as bare
`useRef([])` (infers as `never[]`), unlike `useEditorActions.ts`'s
properly-typed `elementsRef: React.RefObject<any[]>`. `.find()` had been
silently tolerated as implicit-any; swapping to `.map()` for an O(n²) fix
surfaced real type errors. Fixed both with a local cast
(`(elementsRef.current as any[])`) rather than changing the ref's own
declaration, which is used throughout the ~11k-line file and risked
surfacing unrelated errors far from the actual fix. Still always diff
against a baseline captured in the SAME environment (same node_modules
present or absent on both sides) — comparing a real-types run against a
stale no-types baseline produces a huge, meaningless-looking diff (hit this
exact trap once this session before catching it).

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
| ~~`bakeRealisticView` → `render/realisticRenderer.ts`~~ | DONE (session 52) — see render/realisticRenderer.ts entry above for what moved and what was cleaned up (wedge-shape consolidation, named constants) in the same pass. |
| Tauri `ask` call → `tauri/file.ts` | Small, low priority |
| History system — perf only | Replace full JSON stringify/deep-clone per entry with structural diff, for large-pattern performance. NOT a correctness fix — the push mechanism itself is sound and documented under `useHistoryActions.ts` above. |
| `regenerateGhostArrays` → dedicated hook/module | Needs clean data interface for `createPolarInstance`/`createLinearInstance` |
| Ref mirror → `useReducer` | The big architectural unlock; makes memoization meaningful and eliminates the remaining ~14 mirror refs |
| ~~JSX panel extraction~~ | DONE (10 batches, + batch 11 single-notation-input in a later session) — see "Properties-bar mode dispatch" below for the full history and what's still open (categorizeColor promotion — minor). |
| OBB bounding box | Oriented bounding box for single-element selection (rotate box with object); AABB stays for multi-select |
| ~~`isTooShort` flag on move/transform~~ | CLOSED (session 52) — turned out to be moot, not fixed. Got `useInputHandlers.ts` uploaded and traced `smartEndpointDrag` (the actual single-endpoint drag handler): it never writes a stored `isTooShort` field at all, and neither does `computeElementAfterNotationEdit` in the current code — the only `isTooShort` anywhere is a local var computed live every render via `isChainTooShort(el, dsWidth)` (tattingindex.tsx ~line 7720), which checks current chord-vs-physical-length directly regardless of what changed the geometry. Its own comment already explains why: a chain can always bulge/flatten to span any chord up to its physical length, so only exceeding that (plus a little give) is genuinely too short. `smartEndpointDrag` independently re-bulges to match target length on every drag, so it can't produce a false "too short" either. Nothing to fix — the table row's premise (a stale stored flag) describes an earlier design already superseded by the live check. |
| ~~Endpoint joints across ghost arrays~~ | DONE (later session) — see "Endpoint joints across ghost arrays — implemented" under Rules above for root cause and implementation details. |
| ~~File load still opens in realistic mode~~ | FIXED (session 52). Root cause was NOT a third load path — it was a bug in the fix that session 52's handoff believed was already applied. `useProjectFile.ts`'s `applyProjectData`, the line actually in the uploaded file, was `p.setRenderMode(projectData.renderMode || 'schematic')` — using the *saved* renderMode whenever present, only falling back to schematic when the field was missing/falsy. Since a project saved while in realistic mode has `renderMode: 'realistic'` in the file, loading it reproduced exactly the reported bug. The handoff's claim that this line "forces schematic, ignores projectData.renderMode" didn't match what was actually in the file — either the real fix never got saved, or was reverted. Fixed to unconditionally `setRenderMode('schematic')`. Confirmed `loadFromAutosave()` (tattingindex.tsx ~line 864) was correct all along — hardcoded, no fallback trick, nothing to fix there. Traced both `loadFromPath`/`loadProject` (recent-projects and browse-button paths) and confirmed both route through `applyProjectData` — there was never a third path. |
| Split-ring picot color, schematic mode | OPEN as of session 52 — `armColor` in `renderOnePicot` (via `getSolidColor`) has the same side-blind bug that was fixed for the baked realistic renderer and fold/join connection color this session (always resolves `materialId`, never `materialIdB`, regardless of which side the picot is on). Two other `getSolidColor` call sites (~5010, ~5119) never investigated. Fix would follow the established pattern: check `getSplitRingSide(element, picot)` (tattingindex.tsx) and substitute `materialIdB` when it's `'B'`. |
| Ghost-array regeneration's connection remap may drop connections silently | OPEN as of session 52 — flagged but not traced deeply enough to confirm reachability. If a polar array shrinks, the ghost-ID remap (tattingindex.tsx, near `setPicotConnections(merged)`, search `oldGhostIdsSorted`/`newGhostIdsSorted`) may leave some old connections with no remap target, silently dropping them without demoting `isJoint` on the far side — the same bug pattern fixed at two other sites this session (see `applyJointFlags` note under useJoinActions.ts above). |
| Round-group assignment duplication + missing skipAutoHistoryRef | FIXED (session 52). `LineElementPropertyBar.tsx` and `GeneralElementPropertyBar.tsx` each had their own ~25-line inline RoundGroupPicker wiring, and had drifted onto two different (both broken) history strategies — see the useHistoryActions.ts addendum above for the skipAutoHistoryRef half of this; this is the duplication half. Extracted to `utils/roundGroupActions.ts`'s `createRoundGroupHandlers(...)` factory, used identically by both files now. `GeneralElementPropertyBar.tsx`'s old `pushOrderHistory`/`setTimeout(...,0)` and `needsHistoryPushRef` props are fully retired on this path; `skipAutoHistoryRef` threaded through instead (SingleSelectPropertyBar.tsx → tattingindex.tsx call site). |
| `applyGroupRotation` negative-modulo bug + duplicated ±90° button math | FIXED (session 52). `useEditorActions.ts`'s `applyGroupRotation`: `(rotation + delta) % 360` with no second normalization pass could store e.g. `-90` instead of `270`, unlike the `((x%360)+360)%360` idiom used everywhere else `.rotation` is computed — including its own sibling `applyMultiSelectRotationDelta` right above it, which was already correct. Fixed the modulo, and redirected `MultiSelectSummaryBar.tsx`'s ±90° group-rotate buttons (which had their own hand-rolled copy of the same pivot/rotation geometry, sharing the same modulo bug) to call `applyGroupRotation(currentDeg ± 90)` instead — one geometry implementation instead of two. |
| `loadFromPath`/`loadProject` duplication | FIXED (session 52). `useProjectFile.ts`: both were ~90% identical (same read+applyProjectData+error-handling block, differing only in how `filePath` is obtained). Extracted to a shared `readAndApplyProjectFile(filePath)` helper; both are now thin wrappers. Motivation: this is exactly the kind of split that let the file-load-realistic-mode bug's fix apply cleanly to one copy and get missed in the other (see FIXED row above). |
| Squeeze slider undo (`ShapeAndSqueezeControls.tsx`) | FIXED (session 52) — see the useHistoryActions.ts addendum above for full detail. Short version: the only place outside `useInputHandlers.ts`'s canvas mousedown/mouseup pair that sets `isInteractingRef.current = true`. Its deferred push via `needsHistoryPushRef` was never flushed, since that flag's only consumer is scoped to the canvas SVG's own `onMouseUp`. Fixed with a direct `pushHistoryState` call on release. |
| Six `align*` functions duplication (`useEditorActions.ts`) | OPEN. `alignLeft`/`alignRight`/`alignTop`/`alignBottom`/`alignCenterHorizontal`/`alignCenterVertical` are structurally identical — get bounding box, compute target position per aggregation, map selected elements shifting by delta — varying only in which bounds property/aggregation is used. Collapsible into one parameterized function. Note for whoever picks this up: none of the six call `pushHistoryState` or touch `skipAutoHistoryRef`/`isInteractingRef` — per the useHistoryActions.ts convention, that's correct as-is (the auto-push effect covers plain `setElements` calls with none of the four guard refs touched); don't "fix" a missing history push here, there isn't one. |
| `paths.ts` binary-search duplication | OPEN. `splitRingMaxH`, `splitRingSolveBulge`, and both branches of `applyPathPreset` (symmetric/non-symmetric, which are themselves ~90% duplicate of each other) each hand-roll the same "grow hi until it overshoots, then bisect" idiom against a different target function. Candidate for one shared `solveForTarget(evalFn, target, tolerance, maxIters)` utility. |
| `ShapeAndSqueezeControls.tsx` squeeze-reset buttons vs `resetElementShape` | OPEN. The two internal squeeze-reset buttons (regular ring, split ring) now duplicate exactly what `resetElementShape` (paths.ts, added session 52 for the Reset Transform feature) already does for closed/split-ring shapes. Duplication was created deliberately that session — didn't want to touch verified-working slider code while adding an unrelated feature. Worth revisiting now that `resetElementShape` is proven correct (see paths.ts entry above); output should be byte-identical, this is a pure DRY cleanup. |
| Duplicated rotation-expression evaluators (`MultiSelectSummaryBar.tsx`) | OPEN, not yet fixed. The free multi-select rotation-delta input's `onBlur`/`onKeyDown` each hand-roll their own `new Function('"use strict"; return (' + s + ')')()` mini math-expression evaluator (regex-gated to digits/operators/parens), duplicated between the two handlers. The group-rotation text field *in the same file* already uses the existing `parseRotationExpr` prop for the identical job. Worth checking whether `parseRotationExpr` can just be reused here directly before writing a third variant. |
| Free multi-select notation scaling vs `updateNotationForMultiple` | OPEN, needs verification before assuming it's pure duplication. `MultiSelectSummaryBar.tsx`'s free-multi-select notation `onBlur` (~50 lines) reimplements per-shape-type path scaling inline (ring/split-ring, with a `scPt` scaling helper defined twice within it) instead of delegating to `updateNotationForMultiple`. BUT: per the existing "Picot Wizard — batch update" doc section, `updateNotationForMultiple` only supports `preservesExistingPicots: true` callers and silently skips ghost-mother elements — confirm the free-multi-select scaling use case can actually satisfy that constraint before assuming this is a clean swap; it may be intentionally separate. |
