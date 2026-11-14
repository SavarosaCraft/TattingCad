// src/hooks/useGhostArrays.ts
//
// Ghost arrays: rebuilding the copies after the mother changed, and turning
// copies into real elements (Convert / Convert All). Moved unchanged from
// tattingindex.tsx (session 64, Task 2 step 3); every value the code used to
// read from the component now comes in through `p`. Like useJoinActions, it
// is called on every render and returns fresh functions, so they always see
// that render's values — the same as when they were written inline.
//
// Must be called AFTER useJoinActions (needs reapplyInheritedJoins) and
// BEFORE useInputHandlers (which is handed regenerateGhostArrays).
//
// Making an array (executePolarArray / executeLinearArray) stays in
// tattingindex.tsx for now — it's tied to the dialogs' state.

import type React from 'react';
import { regenerateGhostArrays as regenerateGhostArraysIn, rewireJoinsForArrayChange, syncJointFlags } from '../domain/ghostArrays';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export interface UseGhostArraysParams {
  elements: any[];
  setElements: SetState<any[]>;
  elementsRef: React.MutableRefObject<any[]>;
  elementById: Map<string, any>;
  ghostArrays: any[];
  setGhostArrays: SetState<any[]>;
  setPicotConnections: SetState<any[]>;
  picotConnectionsRef: React.MutableRefObject<any[]>;
  setSelectedIds: SetState<string[]>;
  setConvertConfirm: SetState<any>;
  polarGrids: any[];
  dsWidth: number;
  reapplyInheritedJoins: (currentElements: any[], currentGhostArrays: any[]) => void;
}

