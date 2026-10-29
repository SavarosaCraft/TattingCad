// useProjectState.ts — Project file and rendering state
// Covers file path, project name, save tracking, render mode, notation errors.

import { useState } from 'react';

export function useProjectState() {
  const [projectName, setProjectName] = useState('Untitled Pattern');
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  // rev (useHistoryActions.ts) of the history entry that was last saved or
  // opened; -1 = this content was never saved (resumed autosave). Session 58:
  // replaced lastSavedHistoryIndex, which compared array indices.
  const [lastSavedRev, setLastSavedRev] = useState(0);

  const [renderMode, setRenderMode] = useState('schematic');
  const [bakedRealisticSVG, setBakedRealisticSVG] = useState<string | null>(null);

  const [notationError, setNotationError] = useState<string | null>(null);
  const [draftNotation, setDraftNotation] = useState<{ elementId: string | number; value: string } | null>(null);

  return {
    projectName, setProjectName,
    currentFilePath, setCurrentFilePath,
    lastSavedRev, setLastSavedRev,
    renderMode, setRenderMode,
    bakedRealisticSVG, setBakedRealisticSVG,
    notationError, setNotationError,
    draftNotation, setDraftNotation,
  };
}
