// Ghost arrays — rebuilding a mother's ghost copies (session 64, Task 2
// step 2: moved here unchanged from tattingindex.tsx). The only change: the
// polar grids and the stitch width come in as `ctx` instead of being read
// from the component.
//
// Not quite pure: every rebuilt copy gets a new id (generateId), so never
// call this inside a setElements(fn) updater — React may run an updater
// twice and the ids would differ. Callers take a snapshot, call this, and
// commit the result (applyGhostRegenResult in tattingindex.tsx).
import { createPolarInstance, createLinearInstance } from '../geometry/arrays';

export interface GhostRegenContext {
  /** The pattern's polar grids — a polar array's pivot can be one of them. */
  polarGrids: { id: string; center: { x: number; y: number } }[];
  /** Width of one double stitch (linear arrays with a rotation step need it). */
  dsWidth: number;
}

export interface GhostRegenResult {
  elements: any[];
  ghostArrays: any[];
  /** old ghost id → new ghost id, slot by slot, for remapping joins. */
  connectionIdMap: Map<string, string>;
}

// Pure: regenerates ghost-array copies for one or more mothers, given a
// snapshot of elements + ghostArrays — NOT React state directly. This lets
// callers (move, rotate, notation edit) compose ghost regeneration into
// their OWN setElements call, so the whole thing commits as a single
// render/history step instead of two separate ones.
export const regenerateGhostArrays = (
  elementsSnapshot: any[],
  ghostArraysSnapshot: any[],
  motherIds: string[],
  ctx: GhostRegenContext,
): { elements: any[]; ghostArrays: any[]; connectionIdMap: Map<string, string> } => {
  let workingElements = elementsSnapshot;
  let workingGhostArrays = ghostArraysSnapshot;
  const connectionIdMap = new Map<string, string>();

  motherIds.forEach(motherId => {
    const motherEl = workingElements.find(e => e.id === motherId);
    if (!motherEl || !motherEl.isGhostMother) return;

    const relevantArrays = workingGhostArrays.filter(array => array.sourceId === motherId);

    relevantArrays.forEach(array => {
      const withoutGhosts = workingElements.filter(el => !(el.type === 'ghost' && el.sourceId === motherId));
      const sourceEl = withoutGhosts.find(e => e.id === motherId);
      if (!sourceEl) return;

      const newGhosts: any[] = [];
      const newGhostIds: string[] = [];
      const boundaryGhostIds: string[] = [];

      if (array.type === 'polar') {
        const count = array.instanceCount;
        const fillAngle = array.angle;
        const pivotId = array.pivotId || 'selection';

        let pivotX: number, pivotY: number;
        if (pivotId && pivotId !== 'selection') {
          const grid = ctx.polarGrids.find(g => g.id === pivotId);
          pivotX = grid ? grid.center.x : sourceEl.center.x;
          pivotY = grid ? grid.center.y : sourceEl.center.y;
        } else {
          pivotX = sourceEl.center.x;
          pivotY = sourceEl.center.y;
        }

        for (let i = 1; i < count; i++) {
          const isBoundary = (i === 1 || i === count - 1);
          const ghostEl = createPolarInstance(sourceEl, i, pivotX, pivotY, count, fillAngle, {
            asGhost: true, sourceId: motherId, isBoundary,
          });
          newGhosts.push(ghostEl);
          newGhostIds.push(ghostEl.id);
          if (isBoundary) boundaryGhostIds.push(ghostEl.id);
        }
      } else if (array.type === 'linear') {
        const count = array.instanceCount;
        const angleDeg = array.angle;
        const spacingPercent = array.spacing;
        const rotStep = array.rotStep;
        const storedElementSize = array.elementSize;

        const rad = angleDeg * Math.PI / 180;
        // Center-to-center: 100% = just touching, 200% = 1 element gap
        const spacing = storedElementSize ? storedElementSize * spacingPercent / 100 : storedElementSize;
        const dx = Math.cos(rad) * spacing;
        const dy = Math.sin(rad) * spacing;

        for (let i = 1; i < count; i++) {
          const isBoundary = (i === 1); // Ghost closest to the mother is the boundary for linear
          const ghostEl = createLinearInstance(sourceEl, i, dx, dy, rotStep, ctx.dsWidth, {
            asGhost: true, sourceId: motherId, isBoundary,
          });
          newGhosts.push(ghostEl);
          newGhostIds.push(ghostEl.id);
          if (isBoundary) boundaryGhostIds.push(ghostEl.id);
        }
      }

      // Map old ghost IDs to new ones by position — both lists are built by
      // the same `for (i = 1; i < count; i++)` order, so index k always
      // refers to the same array slot before and after regeneration.
      const oldGhostIds = array.ghostIds || [];
      for (let k = 0; k < Math.min(oldGhostIds.length, newGhostIds.length); k++) {
        connectionIdMap.set(oldGhostIds[k], newGhostIds[k]);
      }

      workingGhostArrays = workingGhostArrays.map(a =>
        a.id === array.id
          ? { ...a, ghostIds: newGhostIds, boundaryIds: boundaryGhostIds, inheritedJoins: a.inheritedJoins || [] }
          : a
      );
      workingElements = [...withoutGhosts, ...newGhosts];
    });
  });

  return { elements: workingElements, ghostArrays: workingGhostArrays, connectionIdMap };
};

