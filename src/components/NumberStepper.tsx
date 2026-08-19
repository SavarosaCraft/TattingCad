// components/NumberStepper.tsx
//
// Shared numeric input used across property bars: [optional −jump][−step]
// [text field, supports typed expressions][+step][optional +jump].
//
// Consolidates two things that used to be separate, divergent
// implementations:
//   - PicotJoinModeBar.tsx's fold-property steppers (single-click-to-commit
//     +/- buttons flanking a text field).
//   - tattingindex.tsx's single-element rotation control (±90° jump buttons,
//     a text field supporting typed expressions via a local parseRotationExpr,
//     and press-and-hold ±1° nudge arrows that batch every intermediate tick
//     into ONE undo-history entry on release).
// Built after actually reading both, not assumed compatible — the two
// pieces differ in real ways (single-commit vs. hold-to-repeat-with-batched-
// history, clamped range vs. wraparound range), both handled here via props
// rather than picking one behavior and hoping it fits everywhere.
//
// The text field's input pattern (draft is null while idle, so the shown
// text is always just the live `value` prop directly — nothing to keep in
// sync, nothing that can fight an in-progress edit) matches the existing
// group-rotation field in MultiSelectSummaryBar.tsx. Seeded from the
// current value and select-all'd on focus; parsed and reset to null on
// blur or Enter.

import React, { useState, useRef } from 'react';

// Generalizes tattingindex.tsx's parseRotationExpr: same absolute / leading
// +or- relative / x-substitution / arithmetic-expression support, minus the
// baked-in mod-360 normalization (rotation's own wraparound is now applied
// separately via the `wrap` prop below, so this parser stays reusable for
// fields that shouldn't wrap, like a fold's departure angle).
// Operates in DISPLAY units — currentValue and the return value are both
// whatever's actually shown/typed, not raw stored units; the caller
// converts to raw before clamping/wrapping/committing.
export const parseNumberExpr = (input: string, currentDisplayValue: number): number | null => {
  const s = input.trim();
  if (!s) return null;
  let expr = s.replace(/[xX]/g, String(currentDisplayValue));
  if (/^[+\-]/.test(expr) && !/[xX]/.test(s)) {
    expr = String(currentDisplayValue) + expr;
  }
  if (!/^[\d\s.+\-*/()]+$/.test(expr)) return null;
  try {
    const result = new Function('"use strict"; return (' + expr + ')')();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return result;
  } catch { return null; }
};

const clampOrWrap = (v: number, min: number, max: number, wrap: boolean): number => {
  if (wrap) {
    const range = max - min;
    if (range <= 0) return min;
    return ((v - min) % range + range) % range + min;
  }
  return Math.min(max, Math.max(min, v));
};

const HOLD_REPEAT_INTERVAL_MS = 80;

