// utils/roundGroupActions.ts
//
// Shared "assign selected element to a round/tatting-order group" handlers
// for the RoundGroupPicker dropdown. Previously duplicated almost verbatim
// in LineElementPropertyBar.tsx and GeneralElementPropertyBar.tsx, and the
// two copies had drifted onto two different (and both subtly broken)
// history-push strategies:
//   - LineElementPropertyBar.tsx called pushHistoryState explicitly, but
//     never set skipAutoHistoryRef first — the general auto-push effect in
//     tattingindex.tsx also fires from the same setElements call, so every
//     use of this dropdown was pushing a duplicate history entry.
//   - GeneralElementPropertyBar.tsx used updateElement + pushOrderHistory()
//     (which itself reads elementsRef.current for its snapshot — stale at
//     call time, before the next render), and onCreateNew additionally
//     wrapped its call in a setTimeout(...,0) to paper over rounds/elements
//     both changing in the same batch.
//
// This version follows the pattern already established (and correct)
// elsewhere in useEditorActions.ts (see addRing): compute the new array(s)
// explicitly, set skipAutoHistoryRef.current = true BEFORE calling
// setElements, then push history explicitly with the fresh values. Setting
// skipAutoHistoryRef first is what the other two versions were missing —
// without it, the auto-push effect's own pushHistoryState call still fires
// once the state update commits, on top of the explicit one.
export function createRoundGroupHandlers(params: {
  selectedElementId: string;
  elementsRef: { current: any[] };
  picotConnectionsRef: { current: any[] };
  roundsRef: { current: any[] };
  skipAutoHistoryRef: { current: boolean };
  setElements: (els: any[]) => void;
  setRounds: (rounds: any[]) => void;
  pushHistoryState: (els: any[], conns: any[], rounds: any[]) => void;
  closeDropdown: () => void;
  roundDefaultNameTemplate: string; // t('tattingOrderRoundDefault'), containing '{n}'
}) {
  const {
    selectedElementId, elementsRef, picotConnectionsRef, roundsRef,
    skipAutoHistoryRef, setElements, setRounds, pushHistoryState,
    closeDropdown, roundDefaultNameTemplate,
  } = params;

  // Shared commit step: mark the auto-push effect to skip (it would
  // otherwise re-push the same change with a second, redundant history
  // entry once this render commits), apply the new elements, close the
  // dropdown, then push history explicitly with values known-fresh right
  // now — newRounds is passed in by value for onCreateNew specifically
  // because roundsRef.current can still be one render stale relative to
  // the setRounds call that just happened in the same synchronous batch.
  const commit = (newEls: any[], newRounds?: any[]) => {
    skipAutoHistoryRef.current = true;
    setElements(newEls);
    closeDropdown();
    pushHistoryState(newEls, picotConnectionsRef.current, newRounds ?? roundsRef.current);
  };

  return {
    onSelectUngrouped: () => {
      const newEls = elementsRef.current.map(el =>
        el.id === selectedElementId ? { ...el, roundId: undefined, orderGroup: undefined } : el);
      commit(newEls);
    },
    onSelectGroup: (groupId: string) => {
      const newEls = elementsRef.current.map(el =>
        el.id === selectedElementId ? { ...el, roundId: groupId, orderGroup: undefined } : el);
      commit(newEls);
    },
    onCreateNew: () => {
      const name = roundDefaultNameTemplate.replace('{n}', String(roundsRef.current.length + 1));
      const id = crypto.randomUUID();
      const newGroups = [...roundsRef.current, { id, name }];
      const newEls = elementsRef.current.map(el =>
        el.id === selectedElementId ? { ...el, roundId: id, orderGroup: undefined } : el);
      setRounds(newGroups);
      commit(newEls, newGroups);
    },
  };
}