// ── The array list from a file (session 64, fix 14) ─────────────────────────
// Saved since file version 93. A pattern file is shared, so this is checked
// like every other field (architecture.md → Release checklist → "new file
// fields"): only well-formed entries are kept, field by field, and an entry
// with a bad required value is dropped as a whole — never guessed.
// - the mother must be in the file, be a mother (isGhostMother) and not a copy;
// - instanceCount: a whole number 2–100 (what the dialogs allow) — a huge
//   count would make the next rebuild hang;
// - angle / rotStep: real numbers; linear also needs spacing 0–500 % and an
//   elementSize > 0 (the rebuild divides nothing by it, but places by it);
// - ghostIds: only copies of THIS mother that are in the file; boundaryIds:
//   only ids from ghostIds;
// - inheritedJoins: picot slots are whole numbers 0–999 or a start / end /
//   anchor point; connExtra is copied onto every join made from the entry,
//   so only a fold's four numbers are taken from it, nothing else.
// Older files have no list → [] (copies stay where they are and don't follow
// the mother — user decision, session 64, option a).
const ENDPOINT_SLOTS = new Set(['__start__', '__end__', '__anchor__']);
const MAX_PICOT_SLOT = 999;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSlot = (v: unknown) =>
  (typeof v === 'string' && ENDPOINT_SLOTS.has(v)) ||
  (isNum(v) && Number.isInteger(v) && v >= 0 && v <= MAX_PICOT_SLOT);
const FOLD_KEYS = ['outerLength', 'innerLength', 'angleA', 'angleB'] as const;
const FOLD_DEFAULTS: Record<(typeof FOLD_KEYS)[number], number> = { outerLength: 130, innerLength: 100, angleA: 0, angleB: 0 };

const normalizeInheritedJoin = (j: any): any | null => {
  if (!j || typeof j !== 'object') return null;
  if (!isSlot(j.sourcePicotIndex) || !isSlot(j.targetPicotIndex)) return null;
  if (typeof j.isSourceElement !== 'boolean') return null;
  const out: any = { sourcePicotIndex: j.sourcePicotIndex, targetPicotIndex: j.targetPicotIndex, isSourceElement: j.isSourceElement };
  if (j.anchorEnd === 'start' || j.anchorEnd === 'end') out.anchorEnd = j.anchorEnd;
  if (j.connExtra && typeof j.connExtra === 'object' && j.connExtra.connectionType === 'fold') {
    const fold: any = { connectionType: 'fold' };
    for (const k of FOLD_KEYS) fold[k] = isNum(j.connExtra[k]) ? j.connExtra[k] : FOLD_DEFAULTS[k];
    out.connExtra = fold;
  }
  return out;
};

