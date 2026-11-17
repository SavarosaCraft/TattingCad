// Array copies — one element placed at slot `index` of a polar or linear
// array. Used by Arrange → Polar / Linear Array (real copies), by ghost
// arrays (asGhost: a 'ghost' element that follows its mother) and by the
// dialogs' live preview. Moved here unchanged from tattingindex.tsx
// (session 64, Task 2 step 1); the only change: createLinearInstance takes
// dsWidth as a parameter instead of reading the component's state.
//
// generateId() is called here — never call these inside a setElements(fn)
// updater (React may run an updater twice: the ids would differ).
import { generateId } from '../utils/id';
import { rotatePathsAroundCenter } from './paths';

// ── Pure helper: create one polar array instance ──
// Returns a new element (ghost or real) placed at position i in the array.
export const createPolarInstance = (
  sourceEl: any,
  index: number,
  pivotX: number,
  pivotY: number,
  count: number,
  fillAngle: number,
  options?: { asGhost?: boolean; sourceId?: string; isBoundary?: boolean; groupIdMap?: Map<string, string>; polarGridId?: string }
) => {
  const stepDeg = fillAngle / count;
  const angleDeg = stepDeg * index;
  const rad = angleDeg * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const asGhost = options?.asGhost ?? false;

  // Rotate center around pivot
  const newCx = pivotX + (sourceEl.center.x - pivotX) * cos - (sourceEl.center.y - pivotY) * sin;
  const newCy = pivotY + (sourceEl.center.x - pivotX) * sin + (sourceEl.center.y - pivotY) * cos;

  if (asGhost) {
    // Session 64 (user decision): a ghost is a FULL copy of its mother, like
    // linear ghosts always were. The explicit field list it had before left
    // out the notation (and squeeze, side-B colour…), so the realistic view
    // drew jk / beads / mixed stitches as plain ds, and Convert made real
    // rings without a notation. What a ghost must NOT carry — anything that
    // would make it a pattern member of its own — is removed: its order
    // number, group, round, polar grid and the mother mark.
    const ghost = JSON.parse(JSON.stringify(sourceEl));
    ghost.id = generateId();
    // Kind of element this is a copy of (chain / ring / line). type must stay
    // 'ghost' — join logic keys off it; drawing uses sourceType.
    ghost.sourceType = sourceEl.type;
    ghost.type = 'ghost';
    ghost.sourceId = options?.sourceId || sourceEl.id;
    ghost.isBoundary = options?.isBoundary ?? false;
    for (const k of ['orderNumber', 'groupId', 'roundId', 'polarRotationGridId', 'isGhostMother']) delete ghost[k];
    ghost.center = { x: newCx, y: newCy };
    ghost.paths = (sourceEl.paths || []).map((p: any) => {
      const rotPt = (px: number, py: number) => {
        const rx = px - pivotX, ry = py - pivotY;
        return { x: pivotX + rx * cos - ry * sin, y: pivotY + rx * sin + ry * cos };
      };
      const s = rotPt(p.x, p.y), e2 = rotPt(p.endX, p.endY);
      if (p.type === 'cubic') {
        const c1 = rotPt(p.control1X, p.control1Y), c2 = rotPt(p.control2X, p.control2Y);
        return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
      } else {
        const c = rotPt(p.controlX, p.controlY);
        return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: c.x, controlY: c.y };
      }
    });
    ghost.rotation = ((sourceEl.rotation || 0) + angleDeg) % 360;
    return ghost;
  } else {
    // Build real copy element
    const newEl = JSON.parse(JSON.stringify(sourceEl));
    newEl.id = generateId();
    delete newEl.orderNumber;
    if (sourceEl.groupId && options?.groupIdMap) {
      newEl.groupId = options.groupIdMap.get(sourceEl.groupId);
    }
    if (options?.polarGridId) newEl.polarRotationGridId = options.polarGridId;

    newEl.center = { x: newCx, y: newCy };
    newEl.rotation = ((sourceEl.rotation || 0) + angleDeg) % 360;

    if (newEl.paths) {
      newEl.paths = newEl.paths.map((p: any) => {
        const rotPt = (px: number, py: number) => {
          const rx = px - pivotX, ry = py - pivotY;
          return { x: pivotX + rx * cos - ry * sin, y: pivotY + rx * sin + ry * cos };
        };
        const s = rotPt(p.x, p.y), e2 = rotPt(p.endX, p.endY);
        if (p.type === 'cubic') {
          const c1 = rotPt(p.control1X, p.control1Y), c2 = rotPt(p.control2X, p.control2Y);
          return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
        } else {
          const c = rotPt(p.controlX, p.controlY);
          return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: c.x, controlY: c.y };
        }
      });
    }

    return newEl;
  }
};

// ── Pure helper: create one linear array instance ──
// Returns a new element (ghost or real) placed at position i in the array.
export const createLinearInstance = (
  sourceEl: any,
  index: number,
  dx: number,
  dy: number,
  rotStep: number,
  dsWidth: number,
  options?: { asGhost?: boolean; sourceId?: string; isBoundary?: boolean; groupIdMap?: Map<string, string> }
) => {
  const offsetX = dx * index;
  const offsetY = dy * index;
  const extraRot = rotStep * index;
  const asGhost = options?.asGhost ?? false;

  const newEl = JSON.parse(JSON.stringify(sourceEl));
  newEl.id = generateId();
  delete newEl.orderNumber;
  if (sourceEl.groupId && options?.groupIdMap) {
    newEl.groupId = options.groupIdMap.get(sourceEl.groupId);
  }

  const newCx = sourceEl.center.x + offsetX;
  const newCy = sourceEl.center.y + offsetY;
  newEl.center = { x: newCx, y: newCy };

  // Translate paths to new position
  if (newEl.paths) {
    newEl.paths = newEl.paths.map((p: any) => {
      if (p.type === 'cubic') {
        return { ...p, x: p.x + offsetX, y: p.y + offsetY, endX: p.endX + offsetX, endY: p.endY + offsetY, control1X: p.control1X + offsetX, control1Y: p.control1Y + offsetY, control2X: p.control2X + offsetX, control2Y: p.control2Y + offsetY };
      } else {
        return { ...p, x: p.x + offsetX, y: p.y + offsetY, endX: p.endX + offsetX, endY: p.endY + offsetY, controlX: p.controlX + offsetX, controlY: p.controlY + offsetY };
      }
    });
  }

  // Rotate paths around the new center
  if (extraRot !== 0) {
    const newAbsRot = ((sourceEl.rotation || 0) + extraRot + 360) % 360;
    newEl.paths = rotatePathsAroundCenter(newEl.paths, newCx, newCy, extraRot, dsWidth, sourceEl, newAbsRot);
    newEl.rotation = newAbsRot;
  }

  // Convert to ghost if requested
  if (asGhost) {
    newEl.sourceType = newEl.type;
    newEl.type = 'ghost';
    newEl.sourceId = options?.sourceId || sourceEl.id;
    newEl.isBoundary = options?.isBoundary ?? false;
    delete newEl.isGhostMother;
  }

  return newEl;
};