export interface NumberStepperProps {
  label?: string; // omit for a bare inline control (e.g. the rotation field, which sits in a toolbar row with no leading label)
  value: number; // RAW — whatever's actually stored and read by the geometry/mutation code
  min: number; // RAW
  max: number; // RAW
  step: number; // RAW — both the inline −/+ buttons' single-click amount and the per-tick hold-to-repeat amount
  onCommit: (value: number, opts: { pushHistory: boolean }) => void; // value is RAW; pushHistory is false for intermediate hold-to-repeat ticks, true for every discrete action (a click, a typed commit) and the final tick on release
  decimals?: number; // display precision, default 2
  displayScale?: number; // raw * displayScale = shown number, default 1 (no transform)
  suffix?: string; // e.g. '°' or '%', appended after the text field
  wrap?: boolean; // true = wrap into [min, max) — e.g. rotation's 0-360; false (default) = clamp to [min, max]
  holdToRepeat?: boolean; // true = press-and-hold the −/+ buttons repeats every 80ms, batching one history entry on release (matches the original rotation nudge); false (default) = a single click commits once, immediately
  // Optional outer ±jump buttons (e.g. rotation's ±90° presets). Always
  // single-click, regardless of holdToRepeat — a jump repeating rapidly on
  // hold would be a much more aggressive interaction than anything asked
  // for, so it's deliberately not wired to the hold path.
  jump?: number; // RAW
  jumpMinusContent?: React.ReactNode; // defaults to "-{jump}" text if omitted
  jumpPlusContent?: React.ReactNode;
  jumpMinusTitle?: string;
  jumpPlusTitle?: string;
  stepMinusTitle?: string;
  stepPlusTitle?: string;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  label, value, min, max, step, onCommit,
  decimals = 2, displayScale = 1, suffix = '',
  wrap = false, holdToRepeat = false,
  jump, jumpMinusContent, jumpPlusContent, jumpMinusTitle, jumpPlusTitle,
  stepMinusTitle, stepPlusTitle,
}) => {
  const toDisplay = (raw: number) => raw * displayScale;
  const toRaw = (display: number) => display / displayScale;
  const formatDisplay = (raw: number) => toDisplay(raw).toFixed(decimals);

  const [draft, setDraft] = useState<string | null>(null);
  const displayText = draft !== null ? draft : formatDisplay(value);

  const commitDraft = (text: string) => {
    const parsedDisplay = parseNumberExpr(text, toDisplay(value));
    setDraft(null);
    if (parsedDisplay === null) return; // unparsable — silently keep the last committed value
    const finalRaw = parseFloat(clampOrWrap(toRaw(parsedDisplay), min, max, wrap).toFixed(6));
    onCommit(finalRaw, { pushHistory: true });
  };

  const commitDiscrete = (delta: number) => {
    const finalRaw = parseFloat(clampOrWrap(value + delta, min, max, wrap).toFixed(6));
    onCommit(finalRaw, { pushHistory: true });
  };

  // Tracks the running RAW value during a hold-to-repeat press, seeded from
  // the committed `value` prop at press-start and incremented LOCALLY each
  // tick rather than re-read from the `value` prop — React state updates
  // are asynchronous, so the prop wouldn't reflect the previous tick's
  // result in time for the next one. Mirrors the original nudge's own
  // nudgeAccumulatedDeltaRef for the same reason.
  const holdRunningValueRef = useRef(0);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTicksRef = useRef(0);

  const startHold = (delta: number) => {
    holdRunningValueRef.current = value;
    holdTicksRef.current = 0;
    const tick = () => {
      holdTicksRef.current += 1;
      holdRunningValueRef.current = parseFloat(
        clampOrWrap(holdRunningValueRef.current + delta, min, max, wrap).toFixed(6)
      );
      onCommit(holdRunningValueRef.current, { pushHistory: false });
    };
    tick(); // fires immediately on press — a quick tap still commits once, holding just continues
    holdIntervalRef.current = setInterval(tick, HOLD_REPEAT_INTERVAL_MS);
  };

  const endHold = () => {
    if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; }
    if (holdTicksRef.current > 0) {
      // One batched history entry for the whole press, not one per tick —
      // the entire reason holdToRepeat exists as a separate mode.
      onCommit(holdRunningValueRef.current, { pushHistory: true });
    }
    holdTicksRef.current = 0;
  };

  const stepButtonHandlers = (delta: number) => holdToRepeat
    ? {
        onMouseDown: () => startHold(delta),
        onMouseUp: endHold,
        onMouseLeave: endHold,
        onTouchStart: () => startHold(delta),
        onTouchEnd: endHold,
      }
    : { onClick: () => commitDiscrete(delta) };

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-300 whitespace-nowrap">
      {label && <span className="w-20 shrink-0">{label}</span>}
      {jump !== undefined && (
        <button
          type="button"
          onClick={() => commitDiscrete(-jump)}
          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-gray-200 text-xs flex items-center justify-center"
          title={jumpMinusTitle}
        >
          {jumpMinusContent ?? `-${jump}`}
        </button>
      )}
      <div className="flex items-center border border-gray-500 rounded overflow-hidden">
        <button
          type="button"
          {...stepButtonHandlers(-step)}
          className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs leading-none select-none"
          aria-label={stepMinusTitle ?? 'Decrease'}
          title={stepMinusTitle}
        >
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={displayText}
          onFocus={e => { setDraft(formatDisplay(value)); e.currentTarget.select(); }}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commitDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { commitDraft(e.currentTarget.value); e.currentTarget.blur(); }
            if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); }
          }}
          className="w-14 text-center bg-gray-800 text-gray-100 text-xs py-1 tabular-nums outline-none"
        />
        {suffix && <span className="text-gray-400 text-xs px-1 select-none">{suffix}</span>}
        <button
          type="button"
          {...stepButtonHandlers(step)}
          className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs leading-none select-none"
          aria-label={stepPlusTitle ?? 'Increase'}
          title={stepPlusTitle}
        >
          +
        </button>
      </div>
      {jump !== undefined && (
        <button
          type="button"
          onClick={() => commitDiscrete(jump)}
          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-gray-200 text-xs flex items-center justify-center"
          title={jumpPlusTitle}
        >
          {jumpPlusContent ?? `+${jump}`}
        </button>
      )}
    </div>
  );
};
