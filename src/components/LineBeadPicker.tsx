// components/LineBeadPicker.tsx
//
// The bead-slot picker for line elements — count spinner, collapsed/expanded
// per-slot bead dropdowns, copy/cut/paste. Extracted from the 'line'-type
// branch of the per-element properties bar in tattingindex.tsx (see
// architecture.md — properties-bar mode dispatch). Genuinely self-contained:
// all derived values (slots, count, expanded, sharedId, showExpanded) and
// handlers (updateSlots/setCount/setSlot/setAllSame/toggleExpanded) are
// local and not referenced outside this branch — moved wholesale.
import React from 'react';
import { IconCopy, IconCut, IconPaste } from './icons';
import { ArrayInput } from './ArrayInput';

interface BeadLibraryEntry { id: string; name: string; color: string; }

interface LineBeadPickerProps {
  selectedElement: any;
  selectedIds: string[];
  elements: any[];
  beadLibrary: BeadLibraryEntry[];
  lineBeadClipboard: any;
  setLineBeadClipboard: (v: any) => void;
  setElements: (fn: (prev: any[]) => any[]) => void;
  updateElement: (prev: any[], id: string, updates: any) => any[];
  updateWhere: (prev: any[], predicate: (el: any) => boolean, updates: any) => any[];
  t: (key: string) => string;
}

export const LineBeadPicker: React.FC<LineBeadPickerProps> = ({
  selectedElement,
  selectedIds,
  elements,
  beadLibrary,
  lineBeadClipboard,
  setLineBeadClipboard,
  setElements,
  updateElement,
  updateWhere,
  t,
}) => {
  // Normalise: migrate legacy lineBeadId+lineBeadCount to lineBeadSlots on first render
  const rawSlots = selectedElement.lineBeadSlots;
  const slots = Array.isArray(rawSlots) ? rawSlots
    : selectedElement.lineBeadId
      ? Array.from({length: selectedElement.lineBeadCount ?? 1}, () => selectedElement.lineBeadId)
      : [];
  const count = slots.length;
  const expanded = !!selectedElement.lineBeadExpanded;

  // "all same" = every non-null slot has the same bead id (or all are null)
  const nonNull = slots.filter(Boolean);
  const allSame = nonNull.length === 0 || nonNull.every(id => id === nonNull[0]);
  const sharedId = allSame ? (nonNull[0] ?? null) : null;

  // Show per-slot pickers when: user explicitly expanded, OR slots differ
  const showExpanded = expanded || !allSame;

  const updateSlots = (newSlots, newExpanded = expanded) =>
    setElements(prev => updateElement(prev, selectedElement.id,
      {lineBeadSlots: newSlots, lineBeadExpanded: newExpanded, lineBeadId: undefined, lineBeadCount: undefined}
    ));

  const setCount = (n) => {
    const next = Array.from({length: n}, (_, i) => slots[i] ?? (sharedId || null));
    updateSlots(next, expanded);
  };

  const setSlot = (i, beadId) => {
    const next = [...slots];
    next[i] = beadId || null;
    updateSlots(next, true); // stay expanded after changing a slot
  };

  const setAllSame = (beadId) => {
    updateSlots(slots.map(() => beadId || null), false);
  };

  const toggleExpanded = () => {
    if (showExpanded) {
      // Collapse: harmonise all to first non-null bead, then hide per-slot
      setAllSame(nonNull[0] ?? null);
    } else {
      // Expand: show per-slot pickers
      updateSlots(slots, true);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap ml-2">
      <span className="text-xs text-gray-400 hide-label-mobile">{t('modeBeadCore')}:</span>

      {/* Count spinner */}
      <ArrayInput
        value={count}
        onChange={n => setCount(Math.max(0, n))}
        min={0} max={99} integer
        className="px-1 py-0.5 bg-gray-700 rounded border border-gray-600 w-10 text-sm text-center text-white"
      />

      {count > 0 && (<>
        {/* All-same toggle — blue = collapsed/same, grey = expanded/individual */}
        <button
          onClick={toggleExpanded}
          title={showExpanded ? t('lineBdCollapse') : t('lineBdExpand')}
          className={`px-1.5 py-0.5 rounded text-xs border ${!showExpanded ? 'bg-blue-800 border-blue-500 text-blue-200' : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'}`}
          style={{touchAction:'manipulation'}}
        >=</button>

        {!showExpanded ? (
          /* Collapsed: one shared dropdown */
          (() => {
            const lb = sharedId ? beadLibrary.find(b => b.id === sharedId) : null;
            return (
              <div className="flex items-center gap-1">
                {lb && <div className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500" style={{backgroundColor: lb.color}} />}
                <select
                  value={sharedId || ''}
                  onChange={e => setAllSame(e.target.value || null)}
                  className="bg-gray-700 text-white text-xs rounded px-1 py-0.5 border border-gray-600 max-w-28"
                  style={{touchAction:'manipulation'}}
                >
                  <option value="">— none —</option>
                  {beadLibrary.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            );
          })()
        ) : (
          /* Expanded: one numbered dropdown per slot */
          slots.map((slotId, i) => {
            const lb = slotId ? beadLibrary.find(b => b.id === slotId) : null;
            return (
              <div key={i} className="flex items-center gap-0.5">
                <span className="text-xs text-gray-500">{i+1}:</span>
                {lb && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-500" style={{backgroundColor: lb.color}} />}
                <select
                  value={slotId || ''}
                  onChange={e => setSlot(i, e.target.value || null)}
                  className="bg-gray-700 text-white text-xs rounded px-1 py-0.5 border border-gray-600 max-w-24"
                  style={{touchAction:'manipulation'}}
                >
                  <option value="">— —</option>
                  {beadLibrary.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            );
          })
        )}
      </>)}

      {/* Copy / Cut / Paste */}
      <div className="flex items-center gap-1 border-l border-gray-600 pl-2 ml-1">
        <button
          onClick={() => setLineBeadClipboard({ lineBeadSlots: [...slots] })}
          title={t('lineBdCopy')}
          className="px-1.5 py-0.5 rounded text-xs border bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
          style={{touchAction:'manipulation'}}
        ><IconCopy size={12} /></button>
        <button
          onClick={() => {
            setLineBeadClipboard({ lineBeadSlots: [...slots] });
            updateSlots([], false);
          }}
          title={t('lineBdCut')}
          className="px-1.5 py-0.5 rounded text-xs border bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
          style={{touchAction:'manipulation'}}
        ><IconCut size={12} /></button>
        {lineBeadClipboard && (
          <button
            onClick={() => {
              const lineIds = new Set(selectedIds);
              setElements(prev => updateWhere(prev, el => lineIds.has(el.id) && el.type === 'line',
                {lineBeadSlots: [...lineBeadClipboard.lineBeadSlots], lineBeadExpanded: false, lineBeadId: undefined, lineBeadCount: undefined}
              ));
            }}
            title={selectedIds.length > 1
              ? t('lineBdPasteAll').replace('{n}', String(selectedIds.filter(id => elements.find(e=>e.id===id)?.type==='line').length))
              : t('lineBdPaste')}
            className="px-1.5 py-0.5 rounded text-xs border bg-purple-800 border-purple-600 text-purple-200 hover:bg-purple-700"
            style={{touchAction:'manipulation'}}
          ><IconPaste size={12} /></button>
        )}
      </div>
    </div>
  );
};
