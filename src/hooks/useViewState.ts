// useViewState.ts — Visual settings, canvas appearance, reference image, DMC colors

import { useState } from 'react';

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
  const [theme, setTheme] = useState(DEFAULT_THEME);
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
  };
}
