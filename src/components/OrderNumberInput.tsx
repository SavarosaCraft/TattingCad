// components/OrderNumberInput.tsx
//
// The "order number" text input in the per-element properties bar (tatting
// order assignment). Extracted from tattingindex.tsx (see architecture.md —
// properties-bar mode dispatch / element properties bar sub-sections). The
// draft-value state and commit/cancel logic stay with the caller — this is
// a thin controlled input.
import React from 'react';

interface OrderNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter (with the input element, so the caller can blur it) and on natural blur (with no argument). */
  onCommit: (inputEl?: HTMLInputElement) => void;
  onCancel: () => void;
  onFocus: () => void;
  label: string;
}

export const OrderNumberInput: React.FC<OrderNumberInputProps> = ({
  value,
  onChange,
  onCommit,
  onCancel,
  onFocus,
  label,
}) => (
  <>
    <label className="text-xs text-gray-400 hide-label-mobile">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onCommit(e.target as HTMLInputElement);
        if (e.key === 'Escape') { onCancel(); (e.target as HTMLInputElement).blur(); }
      }}
      onFocus={onFocus}
      onBlur={() => onCommit()}
      className="px-2 py-1 bg-gray-700 rounded border border-gray-600 w-16 text-sm"
      placeholder="#"
    />
  </>
);
