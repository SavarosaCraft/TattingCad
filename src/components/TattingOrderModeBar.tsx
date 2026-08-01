// components/TattingOrderModeBar.tsx
//
// Properties-bar content shown while activeMode === 'tattingOrder'. One of
// six mutually-exclusive branches of the top properties-bar mode dispatch in
// tattingindex.tsx (see architecture.md — properties-bar mode dispatch).
// Like BeadingModeBar, genuinely self-contained enough to move its local
// derivations (numbered/total counts, activeGroup/activeBadgeFill,
// numberedInScope/totalInScope) wholesale — none of it is referenced
// outside this branch.
//
// Contains the bordered "RW" toggle variant documented in RwToggleButton.tsx
// (uses `selectedEl`, has a border, and its own manual
// setElements+pushHistoryState instead of updateElement/needsHistoryPushRef)
// — left exactly as-is, matching the reasoning already on record.
import React from 'react';
import { IconUnnumberedOn } from './icons';
import { ORDER_GROUP_COLORS } from '../render/svgExport';

interface OrderGroup { id: string; name: string; }

interface TattingOrderModeBarProps {
  elements: any[];
  selectedElement: any;
  orderGroups: OrderGroup[];
  orderGroupsRef: React.RefObject<OrderGroup[]>;
  activeOrderGroupId: string | null;
  setActiveOrderGroupId: (id: string | null) => void;
  groupDropdownButtonRef: React.RefObject<HTMLButtonElement>;
  showGroupDropdown: boolean;
  setShowGroupDropdown: (fn: ((prev: boolean) => boolean) | boolean) => void;
  showNewGroupInput: boolean;
  setShowNewGroupInput: (v: boolean) => void;
  newGroupNameInput: string;
  setNewGroupNameInput: (v: string) => void;
  renamingGroupId: string | null;
  setRenamingGroupId: (id: string | null) => void;
  renameGroupInput: string;
  setRenameGroupInput: (v: string) => void;
  setOrderGroups: (groups: OrderGroup[]) => void;
  pushHistoryState: (els: any[], conns: any[], groups?: any[]) => void;
  elementsRef: React.RefObject<any[]>;
  picotConnectionsRef: React.RefObject<any[]>;
  setConfirmDialog: (dialog: any) => void;
  setActiveMode: (mode: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  showLoadMsg: (kind: string, msg: string) => void;
  tattingOrderInput: string;
  setTattingOrderInput: (v: string) => void;
  assignOrderNumber: (id: string, n: number) => void;
  getNextAvailableNumber: () => number;
  setElements: (fn: (prev: any[]) => any[]) => void;
  assignRepeat: (id: string) => void;
  clearOrderAssignment: (id: string) => void;
  inActiveGroup: (el: any) => boolean;
  t: (key: string) => string;
}

export const TattingOrderModeBar: React.FC<TattingOrderModeBarProps> = ({
  elements,
  selectedElement,
  orderGroups,
  orderGroupsRef,
  activeOrderGroupId,
  setActiveOrderGroupId,
  groupDropdownButtonRef,
  showGroupDropdown,
  setShowGroupDropdown,
  showNewGroupInput,
  setShowNewGroupInput,
  newGroupNameInput,
  setNewGroupNameInput,
  renamingGroupId,
  setRenamingGroupId,
  renameGroupInput,
  setRenameGroupInput,
  setOrderGroups,
  pushHistoryState,
  elementsRef,
  picotConnectionsRef,
  setConfirmDialog,
  setActiveMode,
  setSelectedIds,
  showLoadMsg,
  tattingOrderInput,
  setTattingOrderInput,
  assignOrderNumber,
  getNextAvailableNumber,
  setElements,
  assignRepeat,
  clearOrderAssignment,
  inActiveGroup,
  t,
}) => {
  const selectedEl = selectedElement;

  // Active group object (null = Ungrouped scope)
  const activeGroup = activeOrderGroupId
    ? orderGroups.find(g => g.id === activeOrderGroupId) ?? null
    : null;
  const activeGroupIndex = activeGroup
    ? orderGroups.findIndex(g => g.id === activeGroup.id)
    : -1;
  const [activeBadgeFill] = activeGroup
    ? ORDER_GROUP_COLORS[activeGroupIndex % ORDER_GROUP_COLORS.length]
    : ORDER_GROUP_COLORS[0]; // gold for ungrouped

  // Per-group numbered count for the progress chip
  const numberedInScope = elements.filter(e => {
    const hasNum = e.isRepeat || (e.orderNumber != null && String(e.orderNumber).trim() !== '');
    return hasNum && inActiveGroup(e);
  }).length;
  const totalInScope = elements.filter(inActiveGroup).length;

  return (
    <div className="flex flex-col gap-1 w-full py-1 top-toolbar-scalable">
      {/* Row 1: mode banner + group bar + exit */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-700 border border-emerald-400 flex-shrink-0">
          <IconUnnumberedOn size={16} />
          <span className="font-bold text-sm text-white tracking-wide">{t('tattingOrderTitle')}</span>
        </div>

        {/* Group dropdown */}
        <div className="relative flex-shrink-0">
          {/* Trigger button */}
          <button
            ref={groupDropdownButtonRef}
            onClick={() => { setShowGroupDropdown(d => !d); setShowNewGroupInput(false); setRenamingGroupId(null); }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border border-gray-500 bg-gray-700 hover:bg-gray-600 text-gray-200"
            style={ activeGroup ? { borderColor: activeBadgeFill, color: activeBadgeFill } : {} }
          >
            <span>{activeGroup ? activeGroup.name : t('tattingOrderUngrouped')}</span>
            <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
          </button>

          {/* Dropdown panel — fixed position so it escapes the property bar on mobile */}
          {showGroupDropdown && (() => {
            const rect = groupDropdownButtonRef.current?.getBoundingClientRect();
            const dropTop = rect ? rect.bottom + 4 : 60;
            const dropLeft = rect ? rect.left : 0;
            return (
            <>
              {/* Click-outside veil */}
              <div
                className="fixed inset-0"
                style={{ zIndex: 9998 }}
                onClick={() => { setShowGroupDropdown(false); setRenamingGroupId(null); setShowNewGroupInput(false); }}
              />
              <div
                className="fixed rounded-lg border border-gray-500 shadow-2xl py-1 min-w-36"
                style={{ backgroundColor: '#1f2937', zIndex: 9999, top: dropTop, left: dropLeft }}
              >
                {/* Ungrouped row */}
                <button
                  onClick={() => { setActiveOrderGroupId(null); setShowGroupDropdown(false); setShowNewGroupInput(false); setRenamingGroupId(null); }}
                  className={`w-full text-left px-3 py-1 text-xs flex items-center gap-2 hover:bg-gray-700 ${activeOrderGroupId === null ? 'text-yellow-400 font-semibold' : 'text-gray-300'}`}
                >
                  <span style={{ fontSize: '8px' }}>{activeOrderGroupId === null ? '●' : '○'}</span>
                  {t('tattingOrderUngrouped')}
                </button>

                {orderGroups.length > 0 && <div className="my-1 border-t border-gray-600" />}

                {/* Group rows */}
                {orderGroups.map((grp, gi) => {
                  const [gpFill] = ORDER_GROUP_COLORS[gi % ORDER_GROUP_COLORS.length];
                  const isActive = activeOrderGroupId === grp.id;
                  const isRenaming = renamingGroupId === grp.id;

                  return (
                    <div key={grp.id} className="flex items-center gap-1 px-1 hover:bg-gray-700 group">
                      {isRenaming ? (
                        <input
                          autoFocus
                          type="text"
                          value={renameGroupInput}
                          onChange={e => setRenameGroupInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const name = renameGroupInput.trim() || grp.name;
                              const newGroups = orderGroupsRef.current.map(g => g.id === grp.id ? { ...g, name } : g);
                              setOrderGroups(newGroups);
                              pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
                              setRenamingGroupId(null);
                            }
                            if (e.key === 'Escape') setRenamingGroupId(null);
                          }}
                          onBlur={() => {
                            const name = renameGroupInput.trim() || grp.name;
                            const newGroups = orderGroupsRef.current.map(g => g.id === grp.id ? { ...g, name } : g);
                            setOrderGroups(newGroups);
                            pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
                            setRenamingGroupId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 px-2 py-0.5 bg-gray-600 border rounded text-white text-xs my-0.5"
                          style={{ borderColor: gpFill }}
                        />
                      ) : (
                        <button
                          className="flex-1 text-left px-2 py-1 text-xs flex items-center gap-2"
                          style={{ color: isActive ? gpFill : '#d1d5db' }}
                          onClick={() => { setActiveOrderGroupId(grp.id); setShowGroupDropdown(false); setShowNewGroupInput(false); }}
                        >
                          <span style={{ fontSize: '8px' }}>{isActive ? '●' : '○'}</span>
                          <span style={{ fontWeight: isActive ? 700 : 400 }}>{grp.name}</span>
                        </button>
                      )}
                      {/* Pencil — only visible on the active row, always shown (not hover-only) */}
                      {isActive && !isRenaming && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setRenameGroupInput(grp.name);
                            setRenamingGroupId(grp.id);
                          }}
                          className="px-1 py-0.5 rounded text-gray-400 hover:text-white text-xs flex-shrink-0"
                          title={t('tattingOrderGroupRename')}
                        >✏️</button>
                      )}
                      {/* Delete — hover-reveal on all rows */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setShowGroupDropdown(false);
                          setConfirmDialog({
                            message: t('tattingOrderGroupDeleteConfirm').replace('{name}', grp.name),
                            confirmLabel: t('confirmDelete'),
                            onConfirm: () => {
                              const newEls = elementsRef.current.map(el =>
                                el.orderGroup === grp.id ? { ...el, orderGroup: undefined } : el
                              );
                              const newGroups = orderGroupsRef.current.filter(g => g.id !== grp.id);
                              setElements(newEls);
                              setOrderGroups(newGroups);
                              if (activeOrderGroupId === grp.id) setActiveOrderGroupId(null);
                              pushHistoryState(newEls, picotConnectionsRef.current, newGroups);
                            }
                          });
                        }}
                        className="opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded text-red-400 hover:text-red-200 text-xs flex-shrink-0"
                        title={t('tattingOrderGroupDelete')}
                      >🗑</button>
                    </div>
                  );
                })}

                <div className="my-1 border-t border-gray-600" />

                {/* + New Group */}
                {showNewGroupInput ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      autoFocus
                      type="text"
                      value={newGroupNameInput}
                      onChange={e => setNewGroupNameInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const name = newGroupNameInput.trim() ||
                            t('tattingOrderGroupDefault').replace('{n}', String(orderGroups.length + 1));
                          const id = crypto.randomUUID();
                          const newGroups = [...orderGroupsRef.current, { id, name }];
                          setOrderGroups(newGroups);
                          setActiveOrderGroupId(id);
                          setNewGroupNameInput('');
                          setShowNewGroupInput(false);
                          setShowGroupDropdown(false);
                          pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
                        }
                        if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupNameInput(''); }
                      }}
                      onClick={e => e.stopPropagation()}
                      placeholder={t('tattingOrderGroupNamePlaceholder')}
                      className="flex-1 px-2 py-0.5 bg-gray-600 border border-emerald-500 rounded text-white text-xs"
                    />
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const name = newGroupNameInput.trim() ||
                          t('tattingOrderGroupDefault').replace('{n}', String(orderGroups.length + 1));
                        const id = crypto.randomUUID();
                        const newGroups = [...orderGroupsRef.current, { id, name }];
                        setOrderGroups(newGroups);
                        setActiveOrderGroupId(id);
                        setNewGroupNameInput('');
                        setShowNewGroupInput(false);
                        setShowGroupDropdown(false);
                        pushHistoryState(elementsRef.current, picotConnectionsRef.current, newGroups);
                      }}
                      className="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs border border-emerald-500"
                    >✓</button>
                    <button
                      onClick={e => { e.stopPropagation(); setShowNewGroupInput(false); setNewGroupNameInput(''); }}
                      className="px-1.5 py-0.5 rounded bg-gray-600 hover:bg-gray-500 text-gray-300 text-xs"
                    >✕</button>
                  </div>
                ) : (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setNewGroupNameInput(t('tattingOrderGroupDefault').replace('{n}', String(orderGroups.length + 1)));
                      setShowNewGroupInput(true);
                    }}
                    className="w-full text-left px-3 py-1 text-xs text-emerald-400 hover:bg-gray-700 hover:text-emerald-300"
                  >
                    {t('tattingOrderGroupNew')}
                  </button>
                )}
              </div>
            </>
            );
          })()}
        </div>

        {/* Progress in current scope */}
        <span className="text-xs font-semibold" style={{ color: activeBadgeFill }}>
          {t('tattingOrderProgress')
            .replace('{numbered}', String(numberedInScope))
            .replace('{total}', String(totalInScope))}
        </span>

        {!selectedEl && (
          <span className="text-gray-400 text-xs">{t('tattingOrderSub')}</span>
        )}

        <div className="ml-auto flex-shrink-0">
          <button
            onClick={() => {
              const unnumbered = elements.filter(e =>
                e.type !== 'line' && !e.isRepeat && (!e.orderNumber || String(e.orderNumber).trim() === '')
              ).length;
              setActiveMode(null);
              setSelectedIds([]);
              setShowNewGroupInput(false);
              setShowGroupDropdown(false);
              if (unnumbered > 0) {
                showLoadMsg('error', t('tattingOrderExitWarning').replace('{n}', String(unnumbered)));
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium border border-gray-400"
          >
            ✕ {t('picotExitBtn')}
          </button>
        </div>
      </div>

      {/* Row 2: element controls (only when one element selected) */}
      {selectedEl && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-gray-300 text-xs">{t('tattingOrderNumberLabel')}</span>
          <input
            type="number"
            min={1}
            value={tattingOrderInput}
            onChange={e => setTattingOrderInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const n = parseInt(tattingOrderInput, 10);
                if (!isNaN(n) && n > 0) assignOrderNumber(selectedEl.id, n);
              }
            }}
            placeholder="—"
            className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm text-center"
            style={{ touchAction: 'manipulation' }}
          />
          <button
            onClick={() => {
              const n = parseInt(tattingOrderInput, 10);
              if (!isNaN(n) && n > 0) assignOrderNumber(selectedEl.id, n);
            }}
            disabled={!tattingOrderInput || isNaN(parseInt(tattingOrderInput, 10))}
            className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-sm border border-gray-500"
          >
            ↵
          </button>
          <button
            onClick={() => {
              const next = getNextAvailableNumber();
              assignOrderNumber(selectedEl.id, next);
            }}
            className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold border border-emerald-500"
          >
            {t('tattingOrderAssignNext')} ({getNextAvailableNumber()})
          </button>
          {/* Assign to Group */}
          <button
            onClick={() => {
              const hasNumber = selectedEl.orderNumber != null && String(selectedEl.orderNumber).trim() !== '';
              if (hasNumber) {
                const newEls = elementsRef.current.map(e =>
                  e.id === selectedEl.id ? { ...e, orderGroup: activeOrderGroupId ?? undefined } : e
                );
                setElements(newEls);
                pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
              } else {
                const next = getNextAvailableNumber();
                const newEls = elementsRef.current.map(e =>
                  e.id === selectedEl.id ? { ...e, orderGroup: activeOrderGroupId ?? undefined, orderNumber: next } : e
                );
                setElements(newEls);
                setTattingOrderInput('');
                pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
              }
            }}
            className="px-3 py-1 rounded text-xs font-semibold border"
            style={{
              backgroundColor: activeBadgeFill + '33',
              borderColor: activeBadgeFill,
              color: activeBadgeFill,
            }}
          >
            {t('tattingOrderAssignGroup')}: {activeGroup ? activeGroup.name : t('tattingOrderUngrouped')}
          </button>
          <button
            onClick={() => {
              const newEls = elementsRef.current.map(e =>
                e.id === selectedEl.id ? { ...e, rw: !selectedEl.rw } : e
              );
              setElements(newEls);
              pushHistoryState(newEls, picotConnectionsRef.current, orderGroupsRef.current);
            }}
            className={`px-2 py-1 rounded text-xs font-bold border ${selectedEl.rw ? 'bg-amber-600 hover:bg-amber-700 border-amber-500 text-white' : 'bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-300'}`}
            title={t('propRWTooltip')}
          >
            RW
          </button>
          <button
            onClick={() => assignRepeat(selectedEl.id)}
            disabled={selectedEl.isRepeat}
            className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-gray-300 text-sm border border-gray-500"
            title="R"
          >
            {t('btnAssignRepeat')}
          </button>
          <button
            onClick={() => clearOrderAssignment(selectedEl.id)}
            disabled={!selectedEl.orderNumber && !selectedEl.isRepeat}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 text-sm border border-gray-600"
            title="Delete"
          >
            {t('tattingOrderClear')}
          </button>
          {selectedEl.orderNumber && (() => {
            const selGi = selectedEl.orderGroup
              ? orderGroups.findIndex(g => g.id === selectedEl.orderGroup)
              : -1;
            const [selFill] = ORDER_GROUP_COLORS[selGi >= 0 ? selGi % ORDER_GROUP_COLORS.length : 0];
            const selGroupName = selGi >= 0 ? orderGroups[selGi]?.name : null;
            return (
              <span className="text-xs font-semibold" style={{ color: selFill }}>
                {selGroupName ? `${selGroupName} #` : '#'}{selectedEl.orderNumber}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
};
