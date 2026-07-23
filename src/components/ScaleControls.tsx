// ScaleControls.tsx
// Shared "Scale" UI: a single row of preset buttons (exact and rounded mixed),
// a free-form percentage input, an optional preview line, an optional
// feasibility warning, and an Apply button. Used by both the single-element
// Picot Wizard and the multi-element batch Scale tool.
//
// Exact presets (clean division) use the standard button style.
// Rounded presets (approximate — some runs will gain/lose 1ds) use an amber-
// tinted background so they're visually distinct without a separate row.
// A "~" suffix and the result total appear on every preset button.
//
// Purely presentational — all domain logic and translation live in the caller.

import React from 'react';
import { ScalePreset } from '../domain/picotTools';

export interface ScaleControlsProps {
  // All presets in one flat list — exact and rounded mixed, order preserved.
  // suggestScalePresets() returns { exact, rounded }; callers spread them:
  //   presets={[...exactPresets, ...roundedPresets]}
  // Multi-element callers only pass exactPresets (no rounded row for batch).
  presets: ScalePreset[];
  pct: number;
  onPctChange: (pct: number) => void;
  /** Already-formatted preview line, e.g. "New length: 12ds". Omit to hide. */
  previewText?: string | null;
  /** Already-translated warning shown when the floor forced a deviation. Omit to hide. */
  clampedWarningText?: string | null;
  /** Already-translated label placed after the "%" custom input. */
  customLabelText: string;
  applyLabel: string;
  applyDisabled: boolean;
  onApply: () => void;
}

// Exported so callers (Clear/Add/Fill/Compact buttons in the same popover)
// can reuse the exact same button styling without re-typing it.
export const WIZARD_BUTTON_CLASS =
  'w-full text-left px-2 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700';

export function ScaleControls({
  presets,
  pct,
  onPctChange,
  previewText,
  clampedWarningText,
  customLabelText,
  applyLabel,
  applyDisabled,
  onApply,
}: ScaleControlsProps) {
  return (
    <>
      <div className="flex flex-wrap gap-1 mb-2">
        {presets.map(preset => {
          const presetPct = Math.round(preset.factor * 100);
          const isActive = presetPct === pct;
          const activeClass = 'bg-blue-700 border-blue-500 text-white';
          const exactClass = 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700';
          return (
            <button
              key={preset.label}
              onClick={() => onPctChange(presetPct)}
              className={`px-2 py-1 rounded text-sm border ${isActive ? activeClass : exactClass}`}
              style={!isActive && preset.isRounded ? { backgroundColor: '#451a03', borderColor: '#92400e', color: '#fcd34d' } : undefined}
              title={preset.isRounded ? `≈ ${preset.resultingTotalDs}ds (rounded)` : `→ ${preset.resultingTotalDs}ds`}
            >
              {preset.label}
              <span
                className={`ml-1 text-sm ${isActive ? 'text-blue-200' : 'text-gray-500'}`}
                style={!isActive && preset.isRounded ? { color: '#f59e0b' } : undefined}
              >
                {preset.resultingTotalDs}ds
              </span>
              {preset.isRounded && (
                <span
                  className={isActive ? 'text-amber-400 ml-0.5' : 'ml-0.5'}
                  style={!isActive ? { color: '#d97706' } : undefined}
                >~</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <input
          type="number"
          min={1}
          max={1000}
          value={pct}
          onChange={(e) => onPctChange(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 100)))}
          className="w-20 px-2 py-1 bg-gray-700 rounded border border-gray-600 text-xs text-gray-200"
        />
        <span className="text-xs text-gray-400">% {customLabelText}</span>
      </div>

      {previewText ? <div className="text-xs text-gray-400 mb-1">{previewText}</div> : null}
      {clampedWarningText ? <div className="text-xs text-amber-400 mb-2">{clampedWarningText}</div> : null}

      <button
        disabled={applyDisabled}
        onClick={onApply}
        className={WIZARD_BUTTON_CLASS}
      >
        {applyLabel}
      </button>
    </>
  );
}
