import React from 'react';
import { IconMagicWand } from './icons';
import { NotationInput } from './NotationInput';
import { SplitRingNotationInput } from './SplitRingNotationInput';
import { NotationRotationControls } from './NotationRotationControls';
import { RwToggleButton } from './RwToggleButton';
import { ScaleControls, WIZARD_APPLY_CLASS, WIZARD_SHORT_BUTTON_CLASS, WIZARD_CARD_CLASS, WIZARD_SECTION_TITLE_CLASS } from './ScaleControls';
import { ShapeAndSqueezeControls } from './ShapeAndSqueezeControls';
import { OrderNumberInput } from './OrderNumberInput';
import { RoundGroupPicker } from './RoundGroupPicker';
import { AddPicotsSection } from './AddPicotsSection';
import { FillPicotsSection } from './FillPicotsSection';
import { CompactPicotsSection } from './CompactPicotsSection';
import { reverseNotation, normalizeNotationInput } from '../domain/parser';
import {
  analyzeNotation as analyzeNotationForWizard,
  splitRingSides,
  clearUnjoinedPicots as clearUnjoinedPicotsText,
  addPicotsToRuns as addPicotsToRunsText,
  hasUnjoinedPicots as hasUnjoinedPicotsText,
  hasAddablePicotRuns as hasAddablePicotRunsText,
  previewFillDensity,
  maxUsefulFillGap,
  compactRepeatedPicots,
  hasCompactableGroups,
  autoCompact,
  expandRepeatGroups,
  hasRepeatGroups,
  scaleNotation,
  suggestScalePresets,
} from '../domain/picotTools';
import { updateSelected, updateElement } from '../utils/elementUpdates';
import { resetElementShape } from '../geometry/paths';
import { TensionStepper } from './TensionStepper';
import { createRoundGroupHandlers } from '../utils/roundGroupActions';

// Extracted from tattingindex.tsx (single-select property bar, general/non-line branch:
// notation input, split-ring dual notation, picot wizard, rotation controls, round group
// picker, RW toggle, shape/squeeze controls). Does NOT include the material-assignment
// dropdown — that's shared with the line branch, see MaterialAssignmentDropdown.tsx.
// Pure relocation — no logic changes. Verify against original lines 7226–7634.
// NOTE: prop list below was derived by static dependency scan; a few props may turn out
// to be unused if a name was shadowed locally in the original block. Safe to trim after
// a live test, but harmless to over-pass for now.

interface GeneralElementPropertyBarProps {
  selectedElement: any;
  // Tension stepper (session 57) — see setTensionForIds in tattingindex.tsx.
  tensionInfoForIds: (ids: string[]) => { value: number; mixed: boolean };
  setTensionForIds: (ids: string[], tension: number) => void;
  selectedIdSet: Set<any>;
  elements: any[];
  elementsRef: React.MutableRefObject<any[]>;
  elementById: Map<any, any>;
  rounds: any[];
  roundsRef: React.MutableRefObject<any[]>;
  polarGrids: any[];
  dsWidth: number;
  draftNotation: any;
  notationError: any;
  propBarOrderDraft: string | null;
  showPropBarGroupDropdown: boolean;
  propBarGroupButtonRef: React.RefObject<HTMLButtonElement>;
  showPicotWizard: boolean;
  picotWizardFillGap: any;
  picotWizardScalePct: number;
  picotWizardSide: any;
  picotWizardSymmetric: boolean;
  isInteractingRef: React.MutableRefObject<boolean>;
  notationEscapeRef: React.MutableRefObject<any>;
  pendingNotationRef: React.MutableRefObject<any>;
  picotConnectionsRef: React.MutableRefObject<any>;
  renderRotateFlipControls: () => React.ReactNode;
  getRoundId: (el: any) => any;
  getGradientColorAtPosition: (color: any, pos: number) => string;
  parseNotation: (notation: string, silent?: boolean) => any;
  updateNotation: (notation: string, notationB: string | null, id: any, options?: any) => void;
  convertToJosephineKnot: (...args: any[]) => void;
  setRingKind: (kind: 'teardrop' | 'circle' | 'fr' | 'mr') => void;
  setLabelOffset: (...args: any[]) => void;
  commitOrderDraft: (id: any, draft: string | null, el?: any) => void;
  pushHistoryState: (els: any[], picotConnections: any, rounds: any[]) => void;
  skipAutoHistoryRef: React.MutableRefObject<boolean>;
  setAlertDialog: (v: any) => void;
  setDraftNotation: (v: any) => void;
  setNotationError: (v: any) => void;
  setElements: (fn: any[] | ((prev: any[]) => any[])) => void;
  setRounds: (rounds: any[] | ((prev: any[]) => any[])) => void;
  setPivotOffset: (v: any) => void;
  setPropBarOrderDraft: (v: string | null) => void;
  setShowPropBarGroupDropdown: (v: boolean | ((d: boolean) => boolean)) => void;
  setShowPicotWizard: (v: boolean) => void;
  setPicotWizardFillGap: (v: any) => void;
  setPicotWizardScalePct: (v: number) => void;
  setPicotWizardSide: (v: any) => void;
  setPicotWizardSymmetric: (v: boolean) => void;
  t: (key: string) => string;
}

