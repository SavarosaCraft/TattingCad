// components/CompactPicotsSection.tsx
//
// "Repeats" row of the single-element Picot Tools pop-over.
// Session 60: one line — title + what it does on the left, two short buttons
// on the right: "Group" (3ds-p-3ds-p-3ds-p -> 3*(3ds-p)) and "Expand", its
// opposite (writes the repeat groups out in full). Each is greyed with a
// "nothing to …" tooltip when it would change nothing.
import React from 'react';
import { WIZARD_CARD_CLASS, WIZARD_SECTION_TITLE_CLASS } from './ScaleControls';

interface CompactPicotsSectionProps {
  canCompact: boolean;
  onApply: () => void;
  sectionLabel: string;
  hintText: string;
  applyLabel: string;
  /** Tooltip while there is nothing to group. */
  nothingText: string;
  /** Expand (the opposite of Group). */
  canExpand: boolean;
  onExpand: () => void;
  expandLabel: string;
  expandNothingText: string;
  /** A short, auto-width button class (not the full-width wizard one). */
  applyClassName: string;
  /** Pointer / focus on the card or the Group button. */
  onActivate?: () => void;
  /** Pointer / focus on the Expand button. */
  onActivateExpand?: () => void;
}

export const CompactPicotsSection: React.FC<CompactPicotsSectionProps> = ({
  canCompact,
  onApply,
  sectionLabel,
  hintText,
  applyLabel,
  nothingText,
  canExpand,
  onExpand,
  expandLabel,
  expandNothingText,
  applyClassName,
  onActivate,
  onActivateExpand,
}) => (
  <div className={`${WIZARD_CARD_CLASS} flex items-center gap-3`} onMouseEnter={onActivate}>
    <div className="flex-1 min-w-0">
      <div className={WIZARD_SECTION_TITLE_CLASS}>{sectionLabel}</div>
      <div className="text-xs text-gray-500 leading-snug">{hintText}</div>
    </div>
    <div className="flex gap-2 flex-shrink-0">
      <button disabled={!canCompact} onClick={onApply} title={canCompact ? undefined : nothingText}
        onMouseEnter={onActivate} onFocus={onActivate} onPointerDown={onActivate}
        className={applyClassName}>{applyLabel}</button>
      <button disabled={!canExpand} onClick={onExpand} title={canExpand ? undefined : expandNothingText}
        onMouseEnter={onActivateExpand} onFocus={onActivateExpand} onPointerDown={onActivateExpand}
        className={applyClassName}>{expandLabel}</button>
    </div>
  </div>
);
