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
  /** Already-translated word shown in a rounded preset's tooltip, e.g. "rounded". */
  roundedHintText?: string;
  applyDisabled: boolean;
  onApply: () => void;
  /**
   * Session 60. 'stacked' (default — the multi-select Scale pop-over):
   * presets, % box, preview, Apply each on their own line. 'wide' (the
   * single-element Picot Tools panel): presets on one line (exact | rounded),
   * a legend for "~", then % box + result + Apply on one line.
   */
  layout?: 'stacked' | 'wide';
  /** wide: legend line explaining "~" (shown when a rounded preset exists). */
  roundedLegendText?: string;
  /** wide: called when a preset / the % box is used (result preview). */
  onActivate?: () => void;
}

// Exported so callers (Clear/Add/Fill/Compact buttons in the same popover)
// can reuse the exact same button styling without re-typing it.
// Session 60 — Picot Tools panel cards (AddPicotsSection, FillPicotsSection,
// CompactPicotsSection, the Scale card in GeneralElementPropertyBar).
export const WIZARD_CARD_CLASS = 'rounded-lg border border-gray-700 bg-gray-900 bg-opacity-40 p-2.5';
export const WIZARD_SECTION_TITLE_CLASS = 'text-xs text-gray-400 uppercase tracking-wider mb-1';
export const WIZARD_HINT_CLASS = 'text-xs text-gray-500 leading-snug mb-2';
/** Full-width, centred action button inside a card. */
export const WIZARD_APPLY_CLASS =
  'w-full text-center px-2 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700';
/** Short, auto-width action button (Group, Apply scale in the wide layout). */
export const WIZARD_SHORT_BUTTON_CLASS =
  'flex-shrink-0 text-center px-4 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700 whitespace-nowrap';

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
  roundedHintText,
  applyDisabled,
  onApply,
  layout = 'stacked',
  roundedLegendText,
  onActivate,
}: ScaleControlsProps) {
  const wide = layout === 'wide';
  const pick = (v: number) => { onPctChange(v); onActivate?.(); };
  const pctInput = (
    <input
      type="number"
      min={1}
      max={1000}
      value={pct}
      onChange={(e) => pick(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 100)))}
      className="w-20 px-2 py-1 bg-gray-700 rounded border border-gray-600 text-xs text-gray-200"
    />
  );
  const hasRounded = presets.some(p => p.isRounded);
  return (
    <>
      <div className={`flex flex-wrap gap-1 ${wide ? 'items-center mb-1' : 'mb-2'}`}>
        {presets.map((preset, i) => {
          const presetPct = Math.round(preset.factor * 100);
          const isActive = presetPct === pct;
          const activeClass = 'bg-blue-700 border-blue-500 text-white';
          const exactClass = 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700';
          // wide: a thin divider between the exact and the rounded presets
          const divider = wide && i > 0 && preset.isRounded && !presets[i - 1].isRounded;
          return (
            <React.Fragment key={preset.label}>
            {divider && <span className="w-px h-5 bg-gray-600 mx-1" aria-hidden="true" />}
            <button
              onClick={() => pick(presetPct)}
              className={`px-2 py-1 rounded text-sm border ${isActive ? activeClass : exactClass}`}
              style={!isActive && preset.isRounded ? { backgroundColor: '#451a03', borderColor: '#92400e', color: '#fcd34d' } : undefined}
              title={preset.resultingTotalDs == null ? undefined : preset.isRounded ? `≈ ${preset.resultingTotalDs}ds${roundedHintText ? ` (${roundedHintText})` : ''}` : `→ ${preset.resultingTotalDs}ds`}
            >
              {preset.label}
              {/* Multi-select presets have no single resulting length — show
                  nothing rather than a bare "ds" (session 60). */}
              {preset.resultingTotalDs != null && (
              <span
                className={`ml-1 text-sm ${isActive ? 'text-blue-200' : 'text-gray-500'}`}
                style={!isActive && preset.isRounded ? { color: '#f59e0b' } : undefined}
              >
                {preset.resultingTotalDs}ds
              </span>
              )}
              {preset.isRounded && (
                <span
                  className={isActive ? 'text-amber-400 ml-0.5' : 'ml-0.5'}
                  style={!isActive ? { color: '#d97706' } : undefined}
                >~</span>
              )}
            </button>
            </React.Fragment>
          );
        })}
      </div>

      {wide ? (
        <>
          {hasRounded && roundedLegendText && (
            <div className="text-xs text-gray-500 mb-2"><span style={{ color: '#f59e0b' }}>~</span> {roundedLegendText}</div>
          )}
          <div className="flex items-center gap-2">
            {pctInput}
            <span className="text-xs text-gray-400 whitespace-nowrap">% {customLabelText}</span>
            <span className="flex-1 min-w-0 text-xs text-gray-200 font-semibold truncate">{previewText ?? ''}</span>
            <button disabled={applyDisabled} onClick={onApply} className={WIZARD_SHORT_BUTTON_CLASS}>{applyLabel}</button>
          </div>
          {clampedWarningText ? <div className="text-xs text-amber-400 mt-2">{clampedWarningText}</div> : null}
        </>
      ) : (
      <>
      <div className="flex items-center gap-2 mb-2">
        {pctInput}
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
      )}
    </>
  );
}
