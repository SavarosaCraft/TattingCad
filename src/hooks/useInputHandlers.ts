// src/hooks/useInputHandlers.ts
//
// Mouse input handlers extracted from tattingindex.tsx.
// Handlers close over state passed as params — no mirror refs for state values.
// Legitimate interaction refs (drag state, RAF, flags) are still refs because
// they hold mutable values that change faster than React render cycles.

import { generateId } from '../utils/id';
import { sampleBezierPath, calculatePathLength } from '../geometry/bezier';
import { rotatePaths, createSplitRingPathFromEl } from '../geometry/paths';

export interface UseInputHandlersParams {
  // State values
  elements: any[];
  selectedIds: string[];
  selectedIdSet: Set<string>;
  elementById: Map<string, any>;
  camera: { x: number; y: number };
  zoom: number;
  dsWidth: number;
  renderMode: string;
  activeMode: string | null;
  currentTool: string;
  isDragging: boolean;
  dragStart: any;
  draggedElement: string | null;
  selectionBox: any;
  zoomRectBox: any;
  movingPivot: boolean;
  rotationHandle: string | null;
  pivotOffset: { x: number; y: number };
  rulerPoints: any[];
  snapEnabled: boolean;
  snapRadius: number;
  orthoLock: boolean;
  isShiftHeld: boolean;
  showRotationHandles: boolean;
  polarGrids: any[];
  picotConnections: any[];
  selectedBEs: any[];
  selectedPicots: any[];
  chainPresetSymmetric: boolean;
  orderGroups: any[];

  // Interaction refs (legitimately mutable — not React state)
  pathDragStartRef: React.MutableRefObject<any>;
  lastMousePosRef: React.MutableRefObject<any>;
  isInteractingRef: React.MutableRefObject<boolean>;
  draggedHandleRef: React.MutableRefObject<any>;
  rotationDragStartRef: React.MutableRefObject<any>;
  dragOffsetRef: React.MutableRefObject<any>;
  pivotDragStartRef: React.MutableRefObject<any>;
  pivotOffsetRef: React.MutableRefObject<any>;
  rafIdRef: React.MutableRefObject<any>;
  pendingMouseEventRef: React.MutableRefObject<any>;
  handleMouseMoveInternalRef: React.MutableRefObject<any>;
  createdNewLineRef: React.MutableRefObject<boolean>;
  dragOriginRef: React.MutableRefObject<any>;
  needsHistoryPushRef: React.MutableRefObject<boolean>;
  dragTouchIdRef: React.MutableRefObject<any>;
  spaceDownRef: React.MutableRefObject<boolean>;
  zDownRef: React.MutableRefObject<boolean>;

  // Setters
  setIsDragging: (v: boolean) => void;
  setDragStart: (v: any) => void;
  setZoomRectBox: (v: any) => void;
  setCamera: (fn: (prev: any) => any) => void;
  setElements: (fn: (prev: any[]) => any[]) => void;
  setSelectedIds: (ids: string[]) => void;
  setSelectionBox: (v: any) => void;
  setDraggedElement: (id: string | null) => void;
  setRotationHandle: (v: string | null) => void;
  setMovingPivot: (v: boolean) => void;
  setPivotOffset: (v: { x: number; y: number }) => void;
  setRulerPoints: (fn: (prev: any[]) => any[]) => void;
  setRulerMousePos: (v: any) => void;
  setSelectedBEs: (v: any[]) => void;
  setDragTick: (fn: (prev: number) => number) => void;
  setTattingOrderConflict: (v: any) => void;
  setPropBarOrderDraft: (v: any) => void;
  setShowPropBarGroupDropdown: (v: boolean) => void;
  setTattingOrderInput: (v: string) => void;
  setSelectedPicots: (v: any[]) => void;
  setCurrentTool: (v: string) => void;

  // Utility functions
  screenToWorld: (x: number, y: number) => { x: number; y: number };
  getBoundingBox: (ids: string[]) => any;
  findClosestElement: (x: number, y: number, filter?: (el: any) => boolean) => any;
  getHandleAtPoint: (el: any, x: number, y: number) => any;
  getPicotPosition: (el: any, p: any, baseOnly?: boolean) => any;
  getSnapPoints: (el: any) => any[];
  getEndpointPseudoPicots: (el: any) => Array<{ id: string; x: number; y: number }>;
  findNearestSnapPointWithPolar: (x: number, y: number, excludeId?: any) => any;
  isPointInElement: (el: any, x: number, y: number) => boolean;
  getPolarPivot: (ids: string[]) => any;
  pushHistoryState: (elements: any[], connections: any[], groups: any[]) => void;
  updateGhostArraysForMother: (id: string) => void;
  assignOrderNumber: (id: string, n: number) => void;
  zoomToRect: (minX: number, minY: number, maxX: number, maxY: number) => void;
}

