// components/ShapeAndSqueezeControls.tsx
//
// Shape toggle (Teardrop/Circle/Josephine Knot) + squeeze sliders (the
// 3-slider split-ring variant or the single-slider regular-ring variant),
// from the per-element properties bar. Extracted from tattingindex.tsx (see
// architecture.md — properties-bar mode dispatch). Only rendered when
// selectedElement.isClosed.
//
// This section touches notation/paths/rotation directly (shape toggle
// rewrites notation and regenerates paths; squeeze sliders regenerate paths
// on every change) — moved verbatim, none of the update logic was changed
// or routed through updateElement/updateSelected. Those helpers are for
// plain property patches only; this is exactly the kind of case
// architecture.md's elementUpdates.ts note says to leave alone.
import React from 'react';
import { IconShapeTeardrop, IconShapeCircle } from './icons';
import { createTeardropPath, createCirclePath, applyRotationToPathData, resetElementShape, rebuildSplitRingInPlace } from '../geometry/paths';
import { elementPathLength } from '../geometry/stitchGeometry';

interface ShapeAndSqueezeControlsProps {
  selectedElement: any;
  dsWidth: number;
  setElements: (fn: (prev: any[]) => any[]) => void;
  pushHistoryState: (els: any[], conns: any[], groups?: any[]) => void;
  elementsRef: React.RefObject<any[]>;
  picotConnectionsRef: React.RefObject<any[]>;
  roundsRef: React.RefObject<any[]>;
  toggleShape: () => void;
  convertToJosephineKnot: () => void;
  isInteractingRef: React.RefObject<boolean>;
  t: (key: string) => string;
}

