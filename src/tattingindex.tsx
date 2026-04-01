// TattingCAD — tattingindex.tsx
// Main application component. See docs/architecture.md for module structure.

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import {
  showSaveDialog,
  showOpenDialog,
  showSaveSvgDialog,
  writeProjectFile,
  writeTextToFile,
  readProjectFile,
  addToRecents,
  getRecents,
  generateThumbnail,
} from './tauri/file';
import { generateId } from './utils/id';
import {
  sampleBezierPath,
  calculatePathLength,
  getPointAndAngleAtDistanceFast,
  getPointAndAngleAtDistance,
  interpolateColor,
} from './geometry/bezier';
import { getBoundingBox as getBoundingBoxPure } from './geometry/layout';
import enStrings from './i18n/translations_en.json';
import { useUIState } from './hooks/useUIState';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useTattingOrder } from './hooks/useTattingOrder';
import { useProjectState } from './hooks/useProjectState';
import { useBeadState, DEFAULT_BEAD_LIBRARY } from './hooks/useBeadState';
import {
  IconMove, IconMenu, IconClose, IconChevronDown, IconImage,
  IconRefImageOn, IconRefImageOff, IconOrtho, IconOrthoOn,
  IconJoinPicots, IconPan, IconSelect, IconPathEdit,
  IconAddRing, IconAddSplitRing, IconAddChain, IconAddLine,
  IconGridOn, IconGridOff, IconSnapOn, IconSnapOff,
  IconEyeOn, IconEyeOff, IconRenderSchematic, IconRenderRealistic,
  IconUnnumberedOn, IconUnnumberedOff, IconInvalidOn, IconInvalidOff,
  IconShapeCircle, IconShapeTeardrop,
  IconUndo, IconRedo, IconCopy, IconPaste, IconDelete,
  IconGroup, IconUngroup, IconFlipH, IconFlipV,
  IconRotateCW, IconRotateCCW, IconRotateMode,
  IconAlignLeft, IconAlignCenter, IconAlignRight,
  IconAlignTop, IconAlignMiddle, IconAlignBottom,
  IconSave, IconLoad, IconExport, IconNew, IconDownload,
  IconZoomIn, IconZoomOut, IconFitView, IconZoomRect,
  IconLink, IconUnlink, IconSettings, IconHelp,
  IconBeadMode, IconBeadCore, IconBeadCorePicot, IconBeadCoreBeaded,
  IconBeadSpike, IconBeadSuspended,
  IconLanguage,
  IconNotationS, IconNotationM, IconNotationH,
  IconNotes, IconPolarGrid, IconCut,
  IconNotationOn, IconNotationOff, IconRuler,
} from './components/icons';
import {
  parseNotation as parseNotationPure,
  reverseNotation,
  buildSegmentLabel,
  getSegmentRuns,
  countActualStitches,
  countStitchesInRange,
  getStitchTypes as getStitchTypesPure,
  isNotationValid,
  expandTokens,
  isZeroWidth,
} from './domain/parser';
const logoUrl = '/logo.png';

// Icons imported from ./components/icons

// Icons inlined — see below React import

// ============================================================================
// TRANSLATIONS — add new languages by duplicating the 'en' block.
// Notation terms (ds, p, jp …) are universal and are NOT translated.
// ============================================================================
// Fallback language list used before translations.json is loaded (or if fetch fails).
// The canonical list lives in translations.json under "_languages".
const LANGUAGES_FALLBACK: Record<string, string> = {
  en: 'English',
};

// Colors cycled through for order group badges (canvas + SVG export).
// Each entry is [fillColor, strokeColor] — dark stroke so badges stay readable on any bg.
const ORDER_GROUP_COLORS: [string, string][] = [
  ['#FFD700', '#000000'], // gold        (ungrouped — legacy)
  ['#38BDF8', '#003366'], // sky blue    (Round 1)
  ['#F472B6', '#5C0030'], // pink        (Round 2)
  ['#4ADE80', '#004420'], // green       (Round 3)
  ['#FB923C', '#5C1A00'], // orange      (Round 4)
  ['#A78BFA', '#2D0060'], // violet      (Round 5)
  ['#F87171', '#5C0000'], // red         (Round 6)
  ['#34D399', '#003322'], // teal        (Round 7)
  ['#FACC15', '#4D3000'], // amber       (Round 8)
  ['#818CF8', '#1E1B5C'], // indigo      (Round 9)
  ['#F9A8D4', '#5C002B'], // rose        (Round 10)
  ['#2DD4BF', '#003D36'], // cyan-teal   (Round 11)
  ['#C084FC', '#3B0764'], // purple      (Round 12)
  ['#86EFAC', '#003D1A'], // mint        (Round 13)
  ['#FCA5A5', '#5C0000'], // salmon      (Round 14)
  ['#67E8F9', '#003344'], // light cyan  (Round 15)
  ['#FCD34D', '#4D3000'], // yellow      (Round 16)
];

const TRANSLATIONS: Record<string, Record<string, string>> = {
  // English strings are now loaded from ./i18n/translations_en.json
  // That file is bundled and cannot be deleted by users.
  // The t() function falls back to this empty object; the loader fills it at startup.
};



const GRID_SIZE = 25;
const COLORS = [
  // Row 1 — dark shades
  '#000000', // Black
  '#999999', // Gray
  '#8B0000', // Dark Red
  '#228B22', // Dark Green
  '#ADD8E6', // Lt Blue
  '#FFAA33', // Orange
  '#702963', // Dark Violet
  // Row 2 — saturated / light
  '#FFFFFF', // White
  '#FFFCF4', // Cream
  '#D1001C', // Red
  '#93C572', // Pistachio
  '#0F52BA', // Royal Blue
  '#FFD700', // Topaz
  '#CF9FFF', // Violet
];
const BG_COLORS = ['#111827', '#4B5563', '#FFFFFF'];

// ============================================================================
// COLOR CATEGORIZATION - Pure function for performance
// ============================================================================
const categorizeColor = (color) => {
  // If the color has a group field (from JSON), use it directly for solid colors
  if (color.group && color.type !== 'gradient') return color.group;

  // For gradients, extract first color from stops
  let hex = color.hex;
  if (color.type === 'gradient' && !hex) {
    if (typeof color.stops === 'string') {
      const firstStop = color.stops.split(',')[0];
      hex = firstStop.split(':')[1];
    } else if (Array.isArray(color.stops) && color.stops.length > 0) {
      hex = color.stops[0].color;
    } else {
      return 'all'; // Fallback for malformed gradients
    }
  }
  
  if (!hex) return 'all';
  
  hex = hex.toLowerCase();
  const name = color.name.toLowerCase();
  
  // Convert hex to RGB for better categorization
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Neutrals: grays, whites, blacks, browns
  const isNeutral = (
    (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30) || // Grayscale
    name.includes('white') || name.includes('black') || name.includes('gray') || 
    name.includes('grey') || name.includes('tan') || name.includes('brown') ||
    name.includes('beige') || name.includes('ecru') || name.includes('driftwood')
  );
  
  if (isNeutral) return 'neutrals';
  
  // Find dominant color
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  // Check name keywords first
  if (name.includes('red') || name.includes('pink') || name.includes('coral') || 
      name.includes('rose') || name.includes('salmon')) return 'reds';
  if (name.includes('blue') || name.includes('aqua') || name.includes('navy')) return 'blues';
  if (name.includes('green') || name.includes('lime') || name.includes('emerald')) return 'greens';
  if (name.includes('yellow') || name.includes('gold') || name.includes('lemon')) return 'yellows';
  if (name.includes('purple') || name.includes('violet') || name.includes('lavender') || 
      name.includes('plum') || name.includes('mauve')) return 'purples';
  
  // RGB-based categorization
  if (r > g && r > b) {
    if (b > g * 0.7) return 'purples'; // Red + Blue = Purple
    return 'reds';
  }
  if (g > r && g > b) {
    if (r > b * 1.2) return 'yellows'; // Green + Red = Yellow
    return 'greens';
  }
  if (b > r && b > g) {
    if (r > g * 0.7) return 'purples'; // Blue + Red = Purple
    return 'blues';
  }
  
  return 'neutrals';
};

// ============================================================================
// REALISTIC RENDERING: DS STITCH SVG PATH
// ============================================================================
// Single DS (Double Stitch) path - HALF of the original (which had 2 DS)
// Centered at origin, facing right, ~0.4 units wide
const DS_STITCH_PATH = "M -0.211,0.05 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.0504 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.2103 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.0504 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m -0.0016,0.1628 c -0.0276,0 -0.0496,0.0223 -0.0496,0.0499 v 0.2103 c 0,0.0276 0.022,0.0499 0.0496,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m 0.163,0 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.2103 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0504 c 0.0276,0 0.0496,-0.0223 0.0496,-0.0499 v -0.2103 c 0,-0.0276 -0.022,-0.0499 -0.0496,-0.0499 z";

// Single Stitch (SS) - half width of DS
const SS_STITCH_PATH = "M -0.0524,0.05 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.0504 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0488 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.0504 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m -0.0016,0.1628 c -0.0276,0 -0.0496,0.0223 -0.0496,0.0499 v 0.2103 c 0,0.0276 0.022,0.0499 0.0496,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z";

// Reinforced Double Stitch (RDS) - double width of DS
const RDS_STITCH_PATH = "M -0.5434,0.05 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.0504 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.5733 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.0504 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m -0.0016,0.1628 c -0.0276,0 -0.0496,0.0223 -0.0496,0.0499 v 0.2103 c 0,0.0276 0.022,0.0499 0.0496,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m 0.1748,0 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.2103 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m 0.1748,0 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.2103 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m 0.1748,0 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.2103 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z";

// Joint Picot (JP) - broken arc shape
const JP_PICOT_PATH = "m -0.0262,0 c -0.0519,0.0308 -0.0954,0.0729 -0.12747,0.11974 -0.0664,0.0969 -0.10206,0.21191 -0.12713,0.32246 -0.0477,0.15131 -0.0424,0.27131 -0.0424,0.27131 l 0.25011,0.002 c 0,0 0.0117,-0.0829 0.0362,-0.21859 0.0211,-0.0931 0.0535,-0.18089 0.0899,-0.23409 0,0 -0.0588,-0.27494 -0.0792,-0.26283 z m 0.29421,0.26289 c 0.0365,0.0532 0.0714,0.14041 0.0899,0.23409 0.0208,0.10524 0.0532,0.21859 0.0532,0.21859 l 0.2496,-0.002 c 0,0 -0.0307,-0.11839 -0.0589,-0.27131 -0.0251,-0.11055 -0.0603,-0.22559 -0.12661,-0.32246 -0.0273,-0.0399 -0.0633,-0.0765 -0.10586,-0.1055 -0.0286,-0.0195 -0.10133,0.24859 -0.10133,0.24859 z";

// ============================================================================
// WEDGE SHAPES - Bounding rectangles for each stitch type in normalized coords
// Derived by tracing the SVG sub-paths of DS/SS/RDS stitch symbols.
// Format: [x_left, x_right, y_outer, y_inner]
//   x: tangent direction (positive = forward along path)
//   y: perpendicular direction (positive = INWARD toward ring center)
//   Origin = stitch center point, already offset outward from ring by offsetAmount
//   Scale factor: 0.4 normalized units = 1 DS width
// ============================================================================
const WEDGE_SHAPES = {
  'ds': [
    [-0.2609,  0.0492,  0.0500, 0.2002],  // horizontal bar
    [-0.2622, -0.1123,  0.2128, 0.5229],  // left post
    [-0.0995,  0.0504,  0.2128, 0.5229],  // right post
  ],
  'ss': [
    [-0.1023,  0.0463,  0.0500, 0.2002],  // bar (half width of DS)
    [-0.1023,  0.0463,  0.2128, 0.5229],  // post (same width as bar)
  ],
  'lss': [
    [-0.1023,  0.0463,  0.0500, 0.2002],
    [-0.1023,  0.0463,  0.2128, 0.5229],
  ],
  'rss': [
    [-0.1023,  0.0463,  0.0500, 0.2002],
    [-0.1023,  0.0463,  0.2128, 0.5229],
  ],
  'rds': [
    [-0.5933,  0.0798,  0.0500, 0.2002],  // wide bar
    [-0.5946, -0.4447,  0.2128, 0.5229],  // post 1
    [-0.4198, -0.2699,  0.2128, 0.5229],  // post 2
    [-0.2450, -0.0951,  0.2128, 0.5229],  // post 3
    [-0.0705,  0.0794,  0.2128, 0.5229],  // post 4
  ],
};


const DEFAULT_THREAD_PRESET = {
  id: 'default',
  name: 'Pearl Cotton Size 10, Needle Tat',
  ds20Working: 285,   // mm — working thread per 20 DS
  ds20Core: 35,       // mm — core thread per 20 DS
  picotRegular: 8,    // mm
  picotJoined: 5,     // mm
  // Alternative inputs (null = not used)
  sample20DS10Regular: null,  // mm — 20DS + 10 regular picots total
  sample20DS10Short: null,    // mm — 20DS + 10 short picots total
};

// Open an external URL in the system browser.
const openExternal = (url: string) => {
  console.log('[openExternal] called with:', url);
  console.log('[openExternal] __TAURI__ present:', !!(window as any).__TAURI__);
  console.log('[openExternal] __TAURI_INTERNALS__ present:', !!(window as any).__TAURI_INTERNALS__);
  invoke('plugin:opener|open_url', { url })
    .then(() => console.log('[openExternal] invoke succeeded'))
    .catch((err) => {
      console.error('[openExternal] invoke failed:', err);
      console.log('[openExternal] falling back to window.open');
      window.open(url, '_blank', 'noopener,noreferrer');
    });
};

const DEFAULT_MATERIALS = [
  { id: 'default', name: 'Default', color: '#FFFFFF', isGradient: false },
];

const ThreadPropertiesNumInput = ({ label, value, onChange = null, unit = 'mm', readOnly = false, hint = null }) => {
  const [localVal, setLocalVal] = React.useState(value?.toString() ?? '');
  React.useEffect(() => { setLocalVal(value?.toString() ?? ''); }, [value]);
  const commit = () => {
    if (!onChange || readOnly) return;
    const parsed = parseFloat(localVal);
    if (!isNaN(parsed)) onChange(parsed);
    else setLocalVal(value?.toString() ?? '');
  };
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-gray-300 text-xs">{label}</label>
        {hint && <span className="text-gray-500 text-xs italic">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="decimal"
          value={localVal}
          readOnly={readOnly}
          onChange={e => { if (!readOnly) setLocalVal(e.target.value); }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }}
          className={`w-20 px-2 py-1 rounded text-sm text-white border text-right ${readOnly ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-600 border-gray-500'}`}
        />
        <span className="text-gray-400 text-xs">{unit}</span>
      </div>
    </div>
  );
};

const TattingDesigner = () => {
  // ── UI state (dialogs, menus, toggles) ──────────────────────────────────
  const {
    showFileMenu, setShowFileMenu,
    showHelpMenu, setShowHelpMenu,
    showArrangeMenu, setShowArrangeMenu,
    showOptionsMenu, setShowOptionsMenu,
    showViewMenu, setShowViewMenu,
    showHelp, setShowHelp,
    showAbout, setShowAbout,
    showUiGuide, setShowUiGuide,
    showSplash, setShowSplash,
    showUpdatePopup, setShowUpdatePopup,
    showUpdateReminder, setShowUpdateReminder,
    showNewCanvasDialog, setShowNewCanvasDialog,
    showRecentProjectsDialog, setShowRecentProjectsDialog,
    showRecentLoadConfirm, setShowRecentLoadConfirm,
    showLoadConfirmDialog, setShowLoadConfirmDialog,
    showRemoveConfirm, setShowRemoveConfirm,
    showBeadLibrary, setShowBeadLibrary,
    showMaterialsPanel, setShowMaterialsPanel,
    showThreadProperties, setShowThreadProperties,
    showPolarGridPanel, setShowPolarGridPanel,
    showColorPicker, setShowColorPicker,
    showJoinTip, setShowJoinTip,
    confirmDialog, setConfirmDialog,
    alertDialog, setAlertDialog,
    showPolarArrayDialog, setShowPolarArrayDialog,
    polarArrayPeek, setPolarArrayPeek,
    polarArrayCount, setPolarArrayCount,
    polarArrayAngle, setPolarArrayAngle,
    polarArrayPivotId, setPolarArrayPivotId,
    polarArrayCreateGhosts, setPolarArrayCreateGhosts,
    showLinearArrayDialog, setShowLinearArrayDialog,
    linearArrayPeek, setLinearArrayPeek,
    linearArrayCount, setLinearArrayCount,
    linearArrayAngle, setLinearArrayAngle,
    linearArraySpacing, setLinearArraySpacing,
    linearArrayRotStep, setLinearArrayRotStep,
    linearArrayCreateGhosts, setLinearArrayCreateGhosts,
    showSpiralArrayDialog, setShowSpiralArrayDialog,
    spiralArrayPeek, setSpiralArrayPeek,
    spiralArrayCount, setSpiralArrayCount,
    spiralArrayType, setSpiralArrayType,
    spiralArrayGap, setSpiralArrayGap,
    spiralArrayGrowth, setSpiralArrayGrowth,
    spiralArrayRotate, setSpiralArrayRotate,
    spiralArrayAngleStep, setSpiralArrayAngleStep,
    showArrayManager, setShowArrayManager,
    polarGridPeek, setPolarGridPeek,
    colorPickerTab, setColorPickerTab,
    pickerTabsAllowed, setPickerTabsAllowed,
    pickerColor, setPickerColor,
    pickerCallback, setPickerCallback,
    pickerGradientCallback, setPickerGradientCallback,
    editingColorIndex, setEditingColorIndex,
    selectedGradient, setSelectedGradient,
    gradientSearchTerm, setGradientSearchTerm,
    gradientCategory, setGradientCategory,
    gradientPage, setGradientPage,
    selectedDmcColor, setSelectedDmcColor,
    dmcSearchTerm, setDmcSearchTerm,
    dmcPage, setDmcPage,
    dmcCategory, setDmcCategory,
    showRotationHandles, setShowRotationHandles,
    showUnnumbered, setShowUnnumbered,
    showInvalidNotation, setShowInvalidNotation,
    showEditingArtifacts, setShowEditingArtifacts,
    notesOpen, setNotesOpen,
    loadMsg, setLoadMsg,
    pendingRecentLoad, setPendingRecentLoad,
    selectedBeadId, setSelectedBeadId,
    resolvedHelpUrl, setResolvedHelpUrl,
    helpUrlReady, setHelpUrlReady,
    resolvedUiGuideUrl, setResolvedUiGuideUrl,
    uiGuideUrlReady, setUiGuideUrlReady,
  } = useUIState();

  // ── Canvas interaction state ─────────────────────────────────────────────
  const {
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
    singleRotationInput, setSingleRotationInput,
  } = useCanvasInteraction();

  // ── Tatting order state ──────────────────────────────────────────────────
  const {
    orderGroups, setOrderGroups,
    activeOrderGroupId, setActiveOrderGroupId,
    tattingOrderConflict, setTattingOrderConflict,
    tattingOrderInput, setTattingOrderInput,
    newGroupNameInput, setNewGroupNameInput,
    showNewGroupInput, setShowNewGroupInput,
    renamingGroupId, setRenamingGroupId,
    renameGroupInput, setRenameGroupInput,
    showGroupDropdown, setShowGroupDropdown,
    showPropBarGroupDropdown, setShowPropBarGroupDropdown,
    propBarOrderDraft, setPropBarOrderDraft,
  } = useTattingOrder();

  // ── Project state ────────────────────────────────────────────────────────
  const {
    projectName, setProjectName,
    currentFilePath, setCurrentFilePath,
    lastSavedHistoryIndex, setLastSavedHistoryIndex,
    renderMode, setRenderMode,
    bakedRealisticSVG, setBakedRealisticSVG,
    notationError, setNotationError,
    draftNotation, setDraftNotation,
  } = useProjectState();

  // ── Bead and picot state ─────────────────────────────────────────────────
  const {
    beadLibrary, setBeadLibrary,
    beadSettings, setBeadSettings,
    selectedBEs, setSelectedBEs,
    beClipboard, setBeClipboard,
    lineBeadClipboard, setLineBeadClipboard,
    polarGrids, setPolarGrids,
    selectedPolarGridId, setSelectedPolarGridId,
    picotConnections, setPicotConnections,
    selectedPicots, setSelectedPicots,
    threadPresets, setThreadPresets,
    activePresetId, setActivePresetId,
  } = useBeadState();

  const [elements, setElements] = useState([]);
  const [camera, setCamera] = useState(() => ({
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2)
  })); // World origin centered in viewport on first load
  const [zoom, setZoom] = useState(1.8); // Default zoom 180%
  const [dsWidth, setDsWidth] = useState(10);

  // Ruler tool state — up to 2 world-coord anchor points + live cursor position

  const [gridEnabled, setGridEnabled] = useState(true);
  // Order groups — array of { id, name } in display order. Color assigned by index (cycles through GROUP_COLORS).
  const [bgColor, setBgColor] = useState<string>(() => {
    try { return localStorage.getItem('tcad_bg_color') || '#1F2937'; } catch { return '#1F2937'; }
  });
  const [customColors, setCustomColors] = useState([]);
  const [referenceImage, setReferenceImage] = useState(null);
  const [refImageProps, setRefImageProps] = useState({ opacity: 0.5, rotation: 0, scale: 1, visible: true, x: 0, y: 0 });
  const [clipboard, setClipboard] = useState([]); // NEW: for copy/paste
  // helpTab state removed — help content now lives in tatting-help.html (iframe)
  const [dmcColors, setDmcColors] = useState([]); // DMC color database
  const [snapEnabled, setSnapEnabled] = useState(true); // Toggle for snap to point

  // Canvas indicator theme — all user-visible indicator colors in one object.
  // Users can download this as theme.json, edit it, and reload via Options > Load Theme.
  const DEFAULT_THEME = {
    // Snap points
    snapOuter: '#FFA500',
    snapInner: '#FFA500',
    // Joint picots (jp)
    jpUnconnected: '#00CC44',
    jpConnected:   '#FFE600',
    jpSelected:    '#FF1493',
    // Core join picots (cj / cjp)
    cjUnconnected: '#00BFFF',
    cjConnected:   '#FFE600',
    cjSelected:    '#FF1493',
    // Path edit handles
    handleStart:    '#00FF00',
    handleControl1: '#0088FF',
    handleControl2: '#00DDFF',
    handleStroke:   '#000000',
    // Connection lines & midpoint dot
    connectionLine: '#FFE600',
    connectionDot:  '#FFE600',
    // Guide picot arm (jpg)
    jpgArm:         '#00FF00',
    jpgArmSelected: '#66FF66',
    // Guide point diamond (gp)
    gpDiamond:      '#ADFF2F',
  };
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [snapRadius, setSnapRadius] = useState(15); // Snap radius in SCREEN pixels — divided by zoom at use sites

  const spaceDownRef = useRef(false);                    // Ref mirror — mouse handlers read this to avoid stale closure
  const zDownRef = useRef(false);                        // Ref mirror for Z key

  // Linear array state

  // Spiral array state
  const APP_VERSION = '1.0.0';


  // Update reminder: only after 90 days since install — evaluated once, stored here for the splash to read.
  const updateReminderDue = (() => {
    if (!localStorage.getItem('tcad_install_date')) {
      localStorage.setItem('tcad_install_date', String(Date.now()));
      return false;
    }
    const installDate = parseInt(localStorage.getItem('tcad_install_date') || '0', 10);
    const daysSinceInstall = (Date.now() - installDate) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall < 90) return false;
    return localStorage.getItem('tcad_update_seen') !== APP_VERSION;
  })();

  // Splash screen — shown on every launch

  // Autosave metadata — parsed once for the splash button label
  const splashAutosave = (() => {
    try {
      const saved = localStorage.getItem('tatting-designer-autosave');
      if (!saved) return null;
      const d = JSON.parse(saved);
      if (!d.elements || d.elements.length === 0) return null;
      return { name: d.name || 'Untitled', date: d.autoSaved ? new Date(d.autoSaved).toLocaleString() : '' };
    } catch { return null; }
  })();

  // Tips — navigable with prev/next
  const SPLASH_TIP_KEYS = [
    'splashTip01', 'splashTip02', 'splashTip03', 'splashTip04', 'splashTip05',
    'splashTip06', 'splashTip07', 'splashTip08', 'splashTip09', 'splashTip10',
    'splashTip11', 'splashTip12', 'splashTip13', 'splashTip14', 'splashTip15',
  ];
  const [splashTipIndex, setSplashTipIndex] = useState<number>(() => Math.floor(Math.random() * SPLASH_TIP_KEYS.length));


  // ============================================================================
  // REALISTIC RENDERING STATE
  // ============================================================================
  const [notationFontSize, setNotationFontSize] = useState('medium'); // 'small' | 'medium' | 'large'
  const [uiScale, setUiScale] = useState<string>(() => {
    try { return localStorage.getItem('tcad_ui_scale') || 'normal'; } catch { return 'normal'; }
  }); // 'normal' | 'large'
  const [patternNotes, setPatternNotes] = useState(''); // Pattern notes / instructions
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS); // Material groups (up to 10)
  const lastUsedMaterialIdRef = useRef('default');

  // ── Localisation ────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState<string>(() => {
    const saved = localStorage.getItem('tcad_language');
    if (saved && TRANSLATIONS[saved]) return saved;
    const nav = navigator.language?.split('-')[0] ?? 'en';
    return TRANSLATIONS[nav] ? nav : 'en';
  });
  // Extra translations loaded from translations.json (merged on top of hardcoded)
  const [extraTranslations, setExtraTranslations] = useState<Record<string, Record<string, string>>>({});
  // Available languages — populated from translations.json "_languages" key
  const [availableLanguages, setAvailableLanguages] = useState<Record<string, string>>(LANGUAGES_FALLBACK);

  const t = React.useCallback((key: string): string => {
    // Priority: current language external JSON → current language hardcoded →
    //           English external JSON (translations_en.json) → key itself
    return extraTranslations[language]?.[key]
      ?? TRANSLATIONS[language]?.[key]
      ?? extraTranslations['en']?.[key]
      ?? key;
  }, [language, extraTranslations]);


  // Hardcoded realistic rendering parameters:
  // - stitchVerticalOffset: 0.125 (outer stitch edge aligned to path line)
  // - picotVerticalOffset: 20 (perpendicular offset from stitch)
  // - picotHorizontalOffset: 0.75 * dsWidth (backwards along path)

  // Undo/Redo state - now stores {elements, connections}
  const [history, setHistory] = useState([{ elements: [], connections: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);  // Current position in history
  const isUndoRedoRef = useRef(false);  // Flag to prevent adding history during undo/redo
  const notationEscapeRef = useRef(false); // Flag: ESC was pressed on notation input — suppress blur commit
  const pendingNotationRef = useRef(null); // { elementId, notation, notationB? } — survives re-renders/unmount
  const historyRef = useRef([{ elements: [], connections: [] }]);  // Ref to current history
  const historyIndexRef = useRef(0);  // Ref to current index
  const isInteractingRef = useRef(false);  // Flag to prevent history during drag/rotate operations
  const rafIdRef = useRef(null);  // RAF ID for batching mouse moves
  const nudgeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // For press-and-hold rotation nudge
  const groupDropdownButtonRef = useRef<HTMLButtonElement>(null); // For fixed-position group dropdown on mobile
  const propBarGroupButtonRef = useRef<HTMLButtonElement>(null); // For property bar group dropdown
  const dragOriginRef = useRef(null); // World position at drag start, for ortho axis lock
  const pendingMouseEventRef = useRef(null);  // Store latest mouse event for batching
  // Ref to always-current handleMouseMoveInternal — fixes stale RAF closure bug where
  // a queued RAF would call the version captured at queue time, missing updates from
  // re-renders triggered by setDragTick, zoom, or camera changes.
  const handleMouseMoveInternalRef = useRef(null);
  const needsHistoryPushRef = useRef(false);  // Flag to push history after interaction ends
  const skipAutoHistoryRef = useRef(false);   // Flag: explicit pushHistoryState already called — skip useEffect auto-push
  const pathDragStartRef = useRef(null);  // Store initial control points and position for smooth path editing

  // Shared history push — used by the elements useEffect and by the mouseUp handler.
  // Reads history from refs (always current), writes via setters (stable references).
  const pushHistoryState = useCallback((els, conns, groups?) => {
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    const currentState = currentHistory[currentIndex];

    const normalGroups = groups ?? [];
    const newStateStr = JSON.stringify({ elements: els, connections: conns, orderGroups: normalGroups });
    const oldStateStr = currentState
      ? JSON.stringify({ elements: currentState.elements, connections: currentState.connections, orderGroups: currentState.orderGroups ?? [] })
      : null;
    if (oldStateStr === newStateStr) return;

    const cloned = {
      elements: JSON.parse(JSON.stringify(els)),
      connections: JSON.parse(JSON.stringify(conns)),
      orderGroups: JSON.parse(JSON.stringify(groups ?? [])),
    };

    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(cloned);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, []); // refs and state setters are stable — no deps needed

  // Keep history refs updated
  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  const lastMousePosRef = useRef(null); // was state — now ref to avoid re-render on every move
  // PERFORMANCE: During element translate-drag, accumulate offset in a ref instead of
  // calling setElements every frame. SVG transform handles the visual update.
  // setElements is called once on mouseup. This keeps stitchCache/elementById valid all drag.
  const dragOffsetRef = useRef({ active: false, dx: 0, dy: 0 });
  const dragTouchIdRef = useRef(null); // identifier of the touch that started the drag

  const canvasRef = useRef(null);
  const fileButtonRef = useRef(null); // For dropdown positioning
  const arrangeButtonRef = useRef(null); // For arrange dropdown positioning
  const optionsButtonRef = useRef(null); // For options dropdown positioning
  const viewButtonRef = useRef(null);   // For view dropdown positioning
  const helpButtonRef = useRef(null);   // For help/about dropdown positioning
  const draggedHandleRef = useRef(null); // NEW: for path edit
  const fileInputRef = useRef(null);     // NEW: for reference image upload
  const loadInputRef = useRef(null);     // NEW: for loading project files
  const themeInputRef = useRef(null);    // for loading theme JSON files
  const elementsRef = useRef([]);        // NEW: for copy/paste
  const selectedIdsRef = useRef([]);     // NEW: for copy/paste

  // Keep refs updated
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Commit any pending notation change when the selection changes (e.g. clicking canvas deselects)
  useEffect(() => {
    const pending = pendingNotationRef.current;
    if (!pending) return;
    if (selectedIds.includes(pending.elementId)) { return; }
    pendingNotationRef.current = null;
    if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
    const parsed = parseNotation(pending.notation, true);
    if (parsed && parsed.stitchCount > 0) {
      setDraftNotation(null);
      updateNotation(pending.notation, pending.notationB ?? null, pending.elementId);
    } else {
    }
  }, [selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track history when elements or connections change
  useEffect(() => {
    if (isUndoRedoRef.current) return; // Don't add during undo/redo
    if (skipAutoHistoryRef.current) { skipAutoHistoryRef.current = false; return; } // Explicit push already done
    if (isInteractingRef.current) {
      needsHistoryPushRef.current = true; // Push after interaction ends instead
      return;
    }
    pushHistoryState(elements, picotConnections, orderGroupsRef.current);
  }, [elements, picotConnections]); // Depend on both elements and connections

  // Auto-save to localStorage every 30 seconds
  // PERFORMANCE: Use refs to avoid recreating interval on every state change
  // Note: elementsRef and selectedIdsRef already declared above
  const cameraRef = useRef(camera);
  const zoomRef = useRef(zoom);
  const dsWidthRef = useRef(dsWidth);
  const bgColorRef = useRef(bgColor);
  const gridEnabledRef = useRef(gridEnabled);
  const customColorsRef = useRef(customColors);
  const referenceImageRef = useRef(referenceImage);
  const refImagePropsRef = useRef(refImageProps);
  const projectNameRef = useRef(projectName);
  const picotConnectionsRef = useRef(picotConnections);
  const renderModeRef = useRef(renderMode);
  const patternNotesRef = useRef(patternNotes);
  const materialsRef = useRef(materials);
  const beadLibraryRef = useRef(beadLibrary);
  const threadPresetsRef = useRef(threadPresets);
  const activePresetIdRef = useRef(activePresetId);
  const activeModeRef = useRef(activeMode);
  const selectedBEsRef = useRef(selectedBEs);
  const selectedPicotsRef = useRef([]);
  const beClipboardRef = useRef(beClipboard);
  const orderGroupsRef = useRef(orderGroups);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  // PERFORMANCE: Persistent notation-parse cache. Keyed by notation string.
  // Survives stitchCache rebuilds (e.g. dsWidth change) — only re-parses when notation text changes.
  const stitchTypesCacheRef = useRef(new Map());
  // PERFORMANCE: Canvas pixel dimensions — updated by ResizeObserver.
  // Used for viewport culling without calling getBoundingClientRect() every frame.
  const canvasSizeRef = useRef({ width: 1920, height: 1080 });
  
  // Keep refs up to date
  useEffect(() => {
    elementsRef.current = elements;
    selectedIdsRef.current = selectedIds;
    cameraRef.current = camera;
    zoomRef.current = zoom;
    dsWidthRef.current = dsWidth;
    bgColorRef.current = bgColor;
    gridEnabledRef.current = gridEnabled;
    customColorsRef.current = customColors;
    referenceImageRef.current = referenceImage;
    refImagePropsRef.current = refImageProps;
    projectNameRef.current = projectName;
    picotConnectionsRef.current = picotConnections;
    renderModeRef.current = renderMode;
    patternNotesRef.current = patternNotes;
    materialsRef.current = materials;
    beadLibraryRef.current = beadLibrary;
    threadPresetsRef.current = threadPresets;
    activePresetIdRef.current = activePresetId;
    activeModeRef.current = activeMode;
    selectedBEsRef.current = selectedBEs;
    beClipboardRef.current = beClipboard;
    orderGroupsRef.current = orderGroups;
    selectedPicotsRef.current = selectedPicots;
  });

  // Persist polar grids globally to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem('tcad_polar_grids', JSON.stringify(polarGrids)); } catch {}
  }, [polarGrids]);
  
  useEffect(() => {
    const autoSave = () => {
      if (elementsRef.current.length === 0) return; // Don't save empty projects
      
      const projectData = {
        version: 90,
        name: projectNameRef.current,
        autoSaved: new Date().toISOString(),
        elements: elementsRef.current,
        picotConnections: picotConnectionsRef.current,
        camera: cameraRef.current,
        zoom: zoomRef.current,
        dsWidth: dsWidthRef.current,
        bgColor: bgColorRef.current,
        gridEnabled: gridEnabledRef.current,
        customColors: customColorsRef.current,
        referenceImage: referenceImageRef.current,
        refImageProps: refImagePropsRef.current,
        renderMode: renderModeRef.current,
        patternNotes: patternNotesRef.current,
        materials: materialsRef.current,
        orderGroups: orderGroupsRef.current,
        beadLibrary: beadLibraryRef.current,
        activeThreadPreset: threadPresetsRef.current.find(p => p.id === activePresetIdRef.current) || threadPresetsRef.current[0] || null
      };
      
      try {
        localStorage.setItem('tatting-designer-autosave', JSON.stringify(projectData));
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };
    
    // Save immediately on mount if there are elements
    autoSave();
    
    // Then save every 3 minutes — interval only created ONCE
    const interval = setInterval(autoSave, 180000);
    
    return () => clearInterval(interval);
  }, []); // Empty deps - only runs once on mount!

  // Load auto-saved project — called by splash button, not auto-triggered
  const loadFromAutosave = () => {
    try {
      const saved = localStorage.getItem('tatting-designer-autosave');
      if (!saved) return;
      const projectData = JSON.parse(saved);
      if (!projectData.elements || projectData.elements.length === 0) return;
      // Migrate legacy labelsInside → labelOffset
      setElements((projectData.elements || []).map(el =>
        'labelsInside' in el && !('labelOffset' in el)
          ? (({ labelsInside, ...rest }) => ({ ...rest, labelOffset: 8 }))(el)
          : el
      ));
      setPicotConnections(projectData.picotConnections || []);
      setCamera(projectData.camera || { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) });
      setZoom(projectData.zoom || 1);
      setDsWidth(projectData.dsWidth || 10);
      if (projectData.beadLibrary) setBeadLibrary(projectData.beadLibrary);
      if (Array.isArray(projectData.polarGrids)) {
        setPolarGrids(prev => {
          const existing = new Set(prev.map(g => g.id));
          return [...prev, ...projectData.polarGrids.filter(g => !existing.has(g.id))];
        });
      }
      if (projectData.selectedPolarGridId) setSelectedPolarGridId(projectData.selectedPolarGridId);
      setBgColor(projectData.bgColor || '#1F2937');
      setGridEnabled(projectData.gridEnabled !== undefined ? projectData.gridEnabled : true);
      setCustomColors(projectData.customColors || []);
      setReferenceImage(projectData.referenceImage || null);
      setRefImageProps(projectData.refImageProps || { opacity: 0.5, rotation: 0, scale: 1, visible: true });
      setProjectName(projectData.name || 'Untitled Pattern');
      setRenderMode(projectData.renderMode || 'schematic');
      setPatternNotes(projectData.patternNotes || '');
      if (projectData.materials) setMaterials(projectData.materials);
      setOrderGroups(Array.isArray(projectData.orderGroups) ? projectData.orderGroups : []);
      if (projectData.activeThreadPreset) {
        const preset = projectData.activeThreadPreset;
        setThreadPresets(prev => {
          const exists = prev.find(p => p.id === preset.id);
          const updated = exists ? prev.map(p => p.id === preset.id ? preset : p) : [...prev, preset];
          localStorage.setItem('tcad_thread_presets', JSON.stringify(updated));
          return updated;
        });
        setActivePresetId(preset.id);
        localStorage.setItem('tcad_active_preset_id', preset.id);
      }
      setHistory([{ elements: projectData.elements || [], connections: projectData.picotConnections || [] }]);
      setHistoryIndex(0);
    } catch (error) {
      console.error('Error loading auto-save:', error);
    }
  };

  // Clear group rotation input when selection changes
  useEffect(() => {
    setGroupRotationInput('');
  }, [selectedIds]);

  // Tauri v2 exit confirmation — Rust intercepts close and emits event, we show dialog here
  useEffect(() => {
    if (!(window as any).__TAURI__) return;
    let unlisten: (() => void) | null = null;
    listen('close-requested', async () => {
      const hasUnsaved = elements.length > 0 && historyIndexRef.current !== lastSavedHistoryIndex;
      if (hasUnsaved) {
        const confirmed = await ask(t('exitConfirmMessage'), {
          title: t('exitConfirmTitle'),
          kind: 'warning',
        });
        if (confirmed) getCurrentWindow().destroy();
      } else {
        getCurrentWindow().destroy();
      }
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, [elements.length, lastSavedHistoryIndex]);

  // Prevent browser zoom (Ctrl+wheel on desktop, pinch on touchpad)
  // Also handles Shift+wheel → zoom in/out
  useEffect(() => {
    const preventBrowserZoom = (e) => {
      // Prevent Ctrl+wheel zoom (desktop)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
      // Shift+middle-scroll → zoom in/out towards cursor
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const currentZoom = zoomRef.current;
        const currentCamera = cameraRef.current;
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        const newZoom = Math.max(0.1, Math.min(3, currentZoom + delta));
        if (!canvasRef.current) { zoomRef.current = newZoom; setZoom(newZoom); return; }
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - currentCamera.x) / currentZoom;
        const worldY = (mouseY - currentCamera.y) / currentZoom;
        const newCamera = { x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom };
        // Update refs immediately so the next scroll event in the same frame reads fresh values
        zoomRef.current = newZoom;
        cameraRef.current = newCamera;
        setZoom(newZoom);
        setCamera(newCamera);
      }
    };
    
    // Add listener with passive: false so we can preventDefault
    document.addEventListener('wheel', preventBrowserZoom, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', preventBrowserZoom);
    };
  }, []);

  // PERFORMANCE: Track canvas size via ResizeObserver for viewport culling.
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvasSizeRef.current = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
      }
    });
    ro.observe(canvasRef.current);
    // Seed with initial size
    const rect = canvasRef.current.getBoundingClientRect();
    canvasSizeRef.current = { width: rect.width, height: rect.height };
    return () => ro.disconnect();
  }, []);

  // Load DMC colors on mount (from external JSON file with validation)
  useEffect(() => {
    const loadColors = async () => {
      try {
        // Try to load from external JSON file
        const response = await fetch('./dmc_colors.json');
        
        if (!response.ok) {
          throw new Error(`Failed to load colors file: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate JSON structure
        if (!data.solidColors || !Array.isArray(data.solidColors)) {
          throw new Error('Invalid color file format: missing solidColors array');
        }
        if (!data.gradients || !Array.isArray(data.gradients)) {
          throw new Error('Invalid color file format: missing gradients array');
        }
        
        // Validate each solid color has required fields
        data.solidColors.forEach((color, index) => {
          if (!color.id || !color.name || !color.hex) {
            throw new Error(`Invalid solid color at index ${index}: missing required fields (id, name, hex)`);
          }
          if (!/^#[0-9A-Fa-f]{6}$/.test(color.hex)) {
            throw new Error(`Invalid solid color hex at index ${index}: ${color.hex}`);
          }
        });
        
        // Validate and flatten gradients — supports flat array with 'group' field (current format)
        // and legacy grouped {threadLine, items[]} format for backwards compatibility
        let flatGradients = [];
        data.gradients.forEach((entry, index) => {
          if (Array.isArray(entry.items)) {
            // Legacy grouped format: { threadLine: "...", items: [...] }
            if (!entry.threadLine) throw new Error(`Gradient group at index ${index} missing threadLine`);
            entry.items.forEach((g, gi) => {
              if (!g.id || !g.name || !g.stops)
                throw new Error(`Invalid gradient in group "${entry.threadLine}" at item ${gi}: missing fields`);
              flatGradients.push({ ...g, type: 'gradient', group: g.group || entry.threadLine });
            });
          } else {
            // Current flat format: { id, name, type, group, stops }
            if (!entry.id || !entry.name || !entry.stops)
              throw new Error(`Invalid gradient at index ${index}: missing required fields (id, name, stops)`);
            flatGradients.push({ ...entry, type: 'gradient' });
          }
        });
        
        // Merge solid colors and gradients
        const allColors = [...data.solidColors, ...flatGradients];
        setDmcColors(allColors);
        const gradientGroups = [...new Set(flatGradients.map(g => g.group).filter(Boolean))];
        
      } catch (error) {
        console.error('❌ Error loading DMC colors from external file:', error);
        
        // Fallback to minimal embedded colors if external file fails
        const fallbackColors = [
          {"id":"Ecru","name":"Ecru/off-white","hex":"#FFF7E7","group":"Whites & Neutrals"},
          {"id":"Blanc","name":"White","hex":"#FCFCFF","group":"Whites & Neutrals"},
          {"id":"B5200","name":"Snow White","hex":"#FFFFFF","group":"Whites & Neutrals"},
          {"id":"310","name":"Black","hex":"#000000","group":"Whites & Neutrals"},
          {"id":"321","name":"Christmas Red","hex":"#C8011F","group":"Reds"},
          {"id":"666","name":"Christmas Red - Bright","hex":"#E0383B","group":"Reds"},
          {"id":"3713","name":"Salmon - Very Light","hex":"#FADAD1","group":"Pinks & Mauves"},
          {"id":"798","name":"Delft - Dark","hex":"#385E9B","group":"Blues"},
          {"id":"3843","name":"Electric Blue","hex":"#0AAEE0","group":"Blues"},
          {"id":"702","name":"Kelly Green","hex":"#21844E","group":"Greens"},
          {"id":"704","name":"Chartreuse - Bright","hex":"#A6C926","group":"Greens"},
          {"id":"726","name":"Topaz - Light","hex":"#F9D667","group":"Yellows & Golds"},
          {"id":"742","name":"Tangerine - Light","hex":"#FEB246","group":"Oranges & Rusts"},
          {"id":"208","name":"Lavender - Very Dark","hex":"#82558F","group":"Purples & Violets"},
          {"id":"553","name":"Violet","hex":"#894D80","group":"Purples & Violets"},
          {"id":"762","name":"Pearl Gray - Very Light","hex":"#E9E9E9","group":"Whites & Neutrals"},
          {"id":"414","name":"Steel Gray - Dark","hex":"#999999","group":"Whites & Neutrals"},
          {"id":"433","name":"Brown - Medium","hex":"#8A5638","group":"Browns & Tans"},
          {"id":"4010","name":"Winter Sky","type":"gradient","group":"Variations","stops":"0:#c4e9f3,55:#d2d2ca,100:#bab3db"},
          {"id":"4070","name":"Autumn Leaves","type":"gradient","group":"Variations","stops":"0:#ffd89f,67:#fbb098,77:#fea270,96:#fdd269"},
          {"id":"4200","name":"Wild Fire","type":"gradient","group":"Variations","stops":"0:#BE0F36,33:#CF1B34,65:#ED3245,72:#F12D3B,82:#F12228,93:#F41913,100:#F61408"},
          {"id":"93","name":"Blue Haze","type":"gradient","group":"Variegated","stops":"0:#B2C2E6,10:#9BACD8,22:#8190C7,29:#717FBC,41:#5866AD,99:#393280"},
          {"id":"106","name":"Coral","type":"gradient","group":"Variegated","stops":"0:#F50F02,8:#FB2D20,28:#FC7766,35:#FE9381,98:#FA9579"},
          {"id":"125","name":"Seafoam Green","type":"gradient","group":"Variegated","stops":"0:#106C43,13:#1F8A56,80:#76D790,99:#A5E6AE"}
        ];
        
        setDmcColors(fallbackColors);
      }
    };
    
    loadColors();
  }, []); // Only run on mount

  // Load external translations on mount.
  // File layout (all in the same folder as the app):
  //   languages.json          — manifest: { "en": "English", "hu": "Magyar", ... }
  //   translations_en.json    — flat key:value pairs for English
  //   translations_hu.json    — flat key:value pairs for Hungarian
  //   translations_XX.json    — one file per language code
  //
  // languages.json drives the language picker.
  // Each translations_XX.json is loaded independently — a missing file is silently skipped.
  // Load translations on mount.
  // translations_en.json is statically imported — guaranteed available, no fetch needed.
  // Other language files are loaded from the public folder if a languages.json manifest exists.
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        // Step 0: English is always available via static import — seed it immediately
        const enFlat: Record<string, string> = enStrings as Record<string, string>;

        // Step 1: load the language manifest (optional — may not exist)
        const manifestRes = await fetch('./languages.json');
        if (!manifestRes.ok) {
          // No manifest — English only
          setExtraTranslations({ en: enFlat });
          return;
        }
        const manifest: Record<string, string> = await manifestRes.json();
        if (typeof manifest !== 'object' || Array.isArray(manifest)) return;

        setAvailableLanguages(manifest);

        // Resolve initial language
        setLanguage(prev => {
          if (manifest[prev]) return prev;
          const saved = localStorage.getItem('tcad_language');
          if (saved && manifest[saved]) return saved;
          const nav = navigator.language?.split('-')[0] ?? 'en';
          return manifest[nav] ? nav : 'en';
        });

        // Step 2: load each language file in parallel
        const entries = await Promise.all(
          Object.keys(manifest).map(async (code) => {
            try {
              const res = await fetch(`./translations_${code}.json`);
              if (!res.ok) return [code, null];
              const data = await res.json();
              if (typeof data !== 'object' || Array.isArray(data)) return [code, null];
              const flat: Record<string, string> = {};
              for (const [k, v] of Object.entries(data)) {
                if (!k.startsWith('_') && typeof v === 'string') flat[k] = v as string;
              }
              return [code, flat];
            } catch {
              return [code, null];
            }
          })
        );

        const langs: Record<string, Record<string, string>> = { en: enFlat };
        for (const [code, flat] of entries) {
          if (flat && Object.keys(flat as object).length > 0) {
            // External en file merges over bundled en (allows overrides)
            if (code === 'en') langs['en'] = { ...enFlat, ...(flat as Record<string, string>) };
            else langs[code as string] = flat as Record<string, string>;
          }
        }

        setExtraTranslations(langs);
      } catch (err) {
        console.error('Translation load error:', err);
        // Last resort — set English from import even if everything else failed
        setExtraTranslations({ en: enStrings as Record<string, string> });
      }
    };
    loadTranslations();
  }, []);

  // Load external theme on mount (tatting-theme.json, same folder as the app).
  // Any key present in the file overrides the default. Unknown keys are ignored.
  // Silently does nothing if the file isn't there.
  useEffect(() => {
    const loadExternalTheme = async () => {
      try {
        const response = await fetch('./tatting-theme.json');
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data !== 'object' || Array.isArray(data)) return;
        setTheme(prev => {
          const merged = { ...prev };
          for (const key of Object.keys(DEFAULT_THEME)) {
            if (typeof data[key] === 'string') merged[key] = data[key];
          }
          return merged;
        });
      } catch {
        // No theme file present — use defaults, no problem.
      }
    };
    loadExternalTheme();
  }, []);
  React.useEffect(() => {
    if (notesTextareaRef.current && notesTextareaRef.current !== document.activeElement) {
      notesTextareaRef.current.value = patternNotes;
    }
  }, [patternNotes]);

  // Track Shift key (rotation handles) and Space key (temporary pan)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') {
        setIsShiftHeld(true);
      }
      if (e.key === ' ') {
        // Don't intercept Space when the user is typing in a field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault(); // Prevent page scroll
        if (!spaceDownRef.current) {
          spaceDownRef.current = true;
          setSpaceDown(true);
        }
      }
      if (e.key === 'z' || e.key === 'Z') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.ctrlKey || e.metaKey || e.shiftKey) return; // Don't intercept Ctrl+Z (undo) or Shift+Z (redo)
        if (!zDownRef.current) {
          zDownRef.current = true;
          setZDown(true);
        }
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        setIsShiftHeld(false);
      }
      if (e.key === ' ') {
        spaceDownRef.current = false;
        setSpaceDown(false);
        // Release any active space-pan on key up
        setIsDragging(false);
        setDragStart(null);
      }
      if (e.key === 'z' || e.key === 'Z') {
        zDownRef.current = false;
        setZDown(false);
        setZoomRectBox(null); // Clear any in-progress zoom rect
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    // Reset pivot offset when selection changes
    setPivotOffset({ x: 0, y: 0 });
  }, [selectedIds]);

  // Clear ruler and zoomRectBox when switching to another tool
  useEffect(() => {
    if (currentTool !== 'ruler') {
      setRulerPoints([]);
      setRulerMousePos(null);
    }
    if (currentTool !== 'zoomRect') {
      setZoomRectBox(null);
    }
  }, [currentTool]);

  const getViewportCenter = () => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    // Account for zoom when calculating world coordinates
    return { 
      x: (rect.width / 2 - camera.x) / zoom, 
      y: (rect.height / 2 - camera.y) / zoom 
    };
  };

  // bezier functions imported from ./geometry/bezier

  // getGradientColorAtPosition stays here — depends on dmcColors state
  const getGradientColorAtPosition = (gradientId, position) => {
    const gradient = dmcColors.find(c => c.id === gradientId);
    if (!gradient || !gradient.stops) return '#FFFFFF';
    let stops = [];
    if (typeof gradient.stops === 'string') {
      stops = gradient.stops.split(',').map(part => {
        const [pos, color] = part.split(':');
        return { position: parseFloat(pos) / 100, color: color.trim() };
      });
    } else if (Array.isArray(gradient.stops)) {
      stops = gradient.stops;
    }
    if (stops.length === 0) return '#FFFFFF';
    if (stops.length === 1) return stops[0].color;
    position = Math.max(0, Math.min(1, position));
    let before = stops[0], after = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (position >= stops[i].position && position <= stops[i + 1].position) {
        before = stops[i]; after = stops[i + 1]; break;
      }
    }
    const range = after.position - before.position;
    const localT = range === 0 ? 0 : (position - before.position) / range;
    return interpolateColor(before.color, after.color, localT);
  };

  // Sample the entire closed path as a smooth offset curve (for teardrops)
  // Returns an array of {x, y, distance} points tracing the offset curve
  const sampleClosedPathOffset = (paths, offset, samplesPerStitch) => {
    let totalLength = 0;
    for (const path of paths) {
      const samples = sampleBezierPath(path, 50);
      totalLength += calculatePathLength(samples);
    }
    
    const numSamples = samplesPerStitch; // Total samples for entire ring
    const points = [];
    
    for (let i = 0; i < numSamples; i++) {
      const dist = (i / numSamples) * totalLength;
      const { x, y, angle } = getPointAndAngleAtDistance(paths, dist);
      const perpAngle = angle - Math.PI / 2;
      points.push({
        x: x + Math.cos(perpAngle) * offset,
        y: y + Math.sin(perpAngle) * offset,
        distance: dist
      });
    }
    
    return points;
  };

  // Calculate stitch positions along paths (chains/teardrops)
  const calculatePathStitches = (element) => {
    if (!element || !element.paths || element.paths.length === 0) return [];
    
    const stitches = [];
    const stitchCount = element.stitchCount || 0;
    
    // Parse stitch types from notation
    const stitchTypeMap = getStitchTypes(element.notation || '');
    
    const renderPaths = element.paths;
    
    // Pre-sample each path ONCE - avoids re-sampling on every getPointAndAngle call
    const allSamples = renderPaths.map(p => sampleBezierPath(p, 50));
    const pathLengths = allSamples.map(s => calculatePathLength(s));
    const totalLength = pathLengths.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < stitchCount; i++) {
      const type = stitchTypeMap[i] || 'ds';
      if (type === 'rds-cont') continue; // second DS slot of RDS — skip

      // RDS spans 2 DS slots: sample at midpoint of the full span
      const position = type === 'rds' ? (i + 1) / stitchCount : (i + 0.5) / stitchCount;
      const distance = position * totalLength;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, distance);
      
      const startDist = (i / stitchCount) * totalLength;
      const endDist = ((i + (type === 'rds' ? 2 : 1)) / stitchCount) * totalLength;
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, startDist);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, endDist);
      
      const _matEC = getElementColor(element);
      const color = _matEC.isGradient ? getGradientColorAtPosition(_matEC.id, position) : (_matEC.color || element.color);
      
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type, dsPosition: i });
    }
    
    // Return stitches + the pre-sampled path data so the render can reuse it
    // without calling sampleBezierPath again (totalPathLength IIFE in JSX)
    return { stitches, allSamples, pathLengths, totalLength };
  };

  // Calculate stitch positions for split rings (two separate paths)
  const calculateSplitRingStitches = (element) => {
    if (!element || !element.paths || element.paths.length < 2) return [];
    
    const stitches = [];
    const stitchCountA = element.splitPosition || Math.floor(element.stitchCount / 2);
    const stitchCountB = element.stitchCount - stitchCountA;
    
    const notationA = element.notation || 'sr: 5ds';
    const notationB = element.notationB ? `sr: ${element.notationB}` : 'sr: 5ds';
    const stitchTypeMapA = getStitchTypes(notationA);
    const stitchTypeMapB = getStitchTypes(notationB);
    
    // Pre-sample each path ONCE
    const pathA = element.paths[0];
    const samplesA = [sampleBezierPath(pathA, 50)];
    const lengthsA = [calculatePathLength(samplesA[0])];
    const lengthA = lengthsA[0];
    
    // Path A uses materialId, Path B uses materialIdB (fallback to materialId)
    const ecA = getElementColor({ ...element });
    const ecB = getElementColor({ ...element, materialId: element.materialIdB || element.materialId });

    for (let i = 0; i < stitchCountA; i++) {
      const distance = ((i + 0.5) / stitchCountA) * lengthA;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, distance);
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, (i / stitchCountA) * lengthA);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, ((i + 1) / stitchCountA) * lengthA);
      const color = ecA.isGradient ? getGradientColorAtPosition(ecA.id, i / stitchCountA) : ecA.color;
      const type = stitchTypeMapA[i] || 'ds';
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type });
    }
    
    const pathB = element.paths[1];
    const samplesB = [sampleBezierPath(pathB, 50)];
    const lengthsB = [calculatePathLength(samplesB[0])];
    const lengthB = lengthsB[0];
    
    for (let i = 0; i < stitchCountB; i++) {
      const distance = ((i + 0.5) / stitchCountB) * lengthB;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, distance);
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, (i / stitchCountB) * lengthB);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, ((i + 1) / stitchCountB) * lengthB);
      const color = ecB.isGradient ? getGradientColorAtPosition(ecB.id, i / stitchCountB) : ecB.color;
      const type = stitchTypeMapB[i] || 'ds';
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type });
    }
    
    return stitches;
  };

  // Calculate stitch positions for circular rings
  const calculateCircleStitches = (element) => {
    if (!element || element.shapeStyle !== 'circle') return [];
    
    const stitches = [];
    const stitchCount = element.stitchCount || 0;
    const targetCircumference = stitchCount * dsWidth;
    const radius = targetCircumference / (2 * Math.PI);
    const rotation = (element.rotation || 0) * Math.PI / 180;
    
    // Parse stitch types from notation
    const stitchTypeMap = getStitchTypes(element.notation || '');
    
    for (let i = 0; i < stitchCount; i++) {
      // Get stitch type for this DS position - default to 'ds'
      // May be an array for SS (2 stitches per DS position)
      const type = stitchTypeMap[i] || 'ds';
      if (type === 'rds-cont') continue; // second DS slot of an RDS — skip, already covered by the first slot
      
      // RDS spans 2 DS slots: center it between slot i and i+1
      const position = type === 'rds' ? (i + 1) / stitchCount : (i + 0.5) / stitchCount;
      const angle = position * Math.PI * 2 + rotation;
      const x = element.center.x + Math.cos(angle) * radius;
      const y = element.center.y + Math.sin(angle) * radius;
      const tangentAngle = angle + Math.PI / 2;
      
      let color;
      const ec = getElementColor(element);
      if (ec.isGradient) {
        color = getGradientColorAtPosition(ec.id, position);
      } else {
        color = ec.color;
      }
      
      stitches.push({ x, y, angle: tangentAngle, centerPolarAngle: angle, color, type, dsPosition: i });
    }
    
    return stitches;
  };

  // Calculate scale factor for stitches
  const calculateStitchScale = () => {
    const normalizedWidth = 0.4; // Single DS width (half of the original 0.8)
    return dsWidth / normalizedWidth;
  };

  // Generate SVG transform for a stitch

  // ============================================================================
  // WEDGE STITCH RENDERING
  // Trapezoid shapes that conform to path curvature, filling gaps between stitches.
  // ============================================================================

  // Render a DS/SS/RDS stitch as trapezoid paths for circular rings.
  // Works in world coordinates using exact polar geometry — perfect radial edges.
  // Returns an array of SVG "d" path strings (one per sub-shape: bar + posts).
  const renderWedgeRingShapes = (stitch, el, scale, offsetAmount, stitchType) => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const cx = el.center.x;
    const cy = el.center.y;
    const r = el.stitchCount * dsWidth / (2 * Math.PI);
    const baseRadius = r + offsetAmount;

    // centerPolarAngle is the polar angle of this stitch's midpoint from ring center
    const centerPolarAngle = stitch.centerPolarAngle;

    // Angular half-span for this stitch type (RDS = 2 DS slots wide)
    const dsEquivWidth = { 'ds': 1.0, 'ss': 0.5, 'lss': 0.5, 'rss': 0.5, 'rds': 2.0 };
    const halfArc = (Math.PI / el.stitchCount) * (dsEquivWidth[stitchType] || 1.0);

    // The WEDGE_SHAPES x-extents of the DS/SS/RDS base symbol
    // These are the leftmost and rightmost x coords across ALL rects for this type
    const STITCH_X_EXTENTS = {
      'ds':  { xMin: -0.2622, xMax:  0.0504 },
      'ss':  { xMin: -0.1036, xMax:  0.0463 },
      'lss': { xMin: -0.1036, xMax:  0.0463 },
      'rss': { xMin: -0.1036, xMax:  0.0463 },
      'rds': { xMin: -0.5946, xMax:  0.0798 },
    };
    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;     // full symbol width in normalized units
    const alphaStart = centerPolarAngle - halfArc;  // left edge of this stitch's arc
    const alphaEnd   = centerPolarAngle + halfArc;  // right edge

    return shapes.map(([xl, xr, yo, yi]) => {
      // Convert symbol y to radial distances from ring center.
      // Positive y in symbol = inward = SUBTRACT from baseRadius.
      const d_outer = baseRadius - yo * scale;
      const d_inner = baseRadius - yi * scale;

      // Map symbol x linearly onto the stitch's full angular span.
      // xl=ext.xMin → alphaStart, xr=ext.xMax → alphaEnd
      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;
      const a_left  = alphaStart + tLeft  * (alphaEnd - alphaStart);
      const a_right = alphaStart + tRight * (alphaEnd - alphaStart);

      // Four trapezoid corners in world coordinates
      const p1x = cx + d_outer * Math.cos(a_left);
      const p1y = cy + d_outer * Math.sin(a_left);
      const p2x = cx + d_outer * Math.cos(a_right);
      const p2y = cy + d_outer * Math.sin(a_right);
      const p3x = cx + d_inner * Math.cos(a_right);
      const p3y = cy + d_inner * Math.sin(a_right);
      const p4x = cx + d_inner * Math.cos(a_left);
      const p4y = cy + d_inner * Math.sin(a_left);

      return `M ${p1x},${p1y} L ${p2x},${p2y} L ${p3x},${p3y} L ${p4x},${p4y} Z`;
    });
  };

  // Wedge trapezoid rendering for CLOSED non-circle paths (teardrops, squeezed rings).
  // SMOOTH OUTER CURVE PRIORITY: Uses a pre-sampled continuous offset curve for the outer edge,
  // then bridges to polar-computed inner edge. Accepts slight distortion of hidden inner parts
  // to achieve smooth visible appearance.
  // Sample a segment of the path between startDist and endDist with offset perpendicular
  // Sample entire path with perpendicular offset, returning array of points
  const sampleFullPathWithOffset = (paths, offset, totalSamples) => {
    let totalLength = 0;
    for (const path of paths) {
      const samples = sampleBezierPath(path, 50);
      totalLength += calculatePathLength(samples);
    }

    const points = [];
    for (let i = 0; i <= totalSamples; i++) {
      const dist = (i / totalSamples) * totalLength;
      const { x, y, angle } = getPointAndAngleAtDistance(paths, dist);
      const perpAngle = angle - Math.PI / 2;
      points.push({
        x: x + Math.cos(perpAngle) * offset,
        y: y + Math.sin(perpAngle) * offset
      });
    }
    
    return points;
  };

  // Render closed path stitches using TWO parallel offset curves
  // Clean approach: sample full outer + inner curves, slice by stitch count
  const renderWedgeTeardropShapes = (stitch, el, scale, offsetAmount, stitchType, stitchIndex, subStitchCount = 1) => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const stitchCount = el.stitchCount; // DS-equivalent count
    const samplesPerDS = 10; // Samples for one DS stitch
    const totalSamples = stitchCount * samplesPerDS;

    // DS-equivalent width for each stitch type (SS is half of DS)
    const dsEquivalentWidth = {
      'ds': 1.0,
      'ss': 0.5,
      'lss': 0.5,
      'rss': 0.5,
      'rds': 2.0
    };
    const stitchWidth = dsEquivalentWidth[stitchType] || 1.0;
    const samplesForThisStitch = samplesPerDS * stitchWidth;

    // Find the full horizontal span of this stitch type
    const STITCH_X_EXTENTS = {
      'ds':  { xMin: -0.2622, xMax:  0.0504 },
      'ss':  { xMin: -0.1023, xMax:  0.0463 },
      'lss': { xMin: -0.1023, xMax:  0.0463 },
      'rss': { xMin: -0.1023, xMax:  0.0463 },
      'rds': { xMin: -0.5946, xMax:  0.0798 },
    };
    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;

    return shapes.map(([xl, xr, yo, yi]) => {
      // Sample TWO parallel curves at this rectangle's outer and inner radii
      const outerOffset = offsetAmount - yo * scale;
      const innerOffset = offsetAmount - yi * scale;
      
      const outerCurve = sampleFullPathWithOffset(el.paths, outerOffset, totalSamples);
      const innerCurve = sampleFullPathWithOffset(el.paths, innerOffset, totalSamples);

      // Map this rectangle's horizontal position to slice indices
      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;

      // Calculate the start position in DS-equivalent units
      // For SS at effectiveIndex 5.5: baseIndex=5, fraction=0.5, so dsStart = 5.5
      const baseIndex = Math.floor(stitchIndex);
      const fraction = stitchIndex - baseIndex;
      
      const dsStart = baseIndex + fraction;  // fraction is already the DS offset
      const stitchSliceStart = dsStart * samplesPerDS;
      
      const rectStart = Math.round(stitchSliceStart + tLeft * samplesForThisStitch);
      const rectEnd = Math.round(stitchSliceStart + tRight * samplesForThisStitch);
      
      const outerSlice = outerCurve.slice(rectStart, rectEnd + 1);
      const innerSlice = innerCurve.slice(rectStart, rectEnd + 1);
      if (outerSlice.length < 2 || innerSlice.length < 2) return '';

      // Build closed path: outer curve forward, inner curve backward
      let pathD = `M ${outerSlice[0].x},${outerSlice[0].y}`;
      for (let j = 1; j < outerSlice.length; j++) {
        pathD += ` L ${outerSlice[j].x},${outerSlice[j].y}`;
      }
      pathD += ` L ${innerSlice[innerSlice.length - 1].x},${innerSlice[innerSlice.length - 1].y}`;
      for (let j = innerSlice.length - 2; j >= 0; j--) {
        pathD += ` L ${innerSlice[j].x},${innerSlice[j].y}`;
      }
      pathD += ` Z`;

      return pathD;
    });
  };

  // Render chain stitches using TWO parallel offset curves (same as teardrops but without center reference)
  const renderWedgeChainShapes = (stitch, el, scale, offsetAmount, stitchType, stitchIndex) => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const stitchCount = el.stitchCount; // DS-equivalent count
    const samplesPerDS = 10;
    const totalSamples = stitchCount * samplesPerDS;

    // DS-equivalent width for each stitch type
    const dsEquivalentWidth = {
      'ds': 1.0,
      'ss': 0.5,
      'lss': 0.5,
      'rss': 0.5,
      'rds': 2.0
    };
    const stitchWidth = dsEquivalentWidth[stitchType] || 1.0;
    const samplesForThisStitch = samplesPerDS * stitchWidth;

    const STITCH_X_EXTENTS = {
      'ds':  { xMin: -0.2622, xMax:  0.0504 },
      'ss':  { xMin: -0.1023, xMax:  0.0463 },
      'lss': { xMin: -0.1023, xMax:  0.0463 },
      'rss': { xMin: -0.1023, xMax:  0.0463 },
      'rds': { xMin: -0.5946, xMax:  0.0798 },
    };
    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;

    return shapes.map(([xl, xr, yo, yi]) => {
      const outerOffset = offsetAmount - yo * scale;
      const innerOffset = offsetAmount - yi * scale;
      
      const outerCurve = sampleFullPathWithOffset(el.paths, outerOffset, totalSamples);
      const innerCurve = sampleFullPathWithOffset(el.paths, innerOffset, totalSamples);

      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;

      // Calculate position in DS-equivalent units
      // fraction is already the offset within the DS unit
      const baseIndex = Math.floor(stitchIndex);
      const fraction = stitchIndex - baseIndex;
      const dsStart = baseIndex + fraction;
      const stitchSliceStart = dsStart * samplesPerDS;
      
      const rectStart = Math.round(stitchSliceStart + tLeft * samplesForThisStitch);
      const rectEnd = Math.round(stitchSliceStart + tRight * samplesForThisStitch);
      
      const outerSlice = outerCurve.slice(rectStart, rectEnd + 1);
      const innerSlice = innerCurve.slice(rectStart, rectEnd + 1);
      if (outerSlice.length < 2 || innerSlice.length < 2) return '';

      let pathD = `M ${outerSlice[0].x},${outerSlice[0].y}`;
      for (let j = 1; j < outerSlice.length; j++) {
        pathD += ` L ${outerSlice[j].x},${outerSlice[j].y}`;
      }
      pathD += ` L ${innerSlice[innerSlice.length - 1].x},${innerSlice[innerSlice.length - 1].y}`;
      for (let j = innerSlice.length - 2; j >= 0; j--) {
        pathD += ` L ${innerSlice[j].x},${innerSlice[j].y}`;
      }
      pathD += ` Z`;

      return pathD;
    });
  };

  // Build a skew-corrected SVG matrix transform for chain/teardrop stitches.
  // Uses the tangent angle change across the stitch to shear the symbol
  // into a parallelogram that closes gaps on curved paths.
  const getWedgePathTransform = (stitch, offsetX, offsetY, scale) => {
    const sA = stitch.startAngle ?? stitch.angle;
    const eA = stitch.endAngle   ?? stitch.angle;
    const midAngle = (sA + eA) * 0.5;
    const phi      = (eA - sA) * 0.5; // half-skew angle
    const cosTh    = Math.cos(midAngle);
    const sinTh    = Math.sin(midAngle);
    const tanPhi   = Math.tan(phi);
    // matrix(a,b,c,d,e,f) = rotate(midAngle) * skewX(phi) * scale
    const a = scale * cosTh;
    const b = scale * sinTh;
    const c = scale * (cosTh * tanPhi - sinTh);
    const d = scale * (sinTh * tanPhi + cosTh);
    return `matrix(${a},${b},${c},${d},${offsetX},${offsetY})`;
  };


  const createCirclePath = (cx, cy, targetLength, squeeze = 0) => {
    const radius = targetLength / (2 * Math.PI);
    
    // Apply squeeze: positive = taller/narrower, negative = wider/shorter
    const widthFactor = 1 - squeeze;
    const heightFactor = 1 + squeeze;
    
    const radiusX = radius * widthFactor;
    const radiusY = radius * heightFactor;
    
    return {
      isClosed: true,
      shapeStyle: 'circle',
      paths: [
        {
          type: 'quadratic',
          x: cx + radiusX,
          y: cy,
          controlX: cx + radiusX,
          controlY: cy - radiusY * 1.5,
          endX: cx - radiusX,
          endY: cy
        },
        {
          type: 'quadratic',
          x: cx - radiusX,
          y: cy,
          controlX: cx - radiusX,
          controlY: cy + radiusY * 1.5,
          endX: cx + radiusX,
          endY: cy
        }
      ]
    };
  };

  // Create a teardrop path - based on user-provided SVG shape
  const createTeardropPath = (cx, cy, targetLength, squeeze = 0) => {
    // The SVG shape with heightRatio=2.4 and widthRatio=1.6 has an actual
    // circumference that's about 2x the simple calculation, so we need to scale down
    const scale = (targetLength / 3) * 0.495; // Correction factor based on actual path length
    
    // Proportions from the SVG (these stay constant)
    const heightRatio = 2.4;
    const widthRatio = 1.6;
    
    // Apply squeeze: positive = taller/narrower, negative = wider/shorter
    const widthFactor = 1 - squeeze;
    const heightFactor = 1 + squeeze;
    
    const height = scale * heightRatio * heightFactor;
    const width = scale * widthRatio * widthFactor;
    
    const tipY = cy - height / 2;
    const bottomY = cy + height / 2;
    const bulgeY = cy + height * 0.15; // Bulge slightly below center
    
    return {
      isClosed: true,
      shapeStyle: 'teardrop',
      paths: [
        // Tip to right bulge - smooth outward curve
        {
          type: 'cubic',
          x: cx,
          y: tipY,
          control1X: cx + width * 0.3,
          control1Y: tipY + height * 0.15,
          control2X: cx + width * 0.5,
          control2Y: bulgeY - height * 0.1,
          endX: cx + width / 2,
          endY: bulgeY
        },
        // Right bulge to bottom - curve inward
        {
          type: 'cubic',
          x: cx + width / 2,
          y: bulgeY,
          control1X: cx + width * 0.45,
          control1Y: bulgeY + height * 0.25,
          control2X: cx + width * 0.2,
          control2Y: bottomY - height * 0.05,
          endX: cx,
          endY: bottomY
        },
        // Bottom to left bulge - curve inward (mirror)
        {
          type: 'cubic',
          x: cx,
          y: bottomY,
          control1X: cx - width * 0.2,
          control1Y: bottomY - height * 0.05,
          control2X: cx - width * 0.45,
          control2Y: bulgeY + height * 0.25,
          endX: cx - width / 2,
          endY: bulgeY
        },
        // Left bulge to tip - smooth curve (mirror)
        {
          type: 'cubic',
          x: cx - width / 2,
          y: bulgeY,
          control1X: cx - width * 0.5,
          control1Y: bulgeY - height * 0.1,
          control2X: cx - width * 0.3,
          control2Y: tipY + height * 0.15,
          endX: cx,
          endY: tipY
        }
      ]
    };
  };

  // Helper: apply element's current rotation to newly-generated path data
  const applyRotationToPathData = (el, newPathData) => {
    if (!el.rotation || el.rotation === 0) return { ...el, ...newPathData };
    const rad = el.rotation * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const cx = el.center.x, cy = el.center.y;
    const rotatePt = (px, py) => {
      const dx = px - cx, dy = py - cy;
      return { x: cx + dx*cos - dy*sin, y: cy + dx*sin + dy*cos };
    };
    newPathData.paths = newPathData.paths.map(path => {
      if (path.type === 'cubic') {
        const s = rotatePt(path.x, path.y);
        const e = rotatePt(path.endX, path.endY);
        const c1 = rotatePt(path.control1X, path.control1Y);
        const c2 = rotatePt(path.control2X, path.control2Y);
        return { ...path, x:s.x, y:s.y, endX:e.x, endY:e.y, control1X:c1.x, control1Y:c1.y, control2X:c2.x, control2Y:c2.y };
      }
      const s = rotatePt(path.x, path.y);
      const e = rotatePt(path.endX, path.endY);
      const c = rotatePt(path.controlX, path.controlY);
      return { ...path, x:s.x, y:s.y, endX:e.x, endY:e.y, controlX:c.x, controlY:c.y };
    });
    return { ...el, ...newPathData };
  };

  // ── Split ring geometry: 3 controls ──────────────────────────────────────────
  // hFrac    : 0=tallest the C shapes allow, 1=fully squashed (like pinching)
  // squeezeCA: C-shape for section A (0=almond, 0.75=default natural, 3=deep C)
  // squeezeCB: C-shape for section B (same scale)
  // Height ceiling = min(maxH_A, maxH_B) — tightest arc constraint wins.
  const splitRingMeasure = (h: number, bulge: number, c: number): number => {
    const half = h / 2;
    const x0=0, y0=half, cx1=-bulge, cy1=half*c, cx2=-bulge, cy2=-half*c, x1=0, y1=-half;
    let len=0, px=x0, py=y0;
    for(let i=1;i<=60;i++){
      const t=i/60, u=1-t;
      const nx=u*u*u*x0+3*u*u*t*cx1+3*u*t*t*cx2+t*t*t*x1;
      const ny=u*u*u*y0+3*u*u*t*cy1+3*u*t*t*cy2+t*t*t*y1;
      len+=Math.hypot(nx-px,ny-py); px=nx; py=ny;
    }
    return len;
  };

  const splitRingMaxH = (arc: number, c: number): number => {
    if(c <= 0) return arc * 0.95;
    let lo=0, hi=arc;
    while(splitRingMeasure(hi, 0, c) <= arc && hi < arc*10) hi *= 1.5;
    for(let i=0;i<24;i++){
      const mid=(lo+hi)/2;
      if(splitRingMeasure(mid, 0, c) <= arc) lo=mid; else hi=mid;
    }
    return lo;
  };

  const splitRingSolveBulge = (h: number, c: number, target: number): number => {
    if(splitRingMeasure(h, 0, c) >= target) return 0;
    let lo=0, hi=target*4;
    while(splitRingMeasure(h, hi, c) < target) hi*=2;
    for(let i=0;i<22;i++){
      const mid=(lo+hi)/2;
      if(splitRingMeasure(h, mid, c) < target) lo=mid; else hi=mid;
    }
    return (lo+hi)/2;
  };

  const createSplitRingPath = (cx: number, cy: number, totalLength: number, stitchCountA: number, stitchCountB: number, hFrac = 0, squeezeCA = 0.75, squeezeCB = 0.75) => {
    const arcA = stitchCountA * dsWidth;
    const arcB = stitchCountB * dsWidth;
    const hA = splitRingMaxH(arcA, squeezeCA);
    const hB = splitRingMaxH(arcB, squeezeCB);
    const hMax = Math.min(hA, hB);
    const hMin = hMax * 0.15;
    const h = hMax - (hMax - hMin) * hFrac;
    const topY = cy - h/2;
    const botY = cy + h/2;
    const bulgeA = splitRingSolveBulge(h, squeezeCA, arcA);
    const bulgeB = splitRingSolveBulge(h, squeezeCB, arcB);
    // Path A: (cx,botY)→(cx,topY), bulges LEFT
    const c1yA = cy + (h/2)*squeezeCA;
    const c2yA = cy - (h/2)*squeezeCA;
    // Path B: (cx,topY)→(cx,botY), bulges RIGHT — mirror
    const c1yB = cy - (h/2)*squeezeCB;
    const c2yB = cy + (h/2)*squeezeCB;
    return {
      isClosed: true,
      shapeStyle: 'split-ring',
      paths: [
        { type: 'cubic', x: cx, y: botY, control1X: cx-bulgeA, control1Y: c1yA, control2X: cx-bulgeA, control2Y: c2yA, endX: cx, endY: topY },
        { type: 'cubic', x: cx, y: topY, control1X: cx+bulgeB, control1Y: c1yB, control2X: cx+bulgeB, control2Y: c2yB, endX: cx, endY: botY },
      ],
      splitPosition: stitchCountA,
    };
  };

  // isNotationValid, expandTokens, isZeroWidth imported from ./domain/parser

  // ── Notation parser functions imported from ./domain/parser ──────────────

  // parseNotation wraps the pure function to wire in React setNotationError
  const parseNotation = (notation: string, silent = false) => {
    return parseNotationPure(notation, silent, silent ? undefined : setNotationError);
  };

  // getStitchTypes wraps the pure function to wire in the component-level cache
  const getStitchTypes = (notation: string) => {
    return getStitchTypesPure(notation, stitchTypesCacheRef.current);
  };

  const addRing = useCallback(() => {
    const center = getViewportCenter();
    const targetLength = 12 * dsWidth;
    const squeeze = 0;
    const pathData = createTeardropPath(center.x, center.y, targetLength, squeeze);
    const newEl = {
      id: generateId(),
      type: 'ring',
      materialId: lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      rotation: 0,
      stitchCount: 12,
      color: '#FFFFFF',
      picots: [{ id: generateId(), stitchesBefore: 6, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null }],
      orderNumber: null,
      notation: 'r: 6ds-p-6ds',
      labelOffset: 8,
      squeeze: squeeze,
      picotSideMultiplier: 1,
      isGhost: false,
      ghostSourceId: null,
      ...pathData
    };
    const newElements = [...elementsRef.current, newEl];
    skipAutoHistoryRef.current = true;
    setElements(newElements);
    setSelectedIds([newEl.id]);
    pushHistoryState(newElements, picotConnectionsRef.current, orderGroupsRef.current);
  }, [dsWidth, camera, zoom]);

  const addSplitRing = useCallback(() => {
    const center = getViewportCenter();
    const stitchCountA = 6;
    const stitchCountB = 6;
    const totalLength = (stitchCountA + stitchCountB) * dsWidth;
    const squeeze = 0.25;
    const pathData = createSplitRingPath(center.x, center.y, totalLength, stitchCountA, stitchCountB, 0.25, 0.75, 0.75);
    const newEl = {
      id: generateId(),
      type: 'ring',
      center: { x: center.x, y: center.y },
      rotation: 0,
      stitchCount: stitchCountA + stitchCountB,
      color: '#FFFFFF',
      picots: [
        { id: generateId(), stitchesBefore: 3, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null },
        { id: generateId(), stitchesBefore: 9, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null }
      ],
      orderNumber: null,
      notation: 'sr: 3ds-p-3ds',
      notationB: '3ds-p-3ds',
      labelOffset: 8,
      squeeze: 0.25,
      squeezeCA: 0.75,
      squeezeCB: 0.75,
      picotSideMultiplier: 1,
      isSplitRing: true,
      materialId: lastUsedMaterialIdRef.current,
      isGhost: false,
      ghostSourceId: null,
      ...pathData
    };
    const newElements = [...elementsRef.current, newEl];
    skipAutoHistoryRef.current = true;
    setElements(newElements);
    setSelectedIds([newEl.id]);
    pushHistoryState(newElements, picotConnectionsRef.current, orderGroupsRef.current);
  }, [dsWidth, camera, zoom]);

  // Apply curve type transformation to a path for rendering
  // Takes a quadratic path and returns cubic control points based on curve type
  // REMOVED: applyCurveType function - doesn't work with length constraint and fixed endpoints
  // Now using direct cubic bezier control instead

  const addChain = useCallback(() => {
    const center = getViewportCenter();
    const stitchCount = 12;
    // Chord length derived from stitch count — arc will be slightly longer due to the curve lift,
    // so use 0.92 factor to keep the rendered arc close to stitchCount * dsWidth
    const chord = stitchCount * dsWidth * 0.92;
    const halfChord = chord / 2;
    // Gentle arc: lift control points by 1/5 of chord
    const arcLift = chord / 5;
    const startX = center.x - halfChord;
    const startY = center.y;
    const endX = center.x + halfChord;
    const endY = center.y;
    const newEl = {
      id: generateId(),
      type: 'chain',
      materialId: lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      isClosed: false,
      shapeStyle: 'chain',
      paths: [{
        type: 'cubic',
        x: startX, y: startY,
        control1X: startX + chord / 3, control1Y: startY - arcLift,
        control2X: startX + chord * 2 / 3, control2Y: startY - arcLift,
        endX: endX, endY: endY
      }],
      stitchCount,
      color: '#FFFFFF',
      picots: [{ id: generateId(), stitchesBefore: 6, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null }],
      notation: 'c: 6ds-p-6ds',
      labelOffset: 8,
      picotSideMultiplier: 1,
      isGhost: false,
      ghostSourceId: null
    };
    const newElements = [...elementsRef.current, newEl];
    skipAutoHistoryRef.current = true;
    setElements(newElements);
    setSelectedIds([newEl.id]);
    pushHistoryState(newElements, picotConnectionsRef.current, orderGroupsRef.current);
  }, [dsWidth, camera, zoom]);

  const showLoadMsg = (type, text) => {
    setLoadMsg({ type, text });
    setTimeout(() => setLoadMsg(null), 4000);
  };

  // Clipboard helper — navigator.clipboard is blocked in some WebViews (e.g. Tauri Android)
  // Falls back to execCommand which works everywhere
  const copyToClipboard = (text: string, elementCount?: number) => {
    const successMsg = elementCount != null
      ? `${t('notationCopied')} (${elementCount} elements)`
      : t('notationCopied');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showLoadMsg('success', successMsg);
      }).catch(() => {
        // Fallback
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showLoadMsg('success', successMsg);
        } catch {
          showLoadMsg('error', t('notationCopyFailed'));
        }
      });
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showLoadMsg('success', successMsg);
      } catch {
        showLoadMsg('error', t('notationCopyFailed'));
      }
    }
  };

  const addLine = useCallback(() => {
    const center = getViewportCenter();
    const startX = center.x - 100;
    const startY = center.y;
    const endX = center.x + 100;
    const endY = center.y;
    
    // Create straight line (cubic bezier with control points on the line)
    const control1X = startX + (endX - startX) * 0.33;
    const control1Y = startY + (endY - startY) * 0.33;
    const control2X = startX + (endX - startX) * 0.67;
    const control2Y = startY + (endY - startY) * 0.67;
    
    setElements(prev => [...prev, {
      id: generateId(),
      type: 'line',
      materialId: lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      isClosed: false,
      paths: [{
        type: 'cubic',
        x: startX,
        y: startY,
        control1X: control1X,
        control1Y: control1Y,
        control2X: control2X,
        control2Y: control2Y,
        endX: endX,
        endY: endY
      }],
      color: '#FFFFFF',
      notation: 'line',
      lineWidth: 2 // Line stroke width
    }]);
  }, [camera, zoom]); // Dependencies: camera/zoom for viewport center

  const deleteSelected = useCallback(() => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length === 0) return;
    setElements(prev => prev.filter(e => !currentSelectedIds.includes(e.id)));
    setSelectedIds([]);
    // Remove any picot connections that reference a picot on a deleted element
    setPicotConnections(prev => prev.filter(conn =>
      !conn.picots.some(p => currentSelectedIds.includes(p.elementId))
    ));
  }, []); // No dependencies - uses refs

  // Get bounds of a single element
  const getElementBounds = (el) => {
    if (el.isClosed && el.shapeStyle === 'circle') {
      const targetCircumference = el.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      return {
        left: el.center.x - radius,
        right: el.center.x + radius,
        top: el.center.y - radius,
        bottom: el.center.y + radius,
        centerX: el.center.x,
        centerY: el.center.y,
        width: radius * 2,
        height: radius * 2
      };
    } else {
      // Path-based elements
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      el.paths.forEach(path => {
        const points = sampleBezierPath(path, 20);
        points.forEach(pt => {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        });
      });
      return {
        left: minX,
        right: maxX,
        top: minY,
        bottom: maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        width: maxX - minX,
        height: maxY - minY
      };
    }
  };

  // Move element by offset
  const moveElement = (el, dx, dy) => {
    if (el.isClosed && el.shapeStyle === 'circle') {
      return {
        ...el,
        center: { x: el.center.x + dx, y: el.center.y + dy }
      };
    } else {
      // Move paths
      return {
        ...el,
        center: { x: el.center.x + dx, y: el.center.y + dy },
        paths: el.paths.map(path => ({
          ...path,
          x: path.x + dx,
          y: path.y + dy,
          endX: path.endX + dx,
          endY: path.endY + dy,
          control1X: path.control1X ? path.control1X + dx : undefined,
          control1Y: path.control1Y ? path.control1Y + dy : undefined,
          control2X: path.control2X ? path.control2X + dx : undefined,
          control2Y: path.control2Y ? path.control2Y + dy : undefined,
          controlX: path.controlX ? path.controlX + dx : undefined,
          controlY: path.controlY ? path.controlY + dy : undefined
        }))
      };
    }
  };

  // Alignment functions
  const getAlignmentUnits = () => {
    const selectedElements = elements.filter(e => selectedIds.includes(e.id));
    const unitMap = new Map();
    selectedElements.forEach(el => {
      if (el.groupId) {
        if (!unitMap.has(el.groupId)) unitMap.set(el.groupId, { ids: [], bounds: null });
        const unit = unitMap.get(el.groupId);
        unit.ids.push(el.id);
        const b = getElementBounds(el);
        if (!unit.bounds) { unit.bounds = { ...b }; }
        else {
          unit.bounds.left   = Math.min(unit.bounds.left,   b.left);
          unit.bounds.right  = Math.max(unit.bounds.right,  b.right);
          unit.bounds.top    = Math.min(unit.bounds.top,    b.top);
          unit.bounds.bottom = Math.max(unit.bounds.bottom, b.bottom);
          unit.bounds.centerX = (unit.bounds.left + unit.bounds.right) / 2;
          unit.bounds.centerY = (unit.bounds.top  + unit.bounds.bottom) / 2;
        }
      } else {
        unitMap.set('__solo__' + el.id, { ids: [el.id], bounds: getElementBounds(el) });
      }
    });
    return [...unitMap.values()];
  };

  const alignLeft = () => {
    if (selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = Math.min(...units.map(u => u.bounds.left));
    setElements(prev => prev.map(el => { const unit = units.find(u => u.ids.includes(el.id)); if (!unit) return el; return moveElement(el, target - unit.bounds.left, 0); }));
  };

  const alignRight = () => {
    if (selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = Math.max(...units.map(u => u.bounds.right));
    setElements(prev => prev.map(el => { const unit = units.find(u => u.ids.includes(el.id)); if (!unit) return el; return moveElement(el, target - unit.bounds.right, 0); }));
  };

  const alignTop = () => {
    if (selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = Math.min(...units.map(u => u.bounds.top));
    setElements(prev => prev.map(el => { const unit = units.find(u => u.ids.includes(el.id)); if (!unit) return el; return moveElement(el, 0, target - unit.bounds.top); }));
  };

  const alignBottom = () => {
    if (selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = Math.max(...units.map(u => u.bounds.bottom));
    setElements(prev => prev.map(el => { const unit = units.find(u => u.ids.includes(el.id)); if (!unit) return el; return moveElement(el, 0, target - unit.bounds.bottom); }));
  };

  const alignCenterHorizontal = () => {
    if (selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = units.reduce((sum, u) => sum + u.bounds.centerX, 0) / units.length;
    setElements(prev => prev.map(el => { const unit = units.find(u => u.ids.includes(el.id)); if (!unit) return el; return moveElement(el, target - unit.bounds.centerX, 0); }));
  };

  const alignCenterVertical = () => {
    if (selectedIds.length < 2) return;
    const units = getAlignmentUnits();
    if (units.length < 2) return;
    const target = units.reduce((sum, u) => sum + u.bounds.centerY, 0) / units.length;
    setElements(prev => prev.map(el => { const unit = units.find(u => u.ids.includes(el.id)); if (!unit) return el; return moveElement(el, 0, target - unit.bounds.centerY); }));
  };

  const alignToGridHorizontal = (gridId = null) => {
    if (selectedIds.length === 0 || polarGrids.length === 0) return;
    const findGrid = () => { if (gridId) return polarGrids.find(g => g.id === gridId); const linkedId = (() => { for (const id of selectedIds) { const el = elements.find(e => e.id === id); if (el?.polarRotationGridId) return el.polarRotationGridId; } return null; })(); if (linkedId) return polarGrids.find(g => g.id === linkedId); return polarGrids.find(g => g.visible) || polarGrids[0]; };
    const grid = findGrid(); if (!grid) return;
    const allBounds = elements.filter(e => selectedIds.includes(e.id)).map(el => getElementBounds(el));
    const selCenterX = (Math.min(...allBounds.map(b => b.left)) + Math.max(...allBounds.map(b => b.right))) / 2;
    const dx = grid.center.x - selCenterX;
    if (Math.abs(dx) < 0.01) return;
    setElements(prev => prev.map(el => selectedIds.includes(el.id) ? moveElement(el, dx, 0) : el));
  };

  const alignToGridVertical = (gridId = null) => {
    if (selectedIds.length === 0 || polarGrids.length === 0) return;
    const findGrid = () => { if (gridId) return polarGrids.find(g => g.id === gridId); const linkedId = (() => { for (const id of selectedIds) { const el = elements.find(e => e.id === id); if (el?.polarRotationGridId) return el.polarRotationGridId; } return null; })(); if (linkedId) return polarGrids.find(g => g.id === linkedId); return polarGrids.find(g => g.visible) || polarGrids[0]; };
    const grid = findGrid(); if (!grid) return;
    const allBounds = elements.filter(e => selectedIds.includes(e.id)).map(el => getElementBounds(el));
    const selCenterY = (Math.min(...allBounds.map(b => b.top)) + Math.max(...allBounds.map(b => b.bottom))) / 2;
    const dy = grid.center.y - selCenterY;
    if (Math.abs(dy) < 0.01) return;
    setElements(prev => prev.map(el => selectedIds.includes(el.id) ? moveElement(el, 0, dy) : el));
  };

  // Center all selected elements to a polar grid's center point.
  // Computes the bounding-box centroid of the whole selection, then shifts every
  // element by the same delta so that centroid lands exactly on the grid center.
  // All relative positions are preserved — the group moves as one rigid body.
  const centerToPolarGrid = (gridId = null) => {
    if (selectedIds.length === 0 || polarGrids.length === 0) return;

    // Choose the target grid:
    //  1. Explicit gridId passed (for per-grid buttons if ever needed)
    //  2. The grid that the selected elements are already linked to (polarRotationGridId)
    //  3. First visible grid
    //  4. First grid (fallback)
    const findGrid = () => {
      if (gridId) return polarGrids.find(g => g.id === gridId);
      const linkedId = (() => {
        for (const id of selectedIds) {
          const el = elements.find(e => e.id === id);
          if (el?.polarRotationGridId) return el.polarRotationGridId;
        }
        return null;
      })();
      if (linkedId) return polarGrids.find(g => g.id === linkedId);
      return polarGrids.find(g => g.visible) || polarGrids[0];
    };

    const grid = findGrid();
    if (!grid) return;

    const selectedEls = elements.filter(e => selectedIds.includes(e.id));

    // Compute the combined bounding box centroid of the whole selection
    const allBounds = selectedEls.map(el => getElementBounds(el));
    const minX = Math.min(...allBounds.map(b => b.left));
    const maxX = Math.max(...allBounds.map(b => b.right));
    const minY = Math.min(...allBounds.map(b => b.top));
    const maxY = Math.max(...allBounds.map(b => b.bottom));
    const selCenterX = (minX + maxX) / 2;
    const selCenterY = (minY + maxY) / 2;

    const dx = grid.center.x - selCenterX;
    const dy = grid.center.y - selCenterY;

    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return; // already centered

    setElements(prev => prev.map(el =>
      selectedIds.includes(el.id) ? moveElement(el, dx, dy) : el
    ));
  };

  // Apply group rotation from input field
  const applyMultiSelectRotationDelta = (delta) => {
    if (selectedIds.length < 2) return;
    if (delta === 0) return;
    const selEls = elements.filter(e => selectedIds.includes(e.id));
    const polarPivot = getPolarPivot(selectedIds);
    const centerX = polarPivot ? polarPivot.x : selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
    const centerY = polarPivot ? polarPivot.y : selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;
    const rad = delta * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    setElements(prev => prev.map(el => {
      if (!selectedIds.includes(el.id)) return el;
      const dx = el.center.x - centerX, dy = el.center.y - centerY;
      const newCenterX = centerX + dx * cos - dy * sin;
      const newCenterY = centerY + dx * sin + dy * cos;
      const newRotation = ((el.rotation || 0) + delta) % 360;

      // Split rings & teardrops: regenerate path at new center + apply rotation
      if (el.isSplitRing && el.splitPosition) {
        const pathData = createSplitRingPath(newCenterX, newCenterY, el.stitchCount * dsWidth, el.splitPosition, el.stitchCount - el.splitPosition, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
        const r = newRotation * Math.PI / 180, rc = Math.cos(r), rs = Math.sin(r);
        const rot = (px, py) => { const pdx = px - newCenterX, pdy = py - newCenterY; return { x: newCenterX + pdx*rc - pdy*rs, y: newCenterY + pdx*rs + pdy*rc }; };
        const newPaths = pathData.paths.map(path => {
          const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), c1 = rot(path.control1X, path.control1Y), c2 = rot(path.control2X, path.control2Y);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
        });
        return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: ((newRotation % 360) + 360) % 360 };
      }
      if (el.type === 'ring' && (el.shapeStyle === 'teardrop' || (el.squeeze !== undefined && el.squeeze > 0))) {
        const pathData = createTeardropPath(newCenterX, newCenterY, el.stitchCount * dsWidth, el.squeeze ?? 0);
        const r = newRotation * Math.PI / 180, rc = Math.cos(r), rs = Math.sin(r);
        const rot = (px, py) => { const pdx = px - newCenterX, pdy = py - newCenterY; return { x: newCenterX + pdx*rc - pdy*rs, y: newCenterY + pdx*rs + pdy*rc }; };
        const newPaths = pathData.paths.map(path => {
          if (path.type === 'cubic') {
            const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), c1 = rot(path.control1X, path.control1Y), c2 = rot(path.control2X, path.control2Y);
            return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
          } else {
            const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), ctrl = rot(path.controlX, path.controlY);
            return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
          }
        });
        return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: ((newRotation % 360) + 360) % 360 };
      }
      // Chains & circle rings: rotate path points around global centroid
      const rotatePt = (px, py) => { const pdx = px - centerX, pdy = py - centerY; return { x: centerX + pdx*cos - pdy*sin, y: centerY + pdx*sin + pdy*cos }; };
      const newPaths = el.paths.map(path => {
        if (path.type === 'cubic') {
          const s = rotatePt(path.x, path.y), e2 = rotatePt(path.endX, path.endY), c1 = rotatePt(path.control1X, path.control1Y), c2 = rotatePt(path.control2X, path.control2Y);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
        } else {
          const s = rotatePt(path.x, path.y), e2 = rotatePt(path.endX, path.endY), ctrl = rotatePt(path.controlX, path.controlY);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
        }
      });
      return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: ((newRotation % 360) + 360) % 360 };
    }));
  };

  // Rotate a single selected element by an arbitrary delta — used by ±1° nudge buttons
  // and can be reused by any other single-element rotation trigger.
  const applySingleRotationDelta = useCallback((elId: string, delta: number) => {
    if (delta === 0) return;
    const rad = delta * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    setElements(prev => prev.map(el => {
      if (el.id !== elId) return el;
      const polarPivot = getPolarPivot([el.id]);
      const pivot = polarPivot || getElementPivot(el);
      const cx = pivot.x, cy = pivot.y;
      const rotatePt = (px, py) => {
        const dx = px - cx, dy = py - cy;
        return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
      };
      const newPaths = el.paths.map(path => {
        if (path.type === 'cubic') {
          const s = rotatePt(path.x, path.y), e2 = rotatePt(path.endX, path.endY);
          const c1 = rotatePt(path.control1X, path.control1Y), c2 = rotatePt(path.control2X, path.control2Y);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
        } else {
          const s = rotatePt(path.x, path.y), e2 = rotatePt(path.endX, path.endY), ctrl = rotatePt(path.controlX, path.controlY);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
        }
      });
      const newRotation = (el.rotation || 0) + delta;
      const newPivot = polarPivot
        ? { x: pivot.x + (el.center.x - pivot.x) * cos - (el.center.y - pivot.y) * sin, y: pivot.y + (el.center.x - pivot.x) * sin + (el.center.y - pivot.y) * cos }
        : getElementPivot({ ...el, paths: newPaths });
      return { ...el, paths: newPaths, rotation: newRotation, center: { x: newPivot.x, y: newPivot.y } };
    }));
    needsHistoryPushRef.current = true;
  }, []);

  // PERFORMANCE: O(1) element lookup by id — replaces elements.find(e => e.id === x) everywhere
  // Defined early because it is used in event handlers and callbacks throughout the component.
  const elementById = useMemo(() => new Map(elements.map(e => [e.id, e])), [elements]);

  // PERFORMANCE: O(1) material lookup by id — getElementColor calls materials.find() on every
  // element every render. This map makes it O(1) and speeds up stitchCache builds too.
  const materialsById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);

  const applyGroupRotation = (targetRotation) => {
    if (selectedIds.length === 0) return;
    
    const firstElement = elementById.get(selectedIds[0]);
    if (!firstElement || !firstElement.groupId) return;
    
    const groupElements = elements.filter(e => e.groupId === firstElement.groupId);
    if (groupElements.length <= 1) return;
    
    const currentRotation = groupElements[0]?.rotation || 0;
    const delta = targetRotation - currentRotation;
    
    if (delta === 0) return;
    
    const rad = delta * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Calculate group center (or polar pivot if set)
    const polarPivot = getPolarPivot(selectedIds);
    const groupCenterX = polarPivot ? polarPivot.x : groupElements.reduce((sum, el) => sum + el.center.x, 0) / groupElements.length;
    const groupCenterY = polarPivot ? polarPivot.y : groupElements.reduce((sum, el) => sum + el.center.y, 0) / groupElements.length;

    setElements(prev => prev.map(el => {
      if (!selectedIds.includes(el.id)) return el;

      // Rotate element center around group center
      const dx = el.center.x - groupCenterX;
      const dy = el.center.y - groupCenterY;
      const newCenterX = groupCenterX + dx * cos - dy * sin;
      const newCenterY = groupCenterY + dx * sin + dy * cos;
      
      // Update rotation value for ALL elements
      const newRotation = ((el.rotation || 0) + delta) % 360;
      
      // For teardrop rings or squeezed circles, regenerate paths instead of rotating them
      let newPaths;
      if (el.type === 'ring' && (el.shapeStyle === 'teardrop' || el.shapeStyle === 'split-ring' || (el.squeeze !== undefined && el.squeeze > 0))) {
        // Regenerate path based on new rotation
        const targetLength = el.stitchCount * dsWidth;
        const squeeze = el.squeeze !== undefined ? el.squeeze : 0;
        
        let pathData;
        if (el.isSplitRing && el.splitPosition) {
          const stitchCountA = el.splitPosition;
          const stitchCountB = el.stitchCount - stitchCountA;
          pathData = createSplitRingPath(newCenterX, newCenterY, targetLength, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
        } else {
          pathData = createTeardropPath(newCenterX, newCenterY, targetLength, squeeze);
        }
        
        newPaths = pathData.paths; // Extract paths array from returned object
        
        // Apply the element's rotation by rotating the regenerated paths
        if (newRotation !== 0) {
          const elemRad = newRotation * Math.PI / 180;
          const elemCos = Math.cos(elemRad);
          const elemSin = Math.sin(elemRad);
          
          newPaths = newPaths.map(path => {
            const rotatePoint = (px, py) => {
              const pdx = px - newCenterX;
              const pdy = py - newCenterY;
              return {
                x: newCenterX + pdx * elemCos - pdy * elemSin,
                y: newCenterY + pdx * elemSin + pdy * elemCos
              };
            };
            
            if (path.type === 'cubic') {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const c1 = rotatePoint(path.control1X, path.control1Y);
              const c2 = rotatePoint(path.control2X, path.control2Y);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                control1X: c1.x, control1Y: c1.y,
                control2X: c2.x, control2Y: c2.y
              };
            } else {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const ctrl = rotatePoint(path.controlX, path.controlY);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                controlX: ctrl.x, controlY: ctrl.y
              };
            }
          });
        }
      } else {
        // For chains and circles, rotate path points around group center
        newPaths = el.paths.map(path => {
          const rotatePoint = (px, py) => {
            const pdx = px - groupCenterX;
            const pdy = py - groupCenterY;
            return {
              x: groupCenterX + pdx * cos - pdy * sin,
              y: groupCenterY + pdx * sin + pdy * cos
            };
          };
          
          if (path.type === 'cubic') {
            const start = rotatePoint(path.x, path.y);
            const end = rotatePoint(path.endX, path.endY);
            const c1 = rotatePoint(path.control1X, path.control1Y);
            const c2 = rotatePoint(path.control2X, path.control2Y);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              control1X: c1.x, control1Y: c1.y,
              control2X: c2.x, control2Y: c2.y
            };
          } else {
            const start = rotatePoint(path.x, path.y);
            const end = rotatePoint(path.endX, path.endY);
            const ctrl = rotatePoint(path.controlX, path.controlY);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              controlX: ctrl.x, controlY: ctrl.y
            };
          }
        });
      }
      
      return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: newRotation };
    }));
    
    // Clear input after applying
    setGroupRotationInput('');
  };

  const groupSelected = useCallback(() => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length < 2) return; // Need at least 2 elements to group
    
    const groupId = generateId(); // Unique group ID
    
    setElements(prev => prev.map(el => 
      currentSelectedIds.includes(el.id) ? { ...el, groupId } : el
    ));
    
  }, []); // No dependencies - uses refs

  const ungroupSelected = useCallback(() => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length === 0) return;
    
    setElements(prev => prev.map(el => {
      if (currentSelectedIds.includes(el.id)) {
        const { groupId, ...rest } = el; // Remove groupId property
        return rest;
      }
      return el;
    }));
    
  }, []); // No dependencies - uses refs

  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = currentIndex - 1;
      const state = currentHistory[newIndex];
      setHistoryIndex(newIndex);
      setElements(JSON.parse(JSON.stringify(state.elements)));
      setPicotConnections(JSON.parse(JSON.stringify(state.connections)));
      if (state.orderGroups) setOrderGroups(JSON.parse(JSON.stringify(state.orderGroups)));
      setTimeout(() => { isUndoRedoRef.current = false; }, 0);
    }
  }, []); // No dependencies - uses refs

  const redo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex < currentHistory.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = currentIndex + 1;
      const state = currentHistory[newIndex];
      setHistoryIndex(newIndex);
      setElements(JSON.parse(JSON.stringify(state.elements)));
      setPicotConnections(JSON.parse(JSON.stringify(state.connections)));
      if (state.orderGroups) setOrderGroups(JSON.parse(JSON.stringify(state.orderGroups)));
      setTimeout(() => { isUndoRedoRef.current = false; }, 0);
    }
  }, []); // No dependencies - uses refs

  // Copy selected elements to clipboard
  const copySelected = () => {
    if (selectedIds.length > 0) {
      const selectedElements = elements.filter(el => selectedIds.includes(el.id));
      const cloned = JSON.parse(JSON.stringify(selectedElements)); // Deep clone
      setClipboard(cloned);
    }
  };

  // Cut selected elements (normal mode): copy to clipboard then delete.
  const cutSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedElements = elements.filter(el => selectedIds.includes(el.id));
    setClipboard(JSON.parse(JSON.stringify(selectedElements)));
    setElements(prev => prev.filter(e => !selectedIds.includes(e.id)));
    setSelectedIds([]);
  };

  // Paste elements from clipboard with offset — canonical paste implementation.
  // Ctrl+V keyboard shortcut calls this directly so behaviour is always identical.
  const pasteFromClipboard = useCallback(() => {
    const currentClipboard = clipboard;
    if (currentClipboard.length === 0) return;

    const offset = 30;

    // Map old groupIds → new groupIds
    const groupIdMap = new Map();
    currentClipboard.forEach(el => {
      if (el.groupId && !groupIdMap.has(el.groupId)) {
        groupIdMap.set(el.groupId, generateId());
      }
    });

    // Map old element IDs → new element IDs (needed to remap picot connections)
    const elementIdMap = new Map();

    const newElements = currentClipboard.map(el => {
      const newEl = JSON.parse(JSON.stringify(el));
      const newId = generateId();
      elementIdMap.set(el.id, newId);
      newEl.id = newId;

      if (el.groupId) newEl.groupId = groupIdMap.get(el.groupId);

      // Offset position
      newEl.center.x += offset;
      newEl.center.y += offset;

      // Offset all path coordinates
      if (newEl.paths) {
        newEl.paths = newEl.paths.map(path => {
          const p = { ...path };
          p.x += offset;
          p.y += offset;
          if (path.endX  !== undefined) { p.endX  += offset; p.endY  += offset; }
          if (path.controlX  !== undefined) { p.controlX  += offset; p.controlY  += offset; }
          if (path.control1X !== undefined) { p.control1X += offset; p.control1Y += offset; }
          if (path.control2X !== undefined) { p.control2X += offset; p.control2Y += offset; }
          return p;
        });
      }

      // Clear order number to avoid conflicts
      delete newEl.orderNumber;
      return newEl;
    });

    // Preserve picot connections — but only for connections where ALL referenced
    // elements are in the clipboard (cross-clipboard connections make no sense).
    const clipboardIds = new Set(currentClipboard.map(el => el.id));
    const relevantConnections = picotConnectionsRef.current.filter(conn =>
      conn.picots.every(p => clipboardIds.has(p.elementId))
    );
    const newConnections = relevantConnections.map(conn => ({
      id: generateId(),
      picots: conn.picots.map(p => ({
        elementId: elementIdMap.get(p.elementId),
        picotId: p.picotId,
      })),
    }));

    setElements(prev => [...prev, ...newElements]);
    setPicotConnections(prev => [...prev, ...newConnections]);
    setSelectedIds(newElements.map(el => el.id));
  }, [clipboard]); // clipboard from state; picotConnections read via ref (always current)

  // Duplicate in place (no offset) - for creating flower patterns
  const duplicateInPlace = () => {
    const currentSelectedIds = selectedIdsRef.current;
    const currentElements = elementsRef.current;
    if (currentSelectedIds.length === 0) return;

    const selectedElements = currentElements.filter(e => currentSelectedIds.includes(e.id));
    const groupIdMap = new Map();
    selectedElements.forEach(el => {
      if (el.groupId && !groupIdMap.has(el.groupId)) {
        groupIdMap.set(el.groupId, generateId());
      }
    });
    
    const newElements = selectedElements.map(el => {
      const newEl = JSON.parse(JSON.stringify(el)); // Deep clone
      newEl.id = generateId();
      
      if (el.groupId) {
        newEl.groupId = groupIdMap.get(el.groupId);
      }
      
      // NO offset - duplicate in place!
      
      // Clear order number to avoid conflicts
      delete newEl.orderNumber;
      
      return newEl;
    });
    
    setElements(prev => [...prev, ...newElements]);
    setSelectedIds(newElements.map(el => el.id));
  };

  // Polar Array — duplicate selected elements N times evenly around a pivot point.
  // count = total copies INCLUDING the original. fillAngle = arc to fill (360 = full circle).
  const executePolarArray = (count: number, fillAngle: number, pivotId: string | 'selection' | null, createGhosts: boolean = false) => {
    const currentSelectedIds = selectedIdsRef.current;
    const currentElements = elementsRef.current;
    if (currentSelectedIds.length === 0 || count < 2) return;

    const selectedEls = currentElements.filter(e => currentSelectedIds.includes(e.id));

    // Determine pivot point
    let pivotX: number, pivotY: number;
    if (pivotId && pivotId !== 'selection') {
      const grid = polarGrids.find(g => g.id === pivotId);
      pivotX = grid ? grid.center.x : selectedEls.reduce((s, e) => s + e.center.x, 0) / selectedEls.length;
      pivotY = grid ? grid.center.y : selectedEls.reduce((s, e) => s + e.center.y, 0) / selectedEls.length;
    } else {
      pivotX = selectedEls.reduce((s, e) => s + e.center.x, 0) / selectedEls.length;
      pivotY = selectedEls.reduce((s, e) => s + e.center.y, 0) / selectedEls.length;
    }

    const stepDeg = fillAngle / count;
    const newElements = [];

    // Start from copy #1 (original stays as-is), generate copies 1..count-1
    for (let i = 1; i < count; i++) {
      const angleDeg = stepDeg * i;
      const rad = angleDeg * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Build groupId mapping so each copy's group integrity is preserved
      const groupIdMap = new Map<string, string>();
      selectedEls.forEach(el => {
        if (el.groupId && !groupIdMap.has(el.groupId)) {
          groupIdMap.set(el.groupId, generateId());
        }
      });

      selectedEls.forEach(el => {
        const newEl = JSON.parse(JSON.stringify(el));
        newEl.id = generateId();
        delete newEl.orderNumber;

        // Remap group id
        if (el.groupId) newEl.groupId = groupIdMap.get(el.groupId);

        // Link to the chosen polar grid
        if (pivotId && pivotId !== 'selection') newEl.polarRotationGridId = pivotId;

        // Mark as ghost if requested
        if (createGhosts) {
          newEl.isGhost = true;
          newEl.ghostSourceId = el.id;
        }

        // Rotate center around pivot
        const dx = el.center.x - pivotX;
        const dy = el.center.y - pivotY;
        newEl.center = {
          x: pivotX + dx * cos - dy * sin,
          y: pivotY + dx * sin + dy * cos,
        };

        // Rotate element's own rotation angle
        newEl.rotation = ((el.rotation || 0) + angleDeg) % 360;

        // Rotate path control points if present
        if (newEl.paths) {
          newEl.paths = newEl.paths.map(p => {
            const rotPt = (px, py) => {
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

        newElements.push(newEl);
      });
    }

    // Also link originals to the chosen grid if a grid was selected
    if (pivotId && pivotId !== 'selection') {
      setElements(prev => [
        ...prev.map(el => currentSelectedIds.includes(el.id) ? { ...el, polarRotationGridId: pivotId } : el),
        ...newElements,
      ]);
    } else {
      setElements(prev => [...prev, ...newElements]);
    }

    // Select all — originals + new copies
    setSelectedIds([...currentSelectedIds, ...newElements.map(e => e.id)]);
  };

  // Linear Array — duplicate N times along a direction with optional per-step rotation.
  // Helper: rotate an element's baked path points around a center by deltaDeg degrees.
  // For split rings and teardrops, regenerates paths from scratch then applies absolute rotation.
  // Returns new paths array.
  const rotatePathsAroundCenter = (paths, cx: number, cy: number, deltaDeg: number, el?: any, absoluteRot?: number) => {
    if (!paths || deltaDeg === 0) return paths;
    // For split rings: regenerate at new center with absolute rotation
    if (el?.isSplitRing && el?.splitPosition !== undefined && absoluteRot !== undefined) {
      const pathData = createSplitRingPath(cx, cy, el.stitchCount * dsWidth, el.splitPosition, el.stitchCount - el.splitPosition, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
      const r = absoluteRot * Math.PI / 180, rc = Math.cos(r), rs = Math.sin(r);
      const rot = (px, py) => { const dx = px - cx, dy = py - cy; return { x: cx + dx*rc - dy*rs, y: cy + dx*rs + dy*rc }; };
      return pathData.paths.map(p => { const s = rot(p.x, p.y), e2 = rot(p.endX, p.endY), c1 = rot(p.control1X, p.control1Y), c2 = rot(p.control2X, p.control2Y); return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y }; });
    }
    // For teardrops: regenerate at new center with absolute rotation
    if (el?.type === 'ring' && (el?.shapeStyle === 'teardrop' || (el?.squeeze !== undefined && el?.squeeze > 0)) && absoluteRot !== undefined) {
      const pathData = createTeardropPath(cx, cy, el.stitchCount * dsWidth, el.squeeze ?? 0);
      const r = absoluteRot * Math.PI / 180, rc = Math.cos(r), rs = Math.sin(r);
      const rot = (px, py) => { const dx = px - cx, dy = py - cy; return { x: cx + dx*rc - dy*rs, y: cy + dx*rs + dy*rc }; };
      return pathData.paths.map(p => {
        if (p.type === 'cubic') { const s = rot(p.x, p.y), e2 = rot(p.endX, p.endY), c1 = rot(p.control1X, p.control1Y), c2 = rot(p.control2X, p.control2Y); return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y }; }
        else { const s = rot(p.x, p.y), e2 = rot(p.endX, p.endY), c = rot(p.controlX, p.controlY); return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: c.x, controlY: c.y }; }
      });
    }
    // Chains, circle rings, lines: rotate baked path points by delta around cx/cy
    const rad = deltaDeg * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rotPt = (px, py) => {
      const dx = px - cx, dy = py - cy;
      return { x: cx + dx*cos - dy*sin, y: cy + dx*sin + dy*cos };
    };
    return paths.map(p => {
      if (p.type === 'cubic') {
        const s = rotPt(p.x, p.y), e2 = rotPt(p.endX, p.endY);
        const c1 = rotPt(p.control1X, p.control1Y), c2 = rotPt(p.control2X, p.control2Y);
        return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
      } else {
        const s = rotPt(p.x, p.y), e2 = rotPt(p.endX, p.endY), c = rotPt(p.controlX, p.controlY);
        return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: c.x, controlY: c.y };
      }
    });
  };

  const executeLinearArray = (count: number, angleDeg: number, spacingPercent: number, rotStep: number, createGhosts: boolean = false) => {
    const currentSelectedIds = selectedIdsRef.current;
    const currentElements = elementsRef.current;
    if (currentSelectedIds.length === 0 || count < 2) return;
    const selectedEls = currentElements.filter(e => currentSelectedIds.includes(e.id));
    
    // TODO: Bounding box calculation doesn't account for rotation or path transformations.
    // For rotated elements, bbox should use transformed path points, not raw coordinates.
    // Current workaround: uses max of width/height, but may be inaccurate for rotated elements.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedEls.forEach(el => {
      if (el.paths && el.paths.length > 0) {
        el.paths.forEach(p => {
          minX = Math.min(minX, p.x, p.endX, p.control1X ?? p.controlX, p.control2X ?? p.controlX);
          maxX = Math.max(maxX, p.x, p.endX, p.control1X ?? p.controlX, p.control2X ?? p.controlX);
          minY = Math.min(minY, p.y, p.endY, p.control1Y ?? p.controlY, p.control2Y ?? p.controlY);
          maxY = Math.max(maxY, p.y, p.endY, p.control1Y ?? p.controlY, p.control2Y ?? p.controlY);
        });
      } else {
        minX = Math.min(minX, el.center.x);
        maxX = Math.max(maxX, el.center.x);
        minY = Math.min(minY, el.center.y);
        maxY = Math.max(maxY, el.center.y);
      }
    });
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    const elementSize = Math.max(bboxWidth, bboxHeight, 1); // At least 1px
    
    // Calculate actual spacing from percentage
    const spacing = (spacingPercent / 100) * elementSize;
    
    const rad = angleDeg * Math.PI / 180;
    const dx = Math.cos(rad) * spacing;
    const dy = Math.sin(rad) * spacing;
    const newElements = [];
    for (let i = 1; i < count; i++) {
      const offsetX = dx * i;
      const offsetY = dy * i;
      const extraRot = rotStep * i;
      const groupIdMap = new Map<string, string>();
      selectedEls.forEach(el => { if (el.groupId && !groupIdMap.has(el.groupId)) groupIdMap.set(el.groupId, generateId()); });
      selectedEls.forEach(el => {
        const newEl = JSON.parse(JSON.stringify(el));
        newEl.id = generateId();
        delete newEl.orderNumber;
        if (el.groupId) newEl.groupId = groupIdMap.get(el.groupId);
        
        // Mark as ghost if requested
        if (createGhosts) {
          newEl.isGhost = true;
          newEl.ghostSourceId = el.id;
        }
        
        const newCx = el.center.x + offsetX;
        const newCy = el.center.y + offsetY;
        newEl.center = { x: newCx, y: newCy };
        // Translate paths to new position first
        if (newEl.paths) {
          newEl.paths = newEl.paths.map(p => {
            if (p.type === 'cubic') {
              return { ...p, x: p.x + offsetX, y: p.y + offsetY, endX: p.endX + offsetX, endY: p.endY + offsetY, control1X: p.control1X + offsetX, control1Y: p.control1Y + offsetY, control2X: p.control2X + offsetX, control2Y: p.control2Y + offsetY };
            } else {
              return { ...p, x: p.x + offsetX, y: p.y + offsetY, endX: p.endX + offsetX, endY: p.endY + offsetY, controlX: p.controlX + offsetX, controlY: p.controlY + offsetY };
            }
          });
        }
        // Then rotate paths around the new center and update rotation field
        if (extraRot !== 0) {
          const newAbsRot = ((el.rotation || 0) + extraRot + 360) % 360;
          newEl.paths = rotatePathsAroundCenter(newEl.paths, newCx, newCy, extraRot, el, newAbsRot);
          newEl.rotation = newAbsRot;
        }
        newElements.push(newEl);
      });
    }
    setElements(prev => [...prev, ...newElements]);
    setSelectedIds([...currentSelectedIds, ...newElements.map(e => e.id)]);
  };

  // Spiral Array — place copies along an Archimedean or geometric spiral around a pivot.
  const executeSpiralArray = (count: number, type: 'archimedean' | 'geometric', gap: number, growth: number, rotate: boolean, angleStep: number) => {
    const currentSelectedIds = selectedIdsRef.current;
    const currentElements = elementsRef.current;
    if (currentSelectedIds.length === 0 || count < 2) return;
    const selectedEls = currentElements.filter(e => currentSelectedIds.includes(e.id));

    // Pivot: linked grid → panel-selected grid → world origin
    let pivX = 0, pivY = 0;
    const linkedGid = (() => {
      const gid = selectedEls[0]?.polarRotationGridId;
      return gid && selectedEls.every(e => e.polarRotationGridId === gid) ? gid : null;
    })();
    const pivGrid = linkedGid
      ? polarGrids.find(g => g.id === linkedGid)
      : selectedPolarGridId ? polarGrids.find(g => g.id === selectedPolarGridId) : null;
    if (pivGrid) { pivX = pivGrid.center.x; pivY = pivGrid.center.y; }

    // Derive start radius and start angle from selection centroid relative to pivot
    const centroidX = selectedEls.reduce((s, e) => s + e.center.x, 0) / selectedEls.length;
    const centroidY = selectedEls.reduce((s, e) => s + e.center.y, 0) / selectedEls.length;
    const r0 = Math.sqrt((centroidX - pivX) ** 2 + (centroidY - pivY) ** 2);
    const angle0 = Math.atan2(centroidY - pivY, centroidX - pivX) * 180 / Math.PI;

    const angularStep = angleStep; // fixed degrees per copy — independent of count

    // Position on spiral for step i (i=0 = original selection position)
    const spiralPos = (i: number) => {
      const angleDeg = angle0 + angularStep * i;
      const rad = angleDeg * Math.PI / 180;
      const r = type === 'archimedean'
        ? r0 + gap * i
        : r0 * Math.pow(growth, i);
      return { x: pivX + Math.cos(rad) * r, y: pivY + Math.sin(rad) * r, angleDeg };
    };

    const newElements = [];
    for (let i = 1; i < count; i++) {
      const pos = spiralPos(i);
      // Offset moves the centroid to pos; each element keeps its relative position within the group
      const offsetX = pos.x - centroidX;
      const offsetY = pos.y - centroidY;
      // Rotation delta relative to original angle — how much the spiral has turned
      // offsetX/Y moves each element's centroid to the new spiral position

      const groupIdMap = new Map<string, string>();
      selectedEls.forEach(el => { if (el.groupId && !groupIdMap.has(el.groupId)) groupIdMap.set(el.groupId, generateId()); });
      selectedEls.forEach(el => {
        const newEl = JSON.parse(JSON.stringify(el));
        newEl.id = generateId();
        delete newEl.orderNumber;
        if (el.groupId) newEl.groupId = groupIdMap.get(el.groupId);

        const newCx = el.center.x + offsetX;
        const newCy = el.center.y + offsetY;
        newEl.center = { x: newCx, y: newCy };

        // First translate all path points to the new position
        if (newEl.paths) {
          newEl.paths = newEl.paths.map(p => {
            if (p.type === 'cubic') {
              return { ...p, x: p.x + offsetX, y: p.y + offsetY, endX: p.endX + offsetX, endY: p.endY + offsetY, control1X: p.control1X + offsetX, control1Y: p.control1Y + offsetY, control2X: p.control2X + offsetX, control2Y: p.control2Y + offsetY };
            } else {
              return { ...p, x: p.x + offsetX, y: p.y + offsetY, endX: p.endX + offsetX, endY: p.endY + offsetY, controlX: p.controlX + offsetX, controlY: p.controlY + offsetY };
            }
          });
        }

        if (rotate) {
          // Target angle = direction from pivot to new center. Delta from current rotation.
          const targetAngleDeg = Math.atan2(newCy - pivY, newCx - pivX) * 180 / Math.PI;
          const rotDeltaDeg = targetAngleDeg - (el.rotation || 0);
          const absRot = (targetAngleDeg + 360) % 360;
          newEl.paths = rotatePathsAroundCenter(newEl.paths, newCx, newCy, rotDeltaDeg, el, absRot);
          newEl.rotation = absRot;
        }

        newElements.push(newEl);
      });
    }
    setElements(prev => [...prev, ...newElements]);
    setSelectedIds([...currentSelectedIds, ...newElements.map(e => e.id)]);
  };

  // ── Tatting Order helpers ─────────────────────────────────────────────────

  // Returns [fillColor, strokeColor] for an element's order badge based on its group.
  // Ungrouped elements use index 0 (gold) — legacy single-color behavior.
  // Grouped elements start from index 1 so Round 1 is visually distinct from ungrouped.
  const getGroupBadgeColor = (el): [string, string] => {
    if (!el.orderGroup) return ORDER_GROUP_COLORS[0];
    const idx = orderGroups.findIndex(g => g.id === el.orderGroup);
    return ORDER_GROUP_COLORS[idx >= 0 ? (idx + 1) % ORDER_GROUP_COLORS.length : 1];
  };

  const getNextAvailableNumber = (): number => {
    const used = new Set(
      elements
        .filter(e => activeOrderGroupId === null
          ? (!e.orderGroup)           // ungrouped scope
          : e.orderGroup === activeOrderGroupId) // group scope
        .map(e => e.orderNumber)
        .filter(n => n !== null && n !== undefined && String(n).trim() !== '')
        .map(n => parseInt(String(n), 10))
        .filter(n => !isNaN(n))
    );
    let i = 1;
    while (used.has(i)) i++;
    return i;
  };

  const assignOrderNumber = (targetElId: string, num: number) => {
    const existingEl = elements.find(
      e => e.id !== targetElId &&
        parseInt(String(e.orderNumber), 10) === num &&
        (activeOrderGroupId === null ? !e.orderGroup : e.orderGroup === activeOrderGroupId)
    );
    if (existingEl) {
      setTattingOrderConflict({ newNum: num, existingElId: existingEl.id, targetElId });
      return;
    }
    const newEls = elements.map(e =>
      e.id === targetElId
        ? { ...e, orderNumber: num, orderGroup: activeOrderGroupId ?? undefined }
        : e
    );
    setElements(newEls);
    setTattingOrderInput('');
    pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
  };

  const resolveTattingOrderConflict = (action: 'swap' | 'shift' | 'cancel') => {
    if (!tattingOrderConflict) return;
    const { newNum, existingElId, targetElId } = tattingOrderConflict;
    let newEls = elements;
    if (action === 'swap') {
      const targetEl = elements.find(e => e.id === targetElId);
      const oldNum = targetEl?.orderNumber ?? null;
      newEls = elements.map(e => {
        if (e.id === targetElId) return { ...e, orderNumber: newNum };
        if (e.id === existingElId) return { ...e, orderNumber: oldNum };
        return e;
      });
      setElements(newEls);
    } else if (action === 'shift') {
      newEls = elements.map(e => {
        if (e.id === targetElId) return { ...e, orderNumber: newNum, orderGroup: activeOrderGroupId ?? undefined };
        const sameGroup = activeOrderGroupId === null ? !e.orderGroup : e.orderGroup === activeOrderGroupId;
        const n = parseInt(String(e.orderNumber), 10);
        if (sameGroup && !isNaN(n) && n >= newNum) return { ...e, orderNumber: n + 1 };
        return e;
      });
      setElements(newEls);
    }
    setTattingOrderConflict(null);
    setTattingOrderInput('');
    if (action !== 'cancel') {
      pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
    }
  };
  // Convenience: push a history snapshot after any tatting-order mutation.
  // Call AFTER the state setters so refs are updated by the next render — but since
  // we pass current ref values directly, this captures the pre-setState snapshot which
  // is fine for undo (React batches the update anyway).
  const pushOrderHistory = () => {
    pushHistoryState(elementsRef.current, picotConnectionsRef.current, orderGroupsRef.current);
  };

  // New canvas - confirm if there are elements
  const newCanvas = () => {
    // Show warning if canvas has content or has been modified (history > initial state)
    if (elements.length === 0 && historyIndex === 0) return;
    setShowNewCanvasDialog(true);
  };

  const confirmNewCanvas = () => {
    setShowNewCanvasDialog(false);
    setElements([]);
    setSelectedIds([]);
    setClipboard([]);
    setPicotConnections([]);
    setSelectedPicots([]);
    setProjectName('Untitled Pattern');
    setCamera({ x: 0, y: 0 });
    setZoom(1);
    setHistory([{ elements: [], connections: [] }]);
    setHistoryIndex(0);
    // Hide (don't delete) all polar grids — user can re-enable in the Polar Grid panel
    setPolarGrids(prev => prev.map(g => ({ ...g, visible: false })));
    setCurrentFilePath(null);
    setOrderGroups([]);
    setActiveOrderGroupId(null);
  };

  // ── Recent Projects helpers ───────────────────────────────────────────────

  // Generate a compact SVG thumbnail from elements (paths only, no labels/picots).
  // generateThumbnail and addToRecents imported from ./tauri/file
  // Thin wrapper to bind dsWidth from component state
  const thumbnail = (els) => generateThumbnail(els, dsWidth);

  // Build the project data object (shared by save and autosave)
  const buildProjectData = useCallback((finalName: string) => ({
    version: 90,
    name: finalName,
    created: new Date().toISOString(),
    elements,
    picotConnections,
    camera,
    zoom,
    dsWidth,
    beadLibrary,
    polarGrids,
    selectedPolarGridId,
    bgColor,
    gridEnabled,
    customColors,
    referenceImage,
    refImageProps,
    renderMode,
    patternNotes,
    materials,
    orderGroups,
    activeThreadPreset: threadPresets.find(p => p.id === activePresetId) || threadPresets[0] || DEFAULT_THREAD_PRESET,
  }), [elements, picotConnections, camera, zoom, dsWidth, beadLibrary, polarGrids, selectedPolarGridId, bgColor, gridEnabled, customColors, referenceImage, refImageProps, renderMode, patternNotes, materials, orderGroups, threadPresets, activePresetId]);

  // Write to a known path — no dialog, used for Ctrl+S when file already exists
  const saveToPath = useCallback(async (filePath: string, finalName: string) => {
    await writeProjectFile(filePath, buildProjectData(finalName));
    const thumb = thumbnail(elements);
    addToRecents(finalName, filePath, thumb);
    setLastSavedHistoryIndex(historyIndexRef.current);
  }, [buildProjectData, elements, dsWidth]);

  // Show native Save As dialog then write
  const performSave = useCallback(async (nameOverride?: string) => {
    const finalName = (nameOverride ?? projectName).trim() || 'Untitled Pattern';
    try {
      const filePath = await showSaveDialog(finalName);
      if (!filePath) return;
      setProjectName(finalName);
      await saveToPath(filePath, finalName);
      setCurrentFilePath(filePath);
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [projectName, saveToPath]);

  // Ctrl+S: silent save if path known, else go straight to OS dialog
  const saveProject = useCallback(() => {
    if (currentFilePath) {
      saveToPath(currentFilePath, projectName).catch(console.error);
    } else {
      performSave();
    }
  }, [currentFilePath, projectName, saveToPath, performSave]);

  // Save As — always shows OS dialog
  const saveProjectAs = useCallback(() => {
    performSave();
  }, [performSave]);

  // Shared project data applier — used by both loadProject and recent-project quick-load
  const applyProjectData = useCallback((projectData: any, filePath: string) => {
    // Validate it's a tatting project
    if (!projectData.elements || !Array.isArray(projectData.elements)) {
      showLoadMsg('error', t('loadErrMissingElements'));
      return;
    }

    const invalidElements = projectData.elements.filter((el: any) =>
      !el.id || !el.type || !el.paths || !Array.isArray(el.paths) ||
      (el.type !== 'ring' && el.type !== 'chain' && el.type !== 'line')
    );
    if (invalidElements.length > 0) {
      showLoadMsg('error', t('loadErrInvalidElements').replace('{n}', String(invalidElements.length)));
      return;
    }

    if (projectData.camera && (typeof projectData.camera.x !== 'number' || typeof projectData.camera.y !== 'number')) {
      projectData.camera = { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
    }
    if (projectData.zoom && (typeof projectData.zoom !== 'number' || projectData.zoom <= 0)) {
      projectData.zoom = 1;
    }
    if (projectData.picotConnections && !Array.isArray(projectData.picotConnections)) {
      projectData.picotConnections = [];
    }

    // Migrate legacy labelsInside → labelOffset
    setElements((projectData.elements || []).map((el: any) =>
      'labelsInside' in el && !('labelOffset' in el)
        ? (({ labelsInside, ...rest }) => ({ ...rest, labelOffset: 8 }))(el)
        : el
    ));
    setPicotConnections(projectData.picotConnections || []);
    setCamera(projectData.camera || { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) });
    setZoom(projectData.zoom || 1);
    setDsWidth(projectData.dsWidth || 10);
    setBgColor(projectData.bgColor || '#1F2937');
    setGridEnabled(projectData.gridEnabled !== undefined ? projectData.gridEnabled : true);
    setCustomColors(projectData.customColors || []);
    setReferenceImage(projectData.referenceImage || null);
    setRefImageProps(projectData.refImageProps || { opacity: 0.5, rotation: 0, scale: 1, visible: true });
    setProjectName(projectData.name || 'Untitled Pattern');
    setRenderMode(projectData.renderMode || 'schematic');
    setPatternNotes(projectData.patternNotes || '');
    setMaterials(projectData.materials || DEFAULT_MATERIALS);
    setOrderGroups(Array.isArray(projectData.orderGroups) ? projectData.orderGroups : []);
    setActiveOrderGroupId(null);
    if (Array.isArray(projectData.polarGrids)) {
      setPolarGrids(prev => {
        const existing = new Set(prev.map((g: any) => g.id));
        return [...prev, ...projectData.polarGrids.filter((g: any) => !existing.has(g.id))];
      });
    }
    if (projectData.selectedPolarGridId) setSelectedPolarGridId(projectData.selectedPolarGridId);
    if (projectData.activeThreadPreset) {
      const pt = projectData.activeThreadPreset;
      setThreadPresets(prev => {
        const exists = prev.find((p: any) => p.id === pt.id);
        return exists ? prev.map((p: any) => p.id === pt.id ? pt : p) : [...prev, pt];
      });
      setActivePresetId(pt.id);
      localStorage.setItem('tcad_active_preset_id', pt.id);
    }

    setSelectedIds([]);
    setSelectedPicots([]);
    setHistory([{ elements: projectData.elements || [], connections: projectData.picotConnections || [] }]);
    setHistoryIndex(0);
    setCurrentFilePath(filePath);

    const count = (projectData.elements || []).length;
    setTimeout(() => showLoadMsg('success', t('loadSuccess').replace('{n}', String(count))), 50);

    const thumb = generateThumbnail(projectData.elements || [], projectData.dsWidth || 10);
    addToRecents(projectData.name || 'Project', filePath, thumb);
  }, []);

  // Load directly from a known path — used by recent project cards (no OS dialog)
  const loadFromPath = useCallback(async (filePath: string) => {
    try {
      const projectData = await readProjectFile(filePath);
      applyProjectData(projectData, filePath);
    } catch (error: any) {
      // Likely moved or deleted — give a friendly message
      const isNotFound = error.message?.toLowerCase().includes('not found') ||
                         error.message?.toLowerCase().includes('no such file') ||
                         error.code === 'NOT_FOUND';
      if (isNotFound) {
        showLoadMsg('error', t('loadErrFileNotFound'));
      } else {
        showLoadMsg('error', t('loadErrGeneric').replace('{msg}', error.message));
      }
    }
  }, [applyProjectData]);

  // Load project — native OS open dialog (Browse button only)
  const loadProject = useCallback(async () => {
    const filePath = await showOpenDialog();
    if (!filePath) return;
    try {
      const projectData = await readProjectFile(filePath);
      applyProjectData(projectData, filePath);
    } catch (error: any) {
      showLoadMsg('error', t('loadErrGeneric').replace('{msg}', error.message));
    }
  }, [applyProjectData]);

  // Load a theme JSON file and merge it over the default (unknown keys are ignored)
  const loadTheme = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          showLoadMsg('error', t('loadThemeErrInvalid'));
          return;
        }
        // Merge: only accept keys that exist in DEFAULT_THEME
        const merged = { ...DEFAULT_THEME };
        for (const key of Object.keys(DEFAULT_THEME)) {
          if (typeof parsed[key] === 'string') merged[key] = parsed[key];
        }
        setTheme(merged);
        showLoadMsg('success', t('loadThemeSuccess'));
      } catch {
        showLoadMsg('error', t('loadThemeErrJson'));
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };


  const exportSVG = useCallback(async () => {
    if (!canvasRef.current) return;
    
    // Get the SVG element
    const svgElement = canvasRef.current.querySelector('svg');
    if (!svgElement) return;
    
    // Clone the SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

    // ── Step 1: Strip all UI-only elements ─────────────────────────────────
    // Remove background grid
    clonedSvg.querySelectorAll('[fill="url(#grid)"]').forEach(n => n.remove());

    // Remove selection overlays: any stroke="#3B82F6" element (selection rings,
    // bounding box rect, selection path overlays, snap indicator rings).
    // These are never part of the actual design.
    clonedSvg.querySelectorAll('[stroke="#3B82F6"]').forEach(n => n.remove());

    // Remove snap indicators and other data-ui marked elements
    clonedSvg.querySelectorAll('[data-ui]').forEach(n => n.remove());

    // Remove bezier control-point helper lines (gray dashed editing handles)
    clonedSvg.querySelectorAll('[stroke="#888"]').forEach(n => n.remove());

    // Remove glow filters from elements (red-glow = invalid notation highlight,
    // pink-glow = search highlight — neither belongs in export)
    clonedSvg.querySelectorAll('[filter]').forEach(n => n.removeAttribute('filter'));

    // ── Step 1b: Reorganize into Inkscape-compatible layers ─────────────────
    const ns = 'http://www.w3.org/2000/svg';
    const inkNs = 'http://www.inkscape.org/namespaces/inkscape';

    const makeLayer = (id: string, label: string) => {
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('id', id);
      g.setAttributeNS(inkNs, 'inkscape:groupmode', 'layer');
      g.setAttributeNS(inkNs, 'inkscape:label', label);
      return g;
    };

    const layerDesign   = makeLayer('layer-design',   'Design');
    const layerNotation = makeLayer('layer-notation',  'Notation');
    const layerOrder    = makeLayer('layer-order',     'Order Numbers');
    const layerGroups   = makeLayer('layer-groups',    'Group Markers');

    // Collect all marked elements and move to their layers
    // Work on the main group's children
    const mg = Array.from(clonedSvg.children).find(c => c.tagName.toLowerCase() === 'g') as SVGGElement | undefined;
    if (mg) {
      // Depth-first: collect all [data-layer] nodes
      const allLayerNodes = Array.from(mg.querySelectorAll('[data-layer]'));
      allLayerNodes.forEach(node => {
        const layer = node.getAttribute('data-layer');
        node.removeAttribute('data-layer');
        if (layer === 'notation') layerNotation.appendChild(node);
        else if (layer === 'order')   layerOrder.appendChild(node);
        else if (layer === 'groups')  layerGroups.appendChild(node);
      });

      // Move remaining content into design layer
      while (mg.firstChild) layerDesign.appendChild(mg.firstChild);
      // Append all layers back into main group
      mg.appendChild(layerDesign);
      mg.appendChild(layerNotation);
      mg.appendChild(layerOrder);
      mg.appendChild(layerGroups);
    }

    // Add inkscape namespace to SVG root
    clonedSvg.setAttribute('xmlns:inkscape', inkNs);

    // Remove the dark background color from the SVG root — use white for export
    clonedSvg.style.backgroundColor = 'white';
    clonedSvg.style.userSelect = '';

    // Remove the camera transform: we'll use viewBox instead
    // Find the direct-child camera group — NOT querySelector('g') which hits
    // the first <g id="ds-stitch"> inside <defs> first.
    const mainGroup = Array.from(clonedSvg.children).find(
      (el) => el.tagName.toLowerCase() === 'g'
    ) as SVGGElement | undefined;
    if (mainGroup) mainGroup.removeAttribute('transform');

    // ── Step 2: Calculate tight bounds over all elements ───────────────────
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const expandBounds = (x: number, y: number) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    };

    elements.forEach(el => {
      if (el.isClosed && el.shapeStyle === 'circle' && el.center) {
        // Circles: bound by center ± radius
        const circ = el.stitchCount * dsWidth;
        const r = circ / (2 * Math.PI);
        expandBounds(el.center.x - r, el.center.y - r);
        expandBounds(el.center.x + r, el.center.y + r);
      }
      (el.paths || []).forEach(path => {
        const points = sampleBezierPath(path, 20);
        points.forEach(pt => expandBounds(pt.x, pt.y));
      });
      // Include picot arm tips
      (el.picots || []).forEach(p => {
        const pos = getPicotPosition(el, p, false);
        if (pos) expandBounds(pos.x, pos.y);
      });
    });
    
    // Fallback if canvas is empty
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 200; }

    // ── Step 3: Set viewBox to tight content bounds + padding ──────────────
    const padding = 30;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    clonedSvg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
    clonedSvg.setAttribute('width', String(Math.round(width)));
    clonedSvg.setAttribute('height', String(Math.round(height)));
    
    // Append pattern notes below the design if present
    if (patternNotes && patternNotes.trim()) {
      const noteLines = patternNotes.trim().split('\n');
      const lineHeight = 20;
      const notesY = maxY + 10;
      const notesHeight = noteLines.length * lineHeight + 40;
      const newHeight = height + notesHeight;
      clonedSvg.setAttribute('height', String(Math.round(newHeight)));
      clonedSvg.setAttribute('viewBox', `${minX} ${minY} ${width} ${newHeight}`);
      const notesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const header = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      header.setAttribute('x', String(minX + padding));
      header.setAttribute('y', String(notesY + 20));
      header.setAttribute('font-family', 'sans-serif');
      header.setAttribute('font-size', '14');
      header.setAttribute('font-weight', 'bold');
      header.setAttribute('fill', '#333');
      header.textContent = 'Notes:';
      notesGroup.appendChild(header);
      noteLines.forEach((line, i) => {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', String(minX + padding));
        t.setAttribute('y', String(notesY + 44 + i * lineHeight));
        t.setAttribute('font-family', 'sans-serif');
        t.setAttribute('font-size', '13');
        t.setAttribute('fill', '#333');
        t.textContent = line || ' ';
        notesGroup.appendChild(t);
      });
      clonedSvg.appendChild(notesGroup);
    }

    // ── Step 4: Add order numbers as a separate toggleable layer ───────────
    // ── Step 4: Add order numbers as a separate toggleable layer ───────────
    // Only run if Step 1 didn't already extract data-layer="order" nodes from the DOM
    // (which happens when showUnnumbered is active). This avoids duplicates.
    const numberedEls = elements.filter(el =>
      el.orderNumber != null && String(el.orderNumber).trim() !== '' && el.center
    );
    if (numberedEls.length > 0 && layerOrder.childNodes.length === 0) {
      const fontSize = Math.max(8, Math.round(width / 60)); // scale to drawing
      numberedEls.forEach(el => {
        // Pick color by group index — same logic as getGroupBadgeColor():
        // ungrouped = gold (index 0), grouped starts at index 1 so Round 1 != ungrouped
        const groupIndex = el.orderGroup
          ? orderGroups.findIndex(g => g.id === el.orderGroup)
          : -1;
        const [fillColor, strokeColor] = ORDER_GROUP_COLORS[
          groupIndex >= 0 ? (groupIndex + 1) % ORDER_GROUP_COLORS.length : 0
        ];
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        bg.setAttribute('x', String(el.center.x));
        bg.setAttribute('y', String(el.center.y));
        bg.setAttribute('text-anchor', 'middle');
        bg.setAttribute('dominant-baseline', 'middle');
        bg.setAttribute('font-family', 'sans-serif');
        bg.setAttribute('font-size', String(fontSize));
        bg.setAttribute('font-weight', 'bold');
        bg.setAttribute('stroke', strokeColor);
        bg.setAttribute('stroke-width', '3');
        bg.setAttribute('paint-order', 'stroke');
        bg.setAttribute('fill', fillColor);
        bg.textContent = String(el.orderNumber);
        layerOrder.appendChild(bg);
      });
    }

    // Serialize AFTER all DOM mutations (including notes)
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clonedSvg);

    // Add XML declaration
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;

    // ── Save via Tauri dialog ──
    try {
      const filePath = await showSaveSvgDialog(projectName.replace(/[^a-z0-9]/gi, '_'));
      if (!filePath) return;
      await writeTextToFile(filePath, svgString);
    } catch (err) {
      console.error('SVG export failed:', err);
    }
    
  }, [elements, projectName, patternNotes, orderGroups, dsWidth]);

  // Generate pattern text from ordered elements
  const generatePattern = useCallback(() => {
    // Build a lookup: elementId → type label + order number
    // Handles duplicate order numbers safely - marks them with ⚠
    const orderNumberCount = {};
    elements.forEach(el => {
      const num = el.orderNumber?.toString().trim();
      if (num) orderNumberCount[num] = (orderNumberCount[num] || 0) + 1;
    });

    const getElementRef = (elementId) => {
      const el = elementById.get(elementId);
      if (!el) return null;
      const num = el.orderNumber?.toString().trim();
      const typeLabel = el.type === 'ring' ? 'R' : el.type === 'chain' ? (el.isSplitChain ? 'SC' : 'CH') : null;
      if (!typeLabel) return null;
      if (!num) return `${typeLabel}#?`;
      // Check if this number is duplicated across different groups (rounds)
      const samNumEls = elements.filter(e => e.orderNumber?.toString().trim() === num);
      if (samNumEls.length > 1) {
        // Qualify with round/group name if available
        const grp = el.orderGroup ? orderGroups.find(g => g.id === el.orderGroup) : null;
        const qualifier = grp ? `/${grp.name.replace(/\s+/g, '')}` : '/ungrouped';
        return `${typeLabel}#${num}${qualifier}`;
      }
      return `${typeLabel}#${num}`;
    };

    // Build a lookup: elementId + picotId → list of connected element refs
    // A picot can appear in multiple connections
    const picotConnectionMap = {}; // key: "elementId:picotId" → Set of element refs
    picotConnections.forEach(conn => {
      if (conn.picots.length < 2) return;
      conn.picots.forEach(p => {
        const key = `${p.elementId}:${p.picotId}`;
        if (!picotConnectionMap[key]) picotConnectionMap[key] = [];
        // Add refs for all OTHER picots in this connection
        conn.picots.forEach(other => {
          if (other.elementId === p.elementId && other.picotId === p.picotId) return;
          const ref = getElementRef(other.elementId);
          if (ref && !picotConnectionMap[key].includes(ref)) {
            picotConnectionMap[key].push(ref);
          }
        });
      });
    });

    // Rebuild the notation for pattern output from picot data.
    // This avoids the fragility of parsing the stored notation string (which may use
    // repeat macros like 3x(jp-3ds)) and gives each jp its inline connection refs.
    //
    // Format:  3ds-jp//r3//-3ds-jp//r3//r5//r7//-3ds
    //          └─ Nds ──┘ └─── jp//rN//... ───┘ └─ Nds ─┘
    //
    // Picot tokens:
    //   jp with connections  →  jp//r3//r5//   (sorted lex; each ref is rN or chN)
    //   jp with no refs      →  jp(?)
    //   bead-jp              →  bjp//r3//  (beadType set + isJoint)
    //   regular medium       →  p
    //   regular small        →  sp
    //   regular large        →  lp
    //   bead picot (non-jp)  →  bp
    //   guide / guide-point  →  skipped (construction-only)
    const buildOutputNotation = (el, elementId) => {
      // ── Type prefix ─────────────────────────────────────────────────────────
      const typePrefix = el.isSplitRing ? 'sr'
        : el.type === 'ring'  ? 'r'
        : el.type === 'chain' ? (el.isSplitChain ? 'sc' : 'c')
        : null;
      if (!typePrefix) return el.notation || '';

      // Helper: get lowercase ref string from a stored "R#3" / "CH#5" ref
      const refToLower = (ref) => {
        const m = ref.match(/^([A-Za-z]+)#(.+)$/);
        if (!m) return ref.toLowerCase();
        return m[1].toLowerCase() + m[2];
      };

      // ── Sort picots by position ────────────────────────────────────────────
      // jpg (isGuide + isJoint) → output as plain jp: it's a real join point,
      //   the guide flag only affects how it renders on canvas (green vs orange).
      // gp  (isGuidePoint, no arm) → skip: pure construction snap-dot, not a
      //   tatting element. isGuidePoint && !isJoint is the exact gp signature.
      const picots = [...(el.picots || [])]
        .filter(p => !(p.isGuidePoint && !p.isJoint))
        .sort((a, b) => a.stitchesBefore - b.stitchesBefore);

      const totalStitches = el.stitchCount;
      const parts = [];
      let prev = 0;

      for (const picot of picots) {
        // Stitch segment before this picot
        const ds = picot.stitchesBefore - prev;
        if (ds > 0) parts.push(`${ds}ds`);

        const key = `${elementId}:${picot.id}`;

        if (picot.isJoint) {
          // Join picot — inline connection refs
          const refs = picotConnectionMap[key] || [];
          let token: string;
          if (picot.beadType) token = 'bjp';
          else if (picot.isCoreJoin && picot.hasPicotArm) token = 'cjp';
          else if (picot.isCoreJoin) token = 'cj';
          else token = 'jp';
          if (refs.length === 0) {
            parts.push(`${token}(?)`);
          } else {
            const refStrs = [...refs].sort().map(refToLower);
            parts.push(token + refStrs.map(r => `//${r}`).join('') + '//');
          }
        } else if (picot.beadType) {
          // Bead picot (non-join)
          parts.push('bp');
        } else {
          // Regular decorative picot — length determines token
          const lengthToken = picot.length === 'small' ? 'sp'
            : picot.length === 'large'  ? 'lp'
            : 'p';
          parts.push(lengthToken);
        }

        prev = picot.stitchesBefore;
      }

      // Trailing stitches after last picot
      const trailing = totalStitches - prev;
      if (trailing > 0) parts.push(`${trailing}ds`);

      // ── Split ring: keep A/B notation convention ──────────────────────────
      // For split rings the picots span the combined A+B stitch count.
      // We still use the rebuilt body but wrap it correctly.
      if (el.isSplitRing) {
        const splitAt = el.splitPosition || 0;
        const body = parts.join('-');
        // Fallback to existing notation display if we can't reconstruct
        if (!splitAt) {
          const notationA = el.notation.replace(/^sr:\s*/, '');
          const notationB = el.notationB || '5ds';
          return `sr: A: ${notationA} B: ${notationB}`;
        }
        return `sr: ${body}`;
      }

      return `${typePrefix}: ${parts.join('-')}`;
    };

    // Collect elements that have order numbers (rings + chains + lines with numbers)
    const orderedElements = elements
      .filter(el => {
        const num = el.orderNumber?.toString().trim();
        return num && num !== '';
      })
      .map(el => ({
        order: parseFloat(el.orderNumber),
        rawOrder: el.orderNumber.toString().trim(),
        element: el
      }))
      .filter(item => !isNaN(item.order))
      .sort((a, b) => a.order - b.order);

    // If no numbered elements, build a warning header but still run thread estimate below
    let fallbackHeader = '';
    if (orderedElements.length === 0) {
      const hasAnyElements = elements.some(el => el.type !== 'line');
      if (hasAnyElements) {
        const unnumbered = elements.filter(el => el.type !== 'line');
        const list = unnumbered.map(el => {
          const typeLabel = el.type === 'ring' ? (el.isSplitRing ? 'SR' : 'R') : (el.isSplitChain ? 'SC' : 'CH');
          const hint = el.notation
            ? ' (' + el.notation.replace(/^(r|c|sc|sr):\s*/i, '').slice(0, 35) + ')' : '';
          return `  • ${typeLabel}${hint}${el.rw ? ' RW' : ''}`;
        });
        fallbackHeader = `⚠ Some elements don't have an assigned order number:\n${list.join('\n')}`;
      } else {
        const notesBlock = patternNotes && patternNotes.trim()
          ? '\n\n--- Notes ---\n' + patternNotes.trim() : '';
        copyToClipboard('No objects on canvas.' + notesBlock);
        return;
      }
    }

    // Warn about duplicates but don't abort.
    // Duplicate detection is now per-group: same number in same group = duplicate.
    const groupDupNums: string[] = [];
    {
      // key = "groupId|num" (ungrouped uses "")
      const groupNumCount: Record<string, number> = {};
      orderedElements.forEach(item => {
        const gKey = (item.element.orderGroup ?? '') + '|' + item.rawOrder;
        groupNumCount[gKey] = (groupNumCount[gKey] || 0) + 1;
      });
      Object.entries(groupNumCount).forEach(([k, count]) => {
        if (count > 1) {
          const [, num] = k.split('|');
          groupDupNums.push(num);
        }
      });
    }

    // Helper: render a single element line
    const renderElementLine = (item) => {
      const el = item.element;
      // Duplicate check is within-group — same number in same group scope
      const gKey = (el.orderGroup ?? '') + '|' + item.rawOrder;
      const isDup = orderedElements.filter(x =>
        (x.element.orderGroup ?? '') + '|' + x.rawOrder === gKey
      ).length > 1;
      const dupWarning = isDup ? ' ⚠DUPLICATE#' : '';
      if (el.type === 'line') return `${item.rawOrder}${dupWarning}. [Line]`;
      const notationText = buildOutputNotation(el, el.id);
      return `${item.rawOrder}${dupWarning}. ${notationText}${el.rw ? ' RW' : ''}`;
    };

    // Decide: grouped or flat output
    const hasAnyGroup = orderedElements.some(item => item.element.orderGroup);
    let patternBody: string;

    if (hasAnyGroup) {
      // ── Grouped output ─────────────────────────────────────────────────────
      // Section order: orderGroups array order first, then ungrouped at the end
      const sections: string[] = [];

      for (const group of orderGroups) {
        const groupItems = orderedElements.filter(item => item.element.orderGroup === group.id);
        if (groupItems.length === 0) continue;
        const header = `=== ${group.name} ===`;
        const lines = groupItems.map(renderElementLine);
        sections.push(header + '\n' + lines.join('\n'));
      }

      // Ungrouped elements (no orderGroup or orderGroup not found in array)
      const knownGroupIds = new Set(orderGroups.map(g => g.id));
      const ungroupedItems = orderedElements.filter(item =>
        !item.element.orderGroup || !knownGroupIds.has(item.element.orderGroup)
      );
      if (ungroupedItems.length > 0) {
        const lines = ungroupedItems.map(renderElementLine);
        sections.push(`=== Ungrouped ===\n` + lines.join('\n'));
      }

      patternBody = sections.join('\n\n');
    } else {
      // ── Flat output (legacy — no groups used) ──────────────────────────────
      const patternLines = orderedElements.map(renderElementLine);
      if (groupDupNums.length > 0) {
        patternLines.unshift(`⚠ Warning: duplicate order numbers: ${groupDupNums.join(', ')}`);
      }
      patternBody = patternLines.join('\n');
    }

    // Collect unnumbered rings + chains (lines without numbers are less meaningful to list)
    const unnumberedElements = elements.filter(el => {
      if (el.type === 'line') return false; // lines optional, skip to keep output clean
      const num = el.orderNumber?.toString().trim();
      return !num || num === '';
    });

    const unnumberedBlock = unnumberedElements.length > 0
      ? (() => {
          const list = unnumberedElements.map(el => {
            const typeLabel = el.type === 'ring'
              ? (el.isSplitRing ? 'SR' : 'R')
              : (el.isSplitChain ? 'SC' : 'CH');
            // Show a short notation hint so user can identify the element
            const hint = el.notation
              ? ' (' + el.notation.replace(/^(r|c|sc|sr):\s*/i, '').slice(0, 35) + (el.notation.length > 40 ? '…' : '') + ')'
              : '';
            return `  • ${typeLabel}${hint}${el.rw ? ' RW' : ''}`;
          });
          return `\n\n⚠ Some elements don't have an assigned order number:\n${list.join('\n')}`;
        })()
      : '';

    // Append pattern notes if present
    const notesBlock = patternNotes && patternNotes.trim()
      ? `\n\n--- Notes ---\n${patternNotes.trim()}`
      : '';


    // ── Thread Estimate ──────────────────────────────────────────────────────
    const activePreset = (() => {
      const preset = threadPresets.find(p => p.id === activePresetId);
      return preset || threadPresets[0] || DEFAULT_THREAD_PRESET;
    })();

    const perDsWorking  = activePreset.ds20Working / 20;   // mm per DS
    const perDsCore     = activePreset.ds20Core / 20;      // mm per DS core
    const perSsWorking  = perDsWorking * 0.5;
    const picotMm = {
      regular: activePreset.picotRegular,
      joined:  activePreset.picotJoined,
      long:    activePreset.picotRegular * 2,
      short:   activePreset.picotShort ?? (activePreset.picotRegular * 0.5),
      medium:  activePreset.picotRegular,
      lp:      activePreset.picotRegular * 2,
      sp:      activePreset.picotShort ?? (activePreset.picotRegular * 0.5),
      p:       activePreset.picotRegular,
    };

    // Per-material working thread (mm)
    const materialMm: Record<string, number> = {};
    const ensureMat = (id) => { if (!(id in materialMm)) materialMm[id] = 0; };
    let coreTotal = 0;  // mm
    let countDS = 0, countSS = 0, countPicots = 0, countJoined = 0;

    const countStitchType = (notation) => {
      // Returns { ds, ss, regular, long, short, joined, beadDs } from a notation string
      // beadDs = DS-equivalent occupied by bc:/bcp: beads (core thread only, no working thread)
      const result = { ds: 0, ss: 0, regular: 0, long: 0, short: 0, joined: 0, beadDs: 0 };
      if (!notation) return result;

      // Helper: expand bead sequence "3Y" → 3, "YZY" → 3, "YZ" → 2
      const countBeadsInSeq = (seq) => {
        let count = 0, i = 0;
        while (i < seq.length) {
          if (/\d/.test(seq[i])) {
            const n = parseInt(seq[i]); i++;
            if (i < seq.length && /[YZV]/i.test(seq[i])) { count += n; i++; }
          } else if (/[YZV]/i.test(seq[i])) { count += 1; i++; }
          else { i++; }
        }
        return count;
      };

      const tokens = notation.replace(/^(r|c|sc|sr|ch):\s*/i, '').split(/[,\s\-]+/);
      for (const tok of tokens) {
        // bc:SEQ — each bead in sequence = 1 DS on core, 0 working thread
        const bcMatch = tok.match(/^bc:([YZVyzv0-9]+)$/i);
        if (bcMatch) { result.beadDs += countBeadsInSeq(bcMatch[1]); continue; }

        // bcp:CORE or bcp:CORE:SEQ — 1 DS on core, 0 working thread
        const bcpMatch = tok.match(/^bcp:([YZVyzv])(:([YZVyzv0-9]+))?$/i);
        if (bcpMatch) { result.beadDs += 1; continue; }

        // bcjp:CORE or bcjp:CORE:SEQ — 1 DS on core, 0 working thread, is joint
        const bcjpMatch = tok.match(/^bcjp:([YZVyzv])(:([YZVyzv0-9]+))?$/i);
        if (bcjpMatch) { result.beadDs += 1; continue; }
        // BE — 1 DS core, counted from beadLibrary entries not notation
        if (tok.match(/^be$/i)) { result.beadDs += 1; continue; }

        // Standard stitch tokens: 12ds, 5p, 3jp, etc.
        const m = tok.match(/^(\d+)(ds|ss|rds|p|lp|sp|jp|gjp|bjp|cj|cjp)?$/i);
        if (!m) continue;
        const n = parseInt(m[1]);
        const t = (m[2] || 'ds').toLowerCase();
        if (t === 'ds') result.ds += n;
        else if (t === 'rds') result.ds += n * 2;
        else if (t === 'ss') result.ss += n;
        else if (t === 'p') result.regular += n;
        else if (t === 'lp') result.long += n;
        else if (t === 'sp') result.short += n;
        else if (t === 'jp' || t === 'gjp') result.joined += n;
        else if (t === 'cj' || t === 'cjp') result.joined += n;
        // bjp: zero DS width, skip
      }
      return result;
    };

    for (const el of elements) {
      const matId = el.materialId || 'default';
      ensureMat(matId);

      if (el.type === 'line') {
        // Path length in px ÷ dsWidth → DS units → multiply by core and working per DS
        const totalPx = (el.paths || []).reduce((sum, path) => {
          const pts = [];
          for (let i = 0; i <= 20; i++) {
            const t = i / 20, u = 1 - t;
            if (path.type === 'cubic') {
              pts.push({ x: u*u*u*path.x+3*u*u*t*path.control1X+3*u*t*t*path.control2X+t*t*t*path.endX,
                          y: u*u*u*path.y+3*u*u*t*path.control1Y+3*u*t*t*path.control2Y+t*t*t*path.endY });
            } else {
              pts.push({ x: u*u*path.x+2*u*t*(path.controlX||path.control1X)+t*t*path.endX,
                          y: u*u*path.y+2*u*t*(path.controlY||path.control1Y)+t*t*path.endY });
            }
          }
          let len = 0;
          for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
          return sum + len;
        }, 0);
        const dsUnits = totalPx / dsWidth;
        materialMm[matId] += dsUnits * perDsWorking;
        coreTotal += dsUnits * perDsCore;
        countDS += Math.round(dsUnits);
        continue;
      }

      // Ring, chain, teardrop, split ring
      const notationStr = el.notation || '';
      const s = countStitchType(notationStr);
      materialMm[matId] += s.ds * perDsWorking + s.ss * perSsWorking;
      // beadDs: beads occupy path (core) but use no working thread
      coreTotal += (s.ds + s.ss * 0.5 + s.beadDs) * perDsCore;
      countDS += s.ds + s.beadDs; countSS += s.ss;

      // Picots from parsed notation stitches
      const picotList = el.picots || [];
      for (const p of picotList) {
        // bcp with no beadSeq = plain picot — include its thread length
        if (p.beadType && !(p.beadType === 'bcp' && !p.beadSeq) && !(p.beadType === 'bcjp' && !p.beadSeq)) continue;
        if (p.isJoint) {
          // Joined picots: add to both connected elements — handled via connections below
          continue;
        }
        const pLen = picotMm[p.length] || picotMm['regular'];
        materialMm[matId] += pLen;
        countPicots++;
      }

      // Split ring section B
      if (el.isSplitRing && el.notationB) {
        const matIdB = el.materialIdB || matId;
        ensureMat(matIdB);
        const sB = countStitchType(el.notationB);
        materialMm[matIdB] += sB.ds * perDsWorking + sB.ss * perSsWorking;
        coreTotal += (sB.ds + sB.ss * 0.5 + sB.beadDs) * perDsCore;
        countDS += sB.ds + sB.beadDs; countSS += sB.ss;
      }
    }

    // Joined picots: add joined picot length to both connected elements' materials
    for (const conn of picotConnections) {
      countJoined++;
      for (const cp of conn.picots) {
        const el = elementById.get(cp.elementId);
        if (!el) continue;
        const matId = el.materialId || 'default';
        ensureMat(matId);
        materialMm[matId] += picotMm['joined'];
      }
    }

    // ── Bead Count ───────────────────────────────────────────────────────────
    // Expand a bead sequence string ("3Y", "YZY", etc.) → {Y:n, Z:n, V:n}
    const countBeadsInSeqObj = (seq) => {
      const counts = { Y: 0, Z: 0, V: 0 };
      if (!seq) return counts;
      let i = 0;
      const s = seq.toUpperCase();
      while (i < s.length) {
        let n = 1;
        if (/\d/.test(s[i])) { n = parseInt(s[i]); i++; }
        if (i < s.length && /[YZV]/.test(s[i])) { counts[s[i]] += n; i++; }
        else { i++; }
      }
      return counts;
    };
    const addBeads = (totals, counts) => {
      for (const k of ['Y','Z','V']) totals[k] += counts[k] || 0;
    };

    const beadTotals = { Y: 0, Z: 0, V: 0 };
    const namedBeadCounts = new Map(); // beadId → { name, count }

    for (const el of elements) {
      // Beads on picots (bc, bcp, bp, bp1-5, bjp, sb)
      for (const p of (el.picots || [])) {
        if (!p.beadType) continue;
        if (p.beadType === 'bc') {
          // Single bead per picot entry — beadSize is 'Y', 'Z', or 'V'
          const sz = (p.beadSize || 'Y').toUpperCase();
          if (sz in beadTotals) beadTotals[sz]++;
        } else if (p.beadType === 'bcp' || p.beadType === 'bcjp') {
          // 1 core bead + optional cluster (bcp/bcjp)
          const coreSz = (p.coreSize || 'Y').toUpperCase();
          if (coreSz in beadTotals) beadTotals[coreSz]++;
          addBeads(beadTotals, countBeadsInSeqObj(p.beadSeq || ''));
        } else if (p.beadSeq) {
          // bp, bjp, sb — all carry a beadSeq
          addBeads(beadTotals, countBeadsInSeqObj(p.beadSeq));
        }
      }
      // Line beads
      if (el.type === 'line' && el.lineBeads) {
        addBeads(beadTotals, countBeadsInSeqObj(el.lineBeads));
      }
      // Per-slot line beads (new model)
      if (el.type === 'line' && el.lineBeadSlots?.length > 0) {
        el.lineBeadSlots.forEach(slotId => {
          if (!slotId) return;
          const libBead = beadLibrary.find(b => b.id === slotId);
          if (libBead) {
            const key = `named:${libBead.name}`;
            beadTotals[key] = (beadTotals[key] || 0) + 1;
          }
        });
      } else if (el.type === 'line' && el.lineBeadId && (el.lineBeadCount ?? 1) > 0) {
        // Legacy single-bead mode
        const libBead = beadLibrary.find(b => b.id === el.lineBeadId);
        if (libBead) {
          const key = `named:${libBead.name}`;
          beadTotals[key] = (beadTotals[key] || 0) + (el.lineBeadCount ?? 1);
        }
      }
      // BE beads — count by size AND by named bead from library
      for (const p of (el.picots || [])) {
        if (p.beadType !== 'be') continue;
        const countNamedBead = (beadId) => {
          if (!beadId) return;
          const b = beadLibrary.find(b => b.id === beadId);
          if (!b) return;
          // Size total
          const sz = b.size === 'S' ? 'Y' : b.size === 'M' ? 'Z' : b.size === 'L' ? 'V' : b.size;
          if (sz in beadTotals) beadTotals[sz]++;
          // Named total
          if (!namedBeadCounts.has(beadId)) {
            namedBeadCounts.set(beadId, { name: b.name, count: 0 });
          }
          namedBeadCounts.get(beadId).count++;
        };
        for (const beadId of (p.coreBeads || [])) countNamedBead(beadId);
        for (const beadId of (p.picotBeads || [])) countNamedBead(beadId);
      }
    }

    const beadEntries = [
      beadTotals.Y > 0 ? `Y (small) × ${beadTotals.Y}` : null,
      beadTotals.Z > 0 ? `Z (medium) × ${beadTotals.Z}` : null,
      beadTotals.V > 0 ? `V (large) × ${beadTotals.V}` : null,
    ].filter(Boolean);

    const namedEntries = [...namedBeadCounts.values()]
      .sort((a, b) => b.count - a.count) // most-used first
      .map(({ name, count }) => `  ${name} × ${count}`);

    const beadBlock = beadEntries.length > 0
      ? `\n\n--- Beads ---\n` +
        beadEntries.join('\n') +
        (namedEntries.length > 0 ? `\n\nNamed beads (BE):\n` + namedEntries.join('\n') : '')
      : '';

    const mmToM = (mm) => (mm / 1000).toFixed(2);

    const materialLines = Object.entries(materialMm)
      .filter(([, mm]) => mm > 0)
      .map(([id, mm]) => {
        const mat = materials.find(m => m.id === id);
        const name = mat ? mat.name : id;
        return `${name} ~ ${mmToM(mm)} m`;
      });

    const coreM = parseFloat(mmToM(coreTotal));
    const multiMat = Object.keys(materialMm).filter(id => (materialMm[id] || 0) > 0).length > 1;

    const threadBlock = materialLines.length > 0
      ? `\n\n--- Thread Estimate (${activePreset.name}) ---` +
        `\n(tie-ins and tails not included)\n` +
        materialLines.map(l => `\n${l}`).join('') +
        `\n\nNote: core thread not included — add manually` +
        (multiMat ? ` (multi-material pattern)` : '') +
        `\nCore thread ~ ${coreM} m` +
        `\n\nDS: ${countDS}  SS: ${countSS}  Picots: ${countPicots}  Joined: ${countJoined}`
      : '';

    const displayName = currentFilePath
      ? currentFilePath.split(/[\\/]/).pop()?.replace(/\.json$/i, '') ?? projectName
      : projectName;

    const patternText = (fallbackHeader
      ? fallbackHeader + (threadBlock ? threadBlock : '') + beadBlock + notesBlock
      : `${displayName.trim() || 'Untitled Pattern'}\n\n` + patternBody + unnumberedBlock + notesBlock + threadBlock + beadBlock);

    copyToClipboard(patternText, orderedElements.length);
  }, [elements, picotConnections, patternNotes, threadPresets, activePresetId, materials, dsWidth, orderGroups, currentFilePath, projectName]);

  // Export as PNG

  // Join selected joint picots with a connection
  const joinSelectedPicots = useCallback(() => {
    if (selectedPicots.length < 2) {
      return;
    }

    // First selected picot's element donates the material to the connection
    const firstEl = elementById.get(selectedPicots[0].elementId);
    const connMaterialId = firstEl?.materialId || 'default';

    // Create a new connection
    const connection = {
      id: generateId(),
      picots: [...selectedPicots], // Array of {elementId, picotId}
      materialId: connMaterialId,
    };
    
    const newConns = [...picotConnectionsRef.current, connection];
    setPicotConnections(newConns);
    setSelectedPicots([]); // Clear selection after joining
    pushHistoryState(elementsRef.current, newConns, orderGroupsRef.current);
  }, [selectedPicots, elementById]);

  // Break connections for selected joint picots
  const breakSelectedPicots = useCallback(() => {
    if (selectedPicots.length === 0) {
      return;
    }
    
    // Remove any connections that include any of the selected picots
    const newConns = picotConnectionsRef.current.filter(conn => {
      return !conn.picots.some(p => 
        selectedPicots.some(sp => sp.elementId === p.elementId && sp.picotId === p.picotId)
      );
    });
    setPicotConnections(newConns);
    setSelectedPicots([]); // Clear selection after breaking
    pushHistoryState(elementsRef.current, newConns, orderGroupsRef.current);
  }, [selectedPicots]); // Dependency: selectedPicots for filtering


  const allColors = [...COLORS, ...customColors];

  const screenToWorld = useCallback((screenX, screenY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - camera.x) / zoom,
      y: (screenY - rect.top - camera.y) / zoom
    };
  }, [camera, zoom]); // Dependencies: camera and zoom for coordinate transformation

  // Returns minimum distance from (worldX, worldY) to any sampled point on the element's paths.
  // Used for both hit-testing and tie-breaking between overlapping elements.
  const minPathDistance = (element, worldX, worldY) => {
    let minDist = Infinity;
    for (let path of element.paths) {
      const points = sampleBezierPath(path, 20);
      for (let pt of points) {
        const d = Math.hypot(pt.x - worldX, pt.y - worldY);
        if (d < minDist) minDist = d;
      }
    }
    return minDist;
  };

  const isPointInElement = (element, worldX, worldY) => {
    return minPathDistance(element, worldX, worldY) < 40;
  };
  
  // Find closest element by minimum path distance (works correctly for split rings and lines)
  const findClosestElement = (worldX, worldY, filterFn = null) => {
    const candidates = elements.filter(el => {
      if (filterFn && !filterFn(el)) return false;
      return isPointInElement(el, worldX, worldY);
    });
    
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    
    // Tie-break by minimum distance to any path point (not center distance)
    let closest = candidates[0];
    let closestDist = minPathDistance(closest, worldX, worldY);
    
    for (let i = 1; i < candidates.length; i++) {
      const dist = minPathDistance(candidates[i], worldX, worldY);
      if (dist < closestDist) {
        closest = candidates[i];
        closestDist = dist;
      }
    }
    
    return closest;
  };

  // For chains the stored `center` becomes stale after the path is bent with the
  // chain editor. Always compute the pivot as the midpoint between the first path's
  // start and the last path's end so +90 / -90 rotation is predictable regardless
  // of how the chain has been reshaped.
  const getElementPivot = (el) => {
    if ((el.type === 'chain' || el.type === 'teardrop') && el.paths && el.paths.length > 0) {
      const first = el.paths[0];
      const last  = el.paths[el.paths.length - 1];
      return {
        x: (first.x + last.endX) / 2,
        y: (first.y + last.endY) / 2,
      };
    }
    return { x: el.center.x, y: el.center.y };
  };

  // Returns the polar grid center to use as rotation pivot.
  // Only activates when ALL selected elements are explicitly linked to the same grid via polarRotationGridId.
  // Returns null otherwise — rotation falls back to bounding box center.
  const getPolarPivot = (ids) => {
    // Only use a polar grid as rotation pivot when ALL selected elements are explicitly linked to the same grid.
    if (ids && ids.length > 0) {
      const firstEl = elementsRef.current.find(e => String(e.id) === String(ids[0]));
      const gid = firstEl?.polarRotationGridId || null;
      if (gid && ids.every(id => {
        const el = elementsRef.current.find(e => String(e.id) === String(id));
        return el?.polarRotationGridId === gid;
      })) {
        const grid = polarGrids.find(g => g.id === gid);
        if (grid) return { x: grid.center.x, y: grid.center.y };
      }
    }
    return null;
  };

  // Returns the polar grid to use as flip axis.
  // Only activates when ALL selected elements are explicitly linked to the same grid via polarRotationGridId.
  // Returns null otherwise — flip falls back to bounding box center.
  const getPolarFlipGrid = (ids) => {
    // Only use a polar grid as flip axis when ALL selected elements are explicitly linked to the same grid.
    if (ids && ids.length > 0) {
      const firstEl = elementsRef.current.find(e => String(e.id) === String(ids[0]));
      const gid = firstEl?.polarRotationGridId || null;
      if (gid && ids.every(id => {
        const el = elementsRef.current.find(e => String(e.id) === String(id));
        return el?.polarRotationGridId === gid;
      })) {
        const linked = polarGrids.find(g => g.id === gid);
        if (linked) return linked;
      }
    }
    return null;
  };

  // Flip elements across a vertical axis (FlipH, axisAngleDeg=90) or horizontal axis (FlipV, axisAngleDeg=0).
  // Simple arithmetic: FlipH  → new_x = 2*pivotX - old_x,  y unchanged
  //                    FlipV  → new_y = 2*pivotY - old_y,  x unchanged
  const flipElements = (ids, axisAngleDeg, pivotX, pivotY) => {
    const isH = axisAngleDeg === 90; // true = horizontal mirror (left↔right), false = vertical mirror (top↔bottom)

    // Flip a single point
    const mirrorPt = (px, py) => isH
      ? { x: 2 * pivotX - px, y: py }
      : { x: px, y: 2 * pivotY - py };

    // Flip the rotation angle:  FlipH → 180-θ   FlipV → -θ
    const mirrorAngle = (deg) => isH
      ? ((180 - deg) % 360 + 360) % 360
      : ((-deg)      % 360 + 360) % 360;

    setElements(prev => prev.map(el => {
      if (!ids.includes(el.id)) return el;
      const currentAngle = el.rotation || 0;
      const newCenter = mirrorPt(el.center.x, el.center.y);
      const newAngle = mirrorAngle(currentAngle);

      // ── Split rings ──────────────────────────────────────────────────────
      if (el.isSplitRing) {
        const notationAText = el.notation.replace(/^sr:\s*/, '');
        const notationBText = el.notationB || '5ds';
        const reversedA = reverseNotation(`sr: ${notationAText}`).replace(/^sr:\s*/, '');
        const reversedB = reverseNotation(`sr: ${notationBText}`).replace(/^sr:\s*/, '');
        const parsedA = parseNotation(`sr: ${reversedB}`); // swap A↔B
        const parsedB = parseNotation(`sr: ${reversedA}`);
        if (!parsedA || !parsedB) return el;
        const sca = parsedA.stitchCount, scb = parsedB.stitchCount;
        const pathData = createSplitRingPath(newCenter.x, newCenter.y, (sca + scb) * dsWidth, sca, scb, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
        const rad = newAngle * Math.PI / 180, rc = Math.cos(rad), rs = Math.sin(rad);
        const rotatePt = (px, py) => {
          const dx = px - newCenter.x, dy = py - newCenter.y;
          return { x: newCenter.x + dx*rc - dy*rs, y: newCenter.y + dx*rs + dy*rc };
        };
        const newPaths = pathData.paths.map(p => {
          const s = rotatePt(p.x, p.y), e2 = rotatePt(p.endX, p.endY);
          const c1 = rotatePt(p.control1X, p.control1Y), c2 = rotatePt(p.control2X, p.control2Y);
          return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
        });
        const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({ ...p, stitchesBefore: p.stitchesBefore + sca }))];
        return { ...el, center: newCenter, paths: newPaths, notation: `sr: ${reversedB}`, notationB: reversedA, stitchCount: sca + scb, picots: allPicots, rotation: newAngle, splitPosition: sca };
      }

      // ── Circle rings (path-less) ─────────────────────────────────────────
      if (el.isClosed && el.shapeStyle === 'circle') {
        return { ...el, center: newCenter, rotation: newAngle };
      }

      // ── Path-based elements (chains, lines, teardrops) ───────────────────
      // Mirror each path point, swap start↔end to preserve traversal direction.
      const mirrorPath = path => {
        if (path.type === 'cubic') {
          const s  = mirrorPt(path.endX,      path.endY);
          const e2 = mirrorPt(path.x,          path.y);
          const c1 = mirrorPt(path.control2X,  path.control2Y);
          const c2 = mirrorPt(path.control1X,  path.control1Y);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
        } else {
          const s    = mirrorPt(path.endX,     path.endY);
          const e2   = mirrorPt(path.x,         path.y);
          const ctrl = mirrorPt(path.controlX,  path.controlY);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
        }
      };
      const newPaths = el.paths.map(mirrorPath).reverse();

      let reversedNotation = el.notation, picots = el.picots;
      if (el.type !== 'line' && el.notation) {
        reversedNotation = reverseNotation(el.notation);
        const parsed = parseNotation(reversedNotation);
        if (parsed) picots = mergeBEConfigs(parsed.picots, el.picots);
      }
      return { ...el, center: newCenter, paths: newPaths, notation: reversedNotation, picots, rotation: newAngle };
    }));
  };

  // Evaluate a rotation expression string.
  // - Plain number: treated as absolute target degrees
  // - Leading + or -: treated as delta from currentDeg  ("+23" → currentDeg+23)
  // - x or X: substituted with currentDeg             ("x+23" → currentDeg+23)
  // - Arithmetic: +  -  *  /  ( )  and decimals are all allowed
  // Result is always normalised to [0, 360).
  // Returns null if the expression is invalid or unsafe.
  const parseRotationExpr = (str, currentDeg) => {
    const s = str.trim();
    if (!s) return null;
    // Substitute x/X with current value
    let expr = s.replace(/[xX]/g, String(currentDeg ?? 0));
    // Leading + or - with no x means relative to current
    if (/^[+\-]/.test(expr) && !/[xX]/.test(s)) {
      expr = String(currentDeg ?? 0) + expr;
    }
    // Safety whitelist: only digits, operators, parens, dot, whitespace
    if (!/^[\d\s.+\-*/()]+$/.test(expr)) return null;
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function('"use strict"; return (' + expr + ')')();
      if (typeof result !== 'number' || !isFinite(result)) return null;
      return ((result % 360) + 360) % 360;
    } catch { return null; }
  };

  // getBoundingBox — thin wrapper over pure function from ./geometry/layout
  const getBoundingBox = (ids) => getBoundingBoxPure(ids, elements, dsWidth);

  // Fit all elements in view
  const fitAllElements = () => {
    if (elements.length === 0) return;
    if (!canvasRef.current) return;
    
    const allIds = elements.map(e => e.id);
    const bbox = getBoundingBox(allIds);
    if (!bbox) return;
    
    
    // Get actual canvas dimensions
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    
    // Minimal padding - 25px
    const padding = 25;
    
    // Calculate zoom to fit with padding
    const zoomX = (canvasWidth - padding * 2) / bbox.width;
    const zoomY = (canvasHeight - padding * 2) / bbox.height;
    let newZoom = Math.min(zoomX, zoomY);
    
    // Don't zoom in too much or too little
    newZoom = Math.max(0.3, Math.min(3, newZoom));
    
    
    // Camera is a translate offset, not a center point!
    // Transform is: translate(camera.x, camera.y) scale(zoom)
    // To center bbox.center on screen: screenCenter = worldCenter * zoom + camera
    // So: camera = screenCenter - worldCenter * zoom
    const cameraX = (canvasWidth / 2) - (bbox.centerX * newZoom);
    const cameraY = (canvasHeight / 2) - (bbox.centerY * newZoom);
    
    
    setZoom(newZoom);
    setCamera({ x: cameraX, y: cameraY });
    
  };

  // Zoom to a world-coordinate rectangle (marquee zoom).
  // Fits the given world rect to the canvas with a small padding.
  const zoomToRect = (worldMinX, worldMinY, worldMaxX, worldMaxY) => {
    if (!canvasRef.current) return;
    const rw = worldMaxX - worldMinX;
    const rh = worldMaxY - worldMinY;
    if (rw < 1 || rh < 1) return; // too small — ignore accidental clicks
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 20;
    const zoomX = (rect.width  - padding * 2) / rw;
    const zoomY = (rect.height - padding * 2) / rh;
    const newZoom = Math.max(0.1, Math.min(3, Math.min(zoomX, zoomY)));
    const worldCX = (worldMinX + worldMaxX) / 2;
    const worldCY = (worldMinY + worldMaxY) / 2;
    setZoom(newZoom);
    setCamera({ x: rect.width  / 2 - worldCX * newZoom,
                y: rect.height / 2 - worldCY * newZoom });
  };

  // Zoom toward the center of the screen by a delta amount.
  // Reads from refs so it stays correct even when called from stale closures
  // (e.g. the keydown useEffect which only re-registers on clipboard change).
  const zoomToCenter = (delta) => {
    const currentZoom = zoomRef.current;
    const currentCamera = cameraRef.current;
    const newZoom = Math.max(0.1, Math.min(3, currentZoom + delta));
    if (!canvasRef.current) { setZoom(newZoom); return; }
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = rect.width / 2;
    const canvasY = rect.height / 2;
    const worldX = (canvasX - currentCamera.x) / currentZoom;
    const worldY = (canvasY - currentCamera.y) / currentZoom;
    setZoom(newZoom);
    setCamera({ x: canvasX - worldX * newZoom, y: canvasY - worldY * newZoom });
  };

  // NEW: Handle detection for path edit mode (chains and lines)
  const getHandleAtPoint = (element, worldX, worldY) => {
    if ((element.type !== 'chain' && element.type !== 'line') || !element.paths || element.paths.length === 0) return null;
    const handleRadius = 22 / zoom; // Fixed screen-pixel size — matches rendered handle size
    const path = element.paths[0]; // Chains and lines have one path
    
    if (Math.hypot(path.x - worldX, path.y - worldY) < handleRadius) {
      return { type: 'start', elementId: element.id };
    }
    if (Math.hypot(path.endX - worldX, path.endY - worldY) < handleRadius) {
      return { type: 'end', elementId: element.id };
    }
    
    // Support both quadratic and cubic bezier
    if (path.type === 'cubic') {
      // Check control1 first (closer to start)
      if (Math.hypot(path.control1X - worldX, path.control1Y - worldY) < handleRadius) {
        return { type: 'control1', elementId: element.id };
      }
      // Check control2 (closer to end)
      if (Math.hypot(path.control2X - worldX, path.control2Y - worldY) < handleRadius) {
        return { type: 'control2', elementId: element.id };
      }
    } else if (path.type === 'quadratic') {
      // Legacy quadratic support
      if (Math.hypot(path.controlX - worldX, path.controlY - worldY) < handleRadius) {
        return { type: 'control', elementId: element.id };
      }
    }
    
    return null;
  };

  const handleMouseDown = (e) => {
    // Middle click (button 1) = pan, regardless of current tool
    if (e.button === 1) {
      e.preventDefault(); // Prevent default middle-click behavior
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Space + left click = temporary pan (Figma-style), regardless of current tool
    if (e.button === 0 && spaceDownRef.current) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Z + left click = temporary zoom-rect (schematic only)
    if (e.button === 0 && zDownRef.current && renderModeRef.current === 'schematic') {
      e.preventDefault();
      const world = screenToWorld(e.clientX, e.clientY);
      setZoomRectBox({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    // zoomRect tool — persistent toolbar version
    if (currentTool === 'zoomRect' && e.button === 0 && renderModeRef.current === 'schematic') {
      e.preventDefault();
      const world = screenToWorld(e.clientX, e.clientY);
      setZoomRectBox({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }
    
    // Only handle left click for tools
    if (e.button !== 0) return;
    const world = screenToWorld(e.clientX, e.clientY);

    // ── Ruler tool — two-click measurement ──────────────────────────────────
    if (currentTool === 'ruler') {
      if (rulerPoints.length < 2) {
        setRulerPoints(prev => [...prev, { x: world.x, y: world.y }]);
      } else {
        // Third click resets the ruler
        setRulerPoints([]);
        setRulerMousePos(null);
      }
      return;
    }

    // Check for rotation handles and pivot FIRST (when select tool active and elements selected)
    // Disabled in picotJoin / beading modes — only picots/beads are interactive there.
    if (currentTool === 'select' && selectedIds.length > 0 && activeMode !== 'picotJoin' && activeMode !== 'beading') {
      const bbox = getBoundingBox(selectedIds);
      if (bbox) {
        const pivotX = bbox.centerX + pivotOffset.x;
        const pivotY = bbox.centerY + pivotOffset.y;

        // Use getPolarPivot for consistent grid-aware pivot (linked grid → selected panel grid → single visible grid)
        const polarGridPivot = getPolarPivot(selectedIds);
        const effectivePivotX = polarGridPivot ? polarGridPivot.x : pivotX;
        const effectivePivotY = polarGridPivot ? polarGridPivot.y : pivotY;
        
        // Check if clicking pivot point — radius in screen pixels / zoom for consistent click target
        // Always test against the VISUAL pivot position (pivotX/pivotY), not the effective rotation pivot
        if (Math.hypot(pivotX - world.x, pivotY - world.y) < 12 / zoom) {
          setMovingPivot(true);
          setDragStart({ x: world.x, y: world.y });
          isInteractingRef.current = true; // Mark as interacting
          return;
        }
        
        // Check corner handles (10px radius) - ONLY if rotation handles are enabled
        const shouldShowRotationHandles = isShiftHeld || showRotationHandles;
        
        if (shouldShowRotationHandles) {
          const corners = [
            { x: bbox.x, y: bbox.y, name: 'tl' },
            { x: bbox.x + bbox.width, y: bbox.y, name: 'tr' },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height, name: 'br' },
            { x: bbox.x, y: bbox.y + bbox.height, name: 'bl' }
          ];
          
          for (let corner of corners) {
            if (Math.hypot(corner.x - world.x, corner.y - world.y) < 10) {
              setRotationHandle(corner.name);
              setDragStart({ x: world.x, y: world.y, centerX: effectivePivotX, centerY: effectivePivotY });
              isInteractingRef.current = true; // Mark as interacting
              return;
            }
          }
        }
      }
    }

    // NEW: Path edit mode
    if (currentTool === 'path') {
      // Only chains are editable with the path tool
      const isPathEditable = (el) => el.type === 'chain';

      if (selectedIds.length === 1) {
        const selected = elementById.get(selectedIds[0]);
        if (selected && isPathEditable(selected)) {
          const handle = getHandleAtPoint(selected, world.x, world.y);
          if (handle) {
            draggedHandleRef.current = handle;
            lastMousePosRef.current = { x: world.x, y: world.y };
            isInteractingRef.current = true;
            
            const path = selected.paths[0];
            if (path.type === 'cubic') {
              pathDragStartRef.current = {
                startX: world.x,
                startY: world.y,
                control1X: path.control1X,
                control1Y: path.control1Y,
                control2X: path.control2X,
                control2Y: path.control2Y
              };
            } else {
              pathDragStartRef.current = {
                startX: world.x,
                startY: world.y,
                controlX: path.controlX,
                controlY: path.controlY
              };
            }
            return;
          }
        }
      }
      
      // No handle hit — check what was clicked
      const clicked = findClosestElement(world.x, world.y);
      if (clicked) {
        if (isPathEditable(clicked)) {
          // Another path-editable element: stay in path edit, switch to it
          setSelectedIds([clicked.id]);
        } else {
          // Non-path element (e.g. line): exit to select tool
          setSelectedIds([clicked.id]);
          setCurrentTool('select');
        }
      }
      // Empty canvas single click: do nothing — stay in path edit mode
      // (double click on empty canvas exits — handled in onDoubleClick)
    } else if (currentTool === 'line') {
      // Line tool mode - can edit line elements
      if (selectedIds.length === 1) {
        const selected = elementById.get(selectedIds[0]);
        if (selected && selected.type === 'line') {
          const handle = getHandleAtPoint(selected, world.x, world.y);
          if (handle) {
            draggedHandleRef.current = handle;
            lastMousePosRef.current = { x: world.x, y: world.y };
            isInteractingRef.current = true;
            
            // Store initial control points
            const path = selected.paths[0];
            if (path.type === 'cubic') {
              pathDragStartRef.current = {
                startX: world.x,
                startY: world.y,
                control1X: path.control1X,
                control1Y: path.control1Y,
                control2X: path.control2X,
                control2Y: path.control2Y
              };
            }
            return;
          }
        }
      }
      
      // If no handle was clicked, allow selecting a line by clicking on it
      const clicked = findClosestElement(world.x, world.y, el => el.type === 'line');
      if (clicked) {
        setSelectedIds([clicked.id]);
      } else {
        // Create new line on click
        const newLine = {
          id: generateId(),
          type: 'line',
          center: { x: world.x, y: world.y },
          isClosed: false,
          paths: [{
            type: 'cubic',
            x: world.x,
            y: world.y,
            control1X: world.x,
            control1Y: world.y,
            control2X: world.x,
            control2Y: world.y,
            endX: world.x,
            endY: world.y
          }],
          color: '#FFFFFF',
          notation: 'line',
          lineWidth: 2
        };
        setElements(prev => [...prev, newLine]);
        setSelectedIds([newLine.id]);
        // Start dragging the endpoint
        draggedHandleRef.current = { type: 'end', elementId: newLine.id };
        lastMousePosRef.current = { x: world.x, y: world.y };
        isInteractingRef.current = true;
      }
    } else if (currentTool === 'pan') {
      // Pan tool: always pan, never change selection
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeMode === 'tattingOrder') {
      // Tatting Order mode: single-select only regardless of tool, no dragging
      const clicked = findClosestElement(world.x, world.y);
      setSelectedIds(clicked ? [clicked.id] : []);
      setTattingOrderInput(clicked?.orderNumber != null ? String(clicked.orderNumber) : '');
      setShowPropBarGroupDropdown(false);
      setPropBarOrderDraft(null);
      return;
    } else if (currentTool === 'select') {
      // In picotJoin / beading modes, element selection and dragging are disabled —
      // only picots and beads are interactive in those modes.
      if (activeMode === 'picotJoin' || activeMode === 'beading') {
        setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
        return;
      }
      const clicked = findClosestElement(world.x, world.y);
      if (clicked) {
        // Check if clicked element is part of a group
        const groupMembers = clicked.groupId 
          ? elements.filter(el => el.groupId === clicked.groupId).map(el => el.id)
          : [clicked.id];
        
        if (e.ctrlKey || e.shiftKey) {
          // Multi-select: toggle the group or individual element
          setSelectedIds(prev => {
            const allSelected = groupMembers.every(id => prev.includes(id));
            if (allSelected) {
              // Remove all group members
              return prev.filter(id => !groupMembers.includes(id));
            } else {
              // Add all group members
              return [...new Set([...prev, ...groupMembers])];
            }
          });
        } else {
          // Single select: if the click lands on any currently selected element
          // (not just the topmost one), preserve the whole selection and start drag.
          // This handles duplicate-in-place: new elements sit exactly on top of
          // originals, so findClosestElement returns an original that isn't in the
          // new selection — but the click position still hits selected elements.
          const clickHitsSelection = selectedIds.includes(clicked.id) ||
            elements.some(el => selectedIds.includes(el.id) && isPointInElement(el, world.x, world.y));
          if (!clickHitsSelection) {
            setSelectedIds(groupMembers);
          }
          setDraggedElement(clicked.id);
          lastMousePosRef.current = { x: world.x, y: world.y };
          dragOriginRef.current = { x: world.x, y: world.y }; // For ortho axis lock
          isInteractingRef.current = true; // Mark as interacting
        }
      } else {
        if (!e.ctrlKey && !e.shiftKey) setSelectedIds([]);
        setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
      }
    } else if (activeMode === 'picotJoin') {
      // NEW: Picot Join mode - start box selection for joint picots
      setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
    } else if (activeMode === 'beading') {
      // Beading mode: hit-test BE picots; start drag-rect if miss
      let hitBE = null;
      elements.forEach(el => {
        (el.picots || []).forEach(p => {
          if (p.beadType !== 'be') return;
          const pos = getPicotPosition(el, p, true);
          if (!pos) return;
          if (Math.hypot(pos.x - world.x, pos.y - world.y) < 20 / zoom) {
            hitBE = { elementId: el.id, picotId: p.id };
          }
        });
      });
      if (hitBE) {
        const hasModifier = e.shiftKey || e.ctrlKey || e.metaKey;
        if (hasModifier) {
          // Shift/Ctrl+click: toggle in selection
          const alreadySel = selectedBEs.some(s => s.elementId === hitBE.elementId && s.picotId === hitBE.picotId);
          setSelectedBEs(alreadySel
            ? selectedBEs.filter(s => !(s.elementId === hitBE.elementId && s.picotId === hitBE.picotId))
            : [...selectedBEs, hitBE]
          );
        } else {
          setSelectedBEs([hitBE]);
        }
      } else {
        // Start drag-rect selection (same as picotJoin)
        setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
      }
    }
  };

  const handleMouseMove = (e) => {
    // RAF Batching for smooth panning and interaction
    pendingMouseEventRef.current = { clientX: e.clientX, clientY: e.clientY };
    
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const ev = pendingMouseEventRef.current;
        if (ev) handleMouseMoveInternalRef.current?.(ev);
      });
    }
  };
  
  // Internal mouse move handler (actual logic)
  const handleMouseMoveInternal = (e) => {
    const world = screenToWorld(e.clientX, e.clientY);

    // Pivot point movement
    if (movingPivot && dragStart) {
      const dx = world.x - dragStart.x;
      const dy = world.y - dragStart.y;

      // Candidate pivot world position (unsnapped)
      const bbox = getBoundingBox(selectedIds);
      const rawPivotX = pivotOffset.x + dx + (bbox ? bbox.centerX : 0);
      const rawPivotY = pivotOffset.y + dy + (bbox ? bbox.centerY : 0);

      let snapX = rawPivotX;
      let snapY = rawPivotY;

      if (snapEnabled && bbox) {
        const effectiveRadius = snapRadius / zoom;
        let nearestDist = effectiveRadius;

        // Candidate 1: own bbox center (return to origin)
        const d0 = Math.hypot(bbox.centerX - rawPivotX, bbox.centerY - rawPivotY);
        if (d0 < nearestDist) { nearestDist = d0; snapX = bbox.centerX; snapY = bbox.centerY; }

        // Candidate 2: all snap points from all elements (includes picot tips, endpoints, centers)
        for (const el of elements) {
          for (const pt of getSnapPoints(el)) {
            const d = Math.hypot(pt.x - rawPivotX, pt.y - rawPivotY);
            if (d < nearestDist) { nearestDist = d; snapX = pt.x; snapY = pt.y; }
          }
        }

        // Candidate 3: polar grid centers
        for (const grid of polarGrids) {
          if (!grid.visible) continue;
          const d = Math.hypot(grid.center.x - rawPivotX, grid.center.y - rawPivotY);
          if (d < nearestDist) { nearestDist = d; snapX = grid.center.x; snapY = grid.center.y; }
        }
      }

      // Convert world snap position back to offset from bbox center
      setPivotOffset({
        x: snapX - (bbox ? bbox.centerX : 0),
        y: snapY - (bbox ? bbox.centerY : 0),
      });
      setDragStart({ x: world.x, y: world.y });
      return;
    }

    // Rotation handle dragging
    if (rotationHandle && dragStart) {
      const bbox = getBoundingBox(selectedIds);
      if (!bbox) return;

      // Re-resolve polar pivot live — more robust than relying on mousedown capture
      const _polarGrid = (() => {
        if (!selectedIds.length) return null;
        const firstEl = elements.find(e => String(e.id) === String(selectedIds[0]));
        const gid = firstEl?.polarRotationGridId || null;
        if (!gid) return null;
        // All selected elements must share the same grid ID
        if (!selectedIds.every(id => {
          const el = elements.find(e => String(e.id) === String(id));
          return el?.polarRotationGridId === gid;
        })) return null;
        return polarGrids.find(g => g.id === gid) || null;
      })();

      const normalPivotX = dragStart.centerX;
      const normalPivotY = dragStart.centerY;
      const pivotX = _polarGrid ? _polarGrid.center.x : normalPivotX;
      const pivotY = _polarGrid ? _polarGrid.center.y : normalPivotY;
      
      const angle1 = Math.atan2(dragStart.y - pivotY, dragStart.x - pivotX);
      const angle2 = Math.atan2(world.y - pivotY, world.x - pivotX);
      const delta = (angle2 - angle1) * 180 / Math.PI;
      const rad = delta * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      // Calculate new bounding box center by rotating old center around pivot
      const oldCenterRelX = bbox.centerX - pivotX;
      const oldCenterRelY = bbox.centerY - pivotY;
      const newBboxCenterX = pivotX + oldCenterRelX * cos - oldCenterRelY * sin;
      const newBboxCenterY = pivotY + oldCenterRelX * sin + oldCenterRelY * cos;
      
      // Rotate all selected elements around the pivot point
      setElements(prev => prev.map(el => {
        if (!selectedIds.includes(el.id)) return el;
        
        // Calculate element center position relative to pivot
        const relX = el.center.x - pivotX;
        const relY = el.center.y - pivotY;
        
        const newCenterX = pivotX + relX * cos - relY * sin;
        const newCenterY = pivotY + relX * sin + relY * cos;
        
        // Rotate all path points
        const newPaths = el.paths.map(path => {
          const rotatePoint = (px, py) => {
            const rpx = px - pivotX;
            const rpy = py - pivotY;
            return {
              x: pivotX + rpx * cos - rpy * sin,
              y: pivotY + rpx * sin + rpy * cos
            };
          };
          
          const start = rotatePoint(path.x, path.y);
          const end = rotatePoint(path.endX, path.endY);
          
          if (path.type === 'cubic') {
            const c1 = rotatePoint(path.control1X, path.control1Y);
            const c2 = rotatePoint(path.control2X, path.control2Y);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              control1X: c1.x, control1Y: c1.y,
              control2X: c2.x, control2Y: c2.y
            };
          } else {
            const ctrl = rotatePoint(path.controlX, path.controlY);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              controlX: ctrl.x, controlY: ctrl.y
            };
          }
        });
        
        return {
          ...el,
          center: { x: newCenterX, y: newCenterY },
          rotation: (el.rotation || 0) + delta,
          paths: newPaths
        };
      }));
      
      // Update pivot offset to keep pivot in same world position
      // New offset = pivot world position - new bbox center
      setPivotOffset({
        x: pivotX - newBboxCenterX,
        y: pivotY - newBboxCenterY
      });
      
      setDragStart({ x: world.x, y: world.y, centerX: pivotX, centerY: pivotY });
      return;
    }

    // NEW: Path edit mode handle dragging
    // Line tool dragging - simpler than paths, no length constraints
    if (currentTool === 'line' && draggedHandleRef.current) {
      const handleInfo = draggedHandleRef.current;
      setElements(prev => prev.map(el => {
        if (el.id !== handleInfo.elementId || el.type !== 'line' || !el.paths || el.paths.length === 0) return el;

        const path = el.paths[0];
        
        if (handleInfo.type === 'start') {
          // Move start point with snap
          let newX = world.x;
          let newY = world.y;
          
          // SNAP TO POINT: Check if near any snap points
          if (snapEnabled) {
            const snapPoint = findNearestSnapPointWithPolar(world.x, world.y, handleInfo.elementId);
            if (snapPoint) {
              newX = snapPoint.x;
              newY = snapPoint.y;
            }
          }
          
          return {
            ...el,
            paths: [{
              ...path,
              x: newX,
              y: newY,
              // Keep control points on the line — interpolate between new start and existing end
              control1X: newX + (path.endX - newX) * 0.33,
              control1Y: newY + (path.endY - newY) * 0.33
            }],
            center: {
              x: (newX + path.endX) / 2,
              y: (newY + path.endY) / 2
            }
          };
        } else if (handleInfo.type === 'end') {
          // Move end point with snap
          let newX = world.x;
          let newY = world.y;
          
          // SNAP TO POINT: Check if near any snap points
          if (snapEnabled) {
            const snapPoint = findNearestSnapPointWithPolar(world.x, world.y, handleInfo.elementId);
            if (snapPoint) {
              newX = snapPoint.x;
              newY = snapPoint.y;
            }
          }
          
          return {
            ...el,
            paths: [{
              ...path,
              endX: newX,
              endY: newY,
              // Keep control points on the line for straight lines
              control2X: path.x + (newX - path.x) * 0.67,
              control2Y: path.y + (newY - path.y) * 0.67
            }],
            center: {
              x: (path.x + newX) / 2,
              y: (path.y + newY) / 2
            }
          };
        } else if (handleInfo.type === 'control1') {
          // Move control point 1 freely (for curved lines)
          return {
            ...el,
            paths: [{
              ...path,
              control1X: world.x,
              control1Y: world.y
            }]
          };
        } else if (handleInfo.type === 'control2') {
          // Move control point 2 freely (for curved lines)
          return {
            ...el,
            paths: [{
              ...path,
              control2X: world.x,
              control2Y: world.y
            }]
          };
        }
        
        return el;
      }));
    }
    
    if (currentTool === 'path' && draggedHandleRef.current) {
      const handleInfo = draggedHandleRef.current;
      setElements(prev => prev.map(el => {
        if (el.id !== handleInfo.elementId || el.type !== 'chain' || !el.paths || el.paths.length === 0) return el;

        const path = el.paths[0];
        const targetLength = el.stitchCount * dsWidth;
        const tolerance = targetLength * 0.07;

        if (handleInfo.type === 'start') {
          // SMART ENDPOINT DRAGGING:
          // When dragging start point: keep END fixed, adjust control points to maintain length
          
          let newStartX = world.x;
          let newStartY = world.y;
          
          // SNAP TO POINT: Check if near any snap points
          if (snapEnabled) {
            const snapPoint = findNearestSnapPointWithPolar(world.x, world.y, handleInfo.elementId);
            if (snapPoint) {
              newStartX = snapPoint.x;
              newStartY = snapPoint.y;
            }
          }
          
          // CLAMP: Prevent dragging beyond target length (prevents infinite stretching)
          const dx = newStartX - path.endX;
          const dy = newStartY - path.endY;
          const straightLineDist = Math.hypot(dx, dy);
          
          if (straightLineDist > targetLength) {
            // Clamp to target length
            const angle = Math.atan2(dy, dx);
            newStartX = path.endX + Math.cos(angle) * targetLength;
            newStartY = path.endY + Math.sin(angle) * targetLength;
          }
          
          if (path.type === 'cubic') {
            // For cubic bezier: adjust both control points proportionally
            const midX = (newStartX + path.endX) / 2;
            const midY = (newStartY + path.endY) / 2;
            const dx = path.endX - newStartX;
            const dy = path.endY - newStartY;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen === 0) {
              return { ...el, paths: [{ ...path, x: newStartX, y: newStartY }] };
            }
            
            // Calculate average perpendicular offset of old control points
            const oldMidX = (path.x + path.endX) / 2;
            const oldMidY = (path.y + path.endY) / 2;
            const oldOffset1X = path.control1X - oldMidX;
            const oldOffset1Y = path.control1Y - oldMidY;
            const oldOffset2X = path.control2X - oldMidX;
            const oldOffset2Y = path.control2Y - oldMidY;
            const avgDepth = ((oldOffset1X * perpX + oldOffset1Y * perpY) + 
                             (oldOffset2X * perpX + oldOffset2Y * perpY)) / (2 * perpLen);
            const oldSide = Math.sign(avgDepth) || 1;
            
            // Binary search for control point depth (target position)
            let minDepth = 0;
            let maxDepth = targetLength;
            let targetControl1X = midX, targetControl1Y = midY;
            let targetControl2X = midX, targetControl2Y = midY;
            
            for (let iter = 0; iter < 15; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const perpDirX = (perpX / perpLen) * tryDepth * oldSide;
              const perpDirY = (perpY / perpLen) * tryDepth * oldSide;
              
              // Position control points at 1/3 and 2/3 along the line, plus perpendicular offset
              const tryControl1X = newStartX + dx * 0.33 + perpDirX;
              const tryControl1Y = newStartY + dy * 0.33 + perpDirY;
              const tryControl2X = newStartX + dx * 0.67 + perpDirX;
              const tryControl2Y = newStartY + dy * 0.67 + perpDirY;
              
              const tryPath = {
                type: 'cubic',
                x: newStartX,
                y: newStartY,
                endX: path.endX,
                endY: path.endY,
                control1X: tryControl1X,
                control1Y: tryControl1Y,
                control2X: tryControl2X,
                control2Y: tryControl2Y
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              
              if (Math.abs(tryLength - targetLength) < tolerance * 0.5) {
                targetControl1X = tryControl1X;
                targetControl1Y = tryControl1Y;
                targetControl2X = tryControl2X;
                targetControl2Y = tryControl2Y;
                break;
              }
              
              if (tryLength < targetLength) {
                minDepth = tryDepth;
              } else {
                maxDepth = tryDepth;
              }
              
              targetControl1X = tryControl1X;
              targetControl1Y = tryControl1Y;
              targetControl2X = tryControl2X;
              targetControl2Y = tryControl2Y;
            }
            
            // SMOOTH INTERPOLATION: blend between initial and target control points
            let finalControl1X = targetControl1X;
            let finalControl1Y = targetControl1Y;
            let finalControl2X = targetControl2X;
            let finalControl2Y = targetControl2Y;
            
            if (pathDragStartRef.current) {
              // Calculate drag distance as interpolation factor (0 = start, 1 = full)
              const dragDist = Math.hypot(newStartX - pathDragStartRef.current.startX, 
                                         newStartY - pathDragStartRef.current.startY);
              const maxDist = dsWidth * 3; // Reach full target after dragging ~3 stitch widths
              const t = Math.min(1, dragDist / maxDist); // Clamp to [0, 1]
              
              // Interpolate between initial and target
              finalControl1X = pathDragStartRef.current.control1X * (1 - t) + targetControl1X * t;
              finalControl1Y = pathDragStartRef.current.control1Y * (1 - t) + targetControl1Y * t;
              finalControl2X = pathDragStartRef.current.control2X * (1 - t) + targetControl2X * t;
              finalControl2Y = pathDragStartRef.current.control2Y * (1 - t) + targetControl2Y * t;
            }
            
            return { 
              ...el, 
              paths: [{ 
                ...path, 
                x: newStartX, 
                y: newStartY, 
                control1X: finalControl1X, 
                control1Y: finalControl1Y,
                control2X: finalControl2X,
                control2Y: finalControl2Y
              }] 
            };
            
          } else {
            // Quadratic bezier (legacy)
            const midX = (newStartX + path.endX) / 2;
            const midY = (newStartY + path.endY) / 2;
            const dx = path.endX - newStartX;
            const dy = path.endY - newStartY;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen === 0) {
              return { ...el, paths: [{ ...path, x: newStartX, y: newStartY }] };
            }
            
            const oldMidX = (path.x + path.endX) / 2;
            const oldMidY = (path.y + path.endY) / 2;
            const oldOffsetX = path.controlX - oldMidX;
            const oldOffsetY = path.controlY - oldMidY;
            const oldSide = Math.sign(oldOffsetX * perpX + oldOffsetY * perpY) || 1;
            
            let minDepth = 0;
            let maxDepth = targetLength;
            let bestControlX = midX;
            let bestControlY = midY;
            
            for (let iter = 0; iter < 15; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const tryControlX = midX + (perpX / perpLen) * tryDepth * oldSide;
              const tryControlY = midY + (perpY / perpLen) * tryDepth * oldSide;
              
              const tryPath = {
                x: newStartX,
                y: newStartY,
                endX: path.endX,
                endY: path.endY,
                controlX: tryControlX,
                controlY: tryControlY
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              
              if (Math.abs(tryLength - targetLength) < tolerance * 0.5) {
                bestControlX = tryControlX;
                bestControlY = tryControlY;
                break;
              }
              
              if (tryLength < targetLength) {
                minDepth = tryDepth;
              } else {
                maxDepth = tryDepth;
              }
              
              bestControlX = tryControlX;
              bestControlY = tryControlY;
            }
            
            // SMOOTH INTERPOLATION: blend between initial and target control point
            let finalControlX = bestControlX;
            let finalControlY = bestControlY;
            
            if (pathDragStartRef.current) {
              const dragDist = Math.hypot(newStartX - pathDragStartRef.current.startX, 
                                         newStartY - pathDragStartRef.current.startY);
              const maxDist = dsWidth * 3;
              const t = Math.min(1, dragDist / maxDist);
              
              finalControlX = pathDragStartRef.current.controlX * (1 - t) + bestControlX * t;
              finalControlY = pathDragStartRef.current.controlY * (1 - t) + bestControlY * t;
            }
            
            return { ...el, paths: [{ ...path, x: newStartX, y: newStartY, controlX: finalControlX, controlY: finalControlY }] };
          }
        } else if (handleInfo.type === 'end') {
          // SMART ENDPOINT DRAGGING:
          // When dragging end point: keep START fixed, adjust control points to maintain length
          
          let newEndX = world.x;
          let newEndY = world.y;
          
          // SNAP TO POINT: Check if near any snap points
          if (snapEnabled) {
            const snapPoint = findNearestSnapPointWithPolar(world.x, world.y, handleInfo.elementId);
            if (snapPoint) {
              newEndX = snapPoint.x;
              newEndY = snapPoint.y;
            }
          }
          
          // CLAMP: Prevent dragging beyond target length (prevents infinite stretching)
          const dx = newEndX - path.x;
          const dy = newEndY - path.y;
          const straightLineDist = Math.hypot(dx, dy);
          
          if (straightLineDist > targetLength) {
            // Clamp to target length
            const angle = Math.atan2(dy, dx);
            newEndX = path.x + Math.cos(angle) * targetLength;
            newEndY = path.y + Math.sin(angle) * targetLength;
          }
          
          if (path.type === 'cubic') {
            // For cubic bezier: adjust both control points proportionally
            const midX = (path.x + newEndX) / 2;
            const midY = (path.y + newEndY) / 2;
            const dx = newEndX - path.x;
            const dy = newEndY - path.y;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen === 0) {
              return { ...el, paths: [{ ...path, endX: newEndX, endY: newEndY }] };
            }
            
            // Calculate average perpendicular offset of old control points
            const oldMidX = (path.x + path.endX) / 2;
            const oldMidY = (path.y + path.endY) / 2;
            const oldOffset1X = path.control1X - oldMidX;
            const oldOffset1Y = path.control1Y - oldMidY;
            const oldOffset2X = path.control2X - oldMidX;
            const oldOffset2Y = path.control2Y - oldMidY;
            const avgDepth = ((oldOffset1X * perpX + oldOffset1Y * perpY) + 
                             (oldOffset2X * perpX + oldOffset2Y * perpY)) / (2 * perpLen);
            const oldSide = Math.sign(avgDepth) || 1;
            
            // Binary search for control point depth
            let minDepth = 0;
            let maxDepth = targetLength;
            let bestControl1X = midX, bestControl1Y = midY;
            let bestControl2X = midX, bestControl2Y = midY;
            
            for (let iter = 0; iter < 15; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const perpDirX = (perpX / perpLen) * tryDepth * oldSide;
              const perpDirY = (perpY / perpLen) * tryDepth * oldSide;
              
              // Position control points at 1/3 and 2/3 along the line, plus perpendicular offset
              const tryControl1X = path.x + dx * 0.33 + perpDirX;
              const tryControl1Y = path.y + dy * 0.33 + perpDirY;
              const tryControl2X = path.x + dx * 0.67 + perpDirX;
              const tryControl2Y = path.y + dy * 0.67 + perpDirY;
              
              const tryPath = {
                type: 'cubic',
                x: path.x,
                y: path.y,
                endX: newEndX,
                endY: newEndY,
                control1X: tryControl1X,
                control1Y: tryControl1Y,
                control2X: tryControl2X,
                control2Y: tryControl2Y
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              
              if (Math.abs(tryLength - targetLength) < tolerance * 0.5) {
                bestControl1X = tryControl1X;
                bestControl1Y = tryControl1Y;
                bestControl2X = tryControl2X;
                bestControl2Y = tryControl2Y;
                break;
              }
              
              if (tryLength < targetLength) {
                minDepth = tryDepth;
              } else {
                maxDepth = tryDepth;
              }
              
              bestControl1X = tryControl1X;
              bestControl1Y = tryControl1Y;
              bestControl2X = tryControl2X;
              bestControl2Y = tryControl2Y;
            }
            
            // SMOOTH INTERPOLATION: blend between initial and target control points
            let finalControl1X = bestControl1X;
            let finalControl1Y = bestControl1Y;
            let finalControl2X = bestControl2X;
            let finalControl2Y = bestControl2Y;
            
            if (pathDragStartRef.current) {
              const dragDist = Math.hypot(newEndX - pathDragStartRef.current.startX, 
                                         newEndY - pathDragStartRef.current.startY);
              const maxDist = dsWidth * 3;
              const t = Math.min(1, dragDist / maxDist);
              
              finalControl1X = pathDragStartRef.current.control1X * (1 - t) + bestControl1X * t;
              finalControl1Y = pathDragStartRef.current.control1Y * (1 - t) + bestControl1Y * t;
              finalControl2X = pathDragStartRef.current.control2X * (1 - t) + bestControl2X * t;
              finalControl2Y = pathDragStartRef.current.control2Y * (1 - t) + bestControl2Y * t;
            }
            
            return { 
              ...el, 
              paths: [{ 
                ...path, 
                endX: newEndX, 
                endY: newEndY, 
                control1X: finalControl1X, 
                control1Y: finalControl1Y,
                control2X: finalControl2X,
                control2Y: finalControl2Y
              }] 
            };
            
          } else {
            // Quadratic bezier (legacy)
            const midX = (path.x + newEndX) / 2;
            const midY = (path.y + newEndY) / 2;
            const dx = newEndX - path.x;
            const dy = newEndY - path.y;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen === 0) {
              return { ...el, paths: [{ ...path, endX: newEndX, endY: newEndY }] };
            }
            
            const oldMidX = (path.x + path.endX) / 2;
            const oldMidY = (path.y + path.endY) / 2;
            const oldOffsetX = path.controlX - oldMidX;
            const oldOffsetY = path.controlY - oldMidY;
            const oldSide = Math.sign(oldOffsetX * perpX + oldOffsetY * perpY) || 1;
            
            let minDepth = 0;
            let maxDepth = targetLength;
            let bestControlX = midX;
            let bestControlY = midY;
            
            for (let iter = 0; iter < 15; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const tryControlX = midX + (perpX / perpLen) * tryDepth * oldSide;
              const tryControlY = midY + (perpY / perpLen) * tryDepth * oldSide;
              
              const tryPath = {
                x: path.x,
                y: path.y,
                endX: newEndX,
                endY: newEndY,
                controlX: tryControlX,
                controlY: tryControlY
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              
              if (Math.abs(tryLength - targetLength) < tolerance * 0.5) {
                bestControlX = tryControlX;
                bestControlY = tryControlY;
                break;
              }
              
              if (tryLength < targetLength) {
                minDepth = tryDepth;
              } else {
                maxDepth = tryDepth;
              }
              
              bestControlX = tryControlX;
              bestControlY = tryControlY;
            }
            
            // SMOOTH INTERPOLATION: blend between initial and target control point
            let finalControlX = bestControlX;
            let finalControlY = bestControlY;
            
            if (pathDragStartRef.current) {
              const dragDist = Math.hypot(newEndX - pathDragStartRef.current.startX, 
                                         newEndY - pathDragStartRef.current.startY);
              const maxDist = dsWidth * 3;
              const t = Math.min(1, dragDist / maxDist);
              
              finalControlX = pathDragStartRef.current.controlX * (1 - t) + bestControlX * t;
              finalControlY = pathDragStartRef.current.controlY * (1 - t) + bestControlY * t;
            }
            
            return { ...el, paths: [{ ...path, endX: newEndX, endY: newEndY, controlX: finalControlX, controlY: finalControlY }] };
          }
        } else if (handleInfo.type === 'control' || handleInfo.type === 'control1' || handleInfo.type === 'control2') {
          // CUBIC BEZIER SMART BENDING:
          // For cubic bezier, we have 2 control points
          // - control1: closer to start, adjust end point to maintain length
          // - control2: closer to end, adjust start point to maintain length
          // For quadratic (legacy): single control point, adjust end point
          
          const newControlX = world.x;
          const newControlY = world.y;
          
          if (path.type === 'cubic') {
            if (handleInfo.type === 'control1') {
              // - User drags control1 to a new position
              // - Start and End points stay FIXED
              // - Adjust control2 length (same angle) to maintain path length
              // - If control1 alone exceeds targetLength, clamp it first

              const P0 = { x: path.x, y: path.y };
              const P3 = { x: path.endX, y: path.endY };
              let P1_new = { x: newControlX, y: newControlY };

              // Calculate control1's handle vector (from start)
              const handle1_dx = P1_new.x - P0.x;
              const handle1_dy = P1_new.y - P0.y;
              const handle1_angle = Math.atan2(handle1_dy, handle1_dx);

              // Get old control2's handle vector (from end) - preserve its angle
              const old_c2_dx = path.control2X - P3.x;
              const old_c2_dy = path.control2Y - P3.y;
              const old_c2_angle = Math.atan2(old_c2_dy, old_c2_dx);

              // PRE-CLAMP: check if control1 alone (with control2=0) already exceeds targetLength
              const minPathWithC1 = calculatePathLength(sampleBezierPath({
                type: 'cubic',
                x: P0.x, y: P0.y,
                control1X: P1_new.x, control1Y: P1_new.y,
                control2X: P3.x, control2Y: P3.y,  // control2 at zero length
                endX: P3.x, endY: P3.y
              }, 20));

              if (minPathWithC1 > targetLength) {
                // Binary search: find max handle1 length along same angle that keeps path <= targetLength
                let minH = 0;
                let maxH = Math.hypot(handle1_dx, handle1_dy);
                for (let iter = 0; iter < 20; iter++) {
                  const tryH = (minH + maxH) / 2;
                  const tryLen = calculatePathLength(sampleBezierPath({
                    type: 'cubic',
                    x: P0.x, y: P0.y,
                    control1X: P0.x + Math.cos(handle1_angle) * tryH,
                    control1Y: P0.y + Math.sin(handle1_angle) * tryH,
                    control2X: P3.x, control2Y: P3.y,
                    endX: P3.x, endY: P3.y
                  }, 20));
                  if (tryLen > targetLength) maxH = tryH;
                  else minH = tryH;
                }
                P1_new = {
                  x: P0.x + Math.cos(handle1_angle) * minH,
                  y: P0.y + Math.sin(handle1_angle) * minH
                };
              }

              // Binary search for control2 handle length that hits targetLength exactly
              let minLen = 0;
              let maxLen = targetLength;
              let bestP2 = { x: path.control2X, y: path.control2Y };
              let bestLengthDiff = Infinity;

              for (let iter = 0; iter < 20; iter++) {
                const c2_length = (minLen + maxLen) / 2;
                const P2_try = {
                  x: P3.x + Math.cos(old_c2_angle) * c2_length,
                  y: P3.y + Math.sin(old_c2_angle) * c2_length
                };
                const tryPath = {
                  type: 'cubic',
                  x: P0.x, y: P0.y,
                  control1X: P1_new.x, control1Y: P1_new.y,
                  control2X: P2_try.x, control2Y: P2_try.y,
                  endX: P3.x, endY: P3.y
                };
                const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
                const lengthDiff = Math.abs(tryLength - targetLength);
                if (lengthDiff < bestLengthDiff) { bestLengthDiff = lengthDiff; bestP2 = P2_try; }
                if (lengthDiff < tolerance * 0.5) break;
                if (tryLength < targetLength) minLen = c2_length;
                else maxLen = c2_length;
              }

              return {
                ...el,
                paths: [{
                  ...path,
                  control1X: P1_new.x,
                  control1Y: P1_new.y,
                  control2X: bestP2.x,
                  control2Y: bestP2.y
                }]
              };
              
            } else if (handleInfo.type === 'control2') {
              // - User drags control2 to a new position
              // - Start and End points stay FIXED
              // - Adjust control1 length (same angle) to maintain path length
              // - If control2 alone exceeds targetLength, clamp it first

              const P0 = { x: path.x, y: path.y };
              const P3 = { x: path.endX, y: path.endY };
              let P2_new = { x: newControlX, y: newControlY };

              // Calculate control2's handle vector (from end)
              const handle2_dx = P2_new.x - P3.x;
              const handle2_dy = P2_new.y - P3.y;
              const handle2_angle = Math.atan2(handle2_dy, handle2_dx);

              // Get old control1's handle vector (from start) - preserve its angle
              const old_c1_dx = path.control1X - P0.x;
              const old_c1_dy = path.control1Y - P0.y;
              const old_c1_angle = Math.atan2(old_c1_dy, old_c1_dx);

              // PRE-CLAMP: check if control2 alone (with control1=0) already exceeds targetLength
              const minPathWithC2 = calculatePathLength(sampleBezierPath({
                type: 'cubic',
                x: P0.x, y: P0.y,
                control1X: P0.x, control1Y: P0.y,  // control1 at zero length
                control2X: P2_new.x, control2Y: P2_new.y,
                endX: P3.x, endY: P3.y
              }, 20));

              if (minPathWithC2 > targetLength) {
                let minH = 0;
                let maxH = Math.hypot(handle2_dx, handle2_dy);
                for (let iter = 0; iter < 20; iter++) {
                  const tryH = (minH + maxH) / 2;
                  const tryLen = calculatePathLength(sampleBezierPath({
                    type: 'cubic',
                    x: P0.x, y: P0.y,
                    control1X: P0.x, control1Y: P0.y,
                    control2X: P3.x + Math.cos(handle2_angle) * tryH,
                    control2Y: P3.y + Math.sin(handle2_angle) * tryH,
                    endX: P3.x, endY: P3.y
                  }, 20));
                  if (tryLen > targetLength) maxH = tryH;
                  else minH = tryH;
                }
                P2_new = {
                  x: P3.x + Math.cos(handle2_angle) * minH,
                  y: P3.y + Math.sin(handle2_angle) * minH
                };
              }

              // Binary search for control1 handle length that hits targetLength exactly
              let minLen = 0;
              let maxLen = targetLength;
              let bestP1 = { x: path.control1X, y: path.control1Y };
              let bestLengthDiff = Infinity;

              for (let iter = 0; iter < 20; iter++) {
                const c1_length = (minLen + maxLen) / 2;
                const P1_try = {
                  x: P0.x + Math.cos(old_c1_angle) * c1_length,
                  y: P0.y + Math.sin(old_c1_angle) * c1_length
                };
                const tryPath = {
                  type: 'cubic',
                  x: P0.x, y: P0.y,
                  control1X: P1_try.x, control1Y: P1_try.y,
                  control2X: P2_new.x, control2Y: P2_new.y,
                  endX: P3.x, endY: P3.y
                };
                const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
                const lengthDiff = Math.abs(tryLength - targetLength);
                if (lengthDiff < bestLengthDiff) { bestLengthDiff = lengthDiff; bestP1 = P1_try; }
                if (lengthDiff < tolerance * 0.5) break;
                if (tryLength < targetLength) minLen = c1_length;
                else maxLen = c1_length;
              }

              return {
                ...el,
                paths: [{
                  ...path,
                  control1X: bestP1.x,
                  control1Y: bestP1.y,
                  control2X: P2_new.x,
                  control2Y: P2_new.y
                }]
              };
            }
          } else if (path.type === 'quadratic') {
            // QUADRATIC BEZIER (legacy) - single control point adjusts end
            const dx = newControlX - path.x;
            const dy = newControlY - path.y;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen < 1) {
              return { ...el, paths: [{ ...path, controlX: newControlX, controlY: newControlY }] };
            }
            
            const perpDirX = perpX / perpLen;
            const perpDirY = perpY / perpLen;
            const oldOffsetX = path.endX - path.x;
            const oldOffsetY = path.endY - path.y;
            const oldSide = Math.sign(oldOffsetX * perpDirX + oldOffsetY * perpDirY) || 1;
            
            let minDist = 0;
            let maxDist = targetLength * 2;
            let bestEndX = path.endX;
            let bestEndY = path.endY;
            let bestLengthDiff = Infinity;
            
            for (let iter = 0; iter < 20; iter++) {
              const tryDist = (minDist + maxDist) / 2;
              const tryEndX = path.x + perpDirX * tryDist * oldSide;
              const tryEndY = path.y + perpDirY * tryDist * oldSide;
              
              const tryPath = {
                x: path.x,
                y: path.y,
                endX: tryEndX,
                endY: tryEndY,
                controlX: newControlX,
                controlY: newControlY
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              const lengthDiff = Math.abs(tryLength - targetLength);
              
              if (lengthDiff < bestLengthDiff) {
                bestLengthDiff = lengthDiff;
                bestEndX = tryEndX;
                bestEndY = tryEndY;
              }
              
              if (lengthDiff < tolerance * 0.5) break;
              
              if (tryLength < targetLength) {
                minDist = tryDist;
              } else {
                maxDist = tryDist;
              }
            }
            
            return { 
              ...el, 
              paths: [{ 
                ...path, 
                controlX: newControlX, 
                controlY: newControlY,
                endX: bestEndX,
                endY: bestEndY
              }] 
            };
          }
        }
        return el;
      }));

      lastMousePosRef.current = { x: world.x, y: world.y };
      return; // Don't process other tools while dragging handle
    }
    
    // Pan mode - middle-click or Pan tool (check BEFORE other tools)
    if (isDragging && dragStart) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setCamera(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return; // Don't process other tools while panning
    }
    
    if (currentTool === 'select') {
      if (draggedElement && lastMousePosRef.current) {
        let deltaX = world.x - lastMousePosRef.current.x;
        let deltaY = world.y - lastMousePosRef.current.y;
        
        // Ortho lock: constrain to dominant axis (Shift key held OR toggle active)
        if (orthoLock || isShiftHeld) {
          const origin = dragOriginRef.current;
          if (origin) {
            const totalDX = world.x - origin.x;
            const totalDY = world.y - origin.y;
            if (Math.abs(totalDX) >= Math.abs(totalDY)) {
              deltaY = 0; // Lock to X axis
            } else {
              deltaX = 0; // Lock to Y axis
            }
          }
        }
        
        // NOTE: Mid-drag snap was removed — it conflicted with the drag-via-refs pattern.
        // dragOffsetRef accumulates total offset, but the old snap block used only the
        // per-frame deltaX/deltaY against the original element position, causing snap targets
        // near the origin to override the delta and pull the element backward (opposite direction).
        // Snapping is now handled correctly in one shot on mouseup (snap-on-drop).
        
        // PERFORMANCE: Accumulate drag offset in a ref instead of mutating elements state
        // every frame. The SVG transform below handles the visual update. setElements is
        // called once on mouseup — so stitchCache/elementById stay valid all drag long.
        dragOffsetRef.current.dx += deltaX;
        dragOffsetRef.current.dy += deltaY;
        dragOffsetRef.current.active = true;
        lastMousePosRef.current = { x: world.x, y: world.y };
        setDragTick(t => t + 1); // lightweight re-render trigger (no useMemo invalidation)
      } else if (selectionBox) {
        setSelectionBox({ ...selectionBox, width: world.x - selectionBox.x, height: world.y - selectionBox.y });
      }
    } else if (activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder' || activeMode === 'tattingOrder') {
      // Update selection box for picot join / beading modes
      if (selectionBox) {
        setSelectionBox({ ...selectionBox, width: world.x - selectionBox.x, height: world.y - selectionBox.y });
      }
    }

    // ── Ruler: track live cursor position for rubber-band preview ───────────
    if (currentTool === 'ruler' && rulerPoints.length === 1) {
      setRulerMousePos({ x: world.x, y: world.y });
    }

    // ── Zoom rect: update drag rectangle ────────────────────────────────────
    if (zoomRectBox) {
      setZoomRectBox(prev => prev ? { ...prev, width: world.x - prev.x, height: world.y - prev.y } : null);
    }
  };
  // Keep ref pointing at the latest version of this function.
  // The RAF in handleMouseMove captures a stale closure; routing through this ref
  // ensures it always calls the current version with fresh state/memos.
  handleMouseMoveInternalRef.current = handleMouseMoveInternal;

  const handleMouseUp = (e) => {
    // ── Zoom rect: apply zoom on release ──────────────────────────────────
    if (zoomRectBox) {
      const minX = Math.min(zoomRectBox.x, zoomRectBox.x + zoomRectBox.width);
      const maxX = Math.max(zoomRectBox.x, zoomRectBox.x + zoomRectBox.width);
      const minY = Math.min(zoomRectBox.y, zoomRectBox.y + zoomRectBox.height);
      const maxY = Math.max(zoomRectBox.y, zoomRectBox.y + zoomRectBox.height);
      zoomToRect(minX, minY, maxX, maxY);
      setZoomRectBox(null);
      return;
    }

    if (selectionBox) {
      const minX = Math.min(selectionBox.x, selectionBox.x + selectionBox.width);
      const maxX = Math.max(selectionBox.x, selectionBox.x + selectionBox.width);
      const minY = Math.min(selectionBox.y, selectionBox.y + selectionBox.height);
      const maxY = Math.max(selectionBox.y, selectionBox.y + selectionBox.height);
      
      if (activeMode === 'beading') {
        // Select BE picots in drag rect
        const boxBEs = [];
        elements.forEach(el => {
          (el.picots || []).forEach(p => {
            if (p.beadType !== 'be') return;
            const pos = getPicotPosition(el, p, true);
            if (!pos) return;
            if (pos.x >= minX - 5 && pos.x <= maxX + 5 && pos.y >= minY - 5 && pos.y <= maxY + 5) {
              boxBEs.push({ elementId: el.id, picotId: p.id });
            }
          });
        });
        const boxW = Math.abs(selectionBox.width);
        const boxH = Math.abs(selectionBox.height);
        const isClick = boxW < 15 && boxH < 15;
        const hasModifier = e?.shiftKey || e?.ctrlKey || e?.metaKey;
        if (!isClick) {
          if (hasModifier) {
            setSelectedBEs(prev => {
              const merged = [...prev];
              boxBEs.forEach(nb => { if (!merged.some(s => s.elementId === nb.elementId && s.picotId === nb.picotId)) merged.push(nb); });
              return merged;
            });
          } else {
            setSelectedBEs(boxBEs);
          }
        } else if (!hasModifier && boxBEs.length === 0) {
          setSelectedBEs([]); // click on empty = deselect all
        }
      } else if (activeMode === 'picotJoin') {
        // NEW: Select joint picots in box
        const selectedJointPicots = [];
        
        elements.forEach(el => {
          if (!el.picots) return;
          
          el.picots.forEach(picot => {
            if (!picot.isJoint) return; // Only joint picots
            
            // Get picot TIP position
            const picotPos = getPicotPosition(el, picot);
            if (!picotPos) return;
            
            // Check if in selection box (with a bit of tolerance)
            const tolerance = 5; // Make selection easier
            if (picotPos.x >= minX - tolerance && picotPos.x <= maxX + tolerance && 
                picotPos.y >= minY - tolerance && picotPos.y <= maxY + tolerance) {
              selectedJointPicots.push({ elementId: el.id, picotId: picot.id });
            }
          });
        });
        
        // Check if this was a click (small box) vs drag
        // Use 15px threshold — mobile fingers can drift during a tap
        const boxWidth = Math.abs(selectionBox.width);
        const boxHeight = Math.abs(selectionBox.height);
        const isClick = boxWidth < 15 && boxHeight < 15;
        const hasModifier = e?.shiftKey || e?.ctrlKey || e?.metaKey;
        
        if (isClick && selectedJointPicots.length > 0 && hasModifier) {
          // Shift/Ctrl+Click: Toggle selection
          const clickedPicot = selectedJointPicots[0];
          const alreadySelected = selectedPicots.some(sp => 
            sp.elementId === clickedPicot.elementId && sp.picotId === clickedPicot.picotId
          );
          
          if (alreadySelected) {
            // Remove from selection
            setSelectedPicots(selectedPicots.filter(sp => 
              !(sp.elementId === clickedPicot.elementId && sp.picotId === clickedPicot.picotId)
            ));
          } else {
            // Add to selection
            setSelectedPicots([...selectedPicots, clickedPicot]);
          }
        } else if (!isClick && hasModifier) {
          // Shift/Ctrl+Drag: Add to selection
          setSelectedPicots([...selectedPicots, ...selectedJointPicots.filter(sp => 
            !selectedPicots.some(existing => 
              existing.elementId === sp.elementId && existing.picotId === sp.picotId
            )
          )]);
        } else {
          // Normal click/drag: Replace selection
          setSelectedPicots(selectedJointPicots);
        }
      } else {
        // Regular element selection
        const boxHit = elements.filter(el =>
          el.center.x >= minX && el.center.x <= maxX && el.center.y >= minY && el.center.y <= maxY
        );
        // Groups: only select a group if ALL its members are inside the box
        const boxHitIds = new Set(boxHit.map(el => el.id));
        const filteredIds = new Set<string | number>();
        boxHit.forEach(el => {
          if (el.groupId) {
            const allMembers = elements.filter(e => e.groupId === el.groupId);
            if (allMembers.every(e => boxHitIds.has(e.id))) {
              allMembers.forEach(e => filteredIds.add(e.id));
            }
          } else {
            filteredIds.add(el.id);
          }
        });
        const boxSelected = [...filteredIds];
        if (activeMode === 'tattingOrder') {
          // Single-select only — take the first hit if any, clear if none
          const single = boxSelected.length > 0 ? [boxSelected[0]] : [];
          setSelectedIds(single);
          const el = elements.find(e => e.id === single[0]);
          setTattingOrderInput(el?.orderNumber != null ? String(el.orderNumber) : '');
        } else {
          setSelectedIds(prev => [...new Set([...prev, ...boxSelected])]);
        }
      }
      
      setSelectionBox(null);
    }
    
    // If we were interacting and changes were made, push to history
    if (isInteractingRef.current && needsHistoryPushRef.current) {
      pushHistoryState(elements, picotConnections, orderGroupsRef.current);
    }
    
    // Reset interaction flags
    isInteractingRef.current = false;
    needsHistoryPushRef.current = false;
    
    setIsDragging(false);
    setDragStart(null);
    // PERFORMANCE: Commit accumulated drag offset to elements state on mouseup (one write per drag)
    if (dragOffsetRef.current.active) {
      let { dx, dy } = dragOffsetRef.current;

      // SNAP-ON-DROP: check if any snap point of the dragged element lands near a target snap point.
      // We only do this for single-element drags (multi-element drags keep freeform position).
      if (snapEnabled && selectedIdsRef.current.length === 1) {
        const draggedEl = elementsRef.current.find(e => e.id === selectedIdsRef.current[0]);
        if (draggedEl) {
          // Build the element's snap points at their new (post-drag) position
          const movedEl = {
            ...draggedEl,
            center: { x: draggedEl.center.x + dx, y: draggedEl.center.y + dy },
            paths: draggedEl.paths.map(p => p.type === 'cubic'
              ? { ...p, x: p.x+dx, y: p.y+dy, endX: p.endX+dx, endY: p.endY+dy,
                  control1X: p.control1X+dx, control1Y: p.control1Y+dy,
                  control2X: p.control2X+dx, control2Y: p.control2Y+dy }
              : { ...p, x: p.x+dx, y: p.y+dy, endX: p.endX+dx, endY: p.endY+dy,
                  controlX: p.controlX+dx, controlY: p.controlY+dy }),
          };
          const mySnapPoints = getSnapPoints(movedEl);
          const excludedIds = new Set(selectedIdsRef.current);
          const effectiveSnapRadius = snapRadius / zoomRef.current;
          let bestSnapDx = 0, bestSnapDy = 0, bestDist = effectiveSnapRadius;
          for (const myPt of mySnapPoints) {
            const target = findNearestSnapPointWithPolar(myPt.x, myPt.y, excludedIds);
            if (target) {
              const dist = Math.hypot(target.x - myPt.x, target.y - myPt.y);
              if (dist < bestDist) {
                bestDist = dist;
                bestSnapDx = target.x - myPt.x;
                bestSnapDy = target.y - myPt.y;
              }
            }
          }
          dx += bestSnapDx;
          dy += bestSnapDy;
        }
      }

      setElements(prev => prev.map(el => {
        if (!selectedIdsRef.current.includes(el.id)) return el;
        const newPaths = el.paths.map(path => path.type === 'cubic'
          ? { ...path, x: path.x+dx, y: path.y+dy, endX: path.endX+dx, endY: path.endY+dy,
              control1X: path.control1X+dx, control1Y: path.control1Y+dy,
              control2X: path.control2X+dx, control2Y: path.control2Y+dy }
          : { ...path, x: path.x+dx, y: path.y+dy, endX: path.endX+dx, endY: path.endY+dy,
              controlX: path.controlX+dx, controlY: path.controlY+dy });
        return { ...el, center: { x: el.center.x+dx, y: el.center.y+dy }, paths: newPaths };
      }));
      dragOffsetRef.current = { active: false, dx: 0, dy: 0 };
    }
    lastMousePosRef.current = null;
    dragTouchIdRef.current = null;
    setDraggedElement(null);
    draggedHandleRef.current = null; // NEW: clear path edit handle
    pathDragStartRef.current = null; // Clear interpolation start data
    setRotationHandle(null);         // NEW: clear rotation handle
    setMovingPivot(false);           // NEW: clear pivot movement

    // Minimum line length guard — remove lines that were placed as accidental dots.
    // A line whose start and end are within 12 world-units of each other is a misclick.
    setElements(prev => prev.filter(el => {
      if (el.type !== 'line' || !el.paths || el.paths.length === 0) return true;
      const path = el.paths[0];
      const len = Math.hypot((path.endX ?? path.x) - path.x, (path.endY ?? path.y) - path.y);
      return len >= 12;
    }));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Undo: Ctrl+Z (not Shift)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      
      // Redo: Shift+Z
      if ((e.key === 'z' || e.key === 'Z') && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        redo();
        return;
      }
      
      // Group: Ctrl+G (not Shift)
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
        return;
      }
      
      // Ungroup: Shift+G
      if ((e.key === 'g' || e.key === 'G') && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        ungroupSelected();
        return;
      }
      
      // New: Ctrl+N
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newCanvas();
        return;
      }
      
      // Save: Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
        return;
      }
      
      // Toggle render mode: V key (WITHOUT Ctrl/Cmd)
      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSetRenderMode(renderMode === 'schematic' ? 'realistic' : 'schematic');
        return;
      }

      // Select All: Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(elementsRef.current.map(el => el.id));
        return;
      }

      // Zoom in/out: + / - (no modifier needed)
      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomToCenter(0.1);
        return;
      }
      if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomToCenter(-0.1);
        return;
      }
      
      // Fit all elements: F key (WITHOUT Ctrl/Cmd)
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fitAllElements();
        return;
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (activeModeRef.current === 'picotJoin' && selectedPicotsRef.current.length > 0) {
          const newConns = picotConnectionsRef.current.filter(conn =>
            !conn.picots.some(p => selectedPicotsRef.current.some(sp => sp.elementId === p.elementId && sp.picotId === p.picotId))
          );
          setPicotConnections(newConns);
          setSelectedPicots([]);
          pushHistoryState(elementsRef.current, newConns, orderGroupsRef.current);
        } else {
          deleteSelected();
        }
      } else if ((e.key === 'j' || e.key === 'J') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (activeModeRef.current === 'picotJoin' && selectedPicotsRef.current.length >= 2) {
          e.preventDefault();
          const connection = { id: generateId(), picots: [...selectedPicotsRef.current] };
          const newConns = [...picotConnectionsRef.current, connection];
          setPicotConnections(newConns);
          setSelectedPicots([]);
          pushHistoryState(elementsRef.current, newConns, orderGroupsRef.current);
        }
      } else if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (activeModeRef.current === 'picotJoin' && selectedPicotsRef.current.length > 0) {
          e.preventDefault();
          const newConns = picotConnectionsRef.current.filter(conn =>
            !conn.picots.some(p => selectedPicotsRef.current.some(sp => sp.elementId === p.elementId && sp.picotId === p.picotId))
          );
          setPicotConnections(newConns);
          setSelectedPicots([]);
          pushHistoryState(elementsRef.current, newConns, orderGroupsRef.current);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setCurrentTool(prev => prev === 'pan' ? 'select' : 'pan');
      } else if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        duplicateInPlace();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        if (activeModeRef.current === 'beading') {
          // Copy the last selected BE's config to the BE clipboard
          const bes = selectedBEsRef.current;
          if (bes.length === 0) return;
          const lastBE = bes[bes.length - 1];
          const el = elementsRef.current.find(e => e.id === lastBE.elementId);
          const p = el?.picots?.find(p => p.id === lastBE.picotId);
          if (p) setBeClipboard({
            beStructure: p.beStructure || 'core',
            beIsJoint: p.beIsJoint || false,
            coreBeads: [...(p.coreBeads || [null, null, null])],
            picotBeads: [...(p.picotBeads || [null, null, null])],
          });
        } else {
          // Copy selected elements using refs
          if (selectedIdsRef.current.length > 0) {
            const selectedElements = elementsRef.current.filter(el => selectedIdsRef.current.includes(el.id));
            const cloned = JSON.parse(JSON.stringify(selectedElements)); // Deep clone
            setClipboard(cloned);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        if (activeModeRef.current === 'beading') {
          // Cut: copy the last selected BE config then reset all selected BEs to defaults
          const bes = selectedBEsRef.current;
          if (bes.length === 0) return;
          const lastBE = bes[bes.length - 1];
          const el = elementsRef.current.find(e => e.id === lastBE.elementId);
          const p = el?.picots?.find(p => p.id === lastBE.picotId);
          if (p) {
            setBeClipboard({
              beStructure: p.beStructure || 'core',
              beIsJoint: p.beIsJoint || false,
              coreBeads: [...(p.coreBeads || [null, null, null])],
              picotBeads: [...(p.picotBeads || [null, null, null])],
            });
            setElements(prev => prev.map(el2 => {
              const toReset = bes.filter(s => s.elementId === el2.id);
              if (toReset.length === 0) return el2;
              const newPicots = (el2.picots || []).map(pp =>
                toReset.some(s => s.picotId === pp.id)
                  ? { ...pp, beStructure: 'core', beIsJoint: false, coreBeads: [null, null, null], picotBeads: [null, null, null] }
                  : pp
              );
              return { ...el2, picots: newPicots, beConfigs: extractBEConfigs(newPicots) };
            }));
          }
        } else {
          // Cut selected elements: copy then delete
          const ids = selectedIdsRef.current;
          if (ids.length === 0) return;
          const selectedElements = elementsRef.current.filter(el => ids.includes(el.id));
          setClipboard(JSON.parse(JSON.stringify(selectedElements)));
          setElements(prev => prev.filter(e => !ids.includes(e.id)));
          setSelectedIds([]);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (activeModeRef.current === 'beading') {
          // Paste BE clipboard to all currently selected BEs
          const bc = beClipboardRef.current;
          const bes = selectedBEsRef.current;
          if (!bc || bes.length === 0) return;
          setElements(prev => prev.map(el => {
            const toUpdate = bes.filter(s => s.elementId === el.id);
            if (toUpdate.length === 0) return el;
            const newPicots = (el.picots || []).map(p =>
              toUpdate.some(s => s.picotId === p.id)
                ? { ...p, beStructure: bc.beStructure, beIsJoint: bc.beIsJoint, coreBeads: [...bc.coreBeads], picotBeads: [...bc.picotBeads] }
                : p
            );
            return { ...el, picots: newPicots, beConfigs: extractBEConfigs(newPicots) };
          }));
        } else {
          pasteFromClipboard();
        }

      // ── Add-element & mode shortcuts (Shift + key, no Ctrl/Cmd) ────────────
      } else if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'r') {
          // Shift+R — Add Ring (disabled in special modes)
          if (activeModeRef.current !== 'picotJoin' && activeModeRef.current !== 'beading' && activeModeRef.current !== 'tattingOrder') {
            e.preventDefault(); addRing();
          }
        } else if (k === 'c') {
          // Shift+C — Add Chain
          if (activeModeRef.current !== 'picotJoin' && activeModeRef.current !== 'beading' && activeModeRef.current !== 'tattingOrder') {
            e.preventDefault(); addChain();
          }
        } else if (k === 's') {
          // Shift+S — Add Split Ring
          if (activeModeRef.current !== 'picotJoin' && activeModeRef.current !== 'beading' && activeModeRef.current !== 'tattingOrder') {
            e.preventDefault(); addSplitRing();
          }
        } else if (k === 'l') {
          // Shift+L — Line tool toggle
          if (activeModeRef.current !== 'picotJoin' && activeModeRef.current !== 'beading' && activeModeRef.current !== 'tattingOrder') {
            e.preventDefault();
            setCurrentTool(prev => prev === 'line' ? 'select' : 'line');
          }
        } else if (k === 'j') {
          // Shift+J — Toggle picot join mode
          e.preventDefault();
          if (activeModeRef.current === 'picotJoin') {
            setActiveMode(null); setShowJoinTip(false); setSelectedPicots([]);
          } else if (activeModeRef.current !== 'beading') {
            setActiveMode('picotJoin');
            setCurrentTool('select');
            if (localStorage.getItem('tcad_seen_join_tip') !== '1') setShowJoinTip(true);
            setSelectedIds([]);
          }
        } else if (k === 'b') {
          // Shift+B — Toggle beading mode
          e.preventDefault();
          if (activeModeRef.current === 'beading') {
            setActiveMode(null); setSelectedBEs([]);
          } else if (activeModeRef.current !== 'picotJoin') {
            setActiveMode('beading');
            setCurrentTool('select');
            setSelectedIds([]);
            setSelectedBEs([]);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [clipboard, pasteFromClipboard, saveProject]);

  const updateNotation = (notation, notationB = null, elementId = null) => {
    const targetId = elementId || (selectedIds.length === 1 ? selectedIds[0] : null);
    if (!targetId) return;
    const parsed = parseNotation(notation);
    if (!parsed) return;

    setElements(prev => prev.map(el => {
      if (el.id !== targetId) return el;
      
      // Handle split ring notation update
      if (el.isSplitRing) {
        const notationAText = notation.replace(/^sr:\s*/, '');
        const notationBText = notationB || el.notationB || '5ds';
        
        const parsedA = parseNotation(`sr: ${notationAText}`);
        const parsedB = parseNotation(`sr: ${notationBText}`);
        
        if (!parsedA || !parsedB) return el;
        
        const stitchCountA = parsedA.stitchCount;
        const stitchCountB = parsedB.stitchCount;
        const totalStitches = stitchCountA + stitchCountB;
        const targetLength = totalStitches * dsWidth;
        const squeeze = el.squeeze || 0.1;
        
        const pathData = createSplitRingPath(el.center.x, el.center.y, targetLength, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
        
        // Apply rotation if needed
        let finalPaths = pathData.paths;
        if (el.rotation && el.rotation !== 0) {
          const rad = el.rotation * Math.PI / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const cx = el.center.x;
          const cy = el.center.y;
          
          const rotatePoint = (px, py) => {
            const dx = px - cx;
            const dy = py - cy;
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
          };
          
          finalPaths = finalPaths.map(path => {
            const start = rotatePoint(path.x, path.y);
            const end = rotatePoint(path.endX, path.endY);
            const c1 = rotatePoint(path.control1X, path.control1Y);
            const c2 = rotatePoint(path.control2X, path.control2Y);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              control1X: c1.x, control1Y: c1.y,
              control2X: c2.x, control2Y: c2.y
            };
          });
        }
        
        // Merge picots from both sections
        const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({
          ...p,
          stitchesBefore: p.stitchesBefore + stitchCountA
        }))];
        
        return {
          ...el,
          notation: `sr: ${notationAText}`,
          notationB: notationBText,
          stitchCount: totalStitches,
          picots: allPicots,
          paths: finalPaths,
          splitPosition: stitchCountA
        };
      }
      
      // If it's a closed path (ring), regenerate the path with new stitch count
      let newPathData = {};
      if (el.isClosed) {
        const targetLength = parsed.stitchCount * dsWidth;
        const squeeze = el.squeeze || 0; // Use existing squeeze value
        const tempPathData = el.shapeStyle === 'circle' 
          ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
          : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
        
        // If element has rotation, apply it to the new paths
        if (el.rotation && el.rotation !== 0) {
          const rad = el.rotation * Math.PI / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const cx = el.center.x;
          const cy = el.center.y;
          
          const rotatePoint = (px, py) => {
            const dx = px - cx;
            const dy = py - cy;
            return {
              x: cx + dx * cos - dy * sin,
              y: cy + dx * sin + dy * cos
            };
          };
          
          tempPathData.paths = tempPathData.paths.map(path => {
            if (path.type === 'cubic') {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const c1 = rotatePoint(path.control1X, path.control1Y);
              const c2 = rotatePoint(path.control2X, path.control2Y);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                control1X: c1.x, control1Y: c1.y,
                control2X: c2.x, control2Y: c2.y
              };
            } else {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const ctrl = rotatePoint(path.controlX, path.controlY);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                controlX: ctrl.x, controlY: ctrl.y
              };
            }
          });
        }
        
        newPathData = tempPathData;
      } else {
        // For open paths (chains): keep BOTH endpoints fixed, bend the curve to match new length.
        // Uses the same binary-search-on-perpendicular-depth approach as length-preserving drag.
        if (el.paths && el.paths.length > 0) {
          const newLength = parsed.stitchCount * dsWidth;
          const tolerance = newLength * 0.005; // 0.5% tolerance — tight but fast

          const adjustedPaths = el.paths.map(path => {
            if (path.type !== 'cubic') {
              // Quadratic legacy path — fall back to old scale-from-start
              const startX = path.x;
              const startY = path.y;
              const oldLength = el.stitchCount * dsWidth;
              const scaleFactor = newLength / oldLength;
              return {
                ...path,
                endX: startX + (path.endX - startX) * scaleFactor,
                endY: startY + (path.endY - startY) * scaleFactor,
                controlX: startX + (path.controlX - startX) * scaleFactor,
                controlY: startY + (path.controlY - startY) * scaleFactor,
              };
            }

            // Cubic bezier: pin start & end, solve for perpendicular bow depth
            const sx = path.x,    sy = path.y;
            const ex = path.endX, ey = path.endY;
            const midX = (sx + ex) / 2;
            const midY = (sy + ey) / 2;
            const axisX = ex - sx;
            const axisY = ey - sy;
            const perpX = -axisY;
            const perpY =  axisX;
            const perpLen = Math.hypot(perpX, perpY);

            // Determine which side of the axis the current control points sit on
            const oldMidX = (path.control1X + path.control2X) / 2;
            const oldMidY = (path.control1Y + path.control2Y) / 2;
            const sideSign = perpLen > 0
              ? (Math.sign(((oldMidX - midX) * perpX + (oldMidY - midY) * perpY)) || 1)
              : 1;

            // Straight-line distance between the two endpoints
            const chordLen = Math.hypot(axisX, axisY);

            // If new length ≤ chord we can't bow — move end endpoint closer along
            // the same axis so the straight line equals the new length exactly
            if (newLength <= chordLen || perpLen === 0) {
              const dirX = chordLen > 0 ? axisX / chordLen : 1;
              const dirY = chordLen > 0 ? axisY / chordLen : 0;
              const newEx = sx + dirX * newLength;
              const newEy = sy + dirY * newLength;
              return {
                ...path,
                endX: newEx, endY: newEy,
                control1X: sx + dirX * newLength * 0.33,
                control1Y: sy + dirY * newLength * 0.33,
                control2X: sx + dirX * newLength * 0.67,
                control2Y: sy + dirY * newLength * 0.67,
              };
            }

            // Binary search: find perpendicular depth that yields newLength
            let minDepth = 0;
            let maxDepth = newLength * 2; // generous upper bound
            let bestC1X = path.control1X, bestC1Y = path.control1Y;
            let bestC2X = path.control2X, bestC2Y = path.control2Y;

            for (let iter = 0; iter < 20; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const offX = (perpX / perpLen) * tryDepth * sideSign;
              const offY = (perpY / perpLen) * tryDepth * sideSign;

              const c1x = sx + axisX * 0.33 + offX;
              const c1y = sy + axisY * 0.33 + offY;
              const c2x = sx + axisX * 0.67 + offX;
              const c2y = sy + axisY * 0.67 + offY;

              const tryPath = { type: 'cubic', x: sx, y: sy, endX: ex, endY: ey,
                                control1X: c1x, control1Y: c1y,
                                control2X: c2x, control2Y: c2y };
              const tryLen = calculatePathLength(sampleBezierPath(tryPath, 20));

              bestC1X = c1x; bestC1Y = c1y;
              bestC2X = c2x; bestC2Y = c2y;

              if (Math.abs(tryLen - newLength) < tolerance) break;
              if (tryLen < newLength) minDepth = tryDepth;
              else                   maxDepth = tryDepth;
            }

            return {
              ...path,
              // endpoints unchanged
              x: sx, y: sy, endX: ex, endY: ey,
              control1X: bestC1X, control1Y: bestC1Y,
              control2X: bestC2X, control2Y: bestC2Y,
            };
          });

          newPathData = { paths: adjustedPaths };
        }
      }
      
      // Preserve IDs for joint picots so picotConnections references survive re-parse.
      // Match old joint picots to new ones by stitchesBefore position.
      const oldJointById = {};
      (el.picots || []).forEach(p => {
        if (p.isJoint) oldJointById[p.stitchesBefore] = p;
      });
      const mergedPicots = parsed.picots.map(p => {
        if (p.isJoint && oldJointById[p.stitchesBefore]) {
          return { ...p, id: oldJointById[p.stitchesBefore].id };
        }
        return p;
      });

      return { 
        ...el, 
        notation, 
        stitchCount: parsed.stitchCount, 
        picots: restoreBEConfigs(mergedPicots, el.beConfigs),
        beConfigs: extractBEConfigs(restoreBEConfigs(mergedPicots, el.beConfigs)),
        isSplitChain: parsed.isSplitChain ?? el.isSplitChain ?? false,
        ...(Object.keys(newPathData).length > 0 ? newPathData : {})
      };
    }));
  };

  const toggleShape = () => {
    if (selectedIds.length !== 1) return;
    
    setElements(prev => prev.map(el => {
      if (el.id === selectedIds[0] && el.isClosed) {
        const newStyle = el.shapeStyle === 'circle' ? 'teardrop' : 'circle';
        const targetLength = el.stitchCount * dsWidth;
        const squeeze = el.squeeze || 0; // Use existing squeeze value
        const tempPathData = newStyle === 'circle'
          ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
          : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
        
        // Preserve rotation when toggling shape
        if (el.rotation && el.rotation !== 0) {
          const rad = el.rotation * Math.PI / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const cx = el.center.x;
          const cy = el.center.y;
          
          const rotatePoint = (px, py) => {
            const dx = px - cx;
            const dy = py - cy;
            return {
              x: cx + dx * cos - dy * sin,
              y: cy + dx * sin + dy * cos
            };
          };
          
          tempPathData.paths = tempPathData.paths.map(path => {
            if (path.type === 'cubic') {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const c1 = rotatePoint(path.control1X, path.control1Y);
              const c2 = rotatePoint(path.control2X, path.control2Y);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                control1X: c1.x, control1Y: c1.y,
                control2X: c2.x, control2Y: c2.y
              };
            } else {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const ctrl = rotatePoint(path.controlX, path.controlY);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                controlX: ctrl.x, controlY: ctrl.y
              };
            }
          });
        }
        
        return { ...el, shapeStyle: newStyle, ...tempPathData };
      }
      return el;
    }));
  };

  const setLabelOffset = useCallback((value: number) => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length === 0) return;
    setElements(prev => prev.map(el =>
      currentSelectedIds.includes(el.id) ? { ...el, labelOffset: value } : el
    ));
  }, []); // No dependencies - uses refs

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAlertDialog({ message: 'Please upload an image file (PNG, JPG, GIF, etc.)' });
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setAlertDialog({ message: 'Image file is too large. Maximum size is 10MB.' });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target.result);
      // Position image at current viewport center in world coordinates
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const worldCenterX = (rect.width / 2 - camera.x) / zoom;
        const worldCenterY = (rect.height / 2 - camera.y) / zoom;
        setRefImageProps(prev => ({ ...prev, x: worldCenterX, y: worldCenterY }));
      }
    };
    reader.onerror = () => {
      setAlertDialog({ message: 'Error reading image file. Please try a different file.' });
    };
    reader.readAsDataURL(file);
  };

  // Helper function to get picot position in world coordinates (for selection/connections)
  // Joint picots (jp): returns BASE position (on path/ring)
  // jpg (isJoint+isGuide): returns TIP by default for snapping, BASE when baseOnly=true (for connection lines)
  // Regular picots: returns TIP position (end of handle)
  const getPicotPosition = (element, picot, baseOnly = false) => {
    if (!element.picots || !picot) return null;
    
    const picotSize = { small: 13, medium: 20, large: 26 };
    const len = picotSize[picot.length] || 20;
    const sideMultiplier = element.picotSideMultiplier || 1; // Default to 1 if not set
    
    // Special handling for circles
    if (element.isClosed && element.shapeStyle === 'circle') {
      const targetCircumference = element.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      const _sb1 = (picot.beadType === 'bc' || picot.beadType === 'bcp') ? picot.stitchesBefore + 0.5 : picot.stitchesBefore;
      const baseAngle = (_sb1 / element.stitchCount) * Math.PI * 2 - Math.PI / 2;
      const rotation = (element.rotation || 0) * Math.PI / 180; // Convert to radians
      const angle = baseAngle + rotation; // Apply rotation
      
      // jp and jpg: return BASE position (on ring edge)
      if (picot.isJoint || baseOnly) {
        return {
          x: element.center.x + Math.cos(angle) * radius,
          y: element.center.y + Math.sin(angle) * radius
        };
      }
      // Guide Point (gp): return BASE position (on ring edge)
      if (picot.isGuidePoint) {
        return {
          x: element.center.x + Math.cos(angle) * radius,
          y: element.center.y + Math.sin(angle) * radius
        };
      }
      
      // Regular picots: return TIP position (end of handle)
      const adjustedRadius = radius + (len * sideMultiplier);
      return {
        x: element.center.x + Math.cos(angle) * adjustedRadius,
        y: element.center.y + Math.sin(angle) * adjustedRadius
      };
    }
    
    // Path-based rendering for teardrops and chains
    let totalLength = 0;
    const pathLengths = [];
    for (let path of element.paths) {
      const points = sampleBezierPath(path, 20);
      const length = calculatePathLength(points);
      pathLengths.push(length);
      totalLength += length;
    }
    
    const _sb2 = (picot.beadType === 'bc' || picot.beadType === 'bcp') ? picot.stitchesBefore + 0.5 : picot.stitchesBefore;
    const targetDist = (_sb2 / element.stitchCount) * totalLength;
    let accum = 0;
    let pathIndex = 0;
    let localT = 0;
    
    for (let i = 0; i < pathLengths.length; i++) {
      if (accum + pathLengths[i] >= targetDist) {
        pathIndex = i;
        localT = (targetDist - accum) / pathLengths[i];
        break;
      }
      accum += pathLengths[i];
    }
    
    const path = element.paths[pathIndex];
    const t = localT;
    
    let x, y, dx, dy;
    if (path.type === 'cubic') {
      x = (1-t)*(1-t)*(1-t)*path.x + 
          3*(1-t)*(1-t)*t*path.control1X + 
          3*(1-t)*t*t*path.control2X + 
          t*t*t*path.endX;
      y = (1-t)*(1-t)*(1-t)*path.y + 
          3*(1-t)*(1-t)*t*path.control1Y + 
          3*(1-t)*t*t*path.control2Y + 
          t*t*t*path.endY;
      dx = 3*(1-t)*(1-t)*(path.control1X - path.x) + 
           6*(1-t)*t*(path.control2X - path.control1X) + 
           3*t*t*(path.endX - path.control2X);
      dy = 3*(1-t)*(1-t)*(path.control1Y - path.y) + 
           6*(1-t)*t*(path.control2Y - path.control1Y) + 
           3*t*t*(path.endY - path.control2Y);
    } else if (path.type === 'quadratic') {
      x = (1-t)*(1-t)*path.x + 2*(1-t)*t*path.controlX + t*t*path.endX;
      y = (1-t)*(1-t)*path.y + 2*(1-t)*t*path.controlY + t*t*path.endY;
      dx = 2*(1-t)*(path.controlX - path.x) + 2*t*(path.endX - path.controlX);
      dy = 2*(1-t)*(path.controlY - path.y) + 2*t*(path.endY - path.controlY);
    }
    
    // jp, jpg, gp, or baseOnly: return BASE position (on path)
    if (picot.isJoint || picot.isGuidePoint || baseOnly) {
      return { x, y };
    }
    
    // Regular picots: return TIP position (end of handle)
    const sideOffset = sideMultiplier === -1 ? Math.PI : 0; // Flip to other side if multiplier is -1
    const perpAngle = Math.atan2(dy, dx) - Math.PI / 2 + sideOffset;
    return {
      x: x + Math.cos(perpAngle) * len,
      y: y + Math.sin(perpAngle) * len
    };
  };


  // ── Beaded picot helpers ────────────────────────────────────────────────────
  // Bead sizes: dsMultiplier * dsWidth = total diameter (incl. stroke)
  // brad() returns radius = diameter/2 - strokeWidth/2
  const BEAD_SIZES_DEFAULT = {
    Y: dsWidth * beadSettings.Y.dsMultiplier,
    Z: dsWidth * beadSettings.Z.dsMultiplier,
    V: dsWidth * beadSettings.V.dsMultiplier,
  };
  // Helper: diameter → radius (subtract 1px for stroke on each side)
  const beadRadius = (diameter) => Math.max(2, diameter / 2 - 1);

  // Teardrop path data (from IconShapeTeardrop), centered at (0,0), unit size ~5.2917
  const TEARDROP_PATH = "M2.1167,0 C1.4067,0.6041 0.8766,1.1655 0.5261,1.6836 C0.1755,2.2018 0,2.6813 0,3.1223 C0,3.7397 0.2016,4.2555 0.6051,4.67 C1.0086,5.0845 1.5125,5.2917 2.1167,5.2917 C2.7208,5.2917 3.2247,5.0845 3.6282,4.67 C4.0317,4.2555 4.2333,3.7397 4.2333,3.1223 C4.2333,2.6813 4.0578,2.2018 3.7073,1.6836 C3.3567,1.1655 2.8266,0.6041 2.1167,0 Z";
  const TEARDROP_SIZE = 5.2917; // viewBox width/height
  const TEARDROP_CX = 2.1167;  // visual center x
  const TEARDROP_CY = 2.9;     // visual center y (slightly below geometric center)

  // Render a bead at (bx,by) with given radius, shape, fill color, and orientation angle (radians).
  // angleDeg: for core beads pass tangent angle; for picot beads pass perpAngle (both in radians).
  const renderBeadShape = (bx, by, rad, shape, color, angleRad = 0, key = 0) => {
    const shadow = <circle key={`${key}-s`} cx={bx} cy={by} r={rad + 1} fill="rgba(0,0,0,0.3)" />;
    const highlight = <ellipse key={`${key}-h`} cx={0} cy={0}
      transform={`translate(${bx - rad * 0.28},${by - rad * 0.3})`}
      rx={rad * 0.3} ry={rad * 0.18} fill="rgba(255,255,255,0.4)" />;
    const deg = angleRad * 180 / Math.PI;
    const strokeProps = { stroke: '#111', strokeWidth: 1 };

    if (shape === 'square') {
      const s = rad * 1.6;
      return <g key={key}>
        {shadow}
        <rect x={bx - s/2} y={by - s/2} width={s} height={s}
          fill={color} {...strokeProps}
          transform={`rotate(${deg}, ${bx}, ${by})`} />
        {highlight}
      </g>;
    }
    if (shape === 'rectangle') {
      const w = rad * 1.1, h = rad * 2.0;
      // Long axis along tangent (perpAngle + 90°) — bead is strung through its length
      return <g key={key}>
        {shadow}
        <rect x={bx - w/2} y={by - h/2} width={w} height={h}
          fill={color} {...strokeProps}
          transform={`rotate(${deg + 90}, ${bx}, ${by})`} />
        {highlight}
      </g>;
    }
    if (shape === 'diamond') {
      const s = rad * 1.6;
      return <g key={key}>
        {shadow}
        <rect x={bx - s/2} y={by - s/2} width={s} height={s}
          fill={color} {...strokeProps}
          transform={`rotate(${45 + deg}, ${bx}, ${by})`} />
        {highlight}
      </g>;
    }
    if (shape === 'teardrop-up' || shape === 'teardrop-down') {
      const scale = (rad * 2) / TEARDROP_SIZE;
      // Tip points up (−Y) in SVG by default.
      // Rotate by deg+90 so tip points along perpAngle (= picot direction).
      // teardrop-up: tip toward end of picot (away from ring)
      // teardrop-down: tip toward ring (flip 180°)
      const flipExtra = shape === 'teardrop-down' ? 180 : 0;
      return <g key={key}>
        {shadow}
        <g transform={`translate(${bx},${by}) rotate(${deg + 90 + flipExtra}) scale(${scale}) translate(${-TEARDROP_CX},${-TEARDROP_CY})`}>
          <path d={TEARDROP_PATH} fill={color} {...strokeProps} strokeWidth={1/scale} />
        </g>
        {highlight}
      </g>;
    }
    // Default: circle
    return <g key={key}>
      {shadow}
      <circle cx={bx} cy={by} r={rad} fill={color} {...strokeProps} />
      {highlight}
    </g>;
  };

  // Parse bead sequence string "YZY", "2V", "YZV" → array of size chars
  const parseBeadSeq = (seq) => {
    const beads = [];
    let i = 0;
    while (i < seq.length) {
      let count = 1;
      if (/\d/.test(seq[i])) { count = parseInt(seq[i]); i++; }
      if (i < seq.length && /[YZV]/i.test(seq[i])) {
        const s = seq[i].toUpperCase();
        for (let j = 0; j < count; j++) beads.push(s);
        i++;
      } else { i++; }
    }
    return beads;
  };

  // Build bead positions relative to a picot root (rootX,rootY) pointing in direction perpAngle
  // Returns array of {x, y, size} and array of line segments {x1,y1,x2,y2}
  const buildBeadPicotGeometry = (rootX, rootY, perpAngle, beads, sizes, picotLen) => {
    const n = beads.length;
    if (n === 0) return { beadPos: [], lines: [] };

    const brad = (s) => beadRadius(sizes[s] ?? sizes.Y);
    // Spacing proportional to the largest bead in the group
    const maxR = Math.max(...beads.map(b => brad(b)));
    const rowH = n === 1
      ? (picotLen ?? maxR * 3) * 0.5  // single bead: halfway along picot
      : maxR * 2.4;                    // multi bead: proportional to bead size
    const spread = maxR * 2.0;         // lateral spread proportional to bead size

    // Unit vectors: along picot (outward) and lateral
    const ax = Math.cos(perpAngle), ay = Math.sin(perpAngle);
    const lx = Math.cos(perpAngle + Math.PI / 2), ly = Math.sin(perpAngle + Math.PI / 2);

    const pt = (along, lateral) => ({
      x: rootX + ax * along + lx * lateral,
      y: rootY + ay * along + ly * lateral,
    });

    let pts = [];
    if (n === 1) {
      pts = [pt(rowH, 0)];
    } else if (n === 2) {
      pts = [pt(rowH, -spread), pt(rowH, spread)];
    } else if (n === 3) {
      pts = [pt(rowH, -spread), pt(rowH * 2, 0), pt(rowH, spread)];
    } else if (n === 4) {
      pts = [pt(rowH, -spread), pt(rowH, spread), pt(rowH * 2, -spread), pt(rowH * 2, spread)];
    } else {
      pts = [
        pt(rowH, -spread), pt(rowH, spread),
        pt(rowH * 1.8, -spread * 0.6), pt(rowH * 1.8, spread * 0.6),
        pt(rowH * 2.6, 0),
      ];
    }

    const stem = { x: rootX, y: rootY };
    const lines = [];
    if (n === 1) {
      lines.push([stem, pts[0]]);
    } else if (n === 2) {
      lines.push([stem, pts[0]]); lines.push([stem, pts[1]]); lines.push([pts[0], pts[1]]);
    } else if (n === 3) {
      lines.push([stem, pts[0]]); lines.push([stem, pts[2]]);
      lines.push([pts[0], pts[1]]); lines.push([pts[2], pts[1]]);
    } else if (n === 4) {
      lines.push([stem, pts[0]]); lines.push([stem, pts[1]]);
      lines.push([pts[0], pts[2]]); lines.push([pts[1], pts[3]]); lines.push([pts[2], pts[3]]);
    } else {
      lines.push([stem, pts[0]]); lines.push([stem, pts[1]]);
      lines.push([pts[0], pts[2]]); lines.push([pts[1], pts[3]]);
      lines.push([pts[2], pts[4]]); lines.push([pts[3], pts[4]]);
    }

    const beadPos = pts.map((p, i) => ({ ...p, size: beads[i] }));
    return { beadPos, lines };
  };

  // Render beaded picot SVG given root position and perp angle
  const renderBeadedPicot = (key, rootX, rootY, perpAngle, beadSeq, color, picotLen) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const beads = parseBeadSeq(beadSeq);
    const { beadPos, lines } = buildBeadPicotGeometry(rootX, rootY, perpAngle, beads, sizes, picotLen);
    const BEAD_FILL = {
      Y: beadSettings.Y.color,
      Z: beadSettings.Z.color,
      V: beadSettings.V.color,
    };
    return (
      <g key={key}>
        {lines.map((l, i) => (
          <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y}
            stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        ))}
        {beadPos.map((p, i) => {
          const rad = beadRadius(sizes[p.size] ?? sizes.Y);
          const fill = BEAD_FILL[p.size] || color;
          // bc:/bjp: beads don't have library IDs here — use size-class color, circle shape
          return renderBeadShape(p.x, p.y, rad, 'circle', fill, perpAngle, i);
        })}
      </g>
    );
  };



  // ── Core+Picot bead (bcp:) rendering ────────────────────────────────────────
  // Draws one core bead centered on the path, then picot beads branching
  // from the outer edge of the core bead (perpendicular, outward).
  // Extract BE configs from picots as { ordinalIndex: {beStructure, beIsJoint, coreBeads, picotBeads} }
  // Keyed by position among BE tokens so they survive notation edits.
  const extractBEConfigs = (picots) => {
    const configs = {};
    let idx = 0;
    (picots || []).forEach(p => {
      if (p.beadType !== 'be') return;
      configs[idx] = {
        beStructure: p.beStructure,
        beIsJoint:   p.beIsJoint,
        coreBeads:   p.coreBeads,
        picotBeads:  p.picotBeads,
      };
      idx++;
    });
    return configs;
  };

  // ── Stable BE clipboard operations (component-level, not inside render IIFE) ─
  // These always read current state, eliminating stale-closure issues.

  const copyBEToClipboard = useCallback(() => {
    const lastBE = selectedBEs[selectedBEs.length - 1];
    if (!lastBE) return;
    const el = elements.find(e => e.id === lastBE.elementId);
    const picot = el?.picots?.find(p => p.id === lastBE.picotId);
    if (!picot) return;
    setBeClipboard({
      beStructure: picot.beStructure,
      beIsJoint:   picot.beIsJoint,
      coreBeads:   [...(picot.coreBeads  || [null, null, null])],
      picotBeads:  [...(picot.picotBeads || [null, null, null])],
    });
  }, [selectedBEs, elements]);

  const cutBEToClipboard = useCallback(() => {
    const lastBE = selectedBEs[selectedBEs.length - 1];
    if (!lastBE) return;
    const el = elements.find(e => e.id === lastBE.elementId);
    const picot = el?.picots?.find(p => p.id === lastBE.picotId);
    if (!picot) return;
    setBeClipboard({
      beStructure: picot.beStructure,
      beIsJoint:   picot.beIsJoint,
      coreBeads:   [...(picot.coreBeads  || [null, null, null])],
      picotBeads:  [...(picot.picotBeads || [null, null, null])],
    });
    // Reset the selected BEs to default state
    setElements(prev => prev.map(el2 => {
      const toReset = selectedBEs.filter(s => s.elementId === el2.id);
      if (toReset.length === 0) return el2;
      const newPicots = (el2.picots || []).map(p =>
        toReset.some(s => s.picotId === p.id)
          ? { ...p, beStructure: 'core', beIsJoint: false, coreBeads: [null, null, null], picotBeads: [null, null, null] }
          : p
      );
      return { ...el2, picots: newPicots, beConfigs: extractBEConfigs(newPicots) };
    }));
  }, [selectedBEs, elements]);

  const pasteBeClipboard = useCallback(() => {
    if (!beClipboard || selectedBEs.length === 0) return;
    setElements(prev => prev.map(el => {
      const toUpdate = selectedBEs.filter(s => s.elementId === el.id);
      if (toUpdate.length === 0) return el;
      const newPicots = (el.picots || []).map(p =>
        toUpdate.some(s => s.picotId === p.id)
          ? { ...p,
              beStructure: beClipboard.beStructure,
              beIsJoint:   beClipboard.beIsJoint,
              coreBeads:   [...beClipboard.coreBeads],
              picotBeads:  [...beClipboard.picotBeads],
            }
          : p
      );
      return { ...el, picots: newPicots, beConfigs: extractBEConfigs(newPicots) };
    }));
  }, [beClipboard, selectedBEs]);

  // Restore BE configs into freshly-parsed picots by ordinal index.
  // If new notation has fewer BEs, extras are silently dropped.
  // If more, new ones start with defaults.
  const restoreBEConfigs = (newPicots, configs) => {
    if (!configs || Object.keys(configs).length === 0) return newPicots;
    let idx = 0;
    return newPicots.map(p => {
      if (p.beadType !== 'be') return p;
      const cfg = configs[idx++];
      return cfg ? { ...p, ...cfg } : p;
    });
  };

  // Merge BE bead configs after notation reversal (flip operations).
  // After reversal the nth BE in new picots = (total-1-n)th BE in old picots.
  const mergeBEConfigs = (newPicots, oldPicots) => {
    const oldBEs = (oldPicots || []).filter(p => p.beadType === 'be');
    if (oldBEs.length === 0) return newPicots;
    let beIdx = 0;
    return newPicots.map(p => {
      if (p.beadType !== 'be') return p;
      const oldBE = oldBEs[oldBEs.length - 1 - beIdx];
      beIdx++;
      if (!oldBE) return p;
      return { ...p, beStructure: oldBE.beStructure, beIsJoint: oldBE.beIsJoint, coreBeads: oldBE.coreBeads, picotBeads: oldBE.picotBeads };
    });
  };

  // ── BE (Bead Element) rendering ─────────────────────────────────────────────
  const renderBE = (picot, cx, cy, perpAngle, threadColor, len, isSelected) => {
    const key = picot.id;
    const struct = picot.beStructure || 'core';

    // Resolve bead library entries → [{size, color, shape}]
    const resolveBeads = (slots) =>
      (slots || []).filter(Boolean).map(id => {
        const b = beadLibrary.find(b => b.id === id);
        return b ? { size: b.size, color: b.color, shape: b.shape || 'circle' } : { size: 'Y', color: '#ef4444', shape: 'circle' };
      });

    const coreBeadList  = resolveBeads(picot.coreBeads);
    const picotBeadList = resolveBeads(picot.picotBeads);
    const ax = Math.cos(perpAngle), ay = Math.sin(perpAngle);
    const inBeadingMode = activeMode === 'beading';
    const isThisSel = inBeadingMode && selectedBEs.some(s => s.picotId === picot.id);

    // ── Pink diamond — visible unless realistic mode with beads filled in ───
    // In realistic mode, once beads are configured the bead geometry speaks for
    // itself — no need for the pink placeholder marker on top.
    // Still always shown in beading mode (so you can select it).
    const hasContent = (() => {
      if (struct === 'core') return coreBeadList.length > 0;
      if (struct === 'core+picot') return coreBeadList.length > 0;
      if (struct === 'core+beaded') return coreBeadList.length > 0 || picotBeadList.length > 0;
      // spike / suspended: need at least one picot bead
      return picotBeadList.length > 0;
    })();
    const hideDiamond = renderMode === 'realistic' && hasContent && !inBeadingMode;

    const diamondR = isThisSel ? 7/zoom : 5/zoom;
    const diamondColor = isThisSel ? '#38bdf8'   // selected: cyan
                       : inBeadingMode ? '#f472b6' // beading mode: bright pink
                       : '#ec4899';                 // normal: pink
    const diamond = hideDiamond ? null : (
      <rect
        transform={`rotate(45, ${cx}, ${cy})`}
        x={cx - diamondR} y={cy - diamondR}
        width={diamondR * 2} height={diamondR * 2}
        fill={diamondColor}
        stroke={isThisSel ? '#fff' : '#111'}
        strokeWidth={isThisSel ? 1.5/zoom : 1/zoom}
        style={inBeadingMode ? { cursor: 'pointer' } : undefined}
      />
    );

    // ── Helper: one bead shape ───────────────────────────────────────────────
    // coreAngle = along the thread path (tangent); picotAngle = perpendicular to path
    const beadCircle = (bx, by, b, ki, angleRad = perpAngle) => {
      const rad = beadRadius(BEAD_SIZES_DEFAULT[b.size] ?? BEAD_SIZES_DEFAULT.Y);
      return renderBeadShape(bx, by, rad, b.shape || 'circle', b.color, angleRad, ki);
    };
    const coreAngle = perpAngle + Math.PI / 2; // tangent along path, for core beads

    // ── Core bead (single, centred on path) ──────────────────────────────────
    const renderCoreBead_BE = () => {
      if (coreBeadList.length === 0) return null; // diamond alone is enough as placeholder
      const b = coreBeadList[0];
      return beadCircle(cx, cy, b, 'core', coreAngle);
    };

    // ── Picot arm (plain or beaded) ──────────────────────────────────────────
    const renderPicotArm = () => {
      const coreRad = coreBeadList.length > 0
        ? beadRadius(BEAD_SIZES_DEFAULT[coreBeadList[0].size] ?? BEAD_SIZES_DEFAULT.Y) : 0;
      const branchX = cx + ax * coreRad;
      const branchY = cy + ay * coreRad;
      if (picotBeadList.length === 0) {
        return <line x1={branchX} y1={branchY} x2={branchX + ax*len} y2={branchY + ay*len}
          stroke={threadColor} strokeWidth="2" />;
      }
      // Use the same geometry as renderBeadedPicot — 1 centered, 2 side-by-side, 3 triangle, etc.
      const beadSizes = picotBeadList.map(b => b.size);
      const { beadPos, lines } = buildBeadPicotGeometry(branchX, branchY, perpAngle, beadSizes, BEAD_SIZES_DEFAULT, len);
      return (
        <g key={`${key}-picot-arm`}>
          {lines.map((l, i) => (
            <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y}
              stroke={threadColor} strokeWidth="1.5" strokeLinecap="round" />
          ))}
          {beadPos.map((p, i) => beadCircle(p.x, p.y, picotBeadList[i], `p${i}`))}
        </g>
      );
    };

    // ── Spike: beads stacked in a straight line outward ─────────────────────
    const renderSpike = () => {
      if (picotBeadList.length === 0) {
        return <line x1={cx} y1={cy} x2={cx+ax*len} y2={cy+ay*len}
          stroke={threadColor} strokeWidth="2" strokeDasharray="3,3" />;
      }
      let offset = 0;
      const positions = picotBeadList.map(b => {
        const rad = beadRadius(BEAD_SIZES_DEFAULT[b.size] ?? BEAD_SIZES_DEFAULT.Y);
        offset += rad;
        const bx = cx + ax * offset, by = cy + ay * offset;
        offset += rad;
        return { bx, by, rad, b };
      });
      const last = positions[positions.length - 1];
      const tipX = last.bx + ax * last.rad, tipY = last.by + ay * last.rad;
      return (
        <g key={`${key}-spike`}>
          <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke={threadColor} strokeWidth="1.5" strokeLinecap="round" />
          {positions.map((p, i) => beadCircle(p.bx, p.by, p.b, `sp${i}`))}
        </g>
      );
    };

    // ── Suspended / beaded-only (no core) ────────────────────────────────────
    const renderSuspended = () => {
      if (picotBeadList.length === 0) {
        return <line x1={cx} y1={cy} x2={cx+ax*len} y2={cy+ay*len}
          stroke={threadColor} strokeWidth="2" strokeDasharray="3,3" />;
      }
      const beadSizes = picotBeadList.map(b => b.size);
      const { beadPos, lines } = buildBeadPicotGeometry(cx, cy, perpAngle, beadSizes, BEAD_SIZES_DEFAULT, len);
      return (
        <g key={`${key}-suspended`}>
          {lines.map((l, i) => (
            <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y}
              stroke={threadColor} strokeWidth="1.5" strokeLinecap="round" />
          ))}
          {beadPos.map((p, i) => beadCircle(p.x, p.y, picotBeadList[i], `s${i}`))}
        </g>
      );
    };

    return (
      <g key={key}>
        {/* Bead geometry first, diamond on top */}
        {struct === 'spike'
          ? renderSpike()
          : struct === 'suspended'
          ? renderSuspended()
          : <>
              {renderCoreBead_BE()}
              {(struct === 'core+picot' || struct === 'core+beaded') && renderPicotArm()}
            </>
        }
        {diamond}
      </g>
    );
  };

  const renderBcpBead = (key, cx, cy, perpAngle, coreSize, beadSeq, color, plainPicotLen = 20) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const coreRad = beadRadius(sizes[coreSize] ?? sizes.Y);
    const ax = Math.cos(perpAngle), ay = Math.sin(perpAngle);
    // Picot branch starts at outer edge of core bead
    const branchX = cx + ax * coreRad;
    const branchY = cy + ay * coreRad;
    // Plain picot arm when no bead sequence
    const picotArm = !beadSeq
      ? (() => {
          const tipX = branchX + ax * plainPicotLen;
          const tipY = branchY + ay * plainPicotLen;
          return (
            <line x1={branchX} y1={branchY} x2={tipX} y2={tipY}
              stroke={color} strokeWidth="2" />
          );
        })()
      : renderBeadedPicot(`${key}-picot`, branchX, branchY, perpAngle, beadSeq, color, coreRad * 3);
    return (
      <g key={key}>
        {renderCoreBead(`${key}-core`, cx, cy, coreSize, color, perpAngle)}
        {picotArm}
      </g>
    );
  };

  // ── Suspended bead (sb:) rendering ──────────────────────────────────────────
  // Beads stacked in a straight column perpendicular to the path (outward).
  // rootX/rootY = point on path, perpAngle = outward direction.


  // ── Clustered beads (bjp:) rendering ────────────────────────────────────────
  // Beads arranged in a tight cluster at (cx, cy) — used for beaded joint picots.
  // 1 bead: centered. 2 beads: side by side. 3+: circular cluster.
  const renderClusteredBeads = (key, cx, cy, beadSeq) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const beads = parseBeadSeq(beadSeq);
    if (beads.length === 0) return null;
    const BEAD_FILL = {
      Y: beadSettings.Y.color,
      Z: beadSettings.Z.color,
      V: beadSettings.V.color,
    };
    const maxR = Math.max(...beads.map(b => beadRadius(sizes[b] ?? sizes.Y)));

    const positions = beads.map((size, i) => {
      const rad = beadRadius(sizes[size] ?? sizes.Y);
      let bx = cx, by = cy;
      if (beads.length === 1) {
        bx = cx; by = cy;
      } else if (beads.length === 2) {
        bx = cx + (i === 0 ? -maxR : maxR);
        by = cy;
      } else {
        const angle = (i / beads.length) * Math.PI * 2 - Math.PI / 2;
        bx = cx + Math.cos(angle) * maxR * 1.1;
        by = cy + Math.sin(angle) * maxR * 1.1;
      }
      return { bx, by, rad, size };
    });

    return (
      <g key={key}>
        {positions.map((p, i) => (
          <g key={i}>
            <circle cx={p.bx} cy={p.by} r={p.rad + 1} fill="rgba(0,0,0,0.3)" />
            <circle cx={p.bx} cy={p.by} r={p.rad}
              fill={BEAD_FILL[p.size] || '#ef4444'} stroke="#111" strokeWidth="1" />
            <ellipse
              cx={p.bx - p.rad * 0.28} cy={p.by - p.rad * 0.3}
              rx={p.rad * 0.3} ry={p.rad * 0.18}
              fill="rgba(255,255,255,0.4)"
            />
          </g>
        ))}
      </g>
    );
  };

  // ── Core bead (bc:) rendering ───────────────────────────────────────────────
  // Single bead centered ON the path (inline on thread).
  // Thread line is drawn behind; bead sits on top with a gap in the line.
  const renderCoreBead = (key, cx, cy, size, color, perpAngle) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const rad = beadRadius(sizes[size] ?? sizes.Y);
    const BEAD_FILL = {
      Y: beadSettings.Y.color,
      Z: beadSettings.Z.color,
      V: beadSettings.V.color,
    };
    // Plain arch over the bead (tight, no beads) — only when perpAngle is provided
    const arch = perpAngle != null ? (() => {
      const tx = Math.cos(perpAngle - Math.PI / 2); // tangent along path
      const ty = Math.sin(perpAngle - Math.PI / 2);
      const nx = Math.cos(perpAngle); // outward normal
      const ny = Math.sin(perpAngle);
      const x1 = cx - tx * rad, y1 = cy - ty * rad; // left anchor on bead edge
      const x2 = cx + tx * rad, y2 = cy + ty * rad; // right anchor on bead edge
      const cpx = cx + nx * rad * 1.7, cpy = cy + ny * rad * 1.7; // arch peak
      return (
        <path
          d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
          stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"
        />
      );
    })() : null;
    return (
      <g key={key}>
        {arch}
        {renderBeadShape(cx, cy, rad, 'circle', BEAD_FILL[size] || color, perpAngle != null ? perpAngle - Math.PI / 2 : 0, `${key}-shape`)}
      </g>
    );
  };

  const renderSuspendedBead = (key, rootX, rootY, perpAngle, beadSeq, color) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const beads = parseBeadSeq(beadSeq);
    if (beads.length === 0) return null;

    const BEAD_FILL = {
      Y: beadSettings.Y.color,
      Z: beadSettings.Z.color,
      V: beadSettings.V.color,
    };

    const ax = Math.cos(perpAngle), ay = Math.sin(perpAngle);

    // Stack beads outward: each bead center placed so beads touch edge-to-edge
    const positions = [];
    let offset = 0;
    for (let i = 0; i < beads.length; i++) {
      const rad = beadRadius(sizes[beads[i]] ?? sizes.Y);
      offset += rad; // move to center of this bead
      positions.push({ x: rootX + ax * offset, y: rootY + ay * offset, rad, size: beads[i] });
      offset += rad; // past this bead
    }

    // Spike line from path to tip of last bead
    const tip = positions[positions.length - 1];
    const tipEdge = { x: tip.x + ax * tip.rad, y: tip.y + ay * tip.rad };

    return (
      <g key={key}>
        <line
          x1={rootX} y1={rootY}
          x2={tipEdge.x} y2={tipEdge.y}
          stroke={color} strokeWidth="1.5" strokeLinecap="round"
        />
        {positions.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.rad + 1} fill="rgba(0,0,0,0.3)" />
            <circle cx={p.x} cy={p.y} r={p.rad}
              fill={BEAD_FILL[p.size] || color} stroke="#111" strokeWidth="1" />
            <ellipse
              cx={p.x - p.rad * 0.28} cy={p.y - p.rad * 0.3}
              rx={p.rad * 0.3} ry={p.rad * 0.18}
              fill="rgba(255,255,255,0.4)"
            />
          </g>
        ))}
      </g>
    );
  };

  const renderPicots = (element, beadAndJointOnly = false) => {
    if (!element.picots || element.picots.length === 0) return null;
    const picotSize = { small: 13, medium: 20, large: 26 };
    const sideMultiplier = element.picotSideMultiplier || 1; // Default to 1 if not set

    // Special handling for circles (rendered as SVG circle, not paths)
    if (element.isClosed && element.shapeStyle === 'circle') {
      const targetCircumference = element.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      const rotation = (element.rotation || 0) * Math.PI / 180; // Convert to radians
      
      return element.picots.map(p => {
        const _sb3 = (p.beadType === 'bc' || p.beadType === 'bcp' || p.beadType === 'be') ? p.stitchesBefore + 0.5 : p.stitchesBefore;
        const baseAngle = (_sb3 / element.stitchCount) * Math.PI * 2 - Math.PI / 2;
        const angle = baseAngle + rotation; // Apply rotation
        const startX = element.center.x + Math.cos(angle) * radius;
        const startY = element.center.y + Math.sin(angle) * radius;
        const len = picotSize[p.length] || 20;
        // Adjust based on side multiplier
        const adjustedRadius = radius + (len * sideMultiplier);
        const endX = element.center.x + Math.cos(angle) * adjustedRadius;
        const endY = element.center.y + Math.sin(angle) * adjustedRadius;
        
        const isSelected = selectedPicots.some(sp => sp.elementId === element.id && sp.picotId === p.id);
        const isConnected = p.isJoint && picotConnections.some(conn => conn.picots.some(cp => cp.elementId === element.id && cp.picotId === p.id));
        // jpg and jp both use joint dot colors; gp invisible; regular picots use element color
        const color = p.isJoint
          ? (p.isCoreJoin
            ? (isSelected ? theme.cjSelected : isConnected ? theme.cjConnected : theme.cjUnconnected)
            : (isSelected ? theme.jpSelected : isConnected ? theme.jpConnected : theme.jpUnconnected))
          : p.isGuidePoint
          ? theme.gpDiamond
          : getSolidColor(element);
        const strokeWidth = isSelected ? "4" : "2";
        
        // BE: render based on beStructure config (beading mode)
        if (p.beadType === 'be') {
          if (beadAndJointOnly && activeMode === 'picotJoin' && !p.beIsJoint) return null;
          const bePerpAngle = Math.atan2(endY - startY, endX - startX);
          return renderBE(p, startX, startY, bePerpAngle, color, len, isSelected);
        }

        // bcjp: core bead on path + joint dot indicator (selectable in join mode)
        if (p.beadType === 'bcjp') {
          const bcjpPerpAngle = Math.atan2(endY - startY, endX - startX);
          const jointDotR = isSelected ? 6/zoom : 4/zoom;
          return (
            <g key={p.id}>
              {renderCoreBead(`${p.id}-core`, startX, startY, p.coreSize || 'Y', color, bcjpPerpAngle)}
              {renderMode !== 'realistic' && (
                <circle cx={startX} cy={startY} r={jointDotR} fill={color} stroke="#000" strokeWidth={2/zoom} opacity={0.7} />
              )}
            </g>
          );
        }

        // jp / jpg / cj / cjp
        if (p.isJoint) {
          // cjp in realistic: render as picot arm (core join with visible picot)
          if (renderMode === 'realistic' && p.isCoreJoin && p.hasPicotArm) {
            return (
              <g key={p.id}>
                <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={color} strokeWidth={strokeWidth} />
              </g>
            );
          }
          if (renderMode === 'realistic') return null;
          if (!showEditingArtifacts) return null;
          // cjp: core join WITH picot arm — render arm + dot
          if (p.isCoreJoin && p.hasPicotArm) {
            return (
              <g key={p.id} data-ui="1">
                <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={color} strokeWidth={isSelected ? "4" : "2"} />
                <circle cx={startX} cy={startY} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} />
              </g>
            );
          }
          // cj / jp / jpg: dot only
          return (
            <g key={p.id} data-ui="1">
              <circle cx={startX} cy={startY} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} />
            </g>
          );
        }

        // Core+Picot bead (bcp:) — inline core with picot branch
        if (p.beadType === 'bcp') {
          if (beadAndJointOnly) return null;
          const perpAngle = Math.atan2(endY - startY, endX - startX);
          return renderBcpBead(p.id, startX, startY, perpAngle, p.coreSize, p.beadSeq, color, len);
        }
        // Core bead (bc:) — inline on path
        if (p.beadType === 'bc') {
          if (beadAndJointOnly) return null;
          const bcPerpAngle = Math.atan2(endY - startY, endX - startX);
          return renderCoreBead(p.id, startX, startY, p.beadSize, color, bcPerpAngle);
        }
        // Suspended bead (sb:SEQ) — straight spike outward
        if (p.beadType === 'sb' && p.beadSeq) {
          if (beadAndJointOnly) return null;
          const perpAngle = Math.atan2(endY - startY, endX - startX);
          return renderSuspendedBead(p.id, startX, startY, perpAngle, p.beadSeq, color);
        }
        // Beaded picot (bp:SEQ)
        if (p.beadSeq) {
          if (beadAndJointOnly) return null;
          const perpAngle = Math.atan2(endY - startY, endX - startX);
          return renderBeadedPicot(p.id, startX, startY, perpAngle, p.beadSeq, color, len);
        }

        if (beadAndJointOnly) return null; // realistic: bezier handles regular picots
        return (
          <g key={p.id} className={p.isGuide ? 'guide-picot' : undefined}>
            <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={color} strokeWidth={strokeWidth} />
            
          </g>
        );
      });
    }

    // Split ring: section-local arc placement
    if (element.isSplitRing) {
      const splitPos = element.splitPosition || Math.floor(element.stitchCount / 2);
      const countA = splitPos;
      const countB = element.stitchCount - splitPos;
      const pathA = element.paths[0];
      const pathB = element.paths[1];
      if (!pathA || !pathB) return null;

      const samplesA = sampleBezierPath(pathA, 60);
      const samplesB = sampleBezierPath(pathB, 60);
      const lenA = calculatePathLength(samplesA);
      const lenB = calculatePathLength(samplesB);

      return element.picots.map(p => {
        // Determine which section this picot belongs to
        const _sb4 = (p.beadType === 'bc' || p.beadType === 'bcp' || p.beadType === 'be') ? p.stitchesBefore + 0.5 : p.stitchesBefore;
        const inA = p.stitchesBefore <= splitPos;
        const localFrac = inA
          ? _sb4 / countA
          : (_sb4 - splitPos) / countB;
        const samples = inA ? samplesA : samplesB;
        const pathLen = inA ? lenA : lenB;
        const path = inA ? pathA : pathB;

        const targetDist = localFrac * pathLen;
        let accum = 0, localT = 0;
        for (let i = 1; i < samples.length; i++) {
          const seg = Math.hypot(samples[i].x - samples[i-1].x, samples[i].y - samples[i-1].y);
          if (accum + seg >= targetDist) {
            localT = (i - 1 + (targetDist - accum) / seg) / (samples.length - 1);
            break;
          }
          accum += seg;
        }
        const t = localT;

        let x, y, dx, dy;
        if (path.type === 'cubic') {
          x = (1-t)*(1-t)*(1-t)*path.x + 3*(1-t)*(1-t)*t*path.control1X + 3*(1-t)*t*t*path.control2X + t*t*t*path.endX;
          y = (1-t)*(1-t)*(1-t)*path.y + 3*(1-t)*(1-t)*t*path.control1Y + 3*(1-t)*t*t*path.control2Y + t*t*t*path.endY;
          dx = 3*(1-t)*(1-t)*(path.control1X-path.x) + 6*(1-t)*t*(path.control2X-path.control1X) + 3*t*t*(path.endX-path.control2X);
          dy = 3*(1-t)*(1-t)*(path.control1Y-path.y) + 6*(1-t)*t*(path.control2Y-path.control1Y) + 3*t*t*(path.endY-path.control2Y);
        }

        const sideMultiplier = element.picotSideMultiplier || 1;
        const sideOffset = sideMultiplier === -1 ? Math.PI : 0;
        const perpAngle = Math.atan2(dy, dx) - Math.PI / 2 + sideOffset;
        const len = picotSize[p.length] || 20;
        const endX = x + Math.cos(perpAngle) * len;
        const endY = y + Math.sin(perpAngle) * len;

        const isSelected = selectedPicots.some(sp => sp.elementId === element.id && sp.picotId === p.id);
        const isConnected = p.isJoint && picotConnections.some(conn => conn.picots.some(cp => cp.elementId === element.id && cp.picotId === p.id));
        const color = p.isJoint
          ? (p.isCoreJoin
            ? (isSelected ? theme.cjSelected : isConnected ? theme.cjConnected : theme.cjUnconnected)
            : (isSelected ? theme.jpSelected : isConnected ? theme.jpConnected : theme.jpUnconnected))
          : p.isGuidePoint
          ? theme.gpDiamond
          : getSolidColor(element);
        const strokeWidth = isSelected ? "4" : "2";

        // BE: render based on beStructure config
        if (p.beadType === 'be') {
          if (beadAndJointOnly && activeMode === 'picotJoin' && !p.beIsJoint) return null;
          return renderBE(p, x, y, perpAngle, color, len, isSelected);
        }

        // bcjp: core bead on path + joint dot indicator
        if (p.beadType === 'bcjp') {
          const bcjpPerpAngle = perpAngle;
          const jointDotR = isSelected ? 6/zoom : 4/zoom;
          return (
            <g key={p.id}>
              {renderCoreBead(`${p.id}-core`, x, y, p.coreSize || 'Y', color, bcjpPerpAngle)}
              {renderMode !== 'realistic' && (
                <circle cx={x} cy={y} r={jointDotR} fill={color} stroke="#000" strokeWidth={2/zoom} opacity={0.7} />
              )}
            </g>
          );
        }

        // jp / jpg / cj / cjp: dot on path — schematic only, hidden when editing artifacts off
        if (p.isJoint) {
          // cjp in realistic: render as picot arm
          if (renderMode === 'realistic' && p.isCoreJoin && p.hasPicotArm) {
            return (
              <g key={p.id}>
                <line x1={x} y1={y} x2={x + Math.cos(perpAngle) * len} y2={y + Math.sin(perpAngle) * len} stroke={color} strokeWidth={strokeWidth} />
              </g>
            );
          }
          if (renderMode === 'realistic') return null;
          if (!showEditingArtifacts) return null;
          if (p.isCoreJoin && p.hasPicotArm) {
            return (
              <g key={p.id} data-ui="1">
                <line x1={x} y1={y} x2={x + Math.cos(perpAngle) * len} y2={y + Math.sin(perpAngle) * len} stroke={color} strokeWidth={isSelected ? "4" : "2"} />
                <circle cx={x} cy={y} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} />
              </g>
            );
          }
          return <g key={p.id} data-ui="1"><circle cx={x} cy={y} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} /></g>;
        }
        // Guide Point (gp): no visual — pure snap point on path
        if (p.isGuidePoint) {
          return null;
        }
        if (p.beadType === 'bcp') {
          if (beadAndJointOnly) return null;
          return renderBcpBead(p.id, x, y, perpAngle, p.coreSize, p.beadSeq, color, len);
        }
        if (p.beadType === 'bc') {
          if (beadAndJointOnly) return null;
          return renderCoreBead(p.id, x, y, p.beadSize, color, perpAngle);
        }
        if (p.beadType === 'sb' && p.beadSeq) {
          if (beadAndJointOnly) return null;
          return renderSuspendedBead(p.id, x, y, perpAngle, p.beadSeq, color);
        }
        if (p.beadSeq) {
          if (beadAndJointOnly) return null;
          return renderBeadedPicot(p.id, x, y, perpAngle, p.beadSeq, color, len);
        }
        if (beadAndJointOnly) return null;
        return (
          <g key={p.id} className={p.isGuide ? 'guide-picot' : undefined}>
            <line x1={x} y1={y} x2={endX} y2={endY} stroke={color} strokeWidth={strokeWidth} />
            
          </g>
        );
      });
    }

    // Path-based rendering for teardrops and chains
    // Calculate total path length
    let totalLength = 0;
    const pathLengths = [];
    for (let path of element.paths) {
      const points = sampleBezierPath(path, 20);
      const len = calculatePathLength(points);
      pathLengths.push(len);
      totalLength += len;
    }

    return element.picots.map(p => {
      // Find position along combined path  
      const _sb5 = (p.beadType === 'bc' || p.beadType === 'bcp' || p.beadType === 'be') ? p.stitchesBefore + 0.5 : p.stitchesBefore;
      const targetDist = (_sb5 / element.stitchCount) * totalLength;
      let accum = 0;
      let pathIndex = 0;
      let localT = 0;

      for (let i = 0; i < pathLengths.length; i++) {
        if (accum + pathLengths[i] >= targetDist) {
          pathIndex = i;
          localT = (targetDist - accum) / pathLengths[i];
          break;
        }
        accum += pathLengths[i];
      }

      const path = element.paths[pathIndex];
      const t = localT;
      
      let x, y, dx, dy;
      if (path.type === 'cubic') {
        // Cubic Bezier position and derivative
        x = (1-t)*(1-t)*(1-t)*path.x + 
            3*(1-t)*(1-t)*t*path.control1X + 
            3*(1-t)*t*t*path.control2X + 
            t*t*t*path.endX;
        y = (1-t)*(1-t)*(1-t)*path.y + 
            3*(1-t)*(1-t)*t*path.control1Y + 
            3*(1-t)*t*t*path.control2Y + 
            t*t*t*path.endY;
        dx = 3*(1-t)*(1-t)*(path.control1X - path.x) + 
             6*(1-t)*t*(path.control2X - path.control1X) + 
             3*t*t*(path.endX - path.control2X);
        dy = 3*(1-t)*(1-t)*(path.control1Y - path.y) + 
             6*(1-t)*t*(path.control2Y - path.control1Y) + 
             3*t*t*(path.endY - path.control2Y);
      } else if (path.type === 'quadratic') {
        // Quadratic Bezier position and derivative
        x = (1-t)*(1-t)*path.x + 2*(1-t)*t*path.controlX + t*t*path.endX;
        y = (1-t)*(1-t)*path.y + 2*(1-t)*t*path.controlY + t*t*path.endY;
        dx = 2*(1-t)*(path.controlX - path.x) + 2*t*(path.endX - path.controlX);
        dy = 2*(1-t)*(path.controlY - path.y) + 2*t*(path.endY - path.controlY);
      }

      // Calculate perpendicular angle from path tangent
      // (paths are already rotated, so this automatically accounts for element rotation)
      const sideOffset = sideMultiplier === -1 ? Math.PI : 0;
      let perpAngle;
      const _isHalfway = element.isClosed && Math.abs(p.stitchesBefore - element.stitchCount / 2) < 1.5;
      if (_isHalfway && element.paths && element.paths[0]) {
        // Stable axis: vector from join point (path start) → current position
        const joinX = element.paths[0].x, joinY = element.paths[0].y;
        const axDx = x - joinX, axDy = y - joinY;
        const axLen = Math.sqrt(axDx*axDx + axDy*axDy) || 1;
        perpAngle = Math.atan2(axDy / axLen, axDx / axLen) + sideOffset;
      } else {
        perpAngle = Math.atan2(dy, dx) - Math.PI / 2 + sideOffset;
      }
      
      const len = picotSize[p.length] || 20;
      const endX = x + Math.cos(perpAngle) * len;
      const endY = y + Math.sin(perpAngle) * len;
      
      const isSelected = selectedPicots.some(sp => sp.elementId === element.id && sp.picotId === p.id);
      const isConnected = p.isJoint && picotConnections.some(conn => conn.picots.some(cp => cp.elementId === element.id && cp.picotId === p.id));
      const color = p.isJoint
        ? (p.isCoreJoin
          ? (isSelected ? theme.cjSelected : isConnected ? theme.cjConnected : theme.cjUnconnected)
          : (isSelected ? theme.jpSelected : isConnected ? theme.jpConnected : theme.jpUnconnected))
        : p.isGuidePoint
        ? theme.gpDiamond
        : getSolidColor(element);
      const strokeWidth = isSelected ? "4" : "2";

      // BE: render based on beStructure config — always show diamond
      if (p.beadType === 'be') {
        if (beadAndJointOnly && activeMode === 'picotJoin' && !p.beIsJoint) return null;
        return renderBE(p, x, y, perpAngle, color, len, isSelected);
      }
      
      // jp / jpg / cj / cjp: dot on path — schematic only, hidden when editing artifacts off
      if (p.isJoint) {
        // cjp in realistic: render as picot arm
        if (renderMode === 'realistic' && p.isCoreJoin && p.hasPicotArm) {
          return (
            <g key={p.id}>
              <line x1={x} y1={y} x2={x + Math.cos(perpAngle) * len} y2={y + Math.sin(perpAngle) * len} stroke={color} strokeWidth={strokeWidth} />
            </g>
          );
        }
        if (renderMode === 'realistic') return null;
        if (!showEditingArtifacts) return null;
        if (p.isCoreJoin && p.hasPicotArm) {
          return (
            <g key={p.id} data-ui="1">
              <line x1={x} y1={y} x2={x + Math.cos(perpAngle) * len} y2={y + Math.sin(perpAngle) * len} stroke={color} strokeWidth={isSelected ? "4" : "2"} />
              <circle cx={x} cy={y} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} />
            </g>
          );
        }
        return (
          <g key={p.id} data-ui="1">
            <circle cx={x} cy={y} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} />
          </g>
        );
      }

      // Guide Point (gp): no visual — pure snap point on path
      if (p.isGuidePoint) {
        return null;
      }

      // Beaded picot (bp:SEQ)
      if (p.beadType === 'bcp') {
        if (beadAndJointOnly) return null;
        return renderBcpBead(p.id, x, y, perpAngle, p.coreSize, p.beadSeq, color, len);
      }
      if (p.beadType === 'bc') {
        if (beadAndJointOnly) return null;
        return renderCoreBead(p.id, x, y, p.beadSize, color, perpAngle);
      }
      if (p.beadType === 'sb' && p.beadSeq) {
        if (beadAndJointOnly) return null;
        return renderSuspendedBead(p.id, x, y, perpAngle, p.beadSeq, color);
      }
      if (p.beadSeq) {
        if (beadAndJointOnly) return null;
        return renderBeadedPicot(p.id, x, y, perpAngle, p.beadSeq, color, len);
      }

      if (beadAndJointOnly) return null;
      return (
        <g key={p.id} className={p.isGuide ? 'guide-picot' : undefined}>
          <line x1={x} y1={y} x2={endX} y2={endY} stroke={color} strokeWidth={strokeWidth} />
          
        </g>
      );
    });
  };

  // Notation label font sizes
  const NOTATION_FONT_SIZES = { small: 11, medium: 14, large: 18 };
  const notationFS = NOTATION_FONT_SIZES[notationFontSize] || 14;

  const renderStitchLabels = (element) => {
    // Count actual stitches from notation (not DS equivalent)
    const actualStitchCount = countActualStitches(element.notation || '');
    
    // Always show at least the total stitch count if no picots
    if (!element.picots || element.picots.length === 0) {
      const solidColor = getSolidColor(element);
      
      // Show total stitch count for elements without picots
      if (element.isClosed && element.shapeStyle === 'circle') {
        const targetCircumference = element.stitchCount * dsWidth;
        const radius = targetCircumference / (2 * Math.PI);
        const textRadius = radius + (element.labelOffset ?? 8);
        const runs = getSegmentRuns(element.notation || '', 0, element.stitchCount);
        return runs.map((run, j) => {
          const angleMid = (run.midDS / element.stitchCount) * Math.PI * 2 - Math.PI / 2;
          return (
            <text
              key={`label-${element.id}-np-${j}`}
              x={element.center.x + Math.cos(angleMid) * textRadius}
              y={element.center.y + Math.sin(angleMid) * textRadius}
              fill="white"
              fontSize={notationFS}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              stroke="#000000"
              strokeWidth="4"
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {run.label}
            </text>
          );
        });
      } else if (element.isSplitRing) {
        // Split ring no-picot: runs of A on path[0], runs of B on path[1]
        if (!element.paths || element.paths.length < 2) return null;
        const splitPos = element.splitPosition || Math.floor(element.stitchCount / 2);
        const stitchCountB = element.stitchCount - splitPos;
        const labelsInside = element.labelsInside;
        const offset = element.labelOffset ?? (labelsInside === 'onPath' ? 8 : labelsInside === false ? 22 : -14);
        const labels = [];

        const placeRunsOnPath = (runs, pathCurve, sectionStitchCount, keyPfx) => {
          const sampleSet = [sampleBezierPath(pathCurve, 20)];
          const lenSet = [calculatePathLength(sampleSet[0])];
          const totalLen = lenSet[0];
          runs.forEach((run, j) => {
            const dist = (run.midDS / sectionStitchCount) * totalLen;
            const { x, y, angle } = getPointAndAngleAtDistanceFast(sampleSet, lenSet, dist);
            const perpAngle = angle - Math.PI / 2;
            labels.push(
              <text
                key={`${keyPfx}-${j}`}
                x={x + Math.cos(perpAngle) * offset}
                y={y + Math.sin(perpAngle) * offset}
                fill="white"
                fontSize={notationFS}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                stroke="#000000"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {run.label}
              </text>
            );
          });
        };

        const runsA = getSegmentRuns(element.notation || '', 0, splitPos);
        const runsB = getSegmentRuns(`sr: ${element.notationB || '5ds'}`, 0, stitchCountB);
        if (element.paths[0]) placeRunsOnPath(runsA, element.paths[0], splitPos, `label-${element.id}-srnp0`);
        if (element.paths[1]) placeRunsOnPath(runsB, element.paths[1], stitchCountB, `label-${element.id}-srnp1`);
        return labels.length > 0 ? labels : null;
      } else {
        // For teardrops and chains with no picots: one label per stitch-type run
        if (!element.paths || element.paths.length === 0) return null;
        const allSamplesNP = element.paths.map(p => sampleBezierPath(p, 20));
        const pathLengthsNP = allSamplesNP.map(s => calculatePathLength(s));
        const totalLengthNP = pathLengthsNP.reduce((a, b) => a + b, 0);
        const labelsInside = element.labelsInside;
        const offset = element.labelOffset ?? (labelsInside === 'onPath' ? 8 : labelsInside === false ? 25 : -15);

        const runs = getSegmentRuns(element.notation || '', 0, element.stitchCount);
        return runs.map((run, j) => {
          const targetDist = (run.midDS / element.stitchCount) * totalLengthNP;
          const { x, y, angle: rawAngle } = getPointAndAngleAtDistanceFast(allSamplesNP, pathLengthsNP, targetDist);
          const perpAngle = rawAngle - Math.PI / 2;
          return (
            <text
              key={`label-${element.id}-np-${j}`}
              x={x + Math.cos(perpAngle) * offset}
              y={y + Math.sin(perpAngle) * offset}
              fill="white"
              fontSize={notationFS}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              stroke="#000000"
              strokeWidth="4"
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {run.label}
            </text>
          );
        });
      }
    }

    // Has picots - show segments between picots
    const solidColor = getSolidColor(element);
    const segments = [];
    let lastPos = 0;
    
    for (let i = 0; i <= element.picots.length; i++) {
      const endPos = i < element.picots.length ? element.picots[i].stitchesBefore : element.stitchCount;
      const count = endPos - lastPos;
      if (count > 0) {
        segments.push({ start: lastPos, count });
      }
      lastPos = endPos;
    }

    if (segments.length === 0) return null;

    // Special handling for circles (rendered as SVG circle, not paths)
    if (element.isClosed && element.shapeStyle === 'circle') {
      const targetCircumference = element.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      const labelsInside = element.labelsInside;
      const textRadius = radius + (element.labelOffset ?? (labelsInside === 'onPath' ? 8 : labelsInside === false ? 25 : radius * -0.35));
      
      return segments.flatMap((seg, i) => {
        const runs = getSegmentRuns(element.notation || '', seg.start, seg.start + seg.count);
        return runs.map((run, j) => {
          const angleMid = (run.midDS / element.stitchCount) * Math.PI * 2 - Math.PI / 2;
          return (
            <text
              key={`label-${element.id}-${i}-${j}`}
              x={element.center.x + Math.cos(angleMid) * textRadius}
              y={element.center.y + Math.sin(angleMid) * textRadius}
              fill="white"
              fontSize={notationFS}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              stroke="#000000"
              strokeWidth="4"
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {run.label}
            </text>
          );
        });
      });
    }

    // Split ring: handle A and B sections separately on their own paths
    if (element.isSplitRing) {
      const splitPos = element.splitPosition || Math.floor(element.stitchCount / 2);
      const labelsInside = element.labelsInside;
      const offset = element.labelOffset ?? (labelsInside === 'onPath' ? 8 : labelsInside === false ? 22 : -14);
      const labels = [];

      // Section A: picots where stitchesBefore < splitPos → labels on path[0]
      const picotsA = (element.picots || []).filter(p => p.stitchesBefore <= splitPos);
      const segmentsA = [];
      let lastA = 0;
      for (let i = 0; i <= picotsA.length; i++) {
        const endPos = i < picotsA.length ? picotsA[i].stitchesBefore : splitPos;
        const cnt = endPos - lastA;
        if (cnt > 0) segmentsA.push({ start: lastA, count: cnt });
        lastA = endPos;
      }

      // Section B: picots where stitchesBefore > splitPos → labels on path[1]
      const picotsB = (element.picots || []).filter(p => p.stitchesBefore > splitPos);
      const stitchCountB = element.stitchCount - splitPos;
      const segmentsB = [];
      let lastB = 0;
      for (let i = 0; i <= picotsB.length; i++) {
        const endPos = i < picotsB.length ? picotsB[i].stitchesBefore - splitPos : stitchCountB;
        const cnt = endPos - lastB;
        if (cnt > 0) segmentsB.push({ start: lastB, count: cnt });
        lastB = endPos;
      }

      const renderSectionLabels = (segs, pathCurve, sectionStitchCount, sectionNotation, sectionId) => {
        const sampleSet = [sampleBezierPath(pathCurve, 20)];
        const lenSet = [calculatePathLength(sampleSet[0])];
        const totalLen = lenSet[0];
        segs.forEach((seg, i) => {
          const runs = getSegmentRuns(sectionNotation, seg.start, seg.start + seg.count);
          runs.forEach((run, j) => {
            const dist = (run.midDS / sectionStitchCount) * totalLen;
            const { x, y, angle } = getPointAndAngleAtDistanceFast(sampleSet, lenSet, dist);
            const perpAngle = angle - Math.PI / 2;
            labels.push(
              <text
                key={`label-${element.id}-sr${sectionId}-${i}-${j}`}
                x={x + Math.cos(perpAngle) * offset}
                y={y + Math.sin(perpAngle) * offset}
                fill="white"
                fontSize={notationFS}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                stroke="#000000"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {run.label}
              </text>
            );
          });
        });
      };

      if (element.paths[0]) renderSectionLabels(segmentsA, element.paths[0], splitPos, element.notation || 'sr: 5ds', 'A');
      if (element.paths[1]) renderSectionLabels(segmentsB, element.paths[1], stitchCountB, `sr: ${element.notationB || '5ds'}`, 'B');
      return labels.length > 0 ? labels : null;
    }

    // Path-based rendering for teardrops and chains
    // Pre-sample once for performance
    const allSamplesL = element.paths.map(p => sampleBezierPath(p, 20));
    const pathLengths = allSamplesL.map(s => calculatePathLength(s));
    const totalLength = pathLengths.reduce((a, b) => a + b, 0);

    const labelsInside = element.labelsInside;
    const offset = element.labelOffset ?? (labelsInside === 'onPath' ? 8 : labelsInside === false ? 25 : -15);

    return segments.flatMap((seg, i) => {
      const runs = getSegmentRuns(element.notation || '', seg.start, seg.start + seg.count);
      return runs.map((run, j) => {
        const targetDist = (run.midDS / element.stitchCount) * totalLength;
        const { x, y, angle: rawAngle } = getPointAndAngleAtDistanceFast(allSamplesL, pathLengths, targetDist);
        const perpAngle = rawAngle - Math.PI / 2;
        return (
          <text
            key={`label-${element.id}-${i}-${j}`}
            x={x + Math.cos(perpAngle) * offset}
            y={y + Math.sin(perpAngle) * offset}
            fill="white"
            fontSize={notationFS}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            stroke="#000000"
            strokeWidth="4"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {run.label}
          </text>
        );
      });
    });
  };

  // Memoize selectedElement to avoid recalculation on every render
  const selectedElement = useMemo(() => {
    return selectedIds.length === 1 ? elementById.get(selectedIds[0]) : null;
  }, [selectedIds, elements]);

  // PERFORMANCE OPTIMIZATION: Separate solid colors from gradients (static calculation)
  const solidColors = useMemo(() => {
    return dmcColors.filter(c => c.type !== 'gradient');
  }, [dmcColors]);

  const gradientColors = useMemo(() => {
    return dmcColors.filter(c => c.type === 'gradient');
  }, [dmcColors]);

  // PERFORMANCE OPTIMIZATION: Memoize bounding box calculation
  const selectedBoundingBox = useMemo(() => {
    if (selectedIds.length === 0) return null;
    return getBoundingBox(selectedIds);
  }, [selectedIds, elements]); // Recalculate when selection or elements change

  // PERFORMANCE: Per-element world-space bounding boxes for viewport culling.
  // Simple/conservative AABB — slightly oversized is fine, the goal is to skip clearly off-screen elements.
  const elementBoundsCache = useMemo(() => {
    const map = new Map();
    const PICOT_MARGIN = 40; // px world-space margin for picots/beads
    for (const el of elements) {
      if (el.isClosed && el.shapeStyle === 'circle') {
        const r = (el.stitchCount * dsWidth) / (2 * Math.PI) + PICOT_MARGIN;
        map.set(el.id, { minX: el.center.x - r, minY: el.center.y - r, maxX: el.center.x + r, maxY: el.center.y + r });
      } else if (el.paths && el.paths.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const path of el.paths) {
          // Use bezier control points as conservative hull (cheaper than sampling)
          const pts = path.type === 'cubic'
            ? [{ x: path.x, y: path.y }, { x: path.control1X, y: path.control1Y },
               { x: path.control2X, y: path.control2Y }, { x: path.endX, y: path.endY }]
            : [{ x: path.x, y: path.y }, { x: path.controlX ?? path.control1X, y: path.controlY ?? path.control1Y },
               { x: path.endX, y: path.endY }];
          for (const p of pts) {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
          }
        }
        map.set(el.id, { minX: minX - PICOT_MARGIN, minY: minY - PICOT_MARGIN,
                         maxX: maxX + PICOT_MARGIN, maxY: maxY + PICOT_MARGIN });
      }
    }
    return map;
  }, [elements, dsWidth]);

  // Returns true if an element's bounding box overlaps the current camera viewport.
  // Always returns true for selected elements (avoid disappearing while dragging off-edge).
  const isInViewport = (el) => {
    if (selectedIds.includes(el.id)) return true; // never cull selected
    const bounds = elementBoundsCache.get(el.id);
    if (!bounds) return true; // no bounds = render to be safe
    const { width: cw, height: ch } = canvasSizeRef.current;
    // Convert viewport screen corners to world coords
    const vMinX = -camera.x / zoom;
    const vMinY = -camera.y / zoom;
    const vMaxX = (cw - camera.x) / zoom;
    const vMaxY = (ch - camera.y) / zoom;
    // AABB overlap test (with a small extra margin so elements don't pop at exact edge)
    const MARGIN = 50 / zoom;
    return bounds.maxX > vMinX - MARGIN && bounds.minX < vMaxX + MARGIN &&
           bounds.maxY > vMinY - MARGIN && bounds.minY < vMaxY + MARGIN;
  };

  // PERFORMANCE OPTIMIZATION: Memoize rotation handles visibility
  const shouldShowRotationHandles = isShiftHeld || showRotationHandles;

  // PERFORMANCE OPTIMIZATION: Debounced search for DMC colors
  // Prevents expensive filtering on every keystroke
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(dmcSearchTerm);
    }, 300); // 300ms delay
    
    return () => clearTimeout(timerId);
  }, [dmcSearchTerm]);

  // Track last selected element's material for use on new elements
  useEffect(() => {
    if (selectedIds.length > 0) {
      const lastSelected = elementById.get(selectedIds[selectedIds.length - 1]);
      if (lastSelected) {
        lastUsedMaterialIdRef.current = lastSelected.materialId || 'default';
      }
    }
  }, [selectedIds]);

  // ESC key closes modal windows
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (showSplash) { setShowSplash(false); return; }
      if (renderMode === 'realistic') { handleSetRenderMode('schematic'); return; }
      if (showColorPicker) { setShowColorPicker(false); setPickerCallback(null); setPickerGradientCallback(null); setPickerTabsAllowed(null); return; }
      if (showMaterialsPanel) { setShowMaterialsPanel(false); return; }
      if (showAbout) { setShowAbout(false); return; }
      if (showHelpMenu) { setShowHelpMenu(false); return; }
      if (showHelp) { setShowHelp(false); return; }
      if (showBeadLibrary) { setShowBeadLibrary(false); return; }
      if (showPolarGridPanel) { setShowPolarGridPanel(false); return; }
      if (showThreadProperties) { setShowThreadProperties(false); return; }
      if (activeMode === 'picotJoin') { setActiveMode(null); setShowJoinTip(false); setSelectedPicots([]); return; }
      if (activeMode === 'beading') { setActiveMode(null); setSelectedBEs([]); return; }
      if (activeMode === 'tattingOrder') { setActiveMode(null); setSelectedIds([]); return; }
      if (currentTool === 'zoomRect') { setCurrentTool('select'); setZoomRectBox(null); return; }
      if (currentTool === 'ruler' && rulerPoints.length > 0) { setRulerPoints([]); setRulerMousePos(null); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSplash, showColorPicker, showMaterialsPanel, showHelp, showBeadLibrary, showPolarGridPanel, showThreadProperties, currentTool, activeMode, renderMode, rulerPoints]);

  // Resolve the correct help URL whenever the help modal opens or language changes.
  // Fetches the localised file and checks the body — Vite/SPA dev servers return
  // index.html (200 OK, text/html) for missing files, so we must read the content
  // and confirm it is NOT the app shell before using the localised URL.
  useEffect(() => {
    if (!showHelp) { setHelpUrlReady(false); return; }
    const localUrl = language === 'en' ? './tatting-help.html' : `./tatting-help_${language}.html`;
    if (language === 'en') {
      setResolvedHelpUrl(localUrl);
      setHelpUrlReady(true);
      return;
    }
    setHelpUrlReady(false);
    fetch(localUrl)
      .then(res => res.text())
      .then(text => {
        // SPA fallback index.html always has id="root" and Vite's module script.
        // A real static help file never will.
        const isAppShell = text.includes('id="root"') || text.includes('<script type="module"');
        setResolvedHelpUrl(isAppShell ? './tatting-help.html' : localUrl);
        setHelpUrlReady(true);
      })
      .catch(() => { setResolvedHelpUrl('./tatting-help.html'); setHelpUrlReady(true); });
  }, [showHelp, language]);

  // UI Guide URL resolution — same pattern as help
  useEffect(() => {
    if (!showUiGuide) { setUiGuideUrlReady(false); return; }
    const localUrl = language === 'en' ? './tatting-ui-guide.html' : `./tatting-ui-guide_${language}.html`;
    if (language === 'en') { setResolvedUiGuideUrl(localUrl); setUiGuideUrlReady(true); return; }
    setUiGuideUrlReady(false);
    fetch(localUrl)
      .then(res => res.text())
      .then(text => {
        const isAppShell = text.includes('id="root"') || text.includes('<script type="module"');
        setResolvedUiGuideUrl(isAppShell ? './tatting-ui-guide.html' : localUrl);
        setUiGuideUrlReady(true);
      })
      .catch(() => { setResolvedUiGuideUrl('./tatting-ui-guide.html'); setUiGuideUrlReady(true); });
  }, [showUiGuide, language]);

  // Update filteredSolidColors to use debounced search
  const filteredSolidColorsDebounced = useMemo(() => {
    return solidColors.filter(color => {
      // Search filter with debounced term
      if (debouncedSearchTerm) {
        const search = debouncedSearchTerm.toLowerCase();
        if (!color.id.toLowerCase().includes(search) && 
            !color.name.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [solidColors, debouncedSearchTerm]);

  // Helper function to get a solid color for picots and labels when element has gradient
  // Get the effective color for an element — material override takes priority
  const getElementColor = (element) => {
    const mat = materialsById.get(element.materialId && element.materialId !== 'default'
      ? element.materialId : 'default');
    if (mat) {
      if (mat.isGradient && mat.color) return { isGradient: true, id: mat.color };
      if (mat.color) return { isGradient: false, color: mat.color };
    }
    // No material match — use element's own color
    return { isGradient: element.isGradient || false, color: element.color };
  };

  // PERFORMANCE OPTIMIZATION: Memoize all stitch geometry calculations.
  // calculateCircleStitches / calculatePathStitches / calculateSplitRingStitches are
  // expensive (Bézier sampling, trig per stitch) and must NOT run on every React render.
  // Placed here because it depends on getElementColor (defined just above).
  // This cache recomputes only when elements, renderMode, or dsWidth actually change.
  const stitchCache = useMemo(() => {
    const map = new Map();
    if (renderMode !== 'realistic') return map; // schematic mode needs nothing
    for (const el of elements) {
      if (el.isClosed && el.shapeStyle === 'circle') {
        map.set(el.id, calculateCircleStitches(el));
      } else if (el.isSplitRing) {
        map.set(el.id, calculateSplitRingStitches(el));
      } else if (el.type === 'chain' || el.type === 'ring') {
        map.set(el.id, calculatePathStitches(el));
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, renderMode, dsWidth]);

  // ── BAKED REALISTIC VIEW ──────────────────────────────────────────────────
  // Runs once on switch to realistic. Serializes all stitch geometry to a
  // static SVG string. Pan/zoom then costs zero geometry work.
  const bakeRealisticView = () => {
    const scale = calculateStitchScale();
    const offsetAmount = dsWidth * 0.125 + 5;
    const PICOT_TIP_H = { sp: 1.2, p: 2.0, lp: 3.2, medium: 2.0, small: 1.2, large: 3.2 };
    const PICOT_BASE_OFF = 0.6;

    // ── bounds tracking ──
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const expand = (x: number, y: number) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };

    // ── per-element SVG fragments ──
    const fragments: string[] = [];

    for (const el of elements) {
      const elColor = getElementColor(el);

      // ── helper: picot SVG for a path element ──
      const picotSVG = (totalPathLength: any): string => {
        if (!el.picots) return '';
        const picotSideDir = el.picotSideMultiplier || 1;
        const N = el.stitchCount;
        let out = '';
        for (const picot of el.picots) {
          // cjp: core join with picot arm — render arm in realistic mode
          if (picot.isJoint && picot.isCoreJoin && picot.hasPicotArm) {
            const tMid   = picot.stitchesBefore / N;
            const tLeft  = Math.max(0, (picot.stitchesBefore - PICOT_BASE_OFF) / N);
            const tRight = Math.min(1, (picot.stitchesBefore + PICOT_BASE_OFF) / N);
            const tipH   = (PICOT_TIP_H[picot.length] || 2.0) * dsWidth;
            const ptAt = (frac: number) =>
              getPointAndAngleAtDistanceFast(
                totalPathLength.allSamples,
                totalPathLength.pathLengths,
                frac * totalPathLength.totalLength
              );
            const ptMid   = ptAt(tMid);
            const ptLeft  = ptAt(tLeft);
            const ptRight = ptAt(tRight);
            let nx: number, ny: number;
            const isHalfway = el.isClosed && Math.abs(picot.stitchesBefore - N / 2) < 1.5;
            if (isHalfway) {
              const ptJoin = ptAt(0);
              const ax = ptMid.x - ptJoin.x, ay = ptMid.y - ptJoin.y;
              const al = Math.sqrt(ax*ax + ay*ay) || 1;
              nx = (ax / al) * picotSideDir;
              ny = (ay / al) * picotSideDir;
            } else {
              nx =  Math.sin(ptMid.angle) * picotSideDir;
              ny = -Math.cos(ptMid.angle) * picotSideDir;
            }
            const bL  = { x: ptLeft.x,  y: ptLeft.y  };
            const bR  = { x: ptRight.x, y: ptRight.y };
            const tip = { x: ptMid.x + nx * tipH, y: ptMid.y + ny * tipH };
            const cpx = 2 * tip.x - 0.5 * (bL.x + bR.x);
            const cpy = 2 * tip.y - 0.5 * (bL.y + bR.y);
            const cjColor = elColor.isGradient
              ? getGradientColorAtPosition(elColor.id, tMid)
              : elColor.color;
            const lw = el.lineWidth || 2;
            const d = `M ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${bR.x.toFixed(2)} ${bR.y.toFixed(2)}`;
            expand(bL.x, bL.y); expand(tip.x, tip.y); expand(bR.x, bR.y);
            out += `<path d="${d}" stroke="black" stroke-width="${lw + 2}" fill="none" stroke-linecap="round"/>`;
            out += `<path d="${d}" stroke="${cjColor}" stroke-width="${lw}" fill="none" stroke-linecap="round"/>`;
            continue;
          }
          if (picot.isJoint || picot.isGuidePoint || picot.beadType) continue;
          const tMid   = picot.stitchesBefore / N;
          const tLeft  = Math.max(0, (picot.stitchesBefore - PICOT_BASE_OFF) / N);
          const tRight = Math.min(1, (picot.stitchesBefore + PICOT_BASE_OFF) / N);
          const tipH   = (PICOT_TIP_H[picot.length] || 2.0) * dsWidth;

          const ptAt = (frac: number) =>
            getPointAndAngleAtDistanceFast(
              totalPathLength.allSamples,
              totalPathLength.pathLengths,
              frac * totalPathLength.totalLength
            );

          const ptMid   = ptAt(tMid);
          const ptLeft  = ptAt(tLeft);
          const ptRight = ptAt(tRight);

          let nx: number, ny: number;
          const isHalfway = el.isClosed && Math.abs(picot.stitchesBefore - N / 2) < 1.5;
          if (isHalfway) {
            const ptJoin = ptAt(0);
            const ax = ptMid.x - ptJoin.x, ay = ptMid.y - ptJoin.y;
            const al = Math.sqrt(ax*ax + ay*ay) || 1;
            nx = (ax / al) * picotSideDir;
            ny = (ay / al) * picotSideDir;
          } else {
            nx =  Math.sin(ptMid.angle) * picotSideDir;
            ny = -Math.cos(ptMid.angle) * picotSideDir;
          }

          const bL  = { x: ptLeft.x,  y: ptLeft.y  };
          const bR  = { x: ptRight.x, y: ptRight.y };
          const tip = { x: ptMid.x + nx * tipH, y: ptMid.y + ny * tipH };
          const cpx = 2 * tip.x - 0.5 * (bL.x + bR.x);
          const cpy = 2 * tip.y - 0.5 * (bL.y + bR.y);

          const picotColor = elColor.isGradient
            ? getGradientColorAtPosition(elColor.id, tMid)
            : elColor.color;
          const lw = el.lineWidth || 2;
          const d = `M ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${bR.x.toFixed(2)} ${bR.y.toFixed(2)}`;

          expand(bL.x, bL.y); expand(tip.x, tip.y); expand(bR.x, bR.y);

          out += `<path d="${d}" stroke="black" stroke-width="${lw + 2}" fill="none" stroke-linecap="round"/>`;
          out += `<path d="${d}" stroke="${picotColor}" stroke-width="${lw}" fill="none" stroke-linecap="round"/>`;
        }
        return out;
      };

      // ── stitch buckets → merged paths per color ──
      const stitchesToSVG = (stitches: any[], isCircle: boolean, isSplitRing = false): string => {
        if (!stitches || stitches.length === 0) return '';
        const buckets = new Map<string, string[]>();
        const strokeW = 0.05 * scale;

        for (let i = 0; i < stitches.length; i++) {
          const stitch = stitches[i];
          const stitchTypes = Array.isArray(stitch.type) ? stitch.type : [stitch.type];
          for (let subIdx = 0; subIdx < stitchTypes.length; subIdx++) {
            const type = stitchTypes[subIdx];
            const dsPos = stitch.dsPosition ?? i;
            const effectiveIndex = stitchTypes.length > 1
              ? dsPos + (subIdx / stitchTypes.length)
              : dsPos;

            let wedgePaths: string[];
            if (isCircle) {
              wedgePaths = renderWedgeRingShapes(stitch, el, scale, offsetAmount, type);
            } else if (el.isClosed) {
              wedgePaths = renderWedgeTeardropShapes(stitch, el, scale, offsetAmount, type, effectiveIndex, stitchTypes.length);
            } else {
              wedgePaths = renderWedgeChainShapes(stitch, el, scale, offsetAmount, type, effectiveIndex);
            }

            const existing = buckets.get(stitch.color) || [];
            buckets.set(stitch.color, existing.concat(wedgePaths));

            // expand bounds from stitch positions
            expand(stitch.x - dsWidth, stitch.y - dsWidth);
            expand(stitch.x + dsWidth, stitch.y + dsWidth);
          }
        }

        let out = '';
        for (const [color, dParts] of buckets.entries()) {
          const d = dParts.filter(Boolean).join(' ');
          if (d) out += `<path d="${d}" fill="${color}" stroke="black" stroke-width="${strokeW.toFixed(3)}" stroke-linejoin="miter"/>`;
        }
        return out;
      };

      let frag = '';

      if (el.isClosed && el.shapeStyle === 'circle') {
        // ── circle ring ──
        const stitches = calculateCircleStitches(el);
        const r = el.stitchCount * dsWidth / (2 * Math.PI);
        expand(el.center.x - r - dsWidth*2, el.center.y - r - dsWidth*2);
        expand(el.center.x + r + dsWidth*2, el.center.y + r + dsWidth*2);
        // picots for circle: simple arc approach (no path sampling needed)
        frag += stitchesToSVG(stitches, true);

      } else if (el.isSplitRing) {
        // ── split ring ──
        const cached = calculateSplitRingStitches(el);
        const stitchesA = cached.filter((_: any, i: number) => i < cached.length / 2);
        const stitchesB = cached.filter((_: any, i: number) => i >= cached.length / 2);
        const allSamplesA = [sampleBezierPath(el.paths[0], 50)];
        const pathLengthsA = allSamplesA.map((s: any[]) => calculatePathLength(s));
        const totalLengthA = pathLengthsA.reduce((a: number, b: number) => a + b, 0);
        const allSamplesB = [sampleBezierPath(el.paths[1], 50)];
        const pathLengthsB = allSamplesB.map((s: any[]) => calculatePathLength(s));
        const totalLengthB = pathLengthsB.reduce((a: number, b: number) => a + b, 0);
        // Use path bounding for expand
        for (const path of el.paths || []) {
          const pts = sampleBezierPath(path, 20);
          for (const pt of pts) expand(pt.x, pt.y);
        }
        frag += stitchesToSVG(cached, false, true);

      } else if (el.type === 'chain' || el.type === 'ring') {
        // ── path element (chain / teardrop ring) ──
        const cached = calculatePathStitches(el);
        const stitches = cached?.stitches ?? cached;
        if (stitches && stitches.length > 0) {
          const allSamples = (el.paths || []).map((p: any) => sampleBezierPath(p, 50));
          const pathLengths = allSamples.map((s: any[]) => calculatePathLength(s));
          const totalLength = pathLengths.reduce((a: number, b: number) => a + b, 0);
          const totalPathLength = { allSamples, pathLengths, totalLength };

          // expand bounds from path
          for (const path of el.paths || []) {
            const pts = sampleBezierPath(path, 20);
            for (const pt of pts) expand(pt.x, pt.y);
          }

          frag += picotSVG(totalPathLength);
          frag += stitchesToSVG(stitches, false);
        }

      } else if (el.type === 'line') {
        // ── line element — simple stroke ──
        const elStroke = elColor.isGradient
          ? getGradientColorAtPosition(elColor.id, 0.5)
          : elColor.color;
        for (const path of el.paths || []) {
          let d: string;
          if (path.type === 'cubic') {
            d = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
          } else {
            d = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
          }
          frag += `<path d="${d}" fill="none" stroke="black" stroke-width="${(el.lineWidth || 2) + 2}" stroke-linecap="round"/>`;
          frag += `<path d="${d}" fill="none" stroke="${elStroke}" stroke-width="${el.lineWidth || 2}" stroke-linecap="round"/>`;
          const pts = sampleBezierPath(path, 20);
          for (const pt of pts) expand(pt.x, pt.y);
        }
      }

      if (frag) fragments.push(frag);
    }

    // ── fallback bounds ──
    if (!isFinite(minX)) { minX = -100; minY = -100; maxX = 100; maxY = 100; }
    const PAD = dsWidth * 3;
    minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
    const W = maxX - minX, H = maxY - minY;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}">${fragments.join('')}</svg>`;
    setBakedRealisticSVG(svg);
  };

  // ── handleSetRenderMode: wrapper that manages baking on transition ──────
  const handleSetRenderMode = (next: string) => {
    if (next === 'realistic') {
      setCurrentTool('pan');
      setBakedRealisticSVG(null);
      setRenderMode('realistic');
      // Defer baking one tick so React can commit renderMode first
      setTimeout(() => bakeRealisticView(), 0);
    } else {
      setBakedRealisticSVG(null);
      setRenderMode('schematic');
    }
  };

  const getSolidColor = (element) => {
    const mat = materialsById.get(element.materialId || 'default');
    if (mat && !mat.isGradient) return mat.color;
    if (mat && mat.isGradient) {
      const gradientColor = dmcColors.find(c => c.id === mat.color);
      if (gradientColor?.stops) {
        if (typeof gradientColor.stops === 'string') return gradientColor.stops.split(',')[0].split(':')[1];
        if (Array.isArray(gradientColor.stops) && gradientColor.stops.length > 0) return gradientColor.stops[0].color;
      }
    }
    if (!element.isGradient) return element.color;
    
    // Element has gradient - get first color from gradient stops
    const gradientColor = dmcColors.find(c => c.id === element.color);
    if (!gradientColor || !gradientColor.stops) return '#FFFFFF'; // Fallback
    
    // Parse stops to get first color
    if (typeof gradientColor.stops === 'string') {
      const firstStop = gradientColor.stops.split(',')[0];
      const color = firstStop.split(':')[1];
      return color;
    } else if (Array.isArray(gradientColor.stops) && gradientColor.stops.length > 0) {
      return gradientColor.stops[0].color;
    }
    
    return '#FFFFFF'; // Fallback
  };

  // Get snap points for an element
  const getSnapPoints = (element) => {
    const points = [];
    
    if (element.type === 'line') {
      // Lines: 2 endpoints (start and end)
      if (element.paths && element.paths.length > 0) {
        const path = element.paths[0];
        points.push({ x: path.x,    y: path.y,    type: 'line-start', elementId: element.id });
        points.push({ x: path.endX, y: path.endY, type: 'line-end',   elementId: element.id });
      }
    } else if (element.type === 'chain') {
      // Chains: 2 endpoints
      if (element.paths && element.paths.length > 0) {
        const firstPath = element.paths[0];
        const lastPath = element.paths[element.paths.length - 1];
        
        points.push({
          x: firstPath.x,
          y: firstPath.y,
          type: 'chain-start',
          elementId: element.id
        });
        
        points.push({
          x: lastPath.endX,
          y: lastPath.endY,
          type: 'chain-end',
          elementId: element.id
        });
      }
    } else if (element.type === 'ring' && element.isClosed) {
      if (element.shapeStyle === 'circle') {
        // Circle: top point (12 o'clock) - MUST account for rotation
        const targetCircumference = element.stitchCount * dsWidth;
        const radius = targetCircumference / (2 * Math.PI);
        const rotation = (element.rotation || 0) * Math.PI / 180; // Convert to radians
        
        // Calculate top point with rotation applied
        const topX = element.center.x + Math.sin(rotation) * radius;
        const topY = element.center.y - Math.cos(rotation) * radius;
        
        points.push({
          x: topX,
          y: topY,
          type: 'ring-top',
          elementId: element.id
        });
      } else if (element.isSplitRing) {
        // Split ring: top and bottom guide points along the height line
        if (element.paths && element.paths.length >= 2) {
          // Top point (paths[0] ends here after drawing from bottom to top)
          points.push({
            x: element.paths[0].endX,
            y: element.paths[0].endY,
            type: 'split-ring-top',
            elementId: element.id
          });
          // Bottom point (paths[0] starts here)
          points.push({
            x: element.paths[0].x,
            y: element.paths[0].y,
            type: 'split-ring-bottom',
            elementId: element.id
          });
        }
      } else {
        // Teardrop: use the tip point (first path's starting point - already rotated)
        if (element.paths && element.paths.length > 0) {
          const firstPath = element.paths[0];
          points.push({
            x: firstPath.x,
            y: firstPath.y,
            type: 'ring-top',
            elementId: element.id
          });
        }
      }
    }
    
    // Add snap points for guide joined picots (jpg) and guide points (gp)
    if (element.picots && element.picots.length > 0) {
      element.picots.forEach(picot => {
        // Both gp and jpg have isGuide=true — snap at base for gp, tip for jpg (handled by getPicotPosition)
        if (picot.isGuide) {
          const picotPos = getPicotPosition(element, picot);
          if (picotPos) {
            points.push({
              x: picotPos.x,
              y: picotPos.y,
              type: 'picot-guide',
              elementId: element.id,
              picotId: picot.id
            });
          }
        }
      });
    }
    
    return points;
  };

  // Find nearest snap point to given world coordinates
  const findNearestSnapPoint = (worldX, worldY, excludeIds = null) => {
    if (!snapEnabled) return null;
    
    // Normalise excludeIds to a Set for O(1) lookup
    const excluded = excludeIds instanceof Set ? excludeIds
      : excludeIds != null ? new Set([excludeIds])
      : new Set();
    
    let nearestPoint = null;
    const effectiveSnapRadius = snapRadius / zoom; // screen-pixel-constant
    let nearestDist = effectiveSnapRadius;
    
    elements.forEach(el => {
      if (excluded.has(el.id)) return;
      
      // Spatial pre-filter: rough bound on element size (largest rings ~200px radius at high stitch counts)
      // Skip if element center is clearly too far to have any snap point within snapRadius
      const centerDist = Math.hypot(el.center.x - worldX, el.center.y - worldY);
      if (centerDist > effectiveSnapRadius + 400) return; // 400px covers even very large elements
      
      const snapPoints = getSnapPoints(el);
      snapPoints.forEach(point => {
        const dist = Math.hypot(point.x - worldX, point.y - worldY);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPoint = point;
        }
      });
    });
    
    return nearestPoint;
  };

  // ── Polar grid snap candidates ───────────────────────────────────────────
  // Injected after element snap: polar ring×spoke intersections are candidates
  // only when snapEnabled. Uses same nearestDist so element snaps still win.
  const findNearestSnapPointWithPolar = (worldX, worldY, excludeIds = null) => {
    let result = findNearestSnapPoint(worldX, worldY, excludeIds);
    if (!snapEnabled) return result;
    const effectiveSnapRadius = snapRadius / zoom;
    let nearestDist = result ? Math.hypot(result.x - worldX, result.y - worldY) : effectiveSnapRadius;
    for (const grid of polarGrids) {
      if (!grid.visible) continue;
      for (const ring of grid.rings) {
        if (!ring.snap || !ring.visible) continue;
        // Pre-filter: ring center too far even for max radius
        const centerDist = Math.hypot(grid.center.x - worldX, grid.center.y - worldY);
        if (centerDist > ring.radius + effectiveSnapRadius) continue;
        const offsetRad = ((grid.angularOffset || 0) + (ring.angularOffset || 0)) * Math.PI / 180;
        for (let i = 0; i < ring.divisions; i++) {
          const angle = offsetRad + (i / ring.divisions) * 2 * Math.PI;
          const px = grid.center.x + ring.radius * Math.cos(angle);
          const py = grid.center.y + ring.radius * Math.sin(angle);
          const dist = Math.hypot(px - worldX, py - worldY);
          if (dist < nearestDist) {
            nearestDist = dist;
            result = { x: px, y: py };
          }
        }
      }
    }
    return result;
  };

  return (
    <>
      {/* Load notification toast */}
      {loadMsg && (
        <div
          className="fixed bottom-8 left-1/2 pointer-events-none"
          style={{ transform: 'translateX(-50%)', zIndex: 2147483647 }}
        >
          <div className={`flex items-center gap-3 px-5 py-3 rounded-lg shadow-2xl text-white font-semibold text-sm border ${
            loadMsg.type === 'success'
              ? 'bg-green-700 border-green-500'
              : 'bg-red-800 border-red-500'
          }`}>
            <span>{loadMsg.type === 'success' ? '✓' : '✕'}</span>
            <span>{loadMsg.text}</span>
          </div>
        </div>
      )}

      <style>{`
        /* Prevent browser interference with gestures */
        html, body {
          overscroll-behavior: none; /* Prevent pull-to-refresh on mobile */
          touch-action: none; /* Prevent browser zoom gestures */
          overflow: hidden;
        }

        /* Force dark background + light text on <option> elements.
           On Linux/GTK the native dropdown ignores the parent select's CSS,
           causing white-on-white text. This rule fixes it. */
        select option {
          background-color: #374151; /* gray-700 */
          color: #f9fafb;            /* gray-50 */
        }
        
        /* Mobile responsive styles */
        /* Property bar: consistent button + input heights on ALL screen sizes */
        .top-row-properties button {
          height: 1.75rem;
          min-height: 1.75rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 0.4rem;
          white-space: nowrap;
          box-sizing: border-box;
        }
        .top-row-properties input[type="text"],
        .top-row-properties input[type="number"] {
          height: 1.75rem;
          min-height: 1.75rem;
          box-sizing: border-box;
          padding: 0 0.3rem;
        }
        .top-row-properties input[type="range"] {
          height: 1.75rem;
        }
        
        @media (max-width: 768px) {
          /* Scale Row 1 buttons aggressively on mobile */
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.85) !important;
            padding: 0.15rem 0.3rem !important;
          }
          .top-row-buttons {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
          }
          /* Hide dividers on mobile */
          .top-row-buttons .w-px {
            display: none !important;
          }
          .top-row-buttons .ml-auto {
            display: none !important;
          }
          
          .mobile-no-padding {
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
          }
          
          .mobile-toolbar-compact {
            left: 1.5rem !important; /* Was 0.25rem - moved away from unclickable edge */
            top: 0.25rem !important;
            padding: 0.25rem !important;
          }
          
          /* Row 2: Properties bar - NO GAP OVERRIDES, just sizing */
          .top-row-properties {
            flex-wrap: wrap !important;
            overflow-x: hidden !important;
            justify-content: flex-start !important;
            padding: 0.25rem 0.5rem !important;
            row-gap: 0.2rem !important;
          }
          
          .top-row-properties > div,
          .top-row-properties .flex {
            flex-shrink: 0 !important;
          }
          
          /* Disable scaling for properties on mobile WIDTH (we handle sizing manually) */
          .top-row-properties .top-toolbar-scalable {
            transform: none !important;
          }
          
          /* Remove spinner arrows from ALL number inputs - reclaims ~16px width */
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }

          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"] {
            padding: 0.2rem 0.3rem !important;
            font-size: 0.7rem !important;
            min-width: 0 !important;
            flex-shrink: 0 !important;
          }
          
          .top-row-properties input.notation-input {
            width: 105px !important; /* 70px * 1.5 = 105px */
          }
          
          .top-row-properties input[type="number"] {
            width: 44px !important;
          }
          
          .top-row-properties input[type="range"] {
            width: 40px !important;
          }
          
          .top-row-properties .w-16 {
            width: 2.5rem !important;
          }
          
          .top-row-properties .w-24 {
            width: 2.5rem !important;
          }
          
          .top-row-properties button {
            padding: 0 0.35rem !important;
            height: 1.6rem !important;
            font-size: 0.7rem !important;
            min-width: 0 !important;
            flex-shrink: 0 !important;
            white-space: nowrap !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"] {
            height: 1.6rem !important;
          }
          
          .top-row-properties .text-xs {
            font-size: 0.65rem !important;
          }
          
          .top-row-properties label.text-xs {
            display: none !important;
          }
          
          .top-row-properties .w-8 {
            width: 1.5rem !important;
          }
          
          .top-row-properties svg {
            width: 14px !important;
            height: 14px !important;
          }
        }
        
        /* Even more aggressive for very narrow screens */
        @media (max-width: 480px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.75) !important;
            padding: 0.1rem 0.2rem !important;
          }
        }
        
        @media (max-width: 380px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.7) !important;
            padding: 0.1rem 0.15rem !important;
          }
        }
        
        @media (max-width: 768px) {
          .mobile-toolbar-compact-right {
            right: 1.5rem !important; /* Was 0.25rem - moved away from unclickable edge */
            top: 0.25rem !important;
            padding: 0.25rem !important;
          }
          .mobile-gap-small {
            gap: 0.25rem !important;
          }
          /* Hide text labels on mobile to save space */
          .hide-label-mobile {
            display: none !important;
          }
          /* Make properties panel inputs smaller on mobile to fit 2 lines */
          .top-toolbar-scalable input[type="text"],
          .top-toolbar-scalable input[type="number"] {
            font-size: 0.75rem !important;
            padding: 0.25rem 0.5rem !important;
          }
          .top-toolbar-scalable button {
            padding: 0.25rem !important;
          }
          .top-toolbar-scalable .text-xs {
            font-size: 0.65rem !important;
          }
        }
        
        /* Scale down side toolbars on narrow screens (mobile width) */
        @media (max-width: 768px) {
          .toolbar-scalable-left {
            transform: scale(0.75) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.75) !important;
            transform-origin: top right !important;
          }
        }
        
        @media (max-width: 480px) {
          .toolbar-scalable-left {
            transform: scale(0.65) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.65) !important;
            transform-origin: top right !important;
          }
        }
        
        @media (max-width: 380px) {
          .toolbar-scalable-left {
            transform: scale(0.55) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.55) !important;
            transform-origin: top right !important;
          }
        }
        
        /* Scale down ALL toolbars when not enough vertical space */
        @media (max-height: 700px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.85) !important;
            padding: 0.15rem 0.3rem !important;
          }
          
          .toolbar-scalable {
            transform: scale(0.68) !important;
          }
          .toolbar-scalable-left {
            transform: scale(0.68) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.68) !important;
            transform-origin: top right !important;
          }
          .toolbar-scalable-bottom {
            transform: translateX(-50%) scale(0.68) !important;
            transform-origin: bottom center !important;
          }
          .top-toolbar-scalable {
            transform: scale(0.68) !important;
            transform-origin: left center !important;
          }
          /* Hide text labels when scaled */
          .hide-label-scaled {
            display: none !important;
          }
        }
        @media (max-height: 600px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.75) !important;
            padding: 0.1rem 0.2rem !important;
          }
          
          .toolbar-scalable {
            transform: scale(0.6) !important;
          }
          .toolbar-scalable-left {
            transform: scale(0.6) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.6) !important;
            transform-origin: top right !important;
          }
          .toolbar-scalable-bottom {
            transform: translateX(-50%) scale(0.6) !important;
            transform-origin: bottom center !important;
          }
          .top-toolbar-scalable {
            transform: scale(0.6) !important;
            transform-origin: left center !important;
          }
          .hide-label-scaled {
            display: none !important;
          }
        }
        @media (max-height: 500px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.7) !important;
            padding: 0.1rem 0.15rem !important;
          }
          
          .toolbar-scalable {
            transform: scale(0.5) !important;
          }
          .toolbar-scalable-left {
            transform: scale(0.5) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.5) !important;
            transform-origin: top right !important;
          }
          .toolbar-scalable-bottom {
            transform: translateX(-50%) scale(0.5) !important;
            transform-origin: bottom center !important;
          }
          .top-toolbar-scalable {
            transform: scale(0.5) !important;
            transform-origin: left center !important;
          }
          .hide-label-scaled {
            display: none !important;
          }
        }
        
        /* Default notation input width on desktop */
        .notation-input {
          width: 340px; /* 2× original for big screens */
        }

        /* ── Large UI Scale ───────────────────────────────────────────
           Boosts all toolbars by 1.25×. The media-query scale-downs still
           apply on top of this (they use !important), so small screens
           still shrink to fit — they just start from a larger base.
        ── */
        .ui-large { font-size: 17.6px; } /* 16px default → ~1.1×; rem-based Tailwind classes (text-xs/sm/base…) scale with this */
        .ui-large .toolbar-scalable-left  { transform: scale(1.25) !important; transform-origin: top left   !important; }
        .ui-large .toolbar-scalable-right { transform: scale(1.25) !important; transform-origin: top right  !important; }
        .ui-large .top-toolbar-scalable   { transform: scale(1.25) !important; transform-origin: left center !important; }
        .ui-large .top-row-buttons button,
        .ui-large .top-row-buttons .relative { transform: scale(1.25) !important; }

        /* On narrow screens, reduce the large-scale factor so toolbars still fit */
        @media (max-width: 768px) {
          .ui-large .toolbar-scalable-left  { transform: scale(0.95) !important; }
          .ui-large .toolbar-scalable-right { transform: scale(0.95) !important; }
          .ui-large .top-toolbar-scalable   { transform: scale(0.95) !important; }
        }
        @media (max-height: 700px) {
          .ui-large .toolbar-scalable-left  { transform: scale(0.85) !important; }
          .ui-large .toolbar-scalable-right { transform: scale(0.85) !important; }
          .ui-large .top-toolbar-scalable   { transform: scale(0.85) !important; }
        }
        @keyframes tattingBakeSpin { to { transform: rotate(360deg); } }
      `}</style>
      <div className={`w-full h-screen flex flex-col select-none${uiScale === 'large' ? ' ui-large' : ''}`} style={{ backgroundColor: bgColor }}>
      {/* Two-row header — paddingTop pushes content below the Android status bar on edge-to-edge WebViews */}
      <div className="bg-gray-800 text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Row 1: Main Commands */}
        <div className="top-row-buttons min-h-12 flex flex-wrap items-center px-4 mobile-no-padding gap-1 md:gap-4 border-b border-gray-700 py-1 md:py-2">
          {/* File operations dropdown menu */}
          <div className="relative" style={{ overflow: 'visible' }}>
            <button
              ref={fileButtonRef}
              onClick={() => setShowFileMenu(!showFileMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              style={{ height: '44px' }}
              title={t('menuFileTitle')}
            >
              <IconMenu size={18} />
              <span className="text-sm font-semibold hide-label-mobile">{t('menuFile')}</span>
              <IconChevronDown size={14} />
            </button>
          </div>
          
          {/* View menu */}
          <div className="relative" style={{ overflow: 'visible' }}>
            <button
              ref={viewButtonRef}
              onClick={() => setShowViewMenu(!showViewMenu)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
              style={{ height: '44px', width: window.innerWidth <= 768 ? '44px' : 'auto' }}
              title={t('menuViewTitle')}
            >
              <IconEyeOn size={18} />
              <span className="text-sm font-medium hide-label-mobile">{t('menuView')}</span>
              <IconChevronDown size={14} className="hide-label-mobile" />
            </button>
          </div>
          
          {/* Divider */}
          <div className="w-px h-8 bg-gray-600"></div>
          
          {/* Undo/Redo/Copy/Paste — centered in remaining space */}
          <div className="flex-1 flex items-center justify-center gap-1">
          <button 
            onClick={undo} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnUndo')}
            disabled={historyIndex === 0 || activeMode === 'beading' || activeMode === 'tattingOrder'}
          >
            <IconUndo size={20} />
          </button>
          <button 
            onClick={redo} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnRedo')}
            disabled={historyIndex >= history.length - 1 || activeMode === 'beading' || activeMode === 'tattingOrder'}
          >
            <IconRedo size={20} />
          </button>
          
          <button 
            onClick={() => {
              if (activeMode === 'beading') copyBEToClipboard();
              else copySelected();
            }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnCopy')}
            disabled={activeMode === 'picotJoin' || (activeMode === 'beading' ? selectedBEs.length === 0 : selectedIds.length === 0)}
          >
            <IconCopy size={20} />
          </button>

          <button
            onClick={() => {
              if (activeMode === 'beading') cutBEToClipboard();
              else cutSelected();
            }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnCut')}
            disabled={activeMode === 'picotJoin' || (activeMode === 'beading' ? selectedBEs.length === 0 : selectedIds.length === 0)}
          >
            <IconCut size={20} />
          </button>
          
          <button 
            onClick={() => {
              if (activeMode === 'beading') pasteBeClipboard();
              else pasteFromClipboard();
            }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnPaste')}
            disabled={activeMode === 'picotJoin' || (activeMode === 'beading' ? !beClipboard || selectedBEs.length === 0 : clipboard.length === 0)}
          >
            <IconPaste size={20} />
          </button>
          </div>{/* end centered flex */}
          
          <button 
            onClick={fitAllElements} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnFitAll')}
            disabled={elements.length === 0}
          >
            <IconFitView size={20} />
          </button>
          
          {/* Arrange menu (Duplicate + Alignment) */}
          <button
            ref={arrangeButtonRef}
            onClick={() => setShowArrangeMenu(!showArrangeMenu)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
            style={{ height: '44px', width: window.innerWidth <= 768 ? '44px' : 'auto' }}
            title={t('menuArrangeTitle')}
          >
            <IconAlignMiddle size={18} />
            <span className="text-sm font-medium hide-label-mobile">{t('menuArrange')}</span>
            <IconChevronDown size={14} className="hide-label-mobile" />
          </button>
          
          {/* Divider */}
          <div className="w-px h-8 bg-gray-600"></div>
          
          {/* Options menu (BG, Grid, Snap) */}
          <button
            ref={optionsButtonRef}
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
            style={{ height: '44px', width: window.innerWidth <= 768 ? '44px' : 'auto' }}
            title={t('menuOptionsTitle')}
          >
            <IconSettings size={18} />
            <span className="text-sm font-medium hide-label-mobile">{t('menuOptions')}</span>
            <IconChevronDown size={14} className="hide-label-mobile" />
          </button>
          
          {/* Divider */}
          <div className="w-px h-8 bg-gray-600"></div>
          
          {/* Help / About dropdown */}
          <button
            ref={helpButtonRef}
            onClick={() => setShowHelpMenu(v => !v)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1 justify-center"
            style={{ height: '44px' }}
            title={t('menuHelpDropdown')}
          >
            <IconHelp size={20} />
            <span className="text-xs">&#9660;</span>
          </button>
        </div>
        
        {/* Row 2: Properties (always visible) */}
        <div className="top-row-properties flex flex-wrap items-center content-start px-4 mobile-no-padding gap-0.5 md:gap-3 bg-gray-750 py-1 md:py-2 justify-start" style={{
          minHeight: '6.5rem',
        }}>
          {renderMode === 'realistic' ? (
            /* ── Realistic mode property bar ─────────────────────────────── */
            <div className="flex items-center gap-3 flex-wrap w-full py-1 top-toolbar-scalable">
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-amber-700 border border-amber-400">
                <IconRenderRealistic size={16} />
                <span className="font-bold text-sm text-white tracking-wide">{t('modeRealisticTitle')}</span>
              </div>
              <span className="text-gray-400 text-xs">{t('modeRealisticSub')}</span>
              <div className="ml-auto">
                <button
                  onClick={() => handleSetRenderMode('schematic')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium border border-gray-400"
                  title={t('toolSwitchSchematic')}
                >
                  <IconRenderSchematic size={14} /> {t('realisticSwitchToSchematic')}
                </button>
              </div>
            </div>
          ) : activeMode === 'picotJoin' ? (
            /* ── Picot Edit mode property bar ───────────────────────────── */
            <div className="flex flex-col gap-1 w-full py-1 top-toolbar-scalable">
              {/* Row 1: mode banner + hint + exit */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-blue-700 border border-blue-400">
                  <IconJoinPicots size={16} />
                  <span className="font-bold text-sm text-white tracking-wide">{t('modePicotJoinTitle')}</span>
                </div>
                <span className="text-gray-400 text-xs">{t('modePicotJoinSub')}</span>
                <div className="ml-auto">
                  <button
                    onClick={() => { setActiveMode(null); setShowJoinTip(false); setSelectedPicots([]); }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium border border-gray-400"
                    title={t('toolExitPicotEdit')}
                  >
                    ✕ {t('picotExitBtn')}
                  </button>
                </div>
              </div>
              {/* Row 2: Join / Cut — bigger, prominent */}
              <div className="flex items-center gap-2">
                <button
                  onClick={joinSelectedPicots}
                  disabled={selectedPicots.length < 2}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold"
                  title={t('toolJoinPicots')}
                >
                  <IconLink size={20} /> {t('picotJoinBtn')}
                </button>
                <button
                  onClick={breakSelectedPicots}
                  disabled={selectedPicots.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold"
                  title={t('toolBreakPicots')}
                >
                  <IconUnlink size={20} /> {t('picotCutBtn')}
                </button>
              </div>
            </div>
          ) : activeMode === 'beading' ? (() => {
            // ── Beading mode property bar ─────────────────────────────────
            // Use last selected as reference for property display; updates apply to all
            const lastBERef = selectedBEs[selectedBEs.length - 1] || null;
            const bePicot = (() => {
              if (!lastBERef) return null;
              const el = elements.find(e => e.id === lastBERef.elementId);
              return el?.picots?.find(p => p.id === lastBERef.picotId) || null;
            })();

            const updateBEPicot = (updates) => {
              if (selectedBEs.length === 0) return;
              setElements(prev => prev.map(el => {
                const toUpdate = selectedBEs.filter(s => s.elementId === el.id);
                if (toUpdate.length === 0) return el;
                const newPicots = (el.picots||[]).map(p =>
                  toUpdate.some(s => s.picotId === p.id) ? {...p,...updates} : p
                );
                // Persist configs so notation edits don't wipe them
                return { ...el, picots: newPicots, beConfigs: extractBEConfigs(newPicots) };
              }));
            };

            const STRUCTURES = [
              { id: 'core',        icon: <IconBeadCore size={16} />,        desc: 'Core only' },
              { id: 'core+picot',  icon: <IconBeadCorePicot size={16} />,   desc: 'Core + plain picot' },
              { id: 'core+beaded', icon: <IconBeadCoreBeaded size={16} />,  desc: 'Core + beaded picot' },
              { id: 'spike',       icon: <IconBeadSuspended size={16} />,   desc: 'Suspended' },
              { id: 'suspended',   icon: <IconBeadSpike size={16} />,       desc: 'Beaded picot' },
            ];

            const coreBeadsEnabled = bePicot && bePicot.beStructure !== 'suspended' && bePicot.beStructure !== 'beaded';
            const picotBeadsEnabled = bePicot && (bePicot.beStructure === 'core+beaded' || bePicot.beStructure === 'spike' || bePicot.beStructure === 'suspended');

            const BeadSlot = ({ slotIdx, beadIds, field }) => {
              const currentId = (beadIds || [])[slotIdx];
              const bead = beadLibrary.find(b => b.id === currentId);
              return (
                <div className="flex items-center gap-1">
                  {bead && <div className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500" style={{backgroundColor: bead.color}} />}
                  <select
                    value={currentId || ''}
                    onChange={e => { const ids = [...(beadIds||[null,null,null])]; ids[slotIdx] = e.target.value||null; updateBEPicot({[field]:ids}); }}
                    className="bg-gray-700 text-white text-xs rounded px-1 py-0.5 border border-gray-600 max-w-28"
                    style={{touchAction:'manipulation'}}
                  >
                    <option value="">— none —</option>
                    {beadLibrary.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              );
            };

            return (
              <div className="flex flex-col gap-1 w-full py-1 top-toolbar-scalable">

                {/* ── Row 1: Mode banner + structure buttons + join + exit ── */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Mode banner */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-purple-700 border border-purple-400 flex-shrink-0">
                    <IconBeadMode size={16} />
                    <span className="font-bold text-sm text-white tracking-wide">{t('modeBeadingTitle')}</span>
                  </div>

                  {/* Selection hint */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedBEs.length === 0 && <span className="text-gray-400 text-xs">{t('beadSelectHint')}</span>}
                    {selectedBEs.length > 1 && <span className="text-purple-300 text-xs">{t('beadSelectedCount').replace('{n}', String(selectedBEs.length))}</span>}
                  </div>

                  {bePicot && <>
                    {/* Structure buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-gray-400 text-xs mr-1">{t('modeBeadStructure')}</span>
                      {STRUCTURES.map(s => (
                        <button key={s.id}
                          onClick={() => updateBEPicot({beStructure: s.id})}
                          title={s.desc}
                          className={`px-2 py-0.5 rounded text-xs font-mono border top-toolbar-scalable ${bePicot.beStructure === s.id ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                          style={{touchAction:'manipulation'}}
                        >{s.icon}</button>
                      ))}
                    </div>

                    {/* Joint toggle */}
                    <button
                      onClick={() => updateBEPicot({beIsJoint: !bePicot.beIsJoint})}
                      title={t('connectableJoinPoint')}
                      className={`px-2 py-0.5 rounded text-xs border flex-shrink-0 top-toolbar-scalable ${bePicot.beIsJoint ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}
                      style={{touchAction:'manipulation'}}
                    ><IconLink size={14} /></button>
                  </>}

                  {/* Copy / Cut / Paste BE config — always visible in beading mode so clipboard
                      state is readable even when no BE is selected yet.
                      Copy/Cut are disabled when no BE is focused; Paste is disabled when the
                      clipboard is empty OR there is no selected target BE. */}
                  <div className="flex items-center gap-1 flex-shrink-0 ml-1 border-l border-gray-600 pl-2">
                    <button
                      onClick={copyBEToClipboard}
                      disabled={!bePicot}
                      title={bePicot ? t('beCopySetup') : 'Select a BE first'}
                      className={`px-2 py-0.5 rounded text-xs border ${bePicot ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'}`}
                      style={{touchAction:'manipulation'}}
                    ><IconCopy size={13} /></button>
                    <button
                      onClick={cutBEToClipboard}
                      disabled={!bePicot}
                      title={bePicot ? t('beCutSetup') : 'Select a BE first'}
                      className={`px-2 py-0.5 rounded text-xs border ${bePicot ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'}`}
                      style={{touchAction:'manipulation'}}
                    ><IconCut size={13} /></button>
                    <button
                      onClick={pasteBeClipboard}
                      disabled={!beClipboard || selectedBEs.length === 0}
                      title={
                        !beClipboard
                          ? 'Paste (nothing copied yet)'
                          : selectedBEs.length === 0
                            ? 'Select a target BE first'
                            : `Paste: ${beClipboard.beStructure}${beClipboard.beIsJoint ? ' + joint' : ''}`
                      }
                      className={`px-2 py-0.5 rounded text-xs border ${beClipboard && selectedBEs.length > 0 ? 'bg-purple-800 border-purple-600 text-purple-200 hover:bg-purple-700' : 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'}`}
                      style={{touchAction:'manipulation'}}
                    ><IconPaste size={13} /></button>
                  </div>

                  {/* Exit — always far right */}
                  <div className="ml-auto flex-shrink-0">
                    <button
                      onClick={() => { setActiveMode(null); setSelectedBEs([]); }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium border border-gray-400"
                      title={t('toolExitBeadEdit')}
                    >
                      ✕ {t('beadExitBtn')}
                    </button>
                  </div>
                </div>

                {/* ── Row 2: Bead dropdowns (only when a picot is selected) ── */}
                {bePicot && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Core bead */}
                    {coreBeadsEnabled && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-gray-400 text-xs">{t('modeBeadCore')}</span>
                        <BeadSlot slotIdx={0} beadIds={bePicot.coreBeads} field="coreBeads" />
                      </div>
                    )}

                    {/* Picot beads (up to 3) */}
                    {picotBeadsEnabled && (
                      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                        <span className="text-gray-400 text-xs">{t('modeBeadPicot')}</span>
                        {[0,1,2].map(i => (
                          <BeadSlot key={i} slotIdx={i} beadIds={bePicot.picotBeads} field="picotBeads" />
                        ))}
                      </div>
                    )}

                    {/* Open bead library */}
                    <button
                      onClick={() => setShowBeadLibrary(true)}
                      className="px-2 py-0.5 bg-purple-800 hover:bg-purple-700 text-purple-200 text-xs rounded border border-purple-600 flex-shrink-0"
                      title={t('toolManageBeadLibrary')}
                    >{t('modeBeadLibraryBtn')}</button>
                  </div>
                )}

              </div>
            );
          })() : activeMode === 'tattingOrder' ? (() => {
            // ── Tatting Order mode property bar ──────────────────────────
            const selectedEl = selectedIds.length === 1 ? elements.find(e => e.id === selectedIds[0]) : null;
            const numbered = elements.filter(e => e.orderNumber != null && String(e.orderNumber).trim() !== '').length;
            const total = elements.length;

            // Active group object (null = Ungrouped scope)
            const activeGroup = activeOrderGroupId
              ? orderGroups.find(g => g.id === activeOrderGroupId) ?? null
              : null;
            const activeGroupIndex = activeGroup
              ? orderGroups.findIndex(g => g.id === activeGroup.id)
              : -1;
            const [activeBadgeFill] = activeGroup
              ? ORDER_GROUP_COLORS[activeGroupIndex % ORDER_GROUP_COLORS.length]
              : ORDER_GROUP_COLORS[0]; // gold for ungrouped

            // Per-group numbered count for the progress chip
            const numberedInScope = elements.filter(e => {
              const hasNum = e.orderNumber != null && String(e.orderNumber).trim() !== '';
              if (!hasNum) return false;
              return activeOrderGroupId === null
                ? !e.orderGroup
                : e.orderGroup === activeOrderGroupId;
            }).length;
            const totalInScope = elements.filter(e =>
              activeOrderGroupId === null ? !e.orderGroup : e.orderGroup === activeOrderGroupId
            ).length;

            return (
              <div className="flex flex-col gap-1 w-full py-1 top-toolbar-scalable">
                {/* Row 1: mode banner + group bar + exit */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-700 border border-emerald-400 flex-shrink-0">
                    <IconUnnumberedOn size={16} />
                    <span className="font-bold text-sm text-white tracking-wide">{t('tattingOrderTitle')}</span>
                  </div>

                  {/* Group dropdown */}
                  <div className="relative flex-shrink-0">
                    {/* Trigger button */}
                    <button
                      ref={groupDropdownButtonRef}
                      onClick={() => { setShowGroupDropdown(d => !d); setShowNewGroupInput(false); setRenamingGroupId(null); }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border border-gray-500 bg-gray-700 hover:bg-gray-600 text-gray-200"
                      style={ activeGroup ? { borderColor: activeBadgeFill, color: activeBadgeFill } : {} }
                    >
                      <span>{activeGroup ? activeGroup.name : t('tattingOrderUngrouped')}</span>
                      <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
                    </button>

                    {/* Dropdown panel — fixed position so it escapes the property bar on mobile */}
                    {showGroupDropdown && (() => {
                      const rect = groupDropdownButtonRef.current?.getBoundingClientRect();
                      const dropTop = rect ? rect.bottom + 4 : 60;
                      const dropLeft = rect ? rect.left : 0;
                      return (
                      <>
                        {/* Click-outside veil */}
                        <div
                          className="fixed inset-0"
                          style={{ zIndex: 9998 }}
                          onClick={() => { setShowGroupDropdown(false); setRenamingGroupId(null); setShowNewGroupInput(false); }}
                        />
                        <div
                          className="fixed rounded-lg border border-gray-500 shadow-2xl py-1 min-w-36"
                          style={{ backgroundColor: '#1f2937', zIndex: 9999, top: dropTop, left: dropLeft }}
                        >
                          {/* Ungrouped row */}
                          <button
                            onClick={() => { setActiveOrderGroupId(null); setShowGroupDropdown(false); setShowNewGroupInput(false); setRenamingGroupId(null); }}
                            className={`w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-gray-700 ${activeOrderGroupId === null ? 'text-yellow-400 font-semibold' : 'text-gray-300'}`}
                          >
                            <span style={{ fontSize: '8px' }}>{activeOrderGroupId === null ? '●' : '○'}</span>
                            {t('tattingOrderUngrouped')}
                          </button>

                          {orderGroups.length > 0 && <div className="my-1 border-t border-gray-600" />}

                          {/* Group rows */}
                          {orderGroups.map((grp, gi) => {
                            const [gpFill] = ORDER_GROUP_COLORS[gi % ORDER_GROUP_COLORS.length];
                            const isActive = activeOrderGroupId === grp.id;
                            const isRenaming = renamingGroupId === grp.id;

                            return (
                              <div key={grp.id} className="flex items-center gap-1 px-1 hover:bg-gray-700 group">
                                {isRenaming ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    value={renameGroupInput}
                                    onChange={e => setRenameGroupInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        const name = renameGroupInput.trim() || grp.name;
                                        const newGroups = orderGroupsRef.current.map(g => g.id === grp.id ? { ...g, name } : g);
                                        setOrderGroups(newGroups);
                                        pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
                                        setRenamingGroupId(null);
                                      }
                                      if (e.key === 'Escape') setRenamingGroupId(null);
                                    }}
                                    onBlur={() => {
                                      const name = renameGroupInput.trim() || grp.name;
                                      const newGroups = orderGroupsRef.current.map(g => g.id === grp.id ? { ...g, name } : g);
                                      setOrderGroups(newGroups);
                                      pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
                                      setRenamingGroupId(null);
                                    }}
                                    onClick={e => e.stopPropagation()}
                                    className="flex-1 px-2 py-0.5 bg-gray-600 border rounded text-white text-xs my-0.5"
                                    style={{ borderColor: gpFill }}
                                  />
                                ) : (
                                  <button
                                    className="flex-1 text-left px-2 py-1 text-xs flex items-center gap-2"
                                    style={{ color: isActive ? gpFill : '#d1d5db' }}
                                    onClick={() => { setActiveOrderGroupId(grp.id); setShowGroupDropdown(false); setShowNewGroupInput(false); }}
                                  >
                                    <span style={{ fontSize: '8px' }}>{isActive ? '●' : '○'}</span>
                                    <span style={{ fontWeight: isActive ? 700 : 400 }}>{grp.name}</span>
                                  </button>
                                )}
                                {/* Pencil — only visible on the active row, always shown (not hover-only) */}
                                {isActive && !isRenaming && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      setRenameGroupInput(grp.name);
                                      setRenamingGroupId(grp.id);
                                    }}
                                    className="px-1 py-0.5 rounded text-gray-400 hover:text-white text-xs flex-shrink-0"
                                    title={t('tattingOrderGroupRename')}
                                  >✏️</button>
                                )}
                                {/* Delete — hover-reveal on all rows */}
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setShowGroupDropdown(false);
                                    setConfirmDialog({
                                      message: t('tattingOrderGroupDeleteConfirm').replace('{name}', grp.name),
                                      confirmLabel: t('confirmDelete'),
                                      onConfirm: () => {
                                        const newEls = elementsRef.current.map(el =>
                                          el.orderGroup === grp.id ? { ...el, orderGroup: undefined } : el
                                        );
                                        const newGroups = orderGroupsRef.current.filter(g => g.id !== grp.id);
                                        setElements(newEls);
                                        setOrderGroups(newGroups);
                                        if (activeOrderGroupId === grp.id) setActiveOrderGroupId(null);
                                        pushHistoryState(newEls, picotConnectionsRef.current, newGroups);
                                      }
                                    });
                                  }}
                                  className="opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded text-red-400 hover:text-red-200 text-xs flex-shrink-0"
                                  title={t('tattingOrderGroupDelete')}
                                >🗑</button>
                              </div>
                            );
                          })}

                          <div className="my-1 border-t border-gray-600" />

                          {/* + New Group */}
                          {showNewGroupInput ? (
                            <div className="flex items-center gap-1 px-2 py-1">
                              <input
                                autoFocus
                                type="text"
                                value={newGroupNameInput}
                                onChange={e => setNewGroupNameInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    const name = newGroupNameInput.trim() ||
                                      t('tattingOrderGroupDefault').replace('{n}', String(orderGroups.length + 1));
                                    const id = crypto.randomUUID();
                                    const newGroups = [...orderGroupsRef.current, { id, name }];
                                    setOrderGroups(newGroups);
                                    setActiveOrderGroupId(id);
                                    setNewGroupNameInput('');
                                    setShowNewGroupInput(false);
                                    setShowGroupDropdown(false);
                                    pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
                                  }
                                  if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupNameInput(''); }
                                }}
                                onClick={e => e.stopPropagation()}
                                placeholder={t('tattingOrderGroupNamePlaceholder')}
                                className="flex-1 px-2 py-0.5 bg-gray-600 border border-emerald-500 rounded text-white text-xs"
                              />
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const name = newGroupNameInput.trim() ||
                                    t('tattingOrderGroupDefault').replace('{n}', String(orderGroups.length + 1));
                                  const id = crypto.randomUUID();
                                  const newGroups = [...orderGroupsRef.current, { id, name }];
                                  setOrderGroups(newGroups);
                                  setActiveOrderGroupId(id);
                                  setNewGroupNameInput('');
                                  setShowNewGroupInput(false);
                                  setShowGroupDropdown(false);
                                  pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
                                }}
                                className="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs border border-emerald-500"
                              >✓</button>
                              <button
                                onClick={e => { e.stopPropagation(); setShowNewGroupInput(false); setNewGroupNameInput(''); }}
                                className="px-1.5 py-0.5 rounded bg-gray-600 hover:bg-gray-500 text-gray-300 text-xs"
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setNewGroupNameInput(t('tattingOrderGroupDefault').replace('{n}', String(orderGroups.length + 1)));
                                setShowNewGroupInput(true);
                              }}
                              className="w-full text-left px-3 py-1 text-xs text-emerald-400 hover:bg-gray-700 hover:text-emerald-300"
                            >
                              {t('tattingOrderGroupNew')}
                            </button>
                          )}
                        </div>
                      </>
                      );
                    })()}
                  </div>

                  {/* Progress in current scope */}
                  <span className="text-xs font-semibold" style={{ color: activeBadgeFill }}>
                    {t('tattingOrderProgress')
                      .replace('{numbered}', String(numberedInScope))
                      .replace('{total}', String(totalInScope))}
                  </span>

                  {!selectedEl && (
                    <span className="text-gray-400 text-xs">{t('tattingOrderSub')}</span>
                  )}

                  <div className="ml-auto flex-shrink-0">
                    <button
                      onClick={() => {
                        const unnumbered = elements.filter(e =>
                          e.type !== 'line' && (!e.orderNumber || String(e.orderNumber).trim() === '')
                        ).length;
                        setActiveMode(null);
                        setSelectedIds([]);
                        setShowNewGroupInput(false);
                        setShowGroupDropdown(false);
                        if (unnumbered > 0) {
                          showLoadMsg('error', t('tattingOrderExitWarning').replace('{n}', String(unnumbered)));
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium border border-gray-400"
                    >
                      ✕ {t('tattingOrderExitBtn')}
                    </button>
                  </div>
                </div>

                {/* Row 2: element controls (only when one element selected) */}
                {selectedEl && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-gray-300 text-xs">{t('tattingOrderNumberLabel')}</span>
                    <input
                      type="number"
                      min={1}
                      value={tattingOrderInput}
                      onChange={e => setTattingOrderInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = parseInt(tattingOrderInput, 10);
                          if (!isNaN(n) && n > 0) assignOrderNumber(selectedEl.id, n);
                        }
                      }}
                      placeholder="—"
                      className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm text-center"
                      style={{ touchAction: 'manipulation' }}
                    />
                    <button
                      onClick={() => {
                        const n = parseInt(tattingOrderInput, 10);
                        if (!isNaN(n) && n > 0) assignOrderNumber(selectedEl.id, n);
                      }}
                      disabled={!tattingOrderInput || isNaN(parseInt(tattingOrderInput, 10))}
                      className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-sm border border-gray-500"
                    >
                      ↵
                    </button>
                    <button
                      onClick={() => {
                        const next = getNextAvailableNumber();
                        assignOrderNumber(selectedEl.id, next);
                      }}
                      className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold border border-emerald-500"
                    >
                      {t('tattingOrderAssignNext')} ({getNextAvailableNumber()})
                    </button>
                    {/* Assign to Group */}
                    <button
                      onClick={() => {
                        const hasNumber = selectedEl.orderNumber != null && String(selectedEl.orderNumber).trim() !== '';
                        if (hasNumber) {
                          const newEls = elementsRef.current.map(e =>
                            e.id === selectedEl.id ? { ...e, orderGroup: activeOrderGroupId ?? undefined } : e
                          );
                          setElements(newEls);
                          pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
                        } else {
                          const next = getNextAvailableNumber();
                          const newEls = elementsRef.current.map(e =>
                            e.id === selectedEl.id ? { ...e, orderGroup: activeOrderGroupId ?? undefined, orderNumber: next } : e
                          );
                          setElements(newEls);
                          setTattingOrderInput('');
                          pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
                        }
                      }}
                      className="px-3 py-1 rounded text-xs font-semibold border"
                      style={{
                        backgroundColor: activeBadgeFill + '33',
                        borderColor: activeBadgeFill,
                        color: activeBadgeFill,
                      }}
                    >
                      {t('tattingOrderAssignGroup')}: {activeGroup ? activeGroup.name : t('tattingOrderUngrouped')}
                    </button>
                    <button
                      onClick={() => {
                        const newEls = elementsRef.current.map(e =>
                          e.id === selectedEl.id ? { ...e, rw: !selectedEl.rw } : e
                        );
                        setElements(newEls);
                        pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
                      }}
                      className={`px-2 py-1 rounded text-xs font-bold border ${selectedEl.rw ? 'bg-amber-600 hover:bg-amber-700 border-amber-500 text-white' : 'bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-300'}`}
                      title={t('propRWTooltip')}
                    >
                      RW
                    </button>
                    <button
                      onClick={() => {
                        const newEls = elementsRef.current.map(e =>
                          e.id === selectedEl.id ? { ...e, orderNumber: null, orderGroup: undefined } : e
                        );
                        setElements(newEls);
                        setTattingOrderInput('');
                        pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
                      }}
                      disabled={!selectedEl.orderNumber}
                      className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 text-sm border border-gray-600"
                    >
                      {t('tattingOrderClear')}
                    </button>
                    {selectedEl.orderNumber && (() => {
                      const selGi = selectedEl.orderGroup
                        ? orderGroups.findIndex(g => g.id === selectedEl.orderGroup)
                        : -1;
                      const [selFill] = ORDER_GROUP_COLORS[selGi >= 0 ? selGi % ORDER_GROUP_COLORS.length : 0];
                      const selGroupName = selGi >= 0 ? orderGroups[selGi]?.name : null;
                      return (
                        <span className="text-xs font-semibold" style={{ color: selFill }}>
                          {selGroupName ? `${selGroupName} #` : '#'}{selectedEl.orderNumber}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })() : selectedElement ? (
            <>
              {selectedElement.type === 'line' ? (
                /* Line properties: order number + optional bead notation */
                <div className="flex items-center gap-0.5 md:gap-3">
                  <span className="text-xs text-gray-400 px-2">{t('infoLine')}</span>
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">{t('propOrder')}</label>
                    <input
                      type="text"
                      value={propBarOrderDraft !== null ? propBarOrderDraft : (selectedElement.orderNumber || '')}
                      onChange={e => setPropBarOrderDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = parseInt(propBarOrderDraft ?? '', 10);
                          if (!isNaN(n) && n > 0) assignOrderNumber(selectedElement.id, n);
                          else if (propBarOrderDraft?.trim() === '') { setElements(prev => prev.map(el => el.id === selectedElement.id ? { ...el, orderNumber: null } : el)); pushOrderHistory(); }
                          setPropBarOrderDraft(null);
                          (e.target as HTMLInputElement).blur();
                        }
                        if (e.key === 'Escape') { setPropBarOrderDraft(null); (e.target as HTMLInputElement).blur(); }
                      }}
                      onFocus={() => setPropBarOrderDraft(selectedElement.orderNumber ? String(selectedElement.orderNumber) : '')}
                      onBlur={() => {
                        if (propBarOrderDraft !== null) {
                          const n = parseInt(propBarOrderDraft, 10);
                          if (!isNaN(n) && n > 0) assignOrderNumber(selectedElement.id, n);
                          else if (propBarOrderDraft.trim() === '') { setElements(prev => prev.map(el => el.id === selectedElement.id ? { ...el, orderNumber: null } : el)); pushOrderHistory(); }
                          setPropBarOrderDraft(null);
                        }
                      }}
                      className="px-2 py-1 bg-gray-700 rounded border border-gray-600 w-16 text-sm"
                      placeholder="#"
                    />
                    {/* Round group picker for lines */}
                    <div className="relative flex-shrink-0">
                        <button
                          ref={propBarGroupButtonRef}
                          onClick={() => setShowPropBarGroupDropdown(d => !d)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300"
                          style={(() => {
                            const grp = selectedElement?.orderGroup ? orderGroups.find(g => g.id === selectedElement.orderGroup) : null;
                            const gi = grp ? orderGroups.findIndex(g => g.id === grp.id) : -1;
                            const [fill] = gi >= 0 ? ORDER_GROUP_COLORS[(gi + 1) % ORDER_GROUP_COLORS.length] : [null];
                            return fill ? { borderColor: fill, color: fill } : {};
                          })()}
                        >
                          <span>{selectedElement?.orderGroup ? (orderGroups.find(g => g.id === selectedElement.orderGroup)?.name ?? t('tattingOrderUngrouped')) : t('tattingOrderUngrouped')}</span>
                          <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
                        </button>
                        {showPropBarGroupDropdown && (() => {
                          const rect = propBarGroupButtonRef.current?.getBoundingClientRect();
                          const dropTop = rect ? rect.bottom + 4 : 60;
                          const dropLeft = rect ? rect.left : 0;
                          return (
                            <>
                              <div className="fixed inset-0" style={{ zIndex: 9998 }}
                                onClick={() => setShowPropBarGroupDropdown(false)} />
                              <div className="fixed rounded-lg border border-gray-500 shadow-2xl py-1 min-w-36"
                                style={{ backgroundColor: '#1f2937', zIndex: 9999, top: dropTop, left: dropLeft }}>
                                <button
                                  onClick={() => {
                                    const newEls = elementsRef.current.map(el => el.id === selectedElement.id ? { ...el, orderGroup: undefined } : el);
                                    setElements(newEls);
                                    setShowPropBarGroupDropdown(false);
                                    pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
                                  }}
                                  className={`w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-gray-700 ${!selectedElement?.orderGroup ? 'text-yellow-400 font-semibold' : 'text-gray-300'}`}
                                >
                                  <span style={{ fontSize: '8px' }}>{!selectedElement?.orderGroup ? '●' : '○'}</span>
                                  {t('tattingOrderUngrouped')}
                                </button>
                                {orderGroups.length > 0 && <div className="my-1 border-t border-gray-600" />}
                                {orderGroups.map((grp, gi) => {
                                  const [gpFill] = ORDER_GROUP_COLORS[(gi + 1) % ORDER_GROUP_COLORS.length];
                                  const isActive = selectedElement?.orderGroup === grp.id;
                                  return (
                                    <button key={grp.id}
                                      onClick={() => {
                                        const newEls = elementsRef.current.map(el => el.id === selectedElement.id ? { ...el, orderGroup: grp.id } : el);
                                        setElements(newEls);
                                        setShowPropBarGroupDropdown(false);
                                        pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
                                      }}
                                      className="w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-gray-700"
                                      style={{ color: isActive ? gpFill : '#d1d5db' }}
                                    >
                                      <span style={{ fontSize: '8px' }}>{isActive ? '●' : '○'}</span>
                                      <span style={{ fontWeight: isActive ? 700 : 400 }}>{grp.name}</span>
                                    </button>
                                  );
                                })}
                                <div className="my-1 border-t border-gray-600" />
                                <button
                                  onClick={() => {
                                    const name = t('tattingOrderGroupDefault').replace('{n}', String(orderGroups.length + 1));
                                    const id = crypto.randomUUID();
                                    const newGroups = [...orderGroupsRef.current, { id, name }];
                                    const newEls = elementsRef.current.map(el => el.id === selectedElement.id ? { ...el, orderGroup: id } : el);
                                    setOrderGroups(newGroups);
                                    setElements(newEls);
                                    setShowPropBarGroupDropdown(false);
                                    pushHistoryState(newEls, picotConnectionsRef.current, newGroups);
                                  }}
                                  className="w-full text-left px-3 py-1 text-xs text-emerald-400 hover:bg-gray-700 hover:text-emerald-300"
                                >
                                  {t('tattingOrderGroupNew')}
                                </button>
                              </div>
                            </>
                          );
                        })()}
                    </div>
                    {/* ── Line bead picker ── */}
                    {(() => {
                      // Normalise: migrate legacy lineBeadId+lineBeadCount to lineBeadSlots on first render
                      const rawSlots = selectedElement.lineBeadSlots;
                      const slots = Array.isArray(rawSlots) ? rawSlots
                        : selectedElement.lineBeadId
                          ? Array.from({length: selectedElement.lineBeadCount ?? 1}, () => selectedElement.lineBeadId)
                          : [];
                      const count = slots.length;
                      const expanded = !!selectedElement.lineBeadExpanded;

                      // "all same" = every non-null slot has the same bead id (or all are null)
                      const nonNull = slots.filter(Boolean);
                      const allSame = nonNull.length === 0 || nonNull.every(id => id === nonNull[0]);
                      const sharedId = allSame ? (nonNull[0] ?? null) : null;

                      // Show per-slot pickers when: user explicitly expanded, OR slots differ
                      const showExpanded = expanded || !allSame;

                      const updateSlots = (newSlots, newExpanded = expanded) =>
                        setElements(prev => prev.map(el =>
                          el.id === selectedElement.id
                            ? {...el, lineBeadSlots: newSlots, lineBeadExpanded: newExpanded, lineBeadId: undefined, lineBeadCount: undefined}
                            : el
                        ));

                      const setCount = (n) => {
                        const next = Array.from({length: n}, (_, i) => slots[i] ?? (sharedId || null));
                        updateSlots(next, expanded);
                      };

                      const setSlot = (i, beadId) => {
                        const next = [...slots];
                        next[i] = beadId || null;
                        updateSlots(next, true); // stay expanded after changing a slot
                      };

                      const setAllSame = (beadId) => {
                        updateSlots(slots.map(() => beadId || null), false);
                      };

                      const toggleExpanded = () => {
                        if (showExpanded) {
                          // Collapse: harmonise all to first non-null bead, then hide per-slot
                          setAllSame(nonNull[0] ?? null);
                        } else {
                          // Expand: show per-slot pickers
                          updateSlots(slots, true);
                        }
                      };

                      return (
                        <div className="flex items-center gap-1 flex-wrap ml-2">
                          <span className="text-xs text-gray-400 hide-label-mobile">{t('modeBeadCore')}:</span>

                          {/* Count spinner */}
                          <input
                            type="number" min={0} max={99}
                            value={count}
                            onChange={e => setCount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="px-1 py-0.5 bg-gray-700 rounded border border-gray-600 w-10 text-sm text-center text-white"
                            title={t('lineBdCountHint')}
                          />

                          {count > 0 && (<>
                            {/* All-same toggle — blue = collapsed/same, grey = expanded/individual */}
                            <button
                              onClick={toggleExpanded}
                              title={showExpanded ? t('lineBdCollapse') : t('lineBdExpand')}
                              className={`px-1.5 py-0.5 rounded text-xs border ${!showExpanded ? 'bg-blue-800 border-blue-500 text-blue-200' : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'}`}
                              style={{touchAction:'manipulation'}}
                            >=</button>

                            {!showExpanded ? (
                              /* Collapsed: one shared dropdown */
                              (() => {
                                const lb = sharedId ? beadLibrary.find(b => b.id === sharedId) : null;
                                return (
                                  <div className="flex items-center gap-1">
                                    {lb && <div className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500" style={{backgroundColor: lb.color}} />}
                                    <select
                                      value={sharedId || ''}
                                      onChange={e => setAllSame(e.target.value || null)}
                                      className="bg-gray-700 text-white text-xs rounded px-1 py-0.5 border border-gray-600 max-w-28"
                                      style={{touchAction:'manipulation'}}
                                    >
                                      <option value="">— none —</option>
                                      {beadLibrary.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                  </div>
                                );
                              })()
                            ) : (
                              /* Expanded: one numbered dropdown per slot */
                              slots.map((slotId, i) => {
                                const lb = slotId ? beadLibrary.find(b => b.id === slotId) : null;
                                return (
                                  <div key={i} className="flex items-center gap-0.5">
                                    <span className="text-xs text-gray-500">{i+1}:</span>
                                    {lb && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-500" style={{backgroundColor: lb.color}} />}
                                    <select
                                      value={slotId || ''}
                                      onChange={e => setSlot(i, e.target.value || null)}
                                      className="bg-gray-700 text-white text-xs rounded px-1 py-0.5 border border-gray-600 max-w-24"
                                      style={{touchAction:'manipulation'}}
                                    >
                                      <option value="">— —</option>
                                      {beadLibrary.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                  </div>
                                );
                              })
                            )}
                          </>)}

                          {/* Copy / Cut / Paste */}
                          <div className="flex items-center gap-1 border-l border-gray-600 pl-2 ml-1">
                            <button
                              onClick={() => setLineBeadClipboard({ lineBeadSlots: [...slots] })}
                              title={t('lineBdCopy')}
                              className="px-1.5 py-0.5 rounded text-xs border bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                              style={{touchAction:'manipulation'}}
                            ><IconCopy size={12} /></button>
                            <button
                              onClick={() => {
                                setLineBeadClipboard({ lineBeadSlots: [...slots] });
                                updateSlots([], false);
                              }}
                              title={t('lineBdCut')}
                              className="px-1.5 py-0.5 rounded text-xs border bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                              style={{touchAction:'manipulation'}}
                            ><IconCut size={12} /></button>
                            {lineBeadClipboard && (
                              <button
                                onClick={() => {
                                  const lineIds = new Set(selectedIds);
                                  setElements(prev => prev.map(el =>
                                    lineIds.has(el.id) && el.type === 'line'
                                      ? {...el, lineBeadSlots: [...lineBeadClipboard.lineBeadSlots], lineBeadExpanded: false, lineBeadId: undefined, lineBeadCount: undefined}
                                      : el
                                  ));
                                }}
                                title={selectedIds.length > 1
                                  ? t('lineBdPasteAll').replace('{n}', String(selectedIds.filter(id => elements.find(e=>e.id===id)?.type==='line').length))
                                  : t('lineBdPaste')}
                                className="px-1.5 py-0.5 rounded text-xs border bg-purple-800 border-purple-600 text-purple-200 hover:bg-purple-700"
                                style={{touchAction:'manipulation'}}
                              ><IconPaste size={12} /></button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
              <>
              {/* Notation input - dual for split rings */}
              {selectedElement.isSplitRing ? (
                <div className="flex items-center gap-1 top-toolbar-scalable">
                  <span className="text-xs text-gray-400">A:</span>
                  <input
                    key={`${selectedElement.id}-A`}
                    type="text"
                    defaultValue={selectedElement.notation.replace(/^sr:\s*/, '')}
                    onChange={(e) => {
                      pendingNotationRef.current = { elementId: selectedElement.id, notation: `sr: ${e.target.value.trim()}`, notationB: elementById.get(selectedElement.id)?.notationB };
                    }}
                    onBlur={(e) => {
                      pendingNotationRef.current = null;
                      if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
                      const notationA = e.target.value.trim();
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) return;
                      const parsedA = parseNotation(`sr: ${notationA}`);
                      if (parsedA && parsedA.stitchCount > 0) {
                        updateNotation(`sr: ${notationA}`, currentElement.notationB, currentElement.id);
                      } else {
                        setAlertDialog({ message: 'Invalid notation for section A.' });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.target.blur(); }
                      else if (e.key === 'Escape') {
                        notationEscapeRef.current = true;
                        pendingNotationRef.current = null;
                        const currentElement = elementById.get(selectedElement.id);
                        if (currentElement) { e.target.value = currentElement.notation.replace(/^sr:\s*/, ''); }
                        e.target.blur();
                      }
                    }}
                    className="notation-input px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm w-20"
                    placeholder="5ds"
                  />
                  <span className="text-xs text-gray-400">B:</span>
                  <input
                    key={`${selectedElement.id}-B`}
                    type="text"
                    defaultValue={selectedElement.notationB || '5ds'}
                    onChange={(e) => {
                      const currentEl = elementById.get(selectedElement.id);
                      pendingNotationRef.current = { elementId: selectedElement.id, notation: currentEl?.notation ?? selectedElement.notation, notationB: e.target.value.trim() };
                    }}
                    onBlur={(e) => {
                      pendingNotationRef.current = null;
                      if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
                      const notationB = e.target.value.trim();
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) return;
                      const parsedB = parseNotation(`sr: ${notationB}`);
                      if (parsedB && parsedB.stitchCount > 0) {
                        updateNotation(currentElement.notation, notationB, currentElement.id);
                      } else {
                        setAlertDialog({ message: 'Invalid notation for section B.' });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.target.blur(); }
                      else if (e.key === 'Escape') {
                        notationEscapeRef.current = true;
                        pendingNotationRef.current = null;
                        const currentElement = elementById.get(selectedElement.id);
                        if (currentElement) { e.target.value = currentElement.notationB || '5ds'; }
                        e.target.blur();
                      }
                    }}
                    className="notation-input px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm w-20"
                    placeholder="5ds"
                  />
                  <span className="text-xs text-gray-400">({selectedElement.stitchCount})</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                  {/* Label removed - icon/placeholder is sufficient */}
                  <input
                    key={selectedElement.id} 
                    type="text"
                    defaultValue={draftNotation?.elementId === selectedElement.id ? draftNotation.value : selectedElement.notation}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      pendingNotationRef.current = { elementId: selectedElement.id, notation: val };
                      setDraftNotation({ elementId: selectedElement.id, value: e.target.value }); // use raw value to preserve cursor
                    }}
                    onBlur={(e) => {
                      pendingNotationRef.current = null;
                      if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
                      const notation = e.target.value.trim();
                      const parsed = parseNotation(notation);
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) { return; }
                      if (parsed && parsed.stitchCount > 0) {
                        setDraftNotation(null);
                        updateNotation(notation, null, currentElement.id);
                      } else {
                        if (parsed && parsed.stitchCount === 0) {
                          setAlertDialog({ message: 'Element must have at least 1 stitch.' });
                        } else if (!parsed) {
                          setAlertDialog({ message: 'The entered notation is invalid. Please check for typos.', sub: 'More information about notation is in the Help menu.' });
                        }
                        // Keep draftNotation so user sees their text on reselect
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      } else if (e.key === 'Escape') {
                        notationEscapeRef.current = true;
                        pendingNotationRef.current = null;
                        setDraftNotation(null);
                        setNotationError(null);
                        const currentElement = elementById.get(selectedElement.id);
                        if (currentElement) { e.target.value = currentElement.notation; }
                        e.target.blur();
                      }
                    }}
                    className={`notation-input px-2 py-1 bg-gray-700 rounded border text-sm ${draftNotation?.elementId === selectedElement.id && notationError ? 'border-red-500' : 'border-gray-600'}`}
                    placeholder="r: 20ds"
                  />
                </div>
              )}
              
              
              {/* Rotation input */}
              <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                {/* Label removed - icons are self-explanatory */}
                <button
                  onClick={() => {
                    const currentRotation = selectedElement.rotation || 0;
                    const newRotation = currentRotation - 90;
                    const delta = -90;
                    
                    const rad = delta * Math.PI / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      
                      const polarPivot = getPolarPivot([el.id]); const pivot = polarPivot || getElementPivot(el);
                      const cx = pivot.x;
                      const cy = pivot.y;
                      const newPaths = el.paths.map(path => {
                        const rotatePoint = (px, py) => {
                          const dx = px - cx;
                          const dy = py - cy;
                          return {
                            x: cx + dx * cos - dy * sin,
                            y: cy + dx * sin + dy * cos
                          };
                        };
                        
                        if (path.type === 'cubic') {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const c1 = rotatePoint(path.control1X, path.control1Y);
                          const c2 = rotatePoint(path.control2X, path.control2Y);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            control1X: c1.x, control1Y: c1.y,
                            control2X: c2.x, control2Y: c2.y
                          };
                        } else {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const ctrl = rotatePoint(path.controlX, path.controlY);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            controlX: ctrl.x, controlY: ctrl.y
                          };
                        }
                      });
                      
                      const newPivot = polarPivot ? { x: pivot.x + (el.center.x - pivot.x) * cos - (el.center.y - pivot.y) * sin, y: pivot.y + (el.center.x - pivot.x) * sin + (el.center.y - pivot.y) * cos } : getElementPivot({ ...el, paths: newPaths });
                      return { ...el, paths: newPaths, rotation: newRotation,
                               center: { x: newPivot.x, y: newPivot.y } };
                    }));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                  title={t('propRotateMinus90')}
                >
                  <IconRotateCCW size={16} />
                </button>
                <input
                  type="text"
                  value={singleRotationInput !== '' ? singleRotationInput : String(parseFloat((((selectedElement.rotation || 0) % 360 + 360) % 360).toFixed(1)))}
                  onChange={(e) => setSingleRotationInput(e.target.value)}
                  onBlur={(e) => {
                    const currentDeg = ((selectedElement.rotation || 0) % 360 + 360) % 360;
                    const result = parseRotationExpr(e.target.value, currentDeg);
                    setSingleRotationInput('');
                    if (result === null) return;
                    const delta = result - (selectedElement.rotation || 0);
                    if (Math.abs(delta) < 0.001) return;
                    const rad = delta * Math.PI / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      const polarPivot = getPolarPivot([el.id]); const pivot = polarPivot || getElementPivot(el);
                      const cx = pivot.x;
                      const cy = pivot.y;
                      const newPaths = el.paths.map(path => {
                        const rotatePoint = (px, py) => {
                          const dx = px - cx;
                          const dy = py - cy;
                          return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
                        };
                        if (path.type === 'cubic') {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const c1 = rotatePoint(path.control1X, path.control1Y);
                          const c2 = rotatePoint(path.control2X, path.control2Y);
                          return { ...path, x: start.x, y: start.y, endX: end.x, endY: end.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
                        } else {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const ctrl = rotatePoint(path.controlX, path.controlY);
                          return { ...path, x: start.x, y: start.y, endX: end.x, endY: end.y, controlX: ctrl.x, controlY: ctrl.y };
                        }
                      });
                      const newPivot = polarPivot
                        ? { x: pivot.x + (el.center.x - pivot.x) * cos - (el.center.y - pivot.y) * sin, y: pivot.y + (el.center.x - pivot.x) * sin + (el.center.y - pivot.y) * cos }
                        : getElementPivot({ ...el, paths: newPaths });
                      return { ...el, paths: newPaths, rotation: result, center: { x: newPivot.x, y: newPivot.y } };
                    }));
                    needsHistoryPushRef.current = true;
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="px-1 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white text-center"
                  style={{width:'6.5ch', minWidth:'6.5ch'}}
                  placeholder="0°"
                />
                {/* ±1° nudge arrows — side by side, press-and-hold to repeat */}
                <button
                  onMouseDown={() => {
                    applySingleRotationDelta(selectedElement.id, 1);
                    nudgeIntervalRef.current = setInterval(() => applySingleRotationDelta(selectedElement.id, 1), 80);
                  }}
                  onMouseUp={() => { if (nudgeIntervalRef.current) { clearInterval(nudgeIntervalRef.current); nudgeIntervalRef.current = null; } }}
                  onMouseLeave={() => { if (nudgeIntervalRef.current) { clearInterval(nudgeIntervalRef.current); nudgeIntervalRef.current = null; } }}
                  className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 flex items-center justify-center select-none"
                  style={{fontSize:'0.6rem', lineHeight:1, minWidth:'1.4rem'}}
                  title={t('rotateNudgePlus')}
                >▲</button>
                <button
                  onMouseDown={() => {
                    applySingleRotationDelta(selectedElement.id, -1);
                    nudgeIntervalRef.current = setInterval(() => applySingleRotationDelta(selectedElement.id, -1), 80);
                  }}
                  onMouseUp={() => { if (nudgeIntervalRef.current) { clearInterval(nudgeIntervalRef.current); nudgeIntervalRef.current = null; } }}
                  onMouseLeave={() => { if (nudgeIntervalRef.current) { clearInterval(nudgeIntervalRef.current); nudgeIntervalRef.current = null; } }}
                  className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 flex items-center justify-center select-none"
                  style={{fontSize:'0.6rem', lineHeight:1, minWidth:'1.4rem'}}
                  title={t('rotateNudgeMinus')}
                >▼</button>
                <button
                  onClick={() => {
                    const currentRotation = selectedElement.rotation || 0;
                    const newRotation = currentRotation + 90;
                    const delta = 90;
                    
                    const rad = delta * Math.PI / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      
                      const polarPivot = getPolarPivot([el.id]); const pivot = polarPivot || getElementPivot(el);
                      const cx = pivot.x;
                      const cy = pivot.y;
                      const newPaths = el.paths.map(path => {
                        const rotatePoint = (px, py) => {
                          const dx = px - cx;
                          const dy = py - cy;
                          return {
                            x: cx + dx * cos - dy * sin,
                            y: cy + dx * sin + dy * cos
                          };
                        };
                        
                        if (path.type === 'cubic') {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const c1 = rotatePoint(path.control1X, path.control1Y);
                          const c2 = rotatePoint(path.control2X, path.control2Y);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            control1X: c1.x, control1Y: c1.y,
                            control2X: c2.x, control2Y: c2.y
                          };
                        } else {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const ctrl = rotatePoint(path.controlX, path.controlY);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            controlX: ctrl.x, controlY: ctrl.y
                          };
                        }
                      });
                      
                      const newPivot = polarPivot ? { x: pivot.x + (el.center.x - pivot.x) * cos - (el.center.y - pivot.y) * sin, y: pivot.y + (el.center.x - pivot.x) * sin + (el.center.y - pivot.y) * cos } : getElementPivot({ ...el, paths: newPaths });
                      return { ...el, paths: newPaths, rotation: newRotation,
                               center: { x: newPivot.x, y: newPivot.y } };
                    }));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                  title={t('propRotatePlus90')}
                >
                  <IconRotateCW size={16} />
                </button>
                
                {/* Flip buttons */}
                <button
                  onClick={() => {
                    // FlipH: mirror left-right across vertical axis.
                    // Pivot = grid center if a grid is linked/selected, else element's own center.
                    const pfg = getPolarFlipGrid([selectedElement.id]);
                    const pivX = pfg ? pfg.center.x : selectedElement.center.x;
                    const pivY = pfg ? pfg.center.y : selectedElement.center.y;
                    flipElements([selectedElement.id], 90, pivX, pivY);
                  }}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                  title={t('propFlipH')}
                >
                  <IconFlipH size={16} />
                </button>
                
                <button
                  onClick={() => {
                    // FlipV: mirror top-bottom across horizontal axis.
                    const pfg = getPolarFlipGrid([selectedElement.id]);
                    const pivX = pfg ? pfg.center.x : selectedElement.center.x;
                    const pivY = pfg ? pfg.center.y : selectedElement.center.y;
                    flipElements([selectedElement.id], 0, pivX, pivY);
                  }}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                  title={t('propFlipV')}
                >
                  <IconFlipV size={16} />
                </button>

                {/* Notation label offset slider */}
                <div className="flex items-center gap-1" title={t('propNotationPos')}>
                  <IconNotationM size={16} className="text-gray-400 shrink-0" />
                  <input
                    type="range"
                    min="-25"
                    max="45"
                    step="1"
                    value={elements.find(e => selectedIds.includes(e.id))?.labelOffset ?? 8}
                    onChange={e => setLabelOffset(Number(e.target.value))}
                    className="w-20 accent-blue-500"
                    title={t('propNotationPos')}
                  />
                </div>

                {/* Hide notation label toggle */}
                <button
                  onClick={() => {
                    const allHidden = elements.filter(e => selectedIds.includes(e.id)).every(e => e.hideLabel);
                    setElements(prev => prev.map(el =>
                      selectedIds.includes(el.id) ? { ...el, hideLabel: !allHidden } : el
                    ));
                  }}
                  className={`px-2 py-1 rounded text-xs ${
                    elements.filter(e => selectedIds.includes(e.id)).every(e => e.hideLabel)
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                  title={t('propHideLabel')}
                >
                  {elements.filter(e => selectedIds.includes(e.id)).every(e => e.hideLabel)
                    ? <IconNotationOff size={16} />
                    : <IconNotationOn size={16} />}
                </button>

                {/* Polar rotation center dropdown — only shown when polar grids exist */}
                {polarGrids.length > 0 && (
                  <>
                    <div className="w-px h-5 bg-gray-600 mx-0.5" />
                    <select
                      value={selectedElement.polarRotationGridId || ''}
                      onChange={e => {
                        const val = e.target.value || null;
                        setElements(prev => prev.map(el =>
                          selectedIds.includes(el.id) ? { ...el, polarRotationGridId: val } : el
                        ));
                        // Reset pivot offset when switching to polar pivot
                        if (val) setPivotOffset({ x: 0, y: 0 });
                      }}
                      className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                      title={t('propPolarRotation')}
                      style={{ maxWidth: '110px' }}
                    >
                      <option value="">{t('propPolarRotationNone')}</option>
                      {polarGrids.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* ── Row 2 starts here ── */}
              <div className="w-full" />

              {/* Order number - for all elements (rings and chains) */}
              <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                <label className="text-xs text-gray-400 hide-label-mobile">{t('propOrder')}</label>
                <input
                  type="text"
                  value={propBarOrderDraft !== null ? propBarOrderDraft : (selectedElement.orderNumber || '')}
                  onChange={e => setPropBarOrderDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const n = parseInt(propBarOrderDraft ?? '', 10);
                      if (!isNaN(n) && n > 0) assignOrderNumber(selectedElement.id, n);
                      else if (propBarOrderDraft?.trim() === '') { setElements(prev => prev.map(el => el.id === selectedElement.id ? { ...el, orderNumber: null } : el)); pushOrderHistory(); }
                      setPropBarOrderDraft(null);
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === 'Escape') { setPropBarOrderDraft(null); (e.target as HTMLInputElement).blur(); }
                  }}
                  onFocus={e => setPropBarOrderDraft(selectedElement.orderNumber ? String(selectedElement.orderNumber) : '')}
                  onBlur={() => {
                    if (propBarOrderDraft !== null) {
                      const n = parseInt(propBarOrderDraft, 10);
                      if (!isNaN(n) && n > 0) assignOrderNumber(selectedElement.id, n);
                      else if (propBarOrderDraft.trim() === '') { setElements(prev => prev.map(el => el.id === selectedElement.id ? { ...el, orderNumber: null } : el)); pushOrderHistory(); }
                      setPropBarOrderDraft(null);
                    }
                  }}
                  className="px-2 py-1 bg-gray-700 rounded border border-gray-600 w-16 text-sm"
                  placeholder="#"
                />
              </div>

              {/* Round group picker — inline next to order number, available outside tatting order mode */}
              <div className="relative flex-shrink-0 top-toolbar-scalable">
                  <button
                    ref={propBarGroupButtonRef}
                    onClick={() => setShowPropBarGroupDropdown(d => !d)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300"
                    style={(() => {
                      const grp = selectedElement?.orderGroup ? orderGroups.find(g => g.id === selectedElement.orderGroup) : null;
                      const gi = grp ? orderGroups.findIndex(g => g.id === grp.id) : -1;
                      const [fill] = gi >= 0 ? ORDER_GROUP_COLORS[(gi + 1) % ORDER_GROUP_COLORS.length] : [null];
                      return fill ? { borderColor: fill, color: fill } : {};
                    })()}
                    title={t('tattingOrderGroupTitle') || 'Assign to round'}
                  >
                    <span>{selectedElement?.orderGroup ? (orderGroups.find(g => g.id === selectedElement.orderGroup)?.name ?? t('tattingOrderUngrouped')) : t('tattingOrderUngrouped')}</span>
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
                  </button>
                  {showPropBarGroupDropdown && (() => {
                    const rect = propBarGroupButtonRef.current?.getBoundingClientRect();
                    const dropTop = rect ? rect.bottom + 4 : 60;
                    const dropLeft = rect ? rect.left : 0;
                    return (
                      <>
                        <div className="fixed inset-0" style={{ zIndex: 9998 }}
                          onClick={() => setShowPropBarGroupDropdown(false)} />
                        <div className="fixed rounded-lg border border-gray-500 shadow-2xl py-1 min-w-36"
                          style={{ backgroundColor: '#1f2937', zIndex: 9999, top: dropTop, left: dropLeft }}>
                          {/* Ungrouped row */}
                          <button
                            onClick={() => {
                              setElements(prev => prev.map(el =>
                                el.id === selectedElement.id ? { ...el, orderGroup: undefined } : el
                              ));
                              setShowPropBarGroupDropdown(false);
                              pushOrderHistory();
                            }}
                            className={`w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-gray-700 ${!selectedElement?.orderGroup ? 'text-yellow-400 font-semibold' : 'text-gray-300'}`}
                          >
                            <span style={{ fontSize: '8px' }}>{!selectedElement?.orderGroup ? '●' : '○'}</span>
                            {t('tattingOrderUngrouped')}
                          </button>
                          {orderGroups.length > 0 && <div className="my-1 border-t border-gray-600" />}
                          {orderGroups.map((grp, gi) => {
                            const [gpFill] = ORDER_GROUP_COLORS[(gi + 1) % ORDER_GROUP_COLORS.length];
                            const isActive = selectedElement?.orderGroup === grp.id;
                            return (
                              <button key={grp.id}
                                onClick={() => {
                                  setElements(prev => prev.map(el =>
                                    el.id === selectedElement.id ? { ...el, orderGroup: grp.id } : el
                                  ));
                                  setShowPropBarGroupDropdown(false);
                                  pushOrderHistory();
                                }}
                                className="w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-gray-700"
                                style={{ color: isActive ? gpFill : '#d1d5db' }}
                              >
                                <span style={{ fontSize: '8px' }}>{isActive ? '●' : '○'}</span>
                                <span style={{ fontWeight: isActive ? 700 : 400 }}>{grp.name}</span>
                              </button>
                            );
                          })}
                          <div className="my-1 border-t border-gray-600" />
                          <button
                            onClick={() => {
                              const name = t('tattingOrderGroupDefault').replace('{n}', String(orderGroups.length + 1));
                              const id = crypto.randomUUID();
                              setOrderGroups(prev => [...prev, { id, name }]);
                              setElements(prev => prev.map(el =>
                                el.id === selectedElement.id ? { ...el, orderGroup: id } : el
                              ));
                              setShowPropBarGroupDropdown(false);
                              setTimeout(() => pushOrderHistory(), 0);
                            }}
                            className="w-full text-left px-3 py-1 text-xs text-emerald-400 hover:bg-gray-700 hover:text-emerald-300"
                          >
                            {t('tattingOrderGroupNew')}
                          </button>
                        </div>
                      </>
                    );
                  })()}
              </div>

              <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                <button
                  onClick={() => {
                    setElements(prev => prev.map(el =>
                      el.id === selectedElement.id ? { ...el, rw: !el.rw } : el
                    ));
                    needsHistoryPushRef.current = true;
                  }}
                  className={`px-2 py-1 rounded text-xs font-bold ${selectedElement.rw ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                  title={t('propRWTooltip')}
                >
                  RW
                </button>
              </div>

              {/* Ring-specific properties */}
              {selectedElement.isClosed && (
                <>
                  {/* Shape toggle - hide for split rings */}
                  {!selectedElement.isSplitRing && (
                    <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                      <label className="text-xs text-gray-400 hide-label-mobile">{t('propShape')}</label>
                      <button
                        onClick={toggleShape}
                        className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 flex items-center gap-1"
                        title={t('propToggleShape')}
                      >
                        {selectedElement.shapeStyle === 'circle' ? <IconShapeCircle size={16} /> : <IconShapeTeardrop size={16} />}
                      </button>
                    </div>
                  )}
                  
                  {/* Squeeze sliders */}
                  {selectedElement.isSplitRing ? (
                    /* Split ring: Sq=squash, CA=C-shape section A, CB=C-shape section B */
                    <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable flex-wrap">
                      <label className="text-xs text-gray-400 hide-label-mobile">{t('propSqueezeSq')}</label>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={selectedElement.squeeze ?? 0.25}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onTouchStart={() => { isInteractingRef.current = true; }}
                        onChange={(e) => {
                          const squeeze = parseFloat(e.target.value);
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                            const stitchCountB = el.stitchCount - stitchCountA;
                            const newPathData = createSplitRingPath(el.center.x, el.center.y, el.stitchCount * dsWidth, stitchCountA, stitchCountB, squeeze, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
                            return applyRotationToPathData({ ...el, squeeze }, newPathData);
                          }));
                        }}
                        onMouseUp={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        onTouchEnd={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        className="w-14"
                      />
                      <span className="text-xs text-gray-400 w-6">{(selectedElement.squeeze ?? 0.25).toFixed(2)}</span>
                      <label className="text-xs text-gray-400 hide-label-mobile">{t('propSqueezeCA')}</label>
                      <input
                        type="range" min="0" max="3" step="0.05"
                        value={selectedElement.squeezeCA ?? 0.75}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onTouchStart={() => { isInteractingRef.current = true; }}
                        onChange={(e) => {
                          const squeezeCA = parseFloat(e.target.value);
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                            const stitchCountB = el.stitchCount - stitchCountA;
                            const newPathData = createSplitRingPath(el.center.x, el.center.y, el.stitchCount * dsWidth, stitchCountA, stitchCountB, el.squeeze ?? 0.25, squeezeCA, el.squeezeCB ?? 0.75);
                            return applyRotationToPathData({ ...el, squeezeCA }, newPathData);
                          }));
                        }}
                        onMouseUp={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        onTouchEnd={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        className="w-14"
                      />
                      <span className="text-xs text-gray-400 w-6">{(selectedElement.squeezeCA ?? 0.75).toFixed(2)}</span>
                      <label className="text-xs text-gray-400 hide-label-mobile">{t('propsqueezeCB')}</label>
                      <input
                        type="range" min="0" max="3" step="0.05"
                        value={selectedElement.squeezeCB ?? 0.75}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onTouchStart={() => { isInteractingRef.current = true; }}
                        onChange={(e) => {
                          const squeezeCB = parseFloat(e.target.value);
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                            const stitchCountB = el.stitchCount - stitchCountA;
                            const newPathData = createSplitRingPath(el.center.x, el.center.y, el.stitchCount * dsWidth, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, squeezeCB);
                            return applyRotationToPathData({ ...el, squeezeCB }, newPathData);
                          }));
                        }}
                        onMouseUp={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        onTouchEnd={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        className="w-14"
                      />
                      <span className="text-xs text-gray-400 w-6">{(selectedElement.squeezeCB ?? 0.75).toFixed(2)}</span>
                      <button
                        onClick={() => {
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                            const stitchCountB = el.stitchCount - stitchCountA;
                            const newPathData = createSplitRingPath(el.center.x, el.center.y, el.stitchCount * dsWidth, stitchCountA, stitchCountB, 0.25, 0.75, 0.75);
                            return { ...el, squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75, rotation: 0, ...newPathData };
                          }));
                        }}
                        className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                        title={t('propResetSqueeze')}
                      >{t('propResetBtn')}</button>
                    </div>
                  ) : (
                    /* Regular ring: single squeeze slider */
                    <div className={`flex items-center gap-0.5 md:gap-2 top-toolbar-scalable${selectedElement.shapeStyle === 'circle' ? ' opacity-40 pointer-events-none' : ''}`}>
                      <label className="text-xs text-gray-400 hide-label-mobile">{t('propSqueeze')}</label>
                      <input
                        type="range" min="-0.5" max="0.5" step="0.1"
                        value={selectedElement.squeeze || 0}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onTouchStart={() => { isInteractingRef.current = true; }}
                        onChange={(e) => {
                          const squeeze = parseFloat(e.target.value);
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const targetLength = el.stitchCount * dsWidth;
                            const newPathData = el.shapeStyle === 'circle'
                              ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
                              : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
                            return applyRotationToPathData({ ...el, squeeze }, newPathData);
                          }));
                        }}
                        onMouseUp={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        onTouchEnd={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        className="w-24"
                        disabled={selectedElement.shapeStyle === 'circle'}
                      />
                      <span className="text-xs text-gray-400 w-8">{(selectedElement.squeeze || 0).toFixed(1)}</span>
                      <button
                        onClick={() => {
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const targetLength = el.stitchCount * dsWidth;
                            const newPathData = el.shapeStyle === 'circle'
                              ? createCirclePath(el.center.x, el.center.y, targetLength, 0)
                              : createTeardropPath(el.center.x, el.center.y, targetLength, 0);
                            return { ...el, squeeze: 0, rotation: 0, ...newPathData };
                          }));
                        }}
                        className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                        title={t('propResetSqueeze')}
                        disabled={selectedElement.shapeStyle === 'circle'}
                      >{t('propResetBtn')}</button>
                    </div>
                  )}
                </>
              )}
              </>
              )}
              {/* Material assignment dropdown — end of property bar */}
              <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
              <div className="flex items-center gap-1 top-toolbar-scalable">
                <label className="text-xs text-gray-400 hide-label-mobile">
                  {selectedElement.isSplitRing ? t('matALabel') : t('materialLabel')}
                </label>
                <select
                  value={selectedElement.materialId || 'default'}
                  onChange={(e) => {
                    const matId = e.target.value;
                    if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
                    setElements(prev => prev.map(el =>
                      selectedIds.includes(el.id) ? { ...el, materialId: matId } : el
                    ));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                  style={{ maxWidth: '120px' }}
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                  <option disabled>──────</option>
                  <option value="__edit__">{t('editMaterials')}</option>
                </select>
                {(() => {
                  const mat = materials.find(m => m.id === (selectedElement.materialId || 'default'));
                  if (!mat) return null;
                  return (
                    <div
                      className="w-5 h-5 rounded border border-gray-500 flex-shrink-0 relative overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: mat.isGradient ? getGradientColorAtPosition(mat.color, 0.5) : mat.color }}
                      title={mat.name}
                    >
                      {mat.isGradient && <span style={{ fontSize:'9px', fontWeight:'bold', color:'white', textShadow:'0 0 2px black,0 0 2px black', lineHeight:1 }}>G</span>}
                    </div>
                  );
                })()}
              </div>

               {/* Material B selector — split rings only, right after Material A */}
               {selectedElement.isSplitRing && (
                 <>
                   <div className="w-px h-6 bg-gray-600 mx-1" />
                   <div className="flex items-center gap-1 top-toolbar-scalable">
                     <label className="text-xs text-gray-400 hide-label-mobile">{t('matBLabel')}</label>
                     <select
                       value={selectedElement.materialIdB || selectedElement.materialId || 'default'}
                       onChange={(e) => {
                         const matId = e.target.value;
                         if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
                         setElements(prev => prev.map(el =>
                           selectedIds.includes(el.id) ? { ...el, materialIdB: matId } : el
                         ));
                       }}
                       className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                       style={{ maxWidth: '110px' }}
                     >
                       {materials.map(m => (
                         <option key={m.id} value={m.id}>{m.name}</option>
                       ))}
                       <option disabled>──────────</option>
                       <option value="__edit__">{t('editMaterials')}</option>
                     </select>
                     {(() => {
                       const matB = materials.find(m => m.id === (selectedElement.materialIdB || selectedElement.materialId || 'default'));
                       if (!matB) return null;
                       return (
                         <div
                           className="w-5 h-5 rounded border border-gray-500 flex-shrink-0 relative overflow-hidden flex items-center justify-center"
                           style={{ backgroundColor: matB.isGradient ? getGradientColorAtPosition(matB.color, 0.5) : matB.color }}
                           title={matB.name}
                         >
                           {matB.isGradient && <span style={{ fontSize:'9px', fontWeight:'bold', color:'white', textShadow:'0 0 2px black,0 0 2px black', lineHeight:1 }}>G</span>}
                         </div>
                       );
                     })()}
                   </div>
                 </>
               )}

            </>
          ) : (
            <>
              {selectedIds.length > 0 && (() => {
                // Check if a group is selected (multiple elements with same groupId)
                const firstElement = elementById.get(selectedIds[0]);
                if (firstElement && firstElement.groupId) {
                  const groupElements = elements.filter(e => e.groupId === firstElement.groupId);
                  if (groupElements.length > 1) {
                    // Group is selected - show group controls
                    return (
                    <>
                      <div className="text-sm text-gray-300 px-2">
                        Group Selected ({groupElements.length} elements)
                      </div>
                      
                      {/* Group Rotation + Flip — same cluster as single elements */}
                      <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                        <button
                          onClick={() => {
                            const delta = -90;
                            const rad = delta * Math.PI / 180;
                            const cos = Math.cos(rad);
                            const sin = Math.sin(rad);
                            
                            // Calculate group center (or polar pivot if set)
                            const _ppN = getPolarPivot(selectedIds);
                            const groupCenterX = _ppN ? _ppN.x : groupElements.reduce((sum, el) => sum + el.center.x, 0) / groupElements.length;
                            const groupCenterY = _ppN ? _ppN.y : groupElements.reduce((sum, el) => sum + el.center.y, 0) / groupElements.length;
                            
                            setElements(prev => prev.map(el => {
                              if (!selectedIds.includes(el.id)) return el;
                              
                              // Rotate element center around group center
                              const dx = el.center.x - groupCenterX;
                              const dy = el.center.y - groupCenterY;
                              const newCenterX = groupCenterX + dx * cos - dy * sin;
                              const newCenterY = groupCenterY + dx * sin + dy * cos;
                              
                              // Rotate all path points around group center
                              const newPaths = el.paths.map(path => {
                                const rotatePoint = (px, py) => {
                                  const pdx = px - groupCenterX;
                                  const pdy = py - groupCenterY;
                                  return {
                                    x: groupCenterX + pdx * cos - pdy * sin,
                                    y: groupCenterY + pdx * sin + pdy * cos
                                  };
                                };
                                
                                if (path.type === 'cubic') {
                                  const start = rotatePoint(path.x, path.y);
                                  const end = rotatePoint(path.endX, path.endY);
                                  const c1 = rotatePoint(path.control1X, path.control1Y);
                                  const c2 = rotatePoint(path.control2X, path.control2Y);
                                  return {
                                    ...path,
                                    x: start.x, y: start.y,
                                    endX: end.x, endY: end.y,
                                    control1X: c1.x, control1Y: c1.y,
                                    control2X: c2.x, control2Y: c2.y
                                  };
                                } else {
                                  const start = rotatePoint(path.x, path.y);
                                  const end = rotatePoint(path.endX, path.endY);
                                  const ctrl = rotatePoint(path.controlX, path.controlY);
                                  return {
                                    ...path,
                                    x: start.x, y: start.y,
                                    endX: end.x, endY: end.y,
                                    controlX: ctrl.x, controlY: ctrl.y
                                  };
                                }
                              });
                              
                              // Update rotation value for ALL elements (so it shows correctly after ungrouping)
                              const newRotation = ((el.rotation || 0) + delta) % 360;
                              
                              return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: newRotation };
                            }));
                            
                            // Clear input after rotation
                            setGroupRotationInput('');
                          }}
                          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                          title={t('propRotateGroupMinus90')}
                        >
                          <IconRotateCCW size={16} />
                        </button>
                        <input
                          type="text"
                          value={groupRotationInput !== '' ? groupRotationInput : String(parseFloat((((groupElements[0]?.rotation || 0) % 360 + 360) % 360).toFixed(1)))}
                          onChange={(e) => { setGroupRotationInput(e.target.value); }}
                          onBlur={(e) => {
                            const currentDeg = ((groupElements[0]?.rotation || 0) % 360 + 360) % 360;
                            const result = parseRotationExpr(e.target.value, currentDeg);
                            setGroupRotationInput('');
                            if (result !== null) applyGroupRotation(result);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const currentDeg = ((groupElements[0]?.rotation || 0) % 360 + 360) % 360;
                              const result = parseRotationExpr(e.currentTarget.value, currentDeg);
                              setGroupRotationInput('');
                              if (result !== null) applyGroupRotation(result);
                              e.currentTarget.blur();
                            }
                          }}
                          className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                          style={{width:'6.5ch', minWidth:'6.5ch'}}
                          placeholder="0°"
                        />
                        <button
                          onClick={() => {
                            const delta = 90;
                            const rad = delta * Math.PI / 180;
                            const cos = Math.cos(rad);
                            const sin = Math.sin(rad);
                            
                            // Calculate group center (or polar pivot if set)
                            const _ppP = getPolarPivot(selectedIds);
                            const groupCenterX = _ppP ? _ppP.x : groupElements.reduce((sum, el) => sum + el.center.x, 0) / groupElements.length;
                            const groupCenterY = _ppP ? _ppP.y : groupElements.reduce((sum, el) => sum + el.center.y, 0) / groupElements.length;
                            
                            setElements(prev => prev.map(el => {
                              if (!selectedIds.includes(el.id)) return el;
                              
                              // Rotate element center around group center
                              const dx = el.center.x - groupCenterX;
                              const dy = el.center.y - groupCenterY;
                              const newCenterX = groupCenterX + dx * cos - dy * sin;
                              const newCenterY = groupCenterY + dx * sin + dy * cos;
                              
                              // Rotate all path points around group center
                              const newPaths = el.paths.map(path => {
                                const rotatePoint = (px, py) => {
                                  const pdx = px - groupCenterX;
                                  const pdy = py - groupCenterY;
                                  return {
                                    x: groupCenterX + pdx * cos - pdy * sin,
                                    y: groupCenterY + pdx * sin + pdy * cos
                                  };
                                };
                                
                                if (path.type === 'cubic') {
                                  const start = rotatePoint(path.x, path.y);
                                  const end = rotatePoint(path.endX, path.endY);
                                  const c1 = rotatePoint(path.control1X, path.control1Y);
                                  const c2 = rotatePoint(path.control2X, path.control2Y);
                                  return {
                                    ...path,
                                    x: start.x, y: start.y,
                                    endX: end.x, endY: end.y,
                                    control1X: c1.x, control1Y: c1.y,
                                    control2X: c2.x, control2Y: c2.y
                                  };
                                } else {
                                  const start = rotatePoint(path.x, path.y);
                                  const end = rotatePoint(path.endX, path.endY);
                                  const ctrl = rotatePoint(path.controlX, path.controlY);
                                  return {
                                    ...path,
                                    x: start.x, y: start.y,
                                    endX: end.x, endY: end.y,
                                    controlX: ctrl.x, controlY: ctrl.y
                                  };
                                }
                              });
                              
                              // Update rotation value for ALL elements (so it shows correctly after ungrouping)
                              const newRotation = ((el.rotation || 0) + delta) % 360;
                              
                              return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: newRotation };
                            }));
                            
                            // Clear input after rotation
                            setGroupRotationInput('');
                          }}
                          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                          title={t('propRotateGroupPlus90')}
                        >
                          <IconRotateCW size={16} />
                        </button>
                        <button
                          onClick={() => {
                            const pfg = getPolarFlipGrid(selectedIds);
                            const pivX = pfg ? pfg.center.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
                            const pivY = pfg ? pfg.center.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
                            flipElements(selectedIds, 90, pivX, pivY);
                          }}
                          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                          title={t('propFlipGroupH')}
                        >
                          <IconFlipH size={16} />
                        </button>
                        <button
                          onClick={() => {
                            const pfg = getPolarFlipGrid(selectedIds);
                            const pivX = pfg ? pfg.center.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
                            const pivY = pfg ? pfg.center.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
                            flipElements(selectedIds, 0, pivX, pivY);
                          }}
                          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                          title={t('propFlipGroupV')}
                        >
                          <IconFlipV size={16} />
                        </button>
                      </div>

                      {/* Notation label offset */}
                      <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                        <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
                        <div className="flex items-center gap-1" title={t('propNotationPos')}>
                          <IconNotationM size={16} className="text-gray-400 shrink-0" />
                          <input
                            type="range"
                            min="-25"
                            max="45"
                            step="1"
                            value={groupElements[0]?.labelOffset ?? 8}
                            onChange={e => setLabelOffset(Number(e.target.value))}
                            className="w-20 accent-blue-500"
                            title={t('propNotationPos')}
                          />
                        </div>
                        <button
                          onClick={() => {
                            const allHidden = groupElements.every(e => e.hideLabel);
                            setElements(prev => prev.map(el =>
                              selectedIds.includes(el.id) ? { ...el, hideLabel: !allHidden } : el
                            ));
                          }}
                          className={`px-2 py-1 rounded text-xs ${
                            groupElements.every(e => e.hideLabel)
                              ? 'bg-orange-600 hover:bg-orange-700 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          }`}
                          title={t('propHideLabel')}
                        >{groupElements.every(e => e.hideLabel) ? <IconNotationOff size={16} /> : <IconNotationOn size={16} />}</button>
                        {/* Polar rotation center — group bar */}
                        {polarGrids.length > 0 && (
                          <>
                            <div className="w-px h-5 bg-gray-600 mx-0.5" />
                            <select
                              value={groupElements.every(e => e.polarRotationGridId === groupElements[0]?.polarRotationGridId)
                                ? (groupElements[0]?.polarRotationGridId || '') : ''}
                              onChange={e => {
                                const val = e.target.value || null;
                                setElements(prev => prev.map(el =>
                                  selectedIds.includes(el.id) ? { ...el, polarRotationGridId: val } : el
                                ));
                              }}
                              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                              title={t('propPolarRotation')}
                              style={{ maxWidth: '110px' }}
                            >
                              <option value="">{t('propPolarRotationNone')}</option>
                              {polarGrids.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    </>
                  );
                }
              }
              // ── Free multi-select bar (no groupId) ──────────────────────────
              if (selectedIds.length > 1) {
                const selEls = elements.filter(e => selectedIds.includes(e.id));

                // Classify each element: 'r', 'c', 'sr', 'line', or null
                const getElType = (el) => {
                  if (el.type === 'line') return 'line';
                  if (el.isSplitRing) return 'sr';
                  if (el.type === 'ring') return 'r';
                  if (el.type === 'chain') return el.isSplitChain ? 'sc' : 'c';
                  return null;
                };

                const nonLines = selEls.filter(e => getElType(e) !== 'line');
                const types = [...new Set(nonLines.map(getElType).filter(Boolean))];
                const allSameType = types.length === 1;
                const sameType = allSameType ? types[0] : null;

                // Check if all share exact same notation (for prefill)
                const prefillNotation = (() => {
                  if (!allSameType || nonLines.length === 0) return null;
                  const first = nonLines[0].notation || '';
                  return nonLines.every(e => (e.notation || '') === first) ? first : null;
                })();

                // Centroid of ALL selected (for transforms when no polar grid is linked)
                const cxAll = selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
                const cyAll = selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;

                // If all selected elements share a polar grid, use the grid centre + its offset as flip axes.
                // FlipH = mirror across axis at (angularOffset + 90°) through grid centre.
                // FlipV = mirror across axis at (angularOffset + 0°)  through grid centre.
                const polarFlipGrid = getPolarFlipGrid(selectedIds);
                const flipPivotX = polarFlipGrid ? polarFlipGrid.center.x : cxAll;
                const flipPivotY = polarFlipGrid ? polarFlipGrid.center.y : cyAll;

                // Axis angles are always 90° (vertical) and 0° (horizontal).
                // The grid contributes only its center as pivot — its angular offset does NOT tilt the flip axis.
                const doFlipH = () => flipElements(selectedIds, 90, flipPivotX, flipPivotY);
                const doFlipV = () => flipElements(selectedIds,  0, flipPivotX, flipPivotY);

                // Type label
                const typeLabel = sameType === 'r' ? 'Rings' : sameType === 'c' ? 'Chains' : sameType === 'sc' ? 'Split Chains' : sameType === 'sr' ? 'Split Rings' : null;

                return (
                  <>
                    {/* Label */}
                    <div className="text-sm text-gray-300 px-2 flex-shrink-0">
                      {selEls.length} {typeLabel ?? 'Mixed'} selected
                    </div>

                    {/* Line bead paste strip — shown when all selected elements are lines */}
                    {selEls.every(e => e.type === 'line') && (
                      <div className="flex items-center gap-1 border-l border-gray-600 pl-2 flex-shrink-0 top-toolbar-scalable">
                        <span className="text-xs text-gray-400 hide-label-mobile">{t('modeBeadCore')}:</span>
                        {lineBeadClipboard ? (
                          <>
                            {(() => {
                              const cbSlots = lineBeadClipboard.lineBeadSlots || [];
                              const nonNull = cbSlots.filter(Boolean);
                              const allSame = nonNull.length === 0 || nonNull.every(id => id === nonNull[0]);
                              const lb = allSame && nonNull[0] ? beadLibrary.find(b => b.id === nonNull[0]) : null;
                              return (<>
                                {lb && <div className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500" style={{backgroundColor: lb.color}} title={lb.name} />}
                                <span className="text-xs text-purple-300">
                                  {cbSlots.length}×{allSame ? (lb?.name ?? 'none') : 'mixed'}
                                </span>
                              </>);
                            })()}
                            <button
                              onClick={() => {
                                setElements(prev => prev.map(el =>
                                  selectedIds.includes(el.id) && el.type === 'line'
                                    ? {...el, lineBeadSlots: [...lineBeadClipboard.lineBeadSlots], lineBeadId: undefined, lineBeadCount: undefined}
                                    : el
                                ));
                              }}
                              title={t('lineBdPasteAll').replace('{n}', String(selEls.length))}
                              className="px-1.5 py-0.5 rounded text-xs border bg-purple-800 border-purple-600 text-purple-200 hover:bg-purple-700"
                              style={{touchAction:'manipulation'}}
                            ><IconPaste size={12} /></button>
                            <button
                              onClick={() => setLineBeadClipboard(null)}
                              title="Clear clipboard"
                              className="px-1.5 py-0.5 rounded text-xs border bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600"
                              style={{touchAction:'manipulation'}}
                            >✕</button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500 italic">{t('lineBdNoClipboard')}</span>
                        )}
                      </div>
                    )}

                    {/* Notation input — only for non-line same-type selections */}
                    {nonLines.length > 0 && (
                      <div className="flex items-center gap-1 top-toolbar-scalable">
                        <input
                          key={selectedIds.join(',')}
                          type="text"
                          defaultValue={prefillNotation ?? ''}
                          disabled={!allSameType}
                          placeholder={allSameType ? (sameType === 'r' ? 'r: 5ds-p-5ds' : sameType === 'c' ? 'c: 5ds-p-5ds' : sameType === 'sc' ? 'sc: 5ds-p-5ds' : 'sr: 5ds-p-5ds') : 'Mixed types'}
                          title={allSameType ? 'Apply notation to all selected' : 'Select same-type elements to edit notation'}
                          onBlur={(e) => {
                            if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
                            if (!allSameType) return;
                            const notation = e.target.value.trim();
                            if (!notation) return;
                            const parsed = parseNotation(notation);
                            if (!parsed || parsed.stitchCount === 0) { e.target.value = prefillNotation ?? ''; return; }
                            setElements(prev => prev.map(el => {
                              if (!selectedIds.includes(el.id)) return el;
                              if (getElType(el) === 'line') return el;
                              if (el.isSplitRing) {
                                // For split rings, apply as notation A, keep notationB
                                const newParsed = parseNotation(notation);
                                if (!newParsed) return el;
                                const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                                const stitchCountB = el.stitchCount - stitchCountA;
                                const pathData = createSplitRingPath(el.center.x, el.center.y, newParsed.stitchCount * dsWidth, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
                                return { ...el, notation, stitchCount: newParsed.stitchCount, picots: restoreBEConfigs(newParsed.picots, el.beConfigs), paths: pathData.paths };
                              }
                              const newParsed = parseNotation(notation);
                              if (!newParsed) return el;
                              const targetLength = newParsed.stitchCount * dsWidth;
                              let newPaths;
                              if (el.type === 'ring') {
                                const pathData = el.shapeStyle === 'teardrop'
                                  ? createTeardropPath(el.center.x, el.center.y, targetLength, el.squeeze ?? 0)
                                  : createTeardropPath(el.center.x, el.center.y, targetLength, 0);
                                newPaths = pathData.paths;
                                // Re-apply rotation
                                if (el.rotation) {
                                  const r = el.rotation * Math.PI / 180, rc = Math.cos(r), rs = Math.sin(r);
                                  const rot = (px, py) => { const dx = px - el.center.x, dy = py - el.center.y; return { x: el.center.x + dx*rc - dy*rs, y: el.center.y + dx*rs + dy*rc }; };
                                  newPaths = newPaths.map(path => {
                                    if (path.type === 'cubic') { const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), c1 = rot(path.control1X, path.control1Y), c2 = rot(path.control2X, path.control2Y); return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y }; }
                                    const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), ctrl = rot(path.controlX, path.controlY); return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
                                  });
                                }
                              } else {
                                newPaths = el.paths; // Chains: keep existing path shape, just update notation
                              }
                              return { ...el, notation, stitchCount: newParsed.stitchCount, picots: restoreBEConfigs(newParsed.picots, el.beConfigs), isSplitChain: newParsed.isSplitChain ?? el.isSplitChain ?? false, paths: newPaths ?? el.paths };
                            }));
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { notationEscapeRef.current = true; e.target.value = prefillNotation ?? ''; e.target.blur(); } }}
                          className={`notation-input px-2 py-1 rounded border text-sm ${allSameType ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'}`}
                          style={{ width: '140px' }}
                        />
                      </div>
                    )}

                    {/* Rotate + Flip */}
                    <div className="flex items-center gap-0.5 md:gap-1 top-toolbar-scalable">
                      <button onClick={() => applyMultiSelectRotationDelta(-90)} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title={t('multiRotateMinus')}><IconRotateCCW size={16} /></button>
                      <input
                        type="text"
                        value={groupRotationInput}
                        onChange={(e) => setGroupRotationInput(e.target.value)}
                        onBlur={(e) => {
                          const s = e.target.value.trim();
                          if (s) {
                            if (!/^[\d\s.+\-*/()]+$/.test(s)) { setGroupRotationInput(''); return; }
                            try {
                              // eslint-disable-next-line no-new-func
                              const v = new Function('"use strict"; return (' + s + ')')();
                              if (typeof v === 'number' && isFinite(v)) applyMultiSelectRotationDelta(v);
                            } catch {}
                          }
                          setGroupRotationInput('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const s = e.currentTarget.value.trim();
                            if (s) {
                              if (/^[\d\s.+\-*/()]+$/.test(s)) {
                                try {
                                  // eslint-disable-next-line no-new-func
                                  const v = new Function('"use strict"; return (' + s + ')')();
                                  if (typeof v === 'number' && isFinite(v)) applyMultiSelectRotationDelta(v);
                                } catch {}
                              }
                            }
                            setGroupRotationInput('');
                            e.currentTarget.blur();
                          }
                        }}
                        className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                        style={{ width: '3.4rem' }}
                        placeholder="Δ°"
                      />
                      <button onClick={() => applyMultiSelectRotationDelta(90)} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title={t('multiRotatePlus')}><IconRotateCW size={16} /></button>
                      <button onClick={doFlipH} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title={t('multiFlipH')}><IconFlipH size={16} /></button>
                      <button onClick={doFlipV} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title={t('multiFlipV')}><IconFlipV size={16} /></button>

                      {/* Notation label offset */}
                      <div className="w-px h-6 bg-gray-600 mx-1" />
                      <div className="flex items-center gap-1" title={t('propNotationPos')}>
                        <IconNotationM size={16} className="text-gray-400 shrink-0" />
                        <input
                          type="range"
                          min="-25"
                          max="45"
                          step="1"
                          value={selEls[0]?.labelOffset ?? 8}
                          onChange={e => setLabelOffset(Number(e.target.value))}
                          className="w-20 accent-blue-500"
                          title={t('propNotationPos')}
                        />
                      </div>
                      <button
                        onClick={() => {
                          const allHidden = selEls.every(e => e.hideLabel);
                          setElements(prev => prev.map(el =>
                            selectedIds.includes(el.id) ? { ...el, hideLabel: !allHidden } : el
                          ));
                        }}
                        className={`px-2 py-1 rounded text-xs ${
                          selEls.every(e => e.hideLabel)
                            ? 'bg-orange-600 hover:bg-orange-700 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                        title={t('propHideLabel')}
                      >{selEls.every(e => e.hideLabel) ? <IconNotationOff size={16} /> : <IconNotationOn size={16} />}</button>
                      {/* Polar rotation center — multi-select bar */}
                      {polarGrids.length > 0 && (
                        <>
                          <div className="w-px h-5 bg-gray-600 mx-0.5" />
                          <select
                            value={selEls.every(e => e.polarRotationGridId === selEls[0]?.polarRotationGridId)
                              ? (selEls[0]?.polarRotationGridId || '') : ''}
                            onChange={e => {
                              const val = e.target.value || null;
                              setElements(prev => prev.map(el =>
                                selectedIds.includes(el.id) ? { ...el, polarRotationGridId: val } : el
                              ));
                            }}
                            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                            title={t('propPolarRotation')}
                            style={{ maxWidth: '110px' }}
                          >
                            <option value="">{t('propPolarRotationNone')}</option>
                            {polarGrids.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                    <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
                    <div className="flex items-center gap-1 top-toolbar-scalable">
                      <label className="text-xs text-gray-400 hide-label-mobile">{t('materialLabel')}</label>
                      <select
                        defaultValue="default"
                        onChange={(e) => {
                          const matId = e.target.value;
                          if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
                          setElements(prev => prev.map(el => {
                            if (!selectedIds.includes(el.id)) return el;
                            // Split rings: set both A and B
                            if (el.isSplitRing) return { ...el, materialId: matId, materialIdB: matId };
                            return { ...el, materialId: matId };
                          }));
                        }}
                        className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                        style={{ maxWidth: '120px' }}
                      >
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        <option disabled>──────</option>
                        <option value="__edit__">{t('editMaterials')}</option>
                      </select>
                    </div>
                  </>
                );
              }

              return null;
            })()}
            
            {/* Empty-state placeholder: keeps bar visually non-blank and stabilises layout */}
            {!selectedElement && selectedIds.length === 0 && currentTool !== 'image' && (
              <span style={{color:'#4b5563', fontSize:'0.75rem', padding:'0.25rem 0.5rem', userSelect:'none'}}>
                {t('propEmptyState')}
              </span>
            )}
            
            {currentTool === 'image' && (
              <>
              {/* Reference image controls when Image tool is selected */}
              {/* Upload button */}
              <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2"
                  title={t('propUploadImage')}
                >
                  <IconLoad size={18} />
                  <span className="text-sm hide-label-mobile">{t('refImageUpload')}</span>
                </button>
              </div>
              
              {referenceImage && (
                <>
                  {/* Opacity slider */}
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">{t('refImageOpacity')}</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={refImageProps.opacity}
                      onChange={(e) => setRefImageProps({...refImageProps, opacity: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-8">{Math.round(refImageProps.opacity * 100)}%</span>
                  </div>
                  
                  {/* Scale slider */}
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">{t('refImageScale')}</label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={refImageProps.scale}
                      onChange={(e) => setRefImageProps({...refImageProps, scale: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-8">{refImageProps.scale.toFixed(1)}x</span>
                  </div>
                  
                  {/* Rotation slider */}
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">{t('refImageRotate')}</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="0.1"
                      value={refImageProps.rotation}
                      onChange={(e) => setRefImageProps({...refImageProps, rotation: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-10">{refImageProps.rotation.toFixed(1)}°</span>
                  </div>

                  {/* Pan X slider */}
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">{t('refImagePanX')}</label>
                    <input
                      type="range"
                      min="-500"
                      max="500"
                      step="0.1"
                      value={refImageProps.x}
                      onChange={(e) => setRefImageProps({...refImageProps, x: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-12">{refImageProps.x.toFixed(1)}</span>
                  </div>

                  {/* Pan Y slider */}
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">{t('refImagePanY')}</label>
                    <input
                      type="range"
                      min="-500"
                      max="500"
                      step="0.1"
                      value={refImageProps.y}
                      onChange={(e) => setRefImageProps({...refImageProps, y: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-12">{refImageProps.y.toFixed(1)}</span>
                  </div>

                  {/* Reset position button */}
                  <button
                    onClick={() => setRefImageProps({...refImageProps, x: 0, y: 0})}
                    className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs border border-gray-600"
                    title={t('refImageResetPosTooltip')}
                  >
                    ⌖ {t('refImageResetPos')}
                  </button>
                  
                  {/* Visibility toggle */}
                  <button
                    onClick={() => setRefImageProps({...refImageProps, visible: !refImageProps.visible})}
                    className={`px-3 py-2 rounded flex items-center gap-2 ${refImageProps.visible ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'}`}
                    title={t('propToggleVisibility')}
                  >
                    <IconEyeOn size={18} />
                    <span className="text-xs hide-label-mobile">{refImageProps.visible ? t('refImageVisible') : t('refImageHidden')}</span>
                  </button>
                  
                  {/* Remove button */}
                  <button
                    onClick={() => setShowRemoveConfirm(true)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center gap-2"
                    title={t('propRemoveImage')}
                  >
                    <IconDelete size={18} />
                    <span className="text-xs hide-label-mobile">{t('refImageRemove')}</span>
                  </button>
                </>
              )}
            </>
            )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 relative">

        {/* ── Notes Drawer ─────────────────────────────────────── */}
        {notesOpen && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '320px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#111827',
              borderRight: '1px solid #374151',
              boxShadow: '4px 0 16px rgba(0,0,0,0.6)',
              pointerEvents: 'auto',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#1F2937',
              borderBottom: '1px solid #374151',
              flexShrink: 0,
            }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>{t('notesTitle')}</span>
              <button
                onClick={() => {
                  // Flush textarea content before closing
                  if (notesTextareaRef.current) setPatternNotes(notesTextareaRef.current.value);
                  setNotesOpen(false);
                }}
                title={t('notesClose')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  touchAction: 'manipulation',
                }}
                onMouseOver={e => e.currentTarget.style.color = '#fff'}
                onMouseOut={e => e.currentTarget.style.color = '#9CA3AF'}
              >
                <IconClose size={18} />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={notesTextareaRef}
              defaultValue={patternNotes}
              onBlur={e => setPatternNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              spellCheck={true}
              style={{
                flex: 1,
                backgroundColor: '#111827',
                color: '#F9FAFB',
                padding: '16px',
                resize: 'none',
                border: 'none',
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '1rem',
                lineHeight: '1.6',
                WebkitUserSelect: 'text',
                userSelect: 'text',
              }}
            />

            {/* Footer */}
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#1F2937',
              borderTop: '1px solid #374151',
              flexShrink: 0,
            }}>
              <span style={{ color: '#6B7280', fontSize: '0.75rem' }}>{t('notesFooter')}</span>
            </div>
          </div>
        )}
        {/* ── End Notes Drawer ──────────────────────────────────── */}

        {/* ── Baking overlay ────────────────────────────────────── */}
        {renderMode === 'realistic' && !bakedRealisticSVG && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 20 }}>
            <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl border border-gray-600" style={{ backgroundColor: 'rgba(17,24,39,0.88)' }}>
              {/* Spinner */}
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#374151" strokeWidth="3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#6366f1" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="44 44"
                  style={{ transformOrigin: '18px 18px', animation: 'tattingBakeSpin 0.9s linear infinite' }} />
              </svg>
              <div className="text-sm font-semibold text-gray-200 text-center">{t('bakingViewTitle')}</div>
              <div className="text-xs text-gray-400 text-center" style={{ maxWidth: '220px', lineHeight: '1.5' }}>{t('bakingViewSub')}</div>
            </div>
          </div>
        )}
        <div className="absolute left-4 top-4 mobile-toolbar-compact toolbar-scalable-left bg-gray-800 text-white p-2 rounded z-10 grid grid-cols-2 gap-1 pointer-events-none" style={{ width: '100px', touchAction: 'none' }}>
          {renderMode === 'realistic' && (
            <>
              {/* Realistic mode: Pan only — editing disabled */}
              <button onClick={() => setCurrentTool('pan')} className="p-2 rounded col-span-2 pointer-events-auto bg-blue-600" style={{ touchAction: 'manipulation' }} title={t('toolPanRealistic')}>
                <IconPan size={20} />
              </button>
              <div className="col-span-2 text-center text-gray-400 text-xs leading-tight px-1 py-0.5">
                {t('toolPanRealisticSub')}<br/>{t('toolPanRealisticSub2')}
              </div>
            </>
          )}
          {renderMode !== 'realistic' && <>
          {/* Row 1: Pan and Select */}
          <button onClick={() => setCurrentTool('pan')} className={`p-2 rounded pointer-events-auto touch-action-manipulation ${currentTool === 'pan' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }} title={t('toolPan')}>
            <IconPan size={20} />
          </button>
          <button onClick={() => setCurrentTool('select')} className={`p-2 rounded pointer-events-auto ${currentTool === 'select' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }} title={t('toolSelect')}>
            <IconSelect size={20} />
          </button>
          
          {/* Row 2: Rotation Handles and Ortho Lock */}
          <button 
            onClick={() => setShowRotationHandles(!showRotationHandles)} 
            className={`p-2 rounded pointer-events-auto ${showRotationHandles ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} 
            style={{ touchAction: 'manipulation' }}
            title={showRotationHandles ? t('toolRotationHandlesHide') : t('toolRotationHandlesShow')}
          >
            <IconRotateMode size={20} />
          </button>
          <button
            onClick={() => setOrthoLock(v => !v)}
            className={`p-2 rounded pointer-events-auto ${orthoLock ? 'bg-orange-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={t('toolOrthoLock')}
          >
            <IconOrtho size={20} />
          </button>

          {/* Row 3: Path Edit */}
          <button onClick={() => setCurrentTool('path')} className={`p-2 rounded pointer-events-auto ${currentTool === 'path' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }} title={t('toolPathEdit')}>
            <IconPathEdit size={20} />
          </button>

          {/* Ruler tool */}
          <button onClick={() => setCurrentTool('ruler')} className={`p-2 rounded pointer-events-auto ${currentTool === 'ruler' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }} title={t('toolRuler')}>
            <IconRuler size={20} />
          </button>

          {/* Zoom to Rectangle tool */}
          <button onClick={() => setCurrentTool(prev => prev === 'zoomRect' ? 'select' : 'zoomRect')} className={`p-2 rounded pointer-events-auto ${currentTool === 'zoomRect' ? 'bg-yellow-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }} title={t('toolZoomRect')}>
            <IconZoomRect size={20} />
          </button>

          {/* Picot Join button */}
          <button 
            onClick={() => {
              if (activeMode === 'picotJoin') {
                setActiveMode(null);
              } else {
                setActiveMode('picotJoin');
                setCurrentTool('select');
                if (localStorage.getItem('tcad_seen_join_tip') !== '1') setShowJoinTip(true);
                setSelectedIds([]);
              }
            }}
            className={`p-2 rounded col-span-2 pointer-events-auto flex items-center justify-center ${activeMode === 'picotJoin' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={t('toolPicotJoin')}
          >
            <IconJoinPicots size={20} />
          </button>
          {/* Beading mode button */}
          <button
            onClick={() => {
              if (activeMode === 'beading') {
                setActiveMode(null);
                setSelectedBEs([]);
              } else {
                setActiveMode('beading');
                setCurrentTool('select');
                setSelectedIds([]);
                setSelectedBEs([]);
              }
            }}
            className={`p-2 rounded col-span-2 pointer-events-auto flex items-center justify-center ${activeMode === 'beading' ? 'bg-purple-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={t('toolBeadingMode')}
          >
            <IconBeadMode size={20} />
          </button>

          {/* Join/Break buttons moved to properties bar in picotJoin mode */}
          <button onClick={addRing} className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed" style={{ touchAction: 'manipulation' }} title={t('toolAddRing')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddRing size={20} />
          </button>
          <button onClick={addSplitRing} className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed" style={{ touchAction: 'manipulation' }} title={t('toolAddSplitRing')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddSplitRing size={20} />
          </button>
          <button onClick={() => setCurrentTool('line')} className={`p-2 rounded pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed ${currentTool === 'line' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }} title={t('toolLineTool')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddLine size={20} />
          </button>
          <button onClick={addChain} className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed" style={{ touchAction: 'manipulation' }} title={t('toolAddChain')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddChain size={20} />
          </button>
          <button onClick={deleteSelected} className="p-2 bg-gray-700 active:bg-gray-600 rounded col-span-2 pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed" style={{ touchAction: 'manipulation' }} title={t('toolDelete')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}><IconDelete size={20} /></button>
          <button 
            onClick={groupSelected} 
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ touchAction: 'manipulation' }}
            title={t('toolGroup')}
            disabled={selectedIds.length < 2 || activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}
          >
            <IconGroup size={20} />
          </button>
          <button 
            onClick={ungroupSelected} 
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ touchAction: 'manipulation' }}
            title={t('toolUngroup')}
            disabled={selectedIds.length === 0 || activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}
          >
            <IconUngroup size={20} />
          </button>
          <button 
            onClick={() => zoomToCenter(-0.1)} 
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
            style={{ touchAction: 'manipulation' }}
            title={t('toolZoomOut')}
          >
            <IconZoomOut size={20} />
          </button>
          <button 
            onClick={() => zoomToCenter(0.1)} 
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
            style={{ touchAction: 'manipulation' }}
            title={t('toolZoomIn')}
          >
            <IconZoomIn size={20} />
          </button>
          <button
            onClick={fitAllElements}
            className="p-2 bg-gray-700 active:bg-gray-600 rounded col-span-2 pointer-events-auto"
            style={{ touchAction: 'manipulation' }}
            title="Fit All (F)"
          >
            <IconFitView size={20} />
          </button>
          <button 
            onClick={() => setCurrentTool(currentTool === 'image' ? 'pan' : 'image')} 
            className={`p-2 rounded col-span-2 pointer-events-auto ${currentTool === 'image' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={t('toolRefImage')}
          >
            <IconImage size={20} />
          </button>

          {/* Notes toggle — bottom of left toolbar */}
          <button
            onClick={() => setNotesOpen(v => !v)}
            className={`p-2 rounded col-span-2 pointer-events-auto flex items-center justify-center gap-1 text-xs font-semibold ${notesOpen ? 'bg-amber-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={notesOpen ? 'Close pattern notes' : 'Open pattern notes'}
          >
            <IconNotes size={16} />
            <span>{t('toolNotes')}</span>
          </button>
          </>}
        </div>
        
        {/* Remove confirmation dialog */}
        {showRemoveConfirm && (
          <>
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowRemoveConfirm(false)}
            ></div>
            
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white rounded z-50 shadow-xl p-4" style={{ width: '280px' }}>
              <h3 className="font-semibold mb-3">{t('removeImageTitle')}</h3>
              <p className="text-sm text-gray-400 mb-4">{t('removeImageBody')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  {t('removeImageCancel')}
                </button>
                <button
                  onClick={() => {
                    setReferenceImage(null);
                    setShowRemoveConfirm(false);
                  }}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded"
                >
                  {t('removeImageConfirm')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* REMOVED: Floating reference toolbar - now inline in left toolbar */}

        {/* Hidden file input for reference image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Hidden file input for loading themes */}
        <input
          ref={themeInputRef}
          type="file"
          accept=".json"
          onChange={loadTheme}
          className="hidden"
        />


                {/* Info Bar - Bottom (Full Width) */}
        <div 
          className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-4 py-2 z-10 pointer-events-none"
          style={{ 
            fontSize: '12px',
            fontFamily: 'monospace',
            paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))'
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-gray-300">
            {/* Left side - Selection info */}
            <div className="flex flex-wrap items-center gap-2">
              {currentTool === 'ruler' ? (
                <span className="text-yellow-300">
                  <IconRuler size={12} className="inline mr-1" />
                  {rulerPoints.length === 0
                    ? t('rulerClickFirst')
                    : rulerPoints.length === 1
                      ? t('rulerClickSecond')
                      : (() => {
                          const p1 = rulerPoints[0], p2 = rulerPoints[1];
                          const activePreset = threadPresets.find(pr => pr.id === activePresetId) || threadPresets[0] || DEFAULT_THREAD_PRESET;
                          const mmPerWorldPx = (activePreset.ds20Core / 20) / dsWidth;
                          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                          const mm = dist * mmPerWorldPx;
                          return `${Math.round(dist)}px  ·  ${mm.toFixed(1)} mm  ·  ${(mm/10).toFixed(2)} cm  ·  ${(mm/25.4).toFixed(3)}"  — click to reset`;
                        })()
                  }
                </span>
              ) : (
              <span>
                {selectedIds.length === 0 
                  ? t('infoNoSelection') 
                  : selectedIds.length === 1 
                    ? t('info1Selected') 
                    : t('infoNSelected').replace('{n}', String(selectedIds.length))}
              </span>
              )}
              
              {selectedIds.length === 1 && (() => {
                const selected = elementById.get(selectedIds[0]);
                if (!selected) return null;
                
                // Get color info
                let colorInfo = '';
                if (selected.isGradient) {
                  const gradient = dmcColors.find(c => c.id === selected.color && c.type === 'gradient');
                  if (gradient) {
                    colorInfo = `${t('infoColorPrefix')}: ${gradient.name} (${gradient.id})`;
                  } else {
                    colorInfo = `${t('infoColorPrefix')}: ${t('colorGradientsTab')} ${selected.color}`;
                  }
                } else {
                  // Solid color - try to find DMC name
                  const dmcSolid = dmcColors.find(c => c.hex === selected.color && c.type !== 'gradient');
                  if (dmcSolid) {
                    colorInfo = `${t('infoColorPrefix')}: ${dmcSolid.name} (${dmcSolid.id}) - ${selected.color}`;
                  } else {
                    colorInfo = `${t('infoColorPrefix')}: ${selected.color}`;
                  }
                }
                
                return (
                  <>
                    <span className="text-gray-500">|</span>
                    <span>{selected.type === 'ring' ? t('infoRing') : t('infoChain')}</span>
                    <span className="text-gray-500">|</span>
                    <span>{selected.stitchCount} DS</span>
                    <span className="text-gray-500">|</span>
                    <span>{colorInfo}</span>
                  </>
                );
              })()}
            </div>
            
            {/* Right side - General info */}
            <div className="flex flex-wrap items-center gap-2">
              <span>{t('infoElements')}: {elements.length}</span>
              <span className="text-gray-500">|</span>
              <span>{t('infoZoom')}: {(zoom * 100).toFixed(0)}%</span>
              <span className="text-gray-500">|</span>
              <span>{renderMode === 'realistic' ? t('renderRealistic') : t('renderSchematic')}</span>
            </div>
          </div>
        </div>

        <div
          ref={canvasRef}
          className="w-full h-full"
          style={
            spaceDown
              ? { cursor: isDragging ? 'grabbing' : 'grab' }
              : (zDown || currentTool === 'zoomRect')
                ? { cursor: zoomRectBox ? 'crosshair' : 'crosshair' }
                : currentTool === 'ruler'
                ? { cursor: 'crosshair' }
                : currentTool === 'pan'
                  ? { cursor: isDragging ? 'grabbing' : 'grab' }
                  : undefined
          }
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={(e) => {
            // Path tool: double click on empty canvas exits to select tool
            if (currentTool === 'path') {
              const world = screenToWorld(e.clientX, e.clientY);
              const clicked = findClosestElement(world.x, world.y);
              if (!clicked) setCurrentTool('select');
            }
          }}
          onContextMenu={(e) => e.preventDefault()} // Prevent context menu on middle-click
          onTouchStart={(e) => {
            const touches = e.touches;
            if (touches.length === 2) {
              e.preventDefault();
              // If a drag is in progress, lock it — ignore the second finger entirely.
              // This prevents the element teleporting to the second touch position.
              if (dragOffsetRef.current.active) return;
              // Otherwise abort any other interaction and start pinch.
              handleMouseUp(null);
              const dist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
              );
              const centerX = (touches[0].clientX + touches[1].clientX) / 2;
              const centerY = (touches[0].clientY + touches[1].clientY) / 2;
              setTouchState({ dist, zoom, centerX, centerY });
            } else if (touches.length === 1) {
              // Single touch - normal pan/select behavior
              const touch = touches[0];
              dragTouchIdRef.current = touch.identifier; // remember which finger started this
              handleMouseDown({ button: 0, clientX: touch.clientX, clientY: touch.clientY });
            }
          }}
          onTouchMove={(e) => {
            const touches = e.touches;
            // While dragging: track ONLY the finger that started the drag (by identifier).
            // This prevents teleporting when a second finger joins or the dragging finger lifts.
            if (dragOffsetRef.current.active) {
              const tracked = dragTouchIdRef.current !== null
                ? Array.from(touches).find(t => t.identifier === dragTouchIdRef.current)
                : null;
              if (tracked) {
                handleMouseMove({ clientX: tracked.clientX, clientY: tracked.clientY });
              }
              // If tracked finger is gone (lifted), do nothing — touchEnd will commit.
              return;
            }
            if (touches.length === 2) {
              // Two-finger pinch zoom
              e.preventDefault();
              if (!touchState.dist) return; // guard against zero dist
              const dist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
              );
              const scale = dist / touchState.dist;
              const newZoom = touchState.zoom * scale;
              
              // Clamp zoom between 0.3x and 3x (reasonable limits to prevent losing work)
              const clampedZoom = Math.max(0.3, Math.min(3, newZoom));
              
              // Zoom towards the pinch center point
              const centerX = (touches[0].clientX + touches[1].clientX) / 2;
              const centerY = (touches[0].clientY + touches[1].clientY) / 2;
              
              if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                
                // Convert screen coords to canvas coords
                const canvasX = centerX - rect.left;
                const canvasY = centerY - rect.top;
                
                // Get world point at pinch center BEFORE zoom
                const worldX = (canvasX - camera.x) / zoom;
                const worldY = (canvasY - camera.y) / zoom;
                
                // Calculate new camera position to keep world point at same screen position
                const newCameraX = canvasX - worldX * clampedZoom;
                const newCameraY = canvasY - worldY * clampedZoom;
                
                setZoom(clampedZoom);
                setCamera({ x: newCameraX, y: newCameraY });
              }
            } else if (touches.length === 1) {
              // Single touch — only forward to mouse handler if we are NOT coming
              // down from a pinch. touchState.dist > 0 means a pinch was active.
              if (touchState.dist > 0) return;
              const touch = touches[0];
              handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
          }}
          onTouchEnd={(e) => {
            if (dragOffsetRef.current.active) {
              // Drag in progress: commit only when the tracked drag finger lifts.
              const trackedStillDown = dragTouchIdRef.current !== null
                && Array.from(e.touches).some(t => t.identifier === dragTouchIdRef.current);
              if (!trackedStillDown) {
                // Dragging finger lifted — commit and clear
                dragTouchIdRef.current = null;
                handleMouseUp(null);
              }
              // If other (non-drag) fingers lifted, ignore — drag continues.
              return;
            }
            if (e.touches.length < 2) {
              // Pinch ended — clear pinch state
              if (touchState.dist > 0) {
                handleMouseUp(null);
              }
              setTouchState({ dist: 0, zoom: zoom, centerX: 0, centerY: 0 });
            }
            if (e.touches.length === 0) {
              handleMouseUp(null);
            }
          }}
        >
          <svg width="100%" height="100%" style={{ backgroundColor: bgColor, userSelect: 'none' }}>
            <defs>
              {/* Grid pattern */}
              <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke={bgColor === '#FFFFFF' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} strokeWidth="1" />
              </pattern>
              
              {/* Pink glow filter for highlighting unnumbered elements */}
              <filter id="pink-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#FF1493" floodOpacity="1"/>
              </filter>

              {/* Red glow filter for invalid/broken notation */}
              <filter id="red-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ef4444" floodOpacity="1"/>
              </filter>
              
              {/* NEW: Realistic rendering stitch patterns */}
              <g id="ds-stitch">
                <path
                  d={DS_STITCH_PATH}
                  fill="currentColor"
                  stroke="black"
                  strokeWidth="0.05"
                  strokeLinecap="square"
                  strokeMiterlimit="4.7"
                />
              </g>
              
              {/* Single Stitch (SS) - half width */}
              <g id="ss-stitch">
                <path
                  d={SS_STITCH_PATH}
                  fill="currentColor"
                  stroke="black"
                  strokeWidth="0.05"
                  strokeLinecap="square"
                  strokeMiterlimit="4.7"
                />
              </g>
              
              {/* Reinforced Double Stitch (RDS) - double width */}
              <g id="rds-stitch">
                <path
                  d={RDS_STITCH_PATH}
                  fill="currentColor"
                  stroke="black"
                  strokeWidth="0.05"
                  strokeLinecap="square"
                  strokeMiterlimit="4.7"
                />
              </g>
              
              {/* Picot arches - just the loops */}
              <g id="picot-p">
                <path
                  d="m -0.13569,-0.003 c -0.13569,-0.0033 -0.248864,0.07618 -0.314453,0.171875 -0.06639,0.09687 -0.101883,0.211718 -0.126954,0.322266 -0.05014,0.221095 -0.05078,0.435547 -0.05078,0.435547 v 0.125 l 0.25,0.002 v -0.125 c 0,0 0.0027,-0.196536 0.04492,-0.382813 0.02112,-0.09314 0.05339,-0.181178 0.08984,-0.234375 0.03646,-0.0532 0.0576,-0.06815 0.101562,-0.06641 h 0.0059 0.0039 c 0.04396,-0.0017 0.06706,0.01321 0.103516,0.06641 0.03646,0.0532 0.06872,0.141237 0.08984,0.234375 0.04224,0.186277 0.04492,0.382813 0.04492,0.382813 v 0.125 l 0.25,-0.002 v -0.125 c 0,0 -6.4e-4,-0.214453 -0.05078,-0.435547 -0.02507,-0.110547 -0.06056,-0.225401 -0.126953,-0.322266 -0.06528,-0.09525 -0.179621,-0.174369 -0.314453,-0.171875 z"
                  fill="white"
                  fillOpacity="1"
                  stroke="black"
                  strokeWidth="0.05"
                />
              </g>
              
              <g id="picot-sp">
                <path
                  d="m -0.13573,0 c -0.13573,0 -0.248864,0.07618 -0.314453,0.171875 -0.06639,0.09687 -0.101883,0.211718 -0.126954,0.322266 -0.04775,0.151308 -0.04251,0.271159 -0.04251,0.271159 l 0.25,0.002 c 0,0 0.0121,-0.08271 0.03665,-0.218425 0.02112,-0.09314 0.05339,-0.181178 0.08984,-0.234375 0.03646,-0.0532 0.0576,-0.06815 0.106461,-0.06813 0.04886,2e-5 0.07196,0.01493 0.108417,0.06813 0.03646,0.0532 0.0713,0.14069 0.08984,0.234375 0.02083,0.105233 0.05319,0.218425 0.05319,0.218425 l 0.25,-0.002 c 0,0 -0.03078,-0.118243 -0.05905,-0.271159 -0.02507,-0.110547 -0.06056,-0.225401 -0.126953,-0.322266 -0.06528,-0.09525 -0.179598,-0.171875 -0.314453,-0.171875 z"
                  fill="white"
                  fillOpacity="1"
                  stroke="black"
                  strokeWidth="0.05"
                />
              </g>
              
              <g id="picot-lp">
                <path
                  d="m -0.13573,0 c -0.13573,0 -0.248864,0.07618 -0.314453,0.171875 -0.06639,0.09687 -0.101883,0.211718 -0.126954,0.322266 -0.05014,0.221095 -0.06247,1.105031 -0.06247,1.105031 v 0.125 l 0.25,0.002 v -0.125 c 0,0 0.01439,-0.86602 0.05661,-1.052297 0.02112,-0.09314 0.05339,-0.181178 0.08984,-0.234375 0.03646,-0.0532 0.0576,-0.06815 0.101562,-0.06641 h 0.0059 0.0039 c 0.04396,-0.0017 0.06706,0.01321 0.103516,0.06641 0.03646,0.0532 0.06872,0.141237 0.08984,0.234375 0.04224,0.186277 0.03323,1.052297 0.03323,1.052297 v 0.125 l 0.25,-0.002 v -0.125 c 0,0 0.01105,-0.883937 -0.03909,-1.105031 -0.02507,-0.110547 -0.06056,-0.225401 -0.126953,-0.322266 -0.06528,-0.09525 -0.179598,-0.171875 -0.314453,-0.171875 z"
                  fill="white"
                  fillOpacity="1"
                  stroke="black"
                  strokeWidth="0.05"
                />
              </g>
              
              {/* DMC Gradient definitions */}
              {dmcColors
                .filter(c => c.type === 'gradient')
                .map(color => {
                  // Parse stops if they're in string format "offset:color,offset:color,..."
                  let stops = color.stops;
                  if (typeof color.stops === 'string') {
                    stops = color.stops.split(',').map(stop => {
                      const [offset, colorHex] = stop.split(':');
                      return { offset: `${offset}%`, color: colorHex };
                    });
                  }
                  
                  if (color.gradientType === 'linear' || !color.gradientType) {
                    return (
                      <linearGradient key={color.id} id={`gradient-${color.id}`} x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="objectBoundingBox">
                        {stops.map((stop, i) => (
                          <stop key={i} offset={stop.offset} stopColor={stop.color} />
                        ))}
                      </linearGradient>
                    );
                  } else if (color.gradientType === 'pattern') {
                    return (
                      <pattern 
                        key={color.id} 
                        id={`gradient-${color.id}`} 
                        patternUnits="userSpaceOnUse" 
                        width={color.patternWidth || 20} 
                        height="20"
                      >
                        {color.stripes.map((stripe, i) => (
                          <rect 
                            key={i} 
                            x={stripe.x} 
                            y="0" 
                            width={stripe.width} 
                            height="20" 
                            fill={stripe.color} 
                          />
                        ))}
                      </pattern>
                    );
                  }
                  return null;
                })}
            </defs>

            <g transform={`translate(${camera.x}, ${camera.y}) scale(${zoom})`}>
              {gridEnabled && renderMode !== 'realistic' && <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid)" />}

              {/* ── Baked realistic view ─────────────────────────────────── */}
              {renderMode === 'realistic' && bakedRealisticSVG && (
                <g dangerouslySetInnerHTML={{ __html: bakedRealisticSVG
                  .replace(/^<svg[^>]*>/, '')
                  .replace(/<\/svg>$/, '') }} />
              )}
              {renderMode === 'realistic' && !bakedRealisticSVG && (
                <text x="0" y="0" fill="transparent" fontSize={16 / zoom} textAnchor="middle">.</text>
              )}

              {/* ── Polar Grids ─────────────────────────────────────────── */}
              {polarGrids.filter(g => g.visible).map(grid => {
                const color = grid.color || '#4B9FE1';
                const opacity = grid.opacity ?? 0.5; // 0–1 user-controlled opacity
                const gridOffsetRad = (grid.angularOffset || 0) * Math.PI / 180;
                // Collect all unique spoke angles across all visible rings (per-ring offset aware)
                const spokeAngles = new Set();
                grid.rings.filter(r => r.visible).forEach(ring => {
                  const ringOffsetRad = gridOffsetRad + ((ring.angularOffset || 0) * Math.PI / 180);
                  for (let i = 0; i < ring.divisions; i++) {
                    // Round to 6 decimal places to avoid float key collisions
                    const a = ringOffsetRad + (i / ring.divisions) * 2 * Math.PI;
                    spokeAngles.add(Math.round(a * 1e6) / 1e6);
                  }
                });
                const maxR = grid.rings.filter(r => r.visible).reduce((m, r) => Math.max(m, r.radius), 0);
                return (
                  <g key={grid.id} data-ui="1">
                    {/* Spoke lines — from center to outermost ring */}
                    {maxR > 0 && [...spokeAngles].map((angle, i) => (
                      <line key={i}
                        x1={grid.center.x} y1={grid.center.y}
                        x2={grid.center.x + maxR * Math.cos(angle)}
                        y2={grid.center.y + maxR * Math.sin(angle)}
                        stroke={color} strokeWidth={0.5 / zoom} opacity={opacity * 0.6}
                      />
                    ))}
                    {/* Ring circles */}
                    {grid.rings.filter(r => r.visible).map(ring => (
                      <circle key={ring.id}
                        cx={grid.center.x} cy={grid.center.y} r={ring.radius}
                        fill="none" stroke={color} strokeWidth={1 / zoom} opacity={opacity * 0.9}
                      />
                    ))}
                    {/* Snap point dots on ring intersections */}
                    {snapEnabled && grid.rings.filter(r => r.visible && r.snap).map(ring => {
                      const ringOffsetRad = gridOffsetRad + ((ring.angularOffset || 0) * Math.PI / 180);
                      return Array.from({ length: ring.divisions }, (_, i) => {
                        const angle = ringOffsetRad + (i / ring.divisions) * 2 * Math.PI;
                        const px = grid.center.x + ring.radius * Math.cos(angle);
                        const py = grid.center.y + ring.radius * Math.sin(angle);
                        return (
                          <circle key={`${ring.id}-${i}`}
                            cx={px} cy={py} r={4 / zoom}
                            fill={color} opacity={opacity}
                          />
                        );
                      });
                    })}
                    {/* Center handle */}
                    <circle cx={grid.center.x} cy={grid.center.y} r={5 / zoom}
                      fill={color} stroke="white" strokeWidth={1.5 / zoom} opacity={Math.min(1, opacity * 1.6)}
                    />
                  </g>
                );
              })}

              {/* Reference Image */}
              {referenceImage && refImageProps.visible && renderMode !== 'realistic' && (
                <image
                  href={referenceImage}
                  x={refImageProps.x - 500}
                  y={refImageProps.y - 500}
                  width="1000"
                  height="1000"
                  opacity={refImageProps.opacity}
                  transform={`rotate(${refImageProps.rotation} ${refImageProps.x} ${refImageProps.y}) scale(${refImageProps.scale})`}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}

              {/* NEW: Render joint picot connection lines */}
              {showEditingArtifacts && picotConnections.map(conn => {
                if (conn.picots.length < 2) return null;
                
                // Get positions of all connected picots
                const positions = conn.picots.map(p => {
                  const el = elementById.get(p.elementId);
                  if (!el) return null;
                  const picot = el.picots?.find(pic => pic.id === p.picotId);
                  if (!picot || !picot.isJoint) return null;
                  return getPicotPosition(el, picot, true); // baseOnly: connection starts at path, not arm tip
                }).filter(Boolean);
                
                if (positions.length < 2) return null;
                
                // All lines meet at the centroid of the connected picots
                const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
                const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
                
                if (renderMode === 'realistic') {
                  // Realistic mode: use the material stored on the connection (set by first-selected picot)
                  const connectedEls = conn.picots.map(p => elementById.get(p.elementId)).filter(Boolean);
                  const firstEl = connectedEls[0];
                  // Use stored materialId if present, otherwise fall back to old heuristic
                  let lineColor;
                  if (conn.materialId) {
                    const mat = materialsById.get(conn.materialId);
                    lineColor = mat ? getSolidColor({ materialId: conn.materialId }) : getSolidColor(firstEl);
                  } else {
                    const pickedEl = connectedEls.find(e => {
                      const c = getSolidColor(e);
                      return c && c.toLowerCase() !== '#ffffff' && c.toLowerCase() !== '#fff';
                    }) || firstEl;
                    lineColor = (pickedEl ? getSolidColor(pickedEl) : null) || '#FF8C00';
                  }
                  const lineWidth = firstEl?.lineWidth || 2;
                  const beadSeqForConnR = (() => {
                    for (const p of conn.picots) {
                      const el = elementById.get(p.elementId);
                      const picot = el?.picots?.find(pic => pic.id === p.picotId);
                      if ((picot?.beadType === 'bjp' || picot?.beadType === 'bcjp') && picot?.beadSeq) return picot.beadSeq;
                    }
                    return null;
                  })();
                  return (
                    <g key={conn.id}>
                      {positions.map((pos, i) => (
                        <g key={`${conn.id}-${i}`}>
                          <line x1={pos.x} y1={pos.y} x2={cx} y2={cy}
                            stroke="black" strokeWidth={lineWidth + 2} strokeLinecap="round" />
                          <line x1={pos.x} y1={pos.y} x2={cx} y2={cy}
                            stroke={lineColor} strokeWidth={lineWidth} strokeLinecap="round" />
                        </g>
                      ))}
                      {/* Center dot only for 3+ picots — 2-picot joins are just a straight line */}
                      {beadSeqForConnR
                        ? renderClusteredBeads(`conn-r-${conn.id}`, cx, cy, beadSeqForConnR)
                        : conn.picots.length > 2 && <circle cx={cx} cy={cy} r={lineWidth + 1} fill={lineColor} stroke="black" strokeWidth="1" />
                      }
                    </g>
                  );
                } else {
                  // Schematic mode: each picot → center, dotted orange
                  const beadSeqForConn = (() => {
                    for (const p of conn.picots) {
                      const el = elementById.get(p.elementId);
                      const picot = el?.picots?.find(pic => pic.id === p.picotId);
                      if ((picot?.beadType === 'bjp' || picot?.beadType === 'bcjp') && picot?.beadSeq) return picot.beadSeq;
                    }
                    return null;
                  })();
                  return (
                    <g key={conn.id}>
                      {positions.map((pos, i) => (
                        <line
                          key={`${conn.id}-${i}`}
                          x1={pos.x} y1={pos.y} x2={cx} y2={cy}
                          stroke={theme.connectionLine} strokeWidth="3"
                          strokeDasharray="5,5" opacity="0.7"
                        />
                      ))}
                      {/* Center dot only for 3+ picots — 2-picot joins are just a straight line */}
                      {beadSeqForConn
                        ? renderClusteredBeads(`conn-${conn.id}`, cx, cy, beadSeqForConn)
                        : conn.picots.length > 2 && <circle cx={cx} cy={cy} r={4/zoom} fill={theme.connectionDot} opacity="0.9" />
                      }
                    </g>
                  );
                }
              })}

              {/* picotJoin/beading dim overlay wraps all path elements */}
              <g opacity={(activeMode === 'picotJoin' || activeMode === 'beading') ? 0.25 : renderMode === 'realistic' ? 0 : 1} style={{ pointerEvents: renderMode === 'realistic' ? 'none' : undefined }}>
              {[...elements].sort((a, b) => {
                // Rings always render on top of chains/lines.
                // Sort: lines = 0, chains = 1, rings = 2.
                // Only the draw order changes — elements state is untouched,
                // so snap points, joint picots, and hit-testing are unaffected.
                const tier = el => el.type === 'ring' ? 2 : el.type === 'chain' ? 1 : 0;
                return tier(a) - tier(b);
              }).map(el => {
                // PERFORMANCE: Skip elements entirely outside the visible viewport
                if (!isInViewport(el)) return null;

                const isSelected = selectedIds.includes(el.id);
                const isUnnumbered = !el.orderNumber || el.orderNumber.toString().trim() === '';
                const shouldHighlight = (showUnnumbered || activeMode === 'tattingOrder') && isUnnumbered;
                const activeDraft = draftNotation?.elementId === el.id ? draftNotation.value : null;
                const hasInvalidNotation = el.type !== 'line' && renderMode === 'schematic' && (() => {
                  const notationToCheck = activeDraft ?? el.notation;
                  return notationToCheck && !isNotationValid(notationToCheck.trim());
                })();
                const elementFilter = (showInvalidNotation && hasInvalidNotation) ? 'url(#red-glow)' : shouldHighlight ? 'url(#pink-glow)' : undefined;
                // In tattingOrder mode, hide notation labels so only order numbers are visible
                const hideNotationInMode = activeMode === 'tattingOrder';
                // PERFORMANCE: During translate-drag, apply offset via SVG transform instead of
                // mutating element state. Keeps stitchCache valid throughout the drag.
                const dragTransform = (isSelected && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})`
                  : undefined;
                // PERFORMANCE: getElementColor once per element, reused for stroke + picots
                const elColor = getElementColor(el);
                const elStrokeVal = elColor.isGradient ? `url(#gradient-${elColor.id})` : elColor.color;
                // Split ring section B color (only relevant for split rings)
                const elColorB = el.isSplitRing ? getElementColor({...el, materialId: el.materialIdB || el.materialId}) : elColor;
                const elStrokeValB = elColorB.isGradient ? `url(#gradient-${elColorB.id})` : elColorB.color;
                
                // Render circles as SVG circle element for smooth rendering
                if (el.isClosed && el.shapeStyle === 'circle') {
                  const targetCircumference = el.stitchCount * dsWidth;
                  const radius = targetCircumference / (2 * Math.PI);
                  
                  // Original schematic rendering for circles
                  return (
                    <g key={el.id} filter={elementFilter} transform={dragTransform}>
                      <circle
                        cx={el.center.x}
                        cy={el.center.y}
                        r={radius}
                        fill="none"
                        stroke={elStrokeVal}
                        strokeWidth="3.75"
                        opacity={el.isGhost ? 0.4 : isSelected ? 0.7 : 1}
                        strokeDasharray={el.isGhost ? '5,5' : undefined}
                      />
                      {renderPicots(el)}
                      {isSelected && (
                        <circle
                          cx={el.center.x}
                          cy={el.center.y}
                          r={radius + 5}
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                      )}
                      {el.groupId && (
                        <text
                          data-layer="groups"
                          x={el.center.x}
                          y={el.center.y + radius + 20}
                          fill="#10B981"
                          fontSize={notationFS}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          G
                        </text>
                      )}
                      <g key={`${el.id}-labels`} data-layer="notation">{(el.hideLabel || hideNotationInMode) ? null : renderStitchLabels(el)}</g>
                      {(showUnnumbered || activeMode === 'tattingOrder') && el.orderNumber && (() => {
                        const [_fill, _stroke] = getGroupBadgeColor(el);
                        return (
                          <text
                            data-layer="order"
                            x={el.center.x}
                            y={el.center.y}
                            fill={_fill}
                            fontSize={Math.round(notationFS * 1.57)}
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            stroke={_stroke}
                            strokeWidth="3"
                            paintOrder="stroke"
                          >
                            {el.orderNumber}
                          </text>
                        );
                      })()}
                    </g>
                  );
                }
                
                // Render everything else (teardrops, chains, and lines) using paths
                return (
                  <g key={el.id} filter={elementFilter} transform={dragTransform}>
                    {/* Line rendering - simple bezier with black outline */}
                    {el.type === 'line' ? (
                      <>
                        {el.paths.map((path, i) => {
                          let pathD;
                          if (path.type === 'cubic') {
                            pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                          } else {
                            pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                          }
                          return (
                            <g key={i}>
                              {/* Black outline */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke="#000000"
                                strokeWidth={(el.lineWidth || 2) + 2}
                                opacity={el.isGhost ? 0.4 : isSelected ? 0.7 : 1}
                                strokeDasharray={el.isGhost ? '5,5' : undefined}
                              />
                              {/* Colored line on top */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke={elStrokeVal}
                                strokeWidth={el.lineWidth || 2}
                                opacity={el.isGhost ? 0.4 : isSelected ? 0.7 : 1}
                                strokeDasharray={el.isGhost ? '5,5' : undefined}
                              />
                            </g>
                          );
                        })}
                        {/* Selection indicator */}
                        {isSelected && el.paths.map((path, i) => {
                          let pathD;
                          if (path.type === 'cubic') {
                            pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                          } else {
                            pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                          }
                          return (
                            <path
                              key={`select-${i}`}
                              d={pathD}
                              fill="none"
                              stroke="#3B82F6"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                          );
                        })}
                        {/* Beaded line — render beads evenly along path */}
                        {(el.lineBeadSlots?.length > 0 || el.lineBeadId || el.lineBeads) && (() => {
                          // Per-slot mode (new): lineBeadSlots[] — each slot has its own bead library ID
                          // Single-bead legacy mode: lineBeadId + lineBeadCount
                          // Text legacy mode: lineBeads string
                          const resolveSlot = (bi) => {
                            if (el.lineBeadSlots?.length > 0) {
                              const slotId = el.lineBeadSlots[bi];
                              return slotId ? beadLibrary.find(b => b.id === slotId) : null;
                            }
                            // fallback: same bead for all slots
                            return el.lineBeadId ? beadLibrary.find(b => b.id === el.lineBeadId) : null;
                          };
                          const legacyBeads = (!el.lineBeadSlots && !el.lineBeadId && el.lineBeads)
                            ? parseBeadSeq(el.lineBeads.toUpperCase()) : [];
                          const totalBeads = el.lineBeadSlots?.length > 0
                            ? el.lineBeadSlots.length
                            : el.lineBeadId ? (el.lineBeadCount ?? 1) : legacyBeads.length;
                          if (totalBeads === 0) return null;
                          const allSamples = el.paths.map(p => sampleBezierPath(p, 40));
                          const allLens = allSamples.map(s => calculatePathLength(s));
                          const totalLen = allLens.reduce((a, b) => a + b, 0);
                          return Array.from({length: totalBeads}, (_, bi) => {
                            const dist = ((bi + 0.5) / totalBeads) * totalLen;
                            const { x: bx, y: by, angle } = getPointAndAngleAtDistanceFast(allSamples, allLens, dist);
                            const libBead = resolveSlot(bi);
                            if (libBead) {
                              const rad = beadRadius(BEAD_SIZES_DEFAULT[libBead.size] ?? BEAD_SIZES_DEFAULT.Y);
                              return renderBeadShape(bx, by, rad, libBead.shape || 'circle', libBead.color, angle, `lb-${el.id}-${bi}`);
                            }
                            if (legacyBeads[bi]) {
                              return renderCoreBead(`lb-${el.id}-${bi}`, bx, by, legacyBeads[bi], el.color, angle);
                            }
                            return null;
                          });
                        })()}
                        {/* Order number label for lines */}
                        {(showUnnumbered || activeMode === 'tattingOrder') && el.orderNumber && el.paths?.length > 0 && (() => {
                          const allPts: {x:number,y:number}[] = [];
                          el.paths.forEach(p => {
                            for (let i = 0; i <= 20; i++) {
                              const t = i / 20, u = 1 - t;
                              if (p.type === 'cubic') {
                                allPts.push({ x: u*u*u*p.x+3*u*u*t*p.control1X+3*u*t*t*p.control2X+t*t*t*p.endX, y: u*u*u*p.y+3*u*u*t*p.control1Y+3*u*t*t*p.control2Y+t*t*t*p.endY });
                              } else {
                                allPts.push({ x: u*u*p.x+2*u*t*p.controlX+t*t*p.endX, y: u*u*p.y+2*u*t*p.controlY+t*t*p.endY });
                              }
                            }
                          });
                          let total = 0;
                          for (let i = 1; i < allPts.length; i++) total += Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
                          let acc = 0, half = total / 2, ox = el.center.x, oy = el.center.y;
                          for (let i = 1; i < allPts.length; i++) {
                            const seg = Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
                            if (acc + seg >= half) { const f=(half-acc)/seg; ox=allPts[i-1].x+(allPts[i].x-allPts[i-1].x)*f; oy=allPts[i-1].y+(allPts[i].y-allPts[i-1].y)*f; break; }
                            acc += seg;
                          }
                          const [_f3, _s3] = getGroupBadgeColor(el);
                          return <text data-layer="order" x={ox} y={oy} fill={_f3} fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke={_s3} strokeWidth="3" paintOrder="stroke">{el.orderNumber}</text>;
                        })()}
                      </>
                    ) : (
                    /* Chains and teardrops */
                    <>
                    {/* NEW: Realistic rendering mode */}
                    {el.type === 'line' ? (
                      // Line rendering - simple bezier path without stitches
                      <>
                        {el.paths.map((path, i) => {
                          let pathD;
                          if (path.type === 'cubic') {
                            pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                          } else {
                            pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                          }
                          return (
                            <g key={i}>
                              {/* Black outline */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke="#000000"
                                strokeWidth={(el.lineWidth || 2) + 2}
                                opacity={el.isGhost ? 0.4 : isSelected ? 0.7 : 1}
                                strokeDasharray={el.isGhost ? '5,5' : undefined}
                              />
                              {/* Colored line on top */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke={elStrokeVal}
                                strokeWidth={el.lineWidth || 2}
                                opacity={el.isGhost ? 0.4 : isSelected ? 0.7 : 1}
                                strokeDasharray={el.isGhost ? '5,5' : undefined}
                              />
                            </g>
                          );
                        })}
                        {/* Selection indicator */}
                        {isSelected && el.paths.map((path, i) => {
                          let pathD;
                          if (path.type === 'cubic') {
                            pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                          } else {
                            pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                          }
                          return (
                            <path
                              key={`select-${i}`}
                              d={pathD}
                              fill="none"
                              stroke="#3B82F6"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                          );
                        })}
                        {/* Beaded line — render beads evenly along path */}
                        {(el.lineBeadSlots?.length > 0 || el.lineBeadId || el.lineBeads) && (() => {
                          const resolveSlot = (bi) => {
                            if (el.lineBeadSlots?.length > 0) {
                              const slotId = el.lineBeadSlots[bi];
                              return slotId ? beadLibrary.find(b => b.id === slotId) : null;
                            }
                            return el.lineBeadId ? beadLibrary.find(b => b.id === el.lineBeadId) : null;
                          };
                          const legacyBeads = (!el.lineBeadSlots && !el.lineBeadId && el.lineBeads)
                            ? parseBeadSeq(el.lineBeads.toUpperCase()) : [];
                          const totalBeads = el.lineBeadSlots?.length > 0
                            ? el.lineBeadSlots.length
                            : el.lineBeadId ? (el.lineBeadCount ?? 1) : legacyBeads.length;
                          if (totalBeads === 0) return null;
                          const allSamples = el.paths.map(p => sampleBezierPath(p, 40));
                          const allLens = allSamples.map(s => calculatePathLength(s));
                          const totalLen = allLens.reduce((a, b) => a + b, 0);
                          return Array.from({length: totalBeads}, (_, bi) => {
                            const dist = ((bi + 0.5) / totalBeads) * totalLen;
                            const { x: bx, y: by, angle } = getPointAndAngleAtDistanceFast(allSamples, allLens, dist);
                            const libBead = resolveSlot(bi);
                            if (libBead) {
                              const rad = beadRadius(BEAD_SIZES_DEFAULT[libBead.size] ?? BEAD_SIZES_DEFAULT.Y);
                              return renderBeadShape(bx, by, rad, libBead.shape || 'circle', libBead.color, angle, `lb2-${el.id}-${bi}`);
                            }
                            if (legacyBeads[bi]) {
                              return renderCoreBead(`lb2-${el.id}-${bi}`, bx, by, legacyBeads[bi], el.color, angle);
                            }
                            return null;
                          });
                        })()}
                        {/* cjp picots: render arms in realistic mode */}
                        {renderPicots(el, true)}
                      </>
                    ) : (
                      // Original schematic rendering
                      <>
                        {el.paths.map((path, i) => {
                          // Use path directly (curveType system removed)
                          const renderPath = path;
                          
                          let pathD;
                          if (renderPath.type === 'cubic') {
                            pathD = `M ${renderPath.x},${renderPath.y} C ${renderPath.control1X},${renderPath.control1Y} ${renderPath.control2X},${renderPath.control2Y} ${renderPath.endX},${renderPath.endY}`;
                          } else {
                            pathD = `M ${renderPath.x},${renderPath.y} Q ${renderPath.controlX},${renderPath.controlY} ${renderPath.endX},${renderPath.endY}`;
                          }
                          return (
                            <path
                              key={i}
                              d={pathD}
                              fill="none"
                              stroke={(i === 1 && el.isSplitRing && el.materialIdB) ? elStrokeValB : elStrokeVal}
                              strokeWidth="3.75"
                              opacity={el.isGhost ? 0.4 : isSelected ? 0.7 : 1}
                              strokeDasharray={el.isGhost ? '5,5' : undefined}
                            />
                          );
                        })}
                        {/* Dashed connection line for split rings - along height line */}
                        {el.isSplitRing && el.paths.length >= 2 && (
                          <>
                            <line
                              x1={el.paths[0].endX}
                              y1={el.paths[0].endY}
                              x2={el.paths[0].x}
                              y2={el.paths[0].y}
                              stroke="#000000"
                              strokeWidth={(el.lineWidth || 2) + 2}
                              strokeDasharray="5,5"
                              opacity={el.isGhost ? 0.4 : isSelected ? 0.7 : 1}
                            />
                            <line
                              x1={el.paths[0].endX}
                              y1={el.paths[0].endY}
                              x2={el.paths[0].x}
                              y2={el.paths[0].y}
                              stroke={elStrokeValB}
                              strokeWidth={el.lineWidth || 2}
                              strokeDasharray="5,5"
                              opacity={el.isGhost ? 0.4 : isSelected ? 0.7 : 1}
                            />
                          </>
                        )}
                        {renderPicots(el)}
                        {isSelected && (
                          <g>
                            {el.paths.map((path, i) => {
                              // Use path directly (curveType system removed)
                              const renderPath = path;
                              
                              let pathD;
                              if (renderPath.type === 'cubic') {
                                pathD = `M ${renderPath.x},${renderPath.y} C ${renderPath.control1X},${renderPath.control1Y} ${renderPath.control2X},${renderPath.control2Y} ${renderPath.endX},${renderPath.endY}`;
                              } else {
                                pathD = `M ${renderPath.x},${renderPath.y} Q ${renderPath.controlX},${renderPath.controlY} ${renderPath.endX},${renderPath.endY}`;
                              }
                              return (
                                <path
                                  key={`select-${i}`}
                                  d={pathD}
                                  fill="none"
                                  stroke="#3B82F6"
                                  strokeWidth="2"
                                  strokeDasharray="5,5"
                                />
                              );
                            })}
                          </g>
                        )}
                        <g key={`${el.id}-labels`} data-layer="notation">{(el.hideLabel || hideNotationInMode) ? null : renderStitchLabels(el)}</g>
{(showUnnumbered || activeMode === 'tattingOrder') && el.orderNumber && (() => {
                          let ox = el.center.x, oy = el.center.y;
                          if (el.type === 'chain' && el.paths && el.paths.length > 0) {
                            const allPts: {x:number,y:number}[] = [];
                            el.paths.forEach(p => {
                              for (let i = 0; i <= 40; i++) {
                                const t = i / 40, u = 1 - t;
                                if (p.type === 'cubic') {
                                  allPts.push({ x: u*u*u*p.x+3*u*u*t*p.control1X+3*u*t*t*p.control2X+t*t*t*p.endX, y: u*u*u*p.y+3*u*u*t*p.control1Y+3*u*t*t*p.control2Y+t*t*t*p.endY });
                                } else {
                                  allPts.push({ x: u*u*p.x+2*u*t*p.controlX+t*t*p.endX, y: u*u*p.y+2*u*t*p.controlY+t*t*p.endY });
                                }
                              }
                            });
                            let total = 0;
                            for (let i = 1; i < allPts.length; i++) total += Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
                            let acc = 0, half = total / 2;
                            for (let i = 1; i < allPts.length; i++) {
                              const seg = Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
                              if (acc + seg >= half) { const f=(half-acc)/seg; ox=allPts[i-1].x+(allPts[i].x-allPts[i-1].x)*f; oy=allPts[i-1].y+(allPts[i].y-allPts[i-1].y)*f; break; }
                              acc += seg;
                            }
                          }
                          const [_f5, _s5] = getGroupBadgeColor(el);
                          return <text data-layer="order" x={ox} y={oy} fill={_f5} fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke={_s5} strokeWidth="3" paintOrder="stroke">{el.orderNumber}</text>;
                        })()}
                        {el.groupId && (
                          <text
                            data-layer="groups"
                            x={el.center.x}
                            y={el.center.y + 60}
                            fill="#10B981"
                            fontSize={notationFS}
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            G
                          </text>
                        )}
                      </>
                    )}
                    </>
                    )}
                  </g>
                );
              })}

              </g>

              {/* ── Polar Array ghost preview ─────────────────────────────
                  Shown while the dialog is open. Renders simplified outlines
                  of the copies-to-be at their computed positions.
                  pointer-events:none so they don't interfere with canvas.     */}
              {showPolarArrayDialog && (() => {
                const selEls = elements.filter(e => selectedIds.includes(e.id));
                if (selEls.length === 0 || polarArrayCount < 2) return null;

                // Pivot
                let pivX: number, pivY: number;
                if (polarArrayPivotId && polarArrayPivotId !== 'selection') {
                  const grid = polarGrids.find(g => g.id === polarArrayPivotId);
                  pivX = grid ? grid.center.x : selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
                  pivY = grid ? grid.center.y : selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;
                } else {
                  pivX = selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
                  pivY = selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;
                }

                const stepDeg = polarArrayAngle / polarArrayCount;
                const ghosts = [];

                for (let i = 1; i < polarArrayCount; i++) {
                  const rad = (stepDeg * i) * Math.PI / 180;
                  const cos = Math.cos(rad);
                  const sin = Math.sin(rad);

                  selEls.forEach(el => {
                    const dx = el.center.x - pivX;
                    const dy = el.center.y - pivY;
                    const cx = pivX + dx * cos - dy * sin;
                    const cy = pivY + dx * sin + dy * cos;

                    if (el.isClosed && el.shapeStyle === 'circle') {
                      const r = (el.stitchCount * dsWidth) / (2 * Math.PI);
                      ghosts.push(
                        <circle key={`ghost-${i}-${el.id}`}
                          cx={cx} cy={cy} r={r}
                          fill="none" stroke="#60a5fa" strokeWidth={2 / zoom}
                          strokeDasharray={`${6/zoom} ${4/zoom}`}
                          opacity={0.55} pointerEvents="none"
                        />
                      );
                    } else if (el.paths && el.paths.length > 0) {
                      // Rotate path points and draw a dashed stroke
                      const rotPt = (px, py) => {
                        const rx = px - pivX, ry = py - pivY;
                        return { x: pivX + rx * cos - ry * sin, y: pivY + rx * sin + ry * cos };
                      };
                      const pathStrs = el.paths.map(p => {
                        const s = rotPt(p.x, p.y);
                        const e2 = rotPt(p.endX, p.endY);
                        if (p.type === 'cubic') {
                          const c1 = rotPt(p.control1X, p.control1Y);
                          const c2 = rotPt(p.control2X, p.control2Y);
                          return `M${s.x},${s.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${e2.x},${e2.y}`;
                        } else {
                          const c = rotPt(p.controlX, p.controlY);
                          return `M${s.x},${s.y} Q${c.x},${c.y} ${e2.x},${e2.y}`;
                        }
                      });
                      ghosts.push(
                        <path key={`ghost-${i}-${el.id}`}
                          d={pathStrs.join(' ')}
                          fill="none" stroke="#60a5fa" strokeWidth={2 / zoom}
                          strokeDasharray={`${6/zoom} ${4/zoom}`}
                          opacity={0.55} pointerEvents="none"
                        />
                      );
                    }
                  });
                }

                return <g>{ghosts}</g>;
              })()}

              {/* ── Linear Array ghost preview ───────────────────────────── */}
              {showLinearArrayDialog && (() => {
                const selEls = elements.filter(e => selectedIds.includes(e.id));
                if (selEls.length === 0 || linearArrayCount < 2) return null;
                const rad = linearArrayAngle * Math.PI / 180;
                const dx = Math.cos(rad) * linearArraySpacing;
                const dy = Math.sin(rad) * linearArraySpacing;
                const ghosts = [];
                for (let i = 1; i < linearArrayCount; i++) {
                  const ox = dx * i, oy = dy * i;
                  const extraRot = linearArrayRotStep * i;
                  selEls.forEach(el => {
                    const newCx = el.center.x + ox;
                    const newCy = el.center.y + oy;
                    // Use SVG transform: rotate around original center, then translate to new pos
                    const transform = extraRot !== 0
                      ? `translate(${ox},${oy}) rotate(${extraRot},${el.center.x},${el.center.y})`
                      : `translate(${ox},${oy})`;
                    if (el.isClosed && el.shapeStyle === 'circle') {
                      const r = (el.stitchCount * dsWidth) / (2 * Math.PI);
                      ghosts.push(<circle key={`lgh-${i}-${el.id}`} cx={el.center.x} cy={el.center.y} r={r} transform={transform} fill="none" stroke="#34d399" strokeWidth={2/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} opacity={0.55} pointerEvents="none" />);
                    } else if (el.paths?.length > 0) {
                      const d = el.paths.map(p => {
                        if (p.type === 'cubic') return `M${p.x},${p.y} C${p.control1X},${p.control1Y} ${p.control2X},${p.control2Y} ${p.endX},${p.endY}`;
                        return `M${p.x},${p.y} Q${p.controlX},${p.controlY} ${p.endX},${p.endY}`;
                      }).join(' ');
                      ghosts.push(<path key={`lgh-${i}-${el.id}`} d={d} transform={transform} fill="none" stroke="#34d399" strokeWidth={2/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} opacity={0.55} pointerEvents="none" />);
                    }
                  });
                }
                return <g>{ghosts}</g>;
              })()}

              {/* ── Spiral Array ghost preview ───────────────────────────── */}
              {showSpiralArrayDialog && (() => {
                const selEls = elements.filter(e => selectedIds.includes(e.id));
                if (selEls.length === 0 || spiralArrayCount < 2) return null;
                let pivX = 0, pivY = 0;
                const linkedGid = (() => { const gid = selEls[0]?.polarRotationGridId; return gid && selEls.every(e => e.polarRotationGridId === gid) ? gid : null; })();
                const pivGrid = linkedGid ? polarGrids.find(g => g.id === linkedGid) : selectedPolarGridId ? polarGrids.find(g => g.id === selectedPolarGridId) : null;
                if (pivGrid) { pivX = pivGrid.center.x; pivY = pivGrid.center.y; }
                const centroidX = selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
                const centroidY = selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;
                const r0 = Math.sqrt((centroidX - pivX) ** 2 + (centroidY - pivY) ** 2);
                const angle0 = Math.atan2(centroidY - pivY, centroidX - pivX) * 180 / Math.PI;
                const angularStep = spiralArrayAngleStep; // fixed degrees per copy — independent of count
                const spiralPos = (i) => {
                  const angleDeg = angle0 + angularStep * i;
                  const r = spiralArrayType === 'archimedean'
                    ? r0 + spiralArrayGap * i
                    : r0 * Math.pow(spiralArrayGrowth, i);
                  return { x: pivX + Math.cos(angleDeg * Math.PI / 180) * r, y: pivY + Math.sin(angleDeg * Math.PI / 180) * r, angleDeg };
                };
                const ghosts = [];
                for (let i = 1; i < spiralArrayCount; i++) {
                  const pos = spiralPos(i);
                  const offsetX = pos.x - centroidX;
                  const offsetY = pos.y - centroidY;
                  selEls.forEach(el => {
                    const newCx = el.center.x + offsetX;
                    const newCy = el.center.y + offsetY;
                    // Rotation delta from current element rotation to target angle
                    const targetAngle = Math.atan2(newCy - pivY, newCx - pivX) * 180 / Math.PI;
                    const rotDelta = spiralArrayRotate ? targetAngle - (el.rotation || 0) : 0;
                    // Correct SVG transform: rotate around ORIGINAL center, then translate.
                    // translate(tx,ty) rotate(a,cx,cy) rotates around (cx,cy) in original coords then translates.
                    // Using el.center keeps the center at el.center after rotate, then translate moves it to newCx,newCy.
                    const transform = rotDelta !== 0
                      ? `translate(${offsetX},${offsetY}) rotate(${rotDelta},${el.center.x},${el.center.y})`
                      : `translate(${offsetX},${offsetY})`;
                    if (el.isClosed && el.shapeStyle === 'circle') {
                      const r = (el.stitchCount * dsWidth) / (2 * Math.PI);
                      ghosts.push(<circle key={`sgh-${i}-${el.id}`} cx={el.center.x} cy={el.center.y} r={r} transform={transform} fill="none" stroke="#f472b6" strokeWidth={2/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} opacity={0.55} pointerEvents="none" />);
                    } else if (el.paths?.length > 0) {
                      const d = el.paths.map(p => {
                        if (p.type === 'cubic') return `M${p.x},${p.y} C${p.control1X},${p.control1Y} ${p.control2X},${p.control2Y} ${p.endX},${p.endY}`;
                        return `M${p.x},${p.y} Q${p.controlX},${p.controlY} ${p.endX},${p.endY}`;
                      }).join(' ');
                      ghosts.push(<path key={`sgh-${i}-${el.id}`} d={d} transform={transform} fill="none" stroke="#f472b6" strokeWidth={2/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} opacity={0.55} pointerEvents="none" />);
                    }
                  });
                }
                return <g>{ghosts}</g>;
              })()}

              {/* Joint picots rendered OUTSIDE the dim group so they stay full brightness in picotJoin mode */}
              {activeMode === 'picotJoin' && elements.map(el => {
                const jpDragTransform = (selectedIds.includes(el.id) && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})` : undefined;
                return <g key={`jp-overlay-${el.id}`} transform={jpDragTransform}>{renderPicots(el, true)}</g>;
              })}
              {/* In picotJoin mode: full-size transparent rect to catch stray clicks */}
              {activeMode === 'picotJoin' && (
                <rect x="-5000" y="-5000" width="10000" height="10000" fill="transparent" style={{ pointerEvents: 'none' }} />
              )}
              {/* Beading mode: BE picots rendered at full brightness */}
              {activeMode === 'beading' && elements.map(el => {
                const beDragTransform = (selectedIds.includes(el.id) && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})` : undefined;
                return <g key={`be-overlay-${el.id}`} transform={beDragTransform}>{renderPicots(el, true)}</g>;
              })}
              {/* NEW: Path edit handles - show when in path mode with a chain selected */}
              {currentTool === 'path' && selectedIds.length === 1 && (() => {
                const chain = (() => { const _e = elementById.get(selectedIds[0]); return _e?.type === 'chain' ? _e : undefined; })();
                if (!chain || !chain.paths || chain.paths.length === 0) return null;
                const path = chain.paths[0];
                
                if (path.type === 'cubic') {
                  // Cubic bezier - show 2 control points
                  return (
                    <>
                      {/* Start point - green */}
                      <circle cx={path.x} cy={path.y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.x} cy={path.y} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* End point - green */}
                      <circle cx={path.endX} cy={path.endY} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.endX} cy={path.endY} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point 1 - blue */}
                      <circle cx={path.control1X} cy={path.control1Y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.control1X} cy={path.control1Y} r={12/zoom} fill={theme.handleControl1} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point 2 - cyan */}
                      <circle cx={path.control2X} cy={path.control2Y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.control2X} cy={path.control2Y} r={12/zoom} fill={theme.handleControl2} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Helper lines */}
                      <line x1={path.x} y1={path.y} x2={path.control1X} y2={path.control1Y} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={path.control2X} y1={path.control2Y} x2={path.endX} y2={path.endY} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                    </>
                  );
                } else {
                  // Quadratic bezier - show 1 control point (legacy support)
                  return (
                    <>
                      {/* Start point - green */}
                      <circle cx={path.x} cy={path.y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.x} cy={path.y} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* End point - green */}
                      <circle cx={path.endX} cy={path.endY} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.endX} cy={path.endY} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point - blue */}
                      <circle cx={path.controlX} cy={path.controlY} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.controlX} cy={path.controlY} r={12/zoom} fill={theme.handleControl1} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Helper lines */}
                      <line x1={path.x} y1={path.y} x2={path.controlX} y2={path.controlY} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={path.endX} y1={path.endY} x2={path.controlX} y2={path.controlY} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                    </>
                  );
                }
              })()}
              
              {/* Line tool handles - show control points for editing */}
              {currentTool === 'line' && selectedIds.length === 1 && (() => {
                const line = (() => { const _e = elementById.get(selectedIds[0]); return _e?.type === 'line' ? _e : undefined; })();
                if (!line || !line.paths || line.paths.length === 0) return null;
                const path = line.paths[0];
                
                if (path.type === 'cubic') {
                  return (
                    <g data-ui="1">
                      {/* Start point - green */}
                      <circle cx={path.x} cy={path.y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.x} cy={path.y} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* End point - green */}
                      <circle cx={path.endX} cy={path.endY} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.endX} cy={path.endY} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point 1 - blue */}
                      <circle cx={path.control1X} cy={path.control1Y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.control1X} cy={path.control1Y} r={12/zoom} fill={theme.handleControl1} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point 2 - cyan */}
                      <circle cx={path.control2X} cy={path.control2Y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.control2X} cy={path.control2Y} r={12/zoom} fill={theme.handleControl2} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Helper lines */}
                      <line x1={path.x} y1={path.y} x2={path.control1X} y2={path.control1Y} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={path.control2X} y1={path.control2Y} x2={path.endX} y2={path.endY} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                    </g>
                  );
                }
                return null;
              })()}

              {/* Snap point indicators - hidden in realistic mode, dimmed in picotJoin mode */}
              {snapEnabled && showEditingArtifacts && renderMode !== 'realistic' && (() => {
                // Show snap points for all non-selected elements
                return elements
                  .filter(el => !selectedIds.includes(el.id))
                  .map(el => {
                    const points = getSnapPoints(el).filter(p => p.type !== 'picot-guide');
                    return points.map((point, i) => (
                      <g key={`snap-${el.id}-${i}`} data-ui="1" opacity={(activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder') ? 0.15 : 1}>
                        {/* Outer circle for visibility - fixed screen size */}
                        <circle 
                          cx={point.x} 
                          cy={point.y} 
                          r={10/zoom} 
                          fill={`rgba(${parseInt(theme.snapOuter.slice(1,3),16)},${parseInt(theme.snapOuter.slice(3,5),16)},${parseInt(theme.snapOuter.slice(5,7),16)},0.2)`} 
                          stroke={theme.snapOuter} 
                          strokeWidth={2/zoom}
                        />
                        {/* Inner dot - fixed screen size */}
                        <circle 
                          cx={point.x} 
                          cy={point.y} 
                          r={3.75/zoom} 
                          fill={theme.snapInner}
                        />
                      </g>
                    ));
                  });
              })()}

              {/* ── Ruler tool overlay ─────────────────────────────────────────── */}
              {currentTool === 'ruler' && (() => {
                // Determine the two endpoints: [p1, p2] or [p1, liveMousePos]
                const p1 = rulerPoints[0] || null;
                const p2 = rulerPoints[1] || (rulerPoints.length === 1 ? rulerMousePos : null);
                if (!p1) return null;

                const activePreset = threadPresets.find(pr => pr.id === activePresetId) || threadPresets[0] || DEFAULT_THREAD_PRESET;
                const mmPerWorldPx = (activePreset.ds20Core / 20) / dsWidth;

                // Build measurement string
                const makeMeasurementLabel = (worldDist) => {
                  const mm = worldDist * mmPerWorldPx;
                  const cm = mm / 10;
                  const inch = mm / 25.4;
                  const px = Math.round(worldDist);
                  return { px, mm: mm.toFixed(1), cm: cm.toFixed(2), inch: inch.toFixed(3) };
                };

                const S = 1 / zoom; // scale factor: keeps all UI sizes screen-pixel-constant

                // Dot radius and line width in world units (so they stay same size on screen)
                const dotR = 6 * S;
                const lineW = 2 * S;
                const dashArr = `${8 * S} ${5 * S}`;
                const fontSize = 13 * S;
                const padding = 7 * S;
                const lineHeight = 17 * S;

                const renderDot = (p, color) => (
                  <g key={`dot-${p.x}-${p.y}`}>
                    <circle cx={p.x} cy={p.y} r={dotR + 2 * S} fill="rgba(0,0,0,0.5)" />
                    <circle cx={p.x} cy={p.y} r={dotR} fill={color} stroke="white" strokeWidth={1.5 * S} />
                    {/* Crosshair arms */}
                    <line x1={p.x - dotR * 2.5} y1={p.y} x2={p.x + dotR * 2.5} y2={p.y} stroke="white" strokeWidth={S} opacity={0.8} />
                    <line x1={p.x} y1={p.y - dotR * 2.5} x2={p.x} y2={p.y + dotR * 2.5} stroke="white" strokeWidth={S} opacity={0.8} />
                  </g>
                );

                if (!p2) {
                  // Only first point — just render the anchor dot
                  return renderDot(p1, '#FACC15');
                }

                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const locked = rulerPoints.length === 2;
                const lineColor = locked ? '#34D399' : '#FACC15';
                const { px, mm, cm, inch } = makeMeasurementLabel(dist);

                // Label position: perpendicular offset from midpoint, always readable
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;

                // Rows of text
                const rows = [
                  `${px} px`,
                  `${mm} mm`,
                  `${cm} cm`,
                  `${inch}"`,
                ];

                const boxW = 80 * S;
                const boxH = (rows.length * lineHeight) + padding * 2;
                // Offset the label box perpendicular to the line, above-right of midpoint
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const perpAngle = angle - Math.PI / 2;
                const labelOffset = 32 * S;
                const lx = mx + Math.cos(perpAngle) * labelOffset - boxW / 2;
                const ly = my + Math.sin(perpAngle) * labelOffset - boxH / 2;

                return (
                  <g data-ui="ruler">
                    {/* Measurement line */}
                    <line
                      x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      stroke="rgba(0,0,0,0.4)" strokeWidth={lineW + 2 * S}
                    />
                    <line
                      x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      stroke={lineColor} strokeWidth={lineW}
                      strokeDasharray={locked ? undefined : dashArr}
                    />
                    {/* End cap ticks */}
                    {[p1, p2].map((p, i) => {
                      const tickLen = 10 * S;
                      return (
                        <line key={i}
                          x1={p.x + Math.cos(perpAngle) * tickLen}
                          y1={p.y + Math.sin(perpAngle) * tickLen}
                          x2={p.x - Math.cos(perpAngle) * tickLen}
                          y2={p.y - Math.sin(perpAngle) * tickLen}
                          stroke={lineColor} strokeWidth={lineW} strokeLinecap="round"
                        />
                      );
                    })}
                    {/* Anchor dots */}
                    {renderDot(p1, '#FACC15')}
                    {renderDot(p2, locked ? '#34D399' : '#60A5FA')}
                    {/* Measurement label box */}
                    <rect
                      x={lx} y={ly} width={boxW} height={boxH}
                      rx={4 * S} ry={4 * S}
                      fill="rgba(15,23,42,0.88)" stroke={lineColor} strokeWidth={S}
                    />
                    {rows.map((row, i) => (
                      <text
                        key={i}
                        x={lx + boxW / 2}
                        y={ly + padding + lineHeight * i + lineHeight * 0.72}
                        fill={i === 0 ? '#94A3B8' : i === 1 ? '#F1F5F9' : i === 2 ? '#34D399' : '#60A5FA'}
                        fontSize={fontSize}
                        fontFamily="monospace"
                        fontWeight={i === 0 ? 'normal' : 'bold'}
                        textAnchor="middle"
                      >
                        {row}
                      </text>
                    ))}
                    {/* "Click to reset" hint when locked */}
                    {locked && (
                      <text
                        x={lx + boxW / 2} y={ly + boxH + 14 * S}
                        fill="rgba(148,163,184,0.7)" fontSize={10 * S}
                        fontFamily="sans-serif" textAnchor="middle"
                      >click to reset</text>
                    )}
                  </g>
                );
              })()}

              {selectionBox && (
                <rect
                  data-ui="1"
                  x={Math.min(selectionBox.x, selectionBox.x + selectionBox.width)}
                  y={Math.min(selectionBox.y, selectionBox.y + selectionBox.height)}
                  width={Math.abs(selectionBox.width)}
                  height={Math.abs(selectionBox.height)}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              {zoomRectBox && (
                <rect
                  data-ui="1"
                  x={Math.min(zoomRectBox.x, zoomRectBox.x + zoomRectBox.width)}
                  y={Math.min(zoomRectBox.y, zoomRectBox.y + zoomRectBox.height)}
                  width={Math.abs(zoomRectBox.width)}
                  height={Math.abs(zoomRectBox.height)}
                  fill="rgba(251, 191, 36, 0.1)"
                  stroke="#FBBF24"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              {/* Bounding box with rotation handles and pivot */}
              {(() => {
                if (currentTool !== 'select' || selectedIds.length === 0) return null;
                const bbox = getBoundingBox(selectedIds);
                if (!bbox) return null;
                
                const pivotX = bbox.centerX + pivotOffset.x;
                const pivotY = bbox.centerY + pivotOffset.y;
                
                // Show rotation handles when Shift is held OR manual toggle is on (for mobile)
                const shouldShowRotationHandles = isShiftHeld || showRotationHandles;
                
                return (
                  <g data-ui="1">
                    {/* Bounding box */}
                    <rect
                      x={bbox.x}
                      y={bbox.y}
                      width={bbox.width}
                      height={bbox.height}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="1"
                      strokeDasharray="5,5"
                    />
                    
                    {/* Rotation handles at corners - show when Shift is held OR toggle is on */}
                    {shouldShowRotationHandles && (
                      <>
                        <circle cx={bbox.x} cy={bbox.y} r="8" fill="#3B82F6" stroke="#FFF" strokeWidth="2" className="cursor-grab" />
                        <circle cx={bbox.x + bbox.width} cy={bbox.y} r="8" fill="#3B82F6" stroke="#FFF" strokeWidth="2" className="cursor-grab" />
                        <circle cx={bbox.x + bbox.width} cy={bbox.y + bbox.height} r="8" fill="#3B82F6" stroke="#FFF" strokeWidth="2" className="cursor-grab" />
                        <circle cx={bbox.x} cy={bbox.y + bbox.height} r="8" fill="#3B82F6" stroke="#FFF" strokeWidth="2" className="cursor-grab" />
                      </>
                    )}
                    
                    {/* Pivot point (orange with crosshairs) - show when Shift is held OR toggle is on */}
                    {shouldShowRotationHandles && (
                      <>
                        <circle 
                          cx={pivotX} 
                          cy={pivotY} 
                          r="6" 
                          fill="#FF8C00" 
                          stroke="#FFF"
                          strokeWidth="2"
                          className="cursor-move"
                        />
                        <line 
                          x1={pivotX - 10} 
                          y1={pivotY} 
                          x2={pivotX + 10} 
                          y2={pivotY} 
                          stroke="#FFF"
                          strokeWidth="2"
                        />
                        <line 
                          x1={pivotX} 
                          y1={pivotY - 10} 
                          x2={pivotX} 
                          y2={pivotY + 10} 
                          stroke="#FFF"
                          strokeWidth="2"
                        />
                      </>
                    )}
                  </g>
                );
              })()}
            </g>
          </svg>
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4" style={{ zIndex: 2147483645 }} onClick={() => setShowHelp(false)}>
          <div
            className="bg-gray-800 rounded-lg w-full max-w-full md:max-w-3xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ height: window.innerWidth <= 768 ? '92vh' : '82vh', maxHeight: '92vh' }}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-3 md:p-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-white text-lg md:text-xl font-bold">{t('helpTitle')}</h2>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            {/* Help content — language-aware, falls back to English if localised file missing */}
            {helpUrlReady
              ? <iframe
                  key={resolvedHelpUrl}
                  src={resolvedHelpUrl}
                  className="flex-1 w-full rounded-b-lg"
                  style={{ border: 'none', minHeight: 0 }}
                  title={t('helpWindowTitle')}
                />
              : <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            }
          </div>
        </div>
      )}

      {/* ── UI Guide modal ─────────────────────────────────────────────────── */}
      {showUiGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4" onClick={() => setShowUiGuide(false)}>
          <div
            className="bg-gray-800 rounded-lg w-full max-w-full md:max-w-3xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ height: window.innerWidth <= 768 ? '92vh' : '82vh', maxHeight: '92vh' }}
          >
            <div className="flex justify-between items-center p-3 md:p-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-white text-lg md:text-xl font-bold">{t('helpMenuUiGuide')}</h2>
              <button onClick={() => setShowUiGuide(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            {uiGuideUrlReady
              ? <iframe
                  key={resolvedUiGuideUrl}
                  src={resolvedUiGuideUrl}
                  className="flex-1 w-full rounded-b-lg"
                  style={{ border: 'none', minHeight: 0 }}
                  title={t('helpMenuUiGuide')}
                />
              : <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            }
          </div>
        </div>
      )}


      {showColorPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{zIndex:2147483646}}>
          <div className="bg-gray-800 rounded-lg flex flex-col" style={{
            width: '100%',
            maxWidth: '28rem',
            height: 'min(92vh, 610px)',
          }}>
            {/* ── Header: tabs (flex-shrink-0) ── */}
            <div className="px-6 pt-4 pb-0 flex-shrink-0 border-b border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => setColorPickerTab('picker')}
                className={`px-4 py-2 text-sm font-medium ${
                  colorPickerTab === 'picker'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('colorPickerTabLabel')}
              </button>
              {(!pickerTabsAllowed || pickerTabsAllowed.includes('swatches')) && (
                <button
                  onClick={() => setColorPickerTab('swatches')}
                  className={`px-4 py-2 text-sm font-medium ${
                    colorPickerTab === 'swatches'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('colorDmcTab')}
                </button>
              )}
              {(!pickerTabsAllowed || pickerTabsAllowed.includes('gradients')) && (
                <button
                  onClick={() => setColorPickerTab('gradients')}
                  className={`px-4 py-2 text-sm font-medium ${
                    colorPickerTab === 'gradients'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('colorGradientsTab')}
                </button>
              )}
            </div>
            </div>{/* end header */}

            {/* ── Body: scrollable tab content (flex-1) ── */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
            
            {/* Color Picker Tab - iOS-style Grid */}
            {colorPickerTab === 'picker' && (
              <>
                {/* Saturation/Brightness Grid */}
                <div className="mb-3 relative">
                  <div 
                    className="w-full h-36 sm:h-48 rounded-lg cursor-crosshair border-2 border-gray-600"
                    style={{
                      background: `
                        linear-gradient(to top, black, transparent),
                        linear-gradient(to right, white, hsl(${(() => {
                          // Extract hue from current color
                          const hex = pickerColor.replace('#', '');
                          const r = parseInt(hex.substr(0, 2), 16) / 255;
                          const g = parseInt(hex.substr(2, 2), 16) / 255;
                          const b = parseInt(hex.substr(4, 2), 16) / 255;
                          const max = Math.max(r, g, b);
                          const min = Math.min(r, g, b);
                          const delta = max - min;
                          let h = 0;
                          if (delta !== 0) {
                            if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                            else if (max === g) h = ((b - r) / delta + 2) / 6;
                            else h = ((r - g) / delta + 4) / 6;
                          }
                          return Math.round(h * 360);
                        })()}, 100%, 50%))
                      `,
                      touchAction: 'none'
                    }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = (e.clientX - rect.left) / rect.width;
                      const y = 1 - (e.clientY - rect.top) / rect.height;
                      
                      // Get current hue
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                        else if (max === g) h = ((b - r) / delta + 2) / 6;
                        else h = ((r - g) / delta + 4) / 6;
                      }
                      
                      // Convert HSV to RGB
                      const s = x;
                      const v = y;
                      const c = v * s;
                      const hPrime = h * 6;
                      const x2 = c * (1 - Math.abs((hPrime % 2) - 1));
                      const m = v - c;
                      
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x2; bNew = 0; }
                      else if (hPrime < 2) { rNew = x2; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x2; }
                      else if (hPrime < 4) { rNew = 0; gNew = x2; bNew = c; }
                      else if (hPrime < 5) { rNew = x2; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x2; }
                      
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault(); // prevent scroll/zoom while picking
                      const touch = e.touches[0];
                      const rect = e.currentTarget.getBoundingClientRect();
                      // Clamp to [0,1] so touches outside the element don't sample wrong colors
                      const x = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
                      const y = Math.min(1, Math.max(0, 1 - (touch.clientY - rect.top) / rect.height));
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                        else if (max === g) h = ((b - r) / delta + 2) / 6;
                        else h = ((r - g) / delta + 4) / 6;
                      }
                      const s = x; const v = y; const c = v * s;
                      const hPrime = h * 6; const x2 = c * (1 - Math.abs((hPrime % 2) - 1)); const m = v - c;
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x2; bNew = 0; }
                      else if (hPrime < 2) { rNew = x2; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x2; }
                      else if (hPrime < 4) { rNew = 0; gNew = x2; bNew = c; }
                      else if (hPrime < 5) { rNew = x2; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x2; }
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault(); // prevent scroll while dragging
                      const touch = e.touches[0];
                      const rect = e.currentTarget.getBoundingClientRect();
                      // Clamp: dragging outside the box still samples edge color, not random
                      const x = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
                      const y = Math.min(1, Math.max(0, 1 - (touch.clientY - rect.top) / rect.height));
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                        else if (max === g) h = ((b - r) / delta + 2) / 6;
                        else h = ((r - g) / delta + 4) / 6;
                      }
                      const s = x; const v = y; const c = v * s;
                      const hPrime = h * 6; const x2 = c * (1 - Math.abs((hPrime % 2) - 1)); const m = v - c;
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x2; bNew = 0; }
                      else if (hPrime < 2) { rNew = x2; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x2; }
                      else if (hPrime < 4) { rNew = 0; gNew = x2; bNew = c; }
                      else if (hPrime < 5) { rNew = x2; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x2; }
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                  >
                    {/* Color indicator dot */}
                    {(() => {
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const s = max === 0 ? 0 : (max - min) / max;
                      const v = max;
                      return (
                        <div 
                          className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none"
                          style={{
                            left: `${s * 100}%`,
                            top: `${(1 - v) * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 0 1px black, 0 2px 4px rgba(0,0,0,0.3)'
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
                
                {/* Hue Slider */}
                <div className="mb-3 relative">
                  <style>{`
                    .hue-slider::-webkit-slider-thumb {
                      appearance: none;
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: white;
                      border: 3px solid white;
                      box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2);
                      cursor: pointer;
                    }
                    .hue-slider::-moz-range-thumb {
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: white;
                      border: 3px solid white;
                      box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2);
                      cursor: pointer;
                    }
                  `}</style>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    className="hue-slider w-full h-4 sm:h-8 rounded-lg cursor-pointer"
                    value={(() => {
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                        else if (max === g) h = ((b - r) / delta + 2) / 6;
                        else h = ((r - g) / delta + 4) / 6;
                      }
                      return Math.round(h * 360);
                    })()}
                    onChange={(e) => {
                      const h = parseInt(e.target.value) / 360;
                      
                      // Get current saturation and value
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const s = max === 0 ? 0 : (max - min) / max;
                      const v = max;
                      
                      // Convert HSV to RGB
                      const c = v * s;
                      const hPrime = h * 6;
                      const x = c * (1 - Math.abs((hPrime % 2) - 1));
                      const m = v - c;
                      
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x; bNew = 0; }
                      else if (hPrime < 2) { rNew = x; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x; }
                      else if (hPrime < 4) { rNew = 0; gNew = x; bNew = c; }
                      else if (hPrime < 5) { rNew = x; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x; }
                      
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                    onInput={(e) => {
                      // Same logic as onChange - ensures touch events work
                      const h = parseInt(e.target.value) / 360;
                      
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const s = max === 0 ? 0 : (max - min) / max;
                      const v = max;
                      
                      const c = v * s;
                      const hPrime = h * 6;
                      const x = c * (1 - Math.abs((hPrime % 2) - 1));
                      const m = v - c;
                      
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x; bNew = 0; }
                      else if (hPrime < 2) { rNew = x; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x; }
                      else if (hPrime < 4) { rNew = 0; gNew = x; bNew = c; }
                      else if (hPrime < 5) { rNew = x; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x; }
                      
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                      touchAction: 'manipulation'
                    }}
                  />
                </div>
                
                {/* Base color swatches */}
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {[...COLORS, ...customColors].map((color, i) => (
                    <div
                      key={i}
                      onClick={() => setPickerColor(color)}
                      className="rounded cursor-pointer border-2 border-gray-600 hover:border-white"
                      style={{ backgroundColor: color, width: '100%', paddingBottom: '100%', position: 'relative' }}
                      title={color}
                    />
                  ))}
                </div>

                {/* Hex Input */}
                <input 
                  type="text" 
                  value={pickerColor} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setPickerColor(val);
                    }
                  }} 
                  className="px-3 py-2 bg-gray-700 text-white rounded w-full mb-2 uppercase font-mono text-center" 
                  placeholder="#FFFFFF"
                  maxLength={7}
                />
              </>
            )}
            
            {/* Swatches Tab - DMC Colors */}
            {colorPickerTab === 'swatches' && (
              <div>
                {dmcColors.length === 0 ? (
                  <div className="bg-gray-700 rounded p-6 text-center">
                    <p className="text-gray-400">{t('loadingDmcColors')}</p>
                  </div>
                ) : (
                  <>
                    {/* Search field */}
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder={t('colorSearchPlaceholder')}
                        value={dmcSearchTerm}
                        onChange={(e) => {
                          setDmcSearchTerm(e.target.value);
                          setDmcPage(0); // Reset to first page on search
                        }}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      />
                    </div>
                    
                    {/* Category tabs - derived dynamically from loaded JSON groups */}
                    {(() => {
                      const solidColors = dmcColors.filter(c => c.type !== 'gradient');
                      const groups = ['all', ...Array.from(new Set(solidColors.map(c => c.group).filter(Boolean))).sort()];
                      return (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {groups.map(cat => (
                            <button
                              key={cat}
                              onClick={() => {
                                setDmcCategory(cat);
                                setDmcPage(0);
                                setDmcSearchTerm('');
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                dmcCategory === cat
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {cat === 'all' ? 'All' : cat}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    
                    {(() => {
                      // Filter colors with category support
                      const filteredColors = dmcColors.filter(color => {
                        // NEVER show gradients in the solid color picker
                        if (color.type === 'gradient') return false;
                        
                        // Search filter
                        if (dmcSearchTerm) {
                          const search = dmcSearchTerm.toLowerCase();
                          if (!color.id.toLowerCase().includes(search) && 
                              !color.name.toLowerCase().includes(search)) {
                            return false;
                          }
                        }
                        
                        // Category filter - use group field directly, fall back to categorizeColor
                        if (dmcCategory !== 'all') {
                          const colorGroup = color.group || categorizeColor(color);
                          return colorGroup === dmcCategory;
                        }
                        
                        return true;
                      });
                      
                      // Pagination
                      const colorsPerPage = 18;
                      const totalPages = Math.ceil(filteredColors.length / colorsPerPage);
                      const startIdx = dmcPage * colorsPerPage;
                      const endIdx = startIdx + colorsPerPage;
                      const pageColors = filteredColors.slice(startIdx, endIdx);
                      
                      return (
                        <>
                          {/* Color grid - fixed height, swatches maintain size */}
                          <div className="grid grid-cols-6 gap-2 p-2 bg-gray-700 rounded mb-3" style={{ height: '164px', alignContent: 'start' }}>
                            {pageColors.map((color) => (
                              <div
                                key={color.id}
                                onClick={() => {
                                  setSelectedDmcColor(color);
                                  // For gradients, extract first color
                                  if (color.type === 'gradient' && color.stops) {
                                    if (typeof color.stops === 'string') {
                                      const firstStop = color.stops.split(',')[0];
                                      const firstColor = firstStop.split(':')[1];
                                      setPickerColor(firstColor);
                                    } else if (Array.isArray(color.stops) && color.stops.length > 0) {
                                      setPickerColor(color.stops[0].color);
                                    }
                                  } else {
                                    setPickerColor(color.hex);
                                  }
                                }}
                                className={`cursor-pointer rounded overflow-hidden transition-all h-11 ${
                                  selectedDmcColor?.id === color.id
                                    ? 'ring-4 ring-blue-500'
                                    : 'hover:ring-2 hover:ring-gray-400'
                                }`}
                                title={color.name}
                                style={{ touchAction: 'manipulation' }}
                              >
                                <div
                                  className="w-full h-full flex items-center justify-center border-2 border-black relative"
                                  style={{ 
                                    background: color.type === 'gradient' 
                                      ? 'transparent'
                                      : color.hex 
                                  }}
                                >
                                  {color.type === 'gradient' && (
                                    <>
                                      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} preserveAspectRatio="none">
                                        <defs>
                                          <linearGradient id={`swatch-gradient-${color.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                            {(() => {
                                              let stops = color.stops;
                                              if (typeof color.stops === 'string') {
                                                stops = color.stops.split(',').map(stop => {
                                                  const [offset, colorHex] = stop.split(':');
                                                  return { offset: `${offset}%`, color: colorHex };
                                                });
                                              }
                                              return stops.map((stop, i) => (
                                                <stop key={i} offset={stop.offset} stopColor={stop.color} />
                                              ));
                                            })()}
                                          </linearGradient>
                                        </defs>
                                        <rect x="0" y="0" width="100%" height="100%" fill={`url(#swatch-gradient-${color.id})`} />
                                      </svg>
                                    </>
                                  )}
                                  <span 
                                    className="text-white font-bold text-xs px-1 py-0.5 rounded"
                                    style={{ 
                                      textShadow: '0 0 3px black, 0 0 5px black',
                                      backgroundColor: 'rgba(0,0,0,0.3)',
                                      position: 'relative',
                                      zIndex: 1
                                    }}
                                  >
                                    {color.id}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Pagination controls - always visible */}
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <button
                              onClick={() => setDmcPage(Math.max(0, dmcPage - 1))}
                              disabled={dmcPage === 0}
                              className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-600 disabled:hover:bg-gray-700"
                            >
                              {t('prevBtn')}
                            </button>
                            
                            <span className="text-gray-400 text-sm">
                              {t('colorPageIndicator').replace('{page}', String(dmcPage + 1)).replace('{total}', String(Math.max(1, totalPages))).replace('{count}', String(filteredColors.length))}
                            </span>
                            
                            <button
                              onClick={() => setDmcPage(Math.min(totalPages - 1, dmcPage + 1))}
                              disabled={dmcPage >= totalPages - 1}
                              className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-600 disabled:hover:bg-gray-700"
                            >
                              {t('nextBtn')}
                            </button>
                          </div>
                          
                          {/* Color preview section - under the grid */}
                          <div className="bg-gray-700 rounded p-3 border-2 border-gray-600">
                            <div className="flex items-center gap-3 h-16">
                              <div
                                className="w-16 h-16 rounded border-2 border-black flex-shrink-0 relative overflow-hidden"
                                style={{ backgroundColor: selectedDmcColor ? (selectedDmcColor.type === 'gradient' ? 'transparent' : selectedDmcColor.hex) : '#374151' }}
                              >
                                {selectedDmcColor?.type === 'gradient' && (
                                  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none">
                                    <defs>
                                      <linearGradient id={`preview-gradient-${selectedDmcColor.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                        {(() => {
                                          let stops = selectedDmcColor.stops;
                                          if (typeof selectedDmcColor.stops === 'string') {
                                            stops = selectedDmcColor.stops.split(',').map(stop => {
                                              const [offset, colorHex] = stop.split(':');
                                              return { offset: `${offset}%`, color: colorHex };
                                            });
                                          }
                                          return stops.map((stop, i) => (
                                            <stop key={i} offset={stop.offset} stopColor={stop.color} />
                                          ));
                                        })()}
                                      </linearGradient>
                                    </defs>
                                    <rect x="0" y="0" width="100%" height="100%" fill={`url(#preview-gradient-${selectedDmcColor.id})`} />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {selectedDmcColor ? (
                                  <>
                                    <p className="text-white font-bold text-base mb-1">
                                      {selectedDmcColor.name}
                                    </p>
                                    <p className="text-gray-300 font-mono text-xs">
                                      ID: {selectedDmcColor.id} · {selectedDmcColor.type === 'gradient' ? 'Variegated' : selectedDmcColor.hex}
                                    </p>

                                  </>
                                ) : (
                                  <p className="text-gray-400 text-sm">
                                    {t('clickColorPreview')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {colorPickerTab === 'gradients' && (
              <div>
                {/* Search bar */}
                <input
                  type="text"
                  placeholder={t('colorSearchPlaceholder')}
                  value={gradientSearchTerm}
                  onChange={(e) => { setGradientSearchTerm(e.target.value); setGradientPage(0); }}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {/* Thread line filter */}
                {(() => {
                  const allGradients = dmcColors.filter(c => c.type === 'gradient');
                  const threadLines = ['all', ...Array.from(new Set(allGradients.map(c => c.group).filter(Boolean)))];
                  return (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {threadLines.map(line => (
                        <button
                          key={line}
                          onClick={() => { setGradientCategory(line); setGradientPage(0); }}
                          className={`px-3 py-1 rounded text-xs ${gradientCategory === line ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                          {line === 'all' ? 'All' : line}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {/* Grid + pagination */}
                {(() => {
                  const allGradients = dmcColors.filter(c => c.type === 'gradient');
                  const filtered = allGradients.filter(color => {
                    if (gradientSearchTerm) {
                      const s = gradientSearchTerm.toLowerCase();
                      if (!color.id.toLowerCase().includes(s) && !color.name.toLowerCase().includes(s)) return false;
                    }
                    if (gradientCategory !== 'all') return color.group === gradientCategory;
                    return true;
                  });
                  const perPage = 24;
                  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
                  const pageItems = filtered.slice(gradientPage * perPage, (gradientPage + 1) * perPage);
                  return (
                    <>
                      <div className="grid grid-cols-6 gap-2 p-2 bg-gray-700 rounded mb-2" style={{ height: '216px', alignContent: 'start' }}>
                        {pageItems.map((color) => (
                          <div
                            key={color.id}
                            onClick={() => setSelectedGradient(color)}
                            className={`cursor-pointer rounded overflow-hidden transition-all h-11 ${selectedGradient?.id === color.id ? 'ring-4 ring-blue-500' : 'hover:ring-2 hover:ring-gray-400'}`}
                            title={color.name}
                          >
                            <div className="w-full h-full relative border-2 border-black">
                              <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id={`cpicker-gradient-${color.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                    {(() => {
                                      let stops = color.stops;
                                      if (typeof color.stops === 'string') {
                                        stops = color.stops.split(',').map(stop => {
                                          const [offset, colorHex] = stop.split(':');
                                          return { offset: `${offset}%`, color: colorHex };
                                        });
                                      }
                                      return stops.map((stop, i) => <stop key={i} offset={stop.offset} stopColor={stop.color} />);
                                    })()}
                                  </linearGradient>
                                </defs>
                                <rect x="0" y="0" width="100%" height="100%" fill={`url(#cpicker-gradient-${color.id})`} />
                              </svg>
                              <span className="text-white font-bold text-xs px-1 py-0.5 rounded" style={{ textShadow: '0 0 3px black', backgroundColor: 'rgba(0,0,0,0.3)', position: 'relative', zIndex: 1 }}>
                                {color.id}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-3" style={{ height: '2rem' }}>
                        <button onClick={() => setGradientPage(p => Math.max(0, p - 1))} disabled={gradientPage === 0} className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 hover:bg-gray-600">{t('prevBtn')}</button>
                        <span className="text-gray-400 text-sm">{t('colorPageIndicator').replace('{page}', String(gradientPage + 1)).replace('{total}', String(totalPages)).replace('{count}', String(filtered.length))}</span>
                        <button onClick={() => setGradientPage(p => Math.min(totalPages - 1, p + 1))} disabled={gradientPage >= totalPages - 1} className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 hover:bg-gray-600">{t('nextBtn')}</button>
                      </div>
                      {/* Preview */}
                      <div className="bg-gray-700 rounded p-3 border-2 border-gray-600">
                        <div className="flex items-center gap-3 h-16">
                          <div className="w-16 h-16 rounded border-2 border-black flex-shrink-0 relative overflow-hidden" style={{ backgroundColor: selectedGradient ? 'transparent' : '#374151' }}>
                            {selectedGradient && (
                              <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id={`cpicker-preview-${selectedGradient.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                    {(() => {
                                      let stops = selectedGradient.stops;
                                      if (typeof selectedGradient.stops === 'string') {
                                        stops = selectedGradient.stops.split(',').map(stop => {
                                          const [offset, colorHex] = stop.split(':');
                                          return { offset: `${offset}%`, color: colorHex };
                                        });
                                      }
                                      return stops.map((stop, i) => <stop key={i} offset={stop.offset} stopColor={stop.color} />);
                                    })()}
                                  </linearGradient>
                                </defs>
                                <rect x="0" y="0" width="100%" height="100%" fill={`url(#cpicker-preview-${selectedGradient.id})`} />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {selectedGradient ? (
                              <>
                                <p className="text-white font-bold text-base mb-1">{selectedGradient.name}</p>
                                <p className="text-gray-300 font-mono text-xs mb-2">ID: {selectedGradient.id} · {selectedGradient.group || 'Gradient'}</p>
                              </>
                            ) : (
                              <p className="text-gray-400 text-sm">{t('clickGradientPreview')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            
            </div>{/* end body */}

            {/* ── Footer: OK/Cancel (flex-shrink-0) ── */}
            <div className="px-6 pb-4 pt-3 flex-shrink-0 border-t border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (colorPickerTab === 'gradients' && selectedGradient && pickerGradientCallback) {
                    pickerGradientCallback(selectedGradient.id);
                    setPickerGradientCallback(null);
                    setPickerCallback(null);
                    setSelectedGradient(null);
                  } else if (pickerCallback) {
                    // Called from bead settings or other non-swatch context
                    pickerCallback(pickerColor);
                    setPickerCallback(null);
                  } else {
                    const oldColor = allColors[editingColorIndex];
                    if (editingColorIndex >= COLORS.length) {
                      const customIndex = editingColorIndex - COLORS.length;
                      const newCustom = [...customColors];
                      newCustom[customIndex] = pickerColor;
                      setCustomColors(newCustom);
                    } else {
                      setCustomColors([...customColors, pickerColor]);
                    }
                    if (oldColor) {
                      setElements(prev => prev.map(e => e.color === oldColor ? { ...e, color: pickerColor } : e));
                    }
                  }
                  setShowColorPicker(false);
                  setColorPickerTab('picker');
                  setPickerTabsAllowed(null);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t('alertOk')}
              </button>
              <button
                onClick={() => {
                  setPickerCallback(null);
                  setShowColorPicker(false);
                  setColorPickerTab('picker');
                  setPickerTabsAllowed(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                {t('confirmCancel')}
              </button>
            </div>
            </div>{/* end footer */}
          </div>
        </div>
      )}
      

      {/* Save Dialog Modal */}
      {/* New Canvas Confirmation Dialog */}
      {/* Join Picots Mode Tip */}
      {showJoinTip && activeMode === 'picotJoin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-blue-500 shadow-2xl">
            <h2 className="text-lg font-bold text-blue-400 mb-3">{t('joinTipTitle')}</h2>
            <div className="text-gray-200 text-sm space-y-2 mb-5">
              <p>{t('joinTipBody1')}</p>
              <p>{t('joinTipBody2')}</p>
              <p>{t('joinTipBody3')}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) localStorage.setItem('tcad_seen_join_tip', '1');
                    else localStorage.removeItem('tcad_seen_join_tip');
                  }}
                  className="w-4 h-4"
                />
                {t('joinTipDontShow')}
              </label>
              <button
                onClick={() => setShowJoinTip(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                autoFocus
              >
                {t('joinTipGotIt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tatting Order conflict popup ─────────────────────────────── */}
      {tattingOrderConflict && (() => {
        const targetEl = elements.find(e => e.id === tattingOrderConflict.targetElId);
        const canSwap = targetEl?.orderNumber != null && String(targetEl.orderNumber).trim() !== '';
        return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-amber-500 shadow-2xl">
            <h2 className="text-base font-bold text-amber-400 mb-4">{t('tattingOrderConflictTitle')} (#{tattingOrderConflict.newNum})</h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => resolveTattingOrderConflict('swap')}
                disabled={!canSwap}
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-semibold text-sm"
                autoFocus={canSwap}
              >
                {t('tattingOrderConflictSwap')}
              </button>
              <button
                onClick={() => resolveTattingOrderConflict('shift')}
                className="w-full px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-semibold text-sm"
                autoFocus={!canSwap}
              >
                {t('tattingOrderConflictShift')}
              </button>
              <button
                onClick={() => resolveTattingOrderConflict('cancel')}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
              >
                {t('tattingOrderConflictCancel')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {showNewCanvasDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-600 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">{t('newCanvasTitle')}</h2>
            <p className="text-gray-300 text-sm mb-5">{t('newCanvasBody')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewCanvasDialog(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                autoFocus
              >
                {t('newCanvasCancel')}
              </button>
              <button
                onClick={confirmNewCanvas}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
              >
                {t('newCanvasConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Projects Dialog ────────────────────────────────────────── */}
      {showRecentProjectsDialog && (() => {
        const recents = getRecents();

        const removeEntry = (id: string) => {
          const updated = recents.filter(e => e.id !== id);
          localStorage.setItem('tcad_recent_projects', JSON.stringify(updated));
          // Force re-render by toggling dialog (quick trick — dialog reads fresh each render)
          setShowRecentProjectsDialog(false);
          setTimeout(() => setShowRecentProjectsDialog(true), 0);
        };

        const doLoad = (pendingAction: () => void) => {
          if (elements.length > 0) {
            // Show inline confirm then proceed
            setPendingRecentLoad(() => pendingAction);
            setShowRecentLoadConfirm(true);
          } else {
            setShowRecentProjectsDialog(false);
            pendingAction();
          }
        };

        return (
          <>
            <div className="fixed inset-0 bg-black bg-opacity-70" style={{ zIndex: 10010 }} onClick={() => setShowRecentProjectsDialog(false)} />
            <div className="fixed bg-gray-800 rounded-xl shadow-2xl border border-gray-600 flex flex-col"
              style={{ zIndex: 10011, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(720px, 96vw)', maxHeight: '90dvh' }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-600 flex-shrink-0">
                <h2 className="text-gray-100 font-bold text-lg">{t('recentProjectsTitle')}</h2>
                <button onClick={() => setShowRecentProjectsDialog(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {recents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="text-gray-400 text-base">{t('recentProjectsEmpty')}</div>
                    <div className="text-gray-500 text-sm">{t('recentProjectsEmptyHint')}</div>
                  </div>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    {recents.map(entry => (
                      <div key={entry.id} className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 hover:border-purple-500 transition-colors group cursor-pointer"
                        onClick={() => doLoad(() => { setShowRecentProjectsDialog(false); loadFromPath(entry.filename); })}>

                        {/* Thumbnail */}
                        <div className="w-full bg-gray-900 flex items-center justify-center" style={{ aspectRatio: '3/2' }}>
                          {entry.thumbnail
                            ? <img src={`data:image/svg+xml;base64,${btoa(entry.thumbnail)}`} alt={entry.name} className="w-full h-full object-contain" draggable={false} />
                            : <div className="text-gray-600 text-xs text-center px-2">{entry.name}</div>
                          }
                        </div>

                        {/* Info + actions */}
                        <div className="px-3 py-2">
                          <div className="text-white text-sm font-medium truncate" title={entry.name}>{entry.name}</div>
                          <div className="text-gray-400 text-xs mt-0.5">{t('recentProjectsSaved').replace('{date}', new Date(entry.savedAt).toLocaleDateString())}</div>
                          <div className="flex gap-2 mt-2">
                            <button
                              className="flex-1 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold"
                              onClick={(ev) => { ev.stopPropagation(); doLoad(() => { setShowRecentProjectsDialog(false); loadFromPath(entry.filename); }); }}
                            >{t('recentProjectsLoadBtn')}</button>
                            <button
                              className="py-1 px-2 rounded bg-gray-600 hover:bg-red-700 text-gray-300 hover:text-white text-xs"
                              title={t('recentProjectsDeleteBtn')}
                              onClick={(ev) => { ev.stopPropagation(); removeEntry(entry.id); }}
                            >✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer — Browse button */}
              <div className="flex justify-between items-center px-5 py-4 border-t border-gray-600 flex-shrink-0">
                <div className="text-gray-500 text-xs">{recents.length > 0 ? `${recents.length} / 20` : ''}</div>
                <button
                  onClick={() => doLoad(() => { setShowRecentProjectsDialog(false); loadProject(); })}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg border border-gray-500"
                >
                  <IconLoad size={14} />
                  {t('recentProjectsBrowse')}
                </button>
              </div>
            </div>

            {/* Inline confirm overlay for non-empty canvas */}
            {showRecentLoadConfirm && (
              <>
                <div className="fixed inset-0 bg-black bg-opacity-60" style={{ zIndex: 10012 }} />
                <div className="fixed bg-gray-800 rounded-lg p-6 border border-gray-600 shadow-2xl"
                  style={{ zIndex: 10013, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(360px, 92vw)' }}>
                  <h2 className="text-white font-bold text-base mb-2">{t('recentProjectsLoadConfirmTitle')}</h2>
                  <p className="text-gray-300 text-sm mb-5">{t('recentProjectsLoadConfirmBody')}</p>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setShowRecentLoadConfirm(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm">
                      {t('recentProjectsLoadConfirmCancel')}
                    </button>
                    <button onClick={() => {
                      setShowRecentLoadConfirm(false);
                      setShowRecentProjectsDialog(false);
                      pendingRecentLoad?.();
                    }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-sm">
                      {t('recentProjectsLoadConfirmOk')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        );
      })()}

      {showLoadConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-600 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">{t('loadConfirmTitle')}</h2>
            <p className="text-gray-300 text-sm mb-5">{t('loadConfirmBody')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLoadConfirmDialog(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                autoFocus
              >
                {t('loadConfirmCancel')}
              </button>
              <button
                onClick={() => {
                  setShowLoadConfirmDialog(false);
                  loadProject();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
              >
                {t('loadConfirmConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}




    </div>
    
    {/* File dropdown menu - rendered at top level to avoid clipping */}
    {/* ── Help / About dropdown ──────────────────────────────────── */}
    {showHelpMenu && (
      <>
        <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setShowHelpMenu(false)} />
        <div
          className="fixed bg-gray-700 rounded shadow-xl min-w-[220px]"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = helpButtonRef.current?.getBoundingClientRect();
            const menuWidth = 220;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              backgroundColor: '#374151',
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              maxHeight: '80vh',
              overflowY: 'auto',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
            };
          })()}
        >
          <button onClick={() => { setShowHelp(true); setShowHelpMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200">
            <IconHelp size={16} /><span>{t('helpMenuHelp')}</span>
          </button>
          <button onClick={() => { setShowUiGuide(true); setShowHelpMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200">
            <IconHelp size={16} /><span>{t('helpMenuUiGuide')}</span>
          </button>
          <div className="border-t border-gray-600 my-1" />
          <button onClick={() => { setShowAbout(true); setShowHelpMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200">
            <span className="text-gray-300 text-base w-4 text-center flex-shrink-0">ℹ</span><span>{t('helpMenuAbout')}</span>
          </button>
          <button onClick={() => { openExternal('https://ko-fi.com/savarosacraft'); setShowHelpMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200">
            <span className="text-red-400 w-4 text-center flex-shrink-0">♥</span><span>{t('helpMenuKofi')}</span>
          </button>
          <div className="border-t border-gray-600 my-1" />
          <button onClick={() => { setShowAbout(true); setShowHelpMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200">
            <span className="text-blue-300 w-4 text-center flex-shrink-0">↑</span><span>{t('helpMenuCheckUpdate')}</span>
          </button>
        </div>
      </>
    )}

    {/* ── About panel ──────────────────────────────────────────────── */}
    {showAbout && (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-60" style={{ zIndex: 10002 }} onClick={() => setShowAbout(false)} />
        <div className="fixed bg-gray-800 rounded-xl shadow-2xl border border-gray-600 flex flex-col"
          style={{ zIndex: 10003, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(440px, 95vw)', maxHeight: '95dvh', overflow: 'hidden' }}>


          <div className="px-5 py-5 space-y-5 overflow-y-auto flex-1">
            {/* Logo header */}
            <img
              src={logoUrl}
              alt="TattingCAD"
              className="w-full rounded-lg object-cover"
              style={{ aspectRatio: '3/1' }}
              draggable={false}
            />
            <div className="text-gray-400 text-sm text-center">{t('aboutVersion')} {APP_VERSION}</div>

            <p className="text-gray-300 text-sm leading-relaxed">{t('aboutDescription')}</p>

            {/* License */}
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('aboutLicenseHeader')}</div>
              <div className="bg-gray-700 rounded p-3 text-xs text-gray-300 leading-relaxed space-y-2"
                style={{ maxHeight: '120px', overflowY: 'auto' }}>
                <div className="font-semibold">{t('aboutLicenseText')}</div>
                <div className="text-gray-400">{t('aboutLicenseFull')}</div>
              </div>
            </div>

            {/* Special Thanks */}
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Special Thanks</div>
              <div className="text-sm text-gray-300">Mike &amp; Tim</div>
            </div>

            {/* GitHub */}
            <button onClick={() => openExternal('https://github.com/SavarosaCraft/TattingCad')}
              className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm flex items-center justify-center gap-2 border border-gray-500">
              <span>⛯</span><span>{t('aboutGithub')}</span>
            </button>

            {/* Ko-fi */}
            <button onClick={() => openExternal('https://ko-fi.com/savarosacraft')}
              className="w-full py-2 rounded-lg bg-red-900 hover:bg-red-800 text-white text-sm flex items-center justify-center gap-2 border border-red-700">
              <span>♥</span><span>{t('helpMenuKofi')}</span>
            </button>

            {/* Update checker */}
            <div className="border-t border-gray-600 pt-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">{t('helpMenuCheckUpdate')}</div>
              {(() => {
                return (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-xs text-gray-400 flex-1">{t('updateCurrentVersion').replace('{current}', APP_VERSION)}</div>
                    <button
                      onClick={() => openExternal('https://github.com/SavarosaCraft/TattingCad/releases/latest')}
                      className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded"
                    >{t('updateCheckNow')}</button>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="px-5 pb-5 flex-shrink-0">
            <button onClick={() => setShowAbout(false)}
              className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm">
              {t('aboutClose')}
            </button>
          </div>
        </div>
      </>
    )}

    {showFileMenu && (
      <>
        {/* Click overlay to close menu - allows clicks through to dropdown */}
        <div 
          className="fixed inset-0"
          style={{ zIndex: 9998, pointerEvents: 'auto' }}
          onClick={() => setShowFileMenu(false)}
        ></div>
        
        {/* Dropdown menu - extremely high z-index to be above everything */}
        <div 
          className="fixed bg-gray-700 rounded shadow-xl min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = fileButtonRef.current?.getBoundingClientRect();
            const menuWidth = 200;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              backgroundColor: '#374151',
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              maxHeight: '80vh',
              overflowY: 'auto',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
              pointerEvents: 'auto',
            };
          })()}
        >
          <button
            onClick={() => {
              setShowFileMenu(false);
              setTimeout(() => newCanvas(), 0);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconNew size={16} />
            <span>{t('fileNew')}</span>
            <span className="ml-auto text-xs text-gray-400">Ctrl+N</span>
          </button>
          <div className="border-t border-gray-600 my-1"></div>
          <button
            onClick={() => {
              saveProject();
              setShowFileMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconSave size={16} />
            <span>{t('fileSave')}</span>
            <span className="ml-auto text-xs text-gray-400">Ctrl+S</span>
          </button>
          <button
            onClick={() => {
              saveProjectAs();
              setShowFileMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconSave size={16} />
            <span>{t('fileSaveAs') || 'Save As…'}</span>
          </button>
          <button
            onClick={() => {
              setShowFileMenu(false);
              setShowRecentProjectsDialog(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconLoad size={16} />
            <span>{t('fileLoad')}</span>
          </button>
          <button
            onClick={() => {
              setShowFileMenu(false);
              if (elements.length > 0) {
                setConfirmDialog({
                  message: t('recentProjectsLoadConfirmBody'),
                  confirmLabel: t('recentProjectsLoadConfirmOk'),
                  onConfirm: () => loadProject(),
                });
              } else {
                loadProject();
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconLoad size={16} />
            <span>{t('fileBrowse')}</span>
          </button>
          <div className="border-t border-gray-600 my-1"></div>
          <button
            onClick={() => {
              exportSVG();
              setShowFileMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
            title={t('fileExportSvgTitle')}
          >
            <IconExport size={16} />
            <span>{t('fileExportSvg')}</span>
          </button>
          <button
            onClick={() => {
              generatePattern();
              setShowFileMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconDownload size={16} />
            <span>{t('fileOutputNotation')}</span>
          </button>
        </div>
      </>
    )}
    
    {/* Arrange dropdown menu - rendered at top level to avoid clipping */}
    {showArrangeMenu && (
      <>
        {/* Click overlay to close menu */}
        <div 
          className="fixed inset-0"
          style={{ zIndex: 9998, pointerEvents: 'auto' }}
          onClick={() => setShowArrangeMenu(false)}
        ></div>
        
        {/* Dropdown menu */}
        <div 
          className="fixed bg-gray-700 rounded shadow-xl min-w-[220px]"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = arrangeButtonRef.current?.getBoundingClientRect();
            const menuWidth = 220;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              backgroundColor: '#374151',
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              maxHeight: '80vh',
              overflowY: 'auto',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
              pointerEvents: 'auto',
            };
          })()}
        >
          {/* Duplicate */}
          <button
            onClick={() => {
              duplicateInPlace();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
              selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length === 0}
          >
            <IconCopy size={16} />
            <span>{t('arrangeDuplicate')}</span>
            <span className="ml-auto text-xs text-gray-400">D</span>
          </button>
          
          <div className="border-t border-gray-600 my-1"></div>
          
          {/* Alignment options */}
          <div className="px-3 py-1 text-xs text-gray-400 font-semibold">{t('arrangeAlignHeader')}</div>
          
          <button
            onClick={() => {
              alignLeft();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignLeft size={16} />
            <span>{t('arrangeAlignLeft')}</span>
          </button>
          
          <button
            onClick={() => {
              alignCenterHorizontal();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignCenter size={16} />
            <span>{t('arrangeAlignCenterH')}</span>
          </button>
          
          <button
            onClick={() => {
              alignRight();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignRight size={16} />
            <span>{t('arrangeAlignRight')}</span>
          </button>
          
          <div className="border-t border-gray-600 my-1"></div>
          
          <button
            onClick={() => {
              alignTop();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignTop size={16} />
            <span>{t('arrangeAlignTop')}</span>
          </button>
          
          <button
            onClick={() => {
              alignCenterVertical();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignMiddle size={16} />
            <span>{t('arrangeAlignCenterV')}</span>
          </button>
          
          <button
            onClick={() => {
              alignBottom();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignBottom size={16} />
            <span>{t('arrangeAlignBottom')}</span>
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Polar Grid section */}
          <div className="px-3 py-1 text-xs text-gray-400 font-semibold">{t('arrangePolarHeader')}</div>

          {polarGrids.length <= 1 ? (
            <button
              onClick={() => { centerToPolarGrid(); setShowArrangeMenu(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
                (selectedIds.length === 0 || polarGrids.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={selectedIds.length === 0 || polarGrids.length === 0}
            >
              <IconPolarGrid size={16} />
              <span>{t('arrangeCenterToPolarGrid')}</span>
            </button>
          ) : (
            <>
              <div className="px-4 py-1 text-xs text-gray-500">{t('arrangeCenterToPolarGrid')}</div>
              {polarGrids.map(g => (
                <button
                  key={g.id}
                  onClick={() => { centerToPolarGrid(g.id); setShowArrangeMenu(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-1.5 hover:bg-gray-600 text-left text-gray-200 text-sm ${
                    selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={selectedIds.length === 0}
                >
                  <IconPolarGrid size={14} className="text-gray-400" />
                  <span>{g.name}</span>
                </button>
              ))}
            </>
          )}

          {/* Align to Grid Horizontally */}
          {polarGrids.length <= 1 ? (
            <button
              onClick={() => { alignToGridHorizontal(); setShowArrangeMenu(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${(selectedIds.length === 0 || polarGrids.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedIds.length === 0 || polarGrids.length === 0}
            >
              <IconPolarGrid size={16} />
              <span>{t('arrangeAlignToGridH')}</span>
            </button>
          ) : (
            <>
              <div className="px-4 py-1 text-xs text-gray-500">{t('arrangeAlignToGridH')}</div>
              {polarGrids.map(g => (
                <button key={g.id} onClick={() => { alignToGridHorizontal(g.id); setShowArrangeMenu(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-1.5 hover:bg-gray-600 text-left text-gray-200 text-sm ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={selectedIds.length === 0}>
                  <IconPolarGrid size={14} className="text-gray-400" /><span>{g.name}</span>
                </button>
              ))}
            </>
          )}

          {/* Align to Grid Vertically */}
          {polarGrids.length <= 1 ? (
            <button
              onClick={() => { alignToGridVertical(); setShowArrangeMenu(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${(selectedIds.length === 0 || polarGrids.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={selectedIds.length === 0 || polarGrids.length === 0}
            >
              <IconPolarGrid size={16} />
              <span>{t('arrangeAlignToGridV')}</span>
            </button>
          ) : (
            <>
              <div className="px-4 py-1 text-xs text-gray-500">{t('arrangeAlignToGridV')}</div>
              {polarGrids.map(g => (
                <button key={g.id} onClick={() => { alignToGridVertical(g.id); setShowArrangeMenu(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-1.5 hover:bg-gray-600 text-left text-gray-200 text-sm ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={selectedIds.length === 0}>
                  <IconPolarGrid size={14} className="text-gray-400" /><span>{g.name}</span>
                </button>
              ))}
            </>
          )}

          <div className="border-t border-gray-600 my-1"></div>

          {/* Array section — all three array types together */}
          <div className="px-3 py-1 text-xs text-gray-400 font-semibold">{t('arrangeArrayHeader')}</div>

          <button
            onClick={() => {
              const linked = selectedIds.length > 0 ? (() => {
                const els = elements.filter(e => selectedIds.includes(e.id));
                const gid = els[0]?.polarRotationGridId;
                return gid && els.every(e => e.polarRotationGridId === gid) ? gid : null;
              })() : null;
              setPolarArrayPivotId(linked || (polarGrids.length > 0 ? polarGrids[0].id : 'selection'));
              setPolarArrayCount(6);
              setPolarArrayAngle(360);
              setShowPolarArrayDialog(true);
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={selectedIds.length === 0}
          >
            <IconPolarGrid size={16} />
            <span>{t('arrangePolarArray')}</span>
          </button>

          <button
            onClick={() => {
              setLinearArrayCount(4);
              setLinearArrayAngle(0);
              setLinearArraySpacing(100);
              setLinearArrayRotStep(0);
              setLinearArrayCreateGhosts(false);
              setShowLinearArrayDialog(true);
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={selectedIds.length === 0}
          >
            <IconCopy size={16} />
            <span>{t('arrangeLinearArray')}</span>
          </button>

          <button
            onClick={() => {
              setSpiralArrayCount(8);
              setSpiralArrayType('archimedean');
              setSpiralArrayGap(40);
              setSpiralArrayGrowth(1.2);
              setSpiralArrayRotate(true);
              setShowSpiralArrayDialog(true);
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={selectedIds.length === 0}
          >
            <IconCopy size={16} />
            <span>{t('arrangeSpiralArray')}</span>
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Array Manager */}
          <button
            onClick={() => { 
              setShowArrayManager(!showArrayManager);
              setShowArrangeMenu(false); 
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span>👻</span>
            <span>Ghost Array Manager</span>
          </button>
        </div>
      </>
    )}

    {/* TEST MODAL - Inline to verify rendering */}
    {showArrayManager && (
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2147483647 }}>
        <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 flex flex-col"
          style={{ width: 'min(500px, 95vw)', maxHeight: '85dvh' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-600 flex-shrink-0">
            <h2 className="text-gray-100 font-bold text-lg">👻 Ghost Array Manager</h2>
            <button onClick={() => setShowArrayManager(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
          </div>
          <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1" style={{minHeight:0}}>
            {(() => {
              const ghostArrays = (() => {
                const map = new Map();
                elements.filter(el => el.isGhost).forEach(el => {
                  const sourceId = el.ghostSourceId || 'unknown';
                  if (!map.has(sourceId)) map.set(sourceId, []);
                  map.get(sourceId).push(el);
                });
                return Array.from(map.entries());
              })();
              if (ghostArrays.length === 0) {
                return <p className="text-gray-400 text-sm text-center py-8">No ghost arrays — create one from the Arrange menu</p>;
              }
              return ghostArrays.map(([sourceId, ghosts], idx) => (
                <div key={sourceId + idx} className="flex flex-wrap items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                  <span className="text-2xl flex-shrink-0">👻</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{ghosts.length} ghost{ghosts.length > 1 ? 's' : ''}</div>
                    <div className="text-gray-400 text-xs">Source: {sourceId.slice(0, 8)}...</div>
                  </div>
                  <button onClick={() => { setSelectedIds(ghosts.map(g => g.id)); setShowArrayManager(false); }} className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded">Select</button>
                  <button onClick={() => { setElements(prev => prev.map(el => ghosts.find(g => g.id === el.id) ? { ...el, isGhost: false, ghostSourceId: null } : el)); }} className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded">Convert</button>
                  <button onClick={() => { setElements(prev => prev.filter(el => !ghosts.find(g => g.id === el.id))); }} className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded">✕</button>
                </div>
              ));
            })()}
          </div>
          <div className="px-5 pb-4 flex-shrink-0">
            <p className="text-xs text-gray-500">Manage ghost arrays created by Polar/Linear Array.</p>
          </div>
        </div>
      </div>
    )}
    

    {/* View dropdown menu - rendered at top level to avoid clipping */}
    {showViewMenu && (
      <>
        {/* Click overlay to close menu */}
        <div
          className="fixed inset-0"
          style={{ zIndex: 9998, pointerEvents: 'auto' }}
          onClick={() => setShowViewMenu(false)}
        ></div>

        {/* Dropdown menu */}
        <div
          className="fixed bg-gray-700 rounded shadow-xl min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = viewButtonRef.current?.getBoundingClientRect();
            const menuWidth = 200;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              backgroundColor: '#374151',
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              maxHeight: '80vh',
              overflowY: 'auto',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
              pointerEvents: 'auto',
            };
          })()}
        >
          {/* Fit View — top of menu */}
          <button
            onClick={() => { fitAllElements(); setShowViewMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconFitView size={16} />
            <span>{t('viewFitView')}</span>
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Realistic / Schematic toggle */}
          <button
            onClick={() => {
              handleSetRenderMode(renderMode === 'schematic' ? 'realistic' : 'schematic');
              setShowViewMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span>{renderMode === 'schematic' ? <IconRenderRealistic size={16} /> : <IconRenderSchematic size={16} />}</span>
            <span>{renderMode === 'schematic' ? t('viewSwitchRealistic') : t('viewSwitchSchematic')}</span>
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Tatting Order mode */}
          <button
            onClick={() => {
              setActiveMode('tattingOrder');
              setCurrentTool('select');
              setSelectedIds([]);
              setTattingOrderInput('');
              setShowViewMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconUnnumberedOn size={16} />
            <span>{t('viewTattingOrder')}</span>
          </button>

          {/* Show/Hide Invalid Notation */}
          <button
            onClick={() => {
              setShowInvalidNotation(!showInvalidNotation);
              setShowViewMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            {showInvalidNotation ? <IconInvalidOff size={16} /> : <IconInvalidOn size={16} />}
            <span>{showInvalidNotation ? t('viewHideInvalidNotation') : t('viewShowInvalidNotation')}</span>
          </button>

          {/* Show/Hide Editing Artifacts */}
          <button
            onClick={() => {
              setShowEditingArtifacts(!showEditingArtifacts);
              setShowViewMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            {showEditingArtifacts ? <IconInvalidOff size={16} /> : <IconInvalidOn size={16} />}
            <span>{showEditingArtifacts ? t('viewHideEditingArtifacts') : t('viewShowEditingArtifacts')}</span>
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Background Color */}
          <button
            onClick={() => {
              const next = BG_COLORS[(BG_COLORS.indexOf(bgColor) + 1) % BG_COLORS.length];
              localStorage.setItem('tcad_bg_color', next);
              setBgColor(next);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <div className="w-4 h-4 rounded border border-gray-500" style={{ backgroundColor: bgColor }}></div>
            <span>{t('optionsBgColor')}</span>
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => {
              setGridEnabled(!gridEnabled);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            {gridEnabled ? <IconGridOff size={16} /> : <IconGridOn size={16} />}
            <span>{t('optionsGrid')}</span>
          </button>
        </div>
      </>
    )}

    {/* Options dropdown menu - rendered at top level to avoid clipping */}
    {showOptionsMenu && (
      <>
        {/* Click overlay to close menu */}
        <div 
          className="fixed inset-0"
          style={{ zIndex: 9998, pointerEvents: 'auto' }}
          onClick={() => setShowOptionsMenu(false)}
        ></div>
        
        {/* Dropdown menu */}
        <div 
          className="fixed bg-gray-700 rounded shadow-xl min-w-[200px] max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = optionsButtonRef.current?.getBoundingClientRect();
            const menuWidth = 200;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              backgroundColor: '#374151',
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
              pointerEvents: 'auto',
            };
          })()}
        >
          {/* Materials Manager */}
          <button
            onClick={() => { setShowMaterialsPanel(true); setShowOptionsMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span>{t('viewMaterials')}</span>
          </button>

          {/* Thread Properties */}
          <button
            onClick={() => { setShowThreadProperties(true); setShowOptionsMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span>{t('viewThreadProperties')}</span>
          </button>

          {/* Bead Library */}
          <button
            onClick={() => { setShowBeadLibrary(true); setShowOptionsMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span>{t('viewBeadLibrary')}</span>
          </button>

          {/* Polar Grids */}
          <button
            onClick={() => { setShowPolarGridPanel(true); setShowOptionsMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span>{t('viewPolarGrids')}</span>
          </button>

          {/* Notation Font Size */}
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-200 text-sm">{t('optionsNotationSize')}</span>
            </div>
            <div className="flex gap-1">
              {(['small', 'medium', 'large']).map(size => (
                <button
                  key={size}
                  onClick={() => setNotationFontSize(size)}
                  className={`flex-1 py-1 rounded text-xs font-medium ${
                    notationFontSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {size === 'small' ? t('optionsSizeSmall') : size === 'medium' ? t('optionsSizeMedium') : t('optionsSizeLarge')}
                </button>
              ))}
            </div>
          </div>
          {/* UI Scale */}
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-200 text-sm">{t('viewUIScale')}</span>
            </div>
            <div className="flex gap-1">
              {(['normal', 'large'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { localStorage.setItem('tcad_ui_scale', s); setUiScale(s); }}
                  className={`flex-1 py-1 rounded text-xs font-medium ${
                    uiScale === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {s === 'normal' ? t('uiScaleNormal') : t('uiScaleLarge')}
                </button>
              ))}
            </div>
          </div>

          {/* Snap Toggle */}
          <button
            onClick={() => {
              setSnapEnabled(!snapEnabled);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span>{t('optionsSnap')}</span>
            <span className="ml-auto">{snapEnabled ? <IconSnapOn size={16} /> : <IconSnapOff size={16} />}</span>
          </button>

          {/* Language — only show if more than one language is available */}
          {Object.keys(availableLanguages).length > 1 && (
            <>
              <div className="border-t border-gray-600 my-1"></div>
              <div className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <IconLanguage size={16} />
                  <span className="text-gray-200 text-sm">{t('languagePickerLabel')}</span>
                </div>
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    localStorage.setItem('tcad_language', e.target.value);
                  }}
                  className="mt-1 w-full bg-gray-600 text-white text-sm rounded px-2 py-1 border border-gray-500"
                  style={{ cursor: 'pointer' }}
                >
                  {Object.entries(availableLanguages).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {/* Theme */}
          <div className="border-t border-gray-600 my-1"></div>
          <button
            onClick={() => { setShowOptionsMenu(false); themeInputRef.current?.click(); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <IconLoad size={16} />
            <span>{t('viewLoadTheme')}</span>
          </button>
          <button
            onClick={() => { setTheme(DEFAULT_THEME); setShowOptionsMenu(false); showLoadMsg('success', t('themeResetSuccess')); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span className="text-base">↩️</span>
            <span>{t('viewResetTheme')}</span>
          </button>
          <div className="px-4 py-1 pb-2">
            <p className="text-gray-500 text-xs">{t('viewThemeHint')}</p>
          </div>

        </div>
      </>
    )}
    {/* ── Materials Manager Panel ─────────────────────────────── */}
    {showMaterialsPanel && (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-60" style={{zIndex:10000}} onClick={() => setShowMaterialsPanel(false)} />
        <div className="fixed bg-gray-800 rounded-xl shadow-2xl border border-gray-600 flex flex-col"
          style={{backgroundColor:'#1f2937', zIndex:10001, top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(420px, 95vw)', maxHeight:'85dvh'}}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-600 flex-shrink-0">
            <h2 className="text-gray-100 font-bold text-lg">{t('materialsTitle')}</h2>
            <button onClick={() => setShowMaterialsPanel(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
          </div>

          <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1" style={{minHeight:0}}>
            {materials.map((mat, idx) => (
              <div key={mat.id} className="flex flex-wrap items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                {/* Color swatch / picker trigger */}
                <div
                  className="w-8 h-8 rounded border-2 border-gray-500 cursor-pointer flex-shrink-0 hover:border-white relative overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: mat.isGradient ? getGradientColorAtPosition(mat.color, 0.5) : mat.color }}
                  title={t('clickToChangeColor')}
                  onClick={() => {
                    setPickerColor(mat.isGradient ? '#FFFFFF' : mat.color);
                    setColorPickerTab('picker');
                    setShowColorPicker(true);
                    setPickerCallback(() => (color) => {
                      setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, color, isGradient: false } : m));
                    });
                    setPickerGradientCallback(() => (gradientId) => {
                      setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, color: gradientId, isGradient: true } : m));
                    });
                  }}
                >
                  {mat.isGradient && <span style={{ fontSize:'11px', fontWeight:'bold', color:'white', textShadow:'0 0 3px black,0 0 3px black', lineHeight:1, pointerEvents:'none' }}>G</span>}
                </div>

                {/* Name input */}
                <input
                  type="text"
                  value={mat.name}
                  disabled={mat.id === 'default'}
                  onChange={(e) => setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, name: e.target.value } : m))}
                  className="flex-1 min-w-0 bg-gray-600 text-white px-2 py-1 rounded text-sm border border-gray-400 focus:border-blue-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{minWidth:'80px'}}
                />

                {/* Count badge */}
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {elements.filter(el => (el.materialId || 'default') === mat.id || (el.isSplitRing && (el.materialIdB || el.materialId || 'default') === mat.id)).length}×
                </span>

                {/* Select all */}
                <button
                  onClick={() => {
                    const ids = elements.filter(el => (el.materialId || 'default') === mat.id || (el.isSplitRing && (el.materialIdB || el.materialId || 'default') === mat.id)).map(el => el.id);
                    setSelectedIds(ids);
                    setShowMaterialsPanel(false);
                  }}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded flex-shrink-0"
                  title={t('selectAllWithMaterial')}
                >
                  {t('materialsSelectAll')}
                </button>

                {/* Delete (not for default) */}
                {mat.id !== 'default' && (
                  <button
                    onClick={() => {
                      setMaterials(prev => prev.filter((_, i) => i !== idx));
                      setElements(prev => prev.map(el => el.materialId === mat.id ? { ...el, materialId: 'default' } : el));
                    }}
                    className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded flex-shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add button — always visible, outside the scroll area */}
          {materials.length < 15 && (
            <div className="px-5 pt-2 pb-3 flex-shrink-0">
              <button
                onClick={() => {
                  const id = `mat_${Date.now()}`;
                  setMaterials(prev => [...prev, { id, name: `${t('materialNewName')} ${prev.length}`, color: '#AAAAAA', isGradient: false }]);
                  if (selectedIds.length > 0) {
                    setElements(prev => prev.map(el =>
                      selectedIds.includes(el.id) ? { ...el, materialId: id } : el
                    ));
                  }
                }}
                className="w-full py-2 rounded-lg border-2 border-dashed border-gray-500 text-gray-400 hover:border-white hover:text-white text-sm"
              >
                {t('materialsAddBtn')}
              </button>
            </div>
          )}

          <div className="px-5 pb-4 flex-shrink-0">
            <p className="text-xs text-gray-500">{t('materialsHint')}</p>
          </div>
        </div>
      </>
    )}

    {/* ── Bead Library Panel ───────────────────────────────────── */}
    {showBeadLibrary && (() => {
      const SIZE_LABELS = { Y: t('beadSizeSmall'), Z: t('beadSizeMedium'), V: t('beadSizeLarge') };
      const activeBead = beadLibrary.find(b => b.id === selectedBeadId) || null;
      const updateBead = (id, changes) => setBeadLibrary(prev => prev.map(b => b.id === id ? { ...b, ...changes } : b));
      const addBead = () => {
        const id = `bead_${Date.now()}`;
        setBeadLibrary(prev => [...prev, { id, name: t('threadNewBeadName'), size: 'Y', color: '#3b82f6' }]);
        setSelectedBeadId(id);
      };
      const deleteBead = (id) => {
        setBeadLibrary(prev => prev.filter(b => b.id !== id));
        setSelectedBeadId(prev => prev === id ? (beadLibrary.find(b => b.id !== id)?.id || null) : prev);
      };

      return (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50" style={{ zIndex: 2147483644 }} onClick={() => setShowBeadLibrary(false)} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483645 }}>
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto flex flex-col sm:flex-row"
              style={{ width: 'min(680px, 95vw)', height: 'min(540px, 90vh)' }}>

              {/* Left: Bead list */}
              <div className="sm:w-48 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-600 flex flex-col" style={{ minWidth: 0 }}>
                <div className="px-3 py-3 border-b border-gray-600">
                  <span className="text-gray-100 font-semibold text-sm flex items-center gap-2"><IconBeadCore size={16} /> {t('beadLibraryPanelTitle')}</span>
                </div>
                <div className="flex-1 overflow-y-auto flex sm:flex-col flex-row">
                  {beadLibrary.map(b => (
                    <button key={b.id}
                      onClick={() => setSelectedBeadId(b.id)}
                      className={`w-full text-left px-3 text-sm flex items-center gap-2 truncate flex-shrink-0 ${b.id === selectedBeadId ? 'bg-purple-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                      style={{ minHeight: '1.75rem', maxHeight: '1.75rem' }}
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="truncate">{b.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{b.size}</span>
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-600 flex gap-1">
                  <button onClick={addBead}
                    className="flex-1 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">{t('beadAdd')}</button>
                  {activeBead && beadLibrary.length > 1 && (
                    <button onClick={() => setConfirmDialog({ message: `Delete "${activeBead.name}"?`, onConfirm: () => deleteBead(activeBead.id) })}
                      className="flex-1 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-white">{t('beadDelete')}</button>
                  )}
                </div>
              </div>

              {/* Right: Edit + size settings */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
                  {activeBead ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: activeBead.color }}
                      />
                      <input
                        className="bg-transparent text-white font-semibold text-base flex-1 min-w-0 px-2 py-0.5 rounded border border-gray-500 focus:border-purple-400 focus:bg-gray-700 outline-none transition-colors"
                        value={activeBead.name}
                        onChange={e => updateBead(activeBead.id, { name: e.target.value })}
                        placeholder="Bead name"
                        title={t('clickToRename')}
                      />
                      <span className="text-gray-500 text-xs flex-shrink-0">✎</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">{t('beadSelectPrompt')}</span>
                  )}
                  <button onClick={() => setShowBeadLibrary(false)}
                    className="text-gray-400 hover:text-white text-xl ml-4">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">

                  {/* Individual bead settings */}
                  {activeBead && (
                    <>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">{t('beadPropertiesHeader')}</div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-gray-300 text-sm w-16">{t('beadSizeLabel')}</span>
                        <div className="flex gap-1">
                          {Object.entries(SIZE_LABELS).map(([k, label]) => (
                            <button key={k}
                              onClick={() => updateBead(activeBead.id, { size: k })}
                              className={`px-3 py-1 rounded text-xs border ${activeBead.size === k ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                            >{label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-gray-300 text-sm w-16">{t('beadColorLabel')}</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full border-2 border-gray-500 cursor-pointer hover:border-white flex-shrink-0"
                            style={{ backgroundColor: activeBead.color }}
                            onClick={() => {
                              setPickerColor(activeBead.color);
                              setColorPickerTab('picker');
                              setPickerTabsAllowed(['picker']);
                              setPickerCallback(() => (color) => updateBead(activeBead.id, { color }));
                              setShowColorPicker(true);
                            }}
                            title="Click to change color"
                          />
                          <span className="text-gray-400 text-xs font-mono">{activeBead.color}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-gray-300 text-sm w-16 pt-1">{t('beadShapeLabel')}</span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { value: 'circle',        label: <span>{t('beadShapeCircle')}</span> },
                            { value: 'square',        label: <span>{t('beadShapeSquare')}</span> },
                            { value: 'rectangle',     label: <span>{t('beadShapeRectangle')}</span> },
                            { value: 'diamond',       label: <span>{t('beadShapeDiamond')}</span> },
                            { value: 'teardrop-up',   label: <span className="flex items-center gap-1"><IconShapeTeardrop size={12} /> {t('beadShapeTipOut')}</span> },
                            { value: 'teardrop-down', label: <span className="flex items-center gap-1"><span style={{display:'inline-block',transform:'scaleY(-1)'}}><IconShapeTeardrop size={12} /></span> {t('beadShapeTipIn')}</span> },
                          ].map(({ value, label }) => (
                            <button key={value}
                              onClick={() => updateBead(activeBead.id, { shape: value })}
                              className={`px-2 py-1 rounded text-xs border text-left ${(activeBead.shape || 'circle') === value ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                            >{label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-gray-600 my-3" />
                    </>
                  )}

                  {/* Global size-class settings (Y/Z/V multipliers + colors) */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">{t('beadSizeClassHeader')}</div>
                  <div className="text-xs text-gray-500 mb-3 leading-relaxed">
                    {t('beadSizeClassHint')}
                  </div>
                  {['Y', 'Z', 'V'].map(key => (
                    <div key={key} className="flex items-center gap-3 mb-3">
                      <div
                        className="w-6 h-6 rounded-full border-2 border-gray-500 cursor-pointer hover:border-white flex-shrink-0"
                        style={{ backgroundColor: beadSettings[key].color }}
                        onClick={() => {
                          setPickerColor(beadSettings[key].color);
                          setColorPickerTab('picker');
                          setPickerTabsAllowed(['picker']);
                          setPickerCallback(() => (color) => setBeadSettings(prev => ({ ...prev, [key]: { ...prev[key], color } })));
                          setShowColorPicker(true);
                        }}
                        title={t('clickToChangeSizeColor')}
                      />
                      <span className="text-white text-sm font-bold w-20">{SIZE_LABELS[key]}</span>
                      <input
                        type="number"
                        min="0.5" max="5" step="0.5"
                        value={beadSettings[key].dsMultiplier}
                        onChange={e => setBeadSettings(prev => ({ ...prev, [key]: { ...prev[key], dsMultiplier: parseFloat(e.target.value) || 1 } }))}
                        className="w-16 px-2 py-1 bg-gray-600 text-white text-xs rounded border border-gray-500 text-center"
                      />
                      <span className="text-gray-400 text-xs">{t('beadDsWidthSuffix')}</span>
                      <span className="text-gray-500 text-xs">≈ {Math.round(dsWidth * beadSettings[key].dsMultiplier)}px</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      );
    })()}

    {/* ── Polar Grid Panel ─────────────────────────────────────── */}
    {showPolarGridPanel && (() => {
      const activeGrid = polarGrids.find(g => g.id === selectedPolarGridId) || null;
      const activePreset = threadPresets.find(p => p.id === activePresetId) || threadPresets[0] || { ...DEFAULT_THREAD_PRESET };
      const corePerDs = activePreset.ds20Core / 20; // mm per DS
      const radiusToMm = (r) => (r / dsWidth) * corePerDs; // canvas units → mm

      const updateGrid = (id, changes) =>
        setPolarGrids(prev => prev.map(g => g.id === id ? { ...g, ...changes } : g));

      const updateRing = (gridId, ringId, changes) =>
        setPolarGrids(prev => prev.map(g => g.id !== gridId ? g : {
          ...g, rings: g.rings.map(r => r.id === ringId ? { ...r, ...changes } : r)
        }));

      const addGrid = () => {
        const id = generateId();
        const newGrid = {
          id, name: `Grid ${polarGrids.length + 1}`,
          center: { x: 0, y: 0 },
          angularOffset: 0,
          visible: true,
          color: '#4B9FE1',
          rings: []
        };
        setPolarGrids(prev => [...prev, newGrid]);
        setSelectedPolarGridId(id);
      };

      const deleteGrid = (id) => {
        setPolarGrids(prev => prev.filter(g => g.id !== id));
        setSelectedPolarGridId(prev => prev === id
          ? (polarGrids.find(g => g.id !== id)?.id || null) : prev);
      };

      const addRing = (gridId) => {
        const grid = polarGrids.find(g => g.id === gridId);
        if (!grid) return;
        const lastR = grid.rings.length > 0
          ? Math.max(...grid.rings.map(r => r.radius)) : 0;
        const id = generateId();
        updateGrid(gridId, {
          rings: [...grid.rings, { id, radius: lastR + 75, divisions: 8, visible: true, snap: true, angularOffset: 0 }]
        });
      };

      const deleteRing = (gridId, ringId) => {
        const grid = polarGrids.find(g => g.id === gridId);
        if (!grid) return;
        updateGrid(gridId, { rings: grid.rings.filter(r => r.id !== ringId) });
      };

      return (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50" style={{ zIndex: 2147483644, opacity: polarGridPeek ? 0 : 1, transition: 'opacity 0.15s' }} onClick={() => setShowPolarGridPanel(false)} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483645, opacity: polarGridPeek ? 0 : 1, transition: 'opacity 0.15s' }}>
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto flex flex-col sm:flex-row"
              style={{ width: 'min(820px, 95vw)', height: 'min(540px, 90vh)' }}>

              {/* Left: Grid list */}
              <div className="sm:w-48 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-600 flex flex-col" style={{ minWidth: 0 }}>
                <div className="px-3 py-3 border-b border-gray-600">
                  <span className="text-gray-100 font-semibold text-sm flex items-center gap-2"><IconPolarGrid size={16} /> {t('polarGridTitle')}</span>
                </div>
                <div className="flex-1 overflow-y-auto flex sm:flex-col flex-row">
                  {polarGrids.map(g => (
                    <button key={g.id}
                      onClick={() => setSelectedPolarGridId(g.id)}
                      className={`w-full text-left px-3 text-sm flex items-center gap-2 truncate flex-shrink-0 ${g.id === selectedPolarGridId ? 'bg-blue-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                      style={{ minHeight: '1.75rem', maxHeight: '1.75rem' }}
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500"
                        style={{ backgroundColor: g.color, opacity: g.visible ? 1 : 0.4 }} />
                      <span className="truncate">{g.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{g.rings.length}r</span>
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-600 flex gap-1">
                  <button onClick={addGrid}
                    className="flex-1 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">{t('polarGridAdd')}</button>
                  {activeGrid && (
                    <button onClick={() => setConfirmDialog({ message: `Delete "${activeGrid.name}"?`, onConfirm: () => deleteGrid(activeGrid.id) })}
                      className="flex-1 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-white">{t('polarGridDelete')}</button>
                  )}
                </div>
              </div>

              {/* Right: Grid editor */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header: name + close */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
                  {activeGrid ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Color swatch */}
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-gray-500 cursor-pointer hover:border-white"
                        style={{ backgroundColor: activeGrid.color }}
                        onClick={() => {
                          setPickerColor(activeGrid.color);
                          setColorPickerTab('picker');
                          setPickerTabsAllowed(['picker']);
                          setPickerCallback(() => (color) => updateGrid(activeGrid.id, { color }));
                          setShowColorPicker(true);
                        }}
                        title={t('polarGridColorLabel')}
                      />
                      {/* Opacity slider */}
                      <input
                        type="range" min={0.05} max={1} step={0.05}
                        value={activeGrid.opacity ?? 0.5}
                        onChange={e => updateGrid(activeGrid.id, { opacity: parseFloat(e.target.value) })}
                        className="w-20 accent-blue-400"
                        title={t('polarGridOpacityLabel')}
                      />
                      <span className="text-xs text-gray-400 w-7 text-right flex-shrink-0">
                        {Math.round((activeGrid.opacity ?? 0.5) * 100)}%
                      </span>
                      <input
                        className="bg-transparent text-white font-semibold text-base flex-1 min-w-0 px-2 py-0.5 rounded border border-gray-500 focus:border-purple-400 focus:bg-gray-700 outline-none transition-colors"
                        value={activeGrid.name}
                        onChange={e => updateGrid(activeGrid.id, { name: e.target.value })}
                        placeholder={t('polarGridNamePlaceholder')}
                      />
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">{t('polarGridSelectPrompt')}</span>
                  )}
                  <button onClick={() => setShowPolarGridPanel(false)}
                    className="text-gray-400 hover:text-white text-xl ml-4">✕</button>
                  <button
                    onMouseDown={() => setPolarGridPeek(true)}
                    onMouseUp={() => setPolarGridPeek(false)}
                    onMouseLeave={() => setPolarGridPeek(false)}
                    onTouchStart={() => setPolarGridPeek(true)}
                    onTouchEnd={() => setPolarGridPeek(false)}
                    className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 ml-1"
                    title={t('polarGridPeekHint')}
                  >👁 {t('polarGridPeekHint')}</button>
                </div>

                {/* Body */}
                {activeGrid && (
                  <div className="flex-1 overflow-y-auto px-4 py-3">

                    {/* Grid-level settings */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
                      {/* Visibility */}
                      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                        <input type="checkbox" checked={activeGrid.visible}
                          onChange={e => updateGrid(activeGrid.id, { visible: e.target.checked })}
                          className="w-4 h-4 accent-blue-500" />
                        Visible
                      </label>
                      {/* Angular offset */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">{t('polarGridOffsetLabel')}</span>
                        <input type="number" min={0} max={359} step={1}
                          value={activeGrid.angularOffset || 0}
                          onChange={e => updateGrid(activeGrid.id, { angularOffset: parseFloat(e.target.value) || 0 })}
                          className="w-16 px-2 py-0.5 bg-gray-600 border border-gray-500 rounded text-sm text-white text-right outline-none focus:border-blue-400"
                        />
                      </div>
                      {/* Center X/Y */}
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs">{t('polarGridCenterLabel')}</span>
                        <input type="number" step={1}
                          value={Math.round(activeGrid.center.x)}
                          onChange={e => updateGrid(activeGrid.id, { center: { ...activeGrid.center, x: parseFloat(e.target.value) || 0 } })}
                          className="w-16 px-2 py-0.5 bg-gray-600 border border-gray-500 rounded text-sm text-white text-right outline-none focus:border-blue-400"
                          title="X"
                        />
                        <input type="number" step={1}
                          value={Math.round(activeGrid.center.y)}
                          onChange={e => updateGrid(activeGrid.id, { center: { ...activeGrid.center, y: parseFloat(e.target.value) || 0 } })}
                          className="w-16 px-2 py-0.5 bg-gray-600 border border-gray-500 rounded text-sm text-white text-right outline-none focus:border-blue-400"
                          title="Y"
                        />
                        <button
                          onClick={() => updateGrid(activeGrid.id, { center: { x: 0, y: 0 } })}
                          className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600"
                          title={t('polarGridResetCenter')}
                        >⌖</button>
                      </div>
                    </div>

                    {/* Ring list */}
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('polarGridRingsHeader')}</div>
                    <p className="text-xs text-gray-500 mb-2 italic">
                      Real-world sizes based on <span className="text-gray-400">{activePreset.name}</span> — change in Thread Properties.
                    </p>

                    {activeGrid.rings.length === 0 && (
                      <p className="text-gray-500 text-xs mb-3">No rings yet. Add one below.</p>
                    )}

                    <div className="space-y-1 mb-3">
                      {activeGrid.rings.map((ring, idx) => (
                        <div key={ring.id} className="flex items-center gap-2 bg-gray-700 rounded px-2 py-1.5">
                          {/* Ring index */}
                          <span className="text-gray-500 text-xs w-4 flex-shrink-0">{idx + 1}</span>
                          {/* Radius */}
                          <span className="text-gray-400 text-xs flex-shrink-0">{t('polarGridRadiusLabel')}</span>
                          <input type="number" min={1} step={5}
                            value={ring.radius}
                            onChange={e => updateRing(activeGrid.id, ring.id, { radius: Math.max(1, parseFloat(e.target.value) || 1) })}
                            className="w-16 px-1 py-0.5 bg-gray-600 border border-gray-500 rounded text-xs text-white text-right outline-none focus:border-blue-400 flex-shrink-0"
                          />
                          <span className="text-gray-500 text-xs flex-shrink-0" title="Approximate real-world radius">
                            ~{radiusToMm(ring.radius) < 10
                              ? radiusToMm(ring.radius).toFixed(1)
                              : Math.round(radiusToMm(ring.radius))} mm
                          </span>
                          {/* Divisions */}
                          <span className="text-gray-400 text-xs flex-shrink-0">{t('polarGridDivisionsLabel')}</span>
                          <input type="number" min={1} max={360} step={1}
                            value={ring.divisions}
                            onChange={e => updateRing(activeGrid.id, ring.id, { divisions: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-14 px-1 py-0.5 bg-gray-600 border border-gray-500 rounded text-xs text-white text-right outline-none focus:border-blue-400 flex-shrink-0"
                          />
                          {/* Per-ring angular offset */}
                          <span className="text-gray-400 text-xs flex-shrink-0" title="Additional angular offset for this ring only (degrees)">⟳°</span>
                          <input type="number" min={-359} max={359} step={1}
                            value={ring.angularOffset || 0}
                            onChange={e => updateRing(activeGrid.id, ring.id, { angularOffset: parseFloat(e.target.value) || 0 })}
                            className="w-14 px-1 py-0.5 bg-gray-600 border border-gray-500 rounded text-xs text-white text-right outline-none focus:border-blue-400 flex-shrink-0"
                            title="Ring offset (degrees, added on top of global grid offset)"
                          />
                          {/* Visible toggle */}
                          <button
                            onClick={() => updateRing(activeGrid.id, ring.id, { visible: !ring.visible })}
                            className={`px-1 py-0.5 rounded text-xs border flex-shrink-0 ${ring.visible ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                            title="Toggle visibility"
                          >{ring.visible ? <IconEyeOn size={14} /> : <IconEyeOff size={14} />}</button>
                          {/* Snap toggle */}
                          <button
                            onClick={() => updateRing(activeGrid.id, ring.id, { snap: !ring.snap })}
                            className={`px-1 py-0.5 rounded text-xs border flex-shrink-0 ${ring.snap ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                            title="Toggle snap"
                          >{ring.snap ? <IconSnapOn size={14} /> : <IconSnapOff size={14} />}</button>
                          {/* Delete ring */}
                          <button
                            onClick={() => deleteRing(activeGrid.id, ring.id)}
                            className="ml-auto px-1.5 py-0.5 rounded text-xs bg-red-900 hover:bg-red-800 text-red-300 border border-red-800 flex-shrink-0"
                          >✕</button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addRing(activeGrid.id)}
                      className="w-full py-1.5 rounded border-2 border-dashed border-gray-600 text-gray-400 hover:border-white hover:text-white text-xs"
                    >{t('polarGridAddRing')}</button>

                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      );
    })()}

    {/* ── Thread Properties Panel ─────────────────────────────── */}
    {showThreadProperties && (() => {
      const activePreset = threadPresets.find(p => p.id === activePresetId) || threadPresets[0] || { ...DEFAULT_THREAD_PRESET };
      const updatePreset = (id, changes) => {
        setThreadPresets(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
        localStorage.setItem('tcad_thread_presets', JSON.stringify(
          threadPresets.map(p => p.id === id ? { ...p, ...changes } : p)
        ));
      };
      const selectPreset = (id) => {
        setActivePresetId(id);
        localStorage.setItem('tcad_active_preset_id', id);
      };
      const addPreset = () => {
        const newId = 'preset_' + Date.now();
        const newPreset = { ...DEFAULT_THREAD_PRESET, id: newId, name: t('threadPresetNewName') };
        const updated = [...threadPresets, newPreset];
        setThreadPresets(updated);
        setActivePresetId(newId);
        localStorage.setItem('tcad_thread_presets', JSON.stringify(updated));
        localStorage.setItem('tcad_active_preset_id', newId);
      };
      const deletePreset = (id) => {
        if (threadPresets.length <= 1) return;
        const updated = threadPresets.filter(p => p.id !== id);
        setThreadPresets(updated);
        const newActive = updated[0].id;
        setActivePresetId(newActive);
        localStorage.setItem('tcad_thread_presets', JSON.stringify(updated));
        localStorage.setItem('tcad_active_preset_id', newActive);
      };

      return (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50" style={{ zIndex: 2147483640 }} onClick={() => setShowThreadProperties(false)} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483641 }}>
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto flex flex-col sm:flex-row"
              style={{ width: 'min(700px, 95vw)', maxHeight: '85vh', overflowY: 'auto' }}>

              {/* Left: Preset list */}
              <div className="sm:w-48 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-600 flex flex-col" style={{ minWidth: 0 }}>
                <div className="px-3 py-3 border-b border-gray-600">
                  <span className="text-gray-100 font-semibold text-sm">{t('threadPresetsTitle')}</span>
                </div>
                <div className="flex-1 overflow-y-auto sm:overflow-y-auto overflow-x-auto sm:overflow-x-hidden flex sm:flex-col flex-row">
                  {threadPresets.map(p => (
                    <button key={p.id}
                      onClick={() => selectPreset(p.id)}
                      className={`w-full text-left px-3 text-sm truncate flex items-center flex-shrink-0 ${p.id === activePresetId ? 'bg-blue-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                      style={{ minHeight: '1.75rem', maxHeight: '1.75rem' }}
                    >{p.id === activePresetId ? '▶ ' : ''}{p.name}</button>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-600 flex gap-1">
                  <button onClick={addPreset}
                    className="flex-1 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">{t('threadPresetAdd')}</button>
                  {threadPresets.length > 1 && (
                    <button onClick={() => setConfirmDialog({ message: `Delete "${activePreset.name}"?`, onConfirm: () => deletePreset(activePresetId) })}
                      className="flex-1 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-white">{t('threadPresetDelete')}</button>
                  )}
                </div>
              </div>

              {/* Right: Edit form */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
                  <input
                    className="bg-transparent text-white font-semibold text-base flex-1 min-w-0 px-2 py-0.5 rounded border border-gray-500 focus:border-purple-400 focus:bg-gray-700 outline-none transition-colors"
                    value={activePreset.name}
                    onChange={e => updatePreset(activePreset.id, { name: e.target.value })}
                    placeholder="Preset name"
                  />
                  <button onClick={() => setShowThreadProperties(false)}
                    className="text-gray-400 hover:text-white text-xl ml-4">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">

                  {/* Core measurements */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('threadMeasurementsHeader')}</div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ThreadPropertiesNumInput label={t('thread20DSWorking')} value={activePreset.ds20Working}
                      onChange={v => updatePreset(activePreset.id, { ds20Working: v })} />
                    <ThreadPropertiesNumInput label={t('thread20DSCore')} value={activePreset.ds20Core}
                      onChange={v => updatePreset(activePreset.id, { ds20Core: v })} />
                  </div>

                  <div className="border-t border-gray-600 my-3" />

                  {/* Picot lengths */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('threadPicotLengthsHeader')}</div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ThreadPropertiesNumInput label={t('threadRegularPicotLabel')} value={activePreset.picotRegular}
                      onChange={v => updatePreset(activePreset.id, { picotRegular: v })} />
                    <ThreadPropertiesNumInput label={t('threadJoinedPicotLabel')} value={activePreset.picotJoined}
                      onChange={v => updatePreset(activePreset.id, { picotJoined: v })} />
                    <ThreadPropertiesNumInput label={t('threadLongPicotLabel')} value={activePreset.picotRegular * 2} readOnly hint={t('threadLongPicotHint')} />
                    <ThreadPropertiesNumInput label={t('threadShortPicotLabel')} value={activePreset.picotShort ?? activePreset.picotRegular * 0.5} readOnly hint={activePreset.picotShort ? t('threadShortPicotHintSample') : t('threadShortPicotHintAuto')} />
                  </div>

                  <div className="border-t border-gray-600 my-3" />

                  {/* Alternative calculation */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{t('threadAltCalcHeader')}</div>
                    <span className="text-xs bg-yellow-700 text-yellow-200 px-1.5 py-0.5 rounded font-medium">{t('threadAltBadge')}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3 leading-relaxed">
                    {t('threadAltSampleHint')}
                  </div>

                  {/* Alternative sample inputs */}
                  <div className="grid grid-cols-2 gap-x-4">
                    <ThreadPropertiesNumInput
                      label={t('threadSampleRegularLabel')}
                      value={activePreset.sample20DS10Regular ?? ''}
                      onChange={v => {
                        const picotR = Math.round((v - activePreset.ds20Working) / 10 * 10) / 10;
                        updatePreset(activePreset.id, { sample20DS10Regular: v, picotRegular: picotR > 0 ? picotR : activePreset.picotRegular });
                      }}
                      hint={activePreset.sample20DS10Regular ? `→ regular picot = ${Math.round((activePreset.sample20DS10Regular - activePreset.ds20Working) / 10 * 10) / 10} mm` : t('threadOptional')}
                    />
                    <ThreadPropertiesNumInput
                      label={t('threadSampleShortLabel')}
                      value={activePreset.sample20DS10Short ?? ''}
                      onChange={v => {
                        const picotSh = Math.round((v - activePreset.ds20Working) / 10 * 10) / 10;
                        updatePreset(activePreset.id, { sample20DS10Short: v, picotShort: picotSh > 0 ? picotSh : undefined });
                      }}
                      hint={activePreset.sample20DS10Short ? `→ short picot = ${Math.round((activePreset.sample20DS10Short - activePreset.ds20Working) / 10 * 10) / 10} mm` : t('threadOptional')}
                    />
                  </div>

                  <div className="border-t border-gray-600 my-3" />

                  {/* Calculated summary */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('threadPerStitchHeader')}</div>
                  <div className="bg-gray-700 rounded p-3 text-xs text-gray-300 space-y-1 font-mono">
                    <div>{t('threadWorkingPerDS')} = {(activePreset.ds20Working / 20).toFixed(2)} mm</div>
                    <div>{t('threadWorkingPerSS')} = {(activePreset.ds20Working / 40).toFixed(2)} mm</div>
                    <div>{t('threadCorePerDS')} = {(activePreset.ds20Core / 20).toFixed(2)} mm</div>
                    <div className="pt-1 border-t border-gray-600">{t('threadRegularPicot')} = {activePreset.picotRegular} mm</div>
                    <div>{t('threadLongPicot')} = {(activePreset.picotRegular * 2).toFixed(1)} mm</div>
                    <div>{t('threadShortPicot')} = {(activePreset.picotShort ?? activePreset.picotRegular * 0.5).toFixed(1)} mm{activePreset.picotShort ? ` ${t('threadFromSample')}` : ` ${t('threadHalfRegular')}`}</div>
                    <div>{t('threadJoinedPicot')} = {activePreset.picotJoined} mm</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    })()}

    {/* ── Splash Screen ────────────────────────────────────────── */}
    {/* ── Full welcome splash ───────────────────────────────────── */}
    {showSplash && (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-75"
          style={{ zIndex: 2147483630 }}
          onClick={() => setShowSplash(false)}
        />
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 2147483631 }}
        >
          <div
            className="bg-gray-900 rounded-xl shadow-2xl pointer-events-auto overflow-hidden"
            style={{ width: 'min(380px, 92vw)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Row 1: Logo */}
            {updateReminderDue && !showUpdatePopup ? (
              <button
                onClick={() => setShowUpdatePopup(true)}
                className="w-full relative overflow-hidden group"
                style={{ aspectRatio: '3/1' }}
                title="Click to see update options"
              >
                <img src={logoUrl} alt="TattingCAD" className="w-full h-full object-cover opacity-30" draggable={false} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-900 bg-opacity-60">
                  <div className="text-blue-300 text-sm font-semibold">{t('splashUpdateOverlayTitle')}</div>
                  <div className="text-gray-400 text-xs">{t('splashUpdateOverlayBody').replace('{version}', APP_VERSION)}</div>
                </div>
              </button>
            ) : (
              <div style={{ aspectRatio: '3/1' }}>
                <img src={logoUrl} alt="TattingCAD" className="w-full h-full object-cover" draggable={false} />
              </div>
            )}

            {/* 2×2 button grid */}
            <div className="grid grid-cols-2 gap-1.5 px-3 py-3">
              <button
                onClick={() => setShowSplash(false)}
                className="py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
              >{t('splashNewProject')}</button>

              <button
                onClick={() => { setShowSplash(false); setTimeout(() => setShowRecentProjectsDialog(true), 50); }}
                className="py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold transition-colors"
              >{t('splashLoadProject')}</button>

              <button
                onClick={() => { loadFromAutosave(); setShowSplash(false); }}
                disabled={!splashAutosave}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                  splashAutosave
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
                title={splashAutosave ? `${splashAutosave.name} — ${splashAutosave.date}` : t('splashNoAutosave')}
              >
                {splashAutosave ? t('splashResume').replace('{name}', splashAutosave.name) : t('splashNoAutosave')}
              </button>

              <button
                onClick={() => { setShowSplash(false); setShowHelp(true); }}
                className="py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 text-xs font-semibold transition-colors"
              >{t('splashGettingStarted')}</button>
            </div>

            {/* Navigable tips strip */}
            <div className="flex items-center gap-2 px-3 pb-3">
              <button
                onClick={() => setSplashTipIndex(i => (i - 1 + SPLASH_TIP_KEYS.length) % SPLASH_TIP_KEYS.length)}
                className="text-gray-500 hover:text-gray-300 text-sm leading-none flex-shrink-0 px-1"
                title={t('splashTipPrev')}
              >‹</button>
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 min-h-[2.5rem] flex items-center">
                <span className="text-gray-400 text-xs leading-relaxed">{t(SPLASH_TIP_KEYS[splashTipIndex])}</span>
              </div>
              <button
                onClick={() => setSplashTipIndex(i => (i + 1) % SPLASH_TIP_KEYS.length)}
                className="text-gray-500 hover:text-gray-300 text-sm leading-none flex-shrink-0 px-1"
                title={t('splashTipNext')}
              >›</button>
            </div>
          </div>
        </div>

        {/* Update popup */}
        {showUpdatePopup && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483632 }}>
            <div
              className="bg-gray-800 border border-blue-700 rounded-xl shadow-2xl pointer-events-auto px-5 py-4 flex flex-col gap-3"
              style={{ width: 'min(300px, 88vw)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-white text-sm font-semibold">{t('splashUpdatePopupTitle')}</div>
              <div className="text-gray-400 text-xs leading-relaxed">
                {t('splashUpdatePopupBody').replace('{version}', APP_VERSION)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openExternal('https://github.com/SavarosaCraft/TattingCad/releases/latest')}
                  className="flex-1 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold"
                >{t('splashUpdatePopupOpen')}</button>
                <button
                  onClick={() => { localStorage.setItem('tcad_update_seen', APP_VERSION); setShowUpdatePopup(false); }}
                  className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs"
                >{t('splashUpdatePopupDismiss')}</button>
              </div>
            </div>
          </div>
        )}
      </>
    )}

    {/* ── Polar Array Dialog ────────────────────────────────────── */}
    {showPolarArrayDialog && (
      <>
        {/* Backdrop — clicking it closes */}
        <div
          className="fixed inset-0 bg-black bg-opacity-60"
          style={{ zIndex: 2147483640, opacity: polarArrayPeek ? 0 : 1, transition: 'opacity 0.15s' }}
          onClick={() => setShowPolarArrayDialog(false)}
        />

        {/* Dialog panel */}
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 2147483641, opacity: polarArrayPeek ? 0 : 1, transition: 'opacity 0.15s' }}
        >
          <div
            className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto flex flex-col gap-4 p-5"
            style={{ width: 'min(340px, 92vw)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Title */}
            <div className="text-white font-semibold text-base">{t('polarArrayTitle')}</div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('polarArrayCount')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={72}
                  value={polarArrayCount}
                  onChange={e => setPolarArrayCount(Math.max(2, Math.min(72, parseInt(e.target.value) || 2)))}
                  className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
                {/* Quick-pick buttons */}
                {[4, 6, 8, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setPolarArrayCount(n)}
                    className={`px-2 py-1 rounded text-xs ${polarArrayCount === n ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                  >{n}</button>
                ))}
              </div>
            </div>

            {/* Fill angle */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('polarArrayAngle')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={polarArrayAngle}
                  onChange={e => setPolarArrayAngle(Math.max(1, Math.min(360, parseInt(e.target.value) || 360)))}
                  className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
                <button
                  onClick={() => setPolarArrayAngle(360)}
                  className={`px-2 py-1 rounded text-xs ${polarArrayAngle === 360 ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                >360°</button>
                <button
                  onClick={() => setPolarArrayAngle(180)}
                  className={`px-2 py-1 rounded text-xs ${polarArrayAngle === 180 ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                >180°</button>
              </div>
            </div>

            {/* Pivot */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('polarArrayPivot')}</label>
              <select
                value={polarArrayPivotId || 'selection'}
                onChange={e => setPolarArrayPivotId(e.target.value)}
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value="selection">{t('polarArrayPivotSelection')}</option>
                {polarGrids.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Create as ghosts checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="polar-ghosts"
                checked={polarArrayCreateGhosts}
                onChange={e => setPolarArrayCreateGhosts(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="polar-ghosts" className="text-sm text-gray-300">Create as ghosts</label>
            </div>

            {/* Step preview text */}
            <div className="text-xs text-gray-400 text-center">
              {polarArrayCount} copies · every {(polarArrayAngle / polarArrayCount).toFixed(1)}° · over {polarArrayAngle}°
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  executePolarArray(polarArrayCount, polarArrayAngle, polarArrayPivotId, polarArrayCreateGhosts);
                  setShowPolarArrayDialog(false);
                  setPolarArrayCreateGhosts(false);
                }}
                className="flex-1 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold"
              >{t('polarArrayApply')}</button>
              <button
                onClick={() => setShowPolarArrayDialog(false)}
                className="flex-1 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm"
              >{t('confirmCancel')}</button>
            </div>

            {/* Peek button */}
            <button
              className="py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs select-none"
              onMouseDown={() => setPolarArrayPeek(true)}
              onMouseUp={() => setPolarArrayPeek(false)}
              onMouseLeave={() => setPolarArrayPeek(false)}
              onTouchStart={() => setPolarArrayPeek(true)}
              onTouchEnd={() => setPolarArrayPeek(false)}
            >👁 {t('polarArrayPeekHint')}</button>
          </div>
        </div>
      </>
    )}

    {/* ── Linear Array Dialog ───────────────────────────────────── */}
    {showLinearArrayDialog && (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-60" style={{ zIndex: 2147483640, opacity: linearArrayPeek ? 0 : 1, transition: 'opacity 0.15s' }} onClick={() => setShowLinearArrayDialog(false)} />
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483641, opacity: linearArrayPeek ? 0 : 1, transition: 'opacity 0.15s' }}>
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto flex flex-col gap-4 p-5" style={{ width: 'min(340px, 92vw)' }} onClick={e => e.stopPropagation()}>
            <div className="text-white font-semibold text-base">{t('linearArrayTitle')}</div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('linearArrayCount')}</label>
              <div className="flex items-center gap-2">
                <input type="number" min={2} max={100} value={linearArrayCount} onChange={e => setLinearArrayCount(Math.max(2, Math.min(100, parseInt(e.target.value) || 2)))} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                {[3,4,6,8].map(n => <button key={n} onClick={() => setLinearArrayCount(n)} className={`px-2 py-1 rounded text-xs ${linearArrayCount === n ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{n}</button>)}
              </div>
            </div>

            {/* Direction */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('linearArrayDirection')}</label>
              <div className="flex items-center gap-2">
                {[['H', 0], ['V', 90]].map(([label, val]) => (
                  <button key={label} onClick={() => setLinearArrayAngle(val as number)} className={`px-3 py-1 rounded text-xs font-semibold ${linearArrayAngle === val ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{label}</button>
                ))}
                <input type="number" min={0} max={360} value={linearArrayAngle} onChange={e => setLinearArrayAngle(parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                <span className="text-gray-400 text-xs">°</span>
              </div>
            </div>

            {/* Spacing */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Spacing (% of element size)</label>
              <div className="flex items-center gap-2">
                <input type="number" min={10} max={500} step={10} value={linearArraySpacing} onChange={e => setLinearArraySpacing(Math.max(10, Math.min(500, parseFloat(e.target.value) || 100)))} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                <span className="text-gray-400 text-xs">%</span>
                <button onClick={() => setLinearArraySpacing(100)} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">100%</button>
              </div>
            </div>

            {/* Rotation per step */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('linearArrayRotStep')}</label>
              <div className="flex items-center gap-2">
                <input type="number" value={linearArrayRotStep} onChange={e => setLinearArrayRotStep(parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                <span className="text-gray-400 text-xs">°</span>
                <button onClick={() => setLinearArrayRotStep(0)} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">Reset</button>
              </div>
            </div>

            {/* Create as ghosts checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="linear-ghosts"
                checked={linearArrayCreateGhosts}
                onChange={e => setLinearArrayCreateGhosts(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="linear-ghosts" className="text-sm text-gray-300">Create as ghosts</label>
            </div>

            {/* Summary */}
            <div className="text-xs text-gray-400 text-center">
              {linearArrayCount} copies · {linearArrayAngle}° · {linearArraySpacing}% spacing{linearArrayRotStep !== 0 ? ` · +${linearArrayRotStep}°/step` : ''}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  executeLinearArray(linearArrayCount, linearArrayAngle, linearArraySpacing, linearArrayRotStep, linearArrayCreateGhosts);
                  setShowLinearArrayDialog(false);
                  setLinearArrayCreateGhosts(false);
                }}
                className="flex-1 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold"
              >{t('linearArrayApply')}</button>
              <button onClick={() => setShowLinearArrayDialog(false)} className="flex-1 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm">{t('confirmCancel')}</button>
            </div>

            {/* Peek button */}
            <button
              className="py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs select-none"
              onMouseDown={() => setLinearArrayPeek(true)}
              onMouseUp={() => setLinearArrayPeek(false)}
              onMouseLeave={() => setLinearArrayPeek(false)}
              onTouchStart={() => setLinearArrayPeek(true)}
              onTouchEnd={() => setLinearArrayPeek(false)}
            >👁 {t('linearArrayPeekHint')}</button>
          </div>
        </div>
      </>
    )}

    {/* ── Spiral Array Dialog ───────────────────────────────────── */}
    {showSpiralArrayDialog && (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-60" style={{ zIndex: 2147483640, opacity: spiralArrayPeek ? 0 : 1, transition: 'opacity 0.15s' }} onClick={() => setShowSpiralArrayDialog(false)} />
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483641, opacity: spiralArrayPeek ? 0 : 1, transition: 'opacity 0.15s' }}>
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto flex flex-col gap-4 p-5" style={{ width: 'min(340px, 92vw)' }} onClick={e => e.stopPropagation()}>
            <div className="text-white font-semibold text-base">{t('spiralArrayTitle')}</div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('spiralArrayCount')}</label>
              <div className="flex items-center gap-2">
                <input type="number" min={2} max={100} value={spiralArrayCount} onChange={e => setSpiralArrayCount(Math.max(2, Math.min(100, parseInt(e.target.value) || 2)))} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                {[4,6,8,12].map(n => <button key={n} onClick={() => setSpiralArrayCount(n)} className={`px-2 py-1 rounded text-xs ${spiralArrayCount === n ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{n}</button>)}
              </div>
            </div>

            {/* Angle step */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('spiralArrayAngleStep')}</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={180} value={spiralArrayAngleStep} onChange={e => setSpiralArrayAngleStep(Math.max(1, Math.min(180, parseFloat(e.target.value) || 30)))} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                {[15,30,45,60].map(n => <button key={n} onClick={() => setSpiralArrayAngleStep(n)} className={`px-2 py-1 rounded text-xs ${spiralArrayAngleStep === n ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{n}°</button>)}
              </div>
            </div>

            {/* Type toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('spiralArrayType')}</label>
              <div className="flex gap-2">
                <button onClick={() => setSpiralArrayType('archimedean')} className={`flex-1 py-1.5 rounded text-xs font-semibold ${spiralArrayType === 'archimedean' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{t('spiralArrayArchimedean')}</button>
                <button onClick={() => setSpiralArrayType('geometric')} className={`flex-1 py-1.5 rounded text-xs font-semibold ${spiralArrayType === 'geometric' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{t('spiralArrayGeometric')}</button>
              </div>
            </div>

            {/* Type-specific fields */}
            {spiralArrayType === 'archimedean' ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">{t('spiralArrayGap')}</label>
                <input type="number" min={1} value={spiralArrayGap} onChange={e => setSpiralArrayGap(parseFloat(e.target.value) || 1)} className="w-28 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">{t('spiralArrayGrowth')}</label>
                <input type="number" min={1.01} max={3} step={0.05} value={spiralArrayGrowth} onChange={e => setSpiralArrayGrowth(parseFloat(e.target.value) || 1.2)} className="w-28 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
              </div>
            )}

            {/* Rotate toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={spiralArrayRotate} onChange={e => setSpiralArrayRotate(e.target.checked)} className="accent-blue-500" />
              <span className="text-xs text-gray-300">{t('spiralArrayRotate')}</span>
            </label>

            <div className="flex gap-2">
              <button onClick={() => { executeSpiralArray(spiralArrayCount, spiralArrayType, spiralArrayGap, spiralArrayGrowth, spiralArrayRotate, spiralArrayAngleStep); setShowSpiralArrayDialog(false); }} className="flex-1 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold">{t('spiralArrayApply')}</button>
              <button onClick={() => setShowSpiralArrayDialog(false)} className="flex-1 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm">{t('confirmCancel')}</button>
            </div>

            {/* Peek button */}
            <button
              className="py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs select-none"
              onMouseDown={() => setSpiralArrayPeek(true)}
              onMouseUp={() => setSpiralArrayPeek(false)}
              onMouseLeave={() => setSpiralArrayPeek(false)}
              onTouchStart={() => setSpiralArrayPeek(true)}
              onTouchEnd={() => setSpiralArrayPeek(false)}
            >👁 {t('spiralArrayPeekHint')}</button>
          </div>
        </div>
      </>
    )}

    {/* ── In-app Confirm Dialog ─────────────────────────────────── */}
    {confirmDialog && (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-60" style={{ zIndex: 2147483647 }} onClick={() => setConfirmDialog(null)} />
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto px-6 py-5 flex flex-col gap-4"
            style={{ width: 'min(360px, 90vw)' }}>
            <p className="text-white text-sm text-center">{confirmDialog.message}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className="flex-1 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-sm font-semibold"
              >{confirmDialog.confirmLabel || t('confirmDelete')}</button>
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm"
              >{t('confirmCancel')}</button>
            </div>
          </div>
        </div>
      </>
    )}

    {/* ── In-app Alert Dialog ───────────────────────────────────── */}
    {alertDialog && (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-40" style={{ zIndex: 2147483647 }} onClick={() => setAlertDialog(null)} />
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto px-6 py-5 flex flex-col gap-4"
            style={{ width: 'min(320px, 90vw)' }}>
            <div className="flex flex-col gap-1 text-center">
              <p className="text-white text-sm">{alertDialog.message}</p>
              {alertDialog.sub && <p className="text-gray-400 text-xs">{alertDialog.sub}</p>}
            </div>
            <button
              onClick={() => setAlertDialog(null)}
              className="py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium"
            >{t('alertOk')}</button>
          </div>
        </div>
      </>
    )}

    </>
  );
};

export default TattingDesigner;
