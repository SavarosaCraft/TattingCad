# TattingCAD — Architecture

Last updated: **session 63** (code review #1 fixed: numbers from pattern
files are checked — see "Security: numbers from pattern files (session 63)"
under Rules, `utils/safeNumber.ts`; SVG export: one sub-layer per round and
all joins in one group — see "SVG export: rounds as layers (session 63)";
review #4: "Resume can't write older work over a newer file (session 63)";
#2 / #3 / #5 / #22 / #23 — see "(session 63)" notes under Unsaved changes,
Group names and colours in the file, New Project, Notation edit, and
Split-ring side A; the Medium and Low items too — the whole review is fixed,
see "(session 63, review #…)" sections, e.g. "Resume goes through file open
(session 63, review #15)"). Before that: **session 62** (code review + fixes: flip keeps joins and a
split-ring flip swaps its sides, split-ring side A counted from the shared
start, Picot Tools keeps every stitch type (rds, bds, half stitches),
"resume before open" question, Escape order, dropdown keys, touch cancel,
the main shortcut handler registered once, Recent list read once, reference
image size cap, one zoom range — see "Code review and fix tracker
(session 62)" under Rules and the "(session 62)" sections after it).
Before that: **session 61** (Android files + Recent that survive a
restart, autosave on leaving + Resume back to its file, the third security
wall — the deny list —, floating / mock ring kinds, Shift = 45° move lock
with rotation handles on R, join lines solid and always drawn + their own
SVG layer, tablet property bar on 2 lines — see the "(session 61)" sections
under Rules, starting at "Ring kinds: floating / mock ring").
Before that: **session 60** (first-run setup screen and sample patterns —
see "First-run setup screen (session 60)" and "Sample patterns (session 60)"
under Rules, `components/SetupScreen.tsx`, `components/SampleGallery.tsx`;
and "Large size → bigger dialogs (session 60)").
Before that: **session 59** (layout polish + rail rebuilt on the shared
tool descriptors — see "Tool rail and phone bottom bar", now marked
sessions 58–59; and every indicator colour moved into the theme — see
"Colour theme — every indicator colour"). Before that: **session 58** (beginner-friendly layout + unsaved-changes
rework — see the session-58 sections under Rules: "Tool rail and phone
bottom bar", "Simple / Full toolbar and the getting-started hint",
"Unsaved changes — history edit numbers", "Window title", "Two-finger
gesture", "Chain centre = chord midpoint"). The layout plan with progress
and the polish list is `plan-ui-layout-session58.md`. Before that:
**session 57** (end-allowance steps 1–5 — see "Stitch → path
position" under Rules). Before that: **session 56**. Sessions 54–56 were folded in during session 56
(this doc had not been updated since session 53). Session 54/55 details come
from their handoff docs; session 56's from the work itself. The new Rules
sections near the end ("Realistic view", "Single-element thread ribbons",
"Clean Up Duplicates", "Batch notation edits", "Losing window focus
mid-gesture", "Ghost arrays — benched", "Version drift") cover the bulk of it.

## Module structure

```
src/
  tattingindex.tsx        Main component (orchestration only). Obtained directly for
                          the first time later session (previously only ever seen via
                          excerpts/paraphrase) — see the split-ring picot color fix
                          (paths.ts entry) and the "Stuck modifier keys on window
                          blur" / useHistoryActions.ts Addenda 4-5 entries under
                          Rules for what was found once it was actually in hand.
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
    refImage.ts           Session 62. shrinkReferenceImage(src) — keeps the
                          reference image small enough for the autosave
                          (≤ 2048 px, ≤ ~1.1 MB). See "Reference image size cap
                          (session 62)" under Rules.

    fileFingerprint.ts    Session 63 (review #4). fingerprintText(text) —
                          length + cyrb53 of a pattern file's text; tells
                          whether the file changed before the first Save
                          after Resume. See "Resume can't write older work
                          over a newer file (session 63)".
    emergencySave.ts      Session 63 (review #6). registerEmergencyHooks /
                          getEmergencyHooks — the crash screen's way to the
                          last good state (snapshot, autosave).
    safeNumber.ts         Session 63 (review #1). isRealNumber, safeNum,
                          markupNum (for coordinates written into markup
                          text), sanitizeProjectNumbers(data) — the number
                          twin of safeColor.ts. See "Security: numbers from
                          pattern files (session 63)" under Rules.

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
                          Session 56: resetElementShape is now also what
                          ShapeAndSqueezeControls.tsx's squeeze Reset buttons call
                          (see that entry). New internal solvePathMagnitude: the
                          one bisection shared by both branches of
                          applyPathPreset (verified identical output on 1,200
                          random cases). splitRingMaxH/splitRingSolveBulge are
                          deliberately NOT routed through it — they grow their
                          bound first, run a fixed count with no early exit and
                          return a bound/midpoint, so merging them would shift
                          every existing split ring's geometry slightly.
    stitchGeometry.ts      getFlipSign, getCircleStitchAngle, effectiveElementType —
                          promoted out of tattingindex.tsx (session 52, realistic-
                          renderer extraction, Phase 2/3). Pure — no closures over
                          component state, take only plain arguments.
                          getCircleStitchAngle is used both by the realistic
                          renderer (render/realisticRenderer.ts) and by schematic-
                          mode picot positioning in tattingindex.tsx, which is why
                          it lives here rather than folding into render/.
                          Session 57 (end allowance, step 1): the shared
                          stitch → path-position helpers — getEndAllowance
                          (always 0 until step 3), stitchRunFraction,
                          elementStitchFraction, splitRingSideFraction,
                          getSplitRingSplitPos. Every place that turns a stitch
                          position into a place along a chain / teardrop /
                          split-ring path now calls these. See "Stitch → path
                          position" under Rules.
                          Session 58: withChordCenter(el) — puts a single-path
                          chain's/line's `center` back on its chord midpoint
                          (returns the same object when nothing changes). See
                          "Chain centre = chord midpoint" under Rules.

  domain/
    parser.ts             parseNotation, reverseNotation, buildSegmentLabel,
                          getSegmentRuns, countActualStitches, countStitchesInRange,
                          getStitchTypes, expandTokens, isZeroWidth, isNotationValid,
                          normalizePattern, normalizeNotationInput, STITCH_WIDTH_DS
                          Session 62: isSlotBead, splitRingSideAPosition,
                          repairSplitRingSideABeads — see "Split-ring side A:
                          counted from the shared start (session 62)" under Rules.
    patternOutput.ts      generatePatternText() — pure pattern text builder
    picotTools.ts         Picot Wizard pure transforms — all notation-text operations.
                          No React dependencies. 93 unit tests in test_picotTools.js.
                          Exports (grouped by feature):
                          — Analysis: analyzeNotation, totalRunDs (LENGTH in ds),
                            totalRunStitches (session 62 — what Scale works in),
                            splitRingSides (session 60)
                          — Clear: clearUnjoinedPicots, hasUnjoinedPicots
                          — Add: addPicotsToRuns, hasAddablePicotRuns
                          — Protected zones: getProtectedZones, isRunProtected,
                            clampProtectedFloor
                          — Fill density: previewFillDensity, maxUsefulFillGap
                          — Compact: compactRepeatedPicots, hasCompactableGroups,
                            autoCompact (auto-compacts any transform result before commit)
                          — Expand (opposite of Group, session 60): expandRepeatGroups,
                            hasRepeatGroups — never auto-compacted (see Rules)
                          — Scale: scaleNotation, suggestScalePresets (returns
                            { exact, rounded } rows; session 62: takes the
                            analysed sides, [{ type, segments }]),
                            suggestScalePresetsMulti
                          Session 62: every stitch type — a run keeps its
                          stitches in order and Add/Fill/Scale count stitches.
                          See "Picot Tools — every stitch type (session 62)".
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
                          Session 55 (performance): pathLengthCache /
                          getPathsTotalLength (WeakMap on each path object) and
                          offsetCurveCache / getCachedOffsetCurve, so each distinct
                          offset curve is sampled once per element instead of once
                          per stitch; the path-element branch reuses
                          calculatePathStitches' own allSamples/pathLengths.
                          Session 56: line elements are emitted as ONE filled
                          ribbon (emitPicot style) instead of a black stroke + a
                          colour stroke — see "Single-element thread ribbons" under
                          Rules. NOT in the baked SVG (drawn live in
                          tattingindex.tsx): picot join lines, fold arcs, beads.
                          The split-ring direction arrow is schematic-only and does
                          not appear in realistic view at all (by decision). When
                          the bake runs is decided by tattingindex.tsx — see
                          "Realistic view — what renders, and the bake cache".
                          Session 62: calculateSplitRingStitches steps like
                          calculatePathStitches (rds 1.5 wide, ss sub-stitches)
                          and counts side A from the shared start — see
                          "Split-ring side A: counted from the shared start".

  components/
    AppErrorBoundary.tsx  Session 63 (review #6). Crash screen around the whole
                          app (main.tsx): Save a copy… / Restart / Close; X
                          works again. Built-in en/es/hu texts.
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
                          Session 56: both squeeze Reset buttons now call
                          resetElementShape (paths.ts) through one local
                          resetSqueeze, keeping the element's polarRotationGridId
                          (the full Reset Transform clears it; a squeeze reset
                          never did). Output verified identical for split ring,
                          teardrop and circle.
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
                          Session 56: Delete button added after Bring to Front
                          (props onDelete/deleteDisabled) — a copy of the left
                          toolbar's delete for touch users: same deleteSelected
                          handler, t('toolDelete') title and IconDelete; disabled
                          in picotJoin/beading/tattingOrder (as the left button)
                          plus realistic view (where the left button is hidden).
                          This file uses CRLF line endings — preserve them.
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
                          Session 56:
                          - Δ° rotation box uses the parseRotationExpr prop with
                            currentDeg 0 (pure delta) instead of two hand-rolled
                            `new Function` evaluators. Same resulting angle for
                            every tested input; "x+10" now works (x = 0).
                          - The free multi-select notation box no longer has its
                            own inline per-type update (it gave every picot a new
                            id — orphaning joins — set a split ring's stitchCount
                            to side A only, never moved splitPosition, and never
                            re-bent chains). It now calls applyNotationToMultiple
                            (tattingindex.tsx) — see "Batch notation edits" under
                            Rules. Props restoreBEConfigs/extractBEConfigs were
                            removed (only that block used them); new prop
                            applyNotationToMultiple(ids, notation|null, notationB?).
                          - For an all-split-ring selection there is now a "B:"
                            box next to "A:" (prefilled when all share side B;
                            a typed "sr:" prefix is stripped).
                          Session 62: the Scale presets take totalRunStitches
                          (new prop, replaces totalRunDs) — Scale works in
                          stitches now; rds / half-stitch rings are scaled too.
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
                          Sessions 54–55: a fourth tab, "Lizbeth Colors"
                          (colorPickerTab 'lizbeth', t('colorLizbethTab')).
                          dmc_colors.json and lizbeth_colors.json both load into
                          the single dmcColors state (shared validateCatalog/
                          loadCatalog; Lizbeth optional, ids prefixed "LZ", groups
                          prefixed "Lizbeth – "). tattingindex.tsx splits them
                          with two useMemos (dmcOnlyColors / lizbethOnlyColors, by
                          that group prefix) and renders ColorPickerSwatchesTab
                          twice, each with its own local search/page/category/
                          selection state. Gradients stay merged across brands.
                          The JSON files must live in /public (Vite dev server
                          serves static assets from there, not /dist).

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
                          entry. Session 62: Scale presets come from
                          suggestScalePresets([analysisA, analysisB?]).
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
                          Session 58: optional `label` prop — renders icon +
                          text as a full-width row (`tb-labelled`/`tb-label`
                          classes) for the Simple toolbar. File is CRLF.
    GettingStartedHint.tsx  Session 58. The "what next" hint in the empty
                          property bar (nothing selected, no mode): empty
                          pattern → add Ring/Split ring/Chain or a reference
                          image; one element → Select, then edit notation;
                          2+ elements, no joins → Picot Join; otherwise the old
                          "Select an element…" text. The real tool buttons sit
                          inline in the sentence: translations carry {ring},
                          {splitRing}, {chain}, {refImage}, {select}, {join}
                          tokens, so each language places them itself.
                          getHintStage(count, hasConnections) is exported.
    SampleGallery.tsx     Session 60. Sample-pattern gallery (cards with
                          thumbnail, title, description) + loadSampleList /
                          pickText / sampleUrl helpers. See "Sample patterns
                          (session 60)" under Rules.
    SetupScreen.tsx       Session 60. First-run setup screen (language,
                          toolbar, size, background, indicator colours). No
                          state of its own beyond "what changed here" — it
                          gets the app's current values + setters as props.
                          See "First-run setup screen (session 60)" under Rules.
    PhoneToolBar.tsx      Session 58. Bottom tool bar for upright phones: one
                          row (icon over label) + a "More" button that opens a
                          tile panel above the bar; tapping a tile or the
                          backdrop closes it. No tool logic — takes PhoneTool
                          descriptors built in tattingindex.tsx
                          (phoneMainTools / phoneMoreTools). Always rendered;
                          CSS decides whether it or the rail shows. See "Tool
                          rail and phone bottom bar" under Rules.
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
                          checkFileExists, addToRecents, getRecents,
                          generateThumbnailPng, thumbSrcFor, fileBaseName /
                          fileDisplayName / patternNameFromUri,
                          writeClipboardText, readClipboardText.
                          Session 61: on Android, Open / Save / read / write
                          of content:// go through tauri-plugin-android-fs
                          (dynamic import) with kept access — see "Android
                          files: kept access" under Rules.
                          Session 62: removeFromRecents, protectFileAccess —
                          see "Recent Projects list read once (session 62)".

  hooks/
    useUIState.ts         All dialog, menu, and UI visibility state
                          ⚠ Must run automated cross-check against tattingindex.tsx
                            destructure whenever adding new state — missing declarations
                            crash silently mid-function (dialog never closes, state never
                            updates). See session 37 for the cross-check script.
                          Session 62: confirmDialog texts may be functions of t
                          (ConfirmText) and it takes an optional cancelLabel /
                          onCancel — see "Opening a file while last session's
                          work is unsaved (session 62)".
    useCanvasInteraction.ts  Canvas drag, pivot, selection, rotation handle state.
                          `singleRotationInput` state removed (session — property
                          bar cleanup, later session): confirmed zero references
                          in tattingindex.tsx before deleting — dead since the
                          single-element rotation control was rebuilt on
                          NumberStepper.tsx in an earlier session and this field
                          was never wired to it.
                          Session 58: currentTool starts as 'select' when the
                          toolbar is in Simple mode, 'pan' in Full
                          (getInitialToolbarMode). touchState also holds
                          worldX/worldY for the two-finger gesture. CRLF.
    useTattingOrder.ts    Tatting order mode state
    useProjectState.ts    Project/file state
                          Session 58: lastSavedHistoryIndex → lastSavedRev (see
                          "Unsaved changes — history edit numbers"). CRLF.
    useBeadState.ts       Bead, picot, thread state
    useViewState.ts       Visual settings state
                          Session 58: toolbarMode ('simple' | 'full') +
                          setToolbarMode (saved in localStorage
                          tcad_toolbar_mode), and the exported
                          getInitialToolbarMode() — decided once and stored:
                          fresh install → simple, existing user (any of our
                          localStorage keys present) → full. CRLF.
    usePatternState.ts    Core domain state (elements, picotConnections, materials…).
                          Obtained later session while chasing the history-reset bugs
                          (useHistoryActions.ts Addendum 5) — checked and ruled out as
                          a cause: history/historyIndex and everything else here are
                          plain useState, no custom persistence, merging, or debounce.
                          The actual bugs were in the effects/functions that USE this
                          state, not in the state hook itself.
    useHistoryActions.ts  Session 58: every pushed entry gets `rev` from a
                          module-level counter (nextHistoryRev) — see "Unsaved
                          changes — history edit numbers" under Rules.
                          pushHistoryState(els, conns, groups?, grids?) — reviewed directly
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

                          ADDENDUM 1 (session 52 — nearly repeated the exact mistake this
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

                          ADDENDUM 2 (later session — this pattern recurs even when the
                          audit isn't a project-side mistake): an external AI review of
                          useInputHandlers.ts standalone, without access to this doc,
                          flagged (as HIGH severity) that needsHistoryPushRef is never
                          set to true anywhere in that file, concluding undo must be
                          broken for every interaction there. Verified: correct that the
                          file only reads/resets the ref, never writes true to it — but
                          false as a bug claim, for exactly the reason this section
                          exists: the tattingindex.tsx auto-push effect is what sets it,
                          specifically when isInteractingRef.current is true at the
                          moment elements changes. useInputHandlers.ts sets
                          isInteractingRef.current = true at its 6 drag-start sites and
                          calls setElements during the drag — that's what trips the
                          parent effect. Two files correctly co-own the mechanism by
                          design; a file-only review has no way to see the other half.
                          Rejected as a false positive; no fix made. Third occurrence of
                          this exact misdiagnosis pattern now (useJoinActions.ts
                          historically, ~10 handlers earlier this session, now this) —
                          worth a one-line comment at needsHistoryPushRef's declaration
                          in useInputHandlers.ts pointing at the effect that actually
                          sets it, as cheap insurance against a fourth.

                          ADDENDUM 3 (same session as Addendum 2) — a real bug, different
                          shape from either addendum above: found in useInputHandlers.ts's
                          handleMouseUp, verified by tracing rather than by the (correct,
                          but under-specified) review finding that flagged it. Drawing a
                          new line and releasing before it reached a minimum length used
                          to produce TWO history entries instead of zero. Root cause was
                          ordering, not a missing guard: the explicit push (this section's
                          isInteractingRef && needsHistoryPushRef check) ran using
                          p.elements as it stood with the too-short line still present;
                          104 lines later, an unconditional cleanup filter removed any
                          line under 12 units — as a plain setElements call, with
                          isInteractingRef already reset to false by then, so the
                          auto-push effect picked it up as an ordinary second change.
                          Worse than the ordering issue alone: that cleanup filter wasn't
                          even scoped to the line just drawn — it scanned and filtered
                          EVERY line element on EVERY mouse-up regardless of tool or
                          gesture, so deliberately shrinking an EXISTING line below 12
                          units via handle-editing silently deleted it too, with no undo
                          path back (its removal was a separate, un-skippable auto-pushed
                          entry). Fixed by capturing which line (if any) this specific
                          gesture created and whether it's too short, BEFORE the explicit
                          push — skip the push entirely when it is; then scope the
                          removal to that one line by id (not a scan of all elements) and
                          set skipAutoHistoryRef first, same suppression convention as
                          Addendum 1/the rotation ghost-regen case. Net effect: a drawn
                          and abandoned line now leaves zero history entries, existing
                          lines are never touched by this path, and the per-mouse-up
                          scan only runs on the one gesture it's actually for.

                          ADDENDUM 4 (later session — the REAL answer to a user report
                          that Addendum 3's fix did not itself explain): "bend a line's
                          handle twice via the path tool, then undo, removes the whole
                          line" — not just the last edit. Static tracing of
                          useInputHandlers.ts/useHistoryActions.ts/useEditorActions.ts
                          alone did not reproduce it (see
                          useInputHandlers-review-verification-and-plan.md-adjacent
                          session notes); root cause only surfaced once temporary
                          console logging was added across the whole push/undo/redo
                          pipeline and the bug was caught live. The actual mechanism:
                          document.addEventListener('pointerup', ...) in
                          tattingindex.tsx (a safety net originally built for a
                          narrower case — a property-bar slider whose own drag never
                          reaches the canvas's onMouseUp) was firing on EVERY pointer
                          release, not just orphaned ones. Browsers dispatch
                          'pointerup' BEFORE 'mouseup' for the same physical release,
                          so this safety net was clearing isInteractingRef.current
                          before useInputHandlers.ts's own handleMouseUp (bound to
                          'mouseup') got to check it — meaning ordinary canvas drags
                          silently never pushed a history entry at all. No error, no
                          visible symptom until the NEXT undo landed further back than
                          expected, because the history stack genuinely had fewer
                          entries than the number of edits made. Fixed by deferring the
                          safety net's check by one tick (setTimeout(...,0)): since
                          'mouseup' fires synchronously right after 'pointerup', the
                          canvas's own handler now always resets the flag first in the
                          ordinary case, and the safety net only ever sees
                          isInteractingRef.current still true in the genuinely-orphaned
                          case it was built for.

                          The safety net's OWN orphaned-case recovery was also broken,
                          found while fixing the above: it only set
                          needsHistoryPushRef.current = true after clearing
                          isInteractingRef.current — but the only reader of
                          needsHistoryPushRef (this section's mouseUp check) requires
                          BOTH flags true together, so that combination could never be
                          read as true afterward. The flag-set did nothing; the orphaned
                          edit was still silently dropped, just via a different
                          mechanism than the race above. Fixed to push directly instead
                          — pushHistoryState(elementsRef.current,
                          picotConnectionsRef.current, roundsRef.current) — matching
                          the *Ref.current convention already used at every other
                          explicit push site in tattingindex.tsx, which also means the
                          effect stays mount-once ([] deps) rather than needing to
                          rebind the document listener on every drag tick for fresh
                          state.

                          ADDENDUM 5 (same session as Addendum 4) — a distinct bug,
                          found while investigating a related but separate report ("New
                          project, then redo, brings back a line from the previous
                          project"): confirmNewCanvas, tattingindex.tsx's separate
                          loadFromAutosave, and useProjectFile.ts's applyProjectData all
                          share the same shape — each resets `history` directly via
                          setHistory([{...one fresh entry...}]) while ALSO changing
                          elements/picotConnections/(sometimes)polarGrids in the very
                          same batch. That second change independently re-triggers the
                          auto-push effect, which reads roundsRef.current/
                          groupsRef.current (refs, one render stale relative to this
                          exact commit — their own "keep refs up to date" sync effect
                          hasn't run yet) and, for confirmNewCanvas specifically, the
                          real polarGrids state (deliberately hidden not cleared, by
                          design — see the "New Project" bug note elsewhere in this
                          doc). None of those match the literal reset object just
                          written to history, so the de-dupe check sees a "different"
                          state and pushes a spurious second entry. In confirmNewCanvas
                          this manifested as the undo button staying enabled on a brand
                          new, untouched project (both entries have empty elements, so
                          nothing was actually lost — just a confusing enabled button).
                          It's plausible, though not confirmed, that the same mechanism
                          — landing on one of these spurious near-duplicate entries at
                          just the wrong moment — is what produced the original "New +
                          redo brings back an old line" report, rather than a genuine
                          data-loss bug; the three fixes below eliminate the mechanism
                          either way. Fixed at all three sites the same way:
                          skipAutoHistoryRef.current = true immediately before the
                          state-changing calls begin, same convention as Addendum 1/3
                          and the rotation ghost-regen case. applyProjectData needed
                          skipAutoHistoryRef added to its params interface and threaded
                          through at the tattingindex.tsx call site — it wasn't
                          previously passed in at all.

                          METHODOLOGY NOTE: Addenda 4 and 5 were found via temporary
                          console.log instrumentation (prefixed [HIST]) added across
                          useHistoryActions.ts (every push, SKIPPED vs PUSHED), 
                          useEditorActions.ts (every undo()/redo() call and index
                          transition), useInputHandlers.ts (the explicit-push check's
                          inputs), and tattingindex.tsx (the ref-sync effect, the
                          auto-push effect's skip/commit branches, confirmNewCanvas,
                          and the safety-net pointerup effect) — not found by static
                          tracing alone, which had been tried first and came up empty
                          against these two specific bugs. All instrumentation was
                          removed once both root causes were confirmed fixed by the
                          user. Worth reaching for this earlier next time a
                          history-adjacent bug resists tracing: the mechanism has
                          enough moving parts (refs synced one render late, two
                          different physical-release events firing in a fixed but
                          easy-to-forget order, effects that fire once per commit
                          regardless of how many watched values changed) that a live
                          timeline of what actually fired, in what order, beats
                          re-deriving it from reading the code a fourth time.

                          STILL OPEN (deferred, not done): two more refs have the same
                          "held, reset only by a corresponding release event" shape as
                          isInteractingRef, and so the same theoretical vulnerability
                          Addendum 4 fixed — nudgeActiveRef (also gates the auto-push
                          effect, same as isInteractingRef — see the NumberStepper
                          "hold to repeat" comment near its declaration) and
                          isInteractingRef itself has one remaining gap: the pointerup
                          fix only covers "released elsewhere in the page," not
                          "mouse released outside the browser window entirely" (drag
                          off-screen, release over another app), which a document-level
                          listener can't observe. Both would need a proper flush (not
                          just a reset to false) to fix correctly, same complexity as
                          the safety-net fix above — deferred at user's request pending
                          confirmation the current fixes hold up. Separately, isShiftHeld/
                          spaceDown/zDown (keyboard modifiers, unrelated to history but
                          found via the same investigation arc) had the missing-reset
                          half of this same bug shape — see "Stuck modifier keys on
                          window blur" under Rules for that fix.
                          RESOLVED (session 56) — see "Losing window focus
                          mid-gesture" under Rules. Also: pushHistoryState now
                          takes 6 params (els, conns, rounds, grids, spatialGroups,
                          ghostArrays — the last two added sessions 44–46); the
                          optional ones carry forward from the previous entry when
                          omitted. The temporary [HIST] logging from Addenda 4–5
                          had in fact NOT been removed from tattingindex.tsx,
                          useEditorActions.ts, useHistoryActions.ts or
                          useInputHandlers.ts — all of it was removed in session 56.
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
                          Session 54: findDuplicateElements / cleanupDuplicates
                          (File menu "Clean Up Duplicates…", plus silent checks on
                          save/load via useProjectFile.ts). Session 56: group-aware
                          — see "Clean Up Duplicates" under Rules.
                          Session 56: the six align* functions are one
                          alignSelection(mode) ('left'|'right'|'top'|'bottom'|
                          'centerX'|'centerY'); the six names remain as one-line
                          wrappers. Output verified identical for all six.
                          Session 62: a system-clipboard paste runs
                          repairSplitRingSideABeads on each element.
    useInputHandlers.ts   handleMouseDown/Move/Up. Zero state-mirror ref reads.
                          Reviewed later session by an external AI (standalone, no
                          access to this doc or the checklist) plus independent
                          verification against the actual file before acting on any of
                          it — see useInputHandlers-review-verification-and-plan.md for
                          the full per-finding breakdown. Summary: review was mostly
                          accurate, missed one real bug it should have caught, and got
                          one HIGH-severity claim wrong for exactly the reason
                          useHistoryActions.ts's Addendum 2 above describes (don't trust
                          "needsHistoryPushRef never set true" as a bug without checking
                          the other file that sets it).

                          Fixed this session, in order:
                          - setElements/setSelectedIds typed too narrowly for how they're
                            actually called (updater-only vs value-only, but both call
                            shapes are used depending on site — setElements specifically
                            must accept a plain value at its two ghost-regen commit
                            sites, since regenerateGhostArrays is impure and can't safely
                            run inside a functional updater). Retyped both as
                            React.Dispatch<React.SetStateAction<...>>.
                          - setSelectedBEs had the identical bug (updater called at the
                            beading-mode box-select site, declared value-only) — not
                            caught by the external review; only surfaced once tsc
                            actually ran against real @types/react. Same fix.
                          - skipAutoHistoryRef was declared React.RefObject<boolean>
                            (read-only) despite being assigned to — the sole outlier
                            among this file's refs; every sibling, including
                            needsHistoryPushRef, is already MutableRefObject. Retyped to
                            match. Found while fixing the above, not part of the
                            original review.
                          - Redundant if/else in the 'select' tool's line-click handler,
                            both branches doing the same setSelectedIds call — collapsed.
                          - Short-line/history-ordering bug and its broader over-deletion
                            sibling — see useHistoryActions.ts Addendum 3 above for full
                            detail; fixed there, not repeated here.
                          - Quadratic-path support was asymmetric for the 'line' tool
                            specifically, even though the 'path' tool (which also edits
                            line-type elements, via isPathEditable) already handled
                            quadratic correctly a few lines away in the same file — ruled
                            out as dead legacy code precisely because of that sibling
                            block, not assumed either way. Three fixes: (1) line-tool
                            mousedown now captures pathDragStartRef for quadratic paths
                            too, mirroring the path-tool's existing branch; (2) the
                            shared line-handle-drag block was missing a 'control' case
                            for quadratic's single control handle (fell through to a
                            silent no-op) — added, mirroring the existing control1/
                            control2 branches; (3) that same block's start/end branches
                            were unconditionally injecting cubic-only control1X/Y or
                            control2X/Y fields onto ANY path type, corrupting a
                            quadratic path's data with stray unused fields while its
                            real controlX/Y went stale — gated both branches on
                            path.type === 'cubic'. Deliberately did NOT invent a
                            curve-shape-preserving repositioning formula for the
                            quadratic case (no existing precedent for the plain,
                            non-chain version of that problem in this file — the
                            quadratic formula that does exist elsewhere solves a
                            different, chain-specific stitch-length problem) — a
                            quadratic line's control point now simply stays put when its
                            endpoint moves, which is safe but may look visually
                            unbalanced; see the matching Pending refactor work row.
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
                          Session 62: applyProjectData runs repairSplitRingSideABeads
                          and quietly shrinks an over-size reference image
                          (shrinkReferenceImage, utils/refImage.ts).
                          Session 58: saveToPath records the saved history rev
                          BEFORE its awaits (getCurrentHistoryRev param), loading
                          sets lastSavedRev(0), load applies withChordCenter to
                          every element, and the no-camera fallback centres on
                          the canvas (canvasCenterOf) instead of the window.
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
                          RESOLVED (later session — see the "File load still opens
                          in realistic mode" row in Pending refactor work for full
                          detail). The session-52 fix above was real but masked by
                          a SEPARATE bug: the actual line in the file was
                          `setRenderMode(projectData.renderMode || 'schematic')`,
                          using the saved mode whenever present — not the
                          unconditional force the handoff believed was already
                          shipped. No third load path ever existed; both
                          `loadFromPath`/`loadProject` route through this same
                          `applyProjectData`. Fixed to unconditional
                          `setRenderMode('schematic')`.

                          skipAutoHistoryRef fix (later session — undo/history
                          investigation): applyProjectData has the identical
                          vulnerability found and fixed the same session in
                          tattingindex.tsx's confirmNewCanvas and
                          loadFromAutosave — see the useHistoryActions.ts entry's
                          Addendum 5 for the full mechanism. In short:
                          elements/picotConnections/polarGrids all change here in
                          the same batch as this function's own direct
                          setHistory([...]) reset, which independently
                          re-triggers the auto-push effect using stale
                          roundsRef.current/groupsRef.current — pushing a
                          spurious duplicate history entry right after a project
                          loads. Fixed the same way: skipAutoHistoryRef.current =
                          true before the state-changing calls. Required adding
                          skipAutoHistoryRef to this file's params interface and
                          threading it through at the tattingindex.tsx call site
                          — it wasn't previously passed in at all.
                          CORRECTION (session 56): the above was described as done
                          but was NOT in the files — applyProjectData had no
                          skipAutoHistoryRef, tattingindex.tsx didn't pass one, and
                          loadFromAutosave didn't set it either. All three fixed in
                          session 56. Also session 56: the first history entry
                          after a load now holds migratedElements (not the raw file
                          elements), so undoing all the way back no longer restores
                          pre-migration data; the temporary [load] console logging
                          was removed. Session 54: saveToPath and applyProjectData
                          call cleanupDuplicates({ silent: true }) (load passes
                          elementsOverride: migratedElements). exportSVG clones the
                          live canvas <svg>, so in realistic view it exports what's
                          on screen (no hidden schematic layer since session 56).

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

**Exception — Expand** (session 60): `expandRepeatGroups` writes the groups out
in full, so its result must NOT go through `autoCompact` (or through
`transformSides` / `applyToSides` in GeneralElementPropertyBar, which call it) —
that would group it straight back. It has its own `expandResult()` there.

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

Translation files are currently at **799 keys** in en, **797** in hu/es
(session 63 added `loadWarnDamagedElements`, `fileChangedTitle / Body /
Overwrite`, `autosaveNoImage`, `autosaveFailed`, `resumeImageMissing`,
`fileTypePattern / Svg / Theme`, `picotWizardInvalid`, and removed 4 unused
`picotWizard…` keys — es/hu by Claude, user to check; before that counted in session 62: 792 / 790; hu/es lack only the two `_comment_folded_picots` /
`_comment_cleanup_duplicates` notes; the `src/i18n` and `public/` copies are
identical). Session 62 added `resumeBeforeOpenTitle/Body/Open/Resume` and
`refImageReduced`, and reworded `picotWizardUnsupported` (es/hu by Claude —
user to check). Session 58 added 30 keys to all three
(`toolLabel*`, `toolbar*`, `hint*`, `windowTitleUntitled`) and removed the
unused `propEndAllowanceCurrent` from hu/es (en had dropped it in session 57).

### Translation fallback chain
`t(key)` resolution order:
1. `extraTranslations[currentLanguage][key]` — external JSON for current language
2. `TRANSLATIONS[currentLanguage][key]` — any remaining hardcoded strings
3. `extraTranslations['en'][key]` — bundled `translations_en.json`
4. `key` itself — last resort, visible to user as a string

**Session 60:** `translations_es.json` and `translations_hu.json` are
bundled too (static imports in tattingindex.tsx, `_` comment keys dropped).
For each language the manifest lists, the bundled copy goes in first and the
`public/` file merges over it key by key. So a `public/` file from an older
version can't hide new keys (they used to fall back to English — reported
for the setup screen), and wording changed in `public/` still wins. Keep
`src/i18n/` up to date: it is now the fallback for es/hu as well as en.

`translations_en.json` is loaded unconditionally at startup before any manifest check. The `public/` copy of `translations_en.json` merges over it (allowing overrides) but cannot break the fallback since the bundled file is always loaded first.

**Correction (session 60, tested on an installed Linux build):** "external"
here means the files in `public/`, which are packed INTO the app at build
time. The installed app never reads translation, `languages.json`, help,
sample or `tatting-theme.json` files from disk: `fetch('./…')` is answered
from the copies inside the executable. The copies that `bundle.resources`
installs next to the program (`_up_/dist/*.json|md|html`) are not read by
anything — a fake extra language added there did not appear. Adding or
changing a language = edit `public/` + rebuild — OR, since session 60, the
user languages folder (next section).

### User languages folder (session 60)

`tauri/userLanguages.ts` — the one place the installed app reads language
files from disk: `appDataDir()/languages/` (not Documents: reading it makes
macOS ask permission at every start). Desktop app only (`isDesktopApp()` —
Tauri and not Android/iOS); the browser and Android skip it.
- `readUserLanguages(builtInCodes)` → `{ manifest, files, errors }`:
  `languages.json` (codes checked: 2–3 letters, optional region) adds or
  renames languages; `translations_<code>.json` for every built-in + added
  code; `_` keys dropped; never throws.
- Start-up (tattingindex.tsx, loadTranslations): read right after the
  built-in manifest, BEFORE the language is chosen (a saved user language
  must not reset to English); manifest = built-in ∪ user; Step 3 merges each
  user file over bundled + public texts key by key. Capped at 3 s
  (Promise.race). Errors → `userLangErrors` state → one toast once texts
  exist (`userLangFileErrors`).
- Options → `optionsUserLanguages` → `openUserLanguagesFolder(enStrings)`:
  mkdir, `README.txt`, `translations_TEMPLATE.json` (the English file as
  shipped, order + `_comment` keys kept; rewritten every time), then
  `plugin:opener|open_path`; if that fails → toast with the path
  (`userLangFolderReady`).
- Permissions (src-tauri capabilities/default.json): `fs:allow-mkdir`
  `$APPDATA`, `$APPDATA/**`; `opener:allow-open-path` `$APPDATA/languages`,
  `…/**`. Reading uses the existing read/exists `**` permissions.
- Tested in a real Linux build (see handoff item 23).

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

**Session 63 (review #5):** New Project also clears the notes, the reference
image (+ its settings, back to the app-start default), the group registry
and the ghost-array registry — they used to carry over into the new file.
Background, thread size / preset, grid and bead library stay (the user's
working setup).

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
always force `'schematic'` on load. RESOLVED (later session) — see the
"File load still opens in realistic mode" row in Pending refactor work and
the useProjectFile.ts catalog entry above for the actual root cause (a
different, masking bug in the same function, not a third load path).

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

### Stuck modifier keys on window blur (later session)

**Bug: "ortho lock is basically always on."** `isShiftHeld` (and, same root
cause, `spaceDown`/`zDown`) is set `true` on `keydown` and `false` on
`keyup`, both via `window` listeners — but nothing reset it if the window
lost focus while the key was physically still held (alt-tab, an OS shortcut
stealing the key release, dev tools taking focus, etc.). The `keyup` for
Shift then never reaches the page, and `isShiftHeld` sticks at `true` for
the rest of the session — permanently axis-locking every drag afterward
via the `orthoLock || isShiftHeld` check in useInputHandlers.ts, with the
ortho-lock toolbar button not even showing as active, since `orthoLock`
itself was never touched. Fixed with a `window` `blur` handler that resets
all three flags (`isShiftHeld`, `spaceDown`/`spaceDownRef`,
`zDown`/`zDownRef`) whenever the window loses focus. Session 61: the same
handler resets `isRotateKeyHeld` (hold R = rotation handles).

This is the same underlying bug shape as useHistoryActions.ts's Addendum 4
(`isInteractingRef`/`pointerup` vs `mouseup`) — a flag that's supposed to be
transient, held only between a down-event and its matching up-event, with
no fallback if the up-event doesn't arrive. Worth checking any NEW such
flag against this pattern before assuming a `keydown`/`keyup` (or
`mousedown`/`mouseup`) pair alone is sufficient.

---

### Realistic view — what renders, and the bake cache (session 56)

**What draws what in realistic view:**
- Baked SVG (`bakeRealisticView`, render/realisticRenderer.ts): stitches,
  picots, cjp arms, line elements.
- Live JSX in tattingindex.tsx, on top: picot join lines, fold arcs,
  bead/BE picots (their own "realistic overlay" pass).
- Hidden in realistic view (`renderMode !== 'realistic'` guards): square
  grid, polar grid guides (since session 57), reference image, snap
  indicators, group boxes.
- **Not drawn:** the whole schematic element layer (the
  picotJoin/beading dim-overlay `<g>`). It used to stay mounted at
  opacity 0, so every element's schematic paths, notation labels, order
  badges and split-ring arrows were still built invisibly. It is now
  wrapped in `renderMode !== 'realistic' && (...)`. Nothing in realistic
  mode depended on it (verified: beads, joins and folds all render from
  outside that group). The split-ring direction arrow therefore doesn't
  appear in realistic view — intended.

**Bake cache.** `handleSetRenderMode` only switches mode; a `useEffect`
does the baking. It re-bakes only when one of the five bake inputs has a
new reference — `elements`, `picotConnections`, `dsWidth`, `materials`
(read via getElementColor), `dmcColors` (gradient stops) — compared
against `bakedInputsRef`. All five are immutable state, so `===` is an
exact "did anything change". Consequences:
- leaving realistic view keeps the bake; coming back with no edits is
  instant (no spinner);
- edits made *while* in realistic view (Ctrl+Z, Delete, Ctrl+V) now
  re-bake — they used to leave a stale image;
- entering with a stale bake blanks it first (spinner via
  `enteringRealisticRef`); in-view re-bakes keep the old image until the
  new one is ready (no flash);
- the bake reads fresh state from the effect's closure — the old inline
  bake ran from `handleSetRenderMode`'s closure, which was stale when
  called from the mount-once keydown listener (V key);
- undo restores deep clones (new references), so undoing back to a
  previously baked state re-bakes once — harmless.

If a new input ever affects the bake (e.g. a new theme value read inside
`bakeRealisticView`), add it to both the effect's deps and the
`bakedInputsRef` comparison, or the cache will show stale output.

### Single-element thread ribbons (session 56)

Convention for anything drawn as "thread with a black outline" in realistic
view: ONE closed, filled shape — the centreline offset ±lineWidth/2 into a
band, `fill=<thread colour>`, `stroke="black"`, `stroke-width 1.5`,
`stroke-linejoin round`, `paint-order="stroke"` (outline painted first, so
only its outer half shows). Started with picots (`emitPicot`,
realisticRenderer.ts); session 56 applied it to:
- **realistic picot joins** (tattingindex.tsx): 2-picot join = one
  straight ribbon A→B; 3+ picots = one rectangle per spoke to the
  centroid as subpaths of the same path (fill covers the inner outline
  edges where spokes overlap; the existing centre dot covers the notches).
  Was 2 `<line>`s per picot (4 shapes for a normal join).
- **fold arcs** (tattingindex.tsx, both views — the fold code is shared):
  one ribbon per arc via `ribbonFromPoints(sampleCubicD(d))`; the two arcs
  stay separate elements so the smaller-under-bigger paint order still
  works. Was 4 shapes per fold.
- **line elements in the bake** (realisticRenderer.ts). Schematic lines
  are unchanged (still outline + colour).
Ends are flat (like picots), not round. Helpers in tattingindex.tsx:
`ribbonFromPoints(points, halfWidth)` (central-difference normals) and
`sampleCubicD(d)` (parses the single-cubic `M … C …` string
buildFixedFeetArcD produces; returns [] for anything else).

### Clean Up Duplicates (sessions 54 + 56)

Logic in useEditorActions.ts (`findDuplicateElements`,
`cleanupDuplicates`); File-menu entry and wiring in tattingindex.tsx;
silent checks on save/load in useProjectFile.ts. Session 54 built the
logic and the useProjectFile hooks, but the three tattingindex.tsx wiring
points were lost and only re-applied in session 56 (from a recovered
session-54 copy of the file — see "Version drift").

- **Duplicate** = same notation, notationB, materialId, materialIdB,
  rotation and centre position (`duplicateSignature`). groupId is not part
  of it. Ghosts are never candidates; ghost mothers (and groups containing
  one) are never removed.
- **Pass 1 — whole groups (session 56):** groups whose members match
  one-to-one by signature (a group stacked on a copy of itself) are
  compared as units; one complete group is kept, the others removed
  whole. Previously the per-element pass could keep members from both
  copies and leave two half-deleted groups.
- **Pass 2 — single elements**, over whatever pass 1 didn't remove.
- **Which copy is kept:** most joined picots (summed for a group); tie →
  for single elements, one inside a group beats a loose one (user
  decision, session 56); still tied → earliest in the elements array.
  Array order is the only proxy for "older" (ids are random UUIDs) and
  Send to Back / Bring to Front change it.
- **Commit (session 56):** computed from refs at confirm time, committed
  as plain values with an explicit push (`skipAutoHistoryRef` + one
  `pushHistoryState` incl. spatial groups) — one undo step. Groups left
  with 0–1 members lose their groupId and registry entry (same tidy-up as
  ungroupSelected). Picots on the far side of a removed connection have
  isJoint cleared unless still in another connection.
- Duplicate *arrays* are not handled — ghost arrays are benched.

### Batch notation edits — applyNotationToMultiple (session 56)

`applyNotationToMultiple(ids, notation | null, notationB | null = null)` in
tattingindex.tsx applies one notation to several elements (the free
multi-select notation box). Each target goes through
`computeElementAfterNotationEdit` — the same per-element code as a single
edit — so joins are kept where picots still match (by kind-sequence or
stitchesBefore), split rings / chains / ghost mothers are handled. `null`
for either notation keeps each element's own (B-box edits pass
`notation = null`). If any joins would be lost, ONE confirm for the whole
selection (`notationChangeConfirm*` keys); then exactly those connections
are removed and the far-side picots demoted via `applyJointFlags` —
applied after the edited elements are swapped in, so a far side that is
itself in the selection is still reached. One commit, one undo step.

Not the same as `updateNotationForMultiple` (Picot Wizard batch Scale):
that one only accepts `preservesExistingPicots: true` edits and skips
ghost mothers.

### Losing window focus mid-gesture (session 56)

Closes both "STILL OPEN" items from useHistoryActions.ts's Addendum 4
(except one NumberStepper detail, below). In tattingindex.tsx:
- **window `blur` → flush** (mount-once effect, after useInputHandlers):
  1. if a canvas drag is in progress (`dragOffsetRef.active` or
     `isInteractingRef`), finish it through `handleMouseUpRef.current(null)`
     — the same call the touch handlers use — which commits a translate
     drag's offset and pushes history normally;
  2. if `isInteractingRef` is still true (e.g. a property-bar slider),
     clear it and push directly;
  3. if `nudgeActiveRef` is true (NumberStepper hold-to-repeat), clear it
     and push.
- **document `pointerup` safety net** (existing, deferred one tick): now
  also flushes a stuck `nudgeActiveRef`, after the stepper's own final
  commit has had its chance.
User-tested: drag + Alt+Tab, ±1° hold + Alt+Tab, squeeze slider + Alt+Tab
— each leaves exactly one correct undo step. Not covered:
**NumberStepper.tsx** — session 62 review: the file is in the repo and
already ends a hold on window blur (`blurListenerRef`); nothing left to do.
**Session 63 (review #10):** the hold-to-repeat buttons use POINTER events
(`onPointerDown` primary button only / `onPointerUp` / `onPointerLeave` /
`onPointerCancel`). They listened to touch AND mouse events, and a tap on a
touch screen fires both (touchstart + the browser's follow-up mousedown):
one tap stepped twice and left two undo steps. A press already running is
never restarted. Tested with touch emulation (tap 10 → 11, one undo step;
1 s finger hold repeats, one undo step) and a mouse (click, hold).

### Ghost arrays — benched (session 56)

User decision: ghost arrays stay in the app as an experimental feature and
get no further work for now. Parked because of this: the possible dropped
connections when an array shrinks (pending-work table) and duplicate-array
detection in Clean Up Duplicates. Code that already handles ghosts/mothers
(regeneration, deleteSelected's cascade, applyNotationToMultiple's
mother regen) is left as-is.

### Version drift found in session 56 — check files, not docs

Several fixes that handoffs/this doc described as done were not in the
files actually in use: the session-53 debug logging was still everywhere,
two of three `skipAutoHistoryRef` load-path fixes were missing, and the
session-54 Clean Up Duplicates wiring had never reached tattingindex.tsx
(its logic and translation keys had). Cause: the working tattingindex.tsx
was built from a mid-session copy, and later sessions edited on top of it.
Practice from now on: when picking up a "done" item, grep the actual file
for it before trusting the doc; when handing off, state which exact file
versions were delivered.

### End allowance — stored per element (session 57, steps 2–3)

- `el.endAllowance` (ds) is stored per element; absent = 0. It is not a
  global setting, because paths are stored as geometry. Saved and copied
  with the element. **Any code that builds an element from an explicit
  field list must copy it** (today only `createPolarInstance`'s ghost
  branch).
- The default for new elements comes from the active thread preset:
  `presetEndAllowance(preset)` (stitchGeometry.ts) gives 1 when missing,
  clamped 0–5. It's edited in Thread Properties → "Element Ends".
- File `version` 91 marks files that may carry the field (not read on load).
- `duplicateSignature` includes it.
- **Live since step 3.** `getEndAllowance` returns the stored value for
  chains, split chains, teardrop rings and split rings (0 for circles, JKs,
  lines — `allowsEndAllowance`). addRing/addSplitRing/addChain stamp it
  from the preset (`defaultEndAllowanceRef`) and build the longer path.
  Split rings get `SPLIT_RING_END_ALLOWANCE_FACTOR` (0.25) × the preset
  value. It's applied at creation and stored, so it never changes existing
  elements.
- **INVARIANT: any code that builds or resizes a path from the stitch
  count must use `elementPathLength(el, dsWidth)` (or pass the allowance
  to `createSplitRingPath`), never `stitchCount * dsWidth`.** The only
  remaining raw `stitchCount * dsWidth` are circle radii (allowance always
  0) and Convert to JK (sets `endAllowance: 0`). When toggling shape or
  editing notation, measure on the element as it will be *after* the
  change (eligibility can change).

### Stitch → path position — shared helpers (session 57, end allowance step 1)

Groundwork for the element end allowance (design in handoff-session56.md:
bare, unstitched thread at each path end of chains, teardrops and split
rings). All "where along the path is stitch position s?" maths goes through
geometry/stitchGeometry.ts:

- `stitchRunFraction(s, count, a)` = (s + a) / (count + 2a): the fraction of
  one stitched run's path at stitch position s, with `a` ds of allowance at
  each end. a = 0 gives the old s / count bit-for-bit.
- `elementStitchFraction(el, s, onSideA?)`: fraction of the element's whole
  path (all `el.paths` end to end). For split rings, side B is offset by
  side A's two allowances: (s + a or 3a) / (N + 4a).
- `splitRingSideFraction(el, localS, count)`: fraction of one split-ring
  side's own path.
- `getEndAllowance(el)`: the stored per-element value for chains, split
  chains, teardrop rings and split rings (circles, JKs and lines always 0)
  — live since step 3; see the next section.

They return a fraction of the path, not a point. Each call site keeps its
own fraction → point method, because those differ and unifying them would
move things (see "Known differences" below).

**Routed through the helpers:**
- tattingindex.tsx: getPicotPosition (snap, hit-test, join lines, fold
  feet), renderPicots (split ring + path branches; beads ride on it),
  renderStitchLabels (all four non-circle branches).
- realisticRenderer.ts: calculatePathStitches, calculateSplitRingStitches,
  renderWedgePathShapes (new `endAllowance` param: samples (count + 2a) ds,
  slices start a ds in), picotSVG (regular + cjp), split-ring picots.
  The picot gap is clamped in stitch space (0..N) before mapping, so it
  never reaches into the allowance.

**Deliberately NOT routed through them:**
- Gradient colour positions (`position`, `tMid`, getPicotPositionFraction).
  These are stitch progress (s / N), and the allowance must not shift
  colour.
- Circles / JKs: they keep getCircleStitchAngle and never get an allowance.
- Stitch count → path LENGTH (`stitchCount * dsWidth`). These sites need
  step 3 decisions, listed in handoff-session57.md.

**Verified:** old vs new realistic bake was byte-identical on 210 bakes
(random chains, teardrops, split rings, circles, beads, cjp, joins, flips,
3 dsWidths). getPicotPosition, renderPicots and renderStitchLabels were
extracted by AST from old and new tattingindex.tsx and compared on the same
elements: 1,954 results, 0 differences. Mutation check (allowance forced to
1): 174/210 bakes and ~78% of schematic results change, so the harness can
see the helper. The tsc error set is unchanged.

**Known differences that already existed (not changed):**
- getPicotPosition and schematic renderPicots (chain/teardrop branch) map a
  path-length fraction straight onto bezier `t` within the segment. Labels
  and the whole realistic renderer walk true arc length. So schematic and
  realistic picot bases can sit slightly apart on strongly curved segments.
- For split rings, getPicotPosition uses the concatenated A+B path while
  renderPicots uses each side's own path. They agree to within the split-ring
  solver's tolerance. With the helpers both stay consistent once the
  allowance is on.

### Tension — the user-facing name (session 57)

The UI never says "end allowance" or "ds". It shows **Tension 1–5**
(decimals OK; 1 = 0 ds tightest, 5 = 3 ds loosest, linear — doubled
from 1.5 late in session 57;
`tensionToAllowance` / `allowanceToTension` in stitchGeometry.ts). Storage
stays in ds (`endAllowance` on presets and elements), so the scale can be
re-tuned without touching saved geometry. Default tension 3 (1.5 ds): `DEFAULT_TENSION` is the single
source; all three DEFAULT_THREAD_PRESET copies read DEFAULT_END_ALLOWANCE.
The button is "Tension"; translation key names still say EndAllowance.

### Apply end allowance, and resizing helpers (session 57, step 5)

- "Ends" button (single, multi, group bars) → `applyEndAllowanceToIds`
  (tattingindex.tsx) → `resizeElementForAllowance` (paths.ts, pure).
  Teardrop: `scalePathsAboutPoint`. Chain: `rebendChainPathToLength`
  (multi-path: proportional share). Split ring: `rebuildSplitRingInPlace`.
  One commit/undo step; ghost mothers regenerate.
- `scalePathsAboutPoint` and `rebendChainPathToLength` are THE resize code
  for notation edits too (moved verbatim out of
  computeElementAfterNotationEdit, verified identical).
- **`rebuildSplitRingInPlace` is the correct way to rebuild a split ring
  that already exists.** It takes frame and mirror state from the existing
  side-A arc. The older field-based rebuild
  (`applyRotationToPathData(el, createSplitRingPathFromEl(el))`, used by
  squeeze sliders / rotatePathsAroundCenter; Reset and notation edits apply
  no rotation at all) was wrong for flipped split rings. **FIXED end of
  session 57:** squeeze sliders, notation edit, rotation handle and
  rotatePathsAroundCenter all use it now; flipElements also swaps
  squeezeCA/CB; Reset clears isFlippedH/V for split rings. **Rule: never
  rebuild an existing split ring with
  `applyRotationToPathData(createSplitRingPathFromEl(...))`.** The only
  remaining direct `createSplitRingPathFromEl` use on an existing ring is
  Reset (upright by design). Flip also swaps materialId/materialIdB (when
  they differ), so colours stay with their arcs (user decision).

### Realistic stitches inside the line; chains have no tension (session 57)

- (Refined later in session 57: the realistic stitches' *visible* outer
  edge, outline included, is matched to the *visible* outer edge of the
  3.75-wide schematic stroke via `offsetBasePadding(dsWidth)`, not to the
  line's centre. Keep `SCHEMATIC_STROKE_WIDTH` in realisticRenderer.ts in
  step with the schematic strokeWidth="3.75".)
- Realistic view: the schematic line is the OUTER edge of the stitches
  (`OFFSET_BASE_PADDING` = 0 in realisticRenderer.ts; the symbol's outer
  edge is exactly 0.125 × dsWidth inside the offset). Stitches lie on the
  side away from the picots. Don't reintroduce an outward padding without
  re-checking rosettes and chain–ring–chain joins (mock-ups listed in
  handoff-session57.md).
- `endAllowanceFactor(el)` (stitchGeometry.ts): the fraction of the preset
  allowance a shape gets: rings 1, split rings ¼, chains 0. It's used when
  creating elements and by the "Tension" button. Chains remain *eligible* in
  `allowsEndAllowance`, so older chains with a stored value stay geometrically
  consistent.
- Polishing items (narrow rings, teardrop tip, rosette hole) are in
  handoff-session57.md.

### Tension stepper (session 57, replaces the step-5 apply button)

`components/TensionStepper.tsx` (single, multi and group bars) shows the
selection's tension and calls `setTensionForIds` (tattingindex.tsx). That
writes the active thread preset (becomes the default, like the last-picked
material) AND resizes the eligible selected elements via
`resizeElementForAllowance` × `endAllowanceFactor`: one commit, one undo
step. `tensionInfoForIds` gives the value shown or "mixed". NumberStepper has
`mixedText` and `title` props for it.

### Realistic picot lengths (session 57)

`PICOT_TIP_LENGTH_DS` (realisticRenderer.ts): sp 0.7 · p 1.2 · lp 2.0 ds
(was 1.2 / 2.0 / 3.2; shortened after the stitches moved inside the line).
These are realistic view only; the schematic uses `PICOT_SIZE`.

### Arrow-key nudge (session 57)

Arrow = 1 canvas unit, Shift+Arrow = 1 ds. It has its own listener in
tattingindex.tsx (after the window-blur flush), calling through
`arrowNudgeRef`/`arrowNudgeEndRef`, which are reassigned every render. A
hold = one undo step via nudgeActiveRef (set before the first move, cleared
plus one explicit push on key-up; no skipAutoHistoryRef because nothing
changes after that push). It moves like a mouse drag, incl. ghost-array
regeneration. Skipped for form-control focus, realistic view, the special
modes and mid-drag.

### Tool rail and phone bottom bar (sessions 58–59)

The left toolbar is no longer a floating box on the canvas. It is a fixed,
full-height strip, `<aside class="tool-rail">` (logo on top, tools below in
`.tool-rail-body`, which scrolls only when the screen is too short).
Everything else is pushed right by padding on `.app-root` (the outermost div):
`padding-left: var(--rail-w)`. The rail JSX still sits where the old toolbar
was (inside the canvas container); position: fixed makes that irrelevant.

`--rail-w` depends on screen shape only — since session 59 Simple and Full
have the SAME width, so switching never moves the canvas sideways (CSS block
"Tool rail (session 58)" in the `<style>` of tattingindex.tsx; all include
`env(safe-area-inset-left)`). `rail-simple` / `rail-full` classes are still on
`.app-root` (used by a few sideways-phone label rules), not for width:

| Screen | Rail width (Simple and Full) |
|---|---|
| Desktop / tablet | 120 px (was 150 until the zoom buttons became two rows) |
| Large UI (desktop only) | 136 px (grid `zoom: 1.12`; was 188 / 1.25 — too big) |
| Phone sideways (height ≤ 500) | 112 px |
| Phone upright (width ≤ 768 and height > 500) | 0 — bottom bar instead |

**Full mode layout (session 59):** every icon centred (`fullIcon`); the
2-column buttons show icon + short label (`fullWide`): Join
(`toolLabelJoinShort`), Beads (`toolLabelBeadsShort`), Delete, Ref. img.
(`toolLabelRefImageShort`), Notes. No label clipped in en / hu / es.

**Large UI text (session 59):** `.ui-large { font-size: 17.6px }` on the
app root does NOT scale rem-based Tailwind text (rem = the html element's
size) — so Large used to grow the controls but not the text. Large text
sizes are now px: property-bar inputs 18 px (Normal 14), buttons/selects/
text-sm 17 px, labels/text-xs 15 px (12), top-row words 17 px (14), rail
labels 13 px × zoom 1.12. Bar height unchanged (104 px).
Large top-row buttons are 50 px (were 56): the row stays on one line down
to 1366 px wide (it wrapped below ~1600 before); at ≤ 1280 it still wraps
(Normal wraps at 1024, as before).

**Large UI and the property bar (session 59):** Large keeps its bigger
controls (2.5rem) but uses `row-gap: 0.25rem` and 0.3rem top/bottom
padding, so two rows still fit the normal 6.5rem (104 px) bar — measured
104 px empty / chain / ring / multi-select at 1366–1920 wide (was 122–124
with a ring or chain selected).

Simple mode's Zoom out / Zoom in are two labelled rows (not a side-by-side
pair — that pair set the old width). Measured: at normal size the rail fits
1280×720 … 1920×1080 in en / hu / es with no scrolling and no clipped label
(long hu/es labels wrap to two lines). Large scrolls a little on ≤ 768 px
tall screens (≈ 60 px en, ≈ 100 px hu/es) — accepted.

To keep the wider Full rail from wrapping the top row at ~1280 px, the top
row's column gap is halved between 769 and 1439 px wide (this also unwrapped
Simple at 1280×720). On screens 501–800 px tall the rail buttons' vertical
padding is trimmed to 0.3rem so every tool fits (checked: 1280×720,
1366×768, 1024×768 — no rail scrolling in either mode).

Upright phone = `(max-width: 768px) and (min-height: 501px)`. There the rail
is `display: none`, `.phone-toolbar` (PhoneToolBar.tsx) shows, and
`.app-root` gets `padding-bottom` for the 58 px bar (+ safe-area inset).
Both are always rendered; only CSS chooses.

- **Logo:** `public/app-icon_sm.png` (~200 px square; Vite serves `public/`,
  not the project root). Hidden via onError if missing. Tooltip "TattingCAD
  {APP_VERSION}"; no click action. Session 59: sized by max-width (rail − 16
  px) and max-height (100% of the logo area) only, keeping proportions, so
  any shape fills the area — the branded logo (icon + "tatting CAD" text,
  taller than wide) shows at ≈ 104 × 148 px (Normal). (An earlier 72 px cap
  for the old square logo was removed.) It sits in a logo area exactly as tall as the header (top row + property bar), so the first
  tool lines up with the top of the canvas. The header height is measured by
  `observeHeaderHeight` (module-level callback ref + ResizeObserver, just
  above `TattingDesigner`) and published as `--header-h` on `.app-root`; it
  follows the top row wrapping and the property bar growing. Sideways phones
  keep the small 30 px logo with no alignment (height is too scarce).
- **The old floating-toolbar CSS is gone:** `.toolbar-scalable-left`
  transform scales (6 media rules + 3 ui-large rules) and
  `.mobile-toolbar-compact`. Don't reintroduce transform scaling for the rail;
  it doesn't shrink the layout box, which is what made the old toolbar
  overflow on short screens.
- **Top row on upright phones** (session 59): TopMenuBar renders a ☰
  button (`.tmb-phone`, shown only under `(max-width: 768px) and
  (min-height: 501px)`) and marks File / View / send-to-back /
  bring-to-front / Fit All / Arrange / Options / Help and the dividers
  `.tmb-desktop` (hidden there). Undo, Redo, Copy, Cut, Paste, Delete stay —
  always visible (user: paste must work with nothing selected). ☰ opens the
  phone menu (tattingindex.tsx, `showPhoneMenu`): File › View › Arrange ›
  Options › Help & Info ›, which open the existing dropdowns, then Bring to
  front, Send to back, Show all. `menuAnchor(ref)` makes the five dropdowns
  hang under the ☰ button on an upright phone (their own buttons are
  hidden). Checked 360 / 390 / 768 px upright: one line, no overflow.
  **Not only phones:** the compact ☰ row applies whenever the full row
  would wrap — `(max-width: 1139px) and (min-height: 501px)`, Large up to
  1274 px (measured: without separators the full row fits one line from
  1140 px Normal / 1275 px Large; it was 1190 / 1320 with them). **The top
  row has no separators any more** (`.top-row-buttons .w-px` hidden — user;
  they cost ~50 px). The property bar has its own, wider limit (its labels):
  in 769–1199 px windows (Large up to 1359) it drops its small labels and
  uses the phone overlay (fixed 6.5rem slot, bar laid over the canvas when
  it needs more rows). The two limits are deliberately separate. Result: header
  165 px (Large 171) at every width ≥ 769 — it was up to ~300 px there
  (user screenshot: a window just over 768 px). `menuAnchor` uses the same
  widths. Sideways phones (height ≤ 500) keep their one-line icon row.
- **One tool list for both** (session 59): the descriptors `phoneTools` in
  tattingindex.tsx (just before the main return) define every rail / phone
  tool once — label, optional `shortLabel`, tooltip, icon, action,
  active/disabled. Layout-only lists pick from them: `phoneMainTools` /
  `phoneMoreTools` (phone bar) and `railSimple` / `railFull` /
  `railRealistic` (rail, rendered by `renderRailEntry`: a tool, optionally
  wide / labelled / with an inline label, a divider, a side-by-side pair, or
  the Simple ↔ Full text link). **Add or change a tool in `phoneTools`, then
  place it in the layout lists.** Two behaviour changes from unifying: Delete
  in the rail is now also disabled when nothing is selected (as on the
  phone); the Reference image toggle returns to Select in Simple and Pan in
  Full everywhere (the phone bar always went to Select before).
- **Phone bottom bar contents:** main row Select · Pan · Ring · Split ring ·
  Chain · Join (+ More). "Join" is `toolLabelJoinShort` (the row uses
  `shortLabel` when set; the More panel and rail use the full label). Row
  labels may wrap to two lines (line-clamp) rather than being cut with "…". More panel: Delete, Show all, Zoom −/+,
  Reference image, Notes, "More tools"; in Full mode also every Full tool and
  "Simple". Realistic view: Pan + zoom + Show all, no More.
- **Shared toggles:** `togglePicotJoinMode` and `toggleBeadingMode` (defined
  next to flipElements) are used by the rail, the phone bar and the hint.
  Shift+J keeps its own variant (also clears fold state).
- **Canvas centring:** anything that centres the view must measure the canvas,
  not the window (the canvas starts right of the rail and under the header).
  `canvasCenterCamera()` (tattingindex.tsx) is used at app start (a mount
  effect re-centres after usePatternState's window-based initial camera), New
  Project and the autosave fallback; `canvasCenterOf(canvasRef)`
  (useProjectFile.ts) for the file-load fallbacks. `getViewportCenter`,
  `screenToWorld` and touch handling already used the canvas rect.
- **Phone clean-up:** `.info-bar` (status bar) hidden on phones (width ≤ 768
  or height ≤ 500). The property bar sits in a `.prop-bar-slot` wrapper
  (session 59). On phones the slot has a FIXED height (6.5rem upright, 4.5rem
  sideways) so selecting/deselecting never moves the canvas, and `.prop-bar`
  is absolutely positioned inside it (z-index 25, own background + shadow),
  growing down OVER the canvas when a selection has more settings (a ring:
  ~170 px upright, ~133 px sideways). Nothing scrolls inside it any more, so
  Shape / Squeeze / Material are visible and the colour / material pop-ups
  (absolute, inside the bar) aren't clipped. Menus (z-50), the More panel
  (31) and its backdrop (29) stay above it. On desktop/tablet the slot is an
  inert div.
  Sideways phones: top row on one line (icons only, scrolls sideways).

### Colour theme — every indicator colour (session 59)

`DEFAULT_THEME` (hooks/useViewState.ts) now holds **every on-canvas
indicator colour** (17 keys before, ~70 now), grouped with comments: warning
glows, selection, markers, beads, array previews, ruler, fold line, Tatting
Order, stitch-count labels, thread outline, Path Edit guides, grid lines.
Default values are exactly the colours that were hard-coded before (checked:
six canvas scenes pixel-identical to the pre-change build, and identical
again when the full template `tatting-theme.json` is loaded).

- **Loading:** unchanged — `tatting-theme.json` next to the app (fetched at
  start) or Options → load theme. Only keys present in DEFAULT_THEME are read;
  values are any CSS colour text (hex or rgba). A new key added to
  DEFAULT_THEME is therefore automatically loadable.
- **Round colours** are one key, `orderRoundColors`:
  `"fill/outline, fill/outline, …"` (hex only — rgba's commas would break the
  split). Parsed by `parseRoundColors` (utils/roundColors.ts) into
  `roundColors` (memo right after useViewState in tattingindex.tsx). Slot 0 =
  elements in no round, 1+ = Round 1, 2, … Used by getRoundBadgeColor, SVG
  export (`roundColors` param → prepareSvgForExport) and, via
  `RoundColorsContext` (provider wraps the main return),
  RoundGroupPicker and TattingOrderModeBar. **Group** colours are NOT themed:
  they're data (the `groups` registry, set at group creation), so
  getGroupColor / MultiSelectSummaryBar / useEditorActions keep
  ORDER_GROUP_COLORS. **Correction (session 62 review #3):** that registry is
  NOT saved in the pattern file, nor set on load or New — group names and
  colours are lost when the file is reopened. Open item, review #3.
- **Export rule:** svgExport strips UI by `[data-ui]` and, historically, by
  `stroke="#3B82F6"` (selection) and `stroke="#888"` (Path Edit guides). Both
  colours are themeable now, so those elements also carry `data-ui="1"`.
  **Any new on-screen-only element must have `data-ui`** — don't rely on its
  colour. Layers: `data-layer="notation" | "order" | "groups" | "joins"`
  move a node into that Inkscape layer; everything else lands in Design.
  Order in the file: Joins (under) · Design · Notation · Order Numbers ·
  Group Markers (session 61 added Joins). Session 63: Design / Notation /
  Order Numbers split into one sub-layer per round, joins in one group —
  see "SVG export: rounds as layers (session 63)".
- **Deliberately not themed:** thread / material / bead / DMC / Lizbeth
  colours (pattern data), polar grid colours (per grid, data), bead shading
  (shadow / highlight / `#111` rim in renderBeadShape), realistic stitch
  drawings (`<defs>` ds-stitch etc.), dark contrast halos behind ruler marks,
  gradient `#FFFFFF` fallbacks, SVG-export notes text, and UI chrome
  (Tailwind greys, Notes drawer, dialogs).
- **Template:** `tatting-theme.json` (session 59 deliverable) lists every key
  at its default, with `_section` spacer keys (ignored by the loader).
- **Choices** (useViewState, `themePreset`): `standard` / `pastel`
  (built-in, read-only), `file` (Standard ← `themeFileColors`, a
  tatting-theme.json next to the app read once at start via
  `applyThemeFile`; chosen automatically on a first start), `custom`
  (`themeCustom = {base: 'standard'|'pastel', colors}` — the user's own
  theme: base preset + changed colours, so ↺ returns to the starting
  colour). `theme = themeFor(themePreset)`. **The file is its own choice,
  not a layer over every preset** (as a layer it masked whichever preset was
  picked). Saved as `tcad_theme = {preset, custom}`; Custom is kept when
  switching away. `copyThemeToCustom(from)` makes/replaces Custom (from
  'file' → base standard + the file's colours baked in);
  `setCustomThemeColors` edits it; `loadThemeIntoCustom` = Options → Load
  Theme…; `resetTheme` = Standard (Custom kept). Older saves
  `{preset, colors}` migrate to Custom. **Why not write tatting-theme.json
  next to the app:** the install folder is read-only and the app's own
  files are packed into the executable, so Custom lives in app storage and
  "Save as file…" (`showSaveThemeDialog` in tauri/file.ts, browser falls
  back to a download) exports it. Note: `setCustomColors` is a different,
  older thing (custom THREAD colours) — don't confuse.
  `setTheme` no longer exists.
  `pickThemeKeys()` filters any object to known string keys.
- **Presets:** `standard` (= DEFAULT_THEME) and `pastel` (`PASTEL_THEME`,
  from the user's palette #4B79A1 #E1B12C #F39C12 #A1D69E #2C3E50 #E67E22
  #D9BF77 #BB8E2D #95A5A6 #34495E plus lighter/darker variants). **Pastel
  is the colour-blind-friendly preset.** Conventions: picot not joined =
  mint #A1F3A1, core join not joined = soft grey #9BA3A3, joined + connection
  lines = steel blue #4B79A1, selected = carrot #E67E22; warnings: invalid
  red #E74C3C, too short sand #F4D98E, unnumbered icy #D0EAEC; Tatting Order
  "R" bronze #BB8E2D; finished ruler #CADBDC; dark navies only for
  outlines/label backgrounds. Checked with a CVD simulator (colorspacious,
  CAM02-UCS ΔE, deutan / protan / tritan at full severity, script
  `cvdcheck.py` logic) for every group that must be told apart, including
  pairs shown together (Tatting Order: unnumbered glow / selection / "R";
  joins: connection line / unjoined picot / unjoined core join / selected;
  glows vs selection): **all ≥ 23.1**. Both presets are made for dark
  backgrounds — on a white background several light colours fade (Standard:
  yellow "joined"; Pastel: mint, icy, sand); a light-background preset would
  be a separate job.
  Standard's own weak pairs (for the record): invalid vs unnumbered glow 3.7
  (tritan), path start vs control 2 8.0, bead marker vs beading-mode marker
  8.9 (deutan), picot unjoined vs joined 14.3 (protan).
- **Editor:** `components/ThemeEditor.tsx`, Options → Indicator colours….
  Choice buttons (Standard · Pastel · My file · Custom, or "+ Custom" until
  one exists). Only Custom is editable; other choices show their colours
  read-only with "Copy to Custom" / "Replace Custom with these colours"
  (asks first if Custom has changes). Sections with plain names (reuses
  existing translation keys where the wording fits; the rest are `theme*`
  keys), native colour picker per key, opacity slider for rgba() keys, ↺ per
  changed key, "Undo my changes (n)", Save as file…, Load Theme…, round
  colours as Ungrouped / Round n rows. `jpgArm` /
  `jpgArmSelected` are not listed — nothing draws with them.

### First-run setup screen (session 60)

- **When:** `showSetup` (tattingindex.tsx, local state next to
  `showThemeEditor`) starts true while localStorage `tcad_setup_seen` is
  missing — so it shows once to everyone on the first start of this version,
  existing installs included. Start / Skip / ✕ / Escape write
  `tcad_setup_seen = '1'`. **Options → Setup…** (first item in Options)
  reopens it.
- **Where:** a Modal at z 2147483633/34, above the welcome splash
  (…30–32), so on first start it shows first and the splash is under it. No
  close on backdrop click.
- **Values:** opens with the app's current values (`language`,
  `toolbarMode`, `uiScale`, `bgColor`, `themePreset`) — fresh installs
  therefore see the defaults (computer language, Simple from
  getInitialToolbarMode, Normal, #1F2937, Standard or "My file").
- **Live:** each pick calls the same setter + storage key the Options menu
  uses (`tcad_language`, `tcad_toolbar_mode`, `tcad_ui_scale`,
  `tcad_bg_color`, `tcad_theme`); the wrappers are in the `<SetupScreen>`
  props in tattingindex.tsx. Nothing new is read anywhere else.
- **Start** keeps the picks and also stores the shown language (it may
  have come from the computer and not been stored yet).
- **Skip / ✕ / Escape** put back only the settings changed *in this
  screen* (a `changed` set), not all five — a tatting-theme.json that loads
  while the screen is open (it arrives async and selects "My file" on a
  first start) must not be undone by Skip.
- **Escape:** the component listens on `document` in the capture phase and
  stops the event, so the app's Escape closer list doesn't also close the
  splash; the closer list has a no-op `[showSetup, …]` entry first as a
  second guard. (Session 62: the list now covers every dialog and menu —
  see "Escape order (session 62)".)
- **Choices:** background = `SETUP_BG_CHOICES` (default #1F2937 + the
  `BG_COLORS` cycle, module level in tattingindex.tsx). Colour theme =
  Standard / Pastel (colour-blind friendly), plus My file and Custom only
  when they exist. Previews: tiny toolbar pictures, "Aa" sizes, a ring on
  each background, five indicator dots per theme drawn on the current
  background.
- **Strings:** `setup*` keys (en/es/hu); reuses languagePickerLabel,
  uiScaleNormal, optionsSizeLarge, themePresetStandard/File/Custom.

### Large size → bigger dialogs, menus, toasts, pop-ups (session 60)

- `uiScale === 'large'` toggles `tcad-ui-large` on **`<html>`** (effect in
  tattingindex.tsx) — dialogs are rendered outside `.app-root`, so the
  app-root `.ui-large` rules never reached them.
- Every dialog box carries **`.tcad-dialog`**: the `Modal` content box
  (Modal.tsx, so every Modal user and ArrayDialogShell), plus the
  hand-built ones — splash card, update popup, Materials Manager, Recent
  "load?" confirm, Convert-ghost confirm, Join tip, Tatting Order conflict,
  Ghost Array Manager, Help, UI Reference Guide. **A new dialog not built on
  Modal needs the class added by hand.**
- `index.css`: `zoom` 1.12 when the window is ≥ 700×700, 1.2 when ≥ 900×860;
  phones / short windows keep normal dialogs. `max-width` / `max-height` are
  capped (`!important`) at 96vw / 92dvh divided by the zoom, so the scaled
  box still fits — tall dialogs scroll inside as before.
- Checked at 1600×900, 1366×768, 1280×720 (Large): every dialog on screen,
  nothing spilling; Thread Properties scrolls; typing, scrolling and
  sliders hit the right spot (Chromium's zoom keeps getBoundingClientRect
  and clientX in the same space — the colour picker uses exactly that).
- **Also scaled (same session, user: "UI scale is for people who can't see
  well"):** the shared scale is the CSS variable **`--tcad-zoom`** on
  `<html>` (1.12 / 1.2, unset = 1; read in JS with `getUiZoom()`,
  utils/uiZoom.ts). `.tcad-zoom` = zoom by it:
  - **Top menus (DropdownMenu.tsx, CRLF):** the outer fixed box keeps the
    measured px position / scrolling; an inner `.tcad-zoom` wrapper holds the
    items (`minWidth: width`, `maxWidth: max(width, 320)`). Flip-left test
    uses `width × zoom`. Max height is now all the space below the button
    (was 80vh). The 320 cap also fixes an older quirk: a flipped
    (right-anchored) menu stretched to its longest line. At normal size every
    menu measures exactly as before (widest: Arrange 287 px).
  - Load toast (inner box), remove-image confirm (`.tcad-dialog`), the Path
    preset panel on the canvas, the Notes drawer.
  - Status bar: `.ui-large .info-bar` 14 px (was 12) — CSS, not zoom.
- **Deliberately NOT zoomed:** the property bar and anything inside it
  (Picot Tools / multi-select Scale pop-overs, round pickers in the bar and
  in Tatting Order) — the `.ui-large` property-bar rules already enlarge
  them; zoom would double it. Picot Tools at Large used to run off the
  bottom of the screen: both pop-overs now have `maxHeight: calc(100dvh -
  9rem)` + scroll. Native tooltips (`title=`) and the OS list of a `<select>`
  can't be styled. Phones / short windows: zoom 1 (unchanged).

### Picot Tools panel — wide layout + result preview (session 60)

Mockup approved by the user (`picot-tools-mockup.png`). Single-element
Picot Tools pop-over (GeneralElementPropertyBar.tsx):
- **Layout:** header (title · current notation · ✕), Reverse + Clear in one
  row, Add + Fill as two cards side by side (each with a one-line hint;
  Symmetric first; Fill's count is on its button), Compact on one line with
  a short "Group" button, Scale in two rows (`ScaleControls layout="wide"`:
  exact | rounded presets on one line + "~" legend, then % box · → new
  length · Apply), then a **Result** line.
- **Size:** `.picot-wizard-pop` 460 px (Large 560 px; property-bar Large
  rules already enlarge its text/controls — it is NOT zoomed), max
  `100vw − 16px`; `.picot-wizard-grid` 2 columns, 1 under 640 px. A ref
  callback slides it left when it would run off the right edge (phones,
  narrow windows). The ≤ 768 px property-bar rules (sliders 40 px, number
  boxes 44 px, tiny button text) are overridden inside the panel.
- **Result preview:** `wizardTool` state (component level, reset when the
  panel opens) is set by pointer-enter / focus / press on each tool (and by
  the slider, presets, % box). `previewFor(tool)` computes the notation
  WITHOUT committing, using the same helpers Apply uses — `transformSides`
  (= applyToSides without the commit), `fillResult`, `scaleResult`
  (`bChanged`: side B only sent when scaled, as before), reverse — so the
  preview is exactly what Apply produces (checked: Add, Fill, Group,
  Reverse, Scale ×2 — preview text == notation after Apply).
- **Split rings (same session, user request):** they now get the wand
  button too (`renderPicotTools()` is shared by the regular and split-ring
  notation rows). They had never worked: `analyzeNotation` refused any
  `sr:` notation ("out of scope v1"), only the panel's side handling
  existed. Now:
  - `analyzeNotation` accepts `sr:` — the panel hands over ONE side at a
    time as "sr: <side>", which is a plain ds + picot run like any ring.
  - **`splitRingSides(el)`** (picotTools.ts) splits a split ring into
    sides **by count**: the element stores `[...A reversed, ...B]`
    (computeElementAfterNotationEdit), so A = the first n picots, n = zero-
    width tokens in A's notation. The old position test (`sb < splitPos`)
    put a picot at the very START of side A (stored at sb === splitPos) on
    side B. Used by the panel and the multi-select Scale.
  - Tested: Add (Both / A / B), Clear, Fill, Group, Reverse, Scale ×2 —
    preview == result; and a split ring whose side A starts with a JOINED
    picot: Clear unjoined keeps it and the join stays on the same picot.
  - The panel calls the app's `parseNotation(…, true)` (silent): without
    `silent` it sets the app's error state during render (React warning).
- **Multi-select Scale** (MultiSelectSummaryBar.tsx): same wide layout
  (card, presets on one line, ✕), slides right if it would pass the left
  edge. Split rings are now scaled on **both** sides (each analysed via
  splitRingSides; both must be supported) — `updateNotationForMultiple`
  targets take an optional `notationB`. They used to be skipped; with
  `sr:` accepted, analysing only `el.notation` would have scaled side A
  alone. Tested ring + joined split ring ×2: both sides doubled, join kept.
  Presets with no single resulting length no longer show a bare "ds".
- `picotWizardUnsupported` no longer lists split rings / ss / beads (ss runs
  and bead tokens were already handled; rds is what's refused). Session 62:
  rds / bds are handled too, and the message names a bead sequence
  (`bc:YZ`) instead — see "Picot Tools — every stitch type (session 62)".
- Section components (AddPicotsSection / FillPicotsSection /
  CompactPicotsSection, CRLF) are card-shaped now with `hintText` /
  `onActivate` props; they're used only here (tattingindex.tsx imports them
  but doesn't render them). Shared classes in ScaleControls.tsx:
  `WIZARD_CARD_CLASS`, `WIZARD_SECTION_TITLE_CLASS`, `WIZARD_HINT_CLASS`,
  `WIZARD_APPLY_CLASS`, `WIZARD_SHORT_BUTTON_CLASS`. The multi-select Scale
  pop-over keeps the old stacked ScaleControls (default layout).
- Strings: `picotWizardSideA/B`, `picotWizardAddHint`, `picotWizardFillHint`,
  `picotWizardFillApplyCount`, `picotWizardCompactHint/Short/Nothing`,
  `picotWizardScaleCustomShort`, `scaleRoundedLegend`,
  `picotWizardResult/ResultHint/ResultSame` (en/es/hu).

### Picot Tools — Expand repeats (session 60)

- The "Repeats" card (CompactPicotsSection.tsx, CRLF) has two buttons:
  **Group** (as before) and **Expand**, its opposite:
  `r: 3*(3ds-p)-3ds` → `r: 3ds-p-3ds-p-3ds-p-3ds`.
- `expandRepeatGroups(notation)` (picotTools.ts) uses the parser's own
  `expandTokens`, so every spelling the parser accepts (`3x(…)`, `3*(…)`,
  `(…)x3`) expands, and the result is the exact token list the app already
  works from. Ds runs that end up side by side are added together
  (`2*(3ds-p-3ds)` → `3ds-p-6ds-p-3ds`) — same stitches. Returns null with no
  repeat group (`hasRepeatGroups`; bare grouping parens like `2ds-(p-2ds)`
  don't count). Never moves a picot → join-safe; committed like Group
  (`preservesExistingPicots: true`). Split rings: per side (Side A / Both / B).
- Result preview: tool `'expand'` (the Expand button's hover/focus).
- Tested: ring and split ring (each side + both), Expand → Group round trip,
  joined picot kept, undo. Strings: `picotWizardExpandShort`,
  `picotWizardExpandNothing`; `picotWizardCompactSection` is now "Repeats",
  the hint mentions both buttons (en/es/hu).

### Split-ring A / B boxes refresh (session 60 fix)

`SplitRingNotationInput` is uncontrolled (`defaultValue`). Its key was only
the element id + side, so after a change from elsewhere (any Picot Tools
action on a split ring, Undo/Redo) the box kept showing the old text, while
the element itself was right. The key now also includes that side's
notation (GeneralElementPropertyBar.tsx), so the box remounts with the new
text. Safe: the notation only changes on commit, when the box has lost
focus anyway.

### Group includes joined picots (session 60, user's decision)

`foldRepeats` (picotTools.ts) no longer treats a joined picot as a break —
joins live in `picotConnections` / `isJoint`, not in the notation text, so
`3ds-p-3ds-p` groups to `2*(3ds-p)` whether or not those picots are joined,
and every picot keeps its position (joins and folds kept, committed with
`preservesExistingPicots: true`). This also applies to `autoCompact` after
Clear / Add / Fill / Scale. Tested on the user's file (ring with 4 of 5
picots joined, two chains with one each, one fold).

### Pattern file extension `.tatcad` (session 60)

Pattern files are JSON with the extension `.tatcad` (`PATTERN_EXT`,
tauri/file.ts), Android included since 1.4 (see the file-type section).
Save dialog: `.tatcad` only; Open: `.tatcad` + `.json` (old files); Android
open: no filter. Saving to an
existing path keeps its extension. Name stripping: `stripPatternExt`
(Recent, window/project name) and patternOutput.ts (inline regex — domain
doesn't import tauri/). `thumbPathFor`: either extension → `_thumb.png`.
Sample patterns, themes, translations stay `.json`. File-type icon and
double-click opening are not done yet (handoff → Still open).

### `.tatcad` file type — icon + open from the system (session 60)

**src-tauri** (delivered as `tatcad-filetype.zip`; not in src):
- `tauri.conf.json` → `bundle.fileAssociations`: ext `tatcad`, name
  **"TattingCAD Pattern"** (= the Windows file-type key — `windows/hooks.nsh`
  uses the same string; keep them equal), mimeType `application/x-tatcad`,
  macOS `exportedType` `com.savarosa.tattingcad.pattern` conforming to
  `public.json`. `resources` + `icons/tatcad-document.ico` (installed at
  `<app>/icons/`).
- Windows: `bundle.windows.nsis.installerHooks` = `windows/hooks.nsh` —
  NSIS_HOOK_POSTINSTALL sets `SHCTX\Software\Classes\TattingCAD Pattern\
  DefaultIcon` to the bundled .ico (only if it exists) + SHChangeNotify.
  Tauri's own association uses `TattingCAD.exe,0`; its uninstaller deletes
  the whole key. MSI template: no icon for the type.
- Linux .deb: `desktopTemplate` `linux/main.desktop` (Tauri's built-in one
  has `Exec=tattingcad` with no `%F`, so the file never reached the app),
  `files` → MIME XML + mimetypes icon, post-install/remove scripts refresh
  the databases.
- **Android result (tested on the user's phone, 1.4):** the manifest has
  both filters, saving `.tatcad` works, File → Open picks it — but Samsung My
  Files neither offers TattingCAD on tap nor in Share for a `.tatcad`
  (old `.json` files weren't offered either). A catch-all `*/*` "Open with"
  filter would fix it but puts TattingCAD in Open with for every file — the
  user declined. Not tried: other file managers.
- Android (1.4): `tauri.android.conf.json` REPLACES the list (arrays are
  replaced by the merge) with two entries: `application/x-tatcad` (all
  actions) and `application/octet-stream` with `androidIntentActionFilters:
  ["view"]`. Why both: tauri-build writes `<data android:mimeType>` +
  `<data android:pathPattern=".*\\.tatcad">`, but Android ignores
  pathPattern without a scheme, so only the MIME type matches — and file
  managers label an unknown `.tatcad` octet-stream. Manifest updated at every
  build (`update_android_manifest("tauri-file-associations", …)`).
- Android opened files: tao handles VIEW / SEND / SEND_MULTIPLE in onCreate
  and onNewIntent → `RunEvent::Opened`; lib.rs passes `content://` URLs on as
  strings. The fs plugin reads `content://` through ContentResolver without a
  scope check (mobile `resolve_file`). The page opens them as an untitled
  copy (`openHandedOverFile`): read-only grant, not in Recent; name via
  `patternNameFromUri`. (Session 61: File → Open / Save now use
  tauri-plugin-android-fs with kept access — "Android files: kept access".
  Files handed over by other apps still get only a temporary grant.)
- Android save: filter value `application/octet-stream` (a value containing
  "/" is passed to Android as a MIME type by the dialog plugin), so
  ACTION_CREATE_DOCUMENT keeps `Name.tatcad`; open: no filter.
- `src/lib.rs`: `PendingFiles` state; start-up args (desktop) and macOS
  `RunEvent::Opened` → `hand_over_files` — kept until the page calls
  `take_pending_files` once, after that emitted as `open-files`.
  `tauri-plugin-single-instance` (first plugin; desktop only): a 2nd launch
  focuses the window and hands its file over.
**Frontend** (tattingindex.tsx, next to openSample): listen `open-files`
first, then `invoke('take_pending_files')` once (`systemFilesTakenRef` —
dev double-mount); opens the first path via `loadFromPath`, closing the
splash / gallery / recent dialog; asks first with unsaved changes.
Tested: real Linux .deb (install, launcher open, 2nd file while open).

### Dropdowns on Linux (session 60 fix)

WebKitGTK (Linux desktop app) draws native `<select>` with the system's
light style, ignoring Tailwind background classes but keeping `text-white`.
`index.css`: `select { color-scheme: dark }` (dark native control) and
`select option` dark colours. Applies to all dropdowns. Checked in a real
Linux build.

### Ruler — several points (session 60)

- State: `rulerPoints` (each `{x, y, t, sx, sy}` — world position, click
  time, screen position), `rulerMousePos`, and `rulerDone`
  (useCanvasInteraction.ts, CRLF).
- Clicks (useInputHandlers.ts, ruler branch): add a point; a click within
  10 screen px of the last point never adds one — within 450 ms (and ≥ 2
  points) it **finishes** (`rulerDone`), otherwise it restarts the timer.
  Done here, not in `onDoubleClick`, so a double-tap works the same (taps
  arrive via onTouchStart). The tap's compatibility mouse event is ignored
  (`nativeEvent.sourceCapabilities.firesTouchEvents`).
- When done, the next click starts a new ruler. Escape and switching tools
  clear it (and reset `rulerDone`).
- Drawing (tattingindex.tsx overlay): placed segments solid, the live one to
  the pointer dashed; small corner dots; the label shows the total along
  the chain (+ "n segments"); one segment → label beside its middle, more →
  just past the end point along the last segment. Status bar uses the same
  chain.
- mm = world units × (preset `ds20Core` / 20) / `dsWidth`.

### Fold thread length (session 60)

PicotJoinModeBar row 2 (fold selected): quiet grey "Thread ≈ X mm · Y″" at
the right, before Copy / Paste; tooltip = outer + inside = total and the
preset name (`presetDisplayName`). Props `mmPerUnit`, `presetName` from
tattingindex.tsx — same conversion as the ruler. outer/innerLength are the
arc lengths the fold is drawn with (buildFixedFeetArcD targets them), so
this is the drawn thread length.

### Opened files centred for the screen (session 60)

useProjectFile `applyProjectData` calls `p.onFileApplied?.()` (files and
samples only — not autosave resume). tattingindex.tsx sets
`settleViewOnOpenRef`; an effect on `[elements]` then keeps the saved zoom
if the bounding box fits the canvas (25 px padding) and centres it, else
`fitAllElements()`. Reason: a saved camera is a pixel offset for the saving
window's size.

### Picot ids are not unique across elements

Copy / paste / duplicate keep picot ids, so the same picot id appears in
several elements. Anything that identifies a picot must use **element id +
picot id** (selection, connections, highlights). Session 60 fixed renderBE's
selected-diamond test, which used the picot id alone (all copies lit up).

### `bcjp:` — core bead + joining picot, finished (session 63)

`bcjp` was half-built ("legacy"): drawing (renderOnePicot's bcjp branch),
beads on its join (`getConnectionBeads`), Join-mode selection, stitch
counting (`dsPosition += 1`) and pattern text (patternOutput.ts) all knew
it, but **parseNotation had no branch**, so `bcjp:` was refused as an
unknown element. Now (user's decision, session 63):
- `bcjp:Y` = core bead (Y/Z/V) whose picot joins; `bcjp:Y:ZZ` = with beads
  on that picot (drawn on the join line). Same shape as `bcp:Y` /
  `bcp:Y:ZZ`; lowercase accepted.
- Parsed like bcp (one stitch slot, `coreSize`, `beadSeq`), but
  `beadType: 'bcjp'` and `isJoint: true` on parse (like `bjp`).
- Added to `isZeroWidth`, `countActualStitches`' skip, `isSlotBead` (so
  split-ring side A positions and the half-stitch bead centring in
  getPicotPosition / renderPicots — now via isSlotBead — include it) and
  Picot Tools' barrier list (comment; it goes through isZeroWidth).
- `canHoldJoin` (review #22) already listed it.
- Tested: parse vs bcp on 5 notations (same stitch count, positions and
  stitch types; only beadType / isJoint differ), invalid forms refused,
  split-ring side A; in the browser, `3ds-p-3ds → 3ds-bcjp:y-3ds` and
  `→ 3ds-bcjp:Y:ZZ-3ds` keep the join with no warning, not shown as
  invalid, schematic and realistic draw it (core bead on the ring, ZZ on
  the join line).
- **Help page:** a card for it is in `docs/help-bcjp-card.html` (to paste
  after the bcp card in public/tatting-help.html — not edited here, the
  GitHub copy may be older than the user's).

### Beads on joins (session 60 fix)

- `getConnectionBeads(conn)` (tattingindex.tsx; replaced getConnectionBeadSeq)
  → `[{size, color, shape}]` for a join that includes a bjp/bcjp (beadSeq,
  size-class colours) or a **BE with beIsJoint** (picotBeads via
  `resolveLibraryBeads`, shared with renderBE). `renderBeadsOnJoin`: 2 picots
  → a row along the join line centred on its middle; 3+ → cluster at the
  centroid. Used by the schematic and realistic join drawing.
- `renderBE(…, beadsOnJoin)`: a joined BE with beIsJoint draws only the core
  bead + diamond (no picot arm / beads). renderOnePicot passes it.
- `bjp` branch in renderOnePicot (before the generic beadSeq one): joined →
  nothing on the ring (dot in Join mode); unjoined → beaded picot + a join dot
  in Join mode.
- Join-mode selection (useInputHandlers.ts mouse-up): bjp / bcjp are always
  selectable, like a BE with beIsJoint. **Why:** `isJoint` means "currently
  joined" — loading a file and cutting a join clear it — so it can't also be
  the "may be joined" flag for bead picots.

### Exit confirmation — one listener (session 60 fix)

The `close-requested` listener (tattingindex.tsx) is registered ONCE (`[]`
deps) and reads `t` through `closeTRef`. Tauri's `listen()` resolves
asynchronously, so cleanup sets `disposed` and a listener that arrives late
is removed in `.then()`. A second close click while the dialog is open is
ignored (`asking`). **Rule for any `listen()`:** never re-register on
changing values (use a ref), and handle the late `.then()` after cleanup.
Before: deps `[t]` + no late cleanup → a stale listener per `t` change
(language file load) and per StrictMode mount → 2–3 dialogs, one with raw
keys.

### Pasting keeps folds (session 60 fix)

`pasteFromClipboard` (useEditorActions.ts) now spreads the whole connection
(`{ ...rest, id, picots }`, dropping only `isInheritedJoin`), like
`duplicateInPlace`. It used to rebuild `{ id, picots }`, which dropped
`connectionType: 'fold'` and the fold properties. **Rule:** any code that
copies a connection must spread it, never rebuild it from id + picots.

### Security: colours from pattern files (session 60, after 1.4.0)

Pattern files are shared, so their contents are untrusted. The realistic
view is built as SVG **text** (`render/realisticRenderer.ts`) and put on the
page with `dangerouslySetInnerHTML` (tattingindex.tsx, `bakedRealisticSVG`).
A colour like `red"/><image href=x onerror="…">` used to become live markup
and run code — and with `withGlobalTauri` + the fs plugin's `"**"` scope,
that code could read and write any file. Reported via Reddit (1.4.0 thread).
Fixed in two layers, `utils/safeColor.ts`:
1. `safeColor(v)` at each place a colour goes into markup text (the three
   `fill="${…}"` in realisticRenderer.ts). Only hex, `rgb()/rgba()/hsl()/
   hsla()` with numbers, or a plain colour word pass; else `#888888`.
2. `sanitizeProjectColors(data)` when a pattern comes in — `applyProjectData`
   (files, samples, recent, handed-over files), `loadFromAutosave`, and
   pasting from the system clipboard (`pasteFromClipboard`). Replaces
   invalid `bgColor`, element `color`/`colorB`, material colours and
   gradient stops, bead library, polar grid colours, custom colours; a
   console warning gives the count.
**Rule:** never put file data into markup text without escaping it; anything
new built as text for `dangerouslySetInnerHTML` must pass colours through
`safeColor` (and other strings through an escape). React-rendered attributes
are already escaped. `svgExport.ts` uses XMLSerializer (safe); the
calculators' `new Function` only allows digits and `+-*/().` (safe).
**Second wall — Content Security Policy (session 60, `tauri.conf.json` →
`app.security`).** Even if some markup slips through, the page refuses to
run scripts that aren't the app's own files:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' asset: http://asset.localhost data: blob:; font-src 'self' data:;
connect-src 'self' ipc: http://ipc.localhost; frame-src 'self';
object-src 'none'; base-uri 'self'; form-action 'none'
```
- `script-src 'self'`: no inline scripts, no `onerror=`/`onclick=` attributes,
  no `eval` / `new Function` (Tauri adds hashes for the app's own inline
  scripts at build time). The two calculators now use `utils/calcExpr.ts`
  (`evalArithmetic`, a small parser: numbers, `+ - * /`, brackets) instead
  of `new Function`. **Rule:** never add `eval`/`new Function`/inline event
  attributes — they won't run.
- `style-src 'unsafe-inline'` + `"dangerousDisableAssetCspModification":
  ["style-src"]`: React `style={…}` and the SVG `style="…"` need inline
  styles; without the second setting Tauri adds a nonce, which makes
  browsers ignore `'unsafe-inline'`. Styles can't run code.
- `img-src`: the app's files, thumbnails (`asset:` / `http://asset.localhost`
  via convertFileSrc), the reference image (`data:`), blobs.
- `connect-src`: the app's own files (fetch of translations, samples, help)
  and Tauri's IPC (`ipc:` on macOS/Linux, `http://ipc.localhost` on Windows/
  Android). **No outside web addresses** — anything that must fetch from the
  internet needs its address added here. Opening a link in the browser goes
  through the opener plugin, not fetch, so it's unaffected.
- `frame-src 'self'`: the Help / UI guide pages (iframes of the app's own
  files). Their inline `<script>` blocks are hashed by Tauri; inline
  `onclick=` / `oninput=` in them are blocked. Print, Search, Next and ✕
  used them (broke in the user's test) → `scripts/fix-help-pages.mjs` adds a
  block to each page's script that removes those attributes and connects
  the controls with addEventListener (all languages; safe to rerun). The
  tabs connect themselves already. **Rule for help pages:** no `on…=`
  attributes — connect controls in the page's script.
- `devCsp: null`: the dev server (`npm run tauri dev`) keeps working as before.
- `withGlobalTauri: false`: no `window.__TAURI__`; the app imports
  `@tauri-apps/api` instead (the one check that used it now looks for
  `__TAURI_INTERNALS__`).
Tested on a real Linux build: with the colour checks switched off on
purpose, a crafted file's markup got in but its script did NOT run; the same
build without the policy did run it (page turned red). Normal use: files,
realistic view, user languages, images all fine.
**Numbers (session 63):** the same two layers exist for numbers — see
"Security: numbers from pattern files (session 63)".
**Third wall — the deny list (session 61):** see "Security: deny list —
folders the app may never touch". A narrower *allow* list (Documents + picked
files only) was considered and rejected by the user: patterns live all over
the disk, and thumbnails / double-click / Recent would need extra plumbing.

### Security: numbers from pattern files (session 63, review #1)

A "number" in a pattern file can be text. In markup built as text,
`cx + radius` with a text `cx` JOINS the text in: a circle ring's
`center.x` (circle, JK, ghost copies of them) became live markup in the
realistic view. The CSP stopped scripts, but a fake link / fake dialog could
be drawn. Fixed in two layers, `utils/safeNumber.ts`, like the colours:
1. **Output:** `markupNum(v)` (imported as `n` in realisticRenderer.ts) at
   the two places that write coordinates into the SVG text without
   `.toFixed` — `renderWedgeRingShapes` and `renderWedgePathShapes`. A value
   of the number type passes exactly as it is (output byte-identical for
   sound patterns); anything else becomes 0. The other writers use
   `.toFixed`, which only exists on numbers.
2. **Input:** `sanitizeProjectNumbers(data)` on every way in, right after
   `sanitizeProjectColors`: `applyProjectData` (files, samples, Recent,
   handed-over files), `loadFromAutosave` (Resume) and the system-clipboard
   paste (`pasteFromClipboard`; handles `connections` as well as
   `picotConnections`).
   - **Element left out** (user's decision: leave it out, open the rest)
     when its geometry isn't real, finite numbers: `center.x/y`; each path's
     `x`, `y`, `endX`, `endY` and its control points (cubic: `control1/2`;
     anything else: `controlX/Y`); `stitchCount`, `splitPosition`,
     `picots[].stitchesBefore` when present; or it isn't an object. Its
     joins go with it, and picots on their far side lose `isJoint` unless
     another join still holds them.
   - **Reset to default:** `rotation` 0, `lineWidth` 2, `labelOffset` 8,
     `picotSideMultiplier` 1, `endAllowance` 0, `squeeze` (0, split ring
     0.25), `squeezeCA/CB` 0.75; a bad `dsWidth` is removed (loaders use 10).
   - A sound pattern is not changed at all.
- **Message:** `loadWarnDamagedElements` ("{n} damaged element(s) were left
  out.", en/es/hu) — red toast instead of "Load completed" on file open; on
  Resume and paste through `reportDamagedElements` (tattingindex.tsx), which
  reads `t` through `tLiveRef`. **Why a ref:** `pasteFromClipboard` is
  created once (`[]` deps), so `p.t` inside it is the FIRST render's `t` —
  raw keys / wrong language (seen in the test). Passed to useEditorActions
  as `onDamagedElements`.
- **Rule:** a new number field that feeds geometry goes into
  `sanitizeProjectNumbers`; a new place that writes numbers into markup text
  uses `.toFixed` or `markupNum`.
- Tested: fuzz — markup text in every field of every element kind, 906
  bakes: old code 18 through, each layer alone 0, both 0 (and no NaN, no
  throw); old vs new bake byte-identical on 600 generated patterns and the 4
  shipped samples, which the check leaves untouched; browser (Playwright,
  Vite dev server): crafted pattern via Resume, sample (= file open) and
  paste (mocked Tauri clipboard) → realistic view: old code draws the link,
  new code doesn't, the other elements are there, the toast shows.

### SVG export: rounds as layers (session 63, user request)

When the pattern's elements sit in **two or more rounds**, the exported SVG
(schematic and realistic) gets one Inkscape **sub-layer per round** inside
Design, Notation and Order Numbers:
```
Joins            (one <g id="joins"> holding every join)
Design         ▸ Round 1 · Round 2 · …
Notation       ▸ Round 1 · Round 2 · …
Order Numbers  ▸ Round 1 · Round 2 · …
Group Markers
```
- Sub-layers are named like the round (`rounds[i].name`, else "Round n"),
  ids `layer-design-round-1` etc., in round order (first round at the
  bottom); a round with nothing in a layer gets no sub-layer there.
- **User's decisions:** both views; an element in no round goes with the
  FIRST round; Notation and Order Numbers are split too; all joins sit in
  one group inside the Joins layer (in every export, rounds or not).
- **One round or none → the file is laid out exactly as before** (checked:
  same shapes in the same order, 0 differing pixels), apart from the joins
  group.
- **How a node's round is known** (`render/svgExport.ts`,
  `roundIndexOfNode`): the canvas tags each element's group with
  `data-round` = its round id (`''` for none) — both schematic element
  groups, the realistic bead overlay (`realistic-be-…`) and a fold (by the
  element its first picot is on); the baked realistic view wraps each
  element's pieces in `<g data-el="i">` (i = its place in `elements`; a
  number, so nothing from the file enters the markup). Notation / order
  nodes read the tag of the element group they sit in (`closest`) BEFORE
  they are moved. The tags are removed from the exported file.
- Design: tagged groups move into their round's sub-layer in their old
  order; the sub-layers take the place of the first tagged group, so what
  was drawn under the elements stays under. Paint order therefore changes
  only where elements of different rounds overlap (later round on top).
  Empty groups (hidden labels, elements with no beads) are dropped when
  splitting.
- **Rule:** anything new drawn per element on the canvas that should export
  with its round needs `data-round` on its group (or to sit inside one).
- Tested (Playwright, exports captured through a mocked Tauri save): six
  patterns × two views, old vs new — same set of shapes every time, no tag
  left in the file; patterns with rounds: each layer's sub-layers hold the
  right counts, order badges land in their round both when drawn on the
  canvas (Tatting Order mode) and when added by the export. **Not opened in
  Inkscape here** — user to check.

### Browser shortcuts blocked in the desktop app (session 60)

WebView2 (Tauri on Windows) keeps some browser shortcuts on. A capture-phase
`keydown` listener in tattingindex.tsx (only when `__TAURI_INTERNALS__` is
present) calls `preventDefault` for: Ctrl+F, F3, Ctrl+G (Find / find next),
Ctrl+R, Ctrl+Shift+R, F5 (reload — would lose undo history and anything not
autosaved), Ctrl+P (print), Ctrl + `+` / `=` / `-` / `0` and the numpad
+ / − / 0 (interface zoom). Also while typing in a box. No
`stopPropagation`, so the app's own shortcuts still run (Ctrl+G is still
Group). In a normal browser nothing is blocked. Ctrl+wheel zoom was already
blocked by the `preventBrowserZoom` effect next to it. Cmd counts as Ctrl
(macOS).

### Sample patterns (session 60)

- **Files:** `public/Patterns/` — the pattern .json files, their thumbnails,
  and `samples.json`: `{ "samples": [ { file, thumb?, title, description? } ] }`
  (also accepted: a bare array). `title` / `description` are plain text or
  `{ "en": …, "es": …, "hu": … }` — `pickText` uses the current language,
  else English, else the first. Shown in list order. Folder name is
  case-sensitive on Android/Linux: `Patterns`.
- **Loading the list:** `loadSampleList()` once at start (useEffect in
  tattingindex.tsx, `samples` state). Missing / broken list → `[]` → every
  entry point is hidden.
- **Entry points:** splash (full-width "Sample Patterns" under the 2×2
  grid), File → Sample patterns… (after Browse), Help → Sample patterns…
  (after UI Reference Guide), and the empty-pattern hint
  (`GettingStartedHint` `onSamples` → a second sentence `hintSamples` with a
  `{samples}` button).
- **Opening (`openSample` in tattingindex.tsx):** asks first only when there
  are unsaved changes (same confirm as Open). Fetches the file and calls
  `applyProjectData(data, null, { name })` — **filePath null = untitled
  copy**: no `currentFilePath` (Save asks where, the shipped file can't be
  overwritten), not added to Recent, no thumbnail written, project name =
  the sample title. Opened untouched → not "unsaved" (rev 0 = lastSavedRev
  0), so no close warning until it's edited. Everything else (validation,
  migration, duplicate check, schematic mode, the file's own background) is
  the normal open path.
- **Errors:** missing file / not JSON → plain `samplesLoadError` with the
  sample's title; details to the console (a web server may answer a missing
  file with its index page, which made the raw error unreadable).
- **Gallery:** Modal z 10010/10011 (same as Recent Projects); Escape closes
  it (closer list). Thumbnails shown 3:2 with `object-contain` (the app's
  own thumbnails are 300×200).

### Ring kinds: floating / mock ring (session 61)

The ring Shape group is one row of five, one lit at a time:
**Teardrop · Circle · FR · MR · JK** (ShapeAndSqueezeControls.tsx; icons
`IconShapeFloatingRing` / `IconShapeMockRing` in icons.tsx — the user's own
drawings, coordinates kept as drawn under a `translate`).
- `fr:` floating ring, `mr:` mock ring: **plain rings everywhere** — the
  parser maps both to `r` (`NOTATION_TYPES` = `r|c|sc|sr|jk|fr|mr`,
  parser.ts); Picot Tools' `PREFIX_RE` knows both. Always teardrop-shaped
  (user: an FR / MR can't be a circle).
- One action, `setRingKind(kind)` in tattingindex.tsx (replaced
  `toggleShape`; passed SingleSelectPropertyBar → GeneralElementPropertyBar
  → ShapeAndSqueezeControls): Teardrop / Circle → `r:` + that shape; FR →
  `fr:` + teardrop; MR → `mr:` + teardrop. Rewrites only the prefix; rebuilds
  the path only if the shape changes (length via `elementPathLength`, so a
  circle loses its end allowance). Ghost mothers regenerate. Undo through
  the auto-history. From JK the stitches stay (`jk: 16ss` → `fr: 16ss`).
- Lit button = prefix first (`jk` / `fr` / `mr`), else shapeStyle.
- Pattern text (patternOutput.ts): `NOTATION_PREFIX_RE` (all prefixes incl.
  jk/fr/mr) strips the prefix for hints and stitch counts — **fixed on the
  way:** jk: was never stripped, so a JK's first stitches were not counted;
  `ringTypeLabel` → FR / MR / SR / R in the unnumbered list.

### Tablet property bar — Row 2 break below 1440 px (session 61)

GeneralElementPropertyBar's forced Row-2 break (`<div className="w-full
prop-row-break" />`) is `display: none` below 1440 px (`.top-row-properties
.prop-row-break`, CSS in tattingindex.tsx). Why: at those widths Row 1
wraps; its last controls (Reset + the tension stepper) then sat alone on a
middle line (Samsung tablet 1280 px / Large → 3 lines). Without the break
the controls flow on. Measured with a ring selected, 390–1600 px, Normal +
Large: never more lines, 1280 L 3→2, 1024–1100 N 3→2, phone 5→4; ≥ 1440
unchanged.

### Rotation handles on R, Shift = 45° move lock (session 61)

Shift used to do both (handles + X/Y lock), so grabbing near a corner while
Shift was down rotated instead of moving.
- **Hold R** (`isRotateKeyHeld`, useCanvasInteraction.ts) shows the rotation
  handles. Plain R only (Shift+R = add ring, Ctrl+R blocked), not while
  typing (`isTypingTarget`), not in Tatting Order mode (R = repeat there).
  Toolbar button unchanged (touch). Reset on blur.
- **Move lock** (useInputHandlers.ts, drag branch): Shift held → 45° steps;
  Ortho button alone → X / Y; Shift wins while held. Computed from the
  WHOLE drag: snapped angle of (pointer − `dragOriginRef`), projection onto
  it, delta = target − `dragOffsetRef.dx/dy` already applied — so changing
  direction mid-drag follows cleanly (the old per-step zeroing kept the
  movement along the first axis). cos/sin rounded to 1e-9 (exact 0 / ±1).
- `dragOffsetRef.current.lockAngle` → a faint orange dashed guide line
  through the grab point while locked (tattingindex.tsx, before the ruler
  overlay).
- Shift must be pressed AFTER the drag starts (Shift+click = add to
  selection, unchanged). Snap on release can still nudge off the line
  (unchanged).
- Texts: `toolOrthoLock`, `toolRotationHandlesShow/Hide` (en/es/hu); help +
  UI guide pages updated (R (hold); Shift = 45° steps).

### Polar-grid list: visible grids only, multi-select too (session 61 fix)

The rotation-centre list in MultiSelectSummaryBar listed hidden grids (the
single-element bar already filtered). Now `polarGrids =
allPolarGrids.filter(g => g.visible)` there as well.

### Join lines: solid, always drawn, own SVG layer (session 61)

- Schematic join lines are solid (was `5,5` dashes), same colour
  (`theme.connectionLine`), width 3, opacity 0.7, flat ends (round ends
  overlapped at the centre → a brighter dot). Joined beads sit on them.
- **Always drawn** — they were inside `showEditingArtifacts && …`
  (View → Hide Editing Artifacts); the user: a join is pattern, not a
  helper. The switch still hides Join-mode markers, snap guides and a
  fold's thin dashed anchor guide.
- Each join's `<g>` (schematic and realistic, NOT folds) has
  `data-layer="joins"` → **Joins** layer in the SVG export, under Design.
  Folds stay in Design (user: a fold is a picot).

### Save errors are shown (session 61)

`performSave` / `saveProject` (useProjectFile.ts) used to only
`console.error` a failed write — a refused folder (deny list), full disk or
read-only stick looked saved. Now `reportSaveError` → red message
`saveErrFailed`. The pattern stays unsaved (`setLastSavedRev` runs only
after success).

### Autosave on leaving + Resume back to its file (session 61)

- Autosave ran only every 3 min; on Android the app is usually ended by
  swiping it away → short sessions left none ("no autosave" on the splash).
  Now also on `visibilitychange` → hidden and `pagehide` (same effect,
  tattingindex.tsx).
- The payload adds `_resumeFilePath` (currentFilePathRef) and
  `_resumeUnsaved` (hasUnsavedChangesRef). `loadFromAutosave` reconnects:
  `setCurrentFilePath(path)`; `setLastSavedRev(path && !unsaved ? 0 : -1)`.
  So Save after Resume writes to that file; a moved / deleted file gives
  the save-error message → Save As.
- Splash label: the FILE's name when there is one (`fileDisplayName`) — the
  project-name field often still says "Untitled Pattern" after a save, which
  looked like a lost file.
- Test gotcha: reloading a page fires `pagehide` → the autosave is
  rewritten from the app's state (hand-edited localStorage is overwritten).

### Group names and colours in the file (session 63, review #3)

The group registry (`groups` state, tattingindex.tsx: `{id, name, color}[]`,
in Undo as `spatialGroups`) was never saved, so every group came back as
"Group" with the fallback colour. Now:
- `serializeProject` writes `spatialGroups` (**file version 92**; older
  files have none → `[]`, older app versions ignore the field).
- `normalizeSpatialGroups` (domain/patternOutput.ts) on open
  (`applyProjectData`) and Resume: keeps entries with a string id (no
  duplicates), a text name (≤ 200 characters) and a real colour (else
  `#888888`); `sanitizeProjectColors` also covers `spatialGroups[].color`.
- The first Undo entry after open / Resume / New carries `spatialGroups`
  (the history entry type gained the field).
- Tested: save → the registry is in the file (a bad colour replaced, a
  malformed entry dropped); Resume keeps it; New → Save has none.

### Resume can't write older work over a newer file (session 63, review #4)

The bug: autosave (timer / background) → more edits → Save → crash or
close → next start "Resume: X" opened the OLDER autosave, reconnected to X,
and Save wrote it over the newer file without asking (reproduced in a
browser test). User's decision: parts 1 + 2 + 3 below.
1. **Autosave right after every successful save** — `saveToPath`
   (useProjectFile) calls `p.onSaved({ filePath, name, stillUnsaved })` →
   `autoSaveNowRef.current(...)`. The overrides are needed: right after a
   save `currentFilePathRef` / `projectNameRef` / `hasUnsavedChangesRef`
   still hold the old values (they follow state on the next render);
   `stillUnsaved` = an edit made while the file was being written.
2. **Autosave before the window closes** — the `close-requested` handler
   calls `autoSaveBeforeClose()` before every `destroy()` (clean close and
   "close anyway"; the latter keeps the unsaved work for Resume). Whether
   `pagehide` still runs after `destroy()` isn't guaranteed.
3. **Fingerprint check** (`utils/fileFingerprint.ts`, `fingerprintText` =
   length + cyrb53 of the file's text; not security). `fileFingerprintRef`
   (tattingindex) = the current file's text as this app last opened it
   (`readAndApplyProjectFile` reads the raw text, `applyProjectData(…,
   { fingerprint })` stores it with the path) or saved it
   (`writeProjectFile` now returns the text). Null with no file (New,
   samples, handed-over Android copies). The autosave keeps it as
   `_resumeFileHash`. Resume sets it back and sets
   `verifyFileBeforeSaveRef = true` when it reconnects to a file.
   `saveProject` (Save / Ctrl+S, not Save As) then reads the file first:
   same fingerprint → save; file not found → save (nothing to lose);
   changed, unreadable, or no fingerprint (an autosave from before session
   63) → **"The file has changed"** dialog: **Overwrite** (red, confirm) /
   **Save As…** (blue — `cancelPrimary`, new optional field of the confirm
   dialog) / ✕ or Esc = nothing saved. Any successful save or a new open
   clears the check; it runs only for the first Save after a Resume.
- New texts: `fileChangedTitle`, `fileChangedBody` ({name}),
  `fileChangedOverwrite`; the Save As button reuses `fileSaveAs`.
- Tested (Playwright, Vite dev server, mocked Tauri with an in-memory file
  system; each "run" a fresh browser context = the app dying): the bug
  scenario (autosave now matches the file, Resume opens the newest work,
  Save writes without asking); file changed elsewhere → dialog → Save As /
  Overwrite / Esc each do the right thing, and the next Save doesn't ask
  again; old autosave without fingerprint → asks; file deleted → saves;
  resumed unsaved work with the file unchanged → saves; close with and
  without unsaved changes → autosave written before `destroy`. **The real
  desktop close is for the user to test.**

### Crash screen (session 63, review #6)

`components/AppErrorBoundary.tsx` wraps the whole app (main.tsx). Before,
an error while drawing unmounted everything: a blank window, and X did
nothing (lib.rs blocks the close and asks the page, whose listener had gone
with the app). Now a screen: **Save a copy…** (blue) / **Restart** /
**Close** (desktop only), a hint that Restart keeps the work via "Resume",
and a "Details" fold with the error message.
- The screen can't read app state, so tattingindex registers two functions
  in `utils/emergencySave.ts` from the autosave effect — `snapshot()` (the
  autosave payload, `buildAutosavePayload`) and `autosave()` — and
  deliberately never unregisters them. They read refs, which hold the last
  state that was drawn successfully (a render that throws isn't committed).
- Save a copy → `showSaveDialog("<name> (recovered)")` + `writeProjectFile`
  of the snapshot without the `_resume…` / `autoSaved` fields. Restart →
  `autosave()` then `location.reload()`. Close → `destroy()`.
- On a crash it listens to `close-requested` itself, so X closes again.
- Texts are built into the component (en / es / hu, picked from
  `tcad_language`) — the app's translations may be what broke.
- Also: `sanitizeProjectNumbers` treats a `notation` / `notationB` that
  isn't text as damage (a number there crashed the app on open — the
  reproduction); with `{ requireStructure: true }` (paste and Resume) also
  a missing id, an unknown type or no paths list. File open keeps its own
  whole-file refusal for those (unchanged).
- Error boundaries catch errors while drawing and in effects, not in click
  handlers; the realistic bake catches its own per-element errors.
- Tested: an error injected into circle-ring picot drawing (test-only
  module rewrite) → screen shown; Save a copy writes the last good state;
  Restart → start screen with Resume holding it; Close and X close. Old
  code: blank window, no close listener left. A file with a number as
  notation opens with "1 damaged element(s) were left out."

### Autosave when storage is full (session 63, review #8)

The autosave failed silently when browser storage was full (shared with
the Recent thumbnails on Android; the reference image, up to ~1.1 MB, is
the biggest part). Now: write → if it throws, write again **without the
reference image** and with `_refImageOmitted: true`, warn once
(`autosaveNoImage`); if that fails too, warn once (`autosaveFailed`) — the
last autosave that fitted stays. `autosaveWarnedRef` resets after an
autosave that works. **Resume** of an autosave with `_refImageOmitted`:
reads the pattern's file (`readProjectFileText`) and takes its
`referenceImage` (as of its last save) + `markSettingsBaseline()`; no file
or no image in it → `resumeImageMissing`. Texts: `autosaveNoImage`,
`autosaveFailed`, `resumeImageMissing`. Tested by filling localStorage
(old code: no autosave, no message).

### Raw keys in the group-merge dialog (session 63, user report)

The "Merge groups?" confirm (Group on a selection that already holds
groups) showed `groupMergeTitle` / `groupMergeBody` / `groupMergeConfirm`
in every language. **Why:** `groupSelected` (useEditorActions) is a
`useCallback(…, [])`, created on the first render; its `p.t` is that
render's `t`, and before the language files load `t` returns the key
itself (the built-in TRANSLATIONS object is empty). **Fix:** the texts are
functions of `t` (`tt => tt('groupMergeTitle')`), worked out when the
dialog draws — the confirm dialog's ConfirmText (session 62, H3). The hook
param type now allows ConfirmText.
- **Rule:** code created once (`useCallback` / `useMemo` / `useEffect` with
  deps that don't include `t`, listeners registered once) must not call `t`
  directly: give the dialog text functions, or read `t` through a ref
  (`tLiveRef`, `closeTRef`). A scan of all `t(` calls inside memoised code
  found no other case (session 63).
- Tested: before → raw keys in en and hu; after → "Merge groups?" /
  "Csoportok egyesítése?" with translated body and button.

### Toast: one timer (session 63, review #13)

`showLoadMsg` keeps its timer in `loadMsgTimerRef` and clears it before a
new message; the notation-copy messages (they set the toast and a timer
themselves) now go through `showLoadMsg` too. Before, every message started
its own timer and an older one hid a newer message early — the "damaged
elements" warning showed for 1.1 s instead of 4 s (measured with and
without the change). Rule: never `setLoadMsg` + `setTimeout` directly.

### Start screen reads the autosave once (session 63, review #9)

`splashAutosave` is a `useState` initializer (was an IIFE re-run on every
render — megabytes per frame during a drag). The start screen only shows at
launch, so the value from start is the right one.

### Repeat "R" in its round's colour (session 63, user request)

In Tatting Order (and with unnumbered shown) a repeat element's "R" used the
theme's repeat colours (`orderRepeatText` / `orderRepeatOutline`, grey) even
inside a round. `getRepeatBadgeColor(el)` (tattingindex.tsx, next to
`getRoundBadgeColor`): in a round → that round's badge colours, the same as
its numbers; in no round → the theme's repeat colours as before (so it
stays apart from the gold "unassigned" numbers). Used by all three R
badges (circle rings, lines, other paths). Checked on DAL_Snowflake_2026:
24 R badges match their round's numbers, one moved out of its round stays
grey.

Assign Repeat (TattingOrderModeBar) was disabled for any element that was
already a repeat, so moving a repeat to another round took two clicks
(Assign to Group, then Assign Repeat). It is now disabled only when the
repeat is already in the round chosen in the dropdown; `assignRepeat` sets
`roundId: activeRoundId`, so one click moves it (the R key always did).
Undo is off inside Tatting Order (as before); the step undoes after Exit Mode.

### Callbacks made once: stale-value audit (session 63)

A `useCallback(…, [])` keeps the first render's values. Audited all 39
memoised callbacks and 20 run-once effects. Rules that hold now:
- Inside a `[]` callback, read state through a ref (`…Ref.current`) and
  texts through `tRef.current` (useEditorActions) or a ConfirmText function
  `tt => tt('key')` (dialogs) — never `p.t` directly: before the language
  files load the first `t` returns the key itself.
- A callback with a deps list lists `p.t` when it shows text (useProjectFile
  callbacks do; `exportSVG` was missing it).
- Fixed with this: new groups were named "groupDefaultName N" (raw key);
  `applyProjectData` renames such names to `t('groupDefaultName') N` on
  open, so files saved with the bad name heal on their next save.

### Resume goes through file open (session 63, review #15)

`loadFromAutosave` (tattingindex.tsx) used to be its own copy of file
open, and had drifted: the first Undo entry held the elements before repair,
and it skipped the stale-join clean-up, the old-field migration, the
duplicate check and the camera / zoom checks. Now it checks the autosave
(colours; numbers + structure with `requireStructure`, damaged elements →
toast) and calls `useProjectFile.applyProjectData(data, resumePath,
{ fromAutosave: true, fingerprint: _resumeFileHash })`. `fromAutosave`
skips `onFileApplied` (re-centring — Resume keeps the saved view), the
"Load completed" toast and the Recent entry / thumbnail. Then, in the same
synchronous run (so they win over what `applyProjectData` set): the
saved / unsaved state from `_resumeUnsaved`, `verifyFileBeforeSaveRef`
(review #4), the thread preset into the preset list (Resume always did
this; file open doesn't), and the `_refImageOmitted` image restore
(review #8).

### Small Low fixes (session 63, review #12, #14, #16–#20)

- **#12** `exportSVG` (useProjectFile): a write error goes through
  `reportSaveError` → `saveErrFailed` toast. It was only logged.
- **#14** `useInputHandlers`: Shift locks a drag to one axis; letting go of
  Shift mid-drag used the locked offset from then on, so the element sat off
  the pointer. The unlocked branch now recomputes the delta from the drag
  origin (`world − origin − dragOffset`).
- **#16** `safeFileName(name, fallback = 'Pattern')` (tauri/file.ts):
  only characters a file name can't hold (`\ / : * ? " < > |`, control
  characters) become `_`; spaces and accents stay; trailing dots / spaces
  are dropped (Windows). It used to turn spaces into `_` too.
- **#17** the dialog helpers take `DialogTexts = { title?, typeName? }`;
  every caller passes translated texts (`fileSave`, `fileLoad`,
  `fileExportSvg`, `themeSaveFile`, `fileTypePattern / Svg / Theme`). The
  Recent list's nameless entry shows `projectUntitled`. Left as is: the
  order bar's `title="Delete"` names the Delete key (like `title="R"`).
- **#18** removed the unused keys `picotWizardCompactApply`,
  `picotWizardFillPreview`, `picotWizardScaleCustomLabel`,
  `picotWizardScalePreview` (all six files) and the thumbnail /
  `openExternal` debug logs.
- **#19** file.ts's header describes today's asset scope (allow `**` +
  the 68-entry deny list, same as `deny-sensitive.json`). Help-page text is
  the user's to paste (user's rule: Claude doesn't edit the help) — the
  snippets are in `docs/help-snippets-session63.html`.
- **#20** `useEditorActions` takes `pruneSelection(elements)` and calls it
  after Undo and Redo: `selectedIds`, `selectedPicots` and the bead-element
  selection keep only what still exists (chain ends `__start__` / `__end__`
  kept). Undo of a new ring used to leave "1 object selected" with 0
  elements.

### Android writes: no second try (session 63, review #7)

`writeTextAnywhere` (tauri/file.ts): a content:// write that fails in
android-fs is now an error (Save shows "couldn't save", the file stays as
it was). It used to retry with plugin-fs, which may open the file without
truncating it — a shorter save could leave old bytes at the end. Reads keep
their fallback. Not testable here — user test on the phone.

### Android files: kept access, Recent that survives a restart (session 61)

Tauri's dialog plugin opens with `ACTION_GET_CONTENT` (temporary grant, a
TODO in its source) and never persists Save's `CREATE_DOCUMENT` grant →
after a restart every Recent entry was unreadable.
- **tauri-plugin-android-fs 30.2.0** (crate `=30.2.0`, `.plugin(
  tauri_plugin_android_fs::init())` in lib.rs; npm
  `tauri-plugin-android-fs-api` 30.2.0 exact — must match). Compiles on
  desktop as a no-op. Permissions: `capabilities/android-files.json`,
  `platforms: ["android"]`, 7 entries (open/save picker, persist / list /
  release persisted, read-text, write-text).
- tauri/file.ts, Android only (UA check), module loaded by dynamic import:
  `showOpenDialog` → `showOpenFilePicker({ needWritePermission: true })`,
  `showSaveDialog` → `showSaveFilePicker(name, 'application/octet-stream')`;
  both → `keepAccess` (`persistPickerUriPermission`). Reads / writes of
  content:// → android-fs (`readTextAnywhere` / `writeTextAnywhere`; falls
  back to plugin-fs); its write truncates first (a shorter save can't leave
  old bytes).
- `syncKeptAccess` (after addToRecents and on getRecents): hands back kept
  access for addresses no longer in Recent (Android caps the number);
  `keptThisRun` protects ones kept in this run.
- `checkFileExists` on content:// = try to read (the fs `exists` doesn't
  understand content://; it said "File missing" for every Android entry).
- **Thumbnails on Android** = a PNG data URL stored in the Recent entry
  (`thumbPath`), not a file (a sibling `_thumb.png` can't be created at a
  content:// address). `thumbSrcFor` passes data URLs through; on a full
  localStorage the list drops thumbnails, keeps entries. **Guard (all
  platforms):** never write a thumbnail whose path equals the pattern's
  (a path without .tatcad / .json used to give that).
- **Names:** `fileBaseName` / `fileDisplayName` decode content:// (`raw%3A…
  %2FSnow.tatcad` → "Snow.tatcad"); an address with no name (`msf%3A1234`)
  → the pattern's own name. Used by Recent, saveToPath, applyProjectData,
  the window title.
- Files handed over by other apps (Open with / Share) keep a temporary
  grant only — opened as an untitled copy, not in Recent (unchanged).
- Tested with a simulated Android shell in the browser (Save → restart →
  Recent → Load; old access handed back). First real test: the user's phone.

### Security: deny list — folders the app may never touch (session 61)

Third wall, behind safeColor and the CSP. `default.json` still allows `"**"`;
`capabilities/deny-sensitive.json` adds a **global `fs:scope` deny list**
(53 paths; **68 since session 63**, see below), and `tauri.conf.json` → `assetProtocol.scope` is now
`{ allow: ["**"], deny: [same list] }` (thumbnail loader). Deny always wins.
- Covers: `.ssh`, `.gnupg`; Windows dirs, Program Files, both Startup
  folders, Credentials / Protect, PowerShell profiles, browser profiles,
  `EBWebView`; macOS LaunchAgents, Keychains, Cookies, WebKit, Safari,
  browsers, `/System` `/Library` `/Applications` `/private/etc`; Linux shell
  rc files, autostart, systemd user units, `.local/share/applications`,
  browsers, `/etc` `/usr` `/bin` `/sbin` `/lib` `/boot`; Android
  `$APPDATA/app_webview|shared_prefs|databases|no_backup|code_cache`,
  `/system`, `/vendor`.
- **Session 63 (review #11):** + credential dot-folders and files, added
  right after `.gnupg` in BOTH lists (68 entries each, checked equal):
  `.aws/**`, `.azure/**`, `.config/gcloud/**`, `.config/gh/**`,
  `.docker/**`, `.kube/**`, `.git-credentials`, `.gitconfig`,
  `.config/git/**`, `.netrc`, `_netrc`, `.npmrc`, `.pypirc`,
  `.cargo/credentials`, `.cargo/credentials.toml` (all under `$HOME`).
  **Why only Windows needed it:** Tauri's scope glob requires a literal
  leading dot on macOS / Linux, so `"**"` never matched dot-names there; on
  Windows it does. The user's deny-sensitive.json uses CRLF (kept).
- Facts checked in Tauri's source (crates/tauri/src/scope/fs.rs,
  plugins-workspace fs commands.rs):
  - a path variable a system doesn't have is **skipped** — one list is
    safe on every OS;
  - each pattern is stored as written AND canonical (`\\?\C:\…`);
  - matching is case-sensitive, but plugin-fs **≥ 2.7.0** resolves the real
    path of the nearest existing parent first (`resolve_real_path`) — so
    `c:\users\…\startup\x` can't dodge a deny entry. Keep plugin-fs ≥ 2.7.0;
  - on macOS / Linux `require_literal_leading_dot` is on → `"**"` already
    skips hidden folders (`.ssh`, `.config`); on Windows it doesn't;
  - Android: `$APPDATA` = `$DATA` = `$LOCALDATA` = `$CONFIG` = the app's
    private folder `/data/user/0/com.savarosa.tattingcad`; the web view's
    data is in `app_webview` there.
- The app never reads its install folder (no resource reads via fs), so
  Program Files / `/usr` / `/Applications` can be denied.
- Tested by the user (Windows): Save As into `%APPDATA%\…\Startup` → refused
  (no file). Program Files is refused by Windows itself first ("You don't
  have permission…").
- **Rule:** adding a folder → add it to BOTH lists. A narrower *allow* list
  was rejected (see the CSP section).

### Help pages: no Print in the Android app (session 61)

Android's web view ignores `window.print()`. Both help pages' script has a
block "ANDROID APP: NO PRINT" that hides the 🖨 button when the UA is
Android AND `__TAURI_INTERNALS__` exists (own window or parent) — a phone
browser keeps it. Not part of fix-help-pages.mjs: copy the block into new
translated help pages by hand. (Help still says patterns save as `.json` —
user to update the line.)

### Code review and fix tracker (session 62)

Two review docs (claude.ai Docs) hold the findings, each with a fix tracker:
- **tattingCAD — Code Review (session 62)**
  (https://claude.ai/artifact/PEAEpoCRQ7MUWDshtzcRBD) — the whole app, #1–#23.
  **Fixed in session 63: all of it, #1–#23** (see the "(session 63)"
  sections). Tested by the user: #1, #2, #3,
  #22 (bjp), #23 — the rest wait for user tests (handoff-session63.md). Its line numbers are
  from before the session-62 fixes.
- **tattingCAD — tattingindex.tsx deep dive**
  (https://claude.ai/artifact/JMQPNq4SboQzGePJH15L3v) — H1–H7, M1–M6,
  L1–L6. All fixed except L4 (parked with ghost arrays). Each item has a
  "Fixed (session 62)" note with what changed and how it was tested.

Way of working (user's rule): findings first; each fix agreed one by one;
discuss first for geometry and tatting semantics. Each fix was tested before
delivery — functions extracted from the source and run with `npx tsx`
(old vs new where possible), Playwright on the Vite dev server with an
injected `tatting-designer-autosave` + Resume (and a mocked
`__TAURI_INTERNALS__` for file hand-over), and the same browser test run
once on the old code to prove it catches the bug. The test scripts lived in
the session's scratch folder, not the repo.

Still to test on a device: M1 (touch cancelled mid-drag, phone) and M5
(remove the open file from Recent, then Save — Android).

### Flip keeps joins; a split-ring flip swaps its sides (session 62, H1 + H4)

- `flipElements` works out `updated` from `elementsRef.current` outside any
  updater, commits once (one undo step) and fixes the connections in the
  same pass.
- A flip reverses the loop, so new picot *i* = old picot *n−1−i* for every
  shape. `carryPicotIdentity(oldPicots, newPicots)` copies `id` and
  `isJoint` across when the counts match and each pair's `picotKind`
  matches — joins survive a flip (they used to be cut). A chain's
  `__start__` / `__end__` joins swap ends. A connection whose picot is gone
  is removed and its far side demoted (`applyJointFlags`).
- **Split ring (user's decision, after testing):** a flip swaps sides A ↔ B
  and does NOT reverse either notation ("reversing notation is a bug").
  `notation` ← `sr: <old B>`, `notationB` ← old A; picots rebuilt from both
  sides, identity carried as above.

### Split-ring side A: counted from the shared start (session 62, H5 + H6)

Reminder: picots are stored as `[...side A reversed, ...side B]`, and side
A's notation reads from the END of `paths[0]` — the shared start point (the
direction arrow's tail).
- **One rule** (`domain/parser.ts`): `splitRingSideAPosition(p, countA) =
  countA − stitchesBefore − (isSlotBead(p) ? 1 : 0)`. Slot beads (`bc`,
  `bcp`, `be`) take one stitch; the formula is its own inverse. Used by the
  notation edit (`computeElementAfterNotationEdit`), the flip and Picot Tools
  (`splitRingSides`). Side-A slot beads used to land one stitch off.
- **Old files:** `repairSplitRingSideABeads(el)` fixes side-A slot beads
  stored the old way (matched by order against side A's notation; returns
  the same object when nothing changed, so it's a no-op on new files). Run
  on file open (`applyProjectData`), Resume (`loadFromAutosave`) and
  system-clipboard paste.
- **Drawing:** a slot bead's side is judged by its centre (`sb + 0.5`) in
  `renderPicots` and `getSplitRingSide`.
- **Labels:** both split-ring label branches lay side A's stretches out from
  the shared start (`count − midpoint`), with or without picots.
- **Realistic:** `calculateSplitRingStitches` steps like
  `calculatePathStitches` (0.5 steps when there are half keys, rds 1.5 wide,
  `rds-cont` skipped, array sub-stitches split); side A's
  `dsPosition = count − s − width`.
- `splitRingSides` counts side A's picots by **parsed** picots — a bead
  sequence (`bc:YZ`, `bc:2Y`) is one token but one picot per bead.
- **Gradient (session 63, review #23 — user's decision):** side A's
  gradient thread colour now runs from the shared start too, like
  everything else on side A: realistic stitches use the notation start
  (`notationStart / count`), split-ring picots and `getPicotPositionFraction`
  (join-line colours) use `splitRingSideAPosition`. It used to run from the
  far end (session 52). Side B unchanged. Schematic gradients are drawn
  across the shape's box (`url(#gradient-…)`), so they don't depend on it.

### Notation edit: picot ids by position AND order (session 62, H2)

`mergePicotsPreservingJoins`, when the picot count changes: old picots are
kept in a list per `stitchesBefore` and handed out in two passes — the same
`picotKind` first, then whatever is left at that spot. Two picots at one
spot keep their own ids and joins (they used to get the same id); a picot
removed from a spot it shares with a bead doesn't hand its join to the bead;
`p-p → p-lp` still keeps both joins. Note: `p-p`, or a picot next to a bead,
is flagged as invalid notation (red) but still applied.
**Session 63 (review #22, user's decision):** a joined picot keeps its join
across a change of KIND at its spot only if the new kind can be joined —
`canHoldJoin`: no `beadType` (p, lp, cj, …), `bjp:`, `bcjp:` (parseable
since session 63 — see "`bcjp:` — core bead + joining picot"), or a `be` with
`beIsJoint` (the same rule as Join-mode selection, useInputHandlers.ts).
`3ds-p-3ds → 3ds-bc:Y-3ds` now drops the join (the usual "this edit removes
a join" warning, then the far side is demoted); `→ 3ds-bjp:Y-3ds` or
`→ 3ds-lp-3ds` keeps it. An unchanged kind always keeps its join (an old
file's joined `bp` stays). Applies in both the order and the position
branch (`joinCarries`). Tested through the property bar's notation field.

### Picot Tools — every stitch type (session 62, H7)

- A run keeps its stitches in order: a `WizardSegment` run has
  `stitches: WizardStitch[]` (`{ type, n }`), `count` (stitches) and `ds`
  (LENGTH, by `STITCH_WIDTH_DS`: ds 1, ss/lss/rss 0.5, rds/bds 1.5). Every
  action writes the stitches back with their own types; same-type
  neighbours are joined (2ds + 3ds → 5ds). It used to keep one ds total per
  run and write `Nds`.
- **User's decisions:** Add, Fill and Scale count **stitches**, not length;
  a cut falls only between stitches (`4rds` → `2rds-p-2rds`). Scale keeps
  each run's types (`2rds-p-6ds` ×2 → `4rds-p-12ds`, ÷2 → `1rds-p-3ds`); a
  run of several types gives each its share by cumulative rounding
  (`2ds-2rds` ÷2 → `1ds-1rds`).
- **ds-only notation gives exactly the old result** (4,000 generated
  notations, 139,779 checks across every action, the protected zones and
  the presets).
- Fixed on the way: half stitches became ds (`r: 2ss-3ds-p-3ds` → Clear →
  `r: 7ds`); an odd count gave a fraction the parser rejects (`9.5ds`), so
  Apply did nothing; Scale's "→ N ds" showed the target, not the result
  (`ScaleResult.actualTotalDs` is now the real length); a split ring with
  picots on both sides never got an exact preset; multi-select Scale
  skipped rds / half-stitch rings.
- **API:** `totalRunStitches(segments)` — the multi-select Scale presets use
  it (MultiSelectSummaryBar prop, replaces `totalRunDs` there).
  `suggestScalePresets(sides: { type, segments }[])` — one entry per side
  (a split ring scales each side on its own, as Apply does); "exact" also
  needs every stitch token to scale to a whole number; `resultingTotalDs` is
  the length Apply gives. `ScaleResult` adds `originalStitches` /
  `actualStitches`; `RunScaleDetail`'s `*Ds` fields are stitch counts.
- The old `jk` `runToken` special case is gone (the runs' own `ss` type does
  it). A gap the nudge rule fills gets ds — ss on a Josephine knot.
- Still refused: bead sequences (`picotMismatch`) and unknown tokens — and,
  since session 63, invalid notation (`reason: 'invalid'`, see below).
- **Session 63 (review #21, user: "two picots sitting next to each other
  isn't a valid notation"):** `analyzeNotation` first runs the parser's
  `isNotationValid` — notation with a red glow is refused (`'invalid'`) and
  the panel says `picotWizardInvalid` ("Fix the notation first …"); the
  multi-select Scale counts such elements as skipped and shows the same text
  when every one is invalid. So the only zero gaps Scale meets are a picot
  (or bead) at the very start — 0 scales to 0, it always stayed — or at the
  very end: `scaleSegments` now pins that one to the new end (`endPinned`;
  trailing gap 0, the backward nudge pass counts only inner gaps):
  `c: 6ds-p` ×2 → `c: 12ds-p` (was `11ds-p-1ds`), `r: 3ds-p-3ds-p` ×2 →
  `6ds-p-6ds-p`. `isExactSide` accepts a gap that was 0 to begin with, so
  `c: 6ds-p` gets ÷2 / ÷3 as exact presets. Checked old vs new on 6,000
  random valid notations × 9 factors: every result without an end picot
  identical (40,257), every one with an end picot keeps it (13,743), every
  result valid, presets unchanged unless there's a start / end picot.

### Opening a file while last session's work is unsaved (session 62, H3)

- When a file is handed over (double-click / Open with / Share) and the last
  run's autosave holds unsaved work nobody has resumed, `openSystemFile`
  asks first: **Open file anyway** (red) or **Resume last session**.
  Closing the box does neither, and it asks again next time.
- `unresumedWorkRef` (lazy, from the autosave: elements > 0 and
  `_resumeUnsaved !== false`; older autosaves without the flag count as
  unsaved) is cleared once this run writes its own autosave, and on Resume.
- Confirm dialog (`useUIState.ts`): title / message / labels may be
  functions of `t` (`ConfirmText`, resolved by `confirmText()` at draw time)
  — a dialog opened before the translations load (a start-up file) would
  otherwise show raw keys. Optional `cancelLabel` / `onCancel`.
- Keys `resumeBeforeOpenTitle/Body/Open/Resume` (en/es/hu).

### Touch cancel (session 62, M1)

The canvas has `onTouchCancel` (the system takes the touch away: back-swipe,
notification shade, a call, palm rejection): it ends everything as if every
finger had lifted — the drag commits as one undo step, `touchState` is reset
(a cancelled pinch used to leave `dist` set, so one-finger moves did
nothing). The document safety net listens for `pointercancel` as well as
`pointerup`.

### Escape order (session 62, M2)

The closer list is ordered top layer first: the setup screen (no-op),
Confirm, Alert, the tatting-order conflict box (= Cancel), the convert
confirm, Array Manager, the Recent-load and remove-image confirms, the
update popup (= its close button), splash, sample gallery, Recent Projects,
theme editor, colour picker, materials, About, Help, UI guide, bead
library, polar-grid panel, thread properties, the three array dialogs,
Picot Tools, multi-select Scale, the File / View / Arrange / Options / Help
menus, the phone menu, **realistic view**, then the editing modes.
- Esc on a Confirm box closes it without choosing either button (the same
  as clicking outside it).
- Realistic view sits above the modes on purpose: a mode stays on under
  realistic view, and Esc should leave the view you can see, not end a mode
  you can't.
- **Rule:** a new dialog, popover or menu goes into this list at its layer.

### Shortcuts and a focused dropdown (session 62, M3)

`isDropdownKey(e)` (next to `isTypingTarget`): while a `<select>` has focus,
plain printable keys, Space, Backspace and Delete stay with the dropdown
(jump to an option / open it). The main handler and the R / Space / Z
handler skip them. Ctrl / Cmd / Alt shortcuts still work; clicking the
canvas moves focus to the page, so every shortcut works again. Sliders are
left alone on purpose (see the `TEXT_INPUT_TYPES` comment); Tab still
switches tools.

### Main shortcut handler: registered once (session 62, M4)

The main keydown listener is attached once (capture phase) and calls
`mainShortcutRef.current`, which an effect with **no dependency list**
points at a fresh handler after every render — the `escapeActionRef`
pattern, same timing as before. It used to have deps `[saveProject]`, which
looked like "rebind only on save changes" but rebound every render (drag
frames included) only because `saveProject` is a new function each render
(`cleanupDuplicates` in useEditorActions isn't memoised) — memoising it
would have frozen every value the handler reads. That's safe now.
**Rule:** don't give a big handler effect a dependency list as a substitute
for freshness; call through a ref.

### Recent Projects list read once; the open file keeps its access (session 62, M5)

- The dialog reads `getRecents()` once when it opens (state `recentList`,
  set in the existence-check effect) — it used to run inside the render,
  rewriting `tcad_recent_projects` and (Android) going through the kept
  file access on every redraw. ✕ calls `removeFromRecents(id)` (writes the
  list, runs `syncKeptAccess`, returns the list). "Clear unavailable" still
  closes and reopens the dialog, which reads the list again.
- `protectFileAccess(path)` (an effect on `currentFilePath`) adds the open
  file to `keptThisRun`, so `syncKeptAccess` never hands back its Android
  access — ✕ on the open file's entry used to make the next Save fail.

### Reference image size cap (session 62, M6)

`utils/refImage.ts` `shrinkReferenceImage(src)`: at most 2048 px on the
longest side (`REF_IMAGE_MAX_SIDE`) and `REF_IMAGE_BUDGET` = 1.5 M data-URL
characters (~1.1 MB). Opaque → JPEG 0.85 (then 0.75, then 1600 / 1280 /
1024 px until it fits); any transparency → PNG. An image that already fits
is left exactly as it was.
- **Upload:** reduced, toast `refImageReduced` ("… reduced to W × H px so it
  fits in the autosave"). The 10 MB upload limit is unchanged.
- **Open / Resume** of an older, larger image: reduced quietly (a
  functional update that only applies if the image is still the same one);
  not marked unsaved — the file gets the small image at the next Save.
- The image is drawn into the fixed 1000 × 1000 box, so its position and
  size never change. A failed autosave is still silent (review #8).

### History pushes: push what you commit, or let the automatic push do it (session 62, L1 + L2)

- `setSingleRotationAbsolute` (rotation field, ±90°, held ±1°): works out
  `next` from `elementsRef.current`, commits it, and when it pushes sets
  `skipAutoHistoryRef` and pushes exactly `next`. On release with no further
  change it pushes the state as it stands, so a held nudge is ONE step.
- Convert to JK: no hand-made push. Everything (ghost regeneration, the id
  remap, re-applied inherited joins) happens in the one confirm handler, so
  the automatic push records the finished state (elements, connections,
  ghost arrays) as ONE step. The hand push recorded the connections from
  before the regeneration, and one Undo landed on a mixed state.
- **Rule:** never push `elementsRef.current` right after a
  `setElements(prev => …)` — that's the OLD state.

### One zoom range (session 62, L3)

`MIN_ZOOM` 0.1, `MAX_ZOOM` 3 and `clampZoom()` at the top of
tattingindex.tsx (next to the zoom step constants), used by Shift+wheel, the
zoom keys and buttons, zoom-to-box, Show all and pinch. Show all and pinch
used to stop at 30 %, so Show all couldn't fit a large pattern.

### Small clean-ups (session 62, L5 + L6)

Removed the Tatting Order Delete / Backspace branch that could never run
(Delete there is handled at the top of the shortcut chain) and an empty
`else {}` in the pending-notation effect; fixed stale comments (autosave
timing, join-line style).

### Thread presets: needle vs shuttle technique (session 59)

A thread preset now has an optional `technique` (`'needle'` default when
absent, or `'shuttle'`) and, for shuttle, `ds20Ring` (mm of shuttle thread
for a 20 DS ring). Existing presets are needle — unchanged behaviour.

- **Needle** (original model): every element = working thread
  (`ds20Working`) + core (`ds20Core`) per stitch.
- **Shuttle:** rings (closed elements, incl. split-ring sides) use only the
  shuttle thread (`ds20Ring` per 20 DS, picots too); chains and lines use
  ball thread for the stitches (`ds20Working`, picots too) over shuttle
  thread as core (`ds20Core`). The estimate (domain/patternOutput.ts) then
  prints **Shuttle thread ~ m (rings + chain cores)** and **Ball thread ~ m
  (chain stitches)**, plus a per-colour list when there are several
  materials. Joined-picot allowance goes to the element's side (ring →
  shuttle, chain → ball). `ds20Core` still sets the real-world scale
  (ruler, polar-grid mm) for both techniques.
- **Thread Properties:** Needle / Shuttle switch above Measurements; shuttle
  shows "20 DS ring (shuttle thread)", "20 DS chain – ball thread", "20 DS
  chain – shuttle thread", a hint line, and a matching per-stitch summary.
  First switch to shuttle pre-fills `ds20Ring` = working + core.
- **Built-in "Size 20, Shuttle Tat (Tim)"** (`TIMS_TAT_PRESET`, id
  `tims-tat`, hooks/useBeadState.ts): size 20 thread, shuttle, ring 203,
  chain ball 236.5, chain shuttle 36.5 (Tim's measurements of a 20 DS ring
  and chain); picots 8 / 5 are the default's until Tim measures them. The
  first build named it "Tim's tat"; the loader renames copies still carrying
  exactly that name (a user-chosen name is kept). Fresh installs get it
  in memory (nothing written — `tcad_thread_presets` is an "existing user"
  signal for getInitialToolbarMode); existing installs get it once
  (`tcad_builtin_presets_added` remembers, so deleting it sticks). Add
  future built-ins to `BUILT_IN_EXTRA_PRESETS`.
- Checked: 1 ring + 1 chain (6ds-p-6ds each) with Tim's tat → shuttle
  0.15 m, ball 0.15 m (hand-computed 151.7 / 149.9 mm); default needle
  output unchanged.

### Simple / Full toolbar and the getting-started hint (session 58)

- **Simple** (default for fresh installs): one labelled column — Select,
  Pan, Ring, Split ring, Chain, Picot Join, Delete, Zoom −/+, Show all,
  Reference image, Notes, "More tools ›". **Full**: the original 2-column
  icon grid of every tool, plus "‹ Simple". Hidden tools keep their keyboard
  shortcuts. Mode: `toolbarMode` (useViewState.ts).
- **Start tool:** Select in Simple, Pan in Full (useCanvasInteraction.ts).
  Leaving realistic view or closing the reference-image tool returns to
  Select in Simple. handleSetRenderMode reads the mode via
  getInitialToolbarMode() (localStorage), not state, because the V-key
  listener can call it from an older render.
- **Hint:** GettingStartedHint.tsx in the property bar's last branch
  (nothing selected, no mode, not the image tool). Element count excludes
  ghosts.
- **Splash:** "Getting Started" now has the same style as "Load Project"
  (it looked disabled before).

### Unsaved changes — history edit numbers (session 58)

**One check** drives the title star, the close-window warning and the
"load anyway?" / New Project prompts:

    currentHistoryRev = history[historyIndex]?.rev ?? 0
    hasUnsavedChanges = (currentHistoryRev !== lastSavedRev || settingsChanged)
                        && (elements.length > 0 || currentFilePath !== null)

**Session 63 (review #2): `settingsChanged`.** Settings saved in the file but
outside Undo — notes, materials, the reference image and its settings,
background colour, thread size (`dsWidth`) and active thread preset, bead
library — were missed, so closing lost them without a warning.
`settingsKey` (useMemo, tattingindex.tsx) = `projectSettingsKey(…)`
(domain/patternOutput.ts) of those values (the reference image by its
fingerprint, `referenceImageFingerprint`, memoised separately);
`settingsChanged = savedSettingsKey !== null && settingsKey !==
savedSettingsKey`. `savedSettingsKey` is set:
- after a save — from the data WRITTEN (`onSaved({ settingsKey })`);
- after open, Resume and New — `markSettingsBaseline()` bumps
  `settingsBaselineGen` as the load's LAST state update; an effect on it
  copies the key of that render (React 18 batches the load's updates, so
  it sees all of them). `applyProjectData` calls it via
  `p.onSettingsBaseline`. Also after a reference image is shrunk on open
  (M6 — the same picture, not an edit) and once at app start.
- View settings (camera, zoom, grid, render mode, custom palette) are left
  out on purpose. Group names / colours and rounds go through Undo.
- Tested: opening each shipped sample + a test file, and Resume of each →
  no star; a notes edit → star and the close question; Save → clean.

- Every entry pushed by pushHistoryState gets a new, ever-increasing `rev`
  (module counter in useHistoryActions.ts). Entries created directly with
  setHistory (New Project, open file, resume autosave) have none → 0.
- `lastSavedRev` (useProjectState.ts): set on save to the rev of the entry
  being written — captured BEFORE saveToPath's awaits, so an edit made while
  the file/thumbnail are written stays unsaved. Open file → 0. New Project →
  0. Resume autosave → 0 if it belongs to a file and had no unsaved changes,
  else -1 (session 61 — see "Autosave on leaving + Resume back to its file").
- **Why not indices** (the old lastSavedHistoryIndex): opening a file reset
  historyIndex to 0 but not the saved index; once the 50-entry cap is
  reached every new edit lands on index 49, so after a save at 49 later
  edits looked saved and closing the app did NOT warn; and undo-then-edit
  puts a different state on the same index. Revs fix all three.
- Undo back to the saved entry clears the star; redo onto it too.
- The close-warning listener reads `hasUnsavedChangesRef` and re-registers
  only when `t` changes.
- **Prompts:** File → New, File → Browse for File… and Load Project's
  doLoad ask only when hasUnsavedChanges (they used to ask whenever the
  canvas wasn't empty). A completely fresh, empty, untitled canvas: New
  does nothing.
- Verified in a browser harness (save/open dialogs stubbed): 18/18 title
  steps incl. the 50-cap case, 6/6 prompt cases.

### Window title (session 58)

`*Snowflake.json — TattingCAD` — file name only (from currentFilePath, folder
stripped), `*` = hasUnsavedChanges, `Untitled` (key windowTitleUntitled)
before the first save. The pattern-name field is legacy and NOT used. Set in
an effect via Tauri `getCurrentWindow().setTitle()` (guarded by
`__TAURI_INTERNALS__`, errors swallowed) and `document.title`.
**Needs `"core:window:allow-set-title"`** in
`src-tauri/capabilities/default.json` (added session 58, next to
allow-destroy). Without it the title silently stays "TattingCAD".

### Two-finger gesture: pinch zoom + pan (session 58)

onTouchStart (2 fingers) stores the world point under the fingers' midpoint
(`touchState.worldX/worldY`). onTouchMove puts that point under the CURRENT
midpoint at the new zoom: `camera = midpoint − world × newZoom`. Still
fingers = the old pinch exactly; moving fingers pan; both at once do both.
Zoom limits unchanged (0.3–3) at the time — session 62 made one range for
every way of zooming, 0.1–3 (see "One zoom range (session 62)"). Verified with emulated touch (pan, pinch incl.
the 300% cap, combined — all within 0.1 px). The user decided this after
first rejecting it; two fingers no longer "only zoom".

### Chain centre = chord midpoint; order badges (session 58)

A single-path chain's (and line's) `center` is its chord midpoint — what
addChain/addLine set and what moves, rotations and flips preserve. Before
session 58 the Path Edit endpoint drag on chains (smartEndpointDrag), the
legacy quadratic control drag (it moves the end) and line angle presets
(commitSinglePathUpdate) changed an end without updating center, so old
files can have a stale one (seen: ~85 units off). Now:
- those three paths apply `withChordCenter` (stitchGeometry.ts);
- file open and autosave resume apply it to every element (≈0.3 ms per
  5,000 elements; no shape changes, ghosts/rings/multi-path chains
  untouched);
- tatting-order badges on chains and lines (number AND "R") sit halfway
  along the drawn path (`orderLabelPosOnPath`, module level in
  tattingindex.tsx; chains sample 40, lines 20 — the values each site always
  used, verified identical on 4,000 random cases). The "R" used el.center
  before, which is why it floated away from reshaped chains.

### Update reminder clock (session 58 fix)

The splash's "Have you checked for updates?" overlay shows after **90 days
with the installed version** (`updateReminderDue`, a useState initializer in
tattingindex.tsx). `tcad_install_date` + `tcad_install_version`: when the
stored version differs from APP_VERSION (or no date yet), the date restarts
and nothing shows. Before session 58 the date was set once at the very first
run and never restarted, and localStorage survives updates/reinstalls, so a
new version asked immediately. Dismissing still stores `tcad_update_seen`.
Keep the key name `tcad_install_date`: getInitialToolbarMode uses its
presence to recognise an existing user.

### Release checklist — version number + security check (user's notes, session 57 / 60)

A release changes the version in ALL of these, to the same value. 1–4 in one go:
`node scripts/set-version.mjs 1.4.0` (session 60 — only the version text is
replaced, layout and line endings kept; nothing is written unless all four
are found). 5 is by hand. (Session 62 review: `scripts/` — set-version.mjs,
fix-help-pages.mjs — is not in the GitHub repo at 7f2b998. Commit it, or
note where it lives.)
1. `src/tattingindex.tsx`: `const APP_VERSION = '…'` (shown in the About
   panel and the splash update messages)
2. `src-tauri/tauri.conf.json`
3. `src-tauri/Cargo.toml`
4. `package.json`
5. `public/app-icon_sm.png` — the small logo at the top of the left
   toolbar has the version number **baked into the picture** (user's note,
   session 60). Not text — the image itself has to be redrawn / re-exported
   with the new number. (It must be in `public/`, not the project root:
   only `public/` is packed into the app.)

**Tauri versions (session 60, 1.4):** build with Tauri at least
`@tauri-apps/cli` 2.12.4 · `tauri` 2.12.5 · `tauri-build` 2.7.4 (and the
plugins `npx tauri info` shows as current with them). Older versions reject
`androidIntentActionFilters` in `tauri.android.conf.json` ("Additional
properties are not allowed") and may not write the Android file-type
entries at all. Update: `npm install -D @tauri-apps/cli@latest` + the
`@tauri-apps/…` packages, then `cargo update` inside `src-tauri`; check with
`npx tauri info`; commit `package-lock.json` and `Cargo.lock` so GitHub
builds the same. (`tauri-cli 🦀` in `tauri info` is a separate Cargo-installed
copy — not used by `npm run tauri`.)

**Security check — EVERY release, before building (session 60, after the
1.4.0 report).** Pattern files are shared, so treat everything in them as
untrusted. Tick all of these, or ask Claude to "run the release security
check" with the current src:
1. **Markup built as text.** Search `src` for `dangerouslySetInnerHTML`,
   `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval(`, `new Function`.
   Any new or changed one: every value from a file (colours, names, notes,
   notation, material/bead names) must go through `safeColor` or an escape.
   Known and checked: the realistic view (realisticRenderer.ts → safeColor);
   the two calculators' `new Function` (digits and `+-*/().` only).
2. **New fields in the pattern file.** Anything added to the save format
   that ends up in the drawing or the page: add it to
   `sanitizeProjectColors` (utils/safeColor.ts) if it is a colour, or check
   it is only shown through React (which escapes it).
3. **The crafted-file test.** Open a pattern whose colours / names / notes
   hold `"><image href=x onerror=alert(1)>`, in schematic AND realistic
   view, and paste it too. Nothing must pop up.
   **Number fields too (session 63):** the same with the text
   `0"/><a href="https://example.com"><text fill="red" font-size="40">X</text></a><path d="`
   in place of a number — a circle ring's `center.x`, a path point, a
   `stitchCount`, a `rotation`. Expected: the red toast "… damaged
   element(s) were left out", the rest of the pattern opens, and no link or
   stray text appears in realistic view.
4. **Dependencies.** `npm audit` in the project and `cargo audit` in
   `src-tauri` (install once: `cargo install cargo-audit`); look at
   GitHub → Security → Dependabot alerts. Fix or knowingly accept
   anything high/critical.
5. **Permissions didn't grow.** Compare `src-tauri/capabilities/*.json` and
   `tauri.conf.json` (`csp`, `withGlobalTauri`, fs / asset `scope`) with
   the last release; any new permission must be needed and scoped. The
   `csp` must still contain `script-src 'self'` with no `'unsafe-eval'` /
   `'unsafe-inline'` for scripts, and `withGlobalTauri` must be `false`.
   Session 61: `capabilities/deny-sensitive.json` (fs deny list) and
   `assetProtocol.scope.deny` in tauri.conf.json must both still be there
   and match each other; `tauri-plugin-fs` ≥ 2.7.0 in Cargo.lock;
   `capabilities/android-files.json` still Android-only with its 7
   permissions; `tauri-plugin-android-fs` (Cargo) and
   `tauri-plugin-android-fs-api` (npm) on the SAME exact version (30.2.0).
6. **Reports.** Check GitHub → Security → private vulnerability reports
   and the issues for anything security-related not yet fixed.

(There is no root `tauri.conf.json` — the only Tauri config is
`src-tauri/tauri.conf.json`. Confirmed by the user, session 57.)

Not to be confused with `version` in `serializeProject`
(domain/patternOutput.ts). That is the project FILE format version (91 as of
session 57); change it only when the saved data changes.

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
actually gets called from. **Session 62 review: gone** — `repairElements`
no longer calls `pushHistory()`.

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
| ~~Split-ring picot color, schematic mode~~ | FIXED (later session). `armColor` in `renderOnePicot` (via `getSolidColor`) had the predicted side-blind bug — always resolved `materialId`, never `materialIdB`. Fixed by giving `getSolidColor` an optional second `picot` param, resolving via the existing `getSplitRingSide(element, picot)` helper (no new field, same single source of truth as `getConnectionThreadColor`); the one call site with a picot in scope (`renderOnePicot`) now passes it, the other two don't and are unaffected (`getSplitRingSide` returns `null` with no picot, falling back to the old behavior exactly). The two other `getSolidColor` call sites, once actually checked: one (`renderStitchLabels`, no-picots branch) can never have a picot in scope at all — not buggy, just not applicable; the other computes `solidColor` and never uses it anywhere in the function — dead code, left alone since removing it was out of scope. |
| Ghost-array regeneration's connection remap may drop connections silently | PARKED (session 56) — ghost arrays are benched as experimental (see Rules). Original note: if a polar array shrinks, the ghost-ID remap may leave old connections pointing at removed ghosts without demoting `isJoint` on the far side. Never traced. |
| Round-group assignment duplication + missing skipAutoHistoryRef | FIXED (session 52). `LineElementPropertyBar.tsx` and `GeneralElementPropertyBar.tsx` each had their own ~25-line inline RoundGroupPicker wiring, and had drifted onto two different (both broken) history strategies — see the useHistoryActions.ts addendum above for the skipAutoHistoryRef half of this; this is the duplication half. Extracted to `utils/roundGroupActions.ts`'s `createRoundGroupHandlers(...)` factory, used identically by both files now. `GeneralElementPropertyBar.tsx`'s old `pushOrderHistory`/`setTimeout(...,0)` and `needsHistoryPushRef` props are fully retired on this path; `skipAutoHistoryRef` threaded through instead (SingleSelectPropertyBar.tsx → tattingindex.tsx call site). |
| `applyGroupRotation` negative-modulo bug + duplicated ±90° button math | FIXED (session 52). `useEditorActions.ts`'s `applyGroupRotation`: `(rotation + delta) % 360` with no second normalization pass could store e.g. `-90` instead of `270`, unlike the `((x%360)+360)%360` idiom used everywhere else `.rotation` is computed — including its own sibling `applyMultiSelectRotationDelta` right above it, which was already correct. Fixed the modulo, and redirected `MultiSelectSummaryBar.tsx`'s ±90° group-rotate buttons (which had their own hand-rolled copy of the same pivot/rotation geometry, sharing the same modulo bug) to call `applyGroupRotation(currentDeg ± 90)` instead — one geometry implementation instead of two. |
| `loadFromPath`/`loadProject` duplication | FIXED (session 52). `useProjectFile.ts`: both were ~90% identical (same read+applyProjectData+error-handling block, differing only in how `filePath` is obtained). Extracted to a shared `readAndApplyProjectFile(filePath)` helper; both are now thin wrappers. Motivation: this is exactly the kind of split that let the file-load-realistic-mode bug's fix apply cleanly to one copy and get missed in the other (see FIXED row above). |
| Squeeze slider undo (`ShapeAndSqueezeControls.tsx`) | FIXED (session 52) — see the useHistoryActions.ts addendum above for full detail. Short version: the only place outside `useInputHandlers.ts`'s canvas mousedown/mouseup pair that sets `isInteractingRef.current = true`. Its deferred push via `needsHistoryPushRef` was never flushed, since that flag's only consumer is scoped to the canvas SVG's own `onMouseUp`. Fixed with a direct `pushHistoryState` call on release. |
| ~~Six `align*` functions duplication~~ | DONE (session 56) — one `alignSelection(mode)` in `useEditorActions.ts`, six one-line wrappers; output verified identical. |
| ~~`paths.ts` binary-search duplication~~ | DONE as far as safe (session 56) — `applyPathPreset`'s two loops share `solvePathMagnitude` (verified identical). The two split-ring solvers intentionally stay separate (different algorithm shape; merging would shift existing geometry). |
| ~~`ShapeAndSqueezeControls.tsx` squeeze-reset buttons vs `resetElementShape`~~ | DONE (session 56) — both call `resetElementShape`, keeping `polarRotationGridId` (the one real difference, which the old note missed: the outputs were NOT byte-identical). |
| ~~Duplicated rotation-expression evaluators (`MultiSelectSummaryBar.tsx`)~~ | DONE (session 56) — uses `parseRotationExpr(s, 0)`. |
| ~~Free multi-select notation scaling vs `updateNotationForMultiple`~~ | DONE (session 56) — turned out to be a buggy separate copy, not duplication (orphaned joins, wrong split-ring stitchCount/splitPosition, chains not re-bent). Replaced by `applyNotationToMultiple`; see Rules. |
| ~~Quadratic line control-point freezes on start/end drag~~ | CLOSED (session 56) — not applicable: new lines/chains are always cubic; quadratic paths only exist in very old saves (and as circle internals, which aren't draggable). The data-corruption half was already fixed; nothing further needed. |
| ~~`nudgeActiveRef` — same stuck-flag shape as `isInteractingRef`~~ | DONE (session 56) — flushed on window blur and by the pointerup safety net; see Rules "Losing window focus mid-gesture". NumberStepper's own blur stop is done too (see the row below). |
| ~~`isInteractingRef` — remaining gap after Addendum 4's fix~~ | DONE (session 56) — window-blur flush; see Rules. |
| ~~`NumberStepper.tsx` auto-repeat after focus loss~~ | DONE — the file is in the repo and ends a hold on window blur (`blurListenerRef`); confirmed in the session-62 review. |
| Clean Up Duplicates — duplicate ghost arrays | PARKED with ghost arrays. |
| Rail JSX vs phone-bar descriptors | DONE (session 59). Rail built from `phoneTools` via `railSimple` / `railFull` / `railRealistic` + `renderRailEntry`. |
| Layout polish list | DONE (session 59) — bigger logo, logo area = header height, one rail width, phone property bar overlays the canvas, "Join" short label. |
