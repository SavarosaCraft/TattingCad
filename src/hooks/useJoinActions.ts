// src/hooks/useJoinActions.ts
//
// Picot join and break actions, including ghost array inherited join propagation.
// Extracted from tattingindex.tsx.

import { useCallback } from 'react';
import { generateId } from '../utils/id';

const isEndpointPicotId = (id: string) =>
  id === '__start__' || id === '__end__' || id === '__anchor__';

// Default fold properties applied to every new fold connection.
//
// Replaces the earlier totalLength/foldRatio/bendOuter/bendInner/tangentA/
// tangentB model entirely, after discussion settled on a simpler, more
// direct physical parameterization: a fold is one continuous strand of
// thread folded over itself, so "how much thread on each side" is naturally
// two independent lengths (outerLength/innerLength) rather than a total
// plus a ratio standing in for the same two numbers — and each end's
// departure direction is a literal angle (angleA/angleB, degrees off that
// picot's own perpendicular), not an abstract 0-1 blend between two
// different formulas. See tattingindex.tsx's buildFixedFeetArcD/
// buildFoldLoopPair for the geometry side.
//
// outerLength/innerLength are physical thread-length units, same convention
// as other picot-length values in this codebase — no artificial ceiling,
// since there's no mathematical reason to cap a physical thread length.
// Defaults of 130/100 (not smaller numbers like 8/6) are deliberate: these
// are raw canvas-coordinate units, same scale as dsWidth, and a curve can
// never be shorter than the straight-line distance between its own
// endpoints — for a typical 6ds picot-to-picot spacing that chord is
// already ~60 raw units, so a target length below that silently collapses
// to a flat line with no visible error. 130/100 sit well clear of that for
// ordinary picot spacings. Displayed to the user as 13.0/10.0 (divided by
// 10) via PicotJoinModeBar's displayScale — only the on-screen number is
// scaled down for friendliness; the stored/geometry units are unchanged.
// angleA/angleB are in degrees, nominally -90 to 90 (a fold can't
// physically leave the ring pointing back into it), with a little headroom
// to ~-100/100 for edge cases. 0 = perpendicular to the ring surface, same
// as a normal picot's arm and the previous fully-perpendicular default;
// positive reads as a visually counterclockwise rotation on screen.
export const DEFAULT_FOLD_PROPS = {
  outerLength: 130,
  innerLength: 100,
  angleA: 0,
  angleB: 0,
};

// A picot is eligible to become one end of a NEW fold when: it's a real
// picot (not an endpoint pseudo-picot — folding requires an actual loop,
// which endpoints don't have), it's plain (no beadType, no isCoreJoin — fold
// is a plain-picot-only feature per design), and it isn't already part of
// ANY connection (fold or regular) — a folded picot is fully exclusive, and
// a to-be-folded picot can't already be mid-regular-join either. Exported
// standalone (not part of the hook's returned object) so UI code — e.g. to
// disable the Fold button — can call it without needing the whole hook
// instance wired up.
export const isPicotFoldEligible = (
  elementId: string,
  picotId: string,
  elements: any[],
  picotConnections: any[],
): boolean => {
  if (isEndpointPicotId(picotId)) return false;
  const el = elements.find(e => e.id === elementId);
  const picot = el?.picots?.find((pic: any) => pic.id === picotId);
  if (!picot) return false;
  if (picot.beadType || picot.isCoreJoin) return false;
  const alreadyConnected = picotConnections.some(conn =>
    conn.picots.some((cp: any) => cp.elementId === elementId && cp.picotId === picotId)
  );
  if (alreadyConnected) return false;
  return true;
};

// Whether a full 2-picot selection is eligible to be folded together.
// Exported standalone for the same reason as isPicotFoldEligible — UI needs
// this to gate the Fold button without a hook instance.
export const canFoldSelection = (
  sel: any[],
  elements: any[],
  picotConnections: any[],
): boolean => {
  if (sel.length !== 2) return false;
  return sel.every(sp => isPicotFoldEligible(sp.elementId, sp.picotId, elements, picotConnections));
};

