// components/FillPicotsSection.tsx
//
// Presentational "Fill" section of the Picot Wizard popover — density slider
// + preview text + apply button. Extracted from the single-element wizard's
// inline IIFE in tattingindex.tsx (see architecture.md). The density-preview
// computation (previewFillDensity) and the transform (onApply) stay in the
// caller; this component only renders and reports gap changes.
import React from 'react';

interface FillPicotsSectionProps {
  gap: number;
  maxGap: number;
  onGapChange: (gap: number) => void;
  addedCount: number;
  onApply: () => void;
  sectionLabel: string;
  denseLabel: string;
  sparseLabel: string;
  previewText: string;
  applyLabel: string;
  applyClassName: string;
}

export const FillPicotsSection: React.FC<FillPicotsSectionProps> = ({
  gap,
  maxGap,
  onGapChange,
  addedCount,
  onApply,
  sectionLabel,
  denseLabel,
  sparseLabel,
  previewText,
  applyLabel,
  applyClassName,
}) => (
  <div className="border-t border-gray-600 pt-2 mb-3">
    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{sectionLabel}</div>
    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
      <span>{denseLabel}</span>
      <span>{sparseLabel}</span>
    </div>
    <input type="range" min={1} max={Math.max(1, maxGap)} value={gap}
      onChange={(e) => onGapChange(parseInt(e.target.value, 10))}
      className="w-full mb-1" disabled={maxGap <= 1} />
    <div className="text-xs text-gray-400 mb-2">{previewText}</div>
    <button disabled={addedCount === 0} onClick={onApply} className={applyClassName}>{applyLabel}</button>
  </div>
);
