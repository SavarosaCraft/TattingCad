// src/hooks/useEditorActions.ts
//
// All element-level editor actions extracted from tattingindex.tsx.
// Receives state, refs, and setters as params — no direct React state access.
//
// Actions included:
//   Creation   — addRing, addSplitRing, addChain, addLine
//   Deletion   — deleteSelected
//   History    — undo, redo
//   Clipboard  — copySelected, cutSelected, pasteFromClipboard, duplicateInPlace
//   Ordering   — bringToFront, sendToBack
//   Grouping   — groupSelected, ungroupSelected
//   Alignment  — alignLeft/Right/Top/Bottom/CenterH/CenterV,
//                alignToGridH/V, centerToPolarGrid
//
// Rotation actions (applySingleRotationDelta, applyMultiSelectRotationDelta,
// applyGroupRotation) are still in tattingindex — they share more context with
// the input handlers and will move in a later pass.

import { useCallback } from 'react';
import { generateId } from '../utils/id';
import { sampleBezierPath } from '../geometry/bezier';
import {
  createTeardropPath, createSplitRingPath, createSplitRingPathFromEl,
  rotatePaths,
} from '../geometry/paths';
import { writeText as tauriWrite, readText as tauriRead } from '@tauri-apps/plugin-clipboard-manager';
import { ORDER_GROUP_COLORS } from '../render/svgExport';

// Use Tauri native clipboard when available (avoids browser permission prompts).
// Falls back to navigator.clipboard when running in browser dev server.
const isTauri = () => typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

const writeClipboardText = (text: string): Promise<void> =>
  isTauri() ? tauriWrite(text) : navigator.clipboard.writeText(text);

const readClipboardText = (): Promise<string> =>
  isTauri() ? tauriRead() : navigator.clipboard.readText();

export interface UseEditorActionsParams {
  // State values
  elements: any[];
  selectedIds: string[];
  dsWidth: number;
  camera: { x: number; y: number };
  zoom: number;
  polarGrids: any[];
  // Derived maps
  elementById: Map<string, any>;
  selectedIdSet: Set<string>;
  // Refs
  canvasRef: React.RefObject<HTMLElement | null>;
  elementsRef: React.RefObject<any[]>;
  selectedIdsRef: React.RefObject<string[]>;
  picotConnectionsRef: React.RefObject<any[]>;
  roundsRef: React.RefObject<any[]>;
  groupsRef: React.RefObject<any[]>; // spatial-group registry {id,name,color}[] — see Design Discussion #2
  clipboardRef: React.RefObject<any[]>;
  historyRef: React.RefObject<any[]>;
  historyIndexRef: React.RefObject<number>;
  isUndoRedoRef: React.RefObject<boolean>;
  needsHistoryPushRef: React.RefObject<boolean>;
  skipAutoHistoryRef: React.RefObject<boolean>;
  lastUsedMaterialIdRef: React.RefObject<string>;
  beadLibrary: any[];
  // Setters
  setElements: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setSelectedIds: (ids: string[]) => void;
  setPicotConnections: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setRounds: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setGroups: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setConfirmDialog: (dialog: { title?: string; message: string; confirmLabel?: string; onConfirm: () => void } | null) => void;
  t: (key: string) => string;
  setClipboard: (items: any[]) => void;
  setGhostArrays: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setHistoryIndex: (fn: ((prev: number) => number) | number) => void;
  setGroupRotationInput: (val: string) => void;
  setPolarGrids: (fn: ((prev: any[]) => any[]) | any[]) => void;
  // Utilities
  pushHistoryState: (elements: any[], picotConnections: any[], rounds?: any[], polarGrids?: any[], spatialGroups?: any[], ghostArrays?: any[]) => void;
}

