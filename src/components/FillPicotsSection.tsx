// components/FillPicotsSection.tsx
//
// "Fill density" card of the single-element Picot Tools pop-over.
// Session 60: card layout with a one-line explanation; the "will add N"
// count is on the Apply button ("Apply fill (+N picots)").
import React from 'react';
import { WIZARD_CARD_CLASS, WIZARD_SECTION_TITLE_CLASS, WIZARD_HINT_CLASS } from './ScaleControls';

interface FillPicotsSectionProps {
  gap: number;
  maxGap: number;
  onGapChange: (gap: number) => void;
  addedCount: number;
  onApply: () => void;
  sectionLabel: string;
  hintText: string;
  denseLabel: string;
  sparseLabel: string;
  /** Button text, already including the count (or the "no change" text). */
  applyLabel: string;
  applyClassName: string;
  onActivate?: () => void;
}

export const FillPicotsSection: React.FC<FillPicotsSectionProps> = ({
  gap,
  maxGap,
  onGapChange,
  addedCount,
  onApply,
  sectionLabel,
  hintText,
  denseLabel,
  sparseLabel,
  applyLabel,
  applyClassName,
  onActivate,
}) => (
  <div className={`${WIZARD_CARD_CLASS} flex flex-col`} onMouseEnter={onActivate} onFocusCapture={onActivate} onPointerDown={onActivate}>
    <div className={WIZARD_SECTION_TITLE_CLASS}>{sectionLabel}</div>
    <div className={WIZARD_HINT_CLASS}>{hintText}</div>
    <div className="flex items-center justify-between text-xs text-gray-400">
      <span>{denseLabel}</span>
      <span>{sparseLabel}</span>
    </div>
    <input type="range" min={1} max={Math.max(1, maxGap)} value={gap}
      onChange={(e) => { onGapChange(parseInt(e.target.value, 10)); onActivate?.(); }}
      className="w-full mb-2" disabled={maxGap <= 1} />
    <button disabled={addedCount === 0} onClick={onApply} className={`${applyClassName} mt-auto`}>{applyLabel}</button>
  </div>
);
