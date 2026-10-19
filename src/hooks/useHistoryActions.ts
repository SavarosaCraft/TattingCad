// src/hooks/useHistoryActions.ts
//
// Manages the undo/redo history stack.
// Extracted from tattingindex.tsx — pure state operation, no React imports needed
// beyond useCallback.

import { useCallback } from 'react';

export interface UseHistoryActionsParams {
  historyRef: React.RefObject<any[]>;
  historyIndexRef: React.RefObject<number>;
  setHistory: (h: any[]) => void;
  setHistoryIndex: (fn: ((prev: number) => number) | number) => void;
}

export function useHistoryActions(p: UseHistoryActionsParams) {

  const pushHistoryState = useCallback((
    els: any[],
    conns: any[],
    rounds?: any[],
    grids?: any[],
    spatialGroups?: any[],
    ghostArrays?: any[],
  ) => {
    const currentHistory = p.historyRef.current;
    const currentIndex = p.historyIndexRef.current;
    const currentState = currentHistory[currentIndex];

    const normalRounds = rounds ?? [];
    // Carry forward the previous entry's polarGrids when omitted, same as the
    // ~23 explicit pushHistoryState call sites across the codebase that never
    // touch grids and only pass (els, conns, rounds). Only the primary
    // auto-push effect in tattingindex.tsx passes a real 4th argument.
    const normalGrids = grids ?? (currentState?.polarGrids ?? []);
    // Named/colored spatial-group registry (Design Discussion #2/#3, distinct
    // from the `rounds` param above). Same carry-forward policy as
    // polarGrids, for the same reason: most call sites only ever pass
    // (els, conns, rounds) and shouldn't wipe this on every push.
    // groupSelected/ungroupSelected (useEditorActions.ts) pass it explicitly
    // when the registry itself changes.
    const normalSpatialGroups = spatialGroups ?? (currentState?.spatialGroups ?? []);
    // Ghost-array registry (session 46: was never part of history at all,
    // which desynced it from `elements` on every undo/redo — see
    // reconcileGhostArraysAfterHistoryRestore in useEditorActions.ts for the
    // narrower symptom this caused). Same carry-forward policy as the other
    // optional fields. The primary auto-push effect in tattingindex.tsx now
    // passes this directly from state (not a ref) since every ghostArrays
    // mutation site changes `elements` in the same synchronous batch and
    // relies on this effect firing — a ref would read one render stale here
    // (see the comment at that call site).
    const normalGhostArrays = ghostArrays ?? (currentState?.ghostArrays ?? []);
    // Note (session 47, folded picots): picotConnections entries now carry an
    // optional connectionType: 'fold' plus fold properties (totalLength,
    // foldRatio, bendOuter, bendInner, innerGap). No changes needed here —
    // `conns` below is the whole picotConnections array, cloned wholesale via
    // JSON.parse(JSON.stringify(...)) same as always, so the fold fields
    // round-trip through undo/redo automatically along with everything else
    // on a connection object.
    const newStateStr = JSON.stringify({ elements: els, connections: conns, rounds: normalRounds, polarGrids: normalGrids, spatialGroups: normalSpatialGroups, ghostArrays: normalGhostArrays });
    const oldStateStr = currentState
      ? JSON.stringify({
          elements: currentState.elements,
          connections: currentState.connections,
          rounds: currentState.rounds ?? [],
          polarGrids: currentState.polarGrids ?? [],
          spatialGroups: currentState.spatialGroups ?? [],
          ghostArrays: currentState.ghostArrays ?? [],
        })
      : null;
    if (oldStateStr === newStateStr) return;

    const cloned = {
      elements:      JSON.parse(JSON.stringify(els)),
      connections:   JSON.parse(JSON.stringify(conns)),
      rounds:        JSON.parse(JSON.stringify(normalRounds)),
      polarGrids:    JSON.parse(JSON.stringify(normalGrids)),
      spatialGroups: JSON.parse(JSON.stringify(normalSpatialGroups)),
      ghostArrays:   JSON.parse(JSON.stringify(normalGhostArrays)),
    };

    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(cloned);
    if (newHistory.length > 50) newHistory.shift();
    p.setHistory(newHistory);
    p.setHistoryIndex(newHistory.length - 1);
  }, []); // refs and state setters are stable — no deps needed

  return { pushHistoryState };
}
