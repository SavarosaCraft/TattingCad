// components/RwToggleButton.tsx
//
// The "RW" (right-side/wrong-side) toggle in the per-element properties bar.
// Extracted from tattingindex.tsx (see architecture.md — properties-bar mode
// dispatch / element properties bar sub-sections). Note: this is the bordered
// amber/gray variant flagged (but deliberately not folded in) during the
// PresetChip extraction earlier this session — different color pairs and a
// border, so it stayed its own thing rather than being forced into that
// component's shape.
import React from 'react';

interface RwToggleButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
}

export const RwToggleButton: React.FC<RwToggleButtonProps> = ({ active, onClick, title }) => (
  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs font-bold ${active ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
      title={title}
    >
      RW
    </button>
  </div>
);
