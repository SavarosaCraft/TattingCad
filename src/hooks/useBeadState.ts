// useBeadState.ts — Bead library, polar grids, picot connections, thread presets

import { useState } from 'react';
import { DEFAULT_END_ALLOWANCE } from '../geometry/stitchGeometry';

export const DEFAULT_BEAD_LIBRARY = [
  { id: 'bead1', name: 'Small seed',             size: 'Y', color: '#ef4444', shape: 'circle' },
  { id: 'bead2', name: 'Medium seed',            size: 'Z', color: '#22c55e', shape: 'circle' },
  { id: 'bead3', name: 'Large seed',             size: 'V', color: '#a855f7', shape: 'circle' },
  { id: 'bead4', name: 'Square medium',          size: 'Z', color: '#228B22', shape: 'square' },
  { id: 'bead5', name: 'Rectangular large',      size: 'V', color: '#FFD700', shape: 'rectangle' },
  { id: 'bead6', name: 'Teardrop large tip-out', size: 'V', color: '#0F52BA', shape: 'teardrop-up' },
  { id: 'bead7', name: 'Teardrop large tip-in',  size: 'V', color: '#ADD8E6', shape: 'teardrop-down' },
];

const DEFAULT_THREAD_PRESET = {
  id: 'default',
  name: 'Pearl Cotton Size 10, Needle Tat',
  ds20Working: 285,
  ds20Core: 45,
  picotRegular: 7,
  picotJoined: 5,
  endAllowance: DEFAULT_END_ALLOWANCE, // ds, from DEFAULT_TENSION (geometry/stitchGeometry.ts)
  sample20DS10Regular: null,
  sample20DS10Short: null,
};

// Session 59: a shuttle-tatting preset from Tim's measurements (20 DS ring =
// 203 mm of shuttle thread; 20 DS chain = 236.5 mm ball thread over 36.5 mm
// shuttle thread), size 20 thread. Picot lengths not measured yet — the
// default's values until Tim sends them.
export const TIMS_TAT_PRESET = {
  id: 'tims-tat',
  name: 'Size 20, Shuttle Tat (Tim)',
  technique: 'shuttle',
  ds20Ring: 203,      // mm — all (shuttle) thread for a 20 DS ring
  ds20Working: 236.5, // mm — ball thread for a 20 DS chain
  ds20Core: 36.5,     // mm — shuttle thread (core) for a 20 DS chain
  picotRegular: 8,
  picotJoined: 5,
  endAllowance: DEFAULT_END_ALLOWANCE,
  sample20DS10Regular: null,
  sample20DS10Short: null,
};
// Built-in presets added to existing installs once each; the ids added so far
// are remembered so a preset the user deleted doesn't come back.
const BUILT_IN_EXTRA_PRESETS = [TIMS_TAT_PRESET];

const loadPolarGrids = (): any[] => {
  try {
    const saved = localStorage.getItem('tcad_polar_grids');
    if (saved) {
      const grids = JSON.parse(saved);
      return grids.map((g: any) => ({ ...g, visible: false }));
    }
  } catch {}
  return [];
};

const loadThreadPresets = (): any[] => {
  // Fresh install: default + built-ins, in memory only. Nothing is written
  // here — tcad_thread_presets is one of the keys getInitialToolbarMode
  // (useViewState.ts) uses to spot an EXISTING user.
  let saved: string | null = null;
  try { saved = localStorage.getItem('tcad_thread_presets'); } catch {}
  if (!saved) return [{ ...DEFAULT_THREAD_PRESET }, ...BUILT_IN_EXTRA_PRESETS.map(b => ({ ...b }))];
  let presets: any[] = [{ ...DEFAULT_THREAD_PRESET }];
  try { presets = JSON.parse(saved); } catch {}
  // Session 59: the first build called it "Tim's tat"; rename copies the
  // user hasn't renamed themselves.
  if (presets.some(p => p.id === 'tims-tat' && p.name === "Tim's tat")) {
    presets = presets.map(p => (p.id === 'tims-tat' && p.name === "Tim's tat" ? { ...p, name: TIMS_TAT_PRESET.name } : p));
    try { localStorage.setItem('tcad_thread_presets', JSON.stringify(presets)); } catch {}
  }
  // Existing install: add each built-in once (remembered, so a deleted one
  // doesn't come back).
  try {
    const added: string[] = JSON.parse(localStorage.getItem('tcad_builtin_presets_added') || '[]');
    const missing = BUILT_IN_EXTRA_PRESETS.filter(b => !added.includes(b.id));
    if (missing.length > 0) {
      for (const b of missing) if (!presets.some(p => p.id === b.id)) presets = [...presets, { ...b }];
      localStorage.setItem('tcad_thread_presets', JSON.stringify(presets));
      localStorage.setItem('tcad_builtin_presets_added', JSON.stringify([...added, ...missing.map(b => b.id)]));
    }
  } catch {}
  return presets;
};

const loadActivePresetId = (): string => {
  try { return localStorage.getItem('tcad_active_preset_id') || 'default'; } catch { return 'default'; }
};

export function useBeadState() {
  // ── Bead library ───────────────────────────────────────────────────────
  const [beadLibrary, setBeadLibrary] = useState<any[]>(DEFAULT_BEAD_LIBRARY);
  const [selectedBEs, setSelectedBEs] = useState<any[]>([]);
  const [beClipboard, setBeClipboard] = useState<any>(null);
  const [lineBeadClipboard, setLineBeadClipboard] = useState<any>(null);
  const [beadSettings, setBeadSettings] = useState({
    Y: { dsMultiplier: 1.0, color: '#ef4444' },
    Z: { dsMultiplier: 1.5, color: '#22c55e' },
    V: { dsMultiplier: 2.0, color: '#a855f7' },
  });

  // ── Polar grids ────────────────────────────────────────────────────────
  const [polarGrids, setPolarGrids] = useState<any[]>(() => loadPolarGrids());
  const [selectedPolarGridId, setSelectedPolarGridId] = useState<string | null>(null);

  // ── Picot connections and join selection ───────────────────────────────
  const [picotConnections, setPicotConnections] = useState<any[]>([]);
  const [selectedPicots, setSelectedPicots] = useState<any[]>([]);

  // ── Thread presets ─────────────────────────────────────────────────────
  const [threadPresets, setThreadPresets] = useState<any[]>(() => loadThreadPresets());
  const [activePresetId, setActivePresetId] = useState<string>(() => loadActivePresetId());

  return {
    beadLibrary, setBeadLibrary,
    selectedBEs, setSelectedBEs,
    beClipboard, setBeClipboard,
    lineBeadClipboard, setLineBeadClipboard,
    beadSettings, setBeadSettings,
    polarGrids, setPolarGrids,
    selectedPolarGridId, setSelectedPolarGridId,
    picotConnections, setPicotConnections,
    selectedPicots, setSelectedPicots,
    threadPresets, setThreadPresets,
    activePresetId, setActivePresetId,
  };
}