// Given a picot that's already part of a fold connection, returns its
// fold partner's {elementId, picotId} — or null if this picot isn't
// currently folded. Used by the click-to-select handler (useInputHandlers.ts)
// to auto-select the partner and surface the fold's sliders on a single
// click, per design decision. Also usable to look up the fold connection
// itself: find it in picotConnections by matching both picots.
export const getFoldPartner = (
  picotConnections: any[],
  elementId: string,
  picotId: string,
): { elementId: string; picotId: string } | null => {
  const conn = getFoldConnection(picotConnections, elementId, picotId);
  if (!conn) return null;
  const partner = conn.picots.find((cp: any) => !(cp.elementId === elementId && cp.picotId === picotId));
  return partner ? { elementId: partner.elementId, picotId: partner.picotId } : null;
};

// Finds the fold connection (if any) that a given picot belongs to. Used by
// getFoldPartner above, and directly by callers (the property-bar slider UI)
// that want the connection object itself — id and current property values —
// rather than just the partner identity.
export const getFoldConnection = (
  picotConnections: any[],
  elementId: string,
  picotId: string,
): any | null =>
  picotConnections.find(c =>
    c.connectionType === 'fold' &&
    c.picots.some((cp: any) => cp.elementId === elementId && cp.picotId === picotId)
  ) ?? null;

// Resolves a selected picot to a per-element "slot" key that's portable across
// every ghost instance of the same source element: a numeric array index for
// real picots (every ghost has the same picots array shape as its source, so
// the same index always refers to the same picot slot), or the pseudo-picot ID
// string itself for endpoint picots (__start__/__end__/__anchor__ are fixed and
// identical on every instance — they're not stored in el.picots at all, so
// there's no index to resolve; the ID already IS the portable slot identifier).
// Returns null if a real picot ID can't be found on this element.
const resolvePicotSlot = (el: any, picotId: string): number | string | null => {
  if (isEndpointPicotId(picotId)) return picotId;
  const idx = el.picots?.findIndex((pic: any) => pic.id === picotId) ?? -1;
  return idx < 0 ? null : idx;
};

// Resolves a per-element slot key back to a {id} on a specific ghost instance.
// Numeric slots (real picots) look up that ghost's own picots array; string
// slots (pseudo-picots) are already the final, instance-independent ID, so no
// lookup is needed or possible.
const getPicotAtSlot = (ghostInstance: any, slot: number | string): { id: string } | undefined => {
  if (typeof slot === 'string') return { id: slot };
  return ghostInstance.picots?.[slot];
};

// Order ghosts by matchingArray.ghostIds directly — NOT by re-deriving order
// from rotation. ghostIds is always built in creation order (every push site
// in tattingindex.tsx appends inside a `for (i = 1; i < count; i++)` loop, in
// both the initial-creation and regenerateGhostArrays paths), so it's already
// authoritative. Sorting by raw `rotation % 360` instead is unsafe: createPolarInstance
// computes each ghost's rotation as (sourceEl.rotation + angleDeg) % 360, and
// if sourceEl.rotation is nonzero, that modulo can wrap SOME ghosts past 360°
// but not others, silently reordering them relative to creation order — which
// scrambles which ghost pairs this function connects. Confirmed via a real
// user report (see architecture.md) that this produced visibly wrong
// connections; not a hypothetical.
const getSortedGhosts = (matchingArray: any, currentElements: any[]): any[] => {
  const ghostById = new Map(currentElements.filter(e => e.type === 'ghost').map(e => [e.id, e]));
  return (matchingArray.ghostIds || [])
    .map((id: string) => ghostById.get(id))
    .filter((el: any): el is any => !!el);
};

