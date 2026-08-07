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
    groups?: any[],
    grids?: any[],
    spatialGroups?: any[],
  ) => {
    const currentHistory = p.historyRef.current;
    const currentIndex = p.historyIndexRef.current;
    const currentState = currentHistory[currentIndex];

    const normalGroups = groups ?? [];
    // Carry forward the previous entry's polarGrids when omitted, same as the
    // ~23 explicit pushHistoryState call sites across the codebase that never
    // touch grids and only pass (els, conns, groups). Only the primary
    // auto-push effect in tattingindex.tsx passes a real 4th argument.
    const normalGrids = grids ?? (currentState?.polarGrids ?? []);
    // Named/colored spatial-group registry (Design Discussion #2/#3, distinct
    // from the `groups` param above — that one is actually the `rounds`
    // registry; naming collision predates this addition). Same carry-forward
    // policy as polarGrids, for the same reason: most call sites only ever
    // pass (els, conns, rounds) and shouldn't wipe this on every push.
    // groupSelected/ungroupSelected (useEditorActions.ts) pass it explicitly
    // when the registry itself changes.
    const normalSpatialGroups = spatialGroups ?? (currentState?.spatialGroups ?? []);
    const newStateStr = JSON.stringify({ elements: els, connections: conns, rounds: normalGroups, polarGrids: normalGrids, spatialGroups: normalSpatialGroups });
    const oldStateStr = currentState
      ? JSON.stringify({
          elements: currentState.elements,
          connections: currentState.connections,
          rounds: currentState.rounds ?? [],
          polarGrids: currentState.polarGrids ?? [],
          spatialGroups: currentState.spatialGroups ?? [],
        })
      : null;
    if (oldStateStr === newStateStr) return;

    const cloned = {
      elements:      JSON.parse(JSON.stringify(els)),
      connections:   JSON.parse(JSON.stringify(conns)),
      rounds:        JSON.parse(JSON.stringify(normalGroups)),
      polarGrids:    JSON.parse(JSON.stringify(normalGrids)),
      spatialGroups: JSON.parse(JSON.stringify(normalSpatialGroups)),
    };

    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(cloned);
    if (newHistory.length > 50) newHistory.shift();
    p.setHistory(newHistory);
    p.setHistoryIndex(newHistory.length - 1);
  }, []); // refs and state setters are stable — no deps needed

  return { pushHistoryState };
}