export function useInputHandlers(p: UseInputHandlersParams) {

  const handleMouseDown = (e: any) => {
    if (e.button === 1) {
      e.preventDefault();
      p.setIsDragging(true);
      p.setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 0 && p.spaceDownRef.current) {
      e.preventDefault();
      p.setIsDragging(true);
      p.setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 0 && p.zDownRef.current && p.renderMode === 'schematic') {
      e.preventDefault();
      const world = p.screenToWorld(e.clientX, e.clientY);
      p.setZoomRectBox({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    if (p.currentTool === 'zoomRect' && e.button === 0 && p.renderMode === 'schematic') {
      e.preventDefault();
      const world = p.screenToWorld(e.clientX, e.clientY);
      p.setZoomRectBox({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    if (e.button !== 0) return;
    const world = p.screenToWorld(e.clientX, e.clientY);

    if (p.currentTool === 'ruler') {
      if (p.rulerPoints.length < 2) {
        p.setRulerPoints(prev => [...prev, { x: world.x, y: world.y }]);
      } else {
        p.setRulerPoints(() => []);
        p.setRulerMousePos(null);
      }
      return;
    }

    if (p.currentTool === 'select' && p.selectedIds.length > 0 && p.activeMode !== 'picotJoin' && p.activeMode !== 'beading') {
      const bbox = p.getBoundingBox(p.selectedIds);
      if (bbox) {
        const pivotX = bbox.centerX + p.pivotOffset.x;
        const pivotY = bbox.centerY + p.pivotOffset.y;
        const polarGridPivot = p.getPolarPivot(p.selectedIds);
        const effectivePivotX = polarGridPivot ? polarGridPivot.x : pivotX;
        const effectivePivotY = polarGridPivot ? polarGridPivot.y : pivotY;

        if (Math.hypot(pivotX - world.x, pivotY - world.y) < 16 / p.zoom) {
          p.setMovingPivot(true);
          p.setDragStart({ x: world.x, y: world.y });
          p.pivotDragStartRef.current = {
            x: world.x, y: world.y,
            offsetX: p.pivotOffsetRef.current.x,
            offsetY: p.pivotOffsetRef.current.y,
          };
          p.isInteractingRef.current = true;
          return;
        }

        const shouldShowRotationHandles = p.isShiftHeld || p.showRotationHandles;
        if (shouldShowRotationHandles) {
          const corners = [
            { x: bbox.x,              y: bbox.y,               name: 'tl' },
            { x: bbox.x + bbox.width, y: bbox.y,               name: 'tr' },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height, name: 'br' },
            { x: bbox.x,              y: bbox.y + bbox.height, name: 'bl' },
          ];
          for (const corner of corners) {
            if (Math.hypot(corner.x - world.x, corner.y - world.y) < 10 / p.zoom) {
              p.setRotationHandle(corner.name);
              p.setDragStart({ x: world.x, y: world.y, centerX: effectivePivotX, centerY: effectivePivotY });
              p.rotationDragStartRef.current = { x: world.x, y: world.y, pivotX: effectivePivotX, pivotY: effectivePivotY };
              p.isInteractingRef.current = true;
              return;
            }
          }
        }
      }
    }

    if (p.currentTool === 'path') {
      const isPathEditable = (el: any) => el.type === 'chain';
      if (p.selectedIds.length === 1) {
        const selected = p.elementById.get(p.selectedIds[0]);
        if (selected && isPathEditable(selected)) {
          const handle = p.getHandleAtPoint(selected, world.x, world.y);
          if (handle) {
            p.draggedHandleRef.current = handle;
            p.lastMousePosRef.current = { x: world.x, y: world.y };
            p.isInteractingRef.current = true;
            const path = selected.paths[0];
            if (path.type === 'cubic') {
              p.pathDragStartRef.current = { startX: world.x, startY: world.y, control1X: path.control1X, control1Y: path.control1Y, control2X: path.control2X, control2Y: path.control2Y };
            } else {
              p.pathDragStartRef.current = { startX: world.x, startY: world.y, controlX: path.controlX, controlY: path.controlY };
            }
            return;
          }
        }
      }
      const clicked = p.findClosestElement(world.x, world.y);
      if (clicked) {
        if (isPathEditable(clicked)) { p.setSelectedIds([clicked.id]); }
        else { p.setSelectedIds([clicked.id]); }
      }
    } else if (p.currentTool === 'line') {
      if (p.selectedIds.length === 1) {
        const selected = p.elementById.get(p.selectedIds[0]);
        if (selected && selected.type === 'line') {
          const handle = p.getHandleAtPoint(selected, world.x, world.y);
          if (handle) {
            p.draggedHandleRef.current = handle;
            p.lastMousePosRef.current = { x: world.x, y: world.y };
            p.isInteractingRef.current = true;
            const path = selected.paths[0];
            if (path.type === 'cubic') {
              p.pathDragStartRef.current = { startX: world.x, startY: world.y, control1X: path.control1X, control1Y: path.control1Y, control2X: path.control2X, control2Y: path.control2Y };
            }
            return;
          }
        }
      }
      const clicked = p.findClosestElement(world.x, world.y, (el: any) => el.type === 'line');
      if (clicked) {
        p.setSelectedIds([clicked.id]);
      } else {
        const newLine = {
          id: generateId(), type: 'line',
          center: { x: world.x, y: world.y }, isClosed: false,
          paths: [{ type: 'cubic', x: world.x, y: world.y, control1X: world.x, control1Y: world.y, control2X: world.x, control2Y: world.y, endX: world.x, endY: world.y }],
          color: '#FFFFFF', notation: 'line', lineWidth: 2,
        };
        p.setElements(prev => [...prev, newLine]);
        p.setSelectedIds([newLine.id]);
        p.createdNewLineRef.current = true;
        p.draggedHandleRef.current = { type: 'end', elementId: newLine.id };
        p.lastMousePosRef.current = { x: world.x, y: world.y };
        p.isInteractingRef.current = true;
      }
    } else if (p.currentTool === 'pan') {
      p.setIsDragging(true);
      p.setDragStart({ x: e.clientX, y: e.clientY });
    } else if (p.activeMode === 'tattingOrder') {
      const clicked = p.findClosestElement(world.x, world.y);
      p.setSelectedIds(clicked ? [clicked.id] : []);
      p.setTattingOrderInput(clicked?.orderNumber != null ? String(clicked.orderNumber) : '');
      p.setShowPropBarGroupDropdown(false);
      p.setPropBarOrderDraft(null);
      return;
    } else if (p.currentTool === 'select') {
      if (p.activeMode === 'picotJoin' || p.activeMode === 'beading') {
        p.setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
        return;
      }
      const clicked = p.findClosestElement(world.x, world.y);
      if (clicked) {
        const groupMembers = clicked.groupId
          ? p.elements.filter(el => el.groupId === clicked.groupId).map(el => el.id)
          : [clicked.id];
        if (e.ctrlKey || e.shiftKey) {
          p.setSelectedIds(prev => {
            const allSelected = groupMembers.every((id: string) => prev.includes(id));
            return allSelected ? prev.filter(id => !groupMembers.includes(id)) : [...new Set([...prev, ...groupMembers])];
          });
        } else {
          const clickHitsSelection = p.selectedIdSet.has(clicked.id) ||
            p.elements.some(el => p.selectedIdSet.has(el.id) && p.isPointInElement(el, world.x, world.y));
          if (!clickHitsSelection) p.setSelectedIds(groupMembers);
          p.setDraggedElement(clicked.id);
          p.lastMousePosRef.current = { x: world.x, y: world.y };
          p.dragOriginRef.current = { x: world.x, y: world.y };
          p.isInteractingRef.current = true;
        }
      } else {
        if (!e.ctrlKey && !e.shiftKey) p.setSelectedIds([]);
        p.setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
      }
    } else if (p.activeMode === 'picotJoin') {
      p.setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
    } else if (p.activeMode === 'beading') {
      let hitBE: any = null;
      p.elements.forEach(el => {
        (el.picots || []).forEach((pic: any) => {
          if (pic.beadType !== 'be') return;
          const pos = p.getPicotPosition(el, pic, true);
          if (!pos) return;
          if (Math.hypot(pos.x - world.x, pos.y - world.y) < 20 / p.zoom) hitBE = { elementId: el.id, picotId: pic.id };
        });
      });
      if (hitBE) {
        const hasModifier = e.shiftKey || e.ctrlKey || e.metaKey;
        if (hasModifier) {
          const alreadySel = p.selectedBEs.some((s: any) => s.elementId === hitBE.elementId && s.picotId === hitBE.picotId);
          p.setSelectedBEs(alreadySel ? p.selectedBEs.filter((s: any) => !(s.elementId === hitBE.elementId && s.picotId === hitBE.picotId)) : [...p.selectedBEs, hitBE]);
        } else {
          p.setSelectedBEs([hitBE]);
        }
      } else {
        p.setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
      }
    }
  };

  const handleMouseMoveInternal = (e: any) => {
    const world = p.screenToWorld(e.clientX, e.clientY);

    if (p.movingPivot && p.dragStart) {
      const dx = world.x - p.pivotDragStartRef.current.x;
      const dy = world.y - p.pivotDragStartRef.current.y;
      const bbox = p.getBoundingBox(p.selectedIds);
      const rawPivotX = p.pivotDragStartRef.current.offsetX + dx + (bbox ? bbox.centerX : 0);
      const rawPivotY = p.pivotDragStartRef.current.offsetY + dy + (bbox ? bbox.centerY : 0);
      let snapX = rawPivotX, snapY = rawPivotY;

      if (p.snapEnabled && bbox) {
        const effectiveRadius = p.snapRadius / p.zoom;
        let nearestDist = effectiveRadius;
        const d0 = Math.hypot(bbox.centerX - rawPivotX, bbox.centerY - rawPivotY);
        if (d0 < nearestDist) { nearestDist = d0; snapX = bbox.centerX; snapY = bbox.centerY; }
        for (const el of p.elements) {
          for (const pt of p.getSnapPoints(el)) {
            const d = Math.hypot(pt.x - rawPivotX, pt.y - rawPivotY);
            if (d < nearestDist) { nearestDist = d; snapX = pt.x; snapY = pt.y; }
          }
        }
        for (const grid of p.polarGrids) {
          if (!grid.visible) continue;
          const d = Math.hypot(grid.center.x - rawPivotX, grid.center.y - rawPivotY);
          if (d < nearestDist) { nearestDist = d; snapX = grid.center.x; snapY = grid.center.y; }
        }
      }
      p.setPivotOffset({ x: snapX - (bbox ? bbox.centerX : 0), y: snapY - (bbox ? bbox.centerY : 0) });
      return;
    }

    if (p.rotationHandle && p.dragStart) {
      const bbox = p.getBoundingBox(p.selectedIds);
      if (!bbox) return;
      const pivotX = p.rotationDragStartRef.current.pivotX;
      const pivotY = p.rotationDragStartRef.current.pivotY;
      const dragOriginX = p.rotationDragStartRef.current.x;
      const dragOriginY = p.rotationDragStartRef.current.y;
      const angle1 = Math.atan2(dragOriginY - pivotY, dragOriginX - pivotX);
      const angle2 = Math.atan2(world.y - pivotY, world.x - pivotX);
      const delta = (angle2 - angle1) * 180 / Math.PI;
      const rad = delta * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const oldCenterRelX = bbox.centerX - pivotX, oldCenterRelY = bbox.centerY - pivotY;
      const newBboxCenterX = pivotX + oldCenterRelX * cos - oldCenterRelY * sin;
      const newBboxCenterY = pivotY + oldCenterRelX * sin + oldCenterRelY * cos;

      p.setElements(prev => prev.map(el => {
        if (!p.selectedIdSet.has(el.id)) return el;
        const relX = el.center.x - pivotX, relY = el.center.y - pivotY;
        const newCenterX = pivotX + relX * cos - relY * sin;
        const newCenterY = pivotY + relX * sin + relY * cos;
        const newRotation = (el.rotation || 0) + delta;
        if (el.isSplitRing && el.splitPosition != null) {
          return { ...el, center: { x: newCenterX, y: newCenterY }, rotation: newRotation,
            paths: rotatePaths(createSplitRingPathFromEl(el, p.dsWidth, { cx: newCenterX, cy: newCenterY }).paths, newCenterX, newCenterY, newRotation) };
        }
        return { ...el, center: { x: newCenterX, y: newCenterY }, rotation: newRotation,
          paths: rotatePaths(el.paths, pivotX, pivotY, delta) };
      }));

      p.setPivotOffset({ x: pivotX - newBboxCenterX, y: pivotY - newBboxCenterY });
      p.rotationDragStartRef.current = { x: world.x, y: world.y, pivotX, pivotY };
      p.setDragStart({ x: world.x, y: world.y, centerX: pivotX, centerY: pivotY });
      return;
    }

    if (p.currentTool === 'line' && p.draggedHandleRef.current) {
      const handleInfo = p.draggedHandleRef.current;
      p.setElements(prev => prev.map(el => {
        if (el.id !== handleInfo.elementId || el.type !== 'line' || !el.paths?.length) return el;
        const path = el.paths[0];
        if (handleInfo.type === 'start') {
          let newX = world.x, newY = world.y;
          if (p.snapEnabled) { const sp = p.findNearestSnapPointWithPolar(world.x, world.y, handleInfo.elementId); if (sp) { newX = sp.x; newY = sp.y; } }
          return { ...el, paths: [{ ...path, x: newX, y: newY, control1X: newX + (path.endX - newX) * 0.33, control1Y: newY + (path.endY - newY) * 0.33 }], center: { x: (newX + path.endX) / 2, y: (newY + path.endY) / 2 } };
        } else if (handleInfo.type === 'end') {
          let newX = world.x, newY = world.y;
          if (p.snapEnabled) { const sp = p.findNearestSnapPointWithPolar(world.x, world.y, handleInfo.elementId); if (sp) { newX = sp.x; newY = sp.y; } }
          return { ...el, paths: [{ ...path, endX: newX, endY: newY, control2X: path.x + (newX - path.x) * 0.67, control2Y: path.y + (newY - path.y) * 0.67 }], center: { x: (path.x + newX) / 2, y: (path.y + newY) / 2 } };
        } else if (handleInfo.type === 'control1') {
          return { ...el, paths: [{ ...path, control1X: world.x, control1Y: world.y }] };
        } else if (handleInfo.type === 'control2') {
          return { ...el, paths: [{ ...path, control2X: world.x, control2Y: world.y }] };
        }
        return el;
      }));
    }

    if (p.currentTool === 'path' && p.draggedHandleRef.current) {
      const handleInfo = p.draggedHandleRef.current;
      p.setElements(prev => prev.map(el => {
        if (el.id !== handleInfo.elementId || el.type !== 'chain' || !el.paths?.length) return el;
        const path = el.paths[0];
        const targetLength = el.stitchCount * p.dsWidth;
        const tolerance = targetLength * 0.07;

        const smartEndpointDrag = (isStart: boolean) => {
          let newX = world.x, newY = world.y;
          if (p.snapEnabled) { const sp = p.findNearestSnapPointWithPolar(world.x, world.y, handleInfo.elementId); if (sp) { newX = sp.x; newY = sp.y; } }
          const fixedX = isStart ? path.endX : path.x;
          const fixedY = isStart ? path.endY : path.y;
          const ddx = newX - fixedX, ddy = newY - fixedY;
          const dist = Math.hypot(ddx, ddy);
          if (dist > targetLength) { const ang = Math.atan2(ddy, ddx); newX = fixedX + Math.cos(ang) * targetLength; newY = fixedY + Math.sin(ang) * targetLength; }

          if (path.type === 'cubic') {
            const startX = isStart ? newX : path.x, startY = isStart ? newY : path.y;
            const endX = isStart ? path.endX : newX, endY = isStart ? path.endY : newY;
            const dx = endX - startX, dy = endY - startY;
            const midX = (startX + endX) / 2, midY = (startY + endY) / 2;
            const perpX = -dy, perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            if (perpLen === 0) return isStart ? { ...el, paths: [{ ...path, x: newX, y: newY }] } : { ...el, paths: [{ ...path, endX: newX, endY: newY }] };
            const oMidX = (path.x + path.endX) / 2, oMidY = (path.y + path.endY) / 2;
            const o1x = path.control1X - oMidX, o1y = path.control1Y - oMidY;
            const o2x = path.control2X - oMidX, o2y = path.control2Y - oMidY;
            const avgDepth = ((o1x * perpX + o1y * perpY) + (o2x * perpX + o2y * perpY)) / (2 * perpLen);
            const side = Math.sign(avgDepth) || 1;
            let minD = 0, maxD = targetLength;
            let c1x = midX, c1y = midY, c2x = midX, c2y = midY;
            for (let i = 0; i < 15; i++) {
              const d = (minD + maxD) / 2;
              const pDx = (perpX / perpLen) * d * side, pDy = (perpY / perpLen) * d * side;
              const tc1x = startX + dx * 0.33 + pDx, tc1y = startY + dy * 0.33 + pDy;
              const tc2x = startX + dx * 0.67 + pDx, tc2y = startY + dy * 0.67 + pDy;
              const tryLen = calculatePathLength(sampleBezierPath({ type: 'cubic', x: startX, y: startY, endX, endY, control1X: tc1x, control1Y: tc1y, control2X: tc2x, control2Y: tc2y }, 20));
              if (Math.abs(tryLen - targetLength) < tolerance * 0.5) { c1x = tc1x; c1y = tc1y; c2x = tc2x; c2y = tc2y; break; }
              if (tryLen < targetLength) minD = d; else maxD = d;
              c1x = tc1x; c1y = tc1y; c2x = tc2x; c2y = tc2y;
            }
            const start = p.pathDragStartRef.current;
            if (start) {
              const dd = Math.hypot(newX - start.startX, newY - start.startY);
              const t = Math.min(1, dd / (p.dsWidth * 3));
              c1x = start.control1X * (1 - t) + c1x * t;
              c1y = start.control1Y * (1 - t) + c1y * t;
              c2x = start.control2X * (1 - t) + c2x * t;
              c2y = start.control2Y * (1 - t) + c2y * t;
            }
            const newPath = isStart
              ? { ...path, x: newX, y: newY, control1X: c1x, control1Y: c1y, control2X: c2x, control2Y: c2y }
              : { ...path, endX: newX, endY: newY, control1X: c1x, control1Y: c1y, control2X: c2x, control2Y: c2y };
            return { ...el, paths: [newPath] };
          } else {
            // Quadratic (legacy)
            const startX = isStart ? newX : path.x, startY = isStart ? newY : path.y;
            const endX = isStart ? path.endX : newX, endY = isStart ? path.endY : newY;
            const midX = (startX + endX) / 2, midY = (startY + endY) / 2;
            const dx = endX - startX, dy = endY - startY;
            const perpX = -dy, perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            if (perpLen === 0) return isStart ? { ...el, paths: [{ ...path, x: newX, y: newY }] } : { ...el, paths: [{ ...path, endX: newX, endY: newY }] };
            const oMidX = (path.x + path.endX) / 2, oMidY = (path.y + path.endY) / 2;
            const side = Math.sign((path.controlX - oMidX) * perpX + (path.controlY - oMidY) * perpY) || 1;
            let minD = 0, maxD = targetLength, bestCX = midX, bestCY = midY;
            for (let i = 0; i < 15; i++) {
              const d = (minD + maxD) / 2;
              const tCX = midX + (perpX / perpLen) * d * side, tCY = midY + (perpY / perpLen) * d * side;
              const tryLen = calculatePathLength(sampleBezierPath({ x: startX, y: startY, endX, endY, controlX: tCX, controlY: tCY }, 20));
              if (Math.abs(tryLen - targetLength) < tolerance * 0.5) { bestCX = tCX; bestCY = tCY; break; }
              if (tryLen < targetLength) minD = d; else maxD = d;
              bestCX = tCX; bestCY = tCY;
            }
            const start = p.pathDragStartRef.current;
            if (start) {
              const dd = Math.hypot(newX - start.startX, newY - start.startY);
              const t = Math.min(1, dd / (p.dsWidth * 3));
              bestCX = start.controlX * (1 - t) + bestCX * t;
              bestCY = start.controlY * (1 - t) + bestCY * t;
            }
            const newPath = isStart
              ? { ...path, x: newX, y: newY, controlX: bestCX, controlY: bestCY }
              : { ...path, endX: newX, endY: newY, controlX: bestCX, controlY: bestCY };
            return { ...el, paths: [newPath] };
          }
        };

        if (handleInfo.type === 'start') return smartEndpointDrag(true);
        if (handleInfo.type === 'end')  return smartEndpointDrag(false);

        if (handleInfo.type === 'control' || handleInfo.type === 'control1' || handleInfo.type === 'control2') {
          const newCX = world.x, newCY = world.y;
          if (path.type === 'cubic') {
            const isC1 = handleInfo.type === 'control1';
            const P0 = { x: path.x, y: path.y }, P3 = { x: path.endX, y: path.endY };
            const movingHandle = isC1 ? { x: newCX, y: newCY } : { x: newCX, y: newCY };
            const fixedHandle = isC1 ? { x: path.control2X, y: path.control2Y } : { x: path.control1X, y: path.control1Y };
            const movingAnchor = isC1 ? P0 : P3;
            const fixedAnchor = isC1 ? P3 : P0;
            const fixedHandleAngle = Math.atan2(fixedHandle.y - fixedAnchor.y, fixedHandle.x - fixedAnchor.x);

            if (p.chainPresetSymmetric) {
              const mhDx = movingHandle.x - movingAnchor.x, mhDy = movingHandle.y - movingAnchor.y;
              const mhAngle = Math.atan2(mhDy, mhDx), mhLen = Math.hypot(mhDx, mhDy);
              const chordAngle = Math.atan2(P3.y - P0.y, P3.x - P0.x);
              const mirroredAngle = 2 * chordAngle - mhAngle + Math.PI;
              let minH = 0, maxH = Math.min(mhLen, targetLength), bestH = mhLen;
              for (let i = 0; i < 20; i++) {
                const h = (minH + maxH) / 2;
                const tryLen = calculatePathLength(sampleBezierPath({ type: 'cubic', x: P0.x, y: P0.y, endX: P3.x, endY: P3.y,
                  control1X: P0.x + Math.cos(isC1 ? mhAngle : mirroredAngle) * h,
                  control1Y: P0.y + Math.sin(isC1 ? mhAngle : mirroredAngle) * h,
                  control2X: P3.x + Math.cos(isC1 ? mirroredAngle : mhAngle) * h,
                  control2Y: P3.y + Math.sin(isC1 ? mirroredAngle : mhAngle) * h,
                }, 20));
                if (Math.abs(tryLen - targetLength) < tolerance * 0.5) { bestH = h; break; }
                if (tryLen < targetLength) minH = h; else maxH = h;
                bestH = h;
              }
              return { ...el, paths: [{ ...path,
                control1X: P0.x + Math.cos(isC1 ? mhAngle : mirroredAngle) * bestH,
                control1Y: P0.y + Math.sin(isC1 ? mhAngle : mirroredAngle) * bestH,
                control2X: P3.x + Math.cos(isC1 ? mirroredAngle : mhAngle) * bestH,
                control2Y: P3.y + Math.sin(isC1 ? mirroredAngle : mhAngle) * bestH,
              }] };
            }

            const mhAngle = Math.atan2(movingHandle.y - movingAnchor.y, movingHandle.x - movingAnchor.x);
            const minPathWithMoving = calculatePathLength(sampleBezierPath({ type: 'cubic', x: P0.x, y: P0.y, endX: P3.x, endY: P3.y,
              control1X: isC1 ? newCX : fixedAnchor.x, control1Y: isC1 ? newCY : fixedAnchor.y,
              control2X: isC1 ? fixedAnchor.x : newCX, control2Y: isC1 ? fixedAnchor.y : newCY,
            }, 20));
            let clampedMoving = { x: newCX, y: newCY };
            if (minPathWithMoving > targetLength) {
              let minH = 0, maxH = Math.hypot(newCX - movingAnchor.x, newCY - movingAnchor.y);
              for (let i = 0; i < 20; i++) {
                const h = (minH + maxH) / 2;
                const tryLen = calculatePathLength(sampleBezierPath({ type: 'cubic', x: P0.x, y: P0.y, endX: P3.x, endY: P3.y,
                  control1X: isC1 ? movingAnchor.x + Math.cos(mhAngle) * h : fixedAnchor.x,
                  control1Y: isC1 ? movingAnchor.y + Math.sin(mhAngle) * h : fixedAnchor.y,
                  control2X: isC1 ? fixedAnchor.x : movingAnchor.x + Math.cos(mhAngle) * h,
                  control2Y: isC1 ? fixedAnchor.y : movingAnchor.y + Math.sin(mhAngle) * h,
                }, 20));
                if (tryLen > targetLength) maxH = h; else minH = h;
              }
              clampedMoving = { x: movingAnchor.x + Math.cos(mhAngle) * minH, y: movingAnchor.y + Math.sin(mhAngle) * minH };
            }
            let minLen = 0, maxLen = targetLength;
            let bestFixed = fixedHandle, bestDiff = Infinity;
            for (let i = 0; i < 20; i++) {
              const h = (minLen + maxLen) / 2;
              const tryFixed = { x: fixedAnchor.x + Math.cos(fixedHandleAngle) * h, y: fixedAnchor.y + Math.sin(fixedHandleAngle) * h };
              const tryLen = calculatePathLength(sampleBezierPath({ type: 'cubic', x: P0.x, y: P0.y, endX: P3.x, endY: P3.y,
                control1X: isC1 ? clampedMoving.x : tryFixed.x, control1Y: isC1 ? clampedMoving.y : tryFixed.y,
                control2X: isC1 ? tryFixed.x : clampedMoving.x, control2Y: isC1 ? tryFixed.y : clampedMoving.y,
              }, 20));
              const diff = Math.abs(tryLen - targetLength);
              if (diff < bestDiff) { bestDiff = diff; bestFixed = tryFixed; }
              if (diff < tolerance * 0.5) break;
              if (tryLen < targetLength) minLen = h; else maxLen = h;
            }
            return { ...el, paths: [{ ...path,
              control1X: isC1 ? clampedMoving.x : bestFixed.x,
              control1Y: isC1 ? clampedMoving.y : bestFixed.y,
              control2X: isC1 ? bestFixed.x : clampedMoving.x,
              control2Y: isC1 ? bestFixed.y : clampedMoving.y,
            }] };
          } else if (path.type === 'quadratic') {
            const dx = newCX - path.x, dy = newCY - path.y;
            const perpX = -dy, perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            if (perpLen < 1) return { ...el, paths: [{ ...path, controlX: newCX, controlY: newCY }] };
            const pDx = perpX / perpLen, pDy = perpY / perpLen;
            const side = Math.sign((path.endX - path.x) * pDx + (path.endY - path.y) * pDy) || 1;
            let minD = 0, maxD = targetLength * 2, bestEX = path.endX, bestEY = path.endY, bestDiff = Infinity;
            for (let i = 0; i < 20; i++) {
              const d = (minD + maxD) / 2;
              const tEX = path.x + pDx * d * side, tEY = path.y + pDy * d * side;
              const tryLen = calculatePathLength(sampleBezierPath({ x: path.x, y: path.y, endX: tEX, endY: tEY, controlX: newCX, controlY: newCY }, 20));
              const diff = Math.abs(tryLen - targetLength);
              if (diff < bestDiff) { bestDiff = diff; bestEX = tEX; bestEY = tEY; }
              if (diff < tolerance * 0.5) break;
              if (tryLen < targetLength) minD = d; else maxD = d;
            }
            return { ...el, paths: [{ ...path, controlX: newCX, controlY: newCY, endX: bestEX, endY: bestEY }] };
          }
        }
        return el;
      }));
      p.lastMousePosRef.current = { x: world.x, y: world.y };
      return;
    }

    if (p.isDragging && p.dragStart) {
      const deltaX = e.clientX - p.dragStart.x;
      const deltaY = e.clientY - p.dragStart.y;
      p.setCamera(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      p.setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (p.currentTool === 'select') {
      if (p.draggedElement && p.lastMousePosRef.current) {
        let deltaX = world.x - p.lastMousePosRef.current.x;
        let deltaY = world.y - p.lastMousePosRef.current.y;
        if (p.orthoLock || p.isShiftHeld) {
          const origin = p.dragOriginRef.current;
          if (origin) {
            const totalDX = world.x - origin.x, totalDY = world.y - origin.y;
            if (Math.abs(totalDX) >= Math.abs(totalDY)) deltaY = 0; else deltaX = 0;
          }
        }
        p.dragOffsetRef.current.dx += deltaX;
        p.dragOffsetRef.current.dy += deltaY;
        p.dragOffsetRef.current.active = true;
        p.lastMousePosRef.current = { x: world.x, y: world.y };
        p.setDragTick(t => t + 1);
      } else if (p.selectionBox) {
        p.setSelectionBox({ ...p.selectionBox, width: world.x - p.selectionBox.x, height: world.y - p.selectionBox.y });
      }
    } else if (p.activeMode === 'picotJoin' || p.activeMode === 'beading' || p.activeMode === 'tattingOrder') {
      if (p.selectionBox) {
        p.setSelectionBox({ ...p.selectionBox, width: world.x - p.selectionBox.x, height: world.y - p.selectionBox.y });
      }
    }

    if (p.currentTool === 'ruler' && p.rulerPoints.length === 1) {
      p.setRulerMousePos({ x: world.x, y: world.y });
    }

    if (p.zoomRectBox) {
      p.setZoomRectBox((prev: any) => prev ? { ...prev, width: world.x - prev.x, height: world.y - prev.y } : null);
    }
  };

  // Update ref so RAF always calls the fresh version with current state
  p.handleMouseMoveInternalRef.current = handleMouseMoveInternal;

  const handleMouseMove = (e: any) => {
    p.pendingMouseEventRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (!p.rafIdRef.current) {
      p.rafIdRef.current = requestAnimationFrame(() => {
        p.rafIdRef.current = null;
        const ev = p.pendingMouseEventRef.current;
        if (ev) p.handleMouseMoveInternalRef.current?.(ev);
      });
    }
  };

  const handleMouseUp = (e: any) => {
    if (p.zoomRectBox) {
      const minX = Math.min(p.zoomRectBox.x, p.zoomRectBox.x + p.zoomRectBox.width);
      const maxX = Math.max(p.zoomRectBox.x, p.zoomRectBox.x + p.zoomRectBox.width);
      const minY = Math.min(p.zoomRectBox.y, p.zoomRectBox.y + p.zoomRectBox.height);
      const maxY = Math.max(p.zoomRectBox.y, p.zoomRectBox.y + p.zoomRectBox.height);
      p.zoomToRect(minX, minY, maxX, maxY);
      p.setZoomRectBox(null);
      return;
    }

    if (p.selectionBox) {
      const minX = Math.min(p.selectionBox.x, p.selectionBox.x + p.selectionBox.width);
      const maxX = Math.max(p.selectionBox.x, p.selectionBox.x + p.selectionBox.width);
      const minY = Math.min(p.selectionBox.y, p.selectionBox.y + p.selectionBox.height);
      const maxY = Math.max(p.selectionBox.y, p.selectionBox.y + p.selectionBox.height);

      if (p.activeMode === 'beading') {
        const boxBEs: any[] = [];
        p.elements.forEach(el => {
          (el.picots || []).forEach((pic: any) => {
            if (pic.beadType !== 'be') return;
            const pos = p.getPicotPosition(el, pic, true);
            if (!pos) return;
            if (pos.x >= minX-5 && pos.x <= maxX+5 && pos.y >= minY-5 && pos.y <= maxY+5) boxBEs.push({ elementId: el.id, picotId: pic.id });
          });
        });
        const isClick = Math.abs(p.selectionBox.width) < 15 && Math.abs(p.selectionBox.height) < 15;
        const hasMod = e?.shiftKey || e?.ctrlKey || e?.metaKey;
        if (!isClick) {
          if (hasMod) { p.setSelectedBEs(prev => { const m=[...prev]; boxBEs.forEach(nb => { if (!m.some((s:any) => s.elementId===nb.elementId && s.picotId===nb.picotId)) m.push(nb); }); return m; }); }
          else { p.setSelectedBEs(boxBEs); }
        } else if (!hasMod && boxBEs.length === 0) { p.setSelectedBEs([]); }

      } else if (p.activeMode === 'picotJoin') {
        const selPicots: any[] = [];
        p.elements.forEach(el => {
          if (el.type === 'ghost' && !el.isBoundary) return;
          // Regular picots
          if (el.picots) {
            el.picots.forEach((picot: any) => {
              if (picot.isGuidePoint) return;
              if (picot.beadType && !picot.isJoint && !(picot.beadType === 'be' && picot.beIsJoint)) return;
              const pos = p.getPicotPosition(el, picot);
              if (!pos) return;
              if (pos.x >= minX-5 && pos.x <= maxX+5 && pos.y >= minY-5 && pos.y <= maxY+5) selPicots.push({ elementId: el.id, picotId: picot.id });
            });
          }
          // Endpoint pseudo-picots
          p.getEndpointPseudoPicots(el).forEach(ep => {
            if (ep.x >= minX-5 && ep.x <= maxX+5 && ep.y >= minY-5 && ep.y <= maxY+5)
              selPicots.push({ elementId: el.id, picotId: ep.id });
          });
        });
        const isClick = Math.abs(p.selectionBox.width) < 15 && Math.abs(p.selectionBox.height) < 15;
        const hasMod = e?.shiftKey || e?.ctrlKey || e?.metaKey;
        if (isClick && selPicots.length > 0 && hasMod) {
          const cp = selPicots[0];
          const already = p.selectedPicots.some((sp:any) => sp.elementId===cp.elementId && sp.picotId===cp.picotId);
          p.setSelectedPicots(already ? p.selectedPicots.filter((sp:any) => !(sp.elementId===cp.elementId && sp.picotId===cp.picotId)) : [...p.selectedPicots, cp]);
        } else if (!isClick && hasMod) {
          p.setSelectedPicots([...p.selectedPicots, ...selPicots.filter(sp => !p.selectedPicots.some((ex:any) => ex.elementId===sp.elementId && ex.picotId===sp.picotId))]);
        } else { p.setSelectedPicots(selPicots); }

      } else {
        const boxHit = p.elements.filter(el => el.type !== 'ghost' && el.center.x >= minX && el.center.x <= maxX && el.center.y >= minY && el.center.y <= maxY);
        const boxHitIds = new Set(boxHit.map((el:any) => el.id));
        const filteredIds = new Set<string>();
        boxHit.forEach((el:any) => {
          if (el.groupId) { const all = p.elements.filter(e => e.groupId === el.groupId); if (all.every(e => boxHitIds.has(e.id))) all.forEach(e => filteredIds.add(e.id)); }
          else { filteredIds.add(el.id); }
        });
        const boxSelected = [...filteredIds];
        if (p.activeMode === 'tattingOrder') {
          const single = boxSelected.length > 0 ? [boxSelected[0]] : [];
          p.setSelectedIds(single);
          const el = p.elementById.get(single[0]);
          p.setTattingOrderInput(el?.orderNumber != null ? String(el.orderNumber) : '');
        } else {
          p.setSelectedIds(prev => [...new Set([...prev, ...boxSelected])]);
        }
      }
      p.setSelectionBox(null);
    }

    if (p.isInteractingRef.current && p.needsHistoryPushRef.current)
      p.pushHistoryState(p.elements, p.picotConnections, p.orderGroups);
    p.isInteractingRef.current = false;
    p.needsHistoryPushRef.current = false;
    p.setIsDragging(false);
    p.setDragStart(null);

    if (p.dragOffsetRef.current.active) {
      let { dx, dy } = p.dragOffsetRef.current;
      if (p.snapEnabled && p.selectedIds.length === 1) {
        const draggedEl = p.elements.find((el:any) => el.id === p.selectedIds[0]);
        if (draggedEl) {
          const movedEl = { ...draggedEl, center: { x: draggedEl.center.x+dx, y: draggedEl.center.y+dy },
            paths: draggedEl.paths.map((path:any) => path.type==='cubic'
              ? {...path, x:path.x+dx, y:path.y+dy, endX:path.endX+dx, endY:path.endY+dy, control1X:path.control1X+dx, control1Y:path.control1Y+dy, control2X:path.control2X+dx, control2Y:path.control2Y+dy}
              : {...path, x:path.x+dx, y:path.y+dy, endX:path.endX+dx, endY:path.endY+dy, controlX:path.controlX+dx, controlY:path.controlY+dy}) };
          const mySnapPoints = p.getSnapPoints(movedEl);
          const excluded = new Set(p.selectedIds);
          const effR = p.snapRadius / p.zoom;
          let bDx=0, bDy=0, bDist=effR;
          for (const pt of mySnapPoints) {
            const t = p.findNearestSnapPointWithPolar(pt.x, pt.y, excluded);
            if (t) { const d=Math.hypot(t.x-pt.x, t.y-pt.y); if (d<bDist) { bDist=d; bDx=t.x-pt.x; bDy=t.y-pt.y; } }
          }
          dx+=bDx; dy+=bDy;
        }
      }
      p.setElements(prev => prev.map((el:any) => {
        if (!p.selectedIds.includes(el.id)) return el;
        const np = el.paths.map((path:any) => path.type==='cubic'
          ? {...path, x:path.x+dx, y:path.y+dy, endX:path.endX+dx, endY:path.endY+dy, control1X:path.control1X+dx, control1Y:path.control1Y+dy, control2X:path.control2X+dx, control2Y:path.control2Y+dy}
          : {...path, x:path.x+dx, y:path.y+dy, endX:path.endX+dx, endY:path.endY+dy, controlX:path.controlX+dx, controlY:path.controlY+dy});
        return { ...el, center: { x: el.center.x+dx, y: el.center.y+dy }, paths: np };
      }));
      p.dragOffsetRef.current = { active: false, dx: 0, dy: 0 };
    }

    p.lastMousePosRef.current = null;
    p.dragTouchIdRef.current = null;
    p.setDraggedElement(null);
    p.draggedHandleRef.current = null;
    p.pathDragStartRef.current = null;
    const wasRotating = p.rotationHandle !== null;
    p.setRotationHandle(null);
    p.setMovingPivot(false);

    if (wasRotating && p.selectedIds.length > 0) {
      const ids = [...p.selectedIds];
      setTimeout(() => { ids.forEach(id => p.updateGhostArraysForMother(id)); }, 100);
    }

    p.setElements(prev => prev.filter((el:any) => {
      if (el.type !== 'line' || !el.paths?.length) return true;
      const path = el.paths[0];
      return Math.hypot((path.endX ?? path.x) - path.x, (path.endY ?? path.y) - path.y) >= 12;
    }));

    if (p.createdNewLineRef.current) { p.setCurrentTool('select'); p.createdNewLineRef.current = false; }
  };

  return { handleMouseDown, handleMouseMove, handleMouseUp };
}
