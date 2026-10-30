// useViewState.ts — Visual settings, canvas appearance, reference image, DMC colors

import { useState, useMemo } from 'react';
import { DEFAULT_ROUND_COLORS_TEXT } from '../utils/roundColors';

export const DEFAULT_THEME = {
  snapOuter: '#FFA500',
  snapInner: '#FFA500',
  jpUnconnected: '#00CC44',
  jpConnected:   '#FFE600',
  jpSelected:    '#FF1493',
  cjUnconnected: '#00BFFF',
  cjConnected:   '#FFE600',
  cjSelected:    '#FF1493',
  handleStart:    '#00FF00',
  handleControl1: '#0088FF',
  handleControl2: '#00DDFF',
  handleStroke:   '#000000',
  connectionLine: '#FFE600',
  connectionDot:  '#FFE600',
  jpgArm:         '#00FF00',
  jpgArmSelected: '#66FF66',
  gpDiamond:      '#ADFF2F',

  // ── Session 59: every other on-canvas indicator colour ─────────────────
  // Values are today's built-in colours, so the default look is unchanged.
  // All of these can be overridden from tatting-theme.json (any CSS colour
  // text, rgba() included — except orderRoundColors, see roundColors.ts).

  // Warning glows
  glowUnnumbered: '#FF1493',   // Tatting Order: element without a number
  glowInvalid:    '#ef4444',   // notation that doesn't parse
  glowTooShort:   '#f59e0b',   // chain stretched too flat for its stitches

  // Selection
  selectionOutline: '#3B82F6',               // dashed outlines, selection box, bounding box, rotation handles
  selectionFill:    'rgba(59, 130, 246, 0.1)', // inside the drag-select box
  pivotHandle:      '#FF8C00',               // rotation pivot (Shift / Rotate tool)
  handleBorder:     '#FFFFFF',               // white rim on rotation handles, pivot, ruler points, polar-grid points, selected bead anchor
  zoomRectOutline:  '#FBBF24',
  zoomRectFill:     'rgba(251, 191, 36, 0.1)',

  // Markers
  markerOutline:  '#000000',   // dark rim on picot / endpoint dots and connection lines

  // Beads
  beadAnchor:         '#ec4899', // pink diamond where a picot has beads
  beadAnchorBeading:  '#f472b6', // … in Beading mode
  beadAnchorSelected: '#38bdf8', // … selected in Beading mode
  beadAnchorOutline:  '#111111',
  beadMissing:        '#ef4444', // bead that's no longer in the bead library

  // Array previews (while the dialog is open)
  previewPolar:  '#60a5fa',
  previewLinear: '#34d399',
  previewSpiral: '#f472b6',

  // Ruler
  rulerStart:    '#FACC15',   // first point, and the line while measuring
  rulerEnd:      '#60A5FA',   // second point while measuring
  rulerLocked:   '#34D399',   // line + second point once both points are set
  rulerLabelBg:  'rgba(15,23,42,0.88)',
  rulerTextPx:   '#94A3B8',
  rulerTextMm:   '#F1F5F9',
  rulerTextCm:   '#34D399',
  rulerTextInch: '#60A5FA',
  rulerHint:     'rgba(148,163,184,0.7)',

  // Picot Join: fold line / connection line with no usable thread colour
  foldLine: '#FF8C00',

  // Tatting Order
  orderRepeatText:    '#9ca3af', // "R" on repeat elements
  orderRepeatOutline: '#111827',
  orderRoundColors:   DEFAULT_ROUND_COLORS_TEXT, // "fill/outline, …" per round — see utils/roundColors.ts

  // Stitch-count labels on rings / chains
  notationText:    '#FFFFFF',
  notationOutline: '#000000',

  // Schematic view: dark edge drawn under chain / line threads
  threadOutline: '#000000',

  // Path Edit guide lines (to the control points)
  pathGuide: '#888',

  // Canvas grid lines (dark background / white background)
  gridLine:      'rgba(255,255,255,0.1)',
  gridLineLight: 'rgba(0,0,0,0.1)',
};