// Builds any picotConnections entries that are missing for one inherited-join
// record, given the array's CURRENT set of ghosts. Shared by two callers:
// checkAndStoreInheritedJoin (driven by a live selection, right after the user
// manually joins two picots) and reapplyInheritedJoins (driven by a stored
// record, after array regeneration recreates the ghost elements with new IDs).
// Same connection topology either way — only the source of
// isSourceElement/sourcePicotIndex/targetPicotIndex differs.
// materialId is passed in rather than derived here: the live-join caller uses
// the specific boundary ghost the user selected (preserving exact prior
// behavior); the replay caller falls back to the source element's, since the
// originally-selected ghost may no longer exist after regeneration.
//
// anchorEnd ('start' | 'end' | undefined) — only meaningful when
// isSourceElement is true. A closed-circle source element has TWO boundary
// neighbors: the array's first-created ghost and its last-created ghost. The
// user's direct join could be to either one, but the chain built below must
// walk AWAY from whichever one was actually clicked and close the wraparound
// at the OTHER end — otherwise, if the clicked ghost happens to be the
// last-created one, the fixed ascending walk collides with itself: it tries
// to re-use that ghost's already-joined picot slot as an ordinary mid-chain
// link, AND independently rebuilds a second edge back to the same ghost in
// the wraparound step. undefined is treated as 'start' (the pre-existing
// behavior) for legacy inheritedJoins records that predate this field.
const buildConnectionsForInheritedJoin = (
  matchingArray: any,
  currentElements: any[],
  isSourceElement: boolean,
  sourcePicotIndex: number | string,
  targetPicotIndex: number | string,
  existingConns: any[],
  materialId: string,
  anchorEnd?: 'start' | 'end',
  // Extra fields to spread onto every connection this call creates — e.g.
  // { connectionType: 'fold', ...DEFAULT_FOLD_PROPS } when the original
  // manually-made join being propagated was a fold. undefined for a regular
  // join (the pre-existing behavior). Each propagated ghost-array instance
  // of a fold gets its own independent copy of the fold properties — they
  // aren't linked, so adjusting one instance's sliders doesn't move the
  // others'. That matches how every other per-connection property in this
  // codebase already works (materialId, etc.) and avoids a new kind of
  // "linked across ghosts" concept that nothing else here has.
  connExtra?: Record<string, any>
): any[] => {
  const sourceEl = currentElements.find(e => e.id === matchingArray.sourceId);
  if (!sourceEl) return [];

  const sortedGhosts = getSortedGhosts(matchingArray, currentElements);
  if (sortedGhosts.length < 2) return [];

  const newConns: any[] = [];
  const connExists = (elA: string, picA: string, elB: string, picB: string) => {
    const matches = (conn: any) =>
      conn.picots.some((cp: any) => cp.elementId === elA && cp.picotId === picA) &&
      conn.picots.some((cp: any) => cp.elementId === elB && cp.picotId === picB);
    return existingConns.some(matches) || newConns.some(matches);
  };

  // Whether the array is polar AND actually a full closed circle (angle a
  // multiple of 360°) — type === 'polar' alone isn't enough: a partial-arc
  // polar array (e.g. a 180° fan) has ghosts spanning an open arc, not a
  // closed ring. Used below to decide whether either branch's wraparound
  // connection is geometrically valid.
  const isClosedCircle = matchingArray.type === 'polar' && typeof matchingArray.angle === 'number'
    && matchingArray.angle > 0 && Math.abs(matchingArray.angle % 360) < 0.01;

  if (isSourceElement) {
    const sendPicotSlot = targetPicotIndex;
    const recvPicotSlot = sourcePicotIndex;

    // Walk from the clicked boundary outward, not always ascending. See the
    // anchorEnd doc comment above the function signature for why this matters.
    const chainOrder = anchorEnd === 'end' ? [...sortedGhosts].reverse() : sortedGhosts;

    for (let i = 0; i < chainOrder.length - 1; i++) {
      const ghost = chainOrder[i];
      const nextGhost = chainOrder[i + 1];
      const srcPicot = getPicotAtSlot(ghost, sendPicotSlot);
      const tgtPicot = getPicotAtSlot(nextGhost, recvPicotSlot);
      if (!srcPicot || !tgtPicot) continue;
      if (connExists(ghost.id, srcPicot.id, nextGhost.id, tgtPicot.id)) continue;
      newConns.push({
        id: generateId(),
        picots: [
          { elementId: ghost.id, picotId: srcPicot.id },
          { elementId: nextGhost.id, picotId: tgtPicot.id },
        ],
        materialId,
        isInheritedJoin: matchingArray.id,
        ...(connExtra ? { ...connExtra } : {}),
      });
    }

    // Wrap the FAR end of the chain (opposite the clicked boundary) back to
    // the source element — closes the loop. Only valid when isClosedCircle.
    if (isClosedCircle) {
      const farGhost = chainOrder[chainOrder.length - 1];
      const srcPicotLast = getPicotAtSlot(farGhost, sendPicotSlot);
      const tgtPicotLast = getPicotAtSlot(sourceEl, recvPicotSlot);
      if (srcPicotLast && tgtPicotLast && !connExists(farGhost.id, srcPicotLast.id, sourceEl.id, tgtPicotLast.id)) {
        newConns.push({
          id: generateId(),
          picots: [
            { elementId: farGhost.id, picotId: srcPicotLast.id },
            { elementId: sourceEl.id, picotId: tgtPicotLast.id },
          ],
          materialId,
          isInheritedJoin: matchingArray.id,
          ...(connExtra ? { ...connExtra } : {}),
        });
      }
    }
  } else {
    // Same closed-circle requirement as the source-wrap case above: i=0's
    // "previous" wraps to the last ghost via the modulo below, which only
    // makes sense if the array actually closes into a full circle. For a
    // partial arc (or, structurally, a linear array — though linear arrays
    // only ever have one boundary ghost today, so this branch shouldn't be
    // reachable for them), skip that one wrapping pair and only connect
    // consecutive ghosts.
    const startIdx = isClosedCircle ? 0 : 1;
    for (let i = startIdx; i < sortedGhosts.length; i++) {
      const ghost = sortedGhosts[i];
      const prevIndex = (i - 1 + sortedGhosts.length) % sortedGhosts.length;
      const prevGhost = sortedGhosts[prevIndex];
      const srcPicot = getPicotAtSlot(ghost, sourcePicotIndex);
      const tgtPicot = getPicotAtSlot(prevGhost, targetPicotIndex);
      if (!srcPicot || !tgtPicot) continue;
      if (connExists(ghost.id, srcPicot.id, prevGhost.id, tgtPicot.id)) continue;
      newConns.push({
        id: generateId(),
        picots: [
          { elementId: ghost.id, picotId: srcPicot.id },
          { elementId: prevGhost.id, picotId: tgtPicot.id },
        ],
        materialId,
        isInheritedJoin: matchingArray.id,
        ...(connExtra ? { ...connExtra } : {}),
      });
    }
  }

  return newConns;
};

