// components/BeadingModeBar.tsx
//
// Properties-bar content shown while activeMode === 'beading'. One of six
// mutually-exclusive branches of the top properties-bar mode dispatch in
// tattingindex.tsx (see architecture.md — properties-bar mode dispatch).
// Unlike the other mode bars, this one is genuinely self-contained enough
// to move its local derivations (STRUCTURES, updateBEPicot, the BeadSlot
// sub-component) wholesale — none of it is referenced outside this branch.
import React from 'react';
import {
  IconBeadMode, IconBeadCore, IconBeadCorePicot, IconBeadCoreBeaded,
  IconBeadSpike, IconBeadSuspended, IconLink, IconCopy, IconCut, IconPaste,
} from './icons';

interface BeadSelection { elementId: string; picotId: string; }
interface BeadLibraryEntry { id: string; name: string; color: string; }

interface BeadingModeBarProps {
  selectedBEs: BeadSelection[];
  elementById: Map<string, any>;
  setElements: (fn: (prev: any[]) => any[]) => void;
  beadLibrary: BeadLibraryEntry[];
  beClipboard: any;
  copyBEToClipboard: () => void;
  cutBEToClipboard: () => void;
  pasteBeClipboard: () => void;
  onExit: () => void;
  onOpenBeadLibrary: () => void;
  t: (key: string) => string;
}

