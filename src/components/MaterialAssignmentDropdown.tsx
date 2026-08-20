import React from 'react';
import { updateSelected } from '../utils/elementUpdates';

// Extracted from tattingindex.tsx (single-select property bar, material assignment
// section). Shared by both line-type and general-type elements — sits AFTER the
// line-vs-general dispatch, not inside either branch.
// Pure relocation — no logic changes. Verify against original lines 7637–7711.

interface MaterialAssignmentDropdownProps {
  selectedElement: any;
  selectedIdSet: Set<any>;
  materials: any[];
  getGradientColorAtPosition: (color: any, pos: number) => string;
  setElements: (fn: any[] | ((prev: any[]) => any[])) => void;
  setShowMaterialsPanel: (v: boolean) => void;
  t: (key: string) => string;
}

export function MaterialAssignmentDropdown({
  selectedElement,
  selectedIdSet,
  materials,
  getGradientColorAtPosition,
  setElements,
  setShowMaterialsPanel,
  t,
}: MaterialAssignmentDropdownProps) {
  return (
    <>
      {/* Material assignment dropdown — end of property bar */}
      <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
      <div className="flex items-center gap-1 top-toolbar-scalable">
        <label className="text-xs text-gray-400 hide-label-mobile">
          {selectedElement.isSplitRing ? t('matALabel') : t('materialLabel')}
        </label>
        <select
          value={selectedElement.materialId || 'default'}
          onChange={(e) => {
            const matId = e.target.value;
            if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
            setElements(prev => updateSelected(prev, selectedIdSet, { materialId: matId }));
          }}
          className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
          style={{ maxWidth: '120px' }}
        >
          {materials.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
          <option disabled>──────</option>
          <option value="__edit__">{t('editMaterials')}</option>
        </select>
        {(() => {
          const mat = materials.find(m => m.id === (selectedElement.materialId || 'default'));
          if (!mat) return null;
          return (
            <div
              className="w-5 h-5 rounded border border-gray-500 flex-shrink-0 relative overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: mat.isGradient ? getGradientColorAtPosition(mat.color, 0.5) : mat.color }}
              title={mat.name}
            >
              {mat.isGradient && <span style={{ fontSize:'9px', fontWeight:'bold', color:'white', textShadow:'0 0 2px black,0 0 2px black', lineHeight:1 }}>G</span>}
            </div>
          );
        })()}
      </div>

       {/* Material B selector — split rings only, right after Material A */}
       {selectedElement.isSplitRing && (
         <>
           <div className="w-px h-6 bg-gray-600 mx-1" />
           <div className="flex items-center gap-1 top-toolbar-scalable">
             <label className="text-xs text-gray-400 hide-label-mobile">{t('matBLabel')}</label>
             <select
               value={selectedElement.materialIdB || selectedElement.materialId || 'default'}
               onChange={(e) => {
                 const matId = e.target.value;
                 if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
                 setElements(prev => updateSelected(prev, selectedIdSet, { materialIdB: matId }));
               }}
               className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
               style={{ maxWidth: '110px' }}
             >
               {materials.map(m => (
                 <option key={m.id} value={m.id}>{m.name}</option>
               ))}
               <option disabled>──────────</option>
               <option value="__edit__">{t('editMaterials')}</option>
             </select>
             {(() => {
               const matB = materials.find(m => m.id === (selectedElement.materialIdB || selectedElement.materialId || 'default'));
               if (!matB) return null;
               return (
                 <div
                   className="w-5 h-5 rounded border border-gray-500 flex-shrink-0 relative overflow-hidden flex items-center justify-center"
                   style={{ backgroundColor: matB.isGradient ? getGradientColorAtPosition(matB.color, 0.5) : matB.color }}
                   title={matB.name}
                 >
                   {matB.isGradient && <span style={{ fontSize:'9px', fontWeight:'bold', color:'white', textShadow:'0 0 2px black,0 0 2px black', lineHeight:1 }}>G</span>}
                 </div>
               );
             })()}
           </div>
         </>
       )}
    </>
  );
}
