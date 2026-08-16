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
// innerGap removed: the gap between the outer/inner arcs is controlled by
// the length difference the two arcs' heights already imply
// (totalLength/foldRatio), not a separate slider — nothing has read
// conn.innerGap since the footOffset-based spacing redesign.
// tangentA/tangentB added: each end's launch tangent blends between the
// picot's own perpendicular direction (1, matches the hand-sketched
// reference) and the old along-the-chord-biased direction (0, inherently
// loop-safe) — dial an end down to break a self-crossing twist that pure-
// perpendicular can produce when both picots' outward angles happen to
// converge toward the same side of the connection.
export interface FoldProps {
  totalLength: number;
  foldRatio: number;
  bendOuter: number;
  bendInner: number;
  tangentA: number;
  tangentB: number;
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
  onFoldPropertyChange: (connectionId: string, patch: Partial<FoldProps>) => void;
  t: (key: string) => string;
}

// Local-only: numeric stepper for fold properties — a click on +/- or a
// typed value commits immediately (each is one discrete action, unlike a
// slider drag which fires continuously), so there's no drag-vs-commit split
// to manage the way FoldSlider (the range-input version this replaced)
// needed. Switched from a range slider to this after live feedback: a
// slider's precision is bounded by its on-screen pixel width, so reaching a
// specific high value (e.g. a long totalLength) meant dragging right up
// against the track's end — typing the number directly has no such ceiling.
// min is still enforced (values below it are physically/mathematically
// meaningless for every one of these properties); max is only enforced
// where exceeding it is ALSO meaningless (foldRatio/bendOuter/bendInner are
// 0-1 proportions by construction — the geometry code clamps them
// regardless, so letting the field show an out-of-range number would just
// silently stop matching what's rendered). totalLength has no such
// mathematical ceiling — it's a physical thread length the user should be
// free to push arbitrarily high — so its max is left generous rather than
// clamped tightly.
//
// value/min/max/step/onCommit are all in RAW units — whatever's actually
// stored on the connection and read by the geometry code in
// tattingindex.tsx. displayScale/suffix let a caller show something more
// human-friendly (a raw totalLength of 196 shown as "19.6", a raw foldRatio
// of 0.5 shown as "50%") without changing the underlying stored value or
// touching the geometry code's units at all — the conversion happens only
// at this component's edges: raw is multiplied by displayScale on the way
// out to the screen, and divided by it on the way from a typed/clicked
// value back to what onCommit receives. step is still specified in RAW
// units (so callers reason in the same units as min/max); the on-screen
// step is derived as step * displayScale.
const FoldNumberStepper: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
  decimals?: number; // display precision — 0 for integer-stepped fields like Total length, defaults to 2
  displayScale?: number; // raw * displayScale = shown number; defaults to 1 (no transform)
  suffix?: string; // e.g. '%' — appended after the numeric field, defaults to none
}> = ({ label, value, min, max, step, onCommit, decimals = 2, displayScale = 1, suffix = '' }) => {
  const toDisplay = (raw: number) => raw * displayScale;
  const toRaw = (display: number) => display / displayScale;

  const [liveDisplay, setLiveDisplay] = useState(() => toDisplay(value));
  useEffect(() => { setLiveDisplay(toDisplay(value)); }, [value, displayScale]);

  const displayStep = step * displayScale;

  const commit = (rawCandidate: number) => {
    if (Number.isNaN(rawCandidate)) { setLiveDisplay(toDisplay(value)); return; }
    const clampedRaw = Math.min(max, Math.max(min, rawCandidate));
    // Round in RAW units (not display decimals) so repeated +step/-step
    // clicks can't accumulate binary floating-point drift regardless of
    // what displayScale happens to be.
    const roundedRaw = parseFloat(clampedRaw.toFixed(6));
    setLiveDisplay(toDisplay(roundedRaw));
    onCommit(roundedRaw);
  };

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-300 whitespace-nowrap">
      <span className="w-20 shrink-0">{label}</span>
      <div className="flex items-center border border-gray-500 rounded overflow-hidden">
        <button
          type="button"
          onClick={() => commit(toRaw(liveDisplay) - step)}
          className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs leading-none"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          value={parseFloat(liveDisplay.toFixed(decimals))}
          step={displayStep}
          onChange={e => setLiveDisplay(e.target.valueAsNumber)}
          onBlur={() => commit(toRaw(liveDisplay))}
          onKeyDown={e => {
            if (e.key === 'Enter') { commit(toRaw(liveDisplay)); (e.target as HTMLInputElement).blur(); }
          }}
          className="w-14 text-center bg-gray-800 text-gray-100 text-xs py-0.5 tabular-nums outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && <span className="text-gray-400 text-xs pr-1.5 select-none">{suffix}</span>}
        <button
          type="button"
          onClick={() => commit(toRaw(liveDisplay) + step)}
          className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs leading-none"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
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
}) => {
  const [copiedFoldProps, setCopiedFoldProps] = useState<FoldProps | null>(() => lastCopiedFoldProps);

  const handleCopyFold = () => {
    if (!activeFold) return;
    const { totalLength, foldRatio, bendOuter, bendInner, tangentA, tangentB } = activeFold;
    const props = { totalLength, foldRatio, bendOuter, bendInner, tangentA, tangentB };
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
          <FoldNumberStepper
            label={t('picotFoldTotalLength')}
            value={activeFold.totalLength}
            min={4} max={1000} step={5}
            decimals={1}
            displayScale={0.1}
            onCommit={v => onFoldPropertyChange(activeFold.id, { totalLength: v })}
          />
          <FoldNumberStepper
            label={t('picotFoldPosition')}
            value={activeFold.foldRatio}
            min={0.05} max={0.95} step={0.01}
            decimals={0}
            displayScale={100}
            suffix="%"
            onCommit={v => onFoldPropertyChange(activeFold.id, { foldRatio: v })}
          />
          <FoldNumberStepper
            label={t('picotFoldBendOuter')}
            value={activeFold.bendOuter}
            min={0} max={2} step={0.01}
            decimals={0}
            displayScale={100}
            onCommit={v => onFoldPropertyChange(activeFold.id, { bendOuter: v })}
          />
          <FoldNumberStepper
            label={t('picotFoldBendInner')}
            value={activeFold.bendInner}
            min={0} max={2} step={0.01}
            decimals={0}
            displayScale={100}
            onCommit={v => onFoldPropertyChange(activeFold.id, { bendInner: v })}
          />
          <FoldNumberStepper
            label={t('picotFoldTangentA')}
            value={activeFold.tangentA}
            min={0} max={1} step={0.01}
            onCommit={v => onFoldPropertyChange(activeFold.id, { tangentA: v })}
          />
          <FoldNumberStepper
            label={t('picotFoldTangentB')}
            value={activeFold.tangentB}
            min={0} max={1} step={0.01}
            onCommit={v => onFoldPropertyChange(activeFold.id, { tangentB: v })}
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
