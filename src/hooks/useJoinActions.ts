// src/hooks/useJoinActions.ts
//
// Picot join and break actions, including ghost array inherited join propagation.
// Extracted from tattingindex.tsx.

import { useCallback } from 'react';
import { generateId } from '../utils/id';

const isEndpointPicotId = (id: string) =>
  id === '__start__' || id === '__end__' || id === '__anchor__';

export interface UseJoinActionsParams {
  // Refs
  selectedPicotsRef: React.RefObject<any[]>;
  elementsRef: React.RefObject<any[]>;
  picotConnectionsRef: React.RefObject<any[]>;
  orderGroupsRef: React.RefObject<any[]>;
  // State values
  elementById: Map<string, any>;
  ghostArrays: any[];
  // Setters
  setElements: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setPicotConnections: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setSelectedPicots: (picots: any[]) => void;
  setGhostArrays: (fn: ((prev: any[]) => any[]) | any[]) => void;
  // Utilities
  pushHistoryState: (els: any[], conns: any[], groups?: any[]) => void;
}

export function useJoinActions(p: UseJoinActionsParams) {

  // ── Inherited join helpers ────────────────────────────────────────────────

  const checkAndStoreInheritedJoin = (selPicots: any[], currentElements: any[]) => {
    if (selPicots.length < 2) return;

    const el1 = currentElements.find(e => e.id === selPicots[0].elementId);
    const el2 = currentElements.find(e => e.id === selPicots[1].elementId);

    const ghostEl = el1?.type === 'ghost' ? el1 : el2?.type === 'ghost' ? el2 : null;
    const otherEl = ghostEl === el1 ? el2 : el1;

    if (!ghostEl || !otherEl) return;
    if (!ghostEl.isBoundary) return;

    const matchingArray = p.ghostArrays.find(a => a.boundaryIds?.includes(ghostEl.id));
    if (!matchingArray) return;

    const isSourceElement = otherEl.id === matchingArray.sourceId;
    const isOtherBoundary = otherEl.type === 'ghost' && otherEl.isBoundary && matchingArray.boundaryIds?.includes(otherEl.id);
    if (!isSourceElement && !isOtherBoundary) return;

    const ghostPicotIdx = ghostEl.picots?.findIndex(p => p.id === selPicots[ghostEl === el1 ? 0 : 1].picotId) ?? -1;
    const otherPicotIdx = otherEl.picots?.findIndex(p => p.id === selPicots[otherEl === el1 ? 0 : 1].picotId) ?? -1;
    if (ghostPicotIdx < 0 || otherPicotIdx < 0) return;

    let sourcePicotIndex: number, targetPicotIndex: number;
    if (isSourceElement) {
      sourcePicotIndex = ghostPicotIdx;
      targetPicotIndex = otherPicotIdx;
    } else {
      const isGhostEarlier = ghostEl.rotation < otherEl.rotation;
      sourcePicotIndex = isGhostEarlier ? ghostPicotIdx : otherPicotIdx;
      targetPicotIndex = isGhostEarlier ? otherPicotIdx : ghostPicotIdx;
    }

    const alreadyExists = matchingArray.inheritedJoins?.some(
      j => j.sourcePicotIndex === sourcePicotIndex && j.targetPicotIndex === targetPicotIndex
    );
    if (alreadyExists) return;

    const allGhosts = currentElements.filter(e => matchingArray.ghostIds?.includes(e.id));
    const sortedGhosts = [...allGhosts].sort((a, b) => (a.rotation || 0) - (b.rotation || 0));
    if (sortedGhosts.length < 2) return;

    const newInheritedConns: any[] = [];

    if (isSourceElement) {
      const sourceEl = currentElements.find(e => e.id === matchingArray.sourceId);
      if (!sourceEl) return;
      const sendPicotIdx = otherPicotIdx;
      const recvPicotIdx = ghostPicotIdx;

      for (let i = 0; i < sortedGhosts.length - 1; i++) {
        const ghost = sortedGhosts[i];
        const nextGhost = sortedGhosts[i + 1];
        const srcPicot = ghost.picots?.[sendPicotIdx];
        const tgtPicot = nextGhost.picots?.[recvPicotIdx];
        if (!srcPicot || !tgtPicot) continue;
        const exists = p.picotConnectionsRef.current.some(conn =>
          conn.picots.some(cp => cp.elementId === ghost.id && cp.picotId === srcPicot.id) &&
          conn.picots.some(cp => cp.elementId === nextGhost.id && cp.picotId === tgtPicot.id)
        );
        if (exists) continue;
        newInheritedConns.push({
          id: generateId(),
          picots: [
            { elementId: ghost.id, picotId: srcPicot.id },
            { elementId: nextGhost.id, picotId: tgtPicot.id },
          ],
          materialId: ghostEl.materialId || 'default',
          isInheritedJoin: matchingArray.id,
        });
      }

      // Wrap the last ghost back to the source element — closes the loop.
      // Only correct for polar arrays (circular); linear arrays are a straight
      // chain and must not link the far end back to the mother.
      if (matchingArray.type === 'polar') {
        const lastGhost = sortedGhosts[sortedGhosts.length - 1];
        const srcPicotLast = lastGhost.picots?.[sendPicotIdx];
        const tgtPicotLast = sourceEl.picots?.[recvPicotIdx];
        if (srcPicotLast && tgtPicotLast) {
          const exists = p.picotConnectionsRef.current.some(conn =>
            conn.picots.some(cp => cp.elementId === lastGhost.id && cp.picotId === srcPicotLast.id) &&
            conn.picots.some(cp => cp.elementId === sourceEl.id && cp.picotId === tgtPicotLast.id)
          );
          if (!exists) {
            newInheritedConns.push({
              id: generateId(),
              picots: [
                { elementId: lastGhost.id, picotId: srcPicotLast.id },
                { elementId: sourceEl.id, picotId: tgtPicotLast.id },
              ],
              materialId: ghostEl.materialId || 'default',
              isInheritedJoin: matchingArray.id,
            });
          }
        }
      }
    } else {
      for (let i = 0; i < sortedGhosts.length; i++) {
        const ghost = sortedGhosts[i];
        const prevIndex = (i - 1 + sortedGhosts.length) % sortedGhosts.length;
        const prevGhost = sortedGhosts[prevIndex];
        const srcPicot = ghost.picots?.[sourcePicotIndex];
        const tgtPicot = prevGhost.picots?.[targetPicotIndex];
        if (!srcPicot || !tgtPicot) continue;
        const exists = p.picotConnectionsRef.current.some(conn =>
          conn.picots.some(cp => cp.elementId === ghost.id && cp.picotId === srcPicot.id) &&
          conn.picots.some(cp => cp.elementId === prevGhost.id && cp.picotId === tgtPicot.id)
        );
        if (exists) continue;
        newInheritedConns.push({
          id: generateId(),
          picots: [
            { elementId: ghost.id, picotId: srcPicot.id },
            { elementId: prevGhost.id, picotId: tgtPicot.id },
          ],
          materialId: ghostEl.materialId || 'default',
          isInheritedJoin: matchingArray.id,
        });
      }
    }

    const allNewConns = [...p.picotConnectionsRef.current, ...newInheritedConns];
    p.setPicotConnections(allNewConns);
    p.picotConnectionsRef.current = allNewConns;

    if (newInheritedConns.length > 0) {
      const inheritedKeys = new Set(
        newInheritedConns.flatMap(conn =>
          conn.picots.map(cp => `${cp.elementId}::${cp.picotId}`)
        )
      );
      const updatedEls = currentElements.map(el => {
        if (!el.picots) return el;
        const updated = el.picots.map(pic =>
          inheritedKeys.has(`${el.id}::${pic.id}`) && !pic.isJoint
            ? { ...pic, isJoint: true }
            : pic
        );
        return updated === el.picots ? el : { ...el, picots: updated };
      });
      p.setElements(updatedEls);
      p.elementsRef.current = updatedEls;
    }

    p.setGhostArrays(prev => prev.map(a =>
      a.id === matchingArray.id
        ? { ...a, inheritedJoins: [...(a.inheritedJoins || []), { sourcePicotIndex, targetPicotIndex }] }
        : a
    ));
  };

  const removeInheritedJoins = (selPicots: any[], currentElements: any[]) => {
    const affectedGhostIds = new Set<string>();
    selPicots.forEach(sp => {
      const el = currentElements.find(e => e.id === sp.elementId);
      if (el?.type === 'ghost' && el.isBoundary) affectedGhostIds.add(el.id);
    });
    if (affectedGhostIds.size === 0) return;

    const newConns = p.picotConnectionsRef.current.filter(conn => {
      for (const cp of conn.picots) {
        if (affectedGhostIds.has(cp.elementId)) return false;
      }
      return true;
    });

    const removedKeys = new Set<string>();
    p.picotConnectionsRef.current.forEach(conn => {
      const removing = conn.picots.some(cp => affectedGhostIds.has(cp.elementId));
      if (removing) conn.picots.forEach(cp => removedKeys.add(`${cp.elementId}::${cp.picotId}`));
    });

    const stillConnectedKeys = new Set<string>(
      newConns.flatMap(conn => conn.picots.map(cp => `${cp.elementId}::${cp.picotId}`))
    );

    if (newConns.length !== p.picotConnectionsRef.current.length) {
      p.setPicotConnections(newConns);
      p.picotConnectionsRef.current = newConns;

      const updatedEls = currentElements.map(el => {
        if (!el.picots) return el;
        const updated = el.picots.map(pic => {
          const key = `${el.id}::${pic.id}`;
          return (removedKeys.has(key) && !stillConnectedKeys.has(key) && pic.isJoint)
            ? { ...pic, isJoint: false }
            : pic;
        });
        return updated === el.picots ? el : { ...el, picots: updated };
      });
      p.setElements(updatedEls);
      p.elementsRef.current = updatedEls;
    }

    p.setGhostArrays(prev => prev.map(a => {
      const hasAffectedBoundary = a.boundaryIds?.some(bid => affectedGhostIds.has(bid));
      if (!hasAffectedBoundary) return a;
      return { ...a, inheritedJoins: [] };
    }));
  };

  // ── Public actions ────────────────────────────────────────────────────────

  const joinSelectedPicots = useCallback(() => {
    const sel = p.selectedPicotsRef.current;
    if (sel.length < 2) return;

    const firstEl = p.elementById.get(sel[0].elementId);
    const connMaterialId = firstEl?.materialId || 'default';

    const connection = { id: generateId(), picots: [...sel], materialId: connMaterialId };
    const newConns = [...p.picotConnectionsRef.current, connection];
    p.setPicotConnections(newConns);
    p.picotConnectionsRef.current = newConns;

    // Auto-promote to isJoint: true (skip endpoint pseudo-picots)
    const jointSet = new Set(
      sel.filter(sp => !isEndpointPicotId(sp.picotId)).map(sp => `${sp.elementId}::${sp.picotId}`)
    );
    let newEls = p.elementsRef.current.map(el => {
      if (!el.picots) return el;
      const updated = el.picots.map(pic =>
        jointSet.has(`${el.id}::${pic.id}`) && !pic.isJoint ? { ...pic, isJoint: true } : pic
      );
      return updated === el.picots ? el : { ...el, picots: updated };
    });

    // Mirror isJoint to sibling boundary ghosts by picot index
    const mirrorSet: Array<{ arrayId: string; picotIndex: number }> = [];
    for (const sp of sel) {
      const el = newEls.find(e => e.id === sp.elementId);
      if (!el) continue;
      const picotIdx = el.picots?.findIndex(pic => pic.id === sp.picotId) ?? -1;
      if (picotIdx < 0) continue;
      const arr = p.ghostArrays.find(a =>
        a.sourceId === el.id || a.boundaryIds?.includes(el.id)
      );
      if (!arr) continue;
      mirrorSet.push({ arrayId: arr.id, picotIndex: picotIdx });
    }
    if (mirrorSet.length > 0) {
      newEls = newEls.map(el => {
        if (el.type !== 'ghost' || !el.isBoundary || !el.picots) return el;
        const arr = p.ghostArrays.find(a => a.boundaryIds?.includes(el.id));
        if (!arr) return el;
        const indicesToMirror = mirrorSet
          .filter(m => m.arrayId === arr.id)
          .map(m => m.picotIndex);
        if (indicesToMirror.length === 0) return el;
        const updated = el.picots.map((pic, idx) =>
          indicesToMirror.includes(idx) && !pic.isJoint ? { ...pic, isJoint: true } : pic
        );
        return updated === el.picots ? el : { ...el, picots: updated };
      });
    }
    p.setElements(newEls);
    p.elementsRef.current = newEls;

    if (!sel.some(sp => isEndpointPicotId(sp.picotId))) checkAndStoreInheritedJoin(sel, newEls);

    p.setSelectedPicots([]);
    p.pushHistoryState(newEls, newConns, p.orderGroupsRef.current);
  }, [p.elementById, p.ghostArrays]);

  const breakSelectedPicots = useCallback(() => {
    const sel = p.selectedPicotsRef.current;
    if (sel.length === 0) return;

    removeInheritedJoins(sel, p.elementsRef.current);

    const newConns = p.picotConnectionsRef.current.filter(conn =>
      !conn.picots.some(cp => sel.some(sp => sp.elementId === cp.elementId && sp.picotId === cp.picotId))
    );
    p.setPicotConnections(newConns);

    // Auto-demote isJoint: false (skip endpoint pseudo-picots)
    const brokenSet = new Set(
      sel.filter(sp => !isEndpointPicotId(sp.picotId)).map(sp => `${sp.elementId}::${sp.picotId}`)
    );
    const stillConnected = new Set(
      newConns.flatMap(conn => conn.picots.map(cp => `${cp.elementId}::${cp.picotId}`))
    );
    const newEls = p.elementsRef.current.map(el => {
      if (!el.picots) return el;
      const updated = el.picots.map(pic => {
        const key = `${el.id}::${pic.id}`;
        return (brokenSet.has(key) && !stillConnected.has(key) && pic.isJoint)
          ? { ...pic, isJoint: false }
          : pic;
      });
      return updated === el.picots ? el : { ...el, picots: updated };
    });
    p.setElements(newEls);

    p.setSelectedPicots([]);
    p.pushHistoryState(newEls, newConns, p.orderGroupsRef.current);
  }, [p.ghostArrays]);

  return { joinSelectedPicots, breakSelectedPicots };
}
