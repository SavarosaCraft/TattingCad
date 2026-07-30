// components/NotationRotationControls.tsx
//
// The rotate/flip controls + notation label offset slider + hide-label
// toggle + polar rotation center dropdown, from the per-element properties
// bar. Extracted from tattingindex.tsx (see architecture.md — properties-bar
// mode dispatch). All derived values (allLabelsHidden) and handlers stay
// with the caller; this only renders.
import React from 'react';
import { IconNotationM, IconNotationOn, IconNotationOff } from './icons';

interface PolarGridOption { id: string; name: string; }

interface NotationRotationControlsProps {
  rotateFlipControls: React.ReactNode;
  labelOffset: number;
  onLabelOffsetChange: (value: number) => void;
  allLabelsHidden: boolean;
  onToggleHideLabel: () => void;
  polarGrids: PolarGridOption[];
  selectedPolarRotationGridId: string | null | undefined;
  onPolarRotationGridChange: (value: string | null) => void;
  t: (key: string) => string;
}

export const NotationRotationControls: React.FC<NotationRotationControlsProps> = ({
  rotateFlipControls,
  labelOffset,
  onLabelOffsetChange,
  allLabelsHidden,
  onToggleHideLabel,
  polarGrids,
  selectedPolarRotationGridId,
  onPolarRotationGridChange,
  t,
}) => (
  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
    {/* Label removed - icons are self-explanatory */}
    {rotateFlipControls}

    {/* Notation label offset slider */}
    <div className="flex items-center gap-1" title={t('propNotationPos')}>
      <IconNotationM size={16} className="text-gray-400 shrink-0" />
      <input
        type="range"
        min="-25"
        max="45"
        step="1"
        value={labelOffset}
        onChange={e => onLabelOffsetChange(Number(e.target.value))}
        className="w-20 accent-blue-500"
        title={t('propNotationPos')}
      />
    </div>

    {/* Hide notation label toggle */}
    <button
      onClick={onToggleHideLabel}
      className={`px-2 py-1 rounded text-xs ${
        allLabelsHidden ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
      }`}
      title={t('propHideLabel')}
    >
      {allLabelsHidden ? <IconNotationOff size={16} /> : <IconNotationOn size={16} />}
    </button>

    {/* Polar rotation center dropdown — only shown when polar grids exist */}
    {polarGrids.length > 0 && (
      <>
        <div className="w-px h-5 bg-gray-600 mx-0.5" />
        <select
          value={selectedPolarRotationGridId || ''}
          onChange={e => onPolarRotationGridChange(e.target.value || null)}
          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
          title={t('propPolarRotation')}
          style={{ maxWidth: '110px' }}
        >
          <option value="">{t('propPolarRotationNone')}</option>
          {polarGrids.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </>
    )}
  </div>
);
