// TattingCAD — tattingindex.tsx
// Main application component. See docs/architecture.md for module structure.

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import {
  getRecents,
  thumbSrcFor,
  thumbPathFor,
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
import { generatePatternText } from './domain/patternOutput';
import { ORDER_GROUP_COLORS } from './render/svgExport';
import {
  createCirclePath, createTeardropPath, createSplitRingPath, createSplitRingPathFromEl,
  rotatePaths, mirrorPaths, applyRotationToPathData, rotatePathsAroundCenter,
  applyPathPreset, applyLinePreset,
} from './geometry/paths';
import { useEditorActions } from './hooks/useEditorActions';
import { useBEClipboard } from './hooks/useBEClipboard';
import { useHistoryActions } from './hooks/useHistoryActions';
import { useInputHandlers } from './hooks/useInputHandlers';
import { useJoinActions } from './hooks/useJoinActions';
import { useProjectFile } from './hooks/useProjectFile';
import { useUIState } from './hooks/useUIState';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useTattingOrder } from './hooks/useTattingOrder';
import { useProjectState } from './hooks/useProjectState';
import { useViewState, DEFAULT_THEME, SPLASH_TIP_COUNT } from './hooks/useViewState';
import { useBeadState, DEFAULT_BEAD_LIBRARY } from './hooks/useBeadState';
import { usePatternState, DEFAULT_MATERIALS, LANGUAGES_FALLBACK } from './hooks/usePatternState';
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
  IconBringToFront, IconSendToBack,
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
  normalizeNotationInput,
  isZeroWidth,
} from './domain/parser';
const logoUrl = '/logo.png';

// Icons imported from ./components/icons

// Icons inlined — see below React import

// ============================================================================
// TRANSLATIONS — add new languages by duplicating the 'en' block.
// Notation terms (ds, p, jp …) are universal and are NOT translated.
// ============================================================================
// Colors cycled through for order group badges (canvas + SVG export).
// Each entry is [fillColor, strokeColor] — dark stroke so badges stay readable on any bg.
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

// Picot arm lengths in canvas units — shared by renderPicots, renderOnePicot, getPicotPosition
const PICOT_SIZE: Record<string, number> = { small: 13, medium: 20, large: 26 };

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

