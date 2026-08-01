// components/ColorPickerGradientsTab.tsx
//
// The "Gradients" tab of the Color Picker dialog — search, thread-line
// filter chips, paginated gradient grid, preview panel. Extracted from
// tattingindex.tsx (see architecture.md — Color Picker dialog). Uses
// PresetChip.tsx (already existed) for the filter chips and
// GradientSwatch.tsx for the two gradient-rendering spots.
import React from 'react';
import { PresetChip } from './PresetChip';
import { GradientSwatch } from './GradientSwatch';

interface ColorEntry {
  id: string;
  name: string;
  type?: string;
  group?: string;
  stops?: string | Array<{ offset: string; color: string }>;
}

interface ColorPickerGradientsTabProps {
  dmcColors: ColorEntry[];
  gradientSearchTerm: string;
  setGradientSearchTerm: (v: string) => void;
  gradientPage: number;
  setGradientPage: (fn: ((prev: number) => number) | number) => void;
  gradientCategory: string;
  setGradientCategory: (c: string) => void;
  selectedGradient: ColorEntry | null;
  setSelectedGradient: (c: ColorEntry) => void;
  t: (key: string) => string;
}

export const ColorPickerGradientsTab: React.FC<ColorPickerGradientsTabProps> = ({
  dmcColors,
  gradientSearchTerm,
  setGradientSearchTerm,
  gradientPage,
  setGradientPage,
  gradientCategory,
  setGradientCategory,
  selectedGradient,
  setSelectedGradient,
  t,
}) => {
  const allGradients = dmcColors.filter(c => c.type === 'gradient');
  const threadLines = ['all', ...Array.from(new Set(allGradients.map(c => c.group).filter(Boolean)))];

  const filtered = allGradients.filter(color => {
    if (gradientSearchTerm) {
      const s = gradientSearchTerm.toLowerCase();
      if (!color.id.toLowerCase().includes(s) && !color.name.toLowerCase().includes(s)) return false;
    }
    if (gradientCategory !== 'all') return color.group === gradientCategory;
    return true;
  });
  const perPage = 24;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice(gradientPage * perPage, (gradientPage + 1) * perPage);

  return (
    <>
      {/* Search bar */}
      <input
        type="text"
        placeholder={t('colorSearchPlaceholder')}
        value={gradientSearchTerm}
        onChange={(e) => { setGradientSearchTerm(e.target.value); setGradientPage(0); }}
        className="w-full px-3 py-2 bg-gray-700 text-white rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      {/* Thread line filter */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {threadLines.map(line => (
          <PresetChip
            key={line}
            onClick={() => { setGradientCategory(line); setGradientPage(0); }}
            selected={gradientCategory === line}
            className="px-3 py-1"
          >
            {line === 'all' ? 'All' : line}
          </PresetChip>
        ))}
      </div>
      {/* Grid + pagination */}
      <div className="grid grid-cols-6 gap-2 p-2 bg-gray-700 rounded mb-2" style={{ height: '216px', alignContent: 'start' }}>
        {pageItems.map((color) => (
          <div
            key={color.id}
            onClick={() => setSelectedGradient(color)}
            className={`cursor-pointer rounded overflow-hidden transition-all h-11 ${selectedGradient?.id === color.id ? 'ring-4 ring-blue-500' : 'hover:ring-2 hover:ring-gray-400'}`}
            title={color.name}
          >
            <div className="w-full h-full relative border-2 border-black">
              {color.stops && <GradientSwatch gradientId={`cpicker-gradient-${color.id}`} stops={color.stops} />}
              <span className="text-white font-bold text-xs px-1 py-0.5 rounded" style={{ textShadow: '0 0 3px black', backgroundColor: 'rgba(0,0,0,0.3)', position: 'relative', zIndex: 1 }}>
                {color.id}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mb-3" style={{ height: '2rem' }}>
        <button onClick={() => setGradientPage(p => Math.max(0, p - 1))} disabled={gradientPage === 0} className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 hover:bg-gray-600">{t('prevBtn')}</button>
        <span className="text-gray-400 text-sm">{t('colorPageIndicator').replace('{page}', String(gradientPage + 1)).replace('{total}', String(totalPages)).replace('{count}', String(filtered.length))}</span>
        <button onClick={() => setGradientPage(p => Math.min(totalPages - 1, p + 1))} disabled={gradientPage >= totalPages - 1} className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 hover:bg-gray-600">{t('nextBtn')}</button>
      </div>
      {/* Preview */}
      <div className="bg-gray-700 rounded p-3 border-2 border-gray-600">
        <div className="flex items-center gap-3 h-16">
          <div className="w-16 h-16 rounded border-2 border-black flex-shrink-0 relative overflow-hidden" style={{ backgroundColor: selectedGradient ? 'transparent' : '#374151' }}>
            {selectedGradient?.stops && (
              <GradientSwatch gradientId={`cpicker-preview-${selectedGradient.id}`} stops={selectedGradient.stops} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {selectedGradient ? (
              <>
                <p className="text-white font-bold text-base mb-1">{selectedGradient.name}</p>
                <p className="text-gray-300 font-mono text-xs mb-2">ID: {selectedGradient.id} · {selectedGradient.group || 'Gradient'}</p>
              </>
            ) : (
              <p className="text-gray-400 text-sm">{t('clickGradientPreview')}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
