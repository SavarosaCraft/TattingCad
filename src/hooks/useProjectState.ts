// useProjectState.ts — Project file and rendering state
// Covers file path, project name, save tracking, render mode, notation errors.

import { useState } from 'react';

export function useProjectState() {
  const [projectName, setProjectName] = useState('Untitled Pattern');
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [lastSavedHistoryIndex, setLastSavedHistoryIndex] = useState(0);

  const [renderMode, setRenderMode] = useState('schematic');
  const [bakedRealisticSVG, setBakedRealisticSVG] = useState<string | null>(null);

  const [notationError, setNotationError] = useState<string | null>(null);
  const [draftNotation, setDraftNotation] = useState<{ elementId: string | number; value: string } | null>(null);

  return {
    projectName, setProjectName,
    currentFilePath, setCurrentFilePath,
    lastSavedHistoryIndex, setLastSavedHistoryIndex,
    renderMode, setRenderMode,
    bakedRealisticSVG, setBakedRealisticSVG,
    notationError, setNotationError,
    draftNotation, setDraftNotation,
  };
}
