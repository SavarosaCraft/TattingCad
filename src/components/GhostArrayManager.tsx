// components/GhostArrayManager.tsx
//
// Arrange → Ghost Array Manager, and the "Convert …?" confirm box. Moved
// unchanged from tattingindex.tsx (session 64, Task 2 step 4): the markup
// and handlers are the same; the values they used from the component come
// in as props of the same names. tattingindex.tsx still decides when each is
// shown ({showArrayManager && …}, {convertConfirm && …}).
//
// Apply (fix 13, session 64) updates the same array through
// useGhostArrays.applyArrayChange; it used to delete the array and make a new
// one after two timers (L4), which lost the array's join rules.
import React from 'react';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface GhostArrayManagerProps {
  t: (key: string) => string;
  ghostArrays: any[];
  setGhostArrays: SetState<any[]>;
  elements: any[];
  setElements: SetState<any[]>;
  elementById: Map<string, any>;
  polarGrids: any[];
  setSelectedIds: SetState<string[]>;
  setShowArrayManager: (show: boolean) => void;
  setConvertConfirm: SetState<any>;
  /** Apply: new settings for this array (useGhostArrays.applyArrayChange). */
  applyArrayChange: (array: any, changes: { instanceCount: number; angle: number; pivotId?: string; spacing?: number }) => void;
}