export function useGhostArrays(p: UseGhostArraysParams) {
  // The rebuild itself lives in domain/ghostArrays.ts (Task 2 step 2); this
  // wrapper hands it the current polar grids and stitch width, so every
  // caller (and useInputHandlers) keeps the same three-argument call.
  const regenerateGhostArrays = (elementsSnapshot: any[], ghostArraysSnapshot: any[], motherIds: string[]) =>
    regenerateGhostArraysIn(elementsSnapshot, ghostArraysSnapshot, motherIds, { polarGrids: p.polarGrids, dsWidth: p.dsWidth });

  // Applies a regenerateGhostArrays() result via setElements/setGhostArrays/
  // setPicotConnections — all three calls happen synchronously in the same
  // tick, so React batches them into one commit (one history entry), instead
  // of the old setTimeout/effect-deferred approach which caused two.
  const applyGhostRegenResult = (result: { elements: any[]; ghostArrays: any[]; connectionIdMap: Map<string, string> }) => {
    p.setElements(result.elements);
    p.setGhostArrays(result.ghostArrays);

    let remappedConns = p.picotConnectionsRef.current;
    if (result.connectionIdMap.size > 0) {
      remappedConns = p.picotConnectionsRef.current.map(conn => ({
        ...conn,
        picots: conn.picots.map(cp => ({
          ...cp,
          elementId: result.connectionIdMap.get(cp.elementId) || cp.elementId,
        })),
      }));
      p.setPicotConnections(remappedConns);
      p.picotConnectionsRef.current = remappedConns;
    }

    // Replays any recorded inherited joins onto the freshly-regenerated ghosts.
    // Covers both slots that already existed (their joins were already carried
    // forward by the ID remap above, so this is a no-op for them via the
    // dedupe check inside buildConnectionsForInheritedJoin) and slots that are
    // entirely new because the array just grew, which the remap above can't
    // reach since there's no old ghost at that position to map from.
    p.reapplyInheritedJoins(result.elements, result.ghostArrays);
  };

  // Thin wrapper for standalone use (e.g. the "Update Array" button in the
  // Array Manager dialog, which already runs synchronously from an onClick).
  const updateGhostArraysForMother = (motherId: string) => {
    const result = regenerateGhostArrays(p.elementsRef.current, p.ghostArrays, [motherId]);
    applyGhostRegenResult(result);
  };

  // Convert a ghost array to real elements (called after confirmation)
  // Shared core: converts a set of ghost elements into real elements and
  // rewires any picotConnections pointing at their old ghost IDs.
  // Used by both "Convert this array" and "Convert all arrays".
  const convertGhostsToReal = (ghostsToConvert: any[]): string[] => {
    const newIds: string[] = [];
    const oldToNewId = new Map<string, string>();
    const ghostIdSet = new Set(ghostsToConvert.map(g => g.id));

    p.setElements(prev => {
      const withoutGhosts = prev.filter(el => !ghostIdSet.has(el.id));
      const realElements = ghostsToConvert.map(ghost => {
        const newEl = JSON.parse(JSON.stringify(ghost));
        oldToNewId.set(ghost.id, newEl.id);
        const source = p.elementById.get(ghost.sourceId);
        newEl.type = source?.type || newEl.type;
        delete newEl.sourceId;
        delete newEl.isBoundary;
        delete newEl.isGhostMother;
        newIds.push(newEl.id);
        return newEl;
      });
      return [...withoutGhosts, ...realElements];
    });

    p.setPicotConnections(prev => prev.map(conn => ({
      ...conn,
      picots: conn.picots.map(p => ({
        ...p,
        elementId: oldToNewId.get(p.elementId) || p.elementId,
      })),
    })));

    return newIds;
  };

  const convertGhostArray = (array: any) => {
    // Find ghosts by sourceId (ghostIds may be stale after undo)
    const currentGhosts = p.elements.filter(e => e.type === 'ghost' && e.sourceId === array.sourceId);
    const sourceEl = p.elementById.get(array.sourceId);
    const newIds = convertGhostsToReal(currentGhosts);
    p.setGhostArrays(prev => prev.filter(a => a.id !== array.id));
    p.setSelectedIds(sourceEl ? [sourceEl.id, ...newIds] : [...newIds]);
    p.setConvertConfirm(null);
  };

  const convertAllGhostArrays = () => {
    // Find all ghosts by sourceId (ghostIds may be stale after undo), deduplicated
    // in case multiple arrays share the same ghost.
    const allGhostsToConvert = p.ghostArrays.flatMap(a =>
      p.elements.filter(e => e.type === 'ghost' && e.sourceId === a.sourceId)
    );
    const seen = new Set<string>();
    const uniqueGhosts = allGhostsToConvert.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    const newIds = convertGhostsToReal(uniqueGhosts);
    const sourceIds = p.ghostArrays.map(a => a.sourceId).filter(Boolean);
    p.setSelectedIds([...sourceIds, ...newIds]);
    p.setGhostArrays([]);
    p.setConvertConfirm(null);
  };

  // Array Manager → Apply (session 64, fix 13; replaces deleting the array
  // and making a new one through executePolar/LinearArray + two timers — L4).
  // The SAME array gets the new settings and its copies are rebuilt, so its
  // recorded join rules stay with it. Joins: rewireJoinsForArrayChange (rules
  // there), then the rules are replayed for the new copies, then every
  // "joined" mark on the mother and the copies is set from the real joins.
  // All state changes happen in this one click → one Undo step.
  // Nothing changed → nothing happens.
  const applyArrayChange = (array: any, changes: { instanceCount: number; angle: number; pivotId?: string; spacing?: number }) => {
    const changed = Object.entries(changes).some(([k, v]) => v !== undefined && array[k] !== v);
    if (!changed) return;
    const updatedArrays = p.ghostArrays.map(a => a.id === array.id ? { ...a, ...changes } : a);
    const result = regenerateGhostArrays(p.elementsRef.current, updatedArrays, [array.sourceId]);
    const newArray = result.ghostArrays.find(a => a.id === array.id) || array;
    // Copies of the mother's other arrays (same mother) were rebuilt too —
    // their joins follow slot by slot, as after moving the mother.
    const remapped = p.picotConnectionsRef.current.map(conn => ({
      ...conn,
      picots: conn.picots.map((cp: any) => {
        if ((array.ghostIds || []).includes(cp.elementId)) return cp;
        return { ...cp, elementId: result.connectionIdMap.get(cp.elementId) || cp.elementId };
      }),
    }));
    const conns = rewireJoinsForArrayChange(remapped, array, newArray);
    // Marks to put right: the mother, old and new copies, and both ends of
    // every join that was removed (e.g. another element a copy was joined to).
    const kept = new Set(conns.map(c => c.id));
    const touched = new Set<string>([array.sourceId, ...(array.ghostIds || []), ...(newArray.ghostIds || [])]);
    for (const c of remapped) if (!kept.has(c.id)) for (const cp of c.picots) touched.add(cp.elementId);
    const els = syncJointFlags(result.elements, conns, touched);
    p.setElements(els);
    p.elementsRef.current = els;
    p.setGhostArrays(result.ghostArrays);
    p.setPicotConnections(conns);
    p.picotConnectionsRef.current = conns;
    // Adds the copied joins for the new set of copies and marks their picots.
    p.reapplyInheritedJoins(els, result.ghostArrays);
  };

  return {
    regenerateGhostArrays, applyGhostRegenResult, updateGhostArraysForMother,
    convertGhostArray, convertAllGhostArrays, applyArrayChange,
  };
}