// Applies isJoint flag changes to picots identified by "elementId::picotId"
// keys — shared by every place in this file that promotes newly-connected
// picots to isJoint:true or demotes newly-disconnected ones to isJoint:false.
// checkAndStoreInheritedJoin, reapplyInheritedJoins, performJoin,
// removeInheritedJoins, and breakSelectedPicots each used to hand-roll their
// own copy of this same "map elements, map picots, flip isJoint if the key
// is in my set and the value actually differs" loop. Only keys present in
// desiredByKey are touched; a key mapped to the picot's current isJoint
// value is a no-op — preserves the existing "updated === el.picots ? el :
// ..." identity-check pattern every call site already relied on, so
// unaffected elements/picots keep the same object reference (avoids
// unnecessary re-renders).
const applyJointFlags = (elements: any[], desiredByKey: Map<string, boolean>): any[] => {
  if (desiredByKey.size === 0) return elements;
  return elements.map(el => {
    if (!el.picots) return el;
    const updated = el.picots.map((pic: any) => {
      const desired = desiredByKey.get(`${el.id}::${pic.id}`);
      return desired !== undefined && desired !== pic.isJoint ? { ...pic, isJoint: desired } : pic;
    });
    return updated === el.picots ? el : { ...el, picots: updated };
  });
};

export interface UseJoinActionsParams {
  // Refs
  selectedPicotsRef: React.RefObject<any[]>;
  elementsRef: React.RefObject<any[]>;
  picotConnectionsRef: React.RefObject<any[]>;
  roundsRef: React.RefObject<any[]>;
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
  skipAutoHistoryRef: React.RefObject<boolean>;
}

