// usePatternState.ts — Core pattern domain state
// Elements, history, camera, zoom, materials, language.
// Most entangled group — changes here affect the whole app.

import { useState } from 'react';

export const DEFAULT_MATERIALS = [
  { id: 'default', name: 'Default', color: '#FFFFFF', isGradient: false },
];

export const LANGUAGES_FALLBACK: Record<string, string> = {
  en: 'English',
};

export function usePatternState() {
  // ── Core elements ──────────────────────────────────────────────────────
  const [elements, setElements] = useState<any[]>([]);
  const [dsWidth, setDsWidth] = useState(10);

  // ── Camera and zoom ────────────────────────────────────────────────────
  const [camera, setCamera] = useState(() => ({
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2),
  }));
  const [zoom, setZoom] = useState(1.8);

  // ── Pattern content ────────────────────────────────────────────────────
  const [patternNotes, setPatternNotes] = useState('');
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);

  // ── Localisation ───────────────────────────────────────────────────────
  const [language, setLanguage] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('tcad_language');
      if (saved) return saved;
      const nav = navigator.language?.split('-')[0] ?? 'en';
      return nav || 'en';
    } catch { return 'en'; }
  });
  const [extraTranslations, setExtraTranslations] = useState<Record<string, Record<string, string>>>({});
  const [availableLanguages, setAvailableLanguages] = useState<Record<string, string>>(LANGUAGES_FALLBACK);

  // ── History ────────────────────────────────────────────────────────────
  const [history, setHistory] = useState([{ elements: [], connections: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  return {
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
  };
}