// Session 59: theme presets. 'standard' = DEFAULT_THEME (the classic look).
// 'pastel' = built from the user's palette (#4B79A1 #E1B12C #F39C12 #A1D69E
// #2C3E50 #E67E22 #D9BF77 #BB8E2D #95A5A6 #34495E), with lighter / darker
// variants where two jobs looked alike. Checked with a colour-blindness
// simulator (deutan / protan / tritan): every group that must be told apart
// (picot states, warning glows, path handles, bead markers, ruler) stays
// distinct; conventions: not joined = light mint, joined = steel blue,
// selected = carrot orange. The dark navies are used only for outlines and
// label backgrounds (they vanish on the dark canvas).
// Revised for colour blindness (session 59): every pair that must be told
// apart — including pairs shown together (Tatting Order glow / selection /
// "R"; connection line / unjoined picot / unjoined core join / selected) —
// scores >= 23 CAM02-UCS ΔE under normal, deutan, protan and tritan vision.
// Made for dark backgrounds; light colours fade on a white background.
export const PASTEL_THEME: typeof DEFAULT_THEME = {
  ...DEFAULT_THEME,
  snapOuter: '#F4D98E',
  snapInner: '#F4D98E',
  jpUnconnected: '#A1F3A1',
  jpConnected: '#4B79A1',
  jpSelected: '#E67E22',
  cjUnconnected: '#9BA3A3',
  cjConnected: '#4B79A1',
  cjSelected: '#E67E22',
  handleStart: '#BAF1B6',
  handleControl1: '#6997C0',
  handleControl2: '#F39C12',
  handleStroke: '#2C3E50',
  connectionLine: '#4B79A1',
  connectionDot: '#4B79A1',
  jpgArm: '#A1D69E',
  jpgArmSelected: '#BAF1B6',
  gpDiamond: '#A1D69E',
  glowUnnumbered: '#D0EAEC',
  glowInvalid: '#E74C3C',
  glowTooShort: '#F4D98E',
  selectionOutline: '#6997C0',
  selectionFill: 'rgba(105, 151, 192, 0.12)',
  pivotHandle: '#F39C12',
  handleBorder: '#F4F1E8',
  zoomRectOutline: '#E1B12C',
  zoomRectFill: 'rgba(225, 177, 44, 0.12)',
  markerOutline: '#2C3E50',
  beadAnchor: '#6997C0',
  beadAnchorBeading: '#CADBDC',
  beadAnchorSelected: '#E67E22',
  beadAnchorOutline: '#34495E',
  beadMissing: '#E74C3C',
  previewPolar: '#6997C0',
  previewLinear: '#BAF1B6',
  previewSpiral: '#D9BF77',
  rulerStart: '#E1B12C',
  rulerEnd: '#6997C0',
  rulerLocked: '#CADBDC',
  rulerLabelBg: 'rgba(44, 62, 80, 0.92)',
  rulerTextPx: '#95A5A6',
  rulerTextMm: '#F4F1E8',
  rulerTextCm: '#BAF1B6',
  rulerTextInch: '#86B4DE',
  rulerHint: 'rgba(149, 165, 166, 0.8)',
  foldLine: '#F39C12',
  orderRepeatText: '#BB8E2D',
  orderRepeatOutline: '#2C3E50',
  orderRoundColors: '#95A5A6/#2C3E50, #86B4DE/#2C3E50, #E1B12C/#2C3E50, #BAF1B6/#2C3E50, #E67E22/#2C3E50, #F4D98E/#2C3E50, #6997C0/#2C3E50, #F39C12/#2C3E50, #A1D69E/#2C3E50, #BB8E2D/#2C3E50, #CADBDC/#2C3E50, #F6C45D/#2C3E50, #B0C0C1/#2C3E50, #80B37E/#2C3E50, #D9AA46/#2C3E50, #FECB45/#2C3E50, #B59D59/#2C3E50',
  notationText: '#F4F1E8',
  notationOutline: '#2C3E50',
  threadOutline: '#2C3E50',
  pathGuide: '#95A5A6',
  gridLine: 'rgba(149, 165, 166, 0.12)',
  gridLineLight: 'rgba(44, 62, 80, 0.12)',
};

export const THEME_PRESETS = { standard: DEFAULT_THEME, pastel: PASTEL_THEME };
export type BuiltInThemeId = keyof typeof THEME_PRESETS;
/** 'file' = the colours of a tatting-theme.json next to the app, on top of
 *  Standard (offered only when that file exists). 'custom' = the user's own
 *  theme, made in the editor and saved in the app (see CustomTheme). */
export type ThemePresetId = BuiltInThemeId | 'file' | 'custom';
export type ThemeKey = keyof typeof DEFAULT_THEME;
export type ThemeColors = Partial<Record<ThemeKey, string>>;

