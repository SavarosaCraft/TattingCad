// ScaleControls.tsx
// Shared "Scale" UI: preset buttons, a free-form percentage input, an
// optional preview line, an optional feasibility warning, and an Apply
// button. Used by both the single-element Picot Wizard's Scale section and
// the multi-element batch Scale tool — extracted because those two were an
// almost line-for-line copy of each other in tattingindex.tsx, differing
// only in what happens on Apply and how the preview text is computed.
//
// Purely presentational: it doesn't know about notation, picots, or
// translation keys — the caller passes already-translated strings and a
// plain (label, factor) preset list, and owns all the domain logic
// (analyzeNotation, scaleNotation, autoCompact, etc.) and the actual commit.

import React from 'react';

export interface ScalePresetOption {
  label: string;   // e.g. "÷2", "×3"
  factor: number;  // e.g. 0.5, 3
}

export interface ScaleControlsProps {
  presets: ScalePresetOption[];
  pct: number;
  onPctChange: (pct: number) => void;
  /** Already-formatted preview line, e.g. "New length: 12ds". Omit to hide. */
  previewText?: string | null;
  /** Already-translated warning shown when the floor forced a deviation. Omit to hide. */
  clampedWarningText?: string | null;
  /** Already-translated label placed after the "%" custom input, e.g. "of original length". */
  customLabelText: string;
  applyLabel: string;
  applyDisabled: boolean;
  onApply: () => void;
}

// Exported so callers (Clear/Add/Fill/Compact buttons elsewhere in the same
// popover) can reuse the exact same button styling instead of re-typing it.
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
        {presets.map(preset => (
          <button
            key={preset.label}
            onClick={() => onPctChange(Math.round(preset.factor * 100))}
            className={`px-2 py-1 rounded text-xs border ${
              Math.round(preset.factor * 100) === pct
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {preset.label}
          </button>
        ))}
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