export function useJoinActions(p: UseJoinActionsParams) {

  // ── Inherited join helpers ────────────────────────────────────────────────

  const checkAndStoreInheritedJoin = (selPicots: any[], currentElements: any[], connExtra?: Record<string, any>) => {
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

    const ghostPicotSlot = resolvePicotSlot(ghostEl, selPicots[ghostEl === el1 ? 0 : 1].picotId);
    const otherPicotSlot = resolvePicotSlot(otherEl, selPicots[otherEl === el1 ? 0 : 1].picotId);
    if (ghostPicotSlot === null || otherPicotSlot === null) return;

    let sourcePicotIndex: number | string, targetPicotIndex: number | string;
    if (isSourceElement) {
      sourcePicotIndex = ghostPicotSlot;
      targetPicotIndex = otherPicotSlot;
    } else {
      const isGhostEarlier = ghostEl.rotation < otherEl.rotation;
      sourcePicotIndex = isGhostEarlier ? ghostPicotSlot : otherPicotSlot;
      targetPicotIndex = isGhostEarlier ? otherPicotSlot : ghostPicotSlot;
    }

    // Which end of the array's creation-order ghost list the clicked boundary
    // sits at. Needed so buildConnectionsForInheritedJoin can walk the chain
    // away from the clicked ghost instead of always assuming it's the first
    // one — see the anchorEnd doc comment on buildConnectionsForInheritedJoin.
    // Only meaningful (and only computed) for the source-element case; the
    // boundary-to-boundary branch doesn't use it.
    let anchorEnd: 'start' | 'end' | undefined;
    if (isSourceElement) {
      const sortedGhosts = getSortedGhosts(matchingArray, currentElements);
      const idx = sortedGhosts.findIndex((g: any) => g.id === ghostEl.id);
      anchorEnd = idx === sortedGhosts.length - 1 ? 'end' : 'start';
    }

    const alreadyExists = matchingArray.inheritedJoins?.some(
      j => j.sourcePicotIndex === sourcePicotIndex && j.targetPicotIndex === targetPicotIndex
        && j.isSourceElement === isSourceElement && j.anchorEnd === anchorEnd
    );
    if (alreadyExists) return;

    // Record the join pattern unconditionally, even if the array currently has
    // too few ghosts to propagate to right now (buildConnectionsForInheritedJoin
    // below bails on its own via sortedGhosts.length < 2). Otherwise a join made
    // while an array only has its minimum 1 ghost (the "copies" floor is 2,
    // i.e. 1 source + 1 ghost) would never be recorded, and a later regeneration
    // that grows the array wouldn't have anything to replay onto the new ghosts.
    p.setGhostArrays(prev => prev.map(a =>
      a.id === matchingArray.id
        ? { ...a, inheritedJoins: [...(a.inheritedJoins || []), { sourcePicotIndex, targetPicotIndex, isSourceElement, anchorEnd, connExtra }] }
        : a
    ));

    const newInheritedConns = buildConnectionsForInheritedJoin(
      matchingArray, currentElements, isSourceElement, sourcePicotIndex, targetPicotIndex,
      p.picotConnectionsRef.current, ghostEl.materialId || 'default', anchorEnd, connExtra
    );
    if (newInheritedConns.length === 0) return;

    const allNewConns = [...p.picotConnectionsRef.current, ...newInheritedConns];
    p.setPicotConnections(allNewConns);
    p.picotConnectionsRef.current = allNewConns;

    const inheritedKeys = new Map<string, boolean>(
      newInheritedConns.flatMap(conn =>
        conn.picots.map(cp => [`${cp.elementId}::${cp.picotId}`, true] as [string, boolean])
      )
    );
    const updatedEls = applyJointFlags(currentElements, inheritedKeys);
    p.setElements(updatedEls);
    p.elementsRef.current = updatedEls;
  };

  // Replays every recorded inherited-join pattern across ALL ghost arrays
  // against their CURRENT set of ghosts. Called after array regeneration
  // (which recreates ghost elements with new IDs) so joins the user made
  // before a count/param change reapply to the new ghosts too — including
  // ones added for entirely new slots that didn't exist before regeneration.
  // Legacy inheritedJoins entries recorded before isSourceElement was tracked
  // (typeof entry.isSourceElement !== 'boolean') are skipped rather than
  // guessed — the topology (boundary↔source vs boundary↔boundary) can't be
  // reliably recovered from the stored index pair alone, and a wrong guess
  // would create an incorrect connection, which is worse than replaying
  // nothing for that one pre-existing record.
  const reapplyInheritedJoins = (currentElements: any[], currentGhostArrays: any[]) => {
    let workingConns = p.picotConnectionsRef.current;
    const allNewConns: any[] = [];

    currentGhostArrays.forEach(matchingArray => {
      const entries = matchingArray.inheritedJoins || [];
      if (entries.length === 0) return;
      const sourceEl = currentElements.find(e => e.id === matchingArray.sourceId);
      const materialId = sourceEl?.materialId || 'default';

      entries.forEach((entry: any) => {
        if (typeof entry.isSourceElement !== 'boolean') return;
        // Source-element entries recorded before anchorEnd was tracked can't
        // have their chain direction recovered — same reasoning as the
        // isSourceElement check above: replaying nothing is safer than
        // guessing a direction and risking a wrong (silently double-booked)
        // connection.
        if (entry.isSourceElement && entry.anchorEnd !== 'start' && entry.anchorEnd !== 'end') return;
        // entry.connExtra (e.g. { connectionType: 'fold', ...fold props })
        // is undefined for legacy inheritedJoins records and for ordinary
        // joins — buildConnectionsForInheritedJoin already treats undefined
        // as "regular connection, no extra fields," so no legacy shim
        // needed here beyond the isSourceElement/anchorEnd guards above.
        const newConns = buildConnectionsForInheritedJoin(
          matchingArray, currentElements, entry.isSourceElement, entry.sourcePicotIndex, entry.targetPicotIndex,
          workingConns, materialId, entry.anchorEnd, entry.connExtra
        );
        if (newConns.length > 0) {
          workingConns = [...workingConns, ...newConns];
          allNewConns.push(...newConns);
        }
      });
    });

    if (allNewConns.length === 0) return;

    p.setPicotConnections(workingConns);
    p.picotConnectionsRef.current = workingConns;

    const inheritedKeys = new Map<string, boolean>(
      allNewConns.flatMap(conn => conn.picots.map((cp: any) => [`${cp.elementId}::${cp.picotId}`, true] as [string, boolean]))
    );
    const updatedEls = applyJointFlags(currentElements, inheritedKeys);
    p.setElements(updatedEls);
    p.elementsRef.current = updatedEls;
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

      const demoteKeys = new Map<string, boolean>();
      removedKeys.forEach(key => { if (!stillConnectedKeys.has(key)) demoteKeys.set(key, false); });
      const updatedEls = applyJointFlags(currentElements, demoteKeys);
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

  // Shared by joinSelectedPicots and foldSelectedPicots — everything about
  // making a connection (isJoint promotion, boundary-ghost mirroring,
  // inherited-join propagation, the one history push) is identical between
  // a regular join and a fold; the only difference is what extra fields ride
  // along on the connection object. connExtra is spread onto the connection
  // as-is — undefined for a regular join (unchanged prior behavior),
  // { connectionType: 'fold', ...DEFAULT_FOLD_PROPS } for a fold.
  const performJoin = (sel: any[], connExtra?: Record<string, any>) => {
    // Set before ANY state mutation below, not just before the final explicit
    // push. checkAndStoreInheritedJoin makes its own setElements/setPicotConnections
    // calls partway through this function — if the auto-push effect were to
    // fire on that intermediate state (before we've made our one explicit
    // push at the end), it would record an extra history entry for what's
    // really a single join action, making undo take two steps to fully
    // revert instead of one.
    p.skipAutoHistoryRef.current = true;

    const firstEl = p.elementById.get(sel[0].elementId);
    const connMaterialId = firstEl?.materialId || 'default';

    const connection = {
      id: generateId(),
      picots: [...sel],
      materialId: connMaterialId,
      ...(connExtra ? { ...connExtra } : {}),
    };
    const newConns = [...p.picotConnectionsRef.current, connection];
    p.setPicotConnections(newConns);
    p.picotConnectionsRef.current = newConns;

    // Auto-promote to isJoint: true (skip endpoint pseudo-picots)
    const jointKeys = new Map<string, boolean>(
      sel.filter(sp => !isEndpointPicotId(sp.picotId)).map(sp => [`${sp.elementId}::${sp.picotId}`, true] as [string, boolean])
    );
    let newEls = applyJointFlags(p.elementsRef.current, jointKeys);

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

    // Runs for both real and endpoint pseudo-picots — resolvePicotSlot/getPicotAtSlot
    // inside checkAndStoreInheritedJoin handle both; the function's own internal
    // guards (isBoundary, matchingArray, isSourceElement/isOtherBoundary) already
    // no-op correctly for any non-applicable selection, so no guard is needed here.
    checkAndStoreInheritedJoin(sel, newEls, connExtra);

    // Regular join: clear selection so the user can start a fresh pick,
    // same as always. Fold: deliberately KEEP the selection — design intent
    // is that after folding, the pair stays selected and its property
    // sliders appear immediately. tattingindex.tsx derives activeFold from
    // selectedPicots via getFoldConnection, the same lookup used when the
    // user clicks an already-folded picot to edit it later — one code path
    // for both "just created" and "selected to edit."
    if (connExtra?.connectionType !== 'fold') {
      p.setSelectedPicots([]);
    }
    // Push from the refs, not the local newEls/newConns — checkAndStoreInheritedJoin
    // may have updated elementsRef.current/picotConnectionsRef.current further
    // (isJoint promotion + any propagated inherited connections) after those
    // locals were captured. Pushing the locals here would record a snapshot
    // that's missing the propagated joins, silently out of sync with what's
    // actually on screen.
    p.pushHistoryState(p.elementsRef.current, p.picotConnectionsRef.current, p.roundsRef.current);
  };

  const joinSelectedPicots = useCallback(() => {
    const sel = p.selectedPicotsRef.current;
    if (sel.length < 2) return;
    performJoin(sel);
  }, [p.elementById, p.ghostArrays]);

  // Fold is deliberately narrower than a regular join: exactly two picots
  // (a fold has one partner, never more — see design notes), and both must
  // pass isPicotFoldEligible (plain picot, not already connected to
  // anything). The property-bar Fold button is expected to already be
  // disabled when canFoldSelection(sel, ...) is false, so this guard is a
  // defensive no-op in the normal path, not the primary gate — same pattern
  // as every other "should already be disabled in the UI" guard in this
  // codebase (see e.g. the length checks in joinSelectedPicots/
  // breakSelectedPicots above).
  const foldSelectedPicots = useCallback(() => {
    const sel = p.selectedPicotsRef.current;
    if (!canFoldSelection(sel, p.elementsRef.current, p.picotConnectionsRef.current)) return;
    performJoin(sel, { connectionType: 'fold', ...DEFAULT_FOLD_PROPS });
  }, [p.elementById, p.ghostArrays]);

  // Updates one or more fold properties (outerLength, innerLength, angleA,
  // angleB) on an existing fold connection. Deliberately does NOT go
  // through performJoin/checkAndStoreInheritedJoin — editing a fold's drape
  // is a property tweak, not a new topological join, so ghost-array
  // propagation doesn't apply (each propagated fold instance already has
  // its own independent copy of these properties — see the connExtra doc
  // comment on buildConnectionsForInheritedJoin — and this only touches the
  // one connection the user is actually looking at).
  //
  // pushHistory defaults to true (every call pushes one history entry,
  // matching prior behavior) but can be set false for intermediate ticks of
  // a press-and-hold nudge — mirrors applySingleRotationDelta's own
  // pushHistory param in useEditorActions.ts, same reasoning: a hold that
  // fires many rapid updates should collapse into ONE undo entry on
  // release, not one per tick.
  const updateFoldConnection = useCallback((connectionId: string, patch: Record<string, any>, pushHistory: boolean = true) => {
    const newConns = p.picotConnectionsRef.current.map(conn =>
      conn.id === connectionId ? { ...conn, ...patch } : conn
    );
    p.setPicotConnections(newConns);
    p.picotConnectionsRef.current = newConns;
    if (pushHistory) p.pushHistoryState(p.elementsRef.current, newConns, p.roundsRef.current);
  }, []);

  const breakSelectedPicots = useCallback(() => {
    const sel = p.selectedPicotsRef.current;
    if (sel.length === 0) return;

    // See the matching comment in joinSelectedPicots — set before any state
    // mutation, since removeInheritedJoins makes its own state calls too.
    p.skipAutoHistoryRef.current = true;

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
    const demoteKeys = new Map<string, boolean>();
    brokenSet.forEach(key => { if (!stillConnected.has(key)) demoteKeys.set(key, false); });
    const newEls = applyJointFlags(p.elementsRef.current, demoteKeys);
    p.setElements(newEls);

    p.setSelectedPicots([]);
    p.pushHistoryState(newEls, newConns, p.roundsRef.current);
  }, [p.ghostArrays]);

  return { joinSelectedPicots, foldSelectedPicots, updateFoldConnection, breakSelectedPicots, reapplyInheritedJoins };
}
