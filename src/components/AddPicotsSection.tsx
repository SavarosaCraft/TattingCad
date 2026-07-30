// components/AddPicotsSection.tsx
//
// Presentational "Add" section of the Picot Wizard popover — symmetric/
// asymmetric toggle + apply button. Extracted from the single-element wizard's
// ~150-line inline IIFE in tattingindex.tsx (see architecture.md). All the
// notation analysis (canAdd) and the transform itself (onApply) stay in the
// caller; this component only renders.
import React from 'react';

interface AddPicotsSectionProps {
  symmetric: boolean;
  onSymmetricChange: (symmetric: boolean) => void;
  canAdd: boolean;
  onApply: () => void;
  sectionLabel: string;
  asymmetricLabel: string;
  symmetricLabel: string;
  applyLabel: string;
  applyClassName: string;
}

export const AddPicotsSection: React.FC<AddPicotsSectionProps> = ({
  symmetric,
  onSymmetricChange,
  canAdd,
  onApply,
  sectionLabel,
  asymmetricLabel,
  symmetricLabel,
  applyLabel,
  applyClassName,
}) => (
  <div className="border-t border-gray-600 pt-2 mb-3">
    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{sectionLabel}</div>
    <div className="flex gap-1 mb-2">
      <button
        onClick={() => onSymmetricChange(false)}
        className={`flex-1 py-1 rounded text-xs border ${!symmetric ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
      >{asymmetricLabel}</button>
      <button
        onClick={() => onSymmetricChange(true)}
        className={`flex-1 py-1 rounded text-xs border ${symmetric ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
      >{symmetricLabel}</button>
    </div>
    <button disabled={!canAdd} onClick={onApply} className={applyClassName}>{applyLabel}</button>
  </div>
);
