// components/ArrayInput.tsx
//
// A numeric text input with draft-value editing (typing doesn't commit
// until blur/Enter, Escape reverts, arrow keys step by `step`). Promoted
// out of tattingindex.tsx (see architecture.md) — used 18+ times there for
// counts/spacing/angles, and needed directly by LineBeadPicker.tsx too.
import React from 'react';

interface ArrayInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  className?: string;
}

export const ArrayInput: React.FC<ArrayInputProps> = ({
  value, onChange, min, max, step, integer = false, className,
}) => {
  const [draft, setDraft] = React.useState<string | null>(null);

  const commit = (raw: string) => {
    const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
    let v = isNaN(parsed) ? value : parsed;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
    setDraft(null);
  };

  return (
    <input
      type="number"
      min={min} max={max} step={step}
      value={draft ?? value}
      onChange={e => setDraft(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter')  { commit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const s = step ?? 1;
          const current = draft !== null ? (integer ? parseInt(draft, 10) : parseFloat(draft)) : value;
          const next = isNaN(current) ? value : current + (e.key === 'ArrowUp' ? s : -s);
          e.preventDefault();
          commit(String(next));
        }
      }}
      className={className}
    />
  );
};
