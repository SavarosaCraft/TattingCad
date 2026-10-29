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
  checkFileExists,
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
import { getCircleStitchAngle, effectiveElementType, elementStitchFraction, splitRingSideFraction, presetEndAllowance, presetTension, tensionToAllowance, DEFAULT_END_ALLOWANCE, elementPathLength, allowsEndAllowance, endAllowanceFactor, elementTension, withChordCenter } from './geometry/stitchGeometry';
import { bakeRealisticView } from './render/realisticRenderer';
import {
  createCirclePath, createTeardropPath, createSplitRingPath, createSplitRingPathFromEl,
  scalePathsAboutPoint, rebendChainPathToLength, resizeElementForAllowance, rebuildSplitRingInPlace,
  rotatePaths, mirrorPaths, applyRotationToPathData, rotatePathsAroundCenter,
  applyPathPreset, applyLinePreset, isChainTooShort,
} from './geometry/paths';
import { useEditorActions } from './hooks/useEditorActions';
import { useBEClipboard } from './hooks/useBEClipboard';
import { useHistoryActions } from './hooks/useHistoryActions';
import { useInputHandlers } from './hooks/useInputHandlers';
import { useJoinActions, canFoldSelection, DEFAULT_FOLD_PROPS, applyJointFlags } from './hooks/useJoinActions';
import { useProjectFile } from './hooks/useProjectFile';
import { useUIState } from './hooks/useUIState';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useTattingOrder } from './hooks/useTattingOrder';
import { useProjectState } from './hooks/useProjectState';
import { useViewState, DEFAULT_THEME, SPLASH_TIP_COUNT, getInitialToolbarMode } from './hooks/useViewState';
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
  IconBringToFront, IconSendToBack, IconMagicWand,
} from './components/icons';
import { ScaleControls, WIZARD_BUTTON_CLASS } from './components/ScaleControls';
import { DropdownMenu } from './components/DropdownMenu';
import { ToolbarButton } from './components/ToolbarButton';
import { GettingStartedHint } from './components/GettingStartedHint';
import { PhoneToolBar, PhoneTool } from './components/PhoneToolBar';
import { PresetChip } from './components/PresetChip';
import { updateElement, updateSelected, updateWhere } from './utils/elementUpdates';
import { Modal } from './components/Modal';
import { AddPicotsSection } from './components/AddPicotsSection';
import { RealisticModeBar } from './components/RealisticModeBar';
import { PicotJoinModeBar } from './components/PicotJoinModeBar';
import { OrderNumberInput } from './components/OrderNumberInput';
import { RwToggleButton } from './components/RwToggleButton';
import { NotationRotationControls } from './components/NotationRotationControls';
import { RoundGroupPicker } from './components/RoundGroupPicker';
import { BeadingModeBar } from './components/BeadingModeBar';
import { ShapeAndSqueezeControls } from './components/ShapeAndSqueezeControls';
import { TopMenuBar } from './components/TopMenuBar';
import { SplitRingNotationInput } from './components/SplitRingNotationInput';
import { NotationInput } from './components/NotationInput';
import { TattingOrderModeBar } from './components/TattingOrderModeBar';
import { MultiSelectSummaryBar } from './components/MultiSelectSummaryBar';
import { SingleSelectPropertyBar } from './components/SingleSelectPropertyBar';
import { NumberStepper } from './components/NumberStepper';
import { ColorPickerPickerTab } from './components/ColorPickerPickerTab';
import { ColorPickerSwatchesTab } from './components/ColorPickerSwatchesTab';
import { ColorPickerGradientsTab } from './components/ColorPickerGradientsTab';
import { COLORS, BG_COLORS } from './utils/color';
import { ArrayInput } from './components/ArrayInput';
import { LineBeadPicker } from './components/LineBeadPicker';
import { FillPicotsSection } from './components/FillPicotsSection';
import { CompactPicotsSection } from './components/CompactPicotsSection';
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
  STITCH_WIDTH_DS,
} from './domain/parser';
import {
  analyzeNotation as analyzeNotationForWizard,
  clearUnjoinedPicots as clearUnjoinedPicotsText,
  addPicotsToRuns as addPicotsToRunsText,
  hasUnjoinedPicots as hasUnjoinedPicotsText,
  hasAddablePicotRuns as hasAddablePicotRunsText,
  previewFillDensity,
  maxUsefulFillGap,
  compactRepeatedPicots,
  hasCompactableGroups,
  autoCompact,
  scaleNotation,
  suggestScalePresets,
  suggestScalePresetsMulti,
  totalRunDs,
} from './domain/picotTools';
const logoUrl = '/logo.png';

// Text-editable input types — the only ones where a global keyboard
// shortcut (Ctrl+Z, Delete, etc.) should be suppressed because the browser
// has its own native text-editing behavior for that key. Deliberately
// excludes range/checkbox/color/radio/button/etc. — focus merely sitting on
// one of those (e.g. right after dragging a slider) isn't "the user is
// typing," and treating it as such silently swallowed shortcuts anywhere
// those input types appear, most noticeably the fold-property sliders in
// PicotJoinModeBar.
const TEXT_INPUT_TYPES = new Set(['text', 'number', 'email', 'search', 'tel', 'url', 'password', undefined, '']);
const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  if (el.tagName === 'INPUT') return TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  return false;
};

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

// ── Zoom step sizes ──────────────────────────────────────────────────────
// One place to tune "how much does zoom move per input event" instead of
// the value being duplicated at each call site (keyboard, toolbar buttons ×2
// modes, wheel). Button in/out are intentionally different values (Zoom Out
// has always moved faster than Zoom In here) — kept as-is rather than
// silently made symmetric; flag if you'd rather they match.
const ZOOM_STEP_KEYBOARD = 0.2;      // +/- keys
const ZOOM_STEP_BUTTON_IN = 0.2;     // toolbar Zoom In button (both modes)
const ZOOM_STEP_BUTTON_OUT = 0.4;    // toolbar Zoom Out button (both modes)
const ZOOM_STEP_WHEEL = 0.16;        // Shift+wheel, per wheel event

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


