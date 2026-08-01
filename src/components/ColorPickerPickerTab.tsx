// components/ColorPickerPickerTab.tsx
//
// The "Picker" tab of the Color Picker dialog — saturation/brightness grid,
// hue slider, base color swatches, hex input. Extracted from
// tattingindex.tsx (see architecture.md — Color Picker dialog).
import React from 'react';
import { COLORS, hexToHsv, hsvToHex } from '../utils/color';

interface ColorPickerPickerTabProps {
  pickerColor: string;
  setPickerColor: (hex: string) => void;
  customColors: string[];
}

export const ColorPickerPickerTab: React.FC<ColorPickerPickerTabProps> = ({
  pickerColor,
  setPickerColor,
  customColors,
}) => (
  <>
    {/* Saturation/Brightness Grid */}
    <div className="mb-3 relative">
      <div
        className="w-full h-36 sm:h-48 rounded-lg cursor-crosshair border-2 border-gray-600"
        style={{
          background: `
            linear-gradient(to top, black, transparent),
            linear-gradient(to right, white, hsl(${Math.round(hexToHsv(pickerColor).h * 360)}, 100%, 50%))
          `,
          touchAction: 'none'
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = 1 - (e.clientY - rect.top) / rect.height;
          const { h } = hexToHsv(pickerColor);
          setPickerColor(hsvToHex(h, x, y));
        }}
        onTouchStart={(e) => {
          e.preventDefault(); // prevent scroll/zoom while picking
          const touch = e.touches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          // Clamp to [0,1] so touches outside the element don't sample wrong colors
          const x = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
          const y = Math.min(1, Math.max(0, 1 - (touch.clientY - rect.top) / rect.height));
          const { h } = hexToHsv(pickerColor);
          setPickerColor(hsvToHex(h, x, y));
        }}
        onTouchMove={(e) => {
          e.preventDefault(); // prevent scroll while dragging
          const touch = e.touches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          // Clamp: dragging outside the box still samples edge color, not random
          const x = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
          const y = Math.min(1, Math.max(0, 1 - (touch.clientY - rect.top) / rect.height));
          const { h } = hexToHsv(pickerColor);
          setPickerColor(hsvToHex(h, x, y));
        }}
      >
        {/* Color indicator dot */}
        {(() => {
          const { s, v } = hexToHsv(pickerColor);
          return (
            <div
              className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none"
              style={{
                left: `${s * 100}%`,
                top: `${(1 - v) * 100}%`,
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 0 1px black, 0 2px 4px rgba(0,0,0,0.3)'
              }}
            />
          );
        })()}
      </div>
    </div>

    {/* Hue Slider */}
    <div className="mb-3 relative">
      <style>{`
        .hue-slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          border: 3px solid white;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        .hue-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          border: 3px solid white;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2);
          cursor: pointer;
        }
      `}</style>
      <input
        type="range"
        min="0"
        max="360"
        className="hue-slider w-full h-4 sm:h-8 rounded-lg cursor-pointer"
        value={Math.round(hexToHsv(pickerColor).h * 360)}
        onChange={(e) => {
          const h = parseInt(e.target.value) / 360;
          const { s, v } = hexToHsv(pickerColor);
          setPickerColor(hsvToHex(h, s, v));
        }}
        onInput={(e) => {
          // Same logic as onChange - ensures touch events work
          const h = parseInt((e.target as HTMLInputElement).value) / 360;
          const { s, v } = hexToHsv(pickerColor);
          setPickerColor(hsvToHex(h, s, v));
        }}
        style={{
          background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          touchAction: 'manipulation'
        }}
      />
    </div>

    {/* Base color swatches */}
    <div className="grid grid-cols-7 gap-1 mb-3">
      {[...COLORS, ...customColors].map((color, i) => (
        <div
          key={i}
          onClick={() => setPickerColor(color)}
          className="rounded cursor-pointer border-2 border-gray-600 hover:border-white"
          style={{ backgroundColor: color, width: '100%', paddingBottom: '100%', position: 'relative' }}
          title={color}
        />
      ))}
    </div>

    {/* Hex Input */}
    <input
      type="text"
      value={pickerColor}
      onChange={(e) => {
        const val = e.target.value;
        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
          setPickerColor(val);
        }
      }}
      className="px-3 py-2 bg-gray-700 text-white rounded w-full mb-2 uppercase font-mono text-center"
      placeholder="#FFFFFF"
      maxLength={7}
    />
  </>
);
