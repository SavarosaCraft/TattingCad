// components/CompactPicotsSection.tsx
//
// Presentational "Compact" section of the Picot Wizard popover — a single
// apply button in the same bordered-section shell as Add/Fill/Scale.
// Extracted from the single-element wizard's inline IIFE in tattingindex.tsx
// (see architecture.md). The compactability check (canCompact) and the
// transform (onApply) stay in the caller.
import React from 'react';

interface CompactPicotsSectionProps {
  canCompact: boolean;
  onApply: () => void;
  sectionLabel: string;
  applyLabel: string;
  applyClassName: string;
}

export const CompactPicotsSection: React.FC<CompactPicotsSectionProps> = ({
  canCompact,
  onApply,
  sectionLabel,
  applyLabel,
  applyClassName,
}) => (
  <div className="border-t border-gray-600 pt-2 mb-3">
    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{sectionLabel}</div>
    <button disabled={!canCompact} onClick={onApply} className={applyClassName}>{applyLabel}</button>
  </div>
);