export const BeadingModeBar: React.FC<BeadingModeBarProps> = ({
  selectedBEs,
  elementById,
  setElements,
  beadLibrary,
  beClipboard,
  copyBEToClipboard,
  cutBEToClipboard,
  pasteBeClipboard,
  onExit,
  onOpenBeadLibrary,
  t,
}) => {
  // Use last selected as reference for property display; updates apply to all
  const lastBERef = selectedBEs[selectedBEs.length - 1] || null;
  const bePicot = (() => {
    if (!lastBERef) return null;
    const el = elementById.get(lastBERef.elementId);
    return el?.picots?.find(p => p.id === lastBERef.picotId) || null;
  })();

  const updateBEPicot = (updates: Record<string, any>) => {
    if (selectedBEs.length === 0) return;
    setElements(prev => prev.map(el => {
      const toUpdate = selectedBEs.filter(s => s.elementId === el.id);
      if (toUpdate.length === 0) return el;
      const newPicots = (el.picots || []).map(p =>
        toUpdate.some(s => s.picotId === p.id) ? { ...p, ...updates } : p
      );
      // Persist configs so notation edits don't wipe them
      return { ...el, picots: newPicots };
    }));
  };

  const STRUCTURES = [
    { id: 'core', icon: <IconBeadCore size={16} />, desc: 'Core only' },
    { id: 'core+picot', icon: <IconBeadCorePicot size={16} />, desc: 'Core + plain picot' },
    { id: 'core+beaded', icon: <IconBeadCoreBeaded size={16} />, desc: 'Core + beaded picot' },
    { id: 'spike', icon: <IconBeadSuspended size={16} />, desc: 'Suspended' },
    { id: 'suspended', icon: <IconBeadSpike size={16} />, desc: 'Beaded picot' },
  ];

  const coreBeadsEnabled = bePicot && bePicot.beStructure !== 'suspended' && bePicot.beStructure !== 'beaded';
  const picotBeadsEnabled = bePicot && (bePicot.beStructure === 'core+beaded' || bePicot.beStructure === 'spike' || bePicot.beStructure === 'suspended');

  const BeadSlot = ({ slotIdx, beadIds, field }: { slotIdx: number; beadIds: (string | null)[] | undefined; field: string }) => {
    const currentId = (beadIds || [])[slotIdx];
    const bead = beadLibrary.find(b => b.id === currentId);
    return (
      <div className="flex items-center gap-1">
        {bead && <div className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500" style={{ backgroundColor: bead.color }} />}
        <select
          value={currentId || ''}
          onChange={e => { const ids = [...(beadIds || [null, null, null])]; ids[slotIdx] = e.target.value || null; updateBEPicot({ [field]: ids }); }}
          className="bg-gray-700 text-white text-xs rounded px-1 py-0.5 border border-gray-600 max-w-28"
          style={{ touchAction: 'manipulation' }}
        >
          <option value="">— none —</option>
          {beadLibrary.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1 w-full py-1 top-toolbar-scalable">

      {/* ── Row 1: Mode banner + structure buttons + join + exit ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mode banner */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-purple-700 border border-purple-400 flex-shrink-0">
          <IconBeadMode size={16} />
          <span className="font-bold text-sm text-white tracking-wide">{t('modeBeadingTitle')}</span>
        </div>

        {/* Selection hint */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedBEs.length === 0 && <span className="text-gray-400 text-xs">{t('beadSelectHint')}</span>}
          {selectedBEs.length > 1 && <span className="text-purple-300 text-xs">{t('beadSelectedCount').replace('{n}', String(selectedBEs.length))}</span>}
        </div>

        {bePicot && <>
          {/* Structure buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-gray-400 text-xs mr-1">{t('modeBeadStructure')}</span>
            {STRUCTURES.map(s => (
              <button key={s.id}
                onClick={() => updateBEPicot({ beStructure: s.id })}
                title={s.desc}
                className={`px-2 py-0.5 rounded text-xs font-mono border top-toolbar-scalable ${bePicot.beStructure === s.id ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                style={{ touchAction: 'manipulation' }}
              >{s.icon}</button>
            ))}
          </div>

          {/* Joint toggle */}
          <button
            onClick={() => updateBEPicot({ beIsJoint: !bePicot.beIsJoint })}
            title={t('connectableJoinPoint')}
            className={`px-2 py-0.5 rounded text-xs border flex-shrink-0 top-toolbar-scalable ${bePicot.beIsJoint ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}
            style={{ touchAction: 'manipulation' }}
          ><IconLink size={14} /></button>
        </>}

        {/* Copy / Cut / Paste BE config — always visible in beading mode so clipboard
            state is readable even when no BE is selected yet.
            Copy/Cut are disabled when no BE is focused; Paste is disabled when the
            clipboard is empty OR there is no selected target BE. */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-1 border-l border-gray-600 pl-2">
          <button
            onClick={copyBEToClipboard}
            disabled={!bePicot}
            title={bePicot ? t('beCopySetup') : 'Select a BE first'}
            className={`px-2 py-0.5 rounded text-xs border ${bePicot ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'}`}
            style={{ touchAction: 'manipulation' }}
          ><IconCopy size={13} /></button>
          <button
            onClick={cutBEToClipboard}
            disabled={!bePicot}
            title={bePicot ? t('beCutSetup') : 'Select a BE first'}
            className={`px-2 py-0.5 rounded text-xs border ${bePicot ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'}`}
            style={{ touchAction: 'manipulation' }}
          ><IconCut size={13} /></button>
          <button
            onClick={pasteBeClipboard}
            disabled={!beClipboard || selectedBEs.length === 0}
            title={
              !beClipboard
                ? 'Paste (nothing copied yet)'
                : selectedBEs.length === 0
                  ? 'Select a target BE first'
                  : `Paste: ${beClipboard.beStructure}${beClipboard.beIsJoint ? ' + joint' : ''}`
            }
            className={`px-2 py-0.5 rounded text-xs border ${beClipboard && selectedBEs.length > 0 ? 'bg-purple-800 border-purple-600 text-purple-200 hover:bg-purple-700' : 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'}`}
            style={{ touchAction: 'manipulation' }}
          ><IconPaste size={13} /></button>
        </div>

        {/* Exit — always far right */}
        <div className="ml-auto flex-shrink-0">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium border border-gray-400"
            title={t('toolExitBeadEdit')}
          >
            ✕ {t('picotExitBtn')}
          </button>
        </div>
      </div>

      {/* ── Row 2: Bead dropdowns (only when a picot is selected) ── */}
      {bePicot && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Core bead */}
          {coreBeadsEnabled && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-gray-400 text-xs">{t('modeBeadCore')}</span>
              <BeadSlot slotIdx={0} beadIds={bePicot.coreBeads} field="coreBeads" />
            </div>
          )}

          {/* Picot beads (up to 3) */}
          {picotBeadsEnabled && (
            <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
              <span className="text-gray-400 text-xs">{t('modeBeadPicot')}</span>
              {[0, 1, 2].map(i => (
                <BeadSlot key={i} slotIdx={i} beadIds={bePicot.picotBeads} field="picotBeads" />
              ))}
            </div>
          )}

          {/* Open bead library */}
          <button
            onClick={onOpenBeadLibrary}
            className="px-2 py-0.5 bg-purple-800 hover:bg-purple-700 text-purple-200 text-xs rounded border border-purple-600 flex-shrink-0"
            title={t('toolManageBeadLibrary')}
          >{t('modeBeadLibraryBtn')}</button>
        </div>
      )}

    </div>
  );
};
