// components/SplitRingNotationInput.tsx
//
// The split-ring "A:" / "B:" notation text field, from the per-element
// properties bar. Extracted from tattingindex.tsx (see architecture.md —
// properties-bar mode dispatch). This is the original audit's item #8
// ("Notation Input with Escape/Blur Handling") — genuinely duplicated here
// (side A and side B are identical shells, differing only in which field
// they edit), NOT just similar-looking.
//
// The escape-guard check (pendingNotationRef reset + notationEscapeRef bail)
// is identical for both sides and is centralized here. Validation, the
// updateNotation call shape, and the revert-on-escape value are genuinely
// different per side and stay with the caller as callbacks — same
// discipline as everywhere else this session (business logic stays put,
// only the shell moves).
//
// Does NOT cover the single/regular-ring notation input a few lines away —
// that one has extra behavior (draftNotation tracking, notationError state,
// normalizeNotationInput) that these two don't, so it wasn't forced into
// this shape. Candidate for its own extraction later if wanted.
import React from 'react';

interface SplitRingNotationInputProps {
  keySuffix: string;
  label: string;
  defaultValue: string;
  onChangeRaw: (rawValue: string) => void;
  onCommit: (rawValue: string) => void;
  getRevertValue: () => string;
  notationEscapeRef: React.RefObject<boolean>;
  pendingNotationRef: React.RefObject<any>;
}

export const SplitRingNotationInput: React.FC<SplitRingNotationInputProps> = ({
  keySuffix,
  label,
  defaultValue,
  onChangeRaw,
  onCommit,
  getRevertValue,
  notationEscapeRef,
  pendingNotationRef,
}) => (
  <>
    <span className="text-xs text-gray-400">{label}</span>
    <input
      key={keySuffix}
      type="text"
      defaultValue={defaultValue}
      onChange={(e) => onChangeRaw(e.target.value)}
      onBlur={(e) => {
        pendingNotationRef.current = null;
        if (notationEscapeRef.current) { notationEscapeRef.current = false; return; }
        onCommit(e.target.value.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          notationEscapeRef.current = true;
          pendingNotationRef.current = null;
          (e.target as HTMLInputElement).value = getRevertValue();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="notation-input px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm w-20"
      placeholder="5ds"
    />
  </>
);
