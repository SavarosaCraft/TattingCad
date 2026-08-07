// components/MultiSelectSummaryBar.tsx
//
// Properties-bar content shown when selectedIds.length > 0 but there is no
// single selectedElement — i.e. either a group is selected (multiple
// elements sharing a groupId) or a free multi-selection. One of the
// branches of the "nothing selected" bar in tattingindex.tsx (see
// architecture.md — properties-bar mode dispatch).
//
// Like BeadingModeBar/TattingOrderModeBar, genuinely self-contained enough
// to move wholesale — all derived values (selEls, getElType, nonLines,
// types, sameType, prefillNotation, centroid/pivot math, flip handlers) are
// local and not referenced outside this branch. Moved verbatim: the early
// `if`/`return` structure (group branch, then free-multi-select branch,
// then `return null`) is preserved exactly, just wrapped in a component
// function instead of an IIFE.
//
// Contains the audit's item #8 4th site (multi-select notation input) —
// located but NOT folded into SplitRingNotationInput.tsx: this variant
// doesn't touch pendingNotationRef at all (unlike the split-ring A/B
// inputs), so reusing that component's onBlur (which unconditionally nulls
// pendingNotationRef) would be a small but real behavior change. Left
// inline. Also contains the dual-field materialId/materialIdB assignment
// (split rings set both fields) documented as deliberately not folded into
// PresetChip.tsx.
//
// NOTE: this file references `rotatePaths` (from geometry/paths) in the
// group-rotate handlers, matching the original inline code exactly — import
// it alongside the other geometry helpers when wiring this file in.
import React from 'react';
import {
  IconRotateCCW, IconRotateCW, IconFlipH, IconFlipV,
  IconNotationM, IconNotationOn, IconNotationOff, IconPaste, IconMagicWand,
} from './icons';
import { ScaleControls } from './ScaleControls';
import { rotatePaths } from '../geometry/paths';

interface MultiSelectSummaryBarProps {
  selectedIds: string[];
  elementById: Map<string, any>;
  elements: any[];
  selectedIdSet: Set<string>;
  getPolarPivot: (ids: string[]) => { x: number; y: number } | null;
  setElements: (fn: (prev: any[]) => any[]) => void;
  groupRotationInput: string;
  setGroupRotationInput: (v: string) => void;
  applyGroupRotation: (deg: number) => void;
  parseRotationExpr: (input: string, currentDeg: number) => number | null;
  flipElements: (ids: string[], axisDeg: number, pivotX: number, pivotY: number) => void;
  getPolarFlipGrid: (ids: string[]) => { center: { x: number; y: number } } | null;
  setLabelOffset: (n: number) => void;
  updateSelected: (prev: any[], ids: Set<string>, updates: any) => any[];
  updateWhere: (prev: any[], predicate: (el: any) => boolean, updates: any) => any[];
  polarGrids: Array<{ id: string; name: string }>;
  lineBeadClipboard: any;
  beadLibrary: Array<{ id: string; name: string; color: string }>;
  setLineBeadClipboard: (v: any) => void;
  notationEscapeRef: React.RefObject<boolean>;
  parseNotation: (notation: string) => any;
  restoreBEConfigs: (picots: any[], configs: any) => any[];
  extractBEConfigs: (picots: any[]) => any;
  applyMultiSelectRotationDelta: (deg: number) => void;
  materials: Array<{ id: string; name: string }>;
  setShowMaterialsPanel: (v: boolean) => void;
  multiScalePct: number;
  setMultiScalePct: (n: number) => void;
  showMultiScaleWizard: boolean;
  setShowMultiScaleWizard: (fn: ((prev: boolean) => boolean) | boolean) => void;
  analyzeNotationForWizard: (notation: string, picots: any[]) => any;
  totalRunDs: (segments: any[]) => number;
  suggestScalePresetsMulti: (totalDsList: number[]) => any[];
  scaleNotation: (notation: string, picots: any[], factor: number) => any;
  autoCompact: (notation: string, resultZeroWidth: any[]) => string;
  updateNotationForMultiple: (targets: Array<{ elementId: string; notation: string }>, opts: any) => void;
  groups: Array<{ id: string; name: string; color: string }>;
  setGroups: (fn: ((prev: any[]) => any[]) | any[]) => void;
  picotConnections: any[];
  rounds: any[];
  pushHistoryState: (elements: any[], picotConnections: any[], rounds?: any[], polarGrids?: any[], spatialGroups?: any[]) => void;
  t: (key: string) => string;
}