const DEFAULT_THREAD_PRESET = {
  id: 'default',
  name: 'Pearl Cotton Size 10, Needle Tat',
  ds20Working: 285,   // mm — working thread per 20 DS
  ds20Core: 35,       // mm — core thread per 20 DS
  picotRegular: 8,    // mm
  picotJoined: 5,     // mm
  endAllowance: DEFAULT_END_ALLOWANCE, // ds, from DEFAULT_TENSION (stitchGeometry.ts) — bare thread at each path end of NEW elements; the UI shows tension
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
// Handles backdrop, peek-opacity fade, centering, and click-outside-to-close.
// Only the inner content differs between dialogs.
// Thin wrapper around the generalized Modal component (components/Modal.tsx) —
// kept as its own name/API since all 3 call sites (Polar/Linear/Spiral array
// dialogs) already use it and there's no reason to touch working call sites.
const ArrayDialogShell = ({
  show, peek, onClose, children,
}: {
  show: boolean; peek: boolean; onClose: () => void; children: React.ReactNode;
}) => (
  <Modal
    show={show}
    peek={peek}
    onClose={onClose}
    backdropZIndex={2147483640}
    wrapperZIndex={2147483641}
    contentClassName="flex flex-col gap-4 p-5"
    contentStyle={{ width: 'min(340px, 92vw)' }}
  >
    {children}
  </Modal>
);

// Where a tatting-order badge (number or "R") sits on an open element (chain
// or line): halfway along its drawn path, by arc length. Session 58: the "R"
// badge used el.center, which can be stale for chains (Path Edit endpoint
// drags never updated it before session 58), so it could float far from the
// chain. Numbers already used this midpoint; both now share it. `samples` is
// per path segment (chains 40, lines 20 — the values each site always used).
const orderLabelPosOnPath = (el: any, samples: number): { x: number; y: number } => {
  let ox = el.center.x, oy = el.center.y;
  if (!el.paths || el.paths.length === 0) return { x: ox, y: oy };
  const allPts: { x: number; y: number }[] = [];
  el.paths.forEach((p: any) => {
    for (let i = 0; i <= samples; i++) {
      const t = i / samples, u = 1 - t;
      if (p.type === 'cubic') {
        allPts.push({ x: u*u*u*p.x+3*u*u*t*p.control1X+3*u*t*t*p.control2X+t*t*t*p.endX, y: u*u*u*p.y+3*u*u*t*p.control1Y+3*u*t*t*p.control2Y+t*t*t*p.endY });
      } else {
        allPts.push({ x: u*u*p.x+2*u*t*p.controlX+t*t*p.endX, y: u*u*p.y+2*u*t*p.controlY+t*t*p.endY });
      }
    }
  });
  let total = 0;
  for (let i = 1; i < allPts.length; i++) total += Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
  let acc = 0;
  const half = total / 2;
  for (let i = 1; i < allPts.length; i++) {
    const seg = Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
    if (acc + seg >= half) { const f=(half-acc)/seg; ox=allPts[i-1].x+(allPts[i].x-allPts[i-1].x)*f; oy=allPts[i-1].y+(allPts[i].y-allPts[i-1].y)*f; break; }
    acc += seg;
  }
  return { x: ox, y: oy };
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
    showPicotWizard, setShowPicotWizard,
    picotWizardSymmetric, setPicotWizardSymmetric,
    picotWizardFillGap, setPicotWizardFillGap,
    picotWizardScalePct, setPicotWizardScalePct,
    picotWizardSide, setPicotWizardSide,
    showMultiScaleWizard, setShowMultiScaleWizard,
    multiScalePct, setMultiScalePct,
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

  // Tracks which Recent Projects entries' underlying files have been checked
  // and found missing on disk (moved/deleted) — populated by an effect below
  // that fires when the dialog opens. Kept local rather than added to
  // useUIState since it's derived/transient (re-checked fresh each time the
  // dialog opens) rather than persistent UI state; candidate to fold in if
  // useUIState is revisited.
  const [missingRecentPaths, setMissingRecentPaths] = useState<Set<string>>(new Set());

  // Named/colored spatial-group registry — { id, name, color }[], mirrors the
  // `rounds` registry shape (see useTattingOrder). Kept as local state here
  // rather than folded into a dedicated hook (no such hook exists/was
  // uploaded this session) — candidate to extract later, same as
  // missingRecentPaths above. Entries are created lazily: groupSelected()
  // (useEditorActions.ts) appends a default entry when a new groupId is
  // assigned; the property bar (MultiSelectSummaryBar) upserts on rename/recolor.
  // Wired into undo/redo via pushHistoryState's `spatialGroups` param
  // (useHistoryActions.ts) — restored in undo()/redo() alongside rounds/grids.
  const [groups, setGroups] = useState<{id: string; name: string; color: string}[]>([]);

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
  } = useCanvasInteraction();

  // ── Tatting order state ──────────────────────────────────────────────────
  const {
    rounds, setRounds,
    activeRoundId, setActiveRoundId,
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
    lastSavedRev, setLastSavedRev,
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
    toolbarMode, setToolbarMode,
    clipboard, setClipboard,
    splashTipIndex, setSplashTipIndex,
  } = useViewState();

  // ── Lizbeth color-picker tab state ──────────────────────────────────────
  // Kept local rather than added to useUIState.ts/useViewState.ts (don't
  // have either file to edit blind) — mirrors the DMC-tab state above
  // (dmcSearchTerm/dmcPage/dmcCategory/selectedDmcColor) but kept fully
  // separate per tab, so switching between the DMC and Lizbeth tabs
  // doesn't carry one tab's search text/page/category into the other.
  const [lizbethSearchTerm, setLizbethSearchTerm] = useState('');
  const [lizbethPage, setLizbethPage] = useState(0);
  const [lizbethCategory, setLizbethCategory] = useState('all');
  const [selectedLizbethColor, setSelectedLizbethColor] = useState<any>(null);

  // dmcColors holds both catalogs merged (see the loader above); split
  // here by the "Lizbeth – " group prefix so the DMC tab and the new
  // Lizbeth tab each only ever see their own brand's entries. Gradients
  // from both brands stay merged and untouched — the Gradients tab was
  // already brand-agnostic (groups are just filter chips there).
  const dmcOnlyColors = useMemo(
    () => dmcColors.filter((c: any) => !(c.group || '').startsWith('Lizbeth')),
    [dmcColors]
  );
  const lizbethOnlyColors = useMemo(
    () => dmcColors.filter((c: any) => (c.group || '').startsWith('Lizbeth')),
    [dmcColors]
  );

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
const APP_VERSION = '1.3.0';


  // Update reminder: only after 90 days with THIS version — evaluated once
  // (useState initializer), for the splash to read.
  // Session 58 fix: the clock (tcad_install_date) used to start at the very
  // first run and never restart. localStorage survives updates and
  // reinstalls, so after 90 days every newly installed version asked to
  // "check for updates" right away. Now the clock restarts whenever the
  // installed version changes (tcad_install_version). tcad_install_date is
  // kept as the key name: getInitialToolbarMode (useViewState.ts) uses its
  // presence to recognise an existing user.
  const [updateReminderDue] = useState(() => {
    try {
      if (!localStorage.getItem('tcad_install_date')
          || localStorage.getItem('tcad_install_version') !== APP_VERSION) {
        localStorage.setItem('tcad_install_date', String(Date.now()));
        localStorage.setItem('tcad_install_version', APP_VERSION);
        return false;
      }
      const installDate = parseInt(localStorage.getItem('tcad_install_date') || '0', 10);
      const daysSinceInstall = (Date.now() - installDate) / (1000 * 60 * 60 * 24);
      if (daysSinceInstall < 90) return false;
      return localStorage.getItem('tcad_update_seen') !== APP_VERSION;
    } catch { return false; }
  });

  // Splash screen — shown on every launch

  // Autosave metadata — parsed once for the splash button label
  const splashAutosave = (() => {
    try {
      const saved = localStorage.getItem('tatting-designer-autosave');
      if (!saved) return null;
      const d = JSON.parse(saved);
      if (!d.elements || d.elements.length === 0) return null;
      // Name may be empty; the "Untitled" fallback is applied where it's
      // displayed — this runs before `t` is declared further down.
      return { name: d.name || '', date: d.autoSaved ? new Date(d.autoSaved).toLocaleString() : '' };
    } catch { return null; }
  })();

  // Tips — navigable with prev/next
  // SPLASH_TIP_KEYS replaced by SPLASH_TIP_COUNT from ./hooks/useViewState


  // Chain preset panel — symmetric toggle (local UI preference, not persisted)
  const [chainPresetSymmetric, setChainPresetSymmetric] = React.useState(true);

  const lastUsedMaterialIdRef = useRef('default');
  // Default end allowance (ds) stamped on NEW chains/rings by
  // useEditorActions' add* functions — from the active thread preset. A ref
  // (synced every render, below) because those callbacks are memoised on
  // [dsWidth, camera, zoom] and would otherwise see a stale value.
  const defaultEndAllowanceRef = useRef(DEFAULT_END_ALLOWANCE);
  defaultEndAllowanceRef.current = presetEndAllowance(
    threadPresets.find(pr => pr.id === activePresetId) || threadPresets[0]
  );


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
  const historyRef = useRef([{ elements: [], connections: [], polarGrids: [] }]);  // Ref to current history
  const historyIndexRef = useRef(0);  // Ref to current index
  const isInteractingRef = useRef(false);  // Flag to prevent history during drag/rotate operations
  const rafIdRef = useRef(null);  // RAF ID for batching mouse moves
  // nudgeActiveRef also gates the separate auto-history-push effect
  // elsewhere in this file — kept for that reason even though the
  // press-and-hold bookkeeping it used to support locally (an interval ref
  // and an accumulated-delta ref) now lives inside NumberStepper.tsx itself.
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

  // Camera that puts world (0,0) in the middle of the CANVAS (not the window:
  // the canvas sits right of the tool rail and under the header). Falls back
  // to the window when the canvas isn't mounted yet. Session 58.
  const canvasCenterCamera = () => {
    const rect = (canvasRef.current as any)?.getBoundingClientRect(); // cast: canvasRef is useRef(null)
    return rect && rect.width > 0
      ? { x: Math.round(rect.width / 2), y: Math.round(rect.height / 2) }
      : { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
  };
  // App start: usePatternState can only use the window size, so re-centre on
  // the canvas once it exists (before any file/autosave sets its own camera).
  useEffect(() => { setCamera(canvasCenterCamera()); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unsaved changes + window title (session 58) ─────────────────────────
  // One check for both the title star and the close warning. Each history
  // entry carries an ever-increasing `rev` (useHistoryActions.ts); the
  // pattern is unsaved when the current entry isn't the one last saved or
  // opened. Undo back to the saved state → clean again. A brand-new, still
  // empty, never-saved pattern doesn't count as unsaved.
  const currentHistoryRev = (history[historyIndex] as any)?.rev ?? 0;
  const hasUnsavedChanges = currentHistoryRev !== lastSavedRev
    && (elements.length > 0 || currentFilePath !== null);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  // Window title: "*Snowflake.json — TattingCAD" (star = unsaved changes).
  // File name only (no folder); "Untitled" before the first save. Needs the
  // Tauri permission core:window:allow-set-title (capabilities/default.json);
  // without it the call fails quietly and the title stays "TattingCAD".
  // document.title too, so a browser tab shows the same.
  const windowTitleFileName = currentFilePath
    ? (currentFilePath.split(/[\\/]/).pop() || currentFilePath)
    : t('windowTitleUntitled');
  const windowTitle = `${hasUnsavedChanges ? '*' : ''}${windowTitleFileName} — TattingCAD`;
  useEffect(() => {
    document.title = windowTitle;
    if (!(window as any).__TAURI_INTERNALS__) return;
    try {
      getCurrentWindow().setTitle(windowTitle).catch(() => { /* permission missing */ });
    } catch { /* not running in Tauri */ }
  }, [windowTitle]);

  const lastMousePosRef = useRef(null); // was state — now ref to avoid re-render on every move
  // PERFORMANCE: During element translate-drag, accumulate offset in a ref instead of
  // calling setElements every frame. SVG transform handles the visual update.
  // setElements is called once on mouseup. This keeps elementById valid all drag.
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
    if (isUndoRedoRef.current) {
      return; // Don't add during undo/redo
    }
    if (skipAutoHistoryRef.current) {
      skipAutoHistoryRef.current = false; return;
    } // Explicit push already done
    if (isInteractingRef.current) {
      needsHistoryPushRef.current = true; // Push after interaction ends instead
      return;
    }
    if (nudgeActiveRef.current) return; // Nudge hold will push history once on mouseUp
    // ghostArrays passed as live state, not groupsRef-style ref: every
    // ghostArrays mutation site changes `elements` in the same synchronous
    // batch and relies on this effect to capture both together. A ref would
    // read one render stale here, since the "keep refs up to date" effect
    // that syncs it runs after this one in source order (see groupsRef,
    // which has the same latent issue but never hits it in practice because
    // every path that changes `groups` bypasses this effect entirely via
    // skipAutoHistoryRef + an explicit push with fresh values instead).
    pushHistoryState(elements, picotConnections, roundsRef.current, polarGrids, groupsRef.current, ghostArrays);
  }, [elements, picotConnections, polarGrids, ghostArrays]); // Depend on elements, connections, polarGrids, and ghostArrays

  // Check Recent Projects entries' actual files for existence when the
  // dialog opens. The thumbnail already degrades gracefully on its own
  // (native <img onError>) when its .png is missing, but the project .json
  // itself previously had no equivalent check — an entry with a stored
  // filename looked fully loadable even if that file had been moved or
  // deleted, and the user would only find out after clicking Load.
  useEffect(() => {
    if (!showRecentProjectsDialog) return;
    let cancelled = false;
    const entries = getRecents().filter(e => e.filename);
    Promise.all(entries.map(async e => ({
      filename: e.filename,
      exists: await checkFileExists(e.filename),
    }))).then(results => {
      if (cancelled) return;
      setMissingRecentPaths(new Set(results.filter(r => !r.exists).map(r => r.filename)));
    });
    return () => { cancelled = true; };
  }, [showRecentProjectsDialog]);

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
  const foldModeArmedRef = useRef(false); // mirrors foldModeArmed — see the "Keep refs up to date" effect below
  const beClipboardRef = useRef(beClipboard);
  const roundsRef = useRef(rounds);
  const groupsRef = useRef(groups); // mirrors roundsRef — see `groups` state declaration above
  const activeRoundIdRef = useRef(activeRoundId);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pivotOffsetRef = useRef({ x: 0, y: 0 });  // always-current mirror of pivotOffset state
  const pivotDragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 }); // world pos + offset at drag start
  const rotationDragStartRef = useRef({ x: 0, y: 0, pivotX: 0, pivotY: 0 }); // world pos + effective pivot at rotation drag start
  const movingPivotRef = useRef(false);   // ref mirror of movingPivot — readable in touch handlers
  const rotationHandleRef = useRef<string | null>(null); // ref mirror of rotationHandle
  // PERFORMANCE: Persistent notation-parse cache. Keyed by notation string.
  // Only re-parses when notation text changes.
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
    roundsRef.current = rounds;
    groupsRef.current = groups;
    activeRoundIdRef.current = activeRoundId;
    selectedPicotsRef.current = selectedPicots;
    foldModeArmedRef.current = foldModeArmed;
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
      // Same as confirmNewCanvas: history is reset directly below
      // (setHistory) while elements/connections/polarGrids also change in
      // this batch, which would re-trigger the auto-push effect with stale
      // rounds/groups refs and push a spurious second entry — leaving Undo
      // enabled right after resuming. Skip that one auto-push.
      skipAutoHistoryRef.current = true;
      // Migrate legacy labelsInside → labelOffset; put stale chain/line
      // centers back on the chord midpoint (session 58, same as file open).
      setElements((projectData.elements || []).map(el => withChordCenter(
        'labelsInside' in el && !('labelOffset' in el)
          ? (({ labelsInside, ...rest }) => ({ ...rest, labelOffset: 8 }))(el)
          : el
      )));
      setPicotConnections(projectData.picotConnections || []);
      setCamera(projectData.camera || canvasCenterCamera());
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
      setProjectName(projectData.name || t('projectUntitled'));
      // Always load into schematic, regardless of what renderMode was
      // saved — bakedRealisticSVG isn't part of the autosave payload either,
      // same reasoning as the fix in useProjectFile.ts's file-open path
      // (session 52 bug fix — this is a second, separate load path that
      // needed the same fix, easy to miss since it doesn't go through
      // useProjectFile.ts at all).
      setRenderMode('schematic');
      setPatternNotes(projectData.patternNotes || '');
      if (projectData.materials) setMaterials(projectData.materials);
      setRounds(Array.isArray(projectData.orderGroups) ? projectData.orderGroups : []);
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
      setHistory([{ elements: projectData.elements || [], connections: projectData.picotConnections || [], polarGrids: projectData.polarGrids || [] }]);
      setHistoryIndex(0);
      // A resumed autosave isn't in any file yet → unsaved (title star,
      // close warning) until it is saved.
      setLastSavedRev(-1);
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
      // Same check as the title star (session 58; was an index comparison
      // that missed edits once the 50-step undo history was full).
      if (hasUnsavedChangesRef.current) {
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
  }, [t]); // reads hasUnsavedChangesRef; re-registers only for a language change (dialog text)

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
        const delta = e.deltaY > 0 ? -ZOOM_STEP_WHEEL : ZOOM_STEP_WHEEL;
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

  // Safety net: if a property-bar slider (squeeze, etc.) loses its onMouseUp
  // because setElements causes a mid-drag remount, isInteractingRef can get
  // permanently stuck at true — leaving the canvas thinking a drag is still
  // in progress. A document-level pointerup clears it regardless of which
  // element originally received the pointerdown.
  //
  // BUG FOUND VIA LOGGING (see [HIST] instrumentation): this fired on EVERY
  // pointerup, not just orphaned slider drags — including ordinary canvas
  // drags that the SVG's own onMouseUp (handleMouseUp, useInputHandlers.ts)
  // was about to handle correctly. Browsers dispatch 'pointerup' BEFORE
  // 'mouseup' for the same physical release, so this ran first, saw
  // isInteractingRef.current === true, and reset it to false before
  // handleMouseUp's own explicit history push could check it — silently
  // dropping that edit from history. Root cause of the intermittent
  // "bend a line, undo removes more than expected" / "undo digs into a
  // previous project's history" reports. Deferred by one tick so the
  // canvas's own mouseup handler (same gesture, fires moments later)
  // always runs its correct cleanup+push first; the orphaned-slider case
  // this net actually exists for has nothing else to reset the flag, so it
  // still fires correctly here, just one tick later.
  useEffect(() => {
    const handleDocPointerUp = () => {
      setTimeout(() => {
        if (isInteractingRef.current) {
          // Genuinely orphaned (not the race above, which resolves to false
          // by this point every time) — nothing else will ever push this
          // edit, since the only reader of needsHistoryPushRef also requires
          // isInteractingRef to still be true (useInputHandlers.ts mouseUp
          // check), which we're about to clear. Push directly instead of
          // just setting a flag that would never actually get consumed.
          // Uses the *Ref.current convention (elementsRef/picotConnectionsRef/
          // roundsRef), same as every other explicit pushHistoryState call
          // site in this file, so this effect can stay mount-once ([] deps)
          // rather than rebinding a document listener on every drag tick.
          isInteractingRef.current = false;
          pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current);
        }
        // Same orphan check for a NumberStepper hold-to-repeat (e.g. the
        // rotation ±1° buttons). nudgeActiveRef is set true for the whole
        // hold and only cleared by that widget's own final commit, which
        // runs before this deferred check in the normal case. If it's still
        // true here, the release never reached the stepper, and the flag
        // would otherwise stay stuck — silently disabling the auto-push
        // history effect for every edit after it. Flush the held edit as
        // one undo step and clear the flag.
        if (nudgeActiveRef.current) {
          nudgeActiveRef.current = false;
          pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current);
        }
      }, 0);
    };
    document.addEventListener('pointerup', handleDocPointerUp);
    return () => document.removeEventListener('pointerup', handleDocPointerUp);
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

  // Load DMC + Lizbeth colors on mount (from external JSON files with
  // validation). Both catalogs share the same { solidColors, gradients }
  // shape and both land in the one `dmcColors` array that
  // ColorPickerSwatchesTab/ColorPickerGradientsTab already consume.
  // Lizbeth's own groups ("Lizbeth – Pinks", "Lizbeth – Blues & Teals",
  // etc. — 13 of them) are pre-namespaced in the data file itself, kept
  // visually distinct from DMC's own groups ("Reds"/"Blues"/...) rather
  // than folded into them. No new tab, no new state: the existing
  // group-based filtering in the Swatches tab picks this up automatically
  // once the data's in the array — this code doesn't hardcode any
  // specific group name, Lizbeth or otherwise.
  // Lizbeth's `id` (e.g. "LZ601") is a namespaced key distinct from the
  // real physical thread number — DMC and Lizbeth both use plain short
  // numeric ids, so without the "LZ" prefix a Lizbeth color could collide
  // with an unrelated DMC color sharing the same number once merged into
  // one array (ids are the actual lookup key everywhere, including a
  // saved project's materialId). The real catalog number is preserved
  // untouched in `catalogNumber`, and also folded into `name` (e.g. "601
  // Snow White") so it stays visible without needing
  // ColorPickerSwatchesTab to know about the new field.
  useEffect(() => {
    // Shared by both catalogs — was duplicated inline here before Lizbeth
    // was added; pulled out rather than copy-pasting it a second time.
    const validateCatalog = (data: any, label: string): any[] => {
      // Validate JSON structure
      if (!data.solidColors || !Array.isArray(data.solidColors)) {
        throw new Error(`Invalid ${label} file format: missing solidColors array`);
      }
      if (!data.gradients || !Array.isArray(data.gradients)) {
        throw new Error(`Invalid ${label} file format: missing gradients array`);
      }

      // Validate each solid color has required fields
      data.solidColors.forEach((color: any, index: number) => {
        if (!color.id || !color.name || !color.hex) {
          throw new Error(`Invalid ${label} solid color at index ${index}: missing required fields (id, name, hex)`);
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(color.hex)) {
          throw new Error(`Invalid ${label} solid color hex at index ${index}: ${color.hex}`);
        }
      });

      // Validate and flatten gradients — supports flat array with 'group' field (current format)
      // and legacy grouped {threadLine, items[]} format for backwards compatibility
      const flatGradients: any[] = [];
      data.gradients.forEach((entry: any, index: number) => {
        if (Array.isArray(entry.items)) {
          // Legacy grouped format: { threadLine: "...", items: [...] }
          if (!entry.threadLine) throw new Error(`${label} gradient group at index ${index} missing threadLine`);
          entry.items.forEach((g: any, gi: number) => {
            if (!g.id || !g.name || !g.stops)
              throw new Error(`Invalid ${label} gradient in group "${entry.threadLine}" at item ${gi}: missing fields`);
            flatGradients.push({ ...g, type: 'gradient', group: g.group || entry.threadLine });
          });
        } else {
          // Current flat format: { id, name, type, group, stops }
          if (!entry.id || !entry.name || !entry.stops)
            throw new Error(`Invalid ${label} gradient at index ${index}: missing required fields (id, name, stops)`);
          flatGradients.push({ ...entry, type: 'gradient' });
        }
      });

      // Merge solid colors and gradients
      return [...data.solidColors, ...flatGradients];
    };

    const loadCatalog = async (path: string, label: string): Promise<any[]> => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${label} file: ${response.status} ${response.statusText}`);
      }
      return validateCatalog(await response.json(), label);
    };

    const loadColors = async () => {
      let dmcLoaded: any[] | null = null;
      try {
        dmcLoaded = await loadCatalog('./dmc_colors.json', 'DMC colors');
      } catch (error) {
        console.error('❌ Error loading DMC colors from external file:', error);
      }

      // Lizbeth is optional — a missing/not-yet-added lizbeth_colors.json
      // is not fatal (no fallback list, unlike DMC): the picker just has
      // no "Lizbeth" group until the file exists. Still logged, so a file
      // that exists but is genuinely malformed doesn't fail silently.
      let lizbethLoaded: any[] = [];
      try {
        lizbethLoaded = await loadCatalog('./lizbeth_colors.json', 'Lizbeth colors');
      } catch (error) {
        console.error('❌ Error loading Lizbeth colors from external file:', error);
      }

      if (dmcLoaded) {
        setDmcColors([...dmcLoaded, ...lizbethLoaded]);
        return;
      }

      // Fallback to minimal embedded colors if the DMC file fails —
      // unchanged from before. Lizbeth entries (if they did load) are
      // still appended, so a broken DMC file doesn't also hide a working
      // Lizbeth one.
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

      setDmcColors([...fallbackColors, ...lizbethLoaded]);
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
        if (isTypingTarget(e.target)) return;
        e.preventDefault(); // Prevent page scroll
        if (!spaceDownRef.current) {
          spaceDownRef.current = true;
          setSpaceDown(true);
        }
      }
      if (e.key === 'z' || e.key === 'Z') {
        if (isTypingTarget(e.target)) return;
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
    
    const handleBlur = () => {
      // If the window/tab loses focus while a modifier is physically held
      // (alt-tab, OS shortcut stealing the keyup, devtools taking focus,
      // etc.), the corresponding keyup event never reaches this page and
      // these flags stick at their "held" value forever — permanently
      // axis-locking drags (isShiftHeld), or leaving pan/zoom-rect mode
      // stuck on. Reset all three whenever we lose focus.
      setIsShiftHeld(false);
      spaceDownRef.current = false;
      setSpaceDown(false);
      zDownRef.current = false;
      setZDown(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
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

  // calculatePathStitches, calculateSplitRingStitches, calculateCircleStitches,
  // calculateStitchScale, renderWedge*Shapes, sampleFullPathWithOffset moved
  // to render/realisticRenderer.ts (imported above) — realistic-renderer
  // extraction, session 51.

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
    findDuplicateElements, cleanupDuplicates,
  } = useEditorActions({
    elements, selectedIds, dsWidth, camera, zoom, polarGrids,
    elementById, selectedIdSet,
    beadLibrary, picotConnections,
    canvasRef, elementsRef, selectedIdsRef, picotConnectionsRef, roundsRef,
    groupsRef,
    clipboardRef, historyRef, historyIndexRef,
    isUndoRedoRef, needsHistoryPushRef, skipAutoHistoryRef, lastUsedMaterialIdRef, defaultEndAllowanceRef,
    setElements, setSelectedIds, setPicotConnections, setRounds,
    setGroups,
    setClipboard, setGhostArrays, setHistoryIndex,
    setGroupRotationInput, setPolarGrids,
    setConfirmDialog,
    t,
    pushHistoryState,
  });

  // PERFORMANCE: O(1) material lookup by id — getElementColor calls materials.find() on every
  // element every render. This map makes it O(1).
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
        // Preserves what kind of element (chain/ring/line) this ghost is a
        // copy of. el.type itself must stay 'ghost' — join logic throughout
        // useJoinActions.ts keys off it to identify ghost elements — but
        // realistic-mode rendering needs to know the underlying shape to
        // pick the right draw path. Without this, any ghost that wasn't a
        // closed circle rendered nothing in realistic view: the render
        // branches check el.type === 'chain' | 'ring' | 'line', which a
        // ghost's el.type ('ghost') never matches.
        sourceType: sourceEl.type,
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
        // Field list is explicit here, so anything that changes path length
        // must be copied or the ghost draws at the wrong length.
        endAllowance: sourceEl.endAllowance,
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
      setElements(prev => updateSelected(prev, currentSelectedIds, { isGhostMother: true }));
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
    const perInstanceIdMap = new Map<number, Map<string, string>>();
    for (let i = 1; i < count; i++) {
      const isBoundary = (i === 1 || i === count - 1);
      const idMap = new Map<string, string>();
      perInstanceIdMap.set(i, idMap);

      selectedEls.forEach(el => {
        const newEl = createPolarInstance(el, i, pivotX, pivotY, count, fillAngle, {
          asGhost: createGhosts,
          sourceId: createGhosts ? el.id : undefined,
          isBoundary: createGhosts ? isBoundary : undefined,
          groupIdMap,
          polarGridId,
        });

        newElements.push(newEl);
        idMap.set(el.id, newEl.id);
        if (createGhosts) {
          newGhostIds.push(newEl.id);
          if (isBoundary) boundaryGhostIds.push(newEl.id);
        }
      });
    }

    // Any picotConnections entry that's wholly between two elements in the
    // selection itself (e.g. joining two rings, then selecting both and
    // arraying them as a pair) needs the SAME replication every other
    // duplicated element already gets — otherwise only the original pair
    // keeps its connection while every copy's picots still show isJoint:
    // true (cloned verbatim from the source) with nothing actually joining
    // them. Picot ids are stable across instances (createPolarInstance
    // clones them verbatim), so the same picotId carries over — only the
    // elementId needs remapping per instance.
    const internalConns = picotConnectionsRef.current.filter(conn =>
      conn.picots.every((cp: any) => currentSelectedIds.includes(cp.elementId))
    );
    if (internalConns.length > 0) {
      const replicatedConns: any[] = [];
      for (let i = 1; i < count; i++) {
        const idMap = perInstanceIdMap.get(i)!;
        internalConns.forEach(conn => {
          const mappedPicots = conn.picots.map((cp: any) => ({ elementId: idMap.get(cp.elementId), picotId: cp.picotId }));
          if (mappedPicots.every((mp: any) => mp.elementId)) {
            replicatedConns.push({ ...conn, id: generateId(), picots: mappedPicots });
          }
        });
      }
      if (replicatedConns.length > 0) {
        const allConns = [...picotConnectionsRef.current, ...replicatedConns];
        setPicotConnections(allConns);
        picotConnectionsRef.current = allConns;
      }
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
        name: `${t('polarArrayTitle')} ${prev.length + 1}`,
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
    return { minX, minY, maxX, maxY, elementSize: elementSize + 5 };
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
      newEl.sourceType = newEl.type;
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
      setElements(prev => updateSelected(prev, currentSelectedIds, { isGhostMother: true }));
    }

    // Build groupId map once for all instances
    const groupIdMap = new Map<string, string>();
    selectedEls.forEach(el => { if (el.groupId && !groupIdMap.has(el.groupId)) groupIdMap.set(el.groupId, generateId()); });

    const perInstanceIdMap = new Map<number, Map<string, string>>();
    for (let i = 1; i < count; i++) {
      const isBoundary = (i === 1); // Ghost closest to the mother is the boundary for linear
      const idMap = new Map<string, string>();
      perInstanceIdMap.set(i, idMap);

      selectedEls.forEach(el => {
        const newEl = createLinearInstance(el, i, dx, dy, rotStep, {
          asGhost: createGhosts,
          sourceId: createGhosts ? el.id : undefined,
          isBoundary: createGhosts ? isBoundary : undefined,
          groupIdMap,
        });

        newElements.push(newEl);
        idMap.set(el.id, newEl.id);
        if (createGhosts) {
          newGhostIds.push(newEl.id);
          if (isBoundary) boundaryGhostIds.push(newEl.id);
        }
      });
    }

    // See the matching comment in executePolarArray — replicate any
    // connection that's wholly internal to the selection onto every copy.
    const internalConns = picotConnectionsRef.current.filter(conn =>
      conn.picots.every((cp: any) => currentSelectedIds.includes(cp.elementId))
    );
    if (internalConns.length > 0) {
      const replicatedConns: any[] = [];
      for (let i = 1; i < count; i++) {
        const idMap = perInstanceIdMap.get(i)!;
        internalConns.forEach(conn => {
          const mappedPicots = conn.picots.map((cp: any) => ({ elementId: idMap.get(cp.elementId), picotId: cp.picotId }));
          if (mappedPicots.every((mp: any) => mp.elementId)) {
            replicatedConns.push({ ...conn, id: generateId(), picots: mappedPicots });
          }
        });
      }
      if (replicatedConns.length > 0) {
        const allConns = [...picotConnectionsRef.current, ...replicatedConns];
        setPicotConnections(allConns);
        picotConnectionsRef.current = allConns;
      }
    }

    setElements(prev => [...prev, ...newElements]);
    // After ghost creation, only select the mother element(s) — ghosts are non-interactive
    setSelectedIds([...currentSelectedIds]);

    // Save ghost array metadata for Update functionality
    if (createGhosts && newGhostIds.length > 0) {
      setGhostArrays(prev => [...prev, {
        id: arrayId,
        name: `${t('linearArrayTitle')} ${prev.length + 1}`,
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

    const perInstanceIdMap = new Map<number, Map<string, string>>();
    for (let i = 1; i < count; i++) {
      const pos = spiralPos(i);
      // Offset moves the centroid to pos; each element keeps its relative position within the group
      const offsetX = pos.x - centroidX;
      const offsetY = pos.y - centroidY;
      // Rotation delta relative to original angle — how much the spiral has turned
      // offsetX/Y moves each element's centroid to the new spiral position

      const idMap = new Map<string, string>();
      perInstanceIdMap.set(i, idMap);

      selectedEls.forEach(el => {
        const newEl = JSON.parse(JSON.stringify(el));
        newEl.id = generateId();
        delete newEl.orderNumber;
        if (el.groupId) newEl.groupId = groupIdMap.get(el.groupId);
        idMap.set(el.id, newEl.id);

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

    // See the matching comment in executePolarArray — replicate any
    // connection that's wholly internal to the selection onto every copy.
    const internalConns = picotConnectionsRef.current.filter(conn =>
      conn.picots.every((cp: any) => currentSelectedIds.includes(cp.elementId))
    );
    if (internalConns.length > 0) {
      const replicatedConns: any[] = [];
      for (let i = 1; i < count; i++) {
        const idMap = perInstanceIdMap.get(i)!;
        internalConns.forEach(conn => {
          const mappedPicots = conn.picots.map((cp: any) => ({ elementId: idMap.get(cp.elementId), picotId: cp.picotId }));
          if (mappedPicots.every((mp: any) => mp.elementId)) {
            replicatedConns.push({ ...conn, id: generateId(), picots: mappedPicots });
          }
        });
      }
      if (replicatedConns.length > 0) {
        const allConns = [...picotConnectionsRef.current, ...replicatedConns];
        setPicotConnections(allConns);
        picotConnectionsRef.current = allConns;
      }
    }

    setElements(prev => [...prev, ...newElements]);
    setSelectedIds([...currentSelectedIds, ...newElements.map(e => e.id)]);
  };

  // ── Tatting Order helpers ─────────────────────────────────────────────────

  // Legacy-read shim: elements loaded via applyProjectData (useProjectFile.ts, not
  // renamed this session) still come back with the old `orderGroup` field. New/edited
  // elements get the new `roundId` field. Read through this helper everywhere so both
  // co-exist safely; every write below sets `roundId` and scrubs `orderGroup` on the
  // touched element, so the legacy field self-heals away as elements get edited.
  // (session 43: all known consumers — patternOutput.ts, svgExport.ts, useTattingOrder.ts,
  // useHistoryActions.ts, ShapeAndSqueezeControls.tsx — are confirmed migrated or unaffected.)
  const getRoundId = (el: any) => el?.roundId ?? el?.orderGroup;

  // Returns [fillColor, strokeColor] for an element's order badge based on its round.
  // Unassigned elements use index 0 (gold) — legacy single-color behavior.
  // Assigned elements start from index 1 so Round 1 is visually distinct from unassigned.
  const getRoundBadgeColor = (el): [string, string] => {
    const roundId = getRoundId(el);
    if (!roundId) return ORDER_GROUP_COLORS[0];
    const idx = rounds.findIndex(g => g.id === roundId);
    return ORDER_GROUP_COLORS[idx >= 0 ? (idx + 1) % ORDER_GROUP_COLORS.length : 1];
  };

  // Predicate: does element e belong to the currently active round scope?
  // Unassigned scope (activeRoundId === null) → elements with no round.
  // Round scope → elements whose round matches the active round id.
  const inActiveRound = (e: any) =>
    activeRoundId === null ? !getRoundId(e) : getRoundId(e) === activeRoundId;

  // Returns the fill color for a spatial group's overlay box + badge.
  // Prefers the registry's explicit color (user-set or default assigned at
  // creation by groupSelected in useEditorActions.ts); falls back to the
  // same ORDER_GROUP_COLORS palette rounds use (index 1+, so it doesn't
  // collide with slot 0's "unassigned" gold) for a group with no registry
  // entry yet — e.g. a legacy save's bare groupId with nothing in `groups`.
  const getGroupColor = (groupId: string): string => {
    const entry = groups.find(g => g.id === groupId);
    if (entry?.color) return entry.color;
    const idx = groups.findIndex(g => g.id === groupId);
    return ORDER_GROUP_COLORS[idx >= 0 ? (idx + 1) % ORDER_GROUP_COLORS.length : 1][0];
  };

  const getGroupName = (groupId: string): string =>
    groups.find(g => g.id === groupId)?.name ?? t('groupDefaultName');

  // Live-recomputed bounding boxes for every spatial group present in
  // `elements` — NOT a real element, per Design Discussion #2's agreed
  // approach (avoids a new pseudo-type every type-branch would need to
  // handle). Buckets by groupId, reuses the existing getSelectionBoundingBox
  // helper (already used for alignment ops) rather than a new implementation.
  const groupBoxes = useMemo(() => {
    const byGroup = new Map<string, any[]>();
    elements.forEach(el => {
      if (!el.groupId) return;
      if (!byGroup.has(el.groupId)) byGroup.set(el.groupId, []);
      byGroup.get(el.groupId)!.push(el);
    });
    const PAD = 14; // px padding around the tight element bounds, in world units
    return Array.from(byGroup.entries())
      .filter(([, els]) => els.length > 1) // a "group" of 1 (partial ungroup remainder) draws no box
      .map(([groupId, els]) => {
        const b = getSelectionBoundingBox(els);
        return {
          groupId,
          name: getGroupName(groupId),
          color: getGroupColor(groupId),
          minX: b.minX - PAD, minY: b.minY - PAD,
          maxX: b.maxX + PAD, maxY: b.maxY + PAD,
        };
      });
  }, [elements, groups]); // eslint-disable-line react-hooks/exhaustive-deps

  const getNextAvailableNumber = (): number => {
    const used = new Set(
      elements
        .filter(inActiveRound)
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
        inActiveRound(e)
    );
    if (existingEl) {
      setTattingOrderConflict({ newNum: num, existingElId: existingEl.id, targetElId });
      return;
    }
    const newEls = elements.map(e =>
      e.id === targetElId
        ? { ...e, orderNumber: num, isRepeat: false, roundId: activeRoundId ?? undefined, orderGroup: undefined }
        : e
    );
    setElements(newEls);
    setTattingOrderInput('');
    pushHistoryState(newEls, picotConnectionsRef.current, roundsRef.current);
  };

  const assignRepeat = (targetElId: string) => {
    const newEls = elements.map(e =>
      e.id === targetElId
        ? { ...e, isRepeat: true, orderNumber: null, roundId: activeRoundId ?? undefined, orderGroup: undefined }
        : e
    );
    setElements(newEls);
    setTattingOrderInput('');
    pushHistoryState(newEls, picotConnectionsRef.current, roundsRef.current);
  };

  const clearOrderAssignment = (targetElId: string) => {
    const newEls = elementsRef.current.map(e =>
      e.id === targetElId ? { ...e, orderNumber: null, roundId: undefined, orderGroup: undefined, isRepeat: false } : e
    );
    setElements(newEls);
    setTattingOrderInput('');
    pushHistoryState(newEls, picotConnectionsRef.current, roundsRef.current);
  };

  const resolveTattingOrderConflict = (action: 'swap' | 'shift' | 'cancel') => {
    if (!tattingOrderConflict) return;
    const { newNum, existingElId, targetElId } = tattingOrderConflict;
    let newEls = elements;
    if (action === 'swap') {
      const targetEl = elementById.get(targetElId);
      const oldNum = targetEl?.orderNumber ?? null;
      newEls = elements.map(e => {
        if (e.id === targetElId) return { ...e, orderNumber: newNum, isRepeat: false };
        if (e.id === existingElId) return { ...e, orderNumber: oldNum };
        return e;
      });
      setElements(newEls);
    } else if (action === 'shift') {
      newEls = elements.map(e => {
        if (e.id === targetElId) return { ...e, orderNumber: newNum, isRepeat: false, roundId: activeRoundId ?? undefined, orderGroup: undefined };
        const n = parseInt(String(e.orderNumber), 10);
        if (inActiveRound(e) && !isNaN(n) && n >= newNum) return { ...e, orderNumber: n + 1 };
        return e;
      });
      setElements(newEls);
    }
    setTattingOrderConflict(null);
    setTattingOrderInput('');
    if (action !== 'cancel') {
      pushHistoryState(newEls, picotConnectionsRef.current, roundsRef.current);
    }
  };
  // Convenience: push a history snapshot after any tatting-order mutation.
  // Call AFTER the state setters so refs are updated by the next render — but since
  // we pass current ref values directly, this captures the pre-setState snapshot which
  // is fine for undo (React batches the update anyway).
  const pushOrderHistory = () => {
    pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current);
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
      setElements(prev => updateElement(prev, elementId, { orderNumber: null }));
      pushOrderHistory();
    }
    setPropBarOrderDraft(null);
    inputEl?.blur();
  };

  // New canvas — asks only when there are unsaved changes (session 58; it
  // used to ask whenever the canvas wasn't empty, even right after a save).
  const newCanvas = () => {
    if (elements.length === 0 && historyIndex === 0 && currentFilePath === null) {
      return; // already a fresh, empty, untitled canvas
    }
    if (!hasUnsavedChanges) {
      confirmNewCanvas();
      return;
    }
    setConfirmDialog({
      title: t('newCanvasTitle'),
      message: t('newCanvasBody'),
      confirmLabel: t('newCanvasConfirm'),
      onConfirm: confirmNewCanvas,
    });
  };

  const confirmNewCanvas = () => {
    // We're about to explicitly set `history` to a single fresh entry below —
    // but elements/picotConnections also change in this same batch, which
    // independently re-triggers the auto-push effect. That effect would read
    // roundsRef.current/groupsRef.current (refs, one render stale relative to
    // this exact commit — their own sync effect hasn't run yet) and the real
    // polarGrids state (deliberately hidden, not cleared, a few lines below),
    // none of which match the literal empty object written to history here.
    // The de-dupe check would then see a "different" state and push a
    // spurious second entry — harmless in content (still empty elements) but
    // it left the undo button enabled on a brand new project. Same
    // skipAutoHistoryRef convention already used for rotation's ghost-regen
    // and the short-line-discard fix.
    skipAutoHistoryRef.current = true;
    setElements([]);
    setSelectedIds([]);
    setClipboard([]);
    setPicotConnections([]);
    setSelectedPicots([]);
    setProjectName(t('projectUntitled'));
    // Put world (0,0) — where a new polar grid appears — in the middle of
    // the canvas, as app start does (usePatternState). {x:0,y:0} here put
    // the origin in the canvas's top-left corner, so a grid turned on in a
    // new project was off screen (session 57).
    setCamera(canvasCenterCamera());
    setZoom(1);
    setHistory([{ elements: [], connections: [], polarGrids: [] }]);
    setHistoryIndex(0);
    setLastSavedRev(0); // fresh and empty = nothing unsaved
    // Hide (don't delete) all polar grids — user can re-enable in the Polar Grid panel
    setPolarGrids(prev => prev.map(g => ({ ...g, visible: false })));
    setCurrentFilePath(null);
    setRounds([]);
    setActiveRoundId(null);
    // Was missing entirely — every other piece of project state above got
    // reset, but materials didn't, so "New" silently carried over whatever
    // materials/gradients the previous project had defined instead of
    // starting from the single default white thread (bug fix, session 52).
    setMaterials(DEFAULT_MATERIALS);
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
      elements, picotConnections, rounds, materials, beadLibrary,
      threadPresets, activePresetId, dsWidth, patternNotes, projectName, currentFilePath, t,
    });
    const notesBlock = patternNotes?.trim() ? `\n\n--- ${t('patternOutNotes')} ---\n` + patternNotes.trim() : '';
    const text = result === null ? t('patternEmpty') + notesBlock : result.text;
    navigator.clipboard.writeText(text).then(
      () => { setLoadMsg({ type: 'success', text: t('notationCopied') }); setTimeout(() => setLoadMsg(null), 3000); },
      () => { setLoadMsg({ type: 'error', text: t('notationCopyFailed') }); setTimeout(() => setLoadMsg(null), 4000); }
    );
  }, [elements, picotConnections, rounds, materials, beadLibrary,
      threadPresets, activePresetId, dsWidth, patternNotes, projectName, currentFilePath, t]);
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

  // Geometry only — every ghost (boundary or not) has valid endpoint
  // positions, since the shape is identical across all instances. This is
  // used both for interactive tip dots (which the caller restricts to
  // boundary ghosts — see the picotJoin-mode render block) and for looking
  // up positions of ALREADY-CREATED connections, which routinely land on
  // interior (non-boundary) ghosts via inherited-join propagation. Gating
  // on isBoundary here used to silently break rendering of inherited tip
  // joins past the first ghost in the chain, even though the connection
  // itself was created correctly.
  const getEndpointPseudoPicots = (el: any): Array<{ id: string; x: number; y: number }> => {
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

  // Join/break/fold actions delegated to useJoinActions hook
  const { joinSelectedPicots, foldSelectedPicots, updateFoldConnection, breakSelectedPicots, reapplyInheritedJoins } = useJoinActions({
    selectedPicotsRef, elementsRef, picotConnectionsRef, roundsRef,
    elementById, ghostArrays,
    setElements, setPicotConnections, setSelectedPicots, setGhostArrays,
    pushHistoryState, skipAutoHistoryRef,
  });

  // Sticky Fold Mode toggle (session 47) — while armed, the Join action in
  // PicotJoinModeBar creates fold connections instead of regular ones. Stays
  // armed across multiple folds until manually toggled off; unrelated to
  // which picots are currently selected.
  const [foldModeArmed, setFoldModeArmed] = useState(false);

  // The fold connection whose sliders should currently show in Row 2 of
  // PicotJoinModeBar — derived from selectedPicots so "just folded" and
  // "clicked an existing fold to edit it" are the same code path (see the
  // comment in useJoinActions.ts's performJoin for why fold-creation
  // deliberately leaves the pair selected instead of clearing it).
  const activeFoldConnection = useMemo(() => {
    if (selectedPicots.length !== 2) return null;
    const [a, b] = selectedPicots;
    return picotConnections.find(conn =>
      conn.connectionType === 'fold' &&
      conn.picots.some((cp: any) => cp.elementId === a.elementId && cp.picotId === a.picotId) &&
      conn.picots.some((cp: any) => cp.elementId === b.elementId && cp.picotId === b.picotId)
    ) ?? null;
  }, [selectedPicots, picotConnections]);

  // Any connection (fold OR regular) that contains every currently
  // selected picot — generalizes activeFoldConnection above to drive the
  // color-override dropdown, which applies to both connection types (unlike
  // the fold sliders, which stay fold-only). Deliberately a SUBSET match,
  // not an exact-set match: fold picots auto-select their partner on click
  // (getFoldPartner in useJoinActions.ts), so a fold's full picot set is
  // typically selected together — but regular joins have no such
  // auto-select, so clicking one regular-joined picot only ever selects
  // that one picot. A subset match makes the dropdown show correctly for
  // both cases: fully-selected connections (fold) and single-picot
  // selections that belong to a larger connection (regular, or a fold/join
  // clicked before its partner). Also handles 3+-picot connections.
  const activeConnection = useMemo(() => {
    if (selectedPicots.length === 0) return null;
    const selKeys = selectedPicots.map(sp => `${sp.elementId}::${sp.picotId}`);
    return picotConnections.find(conn => {
      const connKeys = new Set(conn.picots.map((cp: any) => `${cp.elementId}::${cp.picotId}`));
      return selKeys.every(k => connKeys.has(k));
    }) ?? null;
  }, [selectedPicots, picotConnections]);

  // Join button's effective action while in picotJoin mode: fold when Fold
  // Mode is armed, regular join otherwise. Also gates the button's disabled
  // state — canFoldSelection is stricter than "length >= 2" (exactly 2,
  // both plain, neither already connected).
  const picotJoinAction = useCallback(() => {
    if (foldModeArmed) {
      foldSelectedPicots();
    } else {
      joinSelectedPicots();
    }
  }, [foldModeArmed, foldSelectedPicots, joinSelectedPicots]);

  const picotJoinDisabled = foldModeArmed
    ? !canFoldSelection(selectedPicots, elements, picotConnections)
    : selectedPicots.length < 2;

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
      // One id→element map per call instead of ids.every(id => array.find(...))
      // — see getPolarPivot (useEditorActions.ts) for why this was
      // O(selected × total) and why elementsRef.current (not elementById)
      // stays the data source.
      const byId = new Map((elementsRef.current as any[]).map((e: any) => [String(e.id), e]));
      const gid = byId.get(String(ids[0]))?.polarRotationGridId || null;
      if (gid && ids.every(id => byId.get(String(id))?.polarRotationGridId === gid)) {
        // Same visibility requirement as getPolarPivot (useEditorActions.ts) —
        // an invisible/hidden grid shouldn't silently govern the flip axis
        // either, for the same reason it shouldn't govern rotation.
        const linked = polarGrids.find(g => g.id === gid && g.visible);
        if (linked) return linked;
      }
    }
    return null;
  };

  // Flip elements across a vertical axis (FlipH, axisAngleDeg=90) or horizontal axis (FlipV, axisAngleDeg=0).
  // Simple arithmetic: FlipH  → new_x = 2*pivotX - old_x,  y unchanged
  //                    FlipV  → new_y = 2*pivotY - old_y,  x unchanged
  // ── Geometry repair (session 49) ────────────────────────────────────────
  // Detects and fixes elements whose `paths` were corrupted by the old
  // multi-select/group rotation bug and the old flipElements split-ring bug
  // (both fixed this session, but files saved before the fix may still
  // carry corrupted paths that won't self-heal just by loading them).
  //
  // IMPORTANT — what this can and can't guarantee:
  // For teardrop/circle rings, the old buggy rotation code built paths via
  // `createTeardropPath(newCenter) -> rotatePaths(rotation)` and NEVER
  // applied isFlippedH/isFlippedV at all, even when set. This repair
  // exactly inverts that known, specific operation (pure rotation, nothing
  // else) to recover the real canonical shape — this does NOT depend on
  // guessing dsWidth/squeeze/formula-version, it's a mathematical inverse
  // of a fully-known step. It then reapplies rotation + the flip that was
  // missing. `center` and `rotation` are left untouched, since those were
  // already correct — only `paths` is rebuilt.
  //
  // One honest caveat: this recovers the shape the buggy code's OWN
  // createTeardropPath call produced, not necessarily the exact appearance
  // before any special (e.g. polar-grid) placement tool first created the
  // element, if that tool used a different convention. That original
  // appearance can't be recovered from corrupted data by any method — the
  // bug itself already discarded it. This repair is the closest achievable
  // fix, and is internally consistent with how the app builds shapes today.
  const detectCorruptedRingGeometry = (el) => {
    if (el.type !== 'ring' || !el.paths?.length) return false;
    if (el.isSplitRing) return false; // split-ring geometry bug is fixed at the source (flipElements); old split-ring saves need the same treatment but via createSplitRingPathFromEl, not rotatePaths inversion — handle separately if needed.
    if (!['circle', 'teardrop'].includes(el.shapeStyle)) return false;
    // Heuristic: rebuild via the CURRENT correct pipeline (create -> rotate
    // -> flip) using this element's own stitchCount/squeeze, and compare to
    // stored paths. A large mismatch on an element that has isFlippedH or
    // isFlippedV set is the fingerprint of the old "flip never applied" bug.
    if (!el.isFlippedH && !el.isFlippedV) return false; // old bug only ever produced wrong output for flipped elements
    const targetLength = elementPathLength(el, dsWidth);
    const canonical = el.shapeStyle === 'circle'
      ? createCirclePath(el.center.x, el.center.y, targetLength, el.squeeze ?? 0)
      : createTeardropPath(el.center.x, el.center.y, targetLength, el.squeeze ?? 0);
    const expected = applyRotationToPathData(el, canonical).paths;
    // Compare the SET of points (order can legitimately differ across a
    // flip — see flipElements) rather than by array index.
    // IMPORTANT: this comparison alone is NOT reliable at a fixed pixel
    // threshold. Verified against bug_rotation2.json: several correctly-
    // authored, never-corrupted circles (grid-placed, likely built via a
    // different creation path than plain createCirclePath) mismatch this
    // formula by 7-12px purely from a shape-convention difference, NOT
    // corruption -- confirmed via their rigid-rotation-from-source error
    // being exactly 0. The real corruption in the same file mismatches by
    // 47-79px. Comparing error AS A FRACTION OF THE ELEMENT'S OWN RADIUS
    // cleanly separates the two: false positives topped out at ratio 1.22,
    // real corruption started at 2.28. Threshold below is set well inside
    // that gap, but this was calibrated against ONE test file's specific
    // false-positive pattern -- treat scanForCorruptedGeometry's output as
    // a candidate list for review, not a verdict. Do not wire this to an
    // auto-repair-on-load flow.
    const dist = (a, b) => Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
    const usedExpected = new Set();
    let totalErr = 0;
    for (const p of el.paths) {
      let best = Infinity, bestJ = -1;
      expected.forEach((q, j) => {
        if (usedExpected.has(j)) return;
        const d = dist(p, q);
        if (d < best) { best = d; bestJ = j; }
      });
      usedExpected.add(bestJ);
      totalErr += best;
    }
    const radius = targetLength / (2 * Math.PI);
    return radius > 0 && (totalErr / radius) > 1.8;
  };

  const repairRingGeometry = (el) => {
    // Exact inversion of the OLD buggy transform: it was pure rotatePaths
    // around the element's own (already-correct) center, nothing else.
    const canonicalRecovered = rotatePaths(el.paths, el.center.x, el.center.y, -el.rotation);
    const { paths } = applyRotationToPathData(el, { paths: canonicalRecovered });
    return paths;
  };

  // Scans elements and returns the ids flagged as having corrupted
  // geometry, without modifying anything — call this first to show the
  // person what would change before committing to repairElements.
  const scanForCorruptedGeometry = (ids) => {
    const targets = ids ? elements.filter(el => ids.includes(el.id)) : elements;
    return targets.filter(detectCorruptedRingGeometry).map(el => el.id);
  };

  // Repairs the given element ids (use scanForCorruptedGeometry's result,
  // or a person-reviewed subset of it). Only touches `paths`; everything
  // else (picots, notation, connections, color) is left exactly as-is.
  const repairElements = (ids) => {
    const newEls = (elementsRef.current as any[]).map((el: any) => {
      if (!ids.includes(el.id)) return el;
      if (!detectCorruptedRingGeometry(el)) return el; // safety: re-check, don't touch anything not actually flagged
      return { ...el, paths: repairRingGeometry(el) };
    });
    setElements(newEls);
    pushHistoryState(newEls, picotConnectionsRef.current, roundsRef.current);
  };

  // Picot Join on/off — the left toolbar button (both toolbar layouts) and
  // the getting-started hint share this. Same behaviour the toolbar button
  // always had inline (Shift+J has its own variant that also clears fold
  // state; left as it was).
  const togglePicotJoinMode = () => {
    if (activeMode === 'picotJoin') {
      setActiveMode(null);
    } else {
      setActiveMode('picotJoin');
      setCurrentTool('select');
      if (localStorage.getItem('tcad_seen_join_tip') !== '1') setShowJoinTip(true);
      setSelectedIds([]);
    }
  };

  // Beading mode on/off — rail (Full mode) and the phone bar's More panel.
  const toggleBeadingMode = () => {
    if (activeMode === 'beading') {
      setActiveMode(null);
      setSelectedBEs([]);
    } else {
      setActiveMode('beading');
      setCurrentTool('select');
      setSelectedIds([]);
      setSelectedBEs([]);
    }
  };

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
        // TRUE mirror of the existing two arcs — NOT a regenerate+rotate.
        // Rotating a freshly-rebuilt canonical shape (the old approach) can
        // never produce a reflection (rotation is det=+1, mirror is
        // det=-1), which is why flips looked "sometimes right" — a double
        // flip is secretly just a rotation, so that case accidentally
        // matched, while single flips never could. A split ring's 2-entry
        // paths array is the same shape as the generic branch's N-entry
        // case below, so the same proven mirrorPath+reverse composition
        // applies directly: new arc "A" is the mirror of the OLD arc B
        // (matching reversedB now describing the A slot), new arc "B" is
        // the mirror of the OLD arc A.
        const newPaths = el.paths.map(mirrorPath).reverse();
        const reversedAPicots = parsedA.picots.map(p => ({ ...p, stitchesBefore: sca - p.stitchesBefore })).reverse();
        const allPicots = [...reversedAPicots, ...parsedB.picots.map(p => ({ ...p, stitchesBefore: p.stitchesBefore + sca }))];
        return { ...el, center: newCenter, paths: newPaths, rotation: newAngle,
          isFlippedH: newIsFlippedH, isFlippedV: newIsFlippedV,
          notation: `sr: ${reversedB}`, notationB: reversedA,
          // Side squeezes travel with their arcs, like the notations: new
          // side A is the mirror of old arc B, so it takes old B's squeeze.
          // (Before session 57 these stayed put, so the next rebuild bent
          // each side with the other side's value.)
          squeezeCA: el.squeezeCB, squeezeCB: el.squeezeCA,
          // Colours travel with their arcs too (user decision, session 57):
          // paths[0] is drawn in materialId, and after the flip paths[0] is
          // the old B arc. materialIdB unset means "same as A", so only swap
          // when the two sides really differ.
          ...(el.materialIdB && el.materialIdB !== el.materialId
            ? { materialId: el.materialIdB, materialIdB: el.materialId } : {}),
          stitchCount: sca + scb, picots: allPicots, splitPosition: sca };
      }

      // ── Closed rings, chains, and lines ─────────────────────────────────
      // Mirror path coords + reverse notation so tatting order reads
      // correctly in the new orientation. Without notation reversal a
      // mirrored element has reversed physical structure but the same
      // notation — wrong for pattern output. Lines have no notation to
      // reverse, and closed rings always satisfy type !== 'line', so one
      // branch covers all three cases.
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



  // getFlipSign / getCircleStitchAngle moved to geometry/stitchGeometry.ts
  // (imported above) — flip-aware side/tangent helpers (session 48).

  // Outward perpendicular angle at a path point given its tangent (dx, dy).
  // Unlike getCircleStitchAngle, this does NOT need a flip correction: dx,dy
  // come from sampling the element's actual (already correctly mirrored —
  // reflected AND traversal-reversed for continuity, see flipElements)
  // path, so the reflection is already baked into the tangent itself.
  // Verified numerically against real flip/no-flip pairs — adding a
  // flipSign multiplier here, as an earlier pass in this session did,
  // double-corrects and is wrong. sideMultiplierOverride lets callers that
  // already resolved their own sideMultiplier (e.g. renderPicots, which
  // hoists it once per element) pass it through instead of re-reading
  // element.picotSideMultiplier.
  const getPathPerpAngle = (element, dx, dy, sideMultiplierOverride) => {
    const sideMultiplier = sideMultiplierOverride !== undefined
      ? sideMultiplierOverride
      : (element.picotSideMultiplier || 1);
    const sideOffset = sideMultiplier === -1 ? Math.PI : 0;
    return Math.atan2(dy, dx) - Math.PI / 2 + sideOffset;
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
      const angle = getCircleStitchAngle(element, _sb1);
      
      // In picotJoin mode all picots are dots on the path — return BASE for consistent hit-testing
      if (picot.isJoint || picot.isGuidePoint || baseOnly || activeMode === 'picotJoin') {
        // angle: outward radial direction — same direction a normal arm points
        // (see the non-base branch just below). Added session 47 so fold
        // rendering can get a base position AND its outward direction from
        // one call, instead of duplicating this math. Harmless to every
        // existing caller — they only ever destructure .x/.y.
        return {
          x: element.center.x + Math.cos(angle) * radius,
          y: element.center.y + Math.sin(angle) * radius,
          angle,
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
    // Shared stitch → path mapping (geometry/stitchGeometry.ts). Split rings
    // go through it too: their two paths are concatenated here, side A then B.
    const targetDist = elementStitchFraction(element, _sb2) * totalLength;
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
      // angle: same outward-perpendicular direction a normal arm points (see
      // the non-base branch just below) — added session 47, same reasoning
      // as the circle branch above.
      const baseAngle = getPathPerpAngle(element, dx, dy, sideMultiplier);
      return { x, y, angle: baseAngle };
    }
    
    // Regular picots: return TIP position (end of handle)
    const perpAngle = getPathPerpAngle(element, dx, dy, sideMultiplier);
    return {
      x: x + Math.cos(perpAngle) * len,
      y: y + Math.sin(perpAngle) * len
    };
  };

  // ── Single-element thread ribbon ────────────────────────────────────────
  // Turns a centreline (list of points) into ONE closed, filled outline
  // `2*halfWidth` wide — the same stroke-to-fill technique the baked picots
  // use (emitPicot in render/realisticRenderer.ts). Paired with
  // fill=<thread colour> + stroke="black" strokeWidth=1.5 +
  // paintOrder="stroke", it draws "black outline + coloured thread" as one
  // element instead of two stacked strokes. Normals use central
  // differences between neighbouring samples, so it works for any sampled
  // curve. Ends are flat, matching picots.
  const ribbonFromPoints = (pts: { x: number; y: number }[], halfWidth: number): string => {
    if (pts.length < 2) return '';
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * halfWidth, ny = (dx / len) * halfWidth;
      left.push({ x: pts[i].x + nx, y: pts[i].y + ny });
      right.push({ x: pts[i].x - nx, y: pts[i].y - ny });
    }
    let d = `M ${left[0].x},${left[0].y}`;
    for (let i = 1; i < left.length; i++) d += ` L ${left[i].x},${left[i].y}`;
    for (let i = right.length - 1; i >= 0; i--) d += ` L ${right[i].x},${right[i].y}`;
    return d + ' Z';
  };

  // Samples a single-cubic "M x,y C c1x,c1y c2x,c2y ex,ey" path string (the
  // exact shape buildFixedFeetArcD below produces) into points, for
  // ribbonFromPoints. Returns [] for anything else rather than guessing.
  const sampleCubicD = (d: string, steps = 32): { x: number; y: number }[] => {
    const n = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
    if (n.length !== 8 || n.some(v => !isFinite(v))) return [];
    const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      out.push({
        x: u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3,
        y: u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3,
      });
    }
    return out;
  };

  // ── Folded picot loop geometry ──────────────────────────────────────────
  // Builds a single arc between two FIXED, real points — used for the
  // fold's outer arc (revised after live in-app feedback with sketches: the
  // outer arc's two feet should be the real origin/anchor picot positions
  // and their actual on-canvas distance apart, not a synthetic offset — see
  // the two-sketch comparison that drove this) — with an independently
  // specified departure angle at each end and an actual
  // target arc length. Replaces the earlier height/bend/tangent-blend
  // parameterization (three different proxies stacked on each other, none
  // of which mapped to anything a person could reason about directly, and
  // the blend still allowed a self-crossing twist with no direct fix — only
  // an indirect slider) with three literal, physically-meaningful numbers.
  //
  // originAngle/anchorAngle: each foot's OWN outward-perpendicular angle
  //   (same direction a normal picot's arm exits the ring) — the zero
  //   reference each angle offset below is measured from.
  // angleA/angleB: degrees offset from that foot's own perpendicular,
  //   independently at each end. 0 = leaves the ring dead straight
  //   (perpendicular), matching a normal picot's arm — same default look as
  //   before. Positive reads as a visually counterclockwise rotation on
  //   screen: SVG's y-axis increases downward, so the standard (y-up)
  //   counterclockwise rotation formula would look clockwise here unless
  //   the angle is negated first — verified numerically before shipping
  //   (rotating a straight-up direction by a small positive angle moves it
  //   toward 9 o'clock, not 3 o'clock, as expected for CCW).
  // targetLength: the actual arc length the resulting curve should have —
  //   found via the same fixed-endpoints/target-length binary search
  //   applyPathPreset (paths.ts) already uses for the regular chain bow-
  //   angle presets, generalized from one shared angle to two independent
  //   ones. Both ends share a single solved-for control-point magnitude
  //   (matching applyPathPreset's existing symmetric-t approach) since
  //   there's only one length constraint to satisfy — an asymmetric
  //   magnitude split isn't something this can determine on its own.
  //   Physically bounded below by the straight-line distance between the
  //   two feet (a curve can never be shorter than its own chord); a target
  //   below that is simply unreachable and the search converges toward the
  //   chord length rather than erroring.
  const buildFixedFeetArcD = (
    foot1X: number, foot1Y: number, foot2X: number, foot2Y: number,
    originAngle: number, anchorAngle: number,
    angleA: number, angleB: number,
    targetLength: number
  ): string => {
    const rotateCCWOnScreen = (x: number, y: number, angleDeg: number) => {
      const rad = -angleDeg * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      return { x: x * cos - y * sin, y: x * sin + y * cos };
    };

    const dir1 = rotateCCWOnScreen(Math.cos(originAngle), Math.sin(originAngle), angleA);
    const dir2 = rotateCCWOnScreen(Math.cos(anchorAngle), Math.sin(anchorAngle), angleB);

    const chordLen = Math.hypot(foot2X - foot1X, foot2Y - foot1Y);
    let lo = 0, hi = Math.max(targetLength, chordLen) * 4, t = targetLength / 3;
    let c1x = foot1X, c1y = foot1Y, c2x = foot2X, c2y = foot2Y;
    for (let iter = 0; iter < 30; iter++) {
      c1x = foot1X + dir1.x * t; c1y = foot1Y + dir1.y * t;
      c2x = foot2X + dir2.x * t; c2y = foot2Y + dir2.y * t;
      const tryPath = { type: 'cubic', x: foot1X, y: foot1Y, control1X: c1x, control1Y: c1y, control2X: c2x, control2Y: c2y, endX: foot2X, endY: foot2Y };
      const len = calculatePathLength(sampleBezierPath(tryPath, 30));
      if (Math.abs(len - targetLength) < targetLength * 0.005) break;
      if (len < targetLength) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }

    return `M ${foot1X},${foot1Y} C ${c1x},${c1y} ${c2x},${c2y} ${foot2X},${foot2Y}`;
  };

  // Builds both apparent-picot paths for one fold connection together —
  // BOTH now share the exact same two feet (the real origin and anchor
  // picot positions), differing only in height and bend, like concentric
  // nested rainbow arcs. This is a simplification (session 47, after live
  // feedback across several rounds): earlier versions tried giving the
  // inner arc its own small local footprint near the origin, but that's not
  // actually what a fold looks like — the inner apparent picot's far end is
  // the SAME anchor point the outer one reaches, just at a different
  // height/lean. Matches the very first hand sketch this feature was
  // designed from (nested rainbow arcs sharing one base span), which earlier
  // implementation attempts had drifted away from.
  //
  // footSpreadFrac is no longer used for a separate footprint (see above) —
  // now repurposed as the OFFSET each arc's feet get pulled apart by, at
  // BOTH ends, so the two arcs don't literally touch down on the exact same
  // pixels (which reads as one merged shape at the base, especially when
  // outerLength/innerLength put both arcs' lengths close together). Session
  // 47, live-tested value: offset = dsWidth / 2 (half a stitch-width) is
  // confirmed as "perfect" against dsWidth = 10px at default zoom — tied to
  // dsWidth rather than hardcoded so it stays correct if dsWidth is ever
  // something other than 10. Outer's feet pull OUTWARD (away from each
  // other, along the origin-anchor axis) so its span is slightly WIDER than
  // the real distance; inner's feet pull INWARD so its span is slightly
  // NARROWER — both arcs still converge toward the same two real points as
  // the offset shrinks, they just fan apart right at the base instead of
  // sharing literal identical pixels there.
  const buildFoldLoopPair = (
    originX: number, originY: number, originAngle: number,
    anchorX: number, anchorY: number, anchorAngle: number,
    outerLength: number, innerLength: number, angleA: number, angleB: number,
    footOffset: number = dsWidth / 2
  ): { outerD: string; innerD: string } => {
    const dx = anchorX - originX, dy = anchorY - originY;
    const dist = Math.hypot(dx, dy) || 1;
    const alongX = dx / dist, alongY = dy / dist;

    // Outer: origin foot pulled AWAY from anchor, anchor foot pulled AWAY
    // from origin — widens the span.
    const outerOriginX = originX - alongX * footOffset, outerOriginY = originY - alongY * footOffset;
    const outerAnchorX = anchorX + alongX * footOffset, outerAnchorY = anchorY + alongY * footOffset;
    // Inner: both feet pulled INWARD, toward each other — narrows the span.
    const innerOriginX = originX + alongX * footOffset, innerOriginY = originY + alongY * footOffset;
    const innerAnchorX = anchorX - alongX * footOffset, innerAnchorY = anchorY - alongY * footOffset;

    // Both arcs' feet are shifted slightly along the chord from the real
    // origin/anchor points (see above), but they still launch along the
    // SAME real origin/anchor outward angles — the shift is small (half a
    // stitch-width) and purely to keep the two arcs visually separated at
    // the base, not a different picot with its own angle. Same
    // angleA/angleB for both arcs — the departure direction is about each
    // picot's own angle, not which arc (outer/inner) it belongs to; only
    // the length differs between them.
    const outerD = buildFixedFeetArcD(outerOriginX, outerOriginY, outerAnchorX, outerAnchorY, originAngle, anchorAngle, angleA, angleB, outerLength);
    const innerD = buildFixedFeetArcD(innerOriginX, innerOriginY, innerAnchorX, innerAnchorY, originAngle, anchorAngle, angleA, angleB, innerLength);

    return { outerD, innerD };
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
    renderMode, patternNotes, materials, rounds, beadLibrary,
    polarGrids, selectedPolarGridId, threadPresets, activePresetId,
    projectName, currentFilePath,
    historyIndexRef, canvasRef,
    setElements, setPicotConnections, setCamera, setZoom, setDsWidth,
    setBgColor, setGridEnabled, setCustomColors, setReferenceImage, setRefImageProps,
    setProjectName, setRenderMode, setPatternNotes, setMaterials,
    setRounds, setActiveRoundId, setPolarGrids, setSelectedPolarGridId,
    setThreadPresets, setActivePresetId,
    setSelectedIds, setSelectedPicots,
    setHistory, setHistoryIndex, setCurrentFilePath, setLastSavedRev,
    getCurrentHistoryRev: () => (historyRef.current[historyIndexRef.current] as any)?.rev ?? 0,
    getPicotPosition, showLoadMsg, t,
    cleanupDuplicates,
    skipAutoHistoryRef,
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
        // Circle: top/reference point — this was a THIRD independent copy of
        // the circle-angle formula (session 48), inline and with zero flip
        // awareness (no isFlippedH/V at all), unrelated to the picot/label
        // formulas already fixed elsewhere. Verified against true geometric
        // reflection: matched exactly for V-only, H-only, and H+V flips.
        // This is very likely the actual source of the JK "guide point"
        // marker — JK is shapeStyle:'circle' with 0 picots, so this snap
        // point may be the only thing available to visualize for it.
        const targetCircumference = element.stitchCount * dsWidth;
        const radius = targetCircumference / (2 * Math.PI);
        const angle = getCircleStitchAngle(element, 0);
        
        const topX = element.center.x + Math.cos(angle) * radius;
        const topY = element.center.y + Math.sin(angle) * radius;
        
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
      const centerDist0 = Math.hypot(grid.center.x - worldX, grid.center.y - worldY);
      if (centerDist0 < nearestDist) {
        nearestDist = centerDist0;
        result = { x: grid.center.x, y: grid.center.y };
      }
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

    let remappedConns = picotConnectionsRef.current;
    if (result.connectionIdMap.size > 0) {
      remappedConns = picotConnectionsRef.current.map(conn => ({
        ...conn,
        picots: conn.picots.map(cp => ({
          ...cp,
          elementId: result.connectionIdMap.get(cp.elementId) || cp.elementId,
        })),
      }));
      setPicotConnections(remappedConns);
      picotConnectionsRef.current = remappedConns;
    }

    // Replays any recorded inherited joins onto the freshly-regenerated ghosts.
    // Covers both slots that already existed (their joins were already carried
    // forward by the ID remap above, so this is a no-op for them via the
    // dedupe check inside buildConnectionsForInheritedJoin) and slots that are
    // entirely new because the array just grew, which the remap above can't
    // reach since there's no old ghost at that position to map from.
    reapplyInheritedJoins(result.elements, result.ghostArrays);
  };

  // Thin wrapper for standalone use (e.g. the "Update Array" button in the
  // Array Manager dialog, which already runs synchronously from an onClick).
  const updateGhostArraysForMother = (motherId: string) => {
    const result = regenerateGhostArrays(elementsRef.current, ghostArrays, [motherId]);
    applyGhostRegenResult(result);
  };

  // Commits a single replaced path segment onto one element (single-path
  // chains/lines only). Used by path/line preset angle application, both
  // from the keyboard shortcuts and the floating preset-angle panel buttons.
  // Computes the updated array once and reuses it for both setElements and
  // pushHistoryState, rather than recomputing the same .map() twice.
  const commitSinglePathUpdate = (elId: string, newPath: any) => {
    // center follows the chord midpoint (line angle presets move the end
    // point; chain presets keep both ends, so this is a no-op for them).
    const updated = elementsRef.current.map(e => e.id === elId ? withChordCenter({ ...e, paths: [newPath] }) : e);
    setElements(updated);
    pushHistoryState(updated, picotConnectionsRef.current, roundsRef.current);
  };


  const { handleMouseDown, handleMouseMove, handleMouseUp } = useInputHandlers({
    elements, selectedIds, selectedIdSet, elementById,
    camera, zoom, dsWidth, renderMode, activeMode, currentTool,
    isDragging, dragStart, draggedElement, selectionBox, zoomRectBox,
    movingPivot, rotationHandle, pivotOffset, rulerPoints,
    snapEnabled, snapRadius, orthoLock, isShiftHeld, showRotationHandles,
    polarGrids, picotConnections, selectedBEs, selectedPicots,
    chainPresetSymmetric, rounds,
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

  // Always-current handleMouseUp for the mount-once window-blur listener
  // below (same stale-closure reason as handleMouseMoveInternalRef).
  const handleMouseUpRef = useRef<any>(null);
  handleMouseUpRef.current = handleMouseUp;

  // Window lost focus mid-gesture (alt-tab, dragging off and releasing over
  // another app, an OS dialog stealing focus): the matching release event
  // never reaches this page, so neither the canvas's own mouseup nor the
  // document-level pointerup safety net above can see it. Without this, the
  // edit made during that gesture never got its own undo step, and a stuck
  // flag could disable history for the rest of the session. Flushes —
  // pushes the pending edit as one undo step — rather than just resetting
  // the flags, which would drop the edit from history.
  //   1. A canvas drag in progress (move, rotate handle, pivot, path
  //      handle): finish it through handleMouseUp(null), the same call the
  //      touch handlers already use to end a gesture. That commits a
  //      translate-drag's pending offset and pushes history the normal way.
  //   2. Anything still flagged after that (e.g. a property-bar slider that
  //      set isInteractingRef itself): push directly.
  //   3. A NumberStepper hold-to-repeat (nudgeActiveRef): push and clear.
  useEffect(() => {
    const flushOnBlur = () => {
      if (dragOffsetRef.current.active || isInteractingRef.current) {
        handleMouseUpRef.current?.(null);
      }
      if (isInteractingRef.current) {
        isInteractingRef.current = false;
        pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current);
      }
      if (nudgeActiveRef.current) {
        nudgeActiveRef.current = false;
        pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current);
      }
    };
    window.addEventListener('blur', flushOnBlur);
    return () => window.removeEventListener('blur', flushOnBlur);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Arrow-key nudge (session 57) ────────────────────────────────────────
  // Arrow = 1 canvas unit; Shift+Arrow = 1 ds (dsWidth). Moves the whole
  // selection exactly like a mouse drag does (moveElement for the path
  // shift; if a ghost-array mother or a ghost is involved, its arrays are
  // regenerated through the usual applyGhostRegenResult funnel). No
  // snapping — a nudge is meant to be precise.
  //
  // Holding a key repeats; the whole hold is ONE undo step, using the same
  // nudgeActiveRef mechanism as the ±1° hold-to-repeat buttons: it's set
  // before the first move (so the auto-history effect skips every repeat)
  // and cleared on keyup with one explicit push. If the key-up is lost
  // (window loses focus, etc.), the existing window-blur flush and
  // document-pointerup safety net release it — same as a stuck stepper.
  // No skipAutoHistoryRef before that push: nothing changes state after it,
  // so the flag would wrongly swallow the user's NEXT edit (the blur flush
  // follows the same rule).
  //
  // Own listener, calling through refs reassigned every render (the
  // handleMouseUpRef pattern), so it always sees current state — the main
  // keydown handler below is only rebound when saveProject changes, and
  // there is no ghostArrays ref mirror elsewhere. Skipped while typing or
  // when focus is on any form control (a focused slider uses arrows itself),
  // in realistic view, in picot-join / beading / tatting-order modes, and
  // during a mouse drag.
  const ghostArraysLatestRef = useRef(ghostArrays);
  ghostArraysLatestRef.current = ghostArrays;
  const arrowNudgeRef = useRef<(dirX: number, dirY: number, big: boolean) => boolean>(() => false);
  arrowNudgeRef.current = (dirX, dirY, big) => {
    if (renderMode === 'realistic') return false;
    const mode = activeModeRef.current;
    if (mode === 'picotJoin' || mode === 'beading' || mode === 'tattingOrder') return false;
    if (dragOffsetRef.current.active || isInteractingRef.current) return false;
    const ids = new Set(selectedIdsRef.current as string[]);
    if (ids.size === 0) return false;
    const current = elementsRef.current as any[];
    if (!current.some(el => ids.has(el.id))) return false;
    const step = big ? dsWidth : 1;
    const dx = dirX * step, dy = dirY * step;
    nudgeActiveRef.current = true; // before any state change — see above
    const moved = current.map(el => (ids.has(el.id) && el.center && el.paths) ? moveElement(el, dx, dy) : el);
    const touchesArrays = moved.some(el => ids.has(el.id) && (el.isGhostMother || el.type === 'ghost'));
    if (touchesArrays) {
      // Same call the mouse drag makes (all selected ids).
      const result = regenerateGhostArrays(moved, ghostArraysLatestRef.current, [...ids]);
      applyGhostRegenResult(result);
      (elementsRef as any).current = result.elements;
      ghostArraysLatestRef.current = result.ghostArrays;
    } else {
      setElements(moved);
      (elementsRef as any).current = moved; // next repeat may arrive before the re-render
    }
    return true;
  };
  const arrowNudgeEndRef = useRef<() => void>(() => {});
  arrowNudgeEndRef.current = () => {
    if (!nudgeActiveRef.current) return; // already flushed (window blur / pointerup)
    nudgeActiveRef.current = false;
    pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current,
      polarGrids, groupsRef.current, ghostArraysLatestRef.current);
  };
  useEffect(() => {
    const DIRS: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const held = new Set<string>();
    let nudging = false;
    const isFormControl = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (isTypingTarget(el) || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = DIRS[e.key];
      if (!dir || e.ctrlKey || e.metaKey || e.altKey || isFormControl(e.target)) return;
      if (arrowNudgeRef.current(dir[0], dir[1], e.shiftKey)) {
        e.preventDefault(); // don't scroll the page
        held.add(e.key);
        nudging = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!DIRS[e.key]) return;
      held.delete(e.key);
      if (nudging && held.size === 0) {
        nudging = false;
        arrowNudgeEndRef.current();
      }
    };
    const onBlur = () => { held.clear(); nudging = false; }; // the blur flush pushes history
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      
      // Undo: Ctrl+Z (not Shift)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      
      // Redo: Shift+Z, or Ctrl/Cmd+Shift+Z (the Redo button's tooltip and the
      // usual convention in other apps — previously only Shift+Z worked).
      if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) {
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
        zoomToCenter(ZOOM_STEP_KEYBOARD);
        return;
      }
      if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomToCenter(-ZOOM_STEP_KEYBOARD);
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
            const targetLength = elementPathLength(el, dsWidth);
            if (path.type === 'cubic' && path.control1X !== undefined && path.control2X !== undefined) {
              const newPath = applyPathPreset(path, presetDeg, targetLength, true); // presets always symmetric
              if (newPath !== path) {
                commitSinglePathUpdate(el.id, newPath);
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
                commitSinglePathUpdate(el.id, newPath);
              }
            }
          }
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (activeModeRef.current === 'picotJoin' && selectedPicotsRef.current.length > 0) {
          breakSelectedPicots();
        } else if (activeModeRef.current === 'tattingOrder') {
          const selId = selectedIdsRef.current.length === 1 ? selectedIdsRef.current[0] : null;
          if (selId) clearOrderAssignment(selId);
        } else {
          deleteSelected();
        }
      } else if ((e.key === 'j' || e.key === 'J') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (activeModeRef.current === 'picotJoin' && selectedPicotsRef.current.length >= 2) {
          e.preventDefault();
          // Respects Fold Mode — foldSelectedPicots no-ops internally via
          // canFoldSelection if the current pair isn't fold-eligible, same
          // as the disabled state on the Join button in PicotJoinModeBar.
          if (foldModeArmedRef.current) {
            foldSelectedPicots();
          } else {
            joinSelectedPicots();
          }
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

      // ── Tatting order shortcuts ──────────────────────────────────────────
      } else if (activeModeRef.current === 'tattingOrder' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const selId = selectedIdsRef.current.length === 1 ? selectedIdsRef.current[0] : null;
        if (!selId) {
          // no-op
        } else if (e.key === 'r' || e.key === 'R') {
          if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            assignRepeat(selId);
          }
        } else if (e.key === 'n' || e.key === 'N') {
          if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            assignOrderNumber(selId, getNextAvailableNumber());
          }
        } else if (e.key === 'PageUp') {
          // PgUp — move to next group (higher round number), create one if at the end
          e.preventDefault();
          const groups = roundsRef.current;
          if (activeRoundIdRef.current === null) {
            // Ungrouped → first group
            if (groups.length > 0) {
              setActiveRoundId(groups[0].id);
            } else {
              // No groups yet — create the first one
              const name = t('tattingOrderRoundDefault').replace('{n}', '1');
              const id = crypto.randomUUID();
              const newGroups = [{ id, name }];
              setRounds(newGroups);
              setActiveRoundId(id);
              pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
            }
          } else {
            const idx = groups.findIndex(g => g.id === activeRoundIdRef.current);
            if (idx < groups.length - 1) {
              // Move to next group
              setActiveRoundId(groups[idx + 1].id);
            } else {
              // At last group — create a new one
              const name = t('tattingOrderRoundDefault').replace('{n}', String(groups.length + 1));
              const id = crypto.randomUUID();
              const newGroups = [...groups, { id, name }];
              setRounds(newGroups);
              setActiveRoundId(id);
              pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
            }
          }
        } else if (e.key === 'PageDown') {
          // PgDn — move to previous group (lower round number), back to ungrouped if at first
          e.preventDefault();
          const groups = roundsRef.current;
          if (activeRoundIdRef.current !== null) {
            const idx = groups.findIndex(g => g.id === activeRoundIdRef.current);
            if (idx === 0) {
              setActiveRoundId(null); // back to ungrouped
            } else if (idx > 0) {
              setActiveRoundId(groups[idx - 1].id);
            }
          }
          // Already ungrouped — PgDn is a no-op (nothing lower to go to)
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            clearOrderAssignment(selId);
          }
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
            setActiveMode(null); setShowJoinTip(false); setSelectedPicots([]); setFoldModeArmed(false);
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

  // Options shared by updateNotation and updateNotationForMultiple.
  // preservesExistingPicots and picotMatchMode are both optional here even
  // though updateNotationForMultiple only actually supports
  // preservesExistingPicots: true — that's enforced with a runtime check
  // there (see its own comment), not by the type, since a plain boolean
  // wouldn't be any safer as a required field.
  interface NotationUpdateOpts {
    preservesExistingPicots?: boolean;
    picotMatchMode?: 'stitchesBefore' | 'order';
  }

  // A picot's "kind" — everything about it except position (stitchesBefore),
  // identity (id), and current join state (isJoint). Two picot lists with
  // an identical kind-sequence describe the same picots in the same order;
  // only the ds/rds runs around them changed length. That's a mechanical
  // proof, not a guess — unlike matching by stitchesBefore alone, which
  // breaks the moment an earlier run's length shifts everything after it,
  // this can't be fooled by a length-only edit.
  const picotKind = (p: any): string => JSON.stringify([
    p.length, !!p.isGuide, !!p.isGuidePoint, p.beadType ?? null,
    !!p.isCoreJoin, !!p.hasPicotArm, p.beadSeq ?? null, p.beadSize ?? null,
    p.coreSize ?? null, p.beStructure ?? null,
  ]);

  // Single source of truth for merging old picots (ids + join state) onto
  // a freshly-parsed picot list, used by both notation-edit branches below
  // (previously each had its own inline stitchesBefore-only version).
  //
  // Matches by index ("order") when it's provably safe: either the caller
  // explicitly requests it (Picot Wizard operations that can prove they
  // never add/remove/reorder picots), or the old/new lists have identical
  // length AND identical kind-sequence — which proves the same thing for
  // free, for edits that only reshuffle run lengths around unchanged
  // picots. Falls back to matching by stitchesBefore otherwise, same as
  // before. Returns which of the old joined-and-connected picot ids did
  // NOT survive the merge, so the caller can decide whether to warn/confirm
  // and prune exactly those connections instead of wiping everything.
  const mergePicotsPreservingJoins = (
    oldPicots: any[], newPicots: any[], elementId: string,
    survivingConnKeys: Set<string>, requestedMode: 'stitchesBefore' | 'order'
  ): { picots: any[]; droppedJoinIds: string[] } => {
    const canUseOrder =
      requestedMode === 'order' ||
      (oldPicots.length === newPicots.length &&
        oldPicots.every((op, idx) => picotKind(op) === picotKind(newPicots[idx])));

    let merged;
    if (canUseOrder) {
      merged = newPicots.map((p, idx) => {
        const old = oldPicots[idx];
        if (!old) return p;
        const isStillJoint = old.isJoint && survivingConnKeys.has(`${elementId}::${old.id}`);
        return { ...p, id: old.id, isJoint: isStillJoint };
      });
    } else {
      const oldBySb: Record<number, any> = {};
      oldPicots.forEach(p => { oldBySb[p.stitchesBefore] = p; });
      merged = newPicots.map(p => {
        const old = oldBySb[p.stitchesBefore];
        if (!old) return p;
        const isStillJoint = old.isJoint && survivingConnKeys.has(`${elementId}::${old.id}`);
        return { ...p, id: old.id, isJoint: isStillJoint };
      });
    }

    const survivedIds = new Set(merged.filter(p => p.isJoint).map(p => p.id));
    const droppedJoinIds = oldPicots
      .filter(p => p.isJoint && survivingConnKeys.has(`${elementId}::${p.id}`) && !survivedIds.has(p.id))
      .map(p => p.id);

    return { picots: merged, droppedJoinIds };
  };

  // Computes the updated element object for a notation edit — handles both
  // split-ring (dual A/B) and plain (ring/chain) notation, path rescaling
  // (radial for closed rings, bezier re-bend for open chains), and picot
  // merging via mergePicotsPreservingJoins. Returns null if the notation
  // doesn't parse, otherwise the updated element plus any old joined picot
  // ids that couldn't be safely carried over. Doesn't touch React state at
  // all — pure per-element transform, safe to call once per target from
  // either the single-element path (updateNotation) or the batch path
  // (updateNotationForMultiple) below.
  const computeElementAfterNotationEdit = (
    el: any,
    notation: string,
    notationB: string | null,
    picotMatchMode: 'stitchesBefore' | 'order',
    survivingConnKeys: Set<string>
  ): { element: any; droppedJoinIds: string[] } | null => {
    if (el.isSplitRing) {
      const notationAText = notation.replace(/^sr:\s*/, '');
      const notationBText = notationB || el.notationB || '5ds';

      const parsedA = parseNotation(`sr: ${notationAText}`);
      const parsedB = parseNotation(`sr: ${notationBText}`);
      if (!parsedA || !parsedB) return null;

      const stitchCountA = parsedA.stitchCount;
      const stitchCountB = parsedB.stitchCount;
      const totalStitches = stitchCountA + stitchCountB;

      const oldTotal = el.stitchCount;
      let finalPaths = el.paths;
      if (Math.abs(totalStitches - oldTotal) > 0.01 && oldTotal > 0) {
        // Regenerate the two arcs from the element's own center/rotation/
        // squeeze at the new per-side stitch counts, instead of uniformly
        // scaling the whole ring from its center — a uniform scale grows
        // BOTH arcs together even when only one side's notation actually
        // changed length, which reads as "the whole ring got bigger"
        // instead of "this side bulged out". createSplitRingPathFromEl is
        // the function the squeeze sliders already use for this (hence it
        // correctly bulges), and is exactly what the geometry-repair
        // tooling's own comments point to for split-ring geometry — it was
        // imported but never actually called anywhere in this file.
        // Session 57: rebuilt IN PLACE (rebuildSplitRingInPlace, paths.ts) —
        // the old call used the canonical, unrotated arcs directly, so a
        // rotated or flipped split ring snapped back upright/unmirrored on
        // any stitch-count change.
        const rebuilt = rebuildSplitRingInPlace(el, dsWidth, { stitchCount: totalStitches, splitPosition: stitchCountA });
        if (Array.isArray(rebuilt) && rebuilt.length === 2) {
          finalPaths = rebuilt;
        } else {
          console.error('[TATCAD] rebuildSplitRingInPlace returned an unexpected shape; keeping prior paths', rebuilt);
        }
      }

      const reversedAPicots = parsedA.picots.map(p => ({
        ...p,
        stitchesBefore: stitchCountA - p.stitchesBefore,
      })).reverse();

      const newPicotsRaw = [...reversedAPicots, ...parsedB.picots.map(p => ({
        ...p, stitchesBefore: p.stitchesBefore + stitchCountA
      }))];
      const { picots: allPicots, droppedJoinIds } = mergePicotsPreservingJoins(
        el.picots || [], newPicotsRaw, el.id, survivingConnKeys, picotMatchMode
      );

      return { element: { ...el, notation: `sr: ${notationAText}`, notationB: notationBText,
        stitchCount: totalStitches,
        picots: restoreBEConfigs(allPicots, extractBEConfigs(el.picots)),
        paths: finalPaths, splitPosition: stitchCountA }, droppedJoinIds };
    }

    const parsed = parseNotation(notation);
    if (!parsed) return null;

    let newPathData = {};
    // Lengths include the end allowance (elementPathLength). newLength is
    // measured on the element as it will be after the edit, so a notation
    // that changes eligibility (e.g. to jk:) gets the matching length.
    const elAfterEdit = { ...el, notation, stitchCount: parsed.stitchCount };
    if (el.isClosed) {
      const oldLength = elementPathLength(el, dsWidth);
      const newLength = elementPathLength(elAfterEdit, dsWidth);
      if (Math.abs(oldLength - newLength) > 0.01) {
        // Shared with "apply end allowance" — geometry/paths.ts.
        newPathData = { paths: scalePathsAboutPoint(el.paths, el.center.x, el.center.y, newLength / oldLength) };
      }
    } else {
      // Only regenerate the curve when the notation edit actually changes the
      // stitch count (mirrors the isClosed branch's oldLength/newLength gate
      // above). Without this gate, the bisection below ran on EVERY edit —
      // including ones like a pure reversal that leave stitchCount unchanged
      // — and it targets stitchCount*dsWidth exactly, discarding whatever
      // actual current arc length the chain had. If the user had ever
      // manually stretched/dragged the chain so its real length differs even
      // slightly from that nominal value, any subsequent edit would silently
      // snap it back, which is what was resetting manually-adjusted curves
      // (and tripping the live isTooShort check) on a same-length reversal.
      const oldLength = elementPathLength(el, dsWidth);
      const newLength = elementPathLength(elAfterEdit, dsWidth);
      if (el.paths && el.paths.length > 0 && Math.abs(oldLength - newLength) > 0.01) {
        // Every path re-bent to the full new length (unchanged behaviour —
        // multi-path chains are a known pre-existing gap; see handoff).
        // Shared with "apply end allowance" — geometry/paths.ts.
        newPathData = { paths: el.paths.map(path => rebendChainPathToLength(path, oldLength, newLength)) };
      }
    }

    const { picots: mergedPicots, droppedJoinIds } = mergePicotsPreservingJoins(
      el.picots || [], parsed.picots, el.id, survivingConnKeys, picotMatchMode
    );

    return {
      element: {
        ...el, notation, stitchCount: parsed.stitchCount,
        picots: restoreBEConfigs(mergedPicots, extractBEConfigs(el.picots)),
        isSplitChain: parsed.isSplitChain ?? el.isSplitChain ?? false,
        ...(Object.keys(newPathData).length > 0 ? newPathData : {})
      },
      droppedJoinIds,
    };
  };

  const updateNotation = (notation, notationB = null, elementId = null, opts: NotationUpdateOpts = {}) => {
    const { preservesExistingPicots = false, picotMatchMode = 'stitchesBefore' } = opts;
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

    // Compute the merge against the CURRENT (untouched) connections — no
    // more wiping everything up front and hoping the merge doesn't need it.
    // mergePicotsPreservingJoins proves, per-edit, whether the same picots
    // survived (matching by kind-sequence, not just position), so most
    // edits that only change run lengths around unchanged picots now keep
    // every join automatically, connections untouched. Only picots that
    // genuinely couldn't be matched (something actually added/removed/
    // reordered) come back in droppedJoinIds.
    const survivingConnKeys = new Set(
      picotConnectionsRef.current.flatMap(conn => conn.picots.map(cp => `${cp.elementId}::${cp.picotId}`))
    );

    const applyNotationChange = () => {
      const computed = computeElementAfterNotationEdit(currentElement, notation, notationB, picotMatchMode, survivingConnKeys);
      if (!computed) return;
      const { element: nextEl, droppedJoinIds } = computed;

      // preservesExistingPicots callers (Picot Wizard) have already proven
      // they never change picot identity — trust that guarantee and skip
      // both the confirm dialog and any pruning.
      const doWarn = !preservesExistingPicots && droppedJoinIds.length > 0;

      const commit = () => {
        if (droppedJoinIds.length > 0 && !preservesExistingPicots) {
          const droppedSet = new Set(droppedJoinIds);
          const connsToRemove = picotConnectionsRef.current.filter(conn =>
            conn.picots.some(cp => isTargetOrGhost(cp.elementId) && droppedSet.has(cp.picotId))
          );
          const newConns = picotConnectionsRef.current.filter(conn => !connsToRemove.includes(conn));
          setPicotConnections(newConns);
          picotConnectionsRef.current = newConns;

          // Demote isJoint on the OTHER side of each removed connection too.
          // The dropped picot's own element gets a fresh picots array below
          // (nextEl / ghost regen), but the picot on the far end of a
          // removed connection — e.g. the other half of a fold — was
          // previously left stranded showing isJoint: true with no
          // connection record behind it (bug fix, session 52 — same
          // demotion breakSelectedPicots already does in useJoinActions.ts,
          // applied here since this path drops connections as a side
          // effect too, not just on an explicit Break action).
          const demoteKeys = new Map<string, boolean>();
          connsToRemove.forEach(conn => {
            conn.picots.forEach(cp => {
              if (!isTargetOrGhost(cp.elementId)) demoteKeys.set(`${cp.elementId}::${cp.picotId}`, false);
            });
          });
          if (demoteKeys.size > 0) {
            elementsRef.current = applyJointFlags(elementsRef.current, demoteKeys);
          }
        }

        // Read elementsRef.current directly rather than via a setElements
        // updater — regenerateGhostArrays calls generateId() per ghost, and
        // React can invoke functional updaters more than once (e.g. Strict
        // Mode's double-invoke check for impure updaters), which would desync
        // the ghost IDs actually committed from the ones used to rewire
        // picotConnections. Computing everything as a plain value up front and
        // committing once with setElements(value) avoids that entirely.
        const updated = elementsRef.current.map(el => el.id === targetId ? nextEl : el);

        // Compose ghost regeneration with the notation edit when the edited
        // element is a ghost mother, so the whole thing commits as one
        // render/history step instead of two — was previously deferred via
        // pendingGhostUpdateRef + a separate effect, which caused a visible
        // two-step undo and a brief desynced frame between mother and ghosts.
        if (nextEl.isGhostMother) {
          applyGhostRegenResult(regenerateGhostArrays(updated, ghostArrays, [targetId]));
        } else {
          setElements(updated);
        }
      };

      if (doWarn) {
        setConfirmDialog({
          title: t('notationChangeConfirmTitle'),
          message: t('notationChangeConfirmMessage'),
          confirmLabel: t('notationChangeConfirmBtn'),
          onConfirm: commit,
        });
      } else {
        commit();
      }
    };

    applyNotationChange();
  };

  // Batch version of updateNotation for operations that touch several
  // elements at once (multi-element Scale). Calling updateNotation in a
  // plain loop doesn't work here: elementsRef only syncs from `elements`
  // state via a useEffect, which runs after React commits — not
  // synchronously — so a second updateNotation call in the same tick would
  // still see the pre-first-edit snapshot and overwrite it. This reads
  // elementsRef.current once, applies every target within that single pass,
  // and commits with one setElements + one history entry — which also means
  // the whole batch undoes in one step, rather than needing N undos.
  //
  // Intentionally narrow: only supports preservesExistingPicots callers (so
  // there's never a per-target wipe/confirm decision to reconcile across the
  // batch), and skips ghost-mother elements entirely (regenerateGhostArrays
  // is single-target; composing it across a batch is real added complexity
  // this doesn't need yet, so a ghost mother in the selection is just left
  // untouched rather than guessing).
  const updateNotationForMultiple = (
    targets: Array<{ elementId: string; notation: string }>,
    opts: NotationUpdateOpts
  ) => {
    if (!opts.preservesExistingPicots) return; // see comment above
    if (targets.length === 0) return;
    const picotMatchMode = opts.picotMatchMode || 'stitchesBefore';

    const survivingConnKeys = new Set(
      picotConnectionsRef.current.flatMap(conn => conn.picots.map(cp => `${cp.elementId}::${cp.picotId}`))
    );

    const targetMap = new Map(targets.map(t => [t.elementId, t.notation]));
    const updated = elementsRef.current.map(el => {
      const notation = targetMap.get(el.id);
      if (notation === undefined || el.isGhostMother) return el;
      const next = computeElementAfterNotationEdit(el, notation, null, picotMatchMode, survivingConnKeys);
      return next ? next.element : el;
    });

    setElements(updated);
    pushHistoryState(updated, picotConnectionsRef.current, roundsRef.current);
  };

  // Applies ONE notation to several selected elements at once — the
  // free multi-select notation box (MultiSelectSummaryBar.tsx). Runs every
  // target through the same computeElementAfterNotationEdit a single-element
  // edit uses, so it gets the same handling the old inline copy in that
  // component was missing:
  //   - joins: picots that still match keep their ids (and their joins);
  //     only ones that genuinely disappear lose them — the old copy gave
  //     every picot a fresh id, silently orphaning every join;
  //   - split rings: only side A is replaced, side B kept, with stitchCount
  //     and splitPosition updated correctly (the old copy set stitchCount to
  //     side A alone and never moved splitPosition);
  //   - chains: path re-bent to the new length (the old copy left it as-is);
  //   - ghost mothers: their arrays regenerate.
  // Different from updateNotationForMultiple above, which is only for
  // edits proven not to change picots (Picot Wizard Scale) and skips
  // mothers. Like updateNotation, asks once — for the whole selection —
  // before dropping any joins, then removes exactly those connections and
  // un-marks the picot on the far side of each. One commit, one undo step.
  // notation: the new notation (side A for split rings), or null to keep
  //   each element's own current one — used when only side B is edited.
  // notationB: new side B for split rings, or null to keep each one's own.
  const applyNotationToMultiple = (elementIds: string[], notation: string | null, notationB: string | null = null) => {
    const idSet = new Set(elementIds);
    const targets = elementsRef.current.filter(el => idSet.has(el.id) && el.type !== 'line' && el.type !== 'ghost');
    if (targets.length === 0) return;

    const survivingConnKeys = new Set(
      picotConnectionsRef.current.flatMap(conn => conn.picots.map(cp => `${cp.elementId}::${cp.picotId}`))
    );
    const results = new Map<string, any>();
    const dropped = new Map<string, Set<string>>(); // elementId -> picot ids losing their join
    targets.forEach(el => {
      const computed = computeElementAfterNotationEdit(
        el, notation ?? el.notation, el.isSplitRing ? notationB : null, 'stitchesBefore', survivingConnKeys
      );
      if (!computed) return; // didn't parse for this element — leave it untouched
      results.set(el.id, computed.element);
      if (computed.droppedJoinIds.length > 0) dropped.set(el.id, new Set(computed.droppedJoinIds));
    });
    if (results.size === 0) return;

    const commit = () => {
      const demoteKeys = new Map<string, boolean>();
      if (dropped.size > 0) {
        // Ghosts clone their mother's picot ids verbatim, so a join made on
        // a ghost of an edited mother counts too (same rule as updateNotation).
        const ownerOf = (elId: string): string | null => {
          if (dropped.has(elId)) return elId;
          const g = elementsRef.current.find(e => e.id === elId);
          return g?.type === 'ghost' && dropped.has(g.sourceId) ? g.sourceId : null;
        };
        const isDroppedRef = (cp: any) => {
          const owner = ownerOf(cp.elementId);
          return !!owner && dropped.get(owner)!.has(cp.picotId);
        };
        const connsToRemove = picotConnectionsRef.current.filter(conn => conn.picots.some(isDroppedRef));
        const newConns = picotConnectionsRef.current.filter(conn => !connsToRemove.includes(conn));
        setPicotConnections(newConns);
        picotConnectionsRef.current = newConns;
        connsToRemove.forEach(conn => conn.picots.forEach(cp => {
          if (!isDroppedRef(cp)) demoteKeys.set(`${cp.elementId}::${cp.picotId}`, false);
        }));
      }

      // Demotion runs AFTER the edited elements are swapped in, so it also
      // reaches a far-side picot that belongs to another element in this
      // same selection (whose freshly computed version would otherwise
      // overwrite it).
      let updated = elementsRef.current.map(el => results.get(el.id) ?? el);
      if (demoteKeys.size > 0) updated = applyJointFlags(updated, demoteKeys);

      const motherIds = targets.filter(el => results.get(el.id)?.isGhostMother).map(el => el.id);
      if (motherIds.length > 0) {
        applyGhostRegenResult(regenerateGhostArrays(updated, ghostArrays, motherIds));
      } else {
        setElements(updated);
      }
    };

    if (dropped.size > 0) {
      setConfirmDialog({
        title: t('notationChangeConfirmTitle'),
        message: t('notationChangeConfirmMessage'),
        confirmLabel: t('notationChangeConfirmBtn'),
        onConfirm: commit,
      });
    } else {
      commit();
    }
  };

  // ── Tension stepper (session 57) ───────────────────────────────────────
  // The "Tension" stepper in the property bars (components/TensionStepper.tsx)
  // replaced the step-5 "apply" button. Two functions:
  //
  // tensionInfoForIds — what the stepper shows: the selected rings' tension
  // (elementTension; chains/circles/lines/ghosts don't count), "mixed" when
  // they differ, else the active preset's tension (the user's default).
  //
  // setTensionForIds — what changing it does:
  //   1. the value becomes the default for NEW elements: written to the
  //      active thread preset (state + localStorage, same as Thread
  //      Properties), like the last-picked material becomes the default.
  //      defaultEndAllowanceRef is set right away so an add* in the same
  //      tick already uses it.
  //   2. every eligible selected element is resized to it via
  //      resizeElementForAllowance — allowance × endAllowanceFactor (rings 1,
  //      split rings ¼, chains 0, so a selected chain loses any old
  //      allowance). One plain commit → one undo step through the
  //      auto-history effect; ghost mothers regenerate through the usual
  //      funnel. (The preset change is a setting, not pattern data — it's
  //      not in undo history, same as the material default.)
  const activeThreadPreset = () => threadPresets.find(pr => pr.id === activePresetId) || threadPresets[0];
  const tensionInfoForIds = (ids: string[]): { value: number; mixed: boolean } => {
    const vals = ids.map(id => elementById.get(id))
      .filter(el => el && el.type !== 'ghost' && !el.isGhost)
      .map(el => elementTension(el))
      .filter((v): v is number => v !== null);
    const def = presetTension(activeThreadPreset());
    if (vals.length === 0) return { value: def, mixed: false };
    return vals.every(v => v === vals[0]) ? { value: vals[0], mixed: false } : { value: def, mixed: true };
  };
  const setTensionForIds = (ids: string[], tension: number) => {
    const allowance = tensionToAllowance(tension);
    const preset = activeThreadPreset();
    if (preset) {
      const nextPresets = threadPresets.map(pr => pr.id === preset.id ? { ...pr, endAllowance: allowance } : pr);
      setThreadPresets(nextPresets);
      try { localStorage.setItem('tcad_thread_presets', JSON.stringify(nextPresets)); } catch {}
    }
    defaultEndAllowanceRef.current = allowance;

    const idSet = new Set(ids);
    const patches = new Map<string, any>();
    for (const el of elementsRef.current as any[]) {
      if (!idSet.has(el.id)) continue;
      const patch = resizeElementForAllowance(el, allowance * endAllowanceFactor(el), dsWidth);
      if (patch) patches.set(el.id, patch);
    }
    if (patches.size === 0) return;
    const updated = (elementsRef.current as any[]).map(el =>
      patches.has(el.id) ? { ...el, ...patches.get(el.id) } : el);
    const motherIds = updated.filter(e => patches.has(e.id) && e.isGhostMother).map(e => e.id);
    if (motherIds.length > 0) {
      applyGhostRegenResult(regenerateGhostArrays(updated, ghostArrays, motherIds));
    } else {
      setElements(updated);
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
        // If the element was a Josephine Knot (jk:), toggling back to a
        // teardrop or circle shape means it's no longer a JK — rewrite the
        // notation prefix to r: so the element is treated as a normal ring.
        const notation = el.notation?.replace(/^jk:/i, 'r:') ?? el.notation;
        // Length for the NEW shape: a teardrop gets its end allowance, a
        // circle never does (so the ring grows/shrinks by 2a ds — intended).
        const targetLength = elementPathLength({ ...(el as any), notation, shapeStyle: newStyle }, dsWidth); // cast: elementsRef is typed never[] (see architecture.md)
        const squeeze = el.squeeze || 0;
        const tempPathData = newStyle === 'circle'
          ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
          : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);

        return { ...el, notation, shapeStyle: newStyle, paths: applyRotationToPathData(el, tempPathData).paths };
      }
      return el;
    });

    const motherEl = updated.find(e => e.id === selectedIds[0]);
    if (motherEl?.isGhostMother) {
      applyGhostRegenResult(regenerateGhostArrays(updated, ghostArrays, [selectedIds[0]]));
    } else {
      setElements(updated);
    }
  };

  // Converts the selected ring to a Josephine Knot:
  //   1. Strips all picots and their connections
  //   2. Rewrites notation from "r: Nds..." to "jk: Nss" (same stitch count,
  //      ds → ss, single run, no picots)
  //   3. Forces circle shape and regenerates the path accordingly
  //
  // This is intentionally destructive (all picots and connections on the
  // element are wiped) and is gated behind a confirm dialog.
  const convertToJosephineKnot = () => {
    if (selectedIds.length !== 1) return;
    const el = elementsRef.current.find(e => e.id === selectedIds[0]);
    if (!el || !el.isClosed || el.isSplitRing) return;

    setConfirmDialog({
      title: t('jkConvertTitle'),
      message: t('jkConvertMessage'),
      confirmLabel: t('jkConvertConfirm'),
      onConfirm: () => {
        const currentEl = elementsRef.current.find(e => e.id === selectedIds[0]);
        if (!currentEl) return;

        // Build jk: notation — 2ss per ds (preserves physical path length since
        // ss = 0.5ds). Picots are stripped. Mixed ds/ss/lss/rss all convert:
        //   1ds → 2ss,  1rds → 2ss,  1ss/lss/rss → 1ss
        const rawNotation = currentEl.notation || `r: ${(currentEl.stitchCount || 10) * 2}ss`;
        const totalSS = (() => {
          let count = 0;
          const tokens = rawNotation.replace(/^[a-z]+:\s*/i, '').split(/[-\s,]+/);
          for (const token of tokens) {
            const m = token.match(/^(\d+)?\s*(ds|rds|ss|lss|rss)$/i);
            if (!m) continue;
            const n = parseInt(m[1] || '1');
            const type = m[2].toLowerCase();
            count += (type === 'ds' || type === 'rds') ? n * 2 : n;
          }
          return count || (currentEl.stitchCount || 10) * 2;
        })();
        const newNotation = `jk: ${totalSS}ss`;

        // Parse to get proper stitchCount back (ss counts as 0.5ds each,
        // so stitchCount in the parsed result will be stitchCount * 0.5)
        const parsed = parseNotation(newNotation);
        if (!parsed) return;

        // Regenerate circle path at the new (halved) length
        const targetLength = parsed.stitchCount * dsWidth;
        const squeeze = currentEl.squeeze || 0;
        const circlePaths = createCirclePath(currentEl.center.x, currentEl.center.y, targetLength, squeeze);
        const rotatedPaths = applyRotationToPathData(currentEl, circlePaths).paths;

        const updatedEl = {
          ...currentEl,
          notation: newNotation,
          stitchCount: parsed.stitchCount,
          picots: [],
          shapeStyle: 'circle',
          paths: rotatedPaths,
          endAllowance: 0, // a JK has no bare ends; dropped so toggling back to a teardrop doesn't regrow it
        };

        // Wipe all picot connections that reference this element
        const connsToRemove = picotConnectionsRef.current.filter(
          conn => conn.picots.some(cp => cp.elementId === currentEl.id)
        );
        const newConns = picotConnectionsRef.current.filter(conn => !connsToRemove.includes(conn));
        setPicotConnections(newConns);
        picotConnectionsRef.current = newConns;

        // Demote isJoint on the OTHER side of each wiped connection too —
        // currentEl's own picots are already gone (picots: [] above), but
        // the picot on the far end of a wiped connection — e.g. the other
        // half of a fold — was previously left stranded showing
        // isJoint: true with no connection record behind it (bug fix,
        // session 52 — same fix applied to updateNotation's dropped-join
        // path just above).
        const demoteKeys = new Map<string, boolean>();
        connsToRemove.forEach(conn => {
          conn.picots.forEach(cp => {
            if (cp.elementId !== currentEl.id) demoteKeys.set(`${cp.elementId}::${cp.picotId}`, false);
          });
        });
        if (demoteKeys.size > 0) {
          elementsRef.current = applyJointFlags(elementsRef.current, demoteKeys);
        }

        let finalElements = elementsRef.current.map(e => e.id === currentEl.id ? updatedEl : e);

        // Propagate to ghost array if this is a ghost mother
        if (currentEl.isGhostMother) {
          const result = regenerateGhostArrays(finalElements, ghostArrays, [currentEl.id]);
          finalElements = result.elements;
          applyGhostRegenResult(result);
        } else {
          setElements(finalElements);
        }

        pushHistoryState(finalElements, newConns, roundsRef.current);
      },
    });
  };

  const setLabelOffset = useCallback((value: number) => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length === 0) return;
    setElements(prev => updateSelected(prev, currentSelectedIds, { labelOffset: value }));
  }, []); // No dependencies - uses refs

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAlertDialog({ message: t('refImageErrNotImage') });
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setAlertDialog({ message: t('refImageErrTooLarge') });
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
      setAlertDialog({ message: t('refImageErrRead') });
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
        {positions.map((p, i) => renderBeadShape(p.bx, p.by, p.rad, 'circle', BEAD_FILL[p.size] || '#ef4444', 0, i))}
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
        {positions.map((p, i) => renderBeadShape(p.x, p.y, p.rad, 'circle', BEAD_FILL[p.size] || color, 0, i))}
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
    const armColor = p.isGuidePoint ? theme.gpDiamond : getSolidColor(element, p);
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

    // ── guide point ── pure snap target, no physical thread — draw the
    // same plain dot used for chain-endpoint markers (orange when
    // unconnected, same dotColor/dotR already computed above for joints)
    // so it reads as "just another connectable point," not a distinct
    // shape. Construction aid, not a stitch, so it's suppressed in
    // realistic mode and when editing artifacts are hidden, same as other
    // non-physical markers above.
    if (p.isGuidePoint) {
      if (renderMode === 'realistic') return null;
      if (!showEditingArtifacts) return null;
      // Outside Picot Join mode the orange snap indicator (snap-point pass)
      // now marks a guide point, so this extra dot is no longer drawn there
      // — it was doubling up. Kept in Picot Join mode, where it's the
      // selectable join dot and shows selected/connected state.
      if (activeMode !== 'picotJoin') return null;
      // No offset arm, so it sits exactly on the path centerline — the
      // path's own stroke (drawn after it in DOM order) was painting
      // straight over it. Nudge it outward along perpAngle, same
      // convention every other off-path marker in this file uses, just
      // far enough to clear the path stroke width.
      const gpOffset = 6 / zoom;
      const gx = x + Math.cos(perpAngle) * gpOffset;
      const gy = y + Math.sin(perpAngle) * gpOffset;
      return (
        <g key={key} className="guide-picot">
          <circle cx={gx} cy={gy} r={dotR} fill={dotColor} stroke="#000" strokeWidth={2 / zoom} opacity={0.9} />
        </g>
      );
    }

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

      return element.picots.map(p => {
        const angle = getCircleStitchAngle(element, beadSb(p));
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

      return element.picots.map(p => {
        const sb = beadSb(p);
        const inA = p.stitchesBefore <= splitPos;
        const localFrac = inA
          ? splitRingSideFraction(element, sb, countA)
          : splitRingSideFraction(element, sb - splitPos, countB);
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
        const perpAngle = getPathPerpAngle(element, dx, dy, sideMultiplier);
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

    return element.picots.map(p => {
      const targetDist = elementStitchFraction(element, beadSb(p)) * totalLength;
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
        // This case points ALONG the join axis rather than perpendicular to
        // the local tangent, so it doesn't go through getPathPerpAngle's
        // -π/2 term — only the explicit side offset applies here, same as
        // before. (No winding-direction correction needed: the join axis is
        // defined by two points, not by a traversal direction.)
        const joinX = element.paths[0].x, joinY = element.paths[0].y;
        const axDx = x - joinX, axDy = y - joinY;
        const axLen = Math.sqrt(axDx*axDx + axDy*axDy) || 1;
        const sideOffset = sideMultiplier === -1 ? Math.PI : 0;
        perpAngle = Math.atan2(axDy / axLen, axDx / axLen) + sideOffset;
      } else {
        perpAngle = getPathPerpAngle(element, dx, dy, sideMultiplier);
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
        return runs.map((run, j) => {
          const angleMid = getCircleStitchAngle(element, run.midDS);
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
            const dist = splitRingSideFraction(element, run.midDS, sectionStitchCount) * totalLen;
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
          const targetDist = elementStitchFraction(element, run.midDS) * totalLengthNP;
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
          const angleMid = getCircleStitchAngle(element, run.midDS);
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
            const dist = splitRingSideFraction(element, run.midDS, sectionStitchCount) * totalLen;
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
        const targetDist = elementStitchFraction(element, run.midDS) * totalLength;
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
        [activeMode === 'picotJoin',       () => { setActiveMode(null); setShowJoinTip(false); setSelectedPicots([]); setFoldModeArmed(false); }],
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

  // effectiveElementType moved to geometry/stitchGeometry.ts (imported above).


  // ── Realistic bake cache ─────────────────────────────────────────────────
  // The baked realistic SVG is kept across mode switches and only rebuilt
  // when one of its inputs actually changes. All five inputs are immutable
  // state (replaced, never mutated), so reference equality is an exact
  // "did anything change" test — no deep comparison needed. Selection,
  // pan/zoom, menus etc. don't touch any of them, so they never trigger a
  // re-bake; any real edit (drag, notation, colour, undo…) does.
  //   elements / picotConnections / dsWidth — geometry
  //   materials — read via getElementColor (materialsById)
  //   dmcColors — read via getGradientColorAtPosition (gradient stops)
  // Undo restores deep-cloned snapshots, so undoing back to a previously
  // baked state still re-bakes once (new references) — harmless, just not
  // free.
  const bakedInputsRef = useRef<{ elements: any; picotConnections: any; dsWidth: any; materials: any; dmcColors: any } | null>(null);
  // Set by handleSetRenderMode when switching INTO realistic view, so the
  // bake effect knows to blank a stale image (show the baking spinner)
  // rather than briefly displaying an out-of-date picture. Edits made while
  // already in realistic view (e.g. Ctrl+Z, Delete) keep the old image up
  // until the new one is ready instead, to avoid a flash.
  const enteringRealisticRef = useRef(false);

  // ── handleSetRenderMode: switches mode only — baking is handled by the
  // effect below. It used to bake inline here from its own closure, which
  // could be stale when called from the mount-once keydown listener (V key),
  // and it threw the bake away on every exit so each entry re-baked from
  // scratch.
  const handleSetRenderMode = (next: string) => {
    if (next === 'realistic') {
      setCurrentTool('pan');
      enteringRealisticRef.current = true;
      setRenderMode('realistic');
    } else {
      // Bake is kept (not cleared) so switching back is instant if nothing
      // changed in between.
      setRenderMode('schematic');
      // Realistic view forced Pan; the simple toolbar's home tool is Select.
      // Read from storage, not toolbarMode: the V-key listener can call this
      // from an older render (see the note above).
      if (getInitialToolbarMode() === 'simple') setCurrentTool('select');
    }
  };

  // Bakes (or re-bakes) the realistic view whenever we're in realistic mode
  // and the inputs differ from what the current bake was made from. Also
  // fixes the stale-image bug: shortcuts that edit the pattern while in
  // realistic view (Ctrl+Z, Delete, Ctrl+V…) now trigger a fresh bake.
  useEffect(() => {
    if (renderMode !== 'realistic') return;
    const prev = bakedInputsRef.current;
    const upToDate = !!prev && !!bakedRealisticSVG &&
      prev.elements === elements &&
      prev.picotConnections === picotConnections &&
      prev.dsWidth === dsWidth &&
      prev.materials === materials &&
      prev.dmcColors === dmcColors;
    const entering = enteringRealisticRef.current;
    enteringRealisticRef.current = false;
    if (upToDate) return;
    if (entering) setBakedRealisticSVG(null); // show spinner instead of a stale image
    const inputs = { elements, picotConnections, dsWidth, materials, dmcColors };
    // Deferred one tick so the spinner (on entry) paints before the bake
    // blocks the thread — same reason the old inline bake used setTimeout.
    // Cancelled if inputs change again before it runs (e.g. a held nudge),
    // so only the latest state gets baked.
    const timer = setTimeout(() => {
      const svg = bakeRealisticView({
        elements, dsWidth, picotConnections,
        getElementColor, getGradientColorAtPosition, getStitchTypes,
      });
      bakedInputsRef.current = inputs;
      setBakedRealisticSVG(svg);
    }, 0);
    return () => clearTimeout(timer);
  }, [renderMode, elements, picotConnections, dsWidth, materials, dmcColors]); // eslint-disable-line react-hooks/exhaustive-deps

  // picot is optional — only split-ring picot-arm rendering needs side
  // awareness (materialId vs materialIdB); the two label-color call sites
  // below have no specific picot in scope and are unaffected, since
  // getSplitRingSide returns null with no picot passed.
  const getSolidColor = (element, picot) => {
    const side = getSplitRingSide(element, picot);
    const materialId = (side === 'B' && element.materialIdB) ? element.materialIdB : element.materialId;
    const mat = materialsById.get(materialId || 'default');
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

  // Which half (A/B) of a split ring a picot is on — null for non-split-ring
  // elements or a missing picot. Single source of truth for the inA
  // decision, used by both position (gradient sampling, below) and color
  // (materialId vs materialIdB, below that) — derived from existing data
  // (stitchesBefore vs splitPosition), no new field needed on the picot.
  const getSplitRingSide = (element, picot) => {
    if (!element?.isSplitRing || !picot) return null;
    const splitPos = element.splitPosition || Math.floor(element.stitchCount / 2);
    return picot.stitchesBefore <= splitPos ? 'A' : 'B';
  };

  // Position (0–1) of a picot along its element's stitch sequence — same
  // formula the baked realistic renderer uses for regular picots' gradient
  // sampling (tMid = picot.stitchesBefore / N), including the split-ring
  // adjustment (N is the local half's stitch count, not the whole element's).
  // This is a COLOUR position (stitch progress), not a place on the path —
  // deliberately not routed through elementStitchFraction: the end
  // allowance is bare thread and must not shift where a gradient falls.
  const getPicotPositionFraction = (element, picot) => {
    if (!element || !picot) return 0;
    let localCount = element.stitchCount || 1;
    let localSb = picot.stitchesBefore;
    if (element.isSplitRing) {
      const splitPos = element.splitPosition || Math.floor(element.stitchCount / 2);
      const inA = getSplitRingSide(element, picot) !== 'B';
      localCount = inA ? splitPos : element.stitchCount - splitPos;
      localSb = inA ? picot.stitchesBefore : picot.stitchesBefore - splitPos;
    }
    return localCount > 0 ? localSb / localCount : 0;
  };

  // Connection/fold-line color resolution, gradient-position-aware — the
  // same getElementColor + getGradientColorAtPosition approach regular
  // picots already use in the baked realistic view, instead of
  // getSolidColor's always-first-stop shortcut (session 52: unified fold
  // and regular join-line coloring onto this). materialIdOverride mirrors
  // a connection's frozen materialId, when set. picot may be null (endpoint
  // pseudo-picots aren't real picot objects) — falls back to the gradient's
  // first stop in that case, since there's no stitch position to sample.
  // Split-ring picots on side B now correctly resolve materialIdB instead
  // of always taking the element's side-A material (bug fix, session 52 —
  // same fix as the baked realistic renderer's split-ring picot rendering).
  const getConnectionThreadColor = (element, picot, materialIdOverride?) => {
    if (!element) return null;
    let colorEl;
    if (materialIdOverride) {
      colorEl = { materialId: materialIdOverride };
    } else if (getSplitRingSide(element, picot) === 'B') {
      colorEl = { ...element, materialId: element.materialIdB || element.materialId };
    } else {
      colorEl = element;
    }
    const ec = getElementColor(colorEl);
    if (!ec.isGradient) return ec.color;
    const position = picot ? getPicotPositionFraction(element, picot) : 0;
    return getGradientColorAtPosition(ec.id, position) || ec.color;
  };

  // Dropdown choices for the color-override control in PicotJoinModeBar —
  // one entry per distinct (element, split-ring side) among the active
  // connection's own picots, deduped by resolved materialId. Deliberately
  // NOT an open color/material picker — per design decision, only the
  // materials actually involved in the join are selectable, so "which of
  // these threads' colors should the join use" rather than an arbitrary
  // pick (session 52).
  const connectionColorOptions = useMemo(() => {
    if (!activeConnection) return [];
    const seen = new Map<string, string>(); // materialId -> label
    activeConnection.picots.forEach((cp: any) => {
      const el = elementById.get(cp.elementId);
      if (!el) return;
      const picot = el.picots?.find((pic: any) => pic.id === cp.picotId)
        || getEndpointPseudoPicots(el).find((e: any) => e.id === cp.picotId);
      const side = getSplitRingSide(el, picot);
      const matId = side === 'B' ? (el.materialIdB || el.materialId || 'default') : (el.materialId || 'default');
      if (!seen.has(matId)) {
        const mat = materialsById.get(matId);
        seen.set(matId, matId === 'default' ? t('materialDefaultName') : (mat?.name || matId));
      }
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [activeConnection, elementById, materialsById, t]);

  // Sets (or clears, when materialId is undefined/empty) a connection's
  // color override. Reuses updateFoldConnection — despite the name, its
  // body is connection-type-agnostic (patches by connectionId), so it
  // already works for regular joins too, not just folds.
  const onConnectionColorChange = (connectionId: string, materialId: string | undefined) => {
    updateFoldConnection(connectionId, { materialId });
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

  // Sets a single element's rotation to an ABSOLUTE normalized target
  // (0-360), rather than applying a relative delta the way
  // applySingleRotationDelta (useEditorActions.ts) does. Needed because
  // NumberStepper's onCommit hands back an absolute value, and
  // rotation was never normalized back into [0,360) after repeated nudges
  // (applySingleRotationDelta just adds the delta onto whatever raw value
  // is already there) — the ORIGINAL text-input's blur handler computed
  // `delta = result - selectedElement.rotation` against that un-normalized
  // raw value, which is wrong once rotation has drifted past 360 or below
  // 0 from repeated nudging (a clean target like 95° against a drifted raw
  // rotation of 450° would compute delta=-355° instead of the intended
  // small nudge). Reading el.rotation fresh inside the functional updater
  // (not from a closure) avoids the same class of staleness risk during a
  // rapid hold-to-repeat sequence that applySingleRotationDelta's own
  // functional-updater pattern already avoids.
  const setSingleRotationAbsolute = (elId: string, newRotationNormalized: number, pushHistory: boolean) => {
    setElements(prev => prev.map(el => {
      if (el.id !== elId) return el;
      const currentNormalized = ((el.rotation || 0) % 360 + 360) % 360;
      const delta = newRotationNormalized - currentNormalized;
      if (Math.abs(delta) < 0.0001) return el;
      const polarPivot = getPolarPivot([el.id]);
      const pivot = polarPivot || getElementPivot(el);
      const newPaths = rotatePaths(el.paths, pivot.x, pivot.y, delta);
      const rad = delta * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const newPivot = polarPivot
        ? { x: pivot.x + (el.center.x - pivot.x) * cos - (el.center.y - pivot.y) * sin,
            y: pivot.y + (el.center.x - pivot.x) * sin + (el.center.y - pivot.y) * cos }
        : getElementPivot({ ...el, paths: newPaths });
      return { ...el, paths: newPaths, rotation: newRotationNormalized, center: { x: newPivot.x, y: newPivot.y } };
    }));
    if (pushHistory) pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current);
  };

  // Display name for a thread preset: the built-in default shows in the
  // current language until the user renames it (its stored English name
  // is data, saved in projects/localStorage, so it isn't rewritten).
  const presetDisplayName = (preset: any) =>
    preset?.id === 'default' && preset?.name === DEFAULT_THREAD_PRESET.name
      ? t('threadPresetDefaultName') : (preset?.name ?? '');

  // Rotate ±90°, ±1° nudge, and mirror H/V buttons for the single-element
  // property bar. Shared between the line-only branch and the general
  // (ring/chain/split-ring) branch below — both act on selectedElement.id via
  // the same setElements/rotatePaths/flipElements calls, so there's no reason
  // for the logic to differ by element type; only the surrounding layout
  // (what else appears alongside it) differs per branch.
  const renderRotateFlipControls = () => (
    <>
      <NumberStepper
        value={((selectedElement.rotation || 0) % 360 + 360) % 360}
        min={0} max={360} step={1} wrap
        jump={90}
        jumpMinusContent={<IconRotateCCW size={16} />}
        jumpPlusContent={<IconRotateCW size={16} />}
        jumpMinusTitle={t('propRotateMinus90')}
        jumpPlusTitle={t('propRotatePlus90')}
        stepMinusTitle={t('rotateNudgeMinus')}
        stepPlusTitle={t('rotateNudgePlus')}
        suffix="°"
        holdToRepeat
        onCommit={(newValue, { pushHistory }) => {
          // nudgeActiveRef also gates the separate auto-history-push effect
          // elsewhere in this file (search for its other usage) — without
          // setting it here too, that effect would push a history entry on
          // every intermediate tick regardless of what this component does,
          // defeating the point of batching. Reset only AFTER the final
          // explicit push, matching the original mouseUp handler's exact
          // ordering (set true for the whole hold, false only once the last
          // push has actually happened).
          if (!pushHistory) nudgeActiveRef.current = true;
          setSingleRotationAbsolute(selectedElement.id, newValue, pushHistory);
          if (pushHistory) nudgeActiveRef.current = false;
        }}
      />

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
    </>
  );

  // ── Phone (upright) bottom tool bar — button lists (session 58) ─────────
  // Same actions as the left rail, as plain descriptors for PhoneToolBar.
  // Main row: Select · Pan · Ring · Split ring · Chain · Picot Join (+ More).
  // More panel: the rest of the Simple tools, plus every Full-mode tool when
  // the toolbar is in Full mode. Realistic view: Pan + zoom only, no More.
  // (The rail still has its own JSX; unifying both on these descriptors is a
  // possible later clean-up.)
  const phoneBusyMode = activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder';
  const ptool = (key: string, label: string, title: string, icon: React.ReactNode, onClick: () => void,
    extra: Partial<PhoneTool> = {}): PhoneTool => ({ key, label, title, icon, onClick, ...extra });
  const phoneTools = {
    select: ptool('select', t('toolLabelSelect'), t('toolSelect'), <IconSelect size={20} />, () => setCurrentTool('select'), { active: currentTool === 'select' }),
    pan: ptool('pan', t('toolLabelPan'), t('toolPan'), <IconPan size={20} />, () => setCurrentTool('pan'), { active: currentTool === 'pan' }),
    ring: ptool('ring', t('toolLabelRing'), t('toolAddRing'), <IconAddRing size={20} />, addRing, { disabled: phoneBusyMode }),
    splitRing: ptool('splitRing', t('toolLabelSplitRing'), t('toolAddSplitRing'), <IconAddSplitRing size={20} />, addSplitRing, { disabled: phoneBusyMode }),
    chain: ptool('chain', t('toolLabelChain'), t('toolAddChain'), <IconAddChain size={20} />, addChain, { disabled: phoneBusyMode }),
    join: ptool('join', t('toolLabelJoin'), t('toolPicotJoin'), <IconJoinPicots size={20} />, togglePicotJoinMode, { active: activeMode === 'picotJoin' }),
    del: ptool('delete', t('toolLabelDelete'), t('toolDelete'), <IconDelete size={20} />, deleteSelected, { disabled: phoneBusyMode || selectedIds.length === 0 }),
    fit: ptool('fit', t('toolLabelFitAll'), t('btnFitAll'), <IconFitView size={20} />, fitAllElements),
    zoomOut: ptool('zoomOut', t('toolLabelZoomOut'), t('toolZoomOut'), <IconZoomOut size={20} />, () => zoomToCenter(-ZOOM_STEP_BUTTON_OUT)),
    zoomIn: ptool('zoomIn', t('toolLabelZoomIn'), t('toolZoomIn'), <IconZoomIn size={20} />, () => zoomToCenter(ZOOM_STEP_BUTTON_IN)),
    refImage: ptool('refImage', t('toolLabelRefImage'), t('toolRefImage'), <IconImage size={20} />, () => setCurrentTool(currentTool === 'image' ? 'select' : 'image'), { active: currentTool === 'image' }),
    notes: ptool('notes', t('toolNotes'), notesOpen ? t('notesClose') : t('notesOpen'), <IconNotes size={20} />, () => setNotesOpen(v => !v), { active: notesOpen, activeColor: 'bg-amber-600' }),
    rotate: ptool('rotate', t('toolLabelRotate'), showRotationHandles ? t('toolRotationHandlesHide') : t('toolRotationHandlesShow'), <IconRotateMode size={20} />, () => setShowRotationHandles(!showRotationHandles), { active: showRotationHandles }),
    ortho: ptool('ortho', t('toolLabelOrtho'), t('toolOrthoLock'), <IconOrtho size={20} />, () => setOrthoLock(v => !v), { active: orthoLock, activeColor: 'bg-orange-600' }),
    path: ptool('path', t('toolLabelPathEdit'), t('toolPathEdit'), <IconPathEdit size={20} />, () => setCurrentTool('path'), { active: currentTool === 'path' }),
    ruler: ptool('ruler', t('toolLabelRuler'), t('toolRuler'), <IconRuler size={20} />, () => setCurrentTool('ruler'), { active: currentTool === 'ruler' }),
    beading: ptool('beading', t('toolLabelBeading'), t('toolBeadingMode'), <IconBeadMode size={20} />, toggleBeadingMode, { active: activeMode === 'beading', activeColor: 'bg-purple-600' }),
    line: ptool('line', t('toolLabelLine'), t('toolLineTool'), <IconAddLine size={20} />, () => setCurrentTool('line'), { active: currentTool === 'line', disabled: phoneBusyMode }),
    group: ptool('group', t('toolLabelGroup'), t('toolGroup'), <IconGroup size={20} />, groupSelected, { disabled: selectedIds.length < 2 || phoneBusyMode }),
    ungroup: ptool('ungroup', t('toolLabelUngroup'), t('toolUngroup'), <IconUngroup size={20} />, ungroupSelected, { disabled: selectedIds.length === 0 || phoneBusyMode }),
    zoomRect: ptool('zoomRect', t('toolLabelZoomRect'), t('toolZoomRect'), <IconZoomRect size={20} />, () => setCurrentTool(prev => prev === 'zoomRect' ? 'select' : 'zoomRect'), { active: currentTool === 'zoomRect', activeColor: 'bg-yellow-600' }),
    toFull: ptool('toFull', t('toolbarMoreTools'), t('toolbarMoreToolsTip'), <span className="text-lg leading-none">⋯</span>, () => setToolbarMode('full')),
    toSimple: ptool('toSimple', t('toolbarSimple'), t('toolbarSimpleTip'), <span className="text-lg leading-none">‹</span>, () => setToolbarMode('simple')),
  };
  const P = phoneTools;
  const phoneMainTools: PhoneTool[] = renderMode === 'realistic'
    ? [{ ...P.pan, active: true }, P.zoomOut, P.zoomIn, P.fit]
    : [P.select, P.pan, P.ring, P.splitRing, P.chain, P.join];
  const phoneMoreTools: PhoneTool[] = renderMode === 'realistic' ? []
    : toolbarMode === 'simple'
      ? [P.del, P.fit, P.zoomOut, P.zoomIn, P.refImage, P.notes, P.toFull]
      : [P.del, P.fit, P.zoomOut, P.zoomIn, P.refImage, P.notes,
         P.rotate, P.ortho, P.path, P.ruler, P.line, P.beading, P.group, P.ungroup, P.zoomRect, P.toSimple];

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
          /* Real reflow for Row 1 buttons, not transform: scale() — same fix
             as Row 1's ui-large case, applied to the shrink direction too.
             transform doesn't shrink the layout box, only the paint, so the
             flex gap was being measured against the original 44px box even
             though buttons looked smaller — that's the "gap looks too big"
             symptom. Icon size is also forced uniform here: the source icons
             are 18px/20px/14px depending on which one (see TopMenuBar.tsx),
             which is barely noticeable at full size but stands out once
             everything else shrinks. */
          .top-row-buttons {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            gap: 0.2rem !important;
          }
          .top-row-buttons button {
            height: 38px !important;
            min-width: 38px !important;
            padding: 0 0.35rem !important;
          }
          .top-row-buttons svg {
            width: 18px !important;
            height: 18px !important;
          }
          .top-row-buttons .flex-1 {
            gap: 0.15rem !important;
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
          
          .mobile-gap-small {
            gap: 0.25rem !important;
          }
          /* Hide text labels on mobile to save space */
          .hide-label-mobile {
            display: none !important;
          }
        }

        /* ── Row 2 (property bar) responsive shrink ──────────────────────
           Real reflow, not transform: scale() — font-size/padding/height
           shrink applied to generic element types (input, select, button,
           svg, label/.text-xs) rather than a hand-maintained allowlist of
           width classes, so anything added to the bar later (e.g. the group
           name/color row) is covered automatically. No overflow clamp: the
           bar wraps to more rows under space pressure instead of shrinking
           uniformly or scrolling — matches how the bottom status bar
           already behaves correctly.
        ── */
        @media (max-width: 600px) {
          .top-row-properties {
            flex-wrap: wrap !important;
            overflow: visible !important;
            justify-content: flex-start !important;
            padding: 0.25rem 0.5rem !important;
            row-gap: 0.2rem !important;
          }

          .top-row-properties > div,
          .top-row-properties .flex {
            flex-shrink: 0 !important;
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

          /* Generic element targeting instead of a class allowlist */
          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"],
          .top-row-properties select {
            padding: 0.2rem 0.3rem !important;
            font-size: 0.7rem !important;
            height: 1.6rem !important;
            min-width: 0 !important;
            max-width: 6rem !important;
            flex-shrink: 1 !important;
          }

          .top-row-properties input.notation-input {
            width: 105px !important; /* 70px * 1.5 = 105px */
            max-width: 105px !important;
          }

          .top-row-properties input[type="number"] {
            width: 44px !important;
          }

          .top-row-properties input[type="range"] {
            width: 40px !important;
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

          .top-row-properties .text-xs,
          .top-row-properties label {
            font-size: 0.65rem !important;
          }

          .top-row-properties label.text-xs {
            display: none !important;
          }

          .top-row-properties svg {
            width: 14px !important;
            height: 14px !important;
          }
        }

        /* Even more aggressive for very narrow screens */
        @media (max-width: 420px) {
          .top-row-buttons {
            gap: 0.15rem !important;
          }
          .top-row-buttons button {
            height: 34px !important;
            min-width: 34px !important;
            padding: 0 0.25rem !important;
          }
          .top-row-buttons svg {
            width: 16px !important;
            height: 16px !important;
          }
          .top-row-buttons .flex-1 {
            gap: 0.1rem !important;
          }

          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"],
          .top-row-properties select {
            font-size: 0.65rem !important;
            max-width: 5rem !important;
          }
          .top-row-properties button {
            font-size: 0.65rem !important;
            padding: 0 0.25rem !important;
          }
        }

        @media (max-width: 340px) {
          .top-row-buttons {
            gap: 0.1rem !important;
          }
          .top-row-buttons button {
            height: 30px !important;
            min-width: 30px !important;
            padding: 0 0.2rem !important;
          }
          .top-row-buttons svg {
            width: 14px !important;
            height: 14px !important;
          }
        }
        
        /* Scale down the left toolbar + Row 1 when not enough vertical space
           (unchanged, out of scope). Row 2 gets real reflow instead of
           transform: scale() here too — see comment above. */
        @media (max-height: 500px) {
          .top-row-buttons {
            gap: 0.2rem !important;
          }
          .top-row-buttons button {
            height: 38px !important;
            min-width: 38px !important;
            padding: 0 0.35rem !important;
          }
          .top-row-buttons svg {
            width: 18px !important;
            height: 18px !important;
          }
          .top-row-buttons .flex-1 {
            gap: 0.15rem !important;
          }
          

          .top-row-properties button,
          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"],
          .top-row-properties select {
            font-size: 0.7rem !important;
            height: 1.6rem !important;
            padding: 0.15rem 0.3rem !important;
          }
          .top-row-properties svg {
            width: 13px !important;
            height: 13px !important;
          }
          /* Hide text labels when scaled */
          .hide-label-scaled {
            display: none !important;
          }
        }
        @media (max-height: 420px) {
          .top-row-buttons {
            gap: 0.15rem !important;
          }
          .top-row-buttons button {
            height: 34px !important;
            min-width: 34px !important;
            padding: 0 0.25rem !important;
          }
          .top-row-buttons svg {
            width: 16px !important;
            height: 16px !important;
          }
          .top-row-buttons .flex-1 {
            gap: 0.1rem !important;
          }
          

          .top-row-properties button,
          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"],
          .top-row-properties select {
            font-size: 0.65rem !important;
            height: 1.4rem !important;
            padding: 0.1rem 0.25rem !important;
          }
          .top-row-properties svg {
            width: 12px !important;
            height: 12px !important;
          }
          .hide-label-scaled {
            display: none !important;
          }
        }
        @media (max-height: 360px) {
          .top-row-buttons {
            gap: 0.1rem !important;
          }
          .top-row-buttons button {
            height: 30px !important;
            min-width: 30px !important;
            padding: 0 0.2rem !important;
          }
          .top-row-buttons svg {
            width: 14px !important;
            height: 14px !important;
          }
          

          .top-row-properties button,
          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"],
          .top-row-properties select {
            font-size: 0.6rem !important;
            height: 1.3rem !important;
            padding: 0.05rem 0.2rem !important;
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
           Boosts the left floating toolbar by 1.25× via transform (out of
           scope for this pass, unchanged). Row 2 (.top-toolbar-scalable)
           used to ALSO get a transform: scale(1.25) stacked on top of the
           root font-size boost below — that second, non-reflowing scale
           is what caused controls to overlap (e.g. the Squeeze "Reset"
           button colliding with the "Material:" label in
           ShapeAndSqueezeControls). Removed for Row 2: the root font-size
           boost is rem-based, so Tailwind's text-xs/sm/base etc. already
           grow in a way the layout engine reserves space for — no separate
           transform is needed there. Net effect: Row 2 under ui-large is
           now smaller than before (loses the extra 1.25× on top of the
           ~1.1× font boost) but no longer overlaps. If Row 2 should look
           bigger under ui-large, that's a follow-up sizing decision, not
           a bug fix — flagging rather than deciding it here.
        ── */
        .ui-large { font-size: 17.6px; } /* 16px default → ~1.1×; rem-based Tailwind classes (text-xs/sm/base…) scale with this */
        /* Row 1 real growth under ui-large — box-model sizing (not transform),
           same fix as Row 2. Row 1's button dimensions are set as fixed px
           via inline style in TopMenuBar.tsx (squareBtn/wideBtn = 44px), so
           they don't participate in the root font-size cascade at all; the
           old transform: scale(1.25) grew them visually without reserving
           space, causing the same overlap as Row 2 had. min-width (not
           width) is used so wideBtn's auto-width File/View/Arrange/Options
           buttons aren't forced square — min-width only raises the floor,
           it doesn't override a larger natural width. !important is needed
           to beat the inline px styles. */
        .ui-large .top-row-buttons button {
          height: 56px !important;
          min-width: 56px !important;
          padding: 0 0.6rem !important;
          font-size: 0.95rem !important;
        }
        .ui-large .top-row-buttons svg {
          width: 22px !important;
          height: 22px !important;
        }

        /* Row 2 real growth under ui-large — box-model sizing (not transform),
           so it actually reserves the extra space and fills the bar instead
           of sitting small with room to spare. No !important: the width/
           height shrink media queries above use !important and still win
           on narrow/short viewports, so this recedes gracefully there. */
        .ui-large .top-row-properties button {
          height: 2.5rem;
          padding: 0 0.75rem;
          font-size: 0.95rem;
        }
        .ui-large .top-row-properties input[type="text"],
        .ui-large .top-row-properties input[type="number"] {
          height: 2.5rem;
          font-size: 0.95rem;
          padding: 0 0.6rem;
        }
        .ui-large .top-row-properties select {
          height: 2.5rem;
          font-size: 0.95rem;
          padding: 0 0.6rem;
        }
        .ui-large .top-row-properties input[type="range"] {
          height: 2.5rem;
        }
        .ui-large .top-row-properties svg {
          width: 20px;
          height: 20px;
        }
        .ui-large .top-row-properties .text-xs,
        .ui-large .top-row-properties label {
          font-size: 0.85rem;
        }
        .ui-large .top-row-properties {
          gap: 0.75rem;
        }

        /* ── Tool rail (session 58) ───────────────────────────────────────
           The left toolbar is a fixed, full-height strip OUTSIDE the canvas
           (logo on top, tools below, scrolling only if the screen is too
           short). Everything else is pushed right by --rail-w via
           .app-root's padding. Width per toolbar mode (rail-simple /
           rail-full) and screen shape; the rail itself is never scaled with
           transform any more (that is what made it overflow before). */
        .app-root { --rail-w: calc(100px + env(safe-area-inset-left, 0px)); padding-left: var(--rail-w); }
        .app-root.rail-simple { --rail-w: calc(150px + env(safe-area-inset-left, 0px)); }
        .tool-rail {
          position: fixed; top: 0; bottom: 0; left: 0; z-index: 30;
          width: var(--rail-w);
          display: flex; flex-direction: column;
          background: #1f2937; border-right: 1px solid #374151;
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
        }
        .tool-rail-logo { display: flex; justify-content: center; padding: 10px 0 6px; flex-shrink: 0; }
        .tool-rail-logo img { width: 48px; height: 48px; object-fit: contain; }
        .tool-rail-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0.5rem; scrollbar-width: thin; }

        /* ── Phone toolbar (bottom bar) — hidden except on upright phones ── */
        .phone-toolbar { display: none; }
        .phone-toolbar-row {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
          display: flex; align-items: stretch; gap: 2px;
          height: calc(58px + env(safe-area-inset-bottom, 0px));
          padding: 3px 4px env(safe-area-inset-bottom, 0px);
          background: #1f2937; border-top: 1px solid #374151;
        }
        .phone-toolbar-btn { flex: 1 1 0; min-width: 0; gap: 3px; padding: 4px 0; }
        .phone-toolbar-label { font-size: 10px; font-weight: 600; line-height: 1.1; text-align: center;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; padding: 0 1px; }
        .phone-toolbar-backdrop { position: fixed; inset: 0; z-index: 29; background: rgba(0,0,0,0.35); }
        .phone-toolbar-more {
          position: fixed; left: 6px; right: 6px; z-index: 31;
          bottom: calc(64px + env(safe-area-inset-bottom, 0px));
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
          padding: 8px; border-radius: 12px;
          background: #1f2937; border: 1px solid #4b5563; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          max-height: 60vh; overflow-y: auto;
        }
        .phone-toolbar-tile { gap: 4px; padding: 10px 2px; min-height: 60px; }
        .phone-toolbar-tile .phone-toolbar-label { white-space: normal; }

        /* Phone held upright: the bottom bar replaces the rail; the app is
           padded at the bottom instead of the left. */
        @media (max-width: 768px) and (min-height: 501px) {
          .app-root, .app-root.rail-simple { --rail-w: 0px; padding-bottom: calc(58px + env(safe-area-inset-bottom, 0px)); }
          .tool-rail { display: none; }
          .phone-toolbar { display: block; }
          /* Fixed-height property bar so selecting / deselecting doesn't make
             the canvas jump; longer contents scroll inside it. */
          .app-root .prop-bar { height: 6.5rem; min-height: 6.5rem !important; overflow-y: auto !important; }
        }
        /* Phones (either way round): no status bar — it overlaps the canvas
           and the bottom bar, and isn't needed on a small screen. */
        @media (max-width: 768px), (max-height: 500px) {
          .app-root .info-bar { display: none; }
        }
        /* Phone on its side (short screen): compact rail, labels beside icons. */
        @media (max-height: 500px) {
          .app-root { --rail-w: calc(84px + env(safe-area-inset-left, 0px)); }
          .app-root.rail-simple { --rail-w: calc(124px + env(safe-area-inset-left, 0px)); }
          .tool-rail-logo { padding: 4px 0 2px; }
          .tool-rail-logo img { width: 30px; height: 30px; }
          .tool-rail-body { padding: 0.25rem; }
          .tool-rail-body button { padding: 0.3rem !important; }
          .rail-simple .tb-labelled { font-size: 11px !important; gap: 0.4rem !important; }
          .rail-simple .tb-more { padding: 0.2rem 0.3rem !important; }
          /* Top row on one line (icons only, scrolls sideways if needed) and
             a short, fixed-height property bar — together they took half
             the height before. */
          .top-row-buttons { flex-wrap: nowrap !important; overflow-x: auto !important; gap: 0.2rem !important; }
          .top-row-buttons .w-px, .top-row-buttons .ml-auto { display: none !important; }
          .hide-label-mobile { display: none !important; }
          .app-root .prop-bar { height: 4.5rem; min-height: 4.5rem !important; overflow-y: auto !important; padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
        }
        /* Large UI (Options → size): a wider rail with everything 1.25× —
           desktop-sized screens only, as before. */
        @media (min-width: 769px) and (min-height: 501px) {
          .ui-large.app-root { --rail-w: calc(125px + env(safe-area-inset-left, 0px)); }
          .ui-large.app-root.rail-simple { --rail-w: calc(188px + env(safe-area-inset-left, 0px)); }
          .ui-large .tool-rail-body > .rail-grid { zoom: 1.25; }
          .ui-large .tool-rail-body { padding: 0.4rem; }
        }
        @keyframes tattingBakeSpin { to { transform: rotate(360deg); } }
      `}</style>
      <div className={`app-root ${toolbarMode === 'simple' ? 'rail-simple' : 'rail-full'} w-full h-screen flex flex-col select-none${uiScale === 'large' ? ' ui-large' : ''}`} style={{ backgroundColor: bgColor }}>
      {/* Two-row header — paddingTop pushes content below the Android status bar on edge-to-edge WebViews */}
      <div className="bg-gray-800 text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Row 1: Main Commands */}
        <TopMenuBar
          fileButtonRef={fileButtonRef}
          viewButtonRef={viewButtonRef}
          arrangeButtonRef={arrangeButtonRef}
          optionsButtonRef={optionsButtonRef}
          helpButtonRef={helpButtonRef}
          showFileMenu={showFileMenu}
          showViewMenu={showViewMenu}
          onToggleFileMenu={() => setShowFileMenu(!showFileMenu)}
          onToggleViewMenu={() => setShowViewMenu(!showViewMenu)}
          onToggleArrangeMenu={() => setShowArrangeMenu(!showArrangeMenu)}
          onToggleOptionsMenu={() => setShowOptionsMenu(!showOptionsMenu)}
          onToggleHelpMenu={() => setShowHelpMenu(v => !v)}
          undo={undo}
          redo={redo}
          historyIndex={historyIndex}
          historyLength={history.length}
          activeMode={activeMode}
          onCopy={() => { if (activeMode === 'beading') copyBEToClipboard(); else copySelected(); }}
          onCut={() => { if (activeMode === 'beading') cutBEToClipboard(); else cutSelected(); }}
          onPaste={() => { if (activeMode === 'beading') pasteBeClipboard(); else pasteFromClipboard().catch(() => {}); }}
          copyCutDisabled={activeMode === 'picotJoin' || (activeMode === 'beading' ? selectedBEs.length === 0 : selectedIds.length === 0)}
          pasteDisabled={activeMode === 'picotJoin' || (activeMode === 'beading' ? !beClipboard || selectedBEs.length === 0 : clipboard.length === 0)}
          sendToBack={sendToBack}
          bringToFront={bringToFront}
          arrangeDisabled={selectedIds.length === 0 || activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}
          fitAllElements={fitAllElements}
          fitAllDisabled={elements.length === 0}
          onDelete={deleteSelected}
          deleteDisabled={renderMode === 'realistic' || activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}
          t={t}
        />
        
        {/* Row 2: Properties (always visible) */}
        <div className="top-row-properties prop-bar flex flex-wrap items-center content-start px-4 mobile-no-padding gap-0.5 md:gap-3 bg-gray-750 py-1 md:py-2 justify-start" style={{
          minHeight: '6.5rem',
        }}>
          {renderMode === 'realistic' ? (
            /* ── Realistic mode property bar ─────────────────────────────── */
            <RealisticModeBar onSwitchToSchematic={() => handleSetRenderMode('schematic')} t={t} />
          ) : activeMode === 'picotJoin' ? (
            /* ── Picot Edit mode property bar ───────────────────────────── */
            <PicotJoinModeBar
              onExit={() => { setActiveMode(null); setShowJoinTip(false); setSelectedPicots([]); setFoldModeArmed(false); }}
              onJoin={picotJoinAction}
              onBreak={breakSelectedPicots}
              joinDisabled={picotJoinDisabled}
              breakDisabled={selectedPicots.length === 0}
              foldModeArmed={foldModeArmed}
              onToggleFoldMode={() => setFoldModeArmed(v => !v)}
              activeFold={activeFoldConnection}
              onFoldPropertyChange={(id, patch) => updateFoldConnection(id, patch)}
              activeConnection={activeConnection}
              connectionColorOptions={connectionColorOptions}
              onConnectionColorChange={onConnectionColorChange}
              t={t}
            />
          ) : activeMode === 'beading' ? (
            <BeadingModeBar
              selectedBEs={selectedBEs}
              elementById={elementById}
              setElements={setElements}
              beadLibrary={beadLibrary}
              beClipboard={beClipboard}
              copyBEToClipboard={copyBEToClipboard}
              cutBEToClipboard={cutBEToClipboard}
              pasteBeClipboard={pasteBeClipboard}
              onExit={() => { setActiveMode(null); setSelectedBEs([]); }}
              onOpenBeadLibrary={() => setShowBeadLibrary(true)}
              t={t}
            />
          ) : activeMode === 'tattingOrder' ? (
            <TattingOrderModeBar
              elements={elements}
              selectedElement={selectedElement}
              rounds={rounds}
              roundsRef={roundsRef}
              activeRoundId={activeRoundId}
              setActiveRoundId={setActiveRoundId}
              groupDropdownButtonRef={groupDropdownButtonRef}
              showGroupDropdown={showGroupDropdown}
              setShowGroupDropdown={setShowGroupDropdown}
              showNewGroupInput={showNewGroupInput}
              setShowNewGroupInput={setShowNewGroupInput}
              newGroupNameInput={newGroupNameInput}
              setNewGroupNameInput={setNewGroupNameInput}
              renamingGroupId={renamingGroupId}
              setRenamingGroupId={setRenamingGroupId}
              renameGroupInput={renameGroupInput}
              setRenameGroupInput={setRenameGroupInput}
              setRounds={setRounds}
              pushHistoryState={pushHistoryState}
              elementsRef={elementsRef}
              picotConnectionsRef={picotConnectionsRef}
              setConfirmDialog={setConfirmDialog}
              setActiveMode={setActiveMode}
              setSelectedIds={setSelectedIds}
              showLoadMsg={showLoadMsg}
              tattingOrderInput={tattingOrderInput}
              setTattingOrderInput={setTattingOrderInput}
              assignOrderNumber={assignOrderNumber}
              getNextAvailableNumber={getNextAvailableNumber}
              setElements={setElements}
              assignRepeat={assignRepeat}
              clearOrderAssignment={clearOrderAssignment}
              inActiveRound={inActiveRound}
              t={t}
            />
          ) : selectedElement ? (
            <SingleSelectPropertyBar
              selectedElement={selectedElement}
              tensionInfoForIds={tensionInfoForIds}
              setTensionForIds={setTensionForIds}
              selectedIds={selectedIds}
              selectedIdSet={selectedIdSet}
              elements={elements}
              elementsRef={elementsRef}
              elementById={elementById}
              rounds={rounds}
              roundsRef={roundsRef}
              polarGrids={polarGrids}
              dsWidth={dsWidth}
              materials={materials}
              beadLibrary={beadLibrary}
              lineBeadClipboard={lineBeadClipboard}
              draftNotation={draftNotation}
              notationError={notationError}
              propBarOrderDraft={propBarOrderDraft}
              showPropBarGroupDropdown={showPropBarGroupDropdown}
              propBarGroupButtonRef={propBarGroupButtonRef}
              showPicotWizard={showPicotWizard}
              picotWizardFillGap={picotWizardFillGap}
              picotWizardScalePct={picotWizardScalePct}
              picotWizardSide={picotWizardSide}
              picotWizardSymmetric={picotWizardSymmetric}
              isInteractingRef={isInteractingRef}
              skipAutoHistoryRef={skipAutoHistoryRef}
              notationEscapeRef={notationEscapeRef}
              pendingNotationRef={pendingNotationRef}
              picotConnectionsRef={picotConnectionsRef}
              renderRotateFlipControls={renderRotateFlipControls}
              getRoundId={getRoundId}
              getGradientColorAtPosition={getGradientColorAtPosition}
              parseNotation={parseNotation}
              updateNotation={updateNotation}
              convertToJosephineKnot={convertToJosephineKnot}
              toggleShape={toggleShape}
              setLabelOffset={setLabelOffset}
              commitOrderDraft={commitOrderDraft}
              pushHistoryState={pushHistoryState}
              setAlertDialog={setAlertDialog}
              setDraftNotation={setDraftNotation}
              setNotationError={setNotationError}
              setElements={setElements}
              setRounds={setRounds}
              setPivotOffset={setPivotOffset}
              setPropBarOrderDraft={setPropBarOrderDraft}
              setShowPropBarGroupDropdown={setShowPropBarGroupDropdown}
              setShowMaterialsPanel={setShowMaterialsPanel}
              setShowPicotWizard={setShowPicotWizard}
              setPicotWizardFillGap={setPicotWizardFillGap}
              setPicotWizardScalePct={setPicotWizardScalePct}
              setPicotWizardSide={setPicotWizardSide}
              setPicotWizardSymmetric={setPicotWizardSymmetric}
              setLineBeadClipboard={setLineBeadClipboard}
              updateElement={updateElement}
              updateWhere={updateWhere}
              t={t}
            />
          ) : (
            <>
              <MultiSelectSummaryBar
                selectedIds={selectedIds}
                tensionInfoForIds={tensionInfoForIds}
                setTensionForIds={setTensionForIds}
                elementById={elementById}
                elements={elements}
                selectedIdSet={selectedIdSet}
                dsWidth={dsWidth}
                getPolarPivot={getPolarPivot}
                setElements={setElements}
                groupRotationInput={groupRotationInput}
                setGroupRotationInput={setGroupRotationInput}
                applyGroupRotation={applyGroupRotation}
                parseRotationExpr={parseRotationExpr}
                flipElements={flipElements}
                getPolarFlipGrid={getPolarFlipGrid}
                setLabelOffset={setLabelOffset}
                updateSelected={updateSelected}
                updateWhere={updateWhere}
                polarGrids={polarGrids}
                lineBeadClipboard={lineBeadClipboard}
                beadLibrary={beadLibrary}
                setLineBeadClipboard={setLineBeadClipboard}
                notationEscapeRef={notationEscapeRef}
                parseNotation={parseNotation}
                applyNotationToMultiple={applyNotationToMultiple}
                applyMultiSelectRotationDelta={applyMultiSelectRotationDelta}
                materials={materials}
                setShowMaterialsPanel={setShowMaterialsPanel}
                multiScalePct={multiScalePct}
                setMultiScalePct={setMultiScalePct}
                showMultiScaleWizard={showMultiScaleWizard}
                setShowMultiScaleWizard={setShowMultiScaleWizard}
                analyzeNotationForWizard={analyzeNotationForWizard}
                totalRunDs={totalRunDs}
                suggestScalePresetsMulti={suggestScalePresetsMulti}
                scaleNotation={scaleNotation}
                autoCompact={autoCompact}
                updateNotationForMultiple={updateNotationForMultiple}
                groups={groups}
                setGroups={setGroups}
                picotConnections={picotConnections}
                rounds={rounds}
                pushHistoryState={pushHistoryState}
                t={t}
              />
            
            {/* Empty-state: "what next" hint for newcomers (session 58), with
                the real tool buttons inline. Falls back to the old placeholder
                text once the pattern has joins. See GettingStartedHint.tsx. */}
            {!selectedElement && selectedIds.length === 0 && currentTool !== 'image' && (
              <GettingStartedHint
                elementCount={elements.reduce((n, e) => e.type === 'ghost' ? n : n + 1, 0)}
                hasConnections={picotConnections.length > 0}
                onAddRing={addRing}
                onAddSplitRing={addSplitRing}
                onAddChain={addChain}
                onRefImage={() => setCurrentTool('image')}
                onSelectTool={() => setCurrentTool('select')}
                onPicotJoin={togglePicotJoinMode}
                t={t}
              />
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
                      const targetLength = elementPathLength(el, dsWidth);
                      const newPath = applyPathPreset(path, preset.deg, targetLength, true); // presets always symmetric
                      if (newPath !== path) {
                        commitSinglePathUpdate(el.id, newPath);
                      }
                    }}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 border border-gray-600 hover:border-blue-500 transition-colors"
                    title={t('pathPresetApplyTitle').replace('{angle}', preset.label).replace('{key}', preset.key)}
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
                  title={chainPresetSymmetric ? t('pathPresetSymmetricOn') : t('pathPresetSymmetricOff')}
                >
                  ⇔
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Line Preset Panel — floating overlay, line tool + line selected ──
             Temporarily hidden: applyLinePreset's semantics (rotate the whole
             line to an absolute angle, forcing it straight) don't match how
             the path-edit tool now treats lines (free bezier bow, no preset
             angle concept). Revisit once we decide what a line preset should
             mean. ── */}
        {false && currentTool === 'line' && selectedIds.length === 1 && (() => {
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
                        commitSinglePathUpdate(el.id, newPath);
                      }
                    }}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 border border-gray-600 hover:border-blue-500 transition-colors"
                    title={t('pathPresetApplyTitle').replace('{angle}', preset.label).replace('{key}', preset.key)}
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
        {/* Left tool rail (session 58): fixed full-height strip outside the
            canvas, logo on top — see .tool-rail CSS. Two layouts in schematic view —
            'simple' (default for new installs): one column, bigger, labelled,
            only the everyday tools, with "More tools" to switch; 'full': the
            original 2-column grid of every tool, with "Simple" to switch back.
            Saved in localStorage (tcad_toolbar_mode, see useViewState.ts).
            Hidden tools keep their keyboard shortcuts. Realistic view keeps
            its own pan/zoom set in the original grid. */}
        {(() => { const simpleToolbar = toolbarMode === 'simple' && renderMode !== 'realistic'; return (
        <aside className="tool-rail text-white" style={{ touchAction: 'none' }}>
        <div className="tool-rail-logo">
          {/* public/app-icon_sm.png (~200 px square). Hidden if missing. */}
          <img
            src="/app-icon_sm.png"
            alt="TattingCAD"
            title={`TattingCAD ${APP_VERSION}`}
            draggable={false}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div className="tool-rail-body">
        <div className={`rail-grid grid ${simpleToolbar ? 'grid-cols-1' : 'grid-cols-2'} gap-1`}>
          {renderMode === 'realistic' && (
            <>
              {/* Realistic mode: Pan only — editing disabled. Zoom/Fit are
                  safe to keep active here: they only touch camera/zoom
                  state and don't change currentTool away from 'pan'. Zoom
                  Rect was tried here too but pulled — it does change
                  currentTool away from 'pan', which conflicts with the
                  mode's pan-only design even though pointer-events: none
                  on the elements group kept it from being able to select/
                  edit anything. */}
              <button onClick={() => setCurrentTool('pan')} className="p-2 rounded col-span-2 pointer-events-auto bg-blue-600" style={{ touchAction: 'manipulation' }} title={t('toolPanRealistic')}>
                <IconPan size={20} />
              </button>
              <button onClick={() => zoomToCenter(-ZOOM_STEP_BUTTON_OUT)} className="p-2 rounded pointer-events-auto bg-gray-700 hover:bg-gray-600" style={{ touchAction: 'manipulation' }} title={t('toolZoomOut')}>
                <IconZoomOut size={20} />
              </button>
              <button onClick={() => zoomToCenter(ZOOM_STEP_BUTTON_IN)} className="p-2 rounded pointer-events-auto bg-gray-700 hover:bg-gray-600" style={{ touchAction: 'manipulation' }} title={t('toolZoomIn')}>
                <IconZoomIn size={20} />
              </button>
              <button onClick={fitAllElements} className="p-2 rounded col-span-2 pointer-events-auto bg-gray-700 hover:bg-gray-600" style={{ touchAction: 'manipulation' }} title={t('btnFitAll')}>
                <IconFitView size={20} />
              </button>
              <div className="col-span-2 text-center text-gray-400 text-xs leading-tight px-1 py-0.5">
                {t('toolPanRealisticSub')}<br/>{t('toolPanRealisticSub2')}
              </div>
            </>
          )}
          {simpleToolbar && <>
          {/* ── Simple toolbar (one labelled column) ── */}
          <ToolbarButton onClick={() => setCurrentTool('select')} active={currentTool === 'select'} title={t('toolSelect')} label={t('toolLabelSelect')}>
            <IconSelect size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={() => setCurrentTool('pan')} active={currentTool === 'pan'} title={t('toolPan')} label={t('toolLabelPan')}>
            <IconPan size={20} />
          </ToolbarButton>
          <div className="h-px bg-gray-700 my-0.5" />
          <ToolbarButton onClick={addRing} title={t('toolAddRing')} label={t('toolLabelRing')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddRing size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={addSplitRing} title={t('toolAddSplitRing')} label={t('toolLabelSplitRing')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddSplitRing size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={addChain} title={t('toolAddChain')} label={t('toolLabelChain')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddChain size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={togglePicotJoinMode} active={activeMode === 'picotJoin'} title={t('toolPicotJoin')} label={t('toolLabelJoin')}>
            <IconJoinPicots size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={deleteSelected} title={t('toolDelete')} label={t('toolLabelDelete')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconDelete size={20} />
          </ToolbarButton>
          <div className="h-px bg-gray-700 my-0.5" />
          <div className="tb-zoom grid grid-cols-2 gap-1">
            <ToolbarButton onClick={() => zoomToCenter(-ZOOM_STEP_BUTTON_OUT)} title={t('toolZoomOut')} flexCenter>
              <IconZoomOut size={20} />
            </ToolbarButton>
            <ToolbarButton onClick={() => zoomToCenter(ZOOM_STEP_BUTTON_IN)} title={t('toolZoomIn')} flexCenter>
              <IconZoomIn size={20} />
            </ToolbarButton>
          </div>
          <ToolbarButton onClick={fitAllElements} title={t('btnFitAll')} label={t('toolLabelFitAll')}>
            <IconFitView size={20} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setCurrentTool(currentTool === 'image' ? 'select' : 'image')}
            active={currentTool === 'image'}
            title={t('toolRefImage')}
            label={t('toolLabelRefImage')}
          >
            <IconImage size={20} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setNotesOpen(v => !v)}
            active={notesOpen}
            activeColor="bg-amber-600"
            title={notesOpen ? t('notesClose') : t('notesOpen')}
            label={t('toolNotes')}
          >
            <IconNotes size={20} />
          </ToolbarButton>
          <div className="h-px bg-gray-700 my-0.5" />
          <button
            onClick={() => setToolbarMode('full')}
            title={t('toolbarMoreToolsTip')}
            className="tb-more pointer-events-auto rounded px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 text-left"
            style={{ touchAction: 'manipulation' }}
          >{t('toolbarMoreTools')} ›</button>
          </>}
          {renderMode !== 'realistic' && !simpleToolbar && <>
          {/* Row 1: Pan and Select */}
          <ToolbarButton onClick={() => setCurrentTool('pan')} active={currentTool === 'pan'} title={t('toolPan')}>
            <IconPan size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={() => setCurrentTool('select')} active={currentTool === 'select'} title={t('toolSelect')}>
            <IconSelect size={20} />
          </ToolbarButton>
          
          {/* Row 2: Rotation Handles and Ortho Lock */}
          <ToolbarButton
            onClick={() => setShowRotationHandles(!showRotationHandles)}
            active={showRotationHandles}
            title={showRotationHandles ? t('toolRotationHandlesHide') : t('toolRotationHandlesShow')}
          >
            <IconRotateMode size={20} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setOrthoLock(v => !v)}
            active={orthoLock}
            activeColor="bg-orange-600"
            title={t('toolOrthoLock')}
          >
            <IconOrtho size={20} />
          </ToolbarButton>

          {/* Row 3: Path Edit */}
          <ToolbarButton onClick={() => setCurrentTool('path')} active={currentTool === 'path'} title={t('toolPathEdit')}>
            <IconPathEdit size={20} />
          </ToolbarButton>

          {/* Ruler tool */}
          <ToolbarButton onClick={() => setCurrentTool('ruler')} active={currentTool === 'ruler'} title={t('toolRuler')}>
            <IconRuler size={20} />
          </ToolbarButton>

          {/* Picot Join button */}
          <ToolbarButton
            onClick={togglePicotJoinMode}
            active={activeMode === 'picotJoin'}
            colSpan2
            flexCenter
            title={t('toolPicotJoin')}
          >
            <IconJoinPicots size={20} />
          </ToolbarButton>
          {/* Beading mode button */}
          <ToolbarButton
            onClick={toggleBeadingMode}
            active={activeMode === 'beading'}
            activeColor="bg-purple-600"
            colSpan2
            flexCenter
            title={t('toolBeadingMode')}
          >
            <IconBeadMode size={20} />
          </ToolbarButton>

          {/* Join/Break buttons moved to properties bar in picotJoin mode */}
          <ToolbarButton onClick={addRing} title={t('toolAddRing')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddRing size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={addSplitRing} title={t('toolAddSplitRing')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddSplitRing size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={() => setCurrentTool('line')} active={currentTool === 'line'} title={t('toolLineTool')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddLine size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={addChain} title={t('toolAddChain')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}>
            <IconAddChain size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={deleteSelected} colSpan2 title={t('toolDelete')} disabled={activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}><IconDelete size={20} /></ToolbarButton>
          <ToolbarButton
            onClick={groupSelected}
            title={t('toolGroup')}
            disabled={selectedIds.length < 2 || activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}
          >
            <IconGroup size={20} />
          </ToolbarButton>
          <ToolbarButton
            onClick={ungroupSelected}
            title={t('toolUngroup')}
            disabled={selectedIds.length === 0 || activeMode === 'picotJoin' || activeMode === 'beading' || activeMode === 'tattingOrder'}
          >
            <IconUngroup size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={() => zoomToCenter(-ZOOM_STEP_BUTTON_OUT)} title={t('toolZoomOut')}>
            <IconZoomOut size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={() => zoomToCenter(ZOOM_STEP_BUTTON_IN)} title={t('toolZoomIn')}>
            <IconZoomIn size={20} />
          </ToolbarButton>
          <ToolbarButton onClick={fitAllElements} title={t('btnFitAll')}>
            <IconFitView size={20} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setCurrentTool(prev => prev === 'zoomRect' ? 'select' : 'zoomRect')}
            active={currentTool === 'zoomRect'}
            activeColor="bg-yellow-600"
            title={t('toolZoomRect')}
          >
            <IconZoomRect size={20} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setCurrentTool(currentTool === 'image' ? 'pan' : 'image')}
            active={currentTool === 'image'}
            colSpan2
            title={t('toolRefImage')}
          >
            <IconImage size={20} />
          </ToolbarButton>

          {/* Notes toggle — bottom of left toolbar */}
          <ToolbarButton
            onClick={() => setNotesOpen(v => !v)}
            active={notesOpen}
            activeColor="bg-amber-600"
            colSpan2
            flexCenter
            className="gap-1 text-xs font-semibold"
            title={notesOpen ? t('notesClose') : t('notesOpen')}
          >
            <IconNotes size={16} />
            <span>{t('toolNotes')}</span>
          </ToolbarButton>
          <button
            onClick={() => setToolbarMode('simple')}
            title={t('toolbarSimpleTip')}
            className="col-span-2 pointer-events-auto rounded px-1 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
            style={{ touchAction: 'manipulation' }}
          >‹ {t('toolbarSimple')}</button>
          </>}
        </div>
        </div>
        </aside>
        ); })()}

        {/* Upright phone: bottom tool bar instead of the rail (CSS decides). */}
        <PhoneToolBar main={phoneMainTools} more={phoneMoreTools} moreLabel={t('toolbarMore')} moreTitle={t('toolbarMoreTip')} />
        
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
                  {t('confirmCancel')}
                </button>
                <button
                  onClick={() => {
                    setReferenceImage(null);
                    setShowRemoveConfirm(false);
                  }}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded"
                >
                  {t('refImageRemove')}
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
          className="info-bar absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-4 py-2 z-10 pointer-events-none"
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
                          return `${Math.round(dist)}px  ·  ${mm.toFixed(1)} mm  ·  ${(mm/10).toFixed(2)} cm  ·  ${(mm/25.4).toFixed(3)}"  — ${t('rulerClickToReset')}`;
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
              // World point under the fingers' midpoint at the start of the
              // gesture; onTouchMove keeps it under the (moving) midpoint.
              const canvasEl: any = canvasRef.current;
              const rect = canvasEl ? canvasEl.getBoundingClientRect() : null;
              const worldX = rect ? (centerX - rect.left - camera.x) / zoom : 0;
              const worldY = rect ? (centerY - rect.top - camera.y) / zoom : 0;
              setTouchState({ dist, zoom, centerX, centerY, worldX, worldY });
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
              // Two fingers: pinch zoom + pan in one gesture (session 58).
              // Spreading/pinching changes zoom; moving both fingers pans;
              // both at once do both — like a map. Pinch with still fingers
              // behaves exactly as before.
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
              
              // Current midpoint of the two fingers
              const centerX = (touches[0].clientX + touches[1].clientX) / 2;
              const centerY = (touches[0].clientY + touches[1].clientY) / 2;
              
              if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                
                // Convert screen coords to canvas coords
                const canvasX = centerX - rect.left;
                const canvasY = centerY - rect.top;
                
                // Put the world point that was under the midpoint when the
                // gesture started (touchState.worldX/Y) under the CURRENT
                // midpoint at the new zoom. Midpoint still → pure zoom about
                // it (the old behaviour); midpoint moving → the canvas
                // follows the fingers.
                const newCameraX = canvasX - touchState.worldX * clampedZoom;
                const newCameraY = canvasY - touchState.worldY * clampedZoom;
                
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
              setTouchState({ dist: 0, zoom: zoom, centerX: 0, centerY: 0, worldX: 0, worldY: 0 });
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

              {/* Amber glow filter for chains stretched too flat to hold their curve */}
              <filter id="amber-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="1"/>
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
                
                // Fold connections (session 47) render identically in both
                // schematic and realistic mode — the "line tool" look (solid
                // material-colored stroke with a black outline) applies
                // regardless of mode, unlike regular join lines which differ
                // between dashed-schematic and solid-realistic. Checked
                // before the renderMode split for that reason. Origin is
                // always conn.picots[0] — which physical picot that is
                // doesn't matter for pattern output (both ends read
                // symmetrically as fp//ref//), so it's picked by array order
                // alone, not any semantic rule.
                if (conn.connectionType === 'fold') {
                  const originRef = conn.picots[0];
                  const originEl = elementById.get(originRef.elementId);
                  const originPicot = originEl?.picots?.find(pic => pic.id === originRef.picotId);
                  const originFrame = originEl && originPicot ? getPicotPosition(originEl, originPicot, true) : null;
                  // Fold is plain-picot-only and endpoint pseudo-picots are
                  // never fold-eligible (see isPicotFoldEligible), so
                  // originPicot should always resolve — this null check is
                  // just defensive, matching the "should already be
                  // guarded upstream" pattern used elsewhere in this file.
                  if (!originFrame || originFrame.angle === undefined) {
                    return null;
                  }
                  const outerLength = conn.outerLength ?? DEFAULT_FOLD_PROPS.outerLength;
                  const innerLength = conn.innerLength ?? DEFAULT_FOLD_PROPS.innerLength;
                  const angleA = conn.angleA ?? DEFAULT_FOLD_PROPS.angleA;
                  const angleB = conn.angleB ?? DEFAULT_FOLD_PROPS.angleB;
                  const anchorPos = positions[1] ?? positions[0];
                  // anchorPos.angle should always be present — positions[]
                  // is built via getPicotPosition(el, picot, true) same as
                  // originFrame, and fold is plain-picot-only (see comment
                  // above) — but fall back to facing the origin if it's
                  // ever missing rather than crashing.
                  const anchorAngle = anchorPos.angle ?? Math.atan2(originFrame.y - anchorPos.y, originFrame.x - anchorPos.x);
                  const { outerD, innerD } = buildFoldLoopPair(
                    originFrame.x, originFrame.y, originFrame.angle,
                    anchorPos.x, anchorPos.y, anchorAngle,
                    outerLength, innerLength, angleA, angleB
                  );
                  // Same material-color resolution regular join lines use
                  // (session 52: unified — both now sample gradients at the
                  // origin picot's stitch position instead of always taking
                  // the gradient's first stop) — this is what makes it
                  // "look like the line tool" rather than the schematic
                  // theme color, in both modes.
                  const foldFirstEl = originEl;
                  let foldLineColor;
                  if (conn.materialId) {
                    const mat = materialsById.get(conn.materialId);
                    foldLineColor = mat
                      ? getConnectionThreadColor(foldFirstEl, originPicot, conn.materialId)
                      : getConnectionThreadColor(foldFirstEl, originPicot);
                  } else {
                    foldLineColor = getConnectionThreadColor(foldFirstEl, originPicot) || '#FF8C00';
                  }
                  const foldLineWidth = foldFirstEl?.lineWidth || 2;
                  // Paint order (session 47, live feedback): whichever
                  // apparent picot is currently smaller should paint
                  // UNDERNEATH the bigger one, automatically, rather than
                  // outer always being drawn first — so as the two lengths
                  // shift which one is actually bigger, the smaller one
                  // visually tucks behind the larger one instead of always
                  // sitting on top of it regardless of size. Compared
                  // directly (outerLength/innerLength are now the actual
                  // stored values, not something derived that needs
                  // recomputing to stay in sync).
                  // One element per arc (was a black stroke + colour stroke
                  // each — 4 shapes per fold), same ribbon style as picots
                  // and realistic joins: filled band foldLineWidth wide,
                  // 1.5 black outline underneath via paintOrder="stroke".
                  // Arcs stay separate elements (not merged into one path)
                  // so the smaller-under-bigger paint order below still
                  // works.
                  const foldHW = foldLineWidth / 2;
                  const outerArcEls = (
                    <path key="outer" d={ribbonFromPoints(sampleCubicD(outerD), foldHW)} fill={foldLineColor}
                      stroke="black" strokeWidth={1.5} strokeLinejoin="round" paintOrder="stroke" />
                  );
                  const innerArcEls = (
                    <path key="inner" d={ribbonFromPoints(sampleCubicD(innerD), foldHW)} fill={foldLineColor}
                      stroke="black" strokeWidth={1.5} strokeLinejoin="round" paintOrder="stroke" />
                  );
                  return (
                    <g key={conn.id}>
                      {/* Thin connector to the anchor picot — schematic-only;
                          in realistic mode the arcs themselves already show
                          where the fold reaches, an extra dashed guide line
                          would look out of place next to solid thread color. */}
                      {renderMode !== 'realistic' && (
                        <line
                          x1={originFrame.x} y1={originFrame.y} x2={anchorPos.x} y2={anchorPos.y}
                          stroke={theme.connectionLine} strokeWidth="2"
                          strokeDasharray="3,4" opacity="0.5"
                        />
                      )}
                      {/* SVG paints later siblings on top — smaller arc
                          first (underneath), bigger arc last (on top). */}
                      {outerLength >= innerLength
                        ? <>{innerArcEls}{outerArcEls}</>
                        : <>{outerArcEls}{innerArcEls}</>}
                    </g>
                  );
                }

                if (renderMode === 'realistic') {
                  // Realistic mode: use the material stored on the connection (set by first-selected picot)
                  const connectedPairs = conn.picots.map(p => {
                    const el = elementById.get(p.elementId);
                    if (!el) return null;
                    const picot = el.picots?.find(pic => pic.id === p.picotId);
                    return { el, picot: picot || null }; // picot null for endpoint pseudo-picots
                  }).filter(pair => pair && pair.el);
                  const firstPair = connectedPairs[0];
                  const firstEl = firstPair?.el;
                  // Use stored materialId if present, otherwise fall back to old heuristic
                  let lineColor;
                  if (conn.materialId) {
                    const mat = materialsById.get(conn.materialId);
                    lineColor = mat
                      ? getConnectionThreadColor(firstPair?.el, firstPair?.picot, conn.materialId)
                      : getConnectionThreadColor(firstEl, firstPair?.picot);
                  } else {
                    const pickedPair = connectedPairs.find(pair => {
                      const c = getConnectionThreadColor(pair.el, pair.picot);
                      return c && c.toLowerCase() !== '#ffffff' && c.toLowerCase() !== '#fff';
                    }) || firstPair;
                    lineColor = (pickedPair ? getConnectionThreadColor(pickedPair.el, pickedPair.picot) : null) || '#FF8C00';
                  }
                  const lineWidth = firstEl?.lineWidth || 2;
                  const beadSeqForConnR = getConnectionBeadSeq(conn);
                  // ONE element per connection, painted the same way as the
                  // baked picots (emitPicot in render/realisticRenderer.ts):
                  // a filled ribbon `lineWidth` wide in the thread colour,
                  // with a 1.5 black outline on the same element and
                  // paint-order="stroke" so the outline sits underneath the
                  // fill (only its outer half shows). Previously a separate
                  // black line + colour line per picot — 4 shapes for an
                  // ordinary 2-picot join.
                  // A 2-picot join is a single straight ribbon A→B (its two
                  // spokes always met at the midpoint, so they were already
                  // collinear). 3+ picots get one rectangle per spoke to the
                  // centroid, all as subpaths of the same path: the stroke
                  // is painted for the whole element before the fill, so
                  // where spokes overlap the fill covers the internal
                  // outline edges and they read as one joined shape.
                  const ribbonHW = lineWidth / 2;
                  const ribbon = (a: { x: number; y: number }, b: { x: number; y: number }) => {
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const len = Math.hypot(dx, dy);
                    if (len < 1e-6) return '';
                    const nx = (-dy / len) * ribbonHW, ny = (dx / len) * ribbonHW;
                    return `M ${a.x + nx},${a.y + ny} L ${b.x + nx},${b.y + ny} L ${b.x - nx},${b.y - ny} L ${a.x - nx},${a.y - ny} Z`;
                  };
                  const connD = positions.length === 2
                    ? ribbon(positions[0], positions[1])
                    : positions.map(pos => ribbon(pos, { x: cx, y: cy })).join(' ');
                  return (
                    <g key={conn.id}>
                      {connD && (
                        <path d={connD} fill={lineColor}
                          stroke="black" strokeWidth={1.5} strokeLinejoin="round" paintOrder="stroke" />
                      )}
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
              {/* Guides only — hidden in realistic view like the square grid
                  (session 57). Also keeps them out of a realistic SVG export,
                  which clones this canvas. */}
              {renderMode !== 'realistic' && polarGrids.filter(g => g.visible).map(grid => {
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

              {/* picotJoin/beading dim overlay wraps all path elements.
                  Not rendered at all in realistic view: this used to stay
                  mounted at opacity 0 there, so every element's schematic
                  paths, notation labels, order badges and split-ring arrows
                  were still built and drawn invisibly underneath the baked
                  image. Nothing in realistic mode reads it — the baked SVG
                  draws the stitches/picots/lines, and bead/BE picots have
                  their own realistic overlay pass further down. */}
              {renderMode !== 'realistic' && (
              <g opacity={(activeMode === 'picotJoin' || activeMode === 'beading') ? 0.25 : 1}>
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
                const isUnnumbered = !el.isRepeat && (!el.orderNumber || el.orderNumber.toString().trim() === '');
                const shouldHighlight = (showUnnumbered || activeMode === 'tattingOrder') && isUnnumbered;
                const activeDraft = (draftNotation?.elementId === el.id && draftNotation) ? draftNotation.value : null;
                const hasInvalidNotation = el.type !== 'line' && renderMode === 'schematic' && (() => {
                  const notationToCheck = activeDraft ?? el.notation;
                  return notationToCheck && !isNotationValid(notationToCheck.trim());
                })();
                // Computed live from the current path geometry rather than
                // trusting el.isTooShort — that flag is only ever refreshed
                // inside computeElementAfterNotationEdit (a notation-text-
                // edit-time snapshot), so anything else that changes a
                // chain's geometry (duplication, array creation, drag,
                // rotation, mirror) leaves it stale. A live check can't go
                // stale. Uses physical thread length (stitchCount * dsWidth)
                // vs the chain's actual current chord distance, not the
                // currently-rendered curve's own arc length — a chain can
                // always bulge or flatten to span any chord up to its
                // physical length, so only being stretched past that (plus
                // a little give) is genuinely "too short". See paths.ts.
                const isTooShort = isChainTooShort(el, dsWidth);
                const elementFilter = (showInvalidNotation && hasInvalidNotation) ? 'url(#red-glow)'
                  : (showInvalidNotation && isTooShort) ? 'url(#amber-glow)'
                  : shouldHighlight ? 'url(#pink-glow)'
                  : undefined;
                // In tattingOrder mode, hide notation labels so only order numbers are visible
                const hideNotationInMode = activeMode === 'tattingOrder';
                // Ghost elements are non-interactive visual copies
                const isGhost = el.type === 'ghost';
                // Single source of truth: ghost opacity and pointer events
                const ghostOpacity = isGhost ? (el.isBoundary ? 0.65 : 0.4) : 1;
                const ghostPointerEvents = isGhost && !el.isBoundary ? 'none' as const : undefined;
                // PERFORMANCE: During translate-drag, apply offset via SVG transform instead of
                // mutating element state during the drag.
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
                      {/* Per-element "G" badge removed — superseded by the
                          dashed-box group overlay + corner badge rendered
                          once per group (see groupBoxes render pass). */}
                      <g key={`${el.id}-labels`} data-layer="notation">{(el.hideLabel || hideNotationInMode || isGhost) ? null : renderStitchLabels(el)}</g>
                      {(showUnnumbered || activeMode === 'tattingOrder') && el.orderNumber && (() => {
                        const [_fill, _stroke] = getRoundBadgeColor(el);
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
                      {(showUnnumbered || activeMode === 'tattingOrder') && el.isRepeat && (
                        <text data-layer="order" x={el.center.x} y={el.center.y} fill="#9ca3af" fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke="#111827" strokeWidth="3" paintOrder="stroke">R</text>
                      )}
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
                          const { x: ox, y: oy } = orderLabelPosOnPath(el, 20);
                          const [_f3, _s3] = getRoundBadgeColor(el);
                          return <text data-layer="order" x={ox} y={oy} fill={_f3} fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke={_s3} strokeWidth="3" paintOrder="stroke">{el.orderNumber}</text>;
                        })()}
                        {(showUnnumbered || activeMode === 'tattingOrder') && el.isRepeat && el.paths?.length > 0 && (() => {
                          const { x: ox, y: oy } = orderLabelPosOnPath(el, 20);
                          return <text data-layer="order" x={ox} y={oy} fill="#9ca3af" fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke="#111827" strokeWidth="3" paintOrder="stroke">R</text>;
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
                          // This is now unconditional (session 48): flipElements'
                          // split-ring branch performs a TRUE mirror via
                          // mirrorPath, which swaps start<->end as an intrinsic
                          // part of the reflection (needed for arc continuity —
                          // see flipElements). That means paths[0].x/y is
                          // ALREADY, correctly, the start of the CURRENT
                          // notation A regardless of flip state. The previous
                          // flipCount-based swap here was compensating for the
                          // old regenerate+rotate split-ring code, which never
                          // actually reflected anything (rotation can't produce
                          // a mirror) — keeping that swap now double-corrects
                          // and points the arrow the wrong way under a single
                          // flip. Do not reintroduce it without re-deriving
                          // against flipElements' current behavior.
                          const x1 = el.paths[0].endX;
                          const y1 = el.paths[0].endY;
                          const x2 = el.paths[0].x;
                          const y2 = el.paths[0].y;
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
{(showUnnumbered || activeMode === 'tattingOrder') && (el.orderNumber || el.isRepeat) && (() => {
                          // Chains: halfway along the path (el.center can be stale
                          // for chains). Rings: their centre, as before.
                          const { x: ox, y: oy } = el.type === 'chain'
                            ? orderLabelPosOnPath(el, 40)
                            : { x: el.center.x, y: el.center.y };
                          if (el.orderNumber) {
                            const [_f5, _s5] = getRoundBadgeColor(el);
                            return <text data-layer="order" x={ox} y={oy} fill={_f5} fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke={_s5} strokeWidth="3" paintOrder="stroke">{el.orderNumber}</text>;
                          }
                          return <text data-layer="order" x={ox} y={oy} fill="#9ca3af" fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke="#111827" strokeWidth="3" paintOrder="stroke">R</text>;
                        })()}
                        {/* Per-element "G" badge removed — superseded by the
                            dashed-box group overlay + corner badge. */}
                      </>
                    )}
                    </>
                    )}
                  </g>
                );
              })}

              </g>
              )}

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
              {(currentTool === 'path' || currentTool === 'line') && selectedIds.length === 1 && (() => {
                const el = (() => { const _e = elementById.get(selectedIds[0]); return (_e?.type === 'chain' || _e?.type === 'line') ? _e : undefined; })();
                if (!el || !el.paths || el.paths.length === 0) return null;
                const path = el.paths[0];
                
                if (path.type === 'cubic') {
                  // Cubic bezier - show 2 control points
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
                } else {
                  // Quadratic bezier - show 1 control point (legacy support, chains only — lines are always cubic)
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

              {/* Snap point indicators - hidden in realistic mode, dimmed in picotJoin mode */}
              {snapEnabled && showEditingArtifacts && renderMode !== 'realistic' && (() => {
                // Show snap points for all non-selected elements
                return elements
                  .filter(el => !selectedIdSet.has(el.id))
                  .map(el => {
                    // Every snap target gets the orange indicator, including
                    // guide points (gp) and guide joined picots (jpg) — those
                    // used to be filtered out here ('picot-guide'), so they
                    // snapped with no visual cue.
                    const points = getSnapPoints(el);
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

              {/* Endpoint pseudo-picot dots in picotJoin mode. Only boundary
                  ghosts (and real elements) get clickable tip dots — interior
                  ghosts are managed by inherited-join propagation, not direct
                  click. This is a UI-interaction restriction, not a geometry
                  one — see getEndpointPseudoPicots for why the position
                  lookup itself stays unrestricted. */}
              {activeMode === 'picotJoin' && showEditingArtifacts && renderMode !== 'realistic' && elements.map(el => {
                if (el.type === 'ghost' && !el.isBoundary) return null;
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

              {/* ── Spatial group overlay: dashed box + corner name badge ─────────
                  Design Discussion #2. One pass over groupBoxes (already bucketed/
                  bounded via getSelectionBoundingBox), not per-element — replaces
                  the old per-element unlabeled "G" text badge. Same visibility
                  rule the old badge had (schematic modes only; not realistic-mode
                  bakedRealisticSVG render, which has no per-element pass to hang
                  this off of anyway). Cosmetic note: an axis-aligned box around
                  rotated group content will visibly grow/shrink as the group
                  rotates — expected, agreed in design discussion, not a bug. */}
              {renderMode !== 'realistic' && groupBoxes.map(box => (
                <g key={`group-box-${box.groupId}`} data-ui="1" data-layer="groups">
                  <rect
                    x={box.minX} y={box.minY}
                    width={box.maxX - box.minX} height={box.maxY - box.minY}
                    fill="none"
                    stroke={box.color}
                    strokeWidth={2 / zoom}
                    strokeDasharray={`${6 / zoom},${4 / zoom}`}
                  />
                  <text
                    x={box.minX}
                    y={box.maxY + (16 / zoom)}
                    fill={box.color}
                    fontSize={notationFS}
                    fontWeight="bold"
                    textAnchor="start"
                    dominantBaseline="hanging"
                  >
                    {box.name}
                  </text>
                </g>
              ))}

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
                      >{t('rulerClickToReset')}</text>
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
              : <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">{t('helpLoading')}</div>
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
              : <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">{t('helpLoading')}</div>
            }
          </div>
        </div>
      )}


      {showColorPicker && (
        <Modal
          show
          onClose={() => { setShowColorPicker(false); setColorPickerTab('picker'); setPickerTabsAllowed(null); setPickerCallback(null); }}
          backdropZIndex={2147483646}
          wrapperZIndex={2147483646}
          contentClassName="flex flex-col"
          contentStyle={{ width: '100%', maxWidth: '28rem', height: 'min(92vh, 610px)' }}
        >
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
              {(!pickerTabsAllowed || pickerTabsAllowed.includes('lizbeth')) && (
                <button
                  onClick={() => setColorPickerTab('lizbeth')}
                  className={`px-4 py-2 text-sm font-medium ${
                    colorPickerTab === 'lizbeth'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('colorLizbethTab')}
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

            {colorPickerTab === 'picker' && (
              <ColorPickerPickerTab
                pickerColor={pickerColor}
                setPickerColor={setPickerColor}
                customColors={customColors}
              />
            )}
            {colorPickerTab === 'swatches' && (
              <ColorPickerSwatchesTab
                dmcColors={dmcOnlyColors}
                dmcSearchTerm={dmcSearchTerm}
                setDmcSearchTerm={setDmcSearchTerm}
                dmcPage={dmcPage}
                setDmcPage={setDmcPage}
                dmcCategory={dmcCategory}
                setDmcCategory={setDmcCategory}
                selectedDmcColor={selectedDmcColor}
                setSelectedDmcColor={setSelectedDmcColor}
                setPickerColor={setPickerColor}
                categorizeColor={categorizeColor}
                t={t}
              />
            )}
            {colorPickerTab === 'lizbeth' && (
              <ColorPickerSwatchesTab
                dmcColors={lizbethOnlyColors}
                dmcSearchTerm={lizbethSearchTerm}
                setDmcSearchTerm={setLizbethSearchTerm}
                dmcPage={lizbethPage}
                setDmcPage={setLizbethPage}
                dmcCategory={lizbethCategory}
                setDmcCategory={setLizbethCategory}
                selectedDmcColor={selectedLizbethColor}
                setSelectedDmcColor={setSelectedLizbethColor}
                setPickerColor={setPickerColor}
                categorizeColor={categorizeColor}
                t={t}
              />
            )}
            {colorPickerTab === 'gradients' && (
              <ColorPickerGradientsTab
                dmcColors={dmcColors}
                gradientSearchTerm={gradientSearchTerm}
                setGradientSearchTerm={setGradientSearchTerm}
                gradientPage={gradientPage}
                setGradientPage={setGradientPage}
                gradientCategory={gradientCategory}
                setGradientCategory={setGradientCategory}
                selectedGradient={selectedGradient}
                setSelectedGradient={setSelectedGradient}
                t={t}
              />
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
        </Modal>
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
                {t('confirmCancel')}
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
          // Ask only when something would be lost (session 58; was: any
          // non-empty canvas, even right after saving).
          if (hasUnsavedChanges) {
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
            <Modal show onClose={() => setShowRecentProjectsDialog(false)} backdropZIndex={10010} wrapperZIndex={10011}
              backdropClassName="bg-black bg-opacity-70"
              contentClassName="flex flex-col" contentStyle={{ width: 'min(720px, 96vw)', maxHeight: '90dvh' }}>

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
                      const pathMissing = !entry.filename || missingRecentPaths.has(entry.filename);
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
                  {recents.some(e => !e.filename || missingRecentPaths.has(e.filename)) && (
                    <button
                      onClick={() => {
                        const cleaned = recents.filter(e => e.filename && !missingRecentPaths.has(e.filename));
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
            </Modal>

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
                      {t('confirmCancel')}
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
      <DropdownMenu buttonRef={helpButtonRef} onClose={() => setShowHelpMenu(false)} width={220}>
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
      </DropdownMenu>
    )}

    {/* ── About panel ──────────────────────────────────────────────── */}
    {showAbout && (
        <Modal show onClose={() => setShowAbout(false)} backdropZIndex={10002} wrapperZIndex={10003}
          contentClassName="flex flex-col" contentStyle={{ width: 'min(440px, 95vw)', maxHeight: '95dvh', overflow: 'hidden' }}>


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
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('aboutSpecialThanks')}</div>
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
        </Modal>
    )}

    {showFileMenu && (
      <DropdownMenu buttonRef={fileButtonRef} onClose={() => setShowFileMenu(false)} width={200}>
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
            <span>{t('fileSaveAs')}</span>
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
              // Ask only when there are unsaved changes (session 58).
              if (hasUnsavedChanges) {
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
          <div className="border-t border-gray-600 my-1"></div>
          <button
            onClick={() => {
              setShowFileMenu(false);
              cleanupDuplicates();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-gray-200"
            title={t('fileCleanupDuplicatesTitle')}
          >
            <IconDelete size={16} />
            <span>{t('fileCleanupDuplicates')}</span>
          </button>
      </DropdownMenu>
    )}

    {/* Arrange dropdown menu - rendered at top level to avoid clipping */}
    {showArrangeMenu && (
      <DropdownMenu buttonRef={arrangeButtonRef} onClose={() => setShowArrangeMenu(false)} width={220}>
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
            <div className="px-4 py-2 text-xs text-gray-500 italic">{t('arrangeNoPolarGrids')}</div>
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
      </DropdownMenu>
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
                        <div className="text-white text-sm font-medium ">{array.type === 'polar' ? t('ghostArrayTypePolar') : t('ghostArrayTypeLinear')}</div>
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
                        <label className="text-xs text-gray-400">{array.type === 'polar' ? t('ghostArrayAngle') : t('linearArrayDirection')}:</label>
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
                          // Use array.ghostIds' existing creation order directly, not a
                          // rotation-based re-sort — rotation can wrap inconsistently when
                          // sourceEl has nonzero rotation (see the note in architecture.md,
                          // and the same fix in useJoinActions.ts's buildConnectionsForInheritedJoin).
                          const oldGhostIdsSorted = (array.ghostIds || []).filter((id: string) => oldGhostById.has(id));

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
                              // Sort by rotation RELATIVE to sourceEl's own rotation, not raw
                              // rotation % 360 — raw rotation can wrap inconsistently across
                              // ghosts when sourceEl has nonzero rotation (createPolarInstance
                              // computes ghost.rotation = (sourceEl.rotation + angleDeg) % 360),
                              // silently scrambling creation order. Subtracting sourceEl's own
                              // rotation before the modulo recovers the original, always-monotonic
                              // angleDeg ordering regardless of sourceEl's rotation. Same root
                              // cause as the fix in useJoinActions.ts's
                              // buildConnectionsForInheritedJoin — see architecture.md.
                              const sourceRotation = sourceEl.rotation || 0;
                              const relativeAngle = (el: any) => (((el.rotation || 0) - sourceRotation) % 360 + 360) % 360;
                              const newGhostIdsSorted = [...newGhosts].sort((a, b) => relativeAngle(a) - relativeAngle(b)).map(g => g.id);

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
              {t('ghostArrayConvertAllTitle')}
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
                  {t('confirmCancel')}
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
                  {t('confirmCancel')}
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
      <DropdownMenu buttonRef={viewButtonRef} onClose={() => setShowViewMenu(false)} width={200}>
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
      </DropdownMenu>
    )}

    {/* Options dropdown menu - rendered at top level to avoid clipping */}
    {showOptionsMenu && (
      <DropdownMenu buttonRef={optionsButtonRef} onClose={() => setShowOptionsMenu(false)} width={200}>
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
                  {s === 'normal' ? t('uiScaleNormal') : t('optionsSizeLarge')}
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

      </DropdownMenu>
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
                  value={mat.id === 'default' ? t('materialDefaultName') : mat.name}
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
                      setElements(prev => prev.map(el => {
                        const clearA = el.materialId === mat.id;
                        const clearB = el.isSplitRing && el.materialIdB === mat.id;
                        if (!clearA && !clearB) return el;
                        return {
                          ...el,
                          ...(clearA ? { materialId: 'default' } : {}),
                          ...(clearB ? { materialIdB: 'default' } : {}),
                        };
                      }));
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
                    setElements(prev => prev.map(el => {
                      if (!selectedIdSet.has(el.id)) return el;
                      // Split rings: set both A and B
                      if (el.isSplitRing) return { ...el, materialId: id, materialIdB: id };
                      return { ...el, materialId: id };
                    }));
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
        <Modal show onClose={() => setShowBeadLibrary(false)} backdropZIndex={2147483644} wrapperZIndex={2147483645}
          backdropClassName="bg-black bg-opacity-50"
          contentClassName="flex flex-col sm:flex-row" contentStyle={{ width: 'min(680px, 95vw)', height: 'min(540px, 90vh)' }}>

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
                    <button onClick={() => setConfirmDialog({ message: t('confirmDeleteNamed').replace('{name}', activeBead.name), onConfirm: () => deleteBead(activeBead.id) })}
                      className="flex-1 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-white">{t('confirmDelete')}</button>
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
                        placeholder={t('beadNamePlaceholder')}
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
                        <span className="text-gray-300 text-sm w-16">{t('infoColorPrefix')}</span>
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
                            title={t('clickToChangeColor')}
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
          </Modal>
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
          id, name: t('polarGridDefaultName').replace('{n}', String(polarGrids.length + 1)),
          center: { x: 0, y: 0 },
          angularOffset: 0,
          visible: true,
          color: '#4B9FE1',
          // Starts with one ring so a new grid is visible on the canvas
          // straight away (an empty grid drew nothing, which read as
          // "nothing happened"). Same defaults as + Add Ring's first ring.
          rings: [{ id: generateId(), radius: 75, divisions: 8, visible: true, snap: true, angularOffset: 0 }]
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

      // Shared input styling for the editor's number fields.
      const numCls = "px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm text-white text-right outline-none focus:border-blue-400";
      const sectionLabel = "text-xs text-gray-400 uppercase tracking-wider mb-2";

      // Layout (session 56 redesign — same controls, regrouped):
      //   Left:  grid list → "+ Add Grid" right under it.
      //   Right: header (name + ✕) → Appearance → Position → Rings
      //          (column headers + rows + "+ Add Ring") → footer
      //          (peek · delete grid · close).
      //   No grid yet: the right side explains what a grid is and offers
      //   the same Add Grid action instead of a bare "select a grid".
      return (
        <Modal show peek={polarGridPeek} onClose={() => setShowPolarGridPanel(false)} backdropZIndex={2147483644} wrapperZIndex={2147483645}
          backdropClassName="bg-black bg-opacity-50"
          contentClassName="flex flex-col sm:flex-row" contentStyle={{ width: 'min(820px, 95vw)', height: 'min(560px, 90vh)' }}>

              {/* ── Left: grid list ── */}
              <div className="sm:w-52 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-600 flex flex-col" style={{ minWidth: 0 }}>
                <div className="px-3 py-3 border-b border-gray-600">
                  <span className="text-gray-100 font-semibold text-sm flex items-center gap-2"><IconPolarGrid size={16} /> {t('polarGridTitle')}</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                 <div className="flex sm:flex-col flex-row overflow-x-auto sm:overflow-x-visible">
                  {polarGrids.map(g => (
                    // A div (not a <button>) so the eye toggle inside can be
                    // a real button — buttons can't nest.
                    <div key={g.id}
                      role="button" tabIndex={0}
                      onClick={() => setSelectedPolarGridId(g.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPolarGridId(g.id); } }}
                      className={`w-auto sm:w-full text-left px-2 text-sm flex items-center gap-2 truncate flex-shrink-0 cursor-pointer ${g.id === selectedPolarGridId ? 'bg-blue-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                      style={{ minHeight: '2rem', maxHeight: '2rem' }}
                    >
                      {/* Visibility toggle in the grid's own color (replaces
                          the plain color dot); same as the editor's Visible box. */}
                      <button
                        onClick={e => { e.stopPropagation(); updateGrid(g.id, { visible: !g.visible }); }}
                        className="flex-shrink-0 rounded p-0.5 bg-gray-900 bg-opacity-60 hover:bg-opacity-90"
                        style={{ color: g.color, opacity: g.visible ? 1 : 0.5 }}
                        title={t('propToggleVisibility')}
                        aria-pressed={g.visible}
                      >{g.visible ? <IconEyeOn size={16} /> : <IconEyeOff size={16} />}</button>
                      <span className="truncate">{g.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">
                        {t(g.rings.length === 1 ? 'polarGridRingCountOne' : 'polarGridRingCount').replace('{n}', String(g.rings.length))}
                      </span>
                    </div>
                  ))}
                 </div>
                  <div className="p-2">
                    <button onClick={addGrid}
                      className="w-full py-1.5 rounded border-2 border-dashed border-gray-600 text-gray-300 hover:border-white hover:text-white text-xs">{t('polarGridAdd')}</button>
                  </div>
                </div>
              </div>

              {/* ── Right: editor ── */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header: grid name + close */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-600">
                  {activeGrid ? (
                    <input
                      className="bg-transparent text-white font-semibold text-base flex-1 min-w-0 px-2 py-0.5 rounded border border-gray-500 focus:border-purple-400 focus:bg-gray-700 outline-none transition-colors"
                      value={activeGrid.name}
                      onChange={e => updateGrid(activeGrid.id, { name: e.target.value })}
                      placeholder={t('polarGridNamePlaceholder')}
                      title={t('polarGridNamePlaceholder')}
                    />
                  ) : <span className="flex-1" />}
                  <button onClick={() => setShowPolarGridPanel(false)}
                    className="text-gray-400 hover:text-white text-xl ml-2" title={t('aboutClose')}>✕</button>
                </div>

                {/* Body */}
                {activeGrid ? (
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

                    {/* Appearance */}
                    <div>
                      <div className={sectionLabel}>{t('polarGridSectionAppearance')}</div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                          <input type="checkbox" checked={activeGrid.visible}
                            onChange={e => updateGrid(activeGrid.id, { visible: e.target.checked })}
                            className="w-4 h-4 accent-blue-500" />
                          {t('polarGridVisible')}
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-300">{t('infoColorPrefix')}</span>
                          <div
                            className="w-6 h-6 rounded-full flex-shrink-0 border-2 border-gray-500 cursor-pointer hover:border-white"
                            style={{ backgroundColor: activeGrid.color }}
                            onClick={() => {
                              setPickerColor(activeGrid.color);
                              setColorPickerTab('picker');
                              setPickerTabsAllowed(['picker']);
                              setPickerCallback(() => (color) => updateGrid(activeGrid.id, { color }));
                              setShowColorPicker(true);
                            }}
                            title={t('infoColorPrefix')}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-300">{t('polarGridOpacityLabel')}</span>
                          <input
                            type="range" min={0.05} max={1} step={0.05}
                            value={activeGrid.opacity ?? 0.5}
                            onChange={e => updateGrid(activeGrid.id, { opacity: parseFloat(e.target.value) })}
                            className="w-24 accent-blue-400"
                            title={t('polarGridOpacityLabel')}
                          />
                          <span className="text-xs text-gray-400 w-8 text-right flex-shrink-0">
                            {Math.round((activeGrid.opacity ?? 0.5) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Position */}
                    <div>
                      <div className={sectionLabel}>{t('polarGridSectionPosition')}</div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-gray-300 mr-1">{t('polarGridCenterLabel')}</span>
                          <span className="text-xs text-gray-400">{t('polarGridCenterX')}</span>
                          <ArrayInput
                            value={Math.round(activeGrid.center.x)}
                            onChange={x => updateGrid(activeGrid.id, { center: { ...activeGrid.center, x } })}
                            step={1}
                            className={`w-16 ${numCls}`}
                          />
                          <span className="text-xs text-gray-400 ml-1">{t('polarGridCenterY')}</span>
                          <ArrayInput
                            value={Math.round(activeGrid.center.y)}
                            onChange={y => updateGrid(activeGrid.id, { center: { ...activeGrid.center, y } })}
                            step={1}
                            className={`w-16 ${numCls}`}
                          />
                          <button
                            onClick={() => updateGrid(activeGrid.id, { center: { x: 0, y: 0 } })}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600"
                            title={t('polarGridResetCenter')}
                          >⌖</button>
                        </div>
                        <div className="flex items-center gap-2" title={t('polarGridRotateAllTitle')}>
                          <span className="text-sm text-gray-300">{t('polarGridRotateAll')}</span>
                          <ArrayInput
                            value={activeGrid.angularOffset || 0}
                            onChange={v => updateGrid(activeGrid.id, { angularOffset: v })}
                            min={0} max={359} step={1}
                            className={`w-16 ${numCls}`}
                          />
                          <span className="text-xs text-gray-400">°</span>
                        </div>
                      </div>
                    </div>

                    {/* Rings */}
                    <div>
                      <div className={sectionLabel}>{t('polarGridRingsHeader')}</div>
                      <p className="text-xs text-gray-500 mb-2 italic">
                        {(() => {
                          // Sentence comes from translations with a {name}
                          // slot, split so the preset name keeps its own style.
                          const [pre, post = ''] = t('polarGridRealWorldHint').split('{name}');
                          return <>{pre}<span className="text-gray-400">{presetDisplayName(activePreset)}</span>{post}</>;
                        })()}
                      </p>

                      {activeGrid.rings.length === 0 ? (
                        <p className="text-gray-400 text-xs mb-3">{t('polarGridNoRings')}</p>
                      ) : (
                        <div className="overflow-x-auto mb-2">
                          <table className="w-full text-xs border-separate" style={{ borderSpacing: '0 4px' }}>
                            <thead>
                              <tr className="text-gray-400 text-left">
                                <th className="font-normal px-2 w-6">#</th>
                                <th className="font-normal px-1" title={t('polarGridColRadiusTitle')}>{t('polarGridColRadius')}</th>
                                <th className="font-normal px-1" title={t('polarGridColPointsTitle')}>{t('polarGridColPoints')}</th>
                                <th className="font-normal px-1" title={t('polarGridRingOffsetTitle')}>{t('polarGridColOffset')}</th>
                                <th className="font-normal px-1 text-center">{t('polarGridColShow')}</th>
                                <th className="font-normal px-1 text-center">{t('polarGridColSnap')}</th>
                                <th className="w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {activeGrid.rings.map((ring, idx) => (
                                <tr key={ring.id} className="bg-gray-700">
                                  <td className="px-2 py-1.5 rounded-l text-gray-400">{idx + 1}</td>
                                  <td className="px-1 py-1.5 whitespace-nowrap">
                                    <ArrayInput
                                      value={ring.radius}
                                      onChange={v => updateRing(activeGrid.id, ring.id, { radius: v })}
                                      min={1} step={5}
                                      className={`w-16 ${numCls}`}
                                    />
                                    <span className="text-gray-400 ml-1.5" title={t('polarGridRadiusMmTitle')}>
                                      ~{radiusToMm(ring.radius) < 10
                                        ? radiusToMm(ring.radius).toFixed(1)
                                        : Math.round(radiusToMm(ring.radius))} mm
                                    </span>
                                  </td>
                                  <td className="px-1 py-1.5">
                                    <ArrayInput
                                      value={ring.divisions}
                                      onChange={v => updateRing(activeGrid.id, ring.id, { divisions: v })}
                                      min={1} max={360} step={1} integer
                                      className={`w-14 ${numCls}`}
                                    />
                                  </td>
                                  <td className="px-1 py-1.5 whitespace-nowrap">
                                    <ArrayInput
                                      value={ring.angularOffset || 0}
                                      onChange={v => updateRing(activeGrid.id, ring.id, { angularOffset: v })}
                                      min={-359} max={359} step={1}
                                      className={`w-14 ${numCls}`}
                                    />
                                    <span className="text-gray-400 ml-1">°</span>
                                  </td>
                                  <td className="px-1 py-1.5 text-center">
                                    <button
                                      onClick={() => updateRing(activeGrid.id, ring.id, { visible: !ring.visible })}
                                      className={`px-1 py-0.5 rounded text-xs border ${ring.visible ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                      title={t('propToggleVisibility')}
                                    >{ring.visible ? <IconEyeOn size={14} /> : <IconEyeOff size={14} />}</button>
                                  </td>
                                  <td className="px-1 py-1.5 text-center">
                                    <button
                                      onClick={() => updateRing(activeGrid.id, ring.id, { snap: !ring.snap })}
                                      className={`px-1 py-0.5 rounded text-xs border ${ring.snap ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                                      title={t('polarGridToggleSnap')}
                                    >{ring.snap ? <IconSnapOn size={14} /> : <IconSnapOff size={14} />}</button>
                                  </td>
                                  <td className="px-1 py-1.5 rounded-r text-right">
                                    <button
                                      onClick={() => deleteRing(activeGrid.id, ring.id)}
                                      className="px-1.5 py-0.5 rounded text-xs bg-red-900 hover:bg-red-800 text-red-300 border border-red-800"
                                      title={t('polarGridDeleteRing')}
                                    >✕</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <button
                        onClick={() => addRing(activeGrid.id)}
                        className="w-full py-1.5 rounded border-2 border-dashed border-gray-600 text-gray-300 hover:border-white hover:text-white text-xs"
                      >{t('polarGridAddRing')}</button>
                    </div>
                  </div>
                ) : (
                  /* No grid selected / none exist yet */
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
                    <IconPolarGrid size={40} />
                    <p className="text-gray-200 text-sm font-semibold">
                      {polarGrids.length === 0 ? t('polarGridEmptyTitle') : t('polarGridSelectPrompt')}
                    </p>
                    {polarGrids.length === 0 && (
                      <>
                        <p className="text-gray-400 text-xs max-w-sm">{t('polarGridEmptyBody')}</p>
                        <button onClick={addGrid}
                          className="mt-1 px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium">{t('polarGridAdd')}</button>
                      </>
                    )}
                  </div>
                )}

                {/* Footer: peek · delete grid · close */}
                <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-600">
                  <button
                    onMouseDown={() => setPolarGridPeek(true)}
                    onMouseUp={() => setPolarGridPeek(false)}
                    onMouseLeave={() => setPolarGridPeek(false)}
                    onTouchStart={() => setPolarGridPeek(true)}
                    onTouchEnd={() => setPolarGridPeek(false)}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
                    title={t('polarGridPeekHint')}
                  >👁 {t('polarGridPeekHint')}</button>
                  <span className="flex-1" />
                  {activeGrid && (
                    <button onClick={() => setConfirmDialog({ message: t('confirmDeleteNamed').replace('{name}', activeGrid.name), onConfirm: () => deleteGrid(activeGrid.id) })}
                      className="px-3 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-white">{t('polarGridDeleteGrid')}</button>
                  )}
                  <button onClick={() => setShowPolarGridPanel(false)}
                    className="px-4 py-1 rounded text-xs bg-blue-700 hover:bg-blue-600 text-white font-medium">{t('aboutClose')}</button>
                </div>
              </div>
        </Modal>
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
        <Modal show onClose={() => setShowThreadProperties(false)} backdropZIndex={2147483640} wrapperZIndex={2147483641}
          backdropClassName="bg-black bg-opacity-50"
          contentClassName="flex flex-col sm:flex-row" contentStyle={{ width: 'min(700px, 95vw)', maxHeight: '85vh', overflowY: 'auto' }}>

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
                    >{p.id === activePresetId ? '▶ ' : ''}{presetDisplayName(p)}</button>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-600 flex gap-1">
                  <button onClick={addPreset}
                    className="flex-1 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">{t('beadAdd')}</button>
                  {threadPresets.length > 1 && (
                    <button onClick={() => setConfirmDialog({ message: t('confirmDeleteNamed').replace('{name}', presetDisplayName(activePreset)), onConfirm: () => deletePreset(activePresetId) })}
                      className="flex-1 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-white">{t('confirmDelete')}</button>
                  )}
                </div>
              </div>

              {/* Right: Edit form */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
                  <input
                    className="bg-transparent text-white font-semibold text-base flex-1 min-w-0 px-2 py-0.5 rounded border border-gray-500 focus:border-purple-400 focus:bg-gray-700 outline-none transition-colors"
                    value={presetDisplayName(activePreset)}
                    onChange={e => updatePreset(activePreset.id, { name: e.target.value })}
                    placeholder={t('threadPresetNamePlaceholder')}
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
                    <ThreadPropertiesNumInput label={t('threadRegularPicot')} value={activePreset.picotRegular}
                      onChange={v => updatePreset(activePreset.id, { picotRegular: v })} />
                    <ThreadPropertiesNumInput label={t('threadJoinedPicot')} value={activePreset.picotJoined}
                      onChange={v => updatePreset(activePreset.id, { picotJoined: v })} />
                    <ThreadPropertiesNumInput label={t('threadLongPicotLabel')} value={activePreset.picotRegular * 2} readOnly hint={t('threadLongPicotHint')} />
                    <ThreadPropertiesNumInput label={t('threadShortPicotLabel')} value={activePreset.picotShort ?? activePreset.picotRegular * 0.5} readOnly hint={activePreset.picotShort ? t('threadShortPicotHintSample') : t('threadShortPicotHintAuto')} />
                  </div>

                  <div className="border-t border-gray-600 my-3" />

                  {/* Tension 1–5 (decimals ok) — shown to the user instead of the
                      end allowance it sets (stored in ds as preset.endAllowance;
                      tension 1 = 0 ds, 5 = 1.5 ds). Default for NEW chains /
                      teardrops / split rings (¼ for split rings); existing
                      elements keep theirs until "Tension" is applied to them.
                      See tensionToAllowance in geometry/stitchGeometry.ts. */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('threadEndAllowanceHeader')}</div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <ThreadPropertiesNumInput label={t('threadEndAllowance')} unit=""
                      value={presetTension(activePreset)}
                      hint={t('threadEndAllowanceHint')}
                      onChange={v => updatePreset(activePreset.id, { endAllowance: tensionToAllowance(v) })} />
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
        </Modal>
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
                title={t('splashUpdateOverlayClick')}
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
                title={splashAutosave ? `${splashAutosave.name || t('projectUntitled')} — ${splashAutosave.date}` : t('splashNoAutosave')}
              >
                {splashAutosave ? t('splashResume').replace('{name}', splashAutosave.name || t('projectUntitled')) : t('splashNoAutosave')}
              </button>

              <button
                onClick={() => { setShowSplash(false); setShowHelp(true); }}
                className="py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold transition-colors"
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
                  <PresetChip
                    key={n}
                    onClick={() => setPolarArrayCount(n)}
                    selected={polarArrayCount === n}
                  >{n}</PresetChip>
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
                <PresetChip
                  onClick={() => setPolarArrayAngle(360)}
                  selected={polarArrayAngle === 360}
                >360°</PresetChip>
                <PresetChip
                  onClick={() => setPolarArrayAngle(180)}
                  selected={polarArrayAngle === 180}
                >180°</PresetChip>
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
              <label htmlFor="polar-ghosts" className="text-sm text-gray-300">{t('arrayCreateAsGhosts')}</label>
            </div>

            {/* Step preview text */}
            <div className="text-xs text-gray-400 text-center">
              {t('polarArraySummary').replace('{n}', String(polarArrayCount)).replace('{step}', (polarArrayAngle / polarArrayCount).toFixed(1)).replace('{angle}', String(polarArrayAngle))}
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
            >👁 {t('polarGridPeekHint')}</button>
    </ArrayDialogShell>

    {/* ── Linear Array Dialog ───────────────────────────────────── */}
    <ArrayDialogShell show={showLinearArrayDialog} peek={linearArrayPeek} onClose={() => setShowLinearArrayDialog(false)}>
            <div className="text-white font-semibold text-base">{t('linearArrayTitle')}</div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('polarArrayCount')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={linearArrayCount} onChange={setLinearArrayCount} min={2} max={100} integer className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                {[3,4,6,8].map(n => <PresetChip key={n} onClick={() => setLinearArrayCount(n)} selected={linearArrayCount === n}>{n}</PresetChip>)}
              </div>
            </div>

            {/* Direction */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('linearArrayDirection')}</label>
              <div className="flex items-center gap-2">
                {[[t('linearArrayDirH'), 0], [t('linearArrayDirV'), 90]].map(([label, val]) => (
                  <PresetChip key={label} onClick={() => setLinearArrayAngle(val as number)} selected={linearArrayAngle === val} className="px-3 py-1 font-semibold">{label}</PresetChip>
                ))}
                <ArrayInput value={linearArrayAngle} onChange={setLinearArrayAngle} min={0} max={360} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                <span className="text-gray-400 text-xs">°</span>
              </div>
            </div>

            {/* Spacing */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('linearArraySpacingHint')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={linearArraySpacing} onChange={setLinearArraySpacing} min={0} max={500} step={10} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                <span className="text-gray-400 text-xs">%</span>
                <PresetChip onClick={() => setLinearArraySpacing(100)}>{t('linearArraySpacingTouch')}</PresetChip>
                <PresetChip onClick={() => setLinearArraySpacing(200)}>200%</PresetChip>
              </div>
            </div>

            {/* Rotation per step */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('linearArrayRotStep')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={linearArrayRotStep} onChange={setLinearArrayRotStep} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                <span className="text-gray-400 text-xs">°</span>
                <PresetChip onClick={() => setLinearArrayRotStep(0)}>{t('propResetBtn')}</PresetChip>
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
              <label htmlFor="linear-ghosts" className="text-sm text-gray-300">{t('arrayCreateAsGhosts')}</label>
            </div>

            {/* Summary */}
            <div className="text-xs text-gray-400 text-center">
              {t('linearArraySummary').replace('{n}', String(linearArrayCount)).replace('{angle}', String(linearArrayAngle)).replace('{spacing}', String(linearArraySpacing))}{linearArrayRotStep !== 0 ? t('linearArraySummaryRot').replace('{rot}', String(linearArrayRotStep)) : ''}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  executeLinearArray(linearArrayCount, linearArrayAngle, linearArraySpacing, linearArrayRotStep, linearArrayCreateGhosts);
                  setShowLinearArrayDialog(false);
                  setLinearArrayCreateGhosts(false);
                }}
                className="flex-1 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold"
              >{t('polarArrayApply')}</button>
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
            >👁 {t('polarGridPeekHint')}</button>
    </ArrayDialogShell>

    {/* ── Spiral Array Dialog ───────────────────────────────────── */}
    <ArrayDialogShell show={showSpiralArrayDialog} peek={spiralArrayPeek} onClose={() => setShowSpiralArrayDialog(false)}>
            <div className="text-white font-semibold text-base">{t('spiralArrayTitle')}</div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('polarArrayCount')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={spiralArrayCount} onChange={setSpiralArrayCount} min={2} max={100} integer className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                {[4,6,8,12].map(n => <PresetChip key={n} onClick={() => setSpiralArrayCount(n)} selected={spiralArrayCount === n}>{n}</PresetChip>)}
              </div>
            </div>

            {/* Angle step */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('spiralArrayAngleStep')}</label>
              <div className="flex items-center gap-2">
                <ArrayInput value={spiralArrayAngleStep} onChange={setSpiralArrayAngleStep} min={1} max={180} className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm" />
                {[15,30,45,60].map(n => <PresetChip key={n} onClick={() => setSpiralArrayAngleStep(n)} selected={spiralArrayAngleStep === n}>{n}°</PresetChip>)}
              </div>
            </div>

            {/* Type toggle */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">{t('spiralArrayType')}</label>
              <div className="flex gap-2">
                <PresetChip onClick={() => setSpiralArrayType('archimedean')} selected={spiralArrayType === 'archimedean'} className="flex-1 py-1.5 font-semibold">{t('spiralArrayArchimedean')}</PresetChip>
                <PresetChip onClick={() => setSpiralArrayType('geometric')} selected={spiralArrayType === 'geometric'} className="flex-1 py-1.5 font-semibold">{t('spiralArrayGeometric')}</PresetChip>
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
              <button onClick={() => { executeSpiralArray(spiralArrayCount, spiralArrayType, spiralArrayGap, spiralArrayGrowth, spiralArrayRotate, spiralArrayAngleStep); setShowSpiralArrayDialog(false); }} className="flex-1 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold">{t('polarArrayApply')}</button>
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
            >👁 {t('polarGridPeekHint')}</button>
    </ArrayDialogShell>

    {/* ── In-app Confirm Dialog ─────────────────────────────────── */}
    {confirmDialog && (
      <Modal show onClose={() => setConfirmDialog(null)} backdropZIndex={2147483647} wrapperZIndex={2147483647}
        contentClassName="px-6 py-5 flex flex-col gap-4" contentStyle={{ width: 'min(360px, 90vw)' }}>
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
      </Modal>
    )}

    {/* ── In-app Alert Dialog ───────────────────────────────────── */}
    {alertDialog && (
      <Modal show onClose={() => setAlertDialog(null)} backdropZIndex={2147483647} wrapperZIndex={2147483647}
        backdropClassName="bg-black bg-opacity-40"
        contentClassName="px-6 py-5 flex flex-col gap-4" contentStyle={{ width: 'min(320px, 90vw)' }}>
        <div className="flex flex-col gap-1 text-center">
          <p className="text-white text-sm">{alertDialog.message}</p>
          {alertDialog.sub && <p className="text-gray-400 text-xs">{alertDialog.sub}</p>}
        </div>
        <button
          onClick={() => setAlertDialog(null)}
          className="py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium"
        >{t('alertOk')}</button>
      </Modal>
    )}

    </>
  );
};

export default TattingDesigner;