export function GhostArrayManager({
  t, ghostArrays, setGhostArrays, elements, setElements, elementById, polarGrids,
  setSelectedIds, setShowArrayManager, setConvertConfirm, applyArrayChange,
}: GhostArrayManagerProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2147483647 }}>
      <div className="tcad-dialog bg-gray-800 rounded-xl shadow-2xl border border-gray-600 flex flex-col"
        style={{ width: 'min(560px, 95vw)', maxHeight: '85dvh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-600 flex-shrink-0">
          <h2 className="text-gray-100 font-bold text-lg">{t('ghostArrayManagerTitle')}</h2>
          <button onClick={() => setShowArrayManager(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1" style={{minHeight:0}}>
          {ghostArrays.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('ghostArrayManagerEmpty')}</p>
          ) : (
            ghostArrays.map((array) => {
              const sourceEl = elementById.get(array.sourceId);
              const existingGhosts = elements.filter(el => el.type === 'ghost' && el.sourceId === array.sourceId);
              return (
                <div key={array.id} className="flex flex-col gap-2 bg-gray-700 rounded-lg px-3 py-3">
                  {/* Header row: type + source status + action buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl flex-shrink-0">👻</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium ">{array.type === 'polar' ? t('ghostArrayTypePolar') : t('ghostArrayTypeLinear')}</div>
                      <div className="text-gray-400 text-xs">{t('ghostArraySource')}: {sourceEl ? '✓' : t('ghostArraySourceDeleted')}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (sourceEl) {
                          setSelectedIds([sourceEl.id]);
                        } else {
                          const firstGhost = existingGhosts[0];
                          if (firstGhost) setSelectedIds([firstGhost.id]);
                        }
                        setShowArrayManager(false);
                      }}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded"
                      title={sourceEl ? t('ghostArraySelectTitle') : t('ghostArraySelectGhostTitle')}
                    >{t('ghostArraySelect')}</button>
                    <button
                      onClick={() => {
                        // Delete ghosts by sourceId (ghostIds may be stale after undo)
                        setElements(prev => prev.filter(el => !(el.type === 'ghost' && el.sourceId === array.sourceId)));
                        setGhostArrays(prev => prev.filter(a => a.id !== array.id));
                      }}
                      className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded"
                    >✕</button>
                  </div>

                  {/* Editable fields row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-400">{t('ghostArrayCount')}:</label>
                      <input
                        type="number"
                        min={2}
                        max={100}
                        defaultValue={array.instanceCount}
                        id={`ghost-count-${array.id}`}
                        className="w-14 px-1 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-400">{array.type === 'polar' ? t('ghostArrayAngle') : t('linearArrayDirection')}:</label>
                      <input
                        type="number"
                        step={0.5}
                        defaultValue={array.angle}
                        id={`ghost-angle-${array.id}`}
                        className="w-16 px-1 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white text-center"
                      />
                      <span className="text-xs text-gray-500">°</span>
                    </div>
                    {array.type === 'polar' && (
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-400">{t('ghostArrayGrid')}:</label>
                        <select
                          defaultValue={array.pivotId || 'selection'}
                          id={`ghost-grid-${array.id}`}
                          className="px-1 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white"
                        >
                          <option value="selection">{t('ghostArraySelectionCenter')}</option>
                          {polarGrids.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {array.type === 'linear' && (
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-400">{t('ghostArraySpacePct')}:</label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          step={0.5}
                          defaultValue={array.spacing}
                          id={`ghost-spacing-${array.id}`}
                          onBlur={e => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val) || val < 0) e.target.value = '0';
                            else if (val > 500) e.target.value = '500';
                          }}
                          className="w-14 px-1 py-0.5 bg-gray-600 rounded border border-gray-500 text-xs text-white text-center"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (!sourceEl) return;
                        const countInput = document.getElementById(`ghost-count-${array.id}`) as HTMLInputElement;
                        const angleInput = document.getElementById(`ghost-angle-${array.id}`) as HTMLInputElement;
                        const gridSelect = document.getElementById(`ghost-grid-${array.id}`) as HTMLSelectElement;
                        const spacingInput = document.getElementById(`ghost-spacing-${array.id}`) as HTMLInputElement | null;
                        const count = parseInt(countInput?.value || '2', 10);
                        const angle = parseFloat(angleInput?.value || '0');
                        const pivot = gridSelect?.value || array.pivotId || 'selection';
                        const spacing = spacingInput ? parseFloat(spacingInput.value || '0') : 0;
                        if (count < 2) return;
                        // Fix 13 (session 64): the SAME array gets the new
                        // settings; copies and joins are rebuilt in one step
                        // (useGhostArrays.applyArrayChange) — no more deleting
                        // the array and remaking it after two timers (L4).
                        applyArrayChange(array, array.type === 'polar'
                          ? { instanceCount: count, angle, pivotId: pivot }
                          : { instanceCount: count, angle, spacing });
                        setSelectedIds([sourceEl.id]);
                      }}
                      disabled={!sourceEl}
                      className="text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
                      title={sourceEl ? t('ghostArrayApplyTitle') : t('ghostArraySourceDeleted')}
                    >
                      {t('ghostArrayApply')}
                    </button>
                    <button
                      onClick={() => setConvertConfirm(array)}
                      disabled={existingGhosts.length === 0}
                      className="text-xs px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
                      title={t('ghostArrayConvertTitle')}
                    >
                      {t('ghostArrayConvert')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="px-5 pb-2 flex-shrink-0">
          <button
            onClick={() => setConvertConfirm('all')}
            className="w-full px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm font-medium"
          >
            {t('ghostArrayConvertAllTitle')}
          </button>
        </div>
        <div className="px-5 pb-4 flex-shrink-0">
          <p className="text-xs text-gray-500">{t('ghostArrayApplyTitle')}</p>
        </div>
      </div>
    </div>
  );
}

interface ConvertGhostConfirmProps {
  t: (key: string) => string;
  /** 'all', or the array to convert. */
  convertConfirm: any;
  setConvertConfirm: SetState<any>;
  ghostArrays: any[];
  convertGhostArray: (array: any) => void;
  convertAllGhostArrays: () => void;
}

export function ConvertGhostConfirm({
  t, convertConfirm, setConvertConfirm, ghostArrays, convertGhostArray, convertAllGhostArrays,
}: ConvertGhostConfirmProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50" style={{zIndex: 2147483646}} onClick={() => setConvertConfirm(null)}></div>
      <div
        className="tcad-dialog fixed bg-gray-700 rounded-lg shadow-xl border border-gray-600 p-5 w-80"
        style={{zIndex: 2147483647, top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}
      >
        {convertConfirm === 'all' ? (
          <>
            <h3 className="text-gray-100 font-bold mb-3">{t('ghostArrayConvertAllTitle')}</h3>
            <p className="text-gray-300 text-sm mb-4">
              {t('ghostArrayConvertAllConfirm')
                .replace('{total}', String(ghostArrays.reduce((sum, a) => sum + a.ghostIds.length, 0)))
                .replace('{arrays}', String(ghostArrays.length))}
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => setConvertConfirm(null)}
                className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
              >
                {t('confirmCancel')}
              </button>
              <button
                onClick={convertAllGhostArrays}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm"
              >
                {t('ghostArrayConvertAllBtn')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-gray-100 font-bold mb-3">{t('ghostArrayConvertTitle')}</h3>
            <p className="text-gray-300 text-sm mb-4">
              {t('ghostArrayConvertConfirm')
                .replace('{count}', String(convertConfirm.instanceCount - 1))
                .replace('{name}', convertConfirm.name)}
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => setConvertConfirm(null)}
                className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
              >
                {t('confirmCancel')}
              </button>
              <button
                onClick={() => convertGhostArray(convertConfirm)}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-sm"
              >
                {t('ghostArrayConvert')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
