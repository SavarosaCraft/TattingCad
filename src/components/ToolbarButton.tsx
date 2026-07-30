// components/ToolbarButton.tsx
//
// Shared icon-button shell for the left tool rail (pan/select/path/ruler,
// picot-join, beading, add-ring/split-ring/line/chain, delete/group/ungroup,
// zoom controls, image, notes). Extracted from 21 near-identical inline
// <button> blocks in tattingindex.tsx (see architecture.md).
//
// Handles: base sizing/rounding, the active/inactive background swap,
// disabled dimming, and the touch-action fix needed for mobile. Callers
// keep their own onClick/state and just describe *what* the button is
// (active?, which color when active, does it span 2 grid columns, does it
// need its icon+label centered).
import React from 'react';

interface ToolbarButtonProps {
  onClick: () => void;
  /** Whether this button represents the currently-active tool/mode. */
  active?: boolean;
  /** Tailwind bg-* class used when active. Default matches the majority case. */
  activeColor?: string;
  disabled?: boolean;
  title?: string;
  /** Grid buttons that should span both toolbar columns (e.g. mode toggles). */
  colSpan2?: boolean;
  /** Centers icon (+ optional label) — needed for the col-span-2 mode buttons. */
  flexCenter?: boolean;
  /** Extra classes appended verbatim (e.g. the Notes button's label styling). */
  className?: string;
  children: React.ReactNode;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  active = false,
  activeColor = 'bg-blue-600',
  disabled = false,
  title,
  colSpan2 = false,
  flexCenter = false,
  className = '',
  children,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={[
      'p-2 rounded pointer-events-auto disabled:opacity-30 disabled:cursor-not-allowed',
      active ? activeColor : 'bg-gray-700 active:bg-gray-600',
      colSpan2 ? 'col-span-2' : '',
      flexCenter ? 'flex items-center justify-center' : '',
      className,
    ].filter(Boolean).join(' ')}
    style={{ touchAction: 'manipulation' }}
  >
    {children}
  </button>
);
