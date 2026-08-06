// src/hooks/useProjectFile.ts
//
// Project file I/O — save, load, export SVG.
// Extracted from tattingindex.tsx.

import { useCallback, useRef, useEffect } from 'react';
import {
  showSaveDialog, showOpenDialog, showSaveSvgDialog,
  writeProjectFile, writeTextToFile, readProjectFile,
  addToRecents, generateThumbnailPng,
} from '../tauri/file';
import { serializeProject } from '../domain/patternOutput';
import { prepareSvgForExport } from '../render/svgExport';
import { sampleBezierPath } from '../geometry/bezier';

const DEFAULT_MATERIALS = [
  { id: 'default', name: 'Default Thread', color: '#FFFFFF', type: 'solid' },
];

// Tauri's fs/dialog plugins don't guarantee Error instances on rejection —
// they can reject with a plain string, or an object shaped differently than
// the DOM Error interface. Reading `.message` off a non-Error value silently
// yields undefined, and String.prototype.replace('{msg}', undefined) coerces
// that into the literal text "undefined" being shown to the user instead of
// any actual detail. This normalizes any thrown value into a real string.
const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error?.message && typeof error.message === 'string') return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
};

// Same reasoning applies to "is this a not-found error" detection — it also
// read error.message, so it silently failed (never matched) for any error
// that wasn't a proper Error instance, meaning a moved/deleted file would
// skip the friendly "file not found" message and fall through to the (until
// just now, broken) generic one instead.
const isFileNotFoundError = (error: any): boolean => {
  const msg = getErrorMessage(error).toLowerCase();
  return msg.includes('not found') || msg.includes('no such file') || error?.code === 'NOT_FOUND';
};

export interface UseProjectFileParams {
  // State values
  elements: any[];
  picotConnections: any[];
  camera: { x: number; y: number };
  zoom: number;
  dsWidth: number;
  bgColor: string;
  gridEnabled: boolean;
  customColors: string[];
  referenceImage: string | null;
  refImageProps: any;
  renderMode: string;
  patternNotes: string;
  materials: any[];
  rounds: any[];
  beadLibrary: any[];
  polarGrids: any[];
  selectedPolarGridId: string | null;
  threadPresets: any[];
  activePresetId: string | null;
  projectName: string;
  currentFilePath: string | null;
  // Refs
  historyIndexRef: React.RefObject<number>;
  canvasRef: React.RefObject<HTMLElement | null>;
  // Setters
  setElements: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setPicotConnections: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setCamera: (v: any) => void;
  setZoom: (v: number) => void;
  setDsWidth: (v: number) => void;
  setBgColor: (v: string) => void;
  setGridEnabled: (v: boolean) => void;
  setCustomColors: (v: string[]) => void;
  setReferenceImage: (v: string | null) => void;
  setRefImageProps: (v: any) => void;
  setProjectName: (v: string) => void;
  setRenderMode: (v: string) => void;
  setPatternNotes: (v: string) => void;
  setMaterials: (v: any[]) => void;
  setRounds: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setActiveRoundId: (v: string | null) => void;
  setPolarGrids: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setSelectedPolarGridId: (v: string | null) => void;
  setThreadPresets: (fn: ((prev: any[]) => any[]) | any[]) => void;
  setActivePresetId: (v: string | null) => void;
  setSelectedIds: (v: string[]) => void;
  setSelectedPicots: (v: any[]) => void;
  setHistory: (v: any[]) => void;
  setHistoryIndex: (v: number) => void;
  setCurrentFilePath: (v: string | null) => void;
  setLastSavedHistoryIndex: (v: number) => void;
  // Utilities
  getPicotPosition: (el: any, picot: any, baseOnly?: boolean) => any;
  showLoadMsg: (type: 'success' | 'error', text: string) => void;
  t: (key: string) => string;
}

