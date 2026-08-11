// components/PicotJoinModeBar.tsx
//
// Properties-bar content shown while activeMode === 'picotJoin'. One of six
// mutually-exclusive branches of the top properties-bar mode dispatch in
// tattingindex.tsx (see architecture.md — properties-bar mode dispatch).
//
// Session 47: added the Fold Picots feature. Two additions to what was here
// before:
//   - A sticky "Fold Picots" toggle next to Join/Cut. While armed, onJoin is
//     expected to create a fold connection instead of a regular one — that
//     decision is made by the caller (tattingindex.tsx), this component just
//     renders the toggle state and forwards the click.
//   - A second row that shows fold-property sliders whenever activeFold is
//     non-null (either just-created, or selected for editing — see design
//     notes: clicking either picot of an existing fold auto-selects its
//     partner and populates activeFold). Row 2 always renders at a fixed
//     height, populated or not, so switching a fold selection on/off never
//     resizes the bar and never jumps the canvas underneath it.
import React, { useState, useEffect } from 'react';
import { IconJoinPicots, IconLink, IconUnlink } from './icons';

// A fold connection's editable properties, as stored on the picotConnections
// entry (connectionType: 'fold'). Mirrors DEFAULT_FOLD_PROPS in
// useJoinActions.ts.
export interface FoldProps {
  totalLength: number;
  foldRatio: number;
  bendOuter: number;
  bendInner: number;
  innerGap: number;
}

export interface ActiveFoldConnection extends FoldProps {
  id: string;
}

interface PicotJoinModeBarProps {
  onExit: () => void;
  onJoin: () => void;
  onBreak: () => void;
  joinDisabled: boolean;
  breakDisabled: boolean;
  foldModeArmed: boolean;
  onToggleFoldMode: () => void;
  // Non-null when there's a fold connection to show sliders for — either the
  // one just created by onJoin while foldModeArmed, or one the user selected
  // by clicking a picot that's already folded. Null hides row 2's content
  // (row 2 itself still renders, just empty, to hold its height).
  activeFold: ActiveFoldConnection | null;
  onFoldPropertyChange: (connectionId: string, patch: Partial<FoldProps>) => void;
  t: (key: string) => string;
}

// Local-only: gives the slider a responsive drag feel (thumb moves every
// frame) while only committing to history once, on release — dragging a
// range input fires onChange continuously, and committing every one of
// those ticks through pushHistoryState would flood the 50-entry undo stack
// with intermediate drag positions instead of one final value.
const FoldSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
  decimals?: number; // display precision — 0 for integer-stepped sliders like Total length, defaults to 2
}> = ({ label, value, min, max, step, onCommit, decimals = 2 }) => {
  const [live, setLive] = useState(value);
  useEffect(() => { setLive(value); }, [value]);
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-300 whitespace-nowrap">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={live}
        onChange={e => setLive(parseFloat(e.target.value))}
        onMouseUp={() => onCommit(live)}
        onTouchEnd={() => onCommit(live)}
        onKeyUp={() => onCommit(live)}
        className="w-16 accent-purple-500"
      />
      <span className="w-10 shrink-0 text-right tabular-nums">{live.toFixed(decimals)}</span>
    </label>
  );
};

export const PicotJoinModeBar: React.FC<PicotJoinModeBarProps> = ({
  onExit,
  onJoin,
  onBreak,
  joinDisabled,
  breakDisabled,
  foldModeArmed,
  onToggleFoldMode,
  activeFold,
  onFoldPropertyChange,
  t,
}) => (
  <div className="flex flex-col gap-1 w-full py-1 top-toolbar-scalable">
    {/* Row 1: banner + hint + Join/Cut/Fold + exit — consolidated into one
        row (session 47) so row 2 is free to be the always-reserved fold-
        slider row without pushing the bar to 3 rows tall. */}
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-blue-700 border border-blue-400">
        <IconJoinPicots size={16} />
        <span className="font-bold text-sm text-white tracking-wide">{t('modePicotJoinTitle')}</span>
      </div>
      <span className="text-gray-400 text-xs">{t('modePicotJoinSub')}</span>

      <button
        onClick={onJoin}
        disabled={joinDisabled}
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold"
        title={t('toolJoinPicots')}
      >
        <IconLink size={18} /> {t('picotJoinBtn')}
      </button>
      <button
        onClick={onBreak}
        disabled={breakDisabled}
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold"
        title={t('toolBreakPicots')}
      >
        <IconUnlink size={18} /> {t('picotCutBtn')}
      </button>
      <button
        onClick={onToggleFoldMode}
        aria-pressed={foldModeArmed}
        className={
          "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold border " +
          (foldModeArmed
            ? "bg-purple-700 hover:bg-purple-600 border-purple-300 text-white"
            : "bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-200")
        }
        title={t('toolFoldPicots')}
      >
        {t('picotFoldBtn')}
      </button>

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

    {/* Row 2: fold-property sliders — always rendered (fixed min-height) so
        the bar's total height never changes between "no fold selected" and
        "editing a fold." Empty but present when activeFold is null. */}
    <div className="flex items-center gap-3 flex-wrap min-h-[26px]">
      {activeFold && (
        <>
          <span className="text-xs font-bold text-purple-300 uppercase tracking-wide shrink-0">
            {t('picotFoldPropsLabel')}
          </span>
          <FoldSlider
            label={t('picotFoldTotalLength')}
            value={activeFold.totalLength}
            min={4} max={200} step={1}
            decimals={0}
            onCommit={v => onFoldPropertyChange(activeFold.id, { totalLength: v })}
          />
          <FoldSlider
            label={t('picotFoldPosition')}
            value={activeFold.foldRatio}
            min={0.05} max={0.95} step={0.01}
            onCommit={v => onFoldPropertyChange(activeFold.id, { foldRatio: v })}
          />
          <FoldSlider
            label={t('picotFoldBendOuter')}
            value={activeFold.bendOuter}
            min={0} max={1} step={0.01}
            onCommit={v => onFoldPropertyChange(activeFold.id, { bendOuter: v })}
          />
          <FoldSlider
            label={t('picotFoldBendInner')}
            value={activeFold.bendInner}
            min={0} max={1} step={0.01}
            onCommit={v => onFoldPropertyChange(activeFold.id, { bendInner: v })}
          />
          <FoldSlider
            label={t('picotFoldInnerGap')}
            value={activeFold.innerGap}
            min={0} max={10} step={0.1}
            onCommit={v => onFoldPropertyChange(activeFold.id, { innerGap: v })}
          />
        </>
      )}
    </div>
  </div>
);
