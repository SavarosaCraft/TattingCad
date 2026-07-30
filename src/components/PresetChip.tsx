// components/PresetChip.tsx
//
// Small selectable "chip" button used for quick-pick presets — array
// counts, angle presets, direction/type toggles, gradient category tabs.
// Extracted from 13 duplicated inline <button> blocks in tattingindex.tsx
// (see architecture.md). Visually similar to ToolbarButton but a distinct
// pattern: no title/tooltip, no touch-action handling, sized for dense rows
// of small options rather than the icon tool rail.
//
// Buttons that are always in the "unselected" visual state (e.g. a plain
// Reset button) just omit `selected` — it defaults to false, which reduces
// to the same classes those buttons already had.
import React from 'react';

interface PresetChipProps {
  onClick: () => void;
  selected?: boolean;
  /** Classes applied when selected. Default matches the common blue chip. */
  selectedColor?: string;
  /** Classes applied when not selected. */
  unselectedColor?: string;
  /**
   * Padding/sizing/font classes — callers override this for the wider
   * variants (e.g. 'px-3 py-1 font-semibold' for H/V direction buttons,
   * 'flex-1 py-1.5 font-semibold' for the spiral type toggle).
   */
  className?: string;
  children: React.ReactNode;
}

export const PresetChip: React.FC<PresetChipProps> = ({
  onClick,
  selected = false,
  selectedColor = 'bg-blue-600 text-white',
  unselectedColor = 'bg-gray-700 hover:bg-gray-600 text-gray-300',
  className = 'px-2 py-1',
  children,
}) => (
  <button
    onClick={onClick}
    className={`${className} rounded text-xs ${selected ? selectedColor : unselectedColor}`}
  >
    {children}
  </button>
);
