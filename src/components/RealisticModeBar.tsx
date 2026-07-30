// components/RealisticModeBar.tsx
//
// Properties-bar content shown while renderMode === 'realistic'. One of six
// mutually-exclusive branches of the top properties-bar mode dispatch in
// tattingindex.tsx (see architecture.md — properties-bar mode dispatch).
import React from 'react';
import { IconRenderRealistic, IconRenderSchematic } from './icons';

interface RealisticModeBarProps {
  onSwitchToSchematic: () => void;
  t: (key: string) => string;
}

export const RealisticModeBar: React.FC<RealisticModeBarProps> = ({ onSwitchToSchematic, t }) => (
  <div className="flex items-center gap-3 flex-wrap w-full py-1 top-toolbar-scalable">
    <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-amber-700 border border-amber-400">
      <IconRenderRealistic size={16} />
      <span className="font-bold text-sm text-white tracking-wide">{t('modeRealisticTitle')}</span>
    </div>
    <span className="text-gray-400 text-xs">{t('modeRealisticSub')}</span>
    <div className="ml-auto">
      <button
        onClick={onSwitchToSchematic}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium border border-gray-400"
        title={t('toolSwitchSchematic')}
      >
        <IconRenderSchematic size={14} /> {t('viewSwitchSchematic')}
      </button>
    </div>
  </div>
);