// Numeric input that only commits its value on blur or Enter.
// While focused, the user can type freely without the field fighting them.
// Quick-pick buttons work correctly because clicking them blurs the input first.
const ArrayInput = ({
  value, onChange, min, max, step, integer = false, className,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  integer?: boolean; className?: string;
}) => {
  const [draft, setDraft] = React.useState<string | null>(null);

  const commit = (raw: string) => {
    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
    let v = isNaN(parsed) ? value : parsed;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
    setDraft(null);
  };

  return (
    <input
      type="number"
      min={min} max={max} step={step}
      value={draft ?? value}
      onChange={e => setDraft(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter')  { commit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const s = step ?? 1;
          const current = draft !== null ? (integer ? parseInt(draft, 10) : parseFloat(draft)) : value;
          const next = isNaN(current) ? value : current + (e.key === 'ArrowUp' ? s : -s);
          e.preventDefault();
          commit(String(next));
        }
      }}
      className={className}
    />
  );
};
// Handles backdrop, peek-opacity fade, centering, and click-outside-to-close.
// Only the inner content differs between dialogs.
const ArrayDialogShell = ({
  show, peek, onClose, children,
}: {
  show: boolean; peek: boolean; onClose: () => void; children: React.ReactNode;
}) => {
  if (!show) return null;
  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-60"
        style={{ zIndex: 2147483640, opacity: peek ? 0 : 1, transition: 'opacity 0.15s' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 2147483641, opacity: peek ? 0 : 1, transition: 'opacity 0.15s' }}
      >
        <div
          className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto flex flex-col gap-4 p-5"
          style={{ width: 'min(340px, 92vw)' }}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
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
    showRecentProjectsDialog, setShowRecentProjectsDialog,
    showRecentLoadConfirm, setShowRecentLoadConfirm,
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
    convertConfirm, setConvertConfirm,
    ghostArrays, setGhostArrays,
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

  // Toast helper — sets the load/save message and auto-dismisses it.
  const showLoadMsg = useCallback((type: 'success' | 'error', text: string) => {
    setLoadMsg({ type, text });
    setTimeout(() => setLoadMsg(null), type === 'success' ? 3000 : 4000);
  }, []);

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

  // ── View state ───────────────────────────────────────────────────────────
  const {
    bgColor, setBgColor,
    gridEnabled, setGridEnabled,
    customColors, setCustomColors,
    theme, setTheme,
    snapEnabled, setSnapEnabled,
    snapRadius, setSnapRadius,
    referenceImage, setReferenceImage,
    refImageProps, setRefImageProps,
    dmcColors, setDmcColors,
    notationFontSize, setNotationFontSize,
    uiScale, setUiScale,
    clipboard, setClipboard,
    splashTipIndex, setSplashTipIndex,
  } = useViewState();

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

  // ── Core pattern state ───────────────────────────────────────────────────
  const {
    elements, setElements,
    dsWidth, setDsWidth,
    camera, setCamera,
    zoom, setZoom,
    patternNotes, setPatternNotes,
    materials, setMaterials,
    language, setLanguage,
    extraTranslations, setExtraTranslations,
    availableLanguages, setAvailableLanguages,
    history, setHistory,
    historyIndex, setHistoryIndex,
  } = usePatternState();

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
  // SPLASH_TIP_KEYS replaced by SPLASH_TIP_COUNT from ./hooks/useViewState


  // Chain preset panel — symmetric toggle (local UI preference, not persisted)
  const [chainPresetSymmetric, setChainPresetSymmetric] = React.useState(true);

  const lastUsedMaterialIdRef = useRef('default');


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
  const isUndoRedoRef = useRef(false);  // Flag to prevent adding history during undo/redo
  const notationEscapeRef = useRef(false); // Flag: ESC was pressed on notation input — suppress blur commit
  const pendingNotationRef = useRef(null); // { elementId, notation, notationB? } — survives re-renders/unmount
  const historyRef = useRef([{ elements: [], connections: [] }]);  // Ref to current history
  const historyIndexRef = useRef(0);  // Ref to current index
  const isInteractingRef = useRef(false);  // Flag to prevent history during drag/rotate operations
  const rafIdRef = useRef(null);  // RAF ID for batching mouse moves
  const nudgeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // For press-and-hold rotation nudge
  const nudgeAccumulatedDeltaRef = useRef(0); // Track total rotation during hold for single history push
  const nudgeActiveRef = useRef(false); // Whether a nudge hold is in progress
  const createdNewLineRef = useRef(false); // Track if a new line was created (for auto-switch back to select)
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

  // Shared history push — delegated to useHistoryActions hook
  const { pushHistoryState } = useHistoryActions({
    historyRef, historyIndexRef, setHistory, setHistoryIndex,
  });

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
  const clipboardRef = useRef([]);       // for copy/paste - ensures sync in Tauri WebView

  // Keep refs updated
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    clipboardRef.current = clipboard;
  }, [clipboard]);

  // Commit any pending notation change when the selection changes (e.g. clicking canvas deselects)
  useEffect(() => {
    const pending = pendingNotationRef.current;
    if (!pending) return;
    if (selectedIdSet.has(pending.elementId)) { return; }
    pendingNotationRef.current = null;
    if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
    const parsed = parseNotation(pending.notation, true);
    if (parsed && parsed.stitchCount > 0) {
      setDraftNotation(null);
     updateNotation(normalizeNotationInput(pending.notation), pending.notationB ?? null, pending.elementId);
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
    if (nudgeActiveRef.current) return; // Nudge hold will push history once on mouseUp
    pushHistoryState(elements, picotConnections, orderGroupsRef.current);
  }, [elements, picotConnections]); // Depend on both elements and connections

  // Auto-save to localStorage every 30 seconds
  // PERFORMANCE: Use refs to avoid recreating interval on every state change
  // Note: elementsRef and selectedIdsRef already declared above
  const cameraRef = useRef(camera);
  const zoomRef = useRef(zoom);
  const dsWidthRef = useRef(dsWidth);
  const projectNameRef = useRef(projectName);
  const picotConnectionsRef = useRef(picotConnections);
  const materialsRef = useRef(materials);
  const activeModeRef = useRef(activeMode);
  const selectedBEsRef = useRef(selectedBEs);
  const selectedPicotsRef = useRef([]);
  const beClipboardRef = useRef(beClipboard);
  const orderGroupsRef = useRef(orderGroups);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pivotOffsetRef = useRef({ x: 0, y: 0 });  // always-current mirror of pivotOffset state
  const pivotDragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 }); // world pos + offset at drag start
  const rotationDragStartRef = useRef({ x: 0, y: 0, pivotX: 0, pivotY: 0 }); // world pos + effective pivot at rotation drag start
  const movingPivotRef = useRef(false);   // ref mirror of movingPivot — readable in touch handlers
  const rotationHandleRef = useRef<string | null>(null); // ref mirror of rotationHandle
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
    picotConnectionsRef.current = picotConnections;
    projectNameRef.current = projectName;
    materialsRef.current = materials;
    activeModeRef.current = activeMode;
    selectedBEsRef.current = selectedBEs;
    beClipboardRef.current = beClipboard;
    orderGroupsRef.current = orderGroups;
    selectedPicotsRef.current = selectedPicots;
    pivotOffsetRef.current = pivotOffset;
    movingPivotRef.current = movingPivot;
    rotationHandleRef.current = rotationHandle;
  });

  // Persist polar grids globally to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem('tcad_polar_grids', JSON.stringify(polarGrids)); } catch {}
  }, [polarGrids]);
  
  useEffect(() => {
    const autoSave = () => {
      if (elementsRef.current.length === 0) return; // Don't save empty projects
      try {
        // buildProjectDataRef always points to the latest closure — no stale state.
        // Pass isAutoSave=true so serializeProject writes the 'autoSaved' timestamp key.
        const data = buildProjectDataRef.current(projectNameRef.current);
        const payload = { ...data, autoSaved: new Date().toISOString() };
        delete (payload as any).created;
        localStorage.setItem('tatting-designer-autosave', JSON.stringify(payload));
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

  // Render split ring stitches using TWO parallel offset curves per path half.
  // Each half (pathA / pathB) is treated independently like a mini teardrop ring.
  // Accepts the global stitch index so it can determine which path half to use.
  const renderWedgeSplitRingShapes = (stitch, el, scale, offsetAmount, stitchType, globalIndex) => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const splitPos = el.splitPosition || Math.floor(el.stitchCount / 2);
    const inA = globalIndex < splitPos;
    const path = inA ? el.paths[0] : el.paths[1];
    if (!path) return shapes.map(() => '');
    const localCount = inA ? splitPos : el.stitchCount - splitPos;
    const localIndex = inA ? globalIndex : globalIndex - splitPos;

    const samplesPerDS = 10;
    const totalSamples = localCount * samplesPerDS;

    const STITCH_X_EXTENTS = {
      'ds':  { xMin: -0.2622, xMax:  0.0504 },
      'ss':  { xMin: -0.1023, xMax:  0.0463 },
      'lss': { xMin: -0.1023, xMax:  0.0463 },
      'rss': { xMin: -0.1023, xMax:  0.0463 },
      'rds': { xMin: -0.5946, xMax:  0.0798 },
    };
    const dsEquivalentWidth = { 'ds': 1.0, 'ss': 0.5, 'lss': 0.5, 'rss': 0.5, 'rds': 2.0 };
    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;
    const stitchWidth = dsEquivalentWidth[stitchType] || 1.0;
    const samplesForThisStitch = samplesPerDS * stitchWidth;

    return shapes.map(([xl, xr, yo, yi]) => {
      const outerOffset = offsetAmount - yo * scale;
      const innerOffset = offsetAmount - yi * scale;

      // Sample offset curves for this path half only
      const outerCurve = sampleFullPathWithOffset([path], outerOffset, totalSamples);
      const innerCurve = sampleFullPathWithOffset([path], innerOffset, totalSamples);

      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;
      const stitchSliceStart = localIndex * samplesPerDS;
      const rectStart = Math.round(stitchSliceStart + tLeft  * samplesForThisStitch);
      const rectEnd   = Math.round(stitchSliceStart + tRight * samplesForThisStitch);

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
      return pathD + ' Z';
    });
  };

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


  // Apply group rotation from input field
  // PERFORMANCE: O(1) element lookup by id — replaces elements.find(e => e.id === x) everywhere
  // Defined early because it is used in event handlers and callbacks throughout the component.
  const elementById = useMemo(() => new Map(elements.map(e => [e.id, e])), [elements]);

  // PERFORMANCE: O(1) selected-id membership — replaces selectedIdSet.has(id) (O(n)) everywhere.
  // selectedIds.includes inside filter/map is O(n²) when many elements are on canvas.
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // ── Editor actions ─────────────────────────────────────────────────────
  const {
    getViewportCenter, getElementBounds, getSelectionBoundingBox,
    moveElement, getElementPivot, getPolarPivot,
    addRing, addSplitRing, addChain, addLine,
    deleteSelected,
    undo, redo,
    copySelected, cutSelected, pasteFromClipboard, duplicateInPlace,
    bringToFront, sendToBack,
    groupSelected, ungroupSelected,
    alignLeft, alignRight, alignTop, alignBottom,
    alignCenterHorizontal, alignCenterVertical,
    alignToGridHorizontal, alignToGridVertical, centerToPolarGrid,
    applySingleRotationDelta,
    applyMultiSelectRotationDelta,
    applyGroupRotation,
  } = useEditorActions({
    elements, selectedIds, dsWidth, camera, zoom, polarGrids,
    elementById, selectedIdSet,
    beadLibrary, picotConnections,
    canvasRef, elementsRef, selectedIdsRef, picotConnectionsRef, orderGroupsRef,
    clipboardRef, historyRef, historyIndexRef,
    isUndoRedoRef, needsHistoryPushRef, skipAutoHistoryRef, lastUsedMaterialIdRef,
    setElements, setSelectedIds, setPicotConnections, setOrderGroups,
    setClipboard, setGhostArrays, setHistoryIndex,
    setGroupRotationInput,
    pushHistoryState,
  });

  // PERFORMANCE: O(1) material lookup by id — getElementColor calls materials.find() on every
  // element every render. This map makes it O(1) and speeds up stitchCache builds too.
  const materialsById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);

  // Convert a ghost array to real elements (called after confirmation)
  // Shared core: converts a set of ghost elements into real elements and
  // rewires any picotConnections pointing at their old ghost IDs.
  // Used by both "Convert this array" and "Convert all arrays".
  const convertGhostsToReal = (ghostsToConvert: any[]): string[] => {
    const newIds: string[] = [];
    const oldToNewId = new Map<string, string>();
    const ghostIdSet = new Set(ghostsToConvert.map(g => g.id));

    setElements(prev => {
      const withoutGhosts = prev.filter(el => !ghostIdSet.has(el.id));
      const realElements = ghostsToConvert.map(ghost => {
        const newEl = JSON.parse(JSON.stringify(ghost));
        oldToNewId.set(ghost.id, newEl.id);
        const source = elementById.get(ghost.sourceId);
        newEl.type = source?.type || newEl.type;
        delete newEl.sourceId;
        delete newEl.isBoundary;
        delete newEl.isGhostMother;
        newIds.push(newEl.id);
        return newEl;
      });
      return [...withoutGhosts, ...realElements];
    });

    setPicotConnections(prev => prev.map(conn => ({
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
    const currentGhosts = elements.filter(e => e.type === 'ghost' && e.sourceId === array.sourceId);
    const sourceEl = elementById.get(array.sourceId);
    const newIds = convertGhostsToReal(currentGhosts);
    setGhostArrays(prev => prev.filter(a => a.id !== array.id));
    setSelectedIds(sourceEl ? [sourceEl.id, ...newIds] : [...newIds]);
    setConvertConfirm(null);
  };

  const convertAllGhostArrays = () => {
    // Find all ghosts by sourceId (ghostIds may be stale after undo), deduplicated
    // in case multiple arrays share the same ghost.
    const allGhostsToConvert = ghostArrays.flatMap(a =>
      elements.filter(e => e.type === 'ghost' && e.sourceId === a.sourceId)
    );
    const seen = new Set<string>();
    const uniqueGhosts = allGhostsToConvert.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    const newIds = convertGhostsToReal(uniqueGhosts);
    const sourceIds = ghostArrays.map(a => a.sourceId).filter(Boolean);
    setSelectedIds([...sourceIds, ...newIds]);
    setGhostArrays([]);
    setConvertConfirm(null);
  };

  // ── Pure helper: create one polar array instance ──
  // Designed to be extracted to src/geometry/ later.
  // Returns a new element (ghost or real) placed at position i in the array.
  const createPolarInstance = (
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
      // Build ghost element with transformed paths and copied picots
      return {
        id: generateId(),
        type: 'ghost' as const,
        sourceId: options?.sourceId || sourceEl.id,
        isBoundary: options?.isBoundary ?? false,
        center: { x: newCx, y: newCy },
        paths: sourceEl.paths ? sourceEl.paths.map((p: any) => {
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
        }) : [],
        picots: sourceEl.picots ? JSON.parse(JSON.stringify(sourceEl.picots)) : [],
        rotation: ((sourceEl.rotation || 0) + angleDeg) % 360,
        // Properties needed for rendering and picot position calculation
        isClosed: sourceEl.isClosed,
        shapeStyle: sourceEl.shapeStyle,
        stitchCount: sourceEl.stitchCount,
        picotSideMultiplier: sourceEl.picotSideMultiplier,
        color: sourceEl.color,
        materialId: sourceEl.materialId,
        materialIdB: sourceEl.materialIdB,
        isSplitRing: sourceEl.isSplitRing,
        splitPosition: sourceEl.splitPosition,
        lineWidth: sourceEl.lineWidth,
      };
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

  // Polar Array — duplicate selected elements N times evenly around a pivot point.
  // count = total copies INCLUDING the original. fillAngle = arc to fill (360 = full circle).
  const executePolarArray = (count: number, fillAngle: number, pivotId: string | 'selection' | null, createGhosts: boolean = false, sourceIds?: string[]) => {
    const currentSelectedIds = sourceIds && sourceIds.length > 0 ? sourceIds : selectedIdsRef.current;
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

    const newElements = [];
    const newGhostIds: string[] = [];
    const boundaryGhostIds: string[] = [];

    // Single array ID used consistently for the mother flag and the ghostArrays entry
    const arrayId = createGhosts ? generateId() : undefined;

    // Mark source elements as mothers
    if (createGhosts) {
      setElements(prev => prev.map(el =>
        currentSelectedIds.includes(el.id)
          ? { ...el, isGhostMother: true }
          : el
      ));
    }

    // Build groupId mapping once for all instances
    const groupIdMap = new Map<string, string>();
    selectedEls.forEach(el => {
      if (el.groupId && !groupIdMap.has(el.groupId)) {
        groupIdMap.set(el.groupId, generateId());
      }
    });

    const polarGridId = (pivotId && pivotId !== 'selection') ? pivotId : undefined;

    // Start from copy #1 (original stays as-is), generate copies 1..count-1
    for (let i = 1; i < count; i++) {
      const isBoundary = (i === 1 || i === count - 1);

      selectedEls.forEach(el => {
        const newEl = createPolarInstance(el, i, pivotX, pivotY, count, fillAngle, {
          asGhost: createGhosts,
          sourceId: createGhosts ? el.id : undefined,
          isBoundary: createGhosts ? isBoundary : undefined,
          groupIdMap,
          polarGridId,
        });

        newElements.push(newEl);
        if (createGhosts) {
          newGhostIds.push(newEl.id);
          if (isBoundary) boundaryGhostIds.push(newEl.id);
        }
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

    // After ghost creation, only select the mother element(s) — ghosts are non-interactive
    setSelectedIds([...currentSelectedIds]);

    // Save ghost array metadata for Update functionality
    if (createGhosts && newGhostIds.length > 0) {
      setGhostArrays(prev => [...prev, {
        id: arrayId,
        name: `Polar Array ${prev.length + 1}`,
        type: 'polar',
        sourceId: currentSelectedIds[0],
        instanceCount: count,
        angle: fillAngle,
        spacing: 0,
        rotStep: 0,
        pivotId: pivotId || undefined,
        ghostIds: newGhostIds,
        boundaryIds: boundaryGhostIds,
        inheritedJoins: [],
      }]);
    }
  };

  // Linear Array — duplicate N times along a direction with optional per-step rotation.
  // Helper: rotate an element's baked path points around a center by deltaDeg degrees.
  // For split rings and teardrops, regenerates paths from scratch then applies absolute rotation.
  // Returns new paths array — delegates to rotatePaths for all cases.

  // ── Pure helper: calculate bounding box from actual path curves ──
  // Samples bezier curves (not control-point hull) and excludes picots.
  // For elements without paths, falls back to center position.
  // If angleDeg is provided, elementSize is projected along that direction.
  // Designed to be extracted to src/geometry/ later.
  const calculatePathBbox = (els: any[], angleDeg?: number) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasPaths = false;

    els.forEach(el => {
      if (el.paths && el.paths.length > 0) {
        el.paths.forEach(p => {
          const samples = sampleBezierPath(p, 20);
          samples.forEach(pt => {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
          });
        });
        hasPaths = true;
      } else {
        // Fallback: element with no paths — use center
        minX = Math.min(minX, el.center.x);
        minY = Math.min(minY, el.center.y);
        maxX = Math.max(maxX, el.center.x);
        maxY = Math.max(maxY, el.center.y);
      }
    });

    const width = maxX - minX;
    const height = maxY - minY;

    let elementSize: number;
    if (angleDeg !== undefined) {
      // Project bounding box extent onto the array direction vector
      const rad = angleDeg * Math.PI / 180;
      elementSize = Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad));
    } else {
      // Use the larger dimension (fallback)
      elementSize = hasPaths ? Math.max(width, height, 1) : 1;
    }
    return { minX, minY, maxX, maxY, elementSize };
  };


  // ── Pure helper: create one linear array instance ──
  // Designed to be extracted to src/geometry/ later.
  // Returns a new element (ghost or real) placed at position i in the array.
  const createLinearInstance = (
    sourceEl: any,
    index: number,
    dx: number,
    dy: number,
    rotStep: number,
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
      newEl.type = 'ghost';
      newEl.sourceId = options?.sourceId || sourceEl.id;
      newEl.isBoundary = options?.isBoundary ?? false;
      delete newEl.isGhostMother;
    }

    return newEl;
  };

  const executeLinearArray = (count: number, angleDeg: number, spacingPercent: number, rotStep: number, createGhosts: boolean = false, sourceIds?: string[]) => {
    const currentSelectedIds = sourceIds && sourceIds.length > 0 ? sourceIds : selectedIdsRef.current;
    const currentElements = elementsRef.current;
    if (currentSelectedIds.length === 0 || count < 2) return;
    const selectedEls = currentElements.filter(e => currentSelectedIds.includes(e.id));

    // Calculate bounding box and element size projected along array direction
    const { elementSize } = calculatePathBbox(selectedEls, angleDeg);

    // Center-to-center distance: 100% = just touching, 200% = 1 element gap
    const spacing = elementSize * spacingPercent / 100;

    const rad = angleDeg * Math.PI / 180;
    const dx = Math.cos(rad) * spacing;
    const dy = Math.sin(rad) * spacing;
    const newElements = [];
    const newGhostIds: string[] = [];
    const boundaryGhostIds: string[] = [];

    // Single array ID used consistently for the mother flag and the ghostArrays entry
    const arrayId = createGhosts ? generateId() : undefined;

    // Mark source elements as mothers
    if (createGhosts) {
      setElements(prev => prev.map(el =>
        currentSelectedIds.includes(el.id)
          ? { ...el, isGhostMother: true }
          : el
      ));
    }

    // Build groupId map once for all instances
    const groupIdMap = new Map<string, string>();
    selectedEls.forEach(el => { if (el.groupId && !groupIdMap.has(el.groupId)) groupIdMap.set(el.groupId, generateId()); });

    for (let i = 1; i < count; i++) {
      const isBoundary = (i === 1); // Ghost closest to the mother is the boundary for linear

      selectedEls.forEach(el => {
        const newEl = createLinearInstance(el, i, dx, dy, rotStep, {
          asGhost: createGhosts,
          sourceId: createGhosts ? el.id : undefined,
          isBoundary: createGhosts ? isBoundary : undefined,
          groupIdMap,
        });

        newElements.push(newEl);
        if (createGhosts) {
          newGhostIds.push(newEl.id);
          if (isBoundary) boundaryGhostIds.push(newEl.id);
        }
      });
    }
    setElements(prev => [...prev, ...newElements]);
    // After ghost creation, only select the mother element(s) — ghosts are non-interactive
    setSelectedIds([...currentSelectedIds]);

    // Save ghost array metadata for Update functionality
    if (createGhosts && newGhostIds.length > 0) {
      setGhostArrays(prev => [...prev, {
        id: arrayId,
        name: `Linear Array ${prev.length + 1}`,
        type: 'linear',
        sourceId: currentSelectedIds[0],
        instanceCount: count,
        angle: angleDeg,
        spacing: spacingPercent,
        elementSize: elementSize,
        rotStep: rotStep,
        ghostIds: newGhostIds,
        boundaryIds: boundaryGhostIds,
        inheritedJoins: [],
      }]);
    }
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

    // Build groupId mapping once for all spiral copies — was previously rebuilt
    // every iteration, which assigned a different new group to each copy.
    const groupIdMap = new Map<string, string>();
    selectedEls.forEach(el => { if (el.groupId && !groupIdMap.has(el.groupId)) groupIdMap.set(el.groupId, generateId()); });

    for (let i = 1; i < count; i++) {
      const pos = spiralPos(i);
      // Offset moves the centroid to pos; each element keeps its relative position within the group
      const offsetX = pos.x - centroidX;
      const offsetY = pos.y - centroidY;
      // Rotation delta relative to original angle — how much the spiral has turned
      // offsetX/Y moves each element's centroid to the new spiral position

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
          newEl.paths = rotatePathsAroundCenter(newEl.paths, newCx, newCy, rotDeltaDeg, dsWidth, el, absRot);
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

  // Predicate: does element e belong to the currently active order scope?
  // Ungrouped scope (activeOrderGroupId === null) → elements with no orderGroup.
  // Group scope → elements whose orderGroup matches the active group id.
  const inActiveGroup = (e: any) =>
    activeOrderGroupId === null ? !e.orderGroup : e.orderGroup === activeOrderGroupId;

  const getNextAvailableNumber = (): number => {
    const used = new Set(
      elements
        .filter(inActiveGroup)
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
        inActiveGroup(e)
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
      const targetEl = elementById.get(targetElId);
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
        const n = parseInt(String(e.orderNumber), 10);
        if (inActiveGroup(e) && !isNaN(n) && n >= newNum) return { ...e, orderNumber: n + 1 };
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

  // Shared commit logic for the order-number input (used in two prop-bar render sites).
  // Parses the draft, assigns or clears the order number, then resets the draft state.
  // Pass inputEl to also blur the field (needed on Enter; omit on blur to avoid recursion).
  const commitOrderDraft = (elementId: string, draft: string | null, inputEl?: HTMLInputElement) => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n > 0) {
      assignOrderNumber(elementId, n);
    } else if (draft.trim() === '') {
      setElements(prev => prev.map(el => el.id === elementId ? { ...el, orderNumber: null } : el));
      pushOrderHistory();
    }
    setPropBarOrderDraft(null);
    inputEl?.blur();
  };

  // New canvas - confirm if there are elements
  const newCanvas = () => {
    if (elements.length === 0 && historyIndex === 0) return;
    setConfirmDialog({
      title: t('newCanvasTitle'),
      message: t('newCanvasBody'),
      confirmLabel: t('newCanvasConfirm'),
      onConfirm: confirmNewCanvas,
    });
  };

  const confirmNewCanvas = () => {
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


  const generatePattern = useCallback(() => {
    const result = generatePatternText({
      elements, picotConnections, orderGroups, materials, beadLibrary,
      threadPresets, activePresetId, dsWidth, patternNotes, projectName, currentFilePath,
    });
    const notesBlock = patternNotes?.trim() ? '\n\n--- Notes ---\n' + patternNotes.trim() : '';
    const text = result === null ? 'No objects on canvas.' + notesBlock : result.text;
    navigator.clipboard.writeText(text).then(
      () => { setLoadMsg({ type: 'success', text: t('notationCopied') }); setTimeout(() => setLoadMsg(null), 3000); },
      () => { setLoadMsg({ type: 'error', text: t('notationCopyFailed') }); setTimeout(() => setLoadMsg(null), 4000); }
    );
  }, [elements, picotConnections, orderGroups, materials, beadLibrary,
      threadPresets, activePresetId, dsWidth, patternNotes, projectName, currentFilePath]);
  // Export as PNG

  // ── Endpoint pseudo-picot helpers ────────────────────────────────────────
  const isEndpointPicotId = (id: string) =>
    id === '__start__' || id === '__end__' || id === '__anchor__';

  const getConnectionBeadSeq = (conn: any) => {
    for (const p of conn.picots) {
      if (isEndpointPicotId(p.picotId)) continue;
      const el = elementById.get(p.elementId);
      const picot = el?.picots?.find(pic => pic.id === p.picotId);
      if ((picot?.beadType === 'bjp' || picot?.beadType === 'bcjp') && picot?.beadSeq) return picot.beadSeq;
    }
    return null;
  };

  const getEndpointPseudoPicots = (el: any): Array<{ id: string; x: number; y: number }> => {
    if (el.type === 'ghost' && !el.isBoundary) return [];
    if (!el.paths?.length) return [];
    // Ghost copies always have el.type === 'ghost' — the real shape (ring/chain)
    // lives on the source element, so boundary ghosts must resolve through it.
    const refEl = el.type === 'ghost' ? (elementById.get(el.sourceId) || el) : el;
    const refIsSplitRing = el.isSplitRing ?? refEl.isSplitRing;

    if (refIsSplitRing) {
      return [
        { id: '__start__', x: el.paths[0].x,    y: el.paths[0].y },
        { id: '__end__',   x: el.paths[0].endX,  y: el.paths[0].endY },
      ];
    }
    if (refEl.type === 'chain') {
      const last = el.paths[el.paths.length - 1];
      return [
        { id: '__start__', x: el.paths[0].x, y: el.paths[0].y },
        { id: '__end__',   x: last.endX,      y: last.endY },
      ];
    }
    if (refEl.type === 'ring') {
      return [{ id: '__anchor__', x: el.paths[0].x, y: el.paths[0].y }];
    }
    return [];
  };

  // Join/break actions delegated to useJoinActions hook
  const { joinSelectedPicots, breakSelectedPicots } = useJoinActions({
    selectedPicotsRef, elementsRef, picotConnectionsRef, orderGroupsRef,
    elementById, ghostArrays,
    setElements, setPicotConnections, setSelectedPicots, setGhostArrays,
    pushHistoryState,
  });

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
    // Ghost elements don't have paths and are not directly interactable
    if (element.type === 'ghost' || !element.paths) return Infinity;
    
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
      // Ghost elements are not directly interactable
      if (el.type === 'ghost') return false;
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
    const isH = axisAngleDeg === 90;

    const mirrorPt = (px, py) => isH
      ? { x: 2 * pivotX - px, y: py }
      : { x: px, y: 2 * pivotY - py };

    // Flip the rotation angle: FlipH → 180-θ   FlipV → -θ
    const mirrorAngle = (deg) => isH
      ? ((180 - deg) % 360 + 360) % 360
      : ((-deg)      % 360 + 360) % 360;

    // Physically mirror a path segment (swap start↔end to preserve traversal direction)
    const mirrorPath = path => {
      if (path.type === 'cubic') {
        const s  = mirrorPt(path.endX,      path.endY);
        const e2 = mirrorPt(path.x,          path.y);
        const c1 = mirrorPt(path.control2X,  path.control2Y);
        const c2 = mirrorPt(path.control1X,  path.control1Y);
        return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
      }
      const s    = mirrorPt(path.endX,     path.endY);
      const e2   = mirrorPt(path.x,         path.y);
      const ctrl = mirrorPt(path.controlX,  path.controlY);
      return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
    };

    setElements(prev => prev.map(el => {
      if (!ids.includes(el.id)) return el;
      const newCenter = mirrorPt(el.center.x, el.center.y);
      const newAngle  = mirrorAngle(el.rotation || 0);
      // Track flip state so notation apply can re-mirror after path regeneration
      const newIsFlippedH = isH ? !(el.isFlippedH || false) : (el.isFlippedH || false);
      const newIsFlippedV = !isH ? !(el.isFlippedV || false) : (el.isFlippedV || false);

      // ── Split rings ──────────────────────────────────────────────────────
      if (el.isSplitRing) {
        const notationAText = el.notation.replace(/^sr:\s*/, '');
        const notationBText = el.notationB || '5ds';
        const reversedA = reverseNotation(`sr: ${notationAText}`).replace(/^sr:\s*/, '');
        const reversedB = reverseNotation(`sr: ${notationBText}`).replace(/^sr:\s*/, '');
        const parsedA = parseNotation(`sr: ${reversedB}`);
        const parsedB = parseNotation(`sr: ${reversedA}`);
        if (!parsedA || !parsedB) return el;
        const sca = parsedA.stitchCount, scb = parsedB.stitchCount;
        const pathData = createSplitRingPathFromEl(el, dsWidth, { cx: newCenter.x, cy: newCenter.y, stitchCountA: sca, stitchCountB: scb });
        const newPaths = rotatePaths(pathData.paths, newCenter.x, newCenter.y, newAngle);
        const reversedAPicots = parsedA.picots.map(p => ({ ...p, stitchesBefore: sca - p.stitchesBefore })).reverse();
        const allPicots = [...reversedAPicots, ...parsedB.picots.map(p => ({ ...p, stitchesBefore: p.stitchesBefore + sca }))];
        return { ...el, center: newCenter, paths: newPaths, rotation: newAngle,
          isFlippedH: newIsFlippedH, isFlippedV: newIsFlippedV,
          notation: `sr: ${reversedB}`, notationB: reversedA,
          stitchCount: sca + scb, picots: allPicots, splitPosition: sca };
      }

      // ── All closed rings (circle and teardrop) ───────────────────────────
      // Physical mirror of path coords + updated rotation angle
      if (el.isClosed) {
        const newPaths = el.paths.map(mirrorPath).reverse();
        return { ...el, center: newCenter, paths: newPaths, rotation: newAngle,
          isFlippedH: newIsFlippedH, isFlippedV: newIsFlippedV };
      }

      // ── Chains and lines ──────────────────────────────────────────────────
      const newPaths = el.paths.map(mirrorPath).reverse();
      let reversedNotation = el.notation, picots = el.picots;
      if (el.type !== 'line' && el.notation) {
        reversedNotation = reverseNotation(el.notation);
        const parsed = parseNotation(reversedNotation);
        if (parsed) picots = mergeBEConfigs(parsed.picots, el.picots);
      }
      return { ...el, center: newCenter, paths: newPaths, rotation: newAngle,
        isFlippedH: newIsFlippedH, isFlippedV: newIsFlippedV,
        notation: reversedNotation, picots };
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



  const getPicotPosition = (element, picot, baseOnly = false) => {
    if (!element.picots || !picot) return null;
    
    const len = PICOT_SIZE[picot.length] || 20;
    const sideMultiplier = element.picotSideMultiplier || 1; // Default to 1 if not set
    
    // Special handling for circles
    if (element.isClosed && element.shapeStyle === 'circle') {
      const targetCircumference = element.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      const _sb1 = (picot.beadType === 'bc' || picot.beadType === 'bcp' || picot.beadType === 'be') ? picot.stitchesBefore + 0.5 : picot.stitchesBefore;
      const baseAngle = (_sb1 / element.stitchCount) * Math.PI * 2 - Math.PI / 2;
      const rotation = (element.rotation || 0) * Math.PI / 180; // Convert to radians
      const angle = baseAngle + rotation; // Apply rotation
      
      // In picotJoin mode all picots are dots on the path — return BASE for consistent hit-testing
      if (picot.isJoint || picot.isGuidePoint || baseOnly || activeMode === 'picotJoin') {
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
    
    const _sb2 = (picot.beadType === 'bc' || picot.beadType === 'bcp' || picot.beadType === 'be') ? picot.stitchesBefore + 0.5 : picot.stitchesBefore;
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
    
    // In picotJoin mode all picots are dots on the path — return BASE for consistent hit-testing
    if (picot.isJoint || picot.isGuidePoint || baseOnly || activeMode === 'picotJoin') {
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

  // Build the project data object (shared by save and autosave)
  const {
    buildProjectData, buildProjectDataRef,
    saveToPath, performSave, saveProject, saveProjectAs,
    applyProjectData, loadFromPath, loadProject,
    exportSVG,
  } = useProjectFile({
    elements, picotConnections, camera, zoom, dsWidth,
    bgColor, gridEnabled, customColors, referenceImage, refImageProps,
    renderMode, patternNotes, materials, orderGroups, beadLibrary,
    polarGrids, selectedPolarGridId, threadPresets, activePresetId,
    projectName, currentFilePath,
    historyIndexRef, canvasRef,
    setElements, setPicotConnections, setCamera, setZoom, setDsWidth,
    setBgColor, setGridEnabled, setCustomColors, setReferenceImage, setRefImageProps,
    setProjectName, setRenderMode, setPatternNotes, setMaterials,
    setOrderGroups, setActiveOrderGroupId, setPolarGrids, setSelectedPolarGridId,
    setThreadPresets, setActivePresetId,
    setSelectedIds, setSelectedPicots,
    setHistory, setHistoryIndex, setCurrentFilePath, setLastSavedHistoryIndex,
    getPicotPosition, showLoadMsg, t,
  });

  // ── Input handlers ─────────────────────────────────────────────────────
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


  // Pure: regenerates ghost-array copies for one or more mothers, given a
  // snapshot of elements + ghostArrays — NOT React state directly. This lets
  // callers (move, rotate, notation edit) compose ghost regeneration into
  // their OWN setElements call, so the whole thing commits as a single
  // render/history step instead of two separate ones.
  const regenerateGhostArrays = (
    elementsSnapshot: any[],
    ghostArraysSnapshot: any[],
    motherIds: string[]
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
            const grid = polarGrids.find(g => g.id === pivotId);
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
            const ghostEl = createLinearInstance(sourceEl, i, dx, dy, rotStep, {
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

  // Applies a regenerateGhostArrays() result via setElements/setGhostArrays/
  // setPicotConnections — all three calls happen synchronously in the same
  // tick, so React batches them into one commit (one history entry), instead
  // of the old setTimeout/effect-deferred approach which caused two.
  const applyGhostRegenResult = (result: { elements: any[]; ghostArrays: any[]; connectionIdMap: Map<string, string> }) => {
    setElements(result.elements);
    setGhostArrays(result.ghostArrays);
    if (result.connectionIdMap.size > 0) {
      setPicotConnections(prev => prev.map(conn => ({
        ...conn,
        picots: conn.picots.map(cp => ({
          ...cp,
          elementId: result.connectionIdMap.get(cp.elementId) || cp.elementId,
        })),
      })));
    }
  };

  // Thin wrapper for standalone use (e.g. the "Update Array" button in the
  // Array Manager dialog, which already runs synchronously from an onClick).
  const updateGhostArraysForMother = (motherId: string) => {
    const result = regenerateGhostArrays(elementsRef.current, ghostArrays, [motherId]);
    applyGhostRegenResult(result);
  };


  const { handleMouseDown, handleMouseMove, handleMouseUp } = useInputHandlers({
    elements, selectedIds, selectedIdSet, elementById,
    camera, zoom, dsWidth, renderMode, activeMode, currentTool,
    isDragging, dragStart, draggedElement, selectionBox, zoomRectBox,
    movingPivot, rotationHandle, pivotOffset, rulerPoints,
    snapEnabled, snapRadius, orthoLock, isShiftHeld, showRotationHandles,
    polarGrids, picotConnections, selectedBEs, selectedPicots,
    chainPresetSymmetric, orderGroups,
    pathDragStartRef, lastMousePosRef, isInteractingRef, draggedHandleRef,
    rotationDragStartRef, dragOffsetRef, pivotDragStartRef, pivotOffsetRef,
    rafIdRef, pendingMouseEventRef, handleMouseMoveInternalRef,
    createdNewLineRef, dragOriginRef, needsHistoryPushRef,
    dragTouchIdRef, spaceDownRef, zDownRef,
    setIsDragging, setDragStart, setZoomRectBox, setCamera, setElements,
    setSelectedIds, setSelectionBox, setDraggedElement, setRotationHandle,
    setMovingPivot, setPivotOffset, setRulerPoints, setRulerMousePos,
    setSelectedBEs, setDragTick, setTattingOrderConflict,
    setPropBarOrderDraft, setShowPropBarGroupDropdown, setTattingOrderInput,
    setSelectedPicots, setCurrentTool,
    screenToWorld, getBoundingBox, findClosestElement, getHandleAtPoint,
    getPicotPosition, getSnapPoints, findNearestSnapPointWithPolar,
    isPointInElement, getPolarPivot, pushHistoryState,
    assignOrderNumber, zoomToRect,
    ghostArrays, regenerateGhostArrays, setGhostArrays, setPicotConnections,
    skipAutoHistoryRef,
    getEndpointPseudoPicots,
  });

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

      // Select All: Ctrl+A - ghosts are not selectable
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(elementsRef.current.filter(el => el.type !== 'ghost').map(el => el.id));
        return;
      }

      // Zoom in/out: + / - (no modifier needed)
      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomToCenter(0.2);
        return;
      }
      if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomToCenter(-0.2);
        return;
      }
      
      // Fit all elements: F key (WITHOUT Ctrl/Cmd)
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fitAllElements();
        return;
      }
      
      // Path preset angles: Shift+1=90°, Shift+2=60°, Shift+3=45°
      // Only when path tool is active and a chain is selected
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && currentTool === 'path') {
        const presetMap: Record<string, number> = { '1': 90, '2': 60, '3': 45, '!': 90, '@': 60, '#': 45 };
        const presetDeg = presetMap[e.key];
        if (presetDeg !== undefined) {
          e.preventDefault();
          const sel = elementsRef.current.filter(el => selectedIdsRef.current.includes(el.id));
          if (sel.length === 1 && sel[0].type === 'chain' && sel[0].paths && sel[0].paths.length > 0) {
            const el = sel[0];
            const path = el.paths[0];
            const targetLength = el.stitchCount * dsWidth;
            if (path.type === 'cubic' && path.control1X !== undefined && path.control2X !== undefined) {
              const newPath = applyPathPreset(path, presetDeg, targetLength, true); // presets always symmetric
              if (newPath !== path) {
                setElements(prev => prev.map(e =>
                  e.id === el.id ? { ...e, paths: [newPath] } : e
                ));
                pushHistoryState(
                  elementsRef.current.map(e => e.id === el.id ? { ...e, paths: [newPath] } : e),
                  picotConnectionsRef.current,
                  orderGroupsRef.current
                );
              }
            }
          }
        }
      }

      // Line preset angles: Shift+1=90°, Shift+2=60°, Shift+3=45°, Shift+0=straight
      // Only when line tool is active and a line is selected
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && currentTool === 'line') {
        const presetMap: Record<string, number> = { '1': 90, '2': 60, '3': 45, '0': 0, '!': 90, '@': 60, '#': 45, ')': 0 };
        const presetDeg = presetMap[e.key];
        if (presetDeg !== undefined) {
          e.preventDefault();
          const sel = elementsRef.current.filter(el => selectedIdsRef.current.includes(el.id));
          if (sel.length === 1 && sel[0].type === 'line' && sel[0].paths && sel[0].paths.length > 0) {
            const el = sel[0];
            const path = el.paths[0];
            if (path.type === 'cubic' && path.control1X !== undefined && path.control2X !== undefined) {
              const newPath = applyLinePreset(path, presetDeg);
              if (newPath !== path) {
                setElements(prev => prev.map(e =>
                  e.id === el.id ? { ...e, paths: [newPath] } : e
                ));
                pushHistoryState(
                  elementsRef.current.map(e => e.id === el.id ? { ...e, paths: [newPath] } : e),
                  picotConnectionsRef.current,
                  orderGroupsRef.current
                );
              }
            }
          }
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (activeModeRef.current === 'picotJoin' && selectedPicotsRef.current.length > 0) {
          breakSelectedPicots();
        } else {
          deleteSelected();
        }
      } else if ((e.key === 'j' || e.key === 'J') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (activeModeRef.current === 'picotJoin' && selectedPicotsRef.current.length >= 2) {
          e.preventDefault();
          joinSelectedPicots();
        }
      } else if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (activeModeRef.current === 'picotJoin' && selectedPicotsRef.current.length > 0) {
          e.preventDefault();
          breakSelectedPicots();
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setCurrentTool(prev => prev === 'pan' ? 'select' : 'pan');
      } else if (e.key === 'Home' && !e.shiftKey) {
        if (selectedIdsRef.current.length > 0) { e.preventDefault(); sendToBack(); }
      } else if (e.key === 'End' && !e.shiftKey) {
        if (selectedIdsRef.current.length > 0) { e.preventDefault(); bringToFront(); }
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
          copySelected();
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
              return { ...el2, picots: newPicots };
            }));
          }
        } else {
          cutSelected();
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
            return { ...el, picots: newPicots };
          }));
        } else {
          pasteFromClipboard().catch(() => {});
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
  }, [saveProject]);

  const updateNotation = (notation, notationB = null, elementId = null) => {
    const targetId = elementId || (selectedIds.length === 1 ? selectedIds[0] : null);
    if (!targetId) return;

    // Parse and validate first — bail early if notation is invalid
    const parsed = parseNotation(notation);
    if (!parsed) return;

    const currentElement = elementsRef.current.find(e => e.id === targetId);
    if (!currentElement) return;

    // Ghosts deep-clone the mother's picots verbatim (same IDs), so a join made
    // on a ghost must be considered too — not just joins made on the mother itself.
    const ghostIdsOfMother = new Set(
      elementsRef.current
        .filter(el => el.type === 'ghost' && el.sourceId === targetId)
        .map(el => el.id)
    );
    const isTargetOrGhost = (elId: string) => elId === targetId || ghostIdsOfMother.has(elId);

    const hasExistingJoins =
      picotConnectionsRef.current.some(conn => conn.picots.some(cp => isTargetOrGhost(cp.elementId))) ||
      (currentElement.picots || []).some(p => p.isJoint);

    // Trying to surgically preserve connections/IDs across a notation edit (matching
    // by stitchesBefore position, across the mother AND every ghost sharing its picot
    // IDs) is fragile and led to visible drift (picot shows "joined" yellow after the
    // connection was actually dropped). Simpler and more predictable: if anything is
    // joined, wipe all of it and let the person redo the joins after editing.
    const applyNotationChange = () => {
      let survivingConnKeys: Set<string>;
      if (hasExistingJoins) {
        const newConns = picotConnectionsRef.current.filter(conn =>
          !conn.picots.some(cp => isTargetOrGhost(cp.elementId))
        );
        setPicotConnections(newConns);
        picotConnectionsRef.current = newConns;
        survivingConnKeys = new Set(
          newConns.flatMap(conn => conn.picots.map(cp => `${cp.elementId}::${cp.picotId}`))
        );
      } else {
        survivingConnKeys = new Set(
          picotConnectionsRef.current.flatMap(conn => conn.picots.map(cp => `${cp.elementId}::${cp.picotId}`))
        );
      }

      let capturedGhostResult: { elements: any[]; ghostArrays: any[]; connectionIdMap: Map<string, string> } | null = null;

      // Read elementsRef.current directly rather than via a setElements
      // updater — regenerateGhostArrays calls generateId() per ghost, and
      // React can invoke functional updaters more than once (e.g. Strict
      // Mode's double-invoke check for impure updaters), which would desync
      // the ghost IDs actually committed from the ones used to rewire
      // picotConnections. Computing everything as a plain value up front and
      // committing once with setElements(value) avoids that entirely.
      const updated = elementsRef.current.map(el => {
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

          // Scale existing paths proportionally — preserves rotation/flip/shape
          // same approach as closed rings and chains
          const oldTotal = el.stitchCount;
          const cx = el.center.x, cy = el.center.y;
          let finalPaths = el.paths;
          if (Math.abs(totalStitches - oldTotal) > 0.01 && oldTotal > 0) {
            const scaleFactor = totalStitches / oldTotal;
            finalPaths = el.paths.map(path => {
              const scPt = (px, py) => ({ x: cx + (px - cx) * scaleFactor, y: cy + (py - cy) * scaleFactor });
              const s = scPt(path.x, path.y), e = scPt(path.endX, path.endY);
              const c1 = scPt(path.control1X, path.control1Y), c2 = scPt(path.control2X, path.control2Y);
              return { ...path, x: s.x, y: s.y, endX: e.x, endY: e.y,
                control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
            });
          }

          // Path A runs from paths[0].x/y (start) to paths[0].endX/Y.
          // parsedA picots have stitchesBefore counting from 0 → stitchCountA.
          // We reverse the A-side positions so stitch 0 of the notation is at the path start.
          const reversedAPicots = parsedA.picots.map(p => ({
            ...p,
            stitchesBefore: stitchCountA - p.stitchesBefore,
          })).reverse();

          const allPicots = [...reversedAPicots, ...parsedB.picots.map(p => ({
            ...p, stitchesBefore: p.stitchesBefore + stitchCountA
          }))].map(p => {
            const old = (el.picots || []).find(op => op.stitchesBefore === p.stitchesBefore && (op.isJoint || survivingConnKeys.has(`${el.id}::${op.id}`)));
            return old ? { ...p, id: old.id, isJoint: survivingConnKeys.has(`${el.id}::${old.id}`) ? old.isJoint : false } : p;
          });

          return { ...el, notation: `sr: ${notationAText}`, notationB: notationBText,
            stitchCount: totalStitches,
            picots: restoreBEConfigs(allPicots, extractBEConfigs(el.picots)),
            paths: finalPaths, splitPosition: stitchCountA };
        }

        // Closed ring: scale existing paths to new stitch count, preserving rotation/flip/shape
        // Regenerating from the canonical template (createTeardropPath) would reset any
        // physical rotation applied via ±90° buttons or manual path edits — so we scale instead.
        let newPathData = {};
        if (el.isClosed) {
          const oldLength = el.stitchCount * dsWidth;
          const newLength = parsed.stitchCount * dsWidth;
          if (Math.abs(oldLength - newLength) > 0.01) {
            const cx = el.center.x, cy = el.center.y;
            const scaleFactor = newLength / oldLength;
            const scaledPaths = el.paths.map(path => {
              const scPt = (px, py) => ({ x: cx + (px - cx) * scaleFactor, y: cy + (py - cy) * scaleFactor });
              if (path.type === 'cubic') {
                const s = scPt(path.x, path.y), e = scPt(path.endX, path.endY);
                const c1 = scPt(path.control1X, path.control1Y), c2 = scPt(path.control2X, path.control2Y);
                return { ...path, x: s.x, y: s.y, endX: e.x, endY: e.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
              }
              const s = scPt(path.x, path.y), e = scPt(path.endX, path.endY), c = scPt(path.controlX, path.controlY);
              return { ...path, x: s.x, y: s.y, endX: e.x, endY: e.y, controlX: c.x, controlY: c.y };
            });
            newPathData = { paths: scaledPaths };
          }
        } else {
          // Open chain: bend curve to new length keeping endpoints fixed
          if (el.paths && el.paths.length > 0) {
            const newLength = parsed.stitchCount * dsWidth;
            const tolerance = newLength * 0.005;
            const adjustedPaths = el.paths.map(path => {
              if (path.type !== 'cubic') {
                const startX = path.x, startY = path.y;
                const scaleFactor = newLength / (el.stitchCount * dsWidth);
                return { ...path,
                  endX: startX+(path.endX-startX)*scaleFactor, endY: startY+(path.endY-startY)*scaleFactor,
                  controlX: startX+(path.controlX-startX)*scaleFactor, controlY: startY+(path.controlY-startY)*scaleFactor };
              }
              const sx=path.x,sy=path.y,ex=path.endX,ey=path.endY;
              const midX=(sx+ex)/2,midY=(sy+ey)/2;
              const axisX=ex-sx,axisY=ey-sy,perpX=-axisY,perpY=axisX;
              const perpLen=Math.hypot(perpX,perpY);
              const oldMidX=(path.control1X+path.control2X)/2,oldMidY=(path.control1Y+path.control2Y)/2;
              const sideSign=perpLen>0?(Math.sign(((oldMidX-midX)*perpX+(oldMidY-midY)*perpY))||1):1;
              const straightLen=Math.hypot(ex-sx,ey-sy);
              let minDepth=0,maxDepth=newLength,bestC1X=path.control1X,bestC1Y=path.control1Y,bestC2X=path.control2X,bestC2Y=path.control2Y;
              for (let iter=0;iter<20;iter++) {
                const tryDepth=(minDepth+maxDepth)/2;
                const offX=perpLen>0?(perpX/perpLen)*tryDepth*sideSign:0;
                const offY=perpLen>0?(perpY/perpLen)*tryDepth*sideSign:0;
                const c1x=sx+axisX*0.33+offX,c1y=sy+axisY*0.33+offY;
                const c2x=sx+axisX*0.67+offX,c2y=sy+axisY*0.67+offY;
                const tryPath={type:'cubic',x:sx,y:sy,endX:ex,endY:ey,control1X:c1x,control1Y:c1y,control2X:c2x,control2Y:c2y};
                const tryLen=calculatePathLength(sampleBezierPath(tryPath,20));
                bestC1X=c1x;bestC1Y=c1y;bestC2X=c2x;bestC2Y=c2y;
                if(Math.abs(tryLen-newLength)<tolerance)break;
                if(tryLen<newLength)minDepth=tryDepth;else maxDepth=tryDepth;
              }
              return {...path,x:sx,y:sy,endX:ex,endY:ey,control1X:bestC1X,control1Y:bestC1Y,control2X:bestC2X,control2Y:bestC2Y};
            });
            newPathData = { paths: adjustedPaths };
          }
        }

        // Merge picots: reuse old IDs for picots at the same stitchesBefore position
        // so picotConnections (already remapped above) still points to valid IDs.
        const oldPicotBySb2: Record<number, any> = {};
        (el.picots || []).forEach(p => { oldPicotBySb2[p.stitchesBefore] = p; });
        const mergedPicots = parsed.picots.map(p => {
          const old = oldPicotBySb2[p.stitchesBefore];
          if (old) {
            const isStillJoint = old.isJoint && survivingConnKeys.has(`${el.id}::${old.id}`);
            return { ...p, id: old.id, isJoint: isStillJoint };
          }
          return p;
        });

        return {
          ...el, notation, stitchCount: parsed.stitchCount,
          picots: restoreBEConfigs(mergedPicots, extractBEConfigs(el.picots)),
          isSplitChain: parsed.isSplitChain ?? el.isSplitChain ?? false,
          ...(Object.keys(newPathData).length > 0 ? newPathData : {})
        };
      });

      // Compose ghost regeneration with the notation edit when the edited
      // element is a ghost mother, so the whole thing commits as one
      // render/history step instead of two — was previously deferred via
      // pendingGhostUpdateRef + a separate effect, which caused a visible
      // two-step undo and a brief desynced frame between mother and ghosts.
      let finalElements = updated;
      const motherEl = updated.find(e => e.id === targetId);
      if (motherEl?.isGhostMother) {
        capturedGhostResult = regenerateGhostArrays(updated, ghostArrays, [targetId]);
        finalElements = capturedGhostResult.elements;
      }

      setElements(finalElements);

      if (capturedGhostResult) {
        const result = capturedGhostResult;
        setGhostArrays(result.ghostArrays);
        if (result.connectionIdMap.size > 0) {
          setPicotConnections(prev => prev.map(conn => ({
            ...conn,
            picots: conn.picots.map(cp => ({
              ...cp,
              elementId: result.connectionIdMap.get(cp.elementId) || cp.elementId,
            })),
          })));
        }
      }
    };

    if (hasExistingJoins) {
      setConfirmDialog({
        title: t('notationChangeConfirmTitle'),
        message: t('notationChangeConfirmMessage'),
        confirmLabel: t('notationChangeConfirmBtn'),
        onConfirm: applyNotationChange,
      });
    } else {
      applyNotationChange();
    }
  };

  // Update ghosts when mother element changes (notation, rotation, shape, etc.)
  const toggleShape = () => {
    if (selectedIds.length !== 1) return;

    // Read elementsRef.current directly rather than via a setElements
    // updater — see updateNotation for why (avoids React's double-invoke of
    // functional updaters desyncing regenerateGhostArrays' impure output).
    const updated = elementsRef.current.map(el => {
      if (el.id === selectedIds[0] && el.isClosed) {
        const newStyle = el.shapeStyle === 'circle' ? 'teardrop' : 'circle';
        const targetLength = el.stitchCount * dsWidth;
        const squeeze = el.squeeze || 0;
        const tempPathData = newStyle === 'circle'
          ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
          : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);

        return { ...el, shapeStyle: newStyle, paths: applyRotationToPathData(el, tempPathData).paths };
      }
      return el;
    });

    let finalElements = updated;
    let capturedGhostResult: { elements: any[]; ghostArrays: any[]; connectionIdMap: Map<string, string> } | null = null;
    const motherEl = updated.find(e => e.id === selectedIds[0]);
    if (motherEl?.isGhostMother) {
      capturedGhostResult = regenerateGhostArrays(updated, ghostArrays, [selectedIds[0]]);
      finalElements = capturedGhostResult.elements;
    }

    setElements(finalElements);

    if (capturedGhostResult) {
      const result = capturedGhostResult;
      setGhostArrays(result.ghostArrays);
      if (result.connectionIdMap.size > 0) {
        setPicotConnections(prev => prev.map(conn => ({
          ...conn,
          picots: conn.picots.map(cp => ({
            ...cp,
            elementId: result.connectionIdMap.get(cp.elementId) || cp.elementId,
          })),
        })));
      }
    }
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

  const { copyBEToClipboard, cutBEToClipboard, pasteBeClipboard } = useBEClipboard({
    selectedBEs, elementById, beClipboard, setBeClipboard, setElements,
  });

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

  // ── renderOnePicot ──────────────────────────────────────────────────────────
  // Single source of truth for all picot rendering decisions.
  // Callers (circle, split-ring, path) resolve geometry then delegate here.
  // x/y = base position on path; endX/endY = tip of arm; perpAngle = outward normal.
  const renderOnePicot = (
    p: any, key: string,
    x: number, y: number, endX: number, endY: number, perpAngle: number,
    element: any, beadAndJointOnly: boolean
  ) => {
    const isSelected = selectedPicots.some(sp => sp.elementId === element.id && sp.picotId === p.id);
    const getIsConnected = () => picotConnections.some(conn =>
      conn.picots.some(cp => cp.elementId === element.id && cp.picotId === p.id)
    );
    const dotColor = p.isCoreJoin
      ? (isSelected ? theme.cjSelected : getIsConnected() ? theme.cjConnected : theme.cjUnconnected)
      : (isSelected ? theme.jpSelected : getIsConnected() ? theme.jpConnected : theme.jpUnconnected);
    const armColor = p.isGuidePoint ? theme.gpDiamond : getSolidColor(element);
    const sw = isSelected ? '4' : '2';
    const dotR = isSelected ? 6 / zoom : 4.5 / zoom;
    const len = PICOT_SIZE[p.length] || 20;

    // ── BE ──
    if (p.beadType === 'be') {
      if (beadAndJointOnly && activeMode === 'picotJoin' && !p.beIsJoint) return null;
      if (activeMode === 'picotJoin' && p.beIsJoint && showEditingArtifacts) {
        return (
          <g key={key}>
            {renderBE(p, x, y, perpAngle, dotColor, len, isSelected)}
            <circle key={`${key}-jpd`} cx={x} cy={y} r={dotR} fill={dotColor} stroke="#000" strokeWidth={2/zoom} opacity={0.9} />
          </g>
        );
      }
      return renderBE(p, x, y, perpAngle, dotColor, len, isSelected);
    }

    // ── bcjp ──
    if (p.beadType === 'bcjp') {
      if (!beadAndJointOnly && renderMode === 'realistic') return null;
      if (activeMode === 'picotJoin' && showEditingArtifacts) {
        return (
          <g key={key}>
            {renderCoreBead(`${key}-core`, x, y, p.coreSize || 'Y', dotColor, perpAngle)}
            <circle key={`${key}-jpd`} cx={x} cy={y} r={dotR} fill={dotColor} stroke="#000" strokeWidth={2/zoom} />
          </g>
        );
      }
      const jointDotR = isSelected ? 6 / zoom : 4 / zoom;
      return (
        <g key={key}>
          {renderCoreBead(`${key}-core`, x, y, p.coreSize || 'Y', dotColor, perpAngle)}
          {renderMode !== 'realistic' && (
            <circle cx={x} cy={y} r={jointDotR} fill={dotColor} stroke="#000" strokeWidth={2 / zoom} opacity={0.7} />
          )}
        </g>
      );
    }

    // ── cj / cjp / jp / jpg ──
    if (p.isJoint) {
      // cjp realistic: arm in thread colour — baked SVG handles rest
      if (renderMode === 'realistic' && p.isCoreJoin && p.hasPicotArm) {
        return <g key={key}><line x1={x} y1={y} x2={endX} y2={endY} stroke={armColor} strokeWidth={sw} /></g>;
      }
      if (renderMode === 'realistic') return null;
      if (!showEditingArtifacts) return null;
      // cj: core join without arm — nothing visible in schematic
      if (p.isCoreJoin && !p.hasPicotArm) return null;
      // cjp: arm (+ dot in picotJoin mode)
      if (p.isCoreJoin && p.hasPicotArm) {
        if (activeMode === 'picotJoin') {
          return (
            <g key={key} data-ui="1">
              <line x1={x} y1={y} x2={endX} y2={endY} stroke={dotColor} strokeWidth={sw} />
              <circle cx={x} cy={y} r={dotR} fill={dotColor} stroke="#000" strokeWidth={2 / zoom} />
            </g>
          );
        }
        return <g key={key} data-ui="1"><line x1={x} y1={y} x2={endX} y2={endY} stroke={armColor} strokeWidth={sw} /></g>;
      }
      // jp/jpg: in normal schematic, hide arm when connected — connection line handles it
      // in picotJoin mode always fall through so the dot renders below
      if (activeMode !== 'picotJoin' && getIsConnected()) return null;
      // jp/jpg: fall through to dot (picotJoin) or arm (normal) below
    }

    // ── guide point ── no visual, pure snap target
    if (p.isGuidePoint) return null;

    // ── bead types ──
    // In realistic mode the overlay pass (beadAndJointOnly=true) renders beads on top of baked stitches.
    // The normal pass (beadAndJointOnly=false) skips them to avoid double-rendering.
    if (p.beadType === 'bcp') {
      if (!beadAndJointOnly && renderMode === 'realistic') return null;
      return renderBcpBead(key, x, y, perpAngle, p.coreSize, p.beadSeq, armColor, len);
    }
    if (p.beadType === 'bc') {
      if (!beadAndJointOnly && renderMode === 'realistic') return null;
      if (p.beadSeq) return renderClusteredBeads(key, x, y, p.beadSeq) ?? null;
      return renderCoreBead(key, x, y, p.beadSize || 'Y', armColor, perpAngle);
    }
    if (p.beadType === 'sb') {
      if (!beadAndJointOnly && renderMode === 'realistic') return null;
      if (!p.beadSeq) return null;
      return renderSuspendedBead(key, x, y, perpAngle, p.beadSeq, armColor);
    }
    if (p.beadSeq) {
      if (!beadAndJointOnly && renderMode === 'realistic') return null;
      // bjp: isJoint + beadSeq — show clustered beads + picotJoin dot
      if (p.isJoint && activeMode === 'picotJoin' && showEditingArtifacts) {
        return (
          <g key={key}>
            {renderClusteredBeads(`${key}-beads`, x, y, p.beadSeq)}
            <circle key={`${key}-jpd`} cx={x} cy={y} r={dotR} fill={dotColor} stroke="#000" strokeWidth={2/zoom} opacity={0.9} />
          </g>
        );
      }
      return renderBeadedPicot(key, x, y, perpAngle, p.beadSeq, armColor, len);
    }

    // ── picotJoin mode: dot for all remaining picots (plain + jp fallthrough) ──
    if (activeMode === 'picotJoin' && showEditingArtifacts) {
      return (
        <g key={key} data-ui="1">
          <circle cx={x} cy={y} r={dotR} fill={dotColor} stroke="#000" strokeWidth={2 / zoom} />
        </g>
      );
    }

    // ── realistic overlay pass: baked SVG handles regular picots ──
    if (beadAndJointOnly) return null;

    // ── connected in normal schematic: connection line handles the visual ──
    if (activeMode !== 'picotJoin' && getIsConnected()) return null;

    // ── plain arm ──
    return (
      <g key={key} className={p.isGuide ? 'guide-picot' : undefined}>
        <line x1={x} y1={y} x2={endX} y2={endY} stroke={armColor} strokeWidth={sw} />
      </g>
    );
  };

  const renderPicots = (element, beadAndJointOnly = false) => {
    if (!element.picots || element.picots.length === 0) return null;
    const sideMultiplier = element.picotSideMultiplier || 1;
    // Bead-type picots are offset by 0.5 DS so they sit between stitches
    const beadSb = (p) => (p.beadType === 'bc' || p.beadType === 'bcp' || p.beadType === 'be')
      ? p.stitchesBefore + 0.5 : p.stitchesBefore;

    // Special handling for circles (rendered as SVG circle, not paths)
    if (element.isClosed && element.shapeStyle === 'circle') {
      const targetCircumference = element.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      const rotation = (element.rotation || 0) * Math.PI / 180;

      return element.picots.map(p => {
        const angle = (beadSb(p) / element.stitchCount) * Math.PI * 2 - Math.PI / 2 + rotation;
        const startX = element.center.x + Math.cos(angle) * radius;
        const startY = element.center.y + Math.sin(angle) * radius;
        const len = PICOT_SIZE[p.length] || 20;
        const endX = element.center.x + Math.cos(angle) * (radius + len * sideMultiplier);
        const endY = element.center.y + Math.sin(angle) * (radius + len * sideMultiplier);
        const perpAngle = Math.atan2(endY - startY, endX - startX);
        return renderOnePicot(p, p.id, startX, startY, endX, endY, perpAngle, element, beadAndJointOnly);
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
      const so = sideMultiplier === -1 ? Math.PI : 0;

      return element.picots.map(p => {
        const sb = beadSb(p);
        const inA = p.stitchesBefore <= splitPos;
        const localFrac = inA ? sb / countA : (sb - splitPos) / countB;
        const samples = inA ? samplesA : samplesB;
        const path = inA ? pathA : pathB;
        const pathLen = inA ? lenA : lenB;

        const targetDist = localFrac * pathLen;
        let accum = 0, localT = 0;
        for (let i = 1; i < samples.length; i++) {
          const seg = Math.hypot(samples[i].x - samples[i-1].x, samples[i].y - samples[i-1].y);
          if (accum + seg >= targetDist) { localT = (i - 1 + (targetDist - accum) / seg) / (samples.length - 1); break; }
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
        const perpAngle = Math.atan2(dy, dx) - Math.PI / 2 + so;
        const len = PICOT_SIZE[p.length] || 20;
        const endX = x + Math.cos(perpAngle) * len;
        const endY = y + Math.sin(perpAngle) * len;
        return renderOnePicot(p, p.id, x, y, endX, endY, perpAngle, element, beadAndJointOnly);
      });
    }

    // Path-based rendering for teardrops and chains
    let totalLength = 0;
    const pathLengths = [];
    for (let path of element.paths) {
      pathLengths.push(calculatePathLength(sampleBezierPath(path, 20)));
      totalLength += pathLengths[pathLengths.length - 1];
    }
    const so = sideMultiplier === -1 ? Math.PI : 0;

    return element.picots.map(p => {
      const targetDist = (beadSb(p) / element.stitchCount) * totalLength;
      let accum = 0, pathIndex = 0, localT = 0;
      for (let i = 0; i < pathLengths.length; i++) {
        if (accum + pathLengths[i] >= targetDist) { pathIndex = i; localT = (targetDist - accum) / pathLengths[i]; break; }
        accum += pathLengths[i];
      }
      const path = element.paths[pathIndex];
      const t = localT;
      let x, y, dx, dy;
      if (path.type === 'cubic') {
        x = (1-t)*(1-t)*(1-t)*path.x + 3*(1-t)*(1-t)*t*path.control1X + 3*(1-t)*t*t*path.control2X + t*t*t*path.endX;
        y = (1-t)*(1-t)*(1-t)*path.y + 3*(1-t)*(1-t)*t*path.control1Y + 3*(1-t)*t*t*path.control2Y + t*t*t*path.endY;
        dx = 3*(1-t)*(1-t)*(path.control1X-path.x) + 6*(1-t)*t*(path.control2X-path.control1X) + 3*t*t*(path.endX-path.control2X);
        dy = 3*(1-t)*(1-t)*(path.control1Y-path.y) + 6*(1-t)*t*(path.control2Y-path.control1Y) + 3*t*t*(path.endY-path.control2Y);
      } else if (path.type === 'quadratic') {
        x = (1-t)*(1-t)*path.x + 2*(1-t)*t*path.controlX + t*t*path.endX;
        y = (1-t)*(1-t)*path.y + 2*(1-t)*t*path.controlY + t*t*path.endY;
        dx = 2*(1-t)*(path.controlX-path.x) + 2*t*(path.endX-path.controlX);
        dy = 2*(1-t)*(path.controlY-path.y) + 2*t*(path.endY-path.controlY);
      }
      let perpAngle: number;
      const _isHalfway = element.isClosed && Math.abs(p.stitchesBefore - element.stitchCount / 2) < 1.5;
      if (_isHalfway && element.paths?.[0]) {
        const joinX = element.paths[0].x, joinY = element.paths[0].y;
        const axDx = x - joinX, axDy = y - joinY;
        const axLen = Math.sqrt(axDx*axDx + axDy*axDy) || 1;
        perpAngle = Math.atan2(axDy / axLen, axDx / axLen) + so;
      } else {
        perpAngle = Math.atan2(dy, dx) - Math.PI / 2 + so;
      }
      const len = PICOT_SIZE[p.length] || 20;
      const endX = x + Math.cos(perpAngle) * len;
      const endY = y + Math.sin(perpAngle) * len;
      return renderOnePicot(p, p.id, x, y, endX, endY, perpAngle, element, beadAndJointOnly);
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
        const rotationRad = (element.rotation || 0) * Math.PI / 180;
        return runs.map((run, j) => {
          const angleMid = (run.midDS / element.stitchCount) * Math.PI * 2 - Math.PI / 2 + rotationRad;
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
      const rotationRad = (element.rotation || 0) * Math.PI / 180;
      
      return segments.flatMap((seg, i) => {
        const runs = getSegmentRuns(element.notation || '', seg.start, seg.start + seg.count);
        return runs.map((run, j) => {
          const angleMid = (run.midDS / element.stitchCount) * Math.PI * 2 - Math.PI / 2 + rotationRad;
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
    if (selectedIdSet.has(el.id)) return true; // never cull selected
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

  // ESC key closes modal windows — ordered by priority (outermost layer first).
  // Uses a ref so the listener is registered once and always sees current state,
  // eliminating the dep-array entirely and the stale-closure bugs it caused.
  const escapeActionRef = useRef<() => void>(() => {});
  useEffect(() => {
    escapeActionRef.current = () => {
      const closers: Array<[boolean, () => void]> = [
        [showSplash,                      () => setShowSplash(false)],
        [renderMode === 'realistic',       () => handleSetRenderMode('schematic')],
        [showColorPicker,                  () => { setShowColorPicker(false); setPickerCallback(null); setPickerGradientCallback(null); setPickerTabsAllowed(null); }],
        [showMaterialsPanel,               () => setShowMaterialsPanel(false)],
        [showAbout,                        () => setShowAbout(false)],
        [showHelpMenu,                     () => setShowHelpMenu(false)],
        [showHelp,                         () => setShowHelp(false)],
        [showUiGuide,                      () => setShowUiGuide(false)],
        [showBeadLibrary,                  () => setShowBeadLibrary(false)],
        [showPolarGridPanel,               () => setShowPolarGridPanel(false)],
        [showThreadProperties,             () => setShowThreadProperties(false)],
        [activeMode === 'picotJoin',       () => { setActiveMode(null); setShowJoinTip(false); setSelectedPicots([]); }],
        [activeMode === 'beading',         () => { setActiveMode(null); setSelectedBEs([]); }],
        [activeMode === 'tattingOrder',    () => { setActiveMode(null); setSelectedIds([]); }],
        [currentTool === 'zoomRect',       () => { setCurrentTool('select'); setZoomRectBox(null); }],
        [currentTool === 'ruler' && rulerPoints.length > 0, () => { setRulerPoints([]); setRulerMousePos(null); }],
      ];
      const hit = closers.find(([active]) => active);
      hit?.[1]();
    };
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') escapeActionRef.current(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

    // ── shared picot helpers ──────────────────────────────────────────────────
    const shouldSkipPicot = (picot: any, elId: string): boolean => {
      if (picot.isGuidePoint) return true;
      if (picot.beadType) return true;
      // cj (core join, no arm) — nothing to render
      if (picot.isCoreJoin && !picot.hasPicotArm) return true;
      // cjp (core join + arm) — render the arm, don't skip
      if (picot.isCoreJoin && picot.hasPicotArm) return false;
      // For all other picots (regular, jp): skip if they appear in any connection.
      // Checks picotConnections directly rather than relying on isJoint flag,
      // so a stale/missing flag doesn't cause double-rendering.
      return picotConnections.some(conn =>
        conn.picots.some(cp => cp.elementId === elId && cp.picotId === picot.id)
      );
    };

    const emitPicot = (
      bL: {x:number,y:number}, bR: {x:number,y:number},
      tip: {x:number,y:number}, color: string, lw: number
    ): string => {
      const cpx = 2 * tip.x - 0.5 * (bL.x + bR.x);
      const cpy = 2 * tip.y - 0.5 * (bL.y + bR.y);
      const d = `M ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${bR.x.toFixed(2)} ${bR.y.toFixed(2)}`;
      expand(bL.x, bL.y); expand(tip.x, tip.y); expand(bR.x, bR.y);
      return `<path d="${d}" stroke="black" stroke-width="${lw + 2}" fill="none" stroke-linecap="round"/>` +
             `<path d="${d}" stroke="${color}" stroke-width="${lw}" fill="none" stroke-linecap="round"/>`;
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
          if (shouldSkipPicot(picot, el.id)) continue;
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
            } else if (isSplitRing) {
              wedgePaths = renderWedgeSplitRingShapes(stitch, el, scale, offsetAmount, type, i);
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

        // ── picots first so they render underneath stitches ──
        if (el.picots?.length) {
          const N = el.stitchCount;
          const rotation = (el.rotation || 0) * Math.PI / 180;
          const picotSideDir = el.picotSideMultiplier || 1;
          let out = '';
          for (const picot of el.picots) {
            if (shouldSkipPicot(picot, el.id)) continue;
            const tipH   = (PICOT_TIP_H[picot.length] || 2.0) * dsWidth;
            const tMid   = picot.stitchesBefore / N;
            const tLeft  = Math.max(0, (picot.stitchesBefore - PICOT_BASE_OFF) / N);
            const tRight = Math.min(1, (picot.stitchesBefore + PICOT_BASE_OFF) / N);
            const angleOf = (t: number) => t * Math.PI * 2 + rotation - Math.PI / 2;
            const ptOn    = (t: number) => ({
              x: el.center.x + Math.cos(angleOf(t)) * r,
              y: el.center.y + Math.sin(angleOf(t)) * r,
            });
            const bL  = ptOn(tLeft);
            const bR  = ptOn(tRight);
            const mx  = ptOn(tMid);
            const tip = {
              x: mx.x + Math.cos(angleOf(tMid)) * picotSideDir * tipH,
              y: mx.y + Math.sin(angleOf(tMid)) * picotSideDir * tipH,
            };
            const color = elColor.isGradient
              ? getGradientColorAtPosition(elColor.id, tMid)
              : elColor.color;
            out += emitPicot(bL, bR, tip, color, el.lineWidth || 2);
          }
          frag += out;
        }
        // ── stitches after picots so they render on top ──
        frag += stitchesToSVG(stitches, true);

      } else if (el.isSplitRing) {
        // ── split ring ──
        const cached = calculateSplitRingStitches(el);
        for (const path of el.paths || []) {
          const pts = sampleBezierPath(path, 20);
          for (const pt of pts) expand(pt.x, pt.y);
        }

        // ── picots for split ring — emitted BEFORE stitches so they sit underneath ──
        if (el.picots?.length && el.paths?.[0] && el.paths?.[1]) {
          const splitPos = el.splitPosition || Math.floor(el.stitchCount / 2);
          const countA = splitPos;
          const countB = el.stitchCount - splitPos;
          const picotSideDir = el.picotSideMultiplier || 1;
          const samplesA = sampleBezierPath(el.paths[0], 60);
          const samplesB = sampleBezierPath(el.paths[1], 60);
          const lenA = calculatePathLength(samplesA);
          const lenB = calculatePathLength(samplesB);
          const lw = el.lineWidth || 2;

          // Walk a pre-computed sample array to find position at fractional distance
          // Defined once outside the picot loop — not recreated per picot
          const ptAtFrac = (samples: any[], pathLen: number, frac: number) => {
            const target = frac * pathLen;
            let accum = 0;
            for (let i = 1; i < samples.length; i++) {
              const seg = Math.hypot(
                samples[i].x - samples[i-1].x,
                samples[i].y - samples[i-1].y
              );
              if (accum + seg >= target) {
                const lt = (target - accum) / seg;
                return {
                  x: samples[i-1].x + lt * (samples[i].x - samples[i-1].x),
                  y: samples[i-1].y + lt * (samples[i].y - samples[i-1].y),
                  angle: Math.atan2(
                    samples[i].y - samples[i-1].y,
                    samples[i].x - samples[i-1].x
                  ),
                };
              }
              accum += seg;
            }
            const last = samples[samples.length - 1];
            const prev = samples[samples.length - 2] ?? last;
            return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
          };

          let out = '';
          for (const picot of el.picots) {
            if (shouldSkipPicot(picot, el.id)) continue;
            const inA = picot.stitchesBefore <= splitPos;
            const localCount = inA ? countA : countB;
            if (localCount <= 0) continue; // degenerate split — skip
            const localSb = inA ? picot.stitchesBefore : picot.stitchesBefore - splitPos;
            const samples = inA ? samplesA : samplesB;
            const pathLen = inA ? lenA : lenB;
            const tMid   = localSb / localCount;
            const tLeft  = Math.max(0, (localSb - PICOT_BASE_OFF) / localCount);
            const tRight = Math.min(1, (localSb + PICOT_BASE_OFF) / localCount);
            const tipH   = (PICOT_TIP_H[picot.length] || 2.0) * dsWidth;
            const ptMid   = ptAtFrac(samples, pathLen, tMid);
            const ptLeft  = ptAtFrac(samples, pathLen, tLeft);
            const ptRight = ptAtFrac(samples, pathLen, tRight);
            const nx =  Math.sin(ptMid.angle) * picotSideDir;
            const ny = -Math.cos(ptMid.angle) * picotSideDir;
            const bL  = { x: ptLeft.x,  y: ptLeft.y  };
            const bR  = { x: ptRight.x, y: ptRight.y };
            const tip = { x: ptMid.x + nx * tipH, y: ptMid.y + ny * tipH };
            const color = elColor.isGradient
              ? getGradientColorAtPosition(elColor.id, tMid)
              : elColor.color;
            out += emitPicot(bL, bR, tip, color, lw);
          }
          frag += out;
        }
        // ── stitches after picots so they render on top ──
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
              else pasteFromClipboard().catch(() => {});
            }}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnPaste')}
            disabled={activeMode === 'picotJoin' || (activeMode === 'beading' ? !beClipboard || selectedBEs.length === 0 : clipboard.length === 0)}
          >
            <IconPaste size={20} />
          </button>

          <div className="w-px h-6 bg-gray-600 mx-0.5" />

          <button
            onClick={sendToBack}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnSendToBack')}
            disabled={selectedIds.length === 0 || activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}
          >
            <IconSendToBack size={20} />
          </button>

          <button
            onClick={bringToFront}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnBringToFront')}
            disabled={selectedIds.length === 0 || activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}
          >
            <IconBringToFront size={20} />
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
              const el = elementById.get(lastBERef.elementId);
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
                return { ...el, picots: newPicots };
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
            const selectedEl = selectedElement;
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
              return hasNum && inActiveGroup(e);
            }).length;
            const totalInScope = elements.filter(inActiveGroup).length;

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
                        if (e.key === 'Enter') commitOrderDraft(selectedElement.id, propBarOrderDraft, e.target as HTMLInputElement);
                        if (e.key === 'Escape') { setPropBarOrderDraft(null); (e.target as HTMLInputElement).blur(); }
                      }}
                      onFocus={() => setPropBarOrderDraft(selectedElement.orderNumber ? String(selectedElement.orderNumber) : '')}
                      onBlur={() => commitOrderDraft(selectedElement.id, propBarOrderDraft)}
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
                          <ArrayInput
                            value={count}
                            onChange={n => setCount(Math.max(0, n))}
                            min={0} max={99} integer
                            className="px-1 py-0.5 bg-gray-700 rounded border border-gray-600 w-10 text-sm text-center text-white"
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
const rawNotation = e.target.value.trim();
const normalized = normalizeNotationInput(rawNotation);
const parsed = parseNotation(normalized);
const currentElement = elementById.get(selectedElement.id);
if (!currentElement) { return; }
if (parsed && parsed.stitchCount > 0) {
  setDraftNotation(null);
  updateNotation(normalized, null, currentElement.id);
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
                    const newRotation = (selectedElement.rotation || 0) - 90;
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      const polarPivot = getPolarPivot([el.id]);
                      const pivot = polarPivot || getElementPivot(el);
                      const newPaths = rotatePaths(el.paths, pivot.x, pivot.y, -90);
                      const newPivot = polarPivot
                        ? { x: pivot.x + (el.center.x - pivot.x) * Math.cos(-Math.PI/2) - (el.center.y - pivot.y) * Math.sin(-Math.PI/2),
                            y: pivot.y + (el.center.x - pivot.x) * Math.sin(-Math.PI/2) + (el.center.y - pivot.y) * Math.cos(-Math.PI/2) }
                        : getElementPivot({ ...el, paths: newPaths });
                      return { ...el, paths: newPaths, rotation: newRotation, center: { x: newPivot.x, y: newPivot.y } };
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
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      const polarPivot = getPolarPivot([el.id]);
                      const pivot = polarPivot || getElementPivot(el);
                      const newPaths = rotatePaths(el.paths, pivot.x, pivot.y, delta);
                      const rad = delta * Math.PI / 180;
                      const cos = Math.cos(rad), sin = Math.sin(rad);
                      const newPivot = polarPivot
                        ? { x: pivot.x + (el.center.x - pivot.x) * cos - (el.center.y - pivot.y) * sin,
                            y: pivot.y + (el.center.x - pivot.x) * sin + (el.center.y - pivot.y) * cos }
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
                {/* ±1° nudge arrows — side by side, press-and-hold to repeat.
                    All intermediate rotations skip history; one push on mouseUp captures the full delta. */}
                <button
                  onMouseDown={() => {
                    nudgeActiveRef.current = true;
                    nudgeAccumulatedDeltaRef.current = 1;
                    applySingleRotationDelta(selectedElement.id, 1);
                    nudgeIntervalRef.current = setInterval(() => {
                      nudgeAccumulatedDeltaRef.current += 1;
                      applySingleRotationDelta(selectedElement.id, 1, false);
                    }, 80);
                  }}
                  onMouseUp={() => {
                    if (nudgeIntervalRef.current) { clearInterval(nudgeIntervalRef.current); nudgeIntervalRef.current = null; }
                    if (nudgeActiveRef.current && nudgeAccumulatedDeltaRef.current !== 0) {
                      pushHistoryState(elementsRef.current, picotConnectionsRef.current, orderGroupsRef.current);
                    }
                    nudgeActiveRef.current = false;
                    nudgeAccumulatedDeltaRef.current = 0;
                  }}
                  onMouseLeave={() => {
                    if (nudgeIntervalRef.current) { clearInterval(nudgeIntervalRef.current); nudgeIntervalRef.current = null; }
                    if (nudgeActiveRef.current && nudgeAccumulatedDeltaRef.current !== 0) {
                      pushHistoryState(elementsRef.current, picotConnectionsRef.current, orderGroupsRef.current);
                    }
                    nudgeActiveRef.current = false;
                    nudgeAccumulatedDeltaRef.current = 0;
                  }}
                  className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 flex items-center justify-center select-none"
                  style={{fontSize:'0.6rem', lineHeight:1, minWidth:'1.4rem'}}
                  title={t('rotateNudgePlus')}
                >▲</button>
                <button
                  onMouseDown={() => {
                    nudgeActiveRef.current = true;
                    nudgeAccumulatedDeltaRef.current = -1;
                    applySingleRotationDelta(selectedElement.id, -1);
                    nudgeIntervalRef.current = setInterval(() => {
                      nudgeAccumulatedDeltaRef.current -= 1;
                      applySingleRotationDelta(selectedElement.id, -1, false);
                    }, 80);
                  }}
                  onMouseUp={() => {
                    if (nudgeIntervalRef.current) { clearInterval(nudgeIntervalRef.current); nudgeIntervalRef.current = null; }
                    if (nudgeActiveRef.current && nudgeAccumulatedDeltaRef.current !== 0) {
                      pushHistoryState(elementsRef.current, picotConnectionsRef.current, orderGroupsRef.current);
                    }
                    nudgeActiveRef.current = false;
                    nudgeAccumulatedDeltaRef.current = 0;
                  }}
                  onMouseLeave={() => {
                    if (nudgeIntervalRef.current) { clearInterval(nudgeIntervalRef.current); nudgeIntervalRef.current = null; }
                    if (nudgeActiveRef.current && nudgeAccumulatedDeltaRef.current !== 0) {
                      pushHistoryState(elementsRef.current, picotConnectionsRef.current, orderGroupsRef.current);
                    }
                    nudgeActiveRef.current = false;
                    nudgeAccumulatedDeltaRef.current = 0;
                  }}
                  className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 flex items-center justify-center select-none"
                  style={{fontSize:'0.6rem', lineHeight:1, minWidth:'1.4rem'}}
                  title={t('rotateNudgeMinus')}
                >▼</button>
                <button
                  onClick={() => {
                    const newRotation = (selectedElement.rotation || 0) + 90;
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      const polarPivot = getPolarPivot([el.id]);
                      const pivot = polarPivot || getElementPivot(el);
                      const newPaths = rotatePaths(el.paths, pivot.x, pivot.y, 90);
                      const newPivot = polarPivot
                        ? { x: pivot.x + (el.center.x - pivot.x) * Math.cos(Math.PI/2) - (el.center.y - pivot.y) * Math.sin(Math.PI/2),
                            y: pivot.y + (el.center.x - pivot.x) * Math.sin(Math.PI/2) + (el.center.y - pivot.y) * Math.cos(Math.PI/2) }
                        : getElementPivot({ ...el, paths: newPaths });
                      return { ...el, paths: newPaths, rotation: newRotation, center: { x: newPivot.x, y: newPivot.y } };
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
                    value={elements.find(e => selectedIdSet.has(e.id))?.labelOffset ?? 8}
                    onChange={e => setLabelOffset(Number(e.target.value))}
                    className="w-20 accent-blue-500"
                    title={t('propNotationPos')}
                  />
                </div>

                {/* Hide notation label toggle */}
                <button
                  onClick={() => {
                    const allHidden = elements.filter(e => selectedIdSet.has(e.id)).every(e => e.hideLabel);
                    setElements(prev => prev.map(el =>
                      selectedIdSet.has(el.id) ? { ...el, hideLabel: !allHidden } : el
                    ));
                  }}
                  className={`px-2 py-1 rounded text-xs ${
                    elements.filter(e => selectedIdSet.has(e.id)).every(e => e.hideLabel)
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                  title={t('propHideLabel')}
                >
                  {elements.filter(e => selectedIdSet.has(e.id)).every(e => e.hideLabel)
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
                          selectedIdSet.has(el.id) ? { ...el, polarRotationGridId: val } : el
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
                    if (e.key === 'Enter') commitOrderDraft(selectedElement.id, propBarOrderDraft, e.target as HTMLInputElement);
                    if (e.key === 'Escape') { setPropBarOrderDraft(null); (e.target as HTMLInputElement).blur(); }
                  }}
                  onFocus={e => setPropBarOrderDraft(selectedElement.orderNumber ? String(selectedElement.orderNumber) : '')}
                  onBlur={() => commitOrderDraft(selectedElement.id, propBarOrderDraft)}
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
                            return applyRotationToPathData({ ...el, squeeze }, createSplitRingPathFromEl(el, dsWidth, { squeeze }));
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
                            return applyRotationToPathData({ ...el, squeezeCA }, createSplitRingPathFromEl(el, dsWidth, { squeezeCA }));
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
                            return applyRotationToPathData({ ...el, squeezeCB }, createSplitRingPathFromEl(el, dsWidth, { squeezeCB }));
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
                            return { ...el, squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75, rotation: 0,
                              ...createSplitRingPathFromEl(el, dsWidth, { squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75 }) };
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
                      selectedIdSet.has(el.id) ? { ...el, materialId: matId } : el
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
                           selectedIdSet.has(el.id) ? { ...el, materialIdB: matId } : el
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
                            const _ppN = getPolarPivot(selectedIds);
                            const gcx = _ppN ? _ppN.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
                            const gcy = _ppN ? _ppN.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
                            const cos = Math.cos(-Math.PI/2), sin = Math.sin(-Math.PI/2);
                            setElements(prev => prev.map(el => {
                              if (!selectedIdSet.has(el.id)) return el;
                              const dx = el.center.x - gcx, dy = el.center.y - gcy;
                              return { ...el,
                                center: { x: gcx + dx * cos - dy * sin, y: gcy + dx * sin + dy * cos },
                                paths: rotatePaths(el.paths, gcx, gcy, -90),
                                rotation: ((el.rotation || 0) - 90) % 360 };
                            }));
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
                            const _ppP = getPolarPivot(selectedIds);
                            const gcx = _ppP ? _ppP.x : groupElements.reduce((s, e) => s + e.center.x, 0) / groupElements.length;
                            const gcy = _ppP ? _ppP.y : groupElements.reduce((s, e) => s + e.center.y, 0) / groupElements.length;
                            const cos = Math.cos(Math.PI/2), sin = Math.sin(Math.PI/2);
                            setElements(prev => prev.map(el => {
                              if (!selectedIdSet.has(el.id)) return el;
                              const dx = el.center.x - gcx, dy = el.center.y - gcy;
                              return { ...el,
                                center: { x: gcx + dx * cos - dy * sin, y: gcy + dx * sin + dy * cos },
                                paths: rotatePaths(el.paths, gcx, gcy, 90),
                                rotation: ((el.rotation || 0) + 90) % 360 };
                            }));
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
                              selectedIdSet.has(el.id) ? { ...el, hideLabel: !allHidden } : el
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
                                  selectedIdSet.has(el.id) ? { ...el, polarRotationGridId: val } : el
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
                const selEls = elements.filter(e => selectedIdSet.has(e.id));

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
                                  selectedIdSet.has(el.id) && el.type === 'line'
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
                              if (!selectedIdSet.has(el.id)) return el;
                              if (getElType(el) === 'line') return el;
                              if (el.isSplitRing) {
                                const newParsed = parseNotation(notation);
                                if (!newParsed) return el;
                                const splitPos = el.splitPosition ?? 0;
                                const scaleFactor = el.stitchCount > 0 ? newParsed.stitchCount / el.stitchCount : 1;
                                const cx = el.center.x, cy = el.center.y;
                                const scaledPaths = Math.abs(scaleFactor - 1) < 0.001 ? el.paths : el.paths.map(path => {
                                  const scPt = (px, py) => ({ x: cx + (px - cx) * scaleFactor, y: cy + (py - cy) * scaleFactor });
                                  const s = scPt(path.x, path.y), e2 = scPt(path.endX, path.endY);
                                  const c1 = scPt(path.control1X, path.control1Y), c2 = scPt(path.control2X, path.control2Y);
                                  return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
                                });
                                // Preserve side B picots (stitchesBefore > splitPos) — they belong
                                // to notationB which is unchanged. Only side A picots are replaced.
                                const sideBPicots = (el.picots || []).filter(p => p.stitchesBefore > splitPos);
                                const mergedPicots = restoreBEConfigs(
                                  [...newParsed.picots, ...sideBPicots],
                                  extractBEConfigs(el.picots)
                                );
                                return { ...el, notation, stitchCount: newParsed.stitchCount, picots: mergedPicots, paths: scaledPaths };
                              }
                              const newParsed = parseNotation(notation);
                              if (!newParsed) return el;
                              if (el.type === 'ring') {
                                const scaleFactor = el.stitchCount > 0 ? newParsed.stitchCount / el.stitchCount : 1;
                                const cx = el.center.x, cy = el.center.y;
                                const scaledPaths = Math.abs(scaleFactor - 1) < 0.001 ? el.paths : el.paths.map(path => {
                                  const scPt = (px, py) => ({ x: cx + (px - cx) * scaleFactor, y: cy + (py - cy) * scaleFactor });
                                  if (path.type === 'cubic') {
                                    const s = scPt(path.x, path.y), e2 = scPt(path.endX, path.endY);
                                    const c1 = scPt(path.control1X, path.control1Y), c2 = scPt(path.control2X, path.control2Y);
                                    return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
                                  }
                                  const s = scPt(path.x, path.y), e2 = scPt(path.endX, path.endY), c = scPt(path.controlX, path.controlY);
                                  return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: c.x, controlY: c.y };
                                });
                                return { ...el, notation, stitchCount: newParsed.stitchCount, picots: restoreBEConfigs(newParsed.picots, extractBEConfigs(el.picots)), paths: scaledPaths };
                              }
                              return { ...el, notation, stitchCount: newParsed.stitchCount, picots: restoreBEConfigs(newParsed.picots, extractBEConfigs(el.picots)), isSplitChain: newParsed.isSplitChain ?? el.isSplitChain ?? false };
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
                            selectedIdSet.has(el.id) ? { ...el, hideLabel: !allHidden } : el
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
                                selectedIdSet.has(el.id) ? { ...el, polarRotationGridId: val } : el
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
                            if (!selectedIdSet.has(el.id)) return el;
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

        {/* ── Path Preset Panel — floating overlay, path tool + chain selected ── */}
        {currentTool === 'path' && selectedIds.length === 1 && (() => {
          const chain = elementById.get(selectedIds[0]);
          if (chain?.type !== 'chain' || !chain?.paths?.length || chain.paths[0].type !== 'cubic') return null;
          return (
            <div className="flex justify-center pointer-events-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, padding: '0.35rem 0' }}>
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded border border-gray-600 shadow-lg pointer-events-auto">
                {[
                  { label: '90°', key: '1', deg: 90 },
                  { label: '60°', key: '2', deg: 60 },
                  { label: '45°', key: '3', deg: 45 },
                ].map(preset => (
                  <button
                    key={preset.key}
                    onClick={() => {
                      const el = chain;
                      const path = el.paths[0];
                      const targetLength = el.stitchCount * dsWidth;
                      const newPath = applyPathPreset(path, preset.deg, targetLength, true); // presets always symmetric
                      if (newPath !== path) {
                        setElements(prev => prev.map(e =>
                          e.id === el.id ? { ...e, paths: [newPath] } : e
                        ));
                        pushHistoryState(
                          elementsRef.current.map(e => e.id === el.id ? { ...e, paths: [newPath] } : e),
                          picotConnectionsRef.current,
                          orderGroupsRef.current
                        );
                      }
                    }}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 border border-gray-600 hover:border-blue-500 transition-colors"
                    title={`Apply ${preset.label} preset (Shift+${preset.key})`}
                  >
                    {preset.label}
                  </button>
                ))}
                <div className="w-px h-4 bg-gray-600 mx-1" />
                <button
                  onClick={() => setChainPresetSymmetric(s => !s)}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${
                    chainPresetSymmetric
                      ? 'bg-blue-700 border-blue-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-blue-500'
                  }`}
                  title={chainPresetSymmetric ? 'Symmetric arms (click to make asymmetric)' : 'Asymmetric arms (click to make symmetric)'}
                >
                  ⇔
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Line Preset Panel — floating overlay, line tool + line selected ── */}
        {currentTool === 'line' && selectedIds.length === 1 && (() => {
          const line = elementById.get(selectedIds[0]);
          if (line?.type !== 'line' || !line?.paths?.length || line.paths[0].type !== 'cubic') return null;
          return (
            <div className="flex justify-center pointer-events-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, padding: '0.35rem 0' }}>
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded border border-gray-600 shadow-lg pointer-events-auto">
                {[
                  { label: '90°', key: '1', deg: 90 },
                  { label: '60°', key: '2', deg: 60 },
                  { label: '45°', key: '3', deg: 45 },
                  { label: '0°', key: '0', deg: 0 },
                ].map(preset => (
                  <button
                    key={preset.key}
                    onClick={() => {
                      const el = line;
                      const path = el.paths[0];
                      const newPath = applyLinePreset(path, preset.deg);
                      if (newPath !== path) {
                        setElements(prev => prev.map(e =>
                          e.id === el.id ? { ...e, paths: [newPath] } : e
                        ));
                        pushHistoryState(
                          elementsRef.current.map(e => e.id === el.id ? { ...e, paths: [newPath] } : e),
                          picotConnectionsRef.current,
                          orderGroupsRef.current
                        );
                      }
                    }}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 border border-gray-600 hover:border-blue-500 transition-colors"
                    title={`Apply ${preset.label} preset (Shift+${preset.key})`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

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
            onClick={() => zoomToCenter(-0.2)} 
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
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
            style={{ touchAction: 'manipulation' }}
            title="Fit All (F)"
          >
            <IconFitView size={20} />
          </button>
          <button
            onClick={() => setCurrentTool(prev => prev === 'zoomRect' ? 'select' : 'zoomRect')}
            className={`p-2 rounded pointer-events-auto ${currentTool === 'zoomRect' ? 'bg-yellow-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={t('toolZoomRect')}
          >
            <IconZoomRect size={20} />
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
            // For any active drag (element translate, pivot move, or rotation handle),
            // track ONLY the finger that started it — prevents teleporting if a second finger joins.
            if (dragOffsetRef.current.active || movingPivotRef.current || rotationHandleRef.current) {
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
            if (dragOffsetRef.current.active || movingPivotRef.current || rotationHandleRef.current) {
              // Commit only when the tracked drag finger lifts.
              const trackedStillDown = dragTouchIdRef.current !== null
                && Array.from(e.touches).some(t => t.identifier === dragTouchIdRef.current);
              if (!trackedStillDown) {
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
                  if (picot) return getPicotPosition(el, picot, true);
                  // Endpoint pseudo-picot (__start__, __end__, __anchor__)
                  const ep = getEndpointPseudoPicots(el).find(e => e.id === p.picotId);
                  return ep ? { x: ep.x, y: ep.y } : null;
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
                  const beadSeqForConnR = getConnectionBeadSeq(conn);
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
                  const beadSeqForConn = getConnectionBeadSeq(conn);
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

                const isSelected = selectedIdSet.has(el.id);
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
                // Ghost elements are non-interactive visual copies
                const isGhost = el.type === 'ghost';
                // Single source of truth: ghost opacity and pointer events
                const ghostOpacity = isGhost ? (el.isBoundary ? 0.65 : 0.4) : 1;
                const ghostPointerEvents = isGhost && !el.isBoundary ? 'none' as const : undefined;
                // PERFORMANCE: During translate-drag, apply offset via SVG transform instead of
                // mutating element state. Keeps stitchCache valid throughout the drag.
                const dragTransform = (isSelected && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})`
                  : undefined;
                // PERFORMANCE: getElementColor once per element, reused for stroke + picots
                // For ghosts, get color from source element
                const sourceElement = isGhost ? elementById.get(el.sourceId) : null;
                const renderEl = sourceElement || el;
                const elColor = getElementColor(renderEl);
                const elStrokeVal = elColor.isGradient ? `url(#gradient-${elColor.id})` : elColor.color;
                // Split ring section B color (only relevant for split rings)
                const elColorB = renderEl.isSplitRing ? getElementColor({...renderEl, materialId: renderEl.materialIdB || renderEl.materialId}) : elColor;
                const elStrokeValB = elColorB.isGradient ? `url(#gradient-${elColorB.id})` : elColorB.color;

                // Render circles as SVG circle element for smooth rendering
                if (el.isClosed && el.shapeStyle === 'circle') {
                  const targetCircumference = el.stitchCount * dsWidth;
                  const radius = targetCircumference / (2 * Math.PI);

                  // Original schematic rendering for circles
                  return (
                    <g key={el.id} filter={elementFilter} transform={dragTransform} style={{ pointerEvents: ghostPointerEvents }}>
                      <circle
                        cx={el.center.x}
                        cy={el.center.y}
                        r={radius}
                        fill="none"
                        stroke={elStrokeVal}
                        strokeWidth="3.75"
                        opacity={isSelected ? 0.7 : ghostOpacity}
                        strokeDasharray={isGhost ? '5,5' : undefined}
                      />
                      {/* Ghosts don't show picots, EXCEPT boundary ghosts.
                          In realistic mode, picots are in bakedRealisticSVG. */}
                      {renderMode !== 'realistic' && (!isGhost || el.isBoundary) && renderPicots(el)}
                      {!isGhost && isSelected && (
                        <circle
                          cx={el.center.x}
                          cy={el.center.y}
                          r={radius}
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
                      <g key={`${el.id}-labels`} data-layer="notation">{(el.hideLabel || hideNotationInMode || isGhost) ? null : renderStitchLabels(el)}</g>
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
                  <g key={el.id} filter={elementFilter} transform={dragTransform} style={{ pointerEvents: ghostPointerEvents }}>
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
                                opacity={isSelected ? 0.7 : ghostOpacity}
                                strokeDasharray={isGhost ? '5,5' : undefined}
                              />
                              {/* Colored line on top */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke={elStrokeVal}
                                strokeWidth={el.lineWidth || 2}
                                opacity={isSelected ? 0.7 : ghostOpacity}
                                strokeDasharray={isGhost ? '5,5' : undefined}
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
                    {/* Picots rendered first so they sit behind the path strokes.
                        In realistic mode, picots are baked into bakedRealisticSVG — skip here. */}
                    {renderMode !== 'realistic' && (!isGhost || el.isBoundary) && renderPicots(el)}
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
                                opacity={isSelected ? 0.7 : ghostOpacity}
                                strokeDasharray={isGhost ? '5,5' : undefined}
                              />
                              {/* Colored line on top */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke={elStrokeVal}
                                strokeWidth={el.lineWidth || 2}
                                opacity={isSelected ? 0.7 : ghostOpacity}
                                strokeDasharray={isGhost ? '5,5' : undefined}
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
                              opacity={isSelected ? 0.7 : ghostOpacity}
                              strokeDasharray={isGhost ? '5,5' : undefined}
                            />
                          );
                        })}
                        {/* Dashed connection line for split rings - along height line */}
                        {el.isSplitRing && el.paths.length >= 2 && (() => {
                          // paths[0] goes from x/y (A-start) to endX/Y (A-end).
                          // Each flip inverts the visual direction — odd number of flips = swap.
                          const flipCount = (el.isFlippedH ? 1 : 0) + (el.isFlippedV ? 1 : 0);
                          const flipped = flipCount % 2 === 1;
                          const x1 = flipped ? el.paths[0].x    : el.paths[0].endX;
                          const y1 = flipped ? el.paths[0].y    : el.paths[0].endY;
                          const x2 = flipped ? el.paths[0].endX : el.paths[0].x;
                          const y2 = flipped ? el.paths[0].endY : el.paths[0].y;
                          // Arrowhead pointing AWAY from x2/y2 — shows direction of travel along path A
                          const angle = Math.atan2(y2 - y1, x2 - x1);
                          const arrSize = (el.lineWidth || 2) * 3;
                          const ax1 = x2 + arrSize * Math.cos(angle - 0.4 + Math.PI);
                          const ay1 = y2 + arrSize * Math.sin(angle - 0.4 + Math.PI);
                          const ax2 = x2 + arrSize * Math.cos(angle + 0.4 + Math.PI);
                          const ay2 = y2 + arrSize * Math.sin(angle + 0.4 + Math.PI);
                          return (
                            <>
                              <line x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke="#000000" strokeWidth={(el.lineWidth || 2) + 2}
                                strokeDasharray="5,5" opacity={isSelected ? 0.7 : ghostOpacity}
                              />
                              <line x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke={elStrokeValB} strokeWidth={el.lineWidth || 2}
                                strokeDasharray="5,5" opacity={isSelected ? 0.7 : ghostOpacity}
                              />
                              {/* Arrowhead pointing to the start of notation A */}
                              <polyline points={`${ax1},${ay1} ${x2},${y2} ${ax2},${ay2}`}
                                fill="none" stroke="#000000" strokeWidth={(el.lineWidth || 2) + 2}
                                strokeLinejoin="round" strokeLinecap="round"
                                opacity={isSelected ? 0.7 : ghostOpacity}
                              />
                              <polyline points={`${ax1},${ay1} ${x2},${y2} ${ax2},${ay2}`}
                                fill="none" stroke={elStrokeValB} strokeWidth={el.lineWidth || 2}
                                strokeLinejoin="round" strokeLinecap="round"
                                opacity={isSelected ? 0.7 : ghostOpacity}
                              />
                            </>
                          );
                        })()}
                        {/* Ghosts don't show picots — realistic overlay rendered outside opacity group */}
                        {!isGhost && isSelected && (
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
                        <g key={`${el.id}-labels`} data-layer="notation">{(el.hideLabel || hideNotationInMode || isGhost) ? null : renderStitchLabels(el)}</g>
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
                const selEls = elements.filter(e => selectedIdSet.has(e.id));
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

                // Use createPolarInstance for each preview ghost — ensures positioning matches creation
                const ghosts = [];
                for (let i = 1; i < polarArrayCount; i++) {
                  selEls.forEach(el => {
                    const previewEl = createPolarInstance(el, i, pivX, pivY, polarArrayCount, polarArrayAngle, {});

                    if (el.isClosed && el.shapeStyle === 'circle') {
                      const r = (el.stitchCount * dsWidth) / (2 * Math.PI);
                      ghosts.push(
                        <circle key={`ghost-${i}-${el.id}`}
                          cx={previewEl.center.x} cy={previewEl.center.y} r={r}
                          fill="none" stroke="#60a5fa" strokeWidth={2 / zoom}
                          strokeDasharray={`${6/zoom} ${4/zoom}`}
                          opacity={0.55} pointerEvents="none"
                        />
                      );
                    } else if (previewEl.paths && previewEl.paths.length > 0) {
                      const pathStrs = previewEl.paths.map((p: any) => {
                        if (p.type === 'cubic') return `M${p.x},${p.y} C${p.control1X},${p.control1Y} ${p.control2X},${p.control2Y} ${p.endX},${p.endY}`;
                        return `M${p.x},${p.y} Q${p.controlX},${p.controlY} ${p.endX},${p.endY}`;
                      }).join(' ');
                      ghosts.push(
                        <path key={`ghost-${i}-${el.id}`}
                          d={pathStrs}
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
                const selEls = elements.filter(e => selectedIdSet.has(e.id));
                if (selEls.length === 0 || linearArrayCount < 2) return null;

                // Project bbox onto array direction for accurate spacing
                const { elementSize } = calculatePathBbox(selEls, linearArrayAngle);
                // Center-to-center: 100% = just touching, 200% = 1 element gap
                const spacing = elementSize * linearArraySpacing / 100;
                const rad = linearArrayAngle * Math.PI / 180;
                const dx = Math.cos(rad) * spacing;
                const dy = Math.sin(rad) * spacing;

                // Use createLinearInstance for each preview ghost — ensures positioning matches creation
                const ghosts = [];
                for (let i = 1; i < linearArrayCount; i++) {
                  selEls.forEach(el => {
                    const previewEl = createLinearInstance(el, i, dx, dy, linearArrayRotStep, {});
                    const d = previewEl.paths?.map((p: any) => {
                      if (p.type === 'cubic') return `M${p.x},${p.y} C${p.control1X},${p.control1Y} ${p.control2X},${p.control2Y} ${p.endX},${p.endY}`;
                      return `M${p.x},${p.y} Q${p.controlX},${p.controlY} ${p.endX},${p.endY}`;
                    }).join(' ');
                    if (d) {
                      ghosts.push(<path key={`lgh-${i}-${el.id}`} d={d} fill="none" stroke="#34d399" strokeWidth={2/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} opacity={0.55} pointerEvents="none" />);
                    }
                  });
                }
                return <g>{ghosts}</g>;
              })()}

              {/* ── Spiral Array ghost preview ───────────────────────────── */}
              {showSpiralArrayDialog && (() => {
                const selEls = elements.filter(e => selectedIdSet.has(e.id));
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
                const jpDragTransform = (selectedIdSet.has(el.id) && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})` : undefined;
                return <g key={`jp-overlay-${el.id}`} transform={jpDragTransform}>{renderPicots(el, true)}</g>;
              })}
              {/* In picotJoin mode: full-size transparent rect to catch stray clicks */}
              {activeMode === 'picotJoin' && (
                <rect x="-5000" y="-5000" width="10000" height="10000" fill="transparent" style={{ pointerEvents: 'none' }} />
              )}
              {/* Beading mode: BE picots rendered at full brightness */}
              {activeMode === 'beading' && elements.map(el => {
                const beDragTransform = (selectedIdSet.has(el.id) && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})` : undefined;
                return <g key={`be-overlay-${el.id}`} transform={beDragTransform}>{renderPicots(el, true)}</g>;
              })}
              {/* Realistic mode: BE/bead picots rendered outside the opacity-0 element group */}
              {renderMode === 'realistic' && elements.map(el => {
                if (el.type === 'ghost' && !el.isBoundary) return null;
                const dragTransform = (selectedIdSet.has(el.id) && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})` : undefined;
                return <g key={`realistic-be-${el.id}`} transform={dragTransform}>{renderPicots(el, true)}</g>;
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
                  .filter(el => !selectedIdSet.has(el.id))
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

              {/* Endpoint pseudo-picot dots in picotJoin mode */}
              {activeMode === 'picotJoin' && showEditingArtifacts && renderMode !== 'realistic' && elements.map(el => {
                const eps = getEndpointPseudoPicots(el);
                if (!eps.length) return null;
                return eps.map(ep => {
                  const isSelected = selectedPicots.some(sp => sp.elementId === el.id && sp.picotId === ep.id);
                  const isConnected = picotConnections.some(conn =>
                    conn.picots.some(cp => cp.elementId === el.id && cp.picotId === ep.id)
                  );
                  const fill = isSelected ? theme.jpSelected : isConnected ? theme.jpConnected : theme.jpUnconnected;
                  const r = isSelected ? 6 / zoom : 4.5 / zoom;
                  return (
                    <circle
                      key={`ep-${el.id}-${ep.id}`}
                      data-ui="1"
                      cx={ep.x} cy={ep.y} r={r}
                      fill={fill} stroke="#000" strokeWidth={2 / zoom}
                      opacity={0.9}
                    />
                  );
                });
              })}

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
                        <circle cx={bbox.x} cy={bbox.y} r={8 / zoom} fill="#3B82F6" stroke="#FFF" strokeWidth={2 / zoom} className="cursor-grab" />
                        <circle cx={bbox.x + bbox.width} cy={bbox.y} r={8 / zoom} fill="#3B82F6" stroke="#FFF" strokeWidth={2 / zoom} className="cursor-grab" />
                        <circle cx={bbox.x + bbox.width} cy={bbox.y + bbox.height} r={8 / zoom} fill="#3B82F6" stroke="#FFF" strokeWidth={2 / zoom} className="cursor-grab" />
                        <circle cx={bbox.x} cy={bbox.y + bbox.height} r={8 / zoom} fill="#3B82F6" stroke="#FFF" strokeWidth={2 / zoom} className="cursor-grab" />
                      </>
                    )}
                    
                    {/* Pivot point (orange with crosshairs) - show when Shift is held OR toggle is on */}
                    {shouldShowRotationHandles && (
                      <>
                        <circle 
                          cx={pivotX} 
                          cy={pivotY} 
                          r={10 / zoom}
                          fill="#FF8C00" 
                          stroke="#FFF"
                          strokeWidth={2 / zoom}
                          className="cursor-move"
                        />
                        <line 
                          x1={pivotX - 10 / zoom} 
                          y1={pivotY} 
                          x2={pivotX + 10 / zoom} 
                          y2={pivotY} 
                          stroke="#FFF"
                          strokeWidth={2 / zoom}
                        />
                        <line 
                          x1={pivotX} 
                          y1={pivotY - 10 / zoom} 
                          x2={pivotX} 
                          y2={pivotY + 10 / zoom} 
                          stroke="#FFF"
                          strokeWidth={2 / zoom}
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
        const targetEl = elementById.get(tattingOrderConflict.targetElId);
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
                    {recents.map(entry => {
                      const pathMissing = !entry.filename;
                      return (
                        <div key={entry.id}
                          className={`bg-gray-700 rounded-lg overflow-hidden border transition-colors group ${pathMissing ? 'border-gray-700 opacity-50 cursor-not-allowed' : 'border-gray-600 hover:border-purple-500 cursor-pointer'}`}
                          title={pathMissing ? t('recentProjectsPathMissing') : entry.filename}
                          onClick={() => { if (!pathMissing) doLoad(() => { setShowRecentProjectsDialog(false); loadFromPath(entry.filename); }); }}>

                          {/* Thumbnail */}
                          <div className="w-full bg-gray-900 flex items-center justify-center relative" style={{ aspectRatio: '3/2' }}>
                            {entry.thumbPath
                              ? <img
                                  src={thumbSrcFor(entry.thumbPath)}
                                  alt={entry.name}
                                  className="w-full h-full object-contain"
                                  draggable={false}
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    // Show fallback sibling
                                    const fallback = img.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              : null
                            }
                            <div
                              className="absolute inset-0 flex-col items-center justify-center text-center px-2 gap-1"
                              style={{ display: entry.thumbPath ? 'none' : 'flex' }}
                            >
                              <div className="text-gray-500 text-xs">{entry.name}</div>
                              <div className="text-gray-600 text-xs">{t('recentProjectsNoPreview')}</div>
                            </div>
                          </div>

                          {/* Info + actions */}
                          <div className="px-3 py-2">
                            <div className="text-white text-sm font-medium truncate" title={entry.name}>{entry.name}</div>
                            <div className="text-gray-400 text-xs mt-0.5">{t('recentProjectsSaved').replace('{date}', new Date(entry.savedAt).toLocaleDateString())}</div>
                            {pathMissing && (
                              <div className="text-yellow-600 text-xs mt-1">⚠ {t('recentProjectsPathMissingLabel')}</div>
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                disabled={pathMissing}
                                className={`flex-1 py-1 rounded text-xs font-semibold ${pathMissing ? 'bg-gray-600 text-gray-500 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-600 text-white'}`}
                                onClick={(ev) => { ev.stopPropagation(); if (!pathMissing) doLoad(() => { setShowRecentProjectsDialog(false); loadFromPath(entry.filename); }); }}
                              >{t('recentProjectsLoadBtn')}</button>
                              <button
                                className="py-1 px-2 rounded bg-gray-600 hover:bg-red-700 text-gray-300 hover:text-white text-xs"
                                title={t('recentProjectsDeleteBtn')}
                                onClick={(ev) => { ev.stopPropagation(); removeEntry(entry.id); }}
                              >✕</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer — Browse + Clear unavailable */}
              <div className="flex justify-between items-center px-5 py-4 border-t border-gray-600 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="text-gray-500 text-xs">{recents.length > 0 ? `${recents.length} / 20` : ''}</div>
                  {recents.some(e => !e.filename) && (
                    <button
                      onClick={() => {
                        const cleaned = recents.filter(e => !!e.filename);
                        localStorage.setItem('tcad_recent_projects', JSON.stringify(cleaned));
                        setShowRecentProjectsDialog(false);
                        setTimeout(() => setShowRecentProjectsDialog(true), 0);
                      }}
                      className="text-xs text-yellow-600 hover:text-yellow-400 underline underline-offset-2"
                      title={t('recentProjectsClearUnavailableHint')}
                    >
                      {t('recentProjectsClearUnavailable')}
                    </button>
                  )}
                </div>
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

          {/* Grid selector — only shown when 2+ grids exist */}
          {polarGrids.length > 1 && (
            <div className="flex items-center gap-2 px-4 py-1">
              <span className="text-xs text-gray-400">{t('arrangeGridSelectorLabel')}</span>
              <select
                value={selectedPolarGridId || ''}
                onChange={(e) => setSelectedPolarGridId(e.target.value)}
                className="flex-1 px-2 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white"
              >
                {polarGrids.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {polarGrids.length > 0 ? (
            <button
              onClick={() => { centerToPolarGrid(selectedPolarGridId || undefined); setShowArrangeMenu(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${
                selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={selectedIds.length === 0}
            >
              <IconPolarGrid size={16} />
              <span>{t('arrangeCenterToPolarGrid')}</span>
            </button>
          ) : (
            <div className="px-4 py-2 text-xs text-gray-500 italic">No polar grids</div>
          )}

          <button
            onClick={() => { alignToGridHorizontal(selectedPolarGridId || undefined); setShowArrangeMenu(false); }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${(selectedIds.length === 0 || polarGrids.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={selectedIds.length === 0 || polarGrids.length === 0}
          >
            <IconPolarGrid size={16} />
            <span>{t('arrangeAlignToGridH')}</span>
          </button>

          <button
            onClick={() => { alignToGridVertical(selectedPolarGridId || undefined); setShowArrangeMenu(false); }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200 ${(selectedIds.length === 0 || polarGrids.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={selectedIds.length === 0 || polarGrids.length === 0}
          >
            <IconPolarGrid size={16} />
            <span>{t('arrangeAlignToGridV')}</span>
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Array section — all three array types together */}
          <div className="px-3 py-1 text-xs text-gray-400 font-semibold">{t('arrangeArrayHeader')}</div>

          <button
            onClick={() => {
              const linked = selectedIds.length > 0 ? (() => {
                const els = elements.filter(e => selectedIdSet.has(e.id));
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
            <span>{t('ghostArrayManagerTitle')}</span>
          </button>

          {/* Polar Grids */}
          <button
            onClick={() => { setShowPolarGridPanel(true); setShowArrangeMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
          >
            <span>{t('viewPolarGrids')}</span>
          </button>
        </div>
      </>
    )}

    {/* Ghost Array Manager Modal */}
    {showArrayManager && (
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2147483647 }}>
        <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 flex flex-col"
          style={{ width: 'min(560px, 95vw)', maxHeight: '85dvh' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-600 flex-shrink-0">
            <h2 className="text-gray-100 font-bold text-lg">{t('ghostArrayManagerTitle')}</h2>
            <button onClick={() => setShowArrayManager(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
          </div>
          <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1" style={{minHeight:0}}>
            {ghostArrays.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{t('ghostArrayManagerEmpty')}</p>
            ) : (
              ghostArrays.map((array) => {
                const sourceEl = elementById.get(array.sourceId);
                const existingGhosts = elements.filter(el => el.type === 'ghost' && el.sourceId === array.sourceId);
                return (
                  <div key={array.id} className="flex flex-col gap-2 bg-gray-700 rounded-lg px-3 py-3">
                    {/* Header row: type + source status + action buttons */}
                    <div className="flex items-center gap-2">
                      <span className="text-2xl flex-shrink-0">👻</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium capitalize">{array.type} array</div>
                        <div className="text-gray-400 text-xs">{t('ghostArraySource')}: {sourceEl ? '✓' : t('ghostArraySourceDeleted')}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (sourceEl) {
                            setSelectedIds([sourceEl.id]);
                          } else {
                            const firstGhost = existingGhosts[0];
                            if (firstGhost) setSelectedIds([firstGhost.id]);
                          }
                          setShowArrayManager(false);
                        }}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded"
                        title={sourceEl ? t('ghostArraySelectTitle') : t('ghostArraySelectGhostTitle')}
                      >{t('ghostArraySelect')}</button>
                      <button
                        onClick={() => {
                          // Delete ghosts by sourceId (ghostIds may be stale after undo)
                          setElements(prev => prev.filter(el => !(el.type === 'ghost' && el.sourceId === array.sourceId)));
                          setGhostArrays(prev => prev.filter(a => a.id !== array.id));
                        }}
                        className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded"
                      >✕</button>
                    </div>

                    {/* Editable fields row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-400">{t('ghostArrayCount')}:</label>
                        <input
                          type="number"
                          min={2}
                          max={100}
                          defaultValue={array.instanceCount}
                          id={`ghost-count-${array.id}`}
                          className="w-14 px-1 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white text-center"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-400">{array.type === 'polar' ? t('ghostArrayAngle') : t('ghostArrayDir')}:</label>
                        <input
                          type="number"
                          step={0.5}
                          defaultValue={array.angle}
                          id={`ghost-angle-${array.id}`}
                          className="w-16 px-1 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white text-center"
                        />
                        <span className="text-xs text-gray-500">°</span>
                      </div>
                      {array.type === 'polar' && (
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-400">{t('ghostArrayGrid')}:</label>
                          <select
                            defaultValue={array.pivotId || 'selection'}
                            id={`ghost-grid-${array.id}`}
                            className="px-1 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white"
                          >
                            <option value="selection">{t('ghostArraySelectionCenter')}</option>
                            {polarGrids.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {array.type === 'linear' && (
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-400">{t('ghostArraySpacePct')}:</label>
                          <input
                            type="number"
                            min={0}
                            max={500}
                            step={0.5}
                            defaultValue={array.spacing}
                            id={`ghost-spacing-${array.id}`}
                            onBlur={e => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val) || val < 0) e.target.value = '0';
                              else if (val > 500) e.target.value = '500';
                            }}
                            className="w-14 px-1 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white text-center"
                          />
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (!sourceEl) return;
                          const countInput = document.getElementById(`ghost-count-${array.id}`) as HTMLInputElement;
                          const angleInput = document.getElementById(`ghost-angle-${array.id}`) as HTMLInputElement;
                          const gridSelect = document.getElementById(`ghost-grid-${array.id}`) as HTMLSelectElement;
                          const spacingInput = document.getElementById(`ghost-spacing-${array.id}`) as HTMLInputElement | null;
                          const count = parseInt(countInput?.value || '2', 10);
                          const angle = parseFloat(angleInput?.value || '0');
                          const pivot = gridSelect?.value || array.pivotId || 'selection';
                          const spacing = spacingInput ? parseFloat(spacingInput.value || '0') : 0;
                          if (count < 2) return;

                          // Save state BEFORE deletion
                          const oldGhosts = elements.filter(el => el.type === 'ghost' && el.sourceId === sourceEl.id);
                          const oldGhostById = new Map(oldGhosts.map(g => [g.id, g]));
                          const oldGhostIdsSorted = [...oldGhosts].sort((a, b) => (a.rotation || 0) - (b.rotation || 0)).map(g => g.id);

                          // Save picotConnections involving these ghosts
                          const savedConnections = picotConnectionsRef.current.filter(conn =>
                            conn.picots.some(p => oldGhostById.has(p.elementId))
                          );

                          // Delete old ghosts
                          setElements(prev => prev.filter(el => !(el.type === 'ghost' && el.sourceId === sourceEl.id)));
                          setGhostArrays(prev => prev.filter(a => a.id !== array.id));
                          setSelectedIds([sourceEl.id]);

                          // Recreate with new parameters
                          setTimeout(() => {
                            if (array.type === 'polar') {
                              executePolarArray(count, angle, pivot, true, [sourceEl.id]);
                            } else if (array.type === 'linear') {
                              executeLinearArray(count, angle, spacing, array.rotStep, true, [sourceEl.id]);
                            }
                            // After recreation, remap connections: old ghost[i] → new ghost[i] by sorted order
                            setTimeout(() => {
                              const newGhosts = elementsRef.current.filter(e => e.type === 'ghost' && e.sourceId === sourceEl.id);
                              const newGhostIdsSorted = [...newGhosts].sort((a, b) => (a.rotation || 0) - (b.rotation || 0)).map(g => g.id);

                              if (savedConnections.length > 0 && newGhostIdsSorted.length > 0) {
                                const oldToNew = new Map<string, string>();
                                for (let i = 0; i < Math.min(oldGhostIdsSorted.length, newGhostIdsSorted.length); i++) {
                                  oldToNew.set(oldGhostIdsSorted[i], newGhostIdsSorted[i]);
                                }
                                // Remove old connections and add remapped ones
                                const currentConns = picotConnectionsRef.current.filter(conn =>
                                  !conn.picots.some(p => oldGhostById.has(p.elementId))
                                );
                                const remappedConns = savedConnections.map(conn => ({
                                  ...conn,
                                  id: generateId(),
                                  picots: conn.picots.map(p => ({
                                    ...p,
                                    elementId: oldToNew.get(p.elementId) || p.elementId,
                                  })),
                                }));
                                const merged = [...currentConns, ...remappedConns];
                                setPicotConnections(merged);
                                picotConnectionsRef.current = merged;
                              }
                            }, 60);
                          }, 50);
                        }}
                        disabled={!sourceEl}
                        className="text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
                        title={sourceEl ? t('ghostArrayApplyTitle') : t('ghostArraySourceDeleted')}
                      >
                        {t('ghostArrayApply')}
                      </button>
                      <button
                        onClick={() => setConvertConfirm(array)}
                        disabled={existingGhosts.length === 0}
                        className="text-xs px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
                        title={t('ghostArrayConvertTitle')}
                      >
                        {t('ghostArrayConvert')}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-5 pb-2 flex-shrink-0">
            <button
              onClick={() => setConvertConfirm('all')}
              className="w-full px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm font-medium"
            >
              {t('ghostArrayConvertAll')}
            </button>
          </div>
          <div className="px-5 pb-4 flex-shrink-0">
            <p className="text-xs text-gray-500">{t('ghostArrayApplyTitle')}</p>
          </div>
        </div>
      </div>
    )}

    {/* Convert Ghost Array confirmation modal */}
    {convertConfirm && (
      <>
        <div className="fixed inset-0 bg-black/50" style={{zIndex: 2147483646}} onClick={() => setConvertConfirm(null)}></div>
        <div
          className="fixed bg-gray-700 rounded-lg shadow-xl border border-gray-600 p-5 w-80"
          style={{zIndex: 2147483647, top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}
        >
          {convertConfirm === 'all' ? (
            <>
              <h3 className="text-gray-100 font-bold mb-3">{t('ghostArrayConvertAllTitle')}</h3>
              <p className="text-gray-300 text-sm mb-4">
                {t('ghostArrayConvertAllConfirm')
                  .replace('{total}', String(ghostArrays.reduce((sum, a) => sum + a.ghostIds.length, 0)))
                  .replace('{arrays}', String(ghostArrays.length))}
              </p>
              <div className="flex gap-2 justify-end flex-wrap">
                <button
                  onClick={() => setConvertConfirm(null)}
                  className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
                >
                  {t('ghostArrayCancel')}
                </button>
                <button
                  onClick={convertAllGhostArrays}
                  className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm"
                >
                  {t('ghostArrayConvertAllBtn')}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-gray-100 font-bold mb-3">{t('ghostArrayConvertTitle')}</h3>
              <p className="text-gray-300 text-sm mb-4">
                {t('ghostArrayConvertConfirm')
                  .replace('{count}', String(convertConfirm.instanceCount - 1))
                  .replace('{name}', convertConfirm.name)}
              </p>
              <div className="flex gap-2 justify-end flex-wrap">
                <button
                  onClick={() => setConvertConfirm(null)}
                  className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
                >
                  {t('ghostArrayCancel')}
                </button>
                <button
                  onClick={() => convertGhostArray(convertConfirm)}
                  className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm"
                >
                  {t('ghostArrayConvert')}
                </button>
              </div>
            </>
          )}
        </div>
      </>
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
                    const ids = elements.filter(el => el.type !== 'ghost' && ((el.materialId || 'default') === mat.id || (el.isSplitRing && (el.materialIdB || el.materialId || 'default') === mat.id))).map(el => el.id);
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
                      selectedIdSet.has(el.id) ? { ...el, materialId: id } : el
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
                      <ArrayInput
                        value={beadSettings[key].dsMultiplier}
                        onChange={v => setBeadSettings(prev => ({ ...prev, [key]: { ...prev[key], dsMultiplier: v } }))}
                        min={0.5} max={5} step={0.5}
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
                        <ArrayInput
                          value={activeGrid.angularOffset || 0}
                          onChange={v => updateGrid(activeGrid.id, { angularOffset: v })}
                          min={0} max={359} step={1}
                          className="w-16 px-2 py-0.5 bg-gray-600 border border-gray-500 rounded text-sm text-white text-right outline-none focus:border-blue-400"
                        />
                      </div>
                      {/* Center X/Y */}
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs">{t('polarGridCenterLabel')}</span>
                        <ArrayInput
                          value={Math.round(activeGrid.center.x)}
                          onChange={x => updateGrid(activeGrid.id, { center: { ...activeGrid.center, x } })}
                          step={1}
                          className="w-16 px-2 py-0.5 bg-gray-600 border border-gray-500 rounded text-sm text-white text-right outline-none focus:border-blue-400"
                        />
                        <ArrayInput
                          value={Math.round(activeGrid.center.y)}
                          onChange={y => updateGrid(activeGrid.id, { center: { ...activeGrid.center, y } })}
                          step={1}
                          className="w-16 px-2 py-0.5 bg-gray-600 border border-gray-500 rounded text-sm text-white text-right outline-none focus:border-blue-400"
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
                          <ArrayInput
                            value={ring.radius}
                            onChange={v => updateRing(activeGrid.id, ring.id, { radius: v })}
                            min={1} step={5}
                            className="w-16 px-1 py-0.5 bg-gray-600 border border-gray-500 rounded text-xs text-white text-right outline-none focus:border-blue-400 flex-shrink-0"
                          />
                          <span className="text-gray-500 text-xs flex-shrink-0" title="Approximate real-world radius">
                            ~{radiusToMm(ring.radius) < 10
                              ? radiusToMm(ring.radius).toFixed(1)
                              : Math.round(radiusToMm(ring.radius))} mm
                          </span>
                          {/* Divisions */}
                          <span className="text-gray-400 text-xs flex-shrink-0">{t('polarGridDivisionsLabel')}</span>
                          <ArrayInput
                            value={ring.divisions}
                            onChange={v => updateRing(activeGrid.id, ring.id, { divisions: v })}
                            min={1} max={360} step={1} integer
                            className="w-14 px-1 py-0.5 bg-gray-600 border border-gray-500 rounded text-xs text-white text-right outline-none focus:border-blue-400 flex-shrink-0"
                          />
                          {/* Per-ring angular offset */}
                          <span className="text-gray-400 text-xs flex-shrink-0" title="Additional angular offset for this ring only (degrees)">⟳°</span>
                          <ArrayInput
                            value={ring.angularOffset || 0}
                            onChange={v => updateRing(activeGrid.id, ring.id, { angularOffset: v })}
                            min={-359} max={359} step={1}
                            className="w-14 px-1 py-0.5 bg-gray-600 border border-gray-500 rounded text-xs text-white text-right outline-none focus:border-blue-400 flex-shrink-0"
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
                onClick={() => setSplashTipIndex(i => (i - 1 + SPLASH_TIP_COUNT) % SPLASH_TIP_COUNT)}
                className="text-gray-500 hover:text-gray-300 text-sm leading-none flex-shrink-0 px-1"
                title={t('splashTipPrev')}
              >‹</button>
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 min-h-[2.5rem] flex items-center">
                <span className="text-gray-400 text-xs leading-relaxed">{t(`splashTip${String(splashTipIndex + 1).padStart(2, '0')}`)}</span>
              </div>
              <button
                onClick={() => setSplashTipIndex(i => (i + 1) % SPLASH_TIP_COUNT)}
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
    <ArrayDialogShell show={showPolarArrayDialog} peek={polarArrayPeek} onClose={() => setShowPolarArrayDialog(false)}>
            {/* Title */}
            <div className="text-white font-semibold text-base">{t('polarArrayTitle')}</div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('polarArrayCount')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput
                  value={polarArrayCount}
                  onChange={setPolarArrayCount}
                  min={2} max={72} integer
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
                <ArrayInput
                  value={polarArrayAngle}
                  onChange={setPolarArrayAngle}
                  min={1} max={360} integer
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
    </ArrayDialogShell>

    {/* ── Linear Array Dialog ───────────────────────────────────── */}
    <ArrayDialogShell show={showLinearArrayDialog} peek={linearArrayPeek} onClose={() => setShowLinearArrayDialog(false)}>
            <div className="text-white font-semibold text-base">{t('linearArrayTitle')}</div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('linearArrayCount')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={linearArrayCount} onChange={setLinearArrayCount} min={2} max={100} integer className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
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
                <ArrayInput value={linearArrayAngle} onChange={setLinearArrayAngle} min={0} max={360} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                <span className="text-gray-400 text-xs">°</span>
              </div>
            </div>

            {/* Spacing */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Spacing (100% = touching, 200% = 1 element gap)</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={linearArraySpacing} onChange={setLinearArraySpacing} min={0} max={500} step={10} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                <span className="text-gray-400 text-xs">%</span>
                <button onClick={() => setLinearArraySpacing(100)} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">100% touch</button>
                <button onClick={() => setLinearArraySpacing(200)} className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300">200%</button>
              </div>
            </div>

            {/* Rotation per step */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('linearArrayRotStep')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={linearArrayRotStep} onChange={setLinearArrayRotStep} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
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
    </ArrayDialogShell>

    {/* ── Spiral Array Dialog ───────────────────────────────────── */}
    <ArrayDialogShell show={showSpiralArrayDialog} peek={spiralArrayPeek} onClose={() => setShowSpiralArrayDialog(false)}>
            <div className="text-white font-semibold text-base">{t('spiralArrayTitle')}</div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('spiralArrayCount')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={spiralArrayCount} onChange={setSpiralArrayCount} min={2} max={100} integer className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                {[4,6,8,12].map(n => <button key={n} onClick={() => setSpiralArrayCount(n)} className={`px-2 py-1 rounded text-xs ${spiralArrayCount === n ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{n}</button>)}
              </div>
            </div>

            {/* Angle step */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('spiralArrayAngleStep')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={spiralArrayAngleStep} onChange={setSpiralArrayAngleStep} min={1} max={180} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
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
                <ArrayInput value={spiralArrayGap} onChange={setSpiralArrayGap} min={1} className="w-28 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">{t('spiralArrayGrowth')}</label>
                <ArrayInput value={spiralArrayGrowth} onChange={setSpiralArrayGrowth} min={1.01} max={3} step={0.05} className="w-28 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
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
    </ArrayDialogShell>

    {/* ── In-app Confirm Dialog ─────────────────────────────────── */}
    {confirmDialog && (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-60" style={{ zIndex: 2147483647 }} onClick={() => setConfirmDialog(null)} />
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto px-6 py-5 flex flex-col gap-4"
            style={{ width: 'min(360px, 90vw)' }}>
            {confirmDialog.title && <h2 className="text-lg font-bold text-white">{confirmDialog.title}</h2>}
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
