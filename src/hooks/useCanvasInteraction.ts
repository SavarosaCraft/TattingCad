// useCanvasInteraction.ts — Canvas interaction state
// Covers drag, selection box, rotation handles, pivot, zoom rect, touch, key modifiers.

import { useState } from 'react';
import { getInitialToolbarMode } from './useViewState';

export function useCanvasInteraction() {
  // ── Tool and mode ──────────────────────────────────────────────────────
  // Simple toolbar starts on Select (a newcomer's first click on a ring must
  // select it); the full toolbar keeps the long-standing Pan start.
  const [currentTool, setCurrentTool] = useState(() => getInitialToolbarMode() === 'simple' ? 'select' : 'pan');
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [orthoLock, setOrthoLock] = useState(false);

  // ── Drag ───────────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<any>(null);
  const [draggedElement, setDraggedElement] = useState<any>(null);
  const [dragTick, setDragTick] = useState(0);

  // ── Selection ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [selectionBox, setSelectionBox] = useState<any>(null);

  // ── Rotation handles and pivot ─────────────────────────────────────────
  const [rotationHandle, setRotationHandle] = useState<string | null>(null);
  const [pivotOffset, setPivotOffset] = useState({ x: 0, y: 0 });
  const [movingPivot, setMovingPivot] = useState(false);

  // ── Zoom rect ──────────────────────────────────────────────────────────
  const [zoomRectBox, setZoomRectBox] = useState<any>(null);

  // ── Touch / pinch ──────────────────────────────────────────────────────
  // Two-finger gesture (pinch zoom + two-finger pan, session 58): finger
  // distance and zoom at the start, plus the world point that was under the
  // fingers' midpoint (worldX/worldY) — it stays under the midpoint.
  const [touchState, setTouchState] = useState({ dist: 0, zoom: 1, centerX: 0, centerY: 0, worldX: 0, worldY: 0 });

  // ── Key modifiers ──────────────────────────────────────────────────────
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [zDown, setZDown] = useState(false);

  // ── Ruler tool ─────────────────────────────────────────────────────────
  const [rulerPoints, setRulerPoints] = useState<{ x: number; y: number }[]>([]);
  const [rulerMousePos, setRulerMousePos] = useState<{ x: number; y: number } | null>(null);

  // ── Rotation input ─────────────────────────────────────────────────────
  const [groupRotationInput, setGroupRotationInput] = useState('');

  return {
    currentTool, setCurrentTool,
    activeMode, setActiveMode,
    orthoLock, setOrthoLock,
    isDragging, setIsDragging,
    dragStart, setDragStart,
    draggedElement, setDraggedElement,
    dragTick, setDragTick,
    selectedIds, setSelectedIds,
    selectionBox, setSelectionBox,
    rotationHandle, setRotationHandle,
    pivotOffset, setPivotOffset,
    movingPivot, setMovingPivot,
    zoomRectBox, setZoomRectBox,
    touchState, setTouchState,
    isShiftHeld, setIsShiftHeld,
    spaceDown, setSpaceDown,
    zDown, setZDown,
    rulerPoints, setRulerPoints,
    rulerMousePos, setRulerMousePos,
    groupRotationInput, setGroupRotationInput,
  };
}