export const normalizeGhostArrays = (list: unknown, elements: any[]): any[] => {
  if (!Array.isArray(list)) return [];
  const byId = new Map<string, any>();
  for (const el of elements) if (el && typeof el.id === 'string') byId.set(el.id, el);
  const seen = new Set<string>();
  const out: any[] = [];
  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    const { id, type, sourceId } = a as any;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    if (type !== 'polar' && type !== 'linear') continue;
    const mother = typeof sourceId === 'string' ? byId.get(sourceId) : undefined;
    if (!mother || mother.type === 'ghost' || !mother.isGhostMother) continue;
    const count = (a as any).instanceCount;
    if (!isNum(count) || !Number.isInteger(count) || count < 2 || count > 100) continue;
    if (!isNum((a as any).angle)) continue;
    const rotStep = (a as any).rotStep === undefined ? 0 : (a as any).rotStep;
    if (!isNum(rotStep)) continue;
    const entry: any = {
      id, type, sourceId,
      name: typeof (a as any).name === 'string' ? (a as any).name.slice(0, 200) : '',
      instanceCount: count,
      angle: (a as any).angle,
      spacing: 0,
      rotStep,
    };
    if (type === 'polar') {
      const pivot = (a as any).pivotId;
      entry.pivotId = typeof pivot === 'string' && pivot ? pivot : undefined;
    } else {
      const spacing = (a as any).spacing, size = (a as any).elementSize;
      if (!isNum(spacing) || spacing < 0 || spacing > 500) continue;
      if (!isNum(size) || size <= 0) continue;
      entry.spacing = spacing;
      entry.elementSize = size;
    }
    const isOwnCopy = (gid: unknown) => {
      const g = typeof gid === 'string' ? byId.get(gid) : undefined;
      return !!g && g.type === 'ghost' && g.sourceId === sourceId;
    };
    entry.ghostIds = Array.isArray((a as any).ghostIds) ? [...new Set((a as any).ghostIds.filter(isOwnCopy))] : [];
    const ghostSet = new Set(entry.ghostIds);
    entry.boundaryIds = Array.isArray((a as any).boundaryIds) ? (a as any).boundaryIds.filter((g: unknown) => ghostSet.has(g as string)) : [];
    entry.inheritedJoins = Array.isArray((a as any).inheritedJoins)
      ? (a as any).inheritedJoins.map(normalizeInheritedJoin).filter(Boolean)
      : [];
    seen.add(id);
    out.push(entry);
  }
  return out;
};

// ── Joins when an array's settings change (session 64, fix 13) ──────────────
// The Array Manager's Apply (new count, angle, grid or spacing) rebuilds the
// copies. Their joins are then put right, with these rules (agreed with the
// user, session 64):
// - joins that were copied around the array (isInheritedJoin === array.id)
//   are dropped — they're made again from the array's recorded rule(s) for
//   the new set of copies (reapplyInheritedJoins), so 8 copies get 8 joins
//   and the closing join goes to the new last copy;
// - the user's own join that a rule came from (the "anchor": mother ↔ the
//   first or last copy, or first copy ↔ last copy) follows its copy — it is
//   moved to the new first / last copy, keeping its own settings (fold…);
// - any other join to a copy of this array is dropped: a copy that is gone
//   (fewer copies), or a join by hand from a copy to some other element (the
//   copy moved — user: remove them).
// Joins that don't touch this array's copies are left alone.
export const rewireJoinsForArrayChange = (conns: any[], oldArray: any, newArray: any): any[] => {
  const oldIds: string[] = oldArray.ghostIds || [];
  const newIds: string[] = newArray.ghostIds || [];
  const oldSet = new Set(oldIds);
  const oldFirst = oldIds[0], oldLast = oldIds[oldIds.length - 1];
  const newFirst = newIds[0], newLast = newIds[newIds.length - 1];
  const mother = oldArray.sourceId;
  const rules: any[] = oldArray.inheritedJoins || [];
  const ends = (c: any) => (c.picots || []).map((cp: any) => cp.elementId);
  const isPair = (c: any, a: string, b: string) => {
    const e = ends(c);
    return e.length === 2 && ((e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
  };
  const isAnchor = (c: any) => rules.some(r => {
    if (r.isSourceElement) return isPair(c, mother, r.anchorEnd === 'end' ? oldLast : oldFirst);
    return oldFirst !== oldLast && isPair(c, oldFirst, oldLast);
  });
  const moveTo = (id: string) => id === oldFirst ? newFirst : id === oldLast ? newLast : id;
  const out: any[] = [];
  for (const c of conns) {
    if (c.isInheritedJoin === oldArray.id) continue;
    if (!ends(c).some((id: string) => oldSet.has(id))) { out.push(c); continue; }
    if (!isAnchor(c) || !newFirst) continue;
    out.push({ ...c, picots: c.picots.map((cp: any) => ({ ...cp, elementId: moveTo(cp.elementId) })) });
  }
  return out;
};

// Sets each picot's "joined" mark (isJoint) on the given elements from the
// joins that actually exist — after a rebuild, a copy's picots are copies of
// the mother's (marks included), so a new copy could say "joined" with no
// join behind it. Elements not in `ids` are returned as they are.
export const syncJointFlags = (elements: any[], conns: any[], ids: Set<string>): any[] => {
  const joined = new Set<string>();
  for (const c of conns) for (const cp of c.picots || []) joined.add(`${cp.elementId}::${cp.picotId}`);
  return elements.map(el => {
    if (!ids.has(el.id) || !Array.isArray(el.picots)) return el;
    let changed = false;
    const picots = el.picots.map((pic: any) => {
      const want = joined.has(`${el.id}::${pic.id}`);
      if (!!pic.isJoint === want) return pic;
      changed = true;
      return { ...pic, isJoint: want };
    });
    return changed ? { ...el, picots } : el;
  });
};
