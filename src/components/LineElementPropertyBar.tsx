import React from 'react';
import { OrderNumberInput } from './OrderNumberInput';
import { RoundGroupPicker } from './RoundGroupPicker';
import { LineBeadPicker } from './LineBeadPicker';

// Extracted from tattingindex.tsx (single-select property bar, line-type branch).
// Pure relocation — no logic changes. Verify against original lines 7163–7223.

interface LineElementPropertyBarProps {
  selectedElement: any;
  selectedIds: (string | number)[];
  elements: any[];
  elementsRef: React.MutableRefObject<any[]>;
  rounds: any[];
  roundsRef: React.MutableRefObject<any[]>;
  beadLibrary: any;
  lineBeadClipboard: any;
  propBarOrderDraft: string | null;
  showPropBarGroupDropdown: boolean;
  propBarGroupButtonRef: React.RefObject<HTMLButtonElement>;
  picotConnectionsRef: React.MutableRefObject<any>;
  renderRotateFlipControls: () => React.ReactNode;
  getRoundId: (el: any) => any;
  commitOrderDraft: (id: any, draft: string | null, el?: any) => void;
  pushHistoryState: (els: any[], picotConnections: any, rounds: any[]) => void;
  setPropBarOrderDraft: (v: string | null) => void;
  setShowPropBarGroupDropdown: (v: boolean | ((d: boolean) => boolean)) => void;
  setElements: (fn: any[] | ((prev: any[]) => any[])) => void;
  setRounds: (rounds: any[] | ((prev: any[]) => any[])) => void;
  setLineBeadClipboard: (v: any) => void;
  updateElement: (...args: any[]) => void;
  updateWhere: (...args: any[]) => void;
  t: (key: string) => string;
}

export function LineElementPropertyBar({
  selectedElement,
  selectedIds,
  elements,
  elementsRef,
  rounds,
  roundsRef,
  beadLibrary,
  lineBeadClipboard,
  propBarOrderDraft,
  showPropBarGroupDropdown,
  propBarGroupButtonRef,
  picotConnectionsRef,
  renderRotateFlipControls,
  getRoundId,
  commitOrderDraft,
  pushHistoryState,
  setPropBarOrderDraft,
  setShowPropBarGroupDropdown,
  setElements,
  setRounds,
  setLineBeadClipboard,
  updateElement,
  updateWhere,
  t,
}: LineElementPropertyBarProps) {
  return (
    <div className="flex items-center gap-0.5 md:gap-3">
      <span className="text-xs text-gray-400 px-2">{t('infoLine')}</span>
      <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
        {renderRotateFlipControls()}
      </div>
      <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
      <OrderNumberInput
        value={propBarOrderDraft !== null ? propBarOrderDraft : (selectedElement.orderNumber || '')}
        onChange={setPropBarOrderDraft}
        onCommit={(el) => commitOrderDraft(selectedElement.id, propBarOrderDraft, el)}
        onCancel={() => setPropBarOrderDraft(null)}
        onFocus={() => setPropBarOrderDraft(selectedElement.orderNumber ? String(selectedElement.orderNumber) : '')}
        label={t('propOrder')}
      />
        {/* Round group picker for lines */}
        <RoundGroupPicker
          buttonRef={propBarGroupButtonRef}
          isOpen={showPropBarGroupDropdown}
          onToggle={() => setShowPropBarGroupDropdown(d => !d)}
          currentGroupId={getRoundId(selectedElement)}
          rounds={rounds}
          onSelectUngrouped={() => {
            const newEls = elementsRef.current.map(el => el.id === selectedElement.id ? { ...el, roundId: undefined, orderGroup: undefined } : el);
            setElements(newEls);
            setShowPropBarGroupDropdown(false);
            pushHistoryState(newEls, picotConnectionsRef.current, roundsRef.current);
          }}
          onSelectGroup={(groupId) => {
            const newEls = elementsRef.current.map(el => el.id === selectedElement.id ? { ...el, roundId: groupId, orderGroup: undefined } : el);
            setElements(newEls);
            setShowPropBarGroupDropdown(false);
            pushHistoryState(newEls, picotConnectionsRef.current, roundsRef.current);
          }}
          onCreateNew={() => {
            const name = t('tattingOrderRoundDefault').replace('{n}', String(rounds.length + 1));
            const id = crypto.randomUUID();
            const newGroups = [...roundsRef.current, { id, name }];
            const newEls = elementsRef.current.map(el => el.id === selectedElement.id ? { ...el, roundId: id, orderGroup: undefined } : el);
            setRounds(newGroups);
            setElements(newEls);
            setShowPropBarGroupDropdown(false);
            pushHistoryState(newEls, picotConnectionsRef.current, newGroups);
          }}
          ungroupedLabel={t('tattingOrderUngrouped')}
          createNewLabel={t('tattingOrderRoundNew')}
        />
        {/* ── Line bead picker ── */}
        <LineBeadPicker
          selectedElement={selectedElement}
          selectedIds={selectedIds}
          elements={elements}
          beadLibrary={beadLibrary}
          lineBeadClipboard={lineBeadClipboard}
          setLineBeadClipboard={setLineBeadClipboard}
          setElements={setElements}
          updateElement={updateElement}
          updateWhere={updateWhere}
          t={t}
        />
      </div>
    </div>
  );
}