export const MultiSelectSummaryBar: React.FC<MultiSelectSummaryBarProps> = ({
  selectedIds,
  elementById,
  elements,
  selectedIdSet,
  getPolarPivot,
  setElements,
  groupRotationInput,
  setGroupRotationInput,
  applyGroupRotation,
  parseRotationExpr,
  flipElements,
  getPolarFlipGrid,
  setLabelOffset,
  updateSelected,
  updateWhere,
  polarGrids,
  lineBeadClipboard,
  beadLibrary,
  setLineBeadClipboard,
  notationEscapeRef,
  parseNotation,
  restoreBEConfigs,
  extractBEConfigs,
  applyMultiSelectRotationDelta,
  materials,
  setShowMaterialsPanel,
  multiScalePct,
  setMultiScalePct,
  showMultiScaleWizard,
  setShowMultiScaleWizard,
  analyzeNotationForWizard,
  totalRunDs,
  suggestScalePresetsMulti,
  scaleNotation,
  autoCompact,
  updateNotationForMultiple,
  groups,
  setGroups,
  picotConnections,
  rounds,
  pushHistoryState,
  t,
}) => {
  if (selectedIds.length === 0) return null;

  // Check if a group is selected (multiple elements with same groupId)
  const firstElement = elementById.get(selectedIds[0]);
  if (firstElement && firstElement.groupId) {
    const groupElements = elements.filter(e => e.groupId === firstElement.groupId);
    if (groupElements.length > 1) {
      // Group is selected - show group controls
      return (
      <>
        {/* Row: group name + color (Design Discussion #2), with the
            "Group Selected (N)" status label folded in after the color
            swatch (moved off its own line per follow-up request). `w-full` +
            `basis-full` force this onto its own line in the property bar's
            flex-wrap container, matching every other cluster in this bar.
            Name/color upsert into the `groups` registry — creates the entry
            on first edit if groupSelected's default (useEditorActions.ts)
            hasn't run yet, e.g. a legacy save with a bare groupId and no
            registry entry. */}
        <div className="flex items-center gap-2 w-full basis-full px-2 top-toolbar-scalable">
          <input
            type="text"
            key={firstElement.groupId}
            defaultValue={groups.find(g => g.id === firstElement.groupId)?.name ?? ''}
            placeholder={t('groupNamePlaceholder')}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (!name) return;
              const gid = firstElement.groupId;
              const nextGroups = groups.some(g => g.id === gid)
                ? groups.map(g => g.id === gid ? { ...g, name } : g)
                : [...groups, { id: gid, name, color: '#10B981' }];
              setGroups(nextGroups);
              pushHistoryState(elements, picotConnections, rounds, undefined, nextGroups);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white flex-1 min-w-0"
            style={{ maxWidth: '180px' }}
            title={t('groupNamePlaceholder')}
          />
          <input
            type="color"
            value={groups.find(g => g.id === firstElement.groupId)?.color ?? '#10B981'}
            onChange={(e) => {
              const color = e.target.value;
              const gid = firstElement.groupId;
              const nextGroups = groups.some(g => g.id === gid)
                ? groups.map(g => g.id === gid ? { ...g, color } : g)
                : [...groups, { id: gid, name: `Group`, color }];
              setGroups(nextGroups);
              pushHistoryState(elements, picotConnections, rounds, undefined, nextGroups);
            }}
            title={t('groupColorLabel')}
            className="w-7 h-7 p-0 border-0 bg-transparent cursor-pointer flex-shrink-0"
          />
          <div className="text-sm text-gray-300 whitespace-nowrap">
            Group Selected ({groupElements.length} elements)
          </div>
        </div>

        {/* Group Rotation + Flip — same cluster as single elements */}
        <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
          <button
            onClick={() => {
              const _ppN = getPolarPivot(selectedIds);
              const gcx = _ppN ? _ppN.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
              const gcy = _ppN ? _ppN.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
              const cos = Math.cos(-Math.PI/2), sin = Math.sin(-Math.PI/2);
              setElements(prev => prev.map(el => {
                if (!selectedIdSet.has(el.id)) return el;
                const dx = el.center.x - gcx, dy = el.center.y - gcy;
                return { ...el,
                  center: { x: gcx + dx * cos - dy * sin, y: gcy + dx * sin + dy * cos },
                  paths: rotatePaths(el.paths, gcx, gcy, -90),
                  rotation: ((el.rotation || 0) - 90) % 360 };
              }));
              setGroupRotationInput('');
            }}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
            title={t('propRotateGroupMinus90')}
          >
            <IconRotateCCW size={16} />
          </button>
          <input
            type="text"
            value={groupRotationInput !== '' ? groupRotationInput : String(parseFloat((((groupElements[0]?.rotation || 0) % 360 + 360) % 360).toFixed(1)))}
            onChange={(e) => { setGroupRotationInput(e.target.value); }}
            onBlur={(e) => {
              const currentDeg = ((groupElements[0]?.rotation || 0) % 360 + 360) % 360;
              const result = parseRotationExpr(e.target.value, currentDeg);
              setGroupRotationInput('');
              if (result !== null) applyGroupRotation(result);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const currentDeg = ((groupElements[0]?.rotation || 0) % 360 + 360) % 360;
                const result = parseRotationExpr(e.currentTarget.value, currentDeg);
                setGroupRotationInput('');
                if (result !== null) applyGroupRotation(result);
                e.currentTarget.blur();
              }
            }}
            className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
            style={{width:'6.5ch', minWidth:'6.5ch'}}
            placeholder="0°"
          />
          <button
            onClick={() => {
              const _ppP = getPolarPivot(selectedIds);
              const gcx = _ppP ? _ppP.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
              const gcy = _ppP ? _ppP.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
              const cos = Math.cos(Math.PI/2), sin = Math.sin(Math.PI/2);
              setElements(prev => prev.map(el => {
                if (!selectedIdSet.has(el.id)) return el;
                const dx = el.center.x - gcx, dy = el.center.y - gcy;
                return { ...el,
                  center: { x: gcx + dx * cos - dy * sin, y: gcy + dx * sin + dy * cos },
                  paths: rotatePaths(el.paths, gcx, gcy, 90),
                  rotation: ((el.rotation || 0) + 90) % 360 };
              }));
              setGroupRotationInput('');
            }}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
            title={t('propRotateGroupPlus90')}
          >
            <IconRotateCW size={16} />
          </button>
          <button
            onClick={() => {
              const pfg = getPolarFlipGrid(selectedIds);
              const pivX = pfg ? pfg.center.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
              const pivY = pfg ? pfg.center.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
              flipElements(selectedIds, 90, pivX, pivY);
            }}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
            title={t('propFlipGroupH')}
          >
            <IconFlipH size={16} />
          </button>
          <button
            onClick={() => {
              const pfg = getPolarFlipGrid(selectedIds);
              const pivX = pfg ? pfg.center.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
              const pivY = pfg ? pfg.center.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
              flipElements(selectedIds, 0, pivX, pivY);
            }}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
            title={t('propFlipGroupV')}
          >
            <IconFlipV size={16} />
          </button>
        </div>

        {/* Notation label offset */}
        <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
          <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
          <div className="flex items-center gap-1" title={t('propNotationPos')}>
            <IconNotationM size={16} className="text-gray-400 shrink-0" />
            <input
              type="range"
              min="-25"
              max="45"
              step="1"
              value={groupElements[0]?.labelOffset ?? 8}
              onChange={e => setLabelOffset(Number(e.target.value))}
              className="w-20 accent-blue-500"
              title={t('propNotationPos')}
            />
          </div>
          <button
            onClick={() => {
              const allHidden = groupElements.every(e => e.hideLabel);
              setElements(prev => updateSelected(prev, selectedIdSet, { hideLabel: !allHidden }));
            }}
            className={`px-2 py-1 rounded text-xs ${
              groupElements.every(e => e.hideLabel)
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title={t('propHideLabel')}
          >{groupElements.every(e => e.hideLabel) ? <IconNotationOff size={16} /> : <IconNotationOn size={16} />}</button>
          {/* Polar rotation center — group bar */}
          {polarGrids.length > 0 && (
            <>
              <div className="w-px h-5 bg-gray-600 mx-0.5" />
              <select
                value={groupElements.every(e => e.polarRotationGridId === groupElements[0]?.polarRotationGridId)
                  ? (groupElements[0]?.polarRotationGridId || '') : ''}
                onChange={e => {
                  const val = e.target.value || null;
                  setElements(prev => updateSelected(prev, selectedIdSet, { polarRotationGridId: val }));
                }}
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                title={t('propPolarRotation')}
                style={{ maxWidth: '110px' }}
              >
                <option value="">{t('propPolarRotationNone')}</option>
                {polarGrids.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </>
      );
    }
  }
  // ── Free multi-select bar (no groupId) ──────────────────────────
  if (selectedIds.length > 1) {
    const selEls = elements.filter(e => selectedIdSet.has(e.id));

    // Classify each element: 'r', 'c', 'sr', 'line', or null
    const getElType = (el) => {
      if (el.type === 'line') return 'line';
      if (el.isSplitRing) return 'sr';
      if (el.type === 'ring') return 'r';
      if (el.type === 'chain') return el.isSplitChain ? 'sc' : 'c';
      return null;
    };

    const nonLines = selEls.filter(e => getElType(e) !== 'line');
    const types = [...new Set(nonLines.map(getElType).filter(Boolean))];
    const allSameType = types.length === 1;
    const sameType = allSameType ? types[0] : null;

    // Check if all share exact same notation (for prefill)
    const prefillNotation = (() => {
      if (!allSameType || nonLines.length === 0) return null;
      const first = nonLines[0].notation || '';
      return nonLines.every(e => (e.notation || '') === first) ? first : null;
    })();

    // Centroid of ALL selected (for transforms when no polar grid is linked)
    const cxAll = selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
    const cyAll = selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;

    // If all selected elements share a polar grid, use the grid centre + its offset as flip axes.
    // FlipH = mirror across axis at (angularOffset + 90°) through grid centre.
    // FlipV = mirror across axis at (angularOffset + 0°)  through grid centre.
    const polarFlipGrid = getPolarFlipGrid(selectedIds);
    const flipPivotX = polarFlipGrid ? polarFlipGrid.center.x : cxAll;
    const flipPivotY = polarFlipGrid ? polarFlipGrid.center.y : cyAll;

    // Axis angles are always 90° (vertical) and 0° (horizontal).
    // The grid contributes only its center as pivot — its angular offset does NOT tilt the flip axis.
    const doFlipH = () => flipElements(selectedIds, 90, flipPivotX, flipPivotY);
    const doFlipV = () => flipElements(selectedIds,  0, flipPivotX, flipPivotY);

    // Type label
    const typeLabel = sameType === 'r' ? 'Rings' : sameType === 'c' ? 'Chains' : sameType === 'sc' ? 'Split Chains' : sameType === 'sr' ? 'Split Rings' : null;

    return (
      <>
        {/* Label */}
        <div className="text-sm text-gray-300 px-2 flex-shrink-0">
          {selEls.length} {typeLabel ?? 'Mixed'} selected
        </div>

        {/* Line bead paste strip — shown when all selected elements are lines */}
        {selEls.every(e => e.type === 'line') && (
          <div className="flex items-center gap-1 border-l border-gray-600 pl-2 flex-shrink-0 top-toolbar-scalable">
            <span className="text-xs text-gray-400 hide-label-mobile">{t('modeBeadCore')}:</span>
            {lineBeadClipboard ? (
              <>
                {(() => {
                  const cbSlots = lineBeadClipboard.lineBeadSlots || [];
                  const nonNull = cbSlots.filter(Boolean);
                  const allSame = nonNull.length === 0 || nonNull.every(id => id === nonNull[0]);
                  const lb = allSame && nonNull[0] ? beadLibrary.find(b => b.id === nonNull[0]) : null;
                  return (<>
                    {lb && <div className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500" style={{backgroundColor: lb.color}} title={lb.name} />}
                    <span className="text-xs text-purple-300">
                      {cbSlots.length}×{allSame ? (lb?.name ?? 'none') : 'mixed'}
                    </span>
                  </>);
                })()}
                <button
                  onClick={() => {
                    setElements(prev => updateWhere(prev, el => selectedIdSet.has(el.id) && el.type === 'line',
                      {lineBeadSlots: [...lineBeadClipboard.lineBeadSlots], lineBeadId: undefined, lineBeadCount: undefined}
                    ));
                  }}
                  title={t('lineBdPasteAll').replace('{n}', String(selEls.length))}
                  className="px-1.5 py-0.5 rounded text-xs border bg-purple-800 border-purple-600 text-purple-200 hover:bg-purple-700"
                  style={{touchAction:'manipulation'}}
                ><IconPaste size={12} /></button>
                <button
                  onClick={() => setLineBeadClipboard(null)}
                  title="Clear clipboard"
                  className="px-1.5 py-0.5 rounded text-xs border bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600"
                  style={{touchAction:'manipulation'}}
                >✕</button>
              </>
            ) : (
              <span className="text-xs text-gray-500 italic">{t('lineBdNoClipboard')}</span>
            )}
          </div>
        )}

        {/* Notation input — only for non-line same-type selections */}
        {nonLines.length > 0 && (
          <div className="flex items-center gap-1 top-toolbar-scalable">
            <input
              key={selectedIds.join(',')}
              type="text"
              defaultValue={prefillNotation ?? ''}
              disabled={!allSameType}
              placeholder={allSameType ? (sameType === 'r' ? 'r: 5ds-p-5ds' : sameType === 'c' ? 'c: 5ds-p-5ds' : sameType === 'sc' ? 'sc: 5ds-p-5ds' : 'sr: 5ds-p-5ds') : 'Mixed types'}
              title={allSameType ? 'Apply notation to all selected' : 'Select same-type elements to edit notation'}
              onBlur={(e) => {
                if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
                if (!allSameType) return;
                const notation = e.target.value.trim();
                if (!notation) return;
                const parsed = parseNotation(notation);
                if (!parsed || parsed.stitchCount === 0) { e.target.value = prefillNotation ?? ''; return; }
                setElements(prev => prev.map(el => {
                  if (!selectedIdSet.has(el.id)) return el;
                  if (getElType(el) === 'line') return el;
                  if (el.isSplitRing) {
                    const newParsed = parseNotation(notation);
                    if (!newParsed) return el;
                    const splitPos = el.splitPosition ?? 0;
                    const scaleFactor = el.stitchCount > 0 ? newParsed.stitchCount / el.stitchCount : 1;
                    const cx = el.center.x, cy = el.center.y;
                    const scaledPaths = Math.abs(scaleFactor - 1) < 0.001 ? el.paths : el.paths.map(path => {
                      const scPt = (px, py) => ({ x: cx + (px - cx) * scaleFactor, y: cy + (py - cy) * scaleFactor });
                      const s = scPt(path.x, path.y), e2 = scPt(path.endX, path.endY);
                      const c1 = scPt(path.control1X, path.control1Y), c2 = scPt(path.control2X, path.control2Y);
                      return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
                    });
                    // Preserve side B picots (stitchesBefore > splitPos) — they belong
                    // to notationB which is unchanged. Only side A picots are replaced.
                    const sideBPicots = (el.picots || []).filter(p => p.stitchesBefore > splitPos);
                    const mergedPicots = restoreBEConfigs(
                      [...newParsed.picots, ...sideBPicots],
                      extractBEConfigs(el.picots)
                    );
                    return { ...el, notation, stitchCount: newParsed.stitchCount, picots: mergedPicots, paths: scaledPaths };
                  }
                  const newParsed = parseNotation(notation);
                  if (!newParsed) return el;
                  if (el.type === 'ring') {
                    const scaleFactor = el.stitchCount > 0 ? newParsed.stitchCount / el.stitchCount : 1;
                    const cx = el.center.x, cy = el.center.y;
                    const scaledPaths = Math.abs(scaleFactor - 1) < 0.001 ? el.paths : el.paths.map(path => {
                      const scPt = (px, py) => ({ x: cx + (px - cx) * scaleFactor, y: cy + (py - cy) * scaleFactor });
                      if (path.type === 'cubic') {
                        const s = scPt(path.x, path.y), e2 = scPt(path.endX, path.endY);
                        const c1 = scPt(path.control1X, path.control1Y), c2 = scPt(path.control2X, path.control2Y);
                        return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
                      }
                      const s = scPt(path.x, path.y), e2 = scPt(path.endX, path.endY), c = scPt(path.controlX, path.controlY);
                      return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: c.x, controlY: c.y };
                    });
                    return { ...el, notation, stitchCount: newParsed.stitchCount, picots: restoreBEConfigs(newParsed.picots, extractBEConfigs(el.picots)), paths: scaledPaths };
                  }
                  return { ...el, notation, stitchCount: newParsed.stitchCount, picots: restoreBEConfigs(newParsed.picots, extractBEConfigs(el.picots)), isSplitChain: newParsed.isSplitChain ?? el.isSplitChain ?? false };
                }));
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { notationEscapeRef.current = true; e.target.value = prefillNotation ?? ''; e.target.blur(); } }}
              className={`notation-input px-2 py-1 rounded border text-sm ${allSameType ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'}`}
              style={{ width: '140px' }}
            />
          </div>
        )}

        {/* Rotate + Flip */}
        <div className="flex items-center gap-0.5 md:gap-1 top-toolbar-scalable">
          <button onClick={() => applyMultiSelectRotationDelta(-90)} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title={t('propRotateMinus90')}><IconRotateCCW size={16} /></button>
          <input
            type="text"
            value={groupRotationInput}
            onChange={(e) => setGroupRotationInput(e.target.value)}
            onBlur={(e) => {
              const s = e.target.value.trim();
              if (s) {
                if (!/^[\d\s.+\-*/()]+$/.test(s)) { setGroupRotationInput(''); return; }
                try {
                  // eslint-disable-next-line no-new-func
                  const v = new Function('"use strict"; return (' + s + ')')();
                  if (typeof v === 'number' && isFinite(v)) applyMultiSelectRotationDelta(v);
                } catch {}
              }
              setGroupRotationInput('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const s = e.currentTarget.value.trim();
                if (s) {
                  if (/^[\d\s.+\-*/()]+$/.test(s)) {
                    try {
                      // eslint-disable-next-line no-new-func
                      const v = new Function('"use strict"; return (' + s + ')')();
                      if (typeof v === 'number' && isFinite(v)) applyMultiSelectRotationDelta(v);
                    } catch {}
                  }
                }
                setGroupRotationInput('');
                e.currentTarget.blur();
              }
            }}
            className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
            style={{ width: '3.4rem' }}
            placeholder="Δ°"
          />
          <button onClick={() => applyMultiSelectRotationDelta(90)} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title={t('propRotatePlus90')}><IconRotateCW size={16} /></button>
          <button onClick={doFlipH} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title={t('multiFlipH')}><IconFlipH size={16} /></button>
          <button onClick={doFlipV} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title={t('multiFlipV')}><IconFlipV size={16} /></button>

          {/* Notation label offset */}
          <div className="w-px h-6 bg-gray-600 mx-1" />
          <div className="flex items-center gap-1" title={t('propNotationPos')}>
            <IconNotationM size={16} className="text-gray-400 shrink-0" />
            <input
              type="range"
              min="-25"
              max="45"
              step="1"
              value={selEls[0]?.labelOffset ?? 8}
              onChange={e => setLabelOffset(Number(e.target.value))}
              className="w-20 accent-blue-500"
              title={t('propNotationPos')}
            />
          </div>
          <button
            onClick={() => {
              const allHidden = selEls.every(e => e.hideLabel);
              setElements(prev => updateSelected(prev, selectedIdSet, { hideLabel: !allHidden }));
            }}
            className={`px-2 py-1 rounded text-xs ${
              selEls.every(e => e.hideLabel)
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title={t('propHideLabel')}
          >{selEls.every(e => e.hideLabel) ? <IconNotationOff size={16} /> : <IconNotationOn size={16} />}</button>
          {/* Polar rotation center — multi-select bar */}
          {polarGrids.length > 0 && (
            <>
              <div className="w-px h-5 bg-gray-600 mx-0.5" />
              <select
                value={selEls.every(e => e.polarRotationGridId === selEls[0]?.polarRotationGridId)
                  ? (selEls[0]?.polarRotationGridId || '') : ''}
                onChange={e => {
                  const val = e.target.value || null;
                  setElements(prev => updateSelected(prev, selectedIdSet, { polarRotationGridId: val }));
                }}
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                title={t('propPolarRotation')}
                style={{ maxWidth: '110px' }}
              >
                <option value="">{t('propPolarRotationNone')}</option>
                {polarGrids.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
        <div className="flex items-center gap-1 top-toolbar-scalable">
          <label className="text-xs text-gray-400 hide-label-mobile">{t('materialLabel')}</label>
          <select
            defaultValue="default"
            onChange={(e) => {
              const matId = e.target.value;
              if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
              setElements(prev => prev.map(el => {
                if (!selectedIdSet.has(el.id)) return el;
                // Split rings: set both A and B
                if (el.isSplitRing) return { ...el, materialId: matId, materialIdB: matId };
                return { ...el, materialId: matId };
              }));
            }}
            className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
            style={{ maxWidth: '120px' }}
          >
            {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option disabled>──────</option>
            <option value="__edit__">{t('editMaterials')}</option>
          </select>
        </div>
        <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
        <div className="relative top-toolbar-scalable" style={{ overflow: 'visible' }}>
          <button
            onClick={() => {
              setMultiScalePct(100);
              setShowMultiScaleWizard(!showMultiScaleWizard);
            }}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
            title={t('picotWizardScaleSection')}
          >
            <IconMagicWand size={16} />
          </button>
          {showMultiScaleWizard && (() => {
            // "Dumb" batch scale: one shared factor applied to every selected
            // element that Picot Tools can analyze. No per-element tuning, no
            // Clear/Add/Fill/Compact here — just Scale, since that's what was
            // actually asked for. Split rings, rds/ss stitches, and anything
            // with a picot-count mismatch are silently skipped (counted, not
            // touched) rather than blocking the whole batch.
            const analyzed = nonLines.map(el => ({
              el,
              analysis: analyzeNotationForWizard(el.notation, el.picots),
            }));
            const supported = analyzed.filter(a => a.analysis.supported);
            const skippedCount = analyzed.length - supported.length;
            const totalDsList = supported.map(({ analysis }) => totalRunDs(analysis.segments));
            const presets = suggestScalePresetsMulti(totalDsList);
            const factor = multiScalePct / 100;
            const previews = factor > 0
              ? supported.map(({ el }) => scaleNotation(el.notation, el.picots, factor))
              : [];
            const anyClamped = previews.some(p => p && p.anyClamped);

            return (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMultiScaleWizard(false)} />
                <div className="absolute top-full right-0 mt-1 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3" style={{ width: '240px' }}>
                  <div className="text-gray-100 font-semibold text-sm mb-2 flex items-center gap-2">
                    <IconMagicWand size={14} /> {t('picotWizardScaleSection')}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    {t('multiScaleSupportedCount').replace('{n}', String(supported.length)).replace('{m}', String(analyzed.length))}
                    {skippedCount > 0 ? ` (${t('multiScaleSkipped').replace('{n}', String(skippedCount))})` : ''}
                  </div>
                  {supported.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">{t('picotWizardUnsupported')}</p>
                  ) : (
                    <ScaleControls
                      presets={presets}
                      pct={multiScalePct}
                      onPctChange={setMultiScalePct}
                      clampedWarningText={anyClamped ? t('picotWizardScaleClamped') : null}
                      customLabelText={t('picotWizardScaleCustomLabel')}
                      applyLabel={t('picotWizardScaleApply')}
                      applyDisabled={multiScalePct === 100}
                      onApply={() => {
                        if (multiScalePct !== 100) {
                          const targets = supported.map(({ el }, i) => {
                            const preview = previews[i];
                            if (!preview) return null;
                            const finalNotation = autoCompact(preview.notation, el.picots);
                            return { elementId: el.id, notation: finalNotation };
                          }).filter(Boolean) as Array<{ elementId: string; notation: string }>;
                          updateNotationForMultiple(targets, { preservesExistingPicots: true, picotMatchMode: 'order' });
                        }
                        setMultiScalePct(100);
                        setShowMultiScaleWizard(false);
                      }}
                    />
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </>
    );
  }

  return null;
};
