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
    const newStateStr = JSON.stringify({ elements: els, connections: conns, rounds: normalGroups, polarGrids: normalGrids });
    const oldStateStr = currentState
      ? JSON.stringify({
          elements: currentState.elements,
          connections: currentState.connections,
          rounds: currentState.rounds ?? [],
          polarGrids: currentState.polarGrids ?? [],
        })
      : null;
    if (oldStateStr === newStateStr) return;

    const cloned = {
      elements:    JSON.parse(JSON.stringify(els)),
      connections: JSON.parse(JSON.stringify(conns)),
      rounds:      JSON.parse(JSON.stringify(normalGroups)),
      polarGrids:  JSON.parse(JSON.stringify(normalGrids)),
    };

    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(cloned);
    if (newHistory.length > 50) newHistory.shift();
    p.setHistory(newHistory);
    p.setHistoryIndex(newHistory.length - 1);
  }, []); // refs and state setters are stable — no deps needed

  return { pushHistoryState };
}
