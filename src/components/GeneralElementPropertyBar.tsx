import React from 'react';
import { IconMagicWand } from './icons';
import { NotationInput } from './NotationInput';
import { SplitRingNotationInput } from './SplitRingNotationInput';
import { NotationRotationControls } from './NotationRotationControls';
import { RwToggleButton } from './RwToggleButton';
import { ScaleControls, WIZARD_BUTTON_CLASS } from './ScaleControls';
import { ShapeAndSqueezeControls } from './ShapeAndSqueezeControls';
import { OrderNumberInput } from './OrderNumberInput';
import { RoundGroupPicker } from './RoundGroupPicker';
import { AddPicotsSection } from './AddPicotsSection';
import { FillPicotsSection } from './FillPicotsSection';
import { CompactPicotsSection } from './CompactPicotsSection';
import { reverseNotation, normalizeNotationInput } from '../domain/parser';
import {
  analyzeNotation as analyzeNotationForWizard,
  clearUnjoinedPicots as clearUnjoinedPicotsText,
  addPicotsToRuns as addPicotsToRunsText,
  hasUnjoinedPicots as hasUnjoinedPicotsText,
  hasAddablePicotRuns as hasAddablePicotRunsText,
  previewFillDensity,
  maxUsefulFillGap,
  compactRepeatedPicots,
  hasCompactableGroups,
  autoCompact,
  scaleNotation,
  suggestScalePresets,
  totalRunDs,
} from '../domain/picotTools';
import { updateSelected, updateElement } from '../utils/elementUpdates';

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
  needsHistoryPushRef: React.MutableRefObject<boolean>;
  notationEscapeRef: React.MutableRefObject<any>;
  pendingNotationRef: React.MutableRefObject<any>;
  picotConnectionsRef: React.MutableRefObject<any>;
  renderRotateFlipControls: () => React.ReactNode;
  getRoundId: (el: any) => any;
  getGradientColorAtPosition: (color: any, pos: number) => string;
  parseNotation: (notation: string) => any;
  updateNotation: (notation: string, notationB: string | null, id: any, options?: any) => void;
  convertToJosephineKnot: (...args: any[]) => void;
  toggleShape: (...args: any[]) => void;
  setLabelOffset: (...args: any[]) => void;
  commitOrderDraft: (id: any, draft: string | null, el?: any) => void;
  pushHistoryState: (els: any[], picotConnections: any, rounds: any[]) => void;
  pushOrderHistory: (...args: any[]) => void;
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
  needsHistoryPushRef,
  notationEscapeRef,
  pendingNotationRef,
  picotConnectionsRef,
  renderRotateFlipControls,
  getRoundId,
  getGradientColorAtPosition,
  parseNotation,
  updateNotation,
  convertToJosephineKnot,
  toggleShape,
  setLabelOffset,
  commitOrderDraft,
  pushHistoryState,
  pushOrderHistory,
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
  return (
    <>
              {/* Notation input - dual for split rings */}
              {selectedElement.isSplitRing ? (
                <div className="flex items-center gap-1 top-toolbar-scalable">
                  <SplitRingNotationInput
                    keySuffix={`${selectedElement.id}-A`}
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
                        setAlertDialog({ message: 'Invalid notation for section A.' });
                      }
                    }}
                    getRevertValue={() => (elementById.get(selectedElement.id)?.notation || '').replace(/^sr:\s*/, '')}
                    notationEscapeRef={notationEscapeRef}
                    pendingNotationRef={pendingNotationRef}
                  />
                  <SplitRingNotationInput
                    keySuffix={`${selectedElement.id}-B`}
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
                        setAlertDialog({ message: 'Invalid notation for section B.' });
                      }
                    }}
                    getRevertValue={() => elementById.get(selectedElement.id)?.notationB || '5ds'}
                    notationEscapeRef={notationEscapeRef}
                    pendingNotationRef={pendingNotationRef}
                  />
                  <span className="text-xs text-gray-400">({selectedElement.stitchCount})</span>
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
                          setAlertDialog({ message: 'Element must have at least 1 stitch.' });
                        } else if (!parsed) {
                          setAlertDialog({ message: 'The entered notation is invalid. Please check for typos.', sub: 'More information about notation is in the Help menu.' });
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
                  {/* Picot Wizard — add / clear picots directly on the notation */}
                  <div className="relative" style={{ overflow: 'visible' }}>
                    <button
                      onClick={() => {
                        setPicotWizardScalePct(100);
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
                      const picotsA = isSR
                        ? allPicots.filter(p => p.stitchesBefore < splitPos)
                                   .map(p => ({ ...p, stitchesBefore: splitPos - p.stitchesBefore }))
                                   .reverse()
                        : allPicots;
                      const picotsB = isSR
                        ? allPicots.filter(p => p.stitchesBefore >= splitPos)
                                   .map(p => ({ ...p, stitchesBefore: p.stitchesBefore - splitPos }))
                        : [];

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
                      const scaleTotalDs = totalRunDs(analysisA.segments) + (isSR ? totalRunDs(analysisB.segments) : 0);
                      const { exact: exactPresets, rounded: roundedPresets } = suggestScalePresets(scaleTotalDs, [...picotsA, ...picotsB]);

                      const anySupported = activeSides.some(s => analysisFor(s).supported);

                      return (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowPicotWizard(false)} />
                          <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3" style={{ width: '240px' }}>
                            <div className="text-gray-100 font-semibold text-sm mb-2 flex items-center gap-2">
                              <IconMagicWand size={14} /> {t('picotWizardTitle')}
                            </div>

                            {/* Side radio buttons — split rings only */}
                            {isSR && (
                              <div className="flex gap-1 mb-3">
                                {(['A', 'both', 'B'] as const).map(side => (
                                  <button
                                    key={side}
                                    onClick={() => setPicotWizardSide(side)}
                                    className={`flex-1 py-1 rounded text-xs border ${picotWizardSide === side ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                  >
                                    {side === 'both' ? t('picotWizardSideBoth') : side}
                                  </button>
                                ))}
                              </div>
                            )}

                            {!anySupported ? (
                              <p className="text-xs text-gray-400 italic">{t('picotWizardUnsupported')}</p>
                            ) : (
                              <>
                                <button
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
                                  className={`${WIZARD_BUTTON_CLASS} mb-3`}
                                >{t('picotWizardReverse')}</button>

                                <button
                                  disabled={!canClear}
                                  onClick={() => applyToSides((n, p) => clearUnjoinedPicotsText(n, p))}
                                  className={`${WIZARD_BUTTON_CLASS} mb-3`}
                                >{t('picotWizardClearUnjoined')}</button>

                                <AddPicotsSection
                                  symmetric={picotWizardSymmetric}
                                  onSymmetricChange={setPicotWizardSymmetric}
                                  canAdd={canAdd}
                                  onApply={() => applyToSides((n, p) => addPicotsToRunsText(n, p, picotWizardSymmetric))}
                                  sectionLabel={t('picotWizardAddSection')}
                                  asymmetricLabel={t('picotWizardAsymmetric')}
                                  symmetricLabel={t('picotWizardSymmetric')}
                                  applyLabel={t('picotWizardAddApply')}
                                  applyClassName={WIZARD_BUTTON_CLASS}
                                />

                                <FillPicotsSection
                                  gap={effectiveGap}
                                  maxGap={maxGap}
                                  onGapChange={setPicotWizardFillGap}
                                  addedCount={fillAddedCount}
                                  onApply={() => {
                                    let newNotationA = notationA;
                                    let newNotationB = notationBFull;
                                    activeSides.forEach((side, idx) => {
                                      const preview = fillPreviews[idx];
                                      if (!preview || preview.addedCount === 0) return;
                                      const compacted = autoCompact(preview.notation, preview.resultZeroWidth);
                                      if (side === 'A') newNotationA = compacted;
                                      else newNotationB = compacted;
                                    });
                                    setDraftNotation(null);
                                    updateNotation(newNotationA, isSR ? newNotationB.replace(/^sr:\s*/i, '') : null, currentElement?.id, { preservesExistingPicots: true });
                                    setShowPicotWizard(false);
                                  }}
                                  sectionLabel={t('picotWizardFillSection')}
                                  denseLabel={t('picotWizardFillDense')}
                                  sparseLabel={t('picotWizardFillSparse')}
                                  previewText={fillAddedCount > 0 ? t('picotWizardFillPreview').replace('{n}', String(fillAddedCount)) : t('picotWizardFillNoChange')}
                                  applyLabel={t('picotWizardFillApply')}
                                  applyClassName={WIZARD_BUTTON_CLASS}
                                />

                                <CompactPicotsSection
                                  canCompact={canCompact}
                                  onApply={() => applyToSides((n, p) => {
                                    const r = compactRepeatedPicots(n, p);
                                    return r ? { notation: r.notation, resultZeroWidth: p } : null;
                                  })}
                                  sectionLabel={t('picotWizardCompactSection')}
                                  applyLabel={t('picotWizardCompactApply')}
                                  applyClassName={WIZARD_BUTTON_CLASS}
                                />

                                <div className="border-t border-gray-600 pt-2">
                                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('picotWizardScaleSection')}</div>
                                  <ScaleControls
                                    presets={[...exactPresets, ...roundedPresets]}
                                    pct={picotWizardScalePct}
                                    onPctChange={setPicotWizardScalePct}
                                    previewText={scalePreviewA ? t('picotWizardScalePreview').replace('{n}', String(scaleActualTotal)) : null}
                                    clampedWarningText={scaleAnyClamped ? t('picotWizardScaleClamped') : null}
                                    customLabelText={t('picotWizardScaleCustomLabel')}
                                    applyLabel={t('picotWizardScaleApply')}
                                    applyDisabled={!scalePreviewA || picotWizardScalePct === 100}
                                    onApply={() => {
                                      if (scalePreviewA && picotWizardScalePct !== 100) {
                                        const newNotationA = autoCompact(scalePreviewA.notation, picotsA);
                                        const newNotationB = isSR && scalePreviewB ? autoCompact(scalePreviewB.notation, picotsB).replace(/^sr:\s*/i, '') : null;
                                        setDraftNotation(null);
                                        updateNotation(newNotationA, newNotationB, currentElement?.id, { preservesExistingPicots: true, picotMatchMode: 'order' });
                                      }
                                      setPicotWizardScalePct(100);
                                      setShowPicotWizard(false);
                                    }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
              
              
              {/* Rotation input */}
              <NotationRotationControls
                rotateFlipControls={renderRotateFlipControls()}
                labelOffset={elements.find(e => selectedIdSet.has(e.id))?.labelOffset ?? 8}
                onLabelOffsetChange={setLabelOffset}
                allLabelsHidden={elements.filter(e => selectedIdSet.has(e.id)).every(e => e.hideLabel)}
                onToggleHideLabel={() => {
                  const allHidden = elements.filter(e => selectedIdSet.has(e.id)).every(e => e.hideLabel);
                  setElements(prev => updateSelected(prev, selectedIdSet, { hideLabel: !allHidden }));
                }}
                polarGrids={polarGrids.filter(g => g.visible)}
                selectedPolarRotationGridId={selectedElement.polarRotationGridId}
                onPolarRotationGridChange={(val) => {
                  setElements(prev => updateSelected(prev, selectedIdSet, { polarRotationGridId: val }));
                  if (val) setPivotOffset({ x: 0, y: 0 });
                }}
                t={t}
              />

              {/* ── Row 2 starts here ── */}
              <div className="w-full" />

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
              <RoundGroupPicker
                buttonRef={propBarGroupButtonRef}
                isOpen={showPropBarGroupDropdown}
                onToggle={() => setShowPropBarGroupDropdown(d => !d)}
                currentGroupId={getRoundId(selectedElement)}
                rounds={rounds}
                onSelectUngrouped={() => {
                  setElements(prev => updateElement(prev, selectedElement.id, { roundId: undefined, orderGroup: undefined }));
                  setShowPropBarGroupDropdown(false);
                  pushOrderHistory();
                }}
                onSelectGroup={(groupId) => {
                  setElements(prev => updateElement(prev, selectedElement.id, { roundId: groupId, orderGroup: undefined }));
                  setShowPropBarGroupDropdown(false);
                  pushOrderHistory();
                }}
                onCreateNew={() => {
                  const name = t('tattingOrderRoundDefault').replace('{n}', String(rounds.length + 1));
                  const id = crypto.randomUUID();
                  setRounds(prev => [...prev, { id, name }]);
                  setElements(prev => updateElement(prev, selectedElement.id, { roundId: id, orderGroup: undefined }));
                  setShowPropBarGroupDropdown(false);
                  setTimeout(() => pushOrderHistory(), 0);
                }}
                ungroupedLabel={t('tattingOrderUngrouped')}
                createNewLabel={t('tattingOrderRoundNew')}
                triggerTitle={t('tattingOrderGroupTitle') || 'Assign to round'}
                wrapperClassName="relative flex-shrink-0 top-toolbar-scalable"
              />

              <RwToggleButton
                active={selectedElement.rw}
                onClick={() => {
                  setElements(prev => updateElement(prev, selectedElement.id, el => ({ rw: !el.rw })));
                  needsHistoryPushRef.current = true;
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
                toggleShape={toggleShape}
                convertToJosephineKnot={convertToJosephineKnot}
                isInteractingRef={isInteractingRef}
                needsHistoryPushRef={needsHistoryPushRef}
                t={t}
              />
    </>
  );
}
