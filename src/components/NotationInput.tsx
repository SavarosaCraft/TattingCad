import React from 'react';

type NotationInputProps = {
  defaultValue: string;
  hasError: boolean;
  placeholder?: string;
  onChangeRaw: (raw: string) => void;
  onCommit: (raw: string) => void;
  getRevertValue: () => string | null;
  onEscape: () => void;
  notationEscapeRef: React.MutableRefObject<boolean>;
  pendingNotationRef: React.MutableRefObject<any>;
};

// Single (non-split-ring) notation input. Mirrors SplitRingNotationInput's
// prop shape: this component owns only the DOM/event wiring; all parsing,
// normalization, and commit logic stays in the parent via callback props.
export function NotationInput({
  defaultValue,
  hasError,
  placeholder = 'r: 20ds',
  onChangeRaw,
  onCommit,
  getRevertValue,
  onEscape,
  notationEscapeRef,
  pendingNotationRef,
}: NotationInputProps) {
  return (
    <input
      type="text"
      defaultValue={defaultValue}
      onChange={(e) => {
        onChangeRaw(e.target.value);
      }}
      onBlur={(e) => {
        pendingNotationRef.current = null;
        if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
        onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          notationEscapeRef.current = true;
          pendingNotationRef.current = null;
          onEscape();
          const target = e.target as HTMLInputElement;
          const revertValue = getRevertValue();
          if (revertValue != null) { target.value = revertValue; }
          target.blur();
        }
      }}
      className={`notation-input px-2 py-1 bg-gray-700 rounded border text-sm ${hasError ? 'border-red-500' : 'border-gray-600'}`}
      placeholder={placeholder}
    />
  );
}
