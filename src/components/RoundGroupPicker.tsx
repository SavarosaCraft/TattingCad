// components/RoundGroupPicker.tsx
//
// The "assign to round/group" dropdown in the per-element properties bar.
// Extracted from tattingindex.tsx (see architecture.md — properties-bar mode
// dispatch). TWO call sites (the 'line'-type branch and the generic element
// branch) — both structurally self-contained (safe, unlike OrderNumberInput's
// two sites), but their onSelect*/onCreateNew handlers are NOT identical:
// the 'line'-type site still uses the older elementsRef.current.map + manual
// pushHistoryState pattern, the generic site uses updateElement + a
// pushOrderHistory() call. Deliberately NOT unified — each call site supplies
// its own handler as a prop, preserving its existing behavior exactly.
import React from 'react';
import { ORDER_GROUP_COLORS } from '../render/svgExport';

interface OrderGroup { id: string; name: string; }

interface RoundGroupPickerProps {
  buttonRef: React.RefObject<HTMLButtonElement>;
  isOpen: boolean;
  onToggle: () => void;
  currentGroupId: string | null | undefined;
  orderGroups: OrderGroup[];
  onSelectUngrouped: () => void;
  onSelectGroup: (groupId: string) => void;
  onCreateNew: () => void;
  ungroupedLabel: string;
  createNewLabel: string;
  triggerTitle?: string;
  wrapperClassName?: string;
}

export const RoundGroupPicker: React.FC<RoundGroupPickerProps> = ({
  buttonRef,
  isOpen,
  onToggle,
  currentGroupId,
  orderGroups,
  onSelectUngrouped,
  onSelectGroup,
  onCreateNew,
  ungroupedLabel,
  createNewLabel,
  triggerTitle,
  wrapperClassName = 'relative flex-shrink-0',
}) => {
  const currentGroup = currentGroupId ? orderGroups.find(g => g.id === currentGroupId) : null;
  const currentGroupIdx = currentGroup ? orderGroups.findIndex(g => g.id === currentGroup.id) : -1;
  const [triggerColor] = currentGroupIdx >= 0 ? ORDER_GROUP_COLORS[(currentGroupIdx + 1) % ORDER_GROUP_COLORS.length] : [null];

  return (
    <div className={wrapperClassName}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300"
        style={triggerColor ? { borderColor: triggerColor, color: triggerColor } : {}}
        title={triggerTitle}
      >
        <span>{currentGroup?.name ?? ungroupedLabel}</span>
        <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
      </button>
      {isOpen && (() => {
        const rect = buttonRef.current?.getBoundingClientRect();
        const dropTop = rect ? rect.bottom + 4 : 60;
        const dropLeft = rect ? rect.left : 0;
        return (
          <>
            <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onToggle} />
            <div className="fixed rounded-lg border border-gray-500 shadow-2xl py-1 min-w-36"
              style={{ backgroundColor: '#1f2937', zIndex: 9999, top: dropTop, left: dropLeft }}>
              <button
                onClick={onSelectUngrouped}
                className={`w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-gray-700 ${!currentGroupId ? 'text-yellow-400 font-semibold' : 'text-gray-300'}`}
              >
                <span style={{ fontSize: '8px' }}>{!currentGroupId ? '●' : '○'}</span>
                {ungroupedLabel}
              </button>
              {orderGroups.length > 0 && <div className="my-1 border-t border-gray-600" />}
              {orderGroups.map((grp, gi) => {
                const [gpFill] = ORDER_GROUP_COLORS[(gi + 1) % ORDER_GROUP_COLORS.length];
                const isActive = currentGroupId === grp.id;
                return (
                  <button key={grp.id}
                    onClick={() => onSelectGroup(grp.id)}
                    className="w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-gray-700"
                    style={{ color: isActive ? gpFill : '#d1d5db' }}
                  >
                    <span style={{ fontSize: '8px' }}>{isActive ? '●' : '○'}</span>
                    <span style={{ fontWeight: isActive ? 700 : 400 }}>{grp.name}</span>
                  </button>
                );
              })}
              <div className="my-1 border-t border-gray-600" />
              <button
                onClick={onCreateNew}
                className="w-full text-left px-3 py-1 text-xs text-emerald-400 hover:bg-gray-700 hover:text-emerald-300"
              >
                {createNewLabel}
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
};