export function useEditorActions(p: UseEditorActionsParams) {

  // ── Internal helpers ──────────────────────────────────────────────────────

  const getViewportCenter = () => {
    if (!p.canvasRef.current) return { x: 0, y: 0 };
    const rect = p.canvasRef.current.getBoundingClientRect();
    return {
      x: (rect.width  / 2 - p.camera.x) / p.zoom,
      y: (rect.height / 2 - p.camera.y) / p.zoom,
    };
  };

  const getElementBounds = (el: any) => {
    if (el.isClosed && el.shapeStyle === 'circle') {
      const radius = (el.stitchCount * p.dsWidth) / (2 * Math.PI);
      return {
        left: el.center.x - radius, right: el.center.x + radius,
        top:  el.center.y - radius, bottom: el.center.y + radius,
        centerX: el.center.x, centerY: el.center.y,
        width: radius * 2, height: radius * 2,
      };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    el.paths.forEach(path => {
      sampleBezierPath(path, 20).forEach(pt => {
        minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
      });
    });
    return {
      left: minX, right: maxX, top: minY, bottom: maxY,
      centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
      width: maxX - minX, height: maxY - minY,
    };
  };

  const getSelectionBoundingBox = (els: any[]) => {
    const bounds = els.map(el => getElementBounds(el));
    const minX = Math.min(...bounds.map(b => b.left));
    const maxX = Math.max(...bounds.map(b => b.right));
    const minY = Math.min(...bounds.map(b => b.top));
    const maxY = Math.max(...bounds.map(b => b.bottom));
    return { minX, maxX, minY, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
  };

  const moveElement = (el: any, dx: number, dy: number) => {
    const shiftPaths = (paths: any[]) => paths.map(path => ({
      ...path,
      x: path.x + dx, y: path.y + dy,
      endX: path.endX + dx, endY: path.endY + dy,
      ...(path.control1X !== undefined ? { control1X: path.control1X + dx, control1Y: path.control1Y + dy } : {}),
      ...(path.control2X !== undefined ? { control2X: path.control2X + dx, control2Y: path.control2Y + dy } : {}),
      ...(path.controlX  !== undefined ? { controlX:  path.controlX  + dx, controlY:  path.controlY  + dy } : {}),
    }));
    return { ...el, center: { x: el.center.x + dx, y: el.center.y + dy }, paths: shiftPaths(el.paths) };
  };

  const getElementPivot = (el: any) => {
    if ((el.type === 'chain' || el.type === 'teardrop') && el.paths?.length > 0) {
      const first = el.paths[0], last = el.paths[el.paths.length - 1];
      return { x: (first.x + last.endX) / 2, y: (first.y + last.endY) / 2 };
    }
    return { x: el.center.x, y: el.center.y };
  };

  const getPolarPivot = (ids: string[]) => {
    if (!ids?.length) return null;
    const first = p.elementsRef.current.find(e => String(e.id) === String(ids[0]));
    const gid = first?.polarRotationGridId || null;
    if (gid && ids.every(id => {
      const el = p.elementsRef.current.find(e => String(e.id) === String(id));
      return el?.polarRotationGridId === gid;
    })) {
      const grid = p.polarGrids.find(g => g.id === gid);
      if (grid) return { x: grid.center.x, y: grid.center.y };
    }
    return null;
  };

  const getAlignmentUnits = () => {
    const unitMap = new Map<string, { ids: string[]; bounds: any }>();
    p.elements.filter(e => p.selectedIdSet.has(e.id)).forEach(el => {
      if (el.groupId) {
        if (!unitMap.has(el.groupId)) unitMap.set(el.groupId, { ids: [], bounds: null });
        const unit = unitMap.get(el.groupId)!;
        unit.ids.push(el.id);
        const b = getElementBounds(el);
        if (!unit.bounds) { unit.bounds = { ...b }; }
        else {
          unit.bounds.left   = Math.min(unit.bounds.left,   b.left);
          unit.bounds.right  = Math.max(unit.bounds.right,  b.right);
          unit.bounds.top    = Math.min(unit.bounds.top,    b.top);
          unit.bounds.bottom = Math.max(unit.bounds.bottom, b.bottom);
          unit.bounds.centerX = (unit.bounds.left + unit.bounds.right) / 2;
          unit.bounds.centerY = (unit.bounds.top  + unit.bounds.bottom) / 2;
        }
      } else {
        unitMap.set('__solo__' + el.id, { ids: [el.id], bounds: getElementBounds(el) });
      }
    });
    return [...unitMap.values()];
  };

  const resolveTargetGrid = (gridId: string | null = null) => {
    if (gridId) return p.polarGrids.find(g => g.id === gridId);
    for (const id of p.selectedIds) {
      const linkedId = p.elementById.get(id)?.polarRotationGridId;
      if (linkedId) return p.polarGrids.find(g => g.id === linkedId);
    }
    return p.polarGrids.find(g => g.visible) || p.polarGrids[0];
  };

  // ── Creation ──────────────────────────────────────────────────────────────

  const addRing = useCallback(() => {
    const center = getViewportCenter();
    const squeeze = 0;
    const pathData = createTeardropPath(center.x, center.y, 12 * p.dsWidth, squeeze);
    const newEl = {
      id: generateId(), type: 'ring',
      materialId: p.lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      rotation: 0, stitchCount: 12, color: '#FFFFFF',
      picots: [{ id: generateId(), stitchesBefore: 6, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null }],
      orderNumber: null, notation: 'r: 6ds-p-6ds', labelOffset: 8,
      squeeze, picotSideMultiplier: 1, isGhost: false, ghostSourceId: null,
      ...pathData,
    };
    const newElements = [...p.elementsRef.current, newEl];
    p.skipAutoHistoryRef.current = true;
    p.setElements(newElements);
    p.setSelectedIds([newEl.id]);
    p.pushHistoryState(newElements, p.picotConnectionsRef.current, p.roundsRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.dsWidth, p.camera, p.zoom]);

  const addSplitRing = useCallback(() => {
    const center = getViewportCenter();
    const stitchCountA = 6, stitchCountB = 6;
    const pathData = createSplitRingPath(center.x, center.y, stitchCountA, stitchCountB, p.dsWidth, 0.25, 0.75, 0.75);
    const newEl = {
      id: generateId(), type: 'ring',
      materialId: p.lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      rotation: 0, stitchCount: stitchCountA + stitchCountB, color: '#FFFFFF',
      picots: [
        { id: generateId(), stitchesBefore: 3, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null },
        { id: generateId(), stitchesBefore: 9, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null },
      ],
      orderNumber: null, notation: 'sr: 3ds-p-3ds', notationB: '3ds-p-3ds',
      labelOffset: 8, squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75,
      picotSideMultiplier: 1, isSplitRing: true, isGhost: false, ghostSourceId: null,
      ...pathData,
    };
    const newElements = [...p.elementsRef.current, newEl];
    p.skipAutoHistoryRef.current = true;
    p.setElements(newElements);
    p.setSelectedIds([newEl.id]);
    p.pushHistoryState(newElements, p.picotConnectionsRef.current, p.roundsRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.dsWidth, p.camera, p.zoom]);

  const addChain = useCallback(() => {
    const center = getViewportCenter();
    const stitchCount = 12;
    const chord = stitchCount * p.dsWidth * 0.92;
    const halfChord = chord / 2;
    const arcLift = chord / 5;
    const startX = center.x - halfChord, startY = center.y;
    const endX = center.x + halfChord, endY = center.y;
    const newEl = {
      id: generateId(), type: 'chain',
      materialId: p.lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      isClosed: false, shapeStyle: 'chain',
      paths: [{ type: 'cubic', x: startX, y: startY,
        control1X: startX + chord / 3, control1Y: startY - arcLift,
        control2X: startX + chord * 2 / 3, control2Y: startY - arcLift,
        endX, endY }],
      stitchCount, color: '#FFFFFF',
      picots: [{ id: generateId(), stitchesBefore: 6, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null }],
      notation: 'c: 6ds-p-6ds', labelOffset: 8, picotSideMultiplier: 1,
      isGhost: false, ghostSourceId: null,
    };
    const newElements = [...p.elementsRef.current, newEl];
    p.skipAutoHistoryRef.current = true;
    p.setElements(newElements);
    p.setSelectedIds([newEl.id]);
    p.pushHistoryState(newElements, p.picotConnectionsRef.current, p.roundsRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.dsWidth, p.camera, p.zoom]);

  const addLine = useCallback(() => {
    const center = getViewportCenter();
    const startX = center.x - 100, startY = center.y;
    const endX = center.x + 100, endY = center.y;
    p.setElements(prev => [...prev, {
      id: generateId(), type: 'line',
      materialId: p.lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      isClosed: false,
      paths: [{ type: 'cubic', x: startX, y: startY,
        control1X: startX + 200 * 0.33, control1Y: startY,
        control2X: startX + 200 * 0.67, control2Y: startY,
        endX, endY }],
      color: '#FFFFFF', notation: 'line', lineWidth: 2,
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.camera, p.zoom]);

  // ── Deletion ──────────────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    const currentSelectedIds = p.selectedIdsRef.current;
    if (currentSelectedIds.length === 0) return;

    const currentElements = p.elementsRef.current;
    const selectedElements = currentElements.filter(e => currentSelectedIds.includes(e.id));
    const deletedGhostIds   = selectedElements.filter(e => e.type === 'ghost').map(e => e.id);
    const deletedMotherIds  = selectedElements.filter(e => e.isGhostMother).map(e => e.id);

    const idsToDelete = new Set(currentSelectedIds);
    if (deletedMotherIds.length > 0) {
      currentElements
        .filter(e => e.type === 'ghost' && e.sourceId && deletedMotherIds.includes(e.sourceId))
        .forEach(e => idsToDelete.add(e.id));
    }

    p.setElements(prev => prev.filter(e => !idsToDelete.has(e.id)));

    if (deletedMotherIds.length > 0) {
      p.setGhostArrays(prev => prev.filter(a => !deletedMotherIds.includes(a.sourceId)));
    }

    const allDeletedGhostIds = [...deletedGhostIds];
    if (deletedMotherIds.length > 0) {
      currentElements
        .filter(e => e.type === 'ghost' && e.sourceId && deletedMotherIds.includes(e.sourceId))
        .forEach(e => allDeletedGhostIds.push(e.id));
    }
    if (allDeletedGhostIds.length > 0) {
      p.setGhostArrays(prev => prev
        .map(a => ({
          ...a,
          ghostIds:    a.ghostIds.filter(id => !allDeletedGhostIds.includes(id)),
          boundaryIds: a.boundaryIds.filter(id => !allDeletedGhostIds.includes(id)),
        }))
        .filter(a => a.ghostIds.length > 0)
      );
    }

    p.setSelectedIds([]);
    p.setPicotConnections(prev =>
      prev.filter(conn => !conn.picots.some(pt => currentSelectedIds.includes(pt.elementId)))
    );
  }, []); // reads via refs

  // ── History ───────────────────────────────────────────────────────────────

  // ghostArrays is now part of every history snapshot (session 46 fix —
  // pushHistoryState/useHistoryActions.ts captures {elements, connections,
  // rounds, polarGrids, spatialGroups, ghostArrays} together, and undo/redo
  // above restores state.ghostArrays before this function runs). For history
  // entries created after that fix, ghostArrays (including inheritedJoins)
  // and connections are captured atomically in the same snapshot, so a
  // restore should already leave them consistent with each other.
  // This function remains as a defensive safety net for entries that predate
  // the fix (e.g. history built up earlier in a long-running session, or a
  // project reloaded from a save made before ghostArrays was wired into
  // history) — in those cases inheritedJoins can still point to join
  // patterns whose actual connections don't exist in the just-restored
  // connections list. Left alone, checkAndStoreInheritedJoin's alreadyExists
  // dedupe check would treat a re-join as already done and silently create
  // nothing — the "recreate the joint and inheriting never happens again"
  // symptom. Coarse per-array reconciliation: if literally no connection
  // tagged isInheritedJoin === array.id survives the restore, that array's
  // inheritedJoins entries are stale — clear them. Idempotent / a no-op on
  // already-consistent snapshots, so safe to leave running unconditionally.
  // Known limitation: if an array has multiple distinct inheritedJoins
  // records and undo lands at a point where only some of them are gone, this
  // won't distinguish between them — it keeps all records as long as at
  // least one tagged connection survives. Fixing that precisely would need
  // per-record reconciliation using buildConnectionsForInheritedJoin from
  // useJoinActions.ts, which isn't available here without new cross-hook
  // coupling; out of scope for this fix.
  const reconcileGhostArraysAfterHistoryRestore = (restoredConns: any[]) => {
    p.setGhostArrays(prev => prev.map(a => {
      if (!a.inheritedJoins || a.inheritedJoins.length === 0) return a;
      const stillHasAny = restoredConns.some((c: any) => c.isInheritedJoin === a.id);
      return stillHasAny ? a : { ...a, inheritedJoins: [] };
    }));
  };

  // ghostArrays is now part of every history snapshot (session 46 — see
  // useHistoryActions.ts). Restored here before reconcile runs, so the
  // reconcile step operates on the correct restored registry instead of
  // whatever was left over from before the undo/redo.
  const undo = useCallback(() => {
    const idx = p.historyIndexRef.current;
    const history = p.historyRef.current;
    if (idx > 0) {
      p.isUndoRedoRef.current = true;
      const newIdx = idx - 1;
      const state = history[newIdx];
      p.setHistoryIndex(newIdx);
      p.setElements(JSON.parse(JSON.stringify(state.elements)));
      const restoredConns = JSON.parse(JSON.stringify(state.connections));
      p.setPicotConnections(restoredConns);
      if (state.rounds) p.setRounds(JSON.parse(JSON.stringify(state.rounds)));
      if (state.polarGrids) p.setPolarGrids(JSON.parse(JSON.stringify(state.polarGrids)));
      if (state.spatialGroups) p.setGroups(JSON.parse(JSON.stringify(state.spatialGroups)));
      if (state.ghostArrays) p.setGhostArrays(JSON.parse(JSON.stringify(state.ghostArrays)));
      reconcileGhostArraysAfterHistoryRestore(restoredConns);
      setTimeout(() => { p.isUndoRedoRef.current = false; }, 0);
    }
  }, []); // reads via refs

  const redo = useCallback(() => {
    const idx = p.historyIndexRef.current;
    const history = p.historyRef.current;
    if (idx < history.length - 1) {
      p.isUndoRedoRef.current = true;
      const newIdx = idx + 1;
      const state = history[newIdx];
      p.setHistoryIndex(newIdx);
      p.setElements(JSON.parse(JSON.stringify(state.elements)));
      const restoredConns = JSON.parse(JSON.stringify(state.connections));
      p.setPicotConnections(restoredConns);
      if (state.rounds) p.setRounds(JSON.parse(JSON.stringify(state.rounds)));
      if (state.polarGrids) p.setPolarGrids(JSON.parse(JSON.stringify(state.polarGrids)));
      if (state.spatialGroups) p.setGroups(JSON.parse(JSON.stringify(state.spatialGroups)));
      if (state.ghostArrays) p.setGhostArrays(JSON.parse(JSON.stringify(state.ghostArrays)));
      reconcileGhostArraysAfterHistoryRestore(restoredConns);
      setTimeout(() => { p.isUndoRedoRef.current = false; }, 0);
    }
  }, []); // reads via refs

  // ── Clipboard ─────────────────────────────────────────────────────────────

  const TATCAD_PREFIX = 'TATCAD_ELEMENTS:';

  const inlineBeadData = (els: any[]) => els.map(el => ({
    ...el,
    picots: (el.picots || []).map((pic: any) => {
      if (pic.beadType !== 'be') return pic;
      const inlinedBeads: Record<string, any> = {};
      [...(pic.coreBeads || []), ...(pic.picotBeads || [])].forEach((id: string) => {
        if (!id) return;
        const b = p.beadLibrary.find((lib: any) => lib.id === id);
        if (b) inlinedBeads[id] = { name: b.name, color: b.color, size: b.size, shape: b.shape };
      });
      return { ...pic, inlinedBeads };
    }),
  }));

  const stripUnknownBeadRefs = (els: any[]) => els.map(el => ({
    ...el,
    picots: (el.picots || []).map((pic: any) => {
      if (pic.beadType !== 'be') return pic;
      const resolveId = (id: string | null) => {
        if (!id) return null;
        if (p.beadLibrary.find((b: any) => b.id === id)) return id;
        return null;
      };
      const { inlinedBeads: _inline, ...picotClean } = pic;
      return {
        ...picotClean,
        coreBeads: (pic.coreBeads || []).map(resolveId),
        picotBeads: (pic.picotBeads || []).map(resolveId),
      };
    }),
  }));

  const copySelected = () => {
    if (p.selectedIds.length === 0) return;
    const copied = JSON.parse(JSON.stringify(p.elements.filter(el => p.selectedIdSet.has(el.id))));
    const relevantConnections = p.picotConnections.filter(conn =>
      conn.picots.every(pt => p.selectedIdSet.has(pt.elementId))
    );
    p.setClipboard(copied);
    const payload = TATCAD_PREFIX + JSON.stringify({
      elements: inlineBeadData(copied),
      connections: relevantConnections,
    });
    writeClipboardText(payload).catch(err => console.error('[TATCAD] Clipboard write failed:', err));
  };

  const cutSelected = () => {
    if (p.selectedIds.length === 0) return;
    const copied = JSON.parse(JSON.stringify(p.elements.filter(el => p.selectedIdSet.has(el.id))));
    const relevantConnections = p.picotConnections.filter(conn =>
      conn.picots.every(pt => p.selectedIdSet.has(pt.elementId))
    );
    p.setClipboard(copied);
    const payload = TATCAD_PREFIX + JSON.stringify({ elements: inlineBeadData(copied), connections: relevantConnections });
    writeClipboardText(payload).catch(err => console.error('[TATCAD] Clipboard write failed:', err));
    p.setElements(prev => prev.filter(e => !p.selectedIdSet.has(e.id)));
    p.setPicotConnections(prev => prev.filter(conn => !conn.picots.some(pt => p.selectedIdSet.has(pt.elementId))));
    p.setSelectedIds([]);
  };

  const pasteFromClipboard = useCallback(async () => {
    let board = p.clipboardRef.current;
    let connections = p.picotConnectionsRef.current.filter(conn =>
      board.every && conn.picots.every(pt => board.some((el: any) => el.id === pt.elementId))
    );

    try {
      const sysText = await readClipboardText().catch(() => null);
      if (sysText?.startsWith(TATCAD_PREFIX)) {
        const parsed = JSON.parse(sysText.slice(TATCAD_PREFIX.length));
        const { elements: sysEls, connections: sysConns } = parsed;
        if (Array.isArray(sysEls) && sysEls.length > 0) {
          board = stripUnknownBeadRefs(sysEls);
          connections = sysConns || [];
        }
      }
    } catch {
      // fall through to internal clipboard
    }

    if (!board || board.length === 0) return;

    const offset = 30;
    const groupIdMap = new Map<string, string>();
    const elementIdMap = new Map<string, string>();

    board.forEach(el => {
      if (el.groupId && !groupIdMap.has(el.groupId)) groupIdMap.set(el.groupId, generateId());
    });

    const newElements = board.map(el => {
      const newEl = JSON.parse(JSON.stringify(el));
      const newId = generateId();
      elementIdMap.set(el.id, newId);
      newEl.id = newId;
      if (el.groupId) newEl.groupId = groupIdMap.get(el.groupId);
      newEl.center.x += offset;
      newEl.center.y += offset;
      if (newEl.paths) {
        newEl.paths = newEl.paths.map(path => {
          const np = { ...path };
          np.x += offset; np.y += offset;
          if (path.endX     !== undefined) { np.endX     += offset; np.endY     += offset; }
          if (path.controlX  !== undefined) { np.controlX  += offset; np.controlY  += offset; }
          if (path.control1X !== undefined) { np.control1X += offset; np.control1Y += offset; }
          if (path.control2X !== undefined) { np.control2X += offset; np.control2Y += offset; }
          return np;
        });
      }
      delete newEl.orderNumber;
      return newEl;
    });

    const clipboardIds = new Set(board.map((el: any) => el.id));
    const newConnections = connections
      .filter((conn: any) => conn.picots.every((pt: any) => clipboardIds.has(pt.elementId)))
      .map((conn: any) => ({
        id: generateId(),
        picots: conn.picots.map(pt => ({ elementId: elementIdMap.get(pt.elementId), picotId: pt.picotId })),
      }));

    p.setElements(prev => [...prev, ...newElements]);
    p.setPicotConnections(prev => [...prev, ...newConnections]);
    p.setSelectedIds(newElements.map(el => el.id));
  }, []); // reads via refs

  const duplicateInPlace = () => {
    const ids = p.selectedIdsRef.current;
    const current = p.elementsRef.current;
    if (ids.length === 0) return;

    const groupIdMap = new Map<string, string>();
    const elementIdMap = new Map<string, string>();
    const selectedEls = current.filter(e => ids.includes(e.id));
    selectedEls.forEach(el => {
      if (el.groupId && !groupIdMap.has(el.groupId)) groupIdMap.set(el.groupId, generateId());
    });

    const newElements = selectedEls.map(el => {
      const newEl = JSON.parse(JSON.stringify(el));
      const newId = generateId();
      elementIdMap.set(el.id, newId);
      newEl.id = newId;
      if (el.groupId) newEl.groupId = groupIdMap.get(el.groupId);
      delete newEl.orderNumber;
      return newEl;
    });

    const selectedIdSet = new Set(ids);
    const newConnections = p.picotConnectionsRef.current
      .filter(conn => conn.picots.every((pt: any) => selectedIdSet.has(pt.elementId)))
      .map((conn: any) => ({
        id: generateId(),
        picots: conn.picots.map((pt: any) => ({ elementId: elementIdMap.get(pt.elementId), picotId: pt.picotId })),
      }));

    p.setElements(prev => [...prev, ...newElements]);
    if (newConnections.length > 0) p.setPicotConnections(prev => [...prev, ...newConnections]);
    p.setSelectedIds(newElements.map(el => el.id));
  };

  // ── Layer ordering ────────────────────────────────────────────────────────

  const bringToFront = useCallback(() => {
    const ids = new Set(p.selectedIdsRef.current);
    if (ids.size === 0) return;
    p.setElements(prev => {
      const rest = prev.filter(e => !ids.has(e.id));
      const sel  = prev.filter(e =>  ids.has(e.id));
      return [...rest, ...sel];
    });
  }, []);

  const sendToBack = useCallback(() => {
    const ids = new Set(p.selectedIdsRef.current);
    if (ids.size === 0) return;
    p.setElements(prev => {
      const rest = prev.filter(e => !ids.has(e.id));
      const sel  = prev.filter(e =>  ids.has(e.id));
      return [...sel, ...rest];
    });
  }, []);

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groupSelected = useCallback(() => {
    const ids = p.selectedIdsRef.current;
    if (ids.length < 2) return;

    const currentElements = p.elementsRef.current;
    const selectedEls = currentElements.filter(el => ids.includes(el.id));
    const touchedGroupIds = new Set(selectedEls.map(el => el.groupId).filter(Boolean));

    // True no-op (Design Discussion #3): selection is exactly one pre-existing
    // group's full membership and Group is hit again — nothing would change.
    // Skip silently: no popup, no new id, no registry churn.
    if (touchedGroupIds.size === 1) {
      const [onlyGroupId] = touchedGroupIds;
      const fullMembers = currentElements.filter(el => el.groupId === onlyGroupId);
      const isExactRehit = fullMembers.length === selectedEls.length
        && fullMembers.every(el => ids.includes(el.id));
      if (isExactRehit) return;
    }

    const commit = () => {
      const groupId = generateId();
      const nextElements = currentElements.map(el => ids.includes(el.id) ? { ...el, groupId } : el);
      // Always discard any absorbed groups' name/color (agreed direction) —
      // every merge produces a fresh untitled group, never a preserved
      // identity. Prune the absorbed groups' registry entries too, rather
      // than leaving orphans behind — nothing points at them after this.
      const existing = p.groupsRef.current || [];
      const kept = existing.filter(g => !touchedGroupIds.has(g.id));
      const [color] = ORDER_GROUP_COLORS[(kept.length + 1) % ORDER_GROUP_COLORS.length];
      const nextGroups = [...kept, { id: groupId, name: `Group ${kept.length + 1}`, color }];

      // Explicit history push with the fresh elements+groups (mirrors the
      // addRing/addChain pattern) rather than relying on the auto-history
      // effect: that effect fires off `elements`/`connections` changes and
      // reads `groupsRef.current`, which isn't guaranteed to reflect this
      // same setGroups call yet on the same commit (the ref-sync effect that
      // updates groupsRef runs after it, source-order-wise). Setting
      // skipAutoHistoryRef avoids a redundant/stale second push.
      p.skipAutoHistoryRef.current = true;
      p.setElements(nextElements);
      p.setGroups(nextGroups);
      p.pushHistoryState(nextElements, p.picotConnectionsRef.current, p.roundsRef.current, undefined, nextGroups);
    };

    if (touchedGroupIds.size > 0) {
      // Absorbing one or more pre-existing groups — confirm first (Design
      // Discussion #3, agreed direction). Same generic message regardless
      // of whether this merges one existing group or several (agreed: no
      // distinct multi-group wording).
      p.setConfirmDialog({
        title: p.t('groupMergeTitle'),
        message: p.t('groupMergeBody'),
        confirmLabel: p.t('groupMergeConfirm'),
        onConfirm: commit,
      });
    } else {
      commit();
    }
  }, []);

  const ungroupSelected = useCallback(() => {
    const ids = p.selectedIdsRef.current;
    if (ids.length === 0) return;

    const currentElements = p.elementsRef.current;
    const touchedGroupIds = new Set(
      currentElements.filter(el => ids.includes(el.id) && el.groupId).map(el => el.groupId)
    );

    let nextElements = currentElements.map(el => {
      if (!ids.includes(el.id)) return el;
      const { groupId: _, ...rest } = el;
      return rest;
    });

    // Mirror-bug fix (Design Discussion #3): a partial ungroup can leave a
    // "remainder" of exactly one (or zero) elements still tagged with the
    // old groupId — a meaningless group of 1 that draws nothing (groupBoxes
    // already filters members.length <= 1) but lingers invisibly and
    // corrupts the NEXT groupSelected() call: reselecting that lone leftover
    // together with new elements would register as "merging an existing
    // group" and wrongly trigger the confirm popup for what the user
    // experiences as a brand-new grouping. Strip the stale groupId from any
    // remainder that drops below 2 members, and prune its now-empty/singleton
    // registry entry.
    const orphanedGroupIds = new Set<string>();
    touchedGroupIds.forEach(gid => {
      const remainder = nextElements.filter(el => el.groupId === gid);
      if (remainder.length < 2) orphanedGroupIds.add(gid);
    });
    let nextGroups = p.groupsRef.current || [];
    if (orphanedGroupIds.size > 0) {
      nextElements = nextElements.map(el => {
        if (el.groupId && orphanedGroupIds.has(el.groupId)) {
          const { groupId: _, ...rest } = el;
          return rest;
        }
        return el;
      });
      nextGroups = nextGroups.filter(g => !orphanedGroupIds.has(g.id));
    }

    // Explicit history push (mirrors groupSelected/addRing) rather than the
    // auto-history effect, for the same groupsRef-staleness reason: only
    // needed as a real push when the registry itself actually changed.
    p.skipAutoHistoryRef.current = true;
    p.setElements(nextElements);
    if (orphanedGroupIds.size > 0) p.setGroups(nextGroups);
    p.pushHistoryState(nextElements, p.picotConnectionsRef.current, p.roundsRef.current, undefined, nextGroups);
  }, []);

  // ── Alignment ─────────────────────────────────────────────────────────────

  const alignLeft = () => {
    if (p.selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = Math.min(...units.map(u => u.bounds.left));
    p.setElements(prev => prev.map(el => {
      const unit = units.find(u => u.ids.includes(el.id));
      return unit ? moveElement(el, target - unit.bounds.left, 0) : el;
    }));
  };

  const alignRight = () => {
    if (p.selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = Math.max(...units.map(u => u.bounds.right));
    p.setElements(prev => prev.map(el => {
      const unit = units.find(u => u.ids.includes(el.id));
      return unit ? moveElement(el, target - unit.bounds.right, 0) : el;
    }));
  };

  const alignTop = () => {
    if (p.selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = Math.min(...units.map(u => u.bounds.top));
    p.setElements(prev => prev.map(el => {
      const unit = units.find(u => u.ids.includes(el.id));
      return unit ? moveElement(el, 0, target - unit.bounds.top) : el;
    }));
  };

  const alignBottom = () => {
    if (p.selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = Math.max(...units.map(u => u.bounds.bottom));
    p.setElements(prev => prev.map(el => {
      const unit = units.find(u => u.ids.includes(el.id));
      return unit ? moveElement(el, 0, target - unit.bounds.bottom) : el;
    }));
  };

  const alignCenterHorizontal = () => {
    if (p.selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = units.reduce((s, u) => s + u.bounds.centerX, 0) / units.length;
    p.setElements(prev => prev.map(el => {
      const unit = units.find(u => u.ids.includes(el.id));
      return unit ? moveElement(el, target - unit.bounds.centerX, 0) : el;
    }));
  };

  const alignCenterVertical = () => {
    if (p.selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = units.reduce((s, u) => s + u.bounds.centerY, 0) / units.length;
    p.setElements(prev => prev.map(el => {
      const unit = units.find(u => u.ids.includes(el.id));
      return unit ? moveElement(el, 0, target - unit.bounds.centerY) : el;
    }));
  };

  const alignToGridHorizontal = (gridId: string | null = null) => {
    if (p.selectedIds.length === 0 || p.polarGrids.length === 0) return;
    const grid = resolveTargetGrid(gridId);
    if (!grid) return;
    const { centerX } = getSelectionBoundingBox(p.elements.filter(e => p.selectedIdSet.has(e.id)));
    const dx = grid.center.x - centerX;
    if (Math.abs(dx) < 0.01) return;
    p.setElements(prev => prev.map(el => p.selectedIdSet.has(el.id) ? moveElement(el, dx, 0) : el));
  };

  const alignToGridVertical = (gridId: string | null = null) => {
    if (p.selectedIds.length === 0 || p.polarGrids.length === 0) return;
    const grid = resolveTargetGrid(gridId);
    if (!grid) return;
    const { centerY } = getSelectionBoundingBox(p.elements.filter(e => p.selectedIdSet.has(e.id)));
    const dy = grid.center.y - centerY;
    if (Math.abs(dy) < 0.01) return;
    p.setElements(prev => prev.map(el => p.selectedIdSet.has(el.id) ? moveElement(el, 0, dy) : el));
  };

  const centerToPolarGrid = (gridId: string | null = null) => {
    if (p.selectedIds.length === 0 || p.polarGrids.length === 0) return;
    const grid = resolveTargetGrid(gridId);
    if (!grid) return;
    const { centerX, centerY } = getSelectionBoundingBox(p.elements.filter(e => p.selectedIdSet.has(e.id)));
    const dx = grid.center.x - centerX;
    const dy = grid.center.y - centerY;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    p.setElements(prev => prev.map(el => p.selectedIdSet.has(el.id) ? moveElement(el, dx, dy) : el));
  };

  // ── Rotation ──────────────────────────────────────────────────────────────

  const applySingleRotationDelta = (elId: string, delta: number, pushHistory = true) => {
    if (delta === 0) return;
    const rad = delta * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    p.setElements(prev => prev.map(el => {
      if (el.id !== elId) return el;
      const polarPivot = getPolarPivot([el.id]);
      const pivot = polarPivot || getElementPivot(el);
      const newPaths = rotatePaths(el.paths, pivot.x, pivot.y, delta);
      const newRotation = (el.rotation || 0) + delta;
      const newPivot = polarPivot
        ? { x: pivot.x + (el.center.x - pivot.x) * cos - (el.center.y - pivot.y) * sin,
            y: pivot.y + (el.center.x - pivot.x) * sin + (el.center.y - pivot.y) * cos }
        : getElementPivot({ ...el, paths: newPaths });
      return { ...el, paths: newPaths, rotation: newRotation, center: { x: newPivot.x, y: newPivot.y } };
    }));
    if (pushHistory) p.needsHistoryPushRef.current = true;
  };

  const applyMultiSelectRotationDelta = (delta: number) => {
    if (p.selectedIds.length < 2) return;
    if (delta === 0) return;
    const selEls = p.elements.filter(e => p.selectedIdSet.has(e.id));
    const polarPivot = getPolarPivot(p.selectedIds);
    const centerX = polarPivot ? polarPivot.x : selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
    const centerY = polarPivot ? polarPivot.y : selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;
    const rad = delta * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    p.setElements(prev => prev.map(el => {
      if (!p.selectedIdSet.has(el.id)) return el;
      const dx = el.center.x - centerX, dy = el.center.y - centerY;
      const newCenterX = centerX + dx * cos - dy * sin;
      const newCenterY = centerY + dx * sin + dy * cos;
      const newRotation = ((el.rotation || 0) + delta) % 360;
      return { ...el, center: { x: newCenterX, y: newCenterY },
        paths: rotatePaths(el.paths, centerX, centerY, delta),
        rotation: ((newRotation % 360) + 360) % 360 };
    }));
  };

  const applyGroupRotation = (targetRotation: number) => {
    if (p.selectedIds.length === 0) return;
    const firstElement = p.elementById.get(p.selectedIds[0]);
    if (!firstElement || !firstElement.groupId) return;
    const groupElements = p.elements.filter(e => e.groupId === firstElement.groupId);
    if (groupElements.length <= 1) return;
    const currentRotation = groupElements[0]?.rotation || 0;
    const delta = targetRotation - currentRotation;
    if (delta === 0) return;
    const rad = delta * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const polarPivot = getPolarPivot(p.selectedIds);
    const groupCenterX = polarPivot ? polarPivot.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
    const groupCenterY = polarPivot ? polarPivot.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
    p.setElements(prev => prev.map(el => {
      if (!p.selectedIdSet.has(el.id)) return el;
      const dx = el.center.x - groupCenterX, dy = el.center.y - groupCenterY;
      const newCenterX = groupCenterX + dx * cos - dy * sin;
      const newCenterY = groupCenterY + dx * sin + dy * cos;
      const newRotation = ((el.rotation || 0) + delta) % 360;
      return { ...el, center: { x: newCenterX, y: newCenterY },
        paths: rotatePaths(el.paths, groupCenterX, groupCenterY, delta),
        rotation: newRotation };
    }));
    p.setGroupRotationInput('');
  };

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // Helpers (still needed in tattingindex)
    getViewportCenter, getElementBounds, getSelectionBoundingBox,
    moveElement, getElementPivot, getPolarPivot,
    // Creation
    addRing, addSplitRing, addChain, addLine,
    // Deletion
    deleteSelected,
    // History
    undo, redo,
    // Clipboard
    copySelected, cutSelected, pasteFromClipboard, duplicateInPlace,
    // Ordering
    bringToFront, sendToBack,
    // Grouping
    groupSelected, ungroupSelected,
    // Alignment
    alignLeft, alignRight, alignTop, alignBottom,
    alignCenterHorizontal, alignCenterVertical,
    alignToGridHorizontal, alignToGridVertical, centerToPolarGrid,
    // Rotation
    applySingleRotationDelta,
    applyMultiSelectRotationDelta,
    applyGroupRotation,
  };
}
