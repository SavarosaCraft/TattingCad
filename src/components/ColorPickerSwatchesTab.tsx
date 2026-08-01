// components/ColorPickerSwatchesTab.tsx
//
// The "DMC Swatches" tab of the Color Picker dialog — search, category
// tabs, paginated color grid, preview panel. Extracted from
// tattingindex.tsx (see architecture.md — Color Picker dialog). Uses
// GradientSwatch.tsx for the two gradient-rendering spots (grid item +
// preview) that used to duplicate the stops-parsing/SVG code inline.
import React from 'react';
import { GradientSwatch } from './GradientSwatch';
import { parseGradientStops } from '../utils/color';

interface ColorEntry {
  id: string;
  name: string;
  hex?: string;
  type?: string;
  group?: string;
  stops?: string | Array<{ offset: string; color: string }>;
}

interface ColorPickerSwatchesTabProps {
  dmcColors: ColorEntry[];
  dmcSearchTerm: string;
  setDmcSearchTerm: (v: string) => void;
  dmcPage: number;
  setDmcPage: (n: number) => void;
  dmcCategory: string;
  setDmcCategory: (c: string) => void;
  selectedDmcColor: ColorEntry | null;
  setSelectedDmcColor: (c: ColorEntry) => void;
  setPickerColor: (hex: string) => void;
  categorizeColor: (color: ColorEntry) => string;
  t: (key: string) => string;
}

export const ColorPickerSwatchesTab: React.FC<ColorPickerSwatchesTabProps> = ({
  dmcColors,
  dmcSearchTerm,
  setDmcSearchTerm,
  dmcPage,
  setDmcPage,
  dmcCategory,
  setDmcCategory,
  selectedDmcColor,
  setSelectedDmcColor,
  setPickerColor,
  categorizeColor,
  t,
}) => {
  if (dmcColors.length === 0) {
    return (
      <div className="bg-gray-700 rounded p-6 text-center">
        <p className="text-gray-400">{t('loadingDmcColors')}</p>
      </div>
    );
  }

  const solidColors = dmcColors.filter(c => c.type !== 'gradient');
  const groups = ['all', ...Array.from(new Set(solidColors.map(c => c.group).filter(Boolean))).sort()];

  const filteredColors = dmcColors.filter(color => {
    // NEVER show gradients in the solid color picker
    if (color.type === 'gradient') return false;

    if (dmcSearchTerm) {
      const search = dmcSearchTerm.toLowerCase();
      if (!color.id.toLowerCase().includes(search) &&
          !color.name.toLowerCase().includes(search)) {
        return false;
      }
    }

    if (dmcCategory !== 'all') {
      const colorGroup = color.group || categorizeColor(color);
      return colorGroup === dmcCategory;
    }

    return true;
  });

  const colorsPerPage = 18;
  const totalPages = Math.ceil(filteredColors.length / colorsPerPage);
  const startIdx = dmcPage * colorsPerPage;
  const endIdx = startIdx + colorsPerPage;
  const pageColors = filteredColors.slice(startIdx, endIdx);

  return (
    <>
      {/* Search field */}
      <div className="mb-3">
        <input
          type="text"
          placeholder={t('colorSearchPlaceholder')}
          value={dmcSearchTerm}
          onChange={(e) => {
            setDmcSearchTerm(e.target.value);
            setDmcPage(0); // Reset to first page on search
          }}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
        />
      </div>

      {/* Category tabs - derived dynamically from loaded JSON groups */}
      <div className="mb-3 flex flex-wrap gap-1">
        {groups.map(cat => (
          <button
            key={cat}
            onClick={() => {
              setDmcCategory(cat);
              setDmcPage(0);
              setDmcSearchTerm('');
            }}
            className={`px-2 py-1 rounded text-xs font-medium ${
              dmcCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Color grid - fixed height, swatches maintain size */}
      <div className="grid grid-cols-6 gap-2 p-2 bg-gray-700 rounded mb-3" style={{ height: '164px', alignContent: 'start' }}>
        {pageColors.map((color) => (
          <div
            key={color.id}
            onClick={() => {
              setSelectedDmcColor(color);
              // For gradients, extract first color
              if (color.type === 'gradient' && color.stops) {
                const stops = parseGradientStops(color.stops);
                if (stops.length > 0) setPickerColor(stops[0].color);
              } else {
                setPickerColor(color.hex!);
              }
            }}
            className={`cursor-pointer rounded overflow-hidden transition-all h-11 ${
              selectedDmcColor?.id === color.id
                ? 'ring-4 ring-blue-500'
                : 'hover:ring-2 hover:ring-gray-400'
            }`}
            title={color.name}
            style={{ touchAction: 'manipulation' }}
          >
            <div
              className="w-full h-full flex items-center justify-center border-2 border-black relative"
              style={{
                background: color.type === 'gradient'
                  ? 'transparent'
                  : color.hex
              }}
            >
              {color.type === 'gradient' && color.stops && (
                <GradientSwatch gradientId={`swatch-gradient-${color.id}`} stops={color.stops} />
              )}
              <span
                className="text-white font-bold text-xs px-1 py-0.5 rounded"
                style={{
                  textShadow: '0 0 3px black, 0 0 5px black',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {color.id}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination controls - always visible */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          onClick={() => setDmcPage(Math.max(0, dmcPage - 1))}
          disabled={dmcPage === 0}
          className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-600 disabled:hover:bg-gray-700"
        >
          {t('prevBtn')}
        </button>

        <span className="text-gray-400 text-sm">
          {t('colorPageIndicator').replace('{page}', String(dmcPage + 1)).replace('{total}', String(Math.max(1, totalPages))).replace('{count}', String(filteredColors.length))}
        </span>

        <button
          onClick={() => setDmcPage(Math.min(totalPages - 1, dmcPage + 1))}
          disabled={dmcPage >= totalPages - 1}
          className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-600 disabled:hover:bg-gray-700"
        >
          {t('nextBtn')}
        </button>
      </div>

      {/* Color preview section - under the grid */}
      <div className="bg-gray-700 rounded p-3 border-2 border-gray-600">
        <div className="flex items-center gap-3 h-16">
          <div
            className="w-16 h-16 rounded border-2 border-black flex-shrink-0 relative overflow-hidden"
            style={{ backgroundColor: selectedDmcColor ? (selectedDmcColor.type === 'gradient' ? 'transparent' : selectedDmcColor.hex) : '#374151' }}
          >
            {selectedDmcColor?.type === 'gradient' && selectedDmcColor.stops && (
              <GradientSwatch gradientId={`preview-gradient-${selectedDmcColor.id}`} stops={selectedDmcColor.stops} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {selectedDmcColor ? (
              <>
                <p className="text-white font-bold text-base mb-1">
                  {selectedDmcColor.name}
                </p>
                <p className="text-gray-300 font-mono text-xs">
                  ID: {selectedDmcColor.id} · {selectedDmcColor.type === 'gradient' ? 'Variegated' : selectedDmcColor.hex}
                </p>
              </>
            ) : (
              <p className="text-gray-400 text-sm">
                {t('clickColorPreview')}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
