// components/PicotJoinModeBar.tsx
//
// Properties-bar content shown while activeMode === 'picotJoin'. One of six
// mutually-exclusive branches of the top properties-bar mode dispatch in
// tattingindex.tsx (see architecture.md — properties-bar mode dispatch).
import React from 'react';
import { IconJoinPicots, IconLink, IconUnlink } from './icons';

interface PicotJoinModeBarProps {
  selectedPicotCount: number;
  onExit: () => void;
  onJoin: () => void;
  onBreak: () => void;
  t: (key: string) => string;
}

export const PicotJoinModeBar: React.FC<PicotJoinModeBarProps> = ({
  selectedPicotCount,
  onExit,
  onJoin,
  onBreak,
  t,
}) => (
  <div className="flex flex-col gap-1 w-full py-1 top-toolbar-scalable">
    {/* Row 1: mode banner + hint + exit */}
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-blue-700 border border-blue-400">
        <IconJoinPicots size={16} />
        <span className="font-bold text-sm text-white tracking-wide">{t('modePicotJoinTitle')}</span>
      </div>
      <span className="text-gray-400 text-xs">{t('modePicotJoinSub')}</span>
      <div className="ml-auto">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium border border-gray-400"
          title={t('toolExitPicotEdit')}
        >
          ✕ {t('picotExitBtn')}
        </button>
      </div>
    </div>
    {/* Row 2: Join / Cut — bigger, prominent */}
    <div className="flex items-center gap-2">
      <button
        onClick={onJoin}
        disabled={selectedPicotCount < 2}
        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold"
        title={t('toolJoinPicots')}
      >
        <IconLink size={20} /> {t('picotJoinBtn')}
      </button>
      <button
        onClick={onBreak}
        disabled={selectedPicotCount === 0}
        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold"
        title={t('toolBreakPicots')}
      >
        <IconUnlink size={20} /> {t('picotCutBtn')}
      </button>
    </div>
  </div>
);