export function GeneralElementPropertyBar({
  selectedElement,
  tensionInfoForIds,
  setTensionForIds,
  selectedIdSet,
  elements,
  elementsRef,
  elementById,
  rounds,
  roundsRef,
  polarGrids,
  dsWidth,
  draftNotation,
  notationError,
  propBarOrderDraft,
  showPropBarGroupDropdown,
  propBarGroupButtonRef,
  showPicotWizard,
  picotWizardFillGap,
  picotWizardScalePct,
  picotWizardSide,
  picotWizardSymmetric,
  isInteractingRef,
  notationEscapeRef,
  pendingNotationRef,
  picotConnectionsRef,
  renderRotateFlipControls,
  getRoundId,
  getGradientColorAtPosition,
  parseNotation,
  updateNotation,
  convertToJosephineKnot,
  setRingKind,
  setLabelOffset,
  commitOrderDraft,
  pushHistoryState,
  skipAutoHistoryRef,
  setAlertDialog,
  setDraftNotation,
  setNotationError,
  setElements,
  setRounds,
  setPivotOffset,
  setPropBarOrderDraft,
  setShowPropBarGroupDropdown,
  setShowPicotWizard,
  setPicotWizardFillGap,
  setPicotWizardScalePct,
  setPicotWizardSide,
  setPicotWizardSymmetric,
  t,
}: GeneralElementPropertyBarProps) {
  // Picot Tools (session 60): which tool the pointer is on — drives the
  // Result preview line. Reset when the panel opens.
  const [wizardTool, setWizardTool] = React.useState<string | null>(null);
  // Picot Tools wand button + pop-over (session 60: shared by the regular
  // and the split-ring notation rows — split rings had no button before,
  // though the panel already handled their A / B sides).
  const renderPicotTools = () => (
                  <div className="relative" style={{ overflow: 'visible' }}>
                    <button
                      onClick={() => {
                        setPicotWizardScalePct(100);
                        setWizardTool(null);
                        setShowPicotWizard(!showPicotWizard);
                      }}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                      title={t('picotWizardTitle')}
                    >
                      <IconMagicWand size={16} />
                    </button>
                    {showPicotWizard && (() => {
                      const currentElement = elementById.get(selectedElement.id);
                      const isSR = !!currentElement?.isSplitRing;

                      // For split rings: split the interleaved picots array into A and B sides.
                      // A-side picots have stitchesBefore < splitPosition (stored in reversed-A space).
                      // B-side picots have stitchesBefore >= splitPosition.
                      // Each side is analyzed independently against its own notation.
                      const splitPos = isSR ? (currentElement?.splitPosition || Math.floor((currentElement?.stitchCount || 0) / 2)) : 0;
                      const allPicots = currentElement?.picots || [];

                      // A side: notation is el.notation (sr: ...), picots with sb < splitPos,
                      // but stitchesBefore needs to be re-normalized to A's own 0..stitchCountA space.
                      // The element stores reversed-A picots, so sb = splitPos - originalSb (already inverted).
                      // For analyzeNotation we need picots in the same order/space as the notation text.
                      // The notation text sr: Xds... reads left-to-right as A in reverse, so the picots
                      // in the array that map to A are already in the right order for the notation.
                      // Session 60: sides split by COUNT (splitRingSides, picotTools.ts) —
                      // the old position test put a picot at the very start of side A on
                      // side B.
                      const sides = isSR ? splitRingSides(currentElement) : null;
                      const picotsA = sides ? sides.picotsA : allPicots;
                      const picotsB = sides ? sides.picotsB : [];

                      const notationA = currentElement?.notation || '';
                      const notationBRaw = isSR ? (currentElement?.notationB || '') : '';
                      const notationBFull = isSR ? `sr: ${notationBRaw}` : '';

                      const analysisA = analyzeNotationForWizard(notationA, picotsA);
                      const analysisB = isSR ? analyzeNotationForWizard(notationBFull, picotsB) : analysisA;

                      // For single rings: use A analysis only
                      const activeSides: Array<'A' | 'B'> = isSR
                        ? (picotWizardSide === 'both' ? ['A', 'B'] : [picotWizardSide])
                        : ['A'];

                      const notationFor = (side: 'A' | 'B') => side === 'A' ? notationA : notationBFull;
                      const picotsFor = (side: 'A' | 'B') => side === 'A' ? picotsA : picotsB;
                      const analysisFor = (side: 'A' | 'B') => side === 'A' ? analysisA : analysisB;

                      // A helper that applies a transform to the active sides and commits.
                      // Returns the final notationA and notationB strings after transforms.
                      const applyToSides = (transform: (notation: string, picots: any[]) => { notation: string; resultZeroWidth: Array<{ isJoint: boolean }> } | null) => {
                        let newNotationA = notationA;
                        let newNotationB = notationBFull;
                        for (const side of activeSides) {
                          const result = transform(notationFor(side), picotsFor(side));
                          if (!result) continue;
                          const compacted = autoCompact(result.notation, result.resultZeroWidth);
                          if (side === 'A') newNotationA = compacted;
                          else newNotationB = compacted;
                        }
                        setDraftNotation(null);
                        // For split rings updateNotation takes (notationA, notationBRaw, id)
                        // notationB is stored without the sr: prefix
                        const notationBToCommit = isSR ? newNotationB.replace(/^sr:\s*/i, '') : null;
                        updateNotation(newNotationA, notationBToCommit, currentElement?.id, { preservesExistingPicots: true });
                        setShowPicotWizard(false);
                      };

                      const canClear = activeSides.some(s => analysisFor(s).supported && hasUnjoinedPicotsText(notationFor(s), picotsFor(s)));
                      const canAdd = activeSides.some(s => analysisFor(s).supported && hasAddablePicotRunsText(notationFor(s), picotsFor(s)));
                      const canCompact = activeSides.some(s => analysisFor(s).supported && hasCompactableGroups(notationFor(s), picotsFor(s)));
                      const canExpand = activeSides.some(s => analysisFor(s).supported && hasRepeatGroups(notationFor(s)));
                      const maxGap = Math.max(...activeSides.map(s => analysisFor(s).supported ? maxUsefulFillGap(notationFor(s), picotsFor(s)) : 1));
                      const effectiveGap = Math.min(picotWizardFillGap, maxGap);
                      const fillPreviews = activeSides.map(s => analysisFor(s).supported ? previewFillDensity(notationFor(s), picotsFor(s), effectiveGap) : null);
                      const fillAddedCount = fillPreviews.reduce((sum, p) => sum + (p?.addedCount || 0), 0);

                      // Scale: both sides always scale together to preserve shape
                      const scaleFactor = picotWizardScalePct / 100;
                      const scalePreviewA = analysisA.supported && scaleFactor > 0 ? scaleNotation(notationA, picotsA, scaleFactor) : null;
                      const scalePreviewB = isSR && analysisB.supported && scaleFactor > 0 ? scaleNotation(notationBFull, picotsB, scaleFactor) : null;
                      const scaleActualTotal = (scalePreviewA?.actualTotalDs || 0) + (scalePreviewB?.actualTotalDs || 0);
                      const scaleAnyClamped = !!(scalePreviewA?.anyClamped || scalePreviewB?.anyClamped);
                      // Session 62: presets from the analysed sides (stitch counts,
                      // each side scaled on its own, the same as Apply).
                      const { exact: exactPresets, rounded: roundedPresets } = suggestScalePresets(isSR ? [analysisA, analysisB] : [analysisA]);

                      const anySupported = activeSides.some(s => analysisFor(s).supported);

                      // Session 60 — results without committing (shared by Apply and
                      // the Result preview, so the preview is exactly what Apply does).
                      const stripSr = (n: string) => n.replace(/^sr:\s*/i, '');
                      const displayNotation = (a: string, b: string) =>
                        isSR ? `A: ${stripSr(a)}   B: ${stripSr(b)}` : a;
                      type SideTransform = (notation: string, picots: any[]) => { notation: string; resultZeroWidth: Array<{ isJoint: boolean }> } | null;
                      const transformSides = (transform: SideTransform) => {
                        let a = notationA, b = notationBFull, changed = false;
                        for (const side of activeSides) {
                          if (!analysisFor(side).supported) continue;
                          const result = transform(notationFor(side), picotsFor(side));
                          if (!result) continue;
                          const compacted = autoCompact(result.notation, result.resultZeroWidth);
                          if (side === 'A') a = compacted; else b = compacted;
                          changed = true;
                        }
                        return changed ? { a, b } : null;
                      };
                      const compactTransform: SideTransform = (n, p) => {
                        const r = compactRepeatedPicots(n, p);
                        return r ? { notation: r.notation, resultZeroWidth: p } : null;
                      };
                      // Expand (opposite of Group) — deliberately NOT through
                      // transformSides/applyToSides: those auto-compact the result,
                      // which would group it straight back.
                      const expandResult = () => {
                        let a = notationA, b = notationBFull, changed = false;
                        for (const side of activeSides) {
                          if (!analysisFor(side).supported) continue;
                          const expanded = expandRepeatGroups(notationFor(side));
                          if (!expanded) continue;
                          if (side === 'A') a = expanded; else b = expanded;
                          changed = true;
                        }
                        return changed ? { a, b } : null;
                      };
                      const fillResult = () => {
                        let a = notationA, b = notationBFull, changed = false;
                        activeSides.forEach((side, idx) => {
                          const preview = fillPreviews[idx];
                          if (!preview || preview.addedCount === 0) return;
                          const compacted = autoCompact(preview.notation, preview.resultZeroWidth);
                          if (side === 'A') a = compacted; else b = compacted;
                          changed = true;
                        });
                        return changed ? { a, b } : null;
                      };
                      const scaleResult = () => {
                        if (!scalePreviewA || picotWizardScalePct === 100) return null;
                        const a = autoCompact(scalePreviewA.notation, picotsA);
                        // bChanged: as before, side B is only sent when it was scaled
                        const bChanged = !!(isSR && scalePreviewB);
                        const b = bChanged ? autoCompact(scalePreviewB.notation, picotsB) : notationBFull;
                        return { a, b, bChanged };
                      };
                      /** Notation text the tool would produce; null = no change. */
                      const previewFor = (tool: string): string | null => {
                        let r: { a: string; b: string } | null = null;
                        try {
                          if (tool === 'reverse') {
                            r = isSR
                              ? { a: `sr: ${stripSr(reverseNotation(notationBFull))}`, b: `sr: ${stripSr(reverseNotation(notationA))}` }
                              : { a: reverseNotation(notationA), b: '' };
                          } else if (tool === 'clear') r = canClear ? transformSides((n, p) => clearUnjoinedPicotsText(n, p)) : null;
                          else if (tool === 'add') r = canAdd ? transformSides((n, p) => addPicotsToRunsText(n, p, picotWizardSymmetric)) : null;
                          else if (tool === 'fill') r = fillResult();
                          else if (tool === 'compact') r = canCompact ? transformSides(compactTransform) : null;
                          else if (tool === 'expand') r = canExpand ? expandResult() : null;
                          else if (tool === 'scale') r = scaleResult();
                        } catch { r = null; }
                        return r ? displayNotation(r.a, r.b) : null;
                      };

                      return (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowPicotWizard(false)} />
                          <div className="picot-wizard-pop absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3"
                            style={{ maxHeight: 'calc(100dvh - 9rem)', overflowY: 'auto' }}
                            ref={el => {
                              // Opens under the wand button; if that would run past the
                              // right edge (phones, narrow windows), slide it left so it
                              // stays on screen (8 px margin), never past the left edge.
                              if (!el) return;
                              el.style.left = '0px';
                              const r = el.getBoundingClientRect();
                              const over = r.right - (window.innerWidth - 8);
                              if (over > 0) el.style.left = `${-Math.min(over, Math.max(0, r.left - 8))}px`;
                            }}>
                            {/* Session 60: wider two-column layout (mockup approved by
                                the user) — header with the notation + ✕, Reverse/Clear in
                                one row, Add + Fill cards side by side, Compact on one line,
                                Scale in two rows, and a Result line previewing the notation
                                the tool you're pointing at would produce. Width/columns: CSS
                                .picot-wizard-pop (tattingindex.tsx) — one column on narrow
                                screens. */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-gray-100 font-semibold text-sm flex items-center gap-2 flex-shrink-0">
                                <IconMagicWand size={14} /> {t('picotWizardTitle')}
                              </span>
                              <span className="ml-auto min-w-0 truncate font-mono text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded px-2 py-0.5"
                                title={displayNotation(notationA, notationBFull)}>
                                {displayNotation(notationA, notationBFull)}
                              </span>
                              <button onClick={() => setShowPicotWizard(false)}
                                className="picot-wizard-close flex-shrink-0 text-gray-400 hover:text-white leading-none px-1"
                                title={t('aboutClose')} aria-label={t('aboutClose')}>×</button>
                            </div>

                            {/* Side radio buttons — split rings only */}
                            {isSR && (
                              <div className="flex gap-1 mb-2">
                                {(['A', 'both', 'B'] as const).map(side => (
                                  <button
                                    key={side}
                                    onClick={() => setPicotWizardSide(side)}
                                    className={`flex-1 py-1 rounded text-xs border ${picotWizardSide === side ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                  >
                                    {side === 'both' ? t('picotWizardSideBoth') : side === 'A' ? t('picotWizardSideA') : t('picotWizardSideB')}
                                  </button>
                                ))}
                              </div>
                            )}

                            {!anySupported ? (
                              <p className="text-xs text-gray-400 italic">{t('picotWizardUnsupported')}</p>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <div className="picot-wizard-grid grid gap-2">
                                  <button
                                    onMouseEnter={() => setWizardTool('reverse')} onFocus={() => setWizardTool('reverse')}
                                    onClick={() => {
                                      const currentElement = elementById.get(selectedElement.id);
                                      if (!currentElement) return;
                                      setDraftNotation(null);
                                      if (isSR) {
                                        // Split ring: swap and reverse both sides
                                        const revA = reverseNotation(notationA).replace(/^sr:\s*/i, '');
                                        const revB = reverseNotation(notationBFull).replace(/^sr:\s*/i, '');
                                        // After reversal A and B are swapped (B becomes A, A becomes B)
                                        updateNotation(`sr: ${revB}`, revA, currentElement.id, { preservesExistingPicots: false });
                                      } else {
                                        updateNotation(reverseNotation(notationA), null, currentElement.id, { preservesExistingPicots: false });
                                      }
                                      setShowPicotWizard(false);
                                    }}
                                    className={WIZARD_APPLY_CLASS}
                                  >⇄ {t('picotWizardReverse')}</button>

                                  <button
                                    disabled={!canClear}
                                    onMouseEnter={() => setWizardTool('clear')} onFocus={() => setWizardTool('clear')}
                                    onClick={() => applyToSides((n, p) => clearUnjoinedPicotsText(n, p))}
                                    className={WIZARD_APPLY_CLASS}
                                  >⌫ {t('picotWizardClearUnjoined')}</button>
                                </div>

                                <div className="picot-wizard-grid grid gap-2">
                                  <AddPicotsSection
                                    symmetric={picotWizardSymmetric}
                                    onSymmetricChange={setPicotWizardSymmetric}
                                    canAdd={canAdd}
                                    onApply={() => applyToSides((n, p) => addPicotsToRunsText(n, p, picotWizardSymmetric))}
                                    sectionLabel={t('picotWizardAddSection')}
                                    hintText={t('picotWizardAddHint')}
                                    asymmetricLabel={t('picotWizardAsymmetric')}
                                    symmetricLabel={t('picotWizardSymmetric')}
                                    applyLabel={t('picotWizardAddApply')}
                                    applyClassName={WIZARD_APPLY_CLASS}
                                    onActivate={() => setWizardTool('add')}
                                  />

                                  <FillPicotsSection
                                    gap={effectiveGap}
                                    maxGap={maxGap}
                                    onGapChange={setPicotWizardFillGap}
                                    addedCount={fillAddedCount}
                                    onApply={() => {
                                      const r = fillResult();
                                      if (!r) return;
                                      setDraftNotation(null);
                                      updateNotation(r.a, isSR ? r.b.replace(/^sr:\s*/i, '') : null, currentElement?.id, { preservesExistingPicots: true });
                                      setShowPicotWizard(false);
                                    }}
                                    sectionLabel={t('picotWizardFillSection')}
                                    hintText={t('picotWizardFillHint')}
                                    denseLabel={t('picotWizardFillDense')}
                                    sparseLabel={t('picotWizardFillSparse')}
                                    applyLabel={fillAddedCount > 0 ? t('picotWizardFillApplyCount').replace('{n}', String(fillAddedCount)) : t('picotWizardFillNoChange')}
                                    applyClassName={WIZARD_APPLY_CLASS}
                                    onActivate={() => setWizardTool('fill')}
                                  />
                                </div>

                                <CompactPicotsSection
                                  canCompact={canCompact}
                                  onApply={() => applyToSides(compactTransform)}
                                  sectionLabel={t('picotWizardCompactSection')}
                                  hintText={t('picotWizardCompactHint')}
                                  applyLabel={t('picotWizardCompactShort')}
                                  nothingText={t('picotWizardCompactNothing')}
                                  canExpand={canExpand}
                                  onExpand={() => {
                                    const r = expandResult();
                                    if (!r) return;
                                    setDraftNotation(null);
                                    updateNotation(r.a, isSR ? stripSr(r.b) : null, currentElement?.id, { preservesExistingPicots: true });
                                    setShowPicotWizard(false);
                                  }}
                                  expandLabel={t('picotWizardExpandShort')}
                                  expandNothingText={t('picotWizardExpandNothing')}
                                  applyClassName={WIZARD_SHORT_BUTTON_CLASS}
                                  onActivate={() => setWizardTool('compact')}
                                  onActivateExpand={() => setWizardTool('expand')}
                                />

                                <div className={WIZARD_CARD_CLASS}
                                  onMouseEnter={() => setWizardTool('scale')} onFocusCapture={() => setWizardTool('scale')} onPointerDown={() => setWizardTool('scale')}>
                                  <div className={WIZARD_SECTION_TITLE_CLASS}>{t('picotWizardScaleSection')}</div>
                                  <ScaleControls
                                    layout="wide"
                                    presets={[...exactPresets, ...roundedPresets]}
                                    pct={picotWizardScalePct}
                                    onPctChange={setPicotWizardScalePct}
                                    onActivate={() => setWizardTool('scale')}
                                    previewText={scalePreviewA ? `→ ${scaleActualTotal}ds` : null}
                                    clampedWarningText={scaleAnyClamped ? t('picotWizardScaleClamped') : null}
                                    customLabelText={t('picotWizardScaleCustomShort')}
                                    roundedLegendText={t('scaleRoundedLegend')}
                                    applyLabel={t('picotWizardScaleApply')}
                                    roundedHintText={t('scaleRoundedHint')}
                                    applyDisabled={!scalePreviewA || picotWizardScalePct === 100}
                                    onApply={() => {
                                      const r = scaleResult();
                                      if (r) {
                                        setDraftNotation(null);
                                        updateNotation(r.a, r.bChanged ? r.b.replace(/^sr:\s*/i, '') : null, currentElement?.id, { preservesExistingPicots: true, picotMatchMode: 'order' });
                                      }
                                      setPicotWizardScalePct(100);
                                      setShowPicotWizard(false);
                                    }}
                                  />
                                </div>

                                {/* Result preview — what the tool under the pointer would give */}
                                {(() => {
                                  const result = wizardTool ? previewFor(wizardTool) : undefined;
                                  const same = result != null && result === displayNotation(notationA, notationBFull);
                                  return (
                                    <div className="rounded-lg border border-dashed border-gray-600 bg-gray-900 px-2.5 py-1.5">
                                      <div className="text-xs text-gray-400 uppercase tracking-wider">{t('picotWizardResult')}</div>
                                      {result == null || same ? (
                                        <div className="text-xs text-gray-500 italic">{wizardTool && (result === null || same) ? t('picotWizardResultSame') : t('picotWizardResultHint')}</div>
                                      ) : (
                                        <div className="font-mono text-xs text-emerald-300 break-all">{result}</div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
  );

  return (
    <>
              {/* Notation input - dual for split rings */}
              {selectedElement.isSplitRing ? (
                <div className="flex items-center gap-1 top-toolbar-scalable">
                  {/* Session 60: the key includes the side's notation, so the box
                      refreshes when the notation changes from elsewhere (Picot
                      Tools, undo) — the boxes are uncontrolled (defaultValue)
                      and used to keep showing the old text. */}
                  <SplitRingNotationInput
                    keySuffix={`${selectedElement.id}-A-${selectedElement.notation}`}
                    label="A:"
                    defaultValue={selectedElement.notation.replace(/^sr:\s*/, '')}
                    onChangeRaw={(val) => {
                      pendingNotationRef.current = { elementId: selectedElement.id, notation: `sr: ${val}`, notationB: elementById.get(selectedElement.id)?.notationB };
                    }}
                    onCommit={(val) => {
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) return;
                      const parsedA = parseNotation(`sr: ${val}`);
                      if (parsedA && parsedA.stitchCount > 0) {
                        updateNotation(`sr: ${val}`, currentElement.notationB, currentElement.id);
                      } else {
                        setAlertDialog({ message: t('notationInvalidSideA') });
                      }
                    }}
                    getRevertValue={() => (elementById.get(selectedElement.id)?.notation || '').replace(/^sr:\s*/, '')}
                    notationEscapeRef={notationEscapeRef}
                    pendingNotationRef={pendingNotationRef}
                  />
                  <SplitRingNotationInput
                    keySuffix={`${selectedElement.id}-B-${selectedElement.notationB || ''}`}
                    label="B:"
                    defaultValue={selectedElement.notationB || '5ds'}
                    onChangeRaw={(val) => {
                      const currentEl = elementById.get(selectedElement.id);
                      pendingNotationRef.current = { elementId: selectedElement.id, notation: currentEl?.notation ?? selectedElement.notation, notationB: val };
                    }}
                    onCommit={(val) => {
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) return;
                      const parsedB = parseNotation(`sr: ${val}`);
                      if (parsedB && parsedB.stitchCount > 0) {
                        updateNotation(currentElement.notation, val, currentElement.id);
                      } else {
                        setAlertDialog({ message: t('notationInvalidSideB') });
                      }
                    }}
                    getRevertValue={() => elementById.get(selectedElement.id)?.notationB || '5ds'}
                    notationEscapeRef={notationEscapeRef}
                    pendingNotationRef={pendingNotationRef}
                  />
                  <span className="text-xs text-gray-400">({selectedElement.stitchCount})</span>
                  {renderPicotTools()}
                </div>
              ) : (
                <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                  {/* Label removed - icon/placeholder is sufficient */}
                  <NotationInput
                    key={`${selectedElement.id}::${selectedElement.notation}`}
                    defaultValue={(draftNotation?.elementId === selectedElement.id && draftNotation) ? draftNotation.value : selectedElement.notation}
                    hasError={!!(draftNotation?.elementId === selectedElement.id && notationError)}
                    onChangeRaw={(raw) => {
                      const val = raw.trim();
                      pendingNotationRef.current = { elementId: selectedElement.id, notation: val };
                      setDraftNotation({ elementId: selectedElement.id, value: raw }); // use raw value to preserve cursor
                    }}
                    onCommit={(raw) => {
                      const rawNotation = raw.trim();
                      const normalized = normalizeNotationInput(rawNotation);
                      const parsed = parseNotation(normalized);
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) { return; }
                      if (parsed && parsed.stitchCount > 0) {
                        setDraftNotation(null);
                        updateNotation(normalized, null, currentElement.id);
                      } else {
                        if (parsed && parsed.stitchCount === 0) {
                          setAlertDialog({ message: t('notationMinOneStitch') });
                        } else if (!parsed) {
                          setAlertDialog({ message: t('notationInvalidMsg'), sub: t('notationInvalidSub') });
                        }
                        // Keep draftNotation so user sees their text on reselect
                      }
                    }}
                    getRevertValue={() => {
                      const currentElement = elementById.get(selectedElement.id);
                      return currentElement ? currentElement.notation : null;
                    }}
                    onEscape={() => {
                      setDraftNotation(null);
                      setNotationError(null);
                    }}
                    notationEscapeRef={notationEscapeRef}
                    pendingNotationRef={pendingNotationRef}
                    placeholder="r: 20ds"
                  />
                  {renderPicotTools()}
                </div>
              )}
              
              
              {/* Rotation input */}
              <NotationRotationControls
                rotateFlipControls={renderRotateFlipControls()}
                labelOffset={selectedElement.labelOffset ?? 8}
                onLabelOffsetChange={setLabelOffset}
                allLabelsHidden={!!selectedElement.hideLabel}
                onToggleHideLabel={() => {
                  setElements(prev => updateSelected(prev, selectedIdSet, { hideLabel: !selectedElement.hideLabel }));
                }}
                polarGrids={polarGrids.filter(g => g.visible)}
                selectedPolarRotationGridId={selectedElement.polarRotationGridId}
                onPolarRotationGridChange={(val) => {
                  setElements(prev => updateSelected(prev, selectedIdSet, { polarRotationGridId: val }));
                  if (val) setPivotOffset({ x: 0, y: 0 });
                }}
                t={t}
              />

              {/* Reset transform — relaxes shape (chain bow / ring squeeze)
                  back to default and clears rotation to 0. Reuses the same
                  look and generic "Reset" label as the squeeze-only Reset
                  button in ShapeAndSqueezeControls.tsx (Row 2); this one is
                  broader (also covers open chains) and lives in Row 1 since
                  it's a general per-element reset, not squeeze-specific.
                  Disabled for ghosts (reset only the source element — ghosts
                  regenerate from it) and for anything resetElementShape
                  doesn't handle yet (lines, multi-segment/split chains). */}
              {(() => {
                const resetPatch = resetElementShape(selectedElement, dsWidth);
                return (
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <button
                      onClick={() => {
                        if (!resetPatch) return;
                        const newEls = elementsRef.current.map(el =>
                          el.id === selectedElement.id ? { ...el, ...resetPatch } : el
                        );
                        setElements(newEls);
                        pushHistoryState(newEls, picotConnectionsRef.current, roundsRef.current);
                      }}
                      disabled={!resetPatch}
                      className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs disabled:opacity-40 disabled:pointer-events-none"
                      title={t('propResetTransform')}
                    >{t('propResetBtn')}</button>
                  </div>
                );
              })()}

              {/* Tension (session 57) — this element's tension; changing it
                  resizes it and becomes the default for new rings. */}
              <TensionStepper ids={[selectedElement.id]} tensionInfoForIds={tensionInfoForIds}
                setTensionForIds={setTensionForIds} t={t} />

              {/* ── Row 2 starts here ── (session 61: below 1440 px the break is
                  hidden — see .prop-row-break in tattingindex.tsx — so when Row 1
                  wraps, its last controls share a line with Row 2 instead of
                  sitting alone on a middle line) */}
              <div className="w-full prop-row-break" />

              {/* Order number - for all elements (rings and chains) */}
              <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                <OrderNumberInput
                  value={propBarOrderDraft !== null ? propBarOrderDraft : (selectedElement.orderNumber || '')}
                  onChange={setPropBarOrderDraft}
                  onCommit={(el) => commitOrderDraft(selectedElement.id, propBarOrderDraft, el)}
                  onCancel={() => setPropBarOrderDraft(null)}
                  onFocus={() => setPropBarOrderDraft(selectedElement.orderNumber ? String(selectedElement.orderNumber) : '')}
                  label={t('propOrder')}
                />
              </div>

              {/* Round group picker — inline next to order number, available outside tatting order mode */}
              {(() => {
                const roundGroupHandlers = createRoundGroupHandlers({
                  selectedElementId: selectedElement.id,
                  elementsRef, picotConnectionsRef, roundsRef, skipAutoHistoryRef,
                  setElements, setRounds, pushHistoryState,
                  closeDropdown: () => setShowPropBarGroupDropdown(false),
                  roundDefaultNameTemplate: t('tattingOrderRoundDefault'),
                });
                return (
                  <RoundGroupPicker
                    buttonRef={propBarGroupButtonRef}
                    isOpen={showPropBarGroupDropdown}
                    onToggle={() => setShowPropBarGroupDropdown(d => !d)}
                    currentGroupId={getRoundId(selectedElement)}
                    rounds={rounds}
                    onSelectUngrouped={roundGroupHandlers.onSelectUngrouped}
                    onSelectGroup={roundGroupHandlers.onSelectGroup}
                    onCreateNew={roundGroupHandlers.onCreateNew}
                    ungroupedLabel={t('tattingOrderUngrouped')}
                    createNewLabel={t('tattingOrderRoundNew')}
                    triggerTitle={t('tattingOrderAssignRound')}
                    wrapperClassName="relative flex-shrink-0 top-toolbar-scalable"
                  />
                );
              })()}

              <RwToggleButton
                active={selectedElement.rw}
                onClick={() => {
                  setElements(prev => updateElement(prev, selectedElement.id, el => ({ rw: !el.rw })));
                }}
                title={t('propRWTooltip')}
              />

              {/* Ring-specific properties */}
              <ShapeAndSqueezeControls
                selectedElement={selectedElement}
                dsWidth={dsWidth}
                setElements={setElements}
                pushHistoryState={pushHistoryState}
                elementsRef={elementsRef}
                picotConnectionsRef={picotConnectionsRef}
                roundsRef={roundsRef}
                setRingKind={setRingKind}
                convertToJosephineKnot={convertToJosephineKnot}
                isInteractingRef={isInteractingRef}
                t={t}
              />
    </>
  );
}
