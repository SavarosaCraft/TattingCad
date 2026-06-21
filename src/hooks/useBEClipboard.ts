// src/hooks/useBEClipboard.ts
//
// Bead Element (BE) clipboard — copy, cut, paste bead configurations
// across picots in beading mode. Extracted from tattingindex.tsx.

import { useCallback } from 'react';

export interface UseBEClipboardParams {
  selectedBEs: Array<{ elementId: string; picotId: string }>;
  elementById: Map<string, any>;
  beClipboard: any | null;
  setBeClipboard: (val: any) => void;
  setElements: (fn: ((prev: any[]) => any[]) | any[]) => void;
}

export function useBEClipboard(p: UseBEClipboardParams) {

  const copyBEToClipboard = useCallback(() => {
    const lastBE = p.selectedBEs[p.selectedBEs.length - 1];
    if (!lastBE) return;
    const el = p.elementById.get(lastBE.elementId);
    const picot = el?.picots?.find(pic => pic.id === lastBE.picotId);
    if (!picot) return;
    p.setBeClipboard({
      beStructure: picot.beStructure,
      beIsJoint:   picot.beIsJoint,
      coreBeads:   [...(picot.coreBeads  || [null, null, null])],
      picotBeads:  [...(picot.picotBeads || [null, null, null])],
    });
  }, [p.selectedBEs, p.elementById]);

  const cutBEToClipboard = useCallback(() => {
    const lastBE = p.selectedBEs[p.selectedBEs.length - 1];
    if (!lastBE) return;
    const el = p.elementById.get(lastBE.elementId);
    const picot = el?.picots?.find(pic => pic.id === lastBE.picotId);
    if (!picot) return;
    p.setBeClipboard({
      beStructure: picot.beStructure,
      beIsJoint:   picot.beIsJoint,
      coreBeads:   [...(picot.coreBeads  || [null, null, null])],
      picotBeads:  [...(picot.picotBeads || [null, null, null])],
    });
    p.setElements(prev => prev.map(el2 => {
      const toReset = p.selectedBEs.filter(s => s.elementId === el2.id);
      if (toReset.length === 0) return el2;
      const newPicots = (el2.picots || []).map(pic =>
        toReset.some(s => s.picotId === pic.id)
          ? { ...pic, beStructure: 'core', beIsJoint: false, coreBeads: [null, null, null], picotBeads: [null, null, null] }
          : pic
      );
      return { ...el2, picots: newPicots };
    }));
  }, [p.selectedBEs, p.elementById]);

  const pasteBeClipboard = useCallback(() => {
    if (!p.beClipboard || p.selectedBEs.length === 0) return;
    p.setElements(prev => prev.map(el => {
      const toUpdate = p.selectedBEs.filter(s => s.elementId === el.id);
      if (toUpdate.length === 0) return el;
      const newPicots = (el.picots || []).map(pic =>
        toUpdate.some(s => s.picotId === pic.id)
          ? { ...pic,
              beStructure: p.beClipboard.beStructure,
              beIsJoint:   p.beClipboard.beIsJoint,
              coreBeads:   [...p.beClipboard.coreBeads],
              picotBeads:  [...p.beClipboard.picotBeads],
            }
          : pic
      );
      return { ...el, picots: newPicots };
    }));
  }, [p.beClipboard, p.selectedBEs]);

  return { copyBEToClipboard, cutBEToClipboard, pasteBeClipboard };
}
