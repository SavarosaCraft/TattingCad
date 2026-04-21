// useBeadState.ts — Bead library, polar grids, picot connections, thread presets

import { useState } from 'react';

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
  sample20DS10Regular: null,
  sample20DS10Short: null,
};

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
  try {
    const saved = localStorage.getItem('tcad_thread_presets');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [{ ...DEFAULT_THREAD_PRESET }];
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