/** Keep only known theme keys with string values (theme files, saved edits). */
export const pickThemeKeys = (data: any): ThemeColors => {
  const out: ThemeColors = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
  for (const key of Object.keys(DEFAULT_THEME) as ThemeKey[]) {
    if (typeof data[key] === 'string' && data[key].trim() !== '') out[key] = data[key];
  }
  return out;
};

/** The user's Custom theme: the built-in preset it was copied from plus the
 *  colours changed since (so ↺ can go back to the starting colour). */
export interface CustomTheme { base: BuiltInThemeId; colors: ThemeColors }

// Saved under tcad_theme: { preset, custom }. Older saves from earlier in
// session 59 were { preset, colors } (edits on top of a preset) — those
// edits become the Custom theme.
const readSavedTheme = (): { preset: ThemePresetId; custom: CustomTheme | null } => {
  try {
    const raw = JSON.parse(localStorage.getItem('tcad_theme') || 'null');
    if (!raw) return { preset: 'standard', custom: null };
    const isBuiltIn = (p: any): p is BuiltInThemeId => typeof p === 'string' && p in THEME_PRESETS;
    let custom: CustomTheme | null = raw.custom && typeof raw.custom === 'object'
      ? { base: isBuiltIn(raw.custom.base) ? raw.custom.base : 'standard', colors: pickThemeKeys(raw.custom.colors) }
      : null;
    let preset: ThemePresetId = isBuiltIn(raw.preset) || raw.preset === 'file' || raw.preset === 'custom' ? raw.preset : 'standard';
    const oldEdits = pickThemeKeys(raw.colors);
    if (!custom && Object.keys(oldEdits).length > 0) {
      custom = { base: isBuiltIn(raw.preset) ? raw.preset : 'standard', colors: oldEdits };
      preset = 'custom';
    }
    if (preset === 'custom' && !custom) preset = 'standard';
    return { preset, custom };
  } catch { return { preset: 'standard', custom: null }; }
};

export const SPLASH_TIP_COUNT = 15;

export const SPLASH_TIP_KEYS = [
  'splashTip01', 'splashTip02', 'splashTip03', 'splashTip04', 'splashTip05',
  'splashTip06', 'splashTip07', 'splashTip08', 'splashTip09', 'splashTip10',
  'splashTip11', 'splashTip12', 'splashTip13', 'splashTip14', 'splashTip15',
];

// Left toolbar layout, session 58. Decided once and stored: a fresh install
// starts in 'simple'; anyone who already used the app (any of our keys
// present) keeps the 'full' toolbar they know. Written on first decision so
// it can't flip on the next launch once other keys exist. Also read by
// useCanvasInteraction (which runs first) to pick the starting tool: Select
// in simple mode, Pan in full mode.
export const getInitialToolbarMode = (): 'simple' | 'full' => {
  try {
    const saved = localStorage.getItem('tcad_toolbar_mode');
    if (saved === 'simple' || saved === 'full') return saved;
    const existingUser = ['tcad_install_date', 'tcad_thread_presets', 'tcad_recent_projects',
      'tatting-designer-autosave', 'tcad_ui_scale', 'tcad_language']
      .some(k => localStorage.getItem(k) !== null);
    const mode = existingUser ? 'full' : 'simple';
    localStorage.setItem('tcad_toolbar_mode', mode);
    return mode;
  } catch { return 'full'; }
};