export const ShapeAndSqueezeControls: React.FC<ShapeAndSqueezeControlsProps> = ({
  selectedElement,
  dsWidth,
  setElements,
  pushHistoryState,
  elementsRef,
  picotConnectionsRef,
  roundsRef,
  toggleShape,
  convertToJosephineKnot,
  isInteractingRef,
  t,
}) => {
  if (!selectedElement.isClosed) return null;

  // Shared mouse/touch events for every squeeze slider — extracted
  // because: (a) 4 sliders had identical onMouseDown/Up/Touch handlers,
  // (b) the handlers must mark isInteractingRef so the canvas doesn't
  //     start a drag during squeeze, and (c) history is pushed explicitly
  //     on release rather than via needsHistoryPushRef — that flag's only
  //     consumer is the canvas SVG's own onMouseUp (useInputHandlers.ts),
  //     which never fires for a property-bar slider release, so the final
  //     dragged value was silently never getting its own undo entry.
  // Squeeze "Reset" buttons (split-ring and regular-ring variants) — both
  // produce exactly what resetElementShape (paths.ts) does for closed
  // shapes, so they call it instead of keeping their own copies of the same
  // defaults. One deliberate difference is preserved: resetElementShape is
  // the full "Reset Transform" and also clears polarRotationGridId (unlinks
  // the element from a polar grid pivot); a squeeze reset never did that,
  // so the element's existing link is kept here.
  const resetSqueeze = () => {
    setElements(prev => prev.map(el => {
      if (el.id !== selectedElement.id) return el;
      const patch = resetElementShape(el, dsWidth);
      return patch ? { ...el, ...patch, polarRotationGridId: el.polarRotationGridId } : el;
    }));
  };

  const squeezeSliderEvents = {
    onMouseDown: () => { isInteractingRef.current = true; },
    onTouchStart: () => { isInteractingRef.current = true; },
    onMouseUp: () => { isInteractingRef.current = false; pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current); },
    onTouchEnd: () => { isInteractingRef.current = false; pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current); },
  };

  return (
    <>
      {/* Shape radio buttons - hide for split rings */}
      {!selectedElement.isSplitRing && (
        <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
          <label className="text-xs text-gray-400 hide-label-mobile">{t('propShape')}</label>
          <div className="flex rounded overflow-hidden border border-gray-600">
            {/* Teardrop */}
            <button
              onClick={() => {
                if (/^jk:/i.test(selectedElement.notation || '')) {
                  // Was JK — rewrite notation to r: and toggle to teardrop
                  const notation = (selectedElement.notation || '').replace(/^jk:/i, 'r:');
                  setElements(prev => prev.map(el => {
                    if (el.id !== selectedElement.id) return el;
                    // Length for the shape it becomes (a teardrop uses its stored end
                    // allowance — 0 after Convert to JK, which clears it).
                    const targetLength = elementPathLength({ ...el, notation, shapeStyle: 'teardrop' }, dsWidth);
                    const paths = applyRotationToPathData(el, createTeardropPath(el.center.x, el.center.y, targetLength, el.squeeze || 0)).paths;
                    return { ...el, notation, shapeStyle: 'teardrop', paths };
                  }));
                  pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current);
                } else if (selectedElement.shapeStyle !== 'teardrop') {
                  toggleShape();
                }
              }}
              className={`px-2 py-1 flex items-center gap-1 text-xs ${
                selectedElement.shapeStyle !== 'circle' && !/^jk:/i.test(selectedElement.notation || '')
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              title={t('propShapeTeardrop')}
            >
              <IconShapeTeardrop size={14} />
            </button>
            {/* Circle */}
            <button
              onClick={() => {
                if (/^jk:/i.test(selectedElement.notation || '')) {
                  const notation = (selectedElement.notation || '').replace(/^jk:/i, 'r:');
                  setElements(prev => prev.map(el => {
                    if (el.id !== selectedElement.id) return el;
                    const targetLength = elementPathLength({ ...el, notation, shapeStyle: 'circle' }, dsWidth); // circle: always 0 allowance
                    const paths = applyRotationToPathData(el, createCirclePath(el.center.x, el.center.y, targetLength, el.squeeze || 0)).paths;
                    return { ...el, notation, shapeStyle: 'circle', paths };
                  }));
                  pushHistoryState(elementsRef.current, picotConnectionsRef.current, roundsRef.current);
                } else if (selectedElement.shapeStyle !== 'circle') {
                  toggleShape();
                }
              }}
              className={`px-2 py-1 flex items-center gap-1 text-xs border-l border-gray-600 ${
                selectedElement.shapeStyle === 'circle' && !/^jk:/i.test(selectedElement.notation || '')
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              title={t('propShapeCircle')}
            >
              <IconShapeCircle size={14} />
            </button>
            {/* Josephine Knot */}
            <button
              onClick={convertToJosephineKnot}
              className={`px-2 py-1 flex items-center gap-1 text-xs border-l border-gray-600 ${
                /^jk:/i.test(selectedElement.notation || '')
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              title={t('jkConvertTitle')}
            >
              JK
            </button>
          </div>
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
            {...squeezeSliderEvents}
            onChange={(e) => {
              const squeeze = parseFloat(e.target.value);
              setElements(prev => prev.map(el => {
                if (el.id !== selectedElement.id) return el;
                // In place (keeps position/rotation/flip — see rebuildSplitRingInPlace)
                return { ...el, squeeze, paths: rebuildSplitRingInPlace(el, dsWidth, { squeeze }) };
              }));
            }}
            className="w-14"
          />
          <span className="text-xs text-gray-400 w-6">{(selectedElement.squeeze ?? 0.25).toFixed(2)}</span>
          <label className="text-xs text-gray-400 hide-label-mobile">{t('propSqueezeCA')}</label>
          <input
            type="range" min="0" max="3" step="0.05"
            value={selectedElement.squeezeCA ?? 0.75}
            {...squeezeSliderEvents}
            onChange={(e) => {
              const squeezeCA = parseFloat(e.target.value);
              setElements(prev => prev.map(el => {
                if (el.id !== selectedElement.id) return el;
                return { ...el, squeezeCA, paths: rebuildSplitRingInPlace(el, dsWidth, { squeezeCA }) };
              }));
            }}
            className="w-14"
          />
          <span className="text-xs text-gray-400 w-6">{(selectedElement.squeezeCA ?? 0.75).toFixed(2)}</span>
          <label className="text-xs text-gray-400 hide-label-mobile">{t('propsqueezeCB')}</label>
          <input
            type="range" min="0" max="3" step="0.05"
            value={selectedElement.squeezeCB ?? 0.75}
            {...squeezeSliderEvents}
            onChange={(e) => {
              const squeezeCB = parseFloat(e.target.value);
              setElements(prev => prev.map(el => {
                if (el.id !== selectedElement.id) return el;
                return { ...el, squeezeCB, paths: rebuildSplitRingInPlace(el, dsWidth, { squeezeCB }) };
              }));
            }}
            className="w-14"
          />
          <span className="text-xs text-gray-400 w-6">{(selectedElement.squeezeCB ?? 0.75).toFixed(2)}</span>
          <button
            onClick={resetSqueeze}
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
            {...squeezeSliderEvents}
            onChange={(e) => {
              const squeeze = parseFloat(e.target.value);
              setElements(prev => prev.map(el => {
                if (el.id !== selectedElement.id) return el;
                const targetLength = elementPathLength(el, dsWidth); // incl. end allowance (0 for circles)
                const newPathData = el.shapeStyle === 'circle'
                  ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
                  : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
                return { ...el, squeeze, paths: applyRotationToPathData({ ...el, squeeze }, newPathData).paths };
              }));
            }}
            className="w-24"
            disabled={selectedElement.shapeStyle === 'circle'}
          />
          <span className="text-xs text-gray-400 w-8">{(selectedElement.squeeze || 0).toFixed(1)}</span>
          <button
            onClick={resetSqueeze}
            className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
            title={t('propResetSqueeze')}
            disabled={selectedElement.shapeStyle === 'circle'}
          >{t('propResetBtn')}</button>
        </div>
      )}
    </>
  );
};