export function useProjectFile(p: UseProjectFileParams) {

  const buildProjectData = useCallback((finalName: string) =>
    serializeProject({
      name: finalName,
      elements: p.elements,
      picotConnections: p.picotConnections,
      camera: p.camera,
      zoom: p.zoom,
      dsWidth: p.dsWidth,
      bgColor: p.bgColor,
      gridEnabled: p.gridEnabled,
      customColors: p.customColors,
      referenceImage: p.referenceImage,
      refImageProps: p.refImageProps,
      renderMode: p.renderMode,
      patternNotes: p.patternNotes,
      materials: p.materials,
      orderGroups: p.rounds,
      beadLibrary: p.beadLibrary,
      polarGrids: p.polarGrids,
      selectedPolarGridId: p.selectedPolarGridId,
      threadPresets: p.threadPresets,
      activePresetId: p.activePresetId,
    }),
    [p.elements, p.picotConnections, p.camera, p.zoom, p.dsWidth, p.bgColor,
     p.gridEnabled, p.customColors, p.referenceImage, p.refImageProps,
     p.renderMode, p.patternNotes, p.materials, p.rounds, p.beadLibrary,
     p.polarGrids, p.selectedPolarGridId, p.threadPresets, p.activePresetId]
  );

  // Ref updated every render so autosave always calls the latest closure
  const buildProjectDataRef = useRef(buildProjectData);
  useEffect(() => { buildProjectDataRef.current = buildProjectData; });

  const saveToPath = useCallback(async (filePath: string, finalName: string) => {
    await writeProjectFile(filePath, buildProjectData(finalName));
    const displayName = filePath.split(/[\\/]/).pop()?.replace(/\.json$/i, '') ?? finalName;
    const thumbPath = await generateThumbnailPng(p.elements, p.dsWidth, filePath);
    addToRecents(displayName, filePath, thumbPath);
    p.setLastSavedHistoryIndex(p.historyIndexRef.current);
  }, [buildProjectData, p.elements, p.dsWidth]);

  const performSave = useCallback(async (nameOverride?: string) => {
    const finalName = (nameOverride ?? p.projectName).trim() || 'Untitled Pattern';
    try {
      const filePath = await showSaveDialog(finalName);
      if (!filePath) return;
      p.setProjectName(finalName);
      await saveToPath(filePath, finalName);
      p.setCurrentFilePath(filePath);
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [p.projectName, saveToPath]);

  const saveProject = useCallback(() => {
    if (p.currentFilePath) {
      saveToPath(p.currentFilePath, p.projectName).catch(console.error);
    } else {
      performSave();
    }
  }, [p.currentFilePath, p.projectName, saveToPath, performSave]);

  const saveProjectAs = useCallback(() => {
    performSave();
  }, [performSave]);

  const applyProjectData = useCallback(async (projectData: any, filePath: string) => {
    console.log('[load] applyProjectData starting for', filePath);
    console.log('[load] top-level keys:', Object.keys(projectData || {}));

    if (!projectData.elements || !Array.isArray(projectData.elements)) {
      console.log('[load] REJECTED: projectData.elements missing or not an array. Got:', projectData.elements);
      p.showLoadMsg('error', p.t('loadErrMissingElements'));
      return;
    }
    console.log('[load] elements count:', projectData.elements.length,
      '— types present:', [...new Set(projectData.elements.map((el: any) => el?.type))]);

    // 'ghost' elements are a valid saved element type (ghost-array instances)
    // — they were missing from this whitelist, which meant any project using
    // the ghost-array feature at all would fail to load in its entirety.
    const VALID_TYPES = new Set(['ring', 'chain', 'line', 'ghost']);
    const invalidElements = projectData.elements.filter((el: any) =>
      !el.id || !el.type || !el.paths || !Array.isArray(el.paths) ||
      !VALID_TYPES.has(el.type)
    );
    if (invalidElements.length > 0) {
      console.log('[load] REJECTED:', invalidElements.length, 'invalid element(s). Details:');
      invalidElements.forEach((el: any, i: number) => {
        const reasons: string[] = [];
        if (!el.id) reasons.push('missing id');
        if (!el.type) reasons.push('missing type');
        if (!el.paths) reasons.push('missing paths');
        else if (!Array.isArray(el.paths)) reasons.push('paths is not an array (got ' + typeof el.paths + ')');
        if (el.type && !VALID_TYPES.has(el.type)) reasons.push(`type "${el.type}" not in whitelist`);
        console.log(`  [${i}] id=${el.id ?? '(none)'} type=${el.type ?? '(none)'} — ${reasons.join(', ')}`);
      });
      p.showLoadMsg('error', p.t('loadErrInvalidElements').replace('{n}', String(invalidElements.length)));
      return;
    }
    console.log('[load] all elements passed validation');

    if (projectData.camera && (typeof projectData.camera.x !== 'number' || typeof projectData.camera.y !== 'number')) {
      projectData.camera = { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
    }
    if (projectData.zoom && (typeof projectData.zoom !== 'number' || projectData.zoom <= 0)) {
      projectData.zoom = 1;
    }
    if (projectData.picotConnections && !Array.isArray(projectData.picotConnections)) {
      projectData.picotConnections = [];
    }

    const loadedConns: any[] = projectData.picotConnections || [];
    const connectedPicotKeys = new Set(
      loadedConns.flatMap((conn: any) =>
        (conn.picots || []).map((cp: any) => `${cp.elementId}::${cp.picotId}`)
      )
    );
    p.setElements((projectData.elements || []).map((el: any) => {
      let migrated = 'labelsInside' in el && !('labelOffset' in el)
        ? (({ labelsInside, ...rest }) => ({ ...rest, labelOffset: 8 }))(el)
        : el;
      // Legacy field rename (session 43 naming-collision fix): orderGroup -> roundId.
      // Old saves carry `orderGroup`; convert on load so the rest of the app only
      // ever sees the new field name.
      migrated = 'orderGroup' in migrated && !('roundId' in migrated)
        ? (({ orderGroup, ...rest }) => ({ ...rest, roundId: orderGroup }))(migrated)
        : migrated;
      if (migrated.picots?.some((pic: any) => pic.isJoint && !connectedPicotKeys.has(`${migrated.id}::${pic.id}`))) {
        migrated = {
          ...migrated,
          picots: migrated.picots.map((pic: any) =>
            pic.isJoint && !connectedPicotKeys.has(`${migrated.id}::${pic.id}`)
              ? { ...pic, isJoint: false }
              : pic
          ),
        };
      }
      return migrated;
    }));
    p.setPicotConnections(projectData.picotConnections || []);
    p.setCamera(projectData.camera || { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) });
    p.setZoom(projectData.zoom || 1);
    p.setDsWidth(projectData.dsWidth || 10);
    p.setBgColor(projectData.bgColor || '#1F2937');
    p.setGridEnabled(projectData.gridEnabled !== undefined ? projectData.gridEnabled : true);
    p.setCustomColors(projectData.customColors || []);
    p.setReferenceImage(projectData.referenceImage || null);
    p.setRefImageProps(projectData.refImageProps || { opacity: 0.5, rotation: 0, scale: 1, visible: true });
    p.setProjectName(projectData.name || 'Untitled Pattern');
    p.setRenderMode(projectData.renderMode || 'schematic');
    p.setPatternNotes(projectData.patternNotes || '');
    p.setMaterials(projectData.materials || DEFAULT_MATERIALS);
    p.setRounds(Array.isArray(projectData.orderGroups) ? projectData.orderGroups : []);
    p.setActiveRoundId(null);
    if (Array.isArray(projectData.polarGrids)) {
      p.setPolarGrids(prev => {
        const existing = new Set(prev.map((g: any) => g.id));
        return [...prev, ...projectData.polarGrids.filter((g: any) => !existing.has(g.id))];
      });
    }
    if (projectData.selectedPolarGridId) p.setSelectedPolarGridId(projectData.selectedPolarGridId);
    if (projectData.activeThreadPreset) {
      const pt = projectData.activeThreadPreset;
      p.setThreadPresets(prev => {
        const exists = prev.find((tp: any) => tp.id === pt.id);
        return exists ? prev.map((tp: any) => tp.id === pt.id ? pt : tp) : [...prev, pt];
      });
      p.setActivePresetId(pt.id);
      localStorage.setItem('tcad_active_preset_id', pt.id);
    }

    p.setSelectedIds([]);
    p.setSelectedPicots([]);
    p.setHistory([{ elements: projectData.elements || [], connections: projectData.picotConnections || [] }]);
    p.setHistoryIndex(0);
    p.setCurrentFilePath(filePath);

    const count = (projectData.elements || []).length;
    setTimeout(() => p.showLoadMsg('success', p.t('loadSuccess').replace('{n}', String(count))), 50);

    const displayName = filePath.split(/[\\/]/).pop()?.replace(/\.json$/i, '') ?? projectData.name ?? 'Project';
    const thumbPath = await generateThumbnailPng(projectData.elements || [], projectData.dsWidth || 10, filePath);
    addToRecents(displayName, filePath, thumbPath);
  }, [p.t]);

  const loadFromPath = useCallback(async (filePath: string) => {
    if (!filePath) {
      p.showLoadMsg('error', p.t('loadErrFileNotFound'));
      return;
    }
    try {
      const projectData = await readProjectFile(filePath);
      console.log('[load] readProjectFile succeeded for', filePath);
      applyProjectData(projectData, filePath);
    } catch (error: any) {
      console.log('[load] readProjectFile/applyProjectData threw:', error);
      if (isFileNotFoundError(error)) {
        p.showLoadMsg('error', p.t('loadErrFileNotFound'));
      } else {
        p.showLoadMsg('error', p.t('loadErrGeneric').replace('{msg}', getErrorMessage(error)));
      }
    }
  }, [applyProjectData, p.t]);

  const loadProject = useCallback(async () => {
    const filePath = await showOpenDialog();
    if (!filePath) return;
    try {
      const projectData = await readProjectFile(filePath);
      console.log('[load] readProjectFile succeeded for', filePath);
      applyProjectData(projectData, filePath);
    } catch (error: any) {
      console.log('[load] readProjectFile/applyProjectData threw:', error);
      if (isFileNotFoundError(error)) {
        p.showLoadMsg('error', p.t('loadErrFileNotFound'));
      } else {
        p.showLoadMsg('error', p.t('loadErrGeneric').replace('{msg}', getErrorMessage(error)));
      }
    }
  }, [applyProjectData, p.t]);

  const exportSVG = useCallback(async () => {
    if (!p.canvasRef.current) return;
    const svgElement = p.canvasRef.current.querySelector('svg');
    if (!svgElement) return;
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const expandBounds = (x: number, y: number) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    };
    p.elements.forEach(el => {
      if (el.isClosed && el.shapeStyle === 'circle' && el.center) {
        const r = (el.stitchCount * p.dsWidth) / (2 * Math.PI);
        expandBounds(el.center.x - r, el.center.y - r);
        expandBounds(el.center.x + r, el.center.y + r);
      }
      (el.paths || []).forEach(path =>
        sampleBezierPath(path, 20).forEach(pt => expandBounds(pt.x, pt.y))
      );
      (el.picots || []).forEach(pic => {
        const pos = p.getPicotPosition(el, pic, false);
        if (pos) expandBounds(pos.x, pos.y);
      });
    });
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 200; }

    const svgString = prepareSvgForExport(clonedSvg, {
      bounds: { minX, minY, maxX, maxY },
      elements: p.elements, rounds: p.rounds,
      patternNotes: p.patternNotes, dsWidth: p.dsWidth,
    });

    try {
      const filePath = await showSaveSvgDialog(p.projectName.replace(/[^a-z0-9]/gi, '_'));
      if (!filePath) return;
      await writeTextToFile(filePath, svgString);
    } catch (err) {
      console.error('SVG export failed:', err);
    }
  }, [p.elements, p.projectName, p.patternNotes, p.rounds, p.dsWidth]);

  return {
    buildProjectData,
    buildProjectDataRef,
    saveToPath,
    performSave,
    saveProject,
    saveProjectAs,
    applyProjectData,
    loadFromPath,
    loadProject,
    exportSVG,
  };
}
