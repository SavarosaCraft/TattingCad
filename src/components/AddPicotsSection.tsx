// components/AddPicotsSection.tsx
//
// "Add picots" card of the single-element Picot Tools pop-over.
// Session 60: card layout (two-column panel) with a one-line explanation;
// Symmetric listed first (it's the default). `onActivate` (pointer enters /
// focus) tells the panel which tool's result to preview.
import React from 'react';
import { WIZARD_CARD_CLASS, WIZARD_SECTION_TITLE_CLASS, WIZARD_HINT_CLASS } from './ScaleControls';

interface AddPicotsSectionProps {
  symmetric: boolean;
  onSymmetricChange: (symmetric: boolean) => void;
  canAdd: boolean;
  onApply: () => void;
  sectionLabel: string;
  hintText: string;
  asymmetricLabel: string;
  symmetricLabel: string;
  applyLabel: string;
  applyClassName: string;
  onActivate?: () => void;
}

const segClass = (on: boolean) =>
  `flex-1 py-1 rounded text-xs border ${on ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`;

export const AddPicotsSection: React.FC<AddPicotsSectionProps> = ({
  symmetric,
  onSymmetricChange,
  canAdd,
  onApply,
  sectionLabel,
  hintText,
  asymmetricLabel,
  symmetricLabel,
  applyLabel,
  applyClassName,
  onActivate,
}) => (
  <div className={`${WIZARD_CARD_CLASS} flex flex-col`} onMouseEnter={onActivate} onFocusCapture={onActivate} onPointerDown={onActivate}>
    <div className={WIZARD_SECTION_TITLE_CLASS}>{sectionLabel}</div>
    <div className={WIZARD_HINT_CLASS}>{hintText}</div>
    <div className="flex gap-1 mb-2">
      <button onClick={() => onSymmetricChange(true)} className={segClass(symmetric)}>{symmetricLabel}</button>
      <button onClick={() => onSymmetricChange(false)} className={segClass(!symmetric)}>{asymmetricLabel}</button>
    </div>
    <button disabled={!canAdd} onClick={onApply} className={`${applyClassName} mt-auto`}>{applyLabel}</button>
  </div>
);
