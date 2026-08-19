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
import React, { useState } from 'react';
import { IconJoinPicots, IconLink, IconUnlink } from './icons';
import { NumberStepper } from './NumberStepper';

// A fold connection's editable properties, as stored on the picotConnections
// entry (connectionType: 'fold'). Mirrors DEFAULT_FOLD_PROPS in
// useJoinActions.ts.
//
// Replaces the earlier totalLength/foldRatio/bendOuter/bendInner/tangentA/
// tangentB model entirely — a fold is one continuous strand of thread
// folded over itself, so "how much thread on each side" is naturally two
// independent lengths, not a total plus a ratio standing in for the same
// two numbers; and each end's departure direction is a literal angle off
// that picot's own perpendicular, not an abstract 0-1 blend between two
// different formulas.
export interface FoldProps {
  outerLength: number;
  innerLength: number;
  angleA: number;
  angleB: number;
}

export interface ActiveFoldConnection extends FoldProps {
  id: string;
}

// Module-level, not component state: the "last copied fold settings"
// clipboard should survive the bar unmounting when the user exits picotJoin
// mode and re-enters it later in the same session — same reasoning as
// clipboardRef for element copy/paste elsewhere in this codebase. A plain
// module variable is enough since only one PicotJoinModeBar instance is
// ever mounted at a time; each component instance's own useState below just
// mirrors it for re-renders.
let lastCopiedFoldProps: FoldProps | null = null;

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
  // pushHistory: true for every discrete commit (typing a value, a single
  // click); false for intermediate ticks of a press-and-hold nudge, so a
  // hold collapses into one undo entry on release instead of one per tick
  // — see NumberStepper.tsx and updateFoldConnection in useJoinActions.ts.
  onFoldPropertyChange: (connectionId: string, patch: Partial<FoldProps>, pushHistory?: boolean) => void;
  t: (key: string) => string;
}


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
}) => {
  const [copiedFoldProps, setCopiedFoldProps] = useState<FoldProps | null>(() => lastCopiedFoldProps);

  const handleCopyFold = () => {
    if (!activeFold) return;
    const { outerLength, innerLength, angleA, angleB } = activeFold;
    const props = { outerLength, innerLength, angleA, angleB };
    lastCopiedFoldProps = props;
    setCopiedFoldProps(props);
  };

  const handlePasteFold = () => {
    if (!activeFold || !copiedFoldProps) return;
    onFoldPropertyChange(activeFold.id, copiedFoldProps);
  };

  return (
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
          <NumberStepper
            label={t('picotFoldOuterLength')}
            value={activeFold.outerLength}
            min={0} max={Infinity} step={5}
            decimals={1}
            displayScale={0.1}
            holdToRepeat
            onCommit={(v, { pushHistory }) => onFoldPropertyChange(activeFold.id, { outerLength: v }, pushHistory)}
          />
          <NumberStepper
            label={t('picotFoldInnerLength')}
            value={activeFold.innerLength}
            min={0} max={Infinity} step={5}
            decimals={1}
            displayScale={0.1}
            holdToRepeat
            onCommit={(v, { pushHistory }) => onFoldPropertyChange(activeFold.id, { innerLength: v }, pushHistory)}
          />
          <NumberStepper
            label={t('picotFoldAngleA')}
            value={activeFold.angleA}
            min={-100} max={100} step={1}
            decimals={0}
            suffix="°"
            holdToRepeat
            onCommit={(v, { pushHistory }) => onFoldPropertyChange(activeFold.id, { angleA: v }, pushHistory)}
          />
          <NumberStepper
            label={t('picotFoldAngleB')}
            value={activeFold.angleB}
            min={-100} max={100} step={1}
            decimals={0}
            suffix="°"
            holdToRepeat
            onCommit={(v, { pushHistory }) => onFoldPropertyChange(activeFold.id, { angleB: v }, pushHistory)}
          />
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopyFold}
              className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium border border-gray-500"
              title={t('picotFoldCopySettings')}
            >
              {t('picotFoldCopyBtn')}
            </button>
            <button
              onClick={handlePasteFold}
              disabled={!copiedFoldProps}
              className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 text-xs font-medium border border-gray-500"
              title={t('picotFoldPasteSettings')}
            >
              {t('picotFoldPasteBtn')}
            </button>
          </div>
        </>
      )}
    </div>
  </div>
  );
};