export function useViewState() {
  // ── Canvas appearance ──────────────────────────────────────────────────
  const [bgColor, setBgColor] = useState<string>(() => {
    try { return localStorage.getItem('tcad_bg_color') || '#1F2937'; } catch { return '#1F2937'; }
  });
  const [gridEnabled, setGridEnabled] = useState(true);
  const [customColors, setCustomColors] = useState<any[]>([]);
  // Colour theme (session 59). The chosen theme is one of:
  //   'standard' / 'pastel' — built-in, read-only
  //   'file'   — a tatting-theme.json next to the app (themeFileColors, read
  //              once at start via applyThemeFile) on top of Standard
  //   'custom' — the user's own theme: a copy of one of the above plus their
  //              changes, saved in the app; it stays when they switch away.
  // The file is its own choice, NOT a layer over every preset (as a layer it
  // masked whichever preset was picked). Saved in tcad_theme.
  const [themePreset, setThemePresetState] = useState<ThemePresetId>(() => readSavedTheme().preset);
  const [themeCustom, setThemeCustomState] = useState<CustomTheme | null>(() => readSavedTheme().custom);
  const [themeFileColors, setThemeFileColors] = useState<ThemeColors>({});
  /** Full colour set of any choice. */
  const themeFor = (p: ThemePresetId): typeof DEFAULT_THEME => {
    if (p === 'file') return { ...DEFAULT_THEME, ...themeFileColors };
    if (p === 'custom' && themeCustom) return { ...THEME_PRESETS[themeCustom.base], ...themeCustom.colors };
    return THEME_PRESETS[p === 'custom' ? 'standard' : p];
  };
  const theme = useMemo(() => themeFor(themePreset), [themePreset, themeFileColors, themeCustom]);
  const saveTheme = (preset: ThemePresetId, custom: CustomTheme | null) => {
    try { localStorage.setItem('tcad_theme', JSON.stringify({ preset, custom })); } catch { /* storage unavailable */ }
  };
  const setThemePreset = (preset: ThemePresetId) => {
    if (preset === 'custom' && !themeCustom) return;
    setThemePresetState(preset); saveTheme(preset, themeCustom);
  };
  const putCustom = (custom: CustomTheme) => {
    setThemeCustomState(custom); setThemePresetState('custom'); saveTheme('custom', custom);
  };
  /** Make (or replace) Custom as a copy of another choice, and switch to it. */
  const copyThemeToCustom = (from: ThemePresetId) => {
    if (from === 'custom') return;
    putCustom(from === 'file' ? { base: 'standard', colors: { ...themeFileColors } } : { base: from, colors: {} });
  };
  /** Change Custom's colours (the ones that differ from its starting preset). */
  const setCustomThemeColors = (colors: ThemeColors) => {
    if (themeCustom) putCustom({ ...themeCustom, colors });
  };
  /** Options → Load Theme…: the file's colours become Custom (on Standard). */
  const loadThemeIntoCustom = (colors: ThemeColors) => putCustom({ base: 'standard', colors });
  /** Options → Reset Theme: back to Standard (Custom is kept). */
  const resetTheme = () => setThemePreset('standard');
  /** Start-up file found: remember its colours; on a first start (nothing
   *  saved yet) choose it, as the app always applied it before. */
  const applyThemeFile = (colors: ThemeColors) => {
    setThemeFileColors(colors);
    let saved = false;
    try { saved = localStorage.getItem('tcad_theme') !== null; } catch { /* storage unavailable */ }
    if (!saved && Object.keys(colors).length > 0) { setThemePresetState('file'); saveTheme('file', themeCustom); }
  };
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapRadius, setSnapRadius] = useState(15);

  // ── Reference image ────────────────────────────────────────────────────
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [refImageProps, setRefImageProps] = useState({
    opacity: 0.5, rotation: 0, scale: 1, visible: true, x: 0, y: 0,
  });

  // ── DMC colors ─────────────────────────────────────────────────────────
  const [dmcColors, setDmcColors] = useState<any[]>([]);

  // ── UI scale and notation ──────────────────────────────────────────────
  const [notationFontSize, setNotationFontSize] = useState('medium');
  const [uiScale, setUiScale] = useState<string>(() => {
    try { return localStorage.getItem('tcad_ui_scale') || 'normal'; } catch { return 'normal'; }
  });

  // ── Left toolbar: 'simple' (one labelled column) or 'full' (all tools) ──
  // See getInitialToolbarMode (top of this file).
  const [toolbarMode, setToolbarModeState] = useState<'simple' | 'full'>(getInitialToolbarMode);
  const setToolbarMode = (mode: 'simple' | 'full') => {
    try { localStorage.setItem('tcad_toolbar_mode', mode); } catch { /* storage unavailable */ }
    setToolbarModeState(mode);
  };

  // ── Clipboard ──────────────────────────────────────────────────────────
  const [clipboard, setClipboard] = useState<any[]>([]);

  // ── Splash tip ─────────────────────────────────────────────────────────
  const [splashTipIndex, setSplashTipIndex] = useState<number>(
    () => Math.floor(Math.random() * SPLASH_TIP_COUNT)
  );

  return {
    bgColor, setBgColor,
    gridEnabled, setGridEnabled,
    customColors, setCustomColors,
    theme, themeFor, themePreset, setThemePreset, themeCustom, copyThemeToCustom,
    setCustomThemeColors, loadThemeIntoCustom, themeFileColors, applyThemeFile, resetTheme,
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
  };
}
